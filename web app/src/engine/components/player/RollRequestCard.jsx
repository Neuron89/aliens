import React, { useEffect, useRef } from 'react';
import { useGame } from '../../GameContext';
import { useUniverse } from '../../UniverseContext';
import { skillPool } from '../../catalogUtils';
import './rollRequest.css';

/* ═══════════════════════════════════════════════════════════════
   ROLL NOW card (phone): the GM's open roll requests for this seat
   (`table.rollRequests`, docs/BOARD_AND_BUILDER.md §2 "Table actions").
   The newest request is shown as a card under the quick actions; ROLL
   opens the universe roller prefilled with that skill (the sheet's own
   pool: attribute/drive + skill + gear) plus the GM's modifier (ALIEN:
   dice +/−) or difficulty (DUNE). The preset carries `requestId`; the
   rollers copy it onto the result, so `sendRoll` answers the request
   and the card closes. A fresh request (roll-requested) plays the
   orders cue. Props: onRoll(preset), play(cue).
   ═══════════════════════════════════════════════════════════════ */

/** Roller preset for a request (exported for tests / reuse). */
export function requestPreset(request, character, universe, stress = 0) {
  const rules = universe?.rules || {};
  const skillDef = (rules.skills || []).find((s) => s.key === request.skill) || null;
  const label = String(request.label || skillDef?.label || request.skill).toUpperCase();
  const preset = { label, skillKey: request.skill, requestId: request.id, stress: Number(stress) || 0, at: request.at || Date.now() };
  const d = request.difficulty;
  if (character && skillDef) {
    const pool = skillPool(character, request.skill, universe);
    Object.assign(preset, { attrKey: pool.attrKey, kind: pool.kind, attr: pool.attr, skill: pool.skill, bonus: pool.bonus, total: pool.total });
    if (pool.kind !== '2d20' && Number.isInteger(d) && d !== 0) {
      // YZE: the GM's modifier adds or removes base dice (never below 1 die)
      preset.bonus = (pool.bonus || 0) + d;
      preset.total = Math.max(1, (pool.total || 0) + d);
    }
  }
  if ((rules.dice?.kind === '2d20') && Number.isInteger(d)) preset.difficulty = Math.max(0, d);
  return preset;
}

export function difficultyText(request, universe) {
  const d = request.difficulty;
  if (!Number.isInteger(d)) return null;
  if (universe?.rules?.dice?.kind === '2d20') return `DIFFICULTY ${Math.max(0, d)}`;
  return d === 0 ? null : `${d > 0 ? '+' : '−'}${Math.abs(d)} ${Math.abs(d) === 1 ? 'DIE' : 'DICE'}`;
}

export default function RollRequestCard({ onRoll, play, hidden = false }) {
  const { table, myPlayer, on } = useGame();
  const { universe } = useUniverse();
  const { terms } = universe;
  const requests = table?.rollRequests || [];
  const seen = useRef(null);

  // Cue once per newly arrived request (not for the ones restored on reconnect).
  useEffect(() => on('roll-requested', ({ request } = {}) => {
    if (!request?.id) return;
    if (!seen.current) seen.current = new Set();
    if (seen.current.has(request.id)) return;
    seen.current.add(request.id);
    play?.('orders');
  }), [on, play]);

  if (hidden || !requests.length || !myPlayer?.character || myPlayer.alive === false) return null;
  const req = requests[requests.length - 1];
  const more = requests.length - 1;
  const diff = difficultyText(req, universe);
  const GM = String(terms.gmShort || terms.gm).toUpperCase();
  const label = String(req.label || req.skill).toUpperCase();
  return (
    <section className="rr-card" role="alert" aria-live="assertive" aria-label={`${GM} asks for a ${label} roll`}>
      <div className="rr-head">
        <span className="rr-k">ROLL NOW · {GM}</span>
        {more > 0 && <span className="rr-more">+{more} MORE</span>}
      </div>
      <div className="rr-body">
        <div className="rr-text">
          <b className="rr-skill">{label}</b>
          {diff && <span className="rr-diff">{diff}</span>}
          {req.note && <p className="rr-note">{req.note}</p>}
        </div>
        <button type="button" className="rr-btn" onClick={() => onRoll(requestPreset(req, myPlayer.character, universe, myPlayer.tracks?.stress))}>
          ROLL
        </button>
      </div>
    </section>
  );
}
