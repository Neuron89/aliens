#!/usr/bin/env node
// Asserts that every /art/... path referenced from src/** (and from
// public/art/alien-art-map.json) exists under public/. Exit 1 on any miss.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const ART_RE = /\/art\/[A-Za-z0-9_./-]+\.(?:webp|png|jpe?g|gif|svg|avif)/g;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(m?jsx?|tsx?|json|css|html)$/.test(name)) yield p;
  }
}

const refs = new Map(); // path -> [files]
const add = (path, file) => { if (!refs.has(path)) refs.set(path, []); refs.get(path).push(file); };

for (const file of walk(join(root, 'src'))) {
  for (const m of readFileSync(file, 'utf8').matchAll(ART_RE)) add(m[0], relative(root, file));
}
const mapFile = join(pub, 'art', 'alien-art-map.json');
if (existsSync(mapFile)) {
  for (const url of Object.values(JSON.parse(readFileSync(mapFile, 'utf8')))) add(url, 'public/art/alien-art-map.json');
}

const missing = [...refs].filter(([p]) => !existsSync(join(pub, p)));
for (const [p, files] of missing) console.error(`MISSING ${p}  (from ${[...new Set(files)].join(', ')})`);
console.log(`check-art: ${refs.size} distinct /art paths, ${missing.length} missing`);
process.exit(missing.length ? 1 : 0);
