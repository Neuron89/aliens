import React, { useState } from 'react';
import { weapons } from '../data/weapons';

const CATEGORIES = [
  { id: 'pistols', label: 'PISTOLS' },
  { id: 'rifles', label: 'RIFLES' },
  { id: 'heavyWeapons', label: 'HEAVY WEAPONS' },
  { id: 'closeCombat', label: 'CLOSE COMBAT' },
  { id: 'explosives', label: 'EXPLOSIVES' },
  { id: 'armor', label: 'SUITS & ARMOR' },
];

function WeaponCard({ item, isArmor }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="panel" style={{ cursor: 'pointer', transition: 'border-color 0.2s' }} onClick={() => setExpanded(!expanded)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--accent)', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>{item.name}</h3>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>{item.source}</span>
        </div>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      <div className="creature-stats" style={{ marginTop: '0.5rem' }}>
        {isArmor ? (
          <>
            <span>ARMOR: {item.rating}</span>
            <span>AIR: {item.airSupply}</span>
            <span>WEIGHT: {item.weight}</span>
            <span>COST: {item.cost}</span>
          </>
        ) : (
          <>
            <span>BONUS: {item.bonus}</span>
            <span>DMG: {item.damage}</span>
            <span>RANGE: {item.range}</span>
            <span>WT: {item.weight}</span>
            <span>COST: {item.cost}</span>
          </>
        )}
      </div>

      {item.comment && (
        <div style={{ fontSize: '0.7rem', color: 'var(--accent)', marginTop: '0.3rem', opacity: 0.8 }}>
          {item.comment}
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: '0.75rem' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: '1.5', marginBottom: '0.75rem' }}>
            {item.description}
          </p>
          {item.art && (
            <div style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden', background: '#080c10' }}>
              <img
                src={item.art}
                alt={item.name}
                style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); window.open(item.art, '_blank'); }}
                title="Click to open full size"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Weapons() {
  const [activeCategory, setActiveCategory] = useState('pistols');
  const [sourceFilter, setSourceFilter] = useState('all');

  const items = weapons[activeCategory] || [];
  const filtered = sourceFilter === 'all' ? items : items.filter(i => i.source === sourceFilter);

  return (
    <div>
      <div className="panel">
        <h2>WEAPONS & ARMOR DATABASE</h2>
        <p style={{ color: 'var(--text-dim)', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Complete weapons reference from the Core Rule Book and Colonial Marines Operations Manual.
          Click any weapon to expand details and view artwork.
        </p>
      </div>

      <div className="filter-bar" style={{ marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        {CATEGORIES.map(c => (
          <button key={c.id} className={activeCategory === c.id ? 'active' : ''} onClick={() => setActiveCategory(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="filter-bar" style={{ marginBottom: '1rem' }}>
        <button className={sourceFilter === 'all' ? 'active' : ''} onClick={() => setSourceFilter('all')}>ALL</button>
        <button className={sourceFilter === 'CRB' ? 'active' : ''} onClick={() => setSourceFilter('CRB')}>CORE RULEBOOK</button>
        <button className={sourceFilter === 'ACM' ? 'active' : ''} onClick={() => setSourceFilter('ACM')}>COLONIAL MARINES</button>
      </div>

      {filtered.length === 0 ? (
        <div className="panel"><p style={{ color: 'var(--text-dim)' }}>No items in this category for the selected source.</p></div>
      ) : (
        filtered.map((item, i) => (
          <WeaponCard key={i} item={item} isArmor={activeCategory === 'armor'} />
        ))
      )}
    </div>
  );
}
