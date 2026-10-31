/* ═══════════════════════════════════════════════════════════════
   GAME SESSIONS — in-memory store + Socket.io handlers + persistence.
   Universe-agnostic: tracks/conditions are supplied by the DM client
   from universe.rules when a character is assigned.

   Identity model
   - Player `id` is a STABLE id (survives reconnects); the current socket
     is `player.socketId`. Messages use `fromId`/`toId` = stable player id,
     or 'dm' for the game master and 'broadcast' for everyone.
   - The DM socket is `game.dmId` (null while dormant). The DM authenticates
     with `dmToken`, players with `playerToken`. Each game also has a
     6-digit `gmPin` (shown to the DM once) that lets another terminal
     TAKE OVER the GM seat: the takeover rotates `dmToken`.
   - A seat is never handed out by name alone: `rejoin-game { playerName }`
     without a valid token becomes a seat CLAIM the DM approves/rejects.
   - One socket holds one role in one game: any create/join/resume/rejoin/
     join-board for another game detaches it from the previous one first.
   - Every handler is registered through guard.safeOn (payload coercion,
     try/catch) — see docs/REVIEW_2026-10-30.md.
   ═══════════════════════════════════════════════════════════════ */
import { randomBytes, randomInt } from 'crypto';
import { loadSnapshots, scheduleSave, removeSnapshot, allowCode, MAX_AGE_MS } from './persistence.js';
import {
  emptyBoard, normalizeBoard, sanitizeMapDef, publicMapDef, sanitizeToken, placeToken, relocateAll, viewFor,
  sanitizeView, isMapId, isLevelId, isTokenId, isTokenVisible, spawnPoint, MAX_TOKENS, MAX_PINGS,
} from './board.js';
import { safeOn, EVENT_NAMES, RESERVED_IDS, isSafeKey, isPlainObject, nullObj, safeEqual } from './guard.js';
import { listUniverseIds, loadUniverseCore } from './generator/universes.js';
import { appendLog, logOf } from './sessionLog.js';
import {
  MAX_ROLLS, emptyInitiative, publicPools, publicInitiative, crewSupply, afterPlayerRoll, wireMechanics, clearPanicIfGone,
  sanitizeDetermination,
} from './mechanics.js';

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const GM = 'GM';
const HISTORY_LIMIT = 200;
const MESSAGE_CAP = 1000;
const SAVED_EMIT_MS = 1000;
const PING_INTERVAL_MS = 1000;
const MAX_TEXT = 4000;                 // GM / player message text cap (chars)
export const MAX_GAMES = Math.max(1, Number(process.env.MAX_GAMES) || 50); // live + dormant games per server
const MAX_PLAYERS = 40;
/* Dormant games nobody ever played in (no seats, no messages, at most one log line) expire after
   EMPTY_GAME_MS instead of MAX_AGE_MS, so test/sandbox sessions do not fill the MAX_GAMES cap. */
const EMPTY_GAME_MS = Math.max(100, Number(process.env.EMPTY_GAME_MS) || 60 * 60 * 1000);
const SWEEP_INTERVAL_MS = Math.max(100, Number(process.env.SWEEP_INTERVAL_MS) || 10 * 60 * 1000);
/** A game with no seats, no messages and at most one log entry. */
export const isEmptyGame = (g) => g.players.size === 0 && g.messages.length === 0 && (Array.isArray(g.log) ? g.log.length : 0) <= 1;
const SEAT_CLAIM_MS = Math.max(500, Number(process.env.SEAT_CLAIM_MS) || 2 * 60 * 1000);
const MAX_CLAIMS_PER_GAME = 10;
const PIN_MAX_FAILS = 5;               // wrong PINs per game before a lockout
const PIN_LOCK_MS = 60 * 1000;
const NAME_IN_USE = 'NAME IN USE — PICK ANOTHER OR ASK THE GM TO RESEAT YOU.';
const PC_COLORS = ['#4fc3f7', '#ffb74d', '#81c784', '#e57373', '#ba68c8', '#fff176', '#4db6ac', '#f06292'];

export const games = new Map();
export { EVENT_NAMES }; // every client → server event (guard.js)

const token = () => randomBytes(18).toString('base64url'); // 24 chars
const newPin = () => String(randomInt(0, 1000000)).padStart(6, '0');
const normName = (n) => String(n ?? '').trim().toLowerCase();

/* Message priorities per universe (terms.priorities), loaded once from the JSX-free
   universe cores; 'STANDARD' is always accepted. */
const PRIORITIES = new Map(); // universeId -> Set
try {
  for (const id of listUniverseIds()) {
    try {
      const core = await loadUniverseCore(id);
      const list = core?.terms?.priorities;
      if (Array.isArray(list)) PRIORITIES.set(id, new Set(list.filter((x) => typeof x === 'string')));
    } catch (err) { console.warn(`[SESSION] priorities for ${id} unavailable: ${err.message}`); }
  }
} catch { /* no universes dir: STANDARD only */ }
function priorityOf(game, p, fallback = 'STANDARD') {
  if (p === undefined || p === null || p === '') return fallback;
  if (typeof p === 'string' && (p === 'STANDARD' || PRIORITIES.get(game.universeId)?.has(p))) return p;
  return 'STANDARD';
}
/** Message text: string (or number), trimmed non-empty, capped at MAX_TEXT. null when invalid. */
const messageText = (t) => {
  if (typeof t !== 'string' && typeof t !== 'number') return null;
  const s = String(t).slice(0, MAX_TEXT);
  return s.trim() ? s : null;
};
/** Character ids currently held by seats (recomputed — never drifts). */
const assignedIdsOf = (game) => Array.from(new Set(Array.from(game.players.values()).map((p) => p.character?.id).filter(Boolean)));
const newPlayerId = () => 'p_' + randomBytes(6).toString('hex');

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (games.has(code));
  return code;
}

function createGame(dmSocketId, { universeId, packId } = {}) {
  const code = generateCode();
  allowCode(code);
  const now = Date.now();
  const game = {
    code,
    dmId: dmSocketId,
    universeId: typeof universeId === 'string' && ID_RE.test(universeId) ? universeId : 'alien',
    packId: typeof packId === 'string' && ID_RE.test(packId) ? packId : null,
    status: 'live',
    createdAt: now,
    updatedAt: now,
    dmToken: token(),
    gmPin: newPin(),
    players: new Map(),
    messages: [],
    board: emptyBoard(),
    mapDef: null,
    table: emptyTable(),
    log: [],
  };
  games.set(code, game);
  return game;
}

/** Board state lives on the game record (persisted with the snapshot); older snapshots get an empty board. */
function boardOf(game) {
  if (!game.board || typeof game.board !== 'object' || !game.board.tokens) game.board = emptyBoard();
  else normalizeBoard(game.board); // snapshot JSON → null-prototype id maps (no-op once converted)
  if (game.mapDef === undefined) game.mapDef = null;
  return game.board;
}

function getPlayerData(player) {
  return {
    id: player.id,
    name: player.name,
    character: player.character,
    tracks: player.tracks,
    trackMax: player.trackMax,
    statusEffects: player.statusEffects,
    inventory: player.inventory,
    alive: player.alive,
    conditions: player.conditions,
    connected: !!player.connected,
    supply: player.supply || {},
    injuries: player.injuries || [],
    panic: player.panic || null,
    determination: player.determination || null,
  };
}

function serializePlayers(game) {
  const result = {};
  for (const [id, p] of game.players) result[id] = getPlayerData(p);
  return result;
}

