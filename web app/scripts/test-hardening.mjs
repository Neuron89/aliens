#!/usr/bin/env node
/* Hardening regression test (docs/REVIEW_2026-10-30.md). Spawns the server
   (temp DATA_DIR, API_TOKEN, short SEAT_CLAIM_MS, small MAX_GAMES) and:
   - fires null / garbage payloads at every event in EVENT_NAMES from an
     anonymous socket, a joined player and the DM → server stays up and no
     handler throws (stderr has no "[SOCKET] handler" lines)
   - GM takeover needs the PIN; it rotates dmToken, the old DM gets
     `session-taken`, the old token is rejected; wrong PINs lock out
   - list-resumable lists only games whose dmToken (or code + PIN) is shown
   - name rejoin = a seat claim the DM approves/rejects; unanswered claims
     fail; the previous device gets `session-taken`
   - duplicate join names are refused (case-insensitive)
   - role change detaches (DM creating a 2nd game → 1st dormant; player
     joining a board elsewhere → seat disconnected); MAX_GAMES cap
   - `__proto__` / `constructor` token, room, clock, pool ids rejected;
     cross-game isolation; null-prototype board survives snapshot → restart
   - session-seed dedupes on the stored id; message text capped at 4000,
     priority validated; get-assigned-characters is DM-only and recomputed
   - unrevealed room renames reach the board as name:null
   - API_TOKEN enforced on /api/content writes and POST /api/generate
   - in-process: end-game leaves no socket in the game rooms
     (io.sockets.adapter.rooms) and clears socket.data
   Usage: node scripts/test-hardening.mjs */
import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import assert from 'assert/strict';
import { io } from 'socket.io-client';
import { Server } from 'socket.io';
import { EVENT_NAMES } from '../server/guard.js';
import { normalizeBoard } from '../server/board.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4200 + Math.floor(Math.random() * 90);
const DATA = mkdtempSync(join(tmpdir(), 'hardening-test-'));
const URL = `http://127.0.0.1:${PORT}`;
const API_TOKEN = 'hardening-secret';
const MAX_GAMES = 8;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

let server = null;
let stderr = '';
async function startServer() {
  server = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, API_TOKEN, SEAT_CLAIM_MS: '1500', MAX_GAMES: String(MAX_GAMES) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
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
const connect = (url = URL) => new Promise((res, rej) => {
  const s = io(url, { transports: ['websocket'], reconnection: false });
  s.on('connect', () => res(s));
  s.on('connect_error', rej);
});
const call = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, res));
const once = (s, ev, ms = 3000) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('timeout waiting for ' + ev)), ms);
  s.once(ev, (d) => { clearTimeout(t); res(d); });
});
const quiet = (s, ev, ms = 400) => new Promise((res) => {
  const t = setTimeout(() => { s.off(ev, h); res(true); }, ms);
  const h = () => { clearTimeout(t); s.off(ev, h); res(false); };
  s.on(ev, h);
});
const alive = async (s) => Array.isArray(await Promise.race([call(s, 'list-resumable', {}), sleep(2000).then(() => null)]));

const MAPDEF = {
  id: 'test-map', kind: 'image', src: '/x.webp',
  rooms: [
    { id: 'r-one', name: 'ONE', shape: { type: 'rect', x: 0, y: 0, w: 0.4, h: 0.4 } },
    { id: 'r-two', name: 'TWO', shape: { type: 'rect', x: 0.5, y: 0.5, w: 0.4, h: 0.4 } },
    { id: 'constructor', name: 'EVIL', shape: { type: 'rect', x: 0.5, y: 0, w: 0.4, h: 0.4 } },
  ],
};

let gamesCreated = 0;
async function newGame(sock, opts = { universeId: 'alien' }) {
  const g = await call(sock, 'create-game', opts);
  if (g?.code) gamesCreated++;
  return g;
}

