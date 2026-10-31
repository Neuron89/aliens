# AI GM: narration drafts from a local model

The AI GM writes read-aloud narration for the GM. It drafts. The GM reads the draft, edits it if needed, and decides whether it reaches the table. Nothing is sent to the TV or the phones until the GM taps a send button.

The model runs on the user's own GPU box (Ollama in CT 107), not on a cloud API. Any OpenAI-compatible chat endpoint works. When no model is reachable, the drawer falls back to the scenario pack's own text, so it always has something to show.

## Where it is

On the GM tablet, open **RUN**, then the **AI GM** tab in the dock (it sits next to NARRATE). The drawer contains:

| Control | What it does |
|---|---|
| Status line | `AI GM: <model> (local)` when the model server answers. Otherwise: `AI GM offline — set GM_URL in web app/.env (Ollama on the GPU box); the pack's own text is used`. A second line, `GPU hand-off: ComfyUI ↔ Ollama`, appears when both servers answer. |
| LENGTH | SHORT (about 60 words), NORMAL (about 110), LONG (about 160). |
| OPEN THIS SCENE | `scene-open`: opens the current scene for the players. |
| DESCRIBE WHERE THEY ARE | `describe`: the rooms the characters are in, who stands where, and what is visible on the board. |
| NPC SPEAKS + SPEAK AS | `npc`: the chosen NPC from the pack speaks in character, in the first person. |
| IMPROVISE | `improv`: type what just happened (for example "they cut the power"), then press Enter or the button. |
| RECAP SO FAR | `recap-so-far`: a short "previously…" for a player who arrives late. |
| AUTO ON/OFF | When AUTO is on, moving to another scene (NEXT SCENE, the scene list, or ADVANCE ACT) drafts `scene-open` by itself. The dock badge shows **NEW** and the drawer shows `READY — review the opening, then SEND + SPEAK`. AUTO never sends anything. The setting is saved in `localStorage` under `muthur.aigm.auto`. |
| Draft box | The text streams in as the model writes it. You can edit it once writing finishes. |
| SEND CAPTION / SEND AS CARD | Sends the draft through `narrate()`, exactly like the NARRATE drawer. |
| SPEAK ON TV / SEND + SPEAK | Sends the draft to the voice pipeline with `speak(text, { target, title })`. The target comes from `localStorage` `muthur.voiceTarget` (`tv`, `gm` or `both`; the default is `tv`), and the button label follows it. If the voice pipeline is not loaded, these buttons are disabled with the tooltip "voice not available". |
| DISCARD / STOP | Clears the draft. While the model is still writing, STOP cancels the request on the server too. |

## The five kinds

All five kinds share one context, built on the server from the session itself. The client never sends scenario text.

* **Voice.** ALIEN uses present tense and second person. Sentences are short and sparse, with concrete sensory detail and dread kept in restraint. DUNE uses the formal, layered voice of a House chronicler, with courtesy as a weapon and water as wealth.
* **The pack.** The model gets the pack's title, tagline and tone, plus the current act and scene from `table.run`. From the scene it gets the read-aloud text, events, encounter detail, NPC guidance and GM tip. These are marked "GM only" so they can shape the mood without being stated.
* **The table.** The model gets the player characters (name and career), where each PC token stands, the revealed rooms (never fogged ones), the visible board tokens, public clocks and clues, the text currently on the TV, and the last 15 public log lines. `recap-so-far` gets the last 40. The log is filtered by `publicLog()` from `server/recap.js`.
* **Never in the prompt.** NPC `secret`s, act `gmNotes` and `agendaNotes`, map room notes, hidden or private clues, endings, character secrets, scene checks and outcomes, GM-only clocks, GM notes and secret rolls.
* **Output rules.** The draft is spoken prose, between 60% of the length and the full length. It has no markdown, stage directions, mechanics or dice. It never addresses the GM and never decides what the player characters do. The server also strips markdown and `<think>` blocks, and trims anything more than 15% over the length at a sentence end.

**Without a model** (the template fallback):

| Kind | Fallback text |
|---|---|
| `scene-open` | The scene's own `narration` (or the act's `readAloud`). |
| `describe` | Stitched from the board, for example "Rye is in the Bridge. You can see …". |
| `npc` | The NPC's name, role, `behavior` and `agenda` lines. |
| `improv` | The prompt, followed by a stock line in the universe's voice. |
| `recap-so-far` | The cast plus the last public events. |

The fallback is never empty.

## Setup (web app/.env)

```
GM_URL=http://192.168.1.37:11434/v1        # Ollama's OpenAI-compatible base on CT 107
GM_MODEL=hf.co/unsloth/Qwen3-30B-A3B-Instruct-2507-GGUF:Q4_K_M
# GM_API_KEY=                              # optional bearer, for a server that needs one (not Ollama)
# GM_TIMEOUT_MS=120000                     # wait for the first byte (a cold model load is slow)
```

