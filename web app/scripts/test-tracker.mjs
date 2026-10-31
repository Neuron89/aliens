#!/usr/bin/env node
/* Motion tracker (F1) regression test. Spawns the server with a temp DATA_DIR and checks:
   - universes without features.tracker (DUNE): table.tracker is null, tracker-set refused
   - ALIEN: off without a tracker in the gear ({ on:false }), on with "M314 Motion Tracker"
     in the gear (source 'gear'), GM grant via tracker-set (source 'gm'), withdraw
   - no fix until the PC token is on the map
   - contacts: a MOVING npc/creature (board-token-move → lastMovedAt) or a signal-flagged one
     (tracker-signal); hidden tokens / fogged rooms count; items, PCs, other levels and
     anything beyond 30 m do not; contacts fade after the motion window
   - geometry: bearing clockwise from map-up, distance in metres (grid cell = 2 m)
   - the phone payload carries only { bearing, distance, strength } per contact (no ids,
     names, positions), and hidden tokens still never reach the player's board-state
   - DM-only events, payload validation, grants survive a restart
   Usage: node scripts/test-tracker.mjs */
import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert/strict';
import { io } from 'socket.io-client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4500 + Math.floor(Math.random() * 90);
const DATA = mkdtempSync(join(tmpdir(), 'tracker-'));
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
const latest = (s, ev, key) => { const box = { v: null }; s.on(ev, (d) => { box.v = d?.[key] ?? null; }); return box; };
/** Wait until fn() is truthy (polling), or fail. */
async function until(fn, ms, msg) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return; await sleep(40); }
  throw new Error('timeout: ' + msg);
}

// 1000×1000 map, grid 0.02 → 20 px per cell = 2 m → 10 px per metre.
const MAPDEF = {
  id: 'trk-deck', kind: 'image', src: '/x.webp', size: [1000, 1000], grid: 0.02,
  levels: [{ id: 'upper', label: 'UPPER' }, { id: 'lower', label: 'LOWER' }],
  rooms: [
    { id: 'corridor', name: 'CORRIDOR', level: 'upper', shape: { type: 'rect', x: 0.4, y: 0.85, w: 0.2, h: 0.1 } },
    { id: 'vents', name: 'VENTS', level: 'upper', shape: { type: 'rect', x: 0, y: 0, w: 0.4, h: 0.85 } },
  ],
};
const ONLY_KEYS = ['bearing', 'distance', 'strength'];

