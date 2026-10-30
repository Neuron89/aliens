import React from 'react';

/* Recipient chips: none selected = everyone. value: [] | [playerIds]. */
export default function TargetPicker({ players, value = [], onChange, allLabel = 'ALL' }) {
  const list = Object.values(players || {});
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="run-targets" role="group" aria-label="Recipients">
      <button type="button" className={`run-chip${value.length === 0 ? ' on' : ''}`} onClick={() => onChange([])}>{allLabel}</button>
      {list.map((p) => (
        <button key={p.id} type="button" className={`run-chip${value.includes(p.id) ? ' on' : ''}${p.connected === false ? ' off' : ''}`}
          onClick={() => toggle(p.id)} title={p.character?.name ? `${p.name} — ${p.character.name}` : p.name}>
          {p.character?.name || p.name}
        </button>
      ))}
    </div>
  );
}

/** Target value → socket `to`. */
export const toTarget = (value) => (value && value.length ? value : 'all');
