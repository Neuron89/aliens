import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../GameContext';
import { useUniverse } from '../../UniverseContext';
import { apiHeaders } from '../../apiToken';
import ApiTokenPrompt from '../ApiTokenPrompt';
const needsToken = (t) => /api token/i.test(String(t || ''));
import { Glyph } from '../board/TokenChip';
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
   Wave 2 adds two tabs (docs/AI_GM.md "AI BUILD" / "Room entry"):
   BUILD  — POST /api/gm/build asks the model to dress the map on the table
            (density SPARSE/NORMAL/DENSE); the plan is listed per room with
            an APPLY toggle each; APPLY SELECTED places the tokens (ai:true),
            CLEAR AI BUILD removes them. The build keeps running with the
            drawer closed (state lives in useAiBuild, inside useAiGm).
   ROOMS  — ENTRY OFF | REVIEW | LIVE + VOICE (`ai-gm-set`), the feed of
            `room-entered` events with the `ai-gm-draft` for each: REVIEW =
            the GM sends (caption / + voice / ask the roll), LIVE = the server
            already did; the feed shows what it did. The dock badge counts
            drafts the GM has not looked at yet (ai.rooms.unseen).
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

const TAB_KEY = 'muthur.aigm.tab';
const DENSITY_KEY = 'muthur.aigm.density';
export const DENSITIES = [['SPARSE', 'sparse'], ['NORMAL', 'normal'], ['DENSE', 'dense']];
const FEED_CAP = 30;
const roomsOf = (pl) => Object.keys(pl?.rooms || {});

/**
 * Room-entry feed (DM): room-entered events, each paired with its ai-gm-draft when it arrives.
 * → { feed:[{ key, playerId, tokenId, roomId, fromRoomId, name, roomName, at, draft|null, mode, done:{} }],
 *     unseen, markSeen(), mark(key, patch), editDraft(key, text), dismiss(key), clear() }
 */
export function useAiRooms() {
  const { onRoomEntered, onAiGmDraft, table } = useGame();
  const [feed, setFeed] = useState([]);
  const [unseen, setUnseen] = useState(0);
  const entryRef = useRef('off');
  entryRef.current = table?.aiGm?.entry || 'off';

  useEffect(() => {
    if (!onRoomEntered || !onAiGmDraft) return undefined;
    const offA = onRoomEntered((e) => {
      if (!e?.roomId) return;
      const key = `${e.playerId || e.tokenId || '?'}-${e.roomId}-${e.at || Date.now()}`;
      setFeed((f) => [{ key, ...e, at: e.at || Date.now(), draft: null, mode: entryRef.current, done: {} }, ...f].slice(0, FEED_CAP));
    });
    const offB = onAiGmDraft((d) => {
      if (!d?.text && !d?.check) return;
      const draft = { id: d.id, text: String(d.text || ''), check: d.check || null, at: d.at || Date.now(), live: d.mode ? d.mode === 'live' : entryRef.current === 'live', flags: d };
      setFeed((f) => {
        // the newest entry of this player into this room still waiting for its draft
        const i = f.findIndex((x) => !x.draft && x.roomId === d.roomId && (!d.playerId || !x.playerId || x.playerId === d.playerId));
        if (i >= 0) { const n = [...f]; n[i] = { ...n[i], draft, mode: draft.live ? 'live' : n[i].mode }; return n; }
        return [{ key: `d-${d.id || Date.now()}`, playerId: d.playerId, roomId: d.roomId, roomName: d.roomName, name: d.name, at: d.at || Date.now(), draft, mode: draft.live ? 'live' : 'review', done: {} }, ...f].slice(0, FEED_CAP);
      });
      setUnseen((n) => n + 1);
    });
    return () => { offA?.(); offB?.(); };
  }, [onRoomEntered, onAiGmDraft]);

  const mark = useCallback((key, patch) => setFeed((f) => f.map((x) => (x.key === key ? { ...x, done: { ...x.done, ...patch } } : x))), []);
  const editDraft = useCallback((key, text) => setFeed((f) => f.map((x) => (x.key === key && x.draft ? { ...x, draft: { ...x.draft, text } } : x))), []);
  const dismiss = useCallback((key) => setFeed((f) => f.filter((x) => x.key !== key)), []);
  const clear = useCallback(() => setFeed([]), []);
  const markSeen = useCallback(() => setUnseen(0), []);
  return { feed, unseen, markSeen, mark, editDraft, dismiss, clear };
}

