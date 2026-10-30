import React from 'react';
import MapEngine, { useMapTheme } from '../../../engine/components/MapEngine';
import { LevelPlan, DUNE_MAP_THEME, duneLegend, duneSidebar, Dots } from './duneMapKit.jsx';
import { W, H, OUTLINE, sietchRooms, sietchDoors, CONDUITS, CONDUIT_GRATES } from './sietch.geometry.js';

/* ═══════════════════════════════════════════════════════════════════════
   SIETCH QARRAT — MapEngine cave plan (one level).
   Rooms/doors from sietch.geometry.js (also feeds the board rooms).
   ═══════════════════════════════════════════════════════════════════════ */

function rockStrata(C) {
  // faint strata lines across the rock mass (inside the outline clip)
  return (
    <g opacity="0.18">
      {[150, 230, 330, 420, 520, 610, 700, 780].map((y, i) => (
        <path key={y} d={`M 200 ${y} Q 420 ${y + (i % 2 ? 18 : -14)} 640 ${y + 6} T 900 ${y - 4}`} fill="none" stroke={C.hullOutline} strokeWidth="0.6" />
      ))}
    </g>
  );
}

function exterior(C) {
  // open sand beyond the ridge: dune ripples east of the worm tunnel, and above the entrance cleft
  return (
    <g opacity="0.5">
      {[560, 585, 640, 670].map((y, i) => <path key={y} d={`M 905 ${y} q 30 -8 60 0 t 60 0`} fill="none" stroke={C.equipLine} strokeWidth="0.6" />)}
      <text x={960} y={620} fill={C.textDim} fontSize="6" letterSpacing="0.2em">OPEN SAND</text>
      <text x={332} y={86} fill={C.textDim} fontSize="5" textAnchor="middle" letterSpacing="0.2em">▼ CLEFT</text>
      <text x={765} y={84} fill={C.textDim} fontSize="5" textAnchor="middle" letterSpacing="0.2em">▲ INTAKE FINS</text>
    </g>
  );
}

function SietchDecor() {
  const C = useMapTheme();
  return (
    <g>
      {/* council speaking ledge and seat rings */}
      <path d="M 490 330 Q 539 312 588 330" fill="none" stroke={C.accent} strokeWidth="1" opacity="0.4" />
      {[60, 80].map((r) => <path key={r} d={`M ${539 - r} 440 A ${r} ${r * 0.7} 0 0 0 ${539 + r} 440`} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.35" />)}
      {/* water basins */}
      <Dots points={[[500, 700], [548, 700], [596, 700]]} r={14} color={C.vent} />
      {/* workshop benches */}
      <rect x={708} y={392} width={60} height={8} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.4" />
      {/* windtrap condenser */}
      <circle cx={765} cy={190} r={22} fill="none" stroke={C.vent} strokeWidth="0.5" strokeDasharray="2 2" opacity="0.5" />
      {/* maker ramp slope hatching */}
      {[780, 800, 820, 840].map((x) => <line key={x} x1={x} y1={640} x2={x + 20} y2={750} stroke={C.equipLine} strokeWidth="0.4" opacity="0.3" />)}
    </g>
  );
}

const Cave = () => (
  <LevelPlan rooms={sietchRooms} doors={sietchDoors} level="sietch" conduits={CONDUITS} grates={CONDUIT_GRATES} decorate={() => <SietchDecor />} />
);

export const sietchConfig = {
  width: W,
  height: H,
  theme: DUNE_MAP_THEME,
  stars: { count: 0, seed: 10191 },
  backdrop: "sand",
  levelNoun: "LEVEL",
  scenarioTag: 'DEEP DESERT',
  hull: { path: OUTLINE, overlays: rockStrata },
  exteriorDetails: exterior,
  sidebar: duneSidebar({ title: 'SIETCH QARRAT', subtitle: 'FREMEN CAVE COMMUNITY — SHIELD WALL', tag: 'S I E T C H' }),
  decks: [{ id: 'S', level: 'sietch', name: 'CAVE LEVEL', page: 'III', component: Cave }],
  specs: {
    title: 'SIETCH SURVEY',
    items: [
      ['POPULATION', 'About 300'],
      ['WATER', 'Cache, windtrap, deathstill'],
      ['ACCESS', 'Hidden cleft; worm tunnel'],
      ['DEFENCE', 'Lookouts, rockfall seals'],
    ],
  },
  legend: duneLegend(),
};

/** Interactive cave plan, registered as universe.maps[sietch-qarrat].engine */
export function SietchMap() {
  return <MapEngine config={sietchConfig} />;
}
SietchMap.config = sietchConfig;
