# MU/TH/UR — ALIEN RPG Game Mother Terminal

A real-time companion web app for running [ALIEN RPG](https://freeleaguepublishing.com/games/alien/) tabletop sessions. Built with React, Socket.io, and a CRT-style terminal aesthetic inspired by the Weyland-Yutani computer systems from the ALIEN universe.

The Game Mother (DM) runs a session from the main terminal. Players connect from their own devices using a session code and see only their character's information, status, and secret messages from MU/TH/UR.

---

## Features

### Game Session (Multiplayer)
- **DM creates a session** and gets a 4-letter access code
- **Players join** via link or code from any device on the network
- **Real-time sync** — health, stress, status effects, and inventory update instantly
- **Secret messages** — DM sends private transmissions styled as MU/TH/UR communications
- **Player isolation** — players only see their own character sheet, never the DM's tools
- **Character death & reassignment** — DM can kill a character and assign a new one on the fly
- **Broadcast messages** — shipwide announcements to all crew

### Scenarios
- Full text of cinematic scenarios with act-by-act read-aloud sections
- **Text-to-Speech** narration with adjustable voice, rate, and pitch
- **Ambient audio** presets (ship hum, tension, alert, dread) via Web Audio API
- Colonial Marines campaign operations with extracted tactical maps

### Characters
- 15 pre-built characters across 4 scenarios
- Full stat blocks: attributes, skills, talents, gear, personal agendas
- Buddy/rival relationships, signature items

### Maps
- **SVG Map Engine** — a reusable, data-driven blueprint renderer for creating detailed deck plans
- USCSS Montero with 3 switchable decks (Personnel, Operations, Cargo)
- Thick-wall rendering, gap-style doors, corridor walls, hull exterior details
- Varied room shapes (rectangles, octagons, circles)
- Vent pathways with grate marks, structural interior hints
- Colonial Marines tactical maps extracted from sourcebook PDFs

### Dice Roller
- Base dice + stress dice with full ALIEN RPG panic mechanics
- Visual face results, automatic panic detection

### Reference
- Cheat sheets for combat, skills, difficulty levels, critical injuries
- Xenomorph stat blocks and behavior reference

---

## Quick Start

### Prerequisites

- **Node.js 18+** (tested on Node.js 22)
- **npm** (comes with Node.js)
- A local network if you want players to connect from other devices

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/Aliens-RPG-MUTHUR.git
cd Aliens-RPG-MUTHUR/web\ app
npm install
```

### Running the App

```bash
npm run dev
```

This starts two servers concurrently:

| Server | Port | Purpose |
|--------|------|---------|
| **Vite** (dev server) | `3000` | Serves the React app with hot-reload |
| **Socket.io** (game server) | `3002` | Handles real-time multiplayer sessions |

Open your browser to **`http://localhost:3000`**.

To access from other devices on your network (phones, tablets, player laptops), use your machine's local IP:

```
http://YOUR_LOCAL_IP:3000
```

You can find your local IP with `hostname -I` (Linux) or `ipconfig` (Windows).

### Production Build

```bash
npm run build    # Creates optimized build in dist/
npm start        # Starts the Express server serving the built app + WebSockets
```

In production mode, the Express server (port 3002) serves both the static files and handles WebSocket connections. Point your browser to `http://YOUR_IP:3002`.

---

## How to Use

### Starting a Game Session (DM)

1. Open the app in your browser
2. Click **"INITIATE SESSION — GAME MOTHER (DM)"**
3. A 4-letter access code is generated (e.g., `XKFM`)
4. Share the join link with your players: `http://YOUR_IP:3000/?join=XKFM`
5. The app switches to full DM mode with a **Session** tab

### DM Dashboard

The **Session** tab gives you:

- **Crew Status** — see all connected players, their health/stress bars, and status effects
- Click any player card to expand the management panel:
  - **Assign a character** from the pre-built pool
  - **Adjust health** (+1 / -1 / MAX) and **stress** (+1 / -1 / CLEAR)
  - **Add/remove status effects** (STRESSED, PANICKED, BLEEDING, BROKEN, etc.)
  - **Manage inventory** (add/remove items)
  - **View character sheet** summary (attributes, talent)
  - **Kill character** and assign a replacement from available characters
- **Transmissions** — send secret messages to individual players or broadcast to all
  - Priority levels: STANDARD, PRIORITY, EYES ONLY, EMERGENCY
- **Message Log** — full history of all transmissions

While managing a session, you still have access to all other tabs (Scenarios, Maps, Dice, etc.).

### Joining as a Player

1. Visit the link the DM shared (e.g., `http://192.168.1.100:3000/?join=XKFM`)
2. Enter your name and click **AUTHENTICATE**
3. Wait for the DM to assign you a character
4. Once assigned, you see your personal MU/TH/UR terminal with:
   - **Status** — health, stress, attributes, active conditions, talent
   - **Skills** — full skill list with attribute associations
   - **Inventory** — equipment with signature item highlighted
   - **Comms** — incoming transmissions from MU/TH/UR + ability to message back
   - **Dossier** — appearance, personal agenda, buddy/rival, signature item

Players **cannot** access scenarios, maps, DM tools, or other players' data.

---

## Map Engine

The SVG map engine is a reusable toolkit for generating detailed deck plans and blueprints. It's designed to be data-driven so you can create new maps by defining a configuration object.

### Architecture

```
src/components/MapEngine.jsx     — Core engine (primitives + wrapper)
src/data/mapDefinitions/montero.jsx — Example: USCSS Montero definition
src/components/MapRenderer.jsx   — Thin wrapper connecting engine + data
```

### Creating a New Map

1. **Create a definition file** in `src/data/mapDefinitions/`:

```jsx
// src/data/mapDefinitions/myship.jsx
import React from 'react';
import {
  Room, Door, Cor, ShaftRoom, Vents,
  useMapTheme, purl, pid, DEFAULTS,
} from '../../components/MapEngine';

// Define your hull shape (SVG path), or omit for stations/facilities
const HULL = `M 550 75 C 540 75, 500 97, ...  Z`;

// Define deck components using the engine's primitives
function MyDeckA() {
  const C = useMapTheme();
  return (
    <g>
      <Room x={460} y={165} w={120} h={55} label="BRIDGE"
        shape="octagon" icons={['terminal', 'intercom']} crew />
      <Cor x={539} y={220} w={22} h={5} />
      <Door x={550} y={220} v={false} />
      {/* ... more rooms, corridors, doors */}
    </g>
  );
}

// Export the config
export const myShipConfig = {
  width: 1100,
  height: 920,
  scenarioTag: 'MY SCENARIO',
  hull: {
    path: HULL,
    background: (C) => <g>{/* nacelles, nozzles */}</g>,
    overlays: (C) => <g>{/* seam lines */}</g>,
  },
  decks: [
    { id: 'A', name: 'COMMAND DECK', page: '1', component: MyDeckA },
  ],
  specs: {
    title: 'TECHNICAL SPECIFICATIONS',
    items: [['LENGTH', '200 METRES'], ['CLASS', 'My Ship Class']],
  },
  legend: 'default',
};
```

2. **Render it** with the engine:

```jsx
import MapEngine from './MapEngine';
import { myShipConfig } from '../data/mapDefinitions/myship';

export default function MyShipMap() {
  return <MapEngine config={myShipConfig} />;
}
```

### Engine Exports

| Export | Description |
|--------|------------|
| `MapEngine` (default) | Full map wrapper with background, frame, hull, deck tabs, legend, specs |
| `Room` | Room with thick walls, shape variants (`rect` / `octagon` / `circle`), crew floor tint, icons |
| `Door` | Gap-in-wall door with swing indicator marks |
| `Cor` | Corridor with visible wall edges and grating pattern |
| `ShaftRoom` | Vertical access point — `ladder`, `elevator`, or `airscrub` |
| `Vents` | Vent pathways (dashed lines) with grate marks at intersections |
| `DEFAULT_THEME` | Full color palette object |
| `createTheme(overrides)` | Merge custom colors with the default palette |
| `useMapTheme()` | React hook to access the active theme from inside deck components |
| `pid(name)` / `purl(name)` | Helpers for referencing engine SVG pattern/gradient IDs |
| `registerIcon(name, fn)` | Add custom icons to the icon registry |
| `MapLegend` | Standalone legend renderer |
| `MapSpecs` | Standalone technical specs renderer |
| `defaultLegendItems(C)` | Returns the standard legend item set |
| `DEFAULTS` | Configurable constants (wall thickness, shaft size, door length) |
| `seededRandom(seed)` | Deterministic random number generator |

### Room Shapes

```jsx
<Room shape="rect" />      // Rectangle (default), supports rx for rounded corners
<Room shape="octagon" />   // Octagonal
<Room shape="circle" />    // Ellipse
```

### Built-in Icons

`medkit`, `terminal`, `intercom`, `restricted`, `weapon`, `cryopod`

Add custom icons with:
```jsx
import { registerIcon } from './MapEngine';
registerIcon('reactor', (x, y, C) => (
  <circle cx={x} cy={y} r="3" fill="none" stroke={C.accent} strokeWidth="0.5" />
));
```

### Theming

Override any color in the palette:

```jsx
const redTheme = createTheme({
  accent: '#ff4444',
  hull: '#8a2a2a',
  hullOutline: '#cc4444',
});

// Pass as config:
{ theme: { accent: '#ff4444', hull: '#8a2a2a' } }
```

### Config Shape Reference

```js
{
  width: 1100,                          // SVG viewBox width
  height: 920,                          // SVG viewBox height
  theme: {},                            // Color overrides (optional)
  stars: { count: 200, seed: 1979 },    // Star-field background
  frame: true,                          // Border + corner marks
  scenarioTag: 'SCENARIO NAME',         // Rotated text on left edge
  hull: {                               // Ship hull (omit for non-ship maps)
    path: 'M...',                       //   SVG path data
    background: (C) => <g>...</g>,      //   Elements behind hull (nacelles)
    overlays: (C) => <g>...</g>,        //   Elements inside hull clip (seams)
  },
  exteriorDetails: (C) => <g>...</g>,   // Sensors, antenna (on top of hull)
  sidebar: (C, W, H) => <g>...</g>,     // Left sidebar content
  decks: [                              // Deck definitions
    { id: 'A', name: 'DECK NAME', page: '1', component: MyDeck },
  ],
  fixedOverlays: (C) => <g>...</g>,     // Elements on all decks (airlocks)
  specs: { title: '...', items: [...] },// Technical specifications
  legend: 'default',                    // 'default' or custom items array
}
```

---

## Project Structure

```
Aliens-RPG-MUTHUR/
├── README.md
├── .gitignore
├── map-references/              # Reference map images for future map creation
├── web app/
│   ├── package.json             # Dependencies and scripts
│   ├── vite.config.js           # Vite dev server + Socket.io proxy
│   ├── index.html               # HTML entry point
│   ├── server/
│   │   └── index.js             # Express + Socket.io game server
│   ├── public/
│   │   ├── Deck A–D.jpg         # USCSS Cronus deck images
│   │   └── maps/acm/            # Colonial Marines tactical maps
│   └── src/
│       ├── main.jsx             # React entry point
│       ├── App.jsx              # Root component with role-based routing
│       ├── index.css            # Global CRT terminal theme styles
│       ├── context/
│       │   └── GameContext.jsx   # Game state + Socket.io client management
│       ├── hooks/
│       │   ├── useTTS.js        # Text-to-speech for scenario narration
│       │   └── useAmbientAudio.js  # Procedural ambient sound generation
│       ├── components/
│       │   ├── Header.jsx       # MU/TH/UR terminal header
│       │   ├── Nav.jsx          # Navigation with session indicator
│       │   ├── SessionScreen.jsx   # Create / join game session
│       │   ├── DMDashboard.jsx  # DM player management panel
│       │   ├── PlayerView.jsx   # Player-only character terminal
│       │   ├── Scenarios.jsx    # Scenario browser with TTS
│       │   ├── Characters.jsx   # Character reference browser
│       │   ├── Maps.jsx         # Map viewer (SVG + images)
│       │   ├── MapEngine.jsx    # Reusable SVG map generation engine
│       │   ├── MapRenderer.jsx  # Montero map wrapper
│       │   ├── DiceRoller.jsx   # ALIEN RPG dice roller
│       │   ├── CheatSheets.jsx  # Quick-reference game rules
│       │   ├── Xenomorphs.jsx   # Xenomorph stat reference
│       │   └── AudioPanel.jsx   # Ambient audio controls
│       └── data/
│           ├── scenarios.js     # Scenario text and metadata
│           ├── characters.js    # Character stats and profiles
│           ├── maps.js          # Map metadata
│           └── mapDefinitions/
│               └── montero.jsx  # USCSS Montero SVG deck plan data
```

---

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| **React 19** | UI framework |
| **Vite 6** | Dev server and build tool |
| **Socket.io** | Real-time WebSocket communication |
| **Express** | HTTP server for production + WebSocket host |
| **Web Speech API** | Text-to-speech for scenario narration |
| **Web Audio API** | Procedural ambient sound generation |
| **SVG** | Scalable vector map rendering |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both Vite dev server (3000) and game server (3002) |
| `npm run dev:client` | Start only the Vite dev server |
| `npm run dev:server` | Start only the Socket.io game server |
| `npm run build` | Create production build in `dist/` |
| `npm start` | Run production server (serves built app + WebSockets) |

---

## Network Setup Tips

- The app is designed to run on a **local network** (home Wi-Fi, etc.)
- All devices must be on the **same network** to connect
- The DM's machine acts as the server — players connect to the DM's IP
- Find your local IP: `hostname -I` (Linux/Mac) or `ipconfig` (Windows)
- If you have firewall issues, ensure ports **3000** and **3002** are open
- For a single-machine setup, use `localhost` for DM and `127.0.0.1` for player tabs

---

## Legal Notice

This is a fan-made companion tool for the ALIEN RPG by Free League Publishing. It is not affiliated with or endorsed by Free League Publishing, 20th Century Studios, or the ALIEN franchise. The ALIEN RPG, its scenarios, characters, and game mechanics are the property of their respective copyright holders. This tool is intended for personal use to enhance tabletop gameplay sessions.

---

## License

MIT
