import React from 'react';
import { attributeLabel, derivedDisplay } from '../../rulesUtils';
import { skillPool, startingGearFor, talentsFor, generalTalents, evalFormula } from '../../catalogUtils';
import { attrCap, skillCap, skillFloor, sum, talentString, talentName } from './builderState';
import { EffectChip } from '../sheet/parts';

/* ── Step 1: career / archetype ───────────────────────────────── */
export function CareerStep({ universe, catalog, T, careerId, onSelect, customCareer, onCustomCareer }) {
  const careers = catalog.careers;
  if (!careers.length) {
    return (
      <div className="panel">
        <label className="cb-label">{T.career.toUpperCase()}</label>
        <input className="cb-input" value={customCareer} onChange={(e) => onCustomCareer(e.target.value)} placeholder={`${T.career}…`} />
      </div>
    );
  }
  const core = careers.filter((c) => c.source !== 'ACM');
  const acm = careers.filter((c) => c.source === 'ACM');
  const sections = [{ title: null, list: core }];
  if (acm.length) sections.push({ title: 'Colonial Marines', note: 'Colonial Marines Operations Manual specialties (MOS)', list: acm });
  return (
    <>
      {sections.map((sec) => (
        <div key={sec.title || 'core'} className="cb-section">
          {sec.title && <h3 className="cb-section-title">{sec.title.toUpperCase()}<span>{sec.note}</span></h3>}
          <div className="cb-cards">
            {sec.list.map((c) => (
              <CareerCard key={c.id} universe={universe} catalog={catalog} career={c} selected={careerId === c.id} onSelect={() => onSelect(c)} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function CareerCard({ universe, catalog, career, selected, onSelect }) {
  const sg = startingGearFor(career, catalog);
  const talents = talentsFor(career, catalog);
  const skillLabel = (k) => (universe.rules.skills || []).find((s) => s.key === k)?.label || k;
  const gearPreview = [
    ...sg.fixed.slice(0, 3).map((i) => i.name),
    ...sg.choices.slice(0, 3).map((g) => g.map((i) => i.name).slice(0, 2).join(' / ') + (g.length > 2 ? ' / …' : '')),
  ];
  const more = sg.fixed.length - 3 + Math.max(0, sg.choices.length - 3);
  return (
    <button type="button" className={`cb-card${selected ? ' selected' : ''}`} onClick={onSelect} aria-pressed={selected}>
      <div className="cb-card-head">
        <span className="cb-card-name">{career.name}</span>
        {career.keyAttribute && <span className="cb-pill">{attributeLabel(universe, career.keyAttribute).toUpperCase()}</span>}
      </div>
      {career.description && <p className="cb-card-desc">{career.description}</p>}
      {career.keySkills?.length > 0 && (
        <div className="cb-card-row"><i>KEY SKILLS</i>{career.keySkills.map(skillLabel).join(', ')}</div>
      )}
      {gearPreview.length > 0 && (
        <div className="cb-card-row"><i>KIT</i>{gearPreview.join(' · ')}{more > 0 ? ` · +${more}` : ''}</div>
      )}
      <div className="cb-card-row"><i>TALENTS</i>{talents.length} available</div>
    </button>
  );
}

/* ── Shared counter ───────────────────────────────────────────── */
function Counter({ value, min, max, onChange, label }) {
  return (
    <div className="cb-counter">
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Decrease ${label}`}>−</button>
      <span className="cb-counter-val">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`Increase ${label}`}>+</button>
    </div>
  );
}

function Budget({ used, total, unit = 'POINTS' }) {
  const left = total - used;
  return (
    <div className={`cb-budget${left < 0 ? ' over' : left === 0 ? ' done' : ''}`}>
      <span>{unit} LEFT</span><b>{left}</b><span>/ {total}</span>
    </div>
  );
}

/* ── Step 2: attributes / drives ──────────────────────────────── */
export function AttributesStep({ universe, T, career, caps, char, setAttr, setStatement }) {
  const rules = universe.rules;
  const used = sum(char.attributes);
  const derived = derivedDisplay(universe, char);
  const carry = rules.encumbrance ? evalFormula(rules.encumbrance.formula, char) : null;
  return (
    <div className="panel">
      <Budget used={used} total={caps.attrPoints} />
      <p className="cb-hint">
        Each {T.attributes.toLowerCase().replace(/s$/, '')} {caps.attrMin}–{caps.attrOtherMax}
        {caps.attrKeyMax !== caps.attrOtherMax ? `; your key ${T.attributes.toLowerCase().replace(/s$/, '')} up to ${caps.attrKeyMax}` : ''}.
      </p>
      <div className="cb-rows">
        {(rules.attributes || []).map((a) => {
          const v = Number(char.attributes[a.key]) || 0;
          const max = attrCap(caps, career, a.key);
          const isKey = career?.keyAttribute === a.key;
          return (
            <div key={a.key} className={`cb-row${isKey ? ' key' : ''}`}>
              <div className="cb-row-main">
                <span className="cb-row-label">{a.label}{isKey && <span className="cs-key">KEY</span>}<small>max {max}</small></span>
                <Counter value={v} min={caps.attrMin} max={Math.min(max, v + (caps.attrPoints - used))} label={a.label} onChange={(n) => setAttr(a.key, n, max)} />
              </div>
              {a.prompt && (
                <input className="cb-input cb-statement" value={char.driveStatements?.[a.key] || ''} onChange={(e) => setStatement(a.key, e.target.value)}
                  placeholder={a.prompt} aria-label={`${a.label} statement`} maxLength={160} />
              )}
            </div>
          );
        })}
      </div>
      <div className="cb-derived">
        {derived.label && (
          <span><i>{derived.label}</i>{derived.value !== null ? derived.value : derived.detail}</span>
        )}
        {carry !== null && <span><i>CARRY</i>{carry}</span>}
      </div>
    </div>
  );
}

/* ── Step 3: skills with pool / target preview ────────────────── */
export function SkillsStep({ universe, career, caps, char, setSkill }) {
  const rules = universe.rules;
  const used = sum(char.skills);
  return (
    <div className="panel">
      <Budget used={used} total={caps.skillPoints} />
      <p className="cb-hint">
        Key skills (★) up to {caps.skillKeyMax}, others up to {caps.skillOtherMax}
        {caps.skillMin ? `; every skill starts at ${caps.skillMin}` : ''}
        {caps.requiredSkills.length ? `; required skills at least ${caps.requiredSkillMin}` : ''}.
      </p>
      <div className="cb-rows">
        {(rules.skills || []).map((s) => {
          const v = Number(char.skills[s.key]) || 0;
          const max = skillCap(caps, career, s.key);
          const min = skillFloor(caps, s.key);
          const isKey = (career?.keySkills || []).includes(s.key);
          const pool = skillPool(char, s.key, universe);
          const attrShort = pool.attrKey ? attributeLabel(universe, pool.attrKey, { short: true }) : '';
          return (
            <div key={s.key} className={`cb-row${isKey ? ' key' : ''}`}>
              <div className="cb-row-main">
                <span className="cb-row-label">
                  {s.label}{isKey && <span className="cs-key">★</span>}
                  <small>{attrShort}{caps.requiredSkills.includes(s.key) ? ' · REQ' : ''} · max {max}</small>
                </span>
                <span className="cb-pool" title={pool.kind === '2d20' ? `${attrShort} ${pool.attr} + ${v}` : `${attrShort} ${pool.attr} + ${v}`}>{pool.label}</span>
                <Counter value={v} min={min} max={Math.min(max, v + (caps.skillPoints - used))} label={s.label} onChange={(n) => setSkill(s.key, n, min, max)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Step 4: talent ───────────────────────────────────────────── */
export function TalentStep({ catalog, career, caps, talent, onPick, T }) {
  const careerTalents = talentsFor(career, catalog);
  const general = caps.allowGeneralTalents ? generalTalents(catalog).filter((t) => !careerTalents.includes(t)) : [];
  const groups = [{ title: career ? `${career.name.toUpperCase()} ${T.talent.toUpperCase()}S` : `${T.talent.toUpperCase()}S`, list: careerTalents }];
  if (general.length) groups.push({ title: `GENERAL ${T.talent.toUpperCase()}S`, list: general });
  if (!careerTalents.length && !general.length) return <div className="panel"><p className="cb-hint">No {T.talent.toLowerCase()}s in this catalog — you can skip this step.</p></div>;
  return (
    <>
      {groups.map((g) => (
        <div key={g.title} className="cb-section">
          <h3 className="cb-section-title">{g.title}</h3>
          <div className="cb-talents">
            {g.list.map((t) => {
              const sel = !!talent && talentName(talent) === t.name;
              return (
                <button type="button" key={t.id} className={`cb-talent${sel ? ' selected' : ''}`} onClick={() => onPick(talentString(t))} aria-pressed={!!sel}>
                  <div className="cb-talent-name"><span className="cb-radio" aria-hidden="true">{sel ? '◉' : '○'}</span>{t.name}{t.source && <small>{t.source}</small>}</div>
                  {t.text && <p className="cb-talent-text">{t.text}</p>}
                  {t.effects?.length > 0 && (
                    <div className="chip-row">
                      {t.effects.map((e, i) => <EffectChip key={i} effect={{ ...e, target: e.target || (e.stat ? `skill:${e.stat}` : 'other'), value: typeof e.value === 'number' ? e.value : null }} />)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

/* ── Step 6: identity ─────────────────────────────────────────── */
export function IdentityStep({ career, char, setField, cart, connectedPlayers }) {
  const appendTo = (key, hint, sep) => {
    const cur = String(char[key] || '').trim();
    setField(key, cur ? `${cur}${sep}${hint}` : hint);
  };
  const people = connectedPlayers || [];
  return (
    <div className="panel cb-identity">
      <label className="cb-label" htmlFor="cb-name">NAME</label>
      <input id="cb-name" className="cb-input" value={char.name} onChange={(e) => setField('name', e.target.value)} placeholder="Character name…" autoComplete="off" />
      {career?.typicalNames?.length > 0 && (
        <div className="chip-row">{career.typicalNames.slice(0, 8).map((n) => <button type="button" key={n} className="chip hint" onClick={() => setField('name', n)}>{n}</button>)}</div>
      )}

      <label className="cb-label" htmlFor="cb-app">APPEARANCE</label>
      <textarea id="cb-app" className="cb-input" rows={3} value={char.appearance} onChange={(e) => setField('appearance', e.target.value)} placeholder="How you look and carry yourself…" />
      {career?.appearanceHints?.length > 0 && (
        <div className="chip-row">{career.appearanceHints.map((h) => <button type="button" key={h} className="chip hint" onClick={() => appendTo('appearance', h, ', ')}>+ {h}</button>)}</div>
      )}

      <label className="cb-label" htmlFor="cb-agenda">PERSONAL AGENDA</label>
      <textarea id="cb-agenda" className="cb-input" rows={3} value={char.personalAgenda} onChange={(e) => setField('personalAgenda', e.target.value)} placeholder="What you want, in one or two sentences…" />
      {career?.agendaHints?.length > 0 && (
        <div className="chip-row">{career.agendaHints.map((h) => <button type="button" key={h} className="chip hint" onClick={() => appendTo('personalAgenda', h, ' ')}>+ {h}</button>)}</div>
      )}

      <div className="cb-two">
        <div>
          <label className="cb-label" htmlFor="cb-buddy">BUDDY</label>
          <input id="cb-buddy" className="cb-input" list="cb-people" value={char.buddy} onChange={(e) => setField('buddy', e.target.value)} placeholder="Who you trust" />
        </div>
        <div>
          <label className="cb-label" htmlFor="cb-rival">RIVAL</label>
          <input id="cb-rival" className="cb-input" list="cb-people" value={char.rival} onChange={(e) => setField('rival', e.target.value)} placeholder="Who you don’t" />
        </div>
      </div>
      {people.length > 0 && <datalist id="cb-people">{people.map((p) => <option key={p} value={p} />)}</datalist>}

      <label className="cb-label" htmlFor="cb-sig">SIGNATURE ITEM</label>
      <input id="cb-sig" className="cb-input" value={char.signatureItem} onChange={(e) => setField('signatureItem', e.target.value)} placeholder="A small personal item and its story…" />
      {(cart.length > 0 || career?.signatureItemHints?.length > 0) && (
        <div className="chip-row">
          {cart.map((c) => <button type="button" key={c.key} className={`chip hint${char.signatureItem === c.name ? ' active' : ''}`} onClick={() => setField('signatureItem', c.name)}>{c.name}</button>)}
          {(career?.signatureItemHints || []).map((h) => <button type="button" key={h} className="chip hint" onClick={() => setField('signatureItem', h)}>{h}</button>)}
        </div>
      )}
    </div>
  );
}
