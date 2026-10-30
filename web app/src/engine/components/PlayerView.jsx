import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGame } from '../GameContext';
import { useUniverse } from '../UniverseContext';
import { attributeLabel, skillInfo } from '../rulesUtils';
import PlayerMapPane from './board/PlayerMapPane';

/* ═══════════════════════════════════════════════════════════════
   PlayerView — phone-first player terminal.
   Layout: sticky top bar (name + compact tracks) / scrolling tab body /
   bottom tab bar (SHEET · INVENTORY · COMMS · DICE). 100dvh, safe-area aware.
   Styling lives in index.css under "Player view (mobile)".
   ═══════════════════════════════════════════════════════════════ */

const MUTE_KEY = 'muthur.muted';
const readMuted = () => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } };

/* Short beep (Web Audio) + vibration for incoming transmissions. */
function useAlertFx() {
  const [muted, setMuted] = useState(readMuted);
  const mutedRef = useRef(muted);
  const ctxRef = useRef(null);

  useEffect(() => {
    mutedRef.current = muted;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* ignore */ }
  }, [muted]);

  // Browsers only allow audio after a user gesture: unlock on first touch.
  useEffect(() => {
    const unlock = () => {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!ctxRef.current) ctxRef.current = new AC();
        if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
      } catch { /* audio unavailable */ }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const fire = useCallback(() => {
    if (mutedRef.current) return;
    try { navigator.vibrate?.(200); } catch { /* ignore */ }
    try {
      const ctx = ctxRef.current;
      if (!ctx || ctx.state !== 'running') return;
      const t0 = ctx.currentTime;
      [[880, 0], [660, 0.14]].forEach(([freq, at]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + at);
        gain.gain.exponentialRampToValueAtTime(0.12, t0 + at + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.12);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0 + at);
        osc.stop(t0 + at + 0.13);
      });
    } catch { /* ignore */ }
  }, []);

  return { muted, setMuted, fire };
}

function IncomingAlert({ message, onDismiss, terminal, terms }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 12000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const fromGm = message.type === 'gm';
  const color = fromGm ? 'var(--accent)' : 'var(--blue)';

  return (
    <div className="pv-alert" onClick={onDismiss}>
      <div className="pv-alert-box" style={{ '--alert-color': color }} onClick={e => e.stopPropagation()}>
        <div className="pv-alert-head">
          {fromGm ? `▓▓ INCOMING ${terminal.name} ${terms.message.toUpperCase()} ▓▓` : `▓▓ ${terms.message.toUpperCase()} FROM ${String(message.from).toUpperCase()} ▓▓`}
          <br />
          <span>PRIORITY: {message.priority} &nbsp;|&nbsp; {new Date(message.timestamp).toLocaleTimeString()}</span>
        </div>
        <div className="pv-alert-text">{message.text}</div>
        <button className="pv-btn pv-alert-ack" onClick={onDismiss}>ACKNOWLEDGE</button>
      </div>
    </div>
  );
}

