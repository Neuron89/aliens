/* Scenario generator core — shared by POST /api/generate (server/generate.js)
   and the CLI (scripts/generate-pack.mjs).

   generatePack({ universeId, params, onStatus, onDelta, signal }) → { pack, usage, repaired }
   Throws GeneratorError { code, status, message, errors? }. */
import { createHash } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { validatePack } from '../schema/validate.js';
import { generatorConfig } from './env.js';
import { loadUniverseCore, listUniverseIds } from './universes.js';
import { validateParams, actRange } from './params.js';
import { buildOutputSchema } from './outputSchema.js';
import { buildSystem, buildMessages, buildRepairMessages } from './prompt.js';

export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export class GeneratorError extends Error {
  constructor(code, message, { status = 500, errors, hint } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    if (errors) this.errors = errors;
    if (hint) this.hint = hint;
  }
}

/* ── Request preparation ──────────────────────────────────────── */

/** Resolve universe + params and build everything the API call needs. */
export async function prepare({ universeId, params: rawParams }) {
  const universe = await loadUniverseCore(universeId);
  if (!universe) {
    throw new GeneratorError('unknown_universe', `Unknown universe "${universeId}". Known: ${listUniverseIds().join(', ')}`, { status: 404 });
  }
  const { ok, params, errors } = validateParams(rawParams);
  if (!ok) throw new GeneratorError('invalid_params', 'Invalid generator parameters.', { status: 400, errors });
  const acts = actRange(params);
  const schema = buildOutputSchema(universe, params, acts);
  const system = buildSystem(universe);
  const messages = buildMessages(universe, params);
  return { universe, params, acts, schema, system, messages };
}

export function buildRequest(cfg, { system, messages, schema }) {
  const req = {
    model: cfg.model,
    max_tokens: cfg.maxTokens,
    system,
    messages,
    output_config: { effort: cfg.effort, format: { type: 'json_schema', schema } },
  };
  if (cfg.fallbacks) {
    req.betas = [FALLBACK_BETA];
    req.fallbacks = 'default';
  }
  return req;
}

/* ── Progress tracking (cheap: watch the streamed JSON text) ───── */

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

export function createProgress(universe, onStatus = () => {}, onDelta = () => {}) {
  const term = universe.terminal?.name || 'TERMINAL';
  let text = '';
  let lastLen = 0;
  const seen = new Set();
  const say = (key, message) => { if (!seen.has(key)) { seen.add(key); onStatus(message); } };
  const markers = [
    ['"meta"', 'meta', 'ASSIGNING MISSION DESIGNATION…'],
    ['"briefing"', 'briefing', `ENCODING ${term} BRIEFING…`],
    ['"npcs"', 'npcs', 'PROFILING NON-CREW PERSONNEL…'],
    ['"threats"', 'threats', 'CLASSIFYING HOSTILE ORGANISMS…'],
    ['"keyLocations"', 'locations', 'SURVEYING KEY LOCATIONS…'],
    ['"handouts"', 'handouts', 'QUEUEING TRANSMISSIONS…'],
    ['"maps"', 'maps', 'PLOTTING DECK SCHEMATICS…'],
    ['"endings"', 'endings', 'COMPUTING TERMINAL OUTCOMES…'],
    ['"characters"', 'characters', 'COMPILING CREW DOSSIERS…'],
    ['"tips"', 'tips', 'APPENDING GAME-MASTER ADVISORIES…'],
  ];
  return {
    get text() { return text; },
    reset() { text = ''; lastLen = 0; },
    status: onStatus,
    thinking() { say('thinking', `${term} IS THINKING… (THIS CAN TAKE A FEW MINUTES)`); },
    push(chunk) {
      text += chunk;
      // Only scan the new tail (+ overlap for markers split across chunks).
      const from = Math.max(0, lastLen - 40);
      const tail = text.slice(from);
      lastLen = text.length;
      for (const [needle, key, msg] of markers) if (!seen.has(key) && tail.includes(needle)) say(key, msg);
      const actRe = /"title"\s*:\s*"(ACT[^"]{0,40})"/g;
      let m;
      while ((m = actRe.exec(tail))) say(`act:${m[1]}`, `WRITING ${m[1].toUpperCase()}…`);
      onDelta(text.length);
    },
  };
}

