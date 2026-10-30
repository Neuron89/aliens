import React, { useEffect, useState } from 'react';
import { useGame } from '../../GameContext';
import ClockRing from '../run/ClockRing';
import { useTypewriter } from '../player/fx';
import { useUniverse } from '../../UniverseContext';

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
   - board-roll  transient roll toast (name, skill, result glyphs) for 4 s;
                crit / botch / panic / complication styled per theme
   - board-panic "PANIC — <name>" toast (effect text stays private)
   - pools       visible pool meters (Momentum) in the corner stack
   - crew        air/power strip when any rating is <= rules.supplyDanger
   - initiative  name strip on the bottom edge (+ ring via TokenChip `active`)
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

function RollToast({ t }) {
  if (t.kind === 'panic') {
    return (
      <div className="ov-toast k-panic" role="status">
        <span className="ov-toast-kicker">PANIC</span>
        <b className="ov-toast-name">{t.name}</b>
        {t.effect && <span className="ov-toast-label">{String(t.effect).toUpperCase()}</span>}
      </div>
    );
  }
  const r = t.roll;
  const flags = r.flags || [];
  const tone = flags.includes('panic') || flags.includes('botch') ? 'botch' : flags.includes('complication') ? 'botch' : flags.includes('crit') ? 'crit' : 'plain';
  return (
    <div className={`ov-toast k-${tone}`} role="status">
      <b className="ov-toast-name">{r.name}</b>
      <span className="ov-toast-label">{r.label}</span>
      <span className="ov-toast-dice" aria-hidden="true">
        {(r.dice?.base || []).map((d, i) => <i key={`b${i}`} className={`b${d === 6 ? ' hit' : ''}`}>{d}</i>)}
        {(r.dice?.stress || []).map((d, i) => <i key={`s${i}`} className={`s${d === 6 ? ' hit' : ''}${d === 1 ? ' bad' : ''}`}>{d}</i>)}
        {(r.dice?.d20 || []).map((d, i) => <i key={`t${i}`} className={`t${d === 20 ? ' bad' : ''}${d === 1 ? ' hit' : ''}`}>{d}</i>)}
      </span>
      {(() => {
        const sum = r.summary?.split(' — ').slice(1).join(' — ') || '';
        return sum && !flags.includes(sum.toLowerCase()) ? <span className="ov-toast-sum">{sum}</span> : null;
      })()}
      {flags.filter((f) => f !== 'botch').map((f) => <span key={f} className={`ov-toast-flag f-${f}`}>{f.toUpperCase()}</span>)}
    </div>
  );
}

export default function Overlays({ terminalName }) {
  const { table, on } = useGame();
  const { universe } = useUniverse();
  const [toasts, setToasts] = useState([]); // { id, kind:'roll'|'panic', roll?, name?, effect? }

  /* Roll + panic toasts (4 s, newest on top, max 3). */
  useEffect(() => {
    const add = (t) => {
      setToasts((prev) => [...prev.filter((x) => x.id !== t.id), t].slice(-3));
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), TOAST_MS);
    };
    const offs = [
      on('board-roll', ({ roll } = {}) => { if (roll) add({ id: roll.id, kind: 'roll', roll }); }),
      on('board-panic', (p) => { if (p) add({ id: `panic-${p.tokenId}-${Date.now()}`, kind: 'panic', name: p.name, effect: p.effect }); }),
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
      {n && n.mode === 'card' && <Card id={n.id} title={n.title || table.theatre?.title} subtitle={n.title ? table.theatre?.title : ''} text={n.text} art={n.art || (theatre ? table.theatre?.art : null)} />}
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

      {toasts.length > 0 && (
        <div className="ov-toasts" aria-live="polite">
          {toasts.map((t) => <RollToast key={t.id} t={t} />)}
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

      {ini?.current && (
        <div className={`ov-turn k-${ini.current.kind}`} role="status">
          <span className="ov-turn-round">ROUND {ini.round}</span>
          <span className="ov-turn-name">{ini.current.label}</span>
        </div>
      )}

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
