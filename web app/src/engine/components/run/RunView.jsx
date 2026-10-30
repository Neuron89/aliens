import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../GameContext';
import { useUniverse } from '../../UniverseContext';
import { useContent } from '../../ContentContext';
import RunScene from './RunScene';
import ClocksPanel from './ClocksPanel';
import HandoutsPanel from './HandoutsPanel';
import CluesPanel from './CluesPanel';
import SessionLogPanel from './SessionLogPanel';
import RollFeed from './RollFeed';
import InitiativePanel from './InitiativePanel';
import ThreatsPanel from './ThreatsPanel';
import PoolCounters from './PoolCounters';
import { ambientPreset } from '../../mechanicsUtils';

/* ═══════════════════════════════════════════════════════════════
   GM RUN VIEW (DM tab "RUN") — the GM's main screen during play
   (docs/RESEARCH_GM_PLAYER_EXPERIENCE.md rows 1, 48, 49).
   Left: act switcher + current scene card (read-aloud → table, checks,
   events, NPC guidance, outcomes, clues here), prev/next.
   Right rail: clocks, AGENDAS (NPC cards + each PC's agenda for this act,
   SEND AGENDA CARDS) · HANDOUTS (receipts) · CLUES · INITIATIVE · THREATS
   (creature cards) · LOG, roll feed. Pools (Momentum/Threat) in the top strip.
   Scene change → scene.ambient switches the GM's ambient preset (audio prop).
   Scene progress lives in table.run on the server (survives resume).
   ═══════════════════════════════════════════════════════════════ */
const clampI = (n, lo, hi) => Math.max(lo, Math.min(hi, Number.isInteger(n) ? n : lo));

