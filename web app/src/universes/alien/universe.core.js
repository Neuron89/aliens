/* ALIEN RPG universe — JSX-free core.
   Everything here is plain data/functions so node scripts can import it
   (scripts/smoke.mjs). ./index.js adds the React components (dice roller,
   reference tabs, interactive maps) and the bundled content packs. */

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
import panic from './catalog/panic.json' with { type: 'json' };
import catalogRules from './catalog/rules.json' with { type: 'json' };

/* Character-builder / sheet catalog (data only; see catalog/README.md and
   src/engine/catalogUtils.js for the normalized interface). */
export const catalog = {
  careers: careersCatalog, talents, weapons, armor, gear: gearCatalog,
  conditions, injuries, creatures, panic, rules: catalogRules,
};

const core = {
  id: 'alien',
  name: 'ALIEN RPG',
  tagline: 'In space, no one can hear you scream.',
  terminal,
  theme,
  terms,
  rules,
  careers,
  gear,
  maps,
  generator,
  catalog,
  // Optional engine features (absent = off). tracker: phones get the TRACKER tab
  // (player/TrackerPane.jsx) and the server a per-player motion-tracker summary.
  features: { tracker: true },
};

export default core;
