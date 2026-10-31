/* ═══════════════════════════════════════════════════════════════
   Intrigue web — JSX-free graph helpers (node-importable: used by
   run/IntrigueDrawer.jsx, scripts/validate-content.mjs and
   scripts/test-intrigue.mjs).

   A pack's NPCs and characters may carry
     relations: [{ to, kind, note?, secret? }]
   (server/schema/content-pack.schema.json $defs.relation). `to` names
   another person of the same pack: an NPC name, a character name or a
   character id (matched exactly first, then case/space-insensitively).

   buildGraph(pack)        → { nodes, edges, unresolved }
   relationProblems(pack)  → validator messages (unresolved / self `to`)
   ringLayout(nodes, w, h) → { [key]: { x, y, ring } } (PCs inner, NPCs outer)
   relationClue(edge, byKey) → { id, text, source } for the clue-reveal path
   ═══════════════════════════════════════════════════════════════ */

export const RELATION_KINDS = ['ally', 'rival', 'owes', 'fears', 'loves', 'serves', 'hides'];

/* One colour per kind. CSS vars where the theme has a matching meaning (both
   universes define them), fixed fallbacks for the two kinds without one. */
export const KIND_STYLE = {
  ally: { color: 'var(--success, #6cc070)', label: 'ALLY', verb: 'works with' },
  rival: { color: 'var(--danger, #e5534b)', label: 'RIVAL', verb: 'works against' },
  owes: { color: 'var(--warn, #e0b040)', label: 'OWES', verb: 'is in debt to' },
  fears: { color: 'var(--purple, #a07ae0)', label: 'FEARS', verb: 'fears' },
  loves: { color: '#f07aa8', label: 'LOVES', verb: 'is bound by love or blood to' },
  serves: { color: 'var(--blue, #5aa8e0)', label: 'SERVES', verb: 'answers to' },
  hides: { color: '#a8b0b8', label: 'HIDES', verb: 'is keeping something from' },
};

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/* Leading honorifics dropped from node labels (the full name stays in the
   detail panel, the title attribute and the aria label). */
const TITLES = new Set(['lord', 'lady', 'ser', 'sir', 'captain', 'capt.', 'crawler', 'boss', 'steward', 'proctor', 'attaché', 'attache',
  'magister', 'reverend', 'mother', 'auditor', 'sister', 'brother', 'dr.', 'doctor', 'judge', 'quota', 'assessor', 'naib', 'sayyadina',
  'chamberlain', 'steward-of-passage', 'envoy', 'mr.', 'mrs.', 'ms.', 'lt.', 'lieutenant', 'sgt.', 'sergeant', 'cpl.', 'corporal', 'pvt.',
  'private', 'major', 'colonel', 'commander', 'chief', 'agent', 'marshal', 'executive', 'officer', 'the']);

/** Short node label: "Crawler Boss Iselde Varn" → "Iselde Varn", "Ferrouk of Umm Kareth" → "Ferrouk". */
export function shortLabel(name) {
  const full = String(name || '').trim();
  let base = full.split(/\s+of\s+/i)[0] || full;
  const words = base.split(/\s+/);
  while (words.length > 1 && TITLES.has(words[0].toLowerCase())) words.shift();
  base = words.slice(0, 2).join(' ');
  return base || full;
}

/** Two-letter monogram for compact nodes. */
export function initials(name) {
  const w = shortLabel(name).split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || '?') + (w[1]?.[0] || w[0]?.[1] || '')).toUpperCase();
}

/** Stable short hash (FNV-1a, base36) — relation ids double as clue ids. */
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

/** People of a pack: [{ key, type:'pc'|'npc', name, label, role, id? , relations }] */
export function peopleOf(pack) {
  const out = [];
  const seen = new Set();
  for (const c of Array.isArray(pack?.characters) ? pack.characters : []) {
    if (!c || typeof c !== 'object' || !c.name) continue;
    const key = `pc:${c.id || c.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, type: 'pc', id: c.id || null, name: c.name, label: shortLabel(c.name), role: c.career || '', relations: Array.isArray(c.relations) ? c.relations : [] });
  }
  for (const n of Array.isArray(pack?.npcs) ? pack.npcs : []) {
    if (!n || typeof n !== 'object' || !n.name) continue;
    const key = `npc:${n.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, type: 'npc', name: n.name, label: shortLabel(n.name), role: n.role || '', relations: Array.isArray(n.relations) ? n.relations : [] });
  }
  return out;
}

