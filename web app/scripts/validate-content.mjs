#!/usr/bin/env node
/* Validate every content pack against server/schema/content-pack.schema.json:
     - bundled: src/universes/<universe>/content/*.json
     - runtime: content/<universe>/*.json  (including content/examples/)
   Also checks: pack.universe matches its folder (except examples), ids are
   unique per universe, file name == <id>.json. Exits non-zero on failure.
   Characters are checked against their universe's rules + catalog (characterProblems):
     errors   — unknown career/talent, talent not of the career (unless the universe allows
                general talents), talent text not the catalog text, unknown or missing
                attribute/skill keys, values outside the hard ranges, a fixed attribute array
                (DUNE 8/7/6/5/4) not used exactly once, attribute statements missing for
                universes whose attributes carry a prompt (or pasted into appearance),
                buddy/rival that is not another PC of the pack (or "None"), duplicate names,
                relations[].to (NPCs and characters, intrigue web) that is not an NPC or character
                name/id of the same pack, or that points at its owner.
     warnings — (listed with --warnings) gear that does not resolve to a catalog item, and
                pre-gens beyond the builder's per-career caps (pre-gens are seasoned: skill
                totals may exceed the budget by up to 10, as server/generator/prompt.js says). */
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { validatePack } from '../server/schema/validate.js';
import { getCatalog, careerById, talentForCharacter, talentsFor, itemById, splitTalent } from '../src/engine/catalogUtils.js';
import { capsFor, attrCap, skillCap, isArrayPermutation, sum } from '../src/engine/components/builder/builderState.js';
import { validateParams, actRange } from '../server/generator/params.js';
import { mockOutput } from '../server/generator/__mock__.js';
import { normalizePack, semanticErrors } from '../server/generator/core.js';
import { buildOutputSchema } from '../server/generator/outputSchema.js';
import { relationProblems } from '../src/engine/components/run/intrigueGraph.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function dirs(p) {
  return existsSync(p) ? readdirSync(p).filter((d) => statSync(join(p, d)).isDirectory()) : [];
}
function jsonFiles(p) {
  return existsSync(p) ? readdirSync(p).filter((f) => f.endsWith('.json')).map((f) => join(p, f)) : [];
}

const CORES = {};
for (const u of dirs(join(ROOT, 'src', 'universes'))) {
  const file = join(ROOT, 'src', 'universes', u, 'universe.core.js');
  if (existsSync(file)) CORES[u] = (await import(pathToFileURL(file).href)).default;
}

/** { errors, warnings } for every character of a pack, against its universe's rules + catalog. */
export function characterProblems(pack) {
  const errors = [];
  const warnings = [];
  const core = CORES[pack?.universe];
  const chars = Array.isArray(pack?.characters) ? pack.characters : [];
  if (!core || !chars.length) return { errors, warnings };
  const catalog = getCatalog(core);
  const rules = core.rules || {};
  const creation = rules.creation || {};
  const attrKeys = (rules.attributes || []).map((a) => a.key);
  const skillKeys = (rules.skills || []).map((x) => x.key);
  const prompted = (rules.attributes || []).filter((a) => a.prompt).map((a) => a.key);
  const names = chars.map((c) => c.name);
  const attrHardMax = creation.attrMax ?? 5;
  const skillHardMax = (creation.skillMax ?? 3) + 2;
  for (const c of chars) {
    const at = `characters/${c.id}`;
    const E = (m) => errors.push(`${at}: ${m}`);
    const W = (m) => warnings.push(`${at}: ${m}`);
    if (names.filter((n) => n === c.name).length > 1) E(`duplicate name "${c.name}"`);
    const career = careerById(catalog, c.career);
    if (catalog.careers.length && !career) E(`career "${c.career}" is not in the catalog`);
    const caps = capsFor(core, career);
    for (const k of Object.keys(c.attributes || {})) if (!attrKeys.includes(k)) E(`unknown attribute "${k}"`);
    for (const k of Object.keys(c.skills || {})) if (!skillKeys.includes(k)) E(`unknown skill "${k}"`);
    for (const k of attrKeys) {
      const v = c.attributes?.[k];
      if (!Number.isInteger(v)) E(`attribute ${k} missing`);
      else if (v < caps.attrMin || v > attrHardMax) E(`attribute ${k}=${v} outside ${caps.attrMin}–${attrHardMax}`);
      else if (!caps.attrArray && v > attrCap(caps, career, k)) E(`attribute ${k}=${v} above the cap ${attrCap(caps, career, k)} (only the key attribute may reach ${caps.attrKeyMax})`);
    }
    if (caps.attrArray && !isArrayPermutation(c.attributes, caps.attrArray, attrKeys)) E(`attributes must use ${caps.attrArray.join('/')} once each`);
    if (!caps.attrArray && Math.abs(sum(c.attributes) - caps.attrPoints) > 1) E(`attribute total ${sum(c.attributes)} is not ${caps.attrPoints} (±1)`);
    for (const k of skillKeys) {
      const v = c.skills?.[k];
      if (!Number.isInteger(v)) E(`skill ${k} missing`);
      else if (v < caps.skillMin || v > skillHardMax) E(`skill ${k}=${v} outside ${caps.skillMin}–${skillHardMax}`);
      else if (v > skillCap(caps, career, k)) W(`skill ${k}=${v} above the builder cap ${skillCap(caps, career, k)}`);
    }
    if (sum(c.skills) > caps.skillPoints + 10) E(`skill total ${sum(c.skills)} exceeds ${caps.skillPoints} + 10`);
    if (catalog.talents.length) {
      const t = talentForCharacter(catalog, c);
      if (!t) E(`talent "${splitTalent(c.talent).name}" is not in the catalog`);
      else {
        const allowed = !career || talentsFor(career, catalog).some((x) => x.id === t.id);
        if (!allowed && !(caps.allowGeneralTalents && t.career === 'general')) E(`talent "${t.name}" is not a ${career.name} talent`);
        if (t.text && splitTalent(c.talent).text !== t.text) E(`talent text differs from the catalog text of "${t.name}"`);
      }
    }
    for (const k of prompted) if (!String(c.driveStatements?.[k] || '').trim()) E(`driveStatements.${k} missing`);
    for (const k of Object.keys(c.driveStatements || {})) if (!attrKeys.includes(k)) E(`driveStatements has unknown key "${k}"`);
    if (/DRIVE STATEMENTS/i.test(c.appearance || '')) E('drive statements pasted into appearance (use driveStatements)');
    for (const r of ['buddy', 'rival']) {
      const v = String(c[r] || '').trim();
      if (!v || /^none$/i.test(v)) continue;
      if (v === c.name) E(`${r} is the character themself`);
      else if (!names.includes(v)) E(`${r} "${v}" is not the name of another PC in this pack`);
    }
    for (const g of c.gear || []) if (!itemById(catalog, g)) W(`gear "${g}" is not a catalog item (shown as CUSTOM)`);
  }
  return { errors, warnings };
}

