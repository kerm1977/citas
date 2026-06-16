/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️⚠️⚠️  SERVER.JS — BLINDADO — NO MODIFICAR  ⚠️⚠️⚠️                         ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  ── express.static — NO CAMBIAR OPCIONES ──────────────────────────────── ║
 * ║  maxAge: 0, etag: false → sin caché en el browser durante desarrollo.     ║
 * ║  Cambiar esto hace que los cambios en JS/CSS no se reflejen sin hard      ║
 * ║  refresh, causando confusión durante el desarrollo.                       ║
 * ║                                                                           ║
 * ║  ── ORDEN DE MONTAJE DE RUTAS — NO ALTERAR ────────────────────────────── ║
 * ║  /api/auth  → authRoutes(io)  — recibe io para emitir moderation:new_user ║
 * ║  /api/chat  → chatRoutes(io)  — recibe io para mensajes en tiempo real    ║
 * ║  /api/admin → adminRoutes     — sin io (solo consultas DB)                ║
 * ║  /* → index.html              — SPA fallback (routing en cliente)         ║
 * ║                                                                           ║
 * ║  ── maxHttpBufferSize: 50MB — NO REDUCIR ──────────────────────────────── ║
 * ║  Necesario para el envío de archivos grandes (video/audio) por socket.    ║
 * ║                                                                           ║
 * ║  ── module.exports = { app, io } — NO ELIMINAR ────────────────────────── ║
 * ║  Permite que otros módulos accedan a io sin importar socket.handler.js.   ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
'use strict';
require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const helmet     = require('helmet');
const compression= require('compression');
const { initDB } = require('./db/schema');

const authRoutes    = require('./routes/auth.routes');
const chatRoutes    = require('./routes/chat.routes');
const adminRoutes   = require('./routes/admin.routes');
const backupRoutes  = require('./routes/backup.routes');
const reportsRoutes = require('./routes/reports.routes');
const { socketHandler } = require('./socket/socket.handler');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] },
  maxHttpBufferSize: 50 * 1024 * 1024
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/* Serve socket.io client from node_modules (no CDN) */
app.get('/vendor/socket.io.min.js', (_req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/socket.io/client-dist/socket.io.min.js'));
});

/* Serve bcryptjs from node_modules (no CDN) */
app.get('/vendor/bcrypt.min.js', (_req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/bcryptjs/dist/bcrypt.min.js'));
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0, etag: false }));
app.use('/uploads', express.static(path.join(__dirname, 'data/uploads')));

app.use('/api/auth',    authRoutes(io));
app.use('/api/chat',    chatRoutes(io));
app.use('/api/admin',   adminRoutes);
app.use('/api/backup',  backupRoutes);
app.use('/api/reports', reportsRoutes);

app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

socketHandler(io);

const PORT = process.env.PORT || 3000;
initDB()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () =>
      console.log(`\n✅  Chat-App running → http://localhost:${PORT}\n`)
    );
  })
  .catch(err => { console.error('❌  DB init failed:', err); process.exit(1); });

module.exports = { app, io };
