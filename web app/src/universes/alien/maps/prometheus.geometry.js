/* ═══════════════════════════════════════════════════════════════════════
   STATION PROMETHEUS — GEOMETRY (JSX-free, node-importable).
   Single source for prometheus.jsx (MapEngine plan) and maps/index.js
   (normalized board rooms, doors, spawn). Canvas px, W×H.

   A stacked hexagonal hull section: the same hull on every level so the
   TV reads it as one structure. Each level shares one skeleton — a
   rectangular ring corridor round a central lift lobby, a north band and
   a south band of rooms between ring and hull, and a narrow column of
   rooms on each flank. The central lift runs through all five levels;
   two maintenance hatches (NW and SE ring corners) drop through every
   level into the Maintenance Tunnels that circle the Reactor Core.
   Level 4 is sealed: welded doors at its lift lobby.
   ═══════════════════════════════════════════════════════════════════════ */
import { boardRooms, boardDoors, edge, normPath, pxPath, r4 } from './geometry.js';

export const W = 1100, H = 920;

export const LEVELS = [
  { id: 'level-1', label: 'LEVEL 1 · OPERATIONS', deck: '1', name: 'OPERATIONS' },
  { id: 'level-2', label: 'LEVEL 2 · HABITATION', deck: '2', name: 'HABITATION' },
  { id: 'level-3', label: 'LEVEL 3 · MEDICAL / LABS', deck: '3', name: 'MEDICAL / LABS' },
  { id: 'level-4', label: 'LEVEL 4 · PRIMARY RESEARCH', deck: '4', name: 'PRIMARY RESEARCH' },
  { id: 'core', label: 'REACTOR CORE', deck: 'C', name: 'REACTOR CORE' },
];

/* Hexagonal hull section, points east and west. */
export const HULL = { top: 116, bot: 824, xl: 320, xr: 780, west: 216, east: 884, mid: 470 };
export const OUTLINE_PTS = [[320, 116], [780, 116], [884, 470], [780, 824], [320, 824], [216, 470]];
export const OUTLINE = pxPath(OUTLINE_PTS);

/* Shared skeleton (px). */
export const RING = { x0: 370, y0: 256, x1: 730, y1: 684, t: 20 };
export const LOBBY = { x: 470, y: 284, w: 160, h: 56 };
export const LIFT = { x: 550, y: 306 };
export const HATCH_NW = { x: 380, y: 266 };
export const HATCH_SE = { x: 720, y: 674 };

const R = (id, name, level, x, y, w, h, note, draw = {}) => ({ id, name, level, rect: { x, y, w, h }, note, draw });

/* Ring corridor rects (or tunnel passages on the core level). */
const ring = (L, names, notes, kind = 'cor') => [
  R('ring-n', names[0], L, 370, 256, 360, 20, notes[0], { kind }),
  R('ring-w', names[1], L, 370, 276, 20, 388, notes[1], { kind }),
  R('ring-e', names[2], L, 710, 276, 20, 388, notes[2], { kind }),
  R('ring-s', names[3], L, 370, 664, 360, 20, notes[3], { kind }),
];
const lobby = (L, name, note) => R('lobby', name, L, LOBBY.x, LOBBY.y, LOBBY.w, LOBBY.h, note, { kind: 'zone' });
const ringNames = (n) => [`L${n} Ring — North`, `L${n} Ring — West`, `L${n} Ring — East`, `L${n} Ring — South`];