export function collectPackFiles() {
  const files = [];
  for (const u of dirs(join(ROOT, 'src', 'universes'))) {
    for (const f of jsonFiles(join(ROOT, 'src', 'universes', u, 'content'))) files.push({ file: f, folder: u, origin: 'bundled' });
  }
  for (const u of dirs(join(ROOT, 'content'))) {
    for (const f of jsonFiles(join(ROOT, 'content', u))) files.push({ file: f, folder: u, origin: u === 'examples' ? 'example' : 'runtime' });
  }
  return files;
}

export function validateAll({ quiet = false, showWarnings = false } = {}) {
  const files = collectPackFiles();
  let warningCount = 0;
  const seen = new Map(); // `${origin}:${universe}:${id}` -> file
  let failures = 0;
  for (const { file, folder, origin } of files) {
    const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/');
    const problems = [];
    let pack;
    try {
      pack = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      problems.push(`invalid JSON: ${e.message}`);
    }
    if (pack) {
      const { ok, errors } = validatePack(pack);
      if (!ok) problems.push(...errors);
      if (origin !== 'example' && pack.universe !== folder) problems.push(`universe "${pack.universe}" does not match folder "${folder}"`);
      if (origin !== 'example' && basename(file) !== `${pack.id}.json`) problems.push(`file name should be ${pack.id}.json`);
      if (origin === 'bundled' && pack.meta?.source !== 'bundled') problems.push('bundled packs must have meta.source "bundled"');
      const key = `${origin}:${pack.universe}:${pack.id}`;
      if (seen.has(key)) problems.push(`duplicate id "${pack.id}" (also in ${seen.get(key)})`);
      seen.set(key, rel);
      const cp = characterProblems(pack);
      problems.push(...cp.errors);
      problems.push(...relationProblems(pack)); // intrigue web: every relations[].to names a person of this pack
      warningCount += cp.warnings.length;
      if (showWarnings) for (const w of cp.warnings) console.log(`  ! ${rel} ${w}`);
    }
    if (problems.length) {
      failures++;
      console.error(`✗ ${rel}`);
      for (const p of problems.slice(0, 20)) console.error(`    ${p}`);
    } else if (!quiet) {
      console.log(`✓ ${rel}  [${origin}] ${pack.universe}/${pack.id} (${pack.kind}: ${pack.meta.title})`);
    }
  }
  return { total: files.length, failures, warnings: warningCount };
}

/** Self-test of characterProblems: known-bad mutations of a bundled pre-gen must be caught.
    Returns a list of failed expectations (empty = ok). */
