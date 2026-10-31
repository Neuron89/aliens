/* ═══════════════════════════════════════════════════════════════
   TABLE BOARD — pure functions (no sockets, no I/O).
   See docs/BOARD_AND_BUILDER.md §2–§3.

   - sanitizeMapDef(def)        validate/normalize a client-resolved map definition
   - roomAt(mapDef, x, y, lvl)  room hit-testing from normalized shapes
   - sanitizeToken(...)         validate/merge a token upsert
   - placeToken(board, mapDef, token)  recompute roomId + PC auto-reveal
   - viewFor(board, role)       visibility filter (board/player never see hidden
                                tokens or tokens in unrevealed rooms)
   board.tokens / board.rooms are null-prototype objects (guard.nullObj)
   and every id used as a key rejects '__proto__' / 'constructor' /
   'prototype' (docs/REVIEW_2026-10-30.md #6). normalizeBoard() converts
   a board loaded from a JSON snapshot.
   ═══════════════════════════════════════════════════════════════ */
import { nullObj, isSafeKey } from './guard.js';

export const TOKEN_KINDS = ['pc', 'npc', 'creature', 'item', 'marker', 'hazard'];
export const MAX_TOKENS = 300;
export const MAX_ROOMS = 500;
export const MAX_POINTS = 128;
export const MAX_PINGS = 5;
export const MAX_MAPDEF_BYTES = 256 * 1024;

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ID_RE = { test: (v) => isSafeKey(v) && KEBAB_RE.test(v) }; // kebab-case, never a prototype name
const MAP_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*(:[a-z0-9]+(-[a-z0-9]+)*)?$/;
const TOKEN_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const clamp01 = (n) => clamp(n, 0, 1);
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : undefined);

export const DEFAULT_VIEW = Object.freeze({ rotation: 0, flipX: false, zoom: 1, pan: [0, 0] });

/* ─── F2 director camera: board.view.camera { mode, spotlight, target } ───
   mode 'fixed' (the plain fitted plan, the default) | 'follow' (TV frames the revealed rooms
   holding PCs) | 'cinematic' (follow + drift/vignette/edge treatment); spotlight dims all but the
   active initiative token's room; target = a room id the GM pinned (null = automatic framing).
   The TV only ever frames rooms it may see, so a target in fog is ignored client-side. */
export const CAMERA_MODES = Object.freeze(['fixed', 'follow', 'cinematic']);
export const DEFAULT_CAMERA = Object.freeze({ mode: 'fixed', spotlight: false, target: null });
export function sanitizeCamera(c, prev = DEFAULT_CAMERA) {
  const base = prev && typeof prev === 'object' ? prev : DEFAULT_CAMERA;
  const out = {
    mode: CAMERA_MODES.includes(base.mode) ? base.mode : 'fixed',
    spotlight: !!base.spotlight,
    target: typeof base.target === 'string' && ID_RE.test(base.target) ? base.target : null,
  };
  if (!c || typeof c !== 'object' || Array.isArray(c)) return out;
  if (c.mode !== undefined) out.mode = CAMERA_MODES.includes(c.mode) ? c.mode : 'fixed';
  if (c.spotlight !== undefined) out.spotlight = c.spotlight === true;
  if (c.target !== undefined) out.target = typeof c.target === 'string' && c.target.length <= 80 && ID_RE.test(c.target) ? c.target : null;
  return out;
}

export function emptyBoard() {
  return {
    mapId: null, level: null, fog: true,
    view: { ...DEFAULT_VIEW, pan: [0, 0], camera: { ...DEFAULT_CAMERA } },
    rooms: nullObj(), tokens: nullObj(), pings: [], mapRev: 0,
  };
}

