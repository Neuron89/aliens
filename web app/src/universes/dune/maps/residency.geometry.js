/* ═══════════════════════════════════════════════════════════════════════
   ARRAKEEN RESIDENCY — floor-plan GEOMETRY (JSX-free, node-importable).
   Single source for residency.jsx (MapEngine plan) and maps/index.js
   (normalized board rooms, doors, spawn). Canvas px, W×H.
   Two levels: ground floor and roof.
   ═══════════════════════════════════════════════════════════════════════ */
import { boardRooms, boardDoors, edge, normPath, pxPath, r4 } from './geometry.js';

export const W = 1100, H = 920;

/* Column grid (px). West wing | west passage | centre | east passage | east wing */
const WX = 226, WW = 148;           // west wing 226–374
const WPX = 378, PW = 18;           // west servant passage 378–396
const CX0 = 400, CW = 260;          // centre 400–660
const EPX = 664;                    // east servant passage 664–682
const EX = 686, EW = 148;           // east wing 686–834
const TOP = 130, TOP_H = 150;       // top row 130–280
const COL_Y = 288, COL_H = 22;      // colonnade 288–310
const MID = 318, BOT = 700;         // lower block 318–700

/* Building outline incl. the walled forecourt (px). */
export const OUTLINE_PTS = [
  [226, 118], [834, 118], [846, 130], [846, 700], [834, 712],
  [668, 712], [668, 800], [656, 812], [404, 812], [392, 800], [392, 712],
  [226, 712], [214, 700], [214, 130],
];
export const OUTLINE = pxPath(OUTLINE_PTS);

export const LEVELS = [
  { id: 'ground', label: 'GROUND FLOOR', deck: 'G' },
  { id: 'roof', label: 'ROOF', deck: 'R' },
];

const R = (id, name, level, x, y, w, h, note, draw = {}) => ({ id, name, level, rect: { x, y, w, h }, note, draw });

/* ─── Ground floor ─────────────────────────────────────────────────────── */
const G = 'ground';
export const groundRooms = [
  R('guest-wing', 'Guest Wing', G, WX, TOP, WW, TOP_H, 'Three suites for visiting dignitaries. The best one overlooks the conservatory; the worst shares a wall with the hidden passage.', { sub: '3 SUITES', crew: true, icons: ['dune-bed'] }),
  R('conservatory', 'Conservatory', G, CX0, TOP, CW, TOP_H, 'Date palms, fountains and dew-traps under a glass dome: an open boast of water wealth. Visitors from the desert find it obscene.', { sub: 'DATE PALMS · FOUNTAIN', icons: ['dune-palm', 'dune-water'], shape: 'octagon', fill: 'garden' }),
  R('private-apartments', 'Private Apartments', G, EX, TOP, EW, TOP_H, 'The ruling family’s rooms. A Bene Gesserit could hear a whisper here from the next room.', { sub: 'FAMILY', crew: true, icons: ['dune-bed'] }),
  R('colonnade', 'Colonnade', G, WX, COL_Y, EX + EW - WX, COL_H, 'The residency’s spine. Every wing opens onto it; guards walk it every quarter hour.', { kind: 'cor' }),
  R('dining-hall', 'Dining Hall', G, WX, MID, WW, 142, 'A long table for twenty, a poison snooper above every place. Seating order is politics.', { sub: 'TABLE FOR 20', crew: true, icons: ['dune-snooper'] }),
  R('dukes-study', 'Duke’s Study', G, WX, 468, WW, 112, 'Maps, ledgers and a desk with a hidden compartment. Only the family and the Mentat may enter.', { sub: 'MAPS · LEDGERS', crew: true, icons: ['restricted'] }),
  R('guard-room', 'Guard Room & Armory', G, WX, 588, WW, 112, 'Duty roster, weapon racks and the shield-belt charging rack. Locked at night.', { sub: 'ARMORY', icons: ['weapon', 'dune-shield'] }),
  R('west-passage', 'West Servant Passage', G, WPX, MID, PW, BOT - MID, 'A hidden passage inside the wall between the dining hall and the great hall. Not on the official plans.', { kind: 'passage' }),
  R('great-hall', 'Great Hall', G, CX0, MID, CW, 242, 'Audience chamber with a raised dais and a bull’s-head trophy above the hearth. Petitions, banquets and executions happen here.', { sub: 'DAIS · HEARTH', icons: ['dune-banner'], shape: 'octagon', crew: true }),
  R('gate-guard', 'Gate Guard Post', G, CX0, 568, 66, 132, 'Two guards, an alarm cord and the gate log.', { labelSize: 4.6 }),
  R('entry-hall', 'Entry Hall', G, 474, 568, 112, 132, 'High doors from the forecourt. Visitors wait here under watch until they are announced.', { sub: 'ANNOUNCEMENT', crew: true }),
  R('doorseal', 'Doorseal', G, 594, 568, 66, 132, 'A moisture lock: two doors, never open at once. Desert air is wet-stripped here.', { labelSize: 4.6, icons: ['dune-water'] }),
  R('east-passage', 'East Servant Passage', G, EPX, MID, PW, BOT - MID, 'The servants’ route from the kitchens to the great hall and the apartments. Food, gossip and assassins travel it.', { kind: 'passage' }),
  R('kitchens', 'Kitchens', G, EX, MID, EW, 142, 'Ovens, cold stores and the servants’ stair to the roof. The cook knows everything that happens in the house.', { sub: 'SERVANTS’ STAIR', icons: ['dune-fire'] }),
  R('water-stores', 'Water Stores', G, EX, 468, EW, 112, 'Sealed cisterns of household water, metered and logged. A theft here is a capital crime.', { sub: 'CISTERNS', icons: ['dune-water', 'restricted'], pattern: 'hatch' }),
  R('shield-generator', 'Shield-Generator Room', G, EX, 588, EW, 112, 'Generator for the house shield. Shut it down and the residency is open to lasguns and ornithopters.', { sub: 'HOUSE SHIELD', icons: ['dune-shield', 'restricted'], pattern: 'hatch' }),
  R('forecourt', 'Forecourt', G, 404, 712, 252, 92, 'Walled paved court before the gate. Ground vehicles stop here; petitioners queue in the heat.', { sub: 'OPEN AIR', fill: 'sand' }),
];

