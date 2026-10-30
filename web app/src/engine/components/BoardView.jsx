import React, { useEffect, useRef, useState } from 'react';
import { useGame, boardCodeForTab } from '../GameContext';
import { useUniverse } from '../UniverseContext';
import MapCanvas from './board/MapCanvas';
import Overlays from './board/Overlays';

/* ═══════════════════════════════════════════════════════════════
   BoardView — the `board` role: a TV lying flat on the table
   (docs/BOARD_AND_BUILDER.md §5). URL /?board=CODE, no chrome.
   Black background, map fitted with a 2 px margin honoring
   board.view (rotation / flipX / zoom), status strip on the bottom
   edge, screen wake lock, any tap → fullscreen. Reconnects on its
   own (GameContext re-sends join-board on every socket connect).
   ═══════════════════════════════════════════════════════════════ */

function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined;
    let lock = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (document.visibilityState !== 'visible') return;
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) lock.release().catch(() => {});
      } catch { /* not allowed (no gesture / not secure context) */ }
    };
    acquire();
    const onVis = () => { if (document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pointerdown', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointerdown', acquire);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

export default function BoardView() {
  const { board, mapDef, gameCode, connected, reconnecting, pings, boardError, joinBoard, role } = useGame();
  const { universe } = useUniverse();
  const [fullscreen, setFullscreen] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  const [codeInput, setCodeInput] = useState('');
  const rootRef = useRef(null);
  useWakeLock(true);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('board-mode');
    return () => document.documentElement.classList.remove('board-mode');
  }, []);

  const goFullscreen = () => {
    if (document.fullscreenElement) return;
    const el = document.documentElement;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {});
  };

  const code = gameCode || boardCodeForTab();
  const terminalName = universe?.terminal?.name || 'GAME TERMINAL';
  const title = mapDef ? `${mapDef.title}${board?.level && mapDef.levels ? ` · ${mapDef.levels.find((l) => l.id === board.level)?.label || board.level}` : ''}` : '';

  /* No game: enter a code (only shown when the URL had none or the game is gone). */
  if (role !== 'board' && !reconnecting && (boardError || !code)) {
    return (
      <div className="bv-root bv-standby">
        <div className="bv-card">
          <div className="bv-term">{terminalName} — TABLE BOARD</div>
          {boardError && <div className="bv-error">{boardError}</div>}
          <form onSubmit={(e) => {
            e.preventDefault();
            const c = codeInput.trim().toUpperCase();
            if (!c) return;
            window.history.replaceState(null, '', `/?board=${c}`);
            joinBoard(c);
          }}>
            <input className="bv-code-input" value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              maxLength={4} placeholder="CODE" aria-label="Session code" autoFocus />
            <button className="bv-btn" type="submit">CONNECT</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="bv-root" ref={rootRef} onPointerDown={goFullscreen}>
      <div className="bv-stage">
        {board?.mapId && mapDef ? (
          <MapCanvas className="bv-canvas" mapDef={mapDef} board={board} role="board" universe={universe}
            view={board.view} pings={pings} />
        ) : (
          <div className="bv-wait">
            <div className="bv-term">{terminalName}</div>
            <div className="bv-big-code">{code || '----'}</div>
            <div className="bv-sub">{role === 'board' ? 'BOARD LINKED — WAITING FOR THE GAME MASTER TO SELECT A MAP' : 'CONNECTING…'}</div>
          </div>
        )}
        {role === 'board' && <Overlays terminalName={terminalName} />}
      </div>
      <div className="bv-strip">
        <span className="bv-strip-term">{terminalName}</span>
        <span>SESSION {code}</span>
        {title && <span className="bv-strip-title">{title.toUpperCase()}</span>}
        <span className="bv-spacer" />
        {!fullscreen && <span className="bv-hint">TAP FOR FULLSCREEN</span>}
        <span className={`bv-link${connected && role === 'board' ? ' up' : ''}`}>
          <span className="link-dot" />{connected ? (role === 'board' ? 'LINK' : 'JOINING…') : 'RECONNECTING…'}
        </span>
      </div>
    </div>
  );
}
