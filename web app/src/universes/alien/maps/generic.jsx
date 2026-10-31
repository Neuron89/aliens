import React from 'react';
import MapEngine, { useMapTheme, purl } from '../../../engine/components/MapEngine';
import { LevelPlan, alienLegend, alienSidebar, Table, Dots, Machine } from './alienMapKit.jsx';
import {
  W, H, CX, HULL, OUTLINE, genericRooms, genericDoors, STAIRS, VENTS, VENT_GRATES,
} from './generic.geometry.js';

/* ═══════════════════════════════════════════════════════════════════════
   GENERIC COMMERCIAL VESSEL — MapEngine plan (command deck, cargo deck).
   A clean template freighter for custom scenarios. Rooms/doors come from
   generic.geometry.js, which also feeds the normalized board rooms.
   ═══════════════════════════════════════════════════════════════════════ */

const h = HULL;

/* Stairs for one level, captioned for that level. */
const stairsFor = (level) => STAIRS
  .filter((s) => s.levels.includes(level))
  .map((s) => ({ ...s, level, label: s.labels?.[level] || s.label }));

function Tiny({ x, y, children, color, anchor = 'middle', size = 3.4, rotate }) {
  const C = useMapTheme();
  return (
    <text x={x} y={y} fill={color || C.textDim} fontSize={size} textAnchor={anchor} letterSpacing="0.08em"
      transform={rotate ? `rotate(${rotate},${x},${y})` : undefined}>{children}</text>
  );
}

/* Cargo container seen from above: box with cross-bracing. */
function Container({ x, y, w, h: hh, dashed = false, color }) {
  const C = useMapTheme();
  const col = color || C.equipLine;
  return (
    <g opacity={dashed ? 0.35 : 0.65}>
      <rect x={x} y={y} width={w} height={hh} fill={dashed ? 'none' : C.hullDeep} stroke={col} strokeWidth="0.6"
        strokeDasharray={dashed ? '3 2' : undefined} />
      <path d={`M ${x} ${y} L ${x + w} ${y + hh} M ${x + w} ${y} L ${x} ${y + hh}`} stroke={col} strokeWidth="0.3" opacity="0.6" />
      {!dashed && Array.from({ length: Math.floor(w / 8) }, (_, i) => x + 4 + i * 8).map((lx) => (
        <line key={lx} x1={lx} y1={y + 1} x2={lx} y2={y + 3} stroke={col} strokeWidth="0.3" />
      ))}
    </g>
  );
}

/* Cryopod: rounded capsule with a visor. */
function Pod({ x, y, v = true }) {
  const C = useMapTheme();
  const w = v ? 12 : 26, hh = v ? 26 : 12;
  return (
    <g opacity="0.7">
      <rect x={x - w / 2} y={y - hh / 2} width={w} height={hh} rx={6} fill={C.hullDeep} stroke={C.accent} strokeWidth="0.6" />
      <rect x={x - w / 2 + 2.5} y={y - hh / 2 + 2.5} width={v ? w - 5 : 9} height={v ? 9 : hh - 5} rx={3} fill="none" stroke={C.accent} strokeWidth="0.4" opacity="0.7" />
    </g>
  );
}

function Bunk({ x, y, v = false }) {
  const C = useMapTheme();
  const w = v ? 11 : 24, hh = v ? 24 : 11;
  return (
    <g opacity="0.6">
      <rect x={x} y={y} width={w} height={hh} rx="1" fill="none" stroke={C.accent} strokeWidth="0.5" />
      <rect x={x + 1.5} y={y + 1.5} width={v ? w - 3 : 6} height={v ? 6 : hh - 3} fill={C.accent} opacity="0.35" />
    </g>
  );
}

/* Console desk with a screen strip. */
function Console({ x, y, w, hh = 6, rot = 0 }) {
  const C = useMapTheme();
  return (
    <g transform={rot ? `rotate(${rot},${x + w / 2},${y + hh / 2})` : undefined} opacity="0.75">
      <rect x={x} y={y} width={w} height={hh} rx="1" fill={C.hullDeep} stroke={C.equipLine} strokeWidth="0.5" />
      <rect x={x + 2} y={y + 1.5} width={w - 4} height={1.6} fill={C.accent} opacity="0.45" />
    </g>
  );
}

