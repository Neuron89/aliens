/* ═══════════════════════════════════════════════════════════════
   CHARACTER PORTRAITS — local ComfyUI (REST: /api/portrait).

   POST   /api/portrait                 body { characterId, universeId, name?, career?, appearance?, details?, seed? }
          → 202 { id (job id), state: 'queued', ... }
          400 invalid fields · 404 unknown universe · 429 busy (one job at a time)
          503 { error: 'comfy_offline' } when the image server does not answer
   GET    /api/portrait/job/:jobId      → { id, state: queued|rendering|developing|done|error, message, elapsed, url?, error? }
   GET    /api/portrait/status          → { comfy: bool, busy: bool }  (reachability cached 15 s; ?fresh=1 re-checks)
   GET    /api/portrait/list/:universe  → { universe, portraits: [{ id, name, url, v }] }
   GET    /api/portrait/img/:universe/:file   the image (WebP 512 px, or PNG when Pillow is missing)
   DELETE /api/portrait/:universe/:characterId → { ok }

   Storage: <DATA_DIR>/art/portraits/<universe>/<file>.webp|png plus index.json
   (DATA_DIR = the folder deploy-local.ps1 keeps between deploys; PORTRAIT_DIR overrides).
   Writes (POST/DELETE) go through requireApiToken in index.js like /api/generate.
   Everything here is async (fetch + one short child process for the WebP
   convert), so the socket server never blocks. A job is abandoned after
   180 s (PORTRAIT_TIMEOUT_MS) and ComfyUI is asked to drop it.
   Env: COMFY_URL (default http://192.168.1.37:8188), PORTRAIT_PYTHON
   ('none' disables the Pillow convert), PORTRAIT_DIR, PORTRAIT_TIMEOUT_MS.
   Workflows are the ones scripts/gen-dune-art.py and gen-alien-art.py use
   (Z-Image Turbo 8 steps, else flux1-schnell-fp8 4 steps, else SDXL base).
   ═══════════════════════════════════════════════════════════════ */
import { Router } from 'express';
import { promises as fs, existsSync } from 'fs';
import { join, dirname } from 'path';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { randomBytes, randomInt, createHash } from 'crypto';
import { DATA_DIR } from './persistence.js';
import { listUniverseIds } from './generator/universes.js';

const comfyUrl = () => String(process.env.COMFY_URL || 'http://192.168.1.37:8188').replace(/\/+$/, '');
const portraitDir = () => process.env.PORTRAIT_DIR || join(DATA_DIR, 'art', 'portraits');
const timeoutMs = () => Math.max(1000, Number(process.env.PORTRAIT_TIMEOUT_MS) || 180000);

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FILE_RE = /^[a-z0-9][a-z0-9_-]{0,95}\.(webp|png)$/;
const JOB_RE = /^[a-f0-9]{16}$/;
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/* ── Universe styles (original wording; "no text" everywhere: cfg 1.0 models ignore negatives) ── */
const STYLES = {
  alien: {
    lead: 'close-up head and shoulders portrait photograph of a spaceship crew member',
    style: 'grainy 1979 science-fiction film still, candid crew photo, worn utilitarian work clothes, practical cabin lighting, '
      + 'teal and black palette, heavy 35mm film grain, realistic face, looking at the camera, dark background, '
      + 'no text, no logo, no lettering, no name tag',
  },
  dune: {
    lead: 'head and shoulders painted portrait of a desert-world character',
    style: 'oil painting, painterly brushwork, sand and amber palette, warm rim light, dark umber background, '
      + 'epic desert sci-fi, dignified, realistic face, no text, no logo, no lettering, unmarked',
  },
};
const GENERIC = {
  lead: 'head and shoulders character portrait',
  style: 'dramatic lighting, dark background, realistic face, high detail, no text, no logo, no lettering',
};
const NEGATIVE = 'text, letters, watermark, signature, logo, caption, blurry, lowres, deformed, extra limbs, cartoon, frame, border';

/* ── Validation / clamping ───────────────────────────────────── */

