#!/usr/bin/env node
/* Table-board regression test (docs/BOARD_AND_BUILDER.md §2). Spawns the
   server with a temp DATA_DIR; DM + board client + two players; Montero map;
   fog/visibility filtering, PC auto-reveal, hide, fog off, ping rate limit,
   then kills + restarts the server and checks the board state is restored.
   Usage: node scripts/test-board.mjs */
import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import assert from 'assert/strict';
import { io } from 'socket.io-client';
import { roomAt, sanitizeMapDef, viewFor, emptyBoard } from '../server/board.js';
import { buildAsciiMapDef } from '../src/engine/maps/asciiMap.js';
import { readFileSync } from 'fs';
import { validatePack } from '../server/schema/validate.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4000 + Math.floor(Math.random() * 90);
const DATA = mkdtempSync(join(tmpdir(), 'board-test-'));
const URL = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

const { maps } = await import(pathToFileURL(join(ROOT, 'src/universes/alien/maps/index.js')).href);
const montero = maps.find((m) => m.id === 'uscss-montero');
/* What the DM client sends (resolveMapDef in src/engine/components/board/mapDefs.js). */
const MAPDEF = {
  id: montero.id, title: montero.title, subtitle: montero.subtitle, kind: 'engine', engine: montero.id,
  size: montero.size, levels: montero.levels, rooms: montero.rooms, outline: montero.outline,
  crop: montero.crop, spawn: montero.spawn, grid: montero.grid,
};
const center = (id) => {
  const s = montero.rooms.find((r) => r.id === id).shape;
  return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
};

/* ── Pure function checks ── */
{
  const { mapDef, error } = sanitizeMapDef(MAPDEF);
  ok(!error && mapDef.rooms.length === montero.rooms.length, 'Montero mapDef sanitizes with every room');
  ok(mapDef.levels.length === 3, 'three decks');
  ok(new Set(montero.rooms.map((r) => r.id)).size === montero.rooms.length, 'room ids unique');
  for (const lvl of ['deck-a', 'deck-b', 'deck-c']) ok(montero.rooms.some((r) => r.level === lvl), `${lvl} has rooms`);
  const mb = center('deck-a-medlab');
  eq(roomAt(mapDef, mb.x, mb.y, 'deck-a'), 'deck-a-medlab', 'hit-test medlab on deck A');
  eq(roomAt(mapDef, mb.x, mb.y, 'deck-b'), 'deck-b-reactor', 'same point on deck B is the reactor room');
  const ja = center('deck-a-junction-aft');
  eq(roomAt(mapDef, ja.x, ja.y, 'deck-a'), 'deck-a-junction-aft', 'smallest room wins (shaft inside corridor span)');
  eq(roomAt(mapDef, 0.01, 0.01, 'deck-a'), null, 'outside every room');
  const poly = sanitizeMapDef({ id: 'p', kind: 'image', src: '/x.webp', rooms: [{ id: 'tri', name: 'T', shape: { type: 'poly', points: [[0, 0], [1, 0], [0, 1]] } }] }).mapDef;
  eq(roomAt(poly, 0.2, 0.2), 'tri', 'poly hit');
  eq(roomAt(poly, 0.8, 0.8), null, 'poly miss');
  ok(sanitizeMapDef({ id: 'bad', kind: 'image', src: '/x', rooms: [{ id: 'r', shape: { type: 'rect', x: 0.9, y: 0, w: 0.5, h: 0.1 } }] }).mapDef.rooms.length === 0, 'out-of-range rect dropped');
  ok(sanitizeMapDef({ id: 'Bad Id' }).error, 'bad map id rejected');
  const b = emptyBoard();
  b.tokens.h = { id: 'h', kind: 'creature', hidden: true, roomId: null };
  b.tokens.p = { id: 'p', kind: 'pc', hidden: false, roomId: null, note: 'gm only' };
  const v = viewFor(b, 'board');
  ok(!v.tokens.h && v.tokens.p && v.tokens.p.note === undefined, 'viewFor drops hidden tokens and notes');
  // QA 2026-10-30: fog only covers room shapes, so a non-PC token outside every room (or on a map
  // with no rooms at all, e.g. ASCII maps) is visible; one inside an unrevealed room is not.
  b.tokens.c = { id: 'c', kind: 'creature', hidden: false, roomId: null };
  b.tokens.f = { id: 'f', kind: 'creature', hidden: false, roomId: 'deck-a-galley' };
  const v2 = viewFor(b, 'board');
  ok(b.fog && v2.tokens.c && !v2.tokens.f, 'fog: out-of-room creature visible, creature in unrevealed room hidden');
  // The universe map validates against the extended pack schema (as a map inside a maps overlay pack).
  const pack = { packVersion: 1, id: 'board-test-maps', universe: 'alien', kind: 'maps', meta: { title: 'T', tagline: 't' }, maps: [{ ...MAPDEF }] };
  const res = validatePack(pack);
  ok(res.ok, 'maps overlay pack with Montero rooms is schema-valid: ' + res.errors.join('; '));
}

