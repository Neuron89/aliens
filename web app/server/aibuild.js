/* ═══════════════════════════════════════════════════════════════
   AI BUILD — dress the current map with items, creatures, NPCs, markers
   and hazards (docs/AI_GM.md "AI BUILD"). Routes live in gm.js
   (/api/gm/build*); this module does the work.

   Plan (game.table.aiPlan — GM-only, never in a player/board view):
     { mapId, mapTitle, density, at, provider:'local'|'template'|'mixed', model,
       applied: [roomId], warning?,
       rooms: { [roomId]: { name, level, mood, description,
                            tokens: [{ kind, label, sub, glyph, hidden, locked, note }],
                            check: { skill, difficulty, label, success, failure } | null,
                            hazard, loot } } }

   - generatePlan(): asks the local model (gm.js client; response_format json_object),
     rooms in batches of BATCH_ROOMS (a local model's context is small), extracts the
     first {...} block when the model wraps it in fences/prose, retries a batch once on
     invalid JSON, validates strictly (validatePlan) and falls back to templatePlan()
     for any batch that still fails. No GM_URL / model down → the template. Never empty.
   - applyPlan(): places tokens (sanitizeToken + placeToken) at spread points inside
     each room (board.pointInRoom), tagged ai:true + aiRoom (+ aiShow when planned
     visible); re-applying a room replaces its AI tokens unless keep.
   - clearPlan(): removes every ai token and the plan.
   Board/table pushes go through sessions.sessionApi (set by attachSessions).
   ═══════════════════════════════════════════════════════════════ */
import { randomBytes } from 'crypto';
import { sessionApi } from './sessions.js';
import { gmConfig, gmStatus, streamChat, personaFor } from './gm.js';
import { releaseForLlm, comfyBase } from './vram.js';
import {
  sanitizeToken, placeToken, pointInRoom, roomAt, spawnPoint, seededRandom, sanitizeMapDef, MAX_TOKENS, doorsFrom,
} from './board.js';

export const DENSITIES = Object.freeze(['sparse', 'normal', 'dense']);
export const PLAN_KINDS = Object.freeze(['item', 'creature', 'npc', 'marker', 'hazard']);
/** board/TokenChip.jsx GLYPHS */
export const GLYPHS = Object.freeze(['diamond', 'triangle', 'square', 'circle', 'hex', 'star', 'cross', 'chevron', 'shield', 'person',
  'crate', 'hazard', 'objective', 'noise', 'blood', 'lock', 'vent', 'fire', 'door', 'claw']);
const DEFAULT_GLYPH = { item: 'crate', creature: 'claw', npc: 'person', marker: 'objective', hazard: 'hazard' };
export const MAX_PER_ROOM = 4;
export const MAX_PLAN_TOKENS = 60;
export const BATCH_ROOMS = 10;
/** At most this share of rooms carries a check (a local model tends to put one everywhere). */
export const CHECK_SHARE = 0.4;
const DENSITY_RULE = {
  sparse: 'about one token for every two rooms (many rooms stay empty)',
  normal: 'one or two tokens per room',
  dense: 'two or three tokens per room',
};

const arr = (v) => (Array.isArray(v) ? v : []);
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const words = (s) => String(s || '').toLowerCase().match(/[a-z0-9]+/g) || [];
const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'to', 'in', 'on', 'room', 'deck', 'level', 'area', 'uscss', 'house']);

/** Skill ids (rules.skills[].key) of a universe core. */
export const skillsOf = (universe) => arr(universe?.rules?.skills).map((s) => ({ key: s.key, label: s.label || s.key })).filter((s) => typeof s.key === 'string');

/** Allowed check difficulties: ALIEN = a dice-pool modifier, DUNE = a 1–5 difficulty. */
export function difficultyRange(universeId) {
  if (universeId === 'dune') return { min: 1, max: 5, def: 2, text: 'an integer 1 to 5 (1 easy, 2 average, 3 hard, 4 very hard, 5 near impossible)' };
  return { min: -3, max: 3, def: 0, text: 'an integer modifier -3 to +3 on the dice pool (usually 0, -1 or -2; negative is harder)' };
}

/** Rooms of the spawn point on every level (a creature never waits in one). */
export function spawnRooms(mapDef) {
  const out = new Set();
  const levels = arr(mapDef?.levels).map((l) => l.id);
  for (const lvl of levels.length ? levels : [null]) {
    const [x, y] = spawnPoint(mapDef, lvl);
    const r = roomAt(mapDef, x, y, lvl);
    if (r) out.add(r);
  }
  return out;
}

