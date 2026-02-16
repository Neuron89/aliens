import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const GameContext = createContext(null);
export const useGame = () => useContext(GameContext);

export function GameProvider({ children }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [role, setRole] = useState(null);           // 'dm' | 'player' | null
  const [gameCode, setGameCode] = useState(null);
  const [players, setPlayers] = useState({});        // DM sees all
  const [myPlayer, setMyPlayer] = useState(null);    // Player sees own data
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectedPlayers, setConnectedPlayers] = useState([]);

  /* ─── Socket Connection ──────────────────────────── */
  useEffect(() => {
    const socket = io({ transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    /* DM events */
    socket.on('player-joined', ({ players: p }) => {
      setPlayers(p);
    });

    socket.on('player-left', ({ playerName, players: p }) => {
      setPlayers(p);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        from: 'SYSTEM', to: 'DM',
        text: `${playerName} has disconnected.`,
        priority: 'SYSTEM', timestamp: Date.now(), read: true,
      }]);
    });

    socket.on('players-updated', ({ players: p }) => {
      setPlayers(p);
    });

    socket.on('message-sent', ({ message }) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('player-message-received', ({ message }) => {
      setMessages(prev => [...prev, message]);
      setUnreadCount(prev => prev + 1);
    });

    /* Player events */
    socket.on('character-assigned', ({ player }) => {
      setMyPlayer(player);
    });

    socket.on('status-updated', ({ player }) => {
      setMyPlayer(player);
    });

    socket.on('secret-message', ({ message }) => {
      setMessages(prev => [...prev, message]);
      setUnreadCount(prev => prev + 1);
    });

    socket.on('message-confirmed', ({ message }) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('p2p-message', ({ message }) => {
      setMessages(prev => [...prev, message]);
      setUnreadCount(prev => prev + 1);
    });

    socket.on('p2p-confirmed', ({ message }) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('player-list', ({ players: plist }) => {
      setConnectedPlayers(plist);
    });

    socket.on('character-died', () => {
      setMyPlayer(prev => prev ? { ...prev, alive: false, health: 0 } : prev);
    });

    socket.on('game-ended', ({ reason }) => {
      setRole(null);
      setGameCode(null);
      setPlayers({});
      setMyPlayer(null);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        from: 'SYSTEM', to: 'ALL',
        text: reason || 'Game session ended.',
        priority: 'SYSTEM', timestamp: Date.now(), read: true,
      }]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  /* ─── DM Actions ─────────────────────────────────── */
  const createGame = useCallback((callback) => {
    socketRef.current?.emit('create-game', (response) => {
      setGameCode(response.code);
      setRole('dm');
      setPlayers({});
      setMessages([]);
      callback?.(response);
    });
  }, []);

  const assignCharacter = useCallback((playerId, character) => {
    socketRef.current?.emit('assign-character', { gameCode, playerId, character });
  }, [gameCode]);

  const updatePlayer = useCallback((playerId, updates) => {
    socketRef.current?.emit('update-player', { gameCode, playerId, updates });
  }, [gameCode]);

  const sendMessage = useCallback((playerId, text, priority) => {
    socketRef.current?.emit('send-message', { gameCode, playerId, text, priority });
  }, [gameCode]);

  const broadcastMessage = useCallback((text, priority) => {
    socketRef.current?.emit('broadcast-message', { gameCode, text, priority });
  }, [gameCode]);

  const killCharacter = useCallback((playerId) => {
    socketRef.current?.emit('kill-character', { gameCode, playerId });
  }, [gameCode]);

  /* ─── Player Actions ─────────────────────────────── */
  const joinGame = useCallback((code, playerName, callback) => {
    socketRef.current?.emit('join-game', { code: code.toUpperCase(), playerName }, (response) => {
      if (response.error) {
        callback?.(response);
      } else {
        setGameCode(code.toUpperCase());
        setRole('player');
        setMessages([]);
        callback?.(response);
      }
    });
  }, []);

  const sendPlayerMessage = useCallback((text) => {
    socketRef.current?.emit('player-message', { gameCode, text });
  }, [gameCode]);

  const sendPlayerToPlayer = useCallback((targetId, text) => {
    socketRef.current?.emit('player-to-player', { gameCode, targetId, text });
  }, [gameCode]);

  const clearUnread = useCallback(() => setUnreadCount(0), []);

  /* ─── Leave / End Game ───────────────────────────── */
  const leaveGame = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current?.connect();
    setRole(null);
    setGameCode(null);
    setPlayers({});
    setMyPlayer(null);
    setMessages([]);
    setUnreadCount(0);
  }, []);

  const value = {
    connected,
    role,
    gameCode,
    players,
    myPlayer,
    messages,
    unreadCount,
    clearUnread,
    // DM
    createGame,
    assignCharacter,
    updatePlayer,
    sendMessage,
    broadcastMessage,
    killCharacter,
    // Player
    joinGame,
    sendPlayerMessage,
    sendPlayerToPlayer,
    connectedPlayers,
    // Shared
    leaveGame,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
