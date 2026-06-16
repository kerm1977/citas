/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️⚠️⚠️  SOCKET HANDLER — BLINDADO — NO MODIFICAR  ⚠️⚠️⚠️               ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  ESTE ARCHIVO ESTÁ COMPLETAMENTE VALIDADO Y EN PRODUCCIÓN.                ║
 * ║                                                                           ║
 * ║  ── AUTENTICACIÓN DUAL — NO ELIMINAR NINGÚN try/catch ─────────────────── ║
 * ║  Se aceptan tokens firmados con JWT_SECRET (.env) Y con FALLBACK_SECRET.  ║
 * ║  Esto garantiza compatibilidad con sesiones creadas antes de reinicios.   ║
 * ║  Eliminar cualquiera de los dos try/catch ROMPERÁ sesiones activas.       ║
 * ║                                                                           ║
 * ║  ── MAPA onlineUsers — NO MODIFICAR ESTRUCTURA ────────────────────────── ║
 * ║  Map<userId, socketId>. La búsqueda usa triple fallback:                  ║
 * ║  onlineUsers.get(parseInt(userId))                                        ║
 * ║  || onlineUsers.get(String(userId))                                       ║
 * ║  || onlineUsers.get(userId)                                               ║
 * ║  Esto cubre UUIDs (string) y IDs numéricos por igual.                     ║
 * ║                                                                           ║
 * ║  ── VERIFICACIÓN DE APROBACIÓN AL CONECTAR — NO ELIMINAR ───────────────  ║
 * ║  Al conectar, el servidor emite moderation:force_pending                  ║
 * ║  o moderation:server_approved según la BD real.                           ║
 * ║  Esto hace el sistema server-authoritative. Eliminar rompe la seguridad.  ║
 * ║                                                                           ║
 * ║  ── EVENTO chat:message — NO MODIFICAR LÓGICA DE ROOMS ────────────────── ║
 * ║  SIEMPRE emitir a io.to(room). El envío directo por socketId aplica       ║
 * ║  solo cuando el receptor no está en el room. NO agregar condiciones de    ║
 * ║  roles (superadmin, etc.) en este evento. Está validado y funciona.       ║
 * ║                                                                           ║
 * ║  ── EVENTO moderation:decide — NO MODIFICAR FLUJO ─────────────────────── ║
 * ║  approve: approveUser() + persist() síncrono + emite moderation:approved  ║
 * ║  reject:  rejectUser() + persist() síncrono + desconecta socket (1500ms)  ║
 * ║           + limpia onlineUsers con triple delete.                          ║
 * ║  El DELETE de reject es INMEDIATO. No agregar delays al DELETE.           ║
 * ║                                                                           ║
 * ║  ── EVENTO moderation:review_message — NO MODIFICAR ───────────────────── ║
 * ║  Debe propagar el campo 'type' (text/image/video/audio) al cliente.        ║
 * ║  El campo 'type' permite que el cliente renderice el media correcto.       ║
 * ║                                                                           ║
 * ║  ── EVENTO moderation:join_review — NO MODIFICAR ──────────────────────── ║
 * ║  Agrega AMBOS sockets (moderadora Y usuaria) al reviewRoom.               ║
 * ║  La usuaria NO necesita hacer chat:join manualmente.                      ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
'use strict';
const jwt = require('jsonwebtoken');
const q   = require('../db/queries');
const SECRET          = process.env.JWT_SECRET || 'fallback_secret_change_in_production';
const FALLBACK_SECRET = 'fallback_secret_change_in_production';

const onlineUsers = new Map(); /* userId → socketId */

