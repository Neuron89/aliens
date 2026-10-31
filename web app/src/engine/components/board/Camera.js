/* ═══════════════════════════════════════════════════════════════
   Camera — the TV director camera + combat spotlight (F2).
   Pure, JSX-free and node-importable (scripts/test-camera.mjs).

   board.view.camera = { mode, spotlight, target } (server/board.js
   sanitizeCamera):
   - mode 'fixed'      the plain fitted plan (old behaviour)
          'follow'     frame the revealed rooms that hold PC tokens;
                       re-frame when someone enters a room or the GM
                       reveals one; a GM ping briefly zooms toward it
          'cinematic'  follow + slow drift, vignette and an edge
                       treatment (CRT for 'scan' palettes, heat shimmer
                       for 'dust' ones)
   - spotlight         combat: dim everything but the active initiative
                       token's room
   - target            a room the GM pinned (only framed once visible)

   Coordinates: "normalized" = 0..1 of the map (tokens / room shapes);
   "local" = CSS px inside the TV's map <svg> before the camera
   transform. viewGeometry() mirrors MapCanvas (crop → zoom → pan →
   flip → rotation → viewBox "meet" fit), so framing honours the TV
   rotation / flip. The camera itself is a CSS transform
   translate(tx,ty) scale(s) with origin 0 0 on the canvas wrapper.
   ═══════════════════════════════════════════════════════════════ */

export const CAMERA_MODES = ['fixed', 'follow', 'cinematic'];
export const EASE_MS = 900;          // camera move
export const SPOT_MS = 650;          // spotlight slide
export const PING_BEAT_MS = 2600;    // GM ping zoom, then back
export const REVEAL_BEAT_MS = 3600;  // a reveal joins the frame for a beat
export const WIPE_MS = 1150;         // reveal wipe
export const FOLLOW_MAX = 2.6;
export const PING_MAX = 2.1;
export const CINEMATIC_MIN = 1.04;   // a hair of zoom so the drift never shows the frame edge
export const IDENTITY = Object.freeze({ s: 1, tx: 0, ty: 0 });

export function normalizeCamera(c) {
  const mode = CAMERA_MODES.includes(c?.mode) ? c.mode : 'fixed';
  return { mode, spotlight: c?.spotlight === true, target: typeof c?.target === 'string' ? c.target : null };
}

/* ─── Boxes (normalized unless noted) ─── */
export function shapeBox(shape) {
  if (!shape) return null;
  if (shape.type === 'rect') return { x0: shape.x, y0: shape.y, x1: shape.x + shape.w, y1: shape.y + shape.h };
  if (shape.type === 'poly' && Array.isArray(shape.points) && shape.points.length) {
    const xs = shape.points.map((p) => p[0]);
    const ys = shape.points.map((p) => p[1]);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  }
  return null;
}
export function unionBox(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}
/** A box of `r` grid units around a point (y radius corrected for the map aspect). */
export function pointBox(x, y, r, grid = 1 / 40, W = 1, H = 1) {
  const rx = r * (grid || 1 / 40);
  const ry = (rx * W) / (H || 1);
  return { x0: x - rx, y0: y - ry, x1: x + rx, y1: y + ry };
}
export function padBox(b, r, grid = 1 / 40, W = 1, H = 1) {
  if (!b) return b;
  const rx = r * (grid || 1 / 40);
  const ry = (rx * W) / (H || 1);
  return { x0: b.x0 - rx, y0: b.y0 - ry, x1: b.x1 + rx, y1: b.y1 + ry };
}

/* ─── Rooms / visibility ─── */
export function levelRooms(mapDef, level) {
  return (mapDef?.rooms || []).filter((r) => r?.shape && (!level || !r.level || r.level === level));
}
export function roomVisible(board, id) {
  if (!board || !id) return false;
  return !board.fog || !!board.rooms?.[id]?.revealed;
}
export function roomBox(mapDef, level, id) {
  const r = levelRooms(mapDef, level).find((x) => x.id === id);
  return r ? shapeBox(r.shape) : null;
}
/** Rooms on this level the GM has revealed (fog on). */
export function revealedSet(board, mapDef, level) {
  const out = new Set();
  if (!board?.fog) return out;
  for (const r of levelRooms(mapDef, level)) if (board.rooms?.[r.id]?.revealed) out.add(r.id);
  return out;
}
/** Ids in `next` not in `prev` (prev null = first look: nothing is "new"). */
export function newlyRevealed(prev, next) {
  if (!prev) return [];
  return [...next].filter((id) => !prev.has(id));
}
const onLevel = (t, level) => !level || !t.level || t.level === level;

