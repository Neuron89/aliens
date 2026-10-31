/* ═══════════════════════════════════════════════════════════════════════
   GENERIC COMMERCIAL VESSEL — deck-plan GEOMETRY (JSX-free, node-importable).
   Single source for generic.jsx (MapEngine plan) and maps/index.js
   (normalized board rooms, doors, spawn). Canvas px, W×H.
   A reusable template hull for custom scenarios: a boxy mid-size
   freight/tow vessel, bow up. A narrow forward command module with a
   chamfered nose shoulders out into a broad aft cargo section, with a
   stepped-in engine block at the stern. Two decks:
     upper — COMMAND DECK (bridge, officers, computer core, galley, med bay,
             main corridor, airlock, gantry over the cargo well)
     lower — CARGO DECK (cryo, crew quarters, armory, storage, life support,
             cargo bay with docking port, engine room, lower corridor)
   A ladder on the spine and a freight lift at the aft gantry join them.
   ═══════════════════════════════════════════════════════════════════════ */
import { boardRooms, boardDoors, edge, normPath, pxPath, r4 } from './geometry.js';

export const W = 1100, H = 920;
export const CX = 560;

export const LEVELS = [
  { id: 'upper', label: 'COMMAND DECK', deck: 'A' },
  { id: 'lower', label: 'CARGO DECK', deck: 'B' },
];

/* Hull (px). Command module x 380–740 to y 380, shoulders out to the cargo
   section x 300–820 by y 420, engine block x 330–790 from y 770 to 842. */
export const HULL = {
  noseY: 108, noseL: 432, noseR: 688, modL: 380, modR: 740, chamY: 168,
  shY0: 380, shY1: 420, aftL: 300, aftR: 820, engY: 770, engL: 330, engR: 790, sternY: 842,
};
const h = HULL;
export const OUTLINE_PTS = [
  [h.noseL, h.noseY], [h.noseR, h.noseY], [h.modR, h.chamY], [h.modR, h.shY0], [h.aftR, h.shY1],
  [h.aftR, h.engY], [h.engR, h.engY], [h.engR, h.sternY], [h.engL, h.sternY], [h.engL, h.engY],
  [h.aftL, h.engY], [h.aftL, h.shY1], [h.modL, h.shY0], [h.modL, h.chamY],
];
export const OUTLINE = pxPath(OUTLINE_PTS);

const R = (id, name, level, x, y, w, hh, note, draw = {}) => ({ id, name, level, rect: { x, y, w, h: hh }, note, draw });

/* ─── Upper: COMMAND DECK ─────────────────────────────────────────────── */
const U = 'upper';
export const upperRooms = [
  R('bridge', 'Bridge', U, 446, 122, 228, 74, 'Flight deck under the forward viewports: pilot and co-pilot couches, the captain’s chair, comms and sensor stations. Ship-wide intercom, lockdown and the self-destruct key all live here.', { sub: 'HELM · COMMS · SENSORS', crew: true, shape: 'octagon', icons: ['terminal', 'alien-comms'] }),
  R('main-corridor', 'Main Corridor', U, 540, 196, 40, 408, 'The command-deck spine, bow to the cargo gantry. Every room on this deck opens onto it; the ladder to the cargo deck stands in it.', { kind: 'cor' }),
  R('computer-core', 'Computer Core', U, 394, 204, 146, 76, 'Cold, humming room of server stacks and a single interface terminal. Whoever controls this room controls the doors, the logs and what the ship tells its crew.', { sub: 'MAINFRAME · INTERFACE', icons: ['restricted', 'terminal'], pattern: 'hatch', labelSize: 5.6 }),
  R('officers-quarters', 'Officers Quarters', U, 394, 288, 146, 82, 'Two private cabins for the captain and executive officer, with lockable desks. A good place for sealed orders, a personal sidearm or a diary nobody was meant to read.', { sub: 'CAPTAIN · XO', crew: true, icons: ['alien-bed'], labelSize: 5.6 }),
  R('med-bay', 'Med Bay', U, 580, 204, 146, 166, 'Two-bed infirmary with an autodoc, a drug locker and a sealed specimen fridge. Quarantine protocol can lock it from the bridge.', { sub: 'AUTODOC · 2 BEDS', crew: true, icons: ['medkit', 'terminal'] }),
  R('galley', 'Galley', U, 312, 428, 228, 176, 'Mess table, food synthesiser, coffee machine and the only window on the ship worth sitting at. The crew spends its waking hours here; it is where arguments start.', { sub: 'MESS · RECREATION', crew: true, icons: ['intercom'] }),
  R('suit-lockers', 'Suit Lockers', U, 580, 428, 116, 58, 'Racked compression suits, helmets and mag-boots for EVA. A missing suit is the first sign someone went outside.', { sub: '6 SUITS', labelSize: 5 }),
  R('airlock-passage', 'Airlock Passage', U, 580, 486, 120, 34, 'Short passage from the spine to the airlock, between the suit lockers and the washroom.', { kind: 'cor' }),
  R('washroom', 'Washroom', U, 580, 520, 116, 84, 'Shower, toilet and a laundry press. Thin walls: you can hear the corridor from in here.', { crew: true, labelSize: 5.2 }),
  R('airlock', 'Airlock', U, 700, 460, 108, 86, 'Main starboard airlock: inner and outer doors, a cycle panel and a small window. It will not open both doors at once unless someone overrides it from the bridge.', { sub: 'EVA · BOARDING', icons: ['alien-airlock'], shape: 'octagon', labelSize: 5.6 }),
  R('cargo-gantry', 'Cargo Gantry', U, 312, 604, 496, 26, 'Catwalk along the forward edge of the cargo well, looking down into the cargo bay. The freight lift stands at its starboard end.', { kind: 'cor' }),
];

