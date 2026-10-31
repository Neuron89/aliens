import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../../GameContext';
import { useUniverse } from '../../UniverseContext';
import CluesPanel from './CluesPanel';
import SessionLogPanel from './SessionLogPanel';
import Confirm from '../Confirm';
import IntrigueDrawer from './IntrigueDrawer';                    // F6 INTRIGUE
import { buildRecap, downloadText } from './recap';             // F5 RECAP
import { docText, formatBurn } from '../player/HandoutDoc';      // F5 RECAP
import { apiHeaders } from '../../apiToken';                     // F5 RECAP
import './MoreDrawer.css';

/* ═══════════════════════════════════════════════════════════════
   MORE drawer (Focus Stage dock): AGENDAS (each seat's agenda for
   this act + SEND AGENDA CARDS) · NPCS (wants / if ignored / secrets)
   · CLUES · LOG (notes, endings, EXPORT RECAP) · SAFETY (session zero,
   pause) · END (end the session for everyone).
   ═══════════════════════════════════════════════════════════════ */
export default function MoreDrawer({ pack, act, actIndex, sceneClueIds = [], onResendOrders, tab: tabProp, onTab }) {
  const { players, table, pauseClear, leaveGame } = useGame();
  const { universe } = useUniverse();
  const { terms } = universe;
  const [showSecrets, setShowSecrets] = useState(false);
  const tab = tabProp || 'agendas';
  const assigned = Object.values(players || {}).filter((p) => p.character);
  const sentOrders = (pid) => (table?.orders?.[pid] || []).some((o) => o.actIndex === actIndex);
  const safety = table?.safety;
  const tabs = [
    ['intrigue', 'INTRIGUE'], // F6
    ['agendas', 'AGENDAS'],
    ['npcs', `NPCS${pack?.npcs?.length ? ` · ${pack.npcs.length}` : ''}`],
    ['clues', 'CLUES'],
    ['log', 'LOG'],
    ['recap', 'RECAP'], // F5
    ['safety', table?.pause ? 'SAFETY ●' : 'SAFETY'],
    ['end', 'END'],
  ];
  useEffect(() => { if (!tabs.some(([id]) => id === tab)) onTab('agendas'); });
  /* The tab strip scrolls sideways (MoreDrawer.css): keep the selected tab in view. Scrolls the strip
     only (never the page or the drawer), now and once more after the drawer's open transition. */
  const stripRef = useRef(null);
  useEffect(() => {
    const reveal = () => {
      const s = stripRef.current;
      const el = s?.querySelector('[aria-selected="true"]');
      if (!s || !el) return;
      const a = s.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      if (b.left < a.left) s.scrollLeft -= a.left - b.left + 8;
      else if (b.right > a.right) s.scrollLeft += b.right - a.right + 8;
    };
    reveal();
    const t = setTimeout(reveal, 350);
    return () => clearTimeout(t);
  }, [tab]);
  /* Arrow keys / Home / End move between tabs (roving focus). */
  const onTabKey = (e) => {
    const i = tabs.findIndex(([id]) => id === tab);
    const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (n === undefined) return;
    e.preventDefault();
    const next = tabs[(n + tabs.length) % tabs.length][0];
    onTab(next);
    requestAnimationFrame(() => stripRef.current?.querySelector(`[data-tab="${next}"]`)?.focus());
  };

  return (
    <div className="md">
      <div className="md-tabs md-tabs-scroll" role="tablist" aria-label="More" ref={stripRef} onKeyDown={onTabKey}>
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" data-tab={id} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1}
            className={tab === id ? 'on' : ''} onClick={() => onTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'intrigue' && <div role="tabpanel" aria-label="Intrigue"><IntrigueDrawer pack={pack} /></div>/* F6 */}

      {tab === 'agendas' && (
        <div className="run-agendas" role="tabpanel" aria-label="Agendas">
          {assigned.length > 0 ? (
            <>
              <div className="md-row">
                <span className="fs-label">{terms.players.toUpperCase()} — {act?.title || 'THIS ACT'}</span>
                <button type="button" className="run-btn primary" onClick={onResendOrders}>SEND AGENDA CARDS</button>
              </div>
              {assigned.map((p) => {
                const text = p.character.agendaByAct?.[String(actIndex + 1)];
                return (
                  <div key={p.id} className="run-card pc">
                    <div className="run-card-head">
                      <b>{p.character.name}</b><span className="run-dim">{p.name}</span>
                      {sentOrders(p.id) && <span className="run-receipt all">SENT</span>}
                    </div>
                    <p>{text || p.character.personalAgenda || <i className="run-dim">No agenda for this act.</i>}</p>
                  </div>
                );
              })}
              <p className="nd-hint">SEND AGENDA CARDS pushes each {terms.player.toLowerCase()}'s agenda for this act to their phone as a private card. ADVANCE ACT sends the next act's automatically.</p>
            </>
          ) : <p className="run-empty">Assign characters (in {terms.players}) to see their agendas here.</p>}
        </div>
      )}

      {tab === 'npcs' && (
        <div role="tabpanel" aria-label="NPCs">
          {pack?.npcs?.length > 0 ? (
            <>
              <div className="md-row">
                <span className="fs-label">NPCS — IF IGNORED</span>
                <button type="button" className="run-btn" aria-pressed={showSecrets} onClick={() => setShowSecrets((v) => !v)}>{showSecrets ? 'HIDE SECRETS' : 'SHOW SECRETS'}</button>
              </div>
              {pack.npcs.map((n) => (
                <div key={n.name} className="run-card npc">
                  <div className="run-card-head"><b>{n.name}</b>{n.role && <span className="run-dim">{n.role}</span>}</div>
                  <p><span className="run-accent">WANTS: </span>{n.agenda}</p>
                  {n.behavior && <p><span className="run-warn">IF IGNORED: </span>{n.behavior}</p>}
                  {showSecrets && n.secret && <p className="run-secret">SECRET: {n.secret}</p>}
                </div>
              ))}
            </>
          ) : <p className="run-empty">{pack ? 'This scenario lists no NPCs.' : 'Sandbox: no scenario NPCs.'}</p>}
        </div>
      )}

      {tab === 'clues' && <div role="tabpanel" aria-label="Clues"><CluesPanel highlight={sceneClueIds} /></div>}
      {tab === 'log' && <div role="tabpanel" aria-label="Log"><SessionLogPanel pack={pack} /></div>}
      {tab === 'recap' && <div role="tabpanel" aria-label="Recap"><RecapSection pack={pack} /></div>}

      {tab === 'safety' && (
        <div className="md-safety" role="tabpanel" aria-label="Safety">
          {table?.pause ? (
            <div className="dm-pause">
              <span className="dm-pause-mark" aria-hidden="true">❚❚</span>
              <span><b>PAUSE REQUESTED</b> — check in, adjust, continue. You never see who asked.</span>
              <button type="button" className="run-btn primary" onClick={() => pauseClear()}>RESUME PLAY</button>
            </div>
          ) : <p className="run-empty">No pause requested. Every phone has an anonymous PAUSE button.</p>}
          <div className="fs-label">SESSION ZERO</div>
          {safety?.enabled ? (
            <>
              {safety.tone?.length > 0 && <div className="s0-row"><span className="s0-label">TONE</span>{safety.tone.map((t) => <span key={t} className="run-chip on static">{t}</span>)}</div>}
              {safety.warnings?.length > 0 && (
                <div className="s0-row"><span className="s0-label">WARNINGS</span>{safety.warnings.map((w) => <span key={w} className="run-chip static">{w}</span>)}</div>
              )}
              {safety.linesVeils && <p className="run-dim-p">{safety.linesVeils}</p>}
              <div className="s0-row">
                <span className="s0-label">CONFIRMED</span>
                {Object.values(players || {}).map((p) => (
                  <span key={p.id} className={`dm-s0${safety.confirmed?.includes(p.id) ? ' ok' : ''}`}>{p.character?.name || p.name}{safety.confirmed?.includes(p.id) ? ' ✓' : ' …'}</span>
                ))}
              </div>
            </>
          ) : <p className="run-empty">Session zero was off for this {terms.session.toLowerCase()} (set it on the session screen before INITIALIZE).</p>}
        </div>
      )}

      {tab === 'end' && (
        <div className="md-end" role="tabpanel" aria-label={`End ${terms.session}`}>
          <p className="run-dim-p">To stop for tonight and continue later, just close this tab: the {terms.session.toLowerCase()} stays saved and resumable. Export the recap first (LOG → EXPORT RECAP) if you want one.</p>
          <Confirm danger block label={`END ${terms.session.toUpperCase()} FOR EVERYONE`} title={`END THIS ${terms.session.toUpperCase()} FOR EVERYONE?`}
            message={`Phones and the TV are disconnected and the saved ${terms.session.toLowerCase()} is deleted.`}
            confirmLabel={`END ${terms.session.toUpperCase()}`} cancelLabel="KEEP PLAYING" onConfirm={leaveGame} className="fs-btn danger" />
        </div>
      )}
    </div>
  );
}

