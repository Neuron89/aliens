/* ═══════════════════════════════════════════════════════════════════════
   TARTARUS REACH — plan GEOMETRY (JSX-free, node-importable).
   Single source for tartarus.jsx (MapEngine plan) and maps/index.js
   (normalized board rooms, doors, spawn). Canvas px, W×H.

   A Weyland-Yutani helium-3 refinery hanging in the clouds of Dis. The
   pack's vertical section becomes three plan levels sharing one outline:
   a long hexagonal deck (pointed fore and aft) with the landing wing
   across its north end and the escape-gondola housing at the keel's
   south tip. The lift cells hang beneath it and bulge out past the
   deck edge on both flanks.
     UPPER PLATFORM — landing wing (Pad A, Pad B, apron, cold hold,
                      decon) and the hab ring behind the decon lock.
     PROCESS DECK   — scoop intake across the wing, the fraction column,
                      control gallery and the He-3 tank farm.
     KEEL           — lift-cell gallery, ladder foot, reactor crawlway,
                      sump & ballast and the escape gondola.
   The spine lift runs upper ↔ process only (the lift ends at L3); the
   keel is reached by the crew ladder from the control gallery.
   ═══════════════════════════════════════════════════════════════════════ */
import { boardRooms, boardDoors, edge, normPath, pxPath, r4 } from './geometry.js';

export const W = 1100, H = 920;

export const LEVELS = [
  { id: 'upper', label: 'UPPER PLATFORM', deck: 'U' },
  { id: 'process', label: 'PROCESS DECK', deck: 'P' },
  { id: 'keel', label: 'KEEL', deck: 'K' },
];

/* Hull: hexagon core x 330–770, bow apex (550,112), stern shoulders at
   y 772 running in to the gondola housing; landing wing y 150–290 across
   x 226–874 (chamfered tips). */
export const HULL = { x0: 330, x1: 770, wingX0: 226, wingX1: 874, wingY0: 150, wingY1: 290, sternY: 772 };
export const OUTLINE_PTS = [
  [550, 112], [643, 150],
  [850, 150], [874, 174], [874, 266], [850, 290], [770, 290],
  [770, 772], [600, 842], [600, 874], [500, 874], [500, 842], [330, 772],
  [330, 290], [250, 290], [226, 266], [226, 174], [250, 150],
  [457, 150],
];
export const OUTLINE = pxPath(OUTLINE_PTS);

const R = (id, name, level, x, y, w, h, note, draw = {}) => ({ id, name, level, rect: { x, y, w, h }, note, draw });

