/* ═══════════════════════════════════════════════════════════════
   sfx — tiny synthesized UI cues (Web Audio oscillators + noise).
   No audio files. Each universe maps cue names to its own timbres via
   `theme.sfx` (UniverseContext calls setSfxTheme on universe change).

   API
     play(name, { volume })  fire-and-forget; no-op when muted, when no
                             AudioContext exists, or for unknown names.
     setMuted(bool) / isMuted()          persisted per device (localStorage)
     subscribeMuted(fn) → unsubscribe    for toggles that render mute state
     setSfxTheme(map)                    { [cue]: Note[] } (merged over defaults)
     reducedFx()                         true if the device asked for less motion
     CUES                                the canonical cue names

   Cue names: ui.tap, ui.confirm, alert.incoming, dice.settle, dice.crit,
   dice.botch, clock.tick, reveal.

   Note = { wave: 'sine'|'square'|'triangle'|'sawtooth'|'noise',
            freq, to?, at? (s offset), dur (s), gain (0..1),
            attack?, filter?: { type, freq, q } }
   ═══════════════════════════════════════════════════════════════ */

export const CUES = ['ui.tap', 'ui.confirm', 'alert.incoming', 'dice.settle', 'dice.crit', 'dice.botch', 'clock.tick', 'reveal', 'boot.key', 'boot.line', 'boot.ready'];

const MUTE_KEY = 'engine.fx.muted';

/* Neutral fallback timbres (soft sines). */
const DEFAULT_CUES = {
  'ui.tap': [{ wave: 'sine', freq: 880, dur: 0.04, gain: 0.08 }],
  'ui.confirm': [{ wave: 'sine', freq: 660, dur: 0.07, gain: 0.1 }, { wave: 'sine', freq: 990, at: 0.07, dur: 0.1, gain: 0.1 }],
  'alert.incoming': [{ wave: 'triangle', freq: 520, dur: 0.18, gain: 0.14 }, { wave: 'triangle', freq: 780, at: 0.2, dur: 0.25, gain: 0.14 }],
  'dice.settle': [{ wave: 'noise', dur: 0.06, gain: 0.12, filter: { type: 'bandpass', freq: 1800, q: 1.2 } }],
  'dice.crit': [{ wave: 'sine', freq: 660, dur: 0.1, gain: 0.12 }, { wave: 'sine', freq: 880, at: 0.1, dur: 0.1, gain: 0.12 }, { wave: 'sine', freq: 1320, at: 0.2, dur: 0.25, gain: 0.12 }],
  'dice.botch': [{ wave: 'triangle', freq: 220, to: 140, dur: 0.4, gain: 0.16 }],
  'clock.tick': [{ wave: 'sine', freq: 1200, dur: 0.025, gain: 0.06 }],
  reveal: [{ wave: 'sine', freq: 440, to: 660, dur: 0.35, gain: 0.08 }],
  /* Boot typing (fx/BootSequence.jsx): one tick per typed character, a chirp per finished line. */
  'boot.key': [{ wave: 'sine', freq: 1500, dur: 0.02, gain: 0.04 }],
  'boot.line': [{ wave: 'sine', freq: 990, dur: 0.06, gain: 0.06 }],
  'boot.ready': [{ wave: 'sine', freq: 660, dur: 0.08, gain: 0.08 }, { wave: 'sine', freq: 990, at: 0.09, dur: 0.16, gain: 0.08 }],
};

let cues = DEFAULT_CUES;
let ctx = null;
let noiseBuf = null;
const listeners = new Set();

function defaultMuted() {
  // Phones at the table start muted (research §(d)); tablets/desktops start with sound.
  try { return typeof window !== 'undefined' && window.matchMedia?.('(max-width: 600px) and (pointer: coarse)').matches; } catch { return false; }
}

let muted = (() => {
  try {
    const v = localStorage.getItem(MUTE_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch { /* storage unavailable */ }
  return defaultMuted();
})();

export function isMuted() { return muted; }

export function setMuted(v) {
  muted = !!v;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* ignore */ }
  for (const fn of listeners) fn(muted);
}

export function subscribeMuted(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setSfxTheme(map) {
  cues = { ...DEFAULT_CUES, ...(map || {}) };
}

/** True when the OS asks for reduced motion or the per-device REDUCE FX toggle is on. */
export function reducedFx() {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.classList.contains('fx-reduced')) return true;
  try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

function audio() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try { ctx = new AC(); } catch { ctx = null; }
  return ctx;
}

function noise(ac) {
  if (noiseBuf) return noiseBuf;
  const len = Math.floor(ac.sampleRate * 0.5);
  noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function voice(ac, out, n, t0) {
  const start = t0 + (n.at || 0);
  const dur = Math.max(0.01, n.dur || 0.08);
  const attack = Math.min(n.attack ?? 0.005, dur / 2);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, n.gain ?? 0.1), start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  let src;
  if (n.wave === 'noise') {
    src = ac.createBufferSource();
    src.buffer = noise(ac);
  } else {
    src = ac.createOscillator();
    src.type = n.wave || 'sine';
    src.frequency.setValueAtTime(n.freq || 440, start);
    if (n.to) src.frequency.exponentialRampToValueAtTime(n.to, start + dur);
  }
  let node = src;
  if (n.filter) {
    const f = ac.createBiquadFilter();
    f.type = n.filter.type || 'lowpass';
    f.frequency.value = n.filter.freq || 1000;
    f.Q.value = n.filter.q ?? 1;
    node.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(out);
  src.start(start);
  src.stop(start + dur + 0.02);
}

/** Play a cue by name. Safe to call anywhere (no-op on the server, when muted, or before a user gesture). */
export function play(name, { volume = 1 } = {}) {
  if (muted) return;
  const notes = cues[name];
  if (!notes?.length) return;
  const ac = audio();
  if (!ac) return;
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  try {
    const out = ac.createGain();
    out.gain.value = Math.max(0, Math.min(1, volume)) * 0.9;
    out.connect(ac.destination);
    const t0 = ac.currentTime + 0.01;
    for (const n of notes) voice(ac, out, n, t0);
  } catch { /* audio graph errors are never fatal */ }
}

export default { play, setMuted, isMuted, subscribeMuted, setSfxTheme, reducedFx, CUES };
