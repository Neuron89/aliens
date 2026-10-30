import { useCallback, useEffect, useRef, useState } from 'react';

/* Sound + vibration cues (Web Audio, no files). Mute is shared across the app
   via localStorage 'muthur.muted'; phones keep the existing SOUND/MUTED toggle.
   Cues: alert (message), handout, clue, tick (clock), orders (new act agenda),
   loot (item received), pause (X-card, GM side), seen (receipt). */
const MUTE_KEY = 'muthur.muted';
export const readMuted = () => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } };

const CUES = {
  alert: { tones: [[880, 0, 0.12], [660, 0.14, 0.12]], type: 'square', vibrate: 200 },
  handout: { tones: [[520, 0, 0.09], [780, 0.1, 0.09], [1040, 0.2, 0.16]], type: 'triangle', vibrate: [80, 60, 120] },
  clue: { tones: [[660, 0, 0.1], [990, 0.12, 0.2]], type: 'sine', vibrate: 120 },
  tick: { tones: [[220, 0, 0.07], [180, 0.08, 0.1]], type: 'square', vibrate: 60, gain: 0.1 },
  orders: { tones: [[330, 0, 0.18], [440, 0.2, 0.18], [330, 0.4, 0.3]], type: 'sawtooth', vibrate: [200, 100, 200], gain: 0.08 },
  loot: { tones: [[784, 0, 0.08], [988, 0.09, 0.08], [1319, 0.18, 0.2]], type: 'triangle', vibrate: 100 },
  pause: { tones: [[440, 0, 0.35], [440, 0.5, 0.35]], type: 'sine', vibrate: 0, gain: 0.1 },
  seen: { tones: [[1200, 0, 0.05]], type: 'sine', vibrate: 0, gain: 0.05 },
};

export function useFx() {
  const [muted, setMuted] = useState(readMuted);
  const mutedRef = useRef(muted);
  const ctxRef = useRef(null);

  useEffect(() => {
    mutedRef.current = muted;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* ignore */ }
  }, [muted]);

  // Browsers only allow audio after a user gesture: unlock on first touch.
  useEffect(() => {
    const unlock = () => {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!ctxRef.current) ctxRef.current = new AC();
        if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
      } catch { /* audio unavailable */ }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const play = useCallback((name = 'alert', { vibrate = true } = {}) => {
    if (mutedRef.current) return;
    const cue = CUES[name] || CUES.alert;
    if (vibrate && cue.vibrate) { try { navigator.vibrate?.(cue.vibrate); } catch { /* ignore */ } }
    try {
      const ctx = ctxRef.current;
      if (!ctx || ctx.state !== 'running') return;
      const t0 = ctx.currentTime;
      for (const [freq, at, dur] of cue.tones) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = cue.type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + at);
        gain.gain.exponentialRampToValueAtTime(cue.gain || 0.12, t0 + at + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0 + at);
        osc.stop(t0 + at + dur + 0.02);
      }
    } catch { /* ignore */ }
  }, []);

  return { muted, setMuted, play };
}

/** prefers-reduced-motion */
export const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** Typewriter reveal; instant under reduced motion. Returns the visible prefix. */
export function useTypewriter(text, { cps = 45, key } = {}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const full = String(text || '');
    if (!full || reducedMotion()) { setN(full.length); return undefined; }
    setN(0);
    let i = 0;
    const step = Math.max(1, Math.round(full.length / 400)); // long texts finish in ≤ ~9 s
    const t = setInterval(() => {
      i = Math.min(full.length, i + step);
      setN(i);
      if (i >= full.length) clearInterval(t);
    }, 1000 / cps);
    return () => clearInterval(t);
  }, [text, cps, key]);
  return String(text || '').slice(0, n);
}
