/* ═══════════════════════════════════════════════════════════════
   GENERATOR — Claude-backed content pack generator (REST: /api/generate).

   POST /api/generate   body { universeId, params }
     Default: Server-Sent Events (text/event-stream)
       event: status  data: { message, estimatedInputTokens?, model?, ... }
       event: delta   data: { chars }          (characters streamed so far)
       event: done    data: { pack, repaired }
       event: error   data: { message, code, status, errors?, hint? }
       ": keepalive" comment every 15 s.
     With `Accept: application/json` (and no text/event-stream) it answers
     with plain JSON: 200 { pack } | 4xx/5xx { error, ... }.
   GET  /api/generate/status → { configured, mock, model, effort, fallbacks }

   Pre-flight failures (not configured, bad params, unknown universe) are
   always plain JSON with a 4xx status, before any SSE starts.
   Generation never saves: the client previews then PUTs /api/content/...
   Logic lives in ./generator/core.js (shared with scripts/generate-pack.mjs).
   ═══════════════════════════════════════════════════════════════ */
import { Router } from 'express';
import { generatorConfig, loadEnv } from './generator/env.js';
import { generatePack, prepare, GeneratorError } from './generator/core.js';

loadEnv();

const MAX_CONCURRENT = Number(process.env.GENERATOR_MAX_CONCURRENT) || 2;
let active = 0;

function errorBody(e) {
  const body = { error: e.code || 'internal', message: e.message };
  if (e.errors) body.errors = e.errors;
  if (e.hint) body.hint = e.hint;
  return body;
}

export function createGenerateRouter() {
  const router = Router();

  router.get('/status', (req, res) => {
    const cfg = generatorConfig();
    res.json({
      configured: cfg.mock || !!cfg.apiKey,
      mock: cfg.mock,
      model: cfg.mock ? 'mock' : cfg.model,
      effort: cfg.effort,
      fallbacks: cfg.fallbacks,
    });
  });

  router.post('/', async (req, res) => {
    const cfg = generatorConfig();
    const { universeId, params } = req.body || {};

    // ── Pre-flight (plain JSON) ──
    if (!cfg.mock && !cfg.apiKey) {
      return res.status(400).json({ error: 'generator_not_configured', hint: 'set ANTHROPIC_API_KEY in web app/.env' });
    }
    try {
      await prepare({ universeId, params });
    } catch (e) {
      const ge = e instanceof GeneratorError ? e : new GeneratorError('internal', e.message);
      return res.status(ge.status).json(errorBody(ge));
    }
    if (active >= MAX_CONCURRENT) {
      return res.status(429).json({ error: 'busy', message: `Already running ${active} generation(s); try again shortly.` });
    }

    const accept = String(req.headers.accept || '');
    const sse = accept.includes('text/event-stream') || !accept.includes('application/json');
    const controller = new AbortController();
    let finished = false;
    res.on('close', () => { if (!finished) controller.abort(); });

    active++;
    if (!sse) {
      try {
        const { pack, repaired } = await generatePack({ universeId, params, signal: controller.signal });
        res.json({ pack, repaired });
      } catch (e) {
        if (!res.headersSent && !controller.signal.aborted) res.status(e.status || 500).json(errorBody(e));
      } finally {
        finished = true;
        active--;
      }
      return;
    }

    // ── SSE ──
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    const send = (event, data) => {
      if (res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    res.write(': connected\n\n');
    const keepalive = setInterval(() => { if (!res.writableEnded) res.write(': keepalive\n\n'); }, 15000);

    let lastDelta = 0;
    let total = 0;
    let lastDeltaAt = 0;
    try {
      const { pack, repaired } = await generatePack({
        universeId,
        params,
        signal: controller.signal,
        onStatus: (message, extra) => send('status', { message, ...(extra || {}) }),
        onDelta: (chars) => {
          // Throttle: at most ~5 events/s.
          total = chars;
          const now = Date.now();
          if (now - lastDeltaAt < 200 && chars - lastDelta < 4000) return;
          lastDelta = chars; lastDeltaAt = now;
          send('delta', { chars });
        },
      });
      send('delta', { chars: total });
      send('done', { pack, repaired });
    } catch (e) {
      if (!controller.signal.aborted) {
        console.warn(`[GENERATE] ${e.code || 'error'}: ${e.message}${e.errors ? ` (${e.errors.length} validation errors)` : ''}`);
        send('error', { ...errorBody(e), status: e.status || 500 });
      }
    } finally {
      finished = true;
      active--;
      clearInterval(keepalive);
      if (!res.writableEnded) res.end();
    }
  });

  router.all('/', (req, res) => res.status(405).json({ error: 'Use POST /api/generate.' }));
  return router;
}

export default createGenerateRouter;