/**
 * AI BUILD state (DM). The build request can take 10–30 s on the local model, so it lives with RunView.
 * → { plan, provider, density, setDensity, busy, startedAt, error, msg, selected:{[roomId]:bool}, toggle(id),
 *     setAll(bool), build(), apply(), clear(), applying }
 */
export function useAiBuild({ gameCode }) {
  const { aiBuild, aiBuildApply, aiBuildClear, aiBuildGet, table, board } = useGame();
  const [plan, setPlan] = useState(null);
  const [provider, setProvider] = useState('');
  const [density, setDensityState] = useState(() => { const d = readLs(DENSITY_KEY, 'normal'); return DENSITIES.some(([, v]) => v === d) ? d : 'normal'; });
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [selected, setSelected] = useState({});
  const seq = useRef(0);
  const setDensity = useCallback((d) => { setDensityState(d); writeLs(DENSITY_KEY, d); }, []);
  const take = useCallback((pl) => {
    setPlan(pl || null);
    setSelected(Object.fromEntries(roomsOf(pl).map((id) => [id, true])));
  }, []);

  /* A plan already stored for this session (built earlier, or applied: table.aiPlan) — restore it once. */
  useEffect(() => {
    if (!gameCode || !aiBuildGet) return undefined;
    let live = true;
    aiBuildGet().then((r) => { if (live && r?.plan && !seq.current) take(r.plan); }).catch(() => { /* server without AI BUILD yet */ });
    return () => { live = false; };
  }, [gameCode, aiBuildGet, take]);
  useEffect(() => { if (!plan && table?.aiPlan?.rooms && !busy) take(table.aiPlan); }, [plan, table?.aiPlan, busy, take]);

  const build = useCallback(async () => {
    if (!aiBuild || busy) return;
    const my = ++seq.current;
    setBusy(true); setError(''); setMsg(''); setStartedAt(Date.now());
    try {
      const r = await aiBuild({ density, mapId: board?.mapId || undefined });
      if (seq.current !== my) return;
      take(r?.plan || null);
      setProvider(r?.provider || '');
      const n = roomsOf(r?.plan).length;
      setMsg(n ? `PLAN READY — ${n} ROOM${n === 1 ? '' : 'S'}. REVIEW, THEN APPLY SELECTED.` : 'THE PLAN CAME BACK EMPTY.');
    } catch (e) {
      if (seq.current === my) setError(e.message || 'Build failed.');
    } finally {
      if (seq.current === my) setBusy(false);
    }
  }, [aiBuild, busy, density, board?.mapId, take]);

  const apply = useCallback(async () => {
    if (!plan || !aiBuildApply) return;
    const rooms = Object.keys(selected).filter((id) => selected[id]);
    if (!rooms.length) { setMsg('NOTHING SELECTED.'); return; }
    setApplying(true); setError(''); setMsg('');
    try {
      const r = await aiBuildApply(plan, rooms);
      const a = r?.applied || {};
      const nr = Array.isArray(a.rooms) ? a.rooms.length : Number(a.rooms) || rooms.length;
      const nt = Array.isArray(a.tokens) ? a.tokens.length : Number(a.tokens) || 0;
      setMsg(`APPLIED ${nr} ROOM${nr === 1 ? '' : 'S'} · ${nt} TOKEN${nt === 1 ? '' : 'S'} ON THE MAP.`);
    } catch (e) { setError(e.message || 'Apply failed.'); }
    finally { setApplying(false); }
  }, [plan, selected, aiBuildApply]);

  const clear = useCallback(async () => {
    if (!aiBuildClear) return;
    setApplying(true); setError(''); setMsg('');
    try {
      const r = await aiBuildClear();
      const n = Array.isArray(r?.removed) ? r.removed.length : Number(r?.removed) || 0;
      seq.current += 1; setBusy(false);
      setPlan(null); setSelected({}); setProvider('');
      setMsg(`AI BUILD CLEARED — ${n} TOKEN${n === 1 ? '' : 'S'} REMOVED.`);
    } catch (e) { setError(e.message || 'Clear failed.'); }
    finally { setApplying(false); }
  }, [aiBuildClear]);

  const toggle = useCallback((id) => setSelected((m) => ({ ...m, [id]: !m[id] })), []);
  const setAll = useCallback((v) => setSelected((m) => Object.fromEntries(Object.keys(m).map((id) => [id, v]))), []);
  return { plan, provider, density, setDensity, busy, applying, startedAt, error, msg, selected, toggle, setAll, build, apply, clear };
}

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

  const rooms = useAiRooms();
  const build = useAiBuild({ gameCode });

  return {
    status, text, setText, busy, local, note, kind, title, auto, setAuto, length, setLength,
    autoReady, clearReady: () => setAutoReady(false), generate, discard,
    rooms, build,
  };
}

