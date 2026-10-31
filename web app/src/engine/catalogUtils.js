/* Universe-agnostic helpers over `universe.catalog` (see docs/BOARD_AND_BUILDER.md §6).
   JSX-free and DOM-free so node scripts (scripts/smoke.mjs) can import it.

   Catalog interface every universe exposes as `universe.catalog` (all keys optional; arrays):
     careers, talents, weapons, armor, gear, conditions, injuries, creatures, rules (+ panic etc.)
   Item shapes vary per universe (ALIEN: weight/rating at top level for armor & gear, stats.weight
   for weapons; DUNE: everything under stats). getCatalog() normalizes them:
     item.type   'weapon' | 'armor' | 'gear'
     item.weight number | null  ("1/2" → 0.5; null = not carried / tiny)
     item.armor  armor rating (number) or null
     item.bonus  gear/weapon dice bonus (number) or null
     item.cost   number | null
   Careers: { id, name, keyAttribute, keySkills[], talents[ids], startingGear: { fixed[], choices[][], pick, rule, quantities } }
   Effects (talents, items, conditions, injuries): { kind:'buff'|'debuff', target?:'skill:<k>'|'attr:<k>'|..., stat?:'<k>', value?, text, when? } */

export const CATALOG_KEYS = ['careers', 'talents', 'weapons', 'armor', 'gear', 'conditions', 'injuries', 'creatures', 'rules'];

export const slug = (s) => String(s ?? '').toLowerCase().normalize('NFKD')
  .replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** "1/2" → 0.5, "2" → 2, null → null. */
export function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const arr = (x) => (Array.isArray(x) ? x : []);

function normalizeItem(raw, type) {
  const st = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
  const weight = toNumber(st.weight !== undefined ? st.weight : raw.weight);
  const armor = toNumber(raw.rating ?? st.armor ?? st.rating ?? null);
  return {
    ...raw,
    type,
    category: raw.category || (type === 'armor' ? 'armor' : type),
    weight,
    armor: type === 'armor' ? armor : (st.armor !== undefined ? toNumber(st.armor) : null),
    bonus: toNumber(st.bonus ?? raw.bonus ?? null),
    cost: toNumber(st.cost ?? raw.cost ?? null),
    tags: arr(raw.tags),
    effects: arr(raw.effects),
  };
}

function normalizeStartingGear(sg) {
  if (Array.isArray(sg)) return { fixed: sg, choices: [], pick: 'all', rule: '', quantities: {} };
  if (!sg || typeof sg !== 'object') return { fixed: [], choices: [], pick: 'all', rule: '', quantities: {} };
  return { fixed: arr(sg.fixed), choices: arr(sg.choices).map(arr), pick: sg.pick ?? 'all', rule: sg.rule || '', quantities: sg.quantities || {}, cash: sg.cash };
}

/* Fallback when a universe has no catalog careers: derive from universe.careers (careers.js),
   whose talents are "Name — text" strings. */
function careersFromLegacy(universe) {
  const talents = [];
  const careers = arr(universe.careers).map((c) => {
    const id = slug(c.name);
    const tIds = arr(c.talents).map((t) => {
      const { name, text } = splitTalent(t);
      const tid = slug(name);
      talents.push({ id: tid, name, career: id, text, effects: [] });
      return tid;
    });
    return { ...c, id, talents: tIds, startingGear: normalizeStartingGear(c.startingGear) };
  });
  return { careers, talents };
}

/** "Overkill — Spend extra…" → { name:'Overkill', text:'Spend extra…' } */
export function splitTalent(str) {
  const s = String(str || '');
  const m = s.match(/^(.*?)\s+[—–-]{1,2}\s+(.*)$/s) || s.match(/^([^:]{2,40}):\s+(.*)$/s);
  return m ? { name: m[1].trim(), text: m[2].trim() } : { name: s.trim(), text: '' };
}

const cache = new WeakMap();

