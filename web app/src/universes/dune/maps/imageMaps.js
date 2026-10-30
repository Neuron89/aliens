/* DUNE image maps: generated top-down illustrations (public/maps/dune/*.webp,
   made by scripts/gen-dune-art.py) with rooms drawn over them in normalized
   0..1 coordinates of the image (docs/BOARD_AND_BUILDER.md §3). */

const rect = (x, y, w, h) => ({ type: 'rect', x, y, w, h });

export const imageMaps = [
  {
    id: 'harvester-crawler',
    title: 'SPICE HARVESTER',
    subtitle: 'Crawler in the deep desert — overhead tactical view',
    scenario: 'General',
    description: 'A tracked spice harvester working a fresh blow. Worm sign is coming; the carryall is late. Use it for heists, rescues and desperate evacuations.',
    kind: 'image',
    src: '/maps/dune/harvester-crawler.webp',
    size: [1536, 1024],
    grid: 1 / 40,
    rooms: [
      { id: 'intake', name: 'Intake Scoops', note: 'Twin sand intakes at the rear. Deafening; anyone here cannot hear warnings.', shape: rect(0.22, 0.15, 0.08, 0.15) },
      { id: 'processing-module', name: 'Processing Module', note: 'Enclosed centrifuge house. Hot, dusty and full of spinning machinery.', shape: rect(0.3, 0.21, 0.14, 0.19) },
      { id: 'boarding-ladder', name: 'Boarding Ladder', note: 'Side ladder and crew hatch. The only quick way on or off when the worm comes.', shape: rect(0.38, 0.5, 0.07, 0.11) },
      { id: 'processing-deck', name: 'Processing Deck', note: 'Open deck of pipes and separators along the spine. Cover everywhere, footing nowhere.', shape: rect(0.45, 0.34, 0.23, 0.28) },
      { id: 'hopper', name: 'Spice Hopper', note: 'Open hatches over the refined spice: the prize, and what the carryall will try to lift first.', shape: rect(0.69, 0.49, 0.08, 0.1) },
      { id: 'cockpit', name: 'Cockpit', note: 'Forward cab: driver, spotter, worm-sign scanner and the carryall radio.', shape: rect(0.69, 0.62, 0.09, 0.14) },
      { id: 'dunes-north', name: 'Dunes (North)', note: 'Open sand toward the spice blow. Every step without rhythm draws the worm sooner.', shape: rect(0.5, 0, 0.5, 0.32) },
      { id: 'dunes-west', name: 'Dunes (West)', note: 'The crawler’s own tracks lead back west; soft sand, slow going.', shape: rect(0, 0, 0.2, 0.62) },
      { id: 'dunes-east', name: 'Dunes (East)', note: 'Where the worm sign is coming from. The sand here trembles first.', shape: rect(0.82, 0.34, 0.18, 0.66) },
      { id: 'dunes-south', name: 'Dunes (South)', note: 'Low dunes and a rock outcrop half a kilometre off — the only safe ground.', shape: rect(0, 0.66, 0.45, 0.34) },
    ],
    spawn: { pc: [0.33, 0.62] },
  },
  {
    id: 'carthag-market',
    title: 'CARTHAG LOWER MARKET',
    subtitle: 'Harkonnen city — market district, overhead tactical view',
    scenario: 'General',
    description: 'Crowded lanes, awning-covered stalls and a metered fountain plaza in the lower city. Good for chases, contacts, assassinations and smuggled goods.',
    kind: 'image',
    src: '/maps/dune/carthag-market.webp',
    size: [1536, 1024],
    grid: 1 / 40,
    rooms: [
      { id: 'fountain-plaza', name: 'Fountain Plaza', note: 'A metered fountain and a water-seller’s booth. Everyone passes through; watchers like the rooftops around it.', shape: rect(0.4, 0.38, 0.24, 0.26) },
      { id: 'west-stalls', name: 'West Stalls', note: 'Cloth, stillsuit patches and secondhand gear under pale awnings. Pickpockets work here.', shape: rect(0.17, 0.24, 0.22, 0.34) },
      { id: 'north-stalls', name: 'North Stalls', note: 'Food, spice coffee and water-rings. The smuggler contact keeps a stall here.', shape: rect(0.38, 0.1, 0.3, 0.27) },
      { id: 'east-stalls', name: 'East Stalls', note: 'Money-changers and a Guild notice board under dark awnings.', shape: rect(0.62, 0.42, 0.26, 0.2) },
      { id: 'south-stalls', name: 'South Stalls', note: 'The busiest row: tents, crates and barrels. Easy to lose a tail — or be ambushed.', shape: rect(0.42, 0.64, 0.32, 0.36) },
      { id: 'west-houses', name: 'West Houses', note: 'Flat-roofed tenements; the roofs connect for anyone willing to jump.', shape: rect(0, 0.58, 0.4, 0.42) },
      { id: 'northwest-houses', name: 'Northwest Houses', note: 'A domed shrine and shuttered homes. Quiet — too quiet for a market day.', shape: rect(0, 0, 0.17, 0.58) },
      { id: 'east-rooftops', name: 'East Rooftops', note: 'Garrison quarter roofs with a rooftop cistern. Harkonnen spotters every half hour.', shape: rect(0.72, 0, 0.28, 0.42) },
    ],
    spawn: { pc: [0.55, 0.9] },
  },
];

export default imageMaps;