/** Printable prompt text: letters, digits and light punctuation only; collapsed; clamped. */
export function cleanText(v, max) {
  if (typeof v !== 'string') return '';
  return v.normalize('NFKC')
    .replace(/[^\p{L}\p{N} ,.'\-()/&]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

/** File stem for a character id: the id itself when it is already safe, else a slug + short hash. */
export function fileStem(characterId) {
  const id = String(characterId);
  if (/^[a-z0-9][a-z0-9_-]{0,79}$/.test(id)) return id;
  const slug = id.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^[-_]+|[-_]+$/g, '').slice(0, 60) || 'c';
  return `${slug}-${createHash('sha1').update(id).digest('hex').slice(0, 8)}`;
}

function validCharacterId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 120 && !/[\u0000-\u001f\u007f]/.test(id) && !BAD_KEYS.has(id);
}

export function validateRequest(body) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const errors = [];
  const characterId = typeof b.characterId === 'string' ? b.characterId.trim() : '';
  if (!validCharacterId(characterId)) errors.push('characterId: required string (1-120 chars)');
  const universeId = typeof b.universeId === 'string' ? b.universeId : '';
  if (!ID_RE.test(universeId)) errors.push('universeId: kebab-case id required');
  let seed = null;
  if (b.seed !== undefined && b.seed !== null) {
    const n = Number(b.seed);
    if (Number.isSafeInteger(n) && n >= 0) seed = n % 2147483647;
    else errors.push('seed: non-negative integer');
  }
  return {
    ok: errors.length === 0,
    errors,
    req: {
      characterId,
      universeId,
      name: cleanText(b.name, 60),
      career: cleanText(b.career, 60),
      appearance: cleanText(b.appearance, 300),
      details: cleanText(b.details, 200),
      seed,
    },
  };
}

/** Prompt for one request. The character's NAME is deliberately left out (models paint names as text). */
export function buildPrompt(req) {
  const s = STYLES[req.universeId] || GENERIC;
  const subject = [req.career && `a ${req.career}`, req.appearance, req.details].filter(Boolean).join(', ');
  return `${s.lead}${subject ? `, ${subject}` : ''}, ${s.style}`;
}

/* ── ComfyUI plumbing ────────────────────────────────────────── */

async function comfyFetch(path, { method = 'GET', body, signal, ms = 15000 } = {}) {
  const sig = signal ? AbortSignal.any([signal, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms);
  return fetch(comfyUrl() + path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: sig,
  });
}
async function comfyJson(path, opts) {
  const res = await comfyFetch(path, opts);
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    const detail = data?.error?.message || data?.error || '';
    throw Object.assign(new Error(`ComfyUI ${path.split('?')[0]} → HTTP ${res.status}${detail ? `: ${String(detail).slice(0, 120)}` : ''}`), { status: res.status });
  }
  return data;
}

let reach = { at: 0, ok: false, pending: null };
/** Is ComfyUI answering? (GET /system_stats, 3 s timeout, cached 15 s.) */
export async function comfyReachable({ fresh = false } = {}) {
  if (!fresh && reach.at && Date.now() - reach.at < 15000) return reach.ok;
  if (reach.pending) return reach.pending;
  reach.pending = (async () => {
    let ok = false;
    try { const d = await comfyJson('/system_stats', { ms: 3000 }); ok = !!(d && typeof d === 'object' && d.system); } catch { ok = false; }
    reach = { at: Date.now(), ok, pending: null };
    return ok;
  })();
  return reach.pending;
}

async function optionList(node, input, signal) {
  try {
    const d = await comfyJson(`/object_info/${node}`, { signal, ms: 8000 });
    const v = d?.[node]?.input?.required?.[input]?.[0];
    return Array.isArray(v) ? v : [];
  } catch (e) {
    if (signal?.aborted) throw e;
    return [];
  }
}

