import React from 'react';
import { Room, Door, Cor, ShaftRoom, Vents, useMapTheme, registerIcon, purl } from '../../../engine/components/MapEngine';

/* ═══════════════════════════════════════════════════════════════════════
   DUNE map kit — shared pieces for the Dune MapEngine plans:
   sand-and-stone theme, Dune icon glyphs, a data-driven level renderer
   (rooms/corridors/doors/stairs from *.geometry.js), legend and sidebar.
   ═══════════════════════════════════════════════════════════════════════ */

export const DUNE_MAP_THEME = {
  bg: '#0a0704', bgMid: '#1a120a',
  frame: '#3a2a18', frameBright: '#5a4024',
  hull: '#5e4630', hullBright: '#74583a',
  hullMid: '#4e3a26', hullDark: '#3a2b1b',
  hullDeep: '#261b10', hullOutline: '#a57d4a',
  wall: '#4a3622', wallBright: '#5a422a',
  floor: '#1a120a', floorCrew: '#221810',
  divider: '#5a422a', door: '#e8a850',
  equipLine: '#8a6a44',
  vent: '#4fb3c4', shaft: '#e8a850',
  text: '#dcc8a0', textBright: '#f3e6c8',
  textDim: '#9a8360', textFaint: '#5a4630',
  accent: '#e2932e', grid: '#4a3622',
  restricted: '#c8503e',
};

const FILLS = { garden: '#1e2614', sand: '#3a2a16', glass: '#16252a', water: '#0f2329' };

/* ─── Icons (registered once, prefixed to avoid collisions) ──────────── */
const ICONS = {
  'dune-water': (x, y, C) => (
    <g opacity="0.75"><path d={`M ${x} ${y - 3.6} C ${x + 3} ${y}, ${x + 2.6} ${y + 3.4}, ${x} ${y + 3.4} C ${x - 2.6} ${y + 3.4}, ${x - 3} ${y}, ${x} ${y - 3.6} Z`} fill="none" stroke={C.vent} strokeWidth="0.6" /></g>
  ),
  'dune-palm': (x, y, C) => (
    <g opacity="0.6" stroke={C.accent} strokeWidth="0.5" fill="none">
      <line x1={x} y1={y + 3.5} x2={x} y2={y - 1} />
      {[-150, -110, -70, -30].map((a) => <line key={a} x1={x} y1={y - 1} x2={x + Math.cos((a * Math.PI) / 180) * 3.6} y2={y - 1 + Math.sin((a * Math.PI) / 180) * 3.6} />)}
    </g>
  ),
  'dune-bed': (x, y, C) => (
    <g opacity="0.5"><rect x={x - 3.5} y={y - 2.2} width="7" height="4.4" fill="none" stroke={C.accent} strokeWidth="0.5" rx="0.6" /><rect x={x - 3} y={y - 1.7} width="2" height="3.4" fill={C.accent} opacity="0.5" /></g>
  ),
  'dune-snooper': (x, y, C) => (
    <g opacity="0.55"><circle cx={x} cy={y} r="2.6" fill="none" stroke={C.accent} strokeWidth="0.5" /><circle cx={x} cy={y} r="0.9" fill={C.accent} /><line x1={x} y1={y - 3.8} x2={x} y2={y - 2.6} stroke={C.accent} strokeWidth="0.5" /></g>
  ),
  'dune-shield': (x, y, C) => (
    <g opacity="0.65" fill="none" stroke={C.vent} strokeWidth="0.55"><circle cx={x} cy={y} r="3.4" strokeDasharray="1.2 0.8" /><circle cx={x} cy={y} r="1.4" /></g>
  ),
  'dune-banner': (x, y, C) => (
    <g opacity="0.55"><path d={`M ${x - 2.5} ${y - 3.5} H ${x + 2.5} V ${y + 3} L ${x} ${y + 1.5} L ${x - 2.5} ${y + 3} Z`} fill="none" stroke={C.accent} strokeWidth="0.5" /></g>
  ),
  'dune-fire': (x, y, C) => (
    <g opacity="0.6"><path d={`M ${x} ${y - 3.5} C ${x + 3} ${y - 0.5}, ${x + 2} ${y + 3.2}, ${x} ${y + 3.2} C ${x - 2} ${y + 3.2}, ${x - 3} ${y - 0.5}, ${x} ${y - 3.5} Z`} fill="none" stroke={C.restricted} strokeWidth="0.55" /></g>
  ),
  'dune-thopter': (x, y, C) => (
    <g opacity="0.65" stroke={C.accent} strokeWidth="0.5" fill="none">
      <ellipse cx={x} cy={y} rx="1.2" ry="3" />
      <path d={`M ${x - 1} ${y - 1} L ${x - 4.5} ${y - 2.2} M ${x + 1} ${y - 1} L ${x + 4.5} ${y - 2.2} M ${x - 1} ${y + 0.6} L ${x - 4.5} ${y + 1.6} M ${x + 1} ${y + 0.6} L ${x + 4.5} ${y + 1.6}`} />
    </g>
  ),
  'dune-eye': (x, y, C) => (
    <g opacity="0.6"><path d={`M ${x - 3.8} ${y} Q ${x} ${y - 3.2} ${x + 3.8} ${y} Q ${x} ${y + 3.2} ${x - 3.8} ${y} Z`} fill="none" stroke={C.accent} strokeWidth="0.5" /><circle cx={x} cy={y} r="1" fill={C.accent} /></g>
  ),
  'dune-blade': (x, y, C) => (
    <g opacity="0.6" stroke={C.textBright} strokeWidth="0.55" fill="none"><path d={`M ${x - 3} ${y + 3} Q ${x + 1} ${y} ${x + 3.2} ${y - 3.4}`} /><line x1={x - 3.8} y1={y + 1.8} x2={x - 1.8} y2={y + 3.8} /></g>
  ),
  'dune-thumper': (x, y, C) => (
    <g opacity="0.6" stroke={C.accent} strokeWidth="0.55" fill="none"><line x1={x} y1={y - 3.5} x2={x} y2={y + 3.5} /><rect x={x - 1.6} y={y - 3.5} width="3.2" height="2.4" />{[1.8, 3].map((r) => <path key={r} d={`M ${x - r} ${y + 3.6} Q ${x} ${y + 3.6 - r / 2} ${x + r} ${y + 3.6}`} opacity="0.6" />)}</g>
  ),
};
for (const [name, fn] of Object.entries(ICONS)) registerIcon(name, fn);

