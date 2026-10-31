#!/usr/bin/env node
/* F3 — soundboard + scene ambience.
   Part 1 (no server): src/engine/soundboard.js against a recording mock AudioContext
   - every stinger/ambience id named by a universe theme exists (theme.sounds.stingers,
     theme.ambient → soundboard AMBIENCE or a legacy preset in hooks/useAmbientAudio.js)
   - every stinger builds without throwing, schedules only finite values, never ramps
     exponentially to ≤ 0 (that throws in real Web Audio) and stops within its `dur`
   - seeded variation: the same seed renders the identical graph, different seeds differ
   - every ambience bed starts, schedules its events and stops cleanly
   Part 2 (server, temp DATA_DIR):
   - DM table-sfx → the board gets { cue, seed, at, phones:false }; phones get nothing
   - phones:true → board and every seated phone get the same seed
   - player / board / unattached sockets are rejected (NOT AUTHORIZED) and nothing is broadcast
   - malformed cues are rejected; a burst is rate limited; seeds differ between shots
   - run-set { ambient } (the AUDIO popover pick) reaches the board as table.ambient
   Usage: node scripts/test-sfx.mjs */
import { spawn } from 'child_process';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import assert from 'assert/strict';
import { io } from 'socket.io-client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4600 + Math.floor(Math.random() * 90);
const DATA = mkdtempSync(join(tmpdir(), 'sfx-'));
const URL = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);

/* ─── recording mock AudioContext ─── */
function mockContext() {
  const log = [];
  let maxStop = 0;
  const bad = [];
  const num = (v) => Math.round(v * 1e4) / 1e4;
  const param = (name, v = 0) => {
    const p = { value: v };
    for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime']) {
      p[m] = (val, t, c) => {
        if (!Number.isFinite(val) || !Number.isFinite(t) || (c !== undefined && !Number.isFinite(c))) bad.push(`${name}.${m}(${val}, ${t})`);
        if (m === 'exponentialRampToValueAtTime' && !(val > 0)) bad.push(`${name}.${m} to ${val}`);
        log.push([name, m, num(val), num(t)]);
        return p;
      };
    }
    p.cancelScheduledValues = () => p;
    return p;
  };
  const node = (kind, params = {}) => {
    const n = { kind, connect: (d) => { log.push([kind, 'connect', d?.kind]); return d; }, disconnect() {} };
    for (const [k, v] of Object.entries(params)) n[k] = param(`${kind}.${k}`, v);
    return n;
  };
  const source = (kind, params) => {
    const n = node(kind, params);
    n.start = (t = 0) => { if (!Number.isFinite(t)) bad.push(`${kind}.start(${t})`); log.push([kind, 'start', num(t)]); };
    n.stop = (t = 0) => { if (!Number.isFinite(t)) bad.push(`${kind}.stop(${t})`); maxStop = Math.max(maxStop, t); log.push([kind, 'stop', num(t)]); };
    return n;
  };
  const ac = {
    sampleRate: 8000, currentTime: 0, state: 'running', destination: { kind: 'destination', connect() {} },
    createGain: () => node('gain', { gain: 1 }),
    createBiquadFilter: () => { const n = node('filter', { frequency: 350, Q: 1, gain: 0 }); n.type = 'lowpass'; return n; },
    createOscillator: () => { const n = source('osc', { frequency: 440, detune: 0 }); n.type = 'sine'; return n; },
    createBufferSource: () => source('buffer', { playbackRate: 1 }),
    createBuffer: (ch, len) => { const data = Array.from({ length: ch }, () => new Float32Array(len)); return { length: len, getChannelData: (i) => data[i] }; },
    createConvolver: () => node('convolver'),
    createDynamicsCompressor: () => node('comp', { threshold: 0, knee: 0, ratio: 1, attack: 0, release: 0 }),
    createStereoPanner: () => node('panner', { pan: 0 }),
    createWaveShaper: () => node('shaper'),
    createDelay: () => node('delay', { delayTime: 0 }),
  };
  return { ac, log, bad, get maxStop() { return maxStop; } };
}

