/* ═══════════════════════════════════════════════════════════════
   Mechanics helpers (client, JSX-free; universe-agnostic).
   Panic / injury table lookups by `roll` range strings ("1-6", "7",
   "15+", "11-16"), d66, creature attack pools, ambient preset ids.
   ═══════════════════════════════════════════════════════════════ */

export const rollDie = (n = 6) => 1 + Math.floor(Math.random() * n);
export const rollD66 = () => rollDie(6) * 10 + rollDie(6);

/** Does `value` fall in a table range string ("7", "1-6", "15+", "11–16")? */
export function inRange(range, value) {
  const s = String(range ?? '').trim().replace(/[–—]/g, '-');
  if (!s) return false;
  let m = /^(\d+)\+$/.exec(s);
  if (m) return value >= Number(m[1]);
  m = /^(\d+)\s*-\s*(\d+)$/.exec(s);
  if (m) return value >= Number(m[1]) && value <= Number(m[2]);
  return Number(s) === value;
}

/** Entry of a rollable table whose `roll` range contains value (clamps above the top range). */
export function tableLookup(table, value) {
  const list = Array.isArray(table) ? table : [];
  return list.find((e) => inRange(e.roll, value)) || null;
}

/** Resolve a rules path like 'catalog.panic' against the universe. */
export function universeTable(universe, path) {
  if (!path) return [];
  return String(path).split('.').reduce((o, k) => (o ? o[k] : undefined), universe) || [];
}

/**
 * Panic result for a total (rules.panic + panic table). Returns
 * { entry, total, effect: { id, name, text, stressDelta, panicAction, status[] } }.
 * stressDelta counts the stress effects that hit the roller ("to you" / unspecified),
 * not the ones aimed only at friendly PCs.
 */
export function panicOutcome(universe, total) {
  const cfg = universe?.rules?.panic;
  if (!cfg) return null;
  const table = universeTable(universe, cfg.table);
  const entry = tableLookup(table, total) || (table.length ? table[table.length - 1] : null);
  if (!entry) return null;
  let stressDelta = 0;
  for (const e of entry.effects || []) {
    if (e.target !== 'stress' || typeof e.value !== 'number') continue;
    const t = String(e.text || '');
    if (/friendly/i.test(t) && !/\byou\b/i.test(t)) continue;
    stressDelta += e.value;
  }
  const status = [];
  if (total >= (cfg.statusAt ?? 7)) status.push(cfg.statusEffect || 'PANICKED');
  if (entry.panicAction || total >= (cfg.actionAt ?? 99)) status.push(String(entry.name).toUpperCase());
  return {
    entry, total,
    effect: { id: entry.id, name: entry.name, text: entry.text || '', stressDelta, panicAction: !!entry.panicAction, status },
  };
}

/** Pool definitions for the server (universe.rules.pools → pools-init defs). */
export function poolDefs(universe) {
  return (universe?.rules?.pools || []).map((p) => ({
    key: p.key, label: p.label, max: p.max ?? null, owner: p.owner,
    visibleToPlayers: p.visibleToPlayers ?? p.owner !== 'gm', playerAdd: p.playerAdd ?? p.owner === 'players',
  }));
}

/** Starting values: initial, or initialPerPlayer × players (threat = 2 × players in Dune). */
export function poolStart(universe, playerCount, overrides = {}) {
  const out = {};
  for (const p of universe?.rules?.pools || []) {
    if (overrides[p.key] !== undefined && overrides[p.key] !== '') out[p.key] = Math.max(0, Number(overrides[p.key]) || 0);
    else out[p.key] = p.initialPerPlayer ? p.initialPerPlayer * Math.max(0, playerCount) : (p.initial || 0);
  }
  return out;
}

/** Creature card numbers: { hpMax, armor, skills, attackDice } from catalog stats (alien health / dune stress). */
export function creatureStats(c) {
  const s = c?.stats || {};
  const hpMax = Number(s.health ?? s.stress ?? s.hp) || null;
  const armor = s.armor ?? null;
  return { hpMax, armor, armorVsFire: s.armorVsFire ?? null, speed: s.speed ?? null, skills: s.skills || null, threat: s.threat ?? null, test: s.test || null };
}

/** Damage named in a signature attack text: { damage } for "Damage 2" (YZE) or { stress } for "5 Stress"
    (2d20); {} when the entry names neither. */
export function attackDamage(text) {
  const t = String(text || '');
  const d = /Damage\s+(\d+)/i.exec(t);
  if (d) return { damage: Number(d[1]) };
  const s = /(\d+)\s+(?:extra\s+)?Stress\b/i.exec(t);
  return s ? { stress: Number(s[1]) } : {};
}

/** Resolve a signature attack's pool roll. roll(n) → { dice[], successes }.
    YZE: any success hits; base damage + 1 per extra success. Entries without a dice pool are automatic effects.
    Returns { dice: n|null, pool: { dice[], successes }|null, hit: bool|null, damage: number|null, stress: number|null }. */
export function resolveSignatureAttack(entry, roll) {
  const nd = attackDice(entry?.text);
  const { damage = null, stress = null } = attackDamage(entry?.text);
  if (!nd) return { dice: null, pool: null, hit: null, damage, stress };
  const pool = roll(nd);
  const hit = pool.successes > 0;
  return { dice: nd, pool, hit, damage: hit && damage != null ? damage + (pool.successes - 1) : null, stress };
}

/** Number of attack dice named in a signature attack text ("6 Base Dice"), or null. */
export function attackDice(text) {
  const m = /(\d+)\s+Base Dice/i.exec(String(text || ''));
  return m ? Number(m[1]) : null;
}

/* Scene ambient → useAmbientAudio preset id. Pack scenes name moods; unknown names are ignored. */
const AMBIENT_ALIASES = {
  'ship-hum': 'ship', ship: 'ship', hum: 'ship',
  tension: 'tension', alert: 'alert', 'red-alert': 'alert', dread: 'dread', space: 'space', 'deep-space': 'space',
  wind: 'wind', desert: 'wind', bazaar: 'bazaar', market: 'bazaar', sietch: 'sietch', court: 'court', palace: 'court',
  off: 'off', silence: 'off',
};
export function ambientPreset(name, presets) {
  const id = AMBIENT_ALIASES[String(name || '').toLowerCase()];
  return id && (!presets || presets[id]) ? id : null;
}