/** Normalized catalog for a universe (memoized per universe object). */
export function getCatalog(universe) {
  if (!universe || typeof universe !== 'object') return emptyCatalog();
  if (cache.has(universe)) return cache.get(universe);
  const raw = universe.catalog || {};
  let careers = arr(raw.careers).map((c) => ({ ...c, id: c.id || slug(c.name), startingGear: normalizeStartingGear(c.startingGear) }));
  let talents = arr(raw.talents).map((t) => ({ ...t, effects: arr(t.effects) }));
  if (careers.length === 0) {
    const legacy = careersFromLegacy(universe);
    careers = legacy.careers;
    if (talents.length === 0) talents = legacy.talents;
  }
  const weapons = arr(raw.weapons).map((x) => normalizeItem(x, 'weapon'));
  const armor = arr(raw.armor).map((x) => normalizeItem(x, 'armor'));
  const gear = arr(raw.gear).map((x) => normalizeItem(x, 'gear'));
  const cat = {
    ...raw,
    careers,
    talents,
    weapons,
    armor,
    gear,
    conditions: arr(raw.conditions),
    injuries: arr(raw.injuries),
    creatures: arr(raw.creatures),
    rules: raw.rules ?? [],
  };
  cat.items = [...weapons, ...armor, ...gear];
  cat._itemIndex = new Map();
  for (const it of cat.items) {
    cat._itemIndex.set(it.id, it);
    if (!cat._itemIndex.has(slug(it.name))) cat._itemIndex.set(slug(it.name), it);
  }
  cache.set(universe, cat);
  return cat;
}

function emptyCatalog() {
  const c = Object.fromEntries(CATALOG_KEYS.map((k) => [k, []]));
  c.items = [];
  c._itemIndex = new Map();
  return c;
}

/** Strip a trailing quantity ("Signal Flare ×6") → { name, qty }. */
export function parseGearEntry(entry) {
  const s = String(entry || '').trim();
  const m = s.match(/^(.*?)\s*[×x]\s*(\d+)$/i);
  return m ? { name: m[1].trim(), qty: Number(m[2]) } : { name: s, qty: 1 };
}

/** Split a trailing parenthetical note off a gear name ("Shotgun (in office)") → { base, note }. */
export function splitGearNote(name) {
  const s = String(name || '').trim();
  const m = s.match(/^(.*\S)\s*\(([^()]+)\)$/);
  return m ? { base: m[1].trim(), note: m[2].trim() } : { base: s, note: '' };
}

/** Item by id, then by name slug, then by a loose name match ("Motion Tracker" → "M314 Motion Tracker"),
    then the same again without a trailing parenthetical note ("Maintenance Jack (Signature Item)"). */
export function itemById(catalog, ref) {
  if (!catalog || !ref) return null;
  const { name } = parseGearEntry(ref);
  const hit = itemByName(catalog, name);
  if (hit) return hit;
  const { base, note } = splitGearNote(name);
  return note ? itemByName(catalog, base) : null;
}

function itemByName(catalog, name) {
  const idx = catalog._itemIndex;
  if (idx?.has(name)) return idx.get(name);
  const s = slug(name);
  if (!s) return null;
  if (idx?.has(s)) return idx.get(s);
  if (s.length < 4) return null;
  let best = null;
  for (const it of catalog.items || []) {
    const n = slug(it.name);
    if (n.endsWith('-' + s) || n.startsWith(s + '-') || s.endsWith('-' + n)) {
      if (!best || it.name.length < best.name.length) best = it;
    }
  }
  return best;
}

export function careerById(catalog, ref) {
  if (!catalog || !ref) return null;
  const s = slug(ref);
  return catalog.careers.find((c) => c.id === ref || slug(c.name) === s || c.id === s) || null;
}

export function talentById(catalog, ref) {
  if (!catalog || !ref) return null;
  return catalog.talents.find((t) => t.id === ref) || null;
}

/** Resolve a character's talent string ("Name — text") to a catalog talent. */
export function talentForCharacter(catalog, character) {
  const raw = character?.talent;
  if (!raw) return null;
  const { name } = splitTalent(raw);
  const s = slug(name);
  return catalog.talents.find((t) => t.id === raw || slug(t.name) === s || t.id === s) || null;
}

/** Talents of a career: its listed ids; only when it lists none, every talent tagged with the career id. */
export function talentsFor(career, catalog) {
  if (!career) return [];
  const cat = catalog || null;
  const all = cat ? cat.talents : [];
  const out = [];
  const seen = new Set();
  for (const id of arr(career.talents)) {
    const t = all.find((x) => x.id === id) || (typeof id === 'object' ? id : null);
    if (t && !seen.has(t.id)) { out.push(t); seen.add(t.id); }
  }
  if (out.length === 0) {
    for (const t of all) {
      if (t.career === career.id && !seen.has(t.id)) { out.push(t); seen.add(t.id); }
    }
  }
  return out;
}

