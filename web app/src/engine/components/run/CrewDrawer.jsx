import React, { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../GameContext';
import { useUniverse } from '../../UniverseContext';
import { trackMaxFor, fmtTime } from '../../rulesUtils';

const initialsOf = (name = '') => name.replace(/^(capt|dr|sgt|lt|mr|ms|mrs)\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

/* ═══════════════════════════════════════════════════════════════
   CREW drawer (Focus Stage dock): every seat with its tracks as bars,
   panic / offline / KIA state, unread messages, MSG per seat and
   MSG ALL; quick actions +1 STRESS ALL, ASK FOR A ROLL (a priority
   message to one or all), SEND HANDOUT, PRIVATE AGENDA.
   ═══════════════════════════════════════════════════════════════ */
export default function CrewDrawer({ onOpen, onNavigate }) {
  const {
    players, messages, unreadBy, clearUnreadFor, sendMessage, broadcastMessage, updatePlayer, table,
  } = useGame();
  const { universe } = useUniverse();
  const { terms, rules, terminal } = universe;
  const tracks = rules.tracks || [];
  const stressTrack = tracks.find((t) => t.key === 'stress');
  const priorities = terms.priorities?.length ? terms.priorities : ['STANDARD'];
  const list = Object.values(players || {});
  const seated = list.filter((p) => p.character);
  const [to, setTo] = useState(null);       // composer target: playerId | 'broadcast' | null
  const [text, setText] = useState('');
  const [prio, setPrio] = useState(priorities[0]);
  const [ask, setAsk] = useState(null);     // { skill, who: 'all'|playerId, note }
  const [status, setStatus] = useState(null);
  useEffect(() => { if (!status) return undefined; const t = setTimeout(() => setStatus(null), 4000); return () => clearTimeout(t); }, [status]);
  const skills = useMemo(() => (rules.skills || []).map((s) => s.label), [rules]);
  const PLAYERS = terms.players.toUpperCase();
  const MSG = terms.message.toUpperCase();

  const openComposer = (id) => {
    setTo((cur) => (cur === id ? null : id));
    setText('');
    if (id !== 'broadcast') clearUnreadFor(id);
  };
  const send = (e) => {
    e.preventDefault();
    if (!text.trim() || !to) return;
    if (to === 'broadcast') broadcastMessage(text.trim(), prio);
    else sendMessage(to, text.trim(), prio);
    setStatus(`${MSG} SENT TO ${to === 'broadcast' ? `ALL ${PLAYERS}` : (players[to]?.character?.name || players[to]?.name || '').toUpperCase()}`);
    setText('');
    setTo(null);
  };
  const stressAll = () => {
    if (!stressTrack) return;
    let n = 0;
    for (const p of seated) {
      if (p.alive === false) continue;
      const v = p.tracks?.stress ?? 0;
      const max = p.trackMax?.stress ?? trackMaxFor(stressTrack, p.character) ?? 10;
      if (v >= max) continue;
      updatePlayer(p.id, { tracks: { stress: v + 1 } });
      n++;
    }
    setStatus(n ? `+1 STRESS → ${n} ${n === 1 ? terms.player.toUpperCase() : PLAYERS}` : `NO ${PLAYERS} TO STRESS`);
  };
  const sendAsk = (e) => {
    e.preventDefault();
    if (!ask?.skill) return;
    const line = `ROLL ${ask.skill.toUpperCase()}${ask.note.trim() ? ` — ${ask.note.trim()}` : ''}`;
    const urgent = priorities[1] || priorities[0];
    if (ask.who === 'all') broadcastMessage(line, urgent);
    else sendMessage(ask.who, line, urgent);
    setStatus(`ASKED ${ask.who === 'all' ? `ALL ${PLAYERS}` : (players[ask.who]?.character?.name || '').toUpperCase()}: ${ask.skill.toUpperCase()}`);
    setAsk(null);
  };
  const thread = (pid) => messages.filter((m) => m.toId === pid || m.fromId === pid).slice(-3);

  const composer = (
    <form className="cd-compose" onSubmit={send}>
      {to !== 'broadcast' && to && thread(to).length > 0 && (
        <ol className="cd-thread">
          {thread(to).map((m) => (
            <li key={m.id} className={m.type === 'player' ? 'in' : 'out'}>
              <b>{m.type === 'player' ? (players[to]?.character?.name || m.from) : terminal.name}</b> <time>{fmtTime(m.timestamp)}</time>
              <span>{m.text}</span>
            </li>
          ))}
        </ol>
      )}
      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus
        aria-label={to === 'broadcast' ? `${MSG} to all ${terms.players.toLowerCase()}` : `${MSG} to ${players[to]?.character?.name || players[to]?.name || ''}`}
        placeholder={to === 'broadcast' ? `${terms.broadcast} ${terms.message.toLowerCase()}…` : `Private ${terms.message.toLowerCase()}…`} />
      <div className="run-row">
        <select value={prio} onChange={(e) => setPrio(e.target.value)} aria-label="Priority">
          {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button type="submit" className="run-btn primary" disabled={!text.trim()}>SEND</button>
        <button type="button" className="run-btn" onClick={() => setTo(null)}>CANCEL</button>
      </div>
    </form>
  );

  return (
    <div className="cd">
      <div className="cd-top">
        <span className="cd-count">{list.filter((p) => p.connected !== false).length}/{list.length} ONLINE</span>
        <button type="button" className={`run-btn${to === 'broadcast' ? ' primary' : ''}`} aria-expanded={to === 'broadcast'} onClick={() => openComposer('broadcast')}>MSG ALL</button>
      </div>
      {to === 'broadcast' && composer}
      {list.length === 0 && <p className="run-empty">No {terms.players.toLowerCase()} have joined yet. Tap the code in the top strip for the join link and QR.</p>}
      <ul className="cd-list">
        {list.map((p) => {
          const c = p.character;
          const offline = p.connected === false;
          const dead = p.alive === false;
          const panic = p.panic;
          const unread = unreadBy?.[p.id] || 0;
          const lastIn = unread ? [...messages].reverse().find((m) => m.fromId === p.id && m.type === 'player') : null;
          const state = dead ? 'KIA' : panic ? `PANIC ${panic.total} · ${String(panic.name || '').toUpperCase()}` : offline ? 'OFFLINE' : (c?.career || 'NO CHARACTER').toUpperCase();
          return (
            <li key={p.id} className={`cd-row${offline ? ' off' : ''}${dead ? ' dead' : ''}${panic ? ' panic' : ''}`}>
              <div className="cd-main">
                <span className="cd-av" aria-hidden="true">{initialsOf(c?.name || p.name)}</span>
                <div className="cd-body">
                  <div className="cd-line">
                    <b className="cd-name">{c?.name || p.name}</b>
                    <span className={`cd-state${panic || dead ? ' bad' : ''}`}>{state}</span>
                  </div>
                  <div className="cd-sub">{p.name}{p.statusEffects?.length ? ` · ${p.statusEffects.join(', ')}` : ''}</div>
                  {c && tracks.length > 0 && (
                    <div className="cd-bars">
                      {tracks.map((t) => {
                        const v = p.tracks?.[t.key] ?? 0;
                        const max = p.trackMax?.[t.key] ?? trackMaxFor(t, c) ?? 0;
                        const pct = max > 0 ? Math.min(100, (v / max) * 100) : 0;
                        const danger = typeof t.danger === 'function' && t.danger(v) && !(t.initial === 'max' && v >= max);
                        return (
                          <span key={t.key} className={`cd-bar k-${t.key}${danger ? ' danger' : ''}`} role="img" aria-label={`${t.label} ${v} of ${max}`}>
                            <span className="cd-bar-l" aria-hidden="true">{t.short || t.label} <b>{v}/{max}</b></span>
                            <i aria-hidden="true"><b style={{ width: `${pct}%`, background: danger ? 'var(--danger)' : (t.color || 'var(--accent)') }} /></i>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <button type="button" className={`run-btn cd-msg${unread ? ' unread' : ''}${to === p.id ? ' primary' : ''}`} aria-expanded={to === p.id}
                  aria-label={`${MSG} to ${c?.name || p.name}${unread ? `, ${unread} unread` : ''}`} onClick={() => openComposer(p.id)}>
                  {unread ? `${unread} NEW` : 'MSG'}
                </button>
              </div>
              {lastIn && to !== p.id && <p className="cd-last">“{lastIn.text}”</p>}
              {to === p.id && composer}
            </li>
          );
        })}
      </ul>

      <div className="cd-k">QUICK</div>
      <div className="cd-quick">
        {stressTrack && <button type="button" className="fs-btn" onClick={stressAll} disabled={!seated.length}>+1 STRESS ALL</button>}
        <button type="button" className={`fs-btn${ask ? ' on' : ''}`} aria-expanded={!!ask} disabled={!list.length}
          onClick={() => setAsk((a) => (a ? null : { skill: skills[0] || '', who: 'all', note: '' }))}>ASK FOR A ROLL</button>
        <button type="button" className="fs-btn" onClick={() => onOpen('handouts')}>SEND HANDOUT</button>
        <button type="button" className="fs-btn" onClick={() => onOpen('more', 'agendas')}>PRIVATE AGENDA</button>
      </div>
      {ask && (
        <form className="cd-ask" onSubmit={sendAsk}>
          <label className="fs-label" htmlFor="cd-ask-skill">ROLL</label>
          <select id="cd-ask-skill" value={ask.skill} onChange={(e) => setAsk({ ...ask, skill: e.target.value })}>
            {skills.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
          <div className="run-targets" role="group" aria-label="Who rolls">
            <button type="button" className={`run-chip${ask.who === 'all' ? ' on' : ''}`} aria-pressed={ask.who === 'all'} onClick={() => setAsk({ ...ask, who: 'all' })}>ALL</button>
            {seated.map((p) => (
              <button key={p.id} type="button" className={`run-chip${ask.who === p.id ? ' on' : ''}`} aria-pressed={ask.who === p.id} onClick={() => setAsk({ ...ask, who: p.id })}>{p.character.name}</button>
            ))}
          </div>
          <input value={ask.note} onChange={(e) => setAsk({ ...ask, note: e.target.value })} placeholder="Why (optional), e.g. to spot the tracks" maxLength={200} />
          <div className="run-row">
            <button type="submit" className="run-btn primary" disabled={!ask.skill}>SEND TO PHONE{ask.who === 'all' ? 'S' : ''}</button>
            <button type="button" className="run-btn" onClick={() => setAsk(null)}>CANCEL</button>
          </div>
        </form>
      )}
      {status && <p className="cd-status" role="status">{status}</p>}
      {table?.pause && <p className="cd-status warn">PAUSE REQUESTED — see the banner above the stage.</p>}
      <button type="button" className="run-btn cd-full" onClick={() => onNavigate('session')}>FULL {PLAYERS} DASHBOARD ▸</button>
    </div>
  );
}
