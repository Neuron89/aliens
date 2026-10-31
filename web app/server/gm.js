/* ═══════════════════════════════════════════════════════════════
   AI GM — read-aloud narration drafted for the GM (docs/AI_GM.md).
   REST: /api/gm (mounted in server/index.js behind requireApiToken).

   Provider: any OpenAI-compatible chat endpoint, by default Ollama on the GPU box
   (env GM_URL e.g. http://192.168.1.37:11434/v1, GM_MODEL, optional GM_API_KEY bearer).
   Streams POST ${GM_URL}/chat/completions (stream:true). No GM_URL, an unreachable
   server or a failed call → a template built from the pack's own text.

   GET  /api/gm/status  → { ok, provider:'local'|'none', model, url, warning? }
        (probes GET ${GM_URL}/models, 3 s timeout, cached 60 s; ?fresh=1 re-probes)
   POST /api/gm/narrate body { code, dmToken, kind, prompt?, npcId?, maxWords? }
     kind: 'scene-open'   open the current scene for the players
           'describe'     where they are now (rooms, who stands where, what is visible)
           'npc'          an NPC from pack.npcs speaks in character (npcId = index,
                          slug of the name, or the exact name; see npcKey())
           'improv'       free prompt from the GM ("they cut the power") — prompt required
           'recap-so-far' what has happened so far, for latecomers
     maxWords: 40..200 (default 110; the drawer offers 60 / 110 / 160).
     Auth: safeEqual(dmToken, game.dmToken) like /api/recap → 403 otherwise;
     400 bad_kind / prompt_required / prompt_too_long / unknown_npc; 429 busy.
     Default: Server-Sent Events
       event: status data: { provider:'local'|'template', model, kind }
       event: delta  data: { text, chunk }   text = the draft so far, chunk = the new piece
       event: done   data: { text, provider, model, kind, words, warning? }
       event: error  data: { message }
     With `Accept: application/json`: 200 { text, provider, model, kind, words, warning? }.
     A client disconnect aborts the upstream request.

   The GM always reviews the draft before anything reaches the TV or phones:
   this module never emits to sockets. The context (gmContext) is built on the
   server from the session itself: the pack (runtime override or bundled),
   table.run's act/scene, the board (PC tokens, revealed rooms, visible tokens),
   public clocks/clues and the last public log lines (recap.js publicLog).
   NPC secrets, act gmNotes/agendaNotes, room notes, hidden clues, endings,
   character secrets and scene checks/outcomes are NEVER put into the prompt.
   Without a provider (or on failure) the template is returned, provider:'template'.
   ═══════════════════════════════════════════════════════════════ */
import { Router } from 'express';
import { readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { games } from './sessions.js';
import { safeEqual } from './guard.js';
import { loadEnv } from './generator/env.js';
import { loadUniverseCore, bundledPackFiles } from './generator/universes.js';
import { CONTENT_DIR } from './content.js';
import { publicLog, publicFacts } from './recap.js';
import { releaseForLlm, vramReach, comfyBase, ollamaRoot } from './vram.js';

loadEnv();

export const KINDS = Object.freeze(['scene-open', 'describe', 'npc', 'improv', 'recap-so-far']);
export const DEFAULT_WORDS = 110;
export const MIN_MAX_WORDS = 40;
export const MAX_MAX_WORDS = 200;
export const PROMPT_MAX = 600;
const LOG_LINES = 15;
const RECAP_LOG_LINES = 40;

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const wordCount = (s) => (String(s || '').match(/\S+/g) || []).length;
const clampWords = (n) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) && v > 0 ? Math.min(MAX_MAX_WORDS, Math.max(MIN_MAX_WORDS, v)) : DEFAULT_WORDS;
};
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const arr = (v) => (Array.isArray(v) ? v : []);
const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Stable NPC key used by the drawer's picker: the slug of the name (index as a last resort). */
export const npcKey = (npc, i) => slug(npc?.name) || String(i);

/** Find an NPC by index ("2"), slug ("lady-senna-tessarin") or exact name. */
export function findNpc(pack, npcId) {
  const list = arr(pack?.npcs);
  if (npcId === undefined || npcId === null || npcId === '') return null;
  const id = String(npcId);
  if (/^\d+$/.test(id) && list[Number(id)]) return list[Number(id)];
  return list.find((n, i) => npcKey(n, i) === id || n?.name === id) || null;
}

