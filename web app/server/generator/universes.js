/* Load a universe's JSX-free core (src/universes/<id>/universe.core.js) in Node. */
import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { APP_ROOT } from './env.js';

export const UNIVERSES_DIR = join(APP_ROOT, 'src', 'universes');
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const cache = new Map();

export function listUniverseIds() {
  try {
    return readdirSync(UNIVERSES_DIR).filter((d) => ID_RE.test(d)
      && statSync(join(UNIVERSES_DIR, d)).isDirectory()
      && existsSync(join(UNIVERSES_DIR, d, 'universe.core.js')));
  } catch { return []; }
}

/** Returns the universe core object, or null if unknown. */
export async function loadUniverseCore(id) {
  if (!ID_RE.test(String(id || ''))) return null;
  if (cache.has(id)) return cache.get(id);
  const file = join(UNIVERSES_DIR, id, 'universe.core.js');
  if (!existsSync(file)) return null;
  const mod = await import(pathToFileURL(file).href);
  const core = mod.default || mod;
  cache.set(id, core);
  return core;
}

/** Bundled pack files for a universe (used by the mock generator). */
export function bundledPackFiles(id) {
  const dir = join(UNIVERSES_DIR, id, 'content');
  try { return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => join(dir, f)); } catch { return []; }
}
