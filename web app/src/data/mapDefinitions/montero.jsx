import React from 'react';
import {
  Room, Door, Cor, ShaftRoom, Vents,
  useMapTheme, purl, pid, DEFAULTS,
} from '../../components/MapEngine';

/* ═══════════════════════════════════════════════════════════════════════
   USCSS MONTERO — Map Definition for MapEngine
   Lockmart CM-88G Bison-Class Commercial Towing Vehicle
   From the "Chariot of the Gods" cinematic scenario
   ═══════════════════════════════════════════════════════════════════════ */


/* ─── Canvas & hull geometry ──────────────────────────────────────────── */

const W = 1100, H = 920;
const CX = 600;
const HT = 75, HB = 845;
const HL = CX - 178, HR = CX + 178;

const HULL = `M ${CX} ${HT} C ${CX - 10} ${HT},${CX - 50} ${HT + 22},${CX - 68} ${HT + 45}
  L ${CX - 88} ${HT + 72} L ${CX - 105} ${HT + 105} L ${HL + 32} ${HT + 145}
  L ${HL + 16} ${HT + 190} L ${HL + 6} ${HT + 240} L ${HL} ${HT + 310} L ${HL} ${HB - 120}
  L ${HL + 8} ${HB - 70} L ${HL + 22} ${HB - 38} L ${HL + 50} ${HB - 12} L ${HL + 82} ${HB}
  L ${HR - 82} ${HB} L ${HR - 50} ${HB - 12} L ${HR - 22} ${HB - 38}
  L ${HR - 8} ${HB - 70} L ${HR} ${HB - 120} L ${HR} ${HT + 310}
  L ${HR - 6} ${HT + 240} L ${HR - 16} ${HT + 190} L ${HR - 32} ${HT + 145}
  L ${CX + 105} ${HT + 105} L ${CX + 88} ${HT + 72} L ${CX + 68} ${HT + 45}
  C ${CX + 50} ${HT + 22},${CX + 10} ${HT},${CX} ${HT} Z`;

const NAC_L = `M ${HL - 2} ${HB - 195} L ${HL - 30} ${HB - 170} L ${HL - 40} ${HB - 145} L ${HL - 42} ${HB - 55} L ${HL - 32} ${HB - 22} L ${HL - 15} ${HB - 8} L ${HL} ${HB - 5} L ${HL} ${HB - 195} Z`;
const NAC_R = `M ${HR + 2} ${HB - 195} L ${HR + 30} ${HB - 170} L ${HR + 40} ${HB - 145} L ${HR + 42} ${HB - 55} L ${HR + 32} ${HB - 22} L ${HR + 15} ${HB - 8} L ${HR} ${HB - 5} L ${HR} ${HB - 195} Z`;
const NOZ_L = `M ${HL - 40} ${HB - 18} L ${HL - 52} ${HB + 8} L ${HL - 12} ${HB + 8} L ${HL - 18} ${HB - 18} Z`;
const NOZ_R = `M ${HR + 40} ${HB - 18} L ${HR + 52} ${HB + 8} L ${HR + 12} ${HB + 8} L ${HR + 18} ${HB - 18} Z`;


/* ─── Inner layout constants ──────────────────────────────────────────── */

const IL = CX - 128;
const IR = CX + 128;
const COR_W = 22;
const CL = CX - COR_W / 2;
const CR = CX + COR_W / 2;
const GAP = 4;
const PL = IL;
const PW = CL - GAP - PL;
const SL = CR + GAP;
const SW = IR - SL;
const SH_SZ = DEFAULTS.shaftSize;


/* ═══════════════════════════════════════════════════════════════════════
   DECK A — PERSONNEL DECK
   ═══════════════════════════════════════════════════════════════════════ */

