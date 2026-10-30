import React, { useEffect, useState } from 'react';
import { useGame } from '../../GameContext';
import ClockRing from '../run/ClockRing';
import { useTypewriter } from '../player/fx';

/* ═══════════════════════════════════════════════════════════════
   TV overlay layer (mounted by BoardView over the map).
   Driven by the board's filtered `table` (server tableView 'board'):
   - narration  caption → lower-third over the map; card → full-screen
                theatre card with title + text (+ art), typewriter reveal
   - boardMode  'theatre' → act/scene title card (theatre.art full-bleed)
   - clocks     visible progress clocks, corner stack
   - pause      calm full-screen PAUSE card (X-card) until the GM clears it
   - board-flash { tokenId } → ring flash on that token (CSS class on the
                [data-token] element MapCanvas renders)
   Board text sizes follow docs/RESEARCH_GM_PLAYER_EXPERIENCE.md §(d).
   ═══════════════════════════════════════════════════════════════ */

function ArtBg({ src }) {
  const [ok, setOk] = useState(true);
  useEffect(() => setOk(true), [src]);
  if (!src || !ok) return null;
  return <img className="ov-art" src={src} alt="" onError={() => setOk(false)} />;
}

function Caption({ n }) {
  const shown = useTypewriter(n.text, { key: n.id });
  return (
    <div className="ov-caption" key={n.id} role="status" aria-live="polite">
      {n.title && <div className="ov-caption-title">{n.title}</div>}
      <p className="ov-caption-text">{shown}<span className="ov-caret" aria-hidden="true" /></p>
    </div>
  );
}

function Card({ title, subtitle, text, art, id }) {
  const shown = useTypewriter(text, { key: id });
  return (
    <div className={`ov-card${art ? ' has-art' : ''}`} key={id}>
      <ArtBg src={art} />
      <div className="ov-card-inner">
        {subtitle && <div className="ov-card-sub">{subtitle}</div>}
        {title && <h1 className="ov-card-title">{title}</h1>}
        {text && <p className="ov-card-text">{shown}</p>}
      </div>
    </div>
  );
}

export default function Overlays({ terminalName }) {
  const { table, on } = useGame();

  /* Token ring flash on loot (board-flash). */
  useEffect(() => on('board-flash', ({ tokenId } = {}) => {
    if (!tokenId) return;
    const el = document.querySelector(`.bv-root [data-token="${CSS.escape(tokenId)}"]`);
    if (!el) return;
    el.classList.remove('tk-flash');
    void el.getBoundingClientRect();
    el.classList.add('tk-flash');
    setTimeout(() => el.classList.remove('tk-flash'), 2600);
  }), [on]);

  if (!table) return null;
  const n = table.narration;
  const theatre = table.boardMode === 'theatre';
  const clocks = table.clocks || [];

  return (
    <div className="ov-root" aria-hidden={false}>
      {theatre && !(n && n.mode === 'card') && (
        <Card id={`th-${table.theatre?.title}-${table.theatre?.subtitle}`}
          title={table.theatre?.subtitle || table.theatre?.title || terminalName}
          subtitle={table.theatre?.subtitle ? table.theatre?.title : ''} art={table.theatre?.art} text="" />
      )}
      {n && n.mode === 'card' && <Card id={n.id} title={n.title || table.theatre?.title} subtitle={n.title ? table.theatre?.title : ''} text={n.text} art={n.art || (theatre ? table.theatre?.art : null)} />}
      {n && n.mode !== 'card' && <Caption n={n} />}

      {clocks.length > 0 && (
        <div className="ov-clocks">
          {clocks.map((c) => (
            <div key={c.id} className={`ov-clock k-${c.kind}${c.filled === c.segments ? ' full' : ''}`}>
              <ClockRing segments={c.segments} filled={c.filled} kind={c.kind} size={92} title={c.label} />
              <div className="ov-clock-label">{c.label}</div>
              <div className="ov-clock-n">{c.filled}/{c.segments}</div>
            </div>
          ))}
        </div>
      )}

      {table.pause && (
        <div className="ov-pause" role="alert">
          <div className="ov-pause-inner">
            <div className="ov-pause-mark" aria-hidden="true">❚❚</div>
            <h1>PAUSE</h1>
            <p>Take a breath. We will pick up when everyone is ready.</p>
          </div>
        </div>
      )}
    </div>
  );
}
