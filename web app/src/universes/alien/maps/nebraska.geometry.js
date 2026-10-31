/* ═══════════════════════════════════════════════════════════════════════
   FORT NEBRASKA — GEOMETRY (JSX-free, node-importable).
   Single source for nebraska.jsx (MapEngine plan) and maps/index.js
   (normalized board rooms, doors, spawn). Canvas px, W×H. Two levels.

   SURFACE: a UA mining colony turned USCMC forward operating base. The
   "hull" outline is the whole site: the ridge and spoil heaps to the
   north (Mine Entrance Alpha cut into it, 3 km up the haul road, shown
   schematically), the haul road, and the fenced compound. The wire is a
   ring of four thin zones; inside it, walled buildings (drawn by
   LevelPlan) sit between open-ground zones (drawn by nebraska.jsx).
   MINE: 200 m below the entrance. The cage lift drops to the shaft foot;
   the main haulage runs south past the old ore galleries to the deep
   shafts, the UPP bio-containment lab (sealed; breached from inside) and
   the hive. Schematic: distances are labelled, not to scale.
   ═══════════════════════════════════════════════════════════════════════ */
import { boardRooms, boardDoors, edge, normPath, pxPath, r4 } from './geometry.js';

export const W = 1100, H = 920;
export const LEVELS = [
  { id: 'surface', label: 'SURFACE', deck: 'S' },
  { id: 'mine', label: 'MINE', deck: 'M' },
];

/* The site: an irregular survey boundary around ridge, road and compound. */
export const OUTLINE_PTS = [
  [262, 104], [380, 98], [500, 104], [620, 96], [740, 102], [850, 98], [884, 118],
  [892, 220], [886, 320], [893, 420], [887, 520], [894, 620], [888, 720], [884, 808],
  [856, 844], [740, 838], [620, 846], [500, 840], [380, 846], [262, 840], [228, 812],
  [222, 720], [228, 620], [221, 520], [227, 420], [222, 320], [228, 220], [232, 130],
];
export const OUTLINE = pxPath(OUTLINE_PTS);

const S = 'surface', M = 'mine';
const R = (level) => (id, name, x, y, w, h, note, draw = {}) => ({ id, name, level, rect: { x, y, w, h }, note, draw });
const RS = R(S), RM = R(M);
const ZS = (id, name, x, y, w, h, note, draw = {}) => RS(id, name, x, y, w, h, note, { kind: 'zone', ...draw });
const ZM = (id, name, x, y, w, h, note, draw = {}) => RM(id, name, x, y, w, h, note, { kind: 'zone', ...draw });

