import React from 'react';
import MapEngine, { useMapTheme, registerIcon, seededRandom } from '../../../engine/components/MapEngine';
import { LevelPlan, DUNE_MAP_THEME, duneLegend, duneSidebar } from './duneMapKit.jsx';
import { W, H, OUTLINE, wreckRooms, HULL_DOORS, STAIRS, CROSSING_Y, PAD, WATCH } from './wreck.geometry.js';

/* ═══════════════════════════════════════════════════════════════════════
   SALTMOTHER’S DUE — WRECK SITE — MapEngine plan (one outdoor level).
   The hull outline is the sand basin; zones come from wreck.geometry.js.
   ═══════════════════════════════════════════════════════════════════════ */

const SAND = '#2f2214', SAND_LIGHT = '#3d2c18', DRUM = '#43301a';
const zone = (id) => wreckRooms.find((r) => r.id === id).rect;

registerIcon('wreck-register', (x, y, C) => (
  <g opacity="0.65" fill="none" stroke={C.textBright} strokeWidth="0.5"><rect x={x - 3} y={y - 3.4} width="6" height="6.8" rx="0.6" /><line x1={x - 1.8} y1={y - 1.4} x2={x + 1.8} y2={y - 1.4} /><line x1={x - 1.8} y1={y + 0.4} x2={x + 1.8} y2={y + 0.4} /><circle cx={x} cy={y + 2.2} r="0.7" /></g>
));
registerIcon('wreck-spice', (x, y, C) => (
  <g opacity="0.7">{[[-1.8, 1], [1.6, 1.4], [0, -1.6], [-0.4, 2.8], [2.6, -1]].map(([dx, dy], i) => <circle key={i} cx={x + dx} cy={y + dy} r="0.9" fill={C.accent} />)}</g>
));

/* ─── Ground ─────────────────────────────────────────────────────────── */

function ripples(x0, y0, w, h, seed, gap = 9, amp = 2.4, opacity = 0.22) {
  const rng = seededRandom(seed);
  const out = [];
  for (let y = y0 + gap / 2; y < y0 + h; y += gap) {
    const ph = rng() * 6.28;
    let d = `M ${x0} ${y.toFixed(1)}`;
    for (let x = x0 + 12; x <= x0 + w; x += 12) d += ` L ${x} ${(y + Math.sin(x / 22 + ph) * amp).toFixed(1)}`;
    out.push(d);
  }
  return out.map((d, i) => <path key={i} d={d} fill="none" strokeWidth="0.45" opacity={opacity} />);
}