/* ── Every bundled engine plan, both universes: board geometry sanity (R4 map audit 2026-10-31) ──
   rooms inside 0..1 and inside the crop, unique ids, every level has rooms, every room's level exists,
   the default spawn and each per-level spawn lie inside a room of that level, doors join two rooms of
   their level and sit on the `from` room's wall, the outline stays inside the crop, and the mapDef
   the GM client sends sanitizes with every room and door. */
for (const uni of ['alien', 'dune']) {
  const { maps: uMaps } = await import(pathToFileURL(join(ROOT, `src/universes/${uni}/maps/index.js`)).href);
  for (const m of uMaps.filter((x) => x.kind === 'engine')) {
    const tag = `${uni}/${m.id}`;
    const lv = (m.levels || []).map((l) => l.id);
    const ids = new Set(m.rooms.map((r) => r.id));
    ok(ids.size === m.rooms.length, `${tag}: room ids unique`);
    const c = m.crop || { x: 0, y: 0, w: 1, h: 1 };
    const e = 1e-4;
    const bad = m.rooms.filter(({ shape: s }) => s.x < -e || s.y < -e || s.x + s.w > 1 + e || s.y + s.h > 1 + e
      || s.x < c.x - e || s.y < c.y - e || s.x + s.w > c.x + c.w + e || s.y + s.h > c.y + c.h + e);
    ok(!bad.length, `${tag}: rooms inside 0..1 and the crop (${bad.map((r) => r.id).join(', ')})`);
    ok(m.rooms.every((r) => lv.includes(r.level)), `${tag}: every room's level is listed`);
    ok(lv.every((l) => m.rooms.some((r) => r.level === l)), `${tag}: every level has rooms`);
    const def = { ...m, kind: 'engine', engine: m.id };
    ok(m.spawn?.pc && roomAt(def, m.spawn.pc[0], m.spawn.pc[1], lv[0]), `${tag}: default spawn inside a room on ${lv[0]}`);
    for (const [l, sp] of Object.entries(m.spawn?.levels || {})) {
      ok(lv.includes(l) && roomAt(def, sp.pc[0], sp.pc[1], l), `${tag}: ${l} spawn inside a room on that level`);
    }
    if (lv.length > 1) ok(lv.every((l) => m.spawn?.levels?.[l]), `${tag}: a spawn point for every level`);
    const [W, H] = m.size;
    for (const d of m.doors || []) {
      const f = m.rooms.find((r) => r.id === d.from);
      const t = m.rooms.find((r) => r.id === d.to);
      ok(f && t && f.level === d.level && t.level === d.level, `${tag}: door ${d.from}→${d.to} joins two rooms on ${d.level}`);
      const s = f.shape; const X = d.at[0] * W; const Y = d.at[1] * H;
      const L = s.x * W; const T = s.y * H; const R = (s.x + s.w) * W; const B = (s.y + s.h) * H;
      const onWall = X >= L - 2 && X <= R + 2 && Y >= T - 2 && Y <= B + 2
        && Math.min(Math.abs(X - L), Math.abs(X - R), Math.abs(Y - T), Math.abs(Y - B)) <= 2;
      ok(onWall, `${tag}: door ${d.from}→${d.to} sits on the ${d.from} wall`);
    }
    if (m.outline) {
      const n = m.outline.match(/-?[\d.]+/g).map(Number);
      let inside = true;
      for (let i = 0; i < n.length; i += 2) if (n[i] < c.x - 1e-3 || n[i] > c.x + c.w + 1e-3 || n[i + 1] < c.y - 1e-3 || n[i + 1] > c.y + c.h + 1e-3) inside = false;
      ok(inside, `${tag}: outline inside the crop`);
    }
    const { mapDef: sd, error } = sanitizeMapDef({ id: m.id, title: m.title, kind: 'engine', engine: m.id, size: m.size, levels: m.levels, rooms: m.rooms, doors: m.doors, outline: m.outline, crop: m.crop, spawn: m.spawn, grid: m.grid });
    ok(!error && sd.rooms.length === m.rooms.length && (sd.doors || []).length === (m.doors || []).length, `${tag}: GM mapDef sanitizes with every room and door`);
  }
}

