import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../GameContext';
import { useUniverse } from '../../UniverseContext';
import { useContent } from '../../ContentContext';
import RunScene from './RunScene';
import SceneList from './SceneList';
import Drawer from './Drawer';
import Icon from './icons';
import ClocksPanel from './ClocksPanel';
import HandoutsPanel from './HandoutsPanel';
import RollFeed from './RollFeed';
import InitiativePanel from './InitiativePanel';
import ThreatsPanel from './ThreatsPanel';
import PoolCounters from './PoolCounters';
import CrewDrawer from './CrewDrawer';
import NarrateDrawer from './NarrateDrawer';
import MoreDrawer from './MoreDrawer';
import AiGmDrawer, { useAiGm } from './AiGmDrawer'; // AI GM narration drafts
import MapController from '../MapController';
import DiceRoller from '../DiceRoller';
import { ambientPreset } from '../../mechanicsUtils';
import Confirm from '../Confirm';

/* ═══════════════════════════════════════════════════════════════
   GM RUN VIEW — "Focus Stage" (docs/GAME_NIGHT.md, UI_BRIEF hybrid).
   ┌ progress strip: act · scene segments · SCENE n / N (→ scene list)
   │                 · ADVANCE ACT (when the act's scenes are done) · pools
   ├ stage: the current scene in large type (RunScene)
   └ dock (72px): NEXT SCENE · NARRATE · MAP · CREW · DICE · CLOCKS ·
                  HANDOUTS · THREATS · MORE — each opens one slide-over
                  drawer on the right (400px, no dimming; ✕ / Escape /
                  the same dock button closes it; the open drawer is
                  remembered per session in localStorage).
   Scene list: left drawer (tablet) or a pinned 280px column (≥1400px).
   Keys (never while typing): [ / ] previous / next scene, n narrate.
   Scene change → scene.ambient (or scene.ambience) switches the GM's ambient preset.
   Scene progress lives in table.run on the server (survives resume).
   ═══════════════════════════════════════════════════════════════ */
const clampI = (n, lo, hi) => Math.max(lo, Math.min(hi, Number.isInteger(n) ? n : lo));
const DRAWERS = ['narrate', 'ai', 'map', 'crew', 'dice', 'clocks', 'handouts', 'threats', 'more'];
const storeKey = (code) => `gm.run.drawer.${code || 'none'}`;
const readStore = (code) => {
  try { const v = JSON.parse(localStorage.getItem(storeKey(code)) || 'null'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
};
const writeStore = (code, v) => { try { localStorage.setItem(storeKey(code), JSON.stringify(v)); } catch { /* storage unavailable */ } };

function useMedia(query) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [m, setM] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const h = () => setM(mq.matches);
    h();
    mq.addEventListener?.('change', h);
    return () => mq.removeEventListener?.('change', h);
  }, [query]);
  return m;
}

const typingTarget = (t) => t && t.closest && t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');

