import React from 'react';
import MapEngine, { useMapTheme, registerIcon, seededRandom, purl } from '../../../engine/components/MapEngine';
import { LevelPlan, alienLegend, alienSidebar, Table, Dots, Machine } from './alienMapKit.jsx';
import { W, H, OUTLINE, PLATFORM, TOWER, PAD, hadleysRooms, hadleysDoors, STAIRS } from './hadleys.geometry.js';

/* ═══════════════════════════════════════════════════════════════════════
   HADLEY’S HOPE — MapEngine plan (one outdoor level, a site plan).
   The hull outline is the scoured ground; hull.overlays paints the rock,
   drifts, service road, power conduit, landing pad and the processor
   tower under the modules. Rooms/walkways/doors come from
   hadleys.geometry.js (also feeds the board rooms).
   ═══════════════════════════════════════════════════════════════════════ */

const GROUND = '#0a1513', GROUND_LIGHT = '#10211e', DRIFT = '#152b27', ROCK = '#0e1d1a', ROCK_LINE = '#24483f';
const ROAD = '#11201d', DECK = '#0d2420', SHUTTER = '#8a7a4a';
const zone = (id) => hadleysRooms.find((r) => r.id === id).rect;

registerIcon('hadleys-shuttle', (x, y, C) => (
  <g opacity="0.7" fill="none" stroke={C.accent} strokeWidth="0.6"><path d={`M ${x} ${y - 4} L ${x + 1.6} ${y - 1} L ${x + 4} ${y + 2.6} L ${x + 1.4} ${y + 2} L ${x} ${y + 3.6} L ${x - 1.4} ${y + 2} L ${x - 4} ${y + 2.6} L ${x - 1.6} ${y - 1} Z`} /></g>
));

/* ─── Ground ─────────────────────────────────────────────────────────── */

/* Wind streaks: short scour lines running west→east with a slight southward set. */
function streaks(seed, n, x0, y0, w, h, color, op) {
  const rng = seededRandom(seed);
  return Array.from({ length: n }, (_, i) => {
    const x = x0 + rng() * w, y = y0 + rng() * h, l = 10 + rng() * 34;
    return <line key={i} x1={x} y1={y} x2={x + l} y2={y + l * 0.08} stroke={color} strokeWidth={0.4 + rng() * 0.5} opacity={op * (0.5 + rng() * 0.6)} strokeLinecap="round" />;
  });
}

/* Rock outcrop with a drift tail trailing east (the lee side). */
function outcrop(x, y, s, key, C, tail = 1) {
  const pts = [[-1, 0.1], [-0.6, -0.7], [0.1, -0.9], [0.8, -0.5], [1, 0.2], [0.5, 0.8], [-0.4, 0.75]];
  const d = `M ${pts.map(([a, b]) => `${(x + a * s).toFixed(1)} ${(y + b * s * 0.8).toFixed(1)}`).join(' L ')} Z`;
  return (
    <g key={key}>
      {tail > 0 && <path d={`M ${x + s * 0.6} ${y - s * 0.5} Q ${x + s * 2.6 * tail} ${y - s * 0.1} ${x + s * 3.4 * tail} ${y + s * 0.3} Q ${x + s * 2.2 * tail} ${y + s * 0.5} ${x + s * 0.6} ${y + s * 0.6} Z`} fill={DRIFT} opacity="0.75" />}
      <path d={d} fill={ROCK} stroke={ROCK_LINE} strokeWidth="0.7" />
      <path d={`M ${x - s * 0.5} ${y - s * 0.2} L ${x + s * 0.1} ${y - s * 0.45} L ${x + s * 0.6} ${y - s * 0.1}`} fill="none" stroke={C.hullOutline} strokeWidth="0.4" opacity="0.35" />
    </g>
  );
}

const ROCKS = [
  [610, 150, 14, 1], [664, 188, 7, 1], [838, 172, 12, 0.8], [780, 140, 6, 1], [858, 268, 8, 0.4],
  [262, 662, 16, 1], [300, 742, 10, 1], [252, 790, 7, 0.8], [346, 690, 6, 1], [330, 800, 12, 1],
  [258, 360, 7, 0.5], [244, 590, 8, 0.6], [520, 828, 6, 1], [742, 832, 5, 1], [440, 112, 6, 1],
];

/* Storm drift: a pale tongue of grit piled against a windward face. */
function drift(d, key) {
  return <path key={key} d={d} fill={DRIFT} opacity="0.8" />;
}

