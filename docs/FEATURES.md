# Feature inventory

What is implemented, mapped to the research backlog in [`RESEARCH_GM_PLAYER_EXPERIENCE.md`](RESEARCH_GM_PLAYER_EXPERIENCE.md) section (b) (row numbers are that table's `#`).
Status was decided by reading the code, not the plans: **done** = works end to end (UI plus server where it needs one), **partial** = part of the row exists (the gap is named), **not yet** = nothing in the code.
Paths are under `web app/src/engine/components/` (client) or `web app/server/` unless stated. Event names are Socket.io events (`ARCHITECTURE.md`, Sessions).
Regression coverage: `scripts/test-session-features.mjs` (rows 2-6, 13-16, 34, 48, 49, 58-60, 62), `test-mechanics.mjs` (10, 11, 26-28, 40, 42, 44, 45), `test-board.mjs` (20, 25, 30, 33), `test-sessions.mjs` (19), `test-hardening.mjs` (security); the client UI has no automated tests.

| # | Feature | Status | Where |
|---|---|---|---|
| 1 | GM Run View: scene card, prev/next, act switcher | done | `run/RunView.jsx`, `run/RunScene.jsx`; `run-set` |
| 2 | Read-aloud to TV/phones (caption, card, optional TTS) | done | RunScene SEND TO TABLE / AS CARD; `narrate`, `narrate-clear`; `board/Overlays.jsx`, `player/PhoneLayer.jsx`; `hooks/useTTS.js` |
| 3 | Clue/secret objects with one-tap reveal and found-by | done | `run/CluesPanel.jsx`; `clue-upsert`, `clue-reveal`, `clue-hide`, `clue-revealed`; phone FILES (`player/HandoutsPane.jsx`) |
| 4 | Handouts push with open animation, seen receipts, re-openable | done | `run/HandoutsPanel.jsx` (burn-after-reading timer, SHOW ON TV as a document), `player/HandoutViewer.jsx`, `player/HandoutDoc.jsx`, `player/HandoutsPane.jsx`; `handout-send`, `handout-seen`, `handout-received` |
| 5 | Private GM-player messages, priorities, unread badge, vibrate | done | `DMDashboard.jsx` (messages, log, N NEW), `PlayerView.jsx` COMMS; `send-message`, `broadcast-message`, `player-message`, `player-to-player` |
| 6 | Progress clocks (danger / racing / tug, public or GM-only) | done | `run/ClocksPanel.jsx`, `run/ClockRing.jsx`, `player/ClocksRow.jsx`, `board/Overlays.jsx`; `clock-upsert`, `clock-tick`, `clock-remove`, `clock-ticked` |
| 7 | Clocks attached to scenes, full clock prompts the GM | partial | Pack `clocks[]` are seeded into the session once (`session-seed`) and a full clock is tagged FULL in `ClocksPanel.jsx`; a scene cannot spawn a clock and nothing prompts "what happens" |
| 8 | Year Zero roller (pool, push, stress, panic trigger) | done | `universes/alien/components/YzeDiceRoller.jsx`; roll payload `kind:'yze'` |
| 9 | 2d20 roller (Focus, complications, Momentum, bought dice) | done | `universes/dune/components/D20DiceRoller.jsx`; roll payload `kind:'2d20'` |
| 10 | Roll feed on GM and board | done | `run/RollFeed.jsx`, DMDashboard ROLLS; `player-roll`, `roll`, `board-roll`; the TV plays every public roll as an animated dice stage (`board/DiceStage.jsx`, mounted from `board/Overlays.jsx`: seeded tumble, lit hits, result card, pushed re-tumble, queue, reduced-FX fallback) |
| 11 | Settle-then-celebrate feedback, crit/botch, reduce-motion and mute | done | `player/fx.js`, `sfx.js` (per-universe `theme.sfx`), `Header.jsx` `FxToggles` (REDUCE FX, MUTE, per device) |
| 12 | GM secret roll | done | `gm-roll` (GM feed and log only, never the TV): threat cards' ROLL ATTACK (SECRET) in `run/ThreatsPanel.jsx` logs the signature lookup plus the full attack pool (dice, successes, HIT/MISS, damage; `mechanicsUtils.resolveSignatureAttack`), and the GM DICE ROLLER tab has a TV / SECRET / LOCAL route control (`DiceRoller.jsx`): TV (default) sends `gm-roll { secret:false }` so the table screen plays the roll like a player's, SECRET keeps it to the feed and log, LOCAL keeps it on the GM screen |
| 13 | Session zero screen (tone, warnings, lines and veils) | done | `run/SessionZeroPanel.jsx` (before INITIALIZE), `player/PhoneLayer.jsx` BEFORE WE BEGIN; `safety-set`, `safety-confirm` |
| 14 | X-card / pause on every phone, anonymous | done | `player/PauseButton.jsx`; `pause-request`, `pause-requested`, `pause-clear`; TV PAUSE card. No rewind/fast-forward |
| 15 | Pack content warnings in session zero | done | SessionZeroPanel pre-fills from `meta.contentWarnings` and `meta.tone` |
| 16 | Session log (auto plus manual notes) | done | `sessionLog.js`; `run/SessionLogPanel.jsx`; `log-note`, `log-entry` |
| 17 | Recap export | partial | Markdown download (`run/recap.js`, EXPORT RECAP); no PDF, no Claude-written narrative |
| 18 | "Previously on..." board screen from the last recap | not yet | No code; recaps are not stored or shown to the TV |
| 19 | Session persistence and resume | done | `persistence.js`, `sessions.js`; `resume-game`, `list-resumable`, `rejoin-game`; `SessionScreen.jsx` RESUME and TAKE OVER. Name-only rejoin is a GM-approved seat claim, not automatic |
| 20 | Room fog with dissolve reveal, auto-reveal on PC entry | done | `board.js`, `board/RoomLayer.jsx`, `board/MapCanvas.jsx`; `board-room-set`, `board-fog`, `board-token-move` |
| 21 | Board orientation controls, labels legible from any side | done | MapController ROTATE / FLIP / ZOOM / AS TV; `board-view`; chips and labels counter-rotated (single orientation, no dual labels) |
| 22 | Calibration wizard (px per inch, 1 square = 1 inch) | not yet | Only a per-map `grid` fraction (`mapDefs.js`); no TV-size calibration |
| 23 | Board safe layout (big type, overscan, no chrome) | partial | `BoardView.jsx` is chrome-free with a thin status strip and theme palette; no overscan margin control |
| 24 | Zone overlay (Alien range bands, Dune zones) | not yet | Rooms only; ranges exist as reference text, not as an overlay |
| 25 | Token status rings and badges | done | `board/TokenChip.jsx` (`STATUS_DEFS`, panic ring, stress count), status picker in MapController; theme `board.statusStyle` |
| 26 | Initiative tracker with system adapters | done | `run/InitiativePanel.jsx`, DMDashboard INITIATIVE; `init-set`, `init-step`, `init-goto`, `init-round`, `init-end`; `rules.initiative` (ALIEN cards fast/slow, DUNE nominate + keep) |
| 27 | Active-turn highlight and YOUR TURN | done | `your-turn`, `turn-changed`; phone banner (+ PASS TO for DUNE, `init-pass`); TokenChip `active`; TV turn strip |
| 28 | NPC/creature quick cards | done | `run/ThreatsPanel.jsx`; token `hp`, `hpMax`, `ref`; secret attack roll via `gm-roll` |
| 29 | Conditions and critical injuries applicator | done | `InjuryPicker.jsx`, DMDashboard player editor; `injury-add`, `injury-remove`; conditions toggles; effects text on `CharacterSheet.jsx` |
| 30 | Ping from phones, per-player colour | done | `board-ping` (1 per second per socket); `player/TablePane.jsx` PING, MapController PING |
| 31 | Measurement tool | not yet | No code |
| 32 | GM-only map layer with show-to-board toggle | partial | Hidden tokens, token and room notes and GM-only clocks never reach the TV (`board.js` `viewFor`); no separate layer to toggle |
| 33 | Token palette from pack, drag to map, send item to player | done | `MapController.jsx` (CREW, THREATS, NPCS, ITEMS, MARKERS; tap-to-arm; send to player); `board-token-upsert` |
| 34 | Loot moment (toast, sound, board flash) with weight | done | `item-received`, `board-flash`; encumbrance (`rules.encumbrance`) on sheet and builder (`catalogUtils.js` `encumbrance`) |
| 35 | Shared party stash | not yet | No code |
| 36 | Party view tab (other PCs, public fields) | not yet | Phones see allies only in the DUNE PASS TO list |
| 37 | Player journal and notes | partial | "Clues I found" with finders in FILES; no private notes, no export |
| 38 | Sheet auto-math with tap-to-roll | done | `CharacterSheet.jsx` + `catalogUtils.js` `skillPool`; ROLL opens DICE with `preset` |
| 39 | Advancement / XP screen | not yet | No code |
| 40 | Alien consumables tracker with Supply Roll | done | `SupplyPanel.jsx`; `supply-set`, `supply-roll`, `supply-rolled`; TV SUPPLY strip (`rules.supplies`) |
| 41 | Ammo, armor, encumbrance per item | partial | Encumbrance and armor rating on sheet/builder; no ammo tracking |
| 42 | Panic flow | done | `player/PanicOverlay.jsx`; `panic-result`, `panic`, `board-panic`; `rules.panic`, `catalog/panic.json` |
| 43 | Push and stress feedback | partial | Pushing adds stress to the track, tracks colour via `rules.tracks[].danger`; no dedicated animation or warning card |
| 44 | Momentum and Threat pools | done | `run/PoolCounters.jsx`; `pools-init`, `pool-set`, `pool-delta`, `pool-changed`; `rules.pools`; TV pool meters |
| 45 | Drive statements and Determination UI | done | Drive statements: builder step and sheet (`builder/steps.jsx`, `CharacterSheet.jsx`, schema `driveStatements`); drives assigned from the fixed array 8/7/6/5/4 (`rules.creation.attrArray`, tap/drag-to-assign + SUGGESTED); Determination (`rules.determination`, 0–3, starts 1): phone top-bar chip with SPEND (`determination-spend`, GM roll feed), GM GRANT +1 in the player editor (`determination-grant`) |
| 46 | Traits and Assets | not yet | No code |
| 47 | Dune conflict runner | not yet | Cheat sheets only (`universes/dune/components/DuneCheatSheets.jsx`) |
| 48 | NPC agenda cards by act ("if ignored") | done | RunView AGENDAS tab (NPC cards, SHOW SECRETS) |
| 49 | Personal agenda reveal per act | done | `advance-act`, `new-orders`; SEND AGENDA CARDS; phone FILES |
| 50 | Act progress with mandatory checklist and pacing | partial | Act switcher with progress, MANDATORY tags and DONE ticks (`table.run.completed`); no playtime pacing |
| 51 | Pacing nudges | not yet | No code |
| 52 | Spotlight tracker | not yet | No code for "who has not acted lately" (the TV combat SPOTLIGHT, F2 below, is a different thing) |
| 53 | Ambient audio and stingers on the board speaker | done | rail AUDIO popover (`Nav.jsx`: STINGERS routed TV / TV + PHONES / HERE, AMBIENCE from `theme.ambient`), `soundboard.js`, `hooks/useAmbientAudio.js`, `board/BoardAudio.jsx`; `table-sfx`; scene `ambient` presets; TV plays with `?board=CODE&audio=1` (F3) |
| 54 | Alien motion tracker widget | done | On the phone rather than the board: `player/TrackerPane.jsx` (TRACKER tab), contacts from moving / signal-flagged tokens, GM grant in the CREW drawer; `tracker-set`, `tracker-signal` (F1) |
| 55 | Random/encounter tables in packs | not yet | Pack schema has no `tables[]` |
| 56 | Name generators and loot tables | not yet | No code |
| 57 | Generator wizard | done | `GameNightWizard.jsx`, `wizard/generateClient.js`; `POST /api/generate`; emits `clocks[]` and `clues[]` (not tables) |
| 58 | Pack schema additions | partial | `clocks[]`, `clues[]`, `scene.clueRefs`, `scene.ambient` exist (also `act.sceneArt`, `handouts[].image`, `characters[].driveStatements`); `tables[]` does not |
| 59 | Theatre-of-mind mode | done | RunView MAP / THEATRE; `board-mode`; `table.boardMode` |
| 60 | Scene art / image push to the board | done | `narrate` mode `card` with `art`, theatre `art` from `act.sceneArt`, handout SHOW ON TV |
| 61 | Downtime screen | not yet | No code |
| 62 | Reconnect-safe phones | done | `GameContext.jsx` outbox (`muthur.outbox`), CONNECTION LOST banner in `PlayerView.jsx`; dedupe by `clientId`; `rejoin-game` by seat token |
| 63 | GM undo/redo | not yet | No code |
| 64 | Board wake lock, fullscreen, hidden cursor, burn-in drift | done | `BoardView.jsx` (wake lock, tap for fullscreen), `board/MapCanvas.jsx` (cursor hides after 3 s, 1-2 px drift every 60 s, dim after 10 min) |
| 65 | New-player onboarding card per universe | not yet | Only the boot overlay (`fx/BootSequence.jsx`) |
| 66 | Rules quick-reference on the GM tablet | partial | Per-universe reference tabs (ALIEN Weapons, Vehicles, Xenomorphs, Cheat Sheets; DUNE reference and cheat sheets); no search, no pin-to-run-view |
| 67 | Dynamic line-of-sight fog | not yet | By design; fog is per room |
| 68 | Physics 3D dice | not yet | Not planned |
| 69 | In-app voice/chat | not yet | Do not build (per the research) |

Counts: 40 done, 10 partial, 19 not yet (of 69).

## Feature wave (F1–F7)

Regression tests: `scripts/test-tracker.mjs`, `test-camera.mjs`, `test-sfx.mjs`, `test-portrait.mjs`, `test-recap.mjs`, `test-intrigue.mjs`, `test-dice-stage.mjs`, plus `test-polish-b.mjs` for the follow-up polish.

| # | Feature | Status | Where |
|---|---|---|---|
| F1 | Motion tracker (ALIEN): phone TRACKER tab with a 60° fan, range rings, blips, nearest distance and a ping that speeds up; contacts are moving or signal-flagged npc/creature tokens; available from gear or a GM grant | done | `player/TrackerPane.jsx`, `player/tracker.css`, `PlayerView.jsx` (tab), `run/CrewDrawer.jsx` (GRANT / REVOKE TRACKER); `universe.features.tracker`; `tracker-set`, `tracker-signal`, player `table.tracker`, `table.trackerGrants` |
| F2 | Director camera and combat spotlight on the TV: FIXED / FOLLOW / CINEMATIC, FRAME ROOM, SPOTLIGHT with a turn banner, reduced-FX cuts | done | `board/Camera.js`, `BoardView.jsx`, `board/MapCanvas.jsx`, `MapController.jsx` (camera group); `board.view.camera` via `board-view` |
| F3 | Soundboard and scene ambience: procedural stingers per universe to the TV (and phones), ambience beds tied to scenes, ducking under TTS | done | `soundboard.js`, `Nav.jsx` AUDIO popover, `hooks/useAmbientAudio.js`, `board/BoardAudio.jsx`, `theme.sounds`, `theme.ambient`; `table-sfx` |
| F4 | Character portraits from the LAN ComfyUI: GENERATE PORTRAIT on the sheet and the builder review, shown on the phone header, the CREW drawer and TV tokens; monogram until then | done | `server/portrait.js` (`/api/portrait`), `sheet/Portrait.jsx`, `CharacterSheet.jsx`, `board/TokenChip.jsx`, `run/CrewDrawer.jsx`, `PlayerView.jsx` |
| F5 | Ship's log recap (Claude or a template, public log only; send to phones, show on TV, export Markdown) and handouts as in-world documents with burn after reading | done | `server/recap.js` (`/api/recap`), `run/MoreDrawer.jsx` RECAP, `player/HandoutDoc.jsx`, `board/HandoutCard.jsx`, `run/HandoutsPanel.jsx` (burn picker, SHOW ON TV as a document); `handout.burnSec` |
| F6 | Intrigue web (GM relationship graph from pack `relations`, secret ties revealed as clues) and prescience / special order visions on the TV and phones | done | `run/IntrigueDrawer.jsx`, `run/intrigueGraph.js`, `board/VisionOverlay.jsx`, pack `relations[]` (schema + the four DUNE packs); `vision-send`, `vision` |
| F7 | Animated dice on the TV for every public roll (players and GM), with the GM's TV / SECRET / LOCAL route | done | `board/DiceStage.jsx`, `board/dice-stage.css`, `board/Overlays.jsx`, `DiceRoller.jsx`; `gm-roll { secret }`, `board-roll` |
| V1 | Natural narrator voice: server TTS (Kokoro / any OpenAI-compatible speech API) spoken sentence by sentence on the TV, the GM tablet or both; per-universe default voice and speed; clip cache; browser-voice fallback | done | `server/tts.js` (`/api/tts`), `narrate-speak`, `narrate-speak-stop`, `narrate { speak }` → `table-speak` / `table-speak-part` / `table-speak-done` / `table-speak-stop`; `run/NarrateDrawer.jsx` VOICE, `run/RunScene.jsx` READ ALOUD, `hooks/useTTS.js`, `board/BoardAudio.jsx`, `theme.voice`; test `test-tts.mjs` |
| V2 | AI GM: drafts read-aloud narration (open scene, describe where they are, NPC speaks, improvise, recap so far) from the local model on the GPU box (`GM_URL`, Ollama) or the pack's own text; the GM edits, then sends as caption/card or speaks it on the TV; AUTO drafts each new scene's opening; ComfyUI ↔ Ollama VRAM hand-off | done | `server/gm.js` (`/api/gm`), `server/vram.js`, `run/AiGmDrawer.jsx`, docs/AI_GM.md; test `test-aigm.mjs` |
| V3 | AI BUILD: the AI dresses the map on the table — per room a mood, a read-aloud description, item/creature/NPC/marker/hazard tokens (creatures and NPCs hidden) and a check; SPARSE/NORMAL/DENSE; the GM reviews per room, APPLY SELECTED places them (`ai: true`), CLEAR AI BUILD removes them; template plan without a model | done | `server/aibuild.js` (`/api/gm/build`, `/build/apply`, `/build/clear`), `table.aiPlan` (GM only); `run/AiGmDrawer.jsx` BUILD tab (`useAiBuild`), `GameContext.aiBuild/aiBuildApply/aiBuildClear/aiBuildGet`; docs/AI_GM.md "AI BUILD"; test `test-aibuild.mjs` |
| V4 | Room-entry loop: players walk through unlocked doors from the phone (TABLE → EXITS → ENTER <ROOM>); the GM gets `room-entered` (also for a dragged PC token) and the AI reacts per `table.aiGm.entry`: REVIEW drafts (`ai-gm-draft`; SEND CAPTION / SEND + SPEAK / ASK <NAME> TO ROLL) or LIVE (the server narrates, speaks if VOICE, asks the roll); dock badge counts unseen drafts | done | `player-enter-room`, `room-entered`, `ai-gm-set`, `ai-gm-draft` (`server/sessions.js`, `server/gm.js` kind `enter-room`); `player/TablePane.jsx` EXITS, `run/AiGmDrawer.jsx` ROOMS tab (`useAiRooms`), `GameContext.playerEnterRoom/aiGmSet/onRoomEntered/onAiGmDraft`; docs/AI_GM.md "Room entry"; test `test-roomloop.mjs` |

## Implemented beyond the backlog

| Feature | Where |
|---|---|
| Multi-universe engine: landing page, per-universe theme (CRT or grain overlay, fonts, favicon, SFX, board palette), terms, boot overlay | `UniverseContext.jsx`, `UniverseSelect.jsx`, `fx/`, `universes/*/theme.js` |
| Character builder (career, attributes or fixed attribute array, skills, talent, gear with encumbrance, identity, review) from the universe catalog, on the phone or GM side; phones can submit a replacement at any time (SHEET menu, death screen) and the GM assigns it (KIA: ASSIGN PLAYER-BUILT) | `CharacterBuilder.jsx`, `builder/*`, `player/BuildCharacter.jsx`, `PlayerView.jsx`, `DMDashboard.jsx`; `character-submit`, `submission-resolve`, `submission-updated` |
| Character sheets with active talent and condition effects | `CharacterSheet.jsx`, `sheet/parts.jsx`, `catalogUtils.js` |
| Table board controller with levels, room editor, QR for the TV link | `MapController.jsx`, `board/RoomEditor.jsx`, `board/qr.js` |
| Interactive deck plans (MapEngine) and image maps with room geometry | `MapEngine.jsx`, `MapRenderer.jsx`, `Maps.jsx`, `board/EngineLayer.jsx`; `universes/*/maps/` |
| Pack library, import/export, runtime pack folder and REST API | `ScenarioLibrary.jsx`, `PackImportExport.jsx`, `ContentContext.jsx`, `server/content.js` |
| GM PIN takeover, seat claims, role detach, `API_TOKEN`, guarded handlers | `server/guard.js`, `server/sessions.js`, `SessionScreen.jsx`, `engine/apiToken.js` (`docs/REVIEW_2026-10-30.md`) |
| CLI generator, mock mode, Claude Code `gamenight` skill | `scripts/generate-pack.mjs`, `server/generator/`, `.claude/skills/gamenight/` |
| ALIEN catalog mined from the books with art pipeline; DUNE generated art pipeline | `universes/alien/catalog/`, `scripts/extract-art.py`, `scripts/gen-dune-art.py` |
| Local deploy script with LAN URL | `scripts/deploy-local.ps1` |
