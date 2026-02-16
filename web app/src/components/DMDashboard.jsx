import React, { useState, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { characters } from '../data/characters';
import { skillNames, skillAttributes } from '../data/characters';

const STATUS_EFFECTS = [
  'STRESSED', 'PANICKED', 'STARVING', 'DEHYDRATED', 'EXHAUSTED',
  'FREEZING', 'BLEEDING', 'BROKEN', 'RADIATION', 'INFECTED',
  'UNCONSCIOUS', 'CRITICAL',
];

export default function DMDashboard() {
  const {
    gameCode, players, messages, leaveGame,
    assignCharacter, updatePlayer, sendMessage,
    broadcastMessage, killCharacter, unreadCount, clearUnread,
  } = useGame();

  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [panel, setPanel] = useState('players'); // 'players' | 'assign' | 'message' | 'log'
  const [msgText, setMsgText] = useState('');
  const [msgTarget, setMsgTarget] = useState('');
  const [msgPriority, setMsgPriority] = useState('STANDARD');
  const [newItem, setNewItem] = useState('');

  const playerList = Object.values(players);
  const selected = selectedPlayer ? players[selectedPlayer] : null;

  const assignedIds = useMemo(() => {
    return new Set(playerList.filter(p => p.character?.id).map(p => p.character.id));
  }, [playerList]);

  const availableCharacters = characters.filter(c => !assignedIds.has(c.id));

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}?join=${gameCode}`
    : '';

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

  return (
    <div>
      {/* Session header */}
      <div className="panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1rem', letterSpacing: '0.15em', marginBottom: '0.25rem' }}>
            GAME SESSION ACTIVE
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--accent)', fontSize: '1.5rem', letterSpacing: '0.3em', fontWeight: 'bold' }}>
              {gameCode}
            </span>
            <button onClick={() => navigator.clipboard?.writeText(shareUrl)} style={smallBtn}>
              COPY LINK
            </button>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>
              {playerList.length} CREW CONNECTED
            </span>
          </div>
        </div>
        <button onClick={leaveGame} style={{ ...smallBtn, borderColor: '#c04040', color: '#c04040' }}>
          END SESSION
        </button>
      </div>

      {/* Panel tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {[
          ['players', `CREW STATUS (${playerList.length})`],
          ['message', 'TRANSMISSIONS'],
          ['log', `MESSAGE LOG${unreadCount > 0 ? ` (${unreadCount})` : ''}`],
        ].map(([id, label]) => (
          <button key={id} style={{
            ...smallBtn,
            background: panel === id ? 'rgba(0,212,170,0.12)' : 'transparent',
            borderColor: panel === id ? 'var(--accent)' : 'var(--border)',
            color: panel === id ? 'var(--accent)' : 'var(--text-dim)',
          }} onClick={() => { setPanel(id); if (id === 'log') clearUnread(); }}>
            {label}
          </button>
        ))}
      </div>

      {/* ─── Players Panel ──────────────────────────── */}
      {panel === 'players' && (
        <div>
          {playerList.length === 0 && (
            <div className="panel" style={{ textAlign: 'center', color: 'var(--text-dim)' }}>
              <p>AWAITING CREW CONNECTIONS...</p>
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
                opacity: p.alive ? 1 : 0.5,
              }} onClick={() => setSelectedPlayer(selectedPlayer === p.id ? null : p.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ color: 'var(--text)', fontWeight: 'bold', fontSize: '0.85rem' }}>{p.name}</div>
                    <div style={{ color: 'var(--accent)', fontSize: '0.7rem' }}>
                      {p.character ? p.character.name : 'NO CHARACTER ASSIGNED'}
                    </div>
                  </div>
                  {!p.alive && <span style={{ color: '#c04040', fontSize: '0.7rem', letterSpacing: '0.1em' }}>KIA</span>}
                </div>

                {p.character && (
                  <>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <StatBar label="HP" value={p.health} max={p.maxHealth} color="var(--accent)" />
                      <StatBar label="STRESS" value={p.stress} max={10} color="#c0a040" />
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
                  <p style={{ color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Assign a character:</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                    {availableCharacters.map(c => (
                      <button key={c.id} style={smallBtn} onClick={() => assignCharacter(selected.id, c)}>
                        {c.name} — {c.career}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* Health & Stress controls */}
                  <div>
                    <label style={labelStyle}>HEALTH ({selected.health}/{selected.maxHealth})</label>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button style={smallBtn} onClick={() => updatePlayer(selected.id, { health: selected.health - 1 })}>-1</button>
                      <button style={smallBtn} onClick={() => updatePlayer(selected.id, { health: selected.health + 1 })}>+1</button>
                      <button style={smallBtn} onClick={() => updatePlayer(selected.id, { health: selected.maxHealth })}>MAX</button>
                    </div>
                    <label style={{ ...labelStyle, marginTop: '0.5rem' }}>STRESS ({selected.stress})</label>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button style={smallBtn} onClick={() => updatePlayer(selected.id, { stress: selected.stress - 1 })}>-1</button>
                      <button style={smallBtn} onClick={() => updatePlayer(selected.id, { stress: selected.stress + 1 })}>+1</button>
                      <button style={smallBtn} onClick={() => updatePlayer(selected.id, { stress: 0 })}>CLEAR</button>
                    </div>
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
                      {STATUS_EFFECTS.filter(e => !selected.statusEffects.includes(e)).map(e => (
                        <button key={e} style={{ ...smallBtn, fontSize: '0.6rem', padding: '0.2rem 0.4rem' }}
                          onClick={() => handleAddStatus(selected.id, e)}>+{e}</button>
                      ))}
                    </div>
                  </div>

                  {/* Inventory */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>INVENTORY</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.5rem' }}>
                      {selected.inventory.map((item, i) => (
                        <span key={i} style={{ ...tagStyle, cursor: 'pointer', background: 'rgba(0,212,170,0.06)' }}
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {Object.entries(selected.character.attributes).map(([attr, val]) => (
                        <div key={attr} style={{ textAlign: 'center', padding: '0.3rem', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>{attr.toUpperCase()}</div>
                          <div style={{ fontSize: '1rem', color: 'var(--accent)' }}>{val}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                      <strong style={{ color: 'var(--text)' }}>TALENT:</strong> {selected.character.talent}
                    </div>
                  </div>

                  {/* Danger zone */}
                  <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #c04040', paddingTop: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {selected.alive ? (
                        <button style={{ ...smallBtn, borderColor: '#c04040', color: '#c04040' }}
                          onClick={() => { if (confirm('Kill this character?')) killCharacter(selected.id); }}>
                          KILL CHARACTER
                        </button>
                      ) : (
                        <div>
                          <p style={{ color: '#c04040', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                            CHARACTER DECEASED — Assign replacement:
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {availableCharacters.map(c => (
                              <button key={c.id} style={smallBtn} onClick={() => assignCharacter(selected.id, c)}>
                                {c.name}
                              </button>
                            ))}
                          </div>
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

      {/* ─── Message Panel ──────────────────────────── */}
      {panel === 'message' && (
        <div className="panel">
          <h3 style={{ color: 'var(--accent)', marginBottom: '0.75rem', letterSpacing: '0.1em' }}>
            TRANSMIT MESSAGE
          </h3>
          <form onSubmit={handleSendMsg}>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={labelStyle}>RECIPIENT</label>
              <select value={msgTarget} onChange={e => setMsgTarget(e.target.value)} style={inputStyle}>
                <option value="">Select recipient...</option>
                <option value="broadcast">ALL CREW (SHIPWIDE)</option>
                {playerList.filter(p => p.character).map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {p.character.name}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={labelStyle}>PRIORITY</label>
              <select value={msgPriority} onChange={e => setMsgPriority(e.target.value)} style={inputStyle}>
                <option value="STANDARD">STANDARD</option>
                <option value="PRIORITY">PRIORITY</option>
                <option value="EYES ONLY">EYES ONLY</option>
                <option value="EMERGENCY">EMERGENCY</option>
              </select>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>MESSAGE</label>
              <textarea value={msgText} onChange={e => setMsgText(e.target.value)}
                placeholder="Enter transmission..." rows={4}
                style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <button type="submit" disabled={!msgTarget || !msgText.trim()} style={smallBtn}>
              TRANSMIT
            </button>
          </form>
        </div>
      )}

      {/* ─── Message Log ────────────────────────────── */}
      {panel === 'log' && (
        <div className="panel" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <h3 style={{ color: 'var(--accent)', marginBottom: '0.75rem', letterSpacing: '0.1em' }}>
            TRANSMISSION LOG
          </h3>
          {messages.length === 0 && (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>No transmissions yet.</p>
          )}
          {[...messages].reverse().map(m => (
            <div key={m.id} style={{
              padding: '0.5rem', marginBottom: '0.5rem',
              border: `1px solid ${m.from === 'MUTHUR' ? 'var(--border)' : 'var(--accent)'}`,
              background: m.from === 'MUTHUR' ? 'rgba(0,212,170,0.03)' : 'rgba(80,200,168,0.06)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--accent)', fontSize: '0.7rem' }}>
                  {m.from} → {m.to}
                </span>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>
                  {new Date(m.timestamp).toLocaleTimeString()} — {m.priority}
                </span>
              </div>
              <div style={{ color: 'var(--text)', fontSize: '0.8rem' }}>{m.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatBar({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
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
  padding: '0.4rem 0.7rem', background: 'transparent',
  border: '1px solid var(--border)', color: 'var(--text-dim)',
  fontFamily: "'Share Tech Mono', monospace", fontSize: '0.7rem',
  letterSpacing: '0.06em', cursor: 'pointer',
};

const labelStyle = {
  display: 'block', color: 'var(--text-dim)', fontSize: '0.65rem',
  letterSpacing: '0.1em', marginBottom: '0.2rem',
};

const inputStyle = {
  width: '100%', padding: '0.5rem', background: 'var(--bg-card)',
  border: '1px solid var(--border)', color: 'var(--text)',
  fontFamily: "'Share Tech Mono', monospace", fontSize: '0.8rem',
  boxSizing: 'border-box',
};

const tagStyle = {
  padding: '0.15rem 0.4rem', fontSize: '0.6rem', letterSpacing: '0.06em',
  border: '1px solid var(--border)', color: 'var(--text-dim)',
  background: 'rgba(192,160,64,0.08)',
};
