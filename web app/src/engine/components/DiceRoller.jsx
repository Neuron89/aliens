import React from 'react';
import { useUniverse } from '../UniverseContext';

/* Dispatches to the active universe's dice roller (universe.rules.dice.Roller).
   Every roller accepts `preset` { attr, skill, bonus, label, attrKey?, skillKey?, stress?, kind?, total?, at? }
   (pre-fills the pool / target and shows the label), `compact`, and `onResult(roll)`
   — called once per settled roll with { kind, label, summary, successes, flags[], dice, … }
   (ARCHITECTURE.md "Mechanics wave"). The GM's Dice Roller tab passes no onResult. */
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
