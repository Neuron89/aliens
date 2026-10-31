/* ═══════════════════════════════════════════════════════════════════════
   USCSS MONTERO — deck-plan GEOMETRY (JSX-free, importable by node).

   Single source for both renderers:
   - montero.jsx draws the MapEngine deck plan from these layouts (px).
   - maps/index.js exports `monteroRooms` (normalized 0..1 of the
     W×H canvas) for the table board / map controller fog + hit-testing.
   ═══════════════════════════════════════════════════════════════════════ */

/* Same value as MapEngine DEFAULTS.shaftSize (kept here so node can import it). */
export const SHAFT_SIZE = 26;

/* ─── Canvas & hull geometry ──────────────────────────────────────────── */

export const W = 1100, H = 920;
export const CX = 600;
export const HT = 75, HB = 845;
export const HL = CX - 178, HR = CX + 178;

/** Hull outline; `fx/fy` map canvas px to another space (identity = px). */
export function hullPath(fx = (x) => x, fy = (y) => y) {
  const p = (x, y) => `${fx(x)} ${fy(y)}`;
  return `M ${p(CX, HT)} C ${p(CX - 10, HT)},${p(CX - 50, HT + 22)},${p(CX - 68, HT + 45)}
  L ${p(CX - 88, HT + 72)} L ${p(CX - 105, HT + 105)} L ${p(HL + 32, HT + 145)}
  L ${p(HL + 16, HT + 190)} L ${p(HL + 6, HT + 240)} L ${p(HL, HT + 310)} L ${p(HL, HB - 120)}
  L ${p(HL + 8, HB - 70)} L ${p(HL + 22, HB - 38)} L ${p(HL + 50, HB - 12)} L ${p(HL + 82, HB)}
  L ${p(HR - 82, HB)} L ${p(HR - 50, HB - 12)} L ${p(HR - 22, HB - 38)}
  L ${p(HR - 8, HB - 70)} L ${p(HR, HB - 120)} L ${p(HR, HT + 310)}
  L ${p(HR - 6, HT + 240)} L ${p(HR - 16, HT + 190)} L ${p(HR - 32, HT + 145)}
  L ${p(CX + 105, HT + 105)} L ${p(CX + 88, HT + 72)} L ${p(CX + 68, HT + 45)}
  C ${p(CX + 50, HT + 22)},${p(CX + 10, HT)},${p(CX, HT)} Z`;
}

export const HULL = hullPath();

/* ─── Inner layout constants ──────────────────────────────────────────── */

export const IL = CX - 128;
export const IR = CX + 128;
export const COR_W = 22;
export const CL = CX - COR_W / 2;
export const CR = CX + COR_W / 2;
export const GAP = 4;
export const PL = IL;
export const PW = CL - GAP - PL;
export const SL = CR + GAP;
export const SW = IR - SL;
const SH = SHAFT_SIZE;

/* ─── Per-deck layouts (y positions, px) ──────────────────────────────── */

export function deckALayout() {
  const RH = 44, G = 5;
  let y = HT + 90;
  const bridgeY = y; y += 55 + G;
  const hyperY = y; y += 42 + G;
  const cryoY = y; y += RH + G;
  const jctFwdY = y; y += SH + G;
  const tankY = y; y += RH + G;
  const clawY = y; y += RH + G;
  const elevY = y; const airY = y; y += SH + G;
  const galleyY = y; y += RH + G;
  const medlabY = galleyY;
  const hygieneY = y; y += RH + G;
  const storageY = hygieneY;
  const muthurY = y; y += RH + G;
  const jctAftY = y;
  return { RH, G, bridgeY, hyperY, cryoY, jctFwdY, tankY, clawY, elevY, airY, galleyY, medlabY, hygieneY, storageY, muthurY, jctAftY };
}

export function deckBLayout() {
  const RH = 44, G = 5;
  let y = HT + 90;
  const navY = y; y += 50 + G;
  const lifeSupY = y; y += 42 + G;
  const dockY = y; y += RH + G;
  const jctFwdY = y; y += SH + G;
  const waterY = y; y += RH + G;
  const clawY = y; y += RH + G;
  const elevY = y; const airY = y; y += SH + G;
  const reactorY = y; y += 70 + G;
  const coolantY = y; y += RH + G;
  const jctAftY = y;
  return { RH, G, navY, lifeSupY, dockY, jctFwdY, waterY, clawY, elevY, airY, reactorY, coolantY, jctAftY };
}

