# Phase 3 spec — Table Board, GM Map Controller, Character Builder

Extends ARCHITECTURE.md. Same conventions (universe-agnostic engine, data not code, terminal aesthetic).

## 1. Roles

| Role | Device | URL | Sees |
|---|---|---|---|
| `dm` | GM tablet / laptop | `/` → create session | everything + Map Controller |
| `player` | phone | `/?join=CODE` | own sheet, comms, dice, TABLE tab (map of revealed rooms, own room, what is in it, who is with you) |
| `board` | TV lying flat | `/?board=CODE` | full-screen map, tokens in revealed rooms, PC tokens, pings. No chrome, no input except a hidden tap-to-fullscreen. |

`join-board { code }` needs no token (the TV is in the room). The board receives `board-state` only; it never receives character sheets or messages.

## 2. Board state (server, per game, persisted with the session)

```jsonc
"board": {
  "mapId": "chariot-of-the-gods:uscss-montero",  // "<universe map id>" or "<packId>:<map id>"
  "level": "deck-a" | null,              // current level (IMPLEMENTED: separate field, not part of mapId)
  "mapRev": 3,                           // bumped on every board-set-map
  "fog": true,                           // when false every room is revealed
  "view": { "rotation": 0, "flipX": false, "zoom": 1, "pan": [0,0] },   // TV orientation
  "rooms": { "<roomId>": { "revealed": false, "entered": false, "name"?: "GM rename", "note"?: "GM-only" } },
  "tokens": {
    "<tokenId>": {
      "kind": "pc" | "npc" | "creature" | "item" | "marker" | "hazard",
      "label": "Cpl. Hicks", "sub": "M41A", "icon": "/art/.../x.webp" | null, "glyph": "◆",
      "color": "#...", "size": 1,          // size in room-grid units (1 = one person)
      "x": 0.42, "y": 0.61,                // normalized 0..1 in map space
      "roomId": "medbay" | null,           // computed server-side from room shapes on every move
      "hidden": false,                     // GM-only even if the room is revealed
      "ownerPlayerId": "p_<hex>" | null,   // stable player id (pc tokens; colour assigned per player)
      "level": "deck-a" | null,            // level the token is on (defaults to board.level)
      "facing": 0, "note": "..."           // note is GM-only (stripped for board/players)
    }
  },
  "pings": [ { "x":0.1, "y":0.2, "at": 1730000000, "by": "dm" | "p_<hex>", "color": "#..." } ]   // last 5
}
```
The game record also stores `mapDef` (the sanitized definition sent with `board-set-map`);
both `board` and `mapDef` are written into the session snapshot (`server/persistence.js`).
`glyph` is either a named SVG glyph (`diamond triangle square circle hex star cross chevron shield
person crate hazard objective noise blood lock vent fire door claw`) or a short text fallback —
no emoji, the TV draws every glyph as SVG geometry.

Visibility rule (server computes, never the client): the board and players see a token iff
`!hidden && (kind==='pc' || !fog || rooms[token.roomId]?.revealed)`. The DM sees all.
A room becomes `revealed` when the GM toggles it, or automatically when a `pc` token is
moved into it ("when a player enters a room, the items in that room become visible").

