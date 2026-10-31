import React, { useState, useCallback, useEffect, useRef } from 'react';
import { rules } from '../rules.js';
import { play, reducedFx } from '../../../engine/sfx';

/* 2d20 test roller.
   Target number = drive + skill. Roll 2d20 (+ up to 3 bonus d20 bought with
   Momentum or Threat). Each die ≤ target = 1 success; each die within the
   critical range = 2 successes (range 1 normally; with a relevant FOCUS the
   range extends to the skill rating). Each die within the complication range
   (20 by default, widening down to 16) is a complication. Successes beyond the
   Difficulty become Momentum. Difficulty 0 always succeeds.

   Props: preset { attr, skill, bonus, label, attrKey?, skillKey?, kind?, total?, stress?, at?, difficulty?, requestId? }
   pre-fills Drive (attr) + Skill and the bonus d20s, selects attrKey/skillKey,
   and shows the label (the phone sheet sends the full session shape; extra
   keys are ignored; `difficulty` sets the Difficulty, `requestId` — a GM roll request — is copied
   onto the result so the phone's sendRoll answers it). Settle-then-celebrate: dice tumble, settle, then a
   result overlay + sfx (dice.settle → dice.crit / dice.botch).
   onResult(roll) is called once per settled roll with
   { kind:'2d20', label, skillKey, attrKey, summary, successes, complications, passed,
     momentum, difficulty, target, flags[], dice: { d20[] } }
   flags: 'crit' (a die scored 2), 'complication', 'botch' (complication on a failure).
   compact (phones) hides the rules blurb. */

const { attributes, skills, dice } = rules;
const BASE = dice.baseDice || 2;
const MAX_BONUS = dice.maxBonusDice ?? 3;
const MAX_DIFF = dice.maxDifficulty ?? 5;

const rollD20 = () => Math.floor(Math.random() * 20) + 1;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const DIFF_NAMES = ['Simple (D0)', 'Average (D1)', 'Challenging (D2)', 'Daunting (D3)', 'Dire (D4)', 'Epic (D5)'];

const selectStyle = {
  background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)',
  padding: '0.4rem', fontFamily: 'inherit', fontSize: '0.9rem', borderRadius: '2px',
};

const CSS = `
.d20-tray{display:flex;flex-wrap:wrap;gap:1.4rem 1.7rem;align-items:center;min-height:4.8rem;margin:.5rem 0 1.4rem}
.d20{position:relative;width:3.6rem;height:3.6rem;display:grid;place-items:center}
.d20-face{position:absolute;inset:0;clip-path:polygon(50% 0,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%);
  background:linear-gradient(160deg,var(--border-bright),var(--border) 70%)}
.d20-face::before{content:'';position:absolute;inset:2px;clip-path:polygon(50% 0,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%);background:var(--bg-card)}
.d20-face::after{content:'';position:absolute;left:22%;right:22%;top:20%;bottom:30%;clip-path:polygon(50% 0,100% 100%,0 100%);
  background:color-mix(in srgb,var(--text) 3%,transparent)}
.d20-num{position:relative;font-family:var(--font-display);font-size:1.25rem;font-weight:700;color:var(--text-dim);text-shadow:0 1px 2px #000}
.d20.rolling .d20-num{color:var(--text);opacity:.75}
.d20.rolling{animation:d20-tumble .15s linear infinite}
.d20.settled{animation:d20-settle .42s cubic-bezier(.2,1.4,.4,1) both}
.d20.success .d20-face{background:linear-gradient(160deg,var(--accent-bright),var(--accent-dim))}
.d20.success .d20-face::before{background:color-mix(in srgb,var(--accent) 22%,var(--bg-card))}
.d20.success .d20-num{color:var(--accent-bright)}
.d20.success{filter:drop-shadow(0 0 6px color-mix(in srgb,var(--accent) 70%,transparent))}
.d20.crit .d20-face{background:linear-gradient(160deg,#ffe0a0,var(--accent))}
.d20.crit .d20-face::before{background:var(--accent)}
.d20.crit .d20-num{color:var(--bg-dark)}
.d20.crit{filter:drop-shadow(0 0 10px var(--accent-bright))}
.d20.comp .d20-face{background:linear-gradient(160deg,var(--danger),var(--danger-dim))}
.d20.comp .d20-face::before{background:color-mix(in srgb,var(--danger) 18%,var(--bg-card))}
.d20.comp .d20-num{color:#ff8a7a}
.d20.comp.settled{animation:d20-settle .42s cubic-bezier(.2,1.4,.4,1) both,d20-flash .5s .42s ease-in-out 2}
.d20-tag{position:absolute;bottom:-1.1rem;left:50%;transform:translateX(-50%);font-size:.56rem;letter-spacing:.05em;color:var(--text-dim);white-space:nowrap}
.d20.success .d20-tag,.d20.crit .d20-tag{color:var(--accent)}
.d20.comp .d20-tag{color:var(--danger)}
.d20-pills{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin:1rem 0 .5rem}
.d20-pill{display:inline-flex;align-items:center;gap:.45rem;font-size:.78rem;letter-spacing:.14em;padding:.32rem .75rem;border-radius:999px;border:1px solid var(--border-bright);color:var(--text)}
.d20-pill.pass{border-color:var(--success);color:var(--success)}
.d20-pill.fail{border-color:var(--danger);color:var(--danger)}
.d20-pill.momentum{border-color:var(--accent);color:var(--accent-bright);background:var(--accent-glow);animation:d20-pop .4s .45s both}
.d20-pill.comp{border-color:var(--danger);color:#ff8a7a;background:var(--danger-glow)}
.d20-grains{display:inline-flex;gap:3px}
.d20-grains i{width:6px;height:6px;border-radius:50%;background:var(--accent-bright);box-shadow:0 0 4px var(--accent)}
@keyframes d20-tumble{0%{transform:rotate(-10deg) translateY(-2px)}50%{transform:rotate(10deg) translateY(2px)}100%{transform:rotate(-10deg) translateY(-2px)}}
@keyframes d20-settle{0%{transform:rotate(-40deg) scale(.6);opacity:.3}70%{transform:rotate(6deg) scale(1.08);opacity:1}100%{transform:none}}
@keyframes d20-flash{0%,100%{filter:none}50%{filter:drop-shadow(0 0 12px var(--danger)) brightness(1.5)}}
@keyframes d20-pop{0%{transform:scale(.6);opacity:0}100%{transform:none;opacity:1}}
@media (prefers-reduced-motion: reduce){.d20.rolling,.d20.settled,.d20.comp.settled,.d20-pill.momentum{animation:none}}
`;

