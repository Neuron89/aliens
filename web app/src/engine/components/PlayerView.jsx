import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGame } from '../GameContext';
import { useUniverse } from '../UniverseContext';
import CharacterSheet from './CharacterSheet';
import { useFx } from './player/fx';
import PhoneLayer from './player/PhoneLayer';
import HandoutsPane from './player/HandoutsPane';
import HandoutDoc from './player/HandoutDoc'; // F5
import ClocksRow from './player/ClocksRow';
import PauseButton from './player/PauseButton';
import BuildCharacter from './player/BuildCharacter';
import PanicOverlay from './player/PanicOverlay';
import TablePane from './player/TablePane';
import TrackerPane from './player/TrackerPane'; // F1 motion tracker (universe.features.tracker)
import RollRequestCard from './player/RollRequestCard';
import PlayerMenu from './player/PlayerMenu';
import ConfirmSheet from './player/ConfirmSheet';
import Icon from './player/icons';
import SupplyPanel from './SupplyPanel';
import { ItemArt } from './sheet/parts';
import Portrait from './sheet/Portrait'; // F4 portraits
import { getCatalog, itemById } from '../catalogUtils';
import { plural, fmtTime, determinationDef } from '../rulesUtils';
import Confirm from './Confirm';
import './player/player.css';

