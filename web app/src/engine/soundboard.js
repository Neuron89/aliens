/* ═══════════════════════════════════════════════════════════════
   soundboard — procedural stingers + scene ambience (Web Audio only,
   no audio files). Same spirit as sfx.js, but layered: every sound is
   built from oscillators with pitch paths, seeded noise through moving
   filters, envelopes, tremolo/LFOs, a soft saturator, stereo motion and
   a procedurally generated room reverb ("hull" metal for ALIEN, "open"
   air for DUNE).

   Seeded variation: every shot takes a 31-bit seed (the server picks
   one per `table-sfx` so the TV and the phones play the same variant;
   local previews pick a random one). The seed drives pitch, timing,
   counts and filter paths, so no two stingers sound identical.

   API
     STINGERS                      { [id]: { label, room, dur, build(k) } }
     AMBIENCE                      { [id]: build(k) → continuous scene bed }
     playStinger(id, { seed, volume })   fire-and-forget on the shared context
     renderStinger(ac, id, seed, { out, wet })  build into any graph (tests)
     startAmbience(id, out, seed)  → { stop() } (hooks/useAmbientAudio.js)
     audioCtx() / unlockAudio() / onAudioState(fn)  shared AudioContext
     ambienceInput()               duck bus input for ambience masters
     isDucked() / subscribeDuck(fn)  TTS ducking (speechSynthesis.speaking)
   ═══════════════════════════════════════════════════════════════ */

/* ─── seeded RNG ─── */
export function mulberry32(seed) {
  let a = (Number(seed) >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const randomSeed = () => Math.floor(Math.random() * 0x7fffffff);

const EPS = 0.0001;
const clampPos = (v) => Math.max(EPS, v);

/* ─── noise + reverb buffers ─── */
function noiseBuffer(ac, sec, color, rng) {
  const len = Math.max(1, Math.floor(ac.sampleRate * sec));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = rng() * 2 - 1;
    if (color === 'brown') {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else if (color === 'pink') {
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    } else d[i] = w;
  }
  return buf;
}

const irCache = new WeakMap(); // ac → { room: AudioBuffer }
function impulse(ac, room) {
  let m = irCache.get(ac);
  if (!m) { m = {}; irCache.set(ac, m); }
  if (m[room]) return m[room];
  const spec = room === 'open'
    ? { sec: 2.8, decay: 2.4, smooth: 0.28, early: [0.031, 0.047, 0.083] }
    : { sec: 1.9, decay: 3.4, smooth: 0.6, early: [0.007, 0.013, 0.019, 0.029] }; // hull: dense metallic early slaps
  const len = Math.floor(ac.sampleRate * spec.sec);
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const rng = mulberry32(room === 'open' ? 71 + ch : 13 + ch);
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const x = i / len;
      lp += ((rng() * 2 - 1) - lp) * spec.smooth;
      d[i] = lp * Math.pow(1 - x, spec.decay) * 0.6;
    }
    for (const e of spec.early) {
      const at = Math.floor((e + ch * 0.003) * ac.sampleRate);
      if (at < len) d[at] += (rng() > 0.5 ? 1 : -1) * 0.5;
    }
  }
  m[room] = buf;
  return buf;
}

