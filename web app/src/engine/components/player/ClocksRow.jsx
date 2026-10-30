import React from 'react';
import ClockRing from '../run/ClockRing';

/* Compact row of visible clocks for the phone top bar. */
export default function ClocksRow({ clocks = [], pulseId }) {
  if (!clocks.length) return null;
  return (
    <div className="ph-clocks" aria-label="Clocks">
      {clocks.map((c) => (
        <div key={c.id} className={`ph-clock${pulseId === c.id ? ' pulse' : ''}${c.filled === c.segments ? ' full' : ''}`} title={`${c.label} ${c.filled}/${c.segments}`}>
          <ClockRing segments={c.segments} filled={c.filled} kind={c.kind} size={26} title={c.label} />
          <span>{c.label}</span>
        </div>
      ))}
    </div>
  );
}