export const creatureCap = (nRooms) => Math.max(1, Math.floor(nRooms / 3));

/* ── JSON extraction ───────────────────────────────────────────── */

/** First parseable top-level {...} in a model answer (fences, prose and <think> tolerated). */
export function extractJson(text) {
  let s = String(text || '').replace(/<think>[\s\S]*?(<\/think>|$)/g, '');
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  if (fence) { try { return JSON.parse(fence[1]); } catch { /* fall through */ } }
  for (let start = s.indexOf('{'); start >= 0; start = s.indexOf('{', start + 1)) {
    let depth = 0; let inStr = false; let esc = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) {
        try { const j = JSON.parse(s.slice(start, i + 1)); if (j && typeof j === 'object' && !Array.isArray(j)) return j; } catch { /* next */ }
        break;
      }
    }
  }
  return null;
}

/* ── Validation ────────────────────────────────────────────────── */

/**
 * Strictly validate a raw plan → { rooms, dropped } (rooms keyed by known room ids only).
 * opts: { mapDef, skills:[{key,label}], universeId, spawn:Set, allowRooms?:Set, creatureBudget?, tokenBudget? }
 * Unknown rooms/kinds/skills, empty labels, creatures in a spawn room and anything over the caps are
 * dropped; an unknown glyph becomes the kind's default glyph; difficulty is clamped to the range.
 */
export function validatePlan(raw, opts = {}) {
  const { mapDef, skills = [], universeId } = opts;
  const range = difficultyRange(universeId);
  const spawn = opts.spawn || spawnRooms(mapDef);
  const defRooms = arr(mapDef?.rooms);
  const byId = new Map(defRooms.map((r) => [r.id, r]));
  const byName = new Map(defRooms.map((r) => [String(r.name || '').toLowerCase(), r]));
  let creatures = Number.isFinite(opts.creatureBudget) ? opts.creatureBudget : creatureCap(defRooms.length);
  let total = Number.isFinite(opts.tokenBudget) ? opts.tokenBudget : MAX_PLAN_TOKENS;
  const skillKey = (v) => {
    const q = String(v || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
    return skills.find((s) => s.key.toLowerCase() === q || String(s.label).toLowerCase().replace(/[\s_-]+/g, '') === q)?.key || null;
  };
  let dropped = 0;
  const rooms = {};
  let entries = [];
  const src = raw && typeof raw === 'object' ? (raw.rooms ?? raw) : null;
  if (Array.isArray(src)) entries = src.map((r) => [r?.id ?? r?.roomId ?? r?.name, r]);
  else if (src && typeof src === 'object') entries = Object.entries(src);
  for (const [key, r] of entries) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) { dropped++; continue; }
    const room = byId.get(String(key)) || byName.get(String(key || '').toLowerCase());
    if (!room || (opts.allowRooms && !opts.allowRooms.has(room.id)) || rooms[room.id]) { dropped++; continue; }
    const out = {
      name: room.name, ...(room.level ? { level: room.level } : {}),
      mood: clip(r.mood, 60), description: clip(r.description, 600), tokens: [], check: null,
      hazard: real(r.hazard, 300), loot: real(r.loot, 300),
    };
    for (const t of arr(r.tokens)) {
      if (!t || typeof t !== 'object' || !PLAN_KINDS.includes(t.kind)) { dropped++; continue; }
      const label = clip(t.label, 60);
      if (!label) { dropped++; continue; }
      if (out.tokens.length >= MAX_PER_ROOM || total <= 0) { dropped++; continue; }
      if (t.kind === 'creature' && (spawn.has(room.id) || creatures <= 0)) { dropped++; continue; }
      const glyph = GLYPHS.includes(t.glyph) ? t.glyph : DEFAULT_GLYPH[t.kind];
      const hidden = typeof t.hidden === 'boolean' ? t.hidden : (t.kind === 'creature' || t.kind === 'npc');
      out.tokens.push({
        kind: t.kind, label, sub: clip(t.sub, 60), glyph, hidden,
        locked: t.kind === 'item' ? t.locked === true : false, note: real(t.note, 300),
      });
      total--;
      if (t.kind === 'creature') creatures--;
    }
    const c = r.check;
    if (c && typeof c === 'object') {
      const skill = skillKey(c.skill);
      const d = Number(c.difficulty);
      if (skill) {
        out.check = {
          skill,
          difficulty: Number.isFinite(d) ? Math.min(range.max, Math.max(range.min, Math.round(d))) : range.def,
          label: clip(c.label, 60) || skills.find((s) => s.key === skill)?.label || skill,
          success: real(c.success, 300), failure: real(c.failure, 300),
        };
      } else dropped++;
    }
    rooms[room.id] = out;
  }
  // checkBudget: keep the checks where a creature or hazard is, then the first ones; drop the rest
  const withCheck = Object.values(rooms).filter((r) => r.check);
  if (Number.isFinite(opts.checkBudget) && withCheck.length > opts.checkBudget) {
    const risky = (r) => r.tokens.some((t) => t.kind === 'creature' || t.kind === 'hazard') || !!r.hazard;
    const keep = new Set([...withCheck.filter(risky), ...withCheck.filter((r) => !risky(r))].slice(0, Math.max(0, opts.checkBudget)));
    for (const r of withCheck) if (!keep.has(r)) { r.check = null; dropped++; }
  }
  return { rooms, dropped };
}

