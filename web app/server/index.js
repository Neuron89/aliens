import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

/* ═══════════════════════════════════════════════════════════════
   GAME STATE — In-memory store for active game sessions
   ═══════════════════════════════════════════════════════════════ */

const games = new Map();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (games.has(code));
  return code;
}

function createGame(dmSocketId) {
  const code = generateCode();
  const game = {
    code,
    dmId: dmSocketId,
    createdAt: Date.now(),
    players: new Map(),
    messages: [],
    assignedCharacterIds: new Set(),
  };
  games.set(code, game);
  return game;
}

function findGameBySocket(socketId) {
  for (const [, game] of games) {
    if (game.dmId === socketId) return { game, role: 'dm' };
    if (game.players.has(socketId)) return { game, role: 'player' };
  }
  return null;
}

function serializePlayers(game) {
  const result = {};
  for (const [id, p] of game.players) {
    result[id] = { ...p };
  }
  return result;
}

function getPlayerData(player) {
  return {
    id: player.id,
    name: player.name,
    character: player.character,
    health: player.health,
    maxHealth: player.maxHealth,
    stress: player.stress,
    statusEffects: player.statusEffects,
    inventory: player.inventory,
    alive: player.alive,
    conditions: player.conditions,
  };
}


/* ═══════════════════════════════════════════════════════════════
   SOCKET.IO EVENT HANDLERS
   ═══════════════════════════════════════════════════════════════ */

function broadcastPlayerList(game) {
  const playerList = [];
  for (const [id, p] of game.players) {
    playerList.push({ id, name: p.name, characterName: p.character?.name || null });
  }
  for (const [pid] of game.players) {
    io.to(pid).emit('player-list', { players: playerList });
  }
}

