/* ═══════════════════════════════════════════════════════════════════════
   KESSLER’S LANDING — HUB — GEOMETRY (JSX-free, node-importable).
   Single source for kesslers.jsx (MapEngine plan) and maps/index.js
   (normalized board rooms, doors, spawn). Canvas px, W×H. One level.

   An independent mining colony on the terminator band of tidally locked
   Varrow IV: the night side (storms) lies west, the day side (glare) east;
   the dusk line runs north–south between the processor and the admin
   block. The "hull" outline is the colony perimeter. Buildings are walled
   rooms; covered streets and heated tubes are corridors; the hab yard, the
   landing field, the fuel farm and the Seam 9 adit are zones the plan
   draws itself. Schematic: distances are labelled, not to scale.
   ═══════════════════════════════════════════════════════════════════════ */
import { boardRooms, boardDoors, edge, normPath, pxPath, r4 } from './geometry.js';

export const W = 1100, H = 920;
export const LEVELS = [{ id: 'hub', label: 'HUB', deck: 'H' }];

/* The colony perimeter: a ragged fence line, notched under the legend. */
export const OUTLINE_PTS = [
  [214, 112], [330, 104], [470, 108], [610, 101], [750, 106], [884, 112],
  [890, 220], [886, 340], [960, 343], [1008, 348], [1012, 450], [1006, 560],
  [1012, 680], [1006, 800], [994, 852], [880, 858], [760, 852], [640, 860],
  [520, 853], [400, 860], [290, 854], [216, 848], [210, 740], [214, 620],
  [208, 500], [214, 380], [208, 260], [212, 170],
];
export const OUTLINE = pxPath(OUTLINE_PTS);

const L = 'hub';
const R = (id, name, x, y, w, h, note, draw = {}) => ({ id, name, level: L, rect: { x, y, w, h }, note, draw });
const C = (id, name, x, y, w, h, note) => R(id, name, x, y, w, h, note, { kind: 'cor' });
const Z = (id, name, x, y, w, h, note, draw = {}) => R(id, name, x, y, w, h, note, { kind: 'zone', ...draw });

export const kesslersRooms = [
  /* ── night side (west): the mine, the processor, the homes ── */
  Z('seam-9-drift', 'Seam 9 Drift', 222, 315, 78, 80, 'Two kilometres of warm, wet drift; the dump site and egg sacs at its end.'),
  R('ore-processor', 'Ore Processor', 300, 170, 160, 300, 'Smelter, power plant and the cage lift down to Seam 9.',
    { sub: 'SMELTER · POWER · CAGE LIFT', pattern: 'hatch', icons: ['alien-reactor', 'alien-hazard'] }),
  Z('hab-stacks', 'Hab Stacks A–D', 300, 490, 160, 240, 'Homes for most of the colony. Duct junction behind Stack B where Pell leaves food.'),
  R('chapel', 'Chapel of the Long Night', 370, 730, 90, 80, 'Converted ore bunker in Stack D; undercroft trapdoor hides Arlo Lowe.',
    { sub: 'UNDERCROFT', crew: true, icons: ['alien-fire'], labelSize: 4.6 }),

  /* ── the admin block (storm-rated) ── */
  R('ops-center', 'Admin Block — Ops Center', 500, 140, 120, 86, 'Bellwether rack, tracker console, comms panel with the Probity channel. Command post during the siege.',
    { sub: 'BELLWETHER · COMMS', crew: true, icons: ['terminal', 'alien-comms'], labelSize: 5.4 }),
  R('uplink-mast', 'Admin Block — Uplink Mast', 620, 140, 100, 86, 'Thirty-metre mast and dish on the roof, reached through a hatch. Open-band broadcast to the whole system.',
    { sub: 'ROOF HATCH', icons: ['kesslers-dish'], labelSize: 4.8 }),
  C('admin-hall', 'Admin Hall', 500, 226, 220, 18, 'The block’s spine: ops, mast hatch, brig and shelter all open off it.'),
  R('brig', 'Admin Block — Brig', 500, 244, 76, 90, 'Four cells. Lockdown puts Soll and the hardliners here.',
    { sub: '4 CELLS', icons: ['restricted'], labelSize: 4.8 }),
  R('shelter', 'Admin Block — Hardened Shelter', 604, 244, 116, 90, 'Rated for forty, holds two hundred in Act III. Last fallback.',
    { sub: 'RATED 40', crew: true, icons: ['alien-hazard'], labelSize: 4.6 }),

  /* ── tubes and covered streets ── */
  C('ore-tube', 'Ore Tube', 460, 180, 40, 18, 'Heated tube from the processor floor to the admin block.'),
  C('pad-tube', 'Pad Tube', 720, 226, 40, 18, 'Heated tube from the admin block to the pad tower. Floods with meltwater when the heaters fail.'),
  C('concourse', 'Main Concourse', 576, 244, 28, 226, 'Heated, three hundred metres, the colony’s high street. Rumours, graffiti and the queue for the clinic.'),
  C('main-street', 'Main Street', 300, 470, 440, 20, 'Covered street from the processor and the hab stacks to the pad gate.'),
  C('low-street', 'Low Street', 460, 690, 300, 18, 'Covered back street: hab stacks, morgue door, pump house, the Sundowner and the union hall.'),

  /* ── the clinic ── */
  R('ward-lab', 'Clinic — Ward and Lab', 500, 490, 130, 110, 'Twelve beds, centrifuge, the Doctor’s samples. Varnaby recovers here.',
    { sub: '12 BEDS · LAB', crew: true, icons: ['medkit', 'terminal'], labelSize: 5.6 }),
  R('wing-c', 'Clinic — Wing C', 630, 496, 70, 104, 'Chained and sealed. One burst patient, one empty pod, a drain scraped open from below.',
    { sub: 'SEALED', icons: ['restricted', 'alien-xeno'], labelSize: 4.6 }),
  R('morgue', 'Clinic — Morgue', 500, 600, 80, 90, 'Ceiling tiles loose. Entry point in Clinic Breach.',
    { sub: 'CEILING LOOSE', icons: ['cryopod'], labelSize: 4.8 }),

  /* ── day side (east): the hall, the bar, the landing field ── */
  R('union-hall', 'Union Hall', 760, 640, 190, 150, 'Local 31 hall: bar, pallet stage, strike fund. Riot headquarters.',
    { sub: 'LOCAL 31 · STRIKE FUND', crew: true, icons: ['alien-fire'] }),
  R('sundowner', 'The Sundowner', 590, 708, 110, 78, 'Miners’ bar named for a sunset nobody here has ever seen. Still serving under quarantine.',
    { sub: 'BAR', crew: true, labelSize: 5.4 }),
  R('pump-house', 'Pump House', 470, 708, 90, 62, 'Ice-melt pumps and the colony water filters. Warm, loud and full of pipe runs.',
    { sub: 'MELT PUMPS', pattern: 'grating', icons: ['alien-water'], labelSize: 5 }),
  R('water-tower', 'Water Tower', 485, 770, 60, 60, 'Insulated tank on stilts; the ladder cage gives a view over the whole hub.',
    { shape: 'circle', labelSize: 4.4 }),
  Z('fuel-tower', 'Landing Pad — Fuel Farm and Tower', 760, 140, 120, 200, 'Fuel gantry, tape logs, the Hale manifest; the Probity paints this area with targeting radar.'),
  Z('pads', 'Landing Pad — Pads 1 and 2', 740, 340, 265, 280, 'Pad 1 empty since the Hale left. Wren\'s Due on Pad 2.'),
];

