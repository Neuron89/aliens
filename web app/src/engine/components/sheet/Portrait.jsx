import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useUniverse } from '../../UniverseContext';
import { apiHeaders } from '../../apiToken';
import './portrait.css';

/* ═══════════════════════════════════════════════════════════════
   Character portraits (F4) — local ComfyUI via /api/portrait (server/portrait.js).

   <Portrait character={c} name? size={44} generate? decorative? className? />
     (decorative: aria-hidden, for avatars next to a visible name)
     A themed monogram until a portrait exists, then the image. With
     `generate`, a GENERATE PORTRAIT button, a progress state while the
     image server works, and a plain message when it is unreachable.
   usePortraitUrl({ id, name }) → url | null for the active universe
     (TokenChip uses it with the token label so the TV shows portraits).

   One shared store per universe: GET /api/portrait/list/<universe> on
   first use, then every 30 s while anything is mounted (and on focus), so
   a portrait generated on one device reaches the phones, the GM screen and
   the TV without a socket event.
   ═══════════════════════════════════════════════════════════════ */

const REFRESH_MS = 30000;
const POLL_MS = 1200;
const EXPECTED_S = 25; // typical render on the homelab GPU; only drives the progress bar

const normName = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');

const stores = new Map();
function storeFor(u) {
  let s = stores.get(u);
  if (!s) {
    s = { byId: new Map(), byName: new Map(), version: 0, listeners: new Set(), timer: null, inflight: null };
    stores.set(u, s);
  }
  return s;
}
function emit(s) { s.version++; for (const fn of s.listeners) fn(); }

