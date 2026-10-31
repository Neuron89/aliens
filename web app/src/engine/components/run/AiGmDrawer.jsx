import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '../../GameContext';
import { useUniverse } from '../../UniverseContext';
import { apiHeaders } from '../../apiToken';
import './aigm.css';

/* ═══════════════════════════════════════════════════════════════
   AI GM drawer (Focus Stage dock tab 'ai', docs/AI_GM.md).
   Drafts read-aloud narration through POST /api/gm/narrate (SSE; the local
   model at GM_URL — Ollama on the GPU box — else the pack's own text): OPEN
   THIS SCENE · DESCRIBE WHERE THEY ARE · NPC SPEAKS · IMPROVISE · RECAP
   SO FAR, at SHORT / NORMAL / LONG length. The draft streams into an
   editable box; nothing reaches the table until the GM taps SEND CAPTION,
   SEND AS CARD (narrate), SPEAK (speak(), the voice pipeline) or SEND +
   SPEAK. AUTO (localStorage muthur.aigm.auto) drafts `scene-open` when the
   GM moves to another scene — it never sends by itself.
   State lives in useAiGm(), called by RunView so AUTO works while the
   drawer is closed (the dock badge shows a ready draft).
   ═══════════════════════════════════════════════════════════════ */

export const LENGTHS = [['SHORT', 60], ['NORMAL', 110], ['LONG', 160]];
const AUTO_KEY = 'muthur.aigm.auto';
const LEN_KEY = 'muthur.aigm.length';
const readLs = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } };
const writeLs = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

/* Same helper as run/MoreDrawer.jsx (F5 recap): the GM's dmToken for this code. */
const dmTokenOf = (code) => {
  try {
    const map = JSON.parse(localStorage.getItem('muthur.dmTokens') || '{}');
    if (map?.[code]) return map[code];
    const s = JSON.parse(localStorage.getItem('muthur.session') || '{}');
    return s?.code === code ? s.dmToken : '';
  } catch { return ''; }
};

/** Minimal SSE reader for a fetch Response: calls on(event, data) per message. */
async function readSse(res, on) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      let ev = 'message';
      let data = '';
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) ev = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (data) { try { on(ev, JSON.parse(data)); } catch { /* malformed line */ } }
    }
  }
}

/** Same key as server/gm.js npcKey(): the slug of the name (index as a last resort). */
export const npcKey = (npc, i) => String(npc?.name || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || String(i);

/**
 * AI GM state, owned by RunView (so AUTO keeps watching the scene while the drawer is closed).
 * → { status, text, setText, busy, local, note, kind, title, auto, setAuto, length, setLength,
 *     autoReady, clearReady, generate(kind, { prompt, npcId, title }), discard() }
 */
export function useAiGm({ gameCode, actIndex, sceneIndex, hasScenes, sceneTitle }) {
  const [status, setStatus] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState(null);
  const [note, setNote] = useState('');
  const [kind, setKind] = useState('');
  const [title, setTitle] = useState('');
  const [auto, setAutoState] = useState(() => readLs(AUTO_KEY, '0') === '1');
  const [length, setLengthState] = useState(() => { const n = Number(readLs(LEN_KEY, '110')); return LENGTHS.some(([, w]) => w === n) ? n : 110; });
  const [autoReady, setAutoReady] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    let live = true;
    fetch('/api/gm/status').then((r) => r.json()).then((s) => { if (live) setStatus(s); }).catch(() => { if (live) setStatus({ ok: false, provider: 'none', model: 'template' }); });
    return () => { live = false; abortRef.current?.abort(); };
  }, []);

  const setAuto = useCallback((v) => { setAutoState(v); writeLs(AUTO_KEY, v ? '1' : '0'); }, []);
  const setLength = useCallback((n) => { setLengthState(n); writeLs(LEN_KEY, String(n)); }, []);

  const generate = useCallback(async (k, { prompt = '', npcId, title: t = '', fromAuto = false } = {}) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true); setNote(''); setText(''); setKind(k); setTitle(t); setLocal(null); setAutoReady(false);
    try {
      const res = await fetch('/api/gm/narrate', {
        method: 'POST', signal: ctrl.signal,
        headers: apiHeaders({ 'Content-Type': 'application/json', Accept: 'text/event-stream' }),
        body: JSON.stringify({ code: gameCode, dmToken: dmTokenOf(gameCode), kind: k, prompt: prompt || undefined, npcId, maxWords: length }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(res.status === 403 ? 'Not authorized: this tablet has no GM token for the session (rejoin as GM).' : (j.message || j.error || `HTTP ${res.status}`));
      }
      await readSse(res, (ev, d) => {
        if (ctrl.signal.aborted) return;
        if (ev === 'status') setLocal(d.provider === 'local');
        else if (ev === 'delta') setText(d.text);
        else if (ev === 'done') { setText(d.text); setLocal(d.provider === 'local'); if (d.warning) setNote(d.warning); if (fromAuto) setAutoReady(true); }
        else if (ev === 'error') setNote(d.message || 'Narration failed.');
      });
    } catch (e) {
      if (e?.name !== 'AbortError') setNote(e.message || 'Narration failed.');
    } finally {
      if (abortRef.current === ctrl) { setBusy(false); abortRef.current = null; }
    }
  }, [gameCode, length]);

  const discard = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false); setText(''); setNote(''); setKind(''); setAutoReady(false);
  }, []);

  /* AUTO: a new act/scene → draft scene-open (never on the first render, never sends). */
  const sceneKey = `${actIndex}-${sceneIndex}`;
  const lastKey = useRef(sceneKey);
  useEffect(() => {
    if (lastKey.current === sceneKey) return;
    lastKey.current = sceneKey;
    if (auto && hasScenes && gameCode) generate('scene-open', { title: sceneTitle, fromAuto: true });
  }, [sceneKey, auto, hasScenes, gameCode, generate, sceneTitle]);

  return {
    status, text, setText, busy, local, note, kind, title, auto, setAuto, length, setLength,
    autoReady, clearReady: () => setAutoReady(false), generate, discard,
  };
}

