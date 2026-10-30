/* ═══════════════════════════════════════════════════════════════════════
   SIETCH QARRAT — cave-plan GEOMETRY (JSX-free, node-importable).
   Single source for sietch.jsx (MapEngine plan) and maps/index.js
   (normalized board rooms, doors, spawn). Canvas px, W×H. One level.
   ═══════════════════════════════════════════════════════════════════════ */
import { boardRooms, boardDoors, edge, normPath, pxPath, r4 } from './geometry.js';

export const W = 1100, H = 920;
export const LEVELS = [{ id: 'sietch', label: 'CAVE LEVEL', deck: 'S' }];

/* The rock mass the caves are carved from (irregular). */
export const OUTLINE_PTS = [
  [236, 112], [300, 96], [420, 104], [520, 92], [640, 100], [760, 90], [856, 108],
  [872, 170], [866, 260], [880, 360], [872, 470], [884, 560], [896, 598], [896, 628],
  [880, 700], [858, 790], [760, 812], [640, 804], [520, 816], [400, 806], [290, 800],
  [232, 760], [222, 660], [214, 560], [226, 450], [216, 340], [224, 230],
];
export const OUTLINE = pxPath(OUTLINE_PTS);

const S = 'sietch';
const R = (id, name, x, y, w, h, note, draw = {}) => ({ id, name, level: S, rect: { x, y, w, h }, note, draw });

export const sietchRooms = [
  R('entrance-cavern', 'Entrance Cavern', 252, 128, 160, 112, 'A cleft in the rock that looks like nothing from the sand. Outsiders arrive here blindfolded, and lookouts watch the open desert from its lip.', { sub: 'HIDDEN CLEFT', shape: 'octagon', icons: ['dune-eye'] }),
  R('doorseal', 'Doorseal', 428, 156, 72, 56, 'Two heavy moisture-seal hangings. Never open both at once — the sietch’s air holds its water.', { labelSize: 4.8, icons: ['dune-water'] }),
  R('windtrap', 'Windtrap', 690, 120, 150, 140, 'Hidden intake fins on the ridge above feed condensers here. Every drop runs down to the cache.', { sub: 'CONDENSERS', shape: 'circle', icons: ['dune-water'], pattern: 'hatch' }),
  R('entry-passage', 'Entry Passage', 454, 212, 20, 48, 'Short dark passage behind the doorseal.', { kind: 'cor' }),
  R('main-gallery', 'Main Gallery', 300, 260, 540, 24, 'The sietch’s main tunnel, lit by a few glowglobes. Children run messages along it.', { kind: 'cor' }),
  R('west-tunnel', 'West Tunnel', 396, 284, 20, 316, 'Narrow tunnel to the sleeping galleries.', { kind: 'cor' }),
  R('east-tunnel', 'East Tunnel', 664, 284, 20, 316, 'Tunnel to the workshops and the sayyadina’s chamber; the water conduit runs along its wall.', { kind: 'cor' }),
  R('sleeping-gallery-north', 'Sleeping Gallery (North)', 240, 306, 150, 116, 'Family alcoves behind woven hangings. Speaking loudly here is rude.', { sub: 'FAMILY ALCOVES', crew: true, icons: ['dune-bed'] }),
  R('sleeping-gallery-south', 'Sleeping Gallery (South)', 240, 440, 150, 120, 'Alcoves for the unmarried fighters and guests under water-bond.', { sub: 'FIGHTERS · GUESTS', crew: true, icons: ['dune-bed'] }),
  R('council-chamber', 'Council Chamber', 418, 284, 242, 236, 'A great round cave with a speaking ledge. Judgments, weddings and challenge-duels happen here.', { sub: 'SPEAKING LEDGE', shape: 'circle', crew: true, icons: ['dune-banner'] }),
  R('workshops', 'Workshops', 690, 306, 150, 116, 'Stillsuit fitting, crysknife grinding, maker-hook repair. Smells of oil and spice.', { sub: 'STILLSUITS · BLADES', icons: ['dune-blade'] }),
  R('sayyadina-chamber', 'Sayyadina’s Chamber', 690, 440, 150, 112, 'The sietch’s spiritual authority receives — and tests — visitors here.', { sub: 'TESTING', crew: true, icons: ['dune-eye'] }),
  R('south-shaft', 'South Shaft', 528, 520, 24, 80, 'Steep cut steps down from the council chamber to the lower tunnel.', { kind: 'cor' }),
  R('lower-tunnel', 'Lower Tunnel', 300, 600, 386, 24, 'The deep tunnel. Cooler, quieter, guarded at the cache door.', { kind: 'cor' }),
  R('worm-entry-tunnel', 'Worm-Entry Tunnel', 690, 600, 206, 24, 'A long tunnel that opens onto the open sand below the ridge. Riders leave and return by it; it is sealed with rock in storms.', { kind: 'cor' }),
  R('deathstill', 'Deathstill', 300, 624, 124, 120, 'Where the water of the dead is reclaimed for the tribe. Visitors are not brought here.', { sub: 'WATER OF THE DEAD', icons: ['restricted'], pattern: 'hatch' }),
  R('water-cache', 'Water Cache', 448, 624, 200, 140, 'Sealed basins holding the sietch’s hoard. Seeing it is the highest trust a sietch can give.', { sub: 'SEALED BASINS', shape: 'octagon', icons: ['dune-water', 'restricted'], fill: 'water' }),
  R('maker-ramp', 'Maker Ramp', 760, 624, 110, 140, 'Sand-floored ramp at the end of the worm tunnel where thumpers and hooks are staged.', { sub: 'THUMPERS · HOOKS', icons: ['dune-thumper'], fill: 'sand' }),
];

