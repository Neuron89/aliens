import React from 'react';
import MapEngine, { Room, useMapTheme, purl, seededRandom } from '../../../engine/components/MapEngine';
import { LevelPlan, alienLegend, alienSidebar, Table, Dots, Machine } from './alienMapKit.jsx';
import {
  W, H, OUTLINE, OUTLINE_PTS, HULL, LIFT_CELLS, VENTS, GRATES,
  tartarusRooms, tartarusDoors, STAIRS,
} from './tartarus.geometry.js';

/* ═══════════════════════════════════════════════════════════════════════
   TARTARUS REACH — MapEngine plan (upper platform, process deck, keel).
   Rooms/doors/stairs come from tartarus.geometry.js, which also feeds the
   normalized board rooms in maps/index.js. The platform hangs in the
   cloud bands of Dis: no stars, a faint banded field of cloud around the
   hull, lift cells bulging out from under the deck on both flanks.
   ═══════════════════════════════════════════════════════════════════════ */

const PIPE = '#4f93ac';     // process pipework (helium lines)
const DROP = '#03050a';     // open sky under the grating
const RESIN = '#4c5c58';    // the nest's resin

const zone = (level, id) => tartarusRooms.find((r) => r.level === level && r.id === id).rect;
const stairsFor = (level) => STAIRS
  .filter((s) => s.levels.includes(level))
  .map((s) => ({ ...s, level, label: s.labels?.[level] ?? s.label }));

function Tiny({ x, y, children, color, anchor = 'middle', size = 3.6, rotate, weight }) {
  const C = useMapTheme();
  return (
    <text x={x} y={y} fill={color || C.textDim} fontSize={size} textAnchor={anchor} letterSpacing="0.08em" fontWeight={weight}
      transform={rotate ? `rotate(${rotate},${x},${y})` : undefined}>{children}</text>
  );
}

/** Label for a zone the plan draws itself (same type as Room labels). */
function ZoneLabel({ x, y, label, sub, size = 6.4, plate }) {
  const C = useMapTheme();
  const w = label.length * size * 0.66 + 8;
  return (
    <g>
      {plate && <rect x={x - w / 2} y={y - size - 1.5} width={w} height={sub ? size + 11 : size + 5} fill={C.hullDeep} opacity="0.85" rx="1" />}
      <text x={x} y={y} fill={C.text} fontSize={size} textAnchor="middle" letterSpacing="0.06em">{label}</text>
      {sub && <text x={x} y={y + 8} fill={C.textDim} fontSize="5" textAnchor="middle" letterSpacing="0.04em">{sub}</text>}
    </g>
  );
}

function Pipe({ d, w = 1 }) {
  return (
    <g fill="none" strokeLinejoin="round">
      <path d={d} stroke={PIPE} strokeWidth={3.2 * w} opacity="0.55" />
      <path d={d} stroke="#08161c" strokeWidth={1.4 * w} opacity="0.9" />
    </g>
  );
}

