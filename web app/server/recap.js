/* ═══════════════════════════════════════════════════════════════
   RECAP — the "ship's log": a short in-fiction recap of the session so
   far, written in the terminal's voice (F5). REST: /api/recap.

   POST /api/recap         body { code, dmToken }
     The GM proves it hosts the game with its dmToken. The server builds
     the PUBLIC log itself (publicLog: GM notes, secret rolls, private
     handouts/clues, GM-only clocks and pools, pauses and safety lines are
     dropped) — the client never sends log text, so nothing secret can
     reach the model or the phones.
     Default: Server-Sent Events
       event: status  data: { source: 'claude'|'template', model? }
       event: delta   data: { text }            (streamed recap text, Claude only)
       event: done    data: { text, doc, source, words, warning? }
       event: error   data: { message }
     With `Accept: application/json`: 200 { text, doc, source, words }.
   GET  /api/recap/status → { claude: bool, model }

   With ANTHROPIC_API_KEY set the recap is written by Claude
   (claude-opus-5-5, streaming, adaptive thinking); otherwise — or if the
   call fails — a deterministic templated recap in the same voice.
   `doc` = { title, from, to, priority, timestamp } — the header block the
   phones/TV render (player/HandoutDoc.jsx).
   ═══════════════════════════════════════════════════════════════ */
import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { games } from './sessions.js';
import { safeEqual } from './guard.js';
import { generatorConfig, loadEnv } from './generator/env.js';
import { loadUniverseCore } from './generator/universes.js';
import { FALLBACK_BETA } from './generator/core.js';

loadEnv();

export const RECAP_MODEL = 'claude-opus-5-5';
export const MIN_WORDS = 150;
export const MAX_WORDS = 300;
/* Template only: a short public log (fewer than SHORT_LOG entries) is not stretched to MIN_WORDS —
   it gets a "brief log" line and at least SHORT_MIN words. Stock lines are never repeated. */
export const SHORT_LOG = 8;
export const SHORT_MIN = 60;
/** The templated recap's word floor for a public log of `n` entries. */
export const minWordsFor = (n) => (n >= SHORT_LOG ? MIN_WORDS : SHORT_MIN);
const MAX_ENTRIES = 400;
const ENTRY_MAX = 300;
const ENDING_RE = /^ENDING:\s*/i;

const pcName = (p) => p?.character?.name || p?.name || 'Unknown';
const wordCount = (s) => (String(s).match(/\S+/g) || []).length;

/* ── Public log ────────────────────────────────────────────────── */

/**
 * The session log as every player at the table is allowed to know it.
 * Returns [{ at, type, text }] (oldest first, <= MAX_ENTRIES).
 */
