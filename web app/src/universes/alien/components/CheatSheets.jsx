import React from 'react';

export default function CheatSheets() {
  return (
    <div>
      <div className="panel">
        <h2>DICE &amp; SUCCESS</h2>
        <table className="cheat">
          <tbody>
            <tr><th>Pool</th><td>Base Dice = Attribute + Skill level. Add Stress Dice = current Stress Level.</td></tr>
            <tr><th>Success</th><td>At least one <strong>6</strong> on any die. Extra 6s = stunts (e.g. +1 damage, pin, disarm).</td></tr>
            <tr><th>Push</th><td>Re-roll all non-6s once. +1 Stress Level. If any Stress Die shows <strong>1</strong>, no push — make Panic Roll instead.</td></tr>
            <tr><th>Stress Die 1</th><td>Panic Roll required; skill roll fails regardless of 6s. On weapon fire with limited ammo: magazine emptied.</td></tr>
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>DIFFICULTY (MODIFICATION TO BASE DICE)</h2>
        <table className="cheat">
          <tbody>
            <tr><th>Trivial</th><td className="modifier">+3</td><th>Demanding</th><td className="modifier">−1</td></tr>
            <tr><th>Simple</th><td className="modifier">+2</td><th>Hard</th><td className="modifier">−2</td></tr>
            <tr><th>Easy</th><td className="modifier">+1</td><th>Formidable</th><td className="modifier">−3</td></tr>
            <tr><th>Average</th><td>0</td><td></td><td></td></tr>
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>PANIC ROLL (D6 + STRESS LEVEL)</h2>
        <table className="cheat">
          <tbody>
            <tr><th>1–6</th><td className="effect-mild">Keeping it together. Barely.</td></tr>
            <tr><th>7</th><td>Nervous twitch. +1 Stress (you and friendlies in SHORT range).</td></tr>
            <tr><th>8</th><td>Tremble. All AGILITY rolls −2 until panic stops.</td></tr>
            <tr><th>9</th><td>Drop item (weapon or important item). +1 Stress.</td></tr>
            <tr><th>10</th><td>Freeze. Lose next slow action. +1 Stress (you and friendlies SHORT).</td></tr>
            <tr><th>11</th><td>Seek cover. Next action: move to safety. −1 Stress (you), +1 (friendlies SHORT).</td></tr>
            <tr><th>12</th><td>Scream 1 Round. −1 Stress (you). Each friendly who hears: immediate Panic Roll.</td></tr>
            <tr><th>13</th><td className="effect-severe">Flee. Must flee to safe place; refuse to leave. −1 Stress. Friendlies who see you run: Panic Roll.</td></tr>
            <tr><th>14</th><td className="effect-critical">Berserk. Attack nearest person/creature until you or target Broken. Witnesses: Panic Roll.</td></tr>
            <tr><th>15+</th><td className="effect-critical">Catatonic. Collapse, can't talk or move.</td></tr>
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>SKILLS (ATTRIBUTE)</h2>
        <table className="cheat">
          <tbody>
            <tr><td>Heavy Machinery</td><th>Strength</th><td>Observation</td><th>Wits</th></tr>
            <tr><td>Stamina</td><th>Strength</th><td>Comtech</td><th>Wits</th></tr>
            <tr><td>Close Combat</td><th>Strength</th><td>Survival</td><th>Wits</th></tr>
            <tr><td>Mobility</td><th>Agility</th><td>Manipulation</td><th>Empathy</th></tr>
            <tr><td>Piloting</td><th>Agility</th><td>Medical Aid</td><th>Empathy</th></tr>
            <tr><td>Ranged Combat</td><th>Agility</th><td>Command</td><th>Empathy</th></tr>
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>COMBAT QUICK REF</h2>
        <table className="cheat">
          <tbody>
            <tr><th>Initiative</th><td>Draw cards (or roll). Each character: one fast + one slow action per Round.</td></tr>
            <tr><th>Ranged hit</th><td>Damage = weapon Damage. Each extra 6: +1 damage, or pin, or swap initiative, or drop item, or knock prone.</td></tr>
            <tr><th>Full auto</th><td>+2 modification. +1 Stress. Add Stress Die to roll. Extra 6s can hit secondary targets (SHORT).</td></tr>
            <tr><th>Cover</th><td>Fast action. Shrubbery 2, Furniture 3, Door 4, Inner bulkhead 5, Outer 6, Armored 7+.</td></tr>
            <tr><th>Ammo</th><td>Stress Die 1 when firing = magazine empty + Panic Roll. Reload = slow action.</td></tr>
            <tr><th>Xeno attack</th><td>ENGAGED only. GM rolls D6 on creature's signature attack table.</td></tr>
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>STRESS RELIEF</h2>
        <ul className="plain">
          <li>Rest in safe area: 1 Turn (5–10 min) = −1 Stress. No skill rolls during rest.</li>
          <li>Once per Act (Cinematic) or session (Campaign): interact with signature item = −1 Stress (slow action).</li>
          <li>Some Panic results reduce Stress. Certain drugs can reduce Stress.</li>
        </ul>
      </div>
    </div>
  );
}
