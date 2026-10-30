# ALIEN RPG catalog (data only)

These are structured character-creation and reference data for the ALIEN universe. They were mined from the
**Core Rule Book (CRB, 2019)** and **Colonial Marines Operations Manual (ACM, 2021)**.

- **Extraction date:** 2026-10-30
- **Page numbers** are the *printed* page numbers. The PDF page index is the printed page + 4 in both books.
- **Text:** every description, talent, condition, injury, panic and attack text is paraphrased. Names and numbers are
  transcribed from the books.
- **Validation:** `node scripts/validate-catalog.mjs` (from the repo root). It checks unique ids, cross-references,
  skill/attribute keys against `rules.js`, that art files exist, and description length.
- **Rebuild:** the generator lives in `scripts/.scratch/build/` (`d_*.py` data + `build.py`). That folder is
  gitignored. Edit the JSON directly, or copy the build folder somewhere tracked if you want to regenerate.

## Files

| File | Count | Contents |
|---|---|---|
| `careers.json` | 19 | 9 CRB careers (`kind:"career"`) + 10 ACM Marine MOS (`kind:"mos"`, `parentCareer:"colonial-marine"`). `startingGear.fixed` / `choices` reference ids in weapons/armor/gear. `startingGear.pick` is `2` for CRB careers (choose two lines, one item from each) and `"all"` for MOS (one from List A and one from List B). Also includes `quantities`, `cash`, `rule`, `typicalNames`, `signatureItemHints`, plus `requiredSkills` and `talentNotes` for MOS. |
| `talents.json` | 63 | 27 CRB career talents, 31 CRB general talents and 5 ACM Marine-only talents (career `colonial-marine`, source ACM). `effects[].target` uses `skill:<rules.js key>`, `attr:<key>`, `stress`, `damage`, `initiative` or `other`. |
| `weapons.json` | 62 | 21 CRB (pistols, rifles, heavy, close combat) and 41 ACM (pistols, rifles, heavy, explosives/ammo, chemical, 16 vehicle-mounted weapons tagged `vehicle-mounted`). `stats.damage` is `null` for blast/fire/stun weapons; see `stats.blastPower` / `fireIntensity`. Weight `null` means it can't be carried. Cost `null` means not for sale or no price given. |
| `armor.json` | 13 | 6 CRB suits/armor and 7 ACM entries (helmet, riot vest, riot shield, 6B90, CCC5, HAZMAT suit, MOX exosuit). Includes `airSupply`. |
| `gear.json` | 89 | CRB computers/mainframes, data storage, diagnostics, vision, tools, medical, drugs, food, U-238 ammo, plus 16 CRB career-only items (no stats). ACM uniforms, protective gear, other equipment, 1VAN/3 mainframe, plus handcuffs/survival kit (no stats). `costMax` marks price ranges. Mainframes and medpods carry `skills`. |
| `conditions.json` | 24 | Starving, Dehydrated, Exhausted, Freezing, Sick, Irradiated, Broken, On Fire, Acid Burn, Suffocating, Vacuum, Drowning, Stunned, Over-Encumbered, Xeno venom paralysis, Facehugged, Nerve Agent (ACM), Anathema infection (ACM), and the 6 permanent mental traumas (`group:"mental-trauma"`, with `roll`). |
| `injuries.json` | 47 | The full D66 human critical injury table (36 entries, `table:"human"`). Also the D6 synthetic table (6, `table:"synthetic"`, CRB p111) and the D6 xenomorph table (5, `table:"xenomorph"`, CRB p291). `medicalAidModifier` holds the "Yes, -1/-2" values. |
| `panic.json` | 10 | Panic table 1-6, 7, 8 … 14, 15+. `panicAction:true` marks the forced-action results (10+). |
| `creatures.json` | 79 | 40 creature stat blocks and 39 generic NPC archetypes. The creatures are every Neomorph stage, every XX121 stage and variant, Swarm, Harvester (+ juvenile), Lion Worm and Scorpionid (CRB), plus ACM's Biodrone, Goreburster, the 4 Anathema stages, Arctura, Running Flatfish, Grain Parasites, Hungry Tendril, Fighting Joe and Berserker. The NPCs are the CRB NPC list (pp.355-357) and the ACM generic NPC table (pp.220-221); human/synthetic NPCs have `stats.attributes`. Bestiary ids from `reference/bestiary.js` are kept. |
| `rules.json` | 46 | Creation budgets/caps, health, stress, encumbrance, consumables, armor and armor-vs-fire, death rolls, XP, android rules (CRB) and the ACM Marine variant (`acm-*`). Each has `text`, plus `value`/`formula` where numeric. |

## Art

