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

  return (
    <div className="map-viewer">
      <button className="back-btn" onClick={onBack}>← BACK TO MAPS</button>

      <div className="panel">
        <h2>{map.title}</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>{map.subtitle}</p>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{map.description}</p>
      </div>

      {/* View mode toggle for maps that have both SVG and ASCII */}
      {hasSvgMap && (
        <div className="filter-bar" style={{ marginBottom: '0.75rem' }}>
          <button className={viewMode === 'svg' ? 'active' : ''} onClick={() => setViewMode('svg')}>DECK PLAN</button>
          <button className={viewMode === 'ascii' ? 'active' : ''} onClick={() => setViewMode('ascii')}>ASCII SCHEMATIC</button>
        </div>
      )}

      {/* SVG Deck Plan (Montero test) */}
      {hasSvgMap && viewMode === 'svg' && (
        <div className="panel" style={{ padding: '0.5rem', background: 'transparent', border: 'none' }}>
          <MapRenderer />
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

      {/* ASCII Schematic */}
      {(!hasSvgMap || viewMode === 'ascii') && (
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

  if (selected) {
    const map = maps.find(m => m.id === selected);
    return <MapViewer map={map} onBack={() => setSelected(null)} />;
  }

  return (
    <div>
      <div className="panel">
        <h2>TACTICAL MAPS</h2>
        <p style={{ color: 'var(--text-dim)', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Select a location to view schematics, deck plans, and room descriptions.
        </p>
      </div>
      <div className="map-grid">
        {maps.map(m => (
          <div key={m.id} className="map-card" onClick={() => setSelected(m.id)}>
            <div className="map-subtitle">{m.scenario}</div>
            <div className="map-title">{m.title}</div>
            <div className="map-desc">{m.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
