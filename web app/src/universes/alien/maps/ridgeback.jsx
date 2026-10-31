import React from 'react';
import MapEngine, { useMapTheme, registerIcon, seededRandom } from '../../../engine/components/MapEngine';
import { LevelPlan, alienLegend, alienSidebar, Table, Dots, Machine } from './alienMapKit.jsx';
import {
  W, H, OUTLINE, LIFT, LADDER, HATCH, PAD,
  ridgebackRooms, ridgebackDoors, STAIRS,
} from './ridgeback.geometry.js';

/* ═══════════════════════════════════════════════════════════════════════
   RIDGEBACK STATION — MapEngine plan, three levels on one footprint:
   SURFACE (cinder plain, modules, pad, dish), LIFT LANDING (1,200 m down
   the Throat) and DEEP LEVEL (Lava Tube 7, the nest, the Reactor Tap).
   Rooms/doors come from ridgeback.geometry.js, which also feeds the
   normalized board rooms in maps/index.js. Each level paints its own
   ground inside the shared outline.
   ═══════════════════════════════════════════════════════════════════════ */

const CINDER = '#15110e', ASH = '#221c17', ROCK = '#0d1110', ROCK_HOT = '#150d09';
const LAVA = '#3a1408', LAVA_GLOW = '#e8641e', LAVA_HOT = '#ffb050', VIOLET = '#7a3aa8';

registerIcon('ridgeback-custodian', (x, y, C) => (
  <g opacity="0.7" fill="none" stroke={C.textBright} strokeWidth="0.5"><circle cx={x} cy={y - 2.2} r="1.4" /><path d={`M ${x - 2.4} ${y + 3.4} L ${x - 2} ${y} L ${x + 2} ${y} L ${x + 2.4} ${y + 3.4}`} /></g>
));

const stairsFor = (level) => STAIRS
  .filter((s) => s.levels.includes(level))
  .map((s) => ({ ...s, level, label: s.labels?.[level] || s.label }));

/* ─── Small drawing helpers ──────────────────────────────────────────── */

function Tag({ x, y, children, color, anchor = 'middle', size = 4, rotate }) {
  const C = useMapTheme();
  return (
    <text x={x} y={y} fill={color || C.textDim} fontSize={size} textAnchor={anchor} letterSpacing="0.12em" pointerEvents="none"
      transform={rotate ? `rotate(${rotate},${x},${y})` : undefined}>{children}</text>
  );
}

function ZoneLabel({ x, y, label, sub, size = 7.5, anchor = 'middle', rotate, color }) {
  const C = useMapTheme();
  return (
    <g transform={rotate ? `rotate(${rotate},${x},${y})` : undefined} pointerEvents="none">
      <text x={x} y={y} fill={color || C.text} fontSize={size} textAnchor={anchor} letterSpacing="0.2em" style={{ fontFamily: 'var(--font-display)' }}>{label}</text>
      {sub && <text x={x} y={y + 8.5} fill={C.textDim} fontSize="4.6" textAnchor={anchor} letterSpacing="0.12em">{sub}</text>}
    </g>
  );
}

/* Catmull-Rom → cubic Bézier through the points. */
function smooth(pts) {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/* Jagged line through points (fissures, seams). */
function jag(pts, seed, amp = 3) {
  const rng = seededRandom(seed);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 9));
    for (let k = 1; k <= n; k++) {
      const t = k / n, j = k === n ? 0 : (rng() - 0.5) * 2 * amp;
      const nx = -(by - ay), ny = bx - ax, l = Math.hypot(nx, ny) || 1;
      d += ` L ${(ax + (bx - ax) * t + (nx / l) * j).toFixed(1)} ${(ay + (by - ay) * t + (ny / l) * j).toFixed(1)}`;
    }
  }
  return d;
}

function Boulder({ x, y, r, C }) {
  return <path d={`M ${x - r} ${y} L ${x - r * 0.5} ${y - r * 0.9} L ${x + r * 0.7} ${y - r * 0.6} L ${x + r} ${y + r * 0.3} L ${x + r * 0.1} ${y + r * 0.85} L ${x - r * 0.7} ${y + r * 0.6} Z`}
    fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.5" opacity="0.8" />;
}

/* Rock strata across a band (underground levels). */
function strata(C, seed, hot) {
  const rng = seededRandom(seed);
  const out = [];
  for (let y = 112; y < 850; y += 17 + Math.round(rng() * 12)) {
    const a = (rng() - 0.5) * 16, b = (rng() - 0.5) * 16;
    out.push(<path key={y} d={`M 220 ${y} Q 420 ${y + a} 560 ${y + (a + b) / 3} T 900 ${y + b}`} fill="none"
      stroke={hot && rng() < 0.18 ? LAVA_GLOW : C.hullOutline} strokeWidth="0.5" opacity={hot ? 0.16 : 0.12} />);
  }
  const grit = Array.from({ length: 240 }, () => [222 + rng() * 670, 100 + rng() * 755, 0.4 + rng() * 0.9]);
  return <g>{out}{grit.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={C.hullOutline} opacity="0.12" />)}</g>;
}

