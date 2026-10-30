import React from 'react';

/* Current scene card for the GM run view: read-aloud (SEND TO TABLE as
   caption or card, TTS), events, checks, stress triggers, encounter, NPC
   guidance, outcomes, GM tip, and clues findable here (one-tap reveal). */
export default function RunScene({ scene, act, done, onToggleDone, onNarrate, narrationLive, tts, clues = [], onRevealClue }) {
  if (!scene) return null;
  const list = (items, cls, mark) => items?.length > 0 && (
    <ul className={`rs-list ${cls}`}>{items.map((x, i) => <li key={i}><span aria-hidden="true">{mark}</span>{x}</li>)}</ul>
  );
  return (
    <article className={`rs${done ? ' done' : ''}`}>
      <header className="rs-head">
        <div>
          <div className="rs-kicker">{act?.title}{act?.subtitle ? ` — ${act.subtitle}` : ''}</div>
          <h2 className="rs-title">{scene.name}</h2>
          <div className="rs-tags">
            {scene.mandatory && <span className="rs-tag accent">MANDATORY</span>}
            {scene.encounter && <span className="rs-tag danger">ENCOUNTER</span>}
          </div>
        </div>
        <label className="rs-done">
          <input type="checkbox" checked={!!done} onChange={onToggleDone} /> DONE
        </label>
      </header>

      {scene.narration && (
        <section className="rs-read">
          <div className="rs-label">READ ALOUD</div>
          <p>{scene.narration}</p>
          <div className="run-row">
            <button type="button" className="run-btn primary" onClick={() => onNarrate(scene.narration, 'caption')}>SEND TO TABLE</button>
            <button type="button" className="run-btn" onClick={() => onNarrate(scene.narration, 'card')} title="Full-screen theatre card on the TV">AS CARD</button>
            {tts && <button type="button" className="run-btn" onClick={() => tts.speak([scene.narration])}>▶ TTS</button>}
            {narrationLive && <span className="run-live">● ON TABLE</span>}
          </div>
        </section>
      )}

      {scene.events?.length > 0 && <section><div className="rs-label">EVENTS</div>{list(scene.events, 'ev', '›')}</section>}
      {scene.checks?.length > 0 && <section><div className="rs-label">CHECKS</div>{list(scene.checks, 'ck', '⬡')}</section>}
      {scene.stressTriggers?.length > 0 && <section><div className="rs-label danger">STRESS TRIGGERS</div>{list(scene.stressTriggers, 'st', '▲')}</section>}
      {scene.encounter && (
        <section className="rs-box danger">
          <div className="rs-label danger">ENCOUNTER</div>
          <p>{scene.encounterDetail || 'Combat or direct threat in this scene.'}</p>
        </section>
      )}
      {scene.npcGuidance && (
        <section className="rs-box blue">
          <div className="rs-label">NPC GUIDANCE</div>
          <p>{scene.npcGuidance}</p>
        </section>
      )}
      {clues.length > 0 && (
        <section className="rs-box accent">
          <div className="rs-label">CLUES HERE</div>
          {clues.map((c) => (
            <div key={c.id} className="rs-clue">
              <span className={c.status === 'revealed' ? 'found' : ''}>{c.status === 'revealed' ? '✓ ' : ''}{c.text}</span>
              {c.status !== 'revealed' && <button type="button" className="run-btn sm" onClick={() => onRevealClue(c.id)}>REVEAL TO ALL</button>}
            </div>
          ))}
        </section>
      )}
      {scene.outcomes?.length > 0 && <section><div className="rs-label">OUTCOMES</div>{list(scene.outcomes, 'oc', '→')}</section>}
      {scene.gmTip && (
        <section className="rs-box warn">
          <div className="rs-label warn">GM TIP</div>
          <p>{scene.gmTip}</p>
        </section>
      )}
    </article>
  );
}
