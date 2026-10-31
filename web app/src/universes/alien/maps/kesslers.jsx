import React from 'react';
import MapEngine, { useMapTheme, registerIcon, seededRandom, Room, DEFAULT_THEME } from '../../../engine/components/MapEngine';
import { LevelPlan, alienLegend, alienSidebar, Machine } from './alienMapKit.jsx';
import { W, H, OUTLINE, kesslersRooms, BUILDING_DOORS, STAIRS, PAD1, PAD2, GATE, ADIT, DUSK } from './kesslers.geometry.js';

/* ═══════════════════════════════════════════════════════════════════════
   KESSLER’S LANDING — HUB — MapEngine plan (one outdoor level).
   Tidally locked world: night (storms) to the west, day (glare) to the
   east, the dusk line between them drawn as a tonal split of the ground.
   The hull outline is the colony perimeter; rooms/doors come from
   kesslers.geometry.js; zones (hab yard, landing field, fuel farm, the
   Seam 9 adit) are drawn here.
   ═══════════════════════════════════════════════════════════════════════ */

const T = DEFAULT_THEME;
const NIGHT = '#040b09', DUSKC = '#0a1915', DAY = '#11291f', GLARE = '#173a30';
const APRON = '#18372f', YARD = '#0d1f1a', ROCK = '#0f1c18';

registerIcon('kesslers-dish', (x, y, C) => (
  <g opacity="0.7" fill="none" stroke={C.accent} strokeWidth="0.6"><path d={`M ${x - 3.8} ${y - 1} A 3.8 2.4 0 0 0 ${x + 3.8} ${y - 1}`} /><line x1={x} y1={y - 1} x2={x + 2} y2={y - 3.6} /><line x1={x} y1={y + 1.4} x2={x} y2={y + 3.8} /><line x1={x - 2.4} y1={y + 3.8} x2={x + 2.4} y2={y + 3.8} /></g>
));

const duskD = `M ${DUSK.map((p) => p.join(' ')).join(' L ')}`;
const nightD = `M 190 90 L ${DUSK.map((p) => p.join(' ')).join(' L ')} L 490 880 L 190 880 Z`;

/* ─── Ground ─────────────────────────────────────────────────────────── */

function windStreaks(C) {
  const rng = seededRandom(4171);
  const out = [];
  for (let i = 0; i < 90; i++) {
    const x = 214 + rng() * 260, y = 106 + rng() * 750, l = 6 + rng() * 18;
    out.push(<line key={i} x1={x} y1={y} x2={x + l} y2={y + l * 0.08} stroke={C.vent} strokeWidth="0.45" opacity={0.12 + rng() * 0.16} />);
  }
  return <g>{out}</g>;
}

function gravel(C) {
  const rng = seededRandom(919);
  return (
    <g>{Array.from({ length: 220 }, (_, i) => {
      const x = 480 + rng() * 530, y = 104 + rng() * 754;
      return <circle key={i} cx={x} cy={y} r={0.4 + rng() * 0.9} fill={C.equipLine} opacity={0.18 + rng() * 0.2} />;
    })}</g>
  );
}

function shimmer(x0, y0, w, rows, C, seed) {
  const rng = seededRandom(seed);
  return (
    <g fill="none" stroke={C.accent} strokeWidth="0.45">
      {Array.from({ length: rows }, (_, i) => {
        const y = y0 + i * 9, ph = rng() * 6;
        let d = `M ${x0} ${y}`;
        for (let x = x0 + 6; x <= x0 + w; x += 6) d += ` L ${x} ${(y + Math.sin(x / 7 + ph) * 1.4).toFixed(1)}`;
        return <path key={i} d={d} opacity={0.12 + (i % 2) * 0.06} />;
      })}
    </g>
  );
}

/* West edge: the rock wall the mine is cut into. */
const ROCK_PTS = [[190, 92], [262, 100], [286, 146], [276, 206], [292, 262], [296, 318], [300, 340], [300, 372], [292, 412], [282, 468], [294, 524], [280, 600], [294, 676], [284, 752], [292, 820], [270, 880], [190, 880]];
const ROCK_D = `M ${ROCK_PTS.map((p) => p.join(' ')).join(' L ')} Z`;

