import React from 'react';
import { useGame } from '../../GameContext';

/* Live roll feed — STUB for backlog row 10 (next wave).
   Renders table.rolls (server buffer of `player-roll` results, newest last) when
   present. A roll is whatever the universe roller passes to useGame().sendRoll():
   { summary?, label?, successes?, flags?: string[] … }. */
export default function RollFeed({ limit = 8 }) {
  const { table } = useGame();
  const rolls = (table?.rolls || []).slice(-limit).reverse();
  return (
    <section className="run-box run-rollfeed">
      <header className="run-box-head"><h3>ROLL FEED</h3></header>
      {rolls.length === 0 ? (
        <p className="run-empty">Rolls from the phones appear here.</p>
      ) : (
        <ol className="run-log-list">
          {rolls.map((r) => (
            <li key={r.id} className="run-log-row">
              <time>{new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</time>
              <span className="run-log-type">{(r.characterName || r.playerName || '?').toUpperCase()}</span>
              <span className="run-log-text">
                {r.roll?.summary || r.roll?.label || 'rolled'}
                {Array.isArray(r.roll?.flags) && r.roll.flags.map((f) => <b key={f} className="run-flag"> {String(f).toUpperCase()}</b>)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
