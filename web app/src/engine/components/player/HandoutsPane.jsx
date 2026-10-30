import React from 'react';

/* Phone HANDOUTS tab: agenda orders (per act), handouts (re-openable), clues found. */
export default function HandoutsPane({ table, onOpen, onOpenOrder }) {
  const handouts = [...(table?.handouts || [])].sort((a, b) => b.sentAt - a.sentAt);
  const clues = [...(table?.clues || [])].sort((a, b) => b.revealedAt - a.revealedAt);
  const orders = [...(table?.orders || [])].sort((a, b) => b.actIndex - a.actIndex);
  return (
    <div className="pv-pane">
      {orders.length > 0 && (
        <section className="panel">
          <label className="pv-label">ORDERS</label>
          {orders.map((o) => (
            <button key={o.actIndex} type="button" className="ph-row" onClick={() => onOpenOrder(o)}>
              <span className="ph-row-mark orders" aria-hidden="true">◆</span>
              <span className="ph-row-body"><b>{o.actTitle}</b><small>{o.text.slice(0, 70)}{o.text.length > 70 ? '…' : ''}</small></span>
            </button>
          ))}
        </section>
      )}
      <section className="panel">
        <label className="pv-label">HANDOUTS</label>
        {handouts.length === 0 && <p className="pv-text dim">Nothing received yet.</p>}
        {handouts.map((h) => (
          <button key={h.id} type="button" className={`ph-row${h.seen ? '' : ' unseen'}`} onClick={() => onOpen(h)}>
            <span className="ph-row-mark" aria-hidden="true">{h.seen ? '▤' : '✉'}</span>
            <span className="ph-row-body"><b>{h.title}</b><small>{h.from || ''}{h.seen ? '' : ' · NEW'}</small></span>
          </button>
        ))}
      </section>
      <section className="panel">
        <label className="pv-label">CLUES</label>
        {clues.length === 0 && <p className="pv-text dim">No clues yet.</p>}
        {clues.map((c) => (
          <div key={c.id} className="ph-clue">
            <p>{c.text}</p>
            <small>{c.source ? `${c.source}` : ''}{c.source && c.foundBy?.length ? ' · ' : ''}{c.foundBy?.length ? `found by ${c.foundBy.join(', ')}` : ''}</small>
          </div>
        ))}
      </section>
    </div>
  );
}