function rock(C) {
  return (
    <g>
      <defs><clipPath id="kl-rock-clip"><path d={ROCK_D} /></clipPath></defs>
      <path d={ROCK_D} fill={ROCK} stroke={C.hullOutline} strokeWidth="1" />
      <path d={ROCK_D} fill="none" stroke={C.hullBright} strokeWidth="3" opacity="0.12" transform="translate(1.5,0)" />
      <g clipPath="url(#kl-rock-clip)" fill="none" stroke={C.hullOutline} strokeWidth="0.55" opacity="0.3">
        {[130, 176, 230, 288, 430, 492, 556, 618, 684, 744, 806].map((y, i) => <path key={y} d={`M 190 ${y} Q 240 ${y + (i % 2 ? 9 : -7)} 300 ${y + 5}`} />)}
      </g>
      {[[300, 300, 4], [298, 420, 3.5], [292, 560, 4], [300, 640, 3], [296, 786, 4.5], [288, 168, 3.5]].map(([x, y, r], i) => (
        <path key={i} d={`M ${x - r} ${y} L ${x - r * 0.4} ${y - r * 0.9} L ${x + r * 0.8} ${y - r * 0.5} L ${x + r} ${y + r * 0.4} L ${x} ${y + r * 0.8} Z`} fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.5" />
      ))}
    </g>
  );
}

/* Seam 9: the adit from the cage lift west into the rock and off the map. */
function adit(C) {
  const y = ADIT.y;
  const tunnel = `M 302 ${y - 11} L 262 ${y - 12} Q 236 ${y - 14} 190 ${y - 8} L 190 ${y + 12} Q 236 ${y + 8} 262 ${y + 12} L 302 ${y + 11} Z`;
  return (
    <g>
      <path d={tunnel} fill={C.bg} stroke={C.hullOutline} strokeWidth="0.8" />
      {/* rails and sleepers */}
      <path d={`M 300 ${y - 3} L 262 ${y - 4} Q 236 ${y - 6} 190 ${y}`} fill="none" stroke={C.equipLine} strokeWidth="0.6" opacity="0.8" />
      <path d={`M 300 ${y + 3} L 262 ${y + 4} Q 236 ${y + 1} 190 ${y + 5}`} fill="none" stroke={C.equipLine} strokeWidth="0.6" opacity="0.8" />
      {Array.from({ length: 14 }, (_, i) => 196 + i * 7.5).map((x) => <line key={x} x1={x} y1={y - 6} x2={x} y2={y + 7} stroke={C.equipLine} strokeWidth="0.5" opacity="0.4" />)}
      {/* dead lamps, condensation */}
      {[214, 244, 274].map((x) => <circle key={x} cx={x} cy={y - 9} r="1.3" fill="none" stroke={C.textDim} strokeWidth="0.4" />)}
      {[[226, y + 9], [252, y + 9], [206, y + 8]].map(([x, yy], i) => <circle key={i} cx={x} cy={yy} r="0.8" fill={C.vent} opacity="0.6" />)}
      {/* portal timbers */}
      <path d={`M 296 ${y - 14} L 296 ${y + 14} M 291 ${y - 14} L 291 ${y + 14}`} stroke={C.hullBright} strokeWidth="1.2" opacity="0.6" />
      <line x1={288} y1={y - 15} x2={300} y2={y - 15} stroke={C.hullBright} strokeWidth="1.4" opacity="0.6" />
    </g>
  );
}

/* Admin block: a ceramcrete bunker with storm shutters round the rooms. */
function adminShell(C) {
  const ticks = [];
  for (let x = 498; x < 726; x += 10) ticks.push(<line key={`n${x}`} x1={x} y1={133} x2={x} y2={139} />);
  for (let y = 146; y < 336; y += 10) { ticks.push(<line key={`w${y}`} x1={493} y1={y} x2={499} y2={y} />); ticks.push(<line key={`e${y}`} x1={721} y1={y} x2={727} y2={y} />); }
  return (
    <g>
      <rect x="488" y="128" width="244" height="218" rx="3" fill={C.hullDeep} opacity="0.7" />
      <rect x="492" y="132" width="236" height="210" rx="2" fill={C.hullMid} stroke={C.hullOutline} strokeWidth="1.1" />
      <g stroke={C.hullDark} strokeWidth="0.7" opacity="0.9">{ticks}</g>
    </g>
  );
}

/* Hab yard and the four stacked towers. */
function habStacks() {
  const stacks = [['STACK A', 306, 500], ['STACK B', 390, 500], ['STACK C', 306, 624], ['STACK D', 390, 624]];
  return (
    <g>
      <rect x="300" y="490" width="160" height="240" fill={YARD} stroke={T.equipLine} strokeWidth="0.6" strokeDasharray="3 2" />
      <rect x="370" y="490" width="20" height="240" fill={T.floor} opacity="0.6" />
      <rect x="300" y="598" width="160" height="26" fill={T.floor} opacity="0.6" />
      {stacks.map(([n, x, y]) => <Room key={n} x={x} y={y} w={64} h={98} label={n} sub="4 FLOORS" crew labelSize={5.2} />)}
      {/* floor plates of each stack */}
      {stacks.map(([n, x, y]) => [0.25, 0.75].map((f) => <line key={n + f} x1={x + 5} y1={y + 98 * f} x2={x + 59} y2={y + 98 * f} stroke={T.divider} strokeWidth="0.5" opacity="0.6" />))}
      {/* stack D down to the chapel bunker */}
      <rect x="414" y="721" width="14" height="10" fill={T.floor} stroke={T.wall} strokeWidth="1" />
    </g>
  );
}

