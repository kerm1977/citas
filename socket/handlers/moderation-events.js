'use strict';
/* ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  MODERATION-EVENTS — eventos de moderación del socket — NO MODIFICAR   ║
 * ║  ⚠️ moderation:decide approve → persist() síncrono. NO quitar.          ║
 * ║  ⚠️ moderation:decide reject  → DELETE inmediato, disconnect 1500ms.    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝ */

function registerModerationEvents(socket, io, userId, onlineUsers, q) {
  /* Notificar a superusuarios cuando hay nuevo registro */
  socket.on('moderation:new_registration', (userData) => {
    for (const [adminId, adminSocketId] of onlineUsers) {
      const admin = q.getUserById(adminId);
      if (admin?.role === 'superadmin') {
        io.to(adminSocketId).emit('moderation:new_user', {
          id: userData.id, name: userData.name,
          email: userData.email, registered_at: new Date().toISOString()
        });
      }
    }
  });

  /* Unirse al chat de revisión — agrega AMBOS sockets al reviewRoom */
  socket.on('moderation:join_review', ({ userId: targetUserId }) => {
    const reviewRoom = `review_${targetUserId}`;
    socket.join(reviewRoom);

    const userSocketId = onlineUsers.get(parseInt(targetUserId))
      || onlineUsers.get(String(targetUserId))
      || onlineUsers.get(targetUserId);

    if (userSocketId) {
      const userSocket = io.sockets.sockets.get(userSocketId);
      if (userSocket) userSocket.join(reviewRoom);
      io.to(userSocketId).emit('moderation:system_message', {
        message: '👋 Una moderadora se ha unido al chat de verificación.'
      });
    }
  });

  /* Decisión de aprobación / rechazo */
  socket.on('moderation:decide', ({ userId: targetUserId, decision, moderatorId }) => {
    const moderator = q.getUserById(moderatorId);
    if (moderator?.role !== 'superadmin') {
      socket.emit('moderation:error', { message: 'No autorizado' });
      return;
    }

    const userSocketId = onlineUsers.get(parseInt(targetUserId))
      || onlineUsers.get(String(targetUserId))
      || onlineUsers.get(targetUserId);

    if (decision === 'approve') {
      q.approveUser(targetUserId);
      q.clearSuperuserContactsForUser(targetUserId);
      if (userSocketId) io.to(userSocketId).emit('moderation:approved');
      io.emit('chat:user_list_refresh');

      for (const [adminId, adminSocketId] of onlineUsers) {
        const admin = q.getUserById(adminId);
        if (admin?.role === 'superadmin' && adminId !== moderatorId) {
          io.to(adminSocketId).emit('moderation:user_approved', {
            userId: targetUserId, moderatorId, moderatorName: moderator.name
          });
        }
      }
    } else if (decision === 'reject') {
      try { q.rejectUser(targetUserId); } catch (e) { console.error('[Mod] rejectUser error:', e); }
      if (userSocketId) {
        io.to(userSocketId).emit('moderation:rejected');
        setTimeout(() => {
          const us = io.sockets.sockets.get(userSocketId);
          if (us) us.disconnect(true);
        }, 1500);
      }
      onlineUsers.delete(parseInt(targetUserId));
      onlineUsers.delete(String(targetUserId));
      onlineUsers.delete(targetUserId);
      /* Notificar a superusuarios que el usuario fue rechazado */
      for (const [adminId, adminSocketId] of onlineUsers) {
        const admin = q.getUserById(adminId);
        if (admin?.role === 'superadmin' && adminId !== moderatorId) {
          io.to(adminSocketId).emit('moderation:user_rejected', {
            userId: targetUserId, moderatorId, moderatorName: moderator.name
          });
        }
      }
    }
  });

  /* Mensajes en chat de revisión (texto / imagen / video / audio) */
  socket.on('moderation:review_message', (data) => {
    const { userId: targetUserId, content, senderId, type = 'text' } = data;
    const reviewRoom = `review_${targetUserId}`;
    const msgId = q.saveMessage({
      room: reviewRoom, senderId, receiverId: targetUserId,
      type, content, iv: null
    });
    io.to(reviewRoom).emit('moderation:review_message', {
      id: msgId, sender_id: senderId,
      sender_name: q.getUserById(senderId)?.name,
      content, type, created_at: new Date().toISOString()
    });
  });
}

module.exports = { registerModerationEvents };
