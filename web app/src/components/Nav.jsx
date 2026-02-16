import React from 'react';

const sections = [
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'characters', label: 'Characters' },
  { id: 'maps', label: 'Maps' },
  { id: 'dice', label: 'Dice Roller' },
  { id: 'cheats', label: 'Cheat Sheets' },
  { id: 'aliens', label: 'Xenomorphs' },
];

export default function Nav({ active, onChange }) {
  return (
    <nav className="nav">
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