/* Landing field: ceramcrete apron, fence, two pads, the Wren's Due. */
function padRing({ x, y, r }, C) {
  const lights = Array.from({ length: 16 }, (_, i) => [x + Math.cos(i / 16 * 6.283) * (r + 4), y + Math.sin(i / 16 * 6.283) * (r + 4)]);
  return (
    <g>
      <circle cx={x} cy={y} r={r + 10} fill={C.hullDeep} opacity="0.35" />
      <circle cx={x} cy={y} r={r} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="1" />
      <circle cx={x} cy={y} r={r - 6} fill="none" stroke={C.door} strokeWidth="0.8" strokeDasharray="5 3" opacity="0.7" />
      <circle cx={x} cy={y} r={r * 0.45} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.6" />
      {lights.map(([lx, ly], i) => <circle key={i} cx={lx} cy={ly} r="0.9" fill={C.door} opacity="0.65" />)}
    </g>
  );
}

function wrensDue({ x, y }, C) {
  return (
    <g transform={`translate(${x},${y + 4}) rotate(-24)`}>
      {/* swept wings, frosted */}
      <path d="M 0 -30 L 7 -12 L 30 10 L 30 18 L 8 12 L 6 22 L -6 22 L -8 12 L -30 18 L -30 10 L -7 -12 Z" fill={C.hullMid} stroke={C.hullOutline} strokeWidth="0.9" />
      <path d="M 0 -30 L 4 -18 L -4 -18 Z" fill="#16252a" stroke={C.vent} strokeWidth="0.5" />
      <line x1="0" y1="-18" x2="0" y2="20" stroke={C.hullDark} strokeWidth="0.8" />
      {[-5, 5].map((dx) => <rect key={dx} x={dx - 2.5} y={20} width="5" height="5" rx="1" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.5" />)}
      <path d="M -26 12 L -14 9 M 26 12 L 14 9" stroke={C.textBright} strokeWidth="0.4" opacity="0.5" />
    </g>
  );
}

function landingField(C) {
  const apron = 'M 752 346 L 1000 346 L 1000 604 L 988 616 L 752 616 L 744 606 L 744 354 Z';
  const grid = [];
  for (let x = 772; x < 1000; x += 28) grid.push(<line key={`x${x}`} x1={x} y1={348} x2={x} y2={614} />);
  for (let y = 374; y < 616; y += 28) grid.push(<line key={`y${y}`} x1={746} y1={y} x2={998} y2={y} />);
  return (
    <g>
      <path d={apron} fill={APRON} stroke={C.hullOutline} strokeWidth="0.8" />
      <g stroke={C.equipLine} strokeWidth="0.35" opacity="0.35">{grid}</g>
      {/* blast scorch */}
      <circle cx={PAD2.x} cy={PAD2.y} r={PAD2.r + 22} fill={C.bg} opacity="0.25" />
      {padRing(PAD1, C)}
      {padRing(PAD2, C)}
      <text x={PAD1.x} y={PAD1.y + 6} fill={C.textFaint} fontSize="20" textAnchor="middle" fontWeight="bold" style={{ fontFamily: 'var(--font-display)' }}>1</text>
      {wrensDue(PAD2, C)}
      {/* fence with the pad gate */}
      <path d={`M 744 ${GATE.y - 8} L 744 354 L 752 346 L 1000 346 L 1000 604 L 988 616 L 752 616 L 744 606 L 744 ${GATE.y + 8}`} fill="none" stroke={C.accent} strokeWidth="0.6" strokeDasharray="1 2.5" opacity="0.7" />
      <path d={`M 744 ${GATE.y - 8} l 6 -3 M 744 ${GATE.y + 8} l 6 3`} stroke={C.door} strokeWidth="0.8" opacity="0.8" />
      {/* taxi lines */}
      <path d={`M 748 ${GATE.y} L 800 ${GATE.y} Q 860 ${GATE.y} ${PAD2.x - PAD2.r} ${PAD2.y - 10}`} fill="none" stroke={C.door} strokeWidth="0.6" strokeDasharray="6 4" opacity="0.45" />
      <path d={`M 800 ${GATE.y} L ${PAD1.x - 10} ${PAD1.y + PAD1.r}`} fill="none" stroke={C.door} strokeWidth="0.6" strokeDasharray="6 4" opacity="0.45" />
    </g>
  );
}

/* Fuel farm and tower: bunded tanks, the gantry, the glass tower. */
function fuelFarm(C) {
  const tanks = [[786, 174], [816, 174], [846, 174], [846, 206]];
  return (
    <g>
      <rect x="762" y="144" width="114" height="182" rx="2" fill={APRON} opacity="0.75" />
      <rect x="770" y="156" width="96" height="66" rx="2" fill="none" stroke={C.restricted} strokeWidth="0.5" strokeDasharray="3 2" opacity="0.45" />
      {tanks.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="12" fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.8" />
          <circle cx={x} cy={y} r="7" fill="none" stroke={C.equipLine} strokeWidth="0.5" />
          <circle cx={x} cy={y} r="1.5" fill={C.accent} opacity="0.5" />
        </g>
      ))}
      {/* fuel gantry down to the pads */}
      <path d="M 856 218 L 862 218 L 862 380 L 856 380 Z" fill="none" stroke={C.equipLine} strokeWidth="0.6" />
      {Array.from({ length: 13 }, (_, i) => 224 + i * 12).map((y) => <line key={y} x1={856} y1={y} x2={862} y2={y + 6} stroke={C.equipLine} strokeWidth="0.4" opacity="0.7" />)}
      <path d={`M 859 380 Q 859 ${PAD1.y - 10} ${PAD1.x + PAD1.r - 4} ${PAD1.y - 14}`} fill="none" stroke={C.accent} strokeWidth="0.8" opacity="0.5" />
      {/* tower stair down to the apron */}
      {[318, 322, 326, 330, 334, 338].map((y) => <line key={y} x1={802} y1={y} x2={814} y2={y} stroke={C.door} strokeWidth="0.5" opacity="0.6" />)}
      {/* Probity targeting radar painting the farm */}
      <g fill="none" stroke={C.restricted} strokeWidth="0.6" opacity="0.4">
        {[26, 42, 58].map((r) => <circle key={r} cx={816} cy={250} r={r} strokeDasharray="2 5" />)}
        <path d="M 816 186 L 816 196 M 816 304 L 816 314 M 752 250 L 762 250 M 870 250 L 880 250" />
      </g>
    </g>
  );
}

