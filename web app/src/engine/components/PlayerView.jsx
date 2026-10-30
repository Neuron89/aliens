import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGame } from '../GameContext';
import { useUniverse } from '../UniverseContext';
import PlayerMapPane from './board/PlayerMapPane';
import CharacterSheet from './CharacterSheet';
import { useFx } from './player/fx';
import PhoneLayer from './player/PhoneLayer';
import HandoutsPane from './player/HandoutsPane';
import ClocksRow from './player/ClocksRow';
import PauseButton from './player/PauseButton';
import BuildCharacter from './player/BuildCharacter';

/* ═══════════════════════════════════════════════════════════════
   PlayerView — phone-first player terminal.
   Layout: sticky top bar (name, PAUSE, sound, compact tracks, clocks,
   connection banners) / scrolling tab body / bottom tab bar
   (SHEET · GEAR · COMMS · HANDOUTS · MAP · DICE). 100dvh, safe-area aware.
   Session effects (handouts, orders, clues, loot, narration, session zero)
   live in player/PhoneLayer. Styling: index.css "Player view (mobile)" and
   "Session features".
   ═══════════════════════════════════════════════════════════════ */

function IncomingAlert({ message, onDismiss, onReply, terminal, terms }) {
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
        <div className="ph-alert-btns">
          <button className="pv-btn" onClick={() => { onDismiss(); onReply(fromGm ? 'dm' : message.fromId); }}>REPLY PRIVATELY</button>
          <button className="pv-btn pv-alert-ack" onClick={onDismiss}>ACKNOWLEDGE</button>
        </div>
      </div>
    </div>
  );
}

