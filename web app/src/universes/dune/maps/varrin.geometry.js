/* ═══════════════════════════════════════════════════════════════════════
   THE VARRIN RESIDENCY — floor-plan GEOMETRY (JSX-free, node-importable).
   Single source for varrin.jsx (MapEngine plan) and maps/index.js
   (normalized board rooms, doors, spawn). Canvas px, W×H.

   A courtyard house: every public room opens onto the open-air Dining
   Court; the octagonal Great Hall closes the north side, the Guest Wing
   the west, the locked Lord’s wing and the glass-domed Conservatory the
   east, the entry and the sunken Shield-Generator Vault the south.
   Hidden servant passages run inside the outer walls and down the west
   side of the court (the operator’s post behind the spiceport tapestry).
   Two levels: ground floor, and upper floor & roof (Lord’s Chambers,
   ornithopter pad, parapet walk round the court).
   ═══════════════════════════════════════════════════════════════════════ */
import { boardRooms, boardDoors, edge, normPath, pxPath, r4 } from './geometry.js';

export const W = 1100, H = 920;

export const LEVELS = [
  { id: 'ground', label: 'GROUND FLOOR', deck: 'G' },
  { id: 'roof', label: 'UPPER FLOOR & ROOF', deck: 'R' },
];

/* Column grid (px):
   outer W passage 256–272 | west wing 272–412 | inner passage 412–428 |
   court 428–704 | east wing 704–864 | outer E passage 864–880.
   Rows: N passage 120–136 | north range 136–344 | court 344–570 | south 570–700. */
const XW = 272, XC = 428, XE = 704, XO = 864;

/* House wall with chamfered corner bastions, plus the walled forecourt. */
export const OUTLINE_PTS = [
  [262, 110], [874, 110], [890, 126], [890, 694], [874, 710],
  [726, 710], [726, 814], [712, 828], [564, 828], [550, 814], [550, 710],
  [262, 710], [246, 694], [246, 126],
];
export const OUTLINE = pxPath(OUTLINE_PTS);

const R = (id, name, level, x, y, w, h, note, draw = {}) => ({ id, name, level, rect: { x, y, w, h }, note, draw });

/* ─── Ground floor ─────────────────────────────────────────────────────── */
const G = 'ground';
export const groundRooms = [
  /* hidden passages inside the outer walls */
  R('north-passage', 'North Servant Passage', G, 256, 120, 624, 16, 'A hidden passage behind the dais. A servant can step out behind the Varrin Scale without crossing the hall floor.', { kind: 'passage' }),
  R('west-passage', 'West Servant Passage', G, 256, 136, 16, 564, 'Runs behind the guest suites. Every suite has a servant door on this side, and none of them lock.', { kind: 'passage' }),
  R('east-passage', 'East Servant Passage', G, XO, 136, 16, 564, 'Behind the Lord’s wing, the conservatory and the Steward’s office. Pell walks this one every night with a lamp he never lights.', { kind: 'passage' }),
  R('servant-passages', 'Servant Passages', G, 412, 344, 16, 356, 'Hidden doors into every room, the kitchens and the water gate. Pell’s domain, and Ixa’s way out to the desert.', { kind: 'passage' }),

  /* north range */
  R('guest-wing', 'Guest Wing', G, XW, 136, 140, 274, 'Suites for the Guild envoy, Ser Ulmar, the Judge and the CHOAM factor. Ilsabet’s escrow copy is in her writing case.', { sub: '4 SUITES · GALLERY', crew: true, icons: ['dune-bed'] }),
  R('great-hall', 'Great Hall', G, 412, 136, 292, 208, 'Reception floor and the dais with the ceremonial Varrin Scale. The Judge sits here at dawn in Act III.', { sub: 'DAIS · THE VARRIN SCALE', crew: true, shape: 'octagon' }),
  R('lords-antechamber', 'Lord’s Antechamber', G, XE, 136, 160, 164, 'The door to the private wing. Two household guards, the Lord’s stair, and a bench where petitioners wait to be refused.', { sub: 'PRIVATE WING · LOCKED', crew: true, icons: ['restricted'] }),

  /* the court and the east side */
  R('dining-court', 'Dining Court', G, XC, 344, 276, 226, 'The toast and the hunter-seeker in Act I. A hidden servant door behind the spiceport tapestry gives the operator his line of sight.', { sub: 'OPEN AIR · PAINTED AWNINGS', fill: 'sand', icons: ['dune-snooper', 'dune-water'] }),
  R('conservatory', 'Conservatory', G, XE, 300, 160, 260, 'Date palms, dew-glass and a fountain basin. The duel under the forms is fought here at the middle hour.', { sub: 'GLASS DOME · DUELLING FLOOR', shape: 'octagon', fill: 'garden' }),

  /* west side: kitchens and yard */
  R('kitchens', 'Kitchens', G, XW, 410, 140, 150, 'Ovens, cold stores and the water-service crystal. Every dish for the court goes out through the servant passage, never across the court.', { sub: 'OVENS · COLD STORE', icons: ['dune-fire'] }),
  R('kitchen-yard', 'Kitchen Yard & Water Gate', G, XW, 560, 140, 140, 'Hot stone, onions and the water-sellers’ gate to the spiceport road. Ixa of Sietch Tamrak sits here on her skins.', { sub: 'OPEN AIR · IXA’S SKINS', fill: 'sand', labelSize: 5.6, icons: ['dune-water'] }),

  /* south range */
  R('shield-vault', 'Shield-Generator Vault', G, XC, 570, 136, 130, 'Below the kitchens, reached by the servant stair. The lasgun, the Black Tally and the Lord’s private box with the deed are here in Act II.', { sub: 'BELOW GRADE · TWO KEYS', pattern: 'hatch', labelSize: 5.4, icons: ['dune-shield', 'restricted'] }),
  R('entry-hall', 'Entry Hall', G, 564, 570, 140, 130, 'Shield-doors from the forecourt. The herald calls each delegation here, in an order that is itself a message.', { sub: 'HERALD · SHIELD-DOORS', crew: true }),
  R('stewards-office', 'Steward’s Office', G, XE, 560, 160, 140, 'Pell’s ledgers, the household keys and the seating plan. One of the two vault keys hangs here; the other is on the Lord.', { sub: 'KEYS · SEATING PLAN', crew: true, icons: ['dune-eye'] }),
  R('forecourt', 'Forecourt & Shield-Gate', G, 556, 700, 164, 120, 'Walled court before the shield-gate. Delegations walk through the field one at a time, slowly.', { sub: 'OPEN AIR', fill: 'sand', labelSize: 5.4 }),
];

