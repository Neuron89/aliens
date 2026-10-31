#!/usr/bin/env node
/* F2 — TV director camera + combat spotlight. Pure checks on board/Camera.js
   (geometry vs. the MapCanvas transform for every rotation/flip, framing, follow
   / spotlight / ping / reveal shot choice, fallbacks) and server/board.js
   sanitizeCamera, then a socket run: the GM's board-view { camera } reaches the
   TV sanitized, partial updates merge, players / the board cannot set it, the
   TV gets the active initiative token for the spotlight (a hidden token never
   reaches it), and the camera survives a server restart.
   Usage: node scripts/test-camera.mjs */
import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import assert from 'assert/strict';
import { io } from 'socket.io-client';
import { sanitizeView, sanitizeCamera, emptyBoard, DEFAULT_VIEW, normalizeBoard } from '../server/board.js';
import * as C from '../src/engine/components/board/Camera.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4400 + Math.floor(Math.random() * 90);
const DATA = mkdtempSync(join(tmpdir(), 'camera-test-'));
const URL = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
const near = (a, b, m, eps = 1e-6) => { assert.ok(Math.abs(a - b) < eps, `${m}: ${a} != ${b}`); checks++; };

/* ── Server sanitising ── */
{
  eq(sanitizeCamera(null), { mode: 'fixed', spotlight: false, target: null }, 'camera defaults');
  eq(sanitizeCamera({ mode: 'follow' }), { mode: 'follow', spotlight: false, target: null }, 'mode follow');
  eq(sanitizeCamera({ spotlight: true }, { mode: 'cinematic', spotlight: false, target: 'galley' }), { mode: 'cinematic', spotlight: true, target: 'galley' }, 'partial merge keeps mode + target');
  eq(sanitizeCamera({ mode: 'orbit', spotlight: 'yes', target: '__proto__' }), { mode: 'fixed', spotlight: false, target: null }, 'garbage camera sanitized');
  eq(sanitizeCamera({ target: 'x'.repeat(81) }).target, null, 'over-long target dropped');
  eq(sanitizeCamera({ target: 'Bad Room' }).target, null, 'non-kebab target dropped');
  eq(sanitizeCamera([1, 2]), sanitizeCamera(null), 'array camera ignored');
  const v1 = sanitizeView({ camera: { mode: 'follow' } });
  const v2 = sanitizeView({ rotation: 90 }, v1);
  eq(v2.camera.mode, 'follow', 'rotation update keeps the camera');
  ok(v2.camera !== v1.camera, 'camera never shared between views');
  ok(!('camera' in DEFAULT_VIEW), 'DEFAULT_VIEW untouched');
  const b1 = emptyBoard(); const b2 = emptyBoard();
  b1.view.camera.mode = 'follow';
  eq(b2.view.camera.mode, 'fixed', 'emptyBoard cameras are independent');
  eq(normalizeBoard({ view: { rotation: 0 }, tokens: {}, rooms: {} }).view.camera, { mode: 'fixed', spotlight: false, target: null }, 'old snapshot gains a fixed camera');
  eq(sanitizeView(null, v1).camera.mode, 'follow', 'null view payload keeps the camera');
}

