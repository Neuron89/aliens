/* ═══════════════════════════════════════════════════════════════
   VOICE — server-side text-to-speech for the AI GM / narration
   (REST: /api/tts; the socket side is `narrate-speak` in sessions.js).

   Provider: any OpenAI-compatible speech endpoint. Built for Kokoro-82M
   via Kokoro-FastAPI on the GPU box (TTS_URL=http://192.168.1.37:8880/v1),
   also works with api.openai.com (TTS_API_KEY + TTS_MODEL=tts-1).
     POST <TTS_URL>/audio/speech { model, input, voice, response_format, speed }
     GET  <TTS_URL>/audio/voices  (Kokoro only) → { voices: ['af_heart', …] }

   GET  /api/tts/status         → { provider:'kokoro'|'openai'|'none', ok, model, format, voices:[{id,name,lang,gender,grade?}], error? }
                                   (probe cached 10 min when up, 15 s when down; ?fresh=1 re-probes)
   GET  /api/tts/voices         → { provider, voices }
   POST /api/tts/speak          body { text, voice?, speed? }   (requireApiToken in index.js, like /api/recap)
                                → 200 { url, ms, cached, voice, speed, total, parts:[{ url, ms }] }  (blocking: all parts)
                                  400 empty / bad voice · 413 > 4000 chars · 503 { error:'no_voice_server' } · 502 provider error
                                With `Accept: text/event-stream` (what the GM tablet uses): SSE, progressive —
                                  event: start  data: { total }
                                  event: part   data: { index, url, ms, cached }   (as each sentence group is ready)
                                  event: done   data: { parts, total, ms, cached, voice, speed }
                                  event: error  data: { error, message }
                                  (synthesis stops when the client disconnects)
   GET  /api/tts/audio/:file    the audio (immutable: the file name is the content hash)

   `ms` is the clip's playing time (from the WAV header or the MP3 frame
   header; a words-per-minute estimate otherwise). Text is cut into sentence
   groups of ~12–25 words (sentenceParts) synthesized one after another, each
   cached on its own — nothing is concatenated; playback starts after the
   first group (~1 s on Kokoro CPU) instead of after the whole text.

   Cache: <DATA_DIR>/tts/<sha1(provider|model|voice|speed|format|text)>.<fmt>,
   LRU by mtime (a hit touches the file), pruned to TTS_CACHE_MAX_FILES (500)
   and TTS_CACHE_MAX_MB (200). Identical requests in flight share one call.
   Env: TTS_URL (unset = no server voice; the clients fall back to the
   browser's Web Speech voice), TTS_API_KEY (optional bearer), TTS_MODEL
   (default kokoro), TTS_FORMAT (mp3|wav, default mp3), TTS_VOICE (fallback
   voice when the client sends none), TTS_TIMEOUT_MS (60000), TTS_DIR.
   ═══════════════════════════════════════════════════════════════ */
import { Router } from 'express';
import { promises as fs, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { DATA_DIR } from './persistence.js';
import { loadEnv } from './generator/env.js';

loadEnv();

export const TTS_MAX_TEXT = 4000;
export const TTS_PART_MAX = 1200;
export const SPEED_MIN = 0.5;
export const SPEED_MAX = 2;
const STATUS_TTL_OK = 10 * 60 * 1000;
const STATUS_TTL_DOWN = 15 * 1000;
const PROBE_MS = 2500;

const FORMATS = { mp3: 'audio/mpeg', wav: 'audio/wav' };
const FILE_RE = /^[a-f0-9]{40}\.(mp3|wav)$/;
/* A voice id or a Kokoro blend: "bm_george", "af_bella(2)+af_heart(1)". */
const VOICE_RE = /^[A-Za-z0-9_-]{1,40}(\(\d{1,2}(\.\d{1,2})?\))?(\+[A-Za-z0-9_-]{1,40}(\(\d{1,2}(\.\d{1,2})?\))?){0,3}$/;
const OPENAI_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer'];

export function ttsConfig() {
  loadEnv();
  const url = String(process.env.TTS_URL || '').trim().replace(/\/+$/, '');
  const format = FORMATS[String(process.env.TTS_FORMAT || '').toLowerCase()] ? String(process.env.TTS_FORMAT).toLowerCase() : 'mp3';
  return {
    url,
    apiKey: process.env.TTS_API_KEY || '',
    model: process.env.TTS_MODEL || 'kokoro',
    format,
    voice: process.env.TTS_VOICE || '',
    timeoutMs: Math.max(1000, Number(process.env.TTS_TIMEOUT_MS) || 60000),
    dir: process.env.TTS_DIR || join(DATA_DIR, 'tts'),
    maxFiles: Math.max(1, Number(process.env.TTS_CACHE_MAX_FILES) || 500),
    maxBytes: Math.max(1, Number(process.env.TTS_CACHE_MAX_MB) || 200) * 1024 * 1024,
  };
}

const authHeaders = (cfg) => (cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {});
export const isVoiceId = (v) => typeof v === 'string' && v.length <= 200 && VOICE_RE.test(v);
export const clampSpeed = (v, fallback = 1) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.min(SPEED_MAX, Math.max(SPEED_MIN, n)) * 100) / 100;
};

