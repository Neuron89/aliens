import React, { useEffect, useRef } from 'react';
import Icon from './icons';

/* ═══════════════════════════════════════════════════════════════
   Slide-over drawer for the GM shell (Focus Stage dock, scene list).
   role="dialog", no backdrop (the stage stays readable and usable),
   focus moves into the drawer when it opens and returns to the
   element that opened it (`returnFocus`, else the previously focused
   element) when it closes. Escape closes it unless an inline Confirm
   card is open (that Escape belongs to the Confirm).
   side: 'right' (dock drawers, 400px) | 'left' (scene list, 280px).
   ═══════════════════════════════════════════════════════════════ */
export default function Drawer({ id, title, side = 'right', onClose, returnFocus, headExtra, children, className = '', label }) {
  const ref = useRef(null);
  const opener = useRef(null);
  useEffect(() => {
    opener.current = returnFocus?.current || document.activeElement;
    const el = ref.current;
    /* Focus moves in: an element marked data-autofocus (e.g. the narrate box), else the drawer itself. */
    const t = setTimeout(() => {
      if (!el) return;
      const want = el.querySelector('[data-autofocus]');
      if (want) want.focus({ preventScroll: true });
      else if (!el.contains(document.activeElement)) el.focus({ preventScroll: true });
    }, 30);
    return () => {
      clearTimeout(t);
      const back = opener.current;
      if (back && typeof back.focus === 'function' && document.contains(back)) back.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('.confirm-card')) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <aside ref={ref} id={id} className={`dr dr-${side} ${className}`} role="dialog" aria-modal="false" aria-label={label || (typeof title === 'string' ? title : undefined)} tabIndex={-1}>
      <header className="dr-head">
        <h2 className="dr-title">{title}</h2>
        {headExtra}
        <button type="button" className="dr-x" onClick={onClose} aria-label={`Close ${label || (typeof title === 'string' ? title.toLowerCase() : 'drawer')}`}>
          <Icon name="close" size={18} />
        </button>
      </header>
      <div className="dr-body">{children}</div>
    </aside>
  );
}

/** Close a popover on outside pointerdown / Escape. */
export function useDismiss(ref, open, close) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [ref, open, close]);
}
