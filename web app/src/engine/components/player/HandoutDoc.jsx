import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { play, reducedFx } from '../../sfx';
import { useDialog } from './useDialog';

/* ═══════════════════════════════════════════════════════════════
   HANDOUT DOCUMENTS (F5) — a handout rendered as an in-world artefact.
   Styles (picked from the universe, never by id):
     teletype  (theme.handoutStyle 'teletype', or overlay 'crt' — ALIEN):
               tractor-feed greenbar printout, perforated edges, a boxed
               FROM / TO / PRIORITY / TIMESTAMP header, text typed in with
               the terminal's boot.key sound and a block caret
     filmbook  (theme.handoutStyle 'filmbook', or any other overlay — DUNE):
               parchment leaf, illuminated first letter, ruled header,
               text written in letter by letter, a wax House seal
   Burn after reading: a `BURN AFTER READING: 30S` header line (or a
   handout.burnSec field) starts a countdown when the text has finished
   arriving; at zero the text is redacted, and stays redacted on this
   device (localStorage muthur.burn.<id>). A handout already marked seen
   with no local record (read on another device) opens redacted.

   Document text format (shared with the TV card and the GM RECAP section):
     FROM: MU/TH/UR
     TO: CREW
     PRIORITY: STANDARD
     TIMESTAMP: 2183-06-12 04:10
     BURN AFTER READING: 30S
     <blank line>
     body…
   Every header line is optional; a text without one is a plain body.

   Exports: default HandoutDoc (phone reader dialog), DocPaper (the artefact,
   reused by board/HandoutCard), parseDoc, docText, isDocText, docStyle,
   formatBurn, ensureDocStyles.
   ═══════════════════════════════════════════════════════════════ */

const HEAD_RE = /^(FROM|TO|PRIORITY|TIMESTAMP|BURN(?: AFTER READING)?)\s*:\s*(.*)$/i;
const BURN_KEY = 'muthur.burn.';

/** "30S" | "2 MIN" | "90" → seconds (0 = no burn). */
export function burnSeconds(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? Math.min(3600, Math.round(v)) : 0;
  const m = /(\d{1,4})\s*(S|SEC|SECS|SECONDS|M|MIN|MINS|MINUTES)?\b/i.exec(String(v || ''));
  if (!m) return 0;
  const n = Number(m[1]) * (/^M/i.test(m[2] || '') ? 60 : 1);
  return Math.max(0, Math.min(3600, n));
}
export const formatBurn = (sec) => (sec >= 60 && sec % 60 === 0 ? `${sec / 60} MIN` : `${sec}S`);

/** True when `text` starts with a document header block. */
export const isDocText = (text) => HEAD_RE.test(String(text || '').split(/\r?\n/, 1)[0] || '');

/**
 * Split a handout (or a narration { title, text }) into header + body.
 * Handout fields (from/to/priority/burnSec) win over header lines.
 */
export function parseDoc(h = {}) {
  const lines = String(h.text || '').replace(/\r\n/g, '\n').split('\n');
  const head = {};
  let i = 0;
  for (; i < lines.length; i++) {
    const m = HEAD_RE.exec(lines[i].trim());
    if (!m) break;
    const k = m[1].toUpperCase().startsWith('BURN') ? 'burn' : m[1].toLowerCase();
    head[k] = m[2].trim();
  }
  if (i > 0 && i < lines.length && !lines[i].trim()) i++;
  const body = lines.slice(i).join('\n').trim();
  return {
    title: String(h.title || ''),
    from: String(h.from || head.from || ''),
    to: String(h.to || head.to || ''),
    priority: String(h.priority || head.priority || ''),
    timestamp: String(h.timestamp || head.timestamp || ''),
    burnSec: burnSeconds(h.burnSec) || burnSeconds(head.burn),
    image: h.image || null,
    body,
  };
}

