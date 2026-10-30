import React, { useMemo } from 'react';
import { parseAsciiMapCached, mergeRooms } from '../../maps/asciiMap';

/* ═══════════════════════════════════════════════════════════════
   AsciiLayer — an ASCII schematic drawn as a themed vector deck plan
   (engine/maps/asciiMap.js does the parsing). Used by the table board
   (MapCanvas, under the fog) and by the GM Maps tab (AsciiDeckPlan).

   Draws, in map px (W × H = cols·12 × rows·24): hull / outline with a
   hatched or sandstone fill, zone outlines for non-room boxes, hatched
   corridors (double-line connectors as tubes), room floors with thick
   walls and door gaps, texture patches (░ growth, █ blocked, ≈ water,
   ∴ sand, ▲ rock, ━ fence), room labels (name + small sub-lines),
   free annotations, and a compass / scale strip.

   Rooms: `rooms` (the mapDef's — GM overlay edits win) are drawn where
   they are; the parse supplies corridors, doors, textures and the art's
   own sub-labels. Colours: palette.deck (theme.board.deck) over a
   default derived from palette.ascii.

   role 'board' (TV): labels ≥ labelMin (20 screen px), no GM notes,
   only caps annotations. role 'dm' / 'gm': everything; `showNotes`
   prints rooms[].note under the name (GM Maps tab).
   ═══════════════════════════════════════════════════════════════ */

const ALIEN_DECK = {
  hull: '#0b1f1b', hullEdge: '#2f8f78', hullHatch: '#163e35', zone: '#1f5a4c', zoneFill: 'rgba(40, 120, 100, 0.06)',
  floor: '#0b221e', floorAlt: '#0e2a25', wall: '#4fc4a4', wallDim: '#2a7a68', corridor: '#081714', corridorEdge: '#2a6a5a',
  door: '#9cf0d8', text: '#d4f4ea', textDim: '#6fae9a', accent: '#50c8a8',
  organic: '#8a9a40', solid: '#b84a3a', water: '#2f8f9a', sand: '#9a8a5a', rock: '#6f8a86', fence: '#c8a040', dash: '#5f9a88', dots: '#5f9a88',
};

export function deckColors(palette = {}) {
  return { ...ALIEN_DECK, ...(palette.deck || {}) };
}

/** Greedy word-wrap for a monospace font: lines of ≤ maxChars. */
function wrap(text, maxChars) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const out = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  return out;
}

function fitLabel(name, w, h, { min, max, charW = 0.6, lineH = 1.12 }) {
  // try the biggest font that fits in ≤ 3 lines; never below `min`
  for (let fs = max; fs >= min; fs -= Math.max(0.5, fs * 0.06)) {
    const maxChars = Math.max(3, Math.floor(w / (fs * charW)));
    const lines = wrap(name, maxChars);
    if (lines.length * fs * lineH <= h && lines.every((l) => l.length <= maxChars)) return { fs, lines };
  }
  const maxChars = Math.max(3, Math.floor(w / (min * charW)));
  return { fs: min, lines: wrap(name, maxChars).slice(0, 4) };
}

