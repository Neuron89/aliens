#!/usr/bin/env node
/* AI GM — server/gm.js (docs/AI_GM.md). Provider: an OpenAI-compatible chat endpoint (Ollama).
   1. Unit: gmContext for both universes (persona + tone present; NPC secrets, act gmNotes /
      agendaNotes, endings, room notes, hidden clues, character secrets and scene checks
      absent; PCs, revealed rooms and visible tokens listed, fogged rooms not; maxWords
      honoured and clamped), the template fallback for every kind (never empty), and the
      local-model path against a MOCK OpenAI chat server started here (streaming chunks,
      <think> stripping, bearer, status probe + cache, HTTP 500 / unreachable → template).
   2. HTTP in-process: createGmRouter({ config }) on a scratch express app with a game put
      straight into sessions.games — SSE status/delta/done, JSON mode, 403 / 400 / 429, abort
      on client disconnect reaches the model server.
   3. Server: the real server/index.js mount, once with GM_URL → the mock and once with no
      GM_URL (template): /api/gm/status, a game created over the socket with a pack.
   The real GPU box is never called.
   Usage: node scripts/test-aigm.mjs */
import { spawn } from 'child_process';
import { createServer as createHttpServer } from 'http';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import assert from 'assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = mkdtempSync(join(tmpdir(), 'aigm-'));
process.env.GM_URL = ''; // never the real GPU box (each spawned server gets its own GM_URL)
process.env.COMFY_URL = 'http://127.0.0.1:9'; // nor the real ComfyUI (the VRAM hand-off targets the mock below)
process.env.DATA_DIR = DATA;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
const words = (s) => (String(s).match(/\S+/g) || []).length;

const gm = await import(pathToFileURL(join(ROOT, 'server', 'gm.js')).href);
const { games } = await import(pathToFileURL(join(ROOT, 'server', 'sessions.js')).href);
const { loadUniverseCore } = await import(pathToFileURL(join(ROOT, 'server', 'generator', 'universes.js')).href);
const alien = await loadUniverseCore('alien');
const dune = await loadUniverseCore('dune');
const alienPack = gm.loadPackFor('alien', 'chariot-of-the-gods');
const dunePack = gm.loadPackFor('dune', 'the-water-debt');
ok(alienPack?.id === 'chariot-of-the-gods' && dunePack?.id === 'the-water-debt', 'bundled packs load on the server');
eq(gm.loadPackFor('alien', '../etc'), null, 'pack id is validated');

/** Everything the prompt must never carry for this pack (exact strings). */
function secretsOf(pack) {
  const out = [];
  for (const n of pack.npcs || []) if (n.secret) out.push(n.secret);
  for (const a of pack.acts || []) { if (a.gmNotes) out.push(a.gmNotes); if (a.agendaNotes) out.push(a.agendaNotes); for (const s of a.scenes || []) for (const c of s.checks || []) out.push(c); }
  for (const e of pack.endings || []) { if (e.text) out.push(e.text); if (e.condition) out.push(e.condition); }
  for (const m of pack.maps || []) for (const r of m.rooms || []) if (r.note) out.push(r.note);
  for (const c of pack.characters || []) if (c.secret) out.push(c.secret);
  return out.filter((s) => typeof s === 'string' && s.length > 25);
}
const noSecrets = (text, list, where) => { for (const s of list) ok(!String(text).includes(s), `${where}: no secret "${s.slice(0, 40)}…"`); };