let server = null;
let stderr = '';
async function startServer() {
  server = spawn(process.execPath, ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('server start timeout')), 10000);
    server.stdout.on('data', (d) => { if (String(d).includes('ONLINE')) { clearTimeout(t); res(); } });
    server.stderr.on('data', (d) => { stderr += d; });
    server.on('exit', (c) => { clearTimeout(t); rej(new Error('server exited ' + c)); });
  });
}
async function killServer() {
  const s = server; server = null;
  s.removeAllListeners('exit');
  const done = new Promise((r) => s.once('exit', r));
  s.kill('SIGKILL');
  await done;
}
const sockets = [];
const connect = () => new Promise((res, rej) => {
  const s = io(URL, { transports: ['websocket'], reconnection: false });
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

try {
  /* ═══ Part 1: the synth library ═══ */
  const sb = await imp('src/engine/soundboard.js');
  const { theme: alienTheme } = await imp('src/universes/alien/theme.js');
  const { theme: duneTheme } = await imp('src/universes/dune/theme.js');
  const hookSrc = readFileSync(join(ROOT, 'src/engine/hooks/useAmbientAudio.js'), 'utf8');
  for (const [name, th] of [['alien', alienTheme], ['dune', duneTheme]]) {
    const list = th.sounds?.stingers || [];
    ok(list.length >= 7, `${name}: theme.sounds lists ${list.length} stingers`);
    eq(sb.stingersFor(th), list, `${name}: every theme stinger exists in soundboard.STINGERS`);
    for (const id of th.ambient) ok(new RegExp(`\\n  ${id}: `).test(hookSrc), `${name}: ambient "${id}" is a preset in useAmbientAudio`);
  }
  eq(new Set([...alienTheme.sounds.stingers, ...duneTheme.sounds.stingers]).size, 14, 'fourteen distinct stingers across the two universes');
  for (const id of ['ship', 'derelict', 'hive', 'erg', 'sietch', 'keep']) ok(sb.AMBIENCE[id], `procedural bed "${id}" exists`);

  const render = (id, seed) => {
    const m = mockContext();
    const out = m.ac.createGain();
    const wet = m.ac.createGain();
    const dur = sb.renderStinger(m.ac, id, seed, { out, wet, at: 0 });
    return { m, dur, sig: JSON.stringify(m.log) };
  };
  for (const id of Object.keys(sb.STINGERS)) {
    const a = render(id, 1234);
    ok(a.dur > 0 && a.m.log.length > 20, `${id}: builds a layered graph (${a.m.log.length} scheduled ops)`);
    eq(a.m.bad, [], `${id}: finite values, no exponential ramp to ≤ 0`);
    ok(a.m.maxStop <= a.dur + 0.5, `${id}: every voice stops within its length (${a.m.maxStop.toFixed(2)} s ≤ ${a.dur} s)`);
    const kinds = new Set(a.m.log.map((l) => l[0].split('.')[0]));
    const voices = a.m.log.filter((l) => l[1] === 'start').length;
    ok(kinds.has('buffer') && kinds.has('filter') && voices >= 3, `${id}: layered — ${voices} voices incl. filtered noise${kinds.has('osc') ? ' + oscillators' : ''}`);
    eq(render(id, 1234).sig, a.sig, `${id}: same seed → identical render`);
    const variants = new Set([a.sig, render(id, 99).sig, render(id, 777777).sig]);
    eq(variants.size, 3, `${id}: different seeds → different renders`);
  }
  eq(sb.renderStinger(mockContext().ac, '__proto__', 1, { out: {} }), 0, 'prototype key is not a stinger');
  eq(sb.renderStinger(mockContext().ac, 'nope', 1, { out: {} }), 0, 'unknown stinger renders nothing');

  for (const id of Object.keys(sb.AMBIENCE)) {
    const m = mockContext();
    const out = m.ac.createGain();
    out.context = m.ac;
    const bedRun = sb.startAmbience(id, out, 42);
    ok(bedRun && !bedRun.error, `${id}: bed builds${bedRun?.error ? ` (${bedRun.error.message})` : ''}`);
    m.ac.currentTime = 40; // let the event scheduler fire
    await sleep(450);
    eq(m.bad, [], `${id}: bed schedules only finite values`);
    bedRun.stop();
    ok(m.log.some((l) => l[1] === 'stop'), `${id}: stop() stops its sources`);
  }
  eq(sb.startAmbience('nope', { context: mockContext().ac }), null, 'unknown bed → null');

  /* ═══ Part 2: table-sfx over the socket ═══ */
  await startServer();
  const dm = await connect();
  const created = await call(dm, 'create-game', { universeId: 'alien' });
  const code = created.code;
  const p1 = await connect();
  const p2 = await connect();
  const tv = await connect();
  const j1 = await call(p1, 'join-game', { code, playerName: 'Alice' });
  const j2 = await call(p2, 'join-game', { code, playerName: 'Bram' });
  ok(j1.playerId && j2.playerId, 'two phones seated');
  ok((await call(tv, 'join-board', { code })).success !== false, 'TV attached');
  const tvSfx = collect(tv, 'table-sfx');
  const p1Sfx = collect(p1, 'table-sfx');
  const p2Sfx = collect(p2, 'table-sfx');

  let got = once(tv, 'table-sfx');
  const r1 = await call(dm, 'table-sfx', { gameCode: code, cue: 'klaxon' });
  const e1 = await got;
  ok(r1.success && r1.boards === 1 && r1.phones === 0, 'DM table-sfx acked with 1 board, 0 phones');
  eq([e1.cue, e1.phones, typeof e1.seed, typeof e1.at], ['klaxon', false, 'number', 'number'], 'board receives { cue, seed, at, phones:false }');
  eq(e1.seed, r1.seed, 'ack carries the broadcast seed');
  await sleep(250);
  eq([p1Sfx.length, p2Sfx.length], [0, 0], 'phones get nothing unless routed');

  await sleep(150);
  const gotTv = once(tv, 'table-sfx');
  const gotP1 = once(p1, 'table-sfx');
  const gotP2 = once(p2, 'table-sfx');
  const r2 = await call(dm, 'table-sfx', { gameCode: code, cue: 'airlock', phones: true });
  const [t2, a2, b2] = await Promise.all([gotTv, gotP1, gotP2]);
  ok(r2.success && r2.phones === 2, 'phones:true acked with 2 phones');
  eq([t2.cue, a2.cue, b2.cue, t2.phones], ['airlock', 'airlock', 'airlock', true], 'board and both phones get the cue');
  ok(t2.seed === a2.seed && a2.seed === b2.seed, 'TV and phones share one seed (same variant everywhere)');
  ok(t2.seed !== e1.seed, 'each shot gets a fresh seed');

  const before = [tvSfx.length, p1Sfx.length, p2Sfx.length];
  await sleep(150);
  const rp = await call(p1, 'table-sfx', { gameCode: code, cue: 'klaxon', phones: true });
  eq(rp.error, 'NOT AUTHORIZED.', 'a player cannot fire stingers');
  const rb = await call(tv, 'table-sfx', { gameCode: code, cue: 'klaxon', phones: true });
  eq(rb.error, 'NOT AUTHORIZED.', 'the board cannot fire stingers');
  const stranger = await connect();
  const rs = await call(stranger, 'table-sfx', { gameCode: code, cue: 'klaxon', phones: true });
  eq(rs.error, 'NOT AUTHORIZED.', 'an unattached socket cannot fire stingers');
  const dm2 = await connect();
  const other = await call(dm2, 'create-game', { universeId: 'dune' });
  const rx = await call(dm2, 'table-sfx', { gameCode: code, cue: 'worm' });
  eq(rx.error, 'NOT AUTHORIZED.', "another game's DM cannot fire into this table");
  ok(other.code && other.code !== code, 'second game is separate');
  await sleep(300);
  eq([tvSfx.length, p1Sfx.length, p2Sfx.length], before, 'rejected senders broadcast nothing (300 ms)');

  for (const cue of ['', 'KLAXON', '__proto__', 'a'.repeat(41), 'x y', 42, null, { toString: 'klaxon' }]) {
    await sleep(130);
    const r = await call(dm, 'table-sfx', { gameCode: code, cue });
    eq(r.error, 'Unknown cue.', `malformed cue ${JSON.stringify(cue)} rejected`);
  }
  await sleep(150);
  const burst = await Promise.all([call(dm, 'table-sfx', { gameCode: code, cue: 'screech' }), call(dm, 'table-sfx', { gameCode: code, cue: 'screech' })]);
  ok(burst.filter((r) => r.success).length === 1 && burst.some((r) => r.error === 'RATE LIMITED.'), 'a double tap inside the gap is rate limited');
  await sleep(150);
  const r3 = await call(dm, 'table-sfx', { gameCode: code, cue: 'hull-groan' });
  ok(r3.success, 'firing again after the gap works');
  await sleep(150);
  const ackless = await new Promise((res) => { dm.emit('table-sfx', { gameCode: code, cue: 'steam-vent' }); setTimeout(res, 200); });
  ok(ackless === undefined && tvSfx.at(-1)?.cue === 'steam-vent', 'fire-and-forget (no ack) still broadcasts');

  /* AUDIO popover ambience pick → run-set { ambient } → table.ambient on the TV */
  got = once(tv, 'table-state', 3000, (d) => d?.table?.ambient === 'hive');
  ok((await call(dm, 'run-set', { gameCode: code, ambient: 'hive' })).success, 'GM ambience pick (run-set ambient) accepted');
  ok((await got).table.ambient === 'hive', 'TV table-state carries ambient "hive" (BoardAudio follows it)');
  got = once(tv, 'table-state', 3000, (d) => d?.table && d.table.ambient === null);
  await call(dm, 'run-set', { gameCode: code, ambient: null });
  ok((await got).table.ambient === null, 'OFF clears the TV ambience');

  ok(!/\[SOCKET\] handler/.test(stderr), 'no handler threw');
  ok(!/EVENT_NAMES drift.*table-sfx/.test(stderr), 'table-sfx is registered and listed in EVENT_NAMES');
  console.log(`test-sfx: ${checks} checks passed`);
} catch (err) {
  console.error('test-sfx FAILED:', err);
  if (stderr) console.error('--- server stderr ---\n' + stderr.slice(-3000));
  process.exitCode = 1;
} finally {
  for (const s of sockets) { try { s.close(); } catch { /* ignore */ } }
  if (server) await killServer();
  try { rmSync(DATA, { recursive: true, force: true }); } catch { /* ignore */ }
  setTimeout(() => process.exit(process.exitCode || 0), 50).unref?.();
}
