import React, { useMemo } from 'react';
import { useUniverse } from '../../UniverseContext';
import { DocPaper, parseDoc, docStyle, isDocText } from '../player/HandoutDoc';

/* ═══════════════════════════════════════════════════════════════
   TV handout card (F5) — a narration card whose text is a document
   (starts with a FROM:/TO:/PRIORITY:/TIMESTAMP:/BURN… header block, see
   player/HandoutDoc.jsx) is shown as the universe's artefact instead of
   the plain theatre card: ALIEN a teletype printout typing in with the
   boot.key sound, DUNE a filmbook leaf with an illuminated initial and a
   House seal. A BURN header counts down on the TV too, then redacts.
   Mounted by board/Overlays.jsx in place of <Card> for document narrations:
     {n && n.mode === 'card' && (isDocNarration(n) ? <HandoutCard n={n} /> : <Card … />)}
   ═══════════════════════════════════════════════════════════════ */

/** True for a narration the TV should render as a document. */
export const isDocNarration = (n) => !!n && n.mode === 'card' && isDocText(n.text);

export default function HandoutCard({ n }) {
  const { universe } = useUniverse();
  const doc = useMemo(() => parseDoc({ title: n?.title, text: n?.text, image: n?.art }), [n?.title, n?.text, n?.art]);
  if (!n) return null;
  const kind = docStyle(universe);
  return (
    <div className={`ov-doc k-${kind}`} key={n.id} role="status" aria-live="polite">
      <style>{`
        .ov-doc { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 3vh 4vw;
          background: radial-gradient(ellipse at center, rgba(0,0,0,0.84), rgba(0,0,0,0.96)); }
        .ov-doc .hd { max-height: 94vh; overflow: hidden; }
      `}</style>
      <DocPaper key={n.id} doc={doc} kind={kind} size="tv" terminalName={universe?.terminal?.name} burnId={null} typeKey={n.id} />
    </div>
  );
}
