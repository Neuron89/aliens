import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../GameContext';
import { play, reducedFx } from '../../sfx';
import './dice-stage.css';

/* ═══════════════════════════════════════════════════════════════
   DiceStage (F7) — the table screen's roll animation.
   "If a player rolls the dice digitally or if the GM rolls the dice
   digitally, I'd like the animation to show up on the table screen for
   everyone to see."

   Source: `board-roll { roll }` (server/mechanics.js boardRoll): phone rolls
   (player-roll → afterPlayerRoll) and GM rolls sent with secret:false (the
   GM DICE tab's TV route). Secret GM rolls never reach the board.
     roll = { id, name, who:'player'|'gm', kind:'yze'|'2d20'|…, label, summary,
              flags[], dice:{ base[], stress[], d20[] }, successes, stunts, pushed,
              panic, passed, momentum, complications, difficulty, target }

   Timeline (normal FX): a dark band fades up across the middle of the TV, the
   dice fly in from the roller's side (players from the left, the GM from the
   right) along eased, seeded trajectories with per-die spin and bounce, land
   one by one (~1.4 s), the hits light (sixes glow, stress 1s pulse red, d20
   crits glow, complications pulse red), the result card drops in, holds ~3 s,
   and the stage fades out. A pushed YZE roll that follows its original keeps
   the original's sixes lit in place and re-tumbles only the other dice.
   Every random choice is seeded from roll.id, so every TV shows the same tumble.

   Queue: max 4 waiting (older ones drop), a duplicate roll.id is ignored, and
   a waiting roll shortens the current hold. Reduced FX: no tumble, the dice
   appear on their final faces and the card shows for 3 s. Sounds: only the
   theme's dice.settle / dice.crit / dice.botch cues.
   TV only — Overlays (mounted by BoardView for role 'board') renders this.
   ═══════════════════════════════════════════════════════════════ */

const MAX_QUEUE = 4;
const HOLD_MS = 3000;
const HOLD_BUSY_MS = 2000;   // hold when another roll is waiting
const PUSH_MIN_MS = 1100;    // a pushed follow-up may cut the hold after this long on the card
const FADE_MS = 520;
const MAX_DICE = 24;

/* ─── Seeded randomness (roll.id → the same tumble on every screen) ─── */
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Cube orientation that brings face v to the front (faces: 1 front, 6 back, 3 right, 4 left, 2 top, 5 bottom). */
const FACE_ROT = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };
/* Pip grid cells [row, col] per face value. */
const PIPS = {
  1: [[2, 2]],
  2: [[1, 1], [3, 3]],
  3: [[1, 1], [2, 2], [3, 3]],
  4: [[1, 1], [1, 3], [3, 1], [3, 3]],
  5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
  6: [[1, 1], [2, 1], [3, 1], [1, 3], [2, 3], [3, 3]],
};
const nums = (a) => (Array.isArray(a) ? a.filter((n) => Number.isFinite(n)) : []);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Outcome line + tone + detail chips for the result card. */
function outcomeOf(r) {
  const flags = r.flags || [];
  const base = nums(r.dice?.base);
  const stress = nums(r.dice?.stress);
  const d20 = nums(r.dice?.d20);
  const chips = [];
  if (r.kind === 'yze' || ((base.length || stress.length) && !d20.length)) {
    const s = Number.isFinite(r.successes) ? r.successes : [...base, ...stress].filter((v) => v === 6).length;
    const panic = !!r.panic || flags.includes('panic') || stress.includes(1);
    let big; let tone;
    if (panic) { big = 'PANIC'; tone = 'panic'; chips.push({ t: s ? `${plural(s, 'SUCCESS', 'SUCCESSES')}` : 'NO SUCCESS', k: s ? 'good' : 'dim' }); }
    else if (s >= 2) { big = `SUCCESS +${s - 1} STUNT${s > 2 ? 'S' : ''}`; tone = 'crit'; }
    else if (s === 1) { big = 'SUCCESS'; tone = 'success'; }
    else { big = 'FAILED'; tone = 'fail'; }
    if (r.pushed) chips.push({ t: 'PUSHED', k: 'warn' });
    chips.push({ t: `${base.length} BASE${stress.length ? ` · ${stress.length} STRESS` : ''}`, k: 'dim' });
    return { big, tone, chips };
  }
  if (r.kind === '2d20' || d20.length) {
    const s = Number.isFinite(r.successes) ? r.successes : 0;
    const diff = Number.isFinite(r.difficulty) ? r.difficulty : null;
    const passed = typeof r.passed === 'boolean' ? r.passed : (diff != null ? s >= diff : s > 0);
    const comps = Number.isFinite(r.complications) ? r.complications : (flags.includes('complication') ? 1 : 0);
    const mom = Number.isFinite(r.momentum) ? r.momentum : 0;
    const score = diff != null ? ` ${s}/D${diff}` : ` · ${plural(s, 'SUCCESS', 'SUCCESSES')}`;
    let big = `${passed ? 'PASSED' : 'FAILED'}${score}`;
    let tone = passed ? (flags.includes('crit') || mom >= 2 ? 'crit' : 'success') : 'fail';
    if (passed && mom) big += ` +${mom} MOMENTUM`;
    if (comps) {
      chips.push({ t: comps > 1 ? `${comps} COMPLICATIONS` : 'COMPLICATION', k: 'bad' });
      if (!passed) tone = 'panic';
    }
    if (flags.includes('crit')) chips.push({ t: 'CRITICAL', k: 'good' });
    if (Number.isFinite(r.target)) chips.push({ t: `TARGET ${r.target}`, k: 'dim' });
    return { big, tone, chips };
  }
  const text = (r.summary || '').split(' — ').slice(1).join(' — ') || r.summary || 'ROLLED';
  const tone = flags.includes('panic') || flags.includes('botch') || flags.includes('complication') ? 'panic' : flags.includes('crit') ? 'crit' : 'success';
  return { big: text.toUpperCase(), tone, chips: flags.filter((f) => f !== 'botch').map((f) => ({ t: f.toUpperCase(), k: f === 'crit' ? 'good' : f === 'push' ? 'warn' : 'bad' })) };
}