export default function PlayerView() {
  const {
    myPlayer, messages, sendPlayerMessage, sendPlayerToPlayer, leaveGame, unreadCount, clearUnread,
    gameCode, connectedPlayers, connected, dmOnline,
  } = useGame();
  const { universe } = useUniverse();
  const { terms, terminal, rules } = universe;
  const [tab, setTab] = useState('sheet');
  const [alertQueue, setAlertQueue] = useState([]);
  const seenIds = useRef(null);
  const [target, setTarget] = useState('dm');
  const [text, setText] = useState('');
  const chatEnd = useRef(null);
  const { muted, setMuted, fire } = useAlertFx();

  const c = myPlayer?.character;
  const PLAYER = terms.player.toUpperCase();
  const PLAYERS = terms.players.toUpperCase();
  const MESSAGE = terms.message.toUpperCase();
  const GM = terms.gm.toUpperCase();
  const myId = myPlayer?.id;

  const chat = messages
    .filter(m => m.type !== undefined && (m.toId === myId || m.fromId === myId || m.toId === 'broadcast'))
    .sort((a, b) => a.timestamp - b.timestamp);

  /* Alert (overlay + vibrate + beep) only for messages not seen before.
     History restored after a reconnect is pre-seen except what arrived while away. */
  useEffect(() => {
    if (!seenIds.current) { seenIds.current = new Set(messages.map(m => m.id)); return; }
    const fresh = messages.filter(m => !seenIds.current.has(m.id));
    if (!fresh.length) return;
    fresh.forEach(m => seenIds.current.add(m.id));
    const incoming = fresh.filter(m => (m.toId === myId || m.toId === 'broadcast') && m.fromId !== myId).slice(-3);
    if (incoming.length) {
      setAlertQueue(prev => [...prev, ...incoming]);
      fire();
    }
  }, [messages, myId, fire]);

  const dismissAlert = useCallback(() => setAlertQueue(prev => prev.slice(1)), []);

  useEffect(() => {
    if (tab === 'messages') {
      if (unreadCount > 0) clearUnread();
      chatEnd.current?.scrollIntoView({ block: 'end' });
    }
  }, [tab, chat.length, unreadCount, clearUnread]);

  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (target === 'dm') sendPlayerMessage(text);
    else sendPlayerToPlayer(target, text);
    setText('');
  };

  const otherPlayers = (connectedPlayers || []).filter(p => p.id !== myId);

  /* Waiting screen — no character assigned yet */
  if (!c) {
    return (
      <div className="app pv-screen">
        <div className="crt-overlay" />
        <h1 className="pv-title">{terminal.name}</h1>
        <div className="panel pv-center-card">
          <div className="pulse-line" style={{ height: '2px', background: 'var(--accent)', marginBottom: '1rem', animation: 'pulse 2s infinite' }} />
          <h2 style={{ fontSize: '0.9rem', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>AUTHENTICATION CONFIRMED</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '1rem' }}>
            Welcome, {myPlayer?.name}. Stand by for character assignment from {terms.gm}.
          </p>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>AWAITING ASSIGNMENT...</p>
          {!connected && <p className="pv-offline">RECONNECTING…</p>}
        </div>
        <button className="pv-btn" onClick={leaveGame}>DISCONNECT</button>
      </div>
    );
  }

  /* Death screen — full-screen obituary */
  if (!myPlayer.alive) {
    return (
      <div className="app pv-screen pv-dead">
        <div className="crt-overlay" />
        <div className="pv-dead-frame">
          <div className="pv-dead-label">{terminal.name} — {PLAYER} STATUS</div>
          <h1 className="pv-dead-title">{PLAYER} DECEASED</h1>
          <div className="pv-dead-name">{c.name}</div>
          {c.career && <div className="pv-dead-sub">{c.career}</div>}
          <div className="pv-dead-rule" />
          <div className="pv-dead-wait">AWAITING REASSIGNMENT</div>
          <p className="pv-dead-note">Stand by for new character assignment from {terms.gm}.</p>
          {(!connected || !dmOnline) && <p className="pv-offline">{!connected ? 'RECONNECTING…' : `${GM} OFFLINE`}</p>}
        </div>
      </div>
    );
  }

  const tabs = [
    ['sheet', 'SHEET'],
    ['inventory', 'INVENTORY'],
    ['messages', `${MESSAGE}S`],
    ['map', 'MAP'],
    ['dice', 'DICE'],
  ];
  const Roller = rules?.dice?.Roller;

  return (
    <div className="app pv-root">
      <div className="crt-overlay" />

      {alertQueue.length > 0 && (
        <IncomingAlert message={alertQueue[0]} onDismiss={dismissAlert} terminal={terminal} terms={terms} />
      )}

      {/* ─── Sticky top bar ─── */}
      <header className="pv-top">
        <div className="pv-top-row">
          <div className="pv-who">
            <span className="pv-name">{c.name}</span>
            <span className="pv-sub">{c.career} · {terms.session.toUpperCase()} {gameCode}</span>
          </div>
          <span className={`pv-link ${connected ? 'up' : 'down'}`}><span className="link-dot" />{connected ? 'LINK' : 'RECONNECTING…'}</span>
          <button className="pv-icon-btn" aria-label={muted ? 'Unmute alerts' : 'Mute alerts'} aria-pressed={muted}
            onClick={() => setMuted(m => !m)}>
            {muted ? 'MUTED' : 'SOUND'}
          </button>
        </div>
        <div className="pv-tracks">
          {(rules.tracks || []).map(t => {
            const value = myPlayer.tracks?.[t.key] ?? 0;
            const max = myPlayer.trackMax?.[t.key] ?? 0;
            const danger = typeof t.danger === 'function' ? t.danger(value, max) : false;
            return <TrackBar key={t.key} label={t.short || t.label} value={value} max={max} color={t.color || 'var(--accent)'} danger={danger} />;
          })}
        </div>
        {!dmOnline && <div className="pv-banner">{GM} OFFLINE — YOUR STATE IS SAVED</div>}
      </header>

      {/* ─── Tab body ─── */}
      <main className={`pv-body${tab === 'messages' ? ' pv-body-chat' : ''}${tab === 'map' ? ' pv-body-map' : ''}`}>
        {tab === 'sheet' && (
          <div className="pv-pane">
            <section className="panel">
              <label className="pv-label">ATTRIBUTES</label>
              <div className="pv-attrs">
                {Object.entries(c.attributes || {}).map(([attr, val]) => (
                  <div key={attr} className="pv-attr">
                    <div className="pv-attr-k">{attributeLabel(universe, attr, { short: true })}</div>
                    <div className="pv-attr-v">{val}</div>
                  </div>
                ))}
              </div>
              {myPlayer.statusEffects?.length > 0 && (
                <>
                  <label className="pv-label" style={{ marginTop: '0.75rem' }}>ACTIVE CONDITIONS</label>
                  <div className="pv-chips">
                    {myPlayer.statusEffects.map(e => <span key={e} className="pv-chip danger">{e}</span>)}
                  </div>
                </>
              )}
            </section>

            {c.talent && (
              <section className="panel">
                <label className="pv-label">TALENT</label>
                <p className="pv-text">{c.talent}</p>
              </section>
            )}

            <section className="panel">
              <label className="pv-label">SKILLS</label>
              <div className="pv-skills">
                {Object.entries(c.skills || {}).map(([key, val]) => {
                  const info = skillInfo(universe, key);
                  return (
                    <div key={key} className="pv-skill">
                      <span>{info.label}{info.attr && <small> ({info.attr})</small>}</span>
                      <b className={val > 0 ? 'on' : ''}>{val}</b>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="panel">
              <label className="pv-label">DOSSIER</label>
              {c.appearance && <><label className="pv-sublabel">APPEARANCE</label><p className="pv-text">{c.appearance}</p></>}
              {c.personalAgenda && <><label className="pv-sublabel">PERSONAL AGENDA</label><p className="pv-text">{c.personalAgenda}</p></>}
              {c.secret && <><label className="pv-sublabel">SECRET</label><p className="pv-text" style={{ color: 'var(--warn)' }}>{c.secret}</p></>}
              <div className="pv-two">
                {c.buddy && <div><label className="pv-sublabel">BUDDY</label><p className="pv-text" style={{ color: 'var(--accent)' }}>{c.buddy}</p></div>}
                {c.rival && <div><label className="pv-sublabel">RIVAL</label><p className="pv-text" style={{ color: 'var(--danger)' }}>{c.rival}</p></div>}
              </div>
              {c.signatureItem && <><label className="pv-sublabel">SIGNATURE ITEM</label><p className="pv-text">{c.signatureItem}</p></>}
            </section>

            <button className="pv-btn danger" onClick={leaveGame}>DISCONNECT FROM {terms.session.toUpperCase()}</button>
          </div>
        )}

        {tab === 'inventory' && (
          <div className="pv-pane">
            <section className="panel">
              <label className="pv-label">EQUIPMENT &amp; GEAR</label>
              {myPlayer.inventory.length === 0 ? (
                <p className="pv-text dim">No items.</p>
              ) : (
                <div className="pv-items">
                  {myPlayer.inventory.map((item, i) => (
                    <div key={i} className="pv-item">
                      <span className="pv-item-mark">▸</span>
                      <span>{item}</span>
                      {item === c.signatureItem && <small>SIGNATURE</small>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === 'messages' && (
          <>
            <div className="pv-chat">
              {chat.length === 0 && <p className="pv-text dim" style={{ textAlign: 'center' }}>No {terms.message.toLowerCase()}s received.</p>}
              {chat.map(m => {
                const mine = m.fromId === myId;
                const kind = m.type === 'gm' ? 'gm' : m.type === 'p2p' ? 'p2p' : 'dm-bound';
                return (
                  <div key={m.id} className={`pv-bubble ${mine ? 'mine' : 'theirs'} ${kind}`}>
                    <div className="pv-bubble-meta">
                      {mine
                        ? `TO ${m.type === 'p2p' ? String(m.to).toUpperCase() : GM}`
                        : m.type === 'gm' ? `${GM}${m.toId === 'broadcast' ? ` · ${terms.broadcast?.toUpperCase() || 'BROADCAST'}` : ''}` : `${String(m.from).toUpperCase()} · ${PLAYER}`}
                      {m.type === 'gm' && m.priority && m.priority !== 'STANDARD' && <b> · {m.priority}</b>}
                      {' · '}{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="pv-bubble-text">{m.text}</div>
                  </div>
                );
              })}
              <div ref={chatEnd} />
            </div>
            <form className="pv-compose" onSubmit={send}>
              <select value={target} onChange={e => setTarget(e.target.value)} aria-label="Recipient">
                <option value="dm">{terms.gmShort} ({terms.gm})</option>
                {otherPlayers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}{p.connected === false ? ' (offline)' : ''} (secret)</option>
                ))}
              </select>
              <div className="pv-compose-row">
                <input value={text} onChange={e => setText(e.target.value)} placeholder={`Type ${terms.message.toLowerCase()}...`}
                  enterKeyHint="send" autoComplete="off" />
                <button type="submit" className="pv-btn primary" disabled={!text.trim()}>SEND</button>
              </div>
            </form>
          </>
        )}

        {tab === 'map' && <PlayerMapPane />}

        {tab === 'dice' && (
          <div className="pv-pane pv-dice">
            {Roller ? <Roller /> : <div className="panel"><p className="pv-text dim">No dice roller is registered for {universe.name}.</p></div>}
          </div>
        )}
      </main>

      {/* ─── Bottom tab bar ─── */}
      <nav className="pv-tabs" aria-label="Terminal sections" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}>
            {label}
            {id === 'messages' && unreadCount > 0 && tab !== 'messages' && <span className="pv-badge">{unreadCount}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

function TrackBar({ label, value, max, color, danger }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const fill = danger ? 'var(--danger)' : color;
  return (
    <div className="pv-track">
      <div className="pv-track-head">
        <span>{label}</span>
        <b style={{ color: fill }}>{value}/{max}</b>
      </div>
      <div className="pv-track-bar"><div style={{ width: `${pct}%`, background: fill }} /></div>
    </div>
  );
}