const T0 = Date.UTC(2026, 9, 31, 20, 0);
function fakeGame(universeId, pack, { actIndex = 0, sceneIndex = 1 } = {}) {
  const act = pack.acts[actIndex];
  const names = universeId === 'alien' ? ['Rye', 'Okafor'] : ['Oren Haskell', 'Farrah'];
  return {
    code: universeId === 'alien' ? 'ALNA' : 'DUNA', universeId, packId: pack.id, createdAt: T0, dmToken: `tok-${universeId}`,
    players: new Map([
      ['p1', { id: 'p1', name: 'Ann', character: { name: names[0], career: universeId === 'alien' ? 'Pilot' : 'Mentat' }, alive: true }],
      ['p2', { id: 'p2', name: 'Bo', character: { name: names[1], career: universeId === 'alien' ? 'Medic' : 'Envoy' }, alive: true }],
    ]),
    mapDef: {
      id: 'deck', title: 'TEST DECK', kind: 'ascii',
      rooms: [
        { id: 'bridge', name: 'Bridge', note: 'GM-ROOM-NOTE: the captain is a synthetic and the logs are forged.' },
        { id: 'cargo', name: 'Cargo Hold' },
        { id: 'vault', name: 'Sealed Vault Of Whispers' },
      ],
    },
    board: {
      mapId: 'deck', level: null, fog: true,
      rooms: { bridge: { revealed: true, entered: true }, cargo: { revealed: true, entered: true }, vault: { revealed: false } },
      tokens: {
        t1: { id: 't1', kind: 'pc', label: 'R', ownerPlayerId: 'p1', roomId: 'bridge', hidden: false },
        t2: { id: 't2', kind: 'pc', label: names[1], ownerPlayerId: 'p2', roomId: 'cargo', hidden: false },
        t3: { id: 't3', kind: 'creature', label: 'Hidden Horror', roomId: 'vault', hidden: false },
        t4: { id: 't4', kind: 'npc', label: 'Stowaway Kid', roomId: 'cargo', hidden: false, note: 'GM-TOKEN-NOTE' },
        t5: { id: 't5', kind: 'item', label: 'Concealed Rifle', roomId: 'cargo', hidden: true },
      },
      pings: [],
    },
    table: {
      run: { actIndex, sceneIndex, completed: {}, actTitle: act.title, sceneTitle: act.scenes[sceneIndex]?.name || '' },
      narration: null,
      clues: [
        { id: 'c1', text: 'The docking log was wiped at 0300.', status: 'revealed', revealedTo: 'all' },
        { id: 'c2', text: 'HIDDEN-CLUE-TEXT the medic was paid.', status: 'hidden', revealedTo: null },
        { id: 'c3', text: 'PRIVATE-CLUE-TEXT for one player.', status: 'revealed', revealedTo: ['p1'] },
      ],
      handouts: [],
      clocks: [{ id: 'k1', label: 'HULL BREACH', filled: 2, segments: 6, visibility: 'all' }, { id: 'k2', label: 'GM-ONLY-CLOCK', filled: 1, segments: 4, visibility: 'gm' }],
      poolDefs: {},
    },
    log: [
      { id: 'l1', at: T0 + 1000, type: 'scene', text: `Scene: ${act.title} — ${act.scenes[0].name}` },
      { id: 'l2', at: T0 + 2000, type: 'narration', text: 'The lights come up in sequence.' },
      { id: 'l3', at: T0 + 3000, type: 'note', text: 'GM-PRIVATE-NOTE the twist is near' },
      { id: 'l4', at: T0 + 4000, type: 'roll', text: '[SECRET] GM-SECRET-ROLL', secret: true },
      { id: 'l5', at: T0 + 5000, type: 'clue', text: 'Clue revealed: The docking log was wiped at 0300. → everyone', clueId: 'c1' },
    ],
  };
}
const MARKERS = ['GM-ROOM-NOTE', 'Hidden Horror', 'Concealed Rifle', 'GM-TOKEN-NOTE', 'HIDDEN-CLUE-TEXT', 'PRIVATE-CLUE-TEXT', 'GM-ONLY-CLOCK', 'GM-PRIVATE-NOTE', 'GM-SECRET-ROLL'];
const noMarkers = (text, where) => { for (const m of MARKERS) ok(!String(text).includes(m), `${where}: no "${m}"`); };

