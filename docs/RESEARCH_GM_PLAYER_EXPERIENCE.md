# Research: GM and Player Experience, and the Feature Backlog It Implies

Audience: implementation agents for the MU/TH/UR tabletop companion (see `ARCHITECTURE.md`, `docs/BOARD_AND_BUILDER.md`).
Date: 2026-10-30. Method: ~30 web sources (section 5) plus the two repo docs. Forum and marketing sources are marked "(anecdotal)". Rules statements that could not be confirmed from a primary source are marked **VERIFY** and must be checked against the core book before being hard-coded.

---

## (a) One-page synthesis: what makes play feel great

1. **The GM's scarcest resource is attention, not content.** Good GM tooling (Sly Flourish's Lazy DM eight steps: strong start, scenes, secrets and clues, locations, NPCs, monsters, rewards) is *low-prep, high-retrieval*: the GM needs the right 3 lines at the right moment, not a wiki. Our packs already hold the content (acts, scenes, NPCs, handouts). The missing piece is a **"what do I do now" run view**: current scene, one-tap clues/handouts, one-tap NPC agenda, one-tap roll, and a running log.
2. **Clues should be redundant and discoverable, not gated.** The Alexandrian's Three Clue Rule and node-based design: every conclusion gets 3+ clues, and any 3 clues should lead somewhere. In the app, *secrets/clues are first-class objects* that can be revealed to one player, several, or everyone, and tracked as found / not found so the GM sees what is still unspent.
3. **Visible pressure creates drama.** Blades clocks, Mothership ship-wide stress, Alien air/power supply, Dune Threat: each is *a number the table can see moving*. Showing clocks to players lets them make informed choices and feel the squeeze. The TV is the place for shared pressure; the phone is the place for personal pressure (stress, panic).
4. **Agency = visible consequence.** Players feel agency when an action changes something they can see: a door opens, a room is revealed, a clock ticks, an item lands in their inventory with a sound, a private message arrives only for them. Every GM action that affects a player should produce an immediate, per-device effect.
5. **Dice are the emotional peak of every beat.** The best implementations settle the dice first, then fire feedback (crit/botch overlay, sound), and offer accessibility opt-outs (Foundry's Yugen Criticals defers effects until 3D dice settle and lets users disable shake/zoom). In Year Zero the *stress dice* and the panic roll are the horror engine; in 2d20 the *Momentum spend* is the fun decision. Rollers must foreground those, not just a sum.
6. **Keep heads up.** Phones must be glanceable: current state, one big action, private info. Long-form (journal, rules) is secondary. Owlbear Rodeo wins by being minimal and fast (groups run voice elsewhere); Alchemy RPG wins by being scene-first with handouts, journal, party panel and an X-Card in the player UI.
7. **Safety and session zero are cheap and high value.** Lines and veils, X-Card (anonymous, no justification), pause/rewind/fast-forward. For a horror game (Alien) it matters more, not less.
8. **A TV flat on a table is a different product from a monitor.** Pitfalls (anecdotal): grid scale must match physical size (1 inch squares need a measured px-per-inch; odd aspect ratios force crops), glare, parallax if a protective sheet sits above the glass, heat. Players sit on all sides, so offer rotate/flip and legible-from-any-side labels.
9. **Theme is a tool, not a costume.** Alien: Isolation got its look from restraint (CRT, soft low-fi, period type, limited palette), not piled-on effects. At TV distance, contrast and size beat ornament.
10. **Sessions end well with a recap and a payoff.** A session log exported as a recap, a "previously on" screen at start, and a clear end-of-session reward turn a one-off into a campaign.

**Opinionated bottom line:** the biggest wins per unit of effort are (1) a GM run view unifying scene/clue/handout/NPC/roll/log, (2) clocks and supply/pressure trackers shown on the TV, (3) a mechanically correct roller per universe with peak-moment feedback, (4) per-room fog and handouts-to-phone working flawlessly, (5) session zero + safety + recap. Do not chase dynamic line-of-sight, physics dice, or full encounter automation before those.

---

## (b) Feature backlog

Role = GM / Board (TV) / Player (phone) / Server. Agnostic = universe-agnostic engine feature (Y) or needs per-universe data/rules (N). Effort S (<1 day), M (1-3 days), L (>3 days). P0 = must-have for a great game night with this group. Research points: [GM] workflow, [PX] player experience, [VTT] board patterns, [SYS] Year Zero/2d20 specifics, [THEME], [STRUCT] session helpers; Sn = source in section (e).

| # | Feature | Why (research point, source) | Role | Agnostic? | Effort | Pri |
|---|---|---|---|---|---|---|
| 1 | **GM Run View**: one screen with current scene (narration, checks, events, NPC guidance, outcomes), next/prev scene, act switcher; one-tap actions below hang off it | [GM] Lazy DM: right info at the right moment (S1) | GM | Y | M | P0 |
| 2 | **Read-aloud to TV/phones**: "send narration" shows the paragraph as a fullscreen caption on the board (optional TTS) | [PX][VTT] scene-first immersion (S12) | GM, Board | Y | S | P0 |
| 3 | **Clue/secret objects** (id, text, source scene/NPC, found-by, status) with one-tap reveal to one/several/all players | [GM] Three Clue Rule, secrets and clues (S1, S2) | GM, Player | Y | M | P0 |
| 4 | **Handouts push** to selected phones with open animation, per-player seen receipt, re-openable drawer | [PX] handouts panel (S12); in pack schema already | GM, Player | Y | S | P0 |
| 5 | **Private GM-to-player messages** with priority levels, unread badge, vibrate; private player reply | [PX] private channels | GM, Player | Y | S | P0 |
| 6 | **Progress clocks** (4/6/8/custom segments; danger, racing, tug-of-war), visible on board and phone, GM ticks with one tap | [STRUCT] Blades clocks (S3, S4) | GM, Board, Player | Y | M | P0 |
| 7 | **Clocks attached to scenes**: scene config spawns a clock; full clock prompts the GM "what happens" | [STRUCT][GM] (S3) | GM | Y | S | P1 |
| 8 | **Year Zero roller**: d6 pool, push, stress dice, 6s = successes, stunts, panic trigger on stress-die 1 | [SYS] (S5, S6) | Player | N | M | P0 |
| 9 | **2d20 roller**: d20s vs target, Focus crits, complications, Momentum generation, buy extra d20 with Momentum/Threat | [SYS] (S7, S8) | Player | N | M | P0 |
| 10 | **Roll feed** on GM tablet and board (who, what, result, flags like panic/complication) | [GM][PX] shared roll log (S9) | GM, Board | Y | S | P0 |
| 11 | **Settle-then-celebrate roll feedback**: overlay + sound after dice stop; crit/botch styling; per-user reduce-motion and mute | [PX] (S10); accessibility (S12) | Player, Board | Y | S | P0 |
| 12 | **GM secret roll** (visible only to GM, optional reveal) | [GM] secret rolls | GM | Y | S | P1 |
| 13 | **Session zero screen**: tone, content-warning checklist, anonymous lines and veils, safety-tool explainer; stored per session | [GM] safety (S13, S14, S15) | GM, Player | Y | M | P0 |
| 14 | **X-Card / pause button on every phone** (anonymous; GM sees neutral "PAUSE"); optional rewind/fast-forward | [GM] safety (S13, S15) | Player, GM | Y | S | P0 |
| 15 | **Pack contentWarnings surfaced** in session zero and compared with collected lines | [GM] safety; field exists in schema | GM | Y | S | P1 |
| 16 | **Session log** (auto: scene changes, rolls, handouts, clocks, damage, fog reveals; manual GM notes) | [STRUCT] recap/export | Server, GM | Y | M | P0 |
| 17 | **Recap export** (markdown/PDF; optional Claude-written narrative summary) | [GM][STRUCT] recap | GM | Y | M | P1 |
| 18 | **"Previously on..." board screen** at session start from last recap | [PX] recap | Board | Y | S | P1 |
| 19 | **Session persistence and resume** (snapshot per mutation, resume-game, reconnect by name) | [GM] table trust; ARCHITECTURE marks it NOT YET IMPLEMENTED | Server | Y | M | P0 |
| 20 | **Room-based fog with dissolve reveal** and auto-reveal when a PC token enters | [VTT] fog is core to simple VTTs (S16) | Board, GM | Y | M | P0 |
| 21 | **Board orientation controls + labels legible from any side** (radial or dual labels) | [VTT] players on all sides (S17) | Board | Y | M | P1 |
| 22 | **Calibration wizard**: enter TV diagonal or measure with a ruler, compute px/inch, lock scale so 1 square = 1 inch for physical minis | [VTT] 1-inch pitfall (S17) | Board | Y | M | P1 |
| 23 | **Board safe layout**: big type, overscan margin, no chrome where players lean | [VTT][THEME] (S17) | Board | Y | S | P1 |
| 24 | **Zone overlay**: Alien Engaged/Short/Medium/Long; Dune named zones with links; tokens snap to zones | [SYS] both systems use zones (S6, S8) | Board, GM | N | M | P1 |
| 25 | **Token status rings/badges** (stress, broken, panicking, burning, hidden, wounded): color + icon | [VTT] status rings (S19) | Board | Y | M | P0 |
| 26 | **Initiative tracker with system adapters**: Alien fast/slow action pips and initiative cards (**VERIFY** deck range); Dune nominate-next and Keep the Initiative (2 Momentum or 2 Threat) | [GM][SYS] (S6, S8) | GM, Board | N | M | P0 |
| 27 | **Active-turn highlight** on TV (pulsing ring + name strip) and "YOUR TURN" on acting phone | [VTT][PX] | Board, Player | Y | S | P0 |
| 28 | **NPC/creature quick cards**: health, armor, attacks, one-tap damage/heal, conditions | [GM] monster tracking (S9) | GM | N | M | P0 |
| 29 | **Conditions and critical injuries applicator** (Alien d66 rolled or picked; Dune injuries/traits) with mechanical text shown on sheet | [SYS] (S6); BOARD_AND_BUILDER s6 | GM, Player | N | M | P1 |
| 30 | **Ping/pointer** from phones to board, per-player color | [VTT] (S16); already specced | Player, Board | Y | S | P1 |
| 31 | **Measurement tool** (zones or inches after calibration) | [VTT] | GM, Board | Y | M | P2 |
| 32 | **GM-only map layer** (hidden tokens, traps, notes) with show-to-board toggle | [VTT] map layers (S19) | GM | Y | M | P1 |
| 33 | **Token palette from pack** (NPCs, threats, items, markers), drag to map, send item to player | BOARD_AND_BUILDER s4 | GM | Y | M | P0 |
| 34 | **Loot moment**: item given to a player = phone toast + sound + board flash; inventory with weight (Alien STR x2, **VERIFY**) | [PX] agency, loot | Player, GM | Y | M | P0 |
| 35 | **Shared party stash** (spare ammo, ship stores) visible on all phones | [PX] party view (S12) | Player, GM | Y | S | P1 |
| 36 | **Party view tab**: other PCs' portrait, health/stress (public fields only) | [PX] party panel (S12) | Player | Y | S | P1 |
| 37 | **Player journal/notes** (private notes + auto "clues I found"), exportable | [PX] journals (S12) | Player | Y | M | P1 |
| 38 | **Sheet auto-math** with tap-to-roll from a skill (pool preview) | [PX] D&D Beyond sheet (S9) | Player | N | M | P0 |
| 39 | **Advancement/XP screen**: GM awards end-of-session XP; player spends with validation | [GM][PX] leveling/downtime | GM, Player | N | L | P2 |
| 40 | **Alien consumables tracker**: Air, Power, Food, Water ratings with Supply Roll button (N stress-style dice, each 1 drops rating one step) and a board strip | [SYS] supply rolls (S5) | GM, Board | N | M | P0 |
| 41 | **Ammo/armor/encumbrance per item** | [SYS] scarcity | Player | N | M | P2 |
| 42 | **Panic flow**: panic roll result applies a named effect; phone shows effect text, board shows ring, GM sees it | [SYS] panic (S5) | Player, Board, GM | N | M | P0 |
| 43 | **Push and stress feedback**: stress bar animates, warning at 7+ | [SYS] | Player | N | S | P1 |
| 44 | **Momentum and Threat pools** (Momentum public; Threat GM-side, start about 2 per player, **VERIFY**; cap commonly 6, **VERIFY**) | [SYS] (S7, S8, S20) | GM, Player, Board | N | M | P0 |
| 45 | **Drive statements and Determination UI** | [SYS] **VERIFY** rules first | Player | N | M | P1 |
| 46 | **Traits and Assets** (scene traits; asset cards Quality 0-4; GM create/change/remove trait costs 2 Threat) | [SYS] (S8) | GM, Player | N | M | P1 |
| 47 | **Dune conflict runner**: type (duel/skirmish/warfare/espionage/intrigue), zones, assets, round tracker | [SYS] (S8) | GM, Board | N | L | P1 |
| 48 | **NPC agenda cards by act** on the run view ("what they do if ignored") | [GM][SYS] agendaByAct | GM | Y | S | P0 |
| 49 | **Personal agenda reveal**: per-act private card pushed to each player at act start | [PX][SYS] Alien agendas (S6) | GM, Player | Y | S | P0 |
| 50 | **Act progress bar** with mandatory-scene checklist and optional playtime pacing | [GM] pacing; cinematic structure (S6) | GM | Y | S | P1 |
| 51 | **Pacing nudges** (configurable "no roll in 20 min") | [GM] pacing | GM | Y | S | P2 |
| 52 | **Spotlight tracker** (who has acted/rolled recently; highlight quiet players) | [GM] spotlight | GM | Y | S | P1 |
| 53 | **Ambient audio and stingers** from packs on the board speaker; phones muted by default | [VTT][THEME] (S12, S21) | GM, Board | Y | M | P1 |
| 54 | **Alien motion tracker widget** on board, driven by tokens flagged `trackable` (never leaks hidden tokens) | [THEME][SYS] (S21, S24) | Board, GM | N | M | P1 |
| 55 | **Random/encounter tables** in packs (d6/d66/d20) with roll button, result to log | [STRUCT] | GM | Y | S | P1 |
| 56 | **Name generators and loot tables** per universe | [STRUCT] | GM | N | S | P2 |
| 57 | **Generator wizard** (GameNightWizard: params, preview, edit, save, start) emitting clocks, clues, tables | [STRUCT]; ARCHITECTURE | GM | Y | L | P1 |
| 58 | **Pack schema additions**: `clocks[]`, `clues[]`, `tables[]`, `scene.ambient`, `scene.clueRefs` | enables rows 3, 6, 53, 55 | Server | Y | M | P0 |
| 59 | **Theatre-of-mind mode**: board shows scene art/title card instead of map, one-tap switch | [VTT] fallback (S12) | Board, GM | Y | S | P0 |
| 60 | **Scene art/image push to board** (full-bleed with caption) | [VTT] (S12) | GM, Board | Y | S | P0 |
| 61 | **Downtime screen**: stress relief, healing, resupply, XP checklist | [GM] downtime | GM | N | M | P2 |
| 62 | **Reconnect-safe phones** (rejoin by name, "connection lost" banner, no lost rolls) | [PX] reliability | Player | Y | S | P0 |
| 63 | **GM undo/redo** for token moves, HP edits, clock ticks (last 20) | [GM] table mistakes | GM | Y | M | P1 |
| 64 | **Board wake lock, auto-fullscreen, hidden cursor, burn-in-safe idle drift** | [VTT][THEME] TV | Board | Y | S | P0 |
| 65 | **30-second new-player onboarding card** per universe | [PX] | Player | N | S | P2 |
| 66 | **Rules quick-reference on GM tablet** with search and pin-to-run-view | [GM] lookup speed | GM | N | S | P1 |
| 67 | **Dynamic line-of-sight fog** | [VTT] Foundry walls/vision (S19); high cost, poor fit for room play | Board | Y | L | P2 |
| 68 | **Physics 3D dice** | [PX] no engagement evidence (S10) | Player | Y | L | P2 |
| 69 | **In-app voice/chat** (do not build) | [VTT] groups use voice elsewhere (S16); table is in person | n/a | Y | L | P2 |

### Suggested milestones
- **M1 "Good night out of the box":** rows 1, 2, 4, 5, 8, 9, 10, 11, 19, 20, 25, 26, 27, 33, 34, 38, 59, 60, 62, 64.
- **M2 "Pressure and story":** rows 3, 6, 13, 14, 16, 28, 40, 42, 44, 48, 49, 58.
- **M3 "Depth":** all remaining P1.

---

## (c) Design notes: Alien (Year Zero) and Dune (2d20)

### Alien RPG

Confirmed by sources (S5, S6): pool = Attribute + Skill + gear/talent bonus **plus stress dice equal to current Stress**; each 6 is a success, extra 6s are stunts; a 1 on a stress die triggers a **panic roll** (1d6 + current Stress); a new panic effect replaces the old one, and higher totals are more severe; you may **push** a failed roll (gaining Stress); damage and horrific revelations raise Stress; conditions like starving or freezing block stress relief. 0 Health = Broken, d66 critical injury table. Combat uses zones and one fast + one slow action (or two fast) per turn (S6). **Supplies** (air, power, food, water) are ratings; a Supply roll uses stress dice equal to the rating and each 1 reduces it by one (S5). Cinematic play = pre-written scenarios in acts with personal agendas; Campaign = sandbox. Reviewers advise being strict about air, giving players information rather than hoarding secrets, and playing agendas in the open (S6).

Model it:
1. **Character state:** `health`, `stress` (0-10), `statusEffects`, `panic {active, key, text, sinceRound}`, `broken`, `injuries[]`. Stress is public on the party view; panic effect text is private plus a board ring.
2. **Roller:** normal and stress dice in different colors (stress = `--warn`). Output: successes, stunts, count of stress 1s. A **Panic button appears only when a stress 1 shows**; never auto-resolve silently, the GM may want to narrate. Push adds Stress with an animation and a warning at 7+.
3. **Panic:** server-side 1d6 + stress against `catalog/panic.json` (`min`, `name`, `text`, `duration`). Result private to player, public to GM, ring only on board.
4. **Supplies:** `supplies {air, power, food, water}` at session level (optionally food/water per PC). GM Supply Roll button shows which 1s dropped a rating; board SupplyBar with pips. Air at 0 prompts a danger clock.
5. **Critical injuries:** d66 table as data with `lethal`, `timeLimit`, `healBy`. A timed injury is a **clock** attached to the character and visible on the medic's phone.
6. **Agendas:** `agendaByAct` private per player; push the new card with vibrate on act change; GM sees `agendaNotes` pressure suggestions.
7. **Cinematic structure:** act bar + mandatory scene checklist; require GM override to close an act with mandatory scenes outstanding. Cinematic modules suit low-level characters; do not build deep progression first.
8. **Initiative:** per-round initiative cards (**VERIFY** deck range) with fast/slow action pips the GM taps off.
9. **Do not automate:** xenomorph crit bookkeeping (reviewers found it too heavy) and drug stress-relief house rules (optional toggles only).

### Dune: Adventures in the Imperium

Confirmed by Roll20 compendium and fan sources (S7, S8, S20): **Momentum** is the player pool; **Threat** is the GM pool (usually 2 per player at start). Players buy extra d20s with Momentum or add to Threat when low. GM spends Threat: bonus dice (1/2/3 for first/second/third), +1 Difficulty (2 each), buy off NPC complications (2), change/remove/create a trait (2), environment effects, rival House action (1). Conflicts are divided into **zones**; types: duels, skirmishes, warfare, espionage, negotiations/intrigue (intrigue treats all zones as adjacent). One action per character per round; the acting side nominates the next actor or **Keeps the Initiative** for 2 Momentum/2 Threat (extra action, +1 Difficulty). **Assets** have Quality 0-4, tangible or intangible.

**VERIFY** (not retrieved): Momentum cap, Determination, Drive statements, Focus doubling crits, complication ranges, Repercussions, Difficulty ladder.

Model it:
1. **Meters:** `momentum` (public on every phone and board), `threat` (GM tablet, optional vague tension gauge on board). Server-authoritative; every change logged with a reason.
2. **Roller:** inputs Attribute, Skill, Focus, Difficulty, bought d20s (counter of Momentum spent / Threat added). Output: successes, complications, crits, Momentum generated, and **spend buttons** (Obtain Information, Create Trait, Keep the Initiative, Reroll...). The spend menu is the fun; do not show a bare total.
3. **Drives/Determination:** five Drives with statements; roller offers "Use Drive"; Determination as a prominent chip on the phone. Verify rules first.
4. **Traits/Assets:** scene `traits[]` on the board strip ("Sandstorm", "Hostile Room"); per-character `assets[]` with Quality pips; GM trait edits cost 2 Threat and auto-decrement.
5. **Conflict runner:** `type`, `zones[]` with links, `participants[]`, round, `whoseTurn`, nominate-next UI handling Keep the Initiative. Reuse the board for zones, clocks for objectives ("escape the sandworm").
6. **Intrigue/espionage:** theatre-of-mind mode plus clocks for influence/exposure; a map adds nothing.
7. **Politics:** a relationships board (NPC cards with disposition and leverage, house standing) is worth more than combat tools for Dune.
8. **Pacing:** surface Threat as a GM nudge ("Threat 9: spend it or something happens").

---

## (d) Visual and theme guidance

Evidence: Alien: Isolation achieved authenticity through restraint and period constraints (1970s CRT, VHS-soft look, period typefaces) rather than layered effects (S21-S24). Dune (2021) identity came from a pre-built "visual bible", architectural references, restricted palettes and lighting-driven mood (S25, S26). I found no primary source on in-universe UI design for the Dune film.

### Board (TV) rules for both themes
- Body text >= 28-32 px at 1080p; token labels >= 20 px; contrast >= 7:1 for anything read from 1.5 m on any side.
- Persistent elements stay still except the current-turn ring and clock changes; other motion is event-driven, under 800 ms.
- Static UI drifts 1-2 px every few minutes and dims after 10 min idle (burn-in).
- No scanlines or flicker on the board by default (moire, glare); optional subtle setting.

### ALIEN (MU/TH/UR)
Do:
- Near-black background, one phosphor accent (current `--accent #00d4aa` is fine; amber for caution; red strictly for danger/panic). One color = one meaning everywhere.
- Monospace for data (Share Tech Mono); Orbitron for headings only; all caps with tracking in labels, never in paragraphs.
- Boot sequence <= 1 s, skippable, status lines truthful (UPLINK ACTIVE only if the socket is connected).
- Sound: low hum bed, tiny UI ticks, one alarm stinger reserved for panic/emergency; phones muted by default.
- Diegetic widgets: motion tracker, supply bars, COMM LINK message styling, company-form headers on handouts.
- Pair color with shape/icon for status (color-blind safety).

Don't:
- Heavy scanlines, chromatic aberration, constant flicker, or glitch text over readable content.
- Neon cyberpunk glow (wrong era; Alien is lo-fi 1979 tech).
- More than two type families; small mixed-case monospace paragraphs on phones.
- Spoilers in boot text or log lines visible on the board.
- Full-screen red flashes; honor `prefers-reduced-motion`.

### DUNE
Do:
- Earth and sand palette: warm desaturated ochres, burnt orange, deep shadow blue. Either sand surfaces with dark text or dark mode with sand-toned type.
- Wide-spaced serif or humanist sans headings, large and sparse; plain legible sans for body; monospace only for coordinates/technical data.
- Negative space, monolithic blocks, strong horizontal/vertical alignment (brutalist architecture, S25).
- Slow fades, drifting dust, wind bed; one heavy "thump" for Threat spends and complications.
- Single-color glyphs for Houses/factions; asset Quality as pips 0-4; Momentum as granule counters; Threat as a dark gauge with a numeric label.

Don't:
- Reuse Alien terminal chrome (scanlines, boot text); use a sandstorm wipe or no boot.
- Glossy gradients, HUD angles, lens flares.
- Low-contrast beige-on-beige small text.
- Cute desert clip-art or decorative use of real religious/cultural marks.

### Phone rules (both)
- One primary action per state, thumb-reachable at the bottom.
- Dark default so phones do not light faces at the table.
- X-Card, reduce motion and mute always one tap away in a gear menu (as Alchemy does, S12).

---

## (e) Sources

- S1 Sly Flourish, Eight Steps of the Lazy DM: https://slyflourish.com/eight_steps_2023.html ; at the table: https://slyflourish.com/using_the_8_steps_at_the_table.html ; reusing secrets and clues: https://www.goodreads.com/author_blog_posts/24034659-re-using-secrets-and-clues
- S2 The Alexandrian, Three Clue Rule: https://thealexandrian.net/?p=7985 ; node design: https://thealexandrian.net/creations/misc/node-design/node-design2.html ; Secret Life of Nodes: https://thealexandrian.net/wordpress/45268/roleplaying-games/the-secret-life-of-nodes-part-2-node-based-campaigns
- S3 Sly Flourish, Progress Clocks in D&D: https://slyflourish.com/progress_clocks_in_dnd.html ; Mechanics to Steal: Clocks https://sidrdesai.substack.com/p/mechanics-to-steal-clocks
- S4 Roll20 Blades in the Dark progress clocks: https://roll20.net/compendium/BITD/Progress%20clocks ; Foundry clocks module: https://foundryvtt.com/packages/clocks/
- S5 Alien stress/panic: https://blackcampbell.substack.com/p/alien-rpg-stressed-out-but-not-panicked ; https://gamersplane.com/forums/thread/31875 ; Goonhammer https://goonhammer.com/tabletop-horror-alien-rpg-starter-set-review ; supply summary via TV Tropes https://www.tvtropes.org/pmwiki/pmwiki.php/TabletopGame/AlienTheRoleplayingGame
- S6 Mega-review of the Alien RPG (actions, zones, crits, cinematic vs campaign): https://uncannypuppetry.substack.com/p/mega-review-the-alien-rpg ; Nerdarchy https://nerdarchy.com/alien-rpg-alien-destroyer-of-worlds-a-masterclass-in-cinematic-sci-fi-horror-roleplaying/ ; Bloody Disgusting Evolved review https://bloody-disgusting.com/reviews/3924630/the-evolved-edition-of-alien-the-roleplaying-game-adds-even-more-to-an-already-great-ttrpg-review/
- S7 Modiphius Dune blog: https://modiphius.us/blogs/news/dune-2-gaming-in-the-imperium ; ENWorld: https://www.enworld.org/threads/a-look-inside-dune-2d20.679418/post-8249082 ; Modiphius forum: https://forums.modiphius.com/t/the-questions-and-reasoning-on-few-unobvious-mechanics/18401
- S8 Roll20 Dune compendium: Threat https://roll20.net/compendium/DUNE/Threat ; Conflict https://roll20.net/compendium/DUNE/The%20Basics%20of%20Conflict ; Scenes and Traits https://roll20.net/compendium/DUNE/Scenes%20and%20Traits
- S9 D&D Beyond: https://www.dndbeyond.com/changelog/966-monster-dice-rolling-for-the-encounter-builder ; https://www.dndbeyond.com/resources/1793-what-is-d-d-beyond
- S10 Foundry Yugen Criticals: https://www.foundryvtt-hub.com/package/yugen-criticals/ ; Shard animated dice: https://www.shardtabletop.com/blog/animated-dice
- S11 Mothership (panic on d20 under Stress; ship failure gives crew Stress): https://bloody-disgusting.com/reviews/3812933/review-tabletop-rpg-mothership-has-all-the-tools-for-exploring-the-terrifying-corners-of-outer-space/ ; https://mothership-boxed-set.backerkit.com/hosted_preorders/project_updates?page=4 . A 2026 blog claiming official Foundry/Roll20/app support was unverified and not used.
- S12 Alchemy RPG: https://help.alchemyrpg.com/en/articles/9714185-gamemaster-orientation ; https://help.alchemyrpg.com/en/articles/9821384-player-orientation ; https://help.alchemyrpg.com/en/articles/9821311-creating-a-scene ; TechRaptor (promotional) https://Techraptor.net/tabletop/interviews/alchemy-rpg-vtts-and-focus-on-roleplaying
- S13 Safety tools: https://2d10plus.substack.com/p/session-zero-safety-tools-etc ; Roll20 lines and veils https://bloghub.roll20.net/posts/guest-blog-an-introduction-to-lines-and-veils
- S14 Daggerheart session zero: https://www.daggerheart.com/sessionzero/
- S15 RPG safety tools guide: https://crowscorner.bearblog.dev/playing-with-care-a-guide-to-rpg-safety-tools/ ; MCDM toolkit https://www.patreon.com/posts/73512191
- S16 Owlbear Rodeo: https://docs.owlbear.rodeo/docs/getting-started/ ; https://slyflourish.com/owlbear_rodeo.html ; https://www.enworld.org/threads/lightweight-simple-vtts.709359/
- S17 TV tabletop pitfalls (anecdotal): https://www.enworld.org/threads/lcd-gaming-table-concerns.465335/ ; https://www.fantasygrounds.com/forums/archive/index.php/t-33813.html ; https://app.roll20.net/forum/post/11019417/battle-maps-and-sizing/ ; https://teddit.bsalzberg.com/r/DnDIY/comments/1lmtybo/using_plexiglass_over_a_tv_for_digital_battle
- S19 Foundry VTT release notes: https://foundryvtt.com/releases/7.83 ; https://www.foundryvtt-hub.com/article/tokens
- S20 Roll20 Dune Tools and Resources: https://roll20.net/compendium/DUNE/Tools%20and%20Resources
- S21 Alien: Isolation UI/lo-fi: https://www.engadget.com/2014-10-07-alien-isolation-launch-interview.html ; https://www.pcgamer.com/uk/why-i-love-the-low-fi-tech-of-alien-isolation ; https://hudsandguis.com/home/2014/06/04/alien-isolation ; https://artofthetitle.com/title/alien-isolation ; https://fontsinuse.com/uses/77513/alien-isolation-video-game
- S22 GameSpot: https://gamespot.com/articles/baked-in-the-past-the-lo-fi-sci-fi-of-alien-isolation/1100-6418409/
- S23 Xbox retro gadgets: https://news.xbox.com/en-us/2014/09/24/games-8-awesome-retro-gadgets-in-alien-isolation/
- S24 TechRadar: https://www.techradar.com/news/gaming/the-technology-of-fear-how-alien-isolation-will-scare-you-back-to-the-1970s-1267946
- S25 Dune production design: https://www.thewrap.com/dune-production-design-visual-bible ; https://domusweb.it/en/architecture/2024/02/28/the-architecture-of-dune.html
- S26 Dune cinematography/palette: https://theasc.com/article/dune-fear-is-the-mind-killer/ ; https://www.motionpictures.org/2024/03/dune-part-two-cinematographer-greig-fraser-on-building-the-bloodless-light-of-giedi-prime/ ; https://www.thewrap.com/dune-part-two-fremen-culture/

**Research gaps:** no primary source for Dune film in-universe UI; Alien supply rules came from a secondary summary; Dune Momentum cap and Determination text not retrieved; no engagement data on dice animations; Blades-in-the-Dark core text not read directly. Everything marked **VERIFY** must be checked against the Alien Evolved Edition and Dune core books before coding.
