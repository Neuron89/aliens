/* ═══════════════════════════════════════════════════════════════════════
   SALTMOTHER’S DUE — WRECK SITE — GEOMETRY (JSX-free, node-importable).
   Single source for wreck.jsx (MapEngine plan) and maps/index.js
   (normalized board rooms, doors, spawn). Canvas px, W×H. One level.

   An OUTDOOR site: the "hull" outline is the whole sand basin. Inside it,
   open-sand zones (draw.kind 'zone', drawn by wreck.jsx) frame the split
   harvester (four walled rooms drawn by LevelPlan), the Fremen rock and the
   carryall wreck. Schematic: distances are labelled, not to scale.
   ═══════════════════════════════════════════════════════════════════════ */
import { boardRooms, boardDoors, edge, normPath, pxPath, r4 } from './geometry.js';

export const W = 1100, H = 920;
export const LEVELS = [{ id: 'site', label: 'WRECK SITE', deck: 'W' }];

/* The basin: a soft, irregular bowl of sand. */
export const OUTLINE_PTS = [
  [300, 100], [420, 93], [540, 98], [660, 89], [780, 95], [846, 106], [878, 136],
  [888, 220], [883, 320], [894, 420], [889, 520], [896, 620], [888, 720], [872, 784],
  [828, 812], [700, 806], [580, 820], [460, 811], [340, 818], [272, 806], [238, 772],
  [225, 680], [229, 580], [218, 480], [227, 380], [220, 280], [225, 190], [246, 128],
]
export const OUTLINE = pxPath(OUTLINE_PTS);

const L = 'site';
const R = (id, name, x, y, w, h, note, draw = {}) => ({ id, name, level: L, rect: { x, y, w, h }, note, draw });
const Z = (id, name, x, y, w, h, note, draw = {}) => R(id, name, x, y, w, h, note, { kind: 'zone', ...draw });

export const wreckRooms = [
  /* north: the rock and the worm country */
  Z('kareths-thumb', 'Kareth’s Thumb', 232, 112, 208, 218, 'Fremen rock outcrop with the Siq Abbar watch-post and the only safe landing pad. Worms cannot reach it.', { ground: 'rock' }),
  Z('dune-field', 'Dune Field', 440, 104, 448, 146, 'Open erg in every direction. Drum sand over the pre-spice mass to the southeast hums at dawn.'),
  Z('rock-spit', 'Rock Spit', 440, 250, 120, 80, 'A low tongue of black rock running east from the Thumb. Worm-safe to its tip; beyond the tip it is open sand all the way to the hull.', { ground: 'rock' }),
  Z('crawler-tracks', 'Crawler Tracks', 630, 250, 258, 138, 'The harvester’s own tread marks, half drifted over, running in from the northeast. Soft going; every step carries.'),
  Z('thumb-approach', 'Thumb Approach', 232, 330, 328, 58, 'Six hundred metres of open sand between the rock and the forward hull. Walk it without rhythm or the clock moves.'),
  /* the split harvester */
  R('bridge', 'Bridge', 262, 388, 138, 112, 'Canted twenty degrees to port. The Guild-sealed yield register (90 kg) sits behind cracked plaz; its key-plate is missing.', { sub: 'YIELD REGISTER', icons: ['restricted', 'wreck-register'], pattern: 'hatch' }),
  R('crew-deck', 'Crew Deck', 400, 388, 160, 112, 'Stilltents, dew-traps and four smiling survivors with blue-tinged eyes. Spice-thick air: DISCIPLINE + FAITH to think clearly.', { sub: 'STILLTENTS · 4 SURVIVORS', crew: true, icons: ['dune-water', 'dune-bed'] }),
  Z('sand-river', 'Sand River', 560, 250, 70, 390, 'Forty metres of open sand between the hull halves. Crossing it in rhythm advances the worm-sign clock.'),
  R('spice-hold', 'Spice Hold', 630, 388, 140, 112, 'About nine tonnes of melange, the purest near the floor where the pre-spice mass breathes. Promised to Sietch Umm Kareth by Iselde.', { sub: '~9 T MELANGE', icons: ['wreck-spice'], fill: 'sand' }),
  R('engine-section', 'Engine Section', 770, 388, 104, 112, 'Dead engines, a half-thrown beacon breaker and the murdered driver Hesk in a cargo sheet. The way in is up the spice-slick scoops.', { sub: 'HESK · BEACON', icons: ['dune-fire'], pattern: 'grating', labelSize: 5.6 }),
  /* south: aprons, the basin and the carryall */
  Z('forward-apron', 'Forward Apron', 232, 500, 328, 140, 'Trampled sand below the forward hull’s belly hatch, littered with empty water rings and a dead thumper the survivors never dared to plant.'),
  Z('aft-apron', 'Aft Apron', 630, 500, 258, 140, 'Spice-slick sand under the aft intake scoops. The scoop lips are the only climb into the hold; hands and boots come away orange.'),
  Z('south-erg', 'South Erg', 232, 640, 208, 160, 'Rolling crescent dunes. Good cover from the hull’s sight lines, terrible footing, and nothing but worm country beyond.'),
  Z('humming-basin', 'Humming Basin', 440, 640, 260, 166, 'Drum sand over the fermenting pre-spice mass. The ground hums in the teeth; at dawn it blows.'),
  Z('kestrel-vane', 'Kestrel Vane', 700, 640, 184, 160, 'Carryall wreck 1.2 km southeast: Odile Sarn’s body, Tobin Ashe in the avionics bay, and the flight recorder.'),
];