/* ─── kit: the building blocks every sound is made of ─── */
function makeKit(ac, out, wet, t0, rng, track = null) {
  const r = (a, b) => a + (b - a) * rng();
  const ri = (a, b) => Math.floor(r(a, b + 1 - 1e-9));
  const pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];
  const keep = (n) => { if (track) track.push(n); return n; };
  const g = (v = 1) => { const n = ac.createGain(); n.gain.value = v; return n; };
  const filt = (type, f, q = 0.707) => {
    const n = ac.createBiquadFilter();
    n.type = type; n.frequency.value = f; n.Q.value = q;
    return n;
  };
  /** Wire a node to the dry out (× dry) and the reverb (× send). */
  const toOut = (node, send = 0.25, dry = 1) => {
    if (dry === 1) node.connect(out);
    else if (dry > 0) { const d = g(dry); node.connect(d); d.connect(out); }
    if (send > 0 && wet) { const s = g(send); node.connect(s); s.connect(wet); }
    return node;
  };
  /** Chain nodes in order, send the last to the output; returns the first (the input). */
  const route = (send, ...nodes) => {
    let dry = 1;
    if (typeof send === 'object' && send) { dry = send.dry ?? 1; send = send.send ?? 0.25; }
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
    toOut(nodes[nodes.length - 1], send, dry);
    return nodes[0];
  };
  /** Automate a param along [[dt, value]…] from t (s, relative to t0). */
  const pts = (param, t, list, mode = 'exp') => {
    const st = t0 + t;
    list.forEach(([dt, v], i) => {
      const at = st + dt;
      if (i === 0) param.setValueAtTime(mode === 'exp' ? clampPos(v) : v, at);
      else if (mode === 'exp') param.exponentialRampToValueAtTime(clampPos(v), at);
      else param.linearRampToValueAtTime(v, at);
    });
  };
  /** Gain envelope: shape [[dt, level]…] (linear) or attack/hold/release (exponential). */
  const env = (param, t, o, dur) => {
    if (o.shape) { pts(param, t, o.shape.map(([dt, v]) => [dt, v * (o.gain ?? 1)]), 'lin'); return; }
    const st = t0 + t;
    const peak = clampPos(o.gain ?? 0.2);
    const a = Math.min(o.a ?? 0.005, dur * 0.9);
    param.setValueAtTime(EPS, st);
    param.exponentialRampToValueAtTime(peak, st + a);
    if (o.hold != null) {
      param.setValueAtTime(peak, st + a + o.hold);
      param.exponentialRampToValueAtTime(EPS, st + a + o.hold + (o.r ?? 0.1));
    } else param.exponentialRampToValueAtTime(EPS, st + dur);
  };
  const connectTo = (node, dest, send) => {
    if (!dest) toOut(node, send ?? 0.25);
    else for (const d of [].concat(dest)) node.connect(d);
  };
  /** Amplitude tremolo inserted after `node`; returns the tremolo gain. */
  const tremolo = (node, t, dur, tr) => {
    const tg = g(1 - (tr.depth ?? 0.5));
    const l = ac.createOscillator();
    l.type = tr.type || 'sine';
    l.frequency.setValueAtTime(tr.rate, t0 + t);
    if (tr.rateTo) l.frequency.linearRampToValueAtTime(tr.rateTo, t0 + t + dur);
    const lg = g(tr.depth ?? 0.5);
    l.connect(lg); lg.connect(tg.gain);
    l.start(t0 + t); l.stop(t0 + t + dur + 0.05);
    node.connect(tg);
    return tg;
  };
  /** One oscillator voice. o: { type, f | path:[[dt,f]…], t, dur, a, hold, r | shape, gain, detune, dest, send, trem } */
  const tone = (o) => {
    const t = o.t || 0;
    const dur = o.dur ?? (o.hold != null ? (o.a ?? 0.005) + o.hold + (o.r ?? 0.1) : 0.3);
    const osc = ac.createOscillator();
    osc.type = o.type || 'sine';
    if (o.detune) osc.detune.value = o.detune;
    if (o.path) pts(osc.frequency, t, o.path, o.glide || 'exp');
    else osc.frequency.setValueAtTime(o.f || 440, t0 + t);
    const e = g(0);
    env(e.gain, t, o, dur);
    osc.connect(e);
    connectTo(o.trem ? tremolo(e, t, dur, o.trem) : e, o.dest, o.send);
    osc.start(t0 + t);
    osc.stop(t0 + t + dur + 0.05);
    return { osc, e };
  };
  /** One seeded noise burst. o: { color, t, dur, a, hold, r | shape, gain, dest, send, trem } */
  const noise = (o) => {
    const t = o.t || 0;
    const dur = o.dur ?? (o.hold != null ? (o.a ?? 0.005) + o.hold + (o.r ?? 0.1) : 0.3);
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac, dur + 0.06, o.color || 'white', rng);
    const e = g(0);
    env(e.gain, t, o, dur);
    src.connect(e);
    connectTo(o.trem ? tremolo(e, t, dur, o.trem) : e, o.dest, o.send);
    src.start(t0 + t);
    src.stop(t0 + t + dur + 0.05);
    return { src, e };
  };
  /** Low-frequency modulation of any param over [t, t+dur] (dur omitted → runs until stopped). */
  const lfo = ({ type = 'sine', rate, depth, param, t = 0, dur = null }) => {
    const l = keep(ac.createOscillator());
    l.type = type;
    l.frequency.value = rate;
    const lg = g(depth);
    l.connect(lg); lg.connect(param);
    l.start(t0 + t);
    if (dur != null) l.stop(t0 + t + dur + 0.05);
    return l;
  };
  /** Soft-clip saturator (tanh). */
  const shaper = (amt = 2) => {
    const n = ac.createWaveShaper();
    const N = 1024, c = new Float32Array(N);
    for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1; c[i] = Math.tanh(x * amt) / Math.tanh(amt); }
    n.curve = c;
    n.oversample = '2x';
    return n;
  };
  const panner = (v = 0) => {
    if (!ac.createStereoPanner) return g(1);
    const p = ac.createStereoPanner();
    p.pan.value = v;
    return p;
  };
  const delay = (sec, max = 1.5) => { const d = ac.createDelay(max); d.delayTime.value = sec; return d; };
  /* Continuous (ambience) sources: started now, stopped by the bed's stop(). */
  const drone = ({ type = 'sine', f, gain = 0.05, detune = 0, dest, send }) => {
    const osc = keep(ac.createOscillator());
    osc.type = type; osc.frequency.value = f; if (detune) osc.detune.value = detune;
    const e = g(gain);
    osc.connect(e); connectTo(e, dest, send);
    osc.start(t0);
    return { osc, e };
  };
  const loopNoise = ({ color = 'white', gain = 0.1, dest, send, sec = 5 }) => {
    const src = keep(ac.createBufferSource());
    src.buffer = noiseBuffer(ac, sec, color, rng);
    src.loop = true;
    const e = g(gain);
    src.connect(e); connectTo(e, dest, send);
    src.start(t0);
    return { src, e };
  };
  return { ac, t0, rng, r, ri, pick, g, filt, toOut, route, pts, tone, noise, lfo, shaper, panner, delay, drone, loopNoise, out, wet };
}

/* Shared one-shot gestures (used by stingers and ambience events). */
function clunk(k, t, f, level = 1) {
  k.tone({ type: 'sine', t, dur: 0.45, a: 0.003, gain: 0.7 * level, path: [[0, f * 1.6], [0.1, f], [0.45, f * 0.6]], send: 0.3 });
  k.noise({ color: 'brown', t, dur: 0.18, a: 0.002, gain: 0.7 * level, dest: k.route(0.3, k.filt('lowpass', 900, 1)) });
  const m0 = k.r(300, 370);
  [1, 2.41, 3.93, 5.2].forEach((m, i) => k.tone({ type: 'triangle', t: t + 0.004, dur: 0.38 / (1 + i * 0.3), a: 0.002, gain: (0.07 * level) / (1 + i * 0.6), f: m0 * m, send: 0.5 }));
}
function creak(k, t, level = 1) {
  const d = k.r(0.18, 0.55), cf = k.r(140, 360);
  const bp = k.filt('bandpass', cf * k.r(2, 3.5), k.r(6, 14));
  const cg = k.g(0.5);
  bp.connect(cg); k.toOut(cg, 0.5);
  k.tone({ type: 'square', t, dur: d, a: 0.03, gain: k.r(0.15, 0.3) * level, dest: bp, path: [[0, cf], [d, cf * k.r(0.7, 1.3)]] });
  k.lfo({ type: 'square', rate: k.r(22, 55), depth: 0.5, param: cg.gain, t, dur: d }); // stick-slip chatter
}
function drip(k, t, level = 1, deep = false) {
  const f = deep ? k.r(500, 900) : k.r(900, 2300);
  k.tone({ type: 'sine', t, dur: deep ? 0.22 : 0.13, a: 0.002, gain: k.r(0.03, 0.08) * level, path: [[0, f], [0.035, f * k.r(1.45, 1.9)]], send: 0.75 });
}

