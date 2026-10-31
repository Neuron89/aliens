# Scenario pack quality checklist

Run this before declaring a pack done. Items marked (V) are enforced by `node scripts/validate-content.mjs`;
the rest are craft rules you must check by reading your own output.

## Structure
- [ ] (V) `packVersion` 1, kebab-case `id` 3-64 chars, `universe` equals the folder, file named `<id>.json`.
- [ ] (V) `kind` scenario/campaign has >= 1 act.
- [ ] Act count matches the type: Cinematic or >= 3 h = 3 acts; One-Shot or <= 2 h = 1-2.
- [ ] Each act: 3-6 `readAloud` paragraphs, 40-120 words each, second person, present tense.
- [ ] Each act: 3-6 scenes; >= 1 mandatory, >= 1 optional, >= 1 non-combat.
- [ ] Every `encounter: true` scene has `encounterDetail`.
- [ ] Every scene has a `gmTip` and at least `narration` plus `checks` or `events`.

## Mechanics
- [ ] Every check names a real skill of this universe, upper case, `SKILL — purpose` or `SKILL at −2 — purpose`.
- [ ] Stress/panic triggers say who is affected and use the universe's vocabulary.
- [ ] Threat `ref` values exist in the universe bestiary (or are omitted).
- [ ] Difficulty matches the requested label: escalating pressure, a clock, a resource that runs out.

## People
- [ ] 3-8 NPCs; agendas conflict with each other and with at least one PC; most have a `secret`.
- [ ] One PC per player; each has `personalAgenda`, `agendaByAct` ("1","2","3"), `secret`, `buddy`, `rival`, `signatureItem`, `appearance`.
- [ ] `agendaByAct` escalates: private and plausible, then conflict, then open betrayal.
- [ ] Each PC secret collides with another PC's agenda or secret; no PC is without a conflict by the last act.
- [ ] (V) Every PC has all required fields, legal attribute/skill keys and ranges, a catalog career and a talent of that career with its catalog text, `buddy`/`rival` naming other PCs, and (DUNE) all five `driveStatements`. `health` omitted. Run the validator with `--warnings` to see gear that is not a catalog item and skills above the builder caps.
- [ ] Attribute and skill totals computed against `rules.creation` (see SKILL.md step 4); no skill above the allowed max.
- [ ] Career and talent come from `careers.js`.
- [ ] No two PCs have the same id, name or signature item. `buddy`/`rival` refer to real PC names (or "None"), and a PC's buddy and rival are two different people.
- [ ] `relations` (intrigue web, optional but expected for DUNE): 2-4 per important NPC and at least one per PC; each `to` is an NPC name, PC name or PC id of this pack (never the person themself); `kind` is one of ally, rival, owes, fears, loves, serves, hides; the `note` is one sentence the GM could read aloud; mark the ties the players do not know with `"secret": true` (each PC should have at least one secret tie). (V) checks that every `to` resolves.

## Handouts and endings
- [ ] 2-6 handouts in terminal voice, 20-200 words, priority from `terms.priorities`, `to`, and a `when` cue.
- [ ] A private handout exists for each agenda change you rely on mid-play.
- [ ] >= 2 endings, covering success and loss; each `text` 60-200 words with no rules text.
- [ ] Briefing 120-350 words, in-world, hints at withheld information, signs off.

## Safety and originality
- [ ] `contentWarnings` are honest and complete; the `avoid` list does not appear anywhere.
- [ ] Every proper noun is invented (or canon setting terms only); no quoted sourcebook or film text.
- [ ] No rules tables, HTML or markdown in prose fields.
- [ ] `meta.source` is "generated" and `meta.generated` has `by`, `model`, `at` (ISO), `params`.

## Final
- [ ] `grep -n PLACEHOLDER` finds nothing.
- [ ] `node scripts/validate-content.mjs` prints `N/N packs valid.`
- [ ] The user was told where the pack is, how it appears in the Scenario Library, and the content warnings.