/* ── Geometry: mapToLocal vs an independent SVG-matrix run of the MapCanvas transform ── */
{
  const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  const T = (x, y) => [1, 0, 0, 1, x, y];
  const S = (x, y) => [x, 0, 0, y, 0, 0];
  const R = (deg) => { const r = (deg * Math.PI) / 180; const c = Math.round(Math.cos(r)); const s = Math.round(Math.sin(r)); return [c, s, -s, c, 0, 0]; };
  /* MapCanvas: transform = [translate+rotate] [translate(Wc,0) scale(-1,1)] translate(-X,-Y) */
  const svgMatrix = (g) => {
    let m = T(-g.X, -g.Y);
    if (g.flip) m = mul(mul(T(g.Wc, 0), S(-1, 1)), m);
    if (g.rot === 90) m = mul(mul(T(g.Hc, 0), R(90)), m);
    else if (g.rot === 180) m = mul(mul(T(g.Wc, g.Hc), R(180)), m);
    else if (g.rot === 270) m = mul(mul(T(0, g.Wc), R(270)), m);
    return m;
  };
  const crop = { x: 0.1, y: 0.05, w: 0.8, h: 0.9 };
  for (const rotation of [0, 90, 180, 270]) {
    for (const flipX of [false, true]) {
      const geo = C.viewGeometry({ W: 2400, H: 1300, crop, view: { rotation, flipX, zoom: 1.25, pan: [0.05, -0.02] } });
      const [cw, ch] = [1920, 1046];
      const m = svgMatrix(geo);
      const k = Math.min(cw / geo.VW, ch / geo.VH);
      for (const [x, y] of [[0.2, 0.3], [0.7, 0.6], [0.5, 0.5], [0.95, 0.1]]) {
        const px = x * geo.W; const py = y * geo.H;
        const vx = m[0] * px + m[2] * py + m[4];
        const vy = m[1] * px + m[3] * py + m[5];
        const [lx, ly] = C.mapToLocal(geo, cw, ch, x, y);
        near(lx, (cw - geo.VW * k) / 2 + vx * k, `rot ${rotation} flip ${flipX} x`, 1e-6);
        near(ly, (ch - geo.VH * k) / 2 + vy * k, `rot ${rotation} flip ${flipX} y`, 1e-6);
      }
    }
  }
  const sq = (rotation, flipX) => C.viewGeometry({ W: 1000, H: 1000, view: { rotation, flipX } });
  eq(C.mapToLocal(sq(0, false), 1000, 1000, 0, 0), [0, 0], 'rot 0 top-left stays');
  eq(C.mapToLocal(sq(90, false), 1000, 1000, 0, 0), [1000, 0], 'rot 90 top-left → top-right');
  eq(C.mapToLocal(sq(180, false), 1000, 1000, 0, 0), [1000, 1000], 'rot 180 top-left → bottom-right');
  eq(C.mapToLocal(sq(270, false), 1000, 1000, 0, 0), [0, 1000], 'rot 270 top-left → bottom-left');
  eq(C.mapToLocal(sq(0, true), 1000, 1000, 0, 0), [1000, 0], 'flip mirrors x');
  const lb = C.boxToLocal(sq(90, false), 1000, 1000, { x0: 0, y0: 0, x1: 0.5, y1: 0.25 });
  eq(lb, { x0: 750, y0: 0, x1: 1000, y1: 500 }, 'box under rotation is the rotated rectangle');
}

/* ── Framing ── */
{
  const full = C.frameLocal({ x0: 0, y0: 0, x1: 1920, y1: 1046 }, 1920, 1046);
  eq(full, { s: 1, tx: 0, ty: 0 }, 'whole frame → identity');
  const mid = C.frameLocal({ x0: 900, y0: 500, x1: 1020, y1: 546 }, 1920, 1046);
  near(mid.s, C.FOLLOW_MAX, 'small box zooms to the cap');
  near(960 * mid.s + mid.tx, 960, 'centred on x', 1e-6);
  const corner = C.frameLocal({ x0: 0, y0: 0, x1: 200, y1: 120 }, 1920, 1046);
  eq([corner.tx, corner.ty], [0, 0], 'corner box clamps: no gap at the frame edge');
  const far = C.frameLocal({ x0: 1800, y0: 980, x1: 1920, y1: 1046 }, 1920, 1046);
  near(far.tx, 1920 - far.s * 1920, 'far corner clamps to the right edge');
  ok(C.frameLocal(null, 1920, 1046).s === 1, 'no box → identity');
  // letterboxed map (square plan on a 16:9 TV): never pan into the empty bars
  const geoL = C.viewGeometry({ W: 1000, H: 1000, view: {} });
  const cont = C.contentLocal(geoL, 1920, 1046);
  near(cont.x0, (1920 - 1046) / 2, 'content window x0'); near(cont.x1, (1920 + 1046) / 2, 'content window x1');
  const edgeCam = C.frameLocal(C.boxToLocal(geoL, 1920, 1046, { x0: 0.9, y0: 0.45, x1: 1, y1: 0.55 }), 1920, 1046, { content: cont });
  near(edgeCam.tx, 1920 - edgeCam.s * cont.x1, 'room at the map edge: the map edge stays on the TV edge', 1e-6);
  const restL = C.frameLocal(C.boxToLocal(geoL, 1920, 1046, { x0: 0, y0: 0, x1: 1, y1: 1 }), 1920, 1046, { content: cont });
  eq([restL.s, restL.tx, restL.ty], [1, 0, 0], 'whole letterboxed map → identity');
  const rest = C.restingCamera(1000, 500, 1.04);
  near(rest.tx, -20, 'cinematic rest centred (x)'); near(rest.ty, -10, 'cinematic rest centred (y)');
  near(C.ease(0), 0, 'ease 0'); near(C.ease(1), 1, 'ease 1'); near(C.ease(0.5), 0.5, 'ease mid');
  ok(C.camClose({ s: 1, tx: 0, ty: 0 }, { s: 1.001, tx: 0.2, ty: -0.3 }) && !C.camClose({ s: 1, tx: 0, ty: 0 }, { s: 1.2, tx: 0, ty: 0 }), 'camClose tolerance');
  ok(C.camCss({ s: 2, tx: -10, ty: 5 }).includes('scale(2.0000)'), 'camCss');
}