/** Board from a snapshot (plain JSON objects) → null-prototype id maps; drops reserved/invalid ids. */
export function normalizeBoard(b) {
  if (!b || typeof b !== 'object') return emptyBoard();
  if (Object.getPrototypeOf(b.tokens ?? null) !== null || !b.tokens) {
    const tokens = nullObj();
    for (const [id, t] of Object.entries(b.tokens || {})) if (isTokenId(id) && t && typeof t === 'object') tokens[id] = t;
    b.tokens = tokens;
  }
  if (Object.getPrototypeOf(b.rooms ?? null) !== null || !b.rooms) {
    const rooms = nullObj();
    for (const [id, r] of Object.entries(b.rooms || {})) if (ID_RE.test(id) && r && typeof r === 'object') rooms[id] = r;
    b.rooms = rooms;
  }
  if (!Array.isArray(b.pings)) b.pings = [];
  if (b.view && typeof b.view === 'object') b.view.camera = sanitizeCamera(null, b.view.camera); // F2: snapshots before the camera
  return b;
}

/* ─── Map definitions ───────────────────────────────────────── */

export function sanitizeShape(s) {
  if (!s || typeof s !== 'object') return null;
  if (s.type === 'rect') {
    if (![s.x, s.y, s.w, s.h].every(isNum)) return null;
    if (s.x < 0 || s.y < 0 || s.w <= 0 || s.h <= 0 || s.x + s.w > 1.0001 || s.y + s.h > 1.0001) return null;
    return { type: 'rect', x: s.x, y: s.y, w: s.w, h: s.h };
  }
  if (s.type === 'poly') {
    if (!Array.isArray(s.points) || s.points.length < 3 || s.points.length > MAX_POINTS) return null;
    const pts = [];
    for (const p of s.points) {
      if (!Array.isArray(p) || p.length !== 2 || !p.every(isNum) || p.some((v) => v < 0 || v > 1)) return null;
      pts.push([p[0], p[1]]);
    }
    return { type: 'poly', points: pts };
  }
  return null;
}

const point01 = (p) => (Array.isArray(p) && p.length === 2 && p.every(isNum) && p.every((v) => v >= 0 && v <= 1) ? [p[0], p[1]] : undefined);

/**
 * Validate a resolved map definition sent by the DM client (bundled packs only
 * exist client-side). Returns { mapDef } or { error }. Rooms without a valid
 * id + shape are kept for display only if they have an id (no shape → never hit).
 */