/* ── 1. Unit ─────────────────────────────────────────────────── */
for (const [uid, universe, pack, personaRe] of [['alien', alien, alienPack, /Present tense, second person/], ['dune', dune, dunePack, /chronicler of a Great House/]]) {
  const g = fakeGame(uid, pack);
  const scene = pack.acts[0].scenes[1];
  const secrets = secretsOf(pack);
  ok(secrets.length > 5, `${uid}: secrets collected (${secrets.length})`);
  for (const kind of gm.KINDS) {
    const npcId = kind === 'npc' ? gm.npcKey(pack.npcs[0], 0) : undefined;
    const c = gm.gmContext(g, kind, { pack, universe, npcId, prompt: kind === 'improv' ? 'they cut the power' : '' });
    const all = `${c.system}\n${c.user}`;
    eq(c.kind, kind, `${uid}/${kind}: kind`);
    ok(personaRe.test(c.system), `${uid}/${kind}: persona voice in the system prompt`);
    ok(/never state hidden facts, secrets/.test(c.system) && /No stage directions/.test(c.system) && /No markdown/.test(c.system) && /Never address the game master/.test(c.system), `${uid}/${kind}: output rules`);
    noSecrets(all, secrets, `${uid}/${kind}`);
    noMarkers(all, `${uid}/${kind}`);
    const cast = g.players.get('p1').character.name;
    ok(c.user.includes(`${cast} (`) && c.user.includes(`${cast} — Bridge`), `${uid}/${kind}: PC and the room it stands in`);
    ok(/Known places: Bridge, Cargo Hold$/m.test(c.user), `${uid}/${kind}: revealed rooms listed, fogged room not`);
    ok(!c.user.includes('Sealed Vault Of Whispers'), `${uid}/${kind}: fogged room name absent`);
    ok(c.user.includes('Stowaway Kid (npc, Cargo Hold)'), `${uid}/${kind}: visible token listed`);
    ok(c.user.includes('HULL BREACH 2/6') && c.user.includes('The docking log was wiped'), `${uid}/${kind}: public clock + clue`);
    ok(c.user.includes(`Current scene: ${scene.name}`) && c.user.includes(scene.narration.slice(0, 60)), `${uid}/${kind}: current scene + read-aloud`);
  }
  const npcCtx = gm.gmContext(g, 'npc', { pack, universe, npcId: gm.npcKey(pack.npcs[0], 0) });
  ok(npcCtx.user.includes(`The NPC who speaks: ${pack.npcs[0].name}`) && npcCtx.npc === pack.npcs[0], `${uid}: npc context names the NPC`);
  ok(/first-person speech/.test(npcCtx.user), `${uid}: npc task = in-character speech`);
  eq(gm.findNpc(pack, '1'), pack.npcs[1], `${uid}: npcId by index`);
  eq(gm.findNpc(pack, pack.npcs[1].name), pack.npcs[1], `${uid}: npcId by name`);
  ok(gm.gmContext(g, 'improv', { pack, universe, prompt: 'they cut the power' }).user.includes('What just happened at the table: they cut the power'), `${uid}: improv prompt carried`);
  // maxWords
  ok(/Between 36 and 60 words\. Never more than 60\./.test(gm.gmContext(g, 'describe', { pack, universe, maxWords: 60 }).system), `${uid}: maxWords 60 honoured`);
  ok(/Never more than 160\./.test(gm.gmContext(g, 'describe', { pack, universe, maxWords: 160 }).system), `${uid}: maxWords 160`);
  eq([gm.gmContext(g, 'describe', { pack, universe, maxWords: 5000 }).maxWords, gm.gmContext(g, 'describe', { pack, universe, maxWords: 3 }).maxWords, gm.gmContext(g, 'describe', { pack, universe }).maxWords], [200, 40, 110], `${uid}: maxWords clamped / default`);
  // Template, every kind
  const tpl = {};
  for (const kind of gm.KINDS) {
    const t = gm.templateNarration(g, kind, { pack, universe, npcId: kind === 'npc' ? '0' : undefined, prompt: kind === 'improv' ? 'they cut the power' : '' });
    tpl[kind] = t;
    ok(typeof t === 'string' && words(t) >= 5, `${uid}/${kind}: template not empty (${words(t)} words)`);
    noSecrets(t, secrets, `${uid}/${kind} template`);
    noMarkers(t, `${uid}/${kind} template`);
  }
  eq(tpl['scene-open'], scene.narration, `${uid}: scene-open template = the scene's own narration`);
  ok(/is in the Bridge\./.test(tpl.describe) && /is in the Cargo Hold\./.test(tpl.describe) && tpl.describe.includes('Stowaway Kid in the Cargo Hold'), `${uid}: describe template stitches rooms + visible tokens`);
  ok(tpl.npc.startsWith(pack.npcs[0].name) && tpl.npc.includes(pack.npcs[0].behavior.slice(0, 30)), `${uid}: npc template = name + behavior/agenda`);
  ok(tpl.improv.startsWith('They cut the power.'), `${uid}: improv template echoes the prompt`);
  ok(tpl['recap-so-far'].includes(g.players.get('p1').character.name) && tpl['recap-so-far'].includes('The lights come up in sequence'), `${uid}: recap template from the public log`);
  if (uid === 'alien') console.log(`  sample template (alien/describe): ${tpl.describe.slice(0, 200)}`);
}