/** Compose the document text (header lines + blank line + body). Fields left empty are omitted. */
export function docText({ from, to, priority, timestamp, burnSec, text } = {}) {
  const head = [];
  if (from) head.push(`FROM: ${from}`);
  if (to) head.push(`TO: ${to}`);
  if (priority) head.push(`PRIORITY: ${priority}`);
  if (timestamp) head.push(`TIMESTAMP: ${timestamp}`);
  if (burnSec > 0) head.push(`BURN AFTER READING: ${formatBurn(burnSec)}`);
  const body = String(text || '').trim();
  return head.length ? `${head.join('\n')}\n\n${body}` : body;
}

/** 'teletype' | 'filmbook' for a universe module. */
export function docStyle(universe) {
  const s = universe?.theme?.handoutStyle;
  if (s === 'teletype' || s === 'filmbook') return s;
  return universe?.theme?.overlay === 'crt' ? 'teletype' : 'filmbook';
}

const readBurn = (id) => { try { const v = Number(localStorage.getItem(BURN_KEY + id)); return Number.isFinite(v) && v > 0 ? v : null; } catch { return null; } };
const writeBurn = (id, at) => { try { localStorage.setItem(BURN_KEY + id, String(at)); } catch { /* storage unavailable */ } };

/* Character-by-character reveal with a key click every few characters (sfx mute respected). */
function useTyping(text, { enabled, cps = 55, sound = true, key }) {
  const full = String(text || '');
  const [n, setN] = useState(() => (enabled ? 0 : full.length));
  const timer = useRef(null);
  useEffect(() => {
    if (!enabled || !full) { setN(full.length); return undefined; }
    setN(0);
    // Time-based, so a throttled tab (TV in the background) catches up instead of crawling.
    const rate = Math.max(cps, full.length / 16) / 1000; // chars per ms; long texts finish in ≤ ~16 s
    const t0 = performance.now();
    let last = 0;
    timer.current = setInterval(() => {
      const i = Math.min(full.length, Math.floor((performance.now() - t0) * rate));
      if (i === last) return;
      setN(i);
      if (sound && Math.floor(i / 3) !== Math.floor(last / 3) && full[i - 1] && full[i - 1] !== ' ') play('boot.key', { volume: 0.6 });
      last = i;
      if (i >= full.length) { clearInterval(timer.current); if (sound) play('boot.line'); }
    }, 1000 / cps);
    return () => clearInterval(timer.current);
  }, [full, enabled, cps, sound, key]);
  const skip = useCallback(() => { clearInterval(timer.current); setN(full.length); }, [full]);
  return { shown: full.slice(0, n), done: n >= full.length, skip };
}

/* Redaction bars: one bar per word, same rhythm as the text it hides. */
function Redacted({ body }) {
  return (
    <div className="hd-redacted" aria-label="Redacted">
      {body.split(/\n+/).map((para, pi) => (
        <p key={pi}>{para.split(/\s+/).filter(Boolean).map((w, wi) => <span key={wi} className="hd-bar" style={{ width: `${Math.min(14, w.length) * 0.62}em` }} />)}</p>
      ))}
    </div>
  );
}

function Seal({ letter }) {
  // Wax seal: scalloped disc, inner ring of dots, the issuer's initial.
  const pts = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const r = i % 2 ? 46 : 50;
    pts.push(`${(60 + r * Math.cos(a)).toFixed(1)},${(60 + r * Math.sin(a)).toFixed(1)}`);
  }
  const dots = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return <circle key={i} cx={60 + 36 * Math.cos(a)} cy={60 + 36 * Math.sin(a)} r="1.6" />;
  });
  return (
    <svg className="hd-seal" viewBox="0 0 120 120" aria-hidden="true">
      <polygon points={pts.join(' ')} className="hd-seal-wax" />
      <circle cx="60" cy="60" r="40" className="hd-seal-ring" />
      <g className="hd-seal-dots">{dots}</g>
      <text x="60" y="61" className="hd-seal-letter" textAnchor="middle" dominantBaseline="central">{letter}</text>
    </svg>
  );
}

/**
 * The artefact itself. Props: doc (parseDoc result), kind ('teletype'|'filmbook'), size ('phone'|'tv'),
 * terminalName, burnId (persist the burn under this id; null = memory only), seen (opened before).
 */
