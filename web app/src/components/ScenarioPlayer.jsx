import React, { useState, useCallback, useEffect } from 'react';
import { playthroughs } from '../data/playthroughs';

const S = {
  panel: {
    border: '1px solid var(--border)', background: 'var(--bg-panel)',
    padding: '1rem', marginBottom: '0.75rem',
  },
  accent: { color: 'var(--accent)' },
  dim: { color: 'var(--text-dim)', fontSize: '0.8rem' },
  label: {
    display: 'block', fontSize: '0.6rem', color: 'var(--text-dim)',
    letterSpacing: '0.14em', marginBottom: '0.3rem',
  },
  tag: (color) => ({
    display: 'inline-block', padding: '0.15rem 0.5rem', fontSize: '0.6rem',
    letterSpacing: '0.08em', border: `1px solid ${color}`, color,
    marginRight: '0.3rem', marginBottom: '0.2rem',
  }),
  btn: (active) => ({
    padding: '0.35rem 0.7rem', background: active ? 'rgba(0,212,170,0.12)' : 'transparent',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    color: active ? 'var(--accent)' : 'var(--text-dim)',
    fontFamily: "'Share Tech Mono', monospace", fontSize: '0.7rem',
    letterSpacing: '0.06em', cursor: 'pointer',
  }),
};

