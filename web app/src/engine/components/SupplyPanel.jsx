import React from 'react';

/* ═══════════════════════════════════════════════════════════════
   Supply ratings (backlog row 40; universes with rules.supplies only).
   Used by the phone SHEET (read + SUPPLY ROLL) and the GM player editor
   (± per rating + SUPPLY ROLL). A Supply roll is server-side: Stress Dice
   equal to the rating (max 6), each 1 drops the rating one step.
   Props: keys[], supply {key:n}, danger (<=n warns), max, onRoll(key)?,
          onSet(key, value)?, last { key, dice[], before, after }?, compact
   ═══════════════════════════════════════════════════════════════ */
export default function SupplyPanel({ keys = [], supply = {}, danger = 2, max = 12, onRoll, onSet, last, title = 'SUPPLY' }) {
  if (!keys.length) return null;
  const shown = keys.filter((k) => onSet || supply[k] !== undefined);
  return (
    <section className="panel sup-panel">
      <h2 className="sup-title">{title}</h2>
      {!shown.length && <p className="sup-empty">No supply ratings set.</p>}
      <div className="sup-rows">
        {shown.map((k) => {
          const v = supply[k];
          const set = v !== undefined;
          const low = set && v <= danger;
          return (
            <div key={k} className={`sup-row${low ? ' low' : ''}${set && v === 0 ? ' out' : ''}`}>
              <span className="sup-key">{k.toUpperCase()}</span>
              <span className="sup-pips" aria-label={`${k} ${set ? v : 'not set'}`}>
                {set ? Array.from({ length: Math.max(v, 1) > 6 ? v : 6 }, (_, i) => <i key={i} className={i < v ? 'on' : ''} />) : <em>—</em>}
              </span>
              <b className="sup-val">{set ? v : '—'}</b>
              {onSet && (
                <span className="sup-edit">
                  <button type="button" onClick={() => onSet(k, Math.max(0, (v || 0) - 1))} aria-label={`${k} minus one`}>−</button>
                  <button type="button" onClick={() => onSet(k, Math.min(max, (v || 0) + 1))} aria-label={`${k} plus one`}>+</button>
                  {set && <button type="button" onClick={() => onSet(k, null)} aria-label={`clear ${k}`}>×</button>}
                </span>
              )}
              {onRoll && set && (
                <button type="button" className="sup-roll" disabled={v === 0} onClick={() => onRoll(k)}>SUPPLY ROLL</button>
              )}
            </div>
          );
        })}
      </div>
      {last && (
        <p className={`sup-last${last.after < last.before ? ' drop' : ''}`} role="status">
          {last.key.toUpperCase()}: [{last.dice.join(' ') || '—'}] {last.after < last.before ? `${last.before} → ${last.after}` : 'HOLDS'}
        </p>
      )}
    </section>
  );
}