export const nebraskaRooms = [
  /* ── SURFACE: north of the wire ── */
  ZS('west-ridge', 'West Ridge', 226, 104, 242, 132, 'Broken basalt above the colony. Good overwatch on the haul road and the north wire; no cover once you come down off it.'),
  ZS('mine-entrance-alpha', 'Mine Entrance Alpha', 468, 104, 180, 132, '3km north of colony. Primary shaft descending 200+ meters. Multiple side tunnels branch into the mine complex. The creatures emerge from here.'),
  ZS('spoil-heaps', 'Spoil Heaps', 648, 104, 240, 132, 'Forty years of tailings dumped in long grey mounds. Loose footing, dead ground between the heaps, and a hundred places to wait unseen.'),
  ZS('haul-road', 'Haul Road', 226, 236, 662, 54, 'Graded ore road and rail spur from the mine portal to the north gate, three kilometres of open ground shown here cut short. Floodlights reach the first two hundred metres.'),
  /* ── SURFACE: the wire ── */
  ZS('perimeter-fence', 'Perimeter Fence', 246, 290, 624, 32, "Chain-link and razor wire with motion sensors and floodlights. Designed to keep wildlife out. Not designed for what's coming."),
  ZS('west-wire', 'West Wire', 246, 322, 32, 468, 'The west fence line and its cleared strip. Two sentry guns cover it; the motor pool backs straight onto the wire.'),
  ZS('east-wire', 'East Wire', 838, 322, 32, 468, 'The east fence line beside the tank farm and the power plant. The floodlight masts here run off the plant directly.'),
  ZS('south-wire', 'South Wire', 246, 790, 624, 32, 'The south fence behind the habitat modules. Colonists cut a gap here years ago to reach the old drill pads; it was patched with mesh and hope.'),
  /* ── SURFACE: inside the wire ── */
  RS('barracks', 'Barracks', 288, 332, 96, 160, 'Marine quarters with weapon lockers, ammo storage, and equipment. Armored walls. Can be sealed and held as a fallback position.', { sub: 'WPN LOCKERS', crew: true, icons: ['alien-bed'], labelSize: 5.6 }),
  ZS('motor-pool', 'Motor Pool', 278, 492, 106, 144, 'Hardstand for the garrison’s vehicles: the APC, two cargo tractors and a fuel bowser. The APC’s rear ramp faces the street.'),
  RS('med-bay', 'Med Bay', 288, 636, 96, 144, 'Colony medical facility. Basic but functional. Doc Holliday has set up a combat triage station here.', { sub: 'TRIAGE', crew: true, icons: ['alien-bed'], labelSize: 5.6 }),
  ZS('west-street', 'West Street', 384, 322, 24, 468, 'Packed-dirt street between the barracks row and the pad. The quickest run from the medical block to the dropship.'),
  ZS('landing-pad', 'Landing Pad', 408, 322, 300, 176, 'Open platform for the dropship. Exposed to Ariarcus storms. The dropship is your primary extraction vehicle — protect it.'),
  ZS('pad-apron', 'Pad Apron', 408, 498, 300, 22, 'Cargo apron between the pad and the ops centre: pallets, fuel lines and sandbags.'),
  RS('ops-center', 'Ops Center', 408, 520, 300, 116, 'Colony command, repurposed as Marine tactical ops. Communications, sensor feeds, colony admin. The last defensible strong point.', { sub: 'COMMAND · COMMS · SENSORS', crew: true, icons: ['alien-comms'] }),
  ZS('habitat-row', 'Habitat Row', 408, 636, 300, 24, 'Lane between the ops centre and the habitat modules, choked with colonists’ belongings waiting for a seat on a ship.'),
  ZS('colony-habitats', 'Colony Habitats', 408, 660, 300, 130, 'Civilian housing modules. Miners and their families. 60+ civilians who need protection and evacuation.'),
  ZS('east-street', 'East Street', 708, 322, 24, 468, 'Service street along the east row: admin, tanks, the plant and the supply dump.'),
  RS('mine-admin', 'Mine Admin', 732, 332, 98, 120, 'Mining company offices. Colony records, mine shaft maps, geological surveys. Intel on the underground layout.', { sub: 'RECORDS', labelSize: 5.6 }),
  ZS('tank-farm', 'Tank Farm', 732, 452, 106, 68, 'Water and fuel tanks inside a low berm. A stray burst here starts a fire nobody can put out.'),
  RS('power-plant', 'Power Plant', 732, 520, 98, 160, 'Colony power generation. Fusion reactor. If this goes down, the perimeter lights and sensors go dark.', { sub: 'FUSION', pattern: 'hatch', icons: ['alien-reactor'], labelSize: 5.6 }),
  ZS('supply-dump', 'Supply Dump', 732, 680, 106, 110, 'Stacked cargo containers: mine spares, rations and the Marines’ reserve ammunition. Plenty of cover, all of it blind.'),

  /* ── MINE: 200 m below Mine Entrance Alpha ── */
  RM('shaft-foot', 'Shaft Foot', 492, 112, 148, 84, 'Bottom landing of the cage lift, two hundred metres down. Lamp racks, a dead phone to the surface and fresh scratches on the cage gate.', { labelSize: 5.6 }),
  RM('main-haulage', 'Main Haulage', 548, 196, 20, 324, 'The main rail tunnel, straight and lit by every third lamp. Ore cars stand where the shift abandoned them.', { kind: 'cor' }),
  RM('west-drift', 'West Drift', 300, 296, 248, 20, 'A side drift the survey maps show as worked out and backfilled. Somebody dug it clean again and laid new cable.', { kind: 'cor' }),
  RM('decon-lock', 'Decon Lock', 330, 316, 90, 56, 'Prefabricated decontamination airlock in UPP livery, its outer door sealed with a military code lock.', { sub: 'UPP · SEALED', labelSize: 5 }),
  RM('upp-research-lab', 'UPP Research Lab', 270, 372, 210, 188, 'Hidden installation deep in the mine complex. Military-grade bio-containment. Whatever they were studying, it got out. Emergency beacon located here.', { sub: 'BIO-CONTAINMENT · BEACON', pattern: 'grating', icons: ['alien-hazard', 'alien-comms'] }),
  ZM('ore-gallery', 'Ore Gallery', 568, 236, 292, 204, 'Room-and-pillar workings off the haulage: low roof, a grid of rock pillars and long dark lanes between them. Sound carries; sight does not.'),
  ZM('deep-shafts', 'Deep Shafts', 480, 520, 380, 120, 'Winzes and ladderways dropping toward the lowest levels. The walls change here: the first smears of resin, then ribs of it.'),
  ZM('the-hive', 'The Hive', 300, 640, 560, 186, 'Deep mine shafts transformed into alien architecture. Resin walls, cocooned victims, egg clusters. The source of the infestation. Going in is near-suicide.'),
];

