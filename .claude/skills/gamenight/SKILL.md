---
name: gamenight
description: Author a complete tabletop RPG scenario pack by hand (no API key) for the MU/TH/UR companion app. Use for "set up a game night", "generate a scenario", "make characters for", "write a one-shot for <universe>", "add a scenario pack".
---

# gamenight — hand-author a scenario pack

You (Claude Code) write one complete, schema-valid content pack as JSON, save it where the
app reads runtime packs, and validate it. No `ANTHROPIC_API_KEY` is needed: you are the generator.

- Repo root = the folder holding `ARCHITECTURE.md`. App root = `web app/`. Run commands from `web app/`.
- Node lives at `C:\Program Files\nodejs` (bash: `export PATH="$PATH:/c/Program Files/nodejs"`).

Follow the steps in order. Do not skip step 2: the universe's own files are the source of truth
for skill keys, careers, creation budgets and tone.

## 1. Collect parameters

Ask only for what is missing, in ONE short message that offers the defaults. Do not interrogate.

| Parameter | Default |
|---|---|
| universe id | the only registered one, else ask. List them from `web app/src/universes/index.js` (keys of `export const universes`) |
| player count + names | `generator.defaults.players` (alien: 4). Names are optional; record them in `meta.generated.params.playerNames` and use them only to suggest which PC suits which player. PCs are fictional, never named after players |
| playtime | `generator.defaults.playtime` (alien: "3-4 hours"). In `meta.generated.params.playtime` record the generator's enum value (`one-shot 2-3h`, `session 3-5h` or `long 5-8h`, see `server/generator/params.schema.json`); `meta.playtime` stays human text |
| type | `generator.defaults.type` (alien: Cinematic); Cinematic / One-Shot / Campaign |
| difficulty | Standard (generator enum: Introductory, Standard, Brutal) |
| tone | `generator.defaults.tone` (alien: dread, corporate betrayal) |
| setting | pick from `generator.parameterHints.setting` and say which |
| threat | pick from `generator.parameterHints.threat` |
| themes | optional free text (grief, loyalty, betrayal...) |
| avoid | optional list of things the table does not want; never include them |
| lethality | low / medium / high; default "high" for Cinematic, otherwise "medium" |

Structure rule: **Cinematic or playtime >= 3 h means 3 acts; One-Shot or <= 2 h means 1-2 acts.**
Pack `id`: kebab-case from the title, 3-64 chars, and not already a file name in
`web app/content/<universe>/` or `web app/src/universes/<universe>/content/`.

## 2. Load the universe

Read, in `web app/src/universes/<id>/`:
- `universe.core.js` (what the universe exposes) and `terms.js` (handout priorities, terminal name).
- `generator.js`: **its `systemPrompt` is the tone and setting guide. Follow it as if it were your own system prompt.** Also `defaults` and `parameterHints`.
- `rules.js`: `attributes`, `skills` (the exact `key`s), `creation` budget, `tracks`, `statusEffects`.
- `careers.js`: legal careers, `keyAttribute`/`keySkills`, talent strings (copy verbatim), and the `gear` pick-list.
- `reference/bestiary.js` if present: valid ids for `threats[].ref`.
- `web app/server/schema/content-pack.schema.json`: every property and description.
- One bundled pack as a style reference: the first `content/*.json` with `kind: "scenario"` (ALIEN: `chariot-of-the-gods.json`). Imitate voice and density, never content.
- Starting point: `.claude/skills/gamenight/references/pack-skeleton.json`.

## 3. Author the pack: quality bar

Everything must be specific to THIS scenario. Hard rules (the same ones the server generator uses):