/* ── Pack loading (server side; the client bundles its own copy) ── */

const packCache = new Map(); // file → { mtime, pack }
function readPackFile(file) {
  try {
    const mtime = statSync(file).mtimeMs;
    const hit = packCache.get(file);
    if (hit && hit.mtime === mtime) return hit.pack;
    const pack = JSON.parse(readFileSync(file, 'utf8'));
    packCache.set(file, { mtime, pack });
    return pack;
  } catch { return null; }
}

/** The session's pack: a runtime pack (content/<universe>/<id>.json) overrides the bundled one. */
export function loadPackFor(universeId, packId) {
  if (!ID_RE.test(String(universeId || '')) || !ID_RE.test(String(packId || ''))) return null;
  const runtime = join(CONTENT_DIR, universeId, `${packId}.json`);
  if (existsSync(runtime)) {
    const p = readPackFile(runtime);
    if (p && p.id === packId && p.universe === universeId) return p;
  }
  for (const f of bundledPackFiles(universeId)) {
    const p = readPackFile(f);
    if (p && p.id === packId) return p;
  }
  return null;
}

/* ── Voice ─────────────────────────────────────────────────────── */

const PERSONAS = {
  alien: {
    id: 'alien',
    who: 'the narrating voice of an ALIEN role-playing game session, the cold presence that tells the crew what their senses report',
    tone: [
      'Present tense, second person ("you"), addressed to the crew as a group or to a named character.',
      'Short, sparse sentences. Concrete sensory detail: condensation, recycled air, the tick of cooling metal, emergency strobes, a sound that stops too soon.',
      'Dread through restraint. Suggest; never show the monster in full. Corporate indifference hums under everything.',
      'No heroics, no jokes, no exclamation marks.',
    ],
    npc: 'Spoken lines only, in the NPC\'s own voice: clipped, working-class spacer talk or corporate politeness as fits the role.',
  },
  dune: {
    id: 'dune',
    who: 'the chronicler of a Great House in a DUNE role-playing game session, a formal voice in the manner of an Imperial historian or a Mentat setting events down',
    tone: [
      'Formal, measured and layered; long sentences balanced by short, weighted ones. Present tense for the scene, addressed to the agents of the House.',
      'Every surface hides a second meaning: courtesy as a weapon, water as wealth, silence as a message. Note what is unsaid.',
      'Concrete details of Arrakis and the Imperium: heat, dust, stillsuits, glowglobes, the weight of protocol and debt.',
      'Gravity over spectacle. No modern slang, no jokes, no exclamation marks.',
    ],
    npc: 'Spoken lines only, in the NPC\'s own voice: courtly, guarded, every phrase chosen with care for who might be listening.',
  },
};
const DEFAULT_PERSONA = {
  id: 'default',
  who: 'the narrator of a tabletop role-playing game session',
  tone: ['Present tense, second person, vivid and concise.', 'Concrete sensory detail; let tension build through what is noticed.'],
  npc: 'Spoken lines only, in the NPC\'s own voice.',
};
export const personaFor = (universeId) => PERSONAS[universeId] || DEFAULT_PERSONA;

const TASKS = {
  'scene-open': 'Open the current scene for the players: set where they are and what they perceive as it begins, building from the scene\'s read-aloud text. End on a moment that invites them to act.',
  describe: 'Describe where the characters are right now: the rooms they occupy, who stands where, and what they can see or hear around them. Only places marked as known may be named.',
  npc: 'Write what the named NPC says aloud to the characters right now, in character, as first-person speech. Words only: no narration around it, no quotation marks, no name tag.',
  improv: 'The game master needs narration for something that just happened at the table (described below). Narrate it in the moment, grounded in the current scene.',
  'recap-so-far': 'Tell what has happened so far tonight, for a player who has just joined: a short spoken "previously" that orients them and ends in the present moment. Use only the public record.',
};

/* ── Context ───────────────────────────────────────────────────── */

