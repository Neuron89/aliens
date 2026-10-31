import React, { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../GameContext';
import { fmtTime } from '../../rulesUtils';
import { useVoiceTarget, useVoicePrefs, SPEED_RANGE } from '../../hooks/useTTS';

/* ═══════════════════════════════════════════════════════════════
   NARRATE drawer (Focus Stage dock, key `n`): free caption / card
   composer for the TV and phones, VOICE (server TTS: OFF | TV | HERE |
   BOTH, voice, speed; SPEAK, and SEND also speaks when VOICE is on),
   what is on the table now (CLEAR), TV mode MAP | THEATRE, and the
   recent narration from the session log (tap USE to put a line back).
   Without a voice server (TTS_URL unset / down) SPEAK reads here with
   the browser voice and the status line says how to fix it.
   ═══════════════════════════════════════════════════════════════ */
const TARGETS = [['off', 'OFF'], ['tv', 'TV'], ['gm', 'HERE'], ['both', 'BOTH']];

/** Browser fallback for SPEAK when there is no voice server. */
function browserSay(text, rate) {
  const s = typeof window !== 'undefined' && window.speechSynthesis;
  if (!s) return false;
  s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = Math.max(0.5, Math.min(1.5, rate || 1));
  s.speak(u);
  return true;
}

export default function NarrateDrawer({ onToggleTheatre, focusInput = false }) {
  const { narrate, narrateClear, table, sessionLog, ttsStatus, refreshTts, speak, speakStop, voiceLive, onSpeakDone, connected } = useGame();
  const [target, setTarget] = useVoiceTarget();
  const prefs = useVoicePrefs();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [checking, setChecking] = useState(false);
  // A voice that fails mid-way reports on table-speak-done (the ack only covers the start).
  useEffect(() => {
    if (!connected || typeof onSpeakDone !== 'function') return undefined;
    return onSpeakDone((e) => { if (e?.error) setErr(`Voice: ${e.error}`); });
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps
  const narration = table?.narration;
  const theatre = table?.boardMode === 'theatre';
  const recent = useMemo(() => [...(sessionLog || [])].reverse().filter((e) => e.type === 'narration').slice(0, 12), [sessionLog]);
  const server = !!ttsStatus?.ok;
  const voiceOn = target !== 'off';

  /* Voice list: the universe default first, then English voices, then the rest. */
  const voices = useMemo(() => {
    const list = ttsStatus?.voices || [];
    const rank = (v) => (v.id === prefs.narrator ? 0 : /^en/.test(v.lang || '') ? 1 : 2);
    const sorted = [...list].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
    if (prefs.voice && !sorted.some((v) => v.id === prefs.voice)) sorted.unshift({ id: prefs.voice, name: prefs.voice });
    return sorted;
  }, [ttsStatus, prefs.narrator, prefs.voice]);

  const voiceOpts = { voice: prefs.voice, speed: prefs.speed, target: voiceOn ? target : 'tv' };
  const ackErr = (r) => { if (r?.error) setErr(r.error); else if (r?.speech?.error) setErr(`Caption sent — voice: ${r.speech.error}`); else setErr(''); };

  const send = (mode) => {
    const t = text.trim();
    if (!t) return;
    setErr('');
    if (voiceOn && server) {
      setBusy(true);
      narrate(t, { mode, speak: true, ...voiceOpts }, (r) => { setBusy(false); ackErr(r); });
    } else {
      narrate(t, { mode }, ackErr);
      if (voiceOn && (target === 'gm' || target === 'both')) browserSay(t, prefs.speed);
    }
    setText('');
  };
  const speakNow = () => {
    const t = text.trim();
    if (!t) return;
    setErr('');
    if (server) {
      setBusy(true);
      speak(t, voiceOpts, (r) => { setBusy(false); ackErr(r); });
    } else if (!browserSay(t, prefs.speed)) setErr('No voice available in this browser.');
  };
  const stopVoice = () => {
    speakStop?.();
    try { window.speechSynthesis?.cancel(); } catch { /* none */ }
  };
  const recheck = () => { setChecking(true); Promise.resolve(refreshTts?.()).finally(() => setChecking(false)); };
  const speedPct = (v) => `${Math.round(v * 100)}%`;
  const voiceName = voices.find((v) => v.id === prefs.voice)?.name || prefs.voice;

  return (
    <div className="nd">
      <form onSubmit={(e) => { e.preventDefault(); send('caption'); }}>
        <label className="fs-label" htmlFor="nd-text">NARRATE TO TABLE</label>
        <textarea id="nd-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} data-autofocus={focusInput ? '' : undefined}
          placeholder="Type a line for the TV and phones…"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send('caption'); } }} />
        <div className="nd-btns nd-btns3">
          <button type="submit" className="fs-btn primary" disabled={!text.trim() || busy} title={voiceOn && server ? 'Caption + voice' : undefined}>{voiceOn && server ? <span aria-hidden="true">◉ </span> : null}SEND CAPTION</button>
          <button type="button" className="fs-btn" disabled={!text.trim() || busy} onClick={() => send('card')} title={voiceOn && server ? 'Card + voice' : undefined}>{voiceOn && server ? <span aria-hidden="true">◉ </span> : null}SEND AS CARD</button>
          <button type="button" className="fs-btn nd-speak" disabled={!text.trim() || busy} onClick={speakNow}
            title={server ? `Speak only (no caption) — ${voiceOn ? TARGETS.find(([k]) => k === target)[1] : 'TV'}` : 'Speak here with the browser voice'}>
            <span aria-hidden="true">◉ </span>{busy ? 'VOICING…' : server ? 'SPEAK ONLY (NO CAPTION)' : 'SPEAK HERE (BROWSER VOICE)'}
          </button>
        </div>
        <p className="nd-hint">CAPTION runs along the bottom of the TV; CARD fills the screen. Ctrl+Enter sends a caption.{voiceOn && server ? ' ◉ = VOICE is on: sending also speaks it.' : ''}</p>
        {err && <p className="nd-err" role="alert">{err}</p>}
      </form>

      <div className="nd-voice">
        <div className="md-row">
          <span className="fs-label">VOICE</span>
          {(voiceLive || busy) && <button type="button" className="run-btn warn" onClick={stopVoice}>■ STOP VOICE</button>}
        </div>
        <div className="run-seg nd-seg nd-vseg" role="group" aria-label="Voice output">
          {TARGETS.map(([k, label]) => (
            <button key={k} type="button" className={target === k ? 'on' : ''} aria-pressed={target === k} onClick={() => setTarget(k)}>{label}</button>
          ))}
        </div>
        <div className="nd-vrow">
          <label className="nd-vpick">
            <span>VOICE</span>
            <select value={prefs.voice || ''} disabled={!server} onChange={(e) => prefs.setVoice(e.target.value)}>
              {!server && <option value={prefs.voice || ''}>{prefs.voice || 'browser'}</option>}
              {server && voices.map((v) => (
                <option key={v.id} value={v.id}>{v.name || v.id}{v.grade ? ` (${v.grade})` : ''}{v.id === prefs.narrator ? ' ★ DEFAULT' : ''}</option>
              ))}
            </select>
          </label>
          <label className="nd-vspeed">
            <span>SPEED {speedPct(prefs.speed)}</span>
            <input type="range" min={SPEED_RANGE[0]} max={SPEED_RANGE[1]} step="0.02" value={prefs.speed}
              onChange={(e) => prefs.setSpeed(Number(e.target.value))} aria-label="Voice speed" />
          </label>
        </div>
        <p className={`nd-vstatus${server ? ' ok' : ''}`}>
          {ttsStatus == null ? 'VOICE: checking…'
            : server ? <>VOICE: {ttsStatus.provider} · {voiceName}</>
              : <>NO VOICE SERVER — using the browser voice; set TTS_URL in web app/.env</>}
          <button type="button" className="run-btn sm" onClick={recheck} disabled={checking} aria-label="Re-check the voice server">{checking ? '…' : '↻'}</button>
        </p>
      </div>

      <div className="fs-label">ON THE TABLE NOW</div>
      {narration ? (
        <div className="nd-now">
          <p>{narration.title ? <b>{narration.title}: </b> : null}{narration.text}</p>
          <button type="button" className="run-btn warn" onClick={() => narrateClear()}>CLEAR TABLE TEXT</button>
        </div>
      ) : <p className="run-empty">Nothing — the TV shows the board.</p>}

      <div className="fs-label">TV SHOWS</div>
      <div className="run-seg nd-seg" role="group" aria-label="Board mode">
        <button type="button" className={!theatre ? 'on' : ''} aria-pressed={!theatre} onClick={() => theatre && onToggleTheatre()}>MAP</button>
        <button type="button" className={theatre ? 'on' : ''} aria-pressed={theatre} onClick={() => !theatre && onToggleTheatre()}>THEATRE</button>
      </div>

      <div className="fs-label">RECENT</div>
      {recent.length === 0 ? <p className="run-empty">No narration sent yet.</p> : (
        <ol className="nd-recent">
          {recent.map((e) => (
            <li key={e.id}>
              <time>{fmtTime(e.at)}</time>
              <span>{e.text}</span>
              <button type="button" className="run-btn sm" onClick={() => setText(e.text.replace(/^Voice:\s/, '').replace(/^[^:]{1,120}:\s/, ''))} aria-label={`Use again: ${e.text.slice(0, 60)}`}>USE</button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