* **Changing the model.** Set `GM_MODEL` to any name that `ollama list` shows on the GPU box (run `ssh -i ~/.ssh/proxmox root@192.168.1.254`, then `pct exec 107 -- docker exec ollama ollama list`; the container name may differ), then restart the server. If the model is not listed, the status response carries a `warning`.
* **Model loading.** The first narration after the model has been unloaded has to load it. For the 18 GB Qwen3-30B model this took about 95 s in testing. After that, drafts start in under half a second and stream at about 130 chunks per second. Ollama keeps the model loaded for about 5 minutes after its last use (its default `keep_alive`), and then frees the VRAM.
* **Turning it off.** Leave `GM_URL` empty. The drawer then uses the pack text and says so in its status line.

## VRAM hand-off

ComfyUI (portraits) and Ollama (narration) share one GPU, so each one asks the other to release the card before it starts:

* **Before a narration.** `server/gm.js` calls `releaseForLlm()` from `server/vram.js`, which sends `POST {COMFY_URL}/free` with `{"unload_models": true, "free_memory": true}`. It runs at most once every 60 s, so repeated narrations do not keep sending it.
* **Before a portrait.** `server/portrait.js` calls `releaseForImages()` just before it queues the ComfyUI prompt. That function sends `GET {ollama}/api/ps` and then, for each loaded model, `POST {ollama}/api/generate` with `{"model": name, "keep_alive": 0}`, which is how Ollama unloads a model. `{ollama}` is `GM_URL` without its trailing `/v1`.
* **Failure handling.** Each call has a 3 s timeout and never throws. If a server is unreachable, the call does nothing.
* **Status.** `GET /api/gm/status` includes `vram: { comfy, ollama }` reachability flags. When both are true, the drawer shows the hand-off line.
* **Idle steward.** Another builder is setting up an idle steward on the GPU box: ComfyUI unloads its models after 10 idle minutes, and Ollama evicts its model after 10 minutes.

## HTTP contract

```
GET  /api/gm/status            → { ok, provider:'local'|'none', model, url, vram:{ comfy, ollama }, warning? }
                                 (probes GET ${GM_URL}/models, 3 s timeout, cached 60 s; ?fresh=1 re-probes)
POST /api/gm/narrate           body { code, dmToken, kind, prompt?, npcId?, maxWords? }
     kind     scene-open | describe | npc | improv | recap-so-far
     npcId    the slug of the NPC's name (as in the drawer), its index, or its exact name
     maxWords 40..200 (default 110)
     403 not_authorized (dmToken must match the game's, like /api/recap)
     400 bad_kind | prompt_required (improv) | prompt_too_long (> 600) | unknown_npc
     429 busy (one narration per game at a time)
     SSE (default):  event: status data:{ provider:'local'|'template', model, kind }
                     event: delta  data:{ text, chunk }      text = the draft so far
                     event: done   data:{ text, provider, model, kind, words, warning? }
                     event: error  data:{ message }
     Accept: application/json → 200 { text, provider, model, kind, words, warning? }
```

The router is mounted in `server/index.js` behind `requireApiToken`, like the other `/api` routers. If the client disconnects, the request to the model server is cancelled. Upstream, the server calls `POST ${GM_URL}/chat/completions` with `{ model, messages:[system, user], stream:true, temperature:0.8, max_tokens }`.

## AI BUILD (dress the map)

The drawer's **BUILD** tab (tabs across the top: **NARRATE | BUILD | ROOMS**) asks the model to dress the map that is on the table: items, creatures, NPCs, markers and hazards per room, a short read-aloud description and mood per room, and at most one check per room. Nothing reaches the board until the GM applies it.

