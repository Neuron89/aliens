#!/usr/bin/env node
/* AI BUILD — server/aibuild.js + the /api/gm/build* routes (docs/AI_GM.md "AI BUILD").
   1. Unit: extractJson (fences, prose, <think>, garbage), validatePlan on the real Cronus engine
      plan (unknown rooms / kinds / skills dropped, unknown glyph → kind default, difficulty
      clamped, per-room cap 4, total cap 60, creature cap + never in the spawn room, hidden
      defaults), templatePlan for ALIEN/Cronus and DUNE/Qarrat Keep (never empty, valid,
      deterministic), board helpers (roomCentroid, doorsFrom, isAdjacent, pointInRoom hits
      back on every room of every bundled engine map).
   2. generatePlan against a MOCK OpenAI chat server: batches, response_format json_object,
      fenced / prose-wrapped JSON, garbage → retry → template, first-bad → retry → model,
      HTTP 500 → template, no GM_URL → template.
   3. Real server (GM_URL → the mock): auth (403), bad density, no map, JSON + SSE build,
      429 while building, GET, apply (tokens inside their rooms, hidden flags, ai tags, caps,
      re-apply replaces), client plan sanitized, map mismatch 409, players / TV never see
      hidden tokens, notes, ai tags or the plan, clear; a DUNE game on Qarrat Keep.
   The real GPU box is never called. Usage: node scripts/test-aibuild.mjs */
import { spawn } from 'child_process';
import { createServer as createHttpServer } from 'http';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import assert from 'assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = mkdtempSync(join(tmpdir(), 'aibuild-'));
process.env.GM_URL = '';
process.env.COMFY_URL = 'http://127.0.0.1:9';
process.env.DATA_DIR = DATA;
const PORT = 3190;
const URL = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const ab = await imp('server/aibuild.js');
const board = await imp('server/board.js');
const { loadUniverseCore } = await imp('server/generator/universes.js');
const gm = await imp('server/gm.js');
const vram = await imp('server/vram.js');
const alien = await loadUniverseCore('alien');
const dune = await loadUniverseCore('dune');
const alienPack = gm.loadPackFor('alien', 'chariot-of-the-gods');
const dunePack = gm.loadPackFor('dune', 'the-water-debt');
const { maps: alienMaps } = await imp('src/universes/alien/maps/index.js');
const { maps: duneMaps } = await imp('src/universes/dune/maps/index.js');
const clientDef = (m) => ({ id: m.id, title: m.title, subtitle: m.subtitle, kind: 'engine', engine: m.id, size: m.size, levels: m.levels, rooms: m.rooms, doors: m.doors, outline: m.outline, crop: m.crop, spawn: m.spawn, grid: m.grid });
const CRONUS_DEF = clientDef(alienMaps.find((m) => m.id === 'uscss-cronus'));
const KEEP_DEF = clientDef(duneMaps.find((m) => m.id === 'qarrat-keep'));
const cronus = board.sanitizeMapDef(CRONUS_DEF).mapDef;
const keep = board.sanitizeMapDef(KEEP_DEF).mapDef;
const SPAWN = 'main-docking-airlock';

