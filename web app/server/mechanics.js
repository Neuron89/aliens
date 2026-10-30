/* ═══════════════════════════════════════════════════════════════
   MECHANICS WAVE — roll feed, panic, supplies, Momentum/Threat pools,
   initiative, critical injuries, GM secret rolls.
   (docs/RESEARCH_GM_PLAYER_EXPERIENCE.md rows 10, 11, 26–28, 40, 42, 44)

   Universe-agnostic: the server never reads a universe module. Rules that
   need data (panic table, pool caps, supply keys) arrive from the client
   that owns them (the phone sends the looked-up panic entry; the DM sends
   pool definitions from universe.rules.pools) and are sanitized here.

   State (persisted with the snapshot, see sessions.js tableOf):
     table.rolls       [{ id, clientId, playerId, playerName, characterName, roll, at, secret?, panic? }] (≤ 200)
     table.pools       { [key]: number }
     table.poolDefs    { [key]: { label, max|null, visible, playerAdd } }
     table.initiative  { active, order: [{ id, kind, label, tokenId?, playerId?, card?, done, fast, slow }], turn, round }
     player.supply     { air, power, food, water } (0–12)
     player.injuries   [{ id, name, text, roll, fatal, healTime, at }]
     player.panic      { total, effectId, name, text, panicAction, at } | null
   ═══════════════════════════════════════════════════════════════ */
import { randomBytes } from 'crypto';

export const MAX_ROLLS = 200;
const MAX_INIT = 40;
const MAX_INJURIES = 12;
const SUPPLY_MAX = 12;
const SUPPLY_DICE_MAX = 6;  // CRB p.34: a Supply roll uses at most 6 Stress Dice
const KEY_RE = /^[a-z][a-z0-9-]{0,19}$/;
const ENTRY_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const INIT_KINDS = ['pc', 'npc', 'creature'];

const sstr = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const int = (v, lo, hi, d = lo) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};
const uid = (p) => `${p}-${Date.now().toString(36)}${randomBytes(2).toString('hex')}`;
const d6 = () => 1 + Math.floor(Math.random() * 6);

export const emptyInitiative = () => ({ active: false, order: [], turn: 0, round: 1 });

/* ─── Sanitizers ─────────────────────────────────────────────── */

export function sanitizeSupply(input, prev = {}) {
  const out = { ...prev };
  if (!input || typeof input !== 'object') return out;
  for (const [k, v] of Object.entries(input).slice(0, 8)) {
    if (!KEY_RE.test(k)) continue;
    if (v === null) { delete out[k]; continue; }
    out[k] = int(v, 0, SUPPLY_MAX, 0);
  }
  return out;
}

function sanitizeInjury(input) {
  if (!input || typeof input !== 'object') return null;
  const name = sstr(input.name, 80).trim();
  if (!name) return null;
  return {
    id: typeof input.id === 'string' && /^[a-z0-9-]{1,60}$/.test(input.id) ? input.id : uid('inj'),
    uid: uid('i'),
    name,
    text: sstr(input.text, 600),
    roll: sstr(String(input.roll ?? ''), 8),
    fatal: !!input.fatal,
    healTime: sstr(input.healTime || '', 60) || null,
    at: Date.now(),
  };
}

function sanitizePoolDefs(defs) {
  const out = {};
  const list = Array.isArray(defs) ? defs : defs && typeof defs === 'object' ? Object.entries(defs).map(([key, d]) => ({ key, ...d })) : [];
  for (const d of list.slice(0, 4)) {
    if (!d || !KEY_RE.test(d.key)) continue;
    const max = Number(d.max);
    out[d.key] = {
      label: sstr(d.label, 30) || d.key.toUpperCase(),
      max: Number.isFinite(max) && max > 0 ? Math.min(99, Math.round(max)) : null,
      visible: d.visibleToPlayers !== undefined ? !!d.visibleToPlayers : d.visible !== undefined ? !!d.visible : d.owner !== 'gm',
      playerAdd: d.playerAdd !== undefined ? !!d.playerAdd : d.owner === 'players',
    };
  }
  return out;
}

