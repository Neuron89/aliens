import React from 'react';
import MapEngine, { useMapTheme, registerIcon, Room, purl } from '../../../engine/components/MapEngine';
import { LevelPlan, alienLegend, alienSidebar, Table, Dots, Machine } from './alienMapKit.jsx';
import {
  W, H, OUTLINE, OUTLINE_PTS, HULL, RING, LOBBY, HATCH_NW, HATCH_SE,
  prometheusRooms, prometheusDoors, STAIRS, FEED_PATHS,
} from './prometheus.geometry.js';

/* ═══════════════════════════════════════════════════════════════════════
   STATION PROMETHEUS — MapEngine plan (four levels plus the reactor core).
   Rooms/doors/lift/hatches come from prometheus.geometry.js, which also
   feeds the normalized board rooms in maps/index.js. Every level shares
   the hexagonal hull, the ring corridor and the central lift lobby, so
   the stack reads as one structure; the decoration makes each level its
   own place.
   ═══════════════════════════════════════════════════════════════════════ */

const RESIN = '#5a2a22', RESIN_HI = '#8a3a2c';

registerIcon('prometheus-architect', (x, y, C) => (
  <g opacity="0.8" fill="none" stroke={C.restricted} strokeWidth="0.6">
    <circle cx={x} cy={y} r="3.8" strokeDasharray="1.2 1" /><circle cx={x} cy={y} r="1.4" />
    {[0, 72, 144, 216, 288].map((a) => { const r = (a * Math.PI) / 180; return <line key={a} x1={x + Math.cos(r) * 1.6} y1={y + Math.sin(r) * 1.6} x2={x + Math.cos(r) * 3.6} y2={y + Math.sin(r) * 3.6} />; })}
  </g>
));

/* ─── Small drawing helpers ──────────────────────────────────────────── */

const stairsFor = (level) => STAIRS
  .filter((s) => s.levels.includes(level))
  .map((s) => ({ ...s, level, label: s.type === 'elevator' ? (s.labels?.[level] || s.label) : '' }));

function Tiny({ x, y, children, color, anchor = 'middle', size = 3.6, rotate, opacity = 1 }) {
  const C = useMapTheme();
  return (
    <text x={x} y={y} fill={color || C.textDim} fontSize={size} textAnchor={anchor} letterSpacing="0.08em" opacity={opacity}
      transform={rotate ? `rotate(${rotate},${x},${y})` : undefined}>{children}</text>
  );
}

function Box({ x, y, w, h, color, dashed, fill = 'none', opacity = 0.55, sw = 0.5, rx = 0.6 }) {
  const C = useMapTheme();
  return <rect x={x} y={y} width={w} height={h} fill={fill} stroke={color || C.equipLine} strokeWidth={sw}
    strokeDasharray={dashed ? '2 1.5' : undefined} opacity={opacity} rx={rx} />;
}

/* Frantic writing on the corridor panels. */
function Scrawl({ x, y, children, rotate = -3, size = 4.2, anchor = 'middle' }) {
  const C = useMapTheme();
  return (
    <text x={x} y={y} fill={C.restricted} fontSize={size} textAnchor={anchor} letterSpacing="0.04em" opacity="0.72"
      fontStyle="italic" transform={`rotate(${rotate},${x},${y})`}>{children}</text>
  );
}

/* Yellow-black welded blast door bar (horizontal). */
function WeldBar({ x, y, w = 30 }) {
  const C = useMapTheme();
  const stripes = [];
  for (let i = 0; i < w; i += 4) stripes.push(<line key={i} x1={x + i} y1={y + 3} x2={x + i + 3} y2={y - 3} stroke="#c8a030" strokeWidth="1" opacity="0.7" />);
  return (
    <g>
      <rect x={x} y={y - 3} width={w} height={6} fill="#1a1408" stroke={C.restricted} strokeWidth="0.7" />
      {stripes}
      {[0.2, 0.5, 0.8].map((t) => <path key={t} d={`M ${x + w * t - 2} ${y - 4} l 2 8 l 2 -8`} fill="none" stroke={C.restricted} strokeWidth="0.5" />)}
    </g>
  );
}

function HazardSign({ x, y, s = 7 }) {
  const C = useMapTheme();
  return (
    <g opacity="0.8">
      <path d={`M ${x} ${y - s} L ${x + s} ${y + s * 0.75} L ${x - s} ${y + s * 0.75} Z`} fill="#1a1408" stroke="#c8a030" strokeWidth="0.7" />
      <line x1={x} y1={y - s * 0.4} x2={x} y2={y + s * 0.25} stroke={C.restricted} strokeWidth="0.9" />
      <circle cx={x} cy={y + s * 0.5} r="0.7" fill={C.restricted} />
    </g>
  );
}

/* The lift lobby (a board zone the plan draws itself): no centred label. */
function Lobby({ title, color, machinery = true }) {
  const C = useMapTheme();
  const { x, y, w, h } = LOBBY;
  return (
    <g>
      <Room x={x} y={y} w={w} h={h} crew />
      <Tiny x={x + 8} y={y + 12} anchor="start" size={4.2} color={color || C.text}>{title}</Tiny>
      {[x + 26, x + w - 26].map((cx) => <line key={cx} x1={cx} y1={y + 18} x2={cx} y2={y + h - 8} stroke={C.equipLine} strokeWidth="0.5" opacity="0.4" />)}
      {machinery && [x - 64, x + w + 10].map((mx) => (
        <g key={mx}>
          <rect x={mx} y={y + 6} width={54} height={30} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.6" opacity="0.85" />
          <rect x={mx} y={y + 6} width={54} height={30} fill={purl('hatch')} />
          <circle cx={mx + 27} cy={y + 21} r={9} fill="none" stroke={C.equipLine} strokeWidth="0.7" opacity="0.7" />
          <text x={mx + 27} y={y + 46} fill={C.hullDeep} fontSize="3.6" textAnchor="middle" letterSpacing="0.12em">LIFT WINCH</text>
        </g>
      ))}
    </g>
  );
}

/* Maintenance hatch captions (the ladder glyph comes from STAIRS). */
function HatchLabels({ color }) {
  const C = useMapTheme();
  return (
    <g>
      <Tiny x={HATCH_NW.x + 13} y={HATCH_NW.y + 1.6} anchor="start" size={3.4} color={color || C.textDim}>HATCH ▼ TUNNELS</Tiny>
      <Tiny x={HATCH_SE.x - 13} y={HATCH_SE.y + 1.6} anchor="end" size={3.4} color={color || C.textDim}>HATCH ▼ TUNNELS</Tiny>
    </g>
  );
}

/* ─── Hull: plating, inner face, tankage wedges, trusses ─────────────── */

function inset(pts, d) {
  const cx = 550, cy = HULL.mid;
  return pts.map(([x, y]) => {
    const dx = x - cx, dy = y - cy, len = Math.hypot(dx, dy);
    return [x - (dx / len) * d * 1.6, y - (dy / len) * d];
  });
}