/* ─── Level renderer ─────────────────────────────────────────────────── */

function Passage({ x, y, w, h, label }) {
  const C = useMapTheme();
  const vertical = h > w;
  const cx = x + w / 2, cy = y + h / 2;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={C.hullDeep} />
      <rect x={x + 1.5} y={y + 1.5} width={w - 3} height={h - 3} fill="none" stroke={C.door} strokeWidth="0.6" strokeDasharray="2 3" opacity="0.55" />
      <text x={cx} y={cy} fill={C.textDim} fontSize="4.2" textAnchor="middle" letterSpacing="0.15em"
        transform={vertical ? `rotate(-90,${cx},${cy})` : undefined}>{label}</text>
    </g>
  );
}

function CorLabel({ x, y, w, h, label }) {
  const C = useMapTheme();
  const vertical = h > w * 1.5;
  const cx = x + w / 2, cy = y + h / 2 + (vertical ? 0 : 1.6);
  return (
    <text x={cx} y={cy} fill={C.textDim} fontSize="4.4" textAnchor="middle" letterSpacing="0.22em" opacity="0.85"
      transform={vertical ? `rotate(-90,${cx},${cy})` : undefined}>{label}</text>
  );
}

/** Renders one level of a geometry: corridors first, then rooms, doors, stairs. */
export function LevelPlan({ rooms, doors, stairs = [], level, conduits, grates, decorate }) {
  const C = useMapTheme();
  const here = rooms.filter((r) => r.level === level);
  const cors = here.filter((r) => r.draw?.kind === 'cor');
  const passages = here.filter((r) => r.draw?.kind === 'passage');
  const plain = here.filter((r) => !r.draw?.kind);
  return (
    <g>
      {cors.map((r) => <Cor key={r.id} {...r.rect} />)}
      {passages.map((r) => <Passage key={r.id} {...r.rect} label={r.name.toUpperCase().replace(' SERVANT PASSAGE', ' PASSAGE')} />)}
      {plain.map((r) => {
        const { sub, crew, icons, shape, pattern, fill, labelSize } = r.draw || {};
        return (
          <Room key={r.id} {...r.rect} label={r.name.toUpperCase()} sub={sub} crew={crew} icons={icons}
            shape={shape} pattern={pattern} fill={FILLS[fill] || (fill ? undefined : undefined)}
            labelSize={labelSize || (r.rect.w < 100 ? 5.2 : 6.4)} />
        );
      })}
      {conduits && <Vents paths={conduits} grates={grates || []} />}
      {decorate?.(C)}
      {cors.map((r) => <CorLabel key={`l-${r.id}`} {...r.rect} label={r.name.toUpperCase()} />)}
      {doors.filter((d) => d.level === level).map((d, i) => (
        <g key={i}>
          <Door x={d.x} y={d.y} v={d.v} />
          {d.locked && <circle cx={d.x + (d.v ? 0 : 6)} cy={d.y + (d.v ? 6 : 0)} r="1.6" fill="none" stroke={C.restricted} strokeWidth="0.6" opacity="0.8" />}
        </g>
      ))}
      {stairs.filter((s) => s.level === level || s.level === 'both').map((s, i) => (
        <ShaftRoom key={i} x={s.x} y={s.y} type={s.type} label={s.label} size={20} />
      ))}
    </g>
  );
}