/* Ore processor: stacks outside, heat haze. */
function processorOutside(C) {
  return (
    <g>
      {[[330, 160, 7], [354, 157, 6], [418, 160, 5]].map(([x, y, r]) => (
        <g key={x}><circle cx={x} cy={y} r={r} fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.7" /><circle cx={x} cy={y} r={r * 0.5} fill={C.bg} /></g>
      ))}
      {shimmer(318, 116, 110, 4, C, 31)}
    </g>
  );
}

/* Hauler yard east of Wing C. */
function haulers(C) {
  const hauler = (x, y, rot) => (
    <g transform={`rotate(${rot},${x + 12},${y + 20})`}>
      <rect x={x} y={y} width="24" height="40" rx="2" fill={C.hullMid} stroke={C.hullOutline} strokeWidth="0.7" />
      <rect x={x + 3} y={y + 3} width="18" height="10" fill="#16252a" stroke={C.vent} strokeWidth="0.4" />
      <rect x={x + 3} y={y + 16} width="18" height="21" fill={C.hullDark} />
      {[y + 6, y + 30].map((wy) => <g key={wy}><rect x={x - 3} y={wy} width="3" height="8" fill={C.hullDeep} /><rect x={x + 24} y={wy} width="3" height="8" fill={C.hullDeep} /></g>)}
    </g>
  );
  return <g>{hauler(708, 512, 0)}{hauler(712, 590, 8)}</g>;
}

function hullGround(C) {
  return (
    <g>
      <rect x="0" y="0" width={W} height={H} fill={DAY} />
      {Array.from({ length: 26 }, (_, i) => <rect key={i} x={520 + i * 20} y="0" width="20.5" height={H} fill={GLARE} opacity={((i + 1) / 26) * 0.95} />)}
      <path d={nightD} fill={DUSKC} transform="translate(26,0)" />
      <path d={nightD} fill={NIGHT} opacity="0.75" transform="translate(10,0)" />
      <path d={nightD} fill={NIGHT} />
      <path d={duskD} fill="none" stroke={C.accent} strokeWidth="26" opacity="0.05" />
      {gravel(C)}
      {windStreaks(C)}
      {shimmer(900, 640, 100, 14, C, 77)}
      {shimmer(770, 806, 180, 5, C, 78)}
      {rock(C)}
      {adit(C)}
      {processorOutside(C)}
      {adminShell(C)}
      {habStacks()}
      {landingField(C)}
      {fuelFarm(C)}
      {haulers(C)}
      <path d={duskD} fill="none" stroke={C.accent} strokeWidth="0.9" strokeDasharray="7 4" opacity="0.6" />
    </g>
  );
}