Socket events (DM → server unless noted; every DM payload may carry `gameCode`, default = the
socket's game; ack callbacks return `{ success }` or `{ error }`), as implemented in `server/sessions.js`:
- `join-board {code}` (board client, no token) → `{ success, code, universeId, packId, board, mapDef }`.
- `board-sync {}` (any attached socket) → `{ board, mapDef, boardClients? }`.
- `board-set-map {mapId, level?, mapDef}` → `{ success, mapRev }`. The DM client resolves the map
  (bundled packs exist only client-side) and sends the plain-data `mapDef`; the server validates it
  (rooms need kebab ids + rect/poly shapes in 0..1). Same `mapId` = level switch / room edit: tokens
  and reveals are kept and every `roomId` is recomputed. New `mapId`: PC tokens are kept and moved to
  the spawn point, everything else (tokens, reveals, pings) is cleared.
- `board-token-upsert {token}` → `{ success, token }` (partial update when `id` exists).
- `board-token-move {id,x,y}` (throttled client-side to 30 Hz; server recomputes roomId and auto-reveals).
- `board-token-remove {id}`, `board-room-set {roomId, revealed?, name?, note?, hideTokens?}`,
  `board-fog {fog}`, `board-view {view}` (partial; rotation ∈ 0/90/180/270, zoom 0.5–6, pan ±1).
- `board-ping {x,y}` (DM and players; max 1 per second per socket → `{ error: 'RATE LIMITED.' }`).
- `board-reset {}` — clears tokens, reveals and pings, fog back on; map and view kept.
Server → clients: `board-state {board, mapDef?}` (DM full; board + players filtered by the rule
above, token `note`/`hidden` and room notes stripped; `mapDef` only on join/resume/set-map),
`board-ping {x,y,at,by,color}` (everyone), `board-linked {count}` (DM: number of TV clients),
`game-ended` (also sent to board clients). Board clients never receive sheets or messages.
Players get `board-state` right after `join-game` / `rejoin-game`; the DM after `resume-game`.

## 3. Map definitions become data

Both universe maps and pack maps get the same shape (schema extension on `maps[]`):

```jsonc
{ "id": "uscss-montero", "title": "USCSS MONTERO", "subtitle": "...",
  "kind": "image" | "ascii" | "engine",
  "src": "/maps/....webp", "size": [3402, 2197],         // image maps
  "engine": "montero",                                   // engine maps: key into universe.maps engines
  "levels": [ { "id":"deck-a", "label":"DECK A", "src"?:..., "engine"?:... } ],   // optional multi-level
  "rooms": [ { "id":"medbay", "name":"MED BAY", "note":"...", "level":"deck-a",
               "shape": { "type":"rect", "x":0.31, "y":0.22, "w":0.12, "h":0.09 } |
                        { "type":"poly", "points":[[x,y],...] } } ],
  "doors": [ { "from":"medbay", "to":"corridor-1", "locked":false } ],
  "spawn": { "pc": [0.5, 0.9], "levels": { "deck-b": { "pc": [0.5, 0.4] } } },   // default PC drop point(s)
  "grid": 0.02,                       // optional cell size as a fraction of map width (token size 1); default 1/40
  "outline": "M 0.54 0.08 L ... Z",   // optional hull path in NORMALIZED coords; board dims outside it
  "crop": { "x":0.32, "y":0.05, "w":0.45, "h":0.9 }      // optional normalized region the board fits
}
```

Map space: normalized 0..1 of the source (`size`, the image's natural size, or the engine
canvas W×H). Engine maps resolve `engine` via `universe.maps`; the engine component exposes its
MapEngine config as `Component.config` and the board draws one deck (`decks[].level` = level id)
without the GM-screen chrome (`board/EngineLayer.jsx`). A pack map whose `engine` names a universe
engine map uses that map's rooms/levels/outline.

`montero.jsx` reads its deck layout from `montero.geometry.js` (JSX-free, node-importable), which
also exports the normalized `monteroRooms` (51 rooms over decks A/B/C, ids `deck-a-bridge`…),
`monteroOutline`, `monteroCrop` and `monteroSpawn`; `maps/index.js` puts them on the universe map,
so the board overlay and the MapEngine render from one source.

**ASCII maps** (`kind:"ascii"`) get their geometry from `src/engine/maps/asciiMap.js`:
`parseAsciiMap(ascii, rooms)` finds closed box-drawing rectangles (nested boxes = zones, the outer
frame = hull; ±2-column jitter tolerated), reads each box's label, fuzzy-matches labels to
`maps[].rooms` names (token overlap with IDF weights, prefixes, abbreviations, edit distance), splits a
box whose `[TAGS]` match other room names ("ADMIN BLOCK [OPS] [BRIG]"), turns labels outside boxes
into free-text rooms grown over adjacent texture (≈ lava tube, ∴ dune field), and turns connectors
(`├──┤`, `│` shafts, `═══` tubes, `┬/┴` stubs) into corridors and doors. `resolveMapDef` sends
`buildAsciiMapDef(map)` (rooms, doors, size, outline, crop, spawn = centre of the first hinted room);
`board/AsciiLayer.jsx` draws the plan in the universe's `theme.board.deck` palette.

The Map Controller's **Room Editor** works on image, ASCII and engine pack maps (draw a rectangle on
empty map to add; select a room, drag inside to move, drag a corner to resize; rename / delete in the
list; RESTORE GENERATED). A saved room list in which any room has a shape is authoritative
(`mergeRooms`): overlay rooms override generated ones by id and deletions stick; named rooms without
shapes are listed as "unplaced" and can be drawn. Saved back via `PUT /api/content/:universe/:packId`
for runtime packs; bundled packs get an overlay pack `{ kind:"maps", id:"<packId>-maps", maps:[…] }`
whose maps merge into `<packId>` by map id in `ContentContext` (overlay packs are not listed as packs).