const byId = Object.fromEntries(wreckRooms.map((r) => [r.id, r]));
const rect = (id) => byId[id].rect;
const D = (from, to, side, t, locked = false, at = from) => ({ level: L, from, to, locked, ...edge(rect(at), side, t) });

/* Hull doors (drawn as wall gaps). */
export const HULL_DOORS = [
  D('bridge', 'forward-apron', 's', 0.5),      // belly hatch: the only way in fore
  D('bridge', 'crew-deck', 'e', 0.5),
  D('spice-hold', 'aft-apron', 's', 0.5),      // up the intake scoops
  D('spice-hold', 'engine-section', 'e', 0.5),
];

/* Open-ground transitions between sand/rock zones (board connectivity; drawn as tracks, not doors). */
export const GROUND_LINKS = [
  D('kareths-thumb', 'dune-field', 'e', 0.3),
  D('kareths-thumb', 'rock-spit', 'e', 0.82),
  D('kareths-thumb', 'thumb-approach', 's', 0.62),
  D('rock-spit', 'thumb-approach', 's', 0.5),
  D('rock-spit', 'sand-river', 'e', 0.5),
  D('sand-river', 'dune-field', 'n', 0.5),
  D('dune-field', 'crawler-tracks', 's', 0.75),
  D('crawler-tracks', 'sand-river', 'w', 0.4),
  D('thumb-approach', 'sand-river', 'e', 0.5),
  D('forward-apron', 'sand-river', 'e', 0.5),
  D('sand-river', 'aft-apron', 'e', 0.8),
  D('forward-apron', 'south-erg', 's', 0.3),
  D('forward-apron', 'humming-basin', 's', 0.82),
  D('sand-river', 'humming-basin', 's', 0.5),
  D('aft-apron', 'humming-basin', 's', 0.15),
  D('aft-apron', 'kestrel-vane', 's', 0.6),
  D('south-erg', 'humming-basin', 'e', 0.5),
  D('humming-basin', 'kestrel-vane', 'e', 0.5),
];

export const wreckDoors = [...HULL_DOORS, ...GROUND_LINKS];
export const STAIRS = [];

/* Landmarks (px) used by the plan and the spawn. */
export const PAD = { x: 292, y: 262 };          // Cinder Moth landing pad, the Thumb’s flat western shoulder
export const WATCH = { x: 382, y: 168 };        // Siq Abbar watch-post caves
export const CROSSING_Y = 572;                  // dashed crossing over the Sand River

/* ─── Board data (normalized) ──────────────────────────────────────────── */
export const wreckBoardRooms = boardRooms(wreckRooms, W, H);
export const wreckBoardDoors = boardDoors(wreckDoors, W, H);
export const wreckOutline = normPath(OUTLINE_PTS, W, H);
export const wreckCrop = { x: r4(205 / W), y: r4(80 / H), w: r4(705 / W), h: r4(755 / H) };
export const wreckSpawn = { pc: [r4(PAD.x / W), r4(PAD.y / H)], levels: { site: { pc: [r4(PAD.x / W), r4(PAD.y / H)] } } };
