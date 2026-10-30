import React, { useState, useMemo } from 'react';
import { useUniverse } from '../UniverseContext';
import { useContent } from '../ContentContext';
import MapRenderer, { resolveEngine } from './MapRenderer';

/* Collect maps: every pack's maps (grouped by pack) + universe-level maps
   not already provided by a pack. A pack map with the same id as a universe
   map inherits the universe map's interactive engine. */
export function useAllMaps() {
  const { universe } = useUniverse();
  const { packs } = useContent();
  return useMemo(() => {
    const universeMaps = universe.maps || [];
    const out = [];
    const seen = new Set();
    for (const p of packs) {
      for (const m of p.maps || []) {
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        const base = universeMaps.find(u => u.id === m.id);
        out.push({
          ...m,
          engine: m.engine || (base?.engine ? base.id : undefined),
          group: p.meta?.title || p.id,
          groupType: p.meta?.type || 'Other',
        });
      }
    }
    for (const m of universeMaps) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push({ ...m, group: m.scenario || 'General', groupType: 'Other' });
    }
    return out;
  }, [universe, packs]);
}

export function MapViewer({ map, onBack, backLabel = '← BACK TO MAPS' }) {
  const { universe } = useUniverse();
  const Engine = resolveEngine(universe, map);
  const views = [
    Engine && ['engine', 'DECK PLAN'],
    (map.src || map.image) && ['image', 'IMAGE'],
    map.ascii && ['ascii', 'ASCII SCHEMATIC'],
  ].filter(Boolean);
  const [view, setView] = useState(views[0]?.[0]);

  return (
    <div className="map-viewer">
      {onBack && <button className="back-btn" onClick={onBack}>{backLabel}</button>}

      <div className="panel">
        <h2>{map.title}</h2>
        {map.subtitle && <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>{map.subtitle}</p>}
        {map.description && <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{map.description}</p>}
        {map.group && (
          <p style={{ color: 'var(--accent)', fontSize: '0.75rem', marginTop: '0.5rem', letterSpacing: '0.08em', opacity: 0.8 }}>
            SCENARIO: {map.group.toUpperCase()}
          </p>
        )}
      </div>

      {views.length > 1 && (
        <div className="filter-bar" style={{ marginBottom: '0.75rem' }}>
          {views.map(([id, label]) => (
            <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>{label}</button>
          ))}
        </div>
      )}

      {view && <MapRenderer universe={universe} map={map} view={view} />}

      {map.rooms?.length > 0 && (
        <div className="panel">
          <h2>LOCATIONS</h2>
          <div className="room-list">
            {map.rooms.map((room, i) => (
              <div key={i} className="room-item">
                <div className="room-name">{room.name}</div>
                <div className="room-desc">{room.note || room.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MapCard({ m, onClick }) {
  return (
    <div className="map-card" onClick={onClick}>
      <div className="map-subtitle">{m.group}</div>
      <div className="map-title">{m.title}</div>
      <div className="map-desc">{m.description}</div>
      {(m.src || m.image) && <div style={{ fontSize: '0.65rem', color: 'var(--accent)', marginTop: '0.4rem', opacity: 0.7 }}>TACTICAL MAP</div>}
      {m.engine && <div style={{ fontSize: '0.65rem', color: 'var(--accent)', marginTop: '0.4rem', opacity: 0.7 }}>INTERACTIVE DECK PLAN</div>}
    </div>
  );
}

export default function Maps() {
  const maps = useAllMaps();
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');

  const selectedMap = selected ? maps.find(m => m.id === selected) : null;
  if (selectedMap) return <MapViewer map={selectedMap} onBack={() => setSelected(null)} />;

  const types = [...new Set(maps.map(m => m.groupType))];
  const filtered = filter === 'all' ? maps : maps.filter(m => m.groupType === filter);
  const groups = [];
  for (const m of filtered) {
    let g = groups.find(x => x.name === m.group);
    if (!g) { g = { name: m.group, maps: [] }; groups.push(g); }
    g.maps.push(m);
  }

  return (
    <div>
      <div className="panel">
        <h2>TACTICAL MAPS</h2>
        <p style={{ color: 'var(--text-dim)', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Select a location to view schematics, deck plans, and room descriptions.
          Maps come from every scenario pack for this universe, plus general-purpose layouts.
        </p>
      </div>

      <div className="filter-bar" style={{ marginBottom: '1rem' }}>
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          ALL ({maps.length})
        </button>
        {types.map(t => (
          <button key={t} className={filter === t ? 'active' : ''} onClick={() => setFilter(t)}>
            {t.toUpperCase()} ({maps.filter(m => m.groupType === t).length})
          </button>
        ))}
      </div>

      {groups.map(g => (
        <React.Fragment key={g.name}>
          <div className="panel" style={{ padding: '0.5rem 0.75rem', marginBottom: '0.5rem', marginTop: '1rem' }}>
            <h3 style={{ fontSize: '0.8rem', color: 'var(--accent)', letterSpacing: '0.1em' }}>{g.name.toUpperCase()}</h3>
          </div>
          <div className="map-grid">
            {g.maps.map(m => <MapCard key={m.id} m={m} onClick={() => setSelected(m.id)} />)}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
