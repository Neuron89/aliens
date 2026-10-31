import React from 'react';
import MapEngine, { useMapTheme } from '../../../engine/components/MapEngine';
import { LevelPlan, DUNE_MAP_THEME, duneLegend, duneSidebar, Table, Dots } from './duneMapKit.jsx';
import {
  W, H, OUTLINE, WALL, INNER, BASTIONS, BASTION_SIZE,
  keepRooms, keepDoors, STAIRS, CONDUITS, CONDUIT_GRATES,
} from './keep.geometry.js';

/* ═══════════════════════════════════════════════════════════════════════
   QARRAT KEEP — MapEngine plan (ground floor, cistern vault, roof).
   All rooms/doors come from keep.geometry.js, which also feeds the
   normalized board rooms in maps/index.js.
   ═══════════════════════════════════════════════════════════════════════ */

/* Stairs for one level, captioned for that level. */
const stairsFor = (level) => STAIRS
  .filter((s) => s.levels.includes(level))
  .map((s) => ({ ...s, level, label: s.labels?.[level] || s.label }));

/* Dashed route line (servants' route in amber, guard route in red). */
function Route({ d, kind = 'servants' }) {
  const C = useMapTheme();
  const col = kind === 'guard' ? C.restricted : C.accent;
  return <path d={d} fill="none" stroke={col} strokeWidth="1.1" strokeDasharray="4 3" opacity="0.7" strokeLinecap="round" />;
}

function Tiny({ x, y, children, color, anchor = 'middle', size = 3.6, rotate }) {
  const C = useMapTheme();
  return (
    <text x={x} y={y} fill={color || C.textDim} fontSize={size} textAnchor={anchor} letterSpacing="0.08em"
      transform={rotate ? `rotate(${rotate},${x},${y})` : undefined}>{children}</text>
  );
}

/* ─── Shared hull overlays: thick wall courses, bastion masonry ───────── */
function hullOverlays(C) {
  const { x0, y0, x1, y1 } = INNER;
  const m = WALL.t / 2;
  return (
    <g>
      {/* inner wall face */}
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="none" stroke={C.hullOutline} strokeWidth="0.9" opacity="0.55" />
      {/* mid-wall course line */}
      <rect x={WALL.x0 + m} y={WALL.y0 + m} width={WALL.x1 - WALL.x0 - 2 * m} height={WALL.y1 - WALL.y0 - 2 * m}
        fill="none" stroke={C.hullOutline} strokeWidth="0.5" strokeDasharray="7 4" opacity="0.28" />
      {/* bastions: hatched masonry and a turret ring */}
      {BASTIONS.map((b) => {
        const cx = b.x + BASTION_SIZE / 2, cy = b.y + BASTION_SIZE / 2;
        return (
          <g key={b.id}>
            <rect x={b.x} y={b.y} width={BASTION_SIZE} height={BASTION_SIZE} fill="url(#me_hatch)" opacity="0.9" />
            <circle cx={cx} cy={cy} r={20} fill="none" stroke={C.hullOutline} strokeWidth="0.6" opacity="0.5" />
            {[0, 90, 180, 270].map((a) => {
              const r = (a * Math.PI) / 180;
              return <line key={a} x1={cx + Math.cos(r) * 22} y1={cy + Math.sin(r) * 22} x2={cx + Math.cos(r) * 30} y2={cy + Math.sin(r) * 30} stroke={C.hullDeep} strokeWidth="1.6" />;
            })}
          </g>
        );
      })}
      {/* arrow slits along the curtain walls */}
      {[360, 440, 660, 740].map((x) => <g key={x}><line x1={x} y1={WALL.y0 + 3} x2={x} y2={WALL.y0 + 10} stroke={C.hullDeep} strokeWidth="1.4" /><line x1={x} y1={WALL.y1 - 10} x2={x} y2={WALL.y1 - 3} stroke={C.hullDeep} strokeWidth="1.4" /></g>)}
      {[260, 400, 540, 680].map((y) => <g key={y}><line x1={WALL.x0 + 3} y1={y} x2={WALL.x0 + 10} y2={y} stroke={C.hullDeep} strokeWidth="1.4" /><line x1={WALL.x1 - 10} y1={y} x2={WALL.x1 - 3} y2={y} stroke={C.hullDeep} strokeWidth="1.4" /></g>)}
    </g>
  );
}

