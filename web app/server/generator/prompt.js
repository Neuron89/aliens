/* Prompt builder for the scenario generator.

   system = [ ENGINE_PROMPT (fixed), universe.generator.systemPrompt + rules text ]
   The universe block carries cache_control so repeated generations for the same
   universe hit the prompt cache. Everything that varies per request (the
   parameters) lives in the user message, after the cached prefix. */
import { actRange } from './params.js';

export const ENGINE_PROMPT = `You are a veteran tabletop RPG scenario designer who has written published adventures for horror, science-fiction and survival games. You write content packs for a game-master terminal app: a Game Master runs your scenario tonight at a real table, reading narration aloud (often through text-to-speech) and pushing in-world messages to the players' phones.

OUTPUT CONTRACT
- Respond with a single JSON object that matches the provided JSON schema exactly. No prose before or after it, no markdown, no comments.
- Field descriptions in the schema are part of your instructions: follow their word counts, casing and voice.
- Plain text only inside strings: no HTML, no markdown tables, no bullet characters. Use "\\n\\n" between paragraphs where a field holds several paragraphs.

QUALITY BAR
- Structure: three acts for a "session" or "long" playtime; one or two acts for a "one-shot". Each act escalates (cinematic arc: hope → doubt → horror, or the universe's equivalent).
- Read-aloud: every act has 3–6 readAloud paragraphs of 40–120 words each, present tense, second person ("You…"), concrete sensory detail (sound, smell, temperature, light), never rules text, dice or GM secrets.
- Scenes: every act has 3–6 scenes in play order. Each scene gives the GM something to do: concrete skill checks named with the universe's skill names in upper case ("OBSERVATION — spot the cut cable"), events that happen regardless of the players, explicit stress/panic triggers stating who is affected, NPC guidance (what they want, what they lie about), a practical gmTip, and outcomes that say where each result leads. Mark plot-critical scenes mandatory; give at least one encounter per act after the first.
- NPCs: 3–8, each with an agenda that conflicts with at least one other NPC or PC, a playable behavior with a tell, and a secret.
- Characters: exactly the requested number of pre-generated player characters, legal under the CHARACTER RULES below (keys, ranges, careers, gear). Each has a buddy and a rival among the other PCs (use their names), a personalAgenda, an agendaByAct entry for every act that escalates (Act 1 private and plausible, middle act conflicting, final act open betrayal or sacrifice), and at least one secret that directly collides with another PC's agenda or secret. Give players something to do at the table from the first scene.
- Handouts: 2–6 in-world messages written in the universe's terminal/teletype voice, each with a "when" cue that tells the GM exactly when to send it (e.g. "Act II, after the crew opens the cargo hold"). Use them for orders, intercepted logs and private agenda updates addressed to a single character.
- Threats: the scenario's hostile forces with a first-glimpse description, escalating tactics and numeric stats in the universe's vocabulary; reference bestiary ids in "ref" when one fits.
- Endings: at least two, covering a costly success and a loss; more if the scenario branches.
- Key locations: 4–10, each sensory and gameable. If maps are requested, draw ASCII schematics (box-drawing characters, at most ~70 columns, labelled rooms, a title block) whose rooms match the key locations.
- Tips: 3–8 actionable GM tips about pacing, when to spring events and how to handle player-vs-player conflict.
- Content warnings must be honest and complete for what you actually wrote. Respect everything listed under AVOID absolutely — leave it out entirely rather than hinting at it.
- Difficulty and lethality shape the numbers: Introductory = forgiving checks and clear clues; Standard = genre-typical; Brutal = scarce resources, harsh checks, likely deaths. Low lethality = injuries and losses more than deaths; high lethality = expect most characters to die, and make each death meaningful.

ORIGINALITY
- Invent every proper noun: ships, stations, corporations' subsidiaries, people, places. Universe-level institutions named in the universe guide may appear, but never reuse characters, crews, ships or plots from films, novels or published adventures.
- Never reproduce copyrighted text. Write everything fresh.`;

function fmtCreation(creation = {}) {
  const parts = [];
  for (const [k, v] of Object.entries(creation)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'object') parts.push(`${k}: ${JSON.stringify(v)}`);
    else parts.push(`${k}: ${v}`);
  }
  return parts.join(', ');
}

