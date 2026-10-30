# MU/TH/UR — Tabletop RPG Game Terminal

![Node](https://img.shields.io/badge/node-18%2B-green) ![React](https://img.shields.io/badge/react-19-61dafb) ![Vite](https://img.shields.io/badge/vite-6-646cff) ![License](https://img.shields.io/badge/license-MIT-blue)

A multi-universe **game-master terminal** for in-person tabletop RPG sessions. One web app, three screens:

| Screen | Device | URL | What it is |
|---|---|---|---|
| **GM** | tablet or laptop | `/` | Scene runner, handouts, clues, clocks, rolls, initiative, token/fog map controller, session log |
| **TV (board)** | flat-lying TV on the table | `/?board=CODE` | Full-screen map with fog, tokens and pings, narration captions, clocks, roll toasts, pause card. No chrome, no input |
| **Player** | each player's phone | `/?join=CODE` | Own sheet and dice, private comms, handouts, clues, orders, a pause (X-card) button |

The engine is **universe-agnostic**: each game system is a module in `web app/src/universes/<id>/` (theme, wording, rules, careers, catalog, dice, maps,
reference tabs). Scenarios are **content packs**: schema-validated JSON you can bundle, drop in a folder, import, generate with Claude, or have Claude Code write by hand.
Wording in the docs is neutral ("GM"); each universe renames it in the UI (ALIEN: Game Mother, DUNE: Narrator).

It is an unofficial fan tool; see [Content and legal](#content-and-legal).

## Universes

| Universe | Id | Rules | Bundled packs | What it ships |
|---|---|---|---|---|
| **ALIEN RPG** | `alien` | Year Zero Engine (base + stress dice, push, panic) | **15** (7 Cinematic scenarios with pre-gens, 7 Colonial Marines operations, 1 Marine campaign frame) | Catalog mined from the Core Rule Book and Colonial Marines Operations Manual (careers, MOS, talents, weapons, armor, gear, conditions, injuries, panic table, creatures, rules); per-item art cropped from the books (`web app/public/art/alien-art-map.json`); the interactive USCSS Montero deck plan (51 rooms over decks A-C); CRT/scanline theme; Weapons, Vehicles, Xenomorphs and Cheat Sheets tabs |
| **DUNE** | `dune` | 2d20 (Momentum and Threat pools, Drives, Determination) | **4** one-shot scenarios (*Silence on the Erg*, *The Nine Days of Silence*, *The Water Debt*, *The Weighing of House Varrin*) | Hand-written catalog (archetypes, talents, weapons, armor, gear, conditions, injuries, creatures); generated art (archetypes, creatures, factions, gear, places, weapons; ComfyUI via `scripts/gen-dune-art.py`); engine maps (Qarrat Keep residency, sietch) plus image maps; paper-grain theme; Houses, Factions and Threats reference tabs and cheat sheets |

Adding another one: [`docs/ADDING_A_UNIVERSE.md`](docs/ADDING_A_UNIVERSE.md).

## Features

Full inventory with honest status (done / partial / not yet) mapped to the research backlog: [`docs/FEATURES.md`](docs/FEATURES.md). Highlights by role:

### GM (tablet)
- **Game Night flow**: universe landing page, pick or generate a scenario (GAME NIGHT wizard), optional **session zero** (tone, content warnings, lines and veils), initialize, share the code.
- **RUN view**: act switcher with progress, scene card (read-aloud, checks, events, stress triggers, NPC guidance, outcomes, GM tip, clues findable here), prev/next, DONE per scene.
  **Send to table** (caption on the TV and on phones, full-screen card, TTS), **map / theatre-of-mind** switch for the TV, **advance act** with private per-player orders.
- **Rail**: progress **clocks** (danger / racing / tug, public or GM-only), **agendas** (NPC "if ignored" cards, per-PC act agenda), **handouts** (push to chosen phones, seen receipts, image handouts to the TV), **clues** (reveal to some or all, found-by credit), **initiative**, **threat cards** (creature health, secret attack rolls), **session log** with Markdown **recap export**.
- **Roll feed**, secret creature attack rolls, **Panic** and **Supply** (ALIEN), **Momentum / Threat** (DUNE), critical injuries, status effects, inventory/loot, kill and replace.
- **Table board controller** ("Board" tab): map and level picker, fog by room with auto-reveal, token palette (crew, threats, NPCs, items, markers; art from the catalog), ROTATE / FLIP / ZOOM / AS TV / SNAP, pings, room editor for image maps, OPEN BOARD with QR.
- **Packs and characters**: library, import/export, character builder and sheets, per-universe reference tabs, ambient audio presets (scene `ambient` switches them).
- **Safety and trust**: 6-digit **GM PIN** takeover, seat claims the GM approves, anonymous pause, API token for write endpoints.

### TV (board)
- Map fitted to the screen with the chosen rotation/flip/zoom, room fog that dissolves when revealed, tokens only in revealed rooms (PCs always), per-player colour rings, status rings (panic, stress, hidden...), pings.
- Narration lower-third or full card, theatre-of-mind title/scene art, clock stack, roll and panic toasts, pool meters, supply strip (ALIEN), turn strip with a pulsing active token, PAUSE card.
- Screen wake lock, tap for fullscreen, hidden cursor, burn-in-safe idle drift and dimming, optional scene audio with `?board=CODE&audio=1`.

### Player (phone)
- Join with a code and a name; SHEET (tap **ROLL** on a skill), GEAR, COMMS (private replies), FILES (orders, handouts, clues found), MAP (revealed rooms, ping), DICE (the universe's roller: Year Zero or 2d20).
- **Build your own character** on the phone and submit it to the GM; session-zero card; **PAUSE** (X-card) button.
- Panic roll overlay, complication flash, Momentum chip, YOUR TURN banner, item-received toast, vibration and sounds, REDUCE FX and MUTE toggles.
- Reconnect-safe: offline queue for messages and rolls, CONNECTION LOST banner, seat kept across restarts.

## Quick start

Requires Node.js 18+ (tested on current releases). Players use their own devices on the same LAN.

### Development

```bash
cd "web app"
npm install
npm run dev
```
Vite serves the UI on <http://localhost:3000> (hot reload) and the Node server runs on :3002; Vite proxies `/api` and `/socket.io` to it (`API_TARGET` overrides the target).
Other devices use `http://<your-LAN-IP>:3000`.

### Local game night (Windows, background server)

```powershell
powershell -File scripts\deploy-local.ps1            # build, sync to ..\aliens-deploy, start on :3100
powershell -File scripts\deploy-local.ps1 -Port 3200
powershell -File scripts\deploy-local.ps1 -Stop
```
Prints `HTTP 200 -> http://localhost:3100 (LAN: http://192.168.x.y:3100)` when the server answers. Then:

1. GM opens `http://localhost:3100`, picks a universe, **INITIATE**, picks a scenario, **INITIALIZE**: you get a 4-letter code and a join link.
2. TV: open `http://<LAN IP>:3100/?board=CODE` (or **BOARD** tab, **OPEN BOARD**, scan the QR from the TV browser); tap once for fullscreen.
3. Phones: open `http://<LAN IP>:3100/?join=CODE` (or the host URL, JOIN, type the code).

The ordered host runbook (setup, session zero, play, pause/resume, ending, troubleshooting): [`docs/GAME_NIGHT.md`](docs/GAME_NIGHT.md).

### Production without the script

```bash
cd "web app" && npm run build && npm start      # serves dist/ + API + sockets on PORT (default 3002)
```

## Generator

Scenario generation lives in `web app/server/generate.js` and `web app/server/generator/` (`core.js`, `prompt.js`, `params.js`, `outputSchema.js`, `universes.js`, `env.js`, `__mock__.js`).
It streams a structured-output response from Claude, validates the result against the pack schema and returns the pack. Three ways to use it:

- **In the app**: Scenarios tab, **GAME NIGHT — GENERATE SCENARIO** (wizard: CREW, MISSION, GENERATE, PREVIEW; then save and start). `GET /api/generate/status` tells the UI whether the generator is configured.
- **CLI**: `node scripts/generate-pack.mjs --universe alien --players 4 --names "A,B,C,D" --playtime session --tone dread,betrayal --setting "..." --out content/alien/` (run from `web app/`). Flags: `--universe --players --names --playtime --type --tone --setting --threat --themes --avoid --difficulty --lethality --title --no-maps --out --dry-run [--json] --help`. `--dry-run` prints the request and an input-token estimate without calling the API.
- **Claude Code**: the `gamenight` skill (below), no API key.

Settings live in `web app/.env` (copy `web app/.env.example`; git-ignored; loaded by `server/generator/env.js`; real environment variables win). With the deployed copy, the deploy script copies the repo's `.env` over when it exists; otherwise create `..\aliens-deploy\web app\.env`.

```ini
ANTHROPIC_API_KEY=sk-ant-...
GENERATOR_MODEL=claude-opus-5-5     # default
GENERATOR_EFFORT=high               # low | medium | high | xhigh | max (default high)
```
**Mock mode**: `GENERATOR_MOCK=1` returns a mutated bundled pack without calling the API (UI testing; the status endpoint then reports configured). `GENERATOR_MOCK_DELAY` sets the streaming delay.
Without a key (and not in mock mode) `POST /api/generate` answers 400 `generator_not_configured` and the wizard shows setup instructions; use the Claude Code skill instead.

## Claude Code skill: `gamenight`

`.claude/skills/gamenight/SKILL.md` teaches a Claude Code session to author a complete, validated pack with no API key: it collects parameters (universe, players, playtime, type, difficulty, tone, setting, threat, themes, avoid, lethality),
reads the universe's rules, careers and tone guide, writes `web app/content/<universe>/<id>.json`, runs `node scripts/validate-content.mjs` and tells you where it shows up.
Open Claude Code in this repo and say "set up a game night", "write a one-shot for alien" or "make characters for ...". Supporting files: `.claude/skills/gamenight/references/pack-skeleton.json` and `quality-checklist.md`.

## Environment variables

Every variable the server reads (`grep process.env "web app/server"`). All are optional.

| Variable | Default | Read in | Meaning |
|---|---|---|---|
| `PORT` | `3002` (the deploy script sets `3100`) | `server/index.js` | HTTP + Socket.io port |
| `CONTENT_DIR` | `web app/content` | `server/content.js` | Runtime pack folder (`<CONTENT_DIR>/<universe>/<id>.json`) |
| `DATA_DIR` | `web app/data` | `server/persistence.js` | Session snapshots go to `<DATA_DIR>/sessions/<CODE>.json` |
| `MAX_GAMES` | `50` | `server/sessions.js` | Cap on live + dormant games per server |
| `SEAT_CLAIM_MS` | `120000` (min 500) | `server/sessions.js` | How long a seat claim waits for the GM |
| `API_TOKEN` | unset (open LAN) | `server/index.js` | When set, `PUT`/`DELETE /api/content/...` and `POST /api/generate` need header `x-api-token` |
| `ANTHROPIC_API_KEY` | unset | `server/generator/env.js` | Claude API key for the generator |
| `GENERATOR_MODEL` | `claude-opus-5-5` | `server/generator/env.js` | Model id |
| `GENERATOR_EFFORT` | `high` | `server/generator/env.js` | Reasoning effort |
| `GENERATOR_MAX_TOKENS` | `64000` | `server/generator/env.js` | Output budget per call |
| `GENERATOR_FALLBACKS` | on | `server/generator/env.js` | `0`/`false`/`no`/`off` disables the server-side refusal-fallback beta |
| `GENERATOR_MOCK` | off | `server/generator/env.js` | `1`/`true`/`yes`/`on`: canned pack, no API call |
| `GENERATOR_MOCK_DELAY` | `350` | `server/generator/env.js` | Mock stream delay in ms |
| `GENERATOR_MAX_CONCURRENT` | `2` | `server/generate.js` | Simultaneous generations |

Tooling-only variables (not read by the server): `API_TARGET` (Vite dev proxy target, `web app/vite.config.js`, default `http://localhost:3002`) and `COMFY` (ComfyUI URL for `scripts/gen-dune-art.py`, default `http://192.168.1.37:8188`).

## Scripts

Root `scripts/`:

| Script | What it does |
|---|---|
| `scripts/deploy-local.ps1 [-Port N] [-Stop]` | Build, mirror `dist/` and `server/` to `..\aliens-deploy\web app\`, copy new content packs and `.env`, `npm install --omit=dev`, (re)start the hidden background server (default port 3100, pid in `..\aliens-deploy\server.pid`) |
| `scripts/validate-catalog.mjs [universeId]` | Validate every `catalog/*.json`: unique ids, cross-references, skill/attribute keys, art files exist, required fields. Exit 1 on error |
| `scripts/extract-art.py extract\|build\|all [--pdf-dir DIR] [--book crb\|acm\|art] [--only ID ...]` | Art pipeline for ALIEN: extract embedded images from your own sourcebook PDFs, then build per-item WebP files from `scripts/art-selection.json` and write `web app/public/art/alien-art-map.json` (needs PyMuPDF/Pillow; the PDF folder is outside the repo) |
| `scripts/gen-alien-art.py [--only ID ...] [--force] [--seed N]` | Generate stand-in item art (entries marked `generated` in `art-selection.json`) through ComfyUI, then run `extract-art.py build` |
| `scripts/gen-dune-art.py [--list] [--only TEXT] [--force] [--model zimage\|flux] [--seed N]` | Generate the DUNE art set from the catalog through ComfyUI into `web app/public/art/dune/` |
| `scripts/convert-art.py [--dry-run] [--keep] [--quality N] [--max-dim N] [--only TEXT]` | Convert PNG art and maps under `web app/public/art`, `web app/public/maps` and `map-references/` to WebP (Pillow; deletes PNGs only after verifying, unless `--keep`) |
| `scripts/art-selection.json` | Data file for the art pipeline (item id to source image, crop, or generation prompt) |

`web app/scripts/` (run from `web app/`):

| Script | What it does |
|---|---|
| `scripts/validate-content.mjs` (`npm run validate`) | Validate bundled, runtime and example packs against the schema; exit 1 on failure |
| `scripts/smoke.mjs` (`npm run smoke`) | Import each universe core in Node, assert the interface, catalog and mechanics helpers, validate all packs |
| `scripts/check-art.mjs` | Assert every `/art/...` path referenced from `src/**` and `alien-art-map.json` exists under `public/` |
| `scripts/generate-pack.mjs` | CLI scenario generator (see Generator) |
| `scripts/test-sessions.mjs` | Persistence regression: restart the server, resume as GM, rejoin players |
| `scripts/test-session-features.mjs` | Narration, handouts and receipts, clues, clocks, pause, session zero, log, agendas, dedupe |
| `scripts/test-mechanics.mjs` | Roll feed, panic, supplies, pools, initiative, creature health, injuries |
| `scripts/test-board.mjs` | Fog filtering, auto-reveal, pings, board persistence across a restart |
| `scripts/test-hardening.mjs` | Garbage payloads, PIN takeover, seat claims, role detach, prototype ids, caps, `API_TOKEN` |

The `test-*` scripts spawn the server on a random port with a temp `DATA_DIR`. `npm` scripts: `dev` (Vite + server), `dev:client` (Vite :3000), `dev:server` (server :3002), `build`, `start`, `preview`, `validate`, `smoke`.

## Security notes

The app assumes a **trusted LAN** (a home table). It has no accounts and no TLS.

- **Join codes** are 4 letters; anyone who can reach the server and knows a code can take a new seat (max 40 seats; duplicate names refused).
- **GM identity**: the GM's browser holds a `dmToken`. If that terminal dies, another one can **TAKE OVER** with the code and the game's **6-digit GM PIN** (shown once at creation, then behind SHOW PIN). A takeover rotates the token; 5 wrong PINs lock that game's PIN for 60 s. Never share the PIN with players.
- **Seat claims**: a player who lost their device re-enters by name; that is a request the GM approves or rejects (APPROVE moves the seat, character and private messages to the new device). Phones normally re-attach silently with a private seat token.
- **`API_TOKEN`**: when set, writing packs and generating (the paid call) need the token; enter it in the session screen ADVANCED fold. Reads stay open so phones and the TV can load packs. Unset = open to the LAN.
- **TV** attaches with the code only and never receives sheets, messages, hidden tokens, GM notes, GM-only clocks or who pressed pause.
- **Server limits**: message text 4000 chars, character 64 KB, roll 4 KB, `MAX_GAMES` games, hardened event handlers (`docs/REVIEW_2026-10-30.md`).
- Do not expose the port to the internet. If you must, put it behind a VPN and set `API_TOKEN`.

## Documentation

| Doc | Purpose |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | The contract: universe interface, pack schema summary, sessions and socket events, generator, theming |
| [`docs/GAME_NIGHT.md`](docs/GAME_NIGHT.md) | Host runbook for an evening: setup, session zero, play, pause/resume, recap, troubleshooting |
| [`docs/FEATURES.md`](docs/FEATURES.md) | Implemented feature inventory against the research backlog |
| [`docs/CONTENT_PACKS.md`](docs/CONTENT_PACKS.md) | Field-by-field pack guide, loading, import/export, validator |
| [`docs/ADDING_A_UNIVERSE.md`](docs/ADDING_A_UNIVERSE.md) | Step-by-step new universe, with checklist |
| [`docs/BOARD_AND_BUILDER.md`](docs/BOARD_AND_BUILDER.md) | Table board, map controller, map definitions, character builder |
| [`docs/RESEARCH_GM_PLAYER_EXPERIENCE.md`](docs/RESEARCH_GM_PLAYER_EXPERIENCE.md) | Research and the feature backlog |
| [`docs/REVIEW_2026-10-30.md`](docs/REVIEW_2026-10-30.md) | Correctness and security review and its fixes |
| [`web app/src/universes/alien/catalog/README.md`](web%20app/src/universes/alien/catalog/README.md) | ALIEN catalog contents, extraction notes and fidelity caveats |

## Repository layout

```
.
├── ARCHITECTURE.md  README.md
├── docs/                         # guides (above)
├── .claude/skills/gamenight/     # Claude Code skill (SKILL.md + references/)
├── scripts/                      # deploy, art pipeline, catalog validator
├── map-references/               # reference images for map making
├── alien documents/              # local only: sourcebook PDFs are git-ignored
└── web app/
    ├── package.json  vite.config.js  index.html  .env.example
    ├── content/                  # runtime packs: content/<universe>/<id>.json (git-ignored) + examples/
    ├── data/                     # session snapshots (git-ignored)
    ├── public/                   # art/ (alien-art-map.json, alien + dune art), maps/, deck plans
    ├── scripts/                  # validate-content, smoke, check-art, generate-pack, test-*
    ├── server/                   # index, sessions, board, mechanics, sessionLog, persistence, guard, content, generate, generator/, schema/
    └── src/
        ├── engine/               # universe-agnostic UI: contexts, hooks, components/{run,player,board,builder,wizard,fx,sheet}
        └── universes/
            ├── index.js          # registry { alien, dune }
            ├── alien/            # universe.core.js, index.js, theme, terms, rules, careers, generator, catalog/, reference/, components/, maps/, content/ (15 packs)
            └── dune/             # same shape (4 packs)
```

## Content and legal

- **No copyrighted books are stored in this repository.** Source PDFs are git-ignored (`alien documents/*.pdf`, `scenarios/**/*.pdf`; the art pipeline reads them from a folder outside the repo). Do not commit them.
- ALIEN art in `web app/public/art/` and the maps in `web app/public/maps/` and `map-references/` were derived from sourcebooks the owner possesses. They are **for personal, private use at the owner's table** and must not be redistributed or published.
- DUNE art is **generated** with a local ComfyUI server (`scripts/gen-dune-art.py`) and is not taken from any book or film.
- Catalog text is paraphrased; names and numbers are transcribed. Generated and hand-written packs invent their own proper nouns and prose and must not reproduce sourcebook text.
- This is a fan-made companion tool. It is not affiliated with or endorsed by Free League Publishing, 20th Century Studios, Modiphius Entertainment, the estate of Frank Herbert, Legendary, or any other rights holder. ALIEN, Dune and related names, settings and mechanics belong to their respective owners.

## Credits

ALIEN RPG by Free League Publishing (Year Zero Engine). Dune: Adventures in the Imperium by Modiphius Entertainment (2d20), set in the universe created by Frank Herbert.
Built with React, Vite, Express, Socket.io, Ajv and the Anthropic SDK. Scenario packs and tooling by the project contributors; generated content by Claude.

## License

MIT (code). Game content is subject to the rights of its owners as described above.
