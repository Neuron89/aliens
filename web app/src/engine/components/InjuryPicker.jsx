import React, { useMemo, useState } from 'react';
import { getCatalog } from '../catalogUtils';
import { tableLookup, rollD66, rollDie } from '../mechanicsUtils';

/* ═══════════════════════════════════════════════════════════════
   GM player editor: APPLY CRITICAL INJURY (catalog/injuries.json).
   Pick a table (ALIEN: human / synthetic / xenomorph; DUNE: its
   consequence table), ROLL (d66 when the table's ranges reach 66,
   otherwise d<highest>) or pick an entry, then APPLY → injury-add.
   Applied injuries list with HEAL (injury-remove). The phone sheet
   shows them as debuffs (CharacterSheet `injuries`).
   Props: universe, injuries (player.injuries), onApply(injury), onHeal(uid)
   ═══════════════════════════════════════════════════════════════ */
function dieFor(entries) {
  let max = 0;
  for (const e of entries) for (const n of String(e.roll || '').match(/\d+/g) || []) max = Math.max(max, Number(n));
  return max;
}

export default function InjuryPicker({ universe, injuries = [], onApply, onHeal }) {
  const all = getCatalog(universe).injuries || [];
  const tables = useMemo(() => [...new Set(all.map((i) => i.table || 'default'))], [all]);
  const [tableId, setTableId] = useState(tables[0] || 'default');
  const [pickId, setPickId] = useState('');
  const [rolled, setRolled] = useState(null);
  const entries = all.filter((i) => (i.table || 'default') === tableId);
  const max = dieFor(entries);
  const die = max === 66 ? 'D66' : `D${max || 6}`;
  const current = rolled?.entry || entries.find((e) => e.id === pickId) || null;

  const roll = () => {
    const n = max === 66 ? rollD66() : rollDie(max || 6);
    const entry = tableLookup(entries, n);
    setRolled({ n, entry });
    setPickId(entry?.id || '');
  };
  const apply = () => {
    if (!current) return;
    const effects = (current.effects || []).map((e) => e.text).filter(Boolean).join(' ');
    onApply({
      id: current.id, name: current.name, roll: String(rolled?.n ?? current.roll ?? ''),
      text: [current.text, effects].filter(Boolean).join(' — '), fatal: !!current.fatal,
      healTime: current.healTime || null,
    });
    setRolled(null);
    setPickId('');
  };

  if (!all.length) return null;
  return (
    <div className="inj">
      <div className="inj-row">
        {tables.length > 1 && (
          <select value={tableId} onChange={(e) => { setTableId(e.target.value); setRolled(null); setPickId(''); }} aria-label="Injury table">
            {tables.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
          </select>
        )}
        <button type="button" className="run-btn sm" onClick={roll}>ROLL {die}</button>
        <select value={pickId} onChange={(e) => { setPickId(e.target.value); setRolled(null); }} aria-label="Pick an injury">
          <option value="">…or pick</option>
          {entries.map((e) => <option key={e.id} value={e.id}>{e.roll} {e.name}{e.fatal ? ' (FATAL)' : ''}</option>)}
        </select>
      </div>
      {current && (
        <div className={`inj-preview${current.fatal ? ' fatal' : ''}`} role="status">
          <b>{rolled ? `${die} ${rolled.n} → ` : ''}{current.name}{current.fatal ? ' — FATAL' : ''}</b>
          <p>{current.text}{current.healTime ? ` Heals: ${current.healTime}.` : ''}</p>
          <button type="button" className="run-btn sm danger" onClick={apply}>APPLY CRITICAL INJURY</button>
        </div>
      )}
      {injuries.length > 0 && (
        <ul className="inj-list">
          {injuries.map((i) => (
            <li key={i.uid || i.id} className={i.fatal ? 'fatal' : ''}>
              <span><b>{i.roll ? `#${i.roll} ` : ''}{i.name}</b>{i.healTime ? <small> · {i.healTime}</small> : null}</span>
              <button type="button" className="run-btn sm" onClick={() => onHeal(i.uid || i.id)}>HEAL</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
