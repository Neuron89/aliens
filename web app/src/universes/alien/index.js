/* ALIEN RPG universe module (see ARCHITECTURE.md → Universe module interface). */
import core from './universe.core.js';
import YzeDiceRoller from './components/YzeDiceRoller.jsx';
import WeaponsReference from './components/WeaponsReference.jsx';
import VehiclesReference from './components/VehiclesReference.jsx';
import XenoReference from './components/XenoReference.jsx';
import CheatSheets from './components/CheatSheets.jsx';
import { MonteroMap } from './maps/montero.jsx';
import { bestiary } from './reference/bestiary.js';

const ENGINE_MAPS = { 'uscss-montero': MonteroMap };

/* Cropped token thumbnails (public/art/xenomorphs/cropped) for the table board. */
const XENO_THUMBS = {
  'ovomorph-egg': 'ovomorph', facehugger: 'facehugger', chestburster: 'chestburster', stalker: 'stalker', scout: 'scout',
  drone: 'drone', soldier: 'soldier', praetorian: 'praetorian', queen: 'queen', 'neomorphic-egg-sacs': 'neomorph-egg',
  bloodburster: 'bloodburster', 'neophyte-juvenile-neomorph': 'neophyte', 'adult-neomorph': 'adult-neomorph',
  'the-swarm': 'swarm', harvesters: 'harvesters', 'lion-worms': 'lion-worms', 'tanakan-scorpionids': 'tanakan-scorpionids',
  'vitiate-afflicted': 'vitiate', 'ague-febrile': 'ague', 'lusus-freak': 'lusus', 'nocuous-terminal': 'nocuous',
};

const packs = Object.values(
  import.meta.glob('./content/*.json', { eager: true, import: 'default' }),
);

const alien = {
  ...core,
  rules: { ...core.rules, dice: { ...core.rules.dice, Roller: YzeDiceRoller } },
  navSections: [
    { id: 'weapons', label: 'Weapons', Component: WeaponsReference },
    { id: 'vehicles', label: 'Vehicles', Component: VehiclesReference },
    { id: 'aliens', label: 'Xenomorphs', Component: XenoReference },
    { id: 'cheats', label: 'Cheat Sheets', Component: CheatSheets },
  ],
  maps: core.maps.map((m) => (ENGINE_MAPS[m.id] ? { ...m, engine: ENGINE_MAPS[m.id] } : m)),
  content: { packs },
  reference: {
    bestiary: bestiary.map((b) => ({ ...b, thumb: XENO_THUMBS[b.id] ? `/art/xenomorphs/cropped/${XENO_THUMBS[b.id]}.webp` : null })),
  },
};

export default alien;
