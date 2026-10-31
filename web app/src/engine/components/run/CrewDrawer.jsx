import React, { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../GameContext';
import { useUniverse } from '../../UniverseContext';
import { trackMaxFor, fmtTime } from '../../rulesUtils';
import './CrewDrawer.css';
import Portrait from '../sheet/Portrait'; // F4 portraits

/* ═══════════════════════════════════════════════════════════════
   CREW drawer (Focus Stage dock): every seat with its tracks as bars,
   panic / offline / KIA state, unread messages, MSG per seat and
   MSG ALL; quick actions +1 STRESS ALL, ASK FOR A ROLL, SEND HANDOUT,
   PRIVATE AGENDA.
   ASK FOR A ROLL sends a real `roll-request` (skill from
   universe.rules.skills, optional modifier (ALIEN, +/- dice) or difficulty
   (DUNE), one seat or all): the phones show a ROLL NOW card that opens
   the roller prefilled, and each answer comes back tagged with the
   request. ROLL REQUESTS lists the last three (answers with their result,
   who is still to roll, CANCEL while open); PICKED UP lists items players took off the board
   (`token-take`) with UNDO (`token-take-undo`).
   ═══════════════════════════════════════════════════════════════ */
export default function CrewDrawer({ onOpen, onNavigate }) {
  const {
    players, messages, unreadBy, clearUnreadFor, sendMessage, broadcastMessage, updatePlayer, table,
    rollRequest, rollRequestCancel, tokenTakeUndo,
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
  const [ask, setAsk] = useState(null);     // { skill (rules key), who: 'all'|playerId, note, diff: '' | '<int>' }
  const [status, setStatus] = useState(null);
  useEffect(() => { if (!status) return undefined; const t = setTimeout(() => setStatus(null), 4000); return () => clearTimeout(t); }, [status]);
  const skills = useMemo(() => (rules.skills || []).map((s) => ({ key: s.key, label: s.label || s.key })), [rules]);
  const d20 = rules.dice?.kind === '2d20';
  /* ALIEN: a modifier in dice (-3..+3); DUNE: the Difficulty (0..maxDifficulty). '' = none (roller default). */
  const diffOptions = d20
    ? Array.from({ length: (rules.dice?.maxDifficulty ?? 5) + 1 }, (_, i) => [String(i), `DIFFICULTY ${i}`])
    : [3, 2, 1, -1, -2, -3].map((n) => [String(n), `${n > 0 ? '+' : '−'}${Math.abs(n)} ${Math.abs(n) === 1 ? 'DIE' : 'DICE'}`]);
  const diffText = (d) => (d === null || d === undefined ? '' : d20 ? `D${d}` : d === 0 ? '' : `${d > 0 ? '+' : '−'}${Math.abs(d)}`);
  const skillLabel = (key) => skills.find((s) => s.key === key)?.label || key;
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
    const label = skillLabel(ask.skill);
    const who = ask.who === 'all' ? `ALL ${PLAYERS}` : (players[ask.who]?.character?.name || '').toUpperCase();
    rollRequest({ skill: ask.skill, label, difficulty: ask.diff === '' ? null : Number(ask.diff), note: ask.note.trim(), to: ask.who }, (r) => {
      if (r?.error) { setStatus(`NOT SENT: ${String(r.error).toUpperCase()}`); return; }
      const n = r?.sent?.length ?? 0;
      setStatus(`ROLL ${label.toUpperCase()} → ${who}${n ? '' : ' (OFFLINE — THEY SEE IT ON RECONNECT)'}`);
    });
    setAsk(null);
  };
  const nameOf = (pid) => players[pid]?.character?.name || players[pid]?.name || '?';
  /* Roll requests (DM table view): the last three not withdrawn, newest first; `waiting` = addressed live seats
     that have not answered yet (empty = done). */
  const live = seated.filter((p) => p.alive !== false).map((p) => p.id);
  const requests = (table?.rollRequests || []).filter((r) => !r.cancelled).slice(-3).reverse().map((r) => {
    const to = r.recipients === 'all' ? live : (r.recipients || []).filter((id) => live.includes(id));
    return { ...r, waiting: to.filter((id) => !(r.answeredBy || []).includes(id)) };
  });
  const answersFor = (rq) => (table?.rolls || []).filter((x) => x.requestId === rq.id);
  const pickups = (table?.takes || []).filter((t) => !t.undone).slice(-3).reverse();
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
                <Portrait character={c} name={p.name} size={40} className="cd-av" decorative />
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
          onClick={() => setAsk((a) => (a ? null : { skill: skills[0]?.key || '', who: 'all', note: '', diff: '' }))}>ASK FOR A ROLL</button>
        <button type="button" className="fs-btn" onClick={() => onOpen('handouts')}>SEND HANDOUT</button>
        <button type="button" className="fs-btn" onClick={() => onOpen('more', 'agendas')}>PRIVATE AGENDA</button>
      </div>
      {ask && (
        <form className="cd-ask" onSubmit={sendAsk}>
          <label className="fs-label" htmlFor="cd-ask-skill">ROLL</label>
          <div className="cd-ask-pair">
            <select id="cd-ask-skill" value={ask.skill} onChange={(e) => setAsk({ ...ask, skill: e.target.value })}>
              {skills.map((s) => <option key={s.key} value={s.key}>{s.label.toUpperCase()}</option>)}
            </select>
            <select value={ask.diff} onChange={(e) => setAsk({ ...ask, diff: e.target.value })} aria-label={d20 ? 'Difficulty' : 'Dice modifier'}>
              <option value="">{d20 ? 'DIFFICULTY —' : 'NO MODIFIER'}</option>
              {diffOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
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
      {requests.length > 0 && (
        <div className="cd-reqs" aria-label="Roll requests">
          <div className="cd-k">ROLL REQUESTS</div>
          <ul className="cd-req-list">
            {requests.map((rq) => {
              const answers = answersFor(rq);
              const to = rq.recipients === 'all' ? `ALL ${PLAYERS}` : (rq.recipients || []).map(nameOf).join(', ').toUpperCase();
              return (
                <li key={rq.id} className={`cd-req${rq.waiting.length ? '' : ' done'}`}>
                  <div className="cd-req-line">
                    <b>{String(rq.label || rq.skill).toUpperCase()}{diffText(rq.difficulty) ? ` · ${diffText(rq.difficulty)}` : ''}</b>
                    <span className="cd-req-to">{'→'} {to}</span>
                    {rq.waiting.length > 0
                      ? (
                        <button type="button" className="run-btn cd-req-x" aria-label={`Cancel the ${rq.label || rq.skill} request`}
                          onClick={() => rollRequestCancel(rq.id, (r) => setStatus(r?.error ? `CANCEL FAILED: ${r.error}` : 'REQUEST WITHDRAWN'))}>CANCEL</button>
                      )
                      : <span className="cd-req-done">DONE</span>}
                  </div>
                  {answers.length > 0 && (
                    <ul className="cd-req-answers">
                      {answers.map((x) => <li key={x.id}><b>{x.characterName || x.playerName}</b> {x.roll?.summary || ''}</li>)}
                    </ul>
                  )}
                  {rq.waiting.length > 0 && (
                    <p className="cd-req-wait">WAITING: {rq.waiting.map(nameOf).join(', ').toUpperCase()}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {pickups.length > 0 && (
        <div className="cd-reqs" aria-label="Items picked up">
          <div className="cd-k">PICKED UP</div>
          <ul className="cd-req-list">
            {pickups.map((t) => (
              <li key={t.id} className="cd-req">
                <div className="cd-req-line">
                  <b>{nameOf(t.playerId)}</b><span className="cd-req-to">took {t.item}</span>
                  <button type="button" className="run-btn cd-req-x" aria-label={`Undo: put ${t.item} back on the map`}
                    onClick={() => tokenTakeUndo(t.id, (r) => setStatus(r?.error ? `UNDO FAILED: ${r.error}` : `${t.item.toUpperCase()} IS BACK ON THE MAP`))}>UNDO</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {status && <p className="cd-status" role="status">{status}</p>}
      {table?.pause && <p className="cd-status warn">PAUSE REQUESTED — see the banner above the stage.</p>}
      <button type="button" className="run-btn cd-full" onClick={() => onNavigate('session')}>FULL {PLAYERS} DASHBOARD ▸</button>
    </div>
  );
}