/* ── 1. Unit ─────────────────────────────────────────────────── */
{
  eq(ab.extractJson('{"rooms":{}}'), { rooms: {} }, 'extractJson: plain');
  eq(ab.extractJson('Sure!\n```json\n{"rooms":{"a":1}}\n```\nEnjoy.'), { rooms: { a: 1 } }, 'extractJson: fenced');
  eq(ab.extractJson('Here is the plan: {"rooms":{"b":{"x":"has } brace"}}} — hope it helps {not json}'), { rooms: { b: { x: 'has } brace' } } }, 'extractJson: prose-wrapped, braces in strings');
  eq(ab.extractJson('<think>{"no":1}</think>{"rooms":{"c":2}}'), { rooms: { c: 2 } }, 'extractJson: think stripped');
  eq(ab.extractJson('no json at all {oops'), null, 'extractJson: garbage → null');
  eq(ab.extractJson('[1,2]'), null, 'extractJson: array is not a plan');

  // board helpers on real data
  eq(board.roomCentroid(cronus, 'main-bridge').map((n) => Math.round(n * 1e4)), (() => { const s = cronus.rooms.find((r) => r.id === 'main-bridge').shape; return [s.x + s.w / 2, s.y + s.h / 2].map((n) => Math.round(n * 1e4)); })(), 'roomCentroid: rect centre');
  eq(board.roomCentroid({ rooms: [{ id: 't', shape: { type: 'poly', points: [[0, 0], [0.6, 0], [0, 0.6]] } }] }, 't').map((n) => Math.round(n * 100)), [20, 20], 'roomCentroid: triangle centroid');
  eq(board.roomCentroid(cronus, 'nope'), null, 'roomCentroid: unknown room');
  const fromCorr = board.doorsFrom(cronus, 'main-main-corridor');
  ok(fromCorr.some((d) => d.to === 'main-crew-quarters' && d.locked) && fromCorr.some((d) => d.to === SPAWN && !d.locked), 'doorsFrom: both directions, locked flags');
  ok(board.isAdjacent(cronus, SPAWN, 'main-main-corridor') && !board.isAdjacent(cronus, SPAWN, 'main-bridge'), 'isAdjacent');
  ok(board.isAdjacent(cronus, 'main-main-corridor', 'main-crew-quarters') && !board.isAdjacent(cronus, 'main-main-corridor', 'main-crew-quarters', { unlocked: true }), 'isAdjacent: locked door only with unlocked:false');
  for (const uni of [alienMaps, duneMaps]) {
    for (const m of uni.filter((x) => x.kind === 'engine')) {
      const md = board.sanitizeMapDef(clientDef(m)).mapDef;
      let bad = 0;
      for (const r of md.rooms) {
        const avoid = [];
        for (let i = 0; i < 4; i++) {
          const p = board.pointInRoom(md, r.id, { avoid });
          if (!p || board.roomAt(md, p[0], p[1], r.level) !== r.id) bad++;
          else avoid.push(p);
        }
      }
      eq(bad, 0, `pointInRoom: 4 points hit back in every room of ${m.id}`);
    }
  }
  {
    const avoid = [];
    for (let i = 0; i < 4; i++) avoid.push(board.pointInRoom(cronus, 'main-cryo-bay', { avoid }));
    const minGap = Math.min(...avoid.flatMap((p, i) => avoid.slice(i + 1).map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]))));
    ok(minGap > 0.01, `pointInRoom spreads tokens (min gap ${minGap.toFixed(3)})`);
  }

  // validatePlan
  const skills = ab.skillsOf(alien);
  ok(skills.some((s) => s.key === 'observation'), 'ALIEN skills loaded from rules');
  eq([...ab.spawnRooms(cronus)].sort(), ['lower-ladder-landing', SPAWN], 'spawn rooms per level');
  const raw = {
    rooms: {
      nowhere: { description: 'x', tokens: [] },
      'main-bridge': {
        mood: 'cold', description: 'The bridge is dark.',
        tokens: [
          { kind: 'item', label: 'Banana', glyph: 'banana', locked: true, note: 'n' },
          { kind: 'dragon', label: 'Smaug' },
          { kind: 'item', label: '' },
          { kind: 'npc', label: 'Johns' },
          { kind: 'marker', label: 'Captain\'s chair', glyph: 'objective' },
          { kind: 'hazard', label: 'Sparks', glyph: 'fire', locked: true },
          { kind: 'item', label: 'Fifth thing' },
        ],
        check: { skill: 'Observation', difficulty: -9, label: 'Spot it', success: 's', failure: 'f' },
      },
      [SPAWN]: { tokens: [{ kind: 'creature', label: 'Neomorph' }], check: { skill: 'juggling', difficulty: 0 } },
      'science lab / containment': { tokens: [{ kind: 'creature', label: 'Egg sacs', hidden: false }], check: { skill: 'medical aid', difficulty: 'x' } },
    },
  };
  const v = ab.validatePlan(raw, { mapDef: cronus, skills, universeId: 'alien' });
  eq(Object.keys(v.rooms).sort(), ['main-bridge', SPAWN, 'main-science-lab'].sort(), 'validate: unknown room dropped, room matched by name');
  const br = v.rooms['main-bridge'];
  eq(br.tokens.length, ab.MAX_PER_ROOM, 'validate: per-room cap 4 (bad kind / empty label dropped first)');
  eq(br.tokens[0], { kind: 'item', label: 'Banana', sub: '', glyph: 'crate', hidden: false, locked: true, note: 'n' }, 'validate: unknown glyph → kind default, item locked kept');
  eq([br.tokens[1].kind, br.tokens[1].hidden, br.tokens[1].glyph], ['npc', true, 'person'], 'validate: npc hidden by default');
  eq([br.tokens[3].kind, br.tokens[3].locked], ['hazard', false], 'validate: locked only on items');
  eq(br.check, { skill: 'observation', difficulty: -3, label: 'Spot it', success: 's', failure: 'f' }, 'validate: skill by label, difficulty clamped to -3');
  eq(v.rooms[SPAWN].tokens, [], 'validate: no creature in the spawn room');
  eq(v.rooms[SPAWN].check, null, 'validate: unknown skill → no check');
  eq([v.rooms['main-science-lab'].tokens[0].hidden, v.rooms['main-science-lab'].check.skill, v.rooms['main-science-lab'].check.difficulty], [false, 'medicalAid', 0], 'validate: explicit hidden:false kept; bad difficulty → default');
  const dv = ab.validatePlan({ rooms: { 'ground-great-hall': { check: { skill: 'understand', difficulty: 9 } } } }, { mapDef: keep, skills: ab.skillsOf(dune), universeId: 'dune' });
  eq(dv.rooms['ground-great-hall'].check.difficulty, 5, 'validate: DUNE difficulty clamped to 5');
  const ph = ab.validatePlan({ rooms: { 'main-bridge': { hazard: 'GM only', tokens: [{ kind: 'item', label: 'Chip', note: 'GM only: the true course' }], check: { skill: 'comtech', success: 'GM only', failure: 'N/A' } } } }, { mapDef: cronus, skills, universeId: 'alien' }).rooms['main-bridge'];
  eq([ph.hazard, ph.tokens[0].note, ph.check.success, ph.check.failure], ['', 'the true course', '', ''], 'validate: "GM only" placeholders stripped');
  const cb = ab.validatePlan({ rooms: Object.fromEntries(cronus.rooms.slice(0, 6).map((r, i) => [r.id, { tokens: i === 5 ? [{ kind: 'hazard', label: 'Leak' }] : [], check: { skill: 'observation' } }])) }, { mapDef: cronus, skills, universeId: 'alien', checkBudget: 2 });
  eq(Object.entries(cb.rooms).filter(([, r]) => r.check).map(([id]) => id), [cronus.rooms[0].id, cronus.rooms[5].id], 'validate: checkBudget keeps the risky room first, then the earliest');
  const many = { rooms: Object.fromEntries(cronus.rooms.map((r) => [r.id, { tokens: Array.from({ length: 4 }, (_, i) => ({ kind: i === 0 ? 'creature' : 'item', label: `T${i}` })) }])) };
  const mv = ab.validatePlan(many, { mapDef: cronus, skills, universeId: 'alien' });
  const all = Object.values(mv.rooms).flatMap((r) => r.tokens);
  ok(all.length <= ab.MAX_PLAN_TOKENS, `validate: total cap (${all.length})`);
  eq(all.filter((t) => t.kind === 'creature').length, ab.creatureCap(cronus.rooms.length), 'validate: at most 1 creature per 3 rooms');
  ok(Object.values(mv.rooms).every((r) => r.tokens.length <= 4), 'validate: every room ≤ 4');

  // templatePlan
  for (const [uni, u, pack, md] of [['alien', alien, alienPack, cronus], ['dune', dune, dunePack, keep]]) {
    for (const density of ab.DENSITIES) {
      const tp = ab.templatePlan({ pack, universe: u, mapDef: md, density, seed: 42 });
      const toks = Object.values(tp).flatMap((r) => r.tokens);
      eq(Object.keys(tp).length, md.rooms.length, `template ${uni}/${density}: every room present`);
      ok(toks.length > 0 && toks.length <= ab.MAX_PLAN_TOKENS, `template ${uni}/${density}: ${toks.length} tokens`);
      ok(Object.values(tp).every((r) => r.description && r.tokens.length <= 4), `template ${uni}/${density}: descriptions, ≤ 4 per room`);
      const spawn = ab.spawnRooms(md);
      ok(!Object.entries(tp).some(([id, r]) => spawn.has(id) && r.tokens.some((t) => t.kind === 'creature')), `template ${uni}/${density}: no creature in a spawn room`);
      ok(toks.filter((t) => t.kind === 'creature').length <= ab.creatureCap(md.rooms.length), `template ${uni}/${density}: creature cap`);
      const rv = ab.validatePlan({ rooms: tp }, { mapDef: md, skills: ab.skillsOf(u), universeId: uni });
      eq(Object.values(rv.rooms).flatMap((r) => r.tokens).length, toks.length, `template ${uni}/${density}: survives validation intact`);
      if (density === 'normal') {
        eq(ab.templatePlan({ pack, universe: u, mapDef: md, density, seed: 42 }), tp, `template ${uni}: deterministic`);
        ok(toks.some((t) => t.kind === 'creature' && t.hidden) && toks.some((t) => t.kind === 'npc'), `template ${uni}: threats → hidden creatures, npcs → npc tokens`);
        ok(toks.some((t) => t.kind === 'marker'), `template ${uni}: key locations → markers`);
        ok(Object.values(tp).some((r) => r.check && ab.skillsOf(u).some((s) => s.key === r.check.skill)), `template ${uni}: checks use the universe's skills`);
        const npcSecrets = (pack.npcs || []).map((n) => n.secret).filter(Boolean);
        ok(!npcSecrets.some((sec) => JSON.stringify(tp).includes(sec)), `template ${uni}: no NPC secret`);
      }
    }
  }
  const empty = ab.templatePlan({ pack: null, universe: alien, mapDef: cronus, density: 'sparse', seed: 1 });
  ok(Object.values(empty).flatMap((r) => r.tokens).length > 0, 'template without a pack is never empty');
  const pr = ab.buildPrompt({ pack: alienPack, universe: alien, mapDef: cronus, density: 'normal', batch: cronus.rooms.slice(0, 3), creatureBudget: 2, spawn: [SPAWN] });
  ok(pr.system.includes('observation (Observation)') && pr.system.includes('-3 to +3') && pr.system.includes(SPAWN), 'prompt: skills, ALIEN difficulty range, spawn room');
  ok(pr.user.includes(cronus.rooms[0].id) && pr.user.includes(alienPack.threats[0].name) && !alienPack.npcs.some((n) => n.secret && pr.user.includes(n.secret)), 'prompt: rooms + threats, no NPC secrets');
  ok(ab.buildPrompt({ pack: dunePack, universe: dune, mapDef: keep, density: 'dense', batch: keep.rooms.slice(0, 2), creatureBudget: 1, spawn: [] }).system.includes('1 to 5'), 'prompt: DUNE difficulty range');
}