/* ── ASCII map → parsed mapDef (what resolveMapDef sends for kind:'ascii') ── */
const tartarusPack = JSON.parse(readFileSync(join(ROOT, 'src/universes/alien/content/tartarus-reach.json'), 'utf8'));
const tartarusMap = tartarusPack.maps.find((m) => m.kind === 'ascii');
const ASCII_DEF = buildAsciiMapDef(tartarusMap);
const ASCII_MAP_ID = `${tartarusPack.id}:${tartarusMap.id}`;
const aCenter = (id) => { const s = ASCII_DEF.rooms.find((r) => r.id === id).shape; return { x: s.x + s.w / 2, y: s.y + s.h / 2 }; };
{
  const { mapDef, error } = sanitizeMapDef(ASCII_DEF);
  ok(!error, 'parsed ASCII mapDef sanitizes: ' + error);
  ok(mapDef.rooms.length === ASCII_DEF.rooms.length && mapDef.rooms.length >= tartarusMap.rooms.length * 0.8, 'every parsed room survives sanitizing');
  ok(mapDef.kind === 'ascii' && mapDef.ascii && mapDef.size && mapDef.crop && mapDef.outline, 'ascii mapDef carries text, size, crop, outline');
  const sl = aCenter('survey-lab');
  eq(roomAt(mapDef, sl.x, sl.y), 'survey-lab', 'hit-test a parsed room');
  const pa = ASCII_DEF.spawn.pc;
  eq(roomAt(mapDef, pa[0], pa[1]), 'pad-a', 'spawn is inside the first hinted room');
  // Room Editor overlay: shaped rooms are authoritative (move one, drop one)
  const moved = { ...tartarusMap, rooms: ASCII_DEF.rooms.filter((r) => r.id !== 'quiet-room').map((r) => (r.id === 'pad-b' ? { ...r, shape: { ...r.shape, y: 0.5 } } : r)) };
  const od = buildAsciiMapDef(moved);
  ok(!od.rooms.some((r) => r.id === 'quiet-room') && od.rooms.find((r) => r.id === 'pad-b').shape.y === 0.5, 'overlay rooms override parsed ones by id; deletions stick');
}

/* ── Server ── */
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
/* Latest board-state per socket + a waiter for a predicate on it. */
function track(s) {
  s.boardState = null;
  s.mapDef = null;
  s.pings = [];
  s.secrets = 0;
  s.on('board-state', (d) => { s.boardState = d.board; if (d.mapDef) s.mapDef = d.mapDef; });
  s.on('board-ping', (p) => s.pings.push(p));
  s.on('secret-message', () => { s.secrets++; });
  s.on('character-assigned', () => { s.secrets++; });
  return s;
}
async function until(s, pred, label, ms = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (s.boardState && pred(s.boardState, s)) return s.boardState;
    await sleep(20);
  }
  throw new Error('timeout: ' + label);
}