export function deckCLayout() {
  const G = 5;
  const sideCorW = 18;
  const sclX = PL;
  const cbL = PL + sideCorW + GAP;
  const cbR = IR - sideCorW - GAP;
  const scrX = IR - sideCorW;
  let y = HT + 95;
  const shuttleY = y; y += 70 + G;
  const jctFwdY = y; y += SH + G;
  const alcoveY = y; y += 40 + G;
  const topCorY = y; y += 16 + G;
  const cargoY = y; y += 170 + G;
  const botCorY = y; y += 16 + G;
  const shaftY = y; y += SH + G;
  const ventralY = y; y += 44 + G;
  const jctAftY = y;
  return { G, sideCorW, sclX, cbL, cbR, scrX, shuttleY, jctFwdY, alcoveY, topCorY, cargoY, botCorY, shaftY, ventralY, jctAftY };
}

/* ─── Rooms (px rects) ────────────────────────────────────────────────── */

const shaft = (cx, cy) => ({ x: cx - SH / 2, y: cy - SH / 2, w: SH, h: SH });

function deckARoomsPx() {
  const L = deckALayout();
  const { RH } = L;
  return [
    ['bridge', 'BRIDGE', { x: CX - 60, y: L.bridgeY, w: 120, h: 55 }],
    ['hyperdrive', 'HYPERDRIVE MACHINERY SPACE', { x: IL + 10, y: L.hyperY, w: IR - IL - 20, h: 42 }],
    ['cryo', 'CRYO CHAMBER', { x: IL + 5, y: L.cryoY, w: IR - IL - 10, h: RH }],
    ['junction-fwd', 'JUNCTION FWD', { x: CL, y: L.jctFwdY, w: COR_W, h: SH }],
    ['corridor', 'MAIN CORRIDOR', { x: CL, y: L.tankY, w: COR_W, h: L.jctAftY - L.tankY }],
    ['tankage-port', 'TANKAGE (PORT)', { x: PL, y: L.tankY, w: PW, h: RH }],
    ['tankage-stbd', 'TANKAGE (STBD)', { x: SL, y: L.tankY, w: SW, h: RH }],
    ['claw-port', 'UPPER LANDING CLAW CHAMBER (PORT)', { x: PL, y: L.clawY, w: PW, h: RH }],
    ['claw-stbd', 'UPPER LANDING CLAW CHAMBER (STBD)', { x: SL, y: L.clawY, w: SW, h: RH }],
    ['elevator', 'CARGO ELEVATOR', shaft(PL + PW / 2, L.elevY + SH / 2)],
    ['air-scrubber', 'AIR SCRUBBER', shaft(SL + SW / 2, L.airY + SH / 2)],
    ['galley', 'GALLEY', { x: PL, y: L.galleyY, w: PW, h: RH }],
    ['medlab', 'MEDLAB', { x: SL, y: L.medlabY, w: SW, h: RH }],
    ['hygiene', 'HYGIENE & LOCKERS', { x: PL, y: L.hygieneY, w: PW, h: RH }],
    ['storage', 'STORAGE', { x: SL, y: L.storageY, w: SW, h: RH }],
    ['muthur', 'MU/TH/UR 6500', { x: PL, y: L.muthurY, w: PW, h: RH }],
    ['supplies', 'SUPPLIES', { x: SL, y: L.muthurY, w: SW, h: RH }],
    ['junction-aft', 'JUNCTION AFT', shaft(CX, L.jctAftY + SH / 2)],
  ];
}

