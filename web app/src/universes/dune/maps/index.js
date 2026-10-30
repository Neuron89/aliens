/* Universe-level maps for DUNE (data only, no JSX).
   Entries here are always available in the Maps tab. The bundled scenario
   "The Water Debt" re-uses 'qarrat-keep' (same id) as its pack map.
   Engine maps carry board data per docs/BOARD_AND_BUILDER.md §3 (kind,
   size, levels, normalized rooms, doors, outline, crop, spawn); ../index.js
   attaches the MapEngine component as `engine`. Image maps carry rooms
   drawn over the illustration in normalized coordinates. */
import * as RES from './residency.geometry.js';
import * as SIE from './sietch.geometry.js';
import { imageMaps } from './imageMaps.js';

export const QARRAT_KEEP_ASCII = `
  ╔══════════════════════════════════════════════════════════════╗
  ║        QARRAT KEEP — GROUND FLOOR   (House Tessarin)         ║
  ║        Shield Wall edge, Arrakis · north is up               ║
  ╠══════════════════════════════════════════════════════════════╣
  ║                                                              ║
  ║   ┌──────────────┐   ┌──────────────────┐   ┌─────────────┐  ║
  ║   │ THOPTER PAD  │   │  GREAT HALL      │   │  STEWARD'S  │  ║
  ║   │ (roof ramp)  │   │  [dais] [hearth] │   │  COUNTING   │  ║
  ║   │   ▲ ramp     │   │  audience floor  │   │  ROOM       │  ║
  ║   └──────┬───────┘   └────────┬─────────┘   │  [ledgers]  │  ║
  ║          │                    │             └──────┬──────┘  ║
  ║   ┌──────┴────────────────────┴────────────────────┴──────┐  ║
  ║   │            COLONNADE  (shield-door every 10 m)        │  ║
  ║   └──┬─────────────┬───────────────┬──────────────────┬───┘  ║
  ║      │             │               │                  │      ║
  ║   ┌──┴────────┐ ┌──┴──────────┐ ┌──┴───────────┐  ┌───┴───┐  ║
  ║   │ GUARD     │ │ CONSERVATORY│ │ KITCHENS &   │  │ GUEST │  ║
  ║   │ ROOM      │ │ (date palms,│ │ SERVANTS'    │  │ WING  │  ║
  ║   │ [armory]  │ │  dew traps) │ │ STAIR  ▼     │  │ (3 rm)│  ║
  ║   └──┬────────┘ └─────────────┘ └──────┬───────┘  └───────┘  ║
  ║      │                                 │                     ║
  ║   ┌──┴──────────────┐          ┌───────┴───────────────┐     ║
  ║   │ OUTER GATE      │          │ CISTERN VAULT (below) │     ║
  ║   │ (sand-lock, two │          │ ~~~~~~~~~~~~~~~~~~~~~ │     ║
  ║   │  doors, seal)   │          │ ~ town water: 41,000 L│     ║
  ║   └──┬──────────────┘          │ ~~~~~~~~~~~~~~~~~~~~~ │     ║
  ║      │                         └───────────────────────┘     ║
  ║   ═══╧═══ to QARRAT TOWN and the spice-yard                  ║
  ║                                                              ║
  ╚══════════════════════════════════════════════════════════════╝`;

export const SIETCH_ASCII = `
  ╔══════════════════════════════════════════════════════════════╗
  ║        A SIETCH OF THE DEEP DESERT — CUTAWAY (generic)       ║
  ╠══════════════════════════════════════════════════════════════╣
  ║   open sand  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    ║
  ║   ▓▓▓▓▓▓▓▓▓▓[hidden entrance]▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓    ║
  ║   ▓▓  │ door-seals (moisture lock)                     ▓▓    ║
  ║   ▓▓  ├── WATCH GALLERY ── lookouts, thumper store     ▓▓    ║
  ║   ▓▓  │                                                ▓▓    ║
  ║   ▓▓  ├── MEETING CAVERN ── council ledge, rock seats  ▓▓    ║
  ║   ▓▓  │        │                                       ▓▓    ║
  ║   ▓▓  │        ├── SAYYADINA'S CHAMBER                 ▓▓    ║
  ║   ▓▓  │        └── WORKSHOPS (stillsuits, crysknives)  ▓▓    ║
  ║   ▓▓  ├── LIVINGWARRENS ── family alcoves, hangings    ▓▓    ║
  ║   ▓▓  └── DEATHSTILL ── water of the dead reclaimed    ▓▓    ║
  ║   ▓▓            │                                      ▓▓    ║
  ║   ▓▓        ┌───┴──────────────────────┐               ▓▓    ║
  ║   ▓▓        │  WATER CATCHBASIN (sealed)│              ▓▓    ║
  ║   ▓▓        └──────────────────────────┘               ▓▓    ║
  ╚══════════════════════════════════════════════════════════════╝`;