/* ═══ F5 — RECAP: the ship's log ════════════════════════════════
   GENERATE asks the server (POST /api/recap, SSE) for a 150-300 word log
   in the terminal's voice, written from the PUBLIC session log only
   (server/recap.js filters it; with ANTHROPIC_API_KEY it is Claude, else a
   deterministic template). The GM can edit it, SEND TO PHONES as a themed
   handout document (optional burn-after-reading timer), SHOW ON TV, and
   EXPORT MD (the LOG tab's recap with the ship's log on top).
   ═══════════════════════════════════════════════════════════════ */
const BURN_CHOICES = [0, 30, 60, 120, 300];
const burnLabel = (s) => (s < 60 ? `${s} SEC` : formatBurn(s)); // "30S" reads as "305" in the ALIEN font
const dmTokenOf = (code) => {
  try {
    const map = JSON.parse(localStorage.getItem('muthur.dmTokens') || '{}');
    if (map?.[code]) return map[code];
    const s = JSON.parse(localStorage.getItem('muthur.session') || '{}');
    return s?.code === code ? s.dmToken : '';
  } catch { return ''; }
};

/** Minimal SSE reader for a fetch Response: calls on(event, data) per message. */
async function readSse(res, on) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      let ev = 'message';
      let data = '';
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) ev = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (data) { try { on(ev, JSON.parse(data)); } catch { /* malformed line */ } }
    }
  }
}