function NpcTracker({ npcs }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={S.panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <h3 style={{ fontSize: '0.8rem', ...S.accent, letterSpacing: '0.1em' }}>NPC TRACKER ({npcs.length})</h3>
        <span style={{ ...S.dim, fontSize: '0.7rem' }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {npcs.map((npc, i) => (
            <div key={i} style={{ padding: '0.5rem', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text)' }}>{npc.name}</strong>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--accent)', marginBottom: '0.15rem' }}>AGENDA: {npc.agenda}</div>
              <div style={{ fontSize: '0.7rem', ...S.dim }}>{npc.behavior}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SceneCard({ scene, sceneIndex, isActive, onActivate, completed, onToggleComplete }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  const borderColor = completed ? '#2a5a3a' : isActive ? 'var(--accent)' : 'var(--border)';
  const bgColor = completed ? 'rgba(42,90,58,0.08)' : isActive ? 'rgba(0,212,170,0.05)' : 'transparent';

  return (
    <div style={{ ...S.panel, borderColor, background: bgColor, cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }} onClick={() => setOpen(!open)}>
        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleComplete(); }}
          style={{
            width: '1.4rem', height: '1.4rem', minWidth: '1.4rem',
            border: `1px solid ${completed ? '#2a5a3a' : 'var(--border)'}`,
            background: completed ? 'rgba(42,90,58,0.3)' : 'transparent',
            color: completed ? 'var(--accent)' : 'transparent',
            fontFamily: "'Share Tech Mono', monospace", fontSize: '0.8rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0, marginTop: '0.1rem',
          }}>
          {completed ? '✓' : ''}
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h4 style={{
                fontSize: '0.85rem', color: completed ? 'var(--text-dim)' : 'var(--text)',
                textDecoration: completed ? 'line-through' : 'none', letterSpacing: '0.06em',
              }}>
                {scene.name}
              </h4>
              {scene.mandatory && <span style={S.tag('var(--accent)')}>MANDATORY</span>}
              {scene.encounter && <span style={S.tag('#c04040')}>ENCOUNTER</span>}
            </div>
            <span style={{ ...S.dim, fontSize: '0.6rem' }}>{open ? '▲' : '▼'}</span>
          </div>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: '0.75rem', marginLeft: '1.9rem' }}>
          {/* Narration / Read-Aloud */}
          <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.75rem', borderLeft: '3px solid var(--accent)', background: 'rgba(0,212,170,0.03)' }}>
            <div style={{ ...S.label, marginBottom: '0.4rem' }}>READ ALOUD / NARRATION</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text)', lineHeight: '1.6', fontStyle: 'italic' }}>
              {scene.narration}
            </p>
          </div>

          {/* Skill Checks */}
          {scene.checks.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={S.label}>SKILL CHECKS</div>
              {scene.checks.map((check, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.2rem' }}>
                  <span style={{ color: '#c0a040', fontSize: '0.65rem' }}>⬡</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text)' }}>{check}</span>
                </div>
              ))}
            </div>
          )}

          {/* Stress Triggers */}
          {scene.stress.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={S.label}>STRESS TRIGGERS</div>
              {scene.stress.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.2rem' }}>
                  <span style={{ color: '#c04040', fontSize: '0.65rem' }}>▲</span>
                  <span style={{ fontSize: '0.75rem', color: '#c04040' }}>{s}</span>
                </div>
              ))}
            </div>
          )}

          {/* Encounter */}
          {scene.encounter && (
            <div style={{ marginBottom: '0.5rem', padding: '0.5rem', border: '1px solid #c04040', background: 'rgba(192,64,64,0.05)' }}>
              <div style={{ ...S.label, color: '#c04040' }}>ENCOUNTER</div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text)', lineHeight: '1.5' }}>{scene.encounter}</p>
            </div>
          )}

          {/* DM Tip */}
          {scene.dmTip && (
            <div style={{ padding: '0.5rem', border: '1px solid #c0a040', background: 'rgba(192,160,64,0.05)' }}>
              <div style={{ ...S.label, color: '#c0a040' }}>DM TIP</div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text)', lineHeight: '1.5' }}>{scene.dmTip}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActPanel({ act, actIndex, completedScenes, onToggleScene, activeScene, onActivateScene }) {
  const [collapsed, setCollapsed] = useState(false);
  const completedCount = act.scenes.filter((_, i) => completedScenes[`${actIndex}-${i}`]).length;
  const totalScenes = act.scenes.length;
  const pct = totalScenes > 0 ? (completedCount / totalScenes) * 100 : 0;

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div
        style={{
          padding: '0.75rem 1rem', background: 'rgba(0,212,170,0.06)',
          border: '1px solid var(--accent)', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: collapsed ? 0 : '0.5rem',
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div>
          <h3 style={{ fontSize: '1rem', ...S.accent, letterSpacing: '0.12em', marginBottom: '0.15rem' }}>{act.title}</h3>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{act.summary}</p>
        </div>
        <div style={{ textAlign: 'right', minWidth: '80px' }}>
          <div style={{ fontSize: '0.7rem', ...S.accent }}>{completedCount}/{totalScenes}</div>
          <div style={{ height: '4px', width: '60px', background: 'var(--bg-card)', border: '1px solid var(--border)', marginTop: '0.2rem' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>

      {!collapsed && (
        <div>
          {act.scenes.map((scene, i) => (
            <SceneCard
              key={i}
              scene={scene}
              sceneIndex={i}
              isActive={activeScene === `${actIndex}-${i}`}
              onActivate={() => onActivateScene(`${actIndex}-${i}`)}
              completed={!!completedScenes[`${actIndex}-${i}`]}
              onToggleComplete={() => onToggleScene(`${actIndex}-${i}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ScenarioPlayer({ scenarioId, onExit }) {
  const data = playthroughs[scenarioId];
  const [completedScenes, setCompletedScenes] = useState({});
  const [activeScene, setActiveScene] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notesText, setNotesText] = useState('');

  const toggleScene = useCallback((key) => {
    setCompletedScenes(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (!data) {
    return (
      <div>
        <button className="back-btn" onClick={onExit}>← BACK TO SCENARIO</button>
        <div style={S.panel}>
          <h2 style={S.accent}>PLAYTHROUGH ASSISTANT</h2>
          <p style={S.dim}>
            Detailed playthrough data for this operation is coming soon. In the meantime,
            use the GM Notes in the scenario view for guidance.
          </p>
        </div>
      </div>
    );
  }

  const totalScenes = data.acts.reduce((a, act) => a + act.scenes.length, 0);
  const completedCount = Object.values(completedScenes).filter(Boolean).length;
  const overallPct = totalScenes > 0 ? (completedCount / totalScenes) * 100 : 0;

  return (
    <div>
      <button className="back-btn" onClick={onExit}>← EXIT PLAYTHROUGH</button>

      {/* Header */}
      <div style={{ ...S.panel, borderColor: 'var(--accent)', textAlign: 'center' }}>
        <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', letterSpacing: '0.2em', marginBottom: '0.3rem' }}>
          ▓▓▓▓ MU/TH/UR PLAYTHROUGH ASSISTANT ▓▓▓▓
        </div>
        <h2 style={{ ...S.accent, fontSize: '1.2rem', letterSpacing: '0.15em', marginBottom: '0.3rem' }}>
          {data.title}
        </h2>
        <p style={{ ...S.dim, maxWidth: '600px', margin: '0 auto 0.75rem', lineHeight: '1.5' }}>
          {data.overview}
        </p>

        {/* Progress bar */}
        <div style={{ maxWidth: '400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: '0.2rem' }}>
            <span>SCENARIO PROGRESS</span>
            <span style={S.accent}>{completedCount}/{totalScenes} SCENES</span>
          </div>
          <div style={{ height: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ height: '100%', width: `${overallPct}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>

      {/* Sidebar toggle */}
      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <button style={S.btn(sidebarOpen)} onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? 'HIDE' : 'SHOW'} GM TOOLS
        </button>
      </div>

      {/* Sidebar — GM Tools */}
      {sidebarOpen && (
        <div style={{ marginBottom: '1rem' }}>
          {/* DM Tips */}
          <div style={S.panel}>
            <h3 style={{ fontSize: '0.8rem', ...S.accent, letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
              GAME MOTHER TIPS
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.tips.map((tip, i) => (
                <li key={i} style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: '1.5', marginBottom: '0.3rem', paddingLeft: '1rem', position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--accent)' }}>▸</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* NPC Tracker */}
          <NpcTracker npcs={data.npcs} />

          {/* Agenda Summary */}
          <div style={S.panel}>
            <h3 style={{ fontSize: '0.8rem', ...S.accent, letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
              AGENDA PROGRESSION
            </h3>
            {Object.entries(data.agendas).map(([act, desc]) => (
              <div key={act} style={{ marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--accent)', letterSpacing: '0.08em' }}>{act}: </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{desc}</span>
              </div>
            ))}
          </div>

          {/* Session Notes */}
          <div style={S.panel}>
            <h3 style={{ fontSize: '0.8rem', ...S.accent, letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
              SESSION NOTES
            </h3>
            <textarea
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              placeholder="Type your session notes here... track decisions, NPC status, improvised content..."
              style={{
                width: '100%', minHeight: '80px', padding: '0.5rem',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text)', fontFamily: "'Share Tech Mono', monospace",
                fontSize: '0.75rem', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      )}

      {/* Acts & Scenes */}
      {data.acts.map((act, actIdx) => (
        <ActPanel
          key={actIdx}
          act={act}
          actIndex={actIdx}
          completedScenes={completedScenes}
          onToggleScene={toggleScene}
          activeScene={activeScene}
          onActivateScene={setActiveScene}
        />
      ))}

      {/* Completion */}
      {overallPct === 100 && (
        <div style={{ ...S.panel, borderColor: 'var(--accent)', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--accent)', letterSpacing: '0.15em', marginBottom: '0.3rem' }}>
            ════ SCENARIO COMPLETE ════
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text)', lineHeight: '1.5' }}>
            All scenes have been completed. Review personal agendas, award Story Points, and narrate the epilogue.
          </p>
        </div>
      )}
    </div>
  );
}
