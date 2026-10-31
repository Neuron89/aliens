import React from 'react';
import MapEngine, { Room, Door, Vents, useMapTheme, registerIcon, purl } from '../../../engine/components/MapEngine';
import { DUNE_MAP_THEME } from './duneMapKit.jsx';
import {
  W, H, OUTLINE, O, R_OUT, R_IN, TOP, VIEW, LOW, arcPts, lanternRooms, lanternDoors,
} from './lantern.geometry.js';

/* ═══════════════════════════════════════════════════════════════════════
   THE LANTERN RING — MapEngine plan of the passenger ring aboard the
   Guild heighliner Long Vesper (one level). Rooms/doors come from
   lantern.geometry.js, which also feeds the normalized board rooms.

   The only Dune plan that is a ship interior: a cool Guild palette
   (pale composite, slate, spice-orange light) instead of sandstone, a
   star field seen through the hull viewports and the great viewport onto
   the hold, and the Navigator's tank glowing at the spinward apex.
   ═══════════════════════════════════════════════════════════════════════ */

/* Guild palette: slate and pale composite, amber doors, spice-orange accent. */
export const LANTERN_THEME = {
  ...DUNE_MAP_THEME,
  bg: '#04050a', bgMid: '#0b0e18',
  frame: '#2a2f3e', frameBright: '#3c4458',
  hull: '#3c4252', hullBright: '#4e5669',
  hullMid: '#333947', hullDark: '#262b37', hullDeep: '#151922', hullOutline: '#8b97b2',
  wall: '#30364a', wallBright: '#3c4458',
  floor: '#11141c', floorCrew: '#161a24',
  divider: '#3c4458', door: '#e8a850',
  equipLine: '#7c88a4',
  vent: '#62b8d2', shaft: '#e8a850',
  text: '#d6dae6', textBright: '#f2f4fa',
  textDim: '#8e96ab', textFaint: '#4c5468',
  accent: '#ea8f38', grid: '#2e3442',
  restricted: '#d2584a',
};

const SPICE = '#ff8a2a';
const GLASS = '#7fc4e0';
const [OX, OY] = O;

/* ─── Guild icons (registered once, prefixed lantern-) ───────────────── */
const ICONS = {
  'lantern-tank': (x, y, C) => (
    <g opacity="0.75">
      <ellipse cx={x} cy={y} rx="2.6" ry="3.8" fill={SPICE} opacity="0.25" />
      <ellipse cx={x} cy={y} rx="2.6" ry="3.8" fill="none" stroke={C.accent} strokeWidth="0.6" />
      <line x1={x - 3.6} y1={y} x2={x + 3.6} y2={y} stroke={C.accent} strokeWidth="0.35" opacity="0.6" />
    </g>
  ),
  'lantern-viewport': (x, y, C) => (
    <g opacity="0.8">
      <rect x={x - 4} y={y - 2.2} width="8" height="4.4" rx="2.2" fill={C.hullDeep} stroke={GLASS} strokeWidth="0.5" />
      <circle cx={x - 1.4} cy={y - 0.4} r="0.35" fill="#dde8f4" />
      <circle cx={x + 1.8} cy={y + 0.8} r="0.25" fill="#dde8f4" />
    </g>
  ),
  'lantern-hatch': (x, y, C) => (
    <g opacity="0.65" fill="none" stroke={C.equipLine} strokeWidth="0.5">
      <circle cx={x} cy={y} r="3.4" />
      <line x1={x - 2.4} y1={y - 2.4} x2={x + 2.4} y2={y + 2.4} />
      <line x1={x + 2.4} y1={y - 2.4} x2={x - 2.4} y2={y + 2.4} />
      <circle cx={x} cy={y} r="1" fill={C.equipLine} />
    </g>
  ),
  'lantern-seal': (x, y, C) => (
    <g opacity="0.75" fill="none" stroke={C.accent} strokeWidth="0.55">
      {/* the Guild infinity, closed in a seal ring */}
      <path d={`M ${x} ${y} C ${x - 1.2} ${y - 2}, ${x - 3.4} ${y - 2}, ${x - 3.4} ${y} C ${x - 3.4} ${y + 2}, ${x - 1.2} ${y + 2}, ${x} ${y} C ${x + 1.2} ${y - 2}, ${x + 3.4} ${y - 2}, ${x + 3.4} ${y} C ${x + 3.4} ${y + 2}, ${x + 1.2} ${y + 2}, ${x} ${y} Z`} />
      <circle cx={x} cy={y} r="4.4" strokeDasharray="1 0.9" opacity="0.6" />
    </g>
  ),
};
for (const [name, fn] of Object.entries(ICONS)) registerIcon(name, fn);

/* ─── Hull: ribs, inner face, viewports (inside the hull clip, behind rooms) ─── */
const P = (pts) => `M ${pts.map(([x, y]) => `${x} ${y}`).join(' L ')}`;