/* ── Voices ──────────────────────────────────────────────────── */

const KOKORO_LANG = { a: 'en-US', b: 'en-GB', e: 'es', f: 'fr', h: 'hi', i: 'it', j: 'ja', p: 'pt-BR', z: 'zh' };
const KOKORO_ACCENT = { a: 'American', b: 'British', e: 'Spanish', f: 'French', h: 'Hindi', i: 'Italian', j: 'Japanese', p: 'Portuguese', z: 'Mandarin' };

/** A Kokoro voice id ("bm_george") → { id, name:'George — British male', lang:'en-GB', gender:'male' }. */
export function describeVoice(id) {
  const m = /^([a-z])([fm])_([a-z0-9_]+)$/i.exec(id);
  if (!m) return { id, name: id, lang: 'en' };
  const [, l, g, rest] = m;
  const gender = g.toLowerCase() === 'f' ? 'female' : 'male';
  const nice = rest.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const accent = KOKORO_ACCENT[l.toLowerCase()];
  return { id, name: `${nice} — ${accent ? `${accent} ` : ''}${gender}`, lang: KOKORO_LANG[l.toLowerCase()] || 'en', gender };
}

let statusCache = null; // { at, ttl, value }

async function probe(cfg) {
  if (!cfg.url) return { provider: 'none', ok: false, model: cfg.model, format: cfg.format, voices: [], error: 'TTS_URL is not set' };
  const openaiHost = /api\.openai\.com/i.test(cfg.url);
  try {
    const res = await fetch(`${cfg.url}/audio/voices`, { headers: authHeaders(cfg), signal: AbortSignal.timeout(PROBE_MS) });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const raw = Array.isArray(data?.voices) ? data.voices : Array.isArray(data) ? data : [];
      const ids = raw.map((v) => (typeof v === 'string' ? v : v?.id || v?.voice_id || v?.name)).filter((v) => isVoiceId(v));
      if (ids.length) {
        // Kokoro-FastAPI publishes a quality grade per voice (overall_grade: 'A-', 'C+', …): shown in the picker.
        const grades = new Map(raw.filter((v) => v && typeof v === 'object' && typeof v.overall_grade === 'string').map((v) => [v.id || v.name, v.overall_grade.slice(0, 3)]));
        const voices = [...new Set(ids)].sort().map((id) => { const d = describeVoice(id); const g = grades.get(id); return g ? { ...d, grade: g } : d; });
        return { provider: openaiHost ? 'openai' : 'kokoro', ok: true, model: cfg.model, format: cfg.format, voices };
      }
    }
    // Reachable, but no voice list: a plain OpenAI-style endpoint (fixed voice set).
    if (res.status === 404 || res.status === 405 || openaiHost) {
      return { provider: 'openai', ok: true, model: cfg.model, format: cfg.format, voices: OPENAI_VOICES.map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1), lang: 'en' })) };
    }
    return { provider: 'none', ok: false, model: cfg.model, format: cfg.format, voices: [], error: `voice server answered ${res.status}` };
  } catch (err) {
    return { provider: 'none', ok: false, model: cfg.model, format: cfg.format, voices: [], error: err?.name === 'TimeoutError' ? 'voice server did not answer' : `voice server unreachable (${err?.cause?.code || err?.message || 'error'})` };
  }
}

