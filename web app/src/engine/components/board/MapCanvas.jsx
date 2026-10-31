import React, { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import TokenChip, { chipMetrics } from './TokenChip';
import RoomLayer, { shapeCenter } from './RoomLayer';
import EngineLayer from './EngineLayer';
import AsciiLayer from './AsciiLayer';
import { engineConfig, mapVisuals } from './mapDefs';
import { parseAsciiMapCached, ASCII_CELL_PX } from '../../maps/asciiMap';

/* Burn-in-safe idle drift offsets (screen px), stepped every 60 s while idle. */
const DRIFT = [[0, 0], [1, 1], [2, 0], [1, -1], [0, -2], [-1, -1], [-2, 0], [-1, 1]];
const DRIFT_MS = 60000;
const DIM_MS = 10 * 60000;
const CURSOR_MS = 3000;

/* ═══════════════════════════════════════════════════════════════
   MapCanvas — the board map, shared by BoardView (TV), MapController
   (GM tablet), the player MAP tab and the Room Editor.

   Coordinates: tokens/rooms are normalized 0..1 of the map; the SVG
   draws in map px (mapDef.size, the image's natural size, the engine
   canvas, or the ASCII text box). view.rotation (0/90/180/270) and
   view.flipX rotate the map inside a viewBox that fits the viewport;
   token chips and room labels are counter-rotated to stay upright.

   Pointer: one pointer-captured gesture at a time (touch + mouse).
   Tap token → onTokenTap(id, pt); drag token (editable) →
   onTokenMove(id, x, y, final); tap elsewhere → onTap(pt, roomId);
   drag background → onBackgroundDrag(phase, start, pt) if provided.

   Visuals come from mapVisuals(universe, mapDef): the board palette
   (fog, edges, labels, ascii, status-ring style) and the backdrop are
   read from the map definition / universe theme, never a constant.
   role 'board' (TV): token/room labels are kept >= 20 screen px; the
   cursor hides after 3 s without pointer movement; with `idleDrift`
   (default on for the board) the whole map layer drifts 1-2 px every
   60 s while nothing changes and dims after 10 min idle (burn-in).
   ═══════════════════════════════════════════════════════════════ */

const KIND_ORDER = { marker: 0, hazard: 0, item: 1, npc: 2, creature: 3, pc: 4 };
const clamp01 = (n) => Math.min(1, Math.max(0, n));

/* ASCII maps: parsed once per (map id, ascii); the map is cols·12 × rows·24 px. */
function useAsciiGeometry(mapDef) {
  return useMemo(() => (mapDef?.kind === 'ascii'
    ? parseAsciiMapCached(mapDef.id, mapDef.ascii || '', mapDef.rooms || []) : null), [mapDef]);
}

/* Token label collision pass: labels sit under their chip; when two plates
   overlap on screen the later one moves above its chip, then further down /
   up in plate-height steps. Works in screen orientation (after rotation). */
function staggerLabels(list, { W, H, unit, labelMin, minR, rot, flip, dragPos }) {
  const out = {};
  const placed = [];
  const toScreen = (x, y) => {
    let px = flip ? W - x : x; let py = y;
    if (rot === 90) [px, py] = [H - py, px];
    else if (rot === 180) [px, py] = [W - px, H - py];
    else if (rot === 270) [px, py] = [py, W - px];
    return [px, py];
  };
  const items = list.map((t) => {
    const dp = dragPos?.id === t.id ? dragPos : null;
    const m = chipMetrics(t, unit, { labelMin, minR });
    const [sx, sy] = toScreen((dp ? dp.x : t.x) * W, (dp ? dp.y : t.y) * H);
    return { t, m, sx, sy };
  }).filter((it) => it.m.label).sort((a, b) => a.sy - b.sy || a.sx - b.sx);
  const chips = list.map((t) => {
    const dp = dragPos?.id === t.id ? dragPos : null;
    const m = chipMetrics(t, unit, { labelMin, minR });
    const [sx, sy] = toScreen((dp ? dp.x : t.x) * W, (dp ? dp.y : t.y) * H);
    const r = m.r + m.ring;
    return { id: t.id, x0: sx - r, x1: sx + r, y0: sy - r, y1: sy + r };
  });
  let self = null;
  const over = (b, p) => b.x0 < p.x1 && b.x1 > p.x0 && b.y0 < p.y1 && b.y1 > p.y0;
  const hit = (b) => placed.some((p) => over(b, p)) || chips.some((c) => c.id !== self && over(b, c));
  for (const { t, m, sx, sy } of items) {
    self = t.id;
    const step = m.plateH * 1.08;
    const below = m.plateDy;
    const above = -(m.r + m.ring + m.ringOut + m.fs * 0.55);
    const slots = [below, above, below + step, above - step, below + step * 2, above - step * 2];
    let dy = below;
    for (const s of slots) {
      const b = { x0: sx - m.plateW / 2, x1: sx + m.plateW / 2, y0: sy + s - m.plateH * 0.7, y1: sy + s + m.plateH * 0.55 };
      if (!hit(b)) { dy = s; break; }
    }
    placed.push({ x0: sx - m.plateW / 2, x1: sx + m.plateW / 2, y0: sy + dy - m.plateH * 0.7, y1: sy + dy + m.plateH * 0.55 });
    if (dy !== below) out[t.id] = dy;
  }
  return out;
}

function useImageSize(src, known) {
  const [size, setSize] = useState(null);
  useEffect(() => {
    if (!src || known) return undefined;
    let alive = true;
    const img = new Image();
    img.onload = () => { if (alive && img.naturalWidth) setSize([img.naturalWidth, img.naturalHeight]); };
    img.src = src;
    return () => { alive = false; };
  }, [src, known]);
  return known || size;
}

const MapCanvas = forwardRef(function MapCanvas({
  mapDef, board, role = 'board', universe, view, editable = false, selectedTokenId = null, selectedRoomId = null,
  highlightPlayerId = null, pings = [], onTokenTap, onTokenMove, onTap, onBackgroundDrag, snap = false,
  showRoomLabels = false, showTokens = true, overlay, className = '', cursor, idleDrift,
  flashTokens = null, activeTokenId = null, showHp = false,
}, ref) {
  const isBoard = role === 'board';
  const drift = idleDrift ?? isBoard;
  const uid = 'mc' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const svgRef = useRef(null);
  const innerRef = useRef(null);
  const dragRef = useRef(null);
  const [dragPos, setDragPos] = useState(null);

  const level = board?.level || mapDef?.levels?.[0]?.id || null;
  const levelDef = mapDef?.levels?.find((l) => l.id === level) || null;
  const imgSrc = mapDef?.kind === 'image' ? (levelDef?.src || mapDef.src) : null;
  const ascii = useAsciiGeometry(mapDef);
  const imgSize = useImageSize(imgSrc, mapDef?.size);
  const [W, H] = ascii ? [ascii.cols * ASCII_CELL_PX[0], ascii.rows * ASCII_CELL_PX[1]] : (mapDef?.size || imgSize || [1000, 750]);
  const unit = (mapDef?.grid || 1 / 40) * W;

  /* Visible window (crop → zoom → pan) and rotation/flip transform. */
  const crop = mapDef?.crop || { x: 0, y: 0, w: 1, h: 1 };
  const zoom = view?.zoom || 1;
  const pan = view?.pan || [0, 0];
  const Wc = (crop.w * W) / zoom;
  const Hc = (crop.h * H) / zoom;
  const X = crop.x * W + (crop.w * W - Wc) / 2 + pan[0] * crop.w * W;
  const Y = crop.y * H + (crop.h * H - Hc) / 2 + pan[1] * crop.h * H;
  const rot = [0, 90, 180, 270].includes(view?.rotation) ? view.rotation : 0;
  const flip = !!view?.flipX;
  let transform = `translate(${-X},${-Y})`;
  if (flip) transform = `translate(${Wc},0) scale(-1,1) ${transform}`;
  if (rot === 90) transform = `translate(${Hc},0) rotate(90) ${transform}`;
  else if (rot === 180) transform = `translate(${Wc},${Hc}) rotate(180) ${transform}`;
  else if (rot === 270) transform = `translate(0,${Wc}) rotate(270) ${transform}`;
  const VW = rot % 180 ? Hc : Wc;
  const VH = rot % 180 ? Wc : Hc;
  const counter = `${flip ? 'scale(-1,1) ' : ''}rotate(${-rot})`;

  const engCfg = useMemo(() => (mapDef?.kind === 'engine' && universe ? engineConfig(universe, mapDef) : null), [mapDef, universe]);
  const visuals = useMemo(() => mapVisuals(universe, mapDef), [universe, mapDef]);
  const { palette } = visuals;
  const doors = useMemo(() => (mapDef?.kind === 'image' && Array.isArray(mapDef.doors)
    ? mapDef.doors.filter((d) => !level || !d.level || d.level === level) : null), [mapDef, level]);

  /* Screen px per map px (for >= 20 px TV labels). */
  const [pxScale, setPxScale] = useState(0);
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => { const r = el.getBoundingClientRect(); if (r.width && VW && VH) setPxScale(Math.min(r.width / VW, r.height / VH)); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [VW, VH, mapDef]);
  const labelMin = isBoard && pxScale > 0 ? 20 / pxScale : 0;
  // chip radius ≥ 22 screen px on the TV, ≥ 13 on the GM tablet / phones — the same base for every kind
  const tokenMin = pxScale > 0 ? (isBoard ? 22 : 13) / pxScale : 0;
  const tokenLabelMin = pxScale > 0 ? (isBoard ? 20 : 11) / pxScale : 0;

  /* Board idle handling: cursor hide (3 s), drift (every 60 s idle), dim (10 min idle). */
  const [cursorHidden, setCursorHidden] = useState(false);
  const [driftStep, setDriftStep] = useState(0);
  const [dimmed, setDimmed] = useState(false);
  const lastActivity = useRef(Date.now());
  useEffect(() => { lastActivity.current = Date.now(); setDimmed(false); }, [board]);
  useEffect(() => {
    if (!isBoard) return undefined;
    let t = setTimeout(() => setCursorHidden(true), CURSOR_MS);
    const onMove = () => { setCursorHidden(false); clearTimeout(t); t = setTimeout(() => setCursorHidden(true), CURSOR_MS); lastActivity.current = Date.now(); setDimmed(false); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onMove);
    return () => { clearTimeout(t); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerdown', onMove); };
  }, [isBoard]);
  useEffect(() => {
    if (!drift) return undefined;
    const iv = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= DRIFT_MS) setDriftStep((s) => (s + 1) % DRIFT.length);
      if (isBoard && idle >= DIM_MS) setDimmed(true);
    }, DRIFT_MS);
    return () => clearInterval(iv);
  }, [drift, isBoard]);
  const [dx, dy] = drift ? DRIFT[driftStep] : [0, 0];

  const rooms = useMemo(
    () => (mapDef?.rooms || []).filter((r) => !level || !r.level || r.level === level),
    [mapDef, level],
  );

  const toMap = useCallback((clientX, clientY) => {
    const g = innerRef.current;
    const svg = svgRef.current;
    if (!g || !svg) return null;
    const m = g.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x / W, y: p.y / H };
  }, [W, H]);

  useImperativeHandle(ref, () => ({
    clientToMap: toMap,
    contains: (clientX, clientY) => {
      const r = svgRef.current?.getBoundingClientRect();
      return !!r && clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
    },
    size: [W, H],
  }), [toMap, W, H]);

  const snapPoint = useCallback((x, y) => {
    if (!snap) return { x, y };
    const g = mapDef?.grid || 1 / 40;
    const gy = (g * W) / H;
    return { x: clamp01((Math.floor(x / g) + 0.5) * g), y: clamp01((Math.floor(y / gy) + 0.5) * gy) };
  }, [snap, mapDef, W, H]);

  const tokens = board?.tokens || {};

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const pt = toMap(e.clientX, e.clientY);
    if (!pt) return;
    const tokEl = showTokens ? e.target.closest?.('[data-token]') : null;
    const roomEl = e.target.closest?.('[data-room]');
    const tokenId = tokEl?.getAttribute('data-token') || null;
    const tok = tokenId ? tokens[tokenId] : null;
    dragRef.current = {
      pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, start: pt,
      tokenId, roomId: roomEl?.getAttribute('data-room') || null,
      grab: tok ? { dx: pt.x - tok.x, dy: pt.y - tok.y } : null, bg: false,
    };
    try { svgRef.current.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return;
    d.moved = true;
    const pt = toMap(e.clientX, e.clientY);
    if (!pt) return;
    if (d.tokenId && editable && d.grab) {
      const x = clamp01(pt.x - d.grab.dx);
      const y = clamp01(pt.y - d.grab.dy);
      setDragPos({ id: d.tokenId, x, y });
      onTokenMove?.(d.tokenId, x, y, false);
    } else if (!d.tokenId && onBackgroundDrag) {
      if (!d.bg) { d.bg = true; onBackgroundDrag('start', d.start, d.start); }
      onBackgroundDrag('move', d.start, { x: clamp01(pt.x), y: clamp01(pt.y) });
    }
  };

  const finish = (e, cancelled) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try { svgRef.current.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const pt = toMap(e.clientX, e.clientY) || d.start;
    if (d.tokenId && d.moved && editable && d.grab) {
      const p = snapPoint(clamp01(pt.x - d.grab.dx), clamp01(pt.y - d.grab.dy));
      onTokenMove?.(d.tokenId, p.x, p.y, true);
      setDragPos(null);
      return;
    }
    setDragPos(null);
    if (cancelled) { if (d.bg) onBackgroundDrag?.('cancel', d.start, pt); return; }
    if (d.bg) { onBackgroundDrag?.('end', d.start, { x: clamp01(pt.x), y: clamp01(pt.y) }); return; }
    if (d.moved) return;
    if (d.tokenId) onTokenTap?.(d.tokenId, pt);
    else onTap?.(pt, d.roomId);
  };

  const tokenList = useMemo(() => Object.values(tokens)
    .filter((t) => !level || !t.level || t.level === level)
    .sort((a, b) => (KIND_ORDER[a.kind] ?? 1) - (KIND_ORDER[b.kind] ?? 1) || (a.id === selectedTokenId) - (b.id === selectedTokenId)),
  [tokens, level, selectedTokenId]);

  const labelOffsets = useMemo(() => (showTokens
    ? staggerLabels(tokenList, { W, H, unit, labelMin: tokenLabelMin, minR: tokenMin, rot, flip, dragPos }) : {}),
  [showTokens, tokenList, W, H, unit, tokenLabelMin, tokenMin, rot, flip, dragPos]);
  const roomNames = useMemo(() => {
    const out = {};
    for (const [id, st] of Object.entries(board?.rooms || {})) if (st?.name) out[id] = st.name;
    return out;
  }, [board]);

  /* Engine plans bake the room names into the drawing, so a GM rename (board.rooms[id].name) never showed on the
     TV or the phones: draw renamed rooms' names on a plate over the baked label (visible rooms only). */
  const renamed = mapDef?.kind === 'engine' && !showRoomLabels
    ? rooms.filter((r) => roomNames[r.id] && (role === 'dm' || !(board ? board.fog : true) || board?.rooms?.[r.id]?.revealed))
    : [];

  const now = Date.now();
  const outlineOpacity = role === 'dm' ? 0.35 : 0.72;

  if (!mapDef) return <div className={`map-canvas map-canvas-empty ${className}`} />;

  const canvasCls = `map-canvas ${className}${drift ? ' mc-drift' : ''}${isBoard && cursorHidden ? ' mc-cursor-hidden' : ''}${dimmed ? ' mc-idle-dim' : ''}`;
  return (
    <div className={canvasCls} style={{ ...(cursor ? { cursor } : {}), background: palette.bg }}>
      <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"
        style={dx || dy ? { transform: `translate(${dx}px, ${dy}px)` } : undefined}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, false)} onPointerCancel={(e) => finish(e, true)}
        onContextMenu={(e) => e.preventDefault()}>
        <g ref={innerRef} transform={transform}>
          <rect x={X - W} y={Y - H} width={W * 3} height={H * 3} fill={palette.bg} />
          {engCfg && <EngineLayer config={engCfg} level={level} backdrop={visuals.backdrop} hullStyle={palette.hullStyle} hullAlpha={palette.hullAlpha ?? 1} />}
          {mapDef.kind === 'engine' && !engCfg && (
            <text x={W / 2} y={H / 2} fill="#556" fontSize={unit} textAnchor="middle">DECK PLAN UNAVAILABLE ({mapDef.engine})</text>
          )}
          {imgSrc && <image href={imgSrc} x="0" y="0" width={W} height={H} preserveAspectRatio="none" />}
          {ascii && (
            <AsciiLayer mapDef={mapDef} parsed={ascii} rooms={rooms} W={W} H={H} palette={palette} role={role} uid={`${uid}-al`}
              labelMin={labelMin} counter={counter} rot={rot} roomNames={roomNames} roomState={board?.rooms} fog={board ? board.fog : true} />
          )}
          {mapDef.outline && !ascii && (
            <path d={`M0 0 H1 V1 H0 Z ${mapDef.outline}`} transform={`scale(${W},${H})`} fillRule="evenodd"
              fill={palette.bg} opacity={outlineOpacity} pointerEvents="none" />
          )}
          <RoomLayer rooms={rooms} roomState={board?.rooms} fog={board ? board.fog : true} role={role} W={W} H={H} uid={uid}
            selectedRoomId={selectedRoomId} showLabels={showRoomLabels} counter={counter} unit={unit}
            palette={palette} doors={doors} labelMin={labelMin} />
          {renamed.map((r) => {
            const [cx, cy] = shapeCenter(r.shape);
            const fs = Math.max(unit * 0.42, labelMin);
            const text = roomNames[r.id];
            const w = fs * 0.64 * text.length + fs;
            return (
              <g key={`rn-${r.id}`} className="mc-room-rename" transform={`translate(${cx * W},${cy * H}) ${counter}`} pointerEvents="none">
                <rect x={-w / 2} y={-fs * 0.8} width={w} height={fs * 1.5} rx={fs * 0.2} fill={palette.chipFill || palette.bg} opacity="0.9"
                  stroke={palette.revealedEdge} strokeWidth={Math.max(0.5, fs * 0.05)} />
                <text textAnchor="middle" y={fs * 0.32} fontSize={fs} fill={palette.label} letterSpacing="0.05em" fontFamily={palette.font}>{text}</text>
              </g>
            );
          })}
          {showTokens && tokenList.map((t) => {
            const dp = dragPos?.id === t.id ? dragPos : null;
            return (
              <TokenChip key={t.id} token={t} x={(dp ? dp.x : t.x) * W} y={(dp ? dp.y : t.y) * H} unit={unit} counter={counter} uid={uid}
                selected={t.id === selectedTokenId} mine={!!highlightPlayerId && t.ownerPlayerId === highlightPlayerId}
                ghost={role === 'dm' && t.hidden} dragging={!!dp} palette={palette} labelMin={tokenLabelMin} minR={tokenMin}
                labelDy={labelOffsets[t.id] ?? null}
                flash={flashTokens?.[t.id] || null} active={!!activeTokenId && t.id === activeTokenId} showHp={showHp && role === 'dm'} />
            );
          })}
          {pings.filter((p) => now - (p.rx || p.at) < 4000).map((p) => (
            <g key={p.key || `${p.at}-${p.x}`} transform={`translate(${p.x * W},${p.y * H})`} pointerEvents="none" style={{ color: p.color || '#fff' }}>
              <circle className="ping-ring" r={unit * 1.4} fill="none" stroke="currentColor" strokeWidth={unit * 0.14} />
              <circle className="ping-ring ping-ring-2" r={unit * 1.4} fill="none" stroke="currentColor" strokeWidth={unit * 0.1} />
              <circle className="ping-dot" r={unit * 0.22} fill="currentColor" />
            </g>
          ))}
          {overlay?.({ W, H, unit, counter })}
        </g>
      </svg>
    </div>
  );
});

export default MapCanvas;