export function generalTalents(catalog) {
  return (catalog?.talents || []).filter((t) => t.career === 'general');
}

/** Starting gear of a career with ids resolved:
    { fixed:[item], choices:[[item]], pick, rule, quantities, missing:[ids] }.
    `selection` (optional) = array of chosen indexes per choice group (null = group skipped)
    → also returns `items`, the flat list of what the selection grants. */
export function startingGearFor(career, catalog, selection) {
  const sg = normalizeStartingGear(career?.startingGear);
  const missing = [];
  const res = (id) => {
    const it = itemById(catalog, id);
    if (!it) missing.push(id);
    return it || { id, name: id, type: 'gear', weight: null, tags: [], effects: [], unresolved: true };
  };
  const fixed = sg.fixed.map(res);
  const choices = sg.choices.map((g) => g.map(res));
  const out = { fixed, choices, pick: sg.pick, rule: sg.rule, quantities: sg.quantities, cash: sg.cash, missing };
  if (Array.isArray(selection)) {
    out.items = [...fixed, ...choices.map((g, i) => (selection[i] == null ? null : g[selection[i]])).filter(Boolean)];
  }
  return out;
}

/** How many choice groups must be picked: number, or all groups. */
export function requiredPicks(sg) {
  const n = sg.choices?.length || 0;
  return typeof sg.pick === 'number' ? Math.min(sg.pick, n) : n;
}

/* ── Encumbrance ─────────────────────────────────────────────── */

/** Evaluate a tiny formula: "str*2", "str", "8", "str*2+1". */
export function evalFormula(formula, character) {
  if (formula === null || formula === undefined) return null;
  if (typeof formula === 'number') return formula;
  if (typeof formula === 'function') return toNumber(formula(character));
  const expr = String(formula).replace(/\s+/g, '');
  const terms = expr.split('+');
  let total = 0;
  for (const term of terms) {
    let prod = 1;
    for (const f of term.split('*')) {
      const n = toNumber(f);
      if (n !== null) { prod *= n; continue; }
      const a = toNumber(character?.attributes?.[f]);
      if (a === null) return null;
      prod *= a;
    }
    total += prod;
  }
  return total;
}

/** True when a gear entry is the character's signature item: tagged "(Signature Item)", or its name
    matches the part of character.signatureItem before the " — story". */
export function isSignatureEntry(label, signatureItem) {
  const { base, note } = splitGearNote(label);
  if (/signature/i.test(note)) return true;
  const sig = slug(splitTalent(signatureItem).name);
  return !!sig && (slug(label) === sig || slug(base) === sig);
}

/** Items a character carries (strings or {id|name, qty}), resolved against the catalog. */
export function carriedItems(character, catalog) {
  return arr(character?.gear).map((g) => {
    const entry = typeof g === 'string' ? parseGearEntry(g) : { name: g?.name || g?.id || '', qty: g?.qty || 1 };
    const item = itemById(catalog, typeof g === 'object' && g?.id ? g.id : entry.name);
    const { note } = splitGearNote(entry.name);
    return {
      label: entry.name, qty: entry.qty, item, note: item ? note : '',
      signature: isSignatureEntry(entry.name, character?.signatureItem),
      weight: typeof g === 'object' && g?.weight != null ? toNumber(g.weight) : item?.weight ?? null,
    };
  });
}

/** { used, max, over, unknown } using rules.encumbrance ({ formula:'str*2' }); max null when the universe has none.
    The signature item never encumbers. */
export function encumbrance(character, universe, catalog = getCatalog(universe)) {
  const enc = universe?.rules?.encumbrance;
  const max = enc ? evalFormula(enc.formula ?? enc.max ?? enc, character) : null;
  let used = 0;
  let unknown = 0;
  for (const c of carriedItems(character, catalog)) {
    if (c.signature) continue;
    if (c.weight === null) { if (!c.item) unknown++; continue; }
    used += c.weight * (c.qty || 1);
  }
  used = Math.round(used * 100) / 100;
  return { used, max, over: max !== null && used > max, unknown };
}

