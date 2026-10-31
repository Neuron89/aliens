import React from 'react';
import MapEngine, { useMapTheme, registerIcon, seededRandom, purl } from '../../../engine/components/MapEngine';
import { LevelPlan, alienLegend, alienSidebar, Table, Machine } from './alienMapKit.jsx';
import { W, H, OUTLINE, nebraskaRooms, BUILDING_DOORS, STAIRS, LIFT, PAD, GATE, BREACH } from './nebraska.geometry.js';

/* ═══════════════════════════════════════════════════════════════════════
   FORT NEBRASKA — MapEngine plan (two levels: SURFACE and MINE).
   An outdoor site in the ALIEN deck-plan palette: the plan draws its own
   ground (dust, tyre tracks, the ridge, spoil heaps, the wire) and its
   own underground (rock, galleries, resin). Walled buildings, corridors,
   doors and the cage lift come from nebraska.geometry.js via LevelPlan;
   'zone' rooms (open ground, the wire, galleries, the hive) are drawn here.
   ═══════════════════════════════════════════════════════════════════════ */

const GROUND = '#0a1613', DUST = '#0f1f1b', ROAD = '#0d1c18', SLAB = '#10241f';
const ROCK = '#07100e', ROCK_HI = '#0d1a17', SPOIL = '#122420';
const RESIN = '#0b1411', RESIN_RIB = '#2c4a40', RESIN_HI = '#3b6456';
const zone = (id) => nebraskaRooms.find((r) => r.id === id).rect;

/* ─── Icons (own prefix) ─────────────────────────────────────────────── */
const sentryGlyph = (x, y, C, s = 1) => (
  <g fill="none" stroke={C.accent} strokeWidth={0.6 * s} opacity="0.85">
    <path d={`M ${x - 3 * s} ${y + 3.4 * s} L ${x + 3 * s} ${y + 3.4 * s} L ${x} ${y - 1 * s} Z`} />
    <line x1={x} y1={y - 1 * s} x2={x} y2={y - 4 * s} /><line x1={x - 1.4 * s} y1={y - 2.6 * s} x2={x + 1.4 * s} y2={y - 2.6 * s} />
  </g>
);
const fenceGlyph = (x, y, C) => (
  <g opacity="0.7" stroke={C.accent} strokeWidth="0.5" fill="none"><line x1={x - 4} y1={y + 3} x2={x + 4} y2={y + 3} />{[-3, -1, 1, 3].map((d) => <line key={d} x1={x + d} y1={y - 3} x2={x + d} y2={y + 3} />)}<line x1={x - 4} y1={y - 1} x2={x + 4} y2={y - 1} strokeDasharray="1 1" /></g>
);
const dropshipGlyph = (x, y, C) => (
  <g opacity="0.75" fill="none" stroke={C.accent} strokeWidth="0.6"><path d={`M ${x} ${y - 3.8} L ${x + 1.4} ${y + 1} L ${x + 4.2} ${y + 2.4} L ${x} ${y + 1.6} L ${x - 4.2} ${y + 2.4} L ${x - 1.4} ${y + 1} Z`} /></g>
);
const vehicleGlyph = (x, y, C) => (
  <g opacity="0.7" fill="none" stroke={C.accent} strokeWidth="0.6"><rect x={x - 4} y={y - 1.8} width="8" height="3.6" rx="0.6" /><circle cx={x - 2.4} cy={y + 2.6} r="1" /><circle cx={x + 2.4} cy={y + 2.6} r="1" /></g>
);
const eggGlyph = (x, y, C, s = 1) => (
  <g fill={RESIN} stroke={C.restricted} strokeWidth={0.55} opacity="0.85">
    <path d={`M ${x} ${y - 3.8 * s} C ${x + 3.4 * s} ${y - 2 * s}, ${x + 3 * s} ${y + 3.6 * s}, ${x} ${y + 3.6 * s} C ${x - 3 * s} ${y + 3.6 * s}, ${x - 3.4 * s} ${y - 2 * s}, ${x} ${y - 3.8 * s} Z`} />
    <path d={`M ${x - 1.4 * s} ${y - 1.6 * s} L ${x} ${y} L ${x + 1.4 * s} ${y - 1.6 * s} M ${x} ${y} L ${x} ${y - 2.4 * s}`} fill="none" />
  </g>
);
registerIcon('nebraska-sentry', (x, y, C) => sentryGlyph(x, y, C));
registerIcon('nebraska-fence', fenceGlyph);
registerIcon('nebraska-egg', (x, y, C) => eggGlyph(x, y, C));

/* ─── Shared bits ────────────────────────────────────────────────────── */

function ZoneLabel({ x, y, label, sub, size = 7, anchor = 'middle', rotate, color }) {
  const C = useMapTheme();
  const tr = rotate ? `rotate(${rotate},${x},${y})` : undefined;
  return (
    <g transform={tr} pointerEvents="none">
      <text x={x} y={y} fill={color || C.text} fontSize={size} textAnchor={anchor} letterSpacing="0.2em" style={{ fontFamily: 'var(--font-display)' }}>{label}</text>
      {sub && <text x={x} y={y + 8.5} fill={C.textDim} fontSize="4.6" textAnchor={anchor} letterSpacing="0.12em">{sub}</text>}
    </g>
  );
}

function Tag({ x, y, children, color, anchor = 'middle', size = 4.4, rotate }) {
  const C = useMapTheme();
  return <text x={x} y={y} fill={color || C.textDim} fontSize={size} textAnchor={anchor} letterSpacing="0.14em" pointerEvents="none"
    transform={rotate ? `rotate(${rotate},${x},${y})` : undefined}>{children}</text>;
}

const poly = (pts) => `M ${pts.map((p) => p.join(' ')).join(' L ')} Z`;

function speckle(seed, n, x0, y0, w, h, color, r = 0.6, opacity = 0.3) {
  const rng = seededRandom(seed);
  return Array.from({ length: n }, (_, i) => <circle key={i} cx={(x0 + rng() * w).toFixed(1)} cy={(y0 + rng() * h).toFixed(1)} r={(r * (0.5 + rng())).toFixed(2)} fill={color} opacity={opacity} />);
}

function boulder(x, y, r, key, C, fill = ROCK) {
  return <path key={key} d={`M ${x - r} ${y} L ${x - r * 0.4} ${y - r * 0.9} L ${x + r * 0.8} ${y - r * 0.5} L ${x + r} ${y + r * 0.4} L ${x} ${y + r * 0.8} Z`} fill={fill} stroke={C.hullOutline} strokeWidth="0.45" opacity="0.9" />;
}

/* Rails with sleepers along a polyline of points. */
function Rails({ pts, C }) {
  const d = `M ${pts.map((p) => p.join(' ')).join(' L ')}`;
  return (
    <g fill="none">
      <path d={d} stroke={C.equipLine} strokeWidth="6" strokeDasharray="0.9 3" opacity="0.6" />
      <path d={d} stroke={C.hullOutline} strokeWidth="5" opacity="0.45" />
      <path d={d} stroke={GROUND} strokeWidth="3.4" />
      <path d={d} stroke={C.equipLine} strokeWidth="3.4" strokeDasharray="0.9 3" opacity="0.6" />
    </g>
  );
}

/* ═══ SURFACE ═══════════════════════════════════════════════════════════ */

const RIDGE_PTS = [[214, 92], [500, 92], [503, 118], [510, 150], [506, 190], [496, 214], [470, 226], [430, 222], [392, 230], [350, 224], [306, 232], [262, 226], [214, 222]];
const EAST_RIM_PTS = [[612, 92], [890, 92], [890, 112], [700, 108], [650, 114], [628, 140], [620, 176], [626, 214], [614, 230], [606, 196], [610, 150], [606, 118]];
const SPOIL_MOUNDS = [[676, 156, 40, 28], [762, 140, 50, 26], [842, 176, 40, 34], [748, 208, 46, 18], [850, 128, 26, 16]];

