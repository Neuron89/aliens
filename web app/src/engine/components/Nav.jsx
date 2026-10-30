import React, { useEffect, useState } from 'react';
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
  const { table, pauseClear, on, poolDelta } = useGame();
  const { play } = useFx();
  const [prompts, setPrompts] = useState([]); // { id, kind:'complication'|'panic', who, text }
  useEffect(() => on('pause-requested', () => play('pause')), [on, play]);
  useEffect(() => on('character-submitted', () => play('seen')), [on, play]);
  const push = (p) => setPrompts((prev) => [...prev.filter((x) => x.id !== p.id), p].slice(-3));
  const drop = (id) => setPrompts((prev) => prev.filter((x) => x.id !== id));
  /* Dune complication → red flash + "THREAT +1?" (never auto-applied). */
  useEffect(() => on('roll', ({ roll } = {}) => {
    if (!roll || roll.secret || !roll.roll?.flags?.includes('complication')) return;
    push({ id: roll.id, kind: 'complication', who: roll.characterName || roll.playerName, text: roll.roll.label || '' });
    play('alert');
  }), [on, play]);
  /* Panic result → GM sees the effect (public to the GM, private on the table). */
  useEffect(() => on('panic', (p) => {
    if (!p) return;
    push({ id: `panic-${p.playerId}-${p.at}`, kind: 'panic', who: p.name, text: `${p.total}: ${p.effect?.name || ''}`, detail: p.effect?.text || '' });
    play('alert');
    if (!p.effect?.panicAction) setTimeout(() => drop(`panic-${p.playerId}-${p.at}`), 12000);
  }), [on, play]);
  const hasThreat = !!table?.poolDefs?.threat;
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
      {prompts.length > 0 && (
        <div className="dm-prompts" role="alert">
          {prompts.map((p) => (
            <div key={p.id} className={`dm-prompt k-${p.kind}`}>
              {p.kind === 'complication' ? (
                <>
                  <span><b>COMPLICATION</b> — {p.who}{p.text ? ` · ${p.text}` : ''}. {hasThreat ? 'THREAT +1?' : ''}</span>
                  {hasThreat && <button type="button" className="run-btn sm primary" onClick={() => { poolDelta('threat', 1, `complication (${p.who})`); drop(p.id); }}>+1 THREAT</button>}
                  {hasThreat && <button type="button" className="run-btn sm" onClick={() => { poolDelta('threat', 2, `complication converted (${p.who})`); drop(p.id); }}>+2 (CONVERT)</button>}
                </>
              ) : (
                <span><b>PANIC</b> — {p.who} {p.text}{p.detail ? <small> {p.detail}</small> : null}</span>
              )}
              <button type="button" className="run-btn sm" onClick={() => drop(p.id)} aria-label="Dismiss">✕</button>
            </div>
          ))}
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
