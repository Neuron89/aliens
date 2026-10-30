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
  const { table, pauseClear, on, poolDelta, seatClaims = [], resolveSeatClaim } = useGame();
  const { universe } = useUniverse();
  const { play } = useFx();
  /* A seat claim waits ~2 min for an answer: chime once per new claim so the GM notices it from any tab. */
  const claimIds = seatClaims.map((c) => c.claimId).join(',');
  useEffect(() => { if (claimIds) play('alert'); }, [claimIds, play]);
  const [prompts, setPrompts] = useState([]); // { id, kind:'complication'|'panic', who, text }
  useEffect(() => on('pause-requested', () => play('pause')), [on, play]);
  useEffect(() => on('character-submitted', () => play('seen')), [on, play]);
  const push = (p) => setPrompts((prev) => [...prev.filter((x) => x.id !== p.id), p].slice(-3));
  const drop = (id) => setPrompts((prev) => prev.filter((x) => x.id !== id));
  /* Dune complication → red flash + "THREAT +1?" (never auto-applied). */
  useEffect(() => on('roll', ({ roll } = {}) => {
    if (!roll || roll.secret || !roll.roll?.flags?.includes('complication')) return;
    push({ id: roll.id, kind: 'complication', who: roll.characterName || roll.playerName, text: roll.roll.label || '', n: Math.max(1, Math.min(5, Number(roll.roll.complications) || 1)) });
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
      {/* Seat claims: a device asks for an existing seat by name (shown on every DM tab — the RUN tab is
          where the GM lives during play, and an unanswered claim expires). */}
      {seatClaims.length > 0 && (
        <div className="panel dm-claims" role="alert">
          {seatClaims.map((c) => (
            <div key={c.claimId} className="dm-claim">
              <span>
                A DEVICE ASKS FOR <b>{String(c.name).toUpperCase()}</b>'S SEAT
                {c.seatConnected ? ` — THAT ${universe.terms.player.toUpperCase()} IS STILL ONLINE` : ''}
              </span>
              <span className="dm-claim-actions">
                <button type="button" className="run-btn primary sm" onClick={() => resolveSeatClaim(c.claimId, true)}>APPROVE</button>
                <button type="button" className="run-btn sm danger" onClick={() => resolveSeatClaim(c.claimId, false)}>REJECT</button>
              </span>
            </div>
          ))}
          <p className="dm-claim-hint">APPROVE ONLY IF IT IS REALLY THEM: THE SEAT'S CHARACTER AND PRIVATE MESSAGES MOVE TO THE NEW DEVICE.</p>
        </div>
      )}
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
                  <span><b>{p.n > 1 ? `${p.n} COMPLICATIONS` : 'COMPLICATION'}</b> — {p.who}{p.text ? ` · ${p.text}` : ''}. {hasThreat ? `THREAT +${p.n}?` : ''}</span>
                  {hasThreat && <button type="button" className="run-btn sm primary" onClick={() => { poolDelta('threat', p.n, `complication (${p.who})`); drop(p.id); }}>+{p.n} THREAT</button>}
                  {hasThreat && <button type="button" className="run-btn sm" onClick={() => { poolDelta('threat', 2 * p.n, `complication converted (${p.who})`); drop(p.id); }}>+{2 * p.n} (CONVERT)</button>}
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