/* ═══════════════════════════════════════════════════════════════
   PlayerView: phone-first player terminal ("Command Deck" phone).
   Layout (100dvh, safe-area aware, styling in player/player.css):
     vitals header, pinned: name, career · session code, LINK, PAUSE, ≡ menu;
       the universe's track bars with numbers (+ DETERMINATION grains);
       shared pools; clocks; YOUR TURN / paused / offline banners
     quick actions: ROLL (opens the roller) · +STRESS (when the universe
       has a stress track) · PANIC (rules.panic) · DETERMINATION (spend)
     tab body: SHEET · GEAR · COMMS (messages + files, one badge) · TABLE
       (the board from this player's point of view, player/TablePane)
     bottom tabs with icons, ≥ 56px targets.
   Session effects (handouts, orders, clues, loot, narration, session zero)
   live in player/PhoneLayer.
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
      <div className="pv-alert-box" role="alertdialog" aria-label="Incoming message" style={{ '--alert-color': color }} onClick={e => e.stopPropagation()}>
        <div className="pv-alert-head">
          {fromGm ? `▓▓ INCOMING ${terminal.name} ${terms.message.toUpperCase()} ▓▓` : `▓▓ ${terms.message.toUpperCase()} FROM ${String(message.from).toUpperCase()} ▓▓`}
          <br />
          <span>PRIORITY: {message.priority} &nbsp;|&nbsp; {fmtTime(message.timestamp)}</span>
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

function TrackBar({ label, value, max, color, danger }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const fill = danger ? 'var(--danger)' : color;
  return (
    <div className={`pp-track${danger ? ' danger' : ''}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="pp-track-head">
        <span className="pp-k">{label}</span>
        <b style={{ color: fill }}>{value}/{max}</b>
      </div>
      <div className="pp-track-bar"><i style={{ width: `${pct}%`, background: fill }} /></div>
    </div>
  );
}

function GrainTrack({ label, value, max }) {
  return (
    <div className="pp-track pp-grains" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="pp-track-head">
        <span className="pp-k">{label}</span>
        <b>{value}/{max}</b>
      </div>
      <div className="pp-grain-row" aria-hidden="true">
        {Array.from({ length: max }, (_, i) => <i key={i} className={i < value ? 'on' : ''} />)}
      </div>
    </div>
  );
}

export default function PlayerView() {
  const {
    myPlayer, messages, sendPlayerMessage, sendPlayerToPlayer, leaveGame, unreadCount, clearUnread,
    gameCode, connectedPlayers, connected, dmOnline, table, outboxCount, sendRoll,
    supplyRoll, initPass, on, determinationSpend,
  } = useGame();
  const { universe } = useUniverse();
  const { terms, terminal, rules } = universe;
  const catalog = getCatalog(universe);
  const [tab, setTab] = useState('sheet');
  const lastTab = useRef('sheet');
  const menuBtn = useRef(null);
  const [commsView, setCommsView] = useState('messages'); // COMMS: 'messages' | 'files'
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
  const [panicPending, setPanicPending] = useState(null); // { rollId, stress, manual? }: PANIC ROLL overlay
  const [redFlash, setRedFlash] = useState(0);            // complication flash key
  const [supplyLast, setSupplyLast] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);           // 'stress' | 'det'
  const [flash, setFlash] = useState(null);               // short status line under the quick actions
  const myTurn = !!table?.initiative?.mine;
  const wasMyTurn = useRef(false);

  const go = useCallback((id) => {
    setTab((cur) => { if (cur !== 'dice') lastTab.current = cur; return id; });
  }, []);
  const say = useCallback((msg) => {
    setFlash(msg);
    setTimeout(() => setFlash((v) => (v === msg ? null : v)), 3200);
  }, []);

  /* YOUR TURN: banner + vibrate + sound when the turn lands on this phone. */
  useEffect(() => {
    if (myTurn && !wasMyTurn.current) play('orders');
    wasMyTurn.current = myTurn;
  }, [myTurn, play]);
  useEffect(() => on('supply-rolled', (e) => {
    if (!e || e.playerId !== myPlayer?.id) return;
    setSupplyLast(e);
    if (e.after < e.before) play('tick');
  }), [on, myPlayer?.id, play]);

  /* Roller → session feed; panic (rules.panic) opens the PANIC ROLL; a complication flashes red. */
  const onRollResult = useCallback((roll) => {
    const rollId = sendRoll(roll);
    if (roll?.flags?.includes('panic') && rules?.panic) {
      setPanicPending({ rollId, stress: roll.pool?.stress ?? (Number(myPlayer?.tracks?.stress) || 0) });
    }
    if (roll?.flags?.includes('complication')) {
      const k = Date.now();
      setRedFlash(k);
      setTimeout(() => setRedFlash((v) => (v === k ? 0 : v)), 900);
    }
  }, [sendRoll, rules, myPlayer?.tracks?.stress]);

  const c = myPlayer?.character;
  const PLAYER = terms.player.toUpperCase();
  const GM = terms.gm.toUpperCase();
  const GMS = String(terms.gmShort || terms.gm).toUpperCase();
  /* Leaving drops this device's seat token: coming back to the same seat then needs the GM's approval. */
  const leaveButton = (label, className = 'pv-btn danger') => (
    <Confirm block danger label={label} className={className} title="DISCONNECT?"
      message={`Returning to this seat later needs the ${terms.gm}'s approval.`} confirmLabel="DISCONNECT" cancelLabel="STAY" onConfirm={leaveGame} />
  );
  const detDef = determinationDef(universe);
  const det = myPlayer?.determination || null;
  const spendDetermination = () => determinationSpend('', (r) => say(r?.success ? `${detDef.label} SPENT · THE ${GMS} SEES IT` : (r?.error || 'NOT SENT')));
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
    setCommsView('messages');
    go('messages');
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [go]);
  const onClockTick = useCallback((id) => {
    setPulseId(id);
    setTimeout(() => setPulseId(p => (p === id ? null : p)), 1600);
  }, []);

  const chatOpen = tab === 'messages' && commsView === 'messages';
  useEffect(() => {
    if (chatOpen) {
      if (unreadCount > 0) clearUnread();
      chatEnd.current?.scrollIntoView({ block: 'end' });
    }
  }, [chatOpen, chat.length, unreadCount, clearUnread]);

  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (target === 'dm') sendPlayerMessage(text);
    else sendPlayerToPlayer(target, text);
    setText('');
  };

  const otherPlayers = (connectedPlayers || []).filter(p => p.id !== myId);
  const layer = (
    <>
      <PhoneLayer fx={fx} viewer={viewer} setViewer={setViewer} order={order} setOrder={setOrder}
        onClockTick={onClockTick} onReply={() => reply('dm')} />
      {viewer && <HandoutDoc handout={viewer} universe={universe} onClose={() => setViewer(null)} />}{/* F5: themed document reader over PhoneLayer's viewer */}
    </>
  );
  const lostBanner = !connected && (
    <div className="ph-lost" role="status">
      CONNECTION LOST · RECONNECTING…{outboxCount > 0 ? ` ${outboxCount} ACTION${outboxCount > 1 ? 'S' : ''} QUEUED` : ''}
    </div>
  );

  const sub = table?.submission;
  /* Player-built character: the first one, or a replacement at any time (after a death or by choice).
     SUBMIT sends character-submit; the GM assigns it (DM editor / KIA flow: ASSIGN PLAYER-BUILT). */
  if (building) {
    return (
      <div className="app pv-root ph-build-root">
        {layer}
        {lostBanner}
        {c && myPlayer?.alive !== false && <div className="ph-build-note">NEW CHARACTER · {c.name} STAYS IN PLAY UNTIL THE {GMS} ASSIGNS THIS ONE</div>}
        <BuildCharacter onDone={() => setBuilding(false)} />
      </div>
    );
  }
  const subStatus = sub && (sub.status === 'pending' || sub.status === 'rejected') && (
    <p className={`ph-sub-status${sub.status === 'rejected' ? ' rejected' : ''}`}>
      {sub.status === 'pending'
        ? `SUBMITTED: ${sub.name || 'your character'} · AWAITING ${GMS} APPROVAL`
        : `${GMS} RETURNED YOUR CHARACTER${sub.reason ? `: “${sub.reason}”` : ''} · EDIT AND RESUBMIT`}
    </p>
  );

  /* Waiting screen: no character assigned yet (build one, or wait for the GM) */
  if (!c) {
    return (
      <div className="app pv-screen pp-wait">
        <div className="crt-overlay" />
        {layer}
        <div className="ph-wait-top"><PauseButton /></div>
        <h1 className="pv-title">{terminal.name}</h1>
        <div className="panel pv-center-card">
          <div className="pulse-line" style={{ height: '2px', background: 'var(--accent)', marginBottom: '1rem', animation: 'pulse 2s infinite' }} />
          <h2 className="pp-wait-h">AUTHENTICATION CONFIRMED</h2>
          <p className="pp-wait-p">
            Welcome, {myPlayer?.name}. Stand by for character assignment from {terms.gm}, or build your own.
          </p>
          {subStatus}
          <button type="button" className="pv-btn primary ph-wide" onClick={() => setBuilding(true)}>
            {sub?.status === 'pending' ? 'EDIT MY CHARACTER' : 'BUILD YOUR CHARACTER'}
          </button>
          <p className="pp-wait-small">AWAITING ASSIGNMENT · {terms.session.toUpperCase()} {gameCode}</p>
          {!connected && <p className="pv-offline">RECONNECTING…</p>}
        </div>
        <div className="ph-wait-leave">{leaveButton('DISCONNECT', 'pv-btn')}</div>
      </div>
    );
  }

  /* Death screen: full-screen obituary */
  if (!myPlayer.alive) {
    return (
      <div className="app pv-screen pv-dead">
        <div className="crt-overlay" />
        <div className="pv-dead-frame">
          <div className="pv-dead-label">{terminal.name} · {PLAYER} STATUS</div>
          <h1 className="pv-dead-title">{PLAYER} DECEASED</h1>
          <div className="pv-dead-name">{c.name}</div>
          {c.career && <div className="pv-dead-sub">{c.career}</div>}
          <div className="pv-dead-rule" />
          <div className="pv-dead-wait">AWAITING REASSIGNMENT</div>
          <p className="pv-dead-note">Stand by for new character assignment from {terms.gm}, or build your replacement now.</p>
          {subStatus}
          <button type="button" className="pv-btn primary ph-wide pv-dead-build" onClick={() => setBuilding(true)}>
            {sub?.status === 'pending' ? 'EDIT MY NEW CHARACTER' : 'BUILD A NEW CHARACTER'}
          </button>
          {(!connected || !dmOnline) && <p className="pv-offline">{!connected ? 'RECONNECTING…' : `${GM} OFFLINE`}</p>}
        </div>
      </div>
    );
  }

  const unseenHandouts = (table?.handouts || []).filter(h => !h.seen).length;
  const commsBadge = (chatOpen ? 0 : unreadCount) + (tab === 'messages' && commsView === 'files' ? 0 : unseenHandouts);
  const tabs = [
    ['sheet', 'SHEET', 'sheet'],
    ['inventory', 'GEAR', 'gear'],
    ['messages', 'COMMS', 'comms'],
    ['table', 'TABLE', 'table'],
    ...(universe.features?.tracker ? [['tracker', 'TRACKER', 'tracker']] : []), // F1 motion tracker
  ];
  const Roller = rules?.dice?.Roller;
  const activeConditions = Object.entries(myPlayer.conditions || {}).filter(([, on]) => on).map(([k]) => k);

  /* Tap-to-roll: the sheet's ROLL opens the universe roller pre-filled (preset prop). */
  const onRoll = (skillKey, pool) => {
    setRollPreset({
      skillKey, attrKey: pool.attrKey, kind: pool.kind,
      attr: pool.attr, skill: pool.skill, bonus: pool.bonus, total: pool.total,
      label: (rules.skills || []).find(s => s.key === skillKey)?.label?.toUpperCase() || skillKey.toUpperCase(),
      stress: Number(myPlayer.tracks?.stress) || 0,
      at: Date.now(),
    });
    go('dice');
  };

  /* ─── Vitals: the universe's tracks (+ DETERMINATION as grains) ─── */
  const trackDefs = rules.tracks || [];
  const stressDef = trackDefs.find((t) => t.key === 'stress');
  const stressNow = Number(myPlayer.tracks?.stress) || 0;
  const stressMax = Number(myPlayer.trackMax?.stress) || 0;
  /* The free ROLL: no skill, but on a stress-dice roller (Year Zero) the stress dice still come from the
     sheet, like the skill rolls (base stays at the roller's default 6). */
  const freePreset = () => (stressDef && rules.dice?.kind === 'yze' ? { total: 6, stress: stressNow, at: Date.now() } : null);
  const vitals = [
    ...trackDefs.map((t) => {
      const value = myPlayer.tracks?.[t.key] ?? 0;
      const max = myPlayer.trackMax?.[t.key] ?? 0;
      const danger = typeof t.danger === 'function' ? t.danger(value, max) : false;
      return <TrackBar key={t.key} label={t.label || t.short} value={value} max={max} color={t.color || 'var(--accent)'} danger={danger} />;
    }),
    ...(detDef && det ? [<GrainTrack key="det" label={detDef.label} value={det.value} max={det.max} />] : []),
  ];
  const pools = table?.pools || [];

  /* ─── Quick actions (what this universe's rules expose) ─── */
  const actions = [
    { id: 'roll', label: 'ROLL', icon: 'dice', tone: 'primary', pressed: tab === 'dice', onClick: () => (tab === 'dice' ? setTab(lastTab.current) : (setRollPreset(freePreset()), go('dice'))) },
    ...(detDef && det ? [{
      id: 'det', label: `${rules.determination?.short || detDef.label} ${det.value}`, icon: 'det', tone: 'warn',
      disabled: det.value < 1, aria: `Spend 1 ${detDef.label} (${det.value} of ${det.max} left)`, onClick: () => setConfirm('det'),
    }] : []),
    ...(stressDef ? [{
      id: 'stress', label: `+${stressDef.short || 'STRESS'}`, icon: 'stress', tone: detDef ? '' : 'warn',
      disabled: stressMax > 0 && stressNow >= stressMax, aria: `Mark plus one ${stressDef.label}`, onClick: () => setConfirm('stress'),
    }] : []),
    ...(rules?.panic ? [{
      id: 'panic', label: 'PANIC', icon: 'panic', tone: '',
      aria: 'Make a panic roll', onClick: () => setPanicPending({ rollId: null, stress: stressNow, manual: true }),
    }] : []),
  ];
  const markStress = () => {
    sendRoll({
      kind: 'stress', label: `+1 ${stressDef?.label || 'STRESS'}`, summary: `+1 ${stressDef?.label || 'STRESS'} (marked on the phone)`,
      stressGain: 1, flags: [], dice: {},
    });
    say(`+1 ${stressDef?.label || 'STRESS'} · THE ${GMS} SEES IT`);
  };

  const bodyClass = `pp-body${chatOpen ? ' pp-body-chat' : ''}${tab === 'table' ? ' pp-body-table' : ''}`;

  return (
    <div className={`app pv-root pp-root tab-${tab}`}>
      <div className="crt-overlay" />
      {layer}

      {panicPending && <PanicOverlay pending={panicPending} fx={fx} onClose={() => setPanicPending(null)} />}
      {redFlash > 0 && <div key={redFlash} className="ph-redflash" aria-hidden="true" />}

      {alertQueue.length > 0 && (
        <IncomingAlert message={alertQueue[0]} onDismiss={dismissAlert} onReply={reply} terminal={terminal} terms={terms} />
      )}
      {menuOpen && (
        <PlayerMenu onClose={() => { setMenuOpen(false); setTimeout(() => menuBtn.current?.focus(), 0); }} onBuild={() => setBuilding(true)}
          buildLabel={sub?.status === 'pending' ? 'EDIT MY NEW CHARACTER' : 'BUILD A NEW CHARACTER'} subStatus={subStatus}
          alertsMuted={muted} setAlertsMuted={setMuted} onLeave={leaveGame}
          sessionLabel={terms.session.toUpperCase()} gameCode={gameCode} playerName={myPlayer.name} />
      )}
      {confirm === 'stress' && (
        <ConfirmSheet title={`MARK +1 ${stressDef?.label || 'STRESS'}?`} confirmLabel={`+1 ${stressDef?.label || 'STRESS'}`} tone="warn"
          onConfirm={markStress} onClose={() => setConfirm(null)}>
          <p>{stressNow} → {Math.min(stressMax || stressNow + 1, stressNow + 1)}{stressMax ? ` of ${stressMax}` : ''}. Use it when the {terms.gm} tells you to take stress. It shows in the {terms.gm}&apos;s roll feed.</p>
        </ConfirmSheet>
      )}
      {confirm === 'det' && detDef && det && (
        <ConfirmSheet title={`SPEND 1 ${detDef.label}?`} confirmLabel="SPEND" tone="warn"
          onConfirm={spendDetermination} onClose={() => setConfirm(null)}>
          <p>You keep {Math.max(0, det.value - 1)} of {det.max}. The {terms.gm} sees it in the roll feed.</p>
        </ConfirmSheet>
      )}

      {/* ─── Vitals header (pinned) ─── */}
      <header className="pp-vitals">
        <div className="pp-idrow">
          <Portrait character={c} size={44} decorative />
          <div className="pp-who">
            <span className="pp-name">{c.name}</span>
            <span className="pp-sub" aria-label={`${c.career ? `${c.career}, ` : ''}${terms.session} code ${gameCode}`}>{c.career ? `${c.career} · ` : ''}<b className="pp-code">{gameCode}</b></span>
          </div>
          <span className={`pp-link ${connected ? 'up' : 'down'}`} role="status" aria-label={connected ? 'Linked to the table' : 'Connection lost'}>
            <span className="link-dot" aria-hidden="true" />{connected ? 'LINK' : 'LOST'}
          </span>
          <PauseButton />
          <button ref={menuBtn} type="button" className="pp-iconbtn" aria-label="Menu" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <Icon name="menu" />{sub?.status === 'pending' && <i className="pp-dot" aria-hidden="true" />}
          </button>
        </div>
        {vitals.length > 0 && <div className={`pp-tracks n${Math.min(vitals.length, 3)}`}>{vitals}</div>}
      </header>

      {/* ─── Quick actions ─── */}
      <div className={`pp-actions n${actions.length}`} role="group" aria-label="Quick actions">
        {actions.map((a) => (
          <button key={a.id} type="button" className={`pp-act ${a.tone}`} disabled={a.disabled || (!connected && a.id !== 'roll')}
            aria-pressed={a.pressed === undefined ? undefined : a.pressed} aria-label={a.aria} onClick={a.onClick}>
            <Icon name={a.icon} size={20} />{a.label}
          </button>
        ))}
      </div>

      {/* ─── ROLL NOW: the GM's open roll request (player/RollRequestCard) ─── */}
      <RollRequestCard hidden={tab === 'dice'} play={play} onRoll={(preset) => { setRollPreset(preset); go('dice'); }} />

      {/* ─── Status strip: clocks, turn, banners ─── */}
      {(flash || pools.length > 0 || (table?.clocks?.length > 0) || myTurn || table?.initiative?.active || !connected || table?.paused || (!dmOnline && connected)) && (
        <div className="pp-status">
          {flash && <div className="pp-flash" role="status">{flash}</div>}
          {(pools.length > 0 || table?.clocks?.length > 0) && (
            <div className="pp-chips-row">
              {pools.map(p => (
                <span key={p.key} className={`pp-pool k-${p.key}`} role="img" aria-label={`${p.label} ${p.value}${p.max ? ` of ${p.max}` : ''}`}>
                  <span className="pp-k">{p.label}</span>
                  <span className="pp-pool-grains" aria-hidden="true">
                    {Array.from({ length: p.max || Math.max(p.value, 1) }, (_, i) => <i key={i} className={i < p.value ? 'on' : ''} />)}
                  </span>
                  <b>{p.value}{p.max ? `/${p.max}` : ''}</b>
                </span>
              ))}
              <ClocksRow clocks={table?.clocks || []} pulseId={pulseId} />
            </div>
          )}
          {myTurn && (
            <div className="ph-yourturn" role="alert">
              <span>YOUR TURN</span>
              {table.initiative.round ? <small>ROUND {table.initiative.round}</small> : null}
              {rules?.initiative?.mode === 'nominate' && table.initiative.allies?.length > 0 && (
                <select aria-label="Pass the turn to" value="" onChange={(e) => e.target.value && initPass(e.target.value)}>
                  <option value="">PASS TO…</option>
                  {table.initiative.allies.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              )}
            </div>
          )}
          {!myTurn && table?.initiative?.active && table.initiative.current && (
            <div className="ph-turnline">ROUND {table.initiative.round} · ACTING: {table.initiative.current.label}</div>
          )}
          {lostBanner}
          {table?.paused && <div className="pv-banner ph-paused">TABLE PAUSED · TAKE A BREATH</div>}
          {!dmOnline && connected && <div className="pv-banner">{GM} OFFLINE · YOUR STATE IS SAVED</div>}
        </div>
      )}

      {/* ─── Tab body ─── */}
      <main className={bodyClass} id="pp-body">
        {tab === 'sheet' && (
          <div className="pp-pane ph-sheet-pane">
            <CharacterSheet character={c} statusEffects={myPlayer.statusEffects || []} conditions={activeConditions}
              injuries={myPlayer.injuries || []} onRoll={onRoll} />
            {rules?.supplies?.length > 0 && myPlayer.supply && Object.keys(myPlayer.supply).length > 0 && (
              <SupplyPanel keys={rules.supplies} supply={myPlayer.supply} danger={rules.supplyDanger ?? 2}
                onRoll={(k) => supplyRoll(k)} last={supplyLast} />
            )}
          </div>
        )}

        {tab === 'inventory' && (
          <div className="pp-pane">
            <h2 className="pp-k pp-h">EQUIPMENT &amp; GEAR <span>{myPlayer.inventory.length}</span></h2>
            {myPlayer.inventory.length === 0 ? (
              <p className="pp-dim">No items.</p>
            ) : (
              <ul className="pp-gear">
                {myPlayer.inventory.map((item, i) => {
                  const entry = itemById(catalog, item);
                  const sig = item === c.signatureItem || /signature item/i.test(item);
                  return (
                    <li key={i} className={`pp-gear-row${sig ? ' sig' : ''}`}>
                      <ItemArt item={entry} size={40} />
                      <span className="pp-gear-name"><b>{item}</b>{entry?.notes ? <small>{String(entry.notes)}</small> : null}</span>
                      {sig && <span className="pp-tag">SIGNATURE</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {tab === 'messages' && (
          <>
            <div className="pp-seg" role="tablist" aria-label={`${terms.message} and files`}>
              <button type="button" role="tab" aria-selected={commsView === 'messages'} onClick={() => setCommsView('messages')}>
                {plural(terms.message).toUpperCase()}{unreadCount > 0 && !chatOpen && <span className="pp-badge">{unreadCount}</span>}
              </button>
              <button type="button" role="tab" aria-selected={commsView === 'files'} onClick={() => setCommsView('files')}>
                FILES &amp; CLUES{unseenHandouts > 0 && <span className="pp-badge">{unseenHandouts}</span>}
              </button>
            </div>
            {commsView === 'messages' ? (
              <>
                <div className="pv-chat pp-chat">
                  {chat.length === 0 && <p className="pp-dim pp-center">No {plural(terms.message.toLowerCase())} yet. Anything the {terms.gm} sends you lands here.</p>}
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
                          {' · '}{m.pending ? 'QUEUED' : fmtTime(m.timestamp)}
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
                <form className="pv-compose pp-compose" onSubmit={send}>
                  <select value={target} onChange={e => setTarget(e.target.value)} aria-label="Recipient">
                    <option value="dm">{terms.gmShort} ({terms.gm})</option>
                    {otherPlayers.map(p => (
                      <option key={p.id} value={p.id}>{p.name}{p.connected === false ? ' (offline)' : ''} (secret)</option>
                    ))}
                  </select>
                  <div className="pv-compose-row">
                    <input ref={inputRef} value={text} onChange={e => setText(e.target.value)} placeholder={`Type ${terms.message.toLowerCase()}...`}
                      aria-label={`${terms.message} text`} enterKeyHint="send" autoComplete="off" />
                    <button type="submit" className="pv-btn primary" disabled={!text.trim()}>SEND</button>
                  </div>
                </form>
              </>
            ) : (
              <HandoutsPane table={table} onOpen={setViewer} onOpenOrder={(o) => setOrder({ ...o, fresh: false })} />
            )}
          </>
        )}

        {tab === 'table' && <TablePane />}
        {tab === 'tracker' && universe.features?.tracker && <TrackerPane />}

        {tab === 'dice' && (
          <div className="pp-pane pv-dice pp-dice">
            <div className="pp-dice-head">
              <h2 className="pp-k pp-h">{rollPreset?.label ? `ROLL · ${rollPreset.label}` : 'ROLL'}</h2>
              <button type="button" className="pp-btn pp-btn-sm" onClick={() => setTab(lastTab.current)}>DONE</button>
            </div>
            {Roller
              ? <Roller key={rollPreset?.at || 'free'} preset={rollPreset} onResult={onRollResult} compact />
              : <p className="pp-dim">No dice roller is registered for {universe.name}.</p>}
          </div>
        )}
      </main>

      {/* ─── Bottom tab bar ─── */}
      <nav className="pp-tabs" aria-label="Terminal sections">
        {tabs.map(([id, label, icon]) => {
          const badge = id === 'messages' ? commsBadge : 0;
          return (
            <button key={id} type="button" className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined}
              aria-label={badge > 0 ? `${label}, ${badge} new` : undefined} onClick={() => go(id)}>
              <Icon name={icon} />
              <span>{label}</span>
              {badge > 0 && <span className="pp-badge" aria-hidden="true">{badge}</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
