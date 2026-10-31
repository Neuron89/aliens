import React, { useMemo, useState } from 'react';
import { useGame } from '../../GameContext';
import { fmtTime } from '../../rulesUtils';

/* ═══════════════════════════════════════════════════════════════
   NARRATE drawer (Focus Stage dock, key `n`): free caption / card
   composer for the TV and phones, what is on the table now (CLEAR),
   TV mode MAP | THEATRE, and the recent narration from the session
   log (tap USE to put a line back in the composer).
   ═══════════════════════════════════════════════════════════════ */
export default function NarrateDrawer({ onToggleTheatre, focusInput = false }) {
  const { narrate, narrateClear, table, sessionLog } = useGame();
  const [text, setText] = useState('');
  const narration = table?.narration;
  const theatre = table?.boardMode === 'theatre';
  const recent = useMemo(() => [...(sessionLog || [])].reverse().filter((e) => e.type === 'narration').slice(0, 12), [sessionLog]);
  const send = (mode) => {
    if (!text.trim()) return;
    narrate(text.trim(), { mode });
    setText('');
  };
  return (
    <div className="nd">
      <form onSubmit={(e) => { e.preventDefault(); send('caption'); }}>
        <label className="fs-label" htmlFor="nd-text">NARRATE TO TABLE</label>
        <textarea id="nd-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} data-autofocus={focusInput ? '' : undefined}
          placeholder="Type a line for the TV and phones…"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send('caption'); } }} />
        <div className="nd-btns">
          <button type="submit" className="fs-btn primary" disabled={!text.trim()}>SEND CAPTION</button>
          <button type="button" className="fs-btn" disabled={!text.trim()} onClick={() => send('card')}>SEND AS CARD</button>
        </div>
        <p className="nd-hint">CAPTION runs along the bottom of the TV; CARD fills the screen. Ctrl+Enter sends a caption.</p>
      </form>

      <div className="fs-label">ON THE TABLE NOW</div>
      {narration ? (
        <div className="nd-now">
          <p>{narration.title ? <b>{narration.title}: </b> : null}{narration.text}</p>
          <button type="button" className="run-btn warn" onClick={() => narrateClear()}>CLEAR TABLE TEXT</button>
        </div>
      ) : <p className="run-empty">Nothing — the TV shows the board.</p>}

      <div className="fs-label">TV SHOWS</div>
      <div className="run-seg nd-seg" role="group" aria-label="Board mode">
        <button type="button" className={!theatre ? 'on' : ''} aria-pressed={!theatre} onClick={() => theatre && onToggleTheatre()}>MAP</button>
        <button type="button" className={theatre ? 'on' : ''} aria-pressed={theatre} onClick={() => !theatre && onToggleTheatre()}>THEATRE</button>
      </div>

      <div className="fs-label">RECENT</div>
      {recent.length === 0 ? <p className="run-empty">No narration sent yet.</p> : (
        <ol className="nd-recent">
          {recent.map((e) => (
            <li key={e.id}>
              <time>{fmtTime(e.at)}</time>
              <span>{e.text}</span>
              <button type="button" className="run-btn sm" onClick={() => setText(e.text.replace(/^[^:]{1,120}:\s/, ''))} aria-label={`Use again: ${e.text.slice(0, 60)}`}>USE</button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
