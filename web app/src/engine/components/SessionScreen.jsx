import React, { useState, useEffect } from 'react';
import { useGame } from '../GameContext';
import { useUniverse } from '../UniverseContext';
import { useContent } from '../ContentContext';
import SessionZeroPanel, { emptySessionZero } from './run/SessionZeroPanel';
import { poolDefs, poolStart } from '../mechanicsUtils';
import { getApiToken, setApiToken } from '../apiToken';

export default function SessionScreen() {
  const {
    connected, createGame, joinGame, role, listResumable, resumeGame, hasDmToken,
    claimSeat, cancelSeatClaim, seatClaim, sessionNotice, clearSessionNotice,
  } = useGame();
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
  const [nameTaken, setNameTaken] = useState(false);      // join answered NAME_IN_USE → offer a seat claim

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

  // Same order as the STORIES library: cinematic scenarios, one-shots, then campaign operations.
  const typeRank = (p) => { const i = ['Cinematic', 'One-Shot', 'Campaign'].indexOf(p.meta.type); return i < 0 ? 3 : i; };
  const scenarioPacks = packs
    .filter(p => p.kind === 'scenario' || p.kind === 'campaign')
    .sort((a, b) => typeRank(a) - typeRank(b) || a.meta.title.localeCompare(b.meta.title));

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
    setNameTaken(false);
    clearSessionNotice();
    joinGame(joinCode, playerName, (response) => {
      setLoading(false);
      if (response?.error) {
        setError(response.error);
        setNameTaken(response.code === 'NAME_IN_USE');
      }
    });
  };

  /* "That's me on a new phone": ask the GM to hand over the seat with this name. */
  const handleClaim = () => {
    setLoading(true);
    setError('');
    claimSeat(joinCode, playerName.trim(), (r) => {
      setLoading(false);
      if (r?.error) setError(r.error);
      else setNameTaken(false);
    });
  };

  const cancel = () => { setMode(null); setError(''); setNameTaken(false); };
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

        {sessionNotice && !seatClaim && (
          <div className="ss-notice" role="status">
            <span>{sessionNotice}</span>
            <button type="button" onClick={clearSessionNotice}>OK</button>
          </div>
        )}

        {seatClaim && (
          <div className="panel ss-claim-wait" role="status">
            <h3 style={stepTitle}>SEAT REQUEST SENT</h3>
            <p>
              WAITING FOR THE {terms.gm.toUpperCase()} TO CONFIRM YOU AS <b>{String(seatClaim.name).toUpperCase()}</b>
              {' '}IN {terms.session.toUpperCase()} {seatClaim.code}…
            </p>
            {!seatClaim.dmConnected && (
              <p className="ss-claim-sub">THE {terms.gm.toUpperCase()} IS OFFLINE — THE REQUEST WAITS UP TO 2 MINUTES.</p>
            )}
            <button type="button" onClick={cancelSeatClaim} style={btnSecondary}>CANCEL REQUEST</button>
          </div>
        )}

        {!mode && chosen && (
          <ResumableSessions universe={universe} terms={terms} packs={packs} connected={connected}
            listResumable={listResumable} resumeGame={resumeGame} hasDmToken={hasDmToken} onError={setError} />
        )}
        {!mode && chosen && <TakeoverPanel terms={terms} connected={connected} resumeGame={resumeGame} onError={setError} />}

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
              You will assume the role of the {terms.gm}. The {terms.players.toLowerCase()} connect with the access code
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
                autoFocus={joinCode.length !== 4}
                autoComplete="off"
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
                autoFocus={joinCode.length === 4}
                autoComplete="nickname"
                maxLength={40}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" disabled={loading || !connected || !!seatClaim} style={btnStyle}>
                {loading ? 'AUTHENTICATING...' : 'AUTHENTICATE'}
              </button>
              <button type="button" onClick={cancel} style={btnSecondary}>
                CANCEL
              </button>
            </div>
            {nameTaken && !seatClaim && (
              <div className="ss-claim-offer">
                <p>IS THIS YOUR SEAT ON A NEW DEVICE? THE {terms.gm.toUpperCase()} CAN HAND IT OVER.</p>
                <button type="button" onClick={handleClaim} disabled={loading || !connected} style={btnStyle}>
                  ASK THE {terms.gm.toUpperCase()} FOR THIS SEAT
                </button>
              </div>
            )}
          </form>
        )}

        {(!mode || mode === 'create') && chosen && <AdvancedFold />}

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
    <button type="button" onClick={onClick} aria-pressed={active} style={{
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
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (!connected) return undefined;
    const load = () => listResumable(setList);
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [connected, listResumable]);

  // The server lists only games this browser holds a GM token for.
  const rows = list.filter(g => g.universeId === universe.id && hasDmToken(g.code));
  if (rows.length === 0) return null;

  const packTitle = (id) => (id ? packs.find(p => p.id === id)?.meta?.title : null) || 'SANDBOX';

  const go = (code) => {
    setBusy(code);
    onError('');
    resumeGame(code, null, (r) => {
      setBusy(null);
      if (r?.error) onError(r.error);
    });
  };

  return (
    <div className="panel resume-panel">
      <h3 className="resume-title">RESUMABLE {terms.session.toUpperCase()}S</h3>
      {rows.map(g => (
        <div key={g.code} className="resume-card">
          <div className="resume-card-main">
            <span className="resume-code">{g.code}</span>
            <span className="resume-meta">
              {String(packTitle(g.packId)).toUpperCase()} · {g.players} {terms.players.toUpperCase()} · {ago(g.updatedAt)}
              {' · '}{g.status === 'live' ? (g.dmConnected ? 'OPEN ON ANOTHER TAB' : 'LIVE') : 'DORMANT'}
            </span>
          </div>
          <button className="resume-btn" disabled={busy === g.code} onClick={() => go(g.code)}>
            {busy === g.code ? '…' : 'RESUME'}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── TAKE OVER (DM): another terminal's session, authorized by its 6-digit GM PIN ── */
function TakeoverPanel({ terms, connected, resumeGame, onError }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <button type="button" className="resume-take ss-takeover-open" onClick={() => setOpen(true)} disabled={!connected}>
        TAKE OVER {/^[AEIOU]/i.test(terms.session) ? 'AN' : 'A'} {terms.session.toUpperCase()} FROM ANOTHER TERMINAL (GM PIN)
      </button>
    );
  }
  const submit = (e) => {
    e.preventDefault();
    if (!/^[A-Z]{4}$/.test(code) || !/^\d{6}$/.test(pin)) { onError('ENTER THE 4-LETTER CODE AND THE 6-DIGIT GM PIN.'); return; }
    setBusy(true);
    onError('');
    resumeGame(code, { takeover: true, pin }, (r) => {
      setBusy(false);
      if (r?.error) onError(r.error);
    });
  };
  return (
    <form className="panel resume-panel ss-takeover" onSubmit={submit}>
      <h3 className="resume-title">TAKE OVER {/^[AEIOU]/i.test(terms.session) ? 'AN' : 'A'} {terms.session.toUpperCase()}</h3>
      <p className="resume-meta">
        THE GM PIN WAS SHOWN WHEN THE {terms.session.toUpperCase()} STARTED (SHOW PIN ON THE {terms.gmShort} HEADER).
        THE OTHER TERMINAL IS SIGNED OUT.
      </p>
      <div className="resume-take-form">
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
          placeholder="CODE" maxLength={4} autoFocus aria-label="Session code" />
        <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="PIN" inputMode="numeric" maxLength={6} aria-label="GM PIN" />
        <button type="submit" className="resume-btn" disabled={busy || !connected}>{busy ? '…' : 'TAKE OVER'}</button>
        <button type="button" className="resume-take" onClick={() => { setOpen(false); onError(''); }}>CANCEL</button>
      </div>
    </form>
  );
}

/* ── ADVANCED: shared API token for the content / generate APIs (server env API_TOKEN) ── */
function AdvancedFold() {
  const [value, setValue] = useState(getApiToken);
  const [saved, setSaved] = useState(false);
  return (
    <details className="ss-advanced">
      <summary>ADVANCED</summary>
      <label style={labelStyle}>API TOKEN (ONLY IF THE SERVER SETS API_TOKEN)</label>
      <div className="resume-take-form">
        <input type="password" value={value} autoComplete="off" onChange={e => { setValue(e.target.value); setSaved(false); }}
          placeholder="NOT SET" aria-label="API token" style={{ width: '100%' }} />
        <button type="button" className="resume-btn" onClick={() => { setApiToken(value); setSaved(true); }}>{saved ? 'SAVED' : 'SAVE'}</button>
      </div>
      <p className="resume-meta">Needed to save / delete content packs and run the generator when the server is locked.</p>
    </details>
  );
}