/* ─── Outside the walls: Shield Wall scarp, gate road, sand ───────────── */
function exterior(C) {
  const scarp = [];
  for (let x = 214, i = 0; x <= 886; x += 24, i++) scarp.push(`${x} ${74 + (i % 3) * 5 + (i % 2 ? -3 : 2)}`);
  return (
    <g>
      {/* Shield Wall scarp to the north */}
      <path d={`M ${scarp.join(' L ')}`} fill="none" stroke={C.hullOutline} strokeWidth="0.9" opacity="0.45" />
      {Array.from({ length: 28 }, (_, i) => 222 + i * 24).map((x) => <line key={x} x1={x} y1={70} x2={x - 6} y2={60} stroke={C.hullOutline} strokeWidth="0.5" opacity="0.3" />)}
      <text x={218} y={56} fill={C.textDim} fontSize="5.5" letterSpacing="0.22em">▲ SHIELD WALL SCARP</text>
      {/* gate road to Qarrat Town */}
      <path d="M 532 818 L 520 890 M 568 818 L 580 890" stroke={C.equipLine} strokeWidth="0.8" opacity="0.5" fill="none" />
      {[832, 848, 864, 880].map((y) => <line key={y} x1={530 - (y - 818) * 0.16} y1={y} x2={570 + (y - 818) * 0.16} y2={y} stroke={C.equipLine} strokeWidth="0.4" opacity="0.3" />)}
      <text x={600} y={862} fill={C.textDim} fontSize="5.5" letterSpacing="0.2em">▼ QARRAT TOWN · 1.5 KM</text>
      <text x={700} y={802} fill={C.textDim} fontSize="4" textAnchor="middle" letterSpacing="0.15em">▲ RATION GRILLE</text>
      {/* open sand east of the keep */}
      <g opacity="0.5">
        {[420, 452, 520, 560, 640, 690].map((y, i) => <path key={y} d={`M ${900 + (i % 2) * 18} ${y} q 30 -8 60 0 t 60 0`} fill="none" stroke={C.equipLine} strokeWidth="0.6" />)}
        <text x={930} y={600} fill={C.textDim} fontSize="6" letterSpacing="0.2em">OPEN SAND</text>
      </g>
    </g>
  );
}