/* ─── Labels and interiors ───────────────────────────────────────────── */

function ZoneLabel({ x, y, label, sub, size = 7, anchor = 'middle', rotate, color }) {
  const C = useMapTheme();
  return (
    <g transform={rotate ? `rotate(${rotate},${x},${y})` : undefined} pointerEvents="none">
      <text x={x} y={y} fill={color || C.text} fontSize={size} textAnchor={anchor} letterSpacing="0.2em" style={{ fontFamily: 'var(--font-display)' }}>{label}</text>
      {sub && <text x={x} y={y + 8} fill={C.textDim} fontSize="4.6" textAnchor={anchor} letterSpacing="0.12em">{sub}</text>}
    </g>
  );
}

function Tag({ x, y, children, color, anchor = 'middle', size = 4.4, rotate }) {
  const C = useMapTheme();
  return <text x={x} y={y} fill={color || C.textDim} fontSize={size} textAnchor={anchor} letterSpacing="0.14em" pointerEvents="none"
    transform={rotate ? `rotate(${rotate},${x},${y})` : undefined}>{children}</text>;
}

function Interiors() {
  const C = useMapTheme();
  const line = { fill: 'none', stroke: C.equipLine, strokeWidth: 0.6, opacity: 0.6 };
  const bed = (x, y, v = true, k) => <rect key={k} x={x} y={y} width={v ? 8 : 12} height={v ? 12 : 8} rx="1" {...line} />;
  return (
    <g pointerEvents="none">
      {/* ── ore processor: smelter, conveyors, cage lift, power plant ── */}
      <circle cx={368} cy={228} r={32} fill={C.hullDeep} stroke={C.equipLine} strokeWidth="0.8" opacity="0.9" />
      <circle cx={368} cy={228} r={20} fill="none" stroke={C.restricted} strokeWidth="0.7" opacity="0.55" />
      <circle cx={368} cy={228} r={9} fill={C.restricted} opacity="0.18" />
      <Tag x={368} y={268} color={C.text}>SMELTER</Tag>
      <rect x={420} y={204} width={26} height={22} fill="none" stroke={C.equipLine} strokeWidth="0.6" opacity="0.7" />
      <path d="M 420 204 L 433 216 L 446 204" fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.7" />
      <Tag x={433} y={200}>HOPPER</Tag>
      {/* conveyor: cage lift → east → north → hopper */}
      <g>
        <path d="M 342 350 L 440 350 L 440 228 M 342 360 L 450 360 L 450 228" fill="none" stroke={C.hullOutline} strokeWidth="0.7" opacity="0.8" />
        {Array.from({ length: 16 }, (_, i) => 346 + i * 6).map((x) => <line key={x} x1={x} y1={351} x2={x} y2={359} stroke={C.equipLine} strokeWidth="0.5" opacity="0.6" />)}
        {Array.from({ length: 21 }, (_, i) => 232 + i * 6).map((y) => <line key={y} x1={441} y1={y} x2={449} y2={y} stroke={C.equipLine} strokeWidth="0.5" opacity="0.6" />)}
        <path d="M 400 355 l -4 -2.5 M 400 355 l -4 2.5 M 445 290 l -2.5 4 M 445 290 l 2.5 4" stroke={C.accent} strokeWidth="0.6" opacity="0.7" />
      </g>
      {/* cage lift beside the adit door */}
      <rect x={308} y={340} width={30} height={30} fill={C.hullDeep} stroke={C.shaft} strokeWidth="0.9" rx="1" />
      <path d="M 311 343 L 335 367 M 335 343 L 311 367" stroke={C.shaft} strokeWidth="0.5" opacity="0.8" />
      <Tag x={323} y={378} color={C.text}>CAGE LIFT</Tag>
      <Machine x={312} y={398} w={56} h={44} label="POWER PLANT" />
      <circle cx={340} cy={420} r={9} fill="none" stroke={C.equipLine} strokeWidth="0.6" opacity="0.7" />
      <Machine x={384} y={388} w={40} h={26} label="CRUSHER" />
      {[[426, 440], [446, 440]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={7} fill="none" stroke={C.equipLine} strokeWidth="0.6" opacity="0.6" />)}

      {/* ── ops center ── */}
      <rect x={505} y={146} width={11} height={30} fill="none" stroke={C.accent} strokeWidth="0.6" opacity="0.7" />
      {[152, 158, 164, 170].map((y) => <line key={y} x1={507} y1={y} x2={514} y2={y} stroke={C.accent} strokeWidth="0.4" opacity="0.6" />)}
      <path d="M 520 214 Q 560 200 600 214" {...line} />
      {[532, 548, 572, 588].map((x) => <rect key={x} x={x - 5} y={204} width={10} height={6} {...line} />)}

      {/* ── uplink mast: lattice foot, dish, roof-hatch ladder ── */}
      <rect x={628} y={148} width={16} height={16} {...line} />
      <path d="M 628 148 L 644 164 M 644 148 L 628 164" {...line} />
      <ellipse cx={666} cy={157} rx={10} ry={7} fill="none" stroke={C.accent} strokeWidth="0.7" opacity="0.65" />
      <line x1={666} y1={157} x2={674} y2={150} stroke={C.accent} strokeWidth="0.5" opacity="0.65" />
      <rect x={690} y={198} width={10} height={20} fill="none" stroke={C.shaft} strokeWidth="0.6" opacity="0.7" />
      {[203, 208, 213].map((y) => <line key={y} x1={690} y1={y} x2={700} y2={y} stroke={C.shaft} strokeWidth="0.4" opacity="0.6" />)}

      {/* ── brig: four cells ── */}
      {[[504, 250], [524, 250], [504, 312], [524, 312]].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width={18} height={17} {...line} />
          <line x1={x} y1={y === 250 ? y + 17 : y} x2={x + 18} y2={y === 250 ? y + 17 : y} stroke={C.restricted} strokeWidth="0.6" strokeDasharray="1 1.2" opacity="0.7" />
        </g>
      ))}

      {/* ── hardened shelter: bunk rows ── */}
      {[612, 628, 644, 660, 676].map((x) => bed(x, 252, true, `t${x}`))}
      {[612, 628, 644, 660, 676, 692].map((x) => bed(x, 316, true, `b${x}`))}

      {/* ── clinic ward and lab ── */}
      {[504, 518, 532, 546, 560, 574].map((x) => bed(x, 496, true, `w${x}`))}
      {[512, 528, 544].map((y) => bed(504, y, false, `l${y}`))}
      {[556, 570, 584].map((x) => bed(x, 582, true, `s${x}`))}
      <rect x={616} y={512} width={8} height={70} {...line} />
      <circle cx={608} cy={572} r={4.5} {...line} />
      <Tag x={606} y={590} size={3.4}>LAB</Tag>

      {/* ── wing C: pods, the burst patient, the drain, the chain ── */}
      <rect x={638} y={514} width={10} height={22} rx="4" {...line} />
      <rect x={652} y={514} width={10} height={22} rx="4" fill="none" stroke={C.restricted} strokeWidth="0.6" strokeDasharray="2 1.5" opacity="0.7" />
      <rect x={676} y={572} width={14} height={9} rx="1" {...line} />
      <path d="M 683 576 l 6 -6 M 683 576 l 7 3 M 683 576 l -2 8" stroke={C.restricted} strokeWidth="0.6" opacity="0.7" />
      <circle cx={648} cy={584} r={4} fill={C.bg} stroke={C.restricted} strokeWidth="0.7" opacity="0.85" />
      <path d="M 644 584 l -4 3 M 652 584 l 4 3 M 648 588 l 0 5" stroke={C.restricted} strokeWidth="0.4" opacity="0.7" />
      <Tag x={648} y={596} size={3.4} color={C.restricted}>DRAIN</Tag>
      <line x1={642} y1={497.5} x2={690} y2={497.5} stroke={C.bg} strokeWidth="2" />
      {[540, 544, 548, 552].map((y) => <ellipse key={y} cx={627} cy={y} rx={1.4} ry={2} fill="none" stroke={C.restricted} strokeWidth="0.5" opacity="0.8" />)}

      {/* ── morgue ── */}
      {[608, 620, 632, 644, 656, 668].map((y) => <rect key={y} x={504} y={y} width={11} height={9} {...line} />)}
      {[[552, 662], [564, 670]].map(([x, y]) => <rect key={x} x={x} y={y} width={10} height={10} fill="none" stroke={C.restricted} strokeWidth="0.5" strokeDasharray="1.5 1.5" opacity="0.7" />)}

      {/* ── union hall: pallet stage, bar, lockers, photo wall, strike fund ── */}
      {Array.from({ length: 10 }, (_, i) => [800 + (i % 5) * 22, 648 + Math.floor(i / 5) * 12]).map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width={20} height={10} {...line} />)}
      <Tag x={855} y={682}>PALLET STAGE</Tag>
      <path d="M 938 664 L 930 664 L 930 772 L 938 772" {...line} />
      {[676, 690, 704, 718, 732, 746, 760].map((y) => <circle key={y} cx={924} cy={y} r={2} {...line} />)}
      {Array.from({ length: 8 }, (_, i) => 692 + i * 10).map((y) => <rect key={y} x={765} y={y} width={7} height={8} {...line} />)}
      {[[808, 748], [852, 760], [886, 742]].map(([x, y]) => <g key={x}><circle cx={x} cy={y} r={6} {...line} />{[0, 1, 2, 3].map((k) => <circle key={k} cx={x + Math.cos(k * 1.57) * 9} cy={y + Math.sin(k * 1.57) * 9} r={1.4} {...line} />)}</g>)}
      {Array.from({ length: 14 }, (_, i) => 790 + i * 9).map((x) => <rect key={x} x={x} y={781} width={6} height={4} fill="none" stroke={C.textDim} strokeWidth="0.4" opacity="0.7" />)}
      <Tag x={850} y={778} size={3.4}>WALL OF THE DEAD</Tag>
      <circle cx={910} cy={770} r={3} fill="none" stroke={C.accent} strokeWidth="0.6" opacity="0.8" />

      {/* ── chapel: pews, candles, undercroft trapdoor ── */}
      {[742, 750, 758].map((y) => <line key={y} x1={378} y1={y} x2={398} y2={y} {...line} />)}
      {[[440, 742], [446, 746], [436, 748]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={0.9} fill={C.accent} opacity="0.7" />)}
      <rect x={438} y={790} width={14} height={12} fill="none" stroke={C.restricted} strokeWidth="0.6" strokeDasharray="2 1.5" opacity="0.75" />
      <path d="M 438 790 L 452 802 M 452 790 L 438 802" stroke={C.restricted} strokeWidth="0.4" opacity="0.6" />

      {/* ── sundowner, pump house, water tower ── */}
      <path d="M 600 776 L 690 776" stroke={C.equipLine} strokeWidth="2" opacity="0.5" />
      {[608, 622, 636, 650, 664, 678].map((x) => <circle key={x} cx={x} cy={770} r={1.8} {...line} />)}
      {[[606, 722], [684, 722]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={5} {...line} />)}
      {[[480, 754], [494, 754]].map(([x, y]) => <g key={x}><circle cx={x} cy={y} r={5} {...line} /><circle cx={x} cy={y} r={1.5} fill={C.vent} opacity="0.6" /></g>)}
      <circle cx={515} cy={800} r={18} fill="none" stroke={C.vent} strokeWidth="0.6" strokeDasharray="3 2" opacity="0.6" />
    </g>
  );
}

