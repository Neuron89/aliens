import React from 'react';
import { useGame } from '../context/GameContext';

const sections = [
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'characters', label: 'Characters' },
  { id: 'maps', label: 'Maps' },
  { id: 'dice', label: 'Dice Roller' },
  { id: 'cheats', label: 'Cheat Sheets' },
  { id: 'aliens', label: 'Xenomorphs' },
];

export default function Nav({ active, onChange, isDM }) {
  const { unreadCount, players } = useGame();
  const playerCount = Object.keys(players).length;

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
          Session ({playerCount})
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: '-4px', right: '-4px',
              width: '8px', height: '8px', borderRadius: '50%',
              background: '#c04040', boxShadow: '0 0 6px #c04040',
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