try {
  await startServer();
  const dm = track(await connect());
  const created = await call(dm, 'create-game', { universeId: 'alien', packId: 'chariot-of-the-gods' });
  const code = created.code;
  const linked = [];
  dm.on('board-linked', (d) => linked.push(d.count));

  const board = track(await connect());
  ok((await call(board, 'join-board', { code: 'ZZZZ' })).error, 'join-board unknown code rejected');
  const jb = await call(board, 'join-board', { code });
  ok(jb.success && jb.board && jb.board.mapId === null, 'board joined (no map yet)');
  await sleep(100);
  eq(linked.at(-1), 1, 'DM sees TV linked (count 1)');

  const pA = track(await connect());
  const pB = track(await connect());
  const jA = await call(pA, 'join-game', { code, playerName: 'Alice' });
  const jB = await call(pB, 'join-game', { code, playerName: 'Bob' });
  ok(jA.success && jB.success, 'players joined');
  dm.emit('assign-character', { gameCode: code, playerId: jA.playerId, character: { id: 'c1', name: 'Ripley', career: 'Officer', gear: [] }, tracks: {}, trackMax: {} });
  dm.emit('send-message', { gameCode: code, playerId: jA.playerId, text: 'secret' });

  // Players can't drive the board.
  ok((await call(pA, 'board-set-map', { mapId: 'uscss-montero', mapDef: MAPDEF })).error, 'player cannot set the map');
  ok((await call(board, 'board-token-upsert', { gameCode: code, token: { id: 'x', kind: 'marker' } })).error, 'board cannot upsert tokens');
  ok((await call(dm, 'board-set-map', { mapId: 'uscss-montero', mapDef: { id: 'NOPE' } })).error, 'invalid mapDef rejected');

  // DM sets the Montero map.
  const sm = await call(dm, 'board-set-map', { gameCode: code, mapId: 'uscss-montero', level: 'deck-a', mapDef: MAPDEF });
  ok(sm.success, 'map set');
  await until(board, (b, s) => b.mapId === 'uscss-montero' && s.mapDef, 'board got map');
  await until(pB, (b, s) => b.mapId === 'uscss-montero' && s.mapDef, 'player got map');
  eq(board.boardState.level, 'deck-a', 'level deck-a');
  ok(board.mapDef.rooms.length === montero.rooms.length, 'board mapDef has all rooms');
  ok(board.mapDef.rooms.every((r) => r.note === undefined), 'GM room notes stripped for the board');
  ok(dm.mapDef.rooms.some((r) => r.note), 'DM mapDef keeps notes');

  // Creature in an unrevealed room.
  const med = center('deck-a-medlab');
  const up = await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'xeno1', kind: 'creature', label: 'Drone', icon: '/art/xenomorphs/cropped/drone.webp', x: med.x, y: med.y, note: 'lurking' } });
  ok(up.success && up.token.roomId === 'deck-a-medlab' && up.token.level === 'deck-a', 'server computed roomId + level');
  await until(dm, (b) => b.tokens.xeno1, 'DM sees creature');
  await sleep(150);
  ok(!board.boardState.tokens.xeno1, 'board does NOT see creature in unrevealed room');
  ok(!pA.boardState.tokens.xeno1 && !pB.boardState.tokens.xeno1, 'players do NOT see it either');
  eq(dm.boardState.tokens.xeno1.note, 'lurking', 'DM sees the token note');

  // PC token at spawn, then moved into the medlab → auto-reveal.
  const pc = await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'pc-alice', kind: 'pc', label: 'Ripley', ownerPlayerId: jA.playerId, x: MAPDEF.spawn.pc[0], y: MAPDEF.spawn.pc[1] } });
  ok(pc.success && pc.token.color, 'PC token gets a player colour');
  await until(board, (b) => b.tokens['pc-alice'], 'board sees PC (PCs always visible)');
  ok(board.boardState.rooms[pc.token.roomId]?.revealed, 'spawn room auto-revealed by the PC');
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    dm.emit('board-token-move', { gameCode: code, id: 'pc-alice', x: MAPDEF.spawn.pc[0] + (med.x - 0.01 - MAPDEF.spawn.pc[0]) * t, y: MAPDEF.spawn.pc[1] + (med.y - MAPDEF.spawn.pc[1]) * t });
  }
  await until(board, (b) => b.tokens.xeno1, 'creature appears on the board after PC enters');
  await until(pB, (b) => b.tokens.xeno1, 'creature appears for players');
  const st = board.boardState.rooms['deck-a-medlab'];
  ok(st.revealed && st.entered, 'medlab revealed + entered');
  eq(board.boardState.tokens['pc-alice'].roomId, 'deck-a-medlab', 'PC is in the medlab');
  ok(board.boardState.tokens.xeno1.note === undefined, 'token note never reaches the board');

  // Player move attempts are ignored.
  pA.emit('board-token-move', { gameCode: code, id: 'xeno1', x: 0.1, y: 0.1 });
  await sleep(150);
  ok(Math.abs(dm.boardState.tokens.xeno1.x - med.x) < 1e-9, 'player cannot move tokens');

  // Hide → disappears for board + players; DM still has it.
  await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'xeno1', hidden: true } });
  await until(board, (b) => !b.tokens.xeno1, 'hidden creature disappears from board');
  await until(pA, (b) => !b.tokens.xeno1, 'hidden creature disappears for players');
  ok(dm.boardState.tokens.xeno1.hidden === true, 'DM still sees hidden token');

  // Fog off → everything (non-hidden) visible.
  const gal = center('deck-a-galley');
  await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'item1', kind: 'item', label: 'Motion Tracker', glyph: 'crate', x: gal.x, y: gal.y } });
  await sleep(150);
  ok(!board.boardState.tokens.item1, 'item in unrevealed galley not visible');
  dm.emit('board-fog', { gameCode: code, fog: false });
  await until(board, (b) => b.fog === false && b.tokens.item1, 'fog off reveals the galley item');
  ok(!board.boardState.tokens.xeno1, 'hidden stays hidden with fog off');

  // Room toggle by the GM.
  dm.emit('board-fog', { gameCode: code, fog: true });
  await until(board, (b) => b.fog === true && !b.tokens.item1, 'fog back on hides the galley item');
  ok((await call(dm, 'board-room-set', { gameCode: code, roomId: 'deck-a-galley', revealed: true })).success, 'room reveal ok');
  await until(board, (b) => b.tokens.item1, 'GM reveal shows the galley item');

  // View (TV orientation).
  dm.emit('board-view', { gameCode: code, view: { rotation: 90, flipX: true } });
  await until(board, (b) => b.view.rotation === 90 && b.view.flipX === true, 'view rotation reaches the board');
  dm.emit('board-view', { gameCode: code, view: { rotation: 45 } });
  await sleep(150);
  eq(board.boardState.view.rotation, 0, 'illegal rotation clamped to 0');
  dm.emit('board-view', { gameCode: code, view: { rotation: 90 } });

  // Ping rate limit (players 1/s).
  const p1 = await call(pA, 'board-ping', { x: 0.5, y: 0.5 });
  const p2 = await call(pA, 'board-ping', { x: 0.5, y: 0.5 });
  ok(p1.success, 'player ping ok');
  ok(p2.error && /RATE/.test(p2.error), 'second ping within 1 s rate-limited');
  ok((await call(board, 'board-ping', { x: 0.5, y: 0.5 })).error, 'board client cannot ping');
  await sleep(150);
  eq(board.pings.length, 1, 'board received exactly one ping');
  eq(board.pings[0].by, jA.playerId, 'ping attributed to the player');
  await sleep(1000);
  ok((await call(pA, 'board-ping', { x: 0.4, y: 0.4 })).success, 'ping allowed again after 1 s');

  // Level switch keeps state; board never got sheets/messages.
  ok((await call(dm, 'board-set-map', { gameCode: code, mapId: 'uscss-montero', level: 'deck-b', mapDef: MAPDEF })).success, 'level switch');
  await until(board, (b) => b.level === 'deck-b', 'board on deck B');
  ok(board.boardState.tokens['pc-alice'] && board.boardState.rooms['deck-a-medlab']?.revealed, 'level switch keeps tokens + reveals');
  eq(board.secrets, 0, 'board never receives messages or character sheets');

  /* ── Restart ── */
  await sleep(500); // > persistence debounce
  dm.close(); board.close(); pA.close(); pB.close();
  await killServer();
  await startServer();

  const board2 = track(await connect());
  const jb2 = await call(board2, 'join-board', { code });
  ok(jb2.success, 'board re-joins after restart');
  eq(jb2.board.mapId, 'uscss-montero', 'map restored');
  eq(jb2.board.level, 'deck-b', 'level restored');
  eq(jb2.board.view.rotation, 90, 'view restored');
  ok(jb2.mapDef && jb2.mapDef.rooms.length === montero.rooms.length, 'mapDef restored');
  ok(jb2.board.tokens['pc-alice'] && jb2.board.tokens.item1 && !jb2.board.tokens.xeno1, 'filtered tokens restored');
  ok(jb2.board.rooms['deck-a-medlab'].revealed, 'reveals restored');

  const dm2 = track(await connect());
  const r = await call(dm2, 'resume-game', { code, dmToken: created.dmToken });
  ok(r.success, 'DM resumed');
  await until(dm2, (b) => b.tokens.xeno1, 'DM gets the full board (incl. hidden) on resume');
  ok(dm2.boardState.tokens.xeno1.hidden, 'hidden flag persisted');
  const sync = await call(dm2, 'board-sync', {});
  eq(sync.boardClients, 1, 'board-sync reports one TV linked');

  // Reset keeps map, clears tokens.
  ok((await call(dm2, 'board-reset', { gameCode: code })).success, 'reset');
  await until(board2, (b) => Object.keys(b.tokens).length === 0 && b.mapId === 'uscss-montero', 'reset clears tokens, keeps map');

  // ASCII pack map with parsed room geometry: fog, hit-testing and auto-reveal with no server changes.
  {
    const sa = await call(dm2, 'board-set-map', { gameCode: code, mapId: ASCII_MAP_ID, mapDef: ASCII_DEF });
    ok(sa.success, 'ascii map set: ' + sa.error);
    await until(board2, (b, s) => b.mapId === ASCII_MAP_ID && s.mapDef?.kind === 'ascii', 'board got the ascii map');
    eq(board2.mapDef.rooms.length, ASCII_DEF.rooms.length, 'board mapDef has the parsed rooms');
    const lab = aCenter('survey-lab');
    const cr = await call(dm2, 'board-token-upsert', { gameCode: code, token: { id: 'xeno-a', kind: 'creature', label: 'Lurker', x: lab.x, y: lab.y } });
    ok(cr.success && cr.token.roomId === 'survey-lab', 'creature lands in the parsed Survey Lab');
    await sleep(150);
    ok(!board2.boardState.tokens['xeno-a'], 'creature in an unrevealed parsed room is hidden from the board');
    const pcA = await call(dm2, 'board-token-upsert', { gameCode: code, token: { id: 'pc-a2', kind: 'pc', label: 'Ripley', ownerPlayerId: jA.playerId, x: ASCII_DEF.spawn.pc[0], y: ASCII_DEF.spawn.pc[1] } });
    ok(pcA.success && pcA.token.roomId === 'pad-a', 'PC spawns in Pad A');
    await until(board2, (b) => b.rooms['pad-a']?.revealed, 'spawn room auto-revealed');
    ok(!board2.boardState.rooms['survey-lab']?.revealed, 'survey lab still fogged');
    dm2.emit('board-token-move', { gameCode: code, id: 'pc-a2', x: lab.x - 0.02, y: lab.y });
    await until(board2, (b) => b.tokens['xeno-a'] && b.rooms['survey-lab']?.revealed, 'PC entering the survey lab reveals it and the creature');
    eq(board2.boardState.tokens['pc-a2'].roomId, 'survey-lab', 'PC hit-tested into the parsed room');
  }

  // End game reaches the board.
  const ended = new Promise((res) => board2.once('game-ended', res));
  await call(dm2, 'end-game', { code, dmToken: created.dmToken });
  await ended; checks++;

  dm2.close(); board2.close();
  await killServer();
  console.log(`test-board: ${checks} checks passed`);
  rmSync(DATA, { recursive: true, force: true });
  process.exit(0);
} catch (e) {
  console.error('FAIL:', e.stack || e.message);
  if (server) await killServer().catch(() => {});
  rmSync(DATA, { recursive: true, force: true });
  process.exit(1);
}