/* ─── Hull: engine nozzles & radiator fins behind the hull ────────────── */
function hullBackground(C) {
  const nozzles = [400, CX, 720];
  return (
    <g>
      {/* drive nozzles */}
      {nozzles.map((x) => (
        <g key={x}>
          <path d={`M ${x - 26} ${h.sternY - 4} L ${x - 34} ${h.sternY + 24} L ${x + 34} ${h.sternY + 24} L ${x + 26} ${h.sternY - 4} Z`}
            fill={purl('nozGrad')} stroke={C.hullDark} strokeWidth="0.6" />
          {[8, 15, 21].map((dy) => <line key={dy} x1={x - 27 - dy * 0.25} y1={h.sternY + dy} x2={x + 27 + dy * 0.25} y2={h.sternY + dy} stroke={C.hullDark} strokeWidth="0.4" opacity="0.7" />)}
        </g>
      ))}
      {/* radiator fins off the shoulders of the cargo section */}
      {[[h.aftL, -1], [h.aftR, 1]].map(([x, d]) => (
        <g key={x}>
          <path d={`M ${x} ${h.engY - 120} L ${x + d * 22} ${h.engY - 108} L ${x + d * 22} ${h.engY - 20} L ${x} ${h.engY - 8} Z`}
            fill={purl('nacGrad')} stroke={C.hullOutline} strokeWidth="0.6" />
          {[0, 16, 32, 48, 64, 80].map((dy) => <line key={dy} x1={x + d * 3} y1={h.engY - 104 + dy} x2={x + d * 19} y2={h.engY - 104 + dy} stroke={C.divider} strokeWidth="0.5" opacity="0.6" />)}
        </g>
      ))}
      <Tiny x={h.aftL - 32} y={h.engY - 64} rotate={-90} size={4.2} color={C.textFaint}>RADIATOR</Tiny>
      <Tiny x={h.aftR + 32} y={h.engY - 64} rotate={90} size={4.2} color={C.textFaint}>RADIATOR</Tiny>
    </g>
  );
}

/* Seams and frame ribs, clipped to the hull. */
function hullOverlays(C) {
  return (
    <g>
      <g opacity="0.18">
        {[150, 210, 300, 400, 470, 540, 640, 720, 800].map((y) => (
          <line key={y} x1={h.aftL - 5} y1={y} x2={h.aftR + 5} y2={y} stroke={C.hullOutline} strokeWidth="0.5" strokeDasharray="2 10" />
        ))}
      </g>
      <g opacity="0.14">
        <line x1={h.aftL + 6} y1={h.shY1 + 10} x2={h.aftL + 6} y2={h.engY - 4} stroke={C.hullOutline} strokeWidth="0.6" />
        <line x1={h.aftR - 6} y1={h.shY1 + 10} x2={h.aftR - 6} y2={h.engY - 4} stroke={C.hullOutline} strokeWidth="0.6" />
        <line x1={CX} y1={h.noseY + 2} x2={CX} y2={h.noseY + 12} stroke={C.hullOutline} strokeWidth="0.5" />
      </g>
      {/* forward viewport band across the nose */}
      {[-96, -64, -32, 0, 32, 64, 96].map((dx) => (
        <rect key={dx} x={CX + dx - 12} y={h.noseY + 3} width="24" height="5" rx="1.5" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.4" opacity="0.6" />
      ))}
    </g>
  );
}