function sanitizeInitiative(input, game, prev) {
  const base = prev || emptyInitiative();
  if (!input || typeof input !== 'object') return base;
  const order = Array.isArray(input.order) ? input.order : base.order;
  const seen = new Set();
  const clean = [];
  for (const e of order.slice(0, MAX_INIT)) {
    if (!e || typeof e !== 'object') continue;
    const id = typeof e.id === 'string' && ENTRY_ID_RE.test(e.id) && !seen.has(e.id) ? e.id : uid('ini');
    seen.add(id);
    const label = sstr(e.label, 60).trim();
    if (!label) continue;
    const card = Number(e.card);
    clean.push({
      id,
      kind: INIT_KINDS.includes(e.kind) ? e.kind : 'npc',
      label,
      tokenId: typeof e.tokenId === 'string' && ENTRY_ID_RE.test(e.tokenId) ? e.tokenId : null,
      playerId: typeof e.playerId === 'string' && game.players.has(e.playerId) ? e.playerId : null,
      card: Number.isFinite(card) && card >= 1 && card <= 99 ? Math.round(card) : null,
      done: !!e.done,
      fast: !!e.fast,
      slow: !!e.slow,
    });
  }
  return {
    active: input.active !== undefined ? !!input.active : base.active,
    order: clean,
    turn: clean.length ? int(input.turn ?? base.turn, 0, clean.length - 1, 0) : 0,
    round: int(input.round ?? base.round, 1, 999, 1),
  };
}

/* ─── Role views ─────────────────────────────────────────────── */

/** Pools the board / players may see: [{ key, label, value, max }]. */
export function publicPools(t) {
  const defs = t.poolDefs || {};
  return Object.entries(defs)
    .filter(([, d]) => d.visible)
    .map(([key, d]) => ({ key, label: d.label, value: Number(t.pools?.[key]) || 0, max: d.max }));
}

/** Initiative for the board / a player: current actor only (+ mine flag). */
export function publicInitiative(t, playerId = null) {
  const ini = t.initiative;
  if (!ini?.active || !ini.order?.length) return { active: false };
  const cur = ini.order[ini.turn] || null;
  return {
    active: true,
    round: ini.round,
    current: cur ? { id: cur.id, label: cur.label, kind: cur.kind, tokenId: cur.tokenId, playerId: cur.playerId } : null,
    mine: !!(playerId && cur?.playerId === playerId),
    // phones may pass the turn to an ally (Dune): list PCs that have not acted
    ...(playerId ? { allies: ini.order.filter((e) => e.kind === 'pc' && !e.done && e.id !== cur?.id).map((e) => ({ id: e.id, label: e.label })) } : {}),
  };
}

/** Crew air/power etc. for the TV supply strip (only players with a supply set). */
export function crewSupply(game, pcName) {
  const out = [];
  for (const [, p] of game.players) {
    if (!p.character || !p.supply || !Object.keys(p.supply).length) continue;
    out.push({ playerId: p.id, name: pcName(p), supply: { ...p.supply } });
  }
  return out;
}

/** Board-safe roll for the TV toast. */
export function boardRoll(entry, name) {
  const r = entry.roll || {};
  const dice = r.dice && typeof r.dice === 'object' ? r.dice : {};
  const nums = (a) => (Array.isArray(a) ? a.slice(0, 12).map((n) => int(n, 0, 99, 0)) : []);
  return {
    id: entry.id,
    name,
    label: sstr(r.label, 80),
    summary: sstr(r.summary, 160),
    kind: sstr(r.kind, 12),
    dice: { base: nums(dice.base), stress: nums(dice.stress), d20: nums(dice.d20) },
    flags: Array.isArray(r.flags) ? r.flags.filter((f) => typeof f === 'string').slice(0, 6).map((f) => f.slice(0, 20)) : [],
    at: entry.at,
  };
}

