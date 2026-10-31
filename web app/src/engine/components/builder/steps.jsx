import React, { useState } from 'react';
import { attributeLabel, derivedDisplay } from '../../rulesUtils';
import { skillPool, startingGearFor, talentsFor, generalTalents, evalFormula } from '../../catalogUtils';
import { attrCap, skillCap, skillFloor, sum, talentString, talentName, unassignedValues, suggestedArray } from './builderState';
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
export function AttributesStep(props) {
  if (props.caps.attrArray && props.assignValue) return <ArrayAttributesStep {...props} />;
  return <PointBuyAttributesStep {...props} />;
}

/* Fixed array (rules.creation.attrArray, e.g. DUNE 8/7/6/5/4): each value goes to exactly one
   drive. Tap a value chip, then a drive (or drag the chip onto it); tap a placed value to pick it
   up and move it (the two drives swap); × returns it to the tray. SUGGESTED fills the archetype's
   spread (key attribute highest, then the drives its key skills lean on). */
function ArrayAttributesStep({ universe, T, career, caps, char, assignValue, applySuggested, setStatement }) {
  const rules = universe.rules;
  const attrs = rules.attributes || [];
  const keys = attrs.map((a) => a.key);
  const left = unassignedValues(caps.attrArray, char.attributes, keys);
  const [held, setHeld] = useState(null); // { value, from: key|null }
  const [over, setOver] = useState(null);
  const noun = T.attributes.toLowerCase().replace(/s$/, '');
  // Statement rule (catalog/rules.json "drive-statements": value = lowest rating that needs a statement).
  const stmtRule = attrs.some((a) => a.prompt) && Array.isArray(universe.catalog?.rules) ? universe.catalog.rules.find((r) => r.id === 'drive-statements') : null;
  const stmtMin = Number.isFinite(Number(stmtRule?.value)) ? Number(stmtRule.value) : null;
  const suggestion = career ? suggestedArray(universe, career, caps.attrArray) : null;
  const sugText = suggestion ? attrs.slice().sort((a, b) => (suggestion[b.key] || 0) - (suggestion[a.key] || 0))
    .map((a) => `${a.short || a.label.toUpperCase()} ${suggestion[a.key]}`).join(' · ') : '';

  const drop = (key, value) => { assignValue(key, value); setHeld(null); setOver(null); };
  const tapSlot = (key) => {
    const cur = Number(char.attributes[key]) || 0;
    if (held) { if (held.from !== key) drop(key, held.value); else setHeld(null); return; }
    if (cur) setHeld({ value: cur, from: key });
  };
  const dragProps = (value, from) => ({
    draggable: true,
    onDragStart: (e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ value, from })); e.dataTransfer.effectAllowed = 'move'; setHeld({ value, from }); },
    onDragEnd: () => setOver(null),
  });
  const dropProps = (key) => ({
    onDragOver: (e) => { e.preventDefault(); setOver(key); },
    onDragLeave: () => setOver((o) => (o === key ? null : o)),
    onDrop: (e) => {
      e.preventDefault();
      let d = null;
      try { d = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { /* ignore */ }
      if (d?.value && d.from !== key) drop(key, d.value); else { setHeld(null); setOver(null); }
    },
  });

  return (
    <div className="panel">
      <div className={`cb-budget${left.length === 0 ? ' done' : ''}`}>
        <span>VALUES LEFT</span><b>{left.length}</b><span>/ {caps.attrArray.length}</span>
      </div>
      <p className="cb-hint">
        Assign {caps.attrArray.join(' / ')} — exactly one value per {noun}. Tap a value, then a {noun} (or drag it there).
        Tap a placed value to move it; the two {noun}s swap.
      </p>
      {stmtMin !== null && (
        <p className="cb-hint">
          Under each {noun}, write one line in your own voice that answers its question. Every {noun} at {stmtMin} or more needs one;
          a test may only use a {noun} whose statement fits the action.
        </p>
      )}
      <div className="cb-array-tray" role="group" aria-label="Values to assign">
        {left.length === 0 && <span className="cb-array-done">ALL VALUES PLACED</span>}
        {left.map((v, i) => {
          const isHeld = !!held && !held.from && held.value === v && left.indexOf(v) === i;
          return (
            <button type="button" key={`${v}-${i}`} className={`cb-array-chip${isHeld ? ' held' : ''}`} aria-pressed={isHeld}
              aria-label={`Value ${v}`} onClick={() => setHeld(isHeld ? null : { value: v, from: null })} {...dragProps(v, null)}>{v}</button>
          );
        })}
      </div>
      {suggestion && (
        <button type="button" className="cb-array-suggest" onClick={() => { applySuggested(); setHeld(null); }}>
          <b>SUGGESTED</b><span>{career.name.toUpperCase()}: {sugText}</span>
        </button>
      )}
      <div className="cb-rows">
        {attrs.map((a) => {
          const v = Number(char.attributes[a.key]) || 0;
          const isKey = career?.keyAttribute === a.key;
          const target = !!held && held.from !== a.key;
          return (
            <div key={a.key} className={`cb-row${isKey ? ' key' : ''}`}>
              <div className="cb-row-main">
                <span className="cb-row-label">{a.label}{isKey && <span className="cs-key">KEY</span>}{suggestion && <small>suggested {suggestion[a.key]}</small>}</span>
                <span className="cb-array-slotwrap">
                  <button type="button" className={`cb-array-slot${v ? ' filled' : ''}${target ? ' target' : ''}${over === a.key ? ' over' : ''}${held?.from === a.key ? ' held' : ''}`}
                    onClick={() => tapSlot(a.key)} aria-label={`${a.label}: ${v || 'unassigned'}${target ? ` — place ${held.value}` : ''}`}
                    {...dropProps(a.key)} {...(v ? dragProps(v, a.key) : {})}>
                    {v || '—'}
                  </button>
                  <button type="button" className="cb-array-clear" aria-label={`Clear ${a.label}`} disabled={!v}
                    onClick={() => { assignValue(a.key, 0); setHeld(null); }}>×</button>
                </span>
              </div>
              {a.prompt && (
                <input className="cb-input cb-statement" value={char.driveStatements?.[a.key] || ''} onChange={(e) => setStatement(a.key, e.target.value)}
                  placeholder={stmtMin !== null && v >= stmtMin ? `${a.prompt} (needed at ${stmtMin}+)` : a.prompt} aria-label={`${a.label} statement`} maxLength={160} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PointBuyAttributesStep({ universe, T, career, caps, char, setAttr, setStatement }) {
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
