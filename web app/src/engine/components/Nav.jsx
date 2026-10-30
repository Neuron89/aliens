import React, { useEffect } from 'react';
import { useGame } from '../GameContext';
import { useUniverse } from '../UniverseContext';
import { useFx } from './player/fx';

/* Core sections every universe gets; universe.navSections are appended. */
export const CORE_SECTIONS = [
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'characters', label: 'Characters' },
  { id: 'maps', label: 'Maps' },
  { id: 'dice', label: 'Dice Roller' },
];

/* DM-wide banner for the anonymous X-card: neutral wording, a soft chime, nothing
   about who pressed it. Also flags pending player-built characters. */
function DmAlerts({ onChange }) {
  const { table, pauseClear, on } = useGame();
  const { play } = useFx();
  useEffect(() => on('pause-requested', () => play('pause')), [on, play]);
  useEffect(() => on('character-submitted', () => play('seen')), [on, play]);
  const pending = (table?.submissions || []).filter((s) => s.status === 'pending').length;
  return (
    <>
      {table?.pause && (
        <div className="dm-pause" role="alert">
          <span className="dm-pause-mark" aria-hidden="true">❚❚</span>
          <span><b>PAUSE REQUESTED</b> — someone at the table needs a moment. No reason needed; check in, adjust, continue.</span>
          <button type="button" className="run-btn primary" onClick={() => pauseClear()}>RESUME PLAY</button>
        </div>
      )}
      {pending > 0 && (
        <button type="button" className="dm-subs" onClick={() => onChange('session')}>
          {pending} PLAYER-BUILT CHARACTER{pending > 1 ? 'S' : ''} WAITING — REVIEW
        </button>
      )}
    </>
  );
}

export default function Nav({ active, onChange, isDM }) {
  const { unreadCount, players, table } = useGame();
  const { universe } = useUniverse();
  const playerCount = Object.keys(players).length;
  const sections = [...(isDM ? [{ id: 'board', label: 'Board' }] : []), ...CORE_SECTIONS, ...(universe.navSections || []).map(({ id, label }) => ({ id, label }))];

  return (
    <>
      <nav className="nav">
        {isDM && (
          <button className={active === 'run' ? 'active' : ''} onClick={() => onChange('run')}
            style={{ position: 'relative', borderColor: active === 'run' ? 'var(--accent)' : undefined }}>
            Run
            {table?.pause && <span className="nav-dot warn" aria-label="Pause requested" />}
          </button>
        )}
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
      {isDM && <DmAlerts onChange={onChange} />}
    </>
  );
}
