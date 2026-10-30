# Adding a universe

Everything universe-specific lives in `web app/src/universes/<id>/`. Shared components under `web app/src/engine/`
must never hard-code a game's wording, colours, skills or dice. This guide walks through creating a new universe
by copying the ALIEN module (`web app/src/universes/alien/`). `ARCHITECTURE.md` is the contract; read its
"Universe module interface" section first.

All paths below are relative to `web app/` unless stated.

## 1. Files to create

```
src/universes/<id>/
  universe.core.js     JSX-free core. Node-importable. REQUIRED.
  index.js             The universe module: core + React parts + bundled packs. REQUIRED.
  theme.js             CSS variables, fonts, CRT flag
  terms.js             terminal identity + wording
  rules.js             attributes, skills, tracks, derived stats, dice kind, creation budget
  careers.js           careers (archetypes) and the gear pick-list
  generator.js         system prompt + defaults + parameter hints for scenario generation
  catalog/*.json       character-builder / sheet / board data: careers talents weapons armor gear conditions injuries creatures rules (+ panic for a Year Zero game). REQUIRED (smoke asserts every key)
  maps/index.js        data-only universe maps (may be an empty array); geometry modules (e.g. montero.geometry.js) stay JSX-free
  reference/*.js       optional: bestiary/weapons data (bestiary ids are valid `threats[].ref`)
  components/*.jsx     optional: dice Roller, reference tabs (JSX lives only here, in maps/*.jsx and in index.js)
  content/*.json       bundled content packs (optional; none required)
```

Start with `cp -r src/universes/alien src/universes/<id>`, then strip ALIEN specifics file by file.

## 2. The core / index split rule

- `universe.core.js` default-exports `{ id, name, tagline, terminal, theme, terms, rules, careers, gear, maps, generator, catalog }` and may import only plain JS and JSON
  (no React, no JSX, no `import.meta.glob`, no `.jsx` files, no CSS). JSON is imported with `import x from './catalog/x.json' with { type: 'json' }`; `catalog` is `{ careers, talents, weapons, armor, gear, conditions, injuries, creatures, rules }` (plus `panic`). `scripts/smoke.mjs` and the server-side generator
  (`server/generator/universes.js`) import it in plain Node, so a stray JSX import breaks both.
- `index.js` does `import core from './universe.core.js'` and returns
  `{ ...core, rules: { ...core.rules, dice: { ...core.rules.dice, Roller } }, navSections, maps: core.maps.map(attach engine components), content: { packs } }`.
  It is the only place that may use `import.meta.glob('./content/*.json', { eager: true, import: 'default' })`.
  Smoke asserts `index.js` mentions `navSections`, `Roller` and `import.meta.glob`.
- Because `index.js` is a superset of core, anything the engine reads from the universe must exist in core (or be added in `index.js`).

## 3. Interface keys and who consumes them