function hullOverlays(C) {
  const inner = inset(OUTLINE_PTS, 8).map((p) => p.join(',')).join(' ');
  const tanks = [[252, 400], [252, 470], [252, 540], [848, 400], [848, 470], [848, 540]];
  return (
    <g>
      <polygon points={inner} fill="none" stroke={C.hullOutline} strokeWidth="0.7" opacity="0.5" />
      {/* plate seams at the level-band lines */}
      {[252, 688].map((y) => <line key={y} x1={200} y1={y} x2={900} y2={y} stroke={C.hullDark} strokeWidth="0.8" opacity="0.7" />)}
      {[364, 736].map((x) => <line key={x} x1={x} y1={100} x2={x} y2={840} stroke={C.hullDark} strokeWidth="0.6" opacity="0.5" />)}
      {/* flank tankage (west and east points) */}
      {tanks.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r={14} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.6" opacity="0.8" />
          <circle cx={x} cy={y} r={14} fill={purl('hatch')} />
          <circle cx={x} cy={y} r={5} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.6" />
        </g>
      ))}
      <text x={252} y={576} fill={C.hullDeep} fontSize="4.2" textAnchor="middle" letterSpacing="0.15em">O₂ / N₂</text>
      <text x={848} y={576} fill={C.hullDeep} fontSize="4.2" textAnchor="middle" letterSpacing="0.15em">COOLANT</text>
      {/* corner truss bays */}
      {[[318, 262, 1], [782, 262, -1], [318, 678, 1], [782, 678, -1]].map(([x, y, s]) => (
        <g key={`${x}-${y}`} stroke={C.hullDark} strokeWidth="0.7" opacity="0.7" fill="none">
          <path d={`M ${x} ${y - 6} l ${-22 * s} 0 M ${x} ${y + 6} l ${-22 * s} 0 M ${x} ${y - 6} l ${-11 * s} 12 l ${-11 * s} -12`} />
        </g>
      ))}
      {/* rivet rows along the inner face */}
      {Array.from({ length: 22 }, (_, i) => 336 + i * 20).map((x) => (
        <g key={x}><circle cx={x} cy={122} r="0.8" fill={C.hullDark} /><circle cx={x} cy={818} r="0.8" fill={C.hullDark} /></g>
      ))}
    </g>
  );
}

/* Docked Vanguard, comms array, radiators, sensor spars, LV-178 limb, stack elevation. */
function Vanguard({ C }) {
  return (
    <g>
      {/* docking arm from Airlock 7's outer hatch */}
      <rect x={398} y={92} width={16} height={26} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.7" />
      {[98, 104, 110].map((y) => <line key={y} x1={398} y1={y} x2={414} y2={y} stroke={C.hullOutline} strokeWidth="0.4" opacity="0.6" />)}
      {/* the ship, docked broadside, nose west */}
      <path d="M 300 80 L 322 66 L 470 64 L 488 70 L 488 90 L 470 96 L 322 94 Z" fill={C.hullMid} stroke={C.hullOutline} strokeWidth="0.9" />
      <path d="M 488 70 L 500 68 L 500 92 L 488 90" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.6" />
      {[350, 380, 430, 460].map((x) => <line key={x} x1={x} y1={65} x2={x} y2={95} stroke={C.hullDark} strokeWidth="0.6" />)}
      <rect x={326} y={74} width={12} height={4} rx="1.5" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.4" />
      <text x={410} y={83} fill={C.textBright} fontSize="5.2" textAnchor="middle" letterSpacing="0.2em" opacity="0.85">USCSS VANGUARD</text>
      <text x={410} y={90} fill={C.hullDeep} fontSize="3.6" textAnchor="middle" letterSpacing="0.15em">DOCKED · AIRLOCK 7</text>
    </g>
  );
}

function StackElevation({ C }) {
  const x0 = 922, x1 = 1040, cx = (x0 + x1) / 2;
  const slabs = [
    ['L1 · OPERATIONS', 0], ['L2 · HABITATION', 1], ['L3 · MED / LABS', 2], ['L4 · SEALED', 3],
  ];
  const sy = (i) => 600 + i * 34;
  return (
    <g>
      <text x={x0 - 12} y={574} fill={C.text} fontSize="7" fontWeight="bold" letterSpacing="0.1em">STACK ELEVATION</text>
      <rect x={x0 - 22} y={560} width={172} height={290} rx="3" fill="none" stroke={C.frame} strokeWidth="0.4" />
      {/* docking arm and ship at the top level */}
      <rect x={x0 + 12} y={584} width={6} height={16} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.5" />
      <path d={`M ${x0 - 6} 584 L ${x0 + 40} 584 L ${x0 + 46} 588 L ${x0 + 40} 592 L ${x0 - 6} 592 Z`} fill={C.hullMid} stroke={C.hullOutline} strokeWidth="0.5" />
      {slabs.map(([label, i]) => {
        const y = sy(i), sealed = i === 3;
        return (
          <g key={label}>
            <path d={`M ${x0} ${y} L ${x1} ${y} L ${x1 + 8} ${y + 14} L ${x1} ${y + 28} L ${x0} ${y + 28} L ${x0 - 8} ${y + 14} Z`}
              fill={sealed ? '#2a1414' : C.hullMid} stroke={sealed ? C.restricted : C.hullOutline} strokeWidth="0.7" />
            {sealed && <path d={`M ${x0} ${y} L ${x1} ${y} L ${x1 + 8} ${y + 14} L ${x1} ${y + 28} L ${x0} ${y + 28} L ${x0 - 8} ${y + 14} Z`} fill={purl('hatch')} />}
            <text x={cx - 22} y={y + 16} fill={sealed ? C.restricted : C.textBright} fontSize="5" textAnchor="middle" letterSpacing="0.08em">{label}</text>
          </g>
        );
      })}
      {/* core: torus in section */}
      <path d={`M ${x0} ${sy(4)} L ${x1} ${sy(4)} L ${x1 + 8} ${sy(4) + 22} L ${x1} ${sy(4) + 44} L ${x0} ${sy(4) + 44} L ${x0 - 8} ${sy(4) + 22} Z`}
        fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.7" />
      <ellipse cx={cx} cy={sy(4) + 22} rx={24} ry={10} fill="none" stroke={C.restricted} strokeWidth="0.8" opacity="0.8" />
      <ellipse cx={cx} cy={sy(4) + 22} rx={10} ry={4} fill={C.restricted} opacity="0.35" />
      <text x={cx} y={sy(4) + 40} fill={C.textBright} fontSize="5" textAnchor="middle" letterSpacing="0.08em">CORE · REACTOR</text>
      {/* lift shaft and maintenance hatches */}
      <line x1={x1 - 14} y1={598} x2={x1 - 14} y2={sy(4) + 12} stroke={C.accent} strokeWidth="1.4" opacity="0.8" />
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={x1 - 18} y={sy(i) + 8} width={8} height={8} fill={C.hullDeep} stroke={C.accent} strokeWidth="0.6" />)}
      {[x0 + 4, x1 - 2].map((x) => <line key={x} x1={x} y1={sy(0) + 2} x2={x} y2={sy(4) + 30} stroke={C.vent} strokeWidth="0.9" strokeDasharray="2 2" opacity="0.8" />)}
      <line x1={x1 - 14} y1={sy(3) + 2} x2={x1 - 14} y2={sy(3) + 26} stroke={C.restricted} strokeWidth="1.2" />
      <text x={x0 - 12} y={sy(4) + 62} fill={C.textDim} fontSize="4.6" letterSpacing="0.06em">━ CENTRAL LIFT (ALL LEVELS)</text>
      <text x={x0 - 12} y={sy(4) + 72} fill={C.textDim} fontSize="4.6" letterSpacing="0.06em">┅ HATCHES NW / SE → TUNNELS</text>
      <text x={x0 - 12} y={sy(4) + 82} fill={C.restricted} fontSize="4.6" letterSpacing="0.06em">LIFT LOCKED OUT AT LEVEL 4</text>
    </g>
  );
}