/* ─── Lift cell (hydrogen envelope with gores) ───────────────────────── */
function LiftCell({ cx, cy, rx, ry, label, dim }) {
  const C = useMapTheme();
  return (
    <g opacity={dim ? 0.75 : 1}>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#0c1a1c" stroke={C.hullOutline} strokeWidth="0.9" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={purl('hatch')} />
      {[0.72, 0.42, 0.12].map((k) => <ellipse key={k} cx={cx} cy={cy} rx={rx * k} ry={ry} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.55" />)}
      {[-0.55, 0, 0.55].map((k) => <line key={k} x1={cx - rx * Math.sqrt(1 - k * k)} y1={cy + ry * k} x2={cx + rx * Math.sqrt(1 - k * k)} y2={cy + ry * k} stroke={C.equipLine} strokeWidth="0.4" opacity="0.45" />)}
      {label && <Tiny x={cx} y={cy + ry + 9} size={4} color={C.textDim}>{label}</Tiny>}
    </g>
  );
}

/* ─── Behind the hull: cloud bands of Dis and the flank lift cells ────── */
function hullBackground(C) {
  const rng = seededRandom(3313);
  const wave = (y0, ph, amp) => { const pts = []; for (let x = 200; x <= 1070; x += 30) pts.push([x, y0 + Math.sin(x / 95 + ph) * amp]); return pts; };
  const bands = [];
  for (let i = 0; i < 26; i++) {
    const y0 = 40 + i * 33 + rng() * 8;
    const ph = rng() * 6.28, amp = 3 + rng() * 6, th = 8 + rng() * 14;
    const top = wave(y0, ph, amp), bot = wave(y0 + th, ph + 0.6, amp).reverse();
    const line = `M ${top.map(([x, y]) => `${x} ${y.toFixed(1)}`).join(' L ')}`;
    const strip = `${line} L ${bot.map(([x, y]) => `${x} ${y.toFixed(1)}`).join(' L ')} Z`;
    bands.push({ line, strip, o: 0.1 + rng() * 0.16, fill: i % 2 === 0 });
  }
  const sleet = Array.from({ length: 140 }, () => [200 + rng() * 860, 40 + rng() * 850]);
  return (
    <g pointerEvents="none">
      <defs>
        <linearGradient id="tr_bandFade" x1="200" y1="0" x2="1070" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={C.hullDeep} stopOpacity="0" />
          <stop offset="0.15" stopColor={C.hullDeep} stopOpacity="1" />
          <stop offset="0.85" stopColor={C.hullDeep} stopOpacity="1" />
          <stop offset="1" stopColor={C.hullDeep} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="tr_lineFade" x1="200" y1="0" x2="1070" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={C.equipLine} stopOpacity="0" />
          <stop offset="0.12" stopColor={C.equipLine} stopOpacity="1" />
          <stop offset="0.88" stopColor={C.equipLine} stopOpacity="1" />
          <stop offset="1" stopColor={C.equipLine} stopOpacity="0" />
        </linearGradient>
        {/* everything outside the deck outline */}
        <clipPath id="tr_outside"><path d={`M 0 0 L ${W} 0 L ${W} ${H} L 0 ${H} Z ${OUTLINE}`} clipRule="evenodd" /></clipPath>
      </defs>
      {/* banded cloud field */}
      {bands.map((b, i) => (
        <g key={i}>
          {b.fill && <path d={b.strip} fill="url(#tr_bandFade)" opacity="0.32" />}
          <path d={b.line} fill="none" stroke="url(#tr_lineFade)" strokeWidth="0.7" opacity={b.o + 0.1} />
        </g>
      ))}
      {/* ammonia sleet streaks, driven east by the wind */}
      {sleet.map(([x, y], i) => <line key={i} x1={x} y1={y} x2={x + 7} y2={y + 2.4} stroke={C.textDim} strokeWidth="0.4" opacity="0.22" />)}
      {/* lift cells slung under the keel, bulging past the deck edge (only the part outside the deck shows) */}
      <g clipPath="url(#tr_outside)">
        {LIFT_CELLS.map((c) => (
          <g key={c.id}>
            {[-0.7, 0, 0.7].map((k) => {
              const side = c.cx < 550 ? HULL.x0 : HULL.x1;
              return <line key={k} x1={c.cx + (c.cx < 550 ? -1 : 1) * c.rx * 0.2} y1={c.cy + c.ry * k} x2={side} y2={c.cy + c.ry * k * 0.6} stroke={C.equipLine} strokeWidth="0.5" opacity="0.5" />;
            })}
            <LiftCell {...c} />
          </g>
        ))}
      </g>
    </g>
  );
}

/* ─── Hull overlays: rim, wing girders, hex bracing ───────────────────── */
function hullOverlays(C) {
  const inset = OUTLINE_PTS.map(([x, y]) => [x + (x < 550 ? 7 : x > 550 ? -7 : 0), y + (y < 400 ? 7 : -7)]);
  return (
    <g>
      <path d={`M ${inset.map((p) => p.join(' ')).join(' L ')} Z`} fill="none" stroke={C.hullOutline} strokeWidth="0.6" strokeDasharray="6 4" opacity="0.35" />
      {/* wing spar lines */}
      {[160, 280].map((y) => <line key={y} x1={HULL.wingX0 + 6} y1={y} x2={HULL.wingX1 - 6} y2={y} stroke={C.hullOutline} strokeWidth="0.5" opacity="0.25" />)}
      {/* frame stations down the hull */}
      {[340, 420, 500, 580, 660, 740].map((y) => <g key={y}><line x1={HULL.x0} y1={y} x2={HULL.x0 + 10} y2={y} stroke={C.hullDeep} strokeWidth="1.6" /><line x1={HULL.x1 - 10} y1={y} x2={HULL.x1} y2={y} stroke={C.hullDeep} strokeWidth="1.6" /></g>)}
    </g>
  );
}

/* ─── Exterior: wind, beacon, the drop, launch rail ───────────────────── */
function exterior(C) {
  return (
    <g pointerEvents="none">
      {/* bow beacon mast */}
      <line x1={550} y1={112} x2={550} y2={92} stroke={C.hullOutline} strokeWidth="0.8" opacity="0.7" />
      <circle cx={550} cy={90} r={2.4} fill="none" stroke={C.accent} strokeWidth="0.7" />
      <circle cx={550} cy={90} r={6} fill="none" stroke={C.accent} strokeWidth="0.4" opacity="0.45" />
      <Tiny x={560} y={92} anchor="start" size={4}>LANDING BEACON</Tiny>
      {/* wind */}
      <g opacity="0.7">
        <path d="M 236 122 L 300 122 M 292 118 L 300 122 L 292 126" fill="none" stroke={C.accent} strokeWidth="0.8" />
        <Tiny x={236} y={114} anchor="start" size={4.4} color={C.accent}>WIND 110 KM/H ▸</Tiny>
      </g>
      {/* tether pylons at the wing tips */}
      {[[232, 158], [868, 158], [232, 282], [868, 282]].map(([x, y]) => <g key={`${x}${y}`}><circle cx={x} cy={y} r={3} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.6" /><line x1={x} y1={y} x2={x + (x < 550 ? -14 : 14)} y2={y + (y < 200 ? -10 : 10)} stroke={C.equipLine} strokeWidth="0.5" opacity="0.6" /></g>)}
      {/* lift cell captions */}
      {LIFT_CELLS.map((c) => <Tiny key={c.id} x={c.cx < 550 ? c.cx - c.rx + 2 : c.cx + c.rx - 2} y={c.cy - c.ry - 4} anchor={c.cx < 550 ? 'start' : 'end'} size={4}>{`LIFT CELL ${c.id}`}</Tiny>)}
      {/* gondola launch rail out of the stern housing */}
      <path d="M 538 874 L 538 896 M 562 874 L 562 896" stroke={C.equipLine} strokeWidth="0.8" strokeDasharray="3 2" opacity="0.6" />
      {/* the drop */}
      <Tiny x={760} y={862} size={5} color={C.textDim}>▼ ▼ ▼  DIS · 40,000 KM OF CLOUD BELOW  ▼ ▼ ▼</Tiny>
      <Tiny x={300} y={812} size={4.2}>STERN · GONDOLA RAIL ▼</Tiny>
    </g>
  );
}

/* ═══ UPPER PLATFORM ═══════════════════════════════════════════════════ */
function Pad({ x, y, w, h, letter, children }) {
  const C = useMapTheme();
  const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) / 2;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={C.wall} stroke={C.hullOutline} strokeWidth="0.9" />
      <circle cx={cx} cy={cy} r={r - 4} fill={C.floor} />
      <circle cx={cx} cy={cy} r={r - 4} fill={purl('grating')} />
      <circle cx={cx} cy={cy} r={r - 12} fill="none" stroke={C.accent} strokeWidth="0.7" strokeDasharray="7 5" opacity="0.45" />
      {/* clamp shoes */}
      {[45, 135, 225, 315].map((a) => {
        const t = (a * Math.PI) / 180;
        return <rect key={a} x={cx + Math.cos(t) * (r - 20) - 4} y={cy + Math.sin(t) * (r - 20) - 2.5} width="8" height="5" fill={C.hullDeep} stroke={C.restricted} strokeWidth="0.5" opacity="0.75"
          transform={`rotate(${a},${cx + Math.cos(t) * (r - 20)},${cy + Math.sin(t) * (r - 20)})`} />;
      })}
      <text x={cx} y={cy - r + 13} fill={C.textBright} fontSize="8" textAnchor="middle" opacity="0.55" style={{ fontFamily: 'var(--font-display)' }}>{letter}</text>
      {children}
    </g>
  );
}

/* The ore lighter: boxy hull, cargo doors frozen open, belly cradle. */
function Lamplighter({ x, y }) {
  const C = useMapTheme();
  return (
    <g opacity="0.9">
      <path d={`M ${x} ${y - 30} L ${x + 12} ${y - 18} L ${x + 14} ${y + 18} L ${x + 26} ${y + 26} L ${x + 26} ${y + 32} L ${x - 26} ${y + 32} L ${x - 26} ${y + 26} L ${x - 14} ${y + 18} L ${x - 12} ${y - 18} Z`}
        fill={C.hullDeep} stroke={C.accent} strokeWidth="0.8" />
      <rect x={x - 6} y={y - 22} width="12" height="6" fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.7" />
      <rect x={x - 8} y={y - 4} width="16" height="14" fill="none" stroke={C.restricted} strokeWidth="0.6" strokeDasharray="1.5 1" />
      {/* cargo doors splayed open, rimed with ice */}
      <path d={`M ${x - 14} ${y + 18} L ${x - 24} ${y + 8} M ${x + 14} ${y + 18} L ${x + 24} ${y + 8}`} stroke={C.accent} strokeWidth="0.9" />
      <Dots points={[[x - 22, y + 4], [x + 22, y + 4], [x - 26, y + 12], [x + 26, y + 12]]} r={1} color={C.vent} />
    </g>
  );
}

function ReliefHop({ x, y }) {
  const C = useMapTheme();
  return (
    <g opacity="0.9">
      <path d={`M ${x} ${y - 26} C ${x + 10} ${y - 20}, ${x + 10} ${y + 10}, ${x + 8} ${y + 22} L ${x - 8} ${y + 22} C ${x - 10} ${y + 10}, ${x - 10} ${y - 20}, ${x} ${y - 26} Z`}
        fill={C.hullDeep} stroke={C.accent} strokeWidth="0.8" />
      <path d={`M ${x - 8} ${y + 4} L ${x - 28} ${y + 16} L ${x - 28} ${y + 22} L ${x - 8} ${y + 16} M ${x + 8} ${y + 4} L ${x + 28} ${y + 16} L ${x + 28} ${y + 22} L ${x + 8} ${y + 16}`} fill="none" stroke={C.accent} strokeWidth="0.7" />
      <rect x={x - 4} y={y - 18} width="8" height="6" fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.7" />
      <path d={`M ${x - 5} ${y + 22} L ${x - 8} ${y + 34} L ${x + 8} ${y + 34} L ${x + 5} ${y + 22}`} fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.6" />
    </g>
  );
}

function UpperUnderlay() {
  const C = useMapTheme();
  return (
    <g>
      {/* open landing deck: darker plating, edge rail */}
      <path d="M 550 112 L 643 150 L 850 150 L 874 174 L 874 266 L 850 290 L 226 290 L 226 174 L 250 150 L 457 150 Z" fill={C.hullDeep} opacity="0.55" />
      <path d="M 550 112 L 643 150 L 850 150 L 874 174 L 874 266 L 850 290 L 226 290 L 226 174 L 250 150 L 457 150 Z" fill={purl('grating')} />
      <path d="M 550 120 L 641 157 L 847 157 L 867 177 L 867 263 L 847 283 L 253 283 L 233 263 L 233 177 L 253 157 L 459 157 Z" fill="none" stroke={C.accent} strokeWidth="0.6" strokeDasharray="1.5 2.5" opacity="0.5" />
    </g>
  );
}

function UpperDecor() {
  const C = useMapTheme();
  const pa = zone('upper', 'pad-a'), pb = zone('upper', 'pad-b');
  return (
    <g>
      {/* PADS */}
      <Pad {...pa} letter="A"><Lamplighter x={306} y={214} /></Pad>
      <ZoneLabel x={306} y={274} label="PAD A" size={5.6} plate />
      <Tiny x={306} y={258} size={3.4} color={C.accent}>LAMPLIGHTER · 3 SEATS</Tiny>
      <Pad {...pb} letter="B"><ReliefHop x={794} y={212} /></Pad>
      <ZoneLabel x={794} y={274} label="PAD B" size={5.6} plate />
      <Tiny x={794} y={258} size={3.4} color={C.restricted}>CLAMPED FROM OPS</Tiny>
      <Tiny x={420} y={268} size={4.6}>LANDING DECK</Tiny>
      <Tiny x={680} y={268} size={4.6}>OPEN TO WIND</Tiny>
      <Tiny x={550} y={136} size={3.6}>BOW</Tiny>

      {/* COLD CARGO HOLD: crate stacks, crate 44-B */}
      {[0, 1, 2, 3].flatMap((c) => [160, 180].map((y) => <rect key={`l${c}${y}`} x={410 + c * 17} y={y} width={13} height={14} fill={C.hullDeep} stroke={C.equipLine} strokeWidth="0.5" opacity="0.8" />))}
      {[0, 1, 2, 3].flatMap((c) => [160, 180].map((y) => {
        const hot = c === 3 && y === 180;
        return <rect key={`r${c}${y}`} x={624 + c * 17} y={y} width={13} height={14} fill={C.hullDeep} stroke={hot ? C.restricted : C.equipLine} strokeWidth={hot ? 0.9 : 0.5} opacity="0.85" />;
      }))}
      <Tiny x={692} y={201} size={3.3} color={C.restricted} anchor="end">44-B</Tiny>
      {/* coils */}
      {[166, 176, 186, 196].map((y) => <line key={y} x1={404} y1={y} x2={406} y2={y} stroke={C.vent} strokeWidth="0.8" opacity="0.6" />)}

      {/* DECON LOCK: fog nozzles, residue on the inner seal */}
      <Dots points={[[492, 252], [508, 252], [592, 252], [608, 252], [492, 288], [608, 288]]} r={1.6} color={C.vent} />
      <path d="M 541 297 q 4 -3 9 0 q 5 3 9 0" fill="none" stroke={C.restricted} strokeWidth="0.8" opacity="0.8" />
      <Tiny x={575} y={296} size={3} color={C.restricted} anchor="start">RESIDUE</Tiny>

      {/* OPS CENTER: viewport to the pads, console horseshoe, welded door */}
      <rect x={352} y={300} width={70} height={3.4} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.4" rx="1.5" />
      <path d="M 354 318 L 354 350 L 420 350 L 420 318" fill="none" stroke={C.equipLine} strokeWidth="2.6" opacity="0.5" />
      <rect x={370} y={420} width={36} height={14} fill={C.hullDeep} stroke={C.accent} strokeWidth="0.6" opacity="0.8" rx="1" />
      <Tiny x={388} y={430} size={3.2} color={C.accent}>MU/TH/UR</Tiny>
      <Tiny x={388} y={446} size={3}>CLAMPS · COMMS</Tiny>
      <path d="M 433 343 l 3 2 l -3 2 l 3 2 l -3 2 l 3 2 l -3 2 l 3 2" fill="none" stroke={C.restricted} strokeWidth="0.9" />
      <Tiny x={428} y={364} size={3} color={C.restricted} anchor="end">WELDED</Tiny>

      {/* AUDIT SUITE: desk, chained attaché, key in the vent */}
      <Table x={350} y={484} w={30} h={12} />
      <rect x={386} y={486} width={10} height={7} fill="none" stroke={C.restricted} strokeWidth="0.6" />
      <Tiny x={396} y={548} size={3} color={C.restricted}>KEY IN VENT</Tiny>

      {/* QUIET ROOM: window onto the clouds, benches */}
      <rect x={338} y={580} width={4} height={50} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.5" rx="1.5" />
      {[580, 594].map((y) => <Table key={y} x={360} y={y} w={4} h={10} />)}
      {[580, 594].map((y) => <Table key={`b${y}`} x={412} y={y} w={4} h={10} />)}

      {/* SUIT LOCKERS */}
      {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={346 + i * 14} y={660} width={11} height={8} fill="none" stroke={i > 3 ? C.restricted : C.equipLine} strokeDasharray={i > 3 ? '1.5 1' : undefined} strokeWidth="0.5" opacity="0.7" />)}
      <Tiny x={392} y={748} size={3}>2 HOOKS EMPTY</Tiny>

      {/* MESS: tables, galley counter, the apron and drag mark */}
      {[358, 382].map((y) => <Table key={y} x={478} y={y} w={56} h={8} />)}
      {[358, 382].map((y) => <Table key={`e${y}`} x={566} y={y} w={56} h={8} />)}
      <rect x={470} y={456} width={84} height={10} fill="url(#me_hatch)" stroke={C.equipLine} strokeWidth="0.5" opacity="0.8" />
      <Tiny x={512} y={474} size={3}>GALLEY</Tiny>
      <Dots points={[[548, 470], [541, 474], [534, 476], [527, 477]]} r={1.1} color={C.restricted} />
      <path d="M 560 462 l 5 6 m 0 -6 l -5 6" stroke={C.restricted} strokeWidth="0.7" />
      <Tiny x={570} y={468} size={3} color={C.restricted} anchor="start">APRON · DRAG MARK</Tiny>
      <rect x={600} y={455} width={30} height={20} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.5" />
      <Tiny x={615} y={467} size={2.8}>CALENDAR</Tiny>

      {/* LIFT LOBBY */}
      {[520, 538].map((y) => <Table key={y} x={474} y={y} w={30} h={5} />)}
      <Tiny x={596} y={562} size={3} color={C.restricted}>AUDITOR LOCK</Tiny>
      {[0, 1, 2, 3].map((i) => <rect key={i} x={612} y={510 + i * 11} width={18} height={8} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.55" />)}
      <rect x={472} y={600} width={40} height={30} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.5" />
      <Tiny x={492} y={617} size={2.8}>DUTY BOARD</Tiny>

      {/* BUNK CORRIDOR: cubicles along both walls */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x={668} y={308 + i * 22} width={18} height={10} fill="none" stroke={C.accent} strokeWidth="0.4" opacity="0.45" rx="0.6" />)}
      {[0, 1, 2, 3, 4].map((i) => <rect key={`e${i}`} x={738} y={360 + i * 22} width={18} height={10} fill="none" stroke={C.accent} strokeWidth="0.4" opacity="0.45" rx="0.6" />)}

      {/* INFIRMARY & MORGUE: autosurgeon, drawers, strapped door, shed skin */}
      <circle cx={712} cy={512} r={14} fill="none" stroke={C.accent} strokeWidth="0.6" opacity="0.6" />
      <rect x={706} y={502} width={12} height={20} fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.6" rx="2" />
      <Dots points={[[700, 500], [726, 506], [722, 526], [698, 522]]} r={1.3} color={C.restricted} />
      <Tiny x={712} y={534} size={3}>AUTOSURGEON</Tiny>
      {[0, 1, 2].map((i) => <rect key={i} x={672 + i * 28} y={618} width={22} height={18} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.6" />)}
      <rect x={700} y={618} width={22} height={18} fill="none" stroke={C.restricted} strokeWidth="0.7" />
      <Tiny x={711} y={612} size={3} color={C.restricted}>BRANDT</Tiny>
      <path d="M 680 590 q 8 -8 16 0 t 16 0" fill="none" stroke={C.restricted} strokeWidth="0.6" opacity="0.7" />
      <Tiny x={696} y={600} size={2.8} color={C.restricted}>SHED SKIN</Tiny>
      <line x1={660} y1={555} x2={668} y2={567} stroke={C.restricted} strokeWidth="1.1" />
      <Tiny x={686} y={566} size={3} color={C.restricted}>STRAPPED</Tiny>

      {/* AIR PLANT */}
      {[[690, 732], [736, 732]].map(([x, y]) => <g key={x}><circle cx={x} cy={y} r={10} fill="none" stroke={C.vent} strokeWidth="0.6" opacity="0.6" /><circle cx={x} cy={y} r={3} fill={C.vent} opacity="0.4" /></g>)}

      {/* SURVEY LAB: core racks, Brandt's notes */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={i} x={480 + i * 18} y={758} width={6} height={22} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.6" rx="3" />)}
      <Tiny x={550} y={792} size={3}>ERESH CORE RACKS</Tiny>
      <Table x={470} y={694} w={34} h={12} />
      <Tiny x={487} y={714} size={2.8}>NOTES</Tiny>

      {/* gondola housing below the stern */}
      <circle cx={550} cy={834} r={22} fill="none" stroke={C.textDim} strokeWidth="0.6" strokeDasharray="3 3" opacity="0.6" />
      <Tiny x={550} y={834} size={3.2}>GONDOLA</Tiny>
      <Tiny x={550} y={840} size={3.2}>(KEEL)</Tiny>
    </g>
  );
}

/* ═══ PROCESS DECK ═════════════════════════════════════════════════════ */
function Turbine({ cx, cy, r }) {
  const C = useMapTheme();
  return (
    <g opacity="0.8">
      <circle cx={cx} cy={cy} r={r} fill={C.hullDeep} stroke={C.equipLine} strokeWidth="0.8" />
      <circle cx={cx} cy={cy} r={r * 0.25} fill="none" stroke={C.accent} strokeWidth="0.6" />
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i * 36 * Math.PI) / 180;
        return <path key={i} d={`M ${cx + Math.cos(a) * r * 0.25} ${cy + Math.sin(a) * r * 0.25} Q ${cx + Math.cos(a + 0.5) * r * 0.6} ${cy + Math.sin(a + 0.5) * r * 0.6} ${cx + Math.cos(a + 0.3) * r * 0.95} ${cy + Math.sin(a + 0.3) * r * 0.95}`} fill="none" stroke={C.equipLine} strokeWidth="0.6" />;
      })}
    </g>
  );
}

function ProcessUnderlay() {
  const C = useMapTheme();
  return (
    <g>
      {/* scoop mouths through the wing tips */}
      {[[226, 300, 1], [874, 800, -1]].map(([x0, x1, s]) => (
        <g key={x0}>
          <path d={`M ${x0} 166 L ${x1} 178 L ${x1} 262 L ${x0} 274 Z`} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.8" />
          {Array.from({ length: 9 }, (_, i) => 176 + i * 11).map((y) => <line key={y} x1={x0 + s * 4} y1={y} x2={x1 - s * 6} y2={y + (y < 220 ? 4 : -4) * 0.4} stroke={C.equipLine} strokeWidth="0.7" opacity="0.5" />)}
          <Tiny x={(x0 + x1) / 2} y={160} size={3.8} color={C.text}>{s > 0 ? 'SCOOP ▸' : '◂ SCOOP'}</Tiny>
        </g>
      ))}
    </g>
  );
}

function ProcessDecor() {
  const C = useMapTheme();
  const fc = zone('process', 'fraction-column');
  const tf = zone('process', 'tank-farm');
  const cx = fc.x + fc.w / 2, cy = fc.y + fc.h / 2;
  const spheres = [[440, 690], [550, 690], [660, 690], [440, 754], [550, 754], [660, 754]];
  return (
    <g>
      {/* SCOOP INTAKE: twin turbines, ducts, the grille */}
      <Turbine cx={372} cy={220} r={40} />
      <Turbine cx={728} cy={220} r={40} />
      <Tiny x={436} y={176} size={3.4} anchor="start">◂ INTAKE</Tiny>
      <path d="M 744 270 l 8 8 m 0 -8 l -8 8" stroke={C.restricted} strokeWidth="1" />
      <Tiny x={740} y={278} size={3.2} color={C.restricted} anchor="end">GRILLE · FIRST SIGHTING</Tiny>

      {/* process pipework: scoop → column → tank farm */}
      <Pipe d="M 412 226 L 470 226 L 470 300 L 500 300 L 500 340" />
      <Pipe d="M 688 226 L 630 226 L 630 300 L 600 300 L 600 340" />
      <Pipe d="M 520 520 L 520 640 L 440 640 L 440 660" w={0.9} />
      <Pipe d="M 580 520 L 580 640 L 660 640 L 660 660" w={0.9} />
      <Pipe d="M 550 640 L 550 660" w={0.9} />

      {/* FRACTION COLUMN: the big cryogenic cylinder seen from above */}
      <Room x={fc.x} y={fc.y} w={fc.w} h={fc.h} shape="circle" />
      <circle cx={cx} cy={cy} r={92} fill="none" stroke={C.equipLine} strokeWidth="0.6" strokeDasharray="2 2" opacity="0.6" />
      <circle cx={cx} cy={cy} r={78} fill={purl('hatch')} stroke={C.equipLine} strokeWidth="0.8" />
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i * 22.5 * Math.PI) / 180;
        return <line key={i} x1={cx + Math.cos(a) * 46} y1={cy + Math.sin(a) * 46} x2={cx + Math.cos(a) * 78} y2={cy + Math.sin(a) * 78} stroke={C.equipLine} strokeWidth="0.5" opacity="0.6" />;
      })}
      <circle cx={cx} cy={cy} r={46} fill="#0e2a34" stroke={PIPE} strokeWidth="0.9" />
      <circle cx={cx} cy={cy} r={20} fill="none" stroke={PIPE} strokeWidth="0.5" opacity="0.7" />
      <Dots points={[[cx - 30, cy - 30], [cx + 30, cy - 30], [cx - 30, cy + 30], [cx + 30, cy + 30], [cx, cy - 38], [cx, cy + 38]]} r={1.2} color={PIPE} />
      {[[cx - 92, cy], [cx + 92, cy - 30], [cx + 92, cy + 30]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={4} fill={C.hullDeep} stroke={PIPE} strokeWidth="0.9" />)}
      <Tiny x={cx + 82} y={cy - 40} size={3} color={PIPE} anchor="end">LHe DUMP</Tiny>
      <ZoneLabel x={cx} y={cy - 2} label="FRACTION COLUMN" size={6} sub="CRYO · −269 °C" plate />

      {/* CONTROL GALLERY: window onto the column, consoles, ballast trim */}
      <rect x={428} y={360} width={3.4} height={140} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.4" rx="1.5" />
      {[340, 372, 404].map((y) => <rect key={y} x={404} y={y} width={18} height={22} fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.6" rx="1" />)}
      <Tiny x={390} y={398} size={3} color={C.accent}>TRIM</Tiny>

      {/* COMPRESSOR BAY */}
      {[382, 488].map((y) => <g key={y}><circle cx={694} cy={y} r={11} fill="none" stroke={C.equipLine} strokeWidth="0.7" opacity="0.7" /><circle cx={728} cy={y} r={11} fill="none" stroke={C.equipLine} strokeWidth="0.7" opacity="0.7" /></g>)}

      {/* HE-3 TANK FARM: six hatched spheres */}
      <Room x={tf.x} y={tf.y} w={tf.w} h={tf.h} shape="octagon" />
      {spheres.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={27} fill={C.hullDeep} stroke={C.equipLine} strokeWidth="0.9" />
          <circle cx={x} cy={y} r={27} fill={purl('hatch')} />
          <circle cx={x} cy={y} r={17} fill="none" stroke={C.equipLine} strokeWidth="0.4" opacity="0.6" />
          {[45, 135, 225, 315].map((a) => { const t = (a * Math.PI) / 180; return <rect key={a} x={x + Math.cos(t) * 30 - 2} y={y + Math.sin(t) * 30 - 2} width="4" height="4" fill={C.wall} />; })}
          <Tiny x={x} y={y + 1.5} size={4} color={C.text}>{`T${i + 1}`}</Tiny>
        </g>
      ))}
      <path d="M 550 690 m -6 -6 l 12 12 m 0 -12 l -12 12" stroke={C.restricted} strokeWidth="0.6" opacity="0.6" />
      <ZoneLabel x={550} y={644} label="HE-3 TANK FARM" size={6} />
      <Tiny x={550} y={790} size={3.4}>9 BAR · RUPTURE RISK ON DESCENT</Tiny>
      <Tiny x={503} y={722} size={3}>RING MAIN</Tiny>
      <Pipe d="M 440 722 L 660 722" w={0.7} />
    </g>
  );
}

