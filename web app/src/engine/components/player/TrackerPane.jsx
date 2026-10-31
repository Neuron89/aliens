import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../GameContext';
import { useUniverse } from '../../UniverseContext';
import { reducedFx } from '../../sfx';
import { readMuted } from './fx';
import './tracker.css';

/* ═══════════════════════════════════════════════════════════════
   TRACKER tab (F1): the handheld motion tracker as a phone mode.
   Mounted by PlayerView when `universe.features.tracker` is set.
   Data: `table.tracker` from the player's table view (server/sessions.js
   "F1 — MOTION TRACKER"): { on, source, fix, facing, range, rings,
   contacts: [{ bearing, distance, strength }], nearest }. The server
   never sends positions, ids or names; bearings are degrees clockwise
   from map-up, distances in metres. Contacts are the GM's moving (or
   signal-flagged) npc / creature tokens, walls ignored.
   Display: a 60° forward fan (aim = own token facing, turnable here),
   range rings at 5/10/20 m, rim at 30 m, a pulse wave from the apex,
   blips that light on each pulse, the nearest in-arc distance in big
   digits. Audio: an outgoing pulse and a return ping that speeds up
   and rises in pitch as the nearest contact closes (local WebAudio,
   respects the phone's SOUND/MUTED). Reduced FX: no wave, no flashes.
   ═══════════════════════════════════════════════════════════════ */

const HALF = 30;                 // half the fan, degrees
const VB_W = 340;
const VB_H = 322;
const AX = 170;                  // apex
const AY = 306;
const R = 286;                   // rim radius (svg units)
const STOPS = [[0, 0], [5, 0.27], [10, 0.5], [20, 0.8], [30, 1]]; // metres → fraction of R
const AIM_STEP = 30;

const rad = (d) => (d * Math.PI) / 180;
const norm180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
function radiusOf(m, range = 30) {
  const d = Math.max(0, Math.min(range, m)) * (30 / range);
  for (let i = 1; i < STOPS.length; i++) {
    const [d1, f1] = STOPS[i];
    const [d0, f0] = STOPS[i - 1];
    if (d <= d1) return (f0 + ((d - d0) / (d1 - d0)) * (f1 - f0)) * R;
  }
  return R;
}
const at = (r, a) => [AX + r * Math.sin(rad(a)), AY - r * Math.cos(rad(a))];
function arcPath(r) {
  const [x0, y0] = at(r, -HALF);
  const [x1, y1] = at(r, HALF);
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}
const FAN = (() => {
  const [x0, y0] = at(R, -HALF);
  const [x1, y1] = at(R, HALF);
  return `M ${AX} ${AY} L ${x0.toFixed(1)} ${y0.toFixed(1)} A ${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`;
})();
/** Pulse interval (ms): slow at the rim, frantic up close; idle sweep with no contact in the arc. */
const cadence = (d, range = 30) => (d === null || d === undefined ? 2000 : Math.round(220 + 1280 * Math.max(0, Math.min(1, d / range))));
const fmtDist = (d) => (d === null || d === undefined ? '--.-' : (d < 10 ? `0${d.toFixed(1)}` : d.toFixed(1)));
const side = (a) => (Math.abs(a) < 4 ? 'AHEAD' : `${Math.abs(Math.round(a))}° ${a < 0 ? 'L' : 'R'}`);