function Labels() {
  const C = useMapTheme();
  return (
    <g pointerEvents="none">
      <ZoneLabel x={610} y={123} label="ADMIN BLOCK" sub={null} size={6.4} />
      <Tag x={725} y={124} anchor="end" size={3.6}>STORM SHUTTERS</Tag>
      <ZoneLabel x={380} y={613} label="HAB STACKS A–D" size={5.6} />
      <ZoneLabel x={262} y={333} label="SEAM 9 DRIFT" size={5.6} />
      <Tag x={258} y={381} color={C.restricted}>◀ 2 KM · SEALED</Tag>
      <Tag x={253} y={389} size={3.6}>EGG SACS AT THE END</Tag>
      <ZoneLabel x={895} y={360} label="LANDING PAD — PADS 1 AND 2" size={5.6} />
      <Tag x={PAD1.x} y={PAD1.y + PAD1.r + 10} color={C.text}>PAD 1 · EMPTY</Tag>
      <Tag x={PAD1.x} y={PAD1.y + PAD1.r + 17} size={3.6}>SINCE THE HALE LEFT</Tag>
      <Tag x={PAD2.x} y={PAD2.y + PAD2.r + 12} color={C.text}>PAD 2 · WREN’S DUE</Tag>
      <Tag x={PAD2.x} y={PAD2.y + PAD2.r + 19} size={3.6}>12 SEATS · 8 MIN WARM-UP</Tag>
      <Tag x={GATE.x + 8} y={GATE.y - 12} color={C.door} anchor="start">PAD GATE</Tag>
      <Room x={760} y={212} w={58} h={48} label="TOWER" sub="TAPE LOGS" crew labelSize={5} />
      <Tag x={816} y={153} color={C.text} size={4}>FUEL FARM</Tag>
      <Tag x={866} y={300} rotate={-90} size={3.6}>FUEL GANTRY</Tag>
      <ZoneLabel x={806} y={280} label="LANDING PAD —" size={4.4} />
      <ZoneLabel x={806} y={288} label="FUEL FARM AND TOWER" size={4.4} />
      <Tag x={772} y={306} anchor="start" color={C.restricted} size={3.4}>PROBITY RADAR PAINT</Tag>
      <Tag x={590} y={440} rotate={-90} size={3.8} color={C.text}>HEATED · 300 M</Tag>
      <Tag x={470} y={566} rotate={-90} size={3.6} color={C.vent}>DUCT JUNCTION</Tag>
      <Tag x={730} y={642} size={3.6}>HAULER YARD</Tag>
      <Tag x={482} y={150} rotate={-90} color={C.accent} size={4.4}>DUSK LINE</Tag>
      <Tag x={222} y={124} anchor="start" color={C.vent} size={4.4}>◀ NIGHT SIDE · STORM FRONTS</Tag>
      <Tag x={998} y={846} anchor="end" color={C.accent} size={4.4}>DAY SIDE · GLARE 140°C ▶</Tag>
      <Tag x={364} y={846} color={C.vent} size={3.8}>“THE WALL” TRACKS EAST ▶</Tag>
    </g>
  );
}

