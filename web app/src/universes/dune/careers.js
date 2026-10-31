/* DUNE Archetypes (the engine calls them careers) and the gear pick-list used
   by the character creator. keyAttribute is a drive key; keySkills are skill
   keys. All talent text is original. */

export const careers = [
  { name: 'Mentat', keyAttribute: 'truth', keySkills: ['understand', 'discipline'],
    talents: [
      'Projection Engine — Once per scene, state a conclusion about a person or plan. If the Narrator confirms it, gain 2 Momentum; if not, the Narrator gains 1 Threat.',
      'Data Without Context — After an hour with records, ledgers or testimony, reduce the Difficulty of your next UNDERSTAND test about them by 1.',
      'Cold Tally — In a conflict you did not start, ignore the first point of Stress you would suffer each scene.',
    ] },
  { name: 'Bene Gesserit', keyAttribute: 'faith', keySkills: ['discipline', 'communicate'],
    talents: [
      'The Voice — Spend 2 Momentum after a successful COMMUNICATE test to compel one simple, immediate action from a listener untrained against it.',
      'Prana-Bindu Calm — When you resist fear, pain or poison, re-roll one d20 on the DISCIPLINE test.',
      'Truthsense — When someone lies to you face to face, the Narrator must tell you a lie was spoken (but not which part).',
    ] },
  { name: 'Swordmaster', keyAttribute: 'duty', keySkills: ['battle', 'move'],
    talents: [
      'The Slow Blade — Against a shielded foe, the first complication on your BATTLE test is ignored.',
      'Guardian’s Step — When an ally within reach is attacked, spend 1 Momentum to take the attack yourself.',
      'Read the Feint — In a duel, after your opponent rolls, spend 1 Momentum to force them to re-roll their best die.',
    ] },
  { name: 'Noble Scion', keyAttribute: 'power', keySkills: ['communicate', 'understand'],
    talents: [
      'Name and Seal — Once per session, invoke your House to open a door, an audience or a ledger that would otherwise stay shut.',
      'Courtly Poise — In an intrigue conflict, your first COMMUNICATE test each scene gains one bonus d20 at no cost.',
      'Heir’s Burden — When you take Stress protecting your House’s honor, gain 1 Momentum.',
    ] },
  { name: 'Fremen Guide', keyAttribute: 'faith', keySkills: ['move', 'battle'],
    talents: [
      'Walk Without Rhythm — On open sand, reduce the Difficulty of MOVE tests to avoid drawing a worm by 1.',
      'Water Discipline — You and anyone you lead ignore the dehydrated condition for one extra day.',
      'Desert Power — When you fight on ground you chose, spend 1 Momentum to inflict 2 extra Stress.',
    ] },
  { name: 'Suk Doctor', keyAttribute: 'duty', keySkills: ['understand', 'discipline'],
    talents: [
      'Imperial Conditioning — Any attempt to compel you to harm a patient automatically fails.',
      'Field Surgery — After a scene, remove 2 Stress from an ally you treat, or clear WOUNDED with an UNDERSTAND test (Difficulty 2).',
      'Diagnose Poison — Name the poison in any victim you examine; the Narrator also tells you the likeliest way it was given.',
    ] },
  { name: 'Spy/Agent', keyAttribute: 'truth', keySkills: ['move', 'communicate'],
    talents: [
      'Cover Identity — Once per adventure, reveal a prepared false identity that fits where you are; it is accepted without a test.',
      'Dead Drop — Spend 1 Momentum to have already hidden a small item (blade, message, vial) where you now stand.',
      'Shadow’s Patience — After watching a full scene without acting, the Narrator reveals one hidden agenda of someone present.',
    ] },
  { name: 'Smuggler', keyAttribute: 'power', keySkills: ['move', 'communicate'],
    talents: [
      'A Price for Everything — Reduce the Difficulty of bribes, haggling and favor-trading by 1.',
      'Blind Routes — You know an unpatrolled way in or out of any settlement on Arrakis; using it costs time, not tests.',
      'Cut and Run — When a scene turns violent, spend 1 Momentum to leave before anyone can act against you.',
    ] },
  { name: 'Planetologist', keyAttribute: 'justice', keySkills: ['understand', 'move'],
    talents: [
      'Reading the Land — Spend 1 Momentum to predict a sandstorm, spice blow or worm sign one scene before it happens.',
      'Ecological Mind — UNDERSTAND tests about water, plants, weather and the spice cycle gain one bonus d20 at no cost.',
      'Friend of the Sietch — Fremen treat you as a guest rather than a stranger until you give them cause otherwise.',
    ] },
  { name: 'Guild Envoy', keyAttribute: 'power', keySkills: ['communicate', 'understand'],
    talents: [
      'The Guild Remembers — Once per session, call in a favor of passage, transport or silence that no House may openly refuse.',
      'Prescient Hedge — Before rolling, spend 2 Momentum to declare one die a success whatever it shows.',
      'Neutral Ground — While you speak for the Guild, anyone starting a physical conflict in your presence must first pay 2 Threat.',
    ] },
];

/* Common carried items, spelled exactly as catalog item names so they resolve on the sheet. */
export const gear = [
  'Crysknife', 'Kindjal', 'Dueling Rapier', 'Slip-Tip', 'Maula Pistol', 'Lasgun Pistol', 'Stunner',
  'Personal Shield Belt', 'Stillsuit', 'Fremkit', 'Paracompass', 'Thumper', 'Maker Hooks',
  'Distrans', 'Literjon', 'Water Rings', 'Spice Melange', 'Spice Coffee Service',
  'Poison Snooper', 'Hunter-Seeker', 'Antidote Kit', 'Sapho Juice',
  'Suk Medical Kit', 'Filmbook', 'Ornithopter Access', 'Glowglobe',
  'House Signet Ring', 'Forged Travel Papers', 'Solari Purse', 'Krimskell Fiber Rope',
  'Oil-Lens Binoculars', 'Desert Cloak', 'Stilltent',
];
