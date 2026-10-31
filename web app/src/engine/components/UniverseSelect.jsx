import React, { useEffect, useRef, useState } from 'react';
import { useUniverse } from '../UniverseContext';
import Motif from './fx/Motifs';
import BootSequence from './fx/BootSequence';
import { play } from '../sfx';

/* ═══════════════════════════════════════════════════════════════
   UniverseSelect — full-screen landing. One card per registry universe,
   each previewed in its OWN theme via CSS vars scoped to the card, with
   a faint themed backdrop (theme.motif: deck-plan linework, dune
   contours, …). Built purely from the registry (no universe is
   hard-coded). Keyboard: arrows / Home / End move between cards,
   Enter or Space boots the focused universe.
   ═══════════════════════════════════════════════════════════════ */

const DICE_NAMES = { yze: 'Year Zero dice', '2d20': '2d20 dice', d20: 'd20 dice', d6: 'd6 dice' };

const titleCase = (s) => String(s).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Short "systems" line derived from universe.rules. */
export function systemsLine(u) {
  const rules = u.rules || {};
  const parts = [];
  const kind = rules.dice?.kind;
  if (kind) parts.push(DICE_NAMES[kind] || `${kind} dice`);
  const tracks = (rules.tracks || []).map((t) => titleCase(t.label || t.key));
  if (tracks.length) parts.push(tracks.join(' & '));
  if (rules.skills?.length) parts.push(`${rules.skills.length} skills`);
  if (u.careers?.length) parts.push(`${u.careers.length} careers`);
  return parts.join(' · ');
}

function scenarioCount(u) {
  return (u.content?.packs || []).filter((p) => p.kind === 'scenario' || p.kind === 'campaign').length;
}

/* Make sure every universe's fonts are loaded so cards preview correctly. */
function usePreviewFonts(universes) {
  useEffect(() => {
    for (const u of universes) {
      const href = u.theme?.fonts?.googleCss;
      if (!href) continue;
      const id = `universe-fonts-preview-${u.id}`;
      if (document.getElementById(id)) continue;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  }, [universes]);
}

function UniverseCard({ u, lastUsed, onSelect, onKeyDown, cardRef }) {
  const vars = u.theme?.vars || {};
  const count = scenarioCount(u);
  const motif = u.theme?.motif;
  const crt = u.theme?.overlay === 'crt' || (u.theme?.overlay === undefined && u.theme?.crt);
  return (
    <button
      ref={cardRef}
      type="button"
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={`universe-card${lastUsed ? ' last' : ''}`}
      data-motif={motif || 'grid'}
      aria-label={`${u.name}: ${u.tagline}. ${count ? `${count} bundled scenarios` : 'No bundled scenarios'}.`}
      /* scoped custom properties: var(--accent) etc. resolve to THIS universe inside the card */
      style={vars}
    >
      <Motif className="uc-art" motif={motif} seed={u.id} opacity={motif === 'contours' ? 0.5 : 0.42} />
      {crt && <span aria-hidden className="uc-scan" />}
      <span className="uc-term">{u.terminal?.name}{lastUsed ? ' — LAST USED' : ''}</span>
      <span className="uc-name">{u.name}</span>
      <span className="uc-tag">{u.tagline}</span>
      <span className="uc-sys">{systemsLine(u)}</span>
      <span className="uc-foot">
        <span className={`uc-count${count ? '' : ' none'}`}>
          {count ? `${count} BUNDLED SCENARIO${count > 1 ? 'S' : ''}` : 'NO SCENARIOS — GENERATE ONE'}
        </span>
        <span className="uc-enter">ENTER ▸</span>
      </span>
    </button>
  );
}

export default function UniverseSelect() {
  const { universes, universeId, setUniverseId } = useUniverse();
  const refs = useRef([]);
  usePreviewFonts(universes);
  /* Only claim "LAST USED" when this device really booted a universe before (fresh device = default id). */
  const [hasHistory] = useState(() => { try { return !!localStorage.getItem('engine.universe'); } catch { return false; } });

  /* Focus the last-used card so Enter boots it straight away. */
  useEffect(() => {
    const i = Math.max(0, universes.findIndex((u) => u.id === universeId));
    refs.current[i]?.focus({ preventScroll: true });
  }, [universes, universeId]);

  const onKeyDown = (i) => (e) => {
    const n = universes.length;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % n;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next !== null) { e.preventDefault(); refs.current[next]?.focus(); play('ui.tap', { volume: 0.5 }); }
  };

  return (
    <div className="us-root">
      <div className="us-head">
        <h1>SELECT UNIVERSE</h1>
        <p>Choose a setting to boot its terminal. Players joining with a code are switched automatically.</p>
      </div>
      <div className="us-grid" role="group" aria-label="Universes">
        {universes.map((u, i) => (
          <UniverseCard key={u.id} u={u} lastUsed={hasHistory && u.id === universeId} cardRef={(el) => { refs.current[i] = el; }}
            onKeyDown={onKeyDown(i)} onSelect={() => setUniverseId(u.id, { boot: true })} />
        ))}
      </div>
      <div className="us-hint">← → TO CHOOSE · ENTER TO BOOT</div>
      {/* The flat TV: open this site on it and tap here (or bookmark /tv). It becomes the bare play
          surface: code entry → map only, tap for fullscreen, no chrome. */}
      <button type="button" className="us-tv" onClick={() => { play('ui.confirm'); window.location.assign('/?board'); }}
        title="Turn this screen into the table board (map only, fullscreen)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="1" /><path d="M8 20h8M12 16v4" /></svg>
        THIS SCREEN IS THE TABLE TV — OPEN THE BOARD
      </button>
    </div>
  );
}

/** Boot overlay shown while a universe boots (see fx/BootSequence.jsx). */
export function BootOverlay() {
  return <BootSequence />;
}