/* ─── Level 1: operations ──────────────────────────────────────────────── */
const L1 = 'level-1';
export const level1Rooms = [
  ...ring(L1, ringNames(1), [
    'North arc of the Level 1 ring. Scrawled across the panels outside the lift: “DON’T LOOK AT THE STARS.”',
    'West arc of the ring. Emergency strip lighting only; the NW maintenance hatch is in the corner.',
    'East arc of the ring, along the observation gallery.',
    'South arc of the ring, past life support. The SE maintenance hatch is in the corner.',
  ]),
  lobby(L1, 'L1 Lift Lobby', 'Central lift to every level. The car is parked here, doors open, interior light flickering. Its call panel lists Level 4 as LOCKED OUT.'),
  R('airlock-7', 'Airlock 7 — Docking Bay', L1, 326, 128, 160, 120, 'Emergency docking port. The USCSS Vanguard is connected here. Your lifeline. Keep it secure at all costs.', { sub: 'VANGUARD DOCKED', icons: ['alien-airlock', 'terminal'] }),
  R('suit-lockers', 'Suit Lockers', L1, 494, 128, 80, 120, 'Pressure suits for EVA work on the hull. Nine of twelve still on their racks. One locker has been forced from the inside.', { sub: '9 / 12 SUITS', labelSize: 5 }),
  R('bridge', 'Level 1 — Bridge', L1, 582, 128, 192, 120, 'Station command and control. Crew status boards showing all 47 personnel as "UNKNOWN." Station logs accessible here — they tell a disturbing story.', { sub: 'COMMAND · STATION LOGS', crew: true, shape: 'octagon', icons: ['terminal', 'intercom'], labelSize: 5.8 }),
  R('l1-stores', 'Ops Stores', L1, 286, 284, 76, 180, 'Spare panels, filters and ration crates for the ops level. Someone has stacked the crates against the door — from the inside.', { sub: 'SPARES', pattern: 'hatch', labelSize: 5 }),
  R('emergency-lockers', 'Emergency Lockers', L1, 286, 472, 76, 184, 'Fire suppression, flares, medkits and two flamer units. Both flamer racks are empty.', { sub: 'FLARES · MEDKITS', icons: ['medkit'], labelSize: 4.6 }),
  R('observation', 'Observation Gallery', L1, 738, 284, 76, 372, 'Long viewport onto LV-178 and the stars. The glass has been painted over from the inside, badly, in a hurry.', { sub: 'VIEWPORTS', crew: true, labelSize: 4.6 }),
  R('comms', 'Level 1 — Communications', L1, 398, 348, 148, 148, 'Long-range comms array. Currently transmitting nothing — someone shut it down deliberately. Can be reactivated.', { sub: 'ARRAY · OFFLINE', icons: ['alien-comms', 'terminal'], labelSize: 5 }),
  R('security', 'Security Station', L1, 398, 504, 148, 152, 'Camera monitors and the station armoury locker. The camera feeds for Level 4 show only static. Last entry in the duty log: “WELD IT.”', { sub: 'CAMERAS · ARMOURY', icons: ['weapon', 'terminal'], labelSize: 5.6 }),
  R('admin', 'Director’s Office', L1, 554, 348, 148, 148, 'Station director’s office. A Special Projects directive on the desk orders the Erebus data preserved “irrespective of personnel losses.”', { sub: 'SPECIAL PROJECTS FILES', crew: true, icons: ['restricted'], labelSize: 5.6 }),
  R('briefing', 'Briefing Room', L1, 554, 504, 148, 152, 'Conference table and wall screen. The last meeting’s agenda is still on the screen: “CONTAINMENT REVIEW — LEVEL 4.”', { sub: 'WALL SCREEN', crew: true, labelSize: 5.6 }),
  R('life-support', 'Level 1 — Life Support', L1, 326, 692, 288, 120, 'Environmental controls. Running on automatic at minimal levels. Temperature is barely above freezing. Something is drawing excess power to Level 4.', { sub: 'SCRUBBERS · HEAT · O₂', pattern: 'hatch', icons: ['alien-hazard', 'terminal'] }),
  R('water-reclamation', 'Water Reclamation', L1, 622, 692, 152, 120, 'Recycling tanks and filters. Still running, slowly. The filters are clogged with something dark and fibrous.', { sub: 'TANKS · FILTERS', icons: ['alien-water'], pattern: 'hatch', labelSize: 5.6 }),
];

