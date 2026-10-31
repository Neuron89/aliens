/* ═══════════════════════════════════════════════════════════════
   VRAM HAND-OFF — the GPU box is shared by ComfyUI (portraits) and Ollama
   (AI GM narration). Before one runs, ask the other to let go of the card.
   docs/AI_GM.md "VRAM hand-off".

   releaseForLlm()    → before a narration: POST {COMFY_URL}/free
                        { unload_models: true, free_memory: true }, at most once per 60 s.
   releaseForImages() → before a portrait: GET {ollama}/api/ps, then for each loaded
                        model POST {ollama}/api/generate { model, keep_alive: 0 } (Ollama's unload).
   vramReach()        → { comfy: bool, ollama: bool } reachability (3 s probes).
   Every call has 3 s timeouts and never throws; each returns { released, reason, ... }.
   Env: COMFY_URL (same default as server/portrait.js), GM_URL (Ollama's /v1 base;
   the root is GM_URL without the trailing /v1).
   ═══════════════════════════════════════════════════════════════ */
import { loadEnv } from './generator/env.js';

loadEnv();

const TIMEOUT_MS = 3000;
export const LLM_RELEASE_TTL_MS = 60 * 1000;

export const comfyBase = () => String(process.env.COMFY_URL || 'http://192.168.1.37:8188').trim().replace(/\/+$/, '');
/** Ollama's native root: GM_URL without a trailing /v1 ('' when GM_URL is unset). */
export const ollamaRoot = (url = process.env.GM_URL) => String(url || '').trim().replace(/\/+$/, '').replace(/\/v1$/, '');

const req = async (url, { method = 'GET', body } = {}) => fetch(url, {
  method,
  headers: body ? { 'Content-Type': 'application/json' } : undefined,
  body: body ? JSON.stringify(body) : undefined,
  signal: AbortSignal.timeout(TIMEOUT_MS),
});

let lastLlmRelease = 0;
/** Test hook: forget the 60 s throttle. */
export function resetVramThrottle() { lastLlmRelease = 0; }

/** Free ComfyUI's models before the LLM loads. Throttled to once per 60 s. Never throws. */
export async function releaseForLlm({ comfy = comfyBase(), force = false } = {}) {
  try {
    if (!comfy) return { released: false, reason: 'no COMFY_URL' };
    const now = Date.now();
    if (!force && now - lastLlmRelease < LLM_RELEASE_TTL_MS) return { released: false, reason: 'throttled' };
    lastLlmRelease = now; // a failed attempt also counts, so an offline ComfyUI is not re-tried on every narration
    const r = await req(`${comfy}/free`, { method: 'POST', body: { unload_models: true, free_memory: true } });
    return r.ok ? { released: true, reason: 'comfy /free' } : { released: false, reason: `comfy HTTP ${r.status}` };
  } catch (e) {
    return { released: false, reason: `comfy unreachable: ${e?.message || e}` };
  }
}

/** Unload every model Ollama holds before ComfyUI renders. Never throws. */
export async function releaseForImages({ ollama = ollamaRoot() } = {}) {
  try {
    if (!ollama) return { released: false, reason: 'no GM_URL', models: [] };
    const r = await req(`${ollama}/api/ps`);
    if (!r.ok) return { released: false, reason: `ollama HTTP ${r.status}`, models: [] };
    const j = await r.json().catch(() => ({}));
    const models = (Array.isArray(j?.models) ? j.models : []).map((m) => m?.model || m?.name).filter((m) => typeof m === 'string' && m);
    const unloaded = [];
    for (const model of models) {
      try {
        const u = await req(`${ollama}/api/generate`, { method: 'POST', body: { model, keep_alive: 0 } });
        if (u.ok) unloaded.push(model);
        await u.text().catch(() => {});
      } catch { /* next model */ }
    }
    return { released: unloaded.length > 0, reason: models.length ? `unloaded ${unloaded.length}/${models.length}` : 'nothing loaded', models: unloaded };
  } catch (e) {
    return { released: false, reason: `ollama unreachable: ${e?.message || e}`, models: [] };
  }
}

/** { comfy, ollama } reachability for the status line. Never throws. */
export async function vramReach({ comfy = comfyBase(), ollama = ollamaRoot() } = {}) {
  const probe = async (url) => { if (!url) return false; try { const r = await req(url); await r.text().catch(() => {}); return r.ok; } catch { return false; } };
  const [c, o] = await Promise.all([probe(comfy && `${comfy}/system_stats`), probe(ollama && `${ollama}/api/ps`)]);
  return { comfy: c, ollama: o };
}