export function DocPaper({ doc, kind = 'teletype', size = 'phone', terminalName = '', burnId = null, seen = false, typeKey }) {
  ensureDocStyles();
  const fxOff = reducedFx();
  const [now, setNow] = useState(() => Date.now());
  const [burnStart, setBurnStart] = useState(() => {
    if (!doc.burnSec) return null;
    const stored = burnId ? readBurn(burnId) : null;
    if (stored) return stored;
    return seen && burnId ? 1 : null; // read elsewhere: already burned
  });
  const alreadyBurned = !!doc.burnSec && burnStart !== null && (Date.now() - burnStart) / 1000 >= doc.burnSec;
  const { shown, done, skip } = useTyping(doc.body, { enabled: !fxOff && !alreadyBurned, cps: size === 'tv' ? 50 : 60, sound: kind === 'teletype', key: typeKey });

  // Burn countdown starts once the whole text has arrived.
  useEffect(() => {
    if (!doc.burnSec || !done || burnStart !== null) return;
    const at = Date.now();
    setBurnStart(at);
    if (burnId) writeBurn(burnId, at);
  }, [doc.burnSec, done, burnStart, burnId]);
  useEffect(() => {
    if (!doc.burnSec || burnStart === null) return undefined;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [doc.burnSec, burnStart]);
  const left = doc.burnSec && burnStart !== null ? Math.max(0, Math.ceil(doc.burnSec - (now - burnStart) / 1000)) : null;
  const burned = left === 0;
  const prevBurned = useRef(burned);
  useEffect(() => { if (burned && !prevBurned.current) play('dice.botch'); prevBurned.current = burned; }, [burned]);

  const teletype = kind === 'teletype';
  const first = !teletype && shown ? shown[0] : '';
  const rest = !teletype && shown ? shown.slice(1) : shown;
  const paras = (s) => s.split(/\n{2,}/).map((p, i, arr) => <p key={i}>{p}{i === arr.length - 1 && !done && teletype && <span className="hd-caret" aria-hidden="true" />}</p>);
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <article className={`hd k-${kind} hd-${size}${burned ? ' is-burned' : ''}${left !== null && left > 0 && left <= 10 ? ' is-burning' : ''}`}
      onClick={!done ? skip : undefined} aria-label={doc.title || 'Document'}
      style={size === 'tv' ? { '--hd-fs': doc.body.length <= 450 ? '1.55vw' : doc.body.length <= 900 ? '1.2vw' : doc.body.length <= 1500 ? '0.98vw' : '0.8vw' } : undefined}>
      {teletype && <div className="hd-perf l" aria-hidden="true" />}
      {teletype && <div className="hd-perf r" aria-hidden="true" />}
      <div className="hd-sheet">
        {teletype ? (
          <>
            <div className="hd-kicker">■ {terminalName || 'TERMINAL'} · TELETYPE OUTPUT ■</div>
            {doc.title && <h2 className="hd-title">{doc.title}</h2>}
            {(doc.from || doc.to || doc.priority || doc.timestamp) && (
              <dl className="hd-head">
                <div><dt>FROM</dt><dd>{doc.from || '—'}</dd></div>
                <div><dt>TO</dt><dd>{doc.to || '—'}</dd></div>
                <div><dt>PRIORITY</dt><dd className={/EMERG|EYES|URGENT|SEALED|IMPERIAL/i.test(doc.priority) ? 'hot' : ''}>{doc.priority || '—'}</dd></div>
                <div><dt>TIMESTAMP</dt><dd>{doc.timestamp || '—'}</dd></div>
              </dl>
            )}
          </>
        ) : (
          <>
            <div className="hd-kicker">FILMBOOK · {terminalName || 'RECORD'}</div>
            {doc.title && <h2 className="hd-title">{doc.title}</h2>}
            {(doc.from || doc.to || doc.priority || doc.timestamp) && (
              <div className="hd-head">
                {doc.from && <span><i>From</i> {doc.from}</span>}
                {doc.to && <span><i>To</i> {doc.to}</span>}
                {doc.priority && <span className="hd-prio">{doc.priority}</span>}
                {doc.timestamp && <span><i>Set down</i> {doc.timestamp}</span>}
              </div>
            )}
            <div className="hd-rule" aria-hidden="true"><span>◆</span></div>
          </>
        )}
        {doc.burnSec > 0 && (
          <div className={`hd-burn${burned ? ' done' : ''}`} role="timer" aria-live="off">
            {burned ? (teletype ? 'CONTENTS PURGED' : 'CONSIGNED TO THE FLAME')
              : left === null ? `BURN AFTER READING · ${formatBurn(doc.burnSec)}` : `BURN IN ${mmss(left)}`}
          </div>
        )}
        {doc.image && !burned && <img className="hd-img" src={doc.image} alt="" />}
        <div className="hd-body" aria-live="off">
          {burned || alreadyBurned ? <Redacted body={doc.body} /> : (
            teletype ? paras(shown) : (
              <>
                {first && <span className="hd-initial" aria-hidden="true">{first}</span>}
                <span className="sr-only">{first}</span>
                {paras(rest)}
              </>
            )
          )}
          {(burned || alreadyBurned) && <div className="hd-stamp">{teletype ? 'REDACTED' : 'BURNED'}</div>}
        </div>
        {/* Full text for screen readers while it types in. */}
        {!done && !burned && <div className="sr-only">{doc.body}</div>}
        {!teletype && <Seal letter={(doc.from || terminalName || '◆').trim()[0]?.toUpperCase() || '◆'} />}
        {teletype && <div className="hd-foot" aria-hidden="true">{burned ? '//// END OF TRANSMISSION — RECORD EXPUNGED ////' : done ? '//// END OF TRANSMISSION ////' : 'RECEIVING…'}</div>}
      </div>
    </article>
  );
}

