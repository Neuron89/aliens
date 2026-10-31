import React, { useEffect, useState } from 'react';
import { useReadAloud } from '../../hooks/useTTS';

/* ═══════════════════════════════════════════════════════════════
   Scene list (Focus Stage): every act with its scenes — done ticks
   (tap to toggle), MANDATORY / ENCOUNTER chips, tap a scene to go
   there; the current act's brief (summary, agenda notes, GM notes,
   ACT OPENING → TV card / TTS — the server voice to the VOICE target
   when one is set, see hooks/useTTS useReadAloud); PREV / NEXT at the foot.
   Rendered inside a left Drawer (tablet) or as a pinned 280px column
   (≥1400px wide).
   ═══════════════════════════════════════════════════════════════ */
export default function SceneList({
  acts, actIndex, sceneIndex, completed, onGo, onToggle, onPrev, onNext, nextLabel, nextDisabled, advance, onActOpening, tts,
}) {
  const [openActs, setOpenActs] = useState(() => new Set([actIndex]));
  const [brief, setBrief] = useState(false);
  const voice = useReadAloud(tts);
  useEffect(() => { setOpenActs((s) => (s.has(actIndex) ? s : new Set([...s, actIndex]))); }, [actIndex]);
  const toggleAct = (i) => setOpenActs((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const act = acts[actIndex];

  return (
    <div className="sl">
      <div className="sl-scroll">
        {acts.map((a, i) => {
          const scenes = a.scenes || [];
          const d = scenes.filter((_, j) => completed[`${i}-${j}`]).length;
          const open = openActs.has(i);
          const current = i === actIndex;
          return (
            <section key={i} className={`sl-act${current ? ' current' : ''}`}>
              <button type="button" className="sl-act-head" aria-expanded={open} onClick={() => toggleAct(i)}>
                <span className="sl-act-name">{a.title}{a.subtitle ? <small> · {a.subtitle}</small> : null}</span>
                <span className="sl-act-count">{d}/{scenes.length}</span>
              </button>
              {scenes.length > 0 && <i className="sl-act-bar" aria-hidden="true"><b style={{ width: `${(d / scenes.length) * 100}%` }} /></i>}
              {open && current && (act?.summary || act?.agendaNotes || act?.gmNotes || act?.readAloud?.length > 0) && (
                <div className="sl-brief">
                  <button type="button" className="sl-brief-head" aria-expanded={brief} onClick={() => setBrief((v) => !v)}>
                    ACT BRIEF <span aria-hidden="true">{brief ? '▲' : '▼'}</span>
                  </button>
                  {act.summary && <p className="sl-brief-sum">{act.summary}</p>}
                  {brief && (
                    <>
                      {act.agendaNotes && <p><b className="run-accent">AGENDAS: </b>{act.agendaNotes}</p>}
                      {act.gmNotes && <p className="run-dim-p">{act.gmNotes}</p>}
                      {act.readAloud?.length > 0 && (
                        <div className="run-row">
                          <button type="button" className="run-btn" onClick={onActOpening}>ACT OPENING → TV CARD</button>
                          {tts && (voice.live
                            ? <button type="button" className="run-btn" onClick={() => voice.stop()}>■ STOP</button>
                            : <button type="button" className="run-btn" onClick={() => voice.read(act.readAloud, act.title)}>▶ {voice.routed ? 'VOICE' : 'TTS'}</button>)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {open && scenes.length > 0 && (
                <ol className="sl-scenes">
                  {scenes.map((s, j) => {
                    const on = current && j === sceneIndex;
                    const isDone = !!completed[`${i}-${j}`];
                    return (
                      <li key={j} className={`sl-scene${on ? ' on' : ''}${isDone ? ' done' : ''}`}>
                        <button type="button" className={`sl-tick${isDone ? ' yes' : ''}`} aria-pressed={isDone}
                          aria-label={`${s.name}: ${isDone ? 'done — tap to reopen' : 'mark done'}`} onClick={() => onToggle(i, j)}>
                          {isDone ? '✓' : ''}
                        </button>
                        <button type="button" className="sl-go" aria-current={on ? 'step' : undefined} onClick={() => onGo(i, j)}>
                          <span className="sl-n">{j + 1}.</span>
                          <span className="sl-name">{s.name}</span>
                          {s.mandatory && <span className="sl-chip accent">MANDATORY</span>}
                          {s.encounter && <span className="sl-chip danger">ENCOUNTER</span>}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
              {open && scenes.length === 0 && <p className="run-empty sl-none">No scene runner for this act.{!current ? ' Tap the act to open it.' : ''}</p>}
              {open && !current && scenes.length === 0 && (
                <button type="button" className="run-btn sl-open-act" onClick={() => onGo(i, 0)}>OPEN {a.title}</button>
              )}
            </section>
          );
        })}
      </div>
      <div className="sl-foot">
        <button type="button" className="fs-btn" onClick={onPrev} disabled={!onPrev}><span aria-hidden="true">◂ </span>PREV</button>
        {advance || <button type="button" className="fs-btn primary" onClick={onNext} disabled={nextDisabled}>{nextLabel}<span aria-hidden="true"> ▸</span></button>}
      </div>
    </div>
  );
}
