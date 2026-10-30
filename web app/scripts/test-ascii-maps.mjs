#!/usr/bin/env node
/* Parse every bundled pack ASCII map (both universes) with the board's
   ASCII map parser and check that the geometry is usable for fog of war:
     - ≥ 80 % of each map's hinted rooms (maps[].rooms) matched to a box/label
     - every detected room has a non-degenerate rect inside 0..1
     - room ids are unique kebab-case (the server rejects anything else)
   Prints a per-map table. Universe-level ASCII maps are listed for
   information (--strict also requires them to pass).
   Usage: node scripts/test-ascii-maps.mjs [--verbose] [--strict] [mapId…] */
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseAsciiMap } from '../src/engine/maps/asciiMap.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const strict = args.includes('--strict');
const only = args.filter((a) => !a.startsWith('--'));
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const entries = [];
for (const u of readdirSync(join(ROOT, 'src', 'universes'))) {
  const dir = join(ROOT, 'src', 'universes', u, 'content');
  if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const pack = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    for (const m of pack.maps || []) {
      if (typeof m.ascii !== 'string' || !m.ascii.trim()) continue;
      entries.push({ universe: u, pack: pack.id, map: m, required: true });
    }
  }
  try {
    const mod = await import(`../src/universes/${u}/maps/index.js`);
    for (const m of mod.maps || mod.default || []) {
      if (typeof m.ascii !== 'string' || !m.ascii.trim()) continue;
      if (entries.some((e) => e.map.id === m.id)) continue;
      entries.push({ universe: u, pack: '(universe)', map: m, required: strict });
    }
  } catch (e) { console.warn(`  (could not load ${u} universe maps: ${e.message})`); }
}

let failures = 0;
const rows = [];
for (const { universe, pack, map, required } of entries) {
  if (only.length && !only.includes(map.id)) continue;
  const hints = map.rooms || [];
  const problems = [];
  let p;
  try { p = parseAsciiMap(map.ascii, hints); } catch (e) { problems.push(`parser threw: ${e.stack || e}`); }
  const matched = p ? hints.length - p.unmatched.length : 0;
  const pct = hints.length ? matched / hints.length : 1;
  if (p) {
    if (pct < 0.8) problems.push(`only ${matched}/${hints.length} hinted rooms matched`);
    const ids = new Set();
    for (const r of p.rooms) {
      const s = r.shape;
      if (!s || s.type !== 'rect' || !(s.w > 0.003) || !(s.h > 0.003) || s.x < 0 || s.y < 0 || s.x + s.w > 1.0001 || s.y + s.h > 1.0001) problems.push(`degenerate rect for ${r.id}: ${JSON.stringify(s)}`);
      if (!ID_RE.test(r.id)) problems.push(`bad id ${r.id}`);
      if (ids.has(r.id)) problems.push(`duplicate id ${r.id}`);
      ids.add(r.id);
    }
    if (!p.rooms.length) problems.push('no rooms detected');
  }
  const ok = !problems.length;
  if (!ok && required) failures++;
  rows.push({ universe, map: map.id, pack, hinted: hints.length, matched, pct, rooms: p?.rooms.length ?? 0, extra: p ? p.rooms.filter((r) => !r.hinted).length : 0,
    doors: p?.doors.length ?? 0, corr: p?.corridors.length ?? 0, unmatched: p?.unmatched || [], ok, required, problems, p });
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('UNIV', 6)}${pad('MAP', 26)}${pad('HINTED', 7)}${pad('MATCHED', 9)}${pad('ROOMS', 6)}${pad('+BOX', 5)}${pad('DOORS', 6)}${pad('CORR', 5)}${pad('', 5)}UNMATCHED`);
for (const r of rows) {
  const flag = r.ok ? 'ok' : r.required ? 'FAIL' : 'info';
  console.log(`${pad(r.universe, 6)}${pad(r.map, 26)}${pad(r.hinted, 7)}${pad(`${r.matched} ${Math.round(r.pct * 100)}%`, 9)}${pad(r.rooms, 6)}${pad(r.extra, 5)}${pad(r.doors, 6)}${pad(r.corr, 5)}${pad(flag, 5)}${r.unmatched.join(', ') || '—'}`);
  for (const pr of r.problems) console.log(`      ! ${pr}`);
  if (verbose && r.p) {
    for (const rm of r.p.rooms) console.log(`      ${rm.hinted ? '·' : '+'} ${pad(rm.id, 36)} ${pad(rm.kind, 9)} ${JSON.stringify(rm.shape)}  ${rm.labelLines.join(' / ')}`);
    for (const d of r.p.doors) console.log(`      door ${d.from} ↔ ${d.to}`);
  }
}
console.log(`\n${rows.length} ASCII maps, ${rows.filter((r) => r.required).length} required, ${failures} failing.`);
process.exit(failures ? 1 : 0);
