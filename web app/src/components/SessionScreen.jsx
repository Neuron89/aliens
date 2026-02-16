import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';

export default function SessionScreen() {
  const { connected, createGame, joinGame, role } = useGame();
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-detect join code from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join');
    if (code) {
      setMode('join');
      setJoinCode(code.toUpperCase());
    }
  }, []);

  if (role) return null;

  const handleCreate = () => {
    setLoading(true);
    setError('');
    createGame((response) => {
      setLoading(false);
      if (response.error) setError(response.error);
    });
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!joinCode.trim() || !playerName.trim()) {
      setError('ENTER GAME CODE AND YOUR NAME.');
      return;
    }
    setLoading(true);
    setError('');
    joinGame(joinCode, playerName, (response) => {
      setLoading(false);
      if (response.error) setError(response.error);
    });
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>
        <div className="panel" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', letterSpacing: '0.2em', marginBottom: '0.5rem' }}>
            SESSION LINK
          </h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
            {connected
              ? 'CONNECTION TO MU/TH/UR MAINFRAME — ESTABLISHED'
              : 'CONNECTING TO MU/TH/UR MAINFRAME...'}
          </p>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%', margin: '0.5rem auto',
            background: connected ? 'var(--accent)' : '#c04040',
            boxShadow: connected ? '0 0 8px var(--accent)' : '0 0 8px #c04040',
          }} />
        </div>

        {!mode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button className="nav-btn" onClick={() => setMode('create')} disabled={!connected}
              style={btnStyle}>
              INITIATE SESSION — GAME MOTHER (DM)
            </button>
            <button className="nav-btn" onClick={() => setMode('join')} disabled={!connected}
              style={btnStyle}>
              JOIN SESSION — CREW MEMBER (PLAYER)
            </button>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.7rem', textAlign: 'center', marginTop: '0.5rem' }}>
              The Game Mother creates a session and shares the access code with crew members.
            </p>
          </div>
        )}

        {mode === 'create' && (
          <div className="panel">
            <h3 style={{ color: 'var(--accent)', marginBottom: '1rem', letterSpacing: '0.1em' }}>
              INITIALIZE GAME SESSION
            </h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '1rem' }}>
              You will assume the role of Game Mother. Players will connect using the access code
              provided after initialization.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleCreate} disabled={loading || !connected} style={btnStyle}>
                {loading ? 'INITIALIZING...' : 'INITIALIZE'}
              </button>
              <button onClick={() => { setMode(null); setError(''); }} style={btnSecondary}>
                CANCEL
              </button>
            </div>
          </div>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="panel">
            <h3 style={{ color: 'var(--accent)', marginBottom: '1rem', letterSpacing: '0.1em' }}>
              CREW AUTHENTICATION
            </h3>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>ACCESS CODE</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="XXXX"
                maxLength={4}
                style={inputStyle}
                autoFocus
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>CREW NAME</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" disabled={loading || !connected} style={btnStyle}>
                {loading ? 'AUTHENTICATING...' : 'AUTHENTICATE'}
              </button>
              <button type="button" onClick={() => { setMode(null); setError(''); }} style={btnSecondary}>
                CANCEL
              </button>
            </div>
          </form>
        )}

        {error && (
          <div style={{
            marginTop: '1rem', padding: '0.75rem', border: '1px solid #c04040',
            color: '#c04040', fontSize: '0.8rem', textAlign: 'center',
            background: 'rgba(192,64,64,0.08)', letterSpacing: '0.05em',
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle = {
  flex: 1, padding: '0.75rem 1rem',
  background: 'rgba(0,212,170,0.08)', border: '1px solid var(--accent)',
  color: 'var(--accent)', fontFamily: "'Share Tech Mono', monospace",
  fontSize: '0.8rem', letterSpacing: '0.08em', cursor: 'pointer',
};

const btnSecondary = {
  ...btnStyle,
  background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-dim)',
};

const labelStyle = {
  display: 'block', color: 'var(--text-dim)', fontSize: '0.7rem',
  letterSpacing: '0.1em', marginBottom: '0.3rem',
};

const inputStyle = {
  width: '100%', padding: '0.6rem 0.75rem',
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  color: 'var(--text)', fontFamily: "'Share Tech Mono', monospace",
  fontSize: '0.9rem', letterSpacing: '0.08em', boxSizing: 'border-box',
};