1. **Acts.** 3 acts for a session/Cinematic (hope, doubt, horror shape), 1-2 for a one-shot. `title` upper case ("ACT I"), `subtitle` 1-2 upper-case words.
2. **readAloud.** 3-6 paragraphs per act, each 40-120 words, second person, present tense, sensory (cold, smell, sound, weight of gear). No rules text, dice, GM secrets or stage directions. (The schema allows 2-6; we hold ourselves to 3-6.)
3. **Scenes.** 3-6 per act. Each has `name` (1-5 words), `mandatory`, `encounter` (+ `encounterDetail` when true), `narration` (1-4 sentences), concrete `checks`, `stressTriggers`, `gmTip`, `outcomes`, and `npcGuidance` where NPCs are present.
   - `checks` entries read `"SKILL — purpose"` or `"SKILL at −2 — purpose"` using the universe's skill labels in upper case that map to real skill keys (ALIEN: HEAVY MACHINERY, STAMINA, CLOSE COMBAT, MOBILITY, PILOTING, RANGED COMBAT, OBSERVATION, COMTECH, SURVIVAL, MANIPULATION, MEDICAL AID, COMMAND). Never invent a skill.
   - `stressTriggers` say who is affected: `"STRESS +1 — all PCs present"`, `"IMMEDIATE PANIC ROLL — witnesses"`; use the universe's own vocabulary.
   - Every act: at least one mandatory scene, one optional contingency scene, one scene with no combat.
   - Optional `ambient` per scene: a preset id of the universe (ALIEN `ship`, `derelict`, `hive`, `tension`, `alert`, `space`, `dread`; DUNE `erg`, `sietch`, `keep`, `wind`, `bazaar`, `court`). Moving to the scene switches the table ambience. Write `ambient`, not `ambience` (the schema rejects the latter).
