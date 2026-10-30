#!/usr/bin/env node
/* Node smoke checks (no browser). Imports each universe's JSX-free core
   (src/universes/<id>/universe.core.js), asserts the universe-module
   interface, exercises rules.derived.health on bundled characters, checks
   that registry/index files exist, and validates every content pack. */
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import assert from 'assert/strict';
import { validateAll } from './validate-content.mjs';
import { getCatalog, startingGearFor, encumbrance, skillPool, CATALOG_KEYS } from '../src/engine/catalogUtils.js';
import { panicOutcome, tableLookup, poolDefs, poolStart, inRange, ambientPreset } from '../src/engine/mechanicsUtils.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UNIVERSES = join(ROOT, 'src', 'universes');
let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };

/* Keys every universe core must provide (index.js adds navSections,
   rules.dice.Roller and content.packs on top — those need JSX/Vite). */
const CORE_KEYS = ['id', 'name', 'tagline', 'terminal', 'theme', 'terms', 'rules', 'careers', 'gear', 'maps', 'generator'];
const TERM_KEYS = ['gm', 'gmShort', 'player', 'players', 'session', 'message', 'broadcast', 'joinPrompt', 'priorities'];
const RULE_KEYS = ['attributes', 'skills', 'derived', 'tracks', 'statusEffects', 'conditions', 'dice', 'creation'];
const REQUIRED_VARS = ['--bg-dark', '--bg-panel', '--bg-card', '--border', '--text', '--text-dim', '--accent', '--accent-glow', '--warn', '--danger', '--success', '--font-display', '--font-mono'];

const registrySrc = readFileSync(join(UNIVERSES, 'index.js'), 'utf8');
ok(/export const universes/.test(registrySrc) && /export function getUniverse/.test(registrySrc) && /DEFAULT_UNIVERSE/.test(registrySrc), 'registry exports universes/getUniverse/DEFAULT_UNIVERSE');

// Iterate every universe registered in src/universes/index.js; every folder must be registered.
const ids = [...registrySrc.matchAll(/from '\.\/([a-z0-9-]+)\/index\.js'/g)].map((m) => m[1]);
const folders = readdirSync(UNIVERSES).filter((d) => statSync(join(UNIVERSES, d)).isDirectory());
ok(ids.includes('alien'), 'alien universe exists');
for (const f of folders) ok(ids.includes(f), `${f}: folder is registered in src/universes/index.js`);
const themeVars = {};