export function selfTest() {
  const failed = [];
  const load = (u, id) => JSON.parse(readFileSync(join(ROOT, 'src', 'universes', u, 'content', `${id}.json`), 'utf8'));
  const expect = (label, pack, re) => {
    const { errors } = characterProblems(pack);
    if (!errors.some((e) => re.test(e))) failed.push(`${label}: expected an error matching ${re} (got ${errors.length ? errors.join(' | ') : 'none'})`);
  };
  const mutate = (u, id, fn) => { const p = load(u, id); fn(p.characters[0], p); return p; };
  const clean = (u, id) => { const { errors } = characterProblems(load(u, id)); if (errors.length) failed.push(`${u}/${id} should be clean: ${errors[0]}`); };
  clean('dune', 'the-water-debt');
  clean('alien', 'chariot-of-the-gods');
  expect('dune drive missing', mutate('dune', 'the-water-debt', (c) => { delete c.driveStatements.truth; }), /driveStatements\.truth missing/);
  expect('dune drives in appearance', mutate('dune', 'the-water-debt', (c) => { c.appearance += ' DRIVE STATEMENTS — Duty: x.'; }), /pasted into appearance/);
  expect('dune array', mutate('dune', 'the-water-debt', (c) => { c.attributes.duty = c.attributes.faith; }), /8\/7\/6\/5\/4 once each/);
  expect('dune skill floor', mutate('dune', 'the-water-debt', (c) => { c.skills.move = 3; }), /skill move=3 outside 4/);
  expect('alien talent of other career', mutate('alien', 'chariot-of-the-gods', (c) => { c.talent = 'Banter — x'; }), /not a .* talent/);
  expect('alien talent text', mutate('alien', 'chariot-of-the-gods', (c) => { c.talent = c.talent.replace(/ — .*/, ' — something else'); }), /talent text differs/);
  expect('alien unknown talent', mutate('alien', 'chariot-of-the-gods', (c) => { c.talent = 'Like a Glove — x'; }), /not in the catalog/);
  expect('alien non-key attr', mutate('alien', 'chariot-of-the-gods', (c, p) => { const k = Object.keys(c.attributes).find((a) => a !== 'emp'); c.attributes[k] = 5; c.career = 'Officer'; }), /above the cap 4/);
  expect('alien buddy', mutate('alien', 'chariot-of-the-gods', (c) => { c.buddy = 'Nobody Real'; }), /not the name of another PC/);
  expect('alien rival self', mutate('alien', 'chariot-of-the-gods', (c) => { c.rival = c.name; }), /themself/);
  // Intrigue web (relations[]): every 'to' resolves to an NPC or character of the same pack.
  {
    const p = load('dune', 'the-water-debt');
    if (relationProblems(p).length) failed.push(`dune/the-water-debt relations should be clean: ${relationProblems(p)[0]}`);
    p.npcs[0].relations = [{ to: 'Nobody Of This Pack', kind: 'ally' }];
    if (!relationProblems(p).some((e) => /is not an NPC or character/.test(e))) failed.push('relations: an unknown "to" must be flagged');
    p.npcs[0].relations = [{ to: p.characters[0].id, kind: 'rival' }, { to: p.npcs[0].name, kind: 'ally' }];
    const rp = relationProblems(p);
    if (rp.length !== 1 || !/points at itself/.test(rp[0])) failed.push(`relations: a character id must resolve and a self-relation must be flagged (got ${rp.join(' | ') || 'none'})`);
  }
  expect('alien skill total', mutate('alien', 'chariot-of-the-gods', (c) => { c.skills.comtech = 5; c.skills.survival = 5; c.skills.stamina = 5; }), /skill total \d+ exceeds/);
  // Generator contract: statements are a required, explicit-key field only where attributes carry a prompt,
  // the mock writes legal characters, and the engine checks catch a missing statement.
  for (const [u, core] of Object.entries(CORES)) {
    const { params } = validateParams({ players: 4, playtime: 'session' });
    const acts = actRange(params);
    const schema = buildOutputSchema(core, params, acts);
    const prompted = (core.rules?.attributes || []).filter((a) => a.prompt).map((a) => a.key);
    const ds = schema.$defs.character.properties.driveStatements;
    if (prompted.length && !(ds && schema.$defs.character.required.includes('driveStatements') && prompted.every((k) => ds.required.includes(k)))) failed.push(`${u}: output schema must require driveStatements ${prompted.join('/')}`);
    if (!prompted.length && ds) failed.push(`${u}: output schema should not carry driveStatements`);
    const pack = normalizePack(JSON.parse(mockOutput(core, params)), { universe: core, params, model: 'mock' });
    const sem = semanticErrors(pack, { universe: core, params, acts });
    if (sem.length) failed.push(`${u}: mock pack semantic errors: ${sem[0]}`);
    const cp = characterProblems(pack);
    if (cp.errors.length) failed.push(`${u}: mock characters fail the validator: ${cp.errors[0]}`);
    if (prompted.length) {
      delete pack.characters[0].driveStatements[prompted[0]];
      if (!semanticErrors(pack, { universe: core, params, acts }).some((e) => e.includes('driveStatements'))) failed.push(`${u}: semanticErrors must flag a missing drive statement`);
    }
  }
  return failed;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const showWarnings = process.argv.includes('--warnings');
  const selfFailed = selfTest();
  for (const f of selfFailed) console.error(`✗ self-test: ${f}`);
  const { total, failures, warnings } = validateAll({ showWarnings });
  const tail = warnings ? ` ${warnings} character warning(s)${showWarnings ? '' : ' (run with --warnings to list them)'}.` : '';
  console.log(`\n${total - failures}/${total} packs valid.${tail}${selfFailed.length ? '' : ' Character checks self-test OK.'}`);
  process.exit(failures || selfFailed.length ? 1 : 0);
}