// No pack, no board, nothing: every kind still produces text.
{
  const bare = { code: 'BARE', universeId: 'dune', players: new Map(), table: {}, log: [], board: null, mapDef: null };
  for (const kind of gm.KINDS) {
    const t = gm.templateNarration(bare, kind, { universe: dune });
    ok(words(t) >= 8, `bare/${kind}: template never empty`);
    const c = gm.gmContext(bare, kind, { universe: dune });
    ok(c.user.includes('No scenario pack') && c.user.includes('none assigned yet'), `bare/${kind}: context explains the empty session`);
  }
}

// cleanNarration
eq(gm.cleanNarration('# Title\n**The hull** groans. [SFX: alarm]\n\n*You* wait .'), 'Title\nThe hull groans.\n\nYou wait.', 'cleanNarration strips markdown + stage directions');

eq(gm.capWords('One two three. Four five six seven eight nine ten eleven twelve.', 4), 'One two three.', 'capWords cuts at a sentence end');

/* ── Mock OpenAI-compatible chat server (stands in for Ollama) ── */
const MODEL = 'mock-qwen:test';
const mock = { mode: 'normal', requests: [], aborted: 0, modelsHits: 0, calls: [], free: [], unload: [], loaded: ['qwen-a:latest', 'llava:7b'] };
const chunkLine = (content) => `data: ${JSON.stringify({ id: 'c', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content } }] })}\n\n`;
const mockServer = createHttpServer((req, res) => {
  mock.calls.push(`${req.method} ${req.url}`);
  const readJson = (fn) => { let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => fn(b ? JSON.parse(b) : {})); };
  /* VRAM hand-off endpoints: ComfyUI /free + /system_stats + /prompt, Ollama /api/ps + /api/generate */
  if (req.method === 'POST' && req.url === '/free') return readJson((j) => { mock.free.push(j); res.writeHead(200); res.end('{}'); });
  if (req.method === 'GET' && req.url === '/system_stats') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"system":{}}'); }
  if (req.method === 'POST' && req.url === '/prompt') return readJson(() => { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end('{"error":"mock comfy"}'); });
  if (req.method === 'GET' && req.url === '/api/ps') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ models: mock.loaded.map((m) => ({ name: m, model: m })) })); }
  if (req.method === 'POST' && req.url === '/api/generate') return readJson((j) => { mock.unload.push(j); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"done":true}'); });
  if (req.method === 'GET' && req.url === '/v1/models') {
    mock.modelsHits++;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ object: 'list', data: [{ id: MODEL, object: 'model' }] }));
  }
  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', async () => {
      const j = JSON.parse(body);
      mock.requests.push({ body: j, auth: req.headers.authorization || '' });
      if (mock.mode === 'error') { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end('{"error":"boom"}'); }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const chunks = mock.mode === 'think' ? ['<think>secret plan', ' more</think>', 'Glowglobes ', 'drift low. ', 'The water waits.']
        : ['Glowglobes ', 'drift low. ', '**The water** waits.'];
      for (const c of chunks) { res.write(chunkLine(c)); await sleep(5); }
      if (mock.mode === 'hang') {
        res.on('close', () => { mock.aborted++; });
        return; // never finishes until the client goes away
      }
      res.write('data: [DONE]\n\n');
      res.end();
    });
    return undefined;
  }
  res.writeHead(404); res.end();
});
await new Promise((r) => mockServer.listen(0, '127.0.0.1', r));
const MOCK_URL = `http://127.0.0.1:${mockServer.address().port}/v1`;
const MOCK_ROOT = MOCK_URL.replace(/\/v1$/, '');
const cfg = { url: MOCK_URL, model: MODEL, apiKey: '', comfy: MOCK_ROOT };
const vram = await import(pathToFileURL(join(ROOT, 'server', 'vram.js')).href);
vram.resetVramThrottle();

