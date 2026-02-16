export const maps = [
  {
    id: 'uscss-montero',
    title: 'USCSS MONTERO',
    subtitle: 'Lockmart CM-88B Bison-class Tow Vehicle',
    scenario: 'Chariot of the Gods',
    description: 'Commercial towing vessel. Crew complement: 5. Currently hauling refinery module to Anchorpoint Station.',
    ascii: `
    ╔═══════════════════════════════════════════════════════════════╗
    ║                    USCSS MONTERO — DECK PLAN                 ║
    ║                 Lockmart CM-88B Bison M-Class                ║
    ╠═══════════════════════════════════════════════════════════════╣
    ║                                                               ║
    ║   ┌─────────┐                                                 ║
    ║   │ BRIDGE  │    ┌──────────────────────────────┐             ║
    ║   │ [NAV]   ├────┤     MAIN CORRIDOR            │             ║
    ║   │ [COMM]  │    │                              │             ║
    ║   │ [MU/TH] │    │  ┌──────┐  ┌──────┐  ┌────┐│             ║
    ║   └─────────┘    │  │GALLEY│  │MED   │  │ARM ││             ║
    ║                  │  │      │  │BAY   │  │ORY ││             ║
    ║   ┌─────────┐    │  └──────┘  └──────┘  └────┘│             ║
    ║   │ CRYO    │    │                              │             ║
    ║   │ CHAMBER │    │  ┌──────┐  ┌──────┐  ┌────┐│             ║
    ║   │ 5 PODS  ├────┤  │CREW  │  │CREW  │  │STO ││             ║
    ║   └─────────┘    │  │QTR 1 │  │QTR 2 │  │RGE ││             ║
    ║                  │  └──────┘  └──────┘  └────┘│             ║
    ║                  └──────────┬───────────────────┘             ║
    ║                             │                                 ║
    ║                  ┌──────────┴───────────────────┐             ║
    ║                  │       ENGINE ROOM             │             ║
    ║                  │    [REACTOR] [DRIVES]         │             ║
    ║                  │    [MAINTENANCE ACCESS]       │             ║
    ║                  └──────────┬───────────────────┘             ║
    ║                             │                                 ║
    ║                  ┌──────────┴───────────────────┐             ║
    ║                  │       CARGO BAY              │             ║
    ║                  │  [TOW COUPLING — EXTERNAL]   │             ║
    ║                  │  [AIRLOCK — DOCKING PORT]    │             ║
    ║                  └─────────────────────────────┘             ║
    ║                                                               ║
    ╚═══════════════════════════════════════════════════════════════╝`,
    rooms: [
      { name: 'Bridge', description: 'Navigation, communications, and MU/TH/UR mainframe access terminal. Captain\'s chair with command console. Viewports face forward.' },
      { name: 'Cryo Chamber', description: 'Five hypersleep pods. Emergency wake procedure takes 20 minutes. Adjacent to medical for post-cryo checkups.' },
      { name: 'Main Corridor', description: 'Central spine of the ship connecting all modules. Emergency lighting panels. Damage control stations every 10 meters.' },
      { name: 'Galley', description: 'Mess hall and kitchen. Seats 8. Coffee machine that barely works. Bulletin board with crew notices and photos.' },
      { name: 'Med Bay', description: 'Basic medical facility. Autodoc unit, surgical table, pharmaceutical storage. Can handle most traumas short of major surgery.' },
      { name: 'Armory', description: 'Locked weapons locker. Captain\'s authorization required. Contains sidearms, flare guns, and emergency equipment.' },
      { name: 'Crew Quarters', description: 'Two shared bunk rooms. Each houses 2-3 crew. Personal lockers, fold-out desks, privacy curtains.' },
      { name: 'Storage', description: 'General supplies, spare parts, EVA suits, emergency rations. Organized chaos.' },
      { name: 'Engine Room', description: 'Reactor core and drive systems. Noisy, hot, cramped. Rye\'s domain. Maintenance crawlways access the hull.' },
      { name: 'Cargo Bay', description: 'Massive hold for tow coupling operations. Docking port for external connections. The airlock to the Cronus connects here.' },
    ],
  },
  {
    id: 'uscss-cronus',
    title: 'USCSS CRONUS',
    subtitle: 'Weyland-Yutani Science Vessel — Derelict',
    scenario: 'Chariot of the Gods',
    description: 'Science vessel missing for 73 years. Interior compromised by alien biological growth. Systems running on emergency power.',
    ascii: `
    ╔═══════════════════════════════════════════════════════════════╗
    ║               USCSS CRONUS — DECK PLAN (PARTIAL)             ║
    ║              W-Y Science Vessel — Status: DERELICT            ║
    ╠═══════════════════════════════════════════════════════════════╣
    ║                                                               ║
    ║   ┌──────────┐    ┌────────────────┐                         ║
    ║   │ BRIDGE   │    │ SCIENCE LAB    │   ████ = BLOCKED        ║
    ║   │ [DAMAGED]├────┤ [CONTAINMENT]  │   ░░░░ = ORGANIC        ║
    ║   │ ░░░░░░░░ │    │ [SPECIMENS]    │         GROWTH          ║
    ║   └──────────┘    │ ░░░░░░░░░░░░░░ │                         ║
    ║                   └───────┬────────┘                         ║
    ║   ┌──────────┐            │                                   ║
    ║   │ CREW     │    ┌───────┴────────────────────┐             ║
    ║   │ QUARTERS │    │    MAIN CORRIDOR           │             ║
    ║   │ [SEALED] ├────┤    ░░░░░░░░░░░░░░░░        │             ║
    ║   │ ████████ │    │                            │             ║
    ║   └──────────┘    │  ┌────────┐  ┌───────────┐│             ║
    ║                   │  │MEDICAL │  │CRYO BAY   ││             ║
    ║   ┌──────────┐    │  │[WRECKED│  │[PODS OPEN]││             ║
    ║   │ COMMS    │    │  │ ░░░░░░]│  │░░░░░░░░░░ ││             ║
    ║   │ ARRAY    ├────┤  └────────┘  └───────────┘│             ║
    ║   │ [ACTIVE] │    └──────────┬─────────────────┘             ║
    ║   └──────────┘               │                               ║
    ║                   ┌──────────┴─────────────────┐             ║
    ║                   │    LOWER DECK ACCESS        │             ║
    ║                   │    ████████████████████      │             ║
    ║                   │    [SEALED BLAST DOOR]      │             ║
    ║                   └──────────┬─────────────────┘             ║
    ║                              │                               ║
    ║           ┌──────────────────┴──────────────────┐            ║
    ║           │          LOWER DECKS                 │            ║
    ║           │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │            ║
    ║           │  ░░░░ THE NEST — EXTREME HAZARD ░░░░ │            ║
    ║           │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │            ║
    ║           │         [REACTOR ACCESS]             │            ║
    ║           └─────────────────────────────────────┘            ║
    ║                                                               ║
    ╚═══════════════════════════════════════════════════════════════╝`,
    rooms: [
      { name: 'Bridge', description: 'Partially overgrown with organic resin. Emergency power only. Navigation logs may be recoverable from the damaged console. Signs of a violent last stand — bullet holes, acid scoring.' },
      { name: 'Science Lab / Containment', description: 'Primary research area. Containment pods line the walls — most shattered from the inside. Lab equipment scattered. Research data terminals may still function. Heavy organic growth.' },
      { name: 'Crew Quarters', description: 'SEALED. Someone welded the doors shut from the outside. Banging can sometimes be heard from within. Opening this is inadvisable.' },
      { name: 'Main Corridor', description: 'The ship\'s central artery. Organic growth covers 60% of surfaces — dark, ribbed resin that glistens in the emergency lighting. Temperature and humidity are anomalously high.' },
      { name: 'Medical Bay', description: 'Wrecked. Equipment overturned. Old bloodstains. Something happened here — fast and violent. Medical logs on a cracked terminal hint at crew autopsies that revealed impossible results.' },
      { name: 'Cryo Bay', description: 'Hypersleep pods open and empty. Bio-readout screens still cycling. Some pods show signs of forced opening from inside. Residue inside pods is organic and unidentifiable.' },
      { name: 'Comms Array', description: 'Still broadcasting the distress signal on loop. The only fully functional system on the ship. Someone kept it running. The question is: who? And why?' },
      { name: 'Lower Deck Access', description: 'Sealed blast door, heavily reinforced. Warning signs in multiple languages. The crew tried very hard to keep something contained below.' },
      { name: 'Lower Decks — The Nest', description: 'EXTREME HAZARD. The lower decks have been completely transformed into alien architecture — resin walls, cocooned remains, egg clusters. The reactor is somewhere in this nightmare. This is where the creatures live.' },
    ],
  },
  {
    id: 'hadleys-hope',
    title: "HADLEY'S HOPE",
    subtitle: 'Weyland-Yutani Shake \'n\' Bake Colony — LV-426',
    scenario: "Hope's Last Day",
    description: 'Terraforming colony, population 158. Located on Acheron (LV-426). Atmospheric processor operational.',
    ascii: `
    ╔═══════════════════════════════════════════════════════════════╗
    ║              HADLEY'S HOPE — COLONY LAYOUT                   ║
    ║             LV-426 (Acheron) — Pop. 158                      ║
    ╠═══════════════════════════════════════════════════════════════╣
    ║                                                               ║
    ║          [ATMOSPHERIC PROCESSOR]                              ║
    ║           ┌──────────────┐      (2km north)                  ║
    ║           │  ████████████│                                    ║
    ║           │  █ PROCESSOR █                                    ║
    ║           │  █ SUB-LEVEL █──── (underground nest)            ║
    ║           │  ████████████│                                    ║
    ║           └──────┬───────┘                                   ║
    ║                  │ access road                                ║
    ║                  │                                            ║
    ║   ┌──────────────┴──────────────────────────────────┐        ║
    ║   │              COLONY PERIMETER                    │        ║
    ║   │  ┌────────┐  ┌──────────────┐  ┌─────────────┐ │        ║
    ║   │  │LANDING │  │ OPERATIONS   │  │ VEHICLE BAY │ │        ║
    ║   │  │PAD     │  │ CENTER       │  │ [APC]       │ │        ║
    ║   │  │[SHUTTLE│  │ [COMMAND]    │  │ [TRUCKS]    │ │        ║
    ║   │  └────────┘  │ [COMMS]     │  └─────────────┘ │        ║
    ║   │              │ [SENSORS]    │                    │        ║
    ║   │  ┌────────┐  └──────────────┘  ┌─────────────┐ │        ║
    ║   │  │MED BAY │                    │ COMMONS /   │ │        ║
    ║   │  │        │  ┌──────────────┐  │ REC ROOM    │ │        ║
    ║   │  │        │  │ HAB MODULE A │  │ [BAR]       │ │        ║
    ║   │  └────────┘  │ [FAMILIES]   │  │ [POOL TBL]  │ │        ║
    ║   │              └──────────────┘  └─────────────┘ │        ║
    ║   │  ┌────────┐  ┌──────────────┐  ┌─────────────┐ │        ║
    ║   │  │SCHOOL  │  │ HAB MODULE B │  │ HYDRO-      │ │        ║
    ║   │  │MODULE  │  │ [SINGLES]    │  │ PONICS BAY  │ │        ║
    ║   │  └────────┘  └──────────────┘  └─────────────┘ │        ║
    ║   │              ┌──────────────┐                    │        ║
    ║   │              │ MAINTENANCE  │                    │        ║
    ║   │              │ [GENERATORS] │                    │        ║
    ║   │              │ [WATER RCLM] │                    │        ║
    ║   │              └──────────────┘                    │        ║
    ║   └─────────────────────────────────────────────────┘        ║
    ║                                                               ║
    ╚═══════════════════════════════════════════════════════════════╝`,
    rooms: [
      { name: 'Operations Center', description: 'Colony nerve center. Communications, sensor displays, atmospheric processor monitoring. Administrator\'s office adjacent. The place everyone runs to when things go wrong.' },
      { name: 'Landing Pad', description: 'Emergency shuttle pad on the colony\'s west side. Exposed to LV-426\'s brutal storms. The shuttle seats 12 — colony population is 158.' },
      { name: 'Vehicle Bay', description: 'Garage housing the colony\'s APC, survey trucks, and maintenance vehicles. Heavy doors that can be sealed. Clairemont knows every vehicle here.' },
      { name: 'Med Bay', description: 'Colony medical facility. Dr. Patel\'s domain. Surgical suite, recovery beds, pharmaceutical storage. Where the facehugger victim will be brought.' },
      { name: 'Commons / Rec Room', description: 'The social heart of the colony. Bar, pool table, vid screen, bulletin boards. Where colonists gather after shifts. Will become a refugee center when things go bad.' },
      { name: 'Hab Module A', description: 'Family quarters. Small apartments for colonists with children. Thin walls. Connected to the school module.' },
      { name: 'Hab Module B', description: 'Single quarters and shared bunks for unattached workers. Rougher crowd. Closer to the maintenance section.' },
      { name: 'School Module', description: 'Where the colony\'s children are educated. Small, bright, covered in drawings. Newt knows the ventilation access point hidden behind the supply closet.' },
      { name: 'Hydroponics Bay', description: 'Growing facility for supplemental food. Warm, humid, green. One of the few pleasant spaces in the colony. The creatures will love the humidity.' },
      { name: 'Maintenance Section', description: 'Generators, water reclamation, waste processing. The guts of the colony. Noisy, easy to get lost in, full of hiding spots — for colonists and creatures alike.' },
      { name: 'Atmospheric Processor', description: '2km north of the colony. Massive industrial structure. The sub-levels beneath it contain the growing nest. Going here is a death sentence — but it\'s also where the power comes from.' },
    ],
  },
  {
    id: 'fort-nebraska',
    title: 'FORT NEBRASKA',
    subtitle: 'UA Mining Colony & Forward Operating Base — Ariarcus',
    scenario: 'Destroyer of Worlds',
    description: 'Small mining colony repurposed as military FOB during UPP territorial dispute. Mine complex extends deep underground.',
    ascii: `
    ╔═══════════════════════════════════════════════════════════════╗
    ║              FORT NEBRASKA — TACTICAL MAP                    ║
    ║              Ariarcus — Kruger 60 System                     ║
    ╠═══════════════════════════════════════════════════════════════╣
    ║                                                               ║
    ║                 N                                             ║
    ║                 ↑                                             ║
    ║                                                               ║
    ║   .............[MINE ENTRANCE ALPHA]..............            ║
    ║   .            (3km north)                      .            ║
    ║   .    ┌──────────────────────────┐             .            ║
    ║   .    │     MINE COMPLEX         │             .            ║
    ║   .    │  ┌────┐  ┌──────────┐   │             .            ║
    ║   .    │  │UPP │  │ DEEP     │   │             .            ║
    ║   .    │  │LAB │  │ SHAFTS   │   │             .            ║
    ║   .    │  │████│  │ ░░░░░░░░ │   │             .            ║
    ║   .    │  └────┘  │ THE HIVE │   │             .            ║
    ║   .    │          └──────────┘   │             .            ║
    ║   .    └────────────┬────────────┘             .            ║
    ║   .                 │ tunnel                    .            ║
    ║   .                 │                           .            ║
    ║   ..........━━━━━━━━━━━━━━━[PERIMETER]━━━━━━━..            ║
    ║   .         ┌───────┴──────────────┐           .            ║
    ║   .         │    LANDING PAD       │           .            ║
    ║   . ┌────┐  │    [DROPSHIP]        │  ┌─────┐ .            ║
    ║   . │BAR-│  └──────────────────────┘  │MINE │ .            ║
    ║   . │RACK│                            │ADMIN│ .            ║
    ║   . │[WPN│  ┌──────────────────────┐  └─────┘ .            ║
    ║   . │LCKR│  │    OPS CENTER        │           .            ║
    ║   . └────┘  │    [COMMAND]         │  ┌─────┐ .            ║
    ║   .         │    [COMMS]           │  │POWER│ .            ║
    ║   .         └──────────────────────┘  │PLANT│ .            ║
    ║   . ┌────┐  ┌──────────────────────┐  └─────┘ .            ║
    ║   . │MED │  │    COLONY HABITATS   │           .            ║
    ║   . │BAY │  │    [CIVILIANS]       │           .            ║
    ║   . └────┘  └──────────────────────┘           .            ║
    ║   .                                             .            ║
    ║   ..━━━━━━━━━━━━━━━[PERIMETER FENCE]━━━━━━━━━━..            ║
    ║                                                               ║
    ╚═══════════════════════════════════════════════════════════════╝`,
    rooms: [
      { name: 'Landing Pad', description: 'Open platform for the dropship. Exposed to Ariarcus storms. The dropship is your primary extraction vehicle — protect it.' },
      { name: 'Ops Center', description: 'Colony command, repurposed as Marine tactical ops. Communications, sensor feeds, colony admin. The last defensible strong point.' },
      { name: 'Barracks', description: 'Marine quarters with weapon lockers, ammo storage, and equipment. Armored walls. Can be sealed and held as a fallback position.' },
      { name: 'Med Bay', description: 'Colony medical facility. Basic but functional. Doc Holliday has set up a combat triage station here.' },
      { name: 'Colony Habitats', description: 'Civilian housing modules. Miners and their families. 60+ civilians who need protection and evacuation.' },
      { name: 'Power Plant', description: 'Colony power generation. Fusion reactor. If this goes down, the perimeter lights and sensors go dark.' },
      { name: 'Mine Admin', description: 'Mining company offices. Colony records, mine shaft maps, geological surveys. Intel on the underground layout.' },
      { name: 'Perimeter Fence', description: 'Chain-link and razor wire with motion sensors and floodlights. Designed to keep wildlife out. Not designed for what\'s coming.' },
      { name: 'Mine Entrance Alpha', description: '3km north of colony. Primary shaft descending 200+ meters. Multiple side tunnels branch into the mine complex. The creatures emerge from here.' },
      { name: 'UPP Research Lab', description: 'Hidden installation deep in the mine complex. Military-grade bio-containment. Whatever they were studying, it got out. Emergency beacon located here.' },
      { name: 'The Hive', description: 'Deep mine shafts transformed into alien architecture. Resin walls, cocooned victims, egg clusters. The source of the infestation. Going in is near-suicide.' },
    ],
  },
  {
    id: 'station-prometheus',
    title: 'STATION PROMETHEUS',
    subtitle: 'Weyland-Yutani Deep Space Research Station',
    scenario: 'Heart of Darkness',
    description: 'Orbital research station around LV-178. Crew complement: 47 (all MIA). Project Erebus facility.',
    ascii: `
    ╔═══════════════════════════════════════════════════════════════╗
    ║            STATION PROMETHEUS — CROSS SECTION                ║
    ║           Orbiting LV-178 — Zeta II Reticuli                 ║
    ╠═══════════════════════════════════════════════════════════════╣
    ║                                                               ║
    ║                  [DOCKING ARM]                                ║
    ║                       │                                       ║
    ║              ┌────────┴────────┐                              ║
    ║              │   AIRLOCK 7     │                              ║
    ║              │ [DOCKING PORT]  │                              ║
    ║              └────────┬────────┘                              ║
    ║                       │                                       ║
    ║    ╔══════════════════╧══════════════════╗                    ║
    ║    ║          LEVEL 1 — OPS             ║                    ║
    ║    ║  ┌──────┐  ┌────────┐  ┌────────┐ ║                    ║
    ║    ║  │BRIDGE│  │ COMMS  │  │LIFE    │ ║                    ║
    ║    ║  │      │  │        │  │SUPPORT │ ║                    ║
    ║    ║  └──────┘  └────────┘  └────────┘ ║                    ║
    ║    ╠════════════════╤══════════════════╣                    ║
    ║    ║       LEVEL 2 — HABITATION        ║                    ║
    ║    ║  ┌──────┐  ┌────────┐  ┌────────┐ ║                    ║
    ║    ║  │CREW  │  │ MESS   │  │REC     │ ║                    ║
    ║    ║  │QTRS  │  │ HALL   │  │AREA    │ ║                    ║
    ║    ║  └──────┘  └────────┘  └────────┘ ║                    ║
    ║    ╠════════════════╤══════════════════╣                    ║
    ║    ║       LEVEL 3 — MEDICAL/LABS      ║                    ║
    ║    ║  ┌──────┐  ┌────────┐  ┌────────┐ ║                    ║
    ║    ║  │MED   │  │ LABS   │  │SPECIMN │ ║                    ║
    ║    ║  │BAY   │  │ A & B  │  │STORAGE │ ║                    ║
    ║    ║  └──────┘  └────────┘  └────────┘ ║                    ║
    ║    ╠════════════════╤══════════════════╣                    ║
    ║    ║   ████ LEVEL 4 — [SEALED] ████    ║                    ║
    ║    ║   ████ PRIMARY RESEARCH    ████    ║                    ║
    ║    ║   ████ PROJECT EREBUS      ████    ║                    ║
    ║    ║   ████ ░░░░░░░░░░░░░░░░░░ ████    ║                    ║
    ║    ║   ████ ░░ THE ARCHITECT ░░ ████    ║                    ║
    ║    ║   ████ ░░░░░░░░░░░░░░░░░░ ████    ║                    ║
    ║    ╠════════════════╤══════════════════╣                    ║
    ║    ║       REACTOR CORE                ║                    ║
    ║    ║  ┌──────────────────────────────┐ ║                    ║
    ║    ║  │   [FUSION REACTOR]           │ ║                    ║
    ║    ║  │   [POWER DISTRIBUTION]       │ ║                    ║
    ║    ║  │   [EMERGENCY SHUTDOWN]       │ ║                    ║
    ║    ║  └──────────────────────────────┘ ║                    ║
    ║    ╚════════════════════════════════════╝                    ║
    ║                                                               ║
    ║    [MAINTENANCE TUNNELS run between all levels]              ║
    ║                                                               ║
    ╚═══════════════════════════════════════════════════════════════╝`,
    rooms: [
      { name: 'Airlock 7 — Docking Bay', description: 'Emergency docking port. The USCSS Vanguard is connected here. Your lifeline. Keep it secure at all costs.' },
      { name: 'Level 1 — Bridge', description: 'Station command and control. Crew status boards showing all 47 personnel as "UNKNOWN." Station logs accessible here — they tell a disturbing story.' },
      { name: 'Level 1 — Communications', description: 'Long-range comms array. Currently transmitting nothing — someone shut it down deliberately. Can be reactivated.' },
      { name: 'Level 1 — Life Support', description: 'Environmental controls. Running on automatic at minimal levels. Temperature is barely above freezing. Something is drawing excess power to Level 4.' },
      { name: 'Level 2 — Crew Quarters', description: 'Personal spaces abandoned mid-activity. Running showers, half-eaten meals, open books. 47 lives interrupted. Writing on the walls begins here.' },
      { name: 'Level 2 — Mess Hall', description: 'Communal eating area. Tables overturned. A barricade was built here and then... abandoned. Or overrun.' },
      { name: 'Level 3 — Medical Bay', description: 'Research-grade medical facility. Autopsy reports on crew who died early in the incident. Brain scans showing anomalous activity. Pharmaceutical supplies — including heavy sedatives, mostly used.' },
      { name: 'Level 3 — Research Labs', description: 'Specimen analysis labs. Data terminals with Project Erebus research files. Some specimens still in containment — small, dormant, wrong.' },
      { name: 'Level 4 — Primary Research [SEALED]', description: 'Behind welded blast doors. Bio-containment warning signs everywhere. Beyond the doors: reality breaks down. The station architecture merges with alien biology. The Architect waits at the center.' },
      { name: 'Reactor Core', description: 'Fusion reactor providing station power. Increasingly unstable as Level 4 draws more energy. Emergency shutdown accessible but will kill life support on all levels.' },
      { name: 'Maintenance Tunnels', description: 'Access crawlways running between all levels. Cramped, dark, with emergency lighting only. The fastest way between levels — and the most dangerous.' },
    ],
  },
  /* ═══════════════════════════════════════════════════════════
     COLONIAL MARINES OPERATIONS MANUAL — TACTICAL MAPS
     ═══════════════════════════════════════════════════════════ */
  {
    id: 'uss-tambitam',
    title: 'USS TAMB\'ITAM',
    subtitle: 'Conestoga-Class Frigate — 33rd MAU "Gunfighters"',
    scenario: 'The Marine Campaign',
    description: 'Home of the 33rd Marine Assault Unit. A reinforced battalion of 2,200 troops operating in the Outer Veil during the Frontier War.',
    image: '/maps/acm/uss-tambitam-decks.png',
    rooms: [
      { name: 'Bridge', description: 'Ship command and control. Navigation, tactical displays, communications.' },
      { name: 'Marine Barrack Section', description: 'Housing for Marine personnel. Barracks, mess, recreation facilities.' },
      { name: 'Dropship Launch Hangar', description: 'Hangar bay for UD-4L Cheyenne Dropships. Launch and recovery operations.' },
      { name: 'Armory', description: 'Weapons storage, ammunition, and equipment distribution.' },
      { name: 'Medical Bay', description: 'Ship medical facility. Surgical suites, recovery wards, medpod units.' },
      { name: 'Engineering', description: 'Reactor core, drive systems, and maintenance access.' },
    ],
  },
  {
    id: 'crashed-starship-site',
    title: 'SITE OF THE CRASHED STARSHIP',
    subtitle: 'O\'Bannon\'s Moon — Crash Site',
    scenario: 'Operation Blaze of Glory',
    description: 'The crash site of the UPP vessel SSV Glory of the Proletariat on O\'Bannon\'s Moon. Hostile jungle terrain with potential UPP commando activity.',
    image: '/maps/acm/crashed-starship-site.png',
    rooms: [
      { name: 'Crash Site Perimeter', description: 'Impact zone surrounded by dense jungle. Debris scattered across the area.' },
      { name: 'Wreck — Forward Section', description: 'Partially intact bow of the vessel. Bridge and crew quarters accessible.' },
      { name: 'Wreck — Aft Section', description: 'Engineering and cargo areas. Heavily damaged. Flight recorder location.' },
    ],
  },
  {
    id: 'glory-of-proletariat',
    title: 'SSV GLORY OF THE PROLETARIAT',
    subtitle: 'UPP Medical Frigate — Interior',
    scenario: 'Operation Blaze of Glory',
    description: 'Interior deck plans of the crashed UPP medical frigate. Corridors are dark and unstable. The flight recorder is priority one.',
    image: '/maps/acm/glory-of-proletariat.png',
    rooms: [
      { name: 'Bridge', description: 'UPP command center. Emergency systems may still be active.' },
      { name: 'Medical Bays', description: 'Extensive medical facilities. Evidence of biological research and containment.' },
      { name: 'Crew Quarters', description: 'UPP crew housing. Personal effects may contain intelligence value.' },
      { name: 'Engineering', description: 'Reactor and drive systems. Unstable. Structural collapse risk.' },
      { name: 'Cargo Hold', description: 'Cargo storage. Flight recorder and classified materials stored here.' },
    ],
  },
  {
    id: 'guardian-belt',
    title: 'THE GUARDIAN BELT',
    subtitle: 'Area Map — Arcturus',
    scenario: 'Operation Arcturian Apocalypse',
    description: 'Tactical overview of the Guardian Belt region. Approach vector for APC insertion to the Grand Kivas complex.',
    image: '/maps/acm/guardian-belt.png',
    rooms: [
      { name: 'APC Insertion Point', description: 'Designated landing zone for armored personnel carrier.' },
      { name: 'The Guardian Belt', description: 'Natural rock formations providing cover and concealment. CN-20 nerve agent risk.' },
      { name: 'Grand Kivas Approach', description: 'Route to the cult-held complex. Multiple ambush points.' },
    ],
  },
  {
    id: 'grand-kivas',
    title: 'THE GRAND KIVAS',
    subtitle: 'Cult Stronghold — Arcturus',
    scenario: 'Operation Arcturian Apocalypse',
    description: 'The Grand Kivas complex seized by the Children of the Two Divines. Hostages are held within. Nerve agent deployed.',
    image: '/maps/acm/grand-kivas.png',
    rooms: [
      { name: 'Main Kiva', description: 'Central ceremonial structure. Cult leadership present. Hostage location.' },
      { name: 'Secondary Kivas', description: 'Surrounding structures used as barracks and storage by the cult.' },
      { name: 'Tunnel Access', description: 'Hidden entrance to the Arctura Tunnels and Engineer ruins below.' },
    ],
  },
  {
    id: 'center-kivas',
    title: 'THE CENTER KIVAS — INTERIOR',
    subtitle: 'Interior Layout — Arcturus',
    scenario: 'Operation Arcturian Apocalypse',
    description: 'Detailed interior layout of the Center Kivas. Multiple levels, narrow corridors, and cult fortifications.',
    image: '/maps/acm/center-kivas.png',
    rooms: [
      { name: 'Upper Level', description: 'Cult observation posts and defensive positions.' },
      { name: 'Main Chamber', description: 'Central gathering space. Ritual markings. Hostage holding area.' },
      { name: 'Lower Access', description: 'Descending passages toward the Arctura Tunnels.' },
    ],
  },
  {
    id: 'temple-of-engineers',
    title: 'TEMPLE OF THE ENGINEERS',
    subtitle: 'Ancient Ruins — Below the Kivas',
    scenario: 'Operation Arcturian Apocalypse',
    description: 'Pre-human Engineer ruins discovered beneath the Kivas. Ancient architecture, alien technology, and unknown biological hazards.',
    image: '/maps/acm/temple-of-engineers.png',
    rooms: [
      { name: 'Entry Chamber', description: 'Transition from natural tunnels to engineered stone. Engineer glyphs cover the walls.' },
      { name: 'Central Temple', description: 'Massive vaulted chamber with alien technology. Ampules and urns line the walls.' },
      { name: 'Inner Sanctum', description: 'Deepest chamber. Unknown purpose. Extreme biological hazard.' },
    ],
  },
  {
    id: 'ouragan-test-facility',
    title: 'OURAGAN TEST FACILITY',
    subtitle: 'Weyland-Yutani Weapons Testing Installation',
    scenario: 'Operation Quiet Catch',
    description: 'Classified W-Y weapons testing facility that has gone silent. Conventional weapons testing pits, workshops, and fortified perimeter. Nature of research: classified.',
    image: '/maps/acm/ouragan-test-facility.png',
    rooms: [
      { name: 'Main Gate', description: 'Fortified entrance. Security checkpoint. Currently unresponsive.' },
      { name: 'Testing Pits', description: 'Open-air weapons testing areas. Blast walls and observation bunkers.' },
      { name: 'Workshops', description: 'Engineering and fabrication facilities. Weapons prototypes.' },
      { name: 'Administration', description: 'Facility command. Research data terminals. Staff quarters.' },
      { name: 'Storage Bunkers', description: 'Ammunition and weapons storage. Underground reinforced structures.' },
    ],
  },
  {
    id: 'morgan-bluff-spaceport',
    title: 'MORGAN BLUFF SPACEPORT',
    subtitle: 'Frontier Evacuation Point',
    scenario: 'Operation Go Fish',
    description: 'Frontier spaceport turned evacuation point. Overflowing with refugees, smugglers, and covert operatives. Something is hunting in the shadows.',
    image: '/maps/acm/morgan-bluff-spaceport.png',
    rooms: [
      { name: 'Landing Pads', description: 'Multiple spacecraft berths. Evacuation transports loading.' },
      { name: 'Terminal Building', description: 'Main spaceport terminal. Processing center for evacuees.' },
      { name: 'Mariculture Complex', description: 'Adjacent aquaculture facility. Reported disappearances in this area.' },
      { name: 'Cargo Warehouses', description: 'Storage facilities. Smuggling operations suspected.' },
      { name: 'Control Tower', description: 'Air traffic control and communications. Observation point.' },
    ],
  },
  {
    id: 'talos-station',
    title: 'TALOS STATION',
    subtitle: 'W-Y CN-Class Network Relay Station — All Decks',
    scenario: 'Operation Dreamcatcher',
    description: 'Remote Weyland-Yutani relay station transmitting anomalous signals. 12-person crew missed two check-ins. Apollo-class mainframe on board.',
    image: '/maps/acm/talos-station.png',
    rooms: [
      { name: 'Docking Ring', description: 'External docking ports. Approach and boarding point.' },
      { name: 'Operations Deck', description: 'Station command, communications arrays, sensor equipment.' },
      { name: 'Habitation Deck', description: 'Crew quarters, mess hall, recreation for 12 crew members.' },
      { name: 'Technical Deck', description: 'Apollo mainframe, relay equipment, data processing.' },
      { name: 'Engineering Deck', description: 'Reactor, life support, and maintenance systems.' },
      { name: 'Antenna Arrays', description: 'Two massive communications dishes. External EVA access only.' },
    ],
  },
  {
    id: 'sonderdatch-mine',
    title: 'SONDERDATCH MINE',
    subtitle: 'Elevation & Surface — Deep Void Operation',
    scenario: 'Operation Deep Shaft',
    description: 'Mining operation that broke through to an Engineer accelerant deposit. Workers infected. Anathemas active. Mine flooding with black goo.',
    image: '/maps/acm/sonderdatch-mine.png',
    rooms: [
      { name: 'Surface Facilities', description: 'Mine head, processing plant, crew facilities. Blackguard operatives on site.' },
      { name: 'Upper Shafts', description: 'Primary mining tunnels. Equipment and rail systems.' },
      { name: 'Mid-Level Tunnels', description: 'Secondary mining operations. Unstable. Some sections flooded.' },
      { name: 'Deep Excavation', description: 'The breakthrough point. Black accelerant seepage. Extreme biological hazard.' },
      { name: 'Quarantine Hospital Ship', description: 'Medical vessel on surface. Evacuation point for survivors.' },
    ],
  },
  {
    id: 'darwin-island-overview',
    title: 'DARWIN ISLAND — OVERVIEW',
    subtitle: 'Volcanic Island — Deep Void Project Life Force',
    scenario: 'Operation Octopus Garden',
    description: 'Volcanic island housing Deep Void\'s bioweapon research facility. Multiple Xenomorph variants confirmed. Rogue general preparing evacuation.',
    image: '/maps/acm/darwin-island-overview.png',
    rooms: [
      { name: 'Beach Landing Zone', description: 'Assault insertion point. Rocky coastline with limited cover.' },
      { name: 'Jungle Interior', description: 'Dense tropical vegetation. Xenomorph activity reported.' },
      { name: 'Colonial Rig (External)', description: '80-meter cube suspended over volcanic caldera. Primary objective.' },
      { name: 'Helipad', description: 'Bearcat Strikeship landing area. Anti-air defenses.' },
    ],
  },
  {
    id: 'darwin-island-rig',
    title: 'DARWIN ISLAND — COLONIAL RIG',
    subtitle: 'All Levels — Bioweapon Research Facility',
    scenario: 'Operation Octopus Garden',
    description: 'Multi-level research rig suspended over a volcanic caldera. Xenomorph cultivation, Biodrone program. Soldiers, Scouts, Praetorian, and Gorebursters confirmed.',
    image: '/maps/acm/darwin-island-colonial-rig.png',
    rooms: [
      { name: 'Level 00 — Surface', description: 'Rig access level. Security, personnel processing, vehicle bay.' },
      { name: 'Sublevel 01', description: 'Administration, labs, and staff quarters.' },
      { name: 'Sublevel 02', description: 'Research facilities. Specimen containment. Biodrone program labs.' },
      { name: 'Sublevel 03', description: 'Heavy containment. Xenomorph holding cells.' },
      { name: 'Sublevel 04', description: 'Hive observation level. Extreme hazard zone.' },
      { name: 'Sublevel 05', description: 'Engineering and reactor systems.' },
      { name: 'Sublevel 06 / Caldera', description: 'Lowest level. Direct access to volcanic caldera. Emergency destruct access.' },
    ],
  },
  {
    id: 'generic-starship',
    title: 'GENERIC COMMERCIAL VESSEL',
    subtitle: 'Standard Freight/Tow Configuration',
    scenario: 'Custom',
    description: 'A standard commercial vessel layout for custom scenarios. Adaptable to various ship types and sizes.',
    ascii: `
    ╔═══════════════════════════════════════════════════════════════╗
    ║           STANDARD COMMERCIAL VESSEL — DECK PLAN             ║
    ║                 [CUSTOMIZABLE TEMPLATE]                       ║
    ╠═══════════════════════════════════════════════════════════════╣
    ║                                                               ║
    ║                    ┌───────────┐                              ║
    ║                    │  BRIDGE   │                              ║
    ║                    │  [NAV]    │                              ║
    ║                    │  [COMMS]  │                              ║
    ║                    └─────┬─────┘                              ║
    ║               ┌─────────┴─────────┐                          ║
    ║               │  UPPER CORRIDOR   │                          ║
    ║         ┌─────┴─────┐  ┌──────────┴─┐                       ║
    ║         │ OFFICERS  │  │ COMPUTER   │                        ║
    ║         │ QUARTERS  │  │ CORE       │                        ║
    ║         └─────┬─────┘  └──────────┬─┘                       ║
    ║               │  ┌─────────┐      │                          ║
    ║               ├──┤ GALLEY  ├──────┤                          ║
    ║               │  └─────────┘      │                          ║
    ║         ┌─────┴─────┐  ┌──────────┴─┐                       ║
    ║         │ CREW      │  │ MED BAY    │                        ║
    ║         │ QUARTERS  │  │            │                        ║
    ║         └─────┬─────┘  └──────────┬─┘                       ║
    ║               │  ┌─────────┐      │                          ║
    ║               ├──┤ ARMORY  ├──────┤                          ║
    ║               │  └─────────┘      │                          ║
    ║         ┌─────┴─────┐  ┌──────────┴─┐                       ║
    ║         │ CRYO      │  │ STORAGE    │                        ║
    ║         │ CHAMBER   │  │            │                        ║
    ║         └─────┬─────┘  └──────────┬─┘                       ║
    ║               └─────────┬─────────┘                          ║
    ║               ┌─────────┴─────────┐                          ║
    ║               │   ENGINE ROOM     │                          ║
    ║               │   [REACTOR]       │                          ║
    ║               │   [DRIVES]        │                          ║
    ║               └─────────┬─────────┘                          ║
    ║               ┌─────────┴─────────┐                          ║
    ║               │   CARGO BAY       │                          ║
    ║               │   [AIRLOCK]       │                          ║
    ║               │   [DOCKING PORT]  │                          ║
    ║               └───────────────────┘                          ║
    ║                                                               ║
    ╚═══════════════════════════════════════════════════════════════╝`,
    rooms: [
      { name: 'Bridge', description: 'Ship command. Navigation, communications, MU/TH/UR access. Captain\'s chair. Forward viewports.' },
      { name: 'Officers Quarters', description: 'Private quarters for command staff. Better amenities than crew quarters.' },
      { name: 'Computer Core', description: 'MU/TH/UR mainframe. Ship AI and data storage. Restricted access.' },
      { name: 'Galley', description: 'Mess hall and kitchen. Communal eating area. Coffee machine.' },
      { name: 'Crew Quarters', description: 'Shared bunks for general crew. Lockers, bunks, minimal privacy.' },
      { name: 'Med Bay', description: 'Medical facility. Autodoc, surgical station, pharmacy.' },
      { name: 'Armory', description: 'Locked weapon storage. Access restricted to authorized personnel.' },
      { name: 'Cryo Chamber', description: 'Hypersleep pods for long-haul transit. Emergency wake procedures.' },
      { name: 'Storage', description: 'General supplies, spare parts, EVA equipment.' },
      { name: 'Engine Room', description: 'Reactor and drive systems. Engineering access. Maintenance crawlways.' },
      { name: 'Cargo Bay', description: 'Main hold. Airlock and docking port for external connections.' },
    ],
  },
];
