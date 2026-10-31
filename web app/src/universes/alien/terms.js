/* Wording used by shared engine components. */

export const terminal = {
  name: 'MU/TH/UR',
  subtitle: 'INTERFACE 2037 — Game Mother Terminal',
  statusLines: ['SYSTEMS NOMINAL', 'CREW MONITORING', 'UPLINK ACTIVE'],
  /* Boot screen (fx/BootSequence.jsx): typed one character at a time with the terminal key
     sound, a pause after each line. "…" is typed as a slow run of dots. The last line is held
     with the cursor before the app fades in. Link lines read STANDBY until the socket is up. */
  bootLines: [
    'WEYLAND-YUTANI CORP · MAINFRAME ACCESS',
    'INTERFACE 2037 … LOADED',
    'SHIP SYSTEMS CHECK …… NOMINAL',
    'LIFE SUPPORT …… NOMINAL',
    'CREW MONITORING …… ONLINE',
    'UPLINK TO GAME MOTHER …… ACTIVE',
    'READY FOR INQUIRY',
  ],
};

export const terms = {
  gm: 'Game Mother',
  gmShort: 'DM',
  player: 'Crew Member',
  players: 'Crew',
  session: 'Session',
  message: 'Transmission',
  broadcast: 'Shipwide',
  joinPrompt: 'CREW AUTHENTICATION',
  priorities: ['STANDARD', 'PRIORITY', 'EYES ONLY', 'EMERGENCY'],
  sessionArticle: 'a',
  career: 'Career',
  attributes: 'Attributes',
  skills: 'Skills',
  talent: 'Talent',
  gear: 'Gear',
};

export default terms;
