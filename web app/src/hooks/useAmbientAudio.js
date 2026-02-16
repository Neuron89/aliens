import { useRef, useState, useCallback, useEffect } from 'react';

const PRESETS = {
  off: { label: 'OFF', nodes: [] },
  ship: {
    label: 'SHIP AMBIENT',
    nodes: [
      { type: 'oscillator', wave: 'sawtooth', freq: 38, gain: 0.04, filterFreq: 80, filterQ: 2 },
      { type: 'oscillator', wave: 'sine', freq: 55, gain: 0.03, filterFreq: 120, filterQ: 1 },
      { type: 'oscillator', wave: 'triangle', freq: 22, gain: 0.02, filterFreq: 60, filterQ: 3 },
      { type: 'lfo', target: 'gain', rate: 0.15, depth: 0.01 },
    ],
  },
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
};

export function useAmbientAudio() {
  const ctxRef = useRef(null);
  const nodesRef = useRef([]);
  const masterGainRef = useRef(null);
  const [preset, setPreset] = useState('off');
  const [volume, setVolume] = useState(0.5);
  const [isActive, setIsActive] = useState(false);

  const ensureContext = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      masterGainRef.current = ctxRef.current.createGain();
      masterGainRef.current.gain.value = volume;
      masterGainRef.current.connect(ctxRef.current.destination);
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, [volume]);

  const stopAll = useCallback(() => {
    nodesRef.current.forEach(n => {
      try {
        if (n.stop) n.stop();
        if (n.disconnect) n.disconnect();
      } catch (e) { /* already stopped */ }
    });
    nodesRef.current = [];
  }, []);

  const applyPreset = useCallback((presetName) => {
    stopAll();
    setPreset(presetName);

    if (presetName === 'off') {
      setIsActive(false);
      return;
    }

    const ctx = ensureContext();
    const config = PRESETS[presetName];
    if (!config) return;

    const oscNodes = [];
    const filters = [];

    config.nodes.forEach(node => {
      if (node.type === 'oscillator') {
        const osc = ctx.createOscillator();
        osc.type = node.wave;
        osc.frequency.value = node.freq;

        const gain = ctx.createGain();
        gain.gain.value = node.gain;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = node.filterFreq;
        filter.Q.value = node.filterQ;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGainRef.current);
        osc.start();

        nodesRef.current.push(osc, gain, filter);
        oscNodes.push({ osc, gain, filter });
        filters.push(filter);
      }
    });

    config.nodes.forEach(node => {
      if (node.type === 'lfo' && oscNodes.length > 0) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = node.rate;

        const lfoGain = ctx.createGain();
        lfoGain.gain.value = node.depth;

        lfo.connect(lfoGain);

        if (node.target === 'gain') {
          oscNodes.forEach(n => lfoGain.connect(n.gain.gain));
        } else if (node.target === 'filter') {
          filters.forEach(f => lfoGain.connect(f.frequency));
        } else if (node.target === 'freq') {
          oscNodes.forEach(n => lfoGain.connect(n.osc.frequency));
        }

        lfo.start();
        nodesRef.current.push(lfo, lfoGain);
      }
    });

    setIsActive(true);
  }, [ensureContext, stopAll]);

  const updateVolume = useCallback((vol) => {
    setVolume(vol);
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = vol;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopAll();
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
      }
    };
  }, [stopAll]);

  return {
    preset,
    volume,
    isActive,
    presets: PRESETS,
    applyPreset,
    updateVolume,
  };
}