/** Which d20s scored a crit (counts twice) and which are complications, from the totals the roller sent. */
function classifyD20(r, d20) {
  const target = Number.isFinite(r.target) ? r.target : null;
  const flags = r.flags || [];
  const hit = d20.map((v) => (target != null ? v <= target : false));
  const crit = d20.map(() => false);
  const comp = d20.map(() => false);
  const hits = hit.filter(Boolean).length;
  let crits = Number.isFinite(r.successes) && target != null ? Math.max(0, r.successes - hits) : (flags.includes('crit') ? d20.filter((v) => v === 1).length : 0);
  [...d20.keys()].filter((i) => hit[i]).sort((a, b) => d20[a] - d20[b]).forEach((i) => { if (crits > 0) { crit[i] = true; crits -= 1; } });
  let comps = Number.isFinite(r.complications) ? r.complications : (flags.includes('complication') ? d20.filter((v) => v === 20).length || 1 : 0);
  [...d20.keys()].filter((i) => !hit[i]).sort((a, b) => d20[b] - d20[a]).forEach((i) => { if (comps > 0) { comp[i] = true; comps -= 1; } });
  return { hit, crit, comp };
}

/**
 * Build the whole show for one roll: per-die faces, flags, seeded trajectories and timings.
 * prev: the last unpushed roll with the same roller + label (for a push: which dice stay put).
 */
