/* Shared helpers for DUNE engine-map geometry (JSX-free, node-importable).
   Each map's *.geometry.js lists rooms/corridors/doors in canvas px; the
   helpers below turn them into the normalized board data of
   docs/BOARD_AND_BUILDER.md §3 (rect shapes in 0..1 of the W×H canvas). */

export const r4 = (n) => Math.round(n * 1e5) / 1e5;

export function normRect({ x, y, w, h }, W, H) {
  return { type: 'rect', x: r4(x / W), y: r4(y / H), w: r4(w / W), h: r4(h / H) };
}

/** rooms: [{ id, name, level, rect, note?, draw? }] → board rooms (draw hints dropped). */
export function boardRooms(rooms, W, H) {
  return rooms.map(({ id, name, level, rect, note }) => ({
    id, name, level, ...(note ? { note } : {}), shape: normRect(rect, W, H),
  }));
}

/** doors: [{ from, to, level, x, y, v, locked? }] → board doors with a normalized `at`. */
export function boardDoors(doors, W, H) {
  return doors.map(({ from, to, level, x, y, locked }) => ({
    from, to, level, locked: !!locked, at: [r4(x / W), r4(y / H)],
  }));
}

/** Door position on a room edge. side: 'n'|'s'|'e'|'w'; t: 0..1 along that edge. */
export function edge(rect, side, t = 0.5) {
  const { x, y, w, h } = rect;
  if (side === 'n') return { x: x + w * t, y, v: false };
  if (side === 's') return { x: x + w * t, y: y + h, v: false };
  if (side === 'w') return { x, y: y + h * t, v: true };
  return { x: x + w, y: y + h * t, v: true };
}

/** Outline path (px) → normalized path string for the board's "outside" dimming. */
export function normPath(points, W, H) {
  return `M ${points.map(([x, y]) => `${r4(x / W)} ${r4(y / H)}`).join(' L ')} Z`;
}

export function pxPath(points) {
  return `M ${points.map(([x, y]) => `${x} ${y}`).join(' L ')} Z`;
}
