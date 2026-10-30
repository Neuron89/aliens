# Content packs

A content pack is one JSON document: a scenario (or campaign frame, or a roster of characters) plus
everything a game master needs at the table. Packs are data, not code. The schema is the source of truth:

`web app/server/schema/content-pack.schema.json` (JSON Schema draft 2020-12, validated with ajv in
`web app/server/schema/validate.js`). `ARCHITECTURE.md` summarises it; if the two disagree, the schema wins.

Almost every object is `additionalProperties: false`, so unknown keys are rejected. The only open maps are
`attributes`, `skills`, `stats` (NPCs and threats) and `meta.generated.params`.

A minimal valid pack to copy lives at `.claude/skills/gamenight/references/pack-skeleton.json`; a small real one at
`web app/content/examples/example-cold-storage.json`; full ones in `web app/src/universes/alien/content/`.

## Top level

| Key | Req | Type | Notes |
|---|---|---|---|
| `packVersion` | yes | `1` | Always the integer 1. |
| `id` | yes | string | kebab-case (`^[a-z0-9]+(-[a-z0-9]+)*$`), 3-64 chars, unique per universe. **The file must be named `<id>.json`.** |
| `universe` | yes | string | Registry id (`alien`, `dune`...). Must equal the folder the file lives in. |
| `kind` | yes | enum | `scenario`, `campaign` (both need >= 1 act), `characters` (acts optional) or `maps` (a map overlay pack with id `<packId>-maps`, written by the room editor for bundled packs; its `maps[]` merge into `<packId>` by map id and it is not listed as a pack). |
| `meta` | yes | object | Catalogue info (below). |
| `briefing` | no | object | In-world opening message. |
| `acts` | cond. | array | See Acts. |
| `npcs`, `threats`, `keyLocations`, `handouts`, `clues`, `clocks`, `maps`, `endings`, `characters`, `tips` | no | arrays | See below. |

## meta

```json
"meta": {
  "title": "Cold Storage", "tagline": "A routine cargo inspection. The freezers are warm.",
  "synopsis": "GM-facing, 60-150 words, spoilers allowed.",
  "type": "One-Shot", "players": "2-3", "playtime": "1-2 hours", "difficulty": "Introductory",
  "tone": ["dread", "claustrophobia"], "contentWarnings": ["body horror"],
  "source": "custom"
}
```
- Required: `title` (<= 80 chars; 2-6 words, title case) and `tagline` (<= 240 chars; 8-25 words).
- `type`: `Cinematic` (one-shot with pre-gens, agendas, expected deaths), `Campaign`, `One-Shot`. The library groups by it.
- `players`, `playtime`, `difficulty`: free strings shown on the library card.
- `tone`, `contentWarnings`: lowercase strings; warnings are shown to the DM before play, so be honest.
- `source`: `bundled` (ships in the app source), `custom` (hand-written or imported), `generated` (produced by the generator or Claude Code). The server rewrites `bundled` to `custom` on save; the validator requires `bundled` for packs under `src/universes/*/content/`.
- `generated`: provenance, `{ by, model, at, params }`. `at` is a `date-time`. `params` is an open map of the parameters used.

## briefing

`{ from, to, classification, text }`; only `text` is required. 120-350 words, 3-7 short paragraphs separated by `\n\n`,
written in the universe's terminal voice, signed off. Shown to players before Act I.

## acts[]

Only `title` is required. Typical act:

```json
{ "title": "ACT I", "subtitle": "HOPE", "summary": "GM one-liner",
  "readAloud": ["Second-person, present tense, 40-120 words.", "..."],
  "gmNotes": "Private guidance.", "agendaNotes": "How personal agendas move this act.",
  "sceneArt": "/art/scenes/pad-b.webp",
  "scenes": [ ... ] }
```
- `sceneArt` (optional): a site path (served from `web app/public/`) or an `https://` URL. In **THEATRE** mode the TV shows it full-bleed behind the act and scene title while this act runs.
- `readAloud`: 2-6 paragraphs per the schema (house standard 3-6). The Scenarios tab can read these via text-to-speech, so keep them pure narration.
- `scenes[]` feed the **scene runner** (`ScenarioPlayer`) and the GM **RUN** view: `name` (required), `mandatory`, `encounter`, `encounterDetail`, `narration`, `checks[]`, `events[]`, `stressTriggers[]`, `npcGuidance`, `gmTip`, `outcomes[]`, plus:
  - `clueRefs[]`: ids of entries in the pack's `clues[]` that can be found here; the RUN scene card lists them with a one-tap reveal.
  - `ambient`: a universe audio preset id (ALIEN: `ship-hum`, `tension`, `alert`, `dread`, `space`; DUNE: `wind`, `bazaar`, `sietch`, `court`) or a site path to an audio file. Moving to the scene switches the GM's AudioPanel (and the TV when opened with `&audio=1`).