const KIND_LABEL = { 'scene-open': 'SCENE OPENING', describe: 'WHERE THEY ARE', npc: 'NPC', improv: 'IMPROVISED', 'recap-so-far': 'PREVIOUSLY' };

function NarrateTab({ ai, pack, act, scene }) {
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
      {needsToken(ai.note) && <ApiTokenPrompt />}

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

/* ─── BUILD tab ───────────────────────────────────────────────── */
const KIND_MARK = { item: 'ITEM', creature: 'CREATURE', npc: 'NPC', marker: 'MARKER', hazard: 'HAZARD' };

export function checkLine(check, skillLabel) {
  if (!check?.skill) return '';
  const d = check.difficulty;
  const diff = d === null || d === undefined || d === '' ? '' : ` (difficulty ${d})`;
  return `ROLL ${String(skillLabel(check.skill)).toUpperCase()}${diff}${check.label ? `: ${check.label}` : ''}`;
}

function useSkillLabel() {
  const { universe } = useUniverse();
  const skills = universe?.rules?.skills || [];
  return useCallback((key) => skills.find((x) => x.key === key)?.label || key, [skills]);
}

function Elapsed({ since }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  return <>{Math.max(0, Math.round((now - since) / 1000))} s</>;
}

function BuildTab({ ai }) {
  const { board, mapDef, table } = useGame();
  const appliedIds = new Set(table?.aiPlan?.mapId === board?.mapId ? table?.aiPlan?.applied || [] : []);
  const b = ai.build;
  const skillLabel = useSkillLabel();
  const st = ai.status;
  const hasMap = !!board?.mapId && !!mapDef;
  const roomName = (id) => board?.rooms?.[id]?.name || mapDef?.rooms?.find((r) => r.id === id)?.name || id;
  const aiTokens = Object.values(board?.tokens || {}).filter((t) => t.ai).length;
  const planRooms = Object.entries(b.plan?.rooms || {});
  const nSel = planRooms.filter(([id]) => b.selected[id]).length;
  const planOther = b.plan?.mapId && board?.mapId && b.plan.mapId !== board.mapId;
  const source = b.provider ? (b.provider === 'local' ? `model ${st?.model || 'local'}` : 'template (pack text)')
    : st ? (st.ok ? `model ${st.model}` : 'template (no model)') : '…';
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => { if (!confirmClear) return undefined; const t = setTimeout(() => setConfirmClear(false), 4000); return () => clearTimeout(t); }, [confirmClear]);

  return (
    <div className="ag">
      <p className="ag-status" role="status">
        AI BUILD: {source} · {aiTokens} AI TOKEN{aiTokens === 1 ? '' : 'S'} ON THE BOARD
        {hasMap ? <small className="ag-handoff">MAP: {mapDef.title || board.mapId}</small> : null}
      </p>
      {!hasMap && <p className="run-warn" role="status">Put a map on the table first (MAP drawer) — the build dresses the map that is up.</p>}

      <div className="ag-row">
        <span className="fs-label">DENSITY</span>
        <div className="run-seg ag-seg" role="group" aria-label="Density">
          {DENSITIES.map(([label, v]) => (
            <button key={v} type="button" className={b.density === v ? 'on' : ''} aria-pressed={b.density === v} onClick={() => b.setDensity(v)}
              title={v === 'sparse' ? 'about 1 token per 2 rooms' : v === 'dense' ? '2–3 tokens per room' : '1–2 tokens per room'}>{label}</button>
          ))}
        </div>
      </div>

      <div className="ag-build-go">
        <button type="button" className="fs-btn primary" disabled={!hasMap || b.busy || b.applying} onClick={b.build}>
          {b.busy ? <><span className="ag-spin" aria-hidden="true" /> BUILDING… <Elapsed since={b.startedAt} /></> : planRooms.length ? 'REBUILD' : 'BUILD THIS MAP'}
        </button>
        {b.busy && <span className="nd-hint">The local model takes 10–30 s. You can close the drawer; the plan waits here.</span>}
      </div>

      {b.error && <p className="run-warn" role="status">{b.error}</p>}
      {needsToken(b.error) && <ApiTokenPrompt />}
      {b.msg && <p className="ag-ready" role="status">{b.msg}</p>}
      {planOther && <p className="run-warn">This plan was built for another map ({b.plan.mapId}). REBUILD for the map on the table.</p>}

      {planRooms.length > 0 && (
        <>
          <div className="ag-row">
            <span className="fs-label">PLAN · {planRooms.length} ROOMS{b.plan?.density ? ` · ${String(b.plan.density).toUpperCase()}` : ''}</span>
            <span className="ag-mini">
              <button type="button" className="run-chip" onClick={() => b.setAll(true)}>ALL</button>
              <button type="button" className="run-chip" onClick={() => b.setAll(false)}>NONE</button>
            </span>
          </div>
          <ul className="ag-plan">
            {planRooms.map(([id, r]) => {
              const on = !!b.selected[id];
              const line = checkLine(r.check, skillLabel);
              return (
                <li key={id} className={`ag-proom${on ? '' : ' off'}`}>
                  <div className="ag-proom-head">
                    <b>{roomName(id)}</b>
                    {r.mood && <span className="ag-mood">{r.mood}</span>}
                    {appliedIds.has(id) && <span className="ag-onboard">ON THE BOARD</span>}
                    <button type="button" className={`run-chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => b.toggle(id)}
                      aria-label={`Apply ${roomName(id)}`}>APPLY {on ? 'ON' : 'OFF'}</button>
                  </div>
                  {r.description && <p className="ag-desc">{r.description}</p>}
                  {(r.tokens || []).length > 0 && (
                    <ul className="ag-toks">
                      {r.tokens.map((t, i) => (
                        <li key={i} className={`ag-tok k-${t.kind}`} title={t.note || ''}>
                          {t.glyph && <svg viewBox="-12 -12 24 24" width="14" height="14" aria-hidden="true"><Glyph name={t.glyph} r={9} color="currentColor" /></svg>}
                          <small>{KIND_MARK[t.kind] || String(t.kind || '').toUpperCase()}</small>
                          <span>{t.label}</span>
                          {t.hidden && <em>HIDDEN</em>}
                          {t.locked && <em>LOCKED</em>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {line && <p className="ag-check">{line}</p>}
                  {(r.hazard || r.loot) && <p className="run-dim ag-extra">{r.hazard ? `HAZARD: ${r.hazard}` : ''}{r.hazard && r.loot ? ' · ' : ''}{r.loot ? `LOOT: ${r.loot}` : ''}</p>}
                </li>
              );
            })}
          </ul>
          <div className="ag-send">
            <button type="button" className="fs-btn primary" disabled={!nSel || b.busy || b.applying || !hasMap} onClick={b.apply}>
              {b.applying ? 'APPLYING…' : `APPLY SELECTED (${nSel})`}
            </button>
            <button type="button" className="fs-btn" disabled={!hasMap || b.busy || b.applying} onClick={b.build}>REBUILD</button>
          </div>
        </>
      )}

      {(aiTokens > 0 || planRooms.length > 0) && (
        <button type="button" className={`fs-btn ag-discard${confirmClear ? ' warn' : ''}`} disabled={b.applying}
          onClick={() => { if (!confirmClear) { setConfirmClear(true); return; } setConfirmClear(false); b.clear(); }}>
          {confirmClear ? `TAP AGAIN: REMOVE ${aiTokens} AI TOKEN${aiTokens === 1 ? '' : 'S'} + THE PLAN` : 'CLEAR AI BUILD'}
        </button>
      )}
      {!planRooms.length && !b.busy && (
        <p className="run-empty">BUILD THIS MAP asks the AI to dress every room of the map on the table — items, creatures, NPCs, hazards and a check per room. Nothing reaches the board until you APPLY; creatures and NPCs go on hidden.</p>
      )}
    </div>
  );
}

/* ─── ROOMS tab ───────────────────────────────────────────────── */
const ENTRY_MODES = [['OFF', 'off'], ['REVIEW', 'review'], ['LIVE', 'live']];
const clock = (at) => { try { return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

/** Live mode: what the server did for this entry, read from the draft flags + the session log. */
function liveMarks(x, log, aiGm) {
  const d = x.draft?.flags || {};
  const done = d.sent && typeof d.sent === 'object' ? d.sent : null; // server/sessions.js reactToEntry (live)
  const room = String(x.roomName || '').toLowerCase();
  const after = (e) => e.at >= (x.at || 0) - 1500 && e.at <= (x.at || 0) + 180000;
  const near = (log || []).filter(after);
  const has = (fn) => near.some(fn);
  const txt = (e) => String(e.text || '').toLowerCase();
  const sent = !!done?.narrationId || has((e) => e.type === 'narration' && !txt(e).startsWith('voice:') && (!room || txt(e).includes(room)));
  const spoken = !!done?.speechId || has((e) => e.type === 'narration' && txt(e).startsWith('voice:') && (!room || txt(e).includes(room)));
  const roll = !!done?.rollRequestId || (!!x.draft?.check && has((e) => e.type === 'roll' && txt(e).startsWith('gm asked') && (!x.name || txt(e).includes(String(x.name).toLowerCase()))));
  return { sent, spoken, roll, speechError: done?.speechError || '', voiceAsked: !!aiGm?.voice || !!done?.speechId || !!done?.speechError };
}

function RoomsTab({ ai }) {
  const { table, aiGmSet, narrate, speak, rollRequest, players, sessionLog } = useGame();
  const skillLabel = useSkillLabel();
  const r = ai.rooms;
  const aiGm = table?.aiGm || { entry: 'off', voice: false };
  const entry = aiGm.entry || 'off';
  const [note, setNote] = useState('');
  const canSpeak = typeof speak === 'function';
  const target = (() => { const t = readLs('muthur.voiceTarget', 'tv'); return ['tv', 'gm', 'both'].includes(t) ? t : 'tv'; })();
  const { markSeen } = r;
  useEffect(() => { markSeen(); }, [markSeen, r.unseen]);
  useEffect(() => { if (!note) return undefined; const t = setTimeout(() => setNote(''), 4000); return () => clearTimeout(t); }, [note]);
  const set = (patch) => aiGmSet?.({ entry, voice: !!aiGm.voice, ...patch }, (res) => { if (res?.error) setNote(`NOT SET: ${res.error}`); });
  const who = (x) => x.name || players?.[x.playerId]?.character?.name || players?.[x.playerId]?.name || 'SOMEONE';
  const ack = (key, field, label) => (res) => {
    if (res?.error) { setNote(`NOT SENT: ${res.error}`); return; }
    r.mark(key, { [field]: true }); setNote(label);
  };
  const sendCaption = (x) => narrate(x.draft.text.trim(), { title: x.roomName || '', mode: 'caption' }, ack(x.key, 'sent', 'SENT AS A CAPTION.'));
  const sendSpeak = (x) => {
    narrate(x.draft.text.trim(), { title: x.roomName || '', mode: 'caption' }, ack(x.key, 'sent', 'SENT AS A CAPTION.'));
    if (canSpeak) speak(x.draft.text.trim(), { target, title: x.roomName || '' }, ack(x.key, 'spoken', 'SENT AND SPEAKING.'));
  };
  const askRoll = (x) => {
    const c = x.draft.check;
    rollRequest({ skill: c.skill, label: c.label || skillLabel(c.skill), difficulty: c.difficulty ?? null, note: c.note || '', to: x.playerId }, ack(x.key, 'roll', `ROLL ASKED OF ${who(x).toUpperCase()}.`));
  };

  return (
    <div className="ag">
      <div className="ag-row">
        <span className="fs-label">ENTRY</span>
        <div className="run-seg ag-seg" role="group" aria-label="AI reaction when a player enters a room">
          {ENTRY_MODES.map(([label, v]) => (
            <button key={v} type="button" className={entry === v ? 'on' : ''} aria-pressed={entry === v} onClick={() => set({ entry: v })}>{label}</button>
          ))}
        </div>
      </div>
      <div className="ag-auto">
        <button type="button" className={`run-chip${aiGm.voice ? ' on' : ''}`} aria-pressed={!!aiGm.voice} onClick={() => set({ voice: !aiGm.voice })}>VOICE {aiGm.voice ? 'ON' : 'OFF'}</button>
        <span className="nd-hint">
          {entry === 'off' ? 'Players can still walk through doors (EXITS on their phone); the AI stays quiet.'
            : entry === 'review' ? 'The AI drafts what they find; you send it (and ask the roll).'
              : `The AI narrates to the table by itself${aiGm.voice ? ', speaks it' : ''} and asks the room's roll.`}
        </span>
      </div>
      {note && <p className="run-dim" role="status">{note}</p>}
      {needsToken(note) && <ApiTokenPrompt />}

      {r.feed.length === 0 ? (
        <p className="run-empty">Room entries show up here — when a player taps ENTER on their phone, or you drag a player's token into another room.</p>
      ) : (
        <ul className="ag-feed">
          {r.feed.map((x) => {
            const d = x.draft;
            const live = x.mode === 'live' || d?.live;
            const m = live ? liveMarks(x, sessionLog, aiGm) : null;
            const ready = !!d?.text?.trim();
            return (
              <li key={x.key} className="ag-entry">
                <div className="ag-row">
                  <span className="ag-entry-head"><b>{who(x)}</b> → {x.roomName || x.roomId}{x.visits > 1 ? <small> · visit {x.visits}</small> : null}{x.by === 'gm' ? <small> · your drag</small> : null}</span>
                  <span className="run-dim">{clock(x.at)}{d?.flags?.provider ? ` · ${d.flags.provider === 'local' ? 'local AI' : 'pack text'}` : ''}</span>
                </div>
                {!d && (x.mode === 'off'
                  ? <p className="run-dim">ENTRY is OFF — no AI reaction.</p>
                  : <p className="run-dim"><span className="ag-spin" aria-hidden="true" /> THE AI IS WRITING…</p>)}
                {d && (
                  <>
                    <textarea className="ag-text ag-text-sm" value={d.text} rows={4} readOnly={live}
                      onChange={(e) => r.editDraft(x.key, e.target.value)} aria-label={`What ${who(x)} finds in ${x.roomName || 'the room'}`} />
                    {d.check && <p className="ag-check">{checkLine(d.check, skillLabel)}</p>}
                    {d.flags?.warning && <p className="run-warn">{d.flags.warning}</p>}
                    {live ? (
                      <p className="ag-marks">
                        <span className={m.sent ? 'on' : ''}>SENT</span>
                        {m.voiceAsked ? <span className={m.speechError ? 'err' : m.spoken ? 'on' : ''} title={m.speechError || undefined}>{m.speechError ? 'VOICE FAILED' : 'SPOKEN'}</span> : null}
                        {d.check ? <span className={m.roll ? 'on' : ''}>ROLL ASKED</span> : null}
                      </p>
                    ) : (
                      <div className="ag-send">
                        <button type="button" className="fs-btn primary" disabled={!ready} onClick={() => sendCaption(x)}>{x.done.sent ? 'SENT ✓' : 'SEND CAPTION'}</button>
                        <button type="button" className="fs-btn" disabled={!ready || !canSpeak} onClick={() => sendSpeak(x)}>{x.done.spoken ? 'SPOKEN ✓' : 'SEND + SPEAK'}</button>
                        {d.check && x.playerId && (
                          <button type="button" className="fs-btn ag-ask" onClick={() => askRoll(x)}>
                            {x.done.roll ? 'ROLL ASKED ✓' : `ASK ${who(x).toUpperCase()} TO ROLL ${String(skillLabel(d.check.skill)).toUpperCase()}`}
                          </button>
                        )}
                        <button type="button" className="fs-btn ag-discard" onClick={() => r.dismiss(x.key)}>DISMISS</button>
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {r.feed.length > 0 && <button type="button" className="run-chip ag-clearfeed" onClick={r.clear}>CLEAR FEED</button>}
    </div>
  );
}

/* ─── Drawer: NARRATE | BUILD | ROOMS ─────────────────────────── */
const TABS = [['narrate', 'NARRATE'], ['build', 'BUILD'], ['rooms', 'ROOMS']];

export default function AiGmDrawer({ ai, pack, act, scene }) {
  const [tab, setTabState] = useState(() => { const t = readLs(TAB_KEY, 'narrate'); return TABS.some(([id]) => id === t) ? t : 'narrate'; });
  const setTab = (t) => { setTabState(t); writeLs(TAB_KEY, t); };
  const unseen = ai.rooms?.unseen || 0;
  const label = useMemo(() => ({
    narrate: 'NARRATE',
    build: ai.build?.busy ? 'BUILD …' : 'BUILD',
    rooms: unseen && tab !== 'rooms' ? `ROOMS ● ${unseen}` : 'ROOMS',
  }), [ai.build?.busy, unseen, tab]);
  const onKey = (e) => {
    const i = TABS.findIndex(([id]) => id === tab);
    const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
    if (n === undefined) return;
    e.preventDefault();
    const next = TABS[(n + TABS.length) % TABS.length][0];
    setTab(next);
    requestAnimationFrame(() => e.currentTarget?.querySelector?.(`[data-tab="${next}"]`)?.focus());
  };
  return (
    <div className="ag-wrap">
      <div className="md-tabs ag-tabs" role="tablist" aria-label="AI GM" onKeyDown={onKey}>
        {TABS.map(([id]) => (
          <button key={id} type="button" role="tab" data-tab={id} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1}
            className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label[id]}</button>
        ))}
      </div>
      <div role="tabpanel" aria-label={label[tab]}>
        {tab === 'narrate' && <NarrateTab ai={ai} pack={pack} act={act} scene={scene} />}
        {tab === 'build' && ai.build && <BuildTab ai={ai} />}
        {tab === 'rooms' && ai.rooms && <RoomsTab ai={ai} />}
      </div>
    </div>
  );
}