/* ── Provider path (local model) ─────────────────────────────── */
{
  eq(await gm.gmStatus(cfg, { fresh: true }), { ok: true, provider: 'local', model: MODEL, url: MOCK_URL }, 'status: mock reachable');
  const hits = mock.modelsHits;
  await gm.gmStatus(cfg);
  eq(mock.modelsHits, hits, 'status probe cached');
  eq(await gm.gmStatus({ url: '', model: MODEL }), { ok: false, provider: 'none', model: 'template', url: '' }, 'status: no GM_URL → none');
  eq((await gm.gmStatus({ url: 'http://127.0.0.1:1/v1', model: MODEL }, { fresh: true })).ok, false, 'status: unreachable → not ok');

  const g = fakeGame('alien', alienPack);
  const deltas = [];
  const r = await gm.generateNarration({ game: g, kind: 'scene-open', pack: alienPack, universe: alien, maxWords: 60, cfg, onDelta: (t, c) => deltas.push([t, c]) });
  eq([r.provider, r.model, r.kind, r.text], ['local', MODEL, 'scene-open', 'Glowglobes drift low. The water waits.'], 'local path: cleaned final text');
  eq(deltas.map((d) => d[1]), ['Glowglobes ', 'drift low. ', '**The water** waits.'], 'deltas: chunks');
  eq(deltas[2][0], 'Glowglobes drift low. **The water** waits.', 'deltas: text so far');
  const req = mock.requests.at(-1);
  eq([req.body.model, req.body.stream, req.body.messages.map((m) => m.role)], [MODEL, true, ['system', 'user']], 'request: model, stream, system+user');
  ok(req.body.max_tokens >= 400 && req.body.temperature > 0, 'request: max_tokens + temperature');
  ok(/Never more than 60\./.test(req.body.messages[0].content) && /cold presence/.test(req.body.messages[0].content), 'request: persona + length in the system message');
  noSecrets(JSON.stringify(req.body), secretsOf(alienPack), 'chat request');
  noMarkers(JSON.stringify(req.body), 'chat request');
  eq(req.auth, '', 'no bearer without GM_API_KEY');
  await gm.generateNarration({ game: g, kind: 'describe', pack: alienPack, universe: alien, cfg: { ...cfg, apiKey: 'k-123' } });
  eq(mock.requests.at(-1).auth, 'Bearer k-123', 'GM_API_KEY → bearer');

  mock.mode = 'think';
  const th = [];
  const t = await gm.generateNarration({ game: g, kind: 'describe', pack: alienPack, universe: alien, cfg, onDelta: (s) => th.push(s) });
  ok(t.text === 'Glowglobes drift low. The water waits.' && th.every((s) => !s.includes('secret plan')), '<think> blocks never reach the draft');

  mock.mode = 'error';
  const f = await gm.generateNarration({ game: g, kind: 'scene-open', pack: alienPack, universe: alien, cfg });
  ok(f.provider === 'template' && f.model === 'template' && f.text === alienPack.acts[0].scenes[1].narration && /failed/.test(f.warning), 'HTTP 500 → template + warning');
  mock.mode = 'normal';
  const down = await gm.generateNarration({ game: g, kind: 'scene-open', pack: alienPack, universe: alien, cfg: { url: 'http://127.0.0.1:1/v1', model: MODEL } });
  ok(down.provider === 'template' && /did not answer/.test(down.warning), 'unreachable GM_URL → template + warning');
  const none = await gm.generateNarration({ game: g, kind: 'describe', pack: alienPack, universe: alien, cfg: { url: '', model: MODEL } });
  ok(none.provider === 'template' && !none.warning, 'no GM_URL → template, no warning');
}

