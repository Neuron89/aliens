import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../GameContext';
import { useUniverse } from '../UniverseContext';
import { useFx } from './player/fx';
import Icon from './run/icons';

/* Core sections every universe gets; universe.navSections are appended. */
export const CORE_SECTIONS = [
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'characters', label: 'Characters' },
  { id: 'maps', label: 'Maps' },
  { id: 'dice', label: 'Dice Roller' },
];

/** Clicking the tab that is already active fires this window event ({ detail: sectionId }) so a
    section can return to its root view (ScenarioLibrary: back from a scenario detail to the library). */
export const NAV_RESELECT = 'engine:nav-reselect';
export const onNavReselect = (id, fn) => {
  const h = (e) => { if (e.detail === id) fn(); };
  window.addEventListener(NAV_RESELECT, h);
  return () => window.removeEventListener(NAV_RESELECT, h);
};

/* A new session replaced the one this terminal was running (e.g. Game Night wizard START SESSION):
   the code everyone joined with is dead — show the new one with COPY NEW CODE until dismissed. */
function NewCodeBanner() {
  const { gameCode } = useGame();
  const prev = useRef(gameCode);
  const [notice, setNotice] = useState(null); // { code, old }
  const [copied, setCopied] = useState(null);
  useEffect(() => {
    if (prev.current && gameCode && prev.current !== gameCode) setNotice({ code: gameCode, old: prev.current });
    if (!gameCode) setNotice(null);
    prev.current = gameCode;
  }, [gameCode]);
  if (!notice || notice.code !== gameCode) return null;
  const link = typeof window !== 'undefined' ? `${window.location.origin}?join=${notice.code}` : '';
  const copy = (text, what) => {
    navigator.clipboard?.writeText(text).then(() => setCopied(what), () => setCopied('fail'));
    setTimeout(() => setCopied(null), 2500);
  };
  return (
    <div className="dm-newcode" role="status">
      <span><b>NEW ACCESS CODE {notice.code}</b> — {notice.old} is closed; every player rejoins with the new code.</span>
      <button type="button" className="run-btn sm primary" onClick={() => copy(notice.code, 'code')}>{copied === 'code' ? 'COPIED' : 'COPY NEW CODE'}</button>
      <button type="button" className="run-btn sm" onClick={() => copy(link, 'link')}>{copied === 'link' ? 'COPIED' : 'COPY JOIN LINK'}</button>
      <button type="button" className="run-btn sm" onClick={() => setNotice(null)} aria-label="Dismiss">✕</button>
    </div>
  );
}

/* DM-wide banner for the anonymous X-card: neutral wording, a soft chime, nothing
   about who pressed it. Also flags pending player-built characters. */
