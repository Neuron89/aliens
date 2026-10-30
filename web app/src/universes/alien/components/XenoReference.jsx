import React, { useState } from 'react';
import { bestiary as xenomorphs } from '../reference/bestiary';



function XenoCard({ xeno }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="panel" style={{ cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--accent)', letterSpacing: '0.08em', marginBottom: '0.15rem' }}>{xeno.name}</h3>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
            {xeno.stage} — {xeno.source}
          </div>
        </div>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      <div className="creature-stats" style={{ marginTop: '0.5rem' }}>
        <span>SPEED {xeno.stats.speed}</span>
        <span>HEALTH {xeno.stats.health}</span>
        <span>ARMOR {xeno.stats.armor}</span>
        {xeno.stats.acid && <span>ACID {xeno.stats.acid}</span>}
        {xeno.stats.mobility && <span>MOB {xeno.stats.mobility}</span>}
        {xeno.stats.observation && <span>OBS {xeno.stats.observation}</span>}
      </div>

      {expanded && (
        <div style={{ marginTop: '0.75rem' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: '1.5', marginBottom: '0.5rem' }}>
            {xeno.description}
          </p>
          {xeno.signature && (
            <div style={{ marginBottom: '0.5rem' }}>
              <strong style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>SIGNATURE ATTACK: </strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{xeno.signature}</span>
            </div>
          )}
          {xeno.special && (
            <div style={{ marginBottom: '0.75rem' }}>
              <strong style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>SPECIAL: </strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{xeno.special}</span>
            </div>
          )}
          {xeno.art && (
            <div style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden', background: 'var(--bg-input)' }}>
              <img
                src={xeno.art}
                alt={xeno.name}
                style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); window.open(xeno.art, '_blank'); }}
                title="Click to open full size"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Xenomorphs() {
  const [filter, setFilter] = useState('all');

  const sources = ['all', 'XX121', 'Neomorph', 'Other', 'ACM Aberrant'];
  const filtered = filter === 'all' ? xenomorphs : xenomorphs.filter(x => x.source === filter);

  return (
    <div>
      <div className="panel">
        <h2>ALIEN SPECIES DATABASE</h2>
        <p style={{ color: 'var(--text-dim)', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
          Complete xenomorph and alien species reference. Click any entry to expand details, stats, and view artwork.
        </p>
      </div>

      <div className="filter-bar" style={{ marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        {sources.map(s => (
          <button key={s} className={filter === s ? 'active' : ''} onClick={() => setFilter(s)}>
            {s === 'all' ? `ALL (${xenomorphs.length})` : s.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '0.8rem', color: 'var(--accent)', marginBottom: '0.5rem' }}>XENOMORPH CRITICAL (D6) AT 0 HEALTH</h3>
        <table className="cheat">
          <tbody>
            <tr><th>1</th><td>Rise Again — ruse; if attacked or next initiative: +1 Health, attack.</td></tr>
            <tr><th>2</th><td>Wounded — Speed −1 (min 1), +1 Health. Each Round D6 1–3: try to escape.</td></tr>
            <tr><th>3</th><td>Desperate — instant fast+slow. D6 1–3 escape; 4–6 attack. No damage = die.</td></tr>
            <tr><th>4</th><td>Last Breath — next initiative: kill nearest, then die.</td></tr>
            <tr><th>5–6</th><td>Torn apart. Instant death.</td></tr>
          </tbody>
        </table>
      </div>

      {filtered.map((xeno, i) => <XenoCard key={i} xeno={xeno} />)}
    </div>
  );
}