## 4. GM Map Controller (`MapController.jsx`, DM nav tab "BOARD")

Tablet-first, pointer events (touch + mouse). Layout: map canvas (SVG overlay on the image or
engine map) + a collapsible right/bottom palette.
- Palette tabs: **CREW** (one token per connected player with a character; drag onto map),
  **THREATS** (from `universe.reference.bestiary`/`universe.catalog.creatures`, with art thumbs),
  **NPCS** (from the active pack's `npcs[]`), **ITEMS** (from `universe.catalog` weapons/gear +
  "custom label"), **MARKERS** (hazard, objective, noise, blood, locked door, vent, fire).
- Token actions (tap token): rename, hide/show, resize, facing, note, remove, "send to player"
  (for items: adds to that player's inventory and removes the token).
- Room actions (tap room): reveal/conceal, rename, note, "all tokens here → hidden".
- Top bar: map picker (universe maps + active pack maps + levels), FOG toggle, ROTATE 90°,
  FLIP, FIT, PING mode, RESET, "OPEN BOARD" (shows `/?board=CODE` + QR).
- Changes stream live to the TV; a small "TV LINKED" dot shows when a board client is attached.
- Implementation notes: palette items can be dragged onto the map or tapped to "arm" and then
  placed with a tap; THREATS prefers `universe.catalog.creatures` (non-NPC types, cropped `art` or
  the bestiary `thumb`, never full-page scans) and falls back to `universe.reference.bestiary`;
  ITEMS prefers catalog weapons/armor/gear, else `universe.gear`. Extra top-bar controls: level
  buttons, ZOOM −/+ (TV zoom), SNAP (grid snap on drop), AS TV (tablet canvas mirrors the TV
  rotation/flip), EDIT ROOMS (image maps from a pack). Token sheet also has a level picker.

## 5. Board view (`BoardView.jsx`)

Full-screen, black background, map fitted to the viewport honoring `view.rotation/flipX`,
tokens as rounded chips (art thumb or glyph + label), unrevealed rooms drawn as dark fog with a
faint outline when `fog` is on, reveal transition (fog dissolves ~500 ms), PC tokens with a
colored ring per player, pings as expanding rings, a thin status strip at one edge with
`terminal.name` + session code + map title. Wake-lock (`navigator.wakeLock`) when available.
Implemented in `BoardView.jsx` + the shared `board/MapCanvas.jsx` (also used by the controller,
the player TABLE tab and the Room Editor). Token chips and room labels are counter-rotated so they
stay upright on the TV. Any tap requests fullscreen. The board remembers `muthur.board =
{ code, role:'board' }` (separate from `muthur.session` so a board tab never steals a GM/player
seat) and re-sends `join-board` on every socket reconnect; a saved board re-attaches on load only
when the browser has no other saved session and no `?join=` link.

**Player TABLE tab** (`player/TablePane.jsx`): no new role or payload. The phone uses the same
filtered `board-state {board, mapDef}` the server already pushes to every player (viewFor
'player' = the board's rule above; public mapDef without GM room notes) and derives the rest on
the client: its own token = the `pc` token whose `ownerPlayerId` is the player's id; YOU ARE IN =
that token's `roomId` (room name from `board.rooms[id].name` or the mapDef); VISIBLE HERE = visible
`item` / `marker` / `hazard` tokens with the same `roomId` and level; WITH YOU = visible `pc` /
`npc` / `creature` tokens there (a `panicking` status ring is shown). MapCanvas `role="player"`,
`highlightPlayerId` = own id, `selectedRoomId` = own room; NEAR ME zooms (`view.zoom` 2.4, pan
clamped) on the own token, WHOLE MAP fits the whole map. TAKE sends the GM a normal
private `player-message` ("I take the …"); the GM hands the item over as usual.

## 6. Character Builder

Purpose: players build legal characters from the universe catalog, on a phone, before or
during a session; the GM can also build/edit. Replaces the current CharacterCreator.

### Catalog (per universe, data files, no JSX): `src/universes/<id>/catalog/`
`careers.json`, `talents.json`, `weapons.json`, `armor.json`, `gear.json`, `conditions.json`,
`injuries.json`, `creatures.json` (bestiary). Common item shape:
```jsonc
{ "id":"m41a-pulse-rifle", "name":"Armat M41A Pulse Rifle", "category":"rifle",
  "stats": { "bonus":1, "damage":2, "range":"long", "weight":1, "cost":800 },
  "tags": ["armor-piercing","full-auto"], "art":"/art/weapons/cropped/m41a-pulse-rifle.webp",
  "source":"CRB", "notes":"...", "effects": [ { "kind":"buff", "text":"+1 to RANGED COMBAT at long range", "when":"..." } ] }
```
Talents: `{ id, name, career: "<career id>"|"general", text, effects:[{kind:'buff', stat?, value?, text}] }`.
Conditions/injuries: `{ id, name, kind:'debuff', severity, text, effects:[...], healBy:"..." }`.
`universe.catalog` exposes these; `rules.creation` gives budgets; `careers[].startingGear`
lists ids; `careers[].keySkills` etc.

### Builder flow (`CharacterBuilder.jsx`, steps, each validated, progress bar)
1. **CAREER** — cards with key attribute, key skills, starting gear preview, talent list.
2. **ATTRIBUTES** — point buy (budget, min/max, key attribute may reach max), live derived
   values (health etc. from `rules.derived`).
3. **SKILLS** — point buy, key skills max per rules, others capped; shows dice pool preview.
4. **TALENT** — pick from career talents (and general if rules allow); shows the buff text.
5. **GEAR** — catalog browser by category with art, filters, weight budget (`rules.encumbrance`
   = STR×2 if defined), starting-gear quick add, custom item; **armor** rating shown.
6. **IDENTITY** — name, appearance, personal agenda (with 3 generated suggestions pulled from
   the active pack's character agendas as inspiration if a session is active), buddy/rival
   (pick from connected players), signature item.
7. **REVIEW** — full sheet, "SAVE" (to the player's own device + submit to session) and
   "SUBMIT TO GM" (socket `character-submit {character}` → DM sees it in the ASSIGN list with a
   "PLAYER-BUILT" badge and can assign/edit/reject).

### Buffs / debuffs at play time
- Sheet shows active **talents** (buffs) and **conditions/injuries/status effects** (debuffs)
  with their mechanical text; DM applies conditions from `universe.catalog.conditions` and
  critical injuries from `injuries.json` (roll or pick); each has `effects[]` the sheet
  displays next to the affected skill/attribute. Status effects remain free-form tags.
- Tracks update (`health` etc.) stay DM-controlled as today.

## 7. Phase 3 work split

- **3A Board + Controller + server board state + map data refactor** (one agent).
- **3B Catalog mining** (reads the sourcebook PDFs outside the repo, writes `catalog/*.json` for
  alien; Dune gets a hand-written catalog from its module) — can run now.
- **3C Character Builder + play-time buffs/debuffs + player-side submit** (after 2C lands).
