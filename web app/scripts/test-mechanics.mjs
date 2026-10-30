#!/usr/bin/env node
/* Mechanics-wave regression test (docs/RESEARCH_GM_PLAYER_EXPERIENCE.md rows 10, 11, 26–28, 40, 42, 44).
   Spawns the server with a temp DATA_DIR and checks: roll feed to GM + TV (board-roll), GM secret
   rolls stay off the TV, push stress, panic application (player status, stress, TV token ring +
   board-panic), supply roll decrement, Momentum/Threat caps + visibility filtering, initiative
   advance + "your turn" targeting + pass, creature hp on tokens (GM-only, persisted across a
   restart), critical injury apply/remove.
   Usage: node scripts/test-mechanics.mjs */
import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert/strict';
import { io } from 'socket.io-client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3700 + Math.floor(Math.random() * 90);
const DATA = mkdtempSync(join(tmpdir(), 'mechanics-'));
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
const sockets = [];
const connect = () => new Promise((res, rej) => {
  const s = io(URL, { transports: ['websocket'], reconnection: false });
  sockets.push(s);
  s.on('connect', () => res(s));
  s.on('connect_error', rej);
});
const call = (s, ev, payload) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("no ack: " + ev + " " + JSON.stringify(payload).slice(0, 120))), 4000); s.emit(ev, payload, (r) => { clearTimeout(t); res(r); }); });
const once = (s, ev, ms = 3000, pred = () => true) => new Promise((res, rej) => {
  const t = setTimeout(() => { s.off(ev, h); rej(new Error('timeout waiting for ' + ev)); }, ms);
  const h = (d) => { if (!pred(d)) return; clearTimeout(t); s.off(ev, h); res(d); };
  s.on(ev, h);
});
const collect = (s, ev) => { const arr = []; s.on(ev, (d) => arr.push(d)); return arr; };
const lastTable = (s) => { const box = { t: null }; s.on('table-state', (d) => { box.t = d.table; }); return box; };
const lastBoard = (s) => { const box = { b: null }; s.on('board-state', (d) => { if (d.board) box.b = d.board; }); return box; };
const lastPlayer = (s) => { const box = { p: null }; s.on('status-updated', (d) => { box.p = d.player; }); return box; };