export function publicLog(game) {
  const t = game?.table || {};
  const clues = Array.isArray(t.clues) ? t.clues : [];
  const handouts = Array.isArray(t.handouts) ? t.handouts : [];
  const clocks = Array.isArray(t.clocks) ? t.clocks : [];
  const hiddenPools = Object.values(t.poolDefs || {}).filter((d) => d && !d.visible).map((d) => String(d.label || '').toUpperCase()).filter(Boolean);
  const out = [];
  for (const e of Array.isArray(game?.log) ? game.log : []) {
    if (!e || typeof e.text !== 'string') continue;
    let text = e.text;
    switch (e.type) {
      case 'note':
        if (!ENDING_RE.test(text)) continue;           // GM notes are private; the ending reached is not
        text = `Ending reached: ${text.replace(ENDING_RE, '')}`;
        break;
      case 'pause': case 'safety':
        continue;                                       // X-card and session-zero lines never leave the GM
      case 'roll':
        if (e.secret || /^\[SECRET\]/.test(text)) continue;
        break;
      case 'clue': {
        const c = clues.find((x) => x.id === e.clueId);
        if (!c || c.status !== 'revealed' || c.revealedTo !== 'all') continue; // private or since hidden
        text = text.replace(/\s*→\s*everyone$/, '');
        break;
      }
      case 'handout': {
        const h = handouts.find((x) => x.id === e.handoutId);
        if (!h || h.recipients !== 'all') continue;     // a private handout is that player's secret
        text = text.replace(/\s*→\s*everyone$/, '');
        break;
      }
      case 'clock': {
        const c = clocks.find((x) => x.id === e.clockId);
        if (!c || c.visibility === 'gm') continue;
        break;
      }
      case 'pool':
        if (/^Pools (reset|set)/.test(text)) continue;
        if (hiddenPools.some((l) => text.toUpperCase().startsWith(l))) continue;
        break;
      case 'act':
        text = text.replace(/\s*—\s*new orders to \d+$/, '');   // agendas are private
        break;
      case 'loot':
        if (e.undo) continue;
        break;
      case 'character':
        if (/^Seat "/.test(text)) continue;
        break;
      default:
        break;
    }
    out.push({ at: e.at, type: e.type, text: text.slice(0, ENTRY_MAX) });
  }
  return out.slice(-MAX_ENTRIES);
}

/** Cast + public clocks/clues: the facts the recap may mention besides the log. */
export function publicFacts(game) {
  const t = game?.table || {};
  const players = game?.players instanceof Map ? [...game.players.values()] : Object.values(game?.players || {});
  return {
    cast: players.filter((p) => p.character).map((p) => ({ name: pcName(p), career: p.character.career || '', alive: p.alive !== false })),
    clocks: (t.clocks || []).filter((c) => c.visibility !== 'gm').map((c) => ({ label: c.label, filled: c.filled, segments: c.segments })),
    clues: (t.clues || []).filter((c) => c.status === 'revealed' && c.revealedTo === 'all').map((c) => String(c.text).slice(0, 200)),
  };
}

/* ── Voice ─────────────────────────────────────────────────────── */

const VOICES = {
  alien: {
    title: "SHIP'S LOG",
    open: (u, d) => `${u.terminal.name} // ${d.code ? `SESSION ${d.code} // ` : ''}LOG ENTRY COMPILED FOR CREW DISTRIBUTION.`,
    cast: (names) => `CREW ON RECORD: ${names}.`,
    noCast: 'CREW MANIFEST: NO PERSONNEL ASSIGNED.',
    places: (list) => `OPERATIONS LOGGED IN SEQUENCE: ${list}.`,
    told: (n) => `${n} ADVISORY TRANSMISSION${n === 1 ? '' : 'S'} RELAYED TO CREW TERMINALS.`,
    rolls: (n) => `${n} CREW ACTION${n === 1 ? '' : 'S'} REGISTERED BY SHIP SENSORS.`,
    stress: 'ELEVATED STRESS READINGS DETECTED IN CREW BIOMETRICS.',
    panic: (names) => `PANIC RESPONSE RECORDED: ${names}.`,
    injury: (list) => `MEDICAL EVENTS: ${list}.`,
    kill: (names) => `LIFE SIGNS TERMINATED: ${names}. CREW COMPLEMENT REDUCED.`,
    fog: (list) => `COMPARTMENTS SURVEYED: ${list}.`,
    clues: (list) => `DATA RECOVERED: ${list}.`,
    clocks: (list) => `COUNTDOWNS ACTIVE: ${list}.`,
    handouts: (list) => `DOCUMENTS ISSUED: ${list}.`,
    loot: (n) => `${n} ITEM TRANSFER${n === 1 ? '' : 'S'} LOGGED TO CREW INVENTORY.`,
    ending: (x) => `OUTCOME RECORDED: ${x}.`,
    brief: (n) => (n ? `LOG IS BRIEF: ${n} EVENT${n === 1 ? '' : 'S'} ON RECORD SINCE SESSION START.` : 'NO EVENTS ON RECORD SINCE SESSION START. SENSORS NOMINAL.'),
    filler: [
      'ALL TIMES ARE SHIP TIME. RECORD INTEGRITY VERIFIED.',
      'NO FURTHER ANOMALIES ARE CLASSIFIED FOR CREW DISTRIBUTION AT THIS TIME.',
      'CREW ARE REMINDED THAT SHIP SYSTEMS MONITOR ALL DECKS AT ALL TIMES.',
      'SPECIAL ORDERS, IF ANY, REMAIN SEALED. THIS LOG CONTAINS NONE.',
      'MAINTAIN SHIP DISCIPLINE. REPORT IRREGULARITIES TO THE DUTY OFFICER.',
      'THIS ENTRY WILL BE APPENDED TO THE PERMANENT FLIGHT RECORD.',
    ],
    close: (u) => `END OF ENTRY. ${u.terminal.name} STANDING BY.`,
    lead: 'Write as the ship computer: clipped, uppercase-flavoured log language, procedural and calm even when people die, small cold details. Plain sentences, no markdown.',
  },
  dune: {
    title: 'CHRONICLE OF THE HOUSE',
    open: (u, d) => `Set down by the ${u.terminal.name} of the House${d.code ? `, audience ${d.code}` : ''}, for the eyes of its sworn agents.`,
    cast: (names) => `Those who served: ${names}.`,
    noCast: 'No agent has yet sworn to this audience.',
    places: (list) => `The record follows their path: ${list}.`,
    told: (n) => `${n} time${n === 1 ? '' : 's'} the Narrator gave voice to what passed.`,
    rolls: (n) => `${n} test${n === 1 ? '' : 's'} of skill and will were weighed.`,
    stress: 'Strain was marked upon more than one agent of the House.',
    panic: (names) => `Composure broke in ${names}.`,
    injury: (list) => `Wounds were taken: ${list}.`,
    kill: (names) => `The House mourns ${names}. Their water returns to the tribe.`,
    fog: (list) => `Places uncovered: ${list}.`,
    clues: (list) => `What was learned: ${list}.`,
    clocks: (list) => `Plots still turning: ${list}.`,
    handouts: (list) => `Documents passed hand to hand: ${list}.`,
    loot: (n) => `${n} possession${n === 1 ? '' : 's'} changed hands.`,
    ending: (x) => `So it ended: ${x}.`,
    brief: (n) => (n ? `The audience is young; ${n} event${n === 1 ? '' : 's'} stand${n === 1 ? 's' : ''} in the record so far.` : 'Nothing yet stands in the record of this audience; the chronicle waits.'),
    filler: [
      'A Mentat records what is, not what is wished.',
      'Every plan conceals another; this chronicle records only what the agents themselves witnessed.',
      'What the Landsraad will make of these events is not yet computed.',
      'The spice flows; the House endures; the record is kept.',
      'Let each agent weigh these lines before the next audience.',
      'Further projections are withheld until more data arrives.',
    ],
    close: (u) => `Thus the ${u.terminal.name} closes the chronicle for this audience.`,
    lead: 'Write as a Mentat chronicler of a Great House: measured, formal, a little archaic, precise about consequences. Plain prose, no markdown.',
  },
};
const DEFAULT_VOICE = {
  ...VOICES.alien,
  title: 'SESSION LOG',
  open: (u, d) => `${u.terminal.name}${d.code ? ` // SESSION ${d.code}` : ''} // LOG ENTRY.`,
  lead: 'Write as the game\'s terminal persona: concise, in-world, plain sentences, no markdown.',
};
export const voiceFor = (universe) => VOICES[universe?.id] || DEFAULT_VOICE;

const listOf = (arr, max = 4) => {
  const u = [...new Set(arr.filter(Boolean).map((s) => String(s).replace(/[.;:,\s]+$/, '')))];
  return u.length > max ? `${u.slice(0, max).join('; ')} and ${u.length - max} more` : u.join('; ');
};
const stamp = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString().replace('T', ' ').slice(0, 16) : '');