/* ─── Shared appliers (used by sessions.js player-roll too) ──── */

function tokenOf(game, boardOf, player) {
  return Object.values(boardOf(game).tokens).find((tk) => tk.kind === 'pc' && tk.ownerPlayerId === player.id) || null;
}

/** Pool change with cap; returns applied delta. */
function bumpPool(t, key, delta) {
  const def = t.poolDefs?.[key];
  if (!def) return 0;
  const before = Number(t.pools[key]) || 0;
  let next = Math.max(0, before + delta);
  if (def.max) next = Math.min(def.max, next);
  t.pools[key] = next;
  return next - before;
}

/**
 * Side effects of a player roll: stress from a push (roll.stressGain 1–3 → tracks.stress),
 * Momentum generated (roll.momentum → pools.momentum if the pool lets players add), the TV toast.
 */
export function afterPlayerRoll(ctx, game, player, entry) {
  const { io, boardRoom, toPlayer, toDM, logTo, tableOf, pcName, getPlayerData, serializePlayers } = ctx;
  const t = tableOf(game);
  const r = entry.roll;
  const gain = int(r.stressGain, 0, 3, 0);
  if (gain && player.tracks && 'stress' in player.tracks) {
    const before = player.tracks.stress || 0;
    const max = player.trackMax?.stress;
    player.tracks.stress = Number.isFinite(max) ? Math.min(max, before + gain) : before + gain;
    if (player.tracks.stress !== before) {
      logTo(game, 'track', `${pcName(player)} STRESS ${before} → ${player.tracks.stress} (push)`, { playerId: player.id, track: 'stress' });
      toPlayer(player, 'status-updated', { player: getPlayerData(player) });
      toDM(game, 'players-updated', { players: serializePlayers(game) });
    }
  }
  const mom = int(r.momentum, 0, 20, 0);
  if (mom && t.poolDefs?.momentum?.playerAdd) {
    const applied = bumpPool(t, 'momentum', mom);
    if (applied) {
      logTo(game, 'pool', `MOMENTUM +${applied} (${pcName(player)}) → ${t.pools.momentum}`);
      emitPoolChanged(ctx, game, 'momentum', applied);
    }
  }
  io.to(boardRoom(game.code)).emit('board-roll', { roll: boardRoll(entry, pcName(player)) });
}

function emitPoolChanged(ctx, game, key, delta) {
  const { io, boardRoom, toPlayer, toDM, tableOf } = ctx;
  const t = tableOf(game);
  const evt = { key, value: t.pools[key], delta, max: t.poolDefs[key]?.max ?? null };
  toDM(game, 'pool-changed', evt);
  if (t.poolDefs[key]?.visible) {
    io.to(boardRoom(game.code)).emit('pool-changed', evt);
    for (const [, p] of game.players) toPlayer(p, 'pool-changed', evt);
  }
}

/* ─── Socket handlers ────────────────────────────────────────── */

/**
 * ctx: { io, games, dmTableGame, playerCtx, touch, emitTable, logTo, toDM, toPlayer, boardRoom,
 *        boardOf, emitBoard, serializePlayers, getPlayerData, tableOf, pcName }
 */
