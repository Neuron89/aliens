import { useRef, useState, useCallback, useEffect } from 'react';
import { useGame } from '../GameContext';
import { isMuted } from '../sfx';
import { AMBIENCE, audioCtx, ambienceInput, startAmbience, playStinger } from '../soundboard';

/* ═══════════════════════════════════════════════════════════════
   Ambient beds for the GM terminal (App) and the TV (board/BoardAudio).
   Two kinds of preset:
     - procedural beds from soundboard.js AMBIENCE (seeded noise,
       drones, LFOs and scheduled events: drips, creaks, gusts…)
     - legacy oscillator stacks ({ nodes }) kept for packs that name them
   Every bed plays into this hook's master gain → the shared duck bus,
   so it drops under TTS narration (soundboard.js polls speechSynthesis).
   Theme order/visibility: universe.theme.ambient (Nav AUDIO popover).

   Phone stingers: App mounts this hook for every role, so a seated
   phone listens for `table-sfx` here (only when the GM routed the cue to
   phones and the phone's own sound is on — sfx.js mute).
   ═══════════════════════════════════════════════════════════════ */

const bed = (id) => ({ label: AMBIENCE[id].label, bed: id });

const PRESETS = {
  off: { label: 'OFF', nodes: [] },
  /* ALIEN */
  ship: bed('ship'),          // ENGINE HUM
  derelict: bed('derelict'),  // DERELICT SILENCE
  hive: bed('hive'),          // HIVE (WET DRIP)
  tension: {
    label: 'TENSION',
    nodes: [
      { type: 'oscillator', wave: 'sawtooth', freq: 45, gain: 0.05, filterFreq: 200, filterQ: 5 },
      { type: 'oscillator', wave: 'sine', freq: 1.2, gain: 0.06, filterFreq: 20, filterQ: 1 },
      { type: 'oscillator', wave: 'square', freq: 110, gain: 0.015, filterFreq: 300, filterQ: 8 },
      { type: 'oscillator', wave: 'sawtooth', freq: 33, gain: 0.03, filterFreq: 90, filterQ: 4 },
      { type: 'lfo', target: 'filter', rate: 0.08, depth: 50 },
    ],
  },
  alert: {
    label: 'RED ALERT',
    nodes: [
      { type: 'oscillator', wave: 'square', freq: 220, gain: 0.03, filterFreq: 500, filterQ: 3 },
      { type: 'oscillator', wave: 'sawtooth', freq: 55, gain: 0.06, filterFreq: 150, filterQ: 4 },
      { type: 'oscillator', wave: 'sine', freq: 0.8, gain: 0.04, filterFreq: 10, filterQ: 1 },
      { type: 'lfo', target: 'freq', rate: 2.0, depth: 30 },
    ],
  },
  space: {
    label: 'DEEP SPACE',
    nodes: [
      { type: 'oscillator', wave: 'sine', freq: 80, gain: 0.02, filterFreq: 200, filterQ: 10 },
      { type: 'oscillator', wave: 'sine', freq: 120, gain: 0.015, filterFreq: 250, filterQ: 12 },
      { type: 'oscillator', wave: 'triangle', freq: 18, gain: 0.03, filterFreq: 50, filterQ: 2 },
      { type: 'lfo', target: 'gain', rate: 0.05, depth: 0.008 },
    ],
  },
  dread: {
    label: 'COSMIC DREAD',
    nodes: [
      { type: 'oscillator', wave: 'sawtooth', freq: 28, gain: 0.06, filterFreq: 60, filterQ: 6 },
      { type: 'oscillator', wave: 'sine', freq: 0.5, gain: 0.05, filterFreq: 8, filterQ: 1 },
      { type: 'oscillator', wave: 'square', freq: 165, gain: 0.01, filterFreq: 400, filterQ: 15 },
      { type: 'oscillator', wave: 'triangle', freq: 42, gain: 0.03, filterFreq: 100, filterQ: 5 },
      { type: 'lfo', target: 'filter', rate: 0.03, depth: 30 },
    ],
  },
  /* DUNE (scene.ambient: wind · bazaar · sietch · court; erg · keep from the AUDIO popover) */
  erg: bed('erg'),            // OPEN ERG
  wind: {
    label: 'DESERT WIND',
    nodes: [
      { type: 'oscillator', wave: 'sawtooth', freq: 31, gain: 0.05, filterFreq: 140, filterQ: 0.7 },
      { type: 'oscillator', wave: 'triangle', freq: 47, gain: 0.03, filterFreq: 260, filterQ: 0.5 },
      { type: 'oscillator', wave: 'sawtooth', freq: 73, gain: 0.015, filterFreq: 420, filterQ: 0.4 },
      { type: 'lfo', target: 'filter', rate: 0.07, depth: 90 },
    ],
  },
  sietch: bed('sietch'),      // SIETCH WIND
  keep: bed('keep'),          // KEEP INTERIOR
  bazaar: {
    label: 'BAZAAR',
    nodes: [
      { type: 'oscillator', wave: 'triangle', freq: 110, gain: 0.025, filterFreq: 600, filterQ: 1 },
      { type: 'oscillator', wave: 'triangle', freq: 165, gain: 0.018, filterFreq: 700, filterQ: 1 },
      { type: 'oscillator', wave: 'sawtooth', freq: 55, gain: 0.02, filterFreq: 200, filterQ: 2 },
      { type: 'lfo', target: 'gain', rate: 0.6, depth: 0.012 },
    ],
  },
  court: {
    label: 'IMPERIAL COURT',
    nodes: [
      { type: 'oscillator', wave: 'sine', freq: 98, gain: 0.025, filterFreq: 400, filterQ: 8 },
      { type: 'oscillator', wave: 'sine', freq: 147, gain: 0.018, filterFreq: 500, filterQ: 8 },
      { type: 'oscillator', wave: 'sawtooth', freq: 49, gain: 0.02, filterFreq: 120, filterQ: 3 },
      { type: 'lfo', target: 'filter', rate: 0.04, depth: 40 },
    ],
  },
};

