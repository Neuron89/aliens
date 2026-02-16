import React, { useState } from 'react';
import { vehicles } from '../data/vehicles';

const TYPES = ['All', 'Ground Vehicle', 'Aerial Vehicle', 'Aerial Vehicle / Spacecraft', 'Aerospace Fighter', 'Spacecraft'];

function VehicleCard({ v }) {
  const [expanded, setExpanded] = useState(false);
  const artList = Array.isArray(v.art) ? v.art : v.art ? [v.art] : [];

  return (
    <div className="panel" style={{ cursor: 'pointer', transition: 'border-color 0.2s' }} onClick={() => setExpanded(!expanded)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--accent)', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>{v.name}</h3>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
            <span>{v.type}</span>
            <span>{v.source}</span>
          </div>
        </div>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      <div className="creature-stats" style={{ marginTop: '0.5rem' }}>
        <span>PAX: {v.stats.passengers}</span>
        <span>SPEED: {v.stats.speed}</span>
        <span>MANEUVER: {v.stats.maneuverability}</span>
        <span>ARMOR: {v.stats.armor}</span>
        <span>HULL: {v.stats.hull}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: '0.75rem' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: '1.5', marginBottom: '0.75rem' }}>
            {v.description}
          </p>
          {artList.map((src, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden', background: '#080c10', marginBottom: i < artList.length - 1 ? '0.5rem' : 0 }}>
              <img
                src={src}
                alt={`${v.name} — page ${i + 1}`}
                style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); window.open(src, '_blank'); }}
                title="Click to open full size"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Vehicles() {
  const [typeFilter, setTypeFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('all');

  let filtered = vehicles;
  if (typeFilter !== 'All') filtered = filtered.filter(v => v.type === typeFilter);
  if (sourceFilter !== 'all') filtered = filtered.filter(v => v.source === sourceFilter);

  return (
    <div>
      <div className="panel">
        <h2>VEHICLE DATABASE</h2>
        <p style={{ color: 'var(--text-dim)', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Ground vehicles, aircraft, and spacecraft from the Core Rule Book and Colonial Marines Operations Manual.
          Click any vehicle to expand details and view artwork.
        </p>
      </div>

      <div className="filter-bar" style={{ marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        {TYPES.map(t => (
          <button key={t} className={typeFilter === t ? 'active' : ''} onClick={() => setTypeFilter(t)}>
            {t === 'All' ? `ALL (${vehicles.length})` : t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="filter-bar" style={{ marginBottom: '1rem' }}>
        <button className={sourceFilter === 'all' ? 'active' : ''} onClick={() => setSourceFilter('all')}>ALL SOURCES</button>
        <button className={sourceFilter === 'CRB' ? 'active' : ''} onClick={() => setSourceFilter('CRB')}>CORE RULEBOOK</button>
        <button className={sourceFilter === 'ACM' ? 'active' : ''} onClick={() => setSourceFilter('ACM')}>COLONIAL MARINES</button>
      </div>

      {filtered.length === 0 ? (
        <div className="panel"><p style={{ color: 'var(--text-dim)' }}>No vehicles match the current filters.</p></div>
      ) : (
        filtered.map(v => <VehicleCard key={v.id} v={v} />)
      )}
    </div>
  );
}
