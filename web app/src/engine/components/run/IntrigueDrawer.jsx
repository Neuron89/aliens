import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../../GameContext';
import { useUniverse } from '../../UniverseContext';
import TargetPicker, { toTarget } from './TargetPicker';
import { visionSkin } from '../board/VisionOverlay';
import { buildGraph, ringLayout, edgePath, relationClue, KIND_STYLE, RELATION_KINDS, shortLabel } from './intrigueGraph';
import './intrigue.css';

/* ═══════════════════════════════════════════════════════════════
   F6 — INTRIGUE (MORE drawer tab, GM only).
   1. The intrigue web of the active pack: PCs on an inner ring, NPCs on
      the outer ring, one curved arrow per relations[] entry, coloured by
      kind (legend below). Tap a person → their ties light up, the rest
      dims; tap a tie → its note. Secret ties are dashed until the GM
      REVEALs them: that is an ordinary ad-hoc clue-reveal (clue id = the
      relation id), so it lands on the phones exactly like any clue.
      Fits the panel (no pinch/drag); EXPAND opens it full screen
      (tablet 1024×768: graph left, details right).
   2. PRESCIENCE / SPECIAL ORDER (skin from the theme): a line the TV
      shows as a shimmering vision (or a terminal override) for N seconds,
      and the chosen phones get as a private flash (vision-send).
   ═══════════════════════════════════════════════════════════════ */

const PRESETS = {
  prescience: [
    'Sand closes over a banner you know.',
    'A knife in a hand you trusted, and no blood on it yet.',
    'Water spilled on stone, and no one kneels to save it.',
    'The worm rises where the drum fell silent.',
    'Two roads: one ends in fire, the other in a quiet room.',
    'A door you have not opened stands open in every future.',
  ],
  order: [
    'PRIORITY OVERRIDE: RECOVER THE SAMPLE. CREW SAFETY IS NOT A FACTOR.',
    'LIFE SIGNS ABOARD: ONE MORE THAN THE MANIFEST.',
    'SCRUBBER LOG ALTERED. USER UNKNOWN.',
    'DIRECTIVE SEALED. EXECUTIVE ACCESS REVOKED.',
    'DO NOT OPEN THE AFT HATCH. REPEAT: DO NOT OPEN.',
  ],
};
const DURATIONS = [5, 9, 15, 25];

