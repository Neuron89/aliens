#!/usr/bin/env node
/* VOICE — server TTS (server/tts.js) + narrate-speak over the socket.
   Never touches a real voice server: a MOCK OpenAI-speech server runs in this
   process (GET /v1/audio/voices, POST /v1/audio/speech → a tiny valid MP3/WAV,
   every request recorded).
   Part 1 (pure): splitText, audioDurationMs (WAV + MP3 + Xing), describeVoice,
     isVoiceId, clampSpeed, ttsStatus with TTS_URL unset → provider 'none'.
   Part 2 (server + mock, temp DATA_DIR):
   - /api/tts/status + /voices list the mock's Kokoro voices
   - POST /speak → { url, ms, parts }, the clip is served with immutable cache headers;
     the same request again is a cache hit (the mock is not called twice)
   - long text is split into ≤ 1200-char parts; > 4000 chars → 413; bad voice / empty → 400
   - the cache is pruned to TTS_CACHE_MAX_FILES
   - socket narrate-speak: target tv → only the board room; gm → only the DM; both → both;
     phones never; player / board sockets rejected; text limit; invalid voice
   - narrate { speak:true } captions AND speaks; the log has a "Voice: " narration line
   - narrate-speak-stop → table-speak-stop to the board + DM, and drops speech still synthesizing
   Part 3 (server, voice server unreachable): status none, /speak 503, narrate-speak → NO VOICE SERVER.
   Usage: node scripts/test-tts.mjs */
import { spawn } from 'child_process';
import { createServer } from 'http';
import { mkdtempSync, rmSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import assert from 'assert/strict';
import { io } from 'socket.io-client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3191;
const PORT_DOWN = 3192;
const MOCK_PORT = 3193;
const DATA = mkdtempSync(join(tmpdir(), 'tts-'));
const DATA_DOWN = mkdtempSync(join(tmpdir(), 'tts-down-'));
const URL = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

/* ─── tiny valid audio ─── */
function fakeMp3(frames) {
  // MPEG-1 layer III, 128 kb/s, 44.1 kHz, no padding: 417-byte frames of silence-ish payload.
  const frame = Buffer.alloc(417);
  frame[0] = 0xff; frame[1] = 0xfb; frame[2] = 0x90; frame[3] = 0x64;
  return Buffer.concat(Array.from({ length: frames }, () => frame));
}
function fakeWav(ms, rate = 24000) {
  const n = Math.round((rate * ms) / 1000);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  return b;
}

/* ─── mock speech server ─── */
const mockLog = [];
const MOCK_VOICES = ['af_heart', 'bf_emma', 'bm_george', 'bm_lewis', 'am_michael'];
const mock = createServer((req, res) => {
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', async () => {
    let json = null;
    try { json = body ? JSON.parse(body) : null; } catch { /* raw */ }
    mockLog.push({ method: req.method, url: req.url, body: json, auth: req.headers.authorization || '' });
    if (req.method === 'GET' && req.url === '/v1/audio/voices') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ voices: MOCK_VOICES }));
    }
    if (req.method === 'POST' && req.url === '/v1/audio/speech') {
      if (!json?.input || json.input.length > 1200) { res.writeHead(400); return res.end('input too long'); }
      if (/SLOW/.test(json.input)) await sleep(500);
      if (/PACED/.test(json.input)) await sleep(120);
      if (/EXPLODE/.test(json.input)) { res.writeHead(500); return res.end('model crashed'); }
      const audio = json.response_format === 'wav' ? fakeWav(500) : fakeMp3(Math.max(3, Math.ceil(json.input.length / 10)));
      res.writeHead(200, { 'Content-Type': json.response_format === 'wav' ? 'audio/wav' : 'audio/mpeg' });
      return res.end(audio);
    }
    res.writeHead(404); res.end();
  });
});

