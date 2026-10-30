import React from 'react';

/* ═══════════════════════════════════════════════════════════════
   RoomLayer — fog of war + room hit areas, in map px.
   Each room is one shape: unrevealed → dark fog (opacity transition
   ~500 ms, see .rm-fog in index.css) with a faint outline; revealed →
   transparent. The DM sees fog translucent + hatched so the map stays
   readable; the board and phones get near-opaque fog.
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

function Shape({ shape, W, H, ...rest }) {
  const { tag, props } = shapeProps(shape, W, H);
  return tag === 'rect' ? <rect {...props} {...rest} /> : <polygon {...props} {...rest} />;
}

export default function RoomLayer({
  rooms, roomState = {}, fog, role, W, H, uid, selectedRoomId, showLabels, counter = '', unit,
}) {
  const dm = role === 'dm';
  const fogOpacity = dm ? 0.5 : 0.94;
  const stroke = Math.max(0.6, unit * 0.05);
  return (
    <g className={`rm-layer rm-${role}`}>
      {dm && (
        <defs>
          <pattern id={`${uid}-foghatch`} width={unit * 0.6} height={unit * 0.6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2={unit * 0.6} stroke="#8899aa" strokeWidth={stroke} opacity="0.35" />
          </pattern>
        </defs>
      )}
      {rooms.map((r) => {
        const st = roomState[r.id];
        const revealed = !fog || !!st?.revealed;
        const selected = r.id === selectedRoomId;
        return (
          <g key={r.id} data-room={r.id} className={`rm${revealed ? ' rm-revealed' : ''}${selected ? ' rm-selected' : ''}`}>
            <Shape shape={r.shape} W={W} H={H} className="rm-fog" fill="#020304"
              style={{ opacity: revealed ? 0 : fogOpacity }} />
            {dm && !revealed && <Shape shape={r.shape} W={W} H={H} fill={`url(#${uid}-foghatch)`} pointerEvents="none" />}
            <Shape shape={r.shape} W={W} H={H} className="rm-hit" fill="transparent"
              stroke={selected ? '#ffffff' : revealed ? (dm ? 'rgba(120,220,190,0.35)' : 'none') : 'rgba(150,170,190,0.28)'}
              strokeWidth={selected ? 2.5 : 1} strokeDasharray={revealed ? undefined : '5 4'}
              vectorEffect="non-scaling-stroke" />
          </g>
        );
      })}
      {showLabels && rooms.map((r) => {
        const st = roomState[r.id];
        if (!dm && fog && !st?.revealed) return null;
        const [cx, cy] = shapeCenter(r.shape);
        const fs = unit * 0.42;
        return (
          <g key={`l-${r.id}`} transform={`translate(${cx * W},${cy * H}) ${counter}`} pointerEvents="none">
            <text textAnchor="middle" y={fs * 0.35} fontSize={fs} fill="#e8f0f0" stroke="#000" strokeWidth={fs * 0.18} paintOrder="stroke" letterSpacing="0.05em">
              {st?.name || r.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}