`art` holds the name-matched thumbnail from `public/art/{weapons,xenomorphs}/cropped/` (50 items). **A visual audit
found that every one of the 59 cropped thumbnails is mis-framed.** They show text pages, tables, chapter art or a
different item's card, apparently because the crops were taken from page images offset by 4 pages and with guessed
regions. Every mapped item therefore carries `artStatus:"crop-mismatch"`. `artPage` (60 items) points to the
full-page scan (`/art/weapons/{crb|acm}-weapons-NNN.webp` or `/art/xenomorphs/{crb|acm}-xeno-NNN.webp`, NNN = printed
page + 4). It shows the page that holds the item's stat card or the creature's stat block, which makes it the more
reliable picture until the crops are redone. The old `bestiary.js` art paths are off by the same 4 pages: for
example, `crb-xeno-300.webp` is printed page 296, the adult Neomorph, not the egg.

Thumbnails not mapped to any catalog item, because the item does not exist in either book: `m4a4-pistol`,
`nsg23-assault-pistol`, `m41a2-pulse-rifle`, `m41a-mk2-pulse-rifle`, `m4ra-battle-rifle`, `m83a2-sadar`,
`ua571d-sentry`, `m3a1-pattern-armor`, `m108-demolition`.

## Fidelity notes (please double-check)

1. **CRB p120/122, M41A:** the table says $800. The illustration box on p122 says $1,200 and adds "grenade launcher". The table value is used.
2. **CRB p122, M42A illustration box** (+1 / Damage 3) and **p124, M41AE2 box** (+2 / Damage 2 / $1,200) disagree with their tables. Table values are used (M42A +2/2; M41AE2 +1/3/$1,500).
3. **CRB p127:** the armor table puts "AGILITY -1" on the **Mk.50** row, but the prose calls the Mk.35 the bulky one. Kept as printed, verified on a page render.
4. **CRB p51:** the Pilot's key skills are printed as Mobility, Ranged Combat, Comtech, with no Piloting. Kept as printed, verified on a page render.
5. **CRB p99:** mentions a "Cold-Blooded" talent that does not exist. The Merciless talent (p78) covers the effect.
6. **CRB p131, HoloTab:** the table says COMMAND +2, but the text says COMMAND and OBSERVATION +2. Both effects are recorded.
7. **CRB p306, Imp armor:** printed as "0 (3 vs fire)", which is higher against fire than normally. Transcribed as is.
8. **CRB p295:** the Neophyte (juvenile Neomorph) has no attack table of its own. It is given the adult Neomorph table (GM call).
9. **CRB p310, Worker:** no attack table is printed, so `signatureAttacks` is empty.
10. **CRB p318, Harvester Juvenile:** its attack (4 dice, Damage 1) comes from the prose, not a table.
11. **CRB p100:** the multi-column critical injury table garbles in plain text extraction. It was re-read with word positions (pdfplumber), so healing times and the "Yes, -1/-2" values should be correct.
12. **ACM p56, CBRN Specialist:** gets "Weapon Specialist (M230 Incinerator)". No M230 incinerator exists (M230 is baton rounds), so `talentNotes` maps it to the M240.
13. **ACM p62 gear names normalised:** "M5 RPG" → `m5a3-rpg-launcher`, "U1 Baton Rounds" → `m230-baton-rounds`, "U4 Firebombs" → `u4-qtc-firebomb`, "Riot Shield" → `armat-cm4-riot-shield`, "Combat Knife" → `knife`, "Suppressed M42A" → M42A + `muzzle-suppressor`, "Suppressed Pups" → `pups-mapping-device`, "Mk.50" → `irc-mk50-compression`.
14. **ACM p74:** the explosives table has no bonus or range columns. Bonus is set to 0 and range is taken from the prose where it is stated (M40 thrown = MEDIUM, M108 = SHORT, claymore = SHORT, M111 = ENGAGED).
15. **ACM p76:** the uniforms table spells "MB3 Standard Boots" and the prose spells "M3B". M3B is used.
16. **ACM p221, UPP MSS Officer:** lists a talent "Intimidation", which is not a CRB talent. It is left out of `talents` and mentioned in `gear`/notes.
17. **ACM p230:** the Running Flatfish has no Speed (`speed:null`).
18. **ACM p295 vs p170, Berserker:** the mission stat block (STR 6, Health 8) differs from the "typical Berserker" (STR 5, Health 7). The p295 block is used and the difference is noted.
19. **ACM pp.220-221:** the generic NPC table extracts as doubled glyphs (faux-bold). It was transcribed by hand from the de-doubled text. The Space Consortium PMC row really reads STR 5 / Health 7 (Tough).
20. **CRB p45:** Kid starting cash is printed as "$D6" (not x100).
21. **Starting gear (all CRB careers):** "Choose two of the starting items below" is read as choosing two of the four OR-lines and taking one item from each. This matches the Nat example on p33 (cutting torch + compression suit).

## Deliberately not catalogued

- Vehicles and spacecraft (no `vehicles.json` was requested). Vehicle-mounted weapons *are* in `weapons.json`.
- ACM field event tables (pp.58-59), rank perks beyond the rank list, and space-combat rules.
- Named, one-off characters from the CRB "Hope's Last Day" scenario and from the ACM campaign/missions (pp.111-125, 200-217, 224-353). Only generic archetype tables and all creature stat blocks are included.
- Engineers: the CRB gives no stat block.