for (const id of ids) {
  const corePath = join(UNIVERSES, id, 'universe.core.js');
  ok(existsSync(corePath), `${id}: universe.core.js exists`);
  ok(existsSync(join(UNIVERSES, id, 'index.js')), `${id}: index.js exists`);
  ok(registrySrc.includes(`./${id}/index.js`), `${id}: registered in src/universes/index.js`);
  ok(new RegExp(`universes = \\{[^}]*\\b${id}\\b`).test(registrySrc), `${id}: listed in the universes object`);
  const { default: u } = await import(pathToFileURL(corePath).href);

  for (const k of CORE_KEYS) ok(u[k] !== undefined, `${id}: core has "${k}"`);
  ok(u.id === id, `${id}: id matches folder`);
  for (const k of ['name', 'subtitle', 'statusLines']) ok(u.terminal[k] !== undefined, `${id}: terminal.${k}`);
  for (const k of TERM_KEYS) ok(u.terms[k] !== undefined, `${id}: terms.${k}`);
  for (const k of RULE_KEYS) ok(u.rules[k] !== undefined, `${id}: rules.${k}`);
  for (const v of REQUIRED_VARS) ok(typeof u.theme.vars[v] === 'string', `${id}: theme.vars ${v}`);
  ok(u.theme.fonts?.display && u.theme.fonts?.mono && u.theme.fonts?.googleCss, `${id}: theme.fonts`);
  ok(typeof u.theme.crt === 'boolean', `${id}: theme.crt boolean`);
  ok(typeof u.rules.derived.health === 'function', `${id}: rules.derived.health is a function`);
  ok(typeof u.rules.dice.kind === 'string', `${id}: rules.dice.kind`);
  ok(Array.isArray(u.rules.tracks) && u.rules.tracks.every((t) => t.key && t.label && t.max !== undefined), `${id}: rules.tracks shape`);
  // attr may be null for systems where any attribute pairs with any skill (e.g. 2d20 drives).
  ok(u.rules.skills.every((s) => s.attr === null || u.rules.attributes.some((a) => a.key === s.attr)), `${id}: every skill maps to an attribute (or null)`);
  if (u.rules.pools !== undefined) {
    ok(Array.isArray(u.rules.pools) && u.rules.pools.every((p) => p.key && p.label && ['players', 'gm'].includes(p.owner)), `${id}: rules.pools shape`);
  }
  themeVars[id] = Object.keys(u.theme.vars);
  ok(typeof u.generator.systemPrompt === 'string', `${id}: generator.systemPrompt`);
  const words = u.generator.systemPrompt.trim().split(/\s+/).length;
  ok(words >= 300 && words <= 600, `${id}: generator.systemPrompt is 300–600 words (got ${words})`);
  ok(Array.isArray(u.maps), `${id}: maps array`);

  // Index file must wire the JSX parts on top of the core.
  const indexSrc = readFileSync(join(UNIVERSES, id, 'index.js'), 'utf8');
  ok(/navSections/.test(indexSrc) && /Roller/.test(indexSrc) && /import\.meta\.glob/.test(indexSrc), `${id}: index.js adds navSections, dice Roller and bundled content`);

  // derived.health on bundled characters
  const contentDir = join(UNIVERSES, id, 'content');
  const packs = existsSync(contentDir)
    ? readdirSync(contentDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(contentDir, f), 'utf8')))
    : [];
  const chars = packs.flatMap((p) => p.characters || []);
  for (const c of chars) {
    const h = u.rules.derived.health(c);
    ok(Number.isInteger(h) && h > 0, `${id}: derived.health(${c.id}) = ${h}`);
    for (const t of u.rules.tracks) {
      const max = typeof t.max === 'function' ? t.max(c) : t.max;
      ok(Number.isFinite(max), `${id}: track ${t.key} max for ${c.id}`);
    }
    for (const k of Object.keys(c.attributes)) ok(u.rules.attributes.some((a) => a.key === k), `${id}: ${c.id} attribute "${k}" is a universe attribute`);
    for (const k of Object.keys(c.skills)) ok(u.rules.skills.some((s) => s.key === k), `${id}: ${c.id} skill "${k}" is a universe skill`);
  }
  // Catalog (character builder / sheet): expected keys, and every career's talents/startingGear ids resolve.
  ok(u.catalog && typeof u.catalog === 'object', `${id}: core exposes catalog`);
  const cat = getCatalog(u);
  for (const k of CATALOG_KEYS) ok(k in u.catalog, `${id}: catalog.${k} present`);
  for (const k of CATALOG_KEYS.filter((k) => k !== 'rules')) ok(Array.isArray(cat[k]), `${id}: getCatalog().${k} is an array`);
  const talentIds = new Set(cat.talents.map((t) => t.id));
  for (const c of cat.careers) {
    for (const t of c.talents || []) ok(talentIds.has(t), `${id}: career ${c.id} talent "${t}" resolves`);
    const sg = startingGearFor(c, cat);
    ok(sg.missing.length === 0, `${id}: career ${c.id} startingGear ids resolve (missing: ${sg.missing.join(', ')})`);
  }
  for (const c of chars) {
    const enc = encumbrance(c, u, cat);
    ok(Number.isFinite(enc.used), `${id}: encumbrance(${c.id}) computes`);
    for (const s of u.rules.skills) ok(Number.isFinite(skillPool(c, s.key, u).total), `${id}: skillPool(${c.id}, ${s.key})`);
  }
  ok(typeof u.terms.career === 'string' && typeof u.terms.attributes === 'string', `${id}: terms.career / terms.attributes`);
  ok(typeof u.rules.derived.healthLabel === 'string', `${id}: rules.derived.healthLabel`);

  if (id === 'alien') {
    const miller = chars.find((c) => c.id === 'cpt-miller');
    ok(miller && u.rules.derived.health(miller) === miller.attributes.str, 'alien: health == STR for cpt-miller');
    // Mechanics wave: panic table + supplies + initiative cards
    ok(u.rules.panic && u.rules.panic.die === 6 && u.rules.panic.table === 'catalog.panic', 'alien: rules.panic');
    for (let t = 1; t <= 20; t++) ok(panicOutcome(u, t)?.entry, `alien: panic total ${t} resolves`);
    ok(panicOutcome(u, 4).effect.status.length === 0, 'alien: panic 1-6 keeps it together (no status)');
    const fr = panicOutcome(u, 10).effect;
    ok(fr.id === 'freeze' && fr.status.includes('PANICKED') && fr.status.includes('FREEZE') && fr.stressDelta === 1, 'alien: panic 10 = Freeze (+1 stress, panic action)');
    ok(panicOutcome(u, 11).effect.stressDelta === -1, 'alien: seek cover nets -1 stress to the roller');
    ok(panicOutcome(u, 19).effect.id === 'catatonic', 'alien: 15+ = catatonic');
    ok(Array.isArray(u.rules.supplies) && u.rules.supplies.includes('air'), 'alien: rules.supplies');
    ok(u.rules.initiative?.mode === 'cards' && u.rules.initiative.deck === 10, 'alien: initiative cards 1-10');
    const human = (u.catalog.injuries || []).filter((i) => i.table === 'human');
    for (const r of [11, 36, 66]) ok(tableLookup(human, r), `alien: injury d66 ${r} resolves`);
  }
  if (id === 'dune') {
    const defs = poolDefs(u);
    ok(defs.find((d) => d.key === 'momentum')?.max === 6 && defs.find((d) => d.key === 'momentum').visibleToPlayers, 'dune: momentum pool public, max 6');
    ok(defs.find((d) => d.key === 'threat')?.visibleToPlayers === false, 'dune: threat hidden from players');
    ok(poolStart(u, 4).threat === 8, 'dune: starting threat = 2 x players');
    ok(u.rules.initiative?.mode === 'nominate', 'dune: initiative nominate');
  }
  console.log(`✓ ${id}: interface OK, ${packs.length} bundled packs, ${chars.length} characters`);
}

// Every universe defines every theme var the reference universe (alien) defines.
for (const id of ids) {
  const missing = themeVars.alien.filter((v) => !themeVars[id].includes(v));
  ok(missing.length === 0, `${id}: theme.vars missing ${missing.join(', ')}`);
}

ok(inRange('15+', 22) && inRange('1-6', 6) && !inRange('7', 8), 'mechanicsUtils.inRange');
ok(ambientPreset('ship-hum') === 'ship' && ambientPreset('wind') === 'wind' && ambientPreset('nope') === null, 'mechanicsUtils.ambientPreset');

const { total, failures } = validateAll({ quiet: true });
ok(failures === 0, `${failures} invalid content pack(s) — run node scripts/validate-content.mjs`);
console.log(`✓ content: ${total} packs valid`);
console.log(`\nSMOKE OK — ${checks} checks passed.`);