try {
  /* ── Pure: null-prototype board normalization ── */
  {
    const snap = JSON.parse('{"tokens":{"__proto__":{"id":"__proto__"},"t-1":{"id":"t-1","kind":"npc"}},"rooms":{"constructor":{"revealed":true},"r-one":{"revealed":true}}}');
    const b = normalizeBoard(snap);
    ok(Object.getPrototypeOf(b.tokens) === null && Object.getPrototypeOf(b.rooms) === null, 'normalizeBoard → null-prototype maps');
    eq(Object.keys(b.tokens), ['t-1'], 'reserved token id dropped on load');
    eq(Object.keys(b.rooms), ['r-one'], 'reserved room id dropped on load');
    ok(({}).revealed === undefined, 'Object.prototype untouched');
  }

  await startServer();

  /* ── 1. Garbage payloads on every event ── */
  const dm = await connect();
  const game = await newGame(dm);
  const code = game.code;
  ok(/^\d{6}$/.test(game.gmPin), 'create-game returns a 6-digit gmPin');
  const pA = await connect();
  const jA = await call(pA, 'join-game', { code, playerName: 'Alice' });
  ok(jA.success, 'Alice joined');
  const anon = await connect();

  const BAD = [null, 0, 7, 'x', true, [], [1, 2], {}, {
    gameCode: 5, code: {}, playerId: [], updates: null, character: { id: 'c', gear: 5 }, token: { id: '__proto__' },
    clocks: 'x', clues: [null, 5, { id: '__proto__', text: 'x' }], roll: null, effect: null, id: '__proto__', roomId: 'constructor',
    key: 'constructor', tokens: null, text: { a: 1 }, priority: {}, view: null, mapDef: null, initiative: { order: [null, 5] },
    supply: null, injury: null, defs: null, values: null, agendas: null, clue: null, clock: null, handout: null, to: {}, foundBy: 5,
    completed: null, x: 'NaN', claimId: {}, approve: 'yes', pin: {}, takeover: 'true', playerToken: {}, playerName: {},
  }];
  const ROLE_CHANGERS = new Set(['create-game', 'resume-game', 'join-game', 'rejoin-game', 'join-board', 'end-game']);
  const fire = (sock, events, withCode) => {
    for (const ev of events) {
      for (const raw of BAD) {
        const p = withCode && raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw, gameCode: code } : raw;
        sock.emit(ev, p);
        sock.emit(ev, p, () => {});
      }
      sock.emit(ev);
      sock.emit(ev, () => {});
    }
  };
  ok(EVENT_NAMES.length >= 60, `EVENT_NAMES exported (${EVENT_NAMES.length})`);
  fire(anon, EVENT_NAMES.filter((e) => e !== 'create-game'), false);
  fire(pA, EVENT_NAMES.filter((e) => !ROLE_CHANGERS.has(e)), true);
  fire(dm, EVENT_NAMES.filter((e) => !ROLE_CHANGERS.has(e)), true);
  dm.emit('assign-character', { gameCode: code, playerId: jA.playerId, character: { id: 'c', gear: 5 } });
  dm.emit('update-player', { gameCode: code, playerId: jA.playerId, updates: null });
  pA.emit('player-roll', null);
  const junk = await connect();
  junk.emit('create-game', null, () => {}); gamesCreated++;
  junk.emit('join-game', null);
  await sleep(800);
  ok(server && server.exitCode === null, 'server process still running after garbage');
  ok(await alive(anon), 'server still answers after garbage');
  ok(!/\[SOCKET\] handler/.test(stderr), 'no handler threw (validated, not just caught): ' + (stderr.match(/\[SOCKET\] handler[^\n]*/) || [''])[0]);
  const bad = await call(dm, 'assign-character', { gameCode: code, playerId: jA.playerId, character: { id: 'c', name: 'X', gear: 5 } });
  ok(bad.error, 'assign-character with gear:5 rejected');
  ok((await call(dm, 'assign-character', { gameCode: code, playerId: jA.playerId, character: { id: 'c', name: 'X', pad: 'x'.repeat(70000) } })).error, 'oversized character rejected');
  ok((await call(dm, 'update-player', { gameCode: code, playerId: jA.playerId, updates: null })).error, 'update-player updates:null rejected');
  ok((await call(dm, 'board-sync', {})).board, 'DM still holds the game after garbage');
  junk.close();

  /* ── 2. Assigned ids: DM-only, recomputed ── */
  const pB = await connect();
  const jB = await call(pB, 'join-game', { code, playerName: 'Bob' });
  const ripley = { id: 'ripley', name: 'Ripley', gear: ['Torch', 7, 'Pistol'] };
  ok((await call(dm, 'assign-character', { gameCode: code, playerId: jA.playerId, character: ripley })).success, 'assign ok');
  ok((await call(dm, 'assign-character', { gameCode: code, playerId: jB.playerId, character: ripley })).success, 'same character to a 2nd seat');
  ok((await call(dm, 'assign-character', { gameCode: code, playerId: jA.playerId, character: { id: 'hicks', name: 'Hicks' } })).success, 'seat A reassigned');
  eq((await call(dm, 'get-assigned-characters', { gameCode: code })).ids.sort(), ['hicks', 'ripley'], 'assigned ids recomputed (no drift)');
  ok((await call(pA, 'get-assigned-characters', { gameCode: code })).error, 'get-assigned-characters refused for a player');
  ok((await call(anon, 'get-assigned-characters', { gameCode: code })).error, 'get-assigned-characters refused anonymously');
  const st = await call(dm, 'resume-game', { code, dmToken: game.dmToken });
  eq(st.players[jB.playerId].inventory, ['Torch', 'Pistol'], 'non-string gear dropped');

  /* ── 3. Message cap + priority ── */
  let got = once(pA, 'secret-message');
  await call(dm, 'send-message', { gameCode: code, playerId: jA.playerId, text: 'y'.repeat(5000), priority: { evil: 1 } });
  let m = (await got).message;
  eq(m.text.length, 4000, 'GM message capped at 4000');
  eq(m.priority, 'STANDARD', 'object priority → STANDARD');
  got = once(pA, 'secret-message');
  await call(dm, 'send-message', { gameCode: code, playerId: jA.playerId, text: 'eyes', priority: 'EYES ONLY' });
  eq((await got).message.priority, 'EYES ONLY', 'universe priority kept');
  got = once(pA, 'secret-message');
  await call(dm, 'broadcast-message', { gameCode: code, text: 'z'.repeat(9000), priority: 'MADE UP' });
  m = (await got).message;
  ok(m.text.length === 4000 && m.priority === 'STANDARD', 'broadcast capped + unknown priority → STANDARD');
  ok((await call(dm, 'send-message', { gameCode: code, playerId: jA.playerId, text: { a: 1 } })).error, 'non-string message text rejected');
  const pm = await call(pA, 'player-message', { gameCode: code, text: 'q'.repeat(6000) });
  ok(pm.success, 'player message ok');

  /* ── 4. Duplicate names ── */
  const pDup = await connect();
  const dup = await call(pDup, 'join-game', { code, playerName: ' alice ' });
  ok(dup.error && /NAME IN USE/.test(dup.error) && dup.code === 'NAME_IN_USE', 'duplicate name (case/space-insensitive) rejected');

  /* ── 5. Seat claims ── */
  const claimSeen = once(dm, 'seat-claim');
  const pending = await call(pDup, 'rejoin-game', { code, playerName: 'Alice' });
  ok(pending.pending && !pending.playerToken && !pending.success, 'name rejoin does not grant the seat');
  const claim = await claimSeen;
  ok(claim.name === 'Alice' && claim.seatConnected === true, 'DM sees claim (seat currently connected)');
  ok((await call(pA, 'seat-claim-resolve', { gameCode: code, claimId: claim.claimId, approve: true })).error, 'a player cannot approve claims');
  const taken = once(pA, 'session-taken');
  const result = once(pDup, 'seat-claim-result');
  await call(dm, 'seat-claim-resolve', { gameCode: code, claimId: claim.claimId, approve: true });
  const res = await result;
  ok(res.approved && res.playerId === jA.playerId && res.playerToken && res.playerToken !== jA.playerToken, 'approved claimant gets the seat + rotated token');
  await taken; checks++;
  const oldTok = await connect();
  ok((await call(oldTok, 'rejoin-game', { code, playerToken: jA.playerToken })).error, 'previous device token rejected');
  ok((await call(pA, 'player-message', { gameCode: code, text: 'ghost' })).error, 'previous device socket detached');
  // Reject path
  const claim2 = once(dm, 'seat-claim');
  await call(oldTok, 'rejoin-game', { code, playerName: 'Bob' });
  const rej = once(oldTok, 'seat-claim-result');
  await call(dm, 'seat-claim-resolve', { gameCode: code, claimId: (await claim2).claimId, approve: false });
  const rr = await rej;
  ok(!rr.approved && /NEW NAME/.test(rr.error), 'rejected claimant told to join under a new name');

  /* ── 6. Takeover needs the PIN; rotates the token ── */
  const t1 = await connect();
  ok((await call(t1, 'resume-game', { code, takeover: true })).error, 'takeover without PIN refused');
  const wrong = await call(t1, 'resume-game', { code, takeover: true, pin: '000000' === game.gmPin ? '111111' : '000000' });
  ok(wrong.error && !wrong.dmToken, 'takeover with wrong PIN refused');
  const dmTaken = once(dm, 'session-taken');
  const tk = await call(t1, 'resume-game', { code, takeover: true, pin: game.gmPin });
  ok(tk.success && tk.takeover && tk.dmToken && tk.dmToken !== game.dmToken, 'takeover with PIN → NEW dmToken');
  await dmTaken; checks++;
  ok((await call(anon, 'resume-game', { code, dmToken: game.dmToken })).error, 'old dmToken rejected after takeover');
  ok((await call(dm, 'board-sync', {})).error, 'old DM socket detached');
  ok((await call(t1, 'board-sync', {})).board, 'new terminal acts as DM');
  // Claims wait for an offline DM, are re-sent on resume, and expire
  const dmGone = once(pB, 'dm-disconnected');
  t1.close();
  await dmGone; checks++;
  const lateClaimant = await connect();
  const pend = await call(lateClaimant, 'rejoin-game', { code, playerName: 'Bob' });
  ok(pend.pending && pend.dmConnected === false, 'claim waits while the DM is offline');
  const t2 = await connect();
  const resent = once(t2, 'seat-claim');
  ok((await call(t2, 'resume-game', { code, dmToken: tk.dmToken })).success, 'resume with the rotated token');
  eq((await resent).claimId, pend.claimId, 'pending claim re-sent to the returning DM');
  const expired = await once(lateClaimant, 'seat-claim-result', 4000);
  ok(!expired.approved && /NO ANSWER/.test(expired.error), 'unanswered claim fails after SEAT_CLAIM_MS');

  /* ── 7. list-resumable ── */
  eq(await call(anon, 'list-resumable', {}), [], 'no tokens → []');
  eq(await call(anon, 'list-resumable', { tokens: { [code]: game.dmToken } }), [], 'stale token → []');
  ok((await call(anon, 'list-resumable', { tokens: { [code]: tk.dmToken } })).some((g) => g.code === code), 'valid token → listed');
  ok((await call(anon, 'list-resumable', { code, pin: game.gmPin })).some((g) => g.code === code), 'code + PIN → listed');

  // PIN lockout (separate game)
  const lockDm = await connect();
  const lg = await newGame(lockDm);
  const t3 = await connect();
  for (let i = 0; i < 5; i++) await call(t3, 'resume-game', { code: lg.code, takeover: true, pin: 'nope' });
  const locked = await call(t3, 'resume-game', { code: lg.code, takeover: true, pin: lg.gmPin });
  ok(locked.error && /WAIT/.test(locked.error), 'PIN locked after 5 wrong tries (even the right PIN)');

  /* ── 8. Role change detaches ── */
  const g1Players = await connect();
  const g1j = await call(g1Players, 'join-game', { code: lg.code, playerName: 'Vasquez' });
  ok(g1j.success, 'player joined game 1');
  const dmDrop = once(g1Players, 'dm-disconnected');
  const g2 = await newGame(lockDm);
  ok(g2.code && g2.code !== lg.code, 'DM created a 2nd game');
  await dmDrop; checks++;
  const l1 = await call(anon, 'list-resumable', { tokens: { [lg.code]: lg.dmToken } });
  ok(l1[0]?.status === 'dormant' && l1[0]?.dmConnected === false, '1st game dormant after its DM created another');
  const noLeak = quiet(lockDm, 'player-left', 500);
  await call(g1Players, 'join-board', { code: g2.code });
  ok(await noLeak, 'player-left for game 1 is not sent to game 2 DM');
  // Game 1's DM is offline; check via resume (token) that the player is disconnected.
  const back = await connect();
  const r1 = await call(back, 'resume-game', { code: lg.code, dmToken: lg.dmToken });
  ok(r1.players[g1j.playerId].connected === false, 'player joining a board elsewhere left its seat');

  /* ── 9. Prototype-key ids + isolation ── */
  ok((await call(lockDm, 'board-set-map', { gameCode: g2.code, mapId: 'test-map', mapDef: MAPDEF })).success, 'map set (game 2)');
  ok((await call(back, 'board-set-map', { gameCode: lg.code, mapId: 'test-map', mapDef: MAPDEF })).success, 'map set (game 1)');
  const hid = await call(back, 'board-token-upsert', { gameCode: lg.code, token: { id: 'alien-1', kind: 'creature', x: 0.7, y: 0.2 } });
  ok(hid.success, 'creature placed in an unrevealed room (game 1)');
  for (const id of ['__proto__', 'constructor', 'prototype']) {
    ok((await call(lockDm, 'board-token-upsert', { gameCode: g2.code, token: { id, kind: 'npc' } })).error, `token id ${id} rejected`);
  }
  ok((await call(lockDm, 'board-room-set', { gameCode: g2.code, roomId: 'constructor', revealed: true })).error, 'room id constructor rejected');
  const sync2 = await call(lockDm, 'board-sync', {});
  ok(!sync2.mapDef.rooms.some((r) => r.id === 'constructor'), 'reserved room id dropped from mapDef');
  const brd = await connect();
  const jb = await call(brd, 'join-board', { code: lg.code });
  ok(!jb.board.tokens['alien-1'], 'game 1 board still hides the creature (isolation)');
  const ck = await call(lockDm, 'clock-upsert', { gameCode: g2.code, clock: { id: '__proto__', label: 'X', segments: 4 } });
  ok(ck.success && ck.id !== '__proto__', 'clock id __proto__ replaced');
  await call(lockDm, 'pools-init', { gameCode: g2.code, defs: [{ key: 'constructor', max: 5 }, { key: 'threat', max: 9 }] });
  ok((await call(lockDm, 'pool-delta', { gameCode: g2.code, key: 'constructor', delta: 1 })).error, 'pool key constructor rejected');
  ok((await call(lockDm, 'pool-delta', { gameCode: g2.code, key: 'threat', delta: 1 })).success, 'normal pool key works');

  /* ── 10. Room renames withheld until revealed ── */
  const bs = once(brd, 'board-state');
  await call(back, 'board-room-set', { gameCode: lg.code, roomId: 'r-two', name: 'NEST' });
  let view = (await bs).board;
  ok(view.rooms['r-two'] && view.rooms['r-two'].name === null, 'unrevealed rename sent as name:null');
  const dmView = await call(back, 'board-sync', {});
  eq(dmView.board.rooms['r-two'].name, 'NEST', 'DM sees the rename');
  const bs2 = once(brd, 'board-state');
  await call(back, 'board-room-set', { gameCode: lg.code, roomId: 'r-two', revealed: true });
  view = (await bs2).board;
  eq(view.rooms['r-two'].name, 'NEST', 'rename visible once revealed');

  /* ── 11. Seed dedupe ── */
  const seed = { gameCode: g2.code, clocks: [{ id: 'Bad Id!', label: 'Bad' }, { id: 'good-clock', label: 'Good' }, { id: 'constructor', label: 'C' }], clues: [{ id: 'Bad Id!', text: 'x' }, { id: 'clue-1', text: 'y' }] };
  const s1 = await call(lockDm, 'session-seed', seed);
  const s2 = await call(lockDm, 'session-seed', seed);
  const s3 = await call(lockDm, 'session-seed', seed);
  ok(s1.added === 2 && s2.added === 0 && s3.added === 0, `seed adds valid ids once (${s1.added}/${s2.added}/${s3.added})`);
  const tbl = (await call(lockDm, 'table-sync', {})).table;
  eq(tbl.clocks.filter((c) => c.label !== 'X').map((c) => c.id), ['good-clock'], 'invalid seed ids skipped');

  /* ── 12. MAX_GAMES ── */
  const capper = await connect();
  let full = null;
  for (let i = 0; i < MAX_GAMES + 2 && !full; i++) {
    const r = await newGame(capper);
    if (r.error) full = r;
  }
  ok(full && /SERVER FULL/.test(full.error), 'MAX_GAMES cap enforced with a clear error');

  /* ── 13. Snapshot round-trip of null-prototype maps ── */
  await sleep(600);
  for (const s of [dm, pA, pB, pDup, anon, oldTok, t2, lateClaimant, lockDm, t3, g1Players, back, brd, capper]) s.close();
  await killServer();
  await startServer();
  const again = await connect();
  const rr1 = await call(again, 'resume-game', { code: lg.code, dmToken: lg.dmToken });
  ok(rr1.success, 'resumed after restart');
  const bsync = await call(again, 'board-sync', {});
  ok(bsync.board.tokens['alien-1'] && bsync.board.rooms['r-two']?.revealed, 'tokens + rooms survive the snapshot');
  again.emit('board-token-move', { gameCode: lg.code, id: 'alien-1', x: 0.1, y: 0.1 });
  ok((await call(again, 'board-token-upsert', { gameCode: lg.code, token: { id: 'm-1', kind: 'marker' } })).success, 'board writable after reload');
  ok((await call(again, 'board-sync', {})).board.tokens['alien-1'].x === 0.1, 'token move works on a reloaded board');
  ok(rr1.gmPin === lg.gmPin, 'gmPin persisted');

  /* ── 14. API_TOKEN ── */
  const http = (path, init = {}) => fetch(`${URL}${path}`, init);
  eq((await http('/api/content/alien/hardening-x', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401, 'PUT content without token → 401');
  eq((await http('/api/content/alien/hardening-x', { method: 'DELETE' })).status, 401, 'DELETE content without token → 401');
  eq((await http('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: '{}' })).status, 401, 'POST generate without token → 401');
  eq((await http('/api/content/alien/hardening-x', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-api-token': 'wrong' }, body: '{}' })).status, 401, 'wrong token → 401');
  const withTok = await http('/api/content/alien/hardening-x', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-api-token': API_TOKEN }, body: JSON.stringify({ id: 'other', universe: 'alien' }) });
  eq(withTok.status, 400, 'token accepted (request reaches validation)');
  const gen = await http('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-api-token': API_TOKEN }, body: '{}' });
  ok(gen.status !== 401, `generate with token passes the guard (${gen.status})`);
  eq((await http('/api/content')).status, 200, 'GET content stays open');
  again.close();
  await killServer();

  /* ── 15. In-process: end-game empties the rooms ── */
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'hardening-inproc-'));
  const { attachSessions } = await import('../server/sessions.js');
  const httpServer = createServer();
  const ioServer = new Server(httpServer);
  attachSessions(ioServer);
  await new Promise((r) => httpServer.listen(0, '127.0.0.1', r));
  const LOCAL = `http://127.0.0.1:${httpServer.address().port}`;
  const ldm = await connect(LOCAL);
  const lgm = await call(ldm, 'create-game', { universeId: 'alien' });
  const lp1 = await connect(LOCAL);
  const lp2 = await connect(LOCAL);
  const ltv = await connect(LOCAL);
  await call(lp1, 'join-game', { code: lgm.code, playerName: 'A' });
  await call(lp2, 'join-game', { code: lgm.code, playerName: 'B' });
  await call(ltv, 'join-board', { code: lgm.code });
  const rooms = ioServer.sockets.adapter.rooms;
  ok(rooms.get(lgm.code)?.size === 3 && rooms.get(`${lgm.code}:board`)?.size === 1, 'game + board rooms populated');
  const endSeen = once(lp1, 'game-ended');
  ok((await call(ldm, 'end-game', { code: lgm.code, dmToken: lgm.dmToken })).success, 'end-game ok');
  await endSeen; checks++;
  await sleep(100);
  ok(!rooms.get(lgm.code) && !rooms.get(`${lgm.code}:board`), 'no socket left in the game rooms');
  ok([...ioServer.sockets.sockets.values()].every((s) => !s.data?.code), 'socket.data cleared on every socket');
  ok((await call(lp1, 'player-message', { gameCode: lgm.code, text: 'hi' })).error, 'ended game refuses player events');
  for (const s of [ldm, lp1, lp2, ltv]) s.close();
  ioServer.close();
  rmSync(process.env.DATA_DIR, { recursive: true, force: true });

  console.log(`test-hardening: ${checks} checks passed`);
  rmSync(DATA, { recursive: true, force: true });
  process.exit(0);
} catch (e) {
  console.error('FAIL:', e.stack || e.message);
  if (stderr) console.error('--- server stderr ---\n' + stderr.slice(-3000));
  if (server) await killServer().catch(() => {});
  rmSync(DATA, { recursive: true, force: true });
  process.exit(1);
}