function hullOverlays(C) {
  const ribs = [];
  for (let a = 4; a < 180; a += 6) {
    const r = (a * Math.PI) / 180;
    ribs.push([OX + Math.cos(r) * R_IN, OY + Math.sin(r) * R_IN, OX + Math.cos(r) * R_OUT, OY + Math.sin(r) * R_OUT]);
  }
  for (let y = TOP + 14; y < OY; y += 18) {
    ribs.push([OX - R_OUT, y, OX - R_IN, y]);
    ribs.push([OX + R_IN, y, OX + R_OUT, y]);
  }
  return (
    <g>
      {/* ring frame struts (show in the open hull below the plants) */}
      <g stroke={C.hullOutline} strokeWidth="0.5" opacity="0.18">
        {[18, 30, 42, 54, 66, 114, 126, 138, 150, 162].map((a) => {
          const r = (a * Math.PI) / 180;
          return <line key={a} x1={OX + Math.cos(r) * 150} y1={OY + Math.sin(r) * 150} x2={OX + Math.cos(r) * R_IN} y2={OY + Math.sin(r) * R_IN} />;
        })}
        {[230, 280].map((rad) => <path key={rad} d={`M ${OX + rad} ${OY} A ${rad} ${rad} 0 0 1 ${OX - rad} ${OY}`} fill="none" strokeDasharray="3 4" />)}
      </g>
      {/* hull plating ribs */}
      <g stroke={C.hullOutline} strokeWidth="0.45" opacity="0.32">
        {ribs.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />)}
      </g>
      {/* inner hull face: the ring reads as one curved band */}
      <path d={`M ${OX - R_IN} ${TOP + 10} L ${OX - R_IN} ${OY} A ${R_IN} ${R_IN} 0 0 0 ${OX + R_IN} ${OY} L ${OX + R_IN} ${TOP + 10}`}
        fill="none" stroke={C.hullOutline} strokeWidth="0.8" opacity="0.5" />
      {/* faint ring-radius guides across the plan */}
      {[R_IN - 26, 140].map((r) => (
        <path key={r} d={`M ${OX - r} ${TOP + 10} L ${OX - r} ${OY} A ${r} ${r} 0 0 0 ${OX + r} ${OY} L ${OX + r} ${TOP + 10}`}
          fill="none" stroke={C.hullOutline} strokeWidth="0.4" strokeDasharray="2 6" opacity="0.25" />
      ))}
      {/* bulkheads at the open end */}
      <rect x={OX - R_OUT} y={TOP} width={VIEW.cx - VIEW.r - (OX - R_OUT)} height="9" fill={purl('hatch')} opacity="0.9" />
      <rect x={VIEW.cx + VIEW.r} y={TOP} width={OX + R_OUT - VIEW.cx - VIEW.r} height="9" fill={purl('hatch')} opacity="0.9" />
    </g>
  );
}

/* Viewports through the outer hull: stars show through them. */
function hullViewports() {
  const out = [];
  for (let a = 16; a <= 164; a += 21) {
    if (a > 74 && a < 106) continue; // the tank wall has no ports
    const r = (a * Math.PI) / 180, rr = (R_IN + R_OUT) / 2;
    out.push({ x: OX + Math.cos(r) * rr, y: OY + Math.sin(r) * rr, rot: a + 90 });
  }
  for (let y = 150; y < OY - 20; y += 92) {
    out.push({ x: OX - (R_IN + R_OUT) / 2, y, rot: 90 });
    out.push({ x: OX + (R_IN + R_OUT) / 2, y: y + 46, rot: 90 });
  }
  return out;
}

function exterior(C) {
  const ports = hullViewports();
  const bite = arcPts(VIEW.cx, VIEW.cy, VIEW.r - 2, 180, 0, 24);
  const mullions = arcPts(VIEW.cx, VIEW.cy, VIEW.r, 180, 0, 8).slice(1, -1);
  const frigate = (x, y, s, o) => (
    <g transform={`translate(${x},${y}) scale(${s})`} opacity={o} fill="none" stroke={C.hullOutline} strokeWidth="0.6">
      <path d="M -26 0 L -18 -6 L 16 -6 L 26 0 L 16 6 L -18 6 Z" />
      <path d="M -18 -6 L -24 -12 M -18 6 L -24 12 M 6 -6 L 6 6" />
      <circle cx="18" cy="0" r="1.6" />
    </g>
  );
  return (
    <g>
      {/* hull viewports */}
      {ports.map((p, i) => (
        <g key={i} transform={`rotate(${p.rot},${p.x},${p.y})`}>
          <rect x={p.x - 6} y={p.y - 2.6} width="12" height="5.2" rx="2.6" fill="#03040a" stroke={GLASS} strokeWidth="0.5" opacity="0.9" />
          <circle cx={p.x - 2} cy={p.y - 0.6} r="0.45" fill="#dde8f4" opacity="0.8" />
          <circle cx={p.x + 2.6} cy={p.y + 0.8} r="0.3" fill="#dde8f4" opacity="0.6" />
        </g>
      ))}
      {/* the hold beyond the great viewport */}
      {frigate(470, 58, 0.9, 0.35)}
      {frigate(640, 78, 0.7, 0.28)}
      {frigate(770, 50, 0.55, 0.22)}
      <text x={VIEW.cx} y={TOP + 22} fill={GLASS} fontSize="6.5" textAnchor="middle" letterSpacing="0.3em" opacity="0.8">THE HOLD</text>
      <text x={VIEW.cx} y={TOP + 31} fill={C.textDim} fontSize="4.4" textAnchor="middle" letterSpacing="0.15em">FRIGATES IN TRANSIT</text>
      {/* great viewport glazing along the bite */}
      <path d={P(bite)} fill="none" stroke={GLASS} strokeWidth="2.6" opacity="0.35" />
      <path d={P(bite)} fill="none" stroke={GLASS} strokeWidth="0.6" opacity="0.8" />
      {mullions.map(([x, y], i) => {
        const dx = x - VIEW.cx, dy = y - VIEW.cy, n = Math.hypot(dx, dy);
        return <line key={i} x1={x - (dx / n) * 4} y1={y - (dy / n) * 4} x2={x + (dx / n) * 3} y2={y + (dy / n) * 3} stroke={C.hullOutline} strokeWidth="1" opacity="0.7" />;
      })}
      {/* bulkhead notes */}
      <text x={(OX - R_OUT + VIEW.cx - VIEW.r) / 2} y={TOP - 6} fill={C.textDim} fontSize="4.6" textAnchor="middle" letterSpacing="0.18em">▲ RING CONTINUES · SEALED BULKHEAD</text>
      <text x={(OX + R_OUT + VIEW.cx + VIEW.r) / 2} y={TOP - 6} fill={C.textDim} fontSize="4.6" textAnchor="middle" letterSpacing="0.18em">▲ RING CONTINUES · SEALED BULKHEAD</text>
      {/* spinward marker */}
      <text x={OX} y={OY + R_OUT + 14} fill={C.accent} fontSize="5.4" textAnchor="middle" letterSpacing="0.3em" opacity="0.8">▼ SPINWARD · NAVIGATOR</text>
      {/* run names along the outside */}
      <text x={OX - R_OUT - 8} y={320} fill={C.textFaint} fontSize="6" textAnchor="middle" letterSpacing="0.4em" transform={`rotate(-90,${OX - R_OUT - 8},320)`}>NORTH RUN</text>
      <text x={OX + R_OUT + 10} y={320} fill={C.textFaint} fontSize="6" textAnchor="middle" letterSpacing="0.4em" transform={`rotate(90,${OX + R_OUT + 10},320)`}>SOUTH RUN</text>
    </g>
  );
}