/* ── Mock OpenAI-compatible chat server ──────────────────────── */
const MODEL = 'mock-planner:test';
const mock = { mode: 'json', requests: [], calls: 0, delay: 0 };
const chunkLine = (content) => `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`;
function mockPlan(user) {
  const ids = [...user.matchAll(/^- ([a-z0-9-]+) \|/gm)].map((m) => m[1]);
  const skill = /these ids: ([A-Za-z]+) \(/.exec(mock.lastSystem || '')?.[1] || 'observation';
  const rooms = {};
  ids.forEach((id, i) => {
    rooms[id] = {
      mood: 'tense', description: `DESC-${id}. Present tense dread.`,
      tokens: [{ kind: 'item', label: `Item ${id}`, glyph: i === 0 ? 'banana' : 'crate', hidden: false, locked: i % 2 === 0, note: `NOTE-SECRET-${id}` }],
      check: { skill, difficulty: -1, label: 'Look around', success: 'ok', failure: 'bad' },
    };
    if (i === 1) rooms[id].tokens.push({ kind: 'creature', label: `Creature ${id}`, glyph: 'claw', note: `CREATURE-NOTE-${id}` });
    if (i === 2) rooms[id].tokens.push({ kind: 'npc', label: `Hidden NPC ${id}`, hidden: true, note: 'npc' }, { kind: 'dragon', label: 'x' }, { kind: 'item', label: 'A' }, { kind: 'item', label: 'B' }, { kind: 'item', label: 'C' }, { kind: 'item', label: 'D' });
  });
  rooms['not-a-room'] = { tokens: [{ kind: 'item', label: 'ghost' }] };
  return { rooms };
}
const mockServer = createHttpServer((req, res) => {
  const readJson = (fn) => { let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => fn(b ? JSON.parse(b) : {})); };
  if (req.method === 'POST' && req.url === '/free') return readJson(() => { res.writeHead(200); res.end('{}'); });
  if (req.method === 'GET' && req.url === '/system_stats') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"system":{}}'); }
  if (req.method === 'GET' && req.url === '/api/ps') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"models":[]}'); }
  if (req.method === 'GET' && req.url === '/v1/models') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ data: [{ id: MODEL }] })); }
  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    return readJson(async (j) => {
      mock.calls++;
      mock.requests.push(j);
      mock.lastSystem = j.messages?.[0]?.content || '';
      const user = j.messages?.[1]?.content || '';
      if (mock.mode === 'error') { res.writeHead(500); return res.end('{"error":"boom"}'); }
      if (mock.delay) await sleep(mock.delay);
      const plan = JSON.stringify(mockPlan(user));
      let text = plan;
      if (mock.mode === 'fences') text = `Here you go:\n\`\`\`json\n${plan}\n\`\`\``;
      if (mock.mode === 'prose') text = `Certainly! The plan is ${plan} I hope the crew survives.`;
      if (mock.mode === 'garbage') text = 'I would rather not. {broken';
      if (mock.mode === 'firstbad') text = mock.calls % 2 === 1 ? 'oops {"rooms": ' : plan;
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const n = Math.ceil(text.length / 3);
      for (let i = 0; i < text.length; i += n) res.write(chunkLine(text.slice(i, i + n)));
      res.write('data: [DONE]\n\n');
      res.end();
    });
  }
  res.writeHead(404); res.end();
});
await new Promise((r) => mockServer.listen(0, '127.0.0.1', r));
const MOCK_URL = `http://127.0.0.1:${mockServer.address().port}/v1`;
const MOCK_ROOT = MOCK_URL.replace(/\/v1$/, '');
const cfg = { url: MOCK_URL, model: MODEL, apiKey: '', comfy: MOCK_ROOT };
vram.resetVramThrottle();

