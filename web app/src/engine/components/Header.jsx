import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useUniverse } from '../UniverseContext';
import { useGame } from '../GameContext';
import { useContent } from '../ContentContext';
import { play } from '../sfx';
import Confirm from './Confirm';
import { qrPath } from './board/qr';
import { useDismiss } from './run/Drawer';

/** REDUCE FX + MUTE toggles (per device, localStorage). Reusable by any view (e.g. the player gear menu). */
export function FxToggles({ className = 'fx-toggles' }) {
  const { fx } = useUniverse();
  if (!fx) return null;
  return (
    <div className={className} role="group" aria-label="Effects">
      <button type="button" className="fx-toggle" aria-pressed={fx.reduced} onClick={() => fx.setReduced(!fx.reduced)}
        title="Turn off overlays, animations and transitions on this device">
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 6h10M3 3h6M3 9h6" stroke="currentColor" strokeWidth="1.4" fill="none" /></svg>
        <span className="fx-l">{fx.reduced ? 'FX REDUCED' : 'REDUCE FX'}</span>
      </button>
      <button type="button" className="fx-toggle" aria-pressed={fx.muted}
        onClick={() => { const next = !fx.muted; fx.setMuted(next); if (!next) play('ui.confirm'); }}
        title="Interface sounds on this device">
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M1 4.5h2.2L6 2v8L3.2 7.5H1z" fill="currentColor" />
          {fx.muted
            ? <path d="M8 4l3 4M11 4l-3 4" stroke="currentColor" strokeWidth="1.2" />
            : <path d="M8 4.2q1.2 1.8 0 3.6M9.6 3q2 3 0 6" stroke="currentColor" strokeWidth="1.1" fill="none" />}
        </svg>
        <span className="fx-l">{fx.muted ? 'MUTED' : 'SOUND'}</span>
      </button>
    </div>
  );
}

/** ◂ UNIVERSES — back to the landing from anywhere on the GM terminal. With a live session it asks first
    and SUSPENDS (the session stays saved and resumable; nothing is ended). */
export function UniversesButton({ align = 'left' }) {
  const { chosen, resetUniverse, universe } = useUniverse();
  const { role, gameCode, suspendGame } = useGame();
  if (!chosen) return null;
  const label = <><span aria-hidden="true">◂ </span>UNIVERSES</>;
  if (role === 'dm' && gameCode) {
    const session = universe.terms?.session || 'session';
    return (
      <Confirm label={label} className="header-back" align={align} title="LEAVE TO THE UNIVERSE SCREEN?"
        message={`The ${session.toLowerCase()} stays saved and the ${(universe.terms?.players || 'players').toLowerCase()} keep their seats. Come back through RESUME on the session screen (this terminal keeps the host key), or take over from another terminal with the PIN.`}
        confirmLabel="LEAVE — KEEP SAVED" cancelLabel="STAY"
        onConfirm={() => { play('ui.confirm'); suspendGame(); resetUniverse(); }} />
    );
  }
  return (
    <button type="button" className="header-back" onClick={() => { play('ui.confirm'); resetUniverse(); }}
      title="Back to the universe selection">{label}</button>
  );
}

function Qr({ text, label }) {
  const qr = useMemo(() => { try { return qrPath(text); } catch { return null; } }, [text]);
  if (!qr) return null;
  return (
    <svg className="strip-qr" viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges" role="img" aria-label={label}>
      <rect width={qr.size} height={qr.size} fill="#fff" />
      <path d={qr.d} fill="#000" />
    </svg>
  );
}

/* Session code: big and tappable → join link, QR, copy, and the TV board link. */
function CodeButton({ code, terms }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(null);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const joinUrl = `${origin}/?join=${code}`;
  const boardUrl = `${origin}/?board=${code}`;
  const copy = (text, what) => {
    navigator.clipboard?.writeText(text).then(() => setCopied(what), () => setCopied('fail'));
    setTimeout(() => setCopied(null), 1800);
  };
  return (
    <span className="strip-pop-wrap" ref={ref}>
      <button type="button" className="strip-code" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}
        title="Join code: tap for the link and QR">
        <span className="strip-code-k">CODE</span>{code}
      </button>
      {open && (
        <div className="strip-pop" role="dialog" aria-label="Join this session">
          <div className="strip-pop-head">{(terms.players || 'Players').toUpperCase()} JOIN WITH</div>
          <div className="strip-pop-code">{code}</div>
          <Qr text={joinUrl} label={`QR code for ${joinUrl}`} />
          <div className="strip-pop-url">{joinUrl}</div>
          <div className="strip-pop-btns">
            <button type="button" className="run-btn primary" onClick={() => copy(joinUrl, 'link')}>{copied === 'link' ? 'COPIED' : 'COPY JOIN LINK'}</button>
            <button type="button" className="run-btn" onClick={() => copy(code, 'code')}>{copied === 'code' ? 'COPIED' : 'COPY CODE'}</button>
          </div>
          <div className="strip-pop-head">TABLE TV</div>
          <div className="strip-pop-btns">
            <a className="run-btn" href={`/?board=${code}`} target="_blank" rel="noreferrer">OPEN BOARD HERE</a>
            <button type="button" className="run-btn" onClick={() => copy(boardUrl, 'board')}>{copied === 'board' ? 'COPIED' : 'COPY TV LINK'}</button>
          </div>
        </div>
      )}
    </span>
  );
}