/* ─── Roof ─────────────────────────────────────────────────────────────── */
const RF = 'roof';
export const roofRooms = [
  R('roof-terrace', 'West Roof Terrace', RF, WX, TOP, WW, 330, 'Shaded terrace with a view over Arrakeen. Good for private talks; bad for sniper cover.', { sub: 'SHADE SAILS', crew: true }),
  R('conservatory-dome', 'Conservatory Dome', RF, CX0, TOP, CW, TOP_H, 'The glass dome over the conservatory. Walkable along the ribs only; a fall is twelve metres.', { sub: 'GLASS — RIBS ONLY', shape: 'octagon', fill: 'glass' }),
  R('windtrap', 'Windtrap Tower', RF, EX, TOP, EW, TOP_H, 'The residency’s windtrap: fins and condensers feeding the water stores below.', { sub: 'CONDENSERS', icons: ['dune-water'], pattern: 'hatch' }),
  R('roof-walk', 'Roof Walk', RF, WPX, COL_Y, EX + EW - WPX, COL_H, 'Parapet walk linking every part of the roof. Guards patrol it at dusk and dawn.', { kind: 'cor' }),
  R('thopter-pad', 'Ornithopter Pad', RF, 420, 330, 220, 220, 'Landing pad over the great hall. Room for two ornithopters wing to wing.', { sub: 'LANDING CIRCLE', shape: 'circle', icons: ['dune-thopter'] }),
  R('hangar', 'Thopter Hangar', RF, EX, MID, EW, 262, 'A shed for one ornithopter, fuel and spare wing-membranes. The mechanic sleeps here.', { sub: 'FUEL · SPARES', icons: ['dune-thopter'], pattern: 'hatch' }),
  R('lookout', 'Lookout Post', RF, WX, 588, WW, 112, 'A sandbagged watch post facing the city and the Shield Wall.', { sub: 'WATCH', icons: ['dune-eye'] }),
  R('shield-pylon', 'Shield Pylon', RF, EX, 588, EW, 112, 'Emitter mast for the house shield. Climbing it with the shield up will kill you.', { sub: 'EMITTER', icons: ['dune-shield', 'restricted'] }),
  R('parapet-south', 'South Parapet', RF, CX0, 568, CW, 132, 'Parapet over the entry hall, looking down on the forecourt.', { sub: 'OVER THE GATE' }),
];