export function wireMechanics(socket, ctx) {
  const { io, dmTableGame, playerCtx, touch, emitTable, logTo, toDM, toPlayer, boardRoom, boardOf, emitBoard, serializePlayers, getPlayerData, tableOf, pcName } = ctx;
  const done = (game, cb, extra = {}) => { touch(game); emitTable(game); cb?.({ success: true, ...extra }); };
  const playerUpdated = (game, player) => {
    toPlayer(player, 'status-updated', { player: getPlayerData(player) });
    toDM(game, 'players-updated', { players: serializePlayers(game) });
  };
  /** DM (with payload.playerId) or the player's own socket. */
  const actorPlayer = (payload) => {
    const dmGame = dmTableGame(socket, payload);
    if (dmGame) {
      const p = dmGame.players.get(payload?.playerId);
      return p ? { game: dmGame, player: p, byDm: true } : {};
    }
    const { game, player } = playerCtx();
    return game ? { game, player, byDm: false } : {};
  };

  /* Whose turn: notify the acting player (phone banner) when it changes. */
  const lastTurnKey = new WeakMap();
  function announceTurn(game) {
    const ini = tableOf(game).initiative;
    const cur = ini?.active ? ini.order[ini.turn] : null;
    const key = cur ? `${ini.round}:${ini.turn}:${cur.id}` : '';
    if (lastTurnKey.get(game) === key) return;
    lastTurnKey.set(game, key);
    if (!cur) return;
    const p = cur.playerId ? game.players.get(cur.playerId) : null;
    if (p) toPlayer(p, 'your-turn', { round: ini.round, label: cur.label, entryId: cur.id });
    io.to(boardRoom(game.code)).emit('turn-changed', { round: ini.round, label: cur.label, tokenId: cur.tokenId });
  }
  const iniDone = (game, cb, logText) => {
    if (logText) logTo(game, 'initiative', logText);
    touch(game);
    emitTable(game);
    announceTurn(game);
    cb?.({ success: true, initiative: tableOf(game).initiative });
  };

  /* ─── DM: secret roll { roll } (creature attacks etc.; never sent to the board or players) ─── */
  socket.on('gm-roll', (payload = {}, callback) => {
    const game = dmTableGame(socket, payload);
    if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
    let roll = payload.roll;
    try { if (!roll || typeof roll !== 'object' || JSON.stringify(roll).length > 4096) return callback?.({ error: 'Invalid roll.' }); } catch { return callback?.({ error: 'Invalid roll.' }); }
    roll = JSON.parse(JSON.stringify(roll));
    const t = tableOf(game);
    const entry = { id: uid('r'), clientId: null, playerId: 'dm', playerName: 'GM', characterName: sstr(payload.who || roll.who, 60) || 'GM', roll, at: Date.now(), secret: true };
    t.rolls.push(entry);
    if (t.rolls.length > MAX_ROLLS) t.rolls.splice(0, t.rolls.length - MAX_ROLLS);
    logTo(game, 'roll', `[SECRET] ${entry.characterName}: ${sstr(roll.summary || roll.label || 'rolled', 200)}`, { secret: true });
    toDM(game, 'roll', { roll: entry });
    touch(game);
    emitTable(game, { dmOnly: true });
    callback?.({ success: true, id: entry.id });
  });

  /* ─── Player (own) / DM ({ playerId }): panic result { rollId?, total, die?, effect: { id, name, text, stressDelta, panicAction, status? } } ───
     The phone rolls d6 + Stress and looks the result up in the universe panic table; the server
     applies it: player.panic, status effect(s) (a new panic replaces the old), stress change,
     PC token ring 'panicking', log, `panic { … }` to the DM, `board-panic { tokenId, name }` to the TV. */
  socket.on('panic-result', (payload = {}, callback) => {
    const { game, player } = actorPlayer(payload);
    if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
    const e = payload.effect && typeof payload.effect === 'object' ? payload.effect : {};
    const name = sstr(e.name, 60).trim();
    if (!name) return callback?.({ error: 'Panic effect needs a name.' });
    const t = tableOf(game);
    const total = int(payload.total, 0, 40, 0);
    const effectId = typeof e.id === 'string' && /^[a-z0-9-]{1,40}$/.test(e.id) ? e.id : 'panic';
    // Idempotent per roll (outbox replays)
    const rollRef = sstr(payload.rollId, 64);
    const entry = rollRef ? t.rolls.find((r) => r.id === rollRef || r.clientId === rollRef) : null;
    if (entry?.panic) return callback?.({ success: true, duplicate: true });

    const statusList = (Array.isArray(e.status) ? e.status : e.status ? [e.status] : [])
      .map((s) => sstr(String(s), 30).trim().toUpperCase()).filter(Boolean).slice(0, 3);
    const prevPanic = player.panic;
    // A new panic effect replaces the old one (drop its named status).
    const prevNames = prevPanic?.statuses || [];
    player.statusEffects = (player.statusEffects || []).filter((s) => !prevNames.includes(s));
    for (const s of statusList) if (!player.statusEffects.includes(s)) player.statusEffects.push(s);
    player.panic = statusList.length
      ? { total, effectId, name, text: sstr(e.text, 600), panicAction: !!e.panicAction, statuses: statusList, at: Date.now() }
      : null;
    const sd = int(e.stressDelta, -3, 3, 0);
    if (sd && player.tracks && 'stress' in player.tracks) {
      const max = player.trackMax?.stress;
      const v = Math.max(0, (player.tracks.stress || 0) + sd);
      player.tracks.stress = Number.isFinite(max) ? Math.min(max, v) : v;
    }
    if (entry) entry.panic = { total, effectId, name };

    // PC token ring
    const tok = tokenOf(game, boardOf, player);
    if (tok) {
      const st = (tok.status || []).filter((s) => !s.startsWith('panicking'));
      if (statusList.length) st.unshift('panicking');
      tok.status = st.slice(0, 6);
    }
    logTo(game, 'panic', `${pcName(player)} PANIC ROLL ${total}: ${name}${sd ? ` (stress ${sd > 0 ? '+' : ''}${sd})` : ''}`, { playerId: player.id, effectId });
    touch(game);
    playerUpdated(game, player);
    const evt = { playerId: player.id, name: pcName(player), total, effect: { id: effectId, name, text: sstr(e.text, 600), panicAction: !!e.panicAction }, rollId: entry?.id || null, at: Date.now() };
    toDM(game, 'panic', evt);
    if (statusList.length) {
      io.to(boardRoom(game.code)).emit('board-panic', { tokenId: tok?.id || null, name: pcName(player), effect: name, panicAction: !!e.panicAction });
    }
    if (tok) emitBoard(game);
    emitTable(game, { dmOnly: true });
    callback?.({ success: true, panic: player.panic });
  });

  /* ─── DM: supplies { playerId, supply: { air, power, food, water } } (0–12; null removes a key) ─── */
  socket.on('supply-set', (payload = {}, callback) => {
    const game = dmTableGame(socket, payload);
    if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
    const player = game.players.get(payload.playerId);
    if (!player) return callback?.({ error: 'Unknown player.' });
    player.supply = sanitizeSupply(payload.supply, player.supply || {});
    playerUpdated(game, player);
    done(game, callback, { supply: player.supply });
  });

  /* ─── DM ({ playerId, key }) or player ({ key }): Supply roll — Stress Dice = rating (max 6), each 1 drops it a step ─── */
  socket.on('supply-roll', (payload = {}, callback) => {
    const { game, player } = actorPlayer(payload);
    if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
    const key = String(payload.key || '');
    if (!KEY_RE.test(key) || !player.supply || !(key in player.supply)) return callback?.({ error: 'Unknown supply.' });
    const before = player.supply[key];
    const dice = Array.from({ length: Math.min(before, SUPPLY_DICE_MAX) }, d6);
    const ones = dice.filter((d) => d === 1).length;
    const after = Math.max(0, before - ones);
    player.supply = { ...player.supply, [key]: after };
    const evt = { playerId: player.id, name: pcName(player), key, dice, ones, before, after, at: Date.now() };
    logTo(game, 'supply', `${pcName(player)} SUPPLY ROLL ${key.toUpperCase()} [${dice.join(' ') || '—'}] ${before} → ${after}`, { playerId: player.id, key });
    toPlayer(player, 'supply-rolled', evt);
    toDM(game, 'supply-rolled', evt);
    playerUpdated(game, player);
    done(game, callback, evt);
  });

  /* ─── DM: pool definitions + values { defs: universe.rules.pools, values?: { key: n }, reset? } ─── */
  socket.on('pools-init', (payload = {}, callback) => {
    const game = dmTableGame(socket, payload);
    if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
    const t = tableOf(game);
    const defs = sanitizePoolDefs(payload.defs);
    if (!Object.keys(defs).length) return callback?.({ error: 'No pools.' });
    t.poolDefs = defs;
    const values = payload.values && typeof payload.values === 'object' ? payload.values : {};
    const next = {};
    for (const key of Object.keys(defs)) {
      const v = payload.reset || t.pools[key] === undefined ? int(values[key], 0, 99, 0) : t.pools[key];
      next[key] = defs[key].max ? Math.min(defs[key].max, v) : v;
    }
    t.pools = next;
    logTo(game, 'pool', `Pools ${payload.reset ? 'reset' : 'set'}: ${Object.entries(next).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(', ')}`);
    done(game, callback, { pools: t.pools });
  });

  /* ─── DM: pool-set { key, value } / pool-delta { key, delta } (capped at max, floor 0) ─── */
  const poolChange = (payload, callback, absolute) => {
    const game = dmTableGame(socket, payload);
    if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
    const t = tableOf(game);
    const key = String(payload.key || '');
    if (!t.poolDefs?.[key]) return callback?.({ error: 'Unknown pool.' });
    const before = Number(t.pools[key]) || 0;
    const delta = absolute ? int(payload.value, 0, 99, before) - before : int(payload.delta, -99, 99, 0);
    const applied = bumpPool(t, key, delta);
    if (applied) {
      logTo(game, 'pool', `${t.poolDefs[key].label} ${applied > 0 ? '+' : ''}${applied} → ${t.pools[key]}${payload.reason ? ` (${sstr(payload.reason, 80)})` : ''}`);
      emitPoolChanged(ctx, game, key, applied);
    }
    done(game, callback, { key, value: t.pools[key], applied });
  };
  socket.on('pool-set', (payload = {}, cb) => poolChange(payload, cb, true));
  socket.on('pool-delta', (payload = {}, cb) => poolChange(payload, cb, false));

  /* ─── Initiative (DM) ───
     init-set { initiative: { active?, order?, turn?, round? } } replace (sanitized)
     init-step { dir: 1|-1 }  next marks the current actor done; past the end starts a new round
     init-goto { index }      GM nominates who acts next (Dune) / jump
     init-round {}            new round: round+1, turn 0, done/fast/slow cleared (cards kept)
     init-end {}              tracker off (order kept)
     Player: init-pass { toId } — the acting PC hands the turn to an ally who has not acted. */
  socket.on('init-set', (payload = {}, callback) => {
    const game = dmTableGame(socket, payload);
    if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
    const t = tableOf(game);
    const wasActive = t.initiative?.active;
    t.initiative = sanitizeInitiative(payload.initiative, game, t.initiative);
    iniDone(game, callback, !wasActive && t.initiative.active ? `Initiative: round ${t.initiative.round} — ${t.initiative.order.map((e) => `${e.card ? e.card + ' ' : ''}${e.label}`).join(', ')}` : null);
  });
  socket.on('init-step', (payload = {}, callback) => {
    const game = dmTableGame(socket, payload);
    if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
    const ini = tableOf(game).initiative;
    if (!ini?.order?.length) return callback?.({ error: 'No initiative order.' });
    ini.active = true;
    let text = null;
    if (Number(payload.dir) < 0) {
      ini.turn = Math.max(0, ini.turn - 1);
      ini.order[ini.turn].done = false;
    } else {
      ini.order[ini.turn].done = true;
      if (ini.turn + 1 >= ini.order.length) {
        ini.round += 1;
        ini.turn = 0;
        for (const e of ini.order) Object.assign(e, { done: false, fast: false, slow: false });
        text = `Initiative: round ${ini.round}`;
      } else ini.turn += 1;
    }
    iniDone(game, callback, text);
  });
  socket.on('init-goto', (payload = {}, callback) => {
    const game = dmTableGame(socket, payload);
    if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
    const ini = tableOf(game).initiative;
    const i = Number(payload.index);
    if (!ini?.order?.[i]) return callback?.({ error: 'Unknown entry.' });
    if (payload.markDone !== false && ini.active && ini.order[ini.turn] && ini.turn !== i) ini.order[ini.turn].done = true;
    ini.active = true;
    ini.turn = i;
    ini.order[i].done = false;
    iniDone(game, callback);
  });
  socket.on('init-round', (payload = {}, callback) => {
    const game = dmTableGame(socket, payload);
    if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
    const ini = tableOf(game).initiative;
    ini.round += 1;
    ini.turn = 0;
    for (const e of ini.order) Object.assign(e, { done: false, fast: false, slow: false });
    iniDone(game, callback, `Initiative: round ${ini.round}`);
  });
  socket.on('init-end', (payload = {}, callback) => {
    const game = dmTableGame(socket, payload);
    if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
    tableOf(game).initiative.active = false;
    iniDone(game, callback, 'Initiative ended');
  });
  socket.on('init-pass', (payload = {}, callback) => {
    const { game, player } = playerCtx();
    if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
    const ini = tableOf(game).initiative;
    const cur = ini?.active ? ini.order[ini.turn] : null;
    if (!cur || cur.playerId !== player.id) return callback?.({ error: 'NOT YOUR TURN.' });
    const i = ini.order.findIndex((e) => e.id === payload.toId);
    const to = ini.order[i];
    if (!to || to.done || to.kind !== 'pc' || i === ini.turn) return callback?.({ error: 'Cannot pass to them.' });
    cur.done = true;
    ini.turn = i;
    iniDone(game, callback, `${cur.label} passes the turn to ${to.label}`);
  });

  /* ─── DM: critical injuries { playerId, injury: { id?, name, text, roll?, fatal?, healTime? } } / remove { playerId, uid } ─── */
  socket.on('injury-add', (payload = {}, callback) => {
    const game = dmTableGame(socket, payload);
    if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
    const player = game.players.get(payload.playerId);
    if (!player) return callback?.({ error: 'Unknown player.' });
    const inj = sanitizeInjury(payload.injury);
    if (!inj) return callback?.({ error: 'Injury needs a name.' });
    player.injuries = [...(player.injuries || []), inj].slice(-MAX_INJURIES);
    logTo(game, 'injury', `${pcName(player)} suffers ${inj.roll ? `#${inj.roll} ` : ''}${inj.name}${inj.fatal ? ' (FATAL)' : ''}`, { playerId: player.id });
    playerUpdated(game, player);
    done(game, callback, { injury: inj });
  });
  socket.on('injury-remove', (payload = {}, callback) => {
    const game = dmTableGame(socket, payload);
    if (!game) return callback?.({ error: 'NOT AUTHORIZED.' });
    const player = game.players.get(payload.playerId);
    if (!player) return callback?.({ error: 'Unknown player.' });
    const list = player.injuries || [];
    const inj = list.find((i) => i.uid === payload.uid || i.id === payload.uid);
    if (!inj) return callback?.({ error: 'Unknown injury.' });
    player.injuries = list.filter((i) => i !== inj);
    logTo(game, 'injury', `${pcName(player)} healed: ${inj.name}`, { playerId: player.id });
    playerUpdated(game, player);
    done(game, callback);
  });
}

/** Clearing PANICKED on the DM side (update-player) also clears the panic record + token ring. */
export function clearPanicIfGone(game, player, boardOf) {
  if (!player.panic) return false;
  if ((player.statusEffects || []).some((s) => player.panic.statuses?.includes(s))) return false;
  player.panic = null;
  const tok = tokenOf(game, boardOf, player);
  if (tok?.status?.some((s) => s.startsWith('panicking'))) {
    tok.status = tok.status.filter((s) => !s.startsWith('panicking'));
    return true;
  }
  return false;
}
