import React, { useState, useCallback } from 'react';

function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

export default function DiceRoller() {
  const [baseDice, setBaseDice] = useState(6);
  const [stressDice, setStressDice] = useState(0);
  const [simulatePush, setSimulatePush] = useState(false);
  const [result, setResult] = useState(null);

  const doRoll = useCallback(() => {
    let base = Math.max(0, baseDice);
    let stress = Math.max(0, stressDice);

    let baseRolls = Array.from({ length: base }, rollD6);
    let stressRolls = Array.from({ length: stress }, rollD6);

    let successes = baseRolls.filter(r => r === 6).length + stressRolls.filter(r => r === 6).length;
    let panic = stressRolls.some(r => r === 1);

    if (simulatePush && !panic) {
      stress += 1;
      baseRolls = baseRolls.map(r => r === 6 ? 6 : rollD6());
      stressRolls = stressRolls.map(r => r === 6 ? 6 : r === 1 ? 1 : rollD6());
      successes = baseRolls.filter(r => r === 6).length + stressRolls.filter(r => r === 6).length;
      panic = stressRolls.some(r => r === 1);
    }

    setResult({ baseRolls, stressRolls, successes, panic });
  }, [baseDice, stressDice, simulatePush]);

  return (
    <div className="panel">
      <h2>DICE ROLLER</h2>
      <p style={{ color: 'var(--text-dim)', marginBottom: '1rem', fontSize: '0.85rem' }}>
        Roll Base Dice + Stress Dice. Success = 6 on any die. A 1 on a Stress Die triggers a Panic Roll.
      </p>
      <div className="dice-controls">
        <label>
          Base Dice:
          <input type="number" min="0" max="20" value={baseDice} onChange={e => setBaseDice(parseInt(e.target.value) || 0)} />
        </label>
        <label>
          Stress Dice:
          <input type="number" min="0" max="10" value={stressDice} onChange={e => setStressDice(parseInt(e.target.value) || 0)} />
        </label>
        <button className="btn" onClick={doRoll}>ROLL</button>
        <label style={{ marginLeft: '0.5rem' }}>
          <input type="checkbox" checked={simulatePush} onChange={e => setSimulatePush(e.target.checked)} />
          Simulate push
        </label>
      </div>
      <div className="roll-result">
        {result ? (
          <>
            <div className="dice-display">
              {result.baseRolls.map((r, i) => (
                <span key={`b${i}`} className={`die base${r === 6 ? ' success' : ''}`}>{r}</span>
              ))}
              {result.stressRolls.map((r, i) => (
                <span key={`s${i}`} className={`die stress${r === 6 ? ' success' : ''}${r === 1 ? ' panic' : ''}`}>{r}</span>
              ))}
            </div>
            <div className="roll-summary">
              {result.successes > 0 && <span className="success-text">✓ </span>}
              {result.panic && <span className="panic-text">⚠ </span>}
              Success: {result.successes} six(es).{' '}
              {result.panic
                ? 'Panic Roll required (1 on Stress Die); skill roll fails.'
                : result.successes === 0
                ? 'No success.'
                : 'First 6 = success; extra 6s = stunts.'}
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--text-dim)' }}>— Roll the dice to see results —</div>
        )}
      </div>
    </div>
  );
}