/* ─── Upper platform ───────────────────────────────────────────────────── */
const U = 'upper';
export const upperRooms = [
  R('pad-a', 'Pad A', U, 238, 154, 136, 132, 'L1. Ore lighter Lamplighter, cargo doors frozen open, sealed belly cradle. Three seats.', { kind: 'zone' }),
  R('pad-b', 'Pad B', U, 726, 154, 136, 132, 'L1. The relief hop. Clampable from Ops.', { kind: 'zone' }),
  R('apron', 'Landing Apron', U, 374, 209, 352, 22, 'Open iron walk between the pads, scoured by ammonia sleet. Tether rails on both edges.', { kind: 'cor' }),
  R('cold-cargo-hold', 'Cold Cargo Hold', U, 400, 152, 300, 52, 'L1. Eresh survey crates; crate 44-B holds the ovomorphs, one intact.', { sub: 'ERESH CRATES · −40 °C', icons: ['alien-egg'], fill: 'ice', labelSize: 6 }),
  R('decon-lock', 'Decon Lock & Customs', U, 480, 237, 140, 64, 'L1. Quarantine override log; organic residue on the inner seal.', { sub: 'FOG CYCLE · BYPASSED', icons: ['alien-airlock', 'alien-hazard'], labelSize: 5.4 }),
  R('ring-n', 'Hab Ring North', U, 440, 307, 220, 22, 'Hab ring, north run, from the decon lock’s inner door.', { kind: 'cor' }),
  R('ring-w', 'Hab Ring West', U, 440, 329, 22, 317, 'Hab ring, west run: Ops, the audit suite and the quiet room open off it.', { kind: 'cor' }),
  R('ring-e', 'Hab Ring East', U, 638, 329, 22, 317, 'Hab ring, east run: the bunks and the infirmary.', { kind: 'cor' }),
  R('ring-s', 'Hab Ring South', U, 440, 646, 220, 22, 'Hab ring, south run, past the sealed survey lab.', { kind: 'cor' }),
  R('mess', 'Mess & Rec Lounge', U, 462, 329, 176, 165, 'L2. Abandoned meal, the calendar, the cook\'s apron and a drag mark to the floor vent.', { sub: 'GALLEY · REC', crew: true, labelSize: 6 }),
  R('lift-lobby', 'Lift Lobby', U, 462, 500, 176, 146, 'Head of the spine lift down to the processing core. The call panel can be locked to the auditor’s authorisation.', { labelSize: 5.6 }),
  R('ops-center', 'Ops Center', U, 340, 300, 96, 170, 'L2. MU/TH/UR 2100 terminal, archive, clamp and comms control. Welded shut by Varga.', { sub: 'MU/TH/UR 2100', crew: true, icons: ['terminal', 'restricted'], labelSize: 5.6 }),
  R('audit-suite', 'Audit Suite', U, 340, 476, 96, 84, 'L2. Venn\'s quarters: attaché, encrypted terminal, the sealed orders.', { sub: 'VENN', crew: true, icons: ['restricted'], labelSize: 5.6 }),
  R('quiet-room', 'Quiet Room', U, 340, 566, 96, 80, 'L2. A tiny chapel with a window onto the clouds. Somewhere to vent stress.', { sub: 'CHAPEL', crew: true, labelSize: 5.6 }),
  R('suit-room', 'Suit Lockers', U, 340, 652, 96, 108, 'Pressure suits, respirators and deck harnesses for work on the open landing deck. Two hooks are empty.', { sub: 'EVA · HARNESS', labelSize: 5.4 }),
  R('bunk-corridor', 'Bunk Corridor', U, 664, 300, 96, 170, 'L2. Crew quarters; the facehugger hides in the floor vents here if released.', { sub: '12 BUNKS', crew: true, icons: ['alien-bed'], labelSize: 5.6 }),
  R('infirmary', 'Infirmary & Morgue', U, 664, 476, 96, 170, 'L2. Strapped shut. Half-broken autosurgeon; Brandt\'s body; shed skin.', { sub: 'AUTOSURGEON', icons: ['medkit', 'alien-xeno'], labelSize: 5 }),
  R('air-plant', 'Air Plant', U, 664, 652, 96, 108, 'Scrubbers and heaters for the hab ring. Every floor vent in the ring comes back to this room.', { sub: 'SCRUBBERS', icons: ['intercom'], pattern: 'hatch', labelSize: 5.6 }),
  R('survey-lab', 'Survey Lab', U, 446, 674, 208, 126, 'L2. Sealed. Eresh core logs and Brandt\'s notes; Valk\'s Act I target.', { sub: 'SEALED · ERESH CORES', shape: 'octagon', icons: ['restricted'] }),
];

/* ─── Process deck ─────────────────────────────────────────────────────── */
const P = 'process';
export const processRooms = [
  R('scoop-intake', 'Scoop Intake', P, 300, 156, 500, 128, 'L3. Roaring intake ducts; first glimpse of the creature.', { sub: 'TWIN SCOOPS · TURBINES', icons: ['alien-hazard'] }),
  R('intake-walk', 'Intake Walk', P, 340, 290, 420, 22, 'Grated walk along the intake bulkhead; every duct grille on the deck is in reach of it.', { kind: 'cor' }),
  R('control-gallery', 'Control Gallery', P, 344, 318, 90, 222, 'L3. Secondary terminal for overriding the descent; ballast trim.', { sub: 'DESCENT OVERRIDE', crew: true, icons: ['terminal'], labelSize: 5.4 }),
  R('fraction-column', 'Fraction Column', P, 440, 318, 220, 222, 'L3. Cryogenic column; a liquid helium coolant dump can freeze anything inside.', { kind: 'zone' }),
  R('compressor-bay', 'Compressor Bay', P, 666, 318, 90, 222, 'Boil-off compressors and the crew ladder up to the bunks. Loud enough to hide footsteps.', { sub: 'BOIL-OFF', pattern: 'hatch', labelSize: 5.4 }),
  R('walk-w', 'Core Walk West', P, 340, 546, 140, 22, 'Walk under the control gallery to the lift landing.', { kind: 'cor' }),
  R('walk-e', 'Core Walk East', P, 620, 546, 140, 22, 'Walk under the compressor bay to the lift landing.', { kind: 'cor' }),
  R('lift-landing', 'Lift Landing', P, 480, 546, 140, 70, 'Foot of the spine lift from the hab ring. The lift goes no lower.', { labelSize: 5.4 }),
  R('tank-farm', 'He-3 Tank Farm', P, 360, 622, 380, 176, 'L3. Pressurised tanks that rupture as the rig sinks.', { kind: 'zone' }),
];

