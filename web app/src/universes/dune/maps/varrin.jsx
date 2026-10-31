import React from 'react';
import MapEngine, { useMapTheme } from '../../../engine/components/MapEngine';
import { LevelPlan, DUNE_MAP_THEME, duneLegend, duneSidebar, Table, Dots } from './duneMapKit.jsx';
import { W, H, OUTLINE, varrinRooms, varrinDoors, STAIRS } from './varrin.geometry.js';

/* ═══════════════════════════════════════════════════════════════════════
   THE VARRIN RESIDENCY — MapEngine plan (ground floor + upper floor & roof).
   A courtyard house round the open-air Dining Court. All rooms/doors come
   from varrin.geometry.js, which also feeds the normalized board rooms.
   ═══════════════════════════════════════════════════════════════════════ */

const T = ({ x, y, children, size = 4.2, anchor = 'middle', o = 0.75, color, rot }) => {
  const C = useMapTheme();
  return (
    <text x={x} y={y} fill={color || C.textDim} fontSize={size} textAnchor={anchor} letterSpacing="0.12em" opacity={o}
      transform={rot ? `rotate(${rot},${x},${y})` : undefined}>{children}</text>
  );
};

/* Shield shimmer across a doorway (shield-doors, the shield-gate). */
function Shimmer({ x, y, v, r = 9 }) {
  const C = useMapTheme();
  const d = v ? `M ${x} ${y - r} Q ${x + r * 0.7} ${y} ${x} ${y + r} Q ${x - r * 0.7} ${y} ${x} ${y - r}` : `M ${x - r} ${y} Q ${x} ${y + r * 0.7} ${x + r} ${y} Q ${x} ${y - r * 0.7} ${x - r} ${y}`;
  return <path d={d} fill="none" stroke={C.vent} strokeWidth="0.6" strokeDasharray="1.2 1" opacity="0.6" />;
}

function ScaleGlyph({ x, y, k = 1 }) {
  const C = useMapTheme();
  return (
    <g transform={`translate(${x},${y}) scale(${k})`} opacity="0.8" stroke={C.accent} strokeWidth="0.55" fill="none">
      <line x1={0} y1={-3.6} x2={0} y2={3.4} /><line x1={-3.4} y1={3.4} x2={3.4} y2={3.4} />
      <line x1={-4.2} y1={-2.6} x2={4.2} y2={-2.6} />
      <path d="M -5.6 0 Q -4.2 1.6 -2.8 0 Z M 2.8 0 Q 4.2 1.6 5.6 0 Z M -4.2 -2.6 L -5.6 0 M -4.2 -2.6 L -2.8 0 M 4.2 -2.6 L 2.8 0 M 4.2 -2.6 L 5.6 0" />
    </g>
  );
}

function stoneCourses(C) {
  // faint ashlar coursing across the house wall (inside the outline clip)
  return (
    <g opacity="0.14">
      {Array.from({ length: 36 }, (_, i) => 112 + i * 20).map((y) => <line key={y} x1={240} y1={y} x2={900} y2={y} stroke={C.hullOutline} strokeWidth="0.4" />)}
    </g>
  );
}

function exterior(C) {
  // spiceport road and open sand round the house; gate names outside the wall
  return (
    <g>
      <g opacity="0.45">
        {[740, 762, 790, 812].map((y, i) => <path key={y} d={`M ${262 + (i % 2) * 20} ${y} q 30 -7 60 0 t 60 0 t 60 0`} fill="none" stroke={C.equipLine} strokeWidth="0.6" />)}
        {[742, 768, 796].map((y, i) => <path key={y} d={`M ${748 + (i % 2) * 18} ${y} q 30 -7 60 0 t 60 0`} fill="none" stroke={C.equipLine} strokeWidth="0.6" />)}
      </g>
      {/* spiceport road from the shield-gate */}
      <path d="M 610 830 L 600 872 M 666 830 L 676 872" stroke={C.equipLine} strokeWidth="0.6" opacity="0.4" strokeDasharray="4 3" />
      <text x={638} y={846} fill={C.textDim} fontSize="5" textAnchor="middle" letterSpacing="0.2em">▲ SHIELD-GATE</text>
      <text x={638} y={866} fill={C.textDim} fontSize="5" textAnchor="middle" letterSpacing="0.2em" opacity="0.7">SPICEPORT ROAD</text>
      <text x={342} y={724} fill={C.textDim} fontSize="5" textAnchor="middle" letterSpacing="0.2em">▲ WATER GATE</text>
      <text x={812} y={730} fill={C.textDim} fontSize="5" textAnchor="middle" letterSpacing="0.2em" opacity="0.8">CARTHAG SPICEPORT ↘</text>
    </g>
  );
}

