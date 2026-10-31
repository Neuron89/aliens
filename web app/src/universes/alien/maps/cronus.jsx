import React from 'react';
import MapEngine, { useMapTheme, seededRandom, purl } from '../../../engine/components/MapEngine';
import { LevelPlan, alienLegend, alienSidebar, Table, Dots, Machine } from './alienMapKit.jsx';
import {
  W, H, OUTLINE, OUTLINE_PTS, cronusRooms, cronusDoors, STAIRS, DUCTS, DUCT_GRATES,
} from './cronus.geometry.js';

/* ═══════════════════════════════════════════════════════════════════════
   USCSS CRONUS — MapEngine plan (MAIN DECK, LOWER DECKS).
   Rooms/doors/stairs come from cronus.geometry.js, which also feeds the
   normalized board rooms in maps/index.js. The plan dresses them: hive
   resin spreading over the decks, the nest drawn as organic architecture,
   eggs, cocoons, open cryopods, the sealed specimen tank, the comms dish
   and the Montero's umbilical outside the hull.
   ═══════════════════════════════════════════════════════════════════════ */

/* Resin palette: a dark olive that reads as organic against the teal plan. */
const RESIN = { fill: '#141d16', edge: '#4f7a5c', rib: '#6d8f6a', deep: '#0b120d' };

const stairsFor = (level) => STAIRS
  .filter((s) => s.levels.includes(level))
  .map((s) => ({ ...s, level, label: s.labels?.[level] || s.label }));

function Tiny({ x, y, children, color, anchor = 'middle', size = 3.6, rotate, weight }) {
  const C = useMapTheme();
  return (
    <text x={x} y={y} fill={color || C.textDim} fontSize={size} textAnchor={anchor} letterSpacing="0.08em" fontWeight={weight}
      transform={rotate ? `rotate(${rotate},${x},${y})` : undefined}>{children}</text>
  );
}

