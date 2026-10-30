/* DUNE theme — desert-and-spice. Deep umber background, sand text, spice-orange
   accent, "blue-within-blue" teal for secondary accents. Every key that
   alien/theme.js defines is defined here too (smoke test checks this). */

/* Static SVG fractal-noise tile (no animation, so nothing to disable for
   prefers-reduced-motion) plus a soft warm vignette. pointer-events: none so
   it never blocks input; kept faint for TV/board contrast (research §(d)). */
const GRAIN_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.85 0 0 0 0 0.72 0 0 0 0 0.5 0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>";

export const GRAIN_OVERLAY_CSS = `
html.overlay-grain body::before {
  content: ''; position: fixed; inset: 0; z-index: 9998; pointer-events: none;
  background: radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(10, 6, 2, 0.55) 100%);
}
html.overlay-grain body::after {
  content: ''; position: fixed; inset: -50%; z-index: 9999; pointer-events: none;
  background-image: url("${GRAIN_SVG}"); background-size: 160px 160px;
  opacity: 0.07; mix-blend-mode: overlay;
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
    '--text': '#d9c7a3',
    '--text-dim': '#8a7556',
    '--text-bright': '#f3e6c8',
    '--accent': '#e2932e',
    '--accent-dim': '#9a5f17',
    '--accent-glow': 'rgba(226, 147, 46, 0.14)',
    '--accent-bright': '#ffb85a',
    '--warn': '#e0c870',
    '--warn-dim': '#8f7c38',
    '--danger': '#a8322a',
    '--danger-dim': '#5e1a15',
    '--danger-glow': 'rgba(168, 50, 42, 0.18)',
    '--success': '#8fae5a',
    '--blue': '#3aa6b8',
    '--purple': '#9a6fb0',
    '--font-display': "'Cinzel', serif",
    '--font-mono': "'IBM Plex Mono', monospace",
  },
  fonts: {
    display: 'Cinzel',
    mono: 'IBM Plex Mono',
    googleCss: 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap',
  },
  // No CRT scanlines in the Imperium (research §(d): never reuse the Alien
  // terminal chrome).
  crt: false,
  // Film-grain + vignette overlay instead. ENGINE GAP: the engine only knows
  // `crt` (html.crt). To support this it should toggle `html.overlay-grain`
  // when theme.overlay === 'grain' and inject theme.overlayCss once (e.g. a
  // <style id="universe-overlay"> swapped like the font <link>). Until then
  // these two keys are inert.
  overlay: 'grain',
  overlayCss: GRAIN_OVERLAY_CSS,
};

export default theme;