function GroundDecor() {
  const C = useMapTheme();
  return (
    <g>
      {/* ── Great Hall: dais, the Varrin Scale, pillars, shield-doors ── */}
      <path d="M 506 142 L 506 166 Q 558 180 610 166 L 610 142" fill="none" stroke={C.accent} strokeWidth="0.8" opacity="0.45" />
      <ScaleGlyph x={558} y={156} k={1.6} />
      <T x={558} y={176} size={3.6}>DAIS · JUDGE’S CHAIR</T>
      <Dots points={[[452, 200], [452, 280], [664, 200], [664, 280], [500, 314], [616, 314]]} r={3.2} />
      <Shimmer x={412} y={268} v /><Shimmer x={704} y={240} v /><Shimmer x={558} y={344} r={11} />
      <T x={558} y={334} size={3.4}>SHIELD-DOORS</T>

      {/* ── Guest Wing: four suites off a gallery ── */}
      <g stroke={C.equipLine} strokeWidth="0.5" fill="none" opacity="0.5">
        <rect x={278} y={142} width={100} height={52} /><rect x={278} y={194} width={100} height={54} />
        <rect x={278} y={300} width={100} height={52} /><rect x={278} y={352} width={100} height={52} />
        <line x1={384} y1={142} x2={384} y2={404} strokeDasharray="2 3" />
      </g>
      <T x={328} y={170}>GUILD ENVOY</T><T x={328} y={223}>SER ULMAR</T>
      <T x={328} y={328}>JUDGE STRENN</T><T x={328} y={380}>CHOAM FACTOR</T>
      <T x={398} y={330} rot={-90}>GALLERY</T>

      {/* ── Dining Court: awnings, long table, snooper posts, fountain, tapestry ── */}
      <g fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.35">
        <path d="M 432 348 L 566 384 L 700 348" /><path d="M 432 566 L 566 536 L 700 566" />
        {[470, 510, 550, 590, 630, 670].map((x) => <line key={x} x1={x} y1={348} x2={x + (566 - x) * 0.08} y2={360 + 22 * (1 - Math.abs(x - 566) / 134)} />)}
      </g>
      <Table x={470} y={398} w={192} h={14} />
      <Dots points={[488, 512, 536, 560, 584, 608, 632, 656].flatMap((x) => [[x - 4, 393], [x - 4, 417]])} r={1.8} />
      <circle cx={566} cy={405} r={3} fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.6" />
      <T x={566} y={425} size={3.4}>LONG TABLE · DESERT LILIES</T>
      <circle cx={566} cy={512} r={16} fill={C.vent} opacity="0.08" stroke={C.vent} strokeWidth="0.6" />
      <circle cx={566} cy={512} r={7} fill="none" stroke={C.vent} strokeWidth="0.4" opacity="0.5" />
      <T x={566} y={536} size={3.4}>FOUNTAIN</T>
      <rect x={432} y={474} width={3} height={24} fill={C.accent} opacity="0.55" />
      <T x={440} y={480} size={3.4} anchor="start">SPICEPORT</T><T x={440} y={485} size={3.4} anchor="start">TAPESTRY</T>

      {/* ── Conservatory: glass dome, palms, duelling floor, fountain basin ── */}
      <circle cx={784} cy={430} r={74} fill="none" stroke={C.vent} strokeWidth="0.5" strokeDasharray="3 3" opacity="0.4" />
      <Dots points={[[742, 336], [826, 336], [726, 400], [842, 400], [742, 528], [826, 528]]} r={4} color={C.accent} />
      <circle cx={784} cy={374} r={24} fill="none" stroke={C.textDim} strokeWidth="0.5" strokeDasharray="1.5 2" opacity="0.5" />
      <T x={784} y={376} size={3.4}>DUELLING FLOOR</T>
      <circle cx={784} cy={496} r={13} fill={C.vent} opacity="0.1" stroke={C.vent} strokeWidth="0.6" />
      <T x={784} y={518} size={3.4}>BASIN · WET STONE</T>

      {/* ── Lord’s Antechamber: guard posts, petitioners’ bench ── */}
      <Table x={724} y={268} w={60} h={8} />
      <T x={754} y={264} size={3.4}>BENCH</T>
      <Dots points={[[716, 228], [716, 252]]} r={2.2} color={C.restricted} />

      {/* ── Kitchens & yard ── */}
      {[430, 456, 482].map((y) => <rect key={y} x={278} y={y} width={14} height={14} fill="none" stroke={C.restricted} strokeWidth="0.5" opacity="0.4" />)}
      <Table x={330} y={520} w={60} h={12} />
      <Dots points={[[296, 600], [310, 606], [298, 616], [384, 670]]} r={4} color={C.vent} />
      <line x1={318} y1={700} x2={366} y2={700} stroke={C.accent} strokeWidth="2.2" opacity="0.6" />

      {/* ── Shield-Generator Vault: servant stair down, housing, emitter, niche ── */}
      {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={432} y1={612 + i * 6} x2={448} y2={612 + i * 6} stroke={C.shaft} strokeWidth="0.6" opacity="0.5" />)}
      <T x={440} y={608} size={3.2}>↓ STAIR</T>
      <rect x={474} y={656} width={52} height={30} rx={3} fill="none" stroke={C.vent} strokeWidth="0.7" opacity="0.6" />
      <circle cx={500} cy={671} r={10} fill="none" stroke={C.vent} strokeWidth="0.6" strokeDasharray="2 1.5" opacity="0.6" />
      <T x={500} y={694} size={3.2} color={C.vent}>GENERATOR · EMITTER</T>
      <rect x={540} y={658} width={18} height={26} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.6" />
      <T x={549} y={692} size={3}>NICHE</T>

      {/* ── Entry, steward, forecourt ── */}
      <circle cx={600} cy={662} r={3} fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.6" />
      <T x={600} y={674} size={3.2}>HERALD</T>
      <Shimmer x={634} y={700} r={10} />
      <Table x={730} y={660} w={50} h={14} />
      <Dots points={[[840, 584], [846, 584], [852, 584], [840, 590], [846, 590], [852, 590]]} r={1.2} color={C.accent} />
      {[580, 610, 640, 670, 700].map((x) => <line key={x} x1={x} y1={706} x2={x} y2={816} stroke={C.equipLine} strokeWidth="0.25" opacity="0.25" />)}
      <Shimmer x={638} y={828} r={18} />
    </g>
  );
}