/* ─── Level 2: habitation ──────────────────────────────────────────────── */
const L2 = 'level-2';
export const level2Rooms = [
  ...ring(L2, ringNames(2), [
    'North arc of the Level 2 ring, outside crew quarters. The writing on the walls is thickest here.',
    'West arc of the ring. A trail of dropped belongings leads toward the lift.',
    'East arc of the ring, past the officers’ cabins.',
    'South arc of the ring, between the rec area and hydroponics.',
  ]),
  lobby(L2, 'L2 Lift Lobby', 'Lift lobby for habitation. Someone has wedged a chair under the call panel.'),
  R('crew-quarters', 'Level 2 — Crew Quarters', L2, 326, 128, 288, 120, 'Personal spaces abandoned mid-activity. Running showers, half-eaten meals, open books. 47 lives interrupted. Writing on the walls begins here.', { sub: '20 CABINS', crew: true, icons: ['alien-bed'] }),
  R('hygiene', 'Hygiene & Showers', L2, 622, 128, 152, 120, 'Communal showers. Three are still running, cold, after six months. The drains are backing up.', { sub: 'SHOWERS RUNNING', icons: ['alien-water'], labelSize: 5.6 }),
  R('laundry', 'Laundry & Stores', L2, 286, 284, 76, 180, 'Laundry machines and linen stores. A wet uniform still sits in a drum.', { sub: 'LINEN', pattern: 'hatch', labelSize: 4.6 }),
  R('quiet-room', 'Quiet Room', L2, 286, 472, 76, 184, 'Small multi-faith room. Every surface is covered in the same diagram, drawn over and over by different hands.', { sub: 'THE DIAGRAM', crew: true, labelSize: 5 }),
  R('officers-cabins', 'Officers’ Cabins', L2, 738, 284, 76, 180, 'Four larger cabins for senior staff. All four doors are locked from the inside.', { sub: '4 CABINS', crew: true, icons: ['alien-bed'], labelSize: 4.6 }),
  R('directors-cabin', 'Director’s Cabin', L2, 738, 472, 76, 184, 'The station director’s cabin. A packed bag by the door; a ticket for the next supply run that never came.', { sub: 'PACKED BAG', crew: true, labelSize: 4.6 }),
  R('mess-hall', 'Level 2 — Mess Hall', L2, 398, 348, 304, 196, 'Communal eating area. Tables overturned. A barricade was built here and then... abandoned. Or overrun.', { sub: 'BARRICADE', crew: true, icons: ['alien-hazard'] }),
  R('galley', 'Galley', L2, 398, 552, 148, 104, 'Ovens, prep counters, a dishwasher halfway through its cycle. The knife rack is empty.', { sub: 'KNIFE RACK EMPTY', icons: ['alien-fire'], labelSize: 5.8 }),
  R('cold-store', 'Cold Store', L2, 554, 552, 148, 104, 'Walk-in freezer for food stores. The inside of the door is scratched in long parallel grooves.', { sub: 'FREEZER', pattern: 'hatch', labelSize: 5.8 }),
  R('rec-area', 'Rec Area', L2, 326, 692, 220, 120, 'Gym equipment, a games table, a screen still looping the same nature film with the sound off.', { sub: 'GYM · SCREEN', crew: true }),
  R('hydroponics', 'Hydroponics', L2, 554, 692, 220, 120, 'Grow racks for fresh food. Everything has died except one rack, which is thriving and should not be.', { sub: 'GROW RACKS', icons: ['alien-water', 'alien-hazard'], fill: '#0f2620' }),
];

