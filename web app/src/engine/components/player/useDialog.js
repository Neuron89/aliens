import { useEffect, useRef } from 'react';

/* Dialog focus contract for the phone's sheets and drawers: focus moves into
   the dialog (first [data-autofocus] or first focusable), Escape closes, and
   focus returns to whatever opened it when the dialog unmounts. */
export function useDialog(onClose) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement;
    const el = ref.current;
    const first = el?.querySelector('[data-autofocus]')
      || el?.querySelector('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const t = setTimeout(() => first?.focus?.(), 0);
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeRef.current?.(); } };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
    };
  }, []);
  return ref;
}
