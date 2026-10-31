import React, { useState, useMemo } from 'react';
import { useUniverse } from '../UniverseContext';
import { useContent } from '../ContentContext';
import MapRenderer, { resolveEngine } from './MapRenderer';
import { groupMaps, planNoun } from './mapGroups';

export { groupMaps, planNoun };

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
    Engine && ['engine', planNoun(universe)],
    (map.src || map.image) && ['image', 'IMAGE'],
    !Engine && map.ascii && ['vector', planNoun(universe)],
  ].filter(Boolean);
  const [view, setView] = useState(views[0]?.[0] || (map.ascii ? 'ascii' : undefined));
  const [showAscii, setShowAscii] = useState(false);

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

      {(views.length > 1 || map.ascii) && (
        <div className="filter-bar" style={{ marginBottom: '0.75rem' }}>
          {views.length > 1 && views.map(([id, label]) => (
            <button key={id} className={view === id && !showAscii ? 'active' : ''} aria-pressed={view === id && !showAscii} onClick={() => { setView(id); setShowAscii(false); }}>{label}</button>
          ))}
          {map.ascii && (
            <button className={showAscii ? 'active' : ''} aria-pressed={showAscii} onClick={() => setShowAscii((v) => !v)}
              title="The original ASCII schematic from the scenario pack" style={{ marginLeft: views.length > 1 ? 'auto' : undefined }}>
              {showAscii ? 'HIDE ASCII' : 'SHOW ASCII'}
            </button>
          )}
        </div>
      )}

      {showAscii && map.ascii ? <MapRenderer universe={universe} map={map} view="ascii" /> : view && <MapRenderer universe={universe} map={map} view={view} />}

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

function MapCard({ m, onClick, plan, child = false }) {
  const kind = m.engine ? `INTERACTIVE ${plan}`
    : (m.src || m.image) ? (child ? 'IMAGE' : 'TACTICAL MAP')
      : m.ascii ? `VECTOR ${plan} · BOARD READY` : null;
  return (
    <div className={`map-card${child ? ' map-card-child' : ''}`} onClick={onClick} role="button" tabIndex={0} aria-label={m.title}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}>
      {m.subtitle && !child && <div className="map-subtitle">{m.subtitle}</div>}
      <div className="map-title">{m.title}</div>
      {m.description && <div className="map-desc">{m.description}</div>}
      {kind && <div className={`map-kind${m.engine ? ' live' : ''}`}>{kind}</div>}
    </div>
  );
}

export default function Maps() {
  const maps = useAllMaps();
  const { universe } = useUniverse();
  const plan = planNoun(universe);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState({}); // parent map id → its image maps expanded

  const selectedMap = selected ? maps.find(m => m.id === selected) : null;
  if (selectedMap) return <MapViewer map={selectedMap} onBack={() => setSelected(null)} />;

  const types = [...new Set(maps.map(m => m.groupType))];
  const filtered = filter === 'all' ? maps : maps.filter(m => m.groupType === filter);
  const groups = groupMaps(filtered);

  return (
    <div>
      <div className="page-head">
        <h2>MAPS</h2>
        <p>
          Select a location to view its {plan.toLowerCase()} and room descriptions.
          Maps come from every scenario pack for this universe, plus general-purpose layouts. To put one on the table TV, use BOARD.
        </p>
      </div>

      <div className="filter-bar" style={{ marginBottom: '1rem' }}>
        <button className={filter === 'all' ? 'active' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          ALL ({maps.length})
        </button>
        {types.map(t => (
          <button key={t} className={filter === t ? 'active' : ''} aria-pressed={filter === t} onClick={() => setFilter(t)}>
            {t.toUpperCase()} ({maps.filter(m => m.groupType === t).length})
          </button>
        ))}
      </div>

      {groups.map(g => (
        <React.Fragment key={g.name}>
          <div className="sec-head">
            <h3>{g.name.toUpperCase()}</h3><span>{g.maps.length}</span>
          </div>
          <div className="map-grid">
            {g.items.map(({ map: m, children }) => (
              <React.Fragment key={m.id}>
                <div className="map-slot">
                  <MapCard m={m} plan={plan} onClick={() => setSelected(m.id)} />
                  {children.length > 0 && (
                    <button type="button" className="map-kids-toggle" aria-expanded={!!open[m.id]} aria-controls={`map-kids-${m.id}`}
                      onClick={() => setOpen((o) => ({ ...o, [m.id]: !o[m.id] }))}>
                      {open[m.id] ? '▾' : '▸'} {children.length} {children.length === 1 ? 'IMAGE' : 'IMAGES'} OF {m.title}
                    </button>
                  )}
                </div>
                {children.length > 0 && open[m.id] && (
                  <div className="map-kids" id={`map-kids-${m.id}`} role="group" aria-label={`Images of ${m.title}`}>
                    {children.map((c) => <MapCard key={c.id} m={c} plan={plan} child onClick={() => setSelected(c.id)} />)}
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
