import React, { useCallback, useState } from 'react';
import { useUniverse } from '../UniverseContext';
import { useGame } from '../GameContext';

/* Dispatches to the active universe's dice roller (universe.rules.dice.Roller).
   Every roller accepts `preset` { attr, skill, bonus, label, attrKey?, skillKey?, stress?, kind?, total?, at? }
   (pre-fills the pool / target and shows the label), `compact`, and `onResult(roll)`
   — called once per settled roll with { kind, label, summary, successes, flags[], dice, … }
   (ARCHITECTURE.md "Mechanics wave").
   GM Dice Roller tab (no onResult from the caller): while a session is live the GM gets a
   SECRET (GM ONLY) toggle — ON routes each result through `gm-roll` (GM roll feed + session
   log, never the TV or the phones); OFF keeps the roll on this screen only. */
export default function DiceRoller(props) {
  const { universe } = useUniverse();
  const { role, gameCode, gmRoll } = useGame();
  const [secret, setSecret] = useState(false);
  const [sent, setSent] = useState(null);
  const Roller = universe.rules?.dice?.Roller;
  const gmTab = !props.onResult && role === 'dm' && !!gameCode;

  const onSecretResult = useCallback((roll) => {
    gmRoll(roll, 'GM', (r) => {
      setSent(r?.success ? 'SENT TO YOUR ROLL FEED (SECRET)' : `NOT LOGGED: ${r?.error || 'no link'}`);
      setTimeout(() => setSent(null), 3500);
    });
  }, [gmRoll]);

  if (!Roller) {
    return (
      <div className="panel">
        <h2>DICE ROLLER</h2>
        <p style={{ color: 'var(--text-dim)' }}>No dice roller is registered for {universe.name}.</p>
      </div>
    );
  }
  if (!gmTab) return <Roller {...props} />;
  return (
    <>
      <div className="dr-secret" role="group" aria-label="Where this roll goes">
        <button type="button" className={`dr-secret-toggle${secret ? ' on' : ''}`} aria-pressed={secret} onClick={() => setSecret((s) => !s)}>
          <span className="dr-secret-box" aria-hidden="true">{secret ? '■' : '□'}</span> SECRET (GM ONLY)
        </button>
        <span className="dr-secret-note">
          {secret
            ? 'Results go to your roll feed and session log only — never the TV or the phones.'
            : 'Results stay on this screen. Turn SECRET on to log them privately.'}
        </span>
        {sent && <span className="dr-secret-sent" role="status">{sent}</span>}
      </div>
      <Roller {...props} onResult={secret ? onSecretResult : undefined} />
    </>
  );
}
