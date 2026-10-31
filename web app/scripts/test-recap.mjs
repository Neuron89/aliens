#!/usr/bin/env node
/* F5 — ship's log recap + handout documents.
   1. Unit (in-process): server/recap.js publicLog filtering (GM notes, secret rolls, private
      clues/handouts, GM-only clocks/pools, pauses and safety never leak), the deterministic
      templated recap (same input → same text, 150-300 words, both universes' voices), and the
      Claude path with an INJECTED fake client (request shape: claude-opus-5-5, streaming,
      adaptive thinking; the prompt carries only the public record; failure → template).
      The real API is never called.
   2. Client helpers: player/HandoutDoc.jsx parseDoc / docText / burnSeconds / isDocText /
      docStyle, bundled with esbuild (react external).
   3. Server: POST /api/recap (no ANTHROPIC_API_KEY → template) — dmToken required, SSE and
      JSON, secrets absent; a document handout (header + BURN line) reaches the phone intact.
   Usage: node scripts/test-recap.mjs */
import { spawn } from 'child_process';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import assert from 'assert/strict';
import { io } from 'socket.io-client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3700 + Math.floor(Math.random() * 90);
const DATA = mkdtempSync(join(tmpdir(), 'recap-'));
const URL = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
const words = (s) => (String(s).match(/\S+/g) || []).length;

process.env.ANTHROPIC_API_KEY = ''; // never the real API (also for the spawned server)
const SECRETS = ['SYNTHETIC-CAPTAIN', 'SECRET-DIE', 'PRIVATE-CLUE', 'GM-CLOCK', 'PRIVATE-MEMO', 'THREAT +3', 'Pause requested', 'Session zero', 'new orders to'];
const noSecrets = (text, where) => { for (const s of SECRETS) ok(!String(text).includes(s), `${where}: no "${s}"`); };

/* ── 1. Unit ─────────────────────────────────────────────────── */
const recap = await import(pathToFileURL(join(ROOT, 'server', 'recap.js')).href);
const { loadUniverseCore } = await import(pathToFileURL(join(ROOT, 'server', 'generator', 'universes.js')).href);
const alien = await loadUniverseCore('alien');
const dune = await loadUniverseCore('dune');

const T0 = Date.UTC(2026, 9, 31, 20, 0);
let n = 0;
const L = (type, text, extra = {}) => ({ id: `l${n++}`, at: T0 + n * 60000, type, text, ...extra });
const fakeGame = () => ({
  code: 'ABCD', createdAt: T0, universeId: 'alien',
  players: new Map([
    ['p1', { id: 'p1', name: 'Ann', character: { name: 'Rye', career: 'Pilot' }, alive: true }],
    ['p2', { id: 'p2', name: 'Bo', character: { name: 'Okafor', career: 'Medic' }, alive: false }],
  ]),
  table: {
    clues: [
      { id: 'c1', text: 'The airlock log was wiped at 0300.', status: 'revealed', revealedTo: 'all' },
      { id: 'c2', text: 'PRIVATE-CLUE: the medic was paid off.', status: 'revealed', revealedTo: ['p1'] },
      { id: 'c3', text: 'Hidden one', status: 'hidden', revealedTo: null },
    ],
    handouts: [{ id: 'h1', title: 'DOCKING ORDERS', recipients: 'all' }, { id: 'h2', title: 'PRIVATE-MEMO', recipients: ['p1'] }],
    clocks: [{ id: 'k1', label: 'HULL BREACH', filled: 3, segments: 6, visibility: 'all' }, { id: 'k2', label: 'GM-CLOCK', filled: 1, segments: 4, visibility: 'gm' }],
    poolDefs: { momentum: { label: 'MOMENTUM', visible: true }, threat: { label: 'THREAT', visible: false } },
  },
  log: [
    L('safety', 'Session zero: 2 content warning(s)'),
    L('character', 'Rye assigned to Ann'),
    L('act', 'ACT I begins — new orders to 2'),
    L('scene', 'Scene: ACT I — Docking at the derelict'),
    L('narration', 'Touchdown: The hull groans as the clamps bite.'),
    L('note', 'SYNTHETIC-CAPTAIN is the twist'),
    L('roll', '[SECRET] GM: SECRET-DIE 3 successes', { secret: true }),
    L('roll', 'Rye rolled: 2 successes'),
    L('track', 'Rye STRESS 0 → 2'),
    L('clue', 'Clue revealed: The airlock log was wiped at 0300. → everyone', { clueId: 'c1' }),
    L('clue', 'Clue revealed: PRIVATE-CLUE: the medic was paid off. → Rye', { clueId: 'c2' }),
    L('handout', 'Handout "DOCKING ORDERS" → everyone', { handoutId: 'h1' }),
    L('handout', 'Handout "PRIVATE-MEMO" → Rye', { handoutId: 'h2' }),
    L('clock', 'Clock started: HULL BREACH (6)', { clockId: 'k1' }),
    L('clock', 'Clock started: GM-CLOCK (4)', { clockId: 'k2' }),
    L('pool', 'THREAT +3 → 5'),
    L('pool', 'MOMENTUM +1 (Rye) → 2'),
    L('pause', 'Pause requested (anonymous)'),
    L('fog', 'Revealed: Cargo Bay'),
    L('panic', 'Okafor PANIC ROLL 9: FREEZE'),
    L('kill', 'Okafor (Bo) was killed'),
    L('note', 'ENDING: The crew escaped in the lifeboat'),
  ],
});