function MonteroDeckA() {
  const C = useMapTheme();
  const RH = 44, G = 5;
  let y = HT + 90;

  const bridgeY = y; y += 55 + G;
  const hyperY = y; y += 42 + G;
  const cryoY = y; y += RH + G;
  const jctFwdY = y; y += SH_SZ + G;
  const tankY = y; y += RH + G;
  const clawY = y; y += RH + G;
  const elevY = y; const airY = y; y += SH_SZ + G;
  const galleyY = y; y += RH + G;
  const medlabY = galleyY;
  const hygieneY = y; y += RH + G;
  const storageY = hygieneY;
  const muthurY = y; y += RH + G;
  const jctAftY = y;

  const ventL = IL - 7, ventR = IR + 7;

  return (
    <g>
      {/* Bridge */}
      <Room x={CX - 60} y={bridgeY} w={120} h={55} label="BRIDGE" shape="octagon"
        icons={['terminal', 'intercom']} crew />
      {[-35, -17, 0, 17, 35].map(dx => (
        <rect key={dx} x={CX + dx - 4} y={bridgeY - 2} width="8" height="4"
          fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.3" rx="1" opacity="0.45" />
      ))}
      <path d={`M ${CX - 30} ${bridgeY + 38} A 35 15 0 0 1 ${CX + 30} ${bridgeY + 38}`}
        fill="none" stroke={C.equipLine} strokeWidth="0.5" opacity="0.25" />
      {[-22, 22].map(dx => (
        <circle key={dx} cx={CX + dx} cy={bridgeY + 18} r="1.5" fill="none"
          stroke={C.equipLine} strokeWidth="0.4" opacity="0.2" />
      ))}
      <Cor x={CL} y={bridgeY + 55} w={COR_W} h={G} />

      {/* Hyperdrive Machinery */}
      <Room x={IL + 10} y={hyperY} w={IR - IL - 20} h={42} label="HYPERDRIVE MACHINERY SPACE"
        fill={C.hullDeep} pattern="hatch" labelSize={5.5} />
      <Door x={CX} y={hyperY} v={false} />
      <Cor x={CL} y={hyperY + 42} w={COR_W} h={G} />

      {/* Cryo Chamber */}
      <Room x={IL + 5} y={cryoY} w={IR - IL - 10} h={RH} label="CRYO CHAMBER"
        sub="5 PODS" icons={['cryopod', 'medkit']} rx={18} crew />
      <Door x={CX} y={cryoY} v={false} />
      {[-50, -25, 0, 25, 50].map(dx => (
        <rect key={dx} x={CX + dx - 5} y={cryoY + 8} width="10" height="18" fill="none"
          stroke={C.equipLine} strokeWidth="0.3" rx="4" opacity="0.15" />
      ))}
      <Cor x={CL} y={cryoY + RH} w={COR_W} h={G} />

      {/* Junction FWD */}
      <Cor x={CL} y={jctFwdY} w={COR_W} h={SH_SZ} />
      <ShaftRoom x={CX} y={jctFwdY + SH_SZ / 2} type="ladder" label="JUNCTION FWD" />
      <Cor x={CL} y={jctFwdY + SH_SZ} w={COR_W} h={G} />

      {/* Main corridor spine */}
      <Cor x={CL} y={tankY} w={COR_W} h={jctAftY - tankY + SH_SZ} />

      {/* PORT: Tankage */}
      <Room x={PL} y={tankY} w={PW} h={RH} label="TANKAGE" fill={C.hullDeep} pattern="hatch" />
      <Door x={CL} y={tankY + RH / 2} />
      {/* STBD: Tankage */}
      <Room x={SL} y={tankY} w={SW} h={RH} label="TANKAGE" fill={C.hullDeep} pattern="hatch" />
      <Door x={CR} y={tankY + RH / 2} />

      {/* PORT: Upper Landing Claw */}
      <Room x={PL} y={clawY} w={PW} h={RH} label="UPPER LANDING" sub="CLAW CHAMBER"
        fill={C.hullDeep} labelSize={5.5} />
      <Door x={CL} y={clawY + RH / 2} />
      {/* STBD: Upper Landing Claw */}
      <Room x={SL} y={clawY} w={SW} h={RH} label="UPPER LANDING" sub="CLAW CHAMBER"
        fill={C.hullDeep} labelSize={5.5} />
      <Door x={CR} y={clawY + RH / 2} />

      {/* Elevator shaft */}
      <ShaftRoom x={PL + PW / 2} y={elevY + SH_SZ / 2} type="elevator" label="CARGO ELEVATOR" />
      <Door x={CL} y={elevY + SH_SZ / 2} />
      {/* Air Scrubber shaft */}
      <ShaftRoom x={SL + SW / 2} y={airY + SH_SZ / 2} type="airscrub" label="AIR SCRUBBER" />
      <Door x={CR} y={airY + SH_SZ / 2} />

      {/* PORT: Galley */}
      <Room x={PL} y={galleyY} w={PW} h={RH} label="GALLEY" icons={['intercom']} rx={6} crew />
      <Door x={CL} y={galleyY + RH / 2} />
      {/* STBD: Medlab */}
      <Room x={SL} y={medlabY} w={SW} h={RH} label="MEDLAB" shape="octagon"
        icons={['medkit', 'terminal']} crew />
      <Door x={CR} y={medlabY + RH / 2} />

      {/* PORT: Hygiene & Lockers */}
      <Room x={PL} y={hygieneY} w={PW} h={RH} label="HYGIENE" sub="& LOCKERS" labelSize={5.5} crew />
      <Door x={CL} y={hygieneY + RH / 2} />
      {/* STBD: Storage */}
      <Room x={SL} y={storageY} w={SW} h={RH} label="STORAGE" fill={C.hullDeep} />
      <Door x={CR} y={storageY + RH / 2} />

      {/* PORT: MU/TH/UR */}
      <Room x={PL} y={muthurY} w={PW} h={RH} label="MU/TH/UR" sub="6500" shape="octagon"
        icons={['restricted', 'terminal']} />
      <Door x={CL} y={muthurY + RH / 2} />
      {/* STBD: Supplies */}
      <Room x={SL} y={muthurY} w={SW} h={RH} label="SUPPLIES" fill={C.hullDeep} rx={4} />
      <Door x={CR} y={muthurY + RH / 2} />

      {/* Junction AFT */}
      <ShaftRoom x={CX} y={jctAftY + SH_SZ / 2} type="ladder" label="JUNCTION AFT" />

      {/* Vents */}
      <Vents paths={[
        `M ${ventL} ${hyperY} L ${ventL} ${jctAftY + SH_SZ}`,
        `M ${ventR} ${hyperY} L ${ventR} ${jctAftY + SH_SZ}`,
        `M ${ventL} ${hyperY} L ${ventR} ${hyperY}`,
        `M ${ventL} ${jctAftY + SH_SZ} L ${ventR} ${jctAftY + SH_SZ}`,
        `M ${PL - 4} ${tankY} L ${PL - 4} ${muthurY + RH}`,
        `M ${IR + 4} ${tankY} L ${IR + 4} ${muthurY + RH}`,
      ]} grates={[
        [ventL, hyperY], [ventR, hyperY],
        [ventL, jctAftY + SH_SZ], [ventR, jctAftY + SH_SZ],
        [ventL, (hyperY + jctAftY + SH_SZ) / 2], [ventR, (hyperY + jctAftY + SH_SZ) / 2],
      ]} />
    </g>
  );
}


