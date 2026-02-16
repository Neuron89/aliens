import React, { useState } from 'react';
import { maps } from '../data/maps';
import MapRenderer from './MapRenderer';

const CRONUS_DECKS = [
  { label: 'Deck A', file: '/Deck A.jpg' },
  { label: 'Deck B', file: '/Deck B.jpg' },
  { label: 'Deck C', file: '/Deck C.jpg' },
  { label: 'Deck D', file: '/Deck D.jpg' },
];

function MapViewer({ map, onBack }) {
  const [activeDeck, setActiveDeck] = useState(0);
  const [viewMode, setViewMode] = useState('svg');
  const isCronus = map.id === 'uscss-cronus';
  const isMontero = map.id === 'uscss-montero';
  const hasSvgMap = isMontero;
  const hasImage = !!map.image;

  return (
    <div className="map-viewer">
      <button className="back-btn" onClick={onBack}>← BACK TO MAPS</button>

      <div className="panel">
        <h2>{map.title}</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>{map.subtitle}</p>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{map.description}</p>
        {map.scenario && (
          <p style={{ color: 'var(--accent)', fontSize: '0.75rem', marginTop: '0.5rem', letterSpacing: '0.08em', opacity: 0.8 }}>
            SCENARIO: {map.scenario.toUpperCase()}
          </p>
        )}
      </div>

      {/* View mode toggle for maps that have both SVG and ASCII */}
      {hasSvgMap && (
        <div className="filter-bar" style={{ marginBottom: '0.75rem' }}>
          <button className={viewMode === 'svg' ? 'active' : ''} onClick={() => setViewMode('svg')}>DECK PLAN</button>
          <button className={viewMode === 'ascii' ? 'active' : ''} onClick={() => setViewMode('ascii')}>ASCII SCHEMATIC</button>
        </div>
      )}

      {/* SVG Deck Plan (Montero) */}
      {hasSvgMap && viewMode === 'svg' && (
        <div className="panel" style={{ padding: '0.5rem', background: 'transparent', border: 'none' }}>
          <MapRenderer />
        </div>
      )}

      {/* Image-based map (ACM maps and others) */}
      {hasImage && (
        <div className="panel">
          <div style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden', background: '#080c10' }}>
            <img
              src={map.image}
              alt={map.title}
              style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer' }}
              onClick={() => window.open(map.image, '_blank')}
              title="Click to open full size"
            />
          </div>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.7rem', marginTop: '0.5rem', textAlign: 'center', opacity: 0.6 }}>
            Click image to open full size
          </p>
        </div>
      )}

      {/* Cronus deck images */}
      {isCronus && (
        <div className="panel">
          <h2>DECK IMAGES — USCSS CRONUS</h2>
          <div className="map-image-tabs">
            {CRONUS_DECKS.map((deck, i) => (
              <button key={i} className={activeDeck === i ? 'active' : ''} onClick={() => setActiveDeck(i)}>
                {deck.label}
              </button>
            ))}
          </div>
          <div className="map-image-container">
            <img
              src={CRONUS_DECKS[activeDeck].file}
              alt={CRONUS_DECKS[activeDeck].label}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}

      {/* ASCII Schematic (only for maps that have ASCII art) */}
      {map.ascii && (!hasSvgMap || viewMode === 'ascii') && (
        <div className="panel">
          <h2>SCHEMATIC</h2>
          <div className="map-ascii-container">
            <pre className="map-ascii">{map.ascii}</pre>
          </div>
        </div>
      )}

      <div className="panel">
        <h2>LOCATIONS</h2>
        <div className="room-list">
          {map.rooms.map((room, i) => (
            <div key={i} className="room-item">
              <div className="room-name">{room.name}</div>
              <div className="room-desc">{room.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Maps() {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');

  if (selected) {
    const map = maps.find(m => m.id === selected);
    return <MapViewer map={map} onBack={() => setSelected(null)} />;
  }

  const cinematicMaps = maps.filter(m =>
    ['Chariot of the Gods', "Hope's Last Day", 'Destroyer of Worlds', 'Heart of Darkness', 'Custom'].includes(m.scenario)
  );
  const campaignMaps = maps.filter(m =>
    !['Chariot of the Gods', "Hope's Last Day", 'Destroyer of Worlds', 'Heart of Darkness', 'Custom'].includes(m.scenario)
  );

  const filteredMaps = filter === 'cinematic' ? cinematicMaps
    : filter === 'campaign' ? campaignMaps
    : maps;

  return (
    <div>
      <div className="panel">
        <h2>TACTICAL MAPS</h2>
        <p style={{ color: 'var(--text-dim)', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Select a location to view schematics, deck plans, and room descriptions.
          All maps from cinematic scenarios and Colonial Marines operations are available here.
        </p>
      </div>

      <div className="filter-bar" style={{ marginBottom: '1rem' }}>
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          ALL ({maps.length})
        </button>
        <button className={filter === 'cinematic' ? 'active' : ''} onClick={() => setFilter('cinematic')}>
          CINEMATIC ({cinematicMaps.length})
        </button>
        <button className={filter === 'campaign' ? 'active' : ''} onClick={() => setFilter('campaign')}>
          CAMPAIGN ({campaignMaps.length})
        </button>
      </div>

      {filter === 'all' && (
        <>
          <div className="panel" style={{ padding: '0.5rem 0.75rem', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '0.8rem', color: 'var(--accent)', letterSpacing: '0.1em' }}>CINEMATIC SCENARIOS</h3>
          </div>
          <div className="map-grid">
            {cinematicMaps.map(m => (
              <div key={m.id} className="map-card" onClick={() => setSelected(m.id)}>
                <div className="map-subtitle">{m.scenario}</div>
                <div className="map-title">{m.title}</div>
                <div className="map-desc">{m.description}</div>
                {m.image && <div style={{ fontSize: '0.65rem', color: 'var(--accent)', marginTop: '0.4rem', opacity: 0.7 }}>TACTICAL MAP</div>}
              </div>
            ))}
          </div>

          <div className="panel" style={{ padding: '0.5rem 0.75rem', marginBottom: '0.5rem', marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '0.8rem', color: 'var(--accent)', letterSpacing: '0.1em' }}>COLONIAL MARINES — CAMPAIGN OPERATIONS</h3>
          </div>
          <div className="map-grid">
            {campaignMaps.map(m => (
              <div key={m.id} className="map-card" onClick={() => setSelected(m.id)}>
                <div className="map-subtitle">{m.scenario}</div>
                <div className="map-title">{m.title}</div>
                <div className="map-desc">{m.description}</div>
                {m.image && <div style={{ fontSize: '0.65rem', color: 'var(--accent)', marginTop: '0.4rem', opacity: 0.7 }}>TACTICAL MAP</div>}
              </div>
            ))}
          </div>
        </>
      )}

      {filter !== 'all' && (
        <div className="map-grid">
          {filteredMaps.map(m => (
            <div key={m.id} className="map-card" onClick={() => setSelected(m.id)}>
              <div className="map-subtitle">{m.scenario}</div>
              <div className="map-title">{m.title}</div>
              <div className="map-desc">{m.description}</div>
              {m.image && <div style={{ fontSize: '0.65rem', color: 'var(--accent)', marginTop: '0.4rem', opacity: 0.7 }}>TACTICAL MAP</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