function exteriorDetails(C) {
  return (
    <g>
      <Vanguard C={C} />
      {/* long-range comms array off the west point */}
      <g stroke={C.hullOutline} fill="none" strokeWidth="0.8" opacity="0.8">
        <line x1={216} y1={470} x2={194} y2={470} />
        <path d="M 192 452 A 22 22 0 0 0 192 488" />
        <line x1={192} y1={470} x2={182} y2={470} />
        <circle cx={181} cy={470} r={1.6} fill={C.hullOutline} />
      </g>
      <text x={196} y={500} fill={C.textDim} fontSize="4" textAnchor="middle" letterSpacing="0.12em">COMMS ARRAY</text>
      <text x={196} y={506} fill={C.restricted} fontSize="3.6" textAnchor="middle" letterSpacing="0.12em">TX OFF</text>
      {/* radiator fins off the east point */}
      {[-30, -18, -6, 6, 18, 30].map((dy) => (
        <g key={dy}>
          <line x1={884 - Math.abs(dy) * 0.29} y1={470 + dy} x2={906} y2={470 + dy} stroke={C.hullOutline} strokeWidth="0.6" opacity="0.7" />
          <rect x={906} y={470 + dy - 4} width={22} height={8} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.5" opacity="0.8" />
        </g>
      ))}
      <text x={917} y={516} fill={C.textDim} fontSize="4" textAnchor="middle" letterSpacing="0.12em">RADIATORS</text>
      {/* sensor spars from the four corners */}
      {[[320, 116, -1, -1], [780, 116, 1, -1], [320, 824, -1, 1], [780, 824, 1, 1]].map(([x, y, dx, dy]) => (
        <g key={`${x}-${y}`} stroke={C.hullOutline} strokeWidth="0.6" opacity="0.6" fill="none">
          <line x1={x} y1={y} x2={x + 20 * dx} y2={y + 14 * dy} />
          <circle cx={x + 22 * dx} cy={y + 15.5 * dy} r={2} />
        </g>
      ))}
      {/* antenna masts on the north face (east of the docking arm) */}
      {[560, 600, 700].map((x, i) => (
        <g key={x} stroke={C.hullOutline} strokeWidth="0.6" opacity="0.6">
          <line x1={x} y1={116} x2={x} y2={98 - i * 4} />
          <line x1={x - 4} y1={104 - i * 2} x2={x + 4} y2={104 - i * 2} />
        </g>
      ))}
      {/* LV-178 below */}
      <path d="M 330 892 Q 550 856 870 892" fill="none" stroke={C.equipLine} strokeWidth="0.8" opacity="0.45" />
      <path d="M 300 902 Q 550 862 900 902" fill="none" stroke={C.equipLine} strokeWidth="0.4" opacity="0.25" strokeDasharray="3 4" />
      <text x={550} y={888} fill={C.textDim} fontSize="5.2" textAnchor="middle" letterSpacing="0.22em">▼ LV-178 · ZETA II RETICULI</text>
      <StackElevation C={C} />
    </g>
  );
}

/* ─── Level 1: operations ────────────────────────────────────────────── */
function Level1Decor() {
  const C = useMapTheme();
  return (
    <g>
      <Lobby title="L1 LIFT LOBBY" />
      <Tiny x={612} y={300} anchor="end" color={C.restricted} size={3.2}>L4: LOCKED OUT</Tiny>

      {/* AIRLOCK 7: outer hatch to the Vanguard, inner pressure door, benches */}
      <circle cx={406} cy={140} r={9} fill={C.hullDeep} stroke={C.accent} strokeWidth="0.8" opacity="0.9" />
      <circle cx={406} cy={140} r={4} fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.7" />
      <Tiny x={420} y={142} anchor="start" color={C.accent} size={3.4}>OUTER HATCH ▲ VANGUARD</Tiny>
      <line x1={330} y1={160} x2={482} y2={160} stroke={C.vent} strokeWidth="0.9" strokeDasharray="3 2" opacity="0.7" />
      <Tiny x={340} y={157} anchor="start" color={C.vent} size={3}>CYCLE DOOR</Tiny>
      <Box x={332} y={172} w={6} h={60} />
      <Box x={474} y={172} w={6} h={60} />

      {/* SUIT LOCKERS: two rows of racks, three empty, one forced */}
      {Array.from({ length: 6 }, (_, i) => 136 + i * 16).flatMap((y, i) => [
        <Box key={`a${y}`} x={500} y={y} w={12} h={12} dashed={i === 4} color={i === 4 ? C.restricted : undefined} />,
        <Box key={`b${y}`} x={556} y={y} w={12} h={12} dashed={i === 1 || i === 5} />,
      ])}
      <Tiny x={506} y={238} color={C.restricted} size={2.8}>FORCED</Tiny>

      {/* BRIDGE: status board, console arc, command chair */}
      <rect x={622} y={136} width={112} height={10} fill={C.hullDeep} stroke={C.restricted} strokeWidth="0.5" opacity="0.8" />
      <Tiny x={678} y={143} color={C.restricted} size={3.6}>47 CREW · STATUS UNKNOWN</Tiny>
      <path d="M 606 232 Q 678 210 750 232" fill="none" stroke={C.equipLine} strokeWidth="2.4" opacity="0.4" />
      <Dots points={[[624, 224], [652, 218], [704, 218], [732, 224]]} r={2.6} color={C.accent} />
      <circle cx={678} cy={162} r={4} fill="none" stroke={C.accent} strokeWidth="0.6" opacity="0.6" />

      {/* OPS STORES: crates against the door */}
      {[0, 1, 2].flatMap((c) => [296, 316, 336, 420, 440].map((y) => <Box key={`${c}-${y}`} x={292 + c * 22} y={y} w={18} h={16} fill={C.hullDeep} />))}
      <Box x={344} y={364} w={14} h={22} fill={C.hullDeep} color={C.restricted} />
      {/* EMERGENCY LOCKERS: racks, empty flamer racks */}
      {[484, 500, 516].map((y) => <Box key={y} x={292} y={y} w={30} h={10} />)}
      {[600, 620].map((y) => <Box key={y} x={292} y={y} w={30} h={12} dashed color={C.restricted} />)}
      <Tiny x={307} y={644} color={C.restricted} size={2.8}>FLAMERS ×0</Tiny>

      {/* OBSERVATION GALLERY: viewports along the hull, painted over */}
      {[300, 360, 420, 520, 580].map((y) => (
        <g key={y}>
          <rect x={804} y={y} width={6} height={44} rx="2" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.5" opacity="0.8" />
          <path d={`M 805 ${y + 4} l 4 8 l -4 8 l 4 8 l -4 8 l 4 8`} fill="none" stroke={C.restricted} strokeWidth="0.6" opacity="0.6" />
        </g>
      ))}
      {[320, 400, 540, 600].map((y) => <Box key={y} x={752} y={y} w={10} h={30} />)}
      <Scrawl x={776} y={500} rotate={-90} size={3.6}>DON’T LOOK</Scrawl>

      {/* COMMUNICATIONS: transmitter racks, console, trunk to the array */}
      {[404, 420, 436].map((x) => <Box key={x} x={x} y={356} w={12} h={40} fill={C.hullDeep} />)}
      <Tiny x={426} y={404} size={3}>TX RACKS</Tiny>
      <Table x={470} y={452} w={66} h={12} />
      <Dots points={[[488, 472], [518, 472]]} r={2.6} color={C.accent} />
      <Tiny x={503} y={488} color={C.restricted} size={3.2}>ARRAY · SHUT DOWN BY HAND</Tiny>

      {/* SECURITY: monitor wall (L4 feeds static), armoury locker */}
      {Array.from({ length: 6 }, (_, i) => 408 + i * 21).map((x, i) => (
        <g key={x}>
          <Box x={x} y={512} w={17} h={11} fill={C.hullDeep} color={i >= 4 ? C.restricted : C.accent} />
          {i >= 4 && <path d={`M ${x + 2} ${514} l 13 7 m 0 -7 l -13 7`} stroke={C.restricted} strokeWidth="0.4" opacity="0.7" />}
        </g>
      ))}
      <Tiny x={500} y={530} color={C.restricted} size={2.8}>L4 · STATIC</Tiny>
      <Machine x={406} y={616} w={38} h={30} label="ARMOURY" />
      <Table x={478} y={612} w={56} h={14} />

      {/* DIRECTOR'S OFFICE: desk, cabinets, the directive */}
      <Table x={600} y={452} w={60} h={16} />
      <rect x={624} y={456} width={10} height={8} fill="none" stroke={C.restricted} strokeWidth="0.5" opacity="0.8" />
      <Tiny x={629} y={478} color={C.restricted} size={2.8}>DIRECTIVE</Tiny>
      {[360, 376, 392].map((y) => <Box key={y} x={684} y={y} w={12} h={12} />)}

      {/* BRIEFING ROOM: long table, wall screen */}
      <rect x={576} y={512} width={104} height={6} fill={C.hullDeep} stroke={C.accent} strokeWidth="0.5" opacity="0.7" />
      <Table x={584} y={600} w={88} h={22} />
      <Dots points={[596, 616, 636, 656].flatMap((x) => [[x, 595], [x, 628]])} r={2.4} />

      {/* LIFE SUPPORT: scrubbers, heaters, O₂ tanks, the Level 4 draw */}
      {[338, 378, 418].map((x) => <Machine key={x} x={x} y={702} w={30} h={30} />)}
      <Tiny x={393} y={740} size={3}>CO₂ SCRUBBERS</Tiny>
      <Machine x={500} y={702} w={56} h={22} label="HEATERS · 4°C" />
      {[580, 600].map((x) => <circle key={x} cx={x} cy={790} r={8} fill="none" stroke={C.vent} strokeWidth="0.6" opacity="0.6" />)}
      <Tiny x={590} y={807} size={3}>O₂</Tiny>
      <rect x={340} y={776} width={100} height={12} fill={C.hullDeep} stroke={C.restricted} strokeWidth="0.5" opacity="0.8" />
      <Tiny x={390} y={784.5} color={C.restricted} size={3.4}>LOAD → L4 · 312%</Tiny>

      {/* WATER RECLAMATION */}
      {[650, 690, 730].map((x) => <circle key={x} cx={x} cy={716} r={12} fill="none" stroke={C.vent} strokeWidth="0.6" opacity="0.6" />)}
      {[650, 690, 730].map((x) => <circle key={`f${x}`} cx={x} cy={790} r={6} fill={C.vent} opacity="0.18" />)}
      <Tiny x={698} y={806} size={3} color={C.restricted}>FILTERS CLOGGED</Tiny>

      <Scrawl x={662} y={270} rotate={-2}>DON’T LOOK AT THE STARS</Scrawl>
      <Scrawl x={380} y={600} rotate={-88} size={3.8}>IT SEES THROUGH THE WALLS</Scrawl>
      <HatchLabels />
    </g>
  );
}