/** FOLLOW framing: the visible rooms holding PC tokens (+ PCs outside every room as small boxes). null = nothing to frame. */
export function followBox({ mapDef, board, level, W = 1, H = 1 }) {
  if (!mapDef || !board) return null;
  const grid = mapDef.grid || 1 / 40;
  const anyRevealed = !board.fog || Object.values(board.rooms || {}).some((r) => r?.revealed);
  let box = null;
  const seen = new Set();
  for (const t of Object.values(board.tokens || {})) {
    if (t?.kind !== 'pc' || !onLevel(t, level)) continue;
    const rb = t.roomId && roomVisible(board, t.roomId) ? roomBox(mapDef, level, t.roomId) : null;
    if (rb) {
      if (seen.has(t.roomId)) continue;
      seen.add(t.roomId);
      box = unionBox(box, padBox(rb, 1, grid, W, H));
    } else if (!t.roomId && anyRevealed) {
      box = unionBox(box, pointBox(t.x, t.y, 4, grid, W, H));
    }
  }
  return box;
}

/** SPOTLIGHT focus: the token's room when the TV may see it, else a small box around the token. */
export function tokenFocusBox({ mapDef, board, level, tokenId, W = 1, H = 1 }) {
  const t = tokenId ? board?.tokens?.[tokenId] : null;
  if (!t || !onLevel(t, level)) return null;
  const grid = mapDef?.grid || 1 / 40;
  if (t.roomId && roomVisible(board, t.roomId)) {
    const rb = roomBox(mapDef, level, t.roomId);
    if (rb) return padBox(rb, 1.2, grid, W, H);
  }
  return pointBox(t.x, t.y, 3, grid, W, H);
}

/* ─── Geometry (mirrors MapCanvas) ─── */
export function viewGeometry({ W, H, crop, view }) {
  const c = crop || { x: 0, y: 0, w: 1, h: 1 };
  const zoom = view?.zoom || 1;
  const pan = view?.pan || [0, 0];
  const Wc = (c.w * W) / zoom;
  const Hc = (c.h * H) / zoom;
  const X = c.x * W + (c.w * W - Wc) / 2 + pan[0] * c.w * W;
  const Y = c.y * H + (c.h * H - Hc) / 2 + pan[1] * c.h * H;
  const rot = [0, 90, 180, 270].includes(view?.rotation) ? view.rotation : 0;
  const flip = !!view?.flipX;
  return { W, H, X, Y, Wc, Hc, rot, flip, VW: rot % 180 ? Hc : Wc, VH: rot % 180 ? Wc : Hc };
}