const KIND_LABEL = { crit: '2 SUCCESSES', success: 'SUCCESS', comp: 'COMPLICATION', fail: '' };
const reducedMotion = () => reducedFx();

function outcome(r) {
  if (r.complications > 0 && !r.passed) return { kind: 'botch', text: 'COMPLICATION' };
  if (!r.passed) return { kind: 'fail', text: 'FAILED' };
  if (r.dieKinds.includes('crit') || r.momentum >= 2) return { kind: 'crit', text: r.momentum ? `+${r.momentum} MOMENTUM` : 'CRITICAL' };
  return { kind: 'success', text: 'PASSED' };
}

function Die({ value, kind, rolling }) {
  const cls = rolling ? 'd20 rolling' : `d20 settled ${kind}`;
  const label = KIND_LABEL[kind];
  return (
    <span className={cls} title={rolling ? 'rolling' : label || 'no success'}
      aria-label={rolling ? 'rolling' : `${value}${label ? `, ${label.toLowerCase()}` : ', no success'}`}>
      <span className="d20-face" />
      <span className="d20-num">{value}</span>
      {!rolling && label && <span className="d20-tag">{label}</span>}
    </span>
  );
}

function report(r, meta) {
  const flags = [];
  if (r.dieKinds.includes('crit')) flags.push('crit');
  if (r.complications > 0) flags.push('complication');
  if (r.complications > 0 && !r.passed) flags.push('botch');
  const label = meta.label || `${meta.driveLabel} + ${meta.skillLabel}`.toUpperCase();
  return {
    kind: '2d20',
    label,
    skillKey: meta.skillKey, attrKey: meta.driveKey,
    ...(meta.requestId ? { requestId: meta.requestId } : {}),
    summary: `${label} — ${r.passed ? 'PASSED' : 'FAILED'} ${r.successes}/D${r.difficulty}${r.momentum ? ` +${r.momentum} MOMENTUM` : ''}${r.complications ? ` · ${r.complications} COMPLICATION${r.complications > 1 ? 'S' : ''}` : ''}`,
    successes: r.successes, complications: r.complications, passed: r.passed, momentum: r.momentum,
    difficulty: r.difficulty, target: r.target, flags, dice: { d20: r.rolls },
  };
}