/* Service road from the processor gate to the Vehicle Bay doors. */
const ROAD_D = 'M 452 252 L 540 254 C 660 258 760 248 800 286 C 808 296 808 310 808 336';
function serviceRoad(C) {
  const poles = [[520, 240], [600, 242], [680, 244], [752, 240], [790, 268], [822, 300]];
  return (
    <g>
      <path d={ROAD_D} fill="none" stroke={ROAD} strokeWidth="24" strokeLinejoin="round" />
      <path d={ROAD_D} fill="none" stroke={ROCK_LINE} strokeWidth="25" strokeLinejoin="round" opacity="0.35" />
      <path d={ROAD_D} fill="none" stroke={ROAD} strokeWidth="23" strokeLinejoin="round" />
      {/* wheel ruts and centre line */}
      <path d={ROAD_D} fill="none" stroke={C.equipLine} strokeWidth="0.6" strokeDasharray="6 5" opacity="0.6" />
      {[-6, 6].map((o) => <path key={o} d={ROAD_D} transform={`translate(0,${o})`} fill="none" stroke={C.hullDeep} strokeWidth="2.2" opacity="0.7" />)}
      {/* marker poles: in a storm you drive from pole to pole */}
      {poles.map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="1.6" fill="none" stroke={C.accent} strokeWidth="0.6" opacity="0.7" /><circle cx={x} cy={y} r="0.5" fill={C.accent} opacity="0.7" /></g>)}
      {/* grit drifted across the road on its windward edge */}
      {drift('M 618 246 Q 640 252 666 247 Q 650 258 622 256 Z', 'rd1')}
      {drift('M 738 243 Q 758 250 776 252 Q 760 258 742 252 Z', 'rd2')}
    </g>
  );
}

/* Break mark: the processor is two kilometres north, drawn close and off-scale. */
function BreakMark({ x, y, angle = 0, C }) {
  return (
    <g transform={`rotate(${angle},${x},${y})`} stroke={C.textBright} strokeWidth="0.8" fill="none" opacity="0.75">
      <path d={`M ${x - 16} ${y - 3} q 4 -4 8 0 t 8 0 t 8 0 t 8 0`} />
      <path d={`M ${x - 16} ${y + 3} q 4 -4 8 0 t 8 0 t 8 0 t 8 0`} />
    </g>
  );
}

/* Power conduit: processor → maintenance, carried on trestles west of the platform. */
const CONDUIT_D = 'M 372 298 L 372 318 Q 372 330 386 332 L 398 332 Q 402 332 402 340 L 402 790 Q 402 798 410 798 L 556 798 Q 570 798 570 790';
function conduit(C) {
  const trestles = [];
  for (let y = 350; y < 786; y += 22) trestles.push(<line key={y} x1={396} y1={y} x2={408} y2={y} stroke={C.hullOutline} strokeWidth="0.8" opacity="0.5" />);
  for (let x = 420; x < 556; x += 22) trestles.push(<line key={`h${x}`} x1={x} y1={792} x2={x} y2={804} stroke={C.hullOutline} strokeWidth="0.8" opacity="0.5" />);
  return (
    <g>
      <path d={CONDUIT_D} fill="none" stroke={C.hullOutline} strokeWidth="8" strokeLinejoin="round" opacity="0.55" />
      <path d={CONDUIT_D} fill="none" stroke={C.hullDeep} strokeWidth="6" strokeLinejoin="round" />
      <path d={CONDUIT_D} fill="none" stroke={C.accent} strokeWidth="0.6" strokeDasharray="10 4 2 4" opacity="0.5" />
      {trestles}
    </g>
  );
}

