#!/usr/bin/env node
/* Table-action regression test: token-take (+ GM undo) and roll-request.
   Spawns the server with a temp DATA_DIR and checks:
   - token-take: only an unlocked, visible 'item' token in the player's own room
     (same level) can be taken; it leaves the board for everyone, lands in the
     seat's gear, logs a 'loot' entry with takeId; the TV/phones stop seeing it
   - token-take-undo (DM only): the token comes back, the item leaves the gear,
     a second undo is refused
   - roll-request: DM only, skill validated, difficulty optional integer;
     only the addressed phones get `roll-requested`; open requests are in the
     player table view; a player-roll with requestId tags the DM's roll entry
     and closes the request for that player; a foreign/unknown requestId is
     ignored (the roll still lands); roll-request-cancel drops it from phones
   - open requests and takes survive a restart (snapshot)
   Usage: node scripts/test-table-actions.mjs */
import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert/strict';
import { io } from 'socket.io-client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4400 + Math.floor(Math.random() * 90);
const DATA = mkdtempSync(join(tmpdir(), 'table-actions-'));
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
const latest = (s, ev, key) => { const box = { v: null }; s.on(ev, (d) => { box.v = d?.[key] ?? null; }); return box; };

const MAPDEF = {
  id: 'test-deck', kind: 'image', src: '/x.webp',
  levels: [{ id: 'upper', label: 'UPPER' }, { id: 'lower', label: 'LOWER' }],
  rooms: [
    { id: 'galley', name: 'GALLEY', level: 'upper', shape: { type: 'rect', x: 0, y: 0, w: 0.4, h: 0.4 } },
    { id: 'medlab', name: 'MEDLAB', level: 'upper', shape: { type: 'rect', x: 0.5, y: 0.5, w: 0.4, h: 0.4 } },
    { id: 'hold', name: 'HOLD', level: 'lower', shape: { type: 'rect', x: 0, y: 0, w: 0.4, h: 0.4 } },
  ],
};