function RoofDecor() {
  const C = useMapTheme();
  return (
    <g>
      {/* ── Open court below: void, awnings seen from above, fountain ── */}
      <rect x={428} y={344} width={260} height={226} fill={C.bg} opacity="0.85" />
      <g fill="none" stroke={C.equipLine} strokeWidth="0.6" opacity="0.4">
        <path d="M 432 348 L 558 400 L 684 348 Z" /><path d="M 432 566 L 558 520 L 684 566 Z" />
      </g>
      <circle cx={566} cy={512} r={16} fill="none" stroke={C.vent} strokeWidth="0.5" opacity="0.35" />
      <text x={558} y={456} fill={C.textDim} fontSize="6" textAnchor="middle" letterSpacing="0.25em" opacity="0.7">OPEN TO THE SKY</text>
      <text x={558} y={466} fill={C.textFaint} fontSize="4.4" textAnchor="middle" letterSpacing="0.2em">DINING COURT BELOW</text>

      {/* ── Ornithopter pad: two landing circles, beacon, the blue-striped craft ── */}
      {[214, 396].map((y) => (
        <g key={y}>
          <circle cx={342} cy={y} r={50} fill="none" stroke={C.accent} strokeWidth="0.8" strokeDasharray="6 4" opacity="0.45" />
          <text x={342} y={y + 6} fill={C.accent} fontSize="18" textAnchor="middle" opacity="0.22" style={{ fontFamily: 'var(--font-display)' }}>⊕</text>
        </g>
      ))}
      <T x={342} y={274} size={3.4}>HOUSE CRAFT ×2</T>
      <T x={342} y={456} size={3.4} color={C.vent}>ULMAR’S BLUE-STRIPED CRAFT</T>
      <circle cx={284} cy={148} r={3} fill={C.restricted} opacity="0.6" /><circle cx={284} cy={148} r={6} fill="none" stroke={C.restricted} strokeWidth="0.4" opacity="0.5" />
      <T x={292} y={160} size={3.2} anchor="start">BEACON</T>

      {/* ── Great Hall roof: the lantern of slit windows ── */}
      <rect x={490} y={196} width={136} height={72} fill="none" stroke={C.equipLine} strokeWidth="0.6" opacity="0.7" />
      {[502, 516, 530, 544, 572, 586, 600, 614].map((x) => <line key={x} x1={x} y1={200} x2={x} y2={210} stroke={C.vent} strokeWidth="0.8" opacity="0.4" />)}
      {[502, 516, 530, 544, 572, 586, 600, 614].map((x) => <line key={`b${x}`} x1={x} y1={254} x2={x} y2={264} stroke={C.vent} strokeWidth="0.8" opacity="0.4" />)}

      {/* ── Lord’s Chambers: sickbed by the window, decanter, snooper tripod ── */}
      <rect x={812} y={276} width={36} height={22} rx={2} fill="none" stroke={C.accent} strokeWidth="0.6" opacity="0.55" />
      <rect x={840} y={278} width={6} height={18} fill={C.accent} opacity="0.3" />
      <line x1={862} y1={262} x2={862} y2={316} stroke={C.vent} strokeWidth="2" opacity="0.45" />
      <T x={830} y={308} size={3.2}>SICKBED · WINDOW</T>
      <path d="M 796 282 l 3 -6 l 3 6 Z" fill="none" stroke={C.restricted} strokeWidth="0.6" opacity="0.8" />
      <T x={799} y={292} size={3} color={C.restricted}>DECANTER</T>
      <Dots points={[[730, 290], [748, 290], [766, 290]]} r={5} />
      <T x={748} y={302} size={3.2}>FILMBOOKS</T>

      {/* ── Conservatory dome ribs ── */}
      {[0, 30, 60, 90, 120, 150].map((a) => {
        const rad = (a * Math.PI) / 180;
        return <line key={a} x1={784 - Math.cos(rad) * 70} y1={452 - Math.sin(rad) * 86} x2={784 + Math.cos(rad) * 70} y2={452 + Math.sin(rad) * 86} stroke={C.vent} strokeWidth="0.4" opacity="0.3" />;
      })}
      <circle cx={784} cy={452} r={56} fill="none" stroke={C.vent} strokeWidth="0.4" opacity="0.3" />

      {/* ── Windtrap fins ── */}
      {[290, 306, 322, 338, 354, 370, 386].map((x) => <line key={x} x1={x} y1={492} x2={x} y2={570} stroke={C.equipLine} strokeWidth="0.8" opacity="0.35" />)}
      {[290, 306, 322, 338, 354, 370, 386].map((x) => <line key={`l${x}`} x1={x} y1={610} x2={x} y2={688} stroke={C.equipLine} strokeWidth="0.8" opacity="0.35" />)}

      {/* ── Forecourt below, open to the sky ── */}
      <rect x={556} y={712} width={164} height={108} fill={C.bg} opacity="0.55" />
      {[580, 610, 640, 670, 700].map((x) => <line key={x} x1={x} y1={716} x2={x} y2={816} stroke={C.equipLine} strokeWidth="0.25" opacity="0.25" />)}
      <text x={638} y={764} fill={C.textDim} fontSize="5" textAnchor="middle" letterSpacing="0.22em" opacity="0.8">FORECOURT BELOW</text>
      <text x={638} y={773} fill={C.textFaint} fontSize="4.2" textAnchor="middle" letterSpacing="0.18em">OPEN TO THE SKY</text>

      {/* ── Terrace balustrade and turret beacon ── */}
      <line x1={556} y1={696} x2={704} y2={696} stroke={C.equipLine} strokeWidth="0.6" strokeDasharray="2 2" opacity="0.5" />
      <circle cx={784} cy={660} r={14} fill="none" stroke={C.accent} strokeWidth="0.5" strokeDasharray="2 2" opacity="0.5" />
      <circle cx={784} cy={660} r={3} fill={C.accent} opacity="0.35" />
    </g>
  );
}