try {
  await startServer();

  /* ── DUNE: no tracker at all ── */
  const dmD = await connect();
  const dune = await call(dmD, 'create-game', { universeId: 'dune' });
  const pD = await connect();
  const jD = await call(pD, 'join-game', { code: dune.code, playerName: 'Idaho' });
  ok(jD.success, 'dune player joined');
  eq(jD.table.tracker, null, 'DUNE: table.tracker is null');
  ok((await call(dmD, 'tracker-set', { gameCode: dune.code, playerId: jD.playerId, on: true })).error, 'DUNE: tracker-set refused');
  eq((await call(pD, 'table-sync', {})).table.tracker, null, 'DUNE: still null after table-sync');

  /* ── ALIEN setup ── */
  const dm = await connect();
  const created = await call(dm, 'create-game', { universeId: 'alien' });
  const code = created.code;
  const dmTable = latest(dm, 'table-state', 'table');
  const pA = await connect();
  const pB = await connect();
  const jA = await call(pA, 'join-game', { code, playerName: 'Alice' });
  const jB = await call(pB, 'join-game', { code, playerName: 'Bob' });
  const aTable = latest(pA, 'table-state', 'table');
  const bTable = latest(pB, 'table-state', 'table');
  const aBoard = latest(pA, 'board-state', 'board');
  eq(jA.table.tracker, { on: false }, 'ALIEN, nothing in the gear: { on:false }');

  ok((await call(dm, 'board-set-map', { gameCode: code, mapId: 'trk-deck', level: 'upper', mapDef: MAPDEF })).success, 'map set');
  ok((await call(dm, 'assign-character', { gameCode: code, playerId: jA.playerId, character: { id: 'ripley', name: 'Ripley', gear: ['Flashlight', 'M314 Motion Tracker'] }, tracks: { health: 4 }, trackMax: { health: 4 } })).success, 'A assigned');
  ok((await call(dm, 'assign-character', { gameCode: code, playerId: jB.playerId, character: { id: 'parker', name: 'Parker', gear: ['Wrench'] }, tracks: { health: 4 }, trackMax: { health: 4 } })).success, 'B assigned');
  await until(() => aTable.v?.tracker?.on === true, 2000, 'A tracker on');
  eq(aTable.v.tracker.source, 'gear', 'A: tracker from the gear');
  eq(aTable.v.tracker.fix, false, 'A: no fix before the PC token is placed');
  eq(bTable.v?.tracker || { on: false }, { on: false }, 'B: no tracker');

  /* ── tracker-set: DM only, validated ── */
  ok((await call(pB, 'tracker-set', { gameCode: code, playerId: jB.playerId, on: true })).error, 'player cannot grant');
  for (const bad of [{ playerId: '__proto__', on: true }, { playerId: 'p_nobody', on: true }, { playerId: jB.playerId, on: 'yes' }, { playerId: jB.playerId }, { playerId: 5, on: true }]) {
    ok((await call(dm, 'tracker-set', { gameCode: code, ...bad })).error, `tracker-set refuses ${JSON.stringify(bad)}`);
  }
  const g = await call(dm, 'tracker-set', { gameCode: code, playerId: jB.playerId, on: true });
  ok(g.success && g.on === true && g.available === true, 'GM grants B a tracker');
  await until(() => bTable.v?.tracker?.on === true, 2000, 'B tracker on');
  eq(bTable.v.tracker.source, 'gm', 'B: source gm');
  await until(() => Array.isArray(dmTable.v?.trackerGrants), 2000, 'dm sees grants');
  eq(dmTable.v.trackerGrants, [jB.playerId], 'DM table view lists the grant');

  /* ── Tokens ── */
  const up = (token) => call(dm, 'board-token-upsert', { gameCode: code, token: { level: 'upper', ...token } });
  ok((await up({ id: 'pc-a', kind: 'pc', label: 'Ripley', ownerPlayerId: jA.playerId, x: 0.5, y: 0.9, facing: 0 })).success, 'A token placed');
  ok((await up({ id: 'pc-b', kind: 'pc', label: 'Parker', ownerPlayerId: jB.playerId, x: 0.5, y: 0.5 })).success, 'B token placed');
  await up({ id: 'xeno', kind: 'creature', label: 'Drone', x: 0.2, y: 0.2, hidden: true });
  await up({ id: 'ash', kind: 'npc', label: 'Ash', x: 0.5, y: 0.8 });
  await up({ id: 'crate', kind: 'item', label: 'Crate', x: 0.5, y: 0.7 });
  await up({ id: 'deep', kind: 'creature', label: 'Below', x: 0.5, y: 0.85, level: 'lower' });
  await up({ id: 'far', kind: 'creature', label: 'Far', x: 0.5, y: 0.1 });
  await until(() => aTable.v?.tracker?.fix === true, 2000, 'A fix');
  eq(aTable.v.tracker.contacts, [], 'nothing moving yet: no contacts');
  eq(aTable.v.tracker.nearest, null, 'no nearest');
  eq(aTable.v.tracker.rings, [5, 10, 20], 'rings 5/10/20 m');
  eq(aTable.v.tracker.range, 30, 'range 30 m');

  /* ── Movement makes contacts ── */
  const move = (id, x, y) => dm.emit('board-token-move', { gameCode: code, id, x, y });
  move('ash', 0.5, 0.8);                // 10 m dead ahead (bearing 0)
  move('xeno', 0.45, 0.9);              // hidden, 5 m to the left (bearing 270), in the corridor? x 0.45 → corridor (fog irrelevant)
  move('crate', 0.52, 0.7);             // item: never a contact
  move('pc-b', 0.5, 0.6);               // a PC: never a contact
  move('deep', 0.5, 0.86);              // other level
  move('far', 0.5, 0.1);                // 80 m: out of range
  await until(() => aTable.v?.tracker?.contacts?.length === 2, 2500, 'two contacts');
  const cs = aTable.v.tracker.contacts;
  eq(cs.map((c) => [c.bearing, c.distance]), [[270, 5], [0, 10]], 'bearing clockwise from map-up, metres, sorted by distance');
  ok(cs.every((c) => c.strength > 0.8 && c.strength <= 1), 'fresh movement: strong signal');
  ok(cs.every((c) => Object.keys(c).sort().join() === ONLY_KEYS.join()), 'contacts carry only bearing/distance/strength');
  eq(aTable.v.tracker.nearest, 5, 'nearest = 5 m');
  const raw = JSON.stringify(aTable.v.tracker);
  ok(!/xeno|ash|Drone|Ash|"x"|"y"|label|id/.test(raw), 'no ids, names or positions in the tracker payload');
  ok(!aBoard.v?.tokens?.xeno, 'the hidden creature still never reaches the player board-state');
  // B (granted tracker, at 0.5,0.6): Ash at 0.5,0.8 is 20 m behind (bearing 180).
  await until(() => bTable.v?.tracker?.contacts?.some((c) => c.bearing === 180 && c.distance === 20), 2500, 'B sees Ash behind');
  ok(true, 'B (GM-granted) gets its own relative contacts');

  /* ── Facing ── */
  await up({ id: 'pc-a', facing: 90 });
  await until(() => aTable.v?.tracker?.facing === 90, 2000, 'facing passes through');
  ok(true, 'own token facing is in the summary');

  /* ── signal flag ── */
  ok((await call(pA, 'tracker-signal', { gameCode: code, tokenId: 'far', on: true })).error, 'player cannot flag a signal');
  ok((await call(dm, 'tracker-signal', { gameCode: code, tokenId: 'crate', on: true })).error, 'items cannot carry a signal');
  ok((await call(dm, 'tracker-signal', { gameCode: code, tokenId: '__proto__', on: true })).error, 'prototype id refused');
  await up({ id: 'egg', kind: 'creature', label: 'Egg', x: 0.6, y: 0.9 }); // 10 m east, never moved
  ok((await call(dm, 'tracker-signal', { gameCode: code, tokenId: 'egg', on: true })).success, 'GM flags a still creature');
  await until(() => aTable.v?.tracker?.contacts?.some((c) => c.bearing === 90 && c.distance === 10), 2500, 'signal contact');
  ok(true, 'a signal-flagged still token is a contact');

  /* ── Motion window: contacts fade, then vanish; signal stays ── */
  await sleep(3200);
  ok(aTable.v.tracker.contacts.some((c) => c.distance === 5 && c.strength < 0.8), 'fading movement weakens the signal');
  await until(() => aTable.v?.tracker?.contacts?.length === 1, 5000, 'moving contacts expire');
  eq(aTable.v.tracker.contacts.map((c) => [c.bearing, c.distance, c.strength]), [[90, 10, 0.6]], 'only the signal remains (strength 0.6)');
  ok((await call(dm, 'tracker-signal', { gameCode: code, tokenId: 'egg', on: false })).success, 'signal cleared');
  await until(() => aTable.v?.tracker?.contacts?.length === 0, 2500, 'signal gone');
  ok(true, 'clearing the signal removes the contact');

  /* ── Withdraw grant ── */
  ok((await call(dm, 'tracker-set', { gameCode: code, playerId: jB.playerId, on: false })).success, 'GM withdraws');
  await until(() => bTable.v?.tracker?.on === false, 2000, 'B tracker off');
  ok(true, 'withdrawn grant turns the tracker off');
  ok((await call(dm, 'tracker-set', { gameCode: code, playerId: jB.playerId, on: true })).success, 'GM grants again');

  /* ── Persistence ── */
  await sleep(700);
  for (const s of sockets) s.close();
  await killServer();
  await startServer();
  const pB2 = await connect();
  const rj = await call(pB2, 'rejoin-game', { code, playerToken: jB.playerToken });
  ok(rj.success && rj.table.tracker?.on === true && rj.table.tracker.source === 'gm', 'grant survives a restart');
  const dm2 = await connect();
  await call(dm2, 'resume-game', { code, dmToken: created.dmToken });
  await call(dm2, 'end-game', { code, dmToken: created.dmToken });

  ok(!/\[SOCKET\] handler|\[TRACKER\] tick failed/.test(stderr), 'no handler or tick threw');
  ok(!/EVENT_NAMES drift/.test(stderr), 'EVENT_NAMES in sync');
  console.log(`test-tracker: ${checks} checks passed`);
} catch (err) {
  console.error('test-tracker FAILED:', err);
  if (stderr) console.error('--- server stderr ---\n' + stderr.slice(-3000));
  process.exitCode = 1;
} finally {
  for (const s of sockets) { try { s.close(); } catch { /* ignore */ } }
  if (server) await killServer();
  try { rmSync(DATA, { recursive: true, force: true }); } catch { /* ignore */ }
}
