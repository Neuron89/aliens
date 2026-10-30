import React, { createContext, useContext, useState, useCallback, useLayoutEffect, useMemo, useRef, useEffect } from 'react';
import { universes as registry, getUniverse, DEFAULT_UNIVERSE } from '../universes';
import { setSfxTheme, isMuted, setMuted as setSfxMuted, subscribeMuted } from './sfx';

/* ═══════════════════════════════════════════════════════════════
   UniverseContext — active universe + theme application.

   - `chosen` is false on every fresh load: the UniverseSelect landing is
     shown with a NEUTRAL theme. The last choice is remembered (localStorage)
     only to pre-highlight its card.
   - Once chosen, every theme.vars entry is set on :root and the Google Fonts
     <link id="universe-fonts"> is swapped.
   - Overlay hook: theme.overlay ('crt' | 'grain' | none; `crt: true` alone
     means 'crt') toggles html.overlay-<name> (plus legacy html.crt), and
     theme.overlayCss, if present, is injected as <style id="universe-overlay">.
   - document.title and an inline-SVG favicon (theme.favicon) follow the universe.
   - theme.sfx is handed to engine/sfx.js.
   - Per-device FX prefs: `fx.reduced` (html.fx-reduced: overlays and
     animations off) and `fx.muted` (sfx), both in localStorage.
   - setUniverseId(id, { boot: true }) also plays the boot sequence
     (fx/BootSequence.jsx, ≤ 900 ms, skippable via skipBoot()).
   ═══════════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'engine.universe';
const REDUCED_KEY = 'engine.fx.reduced';
export const BOOT_MS = 900;

const NEUTRAL_FAVICON = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='5' fill='#0b0b0d'/><rect x='5' y='7' width='22' height='15' rx='2' fill='none' stroke='#c8ccd4' stroke-width='2'/><path d='M11 26h10' stroke='#c8ccd4' stroke-width='2'/><path d='M9 12h6M9 16h10' stroke='#92959e' stroke-width='1.6'/></svg>";

/* Neutral chrome used before a universe is chosen (landing / join links). */
export const NEUTRAL = {
  id: 'neutral',
  name: 'GAME TERMINAL',
  terminal: { name: 'GAME TERMINAL', subtitle: 'Multi-Universe Session Interface', statusLines: ['STANDBY', 'AWAITING UNIVERSE', 'UPLINK READY'] },
  terms: {
    gm: 'Game Master', gmShort: 'GM', player: 'Player', players: 'Players', session: 'Session',
    message: 'Message', broadcast: 'Broadcast', joinPrompt: 'JOIN SESSION', priorities: ['STANDARD'],
  },
  theme: {
    vars: {
      '--bg-dark': '#0b0b0d', '--bg-panel': '#131316', '--bg-card': '#18181c', '--bg-input': '#0f0f12',
      '--border': '#2a2a31', '--border-bright': '#44444f', '--border-glow': '#9aa0aa33',
      '--text': '#d0d2d8', '--text-dim': '#92959e', '--text-bright': '#eef0f4',
      '--accent': '#c8ccd4', '--accent-dim': '#9a9ea8', '--accent-glow': 'rgba(200, 204, 212, 0.10)', '--accent-bright': '#ffffff',
      '--subhead': '#dfe2e8',
      '--warn': '#d4a848', '--warn-dim': '#806420', '--danger': '#e06666', '--danger-dim': '#702828', '--danger-glow': 'rgba(224, 102, 102, 0.14)',
      '--success': '#60b080', '--blue': '#6c94cc', '--purple': '#9a7cd0',
      '--font-display': "'Share Tech Mono', Consolas, ui-monospace, monospace",
      '--font-mono': "'Share Tech Mono', Consolas, ui-monospace, monospace",
      '--font-body': "'Share Tech Mono', Consolas, ui-monospace, monospace",
      '--fx-speed': '1',
    },
    crt: false,
    favicon: NEUTRAL_FAVICON,
  },
};

const UniverseContext = createContext(null);
export const useUniverse = () => useContext(UniverseContext);

function storedUniverseId() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && registry[stored]) return stored;
  } catch { /* storage unavailable */ }
  return DEFAULT_UNIVERSE;
}

function storedReduced() {
  try { return localStorage.getItem(REDUCED_KEY) === '1'; } catch { return false; }
}

/** The overlay a theme asks for: theme.overlay, else 'crt' when theme.crt. */
export function overlayName(theme) {
  if (theme?.overlay !== undefined) return theme.overlay || null;
  return theme?.crt ? 'crt' : null;
}