/* ─── Shaft section inset (landing & deep): where this level sits ────── */
const DEPTH_Y = (m) => 168 + (m / 1340) * 610;
function ShaftSection({ here }) {
  const C = useMapTheme();
  const x0 = 244, x1 = 374, sx = 300;
  const rest = [240, 480, 720, 960];
  const band = { landing: [1185, 1218], deep: [1238, 1352] }[here];
  const mark = (band[0] + band[1]) / 2;
  return (
    <g pointerEvents="none">
      <rect x={x0} y={122} width={x1 - x0} height={690} fill={C.bg} opacity="0.55" stroke={C.frame} strokeWidth="0.6" rx="2" />
      <text x={x0 + 8} y={136} fill={C.text} fontSize="5.4" letterSpacing="0.16em" fontWeight="bold">SECTION · THE THROAT</text>
      <text x={x0 + 8} y={144} fill={C.textDim} fontSize="4" letterSpacing="0.1em">DEPTH BELOW PAD ONE, METRES</text>
      {/* surface, modules and derrick */}
      <path d={jag([[x0 + 4, DEPTH_Y(0)], [x1 - 4, DEPTH_Y(0)]], 11, 1.5)} fill="none" stroke={C.hullOutline} strokeWidth="0.8" opacity="0.8" />
      {[[sx + 14, 10], [sx + 30, 10], [sx + 46, 8]].map(([x, w], i) => <rect key={i} x={x} y={DEPTH_Y(0) - 7} width={w + 4} height={7} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.4" />)}
      <path d={`M ${sx - 6} ${DEPTH_Y(0)} L ${sx + 8} ${DEPTH_Y(0) - 18} L ${sx + 22} ${DEPTH_Y(0)} M ${sx + 1} ${DEPTH_Y(0) - 9} L ${sx + 15} ${DEPTH_Y(0) - 9}`} fill="none" stroke={C.equipLine} strokeWidth="0.5" />
      <text x={x1 - 6} y={DEPTH_Y(0) - 10} fill={C.textDim} fontSize="4" textAnchor="end">SURFACE</text>
      {/* the shaft */}
      <rect x={sx} y={DEPTH_Y(0)} width={16} height={DEPTH_Y(1200) - DEPTH_Y(0)} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.5" />
      <line x1={sx + 4} y1={DEPTH_Y(0)} x2={sx + 4} y2={DEPTH_Y(1200)} stroke={C.shaft} strokeWidth="0.4" strokeDasharray="1.5 1.5" opacity="0.7" />
      <line x1={sx + 12} y1={DEPTH_Y(0)} x2={sx + 12} y2={DEPTH_Y(1200)} stroke={C.equipLine} strokeWidth="0.6" opacity="0.7" />
      {rest.map((m, i) => (
        <g key={m}>
          <rect x={sx - 4} y={DEPTH_Y(m) - 1.5} width={24} height={3} fill={C.equipLine} opacity="0.8" />
          <text x={sx + 26} y={DEPTH_Y(m) + 1.5} fill={C.textDim} fontSize="4">REST DECK {i + 1}</text>
        </g>
      ))}
      {/* depth ticks */}
      {[0, 300, 600, 900, 1200].map((m) => (
        <g key={m}>
          <line x1={x0 + 6} y1={DEPTH_Y(m)} x2={x0 + 12} y2={DEPTH_Y(m)} stroke={C.textDim} strokeWidth="0.5" />
          <text x={x0 + 14} y={DEPTH_Y(m) + 1.5} fill={C.textDim} fontSize="3.8">{m.toLocaleString('en-US')}</text>
        </g>
      ))}
      <line x1={x0 + 9} y1={DEPTH_Y(0)} x2={x0 + 9} y2={DEPTH_Y(1340)} stroke={C.textDim} strokeWidth="0.4" opacity="0.6" />
      {/* lift landing level */}
      <rect x={sx - 4} y={DEPTH_Y(1200) - 8} width={58} height={10} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.5" />
      <text x={sx + 25} y={DEPTH_Y(1200) - 1.6} fill={C.text} fontSize="3.8" textAnchor="middle">LANDING</text>
      {/* lava tube and the nest below */}
      <path d={smooth([[sx + 6, DEPTH_Y(1200) + 2], [sx + 2, DEPTH_Y(1260)], [sx + 40, DEPTH_Y(1275)], [sx + 66, DEPTH_Y(1262)]])} fill="none" stroke={LAVA_GLOW} strokeWidth="4" opacity="0.5" strokeLinecap="round" />
      <text x={sx - 6} y={DEPTH_Y(1262) + 2} fill={LAVA_GLOW} fontSize="3.8" textAnchor="end" opacity="0.9">TUBE 7</text>
      <rect x={sx + 6} y={DEPTH_Y(1290)} width={34} height={12} fill={LAVA} stroke={C.restricted} strokeWidth="0.5" opacity="0.9" />
      <text x={sx + 23} y={DEPTH_Y(1290) + 8} fill={LAVA_HOT} fontSize="3.4" textAnchor="middle">NEST</text>
      <polygon points={`${sx + 46},${DEPTH_Y(1340) - 8} ${sx + 58},${DEPTH_Y(1340) - 8} ${sx + 62},${DEPTH_Y(1340) - 3} ${sx + 58},${DEPTH_Y(1340) + 2} ${sx + 46},${DEPTH_Y(1340) + 2} ${sx + 42},${DEPTH_Y(1340) - 3}`} fill={LAVA} stroke={LAVA_GLOW} strokeWidth="0.6" />
      <text x={sx + 66} y={DEPTH_Y(1340) - 1} fill={LAVA_GLOW} fontSize="3.8">TAP · 1,340</text>
      {/* you are here */}
      <g>
        <rect x={x0 + 18} y={DEPTH_Y(band[0])} width={x1 - x0 - 22} height={DEPTH_Y(band[1]) - DEPTH_Y(band[0])} fill="none" stroke={C.accent} strokeWidth="0.6" strokeDasharray="2 2" opacity="0.8" />
        <path d={`M ${x1 - 1} ${DEPTH_Y(mark)} l -6 -4 l 0 8 Z`} fill={C.accent} />
        <path d={`M ${x0 + 8} 789 l 6 -3 l 0 6 Z`} fill={C.accent} />
        <text x={x0 + 18} y={791} fill={C.accent} fontSize="4.2" letterSpacing="0.1em">THIS LEVEL</text>
      </g>
      <text x={x0 + 8} y={801} fill={C.textDim} fontSize="3.8" letterSpacing="0.06em">LIFT CAGE · CABLE RUN</text>
      <text x={x0 + 8} y={809} fill={C.textDim} fontSize="3.8" letterSpacing="0.06em">MAINT. LADDER · 4 REST DECKS</text>
    </g>
  );
}

/* ═══ SURFACE ═══════════════════════════════════════════════════════════ */

const FISSURE_OPEN_N = [[862, 112], [852, 150], [842, 196]];
const FISSURE_SLAB = [[842, 196], [856, 270], [852, 350], [820, 410], [784, 450]];
const FISSURE_OPEN_S = [[784, 450], [736, 466], [692, 482], [664, 512], [656, 570], [663, 628], [650, 690], [660, 760], [648, 848]];

function surfaceGround(C) {
  const rng = seededRandom(2213);
  const ripples = [];
  for (let y = 108; y < 852; y += 11) {
    const ph = rng() * 6.28; let d = `M 222 ${y}`;
    for (let x = 236; x <= 896; x += 14) d += ` L ${x} ${(y + Math.sin(x / 30 + ph) * 2.2).toFixed(1)}`;
    ripples.push(<path key={y} d={d} fill="none" stroke={C.equipLine} strokeWidth="0.4" opacity="0.13" />);
  }
  const cinders = Array.from({ length: 420 }, () => [224 + rng() * 668, 100 + rng() * 754, 0.4 + rng() * 1.1]);
  const drifts = [[300, 520, 46, 10], [470, 600, 60, 12], [340, 700, 70, 14], [540, 760, 52, 10], [430, 812, 64, 10], [270, 790, 30, 8], [560, 520, 40, 8], [820, 470, 30, 6], [700, 160, 40, 7]];
  return (
    <g>
      <rect x="0" y="0" width={W} height={H} fill={CINDER} />
      {ripples}
      {drifts.map(([x, y, rx, ry], i) => <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill={ASH} opacity="0.85" transform={`rotate(-8,${x},${y})`} />)}
      {cinders.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={i % 7 === 0 ? LAVA_GLOW : C.hullOutline} opacity={i % 7 === 0 ? 0.25 : 0.14} />)}
    </g>
  );
}

function fissure(C) {
  const open = (pts, seed, w) => (
    <g>
      <path d={jag(pts, seed, 3.5)} fill="none" stroke={LAVA} strokeWidth={w + 6} strokeLinejoin="round" strokeLinecap="round" />
      <path d={jag(pts, seed, 3.5)} fill="none" stroke={LAVA_GLOW} strokeWidth={w} strokeLinejoin="round" opacity="0.55" />
      <path d={jag(pts, seed + 1, 2)} fill="none" stroke={LAVA_HOT} strokeWidth="0.8" opacity="0.8" />
    </g>
  );
  return (
    <g pointerEvents="none">
      {open(FISSURE_OPEN_N, 31, 3)}
      {open(FISSURE_OPEN_S, 37, 4)}
      {/* heat shimmer either side of the open crack */}
      {FISSURE_OPEN_S.slice(1, -1).map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="14" ry="22" fill={LAVA_GLOW} opacity="0.05" />)}
    </g>
  );
}

