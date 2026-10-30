import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGame, boardCodeForTab } from '../GameContext';
import { useUniverse } from '../UniverseContext';
import MapCanvas from './board/MapCanvas';
import Overlays from './board/Overlays';
import { useAmbientAudio } from '../hooks/useAmbientAudio';
import { ambientPreset } from '../mechanicsUtils';
import { qrPath } from './board/qr';

/* ═══════════════════════════════════════════════════════════════
   BoardView — the `board` role: a TV lying flat on the table
   (docs/BOARD_AND_BUILDER.md §5). URL /?board=CODE, no chrome.
   Black background, map fitted with a 2 px margin honoring
   board.view (rotation / flipX / zoom), status strip on the bottom
   edge, screen wake lock, any tap → fullscreen. Reconnects on its
   own (GameContext re-sends join-board on every socket connect).
   ═══════════════════════════════════════════════════════════════ */

/* Before a map is up, the table screen doubles as the join screen: players scan this
   with their phone (the TV was opened on the host's LAN address, so origin is reachable). */
function JoinQr({ code }) {
  const url = `${window.location.origin}/?join=${code}`;
  const qr = useMemo(() => { try { return qrPath(url); } catch { return null; } }, [url]);
  if (!qr) return null;
  return (
    <div className="bv-join">
      <svg className="bv-join-qr" viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges" role="img" aria-label={`QR code for ${url}`}>
        <rect width={qr.size} height={qr.size} fill="#fff" />
        <path d={qr.d} fill="#000" />
      </svg>
      <div className="bv-join-text">SCAN TO JOIN<small>{url}</small></div>
    </div>
  );
}

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

const wantsAudio = () => { try { return new URLSearchParams(window.location.search).get('audio') === '1'; } catch { return false; } };

/* TV ambient (only with ?board=CODE&audio=1): follows table.ambient (the GM's scene preset). */
function BoardAudio({ ambient }) {
  const audio = useAmbientAudio();
  const { applyPreset, presets, preset } = audio;
  useEffect(() => {
    const id = ambient ? ambientPreset(ambient, presets) : 'off';
    if (id && id !== preset) applyPreset(id);
  }, [ambient]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function BoardView() {
  const { board, mapDef, gameCode, connected, reconnecting, pings, boardError, joinBoard, role, on, table } = useGame();
  const [flash, setFlash] = useState({}); // tokenId -> key (TokenChip flash prop)
  const [audioOn] = useState(wantsAudio);
  useEffect(() => {
    const hit = (tokenId) => {
      if (!tokenId) return;
      const k = Date.now();
      setFlash((f) => ({ ...f, [tokenId]: k }));
      setTimeout(() => setFlash((f) => {
        if (f[tokenId] !== k) return f;
        const next = { ...f };
        delete next[tokenId];
        return next;
      }), 2600);
    };
    const offs = [on('board-flash', (e) => hit(e?.tokenId)), on('board-panic', (e) => hit(e?.tokenId))];
    return () => offs.forEach((f) => f());
  }, [on]);
  const activeTokenId = table?.initiative?.active ? table.initiative.current?.tokenId || null : null;
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

  /* Clocks / pools stack on the right edge: keep the map out from under them (an ASCII map fills the
     whole TV and its right column was unreadable behind the clock cards). */
  const hasRail = role === 'board' && table?.boardMode !== 'theatre' && ((table?.clocks?.length || 0) + (table?.pools?.length || 0)) > 0;
  return (
    <div className={`bv-root${hasRail ? ' bv-has-rail' : ''}`} ref={rootRef} onPointerDown={goFullscreen}>
      <div className="bv-stage">
        {board?.mapId && mapDef ? (
          <MapCanvas className="bv-canvas" mapDef={mapDef} board={board} role="board" universe={universe}
            view={board.view} pings={pings} flashTokens={flash} activeTokenId={activeTokenId} />
        ) : (
          <div className="bv-wait">
            <div className="bv-term">{terminalName}</div>
            <div className="bv-big-code">{code || '----'}</div>
            <div className="bv-sub">{role === 'board' ? 'BOARD LINKED — WAITING FOR THE GAME MASTER TO SELECT A MAP' : 'CONNECTING…'}</div>
            {role === 'board' && code && <JoinQr code={code} />}
          </div>
        )}
        {role === 'board' && <Overlays terminalName={terminalName} />}
        {role === 'board' && audioOn && <BoardAudio ambient={table?.ambient || null} />}
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
