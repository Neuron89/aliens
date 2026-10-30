import React, { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../GameContext';
import { useUniverse } from '../../UniverseContext';
import { getCatalog } from '../../catalogUtils';
import { creatureStats, attackDice, tableLookup, rollDie } from '../../mechanicsUtils';
import { STATUS_DEFS, tokenStatuses } from '../board/TokenChip';

/* ═══════════════════════════════════════════════════════════════
   THREATS (backlog row 28) — NPC/creature quick cards, RUN rail tab + DM tab.
   One card per creature/NPC token on the board (board.tokens); stats come
   from universe.catalog.creatures by token.ref. Health lives on the token
   (token.hp / token.hpMax — GM-only, persisted, never sent to the TV).
   Status toggles write token.status (the TV ring). ROLL ATTACK is a secret
   GM roll (gm-roll): signature attack die + its "N Base Dice" pool.
   ═══════════════════════════════════════════════════════════════ */
const STATUS_KEYS = ['wounded', 'broken', 'burning', 'stress'];
const tokId = () => `cr-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Die size of a signature table = the highest number named in its ranges (6, 20, 66…). */
function dieOf(table) {
  let max = 0;
  for (const e of table || []) for (const n of String(e.roll || '').match(/\d+/g) || []) max = Math.max(max, Number(n));
  return max || 6;
}

function rollPool(n) {
  const dice = Array.from({ length: Math.max(0, Math.min(30, n)) }, () => rollDie(6));
  return { dice, successes: dice.filter((d) => d === 6).length };
}

function ThreatCard({ t, creature, onUpsert, onRemove, onSecretRoll }) {
  const [sig, setSig] = useState(null); // { roll, entry, pool? }
  const stats = creatureStats(creature);
  const hpMax = t.hpMax ?? stats.hpMax;
  const hp = t.hp ?? hpMax;
  const statuses = tokenStatuses(t.status);
  const sigs = creature?.signatureAttacks || [];
  const die = dieOf(sigs);
  const setHp = (v) => onUpsert({ id: t.id, hp: Math.max(0, Math.min(hpMax ?? 999, v)), ...(t.hpMax == null && hpMax ? { hpMax } : {}) });
  const toggle = (key) => {
    const on = statuses.some((s) => s.key === key);
    const next = on ? statuses.filter((s) => s.key !== key) : [...statuses, { key, count: null }];
    onUpsert({ id: t.id, status: next.map((s) => (s.count ? `${s.key}:${s.count}` : s.key)) });
  };
  const rollSignature = (secretAttack) => {
    if (!sigs.length) return;
    const n = rollDie(die);
    const entry = tableLookup(sigs, n);
    const nd = attackDice(entry?.text);
    const pool = secretAttack && nd ? rollPool(nd) : null;
    setSig({ roll: n, entry, pool });
    if (secretAttack) {
      onSecretRoll({
        kind: 'gm', label: `${(entry?.name || 'ATTACK').toUpperCase()}`,
        summary: `${t.label}: d${die}=${n} ${entry?.name || '—'}${pool ? ` — ${pool.successes} success${pool.successes === 1 ? '' : 'es'} on ${nd} dice` : ''}`,
        successes: pool ? pool.successes : undefined,
        flags: pool && pool.successes >= 2 ? ['crit'] : [],
        dice: pool ? { base: pool.dice } : {},
        pool: pool ? { base: nd, stress: 0 } : undefined,
      }, t.label);
    }
  };
  const pct = hpMax ? Math.max(0, Math.min(100, (hp / hpMax) * 100)) : 0;

  return (
    <article className={`thr-card k-${t.kind}${hp === 0 && hpMax ? ' down' : ''}`}>
      <header className="thr-head">
        {creature?.art && <img className="thr-art" src={creature.art} alt="" loading="lazy" />}
        <div className="thr-title">
          <b>{t.label || creature?.name || t.kind.toUpperCase()}</b>
          <small>{creature ? [creature.type, creature.stage].filter(Boolean).join(' · ') : t.kind.toUpperCase()}{t.hidden ? ' · HIDDEN' : ''}</small>
        </div>
        <button type="button" className="run-btn sm" onClick={() => onUpsert({ id: t.id, hidden: !t.hidden })}>{t.hidden ? 'SHOW' : 'HIDE'}</button>
        <button type="button" className="ini-x" aria-label={`Remove ${t.label}`} onClick={() => onRemove(t.id)}>×</button>
      </header>

      <div className="thr-hp">
        <span className="rs-label">{hpMax ? 'HEALTH' : 'NO HEALTH'}</span>
        {hpMax ? (
          <>
            <span className="thr-bar" aria-label={`Health ${hp} of ${hpMax}`}><i style={{ width: `${pct}%` }} /></span>
            <b>{hp}/{hpMax}</b>
            <button type="button" className="run-btn sm danger" onClick={() => setHp(hp - 1)} disabled={hp <= 0}>−1</button>
            <button type="button" className="run-btn sm danger" onClick={() => setHp(hp - 2)} disabled={hp <= 0}>−2</button>
            <button type="button" className="run-btn sm" onClick={() => setHp(hp + 1)} disabled={hp >= hpMax}>+1</button>
          </>
        ) : (
          <button type="button" className="run-btn sm" onClick={() => {
            const v = Number(prompt('Health for this threat?', '4'));
            if (v > 0) onUpsert({ id: t.id, hpMax: v, hp: v });
          }}>SET HEALTH</button>
        )}
      </div>

      {creature && (
        <p className="thr-stats">
          {stats.armor != null && <span>ARMOR <b>{stats.armor}</b>{stats.armorVsFire != null ? ` (${stats.armorVsFire} vs fire)` : ''}</span>}
          {stats.speed != null && <span>SPEED <b>{stats.speed}</b></span>}
          {stats.threat != null && <span>THREAT <b>{stats.threat}</b></span>}
          {stats.skills && Object.entries(stats.skills).map(([k, v]) => <span key={k}>{k.toUpperCase()} <b>{v}</b></span>)}
          {stats.test && <span>TEST <b>{stats.test}</b></span>}
        </p>
      )}

      <div className="thr-status" role="group" aria-label="Status">
        {STATUS_KEYS.map((k) => {
          const on = statuses.some((s) => s.key === k);
          return (
            <button key={k} type="button" className={`thr-st${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle(k)}
              style={{ '--st': STATUS_DEFS[k]?.color || '#ccc' }}>{STATUS_DEFS[k]?.label || k.toUpperCase()}</button>
          );
        })}
      </div>

      {sigs.length > 0 && (
        <div className="thr-sig">
          <div className="run-row">
            <button type="button" className="run-btn sm primary" onClick={() => rollSignature(true)}>ROLL ATTACK (SECRET)</button>
            <button type="button" className="run-btn sm" onClick={() => rollSignature(false)}>SIGNATURE D{die}</button>
          </div>
          {sig && (
            <div className="thr-sig-result" role="status">
              <b>D{die} {sig.roll} → {sig.entry?.name || '—'}</b>
              {sig.pool && <span className="thr-pool">[{sig.pool.dice.join(' ')}] {sig.pool.successes} SUCCESS{sig.pool.successes === 1 ? '' : 'ES'}</span>}
              <p>{sig.entry?.text}</p>
            </div>
          )}
          <details className="thr-sig-table">
            <summary>SIGNATURE ATTACKS</summary>
            <ol>{sigs.map((s) => <li key={s.roll}><b>{s.roll}</b> {s.name} — {s.text}</li>)}</ol>
          </details>
        </div>
      )}
      {creature?.special && <p className="thr-note">{creature.special}</p>}
    </article>
  );
}