export const maps = [
  {
    id: 'arrakeen-residency',
    title: 'ARRAKEEN RESIDENCY',
    subtitle: 'Ground floor & roof — the governor’s house',
    scenario: 'General',
    description: 'A fortified desert palace: great hall, dining hall, conservatory, guest wing, kitchens, water stores, shield-generator room, servant passages and a roof ornithopter pad.',
    engine: 'arrakeen-residency',
    kind: 'engine',
    size: [RES.W, RES.H],
    levels: RES.LEVELS.map(({ id, label }) => ({ id, label })),
    rooms: RES.residencyBoardRooms,
    doors: RES.residencyBoardDoors,
    outline: RES.residencyOutline,
    crop: RES.residencyCrop,
    spawn: RES.residencySpawn,
    grid: 1 / 50,
    levelNoun: "FLOOR",
    backdrop: "sand",
  },
  {
    id: 'sietch-qarrat',
    title: 'SIETCH QARRAT',
    subtitle: 'Fremen cave community under the Shield Wall',
    scenario: 'General',
    description: 'Hidden entrance cavern, doorseal, windtrap, council chamber, sleeping galleries, workshops, deathstill, the water cache and the worm-entry tunnel to the open sand.',
    engine: 'sietch-qarrat',
    kind: 'engine',
    size: [SIE.W, SIE.H],
    levels: SIE.LEVELS.map(({ id, label }) => ({ id, label })),
    rooms: SIE.sietchBoardRooms,
    doors: SIE.sietchBoardDoors,
    outline: SIE.sietchOutline,
    crop: SIE.sietchCrop,
    spawn: SIE.sietchSpawn,
    grid: 1 / 50,
    levelNoun: "LEVEL",
    backdrop: "sand",
  },
  ...imageMaps,
  {
    id: 'qarrat-keep',
    title: 'QARRAT KEEP',
    subtitle: 'House Tessarin seat — ground floor',
    scenario: 'The Water Debt',
    description: 'A modest rock-and-plasteel keep on the Shield Wall edge. Its cistern vault holds the town’s water reserve and is the true heart of the House.',
    ascii: QARRAT_KEEP_ASCII,
    levelNoun: "FLOOR",
    backdrop: "none",
    rooms: [
      { name: 'Great Hall', note: 'Audience chamber with a raised dais. Where the Assessor will be received in Act III.' },
      { name: "Steward's Counting Room", note: 'Ledgers, spice tallies and water accounts. A second, hidden ledger sits behind a loose wall panel.' },
      { name: 'Colonnade', note: 'The keep’s spine; every room opens onto it. Shield-doors can seal any section.' },
      { name: 'Thopter Pad', note: 'Roof landing reached by a ramp. One serviceable ornithopter and one that is not.' },
      { name: 'Guard Room', note: 'Armory and duty roster. The roster for the night of the murder has a forged entry.' },
      { name: 'Conservatory', note: 'Date palms and dew traps — an extravagant show of water wealth for guests.' },
      { name: "Kitchens & Servants' Stair", note: 'The only internal route down to the cistern that avoids the guard room.' },
      { name: 'Guest Wing', note: 'Three rooms. The Fremen envoy refuses to sleep here; the Assessor will demand the best one.' },
      { name: 'Cistern Vault', note: 'Below the kitchens. Forty-one thousand litres of town water. The drowned man was found here.' },
      { name: 'Outer Gate', note: 'Double-door sand-lock with a water-seal. Logs every opening — or should.' },
    ],
  },
  {
    id: 'sietch-cutaway',
    title: 'SIETCH CUTAWAY',
    subtitle: 'Generic deep-desert sietch',
    scenario: 'Custom',
    description: 'A template for any Fremen sietch: hidden entrance, moisture-sealed passages, council cavern and the deathstill where the water of the dead is reclaimed.',
    ascii: SIETCH_ASCII,
    levelNoun: "LEVEL",
    backdrop: "none",
    rooms: [
      { name: 'Hidden Entrance', note: 'Concealed in rock; outsiders brought here blindfolded.' },
      { name: 'Watch Gallery', note: 'Lookouts and thumpers. Anyone approaching is seen long before they arrive.' },
      { name: 'Meeting Cavern', note: 'Council and judgment. Duels for leadership are fought here.' },
      { name: "Sayyadina's Chamber", note: 'The sietch’s religious authority. Visitors are tested here.' },
      { name: 'Workshops', note: 'Stillsuits, crysknives, maker hooks and dew collectors.' },
      { name: 'Living Warrens', note: 'Family alcoves separated by hangings.' },
      { name: 'Deathstill', note: 'Where the water of the dead is reclaimed for the tribe.' },
      { name: 'Water Catchbasin', note: 'The sietch’s hoard. Showing it to an outsider is the highest trust.' },
    ],
  },
];

export default maps;