/* ─── Level renderer ─────────────────────────────────────────────────── */

function Crawl({ x, y, w, h, label, alcove }) {
  const C = useMapTheme();
  const vertical = h > w;
  const cx = x + w / 2, cy = y + h / 2;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={C.hullDeep} />
      {/* warm pipes along both walls */}
      {vertical
        ? [x + 4, x + w - 4].map((px) => <line key={px} x1={px} y1={y + 3} x2={px} y2={y + h - 3} stroke={C.accent} strokeWidth="0.7" opacity="0.28" />)
        : [y + 4, y + h - 4].map((py) => <line key={py} x1={x + 3} y1={py} x2={x + w - 3} y2={py} stroke={C.accent} strokeWidth="0.7" opacity="0.28" />)}
      <rect x={x + 1.5} y={y + 1.5} width={w - 3} height={h - 3} fill="none" stroke={C.door} strokeWidth="0.6" strokeDasharray="2 3" opacity="0.55" />
      {/* tea-coloured service glows */}
      {(vertical ? Array.from({ length: Math.floor(h / 60) }, (_, i) => [cx, y + 30 + i * 60]) : Array.from({ length: Math.floor(w / 60) }, (_, i) => [x + 30 + i * 60, cy]))
        .filter(([gx, gy]) => Math.hypot(gx - cx, gy - cy) > 46)
        .map(([gx, gy], i) => <circle key={i} cx={gx} cy={gy} r="1.6" fill={C.accent} opacity="0.35" />)}
      {alcove && (
        <g>
          <rect x={alcove.x} y={alcove.y} width={alcove.w} height={alcove.h} fill="none" stroke={C.restricted} strokeWidth="0.6" strokeDasharray="1.5 1.5" opacity="0.8" />
          <text x={alcove.x + alcove.w / 2} y={alcove.y + alcove.h / 2} fill={C.textDim} fontSize="3.6" textAnchor="middle" letterSpacing="0.1em"
            transform={`rotate(90,${alcove.x + alcove.w / 2},${alcove.y + alcove.h / 2})`}>LUNN’S ALCOVE</text>
        </g>
      )}
      <text x={cx} y={cy + 1.4} fill={C.textDim} fontSize="4.2" textAnchor="middle" letterSpacing="0.18em"
        transform={vertical ? `rotate(-90,${cx},${cy})` : undefined}>{label}</text>
    </g>
  );
}

function Duct({ x, y, v }) {
  const C = useMapTheme();
  const w = v ? 4 : 7, h = v ? 7 : 4;
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} fill={C.hullDeep} stroke={C.vent} strokeWidth="0.6" />
      {v
        ? [-2, 0, 2].map((d) => <line key={d} x1={x - 1.6} y1={y + d} x2={x + 1.6} y2={y + d} stroke={C.vent} strokeWidth="0.35" />)
        : [-2, 0, 2].map((d) => <line key={d} x1={x + d} y1={y - 1.6} x2={x + d} y2={y + 1.6} stroke={C.vent} strokeWidth="0.35" />)}
    </g>
  );
}

/* Reclamation conduits: berth grilles → spine → bend → reclamation plant. */
const CONDUITS = [
  'M 249 150 L 249 575 L 330 575 L 330 586',
  'M 861 150 L 861 575 L 760 575 L 760 586',
];
const GRATES = [[249, 150], [861, 150], [330, 586], [760, 586]];