/* ═══ STINGERS ═══ */
export const STINGERS = {
  /* ── ALIEN ── */
  klaxon: {
    label: 'KLAXON', room: 'hull', dur: 3.4,
    build(k) {
      const { r, ri } = k;
      const base = r(330, 420), n = ri(3, 4), on = r(0.5, 0.62), off = r(0.12, 0.2);
      const drive = k.shaper(r(2.5, 4));
      k.route(0.35, drive, k.filt('bandpass', r(1100, 1500), 0.7), k.filt('lowpass', 3800), k.g(0.42));
      for (let i = 0; i < n; i++) {
        const st = i * (on + off), droop = 1 - i * r(0, 0.025);
        for (const [type, mult, det, gn] of [['sawtooth', 1, -7, 0.22], ['square', 1, 6, 0.14], ['sawtooth', 0.5, 0, 0.12]]) {
          const f = base * mult * droop;
          k.tone({ type, t: st, a: 0.03, hold: on - 0.1, r: 0.07, gain: gn, dest: drive, detune: det, path: [[0, f * 0.82], [on * 0.75, f * 1.22], [on, f * 1.18]] });
        }
        // diaphragm rasp (noise into the same saturator) + the relay clack that starts each blast
        k.noise({ t: st, a: 0.04, hold: on - 0.12, r: 0.08, gain: r(0.05, 0.08), dest: drive });
        k.noise({ t: st, dur: 0.02, a: 0.001, gain: 0.12, dest: k.route(0.2, k.filt('highpass', 2500)) });
      }
    },
  },
  'hull-groan': {
    label: 'HULL GROAN', room: 'hull', dur: 4.6,
    build(k) {
      const { r, ri } = k;
      const f = r(36, 50);
      const lp = k.filt('lowpass', 90, 9);
      k.pts(lp.frequency, 0, [[0, 90], [1.4, r(300, 420)], [3.2, 140], [4.2, 80]]);
      const body = k.route(0.4, lp, k.g(1));
      k.tone({ type: 'sawtooth', t: 0, a: 0.9, hold: 1.8, r: 1.5, gain: 0.5, dest: body, path: [[0, f], [2, f * r(0.86, 0.94)], [4.2, f * r(0.78, 0.85)]] });
      k.tone({ type: 'sawtooth', t: 0.1, a: 1, hold: 1.5, r: 1.5, gain: 0.35, detune: r(10, 22), dest: body, path: [[0, f * 1.5], [4, f * 1.5 * r(0.8, 0.9)]] });
      k.noise({ color: 'brown', t: 0, a: 0.8, hold: 1.8, r: 1.7, gain: 0.5, dest: k.route(0.4, k.filt('lowpass', 180)) });
      const nC = ri(3, 5);
      for (let i = 0; i < nC; i++) creak(k, r(0.4, 3.2));
      const rf = r(85, 140);
      [1, 2.76, 5.4, 8.93].forEach((m, i) => k.tone({ type: 'sine', t: r(0.6, 1.6), dur: r(2, 3) / (1 + i * 0.4), a: 0.4, gain: 0.05 / (1 + i), f: rf * m, send: 0.6 }));
    },
  },
  airlock: {
    label: 'AIRLOCK CYCLE', room: 'hull', dur: 4.4,
    build(k) {
      const { r } = k;
      const sw = r(180, 240);
      const servo = k.route(0.2, k.filt('lowpass', 1400, 2));
      k.tone({ type: 'square', t: 0, a: 0.08, hold: 0.5, r: 0.17, gain: 0.07, dest: servo, path: [[0, sw], [0.6, sw * 1.5], [0.75, sw * 1.45]] });
      k.tone({ type: 'sawtooth', t: 0, a: 0.08, hold: 0.5, r: 0.17, gain: 0.04, detune: 8, dest: servo, path: [[0, sw * 2], [0.6, sw * 3], [0.75, sw * 2.9]] });
      clunk(k, 0.78, r(55, 75));
      const hissStart = 0.9, hissDur = r(2.1, 2.6);
      const bp = k.filt('bandpass', 4500, 0.8);
      k.pts(bp.frequency, hissStart, [[0, r(4800, 5600)], [hissDur, r(1400, 1800)]]);
      k.noise({ t: hissStart, a: 0.08, hold: hissDur * 0.5, r: hissDur * 0.5, gain: 0.35, dest: k.route(0.3, bp, k.filt('highpass', 600)) });
      k.noise({ color: 'brown', t: hissStart, a: 0.2, hold: hissDur * 0.4, r: hissDur * 0.5, gain: 0.25, dest: k.route(0.2, k.filt('lowpass', 300)) });
      const end = hissStart + hissDur + 0.1;
      clunk(k, end, r(60, 80));
      const c = r(880, 990);
      k.tone({ type: 'sine', t: end + 0.18, dur: 0.45, gain: 0.06, f: c, send: 0.5 });
      k.tone({ type: 'sine', t: end + 0.32, dur: 0.6, gain: 0.05, f: c * 1.5, send: 0.5 });
    },
  },
  'steam-vent': {
    label: 'STEAM VENT', room: 'hull', dur: 3.2,
    build(k) {
      const { r, ri } = k;
      let t = 0;
      for (let i = 0, n = ri(1, 3); i < n; i++) {
        const d = r(0.08, 0.16);
        k.noise({ t, dur: d, a: 0.01, gain: r(0.15, 0.3), dest: k.route(0.2, k.filt('bandpass', r(2000, 3200), 1.2)) });
        t += d + r(0.08, 0.2);
      }
      k.tone({ type: 'sine', t, dur: 0.3, a: 0.005, gain: 0.35, path: [[0, 95], [0.3, 48]], send: 0.2 });
      const bp = k.filt('bandpass', 3000, 0.9);
      k.pts(bp.frequency, t, [[0, r(3000, 3800)], [0.3, 2600], [2.2, r(1100, 1500)]]);
      k.noise({ t, a: 0.03, hold: r(0.6, 0.9), r: 1.4, gain: 0.55, dest: k.route(0.3, bp, k.filt('highpass', 500)) });
      k.noise({ color: 'brown', t, a: 0.03, hold: 0.6, r: 1.2, gain: 0.3, dest: k.route(0.25, k.filt('lowpass', 400)) });
      k.noise({ t: t + 0.05, a: 0.1, hold: 0.5, r: 1.1, gain: 0.08, dest: k.route(0.4, k.filt('bandpass', r(1800, 2400), 30)) });
    },
  },
  'tracker-burst': {
    label: 'TRACKER BURST', room: 'hull', dur: 3.4,
    build(k) {
      const { r, ri } = k;
      const f = r(1180, 1260), n = ri(6, 9);
      let gap = r(0.42, 0.5), t = 0;
      for (let i = 0; i < n; i++) {
        k.tone({ type: 'sine', t, dur: 0.16, a: 0.003, gain: 0.22, f, send: 0.25 });
        k.tone({ type: 'triangle', t, dur: 0.08, a: 0.003, gain: 0.05, f: f * 2, send: 0.1 });
        k.noise({ t, dur: 0.012, a: 0.001, gain: 0.06, dest: k.route(0, k.filt('highpass', 3000)) });
        const ret = Math.max(0.05, gap * r(0.45, 0.55) * (1 - i / (n + 2)));
        k.tone({ type: 'sine', t: t + ret, dur: 0.1, a: 0.004, gain: 0.1, f: f * r(1.18, 1.26) * (1 + i * 0.015), send: 0.3 });
        t += gap;
        gap = Math.max(0.12, gap * r(0.78, 0.86));
      }
      k.tone({ type: 'square', t, a: 0.01, hold: 0.35, r: 0.12, gain: 0.05, f: f * 1.5, dest: k.route(0.2, k.filt('lowpass', 2500)) });
    },
  },
  screech: {
    label: 'DISTANT SCREECH', room: 'hull', dur: 3.2,
    build(k) {
      const { r } = k;
      const d = r(1.3, 1.8), peak = r(1500, 2000), start = r(500, 700);
      const lp = k.filt('lowpass', r(2000, 2600), 0.7);
      k.toOut(lp, 0.9, 0.5);
      const echo = k.delay(r(0.28, 0.38));
      const eg = k.g(0.28);
      lp.connect(echo); echo.connect(eg); k.toOut(eg, 0.9, 0.6);
      const f1 = k.filt('bandpass', r(1100, 1300), 5), f2 = k.filt('bandpass', r(2400, 2900), 7);
      const mix = k.g(1.4);
      f1.connect(mix); f2.connect(mix); mix.connect(lp);
      for (const v of [1, r(1.05, 1.09)]) {
        const t = v > 1 ? r(0.03, 0.08) : 0;
        const { osc } = k.tone({ type: 'sawtooth', t, dur: d, a: 0.12, hold: d * 0.45, r: d * 0.45, gain: 0.35, dest: [f1, f2], path: [[0, start * v], [d * 0.22, peak * v], [d * 0.6, peak * 0.75 * v], [d, start * 0.9 * v]] });
        k.lfo({ rate: r(7, 11), depth: r(30, 60), param: osc.frequency, t, dur: d });
      }
      k.noise({ t: 0, dur: d, a: 0.1, hold: d * 0.4, r: d * 0.5, gain: 0.12, dest: f2 });
    },
  },
  'lights-out': {
    label: 'LIGHTS OUT', room: 'hull', dur: 3.2,
    build(k) {
      const { r, ri } = k;
      k.noise({ t: 0, dur: 0.03, a: 0.001, gain: 0.35, dest: k.route(0.2, k.filt('highpass', 1800, 1)) });
      k.tone({ type: 'square', t: 0, dur: 0.04, a: 0.001, gain: 0.06, f: r(2400, 3000), send: 0.2 });
      const t1 = r(0.04, 0.09);
      k.tone({ type: 'sine', t: t1, dur: 0.9, a: 0.004, gain: 0.9, path: [[0, r(70, 85)], [0.25, 40], [0.9, 26]], send: 0.35 });
      k.noise({ color: 'brown', t: t1, dur: 0.6, a: 0.003, gain: 0.7, dest: k.route(0.35, k.filt('lowpass', 220, 0.9)) });
      const w = r(480, 620), wd = r(1.4, 1.8);
      const wl = k.filt('lowpass', 2200, 3);
      k.pts(wl.frequency, t1, [[0, 2200], [wd, 150]]);
      k.tone({ type: 'sawtooth', t: t1, a: 0.005, hold: 0.2, r: wd - 0.2, gain: 0.12, path: [[0, w], [wd, 28]], dest: k.route(0.3, wl) });
      k.tone({ type: 'sine', t: t1, dur: 2.2, a: 0.01, gain: 0.08, path: [[0, 60], [2.2, 38]], send: 0.2 });
      k.tone({ type: 'sine', t: t1, dur: 1.8, a: 0.01, gain: 0.04, path: [[0, 120], [1.8, 70]], send: 0.2 });
      for (let i = 0, n = ri(2, 5); i < n; i++) {
        k.noise({ t: t1 + r(0.1, 1.2), dur: r(0.01, 0.03), a: 0.001, gain: r(0.05, 0.15), dest: k.route(0.3, k.filt('highpass', 4000)) });
      }
    },
  },

  /* ── DUNE ── */
  worm: {
    label: 'WORM RUMBLE', room: 'open', dur: 6.6,
    build(k) {
      const { r } = k;
      const D = r(5.2, 6.2);
      const lp = k.filt('lowpass', 60, 1.4);
      k.pts(lp.frequency, 0, [[0, 55], [D * 0.8, r(260, 340)], [D, 120]]);
      k.noise({ color: 'brown', t: 0, dur: D, gain: 1, shape: [[0, 0], [D * 0.75, 0.9], [D * 0.85, 1], [D, 0]], dest: k.route(0.25, lp) });
      k.tone({ type: 'sine', t: 0, dur: D, gain: 0.6, shape: [[0, 0], [D * 0.8, 1], [D, 0]], path: [[0, r(28, 32)], [D, r(40, 46)]], trem: { rate: 3, rateTo: 9, depth: 0.45 }, send: 0.15 });
      const grind = k.route(0.2, k.shaper(3), k.filt('lowpass', 160, 2));
      k.tone({ type: 'sawtooth', t: D * 0.3, dur: D * 0.7, gain: 0.25, shape: [[0, 0], [D * 0.5, 1], [D * 0.7, 0]], path: [[0, 52], [D * 0.7, 61]], dest: grind });
      k.noise({ t: D * 0.4, dur: D * 0.6, gain: 0.12, shape: [[0, 0], [D * 0.45, 1], [D * 0.6, 0]], dest: k.route(0.4, k.filt('highpass', 3500)) });
      k.tone({ type: 'sine', t: D * 0.78, dur: 1.3, a: 0.02, gain: 0.8, path: [[0, 52], [1.3, 30]], send: 0.4 });
    },
  },
  'wind-gust': {
    label: 'WIND GUST', room: 'open', dur: 5,
    build(k) {
      const { r } = k;
      const D = r(3.8, 4.8);
      const bp = k.filt('bandpass', 500, 1.1);
      const fpts = [[0, r(250, 400)]];
      for (let x = 0; x < D;) { x = Math.min(D, x + r(0.35, 0.8)); fpts.push([x, r(350, 1500)]); }
      k.pts(bp.frequency, 0, fpts);
      const pan = k.panner();
      const from = r(-0.7, 0.7);
      k.pts(pan.pan || k.g(1).gain, 0, [[0, from], [D, -from]], 'lin');
      k.route(0.3, bp, pan);
      k.noise({ color: 'pink', t: 0, dur: D, gain: 1, shape: [[0, 0], [D * 0.35, 0.7], [D * 0.55, 0.45], [D * 0.7, 0.85], [D, 0]], dest: bp });
      const wb = k.filt('bandpass', r(800, 1200), 28);
      k.pts(wb.frequency, 0.3, [[0, r(800, 1000)], [D * 0.5, r(1100, 1400)], [D - 0.3, r(700, 900)]]);
      wb.connect(pan);
      k.noise({ t: 0.3, dur: D - 0.3, gain: 0.6, shape: [[0, 0], [D * 0.4, 0.8], [D * 0.6, 0.4], [D - 0.3, 0]], dest: wb });
      k.noise({ color: 'brown', t: 0, dur: D, gain: 0.3, shape: [[0, 0], [D * 0.5, 1], [D, 0]], dest: k.route(0.2, k.filt('lowpass', 150)) });
    },
  },
  thumper: {
    label: 'THUMPER', room: 'open', dur: 5.2,
    build(k) {
      const { r, ri } = k;
      const n = ri(6, 8), gap = r(0.55, 0.66), ringF = r(280, 340);
      for (let i = 0; i < n; i++) {
        const t = i * gap + r(-0.012, 0.012), v = r(0.85, 1);
        k.tone({ type: 'sine', t: Math.max(0, t), dur: 0.32, a: 0.002, gain: 0.85 * v, path: [[0, r(115, 130)], [0.06, 70], [0.32, 42]], send: 0.2 });
        k.noise({ t: Math.max(0, t), dur: 0.04, a: 0.001, gain: 0.25 * v, dest: k.route(0.15, k.filt('lowpass', 1600, 0.8)) });
        k.noise({ color: 'brown', t: Math.max(0, t), dur: 0.25, a: 0.002, gain: 0.4 * v, dest: k.route(0.2, k.filt('lowpass', 260)) });
        [1, 2.32, 3.86].forEach((m, j) => k.tone({ type: 'sine', t: Math.max(0, t) + 0.004, dur: 0.5 / (1 + j * 0.5), a: 0.002, gain: 0.035 / (1 + j), f: ringF * m, send: 0.4 }));
      }
    },
  },
  shield: {
    label: 'SHIELD HUM', room: 'open', dur: 3.4,
    build(k) {
      const { r } = k;
      const D = r(2.6, 3.1), f = r(92, 104);
      const lp = k.filt('lowpass', 200, 5);
      k.pts(lp.frequency, 0, [[0, 180], [0.25, r(1700, 2100)], [0.6, 700], [D - 0.4, 600], [D, 200]]);
      k.route(0.35, lp);
      const shape = [[0, 0], [0.2, 1], [D - 0.6, 0.8], [D, 0]];
      const fpath = [[0, f * 0.9], [0.2, f], [D - 0.5, f], [D, f * 0.85]];
      k.tone({ type: 'sawtooth', t: 0, dur: D, gain: 0.25, shape, path: fpath, dest: lp });
      k.tone({ type: 'sawtooth', t: 0, dur: D, gain: 0.2, shape, path: fpath, detune: r(9, 15), dest: lp });
      k.tone({ type: 'square', t: 0, dur: D, gain: 0.08, shape, path: fpath.map(([t, v]) => [t, v / 2]), dest: lp });
      k.tone({ type: 'sine', t: 0, dur: D, gain: 0.12, shape, f: f * 2, trem: { rate: r(14, 20), depth: 0.6 }, send: 0.4 });
      k.noise({ t: 0, dur: D, gain: 0.06, shape, trem: { rate: r(20, 26), depth: 0.7 }, dest: k.route(0.5, k.filt('bandpass', r(3800, 5200), 3)) });
      k.tone({ type: 'sine', t: 0, dur: 0.22, a: 0.01, gain: 0.06, path: [[0, 300], [0.22, 1400]], send: 0.4 });
    },
  },
  ornithopter: {
    label: 'ORNITHOPTER', room: 'open', dur: 4.8,
    build(k) {
      const { r } = k;
      const D = r(3.6, 4.4);
      const pan = k.panner();
      const side = k.rng() > 0.5 ? 1 : -1;
      if (pan.pan) k.pts(pan.pan, 0, [[0, -0.85 * side], [D, 0.85 * side]], 'lin');
      k.toOut(pan, 0.3);
      const bp = k.filt('bandpass', 420, 1.4);
      k.pts(bp.frequency, 0, [[0, 300], [D * 0.5, r(650, 750)], [D, 280]]);
      bp.connect(pan);
      const prox = (x) => 0.15 + 0.85 * Math.exp(-Math.pow((x - 0.5) / 0.25, 2));
      const rate = r(7.5, 9.5);
      for (let t = 0; t < D;) {
        const x = t / D, p = prox(x);
        k.noise({ color: 'pink', t, dur: 0.07, a: 0.012, gain: 0.55 * p, dest: bp });
        k.tone({ type: 'sine', t, dur: 0.09, a: 0.01, gain: 0.2 * p, path: [[0, 90], [0.09, 60]], dest: pan });
        t += 1 / (rate * (x < 0.5 ? 1 + 0.08 * x : 1.04 - 0.08 * (x - 0.5)));
      }
      const ew = r(170, 220);
      const el = k.filt('lowpass', 1500, 1);
      el.connect(pan);
      k.tone({ type: 'sawtooth', t: 0, dur: D, gain: 0.06, shape: [[0, 0.05], [D * 0.5, 1], [D, 0]], path: [[0, ew * 1.06], [D * 0.5, ew], [D, ew * 0.93]], dest: el });
    },
  },
  crysknife: {
    label: 'CRYSKNIFE DRAW', room: 'open', dur: 2.2,
    build(k) {
      const { r } = k;
      const sd = r(0.28, 0.4);
      const bp = k.filt('bandpass', 2200, r(10, 16));
      k.pts(bp.frequency, 0, [[0, 2200], [sd, r(5500, 7000)]]);
      k.noise({ t: 0, dur: sd + 0.05, gain: 0.35, shape: [[0, 0], [sd * 0.7, 1], [sd + 0.05, 0]], dest: k.route(0.3, bp) });
      k.noise({ t: sd * 0.5, dur: sd * 0.5, gain: 0.1, shape: [[0, 0], [sd * 0.3, 1], [sd * 0.5, 0]], dest: k.route(0.3, k.filt('highpass', 6000)) });
      const rf = r(1650, 2050);
      k.tone({ type: 'triangle', t: sd, dur: 0.05, a: 0.001, gain: 0.08, f: rf * 3.1, send: 0.3 });
      for (const [m, d, gn] of [[1, 1.5, 0.09], [2.71, 1.0, 0.05], [5.13, 0.7, 0.035], [8.4, 0.4, 0.02]]) {
        k.tone({ type: 'sine', t: sd, dur: d, a: 0.002, gain: gn, f: rf * m, send: 0.55 });
        k.tone({ type: 'sine', t: sd, dur: d, a: 0.002, gain: gn * 0.6, f: rf * m, detune: r(3, 7), send: 0.55 });
      }
    },
  },
  voice: {
    label: 'THE VOICE', room: 'open', dur: 3.6,
    build(k) {
      const { r, ri } = k;
      const pre = r(0.5, 0.7);
      k.noise({ color: 'brown', t: 0, dur: pre + 0.1, gain: 0.5, shape: [[0, 0], [pre, 1], [pre + 0.1, 0]], dest: k.route(0.3, k.filt('lowpass', 140)) });
      k.tone({ type: 'sine', t: 0, dur: pre + 0.05, gain: 0.3, shape: [[0, 0], [pre, 1], [pre + 0.05, 0]], path: [[0, 30], [pre, 45]] });
      const f = r(38, 46);
      const formant = k.g(1);
      const b1 = k.filt('bandpass', r(620, 700), 9), b2 = k.filt('bandpass', r(1040, 1150), 11);
      formant.connect(b1); formant.connect(b2);
      const fo = k.g(1.6);
      b1.connect(fo); b2.connect(fo); k.toOut(fo, 0.5);
      let t = pre;
      for (let i = 0, n = ri(2, 3); i < n; i++) {
        k.tone({ type: 'sine', t, dur: 0.7, a: 0.01, gain: 0.95, path: [[0, f * 1.15], [0.08, f], [0.7, f * 0.82]], send: 0.4 });
        k.tone({ type: 'triangle', t, dur: 0.5, a: 0.01, gain: 0.22, path: [[0, f * 2.3], [0.08, f * 2], [0.5, f * 1.7]], send: 0.3 });
        k.tone({ type: 'sawtooth', t, dur: 0.6, a: 0.03, gain: 0.25, f: f * 2 * r(0.98, 1.02), dest: formant });
        t += r(0.48, 0.62);
      }
      k.tone({ type: 'sine', t, dur: 1.2, a: 0.1, gain: 0.25, path: [[0, f], [1.2, f * 0.7]], send: 0.5 });
    },
  },
};

