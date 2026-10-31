#!/usr/bin/env node
/* Polish wave B regression test. Spawns the server with a temp DATA_DIR and checks:
   - CREW drawer motion tracker: the exact payload the drawer sends (trackerSet(playerId, on) →
     emitTable('tracker-set', { playerId, on }) with gameCode) grants and revokes; the GM's
     table view carries table.trackerGrants (what the GRANT/REVOKE toggle reads) and the
     phone's table.tracker turns on/off; players cannot send it; DUNE refuses it. The drawer
     source wires the toggle to trackerSet and gates it on universe.features.tracker.
   - handout burnSec: sanitizeHandout keeps a number clamped 0..600 (garbage → 0) and SEND
     AGAIN with no timer clears an earlier one; the phone's handout carries burnSec.
   - HandoutsPanel sends burnSec and SHOW ON TV uses docText (the document form).
   - scene ambience aliases (mechanicsUtils.ambientPreset) for the soundboard presets, and
     RunView reading scene.ambient ?? scene.ambience.
   - recap template: no sentence repeated (empty, short and full logs, both universes),
     ≤ MAX_WORDS, short logs get the relaxed floor.
   - content fixes: no example/bundled PC has buddy === rival; the weapons reference marks
     the entries missing from the builder catalog.
   Usage: node scripts/test-polish-b.mjs */
import { spawn } from 'child_process';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import assert from 'assert/strict';
import { io } from 'socket.io-client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4600 + Math.floor(Math.random() * 90);
const DATA = mkdtempSync(join(tmpdir(), 'polish-b-'));
const URL = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);

process.env.ANTHROPIC_API_KEY = '';