/* Sensors, antennae, RCS, airlock hatch and docking collar on the skin. */
function exteriorDetails(C) {
  return (
    <g opacity="0.6">
      {/* sensor mast */}
      <line x1={CX} y1={h.noseY} x2={CX} y2={h.noseY - 16} stroke={C.hullOutline} strokeWidth="0.7" />
      <circle cx={CX} cy={h.noseY - 19} r="3" fill="none" stroke={C.hullOutline} strokeWidth="0.5" />
      <circle cx={CX} cy={h.noseY - 19} r="1" fill={C.hullOutline} />
      <Tiny x={CX + 9} y={h.noseY - 16} anchor="start" size={4} color={C.textFaint}>SENSOR MAST</Tiny>
      {/* comms dish on the port shoulder */}
      <line x1={h.modL} y1={h.chamY + 40} x2={h.modL - 20} y2={h.chamY + 26} stroke={C.hullOutline} strokeWidth="0.5" />
      <path d={`M ${h.modL - 30} ${h.chamY + 18} A 9 9 0 0 0 ${h.modL - 16} ${h.chamY + 34}`} fill="none" stroke={C.hullOutline} strokeWidth="0.7" />
      <Tiny x={h.modL - 26} y={h.chamY + 46} size={3.6} color={C.textFaint}>COMMS</Tiny>
      {/* RCS quads */}
      {[[h.modL, 200, -1], [h.modR, 200, 1], [h.aftL, 450, -1], [h.aftR, 450, 1], [h.engL, 800, -1], [h.engR, 800, 1]].map(([x, y, d], i) => (
        <g key={i}>
          <rect x={x + (d < 0 ? -6 : 0)} y={y - 2} width="6" height="4" fill="none" stroke={C.hullOutline} strokeWidth="0.4" rx="0.5" />
          <Tiny x={x + d * 13} y={y + 1.5} size={3} color={C.textFaint}>RCS</Tiny>
        </g>
      ))}
      {/* starboard airlock outer hatch */}
      <rect x={h.aftR} y={490} width="7" height="26" rx="1.5" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.6" />
      <Tiny x={h.aftR + 12} y={505} anchor="start" size={3.8} color={C.textFaint}>EVA HATCH · A</Tiny>
      {/* port docking collar */}
      <rect x={h.aftL - 12} y={656} width="12" height="48" rx="2" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.7" />
      <rect x={h.aftL - 9} y={662} width="6" height="36" rx="1.5" fill="none" stroke={C.hullOutline} strokeWidth="0.4" />
      <Tiny x={h.aftL - 20} y={680} rotate={-90} size={4} color={C.textFaint}>DOCKING COLLAR · B</Tiny>
      {/* tow hardpoints at the stern corners */}
      {[h.engL + 14, h.engR - 14].map((x) => (
        <g key={x}><circle cx={x} cy={h.sternY + 6} r="4" fill="none" stroke={C.hullOutline} strokeWidth="0.6" /><line x1={x} y1={h.sternY} x2={x} y2={h.sternY + 2} stroke={C.hullOutline} strokeWidth="0.6" /></g>
      ))}
      <Tiny x={h.engL + 14} y={h.sternY + 18} size={3.4} color={C.textFaint}>TOW POINT</Tiny>
      <Tiny x={h.engR - 14} y={h.sternY + 18} size={3.4} color={C.textFaint}>TOW POINT</Tiny>
    </g>
  );
}