| Key | Type | Consumed by |
|---|---|---|
| `id` | string, equals the folder name | registry, content loader, `?join` flow, smoke |
| `name` | string | UniverseSelect cards, page title, DM/player headers |
| `tagline` | string | UniverseSelect, SessionScreen, ScenarioLibrary/Detail/Player, generator prompt |
| `terminal` | `{ name, subtitle, statusLines[] }` | Header, UniverseSelect, BootOverlay, DMDashboard, PlayerView, generator prompt |
| `theme.vars` | `{ '--css-var': value }` (list below) | `UniverseContext` sets each on `:root` |
| `theme.fonts` | `{ display, mono, googleCss }` | `UniverseContext` swaps `<link id="universe-fonts">` |
| `theme.crt` | boolean | toggles the `crt` class on `<html>` (scanline overlay) |
| `terms` | `{ gm, gmShort, player, players, session, message, broadcast, joinPrompt, priorities[] }` | SessionScreen, Nav, DMDashboard, PlayerView, ScenarioPanels (handout send), ScenarioDetail; `priorities` also drives the handout/priority dropdowns |
| `rules.attributes` | `[{ key, label, short }]` | CharacterSheet, CharacterCreator, rulesUtils, validators |
| `rules.skills` | `[{ key, label, attr }]` (`attr` must be an attribute key) | CharacterSheet, CharacterCreator, scenario `checks` wording |
| `rules.derived` | `{ health(char) => n, ... }` | `rulesUtils.initialCharacterState` and the server when a character is assigned. `maxStress` is kept for compatibility; the engine reads `tracks` |
| `rules.tracks` | `[{ key, label, short?, max: n \| (char)=>n, initial: 'max' \| n, color?, danger?(v,max) }]` | DMDashboard bars, PlayerView bars, `update-player` clamping |
| `rules.statusEffects` | `string[]` | DMDashboard status buttons, PlayerView |
| `rules.conditions` | `string[]` (lowercase) | per-player condition toggles (`GameContext`, `rulesUtils`, `sessions.js`) |
| `rules.dice` | `{ kind: string, Roller }` (`Roller` is attached in `index.js`) | `DiceRoller.jsx` renders `Roller`; `kind` shown on the landing card and in the generator prompt |
| `rules.creation` | `{ attrPoints, attrMin, attrMax, skillPoints, skillMax }` plus the builder caps `keyAttrMax`, `otherAttrMax`, `skillMin`, `keySkillMax`, `otherSkillMax`, `talents` (how many), `allowGeneralTalents`, `careerKinds: { <career.kind>: { keySkillMax, otherSkillMax, requiredSkillMin } }` | CharacterCreator / CharacterBuilder (`builder/builderState.js`); the Claude Code skill and generator use `attrPoints...skillMax` for legality |
| `rules.encumbrance` | `{ formula: 'str*2', overFormula: 'str*4' }` or `null` (no carrying rule) | sheet and builder gear step (`catalogUtils.encumbrance`) |
| `rules.panic` | `{ die, table: 'catalog.panic', stressAdd, statusAt, actionAt, statusEffect }` (Year Zero) | `mechanicsUtils.panicOutcome`, the phone PANIC ROLL, `server/mechanics.js` (the phone sends the looked-up entry) |
| `rules.supplies`, `supplyMax`, `supplyDanger` | `['air','power','food','water']`, `12`, `2` | SupplyPanel, supply rolls, TV supply strip |
| `rules.pools` | `[{ key, label, max?, initial, owner: 'players'\|'gm', visibleToPlayers, playerAdd, initialPerPlayer?, resetOnNewSession }]` (2d20 Momentum/Threat) | PoolCounters, TV meters, `pools-init`; the 2d20 roller adds Momentum when `playerAdd` |
| `rules.initiative` | `{ mode: 'cards', deck, actions }` or `{ mode: 'nominate', keepCost }` | InitiativePanel, `init-*` events |
| `catalog` | `{ careers, talents, weapons, armor, gear, conditions, injuries, creatures, rules, panic? }` | `engine/catalogUtils.js` (`getCatalog`): builder, sheet effects, board palette (creatures/weapons/gear), threat cards (`token.ref`), injury picker. Shapes: `docs/BOARD_AND_BUILDER.md` section 6 and `src/universes/alien/catalog/README.md` |
| `terms.sessionArticle`, `career`, `attributes`, `skills`, `talent`, `gear` | strings (`'a'`/`'an'`; DUNE: `'Archetype'`, `'Drives'`) | SessionScreen grammar, builder and sheet headings |
| `theme.motif` | `'deckplan'` \| `'contours'` | UniverseSelect card art (`fx/Motifs.jsx`) |
| `theme.overlay`, `theme.overlayCss` | `'crt'` \| `'grain'` \| unset; optional CSS string | `UniverseContext` adds `html.overlay-<name>` (and `crt`) and injects `<style id="universe-overlay">`; `crt: true` alone means `'crt'` |
| `theme.favicon` | inline SVG string | `UniverseContext` sets the tab icon per universe |
| `theme.sfx` | `{ '<sound id>': [ { wave, freq, to?, at?, dur, gain, attack?, filter? } ] }` ids `ui.tap ui.confirm alert.incoming dice.settle dice.crit dice.botch clock.tick` | `engine/sfx.js`; respects the player's MUTE |
| `theme.board` | `{ levelNoun, backdrop: 'space'\|'sand'\|'none', bg, fog, fogEdge, fogHatch, revealedEdge, label, labelStroke, ascii, asciiBg, door, reveal: 'scan'\|'dust'..., statusStyle: 'segments'\|'arcs', chipFill, font }` | `board/mapDefs.js` palette for the TV, controller and phone map; a map may override any key via `map.palette` |
| `careers` | `[{ name, keyAttribute, keySkills[], talents[] }]` | CharacterCreator, generator prompt |
| `gear` | `string[]` | CharacterCreator pick-list, generator prompt |
| `navSections` (`index.js`) | `[{ id, label, Component }]` | `Nav.jsx` appends tabs after the core ones (Scenarios, Characters, Maps, Dice Roller) |
| `maps` | `[{ id, title, subtitle, scenario, description, ascii?, engine?, rooms? }]`, plus board geometry (below) | Maps tab; a pack map whose `id` or `engine` matches gets the interactive `engine` component (attached in `index.js`); the table board reads the geometry |
| `content.packs` (`index.js`) | bundled pack objects | `ContentContext`, merged with runtime packs |
| `generator` | `{ systemPrompt, defaults, parameterHints }` | `server/generator/*`, the CLI generator and the Claude Code skill |

