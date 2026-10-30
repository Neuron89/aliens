/* Universe-agnostic helpers for reading universe.rules and content packs. */

export const CUSTOM_CHARACTERS_PACK_ID = 'custom-characters';

/** Resolve a track's max for a character (max may be a number or (char) => number). */
export function trackMaxFor(track, char) {
  const m = typeof track.max === 'function' ? track.max(char) : track.max;
  return Number.isFinite(Number(m)) ? Number(m) : undefined;
}

/** Initial session state for a freshly assigned character. */
export function initialCharacterState(universe, char) {
  const tracks = {};
  const trackMax = {};
  for (const t of universe.rules?.tracks || []) {
    const max = trackMaxFor(t, char);
    if (max !== undefined) trackMax[t.key] = max;
    tracks[t.key] = t.initial === 'max' ? (max ?? 0) : Number(t.initial) || 0;
  }
  const out = { tracks, trackMax, conditions: [...(universe.rules?.conditions || [])] };
  const det = determinationDef(universe);
  if (det) out.determination = { value: det.initial, max: det.max };
  return out;
}

/** Per-character DETERMINATION (rules.determination { label, max, initial }) or null. */
export function determinationDef(universe) {
  const d = universe?.rules?.determination;
  if (!d) return null;
  const max = Math.max(1, Number(d.max) || 3);
  return { label: d.label || 'DETERMINATION', max, initial: Math.max(0, Math.min(max, Number(d.initial ?? 1) || 0)) };
}

/** 24-hour clock for every rendered time: "HH:MM" (or "HH:MM:SS" with { seconds: true }). */
export function fmtTime(at, { seconds = false } = {}) {
  const d = at instanceof Date ? at : new Date(Number(at) || at || Date.now());
  if (Number.isNaN(d.getTime())) return '--:--';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}${seconds ? `:${p(d.getSeconds())}` : ''}`;
}

/** Roll flags as shown everywhere (feed, TV, phone): PANIC supersedes BOTCH (a botch = zero successes
    with no panic). Older rolls that carry both keep only 'panic' (styled like a botch). */
export function displayFlags(flags) {
  const list = Array.isArray(flags) ? flags.filter((f) => typeof f === 'string') : [];
  return list.includes('panic') ? list.filter((f) => f !== 'botch') : list;
}

/** Character copy with engine-derived health (packs may omit or carry a stale value). */
export function withDerived(universe, char) {
  const health = universe.rules?.derived?.health;
  return typeof health === 'function' ? { ...char, health: health(char) } : { ...char };
}

export function attributeLabel(universe, key, { short = false } = {}) {
  const a = (universe.rules?.attributes || []).find((x) => x.key === key);
  if (!a) return key.toUpperCase();
  return short ? (a.short || a.key.toUpperCase()) : a.label;
}

export function skillInfo(universe, key) {
  const s = (universe.rules?.skills || []).find((x) => x.key === key);
  if (!s) return { label: key, attr: '' };
  const attr = (universe.rules?.attributes || []).find((a) => a.key === s.attr);
  return { label: s.label, attr: attr ? (attr.short || attr.key.toUpperCase()) : (s.attr || '').toUpperCase() };
}

/** Group characters from packs: [{ packId, title, kind, characters }]. */
export function characterGroups(packs) {
  return packs
    .filter((p) => Array.isArray(p.characters) && p.characters.length > 0)
    .map((p) => ({ packId: p.id, title: p.meta?.title || p.id, kind: p.kind, source: p.meta?.source, characters: p.characters }));
}

/** Download an object as a pretty-printed JSON file. */
export function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lightweight client-side pack check (the server runs full JSON-Schema validation). */
export function quickCheckPack(pack, { universeId } = {}) {
  const errors = [];
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) return ['Not a JSON object.'];
  if (pack.packVersion !== 1) errors.push('packVersion must be 1.');
  if (typeof pack.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(pack.id)) errors.push('id must be kebab-case.');
  if (typeof pack.universe !== 'string') errors.push('universe is required.');
  else if (universeId && pack.universe !== universeId) errors.push(`Pack is for universe "${pack.universe}", but the active universe is "${universeId}".`);
  if (!['scenario', 'characters', 'campaign'].includes(pack.kind)) errors.push('kind must be scenario, characters or campaign.');
  if (!pack.meta || typeof pack.meta.title !== 'string' || typeof pack.meta.tagline !== 'string') errors.push('meta.title and meta.tagline are required.');
  if ((pack.kind === 'scenario' || pack.kind === 'campaign') && (!Array.isArray(pack.acts) || pack.acts.length === 0)) errors.push('Scenario and campaign packs need at least one act.');
  if (pack.characters !== undefined && !Array.isArray(pack.characters)) errors.push('characters must be an array.');
  return errors;
}

/** Header/derived value for the sheet & builder.
    Universes with a `health` track show the number labelled rules.derived.healthLabel (default HEALTH).
    Universes without one (e.g. DUNE) hide the number and show the first track's capacity instead:
    { label, value|null, detail } e.g. { label:'COMPOSURE', value:null, detail:'STRESS 0–8' }. */
export function derivedDisplay(universe, char) {
  const rules = universe?.rules || {};
  const tracks = rules.tracks || [];
  const label = rules.derived?.healthLabel;
  if (tracks.some((t) => t.key === 'health')) {
    const fn = rules.derived?.health;
    const value = typeof fn === 'function' ? fn(char) : char?.health;
    return { label: label || 'HEALTH', value: value ?? null, detail: '' };
  }
  const first = tracks[0];
  if (!first) return { label: label || '', value: null, detail: '' };
  const max = trackMaxFor(first, char);
  return { label: label || first.label, value: null, detail: `${first.label}${max !== undefined ? ` MAX ${max}` : ''}` };
}

/** Indefinite article for a word ("an Audience", "a Session"). */
export const article = (word) => (/^[aeiou]/i.test(String(word || '').trim()) ? 'an' : 'a');

/** English plural for a universe term ("Transmission" → "Transmissions", "Dispatch" → "Dispatches"). */
export function plural(word) {
  const w = String(word || '');
  return /(s|sh|ch|x|z)$/i.test(w) ? `${w}${w === w.toUpperCase() ? 'ES' : 'es'}` : `${w}${w === w.toUpperCase() ? 'S' : 's'}`;
}
