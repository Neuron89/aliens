/* ALIEN RPG (Year Zero Engine) rules data. No JSX here — this file is
   imported by node scripts (scripts/smoke.mjs). The dice Roller component
   is attached in ./index.js. */

export const attributes = [
  { key: 'str', label: 'Strength', short: 'STR' },
  { key: 'agi', label: 'Agility', short: 'AGI' },
  { key: 'wit', label: 'Wits', short: 'WIT' },
  { key: 'emp', label: 'Empathy', short: 'EMP' },
];

export const skills = [
  { key: 'heavyMachinery', label: 'Heavy Machinery', attr: 'str' },
  { key: 'stamina', label: 'Stamina', attr: 'str' },
  { key: 'closeCombat', label: 'Close Combat', attr: 'str' },
  { key: 'mobility', label: 'Mobility', attr: 'agi' },
  { key: 'piloting', label: 'Piloting', attr: 'agi' },
  { key: 'rangedCombat', label: 'Ranged Combat', attr: 'agi' },
  { key: 'observation', label: 'Observation', attr: 'wit' },
  { key: 'comtech', label: 'Comtech', attr: 'wit' },
  { key: 'survival', label: 'Survival', attr: 'wit' },
  { key: 'manipulation', label: 'Manipulation', attr: 'emp' },
  { key: 'medicalAid', label: 'Medical Aid', attr: 'emp' },
  { key: 'command', label: 'Command', attr: 'emp' },
];

/** ALIEN core rules: Health equals Strength. */
function health(char) {
  const str = Number(char?.attributes?.str);
  return Number.isFinite(str) && str > 0 ? str : 1;
}

export const derived = {
  health,
  healthLabel: 'HEALTH',
  maxStress: 10,
};

/* Tracks shown as bars on the DM dashboard and player phone.
   max: number | (char) => number. initial: 'max' | number. */
export const tracks = [
  {
    key: 'health', label: 'HEALTH', short: 'HP',
    max: (char) => health(char), initial: 'max',
    color: 'var(--accent)', danger: (value) => value <= 2,
  },
  {
    key: 'stress', label: 'STRESS', short: 'STRESS',
    max: 10, initial: 0,
    color: 'var(--warn)', danger: (value) => value >= 7,
  },
];

export const statusEffects = [
  'STRESSED', 'PANICKED', 'STARVING', 'DEHYDRATED', 'EXHAUSTED',
  'FREEZING', 'BLEEDING', 'BROKEN', 'RADIATION', 'INFECTED',
  'UNCONSCIOUS', 'CRITICAL',
];

export const conditions = ['starving', 'dehydrated', 'exhausted', 'freezing'];

/* attrMax / skillMax are absolute caps (the generator reads them). The builder
   applies the CRB creation caps (catalog/rules.json): key attribute up to
   keyAttrMax, others up to otherAttrMax; key skills up to keySkillMax, others
   up to otherSkillMax. careerKinds overrides them per career.kind (ACM MOS:
   MOS skills up to 4, others 3, required skills at least 1). */
export const creation = {
  attrPoints: 14, attrMin: 2, attrMax: 5,
  skillPoints: 10, skillMax: 3,
  keyAttrMax: 5, otherAttrMax: 4,
  skillMin: 0, keySkillMax: 3, otherSkillMax: 1,
  talents: 1, allowGeneralTalents: false,
  careerKinds: { mos: { keySkillMax: 4, otherSkillMax: 3, requiredSkillMin: 1 } },
};

/* Carrying capacity (CRB p.34 encumbrance): regular items up to STRENGTH x2. */
export const encumbrance = { formula: 'str*2', overFormula: 'str*4' };

export const rules = {
  attributes,
  skills,
  derived,
  tracks,
  statusEffects,
  conditions,
  dice: { kind: 'yze' },
  creation,
  encumbrance,
};

export default rules;
