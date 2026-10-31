/* ═══════════════════════════════════════════════════════════════════════
   THE LANTERN RING — deck GEOMETRY (JSX-free, node-importable).
   Single source for lantern.jsx (MapEngine plan) and maps/index.js
   (normalized board rooms, doors, spawn). Canvas px, W×H. One level.

   The passenger-reachable section of the heighliner Long Vesper's ring,
   drawn as a horseshoe: two straight runs of berths (A–C on the north run,
   D–F on the south run) bent around the spinward apex where the Guild
   Gallery and the Navigator's tank sit. The open end of the horseshoe is
   the great viewport onto the hold. Hit regions are axis-aligned rects;
   the curve is carried by the hull and the decoration in lantern.jsx.
   ═══════════════════════════════════════════════════════════════════════ */
import { boardRooms, boardDoors, edge, normPath, pxPath, r4 } from './geometry.js';

export const W = 1100, H = 920;
export const LEVELS = [{ id: 'ring', label: 'PASSENGER RING', deck: 'L' }];

/* Ring frame (px). The apex arc is centred on O; the two runs are straight. */
export const O = [555, 515];          // centre of the spinward apex arc
export const R_OUT = 330;             // hull, outer face
export const R_IN = 314;              // hull, inner face
export const TOP = 108;               // bulkhead line at the open end
export const VIEW = { cx: 555, cy: TOP, r: 92 }; // great viewport bite at the open end

export const arcPts = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => {
  const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
  return [Math.round((cx + Math.cos(a) * r) * 10) / 10, Math.round((cy + Math.sin(a) * r) * 10) / 10];
});

/* Horseshoe outline: across the north bulkhead, round the viewport bite,
   across the south bulkhead, down the south run, round the apex, up the north run. */
export const OUTLINE_PTS = [
  [O[0] - R_OUT, TOP], [VIEW.cx - VIEW.r, TOP],
  ...arcPts(VIEW.cx, VIEW.cy, VIEW.r, 180, 0, 12).slice(1, -1),
  [VIEW.cx + VIEW.r, TOP], [O[0] + R_OUT, TOP],
  ...arcPts(O[0], O[1], R_OUT, 0, 180, 24),
];
export const OUTLINE = pxPath(OUTLINE_PTS);

/* Column grid (px): spine | berths | promenade | berths | spine */
const SPW = 245, SPE = 843, SP_W = 22;      // spine runs
const BW = 271, BE = 689, B_W = 150;        // berth columns
const PX = 425, P_W = 260;                  // promenade / gallery column (425–685)
const ROW = [[118, 140], [264, 140], [410, 142]]; // berth rows (y, h)
export const LOW = 560;                     // spine bends / gallery top

const L = 'ring';
const R = (id, name, x, y, w, h, note, draw = {}) => ({ id, name, level: L, rect: { x, y, w, h }, note, draw });

