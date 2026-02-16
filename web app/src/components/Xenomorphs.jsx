import React, { useState } from 'react';

const xenomorphs = [
  {
    name: 'Ovomorph (Egg)',
    stage: 'Stage I',
    source: 'XX121',
    art: '/art/xenomorphs/crb-xeno-300.png',
    stats: { speed: 0, health: 3, armor: '2 (0 vs fire)' },
    description: 'Leathery organic eggs approximately 0.8 meters tall. The ovomorph opens when it detects a suitable host nearby, releasing the facehugger within. Can remain dormant for centuries.',
    signature: null,
    special: 'Proximity sensor — opens when host approaches within SHORT range.',
  },
  {
    name: 'Facehugger',
    stage: 'Stage II',
    source: 'XX121',
    art: '/art/xenomorphs/crb-xeno-302.png',
    stats: { speed: 3, health: 1, armor: '2 (0 vs fire)', acid: 6 },
    description: 'Parasitoid arachnid form. Attaches to host\'s face, implants embryo, and keeps host alive via direct oxygenation. Acid blood protects it from removal. Dies after implantation.',
    signature: 'D6: 1–3 Leap to face (grab); 4–5 Tail choke (Dmg 1, tighten); 6 Implant (attach, begin implantation).',
    special: 'Grab: Removal causes Acid Splash 6. Successful grab → face attachment → embryo implanted in D6 hours.',
  },
  {
    name: 'Chestburster',
    stage: 'Stage III',
    source: 'XX121',
    art: '/art/xenomorphs/crb-xeno-305.png',
    stats: { speed: 3, health: 1, armor: '3 (0 vs fire)' },
    description: 'The larval stage erupts from the host\'s chest cavity, killing the host instantly. Small, fast, and instinctively driven to flee and hide while it matures. Grows to full adult within hours.',
    signature: 'D6: 1–4 Escape (flee 2 zones, stealth); 5–6 Tail whip (4 Base Dice, Dmg 1).',
    special: 'Eruption kills host instantly. Will not fight — always tries to escape.',
  },
  {
    name: 'Stalker',
    stage: 'Stage IV',
    source: 'XX121',
    art: '/art/xenomorphs/crb-xeno-308.png',
    stats: { speed: 2, health: 6, armor: '10 (5 vs fire)', acid: 8, mobility: 8, observation: 6 },
    description: 'Feral variant. Hunts alone. Extremely aggressive with heavily armored carapace. Its Feral Hunger drives it to attack relentlessly.',
    signature: 'D6: 1 Hypnotizing gaze (+1 Stress + Panic); 2 Playing with prey (knock prone, +1 Stress); 3 Deadly grab (10 Dmg 1, drag, prone); 4 Ready to kill (grabbed → next turn HEADBITE); 5 Capture for hive (venom → unconscious); 6 Headbite (9 Dice, Dmg 2, crit #64 — death).',
    special: 'Feral Hunger — if attack causes damage, immediate second attack (8 Base Dice, Dmg 1).',
  },
  {
    name: 'Scout',
    stage: 'Stage IV',
    source: 'XX121',
    art: '/art/xenomorphs/crb-xeno-308.png',
    stats: { speed: 3, health: 5, armor: '8 (4 vs fire)', acid: 8, mobility: 8, observation: 10 },
    description: 'Reconnaissance variant. Faster than other Stage IV forms, with superior sensory capabilities. Scouts map territory for the hive and identify threats.',
    signature: 'Same as Stalker signature attack table.',
    special: 'Enhanced senses — Observation 10. Fastest Stage IV variant.',
  },
  {
    name: 'Drone',
    stage: 'Stage IV',
    source: 'XX121',
    art: '/art/xenomorphs/crb-xeno-308.png',
    stats: { speed: 2, health: 7, armor: '8 (4 vs fire)', acid: 8, mobility: 10, observation: 8 },
    description: 'The hive builder. Captures hosts and tends the queen. Most intelligent Stage IV variant. Can use its environment creatively — cutting through walls, bypassing obstacles.',
    signature: 'Same as Stalker signature attack table.',
    special: 'Silent Assassin — targets get −2 Observation to detect when in same zone.',
  },
  {
    name: 'Soldier',
    stage: 'Stage V',
    source: 'XX121',
    art: '/art/xenomorphs/crb-xeno-310.png',
    stats: { speed: 2, health: 8, armor: '10 (5 vs fire)', acid: 10, mobility: 8, observation: 6 },
    description: 'The warrior caste. Larger and more aggressive than Stage IV forms. Heavily armored. Deployed by the hive to eliminate major threats.',
    signature: 'D6: 1 Tail sweep (8 Dmg 1, prone); 2 Tail impale (10 Dmg 2, AP); 3 Inner jaw (12 Dmg 2); 4 Deadly grab (10 Dmg 1 → HEADBITE next turn); 5 Acid spit (8 Dmg 1, AP, MEDIUM range); 6 Headbite (12 Dice, Dmg 3, crit #64 — instant death).',
    special: 'Berserker — enters frenzy if hive is threatened. +2 to all attack rolls.',
  },
  {
    name: 'Praetorian',
    stage: 'Stage VI',
    source: 'XX121',
    art: '/art/xenomorphs/crb-xeno-312.png',
    stats: { speed: 2, health: 14, armor: '12 (6 vs fire)', acid: 12, mobility: 8, observation: 8 },
    description: 'Royal guard. Massive xeno that protects the Queen and critical areas of the hive. Tower over other xenomorphs. Can evolve into a Queen if the current one dies.',
    signature: 'D6: 1 Terrifying shriek (Panic, all in zone); 2 Tail sweep (12 Dmg 2, prone, all ENGAGED); 3 Charge (move + 12 Dmg 2); 4 Crushing grab (12 Dmg 2 → headbite next turn); 5 Acid spray (10 Dmg 2, MEDIUM range, all in zone); 6 Headbite (14 Dice, Dmg 4, crit #64 — instant death).',
    special: 'Can evolve into Queen. Terrifying presence — all who see it: immediate Panic Roll.',
  },
  {
    name: 'Queen',
    stage: 'Stage VI',
    source: 'XX121',
    art: '/art/xenomorphs/crb-xeno-313.png',
    stats: { speed: 1, health: 20, armor: '14 (8 vs fire)', acid: 14, mobility: 6, observation: 10 },
    description: 'The matriarch. Center of the hive. Enormous — over 4 meters tall with a massive crested head. Produces eggs and commands all xenos through pheromone communication. Supremely intelligent.',
    signature: 'D6: 1 Commanding shriek (all xenos in area act immediately); 2 Tail impale (14 Dmg 3, AP); 3 Crushing claws (14 Dmg 3, grab); 4 Charge (move + 14 Dmg 3, prone all in path); 5 Acid spray (12 Dmg 3, all in zone); 6 Headbite (16 Dice, Dmg 5, instant kill).',
    special: 'Commands all xenomorphs. Egg-layer. Intelligence comparable to humans. Will sacrifice other xenos to protect herself.',
  },
  {
    name: 'Neomorphic Egg Sacs',
    stage: 'Stage I',
    source: 'Neomorph',
    art: '/art/xenomorphs/crb-xeno-293.png',
    stats: { speed: 0, health: 1, armor: '0' },
    description: 'Fungal growths produced by the accelerant pathogen. When disturbed, release microscopic motes that infect hosts through inhalation or skin contact.',
    signature: null,
    special: 'Release motes when disturbed. Infection is airborne.',
  },
  {
    name: 'Bloodburster',
    stage: 'Stage III',
    source: 'Neomorph',
    art: '/art/xenomorphs/crb-xeno-294.png',
    stats: { speed: 3, health: 2, armor: '3 (0 vs fire)', mobility: 9, observation: 6 },
    description: 'Erupts from the host\'s back or throat rather than the chest. Pale, translucent, and extremely fast. Immediately hostile upon emergence.',
    signature: 'D6: 1–3 Escape (flee 2 zones, stealth); 4 Terrifying hiss (Panic Roll); 5 Leg bite (6 Dice, Dmg 2 + crit #53); 6 Throat bite (8 Dice, Dmg 1 + crit #61 — death).',
    special: null,
  },
  {
    name: 'Neophyte (Juvenile Neomorph)',
    stage: 'Stage IV',
    source: 'Neomorph',
    art: '/art/xenomorphs/crb-xeno-295.png',
    stats: { speed: 3, health: 4, armor: '4 (2 vs fire)', mobility: 10, observation: 6 },
    description: 'Rapidly growing juvenile stage. Pale white, eyeless, with a translucent quality. Moves with unnatural speed and aggression.',
    signature: 'Increasingly aggressive attacks as it matures.',
    special: 'Sprint — slow action = 2 zones or into ENGAGED.',
  },
  {
    name: 'Adult Neomorph',
    stage: 'Stage V',
    source: 'Neomorph',
    art: '/art/xenomorphs/crb-xeno-296.png',
    stats: { speed: 2, health: 6, armor: '6 (3 vs fire)', mobility: 9, observation: 8 },
    description: 'Fully grown neomorph. Pale white, muscular, with a smooth featureless head. No acid blood. Aggressive and territorial. Short lifespan of approximately 24 hours.',
    signature: 'D6: 1 Hiss + Panic; 2 Tail slash (10 Dice, Dmg 2 AP); 3 Deadly grab (8 Dmg 1, drag, prone); 4 Leaping attack (8 Dmg 1 + 10 Dmg 2); 5 Throat bite (8 Dmg 1 + crit #61); 6 Tail spike (7 Dmg 1 AP + crit #66 — kill).',
    special: 'Sprint. Short lifespan (~24 hours). No acid blood.',
  },

  /* ═══ OTHER SPECIES ═══ */
  {
    name: 'The Swarm',
    stage: '–',
    source: 'Other',
    art: '/art/xenomorphs/crb-xeno-316.png',
    stats: { speed: 2, health: '1 per swarm unit', armor: '0' },
    description: 'Insect-like alien lifeforms that operate as a collective. Individually small and weak, but in swarms they can overwhelm and devour anything. Found on several Frontier worlds.',
    signature: 'Envelop and devour. Damage based on swarm size.',
    special: 'Area attack — damages all in zone. Fire is most effective.',
  },
  {
    name: 'Harvesters',
    stage: '–',
    source: 'Other',
    art: '/art/xenomorphs/crb-xeno-318.png',
    stats: { speed: 1, health: 10, armor: '8 (4 vs fire)' },
    description: 'Enormous arthropod predators found on frontier worlds. Ambush hunters that burrow underground and erupt to seize prey. Armored carapace resists most small arms.',
    signature: 'D6: 1–2 Burrow and ambush; 3–4 Crushing mandibles (10 Dmg 3); 5–6 Impaling limbs (12 Dmg 2, grab).',
    special: 'Burrowing — can ambush from underground. Armored carapace.',
  },
  {
    name: 'Lion Worms',
    stage: '–',
    source: 'Other',
    art: '/art/xenomorphs/crb-xeno-320.png',
    stats: { speed: 1, health: 8, armor: '4' },
    description: 'Massive carnivorous worms found on desert worlds. Attracted by vibration. Can grow to enormous sizes. Territorial and aggressive.',
    signature: 'D6: 1–3 Emerge and strike (8 Dmg 2); 4–6 Swallow (10 Dmg 3, grab — swallowed next turn).',
    special: 'Vibration sense — detects movement through ground. Burrowing.',
  },
  {
    name: 'Tanakan Scorpionids',
    stage: '–',
    source: 'Other',
    art: '/art/xenomorphs/crb-xeno-322.png',
    stats: { speed: 2, health: 5, armor: '6' },
    description: 'Arachnid predators native to Tanaka 5. Venomous stinger and crushing pincers. Hunt in packs. Some colonists have attempted to domesticate juveniles with predictable results.',
    signature: 'D6: 1–2 Pincer crush (8 Dmg 2); 3–4 Stinger (6 Dmg 1 + venom); 5–6 Leaping strike (10 Dmg 2, grab).',
    special: 'Venom — STAMINA roll or paralyzed for D6 Rounds. Pack hunters.',
  },

  /* ═══ ACM ABERRANT TYPES ═══ */
  {
    name: 'Vitiate "Afflicted"',
    stage: 'Aberrant Stage I',
    source: 'ACM Aberrant',
    art: '/art/xenomorphs/acm-xeno-179.png',
    stats: { speed: 1, health: 'Varies', armor: '0' },
    description: 'Humans infected by the 26 Draconis Strain bioweapon. The accelerant fights the xenomorph embryo, causing fever, delirium, and physical deterioration. The host is aware but losing control.',
    signature: 'Unpredictable behavior. May attack allies.',
    special: 'Can potentially be saved if treated early enough. Progressive deterioration.',
  },
  {
    name: 'Ague "Febrile"',
    stage: 'Aberrant Stage II',
    source: 'ACM Aberrant',
    art: '/art/xenomorphs/acm-xeno-180.png',
    stats: { speed: 2, health: 6, armor: '4' },
    description: 'The host\'s body chemistry has been radically altered. Skin hardens, features distort. The human personality fractures as alien instincts emerge. Dangerously unpredictable.',
    signature: 'D6: 1–2 Feral attack (8 Dmg 1); 3–4 Acid vomit (6 Dmg 1, SHORT range); 5–6 Berserk charge (10 Dmg 2).',
    special: 'Human-alien hybrid. May retain fragments of human memory and speech.',
  },
  {
    name: 'Lusus "Freak"',
    stage: 'Aberrant Stage III',
    source: 'ACM Aberrant',
    art: '/art/xenomorphs/acm-xeno-180.png',
    stats: { speed: 2, health: 8, armor: '6 (3 vs fire)' },
    description: 'Fully transformed. The host\'s body has been rebuilt into something between human and xenomorph. Grotesque, powerful, and driven by alien instinct. No trace of the original person remains.',
    signature: 'D6: 1–2 Claw strike (10 Dmg 2); 3–4 Acid spit (8 Dmg 1, MEDIUM); 5–6 Berserker frenzy (12 Dmg 2, attacks all ENGAGED).',
    special: 'Terrifying appearance — Panic Roll for all who see it for the first time.',
  },
  {
    name: 'Nocuous "Terminal"',
    stage: 'Aberrant Stage IV',
    source: 'ACM Aberrant',
    art: '/art/xenomorphs/acm-xeno-181.png',
    stats: { speed: 3, health: 12, armor: '8 (4 vs fire)', acid: 10 },
    description: 'Final stage. A monstrous fusion of human and xenomorph biology. Massive, fast, acid-blooded. Retains enough intelligence to use tools and set ambushes. A nightmare given form.',
    signature: 'D6: 1 Terrifying shriek (Panic all in zone); 2–3 Crushing charge (12 Dmg 3); 4–5 Acid spray (10 Dmg 2, all in zone); 6 Headbite variant (14 Dmg 4, crit #64).',
    special: 'Retains tool use. Can set ambushes. Acid blood splash 10.',
  },
];