/* ─── Upper floor & roof ───────────────────────────────────────────────── */
const RF = 'roof';
export const roofRooms = [
  R('thopter-pad', 'Roof Ornithopter Pad', RF, XW, 136, 140, 334, 'Reached by lift from the great hall. Ulmar’s craft waits here; the escape route in Act III if the house shield is down.', { sub: '3 CRAFT · BEACON', icons: ['dune-thopter'], labelSize: 5.6 }),
  R('hall-roof', 'Great Hall Roof', RF, 412, 136, 292, 194, 'Lead roof and the lantern of slit windows over the hall. From the lantern you can watch the dais unseen.', { sub: 'LANTERN · SLIT WINDOWS', shape: 'octagon', pattern: 'hatch' }),
  R('parapet-walk', 'Parapet Walk', RF, 412, 330, 292, 14, 'Walk round the open court. From here every seat at the Varrin table can be seen, and heard.', { kind: 'cor' }),
  R('west-parapet', 'West Parapet', RF, 412, 344, 16, 226, 'West side of the court parapet; the servants’ stair comes up here.', { kind: 'cor' }),
  R('east-parapet', 'East Parapet', RF, 688, 344, 16, 226, 'East side of the court parapet, above the conservatory arch; the court stair comes up here.', { kind: 'cor' }),
  R('south-parapet', 'South Parapet', RF, 412, 570, 292, 14, 'South side of the court parapet, over the shield-vault.', { kind: 'cor' }),
  R('lords-chambers', 'Lord’s Chambers', RF, XE, 136, 160, 208, 'Castor’s sickroom on the upper floor. The griffin decanter and the Nightcap scene.', { sub: 'SICKROOM · UPPER FLOOR', crew: true, icons: ['dune-bed', 'dune-snooper'] }),
  R('conservatory-dome', 'Conservatory Dome', RF, XE, 344, 160, 216, 'The glass dome over the conservatory. Walkable on the ribs only; from here the duel is a ring of shimmer under your feet.', { sub: 'GLASS — RIBS ONLY', shape: 'octagon', fill: 'glass' }),
  R('windtrap', 'Windtrap', RF, XW, 470, 140, 230, 'Condenser fins over the kitchens. It feeds the court fountain, which wastes in a night what a sietch drinks in a week.', { sub: 'CONDENSERS', pattern: 'hatch', icons: ['dune-water'] }),
  R('heralds-terrace', 'Herald’s Terrace', RF, XC, 584, 276, 116, 'Terrace over the entry and the vault, looking down on the forecourt and the shield-gate.', { sub: 'OVER THE SHIELD-GATE', icons: ['dune-eye'] }),
  R('watch-turret', 'Watch Turret', RF, XE, 560, 160, 140, 'Corner turret over the Steward’s office. The house beacon, and a long view over the Carthag spiceport.', { sub: 'BEACON · SPICEPORT VIEW', icons: ['dune-eye'] }),
];

export const varrinRooms = [...groundRooms, ...roofRooms];
const byId = Object.fromEntries(varrinRooms.map((r) => [`${r.level}/${r.id}`, r]));
const rect = (level, id) => byId[`${level}/${id}`].rect;