`theme.vars` must define at least: `--bg-dark --bg-panel --bg-card --bg-input --border --border-bright --border-glow --text --text-dim --text-bright --accent --accent-dim --accent-glow --accent-bright --warn --warn-dim --danger --danger-dim --danger-glow --success --blue --purple --font-display --font-mono`.
Smoke checks a subset (`--bg-dark --bg-panel --bg-card --border --text --text-dim --accent --accent-glow --warn --danger --success --font-display --font-mono`); provide all of them or panels will pick up stale colours from the previous universe. Use translucent tints through `color-mix(in srgb, var(--accent) N%, transparent)` in components, never hard-coded hex.

`terms` wording tips: `gm` is the long title ("Game Mother", "Mentat"), `gmShort` a 2-3 letter label, `message` is what a pushed handout is called ("Transmission"), `broadcast` the all-players label ("Shipwide"), `priorities` the ordered list a handout can carry (first = default).

`rules.tracks` is the only place health-like bars are defined. Every key becomes an entry in each player's `tracks` and `trackMax`;
`danger(value, max)` turns the bar red. ALIEN: `health` (max = STR via `derived.health`) and `stress` (max 10, initial 0).
A 2d20 universe such as Dune might use `vigor` and `determination` (the shipped DUNE module has a single `stress` track and the Momentum/Threat `pools`).

### Maps with board geometry

A universe map becomes usable on the TV (fog, tokens) when it also carries `kind: 'engine'|'image'`, `size: [W, H]`, `levels[{ id, label }]`, normalized `rooms[{ id, name, level?, shape }]` (`rect {x,y,w,h}` or `poly {points}` in 0..1), optional `doors[{ from, to, locked? }]`, `spawn { pc, levels? }`, `grid`, `outline` (SVG path), `crop {x,y,w,h}`, and the universe-only `levelNoun` / `backdrop` / `palette`. Field meanings: `docs/CONTENT_PACKS.md` (maps) and `docs/BOARD_AND_BUILDER.md` section 3.
Keep the geometry in a JSX-free module (ALIEN: `maps/montero.geometry.js` exports `W`, `H`, `MONTERO_LEVELS`, `monteroRooms`, `monteroOutline`, `monteroCrop`, `monteroSpawn`; DUNE: `maps/geometry.js`, `residency.geometry.js`, `sietch.geometry.js`, `imageMaps.js`) and import it from both `maps/index.js` and the `.jsx` MapEngine definition, so the deck plan and the board overlay render from one source.
`index.js` attaches the engine component: `maps: core.maps.map((m) => (ENGINE_MAPS[m.id] ? { ...m, engine: ENGINE_MAPS[m.id] } : m))`; the component exposes its MapEngine config as `Component.config`.

## 4. Write the content-facing rules

`rules.js` (no JSX) exports `attributes`, `skills`, `derived`, `tracks`, `statusEffects`, `conditions`, `dice: { kind }`, `creation`, `encumbrance`, `initiative`, and whichever of `panic`, `supplies` (+ `supplyMax`, `supplyDanger`) or `pools` the system needs, bundled in a `rules` object (see ALIEN for Year Zero, DUNE for 2d20).
A skill's `attr` may be `null` when any attribute pairs with any skill (2d20); then give it a `suggestedAttr`.
`derived.health(char)` must return a positive integer for every bundled character (smoke asserts it). Skill and attribute `key`s are what
packs use in `characters[].attributes` and `characters[].skills`, so choose camelCase keys once and keep them stable.

`careers.js` exports `careers` and `gear`. Talent strings use the form `"Name — one-sentence effect"`.

## 4b. Write the catalog

