import React, { useState, useMemo } from 'react';
import { useUniverse } from '../UniverseContext';
import { useContent } from '../ContentContext';
import { useGame } from '../GameContext';
import ScenarioDetail from './ScenarioDetail';
import ScenarioPlayer from './ScenarioPlayer';
import PackImportExport, { ExportPackButton } from './PackImportExport';
import GameNightWizard from './GameNightWizard';

const TYPE_ORDER = ['Cinematic', 'One-Shot', 'Campaign'];

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

  const renderCard = (p) => {
    const hasRunner = (p.acts || []).some(a => a.scenes?.length);
    const isActive = sessionPackId === p.id;
    return (
      <div key={p.id} className="scenario-card" onClick={() => { setSelected(p.id); setPlaying(false); }}
        style={isActive ? { borderColor: 'var(--success)' } : undefined}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div className="card-type">{typeOf(p)}</div>
          <span style={{
            fontSize: '0.55rem', letterSpacing: '0.1em', padding: '0.05rem 0.35rem',
            border: `1px solid ${p.meta.source === 'bundled' ? 'var(--border)' : 'var(--warn)'}`,
            color: p.meta.source === 'bundled' ? 'var(--text-dim)' : 'var(--warn)',
            alignSelf: 'flex-start',
          }}>
            {(p.meta.source || 'custom').toUpperCase()}
          </span>
        </div>
        <div className="card-title">{p.meta.title}</div>
        <div className="card-tagline">{p.meta.tagline}</div>
        <div className="card-meta">
          {p.meta.players && <span>{p.meta.players} Players</span>}
          {p.meta.playtime && <span>{p.meta.playtime}</span>}
          {p.meta.difficulty && <span>{p.meta.difficulty}</span>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {p.maps?.length > 0 && (
            <span style={{ fontSize: '0.65rem', color: 'var(--accent)', opacity: 0.7 }}>
              {p.maps.length} MAP{p.maps.length > 1 ? 'S' : ''}
            </span>
          )}
          {p.characters?.length > 0 && (
            <span style={{ fontSize: '0.65rem', color: 'var(--accent)', opacity: 0.7 }}>
              {p.characters.length} CHARACTER{p.characters.length > 1 ? 'S' : ''}
            </span>
          )}
          {hasRunner && (
            <span style={{
              fontSize: '0.6rem', color: 'var(--accent)', letterSpacing: '0.08em',
              border: '1px solid var(--accent)', padding: '0.1rem 0.4rem', opacity: 0.9,
            }}>
              ▶ PLAYTHROUGH
            </span>
          )}
          {isActive && <span style={{ fontSize: '0.6rem', color: 'var(--success)', letterSpacing: '0.08em' }}>● ACTIVE</span>}
          <span style={{ marginLeft: 'auto' }}>
            <ExportPackButton pack={p} style={{ fontSize: '0.55rem', padding: '0.15rem 0.4rem' }} />
          </span>
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
