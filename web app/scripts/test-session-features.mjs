#!/usr/bin/env node
/* Session-feature regression test (docs/RESEARCH_GM_PLAYER_EXPERIENCE.md wave 1).
   Spawns the server with a temp DATA_DIR and checks: narrate → board/players,
   handout send/seen receipts, clue reveal filtering, clocks tick/visibility,
   anonymous pause, session zero, session log + persistence across a restart,
   character-submit → DM list, advance-act agenda push, item-received + board-flash,
   roll/message dedupe (offline queue replay).
   Usage: node scripts/test-session-features.mjs */
import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert/strict';
import { io } from 'socket.io-client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3800 + Math.floor(Math.random() * 90);
const DATA = mkdtempSync(join(tmpdir(), 'session-features-'));
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
const call = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, res));
const once = (s, ev, ms = 3000, pred = () => true) => new Promise((res, rej) => {
  const t = setTimeout(() => { s.off(ev, h); rej(new Error('timeout waiting for ' + ev)); }, ms);
  const h = (d) => { if (!pred(d)) return; clearTimeout(t); s.off(ev, h); res(d); };
  s.on(ev, h);
});
/** Collect every payload of `ev` on socket s (returns the live array). */
const collect = (s, ev) => { const arr = []; s.on(ev, (d) => arr.push(d)); return arr; };
const lastTable = (s) => { const box = { t: null }; s.on('table-state', (d) => { box.t = d.table; }); return box; };