function buildShow(roll, prev, { reduced, cont }) {
  const rng = mulberry32(hashStr(String(roll.id)));
  const fromRight = roll.who === 'gm';
  const base = nums(roll.dice?.base);
  const stress = nums(roll.dice?.stress);
  const d20 = nums(roll.dice?.d20);
  const dice = [];
  const pushPrev = roll.pushed && prev && prev.base.length === base.length ? prev : null;
  base.forEach((v, i) => dice.push({ type: 'base', v, kept: !!roll.pushed && (pushPrev ? pushPrev.base[i] === 6 : v === 6) }));
  stress.forEach((v, i) => dice.push({ type: 'stress', v, kept: !!roll.pushed && (pushPrev ? i < pushPrev.stress.length && pushPrev.stress[i] === 6 : v === 6 && i < stress.length - 1) }));
  const cls = classifyD20(roll, d20);
  d20.forEach((v, i) => dice.push({ type: 'd20', v, kept: false, success: cls.hit[i], crit: cls.crit[i], comp: cls.comp[i] }));
  const list = dice.slice(0, MAX_DICE);

  // Settle order: a seeded shuffle, so they land one by one but not strictly left to right.
  const moving = list.map((d, i) => i).filter((i) => !list[i].kept);
  for (let i = moving.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [moving[i], moving[j]] = [moving[j], moving[i]]; }
  const n = moving.length;
  const first = cont ? 520 : 760;
  const stagger = n > 1 ? Math.min(150, (cont ? 520 : 680) / (n - 1)) : 0;
  const order = new Map(moving.map((dieIdx, k) => [dieIdx, k]));

  const out = list.map((d, i) => {
    const k = order.get(i);
    const still = reduced || d.kept;
    const delay = still ? 0 : Math.round(rng() * 90);
    const settleAt = still ? 0 : Math.round(first + k * stagger + rng() * 40);
    const fly = Math.max(420, settleAt - delay);
    const isD6 = d.type !== 'd20';
    const rz = Math.round((rng() - 0.5) * (isD6 ? 26 : 30));
    const [rx, ry] = isD6 ? FACE_ROT[Math.min(6, Math.max(1, d.v))] || [0, 0] : [0, 0];
    const sgn = () => (rng() < 0.5 ? -1 : 1);
    const turnsX = isD6 ? (1 + Math.floor(rng() * 2)) * 360 * sgn() : Math.round((rng() - 0.5) * 100);
    const turnsY = isD6 ? (1 + Math.floor(rng() * 2)) * 360 * sgn() : Math.round((rng() - 0.5) * 100);
    const turnsZ = (isD6 ? Math.floor(rng() * 2) * 360 : (2 + Math.floor(rng() * 2)) * 360) * sgn() + Math.round((rng() - 0.5) * 120);
    // From off-screen on the roller's side (a pushed re-roll hops up in place instead).
    const sx = cont ? `${Math.round((rng() - 0.5) * 60)}%` : `${(fromRight ? 1 : -1) * Math.round(48 + rng() * 26)}vw`;
    const sy = cont ? `${-Math.round(30 + rng() * 40)}%` : `${Math.round((rng() - 0.62) * 34)}vh`;
    const hop = (0.9 + rng() * 0.9).toFixed(2);
    const glyphs = d.type === 'd20' ? Array.from({ length: 12 }, () => 1 + Math.floor(rng() * 20)) : null;
    return {
      ...d, key: `${d.type}-${i}`, still, delay, settleAt, fly, hop, glyphs, sx, sy,
      hit: isD6 ? d.v === 6 : d.success,
      bad: d.type === 'stress' ? d.v === 1 : d.comp,
      r1: `rotateZ(${rz}deg) rotateX(${rx}deg) rotateY(${ry}deg)`,
      r0: `rotateZ(${rz + turnsZ}deg) rotateX(${rx + turnsX}deg) rotateY(${ry + turnsY}deg)`,
    };
  });
  const tAll = out.reduce((m, d) => Math.max(m, d.settleAt), 0);
  const tLit = reduced ? 0 : tAll + 160;
  const tCard = reduced ? 0 : tAll + (out.length ? 420 : 150);
  return { id: roll.id, roll, dice: out, tAll, tLit, tCard, outcome: outcomeOf(roll), fromRight, reduced, cont };
}

/* ─── Dice ─── */
function Pips({ v, oneBad }) {
  return (PIPS[v] || []).map(([r, c], i) => (
    <i key={i} className={`ds-pip${oneBad && v === 1 ? ' red' : ''}`} style={{ gridArea: `${r} / ${c}` }} />
  ));
}

function D6({ d }) {
  return (
    <div className="ds-cube" style={{ '--r0': d.r0, '--r1': d.r1 }}>
      <div className="ds-core ds-core-a" /><div className="ds-core ds-core-b" /><div className="ds-core ds-core-c" />
      {[1, 2, 3, 4, 5, 6].map((f) => (
        <div key={f} className={`ds-face f${f}${f === d.v ? ' up' : ''}`}><Pips v={f} oneBad={d.type === 'stress'} /></div>
      ))}
    </div>
  );
}

/* Front view of an icosahedron: the up face in the middle, nine neighbouring facets around it. */
const H = [[50, 2], [92, 26], [92, 74], [50, 98], [8, 74], [8, 26]];
const A = [50, 25]; const B = [76.5, 70]; const C = [23.5, 70];
const FACETS = [
  [[H[0], H[1], A], 0.16], [[H[1], B, A], -0.08], [[H[1], H[2], B], -0.22], [[H[2], H[3], B], -0.3],
  [[H[3], C, B], -0.16], [[H[3], H[4], C], -0.34], [[H[4], H[5], C], -0.22], [[H[5], A, C], 0.04], [[H[5], H[0], A], 0.24],
];
const pts = (p) => p.map(([x, y]) => `${x},${y}`).join(' ');