/* ═══════════════════════════════════════════════════════════════════════
   DECK B — OPERATIONS DECK
   ═══════════════════════════════════════════════════════════════════════ */

function MonteroDeckB() {
  const C = useMapTheme();
  const RH = 44, G = 5;
  let y = HT + 90;

  const navY = y; y += 50 + G;
  const lifeSupY = y; y += 42 + G;
  const dockY = y; y += RH + G;
  const jctFwdY = y; y += SH_SZ + G;
  const waterY = y; y += RH + G;
  const clawY = y; y += RH + G;
  const elevY = y; const airY = y; y += SH_SZ + G;
  const reactorY = y; y += 70 + G;
  const coolantY = y; y += RH + G;
  const jctAftY = y;

  const ventL = IL - 7, ventR = IR + 7;

  return (
    <g>
      {/* Nav Systems */}
      <Room x={CX - 55} y={navY} w={110} h={50} label="NAVIGATION" sub="SYSTEMS"
        fill={C.hullDeep} pattern="hatch" shape="octagon" icons={['terminal']} />
      <Cor x={CL} y={navY + 50} w={COR_W} h={G} />

      {/* Life Support */}
      <Room x={IL + 10} y={lifeSupY} w={IR - IL - 20} h={42} label="LIFE SUPPORT CONTROL"
        icons={['terminal', 'intercom']} rx={10} crew />
      <Door x={CX} y={lifeSupY} v={false} />
      <Cor x={CL} y={lifeSupY + 42} w={COR_W} h={G} />

      {/* PORT: Docking Umbilical */}
      <Room x={PL} y={dockY} w={PW} h={RH} label="DOCKING" sub="UMBILICAL" labelSize={5.5} />
      {/* STBD: Main Airlock */}
      <Room x={SL} y={dockY} w={SW} h={RH} label="MAIN AIRLOCK" labelSize={5.5} shape="octagon" />
      <Cor x={CL} y={dockY} w={COR_W} h={RH} />
      <Door x={CL} y={dockY + RH / 2} />
      <Door x={CR} y={dockY + RH / 2} />
      <Cor x={CL} y={dockY + RH} w={COR_W} h={G} />

      {/* Junction FWD */}
      <Cor x={CL} y={jctFwdY} w={COR_W} h={SH_SZ} />
      <ShaftRoom x={CX} y={jctFwdY + SH_SZ / 2} type="ladder" label="JUNCTION FWD" />
      <Cor x={CL} y={jctFwdY + SH_SZ} w={COR_W} h={G} />

      {/* Main corridor */}
      <Cor x={CL} y={waterY} w={COR_W} h={jctAftY - waterY + SH_SZ} />
      {/* Cross-corridor at midpoint */}
      <Cor x={PL} y={elevY} w={IR - PL} h={SH_SZ} />

      {/* PORT: Water Reclamation */}
      <Room x={PL} y={waterY} w={PW} h={RH} label="WATER" sub="RECLAMATION" labelSize={5.5} />
      <Door x={CL} y={waterY + RH / 2} />
      {/* STBD: Workshop */}
      <Room x={SL} y={waterY} w={SW} h={RH} label="WORKSHOP" sub="ENGINEERING" labelSize={5.5}
        icons={['terminal']} rx={8} crew />
      <Door x={CR} y={waterY + RH / 2} />

      {/* PORT: Lower Claw */}
      <Room x={PL} y={clawY} w={PW} h={RH} label="LOWER CLAW" sub="MECHANISM"
        fill={C.hullDeep} pattern="hatch" labelSize={5.5} />
      <Door x={CL} y={clawY + RH / 2} />
      {/* STBD: Maintenance */}
      <Room x={SL} y={clawY} w={SW} h={RH} label="MAINTENANCE" sub="BAY" labelSize={5.5}
        icons={['intercom']} rx={8} crew />
      <Door x={CR} y={clawY + RH / 2} />

      {/* Elevator */}
      <ShaftRoom x={PL + PW / 2} y={elevY + SH_SZ / 2} type="elevator" label="CARGO ELEVATOR" />
      {/* Air Scrubber */}
      <ShaftRoom x={SL + SW / 2} y={airY + SH_SZ / 2} type="airscrub" label="AIR SCRUBBER" />

      {/* Reactor Room */}
      <Room x={IL + 5} y={reactorY} w={IR - IL - 10} h={70} label="REACTOR ROOM"
        fill={C.hullDeep} shape="circle" icons={['terminal']} />
      <Door x={CX} y={reactorY} v={false} />
      {/* Reactor core detail */}
      <circle cx={CX} cy={reactorY + 35} r="18" fill="none"
        stroke={C.equipLine} strokeWidth="0.4" strokeDasharray="3 3" opacity="0.2" />
      <circle cx={CX} cy={reactorY + 35} r="10" fill="none"
        stroke={C.equipLine} strokeWidth="0.5" opacity="0.3" />
      <circle cx={CX} cy={reactorY + 35} r="3" fill={C.equipLine} opacity="0.15" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map(a => {
        const rad = a * Math.PI / 180;
        return <line key={a} x1={CX + Math.cos(rad) * 4} y1={reactorY + 35 + Math.sin(rad) * 4}
          x2={CX + Math.cos(rad) * 16} y2={reactorY + 35 + Math.sin(rad) * 16}
          stroke={C.equipLine} strokeWidth="0.3" opacity="0.2" />;
      })}

      {/* PORT: Coolant */}
      <Room x={PL} y={coolantY} w={PW} h={RH} label="COOLANT" sub="SYSTEMS"
        fill={C.hullDeep} pattern="hatch" labelSize={5.5} />
      <Door x={CL} y={coolantY + RH / 2} />
      {/* STBD: Reactor Control */}
      <Room x={SL} y={coolantY} w={SW} h={RH} label="REACTOR" sub="CONTROL"
        labelSize={5.5} shape="octagon" icons={['terminal', 'restricted']} />
      <Door x={CR} y={coolantY + RH / 2} />

      {/* Junction AFT */}
      <ShaftRoom x={CX} y={jctAftY + SH_SZ / 2} type="ladder" label="JUNCTION AFT" />

      <Vents paths={[
        `M ${ventL} ${lifeSupY} L ${ventL} ${jctAftY + SH_SZ}`,
        `M ${ventR} ${lifeSupY} L ${ventR} ${jctAftY + SH_SZ}`,
        `M ${ventL} ${lifeSupY} L ${ventR} ${lifeSupY}`,
        `M ${ventL} ${jctAftY + SH_SZ} L ${ventR} ${jctAftY + SH_SZ}`,
        `M ${PL - 4} ${waterY} L ${PL - 4} ${coolantY + RH}`,
        `M ${IR + 4} ${waterY} L ${IR + 4} ${coolantY + RH}`,
      ]} grates={[
        [ventL, lifeSupY], [ventR, lifeSupY],
        [ventL, jctAftY + SH_SZ], [ventR, jctAftY + SH_SZ],
        [ventL, (lifeSupY + jctAftY + SH_SZ) / 2], [ventR, (lifeSupY + jctAftY + SH_SZ) / 2],
      ]} />
    </g>
  );
}