export function refreshPortraits(u) {
  if (!u || typeof fetch !== 'function') return Promise.resolve();
  const s = storeFor(u);
  if (s.inflight) return s.inflight;
  s.inflight = fetch(`/api/portrait/list/${encodeURIComponent(u)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data || !Array.isArray(data.portraits)) return;
      const byId = new Map();
      const byName = new Map();
      for (const p of data.portraits) {
        if (!p || typeof p.url !== 'string') continue;
        byId.set(p.id, p.url);
        if (p.name) byName.set(normName(p.name), p.url);
      }
      const same = byId.size === s.byId.size && [...byId].every(([k, v]) => s.byId.get(k) === v)
        && byName.size === s.byName.size && [...byName].every(([k, v]) => s.byName.get(k) === v);
      if (same) return;
      s.byId = byId; s.byName = byName;
      emit(s);
    })
    .catch(() => { /* offline: keep what we have */ })
    .finally(() => { s.inflight = null; });
  return s.inflight;
}

function subscribe(u, fn) {
  const s = storeFor(u);
  s.listeners.add(fn);
  if (s.listeners.size === 1) {
    refreshPortraits(u);
    s.timer = setInterval(() => refreshPortraits(u), REFRESH_MS);
    s.onFocus = () => refreshPortraits(u);
    window.addEventListener('focus', s.onFocus);
  }
  return () => {
    s.listeners.delete(fn);
    if (s.listeners.size === 0) {
      clearInterval(s.timer); s.timer = null;
      window.removeEventListener('focus', s.onFocus);
    }
  };
}

/** Record a fresh portrait locally (the generating device sees it at once). */
export function setPortrait(u, id, name, url) {
  const s = storeFor(u);
  if (id) s.byId.set(id, url);
  if (name) s.byName.set(normName(name), url);
  emit(s);
}

function useUniverseId() {
  const ctx = useUniverse();
  return ctx?.universe?.id || '';
}

/** Portrait URL for a character id (preferred) or name in the active universe; null when none. */
export function usePortraitUrl({ id, name } = {}) {
  const u = useUniverseId();
  const want = !!(u && (id || name));
  const sub = useCallback((fn) => (want ? subscribe(u, fn) : () => {}), [u, want]);
  useSyncExternalStore(sub, () => (want ? storeFor(u).version : 0), () => 0);
  if (!want) return null;
  const s = storeFor(u);
  return (id && s.byId.get(id)) || (name && s.byName.get(normName(name))) || null;
}

export function monogram(name = '') {
  const words = String(name).replace(/\([^)]*\)/g, ' ').replace(/^(capt|cpt|dr|sgt|lt|cpl|pvt|mr|ms|mrs|the)\.?\s+/i, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const reduced = () => typeof document !== 'undefined' && (document.documentElement.classList.contains('fx-reduced')
  || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/* ── Generation (POST + poll) ──────────────────────────────── */

function errorText(status, body) {
  if (status === 401) return 'API TOKEN REQUIRED · SET IT ON THE SESSION SCREEN (ADVANCED)';
  if (status === 429) return 'IMAGE SERVER BUSY · TRY AGAIN IN A MOMENT';
  if (status === 503 || body?.error === 'comfy_offline') return 'IMAGE SERVER OFFLINE · PORTRAITS UNAVAILABLE';
  if (status === 404 && body?.error === 'unknown_universe') return 'THIS UNIVERSE HAS NO PORTRAIT STYLE';
  return String(body?.message || body?.error || `HTTP ${status}`).toUpperCase().slice(0, 120);
}

function useGenerator(universeId, character, onDone) {
  const [job, setJob] = useState(null);       // { state, message, elapsed }
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const alive = useRef(true);
  const timer = useRef(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; clearTimeout(timer.current); }; }, []);

  const checkStatus = useCallback(async (fresh) => {
    try {
      const r = await fetch(`/api/portrait/status${fresh ? '?fresh=1' : ''}`);
      const d = r.ok ? await r.json() : null;
      if (alive.current) setOffline(!d?.comfy);
      return !!d?.comfy;
    } catch {
      if (alive.current) setOffline(true);
      return false;
    }
  }, []);
  useEffect(() => { checkStatus(false); }, [checkStatus]);

  const poll = useCallback((id) => {
    timer.current = setTimeout(async () => {
      if (!alive.current) return;
      try {
        const r = await fetch(`/api/portrait/job/${id}`);
        const d = await r.json().catch(() => ({}));
        if (!alive.current) return;
        if (!r.ok) { setJob(null); setError(errorText(r.status, d)); return; }
        setJob(d);
        if (d.state === 'done') { onDone(d.url); setJob(null); setError(''); return; }
        if (d.state === 'error') {
          setJob(null);
          setError(d.error === 'timeout' ? 'THE IMAGE SERVER TOOK TOO LONG · TRY AGAIN' : `NO PORTRAIT · ${String(d.message || '').toUpperCase().slice(0, 100)}`);
          return;
        }
        poll(id);
      } catch {
        if (alive.current) poll(id); // transient network blip: keep polling
      }
    }, POLL_MS);
  }, [onDone]);

  const start = useCallback(async () => {
    setError('');
    if (offline && !(await checkStatus(true))) { setError('IMAGE SERVER OFFLINE · PORTRAITS UNAVAILABLE'); return; }
    setJob({ state: 'queued', message: 'QUEUED', elapsed: 0 });
    try {
      const r = await fetch('/api/portrait', {
        method: 'POST',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          characterId: character.id, universeId,
          name: character.name || '', career: character.career || '', appearance: character.appearance || '',
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!alive.current) return;
      if (r.status !== 202) {
        setJob(null);
        if (r.status === 503) setOffline(true);
        setError(errorText(r.status, d));
        return;
      }
      setOffline(false);
      setJob(d);
      poll(d.id);
    } catch {
      if (!alive.current) return;
      setJob(null);
      setError('NO LINK TO THE SERVER');
    }
  }, [offline, checkStatus, character, universeId, poll]);

  return { job, error, offline, start };
}

/* ── Component ─────────────────────────────────────────────── */

export default function Portrait({ character, name, size = 44, generate = false, decorative = false, className = '' }) {
  const ctx = useUniverse();
  const universe = ctx?.universe;
  const universeId = universe?.id || '';
  const nm = character?.name || name || '';
  const id = character?.id || null;
  const url = usePortraitUrl({ id, name: nm });
  const [broken, setBroken] = useState(null);
  const skin = universe?.theme?.overlay === 'grain' ? 'round' : 'square';
  const onDone = useCallback((u) => setPortrait(universeId, id, nm, u), [universeId, id, nm]);
  const showImg = url && broken !== url;

  const face = (
    <span className={`pt pt-${skin}${showImg ? ' has-img' : ''}${generate ? '' : ` ${className}`}`} style={{ '--pt-size': `${size}px` }}
      role={generate || decorative ? undefined : 'img'} aria-label={generate || decorative ? undefined : (showImg ? `Portrait of ${nm}` : `${nm || 'Unknown'} (no portrait)`)}
      aria-hidden={generate || decorative ? 'true' : undefined}>
      {showImg
        ? <img src={url} alt="" width={size} height={size} draggable="false" onError={() => setBroken(url)} />
        : <span className="pt-mono" aria-hidden="true">{monogram(nm)}</span>}
    </span>
  );
  if (!generate) return face;
  return <PortraitGenerator character={character} universeId={universeId} face={face} hasImg={!!showImg} onDone={onDone} className={className} name={nm} />;
}

function PortraitGenerator({ character, universeId, face, hasImg, onDone, className, name }) {
  const { job, error, offline, start } = useGenerator(universeId, character || {}, onDone);
  const busy = !!job;
  const canGen = !!(character?.id && universeId);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!busy) return undefined;
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [busy]);
  const startedAt = useRef(0);
  if (busy && !startedAt.current) startedAt.current = Date.now();
  if (!busy) startedAt.current = 0;
  const secs = busy ? Math.max(job.elapsed || 0, (Date.now() - startedAt.current) / 1000) : 0;
  const pct = busy ? Math.min(95, Math.round((1 - Math.exp(-secs / EXPECTED_S)) * 100)) : 0;
  const label = busy ? 'GENERATING…' : offline ? 'IMAGE SERVER OFFLINE · RETRY' : hasImg ? 'NEW PORTRAIT' : 'GENERATE PORTRAIT';

  return (
    <div className={`pt-gen${busy ? ' busy' : ''}${reduced() ? ' still' : ''} ${className}`}>
      <div className="pt-frame" role="img" aria-label={hasImg ? `Portrait of ${name}` : `${name || 'Unknown'}: no portrait yet`}>
        {face}
        {busy && <span className="pt-scan" aria-hidden="true" />}
      </div>
      <div className="pt-side">
        <button type="button" className={`pt-btn${offline && !busy ? ' off' : ''}`} onClick={start} disabled={busy || !canGen}
          aria-describedby={`pt-msg-${character?.id || 'x'}`}>
          {label}
        </button>
        {busy && (
          <div className="pt-progress" role="progressbar" aria-label="Portrait progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <i style={{ width: `${pct}%` }} />
          </div>
        )}
        <p id={`pt-msg-${character?.id || 'x'}`} className={`pt-msg${error ? ' bad' : ''}`} role="status" aria-live="polite">
          {busy ? `${String(job.message || job.state || '').toUpperCase()} · ${Math.round(secs)} S`
            : error || (offline ? 'The image server (ComfyUI) is not answering. Everything else works.' : !canGen ? 'Save the character first.' : '')}
        </p>
      </div>
    </div>
  );
}
