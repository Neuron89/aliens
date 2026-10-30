/* Great and minor Houses for the Dune reference tab. Original summaries.
   The three minor Houses are invented for this app. */

export const houses = [
  {
    art: '/art/dune/factions/house-atreides.webp',
    id: 'atreides', name: 'House Atreides', rank: 'Great House', seat: 'Caladan',
    colors: 'Green and black; the red hawk',
    summary: 'An ocean-world House whose rule rests on the loyalty it earns rather than the fear it spreads. Its soldiers are few but superbly trained, and its popularity in the Landsraad makes the throne nervous.',
    hooks: ['Will trade honestly, but never forgives a betrayal of guest-right.', 'Its Mentats and swordmasters are prized — and targeted.'],
  },
  {
    art: '/art/dune/factions/house-harkonnen.webp',
    id: 'harkonnen', name: 'House Harkonnen', rank: 'Great House', seat: 'Giedi Prime',
    colors: 'Blue; the griffin',
    summary: 'An industrial House grown fat on Arrakis spice and on cruelty used as a management tool. It rewards informers, keeps assassins on retainer, and measures every vassal by quota.',
    hooks: ['Always has a spy closer than you think.', 'Prefers ruin by ledger and blackmail to open war — until it does not.'],
  },
  {
    art: '/art/dune/factions/house-corrino.webp',
    id: 'corrino', name: 'House Corrino', rank: 'Imperial House', seat: 'Kaitain (Salusa Secundus in secret)',
    colors: 'Scarlet and gold; the golden lion',
    summary: 'The Padishah Emperors. Their power is the Sardaukar and the balance they maintain between the Great Houses; any House that grows too strong is quietly arranged to fall.',
    hooks: ['An Imperial observer at any gathering changes every calculation.', 'The throne rarely acts openly; it lends others the knife.'],
  },
  {
    art: '/art/dune/factions/house-tessarin.webp',
    id: 'tessarin', name: 'House Tessarin', rank: 'Minor House (invented)', seat: 'Qarrat, on the Shield Wall edge of Arrakis',
    colors: 'Ochre and slate; a closed hand holding a drop of water',
    summary: 'A poor House with a spice concession it holds at a greater House’s sufferance. Old blood, thin purse, loyal townsfolk, and a steward who has made arrangements no one has written down.',
    hooks: ['Default home House for player characters.', 'Its water stores are the town’s true treasury.'],
  },
  {
    art: '/art/dune/factions/house-vaszari.webp',
    id: 'vaszari', name: 'House Vaszari', rank: 'Minor House (invented)', seat: 'Orsolo III, a moon of salt flats',
    colors: 'White and indigo; three stacked crescents',
    summary: 'Salt-merchants turned Landsraad voters. They sell their vote dearly and never twice to the same buyer, which makes them everyone’s friend for exactly one season.',
    hooks: ['Will broker a meeting between enemies for a price.', 'Their heir is being courted by three Houses at once.'],
  },
  {
    art: '/art/dune/factions/house-ordrane.webp',
    id: 'ordrane', name: 'House Ordrane', rank: 'Minor House (invented)', seat: 'Hollis Reach, a cold forest world',
    colors: 'Grey and russet; a stag’s skull',
    summary: 'A martial House that trains shield-fighters for hire. Its blades serve whoever pays, under a strict code: a contract is never broken, only outbid in advance.',
    hooks: ['An Ordrane duelist may be on either side of a feud.', 'Owes a blood-debt to House Harkonnen that no one will explain.'],
  },
];

export default houses;
