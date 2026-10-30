import React, { useState } from 'react';
import { useGame } from '../../GameContext';
import TargetPicker, { toTarget } from './TargetPicker';

/* Clues/secrets: pack clues (seeded into table.clues) + ad-hoc ones.
   One-tap reveal to everyone or the selected players (who are credited as
   finders); GM sees found-by and who still has nothing. `highlight` = clue ids
   referenced by the current scene (shown first). */
export default function CluesPanel({ highlight = [] }) {
  const { table, players, clueReveal, clueHide, clueUpsert } = useGame();
  const [targets, setTargets] = useState({});
  const [adhoc, setAdhoc] = useState(null);
  const clues = table?.clues || [];
  const nameOf = (id) => players?.[id]?.character?.name || players?.[id]?.name || '?';
  const sorted = [...clues].sort((a, b) => (highlight.includes(b.id) - highlight.includes(a.id)) || ((a.status === 'revealed') - (b.status === 'revealed')));
  const found = clues.filter((c) => c.status === 'revealed').length;

  return (
    <div className="run-clues">
      <div className="run-dim" style={{ marginBottom: '0.4rem' }}>{found}/{clues.length} FOUND</div>
      {clues.length === 0 && <p className="run-empty">No clues yet. Packs can define clues[]; add ad-hoc ones below.</p>}
      {sorted.map((c) => {
        const revealed = c.status === 'revealed';
        return (
          <div key={c.id} className={`run-item${revealed ? ' sent' : ''}${highlight.includes(c.id) ? ' here' : ''}`}>
            <div className="run-item-head static">
              <span className="run-item-title">{c.text}</span>
              {revealed ? <span className="run-receipt all">FOUND</span> : <span className="run-receipt none">HIDDEN</span>}
            </div>
            <div className="run-item-when">
              {c.source && <>SOURCE: {c.source}</>}{c.source && c.scene && ' · '}{c.scene && <>SCENE: {c.scene}</>}
              {highlight.includes(c.id) && <b className="run-accent"> · IN THIS SCENE</b>}
              {c.adhoc && ' · AD-HOC'}
            </div>
            {revealed && (
              <div className="run-dim">
                {c.foundBy.length ? `Found by ${c.foundBy.map(nameOf).join(', ')}` : 'Revealed'} · shared with {c.revealedTo === 'all' ? 'everyone' : (c.revealedTo || []).map(nameOf).join(', ')}
              </div>
            )}
            <TargetPicker players={players} value={targets[c.id] || []} onChange={(v) => setTargets((t) => ({ ...t, [c.id]: v }))} />
            <div className="run-row">
              <button type="button" className="run-btn primary sm" onClick={() => clueReveal(c.id, toTarget(targets[c.id]))}>{revealed ? 'SHARE MORE' : 'REVEAL'}</button>
              {revealed && <button type="button" className="run-btn sm" onClick={() => clueHide(c.id)}>UN-REVEAL</button>}
            </div>
          </div>
        );
      })}
      {adhoc !== null ? (
        <form className="run-form" onSubmit={(e) => {
          e.preventDefault();
          if (!adhoc.text.trim()) return;
          clueUpsert({ text: adhoc.text.trim(), source: adhoc.source.trim() });
          setAdhoc(null);
        }}>
          <textarea value={adhoc.text} onChange={(e) => setAdhoc({ ...adhoc, text: e.target.value })} placeholder="What do they learn?" rows={2} autoFocus />
          <input value={adhoc.source} onChange={(e) => setAdhoc({ ...adhoc, source: e.target.value })} placeholder="Source (optional)" />
          <div className="run-row">
            <button type="submit" className="run-btn primary sm">ADD CLUE</button>
            <button type="button" className="run-btn sm" onClick={() => setAdhoc(null)}>CANCEL</button>
          </div>
        </form>
      ) : (
        <button type="button" className="run-btn sm" onClick={() => setAdhoc({ text: '', source: '' })}>+ AD-HOC CLUE</button>
      )}
    </div>
  );
}
