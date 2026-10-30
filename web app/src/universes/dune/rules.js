/* DUNE (2d20-style) rules data. No JSX here — this file is imported by node
   scripts (scripts/smoke.mjs). The dice Roller component is attached in
   ./index.js.

   Design notes (mechanics only; all wording is original):
   - Attributes are DRIVES — what a character believes in. Each drive carries a
     one-line statement the player writes (stored on character.driveStatements
     when the engine supports it; bundled packs put them in `appearance`
     because the pack schema forbids extra character keys).
   - Skills are not tied to a drive. A test pairs any drive with any skill:
     target number = drive + skill. `attr` is therefore null; `suggestedAttr`
     is the drive most often paired with the skill (shown as "suggested drive"
     in the Dune reference components only).
   - There are no hit points. Characters suffer STRESS; at the top of the track
     they are defeated (taken out, broken, captured — the Narrator decides). */

export const attributes = [
  { key: 'duty', label: 'Duty', short: 'DUTY', prompt: 'Who or what do you owe, and how far will you go for it?' },
  { key: 'faith', label: 'Faith', short: 'FAITH', prompt: 'What do you believe in that cannot be proven?' },
  { key: 'justice', label: 'Justice', short: 'JUST', prompt: 'What wrong would you never let stand?' },
  { key: 'power', label: 'Power', short: 'POWR', prompt: 'What would you seize, and what is it for?' },
  { key: 'truth', label: 'Truth', short: 'TRTH', prompt: 'Which truth matters more to you than comfort?' },
];

export const skills = [
  { key: 'battle', label: 'Battle', attr: null, suggestedAttr: 'duty' },
  { key: 'communicate', label: 'Communicate', attr: null, suggestedAttr: 'power' },
  { key: 'discipline', label: 'Discipline', attr: null, suggestedAttr: 'faith' },
  { key: 'move', label: 'Move', attr: null, suggestedAttr: 'justice' },
  { key: 'understand', label: 'Understand', attr: null, suggestedAttr: 'truth' },
];

export const STRESS_MAX = 8;

/* Dune has no health. The engine still calls derived.health (character sheet,
   creator, assignment), so it returns the stress capacity — a constant 8.
   It is NOT hit points; it is how much pressure a character can take. */
function health() {
  return STRESS_MAX;
}

export const derived = {
  health,
  healthLabel: 'COMPOSURE', // no health track: the sheet hides the number and shows stress capacity
  maxStress: STRESS_MAX,
};

/* Tracks shown as bars on the DM dashboard and player phone. */
export const tracks = [
  {
    key: 'stress', label: 'STRESS', short: 'STRESS',
    max: STRESS_MAX, initial: 0,
    color: 'var(--warn)', danger: (value) => value >= 6,
  },
];

/* Shared pools — NOT yet rendered by the engine (reported gap).
   momentum: earned by players from surplus successes, capped at 6, spent by any
   player. threat: the Narrator's pool, uncapped, fed by complications and by
   players buying dice. */
export const pools = [
  { key: 'momentum', label: 'MOMENTUM', max: 6, initial: 0, owner: 'players' },
  { key: 'threat', label: 'THREAT', initial: 0, owner: 'gm' },
];

export const statusEffects = [
  'WOUNDED', 'EXHAUSTED', 'POISONED', 'SPICE-ADDICTED', 'DISGRACED',
  'MARKED FOR DEATH', 'INDEBTED', 'SUSPECTED',
];

export const conditions = ['dehydrated', 'exposed', 'spice-withdrawal', 'wounded'];

/* 2d20 test parameters used by the D20DiceRoller. */
export const dice = {
  kind: '2d20',
  baseDice: 2,
  maxBonusDice: 3,       // bought with momentum (or threat) → 5d20 total
  maxDifficulty: 5,
  criticalRange: 1,      // a natural 1 always scores two successes
  complicationRange: 1,  // natural 20 is a complication; can widen to 16–20
};

export const creation = {
  attrPoints: 30, attrMin: 4, attrMax: 8,
  skillPoints: 26, skillMax: 8,
  skillMin: 4, // honored by CharacterBuilder
  talents: 1, allowGeneralTalents: true,
};

/* No carrying-capacity rule in this 2d20 adaptation (catalog/rules.json encumbrance: null). */
export const encumbrance = null;

export const rules = {
  attributes,
  skills,
  derived,
  tracks,
  pools,
  statusEffects,
  conditions,
  dice,
  creation,
  encumbrance,
};

export default rules;
