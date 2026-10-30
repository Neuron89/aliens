import React from 'react';

/* ═══════════════════════════════════════════════════════════════
   TokenChip — one board token drawn in SVG (map units).
   No emoji / font glyphs for symbols: every glyph below is SVG
   geometry in a [-1, 1] box so the TV renders it identically.
   ═══════════════════════════════════════════════════════════════ */

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 0.16, strokeLinejoin: 'round', strokeLinecap: 'round' };
const F = { fill: 'currentColor' };

export const GLYPHS = {
  diamond: <path d="M0 -0.9 L0.75 0 L0 0.9 L-0.75 0 Z" {...F} />,
  triangle: <path d="M0 -0.85 L0.85 0.7 L-0.85 0.7 Z" {...F} />,
  square: <rect x="-0.65" y="-0.65" width="1.3" height="1.3" {...F} />,
  circle: <circle r="0.7" {...F} />,
  hex: <path d="M0 -0.85 L0.74 -0.42 L0.74 0.42 L0 0.85 L-0.74 0.42 L-0.74 -0.42 Z" {...F} />,
  star: <path d="M0 -0.9 L0.24 -0.28 L0.88 -0.28 L0.36 0.12 L0.56 0.78 L0 0.38 L-0.56 0.78 L-0.36 0.12 L-0.88 -0.28 L-0.24 -0.28 Z" {...F} />,
  cross: <path d="M-0.25 -0.8 H0.25 V-0.25 H0.8 V0.25 H0.25 V0.8 H-0.25 V0.25 H-0.8 V-0.25 H-0.25 Z" {...F} />,
  chevron: <g {...S} strokeWidth="0.24"><path d="M-0.7 -0.15 L0 -0.65 L0.7 -0.15" /><path d="M-0.7 0.45 L0 -0.05 L0.7 0.45" /></g>,
  shield: <path d="M0 -0.85 L0.7 -0.55 L0.6 0.25 Q0.4 0.7 0 0.9 Q-0.4 0.7 -0.6 0.25 L-0.7 -0.55 Z" {...F} />,
  person: <g {...F}><circle cy="-0.45" r="0.32" /><path d="M-0.62 0.85 Q-0.62 -0.02 0 -0.02 Q0.62 -0.02 0.62 0.85 Z" /></g>,
  crate: <g {...S}><rect x="-0.7" y="-0.6" width="1.4" height="1.2" /><path d="M-0.7 -0.6 L0.7 0.6 M0.7 -0.6 L-0.7 0.6" strokeWidth="0.1" /></g>,
  hazard: <g><path d="M0 -0.85 L0.9 0.75 L-0.9 0.75 Z" {...F} /><rect x="-0.08" y="-0.3" width="0.16" height="0.6" fill="#000" /><circle cy="0.52" r="0.09" fill="#000" /></g>,
  objective: <g {...S}><circle r="0.75" /><circle r="0.38" /><circle r="0.08" {...F} stroke="none" /></g>,
  noise: <g {...S}><path d="M-0.15 -0.45 Q0.15 0 -0.15 0.45" /><path d="M0.15 -0.75 Q0.6 0 0.15 0.75" /><circle cx="-0.55" r="0.14" {...F} stroke="none" /></g>,
  blood: <path d="M0 -0.85 Q0.65 0.05 0.6 0.35 Q0.55 0.85 0 0.85 Q-0.55 0.85 -0.6 0.35 Q-0.65 0.05 0 -0.85 Z" {...F} />,
  lock: <g><rect x="-0.6" y="-0.1" width="1.2" height="0.95" rx="0.1" {...F} /><path d="M-0.38 -0.1 V-0.42 Q-0.38 -0.82 0 -0.82 Q0.38 -0.82 0.38 -0.42 V-0.1" {...S} /></g>,
  vent: <g {...S}><rect x="-0.75" y="-0.75" width="1.5" height="1.5" rx="0.15" /><path d="M-0.45 -0.35 H0.45 M-0.45 0 H0.45 M-0.45 0.35 H0.45" strokeWidth="0.12" /></g>,
  fire: <path d="M0 -0.9 Q0.25 -0.4 0.55 -0.2 Q0.8 0.15 0.6 0.55 Q0.4 0.9 0 0.9 Q-0.45 0.9 -0.62 0.5 Q-0.75 0.05 -0.35 -0.25 Q-0.3 0.1 -0.1 0.15 Q-0.3 -0.4 0 -0.9 Z" {...F} />,
  door: <g {...S}><rect x="-0.55" y="-0.85" width="1.1" height="1.7" /><circle cx="0.28" cy="0.05" r="0.08" {...F} stroke="none" /></g>,
  claw: <g {...S} strokeWidth="0.18"><path d="M-0.6 0.7 Q-0.6 -0.2 -0.15 -0.8" /><path d="M-0.1 0.75 Q-0.05 -0.2 0.3 -0.75" /><path d="M0.4 0.75 Q0.5 0 0.8 -0.5" /></g>,
};