function DmAlerts({ onChange }) {
  const { table, pauseClear, on, poolDelta, seatClaims = [], resolveSeatClaim } = useGame();
  const { universe } = useUniverse();
  const { play } = useFx();
  /* A seat claim waits ~2 min for an answer: chime once per new claim so the GM notices it from any tab. */
  const claimIds = seatClaims.map((c) => c.claimId).join(',');
  useEffect(() => { if (claimIds) play('alert'); }, [claimIds, play]);
  const [prompts, setPrompts] = useState([]); // { id, kind:'complication'|'panic', who, text }
  useEffect(() => on('pause-requested', () => play('pause')), [on, play]);
  useEffect(() => on('character-submitted', () => play('seen')), [on, play]);
  const push = (p) => setPrompts((prev) => [...prev.filter((x) => x.id !== p.id), p].slice(-3));
  const drop = (id) => setPrompts((prev) => prev.filter((x) => x.id !== id));
  /* Dune complication → red flash + "THREAT +1?" (never auto-applied). */
  useEffect(() => on('roll', ({ roll } = {}) => {
    if (!roll || roll.secret || !roll.roll?.flags?.includes('complication')) return;
    push({ id: roll.id, kind: 'complication', who: roll.characterName || roll.playerName, text: roll.roll.label || '', n: Math.max(1, Math.min(5, Number(roll.roll.complications) || 1)) });
    play('alert');
  }), [on, play]);
  /* DUNE Determination spent on a phone → short notice (also in the roll feed). */
  useEffect(() => on('determination-spent', (d) => {
    if (!d) return;
    const id = `det-${d.playerId}-${d.at}`;
    push({ id, kind: 'determination', who: d.name, text: `${d.value}/${d.max} left${d.reason ? ` · ${d.reason}` : ''}` });
    play('seen');
    setTimeout(() => drop(id), 10000);
  }), [on, play]);
  /* Panic result → GM sees the effect (public to the GM, private on the table). */
  useEffect(() => on('panic', (p) => {
    if (!p) return;
    push({ id: `panic-${p.playerId}-${p.at}`, kind: 'panic', who: p.name, text: `${p.total}: ${p.effect?.name || ''}`, detail: p.effect?.text || '' });
    play('alert');
    if (!p.effect?.panicAction) setTimeout(() => drop(`panic-${p.playerId}-${p.at}`), 12000);
  }), [on, play]);
  const hasThreat = !!table?.poolDefs?.threat;
  const pending = (table?.submissions || []).filter((s) => s.status === 'pending').length;
  return (
    <>
      {/* Seat claims: a device asks for an existing seat by name (shown on every DM tab — the RUN tab is
          where the GM lives during play, and an unanswered claim expires). */}
      {seatClaims.length > 0 && (
        <div className="panel dm-claims" role="alert">
          {seatClaims.map((c) => (
            <div key={c.claimId} className="dm-claim">
              <span>
                A DEVICE ASKS FOR <b>{String(c.name).toUpperCase()}</b>'S SEAT
                {c.seatConnected ? ` — THAT ${universe.terms.player.toUpperCase()} IS STILL ONLINE` : ''}
              </span>
              <span className="dm-claim-actions">
                <button type="button" className="run-btn primary sm" onClick={() => resolveSeatClaim(c.claimId, true)}>APPROVE</button>
                <button type="button" className="run-btn sm danger" onClick={() => resolveSeatClaim(c.claimId, false)}>REJECT</button>
              </span>
            </div>
          ))}
          <p className="dm-claim-hint">APPROVE ONLY IF IT IS REALLY THEM: THE SEAT'S CHARACTER AND PRIVATE MESSAGES MOVE TO THE NEW DEVICE.</p>
        </div>
      )}
      {table?.pause && (
        <div className="dm-pause" role="alert">
          <span className="dm-pause-mark" aria-hidden="true">❚❚</span>
          <span><b>PAUSE REQUESTED</b> — someone at the table needs a moment. No reason needed; check in, adjust, continue.</span>
          <button type="button" className="run-btn primary" onClick={() => pauseClear()}>RESUME PLAY</button>
        </div>
      )}
      {prompts.length > 0 && (
        <div className="dm-prompts" role="alert">
          {prompts.map((p) => (
            <div key={p.id} className={`dm-prompt k-${p.kind}`}>
              {p.kind === 'complication' ? (
                <>
                  <span><b>{p.n > 1 ? `${p.n} COMPLICATIONS` : 'COMPLICATION'}</b> — {p.who}{p.text ? ` · ${p.text}` : ''}. {hasThreat ? `THREAT +${p.n}?` : ''}</span>
                  {hasThreat && <button type="button" className="run-btn sm primary" onClick={() => { poolDelta('threat', p.n, `complication (${p.who})`); drop(p.id); }}>+{p.n} THREAT</button>}
                  {hasThreat && <button type="button" className="run-btn sm" onClick={() => { poolDelta('threat', 2 * p.n, `complication converted (${p.who})`); drop(p.id); }}>+{2 * p.n} (CONVERT)</button>}
                </>
              ) : p.kind === 'determination' ? (
                <span><b>DETERMINATION SPENT</b> — {p.who} · {p.text}</span>
              ) : (
                <span><b>PANIC</b> — {p.who} {p.text}{p.detail ? <small> {p.detail}</small> : null}</span>
              )}
              <button type="button" className="run-btn sm" onClick={() => drop(p.id)} aria-label="Dismiss">✕</button>
            </div>
          ))}
        </div>
      )}
      {pending > 0 && (
        <button type="button" className="dm-subs" onClick={() => onChange('session')}>
          {pending} PLAYER-BUILT CHARACTER{pending > 1 ? 'S' : ''} WAITING — REVIEW
        </button>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LEFT RAIL (72px; a bottom bar below 900px, scrolling below 600px).
   PLAY: Run · Board · Crew (terms.players)   LIBRARY: Stories · Characters
   · Maps · Rules (universe.navSections as sub-tabs)   bottom: Dice · Audio.
   Badges: Run (pause requested), Crew (seat claims + player-built
   characters waiting + unread messages).
   ═══════════════════════════════════════════════════════════════ */
export function railSections(universe) {
  const terms = universe.terms;
  return {
    play: [
      { id: 'run', label: 'Run', icon: 'run' },
      { id: 'board', label: 'Board', icon: 'board' },
      { id: 'session', label: terms.players, icon: 'crew', short: terms.players.length > 8 ? terms.players.split(/\s+/).pop() : undefined },
    ],
    library: [
      { id: 'scenarios', label: 'Stories', icon: 'stories' },
      { id: 'characters', label: 'Characters', icon: 'characters', short: 'Chars' },
      { id: 'maps', label: 'Maps', icon: 'maps' },
      ...((universe.navSections || []).length ? [{ id: 'rules', label: 'Rules', icon: 'rules' }] : []),
    ],
    tools: [{ id: 'dice', label: 'Dice', icon: 'dice' }],
  };
}

function AudioPop({ audio, onClose, anchor }) {
  const ref = useRef(null);
  const { universe } = useUniverse();
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target) && !anchor.current?.contains(e.target)) onClose(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    requestAnimationFrame(() => ref.current?.querySelector('button')?.focus({ preventScroll: true }));
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [onClose, anchor]);
  if (!audio) return null;
  const { preset, volume, presets, applyPreset, updateVolume } = audio;
  // Only this universe's moods (theme.ambient); OFF and whatever is playing now are always listed.
  const own = universe?.theme?.ambient;
  const shown = Object.entries(presets).filter(([key]) => !Array.isArray(own) || key === 'off' || key === preset || own.includes(key));
  return (
    <div ref={ref} className="rail-audio" role="dialog" aria-label="Ambient audio">
      <div className="rail-audio-head">AMBIENT AUDIO <span>{presets[preset]?.label || 'OFF'}</span></div>
      <div className="rail-audio-presets">
        {shown.map(([key, val]) => (
          <button key={key} type="button" className={preset === key ? 'on' : ''} aria-pressed={preset === key} onClick={() => applyPreset(key)}>{val.label}</button>
        ))}
      </div>
      <label className="rail-audio-vol">
        <span>VOL</span>
        <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => updateVolume(parseFloat(e.target.value))} aria-label="Ambient volume" />
        <span>{Math.round(volume * 100)}%</span>
      </label>
    </div>
  );
}

export default function Nav({ active, onChange, audio }) {
  const { unreadCount, table, seatClaims = [] } = useGame();
  const { universe } = useUniverse();
  const [audioOpen, setAudioOpen] = useState(false);
  const audioBtn = useRef(null);
  const groups = railSections(universe);
  const pending = (table?.submissions || []).filter((s) => s.status === 'pending').length;
  const crewBadge = seatClaims.length + pending + (unreadCount || 0);

  const go = (id) => {
    // Re-selecting the active entry resets that section to its root (e.g. STORIES → library).
    if (active === id) window.dispatchEvent(new CustomEvent(NAV_RESELECT, { detail: id }));
    onChange(id);
  };
  const btn = (s) => {
    const on = active === s.id;
    const badge = s.id === 'session' && crewBadge > 0 ? crewBadge : null;
    const dot = s.id === 'run' && table?.pause;
    const extra = badge ? `, ${badge} waiting` : dot ? ', pause requested' : '';
    return (
      <button key={s.id} type="button" className={`rail-btn${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined}
        aria-label={`${s.label}${extra}`} onClick={() => go(s.id)}>
        <Icon name={s.icon} />
        <span className="rail-l">{s.short || s.label}</span>
        {badge && <span className="rail-badge" aria-hidden="true">{badge > 9 ? '9+' : badge}</span>}
        {dot && <span className="rail-dot" aria-hidden="true" />}
      </button>
    );
  };

  return (
    <nav className="rail" aria-label="Sections">
      <div className="rail-group" role="group" aria-label="Play">
        <span className="rail-k" aria-hidden="true">PLAY</span>
        {groups.play.map(btn)}
      </div>
      <div className="rail-group" role="group" aria-label="Library">
        <span className="rail-k" aria-hidden="true">LIBRARY</span>
        {groups.library.map(btn)}
      </div>
      <span className="rail-fill" />
      <div className="rail-group rail-tools" role="group" aria-label="Tools">
        {groups.tools.map(btn)}
        {audio && (
          <button ref={audioBtn} type="button" className={`rail-btn${audioOpen ? ' on' : ''}${audio.isActive ? ' live' : ''}`}
            aria-expanded={audioOpen} aria-haspopup="dialog" aria-label={`Audio${audio.isActive ? `: ${audio.presets[audio.preset]?.label || ''}` : ''}`}
            onClick={() => setAudioOpen((o) => !o)}>
            <Icon name="audio" />
            <span className="rail-l">Audio</span>
            {audio.isActive && <span className="rail-dot live" aria-hidden="true" />}
          </button>
        )}
      </div>
      {audioOpen && <AudioPop audio={audio} anchor={audioBtn} onClose={() => setAudioOpen(false)} />}
    </nav>
  );
}

/** Banners shown above every GM section (new access code, seat claims, pause, prompts, player-built characters). */
export function DmBanners({ onChange }) {
  return (
    <>
      <NewCodeBanner />
      <DmAlerts onChange={onChange} />
    </>
  );
}
