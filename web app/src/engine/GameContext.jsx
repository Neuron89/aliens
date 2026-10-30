import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useUniverse } from './UniverseContext';

const GameContext = createContext(null);
export const useGame = () => useContext(GameContext);

/* ─── Saved session (survives reloads / dropped links) ───────────
   muthur.session   = { code, role, dmToken | playerToken, playerName, universeId, packId }
   muthur.dmTokens  = { [code]: dmToken }   (lets one browser resume several hosted games) */
const SESSION_KEY = 'muthur.session';
const DM_TOKENS_KEY = 'muthur.dmTokens';

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
const loadSession = () => {
  const s = readJSON(SESSION_KEY, null);
  return s && s.code && s.role ? s : null;
};
const saveSession = (s) => writeJSON(SESSION_KEY, s);
const clearSession = () => { try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } };
const dmTokenFor = (code) => readJSON(DM_TOKENS_KEY, {})[code] || null;
const rememberDmToken = (code, tok) => writeJSON(DM_TOKENS_KEY, { ...readJSON(DM_TOKENS_KEY, {}), [code]: tok });
const forgetDmToken = (code) => {
  const t = readJSON(DM_TOKENS_KEY, {});
  delete t[code];
  writeJSON(DM_TOKENS_KEY, t);
};

const joinParam = () => {
  try { return (new URLSearchParams(window.location.search).get('join') || '').toUpperCase(); } catch { return ''; }
};

/* ─── Table board role (TV): ?board=CODE; muthur.board = { code, role: 'board' } ───
   Kept apart from muthur.session so opening the board in a GM tab never
   steals the GM seat. A saved board re-attaches on load only when this
   browser has no other saved session and no ?join= link. */
