import React, { useState } from 'react';
import { useGame } from '../GameContext';
import { useUniverse } from '../UniverseContext';
import CharacterSheet from './CharacterSheet';
import { MapViewer } from './Maps';

/* Shared building blocks for ScenarioDetail and ScenarioPlayer.
   All rendering is driven by content-pack data + universe terms. */

export const S = {
  panel: {
    border: '1px solid var(--border)', background: 'var(--bg-panel)',
    padding: '1rem', marginBottom: '0.75rem',
  },
  accent: { color: 'var(--accent)' },
  dim: { color: 'var(--text-dim)', fontSize: '0.8rem' },
  h3: { fontSize: '0.8rem', color: 'var(--accent)', letterSpacing: '0.1em' },
  label: {
    display: 'block', fontSize: '0.6rem', color: 'var(--text-dim)',
    letterSpacing: '0.14em', marginBottom: '0.3rem',
  },
  tag: (color) => ({
    display: 'inline-block', padding: '0.15rem 0.5rem', fontSize: '0.6rem',
    letterSpacing: '0.08em', border: `1px solid ${color}`, color,
    marginRight: '0.3rem', marginBottom: '0.2rem',
  }),
  btn: (active) => ({
    padding: '0.35rem 0.7rem', background: active ? 'var(--accent-glow)' : 'transparent',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    color: active ? 'var(--accent)' : 'var(--text-dim)',
    fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
    letterSpacing: '0.06em', cursor: 'pointer',
  }),
  input: {
    padding: '0.35rem 0.5rem', background: 'var(--bg-card)',
    border: '1px solid var(--border)', color: 'var(--text)',
    fontFamily: 'var(--font-mono)', fontSize: '0.7rem', boxSizing: 'border-box',
  },
};

/* Collapsible panel */
export function Collapsible({ title, count, defaultOpen = false, children, style }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ ...S.panel, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <h3 style={S.h3}>{title}{count !== undefined ? ` (${count})` : ''}</h3>
        <span style={{ ...S.dim, fontSize: '0.7rem' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div style={{ marginTop: '0.6rem' }}>{children}</div>}
    </div>
  );
}