/* ═══════════════════════════════════════════════════════════════════════
   DECK C — CARGO DECK
   ═══════════════════════════════════════════════════════════════════════ */

function MonteroDeckC() {
  const C = useMapTheme();
  const G = 5;
  const sideCorW = 18;
  const WT = DEFAULTS.wallThickness;

  const sclX = PL;
  const cbL = PL + sideCorW + GAP;
  const cbR = IR - sideCorW - GAP;
  const scrX = IR - sideCorW;

  let y = HT + 95;
  const shuttleY = y; y += 70 + G;
  const jctFwdY = y; y += SH_SZ + G;
  const alcoveY = y; y += 40 + G;
  const topCorY = y; y += 16 + G;
  const cargoY = y; y += 170 + G;
  const botCorY = y; y += 16 + G;
  const shaftY = y; y += SH_SZ + G;
  const ventralY = y; y += 44 + G;
  const jctAftY = y;

  const ventL = IL - 7, ventR = IR + 7;

  return (
    <g>
      {/* Shuttle Dock */}
      <Room x={IL + 15} y={shuttleY} w={IR - IL - 30} h={70} label="WY-37B SHUTTLE DOCK"
        sub='"DAISY" — 34M CARGO LIFTER' fill={C.hullDeep} shape="octagon" labelSize={6} />
      <rect x={CX - 30} y={shuttleY + 10} width="60" height="42" fill="none"
        stroke={C.equipLine} strokeWidth="0.4" strokeDasharray="5 4" rx="2" opacity="0.2" />
      <Cor x={CL} y={shuttleY + 70} w={COR_W} h={G} />

      {/* Junction FWD */}
      <Cor x={CL} y={jctFwdY} w={COR_W} h={SH_SZ} />
      <ShaftRoom x={CX} y={jctFwdY + SH_SZ / 2} type="ladder" label="JUNCTION FWD" />
      <Cor x={CL} y={jctFwdY + SH_SZ} w={COR_W} h={G} />

      {/* Central corridor through alcove row */}
      <Cor x={CL} y={alcoveY} w={COR_W} h={40} />

      {/* PORT: P-5000 Loader Bay */}
      <Room x={PL} y={alcoveY} w={PW} h={40} label="P-5000" sub="LOADER BAY" labelSize={5.5} />
      <Door x={CL} y={alcoveY + 20} />
      {/* STBD: Cargo Office */}
      <Room x={SL} y={alcoveY} w={SW} h={40} label="CARGO" sub="OFFICE"
        labelSize={5.5} shape="octagon" icons={['terminal']} />
      <Door x={CR} y={alcoveY + 20} />

      {/* Top cross-corridor */}
      <Cor x={PL} y={topCorY} w={IR - PL} h={16} />

      {/* Side corridors */}
      <Cor x={sclX} y={cargoY} w={sideCorW} h={170} />
      <Cor x={scrX} y={cargoY} w={sideCorW} h={170} />

      {/* Cargo Bay */}
      <Room x={cbL} y={cargoY} w={cbR - cbL} h={170}
        label="MAIN CARGO BAY" sub="72 TRITIUM TANKS" fill={C.hullDeep} shape="octagon" labelSize={7} />
      <Door x={cbL} y={cargoY + 35} />
      <Door x={cbR} y={cargoY + 35} />
      <Door x={cbL} y={cargoY + 100} />
      <Door x={cbR} y={cargoY + 100} />
      {/* Tank hints */}
      {Array.from({ length: 4 }, (_, r) =>
        Array.from({ length: 3 }, (_, c) => (
          <g key={`t${r}${c}`}>
            <circle cx={cbL + (cbR - cbL) * (c + 1) / 4} cy={cargoY + 30 + r * 35} r="9"
              fill="none" stroke={C.equipLine} strokeWidth="0.35" opacity="0.15" />
            <circle cx={cbL + (cbR - cbL) * (c + 1) / 4} cy={cargoY + 30 + r * 35} r="3"
              fill="none" stroke={C.equipLine} strokeWidth="0.25" opacity="0.1" />
          </g>
        ))
      )}
      {/* Structural columns */}
      {[[cbL + WT + 4, cargoY + WT + 4], [cbR - WT - 4, cargoY + WT + 4],
        [cbL + WT + 4, cargoY + 170 - WT - 4], [cbR - WT - 4, cargoY + 170 - WT - 4]].map(([px, py], i) => (
        <circle key={`col${i}`} cx={px} cy={py} r="2" fill={C.wall} stroke={C.hullOutline} strokeWidth="0.3" />
      ))}

      {/* Bottom cross-corridor */}
      <Cor x={PL} y={botCorY} w={IR - PL} h={16} />
      {/* Central corridor to junction aft */}
      <Cor x={CL} y={botCorY + 16} w={COR_W} h={jctAftY + SH_SZ - botCorY - 16} />

      {/* Elevator */}
      <ShaftRoom x={PL + PW / 2} y={shaftY + SH_SZ / 2} type="elevator" label="CARGO ELEVATOR" />
      <Cor x={PL + PW / 2 + SH_SZ / 2} y={shaftY} w={CL - PL - PW / 2 - SH_SZ / 2} h={SH_SZ} />
      {/* Air Scrubber */}
      <ShaftRoom x={SL + SW / 2} y={shaftY + SH_SZ / 2} type="airscrub" label="AIR SCRUBBER" />
      <Cor x={CR} y={shaftY} w={SL + SW / 2 - SH_SZ / 2 - CR} h={SH_SZ} />

      {/* Ventral Access */}
      <Room x={IL + 15} y={ventralY} w={IR - IL - 30} h={44} label="VENTRAL ACCESS"
        sub="CARGO LOADING RAMP" fill={C.hullDeep} rx={14} />
      <Door x={CX} y={ventralY} v={false} />
      <line x1={CX - 40} y1={ventralY + 38} x2={CX + 40} y2={ventralY + 38}
        stroke={C.hullOutline} strokeWidth="0.8" strokeDasharray="5 3" opacity="0.35" />

      {/* Junction AFT */}
      <ShaftRoom x={CX} y={jctAftY + SH_SZ / 2} type="ladder" label="JUNCTION AFT" />

      <Vents paths={[
        `M ${ventL} ${shuttleY} L ${ventL} ${jctAftY + SH_SZ}`,
        `M ${ventR} ${shuttleY} L ${ventR} ${jctAftY + SH_SZ}`,
        `M ${ventL} ${shuttleY} L ${ventR} ${shuttleY}`,
        `M ${ventL} ${jctAftY + SH_SZ} L ${ventR} ${jctAftY + SH_SZ}`,
        `M ${sclX - 4} ${cargoY} L ${sclX - 4} ${cargoY + 170}`,
        `M ${scrX + sideCorW + 4} ${cargoY} L ${scrX + sideCorW + 4} ${cargoY + 170}`,
      ]} grates={[
        [ventL, shuttleY], [ventR, shuttleY],
        [ventL, jctAftY + SH_SZ], [ventR, jctAftY + SH_SZ],
        [ventL, (shuttleY + jctAftY + SH_SZ) / 2], [ventR, (shuttleY + jctAftY + SH_SZ) / 2],
      ]} />
    </g>
  );
}


