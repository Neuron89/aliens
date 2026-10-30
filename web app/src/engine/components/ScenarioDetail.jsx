import React, { useState } from 'react';
import { useUniverse } from '../UniverseContext';
import { useContent } from '../ContentContext';
import { useGame } from '../GameContext';
import { ExportPackButton } from './PackImportExport';
import {
  TTSControls, TipsPanel, NpcTracker, ThreatsPanel, KeyLocationsPanel,
  MapsPanel, EndingsPanel, CharactersPanel, HandoutsPanel,
} from './ScenarioPanels';

/* Briefing + acts (read-aloud with TTS, GM notes) + everything else in the pack. */
export default function ScenarioDetail({ pack, tts, onBack, onPlay }) {
  const { universe } = useUniverse();
  const { runtimeIds, bundledIds, remove } = useContent();
  const { packId: sessionPackId } = useGame();
  const [showGmNotes, setShowGmNotes] = useState({});
  const { currentIndex, isSpeaking } = tts;
  const { meta } = pack;
  const acts = pack.acts || [];
  const hasRunner = acts.some(a => a.scenes?.length);
  const isRuntime = runtimeIds.has(pack.id);

  const toggleGm = (actIdx) => setShowGmNotes(prev => ({ ...prev, [actIdx]: !prev[actIdx] }));

  const handleDelete = async () => {
    const msg = bundledIds.has(pack.id)
      ? `Delete the custom override of "${meta.title}"? The bundled version will be restored.`
      : `Delete "${meta.title}" from the server? This cannot be undone.`;
    if (!confirm(msg)) return;
    await remove(pack.id);
    onBack();
  };

  const allReadAloud = acts.flatMap(a => a.readAloud || []);
  let globalParagraphIndex = 0;

  return (
    <div className="scenario-detail">
      <button className="back-btn" onClick={onBack}>← BACK TO SCENARIOS</button>

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2>{meta.title}</h2>
            <p style={{ color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: '0.5rem' }}>{meta.tagline}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <ExportPackButton pack={pack} />
            {isRuntime && (
              <button onClick={handleDelete} style={{ padding: '0.35rem 0.7rem', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', cursor: 'pointer' }}>
                DELETE
              </button>
            )}
            <button
              onClick={onPlay}
              style={{
                padding: '0.5rem 1rem',
                background: hasRunner ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
                border: `1px solid ${hasRunner ? 'var(--accent)' : 'var(--border)'}`,
                color: hasRunner ? 'var(--accent)' : 'var(--text-dim)',
                fontFamily: 'var(--font-display)',
                fontSize: '0.75rem',
                letterSpacing: '0.12em',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                boxShadow: hasRunner ? '0 0 10px color-mix(in srgb, var(--accent) 20%, transparent)' : 'none',
              }}
            >
              <span style={{ fontSize: '1rem' }}>▶</span>
              PLAY SCENARIO
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: 'var(--text-dim)', flexWrap: 'wrap' }}>
          {meta.players && <span>Players: <span style={{ color: 'var(--accent)' }}>{meta.players}</span></span>}
          {meta.playtime && <span>Playtime: <span style={{ color: 'var(--accent)' }}>{meta.playtime}</span></span>}
          {meta.type && <span>Type: <span style={{ color: 'var(--accent)' }}>{meta.type}</span></span>}
          {meta.difficulty && <span>Difficulty: <span style={{ color: 'var(--accent)' }}>{meta.difficulty}</span></span>}
          <span>Source: <span style={{ color: 'var(--accent)' }}>{(meta.source || 'custom').toUpperCase()}</span></span>
          {sessionPackId === pack.id && <span style={{ color: 'var(--success)' }}>● ACTIVE {universe.terms.session.toUpperCase()} SCENARIO</span>}
        </div>
        {(meta.tone?.length > 0 || meta.contentWarnings?.length > 0) && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
            {meta.tone?.length > 0 && <span>TONE: {meta.tone.join(', ')}</span>}
            {meta.contentWarnings?.length > 0 && <span style={{ color: 'var(--warn)', marginLeft: meta.tone?.length ? '1rem' : 0 }}>CONTENT WARNINGS: {meta.contentWarnings.join(', ')}</span>}
          </div>
        )}
        {meta.synopsis && (
          <p style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: 'var(--text)', lineHeight: '1.5' }}>
            <span style={{ color: 'var(--accent)', fontSize: '0.65rem', letterSpacing: '0.1em' }}>GM SYNOPSIS: </span>{meta.synopsis}
          </p>
        )}
      </div>

      {pack.briefing && (
        <div className="briefing-box">
          <div className="briefing-header">
            {pack.briefing.from && <>FROM: {pack.briefing.from}<br /></>}
            {pack.briefing.to && <>TO: {pack.briefing.to}<br /></>}
            {pack.briefing.classification && <>CLASSIFICATION: {pack.briefing.classification}</>}
          </div>
          <div className="briefing-text">{pack.briefing.text}</div>
        </div>
      )}

      {acts.map((act, actIdx) => {
        const paragraphs = act.readAloud || [];
        const actStartIdx = globalParagraphIndex;
        globalParagraphIndex += paragraphs.length;
        const firstWithText = acts.findIndex(a => (a.readAloud || []).length > 0);

        return (
          <div key={actIdx} className="act-section">
            <div className="act-header">
              <span className="act-number">{act.title}</span>
              {act.subtitle && <span className="act-subtitle">{act.subtitle}</span>}
            </div>

            {actIdx === firstWithText && <TTSControls tts={tts} paragraphs={allReadAloud} />}

            {act.summary && (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>{act.summary}</p>
            )}

            {paragraphs.map((para, pIdx) => (
              <div key={pIdx}
                className={`read-aloud-paragraph${isSpeaking && currentIndex === actStartIdx + pIdx ? ' speaking' : ''}`}>
                {para}
              </div>
            ))}

            {(act.gmNotes || act.agendaNotes) && (
              <>
                <button className="gm-notes-toggle" onClick={() => toggleGm(actIdx)}>
                  {showGmNotes[actIdx] ? 'HIDE GM NOTES' : 'SHOW GM NOTES'}
                </button>
                {showGmNotes[actIdx] && (
                  <div className="gm-notes">
                    {act.gmNotes}
                    {act.agendaNotes && (
                      <div style={{ marginTop: act.gmNotes ? '0.5rem' : 0 }}>
                        <strong>AGENDAS: </strong>{act.agendaNotes}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      <CharactersPanel characters={pack.characters} packTitle={meta.title} />
      <TipsPanel tips={pack.tips} defaultOpen={false} />
      <NpcTracker npcs={pack.npcs} />
      <ThreatsPanel threats={pack.threats} />
      <HandoutsPanel handouts={pack.handouts} />
      <MapsPanel maps={pack.maps} packTitle={meta.title} />
      <KeyLocationsPanel locations={pack.keyLocations} />
      <EndingsPanel endings={pack.endings} tts={tts} />
    </div>
  );
}
