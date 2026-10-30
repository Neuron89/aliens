/* Session recap as Markdown, built client-side from the session log
   (server/sessionLog.js entries) + table state. Pure (no DOM) except download(). */

const time = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
const ENDING_RE = /^ENDING:\s*/i;

/**
 * @param {{ title, universeName, code, players: object, table, log: object[], terms }} input
 * @returns {string} markdown
 */
export function buildRecap({ title, universeName, code, players, table, log = [], terms = {} }) {
  const out = [];
  const date = log.length ? new Date(log[0].at) : new Date();
  out.push(`# ${title || 'Session'} — recap`);
  out.push('');
  out.push(`*${universeName || ''}${universeName ? ' · ' : ''}${date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}${code ? ` · session ${code}` : ''}*`);
  out.push('');

  const crew = Object.values(players || {});
  if (crew.length) {
    out.push(`## ${terms.players ? terms.players : 'Crew'}`);
    for (const p of crew) {
      const c = p.character;
      out.push(`- **${c?.name || '(no character)'}**${c?.career ? `, ${c.career}` : ''} — played by ${p.name}${p.alive === false ? ' — *killed*' : ''}`);
    }
    out.push('');
  }

  // Scene-by-scene: a 'scene: Scene: …' or 'act' entry opens a new section.
  out.push('## Scene by scene');
  let open = false;
  const notes = [];
  const endings = [];
  for (const e of log) {
    if (e.type === 'note' && ENDING_RE.test(e.text)) { endings.push(e.text.replace(ENDING_RE, '')); continue; }
    if (e.type === 'note') notes.push(e);
    if (e.type === 'act') { out.push(''); out.push(`### ${e.text}`); open = true; continue; }
    if (e.type === 'scene' && /^Scene:/.test(e.text)) { out.push(''); out.push(`#### ${e.text.replace(/^Scene:\s*/, '')} (${time(e.at)})`); open = true; continue; }
    if (e.type === 'scene') continue; // "Scene completed" markers
    if (e.type === 'roll' || e.type === 'safety') continue;
    if (!open) { out.push(''); out.push('#### Opening'); open = true; }
    const prefix = { handout: 'Handout', clue: 'Clue', clock: 'Clock', track: '', kill: '☠', fog: 'Map', pause: 'Table', note: 'GM note', loot: 'Loot', narration: 'Narrated', character: '' }[e.type] ?? '';
    out.push(`- ${prefix ? `**${prefix}:** ` : ''}${e.text}`);
  }
  if (!log.length) out.push('- (no events logged)');
  out.push('');

  const clocks = table?.clocks || [];
  if (clocks.length) {
    out.push('## Clocks');
    for (const c of clocks) out.push(`- ${c.label}: ${c.filled}/${c.segments}${c.filled === c.segments ? ' — **full**' : ''}${c.visibility === 'gm' ? ' (GM only)' : ''}`);
    out.push('');
  }
  const clues = (table?.clues || []).filter((c) => c.status === 'revealed');
  if (clues.length) {
    out.push('## Clues found');
    for (const c of clues) out.push(`- ${c.text}`);
    out.push('');
  }
  out.push('## Endings reached');
  out.push(endings.length ? endings.map((x) => `- ${x}`).join('\n') : '- (none recorded)');
  out.push('');
  if (notes.length) {
    out.push('## GM notes');
    for (const n of notes) out.push(`- ${time(n.at)} — ${n.text}`);
    out.push('');
  }
  return out.join('\n');
}

export function downloadText(text, filename, type = 'text/markdown') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
