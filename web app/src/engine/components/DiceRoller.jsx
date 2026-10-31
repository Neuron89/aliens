import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useUniverse } from '../UniverseContext';
import { useGame } from '../GameContext';
import './board/dice-stage.css';

/* Dispatches to the active universe's dice roller (universe.rules.dice.Roller).
   Every roller accepts `preset` { attr, skill, bonus, label, attrKey?, skillKey?, stress?, kind?, total?, at? }
   (pre-fills the pool / target and shows the label), `compact`, and `onResult(roll)`
   — called once per settled roll with { kind, label, summary, successes, flags[], dice, … }
   (ARCHITECTURE.md "Mechanics wave").
   GM Dice Roller tab (no onResult from the caller): while a session is live the GM picks where
   each roll goes with a 3-way segmented control (F7):
     TV      (default) `gm-roll` secret:false → GM roll feed + session log AND the table screen's
             dice animation (board/DiceStage.jsx) for everyone to see
     SECRET  `gm-roll` secret:true → GM roll feed + session log only, never the TV or the phones
     LOCAL   nothing is sent; the roll stays on this screen */
const ROUTES = [
  { key: 'tv', label: 'TV', note: 'Everyone sees the roll animate on the table screen. Also logged to your roll feed.' },
  { key: 'secret', label: 'SECRET', note: 'Results go to your roll feed and session log only — never the TV or the phones.' },
  { key: 'local', label: 'LOCAL', note: 'Results stay on this screen. Nothing is sent or logged.' },
];

export default function DiceRoller(props) {
  const { universe } = useUniverse();
  const { role, gameCode, gmRoll } = useGame();
  const [route, setRoute] = useState('tv');
  const [sent, setSent] = useState(null);
  const sentTimer = useRef(null);
  useEffect(() => () => clearTimeout(sentTimer.current), []);
  const Roller = universe.rules?.dice?.Roller;
  const gmTab = !props.onResult && role === 'dm' && !!gameCode;

  const routeRef = useRef(route);
  routeRef.current = route;
  const onRouted = useCallback((roll) => {
    const secret = routeRef.current !== 'tv';
    gmRoll(roll, 'GM', (r) => {
      setSent(r?.success ? (secret ? 'SENT TO YOUR ROLL FEED (SECRET)' : 'ON THE TABLE SCREEN') : `NOT SENT: ${r?.error || 'no link'}`);
      clearTimeout(sentTimer.current);
      sentTimer.current = setTimeout(() => setSent(null), 3500);
    }, { secret });
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
  const cur = ROUTES.find((r) => r.key === route) || ROUTES[0];
  return (
    <>
      <div className="dr-secret" role="group" aria-label="Where this roll goes">
        <div className="dr-route" role="group" aria-label="Roll destination">
          {ROUTES.map((r) => (
            <button key={r.key} type="button" className={`dr-route-btn k-${r.key}${route === r.key ? ' on' : ''}`}
              aria-pressed={route === r.key} onClick={() => setRoute(r.key)}>
              <span className="dr-secret-box" aria-hidden="true">{route === r.key ? '■' : '□'}</span> {r.label}
            </button>
          ))}
        </div>
        <span className="dr-secret-note">{cur.note}</span>
        {sent && <span className="dr-secret-sent" role="status">{sent}</span>}
      </div>
      <Roller {...props} onResult={route === 'local' ? undefined : onRouted} />
    </>
  );
}