/* ── Template (no model) ───────────────────────────────────────── */

const ITEMS = {
  alien: [['Supply crate', 'crate', 'Rations, water purifier tabs, a flare.'], ['Medkit', 'cross', 'One use: +1 to a Medical Aid roll.'], ['Datapad', 'square', 'Crew logs; part of the story is in here.'],
    ['Flare pack', 'fire', 'Three signal flares.'], ['Tool kit', 'crate', 'Cutting torch and spanners.'], ['Air tank', 'circle', 'Half full.'], ['Motion tracker', 'noise', 'Battery low.']],
  dune: [['Water flask', 'circle', 'A litre of water: wealth on Arrakis.'], ['Message cylinder', 'square', 'Sealed with a House sigil.'], ['Stillsuit repair kit', 'crate', 'Seals and filters.'],
    ['Spice cache', 'diamond', 'A small hoard of melange.'], ['Glowglobe', 'circle', 'Drifts at shoulder height.'], ['Maula pistol', 'crate', 'Spring-loaded; one dart left.'], ['Ledger', 'square', 'Accounts that do not balance.']],
};
const HAZARDS = {
  alien: [['Coolant leak', 'Freezing vapour vents across the floor.'], ['Live cabling', 'Torn cables arc in the dark.'], ['Breach warning', 'A hairline crack in the hull.']],
  dune: [['Sand drift', 'Loose sand hides a drop.'], ['Shield flicker', 'An unstable shield generator hums.'], ['Poison snooper alert', 'Something here is not what it seems.']],
};
const SENSES = {
  alien: ['The air is stale and a degree too warm.', 'Emergency lighting paints everything amber.', 'Condensation beads on the bulkheads.', 'A fan rattles somewhere behind the panels.', 'The deck plates tick as they settle.', 'It smells of ozone and old coffee.'],
  dune: ['Heat presses at the walls.', 'Dust hangs in a shaft of hard light.', 'A glowglobe drifts in slow orbit overhead.', 'The stone keeps the night\'s cold close.', 'Somewhere water drips, and every drop is counted.', 'Fine sand has found its way across the floor.'],
};
const CHECKS = {
  alien: { creature: ['observation', -1, 'Something moves in the dark'], hazard: ['mobility', 0, 'Get past the hazard'], item: ['observation', 0, 'Search the room'] },
  dune: { creature: ['understand', 3, 'Sense the danger'], hazard: ['move', 2, 'Cross safely'], item: ['understand', 2, 'Read the room'] },
};

/** Model placeholders that are not content ("GM only", "n/a", ...) become ''. */
const real = (s, n) => { const t = clip(s, n); return /^(gm[ -]?only|n\/?a|none|tbd|-|optional)\.?$/i.test(t) ? '' : t.replace(/^gm only:\s*/i, ''); };

const firstSentence = (s) => {
  const t = clip(s, 400);
  const m = /^(.{12,200}?[.!?])(\s|$)/.exec(t);
  return m ? m[1] : (t.length <= 160 ? t : '');
};

/** Door-graph distance from the spawn room(s) (ignoring locks); unreachable rooms count as far. */
function distances(mapDef, from) {
  const dist = new Map([...from].map((r) => [r, 0]));
  const queue = [...from];
  while (queue.length) {
    const r = queue.shift();
    for (const d of doorsFrom(mapDef, r)) if (!dist.has(d.to)) { dist.set(d.to, dist.get(r) + 1); queue.push(d.to); }
  }
  return dist;
}

