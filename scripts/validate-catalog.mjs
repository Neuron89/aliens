#!/usr/bin/env node
/* Validates every universe catalog (web app/src/universes/<id>/catalog/*.json).
   Checks: ids unique (per file, and across weapons/armor/gear), every cross-reference resolves,
   every skill/attribute key exists in that universe's rules.js, every art path exists under
   web app/public, required fields present, description word caps. Universe-specific
   expectations (sources, categories, injury tables, panic table) live in PROFILES.
   Exit code 1 on any error.
   Usage: node scripts/validate-catalog.mjs [universeId] */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'web app');
const UNIVERSES = join(APP, 'src', 'universes');
const PUBLIC = join(APP, 'public');

const PROFILES = {
  alien: {
    sources: ['CRB', 'ACM'], requirePage: true, requireNotes: false, requireArt: false,
    files: ['careers', 'talents', 'weapons', 'armor', 'gear', 'conditions', 'injuries', 'panic', 'creatures', 'rules'],
    weaponCats: ['pistol', 'rifle', 'heavy', 'melee', 'explosive', 'tool'],
    ranges: ['engaged', 'short', 'medium', 'long', 'extreme', null],
    gearCats: ['tools', 'medical', 'comms', 'computer', 'survival', 'food', 'clothing', 'misc', 'drugs', 'pet'],
    requiredConditions: ['starving', 'dehydrated', 'exhausted', 'freezing'],
    injuryTables: ['human', 'synthetic', 'xenomorph'],
    injuryRollCheck: 'd66-human', panicSeq: '1-6,7,8,9,10,11,12,13,14,15+',
  },
  dune: {
    sources: ['custom'], requirePage: false, requireNotes: true, requireArt: true,
    files: ['careers', 'talents', 'weapons', 'armor', 'gear', 'conditions', 'injuries', 'creatures', 'rules'],
    weaponCats: ['blade', 'projectile', 'lasgun', 'assassination', 'heavy'],
    ranges: ['close', 'medium', 'long', 'extreme', null],
    gearCats: ['survival', 'espionage', 'medical', 'substance', 'social', 'vehicle', 'tool'],
    requiredConditions: 'rules.conditions',
    injuryTables: ['consequence'],
    injuryRollCheck: 'd20', panicSeq: null,
    minCounts: { careers: 10, talents: 30, weapons: 20, gear: 40, creatures: 12 },
  },
};

let totalErrors = 0;
const only = process.argv[2];
const ids = readdirSync(UNIVERSES).filter((d) => statSync(join(UNIVERSES, d)).isDirectory() && existsSync(join(UNIVERSES, d, 'catalog')));
for (const id of ids) {
  if (only && id !== only) continue;
  if (!PROFILES[id]) { console.log(`ERROR ${id}: has a catalog/ folder but no PROFILES entry in validate-catalog.mjs`); totalErrors++; continue; }
  console.log(`\n=== ${id} ===`);
  totalErrors += await validateUniverse(id, PROFILES[id]);
}
console.log(totalErrors ? `\nFAILED: ${totalErrors} error(s) across catalogs` : `\nALL CATALOGS OK (${ids.filter((i) => !only || i === only).join(', ')})`);
process.exit(totalErrors ? 1 : 0);