/** Markers offered by the controller palette. */
export const MARKERS = [
  { glyph: 'hazard', label: 'HAZARD', kind: 'hazard', color: '#ffb300' },
  { glyph: 'objective', label: 'OBJECTIVE', kind: 'marker', color: '#4fc3f7' },
  { glyph: 'noise', label: 'NOISE', kind: 'marker', color: '#e0e0e0' },
  { glyph: 'blood', label: 'BLOOD', kind: 'marker', color: '#c62828' },
  { glyph: 'lock', label: 'LOCKED DOOR', kind: 'marker', color: '#ff7043' },
  { glyph: 'vent', label: 'VENT', kind: 'marker', color: '#90a4ae' },
  { glyph: 'fire', label: 'FIRE', kind: 'hazard', color: '#ff6d00' },
];

/** Career → glyph (keyword heuristics, universe-agnostic; stable hash fallback). */
export function careerGlyph(career = '') {
  const c = String(career).toLowerCase();
  if (/medic|doctor|nurse|suk/.test(c)) return 'cross';
  if (/marine|soldier|trooper|sardaukar|fedaykin|warrior|swordmaster/.test(c)) return 'chevron';
  if (/officer|captain|command|noble|leader|duke/.test(c)) return 'star';
  if (/pilot|driver|navigat/.test(c)) return 'triangle';
  if (/scien|research|mentat|scholar/.test(c)) return 'hex';
  if (/agent|spy|corporate|envoy|bene/.test(c)) return 'diamond';
  if (/marshal|police|security|guard/.test(c)) return 'shield';
  if (/roughneck|engineer|mechanic|worker|tech|smuggler/.test(c)) return 'square';
  if (/kid|child|youth/.test(c)) return 'circle';
  const keys = ['diamond', 'triangle', 'square', 'hex', 'star', 'circle'];
  let h = 0;
  for (const ch of c) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return keys[h % keys.length];
}

export function initials(label = '') {
  const words = String(label).replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const skip = /^(cpl|sgt|pvt|lt|capt|cpt|dr|mr|ms|mrs|the)$/i;
  const parts = words.filter((w) => !skip.test(w));
  const use = parts.length ? parts : words;
  return (use.length === 1 ? use[0].slice(0, 2) : use[0][0] + use[use.length - 1][0]).toUpperCase();
}

const KIND_COLOR = { pc: '#4fc3f7', npc: '#d4b46a', creature: '#e53935', item: '#9ccc65', marker: '#b0bec5', hazard: '#ffb300' };

export function Glyph({ name, r, color }) {
  const g = GLYPHS[name];
  if (g) return <g transform={`scale(${r})`} style={{ color }}>{g}</g>;
  if (!name) return null;
  return <text y={r * 0.38} textAnchor="middle" fontSize={r * 1.2} fill={color} fontWeight="bold">{String(name).slice(0, 2)}</text>;
}