/* ── VRAM hand-off (server/vram.js) ──────────────────────────── */
{
  eq(mock.free.length, 1, 'hand-off: the first narration freed ComfyUI once');
  eq(mock.free[0], { unload_models: true, free_memory: true }, 'hand-off: /free body');
  const iFree = mock.calls.indexOf('POST /free');
  const iChat = mock.calls.indexOf('POST /v1/chat/completions');
  ok(iFree >= 0 && iFree < iChat, 'hand-off: /free before the first chat request');
  ok(mock.requests.length >= 3, 'several narrations ran');
  eq((await vram.releaseForLlm({ comfy: MOCK_ROOT })).reason, 'throttled', 'hand-off: not again within 60 s');
  eq(mock.free.length, 1, 'hand-off: still one /free');
  eq(vram.ollamaRoot('http://h:11434/v1/'), 'http://h:11434', 'ollamaRoot strips /v1');
  const ri = await vram.releaseForImages({ ollama: MOCK_ROOT });
  eq([ri.released, ri.models], [true, mock.loaded], 'releaseForImages unloads every model in /api/ps');
  eq(mock.unload, mock.loaded.map((m) => ({ model: m, keep_alive: 0 })), 'unload = /api/generate keep_alive 0');
  eq(await vram.vramReach({ comfy: MOCK_ROOT, ollama: MOCK_ROOT }), { comfy: true, ollama: true }, 'vramReach: both reachable');
  const DEAD = 'http://127.0.0.1:1';
  const a = await vram.releaseForLlm({ comfy: DEAD, force: true });
  const b = await vram.releaseForImages({ ollama: DEAD });
  const c = await vram.vramReach({ comfy: DEAD, ollama: DEAD });
  ok(a.released === false && /unreachable/.test(a.reason) && b.released === false && c.comfy === false && c.ollama === false, 'unreachable endpoints: no-op, no throw');
  eq((await vram.releaseForImages({ ollama: '' })).reason, 'no GM_URL', 'no GM_URL: no-op');
  mock.unload.length = 0;
}

