/* ═══════════════════════════════════════════════════════════════
   GAME SESSIONS — in-memory store + Socket.io handlers + persistence.
   Universe-agnostic: tracks/conditions are supplied by the DM client
   from universe.rules when a character is assigned.

   Identity model
   - Player `id` is a STABLE id (survives reconnects); the current socket
     is `player.socketId`. Messages use `fromId`/`toId` = stable player id,
     or 'dm' for the game master and 'broadcast' for everyone.
   - The DM socket is `game.dmId` (null while dormant). The DM authenticates
     with `dmToken`, players with `playerToken` (both issued once).
   ═══════════════════════════════════════════════════════════════ */
import { randomBytes } from 'crypto';
import { loadSnapshots, scheduleSave, removeSnapshot, allowCode, MAX_AGE_MS } from './persistence.js';
import {
  emptyBoard, sanitizeMapDef, publicMapDef, sanitizeToken, placeToken, relocateAll, viewFor,
  sanitizeView, isMapId, isLevelId, isTokenId, spawnPoint, MAX_TOKENS, MAX_PINGS,
} from './board.js';
import { appendLog, logOf } from './sessionLog.js';

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const GM = 'GM';
const HISTORY_LIMIT = 200;
const MESSAGE_CAP = 1000;
const SAVED_EMIT_MS = 1000;
const PING_INTERVAL_MS = 1000;
const PC_COLORS = ['#4fc3f7', '#ffb74d', '#81c784', '#e57373', '#ba68c8', '#fff176', '#4db6ac', '#f06292'];

export const games = new Map();

const token = () => randomBytes(18).toString('base64url'); // 24 chars
const newPlayerId = () => 'p_' + randomBytes(6).toString('hex');

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (games.has(code));
  return code;
}

function createGame(dmSocketId, { universeId, packId } = {}) {
  const code = generateCode();
  allowCode(code);
  const now = Date.now();
  const game = {
    code,
    dmId: dmSocketId,
    universeId: typeof universeId === 'string' && ID_RE.test(universeId) ? universeId : 'alien',
    packId: typeof packId === 'string' && ID_RE.test(packId) ? packId : null,
    status: 'live',
    createdAt: now,
    updatedAt: now,
    dmToken: token(),
    players: new Map(),
    messages: [],
    assignedCharacterIds: new Set(),
    board: emptyBoard(),
    mapDef: null,
    table: emptyTable(),
    log: [],
  };
  games.set(code, game);
  return game;
}

/** Board state lives on the game record (persisted with the snapshot); older snapshots get an empty board. */
function boardOf(game) {
  if (!game.board || typeof game.board !== 'object' || !game.board.tokens) game.board = emptyBoard();
  if (game.mapDef === undefined) game.mapDef = null;
  return game.board;
}

function getPlayerData(player) {
  return {
    id: player.id,
    name: player.name,
    character: player.character,
    tracks: player.tracks,
    trackMax: player.trackMax,
    statusEffects: player.statusEffects,
    inventory: player.inventory,
    alive: player.alive,
    conditions: player.conditions,
    connected: !!player.connected,
  };
}

function serializePlayers(game) {
  const result = {};
  for (const [id, p] of game.players) result[id] = getPlayerData(p);
  return result;
}

