# Game Night: the host runbook

You are the **GM** (ALIEN: the Game Mother; DUNE: the Narrator). This runbook follows an actual evening, in order: setup, session zero, start, play, pause/resume, ending.
Each universe renames some words in the UI (session, transmission, crew...); this document uses the neutral ones and notes the in-universe names where they matter.

**What you need**: a computer on the table or in the next room running the server, a GM tablet or laptop, a TV (or any big screen with a browser) lying flat on the table, and every player's phone, all on the same Wi-Fi/LAN.

| Screen | URL | Notes |
|---|---|---|
| GM | `http://localhost:3100` on the host (or the LAN URL on a tablet) | Everything |
| TV | `http://<LAN IP>:3100/?board=CODE` | No chrome, no input; add `&audio=1` for scene audio |
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

### 1.2 Network and firewall

- Players need the host's LAN address: the deploy script prints it (the first `192.168.*` IPv4 address); otherwise run `ipconfig`.
- The server listens on all interfaces. The first time `node.exe` starts, Windows asks to allow it: allow **Private** networks. If a phone still cannot connect, add an inbound rule for TCP port 3100 (or the port you chose; 3000 and 3002 in dev mode).
- All devices must be on the same Wi-Fi/LAN. Guest networks often isolate clients from each other and will not work.

### 1.3 Have a scenario ready

