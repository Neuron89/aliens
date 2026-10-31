/* ═══════════════════════════════════════════════════════════════════════
   HADLEY’S HOPE — GEOMETRY (JSX-free, node-importable).
   Single source for hadleys.jsx (MapEngine plan) and maps/index.js
   (normalized board rooms, doors, spawn). Canvas px, W×H. One level.

   A SITE PLAN: the "hull" outline is the patch of wind-scoured ground the
   colony stands on. The prefab modules sit on a raised platform in three
   columns either side of two airlocked spine walkways (West / East) that
   meet the South Walkway; the Landing Pad (west) and the Atmospheric
   Processor (north, drawn huge and off-scale) are outdoor zones the plan
   draws itself (draw.kind 'zone'). The Service Road runs from the
   processor gate to the Vehicle Bay’s north doors.
   ═══════════════════════════════════════════════════════════════════════ */
import { boardRooms, boardDoors, edge, normPath, pxPath, r4 } from './geometry.js';

export const W = 1100, H = 920;
export const LEVELS = [{ id: 'colony', label: 'COLONY', deck: 'C' }];

/* The ground: an irregular plate of scoured rock, kept clear of the legend (x > 892, y < 330). */
export const OUTLINE_PTS = [
  [244, 104], [330, 98], [430, 103], [540, 96], [650, 102], [760, 97], [848, 104], [880, 128],
  [886, 230], [884, 330], [893, 430], [889, 540], [894, 650], [888, 760], [874, 822],
  [820, 846], [700, 840], [590, 848], [470, 841], [360, 846], [270, 838], [236, 806],
  [228, 700], [233, 600], [224, 500], [231, 400], [225, 300], [230, 200], [232, 140],
];
export const OUTLINE = pxPath(OUTLINE_PTS);

const L = 'colony';
const R = (id, name, x, y, w, h, note, draw = {}) => ({ id, name, level: L, rect: { x, y, w, h }, note, draw });
const Z = (id, name, x, y, w, h, note, draw = {}) => R(id, name, x, y, w, h, note, { kind: 'zone', ...draw });
const C = (id, name, x, y, w, h, note) => R(id, name, x, y, w, h, note, { kind: 'cor' });

/* The raised platform the modules stand on. */
export const PLATFORM = { x: 416, y: 322, w: 464, h: 502 };

export const hadleysRooms = [
  /* outdoor zones */
  Z('atmospheric-processor', 'Atmospheric Processor', 236, 108, 300, 212,
    "2km north of the colony. Massive industrial structure. The sub-levels beneath it contain the growing nest. Going here is a death sentence — but it's also where the power comes from."),
  Z('service-road', 'Service Road', 536, 108, 344, 228,
    'Graded track from the colony’s vehicle doors to the processor gate, two kilometres of it in the real world. Marker poles every fifty metres; in a storm you drive from pole to pole.'),
  Z('landing-pad', 'Landing Pad', 236, 340, 144, 280,
    "Emergency shuttle pad on the colony's west side. Exposed to LV-426's brutal storms. The shuttle seats 12 — colony population is 158."),

  /* west column */
  R('med-bay', 'Med Bay', 432, 340, 116, 110,
    "Colony medical facility. Dr. Patel's domain. Surgical suite, recovery beds, pharmaceutical storage. Where the facehugger victim will be brought.",
    { sub: 'SURGERY · RECOVERY', crew: true, icons: ['medkit'] }),
  R('hab-a', 'Hab Module A', 432, 470, 116, 100,
    'Family quarters. Small apartments for colonists with children. Thin walls. Connected to the school module.',
    { sub: 'FAMILY QUARTERS', crew: true, icons: ['alien-bed'] }),
  R('school', 'School Module', 432, 612, 116, 112,
    "Where the colony's children are educated. Small, bright, covered in drawings. Newt knows the ventilation access point hidden behind the supply closet.",
    { sub: 'CLASSROOM', crew: true }),

  /* centre column */
  R('ops', 'Operations Center', 570, 336, 154, 120,
    "Colony nerve center. Communications, sensor displays, atmospheric processor monitoring. Administrator's office adjacent. The place everyone runs to when things go wrong.",
    { sub: 'COMMS · SENSORS', crew: true, icons: ['alien-comms', 'terminal'] }),
  R('commons', 'Commons / Rec Room', 570, 492, 154, 96,
    'The social heart of the colony. Bar, pool table, vid screen, bulletin boards. Where colonists gather after shifts. Will become a refugee center when things go bad.',
    { sub: 'BAR · POOL · VID', crew: true, labelSize: 6 }),
  R('hab-b', 'Hab Module B', 570, 616, 154, 108,
    'Single quarters and shared bunks for unattached workers. Rougher crowd. Closer to the maintenance section.',
    { sub: 'SINGLES · BUNKS', crew: true, icons: ['alien-bed'] }),

  /* east column */
  R('vehicle-bay', 'Vehicle Bay', 746, 336, 124, 212,
    "Garage housing the colony's APC, survey trucks, and maintenance vehicles. Heavy doors that can be sealed. Clairemont knows every vehicle here.",
    { sub: 'APC · TRUCKS', icons: ['alien-vehicle'], pattern: 'grating' }),
  R('hydroponics', 'Hydroponics Bay', 746, 584, 124, 140,
    'Growing facility for supplemental food. Warm, humid, green. One of the few pleasant spaces in the colony. The creatures will love the humidity.',
    { sub: 'WARM · HUMID', fill: '#0d2a1c', icons: ['alien-water'], labelSize: 6 }),

  /* south */
  R('maintenance', 'Maintenance Section', 570, 746, 300, 64,
    'Generators, water reclamation, waste processing. The guts of the colony. Noisy, easy to get lost in, full of hiding spots — for colonists and creatures alike.',
    { sub: 'GENERATORS · WATER RECLAMATION', pattern: 'hatch', icons: ['alien-hazard', 'alien-reactor'] }),

  /* covered, airlocked walkways */
  C('west-walkway', 'West Walkway', 548, 340, 22, 384, 'Covered walkway down the west side of the core modules. Pressure doors at every module; storm shutters on the outer face.'),
  C('east-walkway', 'East Walkway', 724, 340, 22, 384, 'Covered walkway between the core modules and the garage and hydroponics. Its north end is the sentry line in front of Operations.'),
  C('south-walkway', 'South Walkway', 432, 724, 438, 22, 'The long walkway along the south edge of the platform. Maintenance hatches open off it; the south lock is at its western end.'),
  C('pad-walkway', 'Pad Walkway', 380, 450, 168, 20, 'Covered bridge from the West Walkway out over the processor conduit to the landing pad. Glazed sides, wind-rattled. The way out.'),
  C('ops-link', 'Ops Link', 636, 456, 22, 36, 'Short airlocked tube between Operations and the Commons.'),
  C('school-link', 'School Link', 479, 570, 22, 42, 'Covered tube from the family quarters to the school.'),
];

