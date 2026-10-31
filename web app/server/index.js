/* ═══════════════════════════════════════════════════════════════
   SERVER BOOTSTRAP — express, static files, Socket.io wiring, listen.
   Routes: /api/content (content.js), /api/generate (generate.js).
   Socket handlers: sessions.js.
   API_TOKEN (env, optional): when set, every write to /api/content (PUT,
   DELETE) and every POST /api/generate needs header `x-api-token`.
   Reads stay open (phones/TVs load runtime packs without a token).
   Unset = open LAN behaviour (a one-line notice is logged at start).
   Process guards: uncaught exceptions / unhandled rejections are logged
   and the server keeps serving; genuinely fatal errors (listen failures)
   flush pending snapshots before exiting.
   ═══════════════════════════════════════════════════════════════ */
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import { attachSessions } from './sessions.js';
import { flushAll } from './persistence.js';
import { safeEqual } from './guard.js';
import { createContentRouter } from './content.js';
import { createGenerateRouter } from './generate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

/** Shared-secret guard for mutating API calls (API_TOKEN env; read per request). */
function requireApiToken(req, res, next) {
  const secret = process.env.API_TOKEN;
  if (!secret || req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (safeEqual(String(req.get('x-api-token') || ''), secret)) return next();
  res.status(401).json({ error: 'API token required.', hint: 'Set it on the GM session screen (ADVANCED).' });
}

app.use('/api/content', requireApiToken, createContentRouter());
app.use('/api/generate', requireApiToken, createGenerateRouter());
app.use('/api/recap', requireApiToken, (await import('./recap.js')).createRecapRouter()); // F5 ship's log recap (Claude or template)
app.use('/api/portrait', requireApiToken, (await import('./portrait.js')).createPortraitRouter()); // F4 portraits (local ComfyUI)
app.use('/api/tts', requireApiToken, (await import('./tts.js')).createTtsRouter()); // voice: server TTS (Kokoro / OpenAI-compatible), cached clips
app.use('/api/gm', requireApiToken, (await import('./gm.js')).createGmRouter()); // AI GM narration drafts (local model at GM_URL, or the pack text)
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

attachSessions(io);

const PORT = Number(process.env.PORT) || 3002;

// In production, serve the built Vite app (SPA fallback for everything else).
const distPath = join(__dirname, '..', 'dist');
/* TV shortcut: bookmark http://<host>:<port>/tv on the table screen; it opens the board's code entry
   (or straight into the board with /tv/CODE). */
app.get(['/tv', '/tv/:code'], (req, res) => {
  const code = String(req.params.code || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  res.redirect(code ? `/?board=${code}` : '/?board');
});
app.use(express.static(distPath));
app.use((req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

/* ─── Process guards ─── */
const FATAL_CODES = new Set(['EADDRINUSE', 'EACCES', 'EADDRNOTAVAIL']);
function fatal(err) {
  console.error(`[FATAL] ${err?.stack || err}`);
  try { flushAll(); } catch (e) { console.error('[FATAL] snapshot flush failed:', e?.message); }
  process.exit(1);
}
process.on('uncaughtException', (err, origin) => {
  if (FATAL_CODES.has(err?.code)) return fatal(err);
  console.error(`[ERROR] uncaught ${origin || 'exception'} (server keeps running): ${err?.stack || err}`);
});
process.on('unhandledRejection', (reason) => {
  console.error(`[ERROR] unhandled rejection (server keeps running): ${reason?.stack || reason}`);
});
httpServer.on('error', fatal);

if (!process.env.API_TOKEN) console.log('[API] API_TOKEN not set — content/generate write APIs are open to the LAN.');

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔══════════════════════════════════════════════════════╗
  ║  GAME SESSION SERVER — ONLINE                        ║
  ║  Port: ${String(PORT).padEnd(46)}║
  ║  Status: AWAITING CONNECTIONS                        ║
  ╚══════════════════════════════════════════════════════╝
  `);
});
