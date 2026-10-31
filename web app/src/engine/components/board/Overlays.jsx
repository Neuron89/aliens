import React, { useEffect, useState } from 'react';
import { useGame } from '../../GameContext';
import ClockRing from '../run/ClockRing';
import { useTypewriter } from '../player/fx';
import { useUniverse } from '../../UniverseContext';
import DiceStage from './DiceStage';
import VisionOverlay from './VisionOverlay'; // F6: prescience / special-order vision line
import HandoutCard, { isDocNarration } from './HandoutCard'; // F5: document narrations render as the universe's artefact

/* ═══════════════════════════════════════════════════════════════
   TV overlay layer (mounted by BoardView over the map).
   Driven by the board's filtered `table` (server tableView 'board'):
   - narration  caption → lower-third over the map; card → full-screen
                theatre card with title + text (+ art), typewriter reveal
   - boardMode  'theatre' → act/scene title card (theatre.art full-bleed)
   - clocks     visible progress clocks, corner stack
   - pause      calm full-screen PAUSE card (X-card) until the GM clears it
   - board-flash / board-panic → token ring flash (BoardView → MapCanvas →
                TokenChip `flash` prop)
   Mechanics wave:
   - board-roll  F7: the full-stage dice animation (board/DiceStage.jsx — tumble,
                settle, lit hits, result card; player and non-secret GM rolls)
   - board-panic "PANIC — <name>" toast (effect text stays private)
   - pools       visible pool meters (Momentum) in the corner stack
   - crew        air/power strip when any rating is <= rules.supplyDanger
   - initiative  name strip on the bottom edge (+ ring via TokenChip `active`);
                hidden (hideTurn) while the F2 SPOTLIGHT banner shows the turn
   Board text sizes follow docs/RESEARCH_GM_PLAYER_EXPERIENCE.md §(d).
   ═══════════════════════════════════════════════════════════════ */

function ArtBg({ src }) {
  const [ok, setOk] = useState(true);
  useEffect(() => setOk(true), [src]);
  if (!src || !ok) return null;
  return <img className="ov-art" src={src} alt="" onError={() => setOk(false)} />;
}

function Caption({ n }) {
  const shown = useTypewriter(n.text, { key: n.id });
  return (
    <div className="ov-caption" key={n.id} role="status" aria-live="polite">
      {n.title && <div className="ov-caption-title">{n.title}</div>}
      <p className="ov-caption-text">{shown}<span className="ov-caret" aria-hidden="true" /></p>
    </div>
  );
}

function Card({ title, subtitle, text, art, id }) {
  const shown = useTypewriter(text, { key: id });
  return (
    <div className={`ov-card${art ? ' has-art' : ''}`} key={id}>
      <ArtBg src={art} />
      <div className="ov-card-inner">
        {subtitle && <div className="ov-card-sub">{subtitle}</div>}
        {title && <h1 className="ov-card-title">{title}</h1>}
        {text && <p className="ov-card-text">{shown}</p>}
      </div>
    </div>
  );
}

const TOAST_MS = 4000;

/* Panic toast (the roll itself plays on the DiceStage). */
function PanicToast({ t }) {
  return (
    <div className="ov-toast k-panic" role="status">
      <span className="ov-toast-kicker">PANIC</span>
      <b className="ov-toast-name">{t.name}</b>
      {t.effect && <span className="ov-toast-label">{String(t.effect).toUpperCase()}</span>}
    </div>
  );
}

