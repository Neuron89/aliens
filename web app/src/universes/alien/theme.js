/* ALIEN RPG theme — MU/TH/UR green-phosphor terminal.
   Every key in `vars` is applied to :root by UniverseContext. index.css
   carries the same values as defaults so the first paint is correct. */

export const theme = {
  vars: {
    '--bg-dark': '#050709',
    '--bg-panel': '#0c1015',
    '--bg-card': '#101820',
    '--bg-input': '#080c10',
    '--border': '#152030',
    '--border-bright': '#1e3a55',
    '--border-glow': '#00d4aa33',
    '--text': '#b8c8d4',
    '--text-dim': '#4a6070',
    '--text-bright': '#e0eaf0',
    '--accent': '#00d4aa',
    '--accent-dim': '#007a5e',
    '--accent-glow': 'rgba(0, 212, 170, 0.12)',
    '--accent-bright': '#33ffd4',
    '--warn': '#d4a020',
    '--warn-dim': '#8a6800',
    '--danger': '#c94040',
    '--danger-dim': '#7a2020',
    '--danger-glow': 'rgba(201, 64, 64, 0.15)',
    '--success': '#40c970',
    '--blue': '#4080c9',
    '--purple': '#8040c9',
    '--font-display': "'Orbitron', sans-serif",
    '--font-mono': "'Share Tech Mono', monospace",
  },
  fonts: {
    display: 'Orbitron',
    mono: 'Share Tech Mono',
    googleCss: 'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;600;700&display=swap',
  },
  crt: true,
};

export default theme;