/* ═══ AMBIENCE BEDS (continuous; events scheduled ahead on a timer) ═══ */
export const AMBIENCE = {
  /* ALIEN */
  ship: { label: 'ENGINE HUM', room: 'hull', build(k) {
    k.loopNoise({ color: 'brown', gain: 0.35, dest: k.route(0.1, k.filt('lowpass', 140)) });
    const lp = k.filt('lowpass', 110, 3);
    k.route(0.1, lp);
    k.drone({ type: 'sawtooth', f: 41, gain: 0.09, dest: lp });
    k.drone({ type: 'sawtooth', f: 41.3, gain: 0.07, dest: lp });
    k.drone({ type: 'sine', f: 82, gain: 0.035, send: 0.1 });
    k.drone({ type: 'sine', f: 120, gain: 0.01, send: 0.1 });
    k.lfo({ rate: 0.07, depth: 30, param: lp.frequency });
    const vent = k.filt('bandpass', 600, 0.7);
    const vg = k.g(1);
    k.route(0.2, vent, vg);
    k.loopNoise({ color: 'pink', gain: 0.05, dest: vent });
    k.lfo({ rate: 0.05, depth: 0.4, param: vg.gain });
    k.every(9, 22, (e) => {
      e.tone({ type: 'sine', t: 0, dur: 0.03, gain: 0.03, f: e.r(1600, 2000), send: 0.4 });
      if (e.rng() > 0.5) clunk(e, e.r(0.1, 0.4), e.r(70, 90), 0.08);
    });
  } },
  derelict: { label: 'DERELICT SILENCE', room: 'hull', build(k) {
    k.loopNoise({ color: 'brown', gain: 0.18, dest: k.route(0.2, k.filt('lowpass', 70)) });
    const wh = k.filt('bandpass', k.r(380, 460), 18);
    k.route(0.5, wh);
    k.loopNoise({ gain: 0.05, dest: wh });
    k.lfo({ rate: 0.05, depth: 60, param: wh.frequency });
    k.every(5, 14, (e) => {
      const p = e.rng();
      if (p < 0.45) creak(e, 0, 0.35);
      else if (p < 0.75) clunk(e, 0, e.r(50, 70), 0.12);
      else drip(e, 0, 0.6, true);
    });
  } },
  hive: { label: 'HIVE (WET DRIP)', room: 'hull', build(k) {
    const throb = k.drone({ type: 'sine', f: 34, gain: 0.05, send: 0.1 });
    k.lfo({ rate: 0.35, depth: 0.045, param: throb.e.gain });
    const wetf = k.filt('bandpass', 280, 1.5);
    k.route(0.4, wetf);
    k.loopNoise({ color: 'pink', gain: 0.07, dest: wetf });
    k.lfo({ rate: 0.11, depth: 120, param: wetf.frequency });
    k.every(0.35, 2.2, (e) => { drip(e, 0); if (e.rng() < 0.25) drip(e, e.r(0.08, 0.2), 0.6); });
    k.every(4, 10, (e) => e.noise({ color: 'brown', t: 0, dur: 0.3, gain: 0.05, shape: [[0, 0], [0.12, 1], [0.3, 0]], dest: e.route(0.5, e.filt('lowpass', 600)) }));
    k.every(12, 30, (e) => {
      for (let i = 0, n = e.ri(3, 6); i < n; i++) e.tone({ type: 'sawtooth', t: i * e.r(0.04, 0.08), dur: 0.04, a: 0.004, gain: 0.02, f: e.r(1800, 2600), dest: e.route(0.8, e.filt('bandpass', 2400, 6)) });
    });
  } },
  /* DUNE */
  erg: { label: 'OPEN ERG', room: 'open', build(k) {
    const bp = k.filt('bandpass', 500, 0.9);
    const gg = k.g(0.12);
    k.route(0.25, bp, gg);
    k.loopNoise({ color: 'pink', gain: 1, dest: bp });
    const hiss = k.g(0.02);
    k.route(0.2, k.filt('highpass', 5000), hiss);
    k.loopNoise({ gain: 1, dest: hiss });
    k.lfo({ rate: 0.13, depth: 0.012, param: hiss.gain });
    k.loopNoise({ color: 'brown', gain: 0.1, dest: k.route(0.1, k.filt('lowpass', 60)) });
    k.every(1.5, 4, (e) => {
      bp.frequency.setTargetAtTime(e.r(280, 1100), e.t0, e.r(0.4, 1.0));
      gg.gain.setTargetAtTime(e.r(0.05, 0.22), e.t0, e.r(0.5, 1.2));
    });
    k.every(25, 60, (e) => e.noise({ color: 'brown', t: 0, dur: 3, gain: 0.14, shape: [[0, 0], [1.8, 1], [3, 0]], dest: e.route(0.3, e.filt('lowpass', 80)) }));
  } },
  sietch: { label: 'SIETCH WIND', room: 'open', build(k) {
    k.loopNoise({ color: 'brown', gain: 0.2, dest: k.route(0.2, k.filt('lowpass', 90)) });
    const b1 = k.filt('bandpass', 260, 5), b2 = k.filt('bandpass', 520, 9);
    k.route(0.4, b1); k.route(0.5, b2);
    k.loopNoise({ color: 'pink', gain: 0.12, dest: b1 });
    k.loopNoise({ color: 'pink', gain: 0.05, dest: b2 });
    k.lfo({ rate: 0.06, depth: 120, param: b1.frequency });
    k.lfo({ rate: 0.09, depth: 160, param: b2.frequency });
    k.drone({ type: 'sine', f: 41, gain: 0.04, send: 0.2 });
    k.every(7, 16, (e) => drip(e, 0, 0.8, true));
  } },
  keep: { label: 'KEEP INTERIOR', room: 'open', build(k) {
    k.loopNoise({ color: 'brown', gain: 0.14, dest: k.route(0.1, k.filt('lowpass', 220)) });
    k.drone({ type: 'sine', f: 50, gain: 0.03, send: 0.05 });
    k.drone({ type: 'sine', f: 100, gain: 0.012, send: 0.05 });
    for (const f of [98, 147, 196]) {
      const p = k.drone({ type: 'sine', f, gain: 0.008, send: 0.6 });
      k.lfo({ rate: k.r(0.03, 0.08), depth: 0.006, param: p.e.gain });
    }
    k.every(8, 20, (e) => {
      for (let i = 0, n = e.ri(2, 4); i < n; i++) {
        const t = i * e.r(0.45, 0.6);
        e.tone({ type: 'sine', t, dur: 0.25, a: 0.004, gain: 0.06, path: [[0, 90], [0.25, 50]], send: 0.6 });
        e.noise({ color: 'brown', t, dur: 0.12, a: 0.003, gain: 0.05, dest: e.route(0.6, e.filt('lowpass', 300)) });
      }
    });
  } },
};