/** Character rules for a universe, rendered as plain text. Deterministic (cache-safe). */
export function rulesText(universe) {
  const r = universe.rules || {};
  const lines = ['CHARACTER RULES (characters you write must be legal under these):'];
  if (r.attributes?.length) {
    const c = r.creation || {};
    const range = c.attrMin !== undefined && c.attrMax !== undefined ? ` (each ${c.attrMin}–${c.attrMax})` : '';
    lines.push(`Attributes${range}: ${r.attributes.map((a) => `${a.key} = ${a.label}`).join('; ')}.`);
  }
  if (r.skills?.length) {
    lines.push(`Skills (use every key; 0 = untrained): ${r.skills.map((s) => `${s.key} = ${s.label.toUpperCase()}${s.attr ? ` [${s.attr}]` : ''}`).join('; ')}.`);
  }
  if (r.creation) {
    lines.push(`Creation budget: ${fmtCreation(r.creation)}.`);
    if (r.creation.attrPoints !== undefined) {
      lines.push(`Attribute scores should total ${r.creation.attrPoints} (±1). Pre-generated characters are seasoned: skill totals may exceed skillPoints by up to 10, and individual skills may go up to ${(r.creation.skillMax ?? 3) + 2} in the career's key skills only.`);
    }
  }
  if (r.tracks?.length) lines.push(`Tracked on the dashboard: ${r.tracks.map((t) => t.label).join(', ')} (health is derived by the engine; do not include it).`);
  if (r.statusEffects?.length) lines.push(`Status effects the GM can apply: ${r.statusEffects.join(', ')}.`);
  if (r.dice?.kind) lines.push(`Dice system: ${r.dice.kind}.`);
  const careers = universe.careers || [];
  if (careers.length) {
    lines.push('Careers (character.career must be one of these names; the talent must be one of that career\'s talents, copied as "Name — effect"):');
    for (const c of careers) {
      lines.push(`- ${c.name} — key attribute ${c.keyAttribute ?? '-'}; key skills ${(c.keySkills || []).join(', ')}; talents: ${(c.talents || []).join(' | ')}`);
    }
  }
  if (universe.gear?.length) lines.push(`Gear (prefer items from this list; the signature item is personal and invented): ${universe.gear.join('; ')}.`);
  const terms = universe.terms || {};
  if (terms.priorities?.length) lines.push(`Handout priority values: ${terms.priorities.join(', ')}.`);
  if (universe.terminal?.name) lines.push(`The in-world computer/terminal voice is "${universe.terminal.name}".`);
  return lines.join('\n');
}

export function universeBlock(universe) {
  return [
    `UNIVERSE: ${universe.name} (registry id "${universe.id}")${universe.tagline ? ` — ${universe.tagline}` : ''}`,
    '',
    'UNIVERSE GUIDE',
    universe.generator?.systemPrompt || '(no universe guide supplied — follow the genre implied by the universe name)',
    '',
    rulesText(universe),
  ].join('\n');
}

/** System prompt blocks (stable → cached). */
export function buildSystem(universe) {
  return [
    { type: 'text', text: ENGINE_PROMPT },
    { type: 'text', text: universeBlock(universe), cache_control: { type: 'ephemeral' } },
  ];
}

/** The per-request user message. */
export function buildUserMessage(universe, params) {
  const acts = actRange(params);
  const L = [];
  L.push(`Write a complete ${universe.name} content pack for tonight's game night with these parameters:`);
  L.push(`- Players: ${params.players}${params.playerNames?.length ? ` (${params.playerNames.join(', ')})` : ''}`);
  L.push(`- Playtime: ${params.playtime} → ${acts.min === acts.max ? acts.min : `${acts.min}–${acts.max}`} act(s)`);
  L.push(`- Type: ${params.type}`);
  L.push(`- Difficulty: ${params.difficulty}; lethality: ${params.lethality}`);
  L.push(`- Tone: ${params.tone?.length ? params.tone.join(', ') : 'your choice, fitting the universe'}`);
  L.push(`- Setting: ${params.setting?.trim() || 'your choice — surprise the table'}`);
  L.push(`- Threat: ${!params.threat?.trim() || /surprise/i.test(params.threat) ? 'SURPRISE ME — choose a threat that fits the setting and keep its true nature hidden until late' : params.threat.trim()}`);
  if (params.themes?.trim()) L.push(`- Themes to explore: ${params.themes.trim()}`);
  L.push(`- AVOID (hard limits, exclude entirely): ${params.avoid?.trim() || 'nothing specified beyond normal good taste'}`);
  L.push(`- Maps: ${params.includeMaps ? 'include 1–3 ASCII schematic maps' : 'no maps'}`);
  if (params.seedTitle) L.push(`- Title: use "${params.seedTitle}" (or very close to it)`);
  if (params.playerNames?.length) {
    L.push('');
    L.push(`Write one character for each player and set assignedTo to that player's name (each name exactly once). Do not use the players' real names as character names.`);
  }
  L.push('');
  L.push(`Set meta.type to "${params.type}", meta.players to "${params.players}", meta.playtime to a human-readable estimate matching "${params.playtime}", and meta.difficulty to "${params.difficulty}".`);
  return L.join('\n');
}

export function buildMessages(universe, params) {
  return [{ role: 'user', content: buildUserMessage(universe, params) }];
}

export function buildRepairMessages(universe, params, badText, errors) {
  return [
    ...buildMessages(universe, params),
    { role: 'assistant', content: badText },
    {
      role: 'user',
      content: `The JSON you returned failed validation:\n${errors.slice(0, 40).map((e) => `- ${e}`).join('\n')}\n\nReturn the corrected, complete JSON object (all fields, not a diff). Fix only what is needed; keep the story intact.`,
    },
  ];
}
