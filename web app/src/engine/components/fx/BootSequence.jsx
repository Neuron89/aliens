import React, { useEffect, useState } from 'react';
import { useUniverse, BOOT_MS } from '../../UniverseContext';
import { useGame } from '../../GameContext';
import { play } from '../../sfx';

/* ═══════════════════════════════════════════════════════════════
   BootSequence — shown while UniverseContext.booting is set.
   theme.boot:
     'terminal'  (ALIEN) typed lines from terminal.statusLines + a block
                 cursor, ≤ 900 ms. Link/channel lines are truthful: they
                 read STANDBY unless the socket is connected.
     'sandstorm' (DUNE) a slow sand-coloured wipe with the terminal name.
   Any click / key / tap skips it. Never shown with reduced motion/FX
   (UniverseContext does not set `booting` then).
   ═══════════════════════════════════════════════════════════════ */

const LINK_RE = /UPLINK|LINK|CHANNEL|COMMS/i;

function useTyped(lines, total) {
  const chars = lines.reduce((n, l) => n + l.length, 0) || 1;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const typeMs = total * 0.72;
    let raf;
    const tick = (t) => {
      const n = Math.min(chars, Math.ceil(((t - start) / typeMs) * chars));
      setShown(n);
      if (n < chars) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [chars, total]);
  let left = shown;
  return lines.map((l) => { const s = l.slice(0, Math.max(0, left)); left -= l.length; return s; });
}

function TerminalBoot({ u, connected }) {
  const status = u.terminal?.statusLines || [];
  const head = `INITIALIZING ${u.terminal?.name || u.name}`;
  const lines = [head, ...status.map((l) => `> ${l}`)];
  const typed = useTyped(lines, BOOT_MS);
  const doneIdx = typed.findIndex((t, i) => t.length < lines[i].length);
  const active = doneIdx === -1 ? lines.length - 1 : doneIdx;
  return (
    <div className="boot-term" style={{ '--boot-ms': `${BOOT_MS}ms` }}>
      {typed.map((t, i) => {
        const complete = t.length === lines[i].length;
        const raw = status[i - 1] || '';
        const link = i > 0 && LINK_RE.test(raw);
        return (
          <div key={i} className={i === 0 ? 'boot-title' : 'boot-line'}>
            {t}
            {i > 0 && complete && (link && !connected
              ? <span className="boot-standby">  ·· STANDBY</span>
              : <span className="boot-ok">  ·· OK</span>)}
            {i === active && <span className="boot-cursor" aria-hidden="true" />}
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

  useEffect(() => {
    if (!booting) return undefined;
    play(style === 'sandstorm' ? 'reveal' : 'ui.confirm');
    const skip = () => skipBoot();
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, [booting, skipBoot, style]);

  if (!booting) return null;
  const name = booting.terminal?.name || booting.name;

  if (style === 'sandstorm') {
    return (
      <div className="boot boot-sand" onPointerDown={skipBoot} role="status" aria-label={`${name} starting`} style={{ '--boot-ms': '1100ms' }}>
        <div className="boot-sand-wipe" />
        <div className="boot-sand-title">{name}</div>
      </div>
    );
  }
  return (
    <div className="boot boot-crt" onPointerDown={skipBoot} role="status" aria-label={`${name} starting`}>
      <TerminalBoot u={booting} connected={!!game?.connected} />
      <div className="boot-skip">TAP OR PRESS ANY KEY TO SKIP</div>
    </div>
  );
}
