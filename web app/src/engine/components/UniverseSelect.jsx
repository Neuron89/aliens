import React, { useEffect } from 'react';
import { useUniverse, BOOT_MS } from '../UniverseContext';

/* ═══════════════════════════════════════════════════════════════
   UniverseSelect — full-screen landing. One card per registry universe,
   each previewed in its OWN theme via CSS vars scoped to the card.
   Built purely from the registry (no universe is hard-coded).
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

function UniverseCard({ u, lastUsed, onSelect }) {
  const vars = u.theme?.vars || {};
  const count = scenarioCount(u);
  return (
    <button
      onClick={onSelect}
      className="universe-card"
      style={{
        ...vars, // scoped custom properties: var(--accent) etc. resolve to THIS universe inside the card
        position: 'relative', overflow: 'hidden', textAlign: 'left', cursor: 'pointer',
        padding: '1.5rem 1.25rem 1.25rem', minHeight: '260px',
        display: 'flex', flexDirection: 'column', gap: '0.6rem',
        background: `linear-gradient(160deg, var(--bg-panel) 0%, var(--bg-dark) 70%)`,
        border: '1px solid var(--border-bright)',
        boxShadow: lastUsed ? '0 0 0 1px var(--accent), 0 0 24px var(--accent-glow)' : '0 0 18px var(--accent-glow)',
        color: 'var(--text)', fontFamily: 'var(--font-mono)',
      }}
    >
      {u.theme?.crt && (
        <span aria-hidden style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 3px)',
        }} />
      )}
      <span style={{ fontSize: '0.6rem', letterSpacing: '0.25em', color: 'var(--text-dim)' }}>
        {u.terminal?.name}{lastUsed ? ' — LAST USED' : ''}
      </span>
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 700, letterSpacing: '0.15em',
        color: 'var(--accent)', textShadow: '0 0 18px var(--accent-glow)', lineHeight: 1.2,
      }}>
        {u.name}
      </span>
      <span style={{ fontStyle: 'italic', color: 'var(--text)', fontSize: '0.85rem', lineHeight: 1.5 }}>{u.tagline}</span>
      <span style={{ marginTop: 'auto', fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
        {systemsLine(u)}
      </span>
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '0.6rem', letterSpacing: '0.12em', padding: '0.15rem 0.45rem',
          border: `1px solid ${count ? 'var(--border-bright)' : 'var(--warn)'}`,
          color: count ? 'var(--text-dim)' : 'var(--warn)',
        }}>
          {count ? `${count} BUNDLED SCENARIO${count > 1 ? 'S' : ''}` : 'NO SCENARIOS — GENERATE ONE'}
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', letterSpacing: '0.2em', color: 'var(--accent)' }}>
          ENTER ▸
        </span>
      </span>
    </button>
  );
}

export default function UniverseSelect() {
  const { universes, universeId, setUniverseId } = useUniverse();
  usePreviewFonts(universes);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', letterSpacing: '0.35em', color: 'var(--text-bright)', marginBottom: '0.4rem' }}>
          SELECT UNIVERSE
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', letterSpacing: '0.1em' }}>
          Choose a setting to boot its terminal. Players joining with a code are switched automatically.
        </p>
      </div>
      <div style={{
        width: '100%', maxWidth: '1100px', display: 'grid', gap: '1.25rem',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      }}>
        {universes.map((u) => (
          <UniverseCard key={u.id} u={u} lastUsed={u.id === universeId}
            onSelect={() => setUniverseId(u.id, { boot: true })} />
        ))}
      </div>
    </div>
  );
}

/** Full-screen "INITIALIZING <terminal>…" overlay shown while a universe boots. */
export function BootOverlay() {
  const { booting } = useUniverse();
  if (!booting) return null;
  const lines = booting.terminal?.statusLines || [];
  const step = Math.floor(BOOT_MS / (lines.length + 2));
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000, background: 'var(--bg-dark)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-mono)', color: 'var(--accent)', animation: `bootFade ${BOOT_MS}ms ease-in forwards`,
    }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '0.3em', marginBottom: '1rem', textShadow: '0 0 16px var(--accent-glow)' }}>
        INITIALIZING {booting.terminal?.name || booting.name}…
      </div>
      <div style={{ minWidth: '260px' }}>
        {lines.map((l, i) => (
          <div key={l} style={{ fontSize: '0.75rem', letterSpacing: '0.12em', color: 'var(--text)', opacity: 0, animation: `bootLine 120ms linear ${step * (i + 1)}ms forwards` }}>
            &gt; {l} <span style={{ color: 'var(--success)' }}>OK</span>
          </div>
        ))}
      </div>
      <div style={{ width: '260px', height: '2px', background: 'var(--border)', marginTop: '1rem', overflow: 'hidden' }}>
        <div style={{ height: '100%', background: 'var(--accent)', animation: `bootBar ${BOOT_MS}ms linear forwards` }} />
      </div>
    </div>
  );
}
