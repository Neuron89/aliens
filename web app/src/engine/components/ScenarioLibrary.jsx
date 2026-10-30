import React, { useState, useMemo } from 'react';
import { useUniverse } from '../UniverseContext';
import { useContent } from '../ContentContext';
import { useGame } from '../GameContext';
import ScenarioDetail from './ScenarioDetail';
import ScenarioPlayer from './ScenarioPlayer';
import PackImportExport, { ExportPackButton } from './PackImportExport';
import GameNightWizard from './GameNightWizard';
import Motif from './fx/Motifs';
import { play } from '../sfx';

const TYPE_ORDER = ['Cinematic', 'One-Shot', 'Campaign'];

/** Art for the card strip: an act's sceneArt, else the first image map; null → generated motif. */
function cardArt(p) {
  for (const a of p.acts || []) {
    if (typeof a.sceneArt === 'string' && a.sceneArt) return a.sceneArt;
    for (const sc of a.scenes || []) if (typeof sc.sceneArt === 'string' && sc.sceneArt) return sc.sceneArt;
  }
  const m = (p.maps || []).find((x) => typeof (x.src || x.image) === 'string');
  return m ? (m.src || m.image) : null;
}

/** 'low' | 'medium' | 'high' | null — explicit meta, generator params, or Cinematic (= high). */
function lethalityOf(p) {
  const raw = p.meta?.lethality || p.meta?.generated?.params?.lethality;
  if (typeof raw === 'string' && /^(low|medium|high)$/i.test(raw)) return raw.toLowerCase();
  if (p.kind === 'characters') return null;
  if (p.meta?.type === 'Cinematic') return 'high';
  return null;
}

/* Scenario library: bundled + runtime packs for the active universe,
   filterable by type and source, with import/export. */
