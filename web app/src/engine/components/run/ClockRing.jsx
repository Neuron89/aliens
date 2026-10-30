import React from 'react';

/* Segmented progress clock (Blades-style) drawn in SVG.
   Colors come from theme vars: danger → --danger, racing → --accent, tug → --warn.
   Shared by the GM run view, the TV overlay and the phone clock row. */
const KIND_COLOR = { danger: 'var(--danger)', racing: 'var(--accent)', tug: 'var(--warn)' };

export function clockColor(kind) {
  return KIND_COLOR[kind] || 'var(--accent)';
}

export default function ClockRing({ segments = 4, filled = 0, kind = 'danger', size = 48, stroke, title, className = '' }) {
  const n = Math.max(2, Math.min(12, Number(segments) || 4));
  const f = Math.max(0, Math.min(n, Number(filled) || 0));
  const color = clockColor(kind);
  const r = 45;
  const gap = n > 8 ? 4 : 6; // degrees between segments
  const sw = stroke || 0;
  const seg = (i) => {
    const a0 = ((i * 360) / n + gap / 2 - 90) * (Math.PI / 180);
    const a1 = (((i + 1) * 360) / n - gap / 2 - 90) * (Math.PI / 180);
    const x0 = 50 + r * Math.cos(a0);
    const y0 = 50 + r * Math.sin(a0);
    const x1 = 50 + r * Math.cos(a1);
    const y1 = 50 + r * Math.sin(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M50 50 L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
  };
  const full = f === n;
  return (
    <svg className={`clock-ring${full ? ' full' : ''} ${className}`} width={size} height={size} viewBox="0 0 100 100"
      role="img" aria-label={`${title ? title + ': ' : ''}${f} of ${n}${full ? ', full' : ''}`} style={{ color }}>
      {title && <title>{title}</title>}
      <circle cx="50" cy="50" r="48" fill="var(--bg-dark, #000)" stroke="currentColor" strokeOpacity="0.5" strokeWidth={2 + sw} />
      {Array.from({ length: n }, (_, i) => (
        <path key={i} d={seg(i)} fill={i < f ? 'currentColor' : 'transparent'}
          fillOpacity={i < f ? 0.92 : 0} stroke="currentColor" strokeOpacity={i < f ? 1 : 0.45} strokeWidth="1.5"
          className={i < f ? 'cr-on' : 'cr-off'} />
      ))}
      <circle cx="50" cy="50" r="7" fill="var(--bg-dark, #000)" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
