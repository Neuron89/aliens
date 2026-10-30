import React from 'react';
import { useUniverse } from '../UniverseContext';
import { useGame } from '../GameContext';

const DOTS = ['green', 'amber', 'green'];

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
        {(terminal.statusLines || []).map((line, i) => (
          <span key={line}><span className={`status-dot ${DOTS[i % DOTS.length]}`}></span>{line}</span>
        ))}
        <span className={`link-indicator ${live ? 'up' : 'down'}`} role="status" aria-live="polite">
          <span className="link-dot" />
          {live ? 'LINK' : 'RECONNECTING…'}
        </span>
      </div>
    </header>
  );
}
