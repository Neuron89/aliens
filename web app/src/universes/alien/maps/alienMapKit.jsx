import React from 'react';
import { Room, Door, Cor, ShaftRoom, Vents, useMapTheme, registerIcon, purl, defaultLegendItems } from '../../../engine/components/MapEngine';

/* ═══════════════════════════════════════════════════════════════════════
   ALIEN map kit — shared pieces for the ALIEN MapEngine plans (the
   Montero predates it and draws itself; every later plan uses this):
   a data-driven level renderer (rooms/corridors/doors/stairs from
   *.geometry.js, same shape as the Dune kit), ALIEN icon glyphs, the
   default legend with extras, and a titled sidebar. The theme is
   MapEngine's DEFAULT_THEME (teal deck-plan linework), so configs built
   with this kit set no `theme`; `backdrop` is 'space' for ships and
   stations, 'none' for planetside sites (draw your own ground).
   ═══════════════════════════════════════════════════════════════════════ */

const FILLS = { crew: null, hazard: '#2a1a14', water: '#0f2329', rock: '#1a1a16', sand: '#2a2418', ice: '#122a32', lava: '#3a1408' };

/* ─── Icons (registered once, prefixed to avoid collisions) ──────────── */
const ICONS = {
  'alien-airlock': (x, y, C) => (
    <g opacity="0.7" fill="none" stroke={C.accent} strokeWidth="0.6"><circle cx={x} cy={y} r="3.6" /><circle cx={x} cy={y} r="1.6" /><line x1={x - 3.6} y1={y} x2={x + 3.6} y2={y} /></g>
  ),
  'alien-hazard': (x, y, C) => (
    <g opacity="0.7"><path d={`M ${x} ${y - 3.8} L ${x + 3.8} ${y + 3} L ${x - 3.8} ${y + 3} Z`} fill="none" stroke={C.restricted} strokeWidth="0.7" /><line x1={x} y1={y - 1.2} x2={x} y2={y + 1} stroke={C.restricted} strokeWidth="0.7" /><circle cx={x} cy={y + 2} r="0.45" fill={C.restricted} /></g>
  ),
  'alien-xeno': (x, y, C) => (
    <g opacity="0.75" fill="none" stroke={C.restricted} strokeWidth="0.6"><path d={`M ${x - 3} ${y + 3} Q ${x - 3.5} ${y - 3} ${x} ${y - 3.8} Q ${x + 3.5} ${y - 3} ${x + 3} ${y + 3}`} /><path d={`M ${x - 1.6} ${y + 1} L ${x} ${y + 3.6} L ${x + 1.6} ${y + 1}`} /></g>
  ),
  'alien-egg': (x, y, C) => (
    <g opacity="0.7" fill="none" stroke={C.restricted} strokeWidth="0.6"><path d={`M ${x} ${y - 3.8} C ${x + 3.4} ${y - 2}, ${x + 3} ${y + 3.6}, ${x} ${y + 3.6} C ${x - 3} ${y + 3.6}, ${x - 3.4} ${y - 2}, ${x} ${y - 3.8} Z`} /><path d={`M ${x - 1.4} ${y - 1.2} L ${x} ${y + .4} L ${x + 1.4} ${y - 1.2}`} /></g>
  ),
  'alien-reactor': (x, y, C) => (
    <g opacity="0.7" fill="none" stroke={C.accent} strokeWidth="0.6"><circle cx={x} cy={y} r="3.6" /><path d={`M ${x} ${y - 3.6} L ${x} ${y} L ${x + 3.1} ${y + 1.8}`} /><path d={`M ${x} ${y} L ${x - 3.1} ${y + 1.8}`} /></g>
  ),
  'alien-vehicle': (x, y, C) => (
    <g opacity="0.7" fill="none" stroke={C.accent} strokeWidth="0.6"><rect x={x - 4} y={y - 1.8} width="8" height="3.6" rx="0.6" /><circle cx={x - 2.4} cy={y + 2.6} r="1" /><circle cx={x + 2.4} cy={y + 2.6} r="1" /></g>
  ),
  'alien-dropship': (x, y, C) => (
    <g opacity="0.7" fill="none" stroke={C.accent} strokeWidth="0.6"><path d={`M ${x} ${y - 3.8} L ${x + 1.4} ${y + 1} L ${x + 4.2} ${y + 2.4} L ${x} ${y + 1.6} L ${x - 4.2} ${y + 2.4} L ${x - 1.4} ${y + 1} Z`} /></g>
  ),
  'alien-comms': (x, y, C) => (
    <g opacity="0.7" fill="none" stroke={C.accent} strokeWidth="0.6"><path d={`M ${x - 3.4} ${y + 1} A 3.6 3.6 0 0 1 ${x + 3.4} ${y + 1}`} /><line x1={x} y1={y + 1} x2={x} y2={y + 3.8} /><circle cx={x} cy={y - 1.4} r="0.8" fill={C.accent} /></g>
  ),
  'alien-bed': (x, y, C) => (
    <g opacity="0.55"><rect x={x - 3.5} y={y - 2.2} width="7" height="4.4" fill="none" stroke={C.accent} strokeWidth="0.5" rx="0.6" /><rect x={x - 3} y={y - 1.7} width="2" height="3.4" fill={C.accent} opacity="0.5" /></g>
  ),
  'alien-fence': (x, y, C) => (
    <g opacity="0.6" stroke={C.accent} strokeWidth="0.5" fill="none"><line x1={x - 4} y1={y + 3} x2={x + 4} y2={y + 3} />{[-3, -1, 1, 3].map((d) => <line key={d} x1={x + d} y1={y - 3} x2={x + d} y2={y + 3} />)}<line x1={x - 4} y1={y - 1} x2={x + 4} y2={y - 1} strokeDasharray="1 1" /></g>
  ),
  'alien-sentry': (x, y, C) => (
    <g opacity="0.7" fill="none" stroke={C.accent} strokeWidth="0.6"><path d={`M ${x - 3} ${y + 3.4} L ${x + 3} ${y + 3.4} L ${x} ${y - 1} Z`} /><line x1={x} y1={y - 1} x2={x} y2={y - 4} /><line x1={x - 1.4} y1={y - 2.6} x2={x + 1.4} y2={y - 2.6} /></g>
  ),
  'alien-water': (x, y, C) => (
    <g opacity="0.7"><path d={`M ${x} ${y - 3.6} C ${x + 3} ${y}, ${x + 2.6} ${y + 3.4}, ${x} ${y + 3.4} C ${x - 2.6} ${y + 3.4}, ${x - 3} ${y}, ${x} ${y - 3.6} Z`} fill="none" stroke={C.vent} strokeWidth="0.6" /></g>
  ),
  'alien-fire': (x, y, C) => (
    <g opacity="0.65"><path d={`M ${x} ${y - 3.5} C ${x + 3} ${y - 0.5}, ${x + 2} ${y + 3.2}, ${x} ${y + 3.2} C ${x - 2} ${y + 3.2}, ${x - 3} ${y - 0.5}, ${x} ${y - 3.5} Z`} fill="none" stroke={C.restricted} strokeWidth="0.55" /></g>
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
      <rect x={x + 1.5} y={y + 1.5} width={w - 3} height={h - 3} fill="none" stroke={C.vent} strokeWidth="0.6" strokeDasharray="2 3" opacity="0.55" />
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

/** Renders one level of a geometry: corridors first, then rooms, doors, stairs.
    rooms[].draw: { kind: 'cor' | 'passage' | 'zone' } or Room options
    { sub, crew, icons, shape, pattern, fill, labelSize }. 'zone' rooms are board
    hit regions the plan draws itself (outdoor areas) and are skipped here. */
export function LevelPlan({ rooms, doors, stairs = [], level, conduits, grates, decorate }) {
  const C = useMapTheme();
  const here = rooms.filter((r) => r.level === level);
  const cors = here.filter((r) => r.draw?.kind === 'cor');
  const passages = here.filter((r) => r.draw?.kind === 'passage');
  const plain = here.filter((r) => !r.draw?.kind);
  return (
    <g>
      {cors.map((r) => <Cor key={r.id} {...r.rect} />)}
      {passages.map((r) => <Passage key={r.id} {...r.rect} label={r.name.toUpperCase()} />)}
      {plain.map((r) => {
        const { sub, crew, icons, shape, pattern, fill, labelSize } = r.draw || {};
        return (
          <Room key={r.id} {...r.rect} label={r.name.toUpperCase()} sub={sub} crew={crew} icons={icons}
            shape={shape} pattern={pattern} fill={fill ? (FILLS[fill] || fill) : undefined}
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
      {stairs.filter((s) => s.level === level || s.level === 'both' || (Array.isArray(s.levels) && s.levels.includes(level))).map((s, i) => (
        <ShaftRoom key={i} x={s.x} y={s.y} type={s.type} label={s.label} size={20} />
      ))}
    </g>
  );
}

/* ─── Legend & sidebar ───────────────────────────────────────────────── */

/** Default ALIEN legend plus extra rows: [{ label, draw: (y) => <svg bits/> }]. */
export function alienLegend(extra = []) {
  return (C) => {
    const base = defaultLegendItems(C);
    const start = (base[base.length - 1]?.y || 0) + 18;
    return [...base, ...extra.map((it, i) => { const y = start + i * 18; return { y, label: it.label, draw: it.draw(y) }; })];
  };
}

export function alienSidebar({ title, subtitle, tag = 'S C E N A R I O', scale = '2x2 METERS', compass = 'W' }) {
  return (C) => (
    <g>
      <text x="32" y="42" fill={C.textDim} fontSize="7.5" letterSpacing="0.25em" style={{ fontFamily: 'var(--font-display)' }} opacity="0.7">{tag}</text>
      <g transform="translate(90,130)" opacity="0.7">
        <circle r="16" fill="none" stroke={C.textDim} strokeWidth="0.8" />
        {compass === 'N'
          ? <><path d="M 0 -13 L 4 0 L 0 -3 L -4 0 Z" fill={C.accent} opacity="0.8" /><text y="-19" fill={C.textDim} fontSize="8" textAnchor="middle" style={{ fontFamily: 'var(--font-display)' }}>N</text></>
          : <text y="4.5" fill={C.textDim} fontSize="10" textAnchor="middle" style={{ fontFamily: 'var(--font-display)' }} fontWeight="bold">{compass}</text>}
      </g>
      <text x="82" y="560" fill={C.textBright} fontSize={title.length > 16 ? 18 : 24} fontWeight="bold" letterSpacing="0.18em"
        transform="rotate(-90,82,560)" style={{ fontFamily: 'var(--font-display)' }}>{title}</text>
      <text x="108" y="530" fill={C.textDim} fontSize="8.5" letterSpacing="0.08em" transform="rotate(-90,108,530)">{subtitle}</text>
      <g transform="translate(65,700)">
        <rect width="11" height="11" fill="none" stroke={C.textDim} strokeWidth="0.5" />
        <text x="18" y="9" fill={C.textDim} fontSize="7">{scale}</text>
      </g>
      <rect x="55" y="100" width="120" height="630" rx="3" fill="none" stroke={C.frame} strokeWidth="0.4" />
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

/** Hatched machinery block (reactor housings, tanks, processors). */
export function Machine({ x, y, w, h, label }) {
  const C = useMapTheme();
  return (
    <g opacity="0.7">
      <rect x={x} y={y} width={w} height={h} fill={purl('hatch')} stroke={C.equipLine} strokeWidth="0.5" />
      {label && <text x={x + w / 2} y={y + h + 5} fill={C.textFaint} fontSize="3.8" textAnchor="middle">{label}</text>}
    </g>
  );
}