/**
 * Props: token, unit (map px of size 1), counter (transform string that keeps
 * content upright on screen), uid (unique id prefix), selected, mine,
 * ghost (DM view of a hidden token), showLabel, dragging.
 */
export default function TokenChip({ token: t, x, y, unit, counter = '', uid, selected, mine, ghost, showLabel = true, dragging }) {
  const r = Math.max(4, (t.size || 1) * unit * 0.46);
  const color = t.color || KIND_COLOR[t.kind] || '#b0bec5';
  const clipId = `${uid}-clip-${t.id}`;
  const isPc = t.kind === 'pc';
  const ring = isPc ? r * 0.2 : r * 0.12;
  const label = t.label || '';
  const fs = Math.max(unit * 0.32, r * 0.5);
  const plateW = Math.min(label.length * fs * 0.62 + fs, unit * 6);
  const facing = Number.isFinite(t.facing) ? t.facing : 0;
  const showFacing = isPc || t.kind === 'creature' || t.kind === 'npc' || facing !== 0;
  const cls = `tk tk-${t.kind}${selected ? ' tk-selected' : ''}${mine ? ' tk-mine' : ''}${ghost ? ' tk-ghost' : ''}${dragging ? ' tk-dragging' : ''}`;

  return (
    <g className={cls} transform={`translate(${x},${y})`} data-token={t.id} style={{ color }}>
      {mine && <circle className="tk-mine-pulse" r={r * 1.35} fill="none" stroke={color} strokeWidth={ring * 0.8} />}
      {selected && <circle r={r + ring * 2.2} fill="none" stroke="#ffffff" strokeWidth={ring * 0.7} strokeDasharray={`${r * 0.5} ${r * 0.3}`} />}
      {showFacing && (
        <g transform={`rotate(${facing})`}>
          <path d={`M ${-r * 0.32} ${-r - ring * 0.2} L 0 ${-r - ring * 2.6} L ${r * 0.32} ${-r - ring * 0.2} Z`} fill={color} />
        </g>
      )}
      <g transform={counter}>
        <circle r={r} fill="#0a0c10" stroke={color} strokeWidth={ring} strokeDasharray={ghost ? `${r * 0.35} ${r * 0.25}` : undefined} />
        {t.icon ? (
          <>
            <clipPath id={clipId}><circle r={r - ring / 2} /></clipPath>
            <image href={t.icon} x={-r} y={-r} width={r * 2} height={r * 2} clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice" />
          </>
        ) : isPc ? (
          <text y={r * 0.34} textAnchor="middle" fontSize={r * 0.95} fontWeight="bold" fill="#ffffff" letterSpacing="0.02em">{initials(label)}</text>
        ) : (
          <Glyph name={t.glyph || (t.kind === 'npc' ? 'person' : t.kind === 'item' ? 'crate' : t.kind === 'creature' ? 'claw' : 'diamond')} r={r * 0.62} color={color} />
        )}
        {isPc && t.glyph && (
          <g transform={`translate(${r * 0.74},${r * 0.74})`}>
            <circle r={r * 0.4} fill="#0a0c10" stroke={color} strokeWidth={ring * 0.5} />
            <Glyph name={t.glyph} r={r * 0.26} color={color} />
          </g>
        )}
        {showLabel && label && (
          <g transform={`translate(0,${r + ring + fs * 0.9})`}>
            <rect x={-plateW / 2} y={-fs * 0.85} width={plateW} height={fs * 1.25} rx={fs * 0.35} fill="rgba(0,0,0,0.78)" stroke={color} strokeWidth={fs * 0.06} />
            <text y={fs * 0.12} textAnchor="middle" fontSize={fs} fill="#f2f4f8" letterSpacing="0.04em">{label.length > 18 ? label.slice(0, 17) + '…' : label}</text>
          </g>
        )}
      </g>
    </g>
  );
}