/* ═══════════════════════════════════════════════════════════════════════
   CONFIG — Hull background, overlays, exterior, sidebar
   ═══════════════════════════════════════════════════════════════════════ */

function hullBackground(C) {
  return (
    <g>
      {/* Nacelles */}
      <path d={NAC_L} fill={purl('nacGrad')} stroke={C.hullOutline} strokeWidth="0.7" />
      <path d={NAC_R} fill={purl('nacGrad')} stroke={C.hullOutline} strokeWidth="0.7" />
      <path d={NOZ_L} fill={purl('nozGrad')} stroke={C.hullDark} strokeWidth="0.5" />
      <path d={NOZ_R} fill={purl('nozGrad')} stroke={C.hullDark} strokeWidth="0.5" />
      {/* Engine pod labels */}
      <text x={HL - 22} y={HB - 100} fill={C.textFaint} fontSize="5.5" textAnchor="middle"
        transform={`rotate(-90,${HL - 22},${HB - 100})`} letterSpacing="0.06em">ENGINE POD 1</text>
      <text x={HR + 22} y={HB - 100} fill={C.textFaint} fontSize="5.5" textAnchor="middle"
        transform={`rotate(90,${HR + 22},${HB - 100})`} letterSpacing="0.06em">ENGINE POD 2</text>
      {/* Engine ribs */}
      {[HL, HR].map((nx, ni) => (
        <g key={ni} opacity="0.35">{[0, 22, 44, 66, 88].map(dy => (
          <line key={dy} x1={nx + (ni === 0 ? -5 : 5)} y1={HB - 140 + dy}
            x2={nx + (ni === 0 ? -36 : 36)} y2={HB - 140 + dy}
            stroke={C.divider} strokeWidth="0.4" />
        ))}</g>
      ))}
    </g>
  );
}