const servers = [];
async function startServer(port, data, env) {
  const s = { proc: null, stderr: '' };
  s.proc = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), DATA_DIR: data, API_TOKEN: '', ANTHROPIC_API_KEY: '', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  servers.push(s);
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('server start timeout')), 10000);
    s.proc.stdout.on('data', (d) => { if (String(d).includes('ONLINE')) { clearTimeout(t); res(); } });
    s.proc.stderr.on('data', (d) => { s.stderr += d; });
    s.proc.on('exit', (c) => { clearTimeout(t); rej(new Error('server exited ' + c + ' ' + s.stderr)); });
  });
  return s;
}
async function stopAll() {
  for (const s of servers) {
    if (!s.proc || s.proc.exitCode !== null) continue;
    s.proc.removeAllListeners('exit');
    const done = new Promise((r) => s.proc.once('exit', r));
    s.proc.kill('SIGKILL');
    await done;
  }
}
const sockets = [];
const connect = (url = URL) => new Promise((res, rej) => {
  const s = io(url, { transports: ['websocket'], reconnection: false });
  sockets.push(s);
  s.on('connect', () => res(s));
  s.on('connect_error', rej);
});
const call = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, res));
const once = (s, ev, ms = 3000, pred = () => true) => new Promise((res, rej) => {
  const t = setTimeout(() => { s.off(ev, h); rej(new Error('timeout waiting for ' + ev)); }, ms);
  const h = (d) => { if (!pred(d)) return; clearTimeout(t); s.off(ev, h); res(d); };
  s.on(ev, h);
});
const collect = (s, ev) => { const arr = []; s.on(ev, (d) => arr.push(d)); return arr; };
const post = (path, body, base = URL) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const speechCalls = () => mockLog.filter((r) => r.url === '/v1/audio/speech');