const playersOf = (game) => (game?.players instanceof Map ? [...game.players.values()] : Object.values(game?.players || {}));
const pcName = (p) => p?.character?.name || p?.name || 'Unknown';

/** Where every PC token stands, the known rooms, and the visible non-PC tokens (no GM notes). */
export function boardFacts(game) {
  const b = game?.board;
  const md = game?.mapDef;
  const players = playersOf(game);
  if (!b || typeof b !== 'object') return { map: null, pcs: [], known: [], visible: [] };
  const roomsSt = b.rooms || {};
  const defRooms = arr(md?.rooms);
  const roomName = (id) => (id ? (roomsSt[id]?.name || defRooms.find((r) => r.id === id)?.name || null) : null);
  const isKnown = (id) => !!id && (!b.fog || !!roomsSt[id]?.revealed);
  const tokens = Object.values(b.tokens || {}).filter((t) => t && typeof t === 'object');
  const pcs = tokens.filter((t) => t.kind === 'pc' && !t.hidden).map((t) => {
    const owner = t.ownerPlayerId ? players.find((p) => p.id === t.ownerPlayerId) : null;
    return { name: clip(owner?.character?.name || t.label || owner?.name || 'Unknown', 60), room: isKnown(t.roomId) ? roomName(t.roomId) : null };
  });
  const known = defRooms.filter((r) => isKnown(r.id)).map((r) => clip(roomName(r.id), 80)).filter(Boolean).slice(0, 30);
  const visible = tokens.filter((t) => t.kind !== 'pc' && !t.hidden && (!t.roomId || isKnown(t.roomId)) && (t.label || '').trim())
    .map((t) => ({ label: clip(t.label, 60), kind: t.kind, room: isKnown(t.roomId) ? roomName(t.roomId) : null })).slice(0, 20);
  return { map: md?.title ? clip(md.title, 120) : null, pcs, known, visible };
}

/** The current act/scene from table.run (indices clamped to the pack). */
export function currentScene(game, pack) {
  const run = game?.table?.run || {};
  const acts = arr(pack?.acts);
  const ai = Math.min(Math.max(0, Number.isInteger(run.actIndex) ? run.actIndex : 0), Math.max(0, acts.length - 1));
  const act = acts[ai] || null;
  const scenes = arr(act?.scenes);
  const si = Math.min(Math.max(0, Number.isInteger(run.sceneIndex) ? run.sceneIndex : 0), Math.max(0, scenes.length - 1));
  return { act, scene: scenes[si] || null, actIndex: ai, sceneIndex: si };
}

/**
 * Pure: everything the model is given for one narration. opts = { pack, universe, npcId, prompt, maxWords }.
 * → { kind, maxWords, persona, system, user, npc, act, scene }
 * The prompt carries the pack's PUBLIC-facing and stage-direction text only; see the header for what is excluded.
 */