- Check strings: `"OBSERVATION — notice the elongated forearms"` or `"PILOTING at −2 — avoid collision"`; use the universe's skill names in upper case.
- Stress strings: `"STRESS +1 — all PCs present"`, `"IMMEDIATE PANIC ROLL — witnesses"`.

## npcs[], threats[], keyLocations[]

```json
{ "name": "Okafor", "role": "Barge Loadmaster", "agenda": "Get off alive.", "behavior": "Friendly, desperate.", "secret": "Took a bribe.", "stats": { "health": 4 } }
{ "name": "Facehugger", "ref": "facehugger", "description": "...", "tactics": "...", "stats": { } }
{ "name": "Kestrel Nine — Holds A–D", "description": "20-60 words, sensory and gameable." }
```
NPCs require `name`, `role`, `agenda`, `behavior`. Threats require `name`; `ref` is a bestiary id of the universe
(ALIEN: see `web app/src/universes/alien/reference/bestiary.js`, e.g. `drone`, `facehugger`, `adult-neomorph`) and shows a "REF" tag
so the GM can open full stats. Locations require `name` and `description`.

## handouts[]

```json
{ "id": "company-claim", "title": "COMPANY CARGO CLAIM", "from": "WEYLAND-YUTANI — SPECIAL PROJECTS",
  "to": "BOARDING TEAM", "priority": "PRIORITY", "text": "...teletype body, 20-200 words...",
  "when": "Act I, after the crate is found", "image": "/art/handouts/manifest.webp" }
```
Required: `id` (kebab-case, unique in the pack), `title`, `text`. `image` (optional): a site path or `https://` URL shown with the handout on the phone, and full-bleed on the TV when the GM presses **SHOW ON TV** in the RUN handouts tab. `priority` should be one of the universe's `terms.priorities`
(ALIEN: STANDARD, PRIORITY, EYES ONLY, EMERGENCY).

### How handouts reach players

In the GM **RUN** view (rail tab **HANDOUTS**) and in the Scenarios tab, each handout shows its `from/to/priority` and the `when` cue. During a live session the GM presses **PUSH TO PHONES** and chooses everyone or specific players
(socket `handout-send`). Players get a sealed card ("TAP TO OPEN"); opening it counts as seen (`handout-seen`) and the GM sees receipts such as "SEEN 2/4". Handouts can be re-opened from the phone's **FILES** tab; re-sending widens the recipient list and keeps receipts.
The `priority` is shown on the card; it should be one of the universe's `terms.priorities` (ALIEN: STANDARD, PRIORITY, EYES ONLY, EMERGENCY; DUNE: ROUTINE, URGENT, SEALED, IMPERIAL). `to` is informational: the GM chooses the recipients. Outside a session the buttons are disabled.
Bundled packs live only in the client, so the GM's browser sends the resolved handout with its pack id.

## clues[]

Secrets and clues the GM can reveal with one tap (Three Clue Rule: give every important conclusion at least three clues). 0-12 per scenario.

```json
{ "id": "maintenance-log", "text": "Abram logged the reactor purge three hours before the alarm.", "source": "Abram's maintenance log", "scene": "Engine Room", "status": "hidden" }
```
Required: `id` (kebab-case, unique in the pack) and `text` (one or two sentences, what the players learn, no rules text). Optional: `source` (where or from whom), `scene` (the scene most likely to hold it; scenes can also list it in `clueRefs`),
`status` (`hidden` default, or `revealed` for something known from the start). At session start the RUN view seeds `clues[]` into the session once (`session-seed`; later GM edits stay). The GM reveals a clue to all or chosen players, who are credited as finders; players see revealed clues under **FILES**.