function Ducts() {
  const C = useMapTheme();
  return (
    <g pointerEvents="none" fill="none" stroke={C.vent} strokeWidth="1" strokeDasharray="2 3" opacity="0.55">
      <path d="M 454 548 L 462 548 L 462 690" />
      <path d="M 454 530 L 462 530 L 462 548" />
      <circle cx={462} cy={548} r={3.2} strokeDasharray="none" />
    </g>
  );
}

const Hub = () => (
  <LevelPlan rooms={kesslersRooms} doors={BUILDING_DOORS} stairs={STAIRS} level="hub"
    decorate={() => <><Ducts /><Interiors /><Labels /></>} />
);

const legendDish = (y) => <><path d={`M 0 ${y - 3} A 6 3.5 0 0 0 12 ${y - 3}`} fill="none" stroke={T.accent} strokeWidth="0.7" /><line x1="6" y1={y - 1} x2="6" y2={y + 4} stroke={T.accent} strokeWidth="0.6" /><line x1="3" y1={y + 4} x2="9" y2={y + 4} stroke={T.accent} strokeWidth="0.6" /></>;
const legendFuel = (y) => <>{[2.5, 8.5].map((x) => <circle key={x} cx={x} cy={y - 1} r="2.8" fill={T.hullDark} stroke={T.hullOutline} strokeWidth="0.5" />)}<rect x="-1" y={y - 5.5} width="13" height="9" fill="none" stroke={T.restricted} strokeWidth="0.4" strokeDasharray="1.5 1" opacity="0.6" /></>;
const legendDusk = (y) => <><rect x="0" y={y - 5} width="6" height="8" fill={NIGHT} stroke={T.equipLine} strokeWidth="0.3" /><rect x="6" y={y - 5} width="6" height="8" fill={GLARE} stroke={T.equipLine} strokeWidth="0.3" /><line x1="6" y1={y - 6} x2="6" y2={y + 4} stroke={T.accent} strokeWidth="0.8" strokeDasharray="2 1" /></>;

