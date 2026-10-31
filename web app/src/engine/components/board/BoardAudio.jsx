import { useEffect, useState } from 'react';
import { useAmbientAudio } from '../../hooks/useAmbientAudio';
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
   - browsers block audio until the screen is touched once: while the
     shared AudioContext is not running, a SOUND button asks for a tap.
   ═══════════════════════════════════════════════════════════════ */

/** table.ambient → preset id: an exact preset id first, then the scene-mood aliases; unknown → null. */
export function resolveAmbient(ambient, presets) {
  if (!ambient) return 'off';
  if (Object.prototype.hasOwnProperty.call(presets, ambient)) return ambient;
  return ambientPreset(ambient, presets);
}

export default function BoardAudio({ ambient }) {
  const audio = useAmbientAudio();
  const { applyPreset, presets, preset } = audio;
  const { connected, onSfx } = useGame();
  const [locked, setLocked] = useState(() => audioCtx()?.state !== 'running');

  useEffect(() => {
    const id = resolveAmbient(ambient, presets);
    if (id && id !== preset) applyPreset(id);
  }, [ambient]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!connected || typeof onSfx !== 'function') return undefined;
    return onSfx((e) => { if (e?.cue) playStinger(e.cue, { seed: e.seed }); });
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

  if (!locked || !audioCtx()) return null;
  return (
    <button type="button" className="sb-tv-unlock" onClick={() => unlockAudio()}>
      <span aria-hidden="true">♪</span> TAP FOR SOUND
    </button>
  );
}
