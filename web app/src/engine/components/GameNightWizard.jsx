import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useUniverse } from '../UniverseContext';
import { useContent } from '../ContentContext';
import { useGame } from '../GameContext';
import { downloadJson } from '../rulesUtils';
import ScenarioDetail from './ScenarioDetail';
import { runGeneration, fetchGeneratorStatus } from './wizard/generateClient';

/* ═══════════════════════════════════════════════════════════════
   GAME NIGHT WIZARD — parameters → /api/generate (SSE) → preview → save → start.
   Steps: CREW → MISSION → GENERATE → PREVIEW. Universe-agnostic: wording from
   universe.terms/terminal, hints from universe.generator.parameterHints.
   Last-used params are remembered per universe in localStorage.
   ═══════════════════════════════════════════════════════════════ */

const PLAYTIMES = [
  { value: 'one-shot 2-3h', label: 'ONE-SHOT', sub: '2–3 h · 1–2 acts' },
  { value: 'session 3-5h', label: 'SESSION', sub: '3–5 h · 3 acts' },
  { value: 'long 5-8h', label: 'LONG', sub: '5–8 h · 3 acts' },
];
const TYPES = ['Cinematic', 'One-Shot', 'Campaign'];
const DIFFICULTIES = ['Introductory', 'Standard', 'Brutal'];
const LETHALITIES = ['low', 'medium', 'high'];
const STEPS = ['crew', 'mission', 'generate', 'preview'];
const STEP_LABEL = { crew: 'CREW', mission: 'MISSION', generate: 'GENERATE', preview: 'PREVIEW' };

const storageKey = (uid) => `gamenight.params.${uid}`;

function defaultParams(universe) {
  const d = universe.generator?.defaults || {};
  return {
    players: Number.isInteger(d.players) ? d.players : 4,
    playerNames: [],
    playtime: 'session 3-5h',
    type: TYPES.includes(d.type) ? d.type : 'Cinematic',
    difficulty: 'Standard',
    lethality: 'medium',
    tone: Array.isArray(d.tone) ? d.tone : [],
    setting: '',
    threat: 'surprise me',
    themes: '',
    avoid: '',
    includeMaps: true,
    seedTitle: '',
  };
}

function loadParams(universe) {
  const base = defaultParams(universe);
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(universe.id)) || 'null');
    if (saved && typeof saved === 'object') return { ...base, ...saved };
  } catch { /* storage unavailable */ }
  return base;
}

/** Params as sent to the server (drops empty optionals). */
function requestParams(p) {
  const out = {
    players: p.playerNames.length ? p.playerNames.length : p.players,
    playtime: p.playtime, type: p.type, difficulty: p.difficulty, lethality: p.lethality,
    tone: p.tone, setting: p.setting.trim(), threat: p.threat.trim() || 'surprise me',
    themes: p.themes.trim(), avoid: p.avoid.trim(), includeMaps: !!p.includeMaps,
  };
  if (p.playerNames.length) out.playerNames = p.playerNames;
  if (p.seedTitle.trim()) out.seedTitle = p.seedTitle.trim();
  return out;
}

const hintList = (hints, ...keys) => {
  for (const k of keys) if (Array.isArray(hints?.[k]) && hints[k].length) return hints[k];
  return [];
};