/** Deterministic plan from the pack + map (never empty when the map has rooms). opts: { pack, universe, mapDef, density, seed, onlyRooms? } */
export function templatePlan(opts = {}) {
  const { pack, mapDef } = opts;
  const universeId = opts.universe?.id || 'alien';
  const u = ITEMS[universeId] ? universeId : 'alien';
  const density = DENSITIES.includes(opts.density) ? opts.density : 'normal';
  const rand = seededRandom(opts.seed ?? 7);
  const all = arr(mapDef?.rooms);
  const rooms = opts.onlyRooms ? all.filter((r) => opts.onlyRooms.has(r.id)) : all;
  const spawn = spawnRooms(mapDef);
  const dist = distances(mapDef, spawn);
  const far = (r) => (dist.has(r.id) ? dist.get(r.id) : 99);
  const skills = skillsOf(opts.universe);
  const hasSkill = (k) => !skills.length || skills.some((s) => s.key === k);
  const plan = {};
  for (const r of rooms) {
    const sense = SENSES[u][Math.floor(rand() * SENSES[u].length)];
    const fs = firstSentence(r.note);
    plan[r.id] = { name: r.name, ...(r.level ? { level: r.level } : {}), mood: '', description: [fs, sense].filter(Boolean).join(' '), tokens: [], check: null, hazard: '', loot: '' };
  }
  const ids = rooms.map((r) => r.id);
  const byFar = [...rooms].filter((r) => !spawn.has(r.id)).sort((a, b) => far(b) - far(a) || a.id.localeCompare(b.id));
  // threats → hidden creatures in the farthest rooms
  const threats = arr(pack?.threats).filter((t) => t?.name);
  const nCreatures = Math.min(creatureCap(all.length), threats.length || (density === 'sparse' ? 0 : 1), byFar.length);
  for (let i = 0; i < nCreatures; i++) {
    const th = threats[i % Math.max(1, threats.length)] || { name: u === 'dune' ? 'Hidden assassin' : 'Unknown organism', description: 'Something waits here.' };
    const room = plan[byFar[i].id];
    room.tokens.push({ kind: 'creature', label: clip(th.name, 60), sub: '', glyph: 'claw', hidden: true, locked: false, note: clip(`${th.description || ''} ${th.tactics || ''}`, 300) });
    room.mood = room.mood || (u === 'dune' ? 'watchful' : 'dread');
  }
  // npcs → hidden npc tokens in middle-distance rooms
  const mid = [...rooms].filter((r) => !plan[r.id].tokens.length).sort((a, b) => Math.abs(far(a) - 2) - Math.abs(far(b) - 2) || a.id.localeCompare(b.id));
  const npcs = arr(pack?.npcs).filter((n) => n?.name).slice(0, density === 'dense' ? 6 : density === 'normal' ? 4 : 2);
  npcs.forEach((n, i) => {
    const r = mid[i % Math.max(1, mid.length)];
    if (!r || plan[r.id].tokens.length >= MAX_PER_ROOM) return;
    plan[r.id].tokens.push({ kind: 'npc', label: clip(n.name, 60), sub: clip(n.role, 60), glyph: 'person', hidden: true, locked: false, note: clip(`${n.role || ''}. ${n.behavior || ''}`, 300) });
  });
  // keyLocations → visible objective markers where a room's name matches
  for (const k of arr(pack?.keyLocations)) {
    const kw = new Set(words(k?.name).filter((w) => !STOP.has(w) && w.length > 2));
    let best = null; let score = 0;
    for (const r of rooms) {
      const s = words(r.name).filter((w) => kw.has(w)).length;
      if (s > score) { score = s; best = r; }
    }
    if (best && plan[best.id].tokens.length < MAX_PER_ROOM && !plan[best.id].tokens.some((t) => t.kind === 'marker')) {
      plan[best.id].tokens.push({ kind: 'marker', label: clip(String(k.name).split(/\s+[—-]\s+/).pop(), 60), sub: 'KEY LOCATION', glyph: 'objective', hidden: false, locked: false, note: clip(k.description, 300) });
    }
  }
  // generic items + the odd hazard, by density
  const per = density === 'dense' ? [2, 3] : density === 'normal' ? [1, 2] : [0, 1];
  ids.forEach((id, i) => {
    const room = plan[id];
    let n = per[0] + (rand() < 0.5 ? 1 : 0);
    if (density === 'sparse') n = i % 2 === 0 ? 1 : 0;
    n = Math.min(n, per[1]);
    for (let j = 0; j < n && room.tokens.length < MAX_PER_ROOM; j++) {
      const [label, glyph, note] = ITEMS[u][Math.floor(rand() * ITEMS[u].length)];
      if (room.tokens.some((t) => t.label === label)) continue;
      room.tokens.push({ kind: 'item', label, sub: '', glyph, hidden: false, locked: j === 0 && rand() < 0.25, note });
    }
    if (density !== 'sparse' && rand() < 0.15 && room.tokens.length < MAX_PER_ROOM) {
      const [label, desc] = HAZARDS[u][Math.floor(rand() * HAZARDS[u].length)];
      room.tokens.push({ kind: 'hazard', label, sub: '', glyph: 'hazard', hidden: false, locked: false, note: desc });
      room.hazard = desc;
    }
  });
  // checks where something is at stake
  for (const id of ids) {
    const room = plan[id];
    const kind = room.tokens.some((t) => t.kind === 'creature') ? 'creature' : room.tokens.some((t) => t.kind === 'hazard') ? 'hazard' : null;
    if (!kind) continue;
    const [skill, difficulty, label] = CHECKS[u][kind];
    if (!hasSkill(skill)) continue;
    room.check = { skill, difficulty, label, success: kind === 'creature' ? 'They notice it before it notices them.' : 'They get through unharmed.', failure: kind === 'creature' ? 'It knows they are here.' : 'It costs them: a minor injury or lost gear.' };
  }
  // global caps
  let total = 0;
  for (const id of ids) {
    const room = plan[id];
    room.tokens = room.tokens.slice(0, Math.max(0, Math.min(MAX_PER_ROOM, MAX_PLAN_TOKENS - total)));
    total += room.tokens.length;
  }
  return plan;
}