function numberMap(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

function clampTrack(player, key, value) {
  const max = player.trackMax[key];
  const v = Math.max(0, Number(value) || 0);
  return Number.isFinite(max) ? Math.min(v, max) : v;
}

const msgId = () => Date.now() + '-' + Math.random().toString(36).slice(2, 6);

const isPlayerMessage = (m, player) =>
  m.toId === player.id || m.fromId === player.id || m.toId === 'broadcast';

function historyForPlayer(game, player) {
  return game.messages.filter((m) => isPlayerMessage(m, player)).slice(-HISTORY_LIMIT);
}

function historyForDM(game) {
  return game.messages.slice(-HISTORY_LIMIT).map((m) =>
    m.type === 'p2p' ? { ...m, dmNote: `[P2P] ${m.from} → ${m.to}` } : m);
}

/* ═══ SESSION FEATURES (table) — contract: ARCHITECTURE.md "Sessions" ═══
   game.table holds the run state (scene progress), narration / theatre
   mode, handouts with receipts, clues, progress clocks, safety tools,
   pause (anonymous X-card), act agenda orders, player-built character
   submissions and the roll buffer. Persisted with the snapshot.
   Each role gets a filtered view (tableView): the DM everything, the
   board public pieces only, each player what was sent to them. */
const CLOCK_KINDS = ['danger', 'racing', 'tug'];
const NARRATE_MODES = ['caption', 'card'];
const MAX_HANDOUTS = 200;
const MAX_CLUES = 300;
const MAX_CLOCKS = 30;
const MAX_SUBMISSIONS = 50;
const MAX_ROLLS = 100;
const MAX_CLIENT_IDS = 400;
const MAX_CHARACTER_BYTES = 64 * 1024;
const MAX_ROLL_BYTES = 4096;
const PAUSE_INTERVAL_MS = 3000;
const ITEM_RE = /^[A-Za-z0-9_-]{1,64}$/;
const sstr = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const urlish = (v) => (typeof v === 'string' && v.length <= 500 && /^(\/|https?:\/\/)/.test(v) ? v : null);
const shortId = (prefix) => `${prefix}-${Date.now().toString(36)}${randomBytes(2).toString('hex')}`;
const asId = (v, prefix) => (typeof v === 'string' && ITEM_RE.test(v) ? v : shortId(prefix));

export function emptyTable() {
  return {
    run: { actIndex: 0, sceneIndex: 0, completed: {}, actTitle: '', sceneTitle: '' },
    narration: null,        // { id, text, title, mode, art, at }
    boardMode: 'map',       // 'map' | 'theatre'
    theatre: { title: '', subtitle: '', art: null },
    handouts: [],           // [{ id, title, from, to, priority, text, image, recipients:'all'|[ids], sentAt, seenBy[] }]
    clues: [],              // [{ id, text, source, scene, status:'hidden'|'revealed', revealedTo:'all'|[ids]|null, foundBy[], revealedAt, adhoc }]
    clocks: [],             // [{ id, label, segments, filled, kind, visibility }]
    safety: { enabled: false, tone: [], warnings: [], linesVeils: '', confirmed: [] },
    pause: null,            // { at } — never who
    orders: {},             // playerId -> [{ actIndex, actTitle, text, at }]
    submissions: [],        // [{ id, playerId, playerName, character, at, status:'pending'|'assigned'|'rejected', reason }]
    rolls: [],              // [{ id, playerId, playerName, characterName, roll, at }]
    clientIds: [],          // ids of replayed phone actions already applied (dedupe)
    seeded: false,          // pack clocks/clues seeded (session-seed) — never re-seeded after GM edits
  };
}

/** game.table, normalized (older snapshots have none or a partial one). */
function tableOf(game) {
  const base = emptyTable();
  const t = game.table && typeof game.table === 'object' ? game.table : {};
  for (const k of Object.keys(base)) {
    if (t[k] === undefined || (Array.isArray(base[k]) && !Array.isArray(t[k]))) t[k] = base[k];
  }
  if (!t.run || typeof t.run !== 'object') t.run = base.run;
  if (!t.run.completed || typeof t.run.completed !== 'object') t.run.completed = {};
  if (!t.safety || typeof t.safety !== 'object') t.safety = base.safety;
  if (!Array.isArray(t.safety.confirmed)) t.safety.confirmed = [];
  if (!t.theatre || typeof t.theatre !== 'object') t.theatre = base.theatre;
  if (!t.orders || typeof t.orders !== 'object') t.orders = {};
  game.table = t;
  return t;
}

const pcName = (p) => p?.character?.name || p?.name || 'Unknown';
const sentTo = (recipients, playerId) => recipients === 'all' || (Array.isArray(recipients) && recipients.includes(playerId));

/** Recipient list: 'all' or an array of known player ids (null when empty/invalid). */
function recipientsOf(game, to) {
  if (to === 'all' || to === undefined || to === null) return 'all';
  const list = (Array.isArray(to) ? to : [to]).map(String).filter((id) => game.players.has(id));
  return list.length ? Array.from(new Set(list)) : null;
}
function mergeRecipients(a, b) {
  if (a === 'all' || b === 'all') return 'all';
  return Array.from(new Set([...(a || []), ...(b || [])]));
}
const recipientCount = (game, r) => (r === 'all' ? game.players.size : (r || []).length);

function sanitizeClock(input, prev) {
  if (!input || typeof input !== 'object') return null;
  const segRaw = Number(input.segments ?? prev?.segments ?? 4);
  const segments = Math.max(2, Math.min(12, Number.isFinite(segRaw) ? Math.round(segRaw) : 4));
  const filledRaw = Number(input.filled ?? prev?.filled ?? 0);
  const label = sstr(input.label ?? prev?.label, 80).trim();
  if (!label) return null;
  const note = sstr(input.note ?? prev?.note, 300);
  return {
    id: prev?.id || asId(input.id, 'clock'),
    label,
    segments,
    filled: Math.max(0, Math.min(segments, Number.isFinite(filledRaw) ? Math.round(filledRaw) : 0)),
    kind: CLOCK_KINDS.includes(input.kind) ? input.kind : (prev?.kind || 'danger'),
    visibility: input.visibility === 'gm' || input.visibility === 'all' ? input.visibility : (prev?.visibility || 'all'),
    ...(note ? { note } : {}),
  };
}

function sanitizeClue(input, prev) {
  if (!input || typeof input !== 'object') return null;
  const text = sstr(input.text ?? prev?.text, 1000).trim();
  if (!text) return null;
  return {
    id: prev?.id || asId(input.id, 'clue'),
    text,
    source: sstr(input.source ?? prev?.source, 200),
    scene: sstr(input.scene ?? prev?.scene, 120),
    status: prev?.status || 'hidden',
    revealedTo: prev?.revealedTo ?? null,
    foundBy: prev?.foundBy || [],
    revealedAt: prev?.revealedAt || null,
    adhoc: prev ? !!prev.adhoc : !!input.adhoc,
  };
}

function sanitizeHandout(input) {
  if (!input || typeof input !== 'object') return null;
  const text = sstr(input.text, 8000);
  const title = sstr(input.title, 160).trim();
  const image = urlish(input.image);
  if (!title || (!text.trim() && !image)) return null;
  return {
    title, text, image,
    from: sstr(input.from, 200), to: sstr(input.to, 200), priority: sstr(input.priority, 40),
  };
}

/** Role-filtered table view. role: 'dm' | 'board' | 'player' (+ the player record). */
function tableView(game, role, player = null) {
  const t = tableOf(game);
  const nameOf = (id) => pcName(game.players.get(id));
  const publicClocks = t.clocks.filter((c) => c.visibility !== 'gm');
  if (role === 'dm') {
    const { clientIds, ...rest } = t; // eslint-disable-line no-unused-vars
    return rest;
  }
  if (role === 'board') {
    return {
      narration: t.narration, boardMode: t.boardMode, theatre: t.theatre,
      clocks: publicClocks, pause: t.pause ? { at: t.pause.at } : null,
    };
  }
  const pid = player?.id;
  const sub = [...t.submissions].reverse().find((s) => s.playerId === pid);
  return {
    narration: t.narration,
    clocks: publicClocks,
    paused: !!t.pause,
    handouts: t.handouts
      .filter((h) => sentTo(h.recipients, pid))
      .map(({ recipients, seenBy, ...h }) => ({ ...h, seen: seenBy.includes(pid) })), // eslint-disable-line no-unused-vars
    clues: t.clues
      .filter((c) => c.status === 'revealed' && sentTo(c.revealedTo, pid))
      .map((c) => ({ id: c.id, text: c.text, source: c.source, revealedAt: c.revealedAt, foundBy: c.foundBy.map(nameOf) })),
    safety: t.safety.enabled
      ? { enabled: true, tone: t.safety.tone, warnings: t.safety.warnings, linesVeils: t.safety.linesVeils, confirmed: t.safety.confirmed.includes(pid) }
      : { enabled: false },
    orders: t.orders[pid] || [],
    submission: sub ? { id: sub.id, status: sub.status, reason: sub.reason || '', at: sub.at, name: sub.character?.name || '' } : null,
  };
}

/** Multiset difference: entries of `next` that are not in `prev`. */
function addedItems(prev, next) {
  const counts = new Map();
  for (const i of prev || []) counts.set(i, (counts.get(i) || 0) + 1);
  const added = [];
  for (const i of next || []) {
    const n = counts.get(i) || 0;
    if (n > 0) counts.set(i, n - 1); else added.push(i);
  }
  return added;
}

/** Wire all session socket handlers onto a Socket.io server. */
export function attachSessions(io) {
  /* ─── Load dormant games from disk ──────────────── */
  for (const g of loadSnapshots()) games.set(g.code, g);
  if (games.size) console.log(`[SESSION] Loaded ${games.size} dormant game(s) from disk`);

  /* Expire dormant games nobody came back for. */
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [code, g] of games) {
      if (g.status === 'dormant' && now - g.updatedAt > MAX_AGE_MS) {
        games.delete(code);
        removeSnapshot(code);
      }
    }
  }, 60 * 60 * 1000);
  sweep.unref?.();

  const lastSavedEmit = new Map();
  function onSaved(game, savedAt) {
    if (!game.dmId) return;
    if (savedAt - (lastSavedEmit.get(game.code) || 0) < SAVED_EMIT_MS) return;
    lastSavedEmit.set(game.code, savedAt);
    io.to(game.dmId).emit('game-saved', { code: game.code, savedAt });
  }

  /** Mark a mutation: bump updatedAt and queue a snapshot. */
  function touch(game) {
    game.updatedAt = Date.now();
    scheduleSave(game, onSaved);
  }

  const toDM = (game, event, payload) => { if (game.dmId) io.to(game.dmId).emit(event, payload); };
  const toPlayer = (player, event, payload) => { if (player.socketId) io.to(player.socketId).emit(event, payload); };

  function broadcastPlayerList(game) {
    const playerList = [];
    for (const [id, p] of game.players) {
      playerList.push({ id, name: p.name, characterName: p.character?.name || null, connected: !!p.connected });
    }
    for (const [, p] of game.players) toPlayer(p, 'player-list', { players: playerList });
  }

  function pushMessage(game, message) {
    game.messages.push(message);
    if (game.messages.length > MESSAGE_CAP) game.messages.splice(0, game.messages.length - MESSAGE_CAP);
  }

  function attachPlayerSocket(socket, game, player) {
    player.socketId = socket.id;
    player.connected = true;
    socket.join(game.code);
    socket.data = { code: game.code, role: 'player', playerId: player.id };
  }

  function attachDMSocket(socket, game) {
    const previous = game.dmId;
    if (previous && previous !== socket.id) {
      io.to(previous).emit('session-taken', { code: game.code });
      const old = io.sockets.sockets.get(previous);
      if (old) old.data = {};
    }
    game.dmId = socket.id;
    game.status = 'live';
    socket.join(game.code);
    socket.data = { code: game.code, role: 'dm' };
  }

  const dmOf = (socket, code) => {
    const game = games.get(code);
    return game && game.dmId === socket.id ? game : null;
  };

  /* ─── Table board helpers ─────────────────────────── */
  const boardRoom = (code) => `${code}:board`;
  const boardCount = (code) => io.sockets.adapter.rooms.get(boardRoom(code))?.size || 0;
  const lastPing = new Map(); // socket.id -> ms
  /** DM-authorized game for a board event ({ gameCode } or the socket's own session). */
  const dmBoardGame = (socket, payload) => dmOf(socket, String(payload?.gameCode || socket.data?.code || '').toUpperCase());

  function boardPayload(game, role, withMap) {
    const board = viewFor(boardOf(game), role);
    if (!withMap) return { board };
    return { board, mapDef: role === 'dm' ? game.mapDef : publicMapDef(game.mapDef) };
  }

  /** Push board state to everyone attached: DM full, board + players filtered (computed once). */
  function emitBoard(game, { withMap = false } = {}) {
    if (game.dmId) io.to(game.dmId).emit('board-state', boardPayload(game, 'dm', withMap));
    const pub = boardPayload(game, 'board', withMap);
    io.to(boardRoom(game.code)).emit('board-state', pub);
    for (const [, p] of game.players) toPlayer(p, 'board-state', pub);
  }

  function sendBoardTo(socket, game, role) {
    socket.emit('board-state', boardPayload(game, role, true));
  }

  const notifyBoardLinked = (game) => toDM(game, 'board-linked', { count: boardCount(game.code) });

  function playerColor(game, playerId) {
    const ids = Array.from(game.players.keys());
    const i = ids.indexOf(playerId);
    return PC_COLORS[(i < 0 ? 0 : i) % PC_COLORS.length];
  }

  function tokenCtx(game) {
    const b = boardOf(game);
    return {
      playerIds: new Set(game.players.keys()),
      levels: new Set((game.mapDef?.levels || []).map((l) => l.id)),
      defaultLevel: b.level,
    };
  }

  /* ─── Session-feature (table) helpers ───────────── */
  const lastPause = new Map(); // socket.id -> ms (X-card spam guard)
  function rememberClientId(t, id) {
    t.clientIds.push(id);
    if (t.clientIds.length > MAX_CLIENT_IDS) t.clientIds.splice(0, t.clientIds.length - MAX_CLIENT_IDS);
  }
  /** Push `table-state { table }` (role-filtered). opts.dmOnly → DM only; opts.only → that player only. */
  function emitTable(game, { dmOnly = false, only = null } = {}) {
    if (only) { toPlayer(only, 'table-state', { table: tableView(game, 'player', only) }); return; }
    if (game.dmId) io.to(game.dmId).emit('table-state', { table: tableView(game, 'dm') });
    if (dmOnly) return;
    io.to(boardRoom(game.code)).emit('table-state', { table: tableView(game, 'board') });
    for (const [, p] of game.players) toPlayer(p, 'table-state', { table: tableView(game, 'player', p) });
  }
  /** Append to the session log and stream the entry to the DM. */
  const logTo = (game, type, text, extra) => {
    const e = appendLog(game, type, text, extra);
    if (e) toDM(game, 'log-entry', { entry: e });
    return e;
  };

  io.on('connection', (socket) => {
    console.log(`[SESSION] Connection: ${socket.id}`);

    /* ─── DM: Create Game { universeId, packId? } → { code, universeId, packId, dmToken } ───── */
    socket.on('create-game', (opts, maybeCallback) => {
      const callback = typeof opts === 'function' ? opts : maybeCallback;
      const options = typeof opts === 'object' && opts ? opts : {};
      const game = createGame(socket.id, options);
      socket.join(game.code);
      socket.data = { code: game.code, role: 'dm' };
      touch(game);
      console.log(`[SESSION] Game ${game.code} created (${game.universeId}${game.packId ? ' / ' + game.packId : ''})`);
      callback?.({ code: game.code, universeId: game.universeId, packId: game.packId, dmToken: game.dmToken });
    });

    /* ─── DM: Resume { code, dmToken } | { code, takeover: true } (only if no DM connected) ─── */
    socket.on('resume-game', ({ code, dmToken, takeover } = {}, callback) => {
      const game = games.get(String(code || '').toUpperCase());
      if (!game) return callback?.({ error: 'GAME NOT FOUND.' });
      const tokenOk = typeof dmToken === 'string' && dmToken === game.dmToken;
      const takeoverOk = takeover === true && !game.dmId;
      if (!tokenOk && !takeoverOk) return callback?.({ error: 'NOT AUTHORIZED. ANOTHER TERMINAL HOLDS THIS SESSION.' });

      attachDMSocket(socket, game);
      touch(game);
      console.log(`[SESSION] DM resumed game ${game.code}`);
      callback?.({
        success: true, code: game.code, universeId: game.universeId, packId: game.packId,
        dmToken: game.dmToken, players: serializePlayers(game), messages: historyForDM(game),
        table: tableView(game, 'dm'), log: logOf(game),
      });
      for (const [, p] of game.players) toPlayer(p, 'dm-reconnected', { code: game.code });
      sendBoardTo(socket, game, 'dm');
      notifyBoardLinked(game);
    });

    /* ─── DM: End Game { code, dmToken } ───────────── */
    socket.on('end-game', ({ code, dmToken } = {}, callback) => {
      const key = String(code || '').toUpperCase();
      const game = games.get(key);
      if (!game) return callback?.({ success: true });
      if (dmToken !== game.dmToken) return callback?.({ error: 'NOT AUTHORIZED.' });
      for (const [, p] of game.players) toPlayer(p, 'game-ended', { reason: 'The game master has ended the session.' });
      io.to(boardRoom(key)).emit('game-ended', { reason: 'The game master has ended the session.' });
      io.in(boardRoom(key)).socketsLeave(boardRoom(key));
      games.delete(key);
      removeSnapshot(key);
      if (socket.data?.code === key) socket.data = {};
      socket.leave(key);
      console.log(`[SESSION] Game ${key} ended by DM`);
      callback?.({ success: true });
    });

    /* ─── List resumable (no auth) ─────────────────── */
    socket.on('list-resumable', (opts, maybeCallback) => {
      const cb = typeof opts === 'function' ? opts : maybeCallback;
      const list = Array.from(games.values())
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((g) => ({
          code: g.code, universeId: g.universeId, packId: g.packId,
          players: g.players.size, updatedAt: g.updatedAt, status: g.status,
          dmConnected: !!g.dmId,
        }));
      cb?.(list);
    });

    /* ─── Player: Join Game { code, playerName } ───── */
    socket.on('join-game', ({ code, playerName } = {}, callback) => {
      const game = games.get(String(code || '').toUpperCase());
      if (!game) return callback?.({ error: 'GAME NOT FOUND. CHECK YOUR ACCESS CODE.' });
      if (socket.data?.role === 'player' && socket.data.code === game.code) return callback?.({ error: 'ALREADY CONNECTED.' });

      const name = String(playerName || 'Player').slice(0, 40);
      // A returning player whose seat is vacant gets their record back instead of a duplicate.
      let player = Array.from(game.players.values()).find((p) => p.name === name && !p.connected);
      const rejoined = !!player;
      if (player) {
        player.playerToken = token();
      } else {
        player = {
          id: newPlayerId(), playerToken: token(), socketId: null, connected: false,
          name, character: null, tracks: {}, trackMax: {}, statusEffects: [], inventory: [],
          alive: true, conditions: {},
        };
        game.players.set(player.id, player);
      }
      attachPlayerSocket(socket, game, player);
      touch(game);

      console.log(`[SESSION] Player "${player.name}" ${rejoined ? 're-' : ''}joined game ${game.code}`);
      callback?.({
        success: true, playerId: player.id, playerToken: player.playerToken, rejoined,
        universeId: game.universeId, packId: game.packId,
        player: getPlayerData(player), messages: rejoined ? historyForPlayer(game, player) : [],
        table: tableView(game, 'player', player), dmConnected: !!game.dmId,
      });

      toDM(game, 'player-joined', { player: getPlayerData(player), players: serializePlayers(game) });
      broadcastPlayerList(game);
      sendBoardTo(socket, game, 'player');
    });

    /* ─── Player: Rejoin { code, playerToken } | { code, playerName } ───── */
    socket.on('rejoin-game', ({ code, playerToken, playerName } = {}, callback) => {
      const game = games.get(String(code || '').toUpperCase());
      if (!game) return callback?.({ error: 'GAME NOT FOUND.' });

      let player = null;
      let issued = false;
      if (typeof playerToken === 'string' && playerToken) {
        player = Array.from(game.players.values()).find((p) => p.playerToken === playerToken);
      } else if (playerName) {
        player = Array.from(game.players.values()).find((p) => p.name === String(playerName) && !p.connected);
        if (player) { player.playerToken = token(); issued = true; }
      }
      if (!player) return callback?.({ error: 'GAME NOT FOUND. PLAYER RECORD UNKNOWN.' });

      // Same player reconnecting on a new socket: retire the stale one.
      if (player.socketId && player.socketId !== socket.id) {
        const old = io.sockets.sockets.get(player.socketId);
        if (old) { old.data = {}; old.emit('session-taken', { code: game.code }); }
      }
      attachPlayerSocket(socket, game, player);
      touch(game);

      console.log(`[SESSION] Player "${player.name}" rejoined game ${game.code}${issued ? ' (by name)' : ''}`);
      callback?.({
        success: true, playerId: player.id, playerToken: player.playerToken,
        universeId: game.universeId, packId: game.packId,
        player: getPlayerData(player), messages: historyForPlayer(game, player),
        dmConnected: !!game.dmId, table: tableView(game, 'player', player),
      });
      toDM(game, 'player-joined', { player: getPlayerData(player), players: serializePlayers(game), rejoined: true });
      broadcastPlayerList(game);
      sendBoardTo(socket, game, 'player');
    });

    /* ─── DM: Assign Character { character, tracks, trackMax, conditions[] } ─── */
    socket.on('assign-character', ({ gameCode, playerId, character, tracks, trackMax, conditions } = {}) => {
      const game = dmOf(socket, gameCode);
      if (!game || !character) return;
      const player = game.players.get(playerId);
      if (!player) return;

      if (player.character?.id) game.assignedCharacterIds.delete(player.character.id);

      player.character = character;
      player.trackMax = numberMap(trackMax);
      player.tracks = {};
      for (const [k, v] of Object.entries(numberMap(tracks))) player.tracks[k] = clampTrack(player, k, v);
      player.inventory = [...(character.gear || [])];
      player.alive = true;
      player.statusEffects = [];
      player.conditions = Object.fromEntries((Array.isArray(conditions) ? conditions : []).map((c) => [String(c), false]));

      game.assignedCharacterIds.add(character.id);
      // A pending player-built submission from this seat (or for this character) is now resolved.
      for (const sub of tableOf(game).submissions) {
        if (sub.status === 'pending' && (sub.playerId === player.id || sub.character?.id === character.id)) {
          sub.status = 'assigned';
          const owner = game.players.get(sub.playerId);
          if (owner) toPlayer(owner, 'submission-updated', { submission: { id: sub.id, status: sub.status, reason: '' } });
        }
      }
      logTo(game, 'character', `${character.name} assigned to ${player.name}`);
      touch(game);
      emitTable(game);
      console.log(`[SESSION] Character "${character.name}" assigned to "${player.name}"`);

      toPlayer(player, 'character-assigned', { player: getPlayerData(player) });
      toDM(game, 'players-updated', { players: serializePlayers(game) });
      broadcastPlayerList(game);
    });

    /* ─── DM: Update Player Status ─────────────────── */
    socket.on('update-player', ({ gameCode, playerId, updates = {} } = {}) => {
      const game = dmOf(socket, gameCode);
      if (!game) return;
      const player = game.players.get(playerId);
      if (!player) return;

      if (updates.tracks && typeof updates.tracks === 'object') {
        for (const [k, v] of Object.entries(numberMap(updates.tracks))) {
          const before = player.tracks[k];
          player.tracks[k] = clampTrack(player, k, v);
          if (before !== player.tracks[k]) logTo(game, 'track', `${pcName(player)} ${k.toUpperCase()} ${before ?? 0} → ${player.tracks[k]}`, { playerId: player.id, track: k });
        }
      }
      if (Array.isArray(updates.statusEffects)) {
        const next = updates.statusEffects.map(String);
        for (const e of addedItems(player.statusEffects, next)) logTo(game, 'track', `${pcName(player)} is now ${e}`, { playerId: player.id });
        player.statusEffects = next;
      }
      if (Array.isArray(updates.inventory)) {
        const next = updates.inventory.map(String);
        const added = addedItems(player.inventory, next);
        player.inventory = next;
        // Loot moment: phone toast + a flash on the PC's board token.
        for (const item of added) {
          toPlayer(player, 'item-received', { item, at: Date.now() });
          logTo(game, 'loot', `${pcName(player)} received ${item}`, { playerId: player.id });
        }
        const tok = added.length ? Object.values(boardOf(game).tokens).find((tk) => tk.kind === 'pc' && tk.ownerPlayerId === player.id) : null;
        if (tok) {
          io.to(boardRoom(game.code)).emit('board-flash', { tokenId: tok.id });
          toDM(game, 'board-flash', { tokenId: tok.id });
        }
      }
      if (updates.alive !== undefined) player.alive = !!updates.alive;
      if (updates.conditions && typeof updates.conditions === 'object') {
        player.conditions = { ...player.conditions, ...updates.conditions };
      }
      touch(game);

      toPlayer(player, 'status-updated', { player: getPlayerData(player) });
      toDM(game, 'players-updated', { players: serializePlayers(game) });
    });

    /* ─── DM: Send Secret Message to Player ────────── */
    socket.on('send-message', ({ gameCode, playerId, text, priority } = {}) => {
      const game = dmOf(socket, gameCode);
      if (!game) return;
      const player = game.players.get(playerId);
      if (!player || !text) return;

      const message = {
        id: msgId(), type: 'gm', from: GM, fromId: 'dm',
        to: player.name, toId: player.id, text: String(text),
        priority: priority || 'STANDARD', timestamp: Date.now(), read: false,
      };
      pushMessage(game, message);
      touch(game);
      toPlayer(player, 'secret-message', { message });
      toDM(game, 'message-sent', { message });
    });

    /* ─── Player: Send Message to DM ───────────────── */
    /* { gameCode, text, clientId? } (ack { success, id, duplicate? }) — clientId makes replays from the phone's offline queue idempotent. */
    socket.on('player-message', ({ gameCode, text, clientId } = {}, callback) => {
      const game = games.get(gameCode);
      if (!game || socket.data?.code !== game.code || socket.data.role !== 'player') return callback?.({ error: 'NOT AUTHORIZED.' });
      const player = game.players.get(socket.data.playerId);
      if (!player || !text) return callback?.({ error: 'Empty message.' });
      const t = tableOf(game);
      const cid = typeof clientId === 'string' ? clientId.slice(0, 64) : null;
      if (cid && t.clientIds.includes(cid)) return callback?.({ success: true, duplicate: true });

      const message = {
        id: msgId(), type: 'player', from: player.name, fromId: player.id,
        to: GM, toId: 'dm', text: String(text).slice(0, 4000),
        priority: 'PLAYER', timestamp: Date.now(), read: false, ...(cid ? { clientId: cid } : {}),
      };
      if (cid) rememberClientId(t, cid);
      pushMessage(game, message);
      touch(game);
      toDM(game, 'player-message-received', { message });
      socket.emit('message-confirmed', { message });
      callback?.({ success: true, id: message.id });
    });

    /* ─── Player: Send Message to Another Player ───── */
    socket.on('player-to-player', ({ gameCode: gc, targetId, text, clientId } = {}, callback) => {
      const game = games.get(gc);
      if (!game || socket.data?.code !== game.code || socket.data.role !== 'player') return callback?.({ error: 'NOT AUTHORIZED.' });
      const sender = game.players.get(socket.data.playerId);
      const target = game.players.get(targetId);
      if (!sender || !target || !text) return callback?.({ error: 'Invalid message.' });
      const t = tableOf(game);
      const cid = typeof clientId === 'string' ? clientId.slice(0, 64) : null;
      if (cid && t.clientIds.includes(cid)) return callback?.({ success: true, duplicate: true });
      if (cid) rememberClientId(t, cid);

      const message = {
        id: msgId(), type: 'p2p', from: sender.name, fromId: sender.id,
        to: target.name, toId: target.id, text: String(text).slice(0, 4000),
        priority: 'ENCRYPTED', timestamp: Date.now(), read: false, ...(cid ? { clientId: cid } : {}),
      };
      pushMessage(game, message);
      touch(game);
      toPlayer(target, 'p2p-message', { message });
      socket.emit('p2p-confirmed', { message });
      // DM always sees all player-to-player messages
      toDM(game, 'player-message-received', { message: { ...message, dmNote: `[P2P] ${sender.name} → ${target.name}` } });
      callback?.({ success: true, id: message.id });
    });

    /* ─── DM: Kill Character ───────────────────────── */
    socket.on('kill-character', ({ gameCode, playerId } = {}) => {
      const game = dmOf(socket, gameCode);
      if (!game) return;
      const player = game.players.get(playerId);
      if (!player) return;

      player.alive = false;
      if ('health' in player.tracks) player.tracks.health = 0;
      logTo(game, 'kill', `${pcName(player)} (${player.name}) was killed`, { playerId: player.id });
      touch(game);

      toPlayer(player, 'character-died', { playerName: player.name, characterName: player.character?.name });
      toDM(game, 'players-updated', { players: serializePlayers(game) });
    });

    /* ─── DM: Get Assigned Character IDs ───────────── */
    socket.on('get-assigned-characters', ({ gameCode } = {}, callback) => {
      const game = games.get(gameCode);
      callback?.({ ids: game ? Array.from(game.assignedCharacterIds) : [] });
    });

    /* ─── DM: Broadcast to All Players ─────────────── */
    socket.on('broadcast-message', ({ gameCode, text, priority } = {}) => {
      const game = dmOf(socket, gameCode);
      if (!game || !text) return;

      const message = {
        id: msgId(), type: 'gm', from: GM, fromId: 'dm',
        to: 'ALL', toId: 'broadcast', text: String(text),
        priority: priority || 'BROADCAST', timestamp: Date.now(), read: false,
      };
      pushMessage(game, message);
      touch(game);
      for (const [, p] of game.players) toPlayer(p, 'secret-message', { message });
      toDM(game, 'message-sent', { message });
    });

    /* ═══ TABLE BOARD (docs/BOARD_AND_BUILDER.md §2) ═══════════════════
       Board client: join-board { code } (no token; never receives sheets/messages).
       DM events take { gameCode?, ... } (defaults to the DM socket's game).
       Server -> clients: board-state { board, mapDef? } (filtered per role),
       board-ping { x, y, at, by, color }, board-linked { count } (DM only). */

    /* ─── Board: Join { code } → { success, code, universeId, packId, board, mapDef } ─── */
    socket.on('join-board', ({ code } = {}, callback) => {
      const game = games.get(String(code || '').toUpperCase());
      if (!game) return callback?.({ error: 'GAME NOT FOUND.' });
      socket.join(boardRoom(game.code));
      socket.data = { code: game.code, role: 'board' };
      console.log(`[BOARD] Board client attached to game ${game.code}`);
      callback?.({ success: true, code: game.code, universeId: game.universeId, packId: game.packId, ...boardPayload(game, 'board', true), table: tableView(game, 'board') });
      notifyBoardLinked(game);
    });

    /* ─── Anyone attached: re-request board state → { board, mapDef, boardClients? } ─── */
    socket.on('board-sync', (_payload, callback) => {
      const cb = typeof _payload === 'function' ? _payload : callback;
      const { code, role } = socket.data || {};
      const game = code ? games.get(code) : null;
      if (!game || !role) return cb?.({ error: 'NOT IN A GAME.' });
      if (role === 'dm' && game.dmId !== socket.id) return cb?.({ error: 'NOT AUTHORIZED.' });
      const payload = boardPayload(game, role === 'dm' ? 'dm' : 'board', true);
      if (role === 'dm') payload.boardClients = boardCount(game.code);
      cb?.(payload);
    });

    /* ─── DM: Set map { mapId, level?, mapDef } — same mapId keeps tokens (level switch / room edit) ─── */
    socket.on('board-set-map', (payload = {}, callback) => {
      const game = dmBoardGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      if (!isMapId(payload.mapId)) return callback?.({ error: 'Invalid mapId.' });
      const { mapDef, error } = sanitizeMapDef(payload.mapDef);
      if (error) return callback?.({ error });
      const b = boardOf(game);
      const levels = (mapDef.levels || []).map((l) => l.id);
      const level = isLevelId(payload.level) && levels.includes(payload.level) ? payload.level : (levels[0] || null);
      if (b.mapId !== payload.mapId) {
        // New map: keep PC tokens (moved to the spawn point), drop everything else.
        const pcs = Object.values(b.tokens).filter((t) => t.kind === 'pc');
        b.tokens = {};
        b.rooms = {};
        b.pings = [];
        const [sx, sy] = spawnPoint(mapDef, level);
        pcs.forEach((t, i) => {
          const off = (i - (pcs.length - 1) / 2) * 0.02;
          b.tokens[t.id] = { ...t, x: Math.min(1, Math.max(0, sx + off)), y: sy, level, roomId: null };
        });
      }
      b.mapId = payload.mapId;
      b.level = level;
      b.mapRev = (b.mapRev || 0) + 1;
      game.mapDef = mapDef;
      relocateAll(b, mapDef);
      touch(game);
      console.log(`[BOARD] ${game.code}: map ${b.mapId}${level ? ' @ ' + level : ''} (${mapDef.rooms.length} rooms)`);
      emitBoard(game, { withMap: true });
      callback?.({ success: true, mapRev: b.mapRev });
    });

    /* ─── DM: Create / update token { token } → { success, token } ─── */
    socket.on('board-token-upsert', (payload = {}, callback) => {
      const game = dmBoardGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const b = boardOf(game);
      const input = payload.token;
      const prev = input?.id && isTokenId(input.id) ? b.tokens[input.id] : null;
      if (!prev && Object.keys(b.tokens).length >= MAX_TOKENS) return callback?.({ error: 'TOO MANY TOKENS.' });
      const token = sanitizeToken(input, prev, tokenCtx(game));
      if (!token) return callback?.({ error: 'Invalid token.' });
      if (token.kind === 'pc' && token.ownerPlayerId && !token.color) token.color = playerColor(game, token.ownerPlayerId);
      b.tokens[token.id] = token;
      placeToken(b, game.mapDef, token);
      touch(game);
      emitBoard(game);
      callback?.({ success: true, token });
    });

    /* ─── DM: Move token { id, x, y } (client throttles to 30 Hz) ─── */
    socket.on('board-token-move', (payload = {}) => {
      const game = dmBoardGame(socket, payload);
      if (!game) return;
      const b = boardOf(game);
      const t = isTokenId(payload.id) ? b.tokens[payload.id] : null;
      if (!t || !Number.isFinite(payload.x) || !Number.isFinite(payload.y)) return;
      t.x = Math.min(1, Math.max(0, payload.x));
      t.y = Math.min(1, Math.max(0, payload.y));
      placeToken(b, game.mapDef, t);
      touch(game);
      emitBoard(game);
    });

    /* ─── DM: Remove token { id } ─── */
    socket.on('board-token-remove', (payload = {}, callback) => {
      const game = dmBoardGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const b = boardOf(game);
      if (!isTokenId(payload.id) || !b.tokens[payload.id]) return callback?.({ error: 'Unknown token.' });
      delete b.tokens[payload.id];
      touch(game);
      emitBoard(game);
      callback?.({ success: true });
    });

    /* ─── DM: Room { roomId, revealed?, name?, note?, hideTokens? } ─── */
    socket.on('board-room-set', (payload = {}, callback) => {
      const game = dmBoardGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const b = boardOf(game);
      const room = (game.mapDef?.rooms || []).find((r) => r.id === payload.roomId);
      if (!room) return callback?.({ error: 'Unknown room.' });
      const st = b.rooms[room.id] || (b.rooms[room.id] = { revealed: false, entered: false });
      if (payload.revealed !== undefined) {
        if (!st.revealed && payload.revealed) logTo(game, 'fog', `Revealed: ${st.name || room.name || room.id}`, { roomId: room.id });
        st.revealed = !!payload.revealed;
      }
      if (typeof payload.name === 'string') st.name = payload.name.slice(0, 80);
      if (typeof payload.note === 'string') st.note = payload.note.slice(0, 1000);
      if (payload.hideTokens === true) {
        for (const t of Object.values(b.tokens)) if (t.roomId === room.id && t.kind !== 'pc') t.hidden = true;
      }
      touch(game);
      emitBoard(game);
      callback?.({ success: true });
    });

    /* ─── DM: Fog { fog } ─── */
    socket.on('board-fog', (payload = {}) => {
      const game = dmBoardGame(socket, payload);
      if (!game) return;
      boardOf(game).fog = !!payload.fog;
      touch(game);
      emitBoard(game);
    });

    /* ─── DM: TV orientation { view: { rotation, flipX, zoom, pan } } ─── */
    socket.on('board-view', (payload = {}) => {
      const game = dmBoardGame(socket, payload);
      if (!game) return;
      const b = boardOf(game);
      b.view = sanitizeView(payload.view, b.view);
      touch(game);
      emitBoard(game);
    });

    /* ─── DM / players: Ping { x, y } (max 1 per second per socket) ─── */
    socket.on('board-ping', (payload = {}, callback) => {
      const { code, role, playerId } = socket.data || {};
      const game = code ? games.get(code) : null;
      if (!game || (role !== 'dm' && role !== 'player')) return callback?.({ error: 'NOT AUTHORIZED.' });
      if (role === 'dm' && game.dmId !== socket.id) return callback?.({ error: 'NOT AUTHORIZED.' });
      if (!Number.isFinite(payload.x) || !Number.isFinite(payload.y)) return callback?.({ error: 'Invalid point.' });
      const now = Date.now();
      if (now - (lastPing.get(socket.id) || 0) < PING_INTERVAL_MS) return callback?.({ error: 'RATE LIMITED.' });
      lastPing.set(socket.id, now);
      const b = boardOf(game);
      const ping = {
        x: Math.min(1, Math.max(0, payload.x)), y: Math.min(1, Math.max(0, payload.y)), at: now,
        by: role === 'dm' ? 'dm' : playerId,
        color: role === 'dm' ? '#ffffff' : playerColor(game, playerId),
      };
      b.pings = [...(b.pings || []), ping].slice(-MAX_PINGS);
      if (game.dmId) io.to(game.dmId).emit('board-ping', ping);
      io.to(boardRoom(game.code)).emit('board-ping', ping);
      for (const [, p] of game.players) toPlayer(p, 'board-ping', ping);
      callback?.({ success: true });
    });

    /* ─── DM: Reset {} — clears tokens, room reveals and pings; fog back on (map + view kept) ─── */
    socket.on('board-reset', (payload = {}, callback) => {
      const game = dmBoardGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const b = boardOf(game);
      b.tokens = {};
      b.rooms = {};
      b.pings = [];
      b.fog = true;
      touch(game);
      emitBoard(game);
      callback?.({ success: true });
    });

    /* ═══ SESSION FEATURES (ARCHITECTURE.md "Sessions" → session features) ═══
       DM events take { gameCode?, ... } (defaults to the DM socket's game) and ack
       { success } | { error }. Every mutation re-sends `table-state { table }`
       (role-filtered) to the DM, the board and each player. */
    const dmTableGame = dmBoardGame;
    /** Player socket's own game + player record (or {}). */
    const playerCtx = () => {
      const { code, role, playerId } = socket.data || {};
      const game = code && role === 'player' ? games.get(code) : null;
      const player = game?.players.get(playerId);
      return game && player && player.socketId === socket.id ? { game, player } : {};
    };
    const done = (game, cb, extra = {}) => { touch(game); emitTable(game); cb?.({ success: true, ...extra }); };

    /* ─── Any attached role: { table, log? } (log for the DM only) ─── */
    socket.on('table-sync', (_p, callback) => {
      const cb = typeof _p === 'function' ? _p : callback;
      const { code, role } = socket.data || {};
      const game = code ? games.get(code) : null;
      if (!game || !role) return cb?.({ error: 'NOT IN A GAME.' });
      if (role === 'dm') {
        if (game.dmId !== socket.id) return cb?.({ error: 'NOT AUTHORIZED.' });
        return cb?.({ table: tableView(game, 'dm'), log: logOf(game) });
      }
      if (role === 'board') return cb?.({ table: tableView(game, 'board') });
      const player = game.players.get(socket.data.playerId);
      return cb?.({ table: tableView(game, 'player', player) });
    });

    /* ─── DM: Seed pack clocks/clues { clocks[], clues[] } — idempotent by id ─── */
    socket.on('session-seed', (payload = {}, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      let added = 0;
      for (const c of Array.isArray(payload.clocks) ? payload.clocks.slice(0, MAX_CLOCKS) : []) {
        if (!c?.id || t.clocks.some((x) => x.id === c.id) || t.clocks.length >= MAX_CLOCKS) continue;
        const clock = sanitizeClock(c);
        if (clock) { t.clocks.push(clock); added++; }
      }
      for (const c of Array.isArray(payload.clues) ? payload.clues.slice(0, MAX_CLUES) : []) {
        if (!c?.id || t.clues.some((x) => x.id === c.id) || t.clues.length >= MAX_CLUES) continue;
        const clue = sanitizeClue({ ...c, adhoc: false });
        if (!clue) continue;
        if (c.status === 'revealed') Object.assign(clue, { status: 'revealed', revealedTo: 'all', revealedAt: Date.now() });
        t.clues.push(clue);
        added++;
      }
      t.seeded = true;
      done(game, callback, { added });
    });

    /* ─── DM: Scene progress { actIndex, sceneIndex, completed?, actTitle?, sceneTitle? } ─── */
    socket.on('run-set', (payload = {}, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      const prev = { ...t.run };
      const a = Number(payload.actIndex);
      const s = Number(payload.sceneIndex);
      if (Number.isInteger(a) && a >= 0 && a < 100) t.run.actIndex = a;
      if (Number.isInteger(s) && s >= 0 && s < 500) t.run.sceneIndex = s;
      if (typeof payload.actTitle === 'string') t.run.actTitle = payload.actTitle.slice(0, 120);
      if (typeof payload.sceneTitle === 'string') t.run.sceneTitle = payload.sceneTitle.slice(0, 120);
      if (payload.completed && typeof payload.completed === 'object') {
        const c = {};
        for (const [k, v] of Object.entries(payload.completed).slice(0, 1000)) if (/^\d+-\d+$/.test(k) && v) c[k] = true;
        for (const k of Object.keys(c)) if (!prev.completed[k]) logTo(game, 'scene', `Scene completed: ${t.run.sceneTitle && k === `${t.run.actIndex}-${t.run.sceneIndex}` ? t.run.sceneTitle : k}`, { key: k });
        t.run.completed = c;
      }
      if (prev.actIndex !== t.run.actIndex || prev.sceneIndex !== t.run.sceneIndex) {
        logTo(game, 'scene', `Scene: ${t.run.actTitle ? t.run.actTitle + ' — ' : ''}${t.run.sceneTitle || `#${t.run.sceneIndex + 1}`}`);
      }
      done(game, callback, { run: t.run });
    });

    /* ─── DM: Advance act { actIndex, actTitle?, agendas?: { playerId: text } } ───
       Pushes each assigned player's character.agendaByAct[actIndex+1] (or the override)
       as a private NEW ORDERS card (`new-orders`); stored in table.orders for re-opening. */
    socket.on('advance-act', (payload = {}, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      const a = Number(payload.actIndex);
      if (!Number.isInteger(a) || a < 0 || a >= 100) return callback?.({ error: 'Invalid actIndex.' });
      const actTitle = sstr(payload.actTitle, 120) || `ACT ${a + 1}`;
      t.run.actIndex = a;
      t.run.sceneIndex = 0;
      t.run.actTitle = actTitle;
      t.run.sceneTitle = sstr(payload.sceneTitle, 120);
      const overrides = payload.agendas && typeof payload.agendas === 'object' ? payload.agendas : {};
      const sent = [];
      const at = Date.now();
      for (const [, p] of game.players) {
        const text = sstr(overrides[p.id], 2000) || sstr(p.character?.agendaByAct?.[String(a + 1)], 2000);
        if (!text || !p.character) continue;
        const order = { actIndex: a, actTitle, text, at };
        t.orders[p.id] = [...(t.orders[p.id] || []).filter((o) => o.actIndex !== a), order];
        toPlayer(p, 'new-orders', order);
        sent.push(p.id);
      }
      logTo(game, 'act', `${actTitle} begins${sent.length ? ` — new orders to ${sent.length}` : ''}`, { actIndex: a });
      done(game, callback, { sent });
    });

    /* ─── DM: Narrate { text, title?, mode:'caption'|'card', art? } ─── */
    socket.on('narrate', (payload = {}, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const text = sstr(payload.text, 4000).trim();
      const art = urlish(payload.art);
      if (!text && !art) return callback?.({ error: 'Nothing to narrate.' });
      const t = tableOf(game);
      t.narration = {
        id: shortId('n'), text, title: sstr(payload.title, 160), at: Date.now(),
        mode: NARRATE_MODES.includes(payload.mode) ? payload.mode : 'caption', art,
      };
      logTo(game, 'narration', `${t.narration.title ? t.narration.title + ': ' : ''}${text || '[image]'}`.slice(0, 400));
      done(game, callback, { id: t.narration.id });
    });

    /* ─── DM: Clear narration {} ─── */
    socket.on('narrate-clear', (payload = {}, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      tableOf(game).narration = null;
      done(game, callback);
    });

    /* ─── DM: Board mode { mode:'map'|'theatre', title?, subtitle?, art? } (persists) ─── */
    socket.on('board-mode', (payload = {}, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      if (payload.mode === 'map' || payload.mode === 'theatre') t.boardMode = payload.mode;
      if (payload.title !== undefined || payload.subtitle !== undefined || payload.art !== undefined) {
        t.theatre = {
          title: payload.title !== undefined ? sstr(payload.title, 160) : t.theatre.title,
          subtitle: payload.subtitle !== undefined ? sstr(payload.subtitle, 160) : t.theatre.subtitle,
          art: payload.art !== undefined ? urlish(payload.art) : t.theatre.art,
        };
      }
      done(game, callback, { boardMode: t.boardMode });
    });

    /* ─── DM: Send handout { handoutId?, handout?|custom?: {title,from,to,priority,text,image?}, to:'all'|[playerIds] } ───
       Bundled packs live client-side, so the DM sends the resolved handout with its pack id.
       Re-sending the same id widens the recipients and keeps receipts. */
    socket.on('handout-send', (payload = {}, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      const content = sanitizeHandout(payload.handout || payload.custom);
      const id = typeof payload.handoutId === 'string' && ITEM_RE.test(payload.handoutId) ? payload.handoutId : null;
      const prev = id ? t.handouts.find((h) => h.id === id) : null;
      if (!content && !prev) return callback?.({ error: 'Handout needs a title and text.' });
      const recipients = recipientsOf(game, payload.to);
      if (!recipients) return callback?.({ error: 'No recipients.' });
      let h;
      if (prev) {
        Object.assign(prev, content || {}, { recipients: mergeRecipients(prev.recipients, recipients), sentAt: Date.now() });
        h = prev;
      } else {
        if (t.handouts.length >= MAX_HANDOUTS) t.handouts.shift();
        h = { id: id || shortId('h'), ...content, recipients, sentAt: Date.now(), seenBy: [], custom: !id };
        t.handouts.push(h);
      }
      const { recipients: _r, seenBy: _s, ...pub } = h; // eslint-disable-line no-unused-vars
      for (const [, p] of game.players) if (sentTo(recipients, p.id)) toPlayer(p, 'handout-received', { handout: { ...pub, seen: h.seenBy.includes(p.id) } });
      logTo(game, 'handout', `Handout "${h.title}" → ${recipients === 'all' ? 'everyone' : recipients.map((x) => pcName(game.players.get(x))).join(', ')}`, { handoutId: h.id });
      done(game, callback, { id: h.id });
    });

    /* ─── Player: Handout opened { handoutId } → DM sees receipts ─── */
    socket.on('handout-seen', (payload = {}, callback) => {
      const { game, player } = playerCtx();
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const h = tableOf(game).handouts.find((x) => x.id === payload.handoutId);
      if (!h || !sentTo(h.recipients, player.id)) return callback?.({ error: 'Unknown handout.' });
      if (!h.seenBy.includes(player.id)) {
        h.seenBy.push(player.id);
        touch(game);
        toDM(game, 'handout-seen', { handoutId: h.id, playerId: player.id, seen: h.seenBy.length, of: recipientCount(game, h.recipients) });
        emitTable(game, { dmOnly: true });
      }
      callback?.({ success: true });
    });

    /* ─── DM: Create/update a clue { clue: { id?, text, source?, scene? } } (ad-hoc when no pack id) ─── */
    socket.on('clue-upsert', (payload = {}, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      const prev = t.clues.find((c) => c.id === payload.clue?.id);
      if (!prev && t.clues.length >= MAX_CLUES) return callback?.({ error: 'TOO MANY CLUES.' });
      const clue = sanitizeClue({ adhoc: !payload.clue?.id, ...payload.clue }, prev);
      if (!clue) return callback?.({ error: 'Clue needs text.' });
      if (prev) Object.assign(prev, clue); else t.clues.push(clue);
      done(game, callback, { id: clue.id });
    });

    /* ─── DM: Reveal a clue { clueId, clue?, to:'all'|[playerIds], foundBy?:[playerIds] } ─── */
    socket.on('clue-reveal', (payload = {}, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      let clue = t.clues.find((c) => c.id === payload.clueId);
      if (!clue && payload.clue) {
        clue = sanitizeClue({ ...payload.clue, id: payload.clueId || payload.clue.id });
        if (!clue) return callback?.({ error: 'Clue needs text.' });
        if (t.clues.length >= MAX_CLUES) return callback?.({ error: 'TOO MANY CLUES.' });
        t.clues.push(clue);
      }
      if (!clue) return callback?.({ error: 'Unknown clue.' });
      const recipients = recipientsOf(game, payload.to);
      if (!recipients) return callback?.({ error: 'No recipients.' });
      const finders = recipientsOf(game, payload.foundBy);
      const credit = Array.isArray(finders) ? finders : (Array.isArray(recipients) ? recipients : []);
      clue.status = 'revealed';
      clue.revealedTo = mergeRecipients(clue.revealedTo === null ? [] : clue.revealedTo, recipients);
      clue.foundBy = Array.from(new Set([...clue.foundBy, ...credit]));
      clue.revealedAt = clue.revealedAt || Date.now();
      const nameOf = (id) => pcName(game.players.get(id));
      for (const [, p] of game.players) {
        if (sentTo(recipients, p.id)) toPlayer(p, 'clue-revealed', { clue: { id: clue.id, text: clue.text, source: clue.source, revealedAt: clue.revealedAt, foundBy: clue.foundBy.map(nameOf) } });
      }
      logTo(game, 'clue', `Clue revealed: ${clue.text.slice(0, 160)}${credit.length ? ` (found by ${credit.map(nameOf).join(', ')})` : ''} → ${recipients === 'all' ? 'everyone' : recipients.map(nameOf).join(', ')}`, { clueId: clue.id });
      done(game, callback, { id: clue.id });
    });

    /* ─── DM: Hide a clue again { clueId } (players lose it from their list) ─── */
    socket.on('clue-hide', (payload = {}, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const clue = tableOf(game).clues.find((c) => c.id === payload.clueId);
      if (!clue) return callback?.({ error: 'Unknown clue.' });
      Object.assign(clue, { status: 'hidden', revealedTo: null, foundBy: [], revealedAt: null });
      done(game, callback);
    });

    /* ─── DM: Create/update a clock { clock: { id?, label, segments, filled?, kind, visibility } } ─── */
    socket.on('clock-upsert', (payload = {}, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      const prev = t.clocks.find((c) => c.id === payload.clock?.id);
      if (!prev && t.clocks.length >= MAX_CLOCKS) return callback?.({ error: 'TOO MANY CLOCKS.' });
      const clock = sanitizeClock(payload.clock, prev);
      if (!clock) return callback?.({ error: 'Clock needs a label.' });
      if (prev) Object.assign(prev, clock); else { t.clocks.push(clock); logTo(game, 'clock', `Clock started: ${clock.label} (${clock.segments})`, { clockId: clock.id }); }
      done(game, callback, { id: clock.id, clock });
    });

    /* ─── DM: Tick a clock { id, delta: ±n } → `clock-ticked { clock, delta }` to everyone who can see it ─── */
    socket.on('clock-tick', (payload = {}, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const clock = tableOf(game).clocks.find((c) => c.id === payload.id);
      const delta = Math.round(Number(payload.delta) || 0);
      if (!clock) return callback?.({ error: 'Unknown clock.' });
      const before = clock.filled;
      clock.filled = Math.max(0, Math.min(clock.segments, clock.filled + delta));
      const applied = clock.filled - before;
      if (applied) {
        const full = clock.filled === clock.segments;
        logTo(game, 'clock', `${clock.label}: ${before} → ${clock.filled}/${clock.segments}${full ? ' — FULL' : ''}`, { clockId: clock.id });
        if (clock.visibility !== 'gm') {
          const evt = { clock, delta: applied };
          for (const [, p] of game.players) toPlayer(p, 'clock-ticked', evt);
          io.to(boardRoom(game.code)).emit('clock-ticked', evt);
        }
      }
      done(game, callback, { clock });
    });

    /* ─── DM: Remove a clock { id } ─── */
    socket.on('clock-remove', (payload = {}, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      const before = t.clocks.length;
      t.clocks = t.clocks.filter((c) => c.id !== payload.id);
      if (t.clocks.length === before) return callback?.({ error: 'Unknown clock.' });
      done(game, callback);
    });

    /* ─── DM: Session zero { enabled, tone[], warnings[], linesVeils } (re-arms the player card when changed) ─── */
    socket.on('safety-set', (payload = {}, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      const list = (v, n, m) => (Array.isArray(v) ? v : []).map((x) => sstr(String(x ?? ''), m).trim()).filter(Boolean).slice(0, n);
      const next = {
        enabled: payload.enabled !== false,
        tone: list(payload.tone, 12, 60),
        warnings: list(payload.warnings, 40, 120),
        linesVeils: sstr(payload.linesVeils, 3000),
      };
      const changed = JSON.stringify(next) !== JSON.stringify({ enabled: t.safety.enabled, tone: t.safety.tone, warnings: t.safety.warnings, linesVeils: t.safety.linesVeils });
      t.safety = { ...next, confirmed: changed ? [] : t.safety.confirmed };
      if (changed && next.enabled) logTo(game, 'safety', `Session zero: ${next.warnings.length} content warning(s)${next.linesVeils ? ', lines & veils set' : ''}`);
      done(game, callback);
    });

    /* ─── Player: Confirm the BEFORE WE BEGIN card {} ─── */
    socket.on('safety-confirm', (_p, callback) => {
      const cb = typeof _p === 'function' ? _p : callback;
      const { game, player } = playerCtx();
      if (!game) return cb?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      if (!t.safety.confirmed.includes(player.id)) t.safety.confirmed.push(player.id);
      touch(game);
      emitTable(game, { only: player });
      emitTable(game, { dmOnly: true });
      cb?.({ success: true });
    });

    /* ─── Player: Anonymous PAUSE / X-card {} → DM `pause-requested { at }` (no identity anywhere) ─── */
    socket.on('pause-request', (_p, callback) => {
      const cb = typeof _p === 'function' ? _p : callback;
      const { game } = playerCtx();
      if (!game) return cb?.({ error: 'NOT AUTHORIZED.' });
      const now = Date.now();
      if (now - (lastPause.get(socket.id) || 0) < PAUSE_INTERVAL_MS) return cb?.({ success: true, throttled: true });
      lastPause.set(socket.id, now);
      const t = tableOf(game);
      const already = !!t.pause;
      t.pause = { at: t.pause?.at || now };
      if (!already) logTo(game, 'pause', 'Pause requested (anonymous)');
      toDM(game, 'pause-requested', { at: t.pause.at });
      done(game, cb);
    });

    /* ─── DM: Clear the pause {} ─── */
    socket.on('pause-clear', (payload = {}, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      if (t.pause) logTo(game, 'pause', 'Play resumed');
      t.pause = null;
      done(game, callback);
    });

    /* ─── DM: Log note { text } → `log-entry { entry }` ─── */
    socket.on('log-note', (payload = {}, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const e = logTo(game, 'note', sstr(payload.text, 2000));
      if (!e) return callback?.({ error: 'Empty note.' });
      touch(game);
      callback?.({ success: true, entry: e });
    });

    /* ─── Player: Submit a player-built character { character } (from an unassigned seat) ─── */
    socket.on('character-submit', (payload = {}, callback) => {
      const { game, player } = playerCtx();
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const ch = payload.character;
      if (!ch || typeof ch !== 'object' || Array.isArray(ch) || typeof ch.name !== 'string' || !ch.name.trim()) return callback?.({ error: 'Character needs a name.' });
      let bytes = 0;
      try { bytes = JSON.stringify(ch).length; } catch { return callback?.({ error: 'Character not serializable.' }); }
      if (bytes > MAX_CHARACTER_BYTES) return callback?.({ error: 'Character too large.' });
      const t = tableOf(game);
      const character = { ...ch, id: typeof ch.id === 'string' && ID_RE.test(ch.id) ? ch.id : `pb-${randomBytes(4).toString('hex')}` };
      // One pending submission per player: a new one replaces the old.
      t.submissions = t.submissions.filter((s) => !(s.playerId === player.id && s.status === 'pending'));
      const sub = { id: shortId('sub'), playerId: player.id, playerName: player.name, character, at: Date.now(), status: 'pending', reason: '' };
      t.submissions.push(sub);
      if (t.submissions.length > MAX_SUBMISSIONS) t.submissions.splice(0, t.submissions.length - MAX_SUBMISSIONS);
      logTo(game, 'character', `${player.name} submitted a character: ${character.name}${character.career ? ` (${character.career})` : ''}`);
      toDM(game, 'character-submitted', { submission: sub });
      emitTable(game, { only: player });
      emitTable(game, { dmOnly: true });
      touch(game);
      callback?.({ success: true, id: sub.id });
    });

    /* ─── DM: Resolve a submission { id, action:'reject'|'assigned', reason? } ─── */
    socket.on('submission-resolve', (payload = {}, callback) => {
      const game = dmTableGame(socket, payload);
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const sub = tableOf(game).submissions.find((s) => s.id === payload.id);
      if (!sub) return callback?.({ error: 'Unknown submission.' });
      sub.status = payload.action === 'reject' ? 'rejected' : 'assigned';
      sub.reason = sstr(payload.reason, 300);
      const p = game.players.get(sub.playerId);
      if (p) toPlayer(p, 'submission-updated', { submission: { id: sub.id, status: sub.status, reason: sub.reason } });
      done(game, callback);
    });

    /* ─── Player: Roll result { clientId, roll } (queued on the phone until acked; deduped) → DM `roll { roll }` ─── */
    socket.on('player-roll', (payload = {}, callback) => {
      const { game, player } = playerCtx();
      if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
      const t = tableOf(game);
      const clientId = typeof payload.clientId === 'string' ? payload.clientId.slice(0, 64) : null;
      if (clientId && t.clientIds.includes(clientId)) return callback?.({ success: true, duplicate: true });
      let roll = payload.roll;
      try { if (!roll || typeof roll !== 'object' || JSON.stringify(roll).length > MAX_ROLL_BYTES) return callback?.({ error: 'Invalid roll.' }); } catch { return callback?.({ error: 'Invalid roll.' }); }
      roll = JSON.parse(JSON.stringify(roll));
      const entry = { id: shortId('r'), clientId, playerId: player.id, playerName: player.name, characterName: player.character?.name || '', roll, at: Number(payload.at) || Date.now() };
      t.rolls.push(entry);
      if (t.rolls.length > MAX_ROLLS) t.rolls.splice(0, t.rolls.length - MAX_ROLLS);
      if (clientId) rememberClientId(t, clientId);
      const summary = sstr(roll.summary || roll.label || '', 200);
      logTo(game, 'roll', `${pcName(player)} rolled${summary ? `: ${summary}` : ''}`);
      toDM(game, 'roll', { roll: entry });
      emitTable(game, { dmOnly: true });
      touch(game);
      callback?.({ success: true, id: entry.id });
    });

    /* ─── Disconnect: never deletes anything — games/players go dormant ─── */
    socket.on('disconnect', () => {
      lastPing.delete(socket.id);
      lastPause.delete(socket.id);
      const { code, role, playerId } = socket.data || {};
      const game = code ? games.get(code) : null;
      if (!game) return;

      if (role === 'board') {
        console.log(`[BOARD] Board client left game ${game.code}`);
        notifyBoardLinked(game);
        return;
      }

      if (role === 'player') {
        const player = game.players.get(playerId);
        if (!player || player.socketId !== socket.id) return; // already re-attached elsewhere
        player.connected = false;
        player.socketId = null;
        touch(game);
        console.log(`[SESSION] Player "${player.name}" went dormant in game ${game.code}`);
        toDM(game, 'player-left', { playerId: player.id, playerName: player.name, dormant: true, players: serializePlayers(game) });
        broadcastPlayerList(game);
      } else if (role === 'dm') {
        if (game.dmId !== socket.id) return;
        game.dmId = null;
        game.status = 'dormant';
        touch(game);
        console.log(`[SESSION] DM left game ${game.code} — game is dormant`);
        for (const [, p] of game.players) toPlayer(p, 'dm-disconnected', { code: game.code });
      }
    });
  });
}

export default attachSessions;
