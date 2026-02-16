import React, { useState } from 'react';
import { characters, skillNames, skillAttributes } from '../data/characters';

const scenarioNames = [...new Set(characters.map(c => c.scenario))];

function CharacterSheet({ character, onBack }) {
  return (
    <div className="character-sheet">
      <button className="back-btn" onClick={onBack}>← BACK TO CHARACTERS</button>

      <div className="panel">
        <div className="char-header-section">
          <div>
            <div className="char-name-display">{character.name}</div>
            <div className="char-career-display">{character.career}</div>
            <div className="char-scenario-display">{character.scenario}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>HEALTH</div>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.5rem', color: 'var(--success)' }}>{character.health}</div>
          </div>
        </div>

        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '1rem', fontStyle: 'italic' }}>
          {character.appearance}
        </p>
      </div>

      <div className="panel">
        <h2>ATTRIBUTES</h2>
        <div className="attributes-grid">
          <div className="attr-box">
            <div className="attr-label">Strength</div>
            <div className="attr-value">{character.attributes.str}</div>
          </div>
          <div className="attr-box">
            <div className="attr-label">Agility</div>
            <div className="attr-value">{character.attributes.agi}</div>
          </div>
          <div className="attr-box">
            <div className="attr-label">Wits</div>
            <div className="attr-value">{character.attributes.wit}</div>
          </div>
          <div className="attr-box">
            <div className="attr-label">Empathy</div>
            <div className="attr-value">{character.attributes.emp}</div>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>SKILLS</h2>
        <div className="skills-grid">
          {Object.entries(character.skills).map(([key, value]) => (
            <div key={key} className="skill-row">
              <span className="skill-name">{skillNames[key]}</span>
              <span className="skill-attr">{skillAttributes[key]}</span>
              <span className="skill-value">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>TALENT</h2>
        <p style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>{character.talent}</p>
      </div>

      <div className="panel">
        <h2>GEAR</h2>
        <ul className="gear-list">
          {character.gear.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        {character.signatureItem && (
          <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--bg-dark)', borderRadius: '4px', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--accent)', fontSize: '0.7rem', letterSpacing: '0.1em' }}>SIGNATURE ITEM: </span>
            {character.signatureItem}
          </div>
        )}
      </div>

      <div className="agenda-box">
        {character.personalAgenda}
      </div>

      <div className="panel" style={{ marginTop: '1rem' }}>
        <h2>RELATIONSHIPS</h2>
        <div style={{ display: 'flex', gap: '2rem', fontSize: '0.85rem' }}>
          <div>
            <span style={{ color: 'var(--success)', fontSize: '0.7rem', letterSpacing: '0.1em' }}>BUDDY: </span>
            {character.buddy}
          </div>
          <div>
            <span style={{ color: 'var(--danger)', fontSize: '0.7rem', letterSpacing: '0.1em' }}>RIVAL: </span>
            {character.rival}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Characters() {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');

  if (selected) {
    const character = characters.find(c => c.id === selected);
    return <CharacterSheet character={character} onBack={() => setSelected(null)} />;
  }

  const filtered = filter === 'all' ? characters : characters.filter(c => c.scenario === filter);

  return (
    <div>
      <div className="panel">
        <h2>PRE-BUILT CHARACTERS</h2>
        <p style={{ color: 'var(--text-dim)', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Select a character to view their full sheet with attributes, skills, gear, and personal agenda.
        </p>
      </div>

      <div className="filter-bar">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>ALL</button>
        {scenarioNames.map(name => (
          <button key={name} className={filter === name ? 'active' : ''} onClick={() => setFilter(name)}>
            {name.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="character-grid">
        {filtered.map(c => (
          <div key={c.id} className="character-card" onClick={() => setSelected(c.id)}>
            <div className="char-career">{c.career}</div>
            <div className="char-name">{c.name}</div>
            <div className="char-scenario">{c.scenario}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
