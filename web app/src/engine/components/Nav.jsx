import React from 'react';
import { useGame } from '../GameContext';
import { useUniverse } from '../UniverseContext';

/* Core sections every universe gets; universe.navSections are appended. */
export const CORE_SECTIONS = [
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'characters', label: 'Characters' },
  { id: 'maps', label: 'Maps' },
  { id: 'dice', label: 'Dice Roller' },
];

export default function Nav({ active, onChange, isDM }) {
  const { unreadCount, players } = useGame();
  const { universe } = useUniverse();
  const playerCount = Object.keys(players).length;
  const sections = [...(isDM ? [{ id: 'board', label: 'Board' }] : []), ...CORE_SECTIONS, ...(universe.navSections || []).map(({ id, label }) => ({ id, label }))];

  return (
    <nav className="nav">
      {isDM && (
        <button
          className={active === 'session' ? 'active' : ''}
          onClick={() => onChange('session')}
          style={{
            position: 'relative',
            borderColor: active === 'session' ? 'var(--accent)' : undefined,
          }}
        >
          {universe.terms.session} ({playerCount})
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: '-4px', right: '-4px',
              width: '8px', height: '8px', borderRadius: '50%',
              background: 'var(--danger)', boxShadow: '0 0 6px var(--danger)',
            }} />
          )}
        </button>
      )}
      {sections.map(s => (
        <button
          key={s.id}
          className={active === s.id ? 'active' : ''}
          onClick={() => onChange(s.id)}
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}
