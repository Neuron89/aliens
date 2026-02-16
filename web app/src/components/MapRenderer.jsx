import React, { useMemo, useState } from 'react';

function sr(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

const C = {
  bg: '#060810', bgMid: '#0a0e16',
  frame: '#162828', frameBright: '#1e3e3e',
  hull: '#2a7a68', hullBright: '#35907a', hullMid: '#22685a',
  hullDark: '#194a40', hullDeep: '#103830', hullOutline: '#40a890',
  divider: '#1e6050', door: '#50b898',
  equipLine: '#306858',
  vent: '#2a8070', shaft: '#50b898',
  text: '#88bca8', textBright: '#a8dcc8', textDim: '#406858', textFaint: '#2a4a40',
  accent: '#50c8a8', grid: '#1a4a3e', restricted: '#c04040',
};

const W = 1100, H = 920;
const CX = 600;
const HT = 75, HB = 845;
const HL = CX - 178, HR = CX + 178;

/* ── Hull (shared all decks) ─────────────────────────── */
const HULL = `M ${CX} ${HT} C ${CX-10} ${HT},${CX-50} ${HT+22},${CX-68} ${HT+45}
  L ${CX-88} ${HT+72} L ${CX-105} ${HT+105} L ${HL+32} ${HT+145}
  L ${HL+16} ${HT+190} L ${HL+6} ${HT+240} L ${HL} ${HT+310} L ${HL} ${HB-120}
  L ${HL+8} ${HB-70} L ${HL+22} ${HB-38} L ${HL+50} ${HB-12} L ${HL+82} ${HB}
  L ${HR-82} ${HB} L ${HR-50} ${HB-12} L ${HR-22} ${HB-38}
  L ${HR-8} ${HB-70} L ${HR} ${HB-120} L ${HR} ${HT+310}
  L ${HR-6} ${HT+240} L ${HR-16} ${HT+190} L ${HR-32} ${HT+145}
  L ${CX+105} ${HT+105} L ${CX+88} ${HT+72} L ${CX+68} ${HT+45}
  C ${CX+50} ${HT+22},${CX+10} ${HT},${CX} ${HT} Z`;
const NAC_L = `M ${HL-2} ${HB-195} L ${HL-30} ${HB-170} L ${HL-40} ${HB-145} L ${HL-42} ${HB-55} L ${HL-32} ${HB-22} L ${HL-15} ${HB-8} L ${HL} ${HB-5} L ${HL} ${HB-195} Z`;
const NAC_R = `M ${HR+2} ${HB-195} L ${HR+30} ${HB-170} L ${HR+40} ${HB-145} L ${HR+42} ${HB-55} L ${HR+32} ${HB-22} L ${HR+15} ${HB-8} L ${HR} ${HB-5} L ${HR} ${HB-195} Z`;
const NOZ_L = `M ${HL-40} ${HB-18} L ${HL-52} ${HB+8} L ${HL-12} ${HB+8} L ${HL-18} ${HB-18} Z`;
const NOZ_R = `M ${HR+40} ${HB-18} L ${HR+52} ${HB+8} L ${HR+12} ${HB+8} L ${HR+18} ${HB-18} Z`;

/* ── Inner layout constants (room cluster is smaller than hull) */
const IL = CX - 128;  /* inner left - rooms start here */
const IR = CX + 128;  /* inner right */
const COR = 22;       /* corridor width */
const CL = CX - COR / 2; /* corridor left edge */
const CR = CX + COR / 2; /* corridor right edge */
const GAP = 4;        /* gap between rooms and corridor */
const PL = IL;        /* port rooms left edge */
const PW = CL - GAP - PL; /* port room width */
const SL = CR + GAP;  /* starboard rooms left edge */
const SW = IR - SL;   /* starboard room width */
const SH_SZ = 26;     /* shaft room size */

/* ── Shared shaft X positions (aligned across decks) ──── */
const SHAFT_X = {
  jctFwd: CX,
  jctAft: CX,
  airScrub: CR + GAP + SW / 2,
  elevator: PL + PW / 2,
};

/* ── Helpers ──────────────────────────────────────────── */
function Room({ x, y, w, h, label, sub, fill, pattern, rx = 1, icons = [], labelSize = 6.5, shape = 'rect' }) {
  const cx = x + w / 2, cy = y + h / 2;
  const chm = Math.min(w, h) * 0.25;

  const octPts = [
    [x + chm, y], [x + w - chm, y],
    [x + w, y + chm], [x + w, y + h - chm],
    [x + w - chm, y + h], [x + chm, y + h],
    [x, y + h - chm], [x, y + chm],
  ].map(p => p.join(',')).join(' ');

  const outline = shape === 'octagon'
    ? <polygon points={octPts} fill={fill || C.hullDark} stroke={C.divider} strokeWidth="1.8" />
    : shape === 'circle'
      ? <ellipse cx={cx} cy={cy} rx={w / 2} ry={h / 2} fill={fill || C.hullDark} stroke={C.divider} strokeWidth="1.8" />
      : <rect x={x} y={y} width={w} height={h} fill={fill || C.hullDark} stroke={C.divider} strokeWidth="1.8" rx={rx} />;

  const patFill = pattern && (
    shape === 'octagon'
      ? <polygon points={octPts} fill={`url(#${pattern})`} />
      : shape === 'circle'
        ? <ellipse cx={cx} cy={cy} rx={w / 2} ry={h / 2} fill={`url(#${pattern})`} />
        : <rect x={x} y={y} width={w} height={h} fill={`url(#${pattern})`} rx={rx} />
  );

  return (
    <g>
      {outline}
      {patFill}
      {label && (
        <text x={cx} y={cy + (sub ? -1 : 2.5)} fill={C.text}
          fontSize={labelSize} textAnchor="middle" letterSpacing="0.06em">{label}</text>
      )}
      {sub && (
        <text x={cx} y={cy + 8} fill={C.textDim}
          fontSize="5" textAnchor="middle" letterSpacing="0.04em">{sub}</text>
      )}
      {icons.map((icon, i) => {
        const ix = x + w - 9 - i * 11;
        const iy = y + 7;
        if (icon === 'medkit') return (
          <g key={i} opacity="0.45">
            <rect x={ix - 3} y={iy - 0.8} width="6" height="1.6" fill={C.accent} rx="0.3" />
            <rect x={ix - 0.8} y={iy - 3} width="1.6" height="6" fill={C.accent} rx="0.3" />
          </g>
        );
        if (icon === 'terminal') return (
          <rect key={i} x={ix - 3} y={iy - 3} width="6" height="6" fill="none"
            stroke={C.accent} strokeWidth="0.5" rx="0.5" opacity="0.4" />
        );
        if (icon === 'intercom') return (
          <rect key={i} x={ix - 2} y={iy - 2} width="4" height="4"
            fill={C.accent} rx="0.5" opacity="0.35" />
        );
        if (icon === 'restricted') return (
          <circle key={i} cx={ix} cy={iy} r="3" fill="none"
            stroke={C.restricted} strokeWidth="0.6" opacity="0.55" />
        );
        if (icon === 'weapon') return (
          <g key={i} opacity="0.4">
            <line x1={ix - 3} y1={iy} x2={ix + 3} y2={iy} stroke={C.accent} strokeWidth="0.8" />
            <line x1={ix + 1} y1={iy - 2} x2={ix + 1} y2={iy + 2} stroke={C.accent} strokeWidth="0.6" />
          </g>
        );
        if (icon === 'cryopod') return (
          <rect key={i} x={ix - 2.5} y={iy - 3.5} width="5" height="7" fill="none"
            stroke={C.accent} strokeWidth="0.5" rx="2" opacity="0.4" />
        );
        return null;
      })}
    </g>
  );
}

function Door({ x, y, v = true }) {
  return v
    ? <rect x={x - 1.5} y={y - 7} width="3" height="14" fill={C.door} opacity="0.5" rx="0.5" />
    : <rect x={x - 7} y={y - 1.5} width="14" height="3" fill={C.door} opacity="0.5" rx="0.5" />;
}

function ShaftRoom({ x, y, type = 'ladder', label, size = SH_SZ }) {
  const s = size;
  return (
    <g>
      <rect x={x - s / 2} y={y - s / 2} width={s} height={s}
        fill={C.hullDeep} stroke={C.shaft} strokeWidth="1.2" rx={type === 'airscrub' ? s / 2 : 2} />
      {type === 'ladder' && (
        <>
          {[-5, -1.5, 2, 5.5].map(dy => (
            <line key={dy} x1={x - 4} y1={y + dy} x2={x + 4} y2={y + dy}
              stroke={C.shaft} strokeWidth="0.6" opacity="0.5" />
          ))}
          <line x1={x - 4} y1={y - 7} x2={x - 4} y2={y + 7} stroke={C.shaft} strokeWidth="0.4" opacity="0.35" />
          <line x1={x + 4} y1={y - 7} x2={x + 4} y2={y + 7} stroke={C.shaft} strokeWidth="0.4" opacity="0.35" />
        </>
      )}
      {type === 'elevator' && (
        <>
          <rect x={x - s / 2 + 3} y={y - s / 2 + 3} width={s - 6} height={s - 6}
            fill="none" stroke={C.shaft} strokeWidth="0.5" strokeDasharray="2 2" rx="1" />
          <line x1={x - 3} y1={y - 3} x2={x + 3} y2={y + 3} stroke={C.shaft} strokeWidth="0.5" />
          <line x1={x + 3} y1={y - 3} x2={x - 3} y2={y + 3} stroke={C.shaft} strokeWidth="0.5" />
        </>
      )}
      {type === 'airscrub' && (
        <circle cx={x} cy={y} r={s / 2 - 4} fill="none"
          stroke={C.shaft} strokeWidth="0.5" strokeDasharray="2 2" />
      )}
      <text x={x} y={y + s / 2 + 9} fill={C.textDim} fontSize="4.5"
        textAnchor="middle" letterSpacing="0.04em">{label}</text>
    </g>
  );
}

/* Corridor segment */
function Cor({ x, y, w, h }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={C.hullDeep} stroke={C.divider} strokeWidth="0.8" />
      <rect x={x} y={y} width={w} height={h} fill="url(#grating)" />
    </g>
  );
}

