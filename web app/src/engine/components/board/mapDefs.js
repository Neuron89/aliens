/* ═══════════════════════════════════════════════════════════════
   Board map resolution (docs/BOARD_AND_BUILDER.md §3).
   board.mapId is either a universe map id ("uscss-montero") or
   "<packId>:<mapId>" for a pack map (bundled or runtime). The DM client
   resolves it to a plain-data mapDef and sends it with board-set-map,
   because bundled packs only exist in the client bundle.
   ═══════════════════════════════════════════════════════════════ */
import { resolveEngine } from '../MapRenderer';

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'room';

/**
 * Map picker options: active pack first, then universe maps, then other packs.
 * One entry per map id: when a pack ships a map with the same id as a universe
 * map (e.g. the Water Debt's "qarrat-keep"), only the pack's entry is listed.
 */
export function boardMapOptions(universe, packs, activePackId) {
  const opts = [];
  const seen = new Set();
  const universeMaps = universe.maps || [];
  const packMapIds = new Set(packs.flatMap((p) => (p.maps || []).map((m) => m.id)));
  const addPack = (p) => {
    for (const m of p.maps || []) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      opts.push({ mapId: `${p.id}:${m.id}`, title: m.title || m.id, group: p.meta?.title || p.id, packId: p.id, map: m, active: p.id === activePackId });
    }
  };
  const active = packs.find((p) => p.id === activePackId);
  if (active) addPack(active);
  for (const m of universeMaps) {
    if (packMapIds.has(m.id) || seen.has(m.id)) continue;
    seen.add(m.id);
    opts.push({ mapId: m.id, title: m.title || m.id, group: `${universe.name} — GENERAL`, packId: null, map: m });
  }
  for (const p of packs) if (p.id !== activePackId) addPack(p);
  return opts;
}

/** Find a picker option; a bare universe map id also matches the pack entry that replaced it. */
export function findMapOption(options, mapId) {
  if (!mapId) return null;
  return options.find((o) => o.mapId === mapId)
    || (!mapId.includes(':') ? options.find((o) => o.map?.id === mapId) : null)
    || null;
}

/** Engine map behind a map entry (pack maps can reference a universe engine map by id). */
export function engineBase(universe, map) {
  const universeMaps = universe.maps || [];
  if (typeof map.engine === 'function') return universeMaps.find((u) => u.id === map.id) || null;
  const ref = typeof map.engine === 'string' ? map.engine : map.id;
  const base = universeMaps.find((u) => u.id === ref);
  return base && typeof base.engine === 'function' ? base : null;
}

/** MapEngine config for an engine mapDef (MonteroMap.config etc.). */
export function engineConfig(universe, mapDef) {
  if (!mapDef || mapDef.kind !== 'engine') return null;
  const Comp = resolveEngine(universe, { engine: mapDef.engine });
  return Comp?.config || null;
}

/* Fallback board palette (neutral). Universes override via theme.board;
   a map may override any key via map.palette. */
export const DEFAULT_BOARD_PALETTE = {
  levelNoun: 'LEVEL', backdrop: 'none', bg: '#000000', fog: '#020304', fogEdge: 'rgba(150, 170, 190, 0.3)',
  fogHatch: '#8899aa', revealedEdge: 'rgba(200, 210, 220, 0.35)', label: '#eef0f4', labelStroke: '#000000',
  ascii: '#c8ccd4', asciiBg: '#08080a', door: '#c8ccd4', reveal: 'fade', statusStyle: 'segments', chipFill: '#0a0c10',
  font: "ui-monospace, 'Courier New', monospace",
};

/**
 * Visual settings for a board map, read from the map definition and the
 * universe theme (never a constant): { palette, levelNoun, backdrop, mapTheme }.
 * The server-stored mapDef only carries geometry, so the universe map with the
 * same id (or the engine it references) supplies levelNoun / backdrop / palette.
 */
export function mapVisuals(universe, mapDef) {
  const board = universe?.theme?.board || {};
  const base = mapDef ? (universe?.maps || []).find((m) => m.id === mapDef.id || (mapDef.engine && m.id === mapDef.engine)) : null;
  const cfg = mapDef?.kind === 'engine' && universe ? engineConfig(universe, mapDef) : null;
  const palette = { ...DEFAULT_BOARD_PALETTE, ...board, ...(base?.palette || {}), ...(mapDef?.palette || {}) };
  const backdrop = mapDef?.backdrop || base?.backdrop || cfg?.backdrop
    || (mapDef?.kind === 'engine' ? ((cfg?.stars?.count ?? 0) > 0 ? 'space' : board.backdrop || 'none') : 'none');
  const levelNoun = (mapDef?.levelNoun || base?.levelNoun || cfg?.levelNoun || board.levelNoun || 'LEVEL').toUpperCase();
  return { palette, backdrop, levelNoun, mapTheme: cfg?.theme || null };
}

function measureImage(src) {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? [img.naturalWidth, img.naturalHeight] : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function shapedRooms(rooms) {
  const seen = new Set();
  const out = [];
  for (const r of rooms || []) {
    if (!r?.shape) continue;
    let id = r.id || slug(r.name);
    while (seen.has(id)) id += '-x';
    seen.add(id);
    out.push({ id, name: r.name || id.toUpperCase(), ...(r.level ? { level: r.level } : {}), ...(r.note ? { note: r.note } : {}), shape: r.shape });
  }
  return out;
}

const pick = (src, keys) => Object.fromEntries(keys.filter((k) => src[k] !== undefined && src[k] !== null).map((k) => [k, src[k]]));
const BOARD_KEYS = ['size', 'levels', 'outline', 'crop', 'spawn', 'grid', 'doors', 'levelNoun', 'backdrop', 'palette'];

/** Resolve a picker option to the plain-data mapDef the server stores. */
export async function resolveMapDef(universe, option) {
  if (!option) return null;
  const m = option.map;
  const base = engineBase(universe, m);
  if (base) {
    return {
      id: base.id, title: m.title || base.title, ...(m.subtitle || base.subtitle ? { subtitle: m.subtitle || base.subtitle } : {}),
      kind: 'engine', engine: base.id, ...pick(base, BOARD_KEYS), rooms: shapedRooms(base.rooms),
    };
  }
  const src = m.src || m.image;
  if (src) {
    const size = Array.isArray(m.size) ? m.size : await measureImage(src);
    return {
      id: m.id, title: m.title || m.id, ...(m.subtitle ? { subtitle: m.subtitle } : {}),
      kind: 'image', src, ...pick(m, BOARD_KEYS), ...(size ? { size } : {}), rooms: shapedRooms(m.rooms),
    };
  }
  return {
    id: m.id, title: m.title || m.id, ...(m.subtitle ? { subtitle: m.subtitle } : {}),
    kind: 'ascii', ascii: m.ascii || '', ...pick(m, BOARD_KEYS), rooms: shapedRooms(m.rooms),
  };
}