/* ── 2. HTTP in-process (mock provider) ──────────────────────── */
const express = (await import('express')).default;
let httpServer = null;
let spawned = null;
let sock = null;
try {
  const app = express();
  app.use(express.json());
  app.use('/api/gm', gm.createGmRouter({ config: cfg }));
  httpServer = await new Promise((res) => { const s = app.listen(0, '127.0.0.1', () => res(s)); });
  const base = `http://127.0.0.1:${httpServer.address().port}/api/gm`;
  const g = fakeGame('dune', dunePack);
  games.set(g.code, g);
  const post = (body, accept = 'text/event-stream', signal) => fetch(`${base}/narrate`, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', Accept: accept }, body: JSON.stringify(body) });
  const good = { code: g.code, dmToken: g.dmToken };

  eq((await post({ ...good, dmToken: 'nope', kind: 'describe' })).status, 403, 'wrong dmToken → 403');
  eq((await post({ code: 'ZZZZ', dmToken: g.dmToken, kind: 'describe' })).status, 403, 'unknown game → 403');
  eq((await post({ code: g.code, kind: 'describe' })).status, 403, 'missing dmToken → 403');
  eq((await post({ ...good, kind: 'sing' })).status, 400, 'bad kind → 400');
  eq((await (await post({ ...good, kind: 'improv' })).json()).error, 'prompt_required', 'improv without prompt → 400');
  eq((await (await post({ ...good, kind: 'npc', npcId: 'nobody-here' })).json()).error, 'unknown_npc', 'unknown npc → 400');
  eq((await post({ ...good, kind: 'improv', prompt: 'x'.repeat(700) })).status, 400, 'prompt too long → 400');
  eq(await (await fetch(`${base}/status`)).json(), { ok: true, provider: 'local', model: MODEL, url: MOCK_URL, vram: { comfy: true, ollama: true } }, 'GET /status (+ vram reachability)');

  const res = await post({ ...good, kind: 'npc', npcId: gm.npcKey(dunePack.npcs[0], 0), maxWords: 60 });
  ok(String(res.headers.get('content-type')).startsWith('text/event-stream'), 'SSE content type');
  const raw = await res.text();
  ok(raw.includes(`event: status\ndata: ${JSON.stringify({ provider: 'local', model: MODEL, kind: 'npc' })}`), 'SSE status event');
  const deltas = [...raw.matchAll(/event: delta\ndata: (.*)\n/g)].map((m) => JSON.parse(m[1]));
  eq(deltas.map((d) => d.chunk), ['Glowglobes ', 'drift low. ', '**The water** waits.'], 'SSE delta chunks');
  const done = JSON.parse(/event: done\ndata: (.*)\n/.exec(raw)[1]);
  eq([done.text, done.provider, done.model, done.kind, done.words], ['Glowglobes drift low. The water waits.', 'local', MODEL, 'npc', 6], 'SSE done');
  const lastReq = mock.requests.at(-1).body;
  ok(lastReq.messages[0].content.includes('chronicler') && /Never more than 60\./.test(lastReq.messages[0].content) && lastReq.messages[1].content.includes(`The NPC who speaks: ${dunePack.npcs[0].name}`), 'router passes the context to the model');
  noSecrets(JSON.stringify(lastReq), secretsOf(dunePack), 'router request');

  const j = await (await post({ ...good, kind: 'describe' }, 'application/json')).json();
  eq([j.provider, j.text], ['local', 'Glowglobes drift low. The water waits.'], 'JSON mode');

  // Busy + abort on disconnect
  mock.mode = 'hang';
  const ctrl = new AbortController();
  const hanging = await post({ ...good, kind: 'describe' }, 'text/event-stream', ctrl.signal);
  const reader = hanging.body.getReader();
  await reader.read();
  await sleep(80);
  eq((await post({ ...good, kind: 'describe' })).status, 429, 'second request while writing → 429');
  ctrl.abort();
  await sleep(200);
  eq(mock.aborted, 1, 'client disconnect aborts the upstream model request');
  mock.mode = 'normal';
  eq((await post({ ...good, kind: 'describe' }, 'application/json')).status, 200, 'after the abort the game is free again');
  games.delete(g.code);
  httpServer.close();
  httpServer = null;

  /* ── 3. Real server mount (GM_URL → the mock; then none) ───── */
  const boot = async (port, env) => {
    const p = spawn(process.execPath, ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DATA_DIR: DATA, API_TOKEN: '', TTS_URL: '', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('server start timeout')), 10000);
      p.stdout.on('data', (d) => { if (String(d).includes('ONLINE')) { clearTimeout(t); res(); } });
      p.stderr.on('data', (d) => process.stderr.write(d));
      p.on('exit', (c) => { clearTimeout(t); rej(new Error('server exited ' + c)); });
    });
    return p;
  };
  const { io } = await import('socket.io-client');
  for (const [port, env, expectLocal] of [[3195, { GM_URL: MOCK_URL, GM_MODEL: MODEL, COMFY_URL: MOCK_ROOT }, true], [3196, { GM_URL: '' }, false]]) {
    spawned = await boot(port, env);
    const URL = `http://127.0.0.1:${port}`;
    const st = await (await fetch(`${URL}/api/gm/status`)).json();
    eq(st.provider, expectLocal ? 'local' : 'none', `mounted (${expectLocal ? 'mock' : 'no GM_URL'}): /api/gm/status`);
    sock = io(URL, { transports: ['websocket'], reconnection: false });
    await new Promise((res, rej) => { sock.on('connect', res); sock.on('connect_error', rej); });
    const created = await new Promise((res) => sock.emit('create-game', { universeId: 'alien', packId: 'chariot-of-the-gods' }, res));
    ok(created.code && created.dmToken, 'game created with a pack');
    const p2 = (body, accept = 'application/json') => fetch(`${URL}/api/gm/narrate`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: accept }, body: JSON.stringify(body) });
    eq((await p2({ code: created.code, dmToken: 'bad', kind: 'scene-open' })).status, 403, 'mounted: 403 on a bad token');
    const so = await (await p2({ code: created.code, dmToken: created.dmToken, kind: 'scene-open' })).json();
    if (expectLocal) {
      eq(st.vram, { comfy: true, ollama: true }, 'mounted: status carries vram reachability');
      eq(mock.calls.slice(-2), ["POST /free", "POST /v1/chat/completions"], "mounted: the narration freed ComfyUI right before the chat request");
      eq([so.provider, so.model, so.text], ['local', MODEL, 'Glowglobes drift low. The water waits.'], 'mounted: scene-open through the mock model');
      ok(mock.requests.at(-1).body.messages[1].content.includes(`Current scene: ${alienPack.acts[0].scenes[0].name}`), 'mounted: the server loaded the pack and the current scene');
      const pr = await fetch(`${URL}/api/portrait`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ characterId: 'c-rye', universeId: 'alien', name: 'Rye' }) });
      eq(pr.status, 202, 'mounted: portrait job queued against the mock ComfyUI');
      for (let i = 0; i < 50 && !mock.calls.includes('POST /prompt'); i++) await sleep(50);
      eq(mock.unload.map((u) => u.model), mock.loaded, 'mounted: portrait unloads every Ollama model first');
      ok(mock.calls.lastIndexOf('POST /api/generate') < mock.calls.indexOf('POST /prompt'), 'mounted: unload happens before the ComfyUI prompt');
    } else {
      eq([so.provider, so.model, so.kind, so.text], ['template', 'template', 'scene-open', alienPack.acts[0].scenes[0].narration], 'mounted: scene-open template = scene 1 narration');
      const sse = await (await p2({ code: created.code, dmToken: created.dmToken, kind: 'recap-so-far' }, 'text/event-stream')).text();
      ok(/event: status\ndata: \{"provider":"template","model":"template","kind":"recap-so-far"\}/.test(sse) && /event: done\ndata: .*"provider":"template"/.test(sse), 'mounted: SSE template path');
      const npcR = await (await p2({ code: created.code, dmToken: created.dmToken, kind: 'npc', npcId: gm.npcKey(alienPack.npcs[0], 0) })).json();
      ok(npcR.text.startsWith(alienPack.npcs[0].name) && !npcR.text.includes(alienPack.npcs[0].secret), 'mounted: npc template, no secret');
    }
    sock.close(); sock = null;
    spawned.removeAllListeners('exit'); spawned.kill('SIGKILL'); spawned = null;
    await sleep(150);
  }

  console.log(`test-aigm: ${checks} checks passed`);
} finally {
  if (httpServer) httpServer.close();
  if (sock) sock.close();
  if (spawned) { spawned.removeAllListeners('exit'); spawned.kill('SIGKILL'); }
  mockServer.closeAllConnections?.();
  mockServer.close();
  await sleep(100);
  try { rmSync(DATA, { recursive: true, force: true }); } catch { /* ignore */ }
}
process.exit(0);
