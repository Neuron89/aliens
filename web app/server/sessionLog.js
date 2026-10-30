/* ═══════════════════════════════════════════════════════════════
   SESSION LOG — append-only event log per game, persisted with the
   session snapshot (game.log). Pure functions, no sockets.

   Entry: { id, at, type, text, act?, scene?, ...extra }
   Types: scene · act · narration · handout · clue · clock · track ·
          kill · fog · pause · note · loot · character · roll · safety
   The log never records who pressed PAUSE (X-card anonymity).
   ═══════════════════════════════════════════════════════════════ */
import { randomBytes } from 'crypto';

export const LOG_TYPES = ['scene', 'act', 'narration', 'handout', 'clue', 'clock', 'track', 'kill', 'fog', 'pause', 'note', 'loot', 'character', 'roll', 'safety',
  'panic', 'supply', 'pool', 'initiative', 'injury']; // + mechanics wave
export const LOG_CAP = 2000;
const TEXT_MAX = 2000;

/** Ensure game.log exists (older snapshots have none). */
export function logOf(game) {
  if (!Array.isArray(game.log)) game.log = [];
  return game.log;
}

/**
 * Append an entry. Returns the entry (or null for an empty text).
 * `extra` is shallow-copied; only JSON-safe scalars/arrays are expected.
 */
export function appendLog(game, type, text, extra = {}) {
  const t = String(text ?? '').trim().slice(0, TEXT_MAX);
  if (!t) return null;
  const log = logOf(game);
  const run = game.table?.run;
  const entry = {
    id: 'l_' + Date.now().toString(36) + randomBytes(3).toString('hex'),
    at: Date.now(),
    type: LOG_TYPES.includes(type) ? type : 'note',
    text: t,
    ...(run ? { act: run.actIndex, scene: run.sceneIndex } : {}),
    ...extra,
  };
  log.push(entry);
  if (log.length > LOG_CAP) log.splice(0, log.length - LOG_CAP);
  return entry;
}

/** Sanitize a log array loaded from a snapshot. */
export function restoreLog(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((e) => e && typeof e === 'object' && typeof e.text === 'string' && Number.isFinite(e.at))
    .slice(-LOG_CAP);
}