function RecapSection({ pack }) {
  const { gameCode, players, table, sessionLog, sendHandout, narrate } = useGame();
  const { universe } = useUniverse();
  const [status, setStatus] = useState(null);   // { claude, model }
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [doc, setDoc] = useState(null);         // { title, from, to, priority, timestamp }
  const [source, setSource] = useState('');
  const [note, setNote] = useState('');
  const [burn, setBurn] = useState(0);
  const [sent, setSent] = useState('');
  const abortRef = React.useRef(null);

  useEffect(() => {
    let live = true;
    fetch('/api/recap/status').then((r) => r.json()).then((s) => { if (live) setStatus(s); }).catch(() => {});
    return () => { live = false; abortRef.current?.abort(); };
  }, []);

  const generate = async () => {
    setBusy(true); setNote(''); setSent(''); setText('');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch('/api/recap', {
        method: 'POST', signal: ctrl.signal,
        headers: apiHeaders({ 'Content-Type': 'application/json', Accept: 'text/event-stream' }),
        body: JSON.stringify({ code: gameCode, dmToken: dmTokenOf(gameCode) }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || j.error || `HTTP ${res.status}`);
      }
      await readSse(res, (ev, d) => {
        if (ev === 'status') setSource(d.source);
        else if (ev === 'delta') setText(d.text);
        else if (ev === 'done') { setText(d.text); setDoc(d.doc); setSource(d.source); if (d.warning) setNote(d.warning); }
        else if (ev === 'error') setNote(d.message || 'Recap failed.');
      });
    } catch (e) {
      if (e?.name !== 'AbortError') setNote(e.message || 'Recap failed.');
    } finally {
      setBusy(false);
    }
  };

  const title = doc?.title || "SHIP'S LOG";
  const header = {
    from: doc?.from || universe.terminal?.name || '',
    to: doc?.to || String(universe.terms?.players || '').toUpperCase(),
    priority: doc?.priority || universe.terms?.priorities?.[0] || '',
  };
  const ready = !!text.trim() && !busy;
  const playerCount = Object.keys(players || {}).length;
  const words = (text.match(/\S+/g) || []).length;

  const send = () => {
    sendHandout({ custom: { title, ...header, text: docText({ timestamp: doc?.timestamp, burnSec: burn, text }) } }, 'all', (r) => {
      setSent(r?.error ? `NOT SENT: ${r.error}` : `SENT TO ALL ${String(universe.terms?.players || 'players').toUpperCase()}${burn ? ` · BURNS ${burnLabel(burn)} AFTER READING` : ''}`);
    });
  };
  const toTv = () => narrate(docText({ ...header, timestamp: doc?.timestamp, burnSec: burn, text }).slice(0, 4000), { title, mode: 'card' });
  const exportMd = () => {
    const base = buildRecap({
      title: pack?.meta?.title || `${universe.terms?.session || 'Session'} ${gameCode}`,
      universeName: universe.name, code: gameCode, players, table, log: sessionLog, terms: universe.terms,
    });
    const lines = base.split('\n');
    const meta = [header.from && `From ${header.from}`, header.to && `to ${header.to}`, doc?.timestamp].filter(Boolean).join(' · ');
    lines.splice(4, 0, `## ${title}`, '', ...(meta ? [`*${meta}*`, ''] : []), text.trim(), ''); // after the title + subtitle lines
    downloadText(lines.join('\n'), `ships-log-${(pack?.id || 'session')}-${new Date().toISOString().slice(0, 10)}.md`);
  };

  return (
    <div className="md-recap">
      <div className="md-row">
        <span className="fs-label">{title}</span>
        <button type="button" className="run-btn primary" onClick={generate} disabled={busy || !gameCode} aria-busy={busy}>
          {busy ? 'COMPILING…' : text ? 'REGENERATE' : 'GENERATE'}
        </button>
      </div>
      <p className="nd-hint">
        Written in {universe.terminal?.name || 'the terminal'}'s voice from the public record only: no GM notes, secret rolls, private handouts or clues, hidden clocks, or pauses.
        {status ? (status.claude ? ` Writer: Claude (${status.model}).` : ' Writer: built-in template (set ANTHROPIC_API_KEY on the server for Claude).') : ''}
      </p>
      {(text || busy) && (
        <textarea className="md-recap-text" value={text} onChange={(e) => setText(e.target.value)} rows={12} readOnly={busy}
          aria-label={`${title} text`} placeholder="…" style={{ width: '100%', resize: 'vertical', minHeight: '12em', marginBottom: 6 }} />
      )}
      {ready && (
        <p className="run-dim" style={{ margin: '0 0 10px' }}>
          {words} words · {source === 'claude' ? 'written by Claude' : 'templated'}{doc?.timestamp ? ` · ${doc.timestamp}` : ''}
        </p>
      )}
      {note && <p className="run-warn" role="status">{note}</p>}
      {ready && (
        <>
          <div className="run-row" role="group" aria-label="Burn after reading" style={{ flexWrap: 'wrap' }}>
            <span className="run-dim">BURN AFTER READING</span>
            {BURN_CHOICES.map((s) => (
              <button key={s} type="button" className={`run-chip${burn === s ? ' on' : ''}`} aria-pressed={burn === s} onClick={() => setBurn(s)} style={{ minHeight: 44, minWidth: 44 }}>
                {s ? burnLabel(s) : 'OFF'}
              </button>
            ))}
          </div>
          <div className="run-row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="run-btn primary" onClick={send} disabled={!playerCount}>SEND TO PHONES</button>
            <button type="button" className="run-btn" onClick={toTv}>SHOW ON TV</button>
            <button type="button" className="run-btn" onClick={exportMd}>EXPORT MD</button>
          </div>
          {sent && <p className="run-dim" role="status">{sent}</p>}
        </>
      )}
      {!text && !busy && <p className="run-empty">No log compiled yet. GENERATE writes one from what has happened so far; you can edit it before sending.</p>}
    </div>
  );
}