/* Vent path (dotted line along room edges) */
function Vents({ paths }) {
  return (
    <g opacity="0.3">
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={C.vent} strokeWidth="1.2" strokeDasharray="3 5" />
      ))}
    </g>
  );
}

/* ══════════════════════════════════════════════════════════ */
/* ── DECK A — PERSONNEL DECK ─────────────────────────── */
/* ══════════════════════════════════════════════════════════ */
function DeckA() {
  const RH = 44; /* standard room height */
  const G = 5;   /* gap between rooms */
  let y = HT + 90;

  /* Row positions */
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

  const ventL = IL - 7;
  const ventR = IR + 7;

  return (
    <g>
      {/* Bridge (centered, forward — octagon) */}
      <Room x={CX - 60} y={bridgeY} w={120} h={55} label="BRIDGE" shape="octagon"
        icons={['terminal', 'intercom']} />
      {[-35, -17, 0, 17, 35].map(dx => (
        <rect key={dx} x={CX + dx - 4} y={bridgeY - 2} width="8" height="4"
          fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.3" rx="1" opacity="0.45" />
      ))}
      {/* Corridor from bridge to hyper */}
      <Cor x={CL} y={bridgeY + 55} w={COR} h={G} />

      {/* Hyperdrive Machinery (full width) */}
      <Room x={IL + 10} y={hyperY} w={IR - IL - 20} h={42} label="HYPERDRIVE MACHINERY SPACE"
        fill={C.hullDeep} pattern="hatch" labelSize={5.5} />
      <Door x={CX} y={hyperY} v={false} />
      <Cor x={CL} y={hyperY + 42} w={COR} h={G} />

      {/* Cryo (full width — rounded capsule) */}
      <Room x={IL + 5} y={cryoY} w={IR - IL - 10} h={RH} label="CRYO CHAMBER"
        sub="5 PODS" icons={['cryopod', 'medkit']} rx={18} />
      <Door x={CX} y={cryoY} v={false} />
      <Cor x={CL} y={cryoY + RH} w={COR} h={G} />

      {/* Junction FWD (own room on corridor) */}
      <Cor x={CL} y={jctFwdY} w={COR} h={SH_SZ} />
      <ShaftRoom x={CX} y={jctFwdY + SH_SZ / 2} type="ladder" label="JUNCTION FWD" />
      <Cor x={CL} y={jctFwdY + SH_SZ} w={COR} h={G} />

      {/* Main corridor spine through the middle section */}
      <Cor x={CL} y={tankY} w={COR} h={jctAftY - tankY + SH_SZ} />

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

      {/* Elevator shaft (port side, own room) */}
      <ShaftRoom x={PL + PW / 2} y={elevY + SH_SZ / 2} type="elevator" label="CARGO ELEVATOR" />
      <Door x={CL} y={elevY + SH_SZ / 2} />
      {/* Air Scrubber shaft (stbd side, own room) */}
      <ShaftRoom x={SL + SW / 2} y={airY + SH_SZ / 2} type="airscrub" label="AIR SCRUBBER" />
      <Door x={CR} y={airY + SH_SZ / 2} />

      {/* PORT: Galley (square-ish) */}
      <Room x={PL} y={galleyY} w={PW} h={RH} label="GALLEY" icons={['intercom']} rx={6} />
      <Door x={CL} y={galleyY + RH / 2} />
      {/* STBD: Medlab (octagon) */}
      <Room x={SL} y={medlabY} w={SW} h={RH} label="MEDLAB" shape="octagon"
        icons={['medkit', 'terminal']} />
      <Door x={CR} y={medlabY + RH / 2} />

      {/* PORT: Hygiene & Lockers */}
      <Room x={PL} y={hygieneY} w={PW} h={RH} label="HYGIENE" sub="& LOCKERS" labelSize={5.5} />
      <Door x={CL} y={hygieneY + RH / 2} />
      {/* STBD: Storage */}
      <Room x={SL} y={storageY} w={SW} h={RH} label="STORAGE" fill={C.hullDeep} />
      <Door x={CR} y={storageY + RH / 2} />

      {/* PORT: MU/TH/UR (octagon — important room) */}
      <Room x={PL} y={muthurY} w={PW} h={RH} label="MU/TH/UR" sub="6500" shape="octagon"
        icons={['restricted', 'terminal']} />
      <Door x={CL} y={muthurY + RH / 2} />
      {/* STBD: Supplies */}
      <Room x={SL} y={muthurY} w={SW} h={RH} label="SUPPLIES" fill={C.hullDeep} rx={4} />
      <Door x={CR} y={muthurY + RH / 2} />

      {/* Junction AFT (own room on corridor) */}
      <ShaftRoom x={CX} y={jctAftY + SH_SZ / 2} type="ladder" label="JUNCTION AFT" />

      {/* Vent lines — trace along the outskirts of the room cluster */}
      <Vents paths={[
        `M ${ventL} ${hyperY} L ${ventL} ${jctAftY + SH_SZ}`,
        `M ${ventR} ${hyperY} L ${ventR} ${jctAftY + SH_SZ}`,
        `M ${ventL} ${hyperY} L ${ventR} ${hyperY}`,
        `M ${ventL} ${jctAftY + SH_SZ} L ${ventR} ${jctAftY + SH_SZ}`,
        `M ${PL - 4} ${tankY} L ${PL - 4} ${muthurY + RH}`,
        `M ${IR + 4} ${tankY} L ${IR + 4} ${muthurY + RH}`,
      ]} />
    </g>
  );
}

