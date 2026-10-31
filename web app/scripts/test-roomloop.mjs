#!/usr/bin/env node
/* AI GM room loop — player-enter-room, room-entered, ai-gm-set, review / live reactions
   (server/sessions.js + gm.js enter-room; docs/AI_GM.md "Room entry"). Real Cronus engine
   plan (doors, locked doors, two decks), a MOCK OpenAI chat server (enter-room narration +
   AI BUILD plans) and a MOCK speech server (Kokoro-style). Checks: adjacency through
   unlocked doors only, same level, from outside every room only into the spawn room, GM
   `open` rooms, rate limit, room-entered to the DM only, GM drag debounce (one event for the
   final room), fog auto-reveal, visit counts, review drafts (DM only), live narration
   caption + voice to the TV + roll-request to the entering player only (first visit only),
   hidden creatures never reach players, players' table view carries aiGm.entry only,
   snapshot round-trip of aiGm + aiPlan + visitedRooms. The real GPU box is never called.
   Usage: node scripts/test-roomloop.mjs */
import { spawn } from 'child_process';
import { createServer as createHttpServer } from 'http';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import assert from 'assert/strict';
import { io } from 'socket.io-client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = mkdtempSync(join(tmpdir(), 'roomloop-'));
const PORT = 3191;
const URL = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

const board = await import(pathToFileURL(join(ROOT, 'server/board.js')).href);
const { maps } = await import(pathToFileURL(join(ROOT, 'src/universes/alien/maps/index.js')).href);
const m = maps.find((x) => x.id === 'uscss-cronus');
const MAPDEF = { id: m.id, title: m.title, kind: 'engine', engine: m.id, size: m.size, levels: m.levels, rooms: m.rooms, doors: m.doors, outline: m.outline, crop: m.crop, spawn: m.spawn, grid: m.grid };
const md = board.sanitizeMapDef(MAPDEF).mapDef;
const roomName = (id) => md.rooms.find((r) => r.id === id).name;
const SPAWN = 'main-docking-airlock';
const CORR = 'main-main-corridor';

/* ── mocks ── */
const MODEL = 'mock-gm:test';
const chat = { requests: [], enter: 0 };
const chunkLine = (content) => `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`;
const tts = { speech: [] };
function fakeMp3(frames) {
  const frame = Buffer.alloc(417);
  frame[0] = 0xff; frame[1] = 0xfb; frame[2] = 0x90; frame[3] = 0x64;
  return Buffer.concat(Array.from({ length: frames }, () => frame));
}
const mock = createHttpServer((req, res) => {
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', async () => {
    const j = body ? JSON.parse(body) : {};
    if (req.method === 'POST' && req.url === '/free') { res.writeHead(200); return res.end('{}'); }
    if (req.method === 'GET' && req.url === '/system_stats') { res.writeHead(200); return res.end('{"system":{}}'); }
    if (req.method === 'GET' && req.url === '/api/ps') { res.writeHead(200); return res.end('{"models":[]}'); }
    if (req.method === 'GET' && req.url === '/v1/models') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ data: [{ id: MODEL }] })); }
    if (req.method === 'GET' && req.url === '/v1/audio/voices') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ voices: ['bm_george', 'bf_emma', 'af_heart'] })); }
    if (req.method === 'POST' && req.url === '/v1/audio/speech') {
      tts.speech.push(j);
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
      return res.end(fakeMp3(4));
    }
    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      chat.requests.push(j);
      const user = j.messages?.[1]?.content || '';
      let text;
      if (user.includes('TASK (enter-room)')) {
        chat.enter++;
        const room = /^The room: (.+?)(?: \(|$)/m.exec(user)?.[1] || '?';
        text = `ENTER-NARRATION ${room}. The hatch sighs shut behind you.`;
      } else {
        const ids = [...user.matchAll(/^- ([a-z0-9-]+) \|/gm)].map((x) => x[1]);
        const rooms = {};
        for (const id of ids) {
          rooms[id] = { mood: 'cold', description: `DESC ${id}.`, tokens: [{ kind: 'item', label: `Crate ${id}`, glyph: 'crate', hidden: false, note: 'GM-ITEM-NOTE' }], check: { skill: 'observation', difficulty: -1, label: 'Spot the movement', success: 'ok', failure: 'bad' } };
          if (id === 'main-science-lab') rooms[id].tokens.push({ kind: 'creature', label: 'Neomorph', glyph: 'claw', hidden: true, note: 'GM-CREATURE-NOTE' });
          if (id === CORR) rooms[id].check = null;
        }
        text = JSON.stringify({ rooms });
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(chunkLine(text.slice(0, 10)));
      res.write(chunkLine(text.slice(10)));
      res.write('data: [DONE]\n\n');
      return res.end();
    }
    res.writeHead(404); res.end();
  });
});
await new Promise((r) => mock.listen(0, '127.0.0.1', r));
const MOCK_ROOT = `http://127.0.0.1:${mock.address().port}`;