/* ═══ KEEL ═════════════════════════════════════════════════════════════ */
function Catwalk({ x, y, w, h }) {
  const C = useMapTheme();
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={C.floor} stroke={C.hullOutline} strokeWidth="0.5" />
      <rect x={x} y={y} width={w} height={h} fill={purl('grating')} />
    </g>
  );
}

function KeelUnderlay() {
  const C = useMapTheme();
  const g = zone('keel', 'lift-cell-gallery');
  const rng = seededRandom(4400);
  const bands = Array.from({ length: 10 }, (_, i) => {
    const y0 = g.y + 12 + i * 28 + rng() * 6;
    let d = `M ${g.x - 20} ${y0.toFixed(1)}`;
    for (let x = g.x - 20; x <= g.x + g.w + 20; x += 24) d += ` L ${x} ${(y0 + Math.sin(x / 70 + i) * 4).toFixed(1)}`;
    return d;
  });
  return (
    <g>
      <defs>
        <clipPath id="tr_gallery"><rect x={HULL.wingX0} y={HULL.wingY0} width={HULL.wingX1 - HULL.wingX0} height={g.y + g.h - HULL.wingY0} /></clipPath>
      </defs>
      <g clipPath="url(#tr_gallery)">
        {/* open sky under the grating */}
        <rect x={HULL.wingX0} y={100} width={HULL.wingX1 - HULL.wingX0} height={g.y + g.h - 100} fill={DROP} />
        {bands.map((d, i) => <path key={i} d={d} fill="none" stroke={C.equipLine} strokeWidth="0.6" opacity={0.12 + (i % 3) * 0.05} />)}
        {/* the cells themselves, from above */}
        {LIFT_CELLS.map((c) => <LiftCell key={c.id} {...c} />)}
        <LiftCell cx={440} cy={300} rx={74} ry={112} />
        <LiftCell cx={660} cy={300} rx={74} ry={112} />
        {/* catwalks */}
        <Catwalk x={236} y={158} w={628} h={12} />
        <Catwalk x={541} y={170} w={18} h={276} />
        <Catwalk x={340} y={426} w={420} h={12} />
        <Catwalk x={236} y={170} w={12} h={110} />
        <Catwalk x={852} y={170} w={12} h={110} />
        <Catwalk x={340} y={170} w={12} h={256} />
        <Catwalk x={748} y={170} w={12} h={256} />
        <Catwalk x={248} y={268} w={92} h={12} />
        <Catwalk x={760} y={268} w={92} h={12} />
        {/* hydrogen manifold along the south catwalk */}
        <path d="M 352 442 L 748 442" stroke={PIPE} strokeWidth="1.6" opacity="0.7" />
      </g>
      {/* walls of the gallery against the keel rooms */}
      <line x1={HULL.x0} y1={g.y + g.h} x2={HULL.x1} y2={g.y + g.h} stroke={C.hullOutline} strokeWidth="0.8" opacity="0.6" />
    </g>
  );
}

