import { useState, useRef, useCallback, useEffect } from 'react';
import { useGame } from '../GameContext';
import { useUniverse } from '../UniverseContext';
import { audioCtx, ambienceInput, isDucked, DUCK_LEVEL } from '../soundboard';
import { apiHeaders } from '../apiToken';

/* ═══════════════════════════════════════════════════════════════
   Narration read-aloud — provider-aware.
   - provider 'server': the app's voice server (server/tts.js, Kokoro) answers
     (`ttsStatus.ok` from GameContext). speak(paragraphs) POSTs each paragraph
     to /api/tts/speak as SSE (Accept: text/event-stream): the server sends one
     clip per sentence group (~12–25 words) as soon as it is ready, so playback
     starts after ~1 s; the next paragraph is requested once this one is fully
     synthesized. A failure before the first clip falls back to the browser
     voice for the rest of the queue.
   - provider 'browser': the Web Speech API (robotic, but always there).
     Every utterance carries the generation it was queued in: cancel() fires
     the old utterance's onerror('interrupted'/'canceled') asynchronously, so
     skip/stop bump the generation and stale callbacks are ignored.
   On the GM tablet the hook also plays speeches aimed at the GM (target 'gm' |
   'both', from narrate-speak: table-speak → table-speak-part… → table-speak-done)
   and stops on `table-speak-stop`.
   Public API (unchanged + provider): isSpeaking, isPaused, currentIndex, voices,
   selectedVoice, rate, pitch, speak, pause, resume, stop, skipForward, skipBack,
   setSelectedVoice, setRate, setPitch, provider.
   In server mode `voices` are { id, name: id, label, lang, gender } (TTSControls
   reads .name / .lang) and voice + speed live in the shared voice prefs below.
   ═══════════════════════════════════════════════════════════════ */
const speech = () => (typeof window !== 'undefined' && window.speechSynthesis) || null;

/* ─── Shared voice prefs (NARRATE drawer, READ ALOUD, AI GM) ─────────────
   localStorage muthur.voiceTarget = 'off' | 'tv' | 'gm' | 'both'  (default 'tv'; UI labels OFF | TV | HERE | BOTH)
   localStorage muthur.voice       = { [universeId]: { voice, speed } }  (default: theme.voice) */
const TARGET_KEY = 'muthur.voiceTarget';
const PREFS_KEY = 'muthur.voice';
const PREFS_EVENT = 'muthur-voice-prefs';
export const VOICE_TARGETS = ['off', 'tv', 'gm', 'both'];
export const SPEED_RANGE = [0.8, 1.2];
const readJSON = (k, d) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : d; } catch { return d; } };
const notify = () => { try { window.dispatchEvent(new Event(PREFS_EVENT)); } catch { /* no window */ } };

export function getVoiceTarget() {
  try { const v = localStorage.getItem(TARGET_KEY); return VOICE_TARGETS.includes(v) ? v : 'tv'; } catch { return 'tv'; }
}
export function setVoiceTarget(v) {
  if (!VOICE_TARGETS.includes(v)) return;
  try { localStorage.setItem(TARGET_KEY, v); } catch { /* storage unavailable */ }
  notify();
}
/** The universe's narrator default (theme.voice): { narrator, speed }. */
export const themeVoice = (theme) => ({ narrator: theme?.voice?.narrator || '', speed: Number(theme?.voice?.speed) || 1 });
export function getVoicePrefs(universeId, theme) {
  const d = themeVoice(theme);
  const p = readJSON(PREFS_KEY, {})?.[universeId || '_'] || {};
  const speed = Number(p.speed);
  return { voice: typeof p.voice === 'string' && p.voice ? p.voice : d.narrator, speed: Number.isFinite(speed) && speed > 0 ? speed : d.speed };
}
export function setVoicePrefs(universeId, patch) {
  const all = readJSON(PREFS_KEY, {}) || {};
  const k = universeId || '_';
  all[k] = { ...(all[k] || {}), ...patch };
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(all)); } catch { /* storage unavailable */ }
  notify();
}
/** Re-render when any voice pref changes (this tab: custom event; other tabs: storage). */
function usePrefsTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener(PREFS_EVENT, bump);
    window.addEventListener('storage', bump);
    return () => { window.removeEventListener(PREFS_EVENT, bump); window.removeEventListener('storage', bump); };
  }, []);
}
/** [target, setTarget] — 'off' | 'tv' | 'gm' | 'both', persisted, shared across components. */
export function useVoiceTarget() {
  usePrefsTick();
  return [getVoiceTarget(), setVoiceTarget];
}
/** { voice, speed, setVoice, setSpeed, theme default } for the active universe. */
export function useVoicePrefs() {
  usePrefsTick();
  const u = useUniverse()?.universe;
  const id = u?.id || '_';
  const p = getVoicePrefs(id, u?.theme);
  return {
    ...p,
    narrator: themeVoice(u?.theme).narrator,
    defaultSpeed: themeVoice(u?.theme).speed,
    setVoice: (voice) => setVoicePrefs(id, { voice }),
    setSpeed: (speed) => setVoicePrefs(id, { speed }),
  };
}