function surfaceGround(C) {
  const rng = seededRandom(1979);
  const streaks = Array.from({ length: 70 }, () => [214 + rng() * 680, 96 + rng() * 750, 6 + rng() * 14]);
  return (
    <g>
      <rect x="0" y="0" width={W} height={H} fill={GROUND} />
      <g stroke={C.equipLine} strokeWidth="0.45" opacity="0.22">
        {streaks.map(([x, y, l], i) => <line key={i} x1={x} y1={y} x2={x + l} y2={y + l * 0.28} />)}
      </g>
      {speckle(7, 380, 214, 92, 690, 760, C.equipLine, 0.6, 0.35)}
    </g>
  );
}

function ridge(C) {
  const d = poly(RIDGE_PTS);
  return (
    <g>
      <defs><clipPath id="neb-ridge-clip"><path d={d} /></clipPath></defs>
      <path d={d} fill={ROCK} stroke={C.hullOutline} strokeWidth="1" />
      <g clipPath="url(#neb-ridge-clip)" fill="none" stroke={C.hullOutline} strokeWidth="0.5" opacity="0.3">
        {[110, 128, 146, 164, 182, 200, 216].map((y, i) => <path key={y} d={`M 214 ${y} Q 300 ${y + (i % 2 ? 9 : -7)} 380 ${y + 3} T 520 ${y + 8}`} />)}
      </g>
      {/* crest line with hachures falling south */}
      <path d="M 240 140 Q 320 122 400 136 Q 450 146 486 128" fill="none" stroke={C.hullBright} strokeWidth="0.8" opacity="0.5" />
      <g stroke={C.hullOutline} strokeWidth="0.5" opacity="0.35">
        {Array.from({ length: 22 }, (_, i) => { const x = 248 + i * 11; const y = 136 - Math.sin(i / 3.4) * 9; return <line key={i} x1={x} y1={y} x2={x - 2} y2={y + 8} />; })}
      </g>
      {[[262, 214, 5], [330, 226, 4], [420, 214, 3.5], [478, 206, 4.5], [286, 182, 3]].map(([x, y, r], i) => boulder(x, y, r, i, C, ROCK_HI))}
      {/* east rim of the cut */}
      <path d={poly(EAST_RIM_PTS)} fill={ROCK} stroke={C.hullOutline} strokeWidth="0.9" />
    </g>
  );
}

function spoilHeaps(C) {
  return (
    <g>
      {SPOIL_MOUNDS.map(([x, y, rx, ry], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={SPOIL} stroke={C.hullOutline} strokeWidth="0.7" opacity="0.95" />
          {[0.68, 0.4, 0.16].map((k) => <ellipse key={k} cx={x + rx * 0.08} cy={y - ry * 0.1} rx={rx * k} ry={ry * k} fill="none" stroke={C.hullOutline} strokeWidth="0.45" opacity="0.4" />)}
          <g stroke={C.equipLine} strokeWidth="0.45" opacity="0.5">
            {Array.from({ length: 14 }, (_, j) => { const a = (j / 14) * Math.PI * 2; return <line key={j} x1={x + Math.cos(a) * rx * 0.78} y1={y + Math.sin(a) * ry * 0.78} x2={x + Math.cos(a) * rx * 0.97} y2={y + Math.sin(a) * ry * 0.97} />; })}
          </g>
        </g>
      ))}
    </g>
  );
}

