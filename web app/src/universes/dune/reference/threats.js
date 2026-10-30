/* Threat bestiary for the Dune reference tab — a thin view over
   catalog/creatures.json (the single source). Stats use this universe's own
   terms: `evade` = Difficulty of the test to avoid or escape it, `stress` =
   Stress inflicted on a failed test or a successful attack, `threat` = Threat
   the Narrator usually pays to bring it in. Entry ids are usable as
   content-pack threats[].ref. All text original. */
import creatures from '../catalog/creatures.json' with { type: 'json' };

export const threats = creatures.map((c) => ({
  id: c.id,
  name: c.name,
  category: c.type,
  stats: c.stats,
  description: c.special,
  tactics: c.tactics,
  notes: c.notes,
  art: c.art,
}));

export default threats;