async function validateUniverse(UNIVERSE, P) {
const CAT = join(UNIVERSES, UNIVERSE, 'catalog');
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const load = (f) => {
  const p = join(CAT, f);
  if (!existsSync(p)) { err(`missing file ${f}`); return []; }
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { err(`${f}: invalid JSON (${e.message})`); return []; }
};

const { skills: ruleSkills, attributes: ruleAttrs } = await import(
  pathToFileURL(join(UNIVERSES, UNIVERSE, 'rules.js')).href
);
const { rules: ruleModule } = await import(pathToFileURL(join(UNIVERSES, UNIVERSE, 'rules.js')).href);
const SKILLS = new Set(ruleSkills.map((s) => s.key));
const ATTRS = new Set(ruleAttrs.map((a) => a.key));

const files = P.files;
const data = Object.fromEntries(files.map((f) => [f, load(`${f}.json`)]));

// --- ids: kebab, unique per file; items unique across weapons/armor/gear
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
for (const f of files) {
  if (!Array.isArray(data[f])) { err(`${f}.json is not an array`); continue; }
  const seen = new Set();
  for (const it of data[f]) {
    if (!it.id) { err(`${f}: entry without id (${JSON.stringify(it).slice(0, 60)})`); continue; }
    if (!KEBAB.test(it.id)) err(`${f}: id not kebab-case: ${it.id}`);
    if (seen.has(it.id)) err(`${f}: duplicate id ${it.id}`);
    seen.add(it.id);
    if (f !== 'panic' && f !== 'injuries' && f !== 'rules' && !it.name) err(`${f}/${it.id}: missing name`);
    if (f !== 'injuries' || it.source) {
      if (it.source && !P.sources.includes(it.source)) err(`${f}/${it.id}: bad source ${it.source}`);
    }
    if (['careers', 'talents', 'weapons', 'armor', 'gear', 'creatures', 'conditions'].includes(f)) {
      if (!P.sources.includes(it.source)) err(`${f}/${it.id}: missing/bad source`);
      if (P.requirePage && !Number.isInteger(it.page)) err(`${f}/${it.id}: page must be an integer`);
    }
    if (P.requireNotes && f !== 'rules' && typeof it.notes !== 'string') err(`${f}/${it.id}: notes must be a string`);
    if (P.requireArt && ['careers', 'weapons', 'armor', 'gear', 'creatures'].includes(f) && !it.art) err(`${f}/${it.id}: art required`);
  }
}
const itemIndex = new Map();
for (const f of ['weapons', 'armor', 'gear']) {
  for (const it of data[f]) {
    if (itemIndex.has(it.id)) err(`item id ${it.id} appears in both ${itemIndex.get(it.id)} and ${f}`);
    itemIndex.set(it.id, f);
  }
}
const talentIds = new Set(data.talents.map((t) => t.id));
const careerIds = new Set(data.careers.map((c) => c.id));

// --- effect targets
const checkTarget = (where, t) => {
  if (!t) return err(`${where}: effect without target`);
  const [kind, key] = t.split(':');
  if (kind === 'skill') { if (!SKILLS.has(key)) err(`${where}: unknown skill key in target ${t}`); }
  else if (kind === 'attr') { if (!ATTRS.has(key)) err(`${where}: unknown attribute key in target ${t}`); }
  else if (!['stress', 'damage', 'initiative', 'other', 'health'].includes(kind)) err(`${where}: unknown target ${t}`);
};
const checkEffects = (where, effects) => {
  if (effects == null) return;
  if (!Array.isArray(effects)) return err(`${where}: effects must be an array`);
  for (const e of effects) {
    if (!['buff', 'debuff'].includes(e.kind)) err(`${where}: effect kind must be buff|debuff`);
    if (!e.text) err(`${where}: effect without text`);
    if (e.value != null && typeof e.value !== 'number') err(`${where}: effect value must be a number`);
    checkTarget(where, e.target);
  }
};
const checkSkillMap = (where, obj) => {
  for (const k of Object.keys(obj || {})) if (!SKILLS.has(k)) err(`${where}: unknown skill key ${k}`);
};
const checkArt = (where, p) => {
  if (p == null) return;
  if (typeof p !== 'string' || !p.startsWith('/art/')) return err(`${where}: art path must start with /art/ (${p})`);
  if (!existsSync(join(PUBLIC, ...p.slice(1).split('/')))) err(`${where}: art file not found ${p}`);
};
const words = (s) => (s || '').trim().split(/\s+/).filter(Boolean).length;

// --- careers
for (const c of data.careers) {
  const w = `careers/${c.id}`;
  if (!ATTRS.has(c.keyAttribute)) err(`${w}: bad keyAttribute ${c.keyAttribute}`);
  for (const s of [...(c.keySkills || []), ...(c.requiredSkills || [])]) if (!SKILLS.has(s)) err(`${w}: unknown skill ${s}`);
  if (!c.keySkills?.length) err(`${w}: no keySkills`);
  for (const t of c.talents || []) if (!talentIds.has(t)) err(`${w}: talent ${t} not in talents.json`);
  for (const t of Object.keys(c.talentNotes || {})) if (!talentIds.has(t)) err(`${w}: talentNotes key ${t} not a talent`);
  const sg = c.startingGear || {};
  if (!Array.isArray(sg.fixed) || !Array.isArray(sg.choices)) err(`${w}: startingGear needs fixed[] and choices[][]`);
  for (const id of sg.fixed || []) if (!itemIndex.has(id)) err(`${w}: startingGear.fixed ${id} unresolved`);
  for (const group of sg.choices || []) {
    if (!Array.isArray(group)) { err(`${w}: startingGear.choices entries must be arrays`); continue; }
    for (const id of group) if (!itemIndex.has(id)) err(`${w}: startingGear choice ${id} unresolved`);
  }
  for (const id of Object.keys(sg.quantities || {})) if (!itemIndex.has(id)) err(`${w}: quantities key ${id} unresolved`);
  if (c.parentCareer && !careerIds.has(c.parentCareer)) err(`${w}: parentCareer ${c.parentCareer} unresolved`);
  if (words(c.description) > 40) err(`${w}: description over 40 words (${words(c.description)})`);
  if (!Array.isArray(c.appearanceHints) || !Array.isArray(c.agendaHints)) err(`${w}: hints must be arrays`);
  checkArt(w, c.art);
}

// --- talents
for (const t of data.talents) {
  const w = `talents/${t.id}`;
  if (t.career !== 'general' && !careerIds.has(t.career)) err(`${w}: career ${t.career} unresolved`);
  if (!t.text) err(`${w}: missing text`);
  checkEffects(w, t.effects);
}

// --- weapons
const WCATS = new Set(P.weaponCats);
const RANGES = new Set(P.ranges);
for (const x of data.weapons) {
  const w = `weapons/${x.id}`;
  if (!WCATS.has(x.category)) err(`${w}: bad category ${x.category}`);
  const s = x.stats || {};
  for (const k of ['bonus', 'damage', 'range', 'weight', 'cost']) if (!(k in s)) err(`${w}: stats.${k} missing`);
  for (const k of ['bonus', 'damage', 'weight', 'cost']) if (s[k] != null && typeof s[k] !== 'number') err(`${w}: stats.${k} must be number|null`);
  if (!RANGES.has(s.range)) err(`${w}: bad range ${s.range}`);
  if (s.damage == null && !s.blastPower && !s.fireIntensity && !(x.tags || []).some((t) => ['stun', 'grenade-launcher', 'chemical', 'targeting', 'point-defense'].includes(t)))
    warn(`${w}: no damage, blast or fire value`);
  if (!Array.isArray(x.tags)) err(`${w}: tags must be array`);
  checkEffects(w, x.effects);
  checkArt(w, x.art); checkArt(w, x.artPage);
}

// --- armor
for (const x of data.armor) {
  const w = `armor/${x.id}`;
  for (const k of ['rating', 'weight', 'cost']) if (x[k] != null && typeof x[k] !== 'number') err(`${w}: ${k} must be number|null`);
  checkEffects(w, x.effects);
  for (const id of x.includes || []) if (!itemIndex.has(id)) err(`${w}: includes ${id} unresolved`);
  checkArt(w, x.art); checkArt(w, x.artPage);
}

// --- gear
const GCATS = new Set(P.gearCats);
for (const x of data.gear) {
  const w = `gear/${x.id}`;
  if (!GCATS.has(x.category)) err(`${w}: bad category ${x.category}`);
  for (const k of ['weight', 'cost']) if (x[k] != null && typeof x[k] !== 'number') err(`${w}: ${k} must be number|null`);
  checkEffects(w, x.effects);
  checkSkillMap(w, x.skills);
  checkArt(w, x.art); checkArt(w, x.artPage);
}

// --- conditions / injuries / panic
for (const x of data.conditions) {
  const w = `conditions/${x.id}`;
  if (x.kind !== 'debuff') err(`${w}: kind must be debuff`);
  if (!x.healBy) err(`${w}: missing healBy`);
  checkEffects(w, x.effects);
}
const requiredConditions = P.requiredConditions === 'rules.conditions' ? (ruleModule?.conditions || []) : P.requiredConditions;
for (const req of requiredConditions) if (!data.conditions.some((c) => c.id === req)) err(`conditions: missing ${req}`);
if (P.injuryRollCheck === 'd66-human') {
  const human = data.injuries.filter((i) => i.table === 'human');
  const expectRolls = [];
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) expectRolls.push(`${a}${b}`);
  for (const r of expectRolls) if (!human.some((i) => i.roll === r)) err(`injuries: human table missing roll ${r}`);
} else if (P.injuryRollCheck === 'd20') {
  // every face 1..20 covered exactly once by "n" or "a-b" rolls
  const hits = new Array(21).fill(0);
  for (const i of data.injuries) {
    const m = String(i.roll).match(/^(\d+)(?:-(\d+))?$/);
    if (!m) { err(`injuries/${i.id}: bad roll ${i.roll}`); continue; }
    for (let n = +m[1]; n <= +(m[2] || m[1]); n++) hits[n]++;
  }
  for (let n = 1; n <= 20; n++) if (hits[n] !== 1) err(`injuries: d20 face ${n} covered ${hits[n]} times`);
}
for (const x of data.injuries) {
  const w = `injuries/${x.id}`;
  if (!P.injuryTables.includes(x.table)) err(`${w}: bad table ${x.table}`);
  if (![true, false, 'timed', 'shutdown'].includes(x.fatal)) err(`${w}: bad fatal value`);
  if (x.fatal === true && x.table === 'human' && !x.timeLimit && !/death/i.test(x.text)) err(`${w}: fatal without timeLimit`);
  checkEffects(w, x.effects);
}
if (P.panicSeq) {
  const panicRolls = data.panic.map((p) => p.roll).join(',');
  if (panicRolls !== P.panicSeq) err(`panic: unexpected roll sequence ${panicRolls}`);
  for (const x of data.panic) checkEffects(`panic/${x.id}`, x.effects);
}

