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
| `kind` | yes | enum | `scenario`, `campaign` (both need >= 1 act) or `characters` (acts optional). |
| `meta` | yes | object | Catalogue info (below). |
| `briefing` | no | object | In-world opening message. |
| `acts` | cond. | array | See Acts. |
| `npcs`, `threats`, `keyLocations`, `handouts`, `maps`, `endings`, `characters`, `tips` | no | arrays | See below. |

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
  "scenes": [ ... ] }
```
- `readAloud`: 2-6 paragraphs per the schema (house standard 3-6). The Scenarios tab can read these via text-to-speech, so keep them pure narration.
- `scenes[]` feed the **scene runner** (`ScenarioPlayer`): `name` (required), `mandatory`, `encounter`, `encounterDetail`, `narration`, `checks[]`, `events[]`, `stressTriggers[]`, `npcGuidance`, `gmTip`, `outcomes[]`.
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
  "when": "Act I, after the crate is found" }
```
Required: `id` (kebab-case, unique in the pack), `title`, `text`. `priority` should be one of the universe's `terms.priorities`
(ALIEN: STANDARD, PRIORITY, EYES ONLY, EMERGENCY).

### How handouts become in-session transmissions

In the DM's Scenarios tab, the **HANDOUTS** panel lists each handout with its `from/to/priority` and the `when` cue. During a live
session the DM picks a target (all players = broadcast, or one player) and presses **SEND AS TRANSMISSION** (the label comes from
`terms.message`). The engine builds the message text as `TITLE`, `FROM: ...`, `TO: ...`, blank line, then `text`, and sends it with the
handout's `priority` (falling back to the first universe priority when the handout's value is not a known one). It shows on the player's phone
Comms tab and in the DM message log like any other transmission. Outside a session the buttons are disabled. `to` is informational: the DM still chooses the target.

## maps[]

Required: `id` (kebab-case), `title`, `kind`. `kind: "ascii"` requires `ascii` (monospace, <= ~70 columns, box-drawing characters);
`kind: "image"` requires `src` (URL path such as `/maps/acm/talos-station.png`, served from `web app/public/`). Optional `subtitle`,
`description`, `rooms[{name, note}]` and `engine`: the id of an interactive MapEngine deck plan registered by the universe
(ALIEN: `uscss-montero`). The Maps tab shows pack maps plus the universe's own maps.

## endings[], tips[]

`endings[]`: `{ title, condition, text }` all required; `text` is read-aloud epilogue, 60-200 words. `tips[]`: strings of GM advice.

## characters[]

Required: `id`, `name`, `career`, `appearance`, `attributes`, `skills`, `talent`, `gear[]`, `signatureItem`, `personalAgenda`, `buddy`, `rival`.
Optional: `agendaByAct` (keys `"1"`..`"99"`), `secret`, `health`.

- `attributes` and `skills` are keyed by the universe's keys (`web app/src/universes/<id>/rules.js`). The schema does not check the keys; `scripts/smoke.mjs` does, for bundled packs only.
- `skills` should list every skill (0 for untrained).
- `health` is informational: the engine recomputes it with `universe.rules.derived.health(char)` when a character is assigned. Omit it.
- `agendaByAct` is listed on the character sheet (CharacterSheet.jsx); the engine does not push it automatically when the act changes, so the DM sends the new act's agenda as a private transmission (author a matching handout with a `when` cue). Escalate toward betrayal.
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

`generate` (`POST /api/generate`) returns a validated pack when the generator is installed; see the README.

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
