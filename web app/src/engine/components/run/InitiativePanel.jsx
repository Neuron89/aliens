import React, { useEffect, useState } from 'react';
import { useGame } from '../../GameContext';
import { useUniverse } from '../../UniverseContext';

/* ═══════════════════════════════════════════════════════════════
   INITIATIVE (backlog rows 26, 27) — RUN rail tab + DM tab.
   table.initiative = { active, order[{ id, kind, label, tokenId?, playerId?, card?, done, fast, slow }], turn, round }.
   Adapters from universe.rules.initiative:
     mode 'cards'    (ALIEN) DRAW CARDS deals unique cards 1..deck, lowest acts first;
                     fast/slow action pips per combatant (tap to spend).
     mode 'nominate' (DUNE) the GM nominates who acts next (tap a row); KEEP THE
                     INITIATIVE spends keepCost Momentum (players) or Threat (GM).
   NEXT/PREV/NEW ROUND/END. The acting phone shows YOUR TURN; the TV rings the token.
   ═══════════════════════════════════════════════════════════════ */
const uid = () => `ini-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function shuffle(a) {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}

export default function InitiativePanel() {
  const { table, players, board, initSet, initStep, initGoto, initRound, initEnd, poolDelta, boardSync } = useGame();
  useEffect(() => { if (!board) boardSync(); }, [board, boardSync]);
  const { universe } = useUniverse();
  const cfg = universe.rules?.initiative || { mode: 'nominate' };
  const cards = cfg.mode === 'cards';
  const ini = table?.initiative || { active: false, order: [], turn: 0, round: 1 };
  const order = ini.order || [];
  const [custom, setCustom] = useState('');
  const put = (patch) => initSet({ ...ini, ...patch });

  const pcEntries = () => Object.values(players || {}).filter((p) => p.character && p.alive !== false).map((p) => {
    const tok = Object.values(board?.tokens || {}).find((t) => t.kind === 'pc' && t.ownerPlayerId === p.id);
    return { id: `pc-${p.id}`, kind: 'pc', label: p.character.name, playerId: p.id, tokenId: tok?.id || null };
  });
  const threatEntries = () => Object.values(board?.tokens || {}).filter((t) => t.kind === 'creature' || t.kind === 'npc')
    .map((t) => ({ id: `tk-${t.id}`.slice(0, 40), kind: t.kind, label: t.label || t.kind.toUpperCase(), tokenId: t.id }));
  const addEntries = (list) => {
    const have = new Set(order.map((e) => e.id));
    const next = [...order, ...list.filter((e) => !have.has(e.id)).map((e) => ({ done: false, fast: false, slow: false, card: null, ...e }))];
    put({ order: next });
  };
  const addCustom = (e) => {
    e.preventDefault();
    if (!custom.trim()) return;
    addEntries([{ id: uid(), kind: 'npc', label: custom.trim() }]);
    setCustom('');
  };
  const remove = (id) => {
    const i = order.findIndex((e) => e.id === id);
    const next = order.filter((e) => e.id !== id);
    put({ order: next, turn: Math.min(i < ini.turn ? ini.turn - 1 : ini.turn, Math.max(0, next.length - 1)) });
  };
  const patchEntry = (id, patch) => put({ order: order.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const draw = () => {
    const deck = cfg.deck || 10;
    const pool = shuffle(Array.from({ length: Math.max(deck, order.length) }, (_, i) => (i % deck) + 1));
    const dealt = order.map((e, i) => ({ ...e, card: pool[i], done: false, fast: false, slow: false }));
    dealt.sort((a, b) => a.card - b.card || (a.kind === 'pc' ? -1 : 1));
    initSet({ active: true, order: dealt, turn: 0, round: ini.active ? ini.round : 1 });
  };
  const start = () => initSet({ ...ini, active: true, turn: 0, round: ini.round || 1 });
  const keep = (pool) => {
    const cost = cfg.keepCost || 2;
    const have = table?.pools?.[pool] ?? 0;
    if (have < cost) { alert(`Not enough ${pool.toUpperCase()} (${have}/${cost}).`); return; }
    poolDelta(pool, -cost, 'Keep the Initiative');
  };
  const gmTakes = () => {
    const cost = cfg.keepCost || 2;
    if ((table?.pools?.threat ?? 0) < cost) { alert(`Not enough THREAT (${table?.pools?.threat ?? 0}/${cost}).`); return; }
    const i = order.findIndex((e, j) => j !== ini.turn && e.kind !== 'pc' && !e.done);
    if (i < 0) { alert('No NPC left to act this round.'); return; }
    poolDelta('threat', -cost, 'GM takes the initiative');
    initGoto(i);
  };

  return (
    <div className="ini">
      <div className="ini-head">
        <span className="rs-label">{ini.active ? `ROUND ${ini.round}` : 'INITIATIVE'}{cards ? ` · CARDS 1–${cfg.deck || 10}` : ' · NOMINATE NEXT'}</span>
        <span className="run-row">
          <button type="button" className="run-btn sm" onClick={() => addEntries(pcEntries())}>+ PCS</button>
          <button type="button" className="run-btn sm" onClick={() => addEntries(threatEntries())}>+ BOARD THREATS</button>
        </span>
      </div>
      <form className="ini-add" onSubmit={addCustom}>
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add NPC / creature…" aria-label="Add combatant" />
        <button type="submit" className="run-btn sm" disabled={!custom.trim()}>ADD</button>
      </form>

      {order.length === 0 ? (
        <p className="run-empty">Add the PCs and the threats on the board, then {cards ? 'DRAW CARDS' : 'START'}.</p>
      ) : (
        <ol className="ini-list">
          {order.map((e, i) => {
            const cur = ini.active && i === ini.turn;
            return (
              <li key={e.id} className={`ini-row k-${e.kind}${cur ? ' cur' : ''}${e.done ? ' done' : ''}`}>
                {cards && <span className="ini-card" title="Initiative card">{e.card ?? '–'}</span>}
                <button type="button" className="ini-name" onClick={() => initGoto(i)} title={cards ? 'Jump to' : 'Nominate: acts next'}>
                  {cur && <span className="ini-arrow" aria-hidden="true">▶</span>}
                  {e.label}
                  <small>{e.kind.toUpperCase()}{e.done ? ' · DONE' : ''}</small>
                </button>
                {cards && (
                  <span className="ini-pips" role="group" aria-label="Actions">
                    <button type="button" className={`ini-pip${e.fast ? ' used' : ''}`} onClick={() => patchEntry(e.id, { fast: !e.fast })} aria-pressed={e.fast}>FAST</button>
                    <button type="button" className={`ini-pip slow${e.slow ? ' used' : ''}`} onClick={() => patchEntry(e.id, { slow: !e.slow })} aria-pressed={e.slow}>SLOW</button>
                  </span>
                )}
                <button type="button" className="ini-x" aria-label={`Remove ${e.label}`} onClick={() => remove(e.id)}>×</button>
              </li>
            );
          })}
        </ol>
      )}

      {order.length > 0 && (
        <div className="ini-controls">
          {cards
            ? <button type="button" className="run-btn sm primary" onClick={draw}>{ini.active ? 'REDRAW' : 'DRAW CARDS'}</button>
            : !ini.active && <button type="button" className="run-btn sm primary" onClick={start}>START</button>}
          <button type="button" className="run-btn sm" onClick={() => initStep(-1)} disabled={!ini.active}>◂ PREV</button>
          <button type="button" className="run-btn sm primary" onClick={() => initStep(1)} disabled={!ini.active}>NEXT ▸</button>
          <button type="button" className="run-btn sm" onClick={() => initRound()} disabled={!ini.active}>END ROUND</button>
          <button type="button" className="run-btn sm warn" onClick={() => initEnd()} disabled={!ini.active}>END</button>
        </div>
      )}
      {!cards && ini.active && table?.poolDefs && Object.keys(table.poolDefs).length > 0 && (
        <div className="ini-controls">
          <button type="button" className="run-btn sm" onClick={() => keep('momentum')}>KEEP INITIATIVE ({cfg.keepCost || 2} MOMENTUM)</button>
          <button type="button" className="run-btn sm warn" onClick={gmTakes}>GM TAKES IT ({cfg.keepCost || 2} THREAT)</button>
        </div>
      )}
    </div>
  );
}
