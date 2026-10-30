import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../../GameContext';
import { useUniverse } from '../../UniverseContext';
import { panicOutcome, rollDie } from '../../mechanicsUtils';
import { play as sfx, reducedFx } from '../../sfx';

/* ═══════════════════════════════════════════════════════════════
   PANIC ROLL (phone, backlog row 42) — shown when a roll flags panic
   and the universe has rules.panic. The player taps ROLL: d(rules.panic.die)
   + Stress at the time of the roll, looked up in the panic table; the
   effect text is shown privately and `panic-result` goes to the server
   (status effect + stress + TV ring, see server/mechanics.js).
   Never auto-resolves: the player rolls, the GM narrates.
   Props: pending { rollId, stress }, onClose(), fx (player/fx useFx)
   ═══════════════════════════════════════════════════════════════ */
export default function PanicOverlay({ pending, onClose, fx }) {
  const { panicResult } = useGame();
  const { universe } = useUniverse();
  const cfg = universe.rules?.panic;
  const [die, setDie] = useState(null);
  const [tumble, setTumble] = useState(null);
  const [result, setResult] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearInterval(timer.current), []);
  useEffect(() => { fx?.play?.('alert'); }, [fx]);
  if (!cfg || !pending) return null;
  const stress = cfg.stressAdd ? Math.max(0, Number(pending.stress) || 0) : 0;

  const roll = () => {
    const d = rollDie(cfg.die || 6);
    const finish = () => {
      setTumble(null);
      setDie(d);
      const out = panicOutcome(universe, d + stress);
      setResult(out);
      sfx('dice.settle');
      if (out?.effect.status.length) setTimeout(() => sfx('dice.botch'), 120);
      if (out) panicResult({ rollId: pending.rollId, total: out.total, die: d, effect: out.effect });
      try { if (out?.effect.status.length) navigator.vibrate?.([200, 80, 200]); } catch { /* ignore */ }
    };
    if (reducedFx()) { finish(); return; }
    let n = 0;
    setTumble(rollDie(6));
    timer.current = setInterval(() => {
      n += 1;
      if (n >= 7) { clearInterval(timer.current); finish(); return; }
      setTumble(rollDie(6));
    }, 80);
  };

  const severe = result?.effect.status.length > 0;
  return (
    <div className={`ph-panic${severe ? ' severe' : ''}${result ? ' done' : ''}`} role="alertdialog" aria-label="Panic roll">
      <div className="ph-panic-card">
        <div className="ph-panic-kicker">STRESS DIE — 1</div>
        <h1 className="ph-panic-title">PANIC ROLL</h1>
        {!result ? (
          <>
            <p className="ph-panic-rule">Roll D{cfg.die || 6} + STRESS {stress}. Higher is worse.</p>
            <div className="ph-panic-dice" aria-live="polite">
              <span className={`ph-panic-die${tumble ? ' rolling' : ''}`}>{tumble ?? '?'}</span>
              {stress > 0 && <span className="ph-panic-plus">+ {stress}</span>}
            </div>
            <button type="button" className="pv-btn primary ph-wide ph-panic-roll" onClick={roll} disabled={!!tumble}>
              {tumble ? 'ROLLING…' : `ROLL D${cfg.die || 6}`}
            </button>
          </>
        ) : (
          <>
            <div className="ph-panic-dice">
              <span className="ph-panic-die settled">{die}</span>
              {stress > 0 && <span className="ph-panic-plus">+ {stress}</span>}
              <span className="ph-panic-total">= {result.total}</span>
            </div>
            <div className="ph-panic-effect">
              <h2>{result.effect.name.toUpperCase()}</h2>
              <p>{result.effect.text}</p>
              {result.effect.stressDelta !== 0 && (
                <p className="ph-panic-stress">STRESS {result.effect.stressDelta > 0 ? '+' : ''}{result.effect.stressDelta}</p>
              )}
              {result.effect.panicAction && <p className="ph-panic-act">PANIC ACTION — YOUR NEXT ACTION IS FORCED.</p>}
            </div>
            <button type="button" className="pv-btn primary ph-wide" onClick={onClose}>UNDERSTOOD</button>
          </>
        )}
      </div>
    </div>
  );
}