/* ─── Level 2: habitation ────────────────────────────────────────────── */
function Level2Decor() {
  const C = useMapTheme();
  const cabinXs = Array.from({ length: 11 }, (_, i) => 326 + i * 26.2);
  return (
    <g>
      <Lobby title="L2 LIFT LOBBY" />
      <Box x={612} y={292} w={8} h={10} color={C.restricted} />
      <Tiny x={608} y={316} anchor="end" size={2.8} color={C.restricted}>CHAIR WEDGED</Tiny>

      {/* CREW QUARTERS: two rows of cabins either side of a hallway */}
      <g stroke={C.wall} strokeWidth="2.6">
        <line x1={330} y1={170} x2={610} y2={170} />
        <line x1={330} y1={206} x2={392} y2={206} /><line x1={408} y1={206} x2={532} y2={206} /><line x1={548} y1={206} x2={610} y2={206} />
        {cabinXs.slice(1, -1).map((x) => <line key={x} x1={x} y1={131} x2={x} y2={170} />)}
        {cabinXs.slice(1, -1).filter((x) => Math.abs(x - 400) > 12 && Math.abs(x - 540) > 12).map((x) => <line key={`s${x}`} x1={x} y1={206} x2={x} y2={245} />)}
      </g>
      {cabinXs.slice(0, -1).map((x, i) => <rect key={x} x={x + 5} y={135} width={16} height={8} rx="0.6" fill="none" stroke={C.accent} strokeWidth="0.4" opacity={i % 3 === 1 ? 0.25 : 0.5} />)}
      {cabinXs.slice(0, -1).map((x) => <rect key={`b${x}`} x={x + 5} y={233} width={16} height={8} rx="0.6" fill="none" stroke={C.accent} strokeWidth="0.4" opacity="0.45" />)}
      <Scrawl x={360} y={180} rotate={-1} size={3.4}>WE WERE WRONG</Scrawl>
      <Scrawl x={588} y={180} rotate={2} size={3.4}>IT DREAMS US</Scrawl>

      {/* HYGIENE: shower stalls (running), basins */}
      {[632, 656, 680, 704, 728, 752].map((x, i) => (
        <g key={x}>
          <Box x={x} y={134} w={18} h={18} />
          {i % 2 === 0 && <Dots points={[[x + 6, 141], [x + 12, 145], [x + 8, 148]]} r={0.8} color={C.vent} />}
        </g>
      ))}
      {[640, 670, 700, 730].map((x) => <circle key={x} cx={x} cy={234} r={4} fill="none" stroke={C.vent} strokeWidth="0.5" opacity="0.5" />)}

      {/* LAUNDRY & STORES */}
      {[304, 344].flatMap((x) => [300, 330].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={9} fill="none" stroke={C.equipLine} strokeWidth="0.6" opacity="0.55" />))}
      {[410, 426, 442].map((y) => <Box key={y} x={292} y={y} w={64} h={10} />)}

      {/* QUIET ROOM: the same diagram, drawn over and over */}
      {[[304, 500], [342, 520], [310, 600], [344, 630], [300, 640], [346, 580]].map(([x, y]) => (
        <g key={`${x}-${y}`} fill="none" stroke={C.restricted} strokeWidth="0.45" opacity="0.5">
          <circle cx={x} cy={y} r={7} /><circle cx={x} cy={y} r={3} />
          <path d={`M ${x - 7} ${y} L ${x + 7} ${y} M ${x} ${y - 7} L ${x + 5} ${y + 5}`} />
        </g>
      ))}

      {/* OFFICERS' CABINS (4) and DIRECTOR'S CABIN */}
      <g stroke={C.wall} strokeWidth="2.6">{[318, 352, 398, 432].map((y) => <line key={y} x1={741} y1={y} x2={811} y2={y} />)}</g>
      {[290, 324, 404, 438].map((y) => <rect key={y} x={790} y={y} width={18} height={10} rx="0.6" fill="none" stroke={C.accent} strokeWidth="0.4" opacity="0.5" />)}
      <rect x={784} y={482} width={22} height={34} rx="1" fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.5" />
      <Box x={750} y={630} w={14} h={10} color={C.accent} />
      <Tiny x={757} y={650} size={2.8}>BAG</Tiny>

      {/* MESS HALL: tables (some overturned), the barricade */}
      {[[414, 470], [470, 470], [596, 470], [652, 470], [414, 506], [470, 506], [596, 506], [652, 506]].map(([x, y], i) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={40} height={12} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.45" rx="1"
          transform={i % 3 === 0 ? `rotate(${i * 7 - 20},${x + 20},${y + 6})` : undefined} />
      ))}
      <g opacity="0.85">
        {[[486, 368, -12], [510, 372, 8], [536, 366, -4], [562, 372, 14], [588, 368, -10], [612, 372, 6]].map(([x, y, r]) => (
          <rect key={x} x={x} y={y} width={24} height={9} fill={C.hullDeep} stroke={C.restricted} strokeWidth="0.6" transform={`rotate(${r},${x + 12},${y + 4})`} />
        ))}
      </g>
      <Tiny x={550} y={396} color={C.restricted} size={3.4}>BARRICADE · BROKEN FROM THIS SIDE</Tiny>
      <Dots points={[[420, 400], [430, 412], [662, 404], [680, 420], [540, 418]]} r={1.4} color={C.restricted} />

      {/* GALLEY and COLD STORE */}
      {[408, 432, 456].map((x) => <rect key={x} x={x} y={560} width={20} height={14} fill="none" stroke={C.restricted} strokeWidth="0.5" opacity="0.6" rx="1" />)}
      <Table x={476} y={632} w={62} h={10} />
      {[566, 586, 606].map((y) => <line key={y} x1={560} y1={y + 0} x2={606} y2={y} stroke={C.equipLine} strokeWidth="1.8" opacity="0.35" />)}
      {[0, 1, 2, 3].map((i) => <line key={i} x1={694} y1={590 + i * 4} x2={699} y2={606 + i * 4} stroke={C.restricted} strokeWidth="0.5" opacity="0.7" />)}
      <Tiny x={690} y={630} anchor="end" color={C.restricted} size={2.8}>CLAW MARKS</Tiny>

      {/* REC AREA: gym machines, games table, the looping screen */}
      {[340, 362, 384].map((x) => <Machine key={x} x={x} y={702} w={16} h={26} />)}
      <circle cx={500} cy={720} r={12} fill="none" stroke={C.equipLine} strokeWidth="0.6" opacity="0.5" />
      <rect x={336} y={800} width={60} height={5} fill={C.hullDeep} stroke={C.accent} strokeWidth="0.5" opacity="0.7" />
      <Tiny x={366} y={796} size={2.8} color={C.accent}>SCREEN · LOOPING</Tiny>

      {/* HYDROPONICS: dead racks and one living one */}
      {[704, 716, 784, 796].map((y) => <line key={y} x1={566} y1={y} x2={760} y2={y} stroke={C.equipLine} strokeWidth="1.6" opacity="0.3" strokeDasharray="6 2" />)}
      <path d="M 566 790 q 12 -10 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0" fill="none" stroke={RESIN_HI} strokeWidth="1.2" opacity="0.8" />
      <Tiny x={760} y={810} anchor="end" color={C.restricted} size={2.8}>RACK 6 · THRIVING</Tiny>

      <Scrawl x={662} y={270} rotate={-2}>IT SEES THROUGH THE WALLS</Scrawl>
      <Scrawl x={720} y={590} rotate={90} size={3.8}>LEVEL 4 IS GONE</Scrawl>
      <Scrawl x={440} y={677} rotate={1} size={3.6}>DON’T SLEEP</Scrawl>
      <HatchLabels />
    </g>
  );
}

