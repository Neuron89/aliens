/* ═══════════════════════════════════════════════════════════════
   SERVER BOOTSTRAP — express, static files, Socket.io wiring, listen.
   Routes: /api/content (content.js), /api/generate (generate.js).
   Socket handlers: sessions.js.
   ═══════════════════════════════════════════════════════════════ */
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import { attachSessions } from './sessions.js';
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

app.use('/api/content', createContentRouter());
app.use('/api/generate', createGenerateRouter());
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

attachSessions(io);

const PORT = Number(process.env.PORT) || 3002;

// In production, serve the built Vite app (SPA fallback for everything else).
const distPath = join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.use((req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔══════════════════════════════════════════════════════╗
  ║  GAME SESSION SERVER — ONLINE                        ║
  ║  Port: ${String(PORT).padEnd(46)}║
  ║  Status: AWAITING CONNECTIONS                        ║
  ╚══════════════════════════════════════════════════════╝
  `);
});