/** Build a legacy oscillator stack into `out`; returns { stop() }. */
function startNodes(ctx, out, config) {
  const nodes = [];
  const oscNodes = [];
  config.nodes.forEach((node) => {
    if (node.type !== 'oscillator') return;
    const osc = ctx.createOscillator();
    osc.type = node.wave;
    osc.frequency.value = node.freq;
    const gain = ctx.createGain();
    gain.gain.value = node.gain;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = node.filterFreq;
    filter.Q.value = node.filterQ;
    osc.connect(filter); filter.connect(gain); gain.connect(out);
    osc.start();
    nodes.push(osc, gain, filter);
    oscNodes.push({ osc, gain, filter });
  });
  config.nodes.forEach((node) => {
    if (node.type !== 'lfo' || !oscNodes.length) return;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = node.rate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = node.depth;
    lfo.connect(lfoGain);
    for (const n of oscNodes) {
      if (node.target === 'gain') lfoGain.connect(n.gain.gain);
      else if (node.target === 'filter') lfoGain.connect(n.filter.frequency);
      else if (node.target === 'freq') lfoGain.connect(n.osc.frequency);
    }
    lfo.start();
    nodes.push(lfo, lfoGain);
  });
  return {
    stop() {
      for (const n of nodes) { try { n.stop?.(); n.disconnect?.(); } catch { /* already stopped */ } }
    },
  };
}

export function useAmbientAudio() {
  const runningRef = useRef(null);  // { stop() } of the current bed
  const masterRef = useRef(null);
  const [preset, setPreset] = useState('off');
  const [volume, setVolume] = useState(0.5);
  const volumeRef = useRef(0.5);
  const [isActive, setIsActive] = useState(false);
  const { role, connected, onSfx } = useGame();

  const master = useCallback(() => {
    const ctx = audioCtx();
    if (!ctx) return null;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (!masterRef.current || masterRef.current.context !== ctx) {
      masterRef.current = ctx.createGain();
      masterRef.current.gain.value = volumeRef.current;
      masterRef.current.connect(ambienceInput());
    }
    return masterRef.current;
  }, []);

  const stopAll = useCallback(() => {
    try { runningRef.current?.stop(); } catch { /* ignore */ }
    runningRef.current = null;
  }, []);

  const applyPreset = useCallback((presetName) => {
    stopAll();
    setPreset(presetName);
    const config = PRESETS[presetName];
    if (presetName === 'off' || !config) { setIsActive(false); return; }
    const out = master();
    if (!out) { setIsActive(false); return; }
    runningRef.current = config.bed ? startAmbience(config.bed, out) : startNodes(out.context, out, config);
    setIsActive(!!runningRef.current);
  }, [master, stopAll]);

  const updateVolume = useCallback((vol) => {
    volumeRef.current = vol;
    setVolume(vol);
    const m = masterRef.current;
    if (m) m.gain.setTargetAtTime(vol, m.context.currentTime, 0.05);
  }, []);

  useEffect(() => () => {
    stopAll();
    try { masterRef.current?.disconnect(); } catch { /* ignore */ }
    masterRef.current = null; // the shared context stays open; a remount builds a fresh master
  }, [stopAll]);

  /* Phone: GM stinger routed to phones (TV + PHONES). Respects this phone's sound toggle. */
  useEffect(() => {
    if (role !== 'player' || !connected || typeof onSfx !== 'function') return undefined;
    return onSfx((e) => {
      if (!e?.phones || isMuted()) return;
      playStinger(e.cue, { seed: e.seed, volume: 0.7 });
    });
  }, [role, connected]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    preset,
    volume,
    isActive,
    presets: PRESETS,
    applyPreset,
    updateVolume,
  };
}