function hullOverlays(C) {
  return (
    <g>
      {/* Horizontal seam lines */}
      <g opacity="0.18">
        {[155, 230, 310, 400, 480, 560, 640, 720].map(yy => (
          <line key={yy} x1={HL - 5} y1={HT + yy - 60} x2={HR + 5} y2={HT + yy - 60}
            stroke={C.hullOutline} strokeWidth="0.5" strokeDasharray="2 10" />
        ))}
      </g>
      {/* Longitudinal spines */}
      <g opacity="0.12">
        <line x1={HL + 30} y1={HT + 120} x2={HL + 30} y2={HB - 20} stroke={C.hullOutline} strokeWidth="0.6" />
        <line x1={HR - 30} y1={HT + 120} x2={HR - 30} y2={HB - 20} stroke={C.hullOutline} strokeWidth="0.6" />
        <line x1={CX} y1={HT + 5} x2={CX} y2={HT + 70} stroke={C.hullOutline} strokeWidth="0.5" />
      </g>
    </g>
  );
}

function exteriorDetails(C) {
  return (
    <g opacity="0.55">
      {/* Forward sensor array */}
      <line x1={CX} y1={HT - 2} x2={CX} y2={HT - 16} stroke={C.hullOutline} strokeWidth="0.7" />
      <circle cx={CX} cy={HT - 18} r="3" fill="none" stroke={C.hullOutline} strokeWidth="0.5" />
      <circle cx={CX} cy={HT - 18} r="1" fill={C.hullOutline} />
      <text x={CX + 8} y={HT - 14} fill={C.textFaint} fontSize="4" letterSpacing="0.04em">SENSOR ARRAY</text>

      {/* Port antenna */}
      <line x1={HL + 10} y1={HT + 200} x2={HL - 12} y2={HT + 180} stroke={C.hullOutline} strokeWidth="0.5" />
      <line x1={HL - 12} y1={HT + 180} x2={HL - 20} y2={HT + 175} stroke={C.hullOutline} strokeWidth="0.4" />
      <circle cx={HL - 20} cy={HT + 175} r="2" fill="none" stroke={C.hullOutline} strokeWidth="0.4" />
      {/* Starboard antenna */}
      <line x1={HR - 10} y1={HT + 200} x2={HR + 12} y2={HT + 180} stroke={C.hullOutline} strokeWidth="0.5" />
      <line x1={HR + 12} y1={HT + 180} x2={HR + 20} y2={HT + 175} stroke={C.hullOutline} strokeWidth="0.4" />
      <circle cx={HR + 20} cy={HT + 175} r="2" fill="none" stroke={C.hullOutline} strokeWidth="0.4" />

      {/* RCS thrusters */}
      {[[HL + 6, HT + 280, -1], [HR - 6, HT + 280, 1], [HL + 6, HB - 140, -1], [HR - 6, HB - 140, 1]].map(([tx, ty, dir], i) => (
        <g key={i}>
          <rect x={tx + (dir < 0 ? -6 : 0)} y={ty - 2} width="6" height="4"
            fill="none" stroke={C.hullOutline} strokeWidth="0.4" rx="0.5" />
          <text x={tx + dir * 12} y={ty + 2} fill={C.textFaint} fontSize="3" textAnchor="middle">RCS</text>
        </g>
      ))}

      {/* Comms tower */}
      <line x1={HR - 20} y1={HT + 130} x2={HR + 5} y2={HT + 110} stroke={C.hullOutline} strokeWidth="0.5" />
      <rect x={HR + 3} y={HT + 104} width="8" height="12" fill="none" stroke={C.hullOutline} strokeWidth="0.4" rx="1" />
      <text x={HR + 18} y={HT + 112} fill={C.textFaint} fontSize="3.5">COMMS</text>
    </g>
  );
}

