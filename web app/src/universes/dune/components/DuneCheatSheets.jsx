import React from 'react';
import { rules } from '../rules.js';

/* Narrator / player quick reference for the 2d20 rules, in our own words. */

export default function DuneCheatSheets() {
  const attrLabel = (k) => rules.attributes.find((a) => a.key === k)?.label || k;
  return (
    <div>
      <div className="panel">
        <h2>MAKING A TEST</h2>
        <table className="cheat">
          <tbody>
            <tr><th>1. Frame</th><td>The Narrator names the skill and a Difficulty 0–5. The player picks the drive whose statement fits why they act — and must be able to justify it.</td></tr>
            <tr><th>2. Target</th><td>Target number = drive + skill (typically 8–16).</td></tr>
            <tr><th>3. Dice</th><td>Roll 2d20. Buy up to 3 more (5 max): 1st costs 1, 2nd costs 2, 3rd costs 3 — paid from Momentum, or by giving the Narrator the same amount of Threat.</td></tr>
            <tr><th>4. Count</th><td>Each die ≤ target = 1 success. A natural 1 = 2 successes. With a relevant focus, any die ≤ the skill rating = 2 successes.</td></tr>
            <tr><th>5. Result</th><td>Successes ≥ Difficulty: pass. Each surplus success = 1 Momentum. Each 20 (or wider range when hampered) = a complication.</td></tr>
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>DIFFICULTY</h2>
        <table className="cheat">
          <tbody>
            <tr><th>D0 Simple</th><td>No roll needed; roll anyway to generate Momentum.</td><th>D3 Daunting</th><td>Experts struggle.</td></tr>
            <tr><th>D1 Average</th><td>The default for anything risky.</td><th>D4 Dire</th><td>Needs help and Momentum.</td></tr>
            <tr><th>D2 Challenging</th><td>Pressure, haste or opposition.</td><th>D5 Epic</th><td>Legends are made here.</td></tr>
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>MOMENTUM (PLAYERS' POOL, MAX 6)</h2>
        <table className="cheat">
          <tbody>
            <tr><th>Buy dice</th><td>1 / 2 / 3 for the 1st / 2nd / 3rd bonus d20.</td></tr>
            <tr><th>Obtain info</th><td>1 per question about the scene, person or situation, answered truthfully.</td></tr>
            <tr><th>Create trait</th><td>2: establish a useful fact ("the guard owes me a favor").</td></tr>
            <tr><th>Add Stress</th><td>1 per extra point of Stress inflicted in a conflict.</td></tr>
            <tr><th>Keep the initiative</th><td>2: another agent acts next instead of the opposition.</td></tr>
            <tr><th>Saving</th><td>Unspent Momentum goes to the pool (max 6); the pool loses 1 at the end of each scene.</td></tr>
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>THREAT (NARRATOR'S POOL)</h2>
        <table className="cheat">
          <tbody>
            <tr><th>Gains</th><td>Starts each session at 2 per player. Grows by the price of every bonus die players buy with Threat (1 / 2 / 3), +2 per complication the Narrator converts, and +1 when agents act openly against a powerful faction.</td></tr>
            <tr><th>Spends</th><td>Bonus dice for adversaries (1 / 2 / 3); +1 Difficulty (2); a complication or environmental effect (2); change a trait (2); keep the initiative (2); reinforcements (each threat lists its cost); a rival House acts offscreen (1).</td></tr>
            <tr><th>Rule of thumb</th><td>The pool stays off the players' screens unless you reveal it, so announce spends out loud: players should feel the pressure even when they cannot see the number.</td></tr>
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>CONFLICTS</h2>
        <table className="cheat">
          <tbody>
            <tr><th>Duel</th><td>One-on-one, personal. BATTLE vs BATTLE; each success over the defender's adds Stress. Under the forms, the duel ends when one yields or falls. Shields punish fast blades: complications become shield-stops.</td></tr>
            <tr><th>Skirmish</th><td>Small groups, zones and cover. Each side acts in turn; positioning (MOVE) earns Momentum for the next blow. Defeated characters are taken out, captured or left for the desert.</td></tr>
            <tr><th>Espionage</th><td>Assets (agents, bribes, forged papers) move across zones toward an objective. Each step is a test; failure exposes an asset rather than a character.</td></tr>
            <tr><th>Intrigue</th><td>Social and political. COMMUNICATE or UNDERSTAND attacks reputation and resolve; Stress here is shame, doubt and lost standing. Ends in a concession, an alliance, or a public disgrace.</td></tr>
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>STRESS & DEFEAT</h2>
        <ul className="plain">
          <li>Stress track 0–{rules.tracks[0].max}. At {rules.tracks[0].max} the character is defeated in that conflict: they choose to concede (on their terms) or are taken out (on the Narrator's).</li>
          <li>Conceding before the track fills lets the player name a lesser consequence — a status such as WOUNDED, DISGRACED or INDEBTED.</li>
          <li>Recovery: a scene of rest clears all Stress; a Suk doctor (or the Field Surgery talent) clears 2 at once, mid-scene.</li>
        </ul>
      </div>

      <div className="panel">
        <h2>WATER DISCIPLINE</h2>
        <table className="cheat">
          <tbody>
            <tr><th>Stillsuit</th><td>Sealed and fitted, a person loses a thimble a day. Unsealed in deep desert: DISCIPLINE (D1) each day or gain <em>dehydrated</em>.</td></tr>
            <tr><th>Dehydrated</th><td>+1 Difficulty to all physical tests; 1 Stress per day until watered.</td></tr>
            <tr><th>Exposed</th><td>Caught in sun or storm without shelter: 2 Stress per hour.</td></tr>
            <tr><th>Spice withdrawal</th><td>Once addicted, a day without melange: +1 Difficulty to DISCIPLINE and UNDERSTAND.</td></tr>
            <tr><th>Etiquette</th><td>Spitting before a Fremen honors him with your water. Wasting it shames you. The water of the dead belongs to the tribe.</td></tr>
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>SKILLS (SUGGESTED DRIVE)</h2>
        <table className="cheat">
          <tbody>
            {rules.skills.map((s) => (
              <tr key={s.key}><td>{s.label}</td><th>{attrLabel(s.suggestedAttr)}</th></tr>
            ))}
          </tbody>
        </table>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
          Any drive can pair with any skill. The suggestion is only the most common pairing.
        </p>
      </div>
    </div>
  );
}
