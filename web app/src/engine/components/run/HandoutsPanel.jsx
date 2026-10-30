import React, { useState } from 'react';
import { useGame } from '../../GameContext';
import TargetPicker, { toTarget } from './TargetPicker';

/* Push pack handouts (and custom ones) to phones; shows per-handout receipts
   ("SEEN 3/4") from table.handouts[].seenBy. Handouts with an image can be
   shown full-bleed on the TV (narrate mode 'card'). */
export default function HandoutsPanel({ handouts = [], terms }) {
  const { table, players, sendHandout, narrate } = useGame();
  const [targets, setTargets] = useState({});
  const [open, setOpen] = useState(null);
  const [custom, setCustom] = useState(null); // { title, from, text, image } | null
  const [customTo, setCustomTo] = useState([]);
  const sent = table?.handouts || [];
  const playerCount = Object.keys(players || {}).length;
  const nameOf = (id) => players?.[id]?.character?.name || players?.[id]?.name || '?';

  const receipt = (id) => {
    const h = sent.find((x) => x.id === id);
    if (!h) return null;
    const total = h.recipients === 'all' ? playerCount : (h.recipients || []).length;
    return { seen: h.seenBy.length, total, names: h.seenBy.map(nameOf), all: h.recipients === 'all' };
  };

  const push = (h) => sendHandout({
    handoutId: h.id,
    handout: { title: h.title, from: h.from, to: h.to, priority: h.priority, text: h.text, image: h.image },
  }, toTarget(targets[h.id]));

  const toTv = (h) => narrate(h.text?.slice(0, 600) || '', { title: h.title, mode: 'card', art: h.image });

  const customSent = sent.filter((h) => h.custom);
  const rows = [...handouts.map((h) => ({ ...h, pack: true })), ...customSent.filter((c) => !handouts.some((h) => h.id === c.id))];

  return (
    <div className="run-handouts">
      {rows.length === 0 && <p className="run-empty">This pack has no handouts. Write one below.</p>}
      {rows.map((h) => {
        const r = receipt(h.id);
        const isOpen = open === h.id;
        return (
          <div key={h.id} className={`run-item${r ? ' sent' : ''}`}>
            <button type="button" className="run-item-head" onClick={() => setOpen(isOpen ? null : h.id)} aria-expanded={isOpen}>
              <span className="run-item-title">{h.title}</span>
              {r ? (
                <span className={`run-receipt${r.seen === r.total && r.total > 0 ? ' all' : ''}`} title={r.names.length ? `Seen by ${r.names.join(', ')}` : 'Not opened yet'}>
                  SEEN {r.seen}/{r.total}
                </span>
              ) : <span className="run-receipt none">NOT SENT</span>}
            </button>
            {h.when && <div className="run-item-when">WHEN: {h.when}</div>}
            {isOpen && <p className="run-item-text">{h.text}</p>}
            {isOpen && h.image && <img className="run-item-img" src={h.image} alt="" />}
            <TargetPicker players={players} value={targets[h.id] || []} onChange={(v) => setTargets((t) => ({ ...t, [h.id]: v }))} />
            <div className="run-row">
              <button type="button" className="run-btn primary sm" onClick={() => push(h)} disabled={!playerCount}>{r ? 'SEND AGAIN' : 'PUSH TO PHONES'}</button>
              {h.image && <button type="button" className="run-btn sm" onClick={() => toTv(h)}>SHOW ON TV</button>}
              {r && r.names.length > 0 && <span className="run-dim">✓ {r.names.join(', ')}</span>}
            </div>
          </div>
        );
      })}

      {custom ? (
        <form className="run-form" onSubmit={(e) => {
          e.preventDefault();
          if (!custom.title.trim() || (!custom.text.trim() && !custom.image.trim())) return;
          sendHandout({ custom: { ...custom, title: custom.title.trim().toUpperCase(), image: custom.image.trim() || undefined } }, toTarget(customTo));
          setCustom(null);
          setCustomTo([]);
        }}>
          <input value={custom.title} onChange={(e) => setCustom({ ...custom, title: e.target.value })} placeholder="Title" maxLength={160} autoFocus />
          <input value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} placeholder={`From (e.g. ${terms?.gm || 'GM'})`} maxLength={200} />
          <textarea value={custom.text} onChange={(e) => setCustom({ ...custom, text: e.target.value })} placeholder="Text" rows={4} />
          <input value={custom.image} onChange={(e) => setCustom({ ...custom, image: e.target.value })} placeholder="Image path or URL (optional)" maxLength={500} />
          <TargetPicker players={players} value={customTo} onChange={setCustomTo} />
          <div className="run-row">
            <button type="submit" className="run-btn primary sm">SEND</button>
            <button type="button" className="run-btn sm" onClick={() => setCustom(null)}>CANCEL</button>
          </div>
        </form>
      ) : (
        <button type="button" className="run-btn sm" onClick={() => setCustom({ title: '', from: '', text: '', image: '' })}>+ CUSTOM HANDOUT</button>
      )}
    </div>
  );
}
