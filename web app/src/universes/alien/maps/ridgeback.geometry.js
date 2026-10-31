/* ═══════════════════════════════════════════════════════════════════════
   RIDGEBACK STATION — GEOMETRY (JSX-free, node-importable).
   Single source for ridgeback.jsx (MapEngine plan) and maps/index.js
   (normalized board rooms, doors, spawn). Canvas px, W×H.

   The pack's ASCII is a vertical section through a deep thermal outpost;
   here it becomes three plans that share one footprint (the lift sits at
   the same point on every level):
     SURFACE      — volcanic plain on the ridge: Pad One, the module block
                    (Ops / HEARTH, Hab, Motor Pool, Lift Housing, Med / Charge)
                    and the Comms Dish beyond the fissure.
     LIFT LANDING — 1,200 m down the Throat: the landing, Cold Room, Core
                    Vault and the sealed Specimen Lab, cut into basalt.
     DEEP LEVEL   — Lava Tube 7, the Heat Exchanger Hall (the nest) and the
                    Reactor Tap.
   Outdoor ground and the lava tube are 'zone' rooms drawn by the plan.
   ═══════════════════════════════════════════════════════════════════════ */
import { boardRooms, boardDoors, edge, normPath, pxPath, r4 } from './geometry.js';

export const W = 1100, H = 920;
export const LEVELS = [
  { id: 'surface', label: 'SURFACE', deck: 'S' },
  { id: 'landing', label: 'LIFT LANDING', deck: 'L' },
  { id: 'deep', label: 'DEEP LEVEL', deck: 'D' },
];

/* Irregular rock / ridge-top footprint shared by all three levels. */
export const OUTLINE_PTS = [
  [262, 104], [360, 98], [470, 106], [580, 96], [690, 104], [800, 98], [868, 110], [886, 168],
  [883, 260], [889, 340], [884, 440], [891, 540], [886, 640], [890, 740], [880, 812], [842, 846],
  [730, 852], [610, 843], [490, 853], [370, 846], [270, 850], [234, 820], [226, 720], [232, 620],
  [225, 520], [231, 420], [226, 320], [232, 220], [228, 150],
];
export const OUTLINE = pxPath(OUTLINE_PTS);

/* Fixed points (px) shared between levels. */
export const LIFT = { x: 432, y: 352 };       // lift cage, same point on every level
export const LADDER = { x: 446, y: 396 };     // maintenance ladder beside it
export const HATCH = { x: 852, y: 462 };      // Specimen Lab floor hatch → Lava Tube 7
export const PAD = { x: 319, y: 286 };        // Pad One centre

const R = (id, name, level, x, y, w, h, note, draw = {}) => ({ id, name, level, rect: { x, y, w, h }, note, draw });
const Z = (id, name, level, x, y, w, h, note, draw = {}) => R(id, name, level, x, y, w, h, note, { kind: 'zone', ...draw });

/* ─── Surface ──────────────────────────────────────────────────────────── */
const S = 'surface';
export const surfaceRooms = [
  Z('pad-one', 'Pad One', S, 234, 112, 170, 338, 'Landing zone, beacon dead, ash-buried. The Tin Halo waits here; in Act III it cracks open under the purge.'),
  Z('vent-field', 'Vent Field', S, 404, 110, 472, 86, 'Fumaroles along the ridge crest. Hot grit, sulphur and sudden steam; respirators clog in minutes.'),
  R('ops', 'Ops / HEARTH', S, 404, 196, 166, 104, 'Station roster, camera feeds, lift controls. HEARTH speaks from every speaker; personal terminals wiped.', { sub: 'HEARTH CORE · LIFT CONTROL', crew: true, icons: ['terminal', 'alien-comms'], labelSize: 6 }),
  R('hab', 'Hab Module', S, 570, 196, 190, 104, "Tidied bunks, crayon volcano, locker 14 with Nadia Marsh's recorder.", { sub: 'BUNKS · LOCKERS', crew: true, icons: ['alien-bed'] }),
  R('motor-pool', 'Motor Pool', S, 760, 196, 116, 254, 'Crawler tractors and jacks. Site of the optional fissure breach that cuts the surface route to the dish.', { sub: 'CRAWLERS', icons: ['alien-vehicle', 'alien-hazard'], pattern: 'grating', labelSize: 5.6 }),
  R('walkway', 'Module Walkway', S, 404, 300, 356, 20, 'Pressurized walkway tying the modules together. The Custodians stand along it, waiting.', { kind: 'cor' }),
  R('lift-housing', 'Lift Housing', S, 404, 320, 186, 130, 'Head of the Throat, drill derrick overhead. Custodians hold the hatch in Act III; the Praetorian breaks out here.', { sub: 'HEAD OF THE THROAT', icons: ['alien-hazard'], pattern: 'hatch' }),
  R('med', 'Med / Charge', S, 590, 320, 170, 130, 'Med module with the dead facehugger and Med Log 0927; Custodian charging alcoves behind it.', { sub: 'MED BAY · CHARGING ALCOVES', crew: true, icons: ['medkit', 'alien-xeno'], labelSize: 6 }),
  Z('ash-plain', 'Ash Plain', S, 234, 450, 406, 390, 'Open cinder flats below the pad, ankle-deep in ash. No cover but drifts and sensor stakes.'),
  Z('crawler-track', 'Crawler Track', S, 700, 450, 176, 150, 'Graded track from the Motor Pool doors out to the dish. The only surface route there.'),
  Z('comms-dish', 'Comms Dish', S, 676, 600, 200, 220, "Restricted by HEARTH. The only transmitter on Cinder with sector range; Tamsk's Act III objective. Topples during the purge."),
];