`catalog/*.json` is data for the character builder, sheets, board palette and threat cards. Required files (smoke checks the keys): `careers`, `talents`, `weapons`, `armor`, `gear`, `conditions`, `injuries`, `creatures`, `rules`; a Year Zero game adds `panic.json` (rows with `roll` ranges and `panicAction`) referenced by `rules.panic.table: 'catalog.panic'`.
Item shape, effects and talent/condition shapes are in `docs/BOARD_AND_BUILDER.md` section 6; ids are kebab-case and unique across weapons/armor/gear; skill and attribute keys must exist in `rules.js`; `art` is a path under `web app/public/` (or `null`). `careers[]` entries carry `kind` (`career`, or e.g. `mos`/`parentCareer` for variants), `startingGear { fixed, choices, pick }` and may feed `rules.creation.careerKinds`.
`creatures[]` ids can be used as `threats[].ref` and as `token.ref` for the threat cards. Write original or paraphrased text only. Then:

1. Add a `PROFILES` entry for the universe in `scripts/validate-catalog.mjs` (allowed sources, categories, ranges, injury tables, minimum counts) and run `node scripts/validate-catalog.mjs <id>`.
2. Put item art in `web app/public/art/<id>/...` (or generate it: `scripts/gen-dune-art.py` is the model for a ComfyUI-driven set) and run `node scripts/check-art.mjs` from `web app/`.

## 5. Write the generator prompt

`generator.js` exports `systemPrompt`, `defaults`, `parameterHints` and `generator = { systemPrompt, defaults, parameterHints }`. The prompt is appended to the engine's own instructions (schema, quality bar, pacing) by
`server/generator/prompt.js`, and a Claude Code session reads it as the tone guide (`.claude/skills/gamenight/SKILL.md` step 2). Smoke requires **300-600 words**. Cover, in this order:

1. Who is writing for whom and where it is played ("a kitchen table, players read private messages on phones").
2. **Setting**: factions, technology level, the texture of daily life. Name canon terms, never copy text.
3. **The threat/antagonist logic**: what is scary and how to show it (effects before the monster).
4. **Mechanics-as-drama**: how stress, momentum, fate or whatever the system uses should feed scenes (and the words used in `stressTriggers`).
5. **Structure and agendas**: how three acts escalate, how personal agendas conflict.
6. **Tone** and what to avoid.
7. **Terminal voice** for briefings and handouts (casing, sign-off, classification lines).
8. **Vocabulary reminder**: the exact upper-case skill names to use in `checks` and the bestiary ids valid for `threats[].ref`; invent new proper nouns.

`defaults` = `{ players, playtime, tone[], type }`; `parameterHints` = `{ setting[], threat[], tone[], type[], crew[] }` (suggestions for the wizard and the skill).

## 6. Dice roller

Create `components/<Name>DiceRoller.jsx` as a self-contained React component with no props (it is rendered by `DiceRoller.jsx` in the Dice tab) that styles itself with the theme CSS variables. In `index.js`:

```js
import MyDice from './components/MyDice.jsx';
const mine = { ...core, rules: { ...core.rules, dice: { ...core.rules.dice, Roller: MyDice } }, ... };
```
Set `rules.dice.kind` in `rules.js` to a short string (`'yze'`, `'2d20'`) describing the system. If you do not ship a roller the tab shows "No dice roller is registered".

## 7. Theme

Copy `theme.js`: choose a palette, define every var in section 3, set `fonts.googleCss` to a Google Fonts CSS URL for the two families, and `crt: true|false`. Then set the newer keys:

- `overlay` (`'crt'` or `'grain'`) and, for a custom look, `overlayCss` (CSS scoped to `html.overlay-<name>`; skip it for `'crt'`, which `index.css` provides); `motif` (`'deckplan'` or `'contours'`); `favicon` (inline SVG).
- `board`: the TV palette and level word (see the interface table). `levelNoun` is what a level is called (`DECK`, `LEVEL`, `FLOOR`); `backdrop` is drawn behind engine maps.
- `sfx`: synthesized sound recipes for `ui.tap`, `ui.confirm`, `alert.incoming`, `dice.settle`, `dice.crit`, `dice.botch`, `clock.tick`. Match the mood (ALIEN: square-wave terminal blips; DUNE: wooden knocks and bells).

`index.css` keeps the ALIEN values as first-paint defaults only.

## 8. Register it