/* ─── shared context + buses: sources → duck (TTS) → compressor → speakers ─── */
let ctx = null;
let graph = null;
const stateFns = new Set();
const duckFns = new Set();
let ducked = false;
let duckTimer = null;
export const DUCK_LEVEL = 0.28;

export function audioCtx() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try { ctx = new AC(); } catch { ctx = null; return null; }
  ctx.onstatechange = () => { for (const fn of stateFns) fn(ctx.state); };
  return ctx;
}
function buses(ac) {
  if (graph && graph.ac === ac) return graph;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
  const duck = ac.createGain();
  duck.connect(comp); comp.connect(ac.destination);
  const verbs = {};
  graph = {
    ac, duck,
    verb(room) {
      if (!verbs[room]) {
        const c = ac.createConvolver();
        c.buffer = impulse(ac, room);
        c.connect(duck);
        verbs[room] = c;
      }
      return verbs[room];
    },
  };
  startDuckWatch();
  return graph;
}
/** Resume the shared context (call from a user gesture). */
export function unlockAudio() {
  const ac = audioCtx();
  if (ac && ac.state !== 'running') ac.resume().catch(() => {});
  return ac;
}
export function onAudioState(fn) { stateFns.add(fn); return () => stateFns.delete(fn); }
/** Ambience masters connect here (so they duck under TTS with the stingers). */
export function ambienceInput() {
  const ac = audioCtx();
  return ac ? buses(ac).duck : null;
}