/** Header block for the handout document. Deterministic for a given game state. */
export function recapDoc(universe, game, entries) {
  const v = voiceFor(universe);
  const last = entries.length ? entries[entries.length - 1].at : game?.createdAt;
  return {
    title: v.title,
    from: String(universe?.terminal?.name || 'TERMINAL'),
    to: String(universe?.terms?.players || 'Crew').toUpperCase(),
    priority: String(universe?.terms?.priorities?.[0] || 'STANDARD'),
    timestamp: stamp(last),
  };
}

/**
 * Deterministic recap in the terminal's voice (no API key / API failure).
 * Same game state → same text. At most MAX_WORDS; at least minWordsFor(entries.length) when the
 * voice has enough distinct stock lines (each is used at most once, so nothing reads twice).
 */
export function templatedRecap(universe, game, entries = publicLog(game), facts = publicFacts(game)) {
  const v = voiceFor(universe);
  const u = { terminal: { name: universe?.terminal?.name || 'TERMINAL' } };
  const of = (type) => entries.filter((e) => e.type === type);
  const lines = [v.open(u, { code: game?.code })];
  lines.push(facts.cast.length ? v.cast(listOf(facts.cast.map((c) => `${c.name}${c.career ? ` (${c.career})` : ''}`), 6)) : v.noCast);
  const places = entries.filter((e) => e.type === 'act' || (e.type === 'scene' && /^Scene:/.test(e.text)))
    .map((e) => e.text.replace(/^Scene:\s*/, '').replace(/\s+begins$/, ''));
  if (places.length) lines.push(v.places(listOf(places, 5)));
  const narr = of('narration').length;
  if (narr) lines.push(v.told(narr));
  const rolls = of('roll').filter((e) => !/^GM asked/.test(e.text)).length;
  if (rolls) lines.push(v.rolls(rolls));
  if (of('track').some((e) => /STRESS \d+ → \d+/.test(e.text))) lines.push(v.stress);
  const panics = of('panic').map((e) => e.text.split(' PANIC')[0]);
  if (panics.length) lines.push(v.panic(listOf(panics)));
  const injuries = of('injury').filter((e) => !/healed/.test(e.text)).map((e) => e.text);
  if (injuries.length) lines.push(v.injury(listOf(injuries, 3)));
  const kills = of('kill').map((e) => e.text.replace(/\s*\(.*\)\s*was killed$/, '').replace(/ was killed$/, ''));
  if (kills.length) lines.push(v.kill(listOf(kills)));
  const rooms = of('fog').map((e) => e.text.replace(/^Revealed:\s*/, ''));
  if (rooms.length) lines.push(v.fog(listOf(rooms, 6)));
  if (facts.clues.length) lines.push(v.clues(listOf(facts.clues, 3)));
  const docs = of('handout').map((e) => (/"([^"]+)"/.exec(e.text) || [])[1]);
  if (docs.length) lines.push(v.handouts(listOf(docs, 4)));
  const loot = of('loot').length;
  if (loot) lines.push(v.loot(loot));
  if (facts.clocks.length) lines.push(v.clocks(listOf(facts.clocks.map((c) => `${c.label} ${c.filled}/${c.segments}`), 4)));
  const endings = of('note').map((e) => e.text.replace(/^Ending reached:\s*/, ''));
  if (endings.length) lines.push(v.ending(endings[endings.length - 1]));

  const close = v.close(u);
  const floor = minWordsFor(entries.length);
  if (entries.length < SHORT_LOG && v.brief) lines.push(v.brief(entries.length));
  // Pad with in-voice stock lines, each at most once (start point picked from the session code so
  // different sessions do not open their padding the same way), up to the floor.
  const pad = v.filler || [];
  const start = pad.length ? [...String(game?.code || '')].reduce((s, ch) => s + ch.charCodeAt(0), 0) % pad.length : 0;
  for (let i = 0; i < pad.length && wordCount(`${lines.join(' ')} ${close}`) < floor; i++) {
    lines.push(pad[(start + i) % pad.length]);
  }
  let text = `${lines.join(' ')} ${close}`;
  // Trim from the end of the body (keep the sign-off) down to MAX_WORDS.
  if (wordCount(text) > MAX_WORDS) {
    const closeWords = wordCount(close);
    const body = text.slice(0, text.length - close.length).trim().split(/\s+/).slice(0, MAX_WORDS - closeWords - 1).join(' ');
    text = `${body.replace(/[;,:]?$/, '')}… ${close}`;
  }
  return text;
}