/* ── Post-processing ───────────────────────────────────────────── */

export function slugify(s, max = 48) {
  return String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, max).replace(/-+$/g, '') || 'pack';
}

const shortHash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 6);
const pairsToObject = (v) => (Array.isArray(v)
  ? Object.fromEntries(v.filter((p) => p && typeof p.key === 'string').map((p) => [p.key, p.value]))
  : v);

/** Turn model output into a schema-shaped pack + stamp provenance. */
export function normalizePack(raw, { universe, params, model, at = new Date().toISOString() }) {
  const pack = { ...raw };
  delete pack.packVersion; delete pack.id; delete pack.universe;
  const meta = { ...(pack.meta || {}) };
  const title = meta.title || params.seedTitle || 'Untitled Scenario';
  const hash = shortHash(`${title}|${at}|${Math.random()}`);
  const id = `${slugify(title, 56)}-${hash}`;

  const assignments = {};
  const characters = (pack.characters || []).map((c, i) => {
    const ch = { ...c };
    if (ch.assignedTo) { assignments[ch.name || `character-${i + 1}`] = ch.assignedTo; }
    delete ch.assignedTo;
    ch.id = `${slugify(ch.name || ch.id || `character-${i + 1}`, 40)}-${hash}`;
    return ch;
  });

  const kebab = (v, fallback) => (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v || '') ? v : slugify(v || fallback));
  const out = {
    packVersion: 1,
    id,
    universe: universe.id,
    kind: pack.kind || 'scenario',
    meta: {
      ...meta,
      title,
      source: 'generated',
      generated: {
        by: 'claude',
        model,
        at,
        params: Object.keys(assignments).length ? { ...params, assignments } : { ...params },
      },
    },
    ...Object.fromEntries(Object.entries(pack).filter(([k]) => !['kind', 'meta', 'characters'].includes(k))),
    characters,
  };
  if (out.npcs) out.npcs = out.npcs.map((n) => (n.stats ? { ...n, stats: pairsToObject(n.stats) } : n));
  if (out.threats) out.threats = out.threats.map((t) => (t.stats ? { ...t, stats: pairsToObject(t.stats) } : t));
  if (out.handouts) out.handouts = out.handouts.map((h, i) => ({ ...h, id: kebab(h.id, h.title || `handout-${i + 1}`) }));
  if (out.maps) out.maps = out.maps.map((m, i) => ({ ...m, id: kebab(m.id, m.title || `map-${i + 1}`) }));
  return out;
}

/** Engine-level checks the JSON schema cannot express (legal characters, counts). */
export function semanticErrors(pack, { universe, params, acts }) {
  const errs = [];
  const rules = universe.rules || {};
  const c = rules.creation || {};
  const attrKeys = (rules.attributes || []).map((a) => a.key);
  const skillKeys = (rules.skills || []).map((s) => s.key);
  const sMax = (c.skillMax ?? 3) + 2;
  const nActs = (pack.acts || []).length;
  if (nActs < acts.min || nActs > acts.max) errs.push(`/acts must have ${acts.min === acts.max ? acts.min : `${acts.min}-${acts.max}`} acts (got ${nActs})`);
  const chars = pack.characters || [];
  if (chars.length !== params.players) errs.push(`/characters must have exactly ${params.players} characters (got ${chars.length})`);
  const careers = new Set((universe.careers || []).map((x) => x.name));
  chars.forEach((ch, i) => {
    const at = `/characters/${i}`;
    for (const k of attrKeys) {
      const v = ch.attributes?.[k];
      if (!Number.isInteger(v)) errs.push(`${at}/attributes/${k} missing`);
      else if ((c.attrMin !== undefined && v < c.attrMin) || (c.attrMax !== undefined && v > c.attrMax)) errs.push(`${at}/attributes/${k}=${v} outside ${c.attrMin}-${c.attrMax}`);
    }
    for (const k of Object.keys(ch.attributes || {})) if (attrKeys.length && !attrKeys.includes(k)) errs.push(`${at}/attributes has unknown key "${k}"`);
    for (const k of skillKeys) {
      const v = ch.skills?.[k];
      if (!Number.isInteger(v)) errs.push(`${at}/skills/${k} missing`);
      else if (v < 0 || v > sMax) errs.push(`${at}/skills/${k}=${v} outside 0-${sMax}`);
    }
    for (const k of Object.keys(ch.skills || {})) if (skillKeys.length && !skillKeys.includes(k)) errs.push(`${at}/skills has unknown key "${k}"`);
    if (careers.size && !careers.has(ch.career)) errs.push(`${at}/career "${ch.career}" is not one of: ${[...careers].join(', ')}`);
  });
  if (params.playerNames?.length) {
    const assigned = Object.values(pack.meta?.generated?.params?.assignments || {});
    const missing = params.playerNames.filter((n) => !assigned.includes(n));
    if (missing.length) errs.push(`/characters assignedTo must cover every player; missing: ${missing.join(', ')}`);
  }
  if ((pack.endings || []).length < 2) errs.push('/endings needs at least 2 entries');
  return errs;
}

