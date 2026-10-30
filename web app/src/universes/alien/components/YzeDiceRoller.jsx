import React, { useState, useCallback, useEffect, useRef } from 'react';
import { play, reducedFx } from '../../../engine/sfx';

/* ═══════════════════════════════════════════════════════════════
   Year Zero (ALIEN) roller. Base dice = attribute + skill (+ gear bonus);
   Stress dice = current Stress Level. Any 6 is a success (extra 6s are
   stunts). A 1 on any Stress Die triggers a Panic Roll.
   PUSH: +1 Stress (one more Stress Die), re-roll every die not showing 6.

   Props:
     preset { attr, skill, bonus, label, attrKey?, skillKey?, stress?, kind?, total?, at? }
       pre-fills the pool (base = attr + skill + bonus, or `total` when the
       parts are missing; stress if given) and shows the label. The phone's
       sheet sends the full session shape; the simple shape still works.
       Changing the preset re-applies it.
     compact  (phones) tighter layout.
     onResult(roll)  called once per settled roll (and again after a push) with
       { kind:'yze', label, skillKey, attrKey, summary, successes, stunts, pushed,
         panic, stressGain, flags[], dice: { base[], stress[] }, pool: { base, stress } }
       flags: 'panic' (Stress Die 1), 'push', 'crit' (2+ sixes), 'botch' (zero successes and NO panic —
       panic supersedes botch; the feed, TV toast and phone all show PANIC alone, in the botch styling).

   Feedback is settle-then-celebrate: dice tumble ~0.5 s, settle, then a
   result overlay + sfx cue (dice.settle → dice.crit / dice.botch). With
   reduced motion / REDUCE FX the dice land at once and no overlay plays.
   ═══════════════════════════════════════════════════════════════ */

const rollD6 = () => Math.floor(Math.random() * 6) + 1;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function score(baseRolls, stressRolls) {
  const successes = baseRolls.filter((r) => r === 6).length + stressRolls.filter((r) => r === 6).length;
  const panic = stressRolls.some((r) => r === 1);
  return { successes, panic };
}

function outcome(res) {
  if (res.panic) return { kind: 'botch', text: 'PANIC' };
  if (res.successes >= 2) return { kind: 'crit', text: `SUCCESS +${res.successes - 1} STUNT${res.successes > 2 ? 'S' : ''}` };
  if (res.successes === 1) return { kind: 'success', text: 'SUCCESS' };
  return { kind: 'botch', text: 'BOTCH · NO SUCCESS' };
}

/** Roll report for the session feed (onResult). */
function report(final, meta) {
  const stunts = Math.max(0, final.successes - 1);
  const flags = [];
  if (final.panic) flags.push('panic');
  else if (final.successes === 0) flags.push('botch');
  if (final.pushed) flags.push('push');
  if (final.successes >= 2) flags.push('crit');
  const o = outcome(final);
  return {
    kind: 'yze',
    label: final.label || 'ROLL',
    skillKey: meta.skillKey || null,
    attrKey: meta.attrKey || null,
    summary: `${final.label || 'ROLL'} — ${o.text}${final.pushed ? ' (PUSHED)' : ''}`,
    successes: final.successes,
    stunts,
    pushed: !!final.pushed,
    panic: !!final.panic,
    stressGain: final.pushed ? 1 : 0,
    flags,
    dice: { base: final.baseRolls, stress: final.stressRolls },
    pool: { base: final.baseRolls.length, stress: final.stressRolls.length },
  };
}