try {
  await startServer();
  const dm = await connect();
  const created = await call(dm, 'create-game', { universeId: 'alien' });
  const code = created.code;
  ok(/^[A-Z]{4}$/.test(code), 'game created');
  const dmTable = lastTable(dm);
  const dmBoard = lastBoard(dm);
  const pA = await connect();
  const pB = await connect();
  const tv = await connect();
  const jA = await call(pA, 'join-game', { code, playerName: 'Alice' });
  const jB = await call(pB, 'join-game', { code, playerName: 'Bob' });
  await call(tv, 'join-board', { code });
  const aTable = lastTable(pA);
  const tvTable = lastTable(tv);
  const tvBoard = lastBoard(tv);
  const aPlayer = lastPlayer(pA);
  const A = jA.playerId;
  const B = jB.playerId;
  ok(jA.player && Array.isArray(jA.player.injuries) && jA.player.supply && jA.player.panic === null, 'player data carries supply / injuries / panic');

  const charA = { id: 'ripley-test', name: 'Ripley', career: 'Officer', attributes: { str: 4, agi: 3, wit: 4, emp: 3 }, skills: {} };
  const charB = { id: 'hicks-test', name: 'Hicks', career: 'Marine', attributes: { str: 5, agi: 4, wit: 2, emp: 3 }, skills: {} };
  dm.emit('assign-character', { gameCode: code, playerId: A, character: charA, tracks: { health: 4, stress: 3 }, trackMax: { health: 4, stress: 10 }, conditions: [] });
  dm.emit('assign-character', { gameCode: code, playerId: B, character: charB, tracks: { health: 5, stress: 0 }, trackMax: { health: 5, stress: 10 }, conditions: [] });
  await sleep(150);
  const tokA = await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'pc-alice', kind: 'pc', label: 'Ripley', ownerPlayerId: A, x: 0.3, y: 0.3 } });
  ok(tokA.success, 'PC token placed');

  /* ── Roll feed (row 10) ── */
  const dmRolls = collect(dm, 'roll');
  const tvRolls = collect(tv, 'board-roll');
  const roll1 = { kind: 'yze', label: 'OBSERVATION', summary: 'OBSERVATION — 1 success', successes: 1, flags: [], dice: { base: [6, 3, 2], stress: [4, 5, 2] }, pool: { base: 3, stress: 3 } };
  const r1 = await call(pA, 'player-roll', { clientId: 'm-roll-1', roll: roll1 });
  ok(r1.success, 'player roll accepted');
  await sleep(150);
  ok(dmRolls.some((d) => d.roll.id === r1.id && d.roll.roll.label === 'OBSERVATION'), 'GM receives roll');
  const tr = tvRolls.find((d) => d.roll.id === r1.id);
  ok(tr && tr.roll.name === 'Ripley' && tr.roll.label === 'OBSERVATION', 'TV receives board-roll with name + skill');
  eq(tr.roll.dice.base, [6, 3, 2], 'TV roll carries result glyphs');
  ok(dmTable.t.rolls.some((r) => r.id === r1.id), 'roll stored in the DM table (game.rolls)');
  ok(!('rolls' in tvTable.t) && !('rolls' in aTable.t), 'rolls never in board/player table views');

  // GM secret roll: DM only
  const tvBefore = tvRolls.length;
  const g1 = await call(dm, 'gm-roll', { gameCode: code, who: 'Xenomorph Drone', roll: { label: 'CLAW', summary: 'CLAW — 2 successes', flags: ['crit'] } });
  ok(g1.success, 'GM secret roll accepted');
  await sleep(150);
  ok(dmTable.t.rolls.some((r) => r.id === g1.id && r.secret), 'secret roll in GM feed');
  eq(tvRolls.length, tvBefore, 'secret roll never reaches the TV');

  // Push: +1 stress
  const r2 = await call(pA, 'player-roll', { clientId: 'm-roll-2', roll: { ...roll1, pushed: true, stressGain: 1, flags: ['push', 'panic'], panic: true, dice: { base: [6, 1, 1], stress: [1, 5, 2, 3] } } });
  await sleep(150);
  eq(aPlayer.p.tracks.stress, 4, 'push adds one Stress server-side');

  /* ── Panic flow (row 42) ── */
  const dmPanic = once(dm, 'panic');
  const tvPanic = once(tv, 'board-panic');
  const pr = await call(pA, 'panic-result', {
    rollId: 'm-roll-2', total: 10, die: 6,
    effect: { id: 'freeze', name: 'Freeze', text: 'You freeze in shock for one Round.', stressDelta: 1, panicAction: true, status: ['PANICKED', 'FREEZE'] },
  });
  ok(pr.success, 'panic-result accepted');
  const dp = await dmPanic;
  ok(dp.playerId === A && dp.effect.id === 'freeze' && dp.total === 10, 'GM sees the panic result');
  const tp = await tvPanic;
  ok(tp.tokenId === 'pc-alice' && tp.name === 'Ripley' && tp.effect === 'Freeze', 'TV gets the PANIC toast');
  await sleep(150);
  ok(aPlayer.p.statusEffects.includes('PANICKED') && aPlayer.p.statusEffects.includes('FREEZE'), 'panic status applied to the player');
  eq(aPlayer.p.tracks.stress, 5, 'panic table stress applied');
  ok(aPlayer.p.panic && aPlayer.p.panic.effectId === 'freeze', 'player.panic set');
  ok(tvBoard.b.tokens['pc-alice'].status.includes('panicking'), 'TV token status ring shows panicking');
  ok(dmTable.t.rolls.find((r) => r.clientId === 'm-roll-2').panic.effectId === 'freeze', 'roll feed entry carries the panic result');
  const dup = await call(pA, 'panic-result', { rollId: 'm-roll-2', total: 12, effect: { id: 'scream', name: 'Scream', status: ['PANICKED'] } });
  ok(dup.duplicate, 'panic-result is idempotent per roll (outbox replay)');
  // A new panic replaces the old named status
  await call(pA, 'panic-result', { total: 12, effect: { id: 'scream', name: 'Scream', stressDelta: -1, panicAction: true, status: ['PANICKED', 'SCREAM'] } });
  await sleep(120);
  ok(!aPlayer.p.statusEffects.includes('FREEZE') && aPlayer.p.statusEffects.includes('SCREAM'), 'new panic replaces the old effect');
  // QA 2026-10-30: a PC token placed AFTER the panic (the PC was not on the map yet) still shows the ring.
  await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'pc-alice-2', kind: 'pc', label: 'Ripley', ownerPlayerId: A, x: 0.35, y: 0.3 } });
  await sleep(120);
  ok(tvBoard.b.tokens['pc-alice-2']?.status?.includes('panicking'), 'PC token placed while its player panics carries the panic ring');
  await call(dm, 'board-token-remove', { gameCode: code, id: 'pc-alice-2' });
  // Keeping it together: text only
  const kt = await call(pB, 'panic-result', { total: 4, effect: { id: 'keeping-it-together', name: 'Keeping It Together', status: [] } });
  ok(kt.success && kt.panic === null, 'low panic result applies no status');
  // GM clears PANICKED → token ring cleared
  dm.emit('update-player', { gameCode: code, playerId: A, updates: { statusEffects: [] } });
  await sleep(200);
  ok(!tvBoard.b.tokens['pc-alice'].status.includes('panicking'), 'clearing panic statuses clears the TV ring');

  /* ── Supplies (row 40) ── */
  const ss = await call(dm, 'supply-set', { gameCode: code, playerId: A, supply: { air: 6, power: 2, food: 3, water: 3 } });
  ok(ss.success && ss.supply.air === 6, 'GM sets supply ratings');
  await sleep(100);
  ok(tvTable.t.crew.some((c) => c.playerId === A && c.supply.power === 2), 'TV sees crew supply for the danger strip');
  let air = 6;
  let sawDrop = false;
  for (let i = 0; i < 12 && air > 0; i++) {
    const sr = await call(pA, 'supply-roll', { key: 'air' });
    ok(sr.success && sr.before === air && sr.dice.length === Math.min(air, 6), 'supply roll uses Stress Dice = rating');
    eq(sr.after, sr.before - sr.dice.filter((d) => d === 1).length, 'each 1 drops the rating one step');
    if (sr.after < sr.before) sawDrop = true;
    air = sr.after;
  }
  ok(sawDrop, 'supply rating decremented at least once in 12 rolls');
  const bad = await call(pB, 'supply-roll', { key: 'air' });
  ok(bad.error, 'cannot roll a supply that is not set');

  /* ── Pools (row 44) ── */
  const pi = await call(dm, 'pools-init', { gameCode: code, reset: true, defs: [{ key: 'momentum', label: 'MOMENTUM', max: 6, owner: 'players' }, { key: 'threat', label: 'THREAT', owner: 'gm', visibleToPlayers: false }], values: { threat: 4 } });
  eq(pi.pools, { momentum: 0, threat: 4 }, 'pools initialised (threat 2 × players)');
  const capped = await call(dm, 'pool-delta', { gameCode: code, key: 'momentum', delta: 10 });
  eq(capped.value, 6, 'momentum capped at max 6');
  const th = await call(dm, 'pool-delta', { gameCode: code, key: 'threat', delta: 9 });
  eq(th.value, 13, 'threat uncapped');
  await sleep(100);
  eq(aTable.t.pools.map((p) => p.key), ['momentum'], 'players see momentum only');
  eq(tvTable.t.pools.map((p) => p.key), ['momentum'], 'TV sees momentum only (threat hidden)');
  eq(dmTable.t.pools.threat, 13, 'GM sees threat');
  await call(dm, 'pool-set', { gameCode: code, key: 'momentum', value: 3 });
  await call(pB, 'player-roll', { clientId: 'm-roll-3', roll: { kind: '2d20', label: 'BATTLE', momentum: 2, flags: [] } });
  await sleep(150);
  eq(dmTable.t.pools.momentum, 5, 'momentum generated by a player roll joins the pool');
  await call(pB, 'player-roll', { clientId: 'm-roll-4', roll: { kind: '2d20', label: 'BATTLE', momentum: 4, flags: [] } });
  await sleep(150);
  eq(dmTable.t.pools.momentum, 6, 'player-generated momentum capped server-side');
  const neg = await call(dm, 'pool-delta', { gameCode: code, key: 'momentum', delta: -20 });
  eq(neg.value, 0, 'pool floor 0');
  const unk = await call(pA, 'pool-delta', { gameCode: code, key: 'momentum', delta: 1 });
  ok(unk.error, 'players cannot set pools directly');

  /* ── Initiative (rows 26, 27) ── */
  const aTurn = collect(pA, 'your-turn');
  const bTurn = collect(pB, 'your-turn');
  const is = await call(dm, 'init-set', { gameCode: code, initiative: { active: true, round: 1, turn: 0, order: [
    { id: 'i-a', kind: 'pc', label: 'Ripley', playerId: A, tokenId: 'pc-alice', card: 2 },
    { id: 'i-x', kind: 'creature', label: 'Drone', tokenId: 'cr-1', card: 5 },
    { id: 'i-b', kind: 'pc', label: 'Hicks', playerId: B, card: 8 },
  ] } });
  ok(is.success && is.initiative.order.length === 3, 'initiative set');
  await sleep(150);
  eq(aTurn.length, 1, 'acting player gets your-turn');
  eq(bTurn.length, 0, 'other player does not');
  ok(aTable.t.initiative.mine === true, 'player view flags my turn');
  eq(tvTable.t.initiative.current.tokenId, 'pc-alice', 'TV knows the active token');
  ok(!('order' in tvTable.t.initiative), 'TV gets the current actor only');
  await call(dm, 'init-step', { gameCode: code, dir: 1 });
  await sleep(120);
  eq(tvTable.t.initiative.current.label, 'Drone', 'NEXT advances to the creature');
  ok(aTable.t.initiative.mine === false, 'turn left player A');
  await call(dm, 'init-step', { gameCode: code, dir: 1 });
  await sleep(120);
  eq(bTurn.length, 1, 'player B gets your-turn');
  const notMine = await call(pA, 'init-pass', { toId: 'i-a' });
  ok(notMine.error, 'only the acting player may pass');
  await call(dm, 'init-step', { gameCode: code, dir: 1 });
  await sleep(120);
  eq(dmTable.t.initiative.round, 2, 'past the last actor starts a new round');
  ok(dmTable.t.initiative.order.every((e) => !e.done), 'new round clears done');
  eq(aTurn.length, 2, 'player A notified again in round 2');
  const pass = await call(pA, 'init-pass', { toId: 'i-b' });
  ok(pass.success, 'acting PC passes the turn to an ally (Dune)');
  await sleep(120);
  eq(bTurn.length, 2, 'ally notified');
  ok(dmTable.t.initiative.order[0].done, 'passer marked done');
  await call(dm, 'init-goto', { gameCode: code, index: 1 });
  await sleep(100);
  eq(tvTable.t.initiative.current.label, 'Drone', 'GM nominates who acts next');
  await call(dm, 'init-end', { gameCode: code });
  await sleep(100);
  ok(tvTable.t.initiative.active === false, 'END hides the tracker');

  /* ── Creature cards: hp on tokens (row 28) ── */
  const cr = await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'cr-1', kind: 'creature', label: 'Drone', ref: 'xenomorph-drone', hp: 8, hpMax: 8, x: 0.6, y: 0.6 } });
  ok(cr.success && cr.token.hp === 8, 'creature token with hp');
  await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'cr-1', hp: 5, status: ['wounded'] } });
  await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'cr-1', hp: 99 } });
  await sleep(150);
  eq(dmBoard.b.tokens['cr-1'].hp, 8, 'hp clamped to hpMax');
  await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'cr-1', hp: 5 } });
  await sleep(150);
  eq(dmBoard.b.tokens['cr-1'].hp, 5, 'damage applied');
  dm.emit('board-fog', { gameCode: code, fog: false });
  await sleep(150);
  const tvCr = tvBoard.b.tokens['cr-1'];
  ok(tvCr && !('hp' in tvCr) && !('hpMax' in tvCr) && !('ref' in tvCr), 'TV never sees creature hp/ref');
  ok(tvCr.status.includes('wounded'), 'creature status ring reaches the TV');

  /* ── Injuries ── */
  const ia = await call(dm, 'injury-add', { gameCode: code, playerId: A, injury: { id: 'broken-nose', name: 'Broken Nose', text: 'MANIPULATION -1', roll: '24' } });
  ok(ia.success && ia.injury.uid, 'injury applied');
  await sleep(120);
  ok(aPlayer.p.injuries.length === 1 && aPlayer.p.injuries[0].name === 'Broken Nose', 'phone sees the injury');

  /* ── Restart: everything persisted ── */
  await sleep(400);
  await killServer();
  await startServer();
  const dm2 = await connect();
  const dm2Board = once(dm2, 'board-state');
  const res = await call(dm2, 'resume-game', { code, dmToken: created.dmToken });
  ok(res.success, 'DM resumes after restart');
  eq((await dm2Board).board.tokens['cr-1'].hp, 5, 'creature hp persisted across restart');
  eq(res.table.pools, { momentum: 0, threat: 13 }, 'pools persisted');
  ok(res.table.rolls.length >= 4, 'roll feed persisted');
  eq(res.table.initiative.order.length, 3, 'initiative persisted');
  eq(res.players[A].injuries.length, 1, 'injuries persisted');
  eq(res.players[A].supply.power, 2, 'supply persisted');
  const ir = await call(dm2, 'injury-remove', { gameCode: code, playerId: A, uid: res.players[A].injuries[0].uid });
  ok(ir.success, 'injury healed');
  const after = await once(dm2, 'players-updated', 2000, () => true).catch(() => null);
  ok(!after || after.players[A].injuries.length === 0, 'healing removes the injury');
  ok(res.log.some((e) => e.type === 'panic') && res.log.some((e) => e.type === 'supply') && res.log.some((e) => e.type === 'injury'), 'panic / supply / injury logged');

  await call(dm2, 'end-game', { code, dmToken: created.dmToken });
  console.log(`test-mechanics: ${checks} checks passed`);
} catch (err) {
  console.error('test-mechanics FAILED:', err);
  process.exitCode = 1;
} finally {
  for (const s of sockets) { try { s.close(); } catch { /* ignore */ } }
  if (server) await killServer();
  try { rmSync(DATA, { recursive: true, force: true }); } catch { /* ignore */ }
}