/* ── Model prompt ──────────────────────────────────────────────── */

/** → { system, user } for one batch of rooms. Pure. */
export function buildPrompt({ pack, universe, mapDef, density, batch, creatureBudget, spawn }) {
  const persona = personaFor(universe?.id);
  const skills = skillsOf(universe);
  const range = difficultyRange(universe?.id);
  const system = [
    `You are the scenario designer for a ${universe?.name || universe?.id || 'tabletop'} role-playing game session. You dress a map for the game master: what each room holds, who or what lurks there, and how it feels to walk in.`,
    'Answer with ONE JSON object and nothing else: no prose, no markdown, no code fences.',
    '',
    'JSON shape:',
    '{"rooms":{"<room id>":{"mood":"one or two words","description":"2-3 sentences","tokens":[{"kind":"item|creature|npc|marker|hazard","label":"short name","sub":"optional short tag","glyph":"one glyph name","hidden":true|false,"locked":true|false,"note":"what it is and what it does"}],"check":{"skill":"skill id","difficulty":0,"label":"what the roll is for","success":"what happens on a success","failure":"what happens on a failure"},"hazard":"optional","loot":"optional"}}}',
    '(note, check success/failure, hazard and loot are read only by the game master: write their real content, never the words "GM only".)',
    '',
    'Rules:',
    `- Use ONLY the room ids listed under "Rooms to dress". Dress every one of them; a room may have an empty tokens list.`,
    `- Density: ${DENSITY_RULE[density] || DENSITY_RULE.normal}. Never more than ${MAX_PER_ROOM} tokens in one room.`,
    `- At most ${creatureBudget} creature token(s) in this answer, never in the starting room${spawn.length ? ` (${spawn.join(', ')})` : ''}. Creatures and NPCs are usually hidden:true (the GM reveals them); items and markers are usually hidden:false.`,
    '- Items that matter to the story get locked:true so the game master decides when they can be taken.',
    `- glyph must be one of: ${GLYPHS.join(', ')}.`,
    `- check is optional: give one to at most one room in three, only where something is really at stake. skill must be one of these ids: ${skills.map((s) => `${s.key} (${s.label})`).join(', ') || 'none'}. difficulty is ${range.text}.`,
    '- description: read-aloud, present tense, second person, in the universe\'s voice, at most 3 short sentences; what the characters perceive when they step in. It must not mention, hint at the place of, or name anything with hidden:true, nor any secret or twist.',
    '- creature means a living threat; corpses, remains and scenery are markers or items.',
    '- Use the scenario\'s own threats, NPCs and locations where they fit; invent the rest in keeping with the setting. Original prose only.',
    '',
    'Voice for descriptions:',
    ...persona.tone.map((l) => `- ${l}`),
  ].join('\n');
  const L = [];
  if (pack?.meta) {
    L.push(`Scenario: ${clip(pack.meta.title, 120)}${pack.meta.tagline ? ` — ${clip(pack.meta.tagline, 200)}` : ''}`);
    if (pack.meta.synopsis) L.push(`Synopsis (GM only): ${clip(pack.meta.synopsis, 700)}`);
    if (pack.meta.tone) L.push(`Tone: ${clip(pack.meta.tone, 300)}`);
  } else L.push('No scenario pack: a free-form session.');
  const threats = arr(pack?.threats).filter((t) => t?.name).slice(0, 8);
  if (threats.length) L.push(`Threats: ${threats.map((t) => `${clip(t.name, 60)} — ${clip(t.description, 160)}${t.tactics ? ` Tactics: ${clip(t.tactics, 160)}` : ''}`).join(' | ')}`);
  const npcs = arr(pack?.npcs).filter((n) => n?.name).slice(0, 10);
  if (npcs.length) L.push(`NPCs: ${npcs.map((n) => `${clip(n.name, 60)}${n.role ? ` (${clip(n.role, 80)})` : ''}${n.behavior ? `: ${clip(n.behavior, 140)}` : ''}`).join(' | ')}`);
  const keys = arr(pack?.keyLocations).filter((k) => k?.name).slice(0, 10);
  if (keys.length) L.push(`Key locations: ${keys.map((k) => `${clip(k.name, 60)}: ${clip(k.description, 140)}`).join(' | ')}`);
  const acts = arr(pack?.acts);
  if (acts.length) L.push(`Acts and scenes: ${acts.map((a) => `${clip(a.title, 60)} [${arr(a.scenes).map((s) => clip(s.name, 50)).join('; ')}]`).join(' / ')}`);
  L.push('');
  L.push(`Map: ${clip(mapDef?.title || mapDef?.id, 120)}${mapDef?.subtitle ? ` — ${clip(mapDef.subtitle, 160)}` : ''}`);
  const allRooms = arr(mapDef?.rooms);
  L.push(`All rooms (for orientation): ${allRooms.map((r) => `${r.id} "${clip(r.name, 40)}"${r.level ? ` [${r.level}]` : ''}`).join(', ')}`);
  const batchIds = new Set(batch.map((r) => r.id));
  const doors = arr(mapDef?.doors).filter((d) => batchIds.has(d.from) || batchIds.has(d.to)).slice(0, 80);
  if (doors.length) L.push(`Doors: ${doors.map((d) => `${d.from} <-> ${d.to}${d.locked ? ' (locked)' : ''}`).join(', ')}`);
  L.push('');
  L.push('Rooms to dress in this answer (id, name, level, GM note):');
  for (const r of batch) L.push(`- ${r.id} | ${clip(r.name, 60)}${r.level ? ` | ${r.level}` : ''}${r.note ? ` | ${clip(r.note, 300)}` : ''}`);
  L.push('');
  L.push(`Return the JSON object now, with exactly these ${batch.length} room ids as keys of "rooms".`);
  return { system, user: L.join('\n') };
}

