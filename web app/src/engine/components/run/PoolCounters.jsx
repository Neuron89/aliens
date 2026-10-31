import React from 'react';
import { useGame } from '../../GameContext';
import { useUniverse } from '../../UniverseContext';
import { poolDefs, poolStart } from '../../mechanicsUtils';

/* GM header counters for shared pools (backlog row 44; universe.rules.pools only).
   Momentum/Threat with ± buttons; RESET starts the pools over (threat = per-player × seated players). */
export default function PoolCounters({ className = '' }) {
  const { table, poolDelta, poolsInit, players } = useGame();
  const { universe } = useUniverse();
  const defs = universe.rules?.pools || [];
  const GM = String(universe.terms?.gmShort || universe.terms?.gm || 'GM').toUpperCase();
  if (!defs.length || !table) return null;
  const seated = Object.values(players || {}).filter((p) => p.character).length || Object.keys(players || {}).length;
  const ready = table.poolDefs && Object.keys(table.poolDefs).length > 0;
  const reset = () => {
    const values = poolStart(universe, seated);
    if (!confirm(`Reset pools to ${Object.entries(values).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(', ')}?`)) return;
    poolsInit(poolDefs(universe), values, true);
  };
  if (!ready) {
    return (
      <div className={`pool-counters ${className}`}>
        <button type="button" className="run-btn sm primary" onClick={() => poolsInit(poolDefs(universe), poolStart(universe, seated), true)}>START POOLS</button>
      </div>
    );
  }
  return (
    <div className={`pool-counters ${className}`} role="group" aria-label="Pools">
      {defs.map((d) => {
        const v = table.pools?.[d.key] ?? 0;
        const max = table.poolDefs[d.key]?.max;
        const hidden = !table.poolDefs[d.key]?.visible;
        /* A pool the players never see reads as the GM's own pool: "GM THREAT" (universe term), not "THREAT (GM)". */
        return (
          <span key={d.key} className={`pool-c k-${d.key}${hidden ? ' gm' : ''}`} title={hidden ? `${GM} ${d.label} pool: hidden from the ${String(universe.terms?.players || 'players').toLowerCase()}` : undefined}>
            <span className="pool-c-label">{hidden ? `${GM} ${d.label}` : d.label}</span>
            <button type="button" aria-label={`${d.label} minus one`} onClick={() => poolDelta(d.key, -1)} disabled={v <= 0}>−</button>
            <b>{v}{max ? <small>/{max}</small> : null}</b>
            <button type="button" aria-label={`${d.label} plus one`} onClick={() => poolDelta(d.key, 1)} disabled={!!max && v >= max}>+</button>
          </span>
        );
      })}
      <button type="button" className="run-btn sm" onClick={reset} title="New session: reset pools">RESET</button>
    </div>
  );
}