/** Best armor rating among carried armor (only one suit counts). */
export function armorRating(character, catalog) {
  let best = null;
  for (const c of carriedItems(character, catalog)) {
    if (c.item?.type === 'armor' && c.item.armor !== null) best = Math.max(best ?? 0, c.item.armor);
  }
  return best;
}

/* ── Effects (buffs / debuffs) ───────────────────────────────── */

function effectTarget(e, universe) {
  if (e.target) return e.target;
  if (e.stat) {
    const r = universe?.rules || {};
    if ((r.skills || []).some((s) => s.key === e.stat)) return `skill:${e.stat}`;
    if ((r.attributes || []).some((a) => a.key === e.stat)) return `attr:${e.stat}`;
    return e.stat;
  }
  return 'other';
}

function pushEffects(out, src, sourceType, defaultKind, universe) {
  const effects = arr(src.effects);
  const base = { source: src.name || src.id, sourceId: src.id, sourceType, sourceText: src.text || src.notes || '' };
  if (effects.length === 0) {
    out.push({ ...base, kind: src.kind === 'buff' || src.kind === 'debuff' ? src.kind : defaultKind, target: 'other', value: null, text: src.text || src.name || '' });
    return;
  }
  for (const e of effects) {
    out.push({
      ...base,
      kind: e.kind === 'buff' || e.kind === 'debuff' ? e.kind : defaultKind,
      target: effectTarget(e, universe),
      value: typeof e.value === 'number' ? e.value : null,
      text: e.text || '',
      when: e.when,
    });
  }
}

function findDebuff(catalog, ref) {
  const s = slug(typeof ref === 'object' ? ref?.id || ref?.name : ref);
  if (!s) return null;
  return catalog.conditions.find((c) => c.id === s || slug(c.name) === s)
    || catalog.injuries.find((c) => c.id === s || slug(c.name) === s)
    || null;
}

/** Merged buffs/debuffs for a character:
    [{ kind, source, sourceId, sourceType:'talent'|'gear'|'condition'|'injury'|'status', target, value, text, when, sourceText }]
    `live` = { statusEffects, conditions, injuries } (arrays of ids/names) — the session's live state;
    the same keys on the character object are merged in too. */
export function effectsFor(character, catalog, live = {}, universe = null) {
  const out = [];
  if (!character || !catalog) return out;
  const talent = talentForCharacter(catalog, character);
  if (talent) pushEffects(out, talent, 'talent', 'buff', universe);
  else if (character.talent) {
    const { name, text } = splitTalent(character.talent);
    out.push({ kind: 'buff', source: name, sourceType: 'talent', target: 'other', value: null, text: text || name, sourceText: text });
  }
  for (const c of carriedItems(character, catalog)) {
    if (c.item && c.item.effects.length) pushEffects(out, c.item, 'gear', 'buff', universe);
  }
  const seen = new Set();
  const addDebuffs = (list, sourceType) => {
    for (const ref of arr(list)) {
      const key = slug(typeof ref === 'object' ? ref?.id || ref?.name : ref);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const hit = findDebuff(catalog, ref);
      if (hit) pushEffects(out, hit, catalog.injuries.includes(hit) ? 'injury' : 'condition', 'debuff', universe);
      else out.push({ kind: 'debuff', source: String(typeof ref === 'object' ? ref.name || ref.id : ref), sourceType, target: 'other', value: null, text: typeof ref === 'object' ? ref.text || '' : '' });
    }
  };
  addDebuffs([...arr(live.conditions), ...arr(character.conditions)], 'condition');
  addDebuffs([...arr(live.injuries), ...arr(character.injuries)], 'injury');
  addDebuffs([...arr(live.statusEffects), ...arr(character.statusEffects)], 'status');
  return out;
}

/** Group effects by source for display: [{ source, sourceType, kind, sourceText, effects:[...] }]. */
export function groupEffects(effects) {
  const map = new Map();
  for (const e of effects) {
    const k = `${e.sourceType}:${e.source}`;
    if (!map.has(k)) map.set(k, { source: e.source, sourceId: e.sourceId, sourceType: e.sourceType, kind: e.kind, sourceText: e.sourceText, effects: [] });
    map.get(k).effects.push(e);
  }
  return [...map.values()];
}