/* ── Generate ──────────────────────────────────────────────────── */

async function chatOnce(cfg, prompt, { signal, json = true, nudge = false, onChars }) {
  let raw = '';
  const user = nudge ? `${prompt.user}\n\nYour previous answer was not valid JSON. Answer with ONLY the JSON object, starting with { and ending with }.` : prompt.user;
  for await (const chunk of streamChat(cfg, {
    system: prompt.system, user, maxTokens: 4096, signal, temperature: 0.7,
    body: json ? { response_format: { type: 'json_object' } } : null,
  })) {
    raw += chunk;
    onChars?.(raw.length);
  }
  return raw;
}

/** Resolve the map to dress: the board's own map, or (mapId) one of the universe's / pack's maps with room shapes. */
export function resolveMap(game, mapId, { universe, pack } = {}) {
  if (!mapId || mapId === game?.board?.mapId) return game?.mapDef || null;
  const cands = [...arr(universe?.maps), ...arr(pack?.maps)].filter((m) => m?.id === mapId);
  for (const m of cands) {
    const { mapDef } = sanitizeMapDef({ ...m, kind: m.kind === 'engine' || m.engine !== undefined ? 'engine' : m.kind, engine: m.id });
    if (mapDef?.rooms?.length) return mapDef;
  }
  return null;
}

/**
 * → { plan, provider:'local'|'template'|'mixed', model, warning? }
 * opts: { game, pack, universe, mapDef, density, cfg?, signal?, onStatus?, onProgress? }
 */