/* ══════════════════════════════════════════════════════════ */
/* ── DECK B — OPERATIONS DECK ─────────────────────────── */
/* ══════════════════════════════════════════════════════════ */
function DeckB() {
  const RH = 44;
  const G = 5;
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

  const ventL = IL - 7;
  const ventR = IR + 7;

  return (
    <g>
      {/* Nav Systems (forward — octagon) */}
      <Room x={CX - 55} y={navY} w={110} h={50} label="NAVIGATION" sub="SYSTEMS"
        fill={C.hullDeep} pattern="hatch" shape="octagon" icons={['terminal']} />
      <Cor x={CL} y={navY + 50} w={COR} h={G} />

      {/* Life Support (rounded) */}
      <Room x={IL + 10} y={lifeSupY} w={IR - IL - 20} h={42} label="LIFE SUPPORT CONTROL"
        icons={['terminal', 'intercom']} rx={10} />
      <Door x={CX} y={lifeSupY} v={false} />
      <Cor x={CL} y={lifeSupY + 42} w={COR} h={G} />

      {/* PORT: Docking Umbilical */}
      <Room x={PL} y={dockY} w={PW} h={RH} label="DOCKING" sub="UMBILICAL" labelSize={5.5} />
      {/* STBD: Main Airlock (octagon) */}
      <Room x={SL} y={dockY} w={SW} h={RH} label="MAIN AIRLOCK" labelSize={5.5} shape="octagon" />
      <Cor x={CL} y={dockY} w={COR} h={RH} />
      <Door x={CL} y={dockY + RH / 2} />
      <Door x={CR} y={dockY + RH / 2} />
      <Cor x={CL} y={dockY + RH} w={COR} h={G} />

      {/* Junction FWD */}
      <Cor x={CL} y={jctFwdY} w={COR} h={SH_SZ} />
      <ShaftRoom x={CX} y={jctFwdY + SH_SZ / 2} type="ladder" label="JUNCTION FWD" />
      <Cor x={CL} y={jctFwdY + SH_SZ} w={COR} h={G} />

      {/* Main corridor */}
      <Cor x={CL} y={waterY} w={COR} h={jctAftY - waterY + SH_SZ} />

      {/* Cross-corridor at midpoint */}
      <Cor x={PL} y={elevY} w={IR - PL} h={SH_SZ} />

      {/* PORT: Water Reclamation */}
      <Room x={PL} y={waterY} w={PW} h={RH} label="WATER" sub="RECLAMATION" labelSize={5.5} />
      <Door x={CL} y={waterY + RH / 2} />
      {/* STBD: Workshop (rounded corners) */}
      <Room x={SL} y={waterY} w={SW} h={RH} label="WORKSHOP" sub="ENGINEERING" labelSize={5.5}
        icons={['terminal']} rx={8} />
      <Door x={CR} y={waterY + RH / 2} />

      {/* PORT: Lower Claw */}
      <Room x={PL} y={clawY} w={PW} h={RH} label="LOWER CLAW" sub="MECHANISM"
        fill={C.hullDeep} pattern="hatch" labelSize={5.5} />
      <Door x={CL} y={clawY + RH / 2} />
      {/* STBD: Maintenance (rounded) */}
      <Room x={SL} y={clawY} w={SW} h={RH} label="MAINTENANCE" sub="BAY" labelSize={5.5}
        icons={['intercom']} rx={8} />
      <Door x={CR} y={clawY + RH / 2} />

      {/* Elevator (port side, own room) */}
      <ShaftRoom x={PL + PW / 2} y={elevY + SH_SZ / 2} type="elevator" label="CARGO ELEVATOR" />
      {/* Air Scrubber (stbd side, own room) */}
      <ShaftRoom x={SL + SW / 2} y={airY + SH_SZ / 2} type="airscrub" label="AIR SCRUBBER" />

      {/* Reactor Room (wider, centered — circle) */}
      <Room x={IL + 5} y={reactorY} w={IR - IL - 10} h={70} label="REACTOR ROOM"
        fill={C.hullDeep} shape="circle" icons={['terminal']} />
      <Door x={CX} y={reactorY} v={false} />
      <circle cx={CX} cy={reactorY + 35} r="14" fill="none"
        stroke={C.equipLine} strokeWidth="0.5" strokeDasharray="3 3" opacity="0.25" />

      {/* PORT: Coolant */}
      <Room x={PL} y={coolantY} w={PW} h={RH} label="COOLANT" sub="SYSTEMS"
        fill={C.hullDeep} pattern="hatch" labelSize={5.5} />
      <Door x={CL} y={coolantY + RH / 2} />
      {/* STBD: Reactor Control (octagon) */}
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
      ]} />
    </g>
  );
}

