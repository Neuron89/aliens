import React from 'react';

export default function Xenomorphs() {
  return (
    <div>
      <div className="panel">
        <h2>XENOMORPH COMBAT RULES</h2>
        <ul className="plain">
          <li><strong>Speed:</strong> Acts once per point of Speed per Round (draw that many initiative cards). Each time: one fast + one slow action.</li>
          <li><strong>Signature attacks:</strong> ENGAGED only. Roll D6 on creature's table; resolve effect.</li>
          <li><strong>Health 0:</strong> Not Broken like humans. Roll D6 on Xenomorph critical table (Rise Again / Wounded / Desperate / Last Breath / Torn Apart).</li>
          <li><strong>Armor:</strong> Most have natural Armor Rating (often lower vs fire).</li>
          <li><strong>Acid splash (XX121):</strong> When wounded (drawing blood), everyone ENGAGED: attack = Acid Splash rating + damage taken (Base Dice, Damage 1). Fire doesn't cause splash.</li>
        </ul>
      </div>

      <div className="panel">
        <h2>NEOMORPH — BLOODBURSTER</h2>
        <div className="creature-card">
          <div className="creature-stats">
            <span>SPEED 3</span><span>HEALTH 2</span><span>ARMOR 3 (0 vs fire)</span>
            <span>Mobility 9</span><span>Observation 6</span>
          </div>
          <p><strong>Signature (D6):</strong> 1–3 Escape (flee 2 zones, stealth); 4 Terrifying hiss (Panic Roll); 5 Leg bite 6 Base Dice Dmg 2 + crit #53 + Panic; 6 Throat bite 8 Base Dice Dmg 1 + crit #61 + Panic.</p>
        </div>
      </div>

      <div className="panel">
        <h2>NEOMORPH — JUVENILE (NEOPHYTE)</h2>
        <div className="creature-card">
          <div className="creature-stats">
            <span>SPEED 3</span><span>HEALTH 4</span><span>ARMOR 4 (2 vs fire)</span>
            <span>Mobility 10</span><span>Observation 6</span>
          </div>
          <p><strong>Special:</strong> Sprint (slow action = 2 zones or into ENGAGED).</p>
        </div>
      </div>

      <div className="panel">
        <h2>NEOMORPH — ADULT</h2>
        <div className="creature-card">
          <div className="creature-stats">
            <span>SPEED 2</span><span>HEALTH 6</span><span>ARMOR 6 (3 vs fire)</span>
            <span>Mobility 9</span><span>Observation 8</span>
          </div>
          <p><strong>Signature (D6):</strong> 1 Hiss + Panic; 2 Tail slash 10 Base Dice Dmg 2 AP; 3 Deadly grab 8 Dmg 1, drag, prone + Panic; 4 Leaping attack 8 Dmg 1 + extra 10 Dmg 2; 5 Throat bite 8 Dmg 1 + crit #61; 6 Tail spike 7 Dmg 1 AP + crit #66 (kill).</p>
          <p><strong>Special:</strong> Sprint. Short lifespan (~24 h).</p>
        </div>
      </div>

      <div className="panel">
        <h2>XENOMORPH XX121 — STALKER / SCOUT / DRONE</h2>
        <div className="creature-card">
          <div className="creature-stats">
            <strong>Stalker:</strong> SPEED 2, HEALTH 6, ARMOR 10 (5 vs fire), Acid 8. Mobility 8, Obs 6.
          </div>
          <div className="creature-stats">
            <strong>Scout:</strong> SPEED 3, HEALTH 5, ARMOR 8 (4 vs fire), Acid 8. Mobility 8, Obs 10.
          </div>
          <div className="creature-stats">
            <strong>Drone:</strong> SPEED 2, HEALTH 7, ARMOR 8 (4 vs fire), Acid 8. Mobility 10, Obs 8.
          </div>
          <p><strong>Stalker:</strong> Feral Hunger — if attack causes damage, immediate second attack (8 Base Dice, Dmg 1).</p>
          <p><strong>Drone:</strong> Silent Assassin — from same zone, target −2 Observation to detect.</p>
          <p><strong>Signature (D6) — all three:</strong> 1 Hypnotizing gaze +1 Stress + Panic; 2 Playing with prey (no dmg, knock prone, +1 Stress + Panic); 3 Deadly grab 10 Dmg 1, drag, prone + Panic; 4 Ready to kill 10 Dmg, grabbed, Panic all in zone, next turn HEADBITE; 5 Capture for hive 10 Dmg 1, venom: STAMINA roll = Rounds up then unconscious 1 Shift; 6 Headbite 9 Base Dice Dmg 2, crit #64 (death).</p>
        </div>
      </div>

      <div className="panel">
        <h2>XENOMORPH CRITICAL (D6) AT 0 HEALTH</h2>
        <table className="cheat">
          <tbody>
            <tr><th>1</th><td>Rise Again — ruse; if attacked or next initiative: +1 Health, attack.</td></tr>
            <tr><th>2</th><td>Wounded — Speed −1 (min 1), +1 Health. Each Round D6 1–3: try to escape.</td></tr>
            <tr><th>3</th><td>Desperate — instant fast+slow. D6 1–3 escape (half Health); 4–6 attack nearest; no damage = die; damage = +1 Health.</td></tr>
            <tr><th>4</th><td>Last Breath — next initiative: kill nearest, then die. Wounded again = instant death.</td></tr>
            <tr><th>5–6</th><td>Torn apart. Instant death.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
