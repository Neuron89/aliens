import React, { useState } from 'react';
import { characters, skillNames, skillAttributes } from '../data/characters';

const scenarioNames = [...new Set(characters.map(c => c.scenario))];

const CAREERS = [
  { name: 'Colonial Marine', keyAttribute: 'str', keySkills: ['closeCombat', 'rangedCombat', 'stamina', 'mobility'],
    talents: ['Overkill — Spend extra successes for +2 damage (instead of +1).', 'Banter — After a successful COMMAND roll, reduce Stress by 1 for a nearby ally.', 'Nerves of Steel — Reduce Stress by 2 when using Signature Item.'] },
  { name: 'Colonial Marshal', keyAttribute: 'wit', keySkills: ['rangedCombat', 'observation', 'manipulation', 'survival'],
    talents: ['Investigator — +2 to OBSERVATION when looking for clues.', 'Authority — Re-roll failed COMMAND roll once per session.', 'Take Control — You act first in initiative, once per Act.'] },
  { name: 'Company Agent', keyAttribute: 'wit', keySkills: ['comtech', 'manipulation', 'observation', 'command'],
    talents: ['Corporate Secrets — Access classified Company data terminals.', 'Cunning — +2 to MANIPULATION for deception.', 'Inside Man — You always have a hidden agenda the other PCs don\'t know about.'] },
  { name: 'Kid', keyAttribute: 'agi', keySkills: ['mobility', 'observation', 'survival'],
    talents: ['Small Target — Enemies get −2 to hit you in ranged combat.', 'Hide — +2 to MOBILITY when hiding.', 'Lucky — Re-roll one die per session (Stress Dice included).'] },
  { name: 'Medic', keyAttribute: 'emp', keySkills: ['medicalAid', 'observation', 'stamina', 'manipulation'],
    talents: ['Field Surgeon — Heal an extra point of damage on successful MEDICAL AID.', 'Compassion — When you comfort someone, reduce their Stress by 2.', 'Resilient — Reduce incoming damage by 1 (once per Round).'] },
  { name: 'Officer', keyAttribute: 'emp', keySkills: ['command', 'manipulation', 'rangedCombat', 'observation'],
    talents: ['Field Commander — COMMAND gives +2 (instead of +1).', 'Influence — +2 MANIPULATION against subordinates.', 'Pull Rank — Override one decision per session without a roll.'] },
  { name: 'Pilot', keyAttribute: 'agi', keySkills: ['piloting', 'rangedCombat', 'comtech', 'mobility'],
    talents: ['Like a Glove — Re-roll failed PILOTING roll once per session.', 'Reckless — +2 PILOTING in dangerous maneuvers.', 'Full Throttle — Your vehicle speed increases by 1 in chases.'] },
  { name: 'Roughneck', keyAttribute: 'str', keySkills: ['heavyMachinery', 'stamina', 'closeCombat', 'survival'],
    talents: ['True Grit — Reduce Stress by 1 after successfully using STAMINA.', 'Heavy Lifter — +2 HEAVY MACHINERY.', 'Tough — Reduce one Critical Injury severity by 1 (once per session).'] },
  { name: 'Scientist', keyAttribute: 'wit', keySkills: ['comtech', 'observation', 'survival', 'medicalAid'],
    talents: ['Analysis — +2 to COMTECH for research and analysis.', 'Breakthrough — Automatically succeed on one OBSERVATION/COMTECH roll per session.', 'Inquisitive — Ask the GM one yes/no question per Act that must be answered truthfully.'] },
];

const AVAILABLE_GEAR = [
  'M4A3 Service Pistol', '.357 Magnum Revolver', 'Rexim RXF-M5 EVA Pistol', 'Watatsumi DV-303 Bolt Gun',
  'Armat M41A Pulse Rifle', 'M42A Scope Rifle', 'Armat Model 37A2 Shotgun', 'AK-4047 Pulse Assault Rifle',
  'M240 Incinerator Unit', 'M56A2 Smart Gun', 'Armat U1 Grenade Launcher', 'G2 Electroshock Grenade',
  'Knife', 'Stun Baton', 'Cutting Torch',
  'M3 Personnel Armor', 'IRC Mk.50 Compression Suit', 'IRC Mk.35 Pressure Suit', 'Weyland-Yutani APEsuit',
  'Personal Terminal', 'Motion Tracker', 'Medkit', 'Tool Kit', 'Comm Unit',
  'Duct Tape', 'Flashlight', 'Binoculars', 'Respirator Mask', 'Emergency Flares',
  'MRE Rations', 'Water Canteen', 'First Aid Kit', 'Samani E-Series Watch',
];

