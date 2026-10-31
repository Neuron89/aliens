/* ═══════════════════════════════════════════════════════════════════════
   QARRAT KEEP — floor-plan GEOMETRY (JSX-free, node-importable).
   Single source for keep.jsx (MapEngine plan) and maps/index.js
   (normalized board rooms, doors, spawn). Canvas px, W×H.
   Three levels: ground floor, cistern vault (below) and roof.
   A compact square keep: thick outer wall, four corner bastions, a
   gatehouse in the south wall, and the colonnade as a north–south spine.
   ═══════════════════════════════════════════════════════════════════════ */
import { boardRooms, boardDoors, edge, normPath, pxPath, r4 } from './geometry.js';

export const W = 1100, H = 920;

export const LEVELS = [
  { id: 'ground', label: 'GROUND FLOOR', deck: 'G' },
  { id: 'cistern', label: 'CISTERN VAULT', deck: 'C' },
  { id: 'roof', label: 'ROOF', deck: 'R' },
];

/* Wall geometry (px). Outer wall face 262–838 × 128–790, inner face inset 22. */
export const WALL = { x0: 262, y0: 128, x1: 838, y1: 790, t: 22 };
export const INNER = { x0: 284, y0: 150, x1: 816, y1: 768 };
/* Corner bastions: squares projecting past the wall, outer corner chamfered. */
export const BASTIONS = [
  { id: 'nw', x: 228, y: 94, cx: 'l', cy: 't' },
  { id: 'ne', x: 798, y: 94, cx: 'r', cy: 't' },
  { id: 'se', x: 798, y: 750, cx: 'r', cy: 'b' },
  { id: 'sw', x: 228, y: 750, cx: 'l', cy: 'b' },
];
export const BASTION_SIZE = 74;
/* Gatehouse: projects through the south wall. */
export const GATEHOUSE = { x0: 494, x1: 606, y1: 818 };

export const OUTLINE_PTS = [
  // NW bastion
  [228, 112], [246, 94], [302, 94], [302, 128],
  // north wall → NE bastion
  [798, 128], [798, 94], [854, 94], [872, 112], [872, 168], [838, 168],
  // east wall → SE bastion
  [838, 750], [872, 750], [872, 806], [854, 824], [798, 824], [798, 790],
  // south wall → gatehouse
  [606, 790], [606, 818], [494, 818], [494, 790],
  // → SW bastion
  [302, 790], [302, 824], [246, 824], [228, 806], [228, 750], [262, 750],
  // west wall → back to NW bastion
  [262, 168], [228, 168],
];
export const OUTLINE = pxPath(OUTLINE_PTS);

const R = (id, name, level, x, y, w, h, note, draw = {}) => ({ id, name, level, rect: { x, y, w, h }, note, draw });

/* ─── Ground floor ─────────────────────────────────────────────────────── */
const G = 'ground';
export const groundRooms = [
  R('ramp-court', 'Ramp Court', G, 290, 156, 140, 170, 'Paved yard under an open roof-well. A plasteel ramp climbs from here to the thopter pad; fuel drums and tie-down rings line the walls.', { sub: 'RAMP TO ROOF PAD', fill: 'sand' }),
  R('great-hall', 'Great Hall', G, 438, 156, 254, 170, 'Audience chamber with a raised dais. Where the Assessor will be received in Act III.', { sub: 'DAIS · HEARTH · GALLERY', crew: true, icons: ['dune-banner'] }),
  R('counting-room', "Steward's Counting Room", G, 700, 156, 110, 170, 'Ledgers, spice tallies and water accounts. A second, hidden ledger sits behind a loose wall panel.', { sub: 'LEDGERS', crew: true, icons: ['restricted'], labelSize: 5.4 }),
  R('north-gallery', 'North Gallery', G, 290, 332, 520, 18, 'Cross-passage under the hall gallery, joining the ramp court, the great hall, the counting room, the kitchens and the conservatory to the colonnade.', { kind: 'cor' }),
  R('colonnade', 'Colonnade', G, 528, 350, 44, 340, 'The keep’s spine; every room opens onto it. Shield-doors can seal any section.', { kind: 'cor' }),
  R('conservatory', 'Conservatory', G, 290, 356, 232, 166, 'Date palms and dew traps — an extravagant show of water wealth for guests.', { sub: 'DATE PALMS · DEW TRAPS', icons: ['dune-palm', 'dune-water'], shape: 'octagon', fill: 'garden' }),
  R('guard-room', 'Guard Room', G, 290, 530, 232, 134, 'Armory and duty roster. The roster for the night of the murder has a forged entry.', { sub: 'ARMORY · DUTY ROSTER', icons: ['weapon', 'dune-shield'] }),
  R('barracks', 'Barracks', G, 290, 672, 200, 92, 'Bunks for the night watch beside the gate. Whoever slept through the second hour before dawn slept here.', { sub: 'NIGHT WATCH', crew: true, icons: ['dune-bed'] }),
  R('outer-gate', 'Outer Gate', G, 498, 698, 104, 114, 'Double-door sand-lock with a water-seal. Logs every opening — or should.', { sub: 'SAND-LOCK', icons: ['dune-water'], labelSize: 6 }),
  R('kitchens', "Kitchens & Servants' Stair", G, 578, 356, 232, 184, 'The only internal route down to the cistern that avoids the guard room.', { sub: 'OVENS · STAIR ▼ CISTERN', icons: ['dune-fire'], labelSize: 5.8 }),
  R('guest-wing', 'Guest Wing', G, 578, 548, 232, 116, 'Three rooms. The Fremen envoy refuses to sleep here; the Assessor will demand the best one.', { sub: '3 ROOMS', crew: true, icons: ['dune-bed'] }),
  R('water-office', 'Water Office', G, 610, 672, 200, 92, 'Hadi Moussan’s counter. The town buys its ration through a grille in the outer wall; scales, seals and tally-books sit behind it.', { sub: 'RATION GRILLE', icons: ['dune-water'] }),
];

