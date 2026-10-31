#!/usr/bin/env node
/* F7 — dice roll animation on the TV (board/DiceStage.jsx): server routing checks.
   Spawns the server with a temp DATA_DIR and checks:
   - player-roll → the board gets `board-roll` with kind, dice, flags, outcome numbers,
     the roller's name and who:'player' (ALIEN yze + a pushed re-roll, DUNE 2d20)
   - gm-roll secret:false → the board gets it with who:'gm' and the GM's name;
     logged without the [SECRET] prefix; the GM feed gets it (secret:false)
   - gm-roll secret:true AND gm-roll with no secret field → the board receives nothing
     within 300 ms; logged with [SECRET]; the GM feed gets them (secret:true)
   - phones never receive board-roll; a player or board socket cannot gm-roll
   Usage: node scripts/test-dice-stage.mjs */
import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert/strict';
import { io } from 'socket.io-client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4500 + Math.floor(Math.random() * 90);
const DATA = mkdtempSync(join(tmpdir(), 'dice-stage-'));
const URL = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

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

async function table(universeId) {
  const dm = await connect();
  const created = await call(dm, 'create-game', { universeId });
  const code = created.code;
  const p = await connect();
  const tv = await connect();
  const j = await call(p, 'join-game', { code, playerName: 'Alice' });
  await call(tv, 'join-board', { code });
  return { dm, p, tv, code, created, j };
}

