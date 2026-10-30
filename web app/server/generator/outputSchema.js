/* Build the structured-output JSON schema sent to Claude from the real pack schema.

   The full content-pack.schema.json uses features structured outputs does not
   accept (if/then, pattern, minLength, format, open maps, patternProperties).
   This derives a stricter, model-facing copy:
     - every object has additionalProperties:false and explicit properties
     - open maps become explicit keys (attributes/skills from universe.rules,
       agendaByAct "1".."N") or key/value pair arrays (stats) that
       normalizePack() folds back into objects
     - fields the server stamps (packVersion, id, universe, meta.generated,
       meta.source) are removed
     - most optional prose fields become required (quality bar)
   The result of the model is ALWAYS re-validated with the full ajv schema. */
import { packSchema } from '../schema/validate.js';

const STRIP_KEYS = ['$schema', '$id', 'title', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum',
  'minItems', 'maxItems', 'format', 'patternProperties', 'default', 'allOf', 'if', 'then'];

function strip(node) {
  if (Array.isArray(node)) return node.map(strip);
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (STRIP_KEYS.includes(k)) continue;
    if (k === 'properties' || k === '$defs') {
      out[k] = Object.fromEntries(Object.entries(v).map(([pk, pv]) => [pk, strip(pv)]));
    } else {
      out[k] = strip(v);
    }
  }
  if (out.type === 'object' && out.properties) out.additionalProperties = false;
  return out;
}

const statPairs = (description) => ({
  description: `${description} Encoded as key/value pairs, e.g. [{"key":"health","value":4}].`,
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['key', 'value'],
    properties: {
      key: { type: 'string', description: 'Stat key in the universe\'s own vocabulary (camelCase).' },
      value: { type: 'integer', description: 'Numeric value.' },
    },
  },
});

const intMap = (keys, description, lo, hi) => ({
  description,
  type: 'object',
  additionalProperties: false,
  required: keys,
  properties: Object.fromEntries(keys.map((k) => [k, { type: 'integer', description: `${k}: ${lo}–${hi}` }])),
});

/**
 * @param {object} universe universe core (rules.attributes, rules.skills, rules.creation)
 * @param {object} params   validated generator params
 * @param {{min:number,max:number}} acts act count range
 */
export function buildOutputSchema(universe, params, acts) {
  const s = strip(packSchema);
  const P = s.properties;
  const D = s.$defs;
  const rules = universe.rules || {};
  const creation = rules.creation || {};

  // Root: server stamps packVersion/id/universe.
  delete P.packVersion; delete P.id; delete P.universe;
  P.kind = { ...P.kind, enum: params.type === 'Campaign' ? ['campaign', 'scenario'] : ['scenario'] };
  if (!params.includeMaps) delete P.maps;
  s.required = ['kind', 'meta', 'briefing', 'acts', 'npcs', 'threats', 'keyLocations', 'handouts', 'endings', 'characters', 'tips',
    ...(params.includeMaps ? ['maps'] : [])];
  P.acts.description += ` Write exactly ${acts.min === acts.max ? acts.min : `${acts.min} or ${acts.max}`} act(s).`;
  P.characters.description += ` Write exactly ${params.players} characters.`;

  // Meta: provenance is stamped server-side.
  const M = P.meta.properties;
  delete M.generated; delete M.source;
  P.meta.required = ['title', 'tagline', 'synopsis', 'type', 'players', 'playtime', 'difficulty', 'tone', 'contentWarnings'];

  D.act.required = ['title', 'subtitle', 'summary', 'readAloud', 'gmNotes', 'agendaNotes', 'scenes'];
  D.scene.required = ['name', 'mandatory', 'encounter', 'narration', 'checks', 'events', 'stressTriggers', 'npcGuidance', 'gmTip', 'outcomes'];
  D.npc.properties.stats = statPairs(D.npc.properties.stats.description);
  D.npc.required = ['name', 'role', 'agenda', 'behavior', 'secret'];
  D.threat.properties.stats = statPairs(D.threat.properties.stats.description);
  D.threat.required = ['name', 'description', 'tactics', 'stats'];
  D.handout.required = ['id', 'title', 'from', 'to', 'priority', 'text', 'when'];
  // Session-feature fields: art paths and audio cues are engine/GM-supplied, never model-written.
  // clues[] / clocks[] / scene.clueRefs stay (authorable, optional).
  delete D.act.properties.sceneArt;
  delete D.scene.properties.ambient;
  delete D.handout.properties.image;

  // Maps: generated maps are always ASCII schematics.
  delete D.map.properties.src; delete D.map.properties.engine;
  D.map.properties.kind = { ...D.map.properties.kind, enum: ['ascii'] };
  D.map.required = ['id', 'title', 'subtitle', 'description', 'kind', 'ascii', 'rooms'];

  // Characters: explicit universe keys so they are legal.
  const C = D.character.properties;
  const attrKeys = (rules.attributes || []).map((a) => a.key);
  const skillKeys = (rules.skills || []).map((k) => k.key);
  const aMin = creation.attrMin ?? 1; const aMax = creation.attrMax ?? 5;
  const sMax = (creation.skillMax ?? 3) + 2;
  if (attrKeys.length) C.attributes = intMap(attrKeys, `Attribute scores, each ${aMin}–${aMax}.`, aMin, aMax);
  if (skillKeys.length) C.skills = intMap(skillKeys, `Skill levels, every skill present, each 0–${sMax}.`, 0, sMax);
  delete C.health;
  const actKeys = Array.from({ length: acts.max }, (_, i) => String(i + 1));
  C.agendaByAct = {
    description: C.agendaByAct?.description || 'Agenda per act.',
    type: 'object',
    additionalProperties: false,
    required: actKeys.slice(0, acts.min),
    properties: Object.fromEntries(actKeys.map((k) => [k, { type: 'string', description: `Agenda for act ${k}, 1–3 sentences in second person.` }])),
  };
  const required = ['id', 'name', 'career', 'appearance', 'attributes', 'skills', 'talent', 'gear', 'signatureItem',
    'personalAgenda', 'agendaByAct', 'buddy', 'rival', 'secret'];
  if (params.playerNames?.length) {
    C.assignedTo = {
      description: 'Which real player this character is written for (each name used exactly once). Removed from the saved pack.',
      type: 'string',
      enum: params.playerNames,
    };
    required.push('assignedTo');
  }
  D.character.required = required;
  return s;
}