function numberMap(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj).slice(0, 50)) {
    if (!isSafeKey(k) || k.length > 40) continue;
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

function clampTrack(player, key, value) {
  const max = player.trackMax[key];
  const v = Math.max(0, Number(value) || 0);
  return Number.isFinite(max) ? Math.min(v, max) : v;
}

const msgId = () => Date.now() + '-' + Math.random().toString(36).slice(2, 6);

const isPlayerMessage = (m, player) =>
  m.toId === player.id || m.fromId === player.id || m.toId === 'broadcast';

function historyForPlayer(game, player) {
  return game.messages.filter((m) => isPlayerMessage(m, player)).slice(-HISTORY_LIMIT);
}

function historyForDM(game) {
  return game.messages.slice(-HISTORY_LIMIT).map((m) =>
    m.type === 'p2p' ? { ...m, dmNote: `[P2P] ${m.from} → ${m.to}` } : m);
}

/* ═══ SESSION FEATURES (table) — contract: ARCHITECTURE.md "Sessions" ═══
   game.table holds the run state (scene progress), narration / theatre
   mode, handouts with receipts, clues, progress clocks, safety tools,
   pause (anonymous X-card), act agenda orders, player-built character
   submissions and the roll buffer. Persisted with the snapshot.
   Each role gets a filtered view (tableView): the DM everything, the
   board public pieces only, each player what was sent to them. */
const CLOCK_KINDS = ['danger', 'racing', 'tug'];
const NARRATE_MODES = ['caption', 'card'];
const MAX_HANDOUTS = 200;
const MAX_CLUES = 300;
const MAX_CLOCKS = 30;
const MAX_SUBMISSIONS = 50;
const MAX_CLIENT_IDS = 400;
const MAX_CHARACTER_BYTES = 64 * 1024;
const MAX_ROLL_BYTES = 4096;
const PAUSE_INTERVAL_MS = 3000;
const ITEM_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_TAKES = 50;                  // token-take records kept for GM undo
const MAX_ROLL_REQUESTS = 30;          // roll-request records (open + answered)
const MAX_INVENTORY = 200;
const SKILL_RE = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;
const sstr = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const urlish = (v) => (typeof v === 'string' && v.length <= 500 && /^(\/|https?:\/\/)/.test(v) ? v : null);
const shortId = (prefix) => `${prefix}-${Date.now().toString(36)}${randomBytes(2).toString('hex')}`;
const isItemId = (v) => typeof v === 'string' && ITEM_RE.test(v) && !RESERVED_IDS.has(v);
const asId = (v, prefix) => (isItemId(v) ? v : shortId(prefix));

export function emptyTable() {
  return {
    run: { actIndex: 0, sceneIndex: 0, completed: {}, actTitle: '', sceneTitle: '' },
    narration: null,        // { id, text, title, mode, art, at }
    boardMode: 'map',       // 'map' | 'theatre'
    theatre: { title: '', subtitle: '', art: null },
    handouts: [],           // [{ id, title, from, to, priority, text, image, recipients:'all'|[ids], sentAt, seenBy[] }]
    clues: [],              // [{ id, text, source, scene, status:'hidden'|'revealed', revealedTo:'all'|[ids]|null, foundBy[], revealedAt, adhoc }]
    clocks: [],             // [{ id, label, segments, filled, kind, visibility }]
    safety: { enabled: false, tone: [], warnings: [], linesVeils: '', confirmed: [] },
    pause: null,            // { at } — never who
    orders: {},             // playerId -> [{ actIndex, actTitle, text, at }]
    submissions: [],        // [{ id, playerId, playerName, character, at, status:'pending'|'assigned'|'rejected', reason }]
    rolls: [],              // [{ id, playerId, playerName, characterName, roll, at, secret?, panic? }] (≤ 200)
    pools: {},              // { momentum: n, threat: n } (mechanics.js)
    poolDefs: {},           // { key: { label, max, visible, playerAdd } }
    initiative: emptyInitiative(), // { active, order[], turn, round }
    takes: [],              // [{ id, playerId, item, token, at, undone }] (<= 50) - token-take, GM undo
    rollRequests: [],       // [{ id, skill, label, difficulty, note, recipients:'all'|[ids], at, answeredBy[], cancelled }] (<= 30)
    clientIds: [],          // ids of replayed phone actions already applied (dedupe)
    seeded: false,          // pack clocks/clues seeded (session-seed) — never re-seeded after GM edits
  };
}

/** game.table, normalized (older snapshots have none or a partial one). */
function tableOf(game) {
  const base = emptyTable();
  const t = game.table && typeof game.table === 'object' ? game.table : {};
  for (const k of Object.keys(base)) {
    if (t[k] === undefined || (Array.isArray(base[k]) && !Array.isArray(t[k]))) t[k] = base[k];
  }
  if (!t.run || typeof t.run !== 'object') t.run = base.run;
  if (!t.run.completed || typeof t.run.completed !== 'object') t.run.completed = {};
  if (!t.safety || typeof t.safety !== 'object') t.safety = base.safety;
  if (!Array.isArray(t.safety.confirmed)) t.safety.confirmed = [];
  if (!t.theatre || typeof t.theatre !== 'object') t.theatre = base.theatre;
  if (!t.orders || typeof t.orders !== 'object') t.orders = {};
  for (const k of ['pools', 'poolDefs']) if (!t[k] || typeof t[k] !== 'object' || Array.isArray(t[k])) t[k] = {};
  if (!t.initiative || typeof t.initiative !== 'object' || !Array.isArray(t.initiative.order)) t.initiative = emptyInitiative();
  game.table = t;
  return t;
}

const pcName = (p) => p?.character?.name || p?.name || 'Unknown';
const sentTo = (recipients, playerId) => recipients === 'all' || (Array.isArray(recipients) && recipients.includes(playerId));

/** Recipient list: 'all' or an array of known player ids (null when empty/invalid). */
function recipientsOf(game, to) {
  if (to === 'all' || to === undefined || to === null) return 'all';
  const list = (Array.isArray(to) ? to : [to]).map(String).filter((id) => game.players.has(id));
  return list.length ? Array.from(new Set(list)) : null;
}
function mergeRecipients(a, b) {
  if (a === 'all' || b === 'all') return 'all';
  return Array.from(new Set([...(a || []), ...(b || [])]));
}
const recipientCount = (game, r) => (r === 'all' ? game.players.size : (r || []).length);

function sanitizeClock(input, prev) {
  if (!input || typeof input !== 'object') return null;
  const segRaw = Number(input.segments ?? prev?.segments ?? 4);
  const segments = Math.max(2, Math.min(12, Number.isFinite(segRaw) ? Math.round(segRaw) : 4));
  const filledRaw = Number(input.filled ?? prev?.filled ?? 0);
  const label = sstr(input.label ?? prev?.label, 80).trim();
  if (!label) return null;
  const note = sstr(input.note ?? prev?.note, 300);
  return {
    id: prev?.id || asId(input.id, 'clock'),
    label,
    segments,
    filled: Math.max(0, Math.min(segments, Number.isFinite(filledRaw) ? Math.round(filledRaw) : 0)),
    kind: CLOCK_KINDS.includes(input.kind) ? input.kind : (prev?.kind || 'danger'),
    visibility: input.visibility === 'gm' || input.visibility === 'all' ? input.visibility : (prev?.visibility || 'all'),
    ...(note ? { note } : {}),
  };
}

function sanitizeClue(input, prev) {
  if (!input || typeof input !== 'object') return null;
  const text = sstr(input.text ?? prev?.text, 1000).trim();
  if (!text) return null;
  return {
    id: prev?.id || asId(input.id, 'clue'),
    text,
    source: sstr(input.source ?? prev?.source, 200),
    scene: sstr(input.scene ?? prev?.scene, 120),
    status: prev?.status || 'hidden',
    revealedTo: prev?.revealedTo ?? null,
    foundBy: prev?.foundBy || [],
    revealedAt: prev?.revealedAt || null,
    adhoc: prev ? !!prev.adhoc : !!input.adhoc,
  };
}

function sanitizeHandout(input) {
  if (!input || typeof input !== 'object') return null;
  const text = sstr(input.text, 8000);
  const title = sstr(input.title, 160).trim();
  const image = urlish(input.image);
  if (!title || (!text.trim() && !image)) return null;
  return {
    title, text, image,
    from: sstr(input.from, 200), to: sstr(input.to, 200), priority: sstr(input.priority, 40),
  };
}

/** Role-filtered table view. role: 'dm' | 'board' | 'player' (+ the player record). */
function tableView(game, role, player = null) {
  const t = tableOf(game);
  const nameOf = (id) => pcName(game.players.get(id));
  const publicClocks = t.clocks.filter((c) => c.visibility !== 'gm');
  if (role === 'dm') {
    const { clientIds, ...rest } = t; // eslint-disable-line no-unused-vars
    return rest;
  }
  if (role === 'board') {
    return {
      narration: t.narration, boardMode: t.boardMode, theatre: t.theatre,
      clocks: publicClocks, pause: t.pause ? { at: t.pause.at } : null,
      pools: publicPools(t), initiative: publicInitiative(t), crew: crewSupply(game, pcName),
      ambient: t.run.ambient || null,
    };
  }
  const pid = player?.id;
  const sub = [...t.submissions].reverse().find((s) => s.playerId === pid);
  return {
    narration: t.narration,
    clocks: publicClocks,
    paused: !!t.pause,
    handouts: t.handouts
      .filter((h) => sentTo(h.recipients, pid))
      .map(({ recipients, seenBy, ...h }) => ({ ...h, seen: seenBy.includes(pid) })), // eslint-disable-line no-unused-vars
    clues: t.clues
      .filter((c) => c.status === 'revealed' && sentTo(c.revealedTo, pid))
      .map((c) => ({ id: c.id, text: c.text, source: c.source, revealedAt: c.revealedAt, foundBy: c.foundBy.map(nameOf) })),
    safety: t.safety.enabled
      ? { enabled: true, tone: t.safety.tone, warnings: t.safety.warnings, linesVeils: t.safety.linesVeils, confirmed: t.safety.confirmed.includes(pid) }
      : { enabled: false },
    orders: t.orders[pid] || [],
    pools: publicPools(t),
    initiative: publicInitiative(t, pid),
    submission: sub ? { id: sub.id, status: sub.status, reason: sub.reason || '', at: sub.at, name: sub.character?.name || '' } : null,
    rollRequests: t.rollRequests.filter((r) => isOpenRequestFor(r, pid)).map(publicRollRequest),
  };
}

/** Roll request as a phone sees it (no recipient list / receipts). */
const publicRollRequest = (r) => ({ id: r.id, skill: r.skill, label: r.label, difficulty: r.difficulty, note: r.note, at: r.at });
/** Open (not cancelled), addressed to this player and not yet answered by them. */
const isOpenRequestFor = (r, pid) => !!pid && !r.cancelled && sentTo(r.recipients, pid) && !r.answeredBy.includes(pid);

/** Multiset difference: entries of `next` that are not in `prev`. */
function addedItems(prev, next) {
  const counts = new Map();
  for (const i of prev || []) counts.set(i, (counts.get(i) || 0) + 1);
  const added = [];
  for (const i of next || []) {
    const n = counts.get(i) || 0;
    if (n > 0) counts.set(i, n - 1); else added.push(i);
  }
  return added;
}

/** Wire all session socket handlers onto a Socket.io server. */
export function attachSessions(io) {
  /* ─── Load dormant games from disk ──────────────── */
  for (const g of loadSnapshots()) games.set(g.code, g);
  if (games.size) console.log(`[SESSION] Loaded ${games.size} dormant game(s) from disk`);

  /* Expire dormant games nobody came back for (MAX_AGE_MS), and empty dormant ones sooner (EMPTY_GAME_MS).
     Runs at start (snapshots loaded from disk) and every SWEEP_INTERVAL_MS. */
  function sweepOnce() {
    const now = Date.now();
    for (const [code, g] of games) {
      if (g.status !== 'dormant' || g.dmId) continue;
      const idle = now - g.updatedAt;
      if (idle > MAX_AGE_MS || (idle > EMPTY_GAME_MS && isEmptyGame(g))) {
        games.delete(code);
        removeSnapshot(code);
        lastSavedEmit.delete(code);
        pinFails.delete(code);
        for (const c of [...claims.values()]) if (c.code === code) closeClaim(c, { approved: false, error: 'SESSION EXPIRED.' });
        console.log(`[SESSION] Game ${code} expired (${idle > MAX_AGE_MS ? 'dormant too long' : 'empty'})`);
      }
    }
  }
  const sweep = setInterval(sweepOnce, SWEEP_INTERVAL_MS);
  sweep.unref?.();

  const lastSavedEmit = new Map();
  function onSaved(game, savedAt) {
    if (!game.dmId) return;
    if (savedAt - (lastSavedEmit.get(game.code) || 0) < SAVED_EMIT_MS) return;
    lastSavedEmit.set(game.code, savedAt);
    io.to(game.dmId).emit('game-saved', { code: game.code, savedAt });
  }

  /** Mark a mutation: bump updatedAt and queue a snapshot. */
  function touch(game) {
    game.updatedAt = Date.now();
    scheduleSave(game, onSaved);
  }

  const toDM = (game, event, payload) => { if (game.dmId) io.to(game.dmId).emit(event, payload); };
  const toPlayer = (player, event, payload) => { if (player.socketId) io.to(player.socketId).emit(event, payload); };

  function broadcastPlayerList(game) {
    const playerList = [];
    for (const [id, p] of game.players) {
      playerList.push({ id, name: p.name, characterName: p.character?.name || null, connected: !!p.connected });
    }
    for (const [, p] of game.players) toPlayer(p, 'player-list', { players: playerList });
  }

  function pushMessage(game, message) {
    game.messages.push(message);
    if (game.messages.length > MESSAGE_CAP) game.messages.splice(0, game.messages.length - MESSAGE_CAP);
  }

  function attachPlayerSocket(socket, game, player) {
    player.socketId = socket.id;
    player.connected = true;
    socket.join(game.code);
    socket.data = { code: game.code, role: 'player', playerId: player.id };
  }

  function attachDMSocket(socket, game) {
    const previous = game.dmId;
    if (previous && previous !== socket.id) {
      io.to(previous).emit('session-taken', { code: game.code });
      const old = io.sockets.sockets.get(previous);
      if (old) { old.data = {}; old.leave(game.code); }
    }
    game.dmId = socket.id;
    game.status = 'live';
    socket.join(game.code);
    socket.data = { code: game.code, role: 'dm' };
  }

  const dmOf = (socket, code) => {
    const game = games.get(code);
    return game && game.dmId === socket.id ? game : null;
  };

  /* ─── Table board helpers ─────────────────────────── */
  const boardRoom = (code) => `${code}:board`;
  const boardCount = (code) => io.sockets.adapter.rooms.get(boardRoom(code))?.size || 0;
  const lastPing = new Map(); // socket.id -> ms
  /** DM-authorized game for a board event ({ gameCode } or the socket's own session). */
  const dmBoardGame = (socket, payload) => dmOf(socket, String(payload?.gameCode || socket.data?.code || '').toUpperCase());

  function boardPayload(game, role, withMap) {
    const board = viewFor(boardOf(game), role);
    if (!withMap) return { board };
    return { board, mapDef: role === 'dm' ? game.mapDef : publicMapDef(game.mapDef) };
  }

  /** Push board state to everyone attached: DM full, board + players filtered (computed once). */
  function emitBoard(game, { withMap = false } = {}) {
    if (game.dmId) io.to(game.dmId).emit('board-state', boardPayload(game, 'dm', withMap));
    const pub = boardPayload(game, 'board', withMap);
    io.to(boardRoom(game.code)).emit('board-state', pub);
    for (const [, p] of game.players) toPlayer(p, 'board-state', pub);
  }

  function sendBoardTo(socket, game, role) {
    socket.emit('board-state', boardPayload(game, role, true));
  }

  const notifyBoardLinked = (game) => toDM(game, 'board-linked', { count: boardCount(game.code) });

  function playerColor(game, playerId) {
    const ids = Array.from(game.players.keys());
    const i = ids.indexOf(playerId);
    return PC_COLORS[(i < 0 ? 0 : i) % PC_COLORS.length];
  }

  function tokenCtx(game) {
    const b = boardOf(game);
    return {
      playerIds: new Set(game.players.keys()),
      levels: new Set((game.mapDef?.levels || []).map((l) => l.id)),
      defaultLevel: b.level,
    };
  }

  /* ─── Session-feature (table) helpers ───────────── */
  const lastPause = new Map(); // socket.id -> ms (X-card spam guard)
  function rememberClientId(t, id) {
    t.clientIds.push(id);
    if (t.clientIds.length > MAX_CLIENT_IDS) t.clientIds.splice(0, t.clientIds.length - MAX_CLIENT_IDS);
  }
  /** Push `table-state { table }` (role-filtered). opts.dmOnly → DM only; opts.only → that player only. */
  function emitTable(game, { dmOnly = false, only = null } = {}) {
    if (only) { toPlayer(only, 'table-state', { table: tableView(game, 'player', only) }); return; }
    if (game.dmId) io.to(game.dmId).emit('table-state', { table: tableView(game, 'dm') });
    if (dmOnly) return;
    io.to(boardRoom(game.code)).emit('table-state', { table: tableView(game, 'board') });
    for (const [, p] of game.players) toPlayer(p, 'table-state', { table: tableView(game, 'player', p) });
  }
  /** Append to the session log and stream the entry to the DM. */
  const logTo = (game, type, text, extra) => {
    const e = appendLog(game, type, text, extra);
    if (e) toDM(game, 'log-entry', { entry: e });
    return e;
  };


  /* ─── Seats: token rejoin + GM-approved claims ─────────── */
  const seatPayload = (game, player) => ({
    success: true, playerId: player.id, playerToken: player.playerToken,
    universeId: game.universeId, packId: game.packId,
    player: getPlayerData(player), messages: historyForPlayer(game, player),
    dmConnected: !!game.dmId, table: tableView(game, 'player', player),
  });
  /** Put `socket` in `player`'s seat (retiring the previous device) and tell everyone. */
  function seatPlayer(socket, game, player) {
    if (player.socketId && player.socketId !== socket.id) {
      const old = io.sockets.sockets.get(player.socketId);
      if (old) { old.data = {}; old.leave(game.code); old.emit('session-taken', { code: game.code }); }
    }
    attachPlayerSocket(socket, game, player);
    touch(game);
    toDM(game, 'player-joined', { player: getPlayerData(player), players: serializePlayers(game), rejoined: true });
    broadcastPlayerList(game);
    sendBoardTo(socket, game, 'player');
  }

  const claims = new Map(); // claimId -> { claimId, code, playerId, name, socketId, at, timer }
  const claimPublic = (c) => {
    const seat = games.get(c.code)?.players.get(c.playerId);
    return { claimId: c.claimId, name: c.name, playerId: c.playerId, at: c.at, seatConnected: !!seat?.connected, expiresAt: c.at + SEAT_CLAIM_MS };
  };
  /** Close a claim; `result` (if any) goes to the claimant as `seat-claim-result`. */
  function closeClaim(claim, result) {
    clearTimeout(claim.timer);
    claims.delete(claim.claimId);
    const game = games.get(claim.code);
    if (game) toDM(game, 'seat-claim-closed', { claimId: claim.claimId });
    if (result) io.to(claim.socketId).emit('seat-claim-result', { claimId: claim.claimId, ...result });
  }
  function cancelClaimsOf(socketId) {
    for (const c of [...claims.values()]) if (c.socketId === socketId) closeClaim(c, null);
  }
  function sendClaimsToDM(game) {
    for (const c of claims.values()) if (c.code === game.code) toDM(game, 'seat-claim', claimPublic(c));
  }

  /* ─── GM PIN (takeover / list-resumable): 5 wrong PINs lock the game's PIN for a minute ─── */
  const pinFails = new Map(); // code -> { count, until }
  function checkPin(game, pin) {
    const now = Date.now();
    const f = pinFails.get(game.code) || { count: 0, until: 0 };
    if (f.until > now) return 'locked';
    if ((typeof pin === 'string' || typeof pin === 'number') && safeEqual(String(pin).trim(), game.gmPin)) {
      pinFails.delete(game.code);
      return 'ok';
    }
    f.count += 1;
    if (f.count >= PIN_MAX_FAILS) { f.count = 0; f.until = now + PIN_LOCK_MS; }
    pinFails.set(game.code, f);
    return 'bad';
  }

  /* ─── One socket, one role, one game ───────────────────── */
  /** Detach `socket` from whatever it holds: DM → game dormant, player → seat disconnected, board → left. */
  function detachSocket(socket, why = 'switched') {
    cancelClaimsOf(socket.id);
    const { code, role, playerId } = socket.data || {};
    socket.data = {};
    const game = code ? games.get(code) : null;
    if (!game) return;
    if (role === 'board') {
      socket.leave(boardRoom(code));
      console.log(`[BOARD] Board client left game ${game.code} (${why})`);
      notifyBoardLinked(game);
      return;
    }
    socket.leave(code);
    if (role === 'player') {
      const player = game.players.get(playerId);
      if (!player || player.socketId !== socket.id) return; // already re-attached elsewhere
      player.connected = false;
      player.socketId = null;
      touch(game);
      console.log(`[SESSION] Player "${player.name}" went dormant in game ${game.code} (${why})`);
      toDM(game, 'player-left', { playerId: player.id, playerName: player.name, dormant: true, players: serializePlayers(game) });
      broadcastPlayerList(game);
    } else if (role === 'dm') {
      if (game.dmId !== socket.id) return;
      game.dmId = null;
      game.status = 'dormant';
      touch(game);
      console.log(`[SESSION] DM left game ${game.code} — game is dormant (${why})`);
      for (const [, p] of game.players) toPlayer(p, 'dm-disconnected', { code: game.code });
    }
  }
  /** Before taking `role` in game `code`: leave any other game/role this socket holds. */
  function detachIfMoving(socket, code, role, playerId = null) {
    const d = socket.data || {};
    if (d.code === code && d.role === role && (role !== 'player' || d.playerId === playerId)) return;
    detachSocket(socket);
  }

  sweepOnce(); // snapshots loaded above (claims/pinFails exist by now)

  let eventsChecked = false;
  io.on('connection', (socket) => {
    console.log(`[SESSION] Connection: ${socket.id}`);
    /** Every handler goes through guard.safeOn (payload → plain object, ack only if a function, try/catch). */
    const on = (event, handler) => safeOn(socket, event, handler);

    /* ─── DM: Create Game { universeId, packId? } → { code, universeId, packId, dmToken, gmPin } ───
       gmPin (6 digits) is shown to the DM once; it authorizes a TAKE OVER from another terminal. */
    on('create-game', (options, callback) => {
      if (games.size >= MAX_GAMES) sweepOnce(); // free expired/empty dormant slots first
      if (games.size >= MAX_GAMES) return callback?.({ error: `SERVER FULL — ${MAX_GAMES} GAMES ALREADY HOSTED. END AN OLD ONE FIRST.` });
      detachSocket(socket); // a socket holds one role in one game
      const game = createGame(socket.id, options);
      socket.join(game.code);
      socket.data = { code: game.code, role: 'dm' };
      touch(game);
      console.log(`[SESSION] Game ${game.code} created (${game.universeId}${game.packId ? ' / ' + game.packId : ''})`);
      callback?.({ code: game.code, universeId: game.universeId, packId: game.packId, dmToken: game.dmToken, gmPin: game.gmPin });
    });

    /* ─── DM: Resume { code, dmToken } | TAKE OVER { code, takeover: true, pin } ───
       Takeover needs the game's GM PIN; it rotates dmToken (the old one stops working), the previous
       DM socket gets `session-taken`, and the ack carries the NEW dmToken for this terminal. */
    on('resume-game', ({ code, dmToken, takeover, pin }, callback) => {
      const game = games.get(String(code || '').toUpperCase());
      if (!game) return callback?.({ error: 'GAME NOT FOUND.' });
      const tokenOk = safeEqual(dmToken, game.dmToken);
      let tookOver = false;
      if (!tokenOk) {
        if (takeover !== true) return callback?.({ error: 'NOT AUTHORIZED. ANOTHER TERMINAL HOLDS THIS SESSION.' });
        const res = checkPin(game, pin);
        if (res === 'locked') return callback?.({ error: 'TOO MANY WRONG PINS — WAIT A MINUTE.' });
        if (res !== 'ok') return callback?.({ error: 'WRONG GM PIN.' });
        game.dmToken = token(); // invalidate the old terminal's token
        tookOver = true;
      }

      detachIfMoving(socket, game.code, 'dm');
      attachDMSocket(socket, game);
      touch(game);
      console.log(`[SESSION] DM ${tookOver ? 'took over' : 'resumed'} game ${game.code}`);
      callback?.({
        success: true, code: game.code, universeId: game.universeId, packId: game.packId,
        dmToken: game.dmToken, gmPin: game.gmPin, takeover: tookOver,
        players: serializePlayers(game), messages: historyForDM(game),
        table: tableView(game, 'dm'), log: logOf(game),
      });
      for (const [, p] of game.players) toPlayer(p, 'dm-reconnected', { code: game.code });
      sendBoardTo(socket, game, 'dm');
      notifyBoardLinked(game);
      sendClaimsToDM(game);
    });

    /* ─── DM: End Game { code, dmToken } — every socket leaves the game's rooms, socket.data cleared ─── */
    on('end-game', ({ code, dmToken }, callback) => {
      const key = String(code || '').toUpperCase();
      const game = games.get(key);
      if (!game) return callback?.({ success: true });
      if (!safeEqual(dmToken, game.dmToken)) return callback?.({ error: 'NOT AUTHORIZED.' });
      const reason = { reason: 'The game master has ended the session.' };
      for (const [, p] of game.players) toPlayer(p, 'game-ended', reason);
      io.to(boardRoom(key)).emit('game-ended', reason);
      for (const c of [...claims.values()]) if (c.code === key) closeClaim(c, { approved: false, error: 'SESSION ENDED.' });
      for (const room of [key, boardRoom(key)]) {
        for (const id of [...(io.sockets.adapter.rooms.get(room) || [])]) {
          const s = io.sockets.sockets.get(id);
          if (s?.data?.code === key) s.data = {};
        }
        io.in(room).socketsLeave(room);
      }
      for (const [, p] of game.players) {
        const s = p.socketId ? io.sockets.sockets.get(p.socketId) : null;
        if (s?.data?.code === key) s.data = {};
      }
      if (socket.data?.code === key) socket.data = {};
      games.delete(key);
      removeSnapshot(key);
      lastSavedEmit.delete(key);
      pinFails.delete(key);
      console.log(`[SESSION] Game ${key} ended by DM`);
      callback?.({ success: true });
    });

    /* ─── List resumable { tokens: { CODE: dmToken }, code?, pin? } ───
       Only games the caller can prove it hosts (a valid dmToken, or code + GM PIN); otherwise []. */
    on('list-resumable', ({ tokens, code, pin }, callback) => {
      const held = isPlainObject(tokens) ? Object.entries(tokens).slice(0, MAX_GAMES * 2) : [];
      const codes = new Set();
      for (const [c, t] of held) {
        const g = games.get(String(c).toUpperCase());
        if (g && safeEqual(t, g.dmToken)) codes.add(g.code);
      }
      if (code && pin !== undefined) {
        const g = games.get(String(code).toUpperCase());
        if (g && checkPin(g, pin) === 'ok') codes.add(g.code);
      }
      const list = Array.from(codes, (c) => games.get(c))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((g) => ({
          code: g.code, universeId: g.universeId, packId: g.packId,
          players: g.players.size, updatedAt: g.updatedAt, status: g.status,
          dmConnected: !!g.dmId,
        }));
      callback?.(list);
    });

    /* ─── Player: Join Game { code, playerName } — always a NEW seat; a name already seated is refused ─── */
    on('join-game', ({ code, playerName }, callback) => {
      const game = games.get(String(code || '').toUpperCase());
      if (!game) return callback?.({ error: 'GAME NOT FOUND. CHECK YOUR ACCESS CODE.' });
      if (socket.data?.role === 'player' && socket.data.code === game.code) return callback?.({ error: 'ALREADY CONNECTED.' });

      const name = (typeof playerName === 'string' || typeof playerName === 'number' ? String(playerName).trim() : '').slice(0, 40) || 'Player';
      if (Array.from(game.players.values()).some((p) => normName(p.name) === normName(name))) {
        return callback?.({ error: NAME_IN_USE, code: 'NAME_IN_USE' });
      }
      if (game.players.size >= MAX_PLAYERS) return callback?.({ error: 'TABLE FULL.' });
      detachIfMoving(socket, game.code, 'player');
      const player = {
        id: newPlayerId(), playerToken: token(), socketId: null, connected: false,
        name, character: null, tracks: {}, trackMax: {}, statusEffects: [], inventory: [],
        alive: true, conditions: {}, supply: {}, injuries: [], panic: null,
      };
      game.players.set(player.id, player);
      attachPlayerSocket(socket, game, player);
      touch(game);

      console.log(`[SESSION] Player "${player.name}" joined game ${game.code}`);
      callback?.({
        success: true, playerId: player.id, playerToken: player.playerToken, rejoined: false,
        universeId: game.universeId, packId: game.packId,
        player: getPlayerData(player), messages: [],
        table: tableView(game, 'player', player), dmConnected: !!game.dmId,
      });

      toDM(game, 'player-joined', { player: getPlayerData(player), players: serializePlayers(game) });
      broadcastPlayerList(game);
      sendBoardTo(socket, game, 'player');
    });

    /* ─── Player: Rejoin { code, playerToken } (ack: seat) | { code, playerName } (ack: { pending, claimId }) ───
       Without a valid token the seat is only CLAIMED: the DM gets `seat-claim { claimId, name, playerId }`
       and answers `seat-claim-resolve`; the claimant gets `seat-claim-result` (approved → a rotated
       playerToken + the seat; the previous device gets `session-taken`). Unanswered claims fail after
       SEAT_CLAIM_MS (2 min). */
    on('rejoin-game', ({ code, playerToken, playerName }, callback) => {
      const game = games.get(String(code || '').toUpperCase());
      if (!game) return callback?.({ error: 'GAME NOT FOUND.' });

      const byToken = typeof playerToken === 'string' && playerToken
        ? Array.from(game.players.values()).find((p) => safeEqual(p.playerToken, playerToken))
        : null;
      if (byToken) {
        detachIfMoving(socket, game.code, 'player', byToken.id);
        seatPlayer(socket, game, byToken);
        console.log(`[SESSION] Player "${byToken.name}" rejoined game ${game.code}`);
        return callback?.(seatPayload(game, byToken));
      }
      const wanted = typeof playerName === 'string' ? normName(playerName) : '';
      const seat = wanted ? Array.from(game.players.values()).find((p) => normName(p.name) === wanted) : null;
      if (!seat) return callback?.({ error: 'GAME NOT FOUND. PLAYER RECORD UNKNOWN.' });
      if (seat.socketId === socket.id) return callback?.({ error: 'ALREADY CONNECTED.' });
      cancelClaimsOf(socket.id); // one pending claim per socket
      if ([...claims.values()].filter((c) => c.code === game.code).length >= MAX_CLAIMS_PER_GAME) {
        return callback?.({ error: 'TOO MANY PENDING REQUESTS — TRY AGAIN SHORTLY.' });
      }
      const claim = {
        claimId: 'sc_' + randomBytes(6).toString('hex'), code: game.code, playerId: seat.id, name: seat.name,
        socketId: socket.id, at: Date.now(), timer: null,
      };
      claim.timer = setTimeout(() => {
        if (claims.get(claim.claimId) === claim) closeClaim(claim, { approved: false, error: 'NO ANSWER FROM THE GM — JOIN UNDER A NEW NAME OR TRY AGAIN.' });
      }, SEAT_CLAIM_MS);
      claim.timer.unref?.();
      claims.set(claim.claimId, claim);
      console.log(`[SESSION] Seat claim for "${seat.name}" in game ${game.code} (${game.dmId ? 'asking DM' : 'DM offline — waiting'})`);
      toDM(game, 'seat-claim', claimPublic(claim));
      callback?.({ pending: true, claimId: claim.claimId, name: seat.name, dmConnected: !!game.dmId, expiresIn: SEAT_CLAIM_MS });
    });

    /* ─── DM: Answer a seat claim { claimId, approve } ─── */
    on('seat-claim-resolve', (payload, callback) => {
      const game = dmBoardGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const claim = claims.get(String(payload.claimId || ''));
      if (!claim || claim.code !== game.code) return callback?.({ error: 'Unknown request.' });
      const seat = game.players.get(claim.playerId);
      const claimant = io.sockets.sockets.get(claim.socketId);
      if (!payload.approve || !seat || !claimant) {
        closeClaim(claim, { approved: false, error: 'THE GM DECLINED — JOIN UNDER A NEW NAME.' });
        return callback?.({ success: true, approved: false, ...(payload.approve ? { error: 'CLAIMANT GONE.' } : {}) });
      }
      closeClaim(claim, null);
      seat.playerToken = token(); // the previous device's token stops working
      detachIfMoving(claimant, game.code, 'player', seat.id);
      seatPlayer(claimant, game, seat);
      logTo(game, 'character', `Seat "${seat.name}" handed to a new device (GM approved)`);
      claimant.emit('seat-claim-result', { claimId: claim.claimId, approved: true, ...seatPayload(game, seat) });
      console.log(`[SESSION] Seat "${seat.name}" reassigned in game ${game.code} (GM approved)`);
      callback?.({ success: true, approved: true, playerId: seat.id });
    });

    /* ─── DM: Assign Character { character, tracks, trackMax, conditions[] } (ack { success } | { error }) ───
       character: plain object ≤ 64 KB with a string id; gear (if present) an array — non-strings dropped. */
    on('assign-character', ({ gameCode, playerId, character, tracks, trackMax, conditions, determination }, callback) => {
      const game = dmOf(socket, gameCode);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const player = game.players.get(playerId);
      if (!player) return callback?.({ error: 'Unknown player.' });
      if (!isPlainObject(character) || typeof character.id !== 'string' || !character.id || character.id.length > 120 || RESERVED_IDS.has(character.id)) {
        return callback?.({ error: 'Invalid character.' });
      }
      if (character.gear !== undefined && !Array.isArray(character.gear)) return callback?.({ error: 'character.gear must be a list.' });
      let copy;
      try {
        const json = JSON.stringify(character);
        if (json.length > MAX_CHARACTER_BYTES) return callback?.({ error: 'Character too large.' });
        copy = JSON.parse(json); // detached plain copy
      } catch { return callback?.({ error: 'Character not serializable.' }); }
      copy.gear = (copy.gear || []).filter((g) => typeof g === 'string').map((g) => g.slice(0, 200)).slice(0, 200);
      if (typeof copy.name !== 'string') copy.name = String(copy.name ?? '').slice(0, 80) || 'Unnamed';

      player.character = copy;
      player.trackMax = numberMap(trackMax);
      player.tracks = {};
      for (const [k, v] of Object.entries(numberMap(tracks))) player.tracks[k] = clampTrack(player, k, v);
      player.inventory = [...copy.gear];
      player.alive = true;
      player.statusEffects = [];
      player.injuries = [];
      player.panic = null;
      // Per-character DETERMINATION (universe rules.determination, sent by the DM client): { value, max } or none.
      player.determination = sanitizeDetermination(determination);
      player.conditions = Object.fromEntries((Array.isArray(conditions) ? conditions : []).slice(0, 40)
        .map((c) => String(c).slice(0, 60)).filter(isSafeKey).map((c) => [c, false]));

      // A pending player-built submission from this seat (or for this character) is now resolved.
      for (const sub of tableOf(game).submissions) {
        if (sub.status === 'pending' && (sub.playerId === player.id || sub.character?.id === copy.id)) {
          sub.status = 'assigned';
          const owner = game.players.get(sub.playerId);
          if (owner) toPlayer(owner, 'submission-updated', { submission: { id: sub.id, status: sub.status, reason: '' } });
        }
      }
      logTo(game, 'character', `${copy.name} assigned to ${player.name}`);
      touch(game);
      emitTable(game);
      console.log(`[SESSION] Character "${copy.name}" assigned to "${player.name}"`);

      toPlayer(player, 'character-assigned', { player: getPlayerData(player) });
      toDM(game, 'players-updated', { players: serializePlayers(game) });
      broadcastPlayerList(game);
      callback?.({ success: true });
    });

    /* ─── DM: Update Player Status { playerId, updates: { tracks?, statusEffects?, inventory?, alive?, conditions? } } ─── */
    on('update-player', ({ gameCode, playerId, updates }, callback) => {
      const game = dmOf(socket, gameCode);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const player = game.players.get(playerId);
      if (!player) return callback?.({ error: 'Unknown player.' });
      if (!isPlainObject(updates)) return callback?.({ error: 'updates must be an object.' });
      const strList = (v) => v.slice(0, 200).map((x) => String(x ?? '').slice(0, 120));

      if (updates.tracks && typeof updates.tracks === 'object') {
        for (const [k, v] of Object.entries(numberMap(updates.tracks))) {
          const before = player.tracks[k];
          player.tracks[k] = clampTrack(player, k, v);
          if (before !== player.tracks[k]) logTo(game, 'track', `${pcName(player)} ${k.toUpperCase()} ${before ?? 0} → ${player.tracks[k]}`, { playerId: player.id, track: k });
        }
      }
      if (Array.isArray(updates.statusEffects)) {
        const next = strList(updates.statusEffects);
        for (const e of addedItems(player.statusEffects, next)) logTo(game, 'track', `${pcName(player)} is now ${e}`, { playerId: player.id });
        player.statusEffects = next;
        if (clearPanicIfGone(game, player, boardOf)) emitBoard(game);
      }
      if (Array.isArray(updates.inventory)) {
        const next = strList(updates.inventory);
        const added = addedItems(player.inventory, next);
        player.inventory = next;
        // Loot moment: phone toast + a flash on the PC's board token.
        for (const item of added) {
          toPlayer(player, 'item-received', { item, at: Date.now() });
          logTo(game, 'loot', `${pcName(player)} received ${item}`, { playerId: player.id });
        }
        const tok = added.length ? Object.values(boardOf(game).tokens).find((tk) => tk.kind === 'pc' && tk.ownerPlayerId === player.id) : null;
        if (tok) {
          io.to(boardRoom(game.code)).emit('board-flash', { tokenId: tok.id });
          toDM(game, 'board-flash', { tokenId: tok.id });
        }
      }
      if (updates.alive !== undefined) player.alive = !!updates.alive;
      if (isPlainObject(updates.conditions)) {
        const next = { ...player.conditions };
        for (const [k, v] of Object.entries(updates.conditions).slice(0, 40)) if (isSafeKey(k) && k.length <= 60) next[k] = !!v;
        player.conditions = next;
      }
      touch(game);

      toPlayer(player, 'status-updated', { player: getPlayerData(player) });
      toDM(game, 'players-updated', { players: serializePlayers(game) });
      callback?.({ success: true });
    });

    /* ─── DM: Send Secret Message to Player { playerId, text ≤ 4000, priority (universe terms.priorities | 'STANDARD') } ─── */
    on('send-message', ({ gameCode, playerId, text, priority }, callback) => {
      const game = dmOf(socket, gameCode);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const player = game.players.get(playerId);
      const body = messageText(text);
      if (!player || !body) return callback?.({ error: 'Invalid message.' });

      const message = {
        id: msgId(), type: 'gm', from: GM, fromId: 'dm',
        to: player.name, toId: player.id, text: body,
        priority: priorityOf(game, priority), timestamp: Date.now(), read: false,
      };
      pushMessage(game, message);
      touch(game);
      toPlayer(player, 'secret-message', { message });
      toDM(game, 'message-sent', { message });
      callback?.({ success: true, id: message.id });
    });

    /* ─── Player: Send Message to DM ───────────────── */
    /* { gameCode, text, clientId? } (ack { success, id, duplicate? }) — clientId makes replays from the phone's offline queue idempotent. */
    on('player-message', ({ gameCode, text, clientId }, callback) => {
      const game = games.get(gameCode);
      if (!game || socket.data?.code !== game.code || socket.data.role !== 'player') return callback?.({ error: 'NOT AUTHORIZED.' });
      const player = game.players.get(socket.data.playerId);
      const body = messageText(text);
      if (!player || !body) return callback?.({ error: 'Empty message.' });
      const t = tableOf(game);
      const cid = typeof clientId === 'string' ? clientId.slice(0, 64) : null;
      if (cid && t.clientIds.includes(cid)) return callback?.({ success: true, duplicate: true });

      const message = {
        id: msgId(), type: 'player', from: player.name, fromId: player.id,
        to: GM, toId: 'dm', text: body,
        priority: 'PLAYER', timestamp: Date.now(), read: false, ...(cid ? { clientId: cid } : {}),
      };
      if (cid) rememberClientId(t, cid);
      pushMessage(game, message);
      touch(game);
      toDM(game, 'player-message-received', { message });
      socket.emit('message-confirmed', { message });
      callback?.({ success: true, id: message.id });
    });

    /* ─── Player: Send Message to Another Player ───── */
    on('player-to-player', ({ gameCode: gc, targetId, text, clientId }, callback) => {
      const game = games.get(gc);
      if (!game || socket.data?.code !== game.code || socket.data.role !== 'player') return callback?.({ error: 'NOT AUTHORIZED.' });
      const sender = game.players.get(socket.data.playerId);
      const target = game.players.get(targetId);
      const body = messageText(text);
      if (!sender || !target || !body) return callback?.({ error: 'Invalid message.' });
      const t = tableOf(game);
      const cid = typeof clientId === 'string' ? clientId.slice(0, 64) : null;
      if (cid && t.clientIds.includes(cid)) return callback?.({ success: true, duplicate: true });
      if (cid) rememberClientId(t, cid);

      const message = {
        id: msgId(), type: 'p2p', from: sender.name, fromId: sender.id,
        to: target.name, toId: target.id, text: body,
        priority: 'ENCRYPTED', timestamp: Date.now(), read: false, ...(cid ? { clientId: cid } : {}),
      };
      pushMessage(game, message);
      touch(game);
      toPlayer(target, 'p2p-message', { message });
      socket.emit('p2p-confirmed', { message });
      // DM always sees all player-to-player messages
      toDM(game, 'player-message-received', { message: { ...message, dmNote: `[P2P] ${sender.name} → ${target.name}` } });
      callback?.({ success: true, id: message.id });
    });

    /* ─── DM: Kill Character ───────────────────────── */
    on('kill-character', ({ gameCode, playerId }, callback) => {
      const game = dmOf(socket, gameCode);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const player = game.players.get(playerId);
      if (!player) return callback?.({ error: 'Unknown player.' });

      player.alive = false;
      if ('health' in player.tracks) player.tracks.health = 0;
      logTo(game, 'kill', `${pcName(player)} (${player.name}) was killed`, { playerId: player.id });
      touch(game);

      toPlayer(player, 'character-died', { playerName: player.name, characterName: player.character?.name });
      toDM(game, 'players-updated', { players: serializePlayers(game) });
      callback?.({ success: true });
    });

    /* ─── DM: Get Assigned Character IDs (DM only; recomputed from the seats) ─── */
    on('get-assigned-characters', ({ gameCode }, callback) => {
      const game = dmOf(socket, gameCode);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.', ids: [] });
      callback?.({ ids: assignedIdsOf(game) });
    });

    /* ─── DM: Broadcast to All Players { text ≤ 4000, priority? } ─── */
    on('broadcast-message', ({ gameCode, text, priority }, callback) => {
      const game = dmOf(socket, gameCode);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const body = messageText(text);
      if (!body) return callback?.({ error: 'Empty message.' });

      const message = {
        id: msgId(), type: 'gm', from: GM, fromId: 'dm',
        to: 'ALL', toId: 'broadcast', text: body,
        priority: priorityOf(game, priority, 'BROADCAST'), timestamp: Date.now(), read: false,
      };
      pushMessage(game, message);
      touch(game);
      for (const [, p] of game.players) toPlayer(p, 'secret-message', { message });
      toDM(game, 'message-sent', { message });
      callback?.({ success: true, id: message.id });
    });

    /* ═══ TABLE BOARD (docs/BOARD_AND_BUILDER.md §2) ═══════════════════
       Board client: join-board { code } (no token; never receives sheets/messages).
       DM events take { gameCode?, ... } (defaults to the DM socket's game).
       Server -> clients: board-state { board, mapDef? } (filtered per role),
       board-ping { x, y, at, by, color }, board-linked { count } (DM only). */

    /* ─── Board: Join { code } → { success, code, universeId, packId, board, mapDef } ─── */
    on('join-board', ({ code }, callback) => {
      const game = games.get(String(code || '').toUpperCase());
      if (!game) return callback?.({ error: 'GAME NOT FOUND.' });
      detachIfMoving(socket, game.code, 'board');
      socket.join(boardRoom(game.code));
      socket.data = { code: game.code, role: 'board' };
      console.log(`[BOARD] Board client attached to game ${game.code}`);
      callback?.({ success: true, code: game.code, universeId: game.universeId, packId: game.packId, ...boardPayload(game, 'board', true), table: tableView(game, 'board') });
      notifyBoardLinked(game);
    });

    /* ─── Anyone attached: re-request board state → { board, mapDef, boardClients? } ─── */
    on('board-sync', (_payload, cb) => {
      const { code, role } = socket.data || {};
      const game = code ? games.get(code) : null;
      if (!game || !role) return cb?.({ error: 'NOT IN A GAME.' });
      if (role === 'dm' && game.dmId !== socket.id) return cb?.({ error: 'NOT AUTHORIZED.' });
      const payload = boardPayload(game, role === 'dm' ? 'dm' : 'board', true);
      if (role === 'dm') payload.boardClients = boardCount(game.code);
      cb?.(payload);
    });

    /* ─── DM: Set map { mapId, level?, mapDef } — same mapId keeps tokens (level switch / room edit) ─── */
    on('board-set-map', (payload, callback) => {
      const game = dmBoardGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      if (!isMapId(payload.mapId)) return callback?.({ error: 'Invalid mapId.' });
      const { mapDef, error } = sanitizeMapDef(payload.mapDef);
      if (error) return callback?.({ error });
      const b = boardOf(game);
      const levels = (mapDef.levels || []).map((l) => l.id);
      const level = isLevelId(payload.level) && levels.includes(payload.level) ? payload.level : (levels[0] || null);
      if (b.mapId !== payload.mapId) {
        // New map: keep PC tokens (moved to the spawn point), drop everything else.
        const pcs = Object.values(b.tokens).filter((t) => t.kind === 'pc');
        b.tokens = nullObj();
        b.rooms = nullObj();
        b.pings = [];
        const [sx, sy] = spawnPoint(mapDef, level);
        pcs.forEach((t, i) => {
          const off = (i - (pcs.length - 1) / 2) * 0.02;
          b.tokens[t.id] = { ...t, x: Math.min(1, Math.max(0, sx + off)), y: sy, level, roomId: null };
        });
      }
      b.mapId = payload.mapId;
      b.level = level;
      b.mapRev = (b.mapRev || 0) + 1;
      game.mapDef = mapDef;
      relocateAll(b, mapDef);
      touch(game);
      console.log(`[BOARD] ${game.code}: map ${b.mapId}${level ? ' @ ' + level : ''} (${mapDef.rooms.length} rooms)`);
      emitBoard(game, { withMap: true });
      callback?.({ success: true, mapRev: b.mapRev });
    });

    /* ─── DM: Create / update token { token } → { success, token } ─── */
    on('board-token-upsert', (payload, callback) => {
      const game = dmBoardGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const b = boardOf(game);
      const input = payload.token;
      const prev = input?.id && isTokenId(input.id) ? b.tokens[input.id] : null;
      if (!prev && Object.keys(b.tokens).length >= MAX_TOKENS) return callback?.({ error: 'TOO MANY TOKENS.' });
      const token = sanitizeToken(input, prev, tokenCtx(game));
      if (!token) return callback?.({ error: 'Invalid token.' });
      if (token.kind === 'pc' && token.ownerPlayerId && !token.color) token.color = playerColor(game, token.ownerPlayerId);
      // A PC token placed while its player is still panicking carries the panic ring (the ring is
      // normally set by panic-result, which found no token to mark if the PC was not on the map yet).
      if (!prev && token.kind === 'pc' && game.players.get(token.ownerPlayerId)?.panic) {
        const st = Array.isArray(token.status) ? token.status.filter((s) => !String(s).startsWith('panicking')) : [];
        token.status = ['panicking', ...st].slice(0, 6);
      }
      b.tokens[token.id] = token;
      placeToken(b, game.mapDef, token);
      touch(game);
      emitBoard(game);
      callback?.({ success: true, token });
    });

    /* ─── DM: Move token { id, x, y } (client throttles to 30 Hz) ─── */
    on('board-token-move', (payload) => {
      const game = dmBoardGame(socket, payload);
      if (!game) return;
      const b = boardOf(game);
      const t = isTokenId(payload.id) ? b.tokens[payload.id] : null;
      if (!t || !Number.isFinite(payload.x) || !Number.isFinite(payload.y)) return;
      t.x = Math.min(1, Math.max(0, payload.x));
      t.y = Math.min(1, Math.max(0, payload.y));
      placeToken(b, game.mapDef, t);
      touch(game);
      emitBoard(game);
    });

    /* ─── DM: Remove token { id } ─── */
    on('board-token-remove', (payload, callback) => {
      const game = dmBoardGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const b = boardOf(game);
      if (!isTokenId(payload.id) || !b.tokens[payload.id]) return callback?.({ error: 'Unknown token.' });
      delete b.tokens[payload.id];
      touch(game);
      emitBoard(game);
      callback?.({ success: true });
    });

    /* ─── DM: Room { roomId, revealed?, name?, note?, hideTokens? } ─── */
    on('board-room-set', (payload, callback) => {
      const game = dmBoardGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const b = boardOf(game);
      const room = (game.mapDef?.rooms || []).find((r) => r.id === payload.roomId);
      if (!room) return callback?.({ error: 'Unknown room.' });
      const st = b.rooms[room.id] || (b.rooms[room.id] = { revealed: false, entered: false });
      if (payload.revealed !== undefined) {
        if (!st.revealed && payload.revealed) logTo(game, 'fog', `Revealed: ${st.name || room.name || room.id}`, { roomId: room.id });
        st.revealed = !!payload.revealed;
      }
      if (typeof payload.name === 'string') st.name = payload.name.slice(0, 80);
      if (typeof payload.note === 'string') st.note = payload.note.slice(0, 1000);
      if (payload.hideTokens === true) {
        for (const t of Object.values(b.tokens)) if (t.roomId === room.id && t.kind !== 'pc') t.hidden = true;
      }
      touch(game);
      emitBoard(game);
      callback?.({ success: true });
    });

    /* ─── DM: Fog { fog } ─── */
    on('board-fog', (payload) => {
      const game = dmBoardGame(socket, payload);
      if (!game) return;
      boardOf(game).fog = !!payload.fog;
      touch(game);
      emitBoard(game);
    });

    /* ─── DM: TV orientation { view: { rotation, flipX, zoom, pan } } ─── */
    on('board-view', (payload) => {
      const game = dmBoardGame(socket, payload);
      if (!game) return;
      const b = boardOf(game);
      b.view = sanitizeView(payload.view, b.view);
      touch(game);
      emitBoard(game);
    });

    /* ─── DM / players: Ping { x, y } (max 1 per second per socket) ─── */
    on('board-ping', (payload, callback) => {
      const { code, role, playerId } = socket.data || {};
      const game = code ? games.get(code) : null;
      if (!game || (role !== 'dm' && role !== 'player')) return callback?.({ error: 'NOT AUTHORIZED.' });
      if (role === 'dm' && game.dmId !== socket.id) return callback?.({ error: 'NOT AUTHORIZED.' });
      if (!Number.isFinite(payload.x) || !Number.isFinite(payload.y)) return callback?.({ error: 'Invalid point.' });
      const now = Date.now();
      if (now - (lastPing.get(socket.id) || 0) < PING_INTERVAL_MS) return callback?.({ error: 'RATE LIMITED.' });
      lastPing.set(socket.id, now);
      const b = boardOf(game);
      const ping = {
        x: Math.min(1, Math.max(0, payload.x)), y: Math.min(1, Math.max(0, payload.y)), at: now,
        by: role === 'dm' ? 'dm' : playerId,
        color: role === 'dm' ? '#ffffff' : playerColor(game, playerId),
      };
      b.pings = [...(b.pings || []), ping].slice(-MAX_PINGS);
      if (game.dmId) io.to(game.dmId).emit('board-ping', ping);
      io.to(boardRoom(game.code)).emit('board-ping', ping);
      for (const [, p] of game.players) toPlayer(p, 'board-ping', ping);
      callback?.({ success: true });
    });

    /* ─── DM: Reset {} — clears tokens, room reveals and pings; fog back on (map + view kept) ─── */
    on('board-reset', (payload, callback) => {
      const game = dmBoardGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const b = boardOf(game);
      b.tokens = nullObj();
      b.rooms = nullObj();
      b.pings = [];
      b.fog = true;
      touch(game);
      emitBoard(game);
      callback?.({ success: true });
    });

    /* ═══ SESSION FEATURES (ARCHITECTURE.md "Sessions" → session features) ═══
       DM events take { gameCode?, ... } (defaults to the DM socket's game) and ack
       { success } | { error }. Every mutation re-sends `table-state { table }`
       (role-filtered) to the DM, the board and each player. */
    const dmTableGame = dmBoardGame;
    /** Player socket's own game + player record (or {}). */
    const playerCtx = () => {
      const { code, role, playerId } = socket.data || {};
      const game = code && role === 'player' ? games.get(code) : null;
      const player = game?.players.get(playerId);
      return game && player && player.socketId === socket.id ? { game, player } : {};
    };
    const done = (game, cb, extra = {}) => { touch(game); emitTable(game); cb?.({ success: true, ...extra }); };

    /* ─── Any attached role: { table, log? } (log for the DM only) ─── */
    on('table-sync', (_p, cb) => {
      const { code, role } = socket.data || {};
      const game = code ? games.get(code) : null;
      if (!game || !role) return cb?.({ error: 'NOT IN A GAME.' });
      if (role === 'dm') {
        if (game.dmId !== socket.id) return cb?.({ error: 'NOT AUTHORIZED.' });
        return cb?.({ table: tableView(game, 'dm'), log: logOf(game) });
      }
      if (role === 'board') return cb?.({ table: tableView(game, 'board') });
      const player = game.players.get(socket.data.playerId);
      return cb?.({ table: tableView(game, 'player', player) });
    });

    /* ─── DM: Seed pack clocks/clues { clocks[], clues[] } — idempotent by id ─── */
    on('session-seed', (payload, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      let added = 0;
      // Dedupe on the id as stored; entries without a valid pack id are skipped (never re-keyed randomly).
      for (const c of Array.isArray(payload.clocks) ? payload.clocks.slice(0, MAX_CLOCKS) : []) {
        if (!isPlainObject(c) || !isItemId(c.id) || t.clocks.some((x) => x.id === c.id) || t.clocks.length >= MAX_CLOCKS) continue;
        const clock = sanitizeClock(c);
        if (clock) { t.clocks.push(clock); added++; }
      }
      for (const c of Array.isArray(payload.clues) ? payload.clues.slice(0, MAX_CLUES) : []) {
        if (!isPlainObject(c) || !isItemId(c.id) || t.clues.some((x) => x.id === c.id) || t.clues.length >= MAX_CLUES) continue;
        const clue = sanitizeClue({ ...c, adhoc: false });
        if (!clue) continue;
        if (c.status === 'revealed') Object.assign(clue, { status: 'revealed', revealedTo: 'all', revealedAt: Date.now() });
        t.clues.push(clue);
        added++;
      }
      t.seeded = true;
      done(game, callback, { added });
    });

    /* ─── DM: Scene progress { actIndex, sceneIndex, completed?, actTitle?, sceneTitle? } ─── */
    on('run-set', (payload, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      const prev = { ...t.run };
      const a = Number(payload.actIndex);
      const s = Number(payload.sceneIndex);
      if (Number.isInteger(a) && a >= 0 && a < 100) t.run.actIndex = a;
      if (Number.isInteger(s) && s >= 0 && s < 500) t.run.sceneIndex = s;
      if (typeof payload.actTitle === 'string') t.run.actTitle = payload.actTitle.slice(0, 120);
      if (typeof payload.sceneTitle === 'string') t.run.sceneTitle = payload.sceneTitle.slice(0, 120);
      if (payload.ambient !== undefined) t.run.ambient = typeof payload.ambient === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/.test(payload.ambient) ? payload.ambient : null;
      if (payload.completed && typeof payload.completed === 'object') {
        const c = {};
        for (const [k, v] of Object.entries(payload.completed).slice(0, 1000)) if (/^\d+-\d+$/.test(k) && v) c[k] = true;
        for (const k of Object.keys(c)) if (!prev.completed[k]) logTo(game, 'scene', `Scene completed: ${t.run.sceneTitle && k === `${t.run.actIndex}-${t.run.sceneIndex}` ? t.run.sceneTitle : k}`, { key: k });
        t.run.completed = c;
      }
      if (prev.actIndex !== t.run.actIndex || prev.sceneIndex !== t.run.sceneIndex) {
        logTo(game, 'scene', `Scene: ${t.run.actTitle ? t.run.actTitle + ' — ' : ''}${t.run.sceneTitle || `#${t.run.sceneIndex + 1}`}`);
      }
      done(game, callback, { run: t.run });
    });

    /* ─── DM: Advance act { actIndex, actTitle?, agendas?: { playerId: text } } ───
       Pushes each assigned player's character.agendaByAct[actIndex+1] (or the override)
       as a private NEW ORDERS card (`new-orders`); stored in table.orders for re-opening. */
    on('advance-act', (payload, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      const a = Number(payload.actIndex);
      if (!Number.isInteger(a) || a < 0 || a >= 100) return callback?.({ error: 'Invalid actIndex.' });
      const actTitle = sstr(payload.actTitle, 120) || `ACT ${a + 1}`;
      t.run.actIndex = a;
      t.run.sceneIndex = 0;
      t.run.actTitle = actTitle;
      t.run.sceneTitle = sstr(payload.sceneTitle, 120);
      const overrides = payload.agendas && typeof payload.agendas === 'object' ? payload.agendas : {};
      const sent = [];
      const at = Date.now();
      for (const [, p] of game.players) {
        const text = sstr(overrides[p.id], 2000) || sstr(p.character?.agendaByAct?.[String(a + 1)], 2000);
        if (!text || !p.character) continue;
        const order = { actIndex: a, actTitle, text, at };
        t.orders[p.id] = [...(t.orders[p.id] || []).filter((o) => o.actIndex !== a), order];
        toPlayer(p, 'new-orders', order);
        sent.push(p.id);
      }
      logTo(game, 'act', `${actTitle} begins${sent.length ? ` — new orders to ${sent.length}` : ''}`, { actIndex: a });
      done(game, callback, { sent });
    });

    /* ─── DM: Narrate { text, title?, mode:'caption'|'card', art? } ─── */
    on('narrate', (payload, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const text = sstr(payload.text, 4000).trim();
      const art = urlish(payload.art);
      if (!text && !art) return callback?.({ error: 'Nothing to narrate.' });
      const t = tableOf(game);
      t.narration = {
        id: shortId('n'), text, title: sstr(payload.title, 160), at: Date.now(),
        mode: NARRATE_MODES.includes(payload.mode) ? payload.mode : 'caption', art,
      };
      logTo(game, 'narration', `${t.narration.title ? t.narration.title + ': ' : ''}${text || '[image]'}`.slice(0, 400));
      done(game, callback, { id: t.narration.id });
    });

    /* ─── DM: Clear narration {} ─── */
    on('narrate-clear', (payload, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      tableOf(game).narration = null;
      done(game, callback);
    });

    /* ─── DM: Board mode { mode:'map'|'theatre', title?, subtitle?, art? } (persists) ─── */
    on('board-mode', (payload, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      if (payload.mode === 'map' || payload.mode === 'theatre') t.boardMode = payload.mode;
      if (payload.title !== undefined || payload.subtitle !== undefined || payload.art !== undefined) {
        t.theatre = {
          title: payload.title !== undefined ? sstr(payload.title, 160) : t.theatre.title,
          subtitle: payload.subtitle !== undefined ? sstr(payload.subtitle, 160) : t.theatre.subtitle,
          art: payload.art !== undefined ? urlish(payload.art) : t.theatre.art,
        };
      }
      done(game, callback, { boardMode: t.boardMode });
    });

    /* ─── DM: Send handout { handoutId?, handout?|custom?: {title,from,to,priority,text,image?}, to:'all'|[playerIds] } ───
       Bundled packs live client-side, so the DM sends the resolved handout with its pack id.
       Re-sending the same id widens the recipients and keeps receipts. */
    on('handout-send', (payload, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      const content = sanitizeHandout(payload.handout || payload.custom);
      const id = typeof payload.handoutId === 'string' && ITEM_RE.test(payload.handoutId) ? payload.handoutId : null;
      const prev = id ? t.handouts.find((h) => h.id === id) : null;
      if (!content && !prev) return callback?.({ error: 'Handout needs a title and text.' });
      const recipients = recipientsOf(game, payload.to);
      if (!recipients) return callback?.({ error: 'No recipients.' });
      let h;
      if (prev) {
        Object.assign(prev, content || {}, { recipients: mergeRecipients(prev.recipients, recipients), sentAt: Date.now() });
        h = prev;
      } else {
        if (t.handouts.length >= MAX_HANDOUTS) t.handouts.shift();
        h = { id: id || shortId('h'), ...content, recipients, sentAt: Date.now(), seenBy: [], custom: !id };
        t.handouts.push(h);
      }
      const { recipients: _r, seenBy: _s, ...pub } = h; // eslint-disable-line no-unused-vars
      for (const [, p] of game.players) if (sentTo(recipients, p.id)) toPlayer(p, 'handout-received', { handout: { ...pub, seen: h.seenBy.includes(p.id) } });
      logTo(game, 'handout', `Handout "${h.title}" → ${recipients === 'all' ? 'everyone' : recipients.map((x) => pcName(game.players.get(x))).join(', ')}`, { handoutId: h.id });
      done(game, callback, { id: h.id });
    });

    /* ─── Player: Handout opened { handoutId } → DM sees receipts ─── */
    on('handout-seen', (payload, callback) => {
      const { game, player } = playerCtx();
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const h = tableOf(game).handouts.find((x) => x.id === payload.handoutId);
      if (!h || !sentTo(h.recipients, player.id)) return callback?.({ error: 'Unknown handout.' });
      if (!h.seenBy.includes(player.id)) {
        h.seenBy.push(player.id);
        touch(game);
        toDM(game, 'handout-seen', { handoutId: h.id, playerId: player.id, seen: h.seenBy.length, of: recipientCount(game, h.recipients) });
        emitTable(game, { dmOnly: true });
      }
      callback?.({ success: true });
    });

    /* ─── DM: Create/update a clue { clue: { id?, text, source?, scene? } } (ad-hoc when no pack id) ─── */
    on('clue-upsert', (payload, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      const prev = t.clues.find((c) => c.id === payload.clue?.id);
      if (!prev && t.clues.length >= MAX_CLUES) return callback?.({ error: 'TOO MANY CLUES.' });
      const clue = sanitizeClue({ adhoc: !payload.clue?.id, ...payload.clue }, prev);
      if (!clue) return callback?.({ error: 'Clue needs text.' });
      if (prev) Object.assign(prev, clue); else t.clues.push(clue);
      done(game, callback, { id: clue.id });
    });

    /* ─── DM: Reveal a clue { clueId, clue?, to:'all'|[playerIds], foundBy?:[playerIds] } ─── */
    on('clue-reveal', (payload, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      let clue = t.clues.find((c) => c.id === payload.clueId);
      if (!clue && payload.clue) {
        clue = sanitizeClue({ ...payload.clue, id: payload.clueId || payload.clue.id });
        if (!clue) return callback?.({ error: 'Clue needs text.' });
        if (t.clues.length >= MAX_CLUES) return callback?.({ error: 'TOO MANY CLUES.' });
        t.clues.push(clue);
      }
      if (!clue) return callback?.({ error: 'Unknown clue.' });
      const recipients = recipientsOf(game, payload.to);
      if (!recipients) return callback?.({ error: 'No recipients.' });
      const finders = recipientsOf(game, payload.foundBy);
      const credit = Array.isArray(finders) ? finders : (Array.isArray(recipients) ? recipients : []);
      clue.status = 'revealed';
      clue.revealedTo = mergeRecipients(clue.revealedTo === null ? [] : clue.revealedTo, recipients);
      clue.foundBy = Array.from(new Set([...clue.foundBy, ...credit]));
      clue.revealedAt = clue.revealedAt || Date.now();
      const nameOf = (id) => pcName(game.players.get(id));
      for (const [, p] of game.players) {
        if (sentTo(recipients, p.id)) toPlayer(p, 'clue-revealed', { clue: { id: clue.id, text: clue.text, source: clue.source, revealedAt: clue.revealedAt, foundBy: clue.foundBy.map(nameOf) } });
      }
      logTo(game, 'clue', `Clue revealed: ${clue.text.slice(0, 160)}${credit.length ? ` (found by ${credit.map(nameOf).join(', ')})` : ''} → ${recipients === 'all' ? 'everyone' : recipients.map(nameOf).join(', ')}`, { clueId: clue.id });
      done(game, callback, { id: clue.id });
    });

    /* ─── DM: Hide a clue again { clueId } (players lose it from their list) ─── */
    on('clue-hide', (payload, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const clue = tableOf(game).clues.find((c) => c.id === payload.clueId);
      if (!clue) return callback?.({ error: 'Unknown clue.' });
      Object.assign(clue, { status: 'hidden', revealedTo: null, foundBy: [], revealedAt: null });
      done(game, callback);
    });

    /* ─── DM: Create/update a clock { clock: { id?, label, segments, filled?, kind, visibility } } ─── */
    on('clock-upsert', (payload, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      const prev = t.clocks.find((c) => c.id === payload.clock?.id);
      if (!prev && t.clocks.length >= MAX_CLOCKS) return callback?.({ error: 'TOO MANY CLOCKS.' });
      const clock = sanitizeClock(payload.clock, prev);
      if (!clock) return callback?.({ error: 'Clock needs a label.' });
      if (prev) Object.assign(prev, clock); else { t.clocks.push(clock); logTo(game, 'clock', `Clock started: ${clock.label} (${clock.segments})`, { clockId: clock.id }); }
      done(game, callback, { id: clock.id, clock });
    });

    /* ─── DM: Tick a clock { id, delta: ±n } → `clock-ticked { clock, delta }` to everyone who can see it ─── */
    on('clock-tick', (payload, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const clock = tableOf(game).clocks.find((c) => c.id === payload.id);
      const delta = Math.round(Number(payload.delta) || 0);
      if (!clock) return callback?.({ error: 'Unknown clock.' });
      const before = clock.filled;
      clock.filled = Math.max(0, Math.min(clock.segments, clock.filled + delta));
      const applied = clock.filled - before;
      if (applied) {
        const full = clock.filled === clock.segments;
        logTo(game, 'clock', `${clock.label}: ${before} → ${clock.filled}/${clock.segments}${full ? ' — FULL' : ''}`, { clockId: clock.id });
        if (clock.visibility !== 'gm') {
          const evt = { clock, delta: applied };
          for (const [, p] of game.players) toPlayer(p, 'clock-ticked', evt);
          io.to(boardRoom(game.code)).emit('clock-ticked', evt);
        }
      }
      done(game, callback, { clock });
    });

    /* ─── DM: Remove a clock { id } ─── */
    on('clock-remove', (payload, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      const before = t.clocks.length;
      t.clocks = t.clocks.filter((c) => c.id !== payload.id);
      if (t.clocks.length === before) return callback?.({ error: 'Unknown clock.' });
      done(game, callback);
    });

    /* ─── DM: Session zero { enabled, tone[], warnings[], linesVeils } (re-arms the player card when changed) ─── */
    on('safety-set', (payload, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      const list = (v, n, m) => (Array.isArray(v) ? v : []).map((x) => sstr(String(x ?? ''), m).trim()).filter(Boolean).slice(0, n);
      const next = {
        enabled: payload.enabled !== false,
        tone: list(payload.tone, 12, 60),
        warnings: list(payload.warnings, 40, 120),
        linesVeils: sstr(payload.linesVeils, 3000),
      };
      const changed = JSON.stringify(next) !== JSON.stringify({ enabled: t.safety.enabled, tone: t.safety.tone, warnings: t.safety.warnings, linesVeils: t.safety.linesVeils });
      t.safety = { ...next, confirmed: changed ? [] : t.safety.confirmed };
      if (changed && next.enabled) logTo(game, 'safety', `Session zero: ${next.warnings.length} content warning(s)${next.linesVeils ? ', lines & veils set' : ''}`);
      done(game, callback);
    });

    /* ─── Player: Confirm the BEFORE WE BEGIN card {} ─── */
    on('safety-confirm', (_p, cb) => {
      const { game, player } = playerCtx();
      if (!game) return cb?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      if (!t.safety.confirmed.includes(player.id)) t.safety.confirmed.push(player.id);
      touch(game);
      emitTable(game, { only: player });
      emitTable(game, { dmOnly: true });
      cb?.({ success: true });
    });

    /* ─── Player: Anonymous PAUSE / X-card {} → DM `pause-requested { at }` (no identity anywhere) ─── */
    on('pause-request', (_p, cb) => {
      const { game } = playerCtx();
      if (!game) return cb?.({ error: 'NOT AUTHORIZED.' });
      const now = Date.now();
      if (now - (lastPause.get(socket.id) || 0) < PAUSE_INTERVAL_MS) return cb?.({ success: true, throttled: true });
      lastPause.set(socket.id, now);
      const t = tableOf(game);
      const already = !!t.pause;
      t.pause = { at: t.pause?.at || now };
      if (!already) logTo(game, 'pause', 'Pause requested (anonymous)');
      toDM(game, 'pause-requested', { at: t.pause.at });
      done(game, cb);
    });

    /* ─── DM: Clear the pause {} ─── */
    on('pause-clear', (payload, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      if (t.pause) logTo(game, 'pause', 'Play resumed');
      t.pause = null;
      done(game, callback);
    });

    /* ─── DM: Log note { text } → `log-entry { entry }` ─── */
    on('log-note', (payload, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const e = logTo(game, 'note', sstr(payload.text, 2000));
      if (!e) return callback?.({ error: 'Empty note.' });
      touch(game);
      callback?.({ success: true, entry: e });
    });

    /* ─── Player: Submit a player-built character { character } — any seat, any time (first character,
       or a replacement after a death / by choice; the GM assigns it with assign-character) ─── */
    on('character-submit', (payload, callback) => {
      const { game, player } = playerCtx();
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const ch = payload.character;
      if (!ch || typeof ch !== 'object' || Array.isArray(ch) || typeof ch.name !== 'string' || !ch.name.trim()) return callback?.({ error: 'Character needs a name.' });
      let bytes = 0;
      try { bytes = JSON.stringify(ch).length; } catch { return callback?.({ error: 'Character not serializable.' }); }
      if (bytes > MAX_CHARACTER_BYTES) return callback?.({ error: 'Character too large.' });
      const t = tableOf(game);
      const character = { ...ch, id: typeof ch.id === 'string' && ID_RE.test(ch.id) ? ch.id : `pb-${randomBytes(4).toString('hex')}` };
      // One pending submission per player: a new one replaces the old.
      t.submissions = t.submissions.filter((s) => !(s.playerId === player.id && s.status === 'pending'));
      const sub = { id: shortId('sub'), playerId: player.id, playerName: player.name, character, at: Date.now(), status: 'pending', reason: '' };
      t.submissions.push(sub);
      if (t.submissions.length > MAX_SUBMISSIONS) t.submissions.splice(0, t.submissions.length - MAX_SUBMISSIONS);
      logTo(game, 'character', `${player.name} submitted a character: ${character.name}${character.career ? ` (${character.career})` : ''}`);
      toDM(game, 'character-submitted', { submission: sub });
      emitTable(game, { only: player });
      emitTable(game, { dmOnly: true });
      touch(game);
      callback?.({ success: true, id: sub.id });
    });

    /* ─── DM: Resolve a submission { id, action:'reject'|'assigned', reason? } ─── */
    on('submission-resolve', (payload, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const sub = tableOf(game).submissions.find((s) => s.id === payload.id);
      if (!sub) return callback?.({ error: 'Unknown submission.' });
      sub.status = payload.action === 'reject' ? 'rejected' : 'assigned';
      sub.reason = sstr(payload.reason, 300);
      const p = game.players.get(sub.playerId);
      if (p) toPlayer(p, 'submission-updated', { submission: { id: sub.id, status: sub.status, reason: sub.reason } });
      done(game, callback);
    });

    /* ─── Player: Roll result { clientId, roll } (queued on the phone until acked; deduped) → DM `roll { roll }` ─── */
    on('player-roll', (payload, callback) => {
      const { game, player } = playerCtx();
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      const clientId = typeof payload.clientId === 'string' ? payload.clientId.slice(0, 64) : null;
      if (clientId && t.clientIds.includes(clientId)) return callback?.({ success: true, duplicate: true });
      let roll = payload.roll;
      try { if (!roll || typeof roll !== 'object' || JSON.stringify(roll).length > MAX_ROLL_BYTES) return callback?.({ error: 'Invalid roll.' }); } catch { return callback?.({ error: 'Invalid roll.' }); }
      roll = JSON.parse(JSON.stringify(roll));
      // `at` is when the phone rolled (an offline-queued roll arrives later); anything implausible → now.
      const now = Date.now();
      const rolledAt = Number(payload.at);
      const at = Number.isFinite(rolledAt) && rolledAt > now - 7 * 24 * 3600 * 1000 && rolledAt <= now + 60 * 1000 ? rolledAt : now;
      const entry = { id: shortId('r'), clientId, playerId: player.id, playerName: player.name, characterName: player.character?.name || '', roll, at };
      // Answer to a GM roll-request ({ requestId } on the payload or the roll): tag the entry, close it for this player.
      const reqId = typeof payload.requestId === 'string' ? payload.requestId : (typeof roll.requestId === 'string' ? roll.requestId : null);
      const request = reqId ? t.rollRequests.find((r) => r.id === reqId && isOpenRequestFor(r, player.id)) : null;
      if (request) { entry.requestId = request.id; request.answeredBy.push(player.id); }
      t.rolls.push(entry);
      if (t.rolls.length > MAX_ROLLS) t.rolls.splice(0, t.rolls.length - MAX_ROLLS);
      if (clientId) rememberClientId(t, clientId);
      const summary = sstr(roll.summary || roll.label || '', 200);
      logTo(game, 'roll', `${pcName(player)} rolled${summary ? `: ${summary}` : ''}`);
      toDM(game, 'roll', { roll: entry });
      afterPlayerRoll(mech, game, player, entry); // push stress, Momentum, TV toast (board-roll)
      if (entry.roll.momentum) emitTable(game);
      else {
        emitTable(game, { dmOnly: true });
        if (request) emitTable(game, { only: player }); // the ROLL NOW card closes on the phone
      }
      touch(game);
      callback?.({ success: true, id: entry.id, ...(request ? { requestId: request.id } : {}) });
    });

    /* ─── Player: Pick up an item token { tokenId } → { success, item, takeId } ───
       Valid only for a visible, unlocked 'item' token in the same room (and level) as the player's own
       PC token. The token leaves the board, its label goes into the seat's gear (player.inventory),
       and a 'loot' log entry carries { takeId } so the GM can token-take-undo it. */
    on('token-take', (payload, callback) => {
      const { game, player } = playerCtx();
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      if (!player.character || player.alive === false) return callback?.({ error: 'NO CHARACTER.' });
      const b = boardOf(game);
      const tok = isTokenId(payload.tokenId) ? b.tokens[payload.tokenId] : null;
      if (!tok || tok.kind !== 'item' || !isTokenVisible(b, tok)) return callback?.({ error: 'NOTHING TO TAKE.' });
      if (tok.locked) return callback?.({ error: 'ASK THE GM.' });
      const pc = Object.values(b.tokens).find((x) => x.kind === 'pc' && x.ownerPlayerId === player.id);
      if (!pc) return callback?.({ error: 'YOU ARE NOT ON THE MAP.' });
      const lvl = (x) => x.level || b.level || null;
      if (!pc.roomId || pc.roomId !== tok.roomId || lvl(pc) !== lvl(tok)) return callback?.({ error: 'NOT IN YOUR ROOM.' });
      if (player.inventory.length >= MAX_INVENTORY) return callback?.({ error: 'GEAR FULL.' });
      const item = (tok.label || tok.sub || 'Item').slice(0, 120);
      const t = tableOf(game);
      const take = { id: shortId('take'), playerId: player.id, item, token: { ...tok }, at: Date.now(), undone: false };
      t.takes.push(take);
      if (t.takes.length > MAX_TAKES) t.takes.splice(0, t.takes.length - MAX_TAKES);
      delete b.tokens[tok.id];
      player.inventory = [...player.inventory, item];
      const roomName = b.rooms[tok.roomId]?.name || (game.mapDef?.rooms || []).find((r) => r.id === tok.roomId)?.name || tok.roomId;
      logTo(game, 'loot', `${pcName(player)} took ${item} (${roomName})`, { playerId: player.id, takeId: take.id, tokenId: tok.id });
      toPlayer(player, 'item-received', { item, at: take.at, taken: true });
      toPlayer(player, 'status-updated', { player: getPlayerData(player) });
      toDM(game, 'players-updated', { players: serializePlayers(game) });
      io.to(boardRoom(game.code)).emit('board-flash', { tokenId: pc.id });
      toDM(game, 'board-flash', { tokenId: pc.id });
      emitBoard(game);
      touch(game);
      emitTable(game, { dmOnly: true });
      callback?.({ success: true, item, takeId: take.id });
    });

    /* ─── DM: Undo a pickup { takeId } — the token goes back where it was, one copy of the item leaves the gear ─── */
    on('token-take-undo', (payload, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      const take = t.takes.find((x) => x.id === payload.takeId);
      if (!take || take.undone) return callback?.({ error: 'Unknown pickup.' });
      const b = boardOf(game);
      if (Object.keys(b.tokens).length >= MAX_TOKENS) return callback?.({ error: 'TOO MANY TOKENS.' });
      take.undone = true;
      // The GM may have reused the id meanwhile: restore under a fresh one then.
      const id = b.tokens[take.token.id] ? `${take.token.id.slice(0, 32)}-${randomBytes(2).toString('hex')}` : take.token.id;
      const restored = { ...take.token, id };
      b.tokens[id] = restored;
      placeToken(b, game.mapDef, restored);
      const player = game.players.get(take.playerId);
      if (player) {
        const i = player.inventory.lastIndexOf(take.item);
        if (i >= 0) player.inventory = [...player.inventory.slice(0, i), ...player.inventory.slice(i + 1)];
        toPlayer(player, 'status-updated', { player: getPlayerData(player) });
        toDM(game, 'players-updated', { players: serializePlayers(game) });
      }
      logTo(game, 'loot', `Undo: ${take.item} back on the map${player ? ` (from ${pcName(player)})` : ''}`, { takeId: take.id, tokenId: id, undo: true });
      emitBoard(game);
      done(game, callback, { tokenId: id });
    });

    /* ─── DM: Ask for a roll { skill, label?, difficulty?, note?, to:'all'|playerId|[playerIds] } → { success, id, sent } ───
       Recipients get `roll-requested { request: { id, skill, label, difficulty, note, at } }`; open requests are
       also in their table view (rollRequests), so a reconnecting phone still shows the card. The phone answers
       with a normal player-roll carrying { requestId }; the DM's `roll` entry then has requestId. */
    on('roll-request', (payload, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      if (typeof payload.skill !== 'string' || !SKILL_RE.test(payload.skill) || RESERVED_IDS.has(payload.skill)) return callback?.({ error: 'Invalid skill.' });
      const recipients = recipientsOf(game, payload.to);
      if (!recipients) return callback?.({ error: 'No recipients.' });
      const d = payload.difficulty;
      const difficulty = d === undefined || d === null || d === '' ? null : Number(d);
      if (difficulty !== null && (!Number.isInteger(difficulty) || difficulty < -10 || difficulty > 10)) return callback?.({ error: 'Invalid difficulty.' });
      const t = tableOf(game);
      const request = {
        id: shortId('rq'), skill: payload.skill, label: sstr(payload.label, 60).trim() || payload.skill,
        difficulty, note: sstr(payload.note, 300).trim(), recipients, at: Date.now(), answeredBy: [], cancelled: false,
      };
      t.rollRequests.push(request);
      if (t.rollRequests.length > MAX_ROLL_REQUESTS) t.rollRequests.splice(0, t.rollRequests.length - MAX_ROLL_REQUESTS);
      const pub = publicRollRequest(request);
      const sent = [];
      for (const [, p] of game.players) if (sentTo(recipients, p.id)) { toPlayer(p, 'roll-requested', { request: pub }); sent.push(p.id); }
      const nameOf = (id) => pcName(game.players.get(id));
      logTo(game, 'roll', `GM asked ${recipients === 'all' ? 'everyone' : recipients.map(nameOf).join(', ')} for ${request.label}${difficulty !== null ? ` (difficulty ${difficulty})` : ''}`, { requestId: request.id });
      done(game, callback, { id: request.id, sent });
    });

    /* ─── DM: Withdraw a roll request { id } (phones drop the card via table-state) ─── */
    on('roll-request-cancel', (payload, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const request = tableOf(game).rollRequests.find((r) => r.id === payload.id);
      if (!request) return callback?.({ error: 'Unknown request.' });
      request.cancelled = true;
      done(game, callback);
    });

    /* ═══ MECHANICS WAVE (server/mechanics.js): gm-roll, panic-result, supply-*, pool-*, init-*, injury-* ═══ */
    const mech = {
      io, games, dmTableGame, playerCtx, touch, emitTable, logTo, toDM, toPlayer, boardRoom, boardOf, emitBoard,
      serializePlayers, getPlayerData, tableOf, pcName,
    };
    wireMechanics(socket, mech); // registers through guard.safeOn as well

    /* ─── Disconnect: never deletes anything — games/players go dormant ─── */
    socket.on('disconnect', () => {
      try {
        lastPing.delete(socket.id);
        lastPause.delete(socket.id);
        detachSocket(socket, 'disconnected');
      } catch (err) { console.error(`[SOCKET] disconnect cleanup failed: ${err?.stack || err}`); }
    });

    if (!eventsChecked) {
      eventsChecked = true;
      const registered = new Set(socket.eventNames().filter((e) => e !== 'disconnect' && e !== 'error'));
      const missing = EVENT_NAMES.filter((e) => !registered.has(e));
      const unlisted = [...registered].filter((e) => !EVENT_NAMES.includes(e));
      if (missing.length || unlisted.length) console.warn(`[SESSION] EVENT_NAMES drift — not registered: ${missing.join(', ') || '-'}; not listed: ${unlisted.join(', ') || '-'}`);
    }
  });
}

export default attachSessions;