const BOARD_KEY = 'muthur.board';
export const boardParam = () => {
  try { return (new URLSearchParams(window.location.search).get('board') || '').toUpperCase(); } catch { return ''; }
};
const hasBoardParam = () => {
  try { return new URLSearchParams(window.location.search).has('board'); } catch { return false; }
};
const loadBoard = () => {
  const b = readJSON(BOARD_KEY, null);
  return b && b.code && b.role === 'board' ? b : null;
};
const clearBoard = () => { try { localStorage.removeItem(BOARD_KEY); } catch { /* ignore */ } };
/** Code this tab should attach to as the table board ('' = not a board tab). */
export const boardCodeForTab = () => {
  const p = boardParam();
  if (p) return p;
  if ((hasBoardParam() || (!loadSession() && !joinParam())) && loadBoard()) return loadBoard().code;
  return '';
};
const MOVE_INTERVAL_MS = 33;   // 30 Hz token-move throttle
const PENDING_MOVE_MS = 600;   // keep the local drag position over stale server echoes
const PING_TTL_MS = 4000;
const tokenUid = (kind) => `${kind}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ─── Session features (ARCHITECTURE.md "Sessions") ───────────────
   table      role-filtered game.table from `table-state` (run, narration, handouts, clues, clocks, safety, pause…)
   sessionLog DM only: append-only log (`log-entry`)
   on(event, fn) subscribe to one-shot effects: handout-received, clue-revealed, clock-ticked, new-orders,
              item-received, board-flash, pause-requested, roll, character-submitted, submission-updated, handout-seen
   Outbox (players): rolls and messages are queued in localStorage (muthur.outbox) and re-sent on every
   (re)connect until the server acks them; the server dedupes by clientId, so a roll is never lost or doubled. */
const OUTBOX_KEY = 'muthur.outbox';
const OUTBOX_ACK_MS = 6000;
const TABLE_EVENTS = ['handout-received', 'clue-revealed', 'clock-ticked', 'new-orders', 'item-received', 'board-flash',
  'pause-requested', 'roll', 'character-submitted', 'submission-updated', 'handout-seen'];
const clientUid = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function GameProvider({ children }) {
  const { setUniverseId } = useUniverse();
  const setUniverseIdRef = useRef(setUniverseId);
  setUniverseIdRef.current = setUniverseId;
  const socketRef = useRef(null);
  const codeRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [resuming, setResuming] = useState(false);   // auto resume/rejoin in flight
  const [role, setRole] = useState(null);           // 'dm' | 'player' | null
  const [gameCode, setGameCode] = useState(null);
  const [players, setPlayers] = useState({});        // DM sees all
  const [myPlayer, setMyPlayer] = useState(null);    // Player sees own data
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectedPlayers, setConnectedPlayers] = useState([]);
  const [sessionUniverseId, setSessionUniverseId] = useState(null);
  const [packId, setPackId] = useState(null);
  const [dmOnline, setDmOnline] = useState(true);    // player: is the GM attached?
  const [lastSaved, setLastSaved] = useState(null);  // DM: ms of last server snapshot
  /* Table board (docs/BOARD_AND_BUILDER.md §2): DM gets the full state, board/players a filtered one. */
  const [board, setBoard] = useState(null);
  const [mapDef, setMapDef] = useState(null);
  const [boardLinked, setBoardLinked] = useState(0); // DM: number of TV clients attached
  const [pings, setPings] = useState([]);            // [{ x, y, at, rx, color, by, key }]
  const [boardError, setBoardError] = useState(null);
  const pendingMoves = useRef({});                   // tokenId -> { x, y, until }
  const moveThrottle = useRef({});                   // tokenId -> { last, timer, next }
  /* Session features */
  const [table, setTable] = useState(null);
  const [sessionLog, setSessionLog] = useState([]);  // DM
  const [unreadBy, setUnreadBy] = useState({});      // DM: playerId -> unread player messages
  const listeners = useRef(new Map());               // event -> Set<fn>
  const outbox = useRef(readJSON(OUTBOX_KEY, []).filter((x) => x && x.clientId && x.event));
  const [outboxCount, setOutboxCount] = useState(outbox.current.length);

  useEffect(() => { codeRef.current = gameCode; }, [gameCode]);
  const roleRef = useRef(null);
  useEffect(() => { roleRef.current = role; }, [role]);

  /* Drop all in-memory session state (does not touch localStorage). */
  const resetState = useCallback(() => {
    setRole(null);
    setGameCode(null);
    setPlayers({});
    setMyPlayer(null);
    setMessages([]);
    setUnreadCount(0);
    setConnectedPlayers([]);
    setPackId(null);
    setSessionUniverseId(null);
    setDmOnline(true);
    setLastSaved(null);
    setBoard(null);
    setMapDef(null);
    setBoardLinked(0);
    setPings([]);
    setTable(null);
    setSessionLog([]);
    setUnreadBy({});
  }, []);

  const fireEvent = useCallback((name, payload) => {
    for (const fn of listeners.current.get(name) || []) {
      try { fn(payload); } catch (e) { console.error(`[${name}] listener failed`, e); }
    }
  }, []);
  /** Subscribe to a one-shot session event. Returns an unsubscribe function. */
  const on = useCallback((name, fn) => {
    if (!listeners.current.has(name)) listeners.current.set(name, new Set());
    listeners.current.get(name).add(fn);
    return () => listeners.current.get(name)?.delete(fn);
  }, []);

  /* ─── Player outbox: queued until acked, replayed on reconnect ─── */
  const persistOutbox = useCallback(() => {
    const list = outbox.current.map(({ inflight, ...x }) => x); // eslint-disable-line no-unused-vars
    writeJSON(OUTBOX_KEY, list);
    setOutboxCount(list.length);
  }, []);
  const flushOutbox = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected || roleRef.current !== 'player' || !codeRef.current) return;
    // Items from another game can never be delivered.
    const before = outbox.current.length;
    outbox.current = outbox.current.filter((x) => x.code === codeRef.current);
    if (outbox.current.length !== before) persistOutbox();
    for (const item of outbox.current) {
      if (item.inflight) continue;
      item.inflight = true;
      socket.timeout(OUTBOX_ACK_MS).emit(item.event, { ...item.payload, gameCode: item.code, clientId: item.clientId }, (err, r) => {
        item.inflight = false;
        if (err) return; // no ack: retry on next flush
        if (r?.success || r?.duplicate || (r?.error && r.error !== 'NOT AUTHORIZED.')) {
          outbox.current = outbox.current.filter((x) => x.clientId !== item.clientId);
          persistOutbox();
        }
      });
    }
  }, [persistOutbox]);
  const enqueue = useCallback((event, payload) => {
    const item = { clientId: clientUid(), event, payload, code: codeRef.current, at: Date.now() };
    outbox.current = [...outbox.current, item];
    persistOutbox();
    flushOutbox();
    return item.clientId;
  }, [persistOutbox, flushOutbox]);

  /* Attach this socket as the table board for `code`. */
  const joinBoardOn = useCallback((socket, code, callback) => {
    const upper = String(code || '').toUpperCase();
    if (!upper) return;
    setResuming(true);
    socket.emit('join-board', { code: upper }, (r) => {
      setResuming(false);
      if (!r || r.error) {
        setBoardError(r?.error || 'NO RESPONSE.');
        if (loadBoard()?.code === upper && !boardParam()) clearBoard();
        callback?.(r || { error: 'NO RESPONSE.' });
        return;
      }
      setBoardError(null);
      setRole('board');
      setGameCode(r.code || upper);
      setSessionUniverseId(r.universeId || null);
      setPackId(r.packId ?? null);
      if (r.universeId) setUniverseIdRef.current(r.universeId);
      setBoard(r.board || null);
      setMapDef(r.mapDef || null);
      setTable(r.table || null);
      writeJSON(BOARD_KEY, { code: r.code || upper, role: 'board' });
      callback?.(r);
    });
  }, []);

  /* Apply a successful resume-game / rejoin-game response. */
  const applyRestore = useCallback((saved, r) => {
    const universeId = r.universeId || saved.universeId || null;
    if (universeId) setUniverseIdRef.current(universeId);
    setGameCode(saved.code);
    setSessionUniverseId(universeId);
    setPackId(r.packId ?? null);
    setMessages(Array.isArray(r.messages) ? r.messages : []);
    setTable(r.table || null);
    if (saved.role === 'dm') {
      setPlayers(r.players || {});
      setSessionLog(Array.isArray(r.log) ? r.log : []);
      setRole('dm');
    } else {
      setMyPlayer(r.player || null);
      setDmOnline(r.dmConnected !== false);
      setRole('player');
      codeRef.current = saved.code;
      roleRef.current = 'player';
      setTimeout(() => flushOutbox(), 0);
    }
  }, [flushOutbox]);

  /* Try to restore the saved session on this socket. */
  const autoResume = useCallback((socket) => {
    // A board tab (?board=CODE, or a saved TV board) never touches the GM/player seat.
    const boardCode = boardCodeForTab();
    if (boardCode) { joinBoardOn(socket, boardCode); return; }
    let saved = loadSession();
    if (!saved) return;
    // A ?join= link for a different game wins over an old saved player seat.
    const jp = joinParam();
    if (saved.role === 'player' && jp && jp !== saved.code) { clearSession(); return; }
    setResuming(true);
    const done = (r) => {
      setResuming(false);
      if (!r || r.error) {
        // Game gone or token rejected: forget it (stay on current screen).
        if (r?.error) { clearSession(); if (saved.role === 'dm') forgetDmToken(saved.code); resetState(); }
        return;
      }
      if (saved.role === 'player' && r.playerToken) {
        saved = { ...saved, playerToken: r.playerToken, universeId: r.universeId, packId: r.packId ?? null };
        saveSession(saved);
      }
      applyRestore(saved, r);
    };
    if (saved.role === 'dm') {
      const dmToken = saved.dmToken || dmTokenFor(saved.code);
      socket.emit('resume-game', { code: saved.code, dmToken }, done);
    } else {
      socket.emit('rejoin-game', { code: saved.code, playerToken: saved.playerToken, playerName: saved.playerName }, done);
    }
  }, [applyRestore, resetState, joinBoardOn]);

  /* ─── Socket Connection ──────────────────────────── */
  useEffect(() => {
    const socket = io({ transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => { setConnected(true); autoResume(socket); });
    socket.on('disconnect', () => setConnected(false));

    /* Table board (all roles; payload already filtered by the server) */
    socket.on('board-state', ({ board: b, mapDef: md } = {}) => {
      if (md !== undefined) setMapDef(md || null);
      if (!b) return;
      // Keep the local position of tokens the DM is dragging until the server echo catches up.
      const now = Date.now();
      const pend = pendingMoves.current;
      let tokens = b.tokens;
      for (const [id, p] of Object.entries(pend)) {
        if (p.until < now || !tokens?.[id]) { delete pend[id]; continue; }
        if (tokens === b.tokens) tokens = { ...b.tokens };
        tokens[id] = { ...tokens[id], x: p.x, y: p.y };
      }
      setBoard(tokens === b.tokens ? b : { ...b, tokens });
    });
    socket.on('board-ping', (p) => {
      if (!p) return;
      const ping = { ...p, rx: Date.now(), key: `${p.at}-${p.by}-${Math.random().toString(36).slice(2, 6)}` };
      setPings((prev) => [...prev.filter((x) => Date.now() - x.rx < PING_TTL_MS), ping].slice(-8));
      setTimeout(() => setPings((prev) => prev.filter((x) => Date.now() - x.rx < PING_TTL_MS)), PING_TTL_MS + 50);
    });
    socket.on('board-linked', ({ count } = {}) => setBoardLinked(Number(count) || 0));

    /* Session features */
    socket.on('table-state', ({ table: t } = {}) => { if (t) setTable(t); });
    socket.on('log-entry', ({ entry } = {}) => {
      if (entry) setSessionLog((prev) => (prev.some((e) => e.id === entry.id) ? prev : [...prev, entry].slice(-2000)));
    });
    for (const name of TABLE_EVENTS) socket.on(name, (payload) => fireEvent(name, payload));

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

    socket.on('game-saved', ({ savedAt }) => setLastSaved(savedAt));

    socket.on('message-sent', ({ message }) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('player-message-received', ({ message }) => {
      setMessages(prev => [...prev, message]);
      setUnreadCount(prev => prev + 1);
      if (message?.type === 'player' && message.fromId) setUnreadBy(prev => ({ ...prev, [message.fromId]: (prev[message.fromId] || 0) + 1 }));
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

    // Confirmed own messages replace their optimistic (queued) copy.
    const confirmOwn = ({ message }) => {
      if (!message) return;
      setMessages(prev => [...prev.filter(m => !(message.clientId && m.clientId === message.clientId && m.pending) && m.id !== message.id), message]);
    };
    socket.on('message-confirmed', confirmOwn);

    socket.on('p2p-message', ({ message }) => {
      setMessages(prev => [...prev, message]);
      setUnreadCount(prev => prev + 1);
    });

    socket.on('p2p-confirmed', confirmOwn);

    socket.on('player-list', ({ players: plist }) => {
      setConnectedPlayers(plist);
    });

    socket.on('character-died', () => {
      setMyPlayer(prev => prev ? { ...prev, alive: false, tracks: prev.tracks ? { ...prev.tracks, health: 0 } : prev.tracks } : prev);
    });

    socket.on('dm-disconnected', () => setDmOnline(false));
    socket.on('dm-reconnected', () => setDmOnline(true));

    /* Another terminal took over this seat/session. */
    socket.on('session-taken', () => {
      clearSession();
      resetState();
    });

    socket.on('game-ended', ({ reason }) => {
      if (roleRef.current === 'board') {
        // TV: forget the board; never touch a GM/player seat saved in this browser.
        clearBoard();
        resetState();
        setBoardError(reason || 'SESSION ENDED.');
        return;
      }
      clearSession();
      resetState();
      setMessages([{
        id: Date.now().toString(),
        from: 'SYSTEM', to: 'ALL',
        text: reason || 'Game session ended.',
        priority: 'SYSTEM', timestamp: Date.now(), read: true,
      }]);
    });

    return () => {
      socket.disconnect();
    };
  }, [autoResume, resetState, fireEvent]);

  /* ─── DM Actions ─────────────────────────────────── */
  /** createGame({ universeId, packId? }, callback) */
  const createGame = useCallback((options, callback) => {
    const { universeId, packId: pid = null, sessionZero = null } = options || {};
    socketRef.current?.emit('create-game', { universeId, packId: pid }, (response) => {
      if (response?.error) { callback?.(response); return; }
      if (sessionZero?.enabled) socketRef.current?.emit('safety-set', { gameCode: response.code, ...sessionZero });
      setGameCode(response.code);
      setSessionUniverseId(response.universeId || universeId || null);
      setPackId(response.packId ?? pid ?? null);
      setRole('dm');
      setPlayers({});
      setMessages([]);
      if (response.dmToken) {
        rememberDmToken(response.code, response.dmToken);
        saveSession({
          code: response.code, role: 'dm', dmToken: response.dmToken, playerName: null,
          universeId: response.universeId || universeId || null, packId: response.packId ?? pid ?? null,
        });
      }
      callback?.(response);
    });
  }, []);

  /** Resume a hosted game. opts.takeover=true skips the token (server only allows it when no GM is attached). */
  const resumeGame = useCallback((code, opts, callback) => {
    const takeover = !!opts?.takeover;
    const dmToken = takeover ? undefined : dmTokenFor(code);
    socketRef.current?.emit('resume-game', { code, dmToken, takeover }, (r) => {
      if (!r || r.error) { callback?.(r || { error: 'NO RESPONSE.' }); return; }
      if (r.dmToken) rememberDmToken(code, r.dmToken);
      const saved = { code, role: 'dm', dmToken: r.dmToken || dmToken, playerName: null, universeId: r.universeId, packId: r.packId ?? null };
      saveSession(saved);
      applyRestore(saved, r);
      callback?.(r);
    });
  }, [applyRestore]);

  const listResumable = useCallback((callback) => {
    socketRef.current?.emit('list-resumable', {}, (list) => callback?.(Array.isArray(list) ? list : []));
  }, []);

  const hasDmToken = useCallback((code) => !!dmTokenFor(code), []);

  /** init: { tracks: {key: value}, trackMax: {key: max}, conditions: [names] } computed from universe.rules */
  const assignCharacter = useCallback((playerId, character, init = {}) => {
    socketRef.current?.emit('assign-character', { gameCode, playerId, character, ...init });
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
    const upper = code.toUpperCase();
    socketRef.current?.emit('join-game', { code: upper, playerName }, (response) => {
      if (response.error) {
        callback?.(response);
      } else {
        setGameCode(upper);
        setSessionUniverseId(response.universeId || null);
        setPackId(response.packId || null);
        if (response.universeId) setUniverseIdRef.current(response.universeId, { boot: true });
        setMyPlayer(response.player || null);
        setRole('player');
        setMessages(Array.isArray(response.messages) ? response.messages : []);
        setTable(response.table || null);
        setDmOnline(response.dmConnected !== false);
        codeRef.current = upper;
        roleRef.current = 'player';
        if (response.playerToken) {
          saveSession({
            code: upper, role: 'player', playerToken: response.playerToken, playerName: playerName.slice(0, 40),
            universeId: response.universeId || null, packId: response.packId || null,
          });
        }
        callback?.(response);
      }
    });
  }, []);

  /* Player messages go through the outbox (shown as pending until the server confirms). */
  const queueOwnMessage = useCallback((event, payload, draft) => {
    const clientId = enqueue(event, payload);
    setMessages(prev => [...prev, { ...draft, id: clientId, clientId, pending: true, timestamp: Date.now(), read: true }]);
  }, [enqueue]);
  const sendPlayerMessage = useCallback((text) => {
    queueOwnMessage('player-message', { text }, { type: 'player', from: myPlayer?.name, fromId: myPlayer?.id, to: 'GM', toId: 'dm', text, priority: 'PLAYER' });
  }, [queueOwnMessage, myPlayer]);

  const sendPlayerToPlayer = useCallback((targetId, text) => {
    const target = connectedPlayers.find((p) => p.id === targetId);
    queueOwnMessage('player-to-player', { targetId, text }, { type: 'p2p', from: myPlayer?.name, fromId: myPlayer?.id, to: target?.name || '', toId: targetId, text, priority: 'ENCRYPTED' });
  }, [queueOwnMessage, myPlayer, connectedPlayers]);

  /** Player: report a dice roll ({ summary, ...anything ≤ 4 KB }). Queued until acked — never lost. */
  const sendRoll = useCallback((roll) => {
    if (roleRef.current !== 'player' || !roll) return null;
    return enqueue('player-roll', { roll, at: Date.now() });
  }, [enqueue]);

  const clearUnread = useCallback(() => setUnreadCount(0), []);
  const clearUnreadFor = useCallback((playerId) => setUnreadBy(prev => (prev[playerId] ? { ...prev, [playerId]: 0 } : prev)), []);

  /* ─── Session features: DM actions (ack callbacks get { success } | { error }) ─── */
  const emitTable = useCallback((event, payload, callback) => {
    socketRef.current?.emit(event, { gameCode: codeRef.current, ...payload }, callback);
  }, []);
  const tableSync = useCallback((callback) => {
    socketRef.current?.emit('table-sync', {}, (r) => {
      if (r?.table) setTable(r.table);
      if (Array.isArray(r?.log)) setSessionLog(r.log);
      callback?.(r);
    });
  }, []);
  const sessionSeed = useCallback((seed, cb) => emitTable('session-seed', seed, cb), [emitTable]);
  /** run = { actIndex, sceneIndex, completed?, actTitle?, sceneTitle? } (optimistic) */
  const runSet = useCallback((run, cb) => {
    setTable((t) => (t ? { ...t, run: { ...t.run, ...run } } : t));
    emitTable('run-set', run, cb);
  }, [emitTable]);
  const advanceAct = useCallback((actIndex, extra, cb) => emitTable('advance-act', { actIndex, ...extra }, cb), [emitTable]);
  /** narrate(text, { title, mode:'caption'|'card', art }) */
  const narrate = useCallback((text, opts, cb) => emitTable('narrate', { text, ...opts }, cb), [emitTable]);
  const narrateClear = useCallback((cb) => emitTable('narrate-clear', {}, cb), [emitTable]);
  /** setBoardMode('map'|'theatre', { title?, subtitle?, art? }) */
  const setBoardMode = useCallback((mode, theatre, cb) => {
    setTable((t) => (t ? { ...t, boardMode: mode || t.boardMode } : t));
    emitTable('board-mode', { mode, ...theatre }, cb);
  }, [emitTable]);
  /** sendHandout({ handoutId?, handout?: {title,from,to,priority,text,image} }, to:'all'|[playerIds]) */
  const sendHandout = useCallback((h, to, cb) => emitTable('handout-send', { ...h, to }, cb), [emitTable]);
  const clueUpsert = useCallback((clue, cb) => emitTable('clue-upsert', { clue }, cb), [emitTable]);
  /** clueReveal(clueId, to:'all'|[ids], { clue?, foundBy? }) */
  const clueReveal = useCallback((clueId, to, extra, cb) => emitTable('clue-reveal', { clueId, to, ...extra }, cb), [emitTable]);
  const clueHide = useCallback((clueId, cb) => emitTable('clue-hide', { clueId }, cb), [emitTable]);
  const clockUpsert = useCallback((clock, cb) => emitTable('clock-upsert', { clock }, cb), [emitTable]);
  const clockTick = useCallback((id, delta, cb) => {
    setTable((t) => (t ? { ...t, clocks: t.clocks.map((c) => (c.id === id ? { ...c, filled: Math.max(0, Math.min(c.segments, c.filled + delta)) } : c)) } : t));
    emitTable('clock-tick', { id, delta }, cb);
  }, [emitTable]);
  const clockRemove = useCallback((id, cb) => emitTable('clock-remove', { id }, cb), [emitTable]);
  /** safetySet({ enabled, tone[], warnings[], linesVeils }) */
  const safetySet = useCallback((zero, cb) => emitTable('safety-set', zero, cb), [emitTable]);
  const pauseClear = useCallback((cb) => emitTable('pause-clear', {}, cb), [emitTable]);
  const logNote = useCallback((text, cb) => emitTable('log-note', { text }, cb), [emitTable]);
  /** resolveSubmission(id, 'reject'|'assigned', reason?) */
  const resolveSubmission = useCallback((id, action, reason, cb) => emitTable('submission-resolve', { id, action, reason }, cb), [emitTable]);

  /* ─── Session features: player actions ─── */
  const handoutSeen = useCallback((handoutId) => {
    setTable((t) => (t?.handouts ? { ...t, handouts: t.handouts.map((h) => (h.id === handoutId ? { ...h, seen: true } : h)) } : t));
    socketRef.current?.emit('handout-seen', { handoutId });
  }, []);
  const safetyConfirm = useCallback((cb) => {
    setTable((t) => (t?.safety ? { ...t, safety: { ...t.safety, confirmed: true } } : t));
    socketRef.current?.emit('safety-confirm', {}, cb);
  }, []);
  /** Anonymous X-card / pause. */
  const requestPause = useCallback((cb) => socketRef.current?.emit('pause-request', {}, cb), []);
  const submitCharacter = useCallback((character, cb) => socketRef.current?.emit('character-submit', { character }, cb), []);

  /* ─── Table board ────────────────────────────────── */
  /** Board (TV) role: attach to a game by code (no token needed). */
  const joinBoard = useCallback((code, callback) => {
    if (socketRef.current) joinBoardOn(socketRef.current, code, callback);
  }, [joinBoardOn]);

  const emitBoard = useCallback((event, payload, callback) => {
    socketRef.current?.emit(event, { gameCode: codeRef.current, ...payload }, callback);
  }, []);

  /** DM: show a map. mapId = universe map id or "<packId>:<mapId>"; mapDef from board/mapDefs.resolveMapDef. */
  const boardSetMap = useCallback((mapId, level, def, callback) => {
    emitBoard('board-set-map', { mapId, level, mapDef: def }, callback);
  }, [emitBoard]);

  /** DM: create/update a token (optimistic). Returns the token id. */
  const boardUpsertToken = useCallback((token, callback) => {
    const id = token.id || tokenUid(token.kind || 'tok');
    const full = { ...token, id };
    setBoard((prev) => {
      if (!prev) return prev;
      const merged = { ...(prev.tokens[id] || { roomId: null }), ...full };
      return { ...prev, tokens: { ...prev.tokens, [id]: merged } };
    });
    emitBoard('board-token-upsert', { token: full }, callback);
    return id;
  }, [emitBoard]);

  /** DM: drag a token. Local state updates every call; the socket is throttled to 30 Hz (final always sent). */
  const boardMoveToken = useCallback((id, x, y, final = false) => {
    pendingMoves.current[id] = { x, y, until: Date.now() + PENDING_MOVE_MS };
    setBoard((prev) => (prev?.tokens[id] ? { ...prev, tokens: { ...prev.tokens, [id]: { ...prev.tokens[id], x, y } } } : prev));
    const th = moveThrottle.current[id] || (moveThrottle.current[id] = { last: 0, timer: null, next: null });
    th.next = { x, y };
    const send = () => {
      clearTimeout(th.timer);
      th.timer = null;
      th.last = Date.now();
      const n = th.next;
      th.next = null;
      if (n) socketRef.current?.emit('board-token-move', { gameCode: codeRef.current, id, x: n.x, y: n.y });
    };
    const since = Date.now() - th.last;
    if (final || since >= MOVE_INTERVAL_MS) send();
    else if (!th.timer) th.timer = setTimeout(send, MOVE_INTERVAL_MS - since);
  }, []);

  const boardRemoveToken = useCallback((id, callback) => {
    setBoard((prev) => {
      if (!prev?.tokens[id]) return prev;
      const tokens = { ...prev.tokens };
      delete tokens[id];
      return { ...prev, tokens };
    });
    emitBoard('board-token-remove', { id }, callback);
  }, [emitBoard]);

  /** DM: patch = { revealed?, name?, note?, hideTokens? } */
  const boardSetRoom = useCallback((roomId, patch, callback) => {
    emitBoard('board-room-set', { roomId, ...patch }, callback);
  }, [emitBoard]);

  const boardSetFog = useCallback((fog) => {
    setBoard((prev) => (prev ? { ...prev, fog: !!fog } : prev));
    emitBoard('board-fog', { fog: !!fog });
  }, [emitBoard]);

  /** DM: TV orientation { rotation, flipX, zoom, pan } (partial). */
  const boardSetView = useCallback((view) => {
    setBoard((prev) => (prev ? { ...prev, view: { ...prev.view, ...view } } : prev));
    emitBoard('board-view', { view });
  }, [emitBoard]);

  /** DM / player: ping a map point (server limits to 1/s). */
  const boardPing = useCallback((x, y, callback) => {
    emitBoard('board-ping', { x, y }, callback);
  }, [emitBoard]);

  const boardReset = useCallback((callback) => {
    emitBoard('board-reset', {}, callback);
  }, [emitBoard]);

  const boardSync = useCallback((callback) => {
    socketRef.current?.emit('board-sync', {}, (r) => {
      if (r && !r.error) {
        if (r.mapDef !== undefined) setMapDef(r.mapDef || null);
        if (r.board) setBoard(r.board);
        if (r.boardClients !== undefined) setBoardLinked(r.boardClients);
      }
      callback?.(r);
    });
  }, []);

  /* ─── Leave / End Game ───────────────────────────── */
  /** DM: ends the game for everyone and deletes the snapshot. Player: leaves locally; the server keeps the seat. */
  const leaveGame = useCallback(() => {
    const code = codeRef.current;
    const saved = loadSession();
    const socket = socketRef.current;
    if (saved?.role === 'dm' && code) {
      const dmToken = saved.dmToken || dmTokenFor(code);
      socket?.emit('end-game', { code, dmToken });
      forgetDmToken(code);
    }
    clearSession();
    resetState();
    if (saved?.role !== 'dm') {
      // Drop the link so the server marks the seat dormant; reconnect has no saved session to resume.
      socket?.disconnect();
      socket?.connect();
    }
  }, [resetState]);

  // Replay queued phone actions whenever the link comes back.
  useEffect(() => { if (connected && role === 'player') flushOutbox(); }, [connected, role, flushOutbox]);

  const value = {
    connected,
    reconnecting: !connected || resuming,
    role,
    gameCode,
    universeId: sessionUniverseId,
    packId,
    players,
    myPlayer,
    messages,
    unreadCount,
    clearUnread,
    dmOnline,
    lastSaved,
    // DM
    createGame,
    resumeGame,
    listResumable,
    hasDmToken,
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
    // Table board (all roles; DM-only actions are rejected server-side for others)
    board,
    mapDef,
    boardLinked,
    pings,
    boardError,
    joinBoard,
    boardSetMap,
    boardUpsertToken,
    boardMoveToken,
    boardRemoveToken,
    boardSetRoom,
    boardSetFog,
    boardSetView,
    boardPing,
    boardReset,
    boardSync,
    // Session features
    table,
    sessionLog,
    unreadBy,
    clearUnreadFor,
    on,
    outboxCount,
    tableSync,
    sessionSeed,
    runSet,
    advanceAct,
    narrate,
    narrateClear,
    setBoardMode,
    sendHandout,
    clueUpsert,
    clueReveal,
    clueHide,
    clockUpsert,
    clockTick,
    clockRemove,
    safetySet,
    pauseClear,
    logNote,
    resolveSubmission,
    handoutSeen,
    safetyConfirm,
    requestPause,
    submitCharacter,
    sendRoll,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
