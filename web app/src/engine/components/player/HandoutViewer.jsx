import React, { useEffect, useState } from 'react';

/* Full-screen handout reader with an "unseal" open animation.
   Opening it is what counts as SEEN (the GM's receipt). */
export default function HandoutViewer({ handout, onClose, onSeen }) {
  const [imgOk, setImgOk] = useState(true);
  useEffect(() => { if (handout && !handout.seen) onSeen?.(handout.id); }, [handout, onSeen]);
  if (!handout) return null;
  return (
    <div className="ph-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={handout.title}>
      <div className="ph-doc" onClick={(e) => e.stopPropagation()}>
        <div className="ph-doc-head">
          {handout.priority && <div className="ph-doc-prio">{handout.priority}</div>}
          <h2 className="ph-doc-title">{handout.title}</h2>
          {(handout.from || handout.to) && (
            <div className="ph-doc-meta">
              {handout.from && <div>FROM: {handout.from}</div>}
              {handout.to && <div>TO: {handout.to}</div>}
            </div>
          )}
        </div>
        {handout.image && imgOk && <img className="ph-doc-img" src={handout.image} alt="" onError={() => setImgOk(false)} />}
        {handout.text && <div className="ph-doc-text">{handout.text}</div>}
        <button type="button" className="pv-btn primary ph-doc-close" onClick={onClose}>CLOSE</button>
      </div>
    </div>
  );
}