/* The cut into the ridge: trench floor, slopes, portal, headframe, rails. */
function mineCut(C) {
  const floor = [[506, 104], [610, 104], [612, 150], [618, 200], [630, 236], [486, 236], [500, 206], [508, 160]];
  return (
    <g>
      <path d={poly(floor)} fill={ROAD} />
      {/* cut slopes: hachures down from both rims */}
      <g stroke={C.hullOutline} strokeWidth="0.5" opacity="0.5">
        {Array.from({ length: 11 }, (_, i) => { const y = 112 + i * 10; return <g key={i}><line x1={505 + (i > 7 ? -(i - 7) * 5 : 0)} y1={y} x2={512 + (i > 7 ? -(i - 7) * 5 : 0)} y2={y + 3} /><line x1={612 + (i > 8 ? (i - 8) * 4 : 0)} y1={y} x2={605 + (i > 8 ? (i - 8) * 4 : 0)} y2={y + 3} /></g>; })}
      </g>
      {/* portal */}
      <rect x="528" y="98" width="62" height="12" fill={C.bg} stroke={C.hullOutline} strokeWidth="0.9" />
      <path d="M 528 110 L 524 114 M 590 110 L 594 114" stroke={C.hullOutline} strokeWidth="0.8" />
      {[536, 548, 560, 572, 584].map((x) => <line key={x} x1={x} y1="99" x2={x} y2="109" stroke={C.hullOutline} strokeWidth="0.4" opacity="0.5" />)}
      {/* headframe legs around the cage lift */}
      <g stroke={C.equipLine} strokeWidth="0.8" opacity="0.8" fill="none">
        <path d={`M ${LIFT.x - 18} ${LIFT.y + 16} L ${LIFT.x} ${LIFT.y - 18} L ${LIFT.x + 18} ${LIFT.y + 16}`} />
        <line x1={LIFT.x - 12} y1={LIFT.y + 4} x2={LIFT.x + 12} y2={LIFT.y + 4} />
        <circle cx={LIFT.x} cy={LIFT.y - 18} r="3" />
      </g>
      {/* ore rails: out of the portal, down the cut, round onto the tip */}
      <Rails C={C} pts={[[592, 110], [592, 170], [598, 186], [612, 196], [650, 206], [700, 214], [722, 216]]} />
      <rect x="719" y="210" width="5" height="12" fill={C.hullOutline} opacity="0.7" />
      {[[587, 128], [587, 146], [634, 197]].map(([x, y], i) => <rect key={i} x={x} y={y} width="10" height="12" rx="1" fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.5" transform={i === 2 ? `rotate(-75,${x + 5},${y + 6})` : undefined} />)}
      {/* conveyor gantry from the cut to the heaps */}
      <g stroke={C.equipLine} strokeWidth="0.6" opacity="0.7">
        <line x1="612" y1="148" x2="752" y2="132" /><line x1="612" y1="154" x2="752" y2="138" />
        {Array.from({ length: 14 }, (_, i) => { const x = 618 + i * 10; const y = 148 - (i * 10 + 6) * (16 / 140); return <line key={i} x1={x} y1={y} x2={x} y2={y + 6} />; })}
      </g>
    </g>
  );
}

/* The haul road: from the cut to the north gate, with a schematic break; tracks NE. */
function haulRoad(C) {
  return (
    <g>
      <path d="M 520 226 L 600 226 L 580 300 L 536 300 Z" fill={ROAD} />
      <g fill="none" stroke={C.equipLine} strokeWidth="2.6" strokeDasharray="5 2 1 2" opacity="0.5">
        <path d="M 546 212 Q 548 260 548 300" /><path d="M 568 212 Q 568 260 568 300" />
      </g>
      {/* schematic break: 3 km of open ground left out */}
      <g fill="none" stroke={C.textBright} strokeWidth="0.7" opacity="0.8">
        <path d="M 512 250 l 8 -4 l 8 8 l 8 -8 l 8 8 l 8 -8 l 8 8 l 8 -8 l 8 8 l 8 -8 l 8 8 l 8 -4" />
        <path d="M 512 258 l 8 -4 l 8 8 l 8 -8 l 8 8 l 8 -8 l 8 8 l 8 -8 l 8 8 l 8 -8 l 8 8 l 8 -4" />
      </g>
      {/* APC tracks heading out NE toward the UPP crash site */}
      <g fill="none" stroke={C.equipLine} strokeWidth="2.2" strokeDasharray="1 2.4" opacity="0.5">
        <path d="M 586 292 C 640 276 720 270 800 256 C 840 250 870 244 892 238" />
        <path d="M 590 300 C 644 284 722 278 802 264 C 842 258 872 252 892 246" />
      </g>
      {/* survey marker posts along the road */}
      {[[606, 272], [510, 276]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="1.6" fill="none" stroke={C.door} strokeWidth="0.5" /><line x1={x} y1={y - 1.6} x2={x} y2={y - 6} stroke={C.door} strokeWidth="0.5" /></g>)}
    </g>
  );
}

/* Fence line of the compound (centred in the four wire zones). */
const FX0 = 256, FX1 = 860, FY0 = 300, FY1 = 812, GATE_HALF = 18;
const SENTRIES = [
  [FX0 + 8, FY0 + 8, 225], [FX1 - 8, FY0 + 8, 315], [FX0 + 8, FY1 - 8, 135], [FX1 - 8, FY1 - 8, 45],
  [GATE.x - 32, FY0 + 9, 270], [GATE.x + 32, FY0 + 9, 270], [FX0 + 8, 564, 180], [FX1 - 8, 604, 0], [GATE.x, FY1 - 8, 90],
];
const FLOODS = [[330, FY0 + 12], [790, FY0 + 12], [FX0 + 12, 440], [FX0 + 12, 700], [FX1 - 12, 440], [FX1 - 12, 720], [400, FY1 - 12], [716, FY1 - 12]];

function wire(C) {
  const runs = [
    [[FX0, FY0], [GATE.x - GATE_HALF, FY0]], [[GATE.x + GATE_HALF, FY0], [FX1, FY0]],
    [[FX1, FY0], [FX1, FY1]], [[FX1, FY1], [FX0, FY1]], [[FX0, FY1], [FX0, FY0]],
  ];
  const posts = [];
  runs.forEach(([[x0, y0], [x1, y1]], ri) => {
    const len = Math.hypot(x1 - x0, y1 - y0); const n = Math.floor(len / 14);
    for (let i = 0; i <= n; i++) posts.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, ri]);
  });
  const loops = [];
  runs.forEach(([[x0, y0], [x1, y1]], ri) => {
    const len = Math.hypot(x1 - x0, y1 - y0); const n = Math.floor(len / 5);
    const nx = ri === 0 || ri === 1 ? 0 : ri === 2 ? 1 : ri === 3 ? 0 : -1;
    const ny = ri <= 1 ? -1 : ri === 3 ? 1 : 0;
    for (let i = 0; i <= n; i++) loops.push([x0 + ((x1 - x0) * i) / n + nx * 4, y0 + ((y1 - y0) * i) / n + ny * 4]);
  });
  const arc = (x, y, a, r = 46, spread = 50) => {
    const t0 = ((a - spread) * Math.PI) / 180, t1 = ((a + spread) * Math.PI) / 180;
    return `M ${x} ${y} L ${x + Math.cos(t0) * r} ${y + Math.sin(t0) * r} A ${r} ${r} 0 0 1 ${x + Math.cos(t1) * r} ${y + Math.sin(t1) * r} Z`;
  };
  return (
    <g>
      {/* cleared strips inside the wire */}
      {['perimeter-fence', 'west-wire', 'east-wire', 'south-wire'].map((id) => { const r = zone(id); return <rect key={id} {...{ x: r.x, y: r.y, width: r.w, height: r.h }} fill={DUST} opacity="0.7" />; })}
      {/* sentry fields of fire */}
      <g fill={C.accent} fillOpacity="0.05" stroke={C.accent} strokeWidth="0.45" strokeDasharray="2 2.5" strokeOpacity="0.35">
        {SENTRIES.map(([x, y, a], i) => <path key={i} d={arc(x, y, a)} />)}
      </g>
      {/* razor wire coils outside the fence */}
      <g fill="none" stroke={C.equipLine} strokeWidth="0.4" opacity="0.55">
        {loops.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.1" />)}
      </g>
      {/* fence */}
      <g fill="none" stroke={C.hullOutline} strokeWidth="1" opacity="0.9">
        {runs.map(([[x0, y0], [x1, y1]], i) => <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} />)}
      </g>
      {posts.map(([x, y], i) => <rect key={i} x={x - 1} y={y - 1} width="2" height="2" fill={C.hullBright} opacity="0.8" />)}
      {/* north gate: two leaves swung outward, sandbag nests and a booth */}
      <g stroke={C.door} strokeWidth="1" opacity="0.9">
        <line x1={GATE.x - GATE_HALF} y1={FY0} x2={GATE.x - GATE_HALF + 4} y2={FY0 - 16} />
        <line x1={GATE.x + GATE_HALF} y1={FY0} x2={GATE.x + GATE_HALF - 4} y2={FY0 - 16} />
      </g>
      {[GATE.x - GATE_HALF - 2, GATE.x + GATE_HALF + 2].map((x) => <circle key={x} cx={x} cy={FY0} r="2.2" fill={C.hullDark} stroke={C.door} strokeWidth="0.6" />)}
      <rect x={GATE.x + 40} y={FY0 + 6} width="12" height="10" fill={C.wall} stroke={C.hullOutline} strokeWidth="0.6" />
      {/* floodlight masts */}
      {FLOODS.map(([x, y], i) => (
        <g key={i} opacity="0.75">
          <circle cx={x} cy={y} r="2.2" fill={C.hullDeep} stroke={C.door} strokeWidth="0.5" />
          {[0, 90, 180, 270].map((a) => { const t = (a + 45) * Math.PI / 180; return <line key={a} x1={x + Math.cos(t) * 3} y1={y + Math.sin(t) * 3} x2={x + Math.cos(t) * 5} y2={y + Math.sin(t) * 5} stroke={C.door} strokeWidth="0.45" />; })}
        </g>
      ))}
      {/* sentry guns */}
      {SENTRIES.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="5.4" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.6" />
          {sentryGlyph(x, y + 0.4, C, 1.05)}
        </g>
      ))}
    </g>
  );
}

