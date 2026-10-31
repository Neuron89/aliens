import React, { useEffect, useState } from 'react';
import { useGame } from '../../GameContext';
import { useUniverse } from '../../UniverseContext';
import CluesPanel from './CluesPanel';
import SessionLogPanel from './SessionLogPanel';
import Confirm from '../Confirm';

/* ═══════════════════════════════════════════════════════════════
   MORE drawer (Focus Stage dock): AGENDAS (each seat's agenda for
   this act + SEND AGENDA CARDS) · NPCS (wants / if ignored / secrets)
   · CLUES · LOG (notes, endings, EXPORT RECAP) · SAFETY (session zero,
   pause) · END (end the session for everyone).
   ═══════════════════════════════════════════════════════════════ */
export default function MoreDrawer({ pack, act, actIndex, sceneClueIds = [], onResendOrders, tab: tabProp, onTab }) {
  const { players, table, pauseClear, leaveGame } = useGame();
  const { universe } = useUniverse();
  const { terms } = universe;
  const [showSecrets, setShowSecrets] = useState(false);
  const tab = tabProp || 'agendas';
  const assigned = Object.values(players || {}).filter((p) => p.character);
  const sentOrders = (pid) => (table?.orders?.[pid] || []).some((o) => o.actIndex === actIndex);
  const safety = table?.safety;
  const tabs = [
    ['agendas', 'AGENDAS'],
    ['npcs', `NPCS${pack?.npcs?.length ? ` · ${pack.npcs.length}` : ''}`],
    ['clues', 'CLUES'],
    ['log', 'LOG'],
    ['safety', table?.pause ? 'SAFETY ●' : 'SAFETY'],
    ['end', 'END'],
  ];
  useEffect(() => { if (!tabs.some(([id]) => id === tab)) onTab('agendas'); });

  return (
    <div className="md">
      <div className="md-tabs" role="tablist" aria-label="More">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => onTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'agendas' && (
        <div className="run-agendas" role="tabpanel" aria-label="Agendas">
          {assigned.length > 0 ? (
            <>
              <div className="md-row">
                <span className="fs-label">{terms.players.toUpperCase()} — {act?.title || 'THIS ACT'}</span>
                <button type="button" className="run-btn primary" onClick={onResendOrders}>SEND AGENDA CARDS</button>
              </div>
              {assigned.map((p) => {
                const text = p.character.agendaByAct?.[String(actIndex + 1)];
                return (
                  <div key={p.id} className="run-card pc">
                    <div className="run-card-head">
                      <b>{p.character.name}</b><span className="run-dim">{p.name}</span>
                      {sentOrders(p.id) && <span className="run-receipt all">SENT</span>}
                    </div>
                    <p>{text || p.character.personalAgenda || <i className="run-dim">No agenda for this act.</i>}</p>
                  </div>
                );
              })}
              <p className="nd-hint">SEND AGENDA CARDS pushes each {terms.player.toLowerCase()}'s agenda for this act to their phone as a private card. ADVANCE ACT sends the next act's automatically.</p>
            </>
          ) : <p className="run-empty">Assign characters (in {terms.players}) to see their agendas here.</p>}
        </div>
      )}

      {tab === 'npcs' && (
        <div role="tabpanel" aria-label="NPCs">
          {pack?.npcs?.length > 0 ? (
            <>
              <div className="md-row">
                <span className="fs-label">NPCS — IF IGNORED</span>
                <button type="button" className="run-btn" aria-pressed={showSecrets} onClick={() => setShowSecrets((v) => !v)}>{showSecrets ? 'HIDE SECRETS' : 'SHOW SECRETS'}</button>
              </div>
              {pack.npcs.map((n) => (
                <div key={n.name} className="run-card npc">
                  <div className="run-card-head"><b>{n.name}</b>{n.role && <span className="run-dim">{n.role}</span>}</div>
                  <p><span className="run-accent">WANTS: </span>{n.agenda}</p>
                  {n.behavior && <p><span className="run-warn">IF IGNORED: </span>{n.behavior}</p>}
                  {showSecrets && n.secret && <p className="run-secret">SECRET: {n.secret}</p>}
                </div>
              ))}
            </>
          ) : <p className="run-empty">{pack ? 'This scenario lists no NPCs.' : 'Sandbox: no scenario NPCs.'}</p>}
        </div>
      )}

      {tab === 'clues' && <div role="tabpanel" aria-label="Clues"><CluesPanel highlight={sceneClueIds} /></div>}
      {tab === 'log' && <div role="tabpanel" aria-label="Log"><SessionLogPanel pack={pack} /></div>}

      {tab === 'safety' && (
        <div className="md-safety" role="tabpanel" aria-label="Safety">
          {table?.pause ? (
            <div className="dm-pause">
              <span className="dm-pause-mark" aria-hidden="true">❚❚</span>
              <span><b>PAUSE REQUESTED</b> — check in, adjust, continue. You never see who asked.</span>
              <button type="button" className="run-btn primary" onClick={() => pauseClear()}>RESUME PLAY</button>
            </div>
          ) : <p className="run-empty">No pause requested. Every phone has an anonymous PAUSE button.</p>}
          <div className="fs-label">SESSION ZERO</div>
          {safety?.enabled ? (
            <>
              {safety.tone?.length > 0 && <div className="s0-row"><span className="s0-label">TONE</span>{safety.tone.map((t) => <span key={t} className="run-chip on static">{t}</span>)}</div>}
              {safety.warnings?.length > 0 && (
                <div className="s0-row"><span className="s0-label">WARNINGS</span>{safety.warnings.map((w) => <span key={w} className="run-chip static">{w}</span>)}</div>
              )}
              {safety.linesVeils && <p className="run-dim-p">{safety.linesVeils}</p>}
              <div className="s0-row">
                <span className="s0-label">CONFIRMED</span>
                {Object.values(players || {}).map((p) => (
                  <span key={p.id} className={`dm-s0${safety.confirmed?.includes(p.id) ? ' ok' : ''}`}>{p.character?.name || p.name}{safety.confirmed?.includes(p.id) ? ' ✓' : ' …'}</span>
                ))}
              </div>
            </>
          ) : <p className="run-empty">Session zero was off for this {terms.session.toLowerCase()} (set it on the session screen before INITIALIZE).</p>}
        </div>
      )}

      {tab === 'end' && (
        <div className="md-end" role="tabpanel" aria-label={`End ${terms.session}`}>
          <p className="run-dim-p">To stop for tonight and continue later, just close this tab: the {terms.session.toLowerCase()} stays saved and resumable. Export the recap first (LOG → EXPORT RECAP) if you want one.</p>
          <Confirm danger block label={`END ${terms.session.toUpperCase()} FOR EVERYONE`} title={`END THIS ${terms.session.toUpperCase()} FOR EVERYONE?`}
            message={`Phones and the TV are disconnected and the saved ${terms.session.toLowerCase()} is deleted.`}
            confirmLabel={`END ${terms.session.toUpperCase()}`} cancelLabel="KEEP PLAYING" onConfirm={leaveGame} className="fs-btn danger" />
        </div>
      )}
    </div>
  );
}