/** Normalized map point → local CSS px in a cw × ch svg (viewBox fitted with "xMidYMid meet"). */
export function mapToLocal(geo, cw, ch, x, y) {
  const { W, H, X, Y, Wc, Hc, rot, flip, VW, VH } = geo;
  let a = x * W - X;
  const b = y * H - Y;
  if (flip) a = Wc - a;
  let vx = a;
  let vy = b;
  if (rot === 90) { vx = Hc - b; vy = a; } else if (rot === 180) { vx = Wc - a; vy = Hc - b; } else if (rot === 270) { vx = b; vy = Wc - a; }
  const k = Math.min(cw / VW, ch / VH);
  const ox = (cw - VW * k) / 2;
  const oy = (ch - VH * k) / 2;
  return [ox + vx * k, oy + vy * k];
}
export function boxToLocal(geo, cw, ch, box) {
  if (!box || !geo) return null;
  const pts = [[box.x0, box.y0], [box.x1, box.y0], [box.x0, box.y1], [box.x1, box.y1]].map(([x, y]) => mapToLocal(geo, cw, ch, x, y));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** The fitted map window in local px (the letterboxed area the plan actually covers). */
export function contentLocal(geo, cw, ch) {
  const k = Math.min(cw / geo.VW, ch / geo.VH);
  const ox = (cw - geo.VW * k) / 2;
  const oy = (ch - geo.VH * k) / 2;
  return { x0: ox, y0: oy, x1: ox + geo.VW * k, y1: oy + geo.VH * k };
}

/* One axis: centre on c, then keep the content covering the view (or centre the content when it is smaller). */
function clampAxis(view, s, c, lo0, hi0) {
  const t = view / 2 - s * c;
  const lo = view - s * hi0; // content's far edge at the view's far edge
  const hi = -s * lo0;       // content's near edge at the view's near edge
  if (lo <= hi) return Math.min(hi, Math.max(lo, t));
  return view / 2 - s * ((lo0 + hi0) / 2);
}

/** Camera that centres a local box with a margin; s in [minScale, maxScale]. It never pans past the
    map (`content`, default the whole frame) into empty letterbox space. */
export function frameLocal(lb, cw, ch, { margin = 0.07, maxScale = FOLLOW_MAX, minScale = 1, content = null } = {}) {
  if (!lb || !(cw > 0) || !(ch > 0)) return { ...IDENTITY };
  const c = content || { x0: 0, y0: 0, x1: cw, y1: ch };
  const bw = Math.max(1, lb.x1 - lb.x0);
  const bh = Math.max(1, lb.y1 - lb.y0);
  let s = Math.min((cw * (1 - 2 * margin)) / bw, (ch * (1 - 2 * margin)) / bh);
  s = Math.min(maxScale, Math.max(minScale, s));
  const tx = clampAxis(cw, s, (lb.x0 + lb.x1) / 2, c.x0, c.x1);
  const ty = clampAxis(ch, s, (lb.y0 + lb.y1) / 2, c.y0, c.y1);
  return { s, tx: tx + 0, ty: ty + 0 }; // + 0: no -0
}
/** The no-target camera (centred; cinematic keeps a hair of zoom for the drift). */
export function restingCamera(cw, ch, minScale = 1) {
  return { s: minScale, tx: (cw - minScale * cw) / 2, ty: (ch - minScale * ch) / 2 };
}

/* ─── Easing ─── */
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
export function lerpCam(a, b, t) {
  return { s: a.s + (b.s - a.s) * t, tx: a.tx + (b.tx - a.tx) * t, ty: a.ty + (b.ty - a.ty) * t };
}
export function lerpBox(a, b, t) {
  return { x0: a.x0 + (b.x0 - a.x0) * t, y0: a.y0 + (b.y0 - a.y0) * t, x1: a.x1 + (b.x1 - a.x1) * t, y1: a.y1 + (b.y1 - a.y1) * t };
}
/** Same framing within half a pixel / 0.2 % zoom (skips needless re-eases). */
export function camClose(a, b) {
  return !!a && !!b && Math.abs(a.s - b.s) < 0.002 && Math.abs(a.tx - b.tx) < 0.5 && Math.abs(a.ty - b.ty) < 0.5;
}
export function boxClose(a, b, eps = 1e-4) {
  if (!a || !b) return a === b;
  return Math.abs(a.x0 - b.x0) < eps && Math.abs(a.y0 - b.y0) < eps && Math.abs(a.x1 - b.x1) < eps && Math.abs(a.y1 - b.y1) < eps;
}
export const camCss = (c) => `translate3d(${c.tx.toFixed(2)}px, ${c.ty.toFixed(2)}px, 0) scale(${c.s.toFixed(4)})`;

/* ─── Spotlight dim: an outer rectangle with a rounded hole (fill-rule evenodd), map px ─── */
export function spotPath(outer, hole, r = 0) {
  const o = `M${outer.x0} ${outer.y0}H${outer.x1}V${outer.y1}H${outer.x0}Z`;
  if (!hole) return o;
  const w = hole.x1 - hole.x0;
  const h = hole.y1 - hole.y0;
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  const { x0, y0, x1, y1 } = hole;
  return `${o}M${x0 + rr} ${y0}H${x1 - rr}A${rr} ${rr} 0 0 1 ${x1} ${y0 + rr}V${y1 - rr}A${rr} ${rr} 0 0 1 ${x1 - rr} ${y1}`
    + `H${x0 + rr}A${rr} ${rr} 0 0 1 ${x0} ${y1 - rr}V${y0 + rr}A${rr} ${rr} 0 0 1 ${x0 + rr} ${y0}Z`;
}
/** Just the rounded hole (the spotlight's lit edge). */
export function roundRect(hole, r = 0) {
  if (!hole) return '';
  const full = spotPath({ x0: 0, y0: 0, x1: 0, y1: 0 }, hole, r);
  return full.slice(full.indexOf('Z') + 1);
}
export const scaleBox =(b, W, H) => (b ? { x0: b.x0 * W, y0: b.y0 * H, x1: b.x1 * W, y1: b.y1 * H } : null);

/** Edge treatment for CINEMATIC from the board palette's reveal style (a map palette may set cameraEdge). */
export function edgeStyle(palette) {
  if (palette?.cameraEdge) return palette.cameraEdge;
  if (palette?.reveal === 'scan') return 'crt';
  if (palette?.reveal === 'dust') return 'heat';
  return 'plain';
}

/** What the camera frames right now (normalized box + max zoom), or null for the resting view.
    Priority: spotlight actor > GM ping beat > GM-pinned room > PC rooms (+ a fresh reveal for a beat). */
export function chooseShot({ cam, mapDef, board, level, W = 1, H = 1, spotBox = null, pingBox = null, revealBox = null }) {
  if (!cam || cam.mode === 'fixed') return null;
  if (spotBox) return { box: spotBox, maxScale: FOLLOW_MAX, why: 'spotlight' };
  if (pingBox) return { box: pingBox, maxScale: PING_MAX, why: 'ping' };
  if (cam.target && roomVisible(board, cam.target)) {
    const rb = roomBox(mapDef, level, cam.target);
    if (rb) return { box: padBox(rb, 1, mapDef?.grid, W, H), maxScale: FOLLOW_MAX, why: 'target' };
  }
  const f = followBox({ mapDef, board, level, W, H });
  if (!f) return null;
  return revealBox ? { box: unionBox(f, revealBox), maxScale: FOLLOW_MAX, why: 'reveal' } : { box: f, maxScale: FOLLOW_MAX, why: 'follow' };
}
