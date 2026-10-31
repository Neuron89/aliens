/* ═══════════════════════════════════════════════════════════════════════
   USCSS CRONUS — deck-plan GEOMETRY (JSX-free, node-importable).
   Single source for cronus.jsx (MapEngine plan) and maps/index.js
   (normalized board rooms, doors, spawn). Canvas px, W×H.
   Two levels: MAIN DECK (bridge, labs, crew spaces, docking airlock) and
   the LOWER DECKS (the nest, cargo, engineering, reactor). A blunt, wide
   research hull, bow up, with a forward sensor boom and a broad aft
   engineering block. The decks join at the Lower Deck Access ladder and
   at the service lift between the scrubber plant and engineering.
   ═══════════════════════════════════════════════════════════════════════ */
import { boardRooms, boardDoors, edge, normPath, pxPath, r4 } from './geometry.js';

export const W = 1100, H = 920;
export const CX = 550;

export const LEVELS = [
  { id: 'main', label: 'MAIN DECK', deck: 'A' },
  { id: 'lower', label: 'LOWER DECKS', deck: 'B' },
];

/* Hull: blunt bow (y 104), straight flanks (x 300–800), aft engineering
   block widening at y 700, chamfered stern at y 846. */
export const OUTLINE_PTS = [
  [470, 104], [630, 104], [700, 122], [760, 158], [796, 212], [800, 250],
  [800, 692], [838, 704], [840, 818], [812, 846],
  [288, 846], [260, 818], [262, 704], [300, 692],
  [300, 250], [304, 212], [340, 158], [400, 122],
];
export const OUTLINE = pxPath(OUTLINE_PTS);

const R = (id, name, level, x, y, w, h, note, draw = {}) => ({ id, name, level, rect: { x, y, w, h }, note, draw });

/* ─── Main deck ────────────────────────────────────────────────────────── */
const M = 'main';
export const mainRooms = [
  R('bridge', 'Bridge', M, 450, 128, 200, 100,
    'Partially overgrown with organic resin. Emergency power only. Navigation logs may be recoverable from the damaged console. Signs of a violent last stand — bullet holes, acid scoring.',
    { sub: 'EMERGENCY POWER', shape: 'octagon', crew: true, icons: ['terminal', 'alien-hazard'] }),
  R('main-corridor', 'Main Corridor', M, 528, 228, 44, 384,
    "The ship's central artery. Organic growth covers 60% of surfaces — dark, ribbed resin that glistens in the emergency lighting. Temperature and humidity are anomalously high.",
    { kind: 'cor' }),
  R('science-lab', 'Science Lab / Containment', M, 330, 228, 198, 160,
    'Primary research area. Containment pods line the walls — most shattered from the inside. Lab equipment scattered. Research data terminals may still function. Heavy organic growth.',
    { sub: 'SPECIMEN CELLS', icons: ['restricted', 'alien-xeno', 'terminal'], labelSize: 6 }),
  R('crew-quarters', 'Crew Quarters', M, 330, 396, 198, 104,
    'SEALED. Someone welded the doors shut from the outside. Banging can sometimes be heard from within. Opening this is inadvisable.',
    { sub: 'WELDED SHUT', crew: true, icons: ['restricted', 'alien-bed'] }),
  R('comms-array', 'Comms Array', M, 330, 508, 198, 92,
    'Still broadcasting the distress signal on loop. The only fully functional system on the ship. Someone kept it running. The question is: who? And why?',
    { sub: 'BEACON ACTIVE', icons: ['alien-comms', 'terminal'] }),
  R('medical-bay', 'Medical Bay', M, 572, 228, 198, 120,
    'Wrecked. Equipment overturned. Old bloodstains. Something happened here — fast and violent. Medical logs on a cracked terminal hint at crew autopsies that revealed impossible results.',
    { sub: 'WRECKED', crew: true, icons: ['medkit', 'terminal'] }),
  R('cryo-bay', 'Cryo Bay', M, 572, 348, 198, 152,
    'Hypersleep pods open and empty. Bio-readout screens still cycling. Some pods show signs of forced opening from inside. Residue inside pods is organic and unidentifiable.',
    { sub: 'HYPERSLEEP', crew: true, icons: ['cryopod', 'medkit'] }),
  R('docking-airlock', 'Docking Airlock', M, 572, 508, 224, 92,
    'Starboard docking collar. The Montero’s umbilical mates here. Past the inner door the air is warm, wet and smells of rot.',
    { sub: 'MONTERO UMBILICAL', icons: ['alien-airlock'] }),
  R('aft-passage', 'Aft Passage', M, 330, 612, 466, 28,
    'Cross-passage behind the crew spaces: the escape vehicle, the blast door below and the scrubber plant all open off it.',
    { kind: 'cor' }),
  R('eev-bay', 'EEV Bay', M, 330, 640, 110, 100,
    'Emergency evacuation vehicle in its cradle. The docking locks release by hand from inside the bay.',
    { sub: 'ESCAPE VEHICLE', icons: ['alien-dropship'], labelSize: 6 }),
  R('lower-deck-access', 'Lower Deck Access', M, 448, 640, 192, 100,
    'Sealed blast door, heavily reinforced. Warning signs in multiple languages. The crew tried very hard to keep something contained below.',
    { sub: 'BLAST DOOR · LADDER ▼', icons: ['restricted', 'alien-hazard'], labelSize: 6 }),
  R('scrubber-plant', 'Scrubber Plant', M, 648, 640, 148, 100,
    'Air scrubbers and their filter stacks, clogged with spores and fibre. The service lift down to engineering is at the outboard end.',
    { sub: 'FILTERS · LIFT ▼', icons: ['alien-hazard'], labelSize: 5.6 }),
];