const byId = Object.fromEntries(hadleysRooms.map((r) => [r.id, r]));
const rect = (id) => byId[id].rect;
const D = (from, to, side, t, locked = false, at = from) => ({ level: L, from, to, locked, ...edge(rect(at), side, t) });

export const hadleysDoors = [
  /* operations: the barricade */
  D('ops', 'west-walkway', 'w', 0.5),
  D('ops', 'east-walkway', 'e', 0.5),
  D('ops', 'ops-link', 's', (647 - 570) / 154),
  D('ops-link', 'commons', 's', 0.5),
  /* commons */
  D('commons', 'west-walkway', 'w', 0.5),
  D('commons', 'east-walkway', 'e', 0.5),
  /* west column */
  D('med-bay', 'west-walkway', 'e', 0.5),
  D('med-bay', 'pad-walkway', 's', (490 - 432) / 116),
  D('pad-walkway', 'west-walkway', 'e', 0.5),
  D('pad-walkway', 'landing-pad', 'w', 0.5),
  D('hab-a', 'west-walkway', 'e', 0.5),
  D('hab-a', 'school-link', 's', 0.5),
  D('school-link', 'school', 's', 0.5),
  D('school', 'south-walkway', 's', 0.5),
  /* hab B */
  D('hab-b', 'west-walkway', 'w', 0.5),
  D('hab-b', 'south-walkway', 's', 0.5),
  /* east column */
  D('vehicle-bay', 'east-walkway', 'w', 0.3),
  D('vehicle-bay', 'service-road', 'n', 0.5),
  D('hydroponics', 'east-walkway', 'w', 0.5),
  D('hydroponics', 'south-walkway', 's', 0.5),
  /* walkway junction airlocks */
  D('west-walkway', 'south-walkway', 's', 0.5),
  D('east-walkway', 'south-walkway', 's', 0.5),
  /* maintenance hatches */
  D('maintenance', 'south-walkway', 'n', (606 - 570) / 300),
  D('maintenance', 'south-walkway', 'n', (840 - 570) / 300),
  /* outside: road to the processor gate */
  D('service-road', 'atmospheric-processor', 'w', (250 - 108) / 228),
];
export const STAIRS = [];

/* Landmarks (px) used by the plan. */
export const TOWER = { x: 372, y: 208, r: 90 };   // processor footprint (huge, not to scale)
export const PAD = { x: 306, y: 470 };            // shuttle pad centre
export const SPAWN = { x: 647, y: 426 };          // inside Operations, below its label

/* ─── Board data (normalized) ─── */
export const hadleysBoardRooms = boardRooms(hadleysRooms, W, H);
export const hadleysBoardDoors = boardDoors(hadleysDoors, W, H);
export const hadleysOutline = normPath(OUTLINE_PTS, W, H);
export const hadleysCrop = { x: r4(214 / W), y: r4(88 / H), w: r4(690 / W), h: r4(770 / H) };
export const hadleysSpawn = {
  pc: [r4(SPAWN.x / W), r4(SPAWN.y / H)],
  levels: { colony: { pc: [r4(SPAWN.x / W), r4(SPAWN.y / H)] } },
};