/** Pick the best installed model: Z-Image Turbo → flux1-schnell-fp8 → SDXL base. */
export async function pickModel(signal) {
  const [unets, ckpts, clips, vaes] = await Promise.all([
    optionList('UNETLoader', 'unet_name', signal),
    optionList('CheckpointLoaderSimple', 'ckpt_name', signal),
    optionList('CLIPLoader', 'clip_name', signal),
    optionList('VAELoader', 'vae_name', signal),
  ]);
  if (unets.includes('z_image_turbo_bf16.safetensors') && clips.includes('qwen_3_4b.safetensors') && vaes.includes('ae.safetensors')) return 'zimage';
  if (ckpts.includes('flux1-schnell-fp8.safetensors')) return 'flux';
  if (ckpts.includes('sd_xl_base_1.0.safetensors')) return 'sdxl';
  if (!unets.length && !ckpts.length) return 'flux'; // object_info unavailable: try the classic workflow
  throw Object.assign(new Error('No supported image model is installed on the image server.'), { code: 'no_model' });
}

/** ComfyUI API workflow (same graphs as scripts/gen-dune-art.py / gen-alien-art.py). */
export function workflow(model, prompt, seed, prefix, size = 1024) {
  if (model === 'zimage') {
    return {
      1: { class_type: 'UNETLoader', inputs: { unet_name: 'z_image_turbo_bf16.safetensors', weight_dtype: 'default' } },
      2: { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_3_4b.safetensors', type: 'lumina2' } },
      3: { class_type: 'VAELoader', inputs: { vae_name: 'ae.safetensors' } },
      4: { class_type: 'ModelSamplingAuraFlow', inputs: { model: ['1', 0], shift: 3.0 } },
      5: { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 0], text: prompt } },
      6: { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 0], text: NEGATIVE } },
      7: { class_type: 'EmptySD3LatentImage', inputs: { width: size, height: size, batch_size: 1 } },
      8: { class_type: 'KSampler', inputs: { model: ['4', 0], positive: ['5', 0], negative: ['6', 0], latent_image: ['7', 0], seed, steps: 8, cfg: 1.0, sampler_name: 'res_multistep', scheduler: 'simple', denoise: 1.0 } },
      9: { class_type: 'VAEDecode', inputs: { samples: ['8', 0], vae: ['3', 0] } },
      10: { class_type: 'SaveImage', inputs: { images: ['9', 0], filename_prefix: prefix } },
    };
  }
  const sdxl = model === 'sdxl';
  return {
    1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: sdxl ? 'sd_xl_base_1.0.safetensors' : 'flux1-schnell-fp8.safetensors' } },
    5: { class_type: 'CLIPTextEncode', inputs: { clip: ['1', 1], text: prompt } },
    6: { class_type: 'CLIPTextEncode', inputs: { clip: ['1', 1], text: sdxl ? NEGATIVE : '' } },
    7: { class_type: sdxl ? 'EmptyLatentImage' : 'EmptySD3LatentImage', inputs: { width: size, height: size, batch_size: 1 } },
    8: { class_type: 'KSampler', inputs: { model: ['1', 0], positive: ['5', 0], negative: ['6', 0], latent_image: ['7', 0], seed, steps: sdxl ? 25 : 4, cfg: sdxl ? 6.5 : 1.0, sampler_name: 'euler', scheduler: sdxl ? 'normal' : 'simple', denoise: 1.0 } },
    9: { class_type: 'VAEDecode', inputs: { samples: ['8', 0], vae: ['1', 2] } },
    10: { class_type: 'SaveImage', inputs: { images: ['9', 0], filename_prefix: prefix } },
  };
}

const sleep = (ms, signal) => new Promise((res, rej) => {
  if (signal?.aborted) { rej(signal.reason || new Error('aborted')); return; }
  const t = setTimeout(res, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); rej(signal.reason || new Error('aborted')); }, { once: true });
});

/* ── Pillow convert (child process; PNG fallback) ────────────── */

