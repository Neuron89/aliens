import React, { createContext, useContext, useState, useCallback, useLayoutEffect, useMemo, useRef, useEffect } from 'react';
import { universes as registry, getUniverse, DEFAULT_UNIVERSE } from '../universes';

/* ═══════════════════════════════════════════════════════════════
   UniverseContext — active universe + theme application.

   - `chosen` is false on every fresh load: the UniverseSelect landing is
     shown with a NEUTRAL theme. The last choice is remembered (localStorage)
     only to pre-highlight its card.
   - Once chosen, every theme.vars entry is set on :root, the Google Fonts
     <link id="universe-fonts"> is swapped and the CRT overlay is toggled via
     the `crt` class on <html>.
   - setUniverseId(id, { boot: true }) also plays a short terminal boot overlay.
   ═══════════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'engine.universe';
export const BOOT_MS = 800;

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
      '--border': '#26262c', '--border-bright': '#3a3a44', '--border-glow': '#9aa0aa33',
      '--text': '#c4c6cc', '--text-dim': '#6a6d76', '--text-bright': '#eceef2',
      '--accent': '#c8ccd4', '--accent-dim': '#7a7e88', '--accent-glow': 'rgba(200, 204, 212, 0.10)', '--accent-bright': '#ffffff',
      '--warn': '#c8a040', '--warn-dim': '#806420', '--danger': '#c85050', '--danger-dim': '#702828', '--danger-glow': 'rgba(200, 80, 80, 0.15)',
      '--success': '#60b080', '--blue': '#6088c0', '--purple': '#8a6cc0',
      '--font-display': "ui-monospace, 'Courier New', monospace",
      '--font-mono': "ui-monospace, 'Courier New', monospace",
    },
    crt: false,
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

function applyTheme(theme, appliedRef) {
  const root = document.documentElement;
  const vars = theme?.vars || {};
  for (const key of appliedRef.current) {
    if (!(key in vars)) root.style.removeProperty(key);
  }
  for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value);
  appliedRef.current = Object.keys(vars);
  root.classList.toggle('crt', !!theme?.crt);
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
}

export function UniverseProvider({ children }) {
  const [universeId, setUniverseIdState] = useState(storedUniverseId);
  const [chosen, setChosen] = useState(false);
  const [booting, setBooting] = useState(null); // universe object being booted, or null
  const appliedVars = useRef([]);
  const bootTimer = useRef(null);
  const universe = getUniverse(universeId);

  const setUniverseId = useCallback((id, { boot = false } = {}) => {
    if (!id || !registry[id]) return;
    setUniverseIdState(id);
    setChosen(true);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
    if (boot) {
      clearTimeout(bootTimer.current);
      setBooting(registry[id]);
      bootTimer.current = setTimeout(() => setBooting(null), BOOT_MS);
    }
  }, []);

  /** Return to the universe landing (only meaningful with no active session). */
  const resetUniverse = useCallback(() => {
    setChosen(false);
    if (window.location.search.includes('join=')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  useEffect(() => () => clearTimeout(bootTimer.current), []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (chosen) {
      applyTheme(universe.theme, appliedVars);
      root.dataset.universe = universe.id;
      document.title = `${universe.terminal?.name || universe.name} — ${universe.terminal?.subtitle || universe.name}`;
    } else {
      applyTheme(NEUTRAL.theme, appliedVars);
      root.dataset.universe = 'neutral';
      document.title = NEUTRAL.terminal.name;
    }
  }, [universe, chosen]);

  const value = useMemo(() => ({
    universe,
    universeId: universe.id,
    setUniverseId,
    universes: Object.values(registry),
    chosen,
    resetUniverse,
    booting,
    /** What chrome should display: the real universe once chosen, else neutral wording. */
    display: chosen ? universe : NEUTRAL,
  }), [universe, setUniverseId, chosen, resetUniverse, booting]);

  return <UniverseContext.Provider value={value}>{children}</UniverseContext.Provider>;
}
