/* Universe-level maps for ALIEN (data only, no JSX).
   Scenario-specific maps live in the content packs; entries here are
   always available in the Maps tab. 'engine' is filled in by ../index.js
   with an interactive MapEngine component. */
import { W, H, MONTERO_LEVELS, monteroRooms, monteroOutline, monteroCrop, monteroSpawn } from './montero.geometry.js';

export const maps = [
  {
    "id": "uscss-montero",
    "title": "USCSS MONTERO",
    "subtitle": "Lockmart CM-88B Bison-class Tow Vehicle",
    "scenario": "Chariot of the Gods",
    "description": "Commercial towing vessel. Crew complement: 5. Currently hauling refinery module to Anchorpoint Station.",
    "engine": null,
    /* Board data (docs/BOARD_AND_BUILDER.md §3): one room list shared by the
       MapEngine deck plan and the table-board fog / token hit-testing. */
    "kind": "engine",
    "size": [W, H],
    "levels": MONTERO_LEVELS.map(({ id, label }) => ({ id, label })),
    "rooms": monteroRooms,
    "outline": monteroOutline,
    "crop": monteroCrop,
    "spawn": monteroSpawn,
    "grid": 1 / 50,
    "levelNoun": "DECK",
    "backdrop": "space"
  },
  {
    "id": "generic-starship",
    "title": "GENERIC COMMERCIAL VESSEL",
    "subtitle": "Standard Freight/Tow Configuration",
    "scenario": "Custom",
    "levelNoun": "DECK",
    "backdrop": "space",
    "description": "A standard commercial vessel layout for custom scenarios. Adaptable to various ship types and sizes.",
    "ascii": "\n    ╔═══════════════════════════════════════════════════════════════╗\n    ║           STANDARD COMMERCIAL VESSEL — DECK PLAN             ║\n    ║                 [CUSTOMIZABLE TEMPLATE]                       ║\n    ╠═══════════════════════════════════════════════════════════════╣\n    ║                                                               ║\n    ║                    ┌───────────┐                              ║\n    ║                    │  BRIDGE   │                              ║\n    ║                    │  [NAV]    │                              ║\n    ║                    │  [COMMS]  │                              ║\n    ║                    └─────┬─────┘                              ║\n    ║               ┌─────────┴─────────┐                          ║\n    ║               │  UPPER CORRIDOR   │                          ║\n    ║         ┌─────┴─────┐  ┌──────────┴─┐                       ║\n    ║         │ OFFICERS  │  │ COMPUTER   │                        ║\n    ║         │ QUARTERS  │  │ CORE       │                        ║\n    ║         └─────┬─────┘  └──────────┬─┘                       ║\n    ║               │  ┌─────────┐      │                          ║\n    ║               ├──┤ GALLEY  ├──────┤                          ║\n    ║               │  └─────────┘      │                          ║\n    ║         ┌─────┴─────┐  ┌──────────┴─┐                       ║\n    ║         │ CREW      │  │ MED BAY    │                        ║\n    ║         │ QUARTERS  │  │            │                        ║\n    ║         └─────┬─────┘  └──────────┬─┘                       ║\n    ║               │  ┌─────────┐      │                          ║\n    ║               ├──┤ ARMORY  ├──────┤                          ║\n    ║               │  └─────────┘      │                          ║\n    ║         ┌─────┴─────┐  ┌──────────┴─┐                       ║\n    ║         │ CRYO      │  │ STORAGE    │                        ║\n    ║         │ CHAMBER   │  │            │                        ║\n    ║         └─────┬─────┘  └──────────┬─┘                       ║\n    ║               └─────────┬─────────┘                          ║\n    ║               ┌─────────┴─────────┐                          ║\n    ║               │   ENGINE ROOM     │                          ║\n    ║               │   [REACTOR]       │                          ║\n    ║               │   [DRIVES]        │                          ║\n    ║               └─────────┬─────────┘                          ║\n    ║               ┌─────────┴─────────┐                          ║\n    ║               │   CARGO BAY       │                          ║\n    ║               │   [AIRLOCK]       │                          ║\n    ║               │   [DOCKING PORT]  │                          ║\n    ║               └───────────────────┘                          ║\n    ║                                                               ║\n    ╚═══════════════════════════════════════════════════════════════╝",
    "rooms": [
      {
        "name": "Bridge",
        "note": "Ship command. Navigation, communications, MU/TH/UR access. Captain's chair. Forward viewports."
      },
      {
        "name": "Officers Quarters",
        "note": "Private quarters for command staff. Better amenities than crew quarters."
      },
      {
        "name": "Computer Core",
        "note": "MU/TH/UR mainframe. Ship AI and data storage. Restricted access."
      },
      {
        "name": "Galley",
        "note": "Mess hall and kitchen. Communal eating area. Coffee machine."
      },
      {
        "name": "Crew Quarters",
        "note": "Shared bunks for general crew. Lockers, bunks, minimal privacy."
      },
      {
        "name": "Med Bay",
        "note": "Medical facility. Autodoc, surgical station, pharmacy."
      },
      {
        "name": "Armory",
        "note": "Locked weapon storage. Access restricted to authorized personnel."
      },
      {
        "name": "Cryo Chamber",
        "note": "Hypersleep pods for long-haul transit. Emergency wake procedures."
      },
      {
        "name": "Storage",
        "note": "General supplies, spare parts, EVA equipment."
      },
      {
        "name": "Engine Room",
        "note": "Reactor and drive systems. Engineering access. Maintenance crawlways."
      },
      {
        "name": "Cargo Bay",
        "note": "Main hold. Airlock and docking port for external connections."
      }
    ]
  }
];
