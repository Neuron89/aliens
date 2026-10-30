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
  maps/index.js        data-only universe maps (may be an empty array)
  reference/*.js       optional: bestiary/weapons data (bestiary ids are valid `threats[].ref`)
  components/*.jsx     optional: dice Roller, reference tabs (JSX lives only here and in index.js)
  content/*.json       bundled content packs (optional; none required)
```

Start with `cp -r src/universes/alien src/universes/<id>`, then strip ALIEN specifics file by file.

## 2. The core / index split rule

- `universe.core.js` default-exports `{ id, name, tagline, terminal, theme, terms, rules, careers, gear, maps, generator }` and may import only plain JS
  (no React, no JSX, no `import.meta.glob`, no `.jsx` files, no CSS). `scripts/smoke.mjs` and the server-side generator
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
| `rules.creation` | `{ attrPoints, attrMin, attrMax, skillPoints, skillMax }` | CharacterCreator; the Claude Code skill and generator use it for legality |
| `careers` | `[{ name, keyAttribute, keySkills[], talents[] }]` | CharacterCreator, generator prompt |
| `gear` | `string[]` | CharacterCreator pick-list, generator prompt |
| `navSections` (`index.js`) | `[{ id, label, Component }]` | `Nav.jsx` appends tabs after the core ones (Scenarios, Characters, Maps, Dice Roller) |
| `maps` | `[{ id, title, subtitle, scenario, description, ascii?, engine?, rooms? }]` | Maps tab; a pack map whose `id` or `engine` matches gets the interactive `engine` component (attached in `index.js`) |
| `content.packs` (`index.js`) | bundled pack objects | `ContentContext`, merged with runtime packs |
| `generator` | `{ systemPrompt, defaults, parameterHints }` | `server/generator/*`, the CLI generator and the Claude Code skill |

`theme.vars` must define at least: `--bg-dark --bg-panel --bg-card --bg-input --border --border-bright --border-glow --text --text-dim --text-bright --accent --accent-dim --accent-glow --accent-bright --warn --warn-dim --danger --danger-dim --danger-glow --success --blue --purple --font-display --font-mono`.
Smoke checks a subset (`--bg-dark --bg-panel --bg-card --border --text --text-dim --accent --accent-glow --warn --danger --success --font-display --font-mono`); provide all of them or panels will pick up stale colours from the previous universe. Use translucent tints through `color-mix(in srgb, var(--accent) N%, transparent)` in components, never hard-coded hex.

`terms` wording tips: `gm` is the long title ("Game Mother", "Mentat"), `gmShort` a 2-3 letter label, `message` is what a pushed handout is called ("Transmission"), `broadcast` the all-players label ("Shipwide"), `priorities` the ordered list a handout can carry (first = default).

`rules.tracks` is the only place health-like bars are defined. Every key becomes an entry in each player's `tracks` and `trackMax`;
`danger(value, max)` turns the bar red. ALIEN: `health` (max = STR via `derived.health`) and `stress` (max 10, initial 0).
A 2d20 universe such as Dune might use `vigor` and `determination`.

## 4. Write the content-facing rules

`rules.js` (no JSX) exports `attributes`, `skills`, `derived`, `tracks`, `statusEffects`, `conditions`, `dice: { kind }`, `creation`, and a `rules` object bundling them (see ALIEN).
`derived.health(char)` must return a positive integer for every bundled character (smoke asserts it). Skill and attribute `key`s are what
packs use in `characters[].attributes` and `characters[].skills`, so choose camelCase keys once and keep them stable.

`careers.js` exports `careers` and `gear`. Talent strings use the form `"Name — one-sentence effect"`.

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

Copy `theme.js`: choose a palette, define every var in section 3, set `fonts.googleCss` to a Google Fonts CSS URL for the two families, and `crt: true|false`.
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
Smoke imports every `universe.core.js` in Node and asserts: core keys, `terminal.*`, `terms.*`, `rules.*`, required theme vars, `theme.fonts`, `theme.crt` boolean,
`derived.health` function (and a positive integer for each bundled character), `dice.kind` string, track shape, every skill maps to an attribute, generator prompt is 300-600 words,
`maps` is an array, `index.js` contains `navSections`/`Roller`/`import.meta.glob`, registry reference exists, plus content validation.

## Checklist

- [ ] `src/universes/<id>/` created from the ALIEN module; folder name == `id`.
- [ ] `universe.core.js` default-exports all of: `id name tagline terminal theme terms rules careers gear maps generator` and imports no JSX/React/`import.meta`.
- [ ] `index.js` adds `navSections`, `rules.dice.Roller`, attaches map engines, and `content.packs` via `import.meta.glob`.
- [ ] `terminal` has `name`, `subtitle`, `statusLines`.
- [ ] `terms` has `gm gmShort player players session message broadcast joinPrompt priorities`.
- [ ] `rules` has `attributes skills derived tracks statusEffects conditions dice creation`; every skill's `attr` exists; `derived.health` returns a positive integer.
- [ ] `theme.vars` defines all 24 variables; `fonts` has `display mono googleCss`; `crt` is a boolean.
- [ ] `careers` entries have `name keyAttribute keySkills talents`; `gear` list present.
- [ ] `generator.systemPrompt` is 300-600 words and ends by listing skill names and bestiary ids; `defaults` and `parameterHints` filled.
- [ ] Dice roller component written (or deliberately omitted).
- [ ] Registered in `src/universes/index.js`.
- [ ] (Optional) first bundled pack with `meta.source: "bundled"`, file named `<id>.json`.
- [ ] `node scripts/smoke.mjs` and `node scripts/validate-content.mjs` pass; `npm run build` succeeds.
- [ ] Picked the universe in the running app: theme, boot overlay, creator, dice tab, a generated or imported pack all work.
- [ ] README universe list and `ARCHITECTURE.md` updated if you extended the interface (add new keys to **every** universe).
