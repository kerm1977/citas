'use strict';
/* ╔══════════════════════════════════════════════════════════════╗
 * ║  QUERIES-MESSAGES — funciones de mensajes — NO MODIFICAR    ║
 * ╚══════════════════════════════════════════════════════════════╝ */
const { randomUUID } = require('crypto');
const { dbGet, dbAll, dbRun } = require('./db-core');

/* ⚠️ CRÍTICO — saveMessage acepta replyTo. NO quitar ese param. */
function saveMessage({ room, senderId, receiverId, type, content, iv, replyTo }) {
  const id = randomUUID();
  dbRun(
    `INSERT INTO messages (id,room,sender_id,receiver_id,type,content,iv,reply_to)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, room, senderId, receiverId || null, type || 'text', content, iv || null, replyTo || null]
  );
  return id;
}

function getMessageById(id) {
  return dbGet('SELECT * FROM messages WHERE id=?', [id]);
}

/* ⚠️ CRÍTICO — DESC+LIMIT luego .reverse() para orden cronológico. NO cambiar. */
function getMessages(room, limit = 50, offset = 0) {
  const rows = dbAll(
    `SELECT m.id, m.room, m.sender_id, m.receiver_id, m.type, m.content, m.iv,
            m.reply_to, m.deleted, m.read_at, m.created_at,
            u.name AS sender_name, u.avatar AS sender_avatar
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.room=? AND m.deleted=0
     ORDER BY m.created_at DESC LIMIT ? OFFSET ?`,
    [room, limit, offset]
  );
  const messagesWithReply = rows.map(msg => {
    if (msg.reply_to) {
      const replyMsg = getMessageById(msg.reply_to);
      if (replyMsg) {
        const replyUser = dbGet('SELECT name FROM users WHERE id=?', [replyMsg.sender_id]);
        msg.reply_to_data = {
          id: replyMsg.id,
          content: replyMsg.content,
          type: replyMsg.type,
          sender_name: replyUser?.name || 'Alguien',
          sender_id: replyMsg.sender_id
        };
      }
    }
    return msg;
  });
  return messagesWithReply.reverse();
}

function markRead(room, userId) {
  dbRun(
    `UPDATE messages SET read_at=datetime('now')
     WHERE room=? AND receiver_id=? AND read_at IS NULL`,
    [room, userId]
  );
}

function deleteMessage(id, userId) {
  dbRun('UPDATE messages SET deleted=1 WHERE id=? AND sender_id=?', [id, userId]);
}

function getRoomId(a, b) { return [a, b].sort().join('_'); }

module.exports = {
  saveMessage, getMessages, markRead, deleteMessage, getRoomId, getMessageById
};
