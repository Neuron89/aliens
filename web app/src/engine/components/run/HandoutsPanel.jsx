import React, { useState } from 'react';
import { useGame } from '../../GameContext';
import TargetPicker, { toTarget } from './TargetPicker';
import { docText, formatBurn } from '../player/HandoutDoc';
import './HandoutsPanel.css';

/* Push pack handouts (and custom ones) to phones; shows per-handout receipts
   ("SEEN 3/4") from table.handouts[].seenBy. Each send can carry a
   burn-after-reading timer (handout.burnSec: the phone counts down once the
   text has typed in, then redacts it). SHOW ON TV puts the handout on the
   TV as a document card (narrate mode 'card' with the docText header block:
   FROM / TO / PRIORITY / BURN), with its image when it has one. */
const BURN_CHOICES = [0, 30, 60, 120, 300];
/* Chip/status label: "30 SEC" (formatBurn's "30S" reads as "305" in some display fonts), else "2 MIN". */
const burnLabel = (s) => (s < 60 ? `${s} SEC` : formatBurn(s));

function BurnPicker({ value, onChange, id }) {
  return (
    <div className="run-row ho-burn" role="group" aria-labelledby={`${id}-burn`}>
      <span className="run-dim" id={`${id}-burn`}>BURN AFTER READING</span>
      {BURN_CHOICES.map((s) => (
        <button key={s} type="button" className={`run-chip${value === s ? ' on' : ''}`} aria-pressed={value === s} onClick={() => onChange(s)}>
          {s ? burnLabel(s) : 'OFF'}
        </button>
      ))}
    </div>
  );
}

export default function HandoutsPanel({ handouts = [], terms }) {
  const { table, players, sendHandout, narrate } = useGame();
  const [targets, setTargets] = useState({});
  const [burns, setBurns] = useState({});     // handout id -> seconds (0 = off)
  const [status, setStatus] = useState(null); // { id, text }
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

  const push = (h) => {
    const burnSec = burns[h.id] || 0;
    sendHandout({
      handoutId: h.id,
      handout: { title: h.title, from: h.from, to: h.to, priority: h.priority, text: h.text, image: h.image, burnSec },
    }, toTarget(targets[h.id]), (r) => setStatus({
      id: h.id,
      text: r?.error ? `NOT SENT: ${String(r.error).toUpperCase()}` : `SENT${burnSec ? ` · BURNS ${burnLabel(burnSec)} AFTER READING` : ''}`,
    }));
  };

  /* The TV card gets the document form: header lines + blank line + body (parsed by HandoutDoc/HandoutCard). */
  const toTv = (h) => narrate(
    docText({ from: h.from, to: h.to, priority: h.priority, burnSec: burns[h.id] || 0, text: h.text || '' }).slice(0, 4000),
    { title: h.title, mode: 'card', art: h.image },
  );

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
            {h.pack && <BurnPicker id={`ho-${h.id}`} value={burns[h.id] || 0} onChange={(s) => setBurns((b) => ({ ...b, [h.id]: s }))} />}
            <div className="run-row">
              <button type="button" className="run-btn primary sm" onClick={() => push(h)} disabled={!playerCount}>{r ? 'SEND AGAIN' : 'PUSH TO PHONES'}</button>
              {(h.text || h.image) && <button type="button" className="run-btn sm" onClick={() => toTv(h)}>SHOW ON TV</button>}
              {r && r.names.length > 0 && <span className="run-dim">✓ {r.names.join(', ')}</span>}
            </div>
            {status?.id === h.id && <p className="run-dim" role="status">{status.text}</p>}
          </div>
        );
      })}

      {custom ? (
        <form className="run-form" onSubmit={(e) => {
          e.preventDefault();
          if (!custom.title.trim() || (!custom.text.trim() && !custom.image.trim())) return;
          sendHandout({ custom: { ...custom, title: custom.title.trim().toUpperCase(), image: custom.image.trim() || undefined, burnSec: custom.burnSec || 0 } }, toTarget(customTo));
          setCustom(null);
          setCustomTo([]);
        }}>
          <input value={custom.title} onChange={(e) => setCustom({ ...custom, title: e.target.value })} placeholder="Title" maxLength={160} autoFocus />
          <input value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} placeholder={`From (e.g. ${terms?.gm || 'GM'})`} maxLength={200} />
          <textarea value={custom.text} onChange={(e) => setCustom({ ...custom, text: e.target.value })} placeholder="Text" rows={4} />
          <input value={custom.image} onChange={(e) => setCustom({ ...custom, image: e.target.value })} placeholder="Image path or URL (optional)" maxLength={500} />
          <TargetPicker players={players} value={customTo} onChange={setCustomTo} />
          <BurnPicker id="ho-custom" value={custom.burnSec || 0} onChange={(s) => setCustom({ ...custom, burnSec: s })} />
          <div className="run-row">
            <button type="submit" className="run-btn primary sm">SEND</button>
            <button type="button" className="run-btn sm" onClick={() => setCustom(null)}>CANCEL</button>
          </div>
        </form>
      ) : (
        <button type="button" className="run-btn sm" onClick={() => setCustom({ title: '', from: '', text: '', image: '', burnSec: 0 })}>+ CUSTOM HANDOUT</button>
      )}
    </div>
  );
}