const byId = Object.fromEntries(sietchRooms.map((r) => [r.id, r]));
const rect = (id) => byId[id].rect;
const D = (from, to, side, t, locked = false, at = from) => ({ level: S, from, to, locked, ...edge(rect(at), side, t) });

export const sietchDoors = [
  D('entrance-cavern', 'doorseal', 'e', 0.5),
  D('doorseal', 'entry-passage', 's', 0.5),
  D('entry-passage', 'main-gallery', 's', 0.5),
  D('windtrap', 'main-gallery', 's', 0.5),
  D('council-chamber', 'main-gallery', 'n', 0.5),
  D('west-tunnel', 'main-gallery', 'n', 0.5),
  D('east-tunnel', 'main-gallery', 'n', 0.5),
  D('sleeping-gallery-north', 'west-tunnel', 'e', 0.5),
  D('sleeping-gallery-south', 'west-tunnel', 'e', 0.5),
  D('council-chamber', 'west-tunnel', 'w', 0.5),
  D('council-chamber', 'east-tunnel', 'e', 0.5),
  D('workshops', 'east-tunnel', 'w', 0.5),
  D('sayyadina-chamber', 'east-tunnel', 'w', 0.5),
  D('council-chamber', 'south-shaft', 's', 0.5),
  D('south-shaft', 'lower-tunnel', 's', 0.5),
  D('deathstill', 'lower-tunnel', 'n', 0.5, true),
  D('water-cache', 'lower-tunnel', 'n', 0.5, true),
  D('lower-tunnel', 'worm-entry-tunnel', 'e', 0.5),
  D('maker-ramp', 'worm-entry-tunnel', 'n', 0.5),
];

/* Water conduits (drawn with the engine's Vents primitive, tinted water-blue). */
export const CONDUITS = [
  'M 765 255 L 765 272 L 674 272 L 674 612 L 548 612 L 548 630',
  'M 548 764 L 548 784 L 362 784 L 362 744',
];
export const CONDUIT_GRATES = [[765, 255], [674, 440], [548, 630], [362, 744]];

/* ─── Board data (normalized) ──────────────────────────────────────────── */
export const sietchBoardRooms = boardRooms(sietchRooms, W, H);
export const sietchBoardDoors = boardDoors(sietchDoors, W, H);
export const sietchOutline = normPath(OUTLINE_PTS, W, H);
export const sietchCrop = { x: r4(195 / W), y: r4(75 / H), w: r4(715 / W), h: r4(760 / H) };
export const sietchSpawn = { pc: [r4(332 / W), r4(184 / H)], levels: { sietch: { pc: [r4(332 / W), r4(184 / H)] } } };