function monteroSidebar(C) {
  return (
    <g>
      <text x="32" y="42" fill={C.textDim} fontSize="7.5" letterSpacing="0.25em"
        fontFamily="'Orbitron',sans-serif" opacity="0.7">S C E N A R I O</text>
      <g transform="translate(90,130)" opacity="0.7">
        <circle r="16" fill="none" stroke={C.textDim} strokeWidth="0.8" />
        <text y="4.5" fill={C.textDim} fontSize="10" textAnchor="middle"
          fontFamily="'Orbitron',sans-serif" fontWeight="bold">W</text>
      </g>
      <text x="82" y="560" fill={C.textBright} fontSize="24" fontWeight="bold" letterSpacing="0.18em"
        transform="rotate(-90,82,560)" fontFamily="'Orbitron',sans-serif">USCSS MONTERO</text>
      <text x="108" y="530" fill={C.textDim} fontSize="8.5" letterSpacing="0.08em"
        transform="rotate(-90,108,530)">COMMERCIAL TOWING VEHICLE</text>
      <g transform="translate(65,700)">
        <rect width="11" height="11" fill="none" stroke={C.textDim} strokeWidth="0.5" />
        <text x="18" y="9" fill={C.textDim} fontSize="7">2x2 METERS</text>
      </g>
      <rect x="55" y="100" width="120" height="630" rx="3" fill="none" stroke={C.frame} strokeWidth="0.4" />
    </g>
  );
}