/* ─── Lower decks ──────────────────────────────────────────────────────── */
const L = 'lower';
export const lowerRooms = [
  R('sensor-bay', 'Sensor Bay', L, 450, 128, 200, 68,
    'Processors for the forward sensor boom, below the bridge. Resin creeps up the cable trays from the deck aft.',
    { sub: 'BOOM PROCESSORS', shape: 'octagon', icons: ['terminal'], labelSize: 6 }),
  R('the-nest', 'Lower Decks — The Nest', L, 330, 196, 440, 274,
    'EXTREME HAZARD. The lower decks have been completely transformed into alien architecture — resin walls, cocooned remains, egg clusters. The reactor is somewhere in this nightmare. This is where the creatures live.',
    { kind: 'zone' }),
  R('port-crawlway', 'Port Crawlway', L, 314, 230, 16, 490,
    'Maintenance crawlway along the port hull, from the forward bulkheads to the reactor room. Tight, dark, and the resin has found it.',
    { kind: 'passage' }),
  R('starboard-crawlway', 'Starboard Crawlway', L, 770, 230, 16, 338,
    'Maintenance crawlway along the starboard hull, from the nest to the cargo lock.',
    { kind: 'passage' }),
  R('lower-passage', 'Lower Passage', L, 528, 470, 44, 170,
    'The lower spine, running aft from the nest to the ladder landing. The resin thins out here, but not by much.',
    { kind: 'cor' }),
  R('cargo-hold', 'Cargo Hold', L, 330, 478, 198, 154,
    'Survey cargo in strapped racks: sealed sample crates and a row of dark ceramic urns the manifest calls “artifacts”. Something has been at the crates.',
    { sub: 'ARTIFACT URNS', icons: ['restricted', 'alien-hazard'], labelSize: 6.2 }),
  R('maintenance-stores', 'Maintenance Stores', L, 572, 478, 198, 82,
    'Spares, tools, filter cartridges and a few EVA rigs. Picked over by somebody who left in a hurry.',
    { sub: 'SPARES · EVA RIGS', icons: ['terminal'], labelSize: 6 }),
  R('cargo-lock', 'Cargo Lock', L, 572, 568, 224, 64,
    'Ventral cargo airlock on the starboard side. Big enough for crates, and for anything else that comes calling.',
    { sub: 'VENTRAL COLLAR', icons: ['alien-airlock'], labelSize: 6 }),
  R('coolant-pumps', 'Coolant Pumps', L, 330, 640, 118, 80,
    'Coolant pumps and heat exchangers for the reactor. Loud when they run; they have not run in a long time.',
    { sub: 'HEAT EXCHANGE', pattern: 'hatch', labelSize: 5.6 }),
  R('ladder-landing', 'Ladder Landing', L, 448, 640, 192, 80,
    'Foot of the ladder from Lower Deck Access. Scorch marks, spent cartridges and a barricade of welded deck plate that did not hold.',
    { sub: 'LADDER ▲ MAIN DECK', icons: ['alien-hazard'], labelSize: 6 }),
  R('engineering', 'Engineering', L, 640, 640, 156, 190,
    'Drive control and power distribution. The service lift comes down here. Repairs to the engines start at these consoles.',
    { sub: 'DRIVE CONTROL · LIFT ▲', icons: ['terminal', 'alien-reactor'], crew: true, labelSize: 6 }),
  R('reactor-room', 'Reactor Room', L, 280, 720, 360, 110,
    'The reactor and its control station. Containment is unstable; if it fails, this is where the countdown starts.',
    { sub: 'REACTOR CONTROL', icons: ['alien-reactor', 'restricted'] }),
];