/* ─── Cistern vault (below) ────────────────────────────────────────────── */
const C = 'cistern';
export const cisternRooms = [
  R('spice-store', 'Spice Store', C, 290, 156, 222, 184, 'Bonded store for the quarterly consignment, in Quota Office crates. The racks hold sixty percent of contract; the empty bays are plain to anyone who counts.', { sub: 'QUOTA CRATES', icons: ['restricted'], pattern: 'hatch' }),
  R('sluice-room', 'Sluice Room', C, 520, 156, 292, 136, 'Where the windtrap feed from the roof enters the vault. Valves, filters and a tally-meter that records every litre in.', { sub: 'WINDTRAP FEED · VALVES', icons: ['dune-water'], pattern: 'hatch' }),
  R('undercroft', 'Undercroft Passage', C, 324, 340, 26, 260, 'Low rock passage from the guard stair to the stores and the archive.', { kind: 'cor' }),
  R('archive', 'Archive', C, 358, 348, 154, 244, 'Forty years of water-sale ledgers in sealed cases. Dry, dusty and rarely visited.', { sub: 'OLD LEDGERS', crew: true }),
  R('guard-stair-foot', 'Guard Stair Foot', C, 290, 600, 150, 100, 'Foot of the official stair from the guard room. A guard should sit here; the log says one did.', { sub: 'LOGGED ENTRY', icons: ['dune-eye'], labelSize: 5.4 }),
  R('vault-passage', 'Vault Passage', C, 440, 646, 80, 22, 'Short passage to the vault door. The door is barred from the guard side.', { kind: 'cor' }),
  R('cistern-vault', 'Cistern Vault', C, 520, 300, 200, 400, 'Below the kitchens. Forty-one thousand litres of town water. The drowned man was found here.', { sub: '41,000 L', icons: ['dune-water', 'restricted'], fill: 'water' }),
  R('servants-stair-foot', "Servants' Stair Foot", C, 728, 456, 84, 128, 'Where the servants’ stair from the kitchens meets the vault. The bar on its door was found lifted.', { sub: 'FROM KITCHENS', labelSize: 4.2 }),
  R('pump-room', 'Pump Room', C, 520, 708, 292, 56, 'Hand pumps and the town main. Every ration sold at the grille is drawn from here.', { sub: 'TOWN MAIN ▼', icons: ['dune-water'], pattern: 'hatch' }),
];