try {
  await startServer();
  const dm = await connect();
  const created = await call(dm, 'create-game', { universeId: 'alien' });
  const code = created.code;
  const dmLog = collect(dm, 'log-entry');
  const dmRolls = collect(dm, 'roll');
  const dmTable = latest(dm, 'table-state', 'table');
  const pA = await connect();
  const pB = await connect();
  const tv = await connect();
  const jA = await call(pA, 'join-game', { code, playerName: 'Alice' });
  const jB = await call(pB, 'join-game', { code, playerName: 'Bob' });
  await call(tv, 'join-board', { code });
  const tvBoard = latest(tv, 'board-state', 'board');
  const aTable = latest(pA, 'table-state', 'table');
  const bTable = latest(pB, 'table-state', 'table');
  const aStatus = latest(pA, 'status-updated', 'player');

  /* ── Setup: map, characters, tokens ── */
  ok((await call(dm, 'board-set-map', { gameCode: code, mapId: 'test-deck', level: 'upper', mapDef: MAPDEF })).success, 'map set');
  for (const [j, name] of [[jA, 'Varga'], [jB, 'Okafor']]) {
    ok((await call(dm, 'assign-character', { gameCode: code, playerId: j.playerId, character: { id: name.toLowerCase(), name, gear: ['Flashlight'] }, tracks: { health: 3 }, trackMax: { health: 3 } })).success, `${name} assigned`);
  }
  // A take before the PC is on the map is refused (fog: the item is invisible until its room is revealed).
  await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'it-rifle', kind: 'item', label: 'Pulse Rifle', x: 0.2, y: 0.2, level: 'upper' } });
  eq((await call(pA, 'token-take', { tokenId: 'it-rifle' })).error, 'NOTHING TO TAKE.', 'item in a fogged room is invisible');
  await call(dm, 'board-room-set', { gameCode: code, roomId: 'galley', revealed: true });
  await call(dm, 'board-room-set', { gameCode: code, roomId: 'hold', revealed: true });
  eq((await call(pA, 'token-take', { tokenId: 'it-rifle' })).error, 'YOU ARE NOT ON THE MAP.', 'no PC token → refused');
  await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'pc-a', kind: 'pc', label: 'Varga', ownerPlayerId: jA.playerId, x: 0.1, y: 0.1, level: 'upper' } });
  await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'pc-b', kind: 'pc', label: 'Okafor', ownerPlayerId: jB.playerId, x: 0.7, y: 0.7, level: 'upper' } });
  await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'it-locked', kind: 'item', label: 'Keycard', x: 0.3, y: 0.3, level: 'upper', locked: true } });
  await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'it-hidden', kind: 'item', label: 'Secret', x: 0.25, y: 0.25, level: 'upper', hidden: true } });
  await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'it-med', kind: 'item', label: 'Medkit', x: 0.6, y: 0.6, level: 'upper' } });
  await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'it-low', kind: 'item', label: 'Crate', x: 0.2, y: 0.2, level: 'lower' } });
  await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'npc-1', kind: 'npc', label: 'Ash', x: 0.15, y: 0.15, level: 'upper' } });
  await sleep(120);
  ok(tvBoard.v?.tokens?.['it-rifle'], 'TV sees the rifle (galley revealed by the PC)');
  eq(tvBoard.v.tokens['it-locked'].locked, true, 'locked flag is public (phones can show ASK)');

  /* ── token-take validation ── */
  eq((await call(pA, 'token-take', { tokenId: 'it-med' })).error, 'NOT IN YOUR ROOM.', 'item in another room refused');
  eq((await call(pA, 'token-take', { tokenId: 'it-low' })).error, 'NOT IN YOUR ROOM.', 'item on another level refused');
  eq((await call(pA, 'token-take', { tokenId: 'it-locked' })).error, 'ASK THE GM.', 'locked item refused');
  eq((await call(pA, 'token-take', { tokenId: 'it-hidden' })).error, 'NOTHING TO TAKE.', 'hidden item refused');
  eq((await call(pA, 'token-take', { tokenId: 'npc-1' })).error, 'NOTHING TO TAKE.', 'non-item token refused');
  eq((await call(pA, 'token-take', { tokenId: 'pc-a' })).error, 'NOTHING TO TAKE.', 'PC token refused');
  eq((await call(pA, 'token-take', { tokenId: '__proto__' })).error, 'NOTHING TO TAKE.', 'prototype id refused');
  eq((await call(pA, 'token-take', { tokenId: 'nope' })).error, 'NOTHING TO TAKE.', 'unknown id refused');
  ok((await call(dm, 'token-take', { gameCode: code, tokenId: 'it-rifle' })).error, 'DM socket cannot token-take');
  ok((await call(tv, 'token-take', { tokenId: 'it-rifle' })).error, 'TV cannot token-take');

  /* ── token-take success ── */
  const recv = once(pA, 'item-received');
  const tvGone = once(tv, 'board-state', 3000, (d) => d.board && !d.board.tokens['it-rifle']);
  const take = await call(pA, 'token-take', { tokenId: 'it-rifle' });
  ok(take.success && take.item === 'Pulse Rifle' && /^take-/.test(take.takeId), 'rifle taken');
  eq((await recv).item, 'Pulse Rifle', 'phone gets item-received');
  await tvGone; checks++;
  await sleep(120);
  eq(aStatus.v.inventory, ['Flashlight', 'Pulse Rifle'], 'rifle in the seat gear');
  const lootEntry = dmLog.map((e) => e.entry).find((e) => e.type === 'loot' && e.takeId === take.takeId);
  ok(lootEntry && /Varga took Pulse Rifle \(GALLEY\)/.test(lootEntry.text), 'loot log entry with takeId + room name');
  ok(dmTable.v.takes.some((t) => t.id === take.takeId && !t.undone), 'DM table lists the take');
  ok(!('takes' in aTable.v) && !('takes' in (await call(tv, 'table-sync', {})).table), 'takes are DM-only');
  eq((await call(pA, 'token-take', { tokenId: 'it-rifle' })).error, 'NOTHING TO TAKE.', 'cannot take twice');
  eq((await call(pB, 'token-take', { tokenId: 'it-med' })).success, true, 'Bob takes the medkit in his room');

  /* ── GM undo ── */
  ok((await call(pA, 'token-take-undo', { gameCode: code, takeId: take.takeId })).error, 'players cannot undo');
  const tvBack = once(tv, 'board-state', 3000, (d) => d.board?.tokens['it-rifle']);
  const undo = await call(dm, 'token-take-undo', { gameCode: code, takeId: take.takeId });
  ok(undo.success && undo.tokenId === 'it-rifle', 'undo ok, same token id');
  const back = (await tvBack).board.tokens['it-rifle'];
  eq([back.x, back.y, back.roomId], [0.2, 0.2, 'galley'], 'token back where it was');
  await sleep(120);
  eq(aStatus.v.inventory, ['Flashlight'], 'item left the gear');
  ok((await call(dm, 'token-take-undo', { gameCode: code, takeId: take.takeId })).error, 'second undo refused');
  ok((await call(dm, 'token-take-undo', { gameCode: code, takeId: '__proto__' })).error, 'unknown take refused');
  ok(dmLog.some((e) => e.entry.type === 'loot' && e.entry.undo && e.entry.takeId === take.takeId), 'undo logged');
  // Undo when the GM reused the id meanwhile: restored under a fresh id.
  const take2 = await call(pA, 'token-take', { tokenId: 'it-rifle' });
  await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'it-rifle', kind: 'marker', x: 0.9, y: 0.1 } });
  const undo2 = await call(dm, 'token-take-undo', { gameCode: code, takeId: take2.takeId });
  ok(undo2.success && undo2.tokenId !== 'it-rifle' && undo2.tokenId.startsWith('it-rifle-'), 'id clash → restored under a fresh id');

  /* ── roll-request ── */
  ok((await call(pA, 'roll-request', { gameCode: code, skill: 'observation', to: 'all' })).error, 'players cannot request rolls');
  for (const bad of [{ skill: '' }, { skill: 5 }, { skill: '__proto__' }, { skill: 'a b' }, { skill: 'x'.repeat(41) }, { skill: 'stamina', difficulty: 2.5 }, { skill: 'stamina', difficulty: 99 }, { skill: 'stamina', to: ['p_nobody'] }]) {
    ok((await call(dm, 'roll-request', { gameCode: code, ...bad })).error, `bad request rejected ${JSON.stringify(bad).slice(0, 40)}`);
  }
  const bGotNothing = collect(pB, 'roll-requested');
  const aGets = once(pA, 'roll-requested');
  const rq = await call(dm, 'roll-request', { gameCode: code, skill: 'observation', label: 'Observation', difficulty: -1, note: 'Something moved in the vents.', to: jA.playerId });
  ok(rq.success && /^rq-/.test(rq.id), 'roll-request ok');
  eq(rq.sent, [jA.playerId], 'sent to Alice only');
  const got = (await aGets).request;
  eq({ ...got, at: 0 }, { id: rq.id, skill: 'observation', label: 'Observation', difficulty: -1, note: 'Something moved in the vents.', at: 0 }, 'phone gets the request');
  await sleep(120);
  eq(bGotNothing.length, 0, 'Bob gets nothing');
  eq(aTable.v.rollRequests.map((r) => r.id), [rq.id], 'open request in Alice table view');
  eq(bTable.v.rollRequests, [], 'none in Bob table view');
  ok(!('recipients' in aTable.v.rollRequests[0]) && !('answeredBy' in aTable.v.rollRequests[0]), 'phone view has no receipts');
  ok(dmLog.some((e) => e.entry.type === 'roll' && e.entry.requestId === rq.id && /Varga.*Observation.*difficulty -1/.test(e.entry.text)), 'request logged');

  // Bob answering Alice's request: roll lands, untagged.
  const bRoll = await call(pB, 'player-roll', { clientId: 'c-b-1', requestId: rq.id, roll: { summary: 'OBSERVATION — 1 success' } });
  ok(bRoll.success && !bRoll.requestId, 'foreign requestId ignored, roll kept');
  const aRollEvt = once(dm, 'roll', 3000, (d) => d.roll.playerId === jA.playerId);
  const aRoll = await call(pA, 'player-roll', { clientId: 'c-a-1', requestId: rq.id, roll: { summary: 'OBSERVATION — 2 successes' } });
  ok(aRoll.success && aRoll.requestId === rq.id, 'answer acked with requestId');
  eq((await aRollEvt).roll.requestId, rq.id, 'DM roll entry tagged with requestId');
  ok(!dmRolls.find((d) => d.roll.playerId === jB.playerId).roll.requestId, 'Bob roll untagged');
  await sleep(120);
  eq(aTable.v.rollRequests, [], 'answered request leaves Alice view');
  eq(dmTable.v.rollRequests.find((r) => r.id === rq.id).answeredBy, [jA.playerId], 'DM sees who answered');
  const again = await call(pA, 'player-roll', { clientId: 'c-a-2', roll: { summary: 'x', requestId: rq.id } });
  ok(again.success && !again.requestId, 'second answer is a plain roll');

  // Everyone + cancel.
  const all = await call(dm, 'roll-request', { gameCode: code, skill: 'stamina', to: 'all' });
  eq(all.sent.sort(), [jA.playerId, jB.playerId].sort(), 'to all → every seat');
  await sleep(120);
  eq(bTable.v.rollRequests.map((r) => r.id), [all.id], 'Bob sees the group request');
  eq(bTable.v.rollRequests[0].difficulty, null, 'no difficulty → null');
  eq(bTable.v.rollRequests[0].label, 'stamina', 'label defaults to the skill key');
  ok((await call(dm, 'roll-request-cancel', { gameCode: code, id: all.id })).success, 'cancel ok');
  ok((await call(pA, 'roll-request-cancel', { gameCode: code, id: all.id })).error, 'players cannot cancel');
  await sleep(120);
  eq(bTable.v.rollRequests, [], 'cancelled request leaves the phones');
  const late = await call(pB, 'player-roll', { clientId: 'c-b-2', requestId: all.id, roll: { summary: 'late' } });
  ok(late.success && !late.requestId, 'answer to a cancelled request is a plain roll');

  /* ── Persistence ── */
  const open = await call(dm, 'roll-request', { gameCode: code, skill: 'survival', to: [jB.playerId] });
  await sleep(600);
  for (const s of sockets) s.close();
  await killServer();
  await startServer();
  const pB2 = await connect();
  const rj = await call(pB2, 'rejoin-game', { code, playerToken: jB.playerToken });
  eq(rj.table.rollRequests.map((r) => r.id), [open.id], 'open request survives a restart');
  const dm2 = await connect();
  const res = await call(dm2, 'resume-game', { code, dmToken: created.dmToken });
  ok(res.table.takes.length === 3 && res.table.takes.filter((t) => t.undone).length === 2, 'takes persisted');
  eq(rj.player.inventory, ['Flashlight', 'Medkit'], 'taken item persisted in gear');
  await call(dm2, 'end-game', { code, dmToken: created.dmToken });

  ok(!/\[SOCKET\] handler/.test(stderr), 'no handler threw');
  console.log(`test-table-actions: ${checks} checks passed`);
} catch (err) {
  console.error('test-table-actions FAILED:', err);
  if (stderr) console.error('--- server stderr ---\n' + stderr.slice(-3000));
  process.exitCode = 1;
} finally {
  for (const s of sockets) { try { s.close(); } catch { /* ignore */ } }
  if (server) await killServer();
  try { rmSync(DATA, { recursive: true, force: true }); } catch { /* ignore */ }
}