const byId = Object.fromEntries(kesslersRooms.map((r) => [r.id, r]));
const rect = (id) => byId[id].rect;
const D = (from, to, side, t, locked = false, at = from) => ({ level: L, from, to, locked, ...edge(rect(at), side, t) });
const ty = (id, y) => (y - rect(id).y) / rect(id).h;   // t for a door at canvas y on a w/e edge
const tx = (id, x) => (x - rect(id).x) / rect(id).w;   // t for a door at canvas x on an n/s edge

/* Building doors (drawn as wall gaps). */
export const BUILDING_DOORS = [
  D('ore-processor', 'ore-tube', 'e', ty('ore-processor', 189)),
  D('ops-center', 'ore-tube', 'w', ty('ops-center', 189)),
  D('ops-center', 'admin-hall', 's', 0.5),
  D('uplink-mast', 'admin-hall', 's', 0.25),
  D('brig', 'concourse', 'e', 0.3),
  D('shelter', 'concourse', 'w', 0.3),
  D('shelter', 'admin-hall', 'n', 0.6),
  D('ore-processor', 'main-street', 's', 0.62),
  D('hab-stacks', 'main-street', 'n', 0.5),
  D('ward-lab', 'main-street', 'n', tx('ward-lab', 590)),
  D('ward-lab', 'wing-c', 'e', 0.5, true),               // chained from the outside
  D('ward-lab', 'morgue', 's', 0.3),
  D('morgue', 'low-street', 's', 0.5),
  D('hab-stacks', 'low-street', 'e', ty('hab-stacks', 699)),
  D('chapel', 'hab-stacks', 'n', tx('chapel', 421)),
  D('union-hall', 'low-street', 'w', ty('union-hall', 699)),
  D('sundowner', 'low-street', 'n', 0.5),
  D('pump-house', 'low-street', 'n', 0.5),
  D('water-tower', 'pump-house', 'n', 0.5),
  D('fuel-tower', 'pad-tube', 'w', ty('fuel-tower', 235)),
  D('main-street', 'pads', 'e', 0.5),                     // the pad gate
  D('ore-processor', 'seam-9-drift', 'w', ty('ore-processor', 355), true), // drift sealed
];

/* Open-ground transitions between zones (board connectivity; drawn as paths). */
export const GROUND_LINKS = [
  D('fuel-tower', 'pads', 's', tx('fuel-tower', 808)),    // tower stair down to the apron
];

export const kesslersDoors = [...BUILDING_DOORS, ...GROUND_LINKS];
export const STAIRS = [];

/* Landmarks (px). */
export const PAD1 = { x: 822, y: 414, r: 44 };
export const PAD2 = { x: 924, y: 528, r: 56 };
export const GATE = { x: 740, y: 480 };
export const ADIT = { x: 300, y: 355 };
export const DUSK = [[486, 101], [480, 220], [488, 340], [478, 470], [484, 600], [480, 700], [490, 860]];

/* ─── Board data (normalized) ─── */
export const kesslersBoardRooms = boardRooms(kesslersRooms, W, H);
export const kesslersBoardDoors = boardDoors(kesslersDoors, W, H);
export const kesslersOutline = normPath(OUTLINE_PTS, W, H);
export const kesslersCrop = { x: r4(198 / W), y: r4(92 / H), w: r4(828 / W), h: r4(780 / H) };
const SPAWN = [r4(872 / W), r4(470 / H)];
export const kesslersSpawn = { pc: SPAWN, levels: { hub: { pc: SPAWN } } };