/* ─── Lower: CARGO DECK ───────────────────────────────────────────────── */
const L = 'lower';
export const lowerRooms = [
  R('cryo-chamber', 'Cryo Chamber', L, 446, 122, 228, 88, 'Hypersleep bay under the bridge: eight cryopods, a monitoring console and the wake-cycle medical cart. The first and last room the crew sees on any long haul.', { sub: '8 PODS', crew: true, shape: 'octagon', icons: ['cryopod', 'terminal'] }),
  R('lower-corridor', 'Lower Corridor', L, 540, 210, 40, 398, 'The cargo-deck spine, from cryo aft to the cargo bay. Dim strip lighting; the ladder up to the command deck stands in it.', { kind: 'cor' }),
  R('crew-quarters', 'Crew Quarters', L, 394, 218, 146, 152, 'Shared bunk room for the working crew: six bunks, footlockers and a pin-up board. Personal effects say a lot about who these people are.', { sub: '6 BUNKS · LOCKERS', crew: true, icons: ['alien-bed'] }),
  R('armory', 'Armory', L, 580, 218, 146, 152, 'Locked weapons store: a few sidearms, a flare gun, a bolt gun, cutting tools and a single rifle. The captain and the computer hold the codes.', { sub: 'LOCKED RACKS', icons: ['restricted', 'weapon'] }),
  R('storage', 'Storage', L, 312, 428, 228, 180, 'Ship’s stores: rations, spares, filters, coolant cells, rope and tarps. The shelving makes it a maze of blind corners.', { sub: 'STORES · SPARES' }),
  R('life-support', 'Life Support', L, 580, 428, 228, 180, 'Air scrubbers, water reclaimer and heat exchangers. Vent crawlways branch from here to every room on both decks.', { sub: 'AIR · WATER · HEAT', pattern: 'hatch', icons: ['alien-hazard'] }),
  R('docking-port', 'Docking Port', L, 312, 608, 80, 144, 'Port-side docking collar for shuttles, tugs and station umbilicals. A boarding party comes in here, straight into the cargo bay.', { sub: 'COLLAR', icons: ['alien-airlock'], labelSize: 5 }),
  R('cargo-bay', 'Cargo Bay', L, 392, 608, 416, 144, 'Two-deck-high hold under the gantry: container racks, a loader, tie-down rails and the freight lift. Plenty of cover, poor sight lines, and the lights run on motion sensors.', { sub: 'CONTAINERS · LOADER · LIFT' }),
  R('engine-room', 'Engine Room', L, 352, 752, 416, 78, 'Reactor housing, drive controls and coolant plumbing. Loud, hot and radioactive behind the shielding; the reactor can be overloaded from the control panel here.', { sub: 'REACTOR · DRIVE CONTROL', icons: ['alien-reactor', 'alien-hazard'] }),
];