- Bundled packs are already in the library (ALIEN 15, DUNE 4).
- **Generate** one in the app: Scenarios tab, **GAME NIGHT — GENERATE SCENARIO** (needs `ANTHROPIC_API_KEY` in `..\aliens-deploy\web app\.env`; see README, mock mode exists for testing).
- **Write** one with Claude Code and the `gamenight` skill (no API key): say "set up a game night" in this repo. The pack lands in `web app/content/<universe>/`; run `deploy-local.ps1` again (or copy the file into `..\aliens-deploy\web app\content\<universe>\`) and reload the page.
- **Import** one: Scenarios tab, **IMPORT PACK** (paste or upload JSON); see `docs/CONTENT_PACKS.md`.
- Read the pack's content warnings in the library card before you pick it.

### 1.4 Set the TV up on the table

1. Put the TV flat in the middle of the table (or mount it so players can lean in), open its browser to `http://<LAN IP>:3100/?board=CODE` once you have the code (section 2), and tap the screen once: it goes fullscreen, hides the cursor and keeps the screen awake (wake lock). A tiny "TAP FOR FULLSCREEN" hint shows until then.
2. The TV shows "waiting" until the GM picks a map. In the GM **Board** tab the **TV LINKED** dot should be on (the Session header also shows TV LINKED / NO TV).
3. **Orientation** (players sit around all four sides): in the **Board** tab use **ROTATE** (90 degrees per tap), **FLIP** and **ZOOM −/+** until the map reads right from the GM seat; labels and tokens stay upright whichever way you turn it. **AS TV** makes the tablet canvas mirror the TV's rotation/flip so you move tokens in the orientation players see. Toggle it off to work upright on the tablet.
4. No TV? Skip it: everything works from phones and the GM screen; the map shows on the phone **MAP** tab for revealed rooms.
5. Optional: add `&audio=1` to the TV URL so the TV speaker plays the ambient track that follows the GM's scene presets; tap the TV once to allow sound.
6. Burn-in safety is automatic: the map drifts a pixel or two every minute and dims after 10 minutes of nothing happening.

## 2. Start the session

1. Open `http://localhost:3100` on the host. Every fresh load shows the **universe landing page**: pick a card (ALIEN or DUNE). The UI re-themes with a short boot sequence.
2. On the session screen choose **INITIATE SESSION**. A list of scenarios for the active universe appears (bundled and runtime packs, with type and source badges), plus **NO SCENARIO — SANDBOX** for free play (all characters available, no run view).
3. **Session zero (do this before INITIALIZE, with the players at the table).** Tick **SESSION ZERO** under the scenario list: the pack's tone and content warnings pre-fill a checklist (untick what does not apply, add your own) and you write **lines and veils**. Every phone then shows a one-time **BEFORE WE BEGIN** card with these and an **I'M READY** button; the GM sees who has confirmed. Changing the settings later re-arms the card. Talk it through out loud as well; the card is a prompt, not a substitute.
4. **DUNE only**: set **EXPECTED** players (the starting pools scale with it: Threat starts at 2 per player; you can override the starting values).
5. Pick the scenario and press **INITIALIZE**. You receive a **4-letter access code** and a **6-digit GM PIN**. **Write the PIN down now**: it is shown once (the header's **SHOW PIN** reveals it again) and it is how another terminal takes over if this one dies (section 5). Do not tell players.
6. Share the join link `http://<host>:<port>/?join=CODE` (the Session tab has **COPY LINK**) or just the code. The app draws no QR for phones: paste the link into any QR generator if you want players to scan it. The Board tab's **OPEN BOARD** does show a QR, but for the TV link.
7. Link the TV (section 1.4). Once the session is live you land on the **RUN** tab (scenario sessions) or the Session tab (sandbox).

### What players do (phones)

1. Open the link (or host URL, **JOIN**, type the code). The phone themes itself to the GM's universe once connected.
2. Enter a name and press **AUTHENTICATE** (the button label follows the universe's join prompt). The name must be unique at the table.
3. Wait for the GM to assign a character, or tap **BUILD YOUR CHARACTER**, build one on the phone and submit it (the GM sees a **PLAYER-BUILT** badge and can ASSIGN, EDIT or REJECT).
4. Assigned: the phone shows a top bar (tracks, visible clocks, **PAUSE**, sound toggle) and tabs **SHEET** (**ROLL** next to a skill opens DICE pre-filled), **GEAR**, **COMMS** (messages, unread badge, **REPLY PRIVATELY**), **FILES** (orders per act, handouts, clues found and who found them), **MAP**, **DICE**.
5. Players never see GM tools, scenarios, hidden tokens or each other's secrets.

Assign characters (Session tab, expand a player card): pack characters are offered first, then custom ones from the Characters tab. Stats come from the universe rules; health-type tracks are computed by the engine.

## 3. During play

### 3.1 The RUN view (your main screen)

Left column: **act switcher** with progress, act summary and agenda notes, ◂ PREV / scene picker / NEXT ▸, and the **scene card**: read-aloud, events, checks, stress triggers, encounter detail, NPC guidance, outcomes, GM tip and the clues findable in this scene. Tick **DONE** per scene (mandatory scenes are tagged). Progress is saved on the server and survives a resume.

**Narration**
- **SEND TO TABLE** puts the read-aloud on the TV as a lower-third caption (typewriter reveal) and on every phone as a dismissible sheet. **AS CARD** shows it full-screen on the TV. **▶ TTS** reads it aloud on the GM device.
- **NARRATE TO TABLE** (below the scene) sends free text. **CLEAR TABLE TEXT** removes it.
- **MAP / THEATRE** (top strip) switches the TV between the map and a theatre-of-mind card (act and scene title, plus the act's `sceneArt` if the pack has one). The choice persists.

**Acts and agendas**
- **ADVANCE ACT ▸** moves to the next act and pushes each player's `agendaByAct` entry for it as a private **NEW ORDERS** card (vibration and sound). **SEND AGENDA CARDS** (AGENDAS tab) re-sends the current act's. Players can re-open orders under FILES.

**Rail (right side)**
- **CLOCKS** (always visible): **+ CLOCK** with 4 / 6 / 8 / custom segments, kind *danger* (strikes when full), *racing* (the players' progress) or *tug* (moves both ways), shown to the table or GM-only. Tap + / − to tick; phones chime and the TV clock stack updates. A full clock is tagged FULL: decide what happens.
- **AGENDAS**: each PC's agenda this act; NPC cards with "if ignored" behaviour and optional secrets (hidden until you press **SHOW SECRETS**).
- **HANDOUTS**: **PUSH TO PHONES** to everyone or chosen players, **SEEN 2/4** receipts, **SHOW ON TV** for handouts with an image, **+ CUSTOM HANDOUT**. Players get a sealed card ("TAP TO OPEN"); opening it counts as seen and they can re-open it under FILES. The same push exists in the Scenarios tab.
- **CLUES**: pack clues plus ad-hoc ones; **REVEAL** to all or chosen players (they are credited as finders); status FOUND / HIDDEN and who found it. Give every important conclusion at least three clues.
- **INIT / THREATS**: see 3.4 and 3.5.
- **LOG**: filterable session log, **ADD NOTE**, mark the ending reached (feeds the recap), **EXPORT RECAP**.
- **ROLL FEED**: every roll phones report (also the Session tab's **ROLLS** panel).

### 3.2 Rolls and pressure mechanics

- **Rolls.** Players roll on their phones. Each settled roll lands in the roll feed (who, skill, pool, dice, flags PANIC / PUSH / CRIT / COMPLICATION) and pops a 4-second toast on the TV. **Secret rolls** (a threat card's ROLL ATTACK (SECRET)) show only to you and the log, never the TV.
- **ALIEN, push and Panic.** Pushing a roll adds the Stress automatically. When a Stress Die shows 1 the phone shows **PANIC ROLL**: the player taps it (D6 + Stress), sees the effect privately, and the server applies it: PANICKED (plus the action's name for 10+, e.g. FREEZE), stress per the table, a panic ring on their TV token, a "PANIC — name" toast on the TV and the full text in a GM prompt and in the player editor. Remove the status in the player editor to clear the ring.
- **ALIEN, supplies.** In the player editor set AIR / POWER / FOOD / WATER with −/+. **SUPPLY ROLL** (yours, or the player's on SHEET) rolls Stress Dice equal to the rating (max 6); each 1 drops the rating one step. The TV shows a SUPPLY strip when anyone's air or power is 2 or lower.
- **DUNE, Momentum and Threat.** Counters with −/+ sit in the RUN strip and the Session header. Momentum is capped at 6, generated by player rolls, and shown on every phone and the TV. Threat is GM-only. **RESET** starts both again.
- **DUNE, complications.** A complication flashes the phone red and prompts you with **+1 THREAT / +2 (CONVERT)**; nothing is applied automatically.
- **Critical injuries.** In the player editor choose **ROLL D66** (DUNE: its consequence die) or pick from the list, then **APPLY CRITICAL INJURY**. It shows on the phone sheet as a debuff; **HEAL** removes it.
- **Tracks and status.** Per player: +1 / −1 / MAX / CLEAR on each track, status-effect toggles, inventory. Values clamp to the track maximum and sync instantly. **Kill** a character, then assign a new one to the same player.

### 3.3 Messages and loot

- The messages panel (**Transmissions** in ALIEN, **Dispatches** in DUNE; the tab label follows `terms.message`) sends a private message to one player or a broadcast, with a priority (ALIEN: STANDARD, PRIORITY, EYES ONLY, EMERGENCY; DUNE: ROUTINE, URGENT, SEALED, IMPERIAL). Phones vibrate and show an incoming alert. Players can reply to you and message each other; everything is in the Message Log, and player cards show **N NEW**.
- **Loot.** Adding an inventory item to a player pops an "ITEM RECEIVED" toast with the item art on their phone and flashes their token on the TV.

### 3.4 Initiative

RUN rail **INIT** (or the Session tab **INITIATIVE**): **+ PCS**, **+ BOARD THREATS** or type a name.
ALIEN: **DRAW CARDS** deals cards 1-10 (lowest acts first); tap FAST / SLOW to spend each combatant's actions.
DUNE: **START**, then tap a name to nominate who acts next; **KEEP INITIATIVE** spends 2 Momentum and **GM TAKES IT** spends 2 Threat.
**NEXT / PREV / END ROUND / END** step through the order. The acting phone shows **YOUR TURN** (vibration and sound; DUNE players can **PASS TO** an ally). The TV pulses the acting token and shows the name on its bottom edge.

### 3.5 Threat cards

RUN rail **THREATS**: one card per creature or NPC on the board. **ADD FROM CATALOG** places a hidden token with the creature's health. Each card has −1 / −2 / +1 health, status toggles (they show as the TV ring), **ROLL ATTACK (SECRET)** (the signature die plus its base dice; only you see it) and **SIGNATURE D6** (lookup only). Health is stored on the token, survives a restart and shows as a small bar on your Board tab only.

### 3.6 The board: tokens, fog and pings

In the **Board** tab:
- Pick the **map** (universe maps and the pack's maps) and **level** (deck/floor). Changing map keeps PC tokens (moved to the spawn point) and clears the rest; changing level keeps everything.
- **Palette**: **CREW** (one token per connected player), **THREATS**, **NPCS**, **ITEMS**, **MARKERS** (hazard, objective, noise, blood, locked door, vent, fire). Drag onto the map, or tap to arm and then tap the map. **SNAP** snaps to the grid.
- **Fog**: rooms start hidden. Tap a room and reveal it (the fog dissolves on the TV); a PC token moving into a room reveals it automatically. **FOG** off reveals everything. Hidden tokens stay GM-only even in revealed rooms. Room notes and GM renames of unrevealed rooms never reach the table.
- **Tokens**: tap for the sheet (rename, hide/show, resize, facing, level, status ring, note, send an item to a player, remove). Statuses show as rings on the TV.
- **PING** mode drops a pulse on the TV (players can ping from their MAP tab, one per second). **RESET** clears tokens, reveals and pings. **EDIT ROOMS** draws rooms on an image map that has none.
- Rooms, doors, levels and spawn points come from the map definition (`docs/BOARD_AND_BUILDER.md`).

### 3.7 Scene audio

If a scene names an `ambient` mood (ALIEN: ship-hum, tension, alert, dread, space; DUNE: wind, bazaar, sietch, court), moving to that scene switches your AudioPanel. With the TV opened as `/?board=CODE&audio=1` the TV follows it. Players can mute and reduce effects on their own device (SOUND / REDUCE FX toggles).

### 3.8 Pause (X-card)

Any player can tap **PAUSE** on their phone (one tap plus confirm). You see a neutral **PAUSE REQUESTED** banner with a chime, the TV shows a calm PAUSE card, and nothing records who pressed it. Stop, check in, then **RESUME PLAY** (the button in the banner).

## 4. Breaks and interruptions

- A **short break**: do nothing. Phones keep their seats.
- A **player's phone** drops or sleeps: it shows **CONNECTION LOST** with the number of queued actions; messages and dice results are held on the phone and re-sent on reconnect (never lost, never doubled). Their character, tracks and message history stay on the seat; the player card shows offline.
- A **new device** for a seat (dead battery, replaced phone): the player opens the link and types the same name; the app answers "name in use" and offers **ASK THE GM FOR THIS SEAT**. You get a banner with **APPROVE / REJECT** (approve only if it is really them: the character and private messages move to the new device and the old one is cut off). The request waits up to 2 minutes if you are offline.
- The **TV** sleeps or reloads: it reconnects by itself and remembers the code; if not, reopen `/?board=CODE`.

## 5. Pausing and resuming the whole game

The server snapshots every game to `data/sessions/<CODE>.json` after each change (writes are debounced and atomic). In the deployed copy that is `..\aliens-deploy\web app\data\sessions\`; `DATA_DIR` moves it. Snapshots older than 24 hours are deleted when the server loads them, and dormant games idle for 24 hours are swept hourly. **Closing a tab, losing the network, or stopping or restarting the server does not lose the game.**

- **Restart or crash**: restart the server (`deploy-local.ps1`). The game comes back dormant. On the GM device just reload: the browser keeps your `dmToken` and resumes on its own, or the session screen lists it with **RESUME**. Players' phones re-attach to their seats on their own (they hold a private seat token); the TV re-attaches by code. Everyone is told the GM reconnected.
- **GM tablet died**: on another device open the host URL, choose **INITIATE SESSION**, use **TAKE OVER A SESSION FROM ANOTHER TERMINAL (GM PIN)**, enter the code and the 6-digit PIN. This works even if the old tablet still looks connected: it is told `session-taken` and loses control, and the token is rotated. Five wrong PINs lock that game's PIN for 60 seconds.
- **Between sessions**: leave the deployed server running or stop it with `-Stop`; keep the same `..\aliens-deploy\web app\data\` folder. Resume next week within 24 hours of the last change, or export a recap and start a new session.
- **Players returning** after being away: phones re-attach silently. A player on a new device uses the seat-claim flow in section 4.

## 6. Ending the night

1. In the RUN **LOG**, pick the **ending reached** and add any final notes (`ENDING:` notes feed the recap).
2. Press **EXPORT RECAP** to download a Markdown recap (title, universe, the cast and who played whom, a scene-by-scene timeline, clocks, clues found, notes, the ending reached). Keep it for the next session or for the "previously on..." speech.
3. Press **END SESSION** (red button in the Session header; the wording follows the universe) only when you are finished. It tells every phone and the TV the game ended, sends everyone to the exit screen and **deletes the snapshot**. Export the recap first.
4. Optional: save custom characters (Characters tab) or export the pack (library **EXPORT**), then `deploy-local.ps1 -Stop` if you want the server off.

## 7. Troubleshooting

| Symptom | Check |
|---|---|
| Phone cannot open the link | Same Wi-Fi? Not a guest/isolated network? Use the LAN URL printed by the deploy script, not `localhost`. Allow `node.exe` / the port in Windows Firewall (Private). Try `http://<LAN IP>:3100/` in the phone browser first. |
| Phone loads but says join code rejected | Codes are 4 letters (no I or O), case-insensitive. The game may have ended, or been swept after 24 h dormant. Check the GM screen shows the same code. |
| Phone joined but shows no character | Normal until you assign one (Session tab, expand the player). They can also tap **BUILD YOUR CHARACTER**. |
| Name already in use | Someone else (or their old phone) holds that seat. Pick another name, or use **ASK THE GM FOR THIS SEAT** and approve it. |
| TV shows nothing or "waiting" | Is the Board tab showing **TV LINKED**? Pick a map in the Board tab. If NO TV: reopen `http://<LAN IP>:3100/?board=CODE` (the code must be the live one). Tap the TV once for fullscreen. |
| TV went to sleep | Browsers drop the wake lock when the tab loses focus. Reload `?board=CODE` and tap once; disable the TV's own sleep timer. |
| TV has no sound | Open it as `?board=CODE&audio=1` and tap the TV once; browsers block autoplay until a tap. |
| Map is upside down for the players | Board tab: **ROTATE** / **FLIP** (turn **AS TV** off to keep the tablet upright). |
| GM tablet died or its browser was wiped | Another device: session screen, **TAKE OVER** with the code and the GM PIN (section 5). Forgot the PIN: the old GM browser still holds it (SHOW PIN in its header); there is no other recovery, so write it down at creation. |
| Server restarted mid-game | Reload the GM page (auto-resume) or use **RESUME** on the session screen; phones and the TV re-attach by themselves within a few seconds. |
| `deploy-local.ps1` says "server did not answer" | Port in use (pick `-Port`), or start it by hand: `cd ..\aliens-deploy\web app; node server/index.js` and read the error. Node must be at `C:\Program Files\nodejs`. |
| Port already used | `deploy-local.ps1 -Stop`, or pass another `-Port`. |
| Generator says not configured / `generator_not_configured` | Set `ANTHROPIC_API_KEY` in `..\aliens-deploy\web app\.env` (or the repo's `web app/.env` and redeploy) and restart; or use the Claude Code skill; `GENERATOR_MOCK=1` for a canned pack. If `API_TOKEN` is set on the server, enter it under ADVANCED on the session screen (401 otherwise). |
| New pack not in the library | Reload the page. The file name must be `<id>.json` in the folder named for its universe; run `node scripts/validate-content.mjs` (invalid packs are skipped with a console warning). On the deployed copy run `deploy-local.ps1` or copy the file to `..\aliens-deploy\web app\content\<universe>\`. |
| Import fails with errors | The error list is the schema validator's; fix the listed paths. The pack's universe must match the one you picked. |
| "SERVER FULL" on create | `MAX_GAMES` (default 50) live plus dormant games; end old ones. |
| Stale UI after an update | Hard refresh (Ctrl+F5). The deployed app serves the last built `dist/`. |
| Text-to-speech silent | Browser voices load lazily; pick a voice in the TTS panel. Works best in Chrome/Edge. |
| Phone screen sleeps | Ask players to keep the screen on; they re-attach to their seat when it wakes. |
| Everything stopped for one player | Check whether they hit **PAUSE** (the banner shows only "PAUSE REQUESTED"); check in, then RESUME PLAY. |
