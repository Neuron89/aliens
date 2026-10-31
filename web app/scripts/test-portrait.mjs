#!/usr/bin/env node
/* Character portrait regression test (F4, server/portrait.js).
   A tiny local HTTP server mocks ComfyUI (/system_stats, /object_info, /prompt,
   /history, /view, /queue, /interrupt); the real server is spawned against it
   with a temp DATA_DIR. Checks: validation + clamping, universe styles, the
   one-job cap, polling to done, WebP via Pillow (when python has PIL) and the
   PNG fallback, list / img / delete, path safety, API_TOKEN on writes,
   ComfyUI offline → 503, the 180 s timeout (shortened) cancelling the ComfyUI
   job, and that sockets keep answering while a job renders.
   Usage: node scripts/test-portrait.mjs */
import { spawn, spawnSync } from 'child_process';
import { createServer } from 'http';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';
import assert from 'assert/strict';
import { io } from 'socket.io-client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = mkdtempSync(join(tmpdir(), 'portrait-test-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

/* ── tiny valid PNG (16x16 teal) ── */
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function tinyPng(w = 16, h = 16) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const rows = [];
  for (let y = 0; y < h; y++) { rows.push(Buffer.from([0])); for (let x = 0; x < w; x++) rows.push(Buffer.from([0, 180 + (x % 40), 160])); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}
const PNG = tinyPng();

/* ── mock ComfyUI ── */
const mock = { prompts: [], deletes: [], interrupts: 0, hang: false, renderMs: 1500, jobs: new Map() };
const comfy = createServer((req, res) => {
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    const url = new URL(req.url, 'http://x');
    const json = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    if (url.pathname === '/system_stats') return json(200, { system: { os: 'mock', comfyui_version: '0.0.0' }, devices: [] });
    if (url.pathname.startsWith('/object_info/')) {
      const node = url.pathname.split('/').pop();
      const lists = {
        UNETLoader: ['unet_name', ['z_image_turbo_bf16.safetensors']],
        CheckpointLoaderSimple: ['ckpt_name', ['flux1-schnell-fp8.safetensors']],
        CLIPLoader: ['clip_name', ['qwen_3_4b.safetensors']],
        VAELoader: ['vae_name', ['ae.safetensors']],
      };
      const l = lists[node];
      return json(200, l ? { [node]: { input: { required: { [l[0]]: [l[1]] } } } } : {});
    }
    if (url.pathname === '/prompt' && req.method === 'POST') {
      const data = JSON.parse(body);
      const id = `p${mock.prompts.length + 1}`;
      mock.prompts.push(data);
      mock.jobs.set(id, { at: Date.now(), hang: mock.hang });
      return json(200, { prompt_id: id, number: mock.prompts.length });
    }
    if (url.pathname.startsWith('/history/')) {
      const id = decodeURIComponent(url.pathname.split('/').pop());
      const j = mock.jobs.get(id);
      if (!j || j.hang || Date.now() - j.at < mock.renderMs) return json(200, {});
      return json(200, { [id]: { status: { status_str: 'success', completed: true }, outputs: { 10: { images: [{ filename: `${id}.png`, subfolder: 'portraits', type: 'output' }] } } } });
    }
    if (url.pathname === '/view') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
    if (url.pathname === '/queue' && req.method === 'POST') { mock.deletes.push(...(JSON.parse(body).delete || [])); return json(200, {}); }
    if (url.pathname === '/interrupt' && req.method === 'POST') { mock.interrupts++; return json(200, {}); }
    json(404, { error: 'nope' });
  });
});
await new Promise((r) => comfy.listen(0, '127.0.0.1', r));
const COMFY = `http://127.0.0.1:${comfy.address().port}`;

