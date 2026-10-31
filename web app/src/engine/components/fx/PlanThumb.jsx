import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import EngineLayer from '../board/EngineLayer';
import { firstPlan } from '../mapGroups';

/* ═══════════════════════════════════════════════════════════════
   PlanThumb — a small static picture of a pack's first engine plan
   (its first level, cropped to the plan's crop rect) for the Stories
   library cards.

   The plan is rendered once, off-screen, through EngineLayer, then
   serialised into a standalone SVG and shown as an <img>. An <img>
   keeps each plan's pattern / clip-path ids (MapEngine's pid()) in
   their own document, so fifteen plans on one page never collide.
   Results are cached per pack id for the life of the page; renders
   are queued one per frame so opening the library does not stall.
   ═══════════════════════════════════════════════════════════════ */

const cache = new Map();   // pack id → object URL | null (no plan)
const waiting = new Map(); // pack id → Set<setState>
const queue = [];
let busy = false;

function renderPlan({ config, level, crop }, hullStyle, hullAlpha) {
  const W = config.width || 1100;
  const H = config.height || 920;
  const c = crop || { x: 0, y: 0, w: 1, h: 1 };
  const x = c.x * W; const y = c.y * H; const w = c.w * W; const h = c.h * H;
  const tall = h > w * 1.15; // tall ships lie on their side so they fill a wide card strip
  const vb = tall ? `${y} ${-(x + w)} ${h} ${w}` : `${x} ${y} ${w} ${h}`; // rotate(-90): (px, py) → (py, -px)
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={vb} preserveAspectRatio="xMidYMid slice">
      <g transform={tall ? 'rotate(-90)' : undefined}>
        <EngineLayer config={config} level={level} hullStyle={hullStyle} hullAlpha={hullAlpha} />
      </g>
    </svg>,
  ));
  const svg = host.innerHTML;
  root.unmount();
  return URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
}

function pump() {
  if (busy) return;
  const job = queue.shift();
  if (!job) return;
  busy = true;
  const run = () => {
    let url = null;
    try { url = renderPlan(job.plan, job.hullStyle, job.hullAlpha); } catch (e) { console.warn('[PlanThumb]', job.id, e); }
    cache.set(job.id, url);
    for (const set of waiting.get(job.id) || []) set(url);
    waiting.delete(job.id);
    busy = false;
    pump();
  };
  (window.requestIdleCallback || ((f) => setTimeout(f, 16)))(run, { timeout: 400 });
}

export default function PlanThumb({ universe, pack, fallback }) {
  const id = `${universe?.id}:${pack?.id}`;
  const [url, setUrl] = useState(() => cache.get(id));
  const plan = cache.has(id) ? null : firstPlan(universe, pack);
  useEffect(() => {
    if (cache.has(id)) { setUrl(cache.get(id)); return undefined; }
    if (!plan) { cache.set(id, null); setUrl(null); return undefined; }
    if (!waiting.has(id)) {
      waiting.set(id, new Set());
      const board = universe?.theme?.board || {};
      queue.push({ id, plan, hullStyle: board.hullStyle || 'solid', hullAlpha: board.hullAlpha ?? 1 });
    }
    waiting.get(id).add(setUrl);
    pump();
    return () => waiting.get(id)?.delete(setUrl);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (url) return <img className="plan-thumb" src={url} alt="" />;
  return fallback;
}

/** True when the pack has an engine plan to draw (so the card can prefer it to the motif). */
export function hasPlan(universe, pack) { return !!firstPlan(universe, pack); }