export default function D20DiceRoller({ preset, onResult, compact = false }) {
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const metaRef = useRef({});
  const requestRef = useRef(null); // preset.requestId: the GM roll request this roll answers
  const [driveKey, setDriveKey] = useState(attributes[0].key);
  const [skillKey, setSkillKey] = useState(skills[0].key);
  const [drive, setDrive] = useState(6);
  const [skill, setSkill] = useState(5);
  const [difficulty, setDifficulty] = useState(1);
  const [bonus, setBonus] = useState(0);
  const [focus, setFocus] = useState(false);
  const [compRange, setCompRange] = useState(dice.complicationRange || 1);
  const [result, setResult] = useState(null);
  const [rollId, setRollId] = useState(0);
  const [tumble, setTumble] = useState(null); // random faces shown while the dice tumble
  const [label, setLabel] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearInterval(timer.current), []);

  /* Apply a preset whenever its contents change. */
  const presetKey = preset ? JSON.stringify(preset) : '';
  useEffect(() => {
    if (!preset) return;
    if (preset.attrKey && attributes.some((a) => a.key === preset.attrKey)) setDriveKey(preset.attrKey);
    if (preset.skillKey && skills.some((s) => s.key === preset.skillKey)) setSkillKey(preset.skillKey);
    if (preset.attr != null) setDrive(clamp(Number(preset.attr) || 1, 1, 12));
    if (preset.skill != null) setSkill(clamp(Number(preset.skill) || 1, 1, 12));
    setBonus(clamp(Number(preset.bonus) || 0, 0, MAX_BONUS));
    if (preset.difficulty != null) setDifficulty(clamp(Number(preset.difficulty) || 0, 0, MAX_DIFF));
    requestRef.current = preset.requestId || null;
    setLabel(preset.label || null);
    setResult(null);
  }, [presetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const target = drive + skill;
  const critMax = focus ? skill : (dice.criticalRange || 1);
  const compMin = 21 - compRange;

  const doRoll = useCallback(() => {
    const rolls = Array.from({ length: BASE + bonus }, rollD20);
    let successes = 0;
    let complications = 0;
    const dieKinds = rolls.map((r) => {
      let kind = 'fail';
      if (r <= critMax && r <= target) { successes += 2; kind = 'crit'; }
      else if (r <= target) { successes += 1; kind = 'success'; }
      if (r >= compMin) { complications += 1; kind = 'comp'; }
      return kind;
    });
    const passed = successes >= difficulty;
    const momentum = passed ? successes - difficulty : 0;
    const final = { rolls, dieKinds, successes, complications, passed, momentum, target, difficulty, bonus };
    const meta = { ...metaRef.current, requestId: requestRef.current };
    clearInterval(timer.current);
    setRollId((n) => n + 1);
    setResult(final);
    const celebrate = () => {
      play('dice.settle');
      const o = outcome(final);
      if (o.kind === 'botch' || final.complications > 0) setTimeout(() => play('dice.botch'), 140);
      else if (o.kind === 'crit') setTimeout(() => play('dice.crit'), 140);
      try { onResultRef.current?.(report(final, meta)); } catch (e) { console.error('[roller] onResult failed', e); }
    };
    if (reducedMotion()) { setTumble(null); celebrate(); return; }
    // short tumble (~450 ms) before the dice settle on their real faces
    let ticks = 0;
    setTumble(rolls.map(rollD20));
    timer.current = setInterval(() => {
      ticks += 1;
      if (ticks >= 6) { clearInterval(timer.current); setTumble(null); celebrate(); return; }
      setTumble(rolls.map(rollD20));
    }, 75);
  }, [bonus, critMax, target, compMin, difficulty]);

  const driveLabel = attributes.find((a) => a.key === driveKey)?.label || driveKey;
  const skillLabel = skills.find((s) => s.key === skillKey)?.label || skillKey;
  metaRef.current = { label, driveKey, skillKey, driveLabel, skillLabel };

  return (
    <div className="panel">
      <style>{CSS}</style>
      <h2>2D20 TEST</h2>
      {label && (
        <div className="roll-preset">
          <b>{label}</b>
          <span>TARGET {target} · {BASE + bonus}D20</span>
          <button type="button" onClick={() => { setLabel(null); requestRef.current = null; }}>CLEAR</button>
        </div>
      )}
      {!compact && (
        <p style={{ color: 'var(--text-dim)', marginBottom: '1rem', fontSize: '0.95rem', lineHeight: 1.5 }}>
          Target = Drive + Skill. Each d20 at or under the target is a success; within the critical range it counts twice.
          Meet the Difficulty to pass; every extra success becomes Momentum. Results in the complication range are complications.
        </p>
      )}

      <div className="dice-controls">
        <label>
          Drive:
          <select value={driveKey} onChange={(e) => setDriveKey(e.target.value)} style={selectStyle}>
            {attributes.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
          <input type="number" min="1" max="12" value={drive} onChange={(e) => setDrive(clamp(parseInt(e.target.value) || 0, 1, 12))} />
        </label>
        <label>
          Skill:
          <select value={skillKey} onChange={(e) => setSkillKey(e.target.value)} style={selectStyle}>
            {skills.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <input type="number" min="1" max="12" value={skill} onChange={(e) => setSkill(clamp(parseInt(e.target.value) || 0, 1, 12))} />
        </label>
        <span style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>TARGET {target}</span>
      </div>

      <div className="dice-controls">
        <label>
          Difficulty:
          <select value={difficulty} onChange={(e) => setDifficulty(parseInt(e.target.value))} style={selectStyle}>
            {DIFF_NAMES.slice(0, MAX_DIFF + 1).map((n, i) => <option key={i} value={i}>{n}</option>)}
          </select>
        </label>
        <label>
          Bonus d20 (Momentum/Threat):
          <input type="number" min="0" max={MAX_BONUS} value={bonus} onChange={(e) => setBonus(clamp(parseInt(e.target.value) || 0, 0, MAX_BONUS))} />
        </label>
        <label>
          Complication range:
          <select value={compRange} onChange={(e) => setCompRange(parseInt(e.target.value))} style={selectStyle}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n === 1 ? '20' : `${21 - n}–20`}</option>)}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={focus} onChange={(e) => setFocus(e.target.checked)} />
          Focus applies (crit on ≤ {skill})
        </label>
        <button className="btn" onClick={doRoll}>ROLL {BASE + bonus}d20</button>
      </div>

      <div className="roll-result roll-stage">
        {result ? (
          <>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
              {driveLabel.toUpperCase()} + {skillLabel.toUpperCase()} · TARGET {result.target} · DIFFICULTY {result.difficulty}
              {result.bonus ? ` · ${result.bonus} BONUS d20` : ''}
            </div>
            <div className="d20-tray" key={rollId} aria-live="polite">
              {result.rolls.map((r, i) => (
                <Die key={i} value={tumble ? tumble[i] : r} kind={result.dieKinds[i]} rolling={!!tumble} />
              ))}
            </div>
            {!tumble && (
              <>
                <div className="d20-pills">
                  <span className={`d20-pill ${result.passed ? 'pass' : 'fail'}`}>{result.passed ? '✓ PASSED' : '✗ FAILED'}</span>
                  <span className="d20-pill">{result.successes} SUCCESS{result.successes === 1 ? '' : 'ES'} / D{result.difficulty}</span>
                  {result.passed && result.momentum > 0 && (
                    <span className="d20-pill momentum" title="Momentum generated">
                      <span className="d20-grains" aria-hidden="true">{Array.from({ length: Math.min(result.momentum, 6) }, (_, i) => <i key={i} />)}</span>
                      +{result.momentum} MOMENTUM
                    </span>
                  )}
                  {result.complications > 0 && (
                    <span className="d20-pill comp">⚠ {result.complications} COMPLICATION{result.complications > 1 ? 'S' : ''}</span>
                  )}
                </div>
                {(() => { const o = outcome(result); return <div key={`c${rollId}`} className={`roll-celebrate ${o.kind}`} aria-hidden="true"><span>{o.text}</span></div>; })()}
                <div className="roll-summary" style={{ fontSize: '0.92rem', lineHeight: 1.5, color: 'var(--text-dim)' }}>
                  {result.complications > 0 && <div>The Narrator may take 2 Threat per complication instead of applying it.</div>}
                  {result.passed && result.momentum > 0 && <div>Momentum joins the shared pool (max 6): Obtain Information (1), Create a Trait (2), extra Stress (1), Keep the Initiative (2).</div>}
                  {!result.passed && (
                    <div>
                      Players may spend Momentum or let the Narrator gain Threat to buy dice before rolling; a failed test can still succeed at a cost if the Narrator offers one.
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <div style={{ color: 'var(--text-dim)' }}>— Choose a drive and skill, then roll —</div>
        )}
      </div>
    </div>
  );
}