/* ─── COMMAND DECK decoration ─────────────────────────────────────────── */
function UpperDecor() {
  const C = useMapTheme();
  return (
    <g>
      {/* BRIDGE: forward console arc, flight couches, captain's chair */}
      <path d={`M ${CX - 74} 140 Q ${CX} 124 ${CX + 74} 140`} fill="none" stroke={C.equipLine} strokeWidth="3" opacity="0.5" />
      <path d={`M ${CX - 74} 140 Q ${CX} 124 ${CX + 74} 140`} fill="none" stroke={C.accent} strokeWidth="0.6" opacity="0.5" />
      {[-44, 44].map((dx) => <g key={dx}><circle cx={CX + dx} cy={150} r="5" fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.6" /><Tiny x={CX + dx} y={162} size={3}>{dx < 0 ? 'PILOT' : 'CO-PILOT'}</Tiny></g>)}
      <circle cx={CX} cy={180} r="5.5" fill="none" stroke={C.accent} strokeWidth="0.6" opacity="0.7" />
      <Console x={466} y={170} w={26} rot={-30} />
      <Console x={628} y={170} w={26} rot={30} />
      <Tiny x={479} y={186} size={3}>COMMS</Tiny>
      <Tiny x={641} y={186} size={3}>SENSORS</Tiny>

      {/* COMPUTER CORE: server stacks and the interface terminal */}
      {[209, 221].map((y) => [400, 418, 436, 454, 472, 490].map((x) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="14" height="9" fill={C.hullDeep} stroke={C.equipLine} strokeWidth="0.4" opacity="0.8" />
      )))}
      {[400, 418, 436, 454, 472, 490].map((x) => <circle key={x} cx={x + 3} cy={213} r="0.8" fill={C.accent} opacity="0.6" />)}
      <Console x={404} y={266} w={30} />

      {/* OFFICERS QUARTERS: two cabins split by a bulkhead */}
      <path d="M 467 290 L 467 316 M 467 344 L 467 368" stroke={C.wall} strokeWidth="3" />
      <Bunk x={400} y={294} />
      <Bunk x={476} y={294} />
      <Table x={400} y={352} w={22} h={10} />
      <Table x={476} y={352} w={22} h={10} />
      <Tiny x={430} y={301} size={3} anchor="start">CAPT</Tiny>
      <Tiny x={504} y={301} size={3} anchor="start">XO</Tiny>

      {/* MED BAY: two beds, autodoc, drug locker, specimen fridge */}
      {[218, 250].map((y) => <rect key={y} x={600} y={y} width="30" height="13" rx="1.5" fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.6" />)}
      <circle cx={690} cy={330} r="16" fill="none" stroke={C.accent} strokeWidth="0.6" opacity="0.55" />
      <ellipse cx={690} cy={330} rx="6" ry="12" fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.6" />
      <Tiny x={690} y={354} size={3.2}>AUTODOC</Tiny>
      <rect x={598} y={348} width="28" height="12" fill={C.hullDeep} stroke={C.equipLine} strokeWidth="0.5" opacity="0.7" />
      <Tiny x={612} y={344} size={3}>DRUGS</Tiny>
      <rect x={592} y={298} width="14" height="20" fill={C.hullDeep} stroke={C.restricted} strokeWidth="0.5" opacity="0.7" />
      <Tiny x={599} y={326} size={3} color={C.restricted}>SPECIMENS</Tiny>

      {/* GALLEY: mess table with stools, synthesiser, lounge, window */}
      <rect x={350} y={460} width="128" height="22" rx="4" fill="none" stroke={C.equipLine} strokeWidth="0.6" opacity="0.6" />
      <Dots points={[360, 380, 400, 420, 440, 460].flatMap((x) => [[x + 4, 453], [x + 4, 489]])} r={2.6} />
      <rect x={318} y={572} width="58" height="10" fill="url(#me_hatch)" stroke={C.equipLine} strokeWidth="0.5" />
      <Tiny x={347} y={592} size={3}>SYNTHESISER</Tiny>
      <rect x={430} y={566} width="60" height="22" rx="6" fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.5" />
      <Tiny x={460} y={596} size={3}>LOUNGE</Tiny>
      <rect x={303} y={470} width="5" height="80" rx="1.5" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.5" opacity="0.7" />
      <Tiny x={322} y={510} rotate={-90} size={3}>VIEWPORT</Tiny>

      {/* SUIT LOCKERS */}
      {[594, 610, 626, 642, 658, 674].map((x) => <rect key={x} x={x} y={432} width="11" height="7" rx="2" fill="none" stroke={C.accent} strokeWidth="0.45" opacity="0.6" />)}
      {/* WASHROOM: shower, toilet, laundry */}
      <circle cx={604} cy={588} r="7" fill="none" stroke={C.vent} strokeWidth="0.5" opacity="0.6" />
      <rect x={672} y={580} width="14" height="16" rx="5" fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.5" />
      {/* AIRLOCK: inner/outer door lines, cycle panel */}
      <line x1={794} y1={482} x2={794} y2={524} stroke={C.vent} strokeWidth="1" strokeDasharray="3 2" opacity="0.7" />
      <Tiny x={789} y={541} size={3} color={C.vent}>OUTER</Tiny>
      <rect x={714} y={526} width="10" height="7" fill={C.hullDeep} stroke={C.accent} strokeWidth="0.4" opacity="0.7" />
      <Tiny x={719} y={540} size={3}>CYCLE</Tiny>

      {/* CARGO WELL: open to the cargo bay below, seen through the railing */}
      <line x1={312} y1={634} x2={808} y2={634} stroke={C.accent} strokeWidth="0.7" strokeDasharray="1 2" opacity="0.6" />
      <rect x={312} y={636} width={496} height={130} fill="#050a0c" opacity="0.5" />
      <rect x={312} y={636} width={496} height={130} fill="none" stroke={C.hullOutline} strokeWidth="0.5" strokeDasharray="5 4" opacity="0.35" />
      {[[400, 646, 70, 30], [480, 646, 70, 30], [400, 686, 70, 30], [640, 660, 56, 26], [700, 660, 56, 26], [640, 696, 56, 26]].map(([x, y, w, hh]) => (
        <Container key={`${x}-${y}`} x={x} y={y} w={w} h={hh} dashed />
      ))}
      <Tiny x={CX + 20} y={740} size={5.2}>CARGO WELL — OPEN TO DECK B</Tiny>
      <Tiny x={CX + 20} y={749} size={3.6} color={C.textFaint}>NO FLOOR · FALL HAZARD</Tiny>
      {/* ENGINE BLOCK: upper reactor housing, no access from this deck */}
      <Machine x={352} y={776} w={416} h={54} />
      <rect x={352} y={776} width={416} height={54} fill="#050a0c" opacity="0.35" />
      <circle cx={CX} cy={803} r="22" fill={C.hullDeep} stroke={C.restricted} strokeWidth="0.7" opacity="0.6" />
      <Tiny x={CX} y={805} size={4.4} color={C.text}>REACTOR HOUSING</Tiny>
      <Tiny x={CX} y={812} size={3.2} color={C.textFaint}>NO ACCESS</Tiny>
    </g>
  );
}

/* ─── CARGO DECK decoration ───────────────────────────────────────────── */
function LowerDecor() {
  const C = useMapTheme();
  return (
    <g>
      {/* CRYO CHAMBER: eight pods in two arcs, monitor console */}
      {[-84, -62, -42, 42, 62, 84].map((dx) => <Pod key={dx} x={CX + dx} y={Math.abs(dx) > 70 ? 160 : 144} />)}
      <Pod x={CX - 30} y={186} v={false} />
      <Pod x={CX + 30} y={186} v={false} />
      <Console x={CX - 14} y={130} w={28} />

      {/* CREW QUARTERS: six bunks, footlockers, pin-up board */}
      {[226, 252].map((y) => [400, 444].map((x) => <Bunk key={`${x}-${y}`} x={x} y={y} />))}
      {[340].map((y) => [400, 444].map((x) => <Bunk key={`${x}-${y}`} x={x} y={y} />))}
      {[402, 418, 434, 450, 466, 482, 498].map((x) => <rect key={x} x={x} y={329} width="12" height="6" fill="none" stroke={C.equipLine} strokeWidth="0.4" opacity="0.5" />)}
      <line x1={510} y1={226} x2={510} y2={262} stroke={C.accent} strokeWidth="1.2" opacity="0.35" />

      {/* ARMORY: wall racks and a cutting-tool bench */}
      {[228, 246, 264].map((y) => <rect key={y} x={594} y={y} width="36" height="8" fill="url(#me_hatch)" stroke={C.equipLine} strokeWidth="0.45" />)}
      {[244, 262].map((y) => <rect key={y} x={684} y={y} width="36" height="8" fill="url(#me_hatch)" stroke={C.equipLine} strokeWidth="0.45" />)}
      <Table x={640} y={346} w={70} h={12} />
      <Tiny x={612} y={284} size={3}>RIFLE · PISTOLS</Tiny>
      <Tiny x={702} y={280} size={3}>FLARES</Tiny>
      <Tiny x={675} y={366} size={3}>TOOLS BENCH</Tiny>

      {/* STORAGE: shelving aisles */}
      {[440, 470, 560, 590].map((y) => <rect key={y} x={326} y={y} width="190" height="7" fill={C.hullDeep} stroke={C.equipLine} strokeWidth="0.45" opacity="0.7" />)}
      {[440, 470, 560, 590].map((y) => [340, 380, 420, 460, 500].map((x) => <line key={`${x}-${y}`} x1={x} y1={y} x2={x} y2={y + 7} stroke={C.equipLine} strokeWidth="0.35" opacity="0.6" />))}
      <Dots points={[[340, 498], [352, 498], [496, 540], [508, 540]]} r={3.2} />

      {/* LIFE SUPPORT: scrubbers, water tanks, heat exchanger */}
      {[[624, 466], [670, 466]].map(([x, y]) => (
        <g key={x}><circle cx={x} cy={y} r="14" fill={C.hullDeep} stroke={C.shaft} strokeWidth="0.7" opacity="0.8" />
          {[0, 60, 120].map((a) => <line key={a} x1={x + Math.cos(a * Math.PI / 180) * 11} y1={y + Math.sin(a * Math.PI / 180) * 11} x2={x - Math.cos(a * Math.PI / 180) * 11} y2={y - Math.sin(a * Math.PI / 180) * 11} stroke={C.shaft} strokeWidth="0.4" opacity="0.5" />)}</g>
      ))}
      <Tiny x={647} y={490} size={3}>AIR SCRUBBERS</Tiny>
      <rect x={734} y={448} width="56" height="24" rx="10" fill="none" stroke={C.vent} strokeWidth="0.6" opacity="0.7" />
      <rect x={734} y={478} width="56" height="24" rx="10" fill="none" stroke={C.vent} strokeWidth="0.6" opacity="0.7" />
      <Tiny x={762} y={510} size={3} color={C.vent}>WATER RECLAIM</Tiny>
      <Machine x={680} y={566} w={110} h={26} label="HEAT EXCHANGER" />

      {/* DOCKING PORT: collar ring and inner hatch */}
      <circle cx={323} cy={680} r="8" fill="none" stroke={C.accent} strokeWidth="0.7" opacity="0.55" />
      <circle cx={323} cy={680} r="4" fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.5" />
      <line x1={315} y1={656} x2={315} y2={704} stroke={C.vent} strokeWidth="1" strokeDasharray="3 2" opacity="0.7" />

      {/* CARGO BAY: container stacks, loader, tie-down rails */}
      {[[404, 618, 70, 28], [404, 650, 70, 28], [478, 618, 70, 28], [404, 708, 70, 28], [478, 708, 70, 28], [650, 618, 56, 26], [650, 648, 56, 26], [710, 618, 56, 26]].map(([x, y, w, hh]) => (
        <Container key={`${x}-${y}`} x={x} y={y} w={w} h={hh} />
      ))}
      <g opacity="0.7">
        <rect x={666} y={700} width="34" height="20" rx="2" fill="none" stroke={C.accent} strokeWidth="0.6" />
        <path d="M 700 704 L 716 704 M 700 716 L 716 716" stroke={C.accent} strokeWidth="1" />
        <rect x={672} y={704} width="12" height="12" fill="none" stroke={C.accent} strokeWidth="0.4" />
      </g>
      <Tiny x={683} y={728} size={3.2}>LOADER</Tiny>
      {[740, 760, 780, 800].map((x) => <Dots key={x} points={[[x, 700], [x, 720], [x, 740]]} r={1.2} color={C.accent} />)}
      <line x1={404} y1={746} x2={630} y2={746} stroke={C.equipLine} strokeWidth="0.6" strokeDasharray="6 3" opacity="0.5" />
      <Tiny x={590} y={743} size={3} color={C.textFaint}>TIE-DOWN RAIL</Tiny>

      {/* ENGINE ROOM: reactor housing, drive control, coolant runs */}
      <circle cx={440} cy={791} r="24" fill={purl('hatch')} stroke={C.restricted} strokeWidth="0.7" opacity="0.65" />
      <circle cx={440} cy={791} r="12" fill="none" stroke={C.restricted} strokeWidth="0.5" opacity="0.5" />
      <path d="M 464 772 L 520 772 M 464 810 L 520 810 M 600 772 L 756 772 M 600 810 L 756 810 M 364 772 L 416 772 M 364 810 L 416 810" stroke={C.vent} strokeWidth="1.4" opacity="0.4" />
      <Console x={622} y={784} w={44} />
      <Tiny x={644} y={799} size={3}>DRIVE CONTROL</Tiny>
      <Console x={696} y={784} w={44} />
      <Tiny x={718} y={799} size={3}>OVERLOAD PANEL</Tiny>
      <Tiny x={440} y={824} size={3.2} color={C.restricted}>REACTOR · SHIELDED</Tiny>
    </g>
  );
}

const Upper = () => (
  <LevelPlan rooms={genericRooms} doors={genericDoors} stairs={stairsFor('upper')} level="upper"
    conduits={VENTS.upper} grates={VENT_GRATES.upper} decorate={() => <UpperDecor />} />
);
const Lower = () => (
  <LevelPlan rooms={genericRooms} doors={genericDoors} stairs={stairsFor('lower')} level="lower"
    conduits={VENTS.lower} grates={VENT_GRATES.lower} decorate={() => <LowerDecor />} />
);

const extraLegend = [
  { label: 'CARGO CONTAINER', draw: (y) => <g><rect x="0" y={y - 5} width="10" height="7" fill="none" stroke="#306858" strokeWidth="0.6" /><path d={`M 0 ${y - 5} L 10 ${y + 2} M 10 ${y - 5} L 0 ${y + 2}`} stroke="#306858" strokeWidth="0.3" /></g> },
  { label: 'CRYOPOD', draw: (y) => <rect x="2" y={y - 7} width="6" height="11" rx="3" fill="none" stroke="#50c8a8" strokeWidth="0.6" opacity="0.7" /> },
  { label: 'SEALED / LOCKED DOOR', draw: (y) => <circle cx="5" cy={y - 1} r="2" fill="none" stroke="#c04040" strokeWidth="0.7" /> },
];

export const genericConfig = {
  width: W,
  height: H,
  stars: { count: 200, seed: 2077 },
  backdrop: 'space',
  levelNoun: 'DECK',
  scenarioTag: 'CUSTOM SCENARIO',
  hull: { path: OUTLINE, background: hullBackground, overlays: hullOverlays },
  exteriorDetails,
  sidebar: alienSidebar({ title: 'GENERIC COMMERCIAL VESSEL', subtitle: 'STANDARD FREIGHT/TOW CONFIGURATION', tag: 'T E M P L A T E' }),
  decks: [
    { id: 'A', level: 'upper', name: 'COMMAND DECK', page: 'I', component: Upper },
    { id: 'B', level: 'lower', name: 'CARGO DECK', page: 'II', component: Lower },
  ],
  specs: {
    title: 'TECHNICAL SPECIFICATIONS',
    y: 830,
    items: [
      ['CLASS', '[CLASS] medium freighter / tug'],
      ['REGISTRY', '[OPERATOR] · [HULL NO.]'],
      ['CREW', '5–8 (8 cryopods)'],
      ['DECKS', '2 — command, cargo'],
      ['CARGO', '~2,000 t hold, docking collar'],
    ],
  },
  legend: alienLegend(extraLegend),
};

/** Interactive plan, registered as universe.maps[generic-starship].engine */
export function GenericMap() {
  return <MapEngine config={genericConfig} />;
}
GenericMap.config = genericConfig;
