#!/usr/bin/env node
/* Validate every content pack against server/schema/content-pack.schema.json:
     - bundled: src/universes/<universe>/content/*.json
     - runtime: content/<universe>/*.json  (including content/examples/)
   Also checks: pack.universe matches its folder (except examples), ids are
   unique per universe, file name == <id>.json. Exits non-zero on failure. */
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { validatePack } from '../server/schema/validate.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function dirs(p) {
  return existsSync(p) ? readdirSync(p).filter((d) => statSync(join(p, d)).isDirectory()) : [];
}
function jsonFiles(p) {
  return existsSync(p) ? readdirSync(p).filter((f) => f.endsWith('.json')).map((f) => join(p, f)) : [];
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

export function validateAll({ quiet = false } = {}) {
  const files = collectPackFiles();
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
    }
    if (problems.length) {
      failures++;
      console.error(`✗ ${rel}`);
      for (const p of problems.slice(0, 20)) console.error(`    ${p}`);
    } else if (!quiet) {
      console.log(`✓ ${rel}  [${origin}] ${pack.universe}/${pack.id} (${pack.kind}: ${pack.meta.title})`);
    }
  }
  return { total: files.length, failures };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { total, failures } = validateAll();
  console.log(`\n${total - failures}/${total} packs valid.`);
  process.exit(failures ? 1 : 0);
}