export const cronusRooms = [...mainRooms, ...lowerRooms];
const byId = Object.fromEntries(cronusRooms.map((r) => [`${r.level}/${r.id}`, r]));
const rect = (level, id) => byId[`${level}/${id}`].rect;

/* Connectors between the decks; `labels` captions each level, `rooms`
   names the room the connector stands in on each level. */
export const STAIRS = [
  { level: 'both', levels: ['main', 'lower'], x: 474, y: 690, type: 'ladder', label: 'LADDER',
    labels: { main: 'LADDER ▼', lower: 'LADDER ▲' }, rooms: { main: 'lower-deck-access', lower: 'ladder-landing' } },
  { level: 'both', levels: ['main', 'lower'], x: 774, y: 690, type: 'elevator', label: 'SERVICE LIFT',
    labels: { main: 'LIFT ▼', lower: 'LIFT ▲' }, rooms: { main: 'scrubber-plant', lower: 'engineering' } },
];

const D = (level, from, to, side, t, locked = false, at = from) => ({ level, from, to, locked, ...edge(rect(level, at), side, t) });
export const cronusDoors = [
  /* main deck */
  D(M, 'bridge', 'main-corridor', 's', 0.5),
  D(M, 'science-lab', 'bridge', 'n', (485 - 330) / 198),
  D(M, 'science-lab', 'main-corridor', 'e', 0.5),
  D(M, 'crew-quarters', 'main-corridor', 'e', 0.5, true),
  D(M, 'comms-array', 'main-corridor', 'e', 0.5),
  D(M, 'medical-bay', 'main-corridor', 'w', 0.5),
  D(M, 'medical-bay', 'cryo-bay', 's', 0.5),
  D(M, 'cryo-bay', 'main-corridor', 'w', 0.5),
  D(M, 'docking-airlock', 'main-corridor', 'w', 0.5),
  D(M, 'main-corridor', 'aft-passage', 's', 0.5),
  D(M, 'eev-bay', 'aft-passage', 'n', 0.5),
  D(M, 'lower-deck-access', 'aft-passage', 'n', (550 - 448) / 192, true),
  D(M, 'scrubber-plant', 'aft-passage', 'n', 0.4),
  /* lower decks */
  D(L, 'sensor-bay', 'the-nest', 's', 0.5),
  D(L, 'the-nest', 'lower-passage', 's', 0.5),
  D(L, 'port-crawlway', 'the-nest', 'e', 0.2),
  D(L, 'port-crawlway', 'cargo-hold', 'e', 0.66),
  D(L, 'port-crawlway', 'coolant-pumps', 'e', 0.92),
  D(L, 'port-crawlway', 'reactor-room', 's', 0.5),
  D(L, 'starboard-crawlway', 'the-nest', 'w', 0.2),
  D(L, 'starboard-crawlway', 'maintenance-stores', 'w', 0.88),
  D(L, 'starboard-crawlway', 'cargo-lock', 's', 0.5),
  D(L, 'cargo-hold', 'lower-passage', 'e', 0.5),
  D(L, 'maintenance-stores', 'lower-passage', 'w', 0.5),
  D(L, 'cargo-lock', 'lower-passage', 'w', 0.5),
  D(L, 'ladder-landing', 'lower-passage', 'n', (550 - 448) / 192),
  D(L, 'coolant-pumps', 'ladder-landing', 'e', 0.5),
  D(L, 'ladder-landing', 'engineering', 'e', 0.5),
  D(L, 'ladder-landing', 'reactor-room', 's', 0.5),
  D(L, 'reactor-room', 'engineering', 'e', 0.5),
];

/* Air ducts on the main deck (the bloodburster's escape route). */
export const DUCTS = [
  'M 316 240 L 316 604 L 784 604 L 784 240',
  'M 316 420 L 330 420',
];
export const DUCT_GRATES = [[316, 300], [316, 452], [316, 560], [784, 300], [784, 420], [784, 560], [440, 604], [660, 604]];

/* ─── Board data (normalized) ──────────────────────────────────────────── */
export const cronusBoardRooms = boardRooms(
  cronusRooms.map((r) => ({ ...r, id: `${r.level}-${r.id}` })), W, H,
);
export const cronusBoardDoors = boardDoors(
  cronusDoors.map((d) => ({ ...d, from: `${d.level}-${d.from}`, to: `${d.level}-${d.to}` })), W, H,
);
export const cronusOutline = normPath(OUTLINE_PTS, W, H);
export const cronusCrop = { x: r4(220 / W), y: r4(60 / H), w: r4(660 / W), h: r4(830 / H) };
export const cronusSpawn = {
  pc: [r4(700 / W), r4(554 / H)],
  levels: {
    main: { pc: [r4(700 / W), r4(554 / H)] },
    lower: { pc: [r4(560 / W), r4(700 / H)] },
  },
};
