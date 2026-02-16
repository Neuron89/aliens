import React, { useMemo, useState, useContext, createContext } from 'react';

/* ═══════════════════════════════════════════════════════════════════════
   MAP ENGINE v1.0 — Reusable SVG deck-plan & blueprint generation toolkit

   A data-driven map rendering engine that produces detailed technical
   blueprints in the visual style of the ALIEN RPG sourcebooks.

   EXPORTS
   ───────
   Theme:       DEFAULT_THEME, createTheme, useMapTheme
   Constants:   DEFAULTS
   ID Helpers:  pid(name), purl(name)
   Utility:     seededRandom, registerIcon
   Primitives:  Room, Door, Cor, ShaftRoom, Vents
   Helpers:     MapPatterns, MapLegend, MapSpecs, defaultLegendItems
   Component:   MapEngine (default)

   USAGE — Full map with chrome:
     import MapEngine from './MapEngine';
     <MapEngine config={myMapConfig} />

   USAGE — Standalone primitives:
     import { Room, Door, Cor, useMapTheme } from './MapEngine';
     <svg><Room x={10} y={20} w={80} h={50} label="BRIDGE" shape="octagon" crew /></svg>

   CONFIG SHAPE
   ────────────
   {
     width, height,                  // SVG viewBox (default 1100×920)
     theme: {},                      // Color overrides merged with DEFAULT_THEME
     stars: { count, seed },         // Star-field (default 200 / 1979)
     frame: true,                    // Outer frame + corner marks
     scenarioTag: '',                // Vertical label on left edge
     hull: {                         // Ship hull (omit for stations/facilities)
       path,                         //   SVG path data string
       background: (C) => JSX,       //   Nacelles/nozzles (rendered BEHIND hull)
       overlays:   (C) => JSX,       //   Seam lines etc (inside hull clip)
     },
     exteriorDetails: (C) => JSX,    // Sensors, antenna, RCS (on top of hull)
     sidebar: (C, W, H) => JSX,      // Left sidebar content
     decks: [                        // Deck definitions (1 = no tab bar)
       { id, name, page, component },
     ],
     fixedOverlays: (C) => JSX,      // Elements on all decks (inside hull clip)
     specs: { title, items },        // Bottom-left tech specs
     legend: 'default' | [...],      // Legend items (or 'default')
   }
   ═══════════════════════════════════════════════════════════════════════ */


/* ─── Theme ───────────────────────────────────────────────────────────── */

export const DEFAULT_THEME = {
  bg: '#060810',        bgMid: '#0a0e16',
  frame: '#162828',     frameBright: '#1e3e3e',
  hull: '#2a7a68',      hullBright: '#35907a',
  hullMid: '#22685a',   hullDark: '#194a40',
  hullDeep: '#103830',  hullOutline: '#40a890',
  wall: '#1a5a4a',      wallBright: '#22685a',
  floor: '#0c2820',     floorCrew: '#0e3028',
  divider: '#1e6050',   door: '#50b898',
  equipLine: '#306858',
  vent: '#2a8070',      shaft: '#50b898',
  text: '#88bca8',      textBright: '#a8dcc8',
  textDim: '#406858',   textFaint: '#2a4a40',
  accent: '#50c8a8',    grid: '#1a4a3e',
  restricted: '#c04040',
};

export function createTheme(overrides = {}) {
  return { ...DEFAULT_THEME, ...overrides };
}

const MapThemeCtx = createContext(null);

export function useMapTheme() {
  return useContext(MapThemeCtx) || DEFAULT_THEME;
}


/* ─── Constants & ID helpers ──────────────────────────────────────────── */

export const DEFAULTS = {
  wallThickness: 3.5,
  shaftSize: 26,
  doorLength: 8,
  corWallThickness: 2.5,
};

export function pid(name) { return `me_${name}`; }
export function purl(name) { return `url(#me_${name})`; }


/* ─── Utility ─────────────────────────────────────────────────────────── */

export function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}


/* ─── SVG Pattern & Gradient Definitions ──────────────────────────────── */