/* ─── Ground floor decoration ─────────────────────────────────────────── */
function GroundDecor() {
  const C = useMapTheme();
  return (
    <g>
      {/* RAMP COURT: plasteel ramp rising west to the roof pad, fuel drums, tie-downs */}
      <rect x={346} y={288} width={78} height={16} fill="url(#me_hatch)" stroke={C.equipLine} strokeWidth="0.5" opacity="0.8" />
      {[356, 374, 392, 410].map((x) => <path key={x} d={`M ${x + 4} 291 L ${x} 296 L ${x + 4} 301`} fill="none" stroke={C.accent} strokeWidth="0.6" opacity="0.6" />)}
      <Dots points={[[302, 170], [314, 170], [302, 182], [314, 182]]} r={4} />
      <Tiny x={308} y={196}>FUEL</Tiny>
      <Dots points={[[380, 176], [410, 176], [380, 206], [410, 206]]} r={2} color={C.accent} />

      {/* GREAT HALL: dais, hearth, pillars, benches */}
      <rect x={515} y={164} width={100} height={20} fill={C.hullDeep} stroke={C.accent} strokeWidth="0.6" opacity="0.7" rx="1" />
      <Tiny x={565} y={177} color={C.accent} size={4.2}>DAIS</Tiny>
      <rect x={443} y={222} width={8} height={36} fill={C.hullDeep} stroke={C.restricted} strokeWidth="0.5" opacity="0.7" />
      <Tiny x={447} y={270} size={3.2}>HEARTH</Tiny>
      <Dots points={[[472, 196], [472, 236], [472, 276], [658, 196], [658, 236], [658, 276]]} r={3.2} />
      {[276, 292, 308].map((y) => <Table key={y} x={500} y={y} w={130} h={5} />)}

      {/* STEWARD'S COUNTING ROOM: ledger shelves, desk, the loose panel */}
      <rect x={708} y={163} width={80} height={6} fill="url(#me_hatch)" stroke={C.equipLine} strokeWidth="0.4" opacity="0.8" />
      <Tiny x={748} y={176} size={3.2}>LEDGER SHELVES</Tiny>
      <Table x={720} y={280} w={70} h={14} />
      {[728, 740, 752].map((x) => <rect key={x} x={x} y={283} width={8} height={8} fill="none" stroke={C.accent} strokeWidth="0.4" opacity="0.5" />)}
      <rect x={800} y={196} width={6} height={30} fill={C.hullDeep} stroke={C.restricted} strokeWidth="0.8" strokeDasharray="2 1.5" />
      <Tiny x={796} y={206} anchor="end" color={C.restricted} size={3.3}>LOOSE PANEL</Tiny>
      <Tiny x={796} y={212} anchor="end" color={C.restricted} size={3.3}>2ND LEDGER</Tiny>

      {/* CONSERVATORY: palms, fountain, dew traps */}
      <Dots points={[[340, 412], [340, 468], [472, 412], [472, 468], [376, 380], [436, 380], [376, 500], [436, 500]]} r={4.5} color={C.accent} />
      {[[318, 440], [494, 440], [406, 372]].map(([x, y]) => <path key={x} d={`M ${x - 4} ${y + 3} L ${x} ${y - 4} L ${x + 4} ${y + 3} Z`} fill="none" stroke={C.vent} strokeWidth="0.5" opacity="0.6" />)}
      <circle cx={406} cy={482} r={8} fill="none" stroke={C.vent} strokeWidth="0.5" opacity="0.5" />

      {/* COLONNADE: paired columns and shield-door lines */}
      <Dots points={Array.from({ length: 12 }, (_, i) => 366 + i * 28).flatMap((y) => [[534, y], [566, y]])} r={2.2} />
      {[426, 612].map((y) => <line key={y} x1={530} y1={y} x2={570} y2={y} stroke={C.vent} strokeWidth="0.9" strokeDasharray="2 1.5" opacity="0.7" />)}

      {/* GUARD ROOM: weapon racks, the duty roster, route to the guard stair */}
      {[300, 330].map((x) => <rect key={x} x={x} y={538} width={24} height={6} fill="url(#me_hatch)" stroke={C.equipLine} strokeWidth="0.4" />)}
      <rect x={400} y={538} width={52} height={7} fill={C.hullDeep} stroke={C.restricted} strokeWidth="0.5" />
      <Tiny x={426} y={553} color={C.restricted} size={3.3}>ROSTER · FORGED ENTRY</Tiny>
      <Route kind="guard" d="M 520 597 L 482 618 L 322 618" />

      {/* BARRACKS: bunks */}
      {[300, 332, 364, 396, 428, 460].map((x) => <rect key={x} x={x} y={679} width={22} height={9} fill="none" stroke={C.accent} strokeWidth="0.4" opacity="0.45" rx="0.6" />)}
      {[300, 332, 428, 460].map((x) => <rect key={x} x={x} y={748} width={22} height={9} fill="none" stroke={C.accent} strokeWidth="0.4" opacity="0.45" rx="0.6" />)}

      {/* OUTER GATE: sand-lock — inner door (north), water-seal, outer double door (south) */}
      <line x1={502} y1={732} x2={598} y2={732} stroke={C.vent} strokeWidth="1" strokeDasharray="3 2" opacity="0.7" />
      <Tiny x={550} y={728} color={C.vent} size={3.3}>WATER-SEAL</Tiny>
      <rect x={526} y={809} width={48} height={6} fill={C.floor} />
      <path d="M 526 812 L 538 802 M 574 812 L 562 802" stroke={C.door} strokeWidth="0.8" opacity="0.85" />
      <Tiny x={550} y={798} color={C.door} size={3.3}>OUTER DOORS</Tiny>
      <rect x={505} y={770} width={12} height={20} fill="none" stroke={C.equipLine} strokeWidth="0.4" opacity="0.5" />
      <Tiny x={511} y={784} size={3}>LOG</Tiny>

      {/* WATER OFFICE: scales, counter and ration grille */}
      <circle cx={640} cy={700} r={7} fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.5" />
      <line x1={633} y1={700} x2={647} y2={700} stroke={C.accent} strokeWidth="0.5" opacity="0.5" />
      <Tiny x={640} y={714} size={3}>SCALES</Tiny>
      <line x1={650} y1={752} x2={790} y2={752} stroke={C.equipLine} strokeWidth="0.6" opacity="0.6" />
      {Array.from({ length: 9 }, (_, i) => 676 + i * 6).map((x) => <line key={x} x1={x} y1={756} x2={x} y2={764} stroke={C.vent} strokeWidth="0.5" opacity="0.6" />)}

      {/* KITCHENS: ovens, table, jars, servants' route to the stair */}
      {[596, 626, 656].map((x) => <rect key={x} x={x} y={364} width={22} height={14} fill="none" stroke={C.restricted} strokeWidth="0.5" opacity="0.6" rx="1" />)}
      <Tiny x={637} y={387} size={3.2}>OVENS</Tiny>
      <Table x={620} y={500} w={110} h={12} />
      <Dots points={[[760, 372], [772, 372], [784, 372], [760, 384], [772, 384]]} r={3.2} color={C.vent} />
      <Route d="M 582 448 L 606 476 L 772 476" />
      <Tiny x={690} y={472} color={C.accent} size={3.3}>SERVANTS’ ROUTE ▸</Tiny>

      {/* GUEST WING: three rooms along the north side */}
      <path d="M 655 548 L 655 588 M 733 548 L 733 588 M 578 588 L 604 588 M 628 588 L 682 588 M 706 588 L 760 588 M 784 588 L 810 588"
        stroke={C.wall} strokeWidth="3" />
      <Tiny x={616} y={574} size={4}>I</Tiny>
      <Tiny x={694} y={574} size={4}>II</Tiny>
      <Tiny x={762} y={576} size={3.6}>III · BEST</Tiny>
    </g>
  );
}