const Ground = () => <LevelPlan rooms={varrinRooms} doors={varrinDoors} stairs={STAIRS} level="ground" decorate={() => <GroundDecor />} />;
const Roof = () => <LevelPlan rooms={varrinRooms} doors={varrinDoors} stairs={STAIRS} level="roof" decorate={() => <RoofDecor />} />;

export const varrinConfig = {
  width: W,
  height: H,
  theme: DUNE_MAP_THEME,
  stars: { count: 0, seed: 4412 },
  backdrop: 'sand',
  levelNoun: 'FLOOR',
  scenarioTag: 'HOUSE SEAT',
  hull: { path: OUTLINE, overlays: stoneCourses },
  exteriorDetails: exterior,
  sidebar: duneSidebar({ title: 'THE VARRIN RESIDENCY', subtitle: 'HOUSE VARRIN SEAT — ABOVE THE CARTHAG SPICEPORT', tag: 'W E I G H I N G' }),
  decks: [
    { id: 'G', level: 'ground', name: 'GROUND FLOOR', page: 'I', component: Ground },
    { id: 'R', level: 'roof', name: 'UPPER FLOOR & ROOF', page: 'II', component: Roof },
  ],
  specs: {
    title: 'RESIDENCY SURVEY',
    y: 784,
    items: [
      ['FOOTPRINT', '130 × 125 m, courtyard plan'],
      ['HOUSEHOLD', 'Lord Castor, Mentat, Pell, 40 staff'],
      ['SHIELD', 'House shield; rock vault'],
      ['WATER', 'Windtrap, fountain, basin'],
      ['IN RESIDENCE', 'Guild, Ulmar, Judge, CHOAM'],
    ],
  },
  legend: duneLegend(),
};

/** Interactive plan, registered as universe.maps[varrin-residency].engine */
export function VarrinMap() {
  return <MapEngine config={varrinConfig} />;
}
/* The table board renders single levels from the same config (board/EngineLayer.jsx). */
VarrinMap.config = varrinConfig;
