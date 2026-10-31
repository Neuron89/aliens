import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../../GameContext';
import { useUniverse } from '../../UniverseContext';
import { getCatalog, itemById } from '../../catalogUtils';
import { ItemArt } from '../sheet/parts';
import HandoutViewer from './HandoutViewer';
import VisionOverlay from '../board/VisionOverlay'; // F6: private vision flash

/* ═══════════════════════════════════════════════════════════════
   Phone overlay layer (PlayerView). One-shot session effects:
   - BEFORE WE BEGIN (session zero) — until confirmed
   - incoming handout (sealed card → tap to open; opening = seen receipt)
   - NEW ORDERS (act agenda) themed reveal
   - clue found / item received toasts (with catalog art)
   - narration sheet (dismissible) for the GM's read-aloud
   - clock tick → sound + pulse (handled via onClockTick)
   Sounds respect the phone's mute toggle (fx.play).
   ═══════════════════════════════════════════════════════════════ */
export default function PhoneLayer({ fx, viewer, setViewer, order, setOrder, onClockTick, onReply }) {
  const { table, on, handoutSeen, safetyConfirm } = useGame();
  const { universe } = useUniverse();
  const [incoming, setIncoming] = useState([]);   // sealed handouts
  const [toasts, setToasts] = useState([]);       // { id, kind, title, text, item? }
  const [dismissedNarration, setDismissedNarration] = useState(() => table?.narration?.id || null);
  const firstNarration = useRef(true);
  const play = fx.play;

  const toast = (t) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 6500);
  };

  useEffect(() => {
    const offs = [
      on('handout-received', ({ handout } = {}) => {
        if (!handout) return;
        setIncoming((prev) => [...prev.filter((h) => h.id !== handout.id), handout]);
        play('handout');
      }),
      on('new-orders', (o) => { if (o?.text) { setOrder({ ...o, fresh: true }); play('orders'); } }),
      on('clue-revealed', ({ clue } = {}) => {
        if (!clue) return;
        toast({ kind: 'clue', title: 'CLUE FOUND', text: clue.text, sub: clue.foundBy?.length ? `found by ${clue.foundBy.join(', ')}` : clue.source });
        play('clue');
      }),
      on('item-received', ({ item } = {}) => {
        if (!item) return;
        const it = itemById(getCatalog(universe), item);
        toast({ kind: 'loot', title: 'ITEM RECEIVED', text: it?.name || item, item: it || { name: item } });
        play('loot');
      }),
      on('clock-ticked', ({ clock, delta } = {}) => {
        if (!clock) return;
        onClockTick?.(clock.id);
        if (delta > 0) play('tick');
      }),
    ];
    return () => offs.forEach((f) => f());
  }, [on, play, universe, setOrder, onClockTick]);

  /* Narration: show new ones; the one present at load counts as already seen. */
  const n = table?.narration;
  useEffect(() => {
    if (firstNarration.current) { firstNarration.current = false; return; }
    if (n?.id) play('seen', { vibrate: false });
  }, [n?.id, play]);
  const showNarration = n && n.id !== dismissedNarration && (n.text || n.title);

  const safety = table?.safety;
  const needsSafety = safety?.enabled && !safety.confirmed;

  return (
    <>
      {needsSafety && (
        <div className="ph-overlay ph-s0" role="dialog" aria-modal="true" aria-labelledby="ph-s0-title">
          <div className="ph-card">
            <h2 id="ph-s0-title" className="ph-card-title">BEFORE WE BEGIN</h2>
            {safety.tone?.length > 0 && (
              <div className="ph-s0-tone">{safety.tone.map((t) => <span key={t} className="pv-chip">{t}</span>)}</div>
            )}
            {safety.warnings?.length > 0 && (
              <>
                <label className="pv-label">THIS GAME MAY INCLUDE</label>
                <ul className="ph-s0-list">{safety.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              </>
            )}
            {safety.linesVeils && (
              <>
                <label className="pv-label">LINES &amp; VEILS</label>
                <p className="ph-s0-lv">{safety.linesVeils}</p>
              </>
            )}
            <p className="ph-s0-note">
              The <b>PAUSE</b> button at the top of your screen is always there. Tap it any time — no reason needed,
              and nobody is told who pressed it.
            </p>
            <button type="button" className="pv-btn primary ph-wide" onClick={() => safetyConfirm()}>I&apos;M READY</button>
          </div>
        </div>
      )}

      {!needsSafety && order && (
        <div className="ph-overlay ph-orders-wrap" onClick={() => setOrder(null)} role="dialog" aria-modal="true" aria-label="New orders">
          <div className={`ph-orders${order.fresh ? ' fresh' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="ph-orders-band">{order.fresh ? 'NEW ORDERS' : 'ORDERS'}</div>
            <div className="ph-orders-act">{order.actTitle}</div>
            <p className="ph-orders-text">{order.text}</p>
            <div className="ph-orders-foot">PRIVATE — FOR YOUR EYES ONLY</div>
            <button type="button" className="pv-btn primary ph-wide" onClick={() => setOrder(null)}>ACKNOWLEDGE</button>
          </div>
        </div>
      )}

      {!needsSafety && !order && !viewer && incoming.length > 0 && (
        <div className="ph-overlay" role="dialog" aria-modal="true" aria-label="Incoming handout">
          <button type="button" className="ph-sealed" onClick={() => { const h = incoming[0]; setIncoming((p) => p.slice(1)); setViewer(h); }}>
            <span className="ph-sealed-glyph" aria-hidden="true">✉</span>
            <span className="ph-sealed-k">INCOMING</span>
            <span className="ph-sealed-title">{incoming[0].title}</span>
            {incoming[0].from && <span className="ph-sealed-from">FROM {incoming[0].from}</span>}
            <span className="ph-sealed-tap">TAP TO OPEN</span>
          </button>
          <button type="button" className="ph-later" onClick={() => setIncoming((p) => p.slice(1))}>LATER</button>
        </div>
      )}

      {viewer && <HandoutViewer handout={viewer} onClose={() => setViewer(null)} onSeen={handoutSeen} />}

      {showNarration && !needsSafety && !order && !viewer && incoming.length === 0 && (
        <div className="ph-sheet" role="dialog" aria-label="Narration">
          <div className="ph-sheet-grip" aria-hidden="true" />
          {n.title && <div className="ph-sheet-title">{n.title}</div>}
          <p className="ph-sheet-text">{n.text}</p>
          <div className="ph-sheet-btns">
            {onReply && <button type="button" className="pv-btn" onClick={() => { setDismissedNarration(n.id); onReply(); }}>REPLY PRIVATELY</button>}
            <button type="button" className="pv-btn primary" onClick={() => setDismissedNarration(n.id)}>DISMISS</button>
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="ph-toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`ph-toast ${t.kind}`} onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}>
              {t.item ? <ItemArt item={t.item} size={48} /> : <span className="ph-toast-glyph" aria-hidden="true">{t.kind === 'clue' ? '◎' : '◆'}</span>}
              <div>
                <div className="ph-toast-title">{t.title}</div>
                <div className="ph-toast-text">{t.text}</div>
                {t.sub && <div className="ph-toast-sub">{t.sub}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <VisionOverlay variant="phone" fx={fx} />{/* F6 */}
    </>
  );
}