/** Measured size of an element (ResizeObserver; first value synchronously). */
function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => setSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/* ─── The graph (SVG fitted to its box) ─── */
function IntrigueGraph({ graph, byKey, revealed, sel, onSelect, full }) {
  const box = useRef(null);
  const { w: bw, h: bh } = useSize(box);
  const w = Math.max(240, bw);
  const h = full ? Math.max(260, bh) : Math.min(Math.max(300, w * 1.02), 460);
  const labels = full ? 'full' : 'first';
  const nodeR = full ? 17 : 12;
  const mx = full ? 150 : 64;
  const my = full ? 64 : 34;
  const pos = useMemo(() => ringLayout(graph.nodes, w, h, { marginX: mx, marginY: my }), [graph, w, h, mx, my]);
  const focusKey = sel?.type === 'node' ? sel.key : null;
  const focusEdge = sel?.type === 'edge' ? graph.edges.find((e) => e.id === sel.id) : null;
  const near = useMemo(() => {
    if (!focusKey) return null;
    const s = new Set([focusKey]);
    for (const e of graph.edges) if (e.from === focusKey || e.to === focusKey) { s.add(e.from); s.add(e.to); }
    return s;
  }, [graph, focusKey]);
  const pairs = useMemo(() => new Set(graph.edges.map((e) => `${e.from}|${e.to}`)), [graph]);

  const nodeLabel = (n) => (labels === 'full' ? n.label : n.label.split(/\s+/)[0]);
  const keyAct = (fn) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };

  return (
    <div ref={box} className={`ig-graph${full ? ' full' : ''}`} style={full ? undefined : { height: h }}>
      {bw > 0 && (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="group" aria-label="Intrigue web"
          onClick={(e) => { if (e.target === e.currentTarget || e.target.dataset?.bg) onSelect(null); }}>
          <defs>
            {RELATION_KINDS.map((k) => (
              <marker key={k} id={`ig-arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" style={{ fill: KIND_STYLE[k].color }} />
              </marker>
            ))}
          </defs>
          <rect data-bg="1" x="0" y="0" width={w} height={h} fill="transparent" />
          {graph.nodes.some((n) => n.type === 'pc') && graph.nodes.some((n) => n.type !== 'pc') && (
            <ellipse data-bg="1" className="ig-ring" cx={w / 2} cy={h / 2} rx={(w / 2 - mx) * 0.42} ry={(h / 2 - my) * 0.42} />
          )}
          <g className="ig-edges">
            {graph.edges.map((e) => {
              const a = pos[e.from];
              const b = pos[e.to];
              if (!a || !b) return null;
              const twin = pairs.has(`${e.to}|${e.from}`);
              const { cx, cy } = edgePath(a, b, twin ? 0.16 : 0.08);
              // Trim both ends to the node rims so the arrowhead touches the circle.
              const trim = (p, c, r) => { const dx = c.x - p.x; const dy = c.y - p.y; const l = Math.hypot(dx, dy) || 1; return { x: p.x + (dx / l) * r, y: p.y + (dy / l) * r }; };
              const s = trim(a, { x: cx, y: cy }, nodeR + 2);
              const t = trim(b, { x: cx, y: cy }, nodeR + 4);
              const d = `M${s.x.toFixed(1)},${s.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${t.x.toFixed(1)},${t.y.toFixed(1)}`;
              const isRevealed = revealed.has(e.id);
              const dashed = e.secret && !isRevealed;
              const on = focusEdge ? focusEdge.id === e.id : (focusKey ? e.from === focusKey || e.to === focusKey : true);
              const label = `${byKey[e.from]?.name} ${KIND_STYLE[e.kind].verb} ${byKey[e.to]?.name}${e.secret ? (isRevealed ? ' (secret, revealed)' : ' (secret)') : ''}`;
              return (
                <g key={e.id} className={`ig-edge k-${e.kind}${on ? '' : ' dim'}${focusEdge?.id === e.id ? ' sel' : ''}${dashed ? ' secret' : ''}`}>
                  <path className="ig-edge-line" d={d} style={{ stroke: KIND_STYLE[e.kind].color }} markerEnd={`url(#ig-arrow-${e.kind})`} />
                  <path className="ig-edge-hit" d={d} role="button" tabIndex={full || on ? 0 : -1} aria-label={label}
                    onClick={(ev) => { ev.stopPropagation(); onSelect({ type: 'edge', id: e.id }); }}
                    onKeyDown={keyAct(() => onSelect({ type: 'edge', id: e.id }))}><title>{label}</title></path>
                </g>
              );
            })}
          </g>
          <g className="ig-nodes">
            {graph.nodes.map((n) => {
              const p = pos[n.key];
              if (!p) return null;
              const dim = (near && !near.has(n.key)) || (focusEdge && focusEdge.from !== n.key && focusEdge.to !== n.key);
              const cos = Math.cos(p.angle);
              const sin = Math.sin(p.angle);
              const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
              const lr = nodeR + (full ? 8 : 5);
              const lx = p.x + cos * lr;
              const ly = p.y + sin * lr + (sin > 0.3 ? (full ? 13 : 10) : sin < -0.3 ? -4 : 4);
              return (
                <g key={n.key} className={`ig-node t-${n.type}${focusKey === n.key ? ' sel' : ''}${dim ? ' dim' : ''}`} role="button" tabIndex={0}
                  aria-label={`${n.name}${n.role ? `, ${n.role}` : ''}`} aria-pressed={focusKey === n.key}
                  onClick={(ev) => { ev.stopPropagation(); onSelect(focusKey === n.key ? null : { type: 'node', key: n.key }); }}
                  onKeyDown={keyAct(() => onSelect(focusKey === n.key ? null : { type: 'node', key: n.key }))}>
                  <title>{n.name}{n.role ? ` — ${n.role}` : ''}</title>
                  <circle className="ig-hit" cx={p.x} cy={p.y} r={22} />
                  <circle className="ig-dot" cx={p.x} cy={p.y} r={nodeR} />
                  {!full && <text className="ig-mono" x={p.x} y={p.y + 3.5} textAnchor="middle">{n.label.split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase()}</text>}
                  <text className="ig-label" x={lx} y={ly} textAnchor={anchor}>{nodeLabel(n)}</text>
                  {full && n.role && <text className="ig-role" x={lx} y={ly + 14} textAnchor={anchor}>{n.role.length > 19 ? `${n.role.slice(0, 18)}…` : n.role}</text>}
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="ig-legend" aria-label="Legend">
      {RELATION_KINDS.map((k) => (
        <span key={k} className="ig-key"><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" style={{ stroke: KIND_STYLE[k].color }} strokeWidth="3" /></svg>{KIND_STYLE[k].label}</span>
      ))}
      <span className="ig-key"><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" /></svg>SECRET</span>
      <span className="ig-key"><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5" className="ig-key-pc" /></svg>PC</span>
      <span className="ig-key"><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5" className="ig-key-npc" /></svg>NPC</span>
    </div>
  );
}

/* ─── Selected tie / person ─── */
function Details({ graph, byKey, sel, onSelect, revealed, players, terms }) {
  const { clueReveal, clueHide } = useGame();
  const [targets, setTargets] = useState([]);
  const [msg, setMsg] = useState('');
  useEffect(() => { setTargets([]); setMsg(''); }, [sel?.id, sel?.key]);

  const tieButton = (e, from) => (
    <button key={e.id} type="button" className={`ig-tie k-${e.kind}`} onClick={() => onSelect({ type: 'edge', id: e.id })}>
      <span className="ig-tie-kind" style={{ color: KIND_STYLE[e.kind].color }}>{KIND_STYLE[e.kind].label}</span>
      <span className="ig-tie-who">{from ? `→ ${byKey[e.to]?.name}` : `← ${byKey[e.from]?.name}`}</span>
      {e.secret && <span className={`ig-badge${revealed.has(e.id) ? ' rev' : ''}`}>{revealed.has(e.id) ? 'REVEALED' : 'SECRET'}</span>}
    </button>
  );

  if (sel?.type === 'edge') {
    const e = graph.edges.find((x) => x.id === sel.id);
    if (!e) return null;
    const isRevealed = revealed.has(e.id);
    const reveal = () => {
      setMsg('');
      clueReveal(e.id, toTarget(targets), { clue: relationClue(e, byKey) }, (r) => setMsg(r?.error ? r.error : `REVEALED AS A CLUE → ${targets.length ? `${targets.length} ${terms.player.toLowerCase()}(s)` : 'everyone'}`));
    };
    return (
      <div className="ig-detail" aria-live="polite">
        <div className="ig-detail-head">
          <b>{byKey[e.from]?.name}</b>
          <span className="ig-kind" style={{ color: KIND_STYLE[e.kind].color, borderColor: KIND_STYLE[e.kind].color }}>{KIND_STYLE[e.kind].label}</span>
          <b>{byKey[e.to]?.name}</b>
        </div>
        <p className="ig-note">{e.note || <i className="run-dim">No note.</i>}</p>
        {e.secret ? (
          <>
            <div className="ig-secret-state">{isRevealed ? 'SECRET — REVEALED TO PLAYERS' : 'SECRET — PLAYERS DO NOT KNOW THIS'}</div>
            <TargetPicker players={players} value={targets} onChange={setTargets} allLabel="EVERYONE" />
            <div className="ig-row">
              <button type="button" className="ig-btn primary" onClick={reveal}>{isRevealed ? 'SHARE MORE' : 'REVEAL'}</button>
              {isRevealed && <button type="button" className="ig-btn" onClick={() => clueHide(e.id, (r) => setMsg(r?.error || 'UN-REVEALED'))}>UN-REVEAL</button>}
            </div>
          </>
        ) : <div className="ig-secret-state open">KNOWN — NOT A SECRET</div>}
        {msg && <div className="ig-msg" role="status">{msg}</div>}
        <div className="ig-row">
          <button type="button" className="ig-btn" onClick={() => onSelect({ type: 'node', key: e.from })}>{shortLabel(byKey[e.from]?.name)}</button>
          <button type="button" className="ig-btn" onClick={() => onSelect({ type: 'node', key: e.to })}>{shortLabel(byKey[e.to]?.name)}</button>
        </div>
      </div>
    );
  }
  if (sel?.type === 'node') {
    const n = byKey[sel.key];
    if (!n) return null;
    const out = graph.edges.filter((e) => e.from === n.key);
    const inc = graph.edges.filter((e) => e.to === n.key);
    return (
      <div className="ig-detail" aria-live="polite">
        <div className="ig-detail-head"><b>{n.name}</b>{n.role && <span className="run-dim">{n.role}</span>}<span className="ig-badge">{n.type === 'pc' ? 'PC' : 'NPC'}</span></div>
        {out.length + inc.length === 0 && <p className="run-empty">No ties.</p>}
        {out.length > 0 && <div className="ig-ties">{out.map((e) => tieButton(e, true))}</div>}
        {inc.length > 0 && <div className="ig-ties">{inc.map((e) => tieButton(e, false))}</div>}
      </div>
    );
  }
  return <p className="ig-hint">Tap a person to light up their ties; tap a line for its note. Dashed lines are secrets — REVEAL sends one to the phones as a clue.</p>;
}

/* ─── PRESCIENCE / SPECIAL ORDER composer ─── */
function VisionComposer({ skin, players, terms }) {
  const { visionSend } = useGame();
  const [text, setText] = useState('');
  const [secs, setSecs] = useState(9);
  const [tv, setTv] = useState(true);
  const [phones, setPhones] = useState(true);
  const [targets, setTargets] = useState([]);
  const [msg, setMsg] = useState('');
  const title = skin === 'order' ? 'SPECIAL ORDER' : 'PRESCIENCE';
  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setMsg('');
    visionSend(text.trim(), { ms: secs * 1000, to: phones ? toTarget(targets) : 'none', board: tv }, (r) => {
      setMsg(r?.error ? r.error : `SENT · ${tv ? 'TV + ' : ''}${r.phones} PHONE${r.phones === 1 ? '' : 'S'} · ${secs}S`);
    });
  };
  return (
    <form className={`ig-vision s-${skin}`} onSubmit={send}>
      <div className="fs-label">{title}</div>
      <label className="ig-sr" htmlFor="ig-vision-text">{title} text</label>
      <textarea id="ig-vision-text" value={text} maxLength={300} rows={2} onChange={(e) => setText(e.target.value)}
        placeholder={skin === 'order' ? 'Type the override line…' : 'Type what they glimpse…'} />
      <div className="ig-presets" role="group" aria-label="Suggested lines">
        {PRESETS[skin].map((p) => <button key={p} type="button" className="ig-preset" onClick={() => setText(p)}>{p}</button>)}
      </div>
      <div className="ig-row" role="group" aria-label="Duration">
        <span className="ig-row-k">HOLD</span>
        {DURATIONS.map((s) => <button key={s} type="button" className={`ig-seg${secs === s ? ' on' : ''}`} aria-pressed={secs === s} onClick={() => setSecs(s)}>{s}s</button>)}
      </div>
      <div className="ig-row" role="group" aria-label="Where">
        <span className="ig-row-k">SHOW ON</span>
        <button type="button" className={`ig-seg${tv ? ' on' : ''}`} aria-pressed={tv} onClick={() => setTv((v) => !v)}>TV</button>
        <button type="button" className={`ig-seg${phones ? ' on' : ''}`} aria-pressed={phones} onClick={() => setPhones((v) => !v)}>PHONES</button>
      </div>
      {phones && <TargetPicker players={players} value={targets} onChange={setTargets} allLabel={`ALL ${terms.players.toUpperCase()}`} />}
      <div className="ig-row">
        <button type="submit" className="ig-btn primary" disabled={!text.trim() || (!tv && !phones)}>SEND {title}</button>
      </div>
      {msg && <div className="ig-msg" role="status">{msg}</div>}
    </form>
  );
}

/* ─── Full-screen view (EXPAND): own dialog; Escape closes it before the drawer sees the key ─── */
function FullView({ title, onClose, children }) {
  const ref = useRef(null);
  const closeBtn = useRef(null);
  useEffect(() => {
    const opener = document.activeElement;
    const t = setTimeout(() => closeBtn.current?.focus({ preventScroll: true }), 30);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
      if (e.key === 'Tab' && ref.current) { // keep focus inside the dialog
        const f = ref.current.querySelectorAll('button, [tabindex="0"], textarea, input');
        if (!f.length) return;
        const first = f[0]; const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey, true);
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [onClose]);
  /* Portalled to <body>: the drawer is transformed (slide-in), which would trap position:fixed. */
  return createPortal(
    <div ref={ref} className="ig-full" role="dialog" aria-modal="true" aria-label={title}>
      <header className="ig-full-head">
        <h2>{title}</h2>
        <button ref={closeBtn} type="button" className="ig-btn" onClick={onClose}>CLOSE</button>
      </header>
      {children}
    </div>,
    document.body,
  );
}

export default function IntrigueDrawer({ pack }) {
  const { table, players } = useGame();
  const { universe } = useUniverse();
  const terms = universe.terms;
  const skin = visionSkin(universe);
  const graph = useMemo(() => buildGraph(pack), [pack]);
  const byKey = useMemo(() => Object.fromEntries(graph.nodes.map((n) => [n.key, n])), [graph]);
  const revealed = useMemo(() => new Set((table?.clues || []).filter((c) => c.status === 'revealed').map((c) => c.id)), [table?.clues]);
  const [sel, setSel] = useState(null);
  const [full, setFull] = useState(false);
  useEffect(() => setSel(null), [pack?.id]);

  const secrets = graph.edges.filter((e) => e.secret);
  const shown = secrets.filter((e) => revealed.has(e.id)).length;
  const hasWeb = graph.edges.length > 0;
  const summary = `${graph.nodes.length} PEOPLE · ${graph.edges.length} TIES · ${shown}/${secrets.length} SECRETS OUT`;

  const web = (isFull) => (
    <>
      <IntrigueGraph graph={graph} byKey={byKey} revealed={revealed} sel={sel} onSelect={setSel} full={isFull} />
      {!isFull && <Legend />}
    </>
  );
  const details = <Details graph={graph} byKey={byKey} sel={sel} onSelect={setSel} revealed={revealed} players={players} terms={terms} />;

  return (
    <div className="ig">
      {hasWeb ? (
        <>
          <div className="ig-top">
            <span className="fs-label">INTRIGUE WEB — {summary}</span>
            <button type="button" className="ig-btn" onClick={() => setFull(true)}>EXPAND</button>
          </div>
          {!full && web(false)}
          {!full && details}
          {graph.unresolved.length > 0 && <p className="run-dim-p">{graph.unresolved.length} relation(s) name nobody in this pack and are not drawn.</p>}
        </>
      ) : (
        <p className="run-empty">{pack ? 'This scenario has no relations on its NPCs or characters, so there is no intrigue web to draw. Packs can add relations[] (to, kind, note, secret) to any NPC or character.' : 'Sandbox: no scenario, no intrigue web.'}</p>
      )}

      <VisionComposer skin={skin} players={players} terms={terms} />

      {full && (
        <FullView title={`INTRIGUE — ${pack?.meta?.title || ''}`} onClose={() => setFull(false)}>
          <div className="ig-full-body">
            <div className="ig-full-graph">{web(true)}</div>
            <aside className="ig-full-side">
              <div className="fs-label">{summary}</div>
              <Legend />
              {details}
            </aside>
          </div>
        </FullView>
      )}
    </div>
  );
}
