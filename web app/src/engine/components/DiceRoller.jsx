import React from 'react';
import { useUniverse } from '../UniverseContext';

/* Dispatches to the active universe's dice roller (universe.rules.dice.Roller). */
export default function DiceRoller() {
  const { universe } = useUniverse();
  const Roller = universe.rules?.dice?.Roller;
  if (!Roller) {
    return (
      <div className="panel">
        <h2>DICE ROLLER</h2>
        <p style={{ color: 'var(--text-dim)' }}>No dice roller is registered for {universe.name}.</p>
      </div>
    );
  }
  return <Roller />;
}