function deckBRoomsPx() {
  const L = deckBLayout();
  const { RH } = L;
  return [
    ['navigation', 'NAVIGATION SYSTEMS', { x: CX - 55, y: L.navY, w: 110, h: 50 }],
    ['life-support', 'LIFE SUPPORT CONTROL', { x: IL + 10, y: L.lifeSupY, w: IR - IL - 20, h: 42 }],
    ['docking-umbilical', 'DOCKING UMBILICAL', { x: PL, y: L.dockY, w: PW, h: RH }],
    ['main-airlock', 'MAIN AIRLOCK', { x: SL, y: L.dockY, w: SW, h: RH }],
    ['dock-corridor', 'DOCKING CORRIDOR', { x: CL, y: L.dockY, w: COR_W, h: RH }],
    ['junction-fwd', 'JUNCTION FWD', { x: CL, y: L.jctFwdY, w: COR_W, h: SH }],
    ['corridor', 'MAIN CORRIDOR', { x: CL, y: L.waterY, w: COR_W, h: L.jctAftY - L.waterY }],
    ['cross-corridor', 'CROSS CORRIDOR', { x: PL, y: L.elevY, w: IR - PL, h: SH }],
    ['water-reclamation', 'WATER RECLAMATION', { x: PL, y: L.waterY, w: PW, h: RH }],
    ['workshop', 'WORKSHOP (ENGINEERING)', { x: SL, y: L.waterY, w: SW, h: RH }],
    ['lower-claw', 'LOWER CLAW MECHANISM', { x: PL, y: L.clawY, w: PW, h: RH }],
    ['maintenance', 'MAINTENANCE BAY', { x: SL, y: L.clawY, w: SW, h: RH }],
    ['elevator', 'CARGO ELEVATOR', shaft(PL + PW / 2, L.elevY + SH / 2)],
    ['air-scrubber', 'AIR SCRUBBER', shaft(SL + SW / 2, L.airY + SH / 2)],
    ['reactor', 'REACTOR ROOM', { x: IL + 5, y: L.reactorY, w: IR - IL - 10, h: 70 }],
    ['coolant', 'COOLANT SYSTEMS', { x: PL, y: L.coolantY, w: PW, h: RH }],
    ['reactor-control', 'REACTOR CONTROL', { x: SL, y: L.coolantY, w: SW, h: RH }],
    ['junction-aft', 'JUNCTION AFT', shaft(CX, L.jctAftY + SH / 2)],
  ];
}

function deckCRoomsPx() {
  const L = deckCLayout();
  return [
    ['shuttle-dock', 'WY-37B SHUTTLE DOCK', { x: IL + 15, y: L.shuttleY, w: IR - IL - 30, h: 70 }],
    ['junction-fwd', 'JUNCTION FWD', { x: CL, y: L.jctFwdY, w: COR_W, h: SH }],
    ['alcove-corridor', 'FORWARD CORRIDOR', { x: CL, y: L.alcoveY, w: COR_W, h: 40 }],
    ['loader-bay', 'P-5000 LOADER BAY', { x: PL, y: L.alcoveY, w: PW, h: 40 }],
    ['cargo-office', 'CARGO OFFICE', { x: SL, y: L.alcoveY, w: SW, h: 40 }],
    ['top-corridor', 'FORWARD CROSS CORRIDOR', { x: PL, y: L.topCorY, w: IR - PL, h: 16 }],
    ['side-corridor-port', 'PORT SIDE CORRIDOR', { x: L.sclX, y: L.cargoY, w: L.sideCorW, h: 170 }],
    ['side-corridor-stbd', 'STARBOARD SIDE CORRIDOR', { x: L.scrX, y: L.cargoY, w: L.sideCorW, h: 170 }],
    ['cargo-bay', 'MAIN CARGO BAY', { x: L.cbL, y: L.cargoY, w: L.cbR - L.cbL, h: 170 }],
    ['bottom-corridor', 'AFT CROSS CORRIDOR', { x: PL, y: L.botCorY, w: IR - PL, h: 16 }],
    ['aft-corridor', 'AFT CORRIDOR', { x: CL, y: L.botCorY + 16, w: COR_W, h: L.ventralY - L.botCorY - 16 }],
    ['elevator', 'CARGO ELEVATOR', shaft(PL + PW / 2, L.shaftY + SH / 2)],
    ['air-scrubber', 'AIR SCRUBBER', shaft(SL + SW / 2, L.shaftY + SH / 2)],
    ['ventral-access', 'VENTRAL ACCESS', { x: IL + 15, y: L.ventralY, w: IR - IL - 30, h: 44 }],
    ['junction-aft', 'JUNCTION AFT', shaft(CX, L.jctAftY + SH / 2)],
  ];
}

/* GM notes for the rooms that had them in the old prose room list. */
const NOTES = {
  'deck-a/bridge': 'Navigation, communications and the MU/TH/UR access terminal. Captain\'s chair with command console. Viewports face forward.',
  'deck-a/cryo': 'Five hypersleep pods. Emergency wake procedure takes 20 minutes. Adjacent to medical for post-cryo checkups.',
  'deck-a/corridor': 'Central spine of the deck. Emergency lighting panels. Damage control stations every 10 metres.',
  'deck-a/galley': 'Mess hall and kitchen. Seats 8. Coffee machine that barely works. Bulletin board with crew notices and photos.',
  'deck-a/medlab': 'Basic medical facility. Autodoc unit, surgical table, pharmaceutical storage.',
  'deck-a/hygiene': 'Showers, toilets and personal lockers.',
  'deck-a/storage': 'General supplies, spare parts, EVA suits, emergency rations. Organised chaos.',
  'deck-a/muthur': 'MU/TH/UR 6500 interface room. Restricted access.',
  'deck-b/reactor': 'Reactor core and drive systems. Noisy, hot, cramped. Maintenance crawlways access the hull.',
  'deck-b/main-airlock': 'Main personnel airlock. The umbilical to the Cronus connects through the docking port.',
  'deck-c/cargo-bay': 'Massive hold: 72 tritium tanks for the refinery tow. Side corridors run along both walls.',
  'deck-c/shuttle-dock': 'Docking cradle for DAISY, the WY-37B cargo lifter (34 m).',
};