export function TTSControls({ tts, paragraphs }) {
  const { isSpeaking, isPaused, speak, pause, resume, stop, skipBack, skipForward, voices, selectedVoice, setSelectedVoice, rate, setRate } = tts;

  return (
    <div className="tts-controls">
      {!isSpeaking ? (
        <button onClick={() => speak(paragraphs)} disabled={!paragraphs.length}>▶ READ ALOUD</button>
      ) : (
        <>
          {isPaused ? (
            <button onClick={resume}>▶ RESUME</button>
          ) : (
            <button onClick={pause}>❚❚ PAUSE</button>
          )}
          <button onClick={stop}>■ STOP</button>
          <button onClick={skipBack}>⏮</button>
          <button onClick={skipForward}>⏭</button>
        </>
      )}
      <label>
        Speed:
        <input type="range" min="0.5" max="1.5" step="0.05" value={rate} onChange={e => setRate(parseFloat(e.target.value))} />
        {rate.toFixed(2)}
      </label>
      {voices.length > 1 && (
        <label>
          Voice:
          <select value={selectedVoice?.name || ''} onChange={e => setSelectedVoice(voices.find(v => v.name === e.target.value))}>
            {voices.filter(v => v.lang.startsWith('en')).map(v => (
              <option key={v.name} value={v.name}>{v.name.substring(0, 30)}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

export function TipsPanel({ tips, defaultOpen = true }) {
  const { universe } = useUniverse();
  if (!tips?.length) return null;
  return (
    <Collapsible title={`${universe.terms.gm.toUpperCase()} TIPS`} count={tips.length} defaultOpen={defaultOpen}>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {tips.map((tip, i) => (
          <li key={i} style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: '1.5', marginBottom: '0.3rem', paddingLeft: '1rem', position: 'relative' }}>
            <span style={{ position: 'absolute', left: 0, color: 'var(--accent)' }}>▸</span>
            {tip}
          </li>
        ))}
      </ul>
    </Collapsible>
  );
}

export function NpcTracker({ npcs, defaultOpen = false }) {
  const [notes, setNotes] = useState({});
  if (!npcs?.length) return null;
  return (
    <Collapsible title="NPC TRACKER" count={npcs.length} defaultOpen={defaultOpen}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {npcs.map((npc, i) => {
          const status = notes[i] || 'ACTIVE';
          return (
            <div key={i} style={{ padding: '0.5rem', border: '1px solid var(--border)', background: 'var(--bg-card)', opacity: status === 'DEAD' ? 0.5 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem', gap: '0.5rem' }}>
                <div>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--text)', textDecoration: status === 'DEAD' ? 'line-through' : 'none' }}>{npc.name}</strong>
                  {npc.role && <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginLeft: '0.4rem' }}>{npc.role}</span>}
                </div>
                <span style={{ display: 'flex', gap: '0.2rem' }}>
                  {['ACTIVE', 'MISSING', 'TURNED', 'DEAD'].map(st => (
                    <button key={st} onClick={() => setNotes(prev => ({ ...prev, [i]: st }))}
                      style={{ ...S.btn(status === st), fontSize: '0.5rem', padding: '0.1rem 0.3rem' }}>{st}</button>
                  ))}
                </span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--accent)', marginBottom: '0.15rem' }}>AGENDA: {npc.agenda}</div>
              <div style={{ fontSize: '0.7rem', ...S.dim }}>{npc.behavior}</div>
              {npc.secret && <div style={{ fontSize: '0.7rem', color: 'var(--warn)', marginTop: '0.15rem' }}>SECRET: {npc.secret}</div>}
              {npc.stats && Object.keys(npc.stats).length > 0 && (
                <div className="creature-stats" style={{ marginTop: '0.3rem' }}>
                  {Object.entries(npc.stats).map(([k, v]) => <span key={k}>{k.toUpperCase()} {String(v)}</span>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Collapsible>
  );
}

export function ThreatsPanel({ threats, defaultOpen = false }) {
  if (!threats?.length) return null;
  return (
    <Collapsible title="THREATS" count={threats.length} defaultOpen={defaultOpen}>
      {threats.map((t, i) => (
        <div key={i} style={{ padding: '0.5rem', border: '1px solid var(--danger)', background: 'color-mix(in srgb, var(--danger) 5%, transparent)', marginBottom: '0.4rem' }}>
          <strong style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{t.name}</strong>
          {t.ref && <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginLeft: '0.4rem' }}>REF: {t.ref}</span>}
          {t.description && <p style={{ fontSize: '0.72rem', color: 'var(--text)', marginTop: '0.2rem' }}>{t.description}</p>}
          {t.stats && Object.keys(t.stats).length > 0 && (
            <div className="creature-stats" style={{ marginTop: '0.3rem' }}>
              {Object.entries(t.stats).map(([k, v]) => <span key={k}>{k.toUpperCase()} {String(v)}</span>)}
            </div>
          )}
          {t.tactics && <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>TACTICS: {t.tactics}</p>}
        </div>
      ))}
    </Collapsible>
  );
}

export function KeyLocationsPanel({ locations }) {
  if (!locations?.length) return null;
  return (
    <div className="panel">
      <h2>KEY LOCATIONS</h2>
      <div className="location-grid">
        {locations.map((loc, i) => (
          <div key={i} className="location-item">
            <div className="loc-name">{loc.name}</div>
            <div className="loc-desc">{loc.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MapsPanel({ maps, packTitle }) {
  const [openId, setOpenId] = useState(null);
  if (!maps?.length) return null;
  const open = maps.find(m => m.id === openId);
  return (
    <div className="panel">
      <h2>MAPS</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: open ? '0.75rem' : 0 }}>
        {maps.map(m => (
          <button key={m.id} style={S.btn(openId === m.id)} onClick={() => setOpenId(openId === m.id ? null : m.id)}>
            {m.title}{m.kind === 'image' ? ' ▣' : ' ⌗'}
          </button>
        ))}
      </div>
      {open && <MapViewer key={open.id} map={{ ...open, group: packTitle }} />}
    </div>
  );
}

export function EndingsPanel({ endings, tts }) {
  if (!endings?.length) return null;
  return (
    <div className="panel">
      <h2>ENDINGS</h2>
      {endings.map((e, i) => (
        <div key={i} style={{ marginBottom: '0.75rem', padding: '0.6rem 0.75rem', borderLeft: '3px solid var(--accent)', background: 'color-mix(in srgb, var(--accent) 3%, transparent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
            <strong style={{ fontSize: '0.8rem', color: 'var(--accent)', letterSpacing: '0.08em' }}>{e.title}</strong>
            {tts && <button style={S.btn(false)} onClick={() => tts.speak([e.text])}>▶ READ</button>}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--warn)', margin: '0.2rem 0' }}>IF: {e.condition}</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text)', lineHeight: '1.6', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>{e.text}</p>
        </div>
      ))}
    </div>
  );
}

export function CharactersPanel({ characters, packTitle }) {
  const [openId, setOpenId] = useState(null);
  if (!characters?.length) return null;
  const open = characters.find(c => c.id === openId);
  return (
    <div className="panel">
      <h2>CHARACTERS</h2>
      {open ? (
        <CharacterSheet character={open} source={packTitle} onBack={() => setOpenId(null)} backLabel="← BACK TO SCENARIO CHARACTERS" />
      ) : (
        <div className="character-grid">
          {characters.map(c => (
            <div key={c.id} className="character-card" onClick={() => setOpenId(c.id)}>
              <div className="char-career">{c.career}</div>
              <div className="char-name">{c.name}</div>
              <div className="char-scenario" style={{ fontSize: '0.65rem' }}>{c.personalAgenda?.slice(0, 90)}{c.personalAgenda?.length > 90 ? '…' : ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Handouts with "SEND AS TRANSMISSION" via GameContext.broadcastMessage / sendMessage. */
export function HandoutsPanel({ handouts, defaultOpen = false }) {
  const { role, players, broadcastMessage, sendMessage } = useGame();
  const { universe } = useUniverse();
  const { terms } = universe;
  const priorities = terms.priorities || [];
  const [targets, setTargets] = useState({});
  const [sent, setSent] = useState({});
  if (!handouts?.length) return null;

  const live = role === 'dm';
  const playerList = Object.values(players || {});
  const MESSAGE = terms.message.toUpperCase();

  const send = (h) => {
    const target = targets[h.id] || 'broadcast';
    const header = [h.title, h.from ? `FROM: ${h.from}` : null, h.to ? `TO: ${h.to}` : null].filter(Boolean).join('\n');
    const text = `${header}\n\n${h.text}`;
    const priority = priorities.includes(h.priority) ? h.priority : (h.priority || priorities[0] || 'STANDARD');
    if (target === 'broadcast') broadcastMessage(text, priority);
    else sendMessage(target, text, priority);
    setSent(prev => ({ ...prev, [h.id]: (prev[h.id] || 0) + 1 }));
  };

  return (
    <Collapsible title="HANDOUTS" count={handouts.length} defaultOpen={defaultOpen}>
      {!live && (
        <p style={{ ...S.dim, fontSize: '0.7rem', marginBottom: '0.5rem' }}>
          Start a {terms.session.toLowerCase()} to send handouts to the {terms.players.toLowerCase()}' phones.
        </p>
      )}
      {handouts.map(h => (
        <div key={h.id} style={{ padding: '0.5rem', border: '1px solid var(--border)', background: 'var(--bg-card)', marginBottom: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '0.78rem', color: 'var(--text)', letterSpacing: '0.06em' }}>{h.title}</strong>
            {h.priority && <span style={S.tag('var(--warn)')}>{h.priority}</span>}
          </div>
          {(h.from || h.to) && (
            <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', margin: '0.15rem 0' }}>
              {h.from && <>FROM: {h.from}</>}{h.from && h.to && ' — '}{h.to && <>TO: {h.to}</>}
            </div>
          )}
          {h.when && <div style={{ fontSize: '0.62rem', color: 'var(--accent)', marginBottom: '0.25rem' }}>WHEN: {h.when}</div>}
          <p style={{ fontSize: '0.72rem', color: 'var(--text)', lineHeight: '1.5', whiteSpace: 'pre-wrap', maxHeight: '9rem', overflowY: 'auto' }}>{h.text}</p>
          <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={targets[h.id] || 'broadcast'} disabled={!live}
              onChange={e => setTargets(prev => ({ ...prev, [h.id]: e.target.value }))} style={S.input}>
              <option value="broadcast">ALL {terms.players.toUpperCase()} ({terms.broadcast.toUpperCase()})</option>
              {playerList.map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.character ? ` — ${p.character.name}` : ''}</option>
              ))}
            </select>
            <button style={S.btn(live)} disabled={!live} onClick={() => send(h)}>
              SEND AS {MESSAGE}
            </button>
            {sent[h.id] > 0 && <span style={{ fontSize: '0.6rem', color: 'var(--success)' }}>✓ SENT{sent[h.id] > 1 ? ` ×${sent[h.id]}` : ''}</span>}
          </div>
        </div>
      ))}
    </Collapsible>
  );
}
