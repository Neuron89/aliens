#!/usr/bin/env node
/* Session persistence regression test. Spawns the server (temp DATA_DIR),
   exercises create/join/assign/mutate, kills + restarts the server, then
   resumes as DM, rejoins players (token + name), and ends the game.
   Usage: node scripts/test-sessions.mjs */
import { spawn } from 'child_process';
import { mkdtempSync, existsSync, rmSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert/strict';
import { io } from 'socket.io-client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3900 + Math.floor(Math.random() * 90);
const DATA = mkdtempSync(join(tmpdir(), 'sessions-test-'));
const URL = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

let server = null;
async function startServer() {
  server = spawn(process.execPath, ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('server start timeout')), 10000);
    server.stdout.on('data', (d) => { if (String(d).includes('ONLINE')) { clearTimeout(t); res(); } });
    server.stderr.on('data', (d) => process.stderr.write(d));
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
const connect = () => new Promise((res, rej) => {
  const s = io(URL, { transports: ['websocket'], reconnection: false });
  s.on('connect', () => res(s));
  s.on('connect_error', rej);
});
const call = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, res));
const once = (s, ev, ms = 3000) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('timeout waiting for ' + ev)), ms);
  s.once(ev, (d) => { clearTimeout(t); res(d); });
});

try {
  /* ── Phase A: build state ── */
  await startServer();
  const dm = await connect();
  const created = await call(dm, 'create-game', { universeId: 'alien', packId: null });
  ok(/^[A-Z]{4}$/.test(created.code), 'game code');
  ok(created.dmToken && created.dmToken.length === 24, 'dmToken is 24 chars');
  eq(created.universeId, 'alien', 'universe');
  const code = created.code;

  const pA = await connect();
  const pB = await connect();
  const jA = await call(pA, 'join-game', { code, playerName: 'Alice' });
  const jB = await call(pB, 'join-game', { code, playerName: 'Bob' });
  ok(jA.success && jA.playerToken?.length === 24, 'A joined with token');
  ok(jB.success && jB.playerId !== jA.playerId, 'B joined, distinct stable id');

  const assigned = once(pA, 'character-assigned');
  dm.emit('assign-character', {
    gameCode: code, playerId: jA.playerId,
    character: { id: 'c1', name: 'Ripley', career: 'Officer', gear: ['Flashlight', 'Pistol'] },
    tracks: { health: 4, stress: 1 }, trackMax: { health: 4, stress: 10 }, conditions: ['Starving'],
  });
  await assigned;
  dm.emit('update-player', { gameCode: code, playerId: jA.playerId, updates: { tracks: { health: 2, stress: 5 }, statusEffects: ['Broken'], inventory: ['Flashlight', 'Pistol', 'Keycard'] } });
  dm.emit('send-message', { gameCode: code, playerId: jA.playerId, text: 'secret for Alice', priority: 'STANDARD' });
  dm.emit('broadcast-message', { gameCode: code, text: 'hello everyone' });
  pA.emit('player-message', { gameCode: code, text: 'alice to dm' });
  pB.emit('player-to-player', { gameCode: code, targetId: jA.playerId, text: 'bob to alice' });
  await sleep(900); // > debounce + a game-saved emit

  const resumable = await call(dm, 'list-resumable', {});
  ok(resumable.some((g) => g.code === code && g.players === 2 && g.status === 'live'), 'list-resumable shows live game');
  ok(existsSync(join(DATA, 'sessions', `${code}.json`)), 'snapshot file written');

  /* ── Phase B: hard kill + restart ── */
  dm.close(); pA.close(); pB.close();
  await killServer();
  await startServer();

  const dm2 = await connect();
  const list2 = await call(dm2, 'list-resumable', {});
  const entry = list2.find((g) => g.code === code);
  ok(entry && entry.status === 'dormant' && entry.players === 2 && entry.universeId === 'alien', 'restarted server lists dormant game');

  const bad = await call(dm2, 'resume-game', { code, dmToken: 'x'.repeat(24) });
  ok(bad.error, 'wrong dmToken rejected');
  const bad2 = await call(dm2, 'resume-game', { code: 'ZZZZ', dmToken: created.dmToken });
  ok(bad2.error, 'unknown game rejected');

  const r = await call(dm2, 'resume-game', { code, dmToken: created.dmToken });
  ok(r.success, 'DM resumed');
  eq(Object.keys(r.players).length, 2, 'both players restored');
  const alice = r.players[jA.playerId];
  eq(alice.character.name, 'Ripley', 'character survived');
  eq(alice.tracks, { health: 2, stress: 5 }, 'tracks survived');
  eq(alice.statusEffects, ['Broken'], 'status effects survived');
  eq(alice.inventory, ['Flashlight', 'Pistol', 'Keycard'], 'inventory survived');
  ok(alice.connected === false && r.players[jB.playerId].connected === false, 'players dormant after restart');
  ok(!JSON.stringify(r).includes(jA.playerToken), 'player tokens not leaked to DM');
  eq(r.messages.length, 4, 'DM sees all 4 messages');
  ok(r.messages.some((m) => m.type === 'p2p' && m.dmNote), 'p2p history carries dmNote');
  eq(r.universeId, 'alien', 'universe in resume');

  const dmSeesJoin = [];
  dm2.on('player-joined', (d) => dmSeesJoin.push(d));

  // Player A: by token
  const pA2 = await connect();
  const rjA = await call(pA2, 'rejoin-game', { code, playerToken: jA.playerToken });
  ok(rjA.success && rjA.playerId === jA.playerId, 'A rejoined by token');
  eq(rjA.player.character.name, 'Ripley', 'A character kept');
  eq(rjA.player.tracks, { health: 2, stress: 5 }, 'A tracks kept');
  eq(rjA.messages.length, 4, 'A history: gm + broadcast + own + p2p');
  ok(rjA.messages.every((m) => m.toId === jA.playerId || m.fromId === jA.playerId || m.toId === 'broadcast'), 'A history filtered');

  // Player B: by name only (no token)
  const pB2 = await connect();
  const rjBbad = await call(pB2, 'rejoin-game', { code, playerName: 'Nobody' });
  ok(rjBbad.error, 'unknown name rejected');
  const rjB = await call(pB2, 'rejoin-game', { code, playerName: 'Bob' });
  ok(rjB.success && rjB.playerId === jB.playerId, 'B rejoined by name');
  ok(rjB.playerToken && rjB.playerToken.length === 24 && rjB.playerToken !== jB.playerToken, 'fresh token issued to B');
  eq(rjB.messages.length, 2, 'B history: broadcast + own p2p');
  const dupe = await connect();
  const rjDupe = await call(dupe, 'rejoin-game', { code, playerName: 'Bob' });
  ok(rjDupe.error, 'cannot take over a connected player by name');
  dupe.close();

  await sleep(100);
  eq(dmSeesJoin.filter((d) => d.rejoined).length, 2, 'DM notified of both rejoins');
  const connectedNow = dmSeesJoin.at(-1).players;
  ok(connectedNow[jA.playerId].connected && connectedNow[jB.playerId].connected, 'players marked connected');

  // Live messaging still works after rejoin (stable ids)
  const got = once(pA2, 'p2p-message');
  pB2.emit('player-to-player', { gameCode: code, targetId: jA.playerId, text: 'after restart' });
  eq((await got).message.text, 'after restart', 'p2p works after rejoin');

  // Player disconnect => dormant, not deleted; DM notified
  const left = once(dm2, 'player-left');
  pB2.close();
  const l = await left;
  ok(l.dormant === true && l.players[jB.playerId] && l.players[jB.playerId].connected === false, 'player-left dormant:true, record kept');

  // DM disconnect => players get dm-disconnected; resume => dm-reconnected; game survives
  const dcNotice = once(pA2, 'dm-disconnected');
  dm2.close();
  await dcNotice; checks++;
  await sleep(100);
  const dm3 = await connect();
  const lst = await call(dm3, 'list-resumable', {});
  ok(lst.find((g) => g.code === code)?.status === 'dormant', 'game dormant after DM drop');
  const back = once(pA2, 'dm-reconnected');
  const r3 = await call(dm3, 'resume-game', { code, dmToken: created.dmToken });
  ok(r3.success, 'DM resumed again');
  await back; checks++;
  eq(r3.players[jA.playerId].character.name, 'Ripley', 'state intact across DM drop');

  // end-game
  const endNotice = once(pA2, 'game-ended');
  const snap = join(DATA, 'sessions', `${code}.json`);
  await sleep(400);
  ok(existsSync(snap), 'snapshot exists before end');
  const noAuth = await call(dm3, 'end-game', { code, dmToken: 'bad' });
  ok(noAuth.error, 'end-game needs token');
  const ended = await call(dm3, 'end-game', { code, dmToken: created.dmToken });
  ok(ended.success, 'end-game ok');
  await endNotice; checks++;
  await sleep(500);
  ok(!existsSync(snap), 'snapshot removed after end-game');
  ok((await call(dm3, 'list-resumable', {})).every((g) => g.code !== code), 'game gone from list');
  ok((await call(pA2, 'rejoin-game', { code, playerToken: jA.playerToken })).error, 'rejoin after end fails');

  /* ── Phase C: stale snapshot pruning ── */
  dm3.close(); pA2.close();
  await killServer();
  const dir = join(DATA, 'sessions');
  mkdirSync(dir, { recursive: true });
  const mk = (c, updatedAt) => writeFileSync(join(dir, `${c}.json`), JSON.stringify({ version: 1, code: c, universeId: 'alien', packId: null, createdAt: updatedAt, updatedAt, dmToken: 't', players: [], messages: [], assignedCharacterIds: [] }));
  mk('OLDD', Date.now() - 25 * 3600 * 1000);
  mk('NEWW', Date.now() - 3600 * 1000);
  await startServer();
  ok(!existsSync(join(dir, 'OLDD.json')), 'snapshot older than 24h deleted on start');
  const dm4 = await connect();
  const l4 = await call(dm4, 'list-resumable', {});
  ok(l4.some((g) => g.code === 'NEWW') && !l4.some((g) => g.code === 'OLDD'), 'only fresh snapshot loaded');
  dm4.close();
  await killServer();

  console.log(`test-sessions: ${checks} checks passed`);
  rmSync(DATA, { recursive: true, force: true });
  process.exit(0);
} catch (e) {
  console.error('FAIL:', e.stack || e.message);
  if (server) await killServer().catch(() => {});
  rmSync(DATA, { recursive: true, force: true });
  process.exit(1);
}
