import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { skillNames, skillAttributes } from '../data/characters';

export default function PlayerView() {
  const { myPlayer, messages, sendPlayerMessage, leaveGame, unreadCount, clearUnread, gameCode } = useGame();
  const [tab, setTab] = useState('status');
  const [msgText, setMsgText] = useState('');

  const c = myPlayer?.character;
  const playerMessages = messages.filter(m =>
    m.toId === myPlayer?.id || m.fromId === myPlayer?.id || m.toId === 'broadcast'
  );

  const handleSend = (e) => {
    e.preventDefault();
    if (!msgText.trim()) return;
    sendPlayerMessage(msgText);
    setMsgText('');
  };

  /* Waiting screen — no character assigned yet */
  if (!c) {
    return (
      <div className="app">
        <div className="crt-overlay" />
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '2rem' }}>
          <h1 style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--accent)', fontSize: '1.5rem', letterSpacing: '0.2em', marginBottom: '1rem' }}>
            MU/TH/UR 6000
          </h1>
          <div className="panel" style={{ textAlign: 'center', maxWidth: '400px' }}>
            <div className="pulse-line" style={{ height: '2px', background: 'var(--accent)', marginBottom: '1rem', animation: 'pulse 2s infinite' }} />
            <h2 style={{ fontSize: '0.9rem', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>AUTHENTICATION CONFIRMED</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '1rem' }}>
              Welcome, {myPlayer?.name}. Stand by for character assignment from Game Mother.
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>AWAITING ASSIGNMENT...</p>
          </div>
          <button onClick={leaveGame} style={{ ...btnStyle, marginTop: '1rem' }}>DISCONNECT</button>
        </div>
      </div>
    );
  }

  /* Death screen */
  if (!myPlayer.alive) {
    return (
      <div className="app">
        <div className="crt-overlay" />
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '2rem' }}>
          <h1 style={{ fontFamily: "'Orbitron', sans-serif", color: '#c04040', fontSize: '1.5rem', letterSpacing: '0.3em', marginBottom: '1rem' }}>
            CREW MEMBER DECEASED
          </h1>
          <div className="panel" style={{ textAlign: 'center', maxWidth: '400px', borderColor: '#c04040' }}>
            <h2 style={{ color: '#c04040', fontSize: '1rem', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>
              {c.name}
            </h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '1rem' }}>
              {c.career} — KILLED IN ACTION
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
              Awaiting new character assignment from Game Mother...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="crt-overlay" />
      <div style={{ padding: '1rem', maxWidth: '700px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <h1 style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--accent)', fontSize: '1.1rem', letterSpacing: '0.2em', marginBottom: '0.25rem' }}>
            MU/TH/UR PERSONAL TERMINAL
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.7rem', letterSpacing: '0.1em' }}>
            CREW INTERFACE — SESSION {gameCode}
          </p>
        </div>

        {/* Character banner */}
        <div className="panel" style={{ textAlign: 'center', borderColor: 'var(--accent)', marginBottom: '1rem' }}>
          <h2 style={{ color: 'var(--text)', fontSize: '1.1rem', letterSpacing: '0.1em', marginBottom: '0.15rem' }}>
            {c.name}
          </h2>
          <p style={{ color: 'var(--accent)', fontSize: '0.8rem', letterSpacing: '0.08em' }}>{c.career}</p>
        </div>

        {/* Tab navigation */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          {[
            ['status', 'STATUS'],
            ['skills', 'SKILLS'],
            ['inventory', 'INVENTORY'],
            ['messages', `COMMS${unreadCount > 0 ? ` (${unreadCount})` : ''}`],
            ['sheet', 'DOSSIER'],
          ].map(([id, label]) => (
            <button key={id} style={{
              ...tabBtn,
              background: tab === id ? 'rgba(0,212,170,0.12)' : 'transparent',
              borderColor: tab === id ? 'var(--accent)' : 'var(--border)',
              color: tab === id ? 'var(--accent)' : 'var(--text-dim)',
            }} onClick={() => { setTab(id); if (id === 'messages') clearUnread(); }}>
              {label}
            </button>
          ))}
        </div>

        {/* ─── STATUS ──────────────────────── */}
        {tab === 'status' && (
          <div>
            <div className="panel">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <StatusBar label="HEALTH" value={myPlayer.health} max={myPlayer.maxHealth}
                  color="var(--accent)" danger={myPlayer.health <= 2} />
                <StatusBar label="STRESS LEVEL" value={myPlayer.stress} max={10}
                  color="#c0a040" danger={myPlayer.stress >= 7} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                {Object.entries(c.attributes).map(([attr, val]) => (
                  <div key={attr} style={{ textAlign: 'center', padding: '0.5rem', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>{attr.toUpperCase()}</div>
                    <div style={{ fontSize: '1.4rem', color: 'var(--accent)', fontWeight: 'bold' }}>{val}</div>
                  </div>
                ))}
              </div>

              {myPlayer.statusEffects.length > 0 && (
                <div>
                  <label style={labelStyle}>ACTIVE CONDITIONS</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {myPlayer.statusEffects.map(e => (
                      <span key={e} style={{
                        padding: '0.25rem 0.6rem', fontSize: '0.7rem', letterSpacing: '0.06em',
                        border: '1px solid #c04040', color: '#c04040', background: 'rgba(192,64,64,0.08)',
                      }}>{e}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="panel" style={{ marginTop: '0.75rem' }}>
              <label style={labelStyle}>TALENT</label>
              <p style={{ color: 'var(--text)', fontSize: '0.8rem' }}>{c.talent}</p>
            </div>
          </div>
        )}

        {/* ─── SKILLS ──────────────────────── */}
        {tab === 'skills' && (
          <div className="panel">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {Object.entries(c.skills).map(([key, val]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0.5rem', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                  <span style={{ color: 'var(--text)', fontSize: '0.75rem' }}>
                    {skillNames[key] || key}
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.6rem', marginLeft: '0.3rem' }}>
                      ({skillAttributes[key]})
                    </span>
                  </span>
                  <span style={{ color: val > 0 ? 'var(--accent)' : 'var(--text-dim)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    {val}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── INVENTORY ───────────────────── */}
        {tab === 'inventory' && (
          <div className="panel">
            <h3 style={{ color: 'var(--accent)', marginBottom: '0.5rem', letterSpacing: '0.1em', fontSize: '0.85rem' }}>
              EQUIPMENT & GEAR
            </h3>
            {myPlayer.inventory.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>No items.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {myPlayer.inventory.map((item, i) => (
                  <div key={i} style={{
                    padding: '0.4rem 0.6rem', border: '1px solid var(--border)',
                    background: 'var(--bg-card)', color: 'var(--text)', fontSize: '0.8rem',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                  }}>
                    <span style={{ color: 'var(--accent)', fontSize: '0.7rem' }}>▸</span>
                    {item}
                    {item === c.signatureItem && (
                      <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: '0.6rem', letterSpacing: '0.06em' }}>
                        SIGNATURE
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── MESSAGES ────────────────────── */}
        {tab === 'messages' && (
          <div>
            <div className="panel" style={{ maxHeight: '40vh', overflowY: 'auto', marginBottom: '0.75rem' }}>
              {playerMessages.length === 0 ? (
                <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', textAlign: 'center' }}>
                  No transmissions received.
                </p>
              ) : (
                [...playerMessages].reverse().map(m => (
                  <div key={m.id} style={{
                    padding: '0.75rem', marginBottom: '0.5rem',
                    border: `1px solid ${m.from === 'MUTHUR' ? 'var(--accent)' : 'var(--border)'}`,
                    background: m.from === 'MUTHUR' ? 'rgba(0,212,170,0.05)' : 'transparent',
                  }}>
                    {m.from === 'MUTHUR' && (
                      <div style={{ color: 'var(--accent)', fontSize: '0.65rem', letterSpacing: '0.15em', marginBottom: '0.35rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem' }}>
                        ════ INCOMING TRANSMISSION ════
                        <br />FROM: MU/TH/UR 6000 &nbsp;|&nbsp; PRIORITY: {m.priority}
                      </div>
                    )}
                    {m.from !== 'MUTHUR' && (
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.65rem', marginBottom: '0.25rem' }}>
                        SENT — {new Date(m.timestamp).toLocaleTimeString()}
                      </div>
                    )}
                    <div style={{ color: 'var(--text)', fontSize: '0.85rem', lineHeight: '1.5' }}>{m.text}</div>
                    {m.from === 'MUTHUR' && (
                      <div style={{ color: 'var(--accent)', fontSize: '0.6rem', letterSpacing: '0.1em', marginTop: '0.35rem', borderTop: '1px solid var(--border)', paddingTop: '0.25rem' }}>
                        ═══════════════════════════
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSend} className="panel">
              <label style={labelStyle}>TRANSMIT TO MUTHUR</label>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <input value={msgText} onChange={e => setMsgText(e.target.value)}
                  placeholder="Type message..." style={{ ...inputStyle, flex: 1 }} />
                <button type="submit" disabled={!msgText.trim()} style={tabBtn}>SEND</button>
              </div>
            </form>
          </div>
        )}

        {/* ─── DOSSIER ─────────────────────── */}
        {tab === 'sheet' && (
          <div>
            <div className="panel">
              <label style={labelStyle}>APPEARANCE</label>
              <p style={{ color: 'var(--text)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{c.appearance}</p>

              <label style={labelStyle}>PERSONAL AGENDA</label>
              <p style={{ color: 'var(--text)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{c.personalAgenda}</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={labelStyle}>BUDDY</label>
                  <p style={{ color: 'var(--accent)', fontSize: '0.8rem' }}>{c.buddy}</p>
                </div>
                <div>
                  <label style={labelStyle}>RIVAL</label>
                  <p style={{ color: '#c04040', fontSize: '0.8rem' }}>{c.rival}</p>
                </div>
              </div>
            </div>

            <div className="panel" style={{ marginTop: '0.75rem' }}>
              <label style={labelStyle}>SIGNATURE ITEM</label>
              <p style={{ color: 'var(--text)', fontSize: '0.8rem' }}>{c.signatureItem}</p>
            </div>
          </div>
        )}

        {/* Disconnect */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button onClick={leaveGame} style={{ ...tabBtn, borderColor: '#c04040', color: '#c04040' }}>
            DISCONNECT FROM SESSION
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBar({ label, value, max, color, danger }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.65rem', letterSpacing: '0.08em' }}>{label}</span>
        <span style={{ color: danger ? '#c04040' : color, fontSize: '0.85rem', fontWeight: 'bold' }}>{value}/{max}</span>
      </div>
      <div style={{ height: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div style={{
          height: '100%', width: `${pct}%`, transition: 'width 0.3s',
          background: danger ? '#c04040' : color,
          boxShadow: danger ? '0 0 8px rgba(192,64,64,0.5)' : 'none',
        }} />
      </div>
    </div>
  );
}

const btnStyle = {
  padding: '0.5rem 1rem', background: 'transparent',
  border: '1px solid var(--border)', color: 'var(--text-dim)',
  fontFamily: "'Share Tech Mono', monospace", fontSize: '0.75rem',
  letterSpacing: '0.06em', cursor: 'pointer',
};

const tabBtn = {
  padding: '0.4rem 0.7rem', background: 'transparent',
  border: '1px solid var(--border)', color: 'var(--text-dim)',
  fontFamily: "'Share Tech Mono', monospace", fontSize: '0.7rem',
  letterSpacing: '0.06em', cursor: 'pointer',
};

const labelStyle = {
  display: 'block', color: 'var(--text-dim)', fontSize: '0.65rem',
  letterSpacing: '0.12em', marginBottom: '0.3rem',
};

const inputStyle = {
  padding: '0.5rem', background: 'var(--bg-card)',
  border: '1px solid var(--border)', color: 'var(--text)',
  fontFamily: "'Share Tech Mono', monospace", fontSize: '0.8rem',
  boxSizing: 'border-box',
};