/* ─── Ambience duck for server voice ─────────────────────────────
   soundboard.setDucked() is driven by a speechSynthesis poll that would undo a
   duck within 150 ms, so the server voice ramps the ambience bus directly
   (the poll only acts on a change of the Web Speech state). */
let voiceDucks = 0;
export function voiceDuck(on) {
  voiceDucks = Math.max(0, voiceDucks + (on ? 1 : -1));
  const ac = audioCtx();
  const bus = ac && ambienceInput();
  if (!bus) return;
  const down = voiceDucks > 0 || isDucked();
  try { bus.gain.setTargetAtTime(down ? DUCK_LEVEL : 1, ac.currentTime, down ? 0.08 : 0.5); } catch { /* closed context */ }
}

/* ─── Speech streams ──────────────────────────────────────────────
   A stream is { parts: [{ url, ms }] (by index), done, error, wait() }: parts arrive one sentence
   group at a time (server synthesizes ~12–25 words per clip), so playback starts after the first. */
export function makeStream() {
  const st = { parts: [], done: false, error: null, waiters: [] };
  st.wake = () => { const w = st.waiters; st.waiters = []; w.forEach((f) => f()); };
  st.wait = () => new Promise((r) => st.waiters.push(r));
  st.push = (index, part) => { if (part?.url) { st.parts[index] = { url: part.url, ms: Number(part.ms) || 0 }; st.wake(); } };
  st.finish = (error = null) => { st.done = true; st.error = error; st.wake(); };
  return st;
}