export default function RunView({ tts, audio }) {
  const {
    table, packId, players, runSet, advanceAct, narrate, narrateClear, setBoardMode, sessionSeed, clueReveal,
    boardLinked, gameCode, gmPin, pinFresh, hidePin,
  } = useGame();
  const [copied, setCopied] = useState(false);
  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/?join=${gameCode}` : '';
  const copyJoin = () => { navigator.clipboard?.writeText(joinUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {}); };
  const { universe } = useUniverse();
  const { byId } = useContent();
  const { terms } = universe;
  const pack = packId ? byId[packId] : null;
  const acts = useMemo(() => pack?.acts || [], [pack]);
  const run = table?.run || { actIndex: 0, sceneIndex: 0, completed: {} };
  const actIndex = clampI(run.actIndex, 0, Math.max(0, acts.length - 1));
  const act = acts[actIndex];
  const scenes = act?.scenes || [];
  const sceneIndex = clampI(run.sceneIndex, 0, Math.max(0, scenes.length - 1));
  const scene = scenes[sceneIndex];
  const completed = run.completed || {};
  const key = `${actIndex}-${sceneIndex}`;
  const [railTab, setRailTab] = useState('agendas');
  const [freeText, setFreeText] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);
  const [actInfo, setActInfo] = useState(false);
  const seeding = useRef(false);

  /* Scene ambient → the GM's AudioPanel preset (only when the scene names a known preset). */
  const lastAmbient = useRef(null);
  const sceneAmbient = scene?.ambient || null;
  useEffect(() => {
    if (!audio || !sceneAmbient || lastAmbient.current === `${key}:${sceneAmbient}`) return;
    lastAmbient.current = `${key}:${sceneAmbient}`;
    const id = ambientPreset(sceneAmbient, audio.presets);
    if (id && id !== audio.preset) audio.applyPreset(id);
  }, [audio, sceneAmbient, key]);

  /* Seed pack clocks/clues into the session once (server keeps GM edits afterwards). */
  useEffect(() => {
    if (!table || table.seeded || seeding.current || (packId && !pack)) return;
    seeding.current = true;
    sessionSeed({ clocks: pack?.clocks || [], clues: pack?.clues || [] }, () => { seeding.current = false; });
  }, [table, pack, packId, sessionSeed]);

  const actLabel = (a) => (a ? `${a.title}${a.subtitle ? ` — ${a.subtitle}` : ''}` : '');
  const theatreFor = (a, s) => ({ title: actLabel(acts[a]), subtitle: acts[a]?.scenes?.[s]?.name || '', art: acts[a]?.sceneArt || null });

  const goScene = (a, s) => {
    const sc = acts[a]?.scenes?.[s];
    const amb = ambientPreset(sc?.ambient);
    runSet({ actIndex: a, sceneIndex: s, actTitle: actLabel(acts[a]), sceneTitle: sc?.name || '', ambient: amb || null });
    if (table?.boardMode === 'theatre') setBoardMode('theatre', theatreFor(a, s));
  };
  const toggleDone = () => runSet({ completed: { ...completed, [key]: !completed[key] }, actIndex, sceneIndex, sceneTitle: scene?.name || '' });
  const doAdvance = () => {
    const next = actIndex + 1;
    if (!acts[next]) return;
    const withAgenda = Object.values(players).filter((p) => p.character?.agendaByAct?.[String(next + 1)]).length;
    if (!confirm(`Start ${actLabel(acts[next])}?${withAgenda ? `\n${withAgenda} player(s) receive NEW ORDERS on their phone.` : ''}`)) return;
    advanceAct(next, { actTitle: actLabel(acts[next]), sceneTitle: acts[next].scenes?.[0]?.name || '' });
    if (table?.boardMode === 'theatre') setBoardMode('theatre', theatreFor(next, 0));
  };
  const resendOrders = () => advanceAct(actIndex, { actTitle: actLabel(act), sceneTitle: scene?.name || '' });
  const sendNarration = (text, mode) => narrate(text, { title: scene?.name || act?.title || '', mode });
  const toggleTheatre = () => {
    if (table?.boardMode === 'theatre') setBoardMode('map');
    else setBoardMode('theatre', theatreFor(actIndex, sceneIndex));
  };

  const sceneClues = (table?.clues || []).filter((c) => (scene?.clueRefs || []).includes(c.id) || (c.scene && scene && c.scene === scene.name));
  const actDone = scenes.filter((_, i) => completed[`${actIndex}-${i}`]).length;
  const assigned = Object.values(players).filter((p) => p.character);
  const sentOrders = (pid) => (table?.orders?.[pid] || []).some((o) => o.actIndex === actIndex);
  const narration = table?.narration;
  const unseen = (table?.handouts || []).reduce((n, h) => n + ((h.recipients === 'all' ? Object.keys(players).length : (h.recipients || []).length) - h.seenBy.length), 0);

  return (
    <div className="run">
      {/* ─── Table strip ─── */}
      <div className="run-top">
        <div className="run-top-title">
          <span className="run-kicker">RUN</span>
          <span className="run-pack">{pack ? pack.meta.title : 'SANDBOX'}</span>
        </div>
        {/* The GM lands here right after INITIALIZE: the join code (what players type) and, once,
            the GM PIN must be visible without visiting the Session tab. */}
        <div className="run-code">
          <b className="run-code-val" title={joinUrl}>{gameCode}</b>
          <button type="button" className="run-btn sm" onClick={copyJoin}>{copied ? 'COPIED' : 'COPY JOIN LINK'}</button>
          {pinFresh && gmPin && (
            <span className="dm-pin" title="Lets another terminal take over as GM. Never share it with players.">
              GM PIN <b>{gmPin}</b>
              <button type="button" className="run-btn sm" onClick={hidePin}>NOTED</button>
            </span>
          )}
        </div>
        <div className="run-row">
          <PoolCounters />
          <span className={`mc-tv${boardLinked ? ' up' : ''}`}><span className="link-dot" />{boardLinked ? 'TV' : 'NO TV'}</span>
          <div className="run-seg" role="group" aria-label="Board mode">
            <button type="button" className={table?.boardMode !== 'theatre' ? 'on' : ''} onClick={() => table?.boardMode === 'theatre' && toggleTheatre()}>MAP</button>
            <button type="button" className={table?.boardMode === 'theatre' ? 'on' : ''} onClick={() => table?.boardMode !== 'theatre' && toggleTheatre()}>THEATRE</button>
          </div>
          {narration && (
            <button type="button" className="run-btn warn" onClick={() => narrateClear()} title={narration.text}>CLEAR TABLE TEXT</button>
          )}
        </div>
      </div>

      <div className="run-grid">
        {/* ─── Main: acts + scene ─── */}
        <main className="run-main">
          {acts.length > 0 ? (
            <>
              <nav className="run-acts" aria-label="Acts">
                {acts.map((a, i) => {
                  const n = (a.scenes || []).length;
                  const d = (a.scenes || []).filter((_, j) => completed[`${i}-${j}`]).length;
                  return (
                    <button key={i} type="button" className={`run-act${i === actIndex ? ' on' : ''}`} onClick={() => i !== actIndex && goScene(i, 0)}>
                      <span>{a.title}</span>{a.subtitle && <small>{a.subtitle}</small>}
                      {n > 0 && <i className="run-act-bar"><b style={{ width: `${(d / n) * 100}%` }} /></i>}
                    </button>
                  );
                })}
                {acts[actIndex + 1] && <button type="button" className="run-btn primary run-advance" onClick={doAdvance}>ADVANCE ACT ▸</button>}
              </nav>

              <section className="run-actinfo">
                <button type="button" className="run-actinfo-head" onClick={() => setActInfo((v) => !v)} aria-expanded={actInfo}>
                  <span>{actLabel(act)} · {actDone}/{scenes.length} SCENES</span><span>{actInfo ? '▲' : '▼'}</span>
                </button>
                {act?.summary && <p className="run-actinfo-sum">{act.summary}</p>}
                {actInfo && (
                  <div className="run-actinfo-body">
                    {act.agendaNotes && <p><b className="run-accent">AGENDAS: </b>{act.agendaNotes}</p>}
                    {act.gmNotes && <p className="run-dim-p">{act.gmNotes}</p>}
                    {act.readAloud?.length > 0 && (
                      <div className="run-row">
                        <button type="button" className="run-btn sm" onClick={() => narrate(act.readAloud.join('\n\n'), { title: actLabel(act), mode: 'card', art: act.sceneArt })}>ACT OPENING → TV CARD</button>
                        {tts && <button type="button" className="run-btn sm" onClick={() => tts.speak(act.readAloud)}>▶ TTS</button>}
                      </div>
                    )}
                  </div>
                )}
              </section>

              <div className="run-scenenav">
                <button type="button" className="run-btn" disabled={sceneIndex === 0} onClick={() => goScene(actIndex, sceneIndex - 1)}>◂ PREV</button>
                <select value={sceneIndex} onChange={(e) => goScene(actIndex, Number(e.target.value))} aria-label="Scene">
                  {scenes.map((s, i) => <option key={i} value={i}>{completed[`${actIndex}-${i}`] ? '✓ ' : ''}{i + 1}. {s.name}</option>)}
                </select>
                {sceneIndex < scenes.length - 1
                  ? <button type="button" className="run-btn" onClick={() => goScene(actIndex, sceneIndex + 1)}>NEXT ▸</button>
                  : acts[actIndex + 1]
                    ? <button type="button" className="run-btn primary" onClick={doAdvance}>ADVANCE ACT ▸</button>
                    : <span className="run-dim">FINAL SCENE</span>}
              </div>

              {scene ? (
                <RunScene scene={scene} act={act} done={!!completed[key]} onToggleDone={toggleDone} tts={tts}
                  onNarrate={sendNarration} narrationLive={!!narration && narration.text === scene.narration}
                  clues={sceneClues} onRevealClue={(id) => clueReveal(id, 'all')} />
              ) : (
                <div className="run-box"><p className="run-empty">This act has no scene runner. Use the act text above.</p></div>
              )}
            </>
          ) : (
            <div className="run-box">
              <h3 className="run-h">{pack ? 'NO ACTS IN THIS PACK' : 'SANDBOX'}</h3>
              <p className="run-empty">No scene runner — narrate freely, run clocks, clues and handouts from the rail.</p>
            </div>
          )}

          <form className="run-box run-free" onSubmit={(e) => { e.preventDefault(); if (freeText.trim()) { narrate(freeText.trim(), { mode: 'caption' }); setFreeText(''); } }}>
            <label className="rs-label" htmlFor="run-free">NARRATE TO TABLE</label>
            <textarea id="run-free" rows={2} value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder="Type a line for the TV and phones…" />
            <div className="run-row">
              <button type="submit" className="run-btn primary sm" disabled={!freeText.trim()}>SEND CAPTION</button>
              <button type="button" className="run-btn sm" disabled={!freeText.trim()} onClick={() => { narrate(freeText.trim(), { mode: 'card' }); setFreeText(''); }}>SEND AS CARD</button>
            </div>
          </form>
        </main>

        {/* ─── Rail ─── */}
        <aside className="run-rail">
          <ClocksPanel compact />
          <section className="run-box">
            <div className="run-tabs" role="tablist">
              {[
                ['agendas', 'AGENDAS'],
                ['handouts', `HANDOUTS${unseen > 0 ? ` · ${unseen}` : ''}`],
                ['clues', 'CLUES'],
                ['init', table?.initiative?.active ? `INIT · R${table.initiative.round}` : 'INIT'],
                ['threats', 'THREATS'],
                ['log', 'LOG'],
              ].map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={railTab === id} className={railTab === id ? 'on' : ''} onClick={() => setRailTab(id)}>{label}</button>
              ))}
            </div>

            {railTab === 'agendas' && (
              <div className="run-agendas">
                {assigned.length > 0 && (
                  <>
                    <div className="run-row run-agenda-actions">
                      <span className="rs-label">{terms.players?.toUpperCase() || 'PLAYERS'} — {act?.title || 'THIS ACT'}</span>
                      <button type="button" className="run-btn sm primary" onClick={resendOrders}>SEND AGENDA CARDS</button>
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
                  </>
                )}
                {pack?.npcs?.length > 0 && (
                  <>
                    <div className="run-row run-agenda-actions">
                      <span className="rs-label">NPCS — IF IGNORED</span>
                      <button type="button" className="run-btn sm" onClick={() => setShowSecrets((v) => !v)}>{showSecrets ? 'HIDE SECRETS' : 'SHOW SECRETS'}</button>
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
                )}
                {!assigned.length && !pack?.npcs?.length && <p className="run-empty">Assign characters to see their agendas here.</p>}
              </div>
            )}
            {railTab === 'handouts' && <HandoutsPanel handouts={pack?.handouts || []} terms={terms} />}
            {railTab === 'clues' && <CluesPanel highlight={sceneClues.map((c) => c.id)} />}
            {railTab === 'init' && <InitiativePanel />}
            {railTab === 'threats' && <ThreatsPanel />}
            {railTab === 'log' && <SessionLogPanel pack={pack} />}
          </section>
          <RollFeed />
        </aside>
      </div>
    </div>
  );
}
