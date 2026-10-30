import React, { useState, useEffect } from 'react';
import { useGame } from '../GameContext';
import { useUniverse } from '../UniverseContext';
import { useContent } from '../ContentContext';
import SessionZeroPanel, { emptySessionZero } from './run/SessionZeroPanel';
import { poolDefs, poolStart } from '../mechanicsUtils';

export default function SessionScreen() {
  const { connected, createGame, joinGame, role, listResumable, resumeGame, hasDmToken } = useGame();
  const { universe, display, chosen, resetUniverse } = useUniverse();
  const { packs } = useContent();
  const { terms, terminal } = display;
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [packId, setPackId] = useState(null); // null = sandbox
  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionZero, setSessionZero] = useState(emptySessionZero);
  const [expectedPlayers, setExpectedPlayers] = useState(4);
  const [poolOverrides, setPoolOverrides] = useState({}); // key -> starting value typed by the GM

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

  const scenarioPacks = packs
    .filter(p => p.kind === 'scenario' || p.kind === 'campaign')
    .sort((a, b) => (a.meta.type || '').localeCompare(b.meta.type || '') || a.meta.title.localeCompare(b.meta.title));

  const handleCreate = () => {
    setLoading(true);
    setError('');
    const { enabled, tone, warnings, linesVeils } = sessionZero;
    const pools = universe.rules?.pools?.length
      ? { defs: poolDefs(universe), values: poolStart(universe, expectedPlayers, poolOverrides) }
      : null;
    createGame({ universeId: universe.id, packId, sessionZero: enabled ? { enabled, tone, warnings, linesVeils } : null, pools }, (response) => {
      setLoading(false);
      if (response?.error) setError(response.error);
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

  const cancel = () => { setMode(null); setError(''); };
  const gmLabel = `${terms.gm.toUpperCase()} (${terms.gmShort})`;
  const playerLabel = `${terms.player.toUpperCase()} (PLAYER)`;

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: mode === 'create' ? '720px' : '480px' }}>
        <div className="panel" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', letterSpacing: '0.2em', marginBottom: '0.5rem' }}>
            {terms.session.toUpperCase()} LINK
          </h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
            {connected
              ? `CONNECTION TO ${terminal.name} MAINFRAME — ESTABLISHED`
              : `CONNECTING TO ${terminal.name} MAINFRAME...`}
          </p>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%', margin: '0.5rem auto',
            background: connected ? 'var(--accent)' : 'var(--danger)',
            boxShadow: connected ? '0 0 8px var(--accent)' : '0 0 8px var(--danger)',
          }} />
        </div>

        {!mode && chosen && (
          <ResumableSessions universe={universe} terms={terms} packs={packs} connected={connected}
            listResumable={listResumable} resumeGame={resumeGame} hasDmToken={hasDmToken} onError={setError} />
        )}

        {!mode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {chosen ? (
              <button className="nav-btn" onClick={() => setMode('create')} disabled={!connected} style={btnStyle}>
                INITIATE {terms.session.toUpperCase()} — {gmLabel}
              </button>
            ) : (
              <button className="nav-btn" onClick={resetUniverse} style={btnStyle}>
                HOST A GAME — SELECT UNIVERSE
              </button>
            )}
            <button className="nav-btn" onClick={() => setMode('join')} disabled={!connected}
              style={btnStyle}>
              JOIN {terms.session.toUpperCase()} — {playerLabel}
            </button>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.7rem', textAlign: 'center', marginTop: '0.5rem' }}>
              The {terms.gm} creates {terms.sessionArticle || (/^[aeiou]/i.test(terms.session) ? 'an' : 'a')} {terms.session.toLowerCase()} and shares the access code with the {terms.players.toLowerCase()}.
            </p>
            {chosen && (
              <button onClick={resetUniverse} style={{ ...btnSecondary, flex: 'none', marginTop: '0.5rem' }}>
                ◂ CHANGE UNIVERSE ({universe.name})
              </button>
            )}
          </div>
        )}

        {mode === 'create' && (
          <div className="panel">
            <h3 style={stepTitle}>SELECT SCENARIO — {universe.name}</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
              You will assume the role of {terms.gm}. The {terms.players.toLowerCase()} connect with the access code
              provided after initialization. Characters from the selected scenario are offered first when assigning.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '45vh', overflowY: 'auto', marginBottom: '1rem' }}>
              <PackOption active={packId === null} onClick={() => setPackId(null)}
                title="NO SCENARIO — SANDBOX" subtitle="Free play. All characters available." />
              {scenarioPacks.map(p => (
                <PackOption key={p.id} active={packId === p.id} onClick={() => setPackId(p.id)}
                  title={p.meta.title} subtitle={p.meta.tagline}
                  badges={[p.meta.type, p.meta.source].filter(Boolean)} />
              ))}
            </div>
            <SessionZeroPanel pack={packs.find(p => p.id === packId) || null} value={sessionZero} onChange={setSessionZero} terms={terms} />
            {universe.rules?.pools?.length > 0 && (
              <div className="ss-pools">
                <h3 style={stepTitle}>STARTING POOLS</h3>
                <label className="ss-pool-row">
                  <span>EXPECTED {terms.players.toUpperCase()}</span>
                  <input type="number" min="1" max="12" value={expectedPlayers}
                    onChange={e => setExpectedPlayers(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))} />
                </label>
                {universe.rules.pools.map(p => {
                  const auto = poolStart(universe, expectedPlayers)[p.key];
                  return (
                    <label key={p.key} className="ss-pool-row">
                      <span>{p.label}{p.initialPerPlayer ? ` (${p.initialPerPlayer} × ${terms.players.toLowerCase()})` : ''}</span>
                      <input type="number" min="0" max={p.max || 99} placeholder={String(auto)} value={poolOverrides[p.key] ?? ''}
                        onChange={e => setPoolOverrides(o => ({ ...o, [p.key]: e.target.value }))} />
                    </label>
                  );
                })}
              </div>
            )}
            <ResumableSessions universe={universe} terms={terms} packs={packs} connected={connected}
              listResumable={listResumable} resumeGame={resumeGame} hasDmToken={hasDmToken} onError={setError} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleCreate} disabled={loading || !connected} style={btnStyle}>
                {loading ? 'INITIALIZING...' : 'INITIALIZE'}
              </button>
              <button onClick={cancel} style={btnSecondary}>CANCEL</button>
            </div>
          </div>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="panel">
            <h3 style={stepTitle}>{terms.joinPrompt}</h3>
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
              <label style={labelStyle}>{terms.player.toUpperCase()} NAME</label>
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
              <button type="button" onClick={cancel} style={btnSecondary}>
                CANCEL
              </button>
            </div>
          </form>
        )}

        {error && (
          <div style={{
            marginTop: '1rem', padding: '0.75rem', border: '1px solid var(--danger)',
            color: 'var(--danger)', fontSize: '0.8rem', textAlign: 'center',
            background: 'var(--danger-glow)', letterSpacing: '0.05em',
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function PackOption({ active, onClick, title, subtitle, badges = [] }) {
  return (
    <button onClick={onClick} style={{
      ...cardBtn, padding: '0.5rem 0.75rem',
      borderColor: active ? 'var(--accent)' : 'var(--border)',
      background: active ? 'var(--accent-glow)' : 'transparent',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
        <span style={{ color: active ? 'var(--accent)' : 'var(--text)', fontSize: '0.8rem', letterSpacing: '0.06em' }}>{title}</span>
        <span style={{ display: 'flex', gap: '0.25rem' }}>
          {badges.map(b => (
            <span key={b} style={{ fontSize: '0.55rem', letterSpacing: '0.08em', border: '1px solid var(--border)', color: 'var(--text-dim)', padding: '0.05rem 0.35rem' }}>
              {String(b).toUpperCase()}
            </span>
          ))}
        </span>
      </div>
      {subtitle && <div style={{ color: 'var(--text-dim)', fontSize: '0.65rem', marginTop: '0.15rem' }}>{subtitle}</div>}
    </button>
  );
}

const btnStyle = {
  flex: 1, padding: '0.75rem 1rem',
  background: 'var(--accent-glow)', border: '1px solid var(--accent)',
  color: 'var(--accent)', fontFamily: 'var(--font-mono)',
  fontSize: '0.8rem', letterSpacing: '0.08em', cursor: 'pointer',
};

const btnSecondary = {
  ...btnStyle,
  background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-dim)',
};

const cardBtn = {
  textAlign: 'left', padding: '0.75rem', border: '1px solid var(--border)',
  fontFamily: 'var(--font-mono)', cursor: 'pointer', color: 'var(--text)',
};

const stepTitle = { color: 'var(--accent)', marginBottom: '1rem', letterSpacing: '0.1em' };

const labelStyle = {
  display: 'block', color: 'var(--text-dim)', fontSize: '0.7rem',
  letterSpacing: '0.1em', marginBottom: '0.3rem',
};

const inputStyle = {
  width: '100%', padding: '0.6rem 0.75rem',
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  color: 'var(--text)', fontFamily: 'var(--font-mono)',
  fontSize: '0.9rem', letterSpacing: '0.08em', boxSizing: 'border-box',
};

/* ── RESUMABLE SESSIONS (DM): dormant/live games for the active universe ── */
function ago(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

function ResumableSessions({ universe, terms, packs, connected, listResumable, resumeGame, hasDmToken, onError }) {
  const [list, setList] = useState([]);
  const [takeCode, setTakeCode] = useState(null);   // code whose TAKE OVER box is open
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (!connected) return undefined;
    const load = () => listResumable(setList);
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [connected, listResumable]);

  const rows = list.filter(g => g.universeId === universe.id);
  if (rows.length === 0) return null;

  const packTitle = (id) => (id ? packs.find(p => p.id === id)?.meta?.title : null) || 'SANDBOX';

  const go = (code, opts) => {
    setBusy(code);
    onError('');
    resumeGame(code, opts, (r) => {
      setBusy(null);
      if (r?.error) onError(r.error);
    });
  };

  return (
    <div className="panel resume-panel">
      <h3 className="resume-title">RESUMABLE {terms.session.toUpperCase()}S</h3>
      {rows.map(g => {
        const mine = hasDmToken(g.code);
        return (
          <div key={g.code} className="resume-card">
            <div className="resume-card-main">
              <span className="resume-code">{g.code}</span>
              <span className="resume-meta">
                {String(packTitle(g.packId)).toUpperCase()} · {g.players} {terms.players.toUpperCase()} · {ago(g.updatedAt)}
                {' · '}{g.status === 'live' ? 'LIVE' : 'DORMANT'}
              </span>
            </div>
            {mine ? (
              <button className="resume-btn" disabled={busy === g.code} onClick={() => go(g.code)}>
                {busy === g.code ? '…' : 'RESUME'}
              </button>
            ) : (
              <div className="resume-foreign">
                <span>ANOTHER TERMINAL HOLDS THIS {terms.session.toUpperCase()}</span>
                {!g.dmConnected && takeCode !== g.code && (
                  <button className="resume-take" onClick={() => { setTakeCode(g.code); setTyped(''); }}>TAKE OVER</button>
                )}
                {!g.dmConnected && takeCode === g.code && (
                  <form className="resume-take-form" onSubmit={(e) => {
                    e.preventDefault();
                    if (typed.trim().toUpperCase() !== g.code) { onError('CODE DOES NOT MATCH.'); return; }
                    go(g.code, { takeover: true });
                  }}>
                    <input value={typed} onChange={e => setTyped(e.target.value.toUpperCase().slice(0, 4))}
                      placeholder={`TYPE ${g.code}`} maxLength={4} autoFocus />
                    <button type="submit" className="resume-take">CONFIRM</button>
                  </form>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
