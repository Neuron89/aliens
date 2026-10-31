import React, { useState, useMemo } from 'react';
import { useGame } from '../GameContext';
import { useUniverse } from '../UniverseContext';
import { useContent } from '../ContentContext';
import { characterGroups, initialCharacterState, withDerived, attributeLabel, trackMaxFor, plural, fmtTime, determinationDef } from '../rulesUtils';
import CharacterBuilder from './CharacterBuilder';
import Confirm from './Confirm';
import RollFeed from './run/RollFeed';
import InitiativePanel from './run/InitiativePanel';
import ThreatsPanel from './run/ThreatsPanel';
import PoolCounters from './run/PoolCounters';
import SupplyPanel from './SupplyPanel';
import InjuryPicker from './InjuryPicker';

export default function DMDashboard() {
  const {
    gameCode, players, messages, leaveGame, packId,
    assignCharacter, updatePlayer, sendMessage,
    broadcastMessage, killCharacter, unreadCount, clearUnread, lastSaved,
    table, unreadBy, clearUnreadFor, resolveSubmission,
    supplySet, supplyRoll, injuryAdd, injuryRemove, on,
    determinationGrant,
  } = useGame();
  const [supplyLast, setSupplyLast] = useState(null);
  React.useEffect(() => on('supply-rolled', (e) => e && setSupplyLast(e)), [on]);
  const { universe } = useUniverse();
  const { packs, byId } = useContent();
  const { terms, terminal, rules } = universe;
  const priorities = terms.priorities?.length ? terms.priorities : ['STANDARD'];
  const tracks = rules.tracks || [];
  const detDef = determinationDef(universe);
  const statusEffects = rules.statusEffects || [];

  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [panel, setPanel] = useState('players'); // 'players' | 'message' | 'log'
  const [msgText, setMsgText] = useState('');
  const [msgTarget, setMsgTarget] = useState('');
  const [msgPriority, setMsgPriority] = useState(priorities[0]);
  const [newItem, setNewItem] = useState('');
  const [editingSub, setEditingSub] = useState(null); // player-built submission open in the builder
  const pendingSubs = (table?.submissions || []).filter(s => s.status === 'pending');
  const subFor = (playerId) => pendingSubs.find(s => s.playerId === playerId);

  const playerList = Object.values(players);
  const selected = selectedPlayer ? players[selectedPlayer] : null;
  const activePack = packId ? byId[packId] : null;

  const assignedIds = useMemo(() => {
    return new Set(playerList.filter(p => p.character?.id).map(p => p.character.id));
  }, [playerList]);

  /* Active pack's characters first, then every other pack for this universe. */
  const characterSources = useMemo(() => {
    const groups = characterGroups(packs);
    const seen = new Set();
    const ordered = [
      ...groups.filter(g => g.packId === packId),
      ...groups.filter(g => g.packId !== packId),
    ];
    return ordered.map(g => ({
      ...g,
      characters: g.characters.filter(c => {
        if (assignedIds.has(c.id) || seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      }),
    })).filter(g => g.characters.length > 0);
  }, [packs, packId, assignedIds]);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}?join=${gameCode}`
    : '';

  const doAssign = (playerId, char) => {
    const character = withDerived(universe, char);
    assignCharacter(playerId, character, initialCharacterState(universe, character));
  };

  /* Player-built characters (character-submit): ASSIGN / EDIT / REJECT. */
  const assignSub = (sub, char = sub.character) => {
    if (!players[sub.playerId]) return;
    doAssign(sub.playerId, char); // server marks the submission assigned
  };
  const rejectSub = (sub) => {
    const reason = prompt(`Reject ${sub.character?.name || 'this character'}? Optional note for ${sub.playerName}:`, '');
    if (reason === null) return;
    resolveSubmission(sub.id, 'reject', reason);
  };
  const replyTo = (playerId) => {
    setMsgTarget(playerId);
    setPanel('message');
    clearUnreadFor(playerId);
  };

  const handleSendMsg = (e) => {
    e.preventDefault();
    if (!msgText.trim()) return;
    if (msgTarget === 'broadcast') {
      broadcastMessage(msgText, msgPriority);
    } else if (msgTarget) {
      sendMessage(msgTarget, msgText, msgPriority);
    }
    setMsgText('');
  };

  const setTrack = (p, key, value) => updatePlayer(p.id, { tracks: { [key]: value } });

  const handleAddStatus = (playerId, effect) => {
    const p = players[playerId];
    if (!p || p.statusEffects.includes(effect)) return;
    updatePlayer(playerId, { statusEffects: [...p.statusEffects, effect] });
  };

  const handleRemoveStatus = (playerId, effect) => {
    const p = players[playerId];
    if (!p) return;
    updatePlayer(playerId, { statusEffects: p.statusEffects.filter(e => e !== effect) });
  };

  const handleAddItem = (playerId) => {
    if (!newItem.trim()) return;
    const p = players[playerId];
    if (!p) return;
    updatePlayer(playerId, { inventory: [...p.inventory, newItem.trim()] });
    setNewItem('');
  };

  const handleRemoveItem = (playerId, idx) => {
    const p = players[playerId];
    if (!p) return;
    const inv = [...p.inventory];
    inv.splice(idx, 1);
    updatePlayer(playerId, { inventory: inv });
  };

  const PLAYERS = terms.players.toUpperCase();
  const MESSAGE = terms.message.toUpperCase();

  const characterPicker = (playerId, compact) => (
    characterSources.length === 0 ? (
      <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
        No unassigned characters. Create one in the Characters tab or import a pack.
      </p>
    ) : characterSources.map(g => (
      <div key={g.packId} style={{ marginBottom: '0.6rem' }}>
        <div style={{ color: g.packId === packId ? 'var(--accent)' : 'var(--text-dim)', fontSize: '0.6rem', letterSpacing: '0.12em', marginBottom: '0.25rem' }}>
          {g.title.toUpperCase()}{g.packId === packId ? ' — ACTIVE SCENARIO' : ''}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.4rem' }}>
          {g.characters.map(c => (
            <button key={c.id} style={smallBtn} onClick={() => doAssign(playerId, c)}>
              {compact ? c.name : `${c.name} — ${c.career}`}
            </button>
          ))}
        </div>
      </div>
    ))
  );

  if (editingSub) {
    return (
      <div className="panel">
        <h3 style={{ color: 'var(--accent)', marginBottom: '0.5rem', letterSpacing: '0.1em' }}>
          EDITING PLAYER-BUILT CHARACTER — {editingSub.playerName}
        </h3>
        <CharacterBuilder
          initial={editingSub.character}
          onBack={() => setEditingSub(null)}
          onSave={(char) => { assignSub(editingSub, { ...char, id: editingSub.character.id || char.id }); setEditingSub(null); return true; }}
          connectedPlayers={playerList.map(p => p.name)}
        />
      </div>
    );
  }

  const subCard = (sub) => (
    <div key={sub.id} className="dm-sub">
      <div className="dm-sub-main">
        <span className="dm-sub-badge">PLAYER-BUILT</span>
        <b>{sub.character?.name || 'Unnamed'}</b>
        <span className="run-dim">{sub.character?.career || ''} · by {sub.playerName}</span>
      </div>
      <div className="run-row">
        <button type="button" className="run-btn primary sm" onClick={() => assignSub(sub)} disabled={!players[sub.playerId]}>ASSIGN</button>
        <button type="button" className="run-btn sm" onClick={() => setEditingSub(sub)}>EDIT</button>
        <button type="button" className="run-btn sm danger" onClick={() => rejectSub(sub)}>REJECT</button>
      </div>
    </div>
  );

  return (
    <div>
      {/* Session head (the code, PIN, TV and LINK live in the status strip above) */}
      <div className="page-head">
        <h2>{PLAYERS} — {playerList.filter(p => p.connected !== false).length}/{playerList.length} ONLINE</h2>
        <div className="page-actions">
          <span className="page-note">
            {activePack ? activePack.meta.title.toUpperCase() : 'SANDBOX'}
            {lastSaved ? ` · ${terms.session.toUpperCase()} SAVED ${fmtTime(lastSaved, { seconds: true })}` : ''}
          </span>
          <PoolCounters />
          <button type="button" className="page-btn" onClick={() => navigator.clipboard?.writeText(shareUrl)}>COPY JOIN LINK</button>
          <a className="page-btn" href={`/?board=${gameCode}`} target="_blank" rel="noreferrer">OPEN BOARD (TV)</a>
          {/* Ending deletes the saved session for everyone (phones and TV are sent away): never on a single tap. */}
          <Confirm danger label={`END ${terms.session.toUpperCase()}`} title={`END THIS ${terms.session.toUpperCase()} FOR EVERYONE?`}
            message={`Phones and the TV are disconnected and the saved ${terms.session.toLowerCase()} is deleted. Export the recap first (RUN → MORE → LOG → EXPORT RECAP) if you want it.
To stop for tonight and continue later, just close this tab instead.`}
            confirmLabel={`END ${terms.session.toUpperCase()}`} cancelLabel="KEEP PLAYING" onConfirm={leaveGame} className="page-btn danger" />
        </div>
      </div>

      {/* Panel tabs */}
      <div className="dm-tabs" role="tablist" aria-label={`${PLAYERS} dashboard`}>
        {[
          ['players', `${PLAYERS} STATUS (${playerList.length})`],
          ['message', plural(MESSAGE)],
          ['log', `MESSAGE LOG${unreadCount > 0 ? ` (${unreadCount})` : ''}`],
          ['rolls', `ROLLS${table?.rolls?.length ? ` (${table.rolls.length})` : ''}`],
          ['initiative', table?.initiative?.active ? `INITIATIVE · R${table.initiative.round}` : 'INITIATIVE'],
          ['threats', 'THREATS'],
          ...(pendingSubs.length ? [['players', `PLAYER-BUILT (${pendingSubs.length})`]] : []),
        ].map(([id, label], i) => (
          <button key={`${id}-${i}`} type="button" role="tab" aria-selected={panel === id} className={panel === id ? 'on' : ''}
            onClick={() => { setPanel(id); if (id === 'log') { clearUnread(); playerList.forEach(p => clearUnreadFor(p.id)); } }}>
            {label}
          </button>
        ))}
      </div>

      {/* ─── Players Panel ──────────────────────────── */}
      {panel === 'players' && (
        <div>
          {pendingSubs.length > 0 && (
            <div className="panel dm-subs-panel">
              <h3 style={{ color: 'var(--accent)', marginBottom: '0.5rem', letterSpacing: '0.1em', fontSize: '0.8rem' }}>
                PLAYER-BUILT CHARACTERS ({pendingSubs.length})
              </h3>
              {pendingSubs.map(subCard)}
            </div>
          )}
          {playerList.length === 0 && (
            <div className="panel" style={{ textAlign: 'center', color: 'var(--text-dim)' }}>
              <p>AWAITING {PLAYERS} CONNECTIONS...</p>
              <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                Share this link with your players: <br />
                <span style={{ color: 'var(--accent)', wordBreak: 'break-all' }}>{shareUrl}</span>
              </p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
            {playerList.map(p => (
              <div key={p.id} className="panel" style={{
                cursor: 'pointer',
                border: selectedPlayer === p.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                opacity: !p.alive ? 0.5 : p.connected === false ? 0.55 : 1,
              }} onClick={() => setSelectedPlayer(selectedPlayer === p.id ? null : p.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ color: 'var(--text)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                      {p.name}
                      {p.connected === false && <span className="offline-tag">OFFLINE</span>}
                      {unreadBy[p.id] > 0 && (
                        <button type="button" className="dm-unread" title="Unread messages — reply privately"
                          onClick={(e) => { e.stopPropagation(); replyTo(p.id); }}>{unreadBy[p.id]} NEW</button>
                      )}
                      {subFor(p.id) && <span className="dm-sub-badge">PLAYER-BUILT</span>}
                      {table?.safety?.enabled && (
                        <span className={`dm-s0${table.safety.confirmed?.includes(p.id) ? ' ok' : ''}`}
                          title="Session zero (BEFORE WE BEGIN card)">
                          {table.safety.confirmed?.includes(p.id) ? 'S0 ✓ READY' : 'S0 PENDING'}
                        </span>
                      )}
                    </div>
                    <div style={{ color: 'var(--accent)', fontSize: '0.7rem' }}>
                      {p.character ? p.character.name : 'NO CHARACTER ASSIGNED'}
                    </div>
                  </div>
                  {!p.alive && <span style={{ color: 'var(--danger)', fontSize: '0.7rem', letterSpacing: '0.1em' }}>KIA</span>}
                </div>

                {p.character && (
                  <>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      {tracks.map(t => (
                        <StatBar key={t.key} label={t.short || t.label} value={p.tracks?.[t.key] ?? 0}
                          max={p.trackMax?.[t.key] ?? trackMaxFor(t, p.character) ?? 0} color={t.color || 'var(--accent)'} />
                      ))}
                    </div>
                    {p.statusEffects.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                        {p.statusEffects.map(e => (
                          <span key={e} style={tagStyle}>{e}</span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Selected player detail */}
          {selected && (
            <div className="panel" style={{ marginTop: '1rem', borderColor: 'var(--accent)' }}>
              <h3 style={{ color: 'var(--accent)', marginBottom: '0.75rem', letterSpacing: '0.1em' }}>
                EDITING: {selected.name} — {selected.character?.name || 'UNASSIGNED'}
              </h3>

              {!selected.character ? (
                <div>
                  {subFor(selected.id) && subCard(subFor(selected.id))}
                  <p style={{ color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Assign a character:</p>
                  {characterPicker(selected.id, false)}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* A replacement the player built mid-session (by choice, or before a death) */}
                  {selected.alive && subFor(selected.id) && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <p className="run-dim" style={{ fontSize: '0.7rem', marginBottom: '0.3rem' }}>
                        {selected.name} SUBMITTED A REPLACEMENT — ASSIGN SWAPS IT IN FOR {String(selected.character.name).toUpperCase()}:
                      </p>
                      {subCard(subFor(selected.id))}
                    </div>
                  )}
                  {/* Track controls */}
                  <div>
                    {tracks.map((t, i) => {
                      const value = selected.tracks?.[t.key] ?? 0;
                      const max = selected.trackMax?.[t.key];
                      return (
                        <div key={t.key} style={{ marginTop: i ? '0.5rem' : 0 }}>
                          <label style={labelStyle}>{t.label} ({value}{max !== undefined ? `/${max}` : ''})</label>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button style={smallBtn} onClick={() => setTrack(selected, t.key, value - 1)}>-1</button>
                            <button style={smallBtn} onClick={() => setTrack(selected, t.key, value + 1)}>+1</button>
                            {t.initial === 'max'
                              ? <button style={smallBtn} onClick={() => setTrack(selected, t.key, max ?? value)}>MAX</button>
                              : <button style={smallBtn} onClick={() => setTrack(selected, t.key, Number(t.initial) || 0)}>CLEAR</button>}
                          </div>
                        </div>
                      );
                    })}
                    {detDef && (() => {
                      const det = selected.determination || { value: 0, max: detDef.max };
                      return (
                        <div style={{ marginTop: '0.5rem' }} className="dm-det">
                          <label style={labelStyle}>{detDef.label} ({det.value}/{det.max})</label>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button style={smallBtn} onClick={() => determinationGrant(selected.id, -1, detDef.max)} disabled={det.value <= 0}>-1</button>
                            <button style={{ ...smallBtn, borderColor: 'var(--accent)', color: 'var(--accent)' }}
                              onClick={() => determinationGrant(selected.id, 1, detDef.max)} disabled={det.value >= det.max}>GRANT +1</button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Status effects */}
                  <div>
                    <label style={labelStyle}>STATUS EFFECTS</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.5rem' }}>
                      {selected.statusEffects.map(e => (
                        <span key={e} style={{ ...tagStyle, cursor: 'pointer' }}
                          onClick={() => handleRemoveStatus(selected.id, e)} title="Click to remove">
                          {e} ×
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                      {statusEffects.filter(e => !selected.statusEffects.includes(e)).map(e => (
                        <button key={e} style={{ ...smallBtn, fontSize: '0.62rem', padding: '0.2rem 0.5rem', minHeight: '36px' }}
                          onClick={() => handleAddStatus(selected.id, e)}>+{e}</button>
                      ))}
                    </div>
                  </div>

                  {/* Supplies (rules.supplies) */}
                  {rules.supplies?.length > 0 && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <SupplyPanel keys={rules.supplies} supply={selected.supply || {}} danger={rules.supplyDanger ?? 2} max={rules.supplyMax ?? 12}
                        onSet={(k, v) => supplySet(selected.id, { [k]: v })} onRoll={(k) => supplyRoll(k, selected.id)}
                        last={supplyLast?.playerId === selected.id ? supplyLast : null} />
                    </div>
                  )}

                  {/* Critical injuries (catalog injuries) */}
                  {(universe.catalog?.injuries?.length > 0) && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>CRITICAL INJURIES</label>
                      <InjuryPicker universe={universe} injuries={selected.injuries || []}
                        onApply={(inj) => injuryAdd(selected.id, inj)} onHeal={(uid) => injuryRemove(selected.id, uid)} />
                    </div>
                  )}

                  {selected.panic && (
                    <div style={{ gridColumn: '1 / -1' }} className="dm-panic-note">
                      <b>PANIC {selected.panic.total}: {selected.panic.name.toUpperCase()}</b> — {selected.panic.text}
                    </div>
                  )}

                  {/* Inventory */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>INVENTORY</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.5rem' }}>
                      {selected.inventory.map((item, i) => (
                        <span key={i} style={{ ...tagStyle, cursor: 'pointer', background: 'color-mix(in srgb, var(--accent) 6%, transparent)' }}
                          onClick={() => handleRemoveItem(selected.id, i)} title="Click to remove">
                          {item} ×
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <input value={newItem} onChange={e => setNewItem(e.target.value)}
                        placeholder="Add item..." style={inputStyle}
                        onKeyDown={e => e.key === 'Enter' && handleAddItem(selected.id)} />
                      <button style={smallBtn} onClick={() => handleAddItem(selected.id)}>ADD</button>
                    </div>
                  </div>

                  {/* Character sheet (read-only summary) */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>CHARACTER SHEET</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {Object.entries(selected.character.attributes || {}).map(([attr, val]) => (
                        <div key={attr} style={{ textAlign: 'center', padding: '0.3rem', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>{attributeLabel(universe, attr, { short: true })}</div>
                          <div style={{ fontSize: '1rem', color: 'var(--accent)' }}>{val}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                      <strong style={{ color: 'var(--text)' }}>TALENT:</strong> {selected.character.talent}
                    </div>
                    {selected.character.personalAgenda && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                        <strong style={{ color: 'var(--text)' }}>AGENDA:</strong> {selected.character.personalAgenda}
                      </div>
                    )}
                  </div>

                  {/* Danger zone */}
                  <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--danger)', paddingTop: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {selected.alive ? (
                        <Confirm danger align="left" label="KILL CHARACTER" title={`KILL ${String(selected.character.name).toUpperCase()}?`}
                          message={`${selected.name}'s phone shows the obituary; you can then assign a replacement (or one they build).`}
                          confirmLabel="KILL" onConfirm={() => killCharacter(selected.id)}
                          style={{ ...smallBtn, borderColor: 'var(--danger)', color: 'var(--danger)' }} />
                      ) : (
                        <div style={{ width: '100%' }}>
                          <p style={{ color: 'var(--danger)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                            CHARACTER DECEASED — Assign replacement:
                          </p>
                          {subFor(selected.id) ? (
                            <div className="dm-kia-pb">
                              <button type="button" className="run-btn primary" onClick={() => assignSub(subFor(selected.id))}>
                                ASSIGN PLAYER-BUILT: {(subFor(selected.id).character?.name || 'UNNAMED').toUpperCase()}
                                {subFor(selected.id).character?.career ? ` (${subFor(selected.id).character.career})` : ''}
                              </button>
                              <button type="button" className="run-btn sm" onClick={() => setEditingSub(subFor(selected.id))}>EDIT FIRST</button>
                              <button type="button" className="run-btn sm danger" onClick={() => rejectSub(subFor(selected.id))}>REJECT</button>
                            </div>
                          ) : (
                            <p className="run-dim" style={{ fontSize: '0.7rem', marginBottom: '0.5rem' }}>
                              {selected.name} can build a replacement on their phone (BUILD A NEW CHARACTER); it appears here when submitted.
                            </p>
                          )}
                          {characterPicker(selected.id, true)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {panel === 'rolls' && <RollFeed limit={0} title="ROLL FEED" className="dm-rolls" />}
      {panel === 'initiative' && <div className="panel"><InitiativePanel /></div>}
      {panel === 'threats' && <div className="panel"><ThreatsPanel /></div>}

      {/* ─── Message Panel ──────────────────────────── */}
      {panel === 'message' && (
        <div className="panel">
          <h3 style={{ color: 'var(--accent)', marginBottom: '0.75rem', letterSpacing: '0.1em' }}>
            SEND {MESSAGE}
          </h3>
          <form onSubmit={handleSendMsg}>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={labelStyle}>RECIPIENT</label>
              <select value={msgTarget} onChange={e => setMsgTarget(e.target.value)} style={inputStyle}>
                <option value="">Select recipient...</option>
                <option value="broadcast">ALL {PLAYERS} ({terms.broadcast.toUpperCase()})</option>
                {playerList.filter(p => p.character).map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {p.character.name}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={labelStyle}>PRIORITY</label>
              <select value={msgPriority} onChange={e => setMsgPriority(e.target.value)} style={inputStyle}>
                {priorities.map(pr => <option key={pr} value={pr}>{pr}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>MESSAGE</label>
              <textarea value={msgText} onChange={e => setMsgText(e.target.value)}
                placeholder={`Enter ${terms.message.toLowerCase()}...`} rows={4}
                style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <button type="submit" disabled={!msgTarget || !msgText.trim()} style={smallBtn}>
              SEND {MESSAGE}
            </button>
          </form>
        </div>
      )}

      {/* ─── Message Log ────────────────────────────── */}
      {panel === 'log' && (
        <div className="panel" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <h3 style={{ color: 'var(--accent)', marginBottom: '0.75rem', letterSpacing: '0.1em' }}>
            {MESSAGE} LOG
          </h3>
          {messages.length === 0 && (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>No {plural(terms.message.toLowerCase())} yet.</p>
          )}
          {[...messages].reverse().map(m => {
            const fromGm = m.type === 'gm';
            const from = fromGm ? terminal.name : m.from;
            const to = m.toId === 'broadcast' ? `ALL ${PLAYERS}` : m.type === 'player' ? terminal.name : m.to;
            return (
              <div key={m.id} style={{
                padding: '0.5rem', marginBottom: '0.5rem',
                border: `1px solid ${fromGm ? 'var(--border)' : 'var(--accent)'}`,
                background: fromGm ? 'color-mix(in srgb, var(--accent) 3%, transparent)' : 'color-mix(in srgb, var(--accent) 6%, transparent)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--accent)', fontSize: '0.7rem' }}>
                    {from} → {to}
                  </span>
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>
                    {fmtTime(m.timestamp, { seconds: true })} —{m.priority === 'PLAYER' ? `${PLAYERS} ${MESSAGE}` : m.priority}
                  </span>
                </div>
                <div style={{ color: 'var(--text)', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{m.text}</div>
                {m.type === 'player' && m.fromId && players[m.fromId] && (
                  <button type="button" className="run-btn sm" style={{ marginTop: '0.35rem' }} onClick={() => replyTo(m.fromId)}>REPLY PRIVATELY</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-dim)', marginBottom: '0.15rem' }}>
        <span>{label}</span><span>{value}/{max}</span>
      </div>
      <div style={{ height: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

const smallBtn = {
  padding: '0.4rem 0.8rem', minHeight: '44px', background: 'transparent',
  border: '1px solid var(--border)', color: 'var(--text-dim)',
  fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
  letterSpacing: '0.06em', cursor: 'pointer',
};

const labelStyle = {
  display: 'block', color: 'var(--text-dim)', fontSize: '0.65rem',
  letterSpacing: '0.1em', marginBottom: '0.2rem',
};

const inputStyle = {
  width: '100%', padding: '0.5rem', background: 'var(--bg-card)',
  border: '1px solid var(--border)', color: 'var(--text)',
  fontFamily: 'var(--font-mono)', fontSize: '0.8rem',
  boxSizing: 'border-box',
};

const tagStyle = {
  padding: '0.15rem 0.4rem', fontSize: '0.6rem', letterSpacing: '0.06em',
  border: '1px solid var(--border)', color: 'var(--text-dim)',
  background: 'color-mix(in srgb, var(--warn) 8%, transparent)',
};