function D20({ d, face }) {
  return (
    <div className="ds-d20" style={{ '--r0': d.r0, '--r1': d.r1 }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {FACETS.map(([p, shade], i) => (
          <polygon key={i} className="ds-facet" points={pts(p)}
            style={{ fill: shade >= 0 ? `color-mix(in srgb, var(--ds-d20-body) ${100 - shade * 160}%, #fff)` : `color-mix(in srgb, var(--ds-d20-body) ${100 + shade * 150}%, #000)` }} />
        ))}
        <polygon className="ds-facet ds-facet-up" points={pts([A, B, C])} />
        <text className="ds-d20-num" x="50" y="58.5" textAnchor="middle" dominantBaseline="middle">{face}</text>
        {(face === 6 || face === 9) && <line className="ds-d20-bar" x1="44" x2="56" y1="66" y2="66" />}
      </svg>
    </div>
  );
}

function Die({ d, elapsed, lit }) {
  const landed = d.still || elapsed >= d.settleAt;
  let face = d.v;
  if (d.type === 'd20' && !landed) face = d.glyphs[Math.floor(elapsed / 75) % d.glyphs.length];
  const cls = [
    'ds-die', `t-${d.type}`, d.still ? 'still' : 'moving', landed ? 'landed' : '',
    d.kept ? 'kept' : '', (lit || d.kept) && d.hit ? 'hit' : '', lit && d.bad ? 'bad' : '', lit && d.crit ? 'crit' : '',
    lit && !d.hit && !d.bad ? 'dim' : '',
  ].filter(Boolean).join(' ');
  return (
    <div className={cls} style={{ '--sx': d.sx, '--sy': d.sy, '--fly': `${d.fly}ms`, '--delay': `${d.delay}ms`, '--hop': d.hop }}>
      <div className="ds-shadow" />
      <div className="ds-halo" />
      <div className="ds-hop">
        <div className="ds-tilt">{d.type === 'd20' ? <D20 d={d} face={face} /> : <D6 d={d} />}</div>
      </div>
    </div>
  );
}

function Stage({ show, phase }) {
  const [elapsed, setElapsed] = useState(show.reduced ? 1e9 : 0);
  useEffect(() => {
    if (show.reduced) return undefined;
    const t0 = performance.now();
    const hasD20 = show.dice.some((d) => d.type === 'd20');
    // d20 faces flicker while tumbling; d6 only needs the per-die "landed" step.
    const iv = setInterval(() => {
      const e = performance.now() - t0;
      setElapsed(e);
      if (e > show.tAll + 100) clearInterval(iv);
    }, hasD20 ? 60 : 90);
    return () => clearInterval(iv);
  }, [show]);
  const lit = phase !== 'tumble';
  const { roll, outcome } = show;
  const base = show.dice.filter((d) => d.type === 'base');
  const stress = show.dice.filter((d) => d.type === 'stress');
  const d20 = show.dice.filter((d) => d.type === 'd20');
  const n = show.dice.length || 1;
  const size = `max(44px, min(${n > 10 ? 9 : 12}vh, ${Math.floor(78 / (n * 1.45))}vw))`;
  return (
    <div className={`ds-stage${show.reduced ? ' ds-reduced' : ''}${show.cont ? ' ds-cont' : ''} p-${phase} tone-${outcome.tone}${show.fromRight ? ' from-right' : ' from-left'}`}
      style={{ '--ds-size': size }} data-roll={roll.label || ''} data-who={roll.who || 'player'}>
      <div className="ds-band" aria-hidden="true" />
      <div className="ds-table">
        {show.dice.length > 0 && (
          <div className="ds-row" aria-hidden="true">
            {base.length > 0 && <div className="ds-group g-base">{base.map((d) => <Die key={d.key} d={d} elapsed={elapsed} lit={lit} />)}</div>}
            {stress.length > 0 && <div className="ds-group g-stress">{stress.map((d) => <Die key={d.key} d={d} elapsed={elapsed} lit={lit} />)}</div>}
            {d20.length > 0 && <div className={`ds-group g-d20${roll.who === 'gm' ? ' gm' : ''}`}>{d20.map((d) => <Die key={d.key} d={d} elapsed={elapsed} lit={lit} />)}</div>}
          </div>
        )}
        <div className={`ds-card${phase === 'card' || phase === 'out' ? ' in' : ''}`} role="status" aria-live="polite">
          {(phase === 'card' || phase === 'out') && (
            <>
              <div className="ds-card-kicker">
                {roll.who === 'gm' && <span className="ds-card-gm">GM</span>}
                <b className="ds-card-name">{roll.name || 'ROLL'}</b>
                {roll.label && <span className="ds-card-label">{roll.label}</span>}
              </div>
              <div className="ds-card-big">{outcome.big}</div>
              {outcome.chips.length > 0 && (
                <div className="ds-card-chips">
                  {outcome.chips.map((c) => <span key={c.t} className={`ds-chip k-${c.k}`}>{c.t}</span>)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DiceStage() {
  const { on, role } = useGame();
  const [show, setShow] = useState(null);
  const [phase, setPhase] = useState('tumble'); // tumble → card → out
  const queue = useRef([]);
  const seen = useRef([]);
  const lastByKey = useRef(new Map()); // `${name}|${label}` → { id, base[], stress[] } (unpushed YZE rolls)
  const cur = useRef(null);            // { show, cardAt } while a show is on
  const timers = useRef([]);

  const clearTimers = () => { timers.current.forEach((t) => clearTimeout(t)); timers.current = []; }; // clears intervals too
  const keyOf = (r) => `${r.name || ''}|${r.label || ''}`;
  const isContinuation = (next, current) => !!(next && current && next.pushed && next.kind === 'yze'
    && keyOf(next) === keyOf(current.roll) && !current.roll.pushed);

  const startNext = useCallback(() => {
    clearTimers();
    const prevShow = cur.current?.show || null;
    const roll = queue.current.shift();
    if (!roll) { cur.current = null; setShow(null); return; }
    const reduced = reducedFx();
    const cont = !reduced && isContinuation(roll, prevShow);
    const prev = roll.pushed ? lastByKey.current.get(keyOf(roll)) : null;
    const s = buildShow(roll, prev, { reduced, cont });
    cur.current = { show: s, cardAt: null };
    setShow(s);
    setPhase(reduced ? 'card' : 'tumble');
    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms));

    /* Sound: a soft rattle while the dice tumble, a click per landing die, the outcome cue on the card. */
    if (!reduced && s.dice.length) {
      const rattle = setInterval(() => play('dice.settle', { volume: 0.18 }), 95);
      timers.current.push(rattle);
      at(Math.max(0, s.tAll - 60), () => clearInterval(rattle));
      s.dice.filter((d) => !d.still).forEach((d) => at(d.settleAt, () => play('dice.settle', { volume: 0.7 })));
    }
    const cue = () => {
      if (s.outcome.tone === 'crit') play('dice.crit');
      else if (s.outcome.tone === 'panic' || (s.roll.flags || []).includes('complication')) play('dice.botch');
      else if (reduced) play('dice.settle');
    };
    const toCard = () => {
      setPhase('card');
      cur.current.cardAt = performance.now();
      cue();
      const hold = queue.current.length ? HOLD_BUSY_MS : HOLD_MS;
      at(PUSH_MIN_MS, () => { if (isContinuation(queue.current[0], cur.current?.show)) startNext(); });
      at(hold, () => {
        if (isContinuation(queue.current[0], cur.current?.show)) { startNext(); return; }
        setPhase('out');
        at(reduced ? 0 : FADE_MS, startNext);
      });
    };
    if (s.tCard > 0) at(s.tCard, toCard); else toCard();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (role !== 'board') return undefined;
    const off = on('board-roll', ({ roll } = {}) => {
      if (!roll || typeof roll !== 'object' || !roll.id) return;
      if (seen.current.includes(roll.id)) return;
      seen.current = [...seen.current.slice(-63), roll.id];
      if (roll.kind === 'yze' && !roll.pushed) {
        lastByKey.current.set(keyOf(roll), { id: roll.id, base: nums(roll.dice?.base), stress: nums(roll.dice?.stress) });
        if (lastByKey.current.size > 40) lastByKey.current.delete(lastByKey.current.keys().next().value);
      }
      queue.current.push(roll);
      if (queue.current.length > MAX_QUEUE) queue.current = queue.current.slice(-MAX_QUEUE);
      const c = cur.current;
      if (!c) { startNext(); return; }
      // A push of the roll on screen: go straight to it once the card has been up long enough.
      if (c.cardAt && isContinuation(queue.current[0], c.show) && performance.now() - c.cardAt >= PUSH_MIN_MS) startNext();
    });
    return () => { off(); clearTimers(); };
  }, [on, role, startNext]); // eslint-disable-line react-hooks/exhaustive-deps

  const stage = useMemo(() => (show ? <Stage key={show.id} show={show} phase={phase} /> : null), [show, phase]);
  if (role !== 'board') return null;
  return <div className="ds-root">{stage}</div>;
}