/* ─── Level 3: medical and research labs ───────────────────────────────── */
const L3 = 'level-3';
export const level3Rooms = [
  ...ring(L3, ringNames(3), [
    'North arc of the Level 3 ring, outside the medical bay. Bio-hazard tape across the lift doors, torn.',
    'West arc of the ring, past the morgue.',
    'East arc of the ring, past the sample freezers.',
    'South arc of the ring, outside specimen storage. Containment alarm lights pulse slowly here.',
  ]),
  lobby(L3, 'L3 Lift Lobby', 'Lift lobby for medical and labs. A decon spray arch over the lift doors, still armed.'),
  R('medical-bay', 'Level 3 — Medical Bay', L3, 326, 128, 288, 120, 'Research-grade medical facility. Autopsy reports on crew who died early in the incident. Brain scans showing anomalous activity. Pharmaceutical supplies — including heavy sedatives, mostly used.', { sub: 'SURGERY · SCANNER · 6 BEDS', crew: true, icons: ['medkit', 'terminal'] }),
  R('pharmacy', 'Pharmacy', L3, 622, 128, 152, 120, 'Locked dispensary. The sedative shelves are bare; the log shows the last of them signed out to “ALL STAFF.”', { sub: 'SEDATIVES GONE', icons: ['medkit', 'restricted'], labelSize: 6 }),
  R('morgue', 'Morgue', L3, 286, 284, 76, 180, 'Six cold drawers. Four are occupied. One of them should not be — its tag names a crew member who is listed as alive in the medical log.', { sub: '4 / 6 FULL', pattern: 'hatch', labelSize: 5.6 }),
  R('isolation', 'Isolation Ward', L3, 286, 472, 76, 184, 'Two sealed patient rooms. The observation window of one is cracked from the inside.', { sub: '2 CELLS', icons: ['restricted'], labelSize: 5 }),
  R('freezers', 'Sample Freezers', L3, 738, 284, 76, 180, 'Cryogenic sample freezers. One unit is open and warm; its rack labels read EREBUS / LV-178 / CAVE 3.', { sub: 'CRYO −80 °C', pattern: 'hatch', labelSize: 4.6 }),
  R('clean-lockers', 'Clean-Room Lockers', L3, 738, 472, 76, 184, 'Gowning room for the labs. Hazmat suits hang in a neat row; one is missing.', { sub: 'HAZMAT', labelSize: 4.4 }),
  R('research-labs', 'Level 3 — Research Labs', L3, 398, 348, 304, 196, 'Specimen analysis labs. Data terminals with Project Erebus research files. Some specimens still in containment — small, dormant, wrong.', { sub: 'LAB A · LAB B · EREBUS FILES', crew: true, icons: ['alien-xeno', 'terminal'] }),
  R('data-archive', 'Data Archive', L3, 398, 552, 148, 104, 'Local research storage. Partial Erebus files only; the full set was moved down to Level 4’s core storage unit.', { sub: 'PARTIAL FILES', icons: ['terminal'], labelSize: 5.8 }),
  R('decon', 'Decontamination', L3, 554, 552, 148, 104, 'Chemical shower lock between the labs and the ring. Cycles on its own every few minutes.', { sub: 'SPRAY LOCK', icons: ['alien-hazard'], labelSize: 5.6 }),
  R('specimen-storage', 'Specimen Storage', L3, 326, 692, 220, 120, 'Containment tanks for the smaller Erebus specimens. Keycard lock. Two tanks are cracked and empty.', { sub: '2 TANKS BREACHED', icons: ['alien-xeno', 'restricted'], pattern: 'grating' }),
  R('dissection', 'Lab C — Dissection', L3, 554, 692, 220, 120, 'Dissection theatre with a viewing rail. The table restraints have been used on something much stronger than they were built for.', { sub: 'THEATRE · RESTRAINTS', crew: true, icons: ['alien-hazard'] }),
];

/* ─── Level 4: primary research (sealed) ───────────────────────────────── */
const L4 = 'level-4';
export const level4Rooms = [
  ...ring(L4, ['L4 Ring — North', 'L4 Ring — West', 'L4 Ring — East', 'L4 Ring — South'], [
    'Behind the welded lobby doors. The corridor is lined with dark resin that pulses, ribbed like the inside of an artery.',
    'West arc. Resin has grown over the NW maintenance hatch, but not sealed it.',
    'East arc. The resin is thickest round the power tap room door.',
    'South arc. Gravity fluctuates along this stretch; loose objects drift at knee height.',
  ]),
  lobby(L4, 'L4 Lift Lobby — Barricade', 'The lift opens onto a barricade of lockers and lab benches built against two blast doors, both welded shut from this side. Bio-containment signs on every surface. Sounds from beyond the doors: wet, organic, and a vibration felt in the teeth.'),
  R('containment-control', 'Containment Control', L4, 326, 128, 220, 120, 'Observation and control booth for the primary lab. Every screen shows the same frame: the centre of the lab, and something that was not there before.', { sub: 'OBSERVATION · CONTROLS', icons: ['terminal', 'restricted'], fill: 'hazard' }),
  R('specimen-vault', 'Specimen Vault', L4, 554, 128, 220, 120, 'Hardened vault for the cave samples brought up from LV-178. The vault door has been opened from the inside.', { sub: 'LV-178 CAVE SAMPLES', icons: ['alien-egg', 'restricted'], pattern: 'hatch', fill: 'hazard' }),
  R('biohazard-lock', 'Biohazard Lock', L4, 286, 284, 76, 372, 'Personnel decontamination lock for the sealed level. Its inner door is resin-fused open; the outer door to the NW hatch is the only clean route in.', { sub: 'DECON', icons: ['alien-hazard'], fill: 'hazard', labelSize: 5 }),
  R('power-tap', 'Power Tap Room', L4, 738, 284, 76, 372, 'Heavy conduits bring reactor power up to the lab — far more than the lab was ever rated for. Breakers have been bypassed by hand; the cables are grown over.', { sub: 'REACTOR FEED', icons: ['alien-reactor', 'alien-hazard'], pattern: 'hatch', fill: 'hazard', labelSize: 5 }),
  R('primary-research', 'Level 4 — Primary Research [SEALED]', L4, 398, 348, 304, 308, 'Behind welded blast doors. Bio-containment warning signs everywhere. Beyond the doors: reality breaks down. The station architecture merges with alien biology. The Architect waits at the center.', { sub: 'PROJECT EREBUS · THE ARCHITECT', shape: 'octagon', fill: '#24120f', labelSize: 6 }),
  R('holding-cells', 'Holding Cells', L4, 326, 692, 220, 120, 'Four cells built after the first incidents to hold crew who “heard it.” Cell doors open. Shapes inside that are no longer quite people.', { sub: '4 CELLS · OPEN', icons: ['restricted'], fill: 'hazard' }),
  R('incinerator', 'Incinerator', L4, 554, 692, 220, 120, 'Sample incinerator. Its last cycle was aborted halfway. The ash tray is full of something that did not burn.', { sub: 'CYCLE ABORTED', icons: ['alien-fire', 'alien-hazard'], pattern: 'hatch', fill: 'hazard' }),
];