let server = null;
async function startServer() {
  server = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, API_TOKEN: '', GM_URL: `${MOCK_ROOT}/v1`, GM_MODEL: MODEL, COMFY_URL: MOCK_ROOT, TTS_URL: `${MOCK_ROOT}/v1`, TTS_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
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
const sockets = [];
const connect = () => new Promise((res, rej) => {
  const s = io(URL, { transports: ['websocket'], reconnection: false });
  sockets.push(s);
  s.on('connect', () => res(s));
  s.on('connect_error', rej);
});
const call = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, res));
function track(s) {
  s.boardState = null; s.table = null; s.raw = []; s.ev = {};
  s.on('board-state', (d) => { s.boardState = d.board; s.raw.push(JSON.stringify(d)); });
  s.on('table-state', (d) => { s.table = d.table; s.raw.push(JSON.stringify(d)); });
  for (const e of ['room-entered', 'ai-gm-draft', 'roll-requested', 'table-speak', 'table-speak-part']) s.on(e, (d) => { (s.ev[e] ||= []).push(d); s.raw.push(JSON.stringify(d)); });
  return s;
}
const evs = (s, e) => s.ev[e] || [];
async function until(pred, label, ms = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (pred()) return; await sleep(20); }
  throw new Error('timeout: ' + label);
}
const post = (path, body) => fetch(URL + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
const centre = (id) => board.roomCentroid(md, id);

try {
  await startServer();
  const dm = track(await connect());
  const created = await call(dm, 'create-game', { universeId: 'alien', packId: 'chariot-of-the-gods' });
  const { code, dmToken } = created;
  const tv = track(await connect());
  ok((await call(tv, 'join-board', { code })).success, 'TV joined');
  const pA = track(await connect());
  const pB = track(await connect());
  const jA = await call(pA, 'join-game', { code, playerName: 'Alice' });
  const jB = await call(pB, 'join-game', { code, playerName: 'Bob' });
  for (const [j, name] of [[jA, 'Rye'], [jB, 'Okafor']]) {
    ok((await call(dm, 'assign-character', { gameCode: code, playerId: j.playerId, character: { id: name.toLowerCase(), name, career: 'Pilot', gear: [] }, tracks: {}, trackMax: {} })).success, `${name} assigned`);
  }
  ok((await call(dm, 'board-set-map', { gameCode: code, mapId: md.id, level: 'main', mapDef: MAPDEF })).success, 'Cronus on the board');

  // ai-gm-set
  ok((await call(pA, 'ai-gm-set', { entry: 'live' })).error, 'player cannot ai-gm-set');
  ok((await call(dm, 'ai-gm-set', { entry: 'loud' })).error, 'bad entry mode rejected');
  ok((await call(dm, 'ai-gm-set', { voice: 'yes' })).error, 'voice must be boolean');
  eq((await call(dm, 'ai-gm-set', { entry: 'review' })).aiGm, { entry: 'review', voice: false }, 'ai-gm-set review');
  await until(() => pA.table?.aiGm?.entry === 'review', 'player sees aiGm.entry');
  eq(pA.table.aiGm, { entry: 'review' }, 'player table: aiGm.entry only (no voice)');
  ok(pA.table.aiPlan === undefined && pA.table.visitedRooms === undefined, 'player table: no aiPlan / visitedRooms');
  ok(tv.table.aiGm === undefined, 'TV table: no aiGm');

  // Player not on the map yet
  eq((await call(pA, 'player-enter-room', { roomId: SPAWN })).error, 'YOU ARE NOT ON THE MAP.', 'no PC token → error');
  ok((await call(dm, 'player-enter-room', { roomId: SPAWN })).error, 'the DM socket cannot player-enter-room');
  // PC tokens outside every room (to test the spawn rule), and B at the spawn
  ok((await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'pc-a', kind: 'pc', label: 'Rye', ownerPlayerId: jA.playerId, x: 0.01, y: 0.01 } })).success, 'PC A outside every room');
  const sp = MAPDEF.spawn.pc;
  ok((await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'pc-b', kind: 'pc', label: 'Okafor', ownerPlayerId: jB.playerId, x: sp[0], y: sp[1] } })).success, 'PC B at the spawn');
  await sleep(700);
  eq(evs(dm, 'room-entered').length, 0, 'placing a new PC token is not an entry');

  eq((await call(pA, 'player-enter-room', { roomId: 'nope' })).error, 'UNKNOWN ROOM.', 'unknown room');
  eq((await call(pA, 'player-enter-room', { roomId: CORR })).error, 'NOT ADJACENT.', 'outside every room: only the spawn room');
  eq((await call(pA, 'player-enter-room', { roomId: 'lower-sensor-bay' })).error, 'NOT ADJACENT.', 'other deck → not adjacent');
  ok(!tv.boardState.rooms[CORR]?.revealed, 'corridor still in fog for the TV');
  const e1 = await call(pA, 'player-enter-room', { roomId: SPAWN });
  eq(e1, { success: true, roomId: SPAWN, name: roomName(SPAWN) }, 'outside → spawn room: ack { success, roomId, name }');
  await until(() => evs(dm, 'room-entered').length === 1, 'DM gets room-entered');
  const re = evs(dm, 'room-entered')[0];
  eq([re.playerId, re.tokenId, re.roomId, re.fromRoomId, re.name, re.roomName, re.visits, re.by], [jA.playerId, 'pc-a', SPAWN, null, 'Rye', roomName(SPAWN), 1, 'player'], 'room-entered payload');
  ok(Number.isFinite(re.at), 'room-entered.at');
  ok(!evs(pA, 'room-entered').length && !evs(pB, 'room-entered').length && !evs(tv, 'room-entered').length, 'room-entered goes to the DM only');
  await until(() => dm.boardState.tokens['pc-a'].roomId === SPAWN, 'PC A token moved');
  const a = dm.boardState.tokens['pc-a'];
  eq(board.roomAt(md, a.x, a.y, 'main'), SPAWN, 'token placed inside the room');
  const b = dm.boardState.tokens['pc-b'];
  ok(Math.hypot(a.x - b.x, a.y - b.y) > 0.005, 'jittered away from the other PC');
  ok(Number.isFinite(a.lastMovedAt), 'lastMovedAt set');

  // review draft
  await until(() => evs(dm, 'ai-gm-draft').length === 1, 'review: draft to the DM');
  const d1 = evs(dm, 'ai-gm-draft')[0];
  eq([d1.kind, d1.mode, d1.roomId, d1.roomName, d1.playerId, d1.check, d1.provider], ['enter-room', 'review', SPAWN, roomName(SPAWN), jA.playerId, null, 'local'], 'draft payload (no plan → no check)');
  ok(d1.text.startsWith(`ENTER-NARRATION ${roomName(SPAWN)}`) && d1.id && d1.at, 'draft text from the model');
  await sleep(100);
  ok(!evs(pA, 'ai-gm-draft').length && !evs(tv, 'ai-gm-draft').length && !tv.table.narration, 'review: nothing reaches the table');
  const enterReq = chat.requests.find((r) => r.messages[1].content.includes('TASK (enter-room)'));
  ok(enterReq.messages[1].content.includes('Who enters: Rye') && enterReq.messages[1].content.includes('first time anyone enters'), 'enter-room prompt: who + first visit');

  // rate limit, adjacency, locked door
  eq((await call(pA, 'player-enter-room', { roomId: CORR })).error, 'RATE LIMITED.', 'second move within 2 s → rate limited');
  await sleep(2050);
  eq((await call(pA, 'player-enter-room', { roomId: 'main-bridge' })).error, 'NOT ADJACENT.', 'airlock → bridge: no door');
  ok((await call(pA, 'player-enter-room', { roomId: CORR })).success, 'airlock → corridor through an unlocked door');
  await until(() => tv.boardState.rooms[CORR]?.revealed, 'fog: corridor revealed for the TV on entry');
  await sleep(2050);
  eq((await call(pA, 'player-enter-room', { roomId: 'main-crew-quarters' })).error, 'DOOR LOCKED.', 'corridor → crew quarters: locked door');
  eq((await call(pA, 'player-enter-room', { roomId: CORR })).error, 'ALREADY HERE.', 'already in the room');
  ok((await call(dm, 'board-room-set', { gameCode: code, roomId: 'main-crew-quarters', open: true })).success, 'GM flags the crew quarters open');
  await until(() => pA.boardState.rooms['main-crew-quarters']?.open === true, 'players see the open flag');
  ok((await call(pA, 'player-enter-room', { roomId: 'main-crew-quarters' })).success, 'open room: enterable through the locked door');
  await until(() => evs(dm, 'ai-gm-draft').length === 3, 'drafts for each entry');
  eq(dm.table.visitedRooms, { [SPAWN]: 1, [CORR]: 1, 'main-crew-quarters': 1 }, 'visitedRooms counted (DM view)');

  // AI BUILD: plan + apply the science lab (hidden creature, visible crate, check)
  const built = await (await post('/api/gm/build', { code, dmToken, density: 'normal' })).json();
  eq(built.provider, 'local', 'build via mock');
  const ap = await (await post('/api/gm/build/apply', { code, dmToken, rooms: ['main-science-lab', 'main-bridge', CORR] })).json();
  ok(ap.applied.tokens >= 4, 'applied');
  // visible plan item that the GM hid by hand: un-hidden on first entry
  const findCrate = () => Object.values(dm.boardState.tokens).find((t) => t.ai && t.aiRoom === 'main-science-lab' && t.kind === 'item');
  await until(() => findCrate(), 'DM board has the crate');
  const crate = findCrate();
  ok((await call(dm, 'board-token-upsert', { gameCode: code, token: { id: crate.id, hidden: true } })).success, 'GM hides the planned-visible crate');

  // live + voice
  eq((await call(dm, 'ai-gm-set', { entry: 'live', voice: true })).aiGm, { entry: 'live', voice: true }, 'ai-gm-set live + voice');
  await sleep(2050);
  // B: airlock → corridor (visit 2, corridor plan has no check)
  ok((await call(pB, 'player-enter-room', { roomId: CORR })).success, 'B enters the corridor (second visit)');
  await until(() => evs(dm, 'ai-gm-draft').length === 4, 'live draft (corridor)');
  const d4 = evs(dm, 'ai-gm-draft')[3];
  eq([d4.mode, d4.visits, d4.check, d4.sent.rollRequestId], ['live', 2, null, null], 'second visit: no check, no roll request');
  await until(() => tv.table?.narration?.title === roomName(CORR), 'live: caption on the TV titled with the room');
  ok(tv.table.narration.text.includes(`ENTER-NARRATION ${roomName(CORR)}`), 'live: caption text');
  await until(() => evs(tv, 'table-speak').length === 1, 'live + voice: table-speak to the TV');
  eq([evs(tv, 'table-speak')[0].voice, evs(tv, 'table-speak')[0].target], ['bm_george', 'tv'], 'voice = the universe narrator, target tv');
  ok(d4.sent.speechId === evs(tv, 'table-speak')[0].id && d4.sent.narrationId === tv.table.narration.id, 'draft.sent references the caption + speech');
  await until(() => evs(tv, 'table-speak-part').length >= 1 && tts.speech.length >= 1, 'speech synthesized (mock TTS)');
  ok(tts.speech[0].input.includes('ENTER-NARRATION'), 'TTS got the narration');
  const enterReq2 = chat.requests.filter((r) => r.messages[1].content.includes('TASK (enter-room)')).at(-1).messages[1].content;
  ok(enterReq2.includes('visit 2') && enterReq2.includes('Already in the room: Rye') === false, 'enter-room prompt: return visit (Rye has left)');
  ok(enterReq2.includes(`DESC ${CORR}`) && enterReq2.includes(`Crate ${CORR}`), 'enter-room prompt: plan description + visible tokens');

  // B: corridor → science lab (first visit, check, hidden creature)
  ok(!tv.boardState.rooms['main-science-lab']?.revealed, 'science lab fogged');
  await sleep(2050);
  ok((await call(pB, 'player-enter-room', { roomId: 'main-science-lab' })).success, 'B enters the science lab');
  await until(() => evs(pB, 'roll-requested').length === 1, 'live: roll-request reaches B');
  const rq = evs(pB, 'roll-requested')[0].request;
  eq([rq.skill, rq.difficulty, rq.label], ['observation', -1, 'Spot the movement'], 'roll request from the plan check');
  await sleep(150);
  eq(evs(pA, 'roll-requested').length, 0, 'A gets no roll request');
  const d5 = evs(dm, 'ai-gm-draft')[4];
  eq([d5.check.skill, d5.sent.rollRequestId, d5.visits], ['observation', rq.id, 1], 'draft: check + roll request id');
  const enterReq3 = chat.requests.filter((r) => r.messages[1].content.includes('TASK (enter-room)')).at(-1).messages[1].content;
  ok(enterReq3.includes('Unseen here') && enterReq3.includes('Neomorph') && enterReq3.includes('A test follows'), 'enter-room prompt: unseen creature + coming test flagged GM-only');
  ok(!enterReq3.includes('GM-CREATURE-NOTE'), 'enter-room prompt: token notes not included');
  await until(() => tv.boardState.rooms['main-science-lab']?.revealed, 'fog: science lab revealed');
  await until(() => pB.boardState.tokens[crate.id], 'planned-visible crate un-hidden on first entry');
  ok(!Object.values(pB.boardState.tokens).some((t) => t.kind === 'creature') && !Object.values(tv.boardState.tokens).some((t) => t.kind === 'creature'), 'hidden creature never reaches players / TV');
  ok(Object.values(dm.boardState.tokens).some((t) => t.kind === 'creature' && t.hidden && t.aiRoom === 'main-science-lab'), 'creature still hidden on the GM board');
  const leak = (s) => s.raw.some((j) => /GM-CREATURE-NOTE|GM-ITEM-NOTE|"aiPlan"|"visitedRooms"|"ai-gm-draft"|DESC main|"aiRoom"/.test(j));
  ok(!leak(pA) && !leak(pB) && !leak(tv), 'no plan, notes, drafts or ai tags ever reached players / TV');
  eq(dm.table.visitedRooms['main-science-lab'], 1, 'visit counted');

  // GM drag across three rooms → one room-entered for the final one
  await sleep(2050);
  const before = evs(dm, 'room-entered').length;
  const path = [CORR, 'main-medical-bay', 'main-cryo-bay'];
  for (const id of path) {
    const c = centre(id);
    for (let i = 0; i < 4; i++) { dm.emit('board-token-move', { gameCode: code, id: 'pc-a', x: c[0], y: c[1] }); await sleep(40); }
  }
  await sleep(300);
  eq(evs(dm, 'room-entered').length, before, 'no room-entered while the drag is moving');
  await until(() => evs(dm, 'room-entered').length === before + 1, 'drag settles → one room-entered', 2000);
  await sleep(800);
  eq(evs(dm, 'room-entered').length, before + 1, 'exactly one event for the whole drag');
  const rd = evs(dm, 'room-entered').at(-1);
  eq([rd.roomId, rd.fromRoomId, rd.by, rd.playerId, rd.tokenId], ['main-cryo-bay', 'main-crew-quarters', 'gm', jA.playerId, 'pc-a'], 'drag: final room, from the starting room');
  await until(() => evs(dm, 'ai-gm-draft').some((d) => d.roomId === 'main-cryo-bay'), 'drag entry gets a live reaction');
  // drag out and back → nothing
  const n2 = evs(dm, 'room-entered').length;
  const cm = centre('main-medical-bay'); const cc = centre('main-cryo-bay');
  dm.emit('board-token-move', { gameCode: code, id: 'pc-a', x: cm[0], y: cm[1] });
  await sleep(50);
  dm.emit('board-token-move', { gameCode: code, id: 'pc-a', x: cc[0], y: cc[1] });
  await sleep(900);
  eq(evs(dm, 'room-entered').length, n2, 'drag out and back into the same room → no event');

  // off → no reaction
  ok((await call(dm, 'ai-gm-set', { entry: 'off' })).success, 'entry off');
  const drafts = evs(dm, 'ai-gm-draft').length;
  const chats = chat.enter;
  await sleep(2050);
  ok((await call(pB, 'player-enter-room', { roomId: 'main-bridge' })).success, 'science lab → bridge');
  await until(() => evs(dm, 'room-entered').at(-1).roomId === 'main-bridge', 'room-entered still sent when off');
  await sleep(300);
  eq([evs(dm, 'ai-gm-draft').length, chat.enter], [drafts, chats], 'off: no model call, no draft');

  // snapshot round-trip
  ok((await call(dm, 'ai-gm-set', { entry: 'review', voice: true })).success, 'review + voice before restart');
  await sleep(600);
  const visitsBefore = { ...dm.table.visitedRooms };
  const planAt = dm.table.aiPlan.at;
  for (const s of sockets) s.close();
  await killServer();
  await startServer();
  const dm2 = track(await connect());
  const r = await call(dm2, 'resume-game', { code, dmToken });
  ok(r.success, 'DM resumed after restart');
  eq(r.table.aiGm, { entry: 'review', voice: true }, 'aiGm survives the restart');
  eq(r.table.aiPlan.at, planAt, 'aiPlan survives the restart');
  ok(r.table.aiPlan.applied.includes('main-science-lab'), 'aiPlan.applied survives');
  eq({ ...r.table.visitedRooms }, visitsBefore, 'visitedRooms survive the restart');
  const pA2 = track(await connect());
  const rj = await call(pA2, 'rejoin-game', { code, playerToken: jA.playerToken });
  ok(rj.success, 'player rejoined');
  eq(rj.table.aiGm, { entry: 'review' }, 'player seat payload: aiGm.entry only');
  ok(rj.table.aiPlan === undefined && rj.table.visitedRooms === undefined, 'player seat payload: no plan / visits');
  await sleep(2050);
  ok((await call(pA2, 'player-enter-room', { roomId: 'main-medical-bay' })).success, 'room loop works after the restart (cryo → medical bay)');
  await until(() => evs(dm2, 'ai-gm-draft').length === 1, 'review draft after restart');

  console.log(`test-roomloop: ${checks} checks passed`);
} finally {
  for (const s of sockets) s.close();
  if (server) await killServer().catch(() => {});
  mock.closeAllConnections?.();
  mock.close();
  await sleep(100);
  try { rmSync(DATA, { recursive: true, force: true }); } catch { /* ignore */ }
}
process.exit(0);