/* The landing pad: raised deck, ring marks, edge lights, the emergency shuttle. */
function landingPad(C) {
  const x0 = PAD.x - 60, y0 = PAD.y - 60, s = 120, ch = 16;
  const oct = [[x0 + ch, y0], [x0 + s - ch, y0], [x0 + s, y0 + ch], [x0 + s, y0 + s - ch], [x0 + s - ch, y0 + s], [x0 + ch, y0 + s], [x0, y0 + s - ch], [x0, y0 + ch]];
  const lights = oct.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.3" fill={C.accent} opacity="0.7" />);
  return (
    <g>
      {/* drift piled against the windward (west) skirt */}
      {drift(`M ${x0 - 8} ${y0 + 10} Q ${x0 - 18} ${PAD.y} ${x0 - 8} ${y0 + s - 10} L ${x0 + 2} ${y0 + s - 18} L ${x0 + 2} ${y0 + 18} Z`, 'pd')}
      {/* blast scorch */}
      <circle cx={PAD.x} cy={PAD.y} r="74" fill={GROUND_LIGHT} opacity="0.55" />
      <polygon points={oct.map((p) => p.join(',')).join(' ')} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="1" />
      <polygon points={oct.map((p) => p.join(',')).join(' ')} fill={purl('grating')} opacity="0.7" />
      <circle cx={PAD.x} cy={PAD.y} r="46" fill="none" stroke={C.door} strokeWidth="0.9" strokeDasharray="5 3" opacity="0.7" />
      <circle cx={PAD.x} cy={PAD.y} r="40" fill="none" stroke={C.door} strokeWidth="0.4" opacity="0.4" />
      {[0, 90, 180, 270].map((a) => <path key={a} transform={`rotate(${a},${PAD.x},${PAD.y})`} d={`M ${PAD.x - 4} ${PAD.y - 54} L ${PAD.x} ${PAD.y - 50} L ${PAD.x + 4} ${PAD.y - 54}`} fill="none" stroke={C.door} strokeWidth="0.7" opacity="0.7" />)}
      {lights}
      {/* gantry to the walkway */}
      <rect x={x0 + s} y={453} width={380 - (x0 + s)} height={14} fill={C.wall} stroke={C.hullOutline} strokeWidth="0.6" />
      <rect x={x0 + s} y={455.5} width={380 - (x0 + s)} height={9} fill={purl('grating')} />
      {/* the emergency shuttle, nose north */}
      <g transform={`translate(${PAD.x},${PAD.y + 2})`}>
        <path d="M 0 -40 C 6 -36 8 -24 8 -12 L 30 10 L 30 18 L 9 14 L 7 26 L 13 32 L 13 36 L -13 36 L -13 32 L -7 26 L -9 14 L -30 18 L -30 10 L -8 -12 C -8 -24 -6 -36 0 -40 Z"
          fill={C.hullMid} stroke={C.hullOutline} strokeWidth="0.9" />
        <path d="M -5 -30 Q 0 -36 5 -30 L 4 -24 L -4 -24 Z" fill="#16252a" stroke={C.vent} strokeWidth="0.5" />
        <line x1="0" y1="-20" x2="0" y2="28" stroke={C.hullDark} strokeWidth="0.8" />
        <line x1="-8" y1="2" x2="8" y2="2" stroke={C.hullDark} strokeWidth="0.6" />
        {[-20, 20].map((dx) => <rect key={dx} x={dx - 4} y={8} width="8" height="6" rx="1.5" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.5" />)}
        {[-6, 6].map((dx) => <rect key={`e${dx}`} x={dx - 3} y={36} width="6" height="4" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.4" />)}
      </g>
      {/* windsock and fuel point */}
      <g transform="translate(256,566)" stroke={C.accent} fill="none" strokeWidth="0.6" opacity="0.7">
        <line x1="0" y1="0" x2="0" y2="-10" /><path d="M 0 -10 L 12 -9 L 12 -6 L 0 -6 Z" />
      </g>
      <rect x={334} y={560} width={22} height={12} rx="5" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.6" />
      <line x1={334} y1={566} x2={356} y2={566} stroke={C.hullOutline} strokeWidth="0.4" />
    </g>
  );
}

/* The Atmospheric Processor: a vast circular footprint, drawn off-scale. */
function processor(C) {
  const { x, y, r } = TOWER;
  const fins = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    return <line key={i} x1={x + c * (r - 16)} y1={y + s * (r - 16)} x2={x + c * (r + 2)} y2={y + s * (r + 2)} stroke={C.hullOutline} strokeWidth="2.4" opacity="0.6" />;
  });
  const spokes = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    return <line key={i} x1={x + Math.cos(a) * 18} y1={y + Math.sin(a) * 18} x2={x + Math.cos(a) * 44} y2={y + Math.sin(a) * 44} stroke={C.equipLine} strokeWidth="0.6" opacity="0.6" />;
  });
  const stacks = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dy], i) => (
    <g key={i}>
      <circle cx={x + dx * 58} cy={y + dy * 58} r="10" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.8" />
      <circle cx={x + dx * 58} cy={y + dy * 58} r="5" fill={GROUND} stroke={C.equipLine} strokeWidth="0.5" />
    </g>
  ));
  return (
    <g>
      {/* lee drift trailing east off the tower */}
      {drift(`M ${x + 40} ${y - 84} Q ${x + 150} ${y - 60} ${x + 168} ${y - 20} Q ${x + 120} ${y - 34} ${x + 70} ${y - 60} Z`, 'tw')}
      {/* buttress ring */}
      <circle cx={x} cy={y} r={r + 4} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="1.2" />
      {fins}
      <circle cx={x} cy={y} r={r - 16} fill={C.hullDark} stroke={C.hullOutline} strokeWidth="1" />
      <circle cx={x} cy={y} r={r - 16} fill={purl('hatch')} />
      {stacks}
      <circle cx={x} cy={y} r="46" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.9" />
      {spokes}
      <circle cx={x} cy={y} r="18" fill={GROUND} stroke={C.accent} strokeWidth="0.8" opacity="0.9" />
      <circle cx={x} cy={y} r="10" fill="none" stroke={C.accent} strokeWidth="0.5" strokeDasharray="2 2" opacity="0.6" />
      {/* the nest below: sub-level extent */}
      <circle cx={x} cy={y} r={r + 12} fill="none" stroke={C.restricted} strokeWidth="0.8" strokeDasharray="3 4" opacity="0.65" />
      {/* gate house on the road side */}
      <rect x={x + r - 2} y={y + 34} width={18} height={20} fill={C.wall} stroke={C.hullOutline} strokeWidth="0.8" />
      <rect x={x + r + 1} y={y + 37} width={12} height={14} fill={C.floor} />
    </g>
  );
}

