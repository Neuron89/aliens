import React, { useId } from 'react';

/* ═══════════════════════════════════════════════════════════════
   Motifs — faint themed line art for cards and art strips
   (theme.motif): 'deckplan' (ALIEN: ship deck-plan linework),
   'contours' (DUNE: dune contour lines), anything else → fine grid.
   Pure SVG drawn with currentColor/CSS vars; `seed` varies the layout
   deterministically (e.g. a pack id), so each card looks distinct.
   ═══════════════════════════════════════════════════════════════ */

export function hashSeed(s = '') {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

function rng(seed) {
  let s = seed || 1;
  return () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

function DeckPlan({ seed, w, h, color }) {
  const r = rng(seed);
  const cx = w * (0.45 + r() * 0.2);
  const hullW = w * 0.32;
  const top = h * 0.08;
  const bottom = h * 0.95;
  const hull = `M ${cx} ${top} C ${cx + hullW * 0.9} ${top + h * 0.1}, ${cx + hullW} ${h * 0.4}, ${cx + hullW * 0.8} ${bottom} L ${cx - hullW * 0.8} ${bottom} C ${cx - hullW} ${h * 0.4}, ${cx - hullW * 0.9} ${top + h * 0.1}, ${cx} ${top} Z`;
  const rooms = [];
  const rows = 4 + Math.floor(r() * 3);
  for (let i = 0; i < rows; i++) {
    const y = h * 0.3 + i * ((h * 0.6) / rows);
    const rh = (h * 0.6) / rows - 4;
    const split = 0.35 + r() * 0.3;
    const x0 = cx - hullW * 0.62;
    const x1 = cx + hullW * 0.62;
    const xm = x0 + (x1 - x0) * split;
    rooms.push(<rect key={`a${i}`} x={x0} y={y} width={xm - x0 - 6} height={rh} />);
    rooms.push(<rect key={`b${i}`} x={xm + 6} y={y} width={x1 - xm - 6} height={rh} />);
  }
  return (
    <g fill="none" stroke={color} strokeWidth="1">
      <path d={hull} />
      <path d={hull} transform={`translate(${cx} ${h / 2}) scale(0.92) translate(${-cx} ${-h / 2})`} opacity="0.5" />
      <line x1={cx} y1={h * 0.26} x2={cx} y2={bottom - 8} strokeDasharray="3 4" opacity="0.7" />
      <g opacity="0.85">{rooms}</g>
      <circle cx={cx} cy={h * 0.2} r={hullW * 0.18} opacity="0.7" />
      {[0.15, 0.85].map((t) => <line key={t} x1={w * t} y1={h * 0.15} x2={w * t} y2={h * 0.85} strokeDasharray="1 6" opacity="0.5" />)}
      <path d={`M ${w * 0.06} ${h * 0.12} h 18 M ${w * 0.06} ${h * 0.12} v 18 M ${w * 0.94} ${h * 0.88} h -18 M ${w * 0.94} ${h * 0.88} v -18`} strokeWidth="1.4" />
    </g>
  );
}

function Contours({ seed, w, h, color }) {
  const r = rng(seed);
  const lines = [];
  const n = 9;
  const phase = r() * Math.PI * 2;
  const amp = h * (0.05 + r() * 0.05);
  for (let i = 0; i < n; i++) {
    const y0 = h * (0.12 + (i / n) * 0.9);
    const k = 1.2 + r() * 0.8;
    let d = `M -10 ${y0}`;
    for (let x = 0; x <= w + 20; x += w / 12) {
      const y = y0 + Math.sin((x / w) * Math.PI * k + phase + i * 0.45) * amp + Math.sin((x / w) * Math.PI * 4 + i) * amp * 0.25;
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    lines.push(<path key={i} d={d} opacity={0.35 + (i / n) * 0.6} />);
  }
  return (
    <g fill="none" stroke={color} strokeWidth="1">
      {lines}
      <circle cx={w * (0.7 + r() * 0.2)} cy={h * 0.2} r={h * 0.09} opacity="0.7" />
      <circle cx={w * (0.7 + r() * 0.2) - 30} cy={h * 0.28} r={h * 0.04} opacity="0.45" />
    </g>
  );
}

function Grid({ w, h, color }) {
  const lines = [];
  for (let x = 0; x <= w; x += 20) lines.push(<line key={`x${x}`} x1={x} y1="0" x2={x} y2={h} />);
  for (let y = 0; y <= h; y += 20) lines.push(<line key={`y${y}`} x1="0" y1={y} x2={w} y2={y} />);
  return <g stroke={color} strokeWidth="0.5" opacity="0.5">{lines}</g>;
}

/** <Motif motif="deckplan" seed="pack-id" /> — fills its box (preserveAspectRatio slice). */
export default function Motif({ motif, seed = 'x', className, color = 'var(--accent)', opacity = 0.32, width = 400, height = 300 }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const s = typeof seed === 'number' ? seed : hashSeed(seed);
  const Body = motif === 'deckplan' ? DeckPlan : motif === 'contours' ? Contours : Grid;
  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`mf${id}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={width} y2={height}>
          <stop offset="0" stopColor={color} stopOpacity="1" />
          <stop offset="1" stopColor={color} stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <g opacity={opacity}>
        <Body seed={s} w={width} h={height} color={`url(#mf${id})`} />
      </g>
    </svg>
  );
}