function blankCharacter() {
  return {
    id: 'custom-' + Date.now(),
    name: '',
    career: '',
    scenario: 'Custom',
    appearance: '',
    attributes: { str: 2, agi: 2, wit: 2, emp: 2 },
    health: 0,
    skills: Object.keys(skillNames).reduce((acc, k) => ({ ...acc, [k]: 0 }), {}),
    talent: '',
    gear: [],
    signatureItem: '',
    personalAgenda: '',
    buddy: '',
    rival: '',
  };
}

const MAX_ATTR_POINTS = 14;
const MAX_SKILL_POINTS = 10;

function CharacterCreator({ onSave, onBack }) {
  const [char, setChar] = useState(blankCharacter);
  const [selectedCareer, setSelectedCareer] = useState(null);

  const usedAttrPoints = Object.values(char.attributes).reduce((a, b) => a + b, 0);
  const usedSkillPoints = Object.values(char.skills).reduce((a, b) => a + b, 0);
  const attrRemaining = MAX_ATTR_POINTS - usedAttrPoints;
  const skillRemaining = MAX_SKILL_POINTS - usedSkillPoints;

  const selectCareer = (career) => {
    setSelectedCareer(career);
    setChar(prev => ({ ...prev, career: career.name }));
  };

  const setAttr = (attr, val) => {
    const clamped = Math.max(2, Math.min(5, val));
    const newAttrs = { ...char.attributes, [attr]: clamped };
    const total = Object.values(newAttrs).reduce((a, b) => a + b, 0);
    if (total <= MAX_ATTR_POINTS) {
      setChar(prev => ({ ...prev, attributes: newAttrs, health: newAttrs.str + newAttrs.agi > 6 ? newAttrs.str : newAttrs.agi > newAttrs.str ? newAttrs.agi : newAttrs.str }));
    }
  };

  const setSkill = (skill, val) => {
    const clamped = Math.max(0, Math.min(5, val));
    const newSkills = { ...char.skills, [skill]: clamped };
    const total = Object.values(newSkills).reduce((a, b) => a + b, 0);
    if (total <= MAX_SKILL_POINTS) {
      setChar(prev => ({ ...prev, skills: newSkills }));
    }
  };

  const toggleGear = (item) => {
    setChar(prev => ({
      ...prev,
      gear: prev.gear.includes(item) ? prev.gear.filter(g => g !== item) : [...prev.gear, item],
    }));
  };

  const handleSave = () => {
    const finalChar = { ...char, health: char.attributes.str };
    onSave(finalChar);
  };

  const isValid = char.name.trim() && char.career && usedAttrPoints <= MAX_ATTR_POINTS && usedSkillPoints <= MAX_SKILL_POINTS;

  return (
    <div>
      <button className="back-btn" onClick={onBack}>← BACK TO CHARACTERS</button>

      <div className="panel">
        <h2>CHARACTER CREATION</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          Build a custom character for campaign play. Allocate {MAX_ATTR_POINTS} attribute points and {MAX_SKILL_POINTS} skill points.
        </p>
      </div>

      {/* ─── STEP 1: Career ─── */}
      <div className="panel">
        <h3 style={{ color: 'var(--accent)', letterSpacing: '0.1em', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
          STEP 1 — SELECT CAREER
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.4rem' }}>
          {CAREERS.map(career => (
            <button key={career.name}
              onClick={() => selectCareer(career)}
              style={{
                padding: '0.5rem', background: selectedCareer?.name === career.name ? 'rgba(0,212,170,0.12)' : 'transparent',
                border: `1px solid ${selectedCareer?.name === career.name ? 'var(--accent)' : 'var(--border)'}`,
                color: selectedCareer?.name === career.name ? 'var(--accent)' : 'var(--text-dim)',
                fontFamily: "'Share Tech Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.06em', cursor: 'pointer',
                textAlign: 'center',
              }}>
              {career.name.toUpperCase()}
              <div style={{ fontSize: '0.55rem', marginTop: '0.15rem', opacity: 0.6 }}>
                Key: {career.keyAttribute.toUpperCase()}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ─── STEP 2: Identity ─── */}
      <div className="panel">
        <h3 style={{ color: 'var(--accent)', letterSpacing: '0.1em', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
          STEP 2 — IDENTITY
        </h3>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <div>
            <label style={creatorLabel}>NAME</label>
            <input value={char.name} onChange={e => setChar(prev => ({ ...prev, name: e.target.value }))} placeholder="Character name..." style={creatorInput} />
          </div>
          <div>
            <label style={creatorLabel}>APPEARANCE</label>
            <textarea value={char.appearance} onChange={e => setChar(prev => ({ ...prev, appearance: e.target.value }))} placeholder="Physical description..." style={{ ...creatorInput, minHeight: '60px', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={creatorLabel}>BUDDY</label>
              <input value={char.buddy} onChange={e => setChar(prev => ({ ...prev, buddy: e.target.value }))} placeholder="Ally..." style={creatorInput} />
            </div>
            <div>
              <label style={creatorLabel}>RIVAL</label>
              <input value={char.rival} onChange={e => setChar(prev => ({ ...prev, rival: e.target.value }))} placeholder="Enemy..." style={creatorInput} />
            </div>
          </div>
          <div>
            <label style={creatorLabel}>PERSONAL AGENDA</label>
            <textarea value={char.personalAgenda} onChange={e => setChar(prev => ({ ...prev, personalAgenda: e.target.value }))} placeholder="What drives this character?" style={{ ...creatorInput, minHeight: '50px', resize: 'vertical' }} />
          </div>
          <div>
            <label style={creatorLabel}>SIGNATURE ITEM</label>
            <input value={char.signatureItem} onChange={e => setChar(prev => ({ ...prev, signatureItem: e.target.value }))} placeholder="A meaningful personal item..." style={creatorInput} />
          </div>
        </div>
      </div>

      {/* ─── STEP 3: Attributes ─── */}
      <div className="panel">
        <h3 style={{ color: 'var(--accent)', letterSpacing: '0.1em', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
          STEP 3 — ATTRIBUTES
        </h3>
        <p style={{ color: attrRemaining < 0 ? '#c04040' : 'var(--text-dim)', fontSize: '0.7rem', marginBottom: '0.75rem' }}>
          Points remaining: {attrRemaining} / {MAX_ATTR_POINTS} &nbsp;(min 2, max 5 each)
        </p>
        <div className="attributes-grid">
          {Object.entries(char.attributes).map(([attr, val]) => {
            const isKey = selectedCareer?.keyAttribute === attr;
            return (
              <div key={attr} className="attr-box" style={{ borderColor: isKey ? 'var(--accent)' : undefined }}>
                <div className="attr-label">{attr.toUpperCase()}{isKey && <span style={{ color: 'var(--accent)', marginLeft: '0.3rem', fontSize: '0.5rem' }}>KEY</span>}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <button onClick={() => setAttr(attr, val - 1)} style={counterBtn}>−</button>
                  <span className="attr-value" style={{ minWidth: '1.5rem', textAlign: 'center' }}>{val}</span>
                  <button onClick={() => setAttr(attr, val + 1)} style={counterBtn}>+</button>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
          HEALTH: {char.attributes.str}
        </div>
      </div>

      {/* ─── STEP 4: Skills ─── */}
      <div className="panel">
        <h3 style={{ color: 'var(--accent)', letterSpacing: '0.1em', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
          STEP 4 — SKILLS
        </h3>
        <p style={{ color: skillRemaining < 0 ? '#c04040' : 'var(--text-dim)', fontSize: '0.7rem', marginBottom: '0.75rem' }}>
          Points remaining: {skillRemaining} / {MAX_SKILL_POINTS} &nbsp;(max 3 each)
        </p>
        <div className="skills-grid">
          {Object.entries(char.skills).map(([key, val]) => {
            const isCareerSkill = selectedCareer?.keySkills.includes(key);
            return (
              <div key={key} className="skill-row" style={{ borderColor: isCareerSkill ? 'var(--accent)' : undefined, borderWidth: isCareerSkill ? '1px' : undefined, borderStyle: isCareerSkill ? 'solid' : undefined, padding: isCareerSkill ? '0.2rem 0.4rem' : undefined }}>
                <span className="skill-name" style={{ fontSize: '0.7rem' }}>
                  {skillNames[key]}
                  {isCareerSkill && <span style={{ color: 'var(--accent)', fontSize: '0.5rem', marginLeft: '0.2rem' }}>★</span>}
                </span>
                <span className="skill-attr" style={{ fontSize: '0.55rem' }}>{skillAttributes[key]}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <button onClick={() => setSkill(key, val - 1)} style={counterBtn}>−</button>
                  <span className="skill-value" style={{ minWidth: '1.2rem', textAlign: 'center' }}>{val}</span>
                  <button onClick={() => setSkill(key, val + 1)} style={counterBtn}>+</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── STEP 5: Talent ─── */}
      {selectedCareer && (
        <div className="panel">
          <h3 style={{ color: 'var(--accent)', letterSpacing: '0.1em', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            STEP 5 — SELECT TALENT
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {selectedCareer.talents.map((t, i) => (
              <button key={i}
                onClick={() => setChar(prev => ({ ...prev, talent: t }))}
                style={{
                  padding: '0.5rem 0.75rem', background: char.talent === t ? 'rgba(0,212,170,0.12)' : 'transparent',
                  border: `1px solid ${char.talent === t ? 'var(--accent)' : 'var(--border)'}`,
                  color: char.talent === t ? 'var(--accent)' : 'var(--text-dim)',
                  fontFamily: "'Share Tech Mono', monospace", fontSize: '0.7rem', cursor: 'pointer',
                  textAlign: 'left', lineHeight: '1.4',
                }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── STEP 6: Gear ─── */}
      <div className="panel">
        <h3 style={{ color: 'var(--accent)', letterSpacing: '0.1em', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
          STEP 6 — EQUIPMENT ({char.gear.length} items)
        </h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.65rem', marginBottom: '0.5rem' }}>
          Click to toggle items. Max weight is usually 8 items.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.25rem' }}>
          {AVAILABLE_GEAR.map(item => {
            const selected = char.gear.includes(item);
            return (
              <button key={item}
                onClick={() => toggleGear(item)}
                style={{
                  padding: '0.3rem 0.5rem', background: selected ? 'rgba(0,212,170,0.1)' : 'transparent',
                  border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                  color: selected ? 'var(--accent)' : 'var(--text-dim)',
                  fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem',
                  cursor: 'pointer', textAlign: 'left',
                }}>
                {selected ? '✓ ' : ''}{item}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── SAVE ─── */}
      <div style={{ textAlign: 'center', marginTop: '1rem', marginBottom: '2rem' }}>
        <button
          onClick={handleSave}
          disabled={!isValid}
          style={{
            padding: '0.7rem 2rem', background: isValid ? 'rgba(0,212,170,0.12)' : 'transparent',
            border: `1px solid ${isValid ? 'var(--accent)' : 'var(--border)'}`,
            color: isValid ? 'var(--accent)' : 'var(--text-dim)',
            fontFamily: "'Share Tech Mono', monospace", fontSize: '0.85rem',
            letterSpacing: '0.1em', cursor: isValid ? 'pointer' : 'not-allowed',
          }}>
          SAVE CHARACTER
        </button>
      </div>
    </div>
  );
}

const creatorLabel = {
  display: 'block', color: 'var(--text-dim)', fontSize: '0.6rem',
  letterSpacing: '0.12em', marginBottom: '0.2rem',
};

const creatorInput = {
  width: '100%', padding: '0.4rem 0.5rem', background: 'var(--bg-card)',
  border: '1px solid var(--border)', color: 'var(--text)',
  fontFamily: "'Share Tech Mono', monospace", fontSize: '0.75rem',
  boxSizing: 'border-box',
};

const counterBtn = {
  width: '1.6rem', height: '1.6rem', background: 'transparent',
  border: '1px solid var(--border)', color: 'var(--accent)',
  fontFamily: "'Share Tech Mono', monospace", fontSize: '0.9rem',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0,
};

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
  const [mode, setMode] = useState('browse');
  const [customChars, setCustomChars] = useState(() => {
    try { return JSON.parse(localStorage.getItem('muthur-custom-chars') || '[]'); } catch { return []; }
  });

  const handleSaveCustom = (char) => {
    const updated = [...customChars, char];
    setCustomChars(updated);
    localStorage.setItem('muthur-custom-chars', JSON.stringify(updated));
    setMode('browse');
  };

  if (mode === 'create') {
    return <CharacterCreator onSave={handleSaveCustom} onBack={() => setMode('browse')} />;
  }

  const allChars = [...characters, ...customChars];

  if (selected) {
    const character = allChars.find(c => c.id === selected);
    if (!character) { setSelected(null); return null; }
    return <CharacterSheet character={character} onBack={() => setSelected(null)} />;
  }

  const filtered = filter === 'all' ? allChars : allChars.filter(c => c.scenario === filter);

  return (
    <div>
      <div className="panel">
        <h2>CHARACTERS</h2>
        <p style={{ color: 'var(--text-dim)', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Browse pre-built characters or create your own custom character for campaign play.
        </p>
      </div>

      <div className="filter-bar" style={{ marginBottom: '0.5rem' }}>
        <button
          onClick={() => setMode('create')}
          style={{
            padding: '0.4rem 0.8rem', background: 'rgba(0,212,170,0.1)',
            border: '1px solid var(--accent)', color: 'var(--accent)',
            fontFamily: "'Share Tech Mono', monospace", fontSize: '0.7rem',
            letterSpacing: '0.08em', cursor: 'pointer',
          }}>
          + CREATE CHARACTER
        </button>
      </div>

      <div className="filter-bar">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>ALL ({allChars.length})</button>
        {scenarioNames.map(name => (
          <button key={name} className={filter === name ? 'active' : ''} onClick={() => setFilter(name)}>
            {name.toUpperCase()}
          </button>
        ))}
        {customChars.length > 0 && (
          <button className={filter === 'Custom' ? 'active' : ''} onClick={() => setFilter('Custom')}>
            CUSTOM ({customChars.length})
          </button>
        )}
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
