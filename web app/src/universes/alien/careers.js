/* ALIEN RPG careers and the gear pick-list used by the character creator. */

export const careers = [
  { name: 'Colonial Marine', keyAttribute: 'str', keySkills: ['closeCombat', 'rangedCombat', 'stamina', 'mobility'],
    talents: ['Overkill — Spend extra successes for +2 damage (instead of +1).', 'Banter — After a successful COMMAND roll, reduce Stress by 1 for a nearby ally.', 'Nerves of Steel — Reduce Stress by 2 when using Signature Item.'] },
  { name: 'Colonial Marshal', keyAttribute: 'wit', keySkills: ['rangedCombat', 'observation', 'manipulation', 'survival'],
    talents: ['Investigator — +2 to OBSERVATION when looking for clues.', 'Authority — Re-roll failed COMMAND roll once per session.', 'Take Control — You act first in initiative, once per Act.'] },
  { name: 'Company Agent', keyAttribute: 'wit', keySkills: ['comtech', 'manipulation', 'observation', 'command'],
    talents: ['Corporate Secrets — Access classified Company data terminals.', 'Cunning — +2 to MANIPULATION for deception.', 'Inside Man — You always have a hidden agenda the other PCs don\'t know about.'] },
  { name: 'Kid', keyAttribute: 'agi', keySkills: ['mobility', 'observation', 'survival'],
    talents: ['Small Target — Enemies get −2 to hit you in ranged combat.', 'Hide — +2 to MOBILITY when hiding.', 'Lucky — Re-roll one die per session (Stress Dice included).'] },
  { name: 'Medic', keyAttribute: 'emp', keySkills: ['medicalAid', 'observation', 'stamina', 'manipulation'],
    talents: ['Field Surgeon — Heal an extra point of damage on successful MEDICAL AID.', 'Compassion — When you comfort someone, reduce their Stress by 2.', 'Resilient — Reduce incoming damage by 1 (once per Round).'] },
  { name: 'Officer', keyAttribute: 'emp', keySkills: ['command', 'manipulation', 'rangedCombat', 'observation'],
    talents: ['Field Commander — COMMAND gives +2 (instead of +1).', 'Influence — +2 MANIPULATION against subordinates.', 'Pull Rank — Override one decision per session without a roll.'] },
  { name: 'Pilot', keyAttribute: 'agi', keySkills: ['piloting', 'rangedCombat', 'comtech', 'mobility'],
    talents: ['Like a Glove — Re-roll failed PILOTING roll once per session.', 'Reckless — +2 PILOTING in dangerous maneuvers.', 'Full Throttle — Your vehicle speed increases by 1 in chases.'] },
  { name: 'Roughneck', keyAttribute: 'str', keySkills: ['heavyMachinery', 'stamina', 'closeCombat', 'survival'],
    talents: ['True Grit — Reduce Stress by 1 after successfully using STAMINA.', 'Heavy Lifter — +2 HEAVY MACHINERY.', 'Tough — Reduce one Critical Injury severity by 1 (once per session).'] },
  { name: 'Scientist', keyAttribute: 'wit', keySkills: ['comtech', 'observation', 'survival', 'medicalAid'],
    talents: ['Analysis — +2 to COMTECH for research and analysis.', 'Breakthrough — Automatically succeed on one OBSERVATION/COMTECH roll per session.', 'Inquisitive — Ask the GM one yes/no question per Act that must be answered truthfully.'] },
];

export const gear = [
  'M4A3 Service Pistol', '.357 Magnum Revolver', 'Rexim RXF-M5 EVA Pistol', 'Watatsumi DV-303 Bolt Gun',
  'Armat M41A Pulse Rifle', 'M42A Scope Rifle', 'Armat Model 37A2 Shotgun', 'AK-4047 Pulse Assault Rifle',
  'M240 Incinerator Unit', 'M56A2 Smart Gun', 'Armat U1 Grenade Launcher', 'G2 Electroshock Grenade',
  'Knife', 'Stun Baton', 'Cutting Torch',
  'M3 Personnel Armor', 'IRC Mk.50 Compression Suit', 'IRC Mk.35 Pressure Suit', 'Weyland-Yutani APEsuit',
  'Personal Terminal', 'Motion Tracker', 'Medkit', 'Tool Kit', 'Comm Unit',
  'Duct Tape', 'Flashlight', 'Binoculars', 'Respirator Mask', 'Emergency Flares',
  'MRE Rations', 'Water Canteen', 'First Aid Kit', 'Samani E-Series Watch',
];