export default function GameNightWizard({ tts, onClose, onImport, onOpenPack }) {
  const { universe } = useUniverse();
  const { save } = useContent();
  const { createGame, players: sessionPlayers } = useGame();
  const { terms, terminal } = universe;
  const hints = universe.generator?.parameterHints || {};
  const settingHints = hintList(hints, 'settings', 'setting');
  const threatHints = hintList(hints, 'threats', 'threat');
  const toneHints = hintList(hints, 'tones', 'tone');

  const [params, setParams] = useState(() => loadParams(universe));
  const [step, setStep] = useState('crew');
  const [genStatus, setGenStatus] = useState(undefined); // undefined = loading, null = unreachable
  const [notConfigured, setNotConfigured] = useState(null); // { hint } when server says so
  const [log, setLog] = useState([]);
  const [chars, setChars] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [estTokens, setEstTokens] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [pack, setPack] = useState(null);
  const [repaired, setRepaired] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErrors, setSaveErrors] = useState([]);
  const [nameDraft, setNameDraft] = useState('');
  const [toneDraft, setToneDraft] = useState('');
  const abortRef = useRef(null);
  const logRef = useRef(null);

  // Re-load params if the universe changes under us.
  useEffect(() => { setParams(loadParams(universe)); }, [universe]);
  useEffect(() => {
    try { localStorage.setItem(storageKey(universe.id), JSON.stringify(params)); } catch { /* ignore */ }
  }, [params, universe.id]);
  useEffect(() => { fetchGeneratorStatus().then(setGenStatus); }, []);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

  const set = (patch) => setParams((p) => ({ ...p, ...patch }));
  const playerCount = params.playerNames.length || params.players;
  const configured = notConfigured ? false : genStatus === undefined || genStatus === null ? true : genStatus.configured;

  const addNames = (raw) => {
    const names = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    setParams((p) => {
      const merged = [...p.playerNames];
      for (const n of names) if (merged.length < 8 && !merged.some((m) => m.toLowerCase() === n.toLowerCase())) merged.push(n.slice(0, 40));
      return { ...p, playerNames: merged, players: merged.length || p.players };
    });
    setNameDraft('');
  };
  const removeName = (n) => setParams((p) => {
    const rest = p.playerNames.filter((x) => x !== n);
    return { ...p, playerNames: rest, players: rest.length || p.players };
  });
  const toggleTone = (t) => setParams((p) => ({
    ...p, tone: p.tone.includes(t) ? p.tone.filter((x) => x !== t) : [...p.tone, t].slice(0, 8),
  }));
  const addTone = () => {
    const t = toneDraft.trim().toLowerCase();
    if (t && !params.tone.includes(t)) set({ tone: [...params.tone, t].slice(0, 8) });
    setToneDraft('');
  };

  const addLog = (message) => setLog((l) => [...l, { at: Date.now(), message }]);

  const start = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStep('generate');
    setLog([]); setChars(0); setError(null); setEstTokens(null); setPack(null);
    setSaved(false); setSaveErrors([]); setRepaired(false);
    setRunning(true); setStartedAt(Date.now()); setNow(Date.now());
    addLog(`UPLINK REQUEST — ${universe.name.toUpperCase()} SCENARIO SYNTHESIS`);
    try {
      const result = await runGeneration({
        universeId: universe.id,
        params: requestParams(params),
        signal: controller.signal,
        onStatus: (s) => {
          if (s.estimatedInputTokens != null) setEstTokens(s.estimatedInputTokens);
          addLog(s.message);
          if (Array.isArray(s.errors)) s.errors.slice(0, 6).forEach((e) => addLog(`  ! ${e}`));
        },
        onDelta: (n) => setChars(n),
      });
      setPack(result.pack);
      setRepaired(!!result.repaired);
      setStep('preview');
    } catch (e) {
      if (e.name === 'AbortError') {
        addLog('TRANSMISSION ABORTED BY OPERATOR.');
      } else if (e.code === 'generator_not_configured') {
        setNotConfigured({ hint: e.hint });
      } else {
        setError(e);
        addLog(`ERROR: ${e.message}`);
      }
    } finally {
      setRunning(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [params, universe]);

  const cancel = () => abortRef.current?.abort();

  const doSave = async () => {
    if (!pack) return;
    setSaving(true); setSaveErrors([]);
    try {
      const stored = await save(pack);
      setPack(stored);
      setSaved(true);
    } catch (e) {
      setSaveErrors([e.message, ...(e.errors || [])]);
    } finally {
      setSaving(false);
    }
  };

  const startSession = () => {
    if (!pack || !saved) return;
    const connected = Object.keys(sessionPlayers || {}).length;
    const msg = connected
      ? `Start a NEW ${terms.session.toLowerCase()} with "${pack.meta.title}"? You get a new access code and the ${connected} connected ${terms.players.toLowerCase()} must rejoin.`
      : `Start a new ${terms.session.toLowerCase()} with "${pack.meta.title}"? A new access code will be issued.`;
    if (!confirm(msg)) return;
    createGame({ universeId: universe.id, packId: pack.id }, (response) => {
      if (response?.error) { setSaveErrors([response.error]); return; }
      onClose?.();
    });
  };

  const discard = () => {
    if (pack && !saved && !confirm('Discard this generated scenario? It has not been saved.')) return;
    setPack(null); setSaved(false); setStep('mission');
  };

  const elapsed = startedAt ? Math.max(0, Math.round(((running ? now : Date.now()) - startedAt) / 1000)) : 0;
  const stepIdx = STEPS.indexOf(step);

  /* ── Render helpers ─────────────────────────────────────────── */

  const Header = (
    <div className="panel" style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, padding: 0, border: 'none' }}>GAME NIGHT — SCENARIO GENERATOR</h2>
        <button onClick={() => { if (running && !confirm('Abort the running generation?')) return; cancel(); onClose?.(); }} style={btnGhost}>
          × CLOSE
        </button>
      </div>
      <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
        {STEPS.map((s, i) => {
          const reachable = !running && (i < 2 || (s === 'generate' && (log.length || error)) || (s === 'preview' && pack));
          return (
            <button key={s} disabled={!reachable || s === step} onClick={() => setStep(s)} style={{
              ...chip(s === step), flex: '1 1 6rem', opacity: i > stepIdx && !reachable ? 0.45 : 1,
              cursor: reachable && s !== step ? 'pointer' : 'default',
            }}>
              {i + 1}. {STEP_LABEL[s]}
            </button>
          );
        })}
      </div>
      {genStatus?.mock && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.65rem', color: 'var(--warn)', letterSpacing: '0.08em' }}>
          MOCK MODE (GENERATOR_MOCK=1) — RETURNS A MUTATED BUNDLED PACK, NO API CALL.
        </div>
      )}
    </div>
  );

  const SetupPanel = (
    <div className="panel" style={{ borderColor: 'var(--warn)' }}>
      <h3 style={{ marginTop: 0 }}>GENERATOR OFFLINE — SETUP REQUIRED</h3>
      <p style={dim}>
        {terminal.name} needs an Anthropic API key to write scenarios. On the machine running the server:
      </p>
      <ol style={{ ...dim, paddingLeft: '1.2rem', lineHeight: 1.7 }}>
        <li>Copy <code style={code}>web app/.env.example</code> to <code style={code}>web app/.env</code></li>
        <li>Set <code style={code}>ANTHROPIC_API_KEY=sk-ant-…</code> (optional: <code style={code}>GENERATOR_MODEL</code>, <code style={code}>GENERATOR_EFFORT</code>)</li>
        <li>Restart the server (<code style={code}>npm start</code> or <code style={code}>npm run dev</code>)</li>
      </ol>
      {notConfigured?.hint && <p style={{ ...dim, color: 'var(--warn)' }}>SERVER: {notConfigured.hint}</p>}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
        {onImport && <button onClick={onImport} style={btnPrimary}>PASTE A PACK INSTEAD →</button>}
        <button onClick={() => { setNotConfigured(null); fetchGeneratorStatus().then(setGenStatus); }} style={btnGhost}>RE-CHECK</button>
      </div>
    </div>
  );

  /* ── Steps ──────────────────────────────────────────────────── */

  const CrewStep = (
    <div className="panel">
      <h3 style={stepTitle}>STEP 1 — {terms.players.toUpperCase()}</h3>

      <Field label={`${terms.player.toUpperCase()} NAMES (OPTIONAL — EACH GETS A CHARACTER WRITTEN FOR THEM)`}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: params.playerNames.length ? '0.4rem' : 0 }}>
          {params.playerNames.map((n) => (
            <span key={n} style={{ ...chip(true), display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              {n}
              <button onClick={() => removeName(n)} aria-label={`Remove ${n}`} style={chipX}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addNames(nameDraft); } }}
            placeholder="Type a name, press Enter (or paste a comma list)" style={inputStyle} />
          <button onClick={() => addNames(nameDraft)} style={{ ...btnGhost, flex: 'none' }}>ADD</button>
        </div>
      </Field>

      <Field label={`${terms.players.toUpperCase()} (${params.playerNames.length ? 'FROM NAMES' : '1–8'})`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button disabled={!!params.playerNames.length || params.players <= 1} onClick={() => set({ players: params.players - 1 })} style={stepBtn}>−</button>
          <span style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', fontSize: '1.4rem', minWidth: '2ch', textAlign: 'center' }}>{playerCount}</span>
          <button disabled={!!params.playerNames.length || params.players >= 8} onClick={() => set({ players: params.players + 1 })} style={stepBtn}>+</button>
        </div>
      </Field>

      <Field label="PLAYTIME">
        <ChipRow>
          {PLAYTIMES.map((p) => (
            <button key={p.value} onClick={() => set({ playtime: p.value })} style={{ ...chip(params.playtime === p.value), flex: '1 1 8rem', textAlign: 'left' }}>
              <div>{p.label}</div>
              <div style={{ fontSize: '0.6rem', opacity: 0.75 }}>{p.sub}</div>
            </button>
          ))}
        </ChipRow>
      </Field>

      <div style={grid2}>
        <Field label="TYPE">
          <ChipRow>{TYPES.map((t) => <button key={t} onClick={() => set({ type: t })} style={chip(params.type === t)}>{t.toUpperCase()}</button>)}</ChipRow>
        </Field>
        <Field label="DIFFICULTY">
          <ChipRow>{DIFFICULTIES.map((d) => <button key={d} onClick={() => set({ difficulty: d })} style={chip(params.difficulty === d)}>{d.toUpperCase()}</button>)}</ChipRow>
        </Field>
        <Field label="LETHALITY">
          <ChipRow>{LETHALITIES.map((l) => <button key={l} onClick={() => set({ lethality: l })} style={chip(params.lethality === l)}>{l.toUpperCase()}</button>)}</ChipRow>
        </Field>
      </div>

      <div style={navRow}>
        <button onClick={() => setStep('mission')} style={btnPrimary}>NEXT — MISSION →</button>
      </div>
    </div>
  );

  const MissionStep = (
    <div className="panel">
      <h3 style={stepTitle}>STEP 2 — MISSION PROFILE</h3>

      <Field label="SETTING">
        <textarea value={params.setting} onChange={(e) => set({ setting: e.target.value.slice(0, 2000) })} rows={3}
          placeholder="Where does it happen? e.g. a derelict mining station near a frontier relay" style={{ ...inputStyle, resize: 'vertical' }} />
        {settingHints.length > 0 && (
          <ChipRow style={{ marginTop: '0.35rem' }}>
            <span style={{ ...dim, fontSize: '0.6rem', alignSelf: 'center' }}>TRY:</span>
            {settingHints.slice(0, 3).map((h) => (
              <button key={h} onClick={() => set({ setting: h })} style={chip(params.setting === h)}>{h}</button>
            ))}
          </ChipRow>
        )}
      </Field>

      <Field label="THREAT">
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <input value={/^surprise me$/i.test(params.threat) ? '' : params.threat} onChange={(e) => set({ threat: e.target.value.slice(0, 1000) })}
            placeholder={/^surprise me$/i.test(params.threat) ? 'SURPRISE ME — the threat stays hidden' : 'What hunts them?'}
            style={{ ...inputStyle, flex: '1 1 14rem' }} />
          <button onClick={() => set({ threat: 'surprise me' })} style={{ ...chip(/^surprise me$/i.test(params.threat)), flex: 'none' }}>SURPRISE ME</button>
        </div>
        {threatHints.length > 0 && (
          <ChipRow style={{ marginTop: '0.35rem' }}>
            {threatHints.slice(0, 6).map((h) => <button key={h} onClick={() => set({ threat: h })} style={chip(params.threat === h)}>{h}</button>)}
          </ChipRow>
        )}
      </Field>

      <Field label="TONE (MULTI-SELECT)">
        <ChipRow>
          {[...new Set([...toneHints, ...params.tone])].map((t) => (
            <button key={t} onClick={() => toggleTone(t)} style={chip(params.tone.includes(t))}>{t}</button>
          ))}
        </ChipRow>
        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
          <input value={toneDraft} onChange={(e) => setToneDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTone(); } }}
            placeholder="Add your own tone…" style={inputStyle} />
          <button onClick={addTone} style={{ ...btnGhost, flex: 'none' }}>ADD</button>
        </div>
      </Field>

      <Field label="THEMES (OPTIONAL)">
        <input value={params.themes} onChange={(e) => set({ themes: e.target.value.slice(0, 1000) })}
          placeholder="e.g. loyalty vs. survival, the cost of obedience" style={inputStyle} />
      </Field>

      <Field label="AVOID — HARD LIMITS (OPTIONAL)">
        <input value={params.avoid} onChange={(e) => set({ avoid: e.target.value.slice(0, 1000) })}
          placeholder="Content to leave out entirely, e.g. harm to children, spiders" style={inputStyle} />
      </Field>

      <div style={grid2}>
        <Field label="TITLE (OPTIONAL)">
          <input value={params.seedTitle} onChange={(e) => set({ seedTitle: e.target.value.slice(0, 80) })}
            placeholder="Leave blank to let it choose" style={inputStyle} />
        </Field>
        <Field label="MAPS">
          <button onClick={() => set({ includeMaps: !params.includeMaps })} style={{ ...chip(params.includeMaps), width: '100%' }}>
            {params.includeMaps ? '■ INCLUDE ASCII MAPS' : '□ NO MAPS'}
          </button>
        </Field>
      </div>

      <div style={navRow}>
        <button onClick={() => setStep('crew')} style={btnGhost}>← CREW</button>
        <button onClick={() => setStep('generate')} style={btnPrimary}>NEXT — REVIEW →</button>
      </div>
    </div>
  );

  const rp = requestParams(params);
  const summaryRows = [
    [terms.players.toUpperCase(), `${rp.players}${rp.playerNames ? ` — ${rp.playerNames.join(', ')}` : ''}`],
    ['PLAYTIME', rp.playtime],
    ['TYPE / DIFFICULTY', `${rp.type} · ${rp.difficulty} · lethality ${rp.lethality}`],
    ['SETTING', rp.setting || 'your choice'],
    ['THREAT', rp.threat],
    ['TONE', rp.tone.length ? rp.tone.join(', ') : 'your choice'],
    ...(rp.themes ? [['THEMES', rp.themes]] : []),
    ...(rp.avoid ? [['AVOID', rp.avoid]] : []),
    ['MAPS', rp.includeMaps ? 'yes (ASCII)' : 'no'],
    ...(rp.seedTitle ? [['TITLE', rp.seedTitle]] : []),
  ];

  const GenerateStep = (
    <div className="panel">
      <h3 style={stepTitle}>STEP 3 — {running ? `${terminal.name} PROCESSING` : 'CONFIRM & GENERATE'}</h3>
      {!running && log.length === 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(7rem, max-content) 1fr', gap: '0.3rem 0.75rem', fontSize: '0.8rem', marginBottom: '1rem' }}>
            {summaryRows.map(([k, v]) => (
              <React.Fragment key={k}>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.65rem', letterSpacing: '0.1em', paddingTop: '0.1rem' }}>{k}</span>
                <span style={{ color: 'var(--text)', wordBreak: 'break-word' }}>{v}</span>
              </React.Fragment>
            ))}
          </div>
          <p style={dim}>
            Generation takes a few minutes. Nothing is saved until you review the result and press SAVE.
            {genStatus?.model && !genStatus.mock ? ` Model: ${genStatus.model} (effort ${genStatus.effort}).` : ''}
          </p>
        </>
      )}

      {log.length > 0 && (
        <div style={terminalBox}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: '0.35rem', marginBottom: '0.5rem', fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '0.08em' }}>
            <span>{terminal.name} PROCESSING LOG</span>
            <span>
              {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
              {' · '}{chars.toLocaleString()} CHARS (~{Math.round(chars / 4).toLocaleString()} TOKENS)
              {estTokens != null && estTokens > 0 ? ` · PROMPT ~${estTokens.toLocaleString()} TOKENS` : ''}
            </span>
          </div>
          <div ref={logRef} style={{ maxHeight: '45vh', overflowY: 'auto' }}>
            {log.map((l, i) => (
              <div key={i} style={{ color: l.message.startsWith('ERROR') || l.message.startsWith('  !') ? 'var(--danger)' : i === log.length - 1 ? 'var(--accent)' : 'var(--text)' }}>
                <span style={{ color: 'var(--text-dim)' }}>{new Date(l.at).toLocaleTimeString([], { hour12: false })} &gt; </span>{l.message}
              </div>
            ))}
            {running && <div><span style={{ color: 'var(--text-dim)' }}>&gt; </span><span className="gnw-cursor">█</span></div>}
          </div>
        </div>
      )}

      {error && (
        <div style={{ ...errorBox, marginTop: '0.75rem' }}>
          <div>{error.message}</div>
          {error.errors?.length > 0 && (
            <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem', fontSize: '0.7rem', maxHeight: '20vh', overflowY: 'auto' }}>
              {error.errors.slice(0, 30).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      <div style={navRow}>
        {running ? (
          <button onClick={cancel} style={btnDanger}>■ CANCEL</button>
        ) : (
          <>
            <button onClick={() => setStep('mission')} style={btnGhost}>← EDIT PARAMETERS</button>
            {pack && <button onClick={() => setStep('preview')} style={btnGhost}>VIEW RESULT →</button>}
            <button onClick={start} disabled={!configured} style={btnPrimary}>
              {log.length ? '↻ GENERATE AGAIN' : `▶ GENERATE SCENARIO`}
            </button>
          </>
        )}
      </div>
    </div>
  );

  const assignments = pack?.meta?.generated?.params?.assignments;
  const PreviewStep = pack && (
    <>
      <div className="panel" style={{ position: 'sticky', top: 0, zIndex: 5 }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', letterSpacing: '0.08em', fontSize: '0.85rem', flex: '1 1 12rem' }}>
            PREVIEW — {pack.meta.title.toUpperCase()}
            {saved && <span style={{ color: 'var(--success)', marginLeft: '0.5rem', fontSize: '0.7rem' }}>● SAVED</span>}
          </span>
          {!saved ? (
            <button onClick={doSave} disabled={saving} style={btnPrimary}>{saving ? 'SAVING…' : '⬇ SAVE TO LIBRARY'}</button>
          ) : (
            <>
              <button onClick={startSession} style={{ ...btnPrimary, borderColor: 'var(--success)', color: 'var(--success)' }}>
                ▶ START {terms.session.toUpperCase()} WITH THIS SCENARIO
              </button>
              {onOpenPack && <button onClick={() => onOpenPack(pack.id)} style={btnGhost}>OPEN IN LIBRARY</button>}
            </>
          )}
          <button onClick={start} style={btnGhost}>↻ REGENERATE</button>
          <button onClick={() => downloadJson(pack, `${pack.id}.json`)} style={btnGhost}>DOWNLOAD JSON</button>
          {!saved && <button onClick={discard} style={{ ...btnGhost, borderColor: 'var(--danger)', color: 'var(--danger)' }}>DISCARD</button>}
        </div>
        {repaired && <div style={{ ...dim, fontSize: '0.65rem', marginTop: '0.4rem' }}>Note: the first draft failed validation and was corrected automatically.</div>}
        {saveErrors.length > 0 && (
          <div style={{ ...errorBox, marginTop: '0.5rem' }}>
            {saveErrors.slice(0, 12).map((e, i) => <div key={i}>{e}</div>)}
          </div>
        )}
        {assignments && Object.keys(assignments).length > 0 && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-dim)', display: 'flex', flexWrap: 'wrap', gap: '0.3rem 1rem' }}>
            <span style={{ letterSpacing: '0.1em' }}>ASSIGNMENTS:</span>
            {Object.entries(assignments).map(([charName, player]) => (
              <span key={charName}><span style={{ color: 'var(--accent)' }}>{player}</span> → {charName}</span>
            ))}
          </div>
        )}
      </div>
      <div className="gnw-preview">
        <ScenarioDetail
          pack={pack}
          tts={tts}
          onBack={() => setStep('mission')}
          onPlay={() => setSaveErrors([saved ? 'Use START SESSION above, or open the scenario from the library to run it.' : 'Save the scenario to the library before playing it.'])}
        />
      </div>
    </>
  );

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto' }}>
      <style>{`
        @keyframes gnw-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
        .gnw-cursor { color: var(--accent); animation: gnw-blink 1s steps(1) infinite; }
        .gnw-preview .back-btn { display: none; }
      `}</style>
      {Header}
      {(notConfigured || genStatus?.configured === false) && SetupPanel}
      {step === 'crew' && CrewStep}
      {step === 'mission' && MissionStep}
      {step === 'generate' && GenerateStep}
      {step === 'preview' && PreviewStep}
    </div>
  );
}

/* ── Small presentational pieces ─────────────────────────────── */

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: '0.9rem', minWidth: 0 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function ChipRow({ children, style }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', ...style }}>{children}</div>;
}

/* ── Styles (CSS vars only) ──────────────────────────────────── */

const dim = { color: 'var(--text-dim)', fontSize: '0.8rem', lineHeight: 1.5 };
const code = { color: 'var(--accent)', fontFamily: 'var(--font-mono)' };
const stepTitle = { color: 'var(--accent)', marginTop: 0, marginBottom: '1rem', letterSpacing: '0.1em' };
const labelStyle = { display: 'block', color: 'var(--text-dim)', fontSize: '0.65rem', letterSpacing: '0.1em', marginBottom: '0.35rem' };
const inputStyle = {
  width: '100%', padding: '0.6rem 0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border)',
  color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', letterSpacing: '0.04em', boxSizing: 'border-box',
};
const btnBase = {
  padding: '0.65rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.08em',
  cursor: 'pointer', minHeight: '2.5rem',
};
const btnPrimary = { ...btnBase, background: 'var(--accent-glow)', border: '1px solid var(--accent)', color: 'var(--accent)' };
const btnGhost = { ...btnBase, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)' };
const btnDanger = { ...btnBase, background: 'var(--danger-glow)', border: '1px solid var(--danger)', color: 'var(--danger)' };
const stepBtn = { ...btnGhost, width: '2.75rem', fontSize: '1.1rem', padding: '0.3rem' };
const chip = (active) => ({
  padding: '0.45rem 0.7rem', minHeight: '2.25rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', letterSpacing: '0.05em',
  background: active ? 'var(--accent-glow)' : 'transparent',
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  color: active ? 'var(--accent)' : 'var(--text-dim)', cursor: 'pointer',
});
const chipX = { background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '0.9rem', padding: 0, lineHeight: 1 };
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))', gap: '0 1rem' };
const navRow = { display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '0.5rem' };
const terminalBox = {
  background: 'var(--bg-dark)', border: '1px solid var(--border-bright)', padding: '0.75rem',
  fontFamily: 'var(--font-mono)', fontSize: '0.75rem', lineHeight: 1.6,
  boxShadow: 'inset 0 0 18px var(--accent-glow)',
};
const errorBox = {
  padding: '0.6rem 0.75rem', border: '1px solid var(--danger)', color: 'var(--danger)',
  background: 'var(--danger-glow)', fontSize: '0.8rem',
};