## clocks[]

Progress clocks the GM ticks during play. 0-6 per scenario.

```json
{ "id": "reactor-meltdown", "label": "REACTOR MELTDOWN", "segments": 6, "filled": 1, "kind": "danger", "visibility": "all", "note": "At 6 the reactor breaches Deck C." }
```
Required: `id`, `label` (short upper-case), `segments` (2-12; 4 soon, 6 a while, 8 long haul). Optional: `filled` (0-12, default 0), `kind` (`danger` strikes when full, `racing` is the players' progress racing a danger, `tug` moves both ways), `visibility` (`all` = TV and phones, `gm` = GM only),
`note` (what happens when it fills; GM-facing). Seeded into the session once, like clues. Clocks are not attached to scenes: the GM ticks them from the RUN rail.

## maps[]

Required: `id` (kebab-case), `title`, `kind`: `ascii` (requires `ascii`: monospace, <= ~70 columns, box-drawing characters), `image` (requires `src`: a URL path such as `/maps/acm/talos-station.webp`, served from `web app/public/`) or `engine` (requires `engine`: the id of an interactive MapEngine deck plan registered by the universe, ALIEN: `uscss-montero`).
Optional descriptive fields: `subtitle`, `description`, `ascii`, `src`, `engine` (also allowed on `image`/`ascii` maps: the GM screen then offers the interactive plan alongside).

The same object drives the **table board** (fog, tokens, controller). All coordinates are **normalized 0..1** of the map's width and height. Optional board fields:

| Field | Meaning |
|---|---|
| `size` | `[width, height]` px of the source (image natural size); rooms stay normalized |
| `levels[]` | `{ id, label, src?, engine? }`: decks or floors (`id` kebab-case); rooms and tokens carry a level id; `src`/`engine` give a per-level image or engine deck |
| `rooms[]` | `{ name, id?, note?, level?, shape? }`. `name` is required; `id` (kebab-case, unique in the map) is **needed for fog**; `note` is 1-3 sentences of GM info (never sent to the table); `level` is a level id; `shape` is `{ type: "rect", x, y, w, h }` or `{ type: "poly", points: [[x,y], ...] }` (3+ points). Named rooms without `shape` are "unplaced": the Room Editor (EDIT ROOMS) can draw them |
| `doors[]` | `{ from, to, locked? }` room ids |
| `spawn` | `{ pc: [x, y], levels?: { "<levelId>": { pc: [x, y] } } }`: where PC tokens drop |
| `grid` | cell size as a fraction of the map width (token size 1 = one cell); default 1/40 |
| `outline` | SVG path string in normalized coordinates (hull); the board dims everything outside it |
| `crop` | `{ x, y, w, h }` normalized region the board fits to the screen |

Universe maps (`src/universes/<id>/maps/index.js`, not packs) may also carry `levelNoun` (`DECK`, `LEVEL`, `FLOOR`: the word for a level), `backdrop` (`space`, `sand`, `none`) and `palette` (partial override of the universe's `theme.board`); the pack schema's `maps[]` does not accept those three, so a pack map with the same id or `engine` inherits them (`board/mapDefs.js`).
A pack map whose `engine` names a universe engine map uses that map's rooms, levels and outline. Details and the socket events: `docs/BOARD_AND_BUILDER.md`. The Maps tab shows pack maps plus the universe's own maps.

## endings[], tips[]

`endings[]`: `{ title, condition, text }` all required; `text` is read-aloud epilogue, 60-200 words. `tips[]`: strings of GM advice.

## characters[]

Required: `id`, `name`, `career`, `appearance`, `attributes`, `skills`, `talent`, `gear[]`, `signatureItem`, `personalAgenda`, `buddy`, `rival`.
Optional: `agendaByAct` (keys `"1"`..`"99"`), `secret`, `health`, `driveStatements`.

- `attributes` and `skills` are keyed by the universe's keys (`web app/src/universes/<id>/rules.js`). The schema does not check the keys; `scripts/smoke.mjs` does, for bundled packs only.
- `skills` should list every skill (0 for untrained).
- `health` is informational: the engine recomputes it with `universe.rules.derived.health(char)` when a character is assigned. Omit it.
- `agendaByAct` is listed on the character sheet (CharacterSheet.jsx) and **pushed to each assigned player as a private NEW ORDERS card when the GM presses ADVANCE ACT** in the RUN view (moving to act N reads key `"N"`, counting from 1; SEND AGENDA CARDS re-sends the current act's). Escalate toward betrayal.
- `driveStatements` (optional): `{ "<attributeKey>": "one sentence in the character's voice" }`, keyed by the universe's attribute keys (DUNE drives: `duty`, `faith`, `justice`, `power`, `truth`). Players write them in the character builder; the sheet shows them. Pre-gens may include a few.
- Characters made in the in-app creator are saved to a runtime pack with id `custom-characters`, `kind: "characters"`.

## Bundled vs runtime vs generated

| Origin | Where it lives | Loaded by | Editable in UI |
|---|---|---|---|
| **Bundled** | `web app/src/universes/<id>/content/*.json` | `import.meta.glob` at build time, inside the client bundle | No (read-only, `meta.source: "bundled"`) |
| **Runtime** | `web app/content/<universe>/<id>.json` | `GET /api/content/:universe` (reads the folder on every request) | Yes (import, delete) |
| **Generated** | Same folder as runtime, `meta.source: "generated"` | Same as runtime | Yes |
| **Example** | `web app/content/examples/` | Never loaded by the app; only the validator reads it | n/a |

The active universe's list is bundled plus runtime; a runtime pack with the same `id` **overrides** the bundled one. Runtime folders are
git-ignored (`content/*/`), except `examples/`. The server directory can be moved with the `CONTENT_DIR` environment variable. Invalid or
mismatched runtime files are skipped with a console warning rather than breaking the library.

Runtime packs are read live, so dropping a file in `content/<universe>/` makes it visible on the next library load (reload the page).
The deployed copy (`scripts/deploy-local.ps1`) has its own `content/` folder under `..\aliens-deploy\web app\`; the script copies **new** pack
files from the repo (robocopy `/XO`, never deleting) so packs saved in the deployed app are kept.

### REST API (`web app/server/content.js`)

| Method | Path | Result |
|---|---|---|
| GET | `/api/content` | `{ universes: [...] }` with runtime packs |
| GET | `/api/content/:universe` | `{ universe, source: "runtime", packs: [...] }` |
| GET | `/api/content/:universe/:id` | one pack |
| PUT | `/api/content/:universe/:id` | validate and write; 422 `{ error, errors[] }` on failure |
| DELETE | `/api/content/:universe/:id` | remove |

`POST /api/generate` returns a validated pack (and `GET /api/generate/status` reports whether the generator is configured); see the README. With `API_TOKEN` set, `PUT`/`DELETE` and `POST /api/generate` need the `x-api-token` header.

## Import / export in the UI

Scenarios tab, **IMPORT PACK** (`PackImportExport.jsx`): paste JSON or choose a file. The client first runs a light check
(`quickCheckPack`: packVersion, id, universe equals the active universe, kind, title/tagline, at least one act for scenarios), warns before
overwriting an existing id (including a bundled one, which is then overridden), and saves through the server, which runs the full schema
validation and shows up to a dozen error lines. On import `meta.source` becomes `custom` unless the pack says `generated`. Each library card has
an **EXPORT** button that downloads `<id>.json`, so a scenario can be shared between hosts.

## Validator

```bash
cd "web app"
node scripts/validate-content.mjs      # or: npm run validate
```
It checks every `src/universes/<u>/content/*.json` (bundled), `content/<u>/*.json` (runtime) and `content/examples/*.json`. Beyond the schema it checks:
universe equals the folder (not for examples), file name equals `<id>.json`, bundled packs carry `meta.source: "bundled"`, and no duplicate ids per origin and universe.
It exits 1 on any failure. `node scripts/smoke.mjs` (`npm run smoke`) runs it as part of a wider check.
