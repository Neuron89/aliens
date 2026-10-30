import React, { useEffect, useState } from 'react';

/* SESSION ZERO (DM, before INITIALIZE; also editable mid-session).
   value = { enabled, tone[], warnings[], linesVeils }. Pack tone/contentWarnings
   pre-fill the checklist; the GM can untick or add custom entries. Players see a
   one-time BEFORE WE BEGIN card with these and confirm. */
export default function SessionZeroPanel({ pack, value, onChange, terms }) {
  const packWarnings = pack?.meta?.contentWarnings || [];
  const tone = pack?.meta?.tone || [];
  const [custom, setCustom] = useState('');

  // New pack picked: re-seed the checklist from it.
  useEffect(() => {
    onChange((v) => ({ ...v, tone, warnings: [...new Set([...packWarnings, ...(v.extra || [])])] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack?.id]);

  const all = [...new Set([...packWarnings, ...(value.extra || [])])];
  const toggle = (w) => onChange((v) => ({ ...v, warnings: v.warnings.includes(w) ? v.warnings.filter((x) => x !== w) : [...v.warnings, w] }));
  const add = () => {
    const w = custom.trim();
    if (!w) return;
    onChange((v) => ({ ...v, extra: [...new Set([...(v.extra || []), w])], warnings: [...new Set([...v.warnings, w])] }));
    setCustom('');
  };

  return (
    <div className={`s0${value.enabled ? ' on' : ''}`}>
      <label className="s0-toggle">
        <input type="checkbox" checked={value.enabled} onChange={(e) => onChange((v) => ({ ...v, enabled: e.target.checked }))} />
        <span>SESSION ZERO — show {terms?.players?.toLowerCase() || 'players'} a “BEFORE WE BEGIN” card</span>
      </label>
      {value.enabled && (
        <div className="s0-body">
          {tone.length > 0 && (
            <div className="s0-row"><span className="s0-label">TONE</span>{tone.map((t) => <span key={t} className="run-chip on static">{t}</span>)}</div>
          )}
          <div className="s0-label">CONTENT WARNINGS {all.length === 0 && <i>(none in this pack — add your own)</i>}</div>
          <div className="s0-checks">
            {all.map((w) => (
              <label key={w} className="s0-check">
                <input type="checkbox" checked={value.warnings.includes(w)} onChange={() => toggle(w)} /> {w}
              </label>
            ))}
          </div>
          <div className="run-row">
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add a warning…" maxLength={120}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} style={{ flex: 1 }} />
            <button type="button" className="run-btn sm" onClick={add}>ADD</button>
          </div>
          <label className="s0-label" htmlFor="s0-lv">LINES &amp; VEILS</label>
          <textarea id="s0-lv" rows={3} value={value.linesVeils} maxLength={3000}
            onChange={(e) => onChange({ ...value, linesVeils: e.target.value })}
            placeholder={'LINES (never in the game): …\nVEILS (happens off-screen): …'} />
          <p className="s0-note">Every phone also gets an anonymous PAUSE button. You see “PAUSE REQUESTED”, never who.</p>
        </div>
      )}
    </div>
  );
}

export const emptySessionZero = () => ({ enabled: false, tone: [], warnings: [], extra: [], linesVeils: '' });