/** { provider, ok, model, format, voices, error? } — cached (10 min up / 15 s down). */
export async function ttsStatus({ fresh = false } = {}) {
  const cfg = ttsConfig();
  const now = Date.now();
  if (!fresh && statusCache && statusCache.url === cfg.url && now - statusCache.at < statusCache.ttl) return statusCache.value;
  const value = await probe(cfg);
  statusCache = { at: now, url: cfg.url, ttl: value.ok ? STATUS_TTL_OK : STATUS_TTL_DOWN, value };
  return value;
}
/** Forget the cached probe (a synth failure means the server went away). */
const markDown = () => { if (statusCache) statusCache.ttl = 0; };

/* ── Duration (ms) of a clip ─────────────────────────────────── */

const MP3_BITRATES = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],     // MPEG-1 layer III
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],        // MPEG-2/2.5 layer III
};
const MP3_RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/** Playing time of a WAV/MP3 buffer in ms, or 0 when the header cannot be read. */
export function audioDurationMs(buf) {
  if (!buf || buf.length < 12) return 0;
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') {
    let off = 12;
    let byteRate = 0;
    while (off + 8 <= buf.length) {
      const id = buf.toString('ascii', off, off + 4);
      const size = buf.readUInt32LE(off + 4);
      if (id === 'fmt ' && off + 16 <= buf.length) byteRate = buf.readUInt32LE(off + 16);
      if (id === 'data') {
        const len = size > 0 && size < 0xffffffff ? Math.min(size, buf.length - off - 8) : buf.length - off - 8;
        return byteRate ? Math.round((len / byteRate) * 1000) : 0;
      }
      off += 8 + size + (size & 1);
    }
    return 0;
  }
  // MP3: skip an ID3v2 tag, find the first frame header.
  let i = 0;
  if (buf.toString('ascii', 0, 3) === 'ID3' && buf.length > 10) {
    i = 10 + ((buf[6] & 0x7f) << 21 | (buf[7] & 0x7f) << 14 | (buf[8] & 0x7f) << 7 | (buf[9] & 0x7f));
  }
  for (const end = Math.min(buf.length - 4, i + 8192); i < end; i++) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) continue;
    const ver = (buf[i + 1] >> 3) & 3;           // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
    const layer = (buf[i + 1] >> 1) & 3;          // 1 = layer III
    const bri = (buf[i + 2] >> 4) & 15;
    const sri = (buf[i + 2] >> 2) & 3;
    if (ver === 1 || layer !== 1 || bri === 0 || bri === 15 || sri === 3) continue;
    const sampleRate = MP3_RATES[ver][sri];
    const samplesPerFrame = ver === 3 ? 1152 : 576;
    // Xing/Info header (VBR): exact frame count.
    const mono = ((buf[i + 3] >> 6) & 3) === 3;
    const sideInfo = ver === 3 ? (mono ? 17 : 32) : (mono ? 9 : 17);
    const x = i + 4 + sideInfo;
    if (x + 12 <= buf.length) {
      const tag = buf.toString('ascii', x, x + 4);
      if ((tag === 'Xing' || tag === 'Info') && (buf.readUInt32BE(x + 4) & 1)) {
        return Math.round((buf.readUInt32BE(x + 8) * samplesPerFrame / sampleRate) * 1000);
      }
    }
    const kbps = MP3_BITRATES[ver === 3 ? 1 : 2][bri];
    return kbps ? Math.round(((buf.length - i) * 8) / kbps) : 0;
  }
  return 0;
}
/** ~150 words a minute at speed 1 (used when the header cannot be read). */
export const estimateMs = (text, speed = 1) => Math.round((((String(text).match(/\S+/g) || []).length / 2.5) * 1000) / (speed || 1)) + 400;

/* ── Text ────────────────────────────────────────────────────── */