io.on('connection', (socket) => {
  console.log(`[MUTHUR] Connection: ${socket.id}`);

  /* ─── DM: Create Game ──────────────────────────── */
  socket.on('create-game', (callback) => {
    const game = createGame(socket.id);
    socket.join(game.code);
    console.log(`[MUTHUR] Game created: ${game.code} by DM ${socket.id}`);
    callback({ code: game.code });
  });

  /* ─── Player: Join Game ────────────────────────── */
  socket.on('join-game', ({ code, playerName }, callback) => {
    const game = games.get(code?.toUpperCase());
    if (!game) return callback({ error: 'GAME NOT FOUND. CHECK YOUR ACCESS CODE.' });
    if (game.players.has(socket.id)) return callback({ error: 'ALREADY CONNECTED.' });

    const player = {
      id: socket.id,
      name: playerName,
      character: null,
      health: 0,
      maxHealth: 0,
      stress: 0,
      statusEffects: [],
      inventory: [],
      alive: true,
      conditions: { starving: false, dehydrated: false, exhausted: false, freezing: false },
    };

    game.players.set(socket.id, player);
    socket.join(game.code);

    console.log(`[MUTHUR] Player "${playerName}" joined game ${game.code}`);
    callback({ success: true, playerId: socket.id });

    // Notify DM
    io.to(game.dmId).emit('player-joined', {
      player: getPlayerData(player),
      players: serializePlayers(game),
    });

    // Broadcast player list to all players in the game
    broadcastPlayerList(game);
  });

  /* ─── DM: Assign Character to Player ───────────── */
  socket.on('assign-character', ({ gameCode, playerId, character }) => {
    const game = games.get(gameCode);
    if (!game || game.dmId !== socket.id) return;

    const player = game.players.get(playerId);
    if (!player) return;

    // Unassign previous character
    if (player.character?.id) {
      game.assignedCharacterIds.delete(player.character.id);
    }

    player.character = character;
    player.health = character.health;
    player.maxHealth = character.health;
    player.stress = 0;
    player.inventory = [...(character.gear || [])];
    player.alive = true;
    player.statusEffects = [];
    player.conditions = { starving: false, dehydrated: false, exhausted: false, freezing: false };

    game.assignedCharacterIds.add(character.id);

    console.log(`[MUTHUR] Character "${character.name}" assigned to "${player.name}"`);

    // Notify the player
    io.to(playerId).emit('character-assigned', { player: getPlayerData(player) });

    // Notify the DM with updated player list
    io.to(game.dmId).emit('players-updated', { players: serializePlayers(game) });
  });

  /* ─── DM: Update Player Status ─────────────────── */
  socket.on('update-player', ({ gameCode, playerId, updates }) => {
    const game = games.get(gameCode);
    if (!game || game.dmId !== socket.id) return;

    const player = game.players.get(playerId);
    if (!player) return;

    // Apply updates
    if (updates.health !== undefined) player.health = Math.max(0, Math.min(updates.health, player.maxHealth));
    if (updates.stress !== undefined) player.stress = Math.max(0, updates.stress);
    if (updates.statusEffects !== undefined) player.statusEffects = updates.statusEffects;
    if (updates.inventory !== undefined) player.inventory = updates.inventory;
    if (updates.alive !== undefined) player.alive = updates.alive;
    if (updates.conditions !== undefined) player.conditions = { ...player.conditions, ...updates.conditions };

    // Notify the player
    io.to(playerId).emit('status-updated', { player: getPlayerData(player) });

    // Notify the DM
    io.to(game.dmId).emit('players-updated', { players: serializePlayers(game) });
  });

  /* ─── DM: Send Secret Message to Player ────────── */
  socket.on('send-message', ({ gameCode, playerId, text, priority }) => {
    const game = games.get(gameCode);
    if (!game || game.dmId !== socket.id) return;

    const player = game.players.get(playerId);
    if (!player) return;

    const message = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      from: 'MUTHUR',
      fromId: socket.id,
      to: player.name,
      toId: playerId,
      text,
      priority: priority || 'STANDARD',
      timestamp: Date.now(),
      read: false,
    };

    game.messages.push(message);

    // Send to the specific player
    io.to(playerId).emit('secret-message', { message });

    // Confirm to DM
    io.to(game.dmId).emit('message-sent', { message });
  });

  /* ─── Player: Send Message to DM ───────────────── */
  socket.on('player-message', ({ gameCode, text }) => {
    const game = games.get(gameCode);
    if (!game) return;

    const player = game.players.get(socket.id);
    if (!player) return;

    const message = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      from: player.name,
      fromId: socket.id,
      to: 'MUTHUR',
      toId: game.dmId,
      text,
      priority: 'CREW TRANSMISSION',
      timestamp: Date.now(),
      read: false,
    };

    game.messages.push(message);

    // Send to DM
    io.to(game.dmId).emit('player-message-received', { message });

    // Confirm to player
    socket.emit('message-confirmed', { message });
  });

  /* ─── Player: Send Message to Another Player ───── */
  socket.on('player-to-player', ({ gameCode: gc, targetId, text }) => {
    const game = games.get(gc);
    if (!game) return;

    const sender = game.players.get(socket.id);
    const target = game.players.get(targetId);
    if (!sender || !target) return;

    const message = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      from: sender.name,
      fromId: socket.id,
      to: target.name,
      toId: targetId,
      text,
      type: 'p2p',
      priority: 'ENCRYPTED',
      timestamp: Date.now(),
      read: false,
    };

    game.messages.push(message);

    // Send to the target player
    io.to(targetId).emit('p2p-message', { message });

    // Confirm to sender
    socket.emit('p2p-confirmed', { message });

    // DM always sees all player-to-player messages
    io.to(game.dmId).emit('player-message-received', { message: { ...message, dmNote: `[P2P] ${sender.name} → ${target.name}` } });
  });

  /* ─── DM: Kill Character ───────────────────────── */
  socket.on('kill-character', ({ gameCode, playerId }) => {
    const game = games.get(gameCode);
    if (!game || game.dmId !== socket.id) return;

    const player = game.players.get(playerId);
    if (!player) return;

    player.alive = false;
    player.health = 0;

    // Notify the player
    io.to(playerId).emit('character-died', { playerName: player.name, characterName: player.character?.name });

    // Notify DM
    io.to(game.dmId).emit('players-updated', { players: serializePlayers(game) });
  });

  /* ─── DM: Get Assigned Character IDs ───────────── */
  socket.on('get-assigned-characters', ({ gameCode }, callback) => {
    const game = games.get(gameCode);
    if (!game) return callback({ ids: [] });
    callback({ ids: Array.from(game.assignedCharacterIds) });
  });

  /* ─── DM: Broadcast to All Players ─────────────── */
  socket.on('broadcast-message', ({ gameCode, text, priority }) => {
    const game = games.get(gameCode);
    if (!game || game.dmId !== socket.id) return;

    const message = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      from: 'MUTHUR',
      fromId: socket.id,
      to: 'ALL CREW',
      toId: 'broadcast',
      text,
      priority: priority || 'SHIPWIDE',
      timestamp: Date.now(),
      read: false,
    };

    game.messages.push(message);

    // Send to all players in the game
    for (const [pid] of game.players) {
      io.to(pid).emit('secret-message', { message });
    }

    io.to(game.dmId).emit('message-sent', { message });
  });

  /* ─── Disconnect ───────────────────────────────── */
  socket.on('disconnect', () => {
    console.log(`[MUTHUR] Disconnected: ${socket.id}`);

    const result = findGameBySocket(socket.id);
    if (!result) return;

    const { game, role } = result;

    if (role === 'player') {
      const player = game.players.get(socket.id);
      game.players.delete(socket.id);
      if (player?.character?.id) {
        game.assignedCharacterIds.delete(player.character.id);
      }
      console.log(`[MUTHUR] Player "${player?.name}" left game ${game.code}`);
      io.to(game.dmId).emit('player-left', {
        playerId: socket.id,
        playerName: player?.name,
        players: serializePlayers(game),
      });
      broadcastPlayerList(game);
    }

    if (role === 'dm') {
      console.log(`[MUTHUR] DM left game ${game.code} — ending session`);
      // Notify all players
      for (const [pid] of game.players) {
        io.to(pid).emit('game-ended', { reason: 'DM has ended the session.' });
      }
      games.delete(game.code);
    }
  });
});


/* ═══════════════════════════════════════════════════════════════
   SERVER STARTUP
   ═══════════════════════════════════════════════════════════════ */

const PORT = process.env.PORT || 3000;

// In production, serve the built Vite app
const distPath = join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.use((req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔══════════════════════════════════════════════════════╗
  ║  MU/TH/UR SESSION SERVER — ONLINE                   ║
  ║  Port: ${String(PORT).padEnd(41)}║
  ║  Status: AWAITING CONNECTIONS                        ║
  ╚══════════════════════════════════════════════════════╝
  `);
});