export default function ThreatsPanel() {
  const { board, boardUpsertToken, boardRemoveToken, gmRoll, boardSync } = useGame();
  useEffect(() => { if (!board) boardSync(); }, [board, boardSync]);
  const { universe } = useUniverse();
  const catalog = getCatalog(universe);
  const creatures = catalog.creatures || [];
  const byId = useMemo(() => Object.fromEntries(creatures.map((c) => [c.id, c])), [creatures]);
  const [pick, setPick] = useState('');
  const threats = Object.values(board?.tokens || {}).filter((t) => t.kind === 'creature' || t.kind === 'npc');

  const addFromCatalog = () => {
    const c = byId[pick];
    if (!c) return;
    const { hpMax } = creatureStats(c);
    const n = threats.filter((t) => t.ref === c.id).length;
    boardUpsertToken({
      id: tokId(), kind: 'creature', label: `${c.name}${n ? ` ${n + 1}` : ''}`.slice(0, 60), ref: c.id,
      icon: c.art || null, ...(hpMax ? { hp: hpMax, hpMax } : {}), x: 0.5, y: 0.5, hidden: true,
    });
    setPick('');
  };

  return (
    <div className="thr">
      <div className="thr-add">
        <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Creature from catalog">
          <option value="">ADD FROM CATALOG…</option>
          {creatures.map((c) => <option key={c.id} value={c.id}>{c.name}{c.stage ? ` (${c.stage})` : ''}</option>)}
        </select>
        <button type="button" className="run-btn sm primary" disabled={!pick || !board} onClick={addFromCatalog}>ADD (HIDDEN)</button>
      </div>
      {!board && <p className="run-empty">Open the board (BOARD tab) to place threats.</p>}
      {board && threats.length === 0 && <p className="run-empty">No creatures or NPCs on the board. Add one from the catalog or the BOARD palette.</p>}
      {threats.map((t) => (
        <ThreatCard key={t.id} t={t} creature={t.ref ? byId[t.ref] : creatures.find((c) => c.name === t.label)}
          onUpsert={(patch) => boardUpsertToken(patch)} onRemove={(id) => { if (confirm('Remove this token from the board?')) boardRemoveToken(id); }}
          onSecretRoll={(roll, who) => gmRoll(roll, who)} />
      ))}
    </div>
  );
}
