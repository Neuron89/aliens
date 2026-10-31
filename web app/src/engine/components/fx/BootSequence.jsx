import React, { useEffect, useRef, useState } from 'react';
import { useUniverse, bootDuration } from '../../UniverseContext';
import { useGame } from '../../GameContext';
import { play } from '../../sfx';

/* ═══════════════════════════════════════════════════════════════
   BootSequence — shown while UniverseContext.booting is set.
   theme.boot:
     'terminal'  (ALIEN) the lines in terminal.bootLines (else the
                 statusLines) type out ONE CHARACTER AT A TIME, each
                 keystroke with the 'boot.key' sound, a chirp when a
                 line lands, a pause before the next line, and the last
                 line held under a block cursor until the screen fades.
                 The pace comes from theme.bootMs (ALIEN sets ~10 s on
                 purpose; the default is 900 ms). Link/channel lines are
                 truthful: they read STANDBY unless the socket is up.
     'sandstorm' (DUNE) a slow sand-coloured wipe with the terminal name.
   Any click / key / tap skips it. Never shown with reduced motion/FX
   (UniverseContext does not set `booting` then).
   ═══════════════════════════════════════════════════════════════ */

const LINK_RE = /UPLINK|LINK|CHANNEL|COMMS/i;
const DOT_RE = /[.…·]/;

/** Build the keystroke schedule for `lines` inside `total` ms:
    each character gets a slot (dots type slowly, like a terminal waiting on a subsystem),
    each line ends with a pause, and the end holds for the final tenth. Returns
    [{ line, chars, t }] = at time t, line `line` shows `chars` characters. */
function schedule(lines, total) {
  const typeMs = total * 0.78;              // typing budget; the rest is the pause + the fade
  const linePause = 2.2;                    // in character slots
  const slots = lines.reduce((n, l) => n + [...l].reduce((m, c) => m + (DOT_RE.test(c) ? 2.4 : 1), 0) + linePause, 0);
  const slot = typeMs / Math.max(1, slots);
  const out = [];
  let t = 0;
  lines.forEach((l, li) => {
    const chars = [...l];
    for (let i = 1; i <= chars.length; i++) {
      t += slot * (DOT_RE.test(chars[i - 1]) ? 2.4 : 1);
      out.push({ line: li, chars: i, t });
    }
    t += slot * linePause;
  });
  return out;
}

function useTypewriter(lines, total, { onKey, onLine, onDone } = {}) {
  const [state, setState] = useState({ line: 0, chars: 0 });
  const cbs = useRef({ onKey, onLine, onDone });
  cbs.current = { onKey, onLine, onDone };
  useEffect(() => {
    const steps = schedule(lines, total);
    const start = performance.now();
    let i = 0;
    let raf;
    const tick = (now) => {
      const el = now - start;
      let last = null;
      while (i < steps.length && steps[i].t <= el) { last = steps[i]; i++; }
      if (last) {
        setState({ line: last.line, chars: last.chars });
        const ch = [...lines[last.line]][last.chars - 1];
        if (ch && ch !== ' ') cbs.current.onKey?.(ch);
        if (last.chars === [...lines[last.line]].length) cbs.current.onLine?.(last.line);
        if (i >= steps.length) { cbs.current.onDone?.(); return; }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lines, total]);
  return lines.map((l, li) => {
    if (li < state.line) return l;
    if (li === state.line) return [...l].slice(0, state.chars).join('');
    return '';
  });
}

function TerminalBoot({ u, connected, total }) {
  const t = u.terminal || {};
  const status = t.statusLines || [];
  const lines = React.useMemo(() => {
    const body = (t.bootLines?.length ? t.bootLines : status.map((l) => `> ${l}`));
    return [`INITIALIZING ${t.name || u.name}`, ...body];
  }, [t.bootLines, t.name, status, u.name]);
  const typed = useTypewriter(lines, total, {
    onKey: (ch) => play('boot.key', { volume: DOT_RE.test(ch) ? 0.55 : 0.9 }),
    onLine: (li) => play(li === lines.length - 1 ? 'boot.ready' : 'boot.line'),
  });
  const active = typed.findIndex((s, i) => s.length < lines[i].length);
  const cursorAt = active === -1 ? lines.length - 1 : active;
  return (
    <div className="boot-term" style={{ '--boot-ms': `${total}ms` }}>
      {typed.map((s, i) => {
        if (i > 0 && !s) return null;
        const complete = s.length === lines[i].length;
        const link = i > 0 && LINK_RE.test(lines[i]);
        return (
          <div key={i} className={i === 0 ? 'boot-title' : 'boot-line'}>
            {s}
            {i > 0 && i < lines.length - 1 && complete && link && !connected && <span className="boot-standby">  ·· STANDBY</span>}
            {i === cursorAt && <span className="boot-cursor" aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}

export default function BootSequence() {
  const { booting, skipBoot } = useUniverse();
  const game = useGame();
  const style = booting?.theme?.boot || 'terminal';
  const total = bootDuration(booting);

  useEffect(() => {
    if (!booting) return undefined;
    if (style === 'sandstorm') play('reveal');
    const skip = () => skipBoot();
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, [booting, skipBoot, style]);

  if (!booting) return null;
  const name = booting.terminal?.name || booting.name;

  if (style === 'sandstorm') {
    return (
      <div className="boot boot-sand" onPointerDown={skipBoot} role="status" aria-label={`${name} starting`} style={{ '--boot-ms': `${total}ms` }}>
        <div className="boot-sand-wipe" />
        <div className="boot-sand-title">{name}</div>
      </div>
    );
  }
  return (
    <div className="boot boot-crt" onPointerDown={skipBoot} role="status" aria-label={`${name} starting`}>
      <TerminalBoot u={booting} connected={!!game?.connected} total={total} />
      <div className="boot-skip">TAP OR PRESS ANY KEY TO SKIP</div>
    </div>
  );
}
