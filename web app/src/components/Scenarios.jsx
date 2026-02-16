import React, { useState } from 'react';
import { scenarios } from '../data/scenarios';
import ScenarioPlayer from './ScenarioPlayer';
import { playthroughs } from '../data/playthroughs';

function TTSControls({ tts, paragraphs }) {
  const { isSpeaking, isPaused, speak, pause, resume, stop, skipBack, skipForward, voices, selectedVoice, setSelectedVoice, rate, setRate } = tts;

  return (
    <div className="tts-controls">
      {!isSpeaking ? (
        <button onClick={() => speak(paragraphs)}>▶ READ ALOUD</button>
      ) : (
        <>
          {isPaused ? (
            <button onClick={resume}>▶ RESUME</button>
          ) : (
            <button onClick={pause}>❚❚ PAUSE</button>
          )}
          <button onClick={stop}>■ STOP</button>
          <button onClick={skipBack}>⏮</button>
          <button onClick={skipForward}>⏭</button>
        </>
      )}
      <label>
        Speed:
        <input type="range" min="0.5" max="1.5" step="0.05" value={rate} onChange={e => setRate(parseFloat(e.target.value))} />
        {rate.toFixed(2)}
      </label>
      {voices.length > 1 && (
        <label>
          Voice:
          <select value={selectedVoice?.name || ''} onChange={e => setSelectedVoice(voices.find(v => v.name === e.target.value))}>
            {voices.filter(v => v.lang.startsWith('en')).map(v => (
              <option key={v.name} value={v.name}>{v.name.substring(0, 30)}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

function ScenarioDetail({ scenario, onBack, tts }) {
  const [showGmNotes, setShowGmNotes] = useState({});
  const [playMode, setPlayMode] = useState(false);
  const { currentIndex, isSpeaking } = tts;

  const toggleGm = (actIdx) => {
    setShowGmNotes(prev => ({ ...prev, [actIdx]: !prev[actIdx] }));
  };

  const hasPlaythrough = !!playthroughs[scenario.id];

  if (playMode) {
    return <ScenarioPlayer scenarioId={scenario.id} onExit={() => setPlayMode(false)} />;
  }

  let globalParagraphIndex = 0;

  return (
    <div className="scenario-detail">
      <button className="back-btn" onClick={onBack}>← BACK TO SCENARIOS</button>

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2>{scenario.title}</h2>
            <p style={{ color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: '0.5rem' }}>{scenario.tagline}</p>
          </div>
          <button
            onClick={() => setPlayMode(true)}
            style={{
              padding: '0.5rem 1rem',
              background: hasPlaythrough ? 'rgba(0,212,170,0.15)' : 'transparent',
              border: `1px solid ${hasPlaythrough ? 'var(--accent)' : 'var(--border)'}`,
              color: hasPlaythrough ? 'var(--accent)' : 'var(--text-dim)',
              fontFamily: "'Orbitron', sans-serif",
              fontSize: '0.75rem',
              letterSpacing: '0.12em',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              boxShadow: hasPlaythrough ? '0 0 10px rgba(0,212,170,0.2)' : 'none',
            }}
          >
            <span style={{ fontSize: '1rem' }}>▶</span>
            PLAY SCENARIO
          </button>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
          <span>Players: <span style={{ color: 'var(--accent)' }}>{scenario.players}</span></span>
          <span>Playtime: <span style={{ color: 'var(--accent)' }}>{scenario.playtime}</span></span>
          <span>Type: <span style={{ color: 'var(--accent)' }}>{scenario.type}</span></span>
        </div>
      </div>

      <div className="briefing-box">
        <div className="briefing-header">
          FROM: {scenario.briefing.from}<br />
          TO: {scenario.briefing.to}<br />
          CLASSIFICATION: {scenario.briefing.classification}
        </div>
        <div className="briefing-text">{scenario.briefing.text}</div>
      </div>

      {scenario.acts.map((act, actIdx) => {
        const actStartIdx = globalParagraphIndex;
        const paragraphElements = act.readAloud.map((para, pIdx) => {
          const thisGlobalIdx = actStartIdx + pIdx;
          return (
            <div
              key={pIdx}
              className={`read-aloud-paragraph${isSpeaking && currentIndex === thisGlobalIdx ? ' speaking' : ''}`}
            >
              {para}
            </div>
          );
        });
        globalParagraphIndex += act.readAloud.length;

        const allReadAloud = scenario.acts.flatMap(a => a.readAloud);

        return (
          <div key={actIdx} className="act-section">
            <div className="act-header">
              <span className="act-number">{act.title}</span>
              <span className="act-subtitle">{act.subtitle}</span>
            </div>

            {actIdx === 0 && (
              <TTSControls tts={tts} paragraphs={allReadAloud} />
            )}

            {paragraphElements}

            <button className="gm-notes-toggle" onClick={() => toggleGm(actIdx)}>
              {showGmNotes[actIdx] ? 'HIDE GM NOTES' : 'SHOW GM NOTES'}
            </button>
            {showGmNotes[actIdx] && (
              <div className="gm-notes">{act.gmNotes}</div>
            )}
          </div>
        );
      })}

      {scenario.maps && scenario.maps.length > 0 && (
        <div className="panel">
          <h2>MAPS</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {scenario.maps.map((m, i) => (
              <div key={i}>
                <h3 style={{ fontSize: '0.85rem', color: 'var(--accent)', marginBottom: '0.5rem', letterSpacing: '0.08em' }}>
                  {m.name}
                </h3>
                <div style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden', background: '#080c10' }}>
                  <img
                    src={m.src}
                    alt={m.name}
                    style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer' }}
                    onClick={() => window.open(m.src, '_blank')}
                    title="Click to open full size"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {scenario.keyLocations && (
        <div className="panel">
          <h2>KEY LOCATIONS</h2>
          <div className="location-grid">
            {scenario.keyLocations.map((loc, i) => (
              <div key={i} className="location-item">
                <div className="loc-name">{loc.name}</div>
                <div className="loc-desc">{loc.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Scenarios({ tts }) {
  const [selected, setSelected] = useState(null);

  if (selected) {
    const scenario = scenarios.find(s => s.id === selected);
    return <ScenarioDetail scenario={scenario} onBack={() => setSelected(null)} tts={tts} />;
  }

  const cinematicScenarios = scenarios.filter(s => s.type === 'Cinematic');
  const campaignScenarios = scenarios.filter(s => s.type !== 'Cinematic');

  const renderCard = (s) => {
    const hasPlay = !!playthroughs[s.id];
    return (
      <div key={s.id} className="scenario-card" onClick={() => setSelected(s.id)}>
        <div className="card-type">{s.type}</div>
        <div className="card-title">{s.title}</div>
        <div className="card-tagline">{s.tagline}</div>
        <div className="card-meta">
          <span>{s.players} Players</span>
          <span>{s.playtime}</span>
          <span>{s.difficulty}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          {s.maps && s.maps.length > 0 && (
            <span style={{ fontSize: '0.65rem', color: 'var(--accent)', opacity: 0.7 }}>
              {s.maps.length} MAP{s.maps.length > 1 ? 'S' : ''}
            </span>
          )}
          {hasPlay && (
            <span style={{
              fontSize: '0.6rem', color: 'var(--accent)', letterSpacing: '0.08em',
              border: '1px solid var(--accent)', padding: '0.1rem 0.4rem',
              opacity: 0.9,
            }}>
              ▶ PLAYTHROUGH
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="panel">
        <h2>CINEMATIC SCENARIOS</h2>
        <p style={{ color: 'var(--text-dim)', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Select a scenario to view the full briefing, act-by-act read-aloud text, and GM notes.
          Use the Read Aloud feature to have MU/TH/UR narrate to your players.
        </p>
      </div>
      <div className="scenario-grid">
        {cinematicScenarios.map(renderCard)}
      </div>

      {campaignScenarios.length > 0 && (
        <>
          <div className="panel" style={{ marginTop: '2rem' }}>
            <h2>COLONIAL MARINES — CAMPAIGN OPERATIONS</h2>
            <p style={{ color: 'var(--text-dim)', marginBottom: '1rem', fontSize: '0.85rem' }}>
              Operations from the Colonial Marines Operations Manual. Each mission includes tactical maps
              extracted from the official sourcebook.
            </p>
          </div>
          <div className="scenario-grid">
            {campaignScenarios.map(renderCard)}
          </div>
        </>
      )}
    </div>
  );
}