export async function generatePlan({ game, pack, universe, mapDef, density: d, cfg: cfgIn, signal, onStatus = () => {}, onProgress = () => {} } = {}) {
  const density = DENSITIES.includes(d) ? d : 'normal';
  const cfg = cfgIn || gmConfig();
  const rooms = arr(mapDef?.rooms);
  const spawn = spawnRooms(mapDef);
  const skills = skillsOf(universe);
  const seed = [...`${game?.code || ''}|${mapDef?.id || ''}|${density}`].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
  const batches = [];
  for (let i = 0; i < rooms.length; i += BATCH_ROOMS) batches.push(rooms.slice(i, i + BATCH_ROOMS));
  const base = { mapId: mapDef?.id || null, mapTitle: mapDef?.title || mapDef?.id || '', density, at: Date.now(), applied: [] };
  const template = () => templatePlan({ pack, universe, mapDef, density, seed });
  const st = cfg.url ? await gmStatus(cfg) : null;
  if (!st?.ok) {
    onStatus({ provider: 'template', model: 'template', batches: batches.length, rooms: rooms.length });
    const warning = cfg.url ? 'The local AI GM did not answer; this plan is built from the pack.' : undefined;
    return { plan: { ...base, provider: 'template', model: 'template', rooms: template(), ...(warning ? { warning } : {}) }, provider: 'template', model: 'template', ...(warning ? { warning } : {}) };
  }
  onStatus({ provider: 'local', model: cfg.model, batches: batches.length, rooms: rooms.length });
  await releaseForLlm({ comfy: cfg.comfy ?? comfyBase() });
  const out = {};
  let creatures = creatureCap(rooms.length);
  let tokens = MAX_PLAN_TOKENS;
  let fellBack = 0;
  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    const share = Math.max(0, Math.min(creatures, Math.ceil((creatureCap(rooms.length) * batch.length) / Math.max(1, rooms.length)) + (bi === batches.length - 1 ? creatures : 0)));
    const prompt = buildPrompt({ pack, universe, mapDef, density, batch, creatureBudget: share, spawn: [...spawn] });
    onProgress({ batch: bi + 1, of: batches.length, rooms: batch.map((r) => r.id), stage: 'asking' });
    let valid = null;
    let json = true;
    for (let attempt = 0; attempt < 2 && !valid; attempt++) {
      try {
        const raw = await chatOnce(cfg, prompt, { signal, json, nudge: attempt > 0 && json });
        const parsed = extractJson(raw);
        if (!parsed) { console.warn(`[AIBUILD] batch ${bi + 1}: no JSON in the answer (attempt ${attempt + 1})`); continue; }
        const v = validatePlan(parsed, { mapDef, skills, universeId: universe?.id, spawn, allowRooms: new Set(batch.map((r) => r.id)), creatureBudget: share, tokenBudget: tokens, checkBudget: Math.ceil(batch.length * CHECK_SHARE) });
        if (Object.keys(v.rooms).length) valid = v;
        else console.warn(`[AIBUILD] batch ${bi + 1}: no valid room in the answer (attempt ${attempt + 1})`);
      } catch (e) {
        if (signal?.aborted) throw e;
        console.warn(`[AIBUILD] batch ${bi + 1} failed: ${e?.message || e}`);
        if (/HTTP 4\d\d/.test(String(e?.message))) json = false; // an endpoint without response_format: plain retry
        else if (attempt === 0 && /HTTP 5\d\d|fetch failed|ECONNREFUSED/.test(String(e?.message))) break;
      }
    }
    const tpl = valid && Object.keys(valid.rooms).length === batch.length ? null : templatePlan({ pack, universe, mapDef, density, seed: seed + bi, onlyRooms: new Set(batch.map((r) => r.id)) });
    if (!valid) fellBack++;
    for (const r of batch) {
      const room = valid?.rooms[r.id] || tpl?.[r.id];
      if (!room) continue;
      if (!valid?.rooms[r.id]) {
        // template room under the global caps
        let c = creatures;
        room.tokens = room.tokens.filter((t) => t.kind !== 'creature' || (!spawn.has(r.id) && c-- > 0)).slice(0, Math.max(0, Math.min(MAX_PER_ROOM, tokens)));
      }
      creatures -= room.tokens.filter((t) => t.kind === 'creature').length;
      tokens -= room.tokens.length;
      out[r.id] = room;
    }
    onProgress({ batch: bi + 1, of: batches.length, rooms: batch.map((r) => r.id), stage: 'done', fallback: !valid });
  }
  const provider = fellBack === 0 ? 'local' : fellBack === batches.length ? 'template' : 'mixed';
  const warning = provider === 'local' ? undefined : provider === 'template' ? 'The local AI GM gave no usable plan; this plan is built from the pack.' : `The local AI GM failed on ${fellBack} of ${batches.length} room batches; those rooms are built from the pack.`;
  const model = provider === 'template' ? 'template' : cfg.model;
  return { plan: { ...base, provider, model, rooms: out, ...(warning ? { warning } : {}) }, provider, model, ...(warning ? { warning } : {}) };
}