function setFavicon(svg) {
  if (!svg) return;
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/svg+xml';
  const href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  if (link.getAttribute('href') !== href) link.setAttribute('href', href);
}

function applyTheme(theme, appliedRef) {
  const root = document.documentElement;
  const vars = theme?.vars || {};
  for (const key of appliedRef.current) {
    if (!(key in vars)) root.style.removeProperty(key);
  }
  for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value);
  appliedRef.current = Object.keys(vars);

  /* Overlay hook */
  const overlay = overlayName(theme);
  for (const cls of [...root.classList]) {
    if (cls.startsWith('overlay-') && cls !== `overlay-${overlay}`) root.classList.remove(cls);
  }
  if (overlay) root.classList.add(`overlay-${overlay}`);
  root.classList.toggle('crt', overlay === 'crt');
  let style = document.getElementById('universe-overlay');
  if (theme?.overlayCss) {
    if (!style) {
      style = document.createElement('style');
      style.id = 'universe-overlay';
      document.head.appendChild(style);
    }
    if (style.textContent !== theme.overlayCss) style.textContent = theme.overlayCss;
  } else if (style) {
    style.remove();
  }

  const href = theme?.fonts?.googleCss;
  if (href) {
    let link = document.getElementById('universe-fonts');
    if (!link) {
      link = document.createElement('link');
      link.id = 'universe-fonts';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
  }
  setFavicon(theme?.favicon || NEUTRAL_FAVICON);
  setSfxTheme(theme?.sfx);
}

export function UniverseProvider({ children }) {
  const [universeId, setUniverseIdState] = useState(storedUniverseId);
  const [chosen, setChosen] = useState(false);
  const [booting, setBooting] = useState(null); // universe object being booted, or null
  const [reduced, setReducedState] = useState(storedReduced);
  const [muted, setMutedState] = useState(isMuted);
  const appliedVars = useRef([]);
  const bootTimer = useRef(null);
  const universe = getUniverse(universeId);

  const setUniverseId = useCallback((id, { boot = false } = {}) => {
    if (!id || !registry[id]) return;
    setUniverseIdState(id);
    setChosen(true);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
    clearTimeout(bootTimer.current);
    const reduce = document.documentElement.classList.contains('fx-reduced')
      || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const style = registry[id].theme?.boot || 'terminal';
    if (boot && style !== 'none' && !reduce) {
      setBooting(registry[id]);
      bootTimer.current = setTimeout(() => setBooting(null), style === 'sandstorm' ? 1100 : BOOT_MS);
    } else {
      setBooting(null);
    }
  }, []);

  const skipBoot = useCallback(() => { clearTimeout(bootTimer.current); setBooting(null); }, []);

  /** Return to the universe landing (only meaningful with no active session). */
  const resetUniverse = useCallback(() => {
    setChosen(false);
    if (window.location.search.includes('join=')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const setReduced = useCallback((v) => {
    setReducedState(!!v);
    try { localStorage.setItem(REDUCED_KEY, v ? '1' : '0'); } catch { /* ignore */ }
  }, []);
  const setMuted = useCallback((v) => setSfxMuted(v), []);

  useEffect(() => subscribeMuted(setMutedState), []);
  useEffect(() => () => clearTimeout(bootTimer.current), []);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('fx-reduced', reduced);
  }, [reduced]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (chosen) {
      applyTheme(universe.theme, appliedVars);
      root.dataset.universe = universe.id;
      const t = universe.terminal || {};
      document.title = t.name ? `${t.name} · ${universe.name}` : universe.name;
    } else {
      applyTheme(NEUTRAL.theme, appliedVars);
      root.dataset.universe = 'neutral';
      document.title = 'Game Terminal';
    }
  }, [universe, chosen]);

  const fx = useMemo(() => ({ reduced, setReduced, muted, setMuted }), [reduced, setReduced, muted, setMuted]);

  const value = useMemo(() => ({
    universe,
    universeId: universe.id,
    setUniverseId,
    universes: Object.values(registry),
    chosen,
    resetUniverse,
    booting,
    skipBoot,
    fx,
    /** What chrome should display: the real universe once chosen, else neutral wording. */
    display: chosen ? universe : NEUTRAL,
  }), [universe, setUniverseId, chosen, resetUniverse, booting, skipBoot, fx]);

  return <UniverseContext.Provider value={value}>{children}</UniverseContext.Provider>;
}