export function MapPatterns({ hullPath }) {
  const C = useMapTheme();
  return (
    <defs>
      <radialGradient id={pid('bgGrad')} cx="55%" cy="45%" r="65%">
        <stop offset="0%" stopColor={C.bgMid} />
        <stop offset="100%" stopColor={C.bg} />
      </radialGradient>
      <linearGradient id={pid('hullGrad')} x1="30%" y1="0%" x2="70%" y2="100%">
        <stop offset="0%" stopColor={C.hullBright} />
        <stop offset="35%" stopColor={C.hull} />
        <stop offset="65%" stopColor={C.hullMid} />
        <stop offset="100%" stopColor={C.hullDark} />
      </linearGradient>
      <linearGradient id={pid('nacGrad')} x1="0%" y1="0%" x2="100%" y2="80%">
        <stop offset="0%" stopColor={C.hullMid} />
        <stop offset="100%" stopColor={C.hullDeep} />
      </linearGradient>
      <linearGradient id={pid('nozGrad')} x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stopColor={C.hullDeep} />
        <stop offset="100%" stopColor="#0a2018" />
      </linearGradient>
      <pattern id={pid('plate')} width="20" height="20" patternUnits="userSpaceOnUse">
        <line x1="0" y1="20" x2="20" y2="20" stroke={C.grid} strokeWidth="0.2" opacity="0.3" />
        <line x1="20" y1="0" x2="20" y2="20" stroke={C.grid} strokeWidth="0.2" opacity="0.3" />
      </pattern>
      <pattern id={pid('grating')} width="6" height="6" patternUnits="userSpaceOnUse">
        <line x1="0" y1="3" x2="6" y2="3" stroke={C.equipLine} strokeWidth="0.3" opacity="0.3" />
        <line x1="3" y1="0" x2="3" y2="6" stroke={C.equipLine} strokeWidth="0.3" opacity="0.3" />
      </pattern>
      <pattern id={pid('hatch')} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke={C.equipLine} strokeWidth="0.4" opacity="0.2" />
      </pattern>
      <pattern id={pid('floorTile')} width="12" height="12" patternUnits="userSpaceOnUse">
        <rect width="12" height="12" fill="none" />
        <rect x="0.5" y="0.5" width="11" height="11" fill="none" stroke={C.equipLine} strokeWidth="0.15" opacity="0.08" />
      </pattern>
      <pattern id={pid('hullRivet')} width="30" height="30" patternUnits="userSpaceOnUse">
        {[[0,0],[15,15],[30,0],[0,30],[30,30]].map(([cx, cy], i) =>
          <circle key={i} cx={cx} cy={cy} r="0.6" fill={C.hullOutline} opacity="0.12" />
        )}
      </pattern>
      {hullPath && <clipPath id={pid('hullClip')}><path d={hullPath} /></clipPath>}
    </defs>
  );
}


/* ─── Icon Registry ───────────────────────────────────────────────────── */

const ICON_RENDERERS = {
  medkit: (x, y, C) => (
    <g opacity="0.55">
      <rect x={x-3.5} y={y-3.5} width="7" height="7" fill="none" stroke={C.accent} strokeWidth="0.5" rx="1" />
      <rect x={x-2} y={y-0.5} width="4" height="1" fill={C.accent} rx="0.2" />
      <rect x={x-0.5} y={y-2} width="1" height="4" fill={C.accent} rx="0.2" />
    </g>
  ),
  terminal: (x, y, C) => (
    <g opacity="0.45">
      <rect x={x-3} y={y-2.5} width="6" height="5" fill="none" stroke={C.accent} strokeWidth="0.5" rx="0.5" />
      <line x1={x-1.5} y1={y+2.5} x2={x+1.5} y2={y+2.5} stroke={C.accent} strokeWidth="0.4" />
    </g>
  ),
  intercom: (x, y, C) => (
    <g opacity="0.45">
      <circle cx={x} cy={y} r="3" fill="none" stroke={C.accent} strokeWidth="0.5" />
      <circle cx={x} cy={y} r="1" fill={C.accent} />
    </g>
  ),
  restricted: (x, y, C) => (
    <g opacity="0.6">
      <circle cx={x} cy={y} r="3.5" fill="none" stroke={C.restricted} strokeWidth="0.7" />
      <line x1={x-2} y1={y+2} x2={x+2} y2={y-2} stroke={C.restricted} strokeWidth="0.5" />
    </g>
  ),
  weapon: (x, y, C) => (
    <g opacity="0.45">
      <rect x={x-3.5} y={y-1.5} width="7" height="3" fill="none" stroke={C.accent} strokeWidth="0.4" rx="0.5" />
      <line x1={x+3.5} y1={y} x2={x+5} y2={y} stroke={C.accent} strokeWidth="0.4" />
    </g>
  ),
  cryopod: (x, y, C) => (
    <g opacity="0.45">
      <rect x={x-2} y={y-3.5} width="4" height="7" fill="none" stroke={C.accent} strokeWidth="0.5" rx="2" />
      <circle cx={x} cy={y-1} r="0.8" fill={C.accent} />
    </g>
  ),
};