/* ─── Lift Landing (−1,200 m) ─────────────────────────────────────────── */
const L = 'landing';
export const landingRooms = [
  R('throat', 'The Throat', L, 396, 190, 164, 240, '1,200 m lift shaft with maintenance ladder and four rest decks. Act I descent, Act III climb.', { sub: '1,200 M SHAFT', shape: 'circle', pattern: 'grating' }),
  R('lift-landing', 'Lift Landing', L, 560, 190, 150, 240, 'Deep Level arrival, resin on the doors, grease-pencil arrow pointing to COLD.', { sub: 'ARRIVAL', icons: ['alien-xeno'] }),
  R('core-vault', 'Core Vault', L, 710, 190, 166, 240, 'The data core in chilled gel; lifting it triggers HEARTH and opens the sealed annex.', { sub: 'DATA CORE', icons: ['restricted', 'terminal'], fill: 'ice' }),
  R('gallery', 'Survey Gallery', L, 396, 430, 294, 22, 'Rock-cut gallery joining the landing to the stores and labs. Bulkheads every twenty metres.', { kind: 'cor' }),
  R('cold-room', 'Cold Room', L, 396, 452, 204, 248, 'Refrigerated sample store sheltering Senn, Nadia Marsh and Ferro.', { sub: 'SAMPLE STORE · 3 SURVIVORS', crew: true, icons: ['alien-water'], fill: 'ice' }),
  R('chiller', 'Chiller Plant', L, 600, 452, 90, 248, 'Compressors that keep the Cold Room and the vault gel cold. Loud enough to hide footsteps.', { sub: 'COMPRESSORS', pattern: 'hatch', labelSize: 5 }),
  R('specimen-lab', 'Specimen Lab', L, 690, 430, 186, 270, 'Six eggs in heat incubators, Facehuggers, a stasis canister.', { sub: 'SEALED ANNEX', icons: ['restricted', 'alien-egg'], fill: 'hazard' }),
];

/* ─── Deep Level (−1,260 m to −1,340 m) ───────────────────────────────── */
const D = 'deep';
export const deepRooms = [
  Z('lava-tube', 'Lava Tube 7', D, 396, 196, 480, 284, '400 m natural tube, glowing seams, side vents; the route to the maintenance ladder and the nest once the lift is cut.', { fill: 'lava' }),
  R('heat-exchanger', 'Heat Exchanger Hall', D, 396, 480, 300, 330, 'The nest. Eggs along warm conduits, cocooned staff including Ines Tarrow, Drones in the walls.', { sub: 'THE NEST', icons: ['alien-egg', 'alien-xeno'], pattern: 'hatch', fill: 'hazard' }),
  R('reactor-tap', 'Reactor Tap', D, 696, 510, 180, 280, '"The Heart." Manual relief valves can slow HEARTH\'s purge.', { sub: '“THE HEART”', icons: [], shape: 'octagon', fill: 'lava' }),
];

export const ridgebackRooms = [...surfaceRooms, ...landingRooms, ...deepRooms];
const byId = Object.fromEntries(ridgebackRooms.map((r) => [`${r.level}/${r.id}`, r]));
const rect = (level, id) => byId[`${level}/${id}`].rect;
const Dr = (level, from, to, side, t, locked = false, at = from) => ({ level, from, to, locked, ...edge(rect(level, at), side, t) });

