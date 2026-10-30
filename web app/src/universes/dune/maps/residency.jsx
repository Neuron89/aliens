import React from 'react';
import MapEngine, { useMapTheme } from '../../../engine/components/MapEngine';
import { LevelPlan, DUNE_MAP_THEME, duneLegend, duneSidebar, Table, Dots } from './duneMapKit.jsx';
import { W, H, OUTLINE, residencyRooms, residencyDoors, STAIRS } from './residency.geometry.js';

/* ═══════════════════════════════════════════════════════════════════════
   ARRAKEEN RESIDENCY — MapEngine plan (ground floor + roof).
   All rooms/doors come from residency.geometry.js, which also feeds the
   normalized board rooms in maps/index.js.
   ═══════════════════════════════════════════════════════════════════════ */

function GroundDecor() {
  const C = useMapTheme();
  return (
    <g>
      {/* dining table and great-hall dais */}
      <Table x={262} y={360} w={76} h={14} />
      <Table x={470} y={330} w={120} h={18} />
      <text x={530} y={342} fill={C.textFaint} fontSize="4" textAnchor="middle">DAIS</text>
      {/* conservatory palms + fountain */}
      <Dots points={[[430, 160], [455, 250], [610, 160], [632, 248], [470, 200], [590, 205]]} r={4} color={C.accent} />
      <circle cx={530} cy={205} r={14} fill="none" stroke={C.vent} strokeWidth="0.6" opacity="0.5" />
      <circle cx={530} cy={205} r={6} fill="none" stroke={C.vent} strokeWidth="0.4" opacity="0.4" />
      {/* great hall pillars */}
      <Dots points={[[420, 380], [420, 470], [640, 380], [640, 470], [450, 545], [610, 545]]} r={3} />
      {/* forecourt paving */}
      {[430, 470, 510, 550, 590, 630].map((x) => <line key={x} x1={x} y1={722} x2={x} y2={796} stroke={C.equipLine} strokeWidth="0.25" opacity="0.25" />)}
      {/* shield generator coil */}
      <circle cx={760} cy={650} r={18} fill="none" stroke={C.vent} strokeWidth="0.6" strokeDasharray="2 2" opacity="0.5" />
      {/* water stores cisterns */}
      <Dots points={[[722, 520], [760, 520], [798, 520]]} r={9} color={C.vent} />
    </g>
  );
}

function RoofDecor() {
  const C = useMapTheme();
  return (
    <g>
      {/* landing circle */}
      <circle cx={530} cy={440} r={78} fill="none" stroke={C.accent} strokeWidth="0.8" strokeDasharray="6 4" opacity="0.45" />
      <text x={530} y={448} fill={C.accent} fontSize="22" textAnchor="middle" opacity="0.25" style={{ fontFamily: 'var(--font-display)' }}>⊕</text>
      {/* conservatory dome ribs */}
      {[-60, -30, 0, 30, 60].map((dx) => <line key={dx} x1={530 + dx} y1={140} x2={530 + dx * 1.2} y2={270} stroke={C.vent} strokeWidth="0.4" opacity="0.35" />)}
      {/* windtrap fins */}
      {[712, 732, 752, 772, 792, 812].map((x) => <line key={x} x1={x} y1={150} x2={x} y2={250} stroke={C.equipLine} strokeWidth="0.8" opacity="0.35" />)}
      {/* shade sails */}
      {[170, 250, 330, 410].map((y) => <path key={y} d={`M 240 ${y} L 360 ${y + 20} L 240 ${y + 40}`} fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.3" />)}
      {/* shield pylon */}
      <circle cx={760} cy={644} r={10} fill="none" stroke={C.vent} strokeWidth="0.8" opacity="0.6" />
      <circle cx={760} cy={644} r={26} fill="none" stroke={C.vent} strokeWidth="0.4" strokeDasharray="1.5 2" opacity="0.4" />
    </g>
  );
}

const Ground = () => <LevelPlan rooms={residencyRooms} doors={residencyDoors} stairs={STAIRS} level="ground" decorate={() => <GroundDecor />} />;
const Roof = () => <LevelPlan rooms={residencyRooms} doors={residencyDoors} stairs={STAIRS} level="roof" decorate={() => <RoofDecor />} />;

export const residencyConfig = {
  width: W,
  height: H,
  theme: DUNE_MAP_THEME,
  stars: { count: 0, seed: 1965 },
  backdrop: "sand",
  levelNoun: "FLOOR",
  scenarioTag: 'HOUSE SEAT',
  hull: { path: OUTLINE },
  sidebar: duneSidebar({ title: 'ARRAKEEN RESIDENCY', subtitle: 'GOVERNOR’S RESIDENCE — ARRAKEEN' }),
  decks: [
    { id: 'G', level: 'ground', name: 'GROUND FLOOR', page: 'I', component: Ground },
    { id: 'R', level: 'roof', name: 'ROOF', page: 'II', component: Roof },
  ],
  specs: {
    title: 'RESIDENCY SURVEY',
    items: [
      ['FOOTPRINT', '120 × 140 METRES'],
      ['WALLS', 'Plascrete over native rock'],
      ['SHIELD', 'House shield, roof pylon'],
      ['WATER', 'Windtrap + sealed cisterns'],
      ['GARRISON', '24 household guards'],
    ],
  },
  legend: duneLegend(),
};

/** Interactive plan component, registered as universe.maps[arrakeen-residency].engine */
export function ResidencyMap() {
  return <MapEngine config={residencyConfig} />;
}
/* The table board renders single levels from the same config (board/EngineLayer.jsx). */
ResidencyMap.config = residencyConfig;