function monteroFixedOverlays(C) {
  return (
    <g>
      {/* Aft docking airlock (visible on all decks) */}
      <rect x={CX - 16} y={HB - 20} width="32" height="14"
        fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.7" rx="2" />
      <text x={CX} y={HB - 2} fill={C.textDim} fontSize="4.5" textAnchor="middle">DOCKING AIRLOCK</text>
    </g>
  );
}


/* ═══════════════════════════════════════════════════════════════════════
   EXPORTED CONFIG
   ═══════════════════════════════════════════════════════════════════════ */

export const monteroConfig = {
  width: W,
  height: H,
  stars: { count: 200, seed: 1979 },
  scenarioTag: 'CHARIOT OF THE GODS',
  hull: {
    path: HULL,
    background: hullBackground,
    overlays: hullOverlays,
  },
  exteriorDetails,
  sidebar: monteroSidebar,
  decks: [
    { id: 'A', name: 'PERSONNEL DECK', page: '122', component: MonteroDeckA },
    { id: 'B', name: 'OPERATIONS DECK', page: '123', component: MonteroDeckB },
    { id: 'C', name: 'CARGO DECK', page: '124', component: MonteroDeckC },
  ],
  fixedOverlays: monteroFixedOverlays,
  specs: {
    title: 'TECHNICAL SPECIFICATIONS',
    items: [
      ['LENGTH', '334 METRES'],
      ['CLASS', 'Lockmart CM-88G Bison-Class'],
      ['ENGINES', 'Saturn J 3000'],
      ['COMPUTER', 'MU/TH/UR 6500'],
      ['CREW', '5'],
    ],
  },
  legend: 'default',
};