{
  const g = fakeGame();
  const pub = recap.publicLog(g);
  const all = pub.map((e) => e.text).join('\n');
  noSecrets(all, 'publicLog');
  ok(pub.some((e) => e.text.includes('airlock log was wiped')), 'public clue kept');
  ok(pub.some((e) => e.text.includes('DOCKING ORDERS')), 'public handout kept');
  ok(pub.some((e) => e.text === 'ACT I begins'), 'act line kept without the agenda suffix');
  ok(pub.some((e) => e.text.includes('MOMENTUM +1')), 'visible pool kept');
  ok(pub.some((e) => e.text === 'Ending reached: The crew escaped in the lifeboat'), 'ending note kept (as ending)');
  ok(pub.some((e) => e.type === 'roll' && e.text.startsWith('Rye rolled')), 'public roll kept');
  eq(pub.filter((e) => e.type === 'note').length, 1, 'only the ENDING note survives');

  const facts = recap.publicFacts(g);
  eq(facts.clues, ['The airlock log was wiped at 0300.'], 'facts: only table-wide clues');
  eq(facts.clocks.map((c) => c.label), ['HULL BREACH'], 'facts: only visible clocks');

  const a1 = recap.templatedRecap(alien, g);
  const a2 = recap.templatedRecap(alien, fakeGame());
  eq(a1, a2, 'template is deterministic');
  ok(words(a1) >= recap.MIN_WORDS && words(a1) <= recap.MAX_WORDS, `alien template 150-300 words (${words(a1)})`);
  noSecrets(a1, 'alien template');
  ok(a1.includes('MU/TH/UR') && a1.includes('Rye') && a1.includes('Okafor'), 'alien template: persona + cast');
  ok(/LIFE SIGNS TERMINATED: Okafor/.test(a1), 'alien template: the death is logged');
  const d1 = recap.templatedRecap(dune, g);
  ok(d1.includes('MENTAT') && /mourns Okafor/.test(d1), 'dune template: Mentat voice');
  ok(words(d1) >= 150 && words(d1) <= 300, `dune template 150-300 words (${words(d1)})`);
  noSecrets(d1, 'dune template');
  const empty = recap.templatedRecap(alien, { code: 'WXYZ', players: new Map(), table: {}, log: [] });
  ok(words(empty) >= 150 && words(empty) <= 300, `empty session template still 150-300 words (${words(empty)})`);
  const big = fakeGame();
  for (let i = 0; i < 300; i++) big.log.push(L('fog', `Revealed: Compartment ${i} with a rather long descriptive room name`), L('scene', `Scene: ACT II — Corridor sweep number ${i}`));
  const b = recap.templatedRecap(alien, big);
  ok(words(b) <= 300 && /STANDING BY\.$/.test(b), `long session trimmed to ≤300 words and keeps the sign-off (${words(b)})`);

  const doc = recap.recapDoc(alien, g, pub);
  eq([doc.title, doc.from, doc.to, doc.priority], ["SHIP'S LOG", 'MU/TH/UR', 'CREW', 'STANDARD'], 'alien doc header');
  ok(/^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(doc.timestamp), 'doc timestamp from the last public entry');
  eq(recap.recapDoc(dune, g, pub).title, 'CHRONICLE OF THE HOUSE', 'dune doc title');

  // No key → template.
  const t = await recap.generateRecap({ universe: alien, game: g, apiKey: '' });
  eq([t.source, t.text], ['template', a1], 'no key → templated recap');

  // Fake Claude client: capture the request, stream two deltas.
  let req = null;
  const fake = {
    beta: { messages: { stream(r) {
      req = r;
      const events = [
        { type: 'content_block_start', content_block: { type: 'thinking' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'LOG ENTRY. Rye docked. ' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'END OF ENTRY.' } },
      ];
      return {
        async* [Symbol.asyncIterator]() { for (const e of events) yield e; },
        finalMessage: async () => ({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'LOG ENTRY. Rye docked. END OF ENTRY.' }] }),
      };
    } } },
  };
  const deltas = [];
  const c = await recap.generateRecap({ universe: alien, game: g, client: fake, onDelta: (s) => deltas.push(s) });
  eq([c.source, c.text], ['claude', 'LOG ENTRY. Rye docked. END OF ENTRY.'], 'Claude path returns the streamed text');
  eq(deltas, ['LOG ENTRY. Rye docked. ', 'LOG ENTRY. Rye docked. END OF ENTRY.'], 'deltas stream the text so far');
  eq(req.model, 'claude-opus-5-5', 'model claude-opus-5-5');
  eq(req.thinking, { type: 'adaptive' }, 'adaptive thinking');
  ok(typeof req.system === 'string' && req.system.includes('MU/TH/UR') && /150 to 300 words/.test(req.system), 'system prompt: persona + length');
  ok(/Use only facts present in the public record/.test(req.system), 'system prompt: no invention / no secrets rule');
  noSecrets(JSON.stringify(req), 'Claude request');
  ok(req.messages[0].content.includes('Rye rolled: 2 successes') && req.messages[0].content.includes('HULL BREACH 3/6'), 'user turn carries the public record');

  // Refusal / failure → template with a warning.
  const failing = { beta: { messages: { stream() { throw new Error('network down'); } } } };
  const f = await recap.generateRecap({ universe: dune, game: g, client: failing });
  ok(f.source === 'template' && f.text === d1 && /unavailable/.test(f.warning), 'API failure → templated recap + warning');
  const refusing = { beta: { messages: { stream() { return { async* [Symbol.asyncIterator]() {}, finalMessage: async () => ({ stop_reason: 'refusal', content: [] }) }; } } } };
  eq((await recap.generateRecap({ universe: alien, game: g, client: refusing })).source, 'template', 'refusal → template');
}

