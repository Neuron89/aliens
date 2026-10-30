# Game Night: the host's runbook

You are the DM (ALIEN: the Game Mother). This is the path from "nothing running" to "players have characters on their phones",
then what to do during the game.

## 1. Run the server

### Deploy a stable local copy (recommended for game night)

```powershell
powershell -File scripts\deploy-local.ps1            # build + start on port 3100
powershell -File scripts\deploy-local.ps1 -Port 3200 # another port
powershell -File scripts\deploy-local.ps1 -Stop      # stop the background server
```
What it does (see `scripts/deploy-local.ps1`): runs `npm run build` in `web app/`; mirrors `dist/` and `server/` into `..\aliens-deploy\web app\` (a sibling folder of the repo);
copies `package.json`/`package-lock.json`; copies **new** content packs from `web app/content/` without deleting packs saved by the deployed app;
creates `content\` and `data\` there; runs `npm install --omit=dev`; stops the previous server (pid in `..\aliens-deploy\server.pid`);
starts `node server/index.js` hidden with `PORT` set; then requests `http://localhost:<port>/` and prints
`HTTP 200 -> http://localhost:3100 (LAN: http://192.168.x.y:3100)`. Editing or rebuilding the repo never disturbs the running game; re-run the script to publish changes.
Runtime packs, session snapshots (`data\`) and `.env` for the generator belong in the **deploy** folder `..\aliens-deploy\web app\`, because that is where the server runs.

### Development mode

```bash
cd "web app" && npm install && npm run dev
```
Vite serves the UI on **:3000** with hot reload, the Node server runs on **:3002**, and Vite proxies `/api` and `/socket.io`. For production without the deploy script: `npm run build && npm start`
(serves `dist/` plus API plus sockets on `PORT`, default **3002**).

### LAN access and firewall

- Players need the host's LAN address: the deploy script prints it (the first `192.168.*` IPv4 address); otherwise run `ipconfig`.
- The server listens on `0.0.0.0`. The first time `node.exe` starts, Windows asks to allow it on the network: allow **Private** networks. If a phone cannot connect, add an inbound rule for TCP port 3100 (or the port you chose; 3000 and 3002 for dev mode).
- All devices must be on the same Wi-Fi/LAN. Guest Wi-Fi networks often isolate clients from each other and will not work.

## 2. DM flow

1. Open `http://localhost:3100` on the host machine. Every fresh load shows the **universe landing page**: pick a universe card (ALIEN today; Dune is in progress). The UI re-themes with a short boot sequence.
2. On the session screen choose **INITIATE SESSION**. A list of scenarios for the active universe appears (bundled and runtime packs, with type and source badges), plus **NO SCENARIO — SANDBOX** for free play.
3. Need a scenario?
   - Write one with Claude Code and the `gamenight` skill: ask "set up a game night" in this repo (no API key needed). The pack lands in `web app/content/<universe>/`; if you are playing from the deployed copy, run `deploy-local.ps1` again (or copy the file into `..\aliens-deploy\web app\content\<universe>\`) and reload the page.
   - Or use the generator (needs `ANTHROPIC_API_KEY`; see the README).
   - Or **IMPORT PACK** in the Scenarios tab (paste or upload JSON). See `docs/CONTENT_PACKS.md`.
4. Pick the scenario and press **INITIALIZE**. You receive a **4-letter access code** and a join link `http://<host>:<port>/?join=CODE`. The Session tab has a copy button for the link.
5. Share the link or the code. (The app does not draw a QR code; paste the link into any QR generator and show it on a screen if you want players to scan it.)
6. Brief the table with the scenario's content warnings (Scenarios tab, pack header) before anyone starts.

## 3. Player flow (phones)

1. Open the join link (or open the host URL, choose **JOIN**, and type the code). The phone themes itself to the DM's universe once connected.
2. Enter a name and press **AUTHENTICATE** (the button label follows the universe's `joinPrompt`).
3. Wait for the DM to assign a character. Then the phone shows tabs: **STATUS** (tracks such as health/stress, conditions, talent), **SKILLS**, **INVENTORY**, **COMMS** (transmissions from the DM, replies, messages to other players) and **DOSSIER** (appearance, personal agenda, buddy/rival, signature item, per-act agendas when the pack has them).
4. Players never see DM tools, scenarios, maps or each other's dossiers.

## 4. During play

- **Assign characters.** In the Session tab expand a player card and pick a character. Characters from the chosen pack are offered first; custom characters made in the Characters tab are available too. Stats come from `universe.rules`; health-type tracks are computed by the engine.
- **Tracks and status.** For each player use the +1 / -1 / MAX / CLEAR buttons on each track (ALIEN: health and stress), toggle status effects, and edit inventory. Values clamp to the track maximum and sync to the phone instantly.
- **Kill / replace.** Mark a character dead, then assign a new one to the same player.
- **Transmissions.** The **Transmissions** panel sends a private message to one player or a broadcast to everyone with a priority (ALIEN: STANDARD, PRIORITY, EYES ONLY, EMERGENCY). Players can message you back and each other; everything is in the Message Log.
- **Handouts.** In the Scenarios tab open the pack, expand **HANDOUTS**, choose a target (everyone or one player), and press **SEND AS TRANSMISSION**. The `when` line on each handout is the author's cue. The handout title, from/to and body are sent as one transmission.
- **Scene runner.** Use the scenario player to step through acts and scenes (checks, stress triggers, NPC guidance, GM tips). Read-aloud paragraphs can be narrated with text-to-speech; ambient audio presets are in the Audio panel. Runner progress and notes persist per pack in the browser's local storage.
- **Maps, dice, reference.** Maps tab (pack maps plus the universe's maps), Dice Roller tab (the universe's own roller), and the universe's reference tabs (ALIEN: Weapons, Vehicles, Xenomorphs, Cheat Sheets).
- **Agendas by act.** At each act change, send the players their new agenda from `agendaByAct` as a private transmission (the pack's handouts normally include one); it is also listed on the character sheet.

## 5. Pausing and resuming (intended behaviour)

Status: the server-side pieces are being implemented alongside this document; verify in the running app before relying on it.

- The server snapshots every game to `data/sessions/<CODE>.json` after each change (writes are debounced and atomic). In the deployed copy that is `..\aliens-deploy\web app\data\sessions\`. `DATA_DIR` moves it. Snapshots older than 24 hours are deleted when the server loads them.
- If the server restarts, the DM's browser closes, or the network drops, the game is **not lost**: the DM resumes with `resume-game { code, dmToken }` (the `dmToken` is returned when the game is created and is kept by the DM's browser; a DM can also take over with `takeover` when no DM is connected). Players are told the DM reconnected.
- Players who reconnect with the **same name** re-attach to their existing character, tracks, status effects and message history.
- **End the game** only when you are finished: ending deletes the snapshot and sends everyone to the exit screen. Closing the tab or stopping the server does not.
- Between sessions you can leave the deployed server running (or stop and restart it with the script); keep the same `..\aliens-deploy\web app\data\` folder so the snapshots are still there.

## 6. Troubleshooting

| Symptom | Check |
|---|---|
| Phones cannot open the link | Same Wi-Fi? Not a guest/isolated network? Use the LAN URL printed by the deploy script, not `localhost`. Allow `node.exe` / the port in Windows Firewall (Private). |
| `deploy-local.ps1` says "server did not answer" | Port in use (pick `-Port`), or start it by hand: `cd ..\aliens-deploy\web app; node server/index.js` and read the error. Node must be at `C:\Program Files\nodejs`. |
| Join code rejected | Codes are 4 letters (no I or O), case-insensitive. The game may have ended or the server restarted before persistence existed. |
| New pack not in the library | Reload the page. Check the file name equals `<id>.json`, the folder equals `universe`, and run `node scripts/validate-content.mjs` (invalid packs are skipped with a console warning). If you play on the deployed copy, run `deploy-local.ps1` or copy the file to `..\aliens-deploy\web app\content\<universe>\`. |
| Import fails with errors | The error list is the schema validator's; fix the listed paths. Universe must match the one you picked. |
| "generator not installed" / generate errors | Set `ANTHROPIC_API_KEY` in `web app/.env` (see README) or use the Claude Code skill instead. |
| Port 3100 already used | `deploy-local.ps1 -Stop`, or pass another `-Port`. |
| Stale UI after update | Hard refresh (Ctrl+F5). The deployed app serves the last built `dist/`. |
| Text-to-speech silent | Browser voices load lazily; pick a voice in the TTS panel. Works best in Chrome/Edge. |
| Phone screen sleeps | Ask players to keep the screen on; they re-attach with the same name if it drops. |