/** Resolve a relation's `to` against the pack's people → node key or null. */
export function resolvePerson(people, to) {
  const t = String(to ?? '').trim();
  if (!t) return null;
  const exact = people.find((p) => (p.type === 'pc' && p.id === t) || p.name === t);
  if (exact) return exact.key;
  const n = norm(t);
  const loose = people.find((p) => (p.type === 'pc' && norm(p.id) === n) || norm(p.name) === n);
  return loose ? loose.key : null;
}

/** { nodes, edges, unresolved } — nodes without any relation are still listed (the GM sees who is unconnected). */
export function buildGraph(pack) {
  const people = peopleOf(pack);
  const edges = [];
  const unresolved = [];
  const ids = new Set();
  for (const p of people) {
    p.relations.forEach((r, i) => {
      if (!r || typeof r !== 'object') return;
      const to = resolvePerson(people, r.to);
      const kind = RELATION_KINDS.includes(r.kind) ? r.kind : null;
      if (!to || !kind || to === p.key) { unresolved.push({ from: p.name, to: r.to, kind: r.kind, index: i }); return; }
      let id = `rel-${kind}-${hash(`${p.key}|${to}|${kind}|${r.note || ''}`)}`;
      while (ids.has(id)) id += 'x';
      ids.add(id);
      edges.push({ id, from: p.key, to, kind, note: String(r.note || ''), secret: r.secret === true });
    });
  }
  return { nodes: people.map(({ relations, ...n }) => n), edges, unresolved }; // eslint-disable-line no-unused-vars
}

/** Validator messages for a pack's relations (empty = fine). */
export function relationProblems(pack) {
  const people = peopleOf(pack);
  const out = [];
  for (const p of people) {
    const at = p.type === 'pc' ? `characters/${p.id || p.name}` : `npcs/${p.name}`;
    p.relations.forEach((r, i) => {
      const to = resolvePerson(people, r?.to);
      if (!to) out.push(`${at}: relations[${i}].to "${r?.to}" is not an NPC or character (name or id) of this pack`);
      else if (to === p.key) out.push(`${at}: relations[${i}] points at itself`);
    });
  }
  return out;
}

/**
 * Ring layout fitted to a w×h panel (marginX/marginY leave room for labels): PCs on an inner ring, NPCs on the outer
 * one (rings become ellipses on non-square panels). Deterministic: the same
 * pack always draws the same picture. Outer ring is rotated half a step so
 * inner and outer nodes do not line up on the same spoke.
 */
export function ringLayout(nodes, w, h, { margin = 56, marginX = margin, marginY = margin } = {}) {
  const pcs = nodes.filter((n) => n.type === 'pc');
  const npcs = nodes.filter((n) => n.type !== 'pc');
  const cx = w / 2;
  const cy = h / 2;
  const rx = Math.max(40, w / 2 - marginX);
  const ry = Math.max(40, h / 2 - marginY);
  const inner = npcs.length ? 0.42 : 0.8;
  const pos = {};
  const place = (list, fx, fy, offset, ring) => {
    const n = list.length;
    const centre = n === 1 && ring === 'inner' && !npcs.length;
    list.forEach((node, i) => {
      const a = -Math.PI / 2 + offset + (2 * Math.PI * i) / Math.max(1, n);
      pos[node.key] = { x: centre ? cx : cx + Math.cos(a) * fx, y: centre ? cy : cy + Math.sin(a) * fy, ring, angle: a };
    });
  };
  place(pcs, rx * inner, ry * inner, 0, 'inner');
  place(npcs, rx, ry, npcs.length ? Math.PI / npcs.length : 0, 'outer');
  return pos;
}

/** Edge path: a gentle curve; the two directions of a pair bend to opposite sides. */
export function edgePath(a, b, bend = 0.14) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const cx = mx - dy * bend;
  const cy = my + dx * bend;
  return { d: `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`, cx, cy };
}

/** The clue a REVEAL sends to the phones (reuses the clue-reveal path; id = relation id). */
export function relationClue(edge, byKey) {
  const from = byKey[edge.from]?.name || '?';
  const to = byKey[edge.to]?.name || '?';
  const verb = KIND_STYLE[edge.kind]?.verb || edge.kind;
  const note = edge.note ? ` ${edge.note}` : '';
  return { id: edge.id, text: `${from} ${verb} ${to}.${note}`.slice(0, 1000), source: 'Intrigue' };
}
