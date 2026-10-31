import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../../GameContext';
import { useUniverse } from '../../UniverseContext';
import { play as sfxPlay, reducedFx } from '../../sfx';
import './vision.css';

/* ═══════════════════════════════════════════════════════════════
   F6 — PRESCIENCE / SPECIAL ORDER overlay (one component, two hosts).
   The GM sends `vision-send { text, ms, to, board }` (run/IntrigueDrawer);
   the server pushes `vision { vision: { id, text, ms, at, private } }` to
   the TV and the chosen phones (GameContext.onVision).

   variant="tv"    mounted once in board/Overlays.jsx — full-screen, no
                   input, role=status (pointer-events none, under PAUSE).
   variant="phone" mounted once in player/PhoneLayer.jsx — a private flash:
                   modal dialog, focus to DISMISS, Escape/tap closes, the
                   phone's own sound + vibration cue (fx.play, mute-aware).

   Skins (universe-agnostic; picked from the theme, never the universe id):
     theme.visionSkin, else theme.crt ? 'order' : 'prescience'
     prescience  spice-blue shimmer, the line fades in and out (DUNE)
     order       terminal "special order" override screen, typed line,
                 draining timer bar, terminal.name in the header (ALIEN)
   Lifecycle: enter → in (fade over ~20 % of ms, ≤ 1.6 s) → out → gone.
   A newer vision replaces the current one. Reduced FX: no shimmer, no
   typing, instant cuts (the html.fx-reduced rule zeroes transitions).
   ═══════════════════════════════════════════════════════════════ */

export function visionSkin(universe) {
  const t = universe?.theme || {};
  return t.visionSkin || (t.crt ? 'order' : 'prescience');
}

/** Typed reveal for the terminal skin (instant under reduced FX). */
function useTyped(text, key, on) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const full = String(text || '');
    if (!on || reducedFx()) { setN(full.length); return undefined; }
    setN(0);
    let i = 0;
    const t = setInterval(() => {
      i = Math.min(full.length, i + 1);
      setN(i);
      if (i % 3 === 0) sfxPlay('boot.key', { volume: 0.5 });
      if (i >= full.length) clearInterval(t);
    }, 38);
    return () => clearInterval(t);
  }, [text, key, on]);
  return String(text || '').slice(0, n);
}

export default function VisionOverlay({ variant = 'tv', fx = null }) {
  const { onVision, connected } = useGame();
  const { universe } = useUniverse();
  const [vision, setVision] = useState(null);   // { id, text, ms, private }
  const [phase, setPhase] = useState('gone');   // enter | in | out | gone
  const timers = useRef([]);
  const onVisionRef = useRef(onVision);
  onVisionRef.current = onVision;
  const fxRef = useRef(fx);
  fxRef.current = fx;
  const dismissRef = useRef(null);
  const opener = useRef(null);
  const phone = variant === 'phone';
  const skin = visionSkin(universe);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const close = () => {
    clearTimers();
    setPhase('out');
    timers.current.push(setTimeout(() => { setPhase('gone'); setVision(null); }, 450));
  };

  /* Subscribe on the live socket; re-subscribe when the connection (re)appears. */
  useEffect(() => {
    if (!connected) return undefined;
    const off = onVisionRef.current?.((payload) => {
      const v = payload?.vision;
      if (!v || typeof v.text !== 'string' || !v.text.trim()) return;
      const ms = Math.max(2000, Math.min(30000, Number(v.ms) || 9000));
      const fade = Math.min(1600, Math.round(ms * 0.2));
      clearTimers();
      setVision({ id: v.id || String(Date.now()), text: v.text, ms, fade, private: !!v.private });
      setPhase('enter');
      timers.current.push(setTimeout(() => setPhase('in'), 30));
      timers.current.push(setTimeout(() => setPhase('out'), ms - fade));
      timers.current.push(setTimeout(() => { setPhase('gone'); setVision(null); }, ms));
      if (phone) fxRef.current?.play?.('orders');
      else sfxPlay(skin === 'order' ? 'alert.incoming' : 'reveal');
    });
    return () => { off?.(); };
  }, [connected, phone, skin]);
  useEffect(() => () => clearTimers(), []);

  /* Phone: focus moves to DISMISS while the flash is up and returns afterwards; Escape closes. */
  const open = !!vision && phase !== 'gone';
  useEffect(() => {
    if (!phone || !open) return undefined;
    opener.current = document.activeElement;
    const t = setTimeout(() => dismissRef.current?.focus({ preventScroll: true }), 40);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      const back = opener.current;
      if (back && typeof back.focus === 'function' && document.contains(back)) back.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, open, vision?.id]);

  const typed = useTyped(vision?.text, vision?.id, skin === 'order' && open);
  if (!open) return null;

  const style = { '--vis-ms': `${vision.ms}ms`, '--vis-fade': `${vision.fade}ms` };
  const cls = `vis vis-${skin} vis-${variant} vis-${phase}`;
  const term = universe?.terminal?.name || 'TERMINAL';
  const kicker = skin === 'order' ? 'SPECIAL ORDER' : 'PRESCIENCE';
  const body = skin === 'order' ? (
    <div className="vis-order-panel">
      <div className="vis-order-head">
        <span className="vis-order-k">{kicker}</span>
        <span className="vis-order-src">{term} · PRIORITY OVERRIDE</span>
      </div>
      <div className="vis-order-meta">DIRECTIVE {String(vision.id).slice(-4).toUpperCase()} · {vision.private ? 'EYES ONLY' : 'ALL STATIONS'}</div>
      <p className="vis-order-text">{typed}<span className="vis-caret" aria-hidden="true" /></p>
      <div className="vis-bar" aria-hidden="true"><i /></div>
    </div>
  ) : (
    <div className="vis-pre-inner">
      <div className="vis-pre-eye" aria-hidden="true"><i /><i /><i /></div>
      <div className="vis-pre-k">{kicker}</div>
      <p className="vis-pre-text">{vision.text}</p>
      {vision.private && phone && <div className="vis-pre-foot">ONLY YOU SAW THIS</div>}
    </div>
  );

  if (!phone) {
    return (
      <div className={cls} style={style} role="status" aria-live="assertive" aria-label={`${kicker}: ${vision.text}`}>
        <div className="vis-bg" aria-hidden="true" />
        {body}
      </div>
    );
  }
  return (
    <div className={cls} style={style} role="dialog" aria-modal="true" aria-label={kicker} onClick={close}>
      <div className="vis-bg" aria-hidden="true" />
      {body}
      <button ref={dismissRef} type="button" className="vis-dismiss" onClick={(e) => { e.stopPropagation(); close(); }}>
        {vision.private && skin === 'order' ? 'ACKNOWLEDGE · EYES ONLY' : 'DISMISS'}
      </button>
    </div>
  );
}