/* ══════════════════════════════════════════════════════════ */
/* ── DECK C — CARGO DECK ─────────────────────────────── */
/* ══════════════════════════════════════════════════════════ */
function DeckC() {
  const G = 5;
  const sideCorW = 18;

  /* X zones for the cargo section — side corridors flank the cargo bay */
  const sclX = PL;                           /* left side corridor X */
  const cbL  = PL + sideCorW + GAP;          /* cargo bay left edge */
  const cbR  = IR - sideCorW - GAP;          /* cargo bay right edge */
  const scrX = IR - sideCorW;                /* right side corridor X */

  /* Row-by-row Y positions — every row is exclusive, no overlap */
  let y = HT + 95;
  const shuttleY = y; y += 70 + G;           /* shuttle dock */
  const jctFwdY = y;  y += SH_SZ + G;        /* junction fwd */
  const alcoveY = y;  y += 40 + G;           /* P-5000 & Cargo Office row */
  const topCorY = y;  y += 16 + G;           /* top cross-corridor */
  const cargoY = y;   y += 170 + G;          /* cargo bay + side corridors */
  const botCorY = y;  y += 16 + G;           /* bottom cross-corridor */
  const shaftY = y;   y += SH_SZ + G;        /* elevator & air scrubber row */
  const ventralY = y; y += 44 + G;           /* ventral access */
  const jctAftY = y;                          /* junction aft */

  const ventL = IL - 7;
  const ventR = IR + 7;

  return (
    <g>
      {/* Shuttle Dock (octagon) */}
      <Room x={IL + 15} y={shuttleY} w={IR - IL - 30} h={70} label="WY-37B SHUTTLE DOCK"
        sub='"DAISY" — 34M CARGO LIFTER' fill={C.hullDeep} shape="octagon" labelSize={6} />
      <rect x={CX - 30} y={shuttleY + 10} width="60" height="42" fill="none"
        stroke={C.equipLine} strokeWidth="0.4" strokeDasharray="5 4" rx="2" opacity="0.2" />
      <Cor x={CL} y={shuttleY + 70} w={COR} h={G} />

      {/* Junction FWD */}
      <Cor x={CL} y={jctFwdY} w={COR} h={SH_SZ} />
      <ShaftRoom x={CX} y={jctFwdY + SH_SZ / 2} type="ladder" label="JUNCTION FWD" />
      <Cor x={CL} y={jctFwdY + SH_SZ} w={COR} h={G} />

      {/* Central corridor through alcove row */}
      <Cor x={CL} y={alcoveY} w={COR} h={40} />

      {/* PORT: P-5000 Loader Bay */}
      <Room x={PL} y={alcoveY} w={PW} h={40} label="P-5000" sub="LOADER BAY" labelSize={5.5} />
      <Door x={CL} y={alcoveY + 20} />
      {/* STBD: Cargo Office (octagon) */}
      <Room x={SL} y={alcoveY} w={SW} h={40} label="CARGO" sub="OFFICE"
        labelSize={5.5} shape="octagon" icons={['terminal']} />
      <Door x={CR} y={alcoveY + 20} />

      {/* Top cross-corridor (full inner width) */}
      <Cor x={PL} y={topCorY} w={IR - PL} h={16} />

      {/* Left side corridor (top of cargo to bottom of cargo) */}
      <Cor x={sclX} y={cargoY} w={sideCorW} h={170} />
      {/* Right side corridor */}
      <Cor x={scrX} y={cargoY} w={sideCorW} h={170} />

      {/* CARGO BAY (between side corridors — octagon) */}
      <Room x={cbL} y={cargoY} w={cbR - cbL} h={170}
        label="MAIN CARGO BAY" sub="72 TRITIUM TANKS" fill={C.hullDeep} shape="octagon" labelSize={7} />
      <Door x={cbL} y={cargoY + 35} />
      <Door x={cbR} y={cargoY + 35} />
      <Door x={cbL} y={cargoY + 100} />
      <Door x={cbR} y={cargoY + 100} />
      {/* Tank hints */}
      {Array.from({ length: 3 }, (_, r) =>
        Array.from({ length: 3 }, (_, c) => (
          <circle key={`${r}${c}`} cx={cbL + (cbR - cbL) * (c + 1) / 4}
            cy={cargoY + 40 + r * 40} r="8"
            fill="none" stroke={C.equipLine} strokeWidth="0.25" opacity="0.12" />
        ))
      )}

      {/* Bottom cross-corridor (full inner width) */}
      <Cor x={PL} y={botCorY} w={IR - PL} h={16} />

      {/* Central corridor from bottom corridor to junction aft */}
      <Cor x={CL} y={botCorY + 16} w={COR} h={jctAftY + SH_SZ - botCorY - 16} />

      {/* PORT: Elevator (own room, own row) */}
      <ShaftRoom x={PL + PW / 2} y={shaftY + SH_SZ / 2} type="elevator" label="CARGO ELEVATOR" />
      {/* Short corridor stub connecting elevator to central corridor */}
      <Cor x={PL + PW / 2 + SH_SZ / 2} y={shaftY} w={CL - PL - PW / 2 - SH_SZ / 2} h={SH_SZ} />

      {/* STBD: Air Scrubber (own room, own row) */}
      <ShaftRoom x={SL + SW / 2} y={shaftY + SH_SZ / 2} type="airscrub" label="AIR SCRUBBER" />
      {/* Short corridor stub connecting air scrubber to central corridor */}
      <Cor x={CR} y={shaftY} w={SL + SW / 2 - SH_SZ / 2 - CR} h={SH_SZ} />

      {/* Ventral Access (rounded) */}
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
      ]} />
    </g>
  );
}