export const lanternRooms = [
  /* ── north run (A–C) ── */
  R('berth-a', 'Berth A', BW, ROW[0][0], B_W, ROW[0][1],
    'Attaché Ruul, Skerrit Vol and the House Morvane delegation. Ruul and Mentat Kesh met here at the second hour of night three.',
    { sub: 'HARKONNEN ATTACHÉ', sub2: 'HOUSE MORVANE', crew: true, icons: ['dune-banner'] }),
  R('berth-b', 'Berth B', BW, ROW[1][0], B_W, ROW[1][1],
    'Magister Vantroy’s suite (spliced seal-plate, the Ixian lattice) and the Reverend Mother’s suite. Source of the Act II shield failure.',
    { sub: 'THE RICHESE SUITE', sub2: 'VANTROY · REVEREND MOTHER', crew: true, icons: ['dune-shield'] }),
  R('berth-c', 'Berth C', BW, ROW[2][0], B_W, ROW[2][1],
    'House Teshrin and House Abrel. Weapon rack by the door; the factor’s cargo niche holds the humming case.',
    { sub: 'THE WREN’S BERTH', sub2: 'TESHRIN · ABREL', crew: true, icons: ['weapon'] }),
  /* ── south run (D–F) ── */
  R('berth-d', 'Berth D', BE, ROW[0][0], B_W, ROW[0][1],
    'Auditor Vayle and his clerk among two minor Houses. Vayle dies here during the blackout.',
    { sub: 'CHOAM AUDITOR', sub2: 'TWO MINOR HOUSES', crew: true, icons: ['dune-snooper'] }),
  R('berth-e', 'Berth E', BE, ROW[1][0], B_W, ROW[1][1],
    'The liaison’s cell. Sealed from within; Ferrant’s body; the reclamation duct to the south spine.',
    { sub: 'THE LIAISON’S CELL', sub2: 'SEALED FROM WITHIN', crew: true, icons: ['restricted'] }),
  R('berth-f', 'Berth F', BE, ROW[2][0], B_W, ROW[2][1],
    'Ammar Sheth’s water-sealed cabin, with a dew trap rigged in its duct to the south spine.',
    { sub: 'THE WATER-SEALED CABIN', sub2: 'FREMEN ENVOY', crew: true, icons: ['dune-water'] }),
  /* ── the public court ── */
  R('promenade', 'The Promenade', PX, 118, P_W, LOW - 4 - 118,
    'Fountain, Ruul’s salon, the ring’s public court. Scene of the duel provocation and the blackout.',
    { labelAt: [555, 250], sub: 'THE RING’S PUBLIC COURT' }),
  /* ── Guild ── */
  R('guild-gallery', 'The Guild Gallery', PX, LOW, P_W, 240,
    'Proctor post, seal-board, air and light controls, and the window onto the Navigator’s tank. Act III.',
    { labelAt: [555, 592], sub: 'GUILD-SEALED', icons: ['restricted', 'lantern-seal'] }),
  R('reclamation-plant', 'Reclamation Plant', 295, 586, 126, 98,
    'Guild-only. Every berth’s reclamation duct drains here by way of the spine: condensers, still-columns and the ring’s water ledger.',
    { sub: 'GUILD-SEALED', icons: ['dune-water'], pattern: 'hatch', labelSize: 5.2 }),
  R('air-plant', 'Air Plant', 689, 586, 126, 98,
    'Guild-only. Scrubbers and the light governors for the whole ring, run from the gallery. When the proctors ration air, it happens here.',
    { sub: 'GUILD-SEALED', icons: ['lantern-hatch'], pattern: 'hatch', labelSize: 5.2 }),
  /* ── the service spine (hidden crawlways behind the berths) ── */
  R('service-spine', 'The Service Spine', SPW, 118, SP_W, LOW - 4 - 118,
    'North and south crawlways behind the berths, meeting at the gallery. The Face Dancer’s road, and Ebbe Lunn’s alcove.',
    { kind: 'passage', label: 'SERVICE SPINE · NORTH RUN' }),
  R('spine-bend-north', 'North Spine Bend', 251, LOW, PX - 4 - 251, SP_W,
    'Where the north crawlway bends toward the gallery: warm pipes, a dripping condenser, and a sealed hatch into the gallery.',
    { kind: 'passage', label: 'NORTH BEND' }),
  R('service-spine-south', 'Service Spine (South Run)', SPE, 118, SP_W, LOW - 4 - 118,
    'The south crawlway behind Berths D, E and F, where their reclamation ducts meet. Steward Ebbe Lunn lies bound in a reclamation alcove here.',
    { kind: 'passage', label: 'SERVICE SPINE · SOUTH RUN' }),
  R('spine-bend-south', 'South Spine Bend', PX + P_W + 4, LOW, 859 - (PX + P_W + 4), SP_W,
    'Where the south crawlway bends toward the gallery. The gallery duct opens off it.',
    { kind: 'passage', label: 'SOUTH BEND' }),
];

const byId = Object.fromEntries(lanternRooms.map((r) => [r.id, r]));
const rect = (id) => byId[id].rect;
/* kind 'duct' marks a reclamation grille or crawl duct (drawn as a hatch, not a door). */
const D = (from, to, side, t, locked = false, kind) => ({ level: L, from, to, locked, ...(kind ? { kind } : {}), ...edge(rect(from), side, t) });

export const lanternDoors = [
  /* berth doors onto the promenade */
  D('berth-a', 'promenade', 'e', 0.5),
  D('berth-b', 'promenade', 'e', 0.5),
  D('berth-c', 'promenade', 'e', 0.42),
  D('berth-d', 'promenade', 'w', 0.5),
  D('berth-e', 'promenade', 'w', 0.5, true),
  D('berth-f', 'promenade', 'w', 0.42),
  /* reclamation ducts into the spine */
  D('berth-a', 'service-spine', 'w', 0.74, false, 'duct'),
  D('berth-b', 'service-spine', 'w', 0.74, false, 'duct'),
  D('berth-c', 'service-spine', 'w', 0.74, false, 'duct'),
  D('berth-d', 'service-spine-south', 'e', 0.74, false, 'duct'),
  D('berth-e', 'service-spine-south', 'e', 0.74, false, 'duct'),
  D('berth-f', 'service-spine-south', 'e', 0.74, false, 'duct'),
  /* spine bends, plants and the gallery */
  D('service-spine', 'spine-bend-north', 's', 0.62),
  D('service-spine-south', 'spine-bend-south', 's', 0.38),
  D('spine-bend-north', 'guild-gallery', 'e', 0.5, true),
  D('spine-bend-south', 'guild-gallery', 'w', 0.5, false, 'duct'),
  D('spine-bend-north', 'reclamation-plant', 's', 0.62, true),
  D('spine-bend-south', 'air-plant', 's', 0.34, true),
  D('reclamation-plant', 'guild-gallery', 'e', 0.55, true),
  D('air-plant', 'guild-gallery', 'w', 0.55, true),
  /* the gallery lock: sealed to passengers */
  D('promenade', 'guild-gallery', 's', 0.5, true),
];
export const STAIRS = [];

/* ─── Board data (normalized) ────────────────────────────────────────────────── */
export const lanternBoardRooms = boardRooms(lanternRooms, W, H);
export const lanternBoardDoors = boardDoors(lanternDoors, W, H);
export const lanternOutline = normPath(OUTLINE_PTS, W, H);
export const lanternCrop = { x: r4(205 / W), y: r4(70 / H), w: r4(700 / W), h: r4(795 / H) };
export const lanternSpawn = { pc: [r4(480 / W), r4(330 / H)], levels: { ring: { pc: [r4(480 / W), r4(330 / H)] } } };