export const genericRooms = [...upperRooms, ...lowerRooms];
const byId = Object.fromEntries(genericRooms.map((r) => [`${r.level}/${r.id}`, r]));
const rect = (level, id) => byId[`${level}/${id}`].rect;

/* Level connectors: `levels` lists where each is drawn, `labels` per level. */
export const STAIRS = [
  { level: 'both', levels: ['upper', 'lower'], x: CX, y: 300, type: 'ladder', label: 'LADDER',
    labels: { upper: 'LADDER ▼ B', lower: 'LADDER ▲ A' } },
  { level: 'both', levels: ['upper', 'lower'], x: 786, y: 617, type: 'elevator', label: 'FREIGHT LIFT',
    labels: { upper: 'FREIGHT LIFT ▼', lower: 'FREIGHT LIFT ▲' } },
];

const D = (level, from, to, side, t, locked = false, at = from) => ({ level, from, to, locked, ...edge(rect(level, at), side, t) });
export const genericDoors = [
  /* command deck */
  D(U, 'bridge', 'main-corridor', 's', 0.5),
  D(U, 'computer-core', 'main-corridor', 'e', 0.5, true),
  D(U, 'officers-quarters', 'main-corridor', 'e', 0.5),
  D(U, 'med-bay', 'main-corridor', 'w', 0.24),
  D(U, 'galley', 'main-corridor', 'e', 0.3),
  D(U, 'galley', 'cargo-gantry', 's', 0.5),
  D(U, 'suit-lockers', 'airlock-passage', 's', 0.5),
  D(U, 'washroom', 'airlock-passage', 'n', 0.5),
  D(U, 'airlock', 'airlock-passage', 'w', 0.5),
  /* cargo deck */
  D(L, 'cryo-chamber', 'lower-corridor', 's', 0.5),
  D(L, 'crew-quarters', 'lower-corridor', 'e', 0.3),
  D(L, 'armory', 'lower-corridor', 'w', 0.5, true),
  D(L, 'storage', 'lower-corridor', 'e', 0.3),
  D(L, 'storage', 'cargo-bay', 's', (470 - 312) / 228),
  D(L, 'life-support', 'lower-corridor', 'w', 0.3),
  D(L, 'cargo-bay', 'lower-corridor', 'n', (CX - 392) / 416),
  D(L, 'docking-port', 'cargo-bay', 'e', 0.5),
  D(L, 'engine-room', 'cargo-bay', 'n', 0.5),
];

/* Vent crawlways (drawn with <Vents>): a duct ring in the wall void. */
export const VENTS = {
  upper: [
    'M 387 200 L 387 374', 'M 733 200 L 733 374', 'M 387 200 L 733 200',
    'M 387 374 L 306 414 L 306 600', 'M 733 374 L 814 414 L 814 600',
  ],
  lower: [
    'M 387 214 L 387 374', 'M 733 214 L 733 374', 'M 387 214 L 733 214',
    'M 387 374 L 306 414 L 306 604', 'M 733 374 L 814 414 L 814 604',
    'M 346 836 L 774 836',
  ],
};
export const VENT_GRATES = {
  upper: [[387, 242], [387, 330], [733, 260], [470, 200], [650, 200], [306, 500], [814, 440], [814, 580]],
  lower: [[387, 270], [733, 300], [470, 214], [650, 214], [306, 500], [814, 470], [460, 836], [680, 836]],
};

/* ─── Board data (normalized) ──────────────────────────────────────────── */
export const genericBoardRooms = boardRooms(
  genericRooms.map((r) => ({ ...r, id: `${r.level}-${r.id}` })), W, H,
);
export const genericBoardDoors = boardDoors(
  genericDoors.map((d) => ({ ...d, from: `${d.level}-${d.from}`, to: `${d.level}-${d.to}` })), W, H,
);
export const genericOutline = normPath(OUTLINE_PTS, W, H);
export const genericCrop = { x: r4(240 / W), y: r4(78 / H), w: r4(640 / W), h: r4(812 / H) };
export const genericSpawn = {
  pc: [r4(754 / W), r4(503 / H)],
  levels: {
    upper: { pc: [r4(754 / W), r4(503 / H)] },
    lower: { pc: [r4(CX / W), r4(328 / H)] },
  },
};