// --- creatures
for (const x of data.creatures) {
  const w = `creatures/${x.id}`;
  if (x.stats) {
    checkSkillMap(w, x.stats.skills);
    for (const k of Object.keys(x.stats.attributes || {})) if (!ATTRS.has(k)) err(`${w}: bad attribute ${k}`);
  }
  if (x.statsInWater) checkSkillMap(w, x.statsInWater.skills);
  for (const t of x.talents || []) if (!talentIds.has(t)) err(`${w}: talent ${t} unresolved`);
  for (const a of x.signatureAttacks || []) if (!a.roll || !a.name || !a.text) err(`${w}: incomplete signature attack`);
  checkArt(w, x.art); checkArt(w, x.artPage);
}

// --- rules
for (const r of data.rules) {
  if (!r.text) err(`rules/${r.id}: missing text`);
  for (const s of r.requiredSkills || []) if (!SKILLS.has(s)) err(`rules/${r.id}: unknown skill ${s}`);
  if (Array.isArray(r.value) && /specialty-gear/.test(r.id)) for (const id of r.value) if (!itemIndex.has(id)) err(`rules/${r.id}: item ${id} unresolved`);
}

for (const [f, n] of Object.entries(P.minCounts || {})) if ((data[f] || []).length < n) err(`${f}: expected at least ${n} entries, got ${data[f].length}`);

// --- report
for (const f of files) console.log(`${f.padEnd(11)} ${String(data[f].length).padStart(4)} entries`);
const artCount = ['weapons', 'armor', 'gear', 'creatures'].reduce((n, f) => n + data[f].filter((x) => x.art).length, 0);
const pageCount = ['weapons', 'armor', 'gear', 'creatures'].reduce((n, f) => n + data[f].filter((x) => x.artPage).length, 0);
console.log(`art thumbnails mapped: ${artCount}, full-page art mapped: ${pageCount}`);
for (const m of warnings) console.log(`WARN  ${m}`);
for (const m of errors) console.log(`ERROR ${m}`);
console.log(errors.length ? `${UNIVERSE} FAILED: ${errors.length} error(s), ${warnings.length} warning(s)` : `${UNIVERSE} OK: catalog valid (${warnings.length} warning(s))`);
return errors.length;
}