/** POST /api/tts/speak with Accept: text/event-stream → a stream filled as `part` events arrive. */
export function streamSpeech(text, { voice, speed } = {}, signal) {
  const st = makeStream();
  (async () => {
    const res = await fetch('/api/tts/speak', {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json', Accept: 'text/event-stream' }),
      body: JSON.stringify({ text, voice: voice || undefined, speed }),
      signal,
    });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !/event-stream/.test(type) || !res.body) {
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.parts)) { data.parts.forEach((p, i) => st.push(i, p)); return st.finish(); }
      const err = new Error(data.message || data.error || `voice ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let k;
      while ((k = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, k);
        buf = buf.slice(k + 2);
        const ev = /^event: (.+)$/m.exec(block)?.[1];
        let data = null;
        try { data = JSON.parse(/^data: (.+)$/m.exec(block)?.[1] || 'null'); } catch { /* skip */ }
        if (ev === 'part' && data) st.push(data.index, data);
        else if (ev === 'error') throw new Error(data?.message || 'voice failed');
      }
    }
    st.finish();
  })().catch((err) => { if (!st.done) st.finish(err); });
  return st;
}

export function useTTS() {
  const game = useGame() || {};
  const { ttsStatus, refreshTts, onSpeak, onSpeakPart, onSpeakDone, onSpeakStop, connected, role } = game;
  const prefs = useVoicePrefs();
  const provider = ttsStatus?.ok ? 'server' : 'browser';

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [browserVoices, setBrowserVoices] = useState([]);
  const [browserVoice, setBrowserVoice] = useState(null);
  const [browserRate, setBrowserRate] = useState(0.85);
  const [pitch, setPitch] = useState(0.9);

  const paragraphsRef = useRef([]);
  const indexRef = useRef(-1);
  const cancelledRef = useRef(false);
  const genRef = useRef(0);
  const audioRef = useRef(null);       // server clips
  const clipsRef = useRef(new Map());  // paragraph index → speech stream
  const resolveRef = useRef(null);     // ends the clip being awaited (stop / skip)
  const abortRef = useRef(null);
  const duckedRef = useRef(false);

  useEffect(() => {
    const synth = speech();
    if (!synth) return undefined;
    const loadVoices = () => {
      const available = synth.getVoices();
      setBrowserVoices(available);
      if (available.length > 0 && !browserVoice) {
        const english = available.find(v => v.lang.startsWith('en') && /(^|[^a-z])male([^a-z]|$)/i.test(v.name))
          || available.find(v => v.lang.startsWith('en'))
          || available[0];
        setBrowserVoice(english);
      }
    };
    loadVoices();
    synth.onvoiceschanged = loadVoices;
    return () => { synth.onvoiceschanged = null; };
  }, [browserVoice]);

  /* ── server voice list in the shape TTSControls expects ── */
  const serverVoices = (ttsStatus?.voices || []).map((v) => ({ id: v.id, name: v.id, label: v.name || v.id, lang: v.lang || 'en', gender: v.gender, voiceURI: v.id }));
  const serverSelected = serverVoices.find((v) => v.id === prefs.voice)
    || (prefs.voice ? { id: prefs.voice, name: prefs.voice, label: prefs.voice, lang: 'en', voiceURI: prefs.voice } : serverVoices[0] || null);

  const setDuck = useCallback((on) => {
    if (duckedRef.current === on) return;
    duckedRef.current = on;
    voiceDuck(on);
  }, []);

  const finish = useCallback(() => {
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentIndex(-1);
    indexRef.current = -1;
    setDuck(false);
  }, [setDuck]);

  /* ── browser (Web Speech) path ── */
  const speakParagraph = useCallback((index) => {
    const synth = speech();
    if (!synth || index >= paragraphsRef.current.length || cancelledRef.current) {
      finish();
      return;
    }
    indexRef.current = index;
    setCurrentIndex(index);
    const utterance = new SpeechSynthesisUtterance(paragraphsRef.current[index]);
    utterance.rate = browserRate;
    utterance.pitch = pitch;
    if (browserVoice) utterance.voice = browserVoice;
    const gen = genRef.current;
    utterance.onend = () => {
      if (gen === genRef.current && !cancelledRef.current) speakParagraph(index + 1);
    };
    utterance.onerror = (e) => {
      if (gen !== genRef.current) return; // cancelled by skip/stop/speak
      if (e.error !== 'canceled' && e.error !== 'interrupted') console.error('TTS error:', e);
      if (!cancelledRef.current) speakParagraph(index + 1);
    };
    synth.speak(utterance);
  }, [browserRate, pitch, browserVoice, finish]);

  /* ── server path ── */
  const audioEl = () => {
    if (!audioRef.current && typeof Audio !== 'undefined') audioRef.current = new Audio();
    return audioRef.current;
  };
  const haltAudio = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    for (const st of clipsRef.current.values()) st.wake();
    clipsRef.current = new Map();
    const a = audioRef.current;
    if (a) { a.onended = null; a.onerror = null; a.pause(); a.removeAttribute('src'); try { a.load(); } catch { /* ignore */ } }
    resolveRef.current?.();
    resolveRef.current = null;
  };
  const voiceRef = useRef({});
  voiceRef.current = { voice: serverSelected?.id || prefs.voice, speed: prefs.speed };

  const clipFor = (index) => {
    if (!clipsRef.current.has(index)) {
      if (!abortRef.current) abortRef.current = new AbortController();
      clipsRef.current.set(index, streamSpeech(paragraphsRef.current[index], voiceRef.current, abortRef.current.signal));
    }
    return clipsRef.current.get(index);
  };

  /** Play a stream's parts in order as they arrive (~120 ms apart); true at the end, false if superseded. */
  const playStream = useCallback(async (st, gen) => {
    const a = audioEl();
    let i = 0;
    for (;;) {
      if (gen !== genRef.current) return false;
      const part = st.parts[i];
      if (part) {
        if (i > 0) await new Promise((r) => setTimeout(r, 120));
        if (gen !== genRef.current) return false;
        if (a) {
          await new Promise((res) => {
            resolveRef.current = res;
            a.onended = res;
            a.onerror = res;
            a.src = part.url;
            // Autoplay refused (no gesture yet): let the clip's time pass so the queue still advances.
            a.play().catch(() => setTimeout(res, Math.max(300, part.ms || 1000)));
          });
        }
        i++;
        continue;
      }
      if (st.done) {
        if (st.error && i === 0) throw st.error;
        return true;
      }
      await st.wait();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const serverParagraph = useCallback(async (index, gen) => {
    if (gen !== genRef.current) return;
    if (index >= paragraphsRef.current.length || cancelledRef.current) { finish(); return; }
    indexRef.current = index;
    setCurrentIndex(index);
    const st = clipFor(index);
    // The voice server works one request at a time: fetch the next paragraph once this one is synthesized.
    if (index + 1 < paragraphsRef.current.length) {
      (async () => { while (!st.done) await st.wait(); if (gen === genRef.current && !st.error) clipFor(index + 1); })();
    }
    setDuck(true);
    let ended;
    try {
      ended = await playStream(st, gen);
    } catch (err) {
      if (gen !== genRef.current) return;
      // Server voice failed before saying anything: finish the queue with the browser voice.
      console.warn('[voice] server voice failed, using the browser voice:', err?.message || err);
      refreshTts?.();
      setDuck(false);
      speakParagraph(index);
      return;
    }
    if (ended && gen === genRef.current && !cancelledRef.current) serverParagraph(index + 1, gen);
  }, [finish, playStream, refreshTts, setDuck, speakParagraph]); // eslint-disable-line react-hooks/exhaustive-deps

  const begin = useCallback((paragraphs) => {
    genRef.current += 1;
    speech()?.cancel();
    haltAudio();
    cancelledRef.current = false;
    paragraphsRef.current = (paragraphs || []).filter((p) => typeof p === 'string' && p.trim());
    setIsSpeaking(true);
    setIsPaused(false);
    return genRef.current;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const speak = useCallback((paragraphs) => {
    const gen = begin(paragraphs);
    if (!paragraphsRef.current.length) { finish(); return; }
    if (provider === 'server') serverParagraph(0, gen);
    else if (speech()) speakParagraph(0);
    else finish();
  }, [begin, finish, provider, serverParagraph, speakParagraph]);

  /** Play a `table-speak` stream (target gm/both) on this tablet; speeches queue behind each other. */
  const evChainRef = useRef(Promise.resolve());
  const stopEpochRef = useRef(0);
  const playEvent = useCallback((st, text) => {
    const epoch = stopEpochRef.current;
    evChainRef.current = evChainRef.current.then(async () => {
      if (epoch !== stopEpochRef.current) return;
      const gen = begin([text || '']);
      indexRef.current = 0;
      setCurrentIndex(0);
      setDuck(true);
      const ended = await playStream(st, gen).catch(() => true);
      if (ended && gen === genRef.current) finish();
    });
  }, [begin, finish, playStream, setDuck]);

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) audioRef.current.pause();
    else speech()?.pause();
    setIsPaused(true);
    setDuck(false);
  }, [setDuck]);

  const resume = useCallback(() => {
    if (audioRef.current?.src && audioRef.current.paused) { audioRef.current.play().catch(() => {}); setDuck(true); }
    else speech()?.resume();
    setIsPaused(false);
  }, [setDuck]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    genRef.current += 1;
    stopEpochRef.current += 1;
    speech()?.cancel();
    haltAudio();
    finish();
  }, [finish]); // eslint-disable-line react-hooks/exhaustive-deps

  const jump = useCallback((to) => {
    if (to < 0 || to >= paragraphsRef.current.length) return;
    genRef.current += 1;
    speech()?.cancel();
    const a = audioRef.current;
    if (a) { a.onended = null; a.onerror = null; a.pause(); }
    resolveRef.current?.();
    setIsPaused(false);
    if (provider === 'server') serverParagraph(to, genRef.current);
    else speakParagraph(to);
  }, [provider, serverParagraph, speakParagraph]);
  const skipForward = useCallback(() => {
    if (indexRef.current < paragraphsRef.current.length - 1) jump(indexRef.current + 1);
  }, [jump]);
  const skipBack = useCallback(() => {
    if (indexRef.current > 0) jump(indexRef.current - 1);
  }, [jump]);

  /* GM tablet: every speech is echoed to the DM socket; the ones aimed at the GM (gm/both) play here
     as their parts arrive. STOP from anywhere cuts it. */
  const playEventRef = useRef(playEvent);
  playEventRef.current = playEvent;
  const stopRef = useRef(stop);
  stopRef.current = stop;
  useEffect(() => {
    if (!connected || role !== 'dm' || typeof onSpeak !== 'function') return undefined;
    const streams = new Map(); // id → stream
    const offA = onSpeak((evt) => {
      if (!evt?.id || (evt.target !== 'gm' && evt.target !== 'both')) return;
      const st = makeStream();
      streams.set(evt.id, st);
      if (streams.size > 12) streams.delete(streams.keys().next().value);
      playEventRef.current(st, evt.text);
    });
    const offP = typeof onSpeakPart === 'function' ? onSpeakPart((e) => streams.get(e?.id)?.push(e.index, e)) : () => {};
    const offD = typeof onSpeakDone === 'function' ? onSpeakDone((e) => { const st = streams.get(e?.id); if (st) { st.finish(e.error ? new Error(e.error) : null); streams.delete(e.id); } }) : () => {};
    const offB = typeof onSpeakStop === 'function' ? onSpeakStop(() => { for (const st of streams.values()) st.finish(); streams.clear(); stopRef.current(); }) : () => {};
    return () => { offA(); offP(); offD(); offB(); };
  }, [connected, role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    cancelledRef.current = true;
    genRef.current += 1;
    speech()?.cancel();
    abortRef.current?.abort();
    if (audioRef.current) audioRef.current.pause();
    if (duckedRef.current) { duckedRef.current = false; voiceDuck(false); }
  }, []);

  const server = provider === 'server';
  return {
    provider,
    isSpeaking,
    isPaused,
    currentIndex,
    voices: server ? serverVoices : browserVoices,
    selectedVoice: server ? serverSelected : browserVoice,
    rate: server ? prefs.speed : browserRate,
    pitch,
    speak,
    pause,
    resume,
    stop,
    skipForward,
    skipBack,
    setSelectedVoice: server ? (v) => { if (v) prefs.setVoice(v.id || v.name); } : setBrowserVoice,
    setRate: server ? (r) => prefs.setSpeed(Math.round(Number(r) * 100) / 100) : setBrowserRate,
    setPitch,
  };
}

/**
 * READ ALOUD routing for the GM run view (RunScene / SceneList): with the server voice and a
 * VOICE target of TV / HERE / BOTH it goes through `narrate-speak` (GameContext.speak — the TV
 * plays it, and this tablet plays it for HERE/BOTH via useTTS above); otherwise it reads locally
 * with `tts` (server voice or browser fallback).
 * → { read(paragraphs, title?), stop(), live, routed }
 */
export function useReadAloud(tts) {
  const { ttsStatus, speak, speakStop, voiceLive, gameCode, role } = useGame() || {};
  const [target] = useVoiceTarget();
  const prefs = useVoicePrefs();
  const routed = !!(ttsStatus?.ok && typeof speak === 'function' && role === 'dm' && gameCode && target !== 'off');
  const read = (paragraphs, title) => {
    const list = (Array.isArray(paragraphs) ? paragraphs : [paragraphs]).filter((p) => typeof p === 'string' && p.trim());
    if (!list.length) return;
    if (routed) speak(list.join('\n\n'), { target, title, voice: prefs.voice, speed: prefs.speed });
    else tts?.speak(list);
  };
  const stop = () => {
    tts?.stop();
    if (voiceLive && typeof speakStop === 'function') speakStop();
  };
  return { read, stop, live: !!(tts?.isSpeaking || voiceLive), routed, target };
}