function BerthDecor({ r, outer }) {
  /* outer: 'w' (north run, spine to the west) or 'e' (south run) */
  const C = useMapTheme();
  const { x, y, w, h } = r.rect;
  const ox = outer === 'w' ? x + 6 : x + w - 40; // cell column along the outer wall
  const ix = outer === 'w' ? x + w - 8 : x + 8;  // door (inner) side
  const cells = { 'berth-a': 2, 'berth-b': 2, 'berth-c': 4, 'berth-d': 3, 'berth-e': 0, 'berth-f': 1 }[r.id];
  const ch = (h - 12) / Math.max(cells, 1);
  const line = (x1, y1, x2, y2, o = 0.45, s = C.equipLine, sw = 0.5) => <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={s} strokeWidth={sw} opacity={o} />;
  return (
    <g>
      {/* sleeping cells along the outer wall */}
      {cells > 0 && (
        <g>
          <rect x={ox} y={y + 6} width={34} height={h - 12} fill="none" stroke={C.divider} strokeWidth="0.9" />
          {Array.from({ length: cells - 1 }, (_, i) => <React.Fragment key={i}>{line(ox, y + 6 + ch * (i + 1), ox + 34, y + 6 + ch * (i + 1), 0.9, C.divider, 0.9)}</React.Fragment>)}
          {Array.from({ length: cells }, (_, i) => {
            const cy = y + 6 + ch * i + ch / 2;
            return (
              <g key={i}>
                <rect x={ox + 5} y={cy - 5} width={24} height={10} rx="1.5" fill="none" stroke={C.accent} strokeWidth="0.45" opacity="0.45" />
                <rect x={outer === 'w' ? ox + 5 : ox + 23} y={cy - 4} width={6} height={8} fill={C.accent} opacity="0.18" />
                {/* cell door gap */}
                <rect x={outer === 'w' ? ox + 33 : ox - 1} y={cy - 3} width={2} height={6} fill={C.floorCrew} />
              </g>
            );
          })}
        </g>
      )}
      {/* hull clamps on the outer wall (berths are modules clamped to the ring) */}
      {[y + 10, y + h - 16].map((cy) => (
        <rect key={cy} x={outer === 'w' ? x - 3 : x + w - 3} y={cy} width={6} height={6} fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.5" opacity="0.9" />
      ))}
      {r.id === 'berth-a' && (
        <g>
          {/* Giedi Prime tapestries and a low table */}
          {[0, 1, 2].map((i) => <path key={i} d={`M ${x + 48 + i * 30} ${y + 7} q 5 4 10 0 t 10 0`} fill="none" stroke={C.restricted} strokeWidth="0.6" opacity="0.55" />)}
          <rect x={x + 70} y={y + h - 34} width={46} height={16} rx="2" fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.5" />
          <text x={x + 93} y={y + h - 24} fill={C.textFaint} fontSize="3.6" textAnchor="middle">AUDIENCE</text>
        </g>
      )}
      {r.id === 'berth-b' && (
        <g>
          {/* two suites split across the common room; Vantroy's instrument case ticks */}
          {line(x + 44, y + h / 2 + 22, x + w - 4, y + h / 2 + 22, 0.9, C.divider, 0.9)}
          {line(x + 44, y + h / 2 - 22, x + w - 4, y + h / 2 - 22, 0.9, C.divider, 0.9)}
          <text x={x + 95} y={y + 16} fill={C.textFaint} fontSize="3.8" textAnchor="middle" letterSpacing="0.1em">VANTROY</text>
          <rect x={x + 82} y={y + 22} width={24} height={10} fill="none" stroke={C.vent} strokeWidth="0.55" opacity="0.7" />
          {[0, 1, 2, 3].map((i) => <React.Fragment key={i}>{line(x + 86 + i * 5, y + 24, x + 86 + i * 5, y + 30, 0.5, C.vent, 0.4)}</React.Fragment>)}
          <text x={x + 95} y={y + h - 9} fill={C.textFaint} fontSize="3.8" textAnchor="middle" letterSpacing="0.1em">REVEREND MOTHER</text>
          {/* spliced seal-plate by Vantroy's door */}
          <rect x={x + w - 9} y={y + h / 2 - 34} width={5} height={7} fill={C.accent} opacity="0.55" />
          <path d={`M ${x + w - 14} ${y + h / 2 - 30} l 3 -2 l 2 3 l 3 -2`} fill="none" stroke={C.restricted} strokeWidth="0.5" />
        </g>
      )}
      {r.id === 'berth-c' && (
        <g>
          {/* weapon rack by the door, tea service, the factor's cargo niche */}
          {[0, 1, 2, 3, 4].map((i) => <React.Fragment key={i}>{line(ix - 6, y + h * 0.42 - 26 + i * 4, ix + 2, y + h * 0.42 - 26 + i * 4, 0.6, C.textBright, 0.5)}</React.Fragment>)}
          <circle cx={x + 96} cy={y + 26} r={8} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.6" />
          {[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={x + 96 + Math.cos((a * Math.PI) / 180) * 12} cy={y + 26 + Math.sin((a * Math.PI) / 180) * 12} r="1.4" fill="none" stroke={C.equipLine} strokeWidth="0.4" opacity="0.6" />)}
          <rect x={x + w - 46} y={y + h - 24} width={40} height={18} fill={purl('hatch')} stroke={C.equipLine} strokeWidth="0.5" opacity="0.9" />
          <rect x={x + w - 34} y={y + h - 19} width={16} height={8} fill="none" stroke={GLASS} strokeWidth="0.6" />
          {[3, 5.5].map((rr) => <circle key={rr} cx={x + w - 26} cy={y + h - 15} r={rr + 6} fill="none" stroke={GLASS} strokeWidth="0.35" opacity="0.35" />)}
          <text x={x + w - 26} y={y + h - 26} fill={C.textFaint} fontSize="3.4" textAnchor="middle">CARGO NICHE</text>
        </g>
      )}
      {r.id === 'berth-d' && (
        <g>
          {/* ledger table, ink, the reading chair */}
          <rect x={x + 20} y={y + 16} width={56} height={14} rx="1" fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.6" />
          {[0, 1, 2].map((i) => <rect key={i} x={x + 25 + i * 16} y={y + 19} width={10} height={8} fill={C.equipLine} opacity="0.18" />)}
          <rect x={x + 30} y={y + h - 30} width={16} height={16} rx="4" fill="none" stroke={C.accent} strokeWidth="0.6" opacity="0.6" />
          <text x={x + 38} y={y + h - 9} fill={C.textFaint} fontSize="3.4" textAnchor="middle">READING CHAIR</text>
        </g>
      )}
      {r.id === 'berth-e' && (
        <g>
          {/* a narrow Guild cell: sleeping shelf, writing ledge, amber seal-plate, ankle grille */}
          <rect x={x + 8} y={y + 8} width={w - 16} height={h - 16} fill="none" stroke={C.divider} strokeWidth="0.9" strokeDasharray="3 2" />
          <rect x={x + w - 34} y={y + 14} width={22} height={44} rx="1.5" fill="none" stroke={C.accent} strokeWidth="0.5" opacity="0.5" />
          <text x={x + w - 23} y={y + 64} fill={C.textFaint} fontSize="3.4" textAnchor="middle">SHELF</text>
          <rect x={x + 16} y={y + h - 26} width={44} height={8} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.6" />
          <text x={x + 38} y={y + h - 12} fill={C.textFaint} fontSize="3.4" textAnchor="middle">WRITING LEDGE</text>
          <rect x={x + 3} y={y + h / 2 - 16} width={5} height={7} fill={C.accent} opacity="0.85" />
          <circle cx={x + 5.5} cy={y + h / 2 - 12.5} r="5" fill={C.accent} opacity="0.15" />
          {/* the body */}
          <text x={x + 34} y={y + 34} fill={C.restricted} fontSize="11" textAnchor="middle" opacity="0.85">†</text>
        </g>
      )}
      {r.id === 'berth-f' && (
        <g>
          {/* seal-tape gasket round the door, sitting mat, dew trap in the duct */}
          <rect x={x - 2} y={y + h * 0.42 - 9} width={8} height={18} fill="none" stroke={C.accent} strokeWidth="0.7" strokeDasharray="1.2 1" />
          <rect x={x + 22} y={y + 18} width={36} height={22} rx="2" fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.55" />
          <text x={x + 40} y={y + 31} fill={C.textFaint} fontSize="3.4" textAnchor="middle">MAT</text>
          <circle cx={x + w - 48} cy={y + h * 0.74} r={4} fill="none" stroke={C.vent} strokeWidth="0.6" />
          <path d={`M ${x + w - 48} ${y + h * 0.74 + 5} q 1.6 2.4 0 3.6 q -1.6 -1.2 0 -3.6`} fill={C.vent} opacity="0.6" />
          <text x={x + w - 48} y={y + h * 0.74 + 15} fill={C.textFaint} fontSize="3.4" textAnchor="middle">DEW TRAP</text>
        </g>
      )}
    </g>
  );
}