| Control | What it does |
|---|---|
| Status line | `AI BUILD: model <name>` or `template (no model)`, and the number of AI tokens on the board (tokens tagged `ai: true`). The map's title on a second line. |
| DENSITY | SPARSE (about 1 token per 2 rooms), NORMAL (1–2 per room), DENSE (2–3 per room). Saved in `localStorage` `muthur.aigm.density`. |
| BUILD THIS MAP | `POST /api/gm/build`. A spinner counts the seconds; the local model takes 10–30 s. You can close the drawer, and the dock badge shows **…** while it works. Disabled when no map is on the table. Once a plan exists, the button reads REBUILD. |
| Plan list | One card per room: the room name, the mood, the first lines of the description, the token chips (glyph, kind, label, **HIDDEN** / **LOCKED** marks; the GM note is the chip's tooltip) and the check line `ROLL <skill> (difficulty n): <label>`, plus hazard and loot lines when the plan has them. Each card has an **APPLY ON/OFF** toggle (on by default); ALL / NONE flip every card. |
| APPLY SELECTED | `POST /api/gm/build/apply` with the plan and the chosen room ids. The server places the tokens inside each room's shape, creatures and NPCs hidden, items visible unless the plan hides them, and stores the plan as `table.aiPlan` (GM only). |
| REBUILD | Asks for a new plan with the current density. The tokens already applied stay until you apply again or clear. |
| CLEAR AI BUILD | Tap twice. `POST /api/gm/build/clear` removes every `ai: true` token and the stored plan. Tokens you placed yourself are never touched. |

The model receives the universe voice, the pack's synopsis and tone, the threats and NPCs (names, roles and behaviour, never secrets), the key locations, the act and scene titles, and the map's rooms (including GM room notes), doors and spawn. The server validates the plan: unknown rooms, kinds, glyphs and skills are dropped, at most 4 tokens per room and 60 in total, never a creature in the spawn room. Without a model the server stitches a plan from the pack (threats in far rooms, NPCs, key locations as markers, stock items), so the plan is never empty. When the drawer opens, a plan built earlier in the session (`GET /api/gm/build`, or `table.aiPlan`) is listed again.

## Room entry (the AI GM reacts)

Players can walk their own character through a door. On the phone's **TABLE** tab, under the map, **EXITS** lists the doors out of the room the character is in (`mapDef.doors`, both directions):

* An unlocked door is a button **ENTER <ROOM>**. A locked door is a greyed **LOCKED <ROOM>**. Rooms the GM has flagged open (`board.rooms[id].open`) are enterable too.
* A character on the map but outside every room gets one button, **ENTER** the room that holds the map's spawn point.
* Tapping sends `player-enter-room { roomId }`. The buttons are disabled until the answer arrives (6 s at most). The server checks adjacency, locked doors and a rate limit of one move per 2 s, moves the token, reveals the room under fog, and answers `{ success, roomId, name }` or an error such as `DOOR LOCKED.` or `NOT ADJACENT.`, which the phone shows for a few seconds. On success the phone shows **YOU ENTER <ROOM>** and the YOU ARE IN line follows.
* When the GM has the AI reaction on (REVIEW or LIVE), the phone adds "The GM's AI reacts when you enter." The narration itself reaches the phones and the TV through the normal caption path, not the EXITS block.

The GM gets `room-entered` for every entry, also when the GM drags a PC token into another room (fired once the drag rests for 600 ms). The **ROOMS** tab of the AI GM drawer shows them:

| Control | What it does |
|---|---|
| ENTRY OFF / REVIEW / LIVE | `ai-gm-set { entry }`, saved with the session (`table.aiGm`). OFF: no AI reaction (players can still use EXITS). REVIEW: the AI drafts, you send. LIVE: the server sends by itself. |
| VOICE ON/OFF | `ai-gm-set { voice }`. In LIVE mode the server also speaks the narration on the TV. |
| Feed | Newest first: who, which room, the time. While the AI writes: "THE AI IS WRITING…". Then the draft (`ai-gm-draft`) in an editable box and the room's check line. |
| REVIEW buttons | **SEND CAPTION** (`narrate`, titled with the room), **SEND + SPEAK** (caption and `speak()` to the voice target), **ASK <NAME> TO ROLL <SKILL>** (`rollRequest` to that player only, with the plan's skill, difficulty and label), **DISMISS**. Each button shows ✓ once done. |
| LIVE markers | **SENT · SPOKEN · ROLL ASKED**, lit from the draft and the session log once the server has done each one. The draft box is read-only. |

The dock badge counts drafts you have not looked at; opening the ROOMS tab clears it. The feed lives with the Run view, so it fills while the drawer is closed; it is not saved with the session (the session log keeps what was sent).

The `enter-room` context is the room name, the plan's room (description, visible tokens, check, hazard), who entered, who else is there, whether the room was visited before (`table.visitedRooms`), and the current scene. The check is offered on the first visit only.

### Client helpers (GameContext)

```
playerEnterRoom(roomId, cb)            player → 'player-enter-room' { roomId }; ack { success, roomId, name } | { error }
aiGmSet({ entry, voice }, cb)          DM → 'ai-gm-set' (optimistic table.aiGm)
onRoomEntered(fn) / onAiGmDraft(fn)    DM one-shot events → unsubscribe
aiBuild({ density, mapId? })           POST /api/gm/build        → { plan, provider }
aiBuildApply(plan, rooms?)             POST /api/gm/build/apply  → { applied:{ rooms, tokens }, plan }
aiBuildClear()                         POST /api/gm/build/clear  → { removed }
aiBuildGet()                           GET  /api/gm/build?code&dmToken → { plan | null }
```

The HTTP helpers send `{ code, dmToken }` with `apiHeaders()` (the `x-api-token` when one is stored) and reject with the server's message; a 403 reads "Not authorized: this tablet has no GM token for the session (rejoin as GM)."

## Limits

* The drafts are only as good as the local model. In particular, it can sometimes invent a detail that is not in the pack, which is one reason the GM reviews every draft.
* `describe` needs PC tokens on the board. Without them, it falls back to the scene's text.
* There is one narration at a time per game. Starting a new one in the drawer cancels the running one.
* The server builds the context from the pack: the runtime override in `content/<universe>/<id>.json` if there is one, otherwise the bundled pack.

## Tests

`node scripts/test-aigm.mjs` starts a mock OpenAI chat server and a mock ComfyUI/Ollama in the same process. It checks the context for both universes (persona present, secrets absent, PCs and rooms listed, maxWords honoured), the fallback for every kind, streaming and `<think>` stripping, the HTTP routes (403/400/429, SSE, JSON, abort on disconnect), the VRAM hand-off (one `/free` per 60 s, Ollama unloads before a portrait, no errors when servers are unreachable), and the real `server/index.js` mount. The tests never contact the GPU box.
