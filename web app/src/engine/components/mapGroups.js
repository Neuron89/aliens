/* Pure helpers for the Maps tab and the Stories library cards (no JSX, so
   scripts/test-ui-polish.mjs can import them in node). */

/* Plan noun per universe: ALIEN ships have decks, DUNE houses have floors. */
export function planNoun(universe) {
  return (universe?.theme?.board?.levelNoun || 'DECK').toUpperCase() === 'DECK' ? 'DECK PLAN' : 'FLOOR PLAN';
}

const KIND_RANK = (m) => (m.engine ? 0 : m.ascii && !(m.src || m.image) ? 1 : 2);

/** Group maps by scenario. Image maps that are views of another map in the same
    group ("USCSS CRONUS — DECK A" under "USCSS CRONUS"), or that name it with
    `parent`, fold under that map. Interactive plans sort first, in each group
    and across groups (otherwise pack order is kept). */
export function groupMaps(list) {
  const groups = [];
  for (const m of list) {
    let g = groups.find((x) => x.name === m.group);
    if (!g) { g = { name: m.group, maps: [] }; groups.push(g); }
    g.maps.push(m);
  }
  for (const g of groups) {
    const isImage = (m) => !!(m.src || m.image) && !m.engine;
    const parents = g.maps.filter((m) => !isImage(m));
    const childOf = (m) => {
      if (!isImage(m)) return null;
      if (m.parent) return parents.find((p) => p.id === m.parent) || null;
      const t = String(m.title || '').toUpperCase();
      return parents.find((p) => {
        const pt = String(p.title || '').toUpperCase();
        return pt && t !== pt && (t.startsWith(`${pt} —`) || t.startsWith(`${pt} -`));
      }) || null;
    };
    const children = new Map();
    const top = [];
    for (const m of g.maps) {
      const p = childOf(m);
      if (p) { if (!children.has(p.id)) children.set(p.id, []); children.get(p.id).push(m); } else top.push(m);
    }
    top.sort((a, b) => KIND_RANK(a) - KIND_RANK(b));
    g.items = top.map((m) => ({ map: m, children: children.get(m.id) || [] }));
    g.rank = Math.min(...g.maps.map(KIND_RANK));
  }
  return groups.map((g, i) => ({ ...g, i })).sort((a, b) => a.rank - b.rank || a.i - b.i);
}

/** The first map of `pack` that has an engine plan: { config, level, crop } | null. */
export function firstPlan(universe, pack) {
  const umaps = universe?.maps || [];
  for (const m of pack?.maps || []) {
    const ref = typeof m.engine === 'string' ? m.engine : m.id;
    const u = umaps.find((x) => x.id === ref) || umaps.find((x) => x.id === m.id);
    const config = typeof u?.engine === 'function' ? u.engine.config : null;
    if (config?.decks?.length) return { config, level: u.levels?.[0]?.id ?? config.decks[0].level ?? config.decks[0].id, crop: u.crop || null };
  }
  return null;
}