export function registerIcon(name, renderer) {
  ICON_RENDERERS[name] = renderer;
}

function renderIcon(icon, x, y, C, key) {
  const fn = ICON_RENDERERS[icon];
  return fn ? <g key={key}>{fn(x, y, C)}</g> : null;
}


/* ─── Room ────────────────────────────────────────────────────────────── */

export function Room({
  x, y, w, h, label, sub, fill, pattern, rx = 1,
  icons = [], labelSize = 6.5, shape = 'rect', crew = false,
  wt = DEFAULTS.wallThickness,
}) {
  const C = useMapTheme();
  const cx = x + w / 2, cy = y + h / 2;
  const chm = Math.min(w, h) * 0.25;
  const floorFill = fill || (crew ? C.floorCrew : C.floor);
  const t = wt;

  const octPts = (inset) => [
    [x + chm + inset, y + inset], [x + w - chm - inset, y + inset],
    [x + w - inset, y + chm + inset], [x + w - inset, y + h - chm - inset],
    [x + w - chm - inset, y + h - inset], [x + chm + inset, y + h - inset],
    [x + inset, y + h - chm - inset], [x + inset, y + chm + inset],
  ].map(p => p.join(',')).join(' ');

  const innerShape = (fillVal) => (
    shape === 'octagon'
      ? <polygon points={octPts(t)} fill={fillVal} />
      : shape === 'circle'
        ? <ellipse cx={cx} cy={cy} rx={w / 2 - t} ry={h / 2 - t} fill={fillVal} />
        : <rect x={x + t} y={y + t} width={w - t * 2} height={h - t * 2} fill={fillVal} rx={Math.max(0, rx - 1)} />
  );

  return (
    <g>
      {/* Outer wall band */}
      {shape === 'octagon'
        ? <polygon points={octPts(0)} fill={C.wall} stroke={C.hullOutline} strokeWidth="0.8" />
        : shape === 'circle'
          ? <ellipse cx={cx} cy={cy} rx={w / 2} ry={h / 2} fill={C.wall} stroke={C.hullOutline} strokeWidth="0.8" />
          : <rect x={x} y={y} width={w} height={h} fill={C.wall} stroke={C.hullOutline} strokeWidth="0.8" rx={rx} />
      }
      {/* Inner floor */}
      {innerShape(floorFill)}
      {/* Crew floor tiling (subtle) */}
      {crew && !pattern && innerShape(purl('floorTile'))}
      {/* Pattern overlay (hatch, grating, etc.) */}
      {pattern && innerShape(purl(pattern))}
      {/* Label */}
      {label && (
        <text x={cx} y={cy + (sub ? -1 : 2.5)} fill={C.text}
          fontSize={labelSize} textAnchor="middle" letterSpacing="0.06em">{label}</text>
      )}
      {sub && (
        <text x={cx} y={cy + 8} fill={C.textDim}
          fontSize="5" textAnchor="middle" letterSpacing="0.04em">{sub}</text>
      )}
      {/* Icons in top-right corner */}
      {icons.map((icon, i) => renderIcon(icon, x + w - 9 - i * 12, y + 9, C, i))}
    </g>
  );
}


/* ─── Door (gap-in-wall style) ────────────────────────────────────────── */