export function gmContext(game, kind, opts = {}) {
  const k = KINDS.includes(kind) ? kind : 'scene-open';
  const maxWords = clampWords(opts.maxWords);
  const minWords = Math.max(20, Math.round(maxWords * 0.6));
  const pack = opts.pack || null;
  const universe = opts.universe || { id: game?.universeId };
  const persona = personaFor(universe?.id || game?.universeId);
  const { act, scene } = currentScene(game, pack);
  const npc = k === 'npc' ? findNpc(pack, opts.npcId) : null;
  const prompt = clip(opts.prompt, PROMPT_MAX);
  const facts = publicFacts(game);
  const bf = boardFacts(game);
  const log = publicLog(game).slice(-(k === 'recap-so-far' ? RECAP_LOG_LINES : LOG_LINES));
  const t = game?.table || {};

  const system = [
    `You are ${persona.who}${universe?.name ? ` (${universe.name})` : ''}. The game master will read your words aloud to the players, or send them to the table screen and a voice.`,
    '',
    'Voice:',
    ...persona.tone.map((l) => `- ${l}`),
    ...(k === 'npc' ? [`- ${persona.npc}`] : []),
    '',
    'Output rules:',
    `- Between ${minWords} and ${maxWords} words. Never more than ${maxWords}.`,
    '- Spoken prose ready to read aloud, one to three short paragraphs. No markdown, no headings, no lists, no emoji, no quotation marks around the whole text.',
    '- No stage directions, bracketed notes, sound cues or speaker labels. No dice, rolls, difficulties, skills, stats or any game mechanics.',
    '- Never address the game master. Never offer options, ask the GM questions, or comment on the text.',
    '- Never decide what the player characters do, say, think or feel. Describe the world and the NPCs; leave the characters\' choices to the players.',
    '- Some material you are given is for the game master only (scene events, NPC guidance, GM tips). Let it shape mood and detail, but never state hidden facts, secrets, twists, true identities, motives the characters have not discovered, or how the story ends. When in doubt, describe what can be seen and heard, not what it means.',
    '- Name only places the characters know, characters present in the record, and things the context marks as visible.',
    '- Original prose only: do not quote or imitate lines from films, novels or published game books.',
  ].join('\n');

  const L = [];
  L.push(`TASK (${k}): ${TASKS[k]}`);
  if (k === 'improv') L.push(`What just happened at the table: ${prompt || '(the game master gave no detail: narrate a small, tense change in the current scene)'}`);
  else if (prompt) L.push(`Game master's note for this narration: ${prompt}`);
  L.push('');
  if (pack?.meta) {
    L.push(`Scenario: ${clip(pack.meta.title, 120)}${pack.meta.tagline ? ` — ${clip(pack.meta.tagline, 240)}` : ''}`);
    if (pack.meta.tone) L.push(`Tone: ${clip(pack.meta.tone, 300)}`);
    if (pack.meta.setting) L.push(`Setting: ${clip(pack.meta.setting, 400)}`);
  }
  if (act) {
    L.push(`Current act: ${clip(act.title, 80)}${act.subtitle ? ` — ${clip(act.subtitle, 120)}` : ''}`);
    if (act.summary) L.push(`Act summary (GM only): ${clip(act.summary, 500)}`);
  }
  if (scene) {
    L.push(`Current scene: ${clip(scene.name, 120)}`);
    if (scene.narration) L.push(`Scene read-aloud text: ${clip(scene.narration, 1500)}`);
    if (arr(scene.events).length) L.push(`Scene events (GM only): ${arr(scene.events).slice(0, 8).map((e) => clip(e, 300)).join(' | ')}`);
    if (scene.encounterDetail) L.push(`Encounter detail (GM only): ${clip(scene.encounterDetail, 800)}`);
    if (scene.npcGuidance) L.push(`NPC guidance (GM only): ${clip(scene.npcGuidance, 600)}`);
    if (scene.gmTip) L.push(`GM tip (GM only): ${clip(scene.gmTip, 500)}`);
  } else if (act && arr(act.readAloud).length && k === 'scene-open') {
    L.push(`Act read-aloud text: ${arr(act.readAloud).map((r) => clip(r, 800)).join(' ')}`);
  }
  if (!pack) L.push('No scenario pack: this is a free-form session. Work from the record below.');
  L.push('');
  L.push(`Player characters: ${facts.cast.length ? facts.cast.map((c) => `${c.name}${c.career ? ` (${c.career})` : ''}${c.alive ? '' : ' [dead]'}`).join(', ') : 'none assigned yet'}`);
  if (bf.map) L.push(`Map: ${bf.map}`);
  if (bf.pcs.length) L.push(`Where they stand: ${bf.pcs.map((p) => `${p.name} — ${p.room || 'between rooms'}`).join('; ')}`);
  if (bf.known.length) L.push(`Known places: ${bf.known.join(', ')}`);
  if (bf.visible.length) L.push(`Visible on the board: ${bf.visible.map((v) => `${v.label} (${v.kind}${v.room ? `, ${v.room}` : ''})`).join('; ')}`);
  if (facts.clocks.length) L.push(`Visible countdowns: ${facts.clocks.map((c) => `${c.label} ${c.filled}/${c.segments}`).join(', ')}`);
  if (facts.clues.length) L.push(`What the whole table has discovered: ${facts.clues.join(' | ')}`);
  if (t.narration?.text) L.push(`On the table screen now: ${clip(`${t.narration.title ? t.narration.title + ': ' : ''}${t.narration.text}`, 600)}`);
  if (npc) {
    L.push('');
    L.push(`The NPC who speaks: ${clip(npc.name, 80)}${npc.role ? `, ${clip(npc.role, 120)}` : ''}`);
    if (npc.behavior) L.push(`Manner: ${clip(npc.behavior, 500)}`);
    if (npc.agenda) L.push(`What they want (GM only, do not state it outright): ${clip(npc.agenda, 400)}`);
  }
  L.push('');
  L.push(`Recent public record (oldest first):${log.length ? '' : ' nothing yet.'}`);
  for (const e of log) L.push(`- ${e.type}: ${e.text}`);
  L.push('');
  L.push(`Write the narration now: ${minWords}-${maxWords} words, read-aloud prose only.`);

  return { kind: k, maxWords, persona: persona.id, system, user: L.join('\n'), npc, act, scene };
}

