/* ═══════════════════════════════════════════════════════════════
   ASCII map parser (pure, no JSX; importable in Node for tests).

   parseAsciiMap(ascii, roomsHint) turns a box-drawing schematic
   (╔═╗║╚╝┌─┐│└┘├┤┬┴┼ …) into vector geometry for the table board:

     { cols, rows, width, height,            // grid + map units (a cell is 1 × 2 units)
       rooms:      [{ id, name, kind, hinted, shape:{type:'rect',x,y,w,h}, cells, labelLines, notes }],
       containers: [{ shape, cells, label, frame }],      // non-room boxes (zones, levels, the frame)
       corridors:  [{ x1, y1, x2, y2, style }],           // connector centrelines (normalized)
       doors:      [{ from, to, x, y }],                  // room ↔ room connections
       openings:   [{ room, x, y, side }],                // door gaps on room walls
       walls:      [{ x1, y1, x2, y2, kind }],            // room + container outlines
       textures:   [{ family, x, y, w, h }],              // ░ ▓ ≈ ∴ ▲ ━ ┄ patches
       labels:     [{ x, y, w, h, lines, caps, nearCorridor }],  // free annotations (no room)
       hull, outline, crop, spawn, unmatched: [hint names] }

   All shapes are normalized 0..1 of the grid (x = col / cols,
   y = row / rows). Boxes run from border-centre to border-centre so
   rooms that share a wall abut exactly.

   Pipeline: classify cells → find closed rectangles (nested boxes
   allowed, ±1 column jitter and small texture gaps tolerated) →
   containers vs leaf boxes → label text per box (primary lines,
   notes, [tags]) → free text blocks → fuzzy-match labels to the
   hinted room names (IDF-weighted token overlap + prefixes +
   abbreviations, edit-distance fallback) → split boxes whose [tags]
   matched other hints → free-text rooms (grown over adjacent
   texture) → connector components → corridors/doors → hull.
   ═══════════════════════════════════════════════════════════════ */

const N = 1, E = 2, S = 4, W = 8;
const LINE = new Map();
const DOUBLE = new Set();
function def(chars, mask, dbl = false) { for (const ch of chars) { LINE.set(ch, mask); if (dbl) DOUBLE.add(ch); } }
def('─', E | W); def('│┃', N | S);
def('═', E | W, true); def('║', N | S, true);
def('┌┏╭', E | S); def('┐┓╮', W | S); def('└┗╰', N | E); def('┘┛╯', N | W);
def('╔╒╓', E | S, true); def('╗╕╖', W | S, true); def('╚╘╙', N | E, true); def('╝╛╜', N | W, true);
def('├┣', N | S | E); def('┤┫', N | S | W); def('┬┳', E | W | S); def('┴┻', E | W | N); def('┼╋', N | E | S | W);
def('╠╞╟', N | S | E, true); def('╣╡╢', N | S | W, true); def('╦╤╥', E | W | S, true); def('╩╧╨', E | W | N, true); def('╬╪╫', N | E | S | W, true);

/* Texture families: drawn as patches, never walls. */
const TEXTURE = new Map();
for (const [fam, chars] of Object.entries({
  organic: '░▒', solid: '▓█', water: '≈~', sand: '∴', rock: '▲', fence: '━', dash: '┄┈╌┅┉╍┊┆╎┋┇╏',
})) for (const ch of chars) TEXTURE.set(ch, fam);

const DX = { [N]: 0, [E]: 1, [S]: 0, [W]: -1 };
const DY = { [N]: -1, [E]: 0, [S]: 1, [W]: 0 };
const OPP = { [N]: S, [S]: N, [E]: W, [W]: E };
const DIRS = [N, E, S, W];

const STOP = new Set(['the', 'of', 'and', 'to', 'at', 'in', 'on', 'for', 'with', 'by']);
const CANON = {
  qtr: 'quarters', qtrs: 'quarters', qrtrs: 'quarters', comms: 'communications', comm: 'communications', coms: 'communications',
  ops: 'operations', med: 'medical', medic: 'medical', specimn: 'specimen', specimens: 'specimen', wpn: 'weapon', wpns: 'weapon',
  lckr: 'locker', rm: 'room', maint: 'maintenance', labs: 'lab', laboratory: 'lab', rec: 'recreation', thopter: 'ornithopter',
  'thopters': 'ornithopter', hydro: 'hydroponics', engr: 'engineering', eng: 'engine', stor: 'storage', sto: 'storage',
  qtrmaster: 'quartermaster', hq: 'headquarters', admin: 'administration', apts: 'apartments', hab: 'habitat', habs: 'habitat',
};

/* ─── small helpers ─────────────────────────────────────────── */

export const kebab = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'room';

