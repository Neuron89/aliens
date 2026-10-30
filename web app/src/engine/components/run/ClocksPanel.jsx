import React, { useState } from 'react';
import { useGame } from '../../GameContext';
import ClockRing from './ClockRing';

/* GM clocks: tick ±, visibility, remove; add ad-hoc clocks (4/6/8/custom). */
export default function ClocksPanel({ compact = false }) {
  const { table, clockTick, clockUpsert, clockRemove } = useGame();
  const clocks = table?.clocks || [];
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: '', segments: 4, kind: 'danger', visibility: 'all' });

  const add = (e) => {
    e.preventDefault();
    if (!form.label.trim()) return;
    clockUpsert({ ...form, label: form.label.trim().toUpperCase(), filled: 0 });
    setForm({ label: '', segments: 4, kind: 'danger', visibility: 'all' });
    setAdding(false);
  };

  return (
    <section className="run-box run-clocks">
      <header className="run-box-head">
        <h3>CLOCKS</h3>
        <button type="button" className="run-btn sm" onClick={() => setAdding((a) => !a)}>{adding ? 'CANCEL' : '+ CLOCK'}</button>
      </header>
      {adding && (
        <form className="run-form" onSubmit={add}>
          <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Label, e.g. REACTOR MELTDOWN" maxLength={80} autoFocus />
          <div className="run-row">
            {[4, 6, 8].map((n) => (
              <button key={n} type="button" className={`run-chip${form.segments === n ? ' on' : ''}`} onClick={() => setForm({ ...form, segments: n })}>{n}</button>
            ))}
            <input type="number" min={2} max={12} value={form.segments} aria-label="Custom segments"
              onChange={(e) => setForm({ ...form, segments: Math.max(2, Math.min(12, Number(e.target.value) || 4)) })} style={{ width: '4rem' }} />
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} aria-label="Kind">
              <option value="danger">DANGER</option><option value="racing">RACING</option><option value="tug">TUG-OF-WAR</option>
            </select>
            <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })} aria-label="Visibility">
              <option value="all">TABLE SEES</option><option value="gm">GM ONLY</option>
            </select>
            <button type="submit" className="run-btn primary sm">ADD</button>
          </div>
        </form>
      )}
      {clocks.length === 0 && !adding && <p className="run-empty">No clocks. Add one for a looming danger or a race against time.</p>}
      <div className={`run-clock-list${compact ? ' compact' : ''}`}>
        {clocks.map((c) => (
          <div key={c.id} className={`run-clock${c.filled === c.segments ? ' full' : ''}`}>
            <ClockRing segments={c.segments} filled={c.filled} kind={c.kind} size={compact ? 40 : 52} title={c.label} />
            <div className="run-clock-body">
              <div className="run-clock-label">{c.label}</div>
              <div className="run-clock-meta">
                {c.filled}/{c.segments} · {c.kind.toUpperCase()}
                {c.filled === c.segments && <b className="run-warn"> · FULL</b>}
              </div>
              {c.note && <div className="run-clock-note">{c.note}</div>}
            </div>
            <div className="run-clock-ctl">
              <button type="button" className="run-btn sm" aria-label={`Untick ${c.label}`} onClick={() => clockTick(c.id, -1)} disabled={c.filled <= 0}>−</button>
              <button type="button" className="run-btn sm primary" aria-label={`Tick ${c.label}`} onClick={() => clockTick(c.id, 1)} disabled={c.filled >= c.segments}>+</button>
              <button type="button" className={`run-btn sm${c.visibility === 'gm' ? ' dim' : ''}`} title={c.visibility === 'gm' ? 'GM only — tap to show the table' : 'Shown on TV and phones — tap to hide'}
                onClick={() => clockUpsert({ ...c, visibility: c.visibility === 'gm' ? 'all' : 'gm' })}>{c.visibility === 'gm' ? 'HIDDEN' : 'SHOWN'}</button>
              {!compact && <button type="button" className="run-btn sm danger" aria-label={`Remove ${c.label}`} onClick={() => { if (confirm(`Remove clock "${c.label}"?`)) clockRemove(c.id); }}>✕</button>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
