import React, { useMemo, useState } from 'react';
import { useUniverse } from '../UniverseContext';
import { skillInfo, derivedDisplay } from '../rulesUtils';
import {
  getCatalog, careerById, effectsFor, groupEffects, skillPool, encumbrance, armorRating,
  carriedItems, termsFor,
} from '../catalogUtils';
import { ItemArt, WeightBar, EffectGroups, StatsRow } from './sheet/parts';
import Portrait from './sheet/Portrait';

/* Renders one character using the active universe's rules + catalog.
   Props:
     character, source (pack title badge), onBack, backLabel
     statusEffects, conditions, injuries — live session state (arrays of ids/names) shown as debuffs
     onRoll(skillKey, pool) — optional; when given, each skill row gets a ROLL button (part 2: roller)
     actions — optional node rendered under the header (EDIT / DUPLICATE / EXPORT …)
     portrait — show the portrait + GENERATE PORTRAIT block (sheet/Portrait.jsx; default true) */
export default function CharacterSheet({
  character, source, onBack, backLabel = '← BACK TO CHARACTERS',
  statusEffects, conditions, injuries, onRoll, actions, portrait = true,
}) {
  const { universe } = useUniverse();
  const { rules } = universe;
  const T = termsFor(universe);
  const catalog = getCatalog(universe);
  const [openSkill, setOpenSkill] = useState(null);

  const effects = useMemo(
    () => effectsFor(character, catalog, { statusEffects, conditions, injuries }, universe),
    [character, catalog, statusEffects, conditions, injuries, universe],
  );
  const buffGroups = groupEffects(effects.filter((e) => e.sourceType === 'talent'));
  const debuffGroups = groupEffects(effects.filter((e) => ['condition', 'injury', 'status'].includes(e.sourceType)));
  const derived = derivedDisplay(universe, character);
  const enc = encumbrance(character, universe, catalog);
  const armor = armorRating(character, catalog);
  const carried = carriedItems(character, catalog);
  const career = careerById(catalog, character.career);

  const attrs = rules.attributes || [];
  const knownAttrKeys = new Set(attrs.map((a) => a.key));
  const extraAttrs = Object.keys(character.attributes || {}).filter((k) => !knownAttrKeys.has(k));
  const skillKeys = [
    ...(rules.skills || []).map((s) => s.key),
    ...Object.keys(character.skills || {}).filter((k) => !(rules.skills || []).some((s) => s.key === k)),
  ];
  const statements = character.driveStatements || {};

  return (
    <div className="character-sheet cs">
      {onBack && <button className="back-btn" onClick={onBack}>{backLabel}</button>}

      <div className="panel">
        <div className="char-header-section">
          {portrait && character.id && <Portrait character={character} size={96} generate />}
          <div>
            <div className="char-name-display">{character.name || 'UNNAMED'}</div>
            <div className="char-career-display">
              <span className="cs-term">{T.career.toUpperCase()}:</span> {character.career || '—'}
            </div>
            {source && <span className="cs-badge">{source}</span>}
          </div>
          {derived.label && (
            <div className="cs-derived">
              <div className="cs-derived-label">{derived.label}</div>
              {derived.value !== null
                ? <div className="cs-derived-value">{derived.value}</div>
                : <div className="cs-derived-detail">{derived.detail}</div>}
              {armor !== null && <div className="cs-derived-detail">ARMOR {armor}</div>}
            </div>
          )}
        </div>
        {character.appearance && <p className="cs-appearance">{character.appearance}</p>}
        {actions && <div className="cs-actions">{actions}</div>}
      </div>

      <div className="panel">
        <h2>{T.attributes.toUpperCase()}</h2>
        <div className="attributes-grid cs-attrs">
          {attrs.map((a) => {
            const isKey = career?.keyAttribute === a.key;
            return (
              <div key={a.key} className={`attr-box${isKey ? ' key' : ''}`}>
                <div className="attr-label">{a.label}{isKey && <span className="cs-key">KEY</span>}</div>
                <div className="attr-value">{character.attributes?.[a.key] ?? '—'}</div>
                {statements[a.key] && <div className="cs-statement">“{statements[a.key]}”</div>}
              </div>
            );
          })}
          {extraAttrs.map((k) => (
            <div key={k} className="attr-box">
              <div className="attr-label">{k}</div>
              <div className="attr-value">{character.attributes[k]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>{T.skills.toUpperCase()}</h2>
        <div className="cs-skills">
          {skillKeys.map((key) => {
            const info = skillInfo(universe, key);
            const pool = skillPool(character, key, universe, effects);
            const isKey = (career?.keySkills || []).includes(key);
            const mod = pool.breakdown.some((b) => b.applied && b.kind === 'debuff') ? 'debuff'
              : pool.breakdown.some((b) => b.applied && b.kind === 'buff') ? 'buff' : '';
            const open = openSkill === key;
            return (
              <div key={key} className={`cs-skill${open ? ' open' : ''}`}>
                <button type="button" className="cs-skill-main" onClick={() => setOpenSkill(open ? null : key)} aria-expanded={open}>
                  <span className="cs-skill-name">{info.label}{isKey && <span className="cs-key">★</span>}</span>
                  <span className="cs-skill-attr">{pool.kind === '2d20' ? (pool.attrKey || '').toUpperCase() : info.attr}</span>
                  <span className="cs-skill-val">{character.skills?.[key] ?? 0}</span>
                  <span className={`cs-pool ${mod}`}>{pool.label}</span>
                </button>
                {onRoll && (
                  <button type="button" className="cs-roll" onClick={() => onRoll(key, pool)}>ROLL</button>
                )}
                {open && (
                  <div className="cs-breakdown">
                    <div>
                      {pool.kind === '2d20'
                        ? `${(pool.attrKey || '').toUpperCase()} ${pool.attr} + ${info.label.toUpperCase()} ${pool.skill} = TARGET ${pool.total}`
                        : `${info.attr} ${pool.attr} + ${info.label.toUpperCase()} ${pool.skill}${pool.bonus ? ` ${pool.bonus > 0 ? '+' : '−'} ${Math.abs(pool.bonus)}` : ''} = ${pool.total} DICE`}
                    </div>
                    {pool.breakdown.map((b, i) => (
                      <div key={i} className={`cs-bd ${b.kind}${b.applied ? '' : ' situational'}`}>
                        {b.applied ? '' : 'SITUATIONAL · '}{b.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <h2>{T.talent.toUpperCase()}S <span className="cs-sub">BUFFS</span></h2>
        <EffectGroups groups={buffGroups} empty={character.talent || 'No talent.'} />
      </div>

      <div className="panel">
        <h2>CONDITIONS &amp; INJURIES <span className="cs-sub">DEBUFFS</span></h2>
        <EffectGroups groups={debuffGroups} empty="No active conditions or injuries." />
      </div>

      <div className="panel">
        <h2>INVENTORY</h2>
        {(enc.max !== null || enc.used > 0) && <WeightBar used={enc.used} max={enc.max} />}
        <ul className="cs-inv">
          {carried.map((c, i) => (
            <li key={i}>
              <ItemArt item={c.item} size={40} />
              <div className="cs-inv-body">
                <div className="cs-inv-name">
                  {c.item?.name || c.label.replace(/\s*\(\s*signature item\s*\)$/i, '').replace(/,\s*signature item\s*\)$/i, ')')}{c.qty > 1 && <span className="cs-qty"> ×{c.qty}</span>}
                  {c.note && !/^signature item$/i.test(c.note) && <span className="cs-qty"> ({c.note.replace(/,?\s*signature item$/i, '')})</span>}
                  {c.signature && <span className="cs-key" title="Signature item">SIG</span>}
                </div>
                {c.item ? <StatsRow item={c.item} /> : <div className="cs-stats"><span><i>CUSTOM</i></span></div>}
              </div>
            </li>
          ))}
          {carried.length === 0 && <li className="cs-empty">Nothing carried.</li>}
        </ul>
        {character.signatureItem && (
          <div className="cs-signature">
            <span>SIGNATURE ITEM: </span>{character.signatureItem}
          </div>
        )}
      </div>

      {character.personalAgenda && <div className="agenda-box">{character.personalAgenda}</div>}

      {character.agendaByAct && Object.keys(character.agendaByAct).length > 0 && (
        <div className="panel" style={{ marginTop: '1rem' }}>
          <h2>AGENDA BY ACT</h2>
          {Object.entries(character.agendaByAct).map(([act, text]) => (
            <p key={act} style={{ fontSize: '0.85rem', marginBottom: '0.4rem' }}>
              <span style={{ color: 'var(--accent)', fontSize: '0.7rem', letterSpacing: '0.1em' }}>ACT {act}: </span>{text}
            </p>
          ))}
        </div>
      )}

      {character.secret && (
        <div className="panel" style={{ marginTop: '1rem', borderColor: 'var(--warn)' }}>
          <h2 style={{ color: 'var(--warn)' }}>SECRET</h2>
          <p style={{ fontSize: '0.85rem' }}>{character.secret}</p>
        </div>
      )}

      <div className="panel" style={{ marginTop: '1rem' }}>
        <h2>RELATIONSHIPS</h2>
        <div style={{ display: 'flex', gap: '2rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
          <div>
            <span style={{ color: 'var(--success)', fontSize: '0.7rem', letterSpacing: '0.1em' }}>BUDDY: </span>
            {character.buddy || '—'}
          </div>
          <div>
            <span style={{ color: 'var(--danger)', fontSize: '0.7rem', letterSpacing: '0.1em' }}>RIVAL: </span>
            {character.rival || '—'}
          </div>
        </div>
      </div>
    </div>
  );
}