/* ─── Core: reactor and maintenance tunnels ────────────────────────────── */
const LC = 'core';
export const coreRooms = [
  ...ring(LC, ['Maintenance Tunnels — North', 'Maintenance Tunnels', 'Maintenance Tunnels — East', 'Maintenance Tunnels — South'], [
    'North crawl of the tunnel loop round the reactor, joining the lift lobby to power distribution and reactor control.',
    'Access crawlways running between all levels. Cramped, dark, with emergency lighting only. The fastest way between levels — and the most dangerous.',
    'East crawl of the tunnel loop, hot from the heat exchanger.',
    'South crawl of the tunnel loop, under the coolant pumps.',
  ], 'passage'),
  lobby(LC, 'Core Lift Lobby', 'The bottom of the lift shaft. Radiation placards, dosimeter rack, a viewport onto the reactor housing.'),
  R('power-distribution', 'Power Distribution', LC, 326, 128, 220, 120, 'Main bus and breaker panels for the station. One trunk line, to Level 4, is drawing triple its rated load.', { sub: 'MAIN BUS · L4 FEED ▲', pattern: 'hatch', icons: ['alien-hazard'] }),
  R('reactor-control', 'Reactor Control', LC, 554, 128, 220, 120, 'Reactor control room. The emergency shutdown is here: two keys, two consoles, three metres apart. Shutdown kills life support on every level.', { sub: 'EMERGENCY SHUTDOWN', crew: true, icons: ['terminal', 'restricted'] }),
  R('battery-room', 'Battery Room', LC, 286, 284, 76, 372, 'Emergency battery banks — enough to run the lift and the airlock for one hour after a shutdown, if they are charged. They are at 30%.', { sub: '30% CHARGE', pattern: 'hatch', labelSize: 5.4 }),
  R('heat-exchanger', 'Heat Exchanger', LC, 738, 284, 76, 372, 'Coolant loops dump reactor heat to the hull radiators. Deafening, scalding, and the only warm place on the station.', { sub: 'RADIATOR LOOPS', pattern: 'hatch', icons: ['alien-fire'], labelSize: 5 }),
  R('reactor-core', 'Reactor Core', LC, 398, 348, 304, 308, 'Fusion reactor providing station power. Increasingly unstable as Level 4 draws more energy. Emergency shutdown accessible but will kill life support on all levels.', { sub: 'FUSION TORUS · UNSTABLE', shape: 'circle', pattern: 'hatch', fill: 'hazard' }),
  R('coolant-pumps', 'Coolant Pumps', LC, 326, 692, 220, 120, 'Primary and backup coolant pumps. The backup is running flat out; the primary is silent.', { sub: 'PRIMARY OFFLINE', pattern: 'hatch', icons: ['alien-water'] }),
  R('fuel-store', 'Fuel Store', LC, 554, 692, 220, 120, 'Deuterium and helium-3 pellet store. Shielded casks, interlocked door.', { sub: 'D / He-3 CASKS', icons: ['restricted', 'alien-hazard'], pattern: 'grating' }),
];