/* ─── Keel ─────────────────────────────────────────────────────────────── */
const K = 'keel';
export const keelRooms = [
  R('lift-cell-gallery', 'Lift-Cell Gallery', K, 236, 154, 628, 292, 'L4. Catwalks among the hydrogen cells over open sky. Imogen hides here; the acid breach.', { kind: 'zone' }),
  R('ladder-foot', 'Ladder Foot', K, 344, 452, 92, 80, 'Bottom of the crew ladder from the control gallery. Ration wrappers lead off in both directions.', { sub: 'WRAPPERS', labelSize: 5.2 }),
  R('reactor-crawlway', 'Reactor Crawlway', K, 352, 538, 26, 166, 'L4. Hot, cramped, the only route between ladder and sump.', { kind: 'passage' }),
  R('sump', 'Sump & Ballast', K, 384, 600, 332, 172, 'L4. The resin nest. Achebe and the cook set into the walls; ballast vents for the descent.', { kind: 'zone' }),
  R('escape-gondola', 'Escape Gondola', K, 504, 778, 92, 92, 'L4. Four-seat lifeboat; acid-buckled launch rail must be freed by hand.', { kind: 'zone' }),
];

export const tartarusRooms = [...upperRooms, ...processRooms, ...keelRooms];
const byId = Object.fromEntries(tartarusRooms.map((r) => [`${r.level}/${r.id}`, r]));
const rect = (level, id) => byId[`${level}/${id}`].rect;

/* Connectors between levels (same px on each level they appear on).
   `levels` lists where each is drawn, `labels` captions it per level. */
export const STAIRS = [
  { level: 'both', levels: ['upper', 'process'], x: 596, y: 584, type: 'elevator', label: 'SPINE LIFT',
    labels: { upper: 'LIFT ▼', process: 'LIFT ▲' } },
  { level: 'both', levels: ['upper', 'process'], x: 740, y: 330, type: 'ladder', label: 'CREW LADDER',
    labels: { upper: 'LADDER ▼', process: 'LADDER ▲' } },
  { level: 'both', levels: ['process', 'keel'], x: 362, y: 470, type: 'ladder', label: 'KEEL LADDER',
    labels: { process: 'KEEL ▼', keel: '' } },
];