/* ── Apply / clear ─────────────────────────────────────────────── */

const aiTokenId = () => `ai-${randomBytes(6).toString('hex')}`;

/** Re-validate a client-supplied plan against the board map (same rules as the model's). */
export function sanitizePlan(plan, { mapDef, universe }) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return null;
  const v = validatePlan({ rooms: plan.rooms }, { mapDef, skills: skillsOf(universe), universeId: universe?.id });
  if (!Object.keys(v.rooms).length) return null;
  return {
    mapId: mapDef.id, mapTitle: mapDef.title || mapDef.id, density: DENSITIES.includes(plan.density) ? plan.density : 'normal',
    at: Number.isFinite(plan.at) ? plan.at : Date.now(),
    provider: ['local', 'template', 'mixed'].includes(plan.provider) ? plan.provider : 'template',
    model: clip(plan.model, 200) || 'template', applied: [], rooms: v.rooms,
  };
}

/**
 * Place the plan's tokens on the board. → { applied: { rooms, tokens, roomIds, skipped }, plan } | { error, status }
 * opts: { rooms?: [roomId] (default: every room in the plan), keep?: bool (keep the room's existing AI tokens) }
 */
export function applyPlan(game, plan, { rooms: only, keep = false } = {}) {
  const b = game.board;
  const mapDef = game.mapDef;
  if (!b || !mapDef) return { error: 'no_map', status: 400 };
  if (plan.mapId !== b.mapId) return { error: 'map_mismatch', status: 409 };
  const ids = Object.keys(plan.rooms).filter((id) => !Array.isArray(only) || only.includes(id));
  const levels = new Set(arr(mapDef.levels).map((l) => l.id));
  const ctx = { playerIds: new Set(game.players?.keys?.() || []), levels, defaultLevel: b.level };
  const rand = seededRandom(Date.now() & 0xffffffff);
  let placed = 0; let skipped = 0;
  const roomIds = [];
  for (const id of ids) {
    const room = arr(mapDef.rooms).find((r) => r.id === id);
    if (!room) continue;
    if (!keep) for (const [tid, t] of Object.entries(b.tokens)) if (t.ai && t.aiRoom === id) delete b.tokens[tid];
    const avoid = Object.values(b.tokens).filter((t) => t.roomId === id).map((t) => [t.x, t.y]);
    for (const pt of plan.rooms[id].tokens) {
      if (Object.keys(b.tokens).length >= MAX_TOKENS) { skipped++; continue; }
      const p = pointInRoom(mapDef, id, { avoid, rand, jitter: 0.06 });
      if (!p) { skipped++; continue; }
      const tok = sanitizeToken({
        id: aiTokenId(), kind: pt.kind, label: pt.label, sub: pt.sub, glyph: pt.glyph, hidden: pt.hidden,
        ...(pt.kind === 'item' ? { locked: !!pt.locked } : {}), note: pt.note, x: p[0], y: p[1], level: room.level || b.level || null,
      }, null, ctx);
      if (!tok) { skipped++; continue; }
      tok.ai = true;
      tok.aiRoom = id;
      if (!pt.hidden) tok.aiShow = true;
      b.tokens[tok.id] = tok;
      placeToken(b, mapDef, tok);
      avoid.push(p);
      placed++;
    }
    roomIds.push(id);
  }
  plan.applied = [...new Set([...arr(plan.applied), ...roomIds])];
  return { applied: { rooms: roomIds.length, tokens: placed, roomIds, skipped }, plan };
}

/** Remove every AI token from the board. → number removed */
export function clearAiTokens(game) {
  const b = game.board;
  if (!b?.tokens) return 0;
  let n = 0;
  for (const [id, t] of Object.entries(b.tokens)) if (t?.ai) { delete b.tokens[id]; n++; }
  return n;
}

/** Board + table pushes after a build change (no-ops before attachSessions). */
export function publish(game, logText) {
  if (logText) sessionApi.logTo?.(game, 'note', logText);
  sessionApi.touch?.(game);
  sessionApi.emitBoard?.(game);
  sessionApi.emitTable?.(game, { dmOnly: true });
}
