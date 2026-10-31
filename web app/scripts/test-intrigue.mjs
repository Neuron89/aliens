#!/usr/bin/env node
/* F6 — Intrigue web + prescience regression test.
   Static: every bundled DUNE pack carries relations[] whose `to` resolves to a person of the
   same pack (src/engine/components/run/intrigueGraph.js), the schema rejects a bad kind, the
   graph/ring layout/clue helpers behave, both theme skins resolve.
   Socket (spawned server, temp DATA_DIR): REVEAL of a secret relation is an ad-hoc clue-reveal
   that reaches the phones (and only the chosen ones), never the board; vision-send is DM-only,
   validated (text, ms clamp, recipients, rate limit), reaches the board + phones, private when
   targeted, can skip the board or the phones, and is logged.
   Usage: node scripts/test-intrigue.mjs */
import { spawn } from 'child_process';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import assert from 'assert/strict';
import { io } from 'socket.io-client';
import { validatePack } from '../server/schema/validate.js';
import { EVENT_NAMES } from '../server/guard.js';
import { buildGraph, relationProblems, ringLayout, relationClue, shortLabel, RELATION_KINDS, KIND_STYLE } from '../src/engine/components/run/intrigueGraph.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3900 + Math.floor(Math.random() * 90);
const DATA = mkdtempSync(join(tmpdir(), 'intrigue-'));
const URL = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

/* ═══ Static checks ═══ */
const duneDir = join(ROOT, 'src', 'universes', 'dune', 'content');
const dunePacks = readdirSync(duneDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(duneDir, f), 'utf8')));
eq(dunePacks.length, 4, 'four bundled DUNE packs');
for (const p of dunePacks) {
  const g = buildGraph(p);
  ok(validatePack(p).ok, `${p.id}: schema-valid with relations`);
  ok(g.edges.length >= 12, `${p.id}: at least 12 relations (${g.edges.length})`);
  ok(g.edges.some((e) => e.secret) && g.edges.some((e) => !e.secret), `${p.id}: has secret and open relations`);
  eq(g.unresolved, [], `${p.id}: every relation resolves`);
  eq(relationProblems(p), [], `${p.id}: no relation problems`);
  ok(g.edges.some((e) => e.from.startsWith('pc:')) && g.edges.some((e) => e.to.startsWith('pc:')), `${p.id}: PCs are wired into the web`);
  ok(new Set(g.edges.map((e) => e.id)).size === g.edges.length, `${p.id}: relation ids are unique`);
  ok(g.edges.every((e) => /^[A-Za-z0-9_-]{1,64}$/.test(e.id)), `${p.id}: relation ids are valid clue ids`);
  ok(g.edges.every((e) => e.note && e.note.length <= 300), `${p.id}: every relation has a short note`);
  // Every person of the pack with an agenda/secret is a node (no relation lost to a label clash).
  eq(g.nodes.length, (p.npcs || []).length + (p.characters || []).length, `${p.id}: one node per NPC and character`);
}
{
  const p = structuredClone(dunePacks[0]);
  p.npcs[0].relations = [{ to: p.npcs[1].name, kind: 'adores' }];
  ok(!validatePack(p).ok, 'schema rejects an unknown relation kind');
  p.npcs[0].relations = [{ to: p.npcs[1].name, kind: 'ally', extra: 1 }];
  ok(!validatePack(p).ok, 'schema rejects unknown relation fields');
  p.npcs[0].relations = [{ to: 'Somebody Else', kind: 'ally' }];
  ok(validatePack(p).ok && relationProblems(p).length === 1, 'an unresolvable `to` passes the schema but is caught by relationProblems');
  p.characters[0].relations = [{ to: p.characters[1].id, kind: 'rival' }];
  p.npcs[0].relations = [];
  eq(relationProblems(p), [], 'a character id resolves as `to`');
}
{
  const g = buildGraph(dunePacks.find((p) => p.id === 'the-water-debt'));
  const pos = ringLayout(g.nodes, 1000, 700);
  const cx = 500; const cy = 350;
  const d = (k) => Math.hypot((pos[k].x - cx) / 1, (pos[k].y - cy) / 0.7);
  const pcs = g.nodes.filter((n) => n.type === 'pc');
  const npcs = g.nodes.filter((n) => n.type === 'npc');
  ok(Math.max(...pcs.map((n) => d(n.key))) < Math.min(...npcs.map((n) => d(n.key))), 'ring layout: every PC sits inside every NPC');
  ok(Object.values(pos).every((p) => p.x >= 0 && p.x <= 1000 && p.y >= 0 && p.y <= 700), 'ring layout fits the panel');
  eq(ringLayout(g.nodes, 1000, 700), pos, 'ring layout is deterministic');
  const byKey = Object.fromEntries(g.nodes.map((n) => [n.key, n]));
  const sec = g.edges.find((e) => e.secret);
  const clue = relationClue(sec, byKey);
  eq(clue.id, sec.id, 'relation clue id = relation id');
  ok(clue.text.includes(byKey[sec.from].name) && clue.text.includes(byKey[sec.to].name) && clue.text.includes(sec.note), 'relation clue names both people and carries the note');
  eq([shortLabel('Crawler Boss Iselde Varn'), shortLabel('Ferrouk of Umm Kareth'), shortLabel('Reverend Mother Thessaly Orn'), shortLabel('Steward-of-Passage Ebbe Lunn')],
    ['Iselde Varn', 'Ferrouk', 'Thessaly Orn', 'Ebbe Lunn'], 'short labels drop titles and "of …"');
  ok(RELATION_KINDS.every((k) => KIND_STYLE[k]?.color && KIND_STYLE[k]?.verb), 'every kind has a colour and a verb');
  eq(buildGraph({ npcs: [{ name: 'A', role: '', agenda: '', behavior: '' }] }).edges, [], 'a pack without relations draws no edges');
}
{
  // Skins: theme-driven, never the universe id (VisionOverlay.visionSkin mirrors this rule).
  const alienTheme = (await import(pathToFileURL(join(ROOT, 'src', 'universes', 'alien', 'theme.js')).href)).default;
  const duneTheme = (await import(pathToFileURL(join(ROOT, 'src', 'universes', 'dune', 'theme.js')).href)).default;
  const skin = (t) => t.visionSkin || (t.crt ? 'order' : 'prescience');
  eq([skin(alienTheme), skin(duneTheme)], ['order', 'prescience'], 'ALIEN = special order, DUNE = prescience');
}
ok(EVENT_NAMES.includes('vision-send'), 'vision-send is in EVENT_NAMES');

