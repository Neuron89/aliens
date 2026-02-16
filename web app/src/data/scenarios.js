export const scenarios = [
  {
    id: 'chariot-of-the-gods',
    title: 'Chariot of the Gods',
    tagline: 'The job was simple. The money was good. Then the signal changed everything.',
    players: '3–5',
    playtime: '4–6 hours',
    difficulty: 'Standard Cinematic',
    type: 'Cinematic',
    briefing: {
      from: 'MU/TH/UR 6000 MAINFRAME',
      to: 'CREW, USCSS MONTERO',
      classification: 'PRIORITY ONE — COMPANY DIRECTIVE',
      text: `ATTENTION ALL CREW. AUTOMATED DISTRESS BEACON DETECTED.

Signal origin: Sector 87-C, Outer Rim Territories. Beacon identification confirms source vessel as the USCSS CRONUS — a Weyland-Yutani science vessel reported lost seventy-three years ago during a deep-space biological survey mission. All hands were presumed dead. No wreckage was ever recovered.

Per Interstellar Commerce Commission regulation ICC-2249/17, all commercial vessels within response range are legally required to investigate distress signals of human origin. Failure to comply will result in total forfeiture of shares, compensation, and may result in criminal prosecution.

The USCSS MONTERO has been diverted from its current heading. Course correction has been initiated. Estimated time to intercept: fourteen hours.

All crew members are to report to the bridge for emergency briefing. Personal effects should be secured. This is not a drill.

Additional data on the USCSS CRONUS has been classified by Weyland-Yutani Special Projects Division. Access restricted to Company personnel with Clearance Level 3 or above.

MU/TH/UR out.`,
    },
    acts: [
      {
        title: 'ACT I',
        subtitle: 'HOPE',
        readAloud: [
          `You've been in cryo for weeks — the deep, dreamless cold of hypersleep. The thaw cycle pulls you back to consciousness with the taste of copper in your mouth and ice crystals on your eyelashes. The lights in the cryo bay are dim, cycling through their wake-up sequence in slow amber pulses.`,
          `The Montero is a working ship. Not glamorous. Not comfortable. The corridors smell like recycled air and engine grease. You know every scratch on the bulkheads, every rattle in the ventilation. This is a ship that earns its keep hauling cargo across the Frontier — and you earn yours aboard it.`,
          `But something is different this time. MU/TH/UR has woken you early. The navigation display shows you're nowhere near Anchorpoint Station. Through the bridge viewports, you can see it — a dark shape against the stars, tumbling slowly in the void. A ship. Old design. No running lights.`,
          `The USCSS Cronus. Missing for seventy-three years. And someone — or something — aboard it is still broadcasting a distress signal.`,
          `Company regs are clear. You have to investigate. The Montero docks with a magnetic clang that resonates through the hull. The airlock pressurizes with a hiss. Beyond the inner door, the Cronus waits — dark, cold, and silent.`,
          `The motion tracker reads nothing. But the air coming through the seals smells wrong — organic, humid, alive. Like a greenhouse left to rot.`,
        ],
        gmNotes: `This act is about building tension and establishing relationships between the PCs. Let them explore the Montero first, interact with each other, and feel the normalcy before it's shattered. The Cronus should feel WRONG from the moment they board — humid air, strange organic residue on the walls, systems half-alive. Drop hints but don't reveal the horror yet. Let the motion tracker stay quiet... for now.`,
      },
      {
        title: 'ACT II',
        subtitle: 'BETRAYAL',
        readAloud: [
          `The deeper you go into the Cronus, the worse it gets. The corridors are slick with condensation — or something worse. Organic matter clings to the walls in patterns that almost look deliberate, like veins spreading through the ship's architecture. The emergency lighting casts everything in a sickly amber glow.`,
          `You find the crew logs. Fragmented. Corrupted. But enough survives to paint a picture of escalating terror. The Cronus found something out here — something the company wanted very badly. They brought specimens aboard. They ran experiments. And then the specimens got out.`,
          `The crew lasted eleven days.`,
          `Systems across the Cronus are failing. Life support is erratic — temperature fluctuations, atmospheric contamination warnings. The reactor is unstable. And something is moving in the ventilation ducts. You can hear it now — a wet, scraping sound that travels through the walls. The motion tracker pings once. Twice. Then a cascade of contacts, moving fast, converging on your position.`,
          `You are not alone on this ship. You never were.`,
          `And someone in your crew already knew that.`,
        ],
        gmNotes: `This is where paranoia kicks in. Reveal that the Company Agent has secret orders. Let PCs discover partial truths — experiments, specimens, coverups. Run the first xenomorph encounter here. It should be terrifying and chaotic. NPCs should die. Systems should fail. Make the players feel trapped. Personal agendas start conflicting now.`,
      },
      {
        title: 'ACT III',
        subtitle: 'NEMESIS',
        readAloud: [
          `The Cronus is dying. Reactor containment alarms shriek through corridors now slick with blood and that impossible organic growth. Emergency bulkheads are slamming shut one by one, cutting off escape routes you mapped hours ago. The ship is a maze of locked doors and hunting shadows.`,
          `Whatever the Cronus's crew brought aboard has had seventy-three years to grow. To spread. To nest. The lower decks are completely overrun — the walls themselves seem to breathe, ribbed with that dark, resinous architecture. Biomechanical. Alien. Wrong in a way that your brain refuses to fully process.`,
          `The Montero is still docked. Your ship. Your way out. But the docking corridor is compromised — you'll have to fight through to reach it, or find another way. And the creatures are between you and the airlock.`,
          `The reactor countdown is ticking. When it goes, both ships go with it. You have minutes, not hours.`,
          `Whatever choices you've made, whatever alliances have held or broken — it comes down to this. Run. Fight. Survive. Get to the Montero. Blow the docking clamps. And pray that nothing followed you aboard.`,
          `In space, no one can hear you scream. But aboard the Cronus, you can hear everything else.`,
        ],
        gmNotes: `Final act — pure survival horror. The reactor is going critical. Multiple xenomorphs are active. Betrayals come to a head. This should be a desperate scramble for the Montero. Kill PCs if they make bad choices — this is Cinematic mode. The final reveal is that the threat may have come aboard the Montero. End on a cliffhanger if possible. Let survivors wonder if they truly escaped.`,
      },
    ],
    keyLocations: [
      { name: 'USCSS Montero — Bridge', description: 'The nerve center of your tow vessel. Navigation, comms, and MU/TH/UR access terminal.' },
      { name: 'USCSS Montero — Cargo Bay', description: 'Cavernous hold where the tow coupling connects. Cold and echoing.' },
      { name: 'USCSS Cronus — Airlock', description: 'The connection point. Atmosphere is breathable but humid and organic-smelling.' },
      { name: 'USCSS Cronus — Bridge', description: 'Emergency power only. Crew logs stored in corrupted databanks. Signs of a last stand.' },
      { name: 'USCSS Cronus — Lab Module', description: 'Where the experiments happened. Containment pods — most shattered from the inside.' },
      { name: 'USCSS Cronus — Lower Decks', description: 'Completely overgrown with alien resin. The nest. Do not enter without extreme caution.' },
      { name: 'USCSS Cronus — Reactor', description: 'Unstable. Containment failing. The countdown starts here.' },
    ],
    characters: ['cpt-miller', 'cham', 'davis', 'rye', 'wilson'],
  },
  {
    id: 'hopes-last-day',
    title: "Hope's Last Day",
    tagline: 'The colony of Hadley\'s Hope has 158 days of peace left. Today is not one of them.',
    players: '3–5',
    playtime: '3–4 hours',
    difficulty: 'Introductory Cinematic',
    type: 'Cinematic',
    briefing: {
      from: 'COLONY OPERATIONS MAINFRAME',
      to: 'ALL PERSONNEL — HADLEY\'S HOPE',
      classification: 'ROUTINE STATUS UPDATE',
      text: `GOOD MORNING, HADLEY'S HOPE. LOCAL TIME 0600 HOURS.

Atmospheric processor status: NOMINAL. Terraforming cycle 847 in progress. External temperature: minus 42 degrees Celsius. Wind speed: 85 knots with gusts to 130. Visibility: near zero. Standard LV-426 conditions.

Colony population: 158 souls. All sections reporting normal. Water reclamation at 94% efficiency. Hydroponic bay output within expected parameters. Supply ship ETA: 47 days.

NOTICE: Survey Team Bravo is dispatched to grid reference 0-4-7 to investigate a structure of unknown origin detected by the processor's ground-penetrating sensors. Survey team leader Russ Jorden reports departure at 0545.

All other personnel — report to duty stations per standard rotation.

It's another day on LV-426. Make it count.

COLONY OPS out.`,
    },
    acts: [
      {
        title: 'ACT I',
        subtitle: 'ANOTHER GLORIOUS DAY IN THE CORPS',
        readAloud: [
          `Hadley's Hope. Population: 158. A terraforming colony on LV-426 — a desolate, storm-wracked moon that no one in their right mind would call home. But home is what the company calls it, and home is where you are.`,
          `The colony is a collection of prefab modules bolted together against the wind, centered around the massive atmospheric processor that hums day and night, slowly making this hellhole breathable. Outside, the storms never stop. Inside, it's fluorescent lights, recycled air, and the same faces every day.`,
          `You know the routines. Morning shift, evening shift. Meals in the commons. Kids in the school module. Maybe a drink at the rec room if you're lucky. It's boring. It's safe. It's predictable.`,
          `Today starts like any other day. The wake-up alarm. Coffee that tastes like it was filtered through engine parts. The morning briefing. But there's something different in the air today — a tension you can't quite name. The survey team left early, heading out to check some structure the processor sensors picked up. Nobody thinks much of it. Survey teams go out all the time.`,
          `They always come back.`,
        ],
        gmNotes: `Establish the mundane reality of colony life. Let players interact with NPCs, handle small colony problems (broken equipment, supply disputes, personal drama). This normality makes the horror hit harder. Survey Team Bravo is out investigating the derelict — they will return with a facehugger victim. Plant seeds of unease: a kid's drawing of something scary, a weird signal on comms, a pet acting frightened.`,
      },
      {
        title: 'ACT II',
        subtitle: 'THEY MOSTLY COME AT NIGHT',
        readAloud: [
          `The call comes in at 1430 hours. Survey Team Bravo — emergency frequency. Russ Jorden's wife is screaming. Something happened at the site. Something attacked her husband. His biosigns are erratic. There's something on his face. They can't get it off.`,
          `The med bay goes into emergency mode. When they bring Jorden in, the thing attached to his face is like nothing you've ever seen — pale, leathery, with a tail wrapped tight around his throat. It's keeping him alive, somehow. Feeding him air through a tube it's forced down his throat. Doctor's orders: do not attempt removal. The last person who tried got sprayed with acid that ate through three deck plates.`,
          `Hours pass. The tension in the colony ratchets up with every one of them. People cluster in corridors, whispering. The children are kept away from the med bay. And then — just as suddenly as it appeared — the thing on Jorden's face detaches. Falls off. Dead. Jorden wakes up, groggy but alive. Hungry. No memory of what happened.`,
          `Everyone breathes a sigh of relief.`,
          `That relief lasts exactly six hours.`,
          `The scream from the med bay is inhuman. By the time you get there, Jorden is dead — his chest torn open from the inside. And something small and fast and covered in blood has disappeared into the ventilation system. The motion tracker shows it moving through the ducts. Growing. Fast.`,
        ],
        gmNotes: `The facehugger arrival triggers escalating horror. Run the medical crisis — no one knows what to do. When the chestburster erupts, it should be shocking and graphic. The creature disappears into the vents. Colony lockdown begins. Run encounters with the rapidly-growing creature in the vents — it's hunting, learning the layout, picking off isolated colonists. Communications with the outside are jammed by the storm.`,
      },
      {
        title: 'ACT III',
        subtitle: 'GAME OVER, MAN',
        readAloud: [
          `It's been twelve hours since the creature escaped into the vents, and Hadley's Hope is falling apart. The body count is climbing. The thing in the vents has grown — impossibly fast — into something that barely fits in the ducts anymore. Something tall and black and eyeless, with a skull like polished bone and a mouth full of chrome teeth.`,
          `The colony's motion tracker network is lighting up with contacts. Not one contact. Multiple. The ground-penetrating sensors have picked up movement beneath the processor — a structure, organic, growing. A nest. The eggs were already here, seeded by something that came before, and the colony's survey teams have been walking right past them for months.`,
          `Power failures cascade through the colony modules. Emergency lighting bathes everything in red. Bulkheads that should be sealed are being forced open — or melted through with acid. The screams come from every direction now. Colonists are being dragged into the vents, into the walls, into the dark spaces between modules where the creatures have made their home.`,
          `You have one chance. The colony's emergency shuttle — or the armored personnel carrier in the vehicle bay. Get to one of them. Get your people aboard. Get off this rock before the atmospheric processor goes critical. Because when that goes, it'll take the colony, the creatures, and everything within a thirty-kilometer radius with it.`,
          `The clock is ticking. The creatures are everywhere. And Hadley's Hope is about to live up to its name for the very last time.`,
        ],
        gmNotes: `Full colony collapse. Multiple xenomorphs. Running battles through failing infrastructure. NPCs die in horrible ways. The atmospheric processor is destabilizing (the creatures have damaged it). Players must reach the shuttle or APC. Barricades, desperate last stands, impossible choices about who to save. This should feel like the second half of ALIENS — chaotic, terrifying, and lethal. Most PCs should not survive.`,
      },
    ],
    keyLocations: [
      { name: 'Operations Center', description: 'Colony command. Comms, sensors, atmospheric processor controls.' },
      { name: 'Med Bay', description: 'Colony medical facility. Where the facehugger victim is brought. Where it all goes wrong.' },
      { name: 'Hab Modules', description: 'Living quarters for 158 colonists. Narrow corridors. Thin walls.' },
      { name: 'Commons / Rec Room', description: 'Social hub. Tables, a bar, a pool table. Feels safe. Isn\'t.' },
      { name: 'Vehicle Bay', description: 'Garage module. The APC and other vehicles are stored here.' },
      { name: 'Atmospheric Processor', description: 'Massive industrial structure. The nest is growing in its sub-levels.' },
      { name: 'Landing Pad', description: 'Emergency shuttle pad. Exposed to the storm. Your ticket out.' },
    ],
    characters: ['marshal-al-rahim', 'dr-patel', 'roughneck-novak', 'pilot-clairemont', 'kid-newt'],
  },
  {
    id: 'destroyer-of-worlds',
    title: 'Destroyer of Worlds',
    tagline: 'You were trained for war. Nothing trained you for this.',
    players: '3–5',
    playtime: '5–7 hours',
    difficulty: 'Advanced Cinematic',
    type: 'Cinematic',
    briefing: {
      from: 'USCM COMMAND — FORT NEBRASKA',
      to: 'FIRETEAM ALPHA, 4TH BATTALION',
      classification: 'CLASSIFIED — OPERATION COBALT VALKYRIE',
      text: `ATTENTION MARINES. COMBAT DEPLOYMENT ORDER.

You are being deployed to Ariarcus, a moon in the Kruger 60 system, designated a Forward Operating Base during the current territorial dispute between the United Americas and the Union of Progressive Peoples.

Intelligence reports indicate UPP forces have established a covert research installation on Ariarcus in violation of the Frontier Accord. Your mission is to locate, assess, and if necessary neutralize this installation. Rules of engagement: weapons free on confirmed hostile contacts.

Be advised: civilian population present. A small mining colony — Fort Nebraska — operates on the moon's surface under UA charter. Minimize civilian casualties. Collateral damage will be reviewed by JAG.

Atmospheric conditions on Ariarcus are harsh but survivable. Gravity: 0.8G. Temperature: minus 12 to plus 4 Celsius. Intermittent electrical storms may disrupt communications and sensor equipment.

Transport vessel USCSS Erebos will deliver your fireteam to the LZ at 0300 local time. Full combat loadout authorized. Smartgun teams: approved.

Additional briefing materials have been uploaded to your squad tactical network. Review en route.

One more thing, Marines: there have been... unconfirmed reports from the colony. Seismic activity. Missing personnel. Probably nothing. Stay focused on the mission.

Semper fi.`,
    },
    acts: [
      {
        title: 'ACT I',
        subtitle: 'DROP ZONE',
        readAloud: [
          `The dropship hits atmosphere like a hammer hitting an anvil. Ariarcus reaches up with storms and turbulence, shaking the hull until your teeth rattle. Through the narrow viewport, you can see nothing but cloud — thick, dark, shot through with veins of lightning.`,
          `You're Colonial Marines. 4th Battalion. The best of the worst, trained to drop into hostile environments and make them more hostile. Your pulse rifles are locked and loaded. Your motion trackers are cycling. The smartgun operators are running final diagnostics. Everything by the book.`,
          `Fort Nebraska materializes out of the storm like a ghost — a cluster of industrial modules and mining equipment huddled in a shallow crater, surrounded by jagged ice formations. The colony looks small from up here. Fragile. The kind of place the universe could swallow without noticing.`,
          `The LZ is cold and exposed. Wind cuts through your armor's seals as you dismount. The colony administrator meets you on the pad — nervous, sweating despite the cold. Something's wrong. You can see it in the faces of the miners who've come out to watch the military arrive. They're not curious. They're afraid.`,
          `Missing people, the administrator says. Three survey teams in the last month. And sounds from underground. Like something moving through the old mine shafts that riddle the moon's crust.`,
          `Welcome to Ariarcus. Your war is about to become something else entirely.`,
        ],
        gmNotes: `Establish the military atmosphere. Let marines be marines — bravado, equipment checks, chain of command. Fort Nebraska is tense: the civilian miners are scared, the colony admin is hiding things. UPP agents are somewhere nearby. Layer the threats: political (UPP), environmental (storms, mines), and the unknown horror below. Let players do recon, interact with colonists, and discover early clues. Missing people. Strange sounds. Acid-scarred rock in the mine tunnels.`,
      },
      {
        title: 'ACT II',
        subtitle: 'CONTACT',
        readAloud: [
          `The UPP installation is real — buried in the mine complex three klicks north of the colony. Your recon team finds it sealed tight, running on its own power. Military-grade locks. Bio-containment warnings on every door. Whatever they're researching down there, they don't want it getting out.`,
          `But something already has.`,
          `The first contact comes in the mines. Motion tracker goes wild — multiple fast-moving contacts, converging from side tunnels that aren't on any map. The point man opens fire on instinct. Muzzle flash illuminates something impossible — dark, skeletal, moving on the walls and ceiling with a speed that defies physics.`,
          `The screaming starts. Acid blood sprays. Your squad formation dissolves into a fighting retreat through tunnels that amplify every shot, every scream, every wet tearing sound into a cathedral of noise.`,
          `By the time you reach the surface, you've lost people. Good Marines. And the motion trackers are showing more contacts, rising from deep in the mine shafts. Dozens. Maybe hundreds. The UPP didn't just find specimens down there — they found a hive. And the Marines just kicked the hornet's nest.`,
          `Fort Nebraska's perimeter alarms start wailing. The colonists are screaming. The storm is getting worse, cutting off air support and orbital comms. You're on your own, surrounded, and the things in the dark are just getting started.`,
        ],
        gmNotes: `First full combat encounter with xenomorphs in the mines. This should be brutal and disorienting — tight corridors, darkness, acid splash. Marines should take casualties. Reveal the UPP lab contents: specimens, research data, failed containment. The political situation escalates: UPP soldiers are also in the mines and may be hostile, neutral, or desperate allies. Back at Fort Nebraska, the creatures are emerging. Run a siege scenario.`,
      },
      {
        title: 'ACT III',
        subtitle: 'NO WAY OUT',
        readAloud: [
          `Fort Nebraska is under siege. The perimeter lights cut cones of white through the driving snow, and in that light, you can see them moving — dark shapes, low and fast, pouring from the mine entrances like oil from a ruptured pipe. The motion tracker is useless now — too many contacts, too close.`,
          `The colonists have been herded into the operations center. Children crying. Adults praying. A miner loads a shotgun with shaking hands. The Marines who are still standing form a perimeter, but you all know the math. You're outnumbered. Out-evolved. Fighting something that doesn't know fear, doesn't feel pain, and wants you alive — not dead. Alive is worse.`,
          `The dropship. That's the play. It's still on the landing pad, engines cold. Someone has to get to it, power it up, hold the pad long enough to get survivors aboard. The creatures are between you and the LZ, and the storm is trying to tear the colony apart.`,
          `There's another option. The UPP lab has an emergency beacon — military grade, powerful enough to punch through the storm. But reaching it means going back into the mines. Back into the hive. And whoever goes probably isn't coming back.`,
          `You're Colonial Marines. This is what you signed up for. Time to earn your combat pay. Move out.`,
        ],
        gmNotes: `Desperate last stand. Two possible escape routes: the dropship (fighting through the colony) or the UPP beacon (going back into the mines). Both are near-suicidal. Run simultaneous threats: creatures attacking, UPP forces with their own agenda, colony infrastructure failing. This is where heroic sacrifices happen. Let players make impossible choices. High body count. Anyone who survives should feel like they earned it.`,
      },
    ],
    keyLocations: [
      { name: 'Landing Pad', description: 'Exposed platform. The dropship is here. Getting to it is the problem.' },
      { name: 'Fort Nebraska — Ops Center', description: 'Colony command. The last defensible position.' },
      { name: 'Fort Nebraska — Barracks', description: 'Marine quarters. Weapon lockers and equipment.' },
      { name: 'Mine Entrance Alpha', description: 'Primary shaft. Descends 200 meters. The creatures come from here.' },
      { name: 'UPP Research Lab', description: 'Hidden installation in the deep mines. Bio-containment. The origin point.' },
      { name: 'The Hive', description: 'Deep in the mine complex. Resin walls, cocooned victims, eggs. Hell.' },
      { name: 'Colony Perimeter', description: 'Fence line with motion sensors and floodlights. Won\'t hold forever.' },
    ],
    characters: ['lt-reid', 'sgt-aguilar', 'cpl-shusett', 'pvt-chen', 'doc-holliday'],
  },
  {
    id: 'heart-of-darkness',
    title: 'Heart of Darkness',
    tagline: 'The station went silent six months ago. Now you\'re going in.',
    players: '3–5',
    playtime: '4–6 hours',
    difficulty: 'Advanced Cinematic',
    type: 'Cinematic',
    briefing: {
      from: 'WEYLAND-YUTANI SPECIAL PROJECTS',
      to: 'INVESTIGATION TEAM KAPPA',
      classification: 'EYES ONLY — CLEARANCE LEVEL 5',
      text: `CLASSIFIED BRIEFING — PROJECT EREBUS

Six months ago, contact was lost with Research Station Prometheus, a Weyland-Yutani deep-space research facility operating in the Zeta II Reticuli system. The station's complement of 47 researchers and support staff have been declared MIA. All automated telemetry ceased simultaneously. No distress signal was transmitted.

Your team has been assembled to investigate. You are authorized to use any means necessary to determine the status of the station, recover research data classified under Project Erebus, and — if possible — retrieve surviving personnel.

Be advised: Project Erebus involves xenobiological research of the highest sensitivity. Specific details are above your clearance level. What you need to know: the specimens are extremely dangerous. Bio-containment protocols are absolute. If containment has been breached, your primary objective shifts to data recovery. Personnel recovery becomes secondary.

Station Prometheus is located in a stable orbit around LV-178, a barren planetoid with no atmosphere. The station is self-contained with independent life support, power generation, and artificial gravity. Approach with caution. Dock at Airlock 7 — the designated emergency entry point.

One final note: Station Prometheus was conducting research that could change the future of the human species. The data is worth more than your lives. Act accordingly.

End briefing.`,
    },
    acts: [
      {
        title: 'ACT I',
        subtitle: 'THE SILENT STATION',
        readAloud: [
          `Station Prometheus hangs in the void like a steel cathedral — massive, angular, every surface bristling with antennae and sensor arrays. Through your ship's viewport, it looks intact. Running lights are dark, but the structure is whole. No visible damage. No debris field. Just... silence.`,
          `Your ship — the USCSS Vanguard — closes the distance slowly. Standard approach protocol for a station that might be hostile. Weapons systems are armed, just in case. The pilot brings you in smooth, matching rotation, and the docking clamps engage with a resonant clang that travels through both hulls.`,
          `The airlock cycles. Green light. Atmosphere on the other side is breathable — barely. It's cold. Not hull-breach cold, but the kind of cold that says the environmental systems are running on minimum power, keeping things just above freezing. Your breath clouds in the pale emergency lighting.`,
          `The first thing you notice is the quiet. A station this size should hum with life — ventilation, machinery, footsteps, voices. Prometheus is tomb-silent. The only sound is the distant, rhythmic pulse of the reactor, keeping the station alive on automatic.`,
          `The second thing you notice is the writing on the walls. Someone has used — you don't want to think about what they've used — to scrawl messages on the corridor panels. Frantic. Overlapping. In multiple hands.`,
          `"DON'T LOOK AT THE STARS." "IT SEES THROUGH THE WALLS." "LEVEL 4 IS GONE — SEALED — DO NOT OPEN." "WE WERE WRONG ABOUT EVERYTHING."`,
          `Welcome to Station Prometheus. The answers are inside. So is everything else.`,
        ],
        gmNotes: `Slow burn horror. The station is mostly intact but deeply wrong. Let players explore freely — the dread should come from what they find (and don't find). No bodies at first. Personal effects left mid-activity: half-eaten meals, running showers, open books. Then the writing on the walls. Then the barricades on Level 4. Logs reveal escalating paranoia, hallucinations, and finally violence among the crew. Something in the research affected their minds before it affected their bodies. Build toward the revelation of what Project Erebus actually was.`,
      },
      {
        title: 'ACT II',
        subtitle: 'WHAT THEY FOUND',
        readAloud: [
          `The research logs tell a story that gets worse with every entry. Project Erebus was studying a specimen recovered from LV-178's subsurface caves — something old. Impossibly old. Pre-dating human civilization by millions of years. The researchers called it "the Architect" in their notes, and the reverence in their words is unsettling.`,
          `The specimen wasn't dead. It wasn't alive either — not in any way the science team could define. It existed in a state between, and it was aware. The psychic disturbances started in week three. Dreams first — the entire crew sharing the same nightmare. Then waking visions. Then the whispers. Staff began reporting voices speaking in languages that don't exist, carrying information that shouldn't be possible.`,
          `Level 4 is where they kept it. You've found the sealed blast doors — welded shut from the outside and then barricaded. Warning signs cover every surface. But the seals are failing. You can hear sounds from beyond the doors now. Wet sounds. Organic sounds. And underneath it all, a vibration that you feel in your teeth and your sternum — a frequency that makes your vision blur and your thoughts scatter.`,
          `The station's systems are degrading. Life support failures cascade through the modules. Lights flicker. Gravity fluctuates. Something is draining the reactor, pulling power into Level 4. Your escape window is narrowing.`,
          `And then the hallucinations start. You see things in the corners of your vision. Shapes that don't belong. Crew members who aren't there — or who were there six months ago.`,
          `The station is changing. And so are you.`,
        ],
        gmNotes: `Cosmic horror escalation. The threat here is psychological as much as physical. Players should experience hallucinations (pass notes to individual players with things only they see). Trust breaks down. The "Architect" specimen is an Engineer-derived bioweapon — a psychic organism that breaks down mental barriers and transforms biological matter. Some former crew are still on the station, transformed into something between human and alien. They're not entirely hostile — some are trying to warn the players, others are part of the hive-mind. Level 4 is the heart of it all.`,
      },
      {
        title: 'ACT III',
        subtitle: 'INTO THE ABYSS',
        readAloud: [
          `Level 4. Behind the blast doors, the station has been transformed. The corridors are no longer corridors — they're arteries, lined with that dark biomechanical resin that pulses with its own heartbeat. The architecture of the station and the architecture of something alien have merged, creating a space that follows no human logic. Rooms connect in impossible ways. Gravity shifts. Your motion tracker spins uselessly.`,
          `At the center of it all, you find the Architect. It sits in what was once the primary research lab, now a cathedral of bone and resin and things that glow with their own pale light. It's not what you expected. It's worse. Beautiful and terrible, a fusion of engineer biotechnology and something older — something from before the Engineers, before anything that walked upright or looked at the stars.`,
          `It sees you. Not with eyes. It sees you the way the ocean sees a swimmer — completely, indifferently, from every direction at once. And in that moment of contact, you understand what Project Erebus found. You understand what the researchers understood in their final moments. The universe is not empty. It was never empty. And the things that live in the spaces between stars are waking up.`,
          `The reactor alarm cuts through the revelation. Critical overload. Seven minutes. The Architect doesn't care about reactors or explosions or your fragile human timeline. But you do. The data — the research — is in the lab's core storage unit. Your employers will kill to get it. It might save humanity. It might doom it.`,
          `Seven minutes. Take the data. Leave the data. Save your crew. Save yourself. The airlock is five levels up and the station is alive and it does not want you to leave.`,
          `Run.`,
        ],
        gmNotes: `The climax combines cosmic horror with a desperate escape. Level 4 is a nightmare environment — reality is unstable. The Architect is not a combat encounter; it's an environmental hazard and a philosophical crisis. Players must choose: take the data (risking contamination) or destroy it (defying their employers). The transformed crew are obstacles and tragic figures. The reactor countdown drives urgency. Escape through the mutating station is the physical challenge. Some players may choose to stay, sacrifice themselves, or succumb to the Architect's influence. Any ending should feel earned and haunted.`,
      },
    ],
    keyLocations: [
      { name: 'Airlock 7 — Docking Bay', description: 'Your entry point and escape route. The Vanguard is docked here.' },
      { name: 'Level 1 — Operations', description: 'Station command. Crew logs, comms, system controls. Signs of the crew\'s final days.' },
      { name: 'Level 2 — Habitation', description: 'Crew quarters. Abandoned mid-activity. Personal effects tell stories.' },
      { name: 'Level 3 — Medical / Labs', description: 'Research facilities. Specimen storage. Partial containment systems.' },
      { name: 'Level 4 — Primary Research', description: 'SEALED. Behind blast doors. The heart of Project Erebus. The Architect.' },
      { name: 'Reactor Core', description: 'Station power. Being drained by the organism on Level 4. Increasingly unstable.' },
      { name: 'Maintenance Tunnels', description: 'Access shafts between levels. Cramped. Dark. Things move in here.' },
    ],
    characters: ['exec-vance', 'dr-shaw-ii', 'tech-kowalski', 'marine-cross', 'synth-bishop-ii'],
  },
];
