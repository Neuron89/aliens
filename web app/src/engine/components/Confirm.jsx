import React, { useEffect, useId, useRef, useState } from 'react';

/* ═══════════════════════════════════════════════════════════════
   Themed inline confirm (replaces window.confirm for consequential
   actions: ADVANCE ACT, END SESSION, the phone's DISCONNECT).
   Renders its own trigger button; the first tap arms an inline card
   (title, message, CONFIRM / CANCEL) anchored to the trigger. Escape,
   CANCEL or a tap outside disarms it. Styling: index.css "Confirm".

   Props:
     label         trigger button content
     title         card heading (default: the label)
     message       body (string or node)
     confirmLabel  default 'CONFIRM'; cancelLabel default 'CANCEL'
     onConfirm()   called once on CONFIRM
     danger        red confirm button
     block         card flows below the trigger (phones / narrow panes)
                   instead of floating over the layout
     align         'right' (default) | 'left' — floating card edge
     className / style / disabled / title attrs apply to the trigger
   ═══════════════════════════════════════════════════════════════ */
export default function Confirm({
  label, title, message, confirmLabel = 'CONFIRM', cancelLabel = 'CANCEL', onConfirm,
  danger = false, block = false, align = 'right', className = '', style, disabled = false, tip,
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const confirmRef = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    requestAnimationFrame(() => confirmRef.current?.focus());
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [open]);

  return (
    <span ref={wrap} className={`confirm-wrap${block ? ' block' : ''}${open ? ' open' : ''}`}>
      <button type="button" className={className} style={style} disabled={disabled} title={tip}
        aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen((o) => !o)}>
        {label}
      </button>
      {open && (
        <span id={id} className={`confirm-card${danger ? ' danger' : ''}${block ? '' : ` float ${align}`}`} role="alertdialog"
          aria-label={typeof (title || label) === 'string' ? (title || label) : 'Confirm'}>
          <b className="confirm-title">{title || label}</b>
          {message && <span className="confirm-msg">{message}</span>}
          <span className="confirm-btns">
            <button type="button" className="confirm-cancel" onClick={() => setOpen(false)}>{cancelLabel}</button>
            <button type="button" ref={confirmRef} className="confirm-ok" onClick={() => { setOpen(false); onConfirm?.(); }}>{confirmLabel}</button>
          </span>
        </span>
      )}
    </span>
  );
}