/* Walled doors (drawn). */
export const ridgebackDoors = [
  /* surface */
  Dr(S, 'ops', 'pad-one', 'w', 0.5),                    // Ops airlock onto the pad
  Dr(S, 'walkway', 'pad-one', 'w', 0.5),                // walkway airlock
  Dr(S, 'lift-housing', 'pad-one', 'w', 0.75),          // cargo door
  Dr(S, 'ops', 'hab', 'e', 0.5),
  Dr(S, 'ops', 'walkway', 's', 0.5),
  Dr(S, 'hab', 'walkway', 's', 0.5),
  Dr(S, 'hab', 'motor-pool', 'e', 0.5),
  Dr(S, 'walkway', 'motor-pool', 'e', 0.5),
  Dr(S, 'lift-housing', 'walkway', 'n', 0.6),
  Dr(S, 'med', 'walkway', 'n', 0.5),
  Dr(S, 'lift-housing', 'med', 'e', 0.5),
  Dr(S, 'motor-pool', 'crawler-track', 's', 0.6),       // vehicle doors
  Dr(S, 'crawler-track', 'comms-dish', 's', 0.5, true), // dish compound gate, HEARTH-locked
  /* lift landing */
  Dr(L, 'throat', 'lift-landing', 'e', 0.5),
  Dr(L, 'lift-landing', 'core-vault', 'e', 0.5, true),
  Dr(L, 'lift-landing', 'gallery', 's', 0.5),
  Dr(L, 'cold-room', 'gallery', 'n', 0.5),
  Dr(L, 'chiller', 'gallery', 'n', 0.5),
  Dr(L, 'cold-room', 'chiller', 'e', 0.75),
  Dr(L, 'gallery', 'specimen-lab', 'e', 0.5, true),
  Dr(L, 'core-vault', 'specimen-lab', 's', 0.5, true),  // the sealed annex
  /* deep level */
  Dr(D, 'heat-exchanger', 'lava-tube', 'n', 0.25),
  Dr(D, 'reactor-tap', 'heat-exchanger', 'w', 0.5),
];

/* Open-ground transitions between outdoor zones (board connectivity; not drawn as doors). */
export const GROUND_LINKS = [
  Dr(S, 'vent-field', 'pad-one', 'w', 0.5),
  Dr(S, 'pad-one', 'ash-plain', 's', 0.5),
];

export const STAIRS = [
  { level: 'both', levels: ['surface', 'landing', 'deep'], x: LIFT.x, y: LIFT.y, type: 'elevator', label: 'LIFT',
    labels: { surface: 'LIFT ▼', landing: 'LIFT ▲▼', deep: 'LIFT ▲' } },
  { level: 'both', levels: ['surface', 'landing', 'deep'], x: LADDER.x, y: LADDER.y, type: 'ladder', label: 'MAINT. LADDER',
    labels: { surface: 'LADDER ▼', landing: 'LADDER ▲▼', deep: 'LADDER ▲' } },
  { level: 'both', levels: ['landing', 'deep'], x: HATCH.x, y: HATCH.y, type: 'ladder', label: 'FLOOR HATCH',
    labels: { landing: 'HATCH ▼', deep: 'HATCH ▲ LAB' } },
];

/* Room each connector lands in, per level (for checks). */
export const STAIR_ROOMS = [
  { surface: 'lift-housing', landing: 'throat', deep: 'lava-tube' },
  { surface: 'lift-housing', landing: 'throat', deep: 'lava-tube' },
  { landing: 'specimen-lab', deep: 'lava-tube' },
];

/* ─── Board data (normalized) ──────────────────────────────────────────── */
const allDoors = [...ridgebackDoors, ...GROUND_LINKS];
export const ridgebackBoardRooms = boardRooms(
  ridgebackRooms.map((r) => ({ ...r, id: `${r.level}-${r.id}` })), W, H,
);
export const ridgebackBoardDoors = boardDoors(
  allDoors.map((d) => ({ ...d, from: `${d.level}-${d.from}`, to: `${d.level}-${d.to}` })), W, H,
);
export const ridgebackOutline = normPath(OUTLINE_PTS, W, H);
export const ridgebackCrop = { x: r4(212 / W), y: r4(86 / H), w: r4(692 / W), h: r4(780 / H) };
export const ridgebackSpawn = {
  pc: [r4(330 / W), r4(400 / H)],
  levels: {
    surface: { pc: [r4(330 / W), r4(400 / H)] },
    landing: { pc: [r4(500 / W), r4(400 / H)] },
    deep: { pc: [r4(470 / W), r4(330 / H)] },
  },
};