/* ── Shots ── */
{
  const mapDef = {
    grid: 1 / 40,
    rooms: [
      { id: 'bridge', shape: { type: 'rect', x: 0.1, y: 0.1, w: 0.2, h: 0.2 } },
      { id: 'galley', shape: { type: 'rect', x: 0.6, y: 0.6, w: 0.2, h: 0.2 } },
      { id: 'vault', shape: { type: 'poly', points: [[0.4, 0.1], [0.5, 0.1], [0.45, 0.3]] } },
      { id: 'lower', level: 'b', shape: { type: 'rect', x: 0, y: 0, w: 1, h: 1 } },
    ],
  };
  const board = {
    fog: true, level: 'a',
    rooms: { bridge: { revealed: true }, galley: { revealed: false }, vault: { revealed: true } },
    tokens: {
      a: { id: 'a', kind: 'pc', x: 0.2, y: 0.2, roomId: 'bridge' },
      b: { id: 'b', kind: 'pc', x: 0.21, y: 0.22, roomId: 'bridge' },
      x: { id: 'x', kind: 'creature', x: 0.45, y: 0.2, roomId: 'vault' },
    },
  };
  const fb = C.followBox({ mapDef, board, level: 'a' });
  ok(fb && fb.x0 < 0.1 && fb.x1 > 0.3 && fb.x1 < 0.4, 'follow frames the PC room (padded), once');
  eq(C.chooseShot({ cam: { mode: 'fixed' }, mapDef, board, level: 'a' }), null, 'FIXED never frames');
  eq(C.chooseShot({ cam: { mode: 'follow' }, mapDef, board, level: 'a' }).why, 'follow', 'FOLLOW frames the crew');
  eq(C.chooseShot({ cam: { mode: 'cinematic' }, mapDef, board, level: 'a' }).why, 'follow', 'CINEMATIC follows too');
  eq(C.chooseShot({ cam: { mode: 'follow', target: 'vault' }, mapDef, board, level: 'a' }).why, 'target', 'pinned revealed room wins');
  eq(C.chooseShot({ cam: { mode: 'follow', target: 'galley' }, mapDef, board, level: 'a' }).why, 'follow', 'pinned room in fog is ignored');
  const rb = C.roomBox(mapDef, 'a', 'vault');
  const withReveal = C.chooseShot({ cam: { mode: 'follow' }, mapDef, board, level: 'a', revealBox: rb });
  ok(withReveal.why === 'reveal' && withReveal.box.x1 >= 0.5, 'a fresh reveal joins the frame');
  eq(C.chooseShot({ cam: { mode: 'follow' }, mapDef, board, level: 'a', pingBox: C.pointBox(0.5, 0.5, 7) }).maxScale, C.PING_MAX, 'GM ping beat');
  const spot = C.tokenFocusBox({ mapDef, board, level: 'a', tokenId: 'x' });
  ok(spot && spot.x0 < 0.4 && spot.x1 > 0.5, 'spotlight box = the actor\'s (padded) room');
  eq(C.chooseShot({ cam: { mode: 'follow' }, mapDef, board, level: 'a', spotBox: spot, pingBox: C.pointBox(0.5, 0.5, 7) }).why, 'spotlight', 'spotlight outranks a ping');
  eq(C.tokenFocusBox({ mapDef, board, level: 'a', tokenId: 'hidden-one' }), null, 'a token the TV does not have → no spotlight');
  const loose = C.tokenFocusBox({ mapDef, board: { ...board, tokens: { z: { id: 'z', kind: 'npc', x: 0.9, y: 0.1, roomId: null } } }, level: 'a', tokenId: 'z' });
  ok(loose && loose.x0 < 0.9 && loose.x1 > 0.9, 'token outside rooms → a box around it');
  const dark = { fog: true, rooms: {}, tokens: { a: { id: 'a', kind: 'pc', x: 0.5, y: 0.5, roomId: null } } };
  eq(C.chooseShot({ cam: { mode: 'follow' }, mapDef, board: dark, level: 'a' }), null, 'nothing revealed → fixed view');
  eq(C.chooseShot({ cam: { mode: 'follow' }, mapDef, board: { ...board, tokens: {} }, level: 'a' }), null, 'no PCs → fixed view');
  eq(C.followBox({ mapDef, board: { ...board, tokens: { a: { ...board.tokens.a, level: 'b' } } }, level: 'a' }), null, 'PCs on another level ignored');
  const seen1 = C.revealedSet(board, mapDef, 'a');
  eq([...seen1].sort(), ['bridge', 'vault'], 'revealed set (this level)');
  eq(C.newlyRevealed(null, seen1), [], 'first look reveals nothing new');
  eq(C.newlyRevealed(seen1, new Set([...seen1, 'galley'])), ['galley'], 'newly revealed room found');
  eq(C.revealedSet({ ...board, fog: false }, mapDef, 'a').size, 0, 'fog off → no wipes');
  eq(C.shapeBox(mapDef.rooms[2].shape), { x0: 0.4, y0: 0.1, x1: 0.5, y1: 0.3 }, 'poly bounds');
  const p = C.spotPath({ x0: 0, y0: 0, x1: 100, y1: 100 }, { x0: 10, y0: 10, x1: 30, y1: 40 }, 4);
  eq((p.match(/M/g) || []).length, 2, 'spotlight path = outer + hole');
  ok(C.roundRect({ x0: 10, y0: 10, x1: 30, y1: 40 }, 4).startsWith('M14 10'), 'ring path is the hole only');
  eq(C.normalizeCamera(undefined), { mode: 'fixed', spotlight: false, target: null }, 'client default camera');
}

