/* DUNE theme — desert-and-spice. Deep umber background, sand text, spice-orange
   accent, "blue-within-blue" teal for secondary accents. Every key that
   alien/theme.js defines is defined here too (smoke test checks this).

   Contrast (WCAG 2.x, against --bg-card #1d150d, the lightest surface):
     --text 12.1:1 · --text-dim 6.5:1 · --text-bright 14.6:1 · --accent 7.3:1
     --accent-dim 5.2:1 · --warn 10.9:1 · --danger 4.7:1 · --blue 6.3:1 */

/* Static SVG fractal-noise tile (paper grain, no animation) plus a soft warm
   vignette. pointer-events: none so it never blocks input. Never on the
   table board (html.board-mode) and off with REDUCE FX (html.fx-reduced). */
const GRAIN_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.86 0 0 0 0 0.74 0 0 0 0 0.52 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>";

export const GRAIN_OVERLAY_CSS = `
html.overlay-grain:not(.board-mode):not(.fx-reduced) body::before {
  content: ''; position: fixed; inset: 0; z-index: 9998; pointer-events: none;
  background: radial-gradient(ellipse at 50% 40%, transparent 50%, rgba(10, 6, 2, 0.6) 100%);
}
html.overlay-grain:not(.board-mode):not(.fx-reduced) body::after {
  content: ''; position: fixed; inset: 0; z-index: 9999; pointer-events: none;
  background-image: url("${GRAIN_SVG}"); background-size: 180px 180px;
  opacity: 0.06; mix-blend-mode: overlay;
}
@media print { html.overlay-grain body::before, html.overlay-grain body::after { display: none; } }
`;