export default function RunView({ tts, audio, active = true, onNavigate = () => {} }) {
  const {
    table, packId, players, runSet, advanceAct, narrate, narrateClear, setBoardMode, sessionSeed, clueReveal,
    gameCode, unreadBy, seatClaims = [],
  } = useGame();
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
  const seeding = useRef(false);
  const ai = useAiGm({ gameCode, actIndex, sceneIndex, hasScenes: acts.length > 0, sceneTitle: scene?.name || act?.title || '' }); // AUTO watches scene changes even with the drawer closed
  const wide = useMedia('(min-width: 1400px)');

  /* ─── Drawer state (one at a time, remembered per session) ─── */
  const [ui, setUi] = useState(() => readStore(gameCode));
  useEffect(() => { setUi(readStore(gameCode)); }, [gameCode]);
  const drawer = DRAWERS.includes(ui.drawer) ? ui.drawer : null;
  const moreTab = ui.moreTab || 'agendas';
  const [threatTab, setThreatTab] = useState('threats');
  const [listOpen, setListOpen] = useState(false);
  const save = useCallback((patch) => setUi((cur) => { const next = { ...cur, ...patch }; writeStore(gameCode, next); return next; }), [gameCode]);
  const openDrawer = useCallback((id, sub) => {
    save({ drawer: id, ...(sub && id === 'more' ? { moreTab: sub } : {}) });
    if (id === 'threats' && sub) setThreatTab(sub);
  }, [save]);
  const toggleDrawer = useCallback((id) => save({ drawer: drawer === id ? null : id }), [save, drawer]);
  const closeDrawer = useCallback(() => save({ drawer: null }), [save]);
  const dockRefs = useRef({});
  const listBtn = useRef(null);
  const returnRef = useMemo(() => ({ get current() { return drawer ? dockRefs.current[drawer] : null; } }), [drawer]);

  /* Scene ambient → the GM's ambient preset (only when the scene names a known preset). */
  const lastAmbient = useRef(null);
  const sceneAmbient = scene?.ambient ?? scene?.ambience ?? null; // packs may spell it either way
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
    const amb = ambientPreset(sc?.ambient ?? sc?.ambience);
    runSet({ actIndex: a, sceneIndex: s, actTitle: actLabel(acts[a]), sceneTitle: sc?.name || '', ambient: amb || null });
    if (table?.boardMode === 'theatre') setBoardMode('theatre', theatreFor(a, s));
  };
  const toggleDoneAt = (a, s) => {
    const k = `${a}-${s}`;
    runSet({ completed: { ...completed, [k]: !completed[k] }, actIndex, sceneIndex, sceneTitle: scene?.name || '' });
  };
  const toggleDone = () => toggleDoneAt(actIndex, sceneIndex);
  const hasNextScene = sceneIndex < scenes.length - 1;
  /* NEXT SCENE ticks the current scene done, then moves on. */
  const nextScene = () => {
    if (!hasNextScene) return;
    if (!completed[key]) runSet({ completed: { ...completed, [key]: true }, actIndex, sceneIndex, sceneTitle: scene?.name || '' });
    goScene(actIndex, sceneIndex + 1);
  };
  const prevScene = () => { if (sceneIndex > 0) goScene(actIndex, sceneIndex - 1); };
  const nextAct = acts[actIndex + 1];
  const withAgenda = nextAct ? Object.values(players).filter((p) => p.character?.agendaByAct?.[String(actIndex + 2)]).length : 0;
  const doAdvance = () => {
    const next = actIndex + 1;
    if (!acts[next]) return;
    if (scene && !completed[key]) runSet({ completed: { ...completed, [key]: true }, actIndex, sceneIndex, sceneTitle: scene?.name || '' });
    advanceAct(next, { actTitle: actLabel(acts[next]), sceneTitle: acts[next].scenes?.[0]?.name || '' });
    if (table?.boardMode === 'theatre') setBoardMode('theatre', theatreFor(next, 0));
  };
  /* ADVANCE ACT: themed inline confirm (Confirm.jsx), never a native dialog. */
  const advanceButton = (className, align = 'right', label = <>ADVANCE ACT<span aria-hidden="true"> ▸</span></>) => (
    <Confirm label={label} className={className} align={align} title={`START ${String(actLabel(nextAct)).toUpperCase()}?`}
      message={`The scene moves to ${nextAct?.scenes?.[0]?.name || 'the first scene'}.${withAgenda ? `\n${withAgenda} ${withAgenda === 1 ? terms.player.toLowerCase() + ' receives' : terms.players.toLowerCase() + ' receive'} NEW ORDERS on their phone.` : ''}`}
      confirmLabel="ADVANCE" onConfirm={doAdvance} />
  );
  const resendOrders = () => advanceAct(actIndex, { actTitle: actLabel(act), sceneTitle: scene?.name || '' });
  const sendNarration = (text, mode) => narrate(text, { title: scene?.name || act?.title || '', mode });
  const toggleTheatre = () => {
    if (table?.boardMode === 'theatre') setBoardMode('map');
    else setBoardMode('theatre', theatreFor(actIndex, sceneIndex));
  };
  const actOpening = () => act?.readAloud?.length && narrate(act.readAloud.join('\n\n'), { title: actLabel(act), mode: 'card', art: act.sceneArt });

  const sceneClues = (table?.clues || []).filter((c) => (scene?.clueRefs || []).includes(c.id) || (c.scene && scene && c.scene === scene.name));
  const actDone = scenes.filter((_, i) => completed[`${actIndex}-${i}`]).length;
  const allDone = scenes.length > 0 && actDone === scenes.length;
  const narration = table?.narration;
  const unseen = (table?.handouts || []).reduce((n, h) => n + Math.max(0, (h.recipients === 'all' ? Object.keys(players).length : (h.recipients || []).length) - h.seenBy.length), 0);
  const unreadTotal = Object.values(unreadBy || {}).reduce((a, b) => a + (b || 0), 0);
  const crewBadge = unreadTotal + seatClaims.length;
  const ini = table?.initiative;

  /* ─── Keyboard: [ / ] scenes, n narrate (GM terminal, Run section, never while typing) ─── */
  const keyRef = useRef({});
  const [narrateByKey, setNarrateByKey] = useState(false); // opened with `n` → focus the text box (a tap does not pop the tablet keyboard)
  keyRef.current = { prevScene, nextScene, toggleDrawer, setNarrateByKey };
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || typingTarget(e.target)) return;
      if (document.querySelector('.confirm-card')) return;
      const k = keyRef.current;
      if (e.key === '[') { e.preventDefault(); k.prevScene(); }
      else if (e.key === ']') { e.preventDefault(); k.nextScene(); }
      else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); k.setNarrateByKey(true); k.toggleDrawer('narrate'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  const nextLabel = hasNextScene ? 'NEXT SCENE' : nextAct ? 'ADVANCE ACT' : 'FINAL SCENE';
  const sceneListEl = acts.length > 0 && (
    <SceneList acts={acts} actIndex={actIndex} sceneIndex={sceneIndex} completed={completed} tts={tts}
      onGo={(a, s) => { goScene(a, s); if (!wide) setListOpen(false); }} onToggle={toggleDoneAt}
      onPrev={sceneIndex > 0 ? prevScene : null} onNext={nextScene} nextLabel={hasNextScene ? 'NEXT' : 'FINAL SCENE'} nextDisabled={!hasNextScene}
      advance={!hasNextScene && nextAct ? advanceButton('fs-btn primary', 'right') : null} onActOpening={actOpening} />
  );

  /* ─── Dock ─── */
  const dock = [
    ['narrate', 'NARRATE', 'narrate', narration ? '●' : null],
    ['ai', 'AI GM', 'ai', ai.autoReady ? 'NEW' : ai.busy ? '…' : null],
    ['map', 'MAP', 'board', null],
    ['crew', terms.players.toUpperCase(), 'crew', crewBadge || null],
    ['dice', 'DICE', 'dice', null],
    ['clocks', 'CLOCKS', 'clock', (table?.clocks || []).some((c) => c.filled === c.segments) ? '!' : null],
    ['handouts', 'HANDOUTS', 'handout', unseen || null],
    ['threats', 'THREATS', 'threat', ini?.active ? `R${ini.round}` : null],
    ['more', 'MORE', 'more', table?.pause ? '❚❚' : null],
  ];
  const drawerTitle = { narrate: 'NARRATE', ai: 'AI GM', map: 'MAP', crew: terms.players.toUpperCase(), dice: 'DICE', clocks: 'CLOCKS', handouts: 'HANDOUTS', threats: 'THREATS', more: 'MORE' };

  const drawerBody = () => {
    switch (drawer) {
      case 'narrate': return <NarrateDrawer onToggleTheatre={toggleTheatre} focusInput={narrateByKey} />;
      case 'ai': return <AiGmDrawer ai={ai} pack={pack} act={act} scene={scene} />;
      case 'map': return <MapController compact onOpenFull={() => { closeDrawer(); onNavigate('board'); }} />;
      case 'crew': return <CrewDrawer onOpen={openDrawer} onNavigate={onNavigate} />;
      case 'dice': return (
        <div className="dd">
          <DiceRoller compact />
          <RollFeed limit={10} title="ROLL FEED" />
        </div>
      );
      case 'clocks': return <ClocksPanel />;
      case 'handouts': return <HandoutsPanel handouts={pack?.handouts || []} terms={terms} />;
      case 'threats': return (
        <div className="td">
          <div className="md-tabs" role="tablist" aria-label="Threats">
            <button type="button" role="tab" aria-selected={threatTab === 'threats'} className={threatTab === 'threats' ? 'on' : ''} onClick={() => setThreatTab('threats')}>CREATURES</button>
            <button type="button" role="tab" aria-selected={threatTab === 'init'} className={threatTab === 'init' ? 'on' : ''} onClick={() => setThreatTab('init')}>
              INITIATIVE{ini?.active ? ` · R${ini.round}` : ''}
            </button>
          </div>
          <div role="tabpanel">{threatTab === 'init' ? <InitiativePanel /> : <ThreatsPanel />}</div>
        </div>
      );
      case 'more': return (
        <MoreDrawer pack={pack} act={act} actIndex={actIndex} sceneClueIds={sceneClues.map((c) => c.id)}
          onResendOrders={resendOrders} tab={moreTab} onTab={(t) => save({ moreTab: t })} />
      );
      default: return null;
    }
  };

  return (
    <div className={`fs${drawer ? ' has-drawer' : ''}${wide && acts.length > 0 ? ' pinned-list' : ''}${drawer === 'map' ? ' wide-drawer' : ''}`}>
      {/* ─── Progress strip ─── */}
      {acts.length > 0 && (
        <div className="fs-progress">
          <button type="button" ref={listBtn} className="fs-act" onClick={() => !wide && setListOpen((v) => !v)} aria-expanded={wide ? undefined : listOpen}
            aria-controls="fs-scenes" title="Acts and scenes">
            <Icon name="list" size={18} />
            <span>{act?.title}{act?.subtitle ? <small> · {act.subtitle}</small> : null}</span>
          </button>
          <ol className="fs-segs" aria-label={`Scenes in ${act?.title || 'this act'}`}>
            {scenes.map((s, i) => {
              const d = !!completed[`${actIndex}-${i}`];
              const on = i === sceneIndex;
              return (
                <li key={i}>
                  <button type="button" className={`fs-seg${d ? ' done' : ''}${on ? ' on' : ''}`} onClick={() => goScene(actIndex, i)}
                    aria-current={on ? 'step' : undefined} aria-label={`Scene ${i + 1}: ${s.name}${d ? ', done' : ''}`} title={`${i + 1}. ${s.name}`} />
                </li>
              );
            })}
          </ol>
          <button type="button" className="fs-count" onClick={() => !wide && setListOpen((v) => !v)} aria-expanded={wide ? undefined : listOpen} aria-controls="fs-scenes">
            SCENE {Math.min(sceneIndex + 1, scenes.length)} / {scenes.length}
          </button>
          {allDone && nextAct && advanceButton('fs-btn primary fs-advance', 'right')}
          <PoolCounters className="fs-pools" />
        </div>
      )}

      {/* ─── Scene list: pinned column (wide) or left drawer ─── */}
      {acts.length > 0 && wide && <aside className="fs-scenes-col" id="fs-scenes" aria-label="Acts and scenes">{sceneListEl}</aside>}
      {acts.length > 0 && !wide && listOpen && (
        <Drawer id="fs-scenes" side="left" title="ACTS & SCENES" onClose={() => setListOpen(false)} returnFocus={listBtn}>
          {sceneListEl}
        </Drawer>
      )}

      {/* ─── Stage ─── */}
      <div className="fs-main">
        {acts.length > 0 ? (
          scene ? (
            <RunScene scene={scene} act={act} actIndex={actIndex} sceneIndex={sceneIndex} sceneCount={scenes.length}
              done={!!completed[key]} onToggleDone={toggleDone} tts={tts}
              onNarrate={sendNarration} narrationLive={!!narration && narration.text === scene.narration} onClearNarration={() => narrateClear()}
              clues={sceneClues} onRevealClue={(id) => clueReveal(id, 'all')} />
          ) : (
            <div className="fs-empty">
              <div className="fs-kicker">{actLabel(act)}</div>
              <h1 className="fs-title">{act?.title}</h1>
              {act?.summary && <p className="fs-sum">{act.summary}</p>}
              <p className="run-empty">This act has no scene runner. Use the act brief in the scene list, and narrate freely (NARRATE or key n).</p>
              {act?.readAloud?.length > 0 && <button type="button" className="fs-btn" onClick={actOpening}>ACT OPENING → TV CARD</button>}
            </div>
          )
        ) : (
          <div className="fs-empty">
            <div className="fs-kicker">{pack ? pack.meta.title : terms.session.toUpperCase()}</div>
            <h1 className="fs-title">{pack ? 'No acts in this pack' : 'Sandbox'}</h1>
            <p className="fs-sum">No scene runner: narrate freely, and run the map, {terms.players.toLowerCase()}, clocks, clues and handouts from the dock below.</p>
            <div className="fs-actions">
              <button type="button" className="fs-btn primary" onClick={() => openDrawer('narrate')}>NARRATE</button>
              <button type="button" className="fs-btn" onClick={() => openDrawer('map')}>MAP</button>
              <button type="button" className="fs-btn" onClick={() => openDrawer('crew')}>{terms.players.toUpperCase()}</button>
            </div>
            <PoolCounters className="fs-pools" />
          </div>
        )}
      </div>

      {/* ─── Right drawer ─── */}
      {drawer && (
        <Drawer key={drawer} id={`fs-drawer-${drawer}`} title={drawerTitle[drawer]} onClose={closeDrawer} returnFocus={returnRef}
          className={`dr-${drawer}`} label={drawer === 'crew' ? terms.players : drawerTitle[drawer].toLowerCase()}>
          {drawerBody()}
        </Drawer>
      )}

      {/* ─── Dock ─── */}
      <nav className="dock" aria-label="Run controls">
        {acts.length > 0 && (
          hasNextScene || !nextAct ? (
            <button type="button" className="dock-btn next" onClick={nextScene} disabled={!hasNextScene} aria-keyshortcuts="]">
              <Icon name="next" /><span>{nextLabel}</span>
            </button>
          ) : (
            advanceButton('dock-btn next', 'left', <><Icon name="next" /><span>ADVANCE ACT</span></>)
          )
        )}
        {dock.map(([id, label, icon, badge]) => (
          <button key={id} type="button" ref={(el) => { dockRefs.current[id] = el; }} className={`dock-btn${drawer === id ? ' on' : ''}`}
            aria-expanded={drawer === id} aria-controls={drawer === id ? `fs-drawer-${id}` : undefined}
            aria-keyshortcuts={id === 'narrate' ? 'n' : undefined}
            aria-label={`${label}${badge ? ` (${badge === '●' ? 'text on the table' : badge === '!' ? 'a clock is full' : badge === '❚❚' ? 'pause requested' : badge})` : ''}`}
            onClick={() => { setNarrateByKey(false); toggleDrawer(id); }}>
            <Icon name={icon} />
            <span>{label}</span>
            {badge && <b className={`dock-badge${badge === '❚❚' || badge === '!' ? ' warn' : ''}`} aria-hidden="true">{badge}</b>}
          </button>
        ))}
      </nav>
    </div>
  );
}
