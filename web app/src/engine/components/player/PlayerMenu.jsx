import React from 'react';
import { useUniverse } from '../../UniverseContext';
import Confirm from '../Confirm';
import Icon from './icons';
import { useDialog } from './useDialog';

/* ≡ MENU drawer (phone header): new / replacement character, this device's
   alert sound + interface sound + REDUCE FX, and DISCONNECT. role="dialog",
   focus moves in and returns to ≡, Escape or the scrim closes it. */
export default function PlayerMenu({
  onClose, onBuild, buildLabel, subStatus, alertsMuted, setAlertsMuted, onLeave, sessionLabel, gameCode, playerName,
}) {
  const { universe, fx } = useUniverse();
  const { terms } = universe;
  const ref = useDialog(onClose);
  return (
    <div className="pp-scrim pp-scrim-side" onClick={onClose}>
      <aside ref={ref} className="pp-drawer" role="dialog" aria-modal="true" aria-labelledby="pp-menu-title" onClick={(e) => e.stopPropagation()}>
        <div className="pp-drawer-head">
          <h2 id="pp-menu-title" className="pp-drawer-title">MENU</h2>
          <button type="button" className="pp-iconbtn" aria-label="Close menu" onClick={onClose}><Icon name="close" /></button>
        </div>
        <p className="pp-drawer-meta">{playerName} · {sessionLabel} {gameCode}</p>

        <section className="pp-drawer-sec">
          <span className="pp-k">CHARACTER</span>
          <button type="button" className="pp-btn primary pp-wide" onClick={() => { onClose(); onBuild(); }}>{buildLabel}</button>
          <p className="pp-hint">A replacement goes to the {terms.gm}, who swaps it in when the story allows.</p>
          {subStatus}
        </section>

        <section className="pp-drawer-sec">
          <span className="pp-k">THIS DEVICE</span>
          <button type="button" className="pp-toggle" aria-pressed={!alertsMuted} onClick={() => setAlertsMuted((m) => !m)}>
            <span>ALERT SOUNDS &amp; VIBRATION</span><b>{alertsMuted ? 'OFF' : 'ON'}</b>
          </button>
          {fx && (
            <>
              <button type="button" className="pp-toggle" aria-pressed={!fx.muted} onClick={() => fx.setMuted(!fx.muted)}>
                <span>INTERFACE SOUNDS</span><b>{fx.muted ? 'OFF' : 'ON'}</b>
              </button>
              <button type="button" className="pp-toggle" aria-pressed={!!fx.reduced} onClick={() => fx.setReduced(!fx.reduced)}>
                <span>REDUCE FX</span><b>{fx.reduced ? 'ON' : 'OFF'}</b>
              </button>
            </>
          )}
        </section>

        <section className="pp-drawer-sec pp-drawer-foot">
          <Confirm block danger label={`DISCONNECT FROM ${String(terms.session).toUpperCase()}`} className="pp-btn danger pp-wide" title="DISCONNECT?"
            message={`Returning to this seat later needs the ${terms.gm}'s approval.`} confirmLabel="DISCONNECT" cancelLabel="STAY" onConfirm={onLeave} />
        </section>
      </aside>
    </div>
  );
}
