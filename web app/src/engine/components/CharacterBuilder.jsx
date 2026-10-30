import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useUniverse } from '../UniverseContext';
import { getCatalog, careerById, talentsFor, termsFor } from '../catalogUtils';
import CharacterSheet from './CharacterSheet';
import {
  STEPS, capsFor, blankState, stateFromCharacter, finalCharacter, validateStep,
  loadDraft, saveDraft, clearDraft, cartToGear,
} from './builder/builderState';
import { CareerStep, AttributesStep, SkillsStep, TalentStep, IdentityStep } from './builder/steps';
import GearStep from './builder/GearStep';

/* Guided character builder (docs/BOARD_AND_BUILDER.md §6).
   Props:
     initial          character to edit (omit for a new one)
     onSave(char)     async; persists to the "Custom Characters" pack (Characters.jsx)
     onBack()
     saving, error    save status from the parent
     onSubmit(char)   part 2: socket `character-submit`. When absent, SUBMIT TO GM is disabled
                      with the tooltip "available in session".
     connectedPlayers part 2: array of names offered for buddy / rival.
   In-progress state is kept in localStorage per universe (engine.builder.<universeId>). */
export default function CharacterBuilder({ initial, onSave, onBack, saving, error, onSubmit, connectedPlayers }) {
  const { universe } = useUniverse();
  const catalog = getCatalog(universe);
  const T = termsFor(universe);

  const [state, setState] = useState(() => {
    const draft = loadDraft(universe.id);
    if (initial) {
      if (draft && draft.editingId === initial.id) return draft;
      return stateFromCharacter(universe, catalog, initial);
    }
    if (draft && !draft.editingId) return draft;
    return blankState(universe);
  });
  const [showErrors, setShowErrors] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const topRef = useRef(null);

  useEffect(() => { saveDraft(universe.id, state); }, [universe.id, state]);

  const career = careerById(catalog, state.careerId);
  const caps = useMemo(() => capsFor(universe, career), [universe, career]);
  const step = STEPS[state.step];
  const errors = validateStep(step.id, state, universe, catalog);
  const previewChar = useMemo(() => ({ ...state.char, gear: cartToGear(state.cart) }), [state.char, state.cart]);

  const patch = (fn) => setState((s) => ({ ...s, ...fn(s) }));
  const setChar = (fn) => setState((s) => ({ ...s, char: { ...s.char, ...fn(s.char) } }));

  const goto = (i) => {
    setShowErrors(false);
    setState((s) => ({ ...s, step: i, maxStep: Math.max(s.maxStep, i) }));
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };
  const next = () => {
    if (errors.length) { setShowErrors(true); return; }
    if (state.step < STEPS.length - 1) goto(state.step + 1);
  };
  const back = () => (state.step > 0 ? goto(state.step - 1) : onBack?.());

  /* A step is reachable when every step before it validates. */
  const reachable = (i) => STEPS.slice(0, i).every((s) => validateStep(s.id, state, universe, catalog).length === 0);

  const selectCareer = (c) => {
    const nextCaps = capsFor(universe, c);
    const talents = talentsFor(c, catalog).map((t) => t.name);
    setState((s) => {
      const attrs = Object.fromEntries(Object.entries(s.char.attributes).map(([k, v]) => {
        const max = c.keyAttribute === k ? nextCaps.attrKeyMax : nextCaps.attrOtherMax;
        return [k, Math.max(nextCaps.attrMin, Math.min(max, v))];
      }));
      const skills = Object.fromEntries(Object.entries(s.char.skills).map(([k, v]) => {
        const max = (c.keySkills || []).includes(k) ? nextCaps.skillKeyMax : nextCaps.skillOtherMax;
        const min = nextCaps.requiredSkills.includes(k) ? Math.max(nextCaps.skillMin, nextCaps.requiredSkillMin) : nextCaps.skillMin;
        return [k, Math.max(min, Math.min(max, v))];
      }));
      const keepTalent = talents.some((n) => s.char.talent?.startsWith(n));
      return {
        ...s,
        careerId: c.id,
        char: { ...s.char, career: c.name, attributes: attrs, skills, talent: keepTalent ? s.char.talent : '' },
      };
    });
  };

  const setAttr = (key, val, max) => setChar((c) => {
    const v = Math.max(caps.attrMin, Math.min(max, val));
    return { attributes: { ...c.attributes, [key]: v } };
  });
  const setSkill = (key, val, min, max) => setChar((c) => ({ skills: { ...c.skills, [key]: Math.max(min, Math.min(max, val)) } }));
  const setStatement = (key, text) => setChar((c) => ({ driveStatements: { ...(c.driveStatements || {}), [key]: text } }));
  const setField = (key, value) => setChar(() => ({ [key]: value }));
  const setCart = (fn) => patch((s) => ({ cart: typeof fn === 'function' ? fn(s.cart) : fn }));

  const allValid = STEPS.every((s) => validateStep(s.id, state, universe, catalog).length === 0);
  const handleSave = async () => {
    if (!allValid) { setShowErrors(true); return; }
    const ok = await onSave?.(finalCharacter(state));
    if (ok !== false) clearDraft(universe.id);
  };
  const handleSubmit = () => {
    if (!onSubmit || !allValid) return;
    onSubmit(finalCharacter(state));
    setSubmitted(true);
  };
  const startOver = () => {
    if (!confirm('Discard this character and start over?')) return;
    clearDraft(universe.id);
    setState(blankState(universe));
    setShowErrors(false);
  };

  const pct = Math.round(((state.step + 1) / STEPS.length) * 100);

  return (
    <div className="cb" ref={topRef}>
      <div className="cb-top">
        <button className="back-btn" onClick={onBack}>← CHARACTERS</button>
        <button type="button" className="cb-link" onClick={startOver}>START OVER</button>
      </div>

      <div className="cb-progress" aria-label="Builder progress">
        <div className="cb-progress-head">
          <span className="cb-progress-step">STEP {state.step + 1}/{STEPS.length}</span>
          <span className="cb-progress-title">{step.label(T).toUpperCase()}</span>
          {initial && <span className="cb-pill">EDITING</span>}
        </div>
        <div className="cb-progress-bar"><div style={{ width: `${pct}%` }} /></div>
        <ol className="cb-steps">
          {STEPS.map((s, i) => {
            const can = i <= state.maxStep || reachable(i);
            return (
              <li key={s.id}>
                <button type="button" className={`${i === state.step ? 'current' : ''}${i < state.step ? ' done' : ''}`}
                  disabled={!can} onClick={() => can && goto(i)} aria-current={i === state.step ? 'step' : undefined}>
                  <span className="cb-step-n">{i + 1}</span><span className="cb-step-l">{s.label(T)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="cb-body">
        {step.id === 'career' && (
          <CareerStep universe={universe} catalog={catalog} T={T} careerId={state.careerId} onSelect={selectCareer}
            customCareer={state.char.career} onCustomCareer={(v) => setField('career', v)} />
        )}
        {step.id === 'attributes' && (
          <AttributesStep universe={universe} T={T} career={career} caps={caps} char={state.char} setAttr={setAttr} setStatement={setStatement} />
        )}
        {step.id === 'skills' && <SkillsStep universe={universe} career={career} caps={caps} char={previewChar} setSkill={setSkill} />}
        {step.id === 'talent' && <TalentStep catalog={catalog} career={career} caps={caps} talent={state.char.talent} onPick={(t) => setField('talent', t)} T={T} />}
        {step.id === 'gear' && <GearStep universe={universe} catalog={catalog} career={career} char={state.char} cart={state.cart} setCart={setCart} T={T} />}
        {step.id === 'identity' && <IdentityStep career={career} char={state.char} setField={setField} cart={state.cart} connectedPlayers={connectedPlayers} />}
        {step.id === 'review' && (
          <>
            {!allValid && <p className="cb-warn">Some earlier steps are incomplete — use the step list above to fix them.</p>}
            <CharacterSheet character={finalCharacter(state)} source={initial ? 'Custom Characters · editing' : 'Custom Characters · draft'} />
          </>
        )}
      </div>

      <div className="cb-footer">
        {showErrors && errors.length > 0 && (
          <ul className="cb-errors" role="alert">{errors.slice(0, 4).map((e) => <li key={e}>{e}</li>)}</ul>
        )}
        {error && <p className="cb-errors" role="alert">{error}</p>}
        {submitted && <p className="cb-ok">Submitted to the {universe.terms?.gm || 'GM'}.</p>}
        <div className="cb-footer-btns">
          <button type="button" className="cb-btn" onClick={back}>{state.step === 0 ? 'CANCEL' : '◂ BACK'}</button>
          {step.id !== 'review' ? (
            <button type="button" className={`cb-btn primary${errors.length ? ' blocked' : ''}`} onClick={next}>NEXT ▸</button>
          ) : (
            <>
              <button type="button" className="cb-btn primary" onClick={handleSave} disabled={saving || !allValid}>{saving ? 'SAVING…' : 'SAVE'}</button>
              <span className="cb-tip-wrap" title={onSubmit ? `Send to the ${universe.terms?.gm || 'GM'}` : 'available in session'}>
                <button type="button" className="cb-btn" onClick={handleSubmit} disabled={!onSubmit || !allValid}>SUBMIT TO {(universe.terms?.gmShort || 'GM').toUpperCase()}</button>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