4. **NPCs.** 3-8 with `name`, `role`, `agenda`, `behavior`, and a `secret` for most. Their agendas conflict with each other and with at least one PC. Give them `relations` for the GM's intrigue web: 2-4 per important NPC, `{ "to": <NPC name, PC name or PC id>, "kind": ally|rival|owes|fears|loves|serves|hides, "note": one sentence safe to read aloud, "secret": true when the players do not know it }`; PCs can carry them too (see `references/pack-skeleton.json`).
5. **Threats.** From first glimpse to final form. `ref` only with a real bestiary id of that universe, otherwise omit it. `tactics` shows escalation across acts.
6. **keyLocations** 4-10, 20-60 words each. **maps** optional: an ASCII schematic (<= ~70 columns, box-drawing characters, labelled rooms) plus `rooms[]`.
7. **Characters (Cinematic).** One per player. Each has `personalAgenda` (1-3 sentences, second person); `agendaByAct` with keys `"1"`,`"2"`,`"3"` that **escalate** (private and plausible, then set against another PC, then open betrayal); a `secret` that **collides with another PC's** agenda or secret; `buddy` and `rival` naming two different other PCs in the pack (or "None"); a `signatureItem` with a one-sentence story; a talent copied from the career in `careers.js`; 3-6 `gear` items including the signature item; `appearance` of 2-3 performable sentences. By the last act every PC's agenda conflicts with at least one other PC's. For One-Shot/Campaign types agendas are optional; still give buddy and rival.
8. **Handouts.** 2-6, in the universe terminal voice (ALIEN: upper-case teletype, regulation numbers, "ADDITIONAL DATA CLASSIFIED", sign-off "MU/TH/UR OUT."). `text` 20-200 words, no GM asides. `priority` is one of `terms.priorities`. `to` is a PC name, a role or "ALL CREW". Every handout has a `when` cue ("Act II, after the logs are recovered"). Include a private handout for each PC secret or agenda change you want delivered mid-play. Ids are kebab-case and unique in the pack.
9. **Briefing.** 120-350 words, in-world, ends with a sign-off, hints at what is withheld.
10. **Endings.** At least 2, ideally 3-4 (success, pyrrhic, total loss). `condition` in GM language; `text` 60-200 words of cinematic narration.
11. **Content warnings.** Honest, lowercase, complete (`meta.contentWarnings`). Include "character death" for high lethality and "player-vs-player conflict" if agendas conflict. Honour `avoid` absolutely.
12. **Originality.** All proper nouns (ships, stations, people, companies beyond the universe's canon names) are invented. No copyrighted text, no film/book characters, no passages from sourcebooks. Canon factions and creature types may be named as setting; their wording may not be copied.
13. **Meta.** `title` 2-6 words; `tagline` 8-25 words, no twist spoilers; `synopsis` 60-150 words, spoilers allowed; `tone` 2-5 lowercase keywords; `tips` 3-8 one-sentence actionable items.

Final pass: `.claude/skills/gamenight/references/quality-checklist.md`.

## 4. Character legality

Read `rules.creation`, `rules.attributes`, `rules.skills` and **compute, do not eyeball**.
ALIEN today (verify in `rules.js`): `attrPoints 14`, attributes 2-5, `skillPoints 10`, `skillMax 3`. That is the
in-app *creator* budget. The bundled Cinematic pre-gens are looser (attributes sum 14, each 2-5; skills total about 14-26
with career key skills at 3-5). Use:
- **Cinematic pre-gens:** attributes sum `attrPoints` (±1), each within `attrMin..attrMax`, and only the career's key attribute above `otherAttrMax`; skills total at most `skillPoints + 10` (ALIEN: 20); no skill above `skillMax + 2` (ALIEN: 5); the career's `keySkills` at >= 2. DUNE drives are exactly 8/7/6/5/4, one each; DUNE skills 4-8.
- **DUNE:** every PC carries `driveStatements` with one first-person sentence for each drive (`duty`, `faith`, `justice`, `power`, `truth`), answering that drive's `prompt` in `rules.js`. Never paste them into `appearance`.
- **Creator-legal requested (or non-Cinematic):** skills total exactly `skillPoints`, none above `skillMax`.
- Keep a scratch table `name | attr sum | skill sum | max skill` and fix any row that breaks the rule.
- `attributes`/`skills` use only universe keys; `skills` lists **every** skill key (0 for untrained).
- `career` is a name from the catalog (`catalog/careers.json`; `careers.js` lists the same CRB careers); `talent` is `"Name — effect"` copied verbatim from that career's talents (the validator compares it with `catalog/talents.json`).
- Derive nothing the engine recomputes: **omit `health`** (ALIEN health = STR; recomputed on assignment) and any track values.
- Gear: names from the universe `gear` list (they are catalog item names, so the sheet shows their stats and art) plus invented keepsakes.

## 5. Write the file

Path: `web app/content/<universe>/<id>.json` (create the folder if missing). The file name MUST equal `<id>.json`.
UTF-8, 2-space indent, strict JSON (no comments, no trailing commas). Set:

```json
"meta": { "...": "...", "source": "generated",
  "generated": { "by": "claude-code", "model": "<your own model id>", "at": "<ISO-8601 now>",
    "params": { "universe": "alien", "players": 4, "playerNames": ["..."], "playtime": "3-4 hours",
                "type": "Cinematic", "difficulty": "Standard", "tone": ["..."], "setting": "...",
                "threat": "...", "themes": "...", "avoid": "...", "lethality": "high" } } }
```

`packVersion` is the integer `1`; `universe` equals the folder name; `kind` is `"scenario"` (or `"campaign"`).
Write from a complete draft; `grep -n PLACEHOLDER` on the file must find nothing.

## 6. Validate and report

```bash
cd "web app" && export PATH="$PATH:/c/Program Files/nodejs" && node scripts/validate-content.mjs
```

Fix every `✗` line and rerun until `N/N packs valid.` (optionally also `node scripts/smoke.mjs`). Then tell the user:
- the pack path and title;
- it appears in the app's **Scenario Library** (Scenarios tab). Runtime packs are read live from `web app/content/`; reload the page if the app is already open;
- if they play from the deployed copy, `powershell -File scripts\deploy-local.ps1` copies new pack files to `..\aliens-deploy\web app\content\` without deleting packs saved there (or copy the JSON there by hand and refresh);
- which PC suits which player, and the content warnings to discuss before play;
- how to start: Create session, pick the scenario, INITIALIZE, share the join link (see `docs/GAME_NIGHT.md`).

## 7. Optional: DM cheat sheet

Offer (do not create unless asked) a one-page printable Markdown cheat sheet: title and tagline; per-act beats as 3 bullets;
NPC agenda/secret table; PC secret-collision table; handouts with send-times; ending conditions; the five most dangerous
scenes with their checks. Ask the user where to save it; do not put it in `content/` (that folder is for packs only).

## Gotchas

- `additionalProperties: false` almost everywhere: unknown keys fail. Open maps are only `stats`, `attributes`, `skills` and `meta.generated.params`.
- `agendaByAct` keys are strings `"1"`..`"99"`.
- `maps[].kind` `"ascii"` requires `ascii`; `"image"` requires `src`.
- `meta.source: "bundled"` is only for packs inside the app source; runtime packs use `"generated"` or `"custom"`.
- JSON strings: newlines as `\n` (briefing paragraphs separated by `\n\n`), quotes as `\"`.
- `kind: "characters"` packs need no acts; `scenario` and `campaign` need at least one.
- More: `docs/CONTENT_PACKS.md` (field guide), `docs/ADDING_A_UNIVERSE.md`, `ARCHITECTURE.md` (contract).