/* ── Claude ────────────────────────────────────────────────────── */

/** System prompt: the terminal's voice + the hard rules. Given ONLY the public record. */
export function buildRecapSystem(universe) {
  const v = voiceFor(universe);
  const name = universe?.terminal?.name || 'the terminal';
  return [
    `You are ${name}, the in-world computer persona of a tabletop role-playing game (${universe?.name || 'a role-playing game'}). `,
    `Write the "${v.title}": a recap of tonight's session so far, which will be sent to every player's phone and may be read aloud.`,
    '',
    v.lead,
    '',
    'Rules:',
    `- ${MIN_WORDS} to ${MAX_WORDS} words. One to four short paragraphs. No headings, lists, markdown or emoji.`,
    '- Use only facts present in the public record you are given. Do not invent outcomes, motives, names, places or hidden causes, and do not speculate about secrets, traitors or what the game master might be hiding.',
    '- The record is everything the players are allowed to know. If something is not in it, it did not happen as far as this log is concerned.',
    '- Refer to player characters by their character names. Never mention dice mechanics by name beyond what the record says, game masters, safety tools or pauses.',
    '- End with a one-line sign-off in the persona\'s voice.',
    '- Original prose only: do not quote or imitate lines from films, novels or published game books.',
  ].join('\n');
}

/** User turn: the public record, as plain lines. */
export function buildRecapUser(universe, game, entries, facts) {
  const lines = [];
  lines.push(`Session code: ${game?.code || '—'}`);
  lines.push(`Cast: ${facts.cast.length ? facts.cast.map((c) => `${c.name}${c.career ? ` (${c.career})` : ''}${c.alive ? '' : ' [deceased]'}`).join(', ') : 'none assigned'}`);
  if (facts.clocks.length) lines.push(`Visible clocks: ${facts.clocks.map((c) => `${c.label} ${c.filled}/${c.segments}`).join(', ')}`);
  if (facts.clues.length) lines.push(`Clues the whole table found: ${facts.clues.join(' | ')}`);
  lines.push('');
  lines.push('Public record (oldest first; type: text):');
  for (const e of entries) lines.push(`- ${e.type}: ${e.text}`);
  if (!entries.length) lines.push('- (nothing has happened yet)');
  lines.push('');
  lines.push(`Write the ${voiceFor(universe).title} now.`);
  return lines.join('\n');
}

