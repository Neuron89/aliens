import React, { useMemo, useState } from 'react';
import { useGame } from '../../GameContext';
import { useUniverse } from '../../UniverseContext';
import { buildRecap, downloadText } from './recap';
import { fmtTime } from '../../rulesUtils';

const FILTERS = [
  ['all', 'ALL'], ['scene', 'SCENES'], ['handout', 'HANDOUTS'], ['clue', 'CLUES'], ['clock', 'CLOCKS'],
  ['track', 'TRACKS'], ['loot', 'LOOT'], ['note', 'NOTES'], ['pause', 'PAUSES'], ['roll', 'ROLLS'],
];
const MATCH = { scene: ['scene', 'act', 'narration'], track: ['track', 'kill', 'character'] };

/* GM session log (server/sessionLog.js): filter, add notes, mark endings, export a Markdown recap. */
export default function SessionLogPanel({ pack }) {
  const { sessionLog, logNote, players, table, gameCode } = useGame();
  const { universe } = useUniverse();
  const [filter, setFilter] = useState('all');
  const [note, setNote] = useState('');
  const [ending, setEnding] = useState('');

  const rows = useMemo(() => {
    const types = MATCH[filter] || [filter];
    return [...sessionLog].reverse().filter((e) => filter === 'all' || types.includes(e.type)).slice(0, 300);
  }, [sessionLog, filter]);

  const exportRecap = () => {
    const md = buildRecap({
      title: pack?.meta?.title || `${universe.terms?.session || 'Session'} ${gameCode}`,
      universeName: universe.name, code: gameCode, players, table, log: sessionLog, terms: universe.terms,
    });
    const day = new Date().toISOString().slice(0, 10);
    downloadText(md, `recap-${(pack?.id || 'session')}-${day}.md`);
  };

  return (
    <div className="run-log">
      <div className="run-row">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter log">
          {FILTERS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
        </select>
        <button type="button" className="run-btn primary sm" onClick={exportRecap}>EXPORT RECAP</button>
      </div>
      <form className="run-row" onSubmit={(e) => { e.preventDefault(); if (note.trim()) { logNote(note.trim()); setNote(''); } }}>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note to the log…" maxLength={2000} style={{ flex: 1 }} />
        <button type="submit" className="run-btn sm" disabled={!note.trim()}>ADD NOTE</button>
      </form>
      {pack?.endings?.length > 0 && (
        <div className="run-row">
          <select value={ending} onChange={(e) => setEnding(e.target.value)} aria-label="Ending reached" style={{ flex: 1 }}>
            <option value="">Ending reached…</option>
            {pack.endings.map((e) => <option key={e.title} value={e.title}>{e.title}</option>)}
          </select>
          <button type="button" className="run-btn sm" disabled={!ending} onClick={() => { logNote(`ENDING: ${ending}`); setEnding(''); }}>MARK</button>
        </div>
      )}
      <ol className="run-log-list">
        {rows.length === 0 && <li className="run-empty">Nothing logged yet.</li>}
        {rows.map((e) => (
          <li key={e.id} className={`run-log-row t-${e.type}`}>
            <time>{fmtTime(e.at)}</time>
            <span className="run-log-type">{e.type.toUpperCase()}</span>
            <span className="run-log-text">{e.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
