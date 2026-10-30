/* DUNE universe module (see ARCHITECTURE.md → Universe module interface). */
import core from './universe.core.js';
import D20DiceRoller from './components/D20DiceRoller.jsx';
import DuneReference from './components/DuneReference.jsx';
import DuneCheatSheets from './components/DuneCheatSheets.jsx';
import { ResidencyMap } from './maps/residency.jsx';
import { SietchMap } from './maps/sietch.jsx';

const ENGINE_MAPS = { 'arrakeen-residency': ResidencyMap, 'sietch-qarrat': SietchMap };

const packs = Object.values(
  import.meta.glob('./content/*.json', { eager: true, import: 'default' }),
);

const dune = {
  ...core,
  rules: { ...core.rules, dice: { ...core.rules.dice, Roller: D20DiceRoller } },
  navSections: [
    { id: 'reference', label: 'Imperium', Component: DuneReference },
    { id: 'cheats', label: 'Cheat Sheets', Component: DuneCheatSheets },
  ],
  maps: core.maps.map((m) => (ENGINE_MAPS[m.id] ? { ...m, engine: ENGINE_MAPS[m.id] } : m)),
  content: { packs },
};

export default dune;
