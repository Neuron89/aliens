/* ═══════════════════════════════════════════════════════════════
   CONTENT PACKS — REST API over web app/content/<universe>/<id>.json

   GET    /api/content                    → { universes: [ids with runtime packs] }
   GET    /api/content/:universe          → { universe, source: 'runtime', packs: [Pack] }
   GET    /api/content/:universe/:id      → Pack
   PUT    /api/content/:universe/:id      → validate + write → { ok, pack }
   DELETE /api/content/:universe/:id      → { ok }

   Only RUNTIME packs live here. Bundled packs ship inside the client
   bundle (src/universes/<id>/content/*.json) and are merged client-side
   by ContentContext; a runtime pack with the same id overrides them.
   ═══════════════════════════════════════════════════════════════ */
import { Router } from 'express';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';
import { validatePack } from './schema/validate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const CONTENT_DIR = process.env.CONTENT_DIR || join(__dirname, '..', 'content');

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RESERVED = new Set(['examples']);

function checkIds(req, res) {
  const { universe, id } = req.params;
  if (!ID_RE.test(universe || '') || RESERVED.has(universe)) {
    res.status(400).json({ error: 'Invalid universe id.' });
    return false;
  }
  if (id !== undefined && !ID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid pack id (kebab-case only).' });
    return false;
  }
  return true;
}

export async function listPacks(universe) {
  const dir = join(CONTENT_DIR, universe);
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
  const packs = [];
  for (const f of files.sort()) {
    try {
      const pack = JSON.parse(await fs.readFile(join(dir, f), 'utf8'));
      const { ok, errors } = validatePack(pack);
      if (!ok) { console.warn(`[CONTENT] Skipping invalid pack ${universe}/${f}: ${errors[0]}`); continue; }
      if (pack.universe !== universe) { console.warn(`[CONTENT] Skipping ${universe}/${f}: universe mismatch`); continue; }
      packs.push(pack);
    } catch (e) {
      console.warn(`[CONTENT] Skipping unreadable pack ${universe}/${f}: ${e.message}`);
    }
  }
  return packs;
}

export function createContentRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const entries = await fs.readdir(CONTENT_DIR, { withFileTypes: true }).catch(() => []);
      const universes = entries.filter((d) => d.isDirectory() && ID_RE.test(d.name) && !RESERVED.has(d.name)).map((d) => d.name);
      res.json({ universes });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/:universe', async (req, res) => {
    if (!checkIds(req, res)) return;
    try {
      const packs = await listPacks(req.params.universe);
      res.json({ universe: req.params.universe, source: 'runtime', packs });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/:universe/:id', async (req, res) => {
    if (!checkIds(req, res)) return;
    try {
      const raw = await fs.readFile(join(CONTENT_DIR, req.params.universe, `${req.params.id}.json`), 'utf8');
      res.json(JSON.parse(raw));
    } catch (e) {
      if (e.code === 'ENOENT') return res.status(404).json({ error: 'Pack not found.' });
      res.status(500).json({ error: e.message });
    }
  });

  router.put('/:universe/:id', async (req, res) => {
    if (!checkIds(req, res)) return;
    const { universe, id } = req.params;
    const pack = req.body;
    if (!pack || typeof pack !== 'object') return res.status(400).json({ error: 'Body must be a JSON pack.' });
    if (pack.id !== id || pack.universe !== universe) {
      return res.status(400).json({ error: `Pack id/universe (${pack.universe}/${pack.id}) must match URL (${universe}/${id}).` });
    }
    // A pack written at runtime is never "bundled".
    if (pack.meta && pack.meta.source === 'bundled') pack.meta.source = 'custom';
    if (pack.meta && !pack.meta.source) pack.meta.source = 'custom';
    const { ok, errors } = validatePack(pack);
    if (!ok) return res.status(422).json({ error: 'Pack failed schema validation.', errors });
    try {
      const dir = join(CONTENT_DIR, universe);
      await fs.mkdir(dir, { recursive: true });
      const file = join(dir, `${id}.json`);
      // Unique tmp name: two saves of the same pack at once never share (and corrupt) one tmp file.
      const tmp = `${file}.${process.pid}-${randomBytes(4).toString('hex')}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(pack, null, 2) + '\n', 'utf8');
      try {
        await fs.rename(tmp, file);
      } catch {
        // Windows can refuse rename-over while a reader holds the file: retry once via unlink.
        try { await fs.unlink(file); await fs.rename(tmp, file); } catch (e2) { await fs.unlink(tmp).catch(() => {}); throw e2; }
      }
      res.json({ ok: true, pack });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.delete('/:universe/:id', async (req, res) => {
    if (!checkIds(req, res)) return;
    try {
      await fs.unlink(join(CONTENT_DIR, req.params.universe, `${req.params.id}.json`));
      res.json({ ok: true });
    } catch (e) {
      if (e.code === 'ENOENT') return res.status(404).json({ error: 'Pack not found.' });
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}

export default createContentRouter;