/* ─── Cistern vault decoration ───────────────────────────────────────── */
function rockUnderlay(C) {
  return (
    <g>
      <rect x="0" y="0" width={W} height={H} fill="#120c06" opacity="0.62" />
      <g opacity="0.22">
        {[120, 190, 260, 345, 430, 520, 600, 690, 770, 815].map((y, i) => (
          <path key={y} d={`M 200 ${y} Q 420 ${y + (i % 2 ? 14 : -12)} 600 ${y + 4} T 900 ${y - 6}`} fill="none" stroke={C.hullOutline} strokeWidth="0.6" />
        ))}
      </g>
    </g>
  );
}

function CisternDecor() {
  const C = useMapTheme();
  return (
    <g>
      {/* CISTERN VAULT: the main reserve pool and two settling basins */}
      <rect x={540} y={320} width={160} height={150} rx={6} fill="#123540" stroke={C.vent} strokeWidth="0.8" opacity="0.9" />
      {[340, 360, 380, 420, 440, 456].map((y, i) => <path key={y} d={`M ${552 + (i % 2) * 8} ${y} q 10 -3 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0`} fill="none" stroke={C.vent} strokeWidth="0.4" opacity="0.45" />)}
      <Tiny x={620} y={396} color={C.vent} size={5}>TOWN RESERVE</Tiny>
      <Tiny x={620} y={405} color={C.vent} size={4}>41,000 L</Tiny>
      {[[574, 566], [666, 566]].map(([x, y]) => (
        <g key={x}>
          <circle cx={x} cy={y} r={24} fill="#123540" stroke={C.vent} strokeWidth="0.7" opacity="0.9" />
          <circle cx={x} cy={y} r={14} fill="none" stroke={C.vent} strokeWidth="0.4" opacity="0.5" />
        </g>
      ))}
      <Tiny x={620} y={600} size={3.3}>SETTLING BASINS</Tiny>
      {/* where the body was found */}
      <path d="M 676 440 l 8 8 m 0 -8 l -8 8" stroke={C.restricted} strokeWidth="1.2" />
      <Tiny x={680} y={462} color={C.restricted} size={3.4}>BODY</Tiny>
      {/* glowglobes */}
      <Dots points={[[532, 312], [708, 312], [532, 688], [708, 688]]} r={2.5} color={C.accent} />
      {/* damp footprints from the servants' stair door */}
      <Dots points={[[722, 518], [716, 510], [711, 501], [706, 492], [702, 483], [698, 474]]} r={1.2} color={C.accent} />
      <Tiny x={705} y={530} anchor="end" color={C.accent} size={3.2}>DAMP PRINTS</Tiny>
      {/* routes down: servants' stair (amber), guard stair (red, logged and barred) */}
      <Route d="M 774 476 L 738 476 L 738 520 L 730 520" />
      <Route kind="guard" d="M 322 618 L 432 618 L 432 651 L 516 651 L 520 657" />
      <Tiny x={480} y={640} color={C.restricted} size={3.2}>VAULT DOOR · BARRED</Tiny>

      {/* SLUICE ROOM: filters and valves on the windtrap feed */}
      {[540, 572, 604].map((x) => <rect key={x} x={x} y={168} width={22} height={30} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.5" rx="2" />)}
      <Tiny x={583} y={208} size={3.2}>FILTERS</Tiny>
      {[[740, 270], [790, 220]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={4.5} fill="none" stroke={C.vent} strokeWidth="0.7" opacity="0.7" />)}
      <Tiny x={790} y={150 + 25} anchor="end" size={3.2}>FROM WINDTRAP ▼</Tiny>

      {/* SPICE STORE: crate bays — a third of them empty */}
      {[0, 1, 2, 3, 4, 5].flatMap((c) => [170, 190, 290, 310].map((y, r) => {
        const empty = (c + r) % 3 === 0 || (c >= 4 && r >= 2);
        return <rect key={`${c}-${y}`} x={302 + c * 34} y={y} width={26} height={13} fill={empty ? 'none' : C.hullDeep}
          stroke={empty ? C.restricted : C.equipLine} strokeWidth="0.5" strokeDasharray={empty ? '2 1.5' : undefined} opacity="0.7" />;
      }))}

      {/* ARCHIVE: shelving */}
      {[364, 380, 396, 530, 546, 562, 578].map((y) => <line key={y} x1={372} y1={y} x2={500} y2={y} stroke={C.equipLine} strokeWidth="1.6" opacity="0.35" />)}

      {/* GUARD STAIR FOOT: the empty guard post */}
      <rect x={400} y={676} width={22} height={12} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.5" />
      <Tiny x={411} y={696} size={3}>POST</Tiny>

      {/* PUMP ROOM */}
      {[560, 790].map((x) => <g key={x}><circle cx={x} cy={736} r={10} fill="none" stroke={C.vent} strokeWidth="0.6" opacity="0.6" /><circle cx={x} cy={736} r={3} fill={C.vent} opacity="0.4" /></g>)}
    </g>
  );
}

/* ─── Roof decoration ─────────────────────────────────────────────────── */
function Ornithopter({ x, y, rot = 0, wrecked = false }) {
  const C = useMapTheme();
  const col = wrecked ? C.textDim : C.accent;
  return (
    <g transform={`rotate(${rot},${x},${y})`} opacity={wrecked ? 0.75 : 0.85}>
      <ellipse cx={x} cy={y} rx={6} ry={20} fill={C.hullDeep} stroke={col} strokeWidth="0.8" />
      <ellipse cx={x} cy={y - 12} rx={3.5} ry={5} fill="none" stroke={col} strokeWidth="0.5" />
      {/* wings: front pair and rear pair */}
      <path d={`M ${x - 5} ${y - 6} L ${x - 34} ${y - 12} L ${x - 34} ${y - 7} L ${x - 5} ${y - 2} Z`} fill="none" stroke={col} strokeWidth="0.6" />
      <path d={`M ${x + 5} ${y + 2} L ${x + 34} ${y + 7} L ${x + 34} ${y + 12} L ${x + 5} ${y + 6} Z`} fill="none" stroke={col} strokeWidth="0.6" />
      {wrecked ? (
        <>
          {/* snapped wing lying apart, scorch and debris */}
          <path d={`M ${x + 12} ${y - 22} L ${x + 36} ${y - 30} L ${x + 38} ${y - 25} L ${x + 14} ${y - 17} Z`} fill="none" stroke={col} strokeWidth="0.6" strokeDasharray="2 1.5" />
          <path d={`M ${x - 5} ${y + 2} L ${x - 16} ${y + 4}`} stroke={col} strokeWidth="0.6" />
          <circle cx={x} cy={y + 4} r={16} fill="none" stroke={C.restricted} strokeWidth="0.5" strokeDasharray="1.5 2" opacity="0.6" />
        </>
      ) : (
        <>
          <path d={`M ${x + 5} ${y - 6} L ${x + 34} ${y - 12} L ${x + 34} ${y - 7} L ${x + 5} ${y - 2} Z`} fill="none" stroke={col} strokeWidth="0.6" />
          <path d={`M ${x - 5} ${y + 2} L ${x - 34} ${y + 7} L ${x - 34} ${y + 12} L ${x - 5} ${y + 6} Z`} fill="none" stroke={col} strokeWidth="0.6" />
        </>
      )}
      <line x1={x} y1={y + 20} x2={x} y2={y + 28} stroke={col} strokeWidth="0.6" />
    </g>
  );
}

function RoofDecor() {
  const C = useMapTheme();
  const merlons = [];
  for (let x = 290; x < 812; x += 14) { merlons.push([x, 128, 7, 3]); if (x < 490 || x > 606) merlons.push([x, 787, 7, 3]); }
  for (let y = 156; y < 762; y += 14) { merlons.push([262, y, 3, 7]); merlons.push([835, y, 3, 7]); }
  return (
    <g>
      {/* parapet merlons on the outer edge of the wall walks */}
      {merlons.map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} fill={C.hullOutline} opacity="0.45" />)}
      {/* THOPTER PAD: landing circle, one serviceable craft, one wreck */}
      <circle cx={405} cy={298} r={86} fill="none" stroke={C.accent} strokeWidth="0.8" strokeDasharray="6 4" opacity="0.4" />
      <Ornithopter x={372} y={214} rot={-12} />
      <Tiny x={372} y={252} color={C.accent} size={3.6}>SERVICEABLE</Tiny>
      <Ornithopter x={448} y={370} rot={28} wrecked />
      <Dots points={[[420, 400], [430, 408], [476, 396], [470, 352]]} r={1.4} color={C.restricted} />
      <Tiny x={432} y={420} color={C.restricted} size={3.6}>WRECKED</Tiny>
      {/* SHIELD GENERATOR */}
      <circle cx={340} cy={520} r={20} fill="none" stroke={C.vent} strokeWidth="0.6" strokeDasharray="2 2" opacity="0.6" />
      <circle cx={340} cy={520} r={8} fill="none" stroke={C.vent} strokeWidth="0.7" opacity="0.6" />
      <circle cx={474} cy={584} r={6} fill="none" stroke={C.vent} strokeWidth="0.7" opacity="0.6" />
      <circle cx={474} cy={584} r={16} fill="none" stroke={C.vent} strokeWidth="0.4" strokeDasharray="1.5 2" opacity="0.5" />
      {/* SIGNAL PLATFORM: heliograph mirrors and lamp */}
      {[306, 322, 338].map((x) => <rect key={x} x={x} y={744} width={10} height={4} fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.6" transform={`rotate(-20,${x + 5},746)`} />)}
      <circle cx={486} cy={650} r={5} fill="none" stroke={C.accent} strokeWidth="0.6" opacity="0.6" />
      <circle cx={486} cy={650} r={1.5} fill={C.accent} opacity="0.6" />
      {/* LADY'S SOLAR: bed, desk, window bay */}
      <rect x={598} y={176} width={36} height={24} fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.45" rx="1" />
      <Table x={740} y={288} w={50} h={12} />
      <path d="M 640 156 L 650 166 L 740 166 L 750 156" fill="none" stroke={C.vent} strokeWidth="0.6" opacity="0.5" />
      {/* WINDTRAP: condenser fins */}
      {Array.from({ length: 10 }, (_, i) => 598 + i * 14).map((x) => <line key={x} x1={x} y1={350} x2={x} y2={420} stroke={C.equipLine} strokeWidth="0.9" opacity="0.4" />)}
      {Array.from({ length: 10 }, (_, i) => 598 + i * 14).map((x) => <line key={`b${x}`} x1={x} y1={462} x2={x} y2={530} stroke={C.equipLine} strokeWidth="0.9" opacity="0.4" />)}
      {/* GUEST TERRACE: shade sails */}
      {[566, 690].map((y) => <path key={y} d={`M 594 ${y} L 700 ${y + 22} L 594 ${y + 44}`} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.35" />)}
      {[566, 690].map((y) => <path key={`e${y}`} d={`M 796 ${y} L 720 ${y + 22} L 796 ${y + 44}`} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.35" />)}
    </g>
  );
}

const Ground = () => (
  <LevelPlan rooms={keepRooms} doors={keepDoors} stairs={stairsFor('ground')} level="ground" decorate={() => <GroundDecor />} />
);
const Cistern = () => {
  const C = useMapTheme();
  return (
    <g>
      {rockUnderlay(C)}
      <LevelPlan rooms={keepRooms} doors={keepDoors} stairs={stairsFor('cistern')} level="cistern"
        conduits={CONDUITS} grates={CONDUIT_GRATES} decorate={() => <CisternDecor />} />
    </g>
  );
};
const Roof = () => (
  <LevelPlan rooms={keepRooms} doors={keepDoors} stairs={stairsFor('roof')} level="roof" decorate={() => <RoofDecor />} />
);

const routeLegend = (C) => [
  { label: 'SERVANTS’ ROUTE', draw: (y) => <line x1="0" y1={y - 1} x2="12" y2={y - 1} stroke={C.accent} strokeWidth="1.1" strokeDasharray="4 3" opacity="0.8" /> },
  { label: 'GUARD ROUTE (LOGGED)', draw: (y) => <line x1="0" y1={y - 1} x2="12" y2={y - 1} stroke={C.restricted} strokeWidth="1.1" strokeDasharray="4 3" opacity="0.8" /> },
];

export const keepConfig = {
  width: W,
  height: H,
  theme: DUNE_MAP_THEME,
  stars: { count: 0, seed: 4100 },
  backdrop: 'sand',
  levelNoun: 'FLOOR',
  scenarioTag: 'HOUSE SEAT',
  hull: { path: OUTLINE, overlays: hullOverlays },
  exteriorDetails: exterior,
  sidebar: duneSidebar({ title: 'QARRAT KEEP', subtitle: 'HOUSE TESSARIN SEAT — SHIELD WALL EDGE', tag: 'Q A R R A T' }),
  decks: [
    { id: 'G', level: 'ground', name: 'GROUND FLOOR', page: 'I', component: Ground },
    { id: 'C', level: 'cistern', name: 'CISTERN VAULT', page: 'II', component: Cistern },
    { id: 'R', level: 'roof', name: 'ROOF', page: 'III', component: Roof },
  ],
  specs: {
    title: 'KEEP SURVEY',
    y: 834,
    items: [
      ['WATER RESERVE', '41,000 L town reserve, cistern vault'],
      ['GARRISON', '14 household guards, night watch of 4'],
      ['SHIELD', 'One roof generator, overdue for service'],
      ['TO QARRAT TOWN', '1.5 km by the gate road'],
      ['WALLS', 'Rock core, plasteel facing, 4 bastions'],
    ],
  },
  legend: (C) => duneLegend(routeLegend(C))(C),
};

/** Interactive plan, registered as universe.maps[qarrat-keep].engine */
export function KeepMap() {
  return <MapEngine config={keepConfig} />;
}
KeepMap.config = keepConfig;