/* The raised platform: deck plate, hatched edge band, stilts. */
function platform(C) {
  const { x, y, w, h } = PLATFORM;
  const stilts = [];
  for (let px = x + 12; px < x + w - 6; px += 30) stilts.push([px, y - 4], [px, y + h + 4]);
  for (let py = y + 20; py < y + h - 6; py += 30) stilts.push([x - 4, py], [x + w + 4, py]);
  return (
    <g>
      {/* drift banked against the windward (west) skirt */}
      {drift(`M ${x - 4} ${y + 6} Q ${x - 22} ${y + h * 0.5} ${x - 4} ${y + h - 6} Z`, 'pf')}
      {stilts.map(([sx, sy], i) => <rect key={i} x={sx - 2} y={sy - 2} width="4" height="4" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.4" opacity="0.8" />)}
      <rect x={x} y={y} width={w} height={h} rx="6" fill={DECK} stroke={C.hullOutline} strokeWidth="1.1" />
      <rect x={x} y={y} width={w} height={h} rx="6" fill={purl('plate')} opacity="0.8" />
      <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} rx="4" fill="none" stroke={C.equipLine} strokeWidth="4" strokeDasharray="2 3" opacity="0.35" />
    </g>
  );
}

function ground(C) {
  return (
    <g>
      <rect x="0" y="0" width={W} height={H} fill={GROUND} />
      {streaks(426, 260, 220, 96, 680, 760, C.equipLine, 0.32)}
      {streaks(158, 70, 220, 96, 680, 760, DRIFT, 0.9)}
      {ROCKS.map(([x, y, s, t], i) => outcrop(x, y, s, i, C, t))}
      {serviceRoad(C)}
      {processor(C)}
      {conduit(C)}
      {landingPad(C)}
      {platform(C)}
    </g>
  );
}

/* ─── Labels ─────────────────────────────────────────────────────────── */

function ZoneLabel({ x, y, label, sub, size = 7.5, anchor = 'middle', color }) {
  const C = useMapTheme();
  return (
    <g pointerEvents="none">
      <text x={x} y={y} fill={color || C.textBright} fontSize={size} textAnchor={anchor} letterSpacing="0.2em" style={{ fontFamily: 'var(--font-display)' }}>{label}</text>
      {sub && <text x={x} y={y + 9} fill={C.textDim} fontSize="5" textAnchor={anchor} letterSpacing="0.12em">{sub}</text>}
    </g>
  );
}

function Tag({ x, y, children, color, anchor = 'middle', size = 4.4, rotate }) {
  const C = useMapTheme();
  return <text x={x} y={y} fill={color || C.textDim} fontSize={size} textAnchor={anchor} letterSpacing="0.14em" pointerEvents="none"
    transform={rotate ? `rotate(${rotate},${x},${y})` : undefined}>{children}</text>;
}

/* ─── Colony dressing (drawn over the rooms) ─────────────────────────── */

/* Storm shutter: armoured slats along a weather face. */
function Shutter({ x, y, len, v }) {
  const ticks = [];
  for (let i = 3; i < len - 1; i += 4) ticks.push(v
    ? <line key={i} x1={x - 2} y1={y + i} x2={x + 2} y2={y + i} />
    : <line key={i} x1={x + i} y1={y - 2} x2={x + i} y2={y + 2} />);
  return (
    <g>
      {v ? <rect x={x - 2.2} y={y} width="4.4" height={len} fill="#1c1a10" stroke={SHUTTER} strokeWidth="0.6" />
        : <rect x={x} y={y - 2.2} width={len} height="4.4" fill="#1c1a10" stroke={SHUTTER} strokeWidth="0.6" />}
      <g stroke={SHUTTER} strokeWidth="0.5" opacity="0.8">{ticks}</g>
    </g>
  );
}

const SHUTTERS = [
  { x: 429, y: 346, len: 98, v: true },   // med bay, west face
  { x: 429, y: 476, len: 88, v: true },   // hab A
  { x: 429, y: 618, len: 100, v: true },  // school
  { x: 580, y: 333, len: 134, v: false }, // operations, north face
  { x: 873, y: 352, len: 180, v: true },  // vehicle bay, east face
  { x: 873, y: 592, len: 124, v: true },  // hydroponics
  { x: 588, y: 813, len: 264, v: false }, // maintenance, south face
];

/* Walkway roof ribs: covered walkways read differently from open corridors. */
function ribs(C) {
  const out = [];
  const add = (id) => {
    const r = zone(id); const vert = r.h > r.w;
    if (vert) for (let y = r.y + 6; y < r.y + r.h - 3; y += 10) out.push(<line key={`${id}${y}`} x1={r.x + 1} y1={y} x2={r.x + r.w - 1} y2={y} stroke={C.hullOutline} strokeWidth="0.5" opacity="0.28" />);
    else for (let x = r.x + 6; x < r.x + r.w - 3; x += 10) out.push(<line key={`${id}${x}`} x1={x} y1={r.y + 1} x2={x} y2={r.y + r.h - 1} stroke={C.hullOutline} strokeWidth="0.5" opacity="0.28" />);
  };
  ['west-walkway', 'east-walkway', 'south-walkway', 'pad-walkway', 'ops-link', 'school-link'].forEach(add);
  return <g pointerEvents="none">{out}</g>;
}

function Sentry({ x, y, facing = 0 }) {
  const C = useMapTheme();
  return (
    <g transform={`rotate(${facing},${x},${y})`} opacity="0.85">
      <path d={`M ${x} ${y} L ${x - 9} ${y + 16} A 18 18 0 0 0 ${x + 9} ${y + 16} Z`} fill={C.restricted} opacity="0.1" />
      <circle cx={x} cy={y} r="3" fill={C.hullDeep} stroke={C.restricted} strokeWidth="0.7" />
      <line x1={x} y1={y} x2={x} y2={y + 6} stroke={C.restricted} strokeWidth="0.9" />
    </g>
  );
}

function Interiors() {
  const C = useMapTheme();
  const line = { fill: 'none', stroke: C.equipLine, strokeWidth: 0.6, opacity: 0.6 };
  const bright = { fill: 'none', stroke: C.textDim, strokeWidth: 0.6, opacity: 0.8 };
  return (
    <g pointerEvents="none">
      {/* OPERATIONS: console bank on the north wall, plot table, admin office */}
      {[584, 604, 624, 644, 664].map((x) => <rect key={x} x={x} y={341} width={16} height={7} rx="1" {...bright} />)}
      <Dots points={[[592, 356], [612, 356], [632, 356], [652, 356], [672, 356]]} r={2} />
      <rect x={582} y={420} width={30} height={20} rx="2" {...line} />
      <circle cx={597} cy={430} r="6" fill="none" stroke={C.accent} strokeWidth="0.4" opacity="0.5" />
      <path d="M 688 416 L 688 452 M 688 416 L 720 416" stroke={C.wallBright} strokeWidth="1.4" />
      <Table x={696} y={428} w={16} h={8} />
      <Tag x={704} y={447} size={3.8}>ADMIN</Tag>
      {/* MED BAY: surgery (north-west), recovery beds (south), drug store */}
      <path d="M 436 378 L 470 378 L 470 344" stroke={C.wallBright} strokeWidth="1.2" fill="none" />
      <rect x={444} y={354} width={16} height={8} rx="1" {...bright} />
      <circle cx={452} cy={358} r="9" fill="none" stroke={C.accent} strokeWidth="0.4" opacity="0.45" />
      {[440, 458, 508, 526].map((x) => <rect key={x} x={x} y={424} width={12} height={20} rx="1" {...line} />)}
      <rect x={496} y={346} width={22} height={8} {...line} />
      <Tag x={507} y={362} size={3.4}>DRUGS</Tag>
      {/* HAB MODULE A: little family flats either side of a hall */}
      {[452, 471, 490, 509, 528].map((x) => <line key={x} x1={x} y1={474} x2={x} y2={502} stroke={C.wallBright} strokeWidth="0.9" opacity="0.8" />)}
      {[452, 471, 509, 528].map((x) => <line key={`b${x}`} x1={x} y1={540} x2={x} y2={566} stroke={C.wallBright} strokeWidth="0.9" opacity="0.8" />)}
      {[[438, 480], [457, 480], [476, 480], [495, 480], [514, 480], [438, 552], [457, 552], [514, 552], [533, 552]].map(([x, y], i) => <rect key={i} x={x} y={y} width={9} height={10} rx="0.8" {...line} />)}
      {/* SCHOOL: desks, the teacher’s table, the supply closet with Newt’s vent */}
      {[448, 468, 512, 532].flatMap((x) => [622, 640].map((y) => <rect key={`${x}-${y}`} x={x - 6} y={y} width={12} height={7} rx="1" {...line} />))}
      <Table x={498} y={694} w={30} h={9} />
      <rect x={436} y={692} width={30} height={28} fill={C.hullDeep} stroke={C.wallBright} strokeWidth="0.9" />
      <rect x={446} y={704} width={9} height={9} fill="none" stroke={C.vent} strokeWidth="0.7" />
      <line x1={447} y1={705} x2={454} y2={712} stroke={C.vent} strokeWidth="0.4" /><line x1={454} y1={705} x2={447} y2={712} stroke={C.vent} strokeWidth="0.4" />
      <Tag x={451} y={700} size={3.2}>SUPPLY</Tag>
      {/* drawings pinned to the walls */}
      {[[480, 615], [492, 615], [504, 615]].map(([x, y], i) => <rect key={i} x={x} y={y} width={7} height={5} fill={C.accent} opacity="0.18" />)}
      {/* COMMONS: bar, stools, pool table, tables, vid screen */}
      <path d="M 576 500 L 626 500 L 626 512" {...bright} strokeWidth="1.2" />
      <Dots points={[[584, 507], [594, 507], [604, 507], [614, 507], [620, 517]]} r={1.8} />
      <rect x={678} y={560} width={34} height={18} rx="1.5" fill="#0f3326" stroke={C.textDim} strokeWidth="0.6" opacity="0.8" />
      {[[678, 560], [695, 560], [712, 560], [678, 578], [695, 578], [712, 578]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1" fill={C.bg} />)}
      {[[590, 568], [614, 572], [640, 568]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="5" {...line} /><Dots points={[[x - 8, y], [x + 8, y]]} r={1.6} /></g>)}
      <line x1={719} y1={504} x2={719} y2={530} stroke={C.accent} strokeWidth="1.6" opacity="0.5" />
      <rect x={676} y={496} width={22} height={4} fill={C.accent} opacity="0.15" />
      {/* HAB MODULE B: bunk rows and lockers */}
      {[580, 600, 620, 640, 660, 680].map((x) => <rect key={x} x={x} y={622} width={12} height={22} rx="1" {...line} />)}
      {[580, 600, 620, 660, 680, 700].map((x) => <rect key={`s${x}`} x={x} y={694} width={12} height={22} rx="1" {...line} />)}
      {[702, 710].map((x) => <rect key={`l${x}`} x={x} y={622} width={7} height={14} {...line} />)}
      {/* VEHICLE BAY: the APC nose-out under the north doors, trucks, tractor */}
      <g>
        <rect x={792} y={350} width={32} height={66} rx="4" fill={C.hullMid} stroke={C.hullOutline} strokeWidth="0.9" />
        <path d="M 794 350 L 798 344 L 818 344 L 822 350" fill={C.hullMid} stroke={C.hullOutline} strokeWidth="0.8" />
        {[358, 372, 390, 404].map((y) => [788, 824].map((x) => <rect key={`${x}${y}`} x={x} y={y - 4} width={4} height={9} rx="1.2" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.5" />))}
        <circle cx={808} cy={388} r="7" fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.7" />
        <line x1={808} y1={388} x2={808} y2={368} stroke={C.hullOutline} strokeWidth="1.4" />
        <rect x={798} y={352} width={20} height={6} rx="1" fill="#16252a" stroke={C.vent} strokeWidth="0.4" />
        <Tag x={808} y={426} size={3.8} color={C.text}>APC</Tag>
      </g>
      {[758, 838].map((x) => (
        <g key={x}>
          <rect x={x} y={474} width={20} height={36} rx="2" fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.7" />
          <rect x={x + 2} y={476} width={16} height={9} rx="1" fill="#16252a" stroke={C.vent} strokeWidth="0.3" />
          {[480, 504].map((y) => [x - 2, x + 20].map((wx) => <rect key={`${wx}${y}`} x={wx} y={y} width={2.5} height={6} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.3" />))}
        </g>
      ))}
      <Tag x={808} y={498} size={3.6}>SURVEY TRUCKS</Tag>
      <rect x={798} y={514} width={20} height={14} rx="1.5" {...line} />
      <Tag x={808} y={536} size={3.4}>TRACTOR</Tag>
      {/* HYDROPONICS: planter rows */}
      {[598, 614, 678, 694, 708].map((y) => (
        <g key={y}>
          <rect x={756} y={y - 4} width={y < 620 ? 92 : 104} height={8} rx="2" fill="#123d24" stroke="#2f7a4c" strokeWidth="0.5" opacity="0.85" />
          {Array.from({ length: y < 620 ? 11 : 13 }, (_, i) => <circle key={i} cx={761 + i * 8} cy={y} r="2.2" fill="#2f7a4c" opacity="0.55" />)}
        </g>
      ))}
      {/* MAINTENANCE: generators, water reclamation tanks, waste plant */}
      {[592, 624].map((x) => <g key={x}><circle cx={x} cy={778} r="11" {...bright} /><circle cx={x} cy={778} r="4" {...line} /></g>)}
      <Machine x={644} y={752} w={18} h={14} />
      {[792, 820, 848].map((x) => <g key={x}><circle cx={x} cy={788} r="9" fill="none" stroke={C.vent} strokeWidth="0.7" opacity="0.7" /><circle cx={x} cy={788} r="3" fill={C.vent} opacity="0.3" /></g>)}
      <Machine x={776} y={752} w={28} h={10} />
    </g>
  );
}

function ColonyDecor() {
  const C = useMapTheme();
  const pad = zone('landing-pad'), road = zone('service-road');
  return (
    <g>
      {ribs(C)}
      {SHUTTERS.map((s, i) => <Shutter key={i} {...s} />)}
      <Interiors />
      {/* sentry guns covering the approaches to Operations (the barricade) */}
      <Sentry x={559} y={474} facing={0} />
      <Sentry x={735} y={474} facing={0} />
      <Sentry x={808} y={330} facing={0} />
      {/* south lock: airlock pod and ramp down to the ground */}
      <rect x={466} y={746} width={30} height={22} fill={C.wall} stroke={C.hullOutline} strokeWidth="0.8" rx="1" />
      <rect x={469} y={749} width={24} height={16} fill={C.floor} />
      <g transform="translate(481,757)">{[-1].map((k) => <g key={k}><circle r="4.5" fill="none" stroke={C.accent} strokeWidth="0.6" opacity="0.7" /><circle r="2" fill="none" stroke={C.accent} strokeWidth="0.6" opacity="0.7" /><line x1="-4.5" x2="4.5" stroke={C.accent} strokeWidth="0.6" opacity="0.7" /></g>)}</g>
      {[770, 774, 778, 782].map((y) => <line key={y} x1={470} y1={y} x2={492} y2={y} stroke={C.hullOutline} strokeWidth="0.6" opacity="0.6" />)}
      <line x1={470} y1={768} x2={470} y2={786} stroke={C.hullOutline} strokeWidth="0.6" opacity="0.6" />
      <line x1={492} y1={768} x2={492} y2={786} stroke={C.hullOutline} strokeWidth="0.6" opacity="0.6" />
      <circle cx={481} cy={746} r="1.8" fill="none" stroke={C.restricted} strokeWidth="0.6" opacity="0.8" />
      <Tag x={516} y={760} anchor="start" size={4.2} color={C.text}>SOUTH LOCK</Tag>
      <Tag x={516} y={767} anchor="start" size={3.4}>STORM-SEALED</Tag>
      {/* Newt’s route: the school closet vent runs under the deck to maintenance */}
      <Tag x={500} y={806} size={3.4} color={C.vent}>CRAWLSPACE VENT</Tag>

      {/* outdoor labels */}
      <ZoneLabel x={466} y={307} label="ATMOSPHERIC PROCESSOR" size={6.6} />
      <Tag x={TOWER.x - TOWER.r - 18} y={TOWER.y} size={4} color={C.restricted} rotate={-90}>SUB-LEVELS · NEST</Tag>
      <Tag x={TOWER.x + TOWER.r + 26} y={TOWER.y + 30} size={3.6} anchor="start">GATE</Tag>
      <BreakMark x={372} y={326} C={C} />
      <Tag x={344} y={336} size={3.6} anchor="end">2 KM · NOT TO SCALE</Tag>
      <BreakMark x={512} y={253} angle={90} C={C} />
      <ZoneLabel x={680} y={226} label="SERVICE ROAD" sub="MARKER POLES · 50 M" size={6.4} />
      <ZoneLabel x={PAD.x} y={pad.y + 18} label="LANDING PAD" size={7} />
      <Tag x={PAD.x} y={PAD.y + 76} size={4.2} color={C.text}>EMERGENCY SHUTTLE · SEATS 12</Tag>
      <Tag x={256} y={582} size={3.4}>WINDSOCK</Tag>
      {/* nav beacon mast for the shuttle approach */}
      <g transform="translate(312,650)" fill="none" stroke={C.accent} strokeWidth="0.6" opacity="0.75"><path d="M -6 6 L 0 -8 L 6 6 Z M -3 -1 L 3 -1" /><circle cy="-8" r="1.4" fill={C.restricted} stroke="none" /><circle cy="-8" r="5" strokeDasharray="1 2" /></g>
      <Tag x={312} y={666} size={3.4}>NAV BEACON</Tag>
      <Tag x={300} y={760} size={4} color={C.textDim}>SCOURED BASALT · STORM DRIFT</Tag>
      <Tag x={345} y={582} size={3.4}>FUEL POINT</Tag>
      <Tag x={410} y={640} size={3.6} rotate={-90} color={C.accent}>POWER CONDUIT</Tag>
      <Tag x={PLATFORM.x + PLATFORM.w - 4} y={PLATFORM.y - 6} size={3.6} anchor="end">RAISED PLATFORM · STILTS</Tag>
      {/* the wind */}
      <g transform={`translate(${road.x + 40},150)`} stroke={C.textDim} fill="none" strokeWidth="0.7" opacity="0.8">
        {[0, 8, 16].map((dy) => <path key={dy} d={`M ${dy * 1.5} ${dy} L ${dy * 1.5 + 34} ${dy + 2}`} strokeDasharray="6 2" />)}
        <path d="M 52 16 L 60 18 L 52 21" />
      </g>
      <Tag x={road.x + 40} y={182} size={3.8} anchor="start">PREVAILING WIND · W</Tag>
    </g>
  );
}

const Main = () => (
  <LevelPlan rooms={hadleysRooms} doors={hadleysDoors} stairs={STAIRS} level="colony"
    conduits={['M 451 713 L 451 790 L 560 790 Q 566 790 570 784']}
    grates={[[451, 708], [565, 788]]}
    decorate={() => <ColonyDecor />} />
);

const T = { equipLine: '#306858', hullOutline: '#40a890', accent: '#50c8a8' };

export const hadleysConfig = {
  width: W,
  height: H,
  stars: { count: 0, seed: 1979 },
  backdrop: 'none',
  levelNoun: 'LEVEL',
  scenarioTag: 'HOPE’S LAST DAY',
  hull: { path: OUTLINE, overlays: ground },
  sidebar: alienSidebar({ title: 'HADLEY’S HOPE', subtitle: 'WEYLAND-YUTANI SHAKE ’N’ BAKE COLONY — LV-426', compass: 'N', scale: 'SCHEMATIC' }),
  decks: [{ id: 'C', level: 'colony', name: 'COLONY', page: 'I', component: Main }],
  specs: {
    title: 'COLONY SURVEY',
    items: [
      ['POPULATION', '158 colonists · emergency shuttle seats 12'],
      ['MODULES', '9 prefab modules on a raised platform, airlocked walkways'],
      ['PROCESSOR', 'Atmosphere conversion · 2 km N · powers the colony'],
      ['WIND', 'Gale-force storms most nights; shutters down at 90 km/h'],
    ],
  },
  legend: alienLegend([
    { label: 'STORM SHUTTER', draw: (y) => <><rect x="0" y={y - 3} width="12" height="4.4" fill="#1c1a10" stroke={SHUTTER} strokeWidth="0.6" />{[3, 6, 9].map((d) => <line key={d} x1={d} y1={y - 5} x2={d} y2={y + 3} stroke={SHUTTER} strokeWidth="0.5" />)}</> },
    { label: 'COVERED WALKWAY', draw: (y) => <><rect x="0" y={y - 4} width="12" height="7" fill={purl('grating')} stroke={T.equipLine} strokeWidth="0.4" />{[3, 6, 9].map((d) => <line key={d} x1={d} y1={y - 4} x2={d} y2={y + 3} stroke={T.hullOutline} strokeWidth="0.4" opacity="0.6" />)}</> },
    { label: 'POWER CONDUIT', draw: (y) => <><line x1="0" y1={y - 1} x2="12" y2={y - 1} stroke={T.hullOutline} strokeWidth="5" opacity="0.5" /><line x1="0" y1={y - 1} x2="12" y2={y - 1} stroke={T.accent} strokeWidth="0.6" strokeDasharray="4 2" opacity="0.6" /></> },
  ]),
};

/** Interactive plan, registered as universe.maps[hadleys-hope].engine */
export function HadleysMap() {
  return <MapEngine config={hadleysConfig} />;
}
HadleysMap.config = hadleysConfig;