const r4 = (n) => Math.round(n * 1e5) / 1e5;
const norm = (rect) => ({ type: 'rect', x: r4(rect.x / W), y: r4(rect.y / H), w: r4(rect.w / W), h: r4(rect.h / H) });

export const MONTERO_LEVELS = [
  { id: 'deck-a', label: 'DECK A — PERSONNEL', deck: 'A' },
  { id: 'deck-b', label: 'DECK B — OPERATIONS', deck: 'B' },
  { id: 'deck-c', label: 'DECK C — CARGO', deck: 'C' },
];

/** Board/fog rooms for all three decks, normalized 0..1 of the W×H canvas. Ids are "<deck>/<room>" unique. */
export const monteroRooms = [
  ['deck-a', deckARoomsPx()],
  ['deck-b', deckBRoomsPx()],
  ['deck-c', deckCRoomsPx()],
].flatMap(([level, rooms]) => rooms.map(([id, name, rect]) => {
  const rid = `${level}/${id}`;
  return { id: rid.replace('/', '-'), name, level, ...(NOTES[rid] ? { note: NOTES[rid] } : {}), shape: norm(rect) };
}));

/** Hull outline in normalized coordinates (board dims everything outside it). */
export const monteroOutline = hullPath((x) => r4(x / W), (y) => r4(y / H)).replace(/\s+/g, ' ');

/** Board crop (normalized): the hull + nacelles, without the sidebar / legend. */
export const monteroCrop = { x: r4((HL - 70) / W), y: r4((HT - 30) / H), w: r4((HR - HL + 140) / W), h: r4((HB - HT + 55) / H) };

/** Default PC drop point per deck: just aft of the forward junction, in the corridor. */
export const monteroSpawn = {
  pc: [r4(CX / W), r4((deckALayout().jctFwdY + SH / 2) / H)],
  levels: {
    'deck-a': { pc: [r4(CX / W), r4((deckALayout().jctFwdY + SH / 2) / H)] },
    'deck-b': { pc: [r4(CX / W), r4((deckBLayout().jctFwdY + SH / 2) / H)] },
    'deck-c': { pc: [r4(CX / W), r4((deckCLayout().jctFwdY + SH / 2) / H)] },
  },
};

/* ─── Doors (board EXITS / player-enter-room) ─────────────────────────────
   Per deck, between board room ids ("<deck>-<room>"), at the hatches and
   corridor stubs drawn in montero.jsx; (x, y) in canvas px on the `from`
   room's wall. The decks themselves join at the junction ladders, the cargo
   elevator and the air-scrubber shaft (a level change, not a door).
   MU/TH/UR is the one locked hatch ("Restricted access"). */