export function sanitizeMapDef(def) {
  if (!def || typeof def !== 'object') return { error: 'mapDef required.' };
  let bytes = 0;
  try { bytes = JSON.stringify(def).length; } catch { return { error: 'mapDef not serializable.' }; }
  if (bytes > MAX_MAPDEF_BYTES) return { error: 'mapDef too large.' };
  if (typeof def.id !== 'string' || !ID_RE.test(def.id)) return { error: 'mapDef.id must be kebab-case.' };
  const kind = ['image', 'ascii', 'engine'].includes(def.kind) ? def.kind : (def.engine ? 'engine' : def.src ? 'image' : 'ascii');
  const out = { id: def.id, title: str(def.title, 120) || def.id.toUpperCase(), kind };
  if (def.subtitle) out.subtitle = str(def.subtitle, 200);
  if (kind === 'image') {
    const src = str(def.src, 500);
    if (!src || !/^(\/|https?:\/\/)/.test(src)) return { error: 'image map needs src.' };
    out.src = src;
  }
  if (kind === 'engine') {
    if (typeof def.engine !== 'string' || !ID_RE.test(def.engine)) return { error: 'engine map needs an engine id.' };
    out.engine = def.engine;
  }
  if (kind === 'ascii' && typeof def.ascii === 'string') out.ascii = def.ascii.slice(0, 20000);
  if (Array.isArray(def.size) && def.size.length === 2 && def.size.every((n) => isNum(n) && n >= 1 && n <= 100000)) out.size = [def.size[0], def.size[1]];
  if (isNum(def.grid) && def.grid > 0 && def.grid <= 0.5) out.grid = def.grid;
  if (typeof def.outline === 'string' && def.outline.length < 20000 && /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/.test(def.outline)) out.outline = def.outline;
  if (def.crop && [def.crop.x, def.crop.y, def.crop.w, def.crop.h].every(isNum) && def.crop.w > 0 && def.crop.h > 0) {
    out.crop = { x: clamp01(def.crop.x), y: clamp01(def.crop.y), w: clamp01(def.crop.w), h: clamp01(def.crop.h) };
  }
  if (Array.isArray(def.levels)) {
    out.levels = def.levels
      .filter((l) => l && typeof l.id === 'string' && ID_RE.test(l.id))
      .slice(0, 20)
      .map((l) => ({ id: l.id, label: str(l.label, 60) || l.id.toUpperCase(), ...(l.src ? { src: str(l.src, 500) } : {}), ...(l.engine ? { engine: str(l.engine, 60) } : {}) }));
    if (!out.levels.length) delete out.levels;
  }
  const levelIds = new Set((out.levels || []).map((l) => l.id));
  const rooms = [];
  const seen = new Set();
  for (const r of Array.isArray(def.rooms) ? def.rooms.slice(0, MAX_ROOMS) : []) {
    if (!r || typeof r.id !== 'string' || !ID_RE.test(r.id) || seen.has(r.id)) continue;
    const shape = sanitizeShape(r.shape);
    if (!shape) continue;
    seen.add(r.id);
    const room = { id: r.id, name: str(r.name, 80) || r.id.toUpperCase(), shape };
    if (typeof r.level === 'string' && levelIds.has(r.level)) room.level = r.level;
    if (r.note) room.note = str(r.note, 1000);
    rooms.push(room);
  }
  out.rooms = rooms;
  if (Array.isArray(def.doors)) {
    out.doors = def.doors.filter((d) => d && seen.has(d.from) && seen.has(d.to)).slice(0, 1000)
      .map((d) => ({ from: d.from, to: d.to, locked: !!d.locked }));
  }
  if (def.spawn && typeof def.spawn === 'object') {
    const spawn = {};
    const pc = point01(def.spawn.pc);
    if (pc) spawn.pc = pc;
    if (def.spawn.levels && typeof def.spawn.levels === 'object') {
      for (const [lid, v] of Object.entries(def.spawn.levels)) {
        const p = point01(v?.pc);
        if (levelIds.has(lid) && p) (spawn.levels ||= {})[lid] = { pc: p };
      }
    }
    if (Object.keys(spawn).length) out.spawn = spawn;
  }
  return { mapDef: out };
}

/** mapDef as sent to the board and players: GM room notes stripped. */
export function publicMapDef(mapDef) {
  if (!mapDef) return null;
  return { ...mapDef, rooms: (mapDef.rooms || []).map(({ note, ...r }) => r) }; // eslint-disable-line no-unused-vars
}

/* ─── Hit-testing ──────────────────────────────────────────── */

export function shapeArea(s) {
  if (s.type === 'rect') return s.w * s.h;
  let a = 0;
  const p = s.points;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
  return Math.abs(a / 2);
}

