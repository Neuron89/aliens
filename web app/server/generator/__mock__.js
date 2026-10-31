/* Mock generator — enabled with GENERATOR_MOCK=1 (no API key needed).

   Produces "model output" JSON from a bundled pack of the requested universe
   (or a synthetic one if the universe has none), with a mutated title, freshly
   generated characters that are legal under universe.rules, and act/character
   counts matching the params. The text is streamed through the SAME progress
   tracker and then the SAME normalize → validate path as a real generation, so
   the SSE events and the UI can be exercised end to end.
   GENERATOR_MOCK_DELAY=<ms> sets the per-chunk delay (default 350). */
import { readFileSync } from 'fs';
import { bundledPackFiles } from './universes.js';
import { actRange } from './params.js';

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); return; }
  const t = setTimeout(resolve, ms);
  signal?.addEventListener?.('abort', () => { clearTimeout(t); const e = new Error('aborted'); e.name = 'AbortError'; reject(e); }, { once: true });
});

const FIRST = ['Mara', 'Ilya', 'Tobias', 'Wen', 'Dara', 'Kofi', 'Sable', 'Rourke'];
const LAST = ['Okafor', 'Lindqvist', 'Reyes', 'Hale', 'Varga', 'Nakamura', 'Duarte', 'Prosser'];

function pickBasePack(universeId) {
  const packs = bundledPackFiles(universeId).map((f) => {
    try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; }
  }).filter((p) => p && p.kind !== 'characters' && p.acts?.length);
  packs.sort((a, b) => (b.acts.length - a.acts.length) || ((b.characters?.length || 0) - (a.characters?.length || 0)));
  return packs[0] || null;
}

const para = (s) => `${s} The air is cold and tastes of metal. Somewhere below you, something heavy shifts and settles, and the silence afterwards is worse than the sound. You check the people beside you and wonder which of them is lying.`;

function syntheticAct(n) {
  return {
    title: `ACT ${['I', 'II', 'III'][n] || n + 1}`,
    subtitle: ['ARRIVAL', 'FRACTURE', 'RECKONING'][n] || 'AFTERMATH',
    summary: 'Mock act generated without a bundled pack.',
    readAloud: [para('You step through the hatch into a corridor lit only by emergency strips.'), para('The terminal at the junction flickers awake as you approach.'), para('A message waits on the screen, addressed to someone in your crew.')],
    gmNotes: 'Mock GM notes.',
    agendaNotes: 'Mock agenda notes.',
    scenes: [],
  };
}