export default function ScenarioLibrary({ tts }) {
  const { universe } = useUniverse();
  const { packs, byId, loading, error } = useContent();
  const { packId: sessionPackId } = useGame();
  const [selected, setSelected] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [showImport, setShowImport] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const sorted = useMemo(() => [...packs].sort((a, b) => {
    const ta = a.kind === 'characters' ? 99 : TYPE_ORDER.indexOf(a.meta.type ?? 'One-Shot');
    const tb = b.kind === 'characters' ? 99 : TYPE_ORDER.indexOf(b.meta.type ?? 'One-Shot');
    return ta - tb || a.meta.title.localeCompare(b.meta.title);
  }), [packs]);

  const typeOf = (p) => (p.kind === 'characters' ? 'Characters' : p.meta.type || 'Uncategorized');
  const types = [...new Set(sorted.map(typeOf))];
  const sources = [...new Set(sorted.map(p => p.meta.source || 'custom'))];

  if (showWizard) {
    return <GameNightWizard tts={tts} onClose={() => setShowWizard(false)}
      onImport={() => { setShowWizard(false); setShowImport(true); }}
      onOpenPack={(id) => { setShowWizard(false); setSelected(id); setPlaying(false); }} />;
  }

  const pack = selected ? byId[selected] : null;
  if (pack) {
    if (playing) {
      return <ScenarioPlayer pack={pack} tts={tts} onExit={() => setPlaying(false)} />;
    }
    return <ScenarioDetail pack={pack} tts={tts} onBack={() => setSelected(null)} onPlay={() => setPlaying(true)} />;
  }

  const filtered = sorted.filter(p =>
    (typeFilter === 'all' || typeOf(p) === typeFilter) &&
    (sourceFilter === 'all' || (p.meta.source || 'custom') === sourceFilter));

  const groups = [];
  for (const p of filtered) {
    const t = typeOf(p);
    let g = groups.find(x => x.type === t);
    if (!g) { g = { type: t, packs: [] }; groups.push(g); }
    g.packs.push(p);
  }

  const groupTitle = (t) => ({
    Cinematic: 'CINEMATIC SCENARIOS',
    Campaign: 'CAMPAIGN OPERATIONS',
    'One-Shot': 'ONE-SHOTS',
    Characters: 'CHARACTER PACKS',
  }[t] || t.toUpperCase());

  const open = (p) => { play('ui.tap'); setSelected(p.id); setPlaying(false); };

  const renderCard = (p) => {
    const hasRunner = (p.acts || []).some(a => a.scenes?.length);
    const isActive = sessionPackId === p.id;
    const art = cardArt(p);
    const lethal = lethalityOf(p);
    const source = p.meta.source || 'custom';
    const isNew = source === 'generated' || source === 'custom';
    return (
      <div key={p.id} className="scenario-card" role="button" tabIndex={0}
        aria-label={`${p.meta.title}${p.meta.tagline ? ` — ${p.meta.tagline}` : ''}`}
        onClick={() => open(p)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(p); } }}
        style={isActive ? { borderColor: 'var(--success)' } : undefined}>
        <div className="card-art" aria-hidden="true">
          {art ? <img src={art} alt="" loading="lazy" /> : <Motif motif={universe.theme?.motif} seed={p.id} opacity={0.55} width={400} height={110} />}
          <span className="card-badges">
            {isNew && <span className="card-new">{source === 'generated' ? 'NEW · GENERATED' : 'NEW'}</span>}
          </span>
        </div>
        <div className="card-body">
          <div className="card-type">{typeOf(p)}</div>
          <div className="card-title">{p.meta.title}</div>
          {p.meta.tagline && <div className="card-tagline">{p.meta.tagline}</div>}
          <div className="card-chips">
            {p.meta.players && <span className="card-chip"><i>PLAYERS</i>{p.meta.players}</span>}
            {p.meta.playtime && <span className="card-chip"><i>TIME</i>{p.meta.playtime}</span>}
            {p.meta.difficulty && <span className="card-chip"><i>DIFF</i>{p.meta.difficulty}</span>}
            {lethal && <span className={`card-chip lethal-${lethal}`}><i>LETHALITY</i>{lethal}</span>}
            {isActive && <span className="card-chip active">● ACTIVE</span>}
          </div>
          <div className="card-foot">
            {p.maps?.length > 0 && <span>{p.maps.length} MAP{p.maps.length > 1 ? 'S' : ''}</span>}
            {p.characters?.length > 0 && <span>{p.characters.length} CHARACTER{p.characters.length > 1 ? 'S' : ''}</span>}
            {hasRunner && <span className="runner">▶ PLAYTHROUGH</span>}
            <span style={{ marginLeft: 'auto' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <ExportPackButton pack={p} style={{ fontSize: '0.6rem', padding: '0.2rem 0.45rem' }} />
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="panel">
        <h2>SCENARIO LIBRARY — {universe.name}</h2>
        <p style={{ color: 'var(--text-dim)', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
          Select a scenario to view the briefing, act-by-act read-aloud text, GM notes and handouts.
          Use Read Aloud to have {universe.terminal.name} narrate to your players, or PLAY SCENARIO for the scene-by-scene runner.
        </p>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => setShowWizard(true)} style={{
            padding: '0.4rem 0.8rem', background: 'var(--accent-glow)', border: '1px solid var(--accent)',
            color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.08em', cursor: 'pointer',
          }}>
            ✦ GAME NIGHT — GENERATE SCENARIO
          </button>
          <button onClick={() => setShowImport(!showImport)} style={{
            padding: '0.4rem 0.8rem', background: 'var(--accent-glow)', border: '1px solid var(--accent)',
            color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.08em', cursor: 'pointer',
          }}>
            {showImport ? '× CLOSE IMPORT' : '+ IMPORT PACK'}
          </button>
          {sessionPackId && byId[sessionPackId] && (
            <button onClick={() => { setSelected(sessionPackId); setPlaying(true); }} style={{
              padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid var(--success)',
              color: 'var(--success)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.08em', cursor: 'pointer',
            }}>
              ▶ RUN ACTIVE SCENARIO: {byId[sessionPackId].meta.title.toUpperCase()}
            </button>
          )}
          {loading && <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>SYNCING RUNTIME PACKS…</span>}
          {error && <span style={{ color: 'var(--warn)', fontSize: '0.7rem' }}>RUNTIME PACKS UNAVAILABLE ({error}) — SHOWING BUNDLED ONLY</span>}
        </div>
      </div>

      {showImport && <PackImportExport onDone={(id) => { setShowImport(false); if (id) setSelected(id); }} />}

      <div className="filter-bar" style={{ marginBottom: '0.4rem' }}>
        <button className={typeFilter === 'all' ? 'active' : ''} onClick={() => setTypeFilter('all')}>ALL TYPES ({packs.length})</button>
        {types.map(t => (
          <button key={t} className={typeFilter === t ? 'active' : ''} onClick={() => setTypeFilter(t)}>
            {t.toUpperCase()} ({sorted.filter(p => typeOf(p) === t).length})
          </button>
        ))}
      </div>
      {sources.length > 1 && (
        <div className="filter-bar" style={{ marginBottom: '1rem' }}>
          <button className={sourceFilter === 'all' ? 'active' : ''} onClick={() => setSourceFilter('all')}>ALL SOURCES</button>
          {sources.map(s => (
            <button key={s} className={sourceFilter === s ? 'active' : ''} onClick={() => setSourceFilter(s)}>
              {s.toUpperCase()} ({sorted.filter(p => (p.meta.source || 'custom') === s).length})
            </button>
          ))}
        </div>
      )}

      {groups.length === 0 && (
        <div className="panel" style={{ color: 'var(--text-dim)', textAlign: 'center' }}>
          No packs match these filters. Import a pack to get started.
        </div>
      )}

      {groups.map((g, i) => (
        <React.Fragment key={g.type}>
          <div className="panel" style={{ marginTop: i ? '2rem' : 0 }}>
            <h2>{groupTitle(g.type)}</h2>
          </div>
          <div className="scenario-grid">
            {g.packs.map(renderCard)}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