/* TTS ducking: narration is read through speechSynthesis (hooks/useTTS.js), which never reaches
   the Web Audio graph — so poll speechSynthesis.speaking and pull the bus down while it talks. */
function startDuckWatch() {
  if (duckTimer || typeof window === 'undefined') return;
  duckTimer = setInterval(() => {
    const s = window.speechSynthesis;
    setDucked(!!(s && s.speaking && !s.paused));
  }, 150);
}
export function setDucked(v) {
  v = !!v;
  if (v === ducked) return;
  ducked = v;
  if (graph) graph.duck.gain.setTargetAtTime(v ? DUCK_LEVEL : 1, graph.ac.currentTime, v ? 0.08 : 0.5);
  for (const fn of duckFns) fn(v);
}
export const isDucked = () => ducked;
export function subscribeDuck(fn) { duckFns.add(fn); return () => duckFns.delete(fn); }

/** Build a stinger into an arbitrary graph (out = dry input, wet = reverb input). Returns its length (s) or 0. */
export function renderStinger(ac, id, seed, { out, wet = null, at = null } = {}) {
  const def = Object.prototype.hasOwnProperty.call(STINGERS, id) ? STINGERS[id] : null;
  if (!def || !ac || !out) return 0;
  const k = makeKit(ac, out, wet, at ?? ac.currentTime + 0.02, mulberry32(seed));
  def.build(k);
  return def.dur;
}