/* ═══ Socket checks ═══ */
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
const once = (s, ev, ms = 3000) => new Promise((res, rej) => {
  const t = setTimeout(() => { s.off(ev, h); rej(new Error('timeout waiting for ' + ev)); }, ms);
  const h = (d) => { clearTimeout(t); s.off(ev, h); res(d); };
  s.on(ev, h);
});
const collect = (s, ev) => { const arr = []; s.on(ev, (d) => arr.push(d)); return arr; };
const lastTable = (s) => { const box = { t: null }; s.on('table-state', (d) => { box.t = d.table; }); return box; };

try {
  await startServer();
  const pack = dunePacks.find((p) => p.id === 'the-water-debt');
  const dm = await connect();
  const { code } = await call(dm, 'create-game', { universeId: 'dune', packId: pack.id });
  ok(/^[A-Z]{4}$/.test(code), 'dune game created');
  const dmTable = lastTable(dm);
  const dmLog = collect(dm, 'log-entry');
  const pA = await connect();
  const pB = await connect();
  const tv = await connect();
  const jA = await call(pA, 'join-game', { code, playerName: 'Alice' });
  const jB = await call(pB, 'join-game', { code, playerName: 'Bob' });
  ok((await call(tv, 'join-board', { code })).success, 'board joined');
  const aClues = collect(pA, 'clue-revealed');
  const bClues = collect(pB, 'clue-revealed');
  const tvClues = collect(tv, 'clue-revealed');
  const aTable = lastTable(pA);
  const tvTable = lastTable(tv);

  /* ── REVEAL a secret relation = ad-hoc clue-reveal ── */
  const g = buildGraph(pack);
  const byKey = Object.fromEntries(g.nodes.map((n) => [n.key, n]));
  const secret = g.edges.find((e) => e.secret);
  const r1 = await call(dm, 'clue-reveal', { gameCode: code, clueId: secret.id, to: [jA.playerId], clue: relationClue(secret, byKey) });
  ok(r1.success && r1.id === secret.id, 'relation reveal acked with the relation id');
  await sleep(150);
  eq(aClues.length, 1, 'the chosen phone gets clue-revealed');
  eq(aClues[0].clue.id, secret.id, 'clue id is the relation id');
  ok(aClues[0].clue.text.includes(secret.note), 'the phone sees the relation note');
  eq(aClues[0].clue.source, 'Intrigue', 'clue source marks the intrigue web');
  eq(bClues.length, 0, 'the other phone gets nothing');
  eq(tvClues.length, 0, 'the board never receives clues');
  ok(aTable.t.clues.some((c) => c.id === secret.id), 'the clue sits in the phone table view');
  ok(!('clues' in (tvTable.t || {})), 'the board table view carries no clues');
  ok(dmTable.t.clues.some((c) => c.id === secret.id && c.status === 'revealed'), 'the GM table marks the relation clue revealed (graph draws it solid)');
  ok(dmLog.some((e) => e.entry?.type === 'clue' && e.entry.text.includes('Clue revealed')), 'reveal is logged');
  const r2 = await call(dm, 'clue-reveal', { gameCode: code, clueId: secret.id, to: 'all', clue: relationClue(secret, byKey) });
  ok(r2.success, 'SHARE MORE with everyone');
  await sleep(150);
  eq(bClues.length, 1, 'second phone now gets it');
  eq(dmTable.t.clues.filter((c) => c.id === secret.id).length, 1, 'no duplicate clue for a re-reveal');
  ok((await call(pA, 'clue-reveal', { gameCode: code, clueId: 'rel-x', clue: { text: 'forged' } })).error, 'a phone cannot reveal');

  /* ── vision-send ── */
  ok((await call(pA, 'vision-send', { gameCode: code, text: 'nope' })).error, 'a phone cannot send a vision');
  ok((await call(tv, 'vision-send', { gameCode: code, text: 'nope' })).error, 'the board cannot send a vision');
  ok((await call(dm, 'vision-send', { gameCode: code, text: '   ' })).error, 'empty vision rejected');
  ok((await call(dm, 'vision-send', { gameCode: code, text: 'x', to: ['p_nobody'] })).error, 'unknown recipients rejected');
  ok((await call(dm, 'vision-send', { gameCode: code, text: 'x', to: 'none', board: false })).error, 'nowhere to show it → rejected');
  await sleep(450);

  let tvV = once(tv, 'vision');
  let aV = once(pA, 'vision');
  let bV = once(pB, 'vision');
  const v1 = await call(dm, 'vision-send', { gameCode: code, text: '  Sand closes over\n a banner you know.  ', ms: 7000 });
  ok(v1.success && v1.ms === 7000 && v1.phones === 2 && v1.boards === 1, 'vision to everyone acked with counts');
  const [tvv, av, bv] = (await Promise.all([tvV, aV, bV])).map((d) => d.vision);
  eq(tvv.text, 'Sand closes over a banner you know.', 'text collapsed to one trimmed line');
  eq([tvv.ms, av.ms, bv.ms], [7000, 7000, 7000], 'ms delivered');
  eq([tvv.id, av.id], [v1.id, v1.id], 'same id everywhere');
  eq([tvv.private, av.private], [false, false], 'broadcast vision is not private');
  ok(dmLog.some((e) => e.entry?.type === 'narration' && e.entry.text.startsWith('Vision → everyone + table')), 'vision logged as narration');
  ok((await call(dm, 'vision-send', { gameCode: code, text: 'too soon' })).error === 'RATE LIMITED.', 'rate limited');
  await sleep(450);

  const aOnly = collect(pA, 'vision');
  const bNone = collect(pB, 'vision');
  const tvNone = collect(tv, 'vision');
  const v2 = await call(dm, 'vision-send', { gameCode: code, text: 'Only you.', ms: 999999, to: [jA.playerId], board: false });
  ok(v2.success && v2.ms === 30000 && v2.phones === 1 && v2.boards === 0, 'private phone-only vision, ms clamped to 30 s');
  await sleep(200);
  eq(aOnly.length, 1, 'chosen phone gets the flash');
  eq(aOnly[0].vision.private, true, 'targeted vision is private');
  eq([bNone.length, tvNone.length], [0, 0], 'other phone and the board get nothing');
  await sleep(300);

  const v3 = await call(dm, 'vision-send', { gameCode: code, text: 'Table only.', ms: 10, to: 'none' });
  ok(v3.success && v3.ms === 2000 && v3.phones === 0 && v3.boards === 1, 'board-only vision, ms clamped to 2 s');
  await sleep(200);
  eq(tvNone.length, 1, 'board got the table-only vision');
  eq([aOnly.length, bNone.length], [1, 0], 'phones skipped');
  await sleep(300);

  const v4 = await call(dm, 'vision-send', { gameCode: code, text: 'x'.repeat(900), ms: 'soon' });
  ok(v4.success && v4.ms === 9000, 'non-numeric ms → default 9 s');
  await sleep(150);
  eq(tvNone.at(-1).vision.text.length, 300, 'text capped at 300 chars');
  await sleep(300);

  /* Hostile payloads */
  for (const bad of [null, 'str', 42, { text: { toString: 1 } }, { text: ['a'] }, { text: 'a', to: { __proto__: 1 } }, { text: 'a', to: ['__proto__'] }]) {
    await sleep(420);
    const r = await call(dm, 'vision-send', bad && typeof bad === 'object' ? { gameCode: code, ...bad } : bad);
    ok(r && (r.error || r.success), `hostile payload answered (${JSON.stringify(bad)})`);
  }
  ok(!/\[SOCKET\] handler/.test(stderr), 'no handler threw');
  console.log(`test-intrigue: ${checks} checks passed`);
} catch (err) {
  console.error('test-intrigue FAILED:', err);
  if (stderr) console.error('--- server stderr ---\n' + stderr.slice(-3000));
  process.exitCode = 1;
} finally {
  for (const s of sockets) { try { s.close(); } catch { /* ignore */ } }
  if (server) await killServer();
  try { rmSync(DATA, { recursive: true, force: true }); } catch { /* ignore */ }
}