export function hashString(s) {
  let h = 2166136261;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

export function tokenize(s) {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[’']/g, '').split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)).map((t) => CANON[t] || t);
}

function tokMatch(a, b) {
  if (a === b) return true;
  const m = Math.min(a.length, b.length);
  if (m >= 3 && (a.startsWith(b) || b.startsWith(a))) return true;
  if (m >= 5 && (a.endsWith(b) || b.endsWith(a))) return true;
  let p = 0;
  while (p < m && a[p] === b[p]) p++;
  return p >= 4 && p >= m - 1;
}

function lev(a, b) {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}
const compact = (s) => String(s || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');

const r4 = (n) => Math.round(n * 1e4) / 1e4;

/* ─── grid ──────────────────────────────────────────────────── */

export function buildGrid(ascii) {
  let lines = String(ascii || '').replace(/\r/g, '').replace(/\t/g, '    ').split('\n').map((l) => l.replace(/\s+$/, ''));
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  // two blank rows below the art: room for the compass / scale strip inside the board crop
  lines.push('', '');
  lines.unshift(''); // and one above, so the hull outline never touches the crop edge
  lines = lines.map((l) => (l ? `  ${l}` : l)); // two blank columns on the left (and on the right, below)
  const rows = lines.length;
  const cols = Math.max(1, ...lines.map((l) => [...l].length)) + 2;
  const ch = lines.map((l) => { const a = [...l]; while (a.length < cols) a.push(' '); return a; });
  const at = (r, c) => (r >= 0 && r < rows && c >= 0 && c < cols ? ch[r][c] : ' ');
  const mask = (r, c) => LINE.get(at(r, c)) || 0;
  const texture = (r, c) => {
    const x = at(r, c);
    if (TEXTURE.has(x)) return TEXTURE.get(x);
    if (x === '.') {
      const l = at(r, c - 1); const rr = at(r, c + 1);
      if (!/[A-Za-z0-9]/.test(l) && !/[A-Za-z0-9]/.test(rr)) return 'dots';
    }
    return null;
  };
  const isText = (r, c) => { const x = at(r, c); return x !== ' ' && !LINE.has(x) && !texture(r, c); };
  return { rows, cols, ch, at, mask, texture, isText };
}

/* ─── rectangle detection ───────────────────────────────────── */

const has = (m, d) => (m & d) === d;

export function findRects(G) {
  const { rows, cols, mask, at } = G;
  const rects = [];
  const gapOk = (r, c) => { const x = at(r, c); return !/[A-Za-z0-9]/.test(x); };
  // vertical edge cell ok at column c (±1 jitter), else a non-alnum gap
  const vEdge = (r, c) => {
    if (has(mask(r, c), N | S)) return 'line';
    if (has(mask(r, c - 1), N | S) || has(mask(r, c + 1), N | S)) return 'jitter';
    if (has(mask(r, c - 2), N | S) || has(mask(r, c + 2), N | S)) return 'jitter2';
    return gapOk(r, c) ? 'gap' : 'bad';
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tl = mask(r, c);
      if (!has(tl, E | S)) continue;
      let found = null;
      for (let c2 = c + 1; c2 < cols && !found; c2++) {
        const m = mask(r, c2);
        if (!has(m, W)) break;
        if (has(m, S) && c2 - c >= 2) {
          for (let r2 = r + 1; r2 < rows; r2++) {
            const lm = mask(r2, c);
            let bl = -1;
            if (has(lm, N | E)) bl = c;
            else if (!has(lm, N)) { for (const cc of [c - 1, c + 1]) if (has(mask(r2, cc), N | E)) bl = cc; if (bl < 0) break; }
            if (bl >= 0 && r2 - r >= 2) {
              // bottom edge → bottom-right corner at c2 (±1)
              let br = -1;
              for (const cc of [c2, c2 - 1, c2 + 1]) { if (has(mask(r2, cc), N | W)) { br = cc; break; } }
              if (br > c) {
                let gaps = 0; let ok = true;
                for (let x = bl + 1; x < br; x++) {
                  if (!has(mask(r2, x), E | W)) { if (gapOk(r2, x) && at(r2, x) !== ' ') gaps++; else { ok = false; break; } }
                }
                if (ok && gaps <= Math.max(1, Math.floor((br - c) / 4))) {
                  let vg = 0; let bad = false; let j2 = 0;
                  for (let y = r + 1; y < r2; y++) {
                    const k = vEdge(y, c2);
                    if (k === 'bad') { bad = true; break; }
                    if (k === 'gap') vg++;
                    if (k === 'jitter2') j2++;
                  }
                  if (!bad && vg + j2 * 0 <= Math.max(1, Math.floor((r2 - r - 1) * 0.5))) { found = { r0: r, c0: c, r1: r2, c1: c2 }; break; }
                }
              }
            }
            if (!has(lm, S)) break;
          }
        }
        if (!has(m, E)) break;
      }
      if (found) rects.push(found);
    }
  }
  // Drop rects that partially overlap another (bogus loops through corridors): keep the smaller.
  const area = (q) => (q.r1 - q.r0) * (q.c1 - q.c0);
  const inside = (a, b) => a.r0 >= b.r0 && a.r1 <= b.r1 && a.c0 >= b.c0 && a.c1 <= b.c1;
  const crosses = (a, b) => {
    const ir0 = Math.max(a.r0, b.r0); const ir1 = Math.min(a.r1, b.r1);
    const ic0 = Math.max(a.c0, b.c0); const ic1 = Math.min(a.c1, b.c1);
    if (ir1 - ir0 <= 0 || ic1 - ic0 <= 0) return false; // disjoint or sharing an edge
    return !inside(a, b) && !inside(b, a);
  };
  const sorted = [...rects].sort((a, b) => area(a) - area(b));
  const kept = [];
  for (const q of sorted) if (!kept.some((k) => crosses(q, k))) kept.push(q);
  return kept;
}

/* ─── text ──────────────────────────────────────────────────── */

const cleanText = (s) => s.replace(/[░▒▓█≈∴▲▼━┄┈╌┅┉╍┊┆╎┋┇╏]/g, ' ').replace(/\s+/g, ' ').trim();
const hasLetter = (s) => /[A-Za-z]/.test(s);
const isCapsLine = (s) => hasLetter(s) && !/[a-z]/.test(s) && !/^[[(]/.test(s);

/** Split label lines into primary (leading caps lines, hyphen-joined) and notes. */
function splitLabel(linesIn) {
  const primary = [];
  // "COLONNADE  (shield-door every 10 m)" → caps name + a note line
  const lines = [];
  for (const l of linesIn) {
    const m = /^([^[(]*?[A-Z][^[(]*?)\s*([[(].*)$/.exec(l.text);
    if (m && isCapsLine(m[1].trim()) && /[a-z]/.test(m[2]) && m[1].replace(/[^A-Za-z]/g, '').length >= 2) {
      lines.push({ ...l, text: m[1].trim() }, { ...l, text: m[2].trim(), split: true });
    } else lines.push(l);
  }
  let i = 0;
  while (i < lines.length && primary.length < 5 && isCapsLine(lines[i].text)) {
    let t = lines[i].text;
    while (/[A-Z]-$/.test(t) && i + 1 < lines.length && isCapsLine(lines[i + 1].text)) { t = t.slice(0, -1) + lines[i + 1].text; i++; }
    // strip trailing [tags] / (parens) from a caps line for the name, keep them in notes
    primary.push(t);
    i++;
  }
  const notes = lines.slice(i).map((l) => l.text);
  return { primary, notes };
}

/* ─── main ──────────────────────────────────────────────────── */

export function parseAsciiMap(ascii, roomsHint = []) {
  const G = buildGrid(ascii);
  const { rows, cols, at, mask, texture, isText } = G;
  const nx = (c) => r4(Math.min(1, Math.max(0, c / cols)));
  const ny = (r) => r4(Math.min(1, Math.max(0, r / rows)));
  const boxShape = (q) => ({ type: 'rect', x: nx(q.c0 + 0.5), y: ny(q.r0 + 0.5), w: r4((q.c1 - q.c0) / cols), h: r4((q.r1 - q.r0) / rows) });
  const cellShape = (q) => ({ type: 'rect', x: nx(q.c0), y: ny(q.r0), w: r4((q.c1 - q.c0 + 1) / cols), h: r4((q.r1 - q.r0 + 1) / rows) });

  /* 1. Rectangles + nesting. */
  const rects = findRects(G).map((q, i) => ({ ...q, i, children: [], parent: null }));
  const contains = (a, b) => a !== b && b.r0 >= a.r0 && b.r1 <= a.r1 && b.c0 >= a.c0 && b.c1 <= a.c1;
  const byArea = [...rects].sort((a, b) => (a.r1 - a.r0) * (a.c1 - a.c0) - (b.r1 - b.r0) * (b.c1 - b.c0));
  for (const q of byArea) {
    const p = byArea.find((o) => contains(o, q) && (o.r1 - o.r0) * (o.c1 - o.c0) > (q.r1 - q.r0) * (q.c1 - q.c0));
    if (p) { q.parent = p; p.children.push(q); }
  }
  const borderSet = new Map(); // "r,c" -> [rect]
  const addB = (r, c, q) => { const k = `${r},${c}`; const a = borderSet.get(k); if (a) { if (!a.includes(q)) a.push(q); } else borderSet.set(k, [q]); };
  for (const q of rects) {
    for (let c = q.c0; c <= q.c1; c++) { addB(q.r0, c, q); addB(q.r1, c, q); }
    for (let r = q.r0; r <= q.r1; r++) {
      addB(r, q.c0, q);
      // right edge with jitter: register the actual line cell in that row
      let c = q.c1;
      if (!(has(mask(r, q.c1), N | S) || r === q.r0 || r === q.r1)) {
        for (const cc of [q.c1 - 1, q.c1 + 1, q.c1 - 2, q.c1 + 2]) if (has(mask(r, cc), N | S)) { c = cc; break; }
      }
      addB(r, c, q);
      if (r === q.r1) {
        for (const cc of [q.c1 - 1, q.c1 + 1]) if (has(mask(r, cc), N | W)) addB(r, cc, q);
        for (const cc of [q.c0 - 1, q.c0 + 1]) if (has(mask(r, cc), N | E)) addB(r, cc, q); // bottom-left corner a column off
      }
    }
  }
  const isBorder = (r, c) => borderSet.has(`${r},${c}`);
  /* smallest rect whose interior holds (r,c) */
  const ownerOf = (r, c) => {
    let best = null;
    for (const q of byArea) if (r > q.r0 && r < q.r1 && c > q.c0 && c < q.c1 && !isBorder(r, c)) { best = q; break; }
    return best;
  };
  const nContained = (q) => rects.filter((o) => contains(q, o)).length;
  const frame = rects.length > 1 ? [...rects].sort((a, b) => nContained(b) - nContained(a))[0] : null;
  function rectsOverlap(a, b) { return Math.min(a.r1, b.r1) > Math.max(a.r0, b.r0) && Math.min(a.c1, b.c1) > Math.max(a.c0, b.c0); }
  // A frame must contain most other rects.
  const frameRect = frame && rects.filter((o) => contains(frame, o)).length >= Math.max(1, rects.length - 2) ? frame : null;

  /* 2. Text runs per cell owner (gap ≤ 2 spaces joins words). */
  const runs = [];
  for (let r = 0; r < rows; r++) {
    let cur = null;
    for (let c = 0; c <= cols; c++) {
      const t = c < cols && isText(r, c) && !isBorder(r, c);
      const owner = t ? ownerOf(r, c) : null;
      if (t) {
        if (cur && cur.owner === owner && c - cur.c1 <= 3) { cur.c1 = c; continue; }
        if (cur) runs.push(cur);
        cur = { r, c0: c, c1: c, owner };
        continue;
      }
      if (cur && (c >= cols || at(r, c) !== ' ' || c - cur.c1 >= 3)) { runs.push(cur); cur = null; }
    }
  }
  for (const u of runs) {
    u.raw = G.ch[u.r].slice(u.c0, u.c1 + 1).join('');
    u.text = cleanText(u.raw);
  }
  const textRuns = runs.filter((u) => u.text && /[A-Za-z0-9]/.test(u.text));

  /* 3. Per-rect label lines (rows inside, outside children). */
  for (const q of rects) {
    const own = textRuns.filter((u) => u.owner === q).sort((a, b) => a.r - b.r || a.c0 - b.c0);
    const byRow = new Map();
    for (const u of own) { if (!byRow.has(u.r)) byRow.set(u.r, []); byRow.get(u.r).push(u); }
    q.lines = [...byRow.entries()].map(([r, us]) => ({ r, c0: us[0].c0, c1: us[us.length - 1].c1, runs: us, text: us.map((u) => u.text).join(' ') }));
  }

  /* 4. Free text blocks: runs owned by no leaf box, grouped vertically. */
  const isLeaf = (q) => q.children.length === 0;
  const blocks = [];
  const loose = textRuns.filter((u) => !u.owner || !isLeaf(u.owner)).sort((a, b) => a.r - b.r || a.c0 - b.c0);
  for (const u of loose) {
    const b = blocks.find((k) => k.owner === u.owner && k.r1 === u.r - 1 && k.lastRuns.some((v) => v.c0 <= u.c1 + 1 && u.c0 <= v.c1 + 1));
    if (b) { b.runs.push(u); b.r1 = u.r; b.c0 = Math.min(b.c0, u.c0); b.c1 = Math.max(b.c1, u.c1); b.lastRuns = [u]; b.rowsMap.set(u.r, [...(b.rowsMap.get(u.r) || []), u]); continue; }
    const same = blocks.find((k) => k.owner === u.owner && k.r1 === u.r && k.lastRuns.length && Math.abs(k.lastRuns[k.lastRuns.length - 1].c1 - u.c0) <= 3);
    if (same) { same.runs.push(u); same.c1 = Math.max(same.c1, u.c1); same.lastRuns.push(u); continue; }
    blocks.push({ owner: u.owner, r0: u.r, r1: u.r, c0: u.c0, c1: u.c1, runs: [u], lastRuns: [u], rowsMap: new Map([[u.r, [u]]]) });
  }
  for (const b of blocks) {
    const rowsOf = new Map();
    for (const u of b.runs) { if (!rowsOf.has(u.r)) rowsOf.set(u.r, []); rowsOf.get(u.r).push(u); }
    b.lines = [...rowsOf.entries()].sort((x, y) => x[0] - y[0]).map(([r, us]) => ({ r, text: us.map((u) => u.text).join(' ') }));
  }
  // container head blocks
  for (const q of rects) {
    if (isLeaf(q) || q === frameRect) continue;
    const head = blocks.filter((b) => b.owner === q && b.r0 <= q.r0 + 2).sort((a, b) => a.r0 - b.r0 || a.c0 - b.c0)[0];
    if (head) { head.head = q; q.head = head; }
  }

  /* 5. Hints + IDF weights. */
  const hints = (Array.isArray(roomsHint) ? roomsHint : []).filter((h) => h && h.name).map((h, i) => ({
    i, name: String(h.name), id: h.id || null, note: h.note || '', tokens: [...new Set(tokenize(h.name))], compact: compact(h.name),
  }));
  const df = new Map();
  for (const h of hints) for (const t of h.tokens) df.set(t, (df.get(t) || 0) + 1);
  const NH = Math.max(1, hints.length);
  const wt = (t) => 1 + Math.log(NH / (df.get(t) || 1));
  function score(candTokens, hint, focusTokens = null, candCompact = '') {
    if (!hint.tokens.length) return 0;
    const ct = candTokens;
    let mw = 0; let tw = 0;
    for (const t of hint.tokens) { const w = wt(t); tw += w; if (ct.some((c) => tokMatch(c, t))) mw += w; }
    const h = tw ? mw / tw : 0;
    const base = focusTokens || ct;
    const lm = base.filter((c) => hint.tokens.some((t) => tokMatch(c, t))).length;
    if (focusTokens && !lm) return 0;
    const l = base.length ? lm / base.length : 0;
    let s = h >= 0.3 ? 0.6 * h + 0.4 * l : 0;
    if (candCompact && hint.compact.length >= 4) {
      const d = lev(candCompact, hint.compact);
      const ratio = 1 - d / Math.max(candCompact.length, hint.compact.length);
      if (ratio >= 0.84) s = Math.max(s, 0.6 + 0.35 * ratio);
    }
    return s;
  }

  /* 6. Candidates. */
  const cands = [];
  for (const q of rects) {
    if (isLeaf(q)) {
      const { primary, notes } = splitLabel(q.lines);
      q.primary = primary;
      q.notes = notes;
      const ptxt = primary.length ? primary.join(' ') : (q.lines[0]?.text || '');
      q.label = ptxt;
      if (ptxt) cands.push({ type: 'box', rect: q, tokens: tokenize(ptxt), compact: compact(ptxt), mult: 1 });
      // [tags] in non-primary rows
      const primaryRows = new Set(q.lines.slice(0, primary.length).map((l) => l.r));
      for (const line of q.lines) {
        if (primaryRows.has(line.r) && primary.length) {
          // tags may also sit on a caps line, e.g. "[OPS] [BRIG]" is not caps-only; skip pure name rows
          if (!/\[/.test(line.text)) continue;
        }
        const rowStr = G.ch[line.r].join('');
        const re = /\[([^\]]*)\]?/g;
        let m;
        while ((m = re.exec(rowStr))) {
          if (m.index <= q.c0 || m.index >= q.c1) continue;
          const txt = cleanText(m[1]);
          if (!txt || !hasLetter(txt)) continue;
          const tt = tokenize(txt);
          if (!tt.length) continue;
          cands.push({ type: 'tag', rect: q, row: line.r, c0: m.index, c1: Math.min(q.c1 - 1, m.index + m[0].length - 1), text: txt, tokens: [...new Set([...tokenize(ptxt), ...tt])], focus: tt, mult: 1 });
        }
      }
    }
  }
  for (const b of blocks) {
    const { primary } = splitLabel(b.lines);
    const ptxt = (primary.length ? primary.join(' ') : b.lines.map((l) => l.text).join(' ')).replace(/[[\]]/g, ' ');
    b.primary = primary;
    b.label = ptxt;
    if (b.head) {
      if (b.head !== frameRect) cands.push({ type: 'container', rect: b.head, block: b, tokens: tokenize(ptxt), compact: compact(ptxt), mult: 0.92 });
      continue;
    }
    cands.push({ type: 'free', block: b, tokens: tokenize(ptxt), compact: compact(ptxt), mult: 0.9 });
    // every caps run on its own ("├── WATCH GALLERY ── lookouts" sits in a block with its notes)
    if (b.runs.length > 1) {
      for (const u of b.runs) {
        const t = u.text.replace(/[[\]]/g, ' ').trim();
        if (!isCapsLine(t) || t.replace(/[^A-Za-z]/g, '').length < 4) continue;
        const sub = { owner: b.owner, r0: u.r, r1: u.r, c0: u.c0, c1: u.c1, runs: [u], lines: [{ r: u.r, text: t }], primary: [t], label: t, parentBlock: b };
        cands.push({ type: 'free', block: sub, tokens: tokenize(t), compact: compact(t), mult: 0.86 });
      }
    }
    // the bracketed / caps first line alone (e.g. "[MINE ENTRANCE ALPHA]" over "(3km north)")
    if (b.lines.length > 1) {
      const first = b.lines[0].text.replace(/[[\]]/g, ' ');
      cands.push({ type: 'free', block: b, tokens: tokenize(first), compact: compact(first), mult: 0.88 });
    }
  }

  /* 7. Greedy one-to-one assignment (tags of one box row may share a hint). */
  const triples = [];
  for (const cd of cands) {
    for (const h of hints) {
      const s = score(cd.tokens, h, cd.focus || null, cd.type === 'tag' ? '' : cd.compact) * cd.mult;
      if (s >= 0.5) triples.push({ cd, h, s });
    }
  }
  const typeRank = { tag: 0, box: 1, container: 2, free: 3 };
  triples.sort((a, b) => b.s - a.s || typeRank[a.cd.type] - typeRank[b.cd.type] || a.h.i - b.h.i);
  const hintOwner = new Map(); // hint.i -> cand
  const candHint = new Map();
  const usedBlocks = new Set();
  const usedRects = new Set();
  for (const { cd, h } of triples) {
    if (candHint.has(cd)) continue;
    if (cd.block && usedBlocks.has(cd.block)) continue;
    if ((cd.type === 'box' || cd.type === 'container') && usedRects.has(cd.rect)) continue;
    const prev = hintOwner.get(h.i);
    if (prev) {
      const share = prev.type === 'tag' && cd.type === 'tag' && prev.rect === cd.rect && prev.row === cd.row;
      if (!share) continue;
    } else hintOwner.set(h.i, cd);
    candHint.set(cd, h);
    if (cd.block) usedBlocks.add(cd.block);
    if (cd.type === 'box' || cd.type === 'container') usedRects.add(cd.rect);
  }

  /* 7b. Corrections: a container never keeps a hint one of its own boxes can take
     ("LEVEL 3 — MEDICAL/LABS" vs the "LABS A & B" box), and a free caption sitting right
     above/below an unmatched box names that box ("[ATMOSPHERIC PROCESSOR]" over its plant). */
  const boxCand = new Map(cands.filter((c) => c.type === 'box').map((c) => [c.rect, c]));
  const tagged = new Set([...candHint.keys()].filter((c) => c.type === 'tag').map((c) => c.rect));
  const reassign = (from, to, h) => {
    candHint.delete(from);
    if (from.type === 'box' || from.type === 'container') usedRects.delete(from.rect);
    if (from.block) usedBlocks.delete(from.block);
    candHint.set(to, h); hintOwner.set(h.i, to);
    if (to.type === 'box' || to.type === 'container') usedRects.add(to.rect);
  };
  for (const [cd, h] of [...candHint]) {
    if (cd.type !== 'container') continue;
    let best = null; let bs = 0;
    for (const kid of cd.rect.children) {
      const kc = boxCand.get(kid);
      if (!kc || usedRects.has(kid) || tagged.has(kid)) continue;
      const sc = score(kc.tokens, h, null, kc.compact);
      if (sc >= 0.3 && sc > bs) { best = kc; bs = sc; }
    }
    if (best) reassign(cd, best, h);
  }
  for (const [cd, h] of [...candHint]) {
    if (cd.type !== 'free') continue;
    const b = cd.block;
    const q = rects.find((o) => isLeaf(o) && !usedRects.has(o) && !tagged.has(o) && boxCand.has(o)
      && ((o.r0 - b.r0 >= 1 && o.r0 - b.r0 <= 2) || (b.r0 - o.r1 >= 1 && b.r0 - o.r1 <= 2))
      && o.c0 <= b.c1 + 1 && b.c0 <= o.c1 + 1
      && boxCand.get(o).tokens.some((t) => h.tokens.some((u) => tokMatch(t, u))));
    if (q) { reassign(cd, boxCand.get(q), h); b.caption = q; b.room = true; for (const u of b.runs) u.used = true; }
  }

  /* 8. Rooms. */
  const rooms = [];
  const usedIds = new Set();
  const uniq = (id) => { let k = id; let n = 2; while (usedIds.has(k)) k = `${id}-${n++}`; usedIds.add(k); return k; };
  for (const h of hints) if (h.id) usedIds.add(h.id);
  const hintId = new Map();
  for (const h of hints) hintId.set(h.i, h.id || null);
  const idForHint = (h) => { if (!hintId.get(h.i)) hintId.set(h.i, uniq(kebab(h.name))); return hintId.get(h.i); };
  const tidy = (lines) => lines.map((t) => t.replace(/\s+/g, ' ').trim()).filter((t) => t && /[A-Za-z0-9]/.test(t));

  const tagsByRect = new Map();
  for (const [cd, h] of candHint) if (cd.type === 'tag') { if (!tagsByRect.has(cd.rect)) tagsByRect.set(cd.rect, []); tagsByRect.get(cd.rect).push({ cd, h }); }
  const boxHint = new Map();
  for (const [cd, h] of candHint) if (cd.type === 'box' || cd.type === 'container') boxHint.set(cd.rect, h);

  const pushRoom = (room) => { rooms.push(room); return room; };
  const leafTitleBand = (q) => {
    // an unmatched leaf stacked on a container with the same left/right edges (frame title band), or a full-width top band
    if (rects.some((o) => o !== q && !isLeaf(o) && Math.abs(o.c0 - q.c0) <= 1 && Math.abs(o.c1 - q.c1) <= 1 && (o.r0 === q.r1 || o.r1 === q.r0))) return true;
    return q.r0 <= 1 && (q.c1 - q.c0) >= cols * 0.8;
  };

  for (const q of rects) {
    const h = boxHint.get(q);
    const tags = tagsByRect.get(q);
    if (isLeaf(q) && tags?.length) {
      // split the box into bands per tag row; tags on one row split horizontally
      const tagRows = [...new Set(tags.map((t) => t.cd.row))].sort((a, b) => a - b);
      const bands = [];
      const firstInner = q.r0 + 1;
      if (h && tagRows[0] > firstInner) bands.push({ start: q.r0, hint: h, row: null });
      tagRows.forEach((row, k) => bands.push({ start: k === 0 && !(h && tagRows[0] > firstInner) ? q.r0 : row, row }));
      for (let k = 0; k < bands.length; k++) {
        const b = bands[k];
        const top = b.start === q.r0 ? q.r0 + 0.5 : b.start;
        const bottom = k + 1 < bands.length ? bands[k + 1].start : q.r1 + 0.5;
        if (b.hint) {
          pushRoom({ id: idForHint(b.hint), name: b.hint.name, kind: 'box', hinted: true, hintIndex: b.hint.i,
            shape: { type: 'rect', x: nx(q.c0 + 0.5), y: ny(top), w: r4((q.c1 - q.c0) / cols), h: r4((bottom - top) / rows) },
            cells: { r0: q.r0, c0: q.c0, r1: Math.ceil(bottom) - 1, c1: q.c1 }, labelLines: tidy(q.primary || []), notes: [], rect: q.i });
          continue;
        }
        const rowTags = tags.filter((t) => t.cd.row === b.row).sort((a, z) => a.cd.c0 - z.cd.c0);
        const groups = [];
        for (const t of rowTags) {
          const g = groups[groups.length - 1];
          if (g && g.h === t.h) { g.c1 = t.cd.c1; g.texts.push(t.cd.text); } else groups.push({ h: t.h, c0: t.cd.c0, c1: t.cd.c1, texts: [t.cd.text] });
        }
        groups.forEach((g, gi) => {
          const left = gi === 0 ? q.c0 + 0.5 : (groups[gi - 1].c1 + 1 + g.c0) / 2;
          const right = gi === groups.length - 1 ? q.c1 + 0.5 : (g.c1 + 1 + groups[gi + 1].c0) / 2;
          const lines = k === 0 && !h ? [...(q.primary || []), g.texts.join(' · ')] : [g.texts.join(' · ')];
          pushRoom({ id: idForHint(g.h), name: g.h.name, kind: 'tag', hinted: true, hintIndex: g.h.i,
            shape: { type: 'rect', x: nx(left), y: ny(top), w: r4((right - left) / cols), h: r4((bottom - top) / rows) },
            cells: { r0: Math.floor(top), c0: Math.floor(left), r1: Math.ceil(bottom) - 1, c1: Math.ceil(right) - 1 }, labelLines: tidy(lines), notes: [], rect: q.i });
        });
      }
      q.room = 'split';
      continue;
    }
    if (h) {
      const prim = isLeaf(q) ? [...(q.primary || [])] : (q.head ? [...(q.head.primary.length ? q.head.primary : [q.head.lines[0].text])] : []);
      const lines = isLeaf(q) ? [...(q.notes || [])] : (q.head ? q.head.lines.slice(prim.length).map((l) => l.text) : []);
      // a matched container with exactly one unmatched leaf child absorbs it
      if (!isLeaf(q)) {
        const kids = q.children.filter((k) => !boxHint.has(k) && !tagsByRect.has(k));
        if (kids.length === 1 && q.children.length === 1 && isLeaf(kids[0])) { kids[0].absorbed = true; lines.push(...kids[0].lines.map((l) => l.text)); }
      }
      q.room = pushRoom({ id: idForHint(h), name: h.name, kind: isLeaf(q) ? 'box' : 'container', hinted: true, hintIndex: h.i,
        shape: boxShape(q), cells: { r0: q.r0, c0: q.c0, r1: q.r1, c1: q.c1 }, labelLines: tidy(prim), notes: tidy(lines), rect: q.i });
      continue;
    }
  }
  // unmatched leaf boxes with a label become rooms of their own
  for (const q of rects) {
    if (!isLeaf(q) || q.room || q.absorbed || boxHint.has(q)) continue;
    if (!q.label || !hasLetter(q.label) || leafTitleBand(q)) continue;
    const name = q.label.replace(/\s+/g, ' ').trim().slice(0, 60);
    q.room = pushRoom({ id: uniq(kebab(name)), name, kind: 'box', hinted: false, shape: boxShape(q), cells: { r0: q.r0, c0: q.c0, r1: q.r1, c1: q.c1 },
      labelLines: tidy((q.primary.length ? q.primary : [q.lines[0]?.text || '']).slice(0, 2)), notes: tidy(q.primary.length ? q.notes : q.lines.slice(1).map((l) => l.text)), rect: q.i });
  }

  /* 9. Free-text rooms (labels outside boxes): grow over adjacent texture, never over a box room. */
  const boxRoomRects = () => rooms.map((rm) => rm.shape);
  const overlapsRooms = (sh) => boxRoomRects().some((o) => Math.min(sh.x + sh.w, o.x + o.w) - Math.max(sh.x, o.x) > 1e-3 && Math.min(sh.y + sh.h, o.y + o.h) - Math.max(sh.y, o.y) > 1e-3);
  const scopeOf = (b) => b.owner || null;
  const inScope = (b, r, c) => {
    const o = ownerOf(r, c);
    if (o && isLeaf(o) && o.room) return false;
    if (!b.owner) return true;
    return r > b.owner.r0 && r < b.owner.r1 && c > b.owner.c0 && c < b.owner.c1;
  };
  const freeRegions = [];
  for (const [cd, h] of candHint) {
    if (cd.type !== 'free') continue;
    const b = cd.block;
    const bb = { r0: b.r0, c0: b.c0, r1: b.r1, c1: b.c1 };
    let shape = null;
    // a) bracketed by horizontal connector lines just above and below (a promenade / concourse)
    const hRun = (r) => {
      let best = null;
      for (let c = 0; c < cols; c++) {
        if (!has(mask(r, c), E | W) || isBorder(r, c)) continue;
        let c1 = c; while (c1 + 1 < cols && has(mask(r, c1 + 1), W)) c1++;
        if (c <= b.c1 && c1 >= b.c0 && (!best || c1 - c > best[1] - best[0])) best = [c, c1];
        c = c1;
      }
      return best;
    };
    const above = hRun(b.r0 - 1); const below = hRun(b.r1 + 1);
    if (above && below) {
      const c0 = Math.max(above[0], below[0]); const c1 = Math.min(above[1], below[1]);
      if (c1 - c0 >= (b.c1 - b.c0) * 0.6) {
        const sh = { type: 'rect', x: nx(c0), y: ny(b.r0 - 0.5), w: r4((c1 - c0 + 1) / cols), h: r4((b.r1 - b.r0 + 2) / rows) };
        if (!overlapsRooms(sh)) shape = sh;
      }
    }
    // b) texture growth
    if (!shape) {
      const fams = new Map();
      for (let r = b.r0 - 1; r <= b.r1 + 1; r++) for (let c = b.c0 - 2; c <= b.c1 + 2; c++) { const f = texture(r, c); if (f && f !== 'dots') fams.set(f, (fams.get(f) || 0) + 1); }
      const fam = [...fams.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
      if (fam) {
        const grow = (rowLimit) => {
          const seen = new Set(); const q = [];
          for (let r = b.r0 - 1; r <= b.r1 + 1; r++) for (let c = b.c0 - 2; c <= b.c1 + 2; c++) if (texture(r, c) === fam && inScope(b, r, c)) { seen.add(`${r},${c}`); q.push([r, c]); }
          const g = { ...bb };
          while (q.length) {
            const [r, c] = q.pop();
            g.r0 = Math.min(g.r0, r); g.r1 = Math.max(g.r1, r); g.c0 = Math.min(g.c0, c); g.c1 = Math.max(g.c1, c);
            for (let dy = -1; dy <= 1; dy++) for (let dx = -3; dx <= 3; dx++) {
              if (Math.abs(dx) > 1 && dy !== 0) continue;
              const rr = r + dy; const cc = c + dx;
              if (rowLimit && (rr < b.r0 - rowLimit || rr > b.r1 + rowLimit)) continue;
              const k = `${rr},${cc}`;
              if (seen.has(k) || texture(rr, cc) !== fam || !inScope(b, rr, cc)) continue;
              seen.add(k); q.push([rr, cc]);
            }
          }
          return g;
        };
        for (const lim of [0, 1]) {
          const g = grow(lim === 0 ? 0 : 0.0001);
          const sh = cellShape(g);
          if (sh.w * sh.h <= 0.3 && !overlapsRooms(sh)) { shape = sh; break; }
          if (lim === 0) {
            // retry restricted to the label's own rows
            const g2 = grow(0); g2.r0 = b.r0; g2.r1 = b.r1;
            const sh2 = cellShape(g2);
            if (sh2.w * sh2.h <= 0.3 && !overlapsRooms(sh2)) { shape = sh2; break; }
          }
        }
      }
    }
    // c) the label block itself (padded half a cell sideways)
    if (!shape) {
      const sh = { type: 'rect', x: nx(b.c0 - 0.5), y: ny(b.r0), w: r4((b.c1 - b.c0 + 2) / cols), h: r4((b.r1 - b.r0 + 1) / rows) };
      shape = overlapsRooms(sh) ? cellShape(bb) : sh;
    }
    const room = pushRoom({ id: idForHint(h), name: h.name, kind: 'free', hinted: true, hintIndex: h.i, shape,
      cells: { r0: Math.floor(shape.y * rows), c0: Math.floor(shape.x * cols), r1: Math.ceil((shape.y + shape.h) * rows) - 1, c1: Math.ceil((shape.x + shape.w) * cols) - 1 },
      labelLines: tidy(b.primary.length ? b.primary : [b.lines[0].text]), notes: tidy(b.lines.slice(Math.max(1, b.primary.length)).map((l) => l.text)), block: true });
    b.room = room;
    for (const u of b.runs) u.used = true;
    freeRegions.push(room);
  }

  /* 10. Connector components → corridors, openings, doors. */
  const roomOfRect = (q) => (q?.room && q.room !== 'split' ? q.room : null);
  const comp = new Map(); // "r,c" -> component index
  const comps = [];
  const isConn = (r, c) => !!mask(r, c) && !isBorder(r, c);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!isConn(r, c) || comp.has(`${r},${c}`)) continue;
    const k = comps.length; const cells = []; const stack = [[r, c]];
    comp.set(`${r},${c}`, k);
    while (stack.length) {
      const [y, x] = stack.pop(); cells.push([y, x]);
      const m = mask(y, x);
      for (const d of DIRS) {
        let yy = y + DY[d]; let xx = x + DX[d];
        const nm = mask(yy, xx);
        let link = isConn(yy, xx) && (has(m, d) || has(nm, OPP[d]));
        if (!link && has(m, d) && (d === N || d === S) && !isBorder(yy, xx)) {
          // bridge one blocking cell (a text row or a crossing fence) to a continuation of the same shaft
          const y2 = yy + DY[d];
          if (isConn(y2, xx) && has(mask(y2, xx), OPP[d])) { yy = y2; link = true; }
        }
        if (!link) continue;
        const key = `${yy},${xx}`;
        if (comp.has(key)) continue;
        comp.set(key, k); stack.push([yy, xx]);
      }
    }
    comps.push({ k, cells });
  }
  const corridors = [];
  const strayDash = [];
  const openings = [];
  const doorPairs = new Map();
  const roomAtCell = (r, c, pref) => {
    // smallest room containing the cell centre (or touching it), preferring rooms of rect `pref`
    const x = (c + 0.5) / cols; const y = (r + 0.5) / rows;
    const ex = 0.75 / cols; const ey = 0.75 / rows;
    let best = null; let ba = Infinity;
    for (const rm of rooms) {
      const s = rm.shape;
      if (x < s.x - ex || x > s.x + s.w + ex || y < s.y - ey || y > s.y + s.h + ey) continue;
      const a = s.w * s.h * (pref != null && rm.rect === pref ? 0.5 : 1);
      if (a < ba) { ba = a; best = rm; }
    }
    return best;
  };
  const inRegion = (rm, r, c) => { const s = rm.shape; const x = (c + 0.5) / cols; const y = (r + 0.5) / rows; return x >= s.x - 1e-3 && x <= s.x + s.w + 1e-3 && y >= s.y - 1e-3 && y <= s.y + s.h + 1e-3; };
  for (const cp of comps) {
    const set = new Set(cp.cells.map(([r, c]) => `${r},${c}`));
    // ignore tiny clutter inside a single leaf room (e.g. a duct sketch)
    const owners = new Set(cp.cells.map(([r, c]) => ownerOf(r, c)));
    if (owners.size === 1) { const o = [...owners][0]; if (o && isLeaf(o)) continue; }
    const touches = [];
    for (const [r, c] of cp.cells) {
      const m = mask(r, c);
      for (const d of DIRS) {
        const yy = r + DY[d]; const xx = c + DX[d];
        if (!isBorder(yy, xx)) continue;
        if (!(has(m, d) || has(mask(yy, xx), OPP[d]))) continue;
        for (const q of borderSet.get(`${yy},${xx}`)) touches.push({ q, r: yy, c: xx, d });
      }
    }
    if (!touches.length) {
      // look one cell further (a shaft crossing a fence / caption row into a box)
      for (const [r, c] of cp.cells) {
        const m = mask(r, c);
        for (const d of [N, S]) {
          if (!has(m, d)) continue;
          const y1 = r + DY[d]; const y2 = r + 2 * DY[d];
          if (mask(y1, c) || !isBorder(y2, c) || !has(mask(y2, c), OPP[d])) continue;
          for (const q of borderSet.get(`${y2},${c}`)) touches.push({ q, r: y2, c, d });
        }
      }
    }
    if (!touches.length && cp.cells.length <= 2) {
      // a lone "─" of a "─ ─ ─" separator, or the corner closing a dashed spine (┄┄┐): not a corridor
      if (cp.cells.every(([r, c]) => !has(mask(r, c), N) && !has(mask(r, c), S))) for (const [r, c] of cp.cells) strayDash.push([r, c]);
      continue;
    }
    const freeTouched = freeRegions.filter((rm) => cp.cells.some(([r, c]) => inRegion(rm, r, c)));
    // connects nothing: a frame edge drawn a column off, or a legend swatch ("═══ heated tube connector")
    if (!touches.length && !freeTouched.length) continue;
    // centre-line segments: maximal horizontal / vertical runs, extended to the walls they meet
    const style = cp.cells.some(([r, c]) => DOUBLE.has(at(r, c))) ? 'double' : 'single';
    const segs = [];
    const doneH = new Set(); const doneV = new Set();
    for (const [r, c] of cp.cells) {
      const m = mask(r, c);
      if ((has(m, E) || has(m, W)) && !doneH.has(`${r},${c}`)) {
        let a = c; let z = c;
        while (set.has(`${r},${a - 1}`) && (has(mask(r, a - 1), E) || has(mask(r, a), W))) a--;
        while (set.has(`${r},${z + 1}`) && (has(mask(r, z + 1), W) || has(mask(r, z), E))) z++;
        for (let x = a; x <= z; x++) doneH.add(`${r},${x}`);
        const ext0 = has(mask(r, a), W) && (isBorder(r, a - 1) || mask(r, a - 1)) ? 0.5 : 0;
        const ext1 = has(mask(r, z), E) && (isBorder(r, z + 1) || mask(r, z + 1)) ? 0.5 : 0;
        if (z > a || ext0 || ext1 || !(has(m, N) || has(m, S))) segs.push({ x1: nx(a + 0.5 - ext0 * 2), y1: ny(r + 0.5), x2: nx(z + 0.5 + ext1 * 2), y2: ny(r + 0.5), style });
      }
      if ((has(m, N) || has(m, S)) && !doneV.has(`${r},${c}`)) {
        let a = r; let z = r;
        const up = (y) => (set.has(`${y - 1},${c}`) ? 1 : has(mask(y, c), N) && !set.has(`${y - 1},${c}`) && set.has(`${y - 2},${c}`) && has(mask(y - 2, c), S) ? 2 : 0);
        const dn = (y) => (set.has(`${y + 1},${c}`) ? 1 : has(mask(y, c), S) && !set.has(`${y + 1},${c}`) && set.has(`${y + 2},${c}`) && has(mask(y + 2, c), N) ? 2 : 0);
        for (let k = up(a); k; k = up(a)) { if (!(has(mask(a - k, c), N) || has(mask(a - k, c), S))) break; a -= k; }
        for (let k = dn(z); k; k = dn(z)) { if (!(has(mask(z + k, c), N) || has(mask(z + k, c), S))) break; z += k; }
        for (let y = a; y <= z; y++) doneV.add(`${y},${c}`);
        const ext0 = has(mask(a, c), N) ? 0.5 : 0;
        const ext1 = has(mask(z, c), S) ? 0.5 : 0;
        segs.push({ x1: nx(c + 0.5), y1: ny(a + 0.5 - ext0), x2: nx(c + 0.5), y2: ny(z + 0.5 + ext1), style });
      }
    }
    // a component lying inside a free-text room (promenade / lava tube) belongs to it
    const ownedByFree = freeTouched.length && cp.cells.filter(([r, c]) => freeTouched.some((rm) => inRegion(rm, r, c))).length >= cp.cells.length * 0.5;
    if (!ownedByFree) corridors.push(...segs);
    const hit = new Map();
    for (const t of touches) {
      const rm = roomAtCell(t.r, t.c, t.q.i) || null;
      if (!rm) continue;
      if (!hit.has(rm.id)) hit.set(rm.id, { rm, t });
      openings.push({ room: rm.id, x: nx(t.c + 0.5), y: ny(t.r + 0.5), side: t.d === N || t.d === S ? 'h' : 'v' });
    }
    const touched = [...hit.values()];
    if (freeTouched.length) {
      for (const f of freeTouched) for (const { rm, t } of touched) if (rm.id !== f.id) addDoor(rm.id, f.id, t.c + 0.5, t.r + 0.5);
    } else {
      for (let a = 0; a < touched.length; a++) for (let b2 = a + 1; b2 < touched.length; b2++) {
        const A = touched[a]; const B = touched[b2];
        addDoor(A.rm.id, B.rm.id, A.t.c + 0.5, A.t.r + 0.5);
      }
    }
  }
  function addDoor(from, to, c, r) {
    if (from === to) return;
    const key = [from, to].sort().join('|');
    if (doorPairs.has(key)) return;
    doorPairs.set(key, { from, to, x: nx(c), y: ny(r) });
  }
  // stubs on a border pointing straight into another box (┬ over ┴, or ╤ on a shared divider)
  for (const [key, qs] of borderSet) {
    const [r, c] = key.split(',').map(Number);
    const m = mask(r, c);
    for (const d of [N, S, E, W]) {
      if (!has(m, d)) continue;
      const along = qs.some((q) => ((d === N || d === S) ? (c === q.c0 || c === q.c1) && r + DY[d] >= q.r0 && r + DY[d] <= q.r1 : (r === q.r0 || r === q.r1) && c + DX[d] >= q.c0 && c + DX[d] <= q.c1));
      if (along) continue;
      const yy = r + DY[d]; const xx = c + DX[d];
      const other = borderSet.get(`${yy},${xx}`);
      const A = roomAtCell(r, c, qs[0].i);
      if (other && has(mask(yy, xx), OPP[d])) {
        const B = roomAtCell(yy, xx, other[0].i);
        if (A && B && A.id !== B.id) {
          addDoor(A.id, B.id, c + 0.5, r + 0.5);
          openings.push({ room: A.id, x: nx(c + 0.5), y: ny(r + 0.5), side: d === N || d === S ? 'h' : 'v' });
          openings.push({ room: B.id, x: nx(xx + 0.5), y: ny(yy + 0.5), side: d === N || d === S ? 'h' : 'v' });
        }
      } else if (qs.length > 1) {
        const [q1, q2] = qs;
        const A2 = roomOfRect(q1); const B2 = roomOfRect(q2);
        if (A2 && B2) { addDoor(A2.id, B2.id, c + 0.5, r + 0.5); openings.push({ room: A2.id, x: nx(c + 0.5), y: ny(r + 0.5), side: d === N || d === S ? 'h' : 'v' }); }
      }
    }
  }
  // rooms nested in a room (galley inside the main corridor) open onto it
  for (const q of rects) {
    const outer = roomOfRect(q);
    if (!outer || outer.kind !== 'container') continue;
    for (const kid of q.children) {
      const inner = roomOfRect(kid) || (kid.room === 'split' ? rooms.find((rm) => rm.rect === kid.i) : null);
      if (!inner || [...doorPairs.values()].some((dd) => dd.from === inner.id || dd.to === inner.id)) continue;
      const toBottom = (q.r1 - kid.r1) >= (kid.r0 - q.r0);
      const r = toBottom ? kid.r1 : kid.r0; const c = Math.round((kid.c0 + kid.c1) / 2);
      addDoor(inner.id, outer.id, c + 0.5, r + 0.5);
      openings.push({ room: inner.id, x: nx(c + 0.5), y: ny(r + 0.5), side: 'h' });
    }
  }

  /* 11. Containers (non-room boxes), walls, textures, free annotations. */
  const containers = rects.filter((q) => !q.room && !isLeaf(q)).map((q) => ({
    shape: boxShape(q), cells: { r0: q.r0, c0: q.c0, r1: q.r1, c1: q.c1 }, frame: q === frameRect,
    label: q.head && q.head.head === q && q !== frameRect ? cleanText(q.head.lines.map((l) => l.text).join(' ')) : '',
    double: DOUBLE.has(at(q.r0, q.c0)),
  }));
  const walls = [];
  for (const rm of rooms) {
    const s = rm.shape;
    walls.push({ x1: s.x, y1: s.y, x2: s.x + s.w, y2: s.y, kind: 'room' }, { x1: s.x + s.w, y1: s.y, x2: s.x + s.w, y2: s.y + s.h, kind: 'room' },
      { x1: s.x, y1: s.y + s.h, x2: s.x + s.w, y2: s.y + s.h, kind: 'room' }, { x1: s.x, y1: s.y, x2: s.x, y2: s.y + s.h, kind: 'room' });
  }
  for (const ct of containers) {
    const s = ct.shape; const kind = ct.frame ? 'frame' : 'container';
    walls.push({ x1: s.x, y1: s.y, x2: s.x + s.w, y2: s.y, kind }, { x1: s.x + s.w, y1: s.y, x2: s.x + s.w, y2: s.y + s.h, kind },
      { x1: s.x, y1: s.y + s.h, x2: s.x + s.w, y2: s.y + s.h, kind }, { x1: s.x, y1: s.y, x2: s.x, y2: s.y + s.h, kind });
  }
  const textures = [];
  const VDASH = new Set([...'┊┆╎┋┇╏']);
  for (let r = 0; r < rows; r++) {
    let cur = null;
    for (let c = 0; c <= cols; c++) {
      const f = c < cols && !VDASH.has(at(r, c)) ? texture(r, c) : null;
      if (f && cur && cur.family === f && c - cur.c1 <= 2) { cur.c1 = c; continue; }
      if (cur) { textures.push({ family: cur.family, x: nx(cur.c0), y: ny(r), w: r4((cur.c1 - cur.c0 + 1) / cols), h: r4(1 / rows) }); cur = null; }
      if (f) cur = { family: f, c0: c, c1: c };
    }
  }
  for (let c = 0; c < cols; c++) {
    // vertical dashed lines (┊) as vertical runs
    let a = -1;
    for (let r = 0; r <= rows; r++) {
      const v = r < rows && VDASH.has(at(r, c));
      if (v && a < 0) a = r;
      if (!v && a >= 0) { textures.push({ family: 'dash', vertical: true, x: nx(c), y: ny(a), w: r4(1 / cols), h: r4((r - a) / rows) }); a = -1; }
    }
  }
  {
    // stray "─ ─ ─" separators: one dashed texture run per row
    const byRow = new Map();
    for (const [r, c] of strayDash) { if (!byRow.has(r)) byRow.set(r, []); byRow.get(r).push(c); }
    for (const [r, cs] of byRow) {
      cs.sort((a, b) => a - b);
      let a = cs[0]; let z = cs[0];
      const flush = () => { if (z > a) textures.push({ family: 'dash', x: nx(a), y: ny(r), w: r4((z - a + 1) / cols), h: r4(1 / rows) }); };
      for (const c of cs.slice(1)) { if (c - z <= 3) z = c; else { flush(); a = z = c; } }
      flush();
    }
  }
  const nearCorr = (b) => corridors.some((sg) => {
    const x0 = Math.min(sg.x1, sg.x2) * cols; const x1 = Math.max(sg.x1, sg.x2) * cols; const y0 = Math.min(sg.y1, sg.y2) * rows; const y1 = Math.max(sg.y1, sg.y2) * rows;
    return b.c0 - 3 <= x1 && b.c1 + 3 >= x0 && b.r0 - 1 <= y1 && b.r1 + 1.5 >= y0;
  });
  const labels = [];
  for (const b of blocks) {
    if (b.room || b.head) continue;
    const rest = b.runs.filter((u) => !u.used);
    if (!rest.length) continue;
    const byR = new Map();
    for (const u of rest) { if (!byR.has(u.r)) byR.set(u.r, []); byR.get(u.r).push(u); }
    // one label per row segment cluster so partially consumed blocks keep their own positions
    for (const [r, us] of [...byR.entries()].sort((x, y) => x[0] - y[0])) {
      const c0 = us[0].c0; const c1 = us[us.length - 1].c1;
      const text = us.map((u) => u.text).join(' ');
      const prev = labels[labels.length - 1];
      if (prev && prev._b === b && prev._r1 === r - 1 && rest.length === b.runs.length) {
        prev.lines.push(...tidy([text])); prev._r1 = r; prev.h = r4((r - prev._r0 + 1) / rows);
        prev.w = r4(Math.max(prev.w, (c1 + 1) / cols - prev.x)); continue;
      }
      labels.push({ _b: b, _r0: r, _r1: r, x: nx(c0), y: ny(r), w: r4((c1 - c0 + 1) / cols), h: r4(1 / rows), lines: tidy([text]),
        caps: isCapsLine(text.replace(/^[[(]+/, 'X')), nearCorridor: nearCorr({ r0: r, r1: r, c0, c1 }) });
    }
  }
  for (const l of labels) { delete l._b; delete l._r0; delete l._r1; }
  // container head lines that did not become rooms stay as zone captions (containers[].label)

  /* 12. Hull, outline, crop, spawn. */
  let hull;
  if (frameRect) {
    hull = boxShape(frameRect);
  } else {
    const xs = []; const ys = [];
    for (const rm of rooms) { xs.push(rm.shape.x, rm.shape.x + rm.shape.w); ys.push(rm.shape.y, rm.shape.y + rm.shape.h); }
    for (const ct of containers) { xs.push(ct.shape.x, ct.shape.x + ct.shape.w); ys.push(ct.shape.y, ct.shape.y + ct.shape.h); }
    for (const sg of corridors) { xs.push(sg.x1, sg.x2); ys.push(sg.y1, sg.y2); }
    // captions belong to the plan (level names, "SPINE LIFT", the scale note under the hull)
    for (const l of labels) if (l.caps) { xs.push(l.x, l.x + l.w); ys.push(l.y, l.y + l.h); }
    if (!xs.length) { xs.push(0, 1); ys.push(0, 1); }
    const px = 1 / cols; const py = 0.6 / rows;
    const x0 = Math.max(0, Math.min(...xs) - px); const x1 = Math.min(1, Math.max(...xs) + px);
    const y0 = Math.max(0, Math.min(...ys) - py); const y1 = Math.min(1, Math.max(...ys) + py);
    hull = { type: 'rect', x: r4(x0), y: r4(y0), w: r4(x1 - x0), h: r4(y1 - y0) };
  }
  const outline = `M ${hull.x} ${hull.y} H ${r4(hull.x + hull.w)} V ${r4(hull.y + hull.h)} H ${hull.x} Z`;
  const padX = 1.5 / cols; const padY = 0.8 / rows;
  const cx0 = Math.max(0, hull.x - padX); const cy0 = Math.max(0, hull.y - padY);
  // the bottom margin holds the compass / scale strip (AsciiLayer draws it under the hull)
  const crop = { x: r4(cx0), y: r4(cy0), w: r4(Math.min(1, hull.x + hull.w + padX) - cx0), h: r4(Math.min(1, hull.y + hull.h + 2.1 / rows) - cy0) };
  const first = hints.length ? rooms.find((rm) => rm.hintIndex === 0) : null;
  const entrance = [r4(hull.x + hull.w / 2), r4(Math.max(hull.y, hull.y + hull.h - 1.5 / rows))];
  const spawn = first ? [r4(first.shape.x + first.shape.w / 2), r4(first.shape.y + first.shape.h / 2)] : entrance;

  // order: hinted rooms in hint order, then the rest
  rooms.sort((a, b) => (a.hinted === b.hinted ? (a.hintIndex ?? 1e9) - (b.hintIndex ?? 1e9) : a.hinted ? -1 : 1));
  const matched = new Set(rooms.filter((rm) => rm.hinted).map((rm) => rm.hintIndex));
  const unmatched = hints.filter((h) => !matched.has(h.i)).map((h) => h.name);
  const note = new Map(hints.map((h) => [h.i, h.note]));
  for (const rm of rooms) if (rm.hinted && note.get(rm.hintIndex)) rm.note = note.get(rm.hintIndex);

  return {
    cols, rows, width: cols, height: rows * 2, cell: { w: 1, h: 2 },
    rooms, containers, corridors, doors: [...doorPairs.values()], openings, walls, labels,
    // legend swatches in the title block sit outside the hull: not part of the plan
    textures: textures.filter((t) => t.x + t.w > hull.x && t.x < hull.x + hull.w && t.y + t.h > hull.y && t.y < hull.y + hull.h),
    hull, outline, crop, spawn, unmatched,
  };
}

/**
 * Merge a map's own room list (pack / overlay) over generated rooms (ASCII parse or
 * engine geometry). If any pack room has a shape, the pack list is authoritative (a
 * Room Editor save): shaped pack rooms win, a shapeless pack room takes the generated
 * room with the same id, generated rooms the pack no longer lists are dropped.
 * Otherwise the generated rooms are used as-is (pack notes carried over by id).
 */
export function mergeRooms(generated, packRooms) {
  const gen = generated || [];
  const pack = (packRooms || []).filter((r) => r && (r.name || r.id));
  const byId = new Map(gen.map((r) => [r.id, r]));
  if (pack.some((r) => r.shape)) {
    const out = [];
    for (const r of pack) {
      const id = r.id || kebab(r.name);
      if (r.shape) out.push({ ...r, id });
      else if (byId.has(id)) out.push({ ...byId.get(id), id, name: r.name || byId.get(id).name, ...(r.note ? { note: r.note } : {}) });
    }
    return out;
  }
  const notes = new Map(pack.map((r) => [r.id || kebab(r.name), r.note]));
  return gen.map((r) => (notes.get(r.id) && !r.note ? { ...r, note: notes.get(r.id) } : r));
}

/* ─── memoized parse (by map id + ascii hash) ─────────────────── */
const CACHE = new Map();
export function parseAsciiMapCached(key, ascii, roomsHint) {
  const k = `${key || ''}:${hashString(ascii)}:${hashString(JSON.stringify((roomsHint || []).map((r) => [r?.id, r?.name])))}`;
  if (CACHE.has(k)) return CACHE.get(k);
  const out = parseAsciiMap(ascii, roomsHint);
  if (CACHE.size > 60) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(k, out);
  return out;
}

/** Map units for a parsed grid in px (a cell is 12 × 24 px: monospace 1 × 2 aspect). */
export const ASCII_CELL_PX = [12, 24];
export function asciiMapSize(parsed) { return [parsed.cols * ASCII_CELL_PX[0], parsed.rows * ASCII_CELL_PX[1]]; }

/** Rooms as the server stores them: unique kebab ids, name, level?, note?, shape (rooms without a shape dropped). */
function boardRooms(rooms) {
  const seen = new Set();
  const out = [];
  for (const r of rooms || []) {
    if (!r?.shape) continue;
    let id = r.id || kebab(r.name);
    while (seen.has(id)) id += '-x';
    seen.add(id);
    out.push({ id, name: r.name || id.toUpperCase(), ...(r.level ? { level: r.level } : {}), ...(r.note ? { note: r.note } : {}), shape: r.shape });
  }
  return out;
}

/** Plain-data mapDef for an ASCII map: parsed room rects (overlay rooms win by id), doors, hull outline, crop, spawn. */
export function buildAsciiMapDef(m) {
  const g = parseAsciiMapCached(m.id, m.ascii || '', m.rooms || []);
  const rooms = boardRooms(mergeRooms(g.rooms, m.rooms));
  const ids = new Set(rooms.map((r) => r.id));
  const doors = [...(Array.isArray(m.doors) ? m.doors : []), ...g.doors.map(({ from, to }) => ({ from, to }))]
    .filter((d, i, a) => ids.has(d.from) && ids.has(d.to) && a.findIndex((e) => (e.from === d.from && e.to === d.to) || (e.from === d.to && e.to === d.from)) === i);
  // spawn: the first hinted room (where it is now, after GM corrections), centred low so the PC token does not
  // sit on the room's label; else the hull entrance
  const h0 = (m.rooms || [])[0];
  const fr = h0 ? rooms.find((r) => r.id === (h0.id || kebab(h0.name))) : null;
  const spawnPt = m.spawn?.pc || (fr?.shape?.type === 'rect'
    ? [r4(fr.shape.x + fr.shape.w / 2), r4(fr.shape.y + fr.shape.h * 0.74)] : g.spawn);
  return {
    id: m.id, title: m.title || m.id, ...(m.subtitle ? { subtitle: m.subtitle } : {}),
    kind: 'ascii', ascii: m.ascii || '',
    size: [g.cols * ASCII_CELL_PX[0], g.rows * ASCII_CELL_PX[1]],
    grid: Math.min(1 / 30, 1.6 / g.cols),
    outline: g.outline, crop: g.crop,
    ...Object.fromEntries(['levels', 'outline', 'crop', 'grid', 'levelNoun', 'backdrop', 'palette'].filter((k) => m[k] !== undefined && m[k] !== null).map((k) => [k, m[k]])),
    spawn: { ...(m.spawn || {}), pc: spawnPt },
    rooms, ...(doors.length ? { doors } : {}),
  };
}