try {
  /* ── Setup: DM, two players, a TV ── */
  await startServer();
  const dm = await connect();
  const created = await call(dm, 'create-game', { universeId: 'alien', packId: 'tartarus-reach' });
  const code = created.code;
  ok(/^[A-Z]{4}$/.test(code), 'game created');
  const dmTable = lastTable(dm);
  const dmLogLive = collect(dm, 'log-entry');

  const pA = await connect();
  const pB = await connect();
  const tv = await connect();
  const jA = await call(pA, 'join-game', { code, playerName: 'Alice' });
  const jB = await call(pB, 'join-game', { code, playerName: 'Bob' });
  ok(jA.table && jA.table.handouts && !('clientIds' in jA.table), 'join response carries the player table view');
  const jTv = await call(tv, 'join-board', { code });
  ok(jTv.success && jTv.table && jTv.table.boardMode === 'map', 'board join carries the board table view');
  const aTable = lastTable(pA);
  const bTable = lastTable(pB);
  const tvTable = lastTable(tv);

  /* ── Session zero ── */
  ok((await call(dm, 'safety-set', { gameCode: code, enabled: true, tone: ['Horror'], warnings: ['Body horror', 'Claustrophobia'], linesVeils: 'LINE: harm to kids' })).success, 'safety-set ok');
  await sleep(150);
  eq(aTable.t.safety.enabled, true, 'player sees session zero');
  eq(aTable.t.safety.warnings, ['Body horror', 'Claustrophobia'], 'warnings delivered');
  eq(aTable.t.safety.confirmed, false, 'not yet confirmed');
  ok((await call(pA, 'safety-confirm', {})).success, 'safety-confirm ok');
  await sleep(100);
  eq(aTable.t.safety.confirmed, true, 'confirm sticks for A');
  eq(bTable.t?.safety?.confirmed ?? false, false, 'B still unconfirmed');
  ok(dmTable.t.safety.confirmed.includes(jA.playerId), 'DM sees who confirmed session zero');

  /* ── Narration → board + phones ── */
  const tvNarr = once(tv, 'table-state', 3000, (d) => d.table?.narration);
  const r1 = await call(dm, 'narrate', { gameCode: code, text: 'The beacon is broadcasting, but nobody answers.', title: 'Touchdown on Pad B', mode: 'caption' });
  ok(r1.success && r1.id, 'narrate ok');
  const tvN = (await tvNarr).table.narration;
  eq(tvN.text, 'The beacon is broadcasting, but nobody answers.', 'board gets the narration text');
  eq(tvN.mode, 'caption', 'board gets the mode');
  await sleep(80);
  eq(aTable.t.narration?.id, r1.id, 'player A gets the narration');
  eq(bTable.t.narration?.id, r1.id, 'player B gets the narration');
  await call(dm, 'narrate', { gameCode: code, text: 'Card text', mode: 'card', art: 'javascript:alert(1)' });
  await sleep(80);
  eq(tvTable.t.narration.mode, 'card', 'card mode');
  eq(tvTable.t.narration.art, null, 'unsafe art URL dropped');
  ok((await call(dm, 'board-mode', { gameCode: code, mode: 'theatre', title: 'ACT I — HOPE', subtitle: 'Touchdown', art: '/art/x.webp' })).success, 'board-mode ok');
  await sleep(80);
  eq(tvTable.t.boardMode, 'theatre', 'board switches to theatre');
  eq(tvTable.t.theatre.title, 'ACT I — HOPE', 'theatre title on board');
  ok(!('handouts' in tvTable.t) && !('clues' in tvTable.t) && !('run' in tvTable.t), 'board view has no GM-only/handout data');
  ok((await call(dm, 'narrate-clear', { gameCode: code })).success, 'narrate-clear ok');
  await sleep(80);
  eq(tvTable.t.narration, null, 'board narration cleared');
  ok(dmLogLive.some((e) => e.entry.type === 'narration'), 'DM receives log entries live (log-entry)');
  const notDm = await call(pA, 'narrate', { gameCode: code, text: 'hax' });
  ok(notDm.error, 'players cannot narrate');

  /* ── Handouts with receipts ── */
  const aGot = once(pA, 'handout-received');
  const bHandouts = collect(pB, 'handout-received');
  const hs = await call(dm, 'handout-send', {
    gameCode: code, handoutId: 'opening-briefing',
    handout: { title: 'RELIEF ROTATION 14', from: 'MU/TH/UR', text: 'Welcome to Tartarus Reach.', priority: 'PRIORITY' },
    to: [jA.playerId],
  });
  ok(hs.success && hs.id === 'opening-briefing', 'handout-send keeps the pack id');
  const got = await aGot;
  eq(got.handout.title, 'RELIEF ROTATION 14', 'A receives the handout');
  eq(got.handout.seen, false, 'unseen on arrival');
  ok(!('seenBy' in got.handout) && !('recipients' in got.handout), 'player payload has no receipts/recipients');
  await sleep(100);
  eq(bHandouts.length, 0, 'B does not receive a handout addressed to A');
  eq(bTable.t.handouts.length, 0, 'B table has no handouts');
  eq(aTable.t.handouts.length, 1, 'A table lists the handout (re-openable)');
  const dmSeen = once(dm, 'handout-seen');
  ok((await call(pA, 'handout-seen', { handoutId: 'opening-briefing' })).success, 'handout-seen ok');
  const seenEvt = await dmSeen;
  eq([seenEvt.seen, seenEvt.of], [1, 1], 'DM receipt: seen 1/1');
  await sleep(80);
  eq(dmTable.t.handouts[0].seenBy, [jA.playerId], 'DM table seenBy');
  ok((await call(pB, 'handout-seen', { handoutId: 'opening-briefing' })).error, 'B cannot mark a handout it never got');
  const custom = await call(dm, 'handout-send', { gameCode: code, custom: { title: 'NOTE', text: 'Ad-hoc', image: '/art/handouts/n.webp' }, to: 'all' });
  ok(custom.success && custom.id.startsWith('h-'), 'custom handout to all');
  await sleep(80);
  eq(bTable.t.handouts.length, 1, 'B gets the broadcast handout');
  eq(bTable.t.handouts[0].image, '/art/handouts/n.webp', 'handout image delivered');

  /* ── Clues: seed + reveal filtering ── */
  const seed = await call(dm, 'session-seed', {
    gameCode: code,
    clues: [{ id: 'egg-manifest', text: 'The Lamplighter manifest lists three sample cases, not two.', source: 'Pad A cargo log' }, { id: 'known', text: 'Venn has sealed orders.', status: 'revealed' }],
    clocks: [{ id: 'adamant-chorus', label: 'RETRIEVAL SHIP ARRIVES', segments: 6, kind: 'racing' }],
  });
  eq(seed.added, 3, 'seeded 2 clues + 1 clock');
  eq((await call(dm, 'session-seed', { gameCode: code, clues: [{ id: 'egg-manifest', text: 'dup' }] })).added, 0, 'seeding is idempotent');
  await sleep(80);
  eq(dmTable.t.seeded, true, 'table.seeded set');
  eq(aTable.t.clues.map((c) => c.id), ['known'], 'pack clue with status revealed is visible to all; hidden one is not');
  const bClue = once(pB, 'clue-revealed');
  const aClues = collect(pA, 'clue-revealed');
  ok((await call(dm, 'clue-reveal', { gameCode: code, clueId: 'egg-manifest', to: [jB.playerId] })).success, 'reveal to B');
  const bc = await bClue;
  eq(bc.clue.foundBy, ['Bob'], 'clue credits the finder by name');
  await sleep(80);
  eq(aClues.length, 0, 'A does not get a clue revealed to B');
  ok(!aTable.t.clues.some((c) => c.id === 'egg-manifest'), 'A table does not list it');
  ok(bTable.t.clues.some((c) => c.id === 'egg-manifest'), 'B table lists it');
  eq(dmTable.t.clues.find((c) => c.id === 'egg-manifest').foundBy, [jB.playerId], 'DM sees found-by ids');
  await call(dm, 'clue-reveal', { gameCode: code, clueId: 'egg-manifest', to: 'all' });
  await sleep(80);
  ok(aTable.t.clues.some((c) => c.id === 'egg-manifest'), 'after reveal-to-all A has it');
  const adhoc = await call(dm, 'clue-upsert', { gameCode: code, clue: { text: 'Abram lies about the lift.' } });
  ok(adhoc.success && adhoc.id.startsWith('clue-'), 'ad-hoc clue');
  await sleep(50);
  ok(dmTable.t.clues.find((c) => c.id === adhoc.id).adhoc, 'ad-hoc flag');

  /* ── Clocks: tick + visibility ── */
  const hidden = await call(dm, 'clock-upsert', { gameCode: code, clock: { label: 'XENO HUNTS', segments: 4, kind: 'danger', visibility: 'gm' } });
  ok(hidden.success, 'gm-only clock');
  const aTicks = collect(pA, 'clock-ticked');
  const tvTicks = collect(tv, 'clock-ticked');
  await call(dm, 'clock-tick', { gameCode: code, id: hidden.id, delta: 1 });
  const tk = await call(dm, 'clock-tick', { gameCode: code, id: 'adamant-chorus', delta: 2 });
  eq(tk.clock.filled, 2, 'tick applies delta');
  await call(dm, 'clock-tick', { gameCode: code, id: 'adamant-chorus', delta: 99 });
  await sleep(120);
  eq(dmTable.t.clocks.find((c) => c.id === 'adamant-chorus').filled, 6, 'clamped to segments');
  eq(aTicks.length, 2, 'players hear only the visible clock ticks');
  eq(tvTicks.length, 2, 'board hears only the visible clock ticks');
  eq(tvTable.t.clocks.map((c) => c.id), ['adamant-chorus'], 'board sees visible clocks only');
  eq(aTable.t.clocks.map((c) => c.id), ['adamant-chorus'], 'phones see visible clocks only');
  eq(dmTable.t.clocks.length, 2, 'DM sees every clock');
  await call(dm, 'clock-upsert', { gameCode: code, clock: { id: hidden.id, visibility: 'all' } });
  await sleep(80);
  eq(tvTable.t.clocks.length, 2, 'revealing a clock shows it on the board');
  ok((await call(dm, 'clock-remove', { gameCode: code, id: hidden.id })).success, 'clock-remove');

  /* ── Anonymous pause ── */
  const dmPauseEvents = collect(dm, 'pause-requested');
  const pr = await call(pA, 'pause-request', {});
  ok(pr.success, 'pause-request ok');
  await sleep(150);
  eq(dmPauseEvents.length, 1, 'DM gets pause-requested');
  const blob = JSON.stringify(dmPauseEvents[0]) + JSON.stringify(dmTable.t.pause) + JSON.stringify(tvTable.t.pause);
  ok(!blob.includes(jA.playerId) && !blob.includes('Alice'), 'pause payloads never identify the player');
  ok(tvTable.t.pause && tvTable.t.pause.at, 'board shows the PAUSE card');
  eq(bTable.t.paused, true, 'other phones see the table is paused');
  const dmLogNow = (await call(dm, 'table-sync', {})).log;
  const pauseLog = dmLogNow.filter((e) => e.type === 'pause');
  ok(pauseLog.length === 1 && !JSON.stringify(pauseLog).includes(jA.playerId) && !JSON.stringify(pauseLog).includes('Alice'), 'log records the pause anonymously');
  ok((await call(dm, 'pause-clear', { gameCode: code })).success, 'pause-clear');
  await sleep(80);
  eq(tvTable.t.pause, null, 'board pause cleared');

  /* ── Character submit (player-built) ── */
  const dmSub = once(dm, 'character-submitted');
  const sub = await call(pB, 'character-submit', { character: { name: 'Juno Okafor', career: 'Roughneck', attributes: { strength: 4 }, skills: {}, gear: [] } });
  ok(sub.success, 'character-submit ok');
  const sEvt = await dmSub;
  eq([sEvt.submission.playerId, sEvt.submission.status, sEvt.submission.character.name], [jB.playerId, 'pending', 'Juno Okafor'], 'DM sees the submission');
  ok(/^[a-z0-9-]+$/.test(sEvt.submission.character.id), 'submission gets a kebab id');
  await sleep(80);
  eq(bTable.t.submission.status, 'pending', 'player sees pending status');
  ok(!('submissions' in bTable.t), 'players never see other submissions');
  ok((await call(pB, 'character-submit', { character: { career: 'no name' } })).error, 'nameless character rejected');
  const bUpd = once(pB, 'submission-updated');
  const bAssigned = once(pB, 'character-assigned');
  dm.emit('assign-character', { gameCode: code, playerId: jB.playerId, character: sEvt.submission.character, tracks: { health: 4 }, trackMax: { health: 4 }, conditions: [] });
  eq((await bUpd).submission.status, 'assigned', 'assigning resolves the submission');
  await bAssigned;

  /* ── Advance act → private agenda cards ── */
  const aAssigned = once(pA, 'character-assigned');
  dm.emit('assign-character', {
    gameCode: code, playerId: jA.playerId,
    character: { id: 'varga', name: 'Ines Varga', career: 'Officer', gear: ['Flashlight'], agendaByAct: { 1: 'Get the scoop turning.', 2: 'Enforce the quarantine.' } },
    tracks: { health: 3, stress: 0 }, trackMax: { health: 3, stress: 10 }, conditions: ['Starving'],
  });
  await aAssigned;
  const aOrders = once(pA, 'new-orders');
  const bOrders = collect(pB, 'new-orders');
  const adv = await call(dm, 'advance-act', { gameCode: code, actIndex: 1, actTitle: 'ACT II — DOUBT', sceneTitle: 'Lockdown' });
  eq(adv.sent, [jA.playerId], 'orders go only to players with an agenda for that act');
  const ord = await aOrders;
  eq([ord.actIndex, ord.actTitle, ord.text], [1, 'ACT II — DOUBT', 'Enforce the quarantine.'], 'A gets agendaByAct[2]');
  await sleep(80);
  eq(bOrders.length, 0, 'B (no agenda) gets nothing');
  eq(aTable.t.orders.length, 1, 'orders re-openable on the phone');
  eq([dmTable.t.run.actIndex, dmTable.t.run.sceneIndex], [1, 0], 'run moved to act II scene 1');
  ok((await call(dm, 'run-set', { gameCode: code, actIndex: 1, sceneIndex: 2, sceneTitle: 'The Ops archive', completed: { '1-0': true } })).success, 'run-set ok');

  /* ── Loot moment: item-received + board-flash ── */
  await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'pc-a', kind: 'pc', label: 'Varga', ownerPlayerId: jA.playerId, x: 0.5, y: 0.5 } });
  const aItem = once(pA, 'item-received');
  const tvFlash = once(tv, 'board-flash');
  dm.emit('update-player', { gameCode: code, playerId: jA.playerId, updates: { inventory: ['Flashlight', 'M314 Motion Tracker'], tracks: { stress: 2 } } });
  eq((await aItem).item, 'M314 Motion Tracker', 'phone gets item-received for the new item only');
  eq((await tvFlash).tokenId, 'pc-a', 'board flashes the PC token');

  /* ── Rolls + messages: queued replay is deduped ── */
  const dmRolls = collect(dm, 'roll');
  const roll = { summary: 'COMTECH — 2 successes', successes: 2 };
  ok((await call(pA, 'player-roll', { clientId: 'c-roll-1', roll })).success, 'roll acked');
  const dup = await call(pA, 'player-roll', { clientId: 'c-roll-1', roll });
  ok(dup.duplicate, 'replayed roll is a duplicate');
  await sleep(80);
  eq(dmRolls.length, 1, 'DM sees the roll exactly once');
  eq(dmTable.t.rolls.length, 1, 'roll buffered in table.rolls');
  const dmMsgs = collect(dm, 'player-message-received');
  await call(pA, 'player-message', { gameCode: code, text: 'queued hello', clientId: 'c-msg-1' });
  const dupMsg = await call(pA, 'player-message', { gameCode: code, text: 'queued hello', clientId: 'c-msg-1' });
  ok(dupMsg.duplicate, 'replayed message is a duplicate');
  await sleep(80);
  eq(dmMsgs.length, 1, 'DM gets the message once');

  /* ── Log note + log contents ── */
  ok((await call(dm, 'log-note', { gameCode: code, text: 'ENDING: ABOVE THE CLOUDS' })).success, 'log-note');
  const syncLog = (await call(dm, 'table-sync', {})).log;
  const types = new Set(syncLog.map((e) => e.type));
  for (const t of ['narration', 'handout', 'clue', 'clock', 'pause', 'character', 'act', 'scene', 'loot', 'track', 'roll', 'note', 'safety']) ok(types.has(t), `log has a ${t} entry`);
  ok(syncLog.some((e) => e.type === 'loot' && e.text.includes('M314 Motion Tracker')), 'loot logged');
  ok(syncLog.some((e) => e.type === 'track' && /STRESS 0 → 2/.test(e.text)), 'track change logged');
  dm.emit('kill-character', { gameCode: code, playerId: jB.playerId });
  await sleep(500); // > debounce

  /* ── Restart: table + log persist ── */
  for (const s of sockets) s.close();
  await killServer();
  await startServer();
  const dm2 = await connect();
  const res = await call(dm2, 'resume-game', { code, dmToken: created.dmToken });
  ok(res.success, 'DM resumes after restart');
  ok(Array.isArray(res.log) && res.log.length >= syncLog.length + 1, 'log persisted across restart');
  ok(res.log.some((e) => e.type === 'kill'), 'kill logged + persisted');
  eq(res.table.run.actIndex, 1, 'run progress persisted');
  eq(res.table.run.sceneIndex, 2, 'scene index persisted');
  eq(res.table.run.completed, { '1-0': true }, 'completed scenes persisted');
  eq(res.table.handouts.find((h) => h.id === 'opening-briefing').seenBy, [jA.playerId], 'receipts persisted');
  eq(res.table.clocks.find((c) => c.id === 'adamant-chorus').filled, 6, 'clock persisted');
  eq(res.table.boardMode, 'theatre', 'board mode persisted');
  eq(res.table.safety.enabled, true, 'session zero persisted');
  ok(!('clientIds' in res.table), 'DM view hides the dedupe buffer');
  const pA2 = await connect();
  const rj = await call(pA2, 'rejoin-game', { code, playerToken: jA.playerToken });
  ok(rj.success && rj.table.orders.length === 1 && rj.table.handouts.length === 2, 'player table restored on rejoin');
  const dupAfter = await call(pA2, 'player-roll', { clientId: 'c-roll-1', roll });
  ok(dupAfter.duplicate, 'dedupe survives a restart (no double roll after replay)');
  const tv2 = await connect();
  const jTv2 = await call(tv2, 'join-board', { code });
  eq(jTv2.table.boardMode, 'theatre', 'board rejoins in theatre mode');

  await call(dm2, 'end-game', { code, dmToken: created.dmToken });
  console.log(`test-session-features: ${checks} checks passed`);
} catch (err) {
  console.error('test-session-features FAILED:', err);
  process.exitCode = 1;
} finally {
  for (const s of sockets) { try { s.close(); } catch { /* ignore */ } }
  if (server) await killServer();
  try { rmSync(DATA, { recursive: true, force: true }); } catch { /* ignore */ }
}