/* ══════════════════════════════════════════════════════════ */
/* ── MAIN ─────────────────────────────────────────────── */
/* ══════════════════════════════════════════════════════════ */
const DI = {
  A: { name: 'PERSONNEL DECK', page: '122' },
  B: { name: 'OPERATIONS DECK', page: '123' },
  C: { name: 'CARGO DECK', page: '124' },
};

export default function MapRenderer() {
  const [dk, setDk] = useState('A');
  const stars = useMemo(() => {
    const r = sr(1979);
    return Array.from({ length: 200 }, () => ({
      x: r() * W, y: r() * H, r: 0.2 + r() * 1.0, o: 0.04 + r() * 0.18,
    }));
  }, []);
  const info = DI[dk];

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.75rem' }}>
        {Object.entries(DI).map(([k, v]) => (
          <button key={k} style={{
            fontFamily: "'Share Tech Mono', monospace", fontSize: '0.8rem',
            background: dk === k ? 'rgba(0,212,170,0.12)' : 'var(--bg-card)',
            border: `1px solid ${dk === k ? 'var(--accent)' : 'var(--border)'}`,
            color: dk === k ? 'var(--accent)' : 'var(--text-dim)',
            padding: '0.4rem 0.8rem', cursor: 'pointer', borderRadius: '2px',
            letterSpacing: '0.08em',
          }} onClick={() => setDk(k)}>DECK {k} — {v.name}</button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}
        xmlns="http://www.w3.org/2000/svg" fontFamily="'Share Tech Mono','Courier New',monospace">
        <defs>
          <radialGradient id="bgGrad" cx="55%" cy="45%" r="65%">
            <stop offset="0%" stopColor={C.bgMid} /><stop offset="100%" stopColor={C.bg} />
          </radialGradient>
          <linearGradient id="hullGrad" x1="30%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%" stopColor={C.hullBright} /><stop offset="35%" stopColor={C.hull} />
            <stop offset="65%" stopColor={C.hullMid} /><stop offset="100%" stopColor={C.hullDark} />
          </linearGradient>
          <linearGradient id="nacGrad" x1="0%" y1="0%" x2="100%" y2="80%">
            <stop offset="0%" stopColor={C.hullMid} /><stop offset="100%" stopColor={C.hullDeep} />
          </linearGradient>
          <linearGradient id="nozGrad" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor={C.hullDeep} /><stop offset="100%" stopColor="#0a2018" />
          </linearGradient>
          <pattern id="plate" width="20" height="20" patternUnits="userSpaceOnUse">
            <line x1="0" y1="20" x2="20" y2="20" stroke={C.grid} strokeWidth="0.2" opacity="0.3" />
            <line x1="20" y1="0" x2="20" y2="20" stroke={C.grid} strokeWidth="0.2" opacity="0.3" />
          </pattern>
          <pattern id="grating" width="6" height="6" patternUnits="userSpaceOnUse">
            <line x1="0" y1="3" x2="6" y2="3" stroke={C.equipLine} strokeWidth="0.3" opacity="0.3" />
            <line x1="3" y1="0" x2="3" y2="6" stroke={C.equipLine} strokeWidth="0.3" opacity="0.3" />
          </pattern>
          <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke={C.equipLine} strokeWidth="0.4" opacity="0.2" />
          </pattern>
          <clipPath id="hullClip"><path d={HULL} /></clipPath>
        </defs>

        <rect width={W} height={H} fill="url(#bgGrad)" />
        {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#c8d8e8" opacity={s.o} />)}

        {/* Frame */}
        <rect x="16" y="16" width={W - 32} height={H - 32} rx="10" fill="none" stroke={C.frame} strokeWidth="1.2" />
        <rect x="19" y="19" width={W - 38} height={H - 38} rx="8" fill="none" stroke={C.frameBright} strokeWidth="0.3" />
        {[[24,24,1,1],[W-24,24,-1,1],[24,H-24,1,-1],[W-24,H-24,-1,-1]].map(([x,y,dx,dy],i) => (
          <g key={i}>
            <line x1={x} y1={y} x2={x+22*dx} y2={y} stroke={C.accent} strokeWidth="0.7" opacity="0.35" />
            <line x1={x} y1={y} x2={x} y2={y+22*dy} stroke={C.accent} strokeWidth="0.7" opacity="0.35" />
          </g>
        ))}

        {/* Scenario tag */}
        <text x="32" y={H/2+120} fill={C.textFaint} fontSize="10" letterSpacing="0.35em"
          transform={`rotate(-90,32,${H/2+120})`} fontFamily="'Orbitron',sans-serif">CHARIOT OF THE GODS</text>
        <text x="32" y="42" fill={C.textDim} fontSize="7.5" letterSpacing="0.25em"
          fontFamily="'Orbitron',sans-serif" opacity="0.7">S C E N A R I O</text>

        {/* Info sidebar */}
        <g>
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

        {/* Deck label */}
        <g transform={`translate(${CX-55},42)`}>
          <text y="8" fill={C.textDim} fontSize="10" letterSpacing="0.18em" fontFamily="'Orbitron',sans-serif">DECK</text>
          <circle cx="52" cy="3" r="15" fill="none" stroke={C.hullOutline} strokeWidth="1.6" />
          <text x="52" y="9" fill={C.textBright} fontSize="17" fontWeight="bold" textAnchor="middle"
            fontFamily="'Orbitron',sans-serif">{dk}</text>
          <text x="78" y="8" fill={C.textDim} fontSize="9.5" letterSpacing="0.15em"
            fontFamily="'Orbitron',sans-serif">{info.name}</text>
        </g>

        {/* Nacelles */}
        <path d={NAC_L} fill="url(#nacGrad)" stroke={C.hullOutline} strokeWidth="0.7" />
        <path d={NAC_R} fill="url(#nacGrad)" stroke={C.hullOutline} strokeWidth="0.7" />
        <path d={NOZ_L} fill="url(#nozGrad)" stroke={C.hullDark} strokeWidth="0.5" />
        <path d={NOZ_R} fill="url(#nozGrad)" stroke={C.hullDark} strokeWidth="0.5" />
        <text x={HL-22} y={HB-100} fill={C.textFaint} fontSize="5.5" textAnchor="middle"
          transform={`rotate(-90,${HL-22},${HB-100})`} letterSpacing="0.06em">ENGINE POD 1</text>
        <text x={HR+22} y={HB-100} fill={C.textFaint} fontSize="5.5" textAnchor="middle"
          transform={`rotate(90,${HR+22},${HB-100})`} letterSpacing="0.06em">ENGINE POD 2</text>
        {[HL,HR].map((nx,ni) => (
          <g key={ni} opacity="0.35">{[0,22,44,66,88].map(dy => (
            <line key={dy} x1={nx+(ni===0?-5:5)} y1={HB-140+dy} x2={nx+(ni===0?-36:36)} y2={HB-140+dy}
              stroke={C.divider} strokeWidth="0.4" />
          ))}</g>
        ))}

        {/* Hull */}
        <path d={HULL} fill="url(#hullGrad)" stroke={C.hullOutline} strokeWidth="1.2" />
        <g clipPath="url(#hullClip)" opacity="0.3">
          <rect x={HL-10} y={HT} width={HR-HL+20} height={HB-HT} fill="url(#plate)" />
        </g>
        <g clipPath="url(#hullClip)" opacity="0.18">
          {[155,230,310,400,480,560,640,720].map(yy => (
            <line key={yy} x1={HL-5} y1={HT+yy-60} x2={HR+5} y2={HT+yy-60}
              stroke={C.hullOutline} strokeWidth="0.5" strokeDasharray="2 10" />
          ))}
        </g>

        {/* Deck rooms */}
        <g clipPath="url(#hullClip)">
          {dk === 'A' && <DeckA />}
          {dk === 'B' && <DeckB />}
          {dk === 'C' && <DeckC />}
        </g>

        {/* Aft airlock */}
        <g clipPath="url(#hullClip)">
          <rect x={CX-16} y={HB-20} width="32" height="14"
            fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.7" rx="2" />
          <text x={CX} y={HB-2} fill={C.textDim} fontSize="4.5" textAnchor="middle">DOCKING AIRLOCK</text>
        </g>

        {/* Specs */}
        <g>
          <text x="60" y={H-58} fill={C.text} fontSize="7.5" letterSpacing="0.1em" fontWeight="bold">TECHNICAL SPECIFICATIONS</text>
          {[['LENGTH','334 METRES'],['CLASS','Lockmart CM-88G Bison-Class'],['ENGINES','Saturn J 3000'],['COMPUTER','MU/TH/UR 6500'],['CREW','5']].map(([l,v],i) => (
            <text key={i} x="60" y={H-44+i*11} fill={C.textDim} fontSize="6"><tspan fill={C.text}>{l}:</tspan> {v}</text>
          ))}
        </g>

        {/* Legend */}
        <g transform={`translate(${W-195},85)`}>
          <rect x="-10" y="-15" width="172" height="195" rx="3" fill="none" stroke={C.frame} strokeWidth="0.4" />
          <text y="0" fill={C.text} fontSize="7.5" fontWeight="bold" letterSpacing="0.1em">MAP LEGEND</text>
          {[
            {y:18, draw:<rect x="0" y={14} width="10" height="6" fill={C.door} opacity="0.6" rx="0.5"/>, label:'DOORWAY'},
            {y:36, draw:<line x1="0" y1={33} x2="12" y2={33} stroke={C.vent} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.4"/>, label:'VENT PATHWAY'},
            {y:54, draw:<><rect x="0" y={48} width="10" height="10" fill={C.hullDeep} stroke={C.shaft} strokeWidth="0.8" rx="1.5"/>{[-2,2].map(d=><line key={d} x1="2" y1={53+d} x2="8" y2={53+d} stroke={C.shaft} strokeWidth="0.5" opacity="0.5"/>)}</>, label:'LADDER ACCESS'},
            {y:72, draw:<><rect x="0" y={66} width="10" height="10" fill={C.hullDeep} stroke={C.shaft} strokeWidth="0.8" rx="1"/><line x1="2" y1={68} x2="8" y2={74} stroke={C.shaft} strokeWidth="0.4"/><line x1="8" y1={68} x2="2" y2={74} stroke={C.shaft} strokeWidth="0.4"/></>, label:'ELEVATOR'},
            {y:90, draw:<circle cx="5" cy={86} r="5" fill={C.hullDeep} stroke={C.shaft} strokeWidth="0.8"/>, label:'AIR SCRUBBER SHAFT'},
            {y:108, draw:<circle cx="5" cy={105} r="3" fill="none" stroke={C.restricted} strokeWidth="0.6" opacity="0.7"/>, label:'RESTRICTED ACCESS'},
            {y:126, draw:<rect x="0" y={121} width="10" height="8" fill="url(#hatch)" stroke={C.equipLine} strokeWidth="0.3"/>, label:'MACHINERY / TANKAGE'},
            {y:144, draw:<rect x="0" y={139} width="10" height="8" fill="url(#grating)" stroke={C.equipLine} strokeWidth="0.3"/>, label:'CORRIDOR / GRATING'},
            {y:162, draw:<rect x="0" y={158} width="10" height="5" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.4" rx="1.5" opacity="0.5"/>, label:'VIEWPORT'},
          ].map((item,i) => (
            <g key={i}>{item.draw}<text x="20" y={item.y+2} fill={C.textDim} fontSize="6" letterSpacing="0.05em">{item.label}</text></g>
          ))}
        </g>

        <text x={W-48} y={H-24} fill={C.textFaint} fontSize="10" textAnchor="end"
          fontFamily="'Orbitron',sans-serif">{info.page}</text>
      </svg>
    </div>
  );
}
