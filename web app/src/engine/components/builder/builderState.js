/* CharacterBuilder state helpers: caps from rules.creation, blank state,
   per-step validation, cart → character conversion, localStorage drafts. */
import { careerById, itemById, parseGearEntry, slug, splitTalent, talentForCharacter } from '../../catalogUtils';

export const STEPS = [
  { id: 'career', label: (T) => T.career },
  { id: 'attributes', label: (T) => T.attributes },
  { id: 'skills', label: (T) => T.skills },
  { id: 'talent', label: (T) => T.talent },
  { id: 'gear', label: (T) => T.gear },
  { id: 'identity', label: () => 'Identity' },
  { id: 'review', label: () => 'Review' },
];

/* Keys a character object may carry (server/schema/content-pack.schema.json $defs/character). */
export const CHARACTER_KEYS = ['id', 'name', 'career', 'appearance', 'attributes', 'skills', 'health', 'talent', 'gear',
  'signatureItem', 'personalAgenda', 'agendaByAct', 'buddy', 'rival', 'secret', 'driveStatements'];

/** Creation caps for a universe + selected career.
    rules.creation: attrPoints, attrMin, attrMax, keyAttrMax|keyAttributeMax, otherAttrMax,
    skillPoints, skillMin, skillMax, keySkillMax, otherSkillMax, careerKinds{ [career.kind]: overrides }. */
export function capsFor(universe, career) {
  const c0 = universe?.rules?.creation || {};
  const c = { ...c0, ...((career?.kind && c0.careerKinds?.[career.kind]) || {}) };
  const attrMax = c.attrMax ?? 5;
  const skillMax = c.skillMax ?? 3;
  return {
    attrPoints: c.attrPoints ?? 14,
    attrMin: c.attrMin ?? 1,
    attrKeyMax: c.keyAttrMax ?? c.keyAttributeMax ?? attrMax,
    attrOtherMax: c.otherAttrMax ?? attrMax,
    skillPoints: c.skillPoints ?? 10,
    skillMin: c.skillMin ?? 0,
    skillKeyMax: c.keySkillMax ?? skillMax,
    skillOtherMax: c.otherSkillMax ?? skillMax,
    requiredSkills: c.requiredSkillMin ? (career?.requiredSkills || []) : [],
    requiredSkillMin: c.requiredSkillMin || 0,
    talents: c.talents ?? 1,
    allowGeneralTalents: !!c.allowGeneralTalents,
  };
}

export const sum = (obj) => Object.values(obj || {}).reduce((a, b) => a + (Number(b) || 0), 0);

export function attrCap(caps, career, key) {
  return career?.keyAttribute === key ? caps.attrKeyMax : caps.attrOtherMax;
}
export function skillCap(caps, career, key) {
  return (career?.keySkills || []).includes(key) ? caps.skillKeyMax : caps.skillOtherMax;
}
export function skillFloor(caps, key) {
  return caps.requiredSkills.includes(key) ? Math.max(caps.skillMin, caps.requiredSkillMin) : caps.skillMin;
}

