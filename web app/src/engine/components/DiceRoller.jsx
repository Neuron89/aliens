import React from 'react';
import { useUniverse } from '../UniverseContext';

/* Dispatches to the active universe's dice roller (universe.rules.dice.Roller).
   Every roller accepts `preset` { attr, skill, bonus, label, attrKey?, skillKey? }
   (pre-fills the pool / target and shows the label) plus roller-specific props. */
export default function DiceRoller(props) {
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
  return <Roller {...props} />;
}
