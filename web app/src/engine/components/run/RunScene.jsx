import React from 'react';
import { useReadAloud } from '../../hooks/useTTS';

/* ═══════════════════════════════════════════════════════════════
   FOCUS STAGE — the current scene in large type (GM run view).
   Title (display font, ~40px), read-aloud (~22px italic, accent rule)
   with SEND TO TABLE / READ ALOUD (TTS — the server voice to the VOICE target
   TV / HERE / BOTH set in NARRATE, else read here) / AS CARD, the scene's beats,
   then CHECKS · STRESS TRIGGERS · OUTCOMES as three cards, encounter,
   NPC guidance, clues findable here (one-tap reveal), GM tip.
   ═══════════════════════════════════════════════════════════════ */
export default function RunScene({
  scene, act, actIndex, sceneIndex, sceneCount, done, onToggleDone, onNarrate, narrationLive, onClearNarration,
  tts, clues = [], onRevealClue,
}) {
  const voice = useReadAloud(tts);
  if (!scene) return null;
  const list = (items, cls, mark) => (
    <ul className={`fs-list ${cls}`}>{items.map((x, i) => <li key={i}><span aria-hidden="true">{mark}</span><span>{x}</span></li>)}</ul>
  );
  const cards = [
    scene.checks?.length > 0 && { id: 'ck', label: 'CHECKS', cls: 'ck', body: list(scene.checks, 'ck', '⬡') },
    scene.stressTriggers?.length > 0 && { id: 'st', label: 'STRESS TRIGGERS', cls: 'st', body: list(scene.stressTriggers, 'st', '▲') },
    scene.outcomes?.length > 0 && { id: 'oc', label: 'OUTCOMES', cls: 'oc', body: list(scene.outcomes, 'oc', '→') },
  ].filter(Boolean);
  const speaking = voice.live;
  const where = { tv: 'ON TV', gm: '', both: 'TV + HERE' }[voice.target] || '';
  return (
    <article className={`fs-stage${done ? ' done' : ''}`} aria-labelledby="fs-title">
      <header className="fs-head">
        <div className="fs-head-main">
          <div className="fs-kicker">
            SCENE {sceneIndex + 1} OF {sceneCount}
            {act ? <> · {act.title}{act.subtitle ? ` — ${act.subtitle}` : ''}</> : null}
          </div>
          <h1 className="fs-title" id="fs-title">{scene.name}</h1>
          {(scene.mandatory || scene.encounter) && (
            <div className="fs-tags">
              {scene.mandatory && <span className="fs-tag accent">MANDATORY</span>}
              {scene.encounter && <span className="fs-tag danger">ENCOUNTER</span>}
            </div>
          )}
        </div>
        <button type="button" className={`fs-done${done ? ' on' : ''}`} aria-pressed={!!done} onClick={onToggleDone}
          aria-label={done ? `Scene ${sceneIndex + 1} done — tap to reopen` : `Mark scene ${sceneIndex + 1} done`}>
          <span className="fs-tick" aria-hidden="true">{done ? '✓' : ''}</span>{done ? 'DONE' : 'MARK DONE'}
        </button>
      </header>

      {scene.narration && (
        <section className="fs-read" aria-label="Read aloud">
          <div className="fs-label">READ ALOUD</div>
          <p>{scene.narration}</p>
          <div className="fs-actions">
            <button type="button" className="fs-btn primary" onClick={() => onNarrate(scene.narration, 'caption')}>SEND TO TABLE</button>
            {tts && (speaking
              ? <button type="button" className="fs-btn" onClick={() => voice.stop()}>■ STOP READING</button>
              : <button type="button" className="fs-btn" onClick={() => voice.read([scene.narration], scene.name)}
                  title={voice.routed ? 'Server voice → ' + (where || 'this tablet') : 'Read here'}><span aria-hidden="true">▶ </span>READ ALOUD{voice.routed && where ? ' ' + where : ''}</button>)}
            <button type="button" className="fs-btn" onClick={() => onNarrate(scene.narration, 'card')} title="Full-screen theatre card on the TV">AS CARD</button>
            {narrationLive && (
              <span className="fs-live">
                <span className="run-live">● ON TABLE</span>
                <button type="button" className="run-btn warn" onClick={onClearNarration}>CLEAR</button>
              </span>
            )}
          </div>
        </section>
      )}

      {scene.events?.length > 0 && (
        <section className="fs-beats" aria-label="Events">
          <div className="fs-label">EVENTS</div>
          {list(scene.events, 'ev', '›')}
        </section>
      )}

      {cards.length > 0 && (
        <div className={`fs-cards n${cards.length}`}>
          {cards.map((c) => (
            <section key={c.id} className={`fs-card ${c.cls}`} aria-label={c.label}>
              <div className={`fs-label ${c.cls === 'st' ? 'danger' : ''}`}>{c.label}</div>
              {c.body}
            </section>
          ))}
        </div>
      )}

      {scene.encounter && (
        <section className="fs-box danger">
          <div className="fs-label danger">ENCOUNTER</div>
          <p>{scene.encounterDetail || 'Combat or direct threat in this scene. Creature cards and initiative are under THREATS.'}</p>
        </section>
      )}
      {scene.npcGuidance && (
        <section className="fs-box blue">
          <div className="fs-label">NPC GUIDANCE</div>
          <p>{scene.npcGuidance}</p>
        </section>
      )}
      {clues.length > 0 && (
        <section className="fs-box accent">
          <div className="fs-label">CLUES HERE</div>
          {clues.map((c) => (
            <div key={c.id} className="fs-clue">
              <span className={c.status === 'revealed' ? 'found' : ''}>{c.status === 'revealed' ? '✓ ' : ''}{c.text}</span>
              {c.status !== 'revealed' && <button type="button" className="run-btn" onClick={() => onRevealClue(c.id)}>REVEAL TO ALL</button>}
            </div>
          ))}
        </section>
      )}
      {scene.gmTip && (
        <section className="fs-tip">
          <div className="fs-label warn">GM TIP</div>
          <p>{scene.gmTip}</p>
        </section>
      )}
    </article>
  );
}