/* Closed Catmull-Rom spline through points → cubic Béziers. */
function smoothClosed(pts) {
  const n = pts.length, f = (v) => v.toFixed(1);
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${f(c1[0])} ${f(c1[1])}, ${f(c2[0])} ${f(c2[1])}, ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d} Z`;
}

/* Smooth closed blob around (cx, cy): a noisy ellipse. */
function blobPath(cx, cy, rx, ry, seed = 1, n = 11, jitter = 0.28) {
  const rng = seededRandom(seed * 7919 + 17);
  return smoothClosed(Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 1 - jitter / 2 + rng() * jitter;
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  }));
}

/* Organic outline that follows a rectangle, pushed in and out at random. */
function wavyRect(x0, y0, x1, y1, amp, seed = 1, step = 18) {
  const rng = seededRandom(seed * 104729 + 3);
  const pts = [];
  const side = (ax, ay, bx, by, nx, ny) => {
    const len = Math.hypot(bx - ax, by - ay), n = Math.max(2, Math.round(len / step));
    for (let i = 0; i < n; i++) {
      const t = i / n, o = (rng() - 0.35) * amp;
      pts.push([ax + (bx - ax) * t + nx * o, ay + (by - ay) * t + ny * o]);
    }
  };
  side(x0, y0, x1, y0, 0, 1); side(x1, y0, x1, y1, -1, 0); side(x1, y1, x0, y1, 0, -1); side(x0, y1, x0, y0, 1, 0);
  return smoothClosed(pts);
}

/* A patch of ribbed hive resin. */
function Resin({ x, y, rx, ry, seed = 1, opacity = 0.6, ribs = 3 }) {
  return (
    <g opacity={opacity} pointerEvents="none">
      <path d={blobPath(x, y, rx, ry, seed, 14, 0.5)} fill={RESIN.fill} stroke={RESIN.edge} strokeWidth="0.6" />
      {Array.from({ length: ribs }, (_, i) => {
        const k = 0.78 - i * 0.22;
        return <path key={i} d={blobPath(x, y, rx * k, ry * k, seed + i + 1, 9, 0.35)} fill="none" stroke={RESIN.rib} strokeWidth="0.35" opacity={0.55 - i * 0.1} />;
      })}
    </g>
  );
}

/* Resin tendril: a ribbed strand along a path. */
function Tendril({ d, w = 5 }) {
  return (
    <g opacity="0.6" pointerEvents="none">
      <path d={d} fill="none" stroke={RESIN.fill} strokeWidth={w} strokeLinecap="round" />
      <path d={d} fill="none" stroke={RESIN.edge} strokeWidth="0.5" strokeDasharray="1.5 2.5" />
    </g>
  );
}

/* Scaled egg (same glyph as the kit's alien-egg icon). */
function Egg({ x, y, s = 1, open = false }) {
  const C = useMapTheme();
  return (
    <g transform={`translate(${x},${y}) scale(${s})`} opacity="0.85">
      <path d="M 0 -4 C 3.6 -2, 3.2 3.8, 0 3.8 C -3.2 3.8, -3.6 -2, 0 -4 Z" fill={RESIN.deep} stroke={C.restricted} strokeWidth="0.5" />
      {open
        ? <path d="M -1.8 -2.6 L -0.6 -1.2 L 0 -3 L 0.7 -1.1 L 1.8 -2.6" fill="none" stroke={C.restricted} strokeWidth="0.45" />
        : <path d="M -1.4 -1.2 L 0 0.4 L 1.4 -1.2" fill="none" stroke={C.restricted} strokeWidth="0.45" />}
    </g>
  );
}

function EggCluster({ x, y, seed = 1, n = 6, spread = 12, s = 1.3 }) {
  const rng = seededRandom(seed * 31 + 5);
  const eggs = Array.from({ length: n }, (_, i) => {
    const a = rng() * Math.PI * 2, r = (i === 0 ? 0 : 0.45 + rng() * 0.55) * spread;
    return [x + Math.cos(a) * r, y + Math.sin(a) * r * 0.75, rng() < 0.25];
  });
  return <g>{eggs.map(([ex, ey, open], i) => <Egg key={i} x={ex} y={ey} s={s} open={open} />)}</g>;
}

/* Cocooned remains: a body-length husk wrapped in resin, set into a wall. */
function Cocoon({ x, y, rot = 0 }) {
  const C = useMapTheme();
  return (
    <g transform={`rotate(${rot},${x},${y})`} opacity="0.8">
      <ellipse cx={x} cy={y} rx={3.4} ry={8.5} fill={RESIN.fill} stroke={RESIN.edge} strokeWidth="0.6" />
      {[-5, -2, 1, 4].map((d) => <path key={d} d={`M ${x - 3.2} ${y + d} q 3.2 1.6 6.4 0`} fill="none" stroke={RESIN.rib} strokeWidth="0.35" />)}
      <circle cx={x} cy={y - 6} r={1.3} fill="none" stroke={C.textDim} strokeWidth="0.4" />
    </g>
  );
}

/* Hypersleep pod outline (open pods show the lid swung aside). */
function Pod({ x, y, state = 'closed' }) {
  const C = useMapTheme();
  const col = state === 'forced' ? C.restricted : C.accent;
  return (
    <g opacity="0.75">
      <rect x={x - 7} y={y - 14} width={14} height={28} rx={6} fill={C.hullDeep} stroke={C.equipLine} strokeWidth="0.6" />
      <rect x={x - 4.5} y={y - 10} width={9} height={20} rx={4} fill="none" stroke={col} strokeWidth="0.4" opacity="0.6" />
      {state !== 'closed' && (
        <rect x={x + 3} y={y - 15} width={14} height={28} rx={6} fill="none" stroke={col} strokeWidth="0.5"
          strokeDasharray="2 1.5" transform={`rotate(${state === 'forced' ? 24 : 12},${x + 3},${y - 15})`} />
      )}
      {state === 'forced' && <path d={`M ${x - 4} ${y - 3} l 2 2 l 1 -3 l 2 3 l 2 -2`} fill="none" stroke={C.restricted} strokeWidth="0.5" />}
      <circle cx={x} cy={y - 8} r={1} fill={col} opacity="0.7" />
    </g>
  );
}

/* Hazard chevron band. */
function Chevrons({ x, y, w, h = 6 }) {
  const C = useMapTheme();
  const n = Math.floor(w / 6);
  return (
    <g opacity="0.75">
      <rect x={x} y={y} width={w} height={h} fill={C.hullDeep} stroke={C.restricted} strokeWidth="0.5" />
      {Array.from({ length: n }, (_, i) => <line key={i} x1={x + i * 6 + 1} y1={y + h} x2={x + i * 6 + 5} y2={y} stroke={C.restricted} strokeWidth="1.1" opacity="0.7" />)}
    </g>
  );
}

/* ─── MAIN DECK ──────────────────────────────────────────────────────── */
function MainDecor() {
  const C = useMapTheme();
  return (
    <g>
      {/* hive growth spreading along the spine and into the forward rooms */}
      <Resin x={550} y={268} rx={28} ry={34} seed={3} />
      <Resin x={548} y={372} rx={26} ry={44} seed={4} />
      <Resin x={552} y={470} rx={24} ry={30} seed={5} opacity={0.5} />
      <Resin x={546} y={566} rx={26} ry={36} seed={6} />
      <Resin x={470} y={626} rx={30} ry={12} seed={7} opacity={0.5} />
      <Resin x={470} y={202} rx={18} ry={16} seed={8} opacity={0.5} />
      <Resin x={354} y={372} rx={24} ry={14} seed={9} />
      <Resin x={598} y={334} rx={16} ry={10} seed={10} opacity={0.5} />
      <Resin x={586} y={486} rx={14} ry={12} seed={11} opacity={0.45} />
      <Tendril d="M 528 300 C 512 306, 498 330, 470 336" />
      <Tendril d="M 572 260 C 590 262, 600 252, 616 254" w={4} />
      <Tendril d="M 528 545 C 512 548, 506 560, 486 566" w={4} />

      {/* BRIDGE: viewports, console arc, captain's chair, last stand */}
      {[-56, -28, 0, 28, 56].map((dx) => <rect key={dx} x={550 + dx - 9} y={126} width={18} height={4} rx={1.5} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.4" opacity="0.6" />)}
      <path d="M 488 152 Q 550 132 612 152" fill="none" stroke={C.equipLine} strokeWidth="5" opacity="0.35" />
      {[496, 520, 550, 580, 604].map((x) => <rect key={x} x={x - 5} y={x === 550 ? 138 : 143} width={10} height={6} rx={0.6} fill="none" stroke={C.accent} strokeWidth="0.45" opacity="0.55" />)}
      <Tiny x={612} y={162} color={C.restricted} size={3.2}>NAV · DAMAGED</Tiny>
      <circle cx={550} cy={205} r={5} fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.55" />
      <Tiny x={550} y={216} size={3}>COMMAND</Tiny>
      <Dots points={[[598, 196], [603, 201], [607, 194], [612, 204], [596, 207], [618, 198]]} r={0.9} color={C.restricted} />
      <path d="M 494 176 q 6 10 2 22 q -2 6 4 12" fill="none" stroke={C.restricted} strokeWidth="0.9" opacity="0.6" />
      <Tiny x={500} y={220} color={C.restricted} size={3}>ACID SCORING</Tiny>

      {/* SCIENCE LAB / CONTAINMENT: shattered specimen cells, benches, sealed tank */}
      {[252, 288, 324].map((y, i) => (
        <g key={y}>
          <circle cx={350} cy={y} r={11} fill={C.hullDeep} stroke={C.equipLine} strokeWidth="0.6" opacity="0.8" />
          <path d={`M ${350 - 11} ${y} A 11 11 0 0 1 ${350 + 4} ${y - 10}`} fill="none" stroke={C.accent} strokeWidth="0.7" opacity="0.6" />
          <path d={`M ${354} ${y - 10} l 4 -3 m -2 6 l 6 -2 m -6 6 l 7 1`} stroke={C.restricted} strokeWidth="0.5" opacity="0.75" />
          <Dots points={[[366, y - 4], [369, y + 2], [364, y + 7]]} r={0.8} color={C.restricted} />
          <Tiny x={350} y={y + 2} size={3} color={C.textDim}>{`C-${i + 1}`}</Tiny>
        </g>
      ))}
      <Tiny x={350} y={348} size={3} color={C.restricted}>BROKEN</Tiny>
      <Tiny x={350} y={353} size={3} color={C.restricted}>OUTWARD</Tiny>
      <Table x={392} y={244} w={74} h={9} />
      <Table x={392} y={262} w={74} h={9} />
      {[404, 428, 452].map((x) => <rect key={x} x={x - 4} y={246} width={8} height={5} fill="none" stroke={C.accent} strokeWidth="0.4" opacity="0.5" />)}
      <path d="M 404 276 l 10 6 m 4 -4 l 6 10 m 14 -8 l 4 7" stroke={C.equipLine} strokeWidth="0.6" opacity="0.5" />
      {/* sealed containment chamber */}
      <rect x={444} y={326} width={78} height={56} rx={3} fill={C.hullDeep} stroke={C.restricted} strokeWidth="0.8" opacity="0.9" />
      <rect x={448} y={330} width={70} height={48} rx={2} fill="none" stroke={C.restricted} strokeWidth="0.4" strokeDasharray="3 2" opacity="0.7" />
      <circle cx={483} cy={354} r={14} fill="#0b2a2a" stroke={C.vent} strokeWidth="0.8" />
      <circle cx={483} cy={354} r={9} fill="none" stroke={C.vent} strokeWidth="0.4" opacity="0.6" />
      <path d="M 476 343 L 481 350 L 478 355 L 485 361 L 483 368" fill="none" stroke={C.restricted} strokeWidth="0.8" />
      <path d="M 481 350 L 489 347 M 485 361 L 492 360" fill="none" stroke={C.restricted} strokeWidth="0.5" />
      <path d="M 480 356 q 3 -4 6 0 q -3 5 -6 0" fill="none" stroke={RESIN.rib} strokeWidth="0.6" opacity="0.8" />
      <Tiny x={483} y={377} size={3} color={C.restricted}>CRACKED TANK</Tiny>
      <Tiny x={483} y={335} size={3} color={C.restricted}>SEALED CONTAINMENT</Tiny>

      {/* CREW QUARTERS: bunks, lockers, welded door */}
      {[342, 376, 410, 444, 478].map((x) => <rect key={x} x={x} y={403} width={26} height={11} rx={0.8} fill="none" stroke={C.accent} strokeWidth="0.45" opacity="0.45" />)}
      {[342, 376, 444, 478].map((x) => <rect key={x} x={x} y={482} width={26} height={11} rx={0.8} fill="none" stroke={C.accent} strokeWidth="0.45" opacity="0.45" />)}
      <path d="M 519 436 l 4 2 l -4 2 l 4 2 l -4 2 l 4 2 l -4 2 l 4 2 l -4 2 l 4 2 l -4 2" fill="none" stroke={C.restricted} strokeWidth="0.8" />
      <Tiny x={512} y={432} anchor="end" color={C.restricted} size={3.2}>WELDED</Tiny>
      <Tiny x={512} y={468} anchor="end" color={C.restricted} size={3}>KNOCKING ◂</Tiny>

      {/* COMMS ARRAY: transmitter racks, looping beacon, feed to the dish */}
      {[518, 534, 550, 566, 582].map((y) => <rect key={y} x={338} y={y} width={22} height={10} fill={purl('hatch')} stroke={C.equipLine} strokeWidth="0.45" opacity="0.8" />)}
      <Table x={470} y={584} w={46} h={9} />
      {[8, 14, 20].map((r) => <path key={r} d={`M ${492 - r} 548 A ${r} ${r} 0 0 1 ${492 + r} 548`} fill="none" stroke={C.accent} strokeWidth="0.5" opacity={0.7 - r / 40} />)}
      <circle cx={492} cy={548} r={1.6} fill={C.accent} opacity="0.8" />
      <Tiny x={492} y={556} color={C.accent} size={3}>DISTRESS LOOP</Tiny>
      <line x1={338} y1={554} x2={300} y2={554} stroke={C.vent} strokeWidth="0.9" strokeDasharray="3 2" opacity="0.6" />

      {/* MEDICAL BAY: surgical table, lamp, overturned kit, blood */}
      <rect x={598} y={298} width={44} height={14} rx={2} fill={C.hullDeep} stroke={C.accent} strokeWidth="0.6" opacity="0.75" />
      <circle cx={620} cy={305} r={11} fill="none" stroke={C.accent} strokeWidth="0.4" strokeDasharray="1.5 2" opacity="0.5" />
      <Tiny x={620} y={322} size={3}>SURGICAL TABLE</Tiny>
      <rect x={714} y={300} width={16} height={10} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.6" transform="rotate(32,722,305)" />
      <rect x={736} y={290} width={12} height={8} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.6" transform="rotate(-48,742,294)" />
      <Tiny x={734} y={326} size={3}>OVERTURNED</Tiny>
      <Dots points={[[650, 312], [654, 316], [660, 314], [606, 324], [702, 260], [698, 264]]} r={1.4} color={C.restricted} />
      <rect x={582} y={238} width={14} height={9} fill="none" stroke={C.restricted} strokeWidth="0.5" opacity="0.7" />
      <path d="M 584 240 l 5 5 l 3 -4" fill="none" stroke={C.restricted} strokeWidth="0.4" />
      <Tiny x={604} y={245} anchor="start" size={3} color={C.restricted}>AUTOPSY LOG</Tiny>

      {/* CRYO BAY: two rows of pods, open, some forced from inside */}
      {[594, 624, 654, 688, 718, 748].map((x, i) => <Pod key={`t${x}`} x={x} y={378} state={i === 1 || i === 4 ? 'forced' : 'open'} />)}
      {[594, 624, 718, 748].map((x, i) => <Pod key={`b${x}`} x={x} y={474} state={i === 2 ? 'forced' : 'open'} />)}
      <Table x={644} y={460} w={52} h={10} />
      <Tiny x={670} y={480} size={3}>BIO-READOUTS</Tiny>

      {/* DOCKING AIRLOCK: inner and outer hatches, cycle markings */}
      <line x1={610} y1={512} x2={610} y2={596} stroke={C.door} strokeWidth="1.4" strokeDasharray="4 2" opacity="0.6" />
      <Tiny x={606} y={554} size={3} rotate={-90}>INNER HATCH</Tiny>
      <line x1={790} y1={530} x2={790} y2={578} stroke={C.door} strokeWidth="1.6" opacity="0.7" />
      <Chevrons x={622} y={512} w={60} h={5} />
      <Chevrons x={622} y={591} w={60} h={5} />
      <Tiny x={760} y={590} size={3}>OUTER HATCH ▸</Tiny>

      {/* EEV BAY: the escape vehicle in its cradle */}
      <path d="M 346 722 L 404 716 Q 426 722 404 728 L 346 734 Q 338 728 346 722 Z" fill={C.hullDeep} stroke={C.accent} strokeWidth="0.6" opacity="0.8" />
      <rect x={356} y={720} width={6} height={10} fill="none" stroke={C.accent} strokeWidth="0.4" opacity="0.6" />
      <line x1={334} y1={728} x2={340} y2={728} stroke={C.restricted} strokeWidth="1.2" />
      <Tiny x={380} y={712} size={3}>EEV · LOCKS MANUAL</Tiny>

      {/* LOWER DECK ACCESS: blast door, warnings */}
      <Chevrons x={500} y={644} w={100} h={7} />
      <Tiny x={594} y={712} size={3.2} color={C.restricted}>DANGER · GEFAHR</Tiny>
      <Tiny x={594} y={718} size={3.2} color={C.restricted}>PELIGRO · 危險</Tiny>
      <Tiny x={594} y={724} size={3.2} color={C.restricted}>DO NOT OPEN</Tiny>

      {/* SCRUBBER PLANT: filter stacks clogged with spores */}
      {[668, 698, 728].map((x, i) => (
        <g key={x}>
          <circle cx={x} cy={722} r={9} fill={C.hullDeep} stroke={C.shaft} strokeWidth="0.6" opacity="0.8" />
          {[0, 60, 120, 180, 240, 300].map((a) => { const r = (a * Math.PI) / 180; return <line key={a} x1={x + Math.cos(r) * 2.5} y1={722 + Math.sin(r) * 2.5} x2={x + Math.cos(r) * 7.5} y2={722 + Math.sin(r) * 7.5} stroke={C.shaft} strokeWidth="0.3" opacity="0.5" />; })}
          {i < 2 && <circle cx={x + 3} cy={719} r={2.4} fill={RESIN.fill} stroke={RESIN.edge} strokeWidth="0.4" />}
        </g>
      ))}

      {/* aft machinery below the main deck rooms */}
      {[[306, 752, 214, 44, 'DRIVE HOUSING · PORT'], [580, 752, 214, 44, 'DRIVE HOUSING · STBD']].map(([x, y, w, h, t]) => (
        <g key={x}>
          <rect x={x} y={y} width={w} height={h} rx={2} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.7" opacity="0.7" />
          <rect x={x} y={y} width={w} height={h} rx={2} fill={purl('hatch')} />
          {[0.25, 0.5, 0.75].map((k) => <circle key={k} cx={x + w * k} cy={y + h / 2} r={9} fill="none" stroke={C.equipLine} strokeWidth="0.6" opacity="0.7" />)}
          <Tiny x={x + w / 2} y={y + h + 7} size={3.6} color={C.hullDeep}>{t}</Tiny>
        </g>
      ))}
      <rect x={530} y={750} width={40} height={80} rx={2} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.6" opacity="0.6" />
      {[760, 772, 784, 796, 808, 820].map((y) => <line key={y} x1={534} y1={y} x2={566} y2={y} stroke={C.equipLine} strokeWidth="0.6" opacity="0.7" />)}
      <Tiny x={420} y={826} size={3.6} color={C.hullDeep}>REACTOR · ENGINEERING ▼ LOWER DECKS</Tiny>
    </g>
  );
}

/* ─── LOWER DECKS ────────────────────────────────────────────────────── */
function NestZone() {
  const C = useMapTheme();
  /* organic boundary following the old bulkheads */
  const outer = wavyRect(338, 204, 762, 464, 14, 7);
  return (
    <g>
      <path d={outer} fill={RESIN.deep} stroke={RESIN.edge} strokeWidth="1.4" />
      <path d={outer} fill="none" stroke={C.restricted} strokeWidth="0.5" strokeDasharray="3 4" opacity="0.5" />
      {/* ribbed texture: layered curved strands */}
      <g opacity="0.45">
        {Array.from({ length: 22 }, (_, i) => {
          const y = 214 + i * 11.5;
          return <path key={i} d={`M 340 ${y} Q 400 ${y + (i % 2 ? 7 : -6)} 450 ${y + 2} T 560 ${y - 1} T 660 ${y + 3} T 762 ${y}`} fill="none" stroke={RESIN.rib} strokeWidth="0.4" />;
        })}
      </g>
      {/* swallowed bulkheads of the old lower-deck rooms */}
      <g opacity="0.35" fill="none" stroke={C.hullOutline} strokeWidth="0.6" strokeDasharray="4 3">
        <rect x={344} y={212} width={150} height={110} />
        <rect x={606} y={212} width={150} height={110} />
        <rect x={344} y={340} width={150} height={112} />
        <rect x={606} y={340} width={150} height={112} />
      </g>
      <g opacity="0.55">
        <Tiny x={350} y={220} anchor="start" size={3}>FMR HYDROPONICS</Tiny>
        <Tiny x={750} y={220} anchor="end" size={3}>FMR LAB 2</Tiny>
        <Tiny x={350} y={448} anchor="start" size={3}>FMR MESS</Tiny>
        <Tiny x={750} y={448} anchor="end" size={3}>FMR STORES</Tiny>
      </g>
      {/* resin pillars and walls grown across the deck */}
      {[[420, 268, 22, 30, 21], [690, 280, 26, 22, 22], [446, 404, 30, 20, 23], [668, 400, 22, 28, 24], [612, 236, 16, 11, 25], [372, 332, 14, 22, 26], [732, 352, 14, 20, 27]].map(([x, y, rx, ry, s]) => (
        <g key={s}>
          <path d={blobPath(x, y, rx, ry, s)} fill={RESIN.fill} stroke={RESIN.edge} strokeWidth="0.9" />
          {[0.7, 0.45].map((k) => <path key={k} d={blobPath(x, y, rx * k, ry * k, s + 3, 9, 0.3)} fill="none" stroke={RESIN.rib} strokeWidth="0.4" opacity="0.6" />)}
        </g>
      ))}
      {/* central chamber */}
      <path d={blobPath(552, 376, 70, 46, 41, 13, 0.18)} fill="none" stroke={RESIN.edge} strokeWidth="1" opacity="0.8" />
      <path d={blobPath(552, 376, 62, 39, 42, 13, 0.18)} fill="none" stroke={RESIN.rib} strokeWidth="0.4" strokeDasharray="2 2" opacity="0.6" />
      {/* eggs: the main clutch in the chamber, smaller clusters elsewhere */}
      <EggCluster x={530} y={380} seed={1} n={9} spread={20} s={1.5} />
      <EggCluster x={588} y={386} seed={2} n={6} spread={14} s={1.4} />
      <EggCluster x={392} y={244} seed={3} n={5} spread={12} />
      <EggCluster x={720} y={430} seed={4} n={5} spread={12} />
      <EggCluster x={660} y={236} seed={5} n={4} spread={10} />
      {/* cocooned remains set into the walls */}
      {[[348, 286, 0], [348, 312, 0], [348, 392, 0], [752, 266, 0], [752, 294, 0], [752, 384, 0], [470, 222, 90], [640, 454, 90], [490, 454, 90]].map(([x, y, r], i) => <Cocoon key={i} x={x} y={y} rot={r} />)}
      {/* labels */}
      <rect x={496} y={268} width={112} height={22} rx={2} fill={RESIN.deep} opacity="0.85" />
      <text x={552} y={278} fill={C.textBright} fontSize="6.4" textAnchor="middle" letterSpacing="0.08em">LOWER DECKS — THE NEST</text>
      <text x={552} y={286} fill={C.restricted} fontSize="4.6" textAnchor="middle" letterSpacing="0.12em">EXTREME HAZARD</text>
      <Tiny x={552} y={428} color={C.restricted} size={3.4}>EGG CHAMBER</Tiny>
      <Tiny x={760} y={238} anchor="end" color={C.textDim} size={3}>COCOONED REMAINS</Tiny>
      {/* restricted markers on the approaches */}
      {[[552, 456], [552, 206], [342, 262], [758, 262]].map(([x, y], i) => (
        <g key={i} opacity="0.85">
          <circle cx={x} cy={y} r={3.6} fill="none" stroke={C.restricted} strokeWidth="0.7" />
          <line x1={x - 2} y1={y + 2} x2={x + 2} y2={y - 2} stroke={C.restricted} strokeWidth="0.6" />
        </g>
      ))}
    </g>
  );
}

function LowerDecor() {
  const C = useMapTheme();
  return (
    <g>
      {/* resin creeping out of the nest */}
      <Resin x={550} y={500} rx={22} ry={30} seed={51} opacity={0.65} />
      <Resin x={548} y={584} rx={18} ry={22} seed={52} opacity={0.45} />
      <Resin x={322} y={300} rx={10} ry={46} seed={53} opacity={0.6} ribs={2} />
      <Resin x={778} y={330} rx={10} ry={60} seed={54} opacity={0.6} ribs={2} />
      <Resin x={360} y={498} rx={26} ry={14} seed={55} opacity={0.55} />
      <Resin x={500} y={190} rx={30} ry={8} seed={56} opacity={0.5} ribs={1} />
      <Tendril d="M 322 360 C 322 420, 318 470, 322 520" w={6} />
      <Tendril d="M 528 520 C 510 524, 500 540, 478 544" w={4} />
      <Tendril d="M 572 488 C 596 492, 606 500, 624 498" w={4} />
      <EggCluster x={366} y={498} seed={57} n={3} spread={8} s={1.1} />

      {/* SENSOR BAY */}
      {[476, 500, 600, 624].map((x) => <rect key={x} x={x - 8} y={134} width={16} height={9} fill={purl('hatch')} stroke={C.equipLine} strokeWidth="0.45" opacity="0.8" />)}
      <line x1={550} y1={128} x2={550} y2={140} stroke={C.vent} strokeWidth="1" opacity="0.6" />

      {/* CARGO HOLD: crate racks and the urns */}
      {[0, 1, 2, 3].flatMap((c) => [0, 1].map((r) => (
        <rect key={`${c}-${r}`} x={388 + c * 30} y={490 + r * 16} width={24} height={11} fill={c === 1 && r === 1 ? 'none' : C.hullDeep}
          stroke={c === 1 && r === 1 ? C.restricted : C.equipLine} strokeWidth="0.5" strokeDasharray={c === 1 && r === 1 ? '2 1.5' : undefined} opacity="0.75" />
      )))}
      <Tiny x={436} y={530} size={3}>SAMPLE CRATES</Tiny>
      {[350, 372, 394, 416, 438, 460, 482, 504].map((x, i) => (
        <g key={x} opacity="0.85">
          <circle cx={x} cy={604} r={7} fill={C.hullDeep} stroke={i === 3 ? C.restricted : C.accent} strokeWidth="0.6" />
          <circle cx={x} cy={604} r={3} fill="none" stroke={i === 3 ? C.restricted : C.accent} strokeWidth="0.4" opacity="0.6" />
          {i === 3 && <path d={`M ${x - 5} 601 l 3 -3 l 2 4 l 3 -4`} fill="none" stroke={C.restricted} strokeWidth="0.5" />}
        </g>
      ))}
      <line x1={340} y1={594} x2={516} y2={594} stroke={C.equipLine} strokeWidth="0.5" opacity="0.5" />
      <line x1={340} y1={614} x2={516} y2={614} stroke={C.equipLine} strokeWidth="0.5" opacity="0.5" />
      <Tiny x={428} y={624} size={3} color={C.restricted}>“ARTIFACTS” · ONE URN BREACHED</Tiny>

      {/* MAINTENANCE STORES */}
      {[488, 548].map((y) => <line key={y} x1={600} y1={y} x2={760} y2={y} stroke={C.equipLine} strokeWidth="1.6" opacity="0.35" />)}
      {[732, 748].map((x) => <circle key={x} cx={x} cy={530} r={5} fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.5" />)}
      <Tiny x={740} y={542} size={3}>EVA</Tiny>

      {/* CARGO LOCK */}
      <line x1={790} y1={578} x2={790} y2={622} stroke={C.door} strokeWidth="1.6" opacity="0.7" />
      <Chevrons x={640} y={572} w={84} h={5} />
      <Chevrons x={640} y={623} w={84} h={5} />

      {/* COOLANT PUMPS */}
      {[352, 380].map((x) => <g key={x}><circle cx={x} cy={706} r={7} fill="none" stroke={C.vent} strokeWidth="0.6" opacity="0.7" /><circle cx={x} cy={706} r={2} fill={C.vent} opacity="0.5" /></g>)}
      <path d="M 352 699 L 352 652 L 420 652" fill="none" stroke={C.vent} strokeWidth="1" strokeDasharray="3 2" opacity="0.5" />

      {/* LADDER LANDING: the barricade that failed */}
      <path d="M 496 664 l 8 -6 l 6 8 l 8 -7 l 6 6 l 8 -8 l 6 7" fill="none" stroke={C.equipLine} strokeWidth="1.4" opacity="0.6" />
      <path d="M 528 672 l 6 -4 l 4 5" fill="none" stroke={C.restricted} strokeWidth="0.7" opacity="0.6" />
      <Dots points={[[586, 700], [590, 704], [596, 699], [602, 706], [608, 701]]} r={0.8} color={C.accent} />
      <Tiny x={598} y={714} size={3}>SPENT ROUNDS</Tiny>

      {/* ENGINEERING: drive consoles, power distribution */}
      {[660, 690, 720, 750].map((y) => <rect key={y} x={782} y={y + 50} width={8} height={18} fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.5" />)}
      <Machine x={650} y={772} w={70} h={30} label="POWER DISTRIBUTION" />
      <Table x={652} y={658} w={60} h={10} />
      <Tiny x={682} y={676} size={3}>DRIVE CONTROL</Tiny>

      {/* REACTOR ROOM */}
      <circle cx={360} cy={775} r={38} fill={C.hullDeep} stroke={C.equipLine} strokeWidth="0.8" opacity="0.85" />
      <circle cx={360} cy={775} r={26} fill="none" stroke={C.restricted} strokeWidth="0.6" strokeDasharray="3 3" opacity="0.6" />
      <circle cx={360} cy={775} r={12} fill="none" stroke={C.accent} strokeWidth="0.7" opacity="0.6" />
      <circle cx={360} cy={775} r={4} fill={C.restricted} opacity="0.5" />
      {Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return <line key={i} x1={360 + Math.cos(a) * 13} y1={775 + Math.sin(a) * 13} x2={360 + Math.cos(a) * 36} y2={775 + Math.sin(a) * 36} stroke={C.equipLine} strokeWidth="0.4" opacity="0.5" />; })}
      <Tiny x={360} y={824} color={C.restricted} size={3.4}>CONTAINMENT UNSTABLE</Tiny>
      <Table x={560} y={760} w={60} h={12} />
      {[570, 588, 606].map((x) => <rect key={x} x={x - 4} y={762} width={8} height={8} fill="none" stroke={C.accent} strokeWidth="0.4" opacity="0.6" />)}
      <Tiny x={590} y={782} size={3}>CONTROL STATION</Tiny>
      <Resin x={300} y={740} rx={14} ry={12} seed={58} opacity={0.5} ribs={1} />
    </g>
  );
}
const Main = () => (
  <LevelPlan rooms={cronusRooms} doors={cronusDoors} stairs={stairsFor('main')} level="main"
    conduits={DUCTS} grates={DUCT_GRATES} decorate={() => <MainDecor />} />
);

const Lower = () => (
    <g>
      <rect x="0" y="0" width={W} height={H} fill="#03080a" opacity="0.38" />
      <LevelPlan rooms={cronusRooms} doors={cronusDoors} stairs={stairsFor('lower')} level="lower"
        decorate={() => <g><NestZone /><LowerDecor /></g>} />
    </g>
);

/* ─── Hull dressing ──────────────────────────────────────────────────── */
function hullBackground(C) {
  return (
    <g>
      {/* three main drive bells under the stern */}
      {[400, 550, 700].map((x) => (
        <g key={x}>
          <path d={`M ${x - 34} 842 L ${x - 44} 884 L ${x + 44} 884 L ${x + 34} 842 Z`} fill={purl('nozGrad')} stroke={C.hullDark} strokeWidth="0.6" />
          {[856, 868, 878].map((y) => <line key={y} x1={x - 38 - (y - 846) * 0.15} y1={y} x2={x + 38 + (y - 846) * 0.15} y2={y} stroke={C.hullOutline} strokeWidth="0.3" opacity="0.3" />)}
        </g>
      ))}
      {/* radiator fins on the engineering block */}
      {[[838, 1], [262, -1]].map(([x, dir]) => (
        <g key={x}>
          <path d={`M ${x} 716 L ${x + dir * 22} 724 L ${x + dir * 22} 808 L ${x} 814 Z`} fill={purl('nacGrad')} stroke={C.hullOutline} strokeWidth="0.6" />
          {[734, 750, 766, 782, 798].map((y) => <line key={y} x1={x + dir * 3} y1={y} x2={x + dir * 20} y2={y} stroke={C.divider} strokeWidth="0.5" opacity="0.6" />)}
        </g>
      ))}
    </g>
  );
}

function hullOverlays(C) {
  return (
    <g>
      <g opacity="0.18">
        {[150, 230, 320, 420, 520, 620, 700, 760].map((y) => <line key={y} x1={262} y1={y} x2={840} y2={y} stroke={C.hullOutline} strokeWidth="0.5" strokeDasharray="2 10" />)}
      </g>
      <g opacity="0.14">
        <line x1={308} y1={240} x2={308} y2={690} stroke={C.hullOutline} strokeWidth="0.6" />
        <line x1={792} y1={240} x2={792} y2={690} stroke={C.hullOutline} strokeWidth="0.6" />
        <path d={OUTLINE_PTS.map(([x, y], i) => `${i ? 'L' : 'M'} ${x + (550 - x) * 0.03} ${y + (480 - y) * 0.03}`).join(' ') + ' Z'} fill="none" stroke={C.hullOutline} strokeWidth="0.6" />
      </g>
      {/* age: scorch and micrometeorite scarring */}
      <g opacity="0.35">
        <path d={blobPath(772, 690, 22, 10, 61)} fill="#0b1a16" />
        <path d={blobPath(326, 180, 14, 20, 62)} fill="#0b1a16" />
        <Dots points={[[760, 180], [766, 186], [744, 196], [320, 640], [312, 610], [818, 760]]} r={1.2} color={C.hullDeep} />
      </g>
      <text x={824} y={770} fill={C.hullDeep} fontSize="9" letterSpacing="0.3em" opacity="0.5" transform="rotate(90,824,770)" textAnchor="middle">W-Y</text>
    </g>
  );
}

function exteriorDetails(C) {
  return (
    <g opacity="0.7">
      {/* forward sensor boom, angled off the port bow */}
      <line x1={458} y1={106} x2={426} y2={58} stroke={C.hullOutline} strokeWidth="1.6" />
      {[0.25, 0.5, 0.75].map((t) => { const x = 458 - 32 * t, y = 106 - 48 * t; return <line key={t} x1={x - 5} y1={y + 1} x2={x + 5} y2={y - 1} stroke={C.hullOutline} strokeWidth="0.6" />; })}
      <rect x={414} y={46} width={24} height={12} rx={2} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.7" />
      <circle cx={426} cy={52} r={3} fill="none" stroke={C.accent} strokeWidth="0.6" />
      <Tiny x={410} y={54} anchor="end" size={4}>SENSOR BOOM</Tiny>
      {/* starboard bow whip antenna */}
      <line x1={690} y1={120} x2={716} y2={84} stroke={C.hullOutline} strokeWidth="0.6" />
      <circle cx={716} cy={84} r={2} fill="none" stroke={C.hullOutline} strokeWidth="0.5" />
      {/* comms dish, port side by the array */}
      <line x1={300} y1={554} x2={274} y2={554} stroke={C.hullOutline} strokeWidth="1.4" />
      <line x1={300} y1={540} x2={278} y2={552} stroke={C.hullOutline} strokeWidth="0.5" />
      <line x1={300} y1={568} x2={278} y2={556} stroke={C.hullOutline} strokeWidth="0.5" />
      <path d="M 266 520 Q 290 554 266 588" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="1" />
      <line x1={270} y1={554} x2={244} y2={554} stroke={C.hullOutline} strokeWidth="0.6" />
      <circle cx={242} cy={554} r={2} fill={C.accent} opacity="0.8" />
      {[8, 14, 20].map((r) => <path key={r} d={`M ${236 - r * 0.2} ${554 - r} A ${r} ${r} 0 0 0 ${236 - r * 0.2} ${554 + r}`} fill="none" stroke={C.accent} strokeWidth="0.4" opacity={0.6 - r / 50} />)}
      <Tiny x={268} y={600} size={4}>COMMS DISH</Tiny>
      <Tiny x={268} y={606} size={3.2} color={C.accent}>TRANSMITTING</Tiny>
      {/* Montero umbilical at the starboard docking collar */}
      <rect x={800} y={538} width={12} height={32} rx={2} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.7" />
      <path d="M 812 544 L 878 544 M 812 564 L 878 564" stroke={C.accent} strokeWidth="0.8" />
      {[824, 836, 848, 860, 872].map((x) => <line key={x} x1={x} y1={544} x2={x} y2={564} stroke={C.accent} strokeWidth="0.4" opacity="0.5" />)}
      <Tiny x={880} y={552} anchor="start" size={4.2} color={C.accent}>UMBILICAL ▸</Tiny>
      <Tiny x={880} y={559} anchor="start" size={4.2} color={C.accent}>USCSS MONTERO</Tiny>
      {/* ventral cargo collar */}
      <rect x={800} y={588} width={8} height={24} rx={1.5} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.6" />
      <Tiny x={814} y={603} anchor="start" size={3.4}>CARGO COLLAR (LOWER)</Tiny>
      {/* RCS quads */}
      {[[300, 300, -1], [800, 300, 1], [262, 760, -1], [840, 690, 1]].map(([x, y, dir], i) => (
        <g key={i}>
          <rect x={x + (dir < 0 ? -6 : 0)} y={y - 2} width={6} height={4} fill="none" stroke={C.hullOutline} strokeWidth="0.4" rx="0.5" />
          <Tiny x={x + dir * 13} y={y + 1.5} size={3}>RCS</Tiny>
        </g>
      ))}
    </g>
  );
}

/* ─── Legend extras ──────────────────────────────────────────────────── */
const cronusLegend = (C) => alienLegend([
  { label: 'HIVE RESIN / GROWTH', draw: (y) => <path d={blobPath(5, y - 1, 6, 4.5, 71, 9, 0.3)} fill={RESIN.fill} stroke={RESIN.edge} strokeWidth="0.6" /> },
  { label: 'ALIEN EGGS', draw: (y) => <g><Egg x={3} y={y - 1} s={0.9} /><Egg x={9} y={y - 1} s={0.9} open /></g> },
  { label: 'COCOONED REMAINS', draw: (y) => <Cocoon x={5} y={y - 1} rot={90} /> },
  { label: 'SEALED / WELDED DOOR', draw: (y) => <circle cx="5" cy={y - 1} r="2.6" fill="none" stroke={C.restricted} strokeWidth="0.7" /> },
])(C);

export const cronusConfig = {
  width: W,
  height: H,
  stars: { count: 220, seed: 2110 },
  backdrop: 'space',
  levelNoun: 'DECK',
  scenarioTag: 'CHARIOT OF THE GODS',
  hull: { path: OUTLINE, background: hullBackground, overlays: hullOverlays },
  exteriorDetails,
  sidebar: alienSidebar({ title: 'USCSS CRONUS', subtitle: 'WEYLAND-YUTANI SCIENCE VESSEL — DERELICT' }),
  decks: [
    { id: 'A', level: 'main', name: 'MAIN DECK', page: 'I', component: Main },
    { id: 'B', level: 'lower', name: 'LOWER DECKS', page: 'II', component: Lower },
  ],
  specs: {
    title: 'TECHNICAL SPECIFICATIONS',
    y: 834,
    items: [
      ['CLASS', 'W-Y deep-survey science vessel'],
      ['LENGTH', '412 METRES'],
      ['CREW', 'None responding'],
      ['COMPUTER', 'MU/TH/UR 2000'],
      ['ADRIFT', '75 years (launched 2110)'],
    ],
  },
  legend: cronusLegend,
};

/** Interactive plan, registered as universe.maps[uscss-cronus].engine */
export function CronusMap() {
  return <MapEngine config={cronusConfig} />;
}
CronusMap.config = cronusConfig;