export const kesslersConfig = {
  width: W,
  height: H,
  stars: { count: 0, seed: 1979 },
  backdrop: 'none',
  levelNoun: 'LEVEL',
  scenarioTag: 'KESSLER’S LANDING',
  hull: { path: OUTLINE, overlays: hullGround },
  sidebar: alienSidebar({ title: 'KESSLER’S LANDING — HUB', subtitle: 'INDEPENDENT MINING COLONY, TERMINATOR BAND OF VARROW IV', scale: 'SCHEMATIC · NOT TO SCALE', compass: 'N' }),
  decks: [{ id: 'H', level: 'hub', name: 'HUB', page: 'I', component: Hub }],
  specs: {
    title: 'COLONY SURVEY',
    y: 806,
    items: [
      ['POPULATION', '400 reg. · 397 accounted'],
      ['CHARTER', 'Independent · Local 31'],
      ['DAYS OF NIGHT', '∞ west of the dusk line'],
      ['PROCESSOR', 'Thorianite · powers the hub'],
      ['QUARANTINE', 'ICC Probity at 400 km'],
    ],
  },
  legend: alienLegend([
    { label: 'UPLINK MAST', draw: legendDish },
    { label: 'FUEL FARM', draw: legendFuel },
    { label: 'DUSK LINE', draw: legendDusk },
  ]),
};

/** Interactive plan, registered as universe.maps[kesslers-landing-hub].engine */
export function KesslersMap() {
  return <MapEngine config={kesslersConfig} />;
}
KesslersMap.config = kesslersConfig;
