import React, { useState, useCallback, useEffect } from 'react';
import { useUniverse } from '../UniverseContext';
import {
  S, TTSControls, TipsPanel, NpcTracker, ThreatsPanel, HandoutsPanel,
  KeyLocationsPanel, MapsPanel, EndingsPanel, CharactersPanel, Collapsible,
} from './ScenarioPanels';

/* Scene-by-scene DM runner driven by pack.acts[].scenes. Checklist state
   and session notes persist per pack in localStorage. */

function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }, [key, value]);
  return [value, setValue];
}

function SceneCard({ scene, isActive, onActivate, completed, onToggleComplete, tts }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  const borderColor = completed ? 'color-mix(in srgb, var(--success) 45%, transparent)' : isActive ? 'var(--accent)' : 'var(--border)';
  const bgColor = completed ? 'color-mix(in srgb, var(--success) 8%, transparent)' : isActive ? 'color-mix(in srgb, var(--accent) 5%, transparent)' : 'transparent';
  const checks = scene.checks || [];
  const stress = scene.stressTriggers || [];
  const events = scene.events || [];
  const outcomes = scene.outcomes || [];

  return (
    <div style={{ ...S.panel, borderColor, background: bgColor, cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }} onClick={() => { setOpen(!open); onActivate(); }}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleComplete(); }}
          style={{
            width: '1.4rem', height: '1.4rem', minWidth: '1.4rem',
            border: `1px solid ${completed ? 'var(--success)' : 'var(--border)'}`,
            background: completed ? 'color-mix(in srgb, var(--success) 25%, transparent)' : 'transparent',
            color: completed ? 'var(--accent)' : 'transparent',
            fontFamily: 'var(--font-mono)', fontSize: '0.8rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0, marginTop: '0.1rem',
          }}>
          {completed ? '✓' : ''}
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h4 style={{
                fontSize: '0.85rem', color: completed ? 'var(--text-dim)' : 'var(--text)',
                textDecoration: completed ? 'line-through' : 'none', letterSpacing: '0.06em',
              }}>
                {scene.name}
              </h4>
              {scene.mandatory && <span style={S.tag('var(--accent)')}>MANDATORY</span>}
              {scene.encounter && <span style={S.tag('var(--danger)')}>ENCOUNTER</span>}
            </div>
            <span style={{ ...S.dim, fontSize: '0.6rem' }}>{open ? '▲' : '▼'}</span>
          </div>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: '0.75rem', marginLeft: '1.9rem' }}>
          {scene.narration && (
            <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.75rem', borderLeft: '3px solid var(--accent)', background: 'color-mix(in srgb, var(--accent) 3%, transparent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <div style={{ ...S.label, marginBottom: 0 }}>READ ALOUD / NARRATION</div>
                {tts && <button style={{ ...S.btn(false), fontSize: '0.6rem', padding: '0.15rem 0.4rem' }} onClick={() => tts.speak([scene.narration])}>▶ READ</button>}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text)', lineHeight: '1.6', fontStyle: 'italic' }}>
                {scene.narration}
              </p>
            </div>
          )}

          {events.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={S.label}>EVENTS</div>
              {events.map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.2rem' }}>
                  <span style={{ color: 'var(--accent)', fontSize: '0.65rem' }}>{i + 1}.</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text)' }}>{ev}</span>
                </div>
              ))}
            </div>
          )}

          {checks.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={S.label}>SKILL CHECKS</div>
              {checks.map((check, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.2rem' }}>
                  <span style={{ color: 'var(--warn)', fontSize: '0.65rem' }}>⬡</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text)' }}>{check}</span>
                </div>
              ))}
            </div>
          )}

          {stress.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={S.label}>STRESS TRIGGERS</div>
              {stress.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.2rem' }}>
                  <span style={{ color: 'var(--danger)', fontSize: '0.65rem' }}>▲</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>{s}</span>
                </div>
              ))}
            </div>
          )}

          {scene.encounter && (
            <div style={{ marginBottom: '0.5rem', padding: '0.5rem', border: '1px solid var(--danger)', background: 'color-mix(in srgb, var(--danger) 5%, transparent)' }}>
              <div style={{ ...S.label, color: 'var(--danger)' }}>ENCOUNTER</div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text)', lineHeight: '1.5' }}>{scene.encounterDetail || 'Combat or direct threat in this scene.'}</p>
            </div>
          )}

          {scene.npcGuidance && (
            <div style={{ marginBottom: '0.5rem', padding: '0.5rem', border: '1px solid var(--blue)', background: 'color-mix(in srgb, var(--blue) 5%, transparent)' }}>
              <div style={{ ...S.label, color: 'var(--blue)' }}>NPC GUIDANCE</div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text)', lineHeight: '1.5' }}>{scene.npcGuidance}</p>
            </div>
          )}

          {outcomes.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={S.label}>OUTCOMES</div>
              {outcomes.map((o, i) => (
                <div key={i} style={{ fontSize: '0.75rem', color: 'var(--text)', marginBottom: '0.2rem' }}>→ {o}</div>
              ))}
            </div>
          )}

          {scene.gmTip && (
            <div style={{ padding: '0.5rem', border: '1px solid var(--warn)', background: 'color-mix(in srgb, var(--warn) 5%, transparent)' }}>
              <div style={{ ...S.label, color: 'var(--warn)' }}>GM TIP</div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text)', lineHeight: '1.5' }}>{scene.gmTip}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActPanel({ act, actIndex, completedScenes, onToggleScene, activeScene, onActivateScene, tts }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const scenes = act.scenes || [];
  const completedCount = scenes.filter((_, i) => completedScenes[`${actIndex}-${i}`]).length;
  const totalScenes = scenes.length;
  const pct = totalScenes > 0 ? (completedCount / totalScenes) * 100 : 0;

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div
        style={{
          padding: '0.75rem 1rem', background: 'color-mix(in srgb, var(--accent) 6%, transparent)',
          border: '1px solid var(--accent)', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: collapsed ? 0 : '0.5rem', gap: '0.5rem',
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div>
          <h3 style={{ fontSize: '1rem', ...S.accent, letterSpacing: '0.12em', marginBottom: '0.15rem' }}>
            {act.title}{act.subtitle ? ` — ${act.subtitle}` : ''}
          </h3>
          {act.summary && <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{act.summary}</p>}
        </div>
        {totalScenes > 0 && (
          <div style={{ textAlign: 'right', minWidth: '80px' }}>
            <div style={{ fontSize: '0.7rem', ...S.accent }}>{completedCount}/{totalScenes}</div>
            <div style={{ height: '4px', width: '60px', background: 'var(--bg-card)', border: '1px solid var(--border)', marginTop: '0.2rem' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
            </div>
          </div>
        )}
      </div>

      {!collapsed && (
        <div>
          {(act.readAloud?.length > 0 || act.gmNotes) && (
            <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              {act.readAloud?.length > 0 && tts && (
                <button style={S.btn(false)} onClick={() => tts.speak(act.readAloud)}>▶ READ ACT OPENING</button>
              )}
              {(act.gmNotes || act.readAloud?.length > 0) && (
                <button style={S.btn(showNotes)} onClick={() => setShowNotes(!showNotes)}>
                  {showNotes ? 'HIDE' : 'SHOW'} ACT TEXT & GM NOTES
                </button>
              )}
            </div>
          )}
          {(showNotes || totalScenes === 0) && (
            <div style={{ ...S.panel, borderColor: 'var(--border)' }}>
              {(act.readAloud || []).map((p, i) => (
                <p key={i} className="read-aloud-paragraph">{p}</p>
              ))}
              {act.gmNotes && <div className="gm-notes">{act.gmNotes}</div>}
            </div>
          )}
          {scenes.map((scene, i) => (
            <SceneCard
              key={i}
              scene={scene}
              tts={tts}
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

export default function ScenarioPlayer({ pack, tts, onExit }) {
  const { universe } = useUniverse();
  const { terms, terminal } = universe;
  const storageKey = `scenario-progress:${pack.universe}:${pack.id}`;
  const [completedScenes, setCompletedScenes] = usePersistentState(storageKey, {});
  const [notesText, setNotesText] = usePersistentState(`${storageKey}:notes`, '');
  const [activeScene, setActiveScene] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleScene = useCallback((key) => {
    setCompletedScenes(prev => ({ ...prev, [key]: !prev[key] }));
  }, [setCompletedScenes]);

  const acts = pack.acts || [];
  const totalScenes = acts.reduce((a, act) => a + (act.scenes?.length || 0), 0);
  const completedCount = Object.values(completedScenes).filter(Boolean).length;
  const overallPct = totalScenes > 0 ? Math.min(100, (completedCount / totalScenes) * 100) : 0;
  const agendaActs = acts.filter(a => a.agendaNotes);

  return (
    <div>
      <button className="back-btn" onClick={onExit}>← EXIT PLAYTHROUGH</button>

      {/* Header */}
      <div style={{ ...S.panel, borderColor: 'var(--accent)', textAlign: 'center' }}>
        <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', letterSpacing: '0.2em', marginBottom: '0.3rem' }}>
          ▓▓▓▓ {terminal.name} PLAYTHROUGH ASSISTANT ▓▓▓▓
        </div>
        <h2 style={{ ...S.accent, fontSize: '1.2rem', letterSpacing: '0.15em', marginBottom: '0.3rem' }}>
          {pack.meta.title}
        </h2>
        <p style={{ ...S.dim, maxWidth: '600px', margin: '0 auto 0.75rem', lineHeight: '1.5' }}>
          {pack.meta.synopsis || pack.meta.tagline}
        </p>

        {totalScenes > 0 ? (
          <div style={{ maxWidth: '400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: '0.2rem' }}>
              <span>SCENARIO PROGRESS</span>
              <span style={S.accent}>{completedCount}/{totalScenes} SCENES</span>
            </div>
            <div style={{ height: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ height: '100%', width: `${overallPct}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
            </div>
            <button style={{ ...S.btn(false), marginTop: '0.5rem', fontSize: '0.6rem' }}
              onClick={() => { if (confirm('Reset scene checklist for this scenario?')) setCompletedScenes({}); }}>
              RESET PROGRESS
            </button>
          </div>
        ) : (
          <p style={{ ...S.dim, fontSize: '0.7rem' }}>
            This pack has no scene-by-scene runner yet — act text and GM notes are shown below.
          </p>
        )}
      </div>

      {(acts.some(a => a.readAloud?.length)) && (
        <TTSControls tts={tts} paragraphs={acts.flatMap(a => a.readAloud || [])} />
      )}

      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <button style={S.btn(sidebarOpen)} onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? 'HIDE' : 'SHOW'} GM TOOLS
        </button>
      </div>

      {sidebarOpen && (
        <div style={{ marginBottom: '1rem' }}>
          <TipsPanel tips={pack.tips} />
          <NpcTracker npcs={pack.npcs} />
          <ThreatsPanel threats={pack.threats} />
          <HandoutsPanel handouts={pack.handouts} />

          {agendaActs.length > 0 && (
            <Collapsible title="AGENDA PROGRESSION" defaultOpen>
              {agendaActs.map((a, i) => (
                <div key={i} style={{ marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--accent)', letterSpacing: '0.08em' }}>{a.title}: </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{a.agendaNotes}</span>
                </div>
              ))}
            </Collapsible>
          )}

          <Collapsible title={`${terms.session.toUpperCase()} NOTES`} defaultOpen>
            <textarea
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              placeholder="Type your session notes here... track decisions, NPC status, improvised content..."
              style={{
                width: '100%', minHeight: '80px', padding: '0.5rem',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text)', fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </Collapsible>
        </div>
      )}

      {acts.map((act, actIdx) => (
        <ActPanel
          key={actIdx}
          act={act}
          actIndex={actIdx}
          tts={tts}
          completedScenes={completedScenes}
          onToggleScene={toggleScene}
          activeScene={activeScene}
          onActivateScene={setActiveScene}
        />
      ))}

      {totalScenes > 0 && overallPct === 100 && (
        <div style={{ ...S.panel, borderColor: 'var(--accent)', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--accent)', letterSpacing: '0.15em', marginBottom: '0.3rem' }}>
            ════ SCENARIO COMPLETE ════
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text)', lineHeight: '1.5' }}>
            All scenes have been completed. Review personal agendas, award story points, and narrate the epilogue.
          </p>
        </div>
      )}

      <EndingsPanel endings={pack.endings} tts={tts} />
      <CharactersPanel characters={pack.characters} packTitle={pack.meta.title} />
      <MapsPanel maps={pack.maps} packTitle={pack.meta.title} />
      <KeyLocationsPanel locations={pack.keyLocations} />
    </div>
  );
}