function PromenadeDecor({ r }) {
  const C = useMapTheme();
  const { x, y, w, h } = r.rect;
  const fx = 555, fy = 384; // phosphor fountain
  // the curved walk: a U of pale composite along the berth fronts, bent round the lock end
  const o = 7, i = 36, rr = 70;
  const band = (d) => [
    `M ${x + d} ${y + 2}`,
    `L ${x + d} ${y + h - d - rr}`,
    `Q ${x + d} ${y + h - d} ${x + d + rr} ${y + h - d}`,
    `L ${x + w - d - rr} ${y + h - d}`,
    `Q ${x + w - d} ${y + h - d} ${x + w - d} ${y + h - d - rr}`,
    `L ${x + w - d} ${y + 2}`,
  ].join(' ');
  const globes = [];
  for (let gy = y + 30; gy < y + h - 80; gy += 56) { globes.push([x + (o + i) / 2, gy]); globes.push([x + w - (o + i) / 2, gy]); }
  globes.push([x + 70, y + h - 22], [x + w - 70, y + h - 22]);
  return (
    <g>
      {/* walk */}
      <path d={band((o + i) / 2)} fill="none" stroke="#c8cede" strokeWidth={i - o} opacity="0.06" />
      <path d={band(o)} fill="none" stroke={C.equipLine} strokeWidth="0.4" opacity="0.45" />
      <path d={band(i)} fill="none" stroke={C.equipLine} strokeWidth="0.6" strokeDasharray="4 3" opacity="0.5" />
      {/* the court: concentric paving round the fountain */}
      {[34, 58, 86, 112].map((rad, k) => (
        <circle key={rad} cx={fx} cy={fy} r={rad} fill="none" stroke={C.equipLine} strokeWidth={k === 3 ? 0.6 : 0.35} strokeDasharray={k === 3 ? '1 3' : undefined} opacity="0.3" />
      ))}
      {/* phosphor fountain */}
      <circle cx={fx} cy={fy} r="26" fill="url(#lantern_fountain)" />
      <circle cx={fx} cy={fy} r="18" fill="none" stroke={GLASS} strokeWidth="0.8" opacity="0.7" />
      <circle cx={fx} cy={fy} r="5" fill="none" stroke={GLASS} strokeWidth="0.6" opacity="0.8" />
      {[0, 60, 120, 180, 240, 300].map((a) => {
        const ra = (a * Math.PI) / 180;
        return <line key={a} x1={fx + Math.cos(ra) * 6} y1={fy + Math.sin(ra) * 6} x2={fx + Math.cos(ra) * 15} y2={fy + Math.sin(ra) * 15} stroke={GLASS} strokeWidth="0.4" opacity="0.5" />;
      })}
      <text x={fx} y={fy + 34} fill={C.textDim} fontSize="4.4" textAnchor="middle" letterSpacing="0.16em">PHOSPHOR FOUNTAIN</text>
      {/* Ruul's salon by the fountain */}
      <g opacity="0.75">
        <circle cx={492} cy={452} r="7" fill="none" stroke={C.accent} strokeWidth="0.5" />
        {[[-16, -6], [-12, 12], [6, 16], [16, -2]].map(([dx, dy], k) => (
          <rect key={k} x={492 + dx - 5} y={452 + dy - 3} width="10" height="6" rx="2" fill="none" stroke={C.restricted} strokeWidth="0.5" />
        ))}
        <text x={492} y={480} fill={C.textDim} fontSize="4" textAnchor="middle" letterSpacing="0.12em">RUUL’S SALON</text>
      </g>
      {/* public benches */}
      {[[600, 300], [620, 466]].map(([bx, by], k) => <rect key={k} x={bx} y={by} width="24" height="5" rx="1.5" fill="none" stroke={C.equipLine} strokeWidth="0.45" opacity="0.5" />)}
      {/* glowglobes tuned to endless evening */}
      {globes.map(([gx, gy], k) => (
        <g key={k}>
          <circle cx={gx} cy={gy} r="5" fill={C.accent} opacity="0.08" />
          <circle cx={gx} cy={gy} r="1.6" fill={C.accent} opacity="0.55" />
        </g>
      ))}
      {/* gallery lock and the proctors' slate */}
      <rect x={533} y={y + h - 14} width={44} height={14} fill={C.hullDeep} stroke={C.restricted} strokeWidth="0.6" />
      <line x1={537} y1={y + h - 7} x2={573} y2={y + h - 7} stroke={C.restricted} strokeWidth="0.5" strokeDasharray="2 1.5" opacity="0.8" />
      <text x={555} y={y + h - 18} fill={C.restricted} fontSize="4.2" textAnchor="middle" letterSpacing="0.14em">GALLERY LOCK · SEALED</text>
      <rect x={590} y={y + h - 9} width={26} height={6} fill={C.accent} opacity="0.3" stroke={C.accent} strokeWidth="0.4" />
      <text x={603} y={y + h - 11} fill={C.textDim} fontSize="3.4" textAnchor="middle">SLATE</text>
      {/* the great viewport's rail */}
      <path d={P(arcPts(VIEW.cx, VIEW.cy, VIEW.r + 7, 180, 0, 24).filter(([px]) => px >= x && px <= x + w))} fill="none" stroke={C.equipLine} strokeWidth="0.6" strokeDasharray="1 2" opacity="0.6" />
      <text x={555} y={VIEW.cy + VIEW.r + 16} fill={GLASS} fontSize="4" textAnchor="middle" letterSpacing="0.22em" opacity="0.8">GREAT VIEWPORT</text>
    </g>
  );
}