/* ── Edge treatment per universe ── */
{
  const alien = (await import(pathToFileURL(join(ROOT, 'src/universes/alien/universe.core.js')).href)).default;
  const dune = (await import(pathToFileURL(join(ROOT, 'src/universes/dune/universe.core.js')).href)).default;
  eq(C.edgeStyle(alien.theme.board), 'crt', 'ALIEN cinematic edge = CRT');
  eq(C.edgeStyle(dune.theme.board), 'heat', 'DUNE cinematic edge = heat shimmer');
  eq(C.edgeStyle({}), 'plain', 'unknown palette = plain vignette');
}

/* ── Server ── */
const { maps } = await import(pathToFileURL(join(ROOT, 'src/universes/alien/maps/index.js')).href);
const montero = maps.find((m) => m.id === 'uscss-montero');
const MAPDEF = {
  id: montero.id, title: montero.title, subtitle: montero.subtitle, kind: 'engine', engine: montero.id,
  size: montero.size, levels: montero.levels, rooms: montero.rooms, outline: montero.outline,
  crop: montero.crop, spawn: montero.spawn, grid: montero.grid,
};
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
function track(s) {
  s.boardState = null; s.table = null;
  s.on('board-state', (d) => { if (d?.board) s.boardState = d.board; });
  s.on('table-state', (d) => { if (d?.table) s.table = d.table; });
  return s;
}
async function until(get, pred, label, ms = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = get();
    if (v && pred(v)) return v;
    await sleep(20);
  }
  throw new Error('timeout: ' + label);
}