export default function Overlays({ terminalName, hideTurn = false }) {
  const { table, on } = useGame();
  const { universe } = useUniverse();
  const [toasts, setToasts] = useState([]); // { id, name, effect? } — PANIC toasts

  /* Panic toasts (4 s, newest on top, max 3). Rolls: <DiceStage /> listens to board-roll itself. */
  useEffect(() => {
    const add = (t) => {
      setToasts((prev) => [...prev.filter((x) => x.id !== t.id), t].slice(-3));
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), TOAST_MS);
    };
    const offs = [
      on('board-panic', (p) => { if (p) add({ id: `panic-${p.tokenId}-${Date.now()}`, name: p.name, effect: p.effect }); }),
    ];
    return () => offs.forEach((f) => f());
  }, [on]);

  if (!table) return null;
  const n = table.narration;
  const theatre = table.boardMode === 'theatre';
  const clocks = table.clocks || [];
  const pools = table.pools || [];
  const ini = table.initiative?.active ? table.initiative : null;
  const supplyKeys = (universe?.rules?.supplies || []).filter((k) => k === 'air' || k === 'power');
  const danger = universe?.rules?.supplyDanger ?? 2;
  const crew = (table.crew || []).filter((c) => supplyKeys.some((k) => c.supply[k] !== undefined));
  const crewDanger = supplyKeys.length > 0 && crew.some((c) => supplyKeys.some((k) => c.supply[k] !== undefined && c.supply[k] <= danger));

  return (
    <div className="ov-root" aria-hidden={false}>
      {theatre && !(n && n.mode === 'card') && (
        <Card id={`th-${table.theatre?.title}-${table.theatre?.subtitle}`}
          title={table.theatre?.subtitle || table.theatre?.title || terminalName}
          subtitle={table.theatre?.subtitle ? table.theatre?.title : ''} art={table.theatre?.art} text="" />
      )}
      {n && n.mode === 'card' && (isDocNarration(n) ? <HandoutCard n={n} /> : <Card id={n.id} title={n.title || table.theatre?.title} subtitle={n.title ? table.theatre?.title : ''} text={n.text} art={n.art || (theatre ? table.theatre?.art : null)} />)}
      {n && n.mode !== 'card' && <Caption n={n} />}

      {(clocks.length > 0 || pools.length > 0) && (
        <div className="ov-clocks">
          {pools.map((p) => (
            <div key={`pool-${p.key}`} className={`ov-pool k-${p.key}`}>
              <div className="ov-pool-label">{p.label}</div>
              <div className="ov-pool-meter" aria-hidden="true">
                {Array.from({ length: p.max || Math.max(p.value, 1) }, (_, i) => <i key={i} className={i < p.value ? 'on' : ''} />)}
              </div>
              <div className="ov-pool-n">{p.value}{p.max ? `/${p.max}` : ''}</div>
            </div>
          ))}
          {clocks.map((c) => (
            <div key={c.id} className={`ov-clock k-${c.kind}${c.filled === c.segments ? ' full' : ''}`}>
              <ClockRing segments={c.segments} filled={c.filled} kind={c.kind} size={92} title={c.label} />
              <div className="ov-clock-label">{c.label}</div>
              <div className="ov-clock-n">{c.filled}/{c.segments}</div>
            </div>
          ))}
        </div>
      )}

      <DiceStage />

      {toasts.length > 0 && (
        <div className="ov-toasts" aria-live="polite">
          {toasts.map((t) => <PanicToast key={t.id} t={t} />)}
        </div>
      )}

      {crewDanger && (
        <div className="ov-supply" role="status">
          <span className="ov-supply-head">SUPPLY</span>
          {crew.map((c) => (
            <span key={c.playerId} className="ov-supply-pc">
              <b>{c.name}</b>
              {supplyKeys.filter((k) => c.supply[k] !== undefined).map((k) => (
                <span key={k} className={`ov-supply-k${c.supply[k] <= danger ? ' low' : ''}${c.supply[k] === 0 ? ' out' : ''}`}>{k.toUpperCase()} {c.supply[k]}</span>
              ))}
            </span>
          ))}
        </div>
      )}

      {ini?.current && !hideTurn && ( /* hidden while BoardView's SPOTLIGHT turn banner shows the same turn */
        <div className={`ov-turn k-${ini.current.kind}`} role="status">
          <span className="ov-turn-round">ROUND {ini.round}</span>
          <span className="ov-turn-name">{ini.current.label}</span>
        </div>
      )}

      <VisionOverlay />{/* F6 */}

      {table.pause && (
        <div className="ov-pause" role="alert">
          <div className="ov-pause-inner">
            <div className="ov-pause-mark" aria-hidden="true">❚❚</div>
            <h1>PAUSE</h1>
            <p>Take a breath. We will pick up when everyone is ready.</p>
          </div>
        </div>
      )}
    </div>
  );
}
