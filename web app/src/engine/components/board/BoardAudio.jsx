import { useEffect, useRef, useState } from 'react';
import { useAmbientAudio } from '../../hooks/useAmbientAudio';
import { voiceDuck } from '../../hooks/useTTS';
import { ambientPreset } from '../../mechanicsUtils';
import { useGame } from '../../GameContext';
import { playStinger, audioCtx, unlockAudio, onAudioState } from '../../soundboard';
import '../soundboard.css';

/* ═══════════════════════════════════════════════════════════════
   TV audio — mounted by BoardView only with ?board=CODE&audio=1
   (contract: <BoardAudio ambient={table?.ambient} />).
   - ambience follows table.ambient: a preset id set by the GM's AUDIO
     popover (run-set { ambient }) or a scene mood alias (mechanicsUtils)
   - stingers: `table-sfx { cue, seed }` from the GM soundboard, played
     with the server's seed (every TV/phone hears the same variant)
   - voice (GM narrate-speak, server TTS, progressive): `table-speak { id, title, total, … }`
     opens a speech, `table-speak-part { id, index, url, ms }` adds a sentence clip as soon
     as the server has it, `table-speak-done { id, count }` closes it. Speeches queue; clips
     play back to back (~120 ms gap) through one <audio> element routed into the shared
     AudioContext (so the SOUND unlock covers it); ambience stays ducked until the last
     clip of the queue ends; `table-speak-stop` cuts it and clears the queue
   - browsers block audio until the screen is touched once: while the
     shared AudioContext is not running, a SOUND button asks for a tap.
   ═══════════════════════════════════════════════════════════════ */

const MAX_QUEUE = 8;
const GAP_MS = 120;      // between sentence clips
const STALL_MS = 30000;  // a speech with no new part for this long is dropped

/** table.ambient → preset id: an exact preset id first, then the scene-mood aliases; unknown → null. */
export function resolveAmbient(ambient, presets) {
  if (!ambient) return 'off';
  if (Object.prototype.hasOwnProperty.call(presets, ambient)) return ambient;
  return ambientPreset(ambient, presets);
}

/** One <audio> element wired into the shared context (createMediaElementSource works once per element). */
function voiceElement(ref) {
  if (ref.current) return ref.current.el;
  if (typeof Audio === 'undefined') return null;
  const el = new Audio();
  el.preload = 'auto';
  let routed = false;
  const ac = audioCtx();
  if (ac) {
    try {
      const src = ac.createMediaElementSource(el);
      const gain = ac.createGain();
      gain.gain.value = 1;
      src.connect(gain);
      gain.connect(ac.destination); // straight out: the voice is never ducked under itself
      routed = true;
    } catch { routed = false; }
  }
  ref.current = { el, routed };
  return el;
}