function GalleryDecor({ r }) {
  const C = useMapTheme();
  const { x, y, w } = r.rect;
  const tx = 555, ty = 744, trx = 112, try_ = 46;
  return (
    <g>
      {/* proctor post */}
      <path d={`M ${x + 16} ${y + 52} q 26 -18 52 0`} fill="none" stroke={C.equipLine} strokeWidth="1" opacity="0.6" />
      <text x={x + 42} y={y + 60} fill={C.textFaint} fontSize="3.6" textAnchor="middle" letterSpacing="0.1em">PROCTOR POST</text>
      {/* seal-board: one light per seal in the ring */}
      <rect x={x + w - 74} y={y + 30} width={58} height={26} fill="none" stroke={C.equipLine} strokeWidth="0.6" opacity="0.7" />
      {Array.from({ length: 18 }, (_, k) => (
        <circle key={k} cx={x + w - 68 + (k % 6) * 9.2} cy={y + 36 + Math.floor(k / 6) * 7} r="1.4"
          fill={k === 8 ? C.restricted : C.accent} opacity={k === 8 ? 0.9 : 0.45} />
      ))}
      <text x={x + w - 45} y={y + 63} fill={C.textFaint} fontSize="3.6" textAnchor="middle" letterSpacing="0.1em">SEAL-BOARD</text>
      {/* air and light controls */}
      {[-18, 0, 18].map((dx) => (
        <g key={dx}>
          <circle cx={555 + dx} cy={y + 106} r="5" fill="none" stroke={C.vent} strokeWidth="0.55" opacity="0.7" />
          <line x1={555 + dx} y1={y + 106} x2={555 + dx + 3} y2={y + 103} stroke={C.vent} strokeWidth="0.5" />
        </g>
      ))}
      <text x={555} y={y + 120} fill={C.textFaint} fontSize="3.6" textAnchor="middle" letterSpacing="0.1em">AIR · LIGHT</text>
      {/* the window onto the tank */}
      {[[2.6, 0.3], [0.6, 0.9]].map(([sw, op]) => (
        <path key={sw} d={`M ${tx - trx - 10} ${ty} A ${trx + 10} ${try_ + 10} 0 0 1 ${tx + trx + 10} ${ty}`} fill="none" stroke={GLASS} strokeWidth={sw} opacity={op} />
      ))}
      <text x={tx - trx + 2} y={ty - try_ - 4} fill={GLASS} fontSize="3.4" opacity="0.8">WINDOW</text>
      {/* the Navigator's tank */}
      <ellipse cx={tx} cy={ty} rx={trx + 18} ry={try_ + 14} fill="url(#lantern_spiceGlow)" />
      <ellipse cx={tx} cy={ty} rx={trx} ry={try_} fill="url(#lantern_spice)" stroke={C.accent} strokeWidth="1.4" />
      <ellipse cx={tx} cy={ty} rx={trx - 6} ry={try_ - 5} fill="none" stroke={C.accent} strokeWidth="0.4" strokeDasharray="2 3" opacity="0.6" />
      {[[-70, -10], [-20, 16], [40, -18], [72, 10]].map(([dx, dy], k) => (
        <path key={k} d={`M ${tx + dx - 18} ${ty + dy} q 9 -7 18 0 t 18 0`} fill="none" stroke={SPICE} strokeWidth="0.6" opacity="0.45" />
      ))}
      {/* the Navigator itself: a pale shape in the fog */}
      <path d={`M ${tx} ${ty - 22} c 9 0 12 10 9 20 c -2 8 -4 16 -9 16 c -5 0 -7 -8 -9 -16 c -3 -10 0 -20 9 -20 Z`} fill="#f1d6b0" opacity="0.18" stroke="#f1d6b0" strokeWidth="0.4" />
      <text x={tx} y={ty + 28} fill={C.textBright} fontSize="5.6" textAnchor="middle" letterSpacing="0.24em" opacity="0.85">NAVIGATOR’S TANK</text>
      <text x={tx} y={ty + 36} fill={C.accent} fontSize="4" textAnchor="middle" letterSpacing="0.2em">SPICE-GAS · SEALED</text>
      {/* tank seals: the orange threads leak here */}
      {[[-trx + 6, -14], [trx - 6, -14]].map(([dx, dy], k) => <rect key={k} x={tx + dx - 3} y={ty + dy - 3} width="6" height="6" fill={C.hullDark} stroke={C.accent} strokeWidth="0.5" />)}
    </g>
  );
}

