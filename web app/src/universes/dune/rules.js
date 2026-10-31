/* DUNE (2d20-style) rules data. No JSX here — this file is imported by node
   scripts (scripts/smoke.mjs). The dice Roller component is attached in
   ./index.js.

   Design notes (mechanics only; all wording is original):
   - Attributes are DRIVES — what a character believes in. Each drive carries a
     one-line statement in the character's voice, stored on
     character.driveStatements { duty, faith, justice, power, truth }. The
     attribute `prompt` below is the question the statement answers; it drives
     the builder's statement inputs, the generator's driveStatements field and
     the validator's "every DUNE pre-gen has all five" check.
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

/* Shared pools (catalog/rules.json "momentum-cap", "threat-start"), rendered by the
   engine (GM header counters, phone top bar, TV corner meters; server/mechanics.js).
   momentum: earned by players from surplus successes, capped at 6, spent by any
   player; public. threat: the Narrator's pool, uncapped, fed by complications and
   by players buying dice; starts at 2 per player each session (initialPerPlayer);
   hidden from the table unless visibleToPlayers. Both reset on a new session. */
export const pools = [
  { key: 'momentum', label: 'MOMENTUM', max: 6, initial: 0, owner: 'players', visibleToPlayers: true, playerAdd: true, resetOnNewSession: true },
  { key: 'threat', label: 'THREAT', initial: 0, initialPerPlayer: 2, owner: 'gm', visibleToPlayers: false, resetOnNewSession: true },
];

/* DETERMINATION: a personal resource (0–3, every character starts with 1). The phone
   shows it in the top bar with SPEND (`determination-spend`, server validates ≥ 1 and logs
   it into the GM's roll feed); the GM grants +1 from the player editor (`determination-grant`). */
export const determination = { label: 'DETERMINATION', short: 'DET', max: 3, initial: 1 };

/* Initiative (catalog/rules.json "keep-the-initiative"): no cards — the acting side passes
   the turn to the other side (the GM nominates / a player hands it to an ally), or keeps
   it for 2 Momentum (players) / 2 Threat (GM). */
export const initiative = { mode: 'nominate', keepCost: 2 };

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

/* Drives are not bought with points: the rulebook hands every character the fixed
   array 8/7/6/5/4, each value assigned to exactly one drive (CharacterBuilder
   presents it as tap/drag-to-assign chips; attrPoints/attrMin/attrMax remain as
   the derived bounds for older code paths). */
export const creation = {
  attrArray: [8, 7, 6, 5, 4],
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
  determination,
  statusEffects,
  conditions,
  dice,
  initiative,
  creation,
  encumbrance,
};

export default rules;