export function pointInShape(s, x, y) {
  if (s.type === 'rect') return x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h;
  let inside = false;
  const p = s.points;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i];
    const [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Smallest room (by area) on `level` that contains (x, y); rooms without a level match every level. */
export function roomAt(mapDef, x, y, level = null) {
  if (!mapDef?.rooms || !isNum(x) || !isNum(y)) return null;
  let best = null;
  let bestArea = Infinity;
  for (const r of mapDef.rooms) {
    if (level && r.level && r.level !== level) continue;
    if (!pointInShape(r.shape, x, y)) continue;
    const a = shapeArea(r.shape);
    if (a < bestArea) { best = r.id; bestArea = a; }
  }
  return best;
}

/* ─── Tokens ───────────────────────────────────────────────── */

/**
 * Merge `input` over `prev` (or create) and validate. ctx: { playerIds: Set, levels: Set, defaultLevel }.
 * Returns the token or null if invalid. Does not set roomId (see placeToken).
 */
export function sanitizeToken(input, prev, ctx = {}) {
  if (!input || typeof input !== 'object') return null;
  const t = { ...(prev || {}) };
  const id = prev?.id || input.id;
  if (!isTokenId(id)) return null;
  t.id = id;
  if (input.kind !== undefined) { if (!TOKEN_KINDS.includes(input.kind)) return null; t.kind = input.kind; }
  if (!t.kind) t.kind = 'marker';
  if (input.label !== undefined) t.label = str(input.label, 60) || '';
  if (input.sub !== undefined) t.sub = str(input.sub, 60) || '';
  if (input.icon !== undefined) t.icon = typeof input.icon === 'string' && /^(\/|https?:\/\/)/.test(input.icon) ? input.icon.slice(0, 300) : null;
  if (input.glyph !== undefined) t.glyph = str(input.glyph, 24) || null;
  if (input.color !== undefined) t.color = typeof input.color === 'string' && COLOR_RE.test(input.color) ? input.color : null;
  if (input.size !== undefined) t.size = isNum(input.size) ? clamp(input.size, 0.25, 8) : 1;
  if (input.x !== undefined) t.x = isNum(input.x) ? clamp01(input.x) : 0.5;
  if (input.y !== undefined) t.y = isNum(input.y) ? clamp01(input.y) : 0.5;
  if (input.hidden !== undefined) t.hidden = !!input.hidden;
  // Item tokens: locked = the GM decides (players see it but token-take is refused).
  if (input.locked !== undefined) t.locked = !!input.locked;
  // Status rings (board/TokenChip): up to 6 short kebab names, optional ":n" count, e.g. ['stress:3', 'wounded'].
  if (input.status !== undefined) {
    const list = Array.isArray(input.status) ? input.status : [];
    t.status = [...new Set(list.filter((s) => typeof s === 'string' && /^[a-z][a-z-]{0,15}(:\d{1,2})?$/.test(s)))].slice(0, 6);
  }
  if (input.facing !== undefined) t.facing = isNum(input.facing) ? ((Math.round(input.facing) % 360) + 360) % 360 : 0;
  if (input.note !== undefined) t.note = str(input.note, 1000) || '';
  if (input.ownerPlayerId !== undefined) {
    t.ownerPlayerId = typeof input.ownerPlayerId === 'string' && (!ctx.playerIds || ctx.playerIds.has(input.ownerPlayerId)) ? input.ownerPlayerId : null;
  }
  if (input.level !== undefined) t.level = typeof input.level === 'string' && (!ctx.levels || ctx.levels.has(input.level)) ? input.level : null;
  // GM-only creature/NPC tracking (mechanics wave, row 28): stripped from the board/player view.
  if (input.hpMax !== undefined) t.hpMax = isNum(input.hpMax) && input.hpMax > 0 ? Math.min(999, Math.round(input.hpMax)) : null;
  if (input.hp !== undefined) t.hp = isNum(input.hp) ? clamp(Math.round(input.hp), 0, t.hpMax ?? 999) : null;
  else if (input.hpMax !== undefined && isNum(t.hp) && t.hpMax) t.hp = Math.min(t.hp, t.hpMax);
  if (input.ref !== undefined) t.ref = typeof input.ref === 'string' && input.ref.length <= 80 && ID_RE.test(input.ref) ? input.ref : null;
  // Defaults for a new token
  if (t.label === undefined) t.label = '';
  if (t.sub === undefined) t.sub = '';
  if (t.icon === undefined) t.icon = null;
  if (t.glyph === undefined) t.glyph = null;
  if (t.color === undefined) t.color = null;
  if (t.size === undefined) t.size = 1;
  if (t.x === undefined) t.x = 0.5;
  if (t.y === undefined) t.y = 0.5;
  if (t.hidden === undefined) t.hidden = false;
  if (t.facing === undefined) t.facing = 0;
  if (t.note === undefined) t.note = '';
  if (t.ownerPlayerId === undefined) t.ownerPlayerId = null;
  if (t.level === undefined) t.level = ctx.defaultLevel ?? null;
  if (t.roomId === undefined) t.roomId = null;
  return t;
}

/**
 * Recompute token.roomId from the map's room shapes; a PC entering a room
 * reveals it (and marks it entered). Mutates board + token.
 * Returns the id of a room that was newly revealed, or null.
 */
export function placeToken(board, mapDef, token) {
  token.roomId = roomAt(mapDef, token.x, token.y, token.level || board.level);
  if (token.kind !== 'pc' || !token.roomId) return null;
  const st = board.rooms[token.roomId] || (board.rooms[token.roomId] = { revealed: false, entered: false });
  const newly = !st.revealed;
  st.revealed = true;
  st.entered = true;
  return newly ? token.roomId : null;
}

/** Recompute every token's room (after a map definition update). */
export function relocateAll(board, mapDef) {
  for (const t of Object.values(board.tokens)) placeToken(board, mapDef, t);
}

/* ─── Visibility ───────────────────────────────────────────── */

export function isRoomRevealed(board, roomId) {
  return !board.fog || !!board.rooms[roomId]?.revealed;
}

/** Spec rule: !hidden && (pc || !fog || outside every room || rooms[roomId].revealed).
 *  Space outside the room shapes is never drawn as fog, so a token standing there is
 *  visible (maps without room shapes — ASCII/plain images — would otherwise hide every
 *  non-PC token whenever fog is on, while the GM's sheet says VISIBLE). */
export function isTokenVisible(board, t) {
  if (t.hidden) return false;
  if (t.kind === 'pc' || !board.fog || !t.roomId) return true;
  return !!(t.roomId && board.rooms[t.roomId]?.revealed);
}

/** Board state for a role: 'dm' gets everything; 'board' / 'player' get the filtered view. */
export function viewFor(board, role) {
  if (role === 'dm') return board;
  const tokens = nullObj();
  for (const [id, t] of Object.entries(board.tokens)) {
    if (!isTokenVisible(board, t)) continue;
    const { note, hidden, hp, hpMax, ref, ai, aiRoom, aiShow, ...pub } = t; // eslint-disable-line no-unused-vars
    tokens[id] = pub;
  }
  const rooms = nullObj();
  for (const [id, r] of Object.entries(board.rooms)) {
    const { note, ...pub } = r; // eslint-disable-line no-unused-vars
    // A GM rename of a room the table has not seen yet is a spoiler: keep the id, withhold the name.
    if (pub.name !== undefined && !isRoomRevealed(board, id)) pub.name = null;
    rooms[id] = pub;
  }
  return { ...board, tokens, rooms };
}

export function sanitizeView(v, prev = DEFAULT_VIEW) {
  const out = { ...prev, pan: [...(prev.pan || [0, 0])], camera: sanitizeCamera(null, prev.camera) };
  if (!v || typeof v !== 'object') return out;
  if (v.rotation !== undefined) out.rotation = [0, 90, 180, 270].includes(v.rotation) ? v.rotation : 0;
  if (v.flipX !== undefined) out.flipX = !!v.flipX;
  if (v.zoom !== undefined) out.zoom = isNum(v.zoom) ? clamp(v.zoom, 0.5, 6) : 1;
  if (v.pan !== undefined) out.pan = Array.isArray(v.pan) && v.pan.length === 2 && v.pan.every(isNum) ? [clamp(v.pan[0], -1, 1), clamp(v.pan[1], -1, 1)] : [0, 0];
  // F2: camera is always a fresh object (never shares DEFAULT_CAMERA / the previous one); partial updates merge.
  out.camera = sanitizeCamera(v.camera, prev.camera);
  return out;
}

export const isMapId = (id) => typeof id === 'string' && id.length <= 140 && MAP_ID_RE.test(id);
export const isLevelId = (id) => typeof id === 'string' && ID_RE.test(id);
export const isTokenId = (id) => isSafeKey(id) && TOKEN_ID_RE.test(id);

/** Spawn point for a PC on a level (falls back to the map's default, then centre). */
export function spawnPoint(mapDef, level) {
  return mapDef?.spawn?.levels?.[level]?.pc || mapDef?.spawn?.pc || [0.5, 0.5];
}

/* ─── Room geometry + doors (AI BUILD placement, player-enter-room) ─── */

/** Bounding box { x0, y0, x1, y1 } of a shape. */
export function shapeBounds(s) {
  if (s.type === 'rect') return { x0: s.x, y0: s.y, x1: s.x + s.w, y1: s.y + s.h };
  let x0 = 1; let y0 = 1; let x1 = 0; let y1 = 0;
  for (const [x, y] of s.points) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1 };
}