/* Streets, apron and lanes: packed dirt with tyre tracks. */
function streets(C) {
  const vert = (x) => (
    <g key={x}>
      <rect x={x} y={322} width={24} height={468} fill={ROAD} />
      <line x1={x + 8} y1={326} x2={x + 8} y2={786} stroke={C.equipLine} strokeWidth="2" strokeDasharray="1 2.6" opacity="0.4" />
      <line x1={x + 16} y1={326} x2={x + 16} y2={786} stroke={C.equipLine} strokeWidth="2" strokeDasharray="1 2.6" opacity="0.4" />
    </g>
  );
  const bags = (x0, x1, y) => Array.from({ length: Math.floor((x1 - x0) / 7) }, (_, i) => <rect key={i} x={x0 + i * 7} y={y} width="6" height="3.2" rx="1.4" fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.35" opacity="0.85" />);
  return (
    <g>
      {vert(384)}{vert(708)}
      <rect x="408" y="498" width="300" height="22" fill={ROAD} />
      <rect x="408" y="636" width="300" height="24" fill={ROAD} />
      {/* sandbag line across the apron (gap at the ops door) */}
      {bags(414, 540, 503)}{bags(578, 704, 503)}
      {/* pallets on the apron */}
      {[[418, 510], [430, 510], [684, 510], [696, 510]].map(([x, y], i) => <rect key={i} x={x} y={y} width="9" height="7" fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.7" />)}
      {/* colonists' belongings along Habitat Row */}
      {speckle(23, 34, 500, 640, 204, 16, C.equipLine, 1.3, 0.55)}
      {/* sandbag nest at the barracks door */}
      <path d="M 388 404 A 12 12 0 0 1 388 420" fill="none" stroke={C.hullOutline} strokeWidth="3" opacity="0.4" />
    </g>
  );
}

/* Landing pad: concrete slab, markings, edge lights and the dropship. */
function landingPad(C) {
  const x0 = 418, y0 = 330, w = 280, h = 160;
  const lights = [];
  for (let x = x0; x <= x0 + w; x += 20) lights.push([x, y0], [x, y0 + h]);
  for (let y = y0 + 20; y < y0 + h; y += 20) lights.push([x0, y], [x0 + w, y]);
  const { x: cx, y: cy } = PAD;
  const half = (s) => (
    <g transform={`translate(${cx},${cy}) scale(${s},1)`}>
      {/* wing, engine pod, weapon pylon, tail */}
      <path d="M 10 -8 L 50 14 L 50 26 L 11 22 Z" fill={C.hullMid} stroke={C.hullOutline} strokeWidth="0.8" />
      <rect x="44" y="-2" width="14" height="42" rx="5" fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.8" />
      <circle cx="51" cy="40" r="4" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.5" />
      <rect x="26" y="20" width="5" height="16" rx="1" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.5" />
      <path d="M 8 46 L 28 62 L 28 68 L 8 60 Z" fill={C.hullMid} stroke={C.hullOutline} strokeWidth="0.7" />
      <line x1="24" y1="58" x2="24" y2="68" stroke={C.hullBright} strokeWidth="1" />
    </g>
  );
  return (
    <g>
      <rect x={x0} y={y0} width={w} height={h} fill={SLAB} stroke={C.hullOutline} strokeWidth="0.9" />
      <g stroke={C.hullOutline} strokeWidth="0.4" opacity="0.18">
        {Array.from({ length: 11 }, (_, i) => <line key={`v${i}`} x1={x0 + (i + 1) * 23.3} y1={y0} x2={x0 + (i + 1) * 23.3} y2={y0 + h} />)}
        {Array.from({ length: 6 }, (_, i) => <line key={`h${i}`} x1={x0} y1={y0 + (i + 1) * 22.8} x2={x0 + w} y2={y0 + (i + 1) * 22.8} />)}
      </g>
      {/* hazard chevrons at the slab corners */}
      {[[x0, y0, 1, 1], [x0 + w, y0, -1, 1], [x0, y0 + h, 1, -1], [x0 + w, y0 + h, -1, -1]].map(([x, y, dx, dy], i) => (
        <g key={i} stroke={C.door} strokeWidth="0.8" opacity="0.6">
          {[6, 11, 16].map((o) => <line key={o} x1={x + dx * o} y1={y + dy * 2} x2={x + dx * 2} y2={y + dy * o} />)}
        </g>
      ))}
      <circle cx={cx} cy={cy} r="72" fill="none" stroke={C.door} strokeWidth="0.8" strokeDasharray="6 4" opacity="0.45" />
      <circle cx={cx} cy={cy} r="60" fill="none" stroke={C.door} strokeWidth="0.4" opacity="0.3" />
      {lights.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.3" fill={C.door} opacity="0.7" />)}
      {/* dropship shadow, then the airframe, nose north */}
      <path d={`M ${cx + 5} ${cy - 59} L ${cx + 60} ${cy + 24} L ${cx + 5} ${cy + 70} L ${cx - 50} ${cy + 24} Z`} fill="#050b09" opacity="0.5" />
      {half(1)}{half(-1)}
      <path d={`M ${cx} ${cy - 64} C ${cx + 8} ${cy - 56} ${cx + 10} ${cy - 40} ${cx + 11} ${cy - 20} L ${cx + 12} ${cy + 40} L ${cx + 8} ${cy + 60} L ${cx - 8} ${cy + 60} L ${cx - 12} ${cy + 40} L ${cx - 11} ${cy - 20} C ${cx - 10} ${cy - 40} ${cx - 8} ${cy - 56} ${cx} ${cy - 64} Z`}
        fill={C.hullBright} stroke={C.hullOutline} strokeWidth="1" />
      <path d={`M ${cx - 6} ${cy - 50} L ${cx + 6} ${cy - 50} L ${cx + 8} ${cy - 38} L ${cx - 8} ${cy - 38} Z`} fill="#16303a" stroke={C.vent} strokeWidth="0.6" />
      <g stroke={C.hullDark} strokeWidth="0.7" opacity="0.8">
        <line x1={cx - 11} y1={cy - 20} x2={cx + 11} y2={cy - 20} /><line x1={cx - 12} y1={cy + 10} x2={cx + 12} y2={cy + 10} /><line x1={cx} y1={cy - 36} x2={cx} y2={cy + 58} />
      </g>
      {/* lowered rear ramp */}
      <rect x={cx - 8} y={cy + 60} width="16" height="14" fill={SLAB} stroke={C.door} strokeWidth="0.7" strokeDasharray="2 1.5" />
      {/* cargo stacks and fuel point on the slab */}
      {[[650, 446], [664, 446], [650, 460], [664, 460]].map(([x, y], i) => <rect key={i} x={x} y={y} width="12" height="12" fill="none" stroke={C.equipLine} strokeWidth="0.6" opacity="0.7" />)}
      <circle cx="668" cy="350" r="5" fill="none" stroke={C.restricted} strokeWidth="0.6" opacity="0.6" />
      <line x1="668" y1="355" x2="640" y2="384" stroke={C.restricted} strokeWidth="0.5" strokeDasharray="2 2" opacity="0.5" />
      <g transform="translate(686,341) scale(1.4)">{dropshipGlyph(0, 0, C)}</g>
    </g>
  );
}

/* Motor pool: APC, two cargo tractors, fuel bowser, all on a hardstand. */
function motorPool(C) {
  return (
    <g>
      <rect x="282" y="496" width="98" height="136" fill={SLAB} stroke={C.hullOutline} strokeWidth="0.5" opacity="0.8" />
      {/* APC: armoured hull, six wheels, turret, rear ramp to the street */}
      <g transform="translate(316,560)">
        {[-18, 0, 18].map((y) => [-15, 15].map((x) => <rect key={`${x}${y}`} x={x - 3} y={y - 5} width="6" height="10" rx="2" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.4" />))}
        <path d="M -12 -30 L 12 -30 L 13 26 L -13 26 Z" fill={C.hullMid} stroke={C.hullOutline} strokeWidth="0.8" />
        <path d="M -12 -30 L -6 -36 L 6 -36 L 12 -30" fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.6" />
        <circle cx="0" cy="-4" r="7" fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.6" />
        <line x1="0" y1="-4" x2="0" y2="-24" stroke={C.hullBright} strokeWidth="1.4" />
        <rect x="-9" y="26" width="18" height="6" fill="none" stroke={C.door} strokeWidth="0.6" strokeDasharray="1.5 1" />
      </g>
      {/* tractors */}
      {[512, 548].map((y) => (
        <g key={y}>
          <rect x="346" y={y} width="16" height="26" rx="2" fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.6" />
          <rect x="348" y={y + 2} width="12" height="8" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.4" />
          {[y + 4, y + 20].map((yy) => [344, 362].map((x) => <rect key={`${x}${yy}`} x={x - 1.5} y={yy - 3} width="3" height="6" fill={C.hullDeep} />))}
        </g>
      ))}
      {/* fuel bowser */}
      <rect x="344" y="586" width="20" height="34" rx="9" fill={C.hullDark} stroke={C.restricted} strokeWidth="0.6" opacity="0.9" />
      <rect x="347" y="582" width="14" height="8" fill={C.hullMid} stroke={C.hullOutline} strokeWidth="0.4" />
      <g transform="translate(372,503)">{vehicleGlyph(0, 0, C)}</g>
    </g>
  );
}

/* Habitat modules: two rows of prefab boxes on a boardwalk. */
const MODS_X = [418, 474, 530, 586, 642];
function habitats(C) {
  const mod = (x, y, n) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="46" height="38" rx="2" fill={C.wall} stroke={C.hullOutline} strokeWidth="0.8" />
      <rect x={x + 3} y={y + 3} width="40" height="32" rx="1" fill={C.floorCrew} />
      <rect x={x + 3} y={y + 3} width="40" height="32" rx="1" fill={purl('floorTile')} />
      <line x1={x + 23} y1={y + 3} x2={x + 23} y2={y + 35} stroke={C.divider} strokeWidth="0.6" opacity="0.6" />
      <text x={x + 23} y={y + 22} fill={C.textDim} fontSize="5" textAnchor="middle" letterSpacing="0.1em">H{n}</text>
    </g>
  );
  return (
    <g>
      {/* boardwalk */}
      <rect x="414" y="708" width="288" height="24" fill={ROAD} />
      <g stroke={C.equipLine} strokeWidth="0.4" opacity="0.35">{Array.from({ length: 48 }, (_, i) => <line key={i} x1={414 + i * 6} y1="708" x2={414 + i * 6} y2="732" />)}</g>
      {/* connector tubes */}
      {MODS_X.slice(0, -1).map((x) => [686, 752].map((y) => <rect key={`${x}${y}`} x={x + 46} y={y - 3} width="10" height="6" fill={C.wall} stroke={C.hullOutline} strokeWidth="0.5" />))}
      {MODS_X.map((x, i) => mod(x, 667, i + 1))}
      {MODS_X.map((x, i) => mod(x, 733, i + 6))}
      {/* module doors onto the boardwalk */}
      {MODS_X.map((x) => [705, 731].map((y) => <rect key={`${x}d${y}`} x={x + 17} y={y} width="12" height="3" fill={C.door} opacity="0.5" />))}
    </g>
  );
}

function tankFarm(C) {
  return (
    <g>
      <rect x="737" y="456" width="96" height="60" rx="6" fill="none" stroke={C.equipLine} strokeWidth="0.7" strokeDasharray="3 2" opacity="0.7" />
      {[[760, 490, 'H₂O'], [790, 490, 'H₂O'], [818, 490, 'FUEL']].map(([x, y, t], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="12" fill={C.hullDark} stroke={i === 2 ? C.restricted : C.vent} strokeWidth="0.7" />
          <circle cx={x} cy={y} r="5" fill="none" stroke={C.hullOutline} strokeWidth="0.4" opacity="0.6" />
          <text x={x} y={y + 1.6} fill={C.textDim} fontSize="3.6" textAnchor="middle">{t}</text>
        </g>
      ))}
    </g>
  );
}

function supplyDump(C) {
  const boxes = [[740, 688, 30], [740, 702, 30], [774, 688, 30], [808, 688, 26], [740, 724, 30], [774, 724, 30], [774, 738, 30], [808, 730, 26], [808, 744, 26], [740, 760, 30]];
  return (
    <g>
      {boxes.map(([x, y, w], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height="12" fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.5" />
          {[0.33, 0.66].map((k) => <line key={k} x1={x + w * k} y1={y} x2={x + w * k} y2={y + 12} stroke={C.hullOutline} strokeWidth="0.3" opacity="0.5" />)}
        </g>
      ))}
      <rect x="774" y="760" width="30" height="12" fill={C.hullDark} stroke={C.restricted} strokeWidth="0.6" />
      <text x="789" y="768" fill={C.restricted} fontSize="3.6" textAnchor="middle" opacity="0.8">AMMO</text>
    </g>
  );
}

/* Furniture inside the walled buildings (drawn over the room floors). */
function interiors(C) {
  const line = { fill: 'none', stroke: C.equipLine, strokeWidth: 0.6, opacity: 0.6 };
  const bunk = (x, y, key) => <rect key={key} x={x} y={y} width="14" height="7" rx="1" {...line} />;
  return (
    <g pointerEvents="none">
      {/* barracks: bunks down both walls, weapon lockers along the north wall */}
      {[352, 364, 376, 388, 432, 444, 456, 468].map((y) => bunk(296, y, `bw${y}`))}
      {[352, 364, 376, 388, 432, 444, 456, 468].map((y) => bunk(362, y, `be${y}`))}
      {[300, 310, 320, 330, 340, 350, 360].map((x) => <rect key={x} x={x} y="338" width="8" height="5" fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.6" />)}
      <text x="336" y="349" fill={C.textDim} fontSize="3.4" textAnchor="middle" letterSpacing="0.1em">LOCKERS</text>
      {/* med bay: triage beds, cabinets, surgical table */}
      {[648, 666, 684, 732, 750].map((y) => <rect key={y} x="296" y={y} width="16" height="9" rx="1.5" {...line} />)}
      {[648, 660, 672, 736, 748, 760].map((y) => <rect key={y} x="366" y={y} width="10" height="8" {...line} />)}
      <circle cx="344" cy="756" r="6" fill="none" stroke={C.restricted} strokeWidth="0.5" opacity="0.6" />
      <path d="M 341 756 h 6 M 344 753 v 6" stroke={C.restricted} strokeWidth="0.6" opacity="0.7" />
      {/* ops center: console banks, tactical table, sensor wall, comms racks */}
      <path d="M 424 534 Q 480 526 540 534" {...line} /><path d="M 576 534 Q 636 526 692 534" {...line} />
      {[430, 446, 462, 478, 494, 510, 526].map((x) => <rect key={x} x={x} y="535" width="10" height="5" {...line} />)}
      {[590, 606, 622, 638, 654, 670].map((x) => <rect key={x} x={x} y="535" width="10" height="5" {...line} />)}
      <rect x="530" y="596" width="56" height="22" rx="2" fill="none" stroke={C.accent} strokeWidth="0.7" opacity="0.6" />
      <circle cx="558" cy="607" r="6" fill="none" stroke={C.accent} strokeWidth="0.4" opacity="0.5" />
      {[[416, 548], [416, 600]].map(([x, y]) => <rect key={y} x={x} y={y} width="5" height="22" {...line} />)}
      {[[690, 548], [690, 600]].map(([x, y]) => <rect key={y} x={x} y={y} width="8" height="22" fill="none" stroke={C.vent} strokeWidth="0.6" opacity="0.6" />)}
      <Table x={436} y={600} w={36} h={16} /><Table x={644} y={600} w={36} h={16} />
      {/* mine admin: desks, survey table, records */}
      <Table x={742} y={344} w={26} h={12} /><Table x={792} y={344} w={26} h={12} />
      <rect x="752" y="414" width="58" height="26" fill="none" stroke={C.accent} strokeWidth="0.6" opacity="0.55" />
      <path d="M 758 432 q 10 -12 20 -4 t 24 -8" fill="none" stroke={C.accent} strokeWidth="0.4" opacity="0.5" />
      {[364, 376, 388].map((y) => <rect key={y} x="820" y={y} width="5" height="10" {...line} />)}
      {/* power plant: reactor vessel, coolant loops, transformer blocks */}
      <circle cx="770" cy="560" r="17" fill={C.hullDeep} stroke={C.accent} strokeWidth="0.8" opacity="0.85" />
      <circle cx="770" cy="560" r="10" fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.6" />
      <circle cx="770" cy="560" r="3" fill={C.accent} opacity="0.5" />
      <path d="M 787 556 C 800 552 806 560 812 572 M 787 566 C 798 570 804 580 812 586" fill="none" stroke={C.vent} strokeWidth="0.8" opacity="0.6" />
      <Machine x={742} y={622} w={30} h={46} /><Machine x={788} y={622} w={32} h={46} />
    </g>
  );
}

function SurfaceLabels() {
  const C = useMapTheme();
  return (
    <g>
      <ZoneLabel x={330} y={190} label="WEST RIDGE" sub="BASALT · OVERWATCH" size={6.5} />
      <ZoneLabel x={762} y={176} label="SPOIL HEAPS" sub="TAILINGS · DEAD GROUND" size={6.5} />
      <ZoneLabel x={558} y={212} label="MINE ENTRANCE ALPHA" sub="3 KM N · SHAFT 200 M+" size={6.2} color={C.textBright} />
      <Tag x={559} y={95} size={4}>PORTAL</Tag>
      <Tag x={688} y={226} size={4}>ORE TIP</Tag>
      <Tag x={688} y={126} size={4} anchor="start">CONVEYOR</Tag>
      <ZoneLabel x={340} y={262} label="HAUL ROAD" sub="OPEN GROUND · FLOODLIT 200 M" size={6.5} />
      <Tag x={636} y={258} color={C.textBright} size={4.8} anchor="start">≈ 3 KM</Tag>
      <Tag x={636} y={265} size={3.8} anchor="start">SCHEMATIC BREAK</Tag>
      <Tag x={884} y={232} size={4} anchor="end">TRACKS ▶ UPP CRASH SITE · 20 KM</Tag>
      <Tag x={GATE.x} y={FY0 - 18} color={C.door} size={4.6}>NORTH GATE</Tag>
      <Tag x={GATE.x + 46} y={FY0 + 24} size={3.6}>BOOTH</Tag>
      <ZoneLabel x={420} y={316} label="PERIMETER FENCE" size={5.2} />
      <g transform="translate(366,313)">{fenceGlyph(0, 0, C)}</g>
      <Tag x={262} y={630} size={4.2} rotate={-90} color={C.text}>WEST WIRE</Tag>
      <Tag x={854} y={520} size={4.2} rotate={90} color={C.text}>EAST WIRE</Tag>
      <Tag x={480} y={809} size={4.2} color={C.text}>SOUTH WIRE</Tag>
      <Tag x={640} y={809} size={3.8} color={C.restricted}>PATCHED GAP</Tag>
      <ZoneLabel x={457} y={414} label="LANDING PAD" sub="UD-4 · EXTRACTION" size={6.4} color={C.textBright} />
      <Tag x={PAD.x} y={PAD.y + 82} color={C.door} size={3.8}>RAMP</Tag>
      <Tag x={668} y={366} size={3.6} color={C.restricted}>FUEL POINT</Tag>
      <ZoneLabel x={331} y={627} label="MOTOR POOL" size={4.8} />
      <Tag x={316} y={518} size={3.6}>APC</Tag>
      <Tag x={396} y={470} size={4} rotate={-90}>WEST STREET</Tag>
      <Tag x={720} y={470} size={4} rotate={-90}>EAST STREET</Tag>
      <Tag x={558} y={516} size={3.8}>PAD APRON</Tag>
      <Tag x={470} y={651} size={3.8}>HABITAT ROW</Tag>
      <ZoneLabel x={558} y={719} label="COLONY HABITATS" sub="60+ CIVILIANS · 10 MODULES" size={5.8} />
      <Tag x={785} y={464} size={3.8} color={C.text}>TANK FARM</Tag>
      <Tag x={789} y={786} size={3.8} color={C.text}>SUPPLY DUMP</Tag>
    </g>
  );
}

function SurfaceDecor() {
  const C = useMapTheme();
  return (
    <g>
      {interiors(C)}
      <SurfaceLabels />
    </g>
  );
}

const withLabels = (level) => STAIRS.map((s) => ({ ...s, label: s.labels?.[level] || s.label }));

const Surface = () => {
  const C = useMapTheme();
  return (
    <g>
      {surfaceGround(C)}
      {spoilHeaps(C)}
      {ridge(C)}
      {mineCut(C)}
      {haulRoad(C)}
      {streets(C)}
      {wire(C)}
      {landingPad(C)}
      {motorPool(C)}
      {habitats(C)}
      {tankFarm(C)}
      {supplyDump(C)}
      <LevelPlan rooms={nebraskaRooms} doors={BUILDING_DOORS} stairs={withLabels('surface')} level="surface" decorate={() => <SurfaceDecor />} />
    </g>
  );
};

/* ═══ MINE ══════════════════════════════════════════════════════════════ */

function mineRock(C) {
  const rng = seededRandom(4242);
  const cracks = Array.from({ length: 60 }, () => {
    const x = 214 + rng() * 690, y = 92 + rng() * 760, a = rng() * Math.PI, l = 8 + rng() * 22;
    const mx = x + Math.cos(a) * l * 0.5 + (rng() - 0.5) * 6, my = y + Math.sin(a) * l * 0.5 + (rng() - 0.5) * 6;
    return `M ${x.toFixed(1)} ${y.toFixed(1)} L ${mx.toFixed(1)} ${my.toFixed(1)} L ${(x + Math.cos(a) * l).toFixed(1)} ${(y + Math.sin(a) * l).toFixed(1)}`;
  });
  return (
    <g>
      <rect x="0" y="0" width={W} height={H} fill={ROCK} />
      <g fill="none" stroke={C.hullOutline} strokeWidth="0.45" opacity="0.18">
        {[150, 230, 330, 450, 590, 740].map((y, i) => <path key={y} d={`M 214 ${y} Q 400 ${y + (i % 2 ? 26 : -22)} 560 ${y + 6} T 900 ${y + 14}`} strokeDasharray="10 6" />)}
      </g>
      <g fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.35">{cracks.map((d, i) => <path key={i} d={d} />)}</g>
      {speckle(91, 300, 214, 92, 690, 760, C.equipLine, 0.6, 0.3)}
    </g>
  );
}

/* Carved tunnel floor around the walled rooms / corridors (a halo of worked rock). */
function workings(C) {
  const halo = (x, y, w, h, key) => <rect key={key} x={x - 6} y={y - 6} width={w + 12} height={h + 12} rx="6" fill={ROCK_HI} stroke={C.hullOutline} strokeWidth="0.5" strokeOpacity="0.4" />;
  return (
    <g>
      {halo(492, 112, 148, 84, 'sf')}
      {halo(548, 196, 20, 324, 'mh')}
      {halo(300, 296, 248, 20, 'wd')}
      {halo(330, 316, 90, 56, 'dl')}
      {halo(270, 372, 210, 188, 'lab')}
      {/* abandoned, sealed workings (decor only) */}
      <g fill="none" stroke={C.hullOutline} strokeWidth="0.6" strokeDasharray="4 3" opacity="0.4">
        <path d="M 260 150 L 440 150 L 440 176 L 284 176 L 284 236 L 260 236 Z" />
        <path d="M 330 176 L 330 216 L 400 216 L 400 176" />
        <path d="M 860 460 L 720 460 L 720 500 L 700 500" />
        <path d="M 860 470 L 730 470 L 730 500" />
      </g>
      <circle cx="700" cy="500" r="6" fill="none" stroke={C.vent} strokeWidth="0.6" strokeDasharray="2 2" opacity="0.5" />
      {/* backfill at the west end of the drift */}
      <g>{Array.from({ length: 9 }, (_, i) => boulder(296 + (i % 3) * 5, 296 + Math.floor(i / 3) * 7, 3, i, C, ROCK_HI))}</g>
    </g>
  );
}

const GALLERY_PTS = [[568, 252], [604, 240], [700, 246], [800, 238], [852, 256], [858, 330], [850, 420], [760, 434], [660, 428], [580, 436], [568, 420]];
const PILLARS_X = [606, 664, 722, 780], PILLARS_Y = [258, 344, 384];

function oreGallery(C) {
  return (
    <g>
      <path d={poly(GALLERY_PTS)} fill={ROCK_HI} stroke={C.hullOutline} strokeWidth="0.8" />
      <g stroke={C.equipLine} strokeWidth="0.4" opacity="0.3">{Array.from({ length: 26 }, (_, i) => <line key={i} x1={578 + i * 11} y1="248" x2={570 + i * 11} y2="430" strokeDasharray="1 5" />)}</g>
      {PILLARS_X.map((x) => PILLARS_Y.map((y) => (
        <path key={`${x}${y}`} d={`M ${x} ${y + 2} L ${x + 4} ${y} L ${x + 30} ${y + 1} L ${x + 32} ${y + 6} L ${x + 30} ${y + 26} L ${x + 2} ${y + 28} Z`} fill={ROCK} stroke={C.hullOutline} strokeWidth="0.6" />
      )))}
      {/* timber props and a collapsed heading to the east */}
      {[[650, 300], [708, 300], [766, 300], [826, 300]].map(([x, y], i) => <rect key={i} x={x} y={y} width="3" height="3" fill={C.door} opacity="0.5" />)}
      <g>{Array.from({ length: 7 }, (_, i) => boulder(838 + (i % 2) * 6, 360 + i * 7, 3.5, i, C, ROCK))}</g>
      {/* abandoned ore car on a spur */}
      <path d="M 568 338 L 600 338" stroke={C.hullOutline} strokeWidth="3" opacity="0.4" />
      <rect x="580" y="333" width="12" height="10" rx="1" fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.5" />
    </g>
  );
}

const DEEP_PTS = [[480, 528], [520, 520], [600, 524], [700, 518], [800, 526], [856, 540], [860, 610], [840, 640], [700, 636], [600, 642], [480, 634]];
const WINZES = [[530, 600], [620, 566], [810, 572]];

function deepShafts(C) {
  return (
    <g>
      <path d={poly(DEEP_PTS)} fill={ROCK_HI} stroke={C.hullOutline} strokeWidth="0.8" />
      {WINZES.map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx="11" ry="8" fill={C.bg} stroke={C.hullOutline} strokeWidth="0.7" />
          {[-3, 0, 3].map((d) => <line key={d} x1={x - 4} y1={y + d} x2={x + 4} y2={y + d} stroke={C.shaft} strokeWidth="0.5" opacity="0.6" />)}
        </g>
      ))}
      {/* resin begins: smears thickening to the south */}
      <g fill="none" stroke={RESIN_RIB} strokeWidth="1.1" opacity="0.8">
        {Array.from({ length: 16 }, (_, i) => { const x = 492 + i * 23; const y = 628 - (i % 3) * 4; return <path key={i} d={`M ${x} ${y} q 4 -${8 + (i % 4) * 3} 10 0`} />; })}
      </g>
    </g>
  );
}

/* The hive: a resin-walled cavern with ribbed walls, eggs and cocoons. */
const HIVE_PTS = [[300, 668], [330, 648], [420, 644], [520, 652], [620, 644], [700, 650], [800, 644], [852, 664], [860, 720], [850, 790], [800, 822], [680, 818], [560, 826], [440, 818], [340, 822], [304, 790], [298, 730]];
const EGGS = [[420, 768], [432, 776], [412, 782], [444, 786], [468, 770], [690, 784], [704, 792], [678, 796], [716, 780], [600, 798], [612, 790]];
const COCOONS = [[320, 700, -60], [326, 742, -80], [846, 700, 70], [840, 752, 90], [500, 660, 10], [760, 660, -10]];
const VENT_HOLES = [[380, 700], [560, 690], [780, 720]];

function hive(C) {
  const d = poly(HIVE_PTS);
  const rng = seededRandom(1986);
  const ribs = Array.from({ length: 260 }, (_, i) => {
    const ring = i % 2 ? 0.86 : 1; const t = (i >> 1) / 130; const idx = Math.floor(t * HIVE_PTS.length);
    const [x0, y0] = HIVE_PTS[idx]; const [x1, y1] = HIVE_PTS[(idx + 1) % HIVE_PTS.length];
    const f = t * HIVE_PTS.length - idx; const cx = 580, cy = 736;
    const x = cx + (x0 + (x1 - x0) * f - cx) * ring, y = cy + (y0 + (y1 - y0) * f - cy) * ring;
    const len = 12 + rng() * 22; const a = Math.atan2(cy - y, cx - x);
    return `M ${x.toFixed(1)} ${y.toFixed(1)} Q ${(x + Math.cos(a + 0.6) * len * 0.6).toFixed(1)} ${(y + Math.sin(a + 0.6) * len * 0.6).toFixed(1)} ${(x + Math.cos(a) * len).toFixed(1)} ${(y + Math.sin(a) * len).toFixed(1)}`;
  });
  return (
    <g>
      <defs><clipPath id="neb-hive-clip"><path d={d} /></clipPath></defs>
      <path d={d} fill={RESIN} stroke={RESIN_HI} strokeWidth="1.4" />
      <g clipPath="url(#neb-hive-clip)">
        {/* ribbed resin walls */}
        <g fill="none" stroke={RESIN_RIB} strokeWidth="1.2" opacity="0.85">{ribs.map((p, i) => <path key={i} d={p} />)}</g>
        <g fill="none" stroke={RESIN_RIB} strokeWidth="0.5" opacity="0.35">
          {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M 300 ${662 + i * 14} Q 440 ${652 + i * 14 + (i % 2 ? 12 : -10)} 580 ${662 + i * 14} T 860 ${664 + i * 14}`} />)}
        </g>
        {/* organic struts and webbing */}
        <g fill="none" stroke={RESIN_RIB} strokeWidth="0.6" opacity="0.6">
          {[[340, 690, 470, 740], [460, 660, 520, 760], [640, 660, 600, 760], [780, 668, 700, 760], [820, 760, 720, 806], [360, 800, 500, 780]].map(([a, b, c, e], i) => <path key={i} d={`M ${a} ${b} Q ${(a + c) / 2 + 18} ${(b + e) / 2 - 14} ${c} ${e}`} />)}
        </g>
        {/* resin columns */}
        {[[480, 706], [650, 712], [752, 760], [372, 760]].map(([x, y], i) => (
          <g key={i}>
            <ellipse cx={x} cy={y} rx="9" ry="7" fill={RESIN} stroke={RESIN_HI} strokeWidth="0.8" />
            {[0, 1, 2].map((k) => <ellipse key={k} cx={x} cy={y} rx={9 - k * 3} ry={7 - k * 2.3} fill="none" stroke={RESIN_RIB} strokeWidth="0.5" />)}
          </g>
        ))}
        {/* holes in the floor/walls the creatures move through */}
        {VENT_HOLES.map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="6" ry="4" fill={C.bg} stroke={RESIN_HI} strokeWidth="0.6" />)}
        {/* brood chamber: the deepest bay, a wide cluster of eggs */}
        <ellipse cx="800" cy="782" rx="40" ry="26" fill="none" stroke={C.restricted} strokeWidth="0.6" strokeDasharray="3 3" opacity="0.55" />
        {[[784, 776], [796, 770], [808, 778], [790, 790], [804, 792], [818, 786], [776, 788]].map(([x, y], i) => <g key={`b${i}`}>{eggGlyph(x, y, C, 1.25)}</g>)}
        {EGGS.map(([x, y], i) => <g key={i}>{eggGlyph(x, y, C, 1.15)}</g>)}
        {/* cocooned victims on the walls */}
        {COCOONS.map(([x, y, a], i) => (
          <g key={i} transform={`rotate(${a},${x},${y})`}>
            <ellipse cx={x} cy={y} rx="4.2" ry="10" fill={C.hullDeep} stroke={RESIN_HI} strokeWidth="0.7" />
            {[-6, -2, 2, 6].map((dy) => <path key={dy} d={`M ${x - 4} ${y + dy} q 4 2 8 0`} fill="none" stroke={RESIN_RIB} strokeWidth="0.5" />)}
            <circle cx={x} cy={y - 7} r="1.8" fill="none" stroke={C.textDim} strokeWidth="0.4" />
          </g>
        ))}
      </g>
      {/* resin-lined mouths up into the deep shafts */}
      {[640, 800].map((x) => <path key={x} d={`M ${x - 14} 646 Q ${x} 632 ${x + 14} 646`} fill="none" stroke={RESIN_HI} strokeWidth="1.6" />)}
    </g>
  );
}

/* Lab interior: containment cells (one burst), tanks, benches, beacon; the breach. */
function labInterior(C) {
  const line = { fill: 'none', stroke: C.equipLine, strokeWidth: 0.6, opacity: 0.6 };
  return (
    <g pointerEvents="none">
      {[384, 424, 464].map((y, i) => (
        <g key={y}>
          <rect x="436" y={y} width="36" height="34" fill={C.hullDeep} stroke={i === 1 ? C.restricted : C.vent} strokeWidth="0.8" opacity="0.9" />
          <line x1="436" y1={y + 17} x2="472" y2={y + 17} stroke={C.hullOutline} strokeWidth="0.3" opacity="0.4" />
          {i === 1 && <path d={`M 436 ${y + 6} l -6 3 l 4 3 l -7 4 l 5 2 l -6 5`} fill="none" stroke={C.restricted} strokeWidth="0.7" />}
        </g>
      ))}
      <text x="454" y="506" fill={C.textDim} fontSize="3.6" textAnchor="middle" letterSpacing="0.1em">CELLS</text>
      {[[296, 512], [322, 512], [348, 512]].map(([x, y], i) => (
        <g key={i}><circle cx={x} cy={y} r="9" fill="none" stroke={C.vent} strokeWidth="0.7" opacity="0.7" /><circle cx={x} cy={y} r="3" fill={C.vent} opacity="0.3" /></g>
      ))}
      <text x="322" y="532" fill={C.textDim} fontSize="3.6" textAnchor="middle" letterSpacing="0.1em">SPECIMEN TANKS</text>
      <Table x={284} y={386} w={56} h={12} /><Table x={284} y={410} w={56} h={12} />
      {[[350, 388], [362, 388], [350, 412], [362, 412]].map(([x, y], i) => <rect key={i} x={x} y={y} width="8" height="6" {...line} />)}
      {/* emergency beacon */}
      <g transform="translate(404,526)">
        {[4, 8, 12].map((r) => <circle key={r} r={r} fill="none" stroke={C.door} strokeWidth="0.6" opacity={1 - r / 16} />)}
        <circle r="1.8" fill={C.door} />
      </g>
      <text x="404" y="547" fill={C.door} fontSize="3.8" textAnchor="middle" letterSpacing="0.12em">BEACON</text>
      {/* the breach in the east wall, acid scoring and debris spilling out */}
      <path d={`M ${BREACH.x - 4} ${BREACH.y - 12} l 6 3 l -3 5 l 7 4 l -5 4 l 6 5 l -7 3`} fill={ROCK_HI} stroke={C.restricted} strokeWidth="0.9" />
      {[[490, 532], [496, 546], [504, 538], [500, 552]].map(([x, y], i) => boulder(x, y, 2.4, i, C, ROCK))}
      {[[466, 548], [470, 538], [460, 552]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.4" fill="none" stroke={C.restricted} strokeWidth="0.5" opacity="0.6" />)}
    </g>
  );
}

/* Haulage rails and the shaft-foot fittings. */
function haulageFittings(C) {
  return (
    <g pointerEvents="none">
      <g stroke={C.hullOutline} strokeWidth="0.6" opacity="0.6">
        <line x1="554" y1="198" x2="554" y2="518" /><line x1="562" y1="198" x2="562" y2="518" />
      </g>
      {[262, 430].map((y) => <rect key={y} x="551" y={y} width="14" height="16" rx="1" fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.5" />)}
      {[600, 612, 624].map((x) => <rect key={x} x={x} y="118" width="7" height="12" {...{ fill: 'none', stroke: C.equipLine, strokeWidth: 0.5, opacity: 0.7 }} />)}
      <text x="612" y="138" fill={C.textDim} fontSize="3.4" textAnchor="middle">LAMPS</text>
    </g>
  );
}

function MineLabels() {
  const C = useMapTheme();
  return (
    <g>
      <Tag x={252} y={126} anchor="start" size={4.6} color={C.text}>200 M BELOW MINE ENTRANCE ALPHA</Tag>
      <Tag x={330} y={196} size={3.8}>OLD WORKINGS · SEALED</Tag>
      <Tag x={770} y={482} size={3.8}>VENT RAISE (DISUSED)</Tag>
      <ZoneLabel x={720} y={316} label="ORE GALLERY" sub="ROOM & PILLAR · LOW ROOF" size={6.2} />
      <ZoneLabel x={712} y={590} label="DEEP SHAFTS" sub="WINZES · FIRST RESIN" size={6.2} />
      <Tag x={530} y={618} size={3.8}>WINZE</Tag>
      <Tag x={810} y={590} size={3.8}>WINZE</Tag>
      <ZoneLabel x={575} y={736} label="THE HIVE" sub="RESIN · COCOONS · EGGS — DO NOT ENTER" size={8} color={C.restricted} />
      <Tag x={800} y={814} size={4} color={C.restricted}>BROOD CHAMBER</Tag>
      <Tag x={BREACH.x + 34} y={BREACH.y + 2} size={4.2} color={C.restricted} anchor="start">BREACH</Tag>
      <Tag x={300} y={290} size={3.8} anchor="start">BACKFILL ◀</Tag>
      <Tag x={852} y={428} size={3.6} anchor="end">COLLAPSE</Tag>
    </g>
  );
}

function MineDecor() {
  const C = useMapTheme();
  return (
    <g>
      {labInterior(C)}
      {haulageFittings(C)}
      <MineLabels />
    </g>
  );
}

const Mine = () => {
  const C = useMapTheme();
  return (
    <g>
      {mineRock(C)}
      {workings(C)}
      {oreGallery(C)}
      {deepShafts(C)}
      {hive(C)}
      <LevelPlan rooms={nebraskaRooms} doors={BUILDING_DOORS} stairs={withLabels('mine')} level="mine" decorate={() => <MineDecor />} />
    </g>
  );
};

/* ═══ Config ════════════════════════════════════════════════════════════ */

const LC = { accent: '#50c8a8', equipLine: '#306858', hullOutline: '#40a890', hullDeep: '#103830', restricted: '#c04040' };

export const nebraskaConfig = {
  width: W,
  height: H,
  stars: { count: 0, seed: 1979 },
  backdrop: 'none',
  levelNoun: 'LEVEL',
  scenarioTag: 'DESTROYER OF WORLDS',
  hull: { path: OUTLINE },
  sidebar: alienSidebar({ title: 'FORT NEBRASKA', subtitle: 'UA MINING COLONY & FORWARD OPERATING BASE — ARIARCUS', scale: 'SCHEMATIC · NOT TO SCALE', compass: 'N' }),
  decks: [
    { id: 'S', level: 'surface', name: 'SURFACE', page: 'I', component: Surface },
    { id: 'M', level: 'mine', name: 'MINE', page: 'II', component: Mine },
  ],
  specs: {
    title: 'SITE SURVEY',
    y: 852,
    items: [
      ['GARRISON', 'USCMC platoon (two squads) · 60+ colonists'],
      ['VEHICLES', 'UD-4 dropship · APC · 2 cargo tractors · fuel bowser'],
      ['POWER', 'Fusion plant · lights, sensors and sentries on one grid'],
      ['UPP LAB', '3 km N up the haul road, then 200 m down the cage lift'],
      ['MINE DEPTH', 'Shaft 200 m+ · deep shafts and the hive below'],
    ],
  },
  legend: alienLegend([
    { label: 'SENTRY GUN', draw: (y) => <><circle cx="5" cy={y - 1} r="5" fill={LC.hullDeep} stroke={LC.hullOutline} strokeWidth="0.5" />{sentryGlyph(5, y - 0.6, LC, 0.95)}</> },
    { label: 'PERIMETER WIRE', draw: (y) => <><line x1="0" y1={y - 1} x2="12" y2={y - 1} stroke={LC.hullOutline} strokeWidth="1" />{[1, 6, 11].map((x) => <rect key={x} x={x - 1} y={y - 2} width="2" height="2" fill={LC.hullOutline} />)}{[2, 5, 8, 11].map((x) => <circle key={`c${x}`} cx={x} cy={y - 4.5} r="1.4" fill="none" stroke={LC.equipLine} strokeWidth="0.4" />)}</> },
    { label: 'RESIN / HIVE', draw: (y) => <><path d={`M 0 ${y + 2} Q 1 ${y - 6} 6 ${y - 5} Q 12 ${y - 4} 11 ${y + 2} Z`} fill={RESIN} stroke={RESIN_HI} strokeWidth="0.7" />{[3, 6, 9].map((x) => <path key={x} d={`M ${x} ${y + 1} q 1 -3 0 -5`} fill="none" stroke={RESIN_RIB} strokeWidth="0.6" />)}</> },
    { label: 'ROCK / SPOIL', draw: (y) => <><path d={`M 0 ${y + 3} L 2 ${y - 4} L 7 ${y - 5} L 10 ${y - 1} L 9 ${y + 3} Z`} fill={ROCK} stroke={LC.hullOutline} strokeWidth="0.5" /><line x1="1.5" y1={y - 1} x2="9.5" y2={y - 2} stroke={LC.hullOutline} strokeWidth="0.3" /></> },
  ]),
};

/** Interactive plan, registered as universe.maps[fort-nebraska].engine */
export function NebraskaMap() {
  return <MapEngine config={nebraskaConfig} />;
}
NebraskaMap.config = nebraskaConfig;