export const prometheusRooms = [...level1Rooms, ...level2Rooms, ...level3Rooms, ...level4Rooms, ...coreRooms];
const byId = Object.fromEntries(prometheusRooms.map((r) => [`${r.level}/${r.id}`, r]));
const rect = (level, id) => byId[`${level}/${id}`].rect;

/* Door at x (or y) on a room side: converts an absolute coordinate to t. */
const D = (level, from, to, side, at, locked = false) => {
  const rc = rect(level, from);
  const t = side === 'n' || side === 's' ? (at - rc.x) / rc.w : (at - rc.y) / rc.h;
  return { level, from, to, locked, ...edge(rc, side, t) };
};

/* Doors every level shares: lobby → north ring. */
const lobbyDoor = (L, locked = false) => D(L, 'lobby', 'ring-n', 'n', 550, locked);

export const prometheusDoors = [
  /* level 1 */
  lobbyDoor(L1),
  D(L1, 'airlock-7', 'ring-n', 's', 420),
  D(L1, 'airlock-7', 'suit-lockers', 'e', 188),
  D(L1, 'suit-lockers', 'ring-n', 's', 534),
  D(L1, 'bridge', 'ring-n', 's', 656),
  D(L1, 'l1-stores', 'ring-w', 'e', 374),
  D(L1, 'emergency-lockers', 'ring-w', 'e', 564),
  D(L1, 'observation', 'ring-e', 'w', 380),
  D(L1, 'observation', 'ring-e', 'w', 560),
  D(L1, 'comms', 'lobby', 'n', 500),
  D(L1, 'comms', 'ring-w', 'w', 422),
  D(L1, 'security', 'ring-w', 'w', 580),
  D(L1, 'security', 'comms', 'n', 472),
  D(L1, 'admin', 'lobby', 'n', 600),
  D(L1, 'admin', 'ring-e', 'e', 422),
  D(L1, 'briefing', 'ring-e', 'e', 580),
  D(L1, 'briefing', 'admin', 'n', 628),
  D(L1, 'life-support', 'ring-s', 'n', 450),
  D(L1, 'life-support', 'water-reclamation', 'e', 752),
  D(L1, 'water-reclamation', 'ring-s', 'n', 680),
  /* level 2 */
  lobbyDoor(L2),
  D(L2, 'crew-quarters', 'ring-n', 's', 400),
  D(L2, 'crew-quarters', 'ring-n', 's', 540),
  D(L2, 'crew-quarters', 'hygiene', 'e', 188),
  D(L2, 'hygiene', 'ring-n', 's', 690),
  D(L2, 'laundry', 'ring-w', 'e', 374),
  D(L2, 'quiet-room', 'ring-w', 'e', 564),
  D(L2, 'officers-cabins', 'ring-e', 'w', 374),
  D(L2, 'directors-cabin', 'ring-e', 'w', 564, true),
  D(L2, 'mess-hall', 'lobby', 'n', 550),
  D(L2, 'mess-hall', 'ring-w', 'w', 446),
  D(L2, 'mess-hall', 'ring-e', 'e', 446),
  D(L2, 'galley', 'mess-hall', 'n', 472),
  D(L2, 'galley', 'ring-w', 'w', 604),
  D(L2, 'cold-store', 'galley', 'w', 604),
  D(L2, 'rec-area', 'ring-s', 'n', 450),
  D(L2, 'hydroponics', 'ring-s', 'n', 650),
  /* level 3 */
  lobbyDoor(L3),
  D(L3, 'medical-bay', 'ring-n', 's', 420),
  D(L3, 'medical-bay', 'ring-n', 's', 560),
  D(L3, 'medical-bay', 'pharmacy', 'e', 188),
  D(L3, 'pharmacy', 'ring-n', 's', 690, true),
  D(L3, 'morgue', 'ring-w', 'e', 374),
  D(L3, 'isolation', 'ring-w', 'e', 564),
  D(L3, 'freezers', 'ring-e', 'w', 374),
  D(L3, 'clean-lockers', 'ring-e', 'w', 564),
  D(L3, 'research-labs', 'lobby', 'n', 550),
  D(L3, 'research-labs', 'ring-w', 'w', 446),
  D(L3, 'data-archive', 'research-labs', 'n', 472),
  D(L3, 'data-archive', 'ring-w', 'w', 604),
  D(L3, 'decon', 'research-labs', 'n', 628),
  D(L3, 'decon', 'ring-e', 'e', 604),
  D(L3, 'specimen-storage', 'ring-s', 'n', 450, true),
  D(L3, 'dissection', 'ring-s', 'n', 650),
  /* level 4 — welded at the lobby; open (and grown over) inside */
  lobbyDoor(L4, true),
  D(L4, 'lobby', 'primary-research', 's', 550, true),
  D(L4, 'containment-control', 'ring-n', 's', 450),
  D(L4, 'specimen-vault', 'ring-n', 's', 650, true),
  D(L4, 'biohazard-lock', 'ring-w', 'e', 330),
  D(L4, 'biohazard-lock', 'ring-w', 'e', 600),
  D(L4, 'power-tap', 'ring-e', 'w', 470),
  D(L4, 'primary-research', 'ring-w', 'w', 502),
  D(L4, 'primary-research', 'ring-e', 'e', 502),
  D(L4, 'primary-research', 'ring-s', 's', 550),
  D(L4, 'holding-cells', 'ring-s', 'n', 450),
  D(L4, 'incinerator', 'ring-s', 'n', 650),
  /* core */
  lobbyDoor(LC),
  D(LC, 'power-distribution', 'ring-n', 's', 450),
  D(LC, 'reactor-control', 'ring-n', 's', 650),
  D(LC, 'battery-room', 'ring-w', 'e', 470),
  D(LC, 'heat-exchanger', 'ring-e', 'w', 470),
  D(LC, 'reactor-core', 'ring-w', 'w', 502, true),
  D(LC, 'reactor-core', 'ring-e', 'e', 502, true),
  D(LC, 'coolant-pumps', 'ring-s', 'n', 450),
  D(LC, 'fuel-store', 'ring-s', 'n', 650, true),
];