/* ─── Roof ─────────────────────────────────────────────────────────────── */
const RF = 'roof';
export const roofRooms = [
  R('wall-walk-n', 'North Wall Walk', RF, 284, 128, 532, 22, 'Parapet walk on the north wall, facing the Shield Wall scarp.', { kind: 'cor' }),
  R('wall-walk-w', 'West Wall Walk', RF, 262, 150, 22, 618, 'Parapet walk on the west wall.', { kind: 'cor' }),
  R('wall-walk-e', 'East Wall Walk', RF, 816, 150, 22, 618, 'Parapet walk on the east wall.', { kind: 'cor' }),
  R('wall-walk-sw', 'South Walk', RF, 284, 768, 212, 22, 'Parapet walk on the south wall, west of the gate tower.', { kind: 'cor' }),
  R('wall-walk-se', 'South Walk East', RF, 604, 768, 212, 22, 'Parapet walk on the south wall, east of the gate tower.', { kind: 'cor' }),
  R('bastion-nw', 'NW Bastion', RF, 232, 98, 52, 52, 'Corner lookout over the Shield Wall approach.', { shape: 'octagon', labelSize: 4.4 }),
  R('bastion-ne', 'NE Bastion', RF, 816, 98, 52, 52, 'Corner lookout over the scarp and the spice-yard track.', { shape: 'octagon', labelSize: 4.4 }),
  R('bastion-se', 'SE Bastion', RF, 816, 768, 52, 52, 'Corner lookout over Qarrat Town.', { shape: 'octagon', labelSize: 4.4 }),
  R('bastion-sw', 'SW Bastion', RF, 232, 768, 52, 52, 'Corner lookout over the gate road.', { shape: 'octagon', labelSize: 4.4 }),
  R('roof-walk', 'Roof Walk', RF, 528, 150, 44, 618, 'Covered walk on the ridge above the colonnade, joining every part of the roof.', { kind: 'cor' }),
  R('thopter-pad', 'Thopter Pad', RF, 290, 156, 230, 284, 'Roof landing reached by a ramp. One serviceable ornithopter and one that is not.', { sub: 'TWO CRAFT', shape: 'circle', icons: ['dune-thopter'] }),
  R('shield-generator', 'Shield Generator', RF, 290, 448, 230, 172, 'The keep’s single shield generator, housed in a sand-proof shed. It runs; it is overdue for service.', { sub: 'KEEP SHIELD', icons: ['dune-shield', 'restricted'], pattern: 'hatch' }),
  R('signal-platform', 'Signal Platform', RF, 290, 628, 230, 134, 'Heliograph mirrors and a night lamp facing Qarrat Town. The night watch should be here.', { sub: 'HELIOGRAPH', icons: ['dune-eye'] }),
  R('ladys-solar', 'Lady’s Solar', RF, 580, 156, 230, 174, 'Lady Senna’s rooms in the tower above the counting room. If the hunter-seeker finds no ledger, it comes here.', { sub: 'LADY SENNA', crew: true, icons: ['dune-bed', 'restricted'] }),
  R('windtrap', 'Windtrap', RF, 580, 338, 230, 202, 'Condenser fins and dew-collectors feeding the cistern through the sluice room. The servants’ stair tops out here.', { sub: 'CONDENSERS · STAIR', icons: ['dune-water'], pattern: 'hatch' }),
  R('guest-terrace', 'Guest Terrace', RF, 580, 548, 230, 214, 'Shaded terrace over the guest wing. It overlooks the gate, and the gate overlooks it.', { sub: 'SHADE SAILS', crew: true }),
  R('gate-tower', 'Gate Tower', RF, 496, 768, 108, 48, 'Parapet over the sand-lock, looking down the road to Qarrat Town.', { sub: 'OVER THE GATE', labelSize: 5.2 }),
];

export const keepRooms = [...groundRooms, ...cisternRooms, ...roofRooms];
const byId = Object.fromEntries(keepRooms.map((r) => [`${r.level}/${r.id}`, r]));
const rect = (level, id) => byId[`${level}/${id}`].rect;

/* Stairs. `level: 'both'` marks a connector between levels; `levels` lists
   which levels it is drawn on and `labels` gives each level its own caption. */
export const STAIRS = [
  { level: 'both', levels: ['ground', 'roof'], x: 330, y: 296, type: 'ladder', label: 'RAMP',
    labels: { ground: 'RAMP ▲ PAD', roof: 'RAMP ▼ COURT' } },
  { level: 'both', levels: ['ground', 'cistern', 'roof'], x: 784, y: 476, type: 'ladder', label: 'SERVANTS’ STAIR',
    labels: { ground: 'SERVANTS’ STAIR', cistern: 'SERVANTS’ STAIR', roof: 'SERVANTS’ STAIR' } },
  { level: 'both', levels: ['ground', 'cistern'], x: 312, y: 618, type: 'ladder', label: 'GUARD STAIR',
    labels: { ground: 'GUARD STAIR ▼', cistern: 'GUARD STAIR ▲' } },
];