/** Speakable text: control characters dropped, whitespace tidied (blank lines kept as paragraph breaks). */
export function cleanSpeech(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Split into parts of ≤ max chars: on blank lines, then sentences, then words. */
export function splitText(text, max = TTS_PART_MAX) {
  const t = cleanSpeech(text);
  if (!t) return [];
  if (t.length <= max) return [t];
  const pieces = [];
  const pushLong = (para) => {
    if (para.length <= max) { pieces.push(para); return; }
    const sentences = para.match(/[^.!?…]+(?:[.!?…]+["'”’)\]]*\s*|$)/g) || [para];
    for (const s of sentences) {
      const st = s.trim();
      if (!st) continue;
      if (st.length <= max) { pieces.push(st); continue; }
      let cur = '';
      for (const w of st.split(/\s+/)) {
        if (cur && cur.length + 1 + w.length > max) { pieces.push(cur); cur = ''; }
        cur = cur ? `${cur} ${w}` : w.slice(0, max);
      }
      if (cur) pieces.push(cur);
    }
  };
  for (const para of t.split(/\n\s*\n/)) pushLong(para.replace(/\n/g, ' ').trim());
  // Re-pack small neighbours so a part is as long as allowed (fewer requests, fewer gaps).
  const parts = [];
  for (const p of pieces.filter(Boolean)) {
    const last = parts[parts.length - 1];
    if (last !== undefined && last.length + 2 + p.length <= max) parts[parts.length - 1] = `${last}\n\n${p}`;
    else parts.push(p);
  }
  return parts;
}

/* ── Cache ───────────────────────────────────────────────────── */

const inflight = new Map(); // hash → Promise
let pruneTimer = null;

export const audioUrl = (file) => `/api/tts/audio/${file}`;
export function cacheKey({ provider, model, voice, speed, format, text }) {
  return createHash('sha1').update([provider, model, voice, speed.toFixed(2), format, text].join('|')).digest('hex');
}

/** Drop the oldest clips beyond maxFiles / maxBytes. Returns the number removed. */
export async function pruneCache(cfg = ttsConfig()) {
  let names;
  try { names = await fs.readdir(cfg.dir); } catch { return 0; }
  const entries = [];
  for (const n of names) {
    if (!FILE_RE.test(n)) continue;
    try { const st = await fs.stat(join(cfg.dir, n)); entries.push({ n, t: st.mtimeMs, size: st.size }); } catch { /* raced */ }
  }
  entries.sort((a, b) => b.t - a.t); // newest first
  let total = 0;
  let removed = 0;
  for (let i = 0; i < entries.length; i++) {
    total += entries[i].size;
    if (i >= cfg.maxFiles || total > cfg.maxBytes) {
      try { await fs.unlink(join(cfg.dir, entries[i].n)); removed++; } catch { /* gone */ }
    }
  }
  return removed;
}
function schedulePrune(cfg) {
  if (pruneTimer) return;
  pruneTimer = setTimeout(() => { pruneTimer = null; pruneCache(cfg).catch(() => {}); }, 250);
  pruneTimer.unref?.();
}

async function callProvider(cfg, provider, text, voice, speed) {
  const res = await fetch(`${cfg.url}/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(cfg) },
    body: JSON.stringify({ model: cfg.model, input: text, voice, response_format: cfg.format, speed }),
    signal: AbortSignal.timeout(cfg.timeoutMs),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200).replace(/\s+/g, ' ');
    const err = new Error(`voice server ${res.status}${detail ? `: ${detail}` : ''}`);
    err.status = res.status;
    throw err;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 16) throw new Error('voice server returned no audio');
  return buf;
}

/**
 * One clip (text ≤ TTS_PART_MAX recommended): cached on disk.
 * → { file, url, ms, cached, took, voice, speed }   (ms = playing time; took = synthesis time)
 * Throws { code:'no_voice_server' } when there is no provider.
 */
export async function synthesize(text, { voice, speed } = {}) {
  const cfg = ttsConfig();
  const st = await ttsStatus();
  if (!st.ok) { const e = new Error(st.error || 'no voice server'); e.code = 'no_voice_server'; throw e; }
  const input = cleanSpeech(text);
  if (!input) { const e = new Error('nothing to say'); e.code = 'empty'; throw e; }
  const v = isVoiceId(voice) ? voice : (isVoiceId(cfg.voice) ? cfg.voice : (st.provider === 'openai' ? 'onyx' : (st.voices[0]?.id || 'bm_george')));
  const sp = clampSpeed(speed, 1);
  const hash = cacheKey({ provider: st.provider, model: cfg.model, voice: v, speed: sp, format: cfg.format, text: input });
  const file = `${hash}.${cfg.format}`;
  const full = join(cfg.dir, file);
  const started = Date.now();
  if (existsSync(full)) {
    const buf = await fs.readFile(full);
    const now = new Date();
    fs.utimes(full, now, now).catch(() => {});
    return { file, url: audioUrl(file), ms: audioDurationMs(buf) || estimateMs(input, sp), cached: true, took: Date.now() - started, voice: v, speed: sp };
  }
  if (inflight.has(hash)) {
    const r = await inflight.get(hash);
    return { ...r, cached: true };
  }
  const job = (async () => {
    let buf;
    try { buf = await callProvider(cfg, st.provider, input, v, sp); } catch (err) {
      if (!err.status) markDown(); // network failure: re-probe next time
      throw err;
    }
    await fs.mkdir(cfg.dir, { recursive: true });
    const tmp = `${full}.${process.pid}.tmp`;
    await fs.writeFile(tmp, buf);
    await fs.rename(tmp, full);
    schedulePrune(cfg);
    return { file, url: audioUrl(file), ms: audioDurationMs(buf) || estimateMs(input, sp), cached: false, took: Date.now() - started, voice: v, speed: sp };
  })();
  inflight.set(hash, job);
  try { return await job; } finally { inflight.delete(hash); }
}

/* ── Progressive speech: sentence groups ─────────────────────────
   Kokoro on CPU takes ~1 s for a 13-word sentence but ~16 s for 1100 chars,
   and serves requests one after another — so text is cut into groups of
   ~12–25 words (sentences; very short ones merged, very long ones cut at
   , ; : — then at words) and synthesized SEQUENTIALLY, each group cached on
   its own; playback starts as soon as the first group is ready. */
export const PART_MIN_WORDS = 12;
export const PART_MAX_WORDS = 25;
/* The FIRST group may be shorter (one sentence of ≥ 6 words stands alone) so the voice starts sooner. */
export const FIRST_MIN_WORDS = 6;
const words = (s) => (s.match(/\S+/g) || []).length;

/** Text → speakable groups of ~12–25 words (never over TTS_PART_MAX chars). */
export function sentenceParts(text, { min = PART_MIN_WORDS, max = PART_MAX_WORDS, firstMin = FIRST_MIN_WORDS } = {}) {
  const t = cleanSpeech(text);
  if (!t) return [];
  const units = [];
  const cutLong = (u) => {
    if (words(u) <= Math.round(max * 1.4) && u.length <= TTS_PART_MAX) { units.push(u); return; }
    // clause boundaries first, then plain word runs of `max`
    const clauses = u.split(/(?<=[,;:—–])\s+/);
    let cur = '';
    const flush = () => { if (cur) units.push(cur); cur = ''; };
    for (const c of clauses) {
      if (words(c) > max || c.length > TTS_PART_MAX) {
        flush();
        const w = c.split(/\s+/);
        for (let i = 0; i < w.length; i += max) units.push(w.slice(i, i + max).join(' ').slice(0, TTS_PART_MAX));
        continue;
      }
      if (cur && words(cur) + words(c) > max) flush();
      cur = cur ? `${cur} ${c}` : c;
    }
    flush();
  };
  for (const line of t.split(/\n+/)) {
    const sentences = line.match(/[^.!?…]+(?:[.!?…]+["'”’)\]]*|$)/g) || [line];
    for (const sen of sentences) { const x = sen.trim(); if (x) cutLong(x); }
  }
  const groups = [];
  let cur = '';
  for (const u of units) {
    if (!cur) { cur = u; continue; }
    const wc = words(cur);
    if (wc < (groups.length ? min : firstMin) && (wc + words(u) <= max || wc < 5) && cur.length + 1 + u.length <= TTS_PART_MAX) cur = `${cur} ${u}`;
    else { groups.push(cur); cur = u; }
  }
  if (cur) {
    const last = groups[groups.length - 1];
    if (last !== undefined && words(cur) < 5 && words(last) + words(cur) <= max + 10 && last.length + 1 + cur.length <= TTS_PART_MAX) groups[groups.length - 1] = `${last} ${cur}`;
    else groups.push(cur);
  }
  return groups;
}

/**
 * Speak a whole text progressively: groups synthesized one after another,
 * `onPart({ index, url, ms, cached })` as each is ready. `shouldStop()` is checked
 * before every group (STOP / client gone).
 * → { parts:[{ url, ms }], total, ms, cached, voice, speed, stopped }   (throws like synthesize)
 */
export async function speakStream(text, { voice, speed } = {}, { onPart, shouldStop } = {}) {
  const groups = sentenceParts(text);
  if (!groups.length) { const e = new Error('nothing to say'); e.code = 'empty'; throw e; }
  const parts = [];
  let cached = true;
  let used = { voice, speed: clampSpeed(speed, 1) };
  for (let i = 0; i < groups.length; i++) {
    if (shouldStop?.()) return { parts, total: groups.length, ms: parts.reduce((n, p) => n + p.ms, 0), cached, ...used, stopped: true };
    const r = await synthesize(groups[i], { voice, speed });
    if (shouldStop?.()) return { parts, total: groups.length, ms: parts.reduce((n, p) => n + p.ms, 0), cached, ...used, stopped: true };
    parts.push({ url: r.url, ms: r.ms });
    cached = cached && r.cached;
    used = { voice: r.voice, speed: r.speed };
    onPart?.({ index: i, url: r.url, ms: r.ms, cached: r.cached });
  }
  return { parts, total: groups.length, ms: parts.reduce((n, p) => n + p.ms, 0), cached, ...used, stopped: false };
}

/** Whole text, all groups (blocking). → { parts:[{ url, ms }], total, ms, cached, voice, speed } */
export const speakText = (text, opts) => speakStream(text, opts);

/* ── Router ──────────────────────────────────────────────────── */

export function createTtsRouter() {
  const router = Router();

  router.get('/status', async (req, res) => {
    const st = await ttsStatus({ fresh: req.query.fresh === '1' });
    res.set('Cache-Control', 'no-store');
    res.json(st);
  });

  router.get('/voices', async (req, res) => {
    const st = await ttsStatus({ fresh: req.query.fresh === '1' });
    res.set('Cache-Control', 'no-store');
    res.json({ provider: st.provider, voices: st.voices });
  });

  router.post('/speak', async (req, res) => {
    const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const text = typeof b.text === 'string' ? b.text : '';
    if (!cleanSpeech(text)) return res.status(400).json({ error: 'empty', message: 'Nothing to say.' });
    if (text.length > TTS_MAX_TEXT) return res.status(413).json({ error: 'too_long', message: `Text is limited to ${TTS_MAX_TEXT} characters.` });
    if (b.voice !== undefined && b.voice !== null && b.voice !== '' && !isVoiceId(b.voice)) return res.status(400).json({ error: 'bad_voice', message: 'Invalid voice id.' });
    const opts = { voice: b.voice || undefined, speed: b.speed };
    if (/text\/event-stream/.test(req.get('accept') || '')) {
      // Progressive: SSE start → part* → done (or error). Synthesis stops when the client goes away.
      const st = await ttsStatus();
      if (!st.ok) return res.status(503).json({ error: 'no_voice_server', message: 'No voice server — set TTS_URL in web app/.env.' });
      let gone = false;
      res.on('close', () => { gone = true; });
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      const sse = (event, data) => { if (!gone) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
      sse('start', { total: sentenceParts(text).length });
      try {
        const r = await speakStream(text, opts, { onPart: (p) => sse('part', p), shouldStop: () => gone });
        sse('done', { parts: r.parts, total: r.total, ms: r.ms, cached: r.cached, voice: r.voice, speed: r.speed });
      } catch (err) {
        if (err.code !== 'no_voice_server' && err.code !== 'empty') console.warn(`[TTS] speak failed: ${err?.message || err}`);
        sse('error', { error: err.code || 'voice_failed', message: String(err?.message || 'voice server error').slice(0, 200) });
      }
      return res.end();
    }
    try {
      const r = await speakText(text, opts);
      res.set('Cache-Control', 'no-store');
      res.json({ url: r.parts[0].url, ms: r.ms, cached: r.cached, voice: r.voice, speed: r.speed, total: r.total, parts: r.parts });
    } catch (err) {
      if (err.code === 'no_voice_server') return res.status(503).json({ error: 'no_voice_server', message: 'No voice server — set TTS_URL in web app/.env.' });
      if (err.code === 'empty') return res.status(400).json({ error: 'empty', message: 'Nothing to say.' });
      console.warn(`[TTS] speak failed: ${err?.message || err}`);
      res.status(502).json({ error: 'voice_failed', message: String(err?.message || 'voice server error').slice(0, 200) });
    }
  });

  router.get('/audio/:file', (req, res) => {
    const { file } = req.params;
    if (!FILE_RE.test(file)) return res.status(400).json({ error: 'Invalid path.' });
    const full = join(ttsConfig().dir, file);
    if (!existsSync(full)) return res.status(404).json({ error: 'No such clip.' });
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.type(FORMATS[file.split('.').pop()]);
    res.sendFile(full, { dotfiles: 'deny' });
  });

  return router;
}
