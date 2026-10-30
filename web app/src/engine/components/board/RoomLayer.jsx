import React from 'react';
import { DEFAULT_BOARD_PALETTE } from './mapDefs';

/* ═══════════════════════════════════════════════════════════════
   RoomLayer — fog of war + room hit areas, in map px.
   Each room is one shape: unrevealed → fog (opacity transition, see
   .rm-fog / .rm-reveal-* in index.css) with a faint outline; revealed →
   transparent. The DM sees fog translucent + hatched so the map stays
   readable; the board and phones get near-opaque fog.

   `palette` (board/mapDefs.mapVisuals) colours the fog, edges and labels
   per universe/map; palette.reveal picks the dissolve: 'scan' (ALIEN,
   stepped CRT dissolve), 'dust' (DUNE, slow fade with a grain veil that
   lingers), else a plain fade.

   `doors` (image maps only; engine maps draw their own): small gap marks
   at door.at [x, y] (normalized), or at the midpoint of the shared edge
   between door.from and door.to rooms. Locked doors get a bar.
   ═══════════════════════════════════════════════════════════════ */

export function shapeProps(shape, W, H) {
  if (shape.type === 'rect') return { tag: 'rect', props: { x: shape.x * W, y: shape.y * H, width: shape.w * W, height: shape.h * H } };
  return { tag: 'polygon', props: { points: shape.points.map(([x, y]) => `${x * W},${y * H}`).join(' ') } };
}

export function shapeCenter(shape) {
  if (shape.type === 'rect') return [shape.x + shape.w / 2, shape.y + shape.h / 2];
  const n = shape.points.length;
  return shape.points.reduce((a, [x, y]) => [a[0] + x / n, a[1] + y / n], [0, 0]);
}