function monteroDoorsPx() {
  const a = deckALayout(), b = deckBLayout(), c = deckCLayout();
  const ex = PL + PW / 2 + SH / 2;   // cargo elevator shaft, east wall
  const wx = SL + SW / 2 - SH / 2;   // air scrubber shaft, west wall
  const D = (level, from, to, x, y, locked = false) => ({ level, from, to, x, y, locked });
  const A = 'deck-a', B = 'deck-b', C = 'deck-c';
  return [
    D(A, 'hyperdrive', 'bridge', CX, a.hyperY),
    D(A, 'cryo', 'hyperdrive', CX, a.cryoY),
    D(A, 'cryo', 'junction-fwd', CX, a.cryoY + a.RH),
    D(A, 'junction-fwd', 'corridor', CX, a.jctFwdY + SH),
    D(A, 'corridor', 'tankage-port', CL, a.tankY + a.RH / 2),
    D(A, 'corridor', 'tankage-stbd', CR, a.tankY + a.RH / 2),
    D(A, 'corridor', 'claw-port', CL, a.clawY + a.RH / 2),
    D(A, 'corridor', 'claw-stbd', CR, a.clawY + a.RH / 2),
    D(A, 'corridor', 'elevator', CL, a.elevY + SH / 2),
    D(A, 'corridor', 'air-scrubber', CR, a.airY + SH / 2),
    D(A, 'corridor', 'galley', CL, a.galleyY + a.RH / 2),
    D(A, 'corridor', 'medlab', CR, a.medlabY + a.RH / 2),
    D(A, 'corridor', 'hygiene', CL, a.hygieneY + a.RH / 2),
    D(A, 'corridor', 'storage', CR, a.storageY + a.RH / 2),
    D(A, 'corridor', 'muthur', CL, a.muthurY + a.RH / 2, true),
    D(A, 'corridor', 'supplies', CR, a.muthurY + a.RH / 2),
    D(A, 'corridor', 'junction-aft', CX, a.jctAftY),

    D(B, 'life-support', 'navigation', CX, b.lifeSupY),
    D(B, 'life-support', 'dock-corridor', CX, b.lifeSupY + 42),
    D(B, 'dock-corridor', 'docking-umbilical', CL, b.dockY + b.RH / 2),
    D(B, 'dock-corridor', 'main-airlock', CR, b.dockY + b.RH / 2),
    D(B, 'dock-corridor', 'junction-fwd', CX, b.dockY + b.RH),
    D(B, 'junction-fwd', 'corridor', CX, b.jctFwdY + SH),
    D(B, 'corridor', 'water-reclamation', CL, b.waterY + b.RH / 2),
    D(B, 'corridor', 'workshop', CR, b.waterY + b.RH / 2),
    D(B, 'corridor', 'lower-claw', CL, b.clawY + b.RH / 2),
    D(B, 'corridor', 'maintenance', CR, b.clawY + b.RH / 2),
    D(B, 'corridor', 'cross-corridor', CL, b.elevY + SH / 2),
    D(B, 'elevator', 'cross-corridor', ex, b.elevY + SH / 2),
    D(B, 'air-scrubber', 'cross-corridor', wx, b.airY + SH / 2),
    D(B, 'reactor', 'corridor', CX, b.reactorY),
    D(B, 'corridor', 'coolant', CL, b.coolantY + b.RH / 2),
    D(B, 'corridor', 'reactor-control', CR, b.coolantY + b.RH / 2),
    D(B, 'corridor', 'junction-aft', CX, b.jctAftY),

    D(C, 'shuttle-dock', 'junction-fwd', CX, c.shuttleY + 70),
    D(C, 'junction-fwd', 'alcove-corridor', CX, c.jctFwdY + SH),
    D(C, 'alcove-corridor', 'loader-bay', CL, c.alcoveY + 20),
    D(C, 'alcove-corridor', 'cargo-office', CR, c.alcoveY + 20),
    D(C, 'alcove-corridor', 'top-corridor', CX, c.alcoveY + 40),
    D(C, 'top-corridor', 'side-corridor-port', c.sclX + c.sideCorW / 2, c.topCorY + 16),
    D(C, 'top-corridor', 'side-corridor-stbd', c.scrX + c.sideCorW / 2, c.topCorY + 16),
    D(C, 'cargo-bay', 'side-corridor-port', c.cbL, c.cargoY + 35),
    D(C, 'cargo-bay', 'side-corridor-stbd', c.cbR, c.cargoY + 35),
    D(C, 'cargo-bay', 'side-corridor-port', c.cbL, c.cargoY + 100),
    D(C, 'cargo-bay', 'side-corridor-stbd', c.cbR, c.cargoY + 100),
    D(C, 'side-corridor-port', 'bottom-corridor', c.sclX + c.sideCorW / 2, c.cargoY + 170),
    D(C, 'side-corridor-stbd', 'bottom-corridor', c.scrX + c.sideCorW / 2, c.cargoY + 170),
    D(C, 'bottom-corridor', 'aft-corridor', CX, c.botCorY + 16),
    D(C, 'elevator', 'aft-corridor', ex, c.shaftY + SH / 2),
    D(C, 'air-scrubber', 'aft-corridor', wx, c.shaftY + SH / 2),
    D(C, 'ventral-access', 'aft-corridor', CX, c.ventralY),
    D(C, 'ventral-access', 'junction-aft', CX, c.ventralY + 44),
  ];
}

/** Board doors [{ from, to, level, locked, at }] between monteroRooms ids (`at` normalized). */
export const monteroDoors = monteroDoorsPx().map(({ level, from, to, x, y, locked }) => ({
  from: `${level}-${from}`, to: `${level}-${to}`, level, locked, at: [r4(x / W), r4(y / H)],
}));
