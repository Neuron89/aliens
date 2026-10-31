/* MapEngine legend layout (no JSX, so scripts/test-ui-polish.mjs can import it in node).
   See MapLegend in MapEngine.jsx. */

export const LEGEND_MAX_ROWS = 13;
export const LEGEND_COL_W = 172;   // one-column box width (the classic legend)
const LEGEND_CHAR_W = 3.95;        // 6 px mono label + 0.05em tracking, per character

/** Vertices of an absolute "M x y L x y … Z" polygon path (as geometry pxPath() writes), else null. */
export function pathPoints(d) {
  if (typeof d !== 'string' || /[^MLZ0-9.\-\s,eE]/.test(d)) return null;
  const n = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
  if (n.length < 6 || n.length % 2) return null;
  const pts = [];
  for (let i = 0; i < n.length; i += 2) pts.push([n[i], n[i + 1]]);
  return pts;
}

/** True when the closed polygon `pts` touches the rect { x0, y0, x1, y1 } (edges sampled, plus rect-inside-polygon). */
export function polygonHitsRect(pts, r) {
  const inR = ([px, py]) => px >= r.x0 && px <= r.x1 && py >= r.y0 && py <= r.y1;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i]; const [bx, by] = pts[(i + 1) % pts.length];
    for (let t = 0; t <= 24; t++) if (inR([ax + ((bx - ax) * t) / 24, ay + ((by - ay) * t) / 24])) return true;
  }
  const cx = (r.x0 + r.x1) / 2; const cy = (r.y0 + r.y1) / 2; // rect fully inside the polygon?
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]; const [xj, yj] = pts[j];
    if ((yi > cy) !== (yj > cy) && cx < ((xj - xi) * (cy - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** { twoCol, rows, colW, boxW, dx, dy } for legend `items` ([{ y, label }]) drawn at (x, y). */
export function legendLayout(items, { x = 0, y = 0, columns = 'auto', hullPath = null } = {}) {
  const resolved = items;
  const longest = Math.max(...resolved.map((it) => String(it.label || '').length));
  const colW2 = Math.max(96, Math.ceil(20 + longest * LEGEND_CHAR_W + 10));
  const half = Math.ceil(resolved.length / 2);
  let twoCol = columns === 2;
  if (columns === 'auto' && resolved.length > LEGEND_MAX_ROWS) {
    const pts = pathPoints(hullPath);
    const w2 = colW2 * 2 + 6;
    const box = { x0: x - (w2 - LEGEND_COL_W) - 10, y0: y - 15, x1: x - 10 + LEGEND_COL_W, y1: y + resolved[half - 1].y + 15 };
    twoCol = !pts || !polygonHitsRect(pts, box);
  }
  const rows = twoCol ? half : resolved.length;
  const colW = twoCol ? colW2 : LEGEND_COL_W;
  const boxW = twoCol ? colW * 2 + 6 : LEGEND_COL_W;
  const dx = boxW - LEGEND_COL_W; // grow leftwards, keep the right edge
  const dy = twoCol ? resolved[rows].y - resolved[0].y : 0;
  return { twoCol, rows, colW, boxW, dx, dy };
}