const byId = Object.fromEntries(nebraskaRooms.map((r) => [r.id, r]));
const rect = (id) => byId[id].rect;
const D = (from, to, side, t, locked = false, at = from) => ({ level: byId[from].level, from, to, locked, ...edge(rect(at), side, t) });
/* t along an edge from an absolute coordinate */
const tx = (id, x) => (x - rect(id).x) / rect(id).w;
const ty = (id, y) => (y - rect(id).y) / rect(id).h;

/* Building doors (drawn as wall gaps). */
export const BUILDING_DOORS = [
  D('barracks', 'west-street', 'e', 0.5),
  D('barracks', 'motor-pool', 's', 0.5),
  D('med-bay', 'west-street', 'e', 0.5),
  D('med-bay', 'motor-pool', 'n', 0.5),
  D('ops-center', 'pad-apron', 'n', 0.5),
  D('ops-center', 'west-street', 'w', 0.5),
  D('ops-center', 'east-street', 'e', 0.5),
  D('ops-center', 'habitat-row', 's', 0.5),
  D('mine-admin', 'east-street', 'w', 0.5),
  D('power-plant', 'east-street', 'w', 0.5),
  /* mine */
  D('shaft-foot', 'main-haulage', 's', tx('shaft-foot', 558)),
  D('decon-lock', 'west-drift', 'n', 0.5),
  D('decon-lock', 'upp-research-lab', 's', 0.5, true),
];