export function Door({ x, y, v = true, dl = DEFAULTS.doorLength }) {
  const C = useMapTheme();
  const wt = DEFAULTS.wallThickness;
  return v ? (
    <g>
      <rect x={x - wt / 2 - 0.5} y={y - dl / 2} width={wt + 1} height={dl} fill={C.floor} />
      <line x1={x - 0.3} y1={y - dl / 2} x2={x + 3} y2={y - dl / 2 + 2} stroke={C.door} strokeWidth="0.6" opacity="0.7" />
      <line x1={x - 0.3} y1={y + dl / 2} x2={x + 3} y2={y + dl / 2 - 2} stroke={C.door} strokeWidth="0.6" opacity="0.7" />
      <line x1={x} y1={y - dl / 2 + 1} x2={x} y2={y + dl / 2 - 1} stroke={C.door} strokeWidth="0.3" opacity="0.35" strokeDasharray="1 2" />
    </g>
  ) : (
    <g>
      <rect x={x - dl / 2} y={y - wt / 2 - 0.5} width={dl} height={wt + 1} fill={C.floor} />
      <line x1={x - dl / 2} y1={y - 0.3} x2={x - dl / 2 + 2} y2={y + 3} stroke={C.door} strokeWidth="0.6" opacity="0.7" />
      <line x1={x + dl / 2} y1={y - 0.3} x2={x + dl / 2 - 2} y2={y + 3} stroke={C.door} strokeWidth="0.6" opacity="0.7" />
      <line x1={x - dl / 2 + 1} y1={y} x2={x + dl / 2 - 1} y2={y} stroke={C.door} strokeWidth="0.3" opacity="0.35" strokeDasharray="1 2" />
    </g>
  );
}


/* ─── Corridor (with wall edges) ──────────────────────────────────────── */

export function Cor({ x, y, w, h }) {
  const C = useMapTheme();
  const wt = DEFAULTS.corWallThickness;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={C.wall} />
      <rect x={x + wt} y={y + wt} width={Math.max(0, w - wt * 2)} height={Math.max(0, h - wt * 2)}
        fill={C.floor} />
      <rect x={x + wt} y={y + wt} width={Math.max(0, w - wt * 2)} height={Math.max(0, h - wt * 2)}
        fill={purl('grating')} />
      <line x1={x + 0.5} y1={y} x2={x + 0.5} y2={y + h} stroke={C.hullOutline} strokeWidth="0.4" opacity="0.3" />
      <line x1={x + w - 0.5} y1={y} x2={x + w - 0.5} y2={y + h} stroke={C.hullOutline} strokeWidth="0.4" opacity="0.3" />
    </g>
  );
}


/* ─── ShaftRoom (ladder / elevator / air-scrubber) ────────────────────── */

export function ShaftRoom({ x, y, type = 'ladder', label, size = DEFAULTS.shaftSize }) {
  const C = useMapTheme();
  const s = size, t = 3;
  const isCircle = type === 'airscrub';
  return (
    <g>
      {isCircle
        ? <><circle cx={x} cy={y} r={s / 2} fill={C.wall} stroke={C.hullOutline} strokeWidth="0.8" />
            <circle cx={x} cy={y} r={s / 2 - t} fill={C.floor} /></>
        : <><rect x={x - s / 2} y={y - s / 2} width={s} height={s} fill={C.wall} stroke={C.hullOutline} strokeWidth="0.8" rx={2} />
            <rect x={x - s / 2 + t} y={y - s / 2 + t} width={s - t * 2} height={s - t * 2} fill={C.floor} rx={1} /></>
      }
      {type === 'ladder' && (
        <>
          {[-4, -1, 2, 5].map(dy => (
            <line key={dy} x1={x - 3.5} y1={y + dy} x2={x + 3.5} y2={y + dy}
              stroke={C.shaft} strokeWidth="0.7" opacity="0.6" />
          ))}
          <line x1={x - 3.5} y1={y - 6} x2={x - 3.5} y2={y + 6} stroke={C.shaft} strokeWidth="0.5" opacity="0.4" />
          <line x1={x + 3.5} y1={y - 6} x2={x + 3.5} y2={y + 6} stroke={C.shaft} strokeWidth="0.5" opacity="0.4" />
        </>
      )}
      {type === 'elevator' && (
        <>
          <rect x={x - s / 2 + t + 2} y={y - s / 2 + t + 2} width={s - t * 2 - 4} height={s - t * 2 - 4}
            fill="none" stroke={C.shaft} strokeWidth="0.5" strokeDasharray="2 2" rx="1" />
          <line x1={x - 3} y1={y - 3} x2={x + 3} y2={y + 3} stroke={C.shaft} strokeWidth="0.6" />
          <line x1={x + 3} y1={y - 3} x2={x - 3} y2={y + 3} stroke={C.shaft} strokeWidth="0.6" />
        </>
      )}
      {type === 'airscrub' && (
        <>
          <circle cx={x} cy={y} r={s / 2 - t - 2} fill="none" stroke={C.shaft} strokeWidth="0.5" strokeDasharray="2 2" />
          {[0, 60, 120, 180, 240, 300].map(a => {
            const rad = a * Math.PI / 180, r1 = 3, r2 = s / 2 - t - 1;
            return <line key={a} x1={x + Math.cos(rad) * r1} y1={y + Math.sin(rad) * r1}
              x2={x + Math.cos(rad) * r2} y2={y + Math.sin(rad) * r2}
              stroke={C.shaft} strokeWidth="0.3" opacity="0.3" />;
          })}
        </>
      )}
      <text x={x} y={y + s / 2 + 9} fill={C.textDim} fontSize="4.5"
        textAnchor="middle" letterSpacing="0.04em">{label}</text>
    </g>
  );
}