/* ── Local WebAudio cues: tracker.ping (pulse + return) and tracker.lock ── */
let actx = null;
function audio() {
  if (actx) return actx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try { actx = new AC(); } catch { actx = null; }
  return actx;
}
function tone(ac, { freq, to, at: off = 0, dur, gain, wave = 'sine' }) {
  const t = ac.currentTime + 0.01 + off;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = wave;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ac.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
/** play('tracker.ping', { distance, range }) | play('tracker.lock'). No-op when muted or before a gesture. */
export function trackerCue(name, { distance = null, range = 30 } = {}) {
  if (readMuted()) return;
  if (typeof navigator !== 'undefined' && navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  const ac = audio();
  if (!ac) return;
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  try {
    if (name === 'tracker.lock') {
      tone(ac, { freq: 1760, dur: 0.05, gain: 0.07, wave: 'square' });
      tone(ac, { freq: 2350, at: 0.07, dur: 0.07, gain: 0.07, wave: 'square' });
      return;
    }
    // Outgoing pulse: a soft rising chirp.
    tone(ac, { freq: 820, to: 1240, dur: 0.07, gain: 0.045 });
    if (distance === null || distance === undefined) return;
    // Return ping: closer = sooner, higher, louder.
    const near = 1 - Math.max(0, Math.min(1, distance / range));
    tone(ac, { freq: 1150 + 950 * near, at: 0.16 - 0.1 * near, dur: 0.11, gain: 0.06 + 0.07 * near, wave: 'triangle' });
  } catch { /* audio graph errors are never fatal */ }
}

export default function TrackerPane() {
  const { table, connected, sendPlayerMessage } = useGame();
  const { universe } = useUniverse();
  const gmShort = universe.terms?.gmShort || universe.terms?.gm || 'GM';
  const tr = table?.tracker || null;
  const range = tr?.range || 30;
  const [aimOffset, setAimOffset] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [asked, setAsked] = useState(false);
  const [calm] = useState(() => reducedFx());
  const aim = norm180((tr?.facing || 0) + aimOffset);

  /* Contacts in arc coordinates (relative angle to the aim). */
  const contacts = useMemo(() => (tr?.contacts || []).map((c) => ({ ...c, rel: norm180(c.bearing - aim) })), [tr, aim]);
  const inArc = contacts.filter((c) => Math.abs(c.rel) <= HALF);
  const left = contacts.filter((c) => c.rel < -HALF).length;
  const right = contacts.filter((c) => c.rel > HALF).length;
  const nearest = inArc.length ? inArc[0].distance : null;

  /* The blips shown are the snapshot taken at the last pulse (like the real thing). */
  const [shown, setShown] = useState([]);
  const live = useRef({ inArc, nearest, range });
  live.current = { inArc, nearest, range };
  const active = !!(tr?.on && tr?.fix);
  const hadContact = useRef(false);

  useEffect(() => {
    if (!active) { setShown([]); return undefined; }
    let timer = null;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const { inArc: arc, nearest: n, range: rg } = live.current;
      setShown(arc);
      setPulse((p) => p + 1);
      if (arc.length && !hadContact.current) trackerCue('tracker.lock');
      hadContact.current = arc.length > 0;
      trackerCue('tracker.ping', { distance: n, range: rg });
      timer = setTimeout(tick, cadence(n, rg));
    };
    timer = setTimeout(tick, 120);
    return () => { stopped = true; clearTimeout(timer); };
  }, [active]);

  // Turning the tracker redraws the blips at once (no need to wait for the next pulse).
  useEffect(() => { if (active) setShown(live.current.inArc); }, [aim, active]);

  const interval = cadence(nearest, range);
  const status = !tr ? 'off' : !tr.on ? 'none' : !tr.fix ? 'nofix' : 'live';
  const turnHint = !inArc.length && (left || right)
    ? (left >= right ? `${left + right} OUTSIDE ARC · TURN LEFT` : `${left + right} OUTSIDE ARC · TURN RIGHT`)
    : (left || right) ? `${left + right} MORE OUTSIDE ARC` : null;
  const heading = ((Math.round(aim) % 360) + 360) % 360;
  const summary = status !== 'live' ? '' : inArc.length
    ? `${inArc.length} contact${inArc.length === 1 ? '' : 's'} in arc. Nearest ${nearest} metres, ${side(inArc[0].rel)}.`
    : 'No movement in arc.';

  if (status === 'off' || status === 'none') {
    return (
      <div className="pp-pane trk-pane">
        <div className="trk-shell trk-off">
          <div className="trk-head"><span>MOTION TRACKER</span><span>OFFLINE</span></div>
          <p className="trk-offmsg">{status === 'off' ? 'TRACKER UNAVAILABLE.' : 'NO MOTION TRACKER IN YOUR GEAR.'}</p>
          {status === 'none' && (
            <>
              <p className="pp-dim">Carry one (it shows in GEAR) or ask the {gmShort} to issue one.</p>
              <button type="button" className="pp-btn pp-btn-sm" disabled={asked || !connected}
                onClick={() => { sendPlayerMessage?.('Requesting a motion tracker.'); setAsked(true); }}>
                {asked ? 'ASKED' : `ASK THE ${gmShort}`}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`pp-pane trk-pane${calm ? ' trk-calm' : ''}`}>
      <div className="trk-shell">
        <div className="trk-head">
          <span>{tr.source === 'gm' ? 'MOTION TRACKER · ISSUED' : 'MOTION TRACKER'}</span>
          <span>RNG {range} M</span>
        </div>
        <div className="trk-screen">
          <svg className="trk-svg" viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-label={`Motion tracker. ${summary || 'No fix.'}`}>
            <defs>
              <clipPath id="trk-fan"><path d={FAN} /></clipPath>
              <radialGradient id="trk-glow" cx={AX} cy={AY} r={R} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="var(--trk)" stopOpacity="0.16" />
                <stop offset="1" stopColor="var(--trk)" stopOpacity="0.02" />
              </radialGradient>
              <filter id="trk-bloom" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.4" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <path d={FAN} className="trk-fan" fill="url(#trk-glow)" />
            <g clipPath="url(#trk-fan)">
              {/* bearing spokes every 15° */}
              {[-30, -15, 0, 15, 30].map((a) => {
                const [x, y] = at(R, a);
                return <line key={a} x1={AX} y1={AY} x2={x} y2={y} className={a === 0 ? 'trk-spoke trk-spoke0' : 'trk-spoke'} />;
              })}
              {/* scanlines */}
              {Array.from({ length: 40 }, (_, i) => <line key={i} x1="0" x2={VB_W} y1={i * 8} y2={i * 8} className="trk-scan" />)}
              {!calm && status === 'live' && (
                <g key={`w${pulse}`} transform={`translate(${AX} ${AY})`}>
                  <circle r={R} className="trk-wave" style={{ animationDuration: `${Math.min(900, interval - 60)}ms` }} />
                </g>
              )}
            </g>
            {(tr.rings || [5, 10, 20]).map((m) => {
              const r = radiusOf(m, range);
              const [lx, ly] = at(r, HALF);
              return (
                <g key={m}>
                  <path d={arcPath(r)} className="trk-ring" />
                  <text x={lx + 5} y={ly + 3} className="trk-ringlbl">{m}</text>
                </g>
              );
            })}
            <path d={arcPath(R)} className="trk-ring trk-rim" />
            <path d={FAN} className="trk-edge" />
            {/* blips (snapshot of the last pulse) */}
            {status === 'live' && shown.map((c, i) => {
              const [x, y] = at(radiusOf(c.distance, range), Math.max(-HALF, Math.min(HALF, c.rel)));
              const s = Math.max(0.2, Math.min(1, c.strength));
              return (
                <g key={`${pulse}-${i}`} className="trk-blip" style={{ '--s': (0.35 + 0.65 * s).toFixed(2) }}>
                  <circle cx={x} cy={y} r={3.5 + 3 * s} filter="url(#trk-bloom)" />
                  <text x={x + 9 + 3 * s} y={y + 4} className="trk-bliplbl">{c.distance.toFixed(c.distance < 10 ? 1 : 0)}</text>
                </g>
              );
            })}
            {status === 'live' && left > 0 && <text x="8" y={AY - 40} className="trk-out">◄ {left}</text>}
            {status === 'live' && right > 0 && <text x={VB_W - 8} y={AY - 40} textAnchor="end" className="trk-out">{right} ►</text>}
            <circle cx={AX} cy={AY} r="4" className="trk-apex" />
            {status === 'nofix' && <text x={AX} y={AY - R * 0.55} textAnchor="middle" className="trk-nofix">NO FIX</text>}
          </svg>
        </div>
        <div className="trk-read" aria-hidden="true">
          <div className="trk-digits">
            <span className="trk-ghost">88.8</span>
            <span className={`trk-num${nearest !== null ? ' trk-hot' : ''}`}>{status === 'live' ? fmtDist(nearest) : '--.-'}</span>
          </div>
          <div className="trk-units">
            <b>M</b>
            <small>{status === 'nofix' ? 'NOT ON MAP' : nearest !== null ? side(inArc[0].rel) : 'NO MOVEMENT'}</small>
            <small>CONTACTS {String(inArc.length).padStart(2, '0')}</small>
          </div>
        </div>
        <p className="trk-hint" aria-live="polite">{status === 'nofix' ? `You are not on the map yet. The ${gmShort} places your token.` : (turnHint || summary)}</p>
        <div className="trk-aim" role="group" aria-label="Aim the tracker">
          <button type="button" className="pp-btn pp-btn-sm" onClick={() => setAimOffset((a) => norm180(a - AIM_STEP))} aria-label={`Turn left ${AIM_STEP} degrees`}>◄ {AIM_STEP}°</button>
          <button type="button" className="pp-btn pp-btn-sm" onClick={() => setAimOffset(0)} aria-pressed={aimOffset === 0}
            aria-label={`Aim along your facing, heading ${heading} degrees`}>HDG {String(heading).padStart(3, '0')}</button>
          <button type="button" className="pp-btn pp-btn-sm" onClick={() => setAimOffset((a) => norm180(a + AIM_STEP))} aria-label={`Turn right ${AIM_STEP} degrees`}>{AIM_STEP}° ►</button>
        </div>
        {readMutedSafe() && <p className="trk-muted">SOUND IS MUTED · UNMUTE IN THE MENU TO HEAR THE PING</p>}
      </div>
    </div>
  );
}

function readMutedSafe() { try { return readMuted(); } catch { return false; } }