/**
 * Generate the recap. Uses Claude when an API key is configured (or a `client` is injected,
 * as the tests do with a fake), else the template. onDelta(textSoFar) streams Claude's text.
 * → { text, doc, source: 'claude'|'template', words, warning? }
 */
export async function generateRecap({ universe, game, onDelta = () => {}, onStatus = () => {}, signal, client, apiKey } = {}) {
  const entries = publicLog(game);
  const facts = publicFacts(game);
  const doc = recapDoc(universe, game, entries);
  const key = apiKey !== undefined ? apiKey : generatorConfig().apiKey;
  const template = () => templatedRecap(universe, game, entries, facts);
  if (!client && !key) {
    onStatus({ source: 'template' });
    const text = template();
    return { text, doc, source: 'template', words: wordCount(text) };
  }
  onStatus({ source: 'claude', model: RECAP_MODEL });
  try {
    const c = client || new Anthropic({ apiKey: key, timeout: 5 * 60 * 1000, maxRetries: 2 });
    const cfg = generatorConfig();
    const request = {
      model: RECAP_MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: buildRecapSystem(universe),
      messages: [{ role: 'user', content: buildRecapUser(universe, game, entries, facts) }],
    };
    if (cfg.fallbacks) { request.betas = [FALLBACK_BETA]; request.fallbacks = 'default'; }
    const stream = c.beta.messages.stream(request, { signal });
    let text = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        text += event.delta.text;
        onDelta(text);
      }
    }
    const message = await stream.finalMessage();
    if (message?.stop_reason === 'refusal') throw new Error('The model declined to write this recap.');
    const final = (message?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim() || text.trim();
    if (!final) throw new Error('Empty recap.');
    return { text: final, doc, source: 'claude', words: wordCount(final) };
  } catch (e) {
    if (signal?.aborted) throw e;
    console.warn(`[RECAP] Claude call failed, using the template: ${e?.message || e}`);
    const text = template();
    return { text, doc, source: 'template', words: wordCount(text), warning: 'Claude was unavailable; this is the templated log.' };
  }
}

/* ── Router ────────────────────────────────────────────────────── */

const inflight = new Set(); // game codes with a recap running

export function createRecapRouter() {
  const router = Router();

  router.get('/status', (req, res) => {
    const cfg = generatorConfig();
    res.json({ claude: !!cfg.apiKey, model: cfg.apiKey ? RECAP_MODEL : 'template' });
  });

  router.post('/', async (req, res) => {
    const code = String(req.body?.code || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    const game = code ? games.get(code) : null;
    if (!game || !safeEqual(String(req.body?.dmToken || ''), String(game.dmToken || ''))) {
      return res.status(403).json({ error: 'not_authorized', message: 'Only the GM of this session can write its log.' });
    }
    if (inflight.has(code)) return res.status(429).json({ error: 'busy', message: 'A recap is already being written.' });
    const universe = (await loadUniverseCore(game.universeId)) || { id: game.universeId, terminal: { name: 'TERMINAL' }, terms: {} };

    const accept = String(req.headers.accept || '');
    const sse = accept.includes('text/event-stream') || !accept.includes('application/json');
    const controller = new AbortController();
    let finished = false;
    res.on('close', () => { if (!finished) controller.abort(); });
    inflight.add(code);

    if (!sse) {
      try {
        res.json(await generateRecap({ universe, game, signal: controller.signal }));
      } catch (e) {
        if (!res.headersSent && !controller.signal.aborted) res.status(500).json({ error: 'internal', message: e.message });
      } finally { finished = true; inflight.delete(code); }
      return;
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    const send = (event, data) => { if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
    res.write(': connected\n\n');
    const keepalive = setInterval(() => { if (!res.writableEnded) res.write(': keepalive\n\n'); }, 15000);
    let lastAt = 0;
    try {
      const result = await generateRecap({
        universe, game, signal: controller.signal,
        onStatus: (s) => send('status', s),
        onDelta: (text) => { const now = Date.now(); if (now - lastAt >= 120) { lastAt = now; send('delta', { text }); } },
      });
      send('done', result);
    } catch (e) {
      if (!controller.signal.aborted) send('error', { message: e?.message || 'Recap failed.' });
    } finally {
      finished = true;
      inflight.delete(code);
      clearInterval(keepalive);
      if (!res.writableEnded) res.end();
    }
  });

  router.all('/', (req, res) => res.status(405).json({ error: 'Use POST /api/recap.' }));
  return router;
}

export default createRecapRouter;
