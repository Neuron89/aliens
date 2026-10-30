import React from 'react';
import { useUniverse } from '../UniverseContext';
import { useGame } from '../GameContext';
import { play } from '../sfx';

const LINK_RE = /UPLINK|LINK|CHANNEL|COMMS/i;

/** REDUCE FX + MUTE toggles (per device, localStorage). Reusable by any view (e.g. the player gear menu). */
export function FxToggles({ className = 'fx-toggles' }) {
  const { fx } = useUniverse();
  if (!fx) return null;
  return (
    <div className={className} role="group" aria-label="Effects">
      <button type="button" className="fx-toggle" aria-pressed={fx.reduced} onClick={() => fx.setReduced(!fx.reduced)}
        title="Turn off overlays, animations and transitions on this device">
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 6h10M3 3h6M3 9h6" stroke="currentColor" strokeWidth="1.4" fill="none" /></svg>
        {fx.reduced ? 'FX REDUCED' : 'REDUCE FX'}
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
        {fx.muted ? 'MUTED' : 'SOUND'}
      </button>
    </div>
  );
}

export default function Header() {
  const { display } = useUniverse();
  const { connected, reconnecting } = useGame();
  const { terminal } = display;
  const live = connected && !reconnecting;

  return (
    <header className="header">
      <h1>{terminal.name}</h1>
      <p className="subtitle">{terminal.subtitle}</p>
      <div className="status-bar">
        {(terminal.statusLines || []).map((line) => {
          /* Status lines stay truthful: a link/channel line is amber unless the socket is up. */
          const linkLine = LINK_RE.test(line);
          const dot = linkLine && !live ? 'amber' : 'green'; // one colour = one meaning: amber only for caution
          return <span key={line}><span className={`status-dot ${dot}`}></span>{linkLine && !live ? line.replace(/ACTIVE|OPEN|READY/i, 'STANDBY') : line}</span>;
        })}
        <span className={`link-indicator ${live ? 'up' : 'down'}`} role="status" aria-live="polite">
          <span className="link-dot" />
          {live ? 'LINK' : 'RECONNECTING…'}
        </span>
      </div>
      <FxToggles />
    </header>
  );
}