export default function PlayerView() {
  const {
    myPlayer, messages, sendPlayerMessage, sendPlayerToPlayer, leaveGame, unreadCount, clearUnread,
    gameCode, connectedPlayers, connected, dmOnline, table, outboxCount, sendRoll,
  } = useGame();
  const { universe } = useUniverse();
  const { terms, terminal, rules } = universe;
  const [tab, setTab] = useState('sheet');
  const [alertQueue, setAlertQueue] = useState([]);
  const seenIds = useRef(null);
  const [target, setTarget] = useState('dm');
  const [text, setText] = useState('');
  const chatEnd = useRef(null);
  const inputRef = useRef(null);
  const fx = useFx();
  const { muted, setMuted, play } = fx;
  const [viewer, setViewer] = useState(null);     // handout open in the reader
  const [order, setOrder] = useState(null);       // orders card open
  const [pulseId, setPulseId] = useState(null);   // clock that just ticked
  const [building, setBuilding] = useState(false);
  const [rollPreset, setRollPreset] = useState(null);

  const c = myPlayer?.character;
  const PLAYER = terms.player.toUpperCase();
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
      play('alert');
    }
  }, [messages, myId, play]);

  const dismissAlert = useCallback(() => setAlertQueue(prev => prev.slice(1)), []);
  const reply = useCallback((to = 'dm') => {
    setTarget(to || 'dm');
    setTab('messages');
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);
  const onClockTick = useCallback((id) => {
    setPulseId(id);
    setTimeout(() => setPulseId(p => (p === id ? null : p)), 1600);
  }, []);

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
  const layer = (
    <PhoneLayer fx={fx} viewer={viewer} setViewer={setViewer} order={order} setOrder={setOrder}
      onClockTick={onClockTick} onReply={() => reply('dm')} />
  );
  const lostBanner = !connected && (
    <div className="ph-lost" role="status">
      CONNECTION LOST — RECONNECTING…{outboxCount > 0 ? ` ${outboxCount} ACTION${outboxCount > 1 ? 'S' : ''} QUEUED` : ''}
    </div>
  );

  /* Waiting screen — no character assigned yet (build one, or wait for the GM) */
  if (!c) {
    const sub = table?.submission;
    if (building) {
      return (
        <div className="app pv-root ph-build-root">
          {layer}
          {lostBanner}
          <BuildCharacter onDone={() => setBuilding(false)} />
        </div>
      );
    }
    return (
      <div className="app pv-screen">
        <div className="crt-overlay" />
        {layer}
        <div className="ph-wait-top"><PauseButton /></div>
        <h1 className="pv-title">{terminal.name}</h1>
        <div className="panel pv-center-card">
          <div className="pulse-line" style={{ height: '2px', background: 'var(--accent)', marginBottom: '1rem', animation: 'pulse 2s infinite' }} />
          <h2 style={{ fontSize: '0.9rem', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>AUTHENTICATION CONFIRMED</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '1rem' }}>
            Welcome, {myPlayer?.name}. Stand by for character assignment from {terms.gm}, or build your own.
          </p>
          {sub?.status === 'pending' && <p className="ph-sub-status">SUBMITTED: {sub.name || 'your character'} — AWAITING {terms.gmShort || GM} APPROVAL</p>}
          {sub?.status === 'rejected' && <p className="ph-sub-status rejected">{terms.gmShort || GM} RETURNED YOUR CHARACTER{sub.reason ? `: “${sub.reason}”` : ''} — EDIT AND RESUBMIT</p>}
          <button type="button" className="pv-btn primary ph-wide" onClick={() => setBuilding(true)}>
            {sub?.status === 'pending' ? 'EDIT MY CHARACTER' : 'BUILD YOUR CHARACTER'}
          </button>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.7rem', marginTop: '0.75rem' }}>AWAITING ASSIGNMENT...</p>
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

  const unseenHandouts = (table?.handouts || []).filter(h => !h.seen).length;
  const tabs = [
    ['sheet', 'SHEET'],
    ['inventory', 'GEAR'],
    ['messages', 'COMMS'],
    ['handouts', 'FILES'],
    ['map', 'MAP'],
    ['dice', 'DICE'],
  ];
  const Roller = rules?.dice?.Roller;
  const activeConditions = Object.entries(myPlayer.conditions || {}).filter(([, on]) => on).map(([k]) => k);

  /* Tap-to-roll: the sheet's ROLL opens the universe roller pre-filled (preset prop). */
  const onRoll = (skillKey, pool) => {
    setRollPreset({
      skillKey, attrKey: pool.attrKey, kind: pool.kind,
      attr: pool.attr, skill: pool.skill, bonus: pool.bonus, total: pool.total,
      label: `${skillKey.toUpperCase()} — ${pool.label}`,
      stress: Number(myPlayer.tracks?.stress) || 0,
      at: Date.now(),
    });
    setTab('dice');
  };

  return (
    <div className="app pv-root">
      <div className="crt-overlay" />
      {layer}

      {alertQueue.length > 0 && (
        <IncomingAlert message={alertQueue[0]} onDismiss={dismissAlert} onReply={reply} terminal={terminal} terms={terms} />
      )}

      {/* ─── Sticky top bar ─── */}
      <header className="pv-top">
        <div className="pv-top-row">
          <div className="pv-who">
            <span className="pv-name">{c.name}</span>
            <span className="pv-sub">{c.career} · {terms.session.toUpperCase()} {gameCode}</span>
          </div>
          <span className={`pv-link ${connected ? 'up' : 'down'}`}><span className="link-dot" />{connected ? 'LINK' : 'LOST'}</span>
          <PauseButton />
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
        <ClocksRow clocks={table?.clocks || []} pulseId={pulseId} />
        {lostBanner}
        {table?.paused && <div className="pv-banner ph-paused">TABLE PAUSED — TAKE A BREATH</div>}
        {!dmOnline && connected && <div className="pv-banner">{GM} OFFLINE — YOUR STATE IS SAVED</div>}
      </header>

      {/* ─── Tab body ─── */}
      <main className={`pv-body${tab === 'messages' ? ' pv-body-chat' : ''}${tab === 'map' ? ' pv-body-map' : ''}`}>
        {tab === 'sheet' && (
          <div className="pv-pane ph-sheet-pane">
            <CharacterSheet character={c} statusEffects={myPlayer.statusEffects || []} conditions={activeConditions}
              injuries={[]} onRoll={onRoll} />
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
                  <div key={m.id} className={`pv-bubble ${mine ? 'mine' : 'theirs'} ${kind}${m.pending ? ' pending' : ''}`}>
                    <div className="pv-bubble-meta">
                      {mine
                        ? `TO ${m.type === 'p2p' ? String(m.to).toUpperCase() : GM}`
                        : m.type === 'gm' ? `${GM}${m.toId === 'broadcast' ? ` · ${terms.broadcast?.toUpperCase() || 'BROADCAST'}` : ''}` : `${String(m.from).toUpperCase()} · ${PLAYER}`}
                      {m.type === 'gm' && m.priority && m.priority !== 'STANDARD' && <b> · {m.priority}</b>}
                      {' · '}{m.pending ? 'QUEUED' : new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="pv-bubble-text">{m.text}</div>
                    {!mine && (
                      <button type="button" className="ph-reply" onClick={() => reply(m.type === 'gm' ? 'dm' : m.fromId)}>REPLY PRIVATELY</button>
                    )}
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
                <input ref={inputRef} value={text} onChange={e => setText(e.target.value)} placeholder={`Type ${terms.message.toLowerCase()}...`}
                  enterKeyHint="send" autoComplete="off" />
                <button type="submit" className="pv-btn primary" disabled={!text.trim()}>SEND</button>
              </div>
            </form>
          </>
        )}

        {tab === 'handouts' && (
          <HandoutsPane table={table} onOpen={setViewer} onOpenOrder={(o) => setOrder({ ...o, fresh: false })} />
        )}

        {tab === 'map' && <PlayerMapPane />}

        {tab === 'dice' && (
          <div className="pv-pane pv-dice">
            {rollPreset && (
              <div className="ph-preset" role="status">
                <span>ROLLING <b>{rollPreset.label}</b>{rollPreset.kind !== '2d20' && rollPreset.stress ? ` + ${rollPreset.stress} STRESS` : ''}</span>
                <button type="button" className="ph-preset-x" aria-label="Clear preset" onClick={() => setRollPreset(null)}>✕</button>
              </div>
            )}
            {Roller
              ? <Roller key={rollPreset?.at || 'free'} preset={rollPreset} onResult={sendRoll} />
              : <div className="panel"><p className="pv-text dim">No dice roller is registered for {universe.name}.</p></div>}
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
            {id === 'handouts' && unseenHandouts > 0 && tab !== 'handouts' && <span className="pv-badge">{unseenHandouts}</span>}
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