/* ─── Level 3: medical and labs ──────────────────────────────────────── */
function Level3Decor() {
  const C = useMapTheme();
  return (
    <g>
      <Lobby title="L3 LIFT LOBBY" />
      <path d="M 520 286 Q 550 276 580 286" fill="none" stroke={C.vent} strokeWidth="0.8" strokeDasharray="2 1.5" opacity="0.7" />

      {/* MEDICAL BAY: six beds, scanner, surgery */}
      {[340, 372, 404, 436, 468, 500].map((x) => <rect key={x} x={x} y={136} width={20} height={30} rx="1" fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.5" />)}
      <circle cx={364} cy={222} r={16} fill="none" stroke={C.vent} strokeWidth="0.7" opacity="0.6" />
      <rect x={356} y={216} width={16} height={12} fill="none" stroke={C.vent} strokeWidth="0.4" opacity="0.6" />
      <Tiny x={384} y={224} anchor="start" size={2.8}>SCANNER</Tiny>
      <rect x={560} y={150} width={26} height={12} fill={C.hullDeep} stroke={C.accent} strokeWidth="0.6" opacity="0.7" />
      <circle cx={573} cy={140} r={6} fill="none" stroke={C.accent} strokeWidth="0.4" opacity="0.5" />
      <Tiny x={573} y={172} size={2.8}>SURGERY</Tiny>
      <Box x={524} y={216} w={70} h={14} />
      <Tiny x={559} y={226} size={2.8} color={C.restricted}>AUTOPSY FILES</Tiny>

      {/* PHARMACY: bare shelves */}
      {[136, 150, 222, 236].map((y) => <Box key={y} x={634} y={y} w={128} h={8} dashed={y < 160} color={y < 160 ? C.restricted : undefined} />)}

      {/* MORGUE: six drawers, four full */}
      {[0, 1].flatMap((c) => [0, 1, 2].map((r) => {
        const full = !(c === 1 && r > 0);
        return <Box key={`${c}-${r}`} x={294 + c * 32} y={296 + r * 22} w={28} h={16} fill={full ? C.hullDeep : 'none'} color={c === 0 && r === 2 ? C.restricted : undefined} />;
      }))}
      <Tiny x={324} y={398} size={2.6} color={C.restricted}>TAG MISMATCH</Tiny>
      <Table x={300} y={420} w={48} h={14} />

      {/* ISOLATION WARD: two cells, one window cracked from inside */}
      <line x1={289} y1={540} x2={359} y2={540} stroke={C.wall} strokeWidth="2.6" /><line x1={289} y1={588} x2={359} y2={588} stroke={C.wall} strokeWidth="2.6" />
      <Box x={296} y={490} w={22} h={10} color={C.accent} />
      <Box x={296} y={620} w={22} h={10} color={C.accent} />
      <path d="M 352 600 l -6 4 l 5 3 l -7 5" fill="none" stroke={C.restricted} strokeWidth="0.6" opacity="0.8" />

      {/* SAMPLE FREEZERS and CLEAN-ROOM LOCKERS */}
      {[292, 316, 340, 396, 420, 444].map((y, i) => <Box key={y} x={746} y={y} w={30} h={18} fill={C.hullDeep} color={i === 2 ? C.restricted : undefined} dashed={i === 2} />)}
      <Tiny x={792} y={348} size={2.6} color={C.restricted} rotate={-90}>OPEN · WARM</Tiny>
      <Dots points={[490, 508, 526, 600, 618].map((y) => [790, y])} r={2.6} color={C.accent} />
      <circle cx={790} cy={636} r={2.6} fill="none" stroke={C.restricted} strokeWidth="0.5" strokeDasharray="1 1" />

      {/* RESEARCH LABS: glass partition A | B, containment cylinders, terminals */}
      <line x1={550} y1={352} x2={550} y2={424} stroke={C.vent} strokeWidth="1.2" strokeDasharray="4 2" opacity="0.6" />
      <line x1={550} y1={466} x2={550} y2={540} stroke={C.vent} strokeWidth="1.2" strokeDasharray="4 2" opacity="0.6" />
      <Tiny x={474} y={362} size={3.6} color={C.accent}>LAB A</Tiny>
      <Tiny x={626} y={362} size={3.6} color={C.accent}>LAB B</Tiny>
      {[[426, 392], [460, 392], [494, 392], [606, 392], [640, 392], [674, 392]].map(([x, y], i) => (
        <g key={x}>
          <circle cx={x} cy={y} r={11} fill={C.hullDeep} stroke={C.vent} strokeWidth="0.7" opacity="0.85" />
          <circle cx={x} cy={y} r={3} fill="none" stroke={i === 4 ? C.restricted : C.accent} strokeWidth="0.6" opacity="0.8" />
        </g>
      ))}
      <Tiny x={640} y={412} size={2.6} color={C.restricted}>DORMANT?</Tiny>
      {[412, 470, 600, 646].map((x) => <Table key={x} x={x} y={494} w={46} h={12} />)}
      {[424, 482, 612, 658].map((x) => <rect key={x} x={x} y={512} width={10} height={7} fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.6" />)}

      {/* DATA ARCHIVE and DECON */}
      {[408, 424, 440, 456].map((x) => <Box key={x} x={x} y={562} w={10} h={32} fill={C.hullDeep} />)}
      <Tiny x={520} y={640} size={2.8} color={C.restricted}>FULL SET → L4</Tiny>
      {[574, 600, 626, 652, 678].map((x) => <circle key={x} cx={x} cy={566} r={2.4} fill="none" stroke={C.vent} strokeWidth="0.6" opacity="0.7" />)}
      <line x1={560} y1={636} x2={696} y2={636} stroke={C.vent} strokeWidth="0.8" strokeDasharray="3 2" opacity="0.6" />

      {/* SPECIMEN STORAGE: tank rows, two breached */}
      {[348, 380, 412, 444, 476, 508].flatMap((x, c) => [716, 790].map((y, r) => {
        const breached = (c === 2 && r === 0) || (c === 5 && r === 1);
        return (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r={11} fill={breached ? 'none' : C.hullDeep} stroke={breached ? C.restricted : C.vent} strokeWidth="0.7" strokeDasharray={breached ? '2 1.5' : undefined} opacity="0.85" />
            {!breached && <path d={`M ${x - 3} ${y + 2} q 3 -6 6 0`} fill="none" stroke={C.restricted} strokeWidth="0.5" opacity="0.6" />}
          </g>
        );
      }))}

      {/* LAB C — DISSECTION: table with restraints, viewing rail */}
      <rect x={636} y={714} width={56} height={18} rx="2" fill={C.hullDeep} stroke={C.accent} strokeWidth="0.6" opacity="0.8" />
      {[646, 664, 682].map((x) => <line key={x} x1={x} y1={712} x2={x} y2={734} stroke={C.restricted} strokeWidth="0.8" opacity="0.7" />)}
      <path d="M 572 800 Q 664 774 756 800" fill="none" stroke={C.equipLine} strokeWidth="0.8" strokeDasharray="5 2" opacity="0.6" />
      <Tiny x={664} y={808} size={2.8}>VIEWING RAIL</Tiny>

      <Scrawl x={662} y={270} rotate={-2}>THEY’RE NOT DEAD</Scrawl>
      <Scrawl x={630} y={677} rotate={1}>WE WERE WRONG ABOUT EVERYTHING</Scrawl>
      <HatchLabels />
    </g>
  );
}

/* ─── Level 4: primary research (sealed) ─────────────────────────────── */
function resinTrail(x0, y0, x1, y1, seed) {
  const horiz = Math.abs(x1 - x0) > Math.abs(y1 - y0);
  let d = `M ${x0} ${y0}`;
  const n = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 18));
  for (let i = 1; i <= n; i++) {
    const t = i / n, wob = ((i * 7 + seed) % 5) - 2;
    const x = x0 + (x1 - x0) * t + (horiz ? 0 : wob * 1.6);
    const y = y0 + (y1 - y0) * t + (horiz ? wob * 1.6 : 0);
    d += ` Q ${x + (horiz ? -6 : 3)} ${y + (horiz ? 3 : -6)} ${x} ${y}`;
  }
  return d;
}

function Level4Decor() {
  const C = useMapTheme();
  const cx = 550, cy = 430;
  const ribs = Array.from({ length: 14 }, (_, i) => (i * 360) / 14);
  return (
    <g>
      {/* resin over the ring corridors */}
      <g fill="none" strokeLinecap="round">
        {[[372, 260, 728, 262, 1], [372, 272, 728, 270, 3], [374, 280, 376, 660, 2], [386, 280, 384, 660, 4],
          [714, 280, 716, 660, 1], [726, 280, 724, 660, 5], [372, 668, 728, 670, 2], [372, 680, 728, 678, 6]].map(([a, b, c, d, s], i) => (
          <path key={i} d={resinTrail(a, b, c, d, s)} stroke={i % 2 ? RESIN_HI : RESIN} strokeWidth={i % 2 ? 1.2 : 2.2} opacity="0.8" />
        ))}
      </g>

      <Lobby title="L4 LIFT LOBBY" color={C.restricted} machinery={false} />
      {/* barricade of lockers and benches, welded doors north and south */}
      {[[480, 318, -8], [500, 324, 10], [596, 320, -6], [612, 314, 12]].map(([x, y, r]) => (
        <rect key={x} x={x} y={y} width={16} height={8} fill={C.hullDeep} stroke={C.restricted} strokeWidth="0.6" transform={`rotate(${r},${x + 8},${y + 4})`} />
      ))}
      <WeldBar x={535} y={284} />
      <WeldBar x={535} y={340} />
      <Tiny x={598} y={300} size={3} color={C.restricted}>WELDED</Tiny>
      <HazardSign x={434} y={302} s={9} />
      <HazardSign x={666} y={302} s={9} />
      <Tiny x={434} y={322} size={3} color={C.restricted}>BLAST DOORS</Tiny>
      <Tiny x={434} y={328} size={3} color={C.restricted}>WELDED SHUT</Tiny>
      <Tiny x={666} y={322} size={3} color={C.restricted}>BIO-CONTAINMENT</Tiny>
      <Tiny x={666} y={328} size={3} color={C.restricted}>DO NOT OPEN</Tiny>

      {/* PRIMARY RESEARCH: the cathedral — ribs, resin rings, the Architect, core storage */}
      <g fill="none">
        {ribs.map((a) => {
          const r = (a * Math.PI) / 180;
          return <path key={a} d={`M ${cx + Math.cos(r) * 30} ${cy + Math.sin(r) * 26} Q ${cx + Math.cos(r + 0.25) * 80} ${cy + Math.sin(r + 0.25) * 66} ${cx + Math.cos(r) * 132} ${cy + 54 + Math.sin(r) * 132 * 0.95}`}
            stroke={RESIN_HI} strokeWidth="1" opacity="0.45" />;
        })}
        {[30, 50, 68].map((r, i) => <ellipse key={r} cx={cx} cy={cy} rx={r} ry={r * 0.82} stroke={i === 0 ? C.restricted : RESIN_HI} strokeWidth={i === 0 ? 0.9 : 0.7} strokeDasharray={i ? '3 3' : undefined} opacity="0.7" />)}
      </g>
      <path d={`M ${cx} ${cy - 22} C ${cx + 18} ${cy - 18}, ${cx + 16} ${cy + 14}, ${cx} ${cy + 22} C ${cx - 16} ${cy + 14}, ${cx - 18} ${cy - 18}, ${cx} ${cy - 22} Z`}
        fill="#2a1010" stroke={C.restricted} strokeWidth="0.9" />
      <circle cx={cx} cy={cy - 4} r={5} fill="none" stroke={C.restricted} strokeWidth="0.6" />
      <Tiny x={cx} y={cy + 34} size={4.2} color={C.restricted}>THE ARCHITECT</Tiny>
      <rect x={526} y={588} width={48} height={20} fill={C.hullDeep} stroke={C.accent} strokeWidth="0.8" />
      {[532, 542, 552, 562].map((x) => <line key={x} x1={x} y1={592} x2={x} y2={604} stroke={C.accent} strokeWidth="0.6" opacity="0.7" />)}
      <Tiny x={550} y={616} size={3.2} color={C.accent}>CORE STORAGE UNIT · EREBUS DATA</Tiny>
      <Tiny x={550} y={636} size={3} color={C.textDim}>GRAVITY UNSTABLE · TRACKER UNRELIABLE</Tiny>

      {/* CONTAINMENT CONTROL: consoles, monitors */}
      {[340, 382, 424, 466, 508].map((x) => <Box key={x} x={x} y={136} w={28} h={10} fill={C.hullDeep} color={C.restricted} />)}
      <path d="M 340 232 Q 436 214 532 232" fill="none" stroke={C.equipLine} strokeWidth="2.2" opacity="0.4" />

      {/* SPECIMEN VAULT: vault door (open from inside), racks */}
      <circle cx={664} cy={138} r={12} fill={C.hullDeep} stroke={C.restricted} strokeWidth="0.8" />
      <path d="M 652 138 L 676 138 M 664 126 L 664 150" stroke={C.restricted} strokeWidth="0.5" />
      <Tiny x={684} y={140} anchor="start" size={2.8} color={C.restricted}>OPENED FROM INSIDE</Tiny>
      {[574, 604, 704, 734].map((x) => [214, 230].map((y) => <Box key={`${x}-${y}`} x={x} y={y} w={22} h={10} dashed />))}

      {/* BIOHAZARD LOCK and POWER TAP */}
      {[310, 360, 410, 560, 610].map((y) => <path key={y} d={`M 294 ${y + 14} Q 324 ${y - 6} 354 ${y + 14}`} fill="none" stroke={C.vent} strokeWidth="0.7" opacity="0.6" />)}
      {[752, 766, 780, 794].map((x) => <line key={x} x1={x} y1={290} x2={x} y2={650} stroke={C.equipLine} strokeWidth="2" opacity="0.45" />)}
      {[330, 400, 560, 620].map((y) => <Box key={y} x={746} y={y} w={56} h={8} fill={C.hullDeep} color={C.restricted} />)}
      <path d={resinTrail(800, 290, 800, 650, 3)} fill="none" stroke={RESIN_HI} strokeWidth="1.4" opacity="0.7" />

      {/* HOLDING CELLS (4, open) and INCINERATOR */}
      <g stroke={C.wall} strokeWidth="2.6">{[381, 436, 491].map((x) => <line key={x} x1={x} y1={695} x2={x} y2={736} />)}<line x1={329} y1={736} x2={543} y2={736} strokeDasharray="30 25" /></g>
      {[352, 408, 462, 518].map((x) => <path key={x} d={`M ${x - 8} 720 q 8 -12 16 0`} fill="none" stroke={C.restricted} strokeWidth="0.6" opacity="0.6" />)}
      <circle cx={664} cy={720} r={20} fill={C.hullDeep} stroke={C.restricted} strokeWidth="0.8" />
      <circle cx={664} cy={720} r={20} fill={purl('hatch')} />
      <circle cx={664} cy={720} r={8} fill="none" stroke="#c8a030" strokeWidth="0.6" opacity="0.7" />

      <HazardSign x={418} y={372} s={8} />
      <HazardSign x={682} y={372} s={8} />
      <HazardSign x={418} y={632} s={8} />
      <HazardSign x={682} y={632} s={8} />
      <HatchLabels color={C.restricted} />
    </g>
  );
}

/* ─── Core: reactor and tunnels ──────────────────────────────────────── */
function CoreDecor() {
  const C = useMapTheme();
  const cx = 550, cy = 502;
  return (
    <g>
      <Lobby title="CORE LIFT LOBBY" />
      {[592, 600, 608, 616].map((x) => <Box key={x} x={x} y={290} w={6} h={12} color={C.accent} />)}
      <Tiny x={604} y={312} size={2.6}>DOSIMETERS</Tiny>
      <rect x={520} y={334} width={60} height={5} rx="2" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.5" opacity="0.8" />

      {/* REACTOR: warning rings, torus, plasma core */}
      <g fill="none">
        {[140, 128].map((r, i) => <circle key={r} cx={cx} cy={cy} r={r} stroke={C.restricted} strokeWidth={i ? 0.6 : 1} strokeDasharray={i ? '2 3' : '8 4'} opacity="0.7" />)}
        <circle cx={cx} cy={cy} r={104} stroke={C.hullOutline} strokeWidth="1.4" opacity="0.8" />
        <circle cx={cx} cy={cy} r={70} stroke={C.hullOutline} strokeWidth="1.4" opacity="0.8" />
        <circle cx={cx} cy={cy} r={87} stroke={C.restricted} strokeWidth="5" opacity="0.18" />
        <circle cx={cx} cy={cy} r={87} stroke={C.restricted} strokeWidth="0.8" strokeDasharray="1 3" opacity="0.8" />
        {Array.from({ length: 16 }, (_, i) => (i * 360) / 16).map((a) => {
          const r = (a * Math.PI) / 180;
          return <line key={a} x1={cx + Math.cos(r) * 70} y1={cy + Math.sin(r) * 70} x2={cx + Math.cos(r) * 104} y2={cy + Math.sin(r) * 104} stroke={C.equipLine} strokeWidth="1.6" opacity="0.5" />;
        })}
      </g>
      <circle cx={cx} cy={cy} r={70} fill={C.hullDeep} />
      <text x={cx} y={cy - 16} fill={C.text} fontSize="7" textAnchor="middle" letterSpacing="0.1em">REACTOR CORE</text>
      <text x={cx} y={cy - 6} fill={C.textDim} fontSize="4.6" textAnchor="middle" letterSpacing="0.06em">FUSION TORUS · UNSTABLE</text>
      <Tiny x={cx} y={cy + 20} size={4} color={C.restricted}>OUTPUT 118% · L4 DRAW 3×</Tiny>
      <Tiny x={cx} y={cy + 30} size={3.2} color={C.textDim}>CONTAINMENT FIELD FLUCTUATING</Tiny>
      <Tiny x={cx} y={cy - 114} size={3.4} color={C.textBright}>RADIATION · NO ENTRY WITHOUT SHIELDING</Tiny>
      <HazardSign x={414} y={370} s={8} />
      <HazardSign x={686} y={370} s={8} />
      <HazardSign x={414} y={634} s={8} />
      <HazardSign x={686} y={634} s={8} />

      {/* POWER DISTRIBUTION: breaker panels, the Level 4 trunk */}
      {[338, 362, 386, 410, 434].map((x) => <Box key={x} x={x} y={136} w={18} h={28} fill={C.hullDeep} />)}
      <rect x={512} y={152} width={22} height={86} fill={C.hullDeep} stroke={C.restricted} strokeWidth="0.8" opacity="0.85" />
      <path d="M 523 230 L 523 164 M 518 170 L 523 162 L 528 170" stroke={C.restricted} strokeWidth="0.8" fill="none" />
      <Tiny x={506} y={190} size={2.8} color={C.restricted} rotate={-90}>L4 TRUNK · 3× LOAD</Tiny>

      {/* REACTOR CONTROL: two shutdown keys three metres apart */}
      <path d="M 572 232 Q 664 210 756 232" fill="none" stroke={C.equipLine} strokeWidth="2.4" opacity="0.4" />
      {[594, 734].map((x) => (
        <g key={x}>
          <Box x={x - 14} y={140} w={28} h={14} fill={C.hullDeep} color={C.restricted} />
          <circle cx={x} cy={147} r={2.4} fill="none" stroke="#c8a030" strokeWidth="0.7" />
          <Tiny x={x} y={164} size={2.8} color={C.restricted}>KEY</Tiny>
        </g>
      ))}
      <line x1={614} y1={147} x2={714} y2={147} stroke={C.restricted} strokeWidth="0.4" strokeDasharray="2 2" opacity="0.6" />
      <Tiny x={664} y={158} size={2.8} color={C.restricted}>3 M APART · TWO OPERATORS</Tiny>

      {/* BATTERY ROOM and HEAT EXCHANGER */}
      {[0, 1].flatMap((c) => Array.from({ length: 9 }, (_, r) => <Box key={`${c}-${r}`} x={296 + c * 30} y={296 + r * 18} w={24} h={12} fill={r < 3 ? C.hullDeep : 'none'} />))}
      <path d="M 760 296 L 790 296 L 760 316 L 790 336 L 760 356 L 790 376 L 760 396 L 790 416 L 760 436 L 790 456" fill="none" stroke={C.restricted} strokeWidth="1" opacity="0.5" />
      <path d="M 760 500 L 790 500 L 760 520 L 790 540 L 760 560 L 790 580 L 760 600 L 790 620 L 760 640" fill="none" stroke={C.vent} strokeWidth="1" opacity="0.6" />

      {/* COOLANT PUMPS (primary offline) and FUEL STORE */}
      {[[372, 'PRIMARY', true], [500, 'BACKUP', false]].map(([x, l, off]) => (
        <g key={x}>
          <circle cx={x} cy={724} r={16} fill={C.hullDeep} stroke={off ? C.restricted : C.vent} strokeWidth="0.8" />
          <circle cx={x} cy={724} r={5} fill={off ? 'none' : C.vent} stroke={C.vent} strokeWidth="0.5" opacity="0.6" />
          {off && <path d={`M ${x - 8} 716 l 16 16 m 0 -16 l -16 16`} stroke={C.restricted} strokeWidth="0.8" />}
          <Tiny x={x} y={750} size={2.8} color={off ? C.restricted : C.textDim}>{l}</Tiny>
        </g>
      ))}
      <path d="M 388 724 L 484 724" stroke={C.vent} strokeWidth="1.2" strokeDasharray="3 2" opacity="0.6" />
      {[576, 600, 624, 704, 728, 752].flatMap((x) => [712, 790].map((y) => (
        <g key={`${x}-${y}`}><circle cx={x} cy={y} r={8} fill={C.hullDeep} stroke={C.equipLine} strokeWidth="0.6" opacity="0.8" /><circle cx={x} cy={y} r={2.5} fill="none" stroke="#c8a030" strokeWidth="0.5" opacity="0.7" /></g>
      )))}

      <HatchLabels />
    </g>
  );
}

/* ─── Level components ───────────────────────────────────────────────── */
const plan = (level, Decor) => function LevelComp() {
  return (
    <LevelPlan rooms={prometheusRooms} doors={prometheusDoors} stairs={stairsFor(level)} level={level}
      conduits={FEED_PATHS[level]} decorate={() => <Decor />} />
  );
};
const Level1 = plan('level-1', Level1Decor);
const Level2 = plan('level-2', Level2Decor);
const Level3 = plan('level-3', Level3Decor);
const Level4 = plan('level-4', Level4Decor);
const Core = plan('core', CoreDecor);

const extraLegend = (C) => [
  { label: 'WELDED / LOCKED DOOR', draw: (y) => <circle cx="5" cy={y - 1} r="3" fill="none" stroke={C.restricted} strokeWidth="0.7" opacity="0.8" /> },
  { label: 'MAINTENANCE CRAWLWAY', draw: (y) => <><rect x="0" y={y - 5} width="12" height="7" fill={C.hullDeep} /><rect x="1" y={y - 4} width="10" height="5" fill="none" stroke={C.vent} strokeWidth="0.5" strokeDasharray="2 2" /></> },
  { label: 'BIO-HAZARD', draw: (y) => <path d={`M 5 ${y - 6} L 10 ${y + 2} L 0 ${y + 2} Z`} fill="#1a1408" stroke="#c8a030" strokeWidth="0.6" /> },
  { label: 'RESIN GROWTH', draw: (y) => <path d={`M 0 ${y - 1} q 3 -3 6 0 t 6 0`} fill="none" stroke={RESIN_HI} strokeWidth="1.2" /> },
  { label: 'WALL SCRAWL', draw: (y) => <text x="0" y={y + 1} fill={C.restricted} fontSize="5" fontStyle="italic" opacity="0.8">abc</text> },
];

export const prometheusConfig = {
  width: W,
  height: H,
  stars: { count: 220, seed: 178 },
  backdrop: 'space',
  levelNoun: 'LEVEL',
  scenarioTag: 'HEART OF DARKNESS',
  hull: { path: OUTLINE, overlays: hullOverlays },
  exteriorDetails,
  sidebar: alienSidebar({ title: 'STATION PROMETHEUS', subtitle: 'WEYLAND-YUTANI DEEP SPACE RESEARCH STATION · PROJECT EREBUS', tag: 'P R O M E T H E U S' }),
  decks: [
    { id: '1', level: 'level-1', name: 'OPERATIONS', page: 'I', component: Level1 },
    { id: '2', level: 'level-2', name: 'HABITATION', page: 'II', component: Level2 },
    { id: '3', level: 'level-3', name: 'MEDICAL / LABS', page: 'III', component: Level3 },
    { id: '4', level: 'level-4', name: 'PRIMARY RESEARCH · SEALED', page: 'IV', component: Level4 },
    { id: 'C', level: 'core', name: 'REACTOR CORE', page: 'V', component: Core },
  ],
  specs: {
    title: 'STATION SURVEY',
    y: 828,
    items: [
      ['CREW COMPLEMENT', '47 — all listed MIA'],
      ['REACTOR', 'Fusion torus, core level — unstable'],
      ['ORBIT', 'LV-178, Zeta II Reticuli'],
      ['DAYS SILENT', '183 — no distress call sent'],
      ['ACCESS', 'Airlock 7 (emergency port) only'],
    ],
  },
  legend: (C) => alienLegend(extraLegend(C))(C),
};

/** Interactive plan, registered as universe.maps[station-prometheus].engine */
export function PrometheusMap() {
  return <MapEngine config={prometheusConfig} />;
}
PrometheusMap.config = prometheusConfig;