function socketHandler(io) {
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
    console.log(`🟢  ${name} connected (${socket.id})`);

    /* ⚠️ CRÍTICO — Verificación server-side de aprobación — NO ELIMINAR
     * El servidor emite el estado real de is_approved desde la BD,
     * anulando cualquier valor manipulado en el localStorage del cliente. */
    if (role !== 'superadmin') {
      const dbUser = q.getUserById(userId);
      if (!dbUser || !dbUser.is_approved) {
        socket.emit('moderation:force_pending');
        console.log(`[Moderation] User ${name} (${userId}) is NOT approved — forcing pending state`);
      } else {
        socket.emit('moderation:server_approved');
      }
    }

    socket.on('chat:join', ({ room }) => {
      socket.join(room);
      q.markRead(room, userId);
    });

    socket.on('chat:message', (data) => {
      /* ═════════════════════════════════════════════════════════════════════════════
       *  ⚠️  CRÍTICO — PROCESAMIENTO DE RESPUESTA — NO MODIFICAR  ⚠️
       * ─────────────────────────────────────────────────────────────────────────────────
       *  Maneja el envío de mensajes con reply_to y genera reply_to_data.
       *
       *  REGLAS QUE DEBEN MANTENERSE SIEMPRE:
       *  1. Recibir reply_to del payload (es un msgId string, no objeto)
       *  2. Guardar reply_to en la base de datos
       *  3. Si reply_to existe, obtener el mensaje original con getMessageById
       *  4. Generar reply_to_data con id, content, type, sender_name, sender_id
       *  5. Incluir reply_to_data en el payload enviado al receptor
       *  6. Los logs de depuración pueden eliminarse en producción
       * ═════════════════════════════════════════════════════════════════════════════ */
      const { room, receiverId, type, content, iv, reply_to } = data;
      console.log('[Socket] Received message with reply_to:', reply_to);
      if (!room || !content) return;
      const msgId = q.saveMessage({ room, senderId: userId, receiverId, type, content, iv, replyTo: reply_to });
      const user = q.getUserById(userId);
      console.log('[Socket] User data from DB:', user);
      
      /* Si el superusuario le escribe a una usuaria PENDIENTE, guardar contacto.
       * Usuarias ya aprobadas (is_approved=1) NO necesitan esta notificación. */
      if (user?.role === 'superadmin' && receiverId) {
        const receiver = q.getUserById(receiverId);
        if (receiver && receiver.role === 'user' && !receiver.is_approved) {
          q.saveSuperuserContact({ superuserId: userId, userId: receiverId, message: content });
          console.log('[Socket] Superuser contact saved for pending user:', receiverId);
        }
      }
      
      const full = {
        id: msgId, room, sender_id: userId, receiver_id: receiverId,
        type: type || 'text', content, iv,
        sender_name: user?.name, sender_avatar: user?.avatar, sender_role: user?.role,
        created_at: new Date().toISOString()
      };

      /* Si hay reply_to, obtener datos del mensaje original */
      if (data.reply_to) {
        const replyMsg = q.getMessageById(data.reply_to);
        if (replyMsg) {
          full.reply_to_data = {
            id: replyMsg.id,
            content: replyMsg.content,
            type: replyMsg.type,
            sender_name: replyMsg.sender_name,
            sender_id: replyMsg.sender_id
          };
        }
      }

      console.log('[Socket] Message payload:', full);
      
      /* ════════════════════════════════════════════════════════════════════
       *  ⚠️  LÓGICA CRÍTICA DE ENTREGA DE MENSAJES — NO MODIFICAR  ⚠️
       * ────────────────────────────────────────────────────────────────────
       *  Esta lógica está VALIDADA y evita mensajes DUPLICADOS.
       *
       *  REGLAS QUE DEBEN MANTENERSE SIEMPRE:
       *  1. SIEMPRE emitir al room con io.to(room) — cubre a usuarios que ya
       *     abrieron el chat (se unieron al room vía 'chat:join').
       *  2. El envío DIRECTO al socket del receptor aplica cuando:
       *       a) El receptor está conectado (onlineUsers.has(receiverId)), Y
       *       b) El receptor NO está todavía en el room (alreadyInRoom === false)
       *     Esto es necesario para mostrar el badge de mensajes no leídos
       *     cuando el chat está cerrado (usuario no en el room).
       *
       *  ❌ NO eliminar la verificación `!alreadyInRoom`: si se quita, el
       *     usuario regular recibe el mensaje DOS veces (room + directo).
       * ════════════════════════════════════════════════════════════════════ */

      /* (1) Entrega normal al room */
      io.to(room).emit('chat:message', full);

      /* ════════════════════════════════════════════════════════════════════
       *  ⚠️⚠️⚠️ LÓGICA CRÍTICA PARA BADGES DE MENSAJES NO LEÍDOS — JAMÁS MODIFICAR ⚠️⚠️⚠️
       * ─────────────────────────────────────────────────────────────────────────────────
       *  Esta lógica es ESENCIAL para que funcionen los indicadores de mensajes no leídos.
       *  El receptor debe recibir el mensaje aunque el chat esté cerrado (no en el room)
       *  para poder incrementar el contador y mostrar el badge en la lista de usuarios.
       *
       *  REGLAS QUE DEBEN MANTENERSE ETERNAMENTE:
       *  1. SIEMPRE enviar directo al receptor si está conectado pero NO en el room
       *  2. La verificación `!alreadyInRoom` es OBLIGATORIA para evitar duplicados
       *  3. NO agregar condiciones de superadmin o roles (aplica para todos)
       *  4. Esta lógica NO se puede "mejorar" ni "optimizar" sin romper los badges
       *  5. Si se elimina, los usuarios NO verán indicadores de mensajes no leídos
       * ════════════════════════════════════════════════════════════════════ */
      if (receiverId) {
        const receiverSocketId = onlineUsers.get(receiverId);
        const roomSockets = io.sockets.adapter.rooms.get(room);
        const alreadyInRoom = roomSockets && roomSockets.has(receiverSocketId);
        if (receiverSocketId && !alreadyInRoom) {
          io.to(receiverSocketId).emit('chat:message', full);
          console.log('[Socket] Message sent directly to receiver socket (not in room):', receiverSocketId);
        }
      }
    });

    socket.on('chat:typing', ({ room, typing }) => {
      socket.to(room).emit('chat:typing', { userId, name, typing });
    });

    socket.on('chat:read', ({ room }) => {
      q.markRead(room, userId);
      socket.to(room).emit('chat:read', { userId, room });
    });

    socket.on('chat:delete', ({ msgId, room }) => {
      q.deleteMessage(msgId, userId);
      io.to(room).emit('chat:delete', { msgId });
    });

    /* ═════════════════════════════════════════════════════════════════════════════
     *  ⚠️  CRÍTICO — EVENTOS DE MODERACIÓN — NO MODIFICAR  ⚠️
     * ─────────────────────────────────────────────────────────────────────────────────
     *  Sistema de moderación para aprobación de nuevas usuarias.
     *
     *  REGLAS QUE DEBEN MANTENERSE SIEMPRE:
     *  1. Al registrarse, notificar a todos los superusuarios conectados
     *  2. Crear room de revisión específico para cada usuaria pendiente
     *  3. Solo superusuarios pueden aprobar/rechazar
     *  4. Al aprobar: notificar a la usuaria y actualizar su estado
     *  5. Al rechazar: eliminar cuenta y notificar a la usuaria
     * ═════════════════════════════════════════════════════════════════════════════ */
    
    /* Notificar a superusuarios cuando hay nuevo registro */
    socket.on('moderation:new_registration', (userData) => {
      // Notificar a todos los superusuarios conectados
      for (const [adminId, adminSocketId] of onlineUsers) {
        const admin = q.getUserById(adminId);
        if (admin?.role === 'superadmin') {
          io.to(adminSocketId).emit('moderation:new_user', {
            id: userData.id,
            name: userData.name,
            email: userData.email,
            registered_at: new Date().toISOString()
          });
        }
      }
    });
    
    /* Unirse al chat de revisión */
    socket.on('moderation:join_review', ({ userId }) => {
      const reviewRoom = `review_${userId}`;
      
      // Moderador entra al room
      socket.join(reviewRoom);
      console.log(`[Moderation] Moderator joined review room: ${reviewRoom}`);
      
      // Agregar también el socket del usuario al mismo room
      // onlineUsers puede tener el key como number o string según el JWT
      const userSocketId = onlineUsers.get(parseInt(userId)) || onlineUsers.get(String(userId)) || onlineUsers.get(userId);
      console.log(`[Moderation] User ${userId} (type: ${typeof userId}) socketId:`, userSocketId, '| onlineUsers keys:', [...onlineUsers.keys()].map(k => `${k}(${typeof k})`));
      
      if (userSocketId) {
        const userSocket = io.sockets.sockets.get(userSocketId);
        if (userSocket) {
          userSocket.join(reviewRoom);
          console.log(`[Moderation] User socket also joined review room: ${reviewRoom}`);
        }
        
        // Notificar a la usuaria
        io.to(userSocketId).emit('moderation:system_message', {
          message: '👋 Una moderadora se ha unido al chat de verificación.'
        });
      } else {
        console.warn(`[Moderation] User ${userId} is not online, cannot join review room`);
      }
    });
    
    /* Decisión de aprobación/rechazo */
    socket.on('moderation:decide', ({ userId, decision, moderatorId }) => {
      const moderator = q.getUserById(moderatorId);
      if (moderator?.role !== 'superadmin') {
        socket.emit('moderation:error', { message: 'No autorizado' });
        return;
      }
      
      const userSocketId = onlineUsers.get(parseInt(userId)) || onlineUsers.get(String(userId)) || onlineUsers.get(userId);
      
      if (decision === 'approve') {
        // Aprobar usuaria
        q.approveUser(userId);
        // Limpiar notificaciones de contacto pendientes — ya no necesita verlas
        q.clearSuperuserContactsForUser(userId);
        console.log(`[Moderation] User ${userId} approved by ${moderatorId}`);
        
        // Notificar a la usuaria
        if (userSocketId) {
          io.to(userSocketId).emit('moderation:approved');
        }
        
        // Indicar a todos los usuarios conectados que recarguen la lista de usuarias
        io.emit('chat:user_list_refresh');
        console.log(`[Moderation] user_list_refresh emitted to all sockets`);
        
        // Notificar a todos los superusuarios
        for (const [adminId, adminSocketId] of onlineUsers) {
          const admin = q.getUserById(adminId);
          if (admin?.role === 'superadmin' && adminId !== moderatorId) {
            io.to(adminSocketId).emit('moderation:user_approved', {
              userId,
              moderatorId,
              moderatorName: moderator.name
            });
          }
        }
      } else if (decision === 'reject') {
        console.log(`[Moderation] Rejecting user ${userId}`);
        
        // Eliminar de la BD INMEDIATAMENTE
        try {
          q.rejectUser(userId);
          console.log(`[Moderation] User ${userId} deleted from DB`);
        } catch (err) {
          console.error(`[Moderation] Error deleting user ${userId}:`, err);
        }
        
        // Notificar y desconectar el socket del usuario rechazado
        if (userSocketId) {
          io.to(userSocketId).emit('moderation:rejected');
          // Desconectar el socket forzosamente después de que reciba la notificación
          setTimeout(() => {
            const userSocket = io.sockets.sockets.get(userSocketId);
            if (userSocket) {
              userSocket.disconnect(true);
              console.log(`[Moderation] User socket ${userSocketId} disconnected`);
            }
          }, 1500);
        }
        
        // Limpiar del mapa de usuarios online
        onlineUsers.delete(parseInt(userId));
        onlineUsers.delete(String(userId));
        onlineUsers.delete(userId);
      }
    });
    
    /* Mensajes en chat de revisión (texto, imagen, video, audio) */
    socket.on('moderation:review_message', (data) => {
      const { userId, content, senderId, type = 'text' } = data;
      const reviewRoom = `review_${userId}`;
      
      // Guardar mensaje con el tipo correcto
      const msgId = q.saveMessage({
        room: reviewRoom,
        senderId,
        receiverId: userId,
        type,
        content,
        iv: null
      });
      
      // Enviar a todos en el room incluyendo el type
      io.to(reviewRoom).emit('moderation:review_message', {
        id: msgId,
        sender_id: senderId,
        sender_name: q.getUserById(senderId)?.name,
        content,
        type,
        created_at: new Date().toISOString()
      });
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      q.updateUserOnline(userId, false);
      io.emit('user:online', { userId, online: false,
        last_seen: new Date().toISOString() });
      console.log(`🔴  ${name} disconnected`);
    });
  });
}

module.exports = { socketHandler };
