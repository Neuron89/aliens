import React, { useState } from 'react';
import { useGame } from '../../GameContext';

/* Anonymous X-card / PAUSE on every phone. One tap opens a tiny confirm (so a
   pocket tap does not stop the game); the GM only ever sees "PAUSE REQUESTED". */
export default function PauseButton() {
  const { requestPause, table, connected } = useGame();
  const [confirming, setConfirming] = useState(false);
  const [sent, setSent] = useState(false);
  const paused = !!table?.paused;

  const send = () => {
    requestPause(() => setSent(true));
    setConfirming(false);
    setTimeout(() => setSent(false), 4000);
  };

  return (
    <>
      <button type="button" className={`ph-pause-btn${paused ? ' on' : ''}`} aria-label="Pause the game (anonymous)"
        onClick={() => setConfirming(true)} disabled={!connected}>
        <span aria-hidden="true">❚❚</span> {paused ? 'PAUSED' : 'PAUSE'}
      </button>
      {confirming && (
        <div className="ph-overlay" onClick={() => setConfirming(false)} role="dialog" aria-modal="true" aria-labelledby="ph-xc">
          <div className="ph-card ph-xcard" onClick={(e) => e.stopPropagation()}>
            <h2 id="ph-xc" className="ph-card-title">PAUSE THE GAME?</h2>
            <p>The table stops and takes a breath. Nobody is told who asked, and you never need a reason.</p>
            <button type="button" className="pv-btn primary ph-wide" onClick={send}>YES — PAUSE</button>
            <button type="button" className="pv-btn ph-wide" onClick={() => setConfirming(false)}>CANCEL</button>
          </div>
        </div>
      )}
      {sent && <div className="ph-toast-mini" role="status">PAUSE SENT — ANONYMOUS</div>}
    </>
  );
}