/* ── 2. Client helpers (HandoutDoc.jsx via esbuild) ──────────── */
{
  const { build } = await import('esbuild');
  const outDir = join(ROOT, 'node_modules', '.cache', 'test-recap');
  mkdirSync(outDir, { recursive: true });
  const outfile = join(outDir, 'handout-doc.mjs');
  await build({ entryPoints: [join(ROOT, 'src/engine/components/player/HandoutDoc.jsx')], bundle: true, format: 'esm', platform: 'neutral', outfile, external: ['react'], jsx: 'automatic', loader: { '.jsx': 'jsx' }, logLevel: 'error' });
  const hd = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
  const text = hd.docText({ from: 'MU/TH/UR', to: 'CREW', priority: 'EYES ONLY', timestamp: '2183-06-12 04:10', burnSec: 30, text: 'Proceed to B deck.\n\nDo not open the cargo.' });
  eq(text.split('\n').slice(0, 6), ['FROM: MU/TH/UR', 'TO: CREW', 'PRIORITY: EYES ONLY', 'TIMESTAMP: 2183-06-12 04:10', 'BURN AFTER READING: 30S', ''], 'docText header block');
  ok(hd.isDocText(text) && !hd.isDocText('The hull groans.') && !hd.isDocText(''), 'isDocText');
  const p = hd.parseDoc({ title: 'ORDERS', text });
  eq([p.from, p.to, p.priority, p.timestamp, p.burnSec, p.body], ['MU/TH/UR', 'CREW', 'EYES ONLY', '2183-06-12 04:10', 30, 'Proceed to B deck.\n\nDo not open the cargo.'], 'parseDoc round trip');
  const q = hd.parseDoc({ title: 'X', from: 'FIELD', priority: 'SEALED', text: 'TIMESTAMP: day 3\nBURN: 2 MIN\n\nBody.' });
  eq([q.from, q.priority, q.timestamp, q.burnSec, q.body], ['FIELD', 'SEALED', 'day 3', 120, 'Body.'], 'handout fields + header lines merge; minutes');
  eq(hd.parseDoc({ text: 'Plain text\nFROM: not a header' }).body, 'Plain text\nFROM: not a header', 'plain text is all body');
  eq(hd.parseDoc({ text: 'x', burnSec: 45 }).burnSec, 45, 'burnSec field honoured');
  eq([hd.burnSeconds('90'), hd.burnSeconds('5 MIN'), hd.burnSeconds('off'), hd.burnSeconds(-3), hd.burnSeconds(99999)], [90, 300, 0, 0, 3600], 'burnSeconds');
  eq([hd.formatBurn(30), hd.formatBurn(120), hd.formatBurn(90)], ['30S', '2 MIN', '90S'], 'formatBurn');
  eq([hd.docStyle({ theme: { overlay: 'crt' } }), hd.docStyle({ theme: { overlay: 'grain' } }), hd.docStyle({ theme: { overlay: 'crt', handoutStyle: 'filmbook' } })], ['teletype', 'filmbook', 'filmbook'], 'docStyle from theme');
  eq(hd.docText({ text: 'Only body' }), 'Only body', 'no header → plain body');
}