const D = (level, from, to, side, t, locked = false, at = from) => ({ level, from, to, locked, ...edge(rect(level, at), side, t) });
export const tartarusDoors = [
  /* upper: landing wing */
  D(U, 'pad-a', 'apron', 'e', 0.5),
  D(U, 'pad-b', 'apron', 'w', 0.5),
  D(U, 'cold-cargo-hold', 'apron', 's', 0.3),
  D(U, 'decon-lock', 'apron', 'n', 0.5),
  D(U, 'decon-lock', 'ring-n', 's', 0.5),
  /* upper: hab ring */
  D(U, 'mess', 'ring-n', 'n', 0.5),
  D(U, 'mess', 'ring-w', 'w', 0.5),
  D(U, 'mess', 'ring-e', 'e', 0.5),
  D(U, 'mess', 'lift-lobby', 's', 0.5),
  D(U, 'lift-lobby', 'ring-s', 's', 0.3),
  D(U, 'ops-center', 'ring-w', 'e', 0.3, true),
  D(U, 'audit-suite', 'ring-w', 'e', 0.5),
  D(U, 'quiet-room', 'ring-w', 'e', 0.5),
  D(U, 'suit-room', 'ring-s', 'e', 0.074),
  D(U, 'bunk-corridor', 'ring-e', 'w', 0.5),
  D(U, 'infirmary', 'ring-e', 'w', 0.5, true),
  D(U, 'air-plant', 'ring-s', 'w', 0.074),
  D(U, 'survey-lab', 'ring-s', 'n', 0.5, true),
  /* process */
  D(P, 'scoop-intake', 'intake-walk', 's', 0.3),
  D(P, 'scoop-intake', 'intake-walk', 's', 0.7),
  D(P, 'control-gallery', 'intake-walk', 'n', 0.5),
  D(P, 'compressor-bay', 'intake-walk', 'n', 0.5),
  D(P, 'fraction-column', 'intake-walk', 'n', 0.5),
  D(P, 'fraction-column', 'control-gallery', 'w', 0.5),
  D(P, 'fraction-column', 'lift-landing', 's', 0.5),
  D(P, 'control-gallery', 'walk-w', 's', 0.5),
  D(P, 'compressor-bay', 'walk-e', 's', 0.5),
  D(P, 'lift-landing', 'walk-w', 'w', 0.3),
  D(P, 'lift-landing', 'walk-e', 'e', 0.3),
  D(P, 'tank-farm', 'lift-landing', 'n', 0.5),
  /* keel */
  D(K, 'ladder-foot', 'lift-cell-gallery', 'n', 0.6),
  D(K, 'ladder-foot', 'reactor-crawlway', 's', 0.228),
  D(K, 'sump', 'reactor-crawlway', 'w', 0.3),
  D(K, 'escape-gondola', 'sump', 'n', 0.5),
];

/* Floor vents of the hab ring (all return to the air plant), scoop ducts
   on the process deck, drains on the keel: the creature's roads. */
export const VENTS = {
  upper: [
    'M 520 476 L 520 494 L 470 494',
    'M 470 494 L 470 640 L 452 640 L 452 712 L 712 712 L 712 700',
    'M 712 420 L 712 470 L 652 470 L 652 690 L 712 690 L 712 700',
    'M 390 530 L 452 530 L 452 640',
  ],
  process: [
    'M 320 232 L 320 300',
    'M 780 232 L 780 300',
    'M 338 316 L 338 610 L 372 636',
    'M 762 316 L 762 610 L 728 636',
  ],
  keel: [
    'M 420 470 L 470 470 L 470 588 L 400 588',
    'M 716 650 L 744 650 L 744 470 L 640 470 L 640 446',
  ],
};
export const GRATES = {
  upper: [[520, 476], [712, 420], [390, 530], [712, 700]],
  process: [[320, 300], [780, 300], [372, 636], [728, 636]],
  keel: [[420, 470], [400, 588], [640, 446], [716, 650]],
};

/* Lift cells hung beneath the keel; the flank cells bulge past the deck. */
export const LIFT_CELLS = [
  { id: 1, cx: 300, cy: 420, rx: 64, ry: 96 },
  { id: 2, cx: 292, cy: 628, rx: 66, ry: 100 },
  { id: 3, cx: 800, cy: 420, rx: 64, ry: 96 },
  { id: 4, cx: 808, cy: 628, rx: 66, ry: 100 },
];

/* ─── Board data (normalized) ──────────────────────────────────────────── */
export const tartarusBoardRooms = boardRooms(
  tartarusRooms.map((r) => ({ ...r, id: `${r.level}-${r.id}` })), W, H,
);
export const tartarusBoardDoors = boardDoors(
  tartarusDoors.map((d) => ({ ...d, from: `${d.level}-${d.from}`, to: `${d.level}-${d.to}` })), W, H,
);
export const tartarusOutline = normPath(OUTLINE_PTS, W, H);
export const tartarusCrop = { x: r4(200 / W), y: r4(96 / H), w: r4(700 / W), h: r4(796 / H) };
export const tartarusSpawn = {
  pc: [r4(306 / W), r4(220 / H)],
  levels: {
    upper: { pc: [r4(306 / W), r4(220 / H)] },
    process: { pc: [r4(560 / W), r4(600 / H)] },
    keel: { pc: [r4(400 / W), r4(510 / H)] },
  },
};