function KeelDecor() {
  const C = useMapTheme();
  const s = zone('keel', 'sump');
  const gd = zone('keel', 'escape-gondola');
  const gx = gd.x + gd.w / 2, gy = gd.y + gd.h / 2;
  return (
    <g>
      {/* LIFT-CELL GALLERY labels and events */}
      <ZoneLabel x={550} y={206} label="LIFT-CELL GALLERY" size={6.4} sub="CATWALKS OVER OPEN SKY" plate />
      <Tiny x={550} y={406} size={3.6} color={C.textDim}>▼ OPEN DROP ▼</Tiny>
      <path d="M 612 437 l 6 -8 l 2 6 l 6 -7" fill="none" stroke={C.restricted} strokeWidth="1" />
      <circle cx={618} cy={436} r={7} fill="none" stroke={C.restricted} strokeWidth="0.6" strokeDasharray="1.5 1.5" />
      <Tiny x={632} y={424} size={3.2} color={C.restricted} anchor="start">ACID BREACH · H₂ LINE</Tiny>
      <rect x={804} y={240} width={26} height={22} fill="none" stroke={C.accent} strokeWidth="0.6" strokeDasharray="2 1.5" />
      <Dots points={[[790, 274], [776, 273], [764, 270], [752, 266]]} r={0.9} color={C.accent} />
      <Tiny x={817} y={236} size={3.2} color={C.accent}>IMOGEN’S HIDE</Tiny>
      {[[300, 232], [800, 232], [440, 300], [660, 300]].map(([x, y]) => <g key={`${x}${y}`}><circle cx={x} cy={y} r={4} fill={C.hullDeep} stroke={C.accent} strokeWidth="0.6" /><line x1={x - 3} y1={y} x2={x + 3} y2={y} stroke={C.accent} strokeWidth="0.5" /></g>)}
      <Tiny x={440} y={312} size={3}>VALVE</Tiny>

      {/* REACTOR: sealed housing, heat toward the crawlway */}
      <rect x={446} y={458} width={262} height={128} fill={C.hullDeep} />
      <Machine x={446} y={458} w={262} h={128} />
      <rect x={446} y={458} width={262} height={128} fill="none" stroke={C.hullOutline} strokeWidth="0.8" opacity="0.6" />
      <circle cx={577} cy={518} r={30} fill={C.hullDeep} stroke={C.restricted} strokeWidth="0.7" opacity="0.8" />
      <circle cx={577} cy={518} r={14} fill="none" stroke={C.restricted} strokeWidth="0.5" opacity="0.7" />
      <Tiny x={577} y={520} size={4} color={C.restricted}>FUSION</Tiny>
      <Tiny x={577} y={576} size={3.6}>REACTOR · NO ACCESS</Tiny>
      {[480, 500, 520, 540, 560].map((y) => <path key={y} d={`M 382 ${y + 60} q 3 -3 0 -6 q -3 -3 0 -6`} fill="none" stroke={C.restricted} strokeWidth="0.5" opacity="0.5" />)}
      <Tiny x={400} y={560} size={3} color={C.restricted} anchor="start" rotate={-90}>HOT</Tiny>

      {/* TRIM TANKS east of the sump */}
      {[620, 670, 720].map((y) => <g key={y}><circle cx={744} cy={y} r={14} fill={C.hullDeep} stroke={C.equipLine} strokeWidth="0.6" /><circle cx={744} cy={y} r={14} fill={purl('hatch')} /></g>)}
      <Tiny x={744} y={748} size={3}>TRIM</Tiny>

      {/* SUMP & BALLAST: resin walls, black water, the nest */}
      <Room x={s.x} y={s.y} w={s.w} h={s.h} shape="octagon" fill="#0a1214" />
      <ellipse cx={550} cy={700} rx={92} ry={44} fill="#05090c" stroke={C.vent} strokeWidth="0.6" opacity="0.9" />
      {[684, 698, 712].map((y, i) => <path key={y} d={`M ${480 + i * 6} ${y} q 12 -3 24 0 t 24 0 t 24 0 t 24 0 t 24 0`} fill="none" stroke={C.vent} strokeWidth="0.4" opacity="0.4" />)}
      <Tiny x={550} y={738} size={3.4} color={C.vent}>BALLAST WATER</Tiny>
      {/* resin: ribbed growth along the walls */}
      {Array.from({ length: 22 }, (_, i) => 400 + i * 14).map((x, i) => (
        <path key={x} d={`M ${x} ${s.y + 6} q 4 ${10 + (i % 3) * 4} 0 ${18 + (i % 4) * 5}`} fill="none" stroke={RESIN} strokeWidth="1.4" opacity="0.8" />
      ))}
      {Array.from({ length: 8 }, (_, i) => s.y + 46 + i * 12).map((y, i) => (
        <g key={y}>
          <path d={`M ${s.x + 6} ${y} q ${12 + (i % 3) * 4} 4 ${20 + (i % 2) * 6} 0`} fill="none" stroke={RESIN} strokeWidth="1.4" opacity="0.8" />
          <path d={`M ${s.x + s.w - 6} ${y} q ${-12 - (i % 3) * 4} 4 ${-20 - (i % 2) * 6} 0`} fill="none" stroke={RESIN} strokeWidth="1.4" opacity="0.8" />
        </g>
      ))}
      {/* the cocooned */}
      {[[420, 640, 'ACHEBE'], [680, 640, 'THE COOK']].map(([x, y, n]) => (
        <g key={n}>
          <ellipse cx={x} cy={y} rx={7} ry={11} fill={C.hullDeep} stroke={C.restricted} strokeWidth="0.8" />
          <Tiny x={x + (x < 550 ? 12 : -12)} y={y + 2} size={3.2} color={C.restricted} anchor={x < 550 ? 'start' : 'end'}>{n}</Tiny>
        </g>
      ))}
      {/* ballast vents */}
      {[[420, 752], [680, 752]].map(([x, y]) => <g key={x}><rect x={x - 6} y={y - 4} width={12} height={8} fill="none" stroke={C.vent} strokeWidth="0.6" /><line x1={x - 4} y1={y} x2={x + 4} y2={y} stroke={C.vent} strokeWidth="0.5" /></g>)}
      <Tiny x={420} y={764} size={2.8}>BALLAST VENT</Tiny>
      <Tiny x={680} y={764} size={2.8}>BALLAST VENT</Tiny>
      <ZoneLabel x={550} y={630} label="SUMP & BALLAST" size={6.2} sub="THE NEST" />
      <path d="M 712 650 l 5 5 m 0 -5 l -5 5" stroke={C.restricted} strokeWidth="0.6" />
      <Tiny x={702} y={668} size={2.8} color={C.restricted} anchor="end">DEAD HUGGER · DRAIN</Tiny>

      {/* ESCAPE GONDOLA: pod on its launch rail */}
      <path d={`M 538 ${gd.y + 10} L 538 880 M 562 ${gd.y + 10} L 562 880`} stroke={C.equipLine} strokeWidth="1.2" opacity="0.8" />
      <Room x={gd.x} y={gd.y} w={gd.w} h={gd.h} shape="circle" />
      {[[536, 812], [564, 812], [536, 840], [564, 840]].map(([x, y]) => <rect key={`${x}${y}`} x={x - 5} y={y - 5} width={10} height={10} fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.6" rx="2" />)}
      <text x={gx} y={gy - 1} fill={C.text} fontSize="5" textAnchor="middle" letterSpacing="0.06em">ESCAPE</text>
      <text x={gx} y={gy + 5.5} fill={C.text} fontSize="5" textAnchor="middle" letterSpacing="0.06em">GONDOLA</text>
      <path d="M 534 862 q 4 6 0 10 M 566 862 q -4 6 0 10" fill="none" stroke={C.restricted} strokeWidth="1.1" />
      <Tiny x={612} y={858} size={3.2} color={C.restricted} anchor="start">RAIL BUCKLED</Tiny>
      <Tiny x={612} y={864} size={3.2} color={C.restricted} anchor="start">FREE BY HAND</Tiny>
    </g>
  );
}

/* ─── Levels ─────────────────────────────────────────────────────────── */
const Upper = () => (
  <g>
    <UpperUnderlay />
    <LevelPlan rooms={tartarusRooms} doors={tartarusDoors} stairs={stairsFor('upper')} level="upper"
      conduits={VENTS.upper} grates={GRATES.upper} decorate={() => <UpperDecor />} />
  </g>
);
const Process = () => (
  <g>
    <ProcessUnderlay />
    <LevelPlan rooms={tartarusRooms} doors={tartarusDoors} stairs={stairsFor('process')} level="process"
      conduits={VENTS.process} grates={GRATES.process} decorate={() => <ProcessDecor />} />
  </g>
);
const Keel = () => (
  <g>
    <KeelUnderlay />
    <LevelPlan rooms={tartarusRooms} doors={tartarusDoors} stairs={stairsFor('keel')} level="keel"
      conduits={VENTS.keel} grates={GRATES.keel} decorate={() => <KeelDecor />} />
  </g>
);

const legendExtras = [
  { label: 'LIFT CELL', draw: (y) => <g><ellipse cx="5" cy={y - 2} rx="5" ry="4" fill="#0c1a1c" stroke="#40a890" strokeWidth="0.6" /><ellipse cx="5" cy={y - 2} rx="2" ry="4" fill="none" stroke="#306858" strokeWidth="0.4" /></g> },
  { label: 'PROCESS PIPEWORK', draw: (y) => <g><line x1="0" y1={y - 1} x2="12" y2={y - 1} stroke={PIPE} strokeWidth="3" opacity="0.55" /><line x1="0" y1={y - 1} x2="12" y2={y - 1} stroke="#08161c" strokeWidth="1.2" /></g> },
  { label: 'DROP (OPEN TO ATMOSPHERE)', draw: (y) => <g><rect x="0" y={y - 6} width="10" height="8" fill={DROP} stroke="#306858" strokeWidth="0.4" /><path d={`M 1 ${y - 3} q 2 -1 4 0 t 4 0 M 1 ${y} q 2 -1 4 0 t 4 0`} fill="none" stroke="#306858" strokeWidth="0.4" /></g> },
];

export const tartarusConfig = {
  width: W,
  height: H,
  stars: { count: 0, seed: 1979 },
  backdrop: 'none',
  levelNoun: 'LEVEL',
  scenarioTag: 'TARTARUS REACH',
  hull: { path: OUTLINE, background: hullBackground, overlays: hullOverlays },
  exteriorDetails: exterior,
  sidebar: alienSidebar({ title: 'TARTARUS REACH', subtitle: 'W-Y HELIUM-3 REFINERY · UPPER CLOUD DECK OF DIS', tag: 'D I S', compass: 'N' }),
  decks: [
    { id: 'U', level: 'upper', name: 'UPPER PLATFORM', page: 'I', component: Upper },
    { id: 'P', level: 'process', name: 'PROCESS DECK', page: 'II', component: Process },
    { id: 'K', level: 'keel', name: 'KEEL', page: 'III', component: Keel },
  ],
  specs: {
    title: 'PLATFORM SURVEY',
    y: 822,
    items: [
      ['ALTITUDE', '0.9 bar line, 40,000 km above the core'],
      ['WIND', '110 km/h sustained, gusts to 160'],
      ['CREW', 'Bunks for 12, one synthetic (Abram)'],
      ['HE-3 OUTPUT', '61% of quota (deficient)'],
      ['NEXT TENDER', '118 days after Orpheus Lane departs'],
    ],
  },
  legend: alienLegend(legendExtras),
};

/** Interactive plan, registered as universe.maps[tartarus-reach-section].engine */
export function TartarusMap() {
  return <MapEngine config={tartarusConfig} />;
}
TartarusMap.config = tartarusConfig;
