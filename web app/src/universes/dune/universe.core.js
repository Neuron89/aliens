/* DUNE universe — JSX-free core.
   Everything here is plain data/functions so node scripts can import it
   (scripts/smoke.mjs). ./index.js adds the React components (dice roller,
   reference tabs) and the bundled content packs. */

import { theme } from './theme.js';
import { terms, terminal } from './terms.js';
import { rules } from './rules.js';
import { careers, gear } from './careers.js';
import { generator } from './generator.js';
import { maps } from './maps/index.js';
import careersCatalog from './catalog/careers.json' with { type: 'json' };
import talents from './catalog/talents.json' with { type: 'json' };
import weapons from './catalog/weapons.json' with { type: 'json' };
import armor from './catalog/armor.json' with { type: 'json' };
import gearCatalog from './catalog/gear.json' with { type: 'json' };
import conditions from './catalog/conditions.json' with { type: 'json' };
import injuries from './catalog/injuries.json' with { type: 'json' };
import creatures from './catalog/creatures.json' with { type: 'json' };
import catalogRules from './catalog/rules.json' with { type: 'json' };

/* Character-builder / sheet / board catalog (data only, all text original;
   see src/engine/catalogUtils.js for the normalized interface). Item art lives
   in public/art/dune/{weapons,gear,creatures,archetypes}/<id>.webp. */
export const catalog = {
  careers: careersCatalog, talents, weapons, armor, gear: gearCatalog,
  conditions, injuries, creatures, rules: catalogRules,
};

const core = {
  id: 'dune',
  name: 'DUNE',
  tagline: 'Water is life. Spice is power. Trust is a weapon.',
  terminal,
  theme,
  terms,
  rules,
  careers,
  gear,
  maps,
  generator,
  catalog,
};

export default core;
