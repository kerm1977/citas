/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  SOCKET HANDLER — ORQUESTADOR — NO MODIFICAR                            ║
 * ║  · handlers/chat-events.js        → chat:join/message/typing/read/delete║
 * ║  · handlers/moderation-events.js  → moderation:* events                ║
 * ║  ⚠️ Auth dual-secret: JWT_SECRET + FALLBACK. NO quitar ningún try/catch.║
 * ║  ⚠️ Al conectar, servidor emite force_pending o server_approved (BD).   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
'use strict';
const jwt = require('jsonwebtoken');
const q   = require('../db/queries');
const { registerChatEvents }       = require('./handlers/chat-events');
const { registerModerationEvents } = require('./handlers/moderation-events');

const SECRET          = process.env.JWT_SECRET || 'fallback_secret_change_in_production';
const FALLBACK_SECRET = 'fallback_secret_change_in_production';

const onlineUsers = new Map(); /* userId → socketId */

function socketHandler(io) {
  /* ⚠️ CRÍTICO — Autenticación dual — NO eliminar ningún try/catch */
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Auth required'));
    try {
      socket.user = jwt.verify(token, SECRET);
      return next();
    } catch {
      try {
        socket.user = jwt.verify(token, FALLBACK_SECRET);
        return next();
      } catch { next(new Error('Invalid token')); }
    }
  });

  io.on('connection', (socket) => {
    const { id: userId, name, role } = socket.user;
    onlineUsers.set(userId, socket.id);
    q.updateUserOnline(userId, true);
    io.emit('user:online', { userId, online: true });
    console.log('[Socket] ' + name + ' connected (' + socket.id + ')');

    /* ⚠️ CRÍTICO — Verificación server-side de aprobación — NO ELIMINAR */
    if (role !== 'superadmin') {
      const dbUser = q.getUserById(userId);
      if (!dbUser || !dbUser.is_approved) {
        socket.emit('moderation:force_pending');
      } else {
        socket.emit('moderation:server_approved');
      }
    }

    registerChatEvents(socket, io, userId, onlineUsers, q);
    registerModerationEvents(socket, io, userId, onlineUsers, q);

    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      q.updateUserOnline(userId, false);
      io.emit('user:online', { userId, online: false, last_seen: new Date().toISOString() });
      console.log('[Socket] ' + name + ' disconnected');
    });
  });
}

module.exports = { socketHandler };