/* ── Template (no key / failure) ───────────────────────────────── */

const theRoom = (r) => (/^(the|a|an)\s/i.test(r) || /'s\b/.test(r) ? r : `the ${r}`);
const listAnd = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const STOCK = {
  alien: {
    generic: 'The air handlers cycle. Somewhere below the deck plating, metal ticks as it cools. Every light you can see is working. That should be a comfort.',
    improv: 'For a heartbeat nothing moves. Then the ship answers, the way it always does: a vent exhales, a strobe stutters, and the silence afterward is louder than before.',
    recapOpen: 'Here is where things stand.',
    recapNone: 'Nothing has been logged yet. The shift has only just begun.',
    describeNone: 'Your position is not on the plan yet. The corridor lights run ahead of you and stop where the plan ends.',
  },
  dune: {
    generic: 'The heat presses at the walls like a patient creditor. Glowglobes drift in their slow orbits. Every courtesy in this place has a price, and the price is not yet named.',
    improv: 'Let the record show that the moment turned here. Faces arrange themselves; hands go still near belts; somewhere a servant decides which master to warn first.',
    recapOpen: 'Let the record be read for those who arrive late.',
    recapNone: 'The record of this audience is still empty; the first page waits.',
    describeNone: 'The agents\' places in the keep are not yet set down in the record.',
  },
};
const stockFor = (id) => STOCK[id] || STOCK.alien;

/** Deterministic narration from the pack's own text. Never empty. */
export function templateNarration(game, kind, opts = {}) {
  const ctx = gmContext(game, kind, opts);
  const s = stockFor(ctx.persona === 'default' ? 'alien' : ctx.persona);
  const pack = opts.pack || null;
  let text = '';
  switch (ctx.kind) {
    case 'scene-open':
      text = ctx.scene?.narration || arr(ctx.act?.readAloud).join('\n\n') || pack?.meta?.tagline || s.generic;
      break;
    case 'describe': {
      const bf = boardFacts(game);
      const byRoom = new Map();
      for (const p of bf.pcs) { const r = p.room || ''; byRoom.set(r, [...(byRoom.get(r) || []), p.name]); }
      const lines = [];
      const rooms = [...byRoom.keys()].filter(Boolean);
      if (rooms.length === 1 && byRoom.size === 1) lines.push(`You are in ${theRoom(rooms[0])}.`);
      else for (const [room, names] of byRoom) lines.push(room ? `${listAnd(names)} ${names.length === 1 ? 'is' : 'are'} in ${theRoom(room)}.` : `${listAnd(names)} ${names.length === 1 ? 'is' : 'are'} between rooms.`);
      const seen = bf.visible.map((v) => `${v.label}${v.room ? ` in ${theRoom(v.room)}` : ''}`);
      if (seen.length) lines.push(`You can see ${listAnd(seen.slice(0, 6))}.`);
      const others = bf.known.filter((r) => !rooms.includes(r));
      if (others.length) lines.push(`Already known: ${listAnd(others.slice(0, 8))}.`);
      if (!lines.length) lines.push(s.describeNone);
      if (ctx.scene?.narration) lines.push(ctx.scene.narration);
      text = lines.join(' ');
      break;
    }
    case 'npc': {
      const n = ctx.npc;
      text = n ? [`${n.name}${n.role ? `, ${n.role}` : ''}.`, n.behavior, n.agenda].filter(Boolean).join(' ') : s.generic;
      break;
    }
    case 'improv': {
      const p = clip(opts.prompt, PROMPT_MAX).replace(/[.!?]*$/, '');
      text = p ? `${p.charAt(0).toUpperCase()}${p.slice(1)}. ${s.improv}` : s.improv;
      break;
    }
    case 'recap-so-far': {
      const facts = publicFacts(game);
      const log = publicLog(game);
      const pick = log.filter((e) => ['scene', 'narration', 'clue', 'fog', 'kill', 'handout', 'act'].includes(e.type)).slice(-6)
        .map((e) => e.text.replace(/^Scene:\s*/, '').replace(/[.\s]+$/, ''));
      const lines = [s.recapOpen];
      if (facts.cast.length) lines.push(`${listAnd(facts.cast.map((c) => c.name))} ${facts.cast.length === 1 ? 'is' : 'are'} at the table.`);
      lines.push(pick.length ? `${pick.join('. ')}.` : s.recapNone);
      if (facts.clues.length) lines.push(`Known so far: ${facts.clues.slice(-3).join(' ')}`);
      if (ctx.scene?.name) lines.push(`Now: ${ctx.scene.name}.`);
      text = lines.join(' ');
      break;
    }
    default: text = s.generic;
  }
  text = String(text || '').trim() || s.generic;
  return trimWords(text, Math.max(ctx.maxWords, 60) + 60);
}

function trimWords(text, max) {
  if (wordCount(text) <= max) return text;
  const words = text.split(/(\s+)/);
  let n = 0;
  let out = '';
  for (const w of words) {
    if (/\S/.test(w)) { if (++n > max) break; }
    out += w;
  }
  return `${out.trim().replace(/[,;:]$/, '')}…`;
}

/** A local model may overrun the length: cut at the last sentence end within maxWords × 1.15. */
export function capWords(text, maxWords) {
  const limit = Math.round(maxWords * 1.15);
  if (wordCount(text) <= limit) return text;
  const cut = trimWords(text, limit).replace(/…$/, '');
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '), cut.lastIndexOf('.\n'));
  return end > cut.length * 0.5 ? cut.slice(0, end + 1).trim() : `${cut.trim()}…`;
}

/** Strip what a read-aloud draft must not carry: markdown marks, headings, bracketed stage directions. */
export function cleanNarration(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\[[^\]\n]{0,200}\]/g, '')
    .replace(/(\*\*|__|\*|_)(\S[^*_\n]*?\S|\S)\1/g, '$2')
    .replace(/[*#`]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ +([,.;:!?])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map((l) => l.trim()).join('\n')
    .trim();
}

/* ── Provider: any OpenAI-compatible chat endpoint (Ollama on the GPU box) ── */

export const DEFAULT_GM_MODEL = 'hf.co/unsloth/Qwen3-30B-A3B-Instruct-2507-GGUF:Q4_K_M';
const PROBE_TIMEOUT_MS = 3000;
const PROBE_TTL_MS = 60 * 1000;
const FIRST_BYTE_TIMEOUT_MS = Number(process.env.GM_TIMEOUT_MS) || 240 * 1000; // a cold 18 GB model took 94 s to load; leave room for a ComfyUI eviction first

/** { url, model, apiKey } from env (GM_URL / GM_MODEL / GM_API_KEY); url '' = no provider. */
export function gmConfig() {
  loadEnv();
  return {
    url: String(process.env.GM_URL || '').trim().replace(/\/+$/, ''),
    model: String(process.env.GM_MODEL || '').trim() || DEFAULT_GM_MODEL,
    apiKey: String(process.env.GM_API_KEY || '').trim(),
    comfy: comfyBase(), // VRAM hand-off target (server/vram.js)
  };
}
const authHeaders = (cfg) => (cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {});

let probeCache = { key: '', at: 0, value: null };
/** → { ok, provider:'local'|'none', model, url } — probes GET ${url}/models (3 s), cached 60 s. */
export async function gmStatus(cfg = gmConfig(), { fresh = false } = {}) {
  if (!cfg.url) return { ok: false, provider: 'none', model: 'template', url: '' };
  const key = `${cfg.url}|${cfg.model}`;
  if (!fresh && probeCache.key === key && Date.now() - probeCache.at < PROBE_TTL_MS) return probeCache.value;
  let ok = false;
  let models = null;
  try {
    const r = await fetch(`${cfg.url}/models`, { headers: authHeaders(cfg), signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    ok = r.ok;
    if (ok) { const j = await r.json().catch(() => null); models = Array.isArray(j?.data) ? j.data.map((m) => m?.id).filter(Boolean) : null; }
  } catch { ok = false; }
  const value = { ok, provider: ok ? 'local' : 'none', model: ok ? cfg.model : 'template', url: cfg.url };
  if (ok && models && !models.includes(cfg.model)) value.warning = `GM_MODEL is not listed by ${cfg.url}/models.`;
  probeCache = { key, at: Date.now(), value };
  return value;
}
const markDown = (cfg) => { probeCache = { key: `${cfg.url}|${cfg.model}`, at: Date.now(), value: { ok: false, provider: 'none', model: 'template', url: cfg.url } }; };

/** Stream one chat completion; yields content chunks. Throws on HTTP / network errors. */
export async function* streamChat(cfg, { system, user, maxTokens, signal }) {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => ctrl.abort(new Error('The local model did not answer in time.')), FIRST_BYTE_TIMEOUT_MS);
  try {
    const res = await fetch(`${cfg.url}/chat/completions`, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...authHeaders(cfg) },
      body: JSON.stringify({
        model: cfg.model, stream: true, temperature: 0.8, max_tokens: maxTokens,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (!res.ok || !res.body) throw new Error(`GM model HTTP ${res.status}`);
    clearTimeout(timer);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return;
        let j;
        try { j = JSON.parse(data); } catch { continue; }
        if (j?.error) throw new Error(String(j.error?.message || j.error));
        const piece = j?.choices?.[0]?.delta?.content;
        if (typeof piece === 'string' && piece) yield piece;
      }
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Drop <think>…</think> blocks (reasoning models), also an unterminated one while streaming. */
const stripThink = (s) => String(s || '').replace(/<think>[\s\S]*?(<\/think>|$)/g, '').replace(/^\s+/, '');

/* ── Generate ──────────────────────────────────────────────────── */

/**
 * → { text, provider:'local'|'template', model, kind, words, warning? }. The local model when
 * GM_URL answers (`cfg` overrides env, as the tests do with a mock server), else the template.
 * onDelta(textSoFar, chunk) streams.
 */
export async function generateNarration({ game, kind, pack, universe, npcId, prompt, maxWords, onDelta = () => {}, onStatus = () => {}, signal, cfg: cfgIn } = {}) {
  const opts = { pack, universe, npcId, prompt, maxWords };
  const ctx = gmContext(game, kind, opts);
  const cfg = cfgIn || gmConfig();
  const template = () => templateNarration(game, ctx.kind, opts);
  const result = (text, local, extra = {}) => ({ text, provider: local ? 'local' : 'template', model: local ? cfg.model : 'template', kind: ctx.kind, words: wordCount(text), ...extra });
  const st = cfg.url ? await gmStatus(cfg) : null;
  if (!st?.ok) {
    onStatus({ provider: 'template', model: 'template', kind: ctx.kind });
    return result(template(), false, cfg.url ? { warning: 'The local AI GM did not answer; this is the pack\'s own text.' } : {});
  }
  onStatus({ provider: 'local', model: cfg.model, kind: ctx.kind });
  await releaseForLlm({ comfy: cfg.comfy ?? comfyBase() }); // ComfyUI lets go of the GPU first (≤ once per 60 s, never throws)
  try {
    let raw = '';
    let shown = '';
    for await (const chunk of streamChat(cfg, { system: ctx.system, user: ctx.user, maxTokens: Math.max(400, ctx.maxWords * 3), signal })) {
      raw += chunk;
      const now = stripThink(raw);
      if (now === shown) continue;
      const piece = now.startsWith(shown) ? now.slice(shown.length) : '';
      shown = now;
      onDelta(shown, piece);
    }
    const final = capWords(cleanNarration(stripThink(raw)), ctx.maxWords);
    if (!final) throw new Error('Empty narration.');
    return result(final, true);
  } catch (e) {
    if (signal?.aborted) throw e;
    console.warn(`[GM] local model failed, using the template: ${e?.message || e}`);
    if (!/HTTP 4\d\d/.test(String(e?.message))) markDown(cfg);
    return result(template(), false, { warning: 'The local AI GM failed; this is the pack\'s own text.' });
  }
}

/* ── Router ────────────────────────────────────────────────────── */

const inflight = new Set(); // game codes with a narration running

let reachCache = { key: '', at: 0, value: null };
/** { comfy, ollama } reachability for the drawer's hand-off line, cached like the model probe. */
async function cachedReach(cfg, fresh) {
  const key = `${cfg.comfy}|${cfg.url}`;
  if (!fresh && reachCache.key === key && Date.now() - reachCache.at < PROBE_TTL_MS) return reachCache.value;
  const value = await vramReach({ comfy: cfg.comfy, ollama: ollamaRoot(cfg.url) });
  reachCache = { key, at: Date.now(), value };
  return value;
}

/** `config` ({ url, model, apiKey }) overrides the env (tests point it at a mock server). */
export function createGmRouter({ config } = {}) {
  const router = Router();
  const cfgOf = () => ({ ...gmConfig(), ...(config || {}) });

  router.get('/status', async (req, res) => {
    const cfg = cfgOf();
    const fresh = req.query.fresh === '1';
    const [st, vram] = await Promise.all([gmStatus(cfg, { fresh }), cachedReach(cfg, fresh)]);
    res.json({ ...st, vram });
  });

  router.post('/narrate', async (req, res) => {
    const b = req.body || {};
    const code = String(b.code || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    const game = code ? games.get(code) : null;
    if (!game || !safeEqual(String(b.dmToken || ''), String(game.dmToken || ''))) {
      return res.status(403).json({ error: 'not_authorized', message: 'Only the GM of this session can ask the AI GM.' });
    }
    const kind = String(b.kind || '');
    if (!KINDS.includes(kind)) return res.status(400).json({ error: 'bad_kind', message: `kind must be one of ${KINDS.join(', ')}.` });
    const prompt = typeof b.prompt === 'string' ? b.prompt.trim() : '';
    if (prompt.length > PROMPT_MAX) return res.status(400).json({ error: 'prompt_too_long', message: `Keep the prompt under ${PROMPT_MAX} characters.` });
    if (kind === 'improv' && !prompt) return res.status(400).json({ error: 'prompt_required', message: 'Say what happened (e.g. "they cut the power").' });
    const pack = loadPackFor(game.universeId, game.packId);
    if (kind === 'npc' && !findNpc(pack, b.npcId)) return res.status(400).json({ error: 'unknown_npc', message: 'Pick an NPC from this scenario.' });
    if (inflight.has(code)) return res.status(429).json({ error: 'busy', message: 'The AI GM is already writing.' });
    const universe = (await loadUniverseCore(game.universeId)) || { id: game.universeId, name: '' };
    const args = { game, kind, pack, universe, npcId: b.npcId, prompt, maxWords: b.maxWords, cfg: cfgOf() };

    const accept = String(req.headers.accept || '');
    const sse = accept.includes('text/event-stream') || !accept.includes('application/json');
    const controller = new AbortController();
    let finished = false;
    res.on('close', () => { if (!finished) controller.abort(); });
    inflight.add(code);

    if (!sse) {
      try {
        res.json(await generateNarration({ ...args, signal: controller.signal }));
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
    try {
      const result = await generateNarration({
        ...args, signal: controller.signal,
        onStatus: (s) => send('status', s),
        onDelta: (text, chunk) => send('delta', { text, chunk }),
      });
      send('done', result);
    } catch (e) {
      if (!controller.signal.aborted) send('error', { message: e?.message || 'Narration failed.' });
    } finally {
      finished = true;
      inflight.delete(code);
      clearInterval(keepalive);
      if (!res.writableEnded) res.end();
    }
  });

  router.all('/narrate', (req, res) => res.status(405).json({ error: 'Use POST /api/gm/narrate.' }));
  return router;
}

export default createGmRouter;