function bbox(shape) {
  if (shape.type === 'rect') return { x0: shape.x, y0: shape.y, x1: shape.x + shape.w, y1: shape.y + shape.h };
  const xs = shape.points.map((p) => p[0]);
  const ys = shape.points.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Door position + orientation: explicit `at`, else the midpoint of the shared edge of two rooms. */
export function doorPlacement(door, rooms) {
  if (Array.isArray(door.at) && door.at.length === 2) {
    const a = rooms.find((r) => r.id === door.from);
    let vertical = false;
    if (a?.shape) {
      const b = bbox(a.shape);
      const [x, y] = door.at;
      vertical = Math.min(Math.abs(x - b.x0), Math.abs(x - b.x1)) < Math.min(Math.abs(y - b.y0), Math.abs(y - b.y1));
    }
    return { x: door.at[0], y: door.at[1], vertical };
  }
  const a = rooms.find((r) => r.id === door.from);
  const b = rooms.find((r) => r.id === door.to);
  if (!a?.shape || !b?.shape) return null;
  const A = bbox(a.shape);
  const B = bbox(b.shape);
  const tol = 0.012;
  const ox0 = Math.max(A.x0, B.x0); const ox1 = Math.min(A.x1, B.x1);
  const oy0 = Math.max(A.y0, B.y0); const oy1 = Math.min(A.y1, B.y1);
  if (Math.abs(A.x1 - B.x0) < tol || Math.abs(B.x1 - A.x0) < tol) {
    if (oy1 <= oy0) return null;
    const x = Math.abs(A.x1 - B.x0) < tol ? (A.x1 + B.x0) / 2 : (B.x1 + A.x0) / 2;
    return { x, y: (oy0 + oy1) / 2, vertical: true };
  }
  if (Math.abs(A.y1 - B.y0) < tol || Math.abs(B.y1 - A.y0) < tol) {
    if (ox1 <= ox0) return null;
    const y = Math.abs(A.y1 - B.y0) < tol ? (A.y1 + B.y0) / 2 : (B.y1 + A.y0) / 2;
    return { x: (ox0 + ox1) / 2, y, vertical: false };
  }
  return null;
}

function Shape({ shape, W, H, ...rest }) {
  const { tag, props } = shapeProps(shape, W, H);
  return tag === 'rect' ? <rect {...props} {...rest} /> : <polygon {...props} {...rest} />;
}

function DoorMarks({ doors, rooms, W, H, unit, palette, roomState, fog, dm }) {
  const len = unit * 0.9;
  const gap = unit * 0.16;
  return (
    <g className="rm-doors" pointerEvents="none">
      {doors.map((d, i) => {
        const p = doorPlacement(d, rooms);
        if (!p) return null;
        // On the board a door shows only once one of its rooms is revealed.
        if (!dm && fog && !roomState[d.from]?.revealed && !roomState[d.to]?.revealed) return null;
        const x = p.x * W;
        const y = p.y * H;
        const color = d.locked ? '#ff7043' : palette.door;
        return (
          <g key={i} transform={`translate(${x},${y}) rotate(${p.vertical ? 90 : 0})`}>
            <rect x={-len / 2} y={-gap * 1.6} width={len} height={gap * 3.2} fill={palette.bg || '#000'} opacity="0.85" />
            <line x1={-len / 2} y1={-gap} x2={-len / 2} y2={gap} stroke={color} strokeWidth={unit * 0.08} />
            <line x1={len / 2} y1={-gap} x2={len / 2} y2={gap} stroke={color} strokeWidth={unit * 0.08} />
            <line x1={-len / 2 + gap} y1={0} x2={len / 2 - gap} y2={0} stroke={color} strokeWidth={unit * 0.04} strokeDasharray={`${unit * 0.1} ${unit * 0.08}`} opacity="0.8" />
            {d.locked && <rect x={-gap * 1.4} y={-gap * 1.4} width={gap * 2.8} height={gap * 2.8} fill={color} />}
          </g>
        );
      })}
    </g>
  );
}

export default function RoomLayer({
  rooms, roomState = {}, fog, role, W, H, uid, selectedRoomId, showLabels, counter = '', unit,
  palette = DEFAULT_BOARD_PALETTE, doors = null, labelMin = 0,
}) {
  const dm = role === 'dm';
  const fogOpacity = dm ? 0.5 : 0.94;
  const stroke = Math.max(0.6, unit * 0.05);
  const reveal = palette.reveal || 'fade';
  const dust = reveal === 'dust';
  return (
    <g className={`rm-layer rm-${role} rm-reveal-${reveal}`}>
      <defs>
        {dm && (
          <pattern id={`${uid}-foghatch`} width={unit * 0.6} height={unit * 0.6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2={unit * 0.6} stroke={palette.fogHatch} strokeWidth={stroke} opacity="0.35" />
          </pattern>
        )}
        {dust && !dm && (
          <pattern id={`${uid}-fogdust`} width={unit * 1.6} height={unit * 1.6} patternUnits="userSpaceOnUse">
            {[[0.2, 0.3], [0.7, 0.15], [1.1, 0.8], [0.4, 1.2], [1.3, 1.35], [0.9, 0.5]].map(([x, y], i) => (
              <circle key={i} cx={x * unit} cy={y * unit} r={unit * (0.03 + (i % 3) * 0.015)} fill={palette.fogHatch} opacity="0.35" />
            ))}
          </pattern>
        )}
      </defs>
      {rooms.map((r) => {
        const st = roomState[r.id];
        const revealed = !fog || !!st?.revealed;
        const selected = r.id === selectedRoomId;
        return (
          <g key={r.id} data-room={r.id} className={`rm${revealed ? ' rm-revealed' : ''}${selected ? ' rm-selected' : ''}`}>
            <Shape shape={r.shape} W={W} H={H} className="rm-fog" fill={palette.fog}
              style={{ opacity: revealed ? 0 : fogOpacity }} />
            {dust && !dm && <Shape shape={r.shape} W={W} H={H} className="rm-fog-grain" fill={`url(#${uid}-fogdust)`} pointerEvents="none" style={{ opacity: revealed ? 0 : 1 }} />}
            {dm && !revealed && <Shape shape={r.shape} W={W} H={H} fill={`url(#${uid}-foghatch)`} pointerEvents="none" />}
            <Shape shape={r.shape} W={W} H={H} className="rm-hit" fill="transparent"
              stroke={selected ? '#ffffff' : revealed ? (dm ? palette.revealedEdge : 'none') : palette.fogEdge}
              strokeWidth={selected ? 2.5 : 1} strokeDasharray={revealed ? undefined : '5 4'}
              vectorEffect="non-scaling-stroke" />
          </g>
        );
      })}
      {doors?.length > 0 && <DoorMarks doors={doors} rooms={rooms} W={W} H={H} unit={unit} palette={palette} roomState={roomState} fog={fog} dm={dm} />}
      {showLabels && rooms.map((r) => {
        const st = roomState[r.id];
        if (!dm && fog && !st?.revealed) return null;
        const [cx, cy] = shapeCenter(r.shape);
        const fs = Math.max(unit * 0.42, labelMin);
        return (
          <g key={`l-${r.id}`} transform={`translate(${cx * W},${cy * H}) ${counter}`} pointerEvents="none">
            <text textAnchor="middle" y={fs * 0.35} fontSize={fs} fill={palette.label} stroke={palette.labelStroke} strokeWidth={fs * 0.18}
              paintOrder="stroke" letterSpacing="0.05em" fontFamily={palette.font}>
              {st?.name || r.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}
