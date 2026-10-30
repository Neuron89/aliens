/* ═══════════════════════════════════════════════════════════════
   SESSION PERSISTENCE — one JSON snapshot per game in
   <DATA_DIR>/sessions/<CODE>.json (DATA_DIR defaults to <app>/data).
   - Maps/Sets are serialized as arrays; null-prototype id maps (board
     tokens/rooms) serialize as plain JSON objects and are converted back
     by sessions.js boardOf → board.normalizeBoard on first use.
   - Writes are debounced (<= 1 per WRITE_INTERVAL_MS per game) and
     atomic (tmp file + rename).
   - Snapshots older than MAX_AGE_MS are deleted on load.
   ═══════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomInt } from 'crypto';
import { restoreLog } from './sessionLog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
export const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const WRITE_INTERVAL_MS = 250;

const CODE_RE = /^[A-Z]{4}$/;
const pending = new Map(); // code -> { timer, game, lastWrite }
const lastWrite = new Map(); // code -> ms
const removed = new Set(); // codes deleted; never re-written

const fileFor = (code) => path.join(SESSIONS_DIR, `${code}.json`);

function ensureDir() {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

/** Game record (Maps/Sets) -> plain JSON-able object. */
export function toSnapshot(game) {
  return {
    version: 1,
    code: game.code,
    universeId: game.universeId,
    packId: game.packId,
    status: game.status,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    dmToken: game.dmToken,
    gmPin: game.gmPin,
    players: Array.from(game.players.values()).map(({ socketId, ...p }) => p), // eslint-disable-line no-unused-vars
    messages: game.messages,
    // Informational only (recomputed from seats at runtime; never read back).
    assignedCharacterIds: Array.from(new Set(Array.from(game.players.values()).map((p) => p.character?.id).filter(Boolean))),
    board: game.board || null, // table board (server/board.js), plain JSON
    mapDef: game.mapDef || null,
    table: game.table || null, // session features (sessions.js tableOf): run, narration, handouts, clues, clocks, safety…
    log: Array.isArray(game.log) ? game.log : [], // server/sessionLog.js
  };
}

/** Snapshot -> game record in dormant state (no live sockets). */
export function fromSnapshot(s) {
  const players = new Map();
  for (const p of Array.isArray(s.players) ? s.players : []) {
    if (!p?.id) continue;
    players.set(p.id, { ...p, socketId: null, connected: false });
  }
  return {
    code: s.code,
    dmId: null,
    universeId: s.universeId,
    packId: s.packId ?? null,
    status: 'dormant',
    createdAt: s.createdAt || Date.now(),
    updatedAt: s.updatedAt || Date.now(),
    dmToken: s.dmToken,
    // Older snapshots have no PIN: mint one (the DM sees it after resuming with the token).
    gmPin: typeof s.gmPin === 'string' && /^\d{6}$/.test(s.gmPin) ? s.gmPin : String(randomInt(0, 1000000)).padStart(6, '0'),
    players,
    messages: Array.isArray(s.messages) ? s.messages : [],
    board: s.board && typeof s.board === 'object' ? s.board : null, // sessions.js substitutes an empty board
    mapDef: s.mapDef && typeof s.mapDef === 'object' ? s.mapDef : null,
    table: s.table && typeof s.table === 'object' ? s.table : null, // sessions.js normalizes (tableOf)
    log: restoreLog(s.log),
  };
}

function writeNow(game, onSaved) {
  if (removed.has(game.code)) return;
  try {
    ensureDir();
    const target = fileFor(game.code);
    const tmp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(toSnapshot(game)));
    try {
      fs.renameSync(tmp, target);
    } catch {
      // Windows can refuse rename-over while a reader holds the file; retry once via unlink.
      try { fs.unlinkSync(target); } catch { /* ignore */ }
      fs.renameSync(tmp, target);
    }
    const now = Date.now();
    lastWrite.set(game.code, now);
    onSaved?.(game, now);
  } catch (err) {
    console.error(`[PERSIST] write failed for ${game.code}:`, err.message);
  }
}

/** Queue a snapshot write (trailing debounce; at most one write per WRITE_INTERVAL_MS). */
export function scheduleSave(game, onSaved) {
  if (removed.has(game.code)) return;
  const entry = pending.get(game.code);
  if (entry) { entry.game = game; entry.onSaved = onSaved; return; }
  const since = Date.now() - (lastWrite.get(game.code) || 0);
  const delay = Math.max(0, WRITE_INTERVAL_MS - since);
  const e = { game, onSaved, timer: null };
  e.timer = setTimeout(() => {
    pending.delete(game.code);
    writeNow(e.game, e.onSaved);
  }, delay);
  pending.set(game.code, e);
}

/** Write every pending snapshot immediately (shutdown). */
export function flushAll() {
  for (const [code, e] of pending) {
    clearTimeout(e.timer);
    pending.delete(code);
    writeNow(e.game, e.onSaved);
  }
}

/** Delete a game's snapshot and cancel any queued write. */
export function removeSnapshot(code) {
  removed.add(code);
  const e = pending.get(code);
  if (e) { clearTimeout(e.timer); pending.delete(code); }
  lastWrite.delete(code);
  try { fs.unlinkSync(fileFor(code)); } catch { /* already gone */ }
}

/** Allow a code to be written again (codes can be re-generated after deletion). */
export function allowCode(code) { removed.delete(code); }

/** Load snapshots newer than MAX_AGE_MS as dormant game records; delete older/corrupt ones. */
export function loadSnapshots() {
  ensureDir();
  const games = [];
  const now = Date.now();
  for (const name of fs.readdirSync(SESSIONS_DIR)) {
    const full = path.join(SESSIONS_DIR, name);
    if (name.endsWith('.tmp')) { try { fs.unlinkSync(full); } catch { /* ignore */ } continue; }
    const m = /^([A-Z]{4})\.json$/.exec(name);
    if (!m || !CODE_RE.test(m[1])) continue;
    try {
      const snap = JSON.parse(fs.readFileSync(full, 'utf8'));
      const ts = Number(snap.updatedAt) || fs.statSync(full).mtimeMs;
      if (snap.code !== m[1] || now - ts > MAX_AGE_MS) { fs.unlinkSync(full); continue; }
      games.push(fromSnapshot(snap));
    } catch (err) {
      console.error(`[PERSIST] dropping unreadable snapshot ${name}: ${err.message}`);
      try { fs.unlinkSync(full); } catch { /* ignore */ }
    }
  }
  return games;
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { flushAll(); process.exit(0); });
}
process.on('exit', flushAll);