/** Fire a stinger on the shared context. Unknown ids are ignored. */
export function playStinger(id, { seed = randomSeed(), volume = 1 } = {}) {
  const def = Object.prototype.hasOwnProperty.call(STINGERS, id) ? STINGERS[id] : null;
  const ac = def && audioCtx();
  if (!ac) return false;
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  try {
    const b = buses(ac);
    const out = ac.createGain();
    out.gain.value = Math.max(0, Math.min(1, volume)) * 0.8;
    out.connect(b.duck);
    const wet = ac.createGain();
    wet.gain.value = out.gain.value;
    wet.connect(b.verb(def.room || 'hull'));
    renderStinger(ac, id, seed, { out, wet });
    setTimeout(() => { try { out.disconnect(); wet.disconnect(); } catch { /* gone */ } }, (def.dur + 3) * 1000);
    return true;
  } catch { return false; } // audio graph errors are never fatal
}

/** Start an ambience bed into `out` (a gain node); returns { stop() } or null. */
export function startAmbience(id, out, seed = randomSeed()) {
  const def = Object.prototype.hasOwnProperty.call(AMBIENCE, id) ? AMBIENCE[id] : null;
  const ac = out?.context;
  if (!def || !ac) return null;
  const track = [];
  const timers = [];
  const verb = ac.createConvolver();
  verb.buffer = impulse(ac, def.room || 'hull');
  verb.connect(out);
  const wet = ac.createGain();
  wet.gain.value = 0.8;
  wet.connect(verb);
  const rng = mulberry32(seed);
  const at = ac.currentTime + 0.05;
  const k = makeKit(ac, out, wet, at, rng, track);
  k.every = (min, max, fn) => {
    let next = ac.currentTime + (min + (max - min) * rng()) * 0.5;
    timers.push(setInterval(() => {
      if (ac.currentTime + 0.25 < next) return;
      if (next < ac.currentTime) next = ac.currentTime + 0.05;
      try { fn(makeKit(ac, out, wet, next, rng)); } catch { /* never fatal */ }
      next += min + (max - min) * rng();
    }, 200));
  };
  let error = null;
  try { def.build(k); } catch (e) { error = e; } // a partial bed still plays
  return {
    error,
    stop() {
      for (const t of timers) clearInterval(t);
      const now = ac.currentTime;
      for (const n of track) { try { n.stop(now + 0.05); } catch { /* already stopped */ } }
      setTimeout(() => { try { verb.disconnect(); wet.disconnect(); } catch { /* gone */ } }, 3000);
    },
  };
}

/** Stinger ids for a universe theme (theme.sounds.stingers), filtered to known ones. */
export function stingersFor(theme) {
  const list = theme?.sounds?.stingers;
  return Array.isArray(list) ? list.filter((id) => Object.prototype.hasOwnProperty.call(STINGERS, id)) : [];
}
