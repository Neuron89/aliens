#!/usr/bin/env node
/* Session persistence regression test. Spawns the server (temp DATA_DIR),
   exercises create/join/assign/mutate, kills + restarts the server, then
   resumes as DM, rejoins players (token; by name = a seat claim the DM
   approves), and ends the game.
   Contract changes (hardening pass, docs/REVIEW_2026-10-30.md):
   list-resumable needs { tokens: { CODE: dmToken } } (else []), and a
   name-only rejoin is a pending seat claim, not an instant reattach.
   Phase C/D: stale snapshots are pruned on start; EMPTY dormant games (no
   seats, no messages, <= 1 log entry) expire after EMPTY_GAME_MS (1 h), on
   start and in the periodic sweep, while games someone played in are kept.
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
async function startServer(extraEnv = {}) {
  server = spawn(process.execPath, ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] });
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

  eq(await call(dm, 'list-resumable', {}), [], 'list-resumable without tokens lists nothing');
  const mine = { tokens: { [code]: created.dmToken } };
  const resumable = await call(dm, 'list-resumable', mine);
  ok(resumable.some((g) => g.code === code && g.players === 2 && g.status === 'live'), 'list-resumable shows live game');
  ok(existsSync(join(DATA, 'sessions', `${code}.json`)), 'snapshot file written');

  /* ── Phase B: hard kill + restart ── */
  dm.close(); pA.close(); pB.close();
  await killServer();
  await startServer();

  const dm2 = await connect();
  const list2 = await call(dm2, 'list-resumable', mine);
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

  // Player B: by name only (no token) — a seat claim the DM must approve
  const pB2 = await connect();
  const rjBbad = await call(pB2, 'rejoin-game', { code, playerName: 'Nobody' });
  ok(rjBbad.error, 'unknown name rejected');
  const claimSeen = once(dm2, 'seat-claim');
  const pending = await call(pB2, 'rejoin-game', { code, playerName: 'Bob' });
  ok(pending.pending && pending.claimId && !pending.playerToken, 'name rejoin is a pending claim (no token yet)');
  const claim = await claimSeen;
  eq(claim.name, 'Bob', 'DM sees the claim');
  const result = once(pB2, 'seat-claim-result');
  ok((await call(dm2, 'seat-claim-resolve', { gameCode: code, claimId: claim.claimId, approve: true })).approved, 'DM approves');
  const rjB = await result;
  ok(rjB.approved && rjB.success && rjB.playerId === jB.playerId, 'B rejoined by name after approval');
  ok(rjB.playerToken && rjB.playerToken.length === 24 && rjB.playerToken !== jB.playerToken, 'fresh token issued to B');
  eq(rjB.messages.length, 2, 'B history: broadcast + own p2p');
  const dupe = await connect();
  const claim2 = once(dm2, 'seat-claim');
  const rjDupe = await call(dupe, 'rejoin-game', { code, playerName: 'Bob' });
  ok(rjDupe.pending, 'claim on a connected seat waits for the DM');
  const denied = once(dupe, 'seat-claim-result');
  await call(dm2, 'seat-claim-resolve', { gameCode: code, claimId: (await claim2).claimId, approve: false });
  ok((await denied).error, 'DM rejection reaches the claimant');
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
  const lst = await call(dm3, 'list-resumable', mine);
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
  ok((await call(dm3, 'list-resumable', mine)).every((g) => g.code !== code), 'game gone from list');
  ok((await call(pA2, 'rejoin-game', { code, playerToken: jA.playerToken })).error, 'rejoin after end fails');

  /* ── Phase B2: END from the session screen — a fresh socket that never resumed the game ends a
     DORMANT game with just code + dmToken (the RESUME list's END button). ── */
  {
    const dmX = await connect();
    const madeX = await call(dmX, 'create-game', { universeId: 'alien', packId: null });
    ok(/^[A-Z]{4}$/.test(madeX.code) && madeX.dmToken, 'B2 game created');
    const snapX = join(DATA, 'sessions', `${madeX.code}.json`);
    await sleep(400);
    dmX.disconnect();
    await sleep(100);
    const dmY = await connect();
    const mineX = { tokens: { [madeX.code]: madeX.dmToken } };
    ok((await call(dmY, 'list-resumable', mineX)).find((g) => g.code === madeX.code)?.status === 'dormant', 'B2 game dormant');
    ok((await call(dmY, 'end-game', { code: madeX.code.toLowerCase(), dmToken: 'nope' })).error, 'B2 end-game rejects a bad key');
    const endedX = await call(dmY, 'end-game', { code: madeX.code.toLowerCase(), dmToken: madeX.dmToken });
    ok(endedX.success, 'B2 dormant game ended from a fresh socket (lower-case code accepted)');
    await sleep(300);
    ok(!existsSync(snapX), 'B2 snapshot removed');
    ok((await call(dmY, 'list-resumable', mineX)).every((g) => g.code !== madeX.code), 'B2 game gone from list');
    ok((await call(dmY, 'end-game', { code: madeX.code, dmToken: madeX.dmToken })).success, 'B2 ending an already-gone game is a no-op success');
    dmY.disconnect();
  }

  /* ── Phase C: stale snapshot pruning ── */
  dm3.close(); pA2.close();
  await killServer();
  const dir = join(DATA, 'sessions');
  mkdirSync(dir, { recursive: true });
  const seat = { id: 'p_1', name: 'Kane', playerToken: 'x', character: null, tracks: {}, trackMax: {}, statusEffects: [], inventory: [], alive: true, conditions: {} };
  const mk = (c, updatedAt, players = []) => writeFileSync(join(dir, `${c}.json`), JSON.stringify({ version: 1, code: c, universeId: 'alien', packId: null, createdAt: updatedAt, updatedAt, dmToken: 't', players, messages: [], assignedCharacterIds: [] }));
  mk('OLDD', Date.now() - 25 * 3600 * 1000);
  mk('NEWW', Date.now() - 30 * 60 * 1000);           // empty, 30 min idle → kept
  mk('EMPT', Date.now() - 2 * 3600 * 1000);           // empty, 2 h idle → expired on start
  mk('USED', Date.now() - 2 * 3600 * 1000, [seat]);   // a seat, 2 h idle → kept
  await startServer();
  ok(!existsSync(join(dir, 'OLDD.json')), 'snapshot older than 24h deleted on start');
  const dm4 = await connect();
  const l4 = await call(dm4, 'list-resumable', { tokens: { NEWW: 't', OLDD: 't', EMPT: 't', USED: 't' } });
  eq(l4.map((g) => g.code).sort(), ['NEWW', 'USED'], 'fresh + played-in snapshots loaded; old and empty-idle ones gone');
  ok(!existsSync(join(dir, 'EMPT.json')), 'empty dormant snapshot deleted after 1 h');
  dm4.close();
  await killServer();

  /* ── Phase D: periodic sweep of empty dormant games (short EMPTY_GAME_MS) ── */
  await startServer({ EMPTY_GAME_MS: '400', SWEEP_INTERVAL_MS: '150' });
  const dmE = await connect();
  const empty = await call(dmE, 'create-game', { universeId: 'alien' });
  const dmU = await connect();
  const used = await call(dmU, 'create-game', { universeId: 'alien' });
  const pU = await connect();
  ok((await call(pU, 'join-game', { code: used.code, playerName: 'Lambert' })).success, 'a player joins the used game');
  await sleep(700);
  ok((await call(dmE, 'list-resumable', { tokens: { [empty.code]: empty.dmToken } })).length === 1, 'live (DM attached) empty game is never swept');
  dmE.close(); dmU.close(); pU.close();
  await sleep(1000);
  const dmX = await connect();
  const lx = await call(dmX, 'list-resumable', { tokens: { [empty.code]: empty.dmToken, [used.code]: used.dmToken } });
  eq(lx.map((g) => g.code), [used.code], 'empty dormant game swept; game with a seat kept');
  ok((await call(dmX, 'resume-game', { code: empty.code, dmToken: empty.dmToken })).error === 'GAME NOT FOUND.', 'swept game cannot be resumed');
  dmX.close();
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
