import React from 'react';
import { useGame } from '../../GameContext';

/* ═══════════════════════════════════════════════════════════════
   Roll feed (backlog row 10) — RUN right rail + DM "ROLLS" tab.
   table.rolls (server, ≤ 200, newest last): phone rolls (`player-roll`)
   and GM secret rolls (`gm-roll`, secret: true — never on the TV).
   Each row: time · who · skill · pool · result glyphs · flags
   (panic / complication / crit / botch / push) · panic outcome.
   A roll is what the universe roller passes to onResult:
   { kind, label, summary, successes?, flags[], dice: { base[], stress[], d20[] }, pool? }.
   ═══════════════════════════════════════════════════════════════ */
const FLAG_CLASS = { panic: 'danger', botch: 'danger', complication: 'danger', crit: 'good', push: 'warn' };

function Glyphs({ dice, kind }) {
  if (!dice) return null;
  const base = dice.base || [];
  const stress = dice.stress || [];
  const d20 = dice.d20 || [];
  return (
    <span className="rf-dice" aria-hidden="true">
      {base.map((d, i) => <i key={`b${i}`} className={`rf-d b${d === 6 ? ' hit' : ''}`}>{d}</i>)}
      {stress.map((d, i) => <i key={`s${i}`} className={`rf-d s${d === 6 ? ' hit' : ''}${d === 1 ? ' bad' : ''}`}>{d}</i>)}
      {d20.map((d, i) => <i key={`t${i}`} className={`rf-d t${kind === '2d20' && d === 20 ? ' bad' : ''}${d === 1 ? ' hit' : ''}`}>{d}</i>)}
    </span>
  );
}

function poolText(r) {
  if (r.pool && (r.pool.base != null || r.pool.stress != null)) return `${r.pool.base ?? 0}+${r.pool.stress ?? 0}S`;
  if (r.dice?.d20?.length) return `${r.dice.d20.length}d20${r.target ? ` ≤${r.target}` : ''}`;
  return '';
}

export function RollRow({ e }) {
  const r = e.roll || {};
  const flags = Array.isArray(r.flags) ? r.flags : [];
  return (
    <li className={`rf-row${e.secret ? ' secret' : ''}${flags.includes('panic') || flags.includes('botch') ? ' bad' : flags.includes('crit') ? ' good' : ''}`}>
      <time>{new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</time>
      <span className="rf-who">{e.secret && <b className="rf-secret">SECRET </b>}{(e.characterName || e.playerName || '?').toUpperCase()}</span>
      <span className="rf-what">
        <b className="rf-label">{r.label || 'ROLL'}</b>
        {poolText(r) && <span className="rf-pool">{poolText(r)}</span>}
        <Glyphs dice={r.dice} kind={r.kind} />
        <span className="rf-result">
          {r.successes != null ? `${r.successes} SUCCESS${r.successes === 1 ? '' : 'ES'}` : (r.summary || '')}
          {r.kind === '2d20' && r.passed != null ? (r.passed ? ' · PASS' : ' · FAIL') : ''}
          {r.momentum ? ` · +${r.momentum} MOM` : ''}
        </span>
        {flags.map((f) => <b key={f} className={`rf-flag ${FLAG_CLASS[f] || ''}`}>{String(f).toUpperCase()}</b>)}
        {e.panic && <b className="rf-flag danger">→ PANIC {e.panic.total}: {String(e.panic.name).toUpperCase()}</b>}
      </span>
    </li>
  );
}

export default function RollFeed({ limit = 8, title = 'ROLL FEED', className = '' }) {
  const { table } = useGame();
  const all = table?.rolls || [];
  const rolls = (limit ? all.slice(-limit) : all).slice().reverse();
  return (
    <section className={`run-box run-rollfeed ${className}`}>
      <header className="run-box-head"><h3>{title}</h3>{all.length > 0 && <span className="run-dim">{all.length}</span>}</header>
      {rolls.length === 0 ? (
        <p className="run-empty">Rolls from the phones (and your secret rolls) appear here.</p>
      ) : (
        <ol className="rf-list">{rolls.map((e) => <RollRow key={e.id} e={e} />)}</ol>
      )}
    </section>
  );
}