export const theme = {
  vars: {
    '--bg-dark': '#0d0905',
    '--bg-panel': '#16100a',
    '--bg-card': '#1d150d',
    '--bg-input': '#110c07',
    '--border': '#3a2a18',
    '--border-bright': '#6b4a26',
    '--border-glow': '#e2932e33',
    '--text': '#e2d2b0',
    '--text-dim': '#b09878',
    '--text-bright': '#f6ead0',
    '--accent': '#e2932e',
    '--accent-dim': '#c07a28',
    '--accent-glow': 'rgba(226, 147, 46, 0.14)',
    '--accent-bright': '#ffb85a',
    '--subhead': '#e8cf86',
    '--warn': '#e0c870',
    '--warn-dim': '#8f7c38',
    '--danger': '#d9584a',
    '--danger-dim': '#6e231c',
    '--danger-glow': 'rgba(217, 88, 74, 0.16)',
    '--success': '#9cbc66',
    '--blue': '#3aa6b8',
    '--purple': '#b08ac8',
    '--font-display': "'Cinzel', serif",
    '--font-mono': "'IBM Plex Mono', monospace",
    '--font-body': "'IBM Plex Sans', system-ui, sans-serif",
    '--fx-speed': '1.8',
  },
  fonts: {
    display: 'Cinzel',
    mono: 'IBM Plex Mono',
    googleCss: 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:ital,wght@0,400;0,600;1,400&display=swap',
  },
  // No CRT scanlines in the Imperium (research §(d): never reuse the Alien
  // terminal chrome). Paper grain + vignette instead, via the overlay hook.
  crt: false,
  overlay: 'grain',
  overlayCss: GRAIN_OVERLAY_CSS,
  /* Boot: a slow sand-coloured fade wipe, no terminal text. */
  boot: 'sandstorm',
  motif: 'contours',
  logStyle: 'mentat',
  favicon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='5' fill='#0d0905'/><circle cx='20' cy='11' r='5' fill='#e2932e'/><path d='M2 24c6-6 11-6 16-2s9 3 12-1v11H2z' fill='#9a6a32'/><path d='M2 27c7-4 12-3 17 0s8 2 11-1' fill='none' stroke='#e2d2b0' stroke-width='1.2'/></svg>",
  /* Ambient presets offered in the GM rail AUDIO popover (keys of hooks/useAmbientAudio PRESETS): desert wind, bazaar, sietch, imperial court. */
  ambient: ['wind', 'bazaar', 'sietch', 'court'],
  board: {
    levelNoun: 'LEVEL',
    backdrop: 'sand',
    bg: '#070503',
    fog: '#0b0805',
    fogEdge: 'rgba(214, 170, 110, 0.34)',
    fogHatch: '#b08a5a',
    revealedEdge: 'rgba(226, 147, 46, 0.42)',
    label: '#f6ead0',
    labelStroke: '#140d06',
    ascii: '#e2c58e',
    asciiBg: '#0d0905',
    door: '#e8a850',
    reveal: 'dust',          // slow soft fade
    statusStyle: 'arcs',     // smooth gold-edged arcs
    chipFill: '#120c07',
    font: "'IBM Plex Mono', ui-monospace, monospace",
    /* Vector plans drawn from ASCII schematics (board/AsciiLayer.jsx): sand-and-stone, like the residency engine map. */
    deck: {
      style: 'stone',
      hull: '#2a1e12', hullEdge: '#a57d4a', hullHatch: '#4a3622', zone: '#7a5a34', zoneFill: 'rgba(165, 125, 74, 0.06)',
      floor: '#1c140b', floorAlt: '#221810', wall: '#d2a466', wallDim: '#74583a', corridor: '#120c06', corridorEdge: '#6a4c2c',
      door: '#f0b860', text: '#f6ead0', textDim: '#b8a07a', accent: '#e2932e',
      organic: '#7a8a3a', solid: '#4f9aa6', water: '#4fb3c4', sand: '#c8a06a', rock: '#a07a4a', fence: '#e8a850', dash: '#a08058', dots: '#a08058',
    },
  },
  /* Low wooden knocks and bell tones. */
  sfx: {
    'ui.tap': [{ wave: 'triangle', freq: 320, to: 260, dur: 0.06, gain: 0.07, filter: { type: 'lowpass', freq: 1200 } }],
    'ui.confirm': [
      { wave: 'triangle', freq: 392, dur: 0.12, gain: 0.07 },
      { wave: 'sine', freq: 784, at: 0.1, dur: 0.5, gain: 0.04 },
    ],
    'alert.incoming': [
      { wave: 'sine', freq: 294, dur: 1.2, gain: 0.08, attack: 0.01 },
      { wave: 'sine', freq: 588, dur: 0.9, gain: 0.03, attack: 0.01 },
      { wave: 'sine', freq: 881, dur: 0.6, gain: 0.015, attack: 0.01 },
    ],
    'dice.settle': [
      { wave: 'triangle', freq: 180, to: 120, dur: 0.09, gain: 0.12, filter: { type: 'lowpass', freq: 900 } },
      { wave: 'noise', dur: 0.04, gain: 0.04, filter: { type: 'lowpass', freq: 700 } },
    ],
    'dice.crit': [
      { wave: 'sine', freq: 392, dur: 1.1, gain: 0.07 },
      { wave: 'sine', freq: 587, at: 0.12, dur: 1.0, gain: 0.05 },
      { wave: 'sine', freq: 784, at: 0.24, dur: 0.9, gain: 0.04 },
    ],
    /* The one heavy "thump" for complications / threat. */
    'dice.botch': [
      { wave: 'sine', freq: 90, to: 48, dur: 0.6, gain: 0.25, attack: 0.004 },
      { wave: 'noise', dur: 0.12, gain: 0.08, filter: { type: 'lowpass', freq: 300 } },
    ],
    'clock.tick': [{ wave: 'triangle', freq: 520, to: 420, dur: 0.05, gain: 0.05, filter: { type: 'lowpass', freq: 1400 } }],
    reveal: [
      { wave: 'noise', dur: 0.9, gain: 0.035, attack: 0.3, filter: { type: 'bandpass', freq: 900, q: 0.6 } },
      { wave: 'sine', freq: 330, at: 0.2, dur: 0.9, gain: 0.04 },
    ],
  },
};

export default theme;