try {
  /* ═══ Part 1: pure ═══ */
  process.env.TTS_URL = '';            // set (empty) before import: .env never overrides it
  process.env.DATA_DIR = DATA;
  const tts = await import(pathToFileURL(join(ROOT, 'server/tts.js')).href);
  const { EVENT_NAMES } = await import(pathToFileURL(join(ROOT, 'server/guard.js')).href);
  ok(EVENT_NAMES.includes('narrate-speak') && EVENT_NAMES.includes('narrate-speak-stop'), 'narrate-speak + narrate-speak-stop are in EVENT_NAMES');

  const st0 = await tts.ttsStatus({ fresh: true });
  eq([st0.provider, st0.ok, st0.voices.length], ['none', false, 0], 'TTS_URL unset → { provider:none, ok:false, voices:[] }');

  eq(tts.splitText('  Hello   there.\n\n\n\nGeneral Kenobi. '), ['Hello there.\n\nGeneral Kenobi.'], 'short text: one tidy part');
  const para = (n, w) => Array.from({ length: n }, (_, i) => `Sentence ${i} ${w}.`).join(' ');
  const long = [para(30, 'of the first deck'), para(30, 'of the second deck'), para(30, 'of the third deck'), para(5, 'tail')].join('\n\n');
  const parts = tts.splitText(long);
  ok(parts.length >= 3 && parts.every((p) => p.length <= tts.TTS_PART_MAX), `long text → ${parts.length} parts, all ≤ ${tts.TTS_PART_MAX}`);
  eq(parts.join(' ').replace(/\s+/g, ' '), tts.cleanSpeech(long).replace(/\s+/g, ' '), 'split loses no words');
  const wall = 'word '.repeat(700);
  ok(tts.splitText(wall).every((p) => p.length <= 1200) && tts.splitText(wall).length === 3, 'one huge sentence splits on words');

  /* sentence groups (progressive speech) */
  const wc = (x) => x.split(/\s+/).filter(Boolean).length;
  const scene = 'MU/TH/UR 6500 wakes the crew early, reports a ship approaching on sensors, and then quietly withdraws the contact. '
    + 'Anchorpoint Station does not answer hails. Static. Nothing. The star charts put the Montero deep in empty space, far from its route.\n\nWake up.';
  const sg = tts.sentenceParts(scene);
  eq(sg[0], 'MU/TH/UR 6500 wakes the crew early, reports a ship approaching on sensors, and then quietly withdraws the contact.', 'first group = the first full sentence');
  ok(sg.length >= 2 && sg.every((g) => wc(g) <= 35), `scene → ${sg.length} groups of ≤ 35 words (${sg.map(wc).join(', ')})`);
  ok(sg.slice(0, -1).every((g) => wc(g) >= 5), 'short fragments merged (no tiny middle groups)');
  eq(sg.join(' ').replace(/\s+/g, ' '), tts.cleanSpeech(scene).replace(/\s+/g, ' '), 'groups lose no words');
  eq(tts.sentenceParts('Mother is listening.'), ['Mother is listening.'], 'one short sentence → one group');
  const run = Array.from({ length: 90 }, (_, i) => `w${i}`).join(' ');
  ok(tts.sentenceParts(run).every((g) => wc(g) <= 25) && tts.sentenceParts(run).length === 4, 'an unpunctuated run is cut at 25 words');
  const clausy = 'The corridor bends left, the lights stutter, the floor plates ring under your boots, something drips from the ceiling vents, and far behind you a hatch you sealed an hour ago begins, very slowly, to open.';
  ok(tts.sentenceParts(clausy).length >= 2 && tts.sentenceParts(clausy).every((g) => wc(g) <= 25), 'a long sentence is cut at clause boundaries');
  ok(tts.sentenceParts(long).every((g) => g.length <= tts.TTS_PART_MAX && wc(g) <= 35), 'long text → groups within limits');

  eq(tts.audioDurationMs(fakeWav(1500)), 1500, 'WAV duration from the header');
  eq(tts.audioDurationMs(fakeMp3(100)), Math.round(100 * 417 * 8 / 128), 'CBR MP3 duration from the frame header');
  const xing = Buffer.concat([fakeMp3(1), fakeMp3(9)]);
  xing.write('Xing', 4 + 32); xing.writeUInt32BE(1, 40); xing.writeUInt32BE(9, 44);
  eq(tts.audioDurationMs(xing), Math.round(9 * 1152 / 44100 * 1000), 'Xing header frame count wins');
  const id3 = Buffer.concat([Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 10]), Buffer.alloc(10), fakeMp3(10)]);
  eq(tts.audioDurationMs(id3), Math.round(10 * 417 * 8 / 128), 'ID3 tag skipped');
  eq(tts.audioDurationMs(Buffer.from('nope nope nope')), 0, 'unknown bytes → 0');

  eq(tts.describeVoice('bm_george'), { id: 'bm_george', name: 'George — British male', lang: 'en-GB', gender: 'male' }, 'describeVoice bm_george');
  eq(tts.describeVoice('af_heart').lang, 'en-US', 'af_ → en-US');
  ok(tts.isVoiceId('bm_george') && tts.isVoiceId('af_bella(2)+af_heart(1)') && tts.isVoiceId('onyx'), 'voice ids + Kokoro blends accepted');
  ok(!tts.isVoiceId('a b') && !tts.isVoiceId('../x') && !tts.isVoiceId('') && !tts.isVoiceId(5) && !tts.isVoiceId('x'.repeat(300)), 'bad voice ids rejected');
  eq([tts.clampSpeed(0.1), tts.clampSpeed(9), tts.clampSpeed('0.92'), tts.clampSpeed('x', 1)], [0.5, 2, 0.92, 1], 'speed clamped');

  /* ═══ Part 2: server + mock ═══ */
  await new Promise((r) => mock.listen(MOCK_PORT, '127.0.0.1', r));
  await startServer(PORT, DATA, { TTS_URL: `http://127.0.0.1:${MOCK_PORT}/v1`, TTS_API_KEY: 'mock-key', TTS_CACHE_MAX_FILES: '40' });

  const st = await (await fetch(`${URL}/api/tts/status`)).json();
  eq([st.provider, st.ok, st.model, st.format], ['kokoro', true, 'kokoro', 'mp3'], 'status: kokoro, ok, model kokoro, mp3');
  eq(st.voices.map((v) => v.id), [...MOCK_VOICES].sort(), 'status lists the server voices');
  eq(st.voices.find((v) => v.id === 'bf_emma'), { id: 'bf_emma', name: 'Emma — British female', lang: 'en-GB', gender: 'female' }, 'voices described');
  const vz = await (await fetch(`${URL}/api/tts/voices`)).json();
  eq([vz.provider, vz.voices.length], ['kokoro', 5], '/voices');
  const probes = mockLog.filter((r) => r.url === '/v1/audio/voices').length;
  await fetch(`${URL}/api/tts/status`);
  eq(mockLog.filter((r) => r.url === '/v1/audio/voices').length, probes, 'status is cached (no second probe)');
  ok(mockLog.every((r) => r.auth === 'Bearer mock-key'), 'TTS_API_KEY sent as a bearer token');

  const line = 'The airlock cycles. Somewhere below, metal settles against metal.';
  let r = await post('/api/tts/speak', { text: line, voice: 'bm_george', speed: 0.92 });
  let j = await r.json();
  eq(r.status, 200, 'POST /speak → 200');
  ok(/^\/api\/tts\/audio\/[a-f0-9]{40}\.mp3$/.test(j.url) && j.cached === false && j.ms > 0, `speak → url + ms ${j.ms} (not cached)`);
  eq([j.parts.length, j.parts[0].url, j.voice, j.speed], [1, j.url, 'bm_george', 0.92], 'one part, voice + speed echoed');
  const req1 = speechCalls().at(-1).body;
  eq([req1.model, req1.input, req1.voice, req1.response_format, req1.speed], ['kokoro', line, 'bm_george', 'mp3', 0.92], 'provider got { model, input, voice, response_format, speed }');
  const n1 = speechCalls().length;
  const j2 = await (await post('/api/tts/speak', { text: line, voice: 'bm_george', speed: 0.92 })).json();
  eq([j2.url, j2.cached, speechCalls().length], [j.url, true, n1], 'same request → cache hit, provider not called');
  const j3 = await (await post('/api/tts/speak', { text: line, voice: 'bm_lewis', speed: 0.92 })).json();
  ok(j3.url !== j.url && j3.cached === false, 'different voice → different clip');

  const a = await fetch(URL + j.url);
  const bytes = Buffer.from(await a.arrayBuffer());
  eq([a.status, a.headers.get('content-type')], [200, 'audio/mpeg'], 'clip served as audio/mpeg');
  ok(/immutable/.test(a.headers.get('cache-control') || '') && /max-age=31536000/.test(a.headers.get('cache-control')), 'clip has immutable cache headers');
  eq(bytes[0] === 0xff && bytes.length % 417, 0, 'served bytes are the provider audio');
  eq((await fetch(`${URL}/api/tts/audio/..%2F..%2Fpackage.json`)).status, 400, 'path traversal rejected');
  eq((await fetch(`${URL}/api/tts/audio/${'0'.repeat(40)}.mp3`)).status, 404, 'unknown clip → 404');

  const nBefore = speechCalls().length;
  j = await (await post('/api/tts/speak', { text: long })).json();
  const longCalls = speechCalls().slice(nBefore);
  ok(j.parts.length >= 3 && j.parts.length === longCalls.length, `long text → ${j.parts.length} parts / ${longCalls.length} provider calls`);
  ok(longCalls.every((c) => c.body.input.length <= 1200), 'every provider input ≤ 1200 chars');
  eq(j.ms, j.parts.reduce((n, p) => n + p.ms, 0), 'ms = sum of the parts');
  ok(new Set(j.parts.map((p) => p.url)).size === j.parts.length, 'each part its own clip');
  eq((await post('/api/tts/speak', { text: 'x'.repeat(4001) })).status, 413, '> 4000 chars → 413');
  eq((await post('/api/tts/speak', { text: '   ' })).status, 400, 'empty → 400');
  eq((await post('/api/tts/speak', { text: 'hi', voice: '../../etc' })).status, 400, 'bad voice → 400');
  const boom = await post('/api/tts/speak', { text: 'EXPLODE now' });
  eq([boom.status, (await boom.json()).error], [502, 'voice_failed'], 'provider 500 → 502 voice_failed');

  /* SSE (the GM tablet's progressive read-aloud) */
  {
    const paced = Array.from({ length: 5 }, (_, i) => `PACED sentence number ${i} drifts through the vents of the ship while the crew sleeps on.`).join(' ');
    const t0 = Date.now();
    const res = await fetch(`${URL}/api/tts/speak`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify({ text: paced, voice: 'bm_george' }) });
    eq([res.status, (res.headers.get('content-type') || '').split(';')[0]], [200, 'text/event-stream'], 'Accept: text/event-stream → SSE');
    const events = [];
    const dec = new TextDecoder();
    let buf = '';
    for await (const chunk of res.body) {
      buf += dec.decode(chunk, { stream: true });
      let k;
      while ((k = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, k); buf = buf.slice(k + 2);
        const ev = /^event: (.+)$/m.exec(block)?.[1];
        const data = JSON.parse(/^data: (.+)$/m.exec(block)?.[1] || 'null');
        events.push({ ev, data, t: Date.now() - t0 });
      }
    }
    const partsEv = events.filter((x) => x.ev === 'part');
    const doneEv = events.find((x) => x.ev === 'done');
    eq(events[0].ev, 'start', 'SSE starts with start { total }');
    ok(events[0].data.total >= 3 && partsEv.length === events[0].data.total, `SSE: ${partsEv.length} part events = total`);
    eq(partsEv.map((x) => x.data.index), partsEv.map((_, i) => i), 'parts arrive in order');
    ok(partsEv[0].t + 250 < doneEv.t, `first part (${partsEv[0].t} ms) arrives well before done (${doneEv.t} ms) — progressive`);
    eq(doneEv.data.parts.map((p) => p.url), partsEv.map((x) => x.data.url), 'done repeats the parts');
  }

  /* prune: TTS_CACHE_MAX_FILES=40 */
  for (let i = 0; i < 46; i++) await post('/api/tts/speak', { text: `Prune line number ${i}.` });
  await sleep(700);
  const files = readdirSync(join(DATA, 'tts')).filter((f) => /\.mp3$/.test(f));
  ok(files.length <= 40, `cache pruned to ≤ 40 files (${files.length})`);

  /* ── sockets ── */
  const dm = await connect();
  const created = await call(dm, 'create-game', { universeId: 'alien' });
  const code = created.code;
  const p1 = await connect();
  const tv = await connect();
  ok((await call(p1, 'join-game', { code, playerName: 'Alice' })).playerId, 'phone seated');
  ok((await call(tv, 'join-board', { code })).success !== false, 'TV attached');
  const tvSpeak = collect(tv, 'table-speak');
  const p1Speak = collect(p1, 'table-speak');
  const p1Part = collect(p1, 'table-speak-part');
  /** Collect one speech (start, parts, done) as seen by socket `s`. */
  const speechOn = (s, pred = () => true, ms = 5000) => new Promise((res, rej) => {
    let id = null;
    const got = { start: null, parts: [], done: null, t0: Date.now() };
    const t = setTimeout(() => { off(); rej(new Error('timeout waiting for a speech')); }, ms);
    const a = (e) => { if (!id && pred(e)) { id = e.id; got.start = e; } };
    const b = (e) => { if (e.id === id) got.parts.push({ ...e, t: Date.now() - got.t0 }); };
    const c = (e) => { if (e.id === id) { got.done = { ...e, t: Date.now() - got.t0 }; off(); res(got); } };
    const off = () => { clearTimeout(t); s.off('table-speak', a); s.off('table-speak-part', b); s.off('table-speak-done', c); };
    s.on('table-speak', a); s.on('table-speak-part', b); s.on('table-speak-done', c);
  });

  let tvS = speechOn(tv);
  let dmS = speechOn(dm);
  let ack = await call(dm, 'narrate-speak', { gameCode: code, text: 'Mother is listening.', voice: 'bm_george', speed: 0.9, title: 'MU/TH/UR', target: 'tv' });
  ok(ack.success && ack.total === 1 && ack.boards === 1 && ack.target === 'tv' && typeof ack.id === 'string', 'narrate-speak acked at once { success, id, total, target, boards }');
  let sp = await tvS;
  eq([sp.start.id, sp.start.text, sp.start.title, sp.start.voice, sp.start.speed, sp.start.target, sp.start.total, typeof sp.start.at], [ack.id, 'Mother is listening.', 'MU/TH/UR', 'bm_george', 0.9, 'tv', 1, 'number'], 'TV gets table-speak { id, text, title, voice, speed, target, total, at }');
  eq([sp.parts.length, sp.parts[0].index, typeof sp.parts[0].url, sp.parts[0].ms > 0, sp.done.count], [1, 0, 'string', true, 1], 'then table-speak-part { id, index, url, ms } and table-speak-done { id, count }');
  ok((await fetch(URL + sp.parts[0].url)).status === 200, 'the TV can fetch the part');
  const dmSeen = await dmS;
  eq([dmSeen.start.id, dmSeen.start.target, dmSeen.parts.length], [ack.id, 'tv', 1], 'the DM tablet also sees the speech (to track it; it plays only gm/both)');

  const tvBefore = tvSpeak.length;
  dmS = speechOn(dm);
  ack = await call(dm, 'narrate-speak', { gameCode: code, text: 'Only the GM hears this.', target: 'gm' });
  sp = await dmS;
  ok(ack.success && sp.start.target === 'gm' && sp.parts.length === 1, 'target gm → the DM socket gets the speech');
  await sleep(250);
  eq(tvSpeak.length, tvBefore, 'target gm: the TV gets nothing');

  tvS = speechOn(tv);
  dmS = speechOn(dm);
  ack = await call(dm, 'narrate-speak', { gameCode: code, text: 'Everyone hears this.', target: 'both' });
  const [bt, bd] = await Promise.all([tvS, dmS]);
  ok(ack.success && bt.start.id === bd.start.id && bt.start.target === 'both' && bt.parts[0].url === bd.parts[0].url, 'target both → TV and DM get the same speech');
  ack = await call(dm, 'narrate-speak', { gameCode: code, text: 'Default target.' });
  eq(ack.target, 'tv', 'target defaults to tv');
  await speechOn(tv, (e) => e.id === ack.id).catch(() => {});

  /* progressive over the socket */
  const paced = Array.from({ length: 6 }, (_, i) => `PACED line ${i}: the tracker pings once, then twice, and the corridor lights fail one by one.`).join(' ');
  tvS = speechOn(tv, () => true, 8000);
  ack = await call(dm, 'narrate-speak', { gameCode: code, text: paced, target: 'tv' });
  sp = await tvS;
  ok(ack.success && ack.total >= 4 && sp.parts.length === ack.total && sp.done.count === ack.total, `long text → ${ack.total} parts over the socket`);
  eq(sp.parts.map((p) => p.index), sp.parts.map((_, i) => i), 'parts in order');
  ok(sp.parts[0].t + 300 < sp.done.t, `first part at ${sp.parts[0].t} ms, done at ${sp.done.t} ms — progressive`);
  await sleep(200);
  eq([p1Speak.length, p1Part.length], [0, 0], 'phones never get voice');

  eq((await call(p1, 'narrate-speak', { gameCode: code, text: 'hijack' })).error, 'NOT AUTHORIZED.', 'player rejected');
  eq((await call(tv, 'narrate-speak', { gameCode: code, text: 'hijack' })).error, 'NOT AUTHORIZED.', 'board rejected');
  eq((await call(p1, 'narrate-speak-stop', { gameCode: code })).error, 'NOT AUTHORIZED.', 'player cannot stop');
  ok(/max 4000/.test((await call(dm, 'narrate-speak', { gameCode: code, text: 'y'.repeat(4001) })).error), 'socket text limit 4000');
  eq((await call(dm, 'narrate-speak', { gameCode: code, text: '  ' })).error, 'Nothing to say.', 'empty rejected');
  eq((await call(dm, 'narrate-speak', { gameCode: code, text: 'x', voice: 'no way' })).error, 'Invalid voice.', 'invalid voice rejected');
  dmS = speechOn(dm);
  ack = await call(dm, 'narrate-speak', { gameCode: code, text: 'EXPLODE' });
  sp = await dmS;
  ok(ack.success && /^VOICE FAILED/.test(sp.done.error) && sp.done.count === 0, 'provider failure → table-speak-done { error: VOICE FAILED… }');

  /* narrate + speak */
  const tvTable = once(tv, 'table-state', 3000, (d) => d?.table?.narration?.text === 'The lights die.');
  tvS = speechOn(tv, (e) => e.text === 'The lights die.');
  ack = await call(dm, 'narrate', { gameCode: code, text: 'The lights die.', mode: 'caption', speak: true, voice: 'bm_lewis', target: 'tv' });
  const [tState, tSp] = await Promise.all([tvTable, tvS]);
  ok(ack.success && ack.id && ack.speech?.success && ack.speech.total === 1, 'narrate speak:true → ack { id, speech:{ success, id, total } }');
  ok(tState.table.narration.mode === 'caption' && tSp.start.voice === 'bm_lewis' && tSp.parts.length === 1, 'TV got the caption and the voice');
  const plain = await call(dm, 'narrate', { gameCode: code, text: 'Silent caption.' });
  ok(plain.success && plain.speech === undefined, 'narrate without speak does not speak');
  const sync = await call(dm, 'table-sync', {});
  const voiceLines = sync.log.filter((l) => l.type === 'narration' && /^Voice: /.test(l.text));
  ok(voiceLines.some((l) => l.text === 'Voice: MU/TH/UR: Mother is listening.'), 'session log: "Voice: title: text"');
  ok(voiceLines.some((l) => l.text === 'Voice: The lights die.') && sync.log.filter((l) => /The lights die/.test(l.text)).length === 1, 'narrate+speak logged once, as Voice');

  /* stop */
  const sTv = once(tv, 'table-speak-stop');
  const sDm = once(dm, 'table-speak-stop');
  ack = await call(dm, 'narrate-speak-stop', { gameCode: code });
  const [st1, st2] = await Promise.all([sTv, sDm]);
  ok(ack.success && typeof st1.at === 'number' && st2.at === st1.at, 'narrate-speak-stop → table-speak-stop to TV and DM');
  const stopParts = collect(tv, 'table-speak-part');
  const stopDone = collect(tv, 'table-speak-done');
  const slow = Array.from({ length: 6 }, (_, i) => `SLOW sentence ${i} is a line that should be cut off by the stop button soon.`).join(' ');
  ack = await call(dm, 'narrate-speak', { gameCode: code, text: slow, target: 'tv' });
  const queued = await call(dm, 'narrate-speak', { gameCode: code, text: 'Queued behind the slow one.', target: 'tv' });
  ok(ack.success && ack.total >= 4 && queued.success, 'a slow speech and a queued one started');
  await sleep(900);
  const callsAtStop = speechCalls().length;
  await call(dm, 'narrate-speak-stop', { gameCode: code });
  await sleep(1600);
  const sentForSlow = stopParts.filter((p) => p.id === ack.id).length;
  ok(sentForSlow >= 1 && sentForSlow < ack.total, `STOP cut the speech after ${sentForSlow}/${ack.total} parts`);
  ok(speechCalls().length - callsAtStop <= 1, 'the server stopped synthesizing (at most the group in flight finished)');
  eq(stopParts.filter((p) => p.id === queued.id).length + stopDone.filter((d) => d.id === queued.id || d.id === ack.id).length, 0, 'the queued speech was dropped; no done after STOP');
  tvS = speechOn(tv);
  ack = await call(dm, 'narrate-speak', { gameCode: code, text: 'After the stop.' });
  ok(ack.success && (await tvS).parts.length === 1, 'voice works again after a stop');
  ok(!/\[SOCKET\] handler/.test(servers[0].stderr), 'no handler threw');

  /* ═══ Part 3: voice server unreachable ═══ */
  await startServer(PORT_DOWN, DATA_DOWN, { TTS_URL: 'http://127.0.0.1:1/v1' });
  const DOWN = `http://127.0.0.1:${PORT_DOWN}`;
  const sd = await (await fetch(`${DOWN}/api/tts/status`)).json();
  ok(sd.provider === 'none' && sd.ok === false && /unreachable|answer/.test(sd.error), `unreachable → provider none (${sd.error})`);
  const spd = await post('/api/tts/speak', { text: 'hello' }, DOWN);
  eq([spd.status, (await spd.json()).error], [503, 'no_voice_server'], '/speak → 503 no_voice_server');
  const dm2 = await connect(DOWN);
  const g2 = await call(dm2, 'create-game', { universeId: 'dune' });
  eq(await call(dm2, 'narrate-speak', { gameCode: g2.code, text: 'The spice must flow.' }), { error: 'NO VOICE SERVER.', provider: 'none' }, 'narrate-speak → NO VOICE SERVER (no events)');
  const cap = await call(dm2, 'narrate', { gameCode: g2.code, text: 'Caption still works.', speak: true });
  ok(cap.success && cap.speech?.error === 'NO VOICE SERVER.', 'narrate speak:true still captions without a voice server');

  console.log(`\nTTS: ${checks} checks passed.`);
} catch (err) {
  console.error('\nFAILED:', err?.stack || err);
  for (const s of servers) if (s.stderr) console.error('--- server stderr ---\n' + s.stderr.slice(-3000));
  process.exitCode = 1;
} finally {
  for (const s of sockets) s.close();
  await stopAll();
  mock.close();
  for (const d of [DATA, DATA_DOWN]) { try { rmSync(d, { recursive: true, force: true }); } catch { /* windows lock */ } }
}
