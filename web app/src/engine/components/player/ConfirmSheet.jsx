import React from 'react';
import { useDialog } from './useDialog';

/* Bottom-sheet confirm for the phone's quick actions (+STRESS, SPEND
   DETERMINATION…): big thumb targets, Escape / tap outside cancels. */
export default function ConfirmSheet({ title, children, confirmLabel = 'CONFIRM', cancelLabel = 'CANCEL', tone = 'primary', onConfirm, onClose }) {
  const ref = useDialog(onClose);
  return (
    <div className="pp-scrim" onClick={onClose}>
      <div ref={ref} className="pp-sheet" role="dialog" aria-modal="true" aria-labelledby="pp-confirm-title" onClick={(e) => e.stopPropagation()}>
        <div className="pp-sheet-grip" aria-hidden="true" />
        <h2 id="pp-confirm-title" className="pp-sheet-title">{title}</h2>
        {children && <div className="pp-sheet-body">{children}</div>}
        <div className="pp-sheet-btns">
          <button type="button" className="pp-btn" onClick={onClose}>{cancelLabel}</button>
          <button type="button" className={`pp-btn ${tone}`} data-autofocus onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