try {
  await startServer();
  const dm = track(await connect());
  const created = await call(dm, 'create-game', { universeId: 'alien', packId: 'chariot-of-the-gods' });
  const code = created.code;
  const tv = track(await connect());
  const jb = await call(tv, 'join-board', { code });
  eq(jb.board.view.camera, { mode: 'fixed', spotlight: false, target: null }, 'TV joins with a FIXED camera');
  const pA = track(await connect());
  const jA = await call(pA, 'join-game', { code, playerName: 'Alice' });
  ok(jA.playerId, 'player joined');
  ok((await call(dm, 'board-set-map', { gameCode: code, mapId: 'uscss-montero', level: 'deck-a', mapDef: MAPDEF })).success, 'map up');
  const tvBoard = () => tv.boardState;

  dm.emit('board-view', { gameCode: code, view: { camera: { mode: 'follow' } } });
  await until(tvBoard, (b) => b.view.camera.mode === 'follow', 'FOLLOW reaches the TV');
  dm.emit('board-view', { gameCode: code, view: { camera: { spotlight: true } } });
  await until(tvBoard, (b) => b.view.camera.spotlight === true, 'spotlight reaches the TV');
  eq(tv.boardState.view.camera.mode, 'follow', 'partial camera update keeps the mode');
  dm.emit('board-view', { gameCode: code, view: { rotation: 270 } });
  await until(tvBoard, (b) => b.view.rotation === 270, 'rotation');
  eq(tv.boardState.view.camera, { mode: 'follow', spotlight: true, target: null }, 'rotation keeps the camera');
  dm.emit('board-view', { gameCode: code, view: { camera: { mode: 'cinematic', target: 'deck-a-medlab' } } });
  await until(tvBoard, (b) => b.view.camera.mode === 'cinematic', 'CINEMATIC');
  eq(tv.boardState.view.camera.target, 'deck-a-medlab', 'pinned room reaches the TV');
  dm.emit('board-view', { gameCode: code, view: { camera: { mode: 'zoomy', target: 'constructor', spotlight: 1 } } });
  await until(tvBoard, (b) => b.view.camera.mode === 'fixed', 'garbage camera');
  eq(tv.boardState.view.camera, { mode: 'fixed', spotlight: false, target: null }, 'garbage camera sanitized on the wire');
  dm.emit('board-view', { gameCode: code, view: { camera: { mode: 'follow', spotlight: true } } });
  await until(tvBoard, (b) => b.view.camera.mode === 'follow' && b.view.camera.spotlight, 'follow + spotlight again');

  pA.emit('board-view', { gameCode: code, view: { camera: { mode: 'cinematic' } } });
  tv.emit('board-view', { gameCode: code, view: { camera: { mode: 'cinematic' } } });
  dm.emit('board-fog', { gameCode: code, fog: true }); // a later DM change flushes a fresh board-state
  await sleep(250);
  eq(tv.boardState.view.camera.mode, 'follow', 'players and the TV cannot move the camera');

  // Spotlight data: the TV's table carries the active initiative token; a hidden actor's token never reaches it.
  const spawnPt = MAPDEF.spawn.pc;
  await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'pc-alice', kind: 'pc', label: 'Miller', ownerPlayerId: jA.playerId, x: spawnPt[0], y: spawnPt[1] } });
  await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'lurker', kind: 'creature', label: 'Lurker', x: spawnPt[0], y: spawnPt[1], hidden: true } });
  await until(tvBoard, (b) => b.tokens['pc-alice']?.roomId, 'PC on the TV in a room');
  ok(tv.boardState.rooms[tv.boardState.tokens['pc-alice'].roomId]?.revealed, 'PC room auto-revealed (FOLLOW has a frame)');
  const is = await call(dm, 'init-set', { gameCode: code, initiative: { active: true, round: 1, turn: 0, order: [
    { id: 'i-a', kind: 'pc', label: 'Miller', playerId: jA.playerId, tokenId: 'pc-alice', card: 2 },
    { id: 'i-x', kind: 'creature', label: 'Lurker', tokenId: 'lurker', card: 5 },
  ] } });
  ok(is.success, 'initiative set');
  await until(() => tv.table, (t) => t.initiative?.active && t.initiative.current?.tokenId === 'pc-alice', 'TV gets the active token');
  ok(await call(dm, 'init-step', { gameCode: code, dir: 1 }).then((r) => r.success), 'NEXT');
  await until(() => tv.table, (t) => t.initiative.current?.tokenId === 'lurker', 'TV gets the next actor');
  ok(!tv.boardState.tokens.lurker, 'hidden actor token never on the TV (no spotlight leak)');

  /* Restart keeps the camera. */
  await sleep(600);
  dm.close(); tv.close(); pA.close();
  await killServer();
  await startServer();
  const tv2 = track(await connect());
  const jb2 = await call(tv2, 'join-board', { code });
  eq(jb2.board.view.camera, { mode: 'follow', spotlight: true, target: null }, 'camera restored after restart');
  eq(jb2.board.view.rotation, 270, 'rotation restored with it');
  tv2.close();
  await killServer();
  console.log(`test-camera: ${checks} checks passed`);
  rmSync(DATA, { recursive: true, force: true });
  process.exit(0);
} catch (e) {
  console.error('FAIL:', e.stack || e.message);
  if (server) await killServer().catch(() => {});
  rmSync(DATA, { recursive: true, force: true });
  process.exit(1);
}