/* ── server under test ── */
let server = null;
let PORT = 0;
let URL_ = '';
async function startServer(env = {}) {
  PORT = 3900 + Math.floor(Math.random() * 90);
  URL_ = `http://127.0.0.1:${PORT}`;
  server = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, COMFY_URL: COMFY, API_TOKEN: '', GM_URL: '', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('server start timeout')), 10000);
    server.stdout.on('data', (d) => { if (String(d).includes('ONLINE')) { clearTimeout(t); res(); } });
    server.stderr.on('data', (d) => { if (!/\[PORTRAIT\]/.test(String(d))) process.stderr.write(d); });
    server.on('exit', (c) => { clearTimeout(t); rej(new Error('server exited ' + c)); });
  });
}
async function killServer() {
  const s = server; server = null;
  if (!s) return;
  s.removeAllListeners('exit');
  const done = new Promise((r) => s.once('exit', r));
  s.kill('SIGKILL');
  await done;
}
const api = async (path, { method = 'GET', body, headers = {} } = {}) => {
  const res = await fetch(URL_ + path, { method, headers: body ? { 'Content-Type': 'application/json', ...headers } : headers, body: body ? JSON.stringify(body) : undefined });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
  return { status: res.status, type, data };
};
async function waitJob(id, ms = 15000) {
  const t0 = Date.now();
  for (;;) {
    const r = await api(`/api/portrait/job/${id}`);
    if (r.data.state === 'done' || r.data.state === 'error') return r.data;
    if (Date.now() - t0 > ms) throw new Error('job did not finish');
    await sleep(250);
  }
}
const hasPillow = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['-c', 'import PIL'], { stdio: 'ignore' }).status === 0;