/* GM PIN: shown once after INITIALIZE until NOTED, otherwise hidden behind a tap. */
function PinChip({ terms }) {
  const { gmPin, pinFresh, hidePin } = useGame();
  const [show, setShow] = useState(false);
  if (!gmPin) return null;
  if (pinFresh || show) {
    return (
      <span className={`strip-pin on${pinFresh ? ' fresh' : ''}`} title={`Lets another terminal take over as ${terms.gm}. Never share it with ${terms.players.toLowerCase()}.`}>
        <span className="strip-k">PIN</span><b>{gmPin}</b>
        <button type="button" className="strip-pin-x" onClick={() => { setShow(false); hidePin(); }}>{pinFresh ? 'NOTED' : 'HIDE'}</button>
      </span>
    );
  }
  return (
    <button type="button" className="strip-pin" onClick={() => setShow(true)} aria-label="Show the GM PIN">
      <span className="strip-k">PIN</span><span aria-hidden="true">••••••</span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STATUS STRIP (44px) — replaces the old 200px header.
   GM with a live session: wordmark · scenario + act · CODE (tap → link/QR)
   · PIN (tap) · crew online · TV · LINK · ◂ UNIVERSES · REDUCE FX · SOUND.
   Pre-session (SessionScreen): wordmark · subtitle · LINK · UNIVERSES · FX.
   ═══════════════════════════════════════════════════════════════ */
export default function Header({ onNavigate }) {
  const { display, universe } = useUniverse();
  const { connected, reconnecting, role, gameCode, packId, players, table, boardLinked } = useGame();
  const { byId } = useContent();
  const { terminal } = display;
  const terms = universe.terms;
  const live = connected && !reconnecting;
  const dmLive = role === 'dm' && Boolean(gameCode);
  const pack = packId ? byId[packId] : null;
  const actIndex = table?.run?.actIndex ?? 0;
  const act = pack?.acts?.[actIndex];
  const playerList = Object.values(players || {});
  const online = playerList.filter((p) => p.connected !== false).length;

  return (
    <header className="strip">
      <span className="strip-mark">{terminal.name}</span>
      {dmLive ? (
        <span className="strip-ctx" title={pack ? `${pack.meta.title}${act ? ` · ${act.title}` : ''}` : 'Sandbox'}>
          <b>{pack ? pack.meta.title : 'SANDBOX'}</b>
          {act && <span className="strip-ctx-act"> · {act.title}{act.subtitle ? ` ${act.subtitle}` : ''}</span>}
        </span>
      ) : (
        <span className="strip-ctx dim">{terminal.subtitle}</span>
      )}
      <span className="strip-fill" />
      {dmLive && (
        <>
          <CodeButton code={gameCode} terms={terms} />
          <PinChip terms={terms} />
          <button type="button" className="strip-chip" onClick={() => onNavigate?.('session')}
            title={`${online} of ${playerList.length} ${terms.players.toLowerCase()} online — open the ${terms.players.toLowerCase()} dashboard`}>
            <span className={`strip-dot${online ? ' up' : ''}`} aria-hidden="true" />
            {online}/{playerList.length}<span className="strip-wide"> {terms.players.toUpperCase()}</span>
          </button>
          <span className={`strip-chip static${boardLinked ? ' up' : ''}`} title={boardLinked ? 'Table TV linked' : 'No table TV attached'}>
            <span className={`strip-dot${boardLinked ? ' up' : ''}`} aria-hidden="true" />
            TV<span className="strip-wide">{boardLinked ? ' LINKED' : ''}</span>
          </span>
        </>
      )}
      <span className={`link-indicator strip-chip static ${live ? 'up' : 'down'}`} role="status" aria-live="polite">
        <span className="link-dot" />
        {live ? 'LINK' : 'RECONNECTING…'}
      </span>
      <UniversesButton align="right" />
      <FxToggles className="fx-toggles strip-fx" />
    </header>
  );
}