let spawned = null;
const sockets = [];
try {
  /* ── 2. generatePlan (in-process, mock) ─────────────────────── */
  const fakeGame = { code: 'TEST', universeId: 'alien', board: { mapId: cronus.id }, mapDef: cronus };
  const batches = Math.ceil(cronus.rooms.length / ab.BATCH_ROOMS);
  {
    mock.mode = 'json'; mock.calls = 0; mock.requests = [];
    const progress = []; const status = [];
    const r = await ab.generatePlan({ game: fakeGame, pack: alienPack, universe: alien, mapDef: cronus, density: 'normal', cfg, onProgress: (p) => progress.push(p), onStatus: (s) => status.push(s) });
    eq([r.provider, r.model, r.plan.provider], ['local', MODEL, 'local'], 'generatePlan: local provider');
    eq(mock.calls, batches, `generatePlan: ${batches} batches of ≤ ${ab.BATCH_ROOMS} rooms`);
    eq(mock.requests[0].response_format, { type: 'json_object' }, 'request asks for response_format json_object');
    eq(Object.keys(r.plan.rooms).length, cronus.rooms.length, 'every room planned');
    ok(!r.plan.rooms['not-a-room'], 'invented room dropped');
    eq(r.plan.rooms[cronus.rooms[0].id].tokens[0].glyph, 'crate', 'bad glyph → default');
    ok(Object.values(r.plan.rooms).every((x) => x.tokens.length <= 4), 'per-room cap holds');
    ok(!r.plan.rooms[SPAWN].tokens.some((t) => t.kind === 'creature'), 'no creature in the spawn room');
    ok(Object.values(r.plan.rooms).flatMap((x) => x.tokens).filter((t) => t.kind === 'creature').length <= ab.creatureCap(cronus.rooms.length), 'creature cap across batches');
    ok(Object.values(r.plan.rooms).filter((x) => x.check).length <= Math.ceil(cronus.rooms.length * ab.CHECK_SHARE) + batches, 'checks capped per batch');
    eq([status[0].provider, status[0].batches], ['local', batches], 'onStatus: local + batch count');
    eq(progress.filter((p) => p.stage === 'done').length, batches, 'onProgress per batch');
    eq([r.plan.mapId, r.plan.density, r.plan.applied], [cronus.id, 'normal', []], 'plan carries mapId, density, applied []');
  }
  for (const mode of ['fences', 'prose']) {
    mock.mode = mode; mock.calls = 0;
    const r = await ab.generatePlan({ game: fakeGame, pack: alienPack, universe: alien, mapDef: cronus, density: 'sparse', cfg });
    eq([r.provider, mock.calls, Object.keys(r.plan.rooms).length], ['local', batches, cronus.rooms.length], `generatePlan: ${mode}-wrapped JSON extracted`);
  }
  {
    mock.mode = 'firstbad'; mock.calls = 0;
    const r = await ab.generatePlan({ game: fakeGame, pack: alienPack, universe: alien, mapDef: cronus, density: 'dense', cfg });
    eq([r.provider, mock.calls], ['local', batches * 2], 'generatePlan: invalid JSON → one retry per batch → model plan');
    ok(mock.requests.at(-1).messages[1].content.includes('not valid JSON'), 'retry nudges for JSON only');
  }
  {
    mock.mode = 'garbage'; mock.calls = 0;
    const r = await ab.generatePlan({ game: fakeGame, pack: alienPack, universe: alien, mapDef: cronus, density: 'normal', cfg });
    eq([r.provider, r.plan.provider, mock.calls], ['template', 'template', batches * 2], 'generatePlan: garbage twice → template');
    ok(r.warning && Object.values(r.plan.rooms).flatMap((x) => x.tokens).length > 0, 'template fallback is never empty and warns');
  }
  {
    mock.mode = 'error'; mock.calls = 0;
    const r = await ab.generatePlan({ game: fakeGame, pack: alienPack, universe: alien, mapDef: cronus, density: 'normal', cfg: { ...cfg } });
    eq(r.provider, 'template', 'generatePlan: HTTP 500 → template');
    const none = await ab.generatePlan({ game: fakeGame, pack: alienPack, universe: alien, mapDef: cronus, density: 'normal', cfg: { url: '', model: MODEL } });
    eq([none.provider, none.warning], ['template', undefined], 'no GM_URL → template, no warning');
    await gm.gmStatus(cfg, { fresh: true }); // the 500 marked the mock down; re-probe
  }

  /* ── 3. Real server ─────────────────────────────────────────── */
  mock.mode = 'json';
  const { io } = await import('socket.io-client');
  spawned = spawn(process.execPath, ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, API_TOKEN: '', TTS_URL: '', GM_URL: MOCK_URL, GM_MODEL: MODEL, COMFY_URL: MOCK_ROOT }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('server start timeout')), 10000);
    spawned.stdout.on('data', (d) => { if (String(d).includes('ONLINE')) { clearTimeout(t); res(); } });
    spawned.stderr.on('data', (d) => process.stderr.write(d));
    spawned.on('exit', (c) => { clearTimeout(t); rej(new Error('server exited ' + c)); });
  });
  const connect = () => new Promise((res, rej) => {
    const s = io(URL, { transports: ['websocket'], reconnection: false });
    sockets.push(s);
    s.on('connect', () => res(s));
    s.on('connect_error', rej);
  });
  const call = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, res));
  const track = (s) => {
    s.boardState = null; s.table = null; s.raw = [];
    s.on('board-state', (d) => { s.boardState = d.board; s.raw.push(JSON.stringify(d)); });
    s.on('table-state', (d) => { s.table = d.table; s.raw.push(JSON.stringify(d)); });
    return s;
  };
  const post = (path, body, accept = 'application/json') => fetch(URL + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: accept }, body: JSON.stringify(body) });
  async function until(pred, label, ms = 3000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (pred()) return; await sleep(20); }
    throw new Error('timeout: ' + label);
  }

  const dm = track(await connect());
  const created = await call(dm, 'create-game', { universeId: 'alien', packId: 'chariot-of-the-gods' });
  const { code, dmToken } = created;
  const tv = track(await connect());
  ok((await call(tv, 'join-board', { code })).success, 'TV joined');
  const pA = track(await connect());
  const jA = await call(pA, 'join-game', { code, playerName: 'Alice' });
  ok((await call(dm, 'assign-character', { gameCode: code, playerId: jA.playerId, character: { id: 'rye', name: 'Rye', career: 'Pilot', gear: [] }, tracks: {}, trackMax: {} })).success, 'character assigned');
  const auth = { code, dmToken };

  eq((await (await post('/api/gm/build', { code, dmToken: 'nope' })).json()).error, 'not_authorized', 'build: bad token → 403');
  eq((await post('/api/gm/build', { ...auth, density: 'galactic' })).status, 400, 'build: bad density → 400');
  eq((await (await post('/api/gm/build', { ...auth })).json()).error, 'no_map', 'build: no map on the board → 400 no_map');
  eq((await fetch(`${URL}/api/gm/build?code=${code}&dmToken=bad`)).status, 403, 'GET build: bad token → 403');
  eq(await (await fetch(`${URL}/api/gm/build?code=${code}&dmToken=${dmToken}`)).json(), { plan: null }, 'GET build: no plan yet');

  ok((await call(dm, 'board-set-map', { gameCode: code, mapId: cronus.id, level: 'main', mapDef: CRONUS_DEF })).success, 'Cronus on the board');
  const sp = CRONUS_DEF.spawn.pc;
  ok((await call(dm, 'board-token-upsert', { gameCode: code, token: { id: 'pc-a', kind: 'pc', label: 'Rye', ownerPlayerId: jA.playerId, x: sp[0], y: sp[1] } })).success, 'PC at spawn');

  // JSON build
  mock.calls = 0;
  const r1 = await post('/api/gm/build', { ...auth, density: 'normal' });
  const b1 = await r1.json();
  eq([r1.status, b1.provider, b1.model, b1.plan.provider], [200, 'local', MODEL, 'local'], 'build (JSON): local plan');
  eq(Object.keys(b1.plan.rooms).length, cronus.rooms.length, 'build: every room');
  await until(() => dm.table?.aiPlan?.at === b1.plan.at, 'DM table carries aiPlan');
  const got = await (await fetch(`${URL}/api/gm/build?code=${code}&dmToken=${dmToken}`)).json();
  eq(got.plan.at, b1.plan.at, 'GET build returns the stored plan');
  ok(pA.table && pA.table.aiPlan === undefined && pA.table.visitedRooms === undefined, 'player table view: no aiPlan / visitedRooms');
  eq(pA.table.aiGm, { entry: 'off' }, 'player table view: aiGm.entry only');
  ok(tv.table && tv.table.aiPlan === undefined && tv.table.aiGm === undefined, 'TV table view: nothing of the AI GM');

  // SSE build + 429 while it runs
  mock.delay = 250;
  const sseRes = await post('/api/gm/build', { ...auth, density: 'sparse' }, 'text/event-stream');
  eq((sseRes.headers.get('content-type') || '').split(';')[0], 'text/event-stream', 'build (SSE): event stream');
  const busy = await post('/api/gm/build', { ...auth, density: 'sparse' });
  eq(busy.status, 429, 'build: second request while building → 429');
  const sseText = await sseRes.text();
  mock.delay = 0;
  const evs = [...sseText.matchAll(/event: (\w+)\ndata: (.*)\n/g)].map((m) => ({ ev: m[1], data: JSON.parse(m[2]) }));
  eq(evs[0].ev, 'status', 'SSE: status first');
  eq(evs.filter((e) => e.ev === 'progress' && e.data.stage === 'done').length, batches, 'SSE: progress per batch');
  const doneEv = evs.find((e) => e.ev === 'done');
  eq([doneEv.data.provider, doneEv.data.plan.density], ['local', 'sparse'], 'SSE: done carries the plan');

  // Apply a subset
  const pick = ['main-bridge', 'main-science-lab', 'main-main-corridor'];
  const a1 = await (await post('/api/gm/build/apply', { ...auth, rooms: pick })).json();
  eq([a1.applied.rooms, a1.applied.roomIds.sort()], [3, [...pick].sort()], 'apply: chosen rooms only');
  const planned = pick.reduce((n, id) => n + a1.plan.rooms[id].tokens.length, 0);
  eq(a1.applied.tokens, planned, `apply: ${planned} tokens placed`);
  await until(() => Object.values(dm.boardState?.tokens || {}).filter((t) => t.ai).length === planned, 'DM board has the AI tokens');
  const aiToks = Object.values(dm.boardState.tokens).filter((t) => t.ai);
  ok(aiToks.every((t) => pick.includes(t.aiRoom) && t.roomId === t.aiRoom), 'every AI token sits inside its room (roomId === aiRoom)');
  ok(aiToks.every((t) => board.roomAt(cronus, t.x, t.y, 'main') === t.aiRoom), 'hit-test agrees');
  ok(aiToks.every((t) => /^ai-[a-f0-9]{12}$/.test(t.id)) && aiToks.filter((t) => /NOTE/.test(t.note)).length >= 3, 'ai ids + GM notes on the GM board');
  for (const id of pick) {
    const want = a1.plan.rooms[id].tokens.map((t) => `${t.label}:${t.hidden}`).sort();
    eq(aiToks.filter((t) => t.aiRoom === id).map((t) => `${t.label}:${t.hidden}`).sort(), want, `${id}: hidden flags as planned`);
  }
  ok(aiToks.some((t) => t.kind === 'creature' && t.hidden), 'a planned creature is hidden');
  eq(dm.table.aiPlan.applied.sort(), [...pick].sort(), 'aiPlan.applied lists the rooms');
  await sleep(150);
  const leaks = (s) => s.raw.some((j) => /NOTE-SECRET|CREATURE-NOTE|"aiPlan"|"aiRoom"|"ai":true|"aiShow"|DESC-/.test(j));
  ok(!leaks(pA) && !leaks(tv), 'players / TV never received notes, ai tags, descriptions or the plan');
  ok(Object.values(pA.boardState.tokens).every((t) => t.kind === 'pc'), 'fog: AI tokens in unrevealed rooms invisible to the player');
  // reveal the bridge: visible ones appear, hidden stay hidden
  ok((await call(dm, 'board-room-set', { gameCode: code, roomId: 'main-science-lab', revealed: true })).success, 'GM reveals the science lab');
  await until(() => Object.values(pA.boardState.tokens).some((t) => t.label?.startsWith('Item main-science-lab')), 'revealed room: visible AI item appears for the player');
  ok(!Object.values(pA.boardState.tokens).some((t) => t.kind === 'creature' || t.kind === 'npc'), 'hidden creature / npc never reach the player');
  ok(!leaks(pA) && !leaks(tv), 'still no notes / ai tags after the reveal');

  // Re-apply replaces, keep adds
  const a2 = await (await post('/api/gm/build/apply', { ...auth, rooms: ['main-bridge'] })).json();
  await sleep(100);
  eq(Object.values(dm.boardState.tokens).filter((t) => t.aiRoom === 'main-bridge').length, a2.plan.rooms['main-bridge'].tokens.length, 're-apply replaces the room\'s AI tokens');
  await post('/api/gm/build/apply', { ...auth, rooms: ['main-bridge'], keep: true });
  await sleep(100);
  eq(Object.values(dm.boardState.tokens).filter((t) => t.aiRoom === 'main-bridge').length, a2.plan.rooms['main-bridge'].tokens.length * 2, 'keep:true adds instead');

  // Apply all + caps
  const a3 = await (await post('/api/gm/build/apply', { ...auth })).json();
  eq(a3.applied.rooms, cronus.rooms.length, 'apply (no rooms) = every room');
  await sleep(150);
  const allAi = Object.values(dm.boardState.tokens).filter((t) => t.ai);
  ok(allAi.length <= ab.MAX_PLAN_TOKENS && allAi.length === a3.applied.tokens, `apply all: ${allAi.length} tokens ≤ 60`);
  ok(cronus.rooms.every((r) => allAi.filter((t) => t.aiRoom === r.id).length <= 4), 'apply all: ≤ 4 per room');

  // Client-edited plan: sanitized; mismatch
  const edited = { ...a3.plan, rooms: { 'main-bridge': { description: 'Edited.', tokens: [{ kind: 'item', label: 'Edited crate', glyph: 'crate' }, { kind: 'alien', label: 'bad' }] }, 'fake-room': { tokens: [] } } };
  const a4 = await (await post('/api/gm/build/apply', { ...auth, plan: edited })).json();
  eq([Object.keys(a4.plan.rooms), a4.applied.tokens, a4.plan.rooms['main-bridge'].tokens.length], [['main-bridge'], 1, 1], 'client plan re-validated (bad room / kind dropped)');
  eq((await post('/api/gm/build/apply', { ...auth, plan: { ...edited, mapId: 'fort-nebraska' } })).status, 409, 'plan for another map → 409');
  eq((await post('/api/gm/build/apply', { ...auth, plan: { rooms: { zzz: {} } } })).status, 400, 'plan with no valid room → 400');
  eq((await post('/api/gm/build/apply', { code, dmToken: 'x' })).status, 403, 'apply: bad token → 403');
  eq((await post('/api/gm/build/clear', { code, dmToken: 'x' })).status, 403, 'clear: bad token → 403');

  // Clear
  const nAi = Object.values(dm.boardState.tokens).filter((t) => t.ai).length;
  const cl = await (await post('/api/gm/build/clear', auth)).json();
  eq(cl.removed, nAi, `clear removed ${nAi} AI tokens`);
  await until(() => !Object.values(dm.boardState.tokens).some((t) => t.ai) && dm.table.aiPlan === null, 'board + plan cleared');
  ok(dm.boardState.tokens['pc-a'], 'clear keeps the PC');
  eq(await (await fetch(`${URL}/api/gm/build?code=${code}&dmToken=${dmToken}`)).json(), { plan: null }, 'GET after clear → null');
  eq((await post('/api/gm/build/apply', auth)).status, 400, 'apply with no stored plan → 400 no_plan');

  // DUNE on Qarrat Keep (mock answers with dune skills)
  const dm2 = track(await connect());
  const c2 = await call(dm2, 'create-game', { universeId: 'dune', packId: 'the-water-debt' });
  ok((await call(dm2, 'board-set-map', { gameCode: c2.code, mapId: keep.id, level: 'ground', mapDef: KEEP_DEF })).success, 'DUNE: Qarrat Keep on the board');
  const d1 = await (await post('/api/gm/build', { code: c2.code, dmToken: c2.dmToken, density: 'dense' })).json();
  eq([d1.provider, Object.keys(d1.plan.rooms).length], ['local', keep.rooms.length], 'DUNE: plan for every room of the keep');
  ok(Object.values(d1.plan.rooms).every((r) => !r.check || ['battle', 'communicate', 'discipline', 'move', 'understand'].includes(r.check.skill)), 'DUNE: checks use DUNE skills only');
  ok(mock.requests.at(-1).messages[0].content.includes('1 to 5'), 'DUNE prompt: 1–5 difficulty');
  const da = await (await post('/api/gm/build/apply', { code: c2.code, dmToken: c2.dmToken, rooms: ['cistern-guard-stair-foot', 'roof-thopter-pad', 'ground-great-hall'] })).json();
  ok(da.applied.tokens > 0, 'DUNE: applied on several levels');
  await sleep(150);
  const dt = Object.values(dm2.boardState.tokens).filter((t) => t.ai);
  ok(dt.every((t) => t.roomId === t.aiRoom && t.level === keep.rooms.find((r) => r.id === t.aiRoom).level), 'DUNE: tokens carry their room\'s level');
  mock.mode = 'garbage';
  const d2 = await (await post('/api/gm/build', { code: c2.code, dmToken: c2.dmToken, density: 'sparse' })).json();
  eq([d2.provider, typeof d2.warning], ['template', 'string'], 'mounted: garbage model → template plan with a warning');
  mock.mode = 'json';

  console.log(`test-aibuild: ${checks} checks passed`);
} finally {
  for (const s of sockets) s.close();
  if (spawned) { spawned.removeAllListeners('exit'); spawned.kill('SIGKILL'); }
  mockServer.closeAllConnections?.();
  mockServer.close();
  await sleep(150);
  try { rmSync(DATA, { recursive: true, force: true }); } catch { /* ignore */ }
}
process.exit(0);