/* ── 3. Server ───────────────────────────────────────────────── */
let server = null;
const sockets = [];
try {
  server = spawn(process.execPath, ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, ANTHROPIC_API_KEY: '', API_TOKEN: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('server start timeout')), 10000);
    server.stdout.on('data', (d) => { if (String(d).includes('ONLINE')) { clearTimeout(t); res(); } });
    server.stderr.on('data', (d) => process.stderr.write(d));
    server.on('exit', (c) => { clearTimeout(t); rej(new Error('server exited ' + c)); });
  });
  const connect = () => new Promise((res, rej) => {
    const s = io(URL, { transports: ['websocket'], reconnection: false });
    sockets.push(s);
    s.on('connect', () => res(s));
    s.on('connect_error', rej);
  });
  const call = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, res));

  const dm = await connect();
  const created = await call(dm, 'create-game', { universeId: 'alien' });
  const code = created.code;
  ok(created.dmToken, 'game created with a dmToken');
  const pA = await connect();
  const pB = await connect();
  const jA = await call(pA, 'join-game', { code, playerName: 'Ann' });
  const jB = await call(pB, 'join-game', { code, playerName: 'Bo' });
  ok((await call(dm, 'assign-character', { gameCode: code, playerId: jA.playerId, character: { id: 'c-rye', name: 'Rye', career: 'Pilot' }, tracks: { health: 4, stress: 0 }, trackMax: { health: 4, stress: 10 }, conditions: [] })).success, 'assign Rye');
  await call(dm, 'narrate', { gameCode: code, text: 'The hull groans as the clamps bite.', title: 'Touchdown', mode: 'caption' });
  await call(dm, 'log-note', { gameCode: code, text: 'SYNTHETIC-CAPTAIN is the twist' });
  await call(dm, 'gm-roll', { gameCode: code, roll: { kind: 'yze', summary: 'SECRET-DIE 3 successes' }, who: 'GM' });
  await call(dm, 'clue-upsert', { gameCode: code, clue: { text: 'PRIVATE-CLUE: the medic was paid off.' } });
  await call(dm, 'clue-upsert', { gameCode: code, clue: { text: 'The airlock log was wiped at 0300.' } });
  await sleep(50);
  const dmTab = await call(dm, 'table-sync', { gameCode: code });
  const clues = dmTab?.table?.clues || [];
  const priv = clues.find((c) => c.text.startsWith('PRIVATE-CLUE'));
  const pubc = clues.find((c) => c.text.startsWith('The airlock'));
  ok(priv && pubc, 'clues created (table-sync)');
  await call(dm, 'clue-reveal', { gameCode: code, clueId: priv.id, to: [jA.playerId] });
  await call(dm, 'clue-reveal', { gameCode: code, clueId: pubc.id, to: 'all' });
  await call(dm, 'clock-upsert', { gameCode: code, clock: { label: 'GM-CLOCK', segments: 4, visibility: 'gm' } });
  await call(dm, 'clock-upsert', { gameCode: code, clock: { label: 'HULL BREACH', segments: 6 } });
  await call(dm, 'handout-send', { gameCode: code, custom: { title: 'PRIVATE-MEMO', text: 'for Ann only' }, to: [jA.playerId] });
  await call(pB, 'pause-request', {});

  const post = (body, accept = 'application/json') => fetch(`${URL}/api/recap`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: accept }, body: JSON.stringify(body) });
  eq((await post({ code, dmToken: 'nope' })).status, 403, 'wrong dmToken → 403');
  eq((await post({ code: 'ZZZZ', dmToken: created.dmToken })).status, 403, 'unknown game → 403');
  const st = await (await fetch(`${URL}/api/recap/status`)).json();
  eq(st, { claude: false, model: 'template' }, 'status: no key → template');
  const r = await post({ code, dmToken: created.dmToken });
  eq(r.status, 200, 'recap JSON 200');
  const j = await r.json();
  eq(j.source, 'template', 'server falls back to the template without a key');
  ok(j.words >= 150 && j.words <= 300, `server recap 150-300 words (${j.words})`);
  noSecrets(j.text, 'server recap');
  ok(j.text.includes('Rye') && j.text.includes('airlock log was wiped') && j.text.includes('HULL BREACH'), 'server recap mentions the public facts');
  eq(j.doc.from, 'MU/TH/UR', 'doc header from the universe terminal');

  // SSE
  const sse = await post({ code, dmToken: created.dmToken }, 'text/event-stream');
  ok(String(sse.headers.get('content-type')).startsWith('text/event-stream'), 'SSE content type');
  const raw = await sse.text();
  ok(/event: status\ndata: \{"source":"template"\}/.test(raw), 'SSE status event');
  const done = /event: done\ndata: (.*)\n/.exec(raw);
  ok(done && JSON.parse(done[1]).text === j.text, 'SSE done carries the same deterministic text');

  // A document handout (header + burn) reaches the phone intact.
  const docBody = `TIMESTAMP: ${j.doc.timestamp}\nBURN AFTER READING: 30S\n\n${j.text}`;
  const got = new Promise((res) => pB.once('handout-received', res));
  const hs = await call(dm, 'handout-send', { gameCode: code, custom: { title: j.doc.title, from: j.doc.from, to: j.doc.to, priority: j.doc.priority, text: docBody }, to: 'all' });
  ok(hs.success, 'recap sent as a handout to all');
  const h = (await got).handout;
  eq([h.title, h.from, h.text], [j.doc.title, 'MU/TH/UR', docBody], 'phone receives the document with its header and burn line');
  // Its log line is public, so the next recap may mention it; the private memo still never appears.
  const j2 = await (await post({ code, dmToken: created.dmToken })).json();
  noSecrets(j2.text, 'second recap');
  ok(j2.text.includes("SHIP'S LOG"), 'second recap lists the public document');

  console.log(`test-recap: ${checks} checks passed`);
} finally {
  for (const s of sockets) s.close();
  if (server) { server.removeAllListeners('exit'); server.kill('SIGKILL'); }
  await sleep(100);
  try { rmSync(DATA, { recursive: true, force: true }); } catch { /* ignore */ }
}
process.exit(0);