function Patterns({ uid, C, cw, ch }) {
  const u = cw;
  return (
    <defs>
      <pattern id={`${uid}-hullhatch`} width={u * 1.2} height={u * 1.2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2={u * 1.2} stroke={C.hullHatch} strokeWidth={u * 0.16} />
      </pattern>
      <pattern id={`${uid}-plate`} width={cw * 4} height={ch * 2} patternUnits="userSpaceOnUse">
        <rect width={cw * 4} height={ch * 2} fill="none" stroke={C.wallDim} strokeWidth={u * 0.04} opacity="0.35" />
      </pattern>
      <pattern id={`${uid}-tile`} width={cw} height={cw} patternUnits="userSpaceOnUse">
        <rect x={u * 0.04} y={u * 0.04} width={cw - u * 0.08} height={cw - u * 0.08} fill="none" stroke={C.wallDim} strokeWidth={u * 0.03} opacity="0.22" />
      </pattern>
      <pattern id={`${uid}-corr`} width={u * 0.8} height={u * 0.8} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <line x1="0" y1="0" x2="0" y2={u * 0.8} stroke={C.corridorEdge} strokeWidth={u * 0.1} opacity="0.55" />
      </pattern>
      <pattern id={`${uid}-organic`} width={u * 1.6} height={u * 1.6} patternUnits="userSpaceOnUse">
        {[[0.3, 0.4, 0.22], [1.1, 0.3, 0.16], [0.8, 1.1, 0.26], [0.2, 1.3, 0.12], [1.35, 1.25, 0.18]].map(([x, y, r], i) => (
          <circle key={i} cx={x * u} cy={y * u} r={r * u} fill={C.organic} opacity="0.75" />
        ))}
      </pattern>
      <pattern id={`${uid}-solid`} width={u * 0.7} height={u * 0.7} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width={u * 0.7} height={u * 0.7} fill={C.solid} opacity="0.18" />
        <line x1="0" y1="0" x2="0" y2={u * 0.7} stroke={C.solid} strokeWidth={u * 0.22} opacity="0.8" />
      </pattern>
      <pattern id={`${uid}-water`} width={u * 2} height={ch * 0.5} patternUnits="userSpaceOnUse">
        <path d={`M0 ${ch * 0.25} q ${u * 0.5} ${-ch * 0.14} ${u} 0 t ${u} 0`} fill="none" stroke={C.water} strokeWidth={u * 0.1} opacity="0.85" />
      </pattern>
      <pattern id={`${uid}-sand`} width={u * 1.4} height={u * 1.4} patternUnits="userSpaceOnUse">
        {[[0.2, 0.3], [0.9, 0.5], [0.5, 1.1], [1.2, 1.2]].map(([x, y], i) => <circle key={i} cx={x * u} cy={y * u} r={u * 0.09} fill={C.sand} opacity="0.8" />)}
      </pattern>
      <pattern id={`${uid}-rock`} width={u * 1.6} height={ch * 0.8} patternUnits="userSpaceOnUse">
        <path d={`M0 ${ch * 0.7} L ${u * 0.8} ${ch * 0.1} L ${u * 1.6} ${ch * 0.7}`} fill="none" stroke={C.rock} strokeWidth={u * 0.12} opacity="0.85" />
      </pattern>
    </defs>
  );
}

function TexturePatch({ t, W, H, uid, C, cw, ch }) {
  const x = t.x * W; const y = t.y * H; const w = t.w * W; const h = t.h * H;
  switch (t.family) {
    case 'organic': return <rect x={x} y={y + h * 0.1} width={w} height={h * 0.8} rx={cw * 0.4} fill={`url(#${uid}-organic)`} />;
    case 'solid': return <rect x={x} y={y + h * 0.08} width={w} height={h * 0.84} fill={`url(#${uid}-solid)`} stroke={C.solid} strokeWidth={cw * 0.08} opacity="0.9" />;
    case 'water': return <rect x={x} y={y + h * 0.15} width={w} height={h * 0.7} fill={`url(#${uid}-water)`} />;
    case 'sand': return <rect x={x} y={y} width={w} height={h} fill={`url(#${uid}-sand)`} />;
    case 'rock': return <rect x={x} y={y + h * 0.1} width={w} height={h * 0.8} fill={`url(#${uid}-rock)`} />;
    case 'fence': return <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke={C.fence} strokeWidth={cw * 0.22} strokeDasharray={`${cw * 0.9} ${cw * 0.35}`} />;
    case 'dash': return t.vertical
      ? <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke={C.dash} strokeWidth={cw * 0.12} strokeDasharray={`${ch * 0.3} ${ch * 0.2}`} opacity="0.8" />
      : <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke={C.dash} strokeWidth={cw * 0.12} strokeDasharray={`${cw * 0.5} ${cw * 0.5}`} opacity="0.8" />;
    case 'dots': return <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke={C.dots} strokeWidth={cw * 0.14} strokeDasharray={`${cw * 0.12} ${cw * 0.88}`} strokeLinecap="round" opacity="0.7" />;
    default: return null;
  }
}

/* Room rect in map px from a normalized shape (rect, or a poly's bbox for labels). */
function px(shape, W, H) {
  if (shape.type === 'rect') return { x: shape.x * W, y: shape.y * H, w: shape.w * W, h: shape.h * H };
  const xs = shape.points.map((p) => p[0] * W); const ys = shape.points.map((p) => p[1] * H);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

export default function AsciiLayer({
  mapDef, parsed: parsedProp, rooms: roomsProp, W, H, palette = {}, role = 'dm', labelMin = 0, counter = '', rot = 0,
  uid = 'al', showNotes = false, roomNames = null, showCompass = true, showLabels = true, roomState = null, fog = false,
}) {
  const parsed = useMemo(() => parsedProp || parseAsciiMapCached(mapDef?.id, mapDef?.ascii || '', mapDef?.rooms || []), [parsedProp, mapDef]);
  const C = useMemo(() => deckColors(palette), [palette]);
  const isBoard = role === 'board';
  const cw = W / parsed.cols;
  const ch = H / parsed.rows;
  const rooms = roomsProp || parsed.rooms;
  const byId = useMemo(() => new Map(parsed.rooms.map((r) => [r.id, r])), [parsed]);
  const font = palette.font || "ui-monospace, 'Courier New', monospace";
  const wallW = Math.max(1.6, cw * 0.24);
  const hull = parsed.hull;
  const hx = hull.x * W; const hy = hull.y * H; const hw = hull.w * W; const hh = hull.h * H;
  const sandstone = (palette.deck?.style || (palette.backdrop === 'sand' ? 'stone' : 'hatched')) === 'stone';

  // openings that still sit on their (possibly GM-edited) room's wall
  const openings = useMemo(() => {
    const out = [];
    for (const o of parsed.openings) {
      const rm = rooms.find((r) => r.id === o.room);
      if (!rm || rm.shape?.type !== 'rect') continue;
      const s = rm.shape;
      const tolX = 0.8 / parsed.cols; const tolY = 0.8 / parsed.rows;
      const onV = (Math.abs(o.x - s.x) < tolX || Math.abs(o.x - (s.x + s.w)) < tolX) && o.y > s.y - tolY && o.y < s.y + s.h + tolY;
      const onH = (Math.abs(o.y - s.y) < tolY || Math.abs(o.y - (s.y + s.h)) < tolY) && o.x > s.x - tolX && o.x < s.x + s.w + tolX;
      if (onH) out.push({ ...o, side: 'h', y: Math.abs(o.y - s.y) < Math.abs(o.y - (s.y + s.h)) ? s.y : s.y + s.h });
      else if (onV) out.push({ ...o, side: 'v', x: Math.abs(o.x - s.x) < Math.abs(o.x - (s.x + s.w)) ? s.x : s.x + s.w });
    }
    return out;
  }, [parsed, rooms]);

  const nameFs = Math.max(labelMin, ch * 0.62);
  const minFs = Math.max(labelMin, ch * 0.42);

  return (
    <g className="ascii-layer" fontFamily={font}>
      <Patterns uid={uid} C={C} cw={cw} ch={ch} />

      {/* hull */}
      <g className="al-hull">
        <rect x={hx - cw * 0.6} y={hy - ch * 0.3} width={hw + cw * 1.2} height={hh + ch * 0.6} rx={cw * 1.2}
          fill={C.hull} fillOpacity={sandstone ? 0.55 : 0.32} stroke={C.hullEdge} strokeWidth={wallW * 0.9} strokeOpacity="0.8" />
        {!sandstone && <rect x={hx - cw * 0.6} y={hy - ch * 0.3} width={hw + cw * 1.2} height={hh + ch * 0.6} rx={cw * 1.2} fill={`url(#${uid}-hullhatch)`} opacity="0.55" />}
        <rect x={hx - cw * 0.6} y={hy - ch * 0.3} width={hw + cw * 1.2} height={hh + ch * 0.6} rx={cw * 1.2} fill={`url(#${uid}-plate)`} opacity="0.6" />
        <rect x={hx - cw * 0.15} y={hy} width={hw + cw * 0.3} height={hh} rx={cw * 0.7} fill="none" stroke={C.hullEdge} strokeWidth={wallW * 0.35} strokeOpacity="0.45" />
      </g>

      {/* zones (boxes that are not rooms: levels, perimeters, complexes) */}
      {parsed.containers.filter((z) => !z.frame).map((z, i) => {
        const r = px(z.shape, W, H);
        return (
          <g key={`z${i}`} className="al-zone">
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={cw * 0.5} fill={C.zoneFill} stroke={C.zone} strokeWidth={wallW * 0.8}
              strokeDasharray={z.double ? undefined : `${cw * 1.2} ${cw * 0.5}`} />
            {z.double && <rect x={r.x + cw * 0.3} y={r.y + cw * 0.3} width={r.w - cw * 0.6} height={r.h - cw * 0.6} rx={cw * 0.4} fill="none" stroke={C.zone} strokeWidth={wallW * 0.35} />}
            {z.label && (
              <text x={r.x + cw * 1.2} y={r.y + ch * 0.95} fontSize={Math.max(labelMin * 0.8, ch * 0.5)} fill={C.textDim} letterSpacing="0.12em">
                {z.label.toUpperCase().slice(0, Math.max(6, Math.floor(r.w / (Math.max(labelMin * 0.8, ch * 0.5) * 0.66))))}
              </text>
            )}
          </g>
        );
      })}

      {/* corridors */}
      <g className="al-corridors" strokeLinecap="square">
        {parsed.corridors.map((s, i) => {
          const vertical = Math.abs(s.x1 - s.x2) < 1e-6;
          const wdt = vertical ? cw * 0.95 : ch * 0.42;
          const p = { x1: s.x1 * W, y1: s.y1 * H, x2: s.x2 * W, y2: s.y2 * H };
          return (
            <g key={`c${i}`}>
              <line {...p} stroke={C.corridorEdge} strokeWidth={wdt + wallW * 1.2} />
              <line {...p} stroke={C.corridor} strokeWidth={wdt} />
              <line {...p} stroke={`url(#${uid}-corr)`} strokeWidth={wdt} />
              {s.style === 'double' && <line {...p} stroke={C.accent} strokeWidth={wdt * 0.12} strokeOpacity="0.5" strokeDasharray={`${cw * 0.6} ${cw * 0.4}`} />}
            </g>
          );
        })}
      </g>

      {/* room floors */}
      <g className="al-floors">
        {rooms.map((rm) => {
          if (!rm.shape) return null;
          if (rm.shape.type === 'poly') {
            return <polygon key={rm.id} points={rm.shape.points.map(([x, y]) => `${x * W},${y * H}`).join(' ')} fill={C.floor} stroke={C.wall} strokeWidth={wallW} strokeLinejoin="round" />;
          }
          const r = px(rm.shape, W, H);
          const free = byId.get(rm.id)?.kind === 'free';
          return (
            <g key={rm.id}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={free ? 'none' : C.floor} />
              {!free && <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={`url(#${uid}-tile)`} />}
            </g>
          );
        })}
      </g>

      {/* textures */}
      <g className="al-textures" pointerEvents="none">
        {parsed.textures.map((t, i) => <TexturePatch key={`t${i}`} t={t} W={W} H={H} uid={uid} C={C} cw={cw} ch={ch} />)}
      </g>

      {/* walls */}
      <g className="al-walls" fill="none" strokeLinejoin="miter">
        {rooms.map((rm) => {
          if (!rm.shape || rm.shape.type !== 'rect') return null;
          const r = px(rm.shape, W, H);
          const free = byId.get(rm.id)?.kind === 'free';
          return free
            ? <rect key={rm.id} x={r.x} y={r.y} width={r.w} height={r.h} rx={cw * 0.4} stroke={C.wallDim} strokeWidth={wallW * 0.6} strokeDasharray={`${cw * 0.5} ${cw * 0.35}`} />
            : (
              <g key={rm.id}>
                <rect x={r.x} y={r.y} width={r.w} height={r.h} stroke="#000" strokeOpacity="0.55" strokeWidth={wallW * 2.2} />
                <rect x={r.x} y={r.y} width={r.w} height={r.h} stroke={C.wall} strokeWidth={wallW} />
              </g>
            );
        })}
      </g>

      {/* door gaps */}
      <g className="al-doors" pointerEvents="none">
        {openings.map((o, i) => {
          const x = o.x * W; const y = o.y * H;
          const len = o.side === 'h' ? cw * 1.1 : ch * 0.55;
          const t = wallW * 2.4;
          return o.side === 'h' ? (
            <g key={`o${i}`}>
              <rect x={x - len / 2} y={y - t / 2} width={len} height={t} fill={C.corridor} />
              <line x1={x - len / 2} y1={y - t / 2} x2={x - len / 2} y2={y + t / 2} stroke={C.door} strokeWidth={wallW * 0.6} />
              <line x1={x + len / 2} y1={y - t / 2} x2={x + len / 2} y2={y + t / 2} stroke={C.door} strokeWidth={wallW * 0.6} />
              <line x1={x - len / 2 + wallW} y1={y} x2={x + len / 2 - wallW} y2={y} stroke={C.door} strokeWidth={wallW * 0.35} strokeDasharray={`${wallW * 0.8} ${wallW * 0.6}`} />
            </g>
          ) : (
            <g key={`o${i}`}>
              <rect x={x - t / 2} y={y - len / 2} width={t} height={len} fill={C.corridor} />
              <line x1={x - t / 2} y1={y - len / 2} x2={x + t / 2} y2={y - len / 2} stroke={C.door} strokeWidth={wallW * 0.6} />
              <line x1={x - t / 2} y1={y + len / 2} x2={x + t / 2} y2={y + len / 2} stroke={C.door} strokeWidth={wallW * 0.6} />
              <line x1={x} y1={y - len / 2 + wallW} x2={x} y2={y + len / 2 - wallW} stroke={C.door} strokeWidth={wallW * 0.35} strokeDasharray={`${wallW * 0.8} ${wallW * 0.6}`} />
            </g>
          );
        })}
      </g>

      {/* free annotations (TV: caps captions only) */}
      <g className="al-notes" pointerEvents="none">
        {parsed.labels.filter((l) => !isBoard || l.caps).map((l, i) => {
          const fs = Math.max(isBoard ? labelMin * 0.8 : 0, ch * 0.5);
          // TV: caps captions only; lowercase asides ("(open to the wind…)", "(underground nest)") are GM detail
          const lines = isBoard
            ? l.lines.map((t) => t.replace(/\s*\([^)]*[a-z][^)]*\)?/g, '').trim()).filter((t) => t && !/[a-z]/.test(t)).slice(0, 2)
            : l.lines.slice(0, 3);
          if (!lines.length) return null;
          return (
            <g key={`n${i}`} transform={`translate(${l.x * W},${l.y * H + ch * 0.72})`}>
              {lines.map((t, k) => (
                <text key={k} y={k * fs * 1.15} fontSize={fs} fill={l.caps ? C.textDim : C.textDim} fillOpacity={l.caps ? 0.95 : 0.7}
                  fontStyle={l.caps ? undefined : 'italic'} letterSpacing="0.06em" stroke="#000" strokeOpacity="0.6" strokeWidth={fs * 0.12} paintOrder="stroke">{t}</text>
              ))}
            </g>
          );
        })}
      </g>

      {/* room labels */}
      {showLabels && (
        <g className="al-labels" pointerEvents="none">
          {rooms.map((rm) => {
            if (!rm.shape) return null;
            // the TV never prints the name of a room the table has not seen (fog would only dim it)
            if (isBoard && fog && !roomState?.[rm.id]?.revealed) return null;
            const r = px(rm.shape, W, H);
            const pr0 = byId.get(rm.id);
            let disp = String(roomNames?.[rm.id] || rm.name || '');
            // "Level 1 — Bridge" in a box the art labels just "BRIDGE" (inside a LEVEL 1 zone): print the part the art uses
            const dash = !roomNames?.[rm.id] && pr0 ? /^(.+?)\s+[—–-]\s+(.+)$/.exec(disp) : null;
            if (dash) {
              const art = String(pr0.labelLines?.[0] || '').toUpperCase();
              const pre = dash[1].toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
              if (pre.length && !pre.every((t) => art.includes(t))) disp = dash[2];
            }
            const name = disp.toUpperCase();
            if (!name) return null;
            const sideways = rot % 180 !== 0;
            const aw = (sideways ? r.h : r.w) - cw * 0.8;
            const ah = (sideways ? r.w : r.h) - ch * 0.3;
            const { fs, lines } = fitLabel(name, Math.max(aw, cw * 3), Math.max(ah, ch * 0.8), { min: minFs, max: nameFs * 1.05 });
            const pr = byId.get(rm.id);
            const nameKey = name.replace(/[^A-Z0-9]/g, '');
            let subs = [];
            if (showNotes && rm.note) subs = [rm.note];
            else if (pr) subs = [...(pr.labelLines || []), ...(pr.notes || [])].filter((t) => { const k = t.toUpperCase().replace(/[^A-Z0-9]/g, ''); return k && !nameKey.includes(k) && !k.includes(nameKey); });
            const subFs = Math.max(isBoard ? labelMin * 0.7 : 0, ch * 0.36);
            const used = lines.length * fs * 1.12;
            const room = ah - used;
            const subMax = Math.max(0, Math.floor(room / (subFs * 1.2)));
            const subLines = subs.length && subMax ? wrap(subs.join(' · '), Math.max(6, Math.floor(aw / (subFs * 0.6)))).slice(0, Math.min(subMax, showNotes ? 3 : 2)) : [];
            if (subLines.length && subs.length && wrap(subs.join(' · '), Math.max(6, Math.floor(aw / (subFs * 0.6)))).length > subLines.length) {
              const last = subLines.length - 1;
              subLines[last] = subLines[last].replace(/.{0,2}$/, '…');
            }
            const total = used + subLines.length * subFs * 1.2;
            const [cx, cy] = [r.x + r.w / 2, r.y + r.h / 2];
            return (
              <g key={`l-${rm.id}`} transform={`translate(${cx},${cy}) ${counter}`}>
                {showNotes && rm.note && <title>{rm.note}</title>}
                {lines.map((t, k) => (
                  <text key={k} textAnchor="middle" y={-total / 2 + fs * 0.85 + k * fs * 1.12} fontSize={fs} fill={C.text} letterSpacing="0.06em"
                    stroke="#000" strokeOpacity="0.75" strokeWidth={fs * 0.16} paintOrder="stroke" fontWeight="600">{t}</text>
                ))}
                {subLines.map((t, k) => (
                  <text key={`s${k}`} textAnchor="middle" y={-total / 2 + used + subFs * 0.95 + k * subFs * 1.2} fontSize={subFs} fill={C.textDim}
                    letterSpacing="0.03em" stroke="#000" strokeOpacity="0.6" strokeWidth={subFs * 0.12} paintOrder="stroke">{t}</text>
                ))}
              </g>
            );
          })}
        </g>
      )}

      {/* compass + scale strip */}
      {showCompass && (() => {
        // a strip under the hull (the parser leaves two blank rows and crops them in)
        const stripY = hy + hh + ch * 0.3 + ch * 0.85;
        const s = Math.min(ch * 1.3, Math.max(ch * 0.8, labelMin * 1.1));
        const x = hx + hw - s * 0.8; const y = stripY;
        const fsC = Math.max(labelMin * 0.7, ch * 0.4);
        const seg = cw * 2;
        const sx = hx; const sy = stripY;
        return (
          <g className="al-compass" pointerEvents="none" opacity="0.85">
            <g transform={`translate(${x},${y}) ${counter}`}>
              <circle r={s * 0.5} fill="rgba(0,0,0,0.55)" stroke={C.accent} strokeWidth={wallW * 0.45} />
              <path d={`M0 ${-s * 0.42} L ${s * 0.15} ${s * 0.12} L0 ${-s * 0.02} L ${-s * 0.15} ${s * 0.12} Z`} fill={C.accent} />
              <path d={`M0 ${s * 0.42} L ${s * 0.15} ${-s * 0.0} L0 ${s * 0.1} L ${-s * 0.15} 0 Z`} fill={C.wallDim} />
              <text x={-s * 0.7} y={fsC * 0.36} textAnchor="end" fontSize={fsC} fill={C.text} stroke="#000" strokeWidth={fsC * 0.12} paintOrder="stroke" letterSpacing="0.1em">N</text>
            </g>
            {!isBoard && (
              <g transform={`translate(${sx},${sy})`}>
                {[0, 1, 2, 3, 4].map((k) => <rect key={k} x={k * seg} y={-ch * 0.12} width={seg} height={ch * 0.18} fill={k % 2 ? 'none' : C.accent} stroke={C.accent} strokeWidth={wallW * 0.3} opacity="0.8" />)}
                <text x={seg * 5 + cw * 0.6} y={ch * 0.12} fontSize={ch * 0.36} fill={C.textDim} letterSpacing="0.1em">SCHEMATIC · NOT TO SCALE · BAR = 2 GRID CELLS</text>
              </g>
            )}
          </g>
        );
      })()}
    </g>
  );
}

/* ─── GM Maps tab: a standalone vector deck plan for an ASCII map ─── */
export function AsciiDeckPlan({ map, palette, className = '', showNotes = true }) {
  const parsed = useMemo(() => parseAsciiMapCached(map.id, map.ascii || '', map.rooms || []), [map]);
  const W = parsed.cols * 12; const H = parsed.rows * 24;
  const c = parsed.crop;
  const vb = `${c.x * W} ${c.y * H} ${c.w * W} ${c.h * H}`;
  const rooms = useMemo(() => mergeRooms(parsed.rooms, map.rooms), [map, parsed]);
  return (
    <svg className={`ascii-deckplan ${className}`} viewBox={vb} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={`${map.title} deck plan`}
      style={{ width: '100%', height: 'auto', display: 'block', background: (palette && palette.bg) || '#000' }}>
      <rect x={c.x * W} y={c.y * H} width={c.w * W} height={c.h * H} fill={(palette && palette.bg) || '#000'} />
      <AsciiLayer parsed={parsed} rooms={rooms} W={W} H={H} palette={palette} role="gm" uid={`dp-${map.id}`} showNotes={showNotes} />
    </svg>
  );
}

