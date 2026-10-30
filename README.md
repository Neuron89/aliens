# MU/TH/UR — Tabletop RPG Game Terminal

![Node](https://img.shields.io/badge/node-18%2B-green) ![React](https://img.shields.io/badge/react-19-61dafb) ![Vite](https://img.shields.io/badge/vite-6-646cff) ![License](https://img.shields.io/badge/license-MIT-blue)

A real-time companion web app for running tabletop RPG sessions with a CRT-terminal aesthetic. The Game Master runs the session from a desktop
or tablet; players join from their phones with a 4-letter code and see only their own character, status and private transmissions.

The engine is **universe-agnostic**: each game system is a module in `web app/src/universes/<id>/` (theme, wording, rules, careers, dice, reference tabs),
and scenarios are **content packs**: validated JSON documents you can bundle, drop in a folder, import, generate with Claude, or have Claude Code write by hand.

## Universes

| Universe | Status | Rules |
|---|---|---|
| **ALIEN RPG** (`alien`) | Complete: 4 bundled cinematic scenarios, Colonial Marines operations, Montero deck plans | Year Zero Engine (base + stress dice) |
| **Dune** (`dune`) | In progress | 2d20 |

Adding another one: [`docs/ADDING_A_UNIVERSE.md`](docs/ADDING_A_UNIVERSE.md).

## Features

- **Game Night flow**: pick a universe, pick or generate a scenario, initialize a session, share a join link, play, pause, resume.
- **Live sessions** over Socket.io: DM dashboard with per-player tracks (health, stress... defined by the universe), status effects, inventory, character assignment, kill/replace.
- **Transmissions**: private and broadcast messages with universe-specific priorities; one-click **handouts** from the scenario pack.
- **Scenario library and runner**: acts with read-aloud (text-to-speech), scene-by-scene runner with checks, stress triggers, NPCs, threats, locations, endings, GM tips; ambient audio presets.
- **Characters**: pre-generated characters inside packs, plus an in-app creator driven by the universe's rules and careers.
- **Maps**: ASCII and image maps from packs, plus an SVG deck-plan engine for interactive ship maps.
- **Content packs**: schema-validated JSON, import/export in the UI, live runtime folder, validator and smoke scripts.
- **Scenario generation**: Claude-backed generator (API key) or the **`gamenight` Claude Code skill** (no key needed).
- **Per-universe theming**: palette, fonts, CRT effect, terminal name and wording change; layout stays the same.
- **Session persistence**: games are snapshotted to disk so a DM can resume after a restart (being implemented; see `docs/GAME_NIGHT.md`).

## Quick start

Requires Node.js 18+ (tested on current releases) and a local network if players use their own devices.

### Development

```bash
cd "web app"
npm install
npm run dev
```
Vite serves the UI on <http://localhost:3000> (hot reload) and the Node server runs on port 3002; Vite proxies `/api` and `/socket.io` to it.
Other devices use `http://<your-LAN-IP>:3000`.

### Deploy on this machine (Windows, background server)

```powershell
powershell -File scripts\deploy-local.ps1            # build, sync to ..\aliens-deploy, start on :3100
powershell -File scripts\deploy-local.ps1 -Port 3200
powershell -File scripts\deploy-local.ps1 -Stop
```
Prints the LAN URL when the server answers. Details, firewall notes and the full host runbook: [`docs/GAME_NIGHT.md`](docs/GAME_NIGHT.md).

### Production without the script

```bash
cd "web app" && npm run build && npm start      # serves dist/ + API + sockets on PORT (default 3002)
```

## Generator setup

The Claude-backed generator lives in `web app/server/generate.js` and `web app/server/generator/`. Put settings in `web app/.env` (git-ignored; loaded by `server/generator/env.js`;
real environment variables win). When using the deployed copy, create the `.env` in `..\aliens-deploy\web app\`.

```ini
ANTHROPIC_API_KEY=sk-ant-...
GENERATOR_MODEL=claude-opus-5-5     # default
GENERATOR_EFFORT=high               # default
GENERATOR_MAX_TOKENS=64000          # default
GENERATOR_FALLBACKS=1               # 0 disables the server-side-fallback beta
GENERATOR_MOCK=0                    # 1 = return a canned pack without calling the API (testing)
GENERATOR_MOCK_DELAY=350            # mock streaming delay in ms
```
Other server variables: `PORT` (default 3002; the deploy script sets 3100), `CONTENT_DIR` (runtime packs; default `web app/content`), `DATA_DIR` (session snapshots; default `web app/data`).
The API endpoint is `POST /api/generate` with `{ universeId, params }`; it returns a pack validated against the schema. Without a key the endpoint reports an error;
use the Claude Code skill instead. CLI: `node scripts/generate-pack.mjs --universe alien --players 4 ...` (run it with `--help` for the flags; the script is being added).

## Claude Code skill: write a scenario by hand

`.claude/skills/gamenight/SKILL.md` teaches a Claude Code session to author a complete, validated pack from parameters with no API key: it collects parameters
(universe, players, playtime, type, difficulty, tone, setting, threat, themes, avoid, lethality), reads the universe's rules, careers and tone guide, writes
`web app/content/<universe>/<id>.json`, validates it and tells you where it shows up. Open Claude Code in this repo and say
"set up a game night", "write a one-shot for alien" or "make characters for ...". Supporting files: `references/pack-skeleton.json` and `references/quality-checklist.md`.

## Documentation

| Doc | Purpose |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | The contract: universe interface, pack schema summary, sessions, generator, theming |
| [`docs/CONTENT_PACKS.md`](docs/CONTENT_PACKS.md) | Field-by-field pack guide, loading, import/export, validator, handouts |
| [`docs/ADDING_A_UNIVERSE.md`](docs/ADDING_A_UNIVERSE.md) | Step-by-step new universe, with checklist |
| [`docs/GAME_NIGHT.md`](docs/GAME_NIGHT.md) | Host runbook: deploy, DM flow, player flow, pause/resume, troubleshooting |

## Repository layout

```
.
├── ARCHITECTURE.md
├── README.md
├── docs/                         # guides (above)
├── .claude/skills/gamenight/     # Claude Code skill (SKILL.md + references/)
├── scripts/                      # repo-level tools (deploy, art)
├── map-references/               # reference images for map making
└── web app/
    ├── package.json  vite.config.js  index.html
    ├── content/                  # runtime packs: content/<universe>/<id>.json (git-ignored) + examples/
    ├── data/                     # session snapshots (git-ignored)
    ├── public/                   # images, deck plans, art
    ├── scripts/                  # validate-content.mjs, smoke.mjs, ...
    ├── server/                   # index.js, sessions.js, persistence.js, content.js, generate.js, generator/, schema/
    └── src/
        ├── engine/               # universe-agnostic UI, contexts, hooks
        └── universes/
            ├── index.js          # registry
            └── alien/            # universe.core.js, index.js, theme, terms, rules, careers, generator, reference/, components/, maps/, content/
```

## Scripts

| Command | What it does |
|---|---|
| `scripts/deploy-local.ps1 [-Port N] [-Stop]` | Build, sync to `..\aliens-deploy`, install prod deps, (re)start the background server (default port 3100) |
| `scripts/convert-art.py [--dry-run] [--keep] [--quality N] [--max-dim N] [--only TEXT]` | Convert PNG art and maps under `web app/public/art`, `web app/public/maps` and `map-references/` to WebP (needs Pillow; deletes the PNGs only after verifying all conversions, unless `--keep`) |
| `scripts/crop_art.py` | Crop per-item images out of full-page book scans using `scripts/crop_art_config.json` |
| `web app/scripts/validate-content.mjs` (`npm run validate`) | Validate bundled, runtime and example packs against the schema; exit 1 on failure |
| `web app/scripts/smoke.mjs` (`npm run smoke`) | Import each universe core in Node, assert the interface, validate all packs |
| `web app/scripts/generate-pack.mjs` | CLI scenario generator (needs `ANTHROPIC_API_KEY`; being added) |
| `npm run dev` / `dev:client` / `dev:server` | Vite + server, only Vite (:3000), only the server (:3002) |
| `npm run build` / `npm start` / `npm run preview` | Production build, run production server, preview the build |

## Content and legal

- **No copyrighted books are stored in this repository.** Source PDFs are git-ignored (`alien documents/`, `scenarios/**/*.pdf`). Do not commit them.
- Art and map images in `web app/public/` and `map-references/` were derived from sourcebooks the owner possesses; they are **for personal, private use at the owner's table** and must not be redistributed or published.
- Generated and hand-written packs invent their own proper nouns and prose; they must not reproduce sourcebook text.
- This is a fan-made companion tool. It is not affiliated with or endorsed by Free League Publishing, 20th Century Studios, Frank Herbert's estate, Legendary, Modiphius, or any other rights holder. ALIEN, Dune and related names, settings and mechanics belong to their respective owners.

## Credits

Built with React, Vite, Express, Socket.io, Ajv and the Anthropic SDK. ALIEN RPG by Free League Publishing (Year Zero Engine). Scenario packs and tooling by the project contributors; generated content by Claude.

## License

MIT (code). Game content is subject to the rights of its owners as described above.
