/* ALIEN RPG theme — MU/TH/UR green-phosphor terminal (1979 lo-fi tech).
   Every key in `vars` is applied to :root by UniverseContext. index.css
   carries the same values as defaults so the first paint is correct.

   Contrast (WCAG 2.x, against --bg-card #101820, the lightest surface):
     --text 12.1:1 · --text-dim 6.0:1 · --text-bright 14.7:1 · --accent 9.4:1
     --accent-dim 5.6:1 · --warn 8.5:1 · --danger 4.8:1 · --blue 6.1:1
   One colour = one meaning: phosphor teal = interface, amber = caution /
   stress, red = danger / panic only (research §(d)). */

export const theme = {
  vars: {
    '--bg-dark': '#050709',
    '--bg-panel': '#0c1015',
    '--bg-card': '#101820',
    '--bg-input': '#080c10',
    '--border': '#1a2836',
    '--border-bright': '#2a4a66',
    '--border-glow': '#00d4aa33',
    '--text': '#c8d6e0',
    '--text-dim': '#8299a8',
    '--text-bright': '#e8f0f4',
    '--accent': '#00d4aa',
    '--accent-dim': '#00a383',
    '--accent-glow': 'rgba(0, 212, 170, 0.12)',
    '--accent-bright': '#5effdc',
    '--subhead': '#9fd8ca',
    '--warn': '#e0aa2a',
    '--warn-dim': '#8a6800',
    '--danger': '#e5534b',
    '--danger-dim': '#7a2020',
    '--danger-glow': 'rgba(229, 83, 75, 0.14)',
    '--success': '#40c970',
    '--blue': '#5a9ae0',
    '--purple': '#9a6ae0',
    '--font-display': "'Orbitron', sans-serif",
    '--font-mono': "'Share Tech Mono', monospace",
    '--font-body': "'Share Tech Mono', monospace",
    '--fx-speed': '1',
  },
  fonts: {
    display: 'Orbitron',
    mono: 'Share Tech Mono',
    googleCss: 'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;600;700&display=swap',
  },
  crt: true,
  /* UniverseContext toggles html.overlay-<overlay>; .crt-overlay draws faint scanlines + vignette. */
  overlay: 'crt',
  /* Boot: typed terminal lines from terminal.statusLines (fx/BootSequence.jsx). */
  boot: 'terminal',
  /* Deliberately slow: the lines in terms.terminal.bootLines type out character by character
     with the key sound (about 10 s; any tap or key skips it). */
  bootMs: 10500,
  /* Landing / library art motif (fx/Motifs.jsx). */
  motif: 'deckplan',
  /* Generator wizard log style. */
  logStyle: 'terminal',
  favicon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='5' fill='#050709'/><rect x='3.5' y='3.5' width='25' height='25' rx='3' fill='none' stroke='#00d4aa' stroke-width='1.5'/><path d='M8 22V10l8 7 8-7v12' fill='none' stroke='#00d4aa' stroke-width='2.4' stroke-linejoin='round'/><path d='M6 26h20' stroke='#e0aa2a' stroke-width='1.4'/></svg>",
  /* Ambient presets offered in the GM rail AUDIO popover (keys of hooks/useAmbientAudio PRESETS): engine hum,
     derelict silence, hive (wet drip), tension, red alert, deep space, cosmic dread. */
  ambient: ['ship', 'derelict', 'hive', 'tension', 'alert', 'space', 'dread'],
  /* Soundboard (src/engine/soundboard.js): one-tap stingers the GM fires to the TV, in button order. */
  sounds: {
    stingers: ['klaxon', 'hull-groan', 'airlock', 'steam-vent', 'tracker-burst', 'screech', 'lights-out'],
  },
  /* Narrator voice (server TTS, server/tts.js — Kokoro voice id or blend like 'bm_george(2)+bm_lewis(1)'):
     a calm, cold British male for MU/TH/UR. The GM can pick another in NARRATE → VOICE. */
  voice: { narrator: 'bm_george', speed: 0.92 },
  /* Table-board palette (board/*). Maps may override any key via map.palette. */
  board: {
    levelNoun: 'DECK',
    backdrop: 'space',
    bg: '#000000',
    fog: '#020304',
    fogEdge: 'rgba(150, 170, 190, 0.32)',
    fogHatch: '#8899aa',
    revealedEdge: 'rgba(120, 220, 190, 0.4)',
    label: '#e8f0f0',
    labelStroke: '#000000',
    ascii: '#7fd4b8',
    asciiBg: '#05080a',
    door: '#50b898',
    reveal: 'scan',          // stepped CRT-style dissolve
    statusStyle: 'segments', // square-cut ring ticks
    chipFill: '#0a0c10',
    font: "'Share Tech Mono', ui-monospace, monospace",
    hullStyle: 'hatched',    // engine deck plans on the TV: dim hatched hull, not a bright teal slab
    hullAlpha: 0.3,
    /* Vector deck plans drawn from ASCII schematics (board/AsciiLayer.jsx). */
    deck: {
      style: 'hatched',
      hull: '#0b1f1b', hullEdge: '#2f8f78', hullHatch: '#163e35', zone: '#1f5a4c', zoneFill: 'rgba(40, 120, 100, 0.06)',
      floor: '#0b221e', floorAlt: '#0e2a25', wall: '#4fc4a4', wallDim: '#2a7a68', corridor: '#081714', corridorEdge: '#2a6a5a',
      door: '#9cf0d8', text: '#d4f4ea', textDim: '#6fae9a', accent: '#50c8a8',
      organic: '#8a9a40', solid: '#b84a3a', water: '#2f8f9a', sand: '#9a8a5a', rock: '#6f8a86', fence: '#c8a040', dash: '#5f9a88', dots: '#5f9a88',
    },
  },
  /* Terminal blips: square waves and short noise ticks. */
  sfx: {
    /* Boot typing: a short, bright electronic key-click per character (synthesized, no samples),
       a two-note chirp when a line lands, and a rising "ready" tone at the end. */
    'boot.key': [
      { wave: 'square', freq: 2600, to: 1900, dur: 0.022, gain: 0.05, attack: 0.001, filter: { type: 'bandpass', freq: 2300, q: 2.5 } },
      { wave: 'noise', dur: 0.012, gain: 0.02, filter: { type: 'highpass', freq: 4000 } },
    ],
    'boot.line': [
      { wave: 'square', freq: 1180, dur: 0.05, gain: 0.04, filter: { type: 'lowpass', freq: 2800 } },
      { wave: 'square', freq: 1760, at: 0.06, dur: 0.08, gain: 0.04, filter: { type: 'lowpass', freq: 2800 } },
    ],
    /* Faint mains hum under the boot typing: re-struck every 0.9 s by fx/BootSequence, so the 1.25 s
       swells overlap into a low, slightly breathing drone that stops when the boot does. */
    'boot.hum': [
      { wave: 'sine', freq: 120, dur: 1.25, gain: 0.03, attack: 0.4 },
      { wave: 'sine', freq: 180, dur: 1.25, gain: 0.012, attack: 0.4 },
      { wave: 'sawtooth', freq: 60, dur: 1.25, gain: 0.008, attack: 0.4, filter: { type: 'lowpass', freq: 400 } },
    ],
    'boot.ready': [
      { wave: 'square', freq: 880, dur: 0.09, gain: 0.045, filter: { type: 'lowpass', freq: 2600 } },
      { wave: 'square', freq: 1320, at: 0.1, dur: 0.09, gain: 0.045, filter: { type: 'lowpass', freq: 2600 } },
      { wave: 'square', freq: 1760, at: 0.2, dur: 0.22, gain: 0.045, filter: { type: 'lowpass', freq: 2600 } },
    ],
    'ui.tap': [{ wave: 'square', freq: 1760, dur: 0.025, gain: 0.035, filter: { type: 'lowpass', freq: 3200 } }],
    'ui.confirm': [
      { wave: 'square', freq: 1320, dur: 0.04, gain: 0.04, filter: { type: 'lowpass', freq: 3000 } },
      { wave: 'square', freq: 1760, at: 0.06, dur: 0.06, gain: 0.04, filter: { type: 'lowpass', freq: 3000 } },
    ],
    'alert.incoming': [
      { wave: 'square', freq: 990, dur: 0.09, gain: 0.05, filter: { type: 'lowpass', freq: 2400 } },
      { wave: 'square', freq: 990, at: 0.14, dur: 0.09, gain: 0.05, filter: { type: 'lowpass', freq: 2400 } },
      { wave: 'square', freq: 1320, at: 0.28, dur: 0.18, gain: 0.05, filter: { type: 'lowpass', freq: 2400 } },
    ],
    'dice.settle': [
      { wave: 'noise', dur: 0.03, gain: 0.08, filter: { type: 'highpass', freq: 2500 } },
      { wave: 'square', freq: 2200, at: 0.03, dur: 0.02, gain: 0.025 },
    ],
    'dice.crit': [
      { wave: 'square', freq: 1046, dur: 0.06, gain: 0.04, filter: { type: 'lowpass', freq: 3500 } },
      { wave: 'square', freq: 1318, at: 0.07, dur: 0.06, gain: 0.04, filter: { type: 'lowpass', freq: 3500 } },
      { wave: 'square', freq: 1568, at: 0.14, dur: 0.06, gain: 0.04, filter: { type: 'lowpass', freq: 3500 } },
      { wave: 'square', freq: 2093, at: 0.21, dur: 0.16, gain: 0.04, filter: { type: 'lowpass', freq: 3500 } },
    ],
    /* Panic stinger: one low two-tone klaxon, reserved for panic/botch. */
    'dice.botch': [
      { wave: 'sawtooth', freq: 330, to: 220, dur: 0.32, gain: 0.07, filter: { type: 'lowpass', freq: 1400 } },
      { wave: 'sawtooth', freq: 330, to: 220, at: 0.36, dur: 0.32, gain: 0.07, filter: { type: 'lowpass', freq: 1400 } },
    ],
    'clock.tick': [{ wave: 'square', freq: 2400, dur: 0.012, gain: 0.03, filter: { type: 'bandpass', freq: 2400, q: 4 } }],
    reveal: [
      { wave: 'noise', dur: 0.25, gain: 0.04, filter: { type: 'bandpass', freq: 3000, q: 0.8 } },
      { wave: 'square', freq: 880, to: 1760, at: 0.05, dur: 0.2, gain: 0.025, filter: { type: 'lowpass', freq: 2600 } },
    ],
  },
};

export default theme;