/* Tread band: a long track with cross-cleats and end wheels. */
function Track({ x, y, w, h = 16, C, broken }) {
  const cleats = [];
  for (let cx = x + 5; cx < x + w - 3; cx += 6) cleats.push(<line key={cx} x1={cx} y1={y + 2} x2={cx} y2={y + h - 2} />);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.6" />
      <g stroke={C.equipLine} strokeWidth="0.6" opacity="0.55">{cleats}</g>
      {[x + h / 2, x + w - h / 2].map((cx) => <circle key={cx} cx={cx} cy={y + h / 2} r={h / 2 - 2.5} fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.5" />)}
      {broken && <path d={`M ${x + w - 1} ${y - 1} l 5 ${h * 0.3} l -4 ${h * 0.3} l 5 ${h * 0.4 + 2}`} fill="none" stroke={C.restricted} strokeWidth="0.6" opacity="0.6" />}
    </g>
  );
}

/* Hull plating: body polygon, plate seams and rivet rows. */
function HullHalf({ pts, seams, C }) {
  return (
    <g>
      <polygon points={pts.map((p) => p.join(',')).join(' ')} fill={C.hullMid} stroke={C.hullOutline} strokeWidth="1" />
      <g stroke={C.hullDark} strokeWidth="0.8" opacity="0.8">{seams.map((d, i) => <path key={i} d={d} fill="none" />)}</g>
    </g>
  );
}

/* The split harvester (drawn under the walled rooms). */
function harvester(C) {
  const fwd = [[262, 378], [560, 378], [566, 392], [557, 408], [567, 428], [556, 446], [566, 468], [558, 488], [562, 510], [262, 510], [240, 486], [236, 402]];
  const aft = [[634, 378], [878, 378], [886, 394], [886, 494], [878, 510], [634, 510], [628, 490], [638, 470], [627, 450], [637, 428], [626, 410], [636, 392]];
  return (
    <g>
      {/* drift piled against the hull on the windward (north) side */}
      <path d="M 250 376 Q 400 352 556 372 L 556 380 L 250 380 Z" fill={SAND_LIGHT} opacity="0.7" />
      <path d="M 640 376 Q 760 356 876 374 L 876 380 L 640 380 Z" fill={SAND_LIGHT} opacity="0.7" />
      <Track x={258} y={362} w={296} C={C} broken />
      <Track x={258} y={506} w={296} C={C} broken />
      <Track x={638} y={362} w={240} C={C} broken />
      <Track x={638} y={506} w={240} C={C} broken />
      <HullHalf C={C} pts={fwd} seams={['M 236 444 L 262 444', 'M 250 392 L 250 498', 'M 236 402 L 262 388', 'M 236 486 L 262 500']} />
      <HullHalf C={C} pts={aft} seams={['M 878 394 L 886 394', 'M 878 494 L 886 494']} />
      {/* bridge plaz: the forward glazing, cracked */}
      <path d="M 244 412 L 256 404 L 256 484 L 244 476 Z" fill="#16252a" stroke={C.vent} strokeWidth="0.5" opacity="0.8" />
      <path d="M 248 420 l 5 12 l -3 8 l 4 10" fill="none" stroke={C.textBright} strokeWidth="0.4" opacity="0.6" />
      {/* exhaust stacks at the stern */}
      {[404, 432, 460].map((y) => <rect key={y} x={884} y={y} width={6} height={14} rx={1.5} fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.5" />)}
      {/* torn plating along the split */}
      <g stroke={C.hullOutline} strokeWidth="0.6" fill="none" opacity="0.7">
        <path d="M 560 396 l 9 -3 M 557 420 l 10 2 M 560 458 l 8 4 M 558 496 l 10 -2" />
        <path d="M 636 400 l -9 -2 M 630 440 l -8 3 M 634 480 l -9 -3" />
      </g>
    </g>
  );
}

/* Intake scoops under the aft hull: the only climb into the hold. */
function scoops(C) {
  return (
    <g>
      {[648, 690, 732].map((x) => (
        <g key={x}>
          <path d={`M ${x} 522 L ${x + 34} 522 L ${x + 30} 546 L ${x + 4} 546 Z`} fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.6" />
          {[528, 534, 540].map((y) => <line key={y} x1={x + 4} y1={y} x2={x + 30} y2={y} stroke={C.accent} strokeWidth="0.4" opacity="0.45" />)}
        </g>
      ))}
      <path d="M 646 548 Q 700 566 770 548" fill="none" stroke={C.accent} strokeWidth="2.2" opacity="0.18" />
    </g>
  );
}

/* The Sand River: a wind-cut channel of drum sand between the halves. */
function sandRiver(C) {
  return (
    <g>
      <path d="M 566 236 C 556 300 570 340 562 380 L 562 512 C 552 560 572 610 560 660 C 556 700 548 740 552 790 L 640 790 C 632 740 644 690 634 652 C 626 600 642 556 630 512 L 630 380 C 640 330 626 290 632 236 Z"
        fill={DRUM} stroke={C.equipLine} strokeWidth="0.6" strokeDasharray="3 3" opacity="0.95" />
      <g stroke={C.accent}>{ripples(552, 240, 92, 548, 77, 7, 1.8, 0.2)}</g>
    </g>
  );
}

/* Kareth’s Thumb and its rock spit: one irregular mass with strata. */
const ROCK_PTS = [[258, 126], [304, 114], [360, 117], [404, 126], [432, 148], [438, 196], [430, 238], [446, 258], [500, 262], [548, 272], [558, 290], [546, 308], [492, 316], [440, 322], [400, 327], [350, 322], [300, 327], [262, 316], [242, 288], [238, 240], [246, 196], [240, 160]];
const ROCK_D = `M ${ROCK_PTS.map((p) => p.join(' ')).join(' L ')} Z`;

function rock(C) {
  return (
    <g>
      <defs><clipPath id="wreck-rock-clip"><path d={ROCK_D} /></clipPath></defs>
      <path d={ROCK_D} fill={C.hullDark} stroke={C.hullOutline} strokeWidth="1.1" />
      <path d={ROCK_D} fill="none" stroke={C.hullBright} strokeWidth="3" opacity="0.18" transform="translate(-1.5,-1.5)" />
      <g clipPath="url(#wreck-rock-clip)" opacity="0.35" fill="none" stroke={C.hullOutline} strokeWidth="0.6">
        {[140, 162, 186, 212, 240, 268, 296, 318].map((y, i) => <path key={y} d={`M 230 ${y} Q 320 ${y + (i % 2 ? 10 : -8)} 400 ${y + 4} T 570 ${y + 10}`} />)}
      </g>
      {/* crest ridge and boulders */}
      <path d="M 268 150 Q 330 132 392 146 Q 420 170 414 214" fill="none" stroke={C.hullBright} strokeWidth="0.8" opacity="0.45" />
      {[[454, 250, 5], [570, 300, 3.5], [254, 318, 4], [446, 326, 3]].map(([x, y, r], i) => <path key={i} d={`M ${x - r} ${y} L ${x - r * 0.4} ${y - r * 0.9} L ${x + r * 0.8} ${y - r * 0.5} L ${x + r} ${y + r * 0.4} L ${x} ${y + r * 0.8} Z`} fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.5" />)}
      {/* flat western shoulder: the only safe pad */}
      <ellipse cx={PAD.x} cy={PAD.y} rx="30" ry="24" fill={C.hullMid} opacity="0.6" />
      <circle cx={PAD.x} cy={PAD.y} r="17" fill="none" stroke={C.door} strokeWidth="0.8" strokeDasharray="3 2" opacity="0.8" />
      {/* the ledge above the pad */}
      <path d="M 262 222 Q 300 210 334 226" fill="none" stroke={C.restricted} strokeWidth="0.7" strokeDasharray="2 2" opacity="0.7" />
      {/* Siq Abbar watch-post: cave mouths in the crest */}
      {[[-14, 4], [0, 0], [14, 5]].map(([dx, dy], i) => <ellipse key={i} cx={WATCH.x + dx} cy={WATCH.y + dy} rx="5" ry="3" fill={C.bg} stroke={C.hullOutline} strokeWidth="0.5" />)}
    </g>
  );
}

function barchan(x, y, s, key, C) {
  return (
    <g key={key}>
      <path d={`M ${x - s} ${y} Q ${x} ${y - s * 0.9} ${x + s} ${y} Q ${x} ${y - s * 0.38} ${x - s} ${y} Z`} fill={SAND_LIGHT} opacity="0.75" />
      <path d={`M ${x - s} ${y} Q ${x} ${y - s * 0.9} ${x + s} ${y}`} fill="none" stroke={C.equipLine} strokeWidth="0.6" opacity="0.5" />
    </g>
  );
}

const DUNES = [[480, 140, 26], [560, 196, 34], [610, 128, 20], [740, 200, 30], [830, 150, 24], [860, 222, 16], [700, 138, 14],
  [270, 680, 24], [380, 668, 18], [300, 770, 30], [410, 760, 16], [262, 590, 14], [440, 548, 12], [858, 560, 14], [866, 316, 16]];

function dunes(C) {
  return <g>{DUNES.map(([x, y, sz], i) => barchan(x, y, sz, i, C))}</g>;
}

/* The harvester’s own tread marks, half drifted, running in from the northeast. */
function crawlerTracks(C) {
  const trail = (o) => `M ${888} ${262 + o} C ${820} ${270 + o} ${760} ${300 + o} ${700 + o} ${356}`;
  return (
    <g fill="none" stroke={C.hullDark} opacity="0.9">
      {[0, 22].map((o) => <path key={o} d={trail(o)} strokeWidth="9" strokeDasharray="22 6 10 14" />)}
      {[0, 22].map((o) => <path key={`c${o}`} d={trail(o)} stroke={C.equipLine} strokeWidth="7" strokeDasharray="0.8 3.2" opacity="0.5" />)}
    </g>
  );
}

/* Drum sand over the pre-spice mass. */
function hummingBasin(C) {
  const rng = seededRandom(303);
  const dust = Array.from({ length: 70 }, () => [470 + rng() * 210, 655 + rng() * 140]);
  return (
    <g>
      <ellipse cx="572" cy="726" rx="118" ry="70" fill={DRUM} opacity="0.55" />
      {[24, 46, 68, 90, 114].map((r, i) => <ellipse key={r} cx="572" cy="726" rx={r} ry={r * 0.6} fill="none" stroke={C.accent} strokeWidth="0.6" strokeDasharray={i % 2 ? '2 4' : '6 3'} opacity={0.32 - i * 0.04} />)}
      {dust.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="0.8" fill={C.accent} opacity="0.35" />)}
    </g>
  );
}

/* Kestrel Vane: upturned carryall, one wing torn away, debris downwind. */
function kestrel(C) {
  const rng = seededRandom(919);
  const debris = Array.from({ length: 34 }, () => [716 + rng() * 150, 650 + rng() * 120, 1 + rng() * 2.6, rng() * 90]);
  return (
    <g>
      {/* skid gouge from the northwest */}
      <path d="M 712 652 Q 748 676 776 700" fill="none" stroke={C.hullDeep} strokeWidth="10" opacity="0.6" strokeLinecap="round" />
      {debris.map(([x, y, r, a], i) => <rect key={i} x={x} y={y} width={r * 1.6} height={r} transform={`rotate(${a},${x},${y})`} fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.3" opacity="0.8" />)}
      <g transform="rotate(-18,800,716)">
        {/* surviving wing (upturned: drawn from below) */}
        <path d="M 786 704 L 776 652 L 812 652 L 812 704 Z" fill={C.hullMid} stroke={C.hullOutline} strokeWidth="0.8" />
        {[664, 678, 692].map((y) => <line key={y} x1={780} y1={y} x2={812} y2={y} stroke={C.hullDark} strokeWidth="0.6" />)}
        {/* torn wing root */}
        <path d="M 786 728 L 790 740 L 796 734 L 802 744 L 808 732 L 812 728 Z" fill={C.hullDark} stroke={C.restricted} strokeWidth="0.6" opacity="0.9" />
        {/* fuselage */}
        <path d="M 734 708 L 852 704 Q 868 716 852 728 L 734 724 Q 724 716 734 708 Z" fill={C.hullMid} stroke={C.hullOutline} strokeWidth="1" />
        {/* bays: cockpit (fwd, west), crew bay, avionics bay */}
        <line x1={760} y1={708} x2={760} y2={724} stroke={C.hullDark} strokeWidth="0.8" />
        <line x1={828} y1={705} x2={828} y2={727} stroke={C.hullDark} strokeWidth="0.8" />
        <path d="M 734 709 Q 726 716 734 723 L 742 723 L 742 709 Z" fill="#16252a" stroke={C.vent} strokeWidth="0.4" opacity="0.8" />
        {/* lift engines */}
        {[[772, 702], [826, 700]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="4" fill={C.hullDeep} stroke={C.hullOutline} strokeWidth="0.5" />)}
        {/* flight recorder */}
        <rect x={840} y={712} width={6} height={6} fill="none" stroke={C.door} strokeWidth="0.7" />
      </g>
      {/* the torn-away wing, thrown clear */}
      <path d="M 718 756 L 760 744 L 770 758 L 726 776 Z" fill={C.hullDark} stroke={C.hullOutline} strokeWidth="0.7" />
      <path d="M 760 744 l 3 5 l -2 3 l 5 3" fill="none" stroke={C.restricted} strokeWidth="0.5" opacity="0.7" />
    </g>
  );
}

/* Worm sign: a long line of lifting dune crests moving in from the northeast. */
function wormSign(C) {
  const pts = [[876, 196], [846, 214], [812, 216], [780, 230], [748, 232]];
  return (
    <g fill="none" stroke={C.restricted} strokeWidth="0.8" opacity="0.6">
      {pts.map(([x, y], i) => <path key={i} d={`M ${x - 10} ${y + 3} Q ${x} ${y - 6} ${x + 10} ${y + 3}`} opacity={1 - i * 0.15} />)}
    </g>
  );
}

/* Survivors’ litter under the belly hatch; spice slick under the scoops. */
function aprons(C) {
  return (
    <g>
      {[[372, 538], [386, 546], [366, 552]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.2" fill="none" stroke={C.vent} strokeWidth="0.6" opacity="0.6" />)}
      <g transform="translate(300,560)" stroke={C.accent} strokeWidth="0.7" fill="none" opacity="0.7">
        <line x1="0" y1="0" x2="18" y2="6" /><rect x="-3" y="-3" width="6" height="5" transform="rotate(18)" />
      </g>
      <path d="M 652 552 Q 700 566 766 552 Q 776 572 748 584 Q 700 594 664 580 Z" fill={C.accent} opacity="0.1" />
    </g>
  );
}

function basinGround(C) {
  return (
    <g>
      <rect x="0" y="0" width={W} height={H} fill={SAND} />
      <g stroke={C.equipLine}>{ripples(200, 90, 720, 740, 41, 13, 3, 0.16)}</g>
      {dunes(C)}
      {hummingBasin(C)}
      {crawlerTracks(C)}
      {wormSign(C)}
      {sandRiver(C)}
      {rock(C)}
      {kestrel(C)}
      {aprons(C)}
      {harvester(C)}
      {scoops(C)}
    </g>
  );
}

function ZoneLabel({ x, y, label, sub, size = 7.5, anchor = 'middle', rotate }) {
  const C = useMapTheme();
  const tr = rotate ? `rotate(${rotate},${x},${y})` : undefined;
  return (
    <g transform={tr} pointerEvents="none">
      <text x={x} y={y} fill={C.text} fontSize={size} textAnchor={anchor} letterSpacing="0.2em" style={{ fontFamily: 'var(--font-display)' }}>{label}</text>
      {sub && <text x={x} y={y + 9} fill={C.textDim} fontSize="5" textAnchor={anchor} letterSpacing="0.12em">{sub}</text>}
    </g>
  );
}

function ZoneEdges() {
  const C = useMapTheme();
  return (
    <g fill="none" stroke={C.equipLine} strokeWidth="0.5" strokeDasharray="1 5" opacity="0.35">
      {wreckRooms.filter((r) => r.draw?.kind === 'zone').map((r) => <rect key={r.id} {...r.rect} />)}
    </g>
  );
}

function Crossing() {
  const C = useMapTheme();
  const y = CROSSING_Y;
  return (
    <g pointerEvents="none">
      <line x1={520} y1={y} x2={672} y2={y} stroke={C.door} strokeWidth="0.9" strokeDasharray="4 3" opacity="0.8" />
      {[520, 672].map((x) => <circle key={x} cx={x} cy={y} r="2" fill={C.door} opacity="0.8" />)}
      <line x1={562} y1={y - 12} x2={562} y2={y - 4} stroke={C.textDim} strokeWidth="0.5" />
      <line x1={630} y1={y - 12} x2={630} y2={y - 4} stroke={C.textDim} strokeWidth="0.5" />
      <line x1={562} y1={y - 8} x2={630} y2={y - 8} stroke={C.textDim} strokeWidth="0.5" />
      <text x={596} y={y - 11} fill={C.textBright} fontSize="5.2" textAnchor="middle" letterSpacing="0.15em">40 M</text>
      <text x={596} y={y + 10} fill={C.textDim} fontSize="4.4" textAnchor="middle" letterSpacing="0.12em">CROSS WITHOUT RHYTHM</text>
    </g>
  );
}

function Tag({ x, y, children, color, anchor = 'middle', size = 4.6 }) {
  const C = useMapTheme();
  return <text x={x} y={y} fill={color || C.textDim} fontSize={size} textAnchor={anchor} letterSpacing="0.14em" pointerEvents="none">{children}</text>;
}

/* Interior furniture of the four hull rooms (drawn over the room floors). */
function HullInteriors() {
  const C = useMapTheme();
  const line = { fill: 'none', stroke: C.equipLine, strokeWidth: 0.6, opacity: 0.55 };
  return (
    <g pointerEvents="none">
      {/* bridge: console arc facing the plaz, helm chairs, register housing */}
      <path d="M 282 410 Q 270 444 282 478" {...line} />
      {[424, 444, 464].map((y) => <circle key={y} cx={294} cy={y} r="3" {...line} />)}
      <rect x={350} y={462} width={26} height={18} fill="none" stroke={C.textBright} strokeWidth="0.6" opacity="0.6" />
      <text x={363} y={489} fill={C.textDim} fontSize="3.8" textAnchor="middle" letterSpacing="0.1em">REGISTER</text>
      {/* crew deck: stilltents and dew-traps */}
      {[[420, 410], [446, 410], [508, 470], [534, 470]].map(([x, y], i) => <path key={i} d={`M ${x} ${y + 12} L ${x + 9} ${y} L ${x + 18} ${y + 12} Z`} {...line} />)}
      {[[430, 474], [522, 412]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.4" fill="none" stroke={C.vent} strokeWidth="0.5" opacity="0.6" />)}
      {/* spice hold: sacked melange, densest at the floor */}
      {Array.from({ length: 24 }, (_, i) => [646 + (i % 8) * 15, 466 + Math.floor(i / 8) * 9]).map(([x, y], i) => <rect key={i} x={x} y={y} width={11} height={6} rx="1.5" fill={C.accent} opacity="0.16" stroke={C.accent} strokeWidth="0.3" />)}
      {/* engine section: dead turbines, beacon breaker, Hesk */}
      {[408, 470].map((y) => <g key={y}><circle cx={800} cy={y} r="9" {...line} /><circle cx={800} cy={y} r="3" {...line} /></g>)}
      <rect x={842} y={404} width={10} height={14} fill="none" stroke={C.restricted} strokeWidth="0.6" opacity="0.7" />
      <line x1={847} y1={410} x2={853} y2={404} stroke={C.restricted} strokeWidth="0.6" opacity="0.7" />
      <rect x={830} y={466} width={24} height={8} rx="3" fill="none" stroke={C.textDim} strokeWidth="0.5" opacity="0.7" />
    </g>
  );
}

function SiteDecor() {
  const C = useMapTheme();
  return (
    <g>
      {/* footpaths: pad → around the prow → belly hatch → crossing → scoops */}
      <path d={`M ${PAD.x - 8} ${PAD.y + 18} C 250 330 232 360 234 420 C 234 470 250 530 300 534 L 331 504`} fill="none" stroke={C.door} strokeWidth="0.7" strokeDasharray="1 3" opacity="0.7" />
      <path d={`M 331 504 C 360 540 470 560 520 572`} fill="none" stroke={C.door} strokeWidth="0.7" strokeDasharray="1 3" opacity="0.7" />
      <path d={`M 672 572 C 690 562 696 556 700 546`} fill="none" stroke={C.door} strokeWidth="0.7" strokeDasharray="1 3" opacity="0.7" />
      <HullInteriors />
      <Crossing />
      <ZoneLabel x={328} y={196} label="KARETH’S THUMB" sub="WORM-SAFE ROCK" />
      <Tag x={WATCH.x} y={WATCH.y - 9} color={C.text}>SIQ ABBAR</Tag>
      <Tag x={WATCH.x} y={WATCH.y + 16}>WATCH-POST</Tag>
      <Tag x={PAD.x} y={PAD.y + 3} color={C.door} size={5}>PAD</Tag>
      <Tag x={PAD.x} y={PAD.y + 30}>CINDER MOTH</Tag>
      <Tag x={298} y={214} color={C.restricted} size={4.2}>LEDGE</Tag>
      <Tag x={412} y={110} anchor="start" size={4.2}>▼ BACK TRAIL</Tag>
      <ZoneLabel x={664} y={170} label="DUNE FIELD" sub="WORM COUNTRY" size={9} />
      <Tag x={812} y={246} color={C.restricted}>WORM SIGN</Tag>
      <ZoneLabel x={498} y={296} label="ROCK SPIT" size={5.6} />
      <ZoneLabel x={800} y={312} label="CRAWLER TRACKS" size={6} />
      <ZoneLabel x={410} y={344} label="THUMB APPROACH" sub="OPEN SAND · 600 M TO THE HULL" size={6} />
      <ZoneLabel x={597} y={445} label="SAND RIVER" size={7} rotate={-90} />
      <Tag x={318} y={533} color={C.door}>BELLY HATCH</Tag>
      <Tag x={710} y={558} color={C.door}>INTAKE SCOOPS</Tag>
      <Tag x={262} y={355} color={C.text} anchor="start" size={4.2}>FORWARD HULL</Tag>
      <Tag x={876} y={355} color={C.text} anchor="end" size={4.2}>AFT HULL</Tag>
      <ZoneLabel x={420} y={610} label="FORWARD APRON" size={6} />
      <ZoneLabel x={790} y={610} label="AFT APRON" size={6} />
      <ZoneLabel x={336} y={728} label="SOUTH ERG" size={7} />
      <ZoneLabel x={572} y={724} label="HUMMING BASIN" sub="DRUM SAND · PRE-SPICE MASS" size={7} />
      <ZoneLabel x={792} y={790} label="KESTREL VANE" sub="CARRYALL WRECK · 1.2 KM SE" size={7} />
      <Tag x={862} y={688} color={C.door} size={4.2}>RECORDER</Tag>
      <Tag x={728} y={738} size={4.2} anchor="end">COCKPIT</Tag>
      <Tag x={376} y={566} color={C.vent} size={4.2}>WATER RINGS</Tag>
      <Tag x={300} y={580} size={4.2}>DEAD THUMPER</Tag>
      <Tag x={712} y={598} color={C.accent} size={4.2}>SPICE SLICK</Tag>
    </g>
  );
}

const Site = () => (
  <LevelPlan rooms={wreckRooms} doors={HULL_DOORS} stairs={STAIRS} level="site" decorate={() => <SiteDecor />} />
);

export const wreckConfig = {
  width: W,
  height: H,
  theme: DUNE_MAP_THEME,
  stars: { count: 0, seed: 1 },
  backdrop: 'sand',
  levelNoun: 'LEVEL',
  scenarioTag: 'DEEP DESERT',
  hull: { path: OUTLINE, overlays: basinGround },
  sidebar: duneSidebar({ title: 'SALTMOTHER’S DUE — WRECK SITE', subtitle: 'SPLIT HARVESTER, CARRYALL WRECK AND THE FREMEN ROCK', scale: 'SCHEMATIC · NOT TO SCALE' }),
  decks: [{ id: 'W', level: 'site', name: 'WRECK SITE', page: 'IV', component: Site }],
  specs: {
    title: 'SITE SURVEY',
    items: [
      ['DISTANCES', 'Thumb→hull 600 m · river 40 m · carryall 1.2 km SE'],
      ['WORM SIGN', 'Clock of 6; rhythm and shields advance it'],
      ['SAFE GROUND', 'Kareth’s Thumb and the Rock Spit only'],
      ['WAYS IN', 'Belly hatch (fore) · intake scoops (aft)'],
    ],
  },
  legend: duneLegend([
    { label: 'OPEN SAND (WORM RISK)', draw: (y) => <><rect x="0" y={y - 5} width="10" height="8" fill={SAND_LIGHT} stroke={DUNE_MAP_THEME.equipLine} strokeWidth="0.4" /><path d={`M 1 ${y - 2} q 2 -1.5 4 0 t 4 0 M 1 ${y + 1} q 2 -1.5 4 0 t 4 0`} fill="none" stroke={DUNE_MAP_THEME.accent} strokeWidth="0.4" opacity="0.7" /></> },
    { label: 'ROCK (WORM-SAFE)', draw: (y) => <><path d={`M 0 ${y + 3} L 2 ${y - 4} L 7 ${y - 5} L 10 ${y - 1} L 9 ${y + 3} Z`} fill={DUNE_MAP_THEME.hullDark} stroke={DUNE_MAP_THEME.hullOutline} strokeWidth="0.5" /><line x1="1.5" y1={y - 1} x2="9.5" y2={y - 2} stroke={DUNE_MAP_THEME.hullOutline} strokeWidth="0.3" /></> },
    { label: 'SAND CROSSING / FOOTPATH', draw: (y) => <line x1="0" y1={y - 1} x2="12" y2={y - 1} stroke={DUNE_MAP_THEME.door} strokeWidth="0.9" strokeDasharray="3 2" /> },
    { label: 'WORM SIGN', draw: (y) => <path d={`M 0 ${y + 1} Q 3 ${y - 4} 6 ${y + 1} M 5 ${y + 1} Q 8 ${y - 4} 11 ${y + 1}`} fill="none" stroke={DUNE_MAP_THEME.restricted} strokeWidth="0.7" /> },
  ]),
};

/** Interactive plan, registered as universe.maps[saltmothers-due-wreck].engine */
export function WreckMap() {
  return <MapEngine config={wreckConfig} />;
}
WreckMap.config = wreckConfig;