function legalCharacter(universe, i, params) {
  const rules = universe.rules || {};
  const c = rules.creation || {};
  const attrs = (rules.attributes || []).map((a) => a.key);
  const skills = (rules.skills || []).map((s) => s.key);
  const aMin = c.attrMin ?? 1; const aMax = c.attrMax ?? 5;
  const attributes = Object.fromEntries(attrs.map((k) => [k, aMin]));
  let pool = Math.max(0, (c.attrPoints ?? attrs.length * (aMin + 1)) - aMin * attrs.length);
  for (let j = 0; pool > 0 && j < 100; j++) {
    const k = attrs[(i + j) % attrs.length];
    if (attributes[k] < aMax) { attributes[k]++; pool--; }
  }
  if (Array.isArray(c.attrArray) && c.attrArray.length === attrs.length) {
    // Fixed array (DUNE drives): rotate the values so each character gets a different spread.
    attrs.forEach((k, j) => { attributes[k] = c.attrArray[(i + j) % attrs.length]; });
  }
  const skillMax = c.skillMax ?? 3;
  const skillMin = c.skillMin ?? 0;
  const skillsObj = Object.fromEntries(skills.map((k) => [k, skillMin]));
  let sp = (c.skillPoints ?? 10) - skillMin * skills.length;
  for (let j = 0; sp > 0 && j < 200; j++) {
    const k = skills[(i * 3 + j) % skills.length];
    if (skillsObj[k] < skillMax) { skillsObj[k]++; sp--; }
  }
  const career = (universe.careers || [])[i % Math.max(1, (universe.careers || []).length)];
  const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`;
  const others = (k) => `${FIRST[(i + k) % Math.max(params.players, 1) % FIRST.length]} ${LAST[(((i + k) % Math.max(params.players, 1)) * 3) % LAST.length]}`;
  const ch = {
    id: `mock-${i + 1}`,
    name,
    career: career?.name || 'Crew',
    appearance: 'Weathered, watchful, and quieter than the rest of the crew. Keeps one hand near the hatch release.',
    attributes,
    skills: skillsObj,
    talent: career?.talents?.[0] || 'Steady — once per session, reroll a failed check.',
    gear: (universe.gear || ['Flashlight', 'Toolkit', 'Ration pack']).slice(i, i + 3).concat(['Signature keepsake']),
    signatureItem: 'Signature keepsake — a dented locket from someone who did not make it home.',
    personalAgenda: 'You want to get everyone home, but you need the cargo manifest first.',
    agendaByAct: { 1: 'Get the manifest without anyone noticing.', 2: 'Make sure the manifest leaves with you, whatever it costs.', 3: 'Choose: the crew or the manifest.' },
    buddy: params.players > 1 ? others(1) : 'None',
    rival: params.players > 2 ? others(2) : 'None',
    secret: 'You signed a side contract that pays out only if the rest of the crew does not return.',
  };
  const prompted = (rules.attributes || []).filter((a) => a.prompt);
  if (prompted.length) ch.driveStatements = Object.fromEntries(prompted.map((a) => [a.key, `Mock statement for ${a.label.toLowerCase()}: I know what I owe and to whom.`]));
  if (params.playerNames?.length) ch.assignedTo = params.playerNames[i];
  return ch;
}

/** Build mock "model output" text (pre-normalization, like Claude's JSON). */
export function mockOutput(universe, params) {
  const base = pickBasePack(universe.id);
  const acts = actRange(params);
  const raw = base ? JSON.parse(JSON.stringify(base)) : {
    kind: 'scenario',
    meta: { title: 'Static on Channel Nine', tagline: 'A distress call nobody sent. A crew nobody will miss.' },
    briefing: { from: universe.terminal?.name || 'TERMINAL', to: 'ALL CREW', classification: 'ROUTINE', text: 'PROCEED TO THE SIGNAL SOURCE. REPORT ON ARRIVAL.\n\nEND TRANSMISSION.' },
    acts: [0, 1, 2].map(syntheticAct),
  };
  delete raw.packVersion; delete raw.id; delete raw.universe;
  const stamp = new Date().toISOString().slice(11, 19);
  raw.meta = {
    ...raw.meta,
    title: `${params.seedTitle || raw.meta.title} (Mock ${stamp})`.slice(0, 80),
    type: params.type,
    players: String(params.players),
    playtime: params.playtime,
    difficulty: params.difficulty,
    tone: params.tone?.length ? params.tone : raw.meta.tone || ['dread'],
    contentWarnings: raw.meta.contentWarnings || [],
  };
  delete raw.meta.source; delete raw.meta.generated;
  while (raw.acts.length < acts.min) raw.acts.push(syntheticAct(raw.acts.length));
  raw.acts = raw.acts.slice(0, acts.max);
  raw.characters = Array.from({ length: params.players }, (_, i) => legalCharacter(universe, i, params));
  if (!params.includeMaps) delete raw.maps;
  if (!raw.endings || raw.endings.length < 2) {
    raw.endings = [
      { title: 'BREAKOUT', condition: 'At least one character escapes with the truth.', text: 'You watch the station shrink behind you until it is only a star among stars, and you do not sleep for a long time.' },
      { title: 'SIGNAL LOST', condition: 'Nobody escapes.', text: 'The beacon keeps transmitting long after the last voice on the channel falls silent. Somebody else will answer it.' },
    ];
  }
  return JSON.stringify(raw, null, 2);
}

/** Stream mock output through the real progress tracker with fake delays. */
export async function mockGenerate({ universe, params, progress, signal, delayMs = 350 }) {
  await sleep(delayMs, signal);
  progress.thinking();
  await sleep(delayMs * 2, signal);
  const text = mockOutput(universe, params);
  const chunks = 24;
  const size = Math.ceil(text.length / chunks);
  for (let i = 0; i < text.length; i += size) {
    progress.push(text.slice(i, i + size));
    await sleep(delayMs, signal);
  }
  return text;
}