/* ── Pool / target preview ───────────────────────────────────── */

const COMBAT_CATS = { rangedCombat: ['pistol', 'rifle', 'heavy', 'projectile', 'lasgun'], closeCombat: ['melee', 'blade'] };

/** Tap-to-roll preview for one skill.
    Returns { kind, attrKey, attr, skill, bonus, total, label, breakdown:[{ label, value, applied }] }.
    - yze (ALIEN): total = attribute + skill + best gear bonus + standing modifiers (conditions/injuries/armor).
      Talent bonuses are situational: listed in breakdown with applied:false.
    - 2d20 (DUNE): total = drive + skill (target number). Modifiers are Difficulty notes (applied:false).
    opts.attr overrides the attribute/drive used (Dune pairs any drive with any skill). */
export function skillPool(character, skillKey, universe, effects = null, opts = {}) {
  const rules = universe?.rules || {};
  const kind = rules.dice?.kind || 'yze';
  const catalog = getCatalog(universe);
  const skillDef = (rules.skills || []).find((s) => s.key === skillKey) || { key: skillKey, attr: null };
  const attrs = character?.attributes || {};
  let attrKey = opts.attr || skillDef.attr;
  if (!attrKey) {
    // Any drive pairs with any skill: preview with the highest drive (ties → suggested drive).
    const keys = (rules.attributes || []).map((a) => a.key);
    attrKey = keys.reduce((best, k) => {
      const v = Number(attrs[k]) || 0;
      const bv = Number(attrs[best]) || 0;
      return v > bv || (v === bv && k === skillDef.suggestedAttr) ? k : best;
    }, skillDef.suggestedAttr || keys[0]);
  }
  const attr = Number(attrs[attrKey]) || 0;
  const skill = Number(character?.skills?.[skillKey]) || 0;
  const breakdown = [];
  const fx = effects || effectsFor(character, catalog, {}, universe);
  const hits = fx.filter((e) => e.target === `skill:${skillKey}` || (attrKey && e.target === `attr:${attrKey}`));

  if (kind === '2d20') {
    for (const e of hits) breakdown.push({ label: `${e.source}: ${e.text}`, value: e.value, applied: false, kind: e.kind });
    const total = attr + skill;
    return { kind, attrKey, attr, skill, bonus: 0, total, label: `TN ${total}`, breakdown };
  }

  // yze: best single gear bonus
  let bonus = 0;
  let bonusSrc = null;
  const cats = COMBAT_CATS[skillKey];
  for (const c of carriedItems(character, catalog)) {
    const it = c.item;
    if (!it) continue;
    if (cats && it.type === 'weapon' && cats.includes(it.category) && (it.bonus || 0) > bonus) { bonus = it.bonus; bonusSrc = it.name; }
  }
  let standing = 0;
  for (const e of hits) {
    if (e.value === null) { breakdown.push({ label: `${e.source}: ${e.text}`, value: null, applied: false, kind: e.kind }); continue; }
    if (e.sourceType === 'gear' && e.kind === 'buff') {
      if (e.value > bonus) { bonus = e.value; bonusSrc = `${e.source} (${e.text})`; }
      else breakdown.push({ label: `${e.source}: ${e.text}`, value: e.value, applied: false, kind: e.kind });
      continue;
    }
    if (e.sourceType === 'talent' || e.when) { breakdown.push({ label: `${e.source}: ${e.text}`, value: e.value, applied: false, kind: e.kind }); continue; }
    standing += e.value;
    breakdown.push({ label: `${e.source}: ${e.text}`, value: e.value, applied: true, kind: e.kind });
  }
  if (bonusSrc) breakdown.unshift({ label: `Gear: ${bonusSrc}`, value: bonus, applied: true, kind: 'buff' });
  const total = Math.max(0, attr + skill + bonus + standing);
  return { kind, attrKey, attr, skill, bonus: bonus + standing, total, label: `${total} DICE`, breakdown };
}

/** UI words with sensible fallbacks (terms.* may be missing on older universes / neutral chrome). */
export function termsFor(universe) {
  const t = universe?.terms || {};
  return {
    career: t.career || 'Career',
    attributes: t.attributes || 'Attributes',
    skills: t.skills || 'Skills',
    talent: t.talent || 'Talent',
    gear: t.gear || 'Gear',
  };
}