/** Centroid [x, y] of a room's shape (area-weighted for polygons), or null for an unknown room. */
export function roomCentroid(mapDef, roomId) {
  const room = (mapDef?.rooms || []).find((r) => r.id === roomId);
  if (!room?.shape) return null;
  const s = room.shape;
  if (s.type === 'rect') return [s.x + s.w / 2, s.y + s.h / 2];
  const p = s.points;
  let a = 0; let cx = 0; let cy = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const f = p[j][0] * p[i][1] - p[i][0] * p[j][1];
    a += f; cx += (p[j][0] + p[i][0]) * f; cy += (p[j][1] + p[i][1]) * f;
  }
  if (Math.abs(a) < 1e-12) return [p.reduce((n, q) => n + q[0], 0) / p.length, p.reduce((n, q) => n + q[1], 0) / p.length];
  return [cx / (3 * a), cy / (3 * a)];
}

/** Doors leaving a room (either direction): [{ to, locked }] — one entry per neighbour,
 *  unlocked when ANY door between the two rooms is unlocked. */
export function doorsFrom(mapDef, roomId) {
  const out = new Map();
  for (const d of mapDef?.doors || []) {
    const to = d.from === roomId ? d.to : d.to === roomId ? d.from : null;
    if (!to || to === roomId) continue;
    const prev = out.get(to);
    out.set(to, { to, locked: prev ? prev.locked && !!d.locked : !!d.locked });
  }
  return [...out.values()];
}

