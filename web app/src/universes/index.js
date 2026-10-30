/* Universe registry. Add new universes here (and see ARCHITECTURE.md). */
import alien from './alien/index.js';
import dune from './dune/index.js';

export const universes = { alien, dune };

export const DEFAULT_UNIVERSE = 'alien';

export function getUniverse(id) {
  return universes[id] || universes[DEFAULT_UNIVERSE];
}

export default universes;