export default function DiceRoller({ preset, compact = false, onResult }) {
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const metaRef = useRef({});
  const [baseDice, setBaseDice] = useState(6);
  const [stressDice, setStressDice] = useState(0);
  const [label, setLabel] = useState(null);
  const [result, setResult] = useState(null);
  const [tumble, setTumble] = useState(null);
  const [rollId, setRollId] = useState(0);
  const timer = useRef(null);
  useEffect(() => () => clearInterval(timer.current), []);

  /* Apply a preset whenever its contents change. */
  const presetKey = preset ? JSON.stringify(preset) : '';
  useEffect(() => {
    if (!preset) return;
    const hasParts = preset.attr != null || preset.skill != null;
    const base = hasParts
      ? (Number(preset.attr) || 0) + (Number(preset.skill) || 0) + (Number(preset.bonus) || 0)
      : Number(preset.total) || 0;
    metaRef.current = { skillKey: preset.skillKey, attrKey: preset.attrKey };
    setBaseDice(clamp(base, 0, 20));
    if (preset.stress != null) setStressDice(clamp(Number(preset.stress) || 0, 0, 10));
    setLabel(preset.label || null);
    setResult(null);
  }, [presetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Show tumbling faces, then settle on `final` and celebrate. */
  const reveal = useCallback((final, faces) => {
    clearInterval(timer.current);
    setRollId((n) => n + 1);
    setResult(final);
    const celebrate = () => {
      play('dice.settle');
      const o = outcome(final);
      if (o.kind === 'botch') setTimeout(() => play('dice.botch'), 120);
      else if (o.kind === 'crit') setTimeout(() => play('dice.crit'), 120);
      try { onResultRef.current?.(report(final, metaRef.current)); } catch (e) { console.error('[roller] onResult failed', e); }
    };
    if (reducedFx()) { setTumble(null); celebrate(); return; }
    let ticks = 0;
    setTumble(faces());
    timer.current = setInterval(() => {
      ticks += 1;
      if (ticks >= 6) { clearInterval(timer.current); setTumble(null); celebrate(); return; }
      setTumble(faces());
    }, 80);
  }, []);

  const doRoll = useCallback(() => {
    const baseRolls = Array.from({ length: Math.max(0, baseDice) }, rollD6);
    const stressRolls = Array.from({ length: Math.max(0, stressDice) }, rollD6);
    const final = { baseRolls, stressRolls, ...score(baseRolls, stressRolls), pushed: false, label };
    reveal(final, () => ({ base: baseRolls.map(rollD6), stress: stressRolls.map(rollD6) }));
  }, [baseDice, stressDice, label, reveal]);

  const canPush = !!result && !tumble && !result.pushed && !result.panic
    && [...result.baseRolls, ...result.stressRolls].some((r) => r !== 6);

  const doPush = useCallback(() => {
    if (!result) return;
    const baseRolls = result.baseRolls.map((r) => (r === 6 ? 6 : rollD6()));
    const stressRolls = [...result.stressRolls.map((r) => (r === 6 ? 6 : rollD6())), rollD6()];
    setStressDice((s) => clamp(s + 1, 0, 10));
    const final = { baseRolls, stressRolls, ...score(baseRolls, stressRolls), pushed: true, label: result.label };
    reveal(final, () => ({
      base: result.baseRolls.map((r) => (r === 6 ? 6 : rollD6())),
      stress: [...result.stressRolls.map((r) => (r === 6 ? 6 : rollD6())), rollD6()],
    }));
  }, [result, reveal]);

  const o = result && !tumble ? outcome(result) : null;
  const shownBase = tumble ? tumble.base : result?.baseRolls || [];
  const shownStress = tumble ? tumble.stress : result?.stressRolls || [];

  return (
    <div className="panel">
      <h2>DICE ROLLER</h2>
      {!compact && (
        <p style={{ color: 'var(--text-dim)', marginBottom: '1rem', fontSize: '0.95rem', lineHeight: 1.5 }}>
          Roll Base Dice + Stress Dice. Any 6 is a success. A 1 on a Stress Die triggers a Panic Roll. Push to re-roll everything that isn&apos;t a 6 — at the cost of one more Stress.
        </p>
      )}
      {label && (
        <div className="roll-preset">
          <b>{label}</b>
          <span>{baseDice} BASE · {stressDice} STRESS</span>
          <button type="button" onClick={() => { setLabel(null); metaRef.current = {}; }}>CLEAR</button>
        </div>
      )}
      <div className="dice-controls">
        <label>
          Base Dice:
          <input type="number" min="0" max="20" value={baseDice} onChange={(e) => setBaseDice(clamp(parseInt(e.target.value) || 0, 0, 20))} />
        </label>
        <label style={{ color: 'var(--warn)' }}>
          Stress Dice:
          <input type="number" min="0" max="10" value={stressDice} onChange={(e) => setStressDice(clamp(parseInt(e.target.value) || 0, 0, 10))}
            style={{ borderColor: 'var(--warn-dim)', color: 'var(--warn)' }} />
        </label>
        <button className="btn" onClick={doRoll} disabled={!!tumble}>ROLL {baseDice + stressDice}D6</button>
      </div>
      <div className="die-legend" aria-hidden="true">
        <span><i className="lg-base" />BASE</span>
        <span><i className="lg-stress" />STRESS</span>
        <span><i className="lg-panic" />1 ON STRESS = PANIC</span>
      </div>
      <div className="roll-result roll-stage" aria-live="polite">
        {result ? (
          <>
            <div className="dice-display" key={rollId}>
              {shownBase.map((r, i) => (
                <span key={`b${i}`} className={`die base${tumble ? ' rolling' : ` settled${r === 6 ? ' success' : ''}`}`}>{r}</span>
              ))}
              {shownStress.map((r, i) => (
                <span key={`s${i}`} className={`die stress${tumble ? ' rolling' : ` settled${r === 6 ? ' success' : ''}${r === 1 ? ' panic' : ''}`}`}
                  title={!tumble && r === 1 ? 'Panic trigger' : 'Stress die'}>{r}</span>
              ))}
            </div>
            {o && (
              <>
                <div className={`roll-banner ${result.panic ? 'panic' : result.successes ? 'success' : 'fail'}`}>
                  <span className="rb-tag">{o.text}</span>
                  <span>
                    {result.successes} six{result.successes === 1 ? '' : 'es'}{result.pushed ? ' after a push' : ''}.{' '}
                    {result.panic
                      ? `A Stress Die shows 1 — make a Panic Roll (D6 + Stress ${stressDice}).`
                      : result.successes === 0
                        ? 'No success.'
                        : 'First 6 succeeds; extra 6s are stunts.'}
                  </span>
                </div>
                {!result.pushed && !result.panic && (
                  <div className="roll-push">
                    <button type="button" className="btn-push" onClick={doPush} disabled={!canPush}>PUSH THE ROLL (+1 STRESS)</button>
                    <small>Re-rolls every die that isn&apos;t a 6 and adds one Stress Die.</small>
                  </div>
                )}
                <div key={`c${rollId}`} className={`roll-celebrate ${o.kind}`} aria-hidden="true"><span>{o.text}</span></div>
              </>
            )}
          </>
        ) : (
          <div style={{ color: 'var(--text-dim)' }}>— Roll the dice to see results —</div>
        )}
      </div>
    </div>
  );
}