/** True when a door joins rooms a and b (opts.unlocked: only through an unlocked door). */
export function isAdjacent(mapDef, a, b, { unlocked = false } = {}) {
  const d = doorsFrom(mapDef, a).find((x) => x.to === b);
  return !!d && (!unlocked || !d.locked);
}

/** Small deterministic PRNG (mulberry32) for placement jitter / template plans. */
export function seededRandom(seed = 1) {
  let s = (Number(seed) >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A point [x, y] inside `roomId` that hit-tests back to that room (roomAt on its level — a
 * smaller room nested inside never steals it), as far as possible from `avoid` points.
 * The centroid is preferred when nothing is in the way; `jitter` (fraction of the room's
 * size, default 0.08) nudges the result with `rand` (Math.random by default).
 * Returns null for an unknown room (or one with no hittable point).
 */
export function pointInRoom(mapDef, roomId, { avoid = [], rand = Math.random, jitter = 0.08, minGap = 0.025 } = {}) {
  const room = (mapDef?.rooms || []).find((r) => r.id === roomId);
  if (!room?.shape) return null;
  const level = room.level || null;
  const hits = (x, y) => roomAt(mapDef, x, y, level) === roomId;
  const { x0, y0, x1, y1 } = shapeBounds(room.shape);
  const w = x1 - x0; const h = y1 - y0;
  const c = roomCentroid(mapDef, roomId);
  const cands = [];
  if (c && hits(c[0], c[1])) cands.push(c);
  const N = 6;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = x0 + w * ((i + 0.5) / N); const y = y0 + h * ((j + 0.5) / N);
    if (hits(x, y)) cands.push([x, y]);
  }
  if (!cands.length) return null;
  const gap = (p) => (avoid.length ? Math.min(...avoid.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]))) : Infinity);
  let best = cands[0];
  if (gap(best) < Math.max(minGap, Math.min(w, h) * 0.3)) {
    let bestGap = -1;
    for (const p of cands) {
      // prefer far from the others, then close to the centre (so tokens do not hug the walls)
      const score = Math.min(gap(p), Math.max(w, h)) - (c ? Math.hypot(p[0] - c[0], p[1] - c[1]) * 0.25 : 0);
      if (score > bestGap) { bestGap = score; best = p; }
    }
  }
  for (let k = 0; k < 6; k++) {
    const x = best[0] + (rand() - 0.5) * 2 * jitter * w;
    const y = best[1] + (rand() - 0.5) * 2 * jitter * h;
    if (hits(x, y) && gap([x, y]) >= Math.min(gap(best), minGap)) return [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5];
  }
  return [Math.round(best[0] * 1e5) / 1e5, Math.round(best[1] * 1e5) / 1e5];
}