/* ─── Vents (paths + grate marks) ─────────────────────────────────────── */

export function Vents({ paths = [], grates = [] }) {
  const C = useMapTheme();
  return (
    <g opacity="0.35">
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={C.vent} strokeWidth="1.4" strokeDasharray="3 5" />
      ))}
      {grates.map(([gx, gy], i) => (
        <g key={`g${i}`}>
          <rect x={gx - 3} y={gy - 3} width="6" height="6" fill="none" stroke={C.vent} strokeWidth="0.6" rx="0.5" />
          <line x1={gx - 1.5} y1={gy - 1.5} x2={gx + 1.5} y2={gy + 1.5} stroke={C.vent} strokeWidth="0.3" />
          <line x1={gx + 1.5} y1={gy - 1.5} x2={gx - 1.5} y2={gy + 1.5} stroke={C.vent} strokeWidth="0.3" />
        </g>
      ))}
    </g>
  );
}


/* ─── Default Legend Items ─────────────────────────────────────────────── */

export function defaultLegendItems(C) {
  return [
    { y: 18, label: 'DOORWAY',
      draw: <rect x="0" y={14} width="10" height="6" fill={C.door} opacity="0.6" rx="0.5" /> },
    { y: 36, label: 'VENT PATHWAY',
      draw: <line x1="0" y1={33} x2="12" y2={33} stroke={C.vent} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.4" /> },
    { y: 54, label: 'LADDER ACCESS',
      draw: <><rect x="0" y={48} width="10" height="10" fill={C.hullDeep} stroke={C.shaft} strokeWidth="0.8" rx="1.5" />
        {[-2, 2].map(d => <line key={d} x1="2" y1={53 + d} x2="8" y2={53 + d} stroke={C.shaft} strokeWidth="0.5" opacity="0.5" />)}</> },
    { y: 72, label: 'ELEVATOR',
      draw: <><rect x="0" y={66} width="10" height="10" fill={C.hullDeep} stroke={C.shaft} strokeWidth="0.8" rx="1" />
        <line x1="2" y1={68} x2="8" y2={74} stroke={C.shaft} strokeWidth="0.4" />
        <line x1="8" y1={68} x2="2" y2={74} stroke={C.shaft} strokeWidth="0.4" /></> },
    { y: 90, label: 'AIR SCRUBBER SHAFT',
      draw: <circle cx="5" cy={86} r="5" fill={C.hullDeep} stroke={C.shaft} strokeWidth="0.8" /> },
    { y: 108, label: 'RESTRICTED ACCESS',
      draw: <circle cx="5" cy={105} r="3" fill="none" stroke={C.restricted} strokeWidth="0.6" opacity="0.7" /> },
    { y: 126, label: 'MACHINERY / TANKAGE',
      draw: <rect x="0" y={121} width="10" height="8" fill={purl('hatch')} stroke={C.equipLine} strokeWidth="0.3" /> },
    { y: 144, label: 'CORRIDOR / GRATING',
      draw: <rect x="0" y={139} width="10" height="8" fill={purl('grating')} stroke={C.equipLine} strokeWidth="0.3" /> },
    { y: 162, label: 'VIEWPORT',
      draw: <rect x="0" y={158} width="10" height="5" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.4" rx="1.5" opacity="0.5" /> },
    { y: 180, label: 'CREW AREA (FLOOR TINT)',
      draw: <><rect x="0" y={175} width="10" height="8" fill={C.wall} stroke={C.hullOutline} strokeWidth="0.4" />
        <rect x="2.5" y="177.5" width="5" height="3" fill={C.floorCrew} /></> },
  ];
}


/* ─── MapLegend ───────────────────────────────────────────────────────── */

export function MapLegend({ x = 0, y = 0, items }) {
  const C = useMapTheme();
  const resolved = items === 'default' ? defaultLegendItems(C) : (typeof items === 'function' ? items(C) : items);
  if (!resolved || resolved.length === 0) return null;
  const h = resolved[resolved.length - 1].y + 30;
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x="-10" y="-15" width="172" height={h} rx="3" fill="none" stroke={C.frame} strokeWidth="0.4" />
      <text y="0" fill={C.text} fontSize="7.5" fontWeight="bold" letterSpacing="0.1em">MAP LEGEND</text>
      {resolved.map((item, i) => (
        <g key={i}>
          {item.draw}
          <text x="20" y={item.y + 2} fill={C.textDim} fontSize="6" letterSpacing="0.05em">{item.label}</text>
        </g>
      ))}
    </g>
  );
}


/* ─── MapSpecs ────────────────────────────────────────────────────────── */

export function MapSpecs({ x = 60, y = 0, title = 'TECHNICAL SPECIFICATIONS', items = [] }) {
  const C = useMapTheme();
  return (
    <g>
      <text x={x} y={y} fill={C.text} fontSize="7.5" letterSpacing="0.1em" fontWeight="bold">{title}</text>
      {items.map(([label, value], i) => (
        <text key={i} x={x} y={y + 14 + i * 11} fill={C.textDim} fontSize="6">
          <tspan fill={C.text}>{label}:</tspan> {value}
        </text>
      ))}
    </g>
  );
}


/* ═════════════════════════════════════════════════════════════════════════
   MapEngine — Main wrapper component
   ═════════════════════════════════════════════════════════════════════════ */

export default function MapEngine({ config }) {
  const {
    width: W = 1100,
    height: H = 920,
    theme: themeOverrides,
    stars = { count: 200, seed: 1979 },
    frame = true,
    scenarioTag,
    hull,
    exteriorDetails,
    sidebar,
    decks = [],
    fixedOverlays,
    specs,
    legend = 'default',
  } = config;

  const C = themeOverrides ? createTheme(themeOverrides) : DEFAULT_THEME;
  const [activeDeckId, setActiveDeckId] = useState(decks[0]?.id);
  const activeDeck = decks.find(d => d.id === activeDeckId) || decks[0];

  const starData = useMemo(() => {
    const rng = seededRandom(stars.seed);
    return Array.from({ length: stars.count }, () => ({
      x: rng() * W, y: rng() * H, r: 0.2 + rng() * 1.0, o: 0.04 + rng() * 0.18,
    }));
  }, [W, H, stars.count, stars.seed]);

  const DeckComp = activeDeck?.component;
  const hullClip = hull?.path ? `url(#${pid('hullClip')})` : undefined;

  return (
    <MapThemeCtx.Provider value={C}>
      <div>
        {/* Deck selector (only when multiple decks) */}
        {decks.length > 1 && (
          <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.75rem' }}>
            {decks.map(d => (
              <button key={d.id} style={{
                fontFamily: "'Share Tech Mono', monospace", fontSize: '0.8rem',
                background: activeDeckId === d.id ? 'rgba(0,212,170,0.12)' : 'var(--bg-card)',
                border: `1px solid ${activeDeckId === d.id ? 'var(--accent)' : 'var(--border)'}`,
                color: activeDeckId === d.id ? 'var(--accent)' : 'var(--text-dim)',
                padding: '0.4rem 0.8rem', cursor: 'pointer', borderRadius: '2px',
                letterSpacing: '0.08em',
              }} onClick={() => setActiveDeckId(d.id)}>
                DECK {d.id} — {d.name}
              </button>
            ))}
          </div>
        )}

        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}
          xmlns="http://www.w3.org/2000/svg" fontFamily="'Share Tech Mono','Courier New',monospace">

          <MapPatterns hullPath={hull?.path} />

          {/* Background */}
          <rect width={W} height={H} fill={purl('bgGrad')} />
          {starData.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#c8d8e8" opacity={s.o} />)}

          {/* Frame */}
          {frame && (
            <g>
              <rect x="16" y="16" width={W - 32} height={H - 32} rx="10" fill="none" stroke={C.frame} strokeWidth="1.2" />
              <rect x="19" y="19" width={W - 38} height={H - 38} rx="8" fill="none" stroke={C.frameBright} strokeWidth="0.3" />
              {[[24, 24, 1, 1], [W - 24, 24, -1, 1], [24, H - 24, 1, -1], [W - 24, H - 24, -1, -1]].map(([fx, fy, dx, dy], i) => (
                <g key={i}>
                  <line x1={fx} y1={fy} x2={fx + 22 * dx} y2={fy} stroke={C.accent} strokeWidth="0.7" opacity="0.35" />
                  <line x1={fx} y1={fy} x2={fx} y2={fy + 22 * dy} stroke={C.accent} strokeWidth="0.7" opacity="0.35" />
                </g>
              ))}
            </g>
          )}

          {/* Scenario tag */}
          {scenarioTag && (
            <text x="32" y={H / 2 + 120} fill={C.textFaint} fontSize="10" letterSpacing="0.35em"
              transform={`rotate(-90,32,${H / 2 + 120})`} fontFamily="'Orbitron',sans-serif">{scenarioTag}</text>
          )}

          {/* Sidebar */}
          {sidebar && sidebar(C, W, H)}

          {/* Deck label */}
          {activeDeck && decks.length > 1 && (
            <g transform={`translate(${W / 2 - 55},42)`}>
              <text y="8" fill={C.textDim} fontSize="10" letterSpacing="0.18em" fontFamily="'Orbitron',sans-serif">DECK</text>
              <circle cx="52" cy="3" r="15" fill="none" stroke={C.hullOutline} strokeWidth="1.6" />
              <text x="52" y="9" fill={C.textBright} fontSize="17" fontWeight="bold" textAnchor="middle"
                fontFamily="'Orbitron',sans-serif">{activeDeck.id}</text>
              <text x="78" y="8" fill={C.textDim} fontSize="9.5" letterSpacing="0.15em"
                fontFamily="'Orbitron',sans-serif">{activeDeck.name}</text>
            </g>
          )}

          {/* Hull background elements (nacelles — rendered BEHIND hull) */}
          {hull?.background?.(C)}

          {/* Hull fill + pattern overlays */}
          {hull?.path && (
            <>
              <path d={hull.path} fill={purl('hullGrad')} stroke={C.hullOutline} strokeWidth="1.2" />
              <g clipPath={hullClip} opacity="0.3">
                <rect x="0" y="0" width={W} height={H} fill={purl('plate')} />
              </g>
              <g clipPath={hullClip}>
                <rect x="0" y="0" width={W} height={H} fill={purl('hullRivet')} />
              </g>
            </>
          )}

          {/* Hull overlays (seam lines — inside clip) */}
          {hull?.overlays && <g clipPath={hullClip}>{hull.overlays(C)}</g>}

          {/* Exterior details (sensors, antenna, RCS — on top of hull) */}
          {exteriorDetails?.(C)}

          {/* Active deck content */}
          <g clipPath={hullClip}>
            {DeckComp && <DeckComp />}
          </g>

          {/* Fixed overlays (rendered on all decks, inside hull clip) */}
          {fixedOverlays && <g clipPath={hullClip}>{fixedOverlays(C)}</g>}

          {/* Legend */}
          {legend && <MapLegend x={W - 195} y={85} items={legend} />}

          {/* Specs */}
          {specs && <MapSpecs x={specs.x || 60} y={specs.y || (H - 58)} title={specs.title} items={specs.items} />}

          {/* Page number */}
          {activeDeck?.page && (
            <text x={W - 48} y={H - 24} fill={C.textFaint} fontSize="10" textAnchor="end"
              fontFamily="'Orbitron',sans-serif">{activeDeck.page}</text>
          )}
        </svg>
      </div>
    </MapThemeCtx.Provider>
  );
}