const KIND_LABEL = { 'scene-open': 'SCENE OPENING', describe: 'WHERE THEY ARE', npc: 'NPC', improv: 'IMPROVISED', 'recap-so-far': 'PREVIOUSLY' };

export default function AiGmDrawer({ ai, pack, act, scene }) {
  const { narrate, speak } = useGame();
  const { universe } = useUniverse();
  const npcs = pack?.npcs || [];
  const [npcId, setNpcId] = useState(() => (npcs[0] ? npcKey(npcs[0], 0) : ''));
  const [prompt, setPrompt] = useState('');
  const [sent, setSent] = useState('');
  const canSpeak = typeof speak === 'function';
  const target = (() => { const t = readLs('muthur.voiceTarget', 'tv'); return ['tv', 'gm', 'both'].includes(t) ? t : 'tv'; })();
  const speakLabel = target === 'gm' ? 'SPEAK HERE' : target === 'both' ? 'SPEAK · TV + HERE' : 'SPEAK ON TV';
  const words = (ai.text.match(/\S+/g) || []).length;
  const ready = !!ai.text.trim() && !ai.busy;
  const npc = npcs.find((n, i) => npcKey(n, i) === npcId);
  const sceneTitle = scene?.name || act?.title || '';
  const draftTitle = ai.title || sceneTitle;

  useEffect(() => { if (!npc && npcs[0]) setNpcId(npcKey(npcs[0], 0)); }, [npcId, npc, npcs]);

  const go = (k, extra = {}) => { setSent(''); ai.generate(k, extra); };
  const improvise = () => { if (prompt.trim()) go('improv', { prompt: prompt.trim(), title: sceneTitle }); };
  const after = (msg) => (r) => { setSent(r?.error ? `NOT SENT: ${r.error}` : msg); };
  const sendText = (mode) => {
    narrate(ai.text.trim(), { title: draftTitle, mode }, after(mode === 'card' ? 'SENT AS A CARD.' : 'SENT AS A CAPTION.'));
    ai.clearReady();
  };
  const doSpeak = () => {
    if (!canSpeak) return;
    speak(ai.text.trim(), { target, title: draftTitle }, after(`SPEAKING (${target === 'gm' ? 'HERE' : target === 'both' ? 'TV + HERE' : 'TV'}).`));
    ai.clearReady();
  };
  const sendSpeak = () => {
    narrate(ai.text.trim(), { title: draftTitle, mode: 'caption' });
    if (canSpeak) speak(ai.text.trim(), { target, title: draftTitle }, after('SENT AS A CAPTION AND SPEAKING.'));
    ai.clearReady();
  };

  const st = ai.status;
  const statusLine = !st ? 'AI GM: checking…'
    : st.ok ? `AI GM: ${st.model} (local)`
      : 'AI GM offline — set GM_URL in web app/.env (Ollama on the GPU box); the pack\'s own text is used';
  const noVoice = canSpeak ? undefined : 'voice not available';

  return (
    <div className="ag">
      <p className={`ag-status${st && !st.ok ? ' off' : ''}`} role="status">
        {statusLine}
        {st?.vram?.comfy && st?.vram?.ollama ? <small className="ag-handoff">GPU hand-off: ComfyUI ↔ Ollama</small> : null}
      </p>

      <div className="ag-row">
        <span className="fs-label">LENGTH</span>
        <div className="run-seg ag-seg" role="group" aria-label="Length">
          {LENGTHS.map(([label, n]) => (
            <button key={n} type="button" className={ai.length === n ? 'on' : ''} aria-pressed={ai.length === n} onClick={() => ai.setLength(n)} title={`about ${n} words`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="ag-kinds">
        <button type="button" className="fs-btn primary" onClick={() => go('scene-open', { title: sceneTitle })} disabled={ai.busy || (!scene && !act)}>OPEN THIS SCENE</button>
        <button type="button" className="fs-btn" onClick={() => go('describe', { title: sceneTitle })} disabled={ai.busy}>DESCRIBE WHERE THEY ARE</button>
        <button type="button" className="fs-btn" onClick={() => go('recap-so-far', { title: 'PREVIOUSLY' })} disabled={ai.busy}>RECAP SO FAR</button>
      </div>

      {npcs.length > 0 && (
        <div className="ag-npc">
          <label className="fs-label" htmlFor="ag-npc">NPC SPEAKS</label>
          <div className="ag-line">
            <select id="ag-npc" value={npcId} onChange={(e) => setNpcId(e.target.value)}>
              {npcs.map((n, i) => <option key={npcKey(n, i)} value={npcKey(n, i)}>{n.name}{n.role ? ` — ${n.role}` : ''}</option>)}
            </select>
            <button type="button" className="fs-btn" disabled={ai.busy || !npc} onClick={() => go('npc', { npcId, title: npc?.name || '' })}>SPEAK AS</button>
          </div>
        </div>
      )}

      <div className="ag-improv">
        <label className="fs-label" htmlFor="ag-prompt">IMPROVISE</label>
        <div className="ag-line">
          <input id="ag-prompt" type="text" value={prompt} maxLength={600} onChange={(e) => setPrompt(e.target.value)}
            placeholder="What just happened? e.g. they cut the power"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) { e.preventDefault(); improvise(); } }} />
          <button type="button" className="fs-btn" disabled={ai.busy || !prompt.trim()} onClick={improvise}>IMPROVISE</button>
        </div>
      </div>

      <div className="ag-auto">
        <button type="button" className={`run-chip${ai.auto ? ' on' : ''}`} aria-pressed={ai.auto} onClick={() => ai.setAuto(!ai.auto)}>AUTO {ai.auto ? 'ON' : 'OFF'}</button>
        <span className="nd-hint">AUTO drafts the opening whenever you move to another scene. It never sends by itself.</span>
      </div>

      {ai.autoReady && ready && <p className="ag-ready" role="status">READY — review the opening, then SEND + SPEAK.</p>}

      {(ai.text || ai.busy) && (
        <div className="ag-draft">
          <div className="ag-row">
            <span className="fs-label">{KIND_LABEL[ai.kind] || 'DRAFT'}{draftTitle ? ` · ${draftTitle}` : ''}</span>
            <span className="run-dim">{ai.busy ? 'WRITING…' : `${words} words · ${ai.local ? 'local AI' : 'pack text'}`}</span>
          </div>
          <textarea className="ag-text" value={ai.text} onChange={(e) => ai.setText(e.target.value)} readOnly={ai.busy} rows={8}
            aria-label="Narration draft" aria-busy={ai.busy} placeholder="…" />
        </div>
      )}
      {ai.note && <p className="run-warn" role="status">{ai.note}</p>}

      {(ready || ai.busy) && (
        <div className="ag-send">
          <button type="button" className="fs-btn primary" disabled={!ready} onClick={() => sendText('caption')}>SEND CAPTION</button>
          <button type="button" className="fs-btn" disabled={!ready} onClick={() => sendText('card')}>SEND AS CARD</button>
          <button type="button" className="fs-btn" disabled={!ready || !canSpeak} title={noVoice} onClick={doSpeak}>{speakLabel}</button>
          <button type="button" className={`fs-btn${ai.autoReady ? ' primary' : ''}`} disabled={!ready || !canSpeak} title={noVoice} onClick={sendSpeak}>SEND + SPEAK</button>
          <button type="button" className="fs-btn ag-discard" onClick={ai.discard}>{ai.busy ? 'STOP' : 'DISCARD'}</button>
        </div>
      )}
      {sent && <p className="run-dim" role="status">{sent}</p>}
      {!ai.text && !ai.busy && !ai.note && (
        <p className="run-empty">
          Pick what to narrate. The draft lands here for you to edit; nothing reaches the {universe?.terms?.players ? universe.terms.players.toLowerCase() : 'table'} until you send it.
        </p>
      )}
    </div>
  );
}