export function newCharacterId() {
  return 'custom-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

export function blankState(universe) {
  const caps = capsFor(universe, null);
  const rules = universe?.rules || {};
  return {
    v: 1,
    step: 0,
    maxStep: 0,
    careerId: null,
    talentId: null,
    editingId: null,
    cart: [],
    char: {
      id: newCharacterId(),
      name: '',
      career: '',
      appearance: '',
      attributes: Object.fromEntries((rules.attributes || []).map((a) => [a.key, caps.attrMin])),
      skills: Object.fromEntries((rules.skills || []).map((s) => [s.key, caps.skillMin])),
      talent: '',
      gear: [],
      signatureItem: '',
      personalAgenda: '',
      buddy: '',
      rival: '',
      driveStatements: {},
    },
  };
}

/** Seed builder state from an existing character (EDIT). */
export function stateFromCharacter(universe, catalog, character) {
  const base = blankState(universe);
  const career = careerById(catalog, character.career);
  const talent = talentForCharacter(catalog, character);
  const cart = (character.gear || []).map((g, i) => {
    const { name, qty } = parseGearEntry(g);
    const item = itemById(catalog, name);
    return { key: `e${i}-${slug(name)}`, id: item?.id || null, name: item?.name || name, qty, custom: !item };
  });
  const char = { ...base.char, ...character };
  char.attributes = { ...base.char.attributes, ...(character.attributes || {}) };
  char.skills = { ...base.char.skills, ...(character.skills || {}) };
  char.driveStatements = { ...(character.driveStatements || {}) };
  return {
    ...base,
    step: 0,
    maxStep: STEPS.length - 1,
    careerId: career?.id || null,
    talentId: talent?.id || null,
    editingId: character.id,
    cart,
    char,
  };
}

export function cartToGear(cart) {
  return cart.map((c) => (c.qty > 1 ? `${c.name} ×${c.qty}` : c.name));
}

/** The character object to save (schema keys only; empty driveStatements dropped). */
export function finalCharacter(state) {
  const c = { ...state.char, name: (state.char.name || '').trim(), gear: cartToGear(state.cart) };
  const ds = Object.fromEntries(Object.entries(c.driveStatements || {}).filter(([, v]) => String(v || '').trim()));
  if (Object.keys(ds).length) c.driveStatements = ds; else delete c.driveStatements;
  for (const k of ['appearance', 'talent', 'signatureItem', 'personalAgenda', 'buddy', 'rival']) c[k] = String(c[k] || '');
  delete c.health;
  return Object.fromEntries(Object.entries(c).filter(([k]) => CHARACTER_KEYS.includes(k)));
}

/** Errors blocking NEXT on a step (empty array = valid). */
export function validateStep(stepId, state, universe, catalog) {
  const errs = [];
  const career = careerById(catalog, state.careerId);
  const caps = capsFor(universe, career);
  const rules = universe?.rules || {};
  const { char } = state;
  if (stepId === 'career') {
    if (catalog.careers.length && !career) errs.push('Choose one.');
    if (!catalog.careers.length && !String(char.career || '').trim()) errs.push('Enter a career.');
  }
  if (stepId === 'attributes') {
    const used = sum(char.attributes);
    if (used !== caps.attrPoints) errs.push(used < caps.attrPoints ? `${caps.attrPoints - used} point(s) left to spend.` : `${used - caps.attrPoints} point(s) over budget.`);
    for (const a of rules.attributes || []) {
      const v = Number(char.attributes[a.key]) || 0;
      const max = attrCap(caps, career, a.key);
      if (v < caps.attrMin || v > max) errs.push(`${a.label} must be ${caps.attrMin}–${max}.`);
    }
  }
  if (stepId === 'skills') {
    const used = sum(char.skills);
    if (used !== caps.skillPoints) errs.push(used < caps.skillPoints ? `${caps.skillPoints - used} point(s) left to spend.` : `${used - caps.skillPoints} point(s) over budget.`);
    for (const s of rules.skills || []) {
      const v = Number(char.skills[s.key]) || 0;
      const max = skillCap(caps, career, s.key);
      const min = skillFloor(caps, s.key);
      if (v < min || v > max) errs.push(`${s.label} must be ${min}–${max}.`);
    }
  }
  if (stepId === 'talent') {
    const any = catalog.talents.length > 0;
    if (any && caps.talents > 0 && !String(char.talent || '').trim()) errs.push('Pick one.');
  }
  if (stepId === 'identity') {
    if (!String(char.name || '').trim()) errs.push('Name is required.');
  }
  return errs;
}

/** Display string stored on character.talent. */
export const talentString = (t) => (t.text ? `${t.name} — ${t.text}` : t.name);
export const talentName = (str) => splitTalent(str).name;

/* ── localStorage draft (per universe) ── */
const key = (universeId) => `engine.builder.${universeId}`;

export function loadDraft(universeId) {
  try {
    const d = JSON.parse(localStorage.getItem(key(universeId)) || 'null');
    return d && d.v === 1 && d.char ? d : null;
  } catch { return null; }
}
export function saveDraft(universeId, state) {
  try { localStorage.setItem(key(universeId), JSON.stringify(state)); } catch { /* storage full / unavailable */ }
}
export function clearDraft(universeId) {
  try { localStorage.removeItem(key(universeId)); } catch { /* ignore */ }
}