/* Lift and hatches. `levels` lists the levels each runs through. */
const ALL = ['level-1', 'level-2', 'level-3', 'level-4', 'core'];
export const STAIRS = [
  { level: 'both', levels: ALL, x: LIFT.x, y: LIFT.y, type: 'elevator', label: 'CENTRAL LIFT', room: 'lobby',
    labels: { 'level-1': 'CENTRAL LIFT', 'level-2': 'CENTRAL LIFT', 'level-3': 'CENTRAL LIFT', 'level-4': 'LIFT · BARRICADED', core: 'LIFT ▲ ALL LEVELS' } },
  { level: 'both', levels: ALL, x: HATCH_NW.x, y: HATCH_NW.y, type: 'ladder', label: 'HATCH NW', room: 'ring-n' },
  { level: 'both', levels: ALL, x: HATCH_SE.x, y: HATCH_SE.y, type: 'ladder', label: 'HATCH SE', room: 'ring-s' },
];

/* Conduits (drawn as vent paths): the Level 4 power feed, the comms trunk. */
export const FEED_PATHS = {
  'level-1': ['M 440 420 L 300 420 L 300 470 L 226 470'],
  'level-4': ['M 776 470 L 730 470', 'M 776 300 L 776 252 L 730 252'],
};

/* ─── Board data (normalized) ──────────────────────────────────────────── */
export const prometheusBoardRooms = boardRooms(
  prometheusRooms.map((r) => ({ ...r, id: `${r.level}-${r.id}` })), W, H,
);
export const prometheusBoardDoors = boardDoors(
  prometheusDoors.map((d) => ({ ...d, from: `${d.level}-${d.from}`, to: `${d.level}-${d.to}` })), W, H,
);
export const prometheusOutline = normPath(OUTLINE_PTS, W, H);
export const prometheusCrop = { x: r4(200 / W), y: r4(56 / H), w: r4(700 / W), h: r4(790 / H) };
const lobbySpawn = [r4(512 / W), r4(330 / H)];
export const prometheusSpawn = {
  pc: [r4(406 / W), r4(214 / H)],
  levels: {
    'level-1': { pc: [r4(406 / W), r4(214 / H)] },
    'level-2': { pc: lobbySpawn },
    'level-3': { pc: lobbySpawn },
    'level-4': { pc: lobbySpawn },
    core: { pc: lobbySpawn },
  },
};