try {
  /* ── 1. Pillow (or auto) run ── */
  await startServer();
  let r = await api('/api/portrait/status');
  eq(r.status, 200, 'status 200');
  eq(r.data.comfy, true, 'mock ComfyUI is reachable');
  eq(r.data.busy, false, 'not busy at start');

  // validation
  r = await api('/api/portrait', { method: 'POST', body: { universeId: 'alien' } });
  eq(r.status, 400, 'missing characterId → 400');
  r = await api('/api/portrait', { method: 'POST', body: { characterId: 'x', universeId: '../etc' } });
  eq(r.status, 400, 'bad universe id → 400');
  r = await api('/api/portrait', { method: 'POST', body: { characterId: '__proto__', universeId: 'alien' } });
  eq(r.status, 400, 'prototype key as characterId → 400');
  r = await api('/api/portrait', { method: 'POST', body: { characterId: 'a'.repeat(121), universeId: 'alien' } });
  eq(r.status, 400, 'overlong characterId → 400');
  r = await api('/api/portrait', { method: 'POST', body: { characterId: 'x', universeId: 'alien', seed: -4 } });
  eq(r.status, 400, 'negative seed → 400');
  r = await api('/api/portrait', { method: 'POST', body: { characterId: 'x', universeId: 'nowhere' } });
  eq(r.status, 404, 'unknown universe → 404');
  r = await api('/api/portrait', { method: 'GET' });
  eq(r.status, 405, 'GET /api/portrait → 405');
  eq(mock.prompts.length, 0, 'no ComfyUI job queued by rejected requests');

  // ALIEN job
  const longApp = 'grey stubble, <script>alert(1)</script> {"x":1} oil-stained coveralls '.repeat(10);
  r = await api('/api/portrait', { method: 'POST', body: { characterId: 'test-miller', universeId: 'alien', name: 'Cpl. Ada Miller', career: 'Colonial Marine', appearance: longApp, seed: 1234 } });
  eq(r.status, 202, 'POST → 202');
  ok(/^[a-f0-9]{16}$/.test(r.data.id), 'job id returned');
  const jobA = r.data.id;
  const busy = await api('/api/portrait', { method: 'POST', body: { characterId: 'test-other', universeId: 'alien' } });
  eq(busy.status, 429, 'second job while one runs → 429 (concurrency 1)');
  r = await api('/api/portrait/status');
  eq(r.data.busy, true, 'status reports busy');

  // socket server keeps answering while the job renders
  const s = io(URL_, { transports: ['websocket'], reconnection: false });
  await new Promise((res, rej) => { s.on('connect', res); s.on('connect_error', rej); setTimeout(() => rej(new Error('socket timeout')), 3000); });
  const created = await new Promise((res) => s.emit('create-game', { universeId: 'alien' }, res));
  ok(created && (created.code || created.success !== false), 'socket create-game answers during a render');
  s.close();

  const doneA = await waitJob(jobA);
  eq(doneA.state, 'done', 'ALIEN job done');
  eq(doneA.model, 'zimage', 'Z-Image Turbo picked when installed');
  ok(doneA.url.startsWith('/api/portrait/img/alien/test-miller.'), 'url points at the stored portrait');
  const wfA = mock.prompts[0].prompt;
  eq(wfA[1].inputs.unet_name, 'z_image_turbo_bf16.safetensors', 'workflow loads Z-Image Turbo');
  eq(wfA[8].inputs.steps, 8, '8 steps');
  eq(wfA[8].inputs.seed, 1234, 'seed passed through');
  const pA = wfA[5].inputs.text;
  ok(/1979/.test(pA) && /teal and black/.test(pA) && /no text/.test(pA), 'ALIEN style prompt (1979 crew photo, teal-black, no text)');
  ok(/Colonial Marine/.test(pA), 'career in prompt');
  ok(!/Miller/.test(pA), 'character name kept out of the prompt');
  ok(!/[<>{}"]/.test(pA), 'markup / braces stripped from prompt fields');
  ok(pA.length < 300 + 60 + 600, 'appearance clamped');

  r = await api(doneA.url);
  eq(r.status, 200, 'portrait image served');
  if (hasPillow) {
    eq(doneA.format, 'webp', 'Pillow present → WebP');
    eq(r.data.toString('ascii', 0, 4) + r.data.toString('ascii', 8, 12), 'RIFFWEBP', 'served bytes are WebP');
  } else {
    eq(doneA.format, 'png', 'no Pillow → PNG');
  }

  r = await api('/api/portrait/list/alien');
  eq(r.status, 200, 'list 200');
  eq(r.data.portraits.length, 1, 'one alien portrait listed');
  eq(r.data.portraits[0].id, 'test-miller', 'listed by character id');
  eq(r.data.portraits[0].name, 'Cpl. Ada Miller', 'name kept for TV token lookup');
  r = await api('/api/portrait/list/dune');
  eq(r.data.portraits.length, 0, 'dune list empty');

  // DUNE job (id with characters outside the file-safe set)
  r = await api('/api/portrait', { method: 'POST', body: { characterId: 'House Vaszari/Envoy #2', universeId: 'dune', name: 'Envoy', career: 'Mentat', appearance: 'grey hair, red-stained lips' } });
  eq(r.status, 202, 'dune POST → 202');
  const doneD = await waitJob(r.data.id);
  eq(doneD.state, 'done', 'DUNE job done');
  ok(/^\/api\/portrait\/img\/dune\/house-vaszari-envoy-2-[a-f0-9]{8}\.(webp|png)\?v=\d+$/.test(doneD.url), 'unsafe id → slug + hash filename');
  const pD = mock.prompts[1].prompt[5].inputs.text;
  ok(/sand and amber/.test(pD) && /painted portrait|oil painting/.test(pD) && /no text/.test(pD), 'DUNE style prompt (painted, sand and amber, no text)');
  r = await api('/api/portrait/list/dune');
  eq(r.data.portraits[0].id, 'House Vaszari/Envoy #2', 'original id kept in the index');

  // path safety
  r = await api('/api/portrait/img/alien/..%2F..%2Fsessions%2Fx.webp');
  eq(r.status, 400, 'traversal in file name → 400');
  r = await api('/api/portrait/img/alien/nope.webp');
  eq(r.status, 404, 'missing portrait → 404');
  r = await api('/api/portrait/job/0123456789abcdef');
  eq(r.status, 404, 'unknown job → 404');

  // regenerate replaces, delete removes
  r = await api('/api/portrait', { method: 'POST', body: { characterId: 'test-miller', universeId: 'alien', name: 'Cpl. Ada Miller' } });
  const again = await waitJob(r.data.id);
  ok(again.url !== doneA.url, 'regenerate bumps the version');
  const files = readdirSync(join(DATA, 'art', 'portraits', 'alien')).filter((f) => !f.endsWith('.json'));
  eq(files.length, 1, 'one file per character after regenerate');
  r = await api('/api/portrait/alien/test-miller', { method: 'DELETE' });
  eq(r.status, 200, 'DELETE → 200');
  r = await api('/api/portrait/list/alien');
  eq(r.data.portraits.length, 0, 'deleted portrait gone from list');
  r = await api('/api/portrait/alien/test-miller', { method: 'DELETE' });
  eq(r.status, 404, 'second DELETE → 404');
  await killServer();

  /* ── 2. PNG fallback + API token ── */
  await startServer({ PORTRAIT_PYTHON: 'none', API_TOKEN: 'sekret' });
  r = await api('/api/portrait', { method: 'POST', body: { characterId: 'tok-test', universeId: 'alien' } });
  eq(r.status, 401, 'API_TOKEN set: POST without token → 401');
  r = await api('/api/portrait/list/alien');
  eq(r.status, 200, 'API_TOKEN set: reads stay open');
  r = await api('/api/portrait', { method: 'POST', body: { characterId: 'tok-test', universeId: 'alien' }, headers: { 'x-api-token': 'sekret' } });
  eq(r.status, 202, 'with token → 202');
  const doneP = await waitJob(r.data.id);
  eq(doneP.format, 'png', 'Pillow disabled → PNG stored');
  r = await api(doneP.url);
  eq(r.data.subarray(1, 4).toString('ascii'), 'PNG', 'served bytes are PNG');
  r = await api('/api/portrait/alien/tok-test', { method: 'DELETE' });
  eq(r.status, 401, 'DELETE without token → 401');
  await killServer();

  /* ── 3. timeout cancels the ComfyUI job ── */
  await startServer({ PORTRAIT_TIMEOUT_MS: '2500', PORTRAIT_PYTHON: 'none' });
  mock.hang = true;
  const lastPrompt = `p${mock.prompts.length + 1}`;
  r = await api('/api/portrait', { method: 'POST', body: { characterId: 'slow', universeId: 'dune' } });
  eq(r.status, 202, 'hanging job accepted');
  const doneT = await waitJob(r.data.id, 10000);
  eq(doneT.state, 'error', 'hanging job ends in error');
  eq(doneT.error, 'timeout', 'error code timeout');
  await sleep(300);
  ok(mock.deletes.includes(lastPrompt), 'timed-out prompt deleted from the ComfyUI queue');
  ok(mock.interrupts >= 1, 'ComfyUI interrupt sent');
  r = await api('/api/portrait/status');
  eq(r.data.busy, false, 'slot freed after timeout');
  mock.hang = false;
  await killServer();

  /* ── 4. ComfyUI offline ── */
  await startServer({ COMFY_URL: 'http://127.0.0.1:9' });
  r = await api('/api/portrait/status');
  eq(r.data.comfy, false, 'offline ComfyUI reported');
  r = await api('/api/portrait', { method: 'POST', body: { characterId: 'off', universeId: 'alien' } });
  eq(r.status, 503, 'offline → 503');
  eq(r.data.error, 'comfy_offline', 'offline error code');
  r = await api('/api/content');
  eq(r.status, 200, 'rest of the API unaffected while ComfyUI is offline');
  await killServer();

  console.log(`test-portrait: ${checks} checks passed${hasPillow ? '' : ' (no Pillow on this machine: WebP path skipped)'}`);
} catch (e) {
  console.error('FAIL:', e);
  process.exitCode = 1;
} finally {
  if (server) await killServer().catch(() => {});
  comfy.close();
  try { rmSync(DATA, { recursive: true, force: true }); } catch { /* best effort */ }
  if (existsSync(DATA)) { /* windows may hold a handle briefly */ }
}