/* ─── Legend & sidebar ───────────────────────────────────────────────── */

export function duneLegend(extra = []) {
  return (C) => {
    const items = [
      { label: 'DOORWAY', draw: (y) => <rect x="0" y={y - 4} width="10" height="6" fill={C.door} opacity="0.6" rx="0.5" /> },
      { label: 'SEALED / LOCKED DOOR', draw: (y) => <circle cx="5" cy={y - 1} r="3" fill="none" stroke={C.restricted} strokeWidth="0.7" /> },
      { label: 'HIDDEN PASSAGE', draw: (y) => <rect x="0" y={y - 5} width="10" height="8" fill={C.hullDeep} stroke={C.door} strokeWidth="0.6" strokeDasharray="2 2" /> },
      { label: 'STAIR / LADDER', draw: (y) => <><rect x="0" y={y - 6} width="10" height="10" fill={C.hullDeep} stroke={C.shaft} strokeWidth="0.8" rx="1.5" />{[-3, 1].map((d) => <line key={d} x1="2" y1={y + d} x2="8" y2={y + d} stroke={C.shaft} strokeWidth="0.5" opacity="0.6" />)}</> },
      { label: 'WATER CONDUIT', draw: (y) => <line x1="0" y1={y - 1} x2="12" y2={y - 1} stroke={C.vent} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.6" /> },
      { label: 'SHIELD / RESTRICTED', draw: (y) => <circle cx="5" cy={y - 1} r="3.4" fill="none" stroke={C.vent} strokeWidth="0.6" strokeDasharray="1.2 0.8" /> },
      { label: 'MACHINERY / STORES', draw: (y) => <rect x="0" y={y - 5} width="10" height="8" fill={purl('hatch')} stroke={C.equipLine} strokeWidth="0.3" /> },
      { label: 'LIVING AREA', draw: (y) => <><rect x="0" y={y - 5} width="10" height="8" fill={C.wall} stroke={C.hullOutline} strokeWidth="0.4" /><rect x="2.5" y={y - 2.5} width="5" height="3" fill={C.floorCrew} /></> },
      ...extra,
    ];
    return items.map((it, i) => {
      const y = 18 + i * 18;
      return { y, label: it.label, draw: it.draw(y) };
    });
  };
}

export function duneSidebar({ title, subtitle, tag = 'A R R A K I S', scale = '5 METRES' }) {
  return (C) => (
    <g>
      <text x="32" y="42" fill={C.textDim} fontSize="7.5" letterSpacing="0.25em" style={{ fontFamily: 'var(--font-display)' }} opacity="0.7">{tag}</text>
      <g transform="translate(115,130)" opacity="0.75">
        <circle r="16" fill="none" stroke={C.textDim} strokeWidth="0.8" />
        <path d="M 0 -13 L 4 0 L 0 -3 L -4 0 Z" fill={C.accent} opacity="0.8" />
        <text y="-19" fill={C.textDim} fontSize="8" textAnchor="middle" style={{ fontFamily: 'var(--font-display)' }}>N</text>
      </g>
      <text x="100" y="600" fill={C.textBright} fontSize="22" fontWeight="bold" letterSpacing="0.16em"
        transform="rotate(-90,100,600)" style={{ fontFamily: 'var(--font-display)' }}>{title}</text>
      <text x="128" y="560" fill={C.textDim} fontSize="8.5" letterSpacing="0.1em" transform="rotate(-90,128,560)">{subtitle}</text>
      <g transform="translate(70,700)">
        <rect width="11" height="11" fill="none" stroke={C.textDim} strokeWidth="0.5" />
        <text x="18" y="9" fill={C.textDim} fontSize="7">{scale}</text>
      </g>
      <rect x="55" y="100" width="130" height="630" rx="3" fill="none" stroke={C.frame} strokeWidth="0.4" />
    </g>
  );
}

/* Small decoration helpers used by the plans. */
export function Table({ x, y, w, h }) {
  const C = useMapTheme();
  return <rect x={x} y={y} width={w} height={h} fill="none" stroke={C.equipLine} strokeWidth="0.5" rx="1" opacity="0.45" />;
}

export function Dots({ points, r = 1.4, color }) {
  const C = useMapTheme();
  return <g>{points.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={r} fill="none" stroke={color || C.equipLine} strokeWidth="0.4" opacity="0.45" />)}</g>;
}