export const residencyRooms = [...groundRooms, ...roofRooms];
const byId = Object.fromEntries(residencyRooms.map((r) => [`${r.level}/${r.id}`, r]));
const rect = (level, id) => byId[`${level}/${id}`].rect;

/* Stairs connect the two levels at the same position. */
export const STAIRS = [
  { level: 'both', x: 530, y: COL_Y + COL_H / 2, type: 'ladder', label: 'GRAND STAIR' },
  { level: 'both', x: 812, y: 340, type: 'ladder', label: 'SERVANTS’ STAIR' },
];

const D = (level, from, to, side, t, locked = false, at = from) => ({ level, from, to, locked, ...edge(rect(level, at), side, t) });
export const residencyDoors = [
  D(G, 'guest-wing', 'colonnade', 's', 0.5),
  D(G, 'conservatory', 'colonnade', 's', 0.3), D(G, 'conservatory', 'colonnade', 's', 0.7),
  D(G, 'private-apartments', 'colonnade', 's', 0.5, true),
  D(G, 'dining-hall', 'colonnade', 'n', 0.5),
  D(G, 'great-hall', 'colonnade', 'n', 0.5),
  D(G, 'kitchens', 'colonnade', 'n', 0.4),
  D(G, 'dining-hall', 'dukes-study', 's', 0.5),
  D(G, 'dukes-study', 'guard-room', 's', 0.5, true),
  D(G, 'dining-hall', 'west-passage', 'e', 0.7, true),
  D(G, 'great-hall', 'west-passage', 'w', 0.4, true),
  D(G, 'great-hall', 'east-passage', 'e', 0.4),
  D(G, 'kitchens', 'east-passage', 'w', 0.6),
  D(G, 'water-stores', 'east-passage', 'w', 0.5, true),
  D(G, 'kitchens', 'water-stores', 's', 0.5, true),
  D(G, 'water-stores', 'shield-generator', 's', 0.5, true),
  D(G, 'great-hall', 'entry-hall', 's', 0.5),
  D(G, 'entry-hall', 'gate-guard', 'w', 0.5),
  D(G, 'entry-hall', 'doorseal', 'e', 0.5),
  D(G, 'doorseal', 'forecourt', 's', 0.5),
  D(G, 'guard-room', 'west-passage', 'e', 0.5, true),
  D(RF, 'roof-terrace', 'roof-walk', 'e', 0.52),
  D(RF, 'conservatory-dome', 'roof-walk', 's', 0.5),
  D(RF, 'windtrap', 'roof-walk', 's', 0.5),
  D(RF, 'hangar', 'roof-walk', 'n', 0.5),
  D(RF, 'thopter-pad', 'roof-walk', 'n', 0.5),
  D(RF, 'thopter-pad', 'hangar', 'e', 0.5),
  D(RF, 'lookout', 'roof-terrace', 'n', 0.5),
  D(RF, 'shield-pylon', 'hangar', 'n', 0.5, true),
  D(RF, 'parapet-south', 'thopter-pad', 'n', 0.5),
];

/* ─── Board data (normalized) ──────────────────────────────────────────── */
export const residencyBoardRooms = boardRooms(
  residencyRooms.map((r) => ({ ...r, id: `${r.level}-${r.id}` })), W, H,
);
export const residencyBoardDoors = boardDoors(
  residencyDoors.map((d) => ({ ...d, from: `${d.level}-${d.from}`, to: `${d.level}-${d.to}` })), W, H,
);
export const residencyOutline = normPath(OUTLINE_PTS, W, H);
export const residencyCrop = { x: r4(190 / W), y: r4(95 / H), w: r4(680 / W), h: r4(740 / H) };
export const residencySpawn = {
  pc: [r4(530 / W), r4(760 / H)],
  levels: {
    ground: { pc: [r4(530 / W), r4(760 / H)] },
    roof: { pc: [r4(530 / W), r4(299 / H)] },
  },
};
