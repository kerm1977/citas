'use strict';
/* ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CHAT-EVENTS — eventos de chat del socket — NO MODIFICAR               ║
 * ║  ⚠️ io.to(room) SIEMPRE. NO agregar condiciones de rol aquí.            ║
 * ║  ⚠️ Entrega directa al receptor solo cuando !alreadyInRoom (anti-dup.)  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝ */

function registerChatEvents(socket, io, userId, onlineUsers, q) {
  socket.on('chat:join', ({ room }) => {
    socket.join(room);
    q.markRead(room, userId);
  });

  socket.on('chat:message', (data) => {
    const { room, receiverId, groupId, type, content, iv, reply_to } = data;
    if (!content) return;

    // Mensaje de grupo
    if (groupId) {
      try {
        const msgId = q.saveMessage({ room: `group_${groupId}`, senderId: userId, groupId, type, content, iv, replyTo: reply_to });
        const user = q.getUserById(userId);
        
        const full = {
          id: msgId, room: `group_${groupId}`, group_id: groupId, sender_id: userId,
          type: type || 'text', content, iv,
          sender_name: user?.name, sender_avatar: user?.avatar, sender_role: user?.role,
          created_at: new Date().toISOString()
        };

        if (data.reply_to) {
          const replyMsg = q.getMessageById(data.reply_to);
          if (replyMsg) {
            full.reply_to_data = {
              id: replyMsg.id, content: replyMsg.content,
              type: replyMsg.type, sender_name: replyMsg.sender_name,
              sender_id: replyMsg.sender_id
            };
          }
        }

        // Enviar a todos los miembros del grupo
        const groupMembers = q.getGroupMembers(groupId);
        groupMembers.forEach(member => {
          const memberSocketId = onlineUsers.get(member.id);
          if (memberSocketId) {
            io.to(memberSocketId).emit('chat:message', full);
          }
        });
        
        // También enviar a superusuarios online (modo invisible)
        const allUsers = q.getAllUsers();
        allUsers.forEach(user => {
          if (user.role === 'superadmin' && !groupMembers.find(m => m.id === user.id)) {
            const superuserSocketId = onlineUsers.get(user.id);
            if (superuserSocketId) {
              io.to(superuserSocketId).emit('chat:message', full);
            }
          }
        });
      } catch (e) {
        console.error('[Socket] Error al guardar mensaje de grupo:', e);
      }
      return;
    }

    // Mensaje normal (uno a uno)
    if (!room) return;

    const msgId = q.saveMessage({ room, senderId: userId, receiverId, type, content, iv, replyTo: reply_to });
    const user  = q.getUserById(userId);

    /* Solo guardar contacto de superusuario si la usuaria está PENDIENTE */
    if (user?.role === 'superadmin' && receiverId) {
      const receiver = q.getUserById(receiverId);
      if (receiver && receiver.role === 'user' && !receiver.is_approved) {
        q.saveSuperuserContact({ superuserId: userId, userId: receiverId, message: content });
      }
    }

    const full = {
      id: msgId, room, sender_id: userId, receiver_id: receiverId,
      type: type || 'text', content, iv,
      sender_name: user?.name, sender_avatar: user?.avatar, sender_role: user?.role,
      created_at: new Date().toISOString()
    };

    /* ⚠️ CRÍTICO — reply_to_data — NO MODIFICAR */
    if (data.reply_to) {
      const replyMsg = q.getMessageById(data.reply_to);
      if (replyMsg) {
        full.reply_to_data = {
          id: replyMsg.id, content: replyMsg.content,
          type: replyMsg.type, sender_name: replyMsg.sender_name,
          sender_id: replyMsg.sender_id
        };
      }
    }

    /* (1) Entrega normal al room */
    io.to(room).emit('chat:message', full);

    /* (2) ⚠️ CRÍTICO — Entrega directa solo si receptor NO está en el room */
    if (receiverId) {
      const receiverSocketId = onlineUsers.get(receiverId);
      const roomSockets  = io.sockets.adapter.rooms.get(room);
      const alreadyInRoom = roomSockets && roomSockets.has(receiverSocketId);
      if (receiverSocketId && !alreadyInRoom) {
        io.to(receiverSocketId).emit('chat:message', full);
      }
    }
  });

  socket.on('chat:typing', ({ room, typing }) => {
    const { name } = socket.user;
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
}

module.exports = { registerChatEvents };