function XenoCard({ xeno }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="panel" style={{ cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--accent)', letterSpacing: '0.08em', marginBottom: '0.15rem' }}>{xeno.name}</h3>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
            {xeno.stage} — {xeno.source}
          </div>
        </div>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      <div className="creature-stats" style={{ marginTop: '0.5rem' }}>
        <span>SPEED {xeno.stats.speed}</span>
        <span>HEALTH {xeno.stats.health}</span>
        <span>ARMOR {xeno.stats.armor}</span>
        {xeno.stats.acid && <span>ACID {xeno.stats.acid}</span>}
        {xeno.stats.mobility && <span>MOB {xeno.stats.mobility}</span>}
        {xeno.stats.observation && <span>OBS {xeno.stats.observation}</span>}
      </div>

      {expanded && (
        <div style={{ marginTop: '0.75rem' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: '1.5', marginBottom: '0.5rem' }}>
            {xeno.description}
          </p>
          {xeno.signature && (
            <div style={{ marginBottom: '0.5rem' }}>
              <strong style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>SIGNATURE ATTACK: </strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{xeno.signature}</span>
            </div>
          )}
          {xeno.special && (
            <div style={{ marginBottom: '0.75rem' }}>
              <strong style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>SPECIAL: </strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{xeno.special}</span>
            </div>
          )}
          {xeno.art && (
            <div style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden', background: '#080c10' }}>
              <img
                src={xeno.art}
                alt={xeno.name}
                style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); window.open(xeno.art, '_blank'); }}
                title="Click to open full size"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Xenomorphs() {
  const [filter, setFilter] = useState('all');

  const sources = ['all', 'XX121', 'Neomorph', 'Other', 'ACM Aberrant'];
  const filtered = filter === 'all' ? xenomorphs : xenomorphs.filter(x => x.source === filter);

  return (
    <div>
      <div className="panel">
        <h2>ALIEN SPECIES DATABASE</h2>
        <p style={{ color: 'var(--text-dim)', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
          Complete xenomorph and alien species reference. Click any entry to expand details, stats, and view artwork.
        </p>
      </div>

      <div className="filter-bar" style={{ marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        {sources.map(s => (
          <button key={s} className={filter === s ? 'active' : ''} onClick={() => setFilter(s)}>
            {s === 'all' ? `ALL (${xenomorphs.length})` : s.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '0.8rem', color: 'var(--accent)', marginBottom: '0.5rem' }}>XENOMORPH CRITICAL (D6) AT 0 HEALTH</h3>
        <table className="cheat">
          <tbody>
            <tr><th>1</th><td>Rise Again — ruse; if attacked or next initiative: +1 Health, attack.</td></tr>
            <tr><th>2</th><td>Wounded — Speed −1 (min 1), +1 Health. Each Round D6 1–3: try to escape.</td></tr>
            <tr><th>3</th><td>Desperate — instant fast+slow. D6 1–3 escape; 4–6 attack. No damage = die.</td></tr>
            <tr><th>4</th><td>Last Breath — next initiative: kill nearest, then die.</td></tr>
            <tr><th>5–6</th><td>Torn apart. Instant death.</td></tr>
          </tbody>
        </table>
      </div>

      {filtered.map((xeno, i) => <XenoCard key={i} xeno={xeno} />)}
    </div>
  );
}