try {
  await startServer();

  /* ── ALIEN: player rolls ── */
  const A = await table('alien');
  ok((await call(A.dm, 'assign-character', { gameCode: A.code, playerId: A.j.playerId, character: { id: 'varga', name: 'Varga' }, tracks: { health: 3, stress: 0 }, trackMax: { health: 3, stress: 10 } })).success, 'character assigned');
  const tvRolls = collect(A.tv, 'board-roll');
  const phoneRolls = collect(A.p, 'board-roll');
  const dmRolls = collect(A.dm, 'roll');
  const dmLog = collect(A.dm, 'log-entry');

  const yze = { kind: 'yze', label: 'MOBILITY', summary: 'MOBILITY — PANIC', successes: 1, stunts: 0, pushed: false, panic: true, stressGain: 0,
    flags: ['panic'], dice: { base: [6, 3, 2, 5, 1], stress: [1, 4] }, pool: { base: 5, stress: 2 } };
  let got = once(A.tv, 'board-roll');
  const r1 = await call(A.p, 'player-roll', { clientId: 'ds-1', roll: yze });
  ok(r1.success, 'player roll accepted');
  let br = (await got).roll;
  eq(br.id, r1.id, 'board-roll carries the roll id');
  eq(br.kind, 'yze', 'board-roll carries kind');
  eq(br.dice.base, [6, 3, 2, 5, 1], 'board-roll carries base dice');
  eq(br.dice.stress, [1, 4], 'board-roll carries stress dice');
  ok(br.flags.includes('panic'), 'board-roll carries flags');
  eq([br.name, br.label, br.who], ['Varga', 'MOBILITY', 'player'], 'board-roll: name, label, who:player');
  eq([br.successes, br.pushed, br.panic], [1, false, true], 'board-roll: successes / pushed / panic');
  ok(typeof br.summary === 'string' && br.summary.includes('PANIC'), 'board-roll carries summary');
  ok(!('stressGain' in br) && !('pool' in br) && !('clientId' in br) && !('playerId' in br), 'board-roll stays board-safe (no seat ids, no pool internals)');

  got = once(A.tv, 'board-roll');
  const r2 = await call(A.p, 'player-roll', { clientId: 'ds-2', roll: { ...yze, summary: 'MOBILITY — SUCCESS +1 STUNT (PUSHED)', successes: 2, panic: false, pushed: true, stressGain: 1, flags: ['push', 'crit'], dice: { base: [6, 6, 4, 2, 3], stress: [3, 4, 5] } } });
  br = (await got).roll;
  eq([br.id, br.pushed, br.successes], [r2.id, true, 2], 'pushed re-roll arrives as its own board-roll with pushed:true');
  eq(br.dice.stress.length, 3, 'pushed re-roll carries the extra stress die');

  /* ── GM rolls ── */
  const gmYze = { kind: 'yze', label: 'TAIL STRIKE', summary: 'TAIL STRIKE — SUCCESS', successes: 1, flags: [], dice: { base: [6, 2, 3, 1], stress: [] } };
  got = once(A.tv, 'board-roll');
  const g1 = await call(A.dm, 'gm-roll', { gameCode: A.code, who: 'Drone', roll: gmYze, secret: false });
  ok(g1.success && g1.secret === false, 'GM public roll accepted');
  br = (await got).roll;
  eq([br.id, br.who, br.name, br.label], [g1.id, 'gm', 'Drone', 'TAIL STRIKE'], 'board receives the GM roll with who:gm');
  eq(br.dice.base, [6, 2, 3, 1], 'GM board-roll carries dice');
  got = once(A.tv, 'board-roll');
  const g1b = await call(A.dm, 'gm-roll', { gameCode: A.code, roll: gmYze, secret: false });
  eq((await got).roll.name, 'GM', 'GM public roll without who is named GM');
  ok(g1b.success, 'GM public roll (no who) accepted');

  const before = tvRolls.length;
  const g2 = await call(A.dm, 'gm-roll', { gameCode: A.code, who: 'Drone', roll: { ...gmYze, label: 'HIDDEN' }, secret: true });
  const g3 = await call(A.dm, 'gm-roll', { gameCode: A.code, who: 'Drone', roll: { ...gmYze, label: 'DEFAULT' } });
  ok(g2.success && g2.secret === true, 'GM secret roll accepted');
  ok(g3.success && g3.secret === true, 'GM roll with no secret field defaults to secret');
  await sleep(300);
  eq(tvRolls.length, before, 'secret and default GM rolls never reach the board (300 ms)');
  ok(!tvRolls.some((d) => d.roll.label === 'HIDDEN' || d.roll.label === 'DEFAULT'), 'no secret label on the board');
  const nonBool = await call(A.dm, 'gm-roll', { gameCode: A.code, roll: { ...gmYze, label: 'STRINGY' }, secret: 'false' });
  await sleep(200);
  ok(nonBool.secret === true && !tvRolls.some((d) => d.roll.label === 'STRINGY'), 'only a real boolean false makes a GM roll public');

  await sleep(100);
  const feed = (id) => dmRolls.find((d) => d.roll.id === id)?.roll;
  ok(feed(g1.id) && feed(g1.id).secret === false, 'GM feed gets the public roll (secret:false)');
  ok(feed(g2.id)?.secret === true && feed(g3.id)?.secret === true, 'GM feed gets the secret rolls (secret:true)');
  ok(feed(r1.id) && feed(r2.id), 'GM feed gets the player rolls');
  const rollLog = dmLog.map((d) => d.entry).filter((e) => e && e.type === 'roll');
  const pub = rollLog.filter((e) => String(e.text).startsWith('Drone: TAIL STRIKE'));
  ok(pub.length >= 1, 'public GM roll logged without [SECRET]');
  ok(rollLog.some((e) => String(e.text).startsWith('[SECRET] Drone:')), 'secret GM roll logged with [SECRET]');
  const dmTable = (await call(A.dm, 'table-sync', { gameCode: A.code })).table;
  ok(dmTable.rolls.some((r) => r.id === g1.id && r.secret === false) && dmTable.rolls.some((r) => r.id === g3.id && r.secret === true), 'table.rolls stores the secret flag');

  eq(phoneRolls.length, 0, 'phones never receive board-roll');
  const pr = await call(A.p, 'gm-roll', { gameCode: A.code, roll: gmYze, secret: false });
  ok(pr?.error, 'a player socket cannot gm-roll');
  const tvTry = await call(A.tv, 'gm-roll', { gameCode: A.code, roll: gmYze, secret: false });
  ok(tvTry?.error, 'the board socket cannot gm-roll');
  await sleep(150);
  eq(tvRolls.filter((d) => d.roll.who === 'gm').length, 2, 'only the two public GM rolls reached the board');

  /* ── DUNE: 2d20 ── */
  const D = await table('dune');
  ok((await call(D.dm, 'assign-character', { gameCode: D.code, playerId: D.j.playerId, character: { id: 'irulan', name: 'Irulan' }, tracks: {}, trackMax: {} })).success, 'dune character assigned');
  const d20 = { kind: '2d20', label: 'BATTLE', summary: 'BATTLE — PASSED 2/D2 · 1 COMPLICATION', successes: 2, complications: 1, passed: true, momentum: 0, difficulty: 2, target: 11, flags: ['complication'], dice: { d20: [4, 20] } };
  got = once(D.tv, 'board-roll');
  const rd = await call(D.p, 'player-roll', { clientId: 'ds-d1', roll: d20 });
  br = (await got).roll;
  eq([br.id, br.kind, br.who, br.name], [rd.id, '2d20', 'player', 'Irulan'], 'DUNE board-roll: id, kind, who, name');
  eq(br.dice.d20, [4, 20], 'DUNE board-roll carries the d20s');
  eq([br.successes, br.complications, br.passed, br.difficulty, br.target, br.momentum], [2, 1, true, 2, 11, 0], 'DUNE board-roll carries the outcome numbers');
  ok(br.flags.includes('complication'), 'DUNE board-roll carries the complication flag');
  got = once(D.tv, 'board-roll');
  await call(D.dm, 'gm-roll', { gameCode: D.code, who: 'Harkonnen Captain', roll: { ...d20, label: 'COMMAND' }, secret: false });
  br = (await got).roll;
  eq([br.who, br.name, br.kind], ['gm', 'Harkonnen Captain', '2d20'], 'DUNE GM public roll reaches the board');

  /* ── Hostile payloads on the new fields stay clamped ── */
  got = once(A.tv, 'board-roll');
  await call(A.p, 'player-roll', { clientId: 'ds-bad', roll: { kind: 'yze', label: 'X', successes: 'lots', difficulty: 999, passed: 'yes', dice: { base: [6, '__proto__', 99999] } } });
  br = (await got).roll;
  eq([br.successes, br.difficulty, br.passed], [null, 20, null], 'non-numeric / out-of-range outcome fields are dropped or clamped');
  eq(br.dice.base, [6, 0, 99], 'dice faces are clamped integers');

  ok(!/\[SOCKET\] handler/.test(stderr), 'no handler threw');
  console.log(`test-dice-stage: ${checks} checks passed`);
} catch (err) {
  console.error('test-dice-stage FAILED:', err);
  if (stderr) console.error('--- server stderr ---\n' + stderr.slice(-3000));
  process.exitCode = 1;
} finally {
  for (const s of sockets) { try { s.close(); } catch { /* ignore */ } }
  if (server) await killServer();
  try { rmSync(DATA, { recursive: true, force: true }); } catch { /* ignore */ }
}