function PlantDecor({ r }) {
  const C = useMapTheme();
  const { x, y, w, h } = r.rect;
  if (r.id === 'reclamation-plant') {
    return <g>{[0, 1, 2].map((k) => <circle key={k} cx={x + 28 + k * 32} cy={y + h - 22} r="9" fill="none" stroke={C.vent} strokeWidth="0.6" opacity="0.6" />)}</g>;
  }
  return (
    <g>
      {[x + 34, x + w - 34].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={y + h - 22} r="11" fill="none" stroke={C.equipLine} strokeWidth="0.6" opacity="0.6" />
          {[0, 60, 120].map((a) => {
            const ra = (a * Math.PI) / 180;
            return <line key={a} x1={cx - Math.cos(ra) * 9} y1={y + h - 22 - Math.sin(ra) * 9} x2={cx + Math.cos(ra) * 9} y2={y + h - 22 + Math.sin(ra) * 9} stroke={C.equipLine} strokeWidth="0.4" opacity="0.5" />;
          })}
        </g>
      ))}
    </g>
  );
}

function Defs() {
  return (
    <defs>
      <radialGradient id="lantern_spice" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stopColor="#ffb25a" stopOpacity="0.85" />
        <stop offset="45%" stopColor={SPICE} stopOpacity="0.55" />
        <stop offset="100%" stopColor="#7a2e08" stopOpacity="0.55" />
      </radialGradient>
      <radialGradient id="lantern_spiceGlow" cx="50%" cy="50%" r="50%">
        <stop offset="60%" stopColor={SPICE} stopOpacity="0.25" />
        <stop offset="100%" stopColor={SPICE} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="lantern_fountain" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#bff3ff" stopOpacity="0.55" />
        <stop offset="60%" stopColor={GLASS} stopOpacity="0.2" />
        <stop offset="100%" stopColor={GLASS} stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

const SOUTH = new Set(['berth-d', 'berth-e', 'berth-f']);

function RingLevel() {
  const C = useMapTheme();
  const passages = lanternRooms.filter((r) => r.draw?.kind === 'passage');
  const plain = lanternRooms.filter((r) => !r.draw?.kind);
  const by = Object.fromEntries(lanternRooms.map((r) => [r.id, r]));
  return (
    <g>
      <Defs />
      {passages.map((r) => (
        <Crawl key={r.id} {...r.rect} label={r.draw.label}
          alcove={r.id === 'service-spine-south' ? { x: r.rect.x + 4, y: 440, w: 14, h: 60 } : null} />
      ))}
      {plain.map((r) => {
        const { sub, crew, icons, shape, pattern, fill, labelSize, labelAt } = r.draw || {};
        return (
          <Room key={r.id} {...r.rect} label={labelAt ? undefined : r.name.toUpperCase()} sub={labelAt ? undefined : sub}
            crew={crew} icons={icons} shape={shape} pattern={pattern} fill={fill}
            labelSize={labelSize || (r.rect.w < 100 ? 5.2 : 6.6)} />
        );
      })}
      <Vents paths={CONDUITS} grates={GRATES} />
      <PromenadeDecor r={by.promenade} />
      <GalleryDecor r={by['guild-gallery']} />
      <PlantDecor r={by['reclamation-plant']} />
      <PlantDecor r={by['air-plant']} />
      {plain.filter((r) => r.id.startsWith('berth-')).map((r) => <BerthDecor key={`d-${r.id}`} r={r} outer={SOUTH.has(r.id) ? 'e' : 'w'} />)}
      {/* second subtitle line on the berths; placed labels for the big rooms */}
      {plain.filter((r) => r.draw?.sub2).map((r) => (
        <text key={`s2-${r.id}`} x={r.rect.x + r.rect.w / 2} y={r.rect.y + r.rect.h / 2 + 15} fill={C.textFaint} fontSize="4.1" textAnchor="middle" letterSpacing="0.06em">{r.draw.sub2}</text>
      ))}
      {plain.filter((r) => r.draw?.labelAt).map((r) => (
        <g key={`l-${r.id}`}>
          <text x={r.draw.labelAt[0]} y={r.draw.labelAt[1]} fill={C.textBright} fontSize="8" textAnchor="middle" letterSpacing="0.14em">{r.name.toUpperCase()}</text>
          {r.draw.sub && <text x={r.draw.labelAt[0]} y={r.draw.labelAt[1] + 9} fill={C.textDim} fontSize="4.6" textAnchor="middle" letterSpacing="0.16em">{r.draw.sub}</text>}
        </g>
      ))}
      {lanternDoors.map((d, i) => (
        <g key={i}>
          {d.kind === 'duct' ? <Duct x={d.x} y={d.y} v={d.v} /> : <Door x={d.x} y={d.y} v={d.v} />}
          {d.locked && <circle cx={d.x + (d.v ? 0 : 7)} cy={d.y + (d.v ? 7 : 0)} r="1.7" fill="none" stroke={C.restricted} strokeWidth="0.65" opacity="0.85" />}
        </g>
      ))}
    </g>
  );
}

/* ─── Legend & sidebar ───────────────────────────────────────────────── */

function lanternLegend(C) {
  const items = [
    { label: 'DOORWAY', draw: (y) => <rect x="0" y={y - 4} width="10" height="6" fill={C.door} opacity="0.6" rx="0.5" /> },
    { label: 'SEALED / LOCKED DOOR', draw: (y) => <circle cx="5" cy={y - 1} r="3" fill="none" stroke={C.restricted} strokeWidth="0.7" /> },
    { label: 'SERVICE CRAWLWAY', draw: (y) => <rect x="0" y={y - 5} width="10" height="8" fill={C.hullDeep} stroke={C.door} strokeWidth="0.6" strokeDasharray="2 2" /> },
    { label: 'RECLAMATION DUCT', draw: (y) => <><rect x="2" y={y - 4} width="6" height="6" fill={C.hullDeep} stroke={C.vent} strokeWidth="0.6" /><line x1="0" y1={y - 1} x2="12" y2={y - 1} stroke={C.vent} strokeWidth="0.8" strokeDasharray="2 3" opacity="0.5" /></> },
    { label: 'VIEWPORT', draw: (y) => <><rect x="0" y={y - 4} width="12" height="5.5" rx="2.7" fill="#03040a" stroke={GLASS} strokeWidth="0.6" /><circle cx="4" cy={y - 1.5} r="0.5" fill="#dde8f4" /><circle cx="8" cy={y - 0.2} r="0.35" fill="#dde8f4" /></> },
    { label: 'GUILD-SEALED', draw: (y) => <><rect x="0" y={y - 5} width="12" height="8" fill={purl('hatch')} stroke={C.restricted} strokeWidth="0.5" />{ICONS['lantern-seal'](6, y - 1, C)}</> },
    { label: 'SPICE-GAS TANK', draw: (y) => <ellipse cx="6" cy={y - 1} rx="6" ry="3.6" fill={SPICE} opacity="0.5" stroke={C.accent} strokeWidth="0.6" /> },
    { label: 'SHIELD / LATTICE', draw: (y) => <circle cx="5" cy={y - 1} r="3.4" fill="none" stroke={C.vent} strokeWidth="0.6" strokeDasharray="1.2 0.8" /> },
    { label: 'HULL CLAMP', draw: (y) => <rect x="2" y={y - 4} width="6" height="6" fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.5" /> },
    { label: 'BERTH (LIVING AREA)', draw: (y) => <><rect x="0" y={y - 5} width="10" height="8" fill={C.wall} stroke={C.hullOutline} strokeWidth="0.4" /><rect x="2.5" y={y - 2.5} width="5" height="3" fill={C.floorCrew} /></> },
  ];
  return items.map((it, i) => {
    const y = 18 + i * 18;
    return { y, label: it.label, draw: it.draw(y) };
  });
}

function lanternSidebar(C) {
  return (
    <g>
      <text x="32" y="42" fill={C.textDim} fontSize="7.5" letterSpacing="0.25em" style={{ fontFamily: 'var(--font-display)' }} opacity="0.7">H E I G H L I N E R</text>
      {/* no north aboard a ship: a spinward arrow instead of a compass */}
      <g transform="translate(115,130)" opacity="0.8">
        <circle r="16" fill="none" stroke={C.textDim} strokeWidth="0.8" />
        <circle r="11" fill="none" stroke={C.textDim} strokeWidth="0.4" strokeDasharray="1.5 2" />
        <path d="M 0 13 L 4 0 L 0 3 L -4 0 Z" fill={C.accent} opacity="0.85" />
        <text y="-20" fill={C.textDim} fontSize="6" textAnchor="middle" letterSpacing="0.2em" style={{ fontFamily: 'var(--font-display)' }}>SPINWARD</text>
        <text y="27" fill={C.textDim} fontSize="7" textAnchor="middle">▼</text>
      </g>
      <text x="100" y="640" fill={C.textBright} fontSize="22" fontWeight="bold" letterSpacing="0.16em"
        transform="rotate(-90,100,640)" style={{ fontFamily: 'var(--font-display)' }}>THE LANTERN RING</text>
      <text x="128" y="640" fill={C.textDim} fontSize="8.5" letterSpacing="0.1em" transform="rotate(-90,128,640)">PASSENGER RING — HEIGHLINER LONG VESPER</text>
      <text x="150" y="640" fill={C.textFaint} fontSize="6.5" letterSpacing="0.14em" transform="rotate(-90,150,640)">SIX BERTHS · TWELVE DELEGATIONS · SEALED FOR TRANSIT</text>
      <g transform="translate(70,700)">
        <rect width="11" height="11" fill="none" stroke={C.textDim} strokeWidth="0.5" />
        <text x="18" y="9" fill={C.textDim} fontSize="7">2 METRES</text>
      </g>
      <rect x="55" y="100" width="130" height="630" rx="3" fill="none" stroke={C.frame} strokeWidth="0.4" />
    </g>
  );
}

const Ring = () => <RingLevel />;

export const lanternConfig = {
  width: W,
  height: H,
  theme: LANTERN_THEME,
  stars: { count: 120, seed: 10191 },
  backdrop: 'space',
  levelNoun: 'LEVEL',
  scenarioTag: 'HEIGHLINER',
  hull: { path: OUTLINE, overlays: hullOverlays },
  exteriorDetails: exterior,
  sidebar: lanternSidebar,
  decks: [{ id: 'L', level: 'ring', name: 'PASSENGER RING', page: 'IV', component: Ring }],
  specs: {
    title: 'RING SURVEY — LONG VESPER',
    y: 800,
    items: [
      ['RING DIAMETER', '2.6 km (passenger arc shown)'],
      ['PASSENGERS', '12 delegations, 58 souls'],
      ['AIR / WATER', 'Metered by the proctors; 2 L a head a day'],
      ['GUILD RULES', 'No blood spilled; no blade bared; no seal broken'],
      ['TRANSIT', 'Nine days, berths sealed'],
    ],
  },
  legend: lanternLegend,
};

/** Interactive plan, registered as universe.maps[lantern-ring].engine */
export function LanternMap() {
  return <MapEngine config={lanternConfig} />;
}
LanternMap.config = lanternConfig;