/* Stairs and the lift connect the two levels at the same position. */
export const STAIRS = [
  { level: 'both', x: 412, y: 196, type: 'elevator', label: 'LIFT' },
  { level: 'both', x: 842, y: 164, type: 'ladder', label: 'LORD’S STAIR' },
  { level: 'both', x: 420, y: 436, type: 'ladder', label: 'SERVANTS’ STAIR' },
  { level: 'both', x: 696, y: 392, type: 'ladder', label: 'COURT STAIR' },
];

const ty = (r, y) => (y - r.y) / r.h;
const tx = (r, x) => (x - r.x) / r.w;
const D = (level, from, to, side, t, locked = false, at = from) => ({ level, from, to, locked, ...edge(rect(level, at), side, t) });
const gp = (id) => rect(G, id);
const rp = (id) => rect(RF, id);

export const varrinDoors = [
  /* ground — public routes */
  D(G, 'great-hall', 'dining-court', 's', 0.5),
  D(G, 'guest-wing', 'great-hall', 'e', ty(gp('guest-wing'), 268)),
  D(G, 'lords-antechamber', 'great-hall', 'w', ty(gp('lords-antechamber'), 240), true),
  D(G, 'lords-antechamber', 'conservatory', 's', 0.5, true),
  D(G, 'conservatory', 'dining-court', 'w', ty(gp('conservatory'), 470)),
  D(G, 'dining-court', 'entry-hall', 's', tx(gp('dining-court'), 634)),
  D(G, 'entry-hall', 'forecourt', 's', 0.5),
  D(G, 'entry-hall', 'stewards-office', 'e', 0.5),
  D(G, 'kitchens', 'kitchen-yard', 's', 0.5),
  /* ground — hidden servant doors */
  D(G, 'dining-court', 'servant-passages', 'w', ty(gp('dining-court'), 486)),
  D(G, 'servant-passages', 'guest-wing', 'w', ty(gp('servant-passages'), 376)),
  D(G, 'servant-passages', 'kitchens', 'w', ty(gp('servant-passages'), 506)),
  D(G, 'servant-passages', 'kitchen-yard', 'w', ty(gp('servant-passages'), 640)),
  D(G, 'servant-passages', 'shield-vault', 'e', ty(gp('servant-passages'), 652), true),
  D(G, 'north-passage', 'great-hall', 's', 0.5),
  D(G, 'west-passage', 'guest-wing', 'e', ty(gp('west-passage'), 180)),
  D(G, 'west-passage', 'guest-wing', 'e', ty(gp('west-passage'), 360)),
  D(G, 'west-passage', 'kitchens', 'e', ty(gp('west-passage'), 486)),
  D(G, 'west-passage', 'kitchen-yard', 'e', ty(gp('west-passage'), 630)),
  D(G, 'east-passage', 'lords-antechamber', 'w', ty(gp('east-passage'), 250)),
  D(G, 'east-passage', 'conservatory', 'w', ty(gp('east-passage'), 420)),
  D(G, 'east-passage', 'stewards-office', 'w', ty(gp('east-passage'), 640)),

  /* upper floor & roof */
  D(RF, 'thopter-pad', 'hall-roof', 'e', ty(rp('thopter-pad'), 260)),
  D(RF, 'thopter-pad', 'west-parapet', 'e', ty(rp('thopter-pad'), 400)),
  D(RF, 'hall-roof', 'parapet-walk', 's', 0.5),
  D(RF, 'lords-chambers', 'parapet-walk', 'w', ty(rp('lords-chambers'), 337), true),
  D(RF, 'conservatory-dome', 'east-parapet', 'w', 0.5),
  D(RF, 'windtrap', 'west-parapet', 'e', ty(rp('windtrap'), 530)),
  D(RF, 'heralds-terrace', 'south-parapet', 'n', 0.5),
  D(RF, 'watch-turret', 'south-parapet', 'w', ty(rp('watch-turret'), 577)),
];

/* ─── Board data (normalized) ──────────────────────────────────────────── */
export const varrinBoardRooms = boardRooms(
  varrinRooms.map((r) => ({ ...r, id: `${r.level}-${r.id}` })), W, H,
);
export const varrinBoardDoors = boardDoors(
  varrinDoors.map((d) => ({ ...d, from: `${d.level}-${d.from}`, to: `${d.level}-${d.to}` })), W, H,
);
export const varrinOutline = normPath(OUTLINE_PTS, W, H);
export const varrinCrop = { x: r4(232 / W), y: r4(98 / H), w: r4(672 / W), h: r4(742 / H) };
export const varrinSpawn = {
  pc: [r4(500 / W), r4(530 / H)],
  levels: {
    ground: { pc: [r4(500 / W), r4(530 / H)] },
    roof: { pc: [r4(520 / W), r4(337 / H)] },
  },
};