const PY_CONVERT = [
  'import sys, io',
  'from PIL import Image',
  'im = Image.open(io.BytesIO(sys.stdin.buffer.read())).convert("RGB")',
  'w, h = im.size; s = min(w, h); l = (w - s) // 2; t = (h - s) // 4',
  'im = im.crop((l, t, l + s, t + s)).resize((512, 512), Image.LANCZOS)',
  'b = io.BytesIO(); im.save(b, "WEBP", quality=82, method=6); sys.stdout.buffer.write(b.getvalue())',
].join('\n');

function runPython(cmd, args, input, ms) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { cwd: tmpdir(), stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    } catch { resolve(null); return; }
    const chunks = [];
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* gone */ } }, ms);
    child.stdout.on('data', (d) => chunks.push(d));
    child.on('error', () => { clearTimeout(timer); resolve(null); });
    child.on('close', (code) => { clearTimeout(timer); resolve(code === 0 ? Buffer.concat(chunks) : null); });
    child.stdin.on('error', () => { /* child exited early */ });
    child.stdin.end(input || undefined);
  });
}

let pillow = null; // Promise<string|null>: the python command that has Pillow
export function detectPillow() {
  if (pillow) return pillow;
  pillow = (async () => {
    const env = process.env.PORTRAIT_PYTHON;
    if (env === 'none' || env === '0') return null;
    const cands = env ? [env] : (process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python']);
    for (const c of cands) {
      const out = await runPython(c, ['-c', 'import PIL, sys; sys.stdout.write("ok")'], null, 8000);
      if (out && out.toString() === 'ok') return c;
    }
    return null;
  })();
  return pillow;
}

const isPng = (b) => b && b.length > 8 && b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG';
const isWebp = (b) => b && b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';

/** PNG → { buf, ext }: WebP 512 px through Pillow when available, else the PNG as-is. */
export async function convertPortrait(png) {
  const py = await detectPillow();
  if (py) {
    const out = await runPython(py, ['-c', PY_CONVERT], png, 30000);
    if (isWebp(out)) return { buf: out, ext: 'webp' };
  }
  return { buf: png, ext: 'png' };
}

/* ── Storage ─────────────────────────────────────────────────── */

let ioChain = Promise.resolve();
const serial = (fn) => { const p = ioChain.then(fn, fn); ioChain = p.catch(() => {}); return p; };

async function readIndex(universe) {
  try {
    const data = JSON.parse(await fs.readFile(join(portraitDir(), universe, 'index.json'), 'utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) return Object.create(null);
    const out = Object.create(null);
    for (const [k, v] of Object.entries(data)) if (validCharacterId(k) && v && typeof v === 'object') out[k] = v;
    return out;
  } catch { return Object.create(null); }
}
async function atomicWrite(file, data) {
  await fs.mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}-${randomBytes(4).toString('hex')}.tmp`;
  await fs.writeFile(tmp, data);
  try { await fs.rename(tmp, file); } catch {
    try { await fs.unlink(file); await fs.rename(tmp, file); } catch (e2) { await fs.unlink(tmp).catch(() => {}); throw e2; }
  }
}
const urlFor = (universe, entry) => `/api/portrait/img/${universe}/${entry.file}?v=${Number(entry.v) || 0}`;

async function savePortrait(universe, characterId, name, buf, ext) {
  return serial(async () => {
    const stem = fileStem(characterId);
    const file = `${stem}.${ext}`;
    const dir = join(portraitDir(), universe);
    await atomicWrite(join(dir, file), buf);
    const other = join(dir, `${stem}.${ext === 'webp' ? 'png' : 'webp'}`);
    if (existsSync(other)) await fs.unlink(other).catch(() => {});
    const index = await readIndex(universe);
    const entry = { file, name: name || '', v: Date.now() };
    index[characterId] = entry;
    await atomicWrite(join(dir, 'index.json'), JSON.stringify(index, null, 1));
    return urlFor(universe, entry);
  });
}

async function removePortrait(universe, characterId) {
  return serial(async () => {
    const index = await readIndex(universe);
    const entry = index[characterId];
    if (!entry) return false;
    delete index[characterId];
    const dir = join(portraitDir(), universe);
    if (FILE_RE.test(entry.file || '')) await fs.unlink(join(dir, entry.file)).catch(() => {});
    await atomicWrite(join(dir, 'index.json'), JSON.stringify(index, null, 1));
    return true;
  });
}

/* ── Jobs (one at a time) ────────────────────────────────────── */

const jobs = new Map(); // jobId → job
let activeJob = null;

function publicJob(j) {
  const out = {
    id: j.id, state: j.state, message: j.message, characterId: j.characterId, universeId: j.universeId,
    elapsed: Math.round(((j.endedAt || Date.now()) - j.startedAt) / 100) / 10,
  };
  if (j.url) out.url = j.url;
  if (j.format) out.format = j.format;
  if (j.error) out.error = j.error;
  if (j.model) out.model = j.model;
  return out;
}
function pruneJobs() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [id, j] of jobs) if (j.endedAt && j.endedAt < cutoff) jobs.delete(id);
}

async function runJob(job, req) {
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(Object.assign(new Error('timeout'), { code: 'timeout' })), timeoutMs());
  const signal = controller.signal;
  let promptId = null;
  try {
    job.message = 'CONNECTING TO IMAGE SERVER';
    const model = await pickModel(signal);
    job.model = model;
    const seed = req.seed ?? randomInt(1, 2147483646);
    const prefix = `portraits/${req.universeId}-${fileStem(req.characterId)}-${Date.now().toString(36)}`;
    const sub = await comfyJson('/prompt', { method: 'POST', body: { prompt: workflow(model, buildPrompt(req), seed, prefix), client_id: 'muthur-portrait' }, signal });
    promptId = sub?.prompt_id;
    if (typeof promptId !== 'string' || !promptId) throw new Error('ComfyUI did not return a prompt id.');
    job.state = 'rendering'; job.message = 'RENDERING';
    let image = null;
    while (!image) {
      await sleep(1000, signal);
      const hist = await comfyJson(`/history/${encodeURIComponent(promptId)}`, { signal });
      const entry = hist && typeof hist === 'object' ? hist[promptId] : null;
      if (!entry) continue;
      if (entry.status?.status_str === 'error') throw new Error('The image server reported an error while rendering.');
      for (const node of Object.values(entry.outputs || {})) {
        const img = node?.images?.[0];
        if (img?.filename) { image = img; break; }
      }
      if (!image && entry.status?.completed) throw new Error('The image server finished without an image.');
    }
    job.state = 'developing'; job.message = 'DEVELOPING';
    const q = new URLSearchParams({ filename: String(image.filename), subfolder: String(image.subfolder || ''), type: String(image.type || 'output') });
    const res = await comfyFetch(`/view?${q}`, { signal, ms: 30000 });
    if (!res.ok) throw new Error(`ComfyUI /view → HTTP ${res.status}`);
    const raw = Buffer.from(await res.arrayBuffer());
    if (raw.length > 25 * 1024 * 1024) throw new Error('Image too large.');
    if (!isPng(raw) && !isWebp(raw)) throw new Error('The image server returned something that is not an image.');
    const { buf, ext } = isPng(raw) ? await convertPortrait(raw) : { buf: raw, ext: 'webp' };
    if (signal.aborted) throw signal.reason;
    job.url = await savePortrait(req.universeId, req.characterId, req.name, buf, ext);
    job.format = ext;
    job.state = 'done'; job.message = 'PORTRAIT ON FILE';
  } catch (e) {
    const timedOut = signal.aborted && signal.reason?.code === 'timeout';
    job.state = 'error';
    job.error = timedOut ? 'timeout' : e?.code === 'no_model' ? 'no_model' : 'failed';
    job.message = timedOut ? `NO IMAGE AFTER ${Math.round(timeoutMs() / 1000)} S` : String(e?.message || e).slice(0, 200);
    if (timedOut && promptId) {
      // Best effort: take the job out of ComfyUI's queue / stop it if it is running.
      comfyFetch('/queue', { method: 'POST', body: { delete: [promptId] }, ms: 3000 }).catch(() => {});
      comfyFetch('/interrupt', { method: 'POST', body: { prompt_id: promptId }, ms: 3000 }).catch(() => {});
    }
    if (e?.name === 'TypeError' || e?.cause) reach = { at: 0, ok: false, pending: null }; // network failure: re-check next time
    console.warn(`[PORTRAIT] ${req.universeId}/${req.characterId}: ${job.message}`);
  } finally {
    clearTimeout(deadline);
    job.endedAt = Date.now();
    if (activeJob === job) activeJob = null;
  }
}

/* ── Router ──────────────────────────────────────────────────── */

export function createPortraitRouter() {
  const router = Router();

  router.get('/status', async (req, res) => {
    const comfy = await comfyReachable({ fresh: req.query.fresh === '1' });
    res.set('Cache-Control', 'no-store');
    res.json({ comfy, busy: !!activeJob });
  });

  router.get('/list/:universe', async (req, res) => {
    const u = req.params.universe;
    if (!ID_RE.test(u)) return res.status(400).json({ error: 'Invalid universe id.' });
    const index = await readIndex(u);
    const portraits = Object.entries(index)
      .filter(([, e]) => FILE_RE.test(e.file || ''))
      .map(([id, e]) => ({ id, name: typeof e.name === 'string' ? e.name : '', url: urlFor(u, e), v: Number(e.v) || 0 }));
    res.set('Cache-Control', 'no-cache');
    res.json({ universe: u, portraits });
  });

  router.get('/img/:universe/:file', (req, res) => {
    const { universe, file } = req.params;
    if (!ID_RE.test(universe) || !FILE_RE.test(file)) return res.status(400).json({ error: 'Invalid path.' });
    const full = join(portraitDir(), universe, file);
    if (!existsSync(full)) return res.status(404).json({ error: 'No portrait.' });
    res.set('Cache-Control', 'public, max-age=300');
    res.sendFile(full, { dotfiles: 'deny' });
  });

  router.get('/job/:id', (req, res) => {
    const id = req.params.id;
    const job = JOB_RE.test(id) ? jobs.get(id) : null;
    if (!job) return res.status(404).json({ error: 'Unknown job.' });
    res.set('Cache-Control', 'no-store');
    res.json(publicJob(job));
  });

  router.post('/', async (req, res) => {
    const { ok, errors, req: r } = validateRequest(req.body);
    if (!ok) return res.status(400).json({ error: 'invalid_request', errors });
    if (!listUniverseIds().includes(r.universeId)) return res.status(404).json({ error: 'unknown_universe' });
    const busy = () => res.status(429).json({ error: 'busy', message: 'A portrait is already being generated; try again shortly.' });
    if (activeJob) return busy();
    if (!(await comfyReachable({ fresh: true }))) {
      return res.status(503).json({ error: 'comfy_offline', message: 'The image server (ComfyUI) is not answering.' });
    }
    if (activeJob) return busy(); // another request won the race during the reachability check
    pruneJobs();
    const job = { id: randomBytes(8).toString('hex'), state: 'queued', message: 'QUEUED', startedAt: Date.now(), endedAt: 0, characterId: r.characterId, universeId: r.universeId };
    jobs.set(job.id, job);
    activeJob = job;
    runJob(job, r); // detached: the request returns at once, the client polls /job/:id
    res.status(202).json(publicJob(job));
  });

  router.delete('/:universe/:characterId', async (req, res) => {
    const { universe, characterId } = req.params;
    if (!ID_RE.test(universe) || !validCharacterId(characterId)) return res.status(400).json({ error: 'Invalid ids.' });
    const removed = await removePortrait(universe, characterId);
    if (!removed) return res.status(404).json({ error: 'No portrait.' });
    res.json({ ok: true });
  });

  router.all('/', (req, res) => res.status(405).json({ error: 'Use POST /api/portrait.' }));
  return router;
}

export default createPortraitRouter;