function ventField(C) {
  const vents = [[452, 140, 6], [520, 168, 4], [586, 132, 7], [652, 176, 4], [720, 138, 5], [790, 166, 4], [470, 182, 3], [628, 150, 3]];
  return (
    <g pointerEvents="none">
      {vents.map(([x, y, r], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx={r * 1.6} ry={r} fill={LAVA} stroke={C.hullOutline} strokeWidth="0.5" />
          <ellipse cx={x} cy={y} rx={r * 0.7} ry={r * 0.4} fill={LAVA_GLOW} opacity="0.6" />
          {[0, 1, 2].map((k) => <path key={k} d={`M ${x - 2 + k * 2} ${y - r - 1} q ${4 + k} -5 ${8 + k * 2} -3`} fill="none" stroke={C.textDim} strokeWidth="0.4" strokeDasharray="1.5 1.5" opacity="0.5" />)}
        </g>
      ))}
    </g>
  );
}

/* UD-4L dropship, plan view, nose north. */
function Dropship({ x, y, C }) {
  return (
    <g opacity="0.95">
      {/* wings and engine pods */}
      <path d={`M ${x - 9} ${y - 6} L ${x - 44} ${y + 16} L ${x - 44} ${y + 26} L ${x - 9} ${y + 18} Z`} fill={C.hullMid} stroke={C.hullOutline} strokeWidth="0.7" />
      <path d={`M ${x + 9} ${y - 6} L ${x + 44} ${y + 16} L ${x + 44} ${y + 26} L ${x + 9} ${y + 18} Z`} fill={C.hullMid} stroke={C.hullOutline} strokeWidth="0.7" />
      {[-1, 1].map((s) => <rect key={s} x={x + s * 30 - 6} y={y + 4} width={12} height={26} rx={4} fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.6" />)}
      {[-1, 1].map((s) => <circle key={`n${s}`} cx={x + s * 30} cy={y + 30} r={3.4} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.4" />)}
      {/* fuselage */}
      <path d={`M ${x} ${y - 52} C ${x + 8} ${y - 46} ${x + 11} ${y - 30} ${x + 11} ${y - 10} L ${x + 12} ${y + 40} L ${x - 12} ${y + 40} L ${x - 11} ${y - 10} C ${x - 11} ${y - 30} ${x - 8} ${y - 46} ${x} ${y - 52} Z`}
        fill={C.hull} stroke={C.hullOutline} strokeWidth="0.9" />
      <path d={`M ${x - 5} ${y - 40} L ${x + 5} ${y - 40} L ${x + 7} ${y - 30} L ${x - 7} ${y - 30} Z`} fill="#16252a" stroke={C.vent} strokeWidth="0.4" />
      <line x1={x} y1={y - 26} x2={x} y2={y + 36} stroke={C.hullDark} strokeWidth="0.6" />
      {/* tail fins */}
      <path d={`M ${x - 12} ${y + 34} L ${x - 24} ${y + 46} L ${x - 10} ${y + 44} Z M ${x + 12} ${y + 34} L ${x + 24} ${y + 46} L ${x + 10} ${y + 44} Z`} fill={C.hullMid} stroke={C.hullOutline} strokeWidth="0.6" />
      {/* rear ramp down */}
      <rect x={x - 8} y={y + 40} width={16} height={16} fill="none" stroke={C.door} strokeWidth="0.6" strokeDasharray="2 1.5" />
      {[44, 48, 52].map((d) => <line key={d} x1={x - 6} y1={y + d} x2={x + 6} y2={y + d} stroke={C.door} strokeWidth="0.4" opacity="0.6" />)}
    </g>
  );
}

function padOne(C) {
  const { x, y } = PAD, r = 60;
  const oct = Array.from({ length: 8 }, (_, i) => { const a = (Math.PI / 8) + (i * Math.PI) / 4; return `${(x + Math.cos(a) * r).toFixed(1)},${(y + Math.sin(a) * r).toFixed(1)}`; }).join(' ');
  const lights = Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; return [x + Math.cos(a) * (r - 6), y + Math.sin(a) * (r - 6)]; });
  return (
    <g pointerEvents="none">
      <polygon points={oct} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="1" />
      <circle cx={x} cy={y} r={r - 12} fill="none" stroke={C.door} strokeWidth="0.7" strokeDasharray="5 3" opacity="0.7" />
      {lights.map(([lx, ly], i) => <circle key={i} cx={lx} cy={ly} r="1.3" fill="none" stroke={C.accent} strokeWidth="0.4" opacity="0.6" />)}
      {/* ash drift half-burying the pad */}
      <ellipse cx={x - 34} cy={y + 34} rx={34} ry={20} fill={ASH} opacity="0.9" transform={`rotate(-35,${x - 34},${y + 34})`} />
      <ellipse cx={x - 44} cy={y + 8} rx={16} ry={9} fill={ASH} opacity="0.8" transform={`rotate(-60,${x - 44},${y + 8})`} />
      <Dropship x={x} y={y - 4} C={C} />
      {/* dead beacon */}
      <g transform={`translate(${x + 50},${y - 52})`}>
        <circle r="5" fill={C.bg} stroke={C.restricted} strokeWidth="0.6" />
        <path d="M -2.5 -2.5 L 2.5 2.5 M 2.5 -2.5 L -2.5 2.5" stroke={C.restricted} strokeWidth="0.7" />
      </g>
      <Tag x={x + 50} y={y - 61} color={C.restricted} size={3.6}>BEACON DEAD</Tag>
      <Tag x={x} y={y + r + 12} color={C.accent} size={4}>UD-4L “TIN HALO”</Tag>
    </g>
  );
}

function tractor(x, y, C, key) {
  return (
    <g key={key}>
      <rect x={x - 13} y={y - 20} width={6} height={40} rx="2" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.5" />
      <rect x={x + 7} y={y - 20} width={6} height={40} rx="2" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.5" />
      {Array.from({ length: 9 }, (_, i) => y - 17 + i * 4.3).map((cy) => <g key={cy}><line x1={x - 12} y1={cy} x2={x - 8} y2={cy} stroke={C.equipLine} strokeWidth="0.4" /><line x1={x + 8} y1={cy} x2={x + 12} y2={cy} stroke={C.equipLine} strokeWidth="0.4" /></g>)}
      <rect x={x - 7} y={y - 16} width={14} height={30} rx="1.5" fill={C.hullMid} stroke={C.hullOutline} strokeWidth="0.6" />
      <rect x={x - 5} y={y - 14} width={10} height={8} fill="#16252a" stroke={C.vent} strokeWidth="0.4" />
      <rect x={x - 9} y={y + 16} width={18} height={4} fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.4" />
    </g>
  );
}

function SurfaceDecor() {
  const C = useMapTheme();
  const line = { fill: 'none', stroke: C.equipLine, strokeWidth: 0.6, opacity: 0.6 };
  return (
    <g>
      {/* OPS / HEARTH: the HEARTH core, monitor wall, lift-control desk */}
      <circle cx={424} cy={218} r={11} fill="url(#me_hatch)" stroke={C.accent} strokeWidth="0.7" opacity="0.85" />
      <circle cx={424} cy={218} r={4} fill={C.accent} opacity="0.35" />
      <Tag x={424} y={236} color={C.accent} size={3.6}>HEARTH</Tag>
      {[446, 466, 486, 506, 526].map((x) => <rect key={x} x={x} y={201} width={16} height={6} fill="#16252a" stroke={C.vent} strokeWidth="0.4" opacity="0.8" />)}
      <path d="M 450 222 Q 490 212 534 222" {...line} />
      <Tag x={490} y={216} size={3}>CAMERA FEEDS</Tag>
      <Table x={512} y={278} w={44} h={10} />
      <Tag x={534} y={275} size={3}>LIFT CONTROL</Tag>
      {/* HAB: bunks, lockers, the crayon volcano */}
      {[584, 612, 640, 690, 718].map((x) => <rect key={x} x={x} y={202} width={22} height={10} fill="none" stroke={C.accent} strokeWidth="0.45" opacity="0.5" rx="0.8" />)}
      {[584, 612, 640, 690].map((x) => <rect key={`s${x}`} x={x} y={284} width={22} height={10} fill="none" stroke={C.accent} strokeWidth="0.45" opacity="0.5" rx="0.8" />)}
      {Array.from({ length: 8 }, (_, i) => 222 + i * 8).map((y, i) => <rect key={y} x={746} y={y} width={9} height={7} fill={i === 5 ? C.accent : 'none'} fillOpacity="0.25" stroke={i === 5 ? C.accent : C.equipLine} strokeWidth="0.45" opacity="0.8" />)}
      <Tag x={742} y={267} anchor="end" color={C.accent} size={3.2}>LOCKER 14</Tag>
      <path d="M 694 214 l 6 -8 l 6 8 Z" fill="none" stroke={C.restricted} strokeWidth="0.5" opacity="0.7" />
      {/* MOTOR POOL: crawler tractors, jacks, the breach line under the slab */}
      {tractor(784, 232, C, 'a')}
      {tractor(852, 404, C, 'b')}
      {[[784, 400], [800, 418]].map(([x, y]) => <g key={x}><rect x={x - 4} y={y - 4} width={8} height={8} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.7" /><line x1={x - 4} y1={y - 4} x2={x + 4} y2={y + 4} stroke={C.equipLine} strokeWidth="0.4" /></g>)}
      <Tag x={792} y={436} size={3}>JACKS</Tag>
      <path d={jag(FISSURE_SLAB, 41, 2.5)} fill="none" stroke={LAVA_GLOW} strokeWidth="0.9" strokeDasharray="3 2" opacity="0.75" />
      <Tag x={846} y={298} color={LAVA_GLOW} size={3.2} rotate={80}>FISSURE UNDER SLAB</Tag>
      <Tag x={818} y={372} color={C.restricted} size={3.4}>BREACH</Tag>
      {/* LIFT HOUSING: derrick over the head of the Throat, cable drums, hatch */}
      <rect x={414} y={334} width={48} height={80} fill="none" stroke={C.equipLine} strokeWidth="0.7" opacity="0.6" />
      <path d="M 414 334 L 462 414 M 462 334 L 414 414" stroke={C.equipLine} strokeWidth="0.5" opacity="0.4" />
      <Tag x={432} y={331} size={3}>DERRICK</Tag>
      {[[566, 360], [566, 420]].map(([x, y]) => <g key={y}><circle cx={x} cy={y} r={10} fill="none" stroke={C.equipLine} strokeWidth="0.6" opacity="0.6" /><circle cx={x} cy={y} r={3} fill={C.equipLine} opacity="0.4" /></g>)}
      <Tag x={566} y={438} size={3}>CABLE DRUMS</Tag>
      {/* MED / CHARGE: bed, cooler, the dead facehugger; Custodian alcoves */}
      <rect x={602} y={332} width={30} height={13} rx="1.5" fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.6" />
      <rect x={602} y={422} width={22} height={18} fill="none" stroke={C.vent} strokeWidth="0.5" opacity="0.7" />
      <Tag x={613} y={418} color={C.vent} size={3}>COOLER</Tag>
      <path d="M 640 432 q 4 -6 8 0 q 4 -6 8 0 M 644 432 l -3 5 M 652 432 l 3 5 M 648 432 l 0 6" fill="none" stroke={C.restricted} strokeWidth="0.6" opacity="0.8" />
      <Tag x={648} y={446} color={C.restricted} size={3}>DEAD HUGGER</Tag>
      <line x1={718} y1={328} x2={718} y2={446} stroke={C.wall} strokeWidth="2.5" />
      {Array.from({ length: 5 }, (_, i) => 336 + i * 21).map((y) => (
        <g key={y}><rect x={728} y={y} width={24} height={15} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.7" /><circle cx={740} cy={y + 7.5} r="2.6" fill="none" stroke={C.textBright} strokeWidth="0.5" opacity="0.6" /></g>
      ))}
      <Tag x={740} y={332} size={3}>ALCOVES</Tag>
      {/* Custodians standing in the walkway */}
      {[[548, 310], [622, 310], [702, 310]].map(([x, y], i) => <g key={i} transform={`translate(${x},${y})`}><circle r="3.6" fill={C.bg} stroke={C.textBright} strokeWidth="0.5" opacity="0.8" /><circle r="1" fill={C.textBright} opacity="0.8" /></g>)}
    </g>
  );
}

function SurfaceGround() {
  const C = useMapTheme();
  const rng = seededRandom(77);
  const stakes = Array.from({ length: 7 }, () => [270 + rng() * 330, 480 + rng() * 330]);
  return (
    <g>
      {surfaceGround(C)}
      {ventField(C)}
      {fissure(C)}
      {/* dish feed cable, buried, from the lift housing out to the dish */}
      <path d="M 500 450 L 500 540 L 640 560 L 700 640 L 742 690" fill="none" stroke={C.vent} strokeWidth="1.2" strokeDasharray="3 4" opacity="0.45" />
      <Tag x={566} y={545} color={C.vent} size={3.4} rotate={8}>DISH FEED CABLE · BURIED</Tag>
      {/* crawler tracks from the Motor Pool doors to the dish gate */}
      {[-7, 7].map((o) => <path key={o} d={`M ${829 + o} 452 C ${826 + o} 510 ${790 + o} 540 ${776 + o} 598`} fill="none" stroke={C.hullDark} strokeWidth="5" strokeDasharray="2 2" opacity="0.9" />)}
      {/* Comms dish compound: fence, dish, topple arc */}
      <rect x={684} y={600} width={184} height={212} fill="none" stroke={C.equipLine} strokeWidth="0.7" strokeDasharray="6 3" opacity="0.7" />
      {Array.from({ length: 10 }, (_, i) => 684 + i * 20.4).map((x) => <g key={x}><circle cx={x} cy={600} r="0.9" fill={C.equipLine} /><circle cx={x} cy={812} r="0.9" fill={C.equipLine} /></g>)}
      <circle cx={776} cy={706} r={60} fill="none" stroke={C.restricted} strokeWidth="0.6" strokeDasharray="2 3" opacity="0.5" />
      <rect x={760} y={690} width={32} height={32} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.6" />
      <circle cx={776} cy={706} r={46} fill={C.hullDark} stroke={C.hullOutline} strokeWidth="1" opacity="0.95" />
      {[34, 22, 10].map((r) => <circle key={r} cx={776} cy={706} r={r} fill="none" stroke={C.hullOutline} strokeWidth="0.45" opacity="0.55" />)}
      {Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6).map((a) => <line key={a} x1={776 + Math.cos(a) * 10} y1={706 + Math.sin(a) * 10} x2={776 + Math.cos(a) * 46} y2={706 + Math.sin(a) * 46} stroke={C.hullOutline} strokeWidth="0.4" opacity="0.45" />)}
      {[0, 2.09, 4.19].map((a) => <line key={a} x1={776 + Math.cos(a) * 30} y1={706 + Math.sin(a) * 30} x2={776} y2={706} stroke={C.accent} strokeWidth="0.6" opacity="0.7" />)}
      <circle cx={776} cy={706} r={3} fill={C.accent} opacity="0.7" />
      <Tag x={846} y={772} color={C.restricted} size={3.4} anchor="end">TOPPLE ARC</Tag>
      {/* ash plain dressing */}
      {[[300, 610, 7], [560, 690, 9], [610, 800, 6], [380, 520, 5], [256, 700, 6], [470, 780, 5]].map(([x, y, r], i) => <Boulder key={i} x={x} y={y} r={r} C={C} />)}
      {stakes.map(([x, y], i) => <g key={i}><line x1={x} y1={y - 4} x2={x} y2={y + 4} stroke={C.accent} strokeWidth="0.6" opacity="0.5" /><circle cx={x} cy={y - 4} r="1.2" fill={C.accent} opacity="0.5" /></g>)}
      <path d={`M ${PAD.x} 352 C 320 380 328 400 330 420`} fill="none" stroke={C.door} strokeWidth="0.7" strokeDasharray="1 3" opacity="0.7" />
      {/* weather mast, seismic array and an abandoned ore sled on the plain */}
      <g transform="translate(586,724)"><circle r="4" fill="none" stroke={C.equipLine} strokeWidth="0.6" /><path d="M -12 -6 L 0 0 L 12 -6 M 0 0 L 0 12" stroke={C.equipLine} strokeWidth="0.4" opacity="0.6" /></g>
      <Tag x={586} y={744} size={3.2}>WEATHER MAST</Tag>
      {Array.from({ length: 6 }, (_, i) => [276 + i * 26, 760 - i * 6]).map(([x, y], i) => <rect key={i} x={x - 2.5} y={y - 2.5} width={5} height={5} fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.55" />)}
      <path d="M 276 760 L 406 730" fill="none" stroke={C.accent} strokeWidth="0.4" strokeDasharray="1 2" opacity="0.5" />
      <Tag x={340} y={776} size={3.2}>SEISMIC ARRAY</Tag>
      <g transform="rotate(24,300,580)"><rect x={282} y={570} width={36} height={18} rx="1.5" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.5" /><line x1={318} y1={579} x2={328} y2={579} stroke={C.equipLine} strokeWidth="0.6" /></g>
      <Tag x={300} y={608} size={3.2}>ORE SLED · ASHED IN</Tag>
      {/* zone labels */}
      <ZoneLabel x={319} y={440} label="PAD ONE" sub="LZ · ASH-BURIED" size={7.5} />
      <ZoneLabel x={640} y={128} label="VENT FIELD" sub="FUMAROLES · RIDGE CREST" size={6.5} />
      <ZoneLabel x={420} y={660} label="ASH PLAIN" sub="CINDER FLATS · NO COVER" size={8} />
      <ZoneLabel x={830} y={540} label="CRAWLER TRACK" size={5} rotate={-90} />
      <ZoneLabel x={776} y={786} label="COMMS DISH" sub="SECTOR UPLINK · HEARTH-LOCKED" size={7} />
      <ZoneLabel x={648} y={604} label="FISSURE" size={5} rotate={-84} color={LAVA_GLOW} />
      <Tag x={440} y={836} size={4.2}>▼ CALDERA RIM · 2 KM</Tag>
      <Tag x={252} y={118} anchor="start" size={4}>▲ RIDGE CREST</Tag>
    </g>
  );
}

const Surface = () => (
  <g>
    <SurfaceGround />
    {padOne(useMapTheme())}
    <LevelPlan rooms={ridgebackRooms} doors={ridgebackDoors} stairs={stairsFor('surface')} level="surface" decorate={() => <SurfaceDecor />} />
  </g>
);

/* ═══ LIFT LANDING ═════════════════════════════════════════════════════ */

function Egg({ x, y, open, C }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx="9" ry="9" fill={VIOLET} opacity="0.12" />
      <rect x={x - 7} y={y - 7} width="14" height="14" rx="2" fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.7" />
      <path d={`M ${x} ${y - 5} C ${x + 4.5} ${y - 3} ${x + 4} ${y + 4.5} ${x} ${y + 4.5} C ${x - 4} ${y + 4.5} ${x - 4.5} ${y - 3} ${x} ${y - 5} Z`} fill={C.hullDeep} stroke={open ? C.restricted : C.textDim} strokeWidth="0.6" />
      {open && <path d={`M ${x - 2.5} ${y - 3} L ${x} ${y - 0.5} L ${x + 2.5} ${y - 3}`} fill="none" stroke={C.restricted} strokeWidth="0.6" />}
    </g>
  );
}

function resin(C, d, key) {
  return (
    <g key={key}>
      <path d={d} fill="none" stroke="#060908" strokeWidth="2.6" strokeLinecap="round" opacity="0.85" />
      <path d={d} fill="none" stroke={C.textDim} strokeWidth="0.4" strokeLinecap="round" strokeDasharray="3 2" opacity="0.6" />
    </g>
  );
}

function LandingDecor() {
  const C = useMapTheme();
  const line = { fill: 'none', stroke: C.equipLine, strokeWidth: 0.6, opacity: 0.6 };
  return (
    <g>
      {/* THE THROAT: cage guide rails, cable run, rest-deck grating */}
      <rect x={418} y={338} width={28} height={28} fill="none" stroke={C.shaft} strokeWidth="0.5" strokeDasharray="1.5 1.5" opacity="0.7" />
      {[[516, 228], [526, 234], [536, 242]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="3" fill={C.hullDeep} stroke={C.equipLine} strokeWidth="0.5" />)}
      <Tag x={526} y={252} size={3}>CABLE RUN</Tag>
      <Tag x={500} y={258} size={3.2}>▲ 1,200 M TO SURFACE</Tag>
      {/* LIFT LANDING: resin on the doors, grease-pencil arrow */}
      {resin(C, 'M 563 312 q 6 6 2 14 q -4 8 3 16', 'r1')}
      {resin(C, 'M 707 310 q -6 8 -2 16 q 4 8 -3 18', 'r2')}
      {resin(C, 'M 616 427 q 8 -6 18 -2 q 10 4 20 -2', 'r3')}
      <path d="M 600 400 L 600 414 L 596 410 M 600 414 L 604 410" fill="none" stroke={C.accent} strokeWidth="0.9" opacity="0.8" />
      <Tag x={600} y={396} color={C.accent} size={3.6}>COLD</Tag>
      <Table x={664} y={200} w={36} h={10} />
      <Tag x={682} y={218} size={3}>LIFT CALL</Tag>
      {[[574, 360], [574, 380], [592, 370]].map(([x, y], i) => <rect key={i} x={x} y={y} width={16} height={16} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.6" />)}
      <Tag x={590} y={404} size={3}>SURVEY CRATES</Tag>
      <rect x={690} y={350} width={10} height={40} fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.5" />
      <Tag x={686} y={346} anchor="end" size={3}>RESPIRATORS</Tag>
      {/* CORE VAULT: gel cradle and core, workstation */}
      <rect x={768} y={366} width={50} height={28} rx="3" fill="#123540" stroke={C.vent} strokeWidth="0.7" opacity="0.9" />
      <rect x={783} y={373} width={20} height={14} fill={C.bg} stroke={C.textBright} strokeWidth="0.6" />
      <Tag x={793} y={403} color={C.vent} size={3.2}>DATA CORE · GEL</Tag>
      <Table x={724} y={244} w={40} h={12} />
      <Tag x={744} y={264} size={3}>WORKSTATION</Tag>
      {/* COLD ROOM: sample racks, frost, survivors' bedding */}
      {[470, 486, 502, 518, 534, 550].map((y) => <line key={y} x1={406} y1={y} x2={446} y2={y} stroke={C.equipLine} strokeWidth="1.4" opacity="0.35" />)}
      <Tag x={426} y={566} size={3}>SAMPLE RACKS</Tag>
      {[[470, 668], [512, 676], [556, 666]].map(([x, y], i) => <rect key={i} x={x - 14} y={y - 6} width={28} height={12} rx="2" fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.55" transform={`rotate(${(i - 1) * 8},${x},${y})`} />)}
      <Tag x={512} y={692} color={C.accent} size={3.2}>SENN · MARSH · FERRO</Tag>
      {[[470, 462], [520, 466], [576, 470], [588, 500], [410, 640]].map(([x, y], i) => <path key={i} d={`M ${x - 3} ${y} L ${x + 3} ${y} M ${x} ${y - 3} L ${x} ${y + 3} M ${x - 2} ${y - 2} L ${x + 2} ${y + 2} M ${x + 2} ${y - 2} L ${x - 2} ${y + 2}`} stroke={C.vent} strokeWidth="0.4" opacity="0.7" />)}
      {/* CHILLER PLANT */}
      <Machine x={612} y={468} w={66} h={30} />
      <Machine x={612} y={640} w={66} h={30} label="COMPRESSORS" />
      {[[630, 520], [660, 520]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={7} {...line} />)}
      {/* SPECIMEN LAB: six eggs in heat incubators, stasis canister */}
      <rect x={700} y={474} width={112} height={44} fill={VIOLET} opacity="0.06" />
      <rect x={700} y={634} width={112} height={44} fill={VIOLET} opacity="0.06" />
      {[[716, 496, true], [752, 496, true], [788, 496, false], [716, 656, false], [752, 656, false], [788, 656, false]].map(([x, y, o], i) => <Egg key={i} x={x} y={y} open={o} C={C} />)}
      <Tag x={752} y={471} color={VIOLET} size={3.2}>HEAT INCUBATORS</Tag>
      <rect x={830} y={640} width={14} height={30} rx="6" fill="none" stroke={C.vent} strokeWidth="0.7" opacity="0.8" />
      <Tag x={837} y={680} color={C.vent} size={3}>STASIS</Tag>
      {/* rock dressing */}
      <Tag x={640} y={150} size={4.2}>▲ BASALT · 1,200 M OF IT</Tag>
      <Tag x={640} y={772} size={4.2}>SOLID BASALT · THERMAL SEAMS</Tag>
      <Tag x={852} y={488} color={C.restricted} size={3}>RESIN ▼</Tag>
    </g>
  );
}

function landingGround(C) {
  return (
    <g>
      <rect x="0" y="0" width={W} height={H} fill={ROCK} />
      {strata(C, 1200, false)}
      {/* excavation outline around the cut rooms */}
      <rect x={388} y={182} width={496} height={526} fill="none" stroke={C.hullOutline} strokeWidth="0.6" strokeDasharray="4 3" opacity="0.35" />
      {[[420, 740, 520, 760, 600, 748], [700, 130, 780, 150, 860, 140], [460, 812, 600, 800, 720, 816]].map(([a, b, c, d, e, f], i) => (
        <path key={i} d={jag([[a, b], [c, d], [e, f]], 50 + i, 2.5)} fill="none" stroke={LAVA_GLOW} strokeWidth="0.7" opacity="0.35" />
      ))}
    </g>
  );
}

const Landing = () => {
  const C = useMapTheme();
  return (
    <g>
      {landingGround(C)}
      <ShaftSection here="landing" />
      <LevelPlan rooms={ridgebackRooms} doors={ridgebackDoors} stairs={stairsFor('landing')} level="landing" decorate={() => <LandingDecor />} />
    </g>
  );
};

/* ═══ DEEP LEVEL ═══════════════════════════════════════════════════════ */

const TUBE = [[432, 392], [470, 372], [520, 318], [590, 270], [670, 254], [750, 270], [808, 318], [846, 386], [852, 470]];
const SPUR = [[446, 400], [462, 440], [471, 482]];
const SIDE_VENTS = [[[560, 290], [548, 220], [556, 206]], [[722, 262], [740, 214], [770, 204]], [[830, 350], [868, 320]], [[620, 262], [640, 330], [660, 350]]];

function lavaTube(C) {
  const d = smooth(TUBE), sp = smooth(SPUR);
  return (
    <g pointerEvents="none">
      {/* glow halo in the surrounding rock */}
      <path d={d} fill="none" stroke={LAVA_GLOW} strokeWidth="78" strokeLinecap="round" strokeLinejoin="round" opacity="0.06" />
      <path d={d} fill="none" stroke={LAVA_GLOW} strokeWidth="62" strokeLinecap="round" strokeLinejoin="round" opacity="0.08" />
      {SIDE_VENTS.map((v, i) => <path key={i} d={smooth(v)} fill="none" stroke={C.hullOutline} strokeWidth="12" strokeLinecap="round" opacity="0.8" />)}
      {SIDE_VENTS.map((v, i) => <path key={`f${i}`} d={smooth(v)} fill="none" stroke={LAVA} strokeWidth="9" strokeLinecap="round" />)}
      {/* tube wall and floor */}
      <path d={d} fill="none" stroke={C.hullOutline} strokeWidth="50" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <path d={sp} fill="none" stroke={C.hullOutline} strokeWidth="32" strokeLinecap="round" opacity="0.9" />
      <path d={d} fill="none" stroke={LAVA} strokeWidth="46" strokeLinecap="round" strokeLinejoin="round" />
      <path d={sp} fill="none" stroke={LAVA} strokeWidth="28" strokeLinecap="round" />
      {/* the shaft sump at the foot of the Throat */}
      <circle cx={(LIFT.x + LADDER.x) / 2} cy={(LIFT.y + LADDER.y) / 2} r={44} fill={C.hullOutline} opacity="0.9" />
      <circle cx={(LIFT.x + LADDER.x) / 2} cy={(LIFT.y + LADDER.y) / 2} r={41} fill={LAVA} />
      <circle cx={(LIFT.x + LADDER.x) / 2} cy={(LIFT.y + LADDER.y) / 2} r={41} fill="url(#me_grating)" />
      {/* ropy floor and glowing seams */}
      {[-12, 0, 12].map((o) => <path key={o} d={d} fill="none" stroke={LAVA_GLOW} strokeWidth="0.6" strokeDasharray={o ? '10 14' : '22 8 4 8'} opacity="0.5" transform={`translate(0,${o})`} />)}
      <path d={d} fill="none" stroke={LAVA_HOT} strokeWidth="1.2" strokeDasharray="2 30" opacity="0.8" />
      {SIDE_VENTS.map((v, i) => { const [x, y] = v[v.length - 1]; return <circle key={i} cx={x} cy={y} r="4" fill={C.bg} stroke={LAVA_GLOW} strokeWidth="0.6" opacity="0.8" />; })}
    </g>
  );
}

function DeepDecor() {
  const C = useMapTheme();
  return (
    <g>
      {/* HEAT EXCHANGER HALL: exchanger banks, warm conduits, eggs, cocoons */}
      {[[418, 500], [512, 500], [606, 500]].map(([x, y]) => <Machine key={x} x={x} y={y} w={74} h={34} />)}
      {[[418, 752], [512, 752], [606, 752]].map(([x, y]) => <Machine key={x} x={x} y={y} w={74} h={34} />)}
      <Tag x={546} y={796} size={3.2}>HEAT EXCHANGER BANKS</Tag>
      {[566, 736].map((y) => <g key={y}><line x1={410} y1={y} x2={684} y2={y} stroke={LAVA_GLOW} strokeWidth="2" opacity="0.35" /><line x1={410} y1={y} x2={684} y2={y} stroke={LAVA_HOT} strokeWidth="0.5" opacity="0.6" strokeDasharray="6 4" /></g>)}
      {Array.from({ length: 9 }, (_, i) => 432 + i * 30).map((x) => <Egg key={`a${x}`} x={x} y={588} C={C} open={x === 492 || x === 612} />)}
      {Array.from({ length: 9 }, (_, i) => 432 + i * 30).map((x) => <Egg key={`b${x}`} x={x} y={714} C={C} open={x === 552} />)}
      {/* resin over the walls and gantries */}
      {['M 402 500 q 10 40 0 80 q -6 40 4 80 q 8 50 -2 120', 'M 690 492 q -10 30 0 60 q 8 30 -2 54', 'M 690 690 q -8 40 2 70 q 6 20 -4 40', 'M 420 486 q 60 10 120 0 q 60 -10 130 4'].map((d, i) => resin(C, d, i))}
      {/* cocooned staff in the west wall */}
      {[612, 640, 668, 696].map((y, i) => <ellipse key={y} cx={410} cy={y} rx="4.5" ry="10" fill="#0a0d0c" stroke={i === 2 ? C.accent : C.textDim} strokeWidth="0.6" opacity="0.9" />)}
      <Tag x={420} y={671} anchor="start" color={C.accent} size={3.2}>INES TARROW</Tag>
      {/* REACTOR TAP: the heart, relief valves, purge vents */}
      <circle cx={786} cy={590} r={34} fill={LAVA_GLOW} opacity="0.12" />
      <circle cx={786} cy={590} r={26} fill={LAVA} stroke={LAVA_GLOW} strokeWidth="1" />
      <circle cx={786} cy={590} r={14} fill="none" stroke={LAVA_HOT} strokeWidth="0.7" opacity="0.8" />
      <circle cx={786} cy={590} r={5} fill={LAVA_HOT} opacity="0.7" />
      <Tag x={786} y={566} color={LAVA_HOT} size={3.2}>TAP WELL</Tag>
      <g transform="translate(770,530)" opacity="0.85"><path d="M 0 -4 L 4 3 L -4 3 Z" fill="none" stroke={C.restricted} strokeWidth="0.7" /><line x1="0" y1="-1.5" x2="0" y2="1" stroke={C.restricted} strokeWidth="0.6" /></g>
      <g transform="translate(786,529)" opacity="0.85"><circle r="3.6" fill="none" stroke={C.restricted} strokeWidth="0.7" /><line x1="-2" y1="2" x2="2" y2="-2" stroke={C.restricted} strokeWidth="0.6" /></g>
      <g transform="translate(802,529)" opacity="0.85"><circle r="3.6" fill="none" stroke={LAVA_GLOW} strokeWidth="0.6" /><path d="M 0 -3.6 L 0 0 L 3.1 1.8 M 0 0 L -3.1 1.8" fill="none" stroke={LAVA_GLOW} strokeWidth="0.6" /></g>
      {[744, 786, 828].map((x) => (
        <g key={x}>
          <circle cx={x} cy={722} r={7} fill="none" stroke={C.door} strokeWidth="0.7" />
          <path d={`M ${x - 5} ${722} L ${x + 5} ${722} M ${x} ${717} L ${x} ${727}`} stroke={C.door} strokeWidth="0.6" />
          <line x1={x} y1={616} x2={x} y2={715} stroke={LAVA_GLOW} strokeWidth="1.2" opacity="0.35" />
        </g>
      ))}
      <Tag x={786} y={740} color={C.door} size={3.4}>MANUAL RELIEF VALVES</Tag>
      <Tag x={786} y={776} color={C.restricted} size={3.2}>PURGE VENTS · 60 °C+</Tag>
      {/* heat feed from the tap into the hall */}
      {[600, 700].map((y) => <line key={y} x1={696} y1={y} x2={760} y2={y} stroke={LAVA_GLOW} strokeWidth="1.6" opacity="0.3" />)}
      {/* tube labels */}
      <ZoneLabel x={668} y={258} label="LAVA TUBE 7" size={7} color={LAVA_HOT} />
      <Tag x={668} y={270} color={C.text} size={3.6}>400 M · GLOWING SEAMS</Tag>
      <Tag x={548} y={200} color={LAVA_GLOW} size={3.4}>SIDE VENT</Tag>
      <Tag x={770} y={196} color={LAVA_GLOW} size={3.4}>SIDE VENT</Tag>
      <Tag x={500} y={448} color={C.text} size={3.4} anchor="start">TO THE NEST ▼</Tag>
      <Tag x={432} y={326} size={3.4}>SHAFT SUMP</Tag>
      <Tag x={640} y={150} size={4.2}>▲ LIFT LANDING · 60 M ABOVE</Tag>
    </g>
  );
}

function deepGround(C) {
  return (
    <g>
      <rect x="0" y="0" width={W} height={H} fill={ROCK_HOT} />
      {strata(C, 1340, true)}
    </g>
  );
}

const DEEP_VENTS = ['M 660 350 L 660 420 L 640 440 L 640 486', 'M 868 320 L 870 420 L 860 440 L 860 516'];
const Deep = () => {
  const C = useMapTheme();
  return (
    <g>
      {deepGround(C)}
      <ShaftSection here="deep" />
      {lavaTube(C)}
      <LevelPlan rooms={ridgebackRooms} doors={ridgebackDoors} stairs={stairsFor('deep')} level="deep"
        conduits={DEEP_VENTS} grates={[[640, 486], [860, 516]]} decorate={() => <DeepDecor />} />
    </g>
  );
};

/* ─── Chrome ─────────────────────────────────────────────────────────── */

function outlineStroke(C) {
  return <path d={OUTLINE} fill="none" stroke={C.hullOutline} strokeWidth="2.4" opacity="0.9" />;
}

const T = { lava: LAVA, glow: LAVA_GLOW };
export const ridgebackConfig = {
  width: W,
  height: H,
  stars: { count: 0, seed: 1979 },
  backdrop: 'none',
  levelNoun: 'LEVEL',
  scenarioTag: 'RIDGEBACK STATION',
  hull: { path: OUTLINE },
  fixedOverlays: outlineStroke,
  sidebar: alienSidebar({ title: 'RIDGEBACK STATION', subtitle: 'SEEGSON DEEP THERMAL SURVEY OUTPOST — LV-2213 “CINDER”', tag: 'S E E G S O N', compass: 'N', scale: 'SCHEMATIC · NOT TO SCALE' }),
  decks: [
    { id: 'S', level: 'surface', name: 'SURFACE', page: 'I', component: Surface },
    { id: 'L', level: 'landing', name: 'LIFT LANDING', page: 'II', component: Landing },
    { id: 'D', level: 'deep', name: 'DEEP LEVEL', page: 'III', component: Deep },
  ],
  specs: {
    title: 'SURVEY DATA',
    y: 822,
    items: [
      ['TAP DEPTH', '1,340 m below Pad One'],
      ['THROAT', '1,200 m · 4 rest decks'],
      ['SURFACE', '54 °C · ash storms · venting'],
      ['CREW', '31 Seegson · 9 Custodians'],
      ['CONTRACT', 'Seegson thermal survey'],
    ],
  },
  legend: alienLegend([
    { label: 'LAVA / HEAT', draw: (y) => <><rect x="0" y={y - 5} width="10" height="8" fill={T.lava} stroke={T.glow} strokeWidth="0.6" /><line x1="1" y1={y - 1} x2="9" y2={y - 1} stroke={T.glow} strokeWidth="0.5" strokeDasharray="2 1.5" /></> },
    { label: 'LIFT SHAFT (ALL LEVELS)', draw: (y) => <><rect x="0" y={y - 6} width="10" height="10" fill="#103830" stroke="#50b898" strokeWidth="0.8" rx="1" /><line x1="2" y1={y - 4} x2="8" y2={y + 2} stroke="#50b898" strokeWidth="0.4" /><line x1="8" y1={y - 4} x2="2" y2={y + 2} stroke="#50b898" strokeWidth="0.4" /><path d={`M 12 ${y - 3} l 2 -3 l 2 3 M 12 ${y + 1} l 2 3 l 2 -3`} fill="none" stroke="#50b898" strokeWidth="0.5" /></> },
    { label: 'FISSURE', draw: (y) => <path d={`M 0 ${y - 4} L 3 ${y} L 5 ${y - 3} L 8 ${y + 2} L 12 ${y - 1}`} fill="none" stroke={T.glow} strokeWidth="1.4" strokeLinejoin="round" /> },
  ]),
};

/** Interactive plan, registered as universe.maps[ridgeback-station].engine */
export function RidgebackMap() {
  return <MapEngine config={ridgebackConfig} />;
}
RidgebackMap.config = ridgebackConfig;
