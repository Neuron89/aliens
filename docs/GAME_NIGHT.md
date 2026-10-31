# Game Night: the host runbook

You are the **GM** (ALIEN: the Game Mother; DUNE: the Narrator). This runbook follows an actual evening, in order: setup, session zero, start, play, pause/resume, ending.
Each universe renames some words in the UI (session, transmission, crew...); this document uses the neutral ones and notes the in-universe names where they matter.

**What you need**: a computer on the table or in the next room running the server, a GM tablet or laptop, a TV (or any big screen with a browser) lying flat on the table, and every player's phone, all on the same Wi-Fi/LAN.

| Screen | URL | Notes |
|---|---|---|
| GM | `http://localhost:3100` on the host (or the LAN URL on a tablet) | Everything |
| TV | `http://<LAN IP>:3100/?board=CODE` (or `/tv/CODE`) | No chrome, no input; add `&audio=1` for scene audio. **✕ EXIT** on the bottom strip (or Esc) leaves it |
| Phones | `http://<LAN IP>:3100/?join=CODE` | Or open the host URL, choose JOIN, type the code |

## 1. Before the night (setup)

### 1.1 Run a stable copy of the server

```powershell
powershell -File scripts\deploy-local.ps1            # build + start on port 3100
powershell -File scripts\deploy-local.ps1 -Port 3200 # another port
powershell -File scripts\deploy-local.ps1 -Stop      # stop the background server
```
What it does (`scripts/deploy-local.ps1`): runs `npm run build` in `web app/`; mirrors `dist/` and `server/` into `..\aliens-deploy\web app\` (a sibling folder of the repo); copies `package.json`, `package-lock.json` and `.env` (if the repo has one);
copies **new** content packs from `web app/content/` without deleting packs saved by the deployed app; creates `content\` and `data\` there; runs `npm install --omit=dev`; stops the previous server (pid in `..\aliens-deploy\server.pid`);
starts `node server/index.js` hidden with `PORT` set; then requests `http://localhost:<port>/` and prints `HTTP 200 -> http://localhost:3100 (LAN: http://192.168.x.y:3100)`.
Editing or rebuilding the repo never disturbs a running game; re-run the script to publish changes (the running server restarts, games resume: section 5).
Runtime packs, session snapshots (`data\`) and the generator `.env` belong in the **deploy** folder `..\aliens-deploy\web app\`, because that is where the server runs.

Development mode (`cd "web app" && npm run dev`) serves the UI on :3000 and the API on :3002 with hot reload; use it for building, not for a game night.

**Narrator voice.** Put `TTS_URL=http://192.168.1.37:8880/v1` in `web app/.env` (the deploy script copies it) for the natural Kokoro voice (the speech server on the GPU box). Check it before the night: the NARRATE drawer's status line reads **VOICE: kokoro · George — British male**, or open `http://localhost:3100/api/tts/status` (`"ok": true`). Without it everything still works with the browser's robotic voice.

**AI GM.** Put `GM_URL=http://192.168.1.37:11434/v1` and `GM_MODEL=hf.co/unsloth/Qwen3-30B-A3B-Instruct-2507-GGUF:Q4_K_M` in `web app/.env` for the AI GM (Ollama on the GPU box; any model `ollama list` shows works). Leave them empty and the AI GM tab uses the pack's own text. See `docs/AI_GM.md`.

### 1.2 Network and firewall

- Players need the host's LAN address: the deploy script prints it (the first `192.168.*` IPv4 address); otherwise run `ipconfig`.
- The server listens on all interfaces. The first time `node.exe` starts, Windows asks to allow it: allow **Private** networks. If a phone still cannot connect, add an inbound rule for TCP port 3100 (or the port you chose; 3000 and 3002 in dev mode).
- All devices must be on the same Wi-Fi/LAN. Guest networks often isolate clients from each other and will not work.

### 1.3 Have a scenario ready

- Bundled packs are already in the library (ALIEN 15, DUNE 4).
- **Generate** one in the app: **Stories** (left rail), **GAME NIGHT — GENERATE SCENARIO** (needs `ANTHROPIC_API_KEY` in `..\aliens-deploy\web app\.env`; see README, mock mode exists for testing).
- **Write** one with Claude Code and the `gamenight` skill (no API key): say "set up a game night" in this repo. The pack lands in `web app/content/<universe>/`; run `deploy-local.ps1` again (or copy the file into `..\aliens-deploy\web app\content\<universe>\`) and reload the page.
- **Import** one: **Stories**, **IMPORT PACK** (paste or upload JSON); see `docs/CONTENT_PACKS.md`.
- Read the pack's content warnings in the library card before you pick it.

### 1.4 Set the TV up on the table

1. Put the TV flat in the middle of the table (or mount it so players can lean in), open its browser to `http://<LAN IP>:3100/?board=CODE` once you have the code (section 2), and tap the screen once: it goes fullscreen, hides the cursor and keeps the screen awake (wake lock). A tiny "TAP FOR FULLSCREEN" hint shows until then.
2. The TV shows "waiting" until the GM picks a map. The **TV** dot in the GM status strip (top bar) turns green and reads **TV LINKED** once the TV is attached.
3. **Orientation** (players sit around all four sides): in **Board** (left rail) use **ROTATE** (90 degrees per tap), **FLIP** and **ZOOM −/+** until the map reads right from the GM seat; labels and tokens stay upright whichever way you turn it. **AS TV** makes the tablet canvas mirror the TV's rotation/flip so you move tokens in the orientation players see. Toggle it off to work upright on the tablet.
4. No TV? Skip it: everything works from phones and the GM screen; the map shows on the phone **TABLE** tab for revealed rooms.
5. Optional: open the TV as `/?board=CODE&audio=1` (rail **Audio** shows this link, ready to copy) so the TV speaker plays the scene ambience and the soundboard stingers you fire; tap the TV once to allow sound. Without `&audio=1` the TV stays silent, which is fine if the GM tablet's speaker is enough.
6. Burn-in safety is automatic: the map drifts a pixel or two every minute and dims after 10 minutes of nothing happening.

## 2. Start the session

1. Open `http://localhost:3100` on the host. Every fresh load shows the **universe landing page**: pick a card (ALIEN or DUNE). The UI re-themes with a short boot sequence.
2. On the session screen choose **INITIATE SESSION**. A list of scenarios for the active universe appears (bundled and runtime packs, with type and source badges), plus **NO SCENARIO — SANDBOX** for free play (all characters available, no run view).
3. **Session zero (do this before INITIALIZE, with the players at the table).** Tick **SESSION ZERO** under the scenario list: the pack's tone and content warnings pre-fill a checklist (untick what does not apply, add your own) and you write **lines and veils**. Every phone then shows a one-time **BEFORE WE BEGIN** card with these and an **I'M READY** button; the GM sees who has confirmed. Changing the settings later re-arms the card. Talk it through out loud as well; the card is a prompt, not a substitute.
4. **DUNE only**: set **EXPECTED** players (the starting pools scale with it: Threat starts at 2 per player; you can override the starting values).
5. Pick the scenario and press **INITIALIZE**. You receive a **4-letter access code** and a **6-digit GM PIN**, both in the status strip at the top of the screen. **Write the PIN down now**: it shows in amber until you tap **NOTED**; afterwards tap **PIN ••••••** in the strip to see it again. It is how another terminal takes over if this one dies (section 5). Do not tell players.
6. Share the join link: tap the big **CODE** in the status strip for the link, a **QR code** players can scan, **COPY JOIN LINK** / **COPY CODE**, and the TV link (**OPEN BOARD HERE**, **COPY TV LINK**). The crew dashboard (rail **Crew**; DUNE **Agents**) also has **COPY JOIN LINK**.
7. Link the TV (section 1.4). Once the session is live you land on **Run** (scenario sessions) or the crew dashboard (sandbox).

### What players do (phones)

1. Open the link (or host URL, **JOIN**, type the code). The phone themes itself to the GM's universe once connected.
2. Enter a name and press **AUTHENTICATE** (the button label follows the universe's join prompt). The name must be unique at the table.
3. Wait for the GM to assign a character, or tap **BUILD YOUR CHARACTER**, build one on the phone and submit it (the GM sees a **PLAYER-BUILT** badge and can ASSIGN, EDIT or REJECT).
4. Assigned: the phone pins a vitals header (name, career and session code, LINK dot, **PAUSE**, **≡** menu; the universe's track bars with numbers, ALIEN HEALTH + STRESS, DUNE STRESS + DETERMINATION) and a quick-action row: **ROLL** (opens the dice roller; **DONE** goes back), **+STRESS** (marks +1 stress after a confirm; it shows in your roll feed as "+1 STRESS"), **PANIC** (ALIEN: a panic roll when you call for one, cancellable before rolling) and **DET n** (DUNE: spend 1 Determination after a confirm). Below that a strip with shared pools (DUNE Momentum), visible clocks and the YOUR TURN / paused / offline banners. Bottom tabs: **SHEET** (**ROLL** next to a skill opens the roller pre-filled), **GEAR**, **COMMS** (two views: messages with **REPLY PRIVATELY**, and **FILES & CLUES**: orders per act, handouts, clues found; one badge counts unread messages plus unopened handouts) and **TABLE** (the board from the player's side: **YOU ARE IN** room, the map with fog as the TV shows it, **NEAR ME** / **WHOLE MAP**, their own token highlighted and their room outlined, **VISIBLE HERE** items, markers and hazards in that room with **TAKE**, which messages you "I take the …", and **WITH YOU** for the other PCs, NPCs and threats in the room). The **≡** menu holds BUILD A NEW CHARACTER, alert sound, interface sound, REDUCE FX and DISCONNECT.
5. Players never see GM tools, scenarios, hidden tokens or each other's secrets.

Assign characters (rail **Crew** / DUNE **Agents**, tap a player card): pack characters are offered first, then custom ones from the Characters tab. Stats come from the universe rules; health-type tracks are computed by the engine.

## 3. During play

### 3.0 The GM screen

- **Status strip** (top, always visible): terminal name, scenario and act, the session **CODE** (tap: join link, QR, copy, TV link), **PIN** (tap to reveal), players online (tap: crew dashboard), **TV** linked dot, **LINK** (amber RECONNECTING when the socket drops), **◂ UNIVERSES** (asks first, then suspends the session; nothing is ended), **REDUCE FX** and **SOUND**. The session screen before INITIALIZE shows the same strip.
- **Left rail**: PLAY → **Run**, **Board**, **Crew** (DUNE **Agents**; the old Session / Audience tab); LIBRARY → **Stories** (the scenario library), **Characters**, **Maps**, **Rules** (one entry; the universe's reference pages are tabs inside it: ALIEN Weapons / Vehicles / Xenomorphs / Cheat Sheets, DUNE Imperium / Cheat Sheets); at the bottom **Dice** (GM roller with SECRET, plus the roll feed) and **Audio** (ambient presets and volume; replaces the old floating AUDIO panel). Badges: Run shows a dot when a pause is requested; Crew counts seat claims, player-built characters waiting and unread messages. Tapping the active entry returns that section to its start (e.g. Stories → library). Below 900 px wide the rail becomes a bottom bar.
- Alerts (pause requested, seat claims, panic and complication prompts, player-built characters, a new access code) appear as banners above whichever section is open.

### 3.1 The RUN view (your main screen)

The current scene fills the screen in large type: title, **MANDATORY** / **ENCOUNTER** tags, **MARK DONE**, the read-aloud, events, then three cards **CHECKS · STRESS TRIGGERS · OUTCOMES**, encounter detail, NPC guidance, the clues findable here (**REVEAL TO ALL**) and the GM tip. Progress is saved on the server and survives a resume.

**Progress strip** (top): the act name, one segment per scene of the act (done ones lit, the current one glowing; tap a segment to jump), **SCENE n / N** (tap: the scene list), **ADVANCE ACT ▸** once every scene of the act is done, and the DUNE Momentum / Threat counters. The **scene list** shows every act with its scenes, done ticks (tap to toggle), MANDATORY / ENCOUNTER chips, the current act's brief (summary, agenda notes, GM notes, **ACT OPENING → TV CARD**, **▶ TTS**) and **PREV / NEXT**. On screens 1400 px and wider it stays open as a column on the left.

**Dock** (bottom bar): **NEXT SCENE** (ticks the current scene done and moves on; on the act's last scene it becomes **ADVANCE ACT**, with a confirm), then **NARRATE · MAP · CREW · DICE · CLOCKS · HANDOUTS · THREATS · MORE**. Each opens one drawer on the right; tap the same button again, **✕** or Escape to close it. The open drawer is remembered for the session.

**Keys** (never while typing in a field): **[** previous scene, **]** next scene, **n** the narrate drawer (with the cursor in the text box).

**Narration**
- **SEND TO TABLE** puts the read-aloud on the TV as a lower-third caption (typewriter reveal) and on every phone as a dismissible sheet. **AS CARD** shows it full-screen on the TV. **▶ READ ALOUD** reads it on the GM device (TTS). While it is on the table the stage shows **● ON TABLE** and **CLEAR**.
- **NARRATE** drawer: free text for the table (**SEND CAPTION**, **SEND AS CARD**, Ctrl+Enter), what is on the table now with **CLEAR TABLE TEXT**, **TV SHOWS MAP / THEATRE** (a theatre-of-mind card with the act and scene title, plus the act's `sceneArt` if the pack has one; the choice persists) and the recent narration (**USE** puts a line back in the box).

**Acts and agendas**
- **ADVANCE ACT ▸** moves to the next act and pushes each player's `agendaByAct` entry for it as a private **NEW ORDERS** card (vibration and sound). **SEND AGENDA CARDS** (MORE › AGENDAS) re-sends the current act's. Players can re-open orders under COMMS › FILES & CLUES.

**Drawers**
- **MAP**: the board canvas in compact form: map and level, **FOG**, **REVEAL** (room list with SEEN / FOG toggles, REVEAL ALL / CONCEAL ALL), **PING**, **+ TOKEN** (the palette), tap a token or room for its sheet, and **OPEN FULL BOARD ▸** (the Board section, for rotate / flip / zoom / snap / edit rooms / reset).
- **CREW** (DUNE **HOUSE AGENTS**): every seat with its portrait (or monogram), track bars, panic / offline / KIA state, unread messages (the last one quoted), **MSG** per seat (with the last few messages) and **MSG ALL**; ALIEN rows also carry **GRANT TRACKER** / **REVOKE TRACKER** (3.11; a seat that already carries a motion tracker says so instead); quick actions **+1 STRESS ALL**, **ASK FOR A ROLL** (pick a skill and who; sent as a priority message to the phone), **SEND HANDOUT** (opens HANDOUTS) and **PRIVATE AGENDA** (opens MORE › AGENDAS); **FULL CREW DASHBOARD ▸** for the editor (tracks, status, supplies, injuries, inventory, kill / replace).
- **DICE**: the GM roller and the roll feed (every roll phones report; also the crew dashboard's **ROLLS** panel). While a session is live a three-way switch picks where your roll goes: **TV** (the default: the table sees it tumble on the dice stage, and it is logged), **SECRET** (your feed and the session log only) or **LOCAL** (this screen only, nothing sent or logged).
- **CLOCKS**: **+ CLOCK** with 4 / 6 / 8 / custom segments, kind *danger* (strikes when full), *racing* (the players' progress) or *tug* (moves both ways), shown to the table or GM-only. Tap + / − to tick; phones chime and the TV clock stack updates. A full clock is tagged FULL (and the dock button shows **!**): decide what happens.
- **HANDOUTS**: **PUSH TO PHONES** to everyone or chosen players, **SEEN 2/4** receipts (unseen count on the dock button), an optional **BURN AFTER READING** timer per send (OFF / 30 SEC / 1 MIN / 2 MIN / 5 MIN), **SHOW ON TV** (the handout as a document card on the TV), **+ CUSTOM HANDOUT** (same timer). Players get a sealed card ("TAP TO OPEN"); opening it shows the handout as an in-world document (ALIEN: a teletype printout that types itself out; DUNE: a parchment leaf with an illuminated letter and a House seal). With a timer, the phone counts down once the text has arrived and then redacts it for good on that device. Opening counts as seen; they can re-open it under COMMS › FILES & CLUES. The same push exists in Stories.
- **THREATS**: **CREATURES** (3.5) and **INITIATIVE** (3.4); the dock button shows the round while initiative runs.
- **MORE** (the tab row scrolls sideways when it does not fit): **INTRIGUE** (3.12), **AGENDAS** (each PC's agenda this act, **SEND AGENDA CARDS**), **NPCS** ("if ignored" behaviour, secrets hidden until **SHOW SECRETS**), **CLUES** (pack clues plus ad-hoc ones; **REVEAL** to all or chosen players, who are credited as finders; FOUND / HIDDEN and who found it; give every important conclusion at least three clues), **LOG** (filterable session log, **ADD NOTE**, mark the ending reached, **EXPORT RECAP**), **RECAP** (3.13), **SAFETY** (pause state with **RESUME PLAY**, the session-zero answers and who confirmed) and **END** (end the session for everyone, with a confirm).

### 3.2 Rolls and pressure mechanics

- **Rolls.** Players roll on their phones. Each settled roll lands in the roll feed (who, skill, pool, dice, flags PANIC / PUSH / CRIT / COMPLICATION) and plays on the TV's **dice stage**: the dice fly in (players from the left, the GM from the right), tumble, settle one by one, the hits light up (sixes glow, stress 1s pulse red; on DUNE crits glow and complications pulse red), then a result card names the roller, the skill and the outcome. A pushed ALIEN roll replays as a second pass where the kept sixes stay lit and the rest re-tumble. Rolls that arrive together queue; with REDUCE FX on the TV the dice simply appear on their final faces. Your own rolls follow the DICE drawer's **TV / SECRET / LOCAL** switch. **Secret rolls** (SECRET, or a threat card's ROLL ATTACK (SECRET)) show only to you and the log, never the TV.
- **ALIEN, push and Panic.** Pushing a roll adds the Stress automatically. When a Stress Die shows 1 the phone shows **PANIC ROLL**: the player taps it (D6 + Stress), sees the effect privately, and the server applies it: PANICKED (plus the action's name for 10+, e.g. FREEZE), stress per the table, a panic ring on their TV token, a "PANIC — name" toast on the TV and the full text in a GM prompt and in the player editor. Remove the status in the player editor to clear the ring.
- **ALIEN, supplies.** In the player editor set AIR / POWER / FOOD / WATER with −/+. **SUPPLY ROLL** (yours, or the player's on SHEET) rolls Stress Dice equal to the rating (max 6); each 1 drops the rating one step. The TV shows a SUPPLY strip when anyone's air or power is 2 or lower.
- **DUNE, Momentum and Threat.** Counters with −/+ sit in the Run progress strip and the crew dashboard header. Momentum is capped at 6, generated by player rolls, and shown on every phone and the TV. Threat is GM-only. **RESET** starts both again.
- **DUNE, complications.** A complication flashes the phone red and prompts you with **+1 THREAT / +2 (CONVERT)**; nothing is applied automatically.
- **Critical injuries.** In the player editor choose **ROLL D66** (DUNE: its consequence die) or pick from the list, then **APPLY CRITICAL INJURY**. It shows on the phone sheet as a debuff; **HEAL** removes it.
- **Tracks and status.** Per player: +1 / −1 / MAX / CLEAR on each track, status-effect toggles, inventory. Values clamp to the track maximum and sync instantly. **Kill** a character, then assign a new one to the same player.

### 3.3 Messages and loot

- The messages panel (**Transmissions** in ALIEN, **Dispatches** in DUNE; the tab label follows `terms.message`) sends a private message to one player or a broadcast, with a priority (ALIEN: STANDARD, PRIORITY, EYES ONLY, EMERGENCY; DUNE: ROUTINE, URGENT, SEALED, IMPERIAL). Phones vibrate and show an incoming alert. Players can reply to you and message each other; everything is in the Message Log, and player cards show **N NEW**. From the Run view use the CREW drawer's **MSG** / **MSG ALL**.
- **Loot.** Adding an inventory item to a player pops an "ITEM RECEIVED" toast with the item art on their phone and flashes their token on the TV.

### 3.4 Initiative

Run › **THREATS** › **INITIATIVE** (or the crew dashboard's **INITIATIVE**): **+ PCS**, **+ BOARD THREATS** or type a name.
ALIEN: **DRAW CARDS** deals cards 1-10 (lowest acts first); tap FAST / SLOW to spend each combatant's actions.
DUNE: **START**, then tap a name to nominate who acts next; **KEEP INITIATIVE** spends 2 Momentum and **GM TAKES IT** spends 2 Threat.
**NEXT / PREV / END ROUND / END** step through the order. The acting phone shows **YOUR TURN** (vibration and sound; DUNE players can **PASS TO** an ally). The TV pulses the acting token and shows the name on its bottom edge.

### 3.5 Threat cards

Run › **THREATS** › **CREATURES**: one card per creature or NPC on the board. **ADD FROM CATALOG** places a hidden token with the creature's health. Each card has −1 / −2 / +1 health, status toggles (they show as the TV ring), **ROLL ATTACK (SECRET)** (the signature die plus its base dice; only you see it) and **SIGNATURE D6** (lookup only). Health is stored on the token, survives a restart and shows as a small bar on your Board only.

### 3.6 The board: tokens, fog and pings

In **Board** (left rail; most of this also works from the Run view's MAP drawer):
- Pick the **map** (universe maps and the pack's maps) and **level** (deck/floor). Changing map keeps PC tokens (moved to the spawn point) and clears the rest; changing level keeps everything.
- **Palette**: **CREW** (one token per connected player), **THREATS**, **NPCS**, **ITEMS**, **MARKERS** (hazard, objective, noise, blood, locked door, vent, fire). Drag onto the map, or tap to arm and then tap the map. **SNAP** snaps to the grid.
- **Fog**: rooms start hidden. Tap a room and reveal it (the fog dissolves on the TV); a PC token moving into a room reveals it automatically. **FOG** off reveals everything. Hidden tokens stay GM-only even in revealed rooms. Room notes and GM renames of unrevealed rooms never reach the table.
- **Tokens**: tap for the sheet (rename, hide/show, resize, facing, level, status ring, note, send an item to a player, remove). Statuses show as rings on the TV.
- **PING** mode drops a pulse on the TV (players can ping from their TABLE tab, one per second). **RESET** clears tokens, reveals and pings. **EDIT ROOMS** draws rooms on an image map that has none.
- Rooms, doors, levels and spawn points come from the map definition (`docs/BOARD_AND_BUILDER.md`).
- **Players walk through doors.** On the phone's TABLE tab, **EXITS** lists the doors out of the character's room: **ENTER <ROOM>** for an open door, a greyed **LOCKED** for a locked one (and, for a character outside every room, ENTER the room with the spawn point). The server moves the token, reveals the room and tells you (AI GM drawer → ROOMS). Dragging a PC token into another room counts as an entry too. To let players through a locked door, unlock it in the map definition or flag the room open; otherwise you move them.

### 3.7 Scene audio and the soundboard

Rail **Audio** opens the audio popover:
- **STINGERS**: one tap fires a short synthesized sound. ALIEN: klaxon, hull groan, airlock cycle, steam vent, tracker burst, distant screech, lights out. DUNE: worm rumble, wind, thumper, shield hum, ornithopter, crysknife, the Voice. Pick the route first: **TV**, **TV + PHONES** or **HERE** (a preview on your screen only). Every shot is generated fresh, so the same stinger never sounds exactly alike twice; the TV and the phones play the same variant.
- **AMBIENCE**: the universe's beds (ALIEN: engine hum, derelict silence, hive drip, tension, red alert, deep space, cosmic dread; DUNE: sietch wind, keep interior, open erg, wind, bazaar, court). In a live session your pick also becomes the TV's ambience.
- Scenes can name a mood (`ambient` in the pack, for example `ship`, `derelict`, `hive`, `erg`, `keep`; friendly aliases such as `engine`, `drip`, `open-erg` or `interior` work too). Moving to that scene switches the ambience for you and the TV.
- Ambience and stingers dip while narration is read aloud. The TV only plays sound when opened with `&audio=1` (1.4). Players can mute and reduce effects on their own device (SOUND / REDUCE FX toggles).

**Narrator voice (server TTS).** NARRATE drawer → **VOICE**: **OFF | TV | HERE | BOTH** (remembered on this tablet), the voice (the universe's default is marked ★; ALIEN `bm_george`, DUNE `bf_emma`; grades from the voice server in brackets) and **SPEED** (80-120 %).
- With VOICE on, **SEND CAPTION** / **SEND AS CARD** also speak the text (marked ◉); **SPEAK ONLY** speaks without a caption; **■ STOP VOICE** cuts it on the TV and here.
- **READ ALOUD** on the scene (and the act brief's **▶ VOICE**) goes to the same target: the button reads **READ ALOUD ON TV** / **TV + HERE**. With VOICE OFF it reads on this tablet only.
- Speech starts about a second after you tap: the server speaks sentence by sentence and the TV plays each clip as soon as it is ready, ambience and stingers dipping underneath. A TV voice needs the TV opened with `&audio=1` and tapped once (1.4); while it talks the TV shows a small **VOICE** tag bottom-left. Phones never speak.
- Every line said is cached on the server (`data/tts`), so repeating a scene's read-aloud is instant. Lines spoken go into the session log as "Voice: …".
- No voice server: the status line says **NO VOICE SERVER — using the browser voice**; SPEAK and READ ALOUD use the browser voice here, the TV stays silent. Tap **↻** after starting the server.

**AI GM tab** (dock): **OPEN THIS SCENE**, **DESCRIBE WHERE THEY ARE**, **NPC SPEAKS** (pick the NPC), **IMPROVISE** ("they cut the power"), **RECAP SO FAR**; LENGTH short/normal/long. The draft streams into an editable box; then **SEND CAPTION**, **SEND AS CARD**, **SPEAK ON TV** or **SEND + SPEAK**. Turn **AUTO** on and every new scene's opening is drafted for you (never sent by itself; the dock badge says NEW). The first draft of the night can take 1–2 minutes while the model loads; later drafts start at once. The model never sees NPC secrets, GM notes, hidden clues or endings, but it does invent small details, so read before you send. Details: `docs/AI_GM.md`.

**AI GM → BUILD and ROOMS.** With a map on the table, **BUILD** → pick SPARSE / NORMAL / DENSE → **BUILD THIS MAP** (10–30 s): every room gets a mood, a read-aloud description, tokens (creatures and NPCs go on hidden) and maybe a check. Untick the rooms you do not want, then **APPLY SELECTED**; **CLEAR AI BUILD** takes all AI tokens off again. **ROOMS** sets what happens when a player taps ENTER on their phone: **OFF** (nothing), **REVIEW** (the AI drafts what they find; you tap SEND CAPTION, SEND + SPEAK and ASK <NAME> TO ROLL <SKILL>) or **LIVE** (the server narrates, speaks it if **VOICE** is on, and asks the roll by itself; the feed marks SENT · SPOKEN · ROLL ASKED). Start the night on REVIEW until you trust the model. The dock badge counts drafts waiting for you.

### 3.8 Pause (X-card)

Any player can tap **PAUSE** on their phone (one tap plus confirm). You see a neutral **PAUSE REQUESTED** banner with a chime, the TV shows a calm PAUSE card, and nothing records who pressed it. Stop, check in, then **RESUME PLAY** (the button in the banner).

### 3.9 The TV camera and the combat spotlight

In **Board** (and the Run view's MAP drawer) the camera controls choose how the TV frames the map:
- **FIXED**: the whole plan, as before.
- **FOLLOW** (the label follows the universe, e.g. FOLLOW CREW): the TV glides to frame the revealed rooms that hold player tokens and re-frames when someone enters a new room or you reveal one; a ping briefly zooms toward the spot.
- **CINEMATIC**: follow plus a slow drift, a vignette and an edge treatment (a CRT look on ALIEN, heat shimmer on DUNE).
- **FRAME ROOM** (select a room first) pins the camera on that room once it is revealed; **UNPIN** returns to automatic framing.
- **SPOTLIGHT**: while initiative runs, the TV dims everything except the acting token's room and shows a turn banner (for example "MILLER — ACT"); NEXT slides it to the next actor.
With REDUCE FX on the TV every move is an instant cut. The TV never frames a room that is still in fog.

### 3.10 Portraits

A character sheet (GM side, phone SHEET, and the review step of the character builder) has **GENERATE PORTRAIT**: the home image server (ComfyUI on the LAN) paints one in the universe's style (ALIEN: a grainy crew photo; DUNE: a painted portrait). It takes a minute or so; the button shows progress. The portrait then appears on the phone header, the GM's CREW drawer and the TV token; until then each place shows a themed monogram. **NEW PORTRAIT** replaces it. If the image server is off the button says so and nothing else is affected. When the server has `API_TOKEN` set, generating needs the token (as the scenario generator does).

### 3.11 Motion tracker (ALIEN)

ALIEN phones have a fifth tab, **TRACKER**. It works when the seat's gear lists a motion tracker (or you granted one) and shows a 60-degree fan pointing the way their token faces (they can turn it), range rings at 5, 10 and 20 m, and a blip for every contact, the nearest one's distance in big digits, with a ping that speeds up as it closes. Contacts are your npc / creature tokens that are **moving** (you dragged them in the last few seconds) or that you flagged as a standing signal; walls do not block it. The phone never learns names or positions, only bearing and distance. To hand someone a tracker without changing their gear, use **GRANT TRACKER** on their row in the CREW drawer (**REVOKE TRACKER** takes it back). The player needs a token on the map for a fix. Move a hidden creature a little at a time and let the tracker do the talking.

### 3.12 Intrigue web and prescience

Run › **MORE** › **INTRIGUE** (GM only): the pack's people as a web (player characters inside, NPCs around them), one arrow per relation, coloured by kind (ally, rival, owes, fears, loves, serves, hides). Tap a person to light up their ties, tap a tie for its note. Secret ties are dashed until you **REVEAL** one: it reaches the phones as an ordinary clue. **EXPAND** opens the web full screen. Packs without `relations` show an empty web (DUNE packs ship with them; ALIEN packs may add them).

Below the web, **PRESCIENCE** (DUNE) or **SPECIAL ORDER** (ALIEN) sends one line as a vision: the TV shows it as a shimmering overlay (ALIEN: a terminal override screen) for the seconds you choose, and the phones you pick get it as a private flash. Turn **TV** off to send it to phones only, or pick one player for a vision only they see.

### 3.13 Ship's log (RECAP)

Run › **MORE** › **RECAP** › **GENERATE** writes a short log of the session so far in the terminal's voice (ALIEN: the ship's log; DUNE: the House chronicle), from the public record only: no GM notes, secret rolls, private handouts or clues, hidden clocks or pauses. With `ANTHROPIC_API_KEY` set on the server Claude writes it; otherwise a built-in template does (short sessions give a short log). Edit the text if you like, then **SEND TO PHONES** (a handout document, with an optional burn timer), **SHOW ON TV**, or **EXPORT MD** (the LOG tab's recap with the log on top). It is a good "previously on" for next week.

## 4. Breaks and interruptions

- A **short break**: do nothing. Phones keep their seats.
- A **player's phone** drops or sleeps: it shows **CONNECTION LOST** with the number of queued actions; messages and dice results are held on the phone and re-sent on reconnect (never lost, never doubled). Their character, tracks and message history stay on the seat; the player card shows offline.
- A **new device** for a seat (dead battery, replaced phone): the player opens the link and types the same name; the app answers "name in use" and offers **ASK THE GM FOR THIS SEAT**. You get a banner with **APPROVE / REJECT** (approve only if it is really them: the character and private messages move to the new device and the old one is cut off). The request waits up to 2 minutes if you are offline.
- The **TV** sleeps or reloads: it reconnects by itself and remembers the code; if not, reopen `/?board=CODE`.
- A tablet or phone **shows the board instead of the app**: tap **✕ EXIT** on the board's bottom strip (press Esc twice on a keyboard: once to leave fullscreen, once to exit). The board only ever appears when the address carries `?board` or `/tv`, so plain `http://<LAN IP>:3100/` always opens the app.

## 5. Pausing and resuming the whole game

The server snapshots every game to `data/sessions/<CODE>.json` after each change (writes are debounced and atomic). In the deployed copy that is `..\aliens-deploy\web app\data\sessions\`; `DATA_DIR` moves it. Snapshots older than 24 hours are deleted when the server loads them, and dormant games idle for 24 hours are swept hourly. **Closing a tab, losing the network, or stopping or restarting the server does not lose the game.**

- **Restart or crash**: restart the server (`deploy-local.ps1`). The game comes back dormant. On the GM device just reload: the browser keeps your `dmToken` and resumes on its own, or the session screen lists it with **RESUME** (and **END**, which closes a listed session for everyone and deletes its save without opening it: tap END, then CONFIRM END). Players' phones re-attach to their seats on their own (they hold a private seat token); the TV re-attaches by code. Everyone is told the GM reconnected.
- **GM tablet died**: on another device open the host URL, choose **INITIATE SESSION**, use **TAKE OVER A SESSION FROM ANOTHER TERMINAL (GM PIN)**, enter the code and the 6-digit PIN. This works even if the old tablet still looks connected: it is told `session-taken` and loses control, and the token is rotated. Five wrong PINs lock that game's PIN for 60 seconds.
- **Between sessions**: leave the deployed server running or stop it with `-Stop`; keep the same `..\aliens-deploy\web app\data\` folder. Resume next week within 24 hours of the last change, or export a recap and start a new session.
- **Players returning** after being away: phones re-attach silently. A player on a new device uses the seat-claim flow in section 4.

## 6. Ending the night

1. In Run › **MORE** › **LOG**, pick the **ending reached** and add any final notes (`ENDING:` notes feed the recap). Optionally write the ship's log (Run › **MORE** › **RECAP**, 3.13) and send it to the phones before people leave.
2. Press **EXPORT RECAP** to download a Markdown recap (title, universe, the cast and who played whom, a scene-by-scene timeline, clocks, clues found, notes, the ending reached). Keep it for the next session or for the "previously on..." speech.
3. Press **END SESSION** (Run › **MORE** › **END**, or the red button in the crew dashboard header; the wording follows the universe) only when you are finished. It tells every phone and the TV the game ended, sends everyone to the exit screen and **deletes the snapshot**. Export the recap first.
4. Optional: save custom characters (Characters tab) or export the pack (library **EXPORT**), then `deploy-local.ps1 -Stop` if you want the server off.

## 7. Troubleshooting

| Symptom | Check |
|---|---|
| Phone cannot open the link | Same Wi-Fi? Not a guest/isolated network? Use the LAN URL printed by the deploy script, not `localhost`. Allow `node.exe` / the port in Windows Firewall (Private). Try `http://<LAN IP>:3100/` in the phone browser first. |
| Phone loads but says join code rejected | Codes are 4 letters (no I or O), case-insensitive. The game may have ended, or been swept after 24 h dormant. Check the GM screen shows the same code. |
| Phone joined but shows no character | Normal until you assign one (rail **Crew** / **Agents**, tap the player). They can also tap **BUILD YOUR CHARACTER**. |
| Name already in use | Someone else (or their old phone) holds that seat. Pick another name, or use **ASK THE GM FOR THIS SEAT** and approve it. |
| A tablet or phone is stuck on the board | Tap **✕ EXIT** on the board's bottom strip (or Esc twice). Open `http://<LAN IP>:3100/` without `?board` for the app. |
| TV shows nothing or "waiting" | Does the status strip show **TV LINKED**? Pick a map (Board, or the Run view's MAP drawer). If NO TV: reopen `http://<LAN IP>:3100/?board=CODE` (the code must be the live one). Tap the TV once for fullscreen. |
| TV went to sleep | Browsers drop the wake lock when the tab loses focus. Reload `?board=CODE` and tap once; disable the TV's own sleep timer. |
| TV has no sound | Open it as `?board=CODE&audio=1` and tap the TV once; browsers block autoplay until a tap. Stingers sent with the **TV** route need that too. |
| GENERATE PORTRAIT says the image server is offline | The ComfyUI machine (`COMFY_URL`, default `http://192.168.1.37:8188`) is off or busy. Start it and press **RETRY**; nothing else depends on it. |
| TRACKER tab (ALIEN) says there is no tracker, or shows no fix | The seat needs a motion tracker in its gear or a **GRANT TRACKER** from the CREW drawer, and a token on the map for a fix. |
| Map is upside down for the players | Board: **ROTATE** / **FLIP** (turn **AS TV** off to keep the tablet upright). |
| GM tablet died or its browser was wiped | Another device: session screen, **TAKE OVER** with the code and the GM PIN (section 5). Forgot the PIN: the old GM browser still holds it (tap **PIN** in its status strip); there is no other recovery, so write it down at creation. |
| Server restarted mid-game | Reload the GM page (auto-resume) or use **RESUME** on the session screen; phones and the TV re-attach by themselves within a few seconds. |
| `deploy-local.ps1` says "server did not answer" | Port in use (pick `-Port`), or start it by hand: `cd ..\aliens-deploy\web app; node server/index.js` and read the error. Node must be at `C:\Program Files\nodejs`. |
| Port already used | `deploy-local.ps1 -Stop`, or pass another `-Port`. |
| Generator says not configured / `generator_not_configured` | Set `ANTHROPIC_API_KEY` in `..\aliens-deploy\web app\.env` (or the repo's `web app/.env` and redeploy) and restart; or use the Claude Code skill; `GENERATOR_MOCK=1` for a canned pack. If `API_TOKEN` is set on the server, enter it under ADVANCED on the session screen (401 otherwise). |
| New pack not in the library | Reload the page. The file name must be `<id>.json` in the folder named for its universe; run `node scripts/validate-content.mjs` (invalid packs are skipped with a console warning). On the deployed copy run `deploy-local.ps1` or copy the file to `..\aliens-deploy\web app\content\<universe>\`. |
| Import fails with errors | The error list is the schema validator's; fix the listed paths. The pack's universe must match the one you picked. |
| "SERVER FULL" on create | `MAX_GAMES` (default 50) live plus dormant games; end old ones. |
| Stale UI after an update | Hard refresh (Ctrl+F5). The deployed app serves the last built `dist/`. |
| Text-to-speech silent | Browser voices load lazily; pick a voice in the TTS panel. Works best in Chrome/Edge. |
| NARRATE says NO VOICE SERVER | `TTS_URL` missing from the server's `.env` (the deployed copy: `..\aliens-deploy\web app\.env`) or the Kokoro container is down: `http://192.168.1.37:8880/v1/audio/voices` should answer. Tap **↻** in the VOICE panel after fixing; the browser voice is used meanwhile. |
| Voice plays on the tablet but not on the TV | The TV must be open as `?board=CODE&audio=1` and tapped once (TAP FOR SOUND). Check VOICE is **TV** or **BOTH**, not HERE. |
| AI GM says offline | `GM_URL` not set in the server's `.env`, or Ollama on the GPU box is down: `http://192.168.1.37:11434/v1/models` should answer. The pack's own text is used meanwhile. |
| BUILD THIS MAP is greyed out | No map on the table: pick one in Board or the MAP drawer first. |
| BUILD says "Not authorized" | This tablet has no GM token for the session; rejoin as GM (RESUME) on this device. |
| AI BUILD put a creature where you did not want it | Untick that room and APPLY SELECTED again, or tap the token and remove it; CLEAR AI BUILD removes only AI-placed tokens. |
| Phone shows no EXITS | The character has no token on the map, the room has no doors in the map definition, or the token is outside every room and the map has no spawn room. Drag the token into a room. |
| Phone says DOOR LOCKED / NOT ADJACENT | The door is locked in the map definition, or the room is not next door. Move the token yourself or flag the room open. |
| ROOMS feed stays on "THE AI IS WRITING…" | ENTRY is REVIEW/LIVE but the model is loading or offline (the template text should still arrive). Check the NARRATE tab's status line. |
| First AI GM draft is slow | The model is loading into VRAM (about 95 s cold, longer if ComfyUI must unload first). It stays loaded ~10 min after the last draft. |
| Voice starts late or cuts off mid-scene | Long text is spoken sentence by sentence; the first clip takes about a second (CPU Kokoro). A red line in the NARRATE drawer ("Voice: VOICE FAILED…") means the speech server dropped a request; send again. STOP VOICE always clears the TV's queue. |
| Phone screen sleeps | Ask players to keep the screen on; they re-attach to their seat when it wakes. |
| Everything stopped for one player | Check whether they hit **PAUSE** (the banner shows only "PAUSE REQUESTED"); check in, then RESUME PLAY. |
