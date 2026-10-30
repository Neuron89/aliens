import React, { useState } from 'react';

/* Small building blocks shared by CharacterSheet and CharacterBuilder. */

const GLYPH = { weapon: '⌖', armor: '⛨', gear: '▣' };

/** Item thumbnail; falls back to a glyph when there is no art or the file fails to load. */
export function ItemArt({ item, size = 44 }) {
  const [failed, setFailed] = useState(false);
  const src = item?.art;
  const style = { width: size, height: size };
  if (!src || failed) {
    return <div className="cs-art cs-art-glyph" style={style} aria-hidden="true">{GLYPH[item?.type] || '◇'}</div>;
  }
  return <img className="cs-art" style={style} src={src} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

/** Bar for carried weight vs capacity. Renders a plain total when there is no capacity rule. */
export function WeightBar({ used, max, label = 'LOAD' }) {
  if (max === null || max === undefined) {
    return <div className="cs-weight"><span className="cs-weight-label">{label}</span><span className="cs-weight-num">{used}</span></div>;
  }
  const pct = max > 0 ? Math.min(100, (used / max) * 100) : 100;
  const over = used > max;
  return (
    <div className={`cs-weight${over ? ' over' : ''}`} role="meter" aria-valuenow={used} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <span className="cs-weight-label">{label}</span>
      <div className="cs-weight-track"><div className="cs-weight-fill" style={{ width: `${pct}%` }} /></div>
      <span className="cs-weight-num">{used} / {max}{over ? ' ▲ OVER' : ''}</span>
    </div>
  );
}

const fmtVal = (v) => (v === null || v === undefined ? '' : v > 0 ? `+${v}` : String(v));

/** One effect chip (buff = accent, debuff = danger). Shape marker ▲/▼ pairs color with shape. */
export function EffectChip({ effect, onClick, active }) {
  const kind = effect.kind === 'debuff' ? 'debuff' : 'buff';
  const target = effect.target && effect.target !== 'other' ? effect.target.replace(/^(skill|attr):/, '').toUpperCase() : '';
  return (
    <button type="button" className={`chip ${kind}${active ? ' active' : ''}`} onClick={onClick} title={effect.text}>
      <span aria-hidden="true">{kind === 'buff' ? '▲' : '▼'}</span>
      {target && <b>{target}</b>}
      {effect.value !== null && effect.value !== undefined && <b>{fmtVal(effect.value)}</b>}
      <span className="chip-text">{effect.text || effect.source}</span>
    </button>
  );
}

/** Effect groups ({ source, kind, sourceText, effects[] }) as expandable rows with chips. */
export function EffectGroups({ groups, empty }) {
  const [open, setOpen] = useState(null);
  if (!groups.length) return <p className="cs-empty">{empty}</p>;
  return (
    <div className="cs-effects">
      {groups.map((g) => {
        const k = `${g.sourceType}:${g.source}`;
        const isOpen = open === k;
        return (
          <div key={k} className={`cs-effect ${g.kind}`}>
            <button type="button" className="cs-effect-head" onClick={() => setOpen(isOpen ? null : k)} aria-expanded={isOpen}>
              <span className="cs-effect-name">{g.source}</span>
              <span className="cs-effect-type">{g.sourceType.toUpperCase()}</span>
              <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
            </button>
            <div className="chip-row">
              {g.effects.filter((e) => e.text).map((e, i) => <EffectChip key={i} effect={e} onClick={() => setOpen(isOpen ? null : k)} />)}
            </div>
            {isOpen && g.sourceText && <p className="cs-effect-text">{g.sourceText}</p>}
          </div>
        );
      })}
    </div>
  );
}

/** Compact stats line for a normalized catalog item. */
export function itemStats(item) {
  if (!item) return [];
  const st = item.stats || {};
  const out = [];
  if (item.type === 'weapon') {
    if (item.bonus !== null && item.bonus !== undefined) out.push(['BONUS', fmtVal(item.bonus) || '0']);
    if (st.damage !== undefined && st.damage !== null) out.push(['DMG', st.damage]);
    if (st.blastPower) out.push(['BLAST', st.blastPower]);
    if (st.fireIntensity) out.push(['FIRE', st.fireIntensity]);
    if (st.range) out.push(['RNG', String(st.range).toUpperCase()]);
  }
  if (item.type === 'armor' && item.armor !== null) out.push(['ARMOR', item.armor]);
  if (st.quality !== undefined) out.push(['QUAL', st.quality]);
  if (item.type === 'gear' && item.category) out.push(['TYPE', String(item.category).toUpperCase()]);
  out.push(['WT', item.weight === null ? '—' : item.weight]);
  if (item.cost !== null && item.cost !== undefined) out.push(['COST', item.cost.toLocaleString()]);
  return out;
}

export function StatsRow({ item }) {
  return (
    <div className="cs-stats">
      {itemStats(item).map(([k, v]) => <span key={k}><i>{k}</i>{v}</span>)}
    </div>
  );
}
