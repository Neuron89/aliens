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
        dmConnected: !!game.dmId,
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
      touch(game);
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
        for (const [k, v] of Object.entries(numberMap(updates.tracks))) player.tracks[k] = clampTrack(player, k, v);
      }
      if (Array.isArray(updates.statusEffects)) player.statusEffects = updates.statusEffects.map(String);
      if (Array.isArray(updates.inventory)) player.inventory = updates.inventory.map(String);
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
    socket.on('player-message', ({ gameCode, text } = {}) => {
      const game = games.get(gameCode);
      if (!game || socket.data?.code !== game.code || socket.data.role !== 'player') return;
      const player = game.players.get(socket.data.playerId);
      if (!player || !text) return;

      const message = {
        id: msgId(), type: 'player', from: player.name, fromId: player.id,
        to: GM, toId: 'dm', text: String(text),
        priority: 'PLAYER', timestamp: Date.now(), read: false,
      };
      pushMessage(game, message);
      touch(game);
      toDM(game, 'player-message-received', { message });
      socket.emit('message-confirmed', { message });
    });

    /* ─── Player: Send Message to Another Player ───── */
    socket.on('player-to-player', ({ gameCode: gc, targetId, text } = {}) => {
      const game = games.get(gc);
      if (!game || socket.data?.code !== game.code || socket.data.role !== 'player') return;
      const sender = game.players.get(socket.data.playerId);
      const target = game.players.get(targetId);
      if (!sender || !target || !text) return;

      const message = {
        id: msgId(), type: 'p2p', from: sender.name, fromId: sender.id,
        to: target.name, toId: target.id, text: String(text),
        priority: 'ENCRYPTED', timestamp: Date.now(), read: false,
      };
      pushMessage(game, message);
      touch(game);
      toPlayer(target, 'p2p-message', { message });
      socket.emit('p2p-confirmed', { message });
      // DM always sees all player-to-player messages
      toDM(game, 'player-message-received', { message: { ...message, dmNote: `[P2P] ${sender.name} → ${target.name}` } });
    });

    /* ─── DM: Kill Character ───────────────────────── */
    socket.on('kill-character', ({ gameCode, playerId } = {}) => {
      const game = dmOf(socket, gameCode);
      if (!game) return;
      const player = game.players.get(playerId);
      if (!player) return;

      player.alive = false;
      if ('health' in player.tracks) player.tracks.health = 0;
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
      callback?.({ success: true, code: game.code, universeId: game.universeId, packId: game.packId, ...boardPayload(game, 'board', true) });
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
      if (payload.revealed !== undefined) st.revealed = !!payload.revealed;
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

    /* ─── Disconnect: never deletes anything — games/players go dormant ─── */
    socket.on('disconnect', () => {
      lastPing.delete(socket.id);
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