/**
 * Phone reader (mounted by PlayerView over PhoneLayer's handout viewer while a handout is open).
 * Props: handout (as the phone's table has it), universe, onClose.
 */
export default function HandoutDoc({ handout, universe, onClose }) {
  const ref = useDialog(onClose);
  const doc = useMemo(() => parseDoc(handout || {}), [handout]);
  if (!handout) return null;
  const kind = docStyle(universe);
  return (
    <div className={`hd-overlay k-${kind}`} role="dialog" aria-modal="true" aria-label={handout.title || 'Handout'} ref={ref}>
      <div className="hd-scroll">
        <DocPaper doc={doc} kind={kind} size="phone" terminalName={universe?.terminal?.name} burnId={handout.id} seen={!!handout.seen} typeKey={handout.id} />
      </div>
      <div className="hd-actions">
        <button type="button" className="pv-btn primary hd-close" data-autofocus onClick={onClose}>CLOSE</button>
      </div>
    </div>
  );
}

/* ── Styles (injected once; tokens from the active universe's CSS vars) ── */
const CSS = `
.hd-overlay { position: fixed; inset: 0; z-index: 70; display: flex; flex-direction: column; background: color-mix(in srgb, var(--bg-dark) 94%, #000); }
.hd-scroll { flex: 1 1 auto; overflow-y: auto; overscroll-behavior: contain; padding: max(16px, env(safe-area-inset-top)) 16px 16px; }
.hd-actions { flex: 0 0 auto; padding: 10px 16px max(12px, env(safe-area-inset-bottom)); border-top: 1px solid var(--border); background: var(--bg-dark); }
.hd-close { width: 100%; min-height: 44px; }
.sr-only { position: absolute !important; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

.hd { position: relative; margin: 0 auto; max-width: 720px; }
.hd-body p { margin: 0 0 0.8em; white-space: pre-wrap; overflow-wrap: anywhere; }
.hd-img { display: block; max-width: 100%; margin: 0 auto 0.9em; }
.hd-burn { display: inline-block; margin: 0 0 0.9em; padding: 0.25em 0.7em; font: 700 0.78em var(--font-mono); letter-spacing: 0.14em; border: 1.5px solid currentColor; }
.hd.is-burning .hd-burn { animation: hd-blink 0.6s steps(2) infinite; }
.hd-redacted p { display: flex; flex-wrap: wrap; gap: 0.45em 0.35em; margin: 0 0 0.9em; }
.hd-bar { display: inline-block; height: 1.05em; background: currentColor; opacity: 0.88; }
.hd-stamp { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%) rotate(-12deg); padding: 0.15em 0.6em; font: 700 2.4em var(--font-display); letter-spacing: 0.12em; border: 0.12em solid; pointer-events: none; opacity: 0.85; }
.hd-body { position: relative; }
@keyframes hd-blink { 50% { opacity: 0.25; } }
@keyframes hd-caret { 50% { opacity: 0; } }

/* teletype: tractor-feed greenbar paper */
.hd.k-teletype { --paper: #e6ece2; --ink: #17241c; --bar: rgba(80, 140, 95, 0.16); --holes: #0a0f0c; padding: 0 30px; background: var(--paper); color: var(--ink); box-shadow: 0 0 0 1px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55); font-family: var(--font-mono); }
.hd.k-teletype .hd-sheet { position: relative; padding: 18px 16px 14px; border-left: 1px dashed rgba(23,36,28,0.35); border-right: 1px dashed rgba(23,36,28,0.35);
  background: repeating-linear-gradient(180deg, var(--bar) 0 2.8em, transparent 2.8em 5.6em); }
.hd-perf { position: absolute; top: 0; bottom: 0; width: 30px; background: radial-gradient(circle at 50% 50%, var(--holes) 0 5.5px, transparent 6.5px) 0 0 / 30px 22px repeat-y; }
.hd-perf.l { left: 0; } .hd-perf.r { right: 0; }
.hd.k-teletype .hd-kicker { font-size: 0.72em; letter-spacing: 0.22em; text-align: center; opacity: 0.75; margin-bottom: 0.6em; }
.hd.k-teletype .hd-title { margin: 0 0 0.6em; font: 700 1.25em var(--font-mono); letter-spacing: 0.12em; text-align: center; text-transform: uppercase; }
.hd.k-teletype .hd-head { display: grid; grid-template-columns: 1fr 1fr; margin: 0 0 1em; border: 1.5px solid var(--ink); }
.hd.k-teletype .hd-head > div { padding: 0.35em 0.55em; border: 0.75px solid var(--ink); min-width: 0; }
.hd.k-teletype .hd-head dt { font-size: 0.66em; letter-spacing: 0.2em; opacity: 0.7; }
.hd.k-teletype .hd-head dd { margin: 0.1em 0 0; font-size: 0.92em; letter-spacing: 0.06em; text-transform: uppercase; overflow-wrap: anywhere; }
.hd.k-teletype .hd-head dd.hot { color: #9c1c12; font-weight: 700; }
.hd.k-teletype .hd-body { font-size: 1em; line-height: 1.4; letter-spacing: 0.02em; text-transform: uppercase; }
.hd.k-teletype .hd-burn { color: #9c1c12; }
.hd.k-teletype .hd-stamp { color: #9c1c12; }
.hd.k-teletype .hd-foot { margin-top: 0.4em; font-size: 0.7em; letter-spacing: 0.2em; text-align: center; opacity: 0.6; }
.hd-caret { display: inline-block; width: 0.6em; height: 1.05em; margin-left: 2px; vertical-align: -0.15em; background: var(--ink); animation: hd-caret 0.9s steps(2) infinite; }

/* filmbook: parchment leaf, illuminated initial, wax seal */
.hd.k-filmbook { --ink: #3b2412; --gold: #b07a1e; --wax: #7e1d16; padding: 26px 24px 30px; color: var(--ink);
  background: radial-gradient(ellipse at 30% 20%, #f3e3bd 0%, #e6cf9b 45%, #cfac6e 100%);
  box-shadow: inset 0 0 60px rgba(90, 50, 10, 0.45), 0 0 0 1px rgba(60, 30, 5, 0.6), 0 14px 44px rgba(0,0,0,0.6); border-radius: 3px; font-family: var(--font-body, Georgia, serif); }
.hd.k-filmbook .hd-sheet { position: relative; border: 1px solid rgba(110, 70, 20, 0.45); outline: 1px solid rgba(110, 70, 20, 0.25); outline-offset: 4px; padding: 18px 18px 64px; }
.hd.k-filmbook .hd-kicker { font: 600 0.68em var(--font-display); letter-spacing: 0.3em; text-align: center; color: var(--gold); margin-bottom: 0.4em; }
.hd.k-filmbook .hd-title { margin: 0 0 0.35em; font: 700 1.45em var(--font-display); letter-spacing: 0.08em; text-align: center; }
.hd.k-filmbook .hd-head { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.3em 1.1em; font-size: 0.82em; font-variant: small-caps; letter-spacing: 0.05em; }
.hd.k-filmbook .hd-head i { font-style: italic; opacity: 0.7; margin-right: 0.25em; }
.hd.k-filmbook .hd-prio { color: var(--wax); font-weight: 700; }
.hd-rule { display: flex; align-items: center; gap: 0.6em; margin: 0.7em 0 1em; color: var(--gold); }
.hd-rule::before, .hd-rule::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, transparent, var(--gold), transparent); }
.hd.k-filmbook .hd-body { font-size: 1.02em; line-height: 1.6; }
.hd-initial { float: left; width: 2.6em; height: 2.6em; margin: 0.15em 0.5em 0 0; display: flex; align-items: center; justify-content: center;
  font: 700 1.9em/1 var(--font-display); color: #f6dc8c; background: radial-gradient(circle at 35% 30%, #5b2a7a, #2c1240 75%);
  border: 2px solid var(--gold); box-shadow: inset 0 0 0 3px #2c1240, inset 0 0 0 4px var(--gold); text-shadow: 0 1px 0 #6b3e00, 0 0 6px rgba(246,220,140,0.6); }
.hd.k-filmbook .hd-burn { color: var(--wax); border-radius: 2px; }
.hd.k-filmbook .hd-stamp { color: var(--wax); font-family: var(--font-display); }
.hd.k-filmbook.is-burned { background: radial-gradient(ellipse at 50% 60%, #d9b77a 0%, #a7773a 70%, #5d3814 100%); }
.hd-seal { position: absolute; right: 10px; bottom: 6px; width: 74px; height: 74px; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.45)); }
.hd-seal-wax { fill: var(--wax); }
.hd-seal-ring { fill: none; stroke: rgba(255, 210, 170, 0.35); stroke-width: 2; }
.hd-seal-dots circle { fill: rgba(255, 210, 170, 0.35); }
.hd-seal-letter { fill: rgba(255, 225, 190, 0.85); font: 700 40px var(--font-display); }

/* TV size */
.hd.hd-tv { max-width: min(1180px, 86vw); font-size: clamp(15px, var(--hd-fs, 1.55vw), 30px); }
.hd.hd-tv.k-teletype { padding: 0 44px; }
.hd.hd-tv .hd-perf { width: 44px; background-size: 44px 32px; background-image: radial-gradient(circle at 50% 50%, var(--holes) 0 8px, transparent 9px); }
.hd.hd-tv .hd-seal { width: 110px; height: 110px; }
.hd.hd-tv.k-filmbook .hd-sheet { padding-bottom: 100px; }

@media (prefers-reduced-motion: reduce) { .hd-caret, .hd.is-burning .hd-burn, .hd.k-filmbook .hd-body p { animation: none; } }
html.fx-reduced .hd-caret, html.fx-reduced .hd.is-burning .hd-burn, html.fx-reduced .hd.k-filmbook .hd-body p { animation: none; }
`;

export function ensureDocStyles() {
  if (typeof document === 'undefined' || document.getElementById('handout-doc-css')) return;
  const el = document.createElement('style');
  el.id = 'handout-doc-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}