/* ── 1. Static / unit checks (no server) ───────────────────────── */
{
  // Ambience aliases → the preset ids in hooks/useAmbientAudio.js.
  const { ambientPreset } = await imp('src/engine/mechanicsUtils.js');
  const hook = src('src/engine/hooks/useAmbientAudio.js');
  const presetIds = new Set([...hook.matchAll(/^ {2}([a-z]+): (?:bed\(|\{)/gm)].map((m) => m[1]));
  for (const id of ['ship', 'derelict', 'hive', 'erg', 'keep', 'sietch']) ok(presetIds.has(id), `useAmbientAudio has preset "${id}"`);
  const cases = {
    engine: 'ship', 'engine-hum': 'ship', 'ship-hum': 'ship', derelict: 'derelict', hive: 'hive', drip: 'hive',
    erg: 'erg', 'open-erg': 'erg', keep: 'keep', interior: 'keep', 'keep-interior': 'keep', sietch: 'sietch', 'OPEN-ERG': 'erg',
  };
  for (const [name, id] of Object.entries(cases)) eq(ambientPreset(name), id, `ambience alias ${name} → ${id}`);
  const fake = Object.fromEntries([...presetIds].map((k) => [k, {}]));
  for (const [name, id] of Object.entries(cases)) eq(ambientPreset(name, fake), id, `alias ${name} resolves against the real preset list`);
  eq(ambientPreset('nonsense'), null, 'unknown ambience → null');
  eq(ambientPreset('hive', { ship: {} }), null, 'alias to a preset the list lacks → null');
  ok(/scene\?\.ambient \?\? scene\?\.ambience/.test(src('src/engine/components/run/RunView.jsx')), 'RunView reads scene.ambient ?? scene.ambience');
  ok(/ambientPreset\(sc\?\.ambient \?\? sc\?\.ambience\)/.test(src('src/engine/components/run/RunView.jsx')), 'goScene sends scene.ambience to the TV too');

  // CREW drawer wiring.
  const crew = src('src/engine/components/run/CrewDrawer.jsx');
  ok(/universe\.features\?\.tracker/.test(crew), 'CrewDrawer gates the tracker toggle on universe.features.tracker');
  ok(/table\?\.trackerGrants/.test(crew), 'CrewDrawer reads table.trackerGrants');
  ok(/trackerSet\(p\.id, on,/.test(crew), 'CrewDrawer toggles via trackerSet(playerId, on, cb)');
  ok(/GRANT TRACKER/.test(crew) && /REVOKE TRACKER/.test(crew) && /aria-pressed=\{grants\.includes\(p\.id\)\}/.test(crew), 'GRANT / REVOKE TRACKER toggle with aria-pressed');

  // HandoutsPanel: burn picker + document form on the TV.
  const ho = src('src/engine/components/run/HandoutsPanel.jsx');
  ok(/import \{ docText, formatBurn \} from '\.\.\/player\/HandoutDoc'/.test(ho), 'HandoutsPanel imports docText from player/HandoutDoc');
  ok(/narrate\(\s*docText\(/.test(ho), 'SHOW ON TV narrates the docText document form');
  ok(/burnSec \}/.test(ho) && /BURN_CHOICES = \[0, 30, 60, 120, 300\]/.test(ho), 'pack handouts send burnSec (OFF / 30s / 1m / 2m / 5m)');

  // MORE drawer tab strip scrolls on one row.
  const more = src('src/engine/components/run/MoreDrawer.jsx');
  ok(/md-tabs md-tabs-scroll/.test(more) && /import '\.\/MoreDrawer\.css'/.test(more), 'MORE tab strip uses the scrolling one-row class');
  const css = src('src/engine/components/run/MoreDrawer.css');
  ok(/flex-wrap: nowrap/.test(css) && /overflow-x: auto/.test(css) && /min-width: 44px/.test(css), 'MoreDrawer.css: nowrap, horizontal scroll, 44px tabs');

  // Threat label: no "(GM)" suffix on the GM's pool.
  const pools = src('src/engine/components/run/PoolCounters.jsx');
  ok(!/' \(GM\)'/.test(pools) && /gmShort/.test(pools), 'PoolCounters labels a hidden pool with the universe GM term (no "THREAT (GM)")');

  // Recap template: never the same sentence twice.
  const recap = await imp('server/recap.js');
  const { loadUniverseCore } = await imp('server/generator/universes.js');
  const words = (s) => (String(s).match(/\S+/g) || []).length;
  const sentences = (s) => s.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  const T0 = Date.UTC(2026, 9, 31, 20, 0);
  const L = (i, type, text) => ({ id: `l${i}`, at: T0 + i * 60000, type, text });
  const games = {
    empty: { code: 'EMPT', players: new Map(), table: {}, log: [] },
    short: {
      code: 'SHRT', players: new Map([['p1', { id: 'p1', name: 'Ann', character: { name: 'Rye', career: 'Pilot' } }]]), table: {},
      log: [L(1, 'scene', 'Scene: ACT I — Docking'), L(2, 'roll', 'Rye rolled: 1 success'), L(3, 'fog', 'Revealed: Airlock')],
    },
    full: {
      code: 'FULL', players: new Map([['p1', { id: 'p1', name: 'Ann', character: { name: 'Rye', career: 'Pilot' } }], ['p2', { id: 'p2', name: 'Bo', character: { name: 'Okafor', career: 'Medic' }, alive: false }]]),
      table: { clocks: [{ id: 'k1', label: 'HULL BREACH', filled: 2, segments: 6, visibility: 'all' }] },
      log: [
        L(1, 'act', 'ACT I begins'), L(2, 'scene', 'Scene: ACT I — Docking'), L(3, 'narration', 'The clamps bite.'),
        L(4, 'roll', 'Rye rolled: 2 successes'), L(5, 'track', 'Rye STRESS 0 → 2'), L(6, 'fog', 'Revealed: Cargo Bay'),
        L(7, 'panic', 'Okafor PANIC ROLL 9: FREEZE'), L(8, 'kill', 'Okafor (Bo) was killed'), L(9, 'loot', 'Rye took Flare'),
        L(10, 'scene', 'Scene: ACT I — The hold'), L(11, 'note', 'ENDING: The crew escaped'),
      ],
    },
  };
  for (const uid of ['alien', 'dune']) {
    const u = await loadUniverseCore(uid);
    for (const [k, g] of Object.entries(games)) {
      const text = recap.templatedRecap(u, g);
      const s = sentences(text);
      const dup = s.filter((x, i) => s.indexOf(x) !== i);
      eq(dup, [], `${uid} ${k} template repeats no sentence`);
      ok(words(text) <= recap.MAX_WORDS, `${uid} ${k} template ≤ ${recap.MAX_WORDS} words (${words(text)})`);
      const n = recap.publicLog(g).length;
      ok(words(text) >= Math.min(recap.minWordsFor(n), 60), `${uid} ${k} template meets its floor (${words(text)} ≥ ${recap.minWordsFor(n)} or the stock lines ran out)`);
      eq(recap.templatedRecap(u, g), text, `${uid} ${k} template is deterministic`);
    }
    const fillers = recap.voiceFor(u).filler;
    for (const f of fillers) ok(recap.templatedRecap(u, games.empty).split(f).length <= 2, `${uid}: stock line used at most once: "${f.slice(0, 30)}…"`);
  }
  eq(recap.minWordsFor(0), recap.SHORT_MIN, 'short log floor = SHORT_MIN');
  eq(recap.minWordsFor(recap.SHORT_LOG), recap.MIN_WORDS, 'full log floor = MIN_WORDS');

  // Buddy ≠ rival in the example pack (and every bundled pack).
  const packFiles = [join(ROOT, 'content', 'examples', 'example-cold-storage.json')];
  for (const u of ['alien', 'dune']) {
    const dir = join(ROOT, 'src', 'universes', u, 'content');
    for (const f of readdirSync(dir)) if (f.endsWith('.json')) packFiles.push(join(dir, f));
  }
  for (const f of packFiles) {
    const p = JSON.parse(readFileSync(f, 'utf8'));
    for (const c of p.characters || []) {
      if (!c.buddy || !c.rival || c.buddy === 'None') continue;
      ok(c.buddy !== c.rival, `${p.id}: ${c.name}'s buddy and rival differ`);
    }
  }

  // Weapons reference: entries missing from the builder catalog are marked.
  const { weapons } = await imp('src/universes/alien/reference/weapons.js');
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const cat = ['weapons', 'armor', 'gear'].flatMap((f) => JSON.parse(src(`src/universes/alien/catalog/${f}.json`)));
  const catIds = new Set(cat.map((i) => norm(i.name)));
  const marked = Object.values(weapons).flat().filter((w) => w.notInCatalog);
  eq(marked.length, 9, 'nine reference entries are marked notInCatalog');
  for (const w of marked) {
    ok(!catIds.has(norm(w.name)), `${w.name} really is missing from the catalog`);
    ok(/Not in the builder catalog/.test(w.comment), `${w.name}: comment says so`);
  }
}

/* ── 2. Server: tracker-set (drawer path) and burnSec ─────────── */
let server = null;
const sockets = [];
try {
  server = spawn(process.execPath, ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('server start timeout')), 10000);
    server.stdout.on('data', (d) => { out += d; if (String(d).includes('ONLINE')) { clearTimeout(t); res(); } });
    server.stderr.on('data', (d) => { out += d; });
    server.on('exit', (c) => { clearTimeout(t); rej(new Error('server exited ' + c)); });
  });
  const connect = () => new Promise((res, rej) => {
    const s = io(URL, { transports: ['websocket'], reconnection: false });
    sockets.push(s);
    s.on('connect', () => res(s));
    s.on('connect_error', rej);
  });
  const call = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, res));
  /* What CrewDrawer sends: trackerSet(playerId, on, cb) = emitTable('tracker-set', { playerId, on }, cb),
     and emitTable adds { gameCode } (GameContext). */
  const drawerTrackerSet = (dm, gameCode, playerId, on) => call(dm, 'tracker-set', { gameCode, playerId, on });

  const dm = await connect();
  const { code } = await call(dm, 'create-game', { universeId: 'alien' });
  const pA = await connect();
  const jA = await call(pA, 'join-game', { code, playerName: 'Alice' });
  ok((await call(dm, 'assign-character', { gameCode: code, playerId: jA.playerId, character: { id: 'parker', name: 'Parker', gear: ['Wrench'] }, tracks: { health: 4 }, trackMax: { health: 4 } })).success, 'seat assigned');
  eq((await call(pA, 'table-sync', {})).table.tracker, { on: false }, 'no tracker before the grant');

  const g = await drawerTrackerSet(dm, code, jA.playerId, true);
  ok(g.success && g.on === true && g.available === true, 'drawer GRANT → { success, on:true, available:true }');
  eq((await call(dm, 'table-sync', { gameCode: code })).table.trackerGrants, [jA.playerId], 'GM table view: trackerGrants lists the seat (toggle shows REVOKE)');
  ok((await call(pA, 'table-sync', {})).table.tracker?.on === true, 'phone: tracker on after the grant');
  ok((await drawerTrackerSet(pA, code, jA.playerId, true)).error, 'a player cannot send tracker-set');
  const r = await drawerTrackerSet(dm, code, jA.playerId, false);
  ok(r.success && r.on === false && r.available === false, 'drawer REVOKE → { on:false, available:false }');
  eq((await call(dm, 'table-sync', { gameCode: code })).table.trackerGrants, [], 'GM table view: grant withdrawn (toggle shows GRANT)');
  ok((await drawerTrackerSet(dm, code, jA.playerId, 'yes')).error, 'tracker-set refuses a non-boolean on');

  const dmD = await connect();
  const dune = await call(dmD, 'create-game', { universeId: 'dune' });
  const pD = await connect();
  const jD = await call(pD, 'join-game', { code: dune.code, playerName: 'Idaho' });
  ok((await drawerTrackerSet(dmD, dune.code, jD.playerId, true)).error, 'DUNE refuses tracker-set (no toggle is shown there)');

  // burnSec sanitising.
  const handoutOf = async (id) => (await call(pA, 'table-sync', {})).table.handouts.find((h) => h.id === id);
  const send = (extra) => call(dm, 'handout-send', { gameCode: code, handoutId: 'burn-test', handout: { title: 'BURN TEST', text: 'Read fast.', ...extra }, to: 'all' });
  ok((await send({ burnSec: 30 })).success, 'handout with burnSec 30 sent');
  eq((await handoutOf('burn-test')).burnSec, 30, 'phone handout keeps burnSec 30');
  await send({ burnSec: 9999 });
  eq((await handoutOf('burn-test')).burnSec, 600, 'burnSec clamped to 600');
  await send({ burnSec: -5 });
  eq((await handoutOf('burn-test')).burnSec, 0, 'negative burnSec → 0');
  await send({ burnSec: 45.6 });
  eq((await handoutOf('burn-test')).burnSec, 46, 'burnSec rounded');
  await send({ burnSec: 'soon' });
  eq((await handoutOf('burn-test')).burnSec, 0, 'non-numeric burnSec → 0');
  await send({ burnSec: 120 });
  await send({});
  eq((await handoutOf('burn-test')).burnSec, 0, 'SEND AGAIN without a timer clears the earlier burn');
  const got = new Promise((res) => pA.once('handout-received', (d) => res(d.handout)));
  await call(dm, 'handout-send', { gameCode: code, custom: { title: 'CUSTOM', text: 'x', burnSec: 60 }, to: [jA.playerId] });
  eq((await got).burnSec, 60, 'custom handout-received carries burnSec');

  await sleep(100);
  ok(!/EVENT_NAMES drift/.test(out), 'server printed no EVENT_NAMES drift warning');
} finally {
  for (const s of sockets) s.close();
  if (server) { const done = new Promise((r) => server.once('exit', r)); server.kill('SIGKILL'); await done; }
  rmSync(DATA, { recursive: true, force: true });
}
console.log(`test-polish-b: ${checks} checks passed`);
process.exit(0);