export default function BoardAudio({ ambient }) {
  const audio = useAmbientAudio();
  const { applyPreset, presets, preset } = audio;
  const { connected, onSfx, onSpeak, onSpeakPart, onSpeakDone, onSpeakStop } = useGame();
  const [locked, setLocked] = useState(() => audioCtx()?.state !== 'running');
  const [speaking, setSpeaking] = useState(null); // { id, title } while a voice plays
  const voiceRef = useRef(null);
  const queueRef = useRef([]);      // [{ id, title, parts:[{ url, ms }] by index, next, done, count, lastAt }]
  const duckRef = useRef(false);
  const skipTimer = useRef(null);

  useEffect(() => {
    const id = resolveAmbient(ambient, presets);
    if (id && id !== preset) applyPreset(id);
  }, [ambient]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!connected || typeof onSfx !== 'function') return undefined;
    return onSfx((e) => { if (e?.cue) playStinger(e.cue, { seed: e.seed }); });
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── voice queue: speeches in arrival order; each plays its parts back to back (~120 ms gap)
        as they arrive, and is finished once table-speak-done came and every part has played ── */
  useEffect(() => {
    if (!connected || typeof onSpeak !== 'function') return undefined;
    const duck = (on) => { if (duckRef.current !== on) { duckRef.current = on; voiceDuck(on); } };
    let playing = false;
    const pump = () => {
      if (playing) return;
      clearTimeout(skipTimer.current);
      const cur = queueRef.current[0];
      if (!cur) { setSpeaking(null); duck(false); return; }
      setSpeaking((s) => (s?.id === cur.id ? s : { id: cur.id, title: cur.title }));
      duck(true);
      const part = cur.parts[cur.next];
      if (part) {
        cur.next++;
        cur.lastAt = Date.now();
        const el = voiceElement(voiceRef);
        playing = true;
        const advance = () => {
          if (!playing) return;
          playing = false;
          clearTimeout(skipTimer.current);
          if (el) { el.onended = null; el.onerror = null; }
          skipTimer.current = setTimeout(pump, GAP_MS);
        };
        if (!el) { skipTimer.current = setTimeout(advance, Math.max(300, part.ms || 1000)); return; }
        el.onended = advance;
        el.onerror = advance;
        el.src = part.url;
        const ac = audioCtx();
        if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
        // Blocked until the TV is touched: let the clip's time pass so the queue never wedges.
        el.play().catch(() => { skipTimer.current = setTimeout(advance, Math.max(300, part.ms || 1000)); });
        return;
      }
      if (cur.done && cur.next >= (cur.count ?? cur.parts.length)) { queueRef.current.shift(); pump(); return; }
      // Waiting for the next part; a speech that stalls (server gone) is dropped after STALL_MS.
      skipTimer.current = setTimeout(() => {
        if (queueRef.current[0] === cur && Date.now() - cur.lastAt >= STALL_MS) queueRef.current.shift();
        pump();
      }, STALL_MS);
    };
    const find = (id) => queueRef.current.find((s) => s.id === id);
    const stopAll = () => {
      clearTimeout(skipTimer.current);
      queueRef.current = [];
      playing = false;
      const el = voiceRef.current?.el;
      if (el) { el.onended = null; el.onerror = null; el.pause(); el.removeAttribute('src'); try { el.load(); } catch { /* ignore */ } }
      setSpeaking(null);
      duck(false);
    };
    const offStart = onSpeak((e) => {
      if (!e?.id || e.target === 'gm' || find(e.id)) return;
      queueRef.current = [...queueRef.current, { id: e.id, title: e.title || '', parts: [], next: 0, done: false, count: null, lastAt: Date.now() }].slice(-MAX_QUEUE);
      pump();
    });
    const offPart = typeof onSpeakPart === 'function' ? onSpeakPart((e) => {
      const s = find(e?.id);
      if (!s || typeof e.url !== 'string' || !e.url.startsWith('/api/tts/audio/') || !Number.isInteger(e.index) || e.index < 0 || e.index > 500) return;
      s.parts[e.index] = { url: e.url, ms: Number(e.ms) || 0 };
      s.lastAt = Date.now();
      pump();
    }) : () => {};
    const offDone = typeof onSpeakDone === 'function' ? onSpeakDone((e) => {
      const s = find(e?.id);
      if (!s) return;
      s.done = true;
      s.count = Number.isInteger(e.count) ? e.count : s.parts.length;
      pump();
    }) : () => {};
    const offStop = typeof onSpeakStop === 'function' ? onSpeakStop(stopAll) : () => {};
    return () => { offStart(); offPart(); offDone(); offStop(); stopAll(); };
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ac = audioCtx();
    if (!ac) return undefined;
    setLocked(ac.state !== 'running');
    const off = onAudioState((s) => setLocked(s !== 'running'));
    // Any touch/key on the TV unlocks audio (kiosk browsers may never need the button).
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => { off(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);

  const showUnlock = locked && !!audioCtx();
  if (!showUnlock && !speaking) return null;
  return (
    <>
      {speaking && (
        <div className="tv-voice" role="status" aria-live="polite">
          <span className="tv-voice-bars" aria-hidden="true"><i /><i /><i /></span>
          VOICE{speaking.title ? <b> · {speaking.title}</b> : null}
        </div>
      )}
      {showUnlock && (
        <button type="button" className="sb-tv-unlock" onClick={() => unlockAudio()}>
          <span aria-hidden="true">♪</span> TAP FOR SOUND
        </button>
      )}
    </>
  );
}