function finalize(rawText, ctx) {
  let raw;
  try {
    raw = JSON.parse(rawText);
  } catch (e) {
    return { pack: null, errors: [`Response was not valid JSON: ${e.message}`] };
  }
  const pack = normalizePack(raw, ctx);
  const { errors } = validatePack(pack);
  return { pack, errors: [...errors, ...semanticErrors(pack, ctx)] };
}

/* ── Claude call ───────────────────────────────────────────────── */

function textOf(message) {
  return (message.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

async function streamOnce(client, request, progress, signal) {
  progress.reset();
  const stream = client.beta.messages.stream(request, { signal });
  for await (const event of stream) {
    if (event.type === 'content_block_start' && event.content_block?.type === 'thinking') progress.thinking();
    else if (event.type === 'content_block_start' && event.content_block?.type === 'fallback') {
      progress.status(`PRIMARY MODEL DECLINED — REROUTING TO ${event.content_block.to?.model || 'FALLBACK'}…`);
    } else if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') progress.push(event.delta.text);
  }
  const message = await stream.finalMessage();
  if (message.stop_reason === 'max_tokens') {
    throw new GeneratorError('too_long', 'scenario too long, lower playtime (the model hit max_tokens before finishing)', { status: 502 });
  }
  if (message.stop_reason === 'refusal') {
    const why = message.stop_details?.explanation || 'no explanation given';
    throw new GeneratorError('refusal', `The model declined to write this scenario: ${why}. Try adjusting the setting, threat or themes.`, { status: 422 });
  }
  return { message, text: textOf(message) || progress.text };
}

export function apiErrorToGeneratorError(e) {
  if (e instanceof GeneratorError) return e;
  if (e?.name === 'AbortError' || e instanceof Anthropic.APIUserAbortError) return new GeneratorError('aborted', 'Generation cancelled.', { status: 499 });
  if (e instanceof Anthropic.AuthenticationError) return new GeneratorError('auth', 'ANTHROPIC_API_KEY was rejected (401). Check web app/.env.', { status: 502 });
  if (e instanceof Anthropic.RateLimitError) return new GeneratorError('rate_limited', 'Claude API rate limit hit — wait a minute and retry.', { status: 429 });
  if (e instanceof Anthropic.BadRequestError) return new GeneratorError('bad_request', `Claude API rejected the request: ${e.message}`, { status: 502 });
  if (e instanceof Anthropic.APIError) return new GeneratorError('api_error', `Claude API error ${e.status ?? ''}: ${e.message}`, { status: 502 });
  return new GeneratorError('internal', e?.message || String(e), { status: 500 });
}

/** Count input tokens for the prepared request (null if counting fails). */
export async function countInputTokens(client, cfg, prepared) {
  try {
    const params = {
      model: cfg.model,
      system: prepared.system,
      messages: prepared.messages,
      output_config: { format: { type: 'json_schema', schema: prepared.schema } },
    };
    const res = await client.messages.countTokens(params);
    return res.input_tokens ?? null;
  } catch {
    return null;
  }
}

/**
 * Generate a validated pack.
 * @param {{universeId:string, params:object, onStatus?:(msg:string, extra?:object)=>void, onDelta?:(chars:number)=>void, signal?:AbortSignal}} opts
 */
export async function generatePack({ universeId, params: rawParams, onStatus = () => {}, onDelta = () => {}, signal } = {}) {
  const cfg = generatorConfig();
  const prepared = await prepare({ universeId, params: rawParams });
  const { universe, params, acts } = prepared;

  if (cfg.mock) {
    const { mockGenerate } = await import('./__mock__.js');
    const progress = createProgress(universe, onStatus, onDelta);
    const at = new Date().toISOString();
    onStatus(`CONTACTING ${universe.terminal?.name || 'TERMINAL'}… [MOCK MODE]`, { estimatedInputTokens: 0, model: 'mock', mock: true });
    const text = await mockGenerate({ universe, params, progress, signal, delayMs: cfg.mockDelayMs });
    onStatus('VALIDATING PACK…');
    const { pack, errors } = finalize(text, { universe, params, acts, model: 'mock', at });
    if (errors.length) throw new GeneratorError('invalid_pack', 'Mock pack failed validation.', { status: 422, errors });
    onStatus('PACK VALID — READY FOR REVIEW.');
    return { pack, usage: null, repaired: false };
  }

  if (!cfg.apiKey) {
    throw new GeneratorError('generator_not_configured', 'The scenario generator needs an Anthropic API key.', {
      status: 400, hint: 'set ANTHROPIC_API_KEY in web app/.env',
    });
  }

  const client = new Anthropic({ apiKey: cfg.apiKey, timeout: 30 * 60 * 1000, maxRetries: 2 });
  const progress = createProgress(universe, onStatus, onDelta);
  try {
    const estimatedInputTokens = await countInputTokens(client, cfg, prepared);
    onStatus(`CONTACTING ${universe.terminal?.name || 'TERMINAL'}…`, {
      estimatedInputTokens, model: cfg.model, effort: cfg.effort, fallbacks: cfg.fallbacks,
    });

    const at = new Date().toISOString();
    const ctx = { universe, params, acts, model: cfg.model, at };
    const first = await streamOnce(client, buildRequest(cfg, prepared), progress, signal);
    onStatus('VALIDATING PACK…');
    ctx.model = first.message.model || cfg.model;
    let { pack, errors } = finalize(first.text, ctx);
    let usage = [first.message.usage];
    let repaired = false;

    if (errors.length) {
      onStatus(`VALIDATION FAILED (${errors.length} ISSUE${errors.length > 1 ? 'S' : ''}) — REQUESTING CORRECTION…`, { errors: errors.slice(0, 20) });
      const repairReq = buildRequest(cfg, { ...prepared, messages: buildRepairMessages(universe, params, first.text, errors) });
      const second = await streamOnce(client, repairReq, progress, signal);
      usage.push(second.message.usage);
      ({ pack, errors } = finalize(second.text, ctx));
      repaired = true;
      if (errors.length) {
        throw new GeneratorError('invalid_pack', 'Generated pack failed validation after one repair attempt.', { status: 422, errors });
      }
    }
    onStatus('PACK VALID — READY FOR REVIEW.');
    return { pack, usage, repaired };
  } catch (e) {
    throw apiErrorToGeneratorError(e);
  }
}

/** For --dry-run: the full request (without calling the model) + token estimate if a key is configured. */
export async function dryRun({ universeId, params }) {
  const cfg = generatorConfig();
  const prepared = await prepare({ universeId, params });
  const request = buildRequest(cfg, prepared);
  let estimatedInputTokens = null;
  if (cfg.apiKey) {
    const client = new Anthropic({ apiKey: cfg.apiKey });
    estimatedInputTokens = await countInputTokens(client, cfg, prepared);
  }
  const promptChars = prepared.system.reduce((n, b) => n + b.text.length, 0) + prepared.messages[0].content.length;
  return {
    request,
    estimatedInputTokens,
    // Rough fallback estimate (~4 chars/token, schema included) when no key is set.
    roughInputTokens: Math.round((promptChars + JSON.stringify(prepared.schema).length) / 4),
  };
}
