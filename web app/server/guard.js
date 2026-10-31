/* ═══════════════════════════════════════════════════════════════
   SOCKET GUARD — the one wrapper every session/board/mechanics
   handler is registered through (docs/REVIEW_2026-10-30.md #1, #5).

   safeOn(socket, event, handler)
     - payload: anything that is not a plain object becomes {}
       (a bare function first argument is treated as the ack)
     - ack: passed to the handler only when the client sent a function;
       it can fire at most once
     - the handler runs inside try/catch (sync throws and rejected
       promises are logged with the event name) — never throws out,
       so a malformed client event can never kill the process.

   EVENT_NAMES lists every client → server event (the hardening test
   fires garbage at each one). sessions.js warns once if a listed event
   is not registered or a registered one is missing from the list.

   Id helpers: RESERVED_IDS / isSafeKey keep '__proto__', 'constructor'
   and 'prototype' out of every id that is used as an object key.
   ═══════════════════════════════════════════════════════════════ */
import { timingSafeEqual } from 'crypto';

export const EVENT_NAMES = Object.freeze([
  // sessions / seats
  'create-game', 'resume-game', 'end-game', 'list-resumable', 'join-game', 'rejoin-game', 'seat-claim-resolve',
  'assign-character', 'update-player', 'send-message', 'player-message', 'player-to-player', 'kill-character',
  'get-assigned-characters', 'broadcast-message',
  // table board
  'join-board', 'board-sync', 'board-set-map', 'board-token-upsert', 'board-token-move', 'board-token-remove',
  'board-room-set', 'board-fog', 'board-view', 'board-ping', 'board-reset',
  // session features
  'table-sync', 'session-seed', 'run-set', 'advance-act', 'narrate', 'narrate-clear', 'board-mode', 'handout-send',
  'handout-seen', 'clue-upsert', 'clue-reveal', 'clue-hide', 'clock-upsert', 'clock-tick', 'clock-remove',
  'safety-set', 'safety-confirm', 'pause-request', 'pause-clear', 'log-note', 'character-submit', 'submission-resolve',
  'player-roll', 'token-take', 'token-take-undo', 'roll-request', 'roll-request-cancel',
  // mechanics wave
  'gm-roll', 'panic-result', 'supply-set', 'supply-roll', 'pools-init', 'pool-set', 'pool-delta',
  'init-set', 'init-step', 'init-goto', 'init-round', 'init-end', 'init-pass', 'injury-add', 'injury-remove',
  // builder gaps (determination)
  'determination-spend', 'determination-grant',
  // F3 soundboard
  'table-sfx',
  // F1 motion tracker
  'tracker-set', 'tracker-signal',
  // F6 intrigue web + prescience
  'vision-send',
  // voice (server TTS → TV / GM)
  'narrate-speak', 'narrate-speak-stop',
]);

export const RESERVED_IDS = Object.freeze(new Set(['__proto__', 'constructor', 'prototype']));
/** A string usable as an object key (not a prototype-chain name). */
export const isSafeKey = (k) => typeof k === 'string' && !RESERVED_IDS.has(k);
/** Object with no prototype (id-keyed maps: board tokens/rooms, pools…). */
export const nullObj = (src) => {
  const o = Object.create(null);
  if (src && typeof src === 'object') {
    for (const [k, v] of Object.entries(src)) if (isSafeKey(k)) o[k] = v;
  }
  return o;
};

export function isPlainObject(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** Constant-time string compare (tokens, PINs). */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function report(event, err) {
  console.error(`[SOCKET] handler "${event}" failed: ${err?.stack || err}`);
}

export function safeOn(socket, event, handler) {
  socket.on(event, (...args) => {
    const ack = args.length && typeof args[args.length - 1] === 'function' ? args.pop() : null;
    const payload = isPlainObject(args[0]) ? args[0] : {};
    let acked = false;
    const reply = ack
      ? (res) => {
        if (acked) return;
        acked = true;
        try { ack(res); } catch (err) { report(event, err); }
      }
      : undefined;
    try {
      const out = handler(payload, reply);
      if (out && typeof out.then === 'function') {
        out.catch((err) => { report(event, err); reply?.({ error: 'SERVER ERROR.' }); });
      }
    } catch (err) {
      report(event, err);
      reply?.({ error: 'SERVER ERROR.' });
    }
  });
}
