/* ═══════════════════════════════════════════════════════════════
   Board map resolution (docs/BOARD_AND_BUILDER.md §3).
   board.mapId is either a universe map id ("uscss-montero") or
   "<packId>:<mapId>" for a pack map (bundled or runtime). The DM client
   resolves it to a plain-data mapDef and sends it with board-set-map,
   because bundled packs only exist in the client bundle.
   ═══════════════════════════════════════════════════════════════ */
import { resolveEngine } from '../MapRenderer';

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'room';

/** Map picker options: active pack first, then universe maps, then other packs. */
export function boardMapOptions(universe, packs, activePackId) {
  const opts = [];
  const universeMaps = universe.maps || [];
  const addPack = (p) => {
    for (const m of p.maps || []) {
      opts.push({ mapId: `${p.id}:${m.id}`, title: m.title || m.id, group: p.meta?.title || p.id, packId: p.id, map: m, active: p.id === activePackId });
    }
  };
  const active = packs.find((p) => p.id === activePackId);
  if (active) addPack(active);
  for (const m of universeMaps) opts.push({ mapId: m.id, title: m.title || m.id, group: `${universe.name} — GENERAL`, packId: null, map: m });
  for (const p of packs) if (p.id !== activePackId) addPack(p);
  return opts;
}

export function findMapOption(options, mapId) {
  return options.find((o) => o.mapId === mapId) || null;
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
const BOARD_KEYS = ['size', 'levels', 'outline', 'crop', 'spawn', 'grid', 'doors'];

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