Edit `src/universes/index.js`:

```js
import alien from './alien/index.js';
import dune from './dune/index.js';
export const universes = { alien, dune };
```
Smoke fails if a universe folder is not referenced as `./<id>/index.js` in that file. The landing page (`UniverseSelect`) draws one card per registry entry automatically,
shows a systems line derived from `rules`, and shows "NO SCENARIOS — GENERATE ONE" when `content/` holds no scenario packs. The server-side content and generator code find universes by folder name,
so they work as soon as `universe.core.js` exists.

## 9. Bundle a first pack

Easiest: author one with the Claude Code skill (`/gamenight`) or the generator, then move it:

1. Save/generate to `content/<id>/<pack-id>.json` and validate it.
2. Move it to `src/universes/<id>/content/<pack-id>.json`, set `meta.source` to `"bundled"` (the validator requires it for bundled packs), drop `meta.generated` if you like, keep `universe` equal to `<id>` and the file name equal to `<pack-id>.json`.
3. Rebuild (`npm run build`) because bundled packs are compiled into the client.

A universe with no bundled scenario is valid; users generate or import packs at runtime.

## 10. Verify

```bash
cd "web app"
export PATH="$PATH:/c/Program Files/nodejs"   # Windows/Git Bash
node scripts/smoke.mjs                         # npm run smoke
node scripts/validate-content.mjs              # npm run validate
npm run dev                                    # open http://localhost:3000, pick the new card
```
```bash
node scripts/validate-catalog.mjs <id>        # from the repo root: catalog ids, references, art
node scripts/check-art.mjs                    # from web app/: every /art/... path exists
```
Smoke imports every `universe.core.js` in Node and asserts: core keys, `terminal.*`, `terms.*`, `rules.*`, `rules.pools` shape when present, `catalog` and every catalog key, ALIEN panic/initiative and DUNE initiative checks, required theme vars, `theme.fonts`, `theme.crt` boolean,
`derived.health` function (and a positive integer for each bundled character), `dice.kind` string, track shape, every skill maps to an attribute, generator prompt is 300-600 words,
`maps` is an array, `index.js` contains `navSections`/`Roller`/`import.meta.glob`, registry reference exists, plus content validation.

## Checklist

- [ ] `src/universes/<id>/` created from the ALIEN module; folder name == `id`.
- [ ] `universe.core.js` default-exports all of: `id name tagline terminal theme terms rules careers gear maps generator catalog` and imports no JSX/React/`import.meta`.
- [ ] `index.js` adds `navSections`, `rules.dice.Roller`, attaches map engines, and `content.packs` via `import.meta.glob`.
- [ ] `terminal` has `name`, `subtitle`, `statusLines`.
- [ ] `terms` has `gm gmShort player players session message broadcast joinPrompt priorities` (+ `sessionArticle career attributes skills talent gear`).
- [ ] `rules` has `attributes skills derived tracks statusEffects conditions dice creation` (+ `encumbrance initiative`, and `panic supplies` or `pools` as the system needs); every skill's `attr` exists (or is `null`); `derived.health` returns a positive integer.
- [ ] `theme.vars` defines all 24 variables; `fonts` has `display mono googleCss`; `crt` is a boolean; `overlay`, `motif`, `favicon`, `board` and `sfx` set.
- [ ] `catalog/*.json` written (all nine keys), a `PROFILES` entry added in `scripts/validate-catalog.mjs`, `node scripts/validate-catalog.mjs <id>` passes.
- [ ] Maps that should work on the TV carry board geometry (`kind size levels rooms ...`) from a JSX-free geometry module.
- [ ] `careers` entries have `name keyAttribute keySkills talents`; `gear` list present.
- [ ] `generator.systemPrompt` is 300-600 words and ends by listing skill names and bestiary ids; `defaults` and `parameterHints` filled.
- [ ] Dice roller component written (or deliberately omitted).
- [ ] Registered in `src/universes/index.js`.
- [ ] (Optional) first bundled pack with `meta.source: "bundled"`, file named `<id>.json`.
- [ ] `node scripts/smoke.mjs` and `node scripts/validate-content.mjs` pass; `npm run build` succeeds.
- [ ] Picked the universe in the running app: theme, boot overlay, creator, dice tab, a generated or imported pack all work.
- [ ] README universe list and `ARCHITECTURE.md` updated if you extended the interface (add new keys to **every** universe).