/* Open-ground transitions (board connectivity; drawn as gates, gaps and tracks, not doors). */
export const GROUND_LINKS = [
  D('haul-road', 'mine-entrance-alpha', 'n', tx('haul-road', 558)),
  D('haul-road', 'west-ridge', 'n', tx('haul-road', 340)),
  D('haul-road', 'spoil-heaps', 'n', tx('haul-road', 770)),
  D('west-ridge', 'mine-entrance-alpha', 'e', 0.6),
  D('mine-entrance-alpha', 'spoil-heaps', 'e', 0.6),
  D('perimeter-fence', 'haul-road', 'n', tx('perimeter-fence', 558)), // the north gate
  D('perimeter-fence', 'landing-pad', 's', tx('perimeter-fence', 558)),
  D('perimeter-fence', 'west-street', 's', tx('perimeter-fence', 396)),
  D('perimeter-fence', 'east-street', 's', tx('perimeter-fence', 720)),
  D('perimeter-fence', 'west-wire', 's', tx('perimeter-fence', 262)),
  D('perimeter-fence', 'east-wire', 's', tx('perimeter-fence', 854)),
  D('west-wire', 'motor-pool', 'e', ty('west-wire', 564)),
  D('west-wire', 'south-wire', 's', 0.5),
  D('east-wire', 'south-wire', 's', 0.5),
  D('east-wire', 'tank-farm', 'w', ty('east-wire', 486)),
  D('east-wire', 'supply-dump', 'w', ty('east-wire', 735)),
  D('south-wire', 'west-street', 'n', tx('south-wire', 396)),
  D('south-wire', 'east-street', 'n', tx('south-wire', 720)),
  D('south-wire', 'colony-habitats', 'n', tx('south-wire', 558)),
  D('motor-pool', 'west-street', 'e', 0.5),
  D('landing-pad', 'west-street', 'w', 0.5),
  D('landing-pad', 'east-street', 'e', 0.5),
  D('landing-pad', 'pad-apron', 's', 0.5),
  D('pad-apron', 'west-street', 'w', 0.5),
  D('pad-apron', 'east-street', 'e', 0.5),
  D('habitat-row', 'west-street', 'w', 0.5),
  D('habitat-row', 'east-street', 'e', 0.5),
  D('habitat-row', 'colony-habitats', 's', 0.5),
  D('colony-habitats', 'west-street', 'w', 0.5),
  D('colony-habitats', 'east-street', 'e', 0.5),
  D('tank-farm', 'east-street', 'w', 0.5),
  D('supply-dump', 'east-street', 'w', 0.5),
  /* mine */
  D('main-haulage', 'west-drift', 'w', ty('main-haulage', 306)),
  D('main-haulage', 'ore-gallery', 'e', ty('main-haulage', 338)),
  D('main-haulage', 'deep-shafts', 's', 0.5),
  D('upp-research-lab', 'deep-shafts', 'e', ty('upp-research-lab', 540)), // the containment breach
  D('deep-shafts', 'the-hive', 's', tx('deep-shafts', 640)),
  D('deep-shafts', 'the-hive', 's', tx('deep-shafts', 800)),
];

export const nebraskaDoors = [...BUILDING_DOORS, ...GROUND_LINKS];

/* Cage lift: Mine Entrance Alpha (surface) ↔ Shaft Foot (mine). */
export const LIFT = { x: 522, y: 150 };
export const STAIRS = [
  { level: 'both', levels: ['surface', 'mine'], x: LIFT.x, y: LIFT.y, type: 'elevator', label: 'CAGE LIFT',
    labels: { surface: 'CAGE LIFT ▼ 200 M', mine: 'CAGE LIFT ▲ SURFACE' } },
];

/* Landmarks (px) used by the plan and the spawn. */
export const GATE = { x: 558, y: 306 };
export const PAD = { x: 558, y: 410 };
export const BREACH = { x: 480, y: 540 };

/* ─── Board data (normalized) ──────────────────────────────────────────── */
export const nebraskaBoardRooms = boardRooms(nebraskaRooms, W, H);
export const nebraskaBoardDoors = boardDoors(nebraskaDoors, W, H);
export const nebraskaOutline = normPath(OUTLINE_PTS, W, H);
export const nebraskaCrop = { x: r4(205 / W), y: r4(84 / H), w: r4(705 / W), h: r4(778 / H) };
const pt = (x, y) => [r4(x / W), r4(y / H)];
export const nebraskaSpawn = {
  pc: pt(PAD.x, PAD.y + 40),
  levels: { surface: { pc: pt(PAD.x, PAD.y + 40) }, mine: { pc: pt(596, 176) } },
};