const D = (level, from, to, side, t, locked = false, at = from) => ({ level, from, to, locked, ...edge(rect(level, at), side, t) });
export const keepDoors = [
  /* ground */
  D(G, 'ramp-court', 'north-gallery', 's', 0.62),
  D(G, 'great-hall', 'ramp-court', 'w', 0.55),
  D(G, 'great-hall', 'north-gallery', 's', 0.5),
  D(G, 'great-hall', 'north-gallery', 's', 0.18),
  D(G, 'great-hall', 'north-gallery', 's', 0.82),
  D(G, 'counting-room', 'north-gallery', 's', 0.5, true),
  D(G, 'counting-room', 'great-hall', 'w', 0.55, true),
  D(G, 'conservatory', 'north-gallery', 'n', 0.5),
  D(G, 'conservatory', 'colonnade', 'e', 0.5),
  D(G, 'kitchens', 'north-gallery', 'n', 0.25),
  D(G, 'kitchens', 'colonnade', 'w', 0.5),
  D(G, 'guard-room', 'colonnade', 'e', 0.5),
  D(G, 'guest-wing', 'colonnade', 'w', 0.5),
  D(G, 'kitchens', 'guest-wing', 's', 0.5),
  D(G, 'guard-room', 'barracks', 's', 0.4),
  D(G, 'outer-gate', 'colonnade', 'n', 0.5),
  D(G, 'barracks', 'outer-gate', 'e', 0.45),
  D(G, 'water-office', 'outer-gate', 'w', 0.45, true),
  /* cistern */
  D(C, 'guard-stair-foot', 'undercroft', 'n', 0.313),
  D(C, 'spice-store', 'undercroft', 's', 0.2072, true),
  D(C, 'archive', 'undercroft', 'w', 0.5),
  D(C, 'guard-stair-foot', 'vault-passage', 'e', 0.57),
  D(C, 'cistern-vault', 'vault-passage', 'w', 0.8925, true),
  D(C, 'servants-stair-foot', 'cistern-vault', 'w', 0.5),
  D(C, 'cistern-vault', 'sluice-room', 'n', 0.6),
  D(C, 'cistern-vault', 'pump-room', 's', 0.5, true),
  /* roof */
  D(RF, 'bastion-nw', 'wall-walk-n', 'e', 0.7),
  D(RF, 'bastion-nw', 'wall-walk-w', 's', 0.7),
  D(RF, 'bastion-ne', 'wall-walk-n', 'w', 0.7),
  D(RF, 'bastion-ne', 'wall-walk-e', 's', 0.3),
  D(RF, 'bastion-se', 'wall-walk-e', 'n', 0.3),
  D(RF, 'bastion-se', 'wall-walk-se', 'w', 0.3),
  D(RF, 'bastion-sw', 'wall-walk-w', 'n', 0.7),
  D(RF, 'bastion-sw', 'wall-walk-sw', 'e', 0.3),
  D(RF, 'gate-tower', 'wall-walk-sw', 'w', 0.3),
  D(RF, 'gate-tower', 'wall-walk-se', 'e', 0.3),
  D(RF, 'gate-tower', 'roof-walk', 'n', 0.5),
  D(RF, 'thopter-pad', 'roof-walk', 'e', 0.5),
  D(RF, 'thopter-pad', 'wall-walk-w', 'w', 0.8),
  D(RF, 'shield-generator', 'roof-walk', 'e', 0.5, true),
  D(RF, 'signal-platform', 'roof-walk', 'e', 0.5),
  D(RF, 'ladys-solar', 'roof-walk', 'w', 0.5, true),
  D(RF, 'windtrap', 'roof-walk', 'w', 0.3),
  D(RF, 'guest-terrace', 'roof-walk', 'w', 0.5),
];

/* Water conduits on the cistern level (windtrap feed in, town main out). */
export const CONDUITS = [
  'M 790 160 L 790 270 L 690 270 L 690 330',
  'M 560 560 L 560 690 L 600 690 L 600 712',
  'M 760 764 L 760 812',
];
export const CONDUIT_GRATES = [[790, 166], [690, 330], [600, 712], [760, 764]];

/* ─── Board data (normalized) ──────────────────────────────────────────── */
export const keepBoardRooms = boardRooms(
  keepRooms.map((r) => ({ ...r, id: `${r.level}-${r.id}` })), W, H,
);
export const keepBoardDoors = boardDoors(
  keepDoors.map((d) => ({ ...d, from: `${d.level}-${d.from}`, to: `${d.level}-${d.to}` })), W, H,
);
export const keepOutline = normPath(OUTLINE_PTS, W, H);
export const keepCrop = { x: r4(206 / W), y: r4(70 / H), w: r4(688 / W), h: r4(790 / H) };
export const keepSpawn = {
  pc: [r4(550 / W), r4(760 / H)],
  levels: {
    ground: { pc: [r4(550 / W), r4(760 / H)] },
    cistern: { pc: [r4(380 / W), r4(684 / H)] },
    roof: { pc: [r4(405 / W), r4(360 / H)] },
  },
};
