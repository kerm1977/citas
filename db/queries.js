'use strict';
const { randomUUID } = require('crypto');
const { dbGet, dbAll, dbRun, persist } = require('./db-core');

/* ── Users ──────────────────────────────────────────────────── */
function createUser({ name, email, phone, password, avatar, recoveryHash }) {
  const id = randomUUID();
  dbRun(
    `INSERT INTO users (id,name,email,phone,password,avatar,recovery_hash)
     VALUES (?,?,?,?,?,?,?)`,
    [id, name, email, phone || null, password, avatar || null, recoveryHash || null]
  );
  return id;
}

function getUserByEmail(email) {
  return dbGet('SELECT * FROM users WHERE email=? AND is_hidden=0', [email]);
}

function getUserByEmailAny(email) {
  return dbGet('SELECT * FROM users WHERE email=?', [email]);
}

function getUserById(id) {
  return dbGet('SELECT * FROM users WHERE id=?', [id]);
}

function getAllUsers() {
  return dbAll(
    `SELECT id,name,email,phone,avatar,role,is_blocked,is_approved,online,last_seen,created_at
     FROM users WHERE is_hidden=0 ORDER BY name ASC`,
    []
  );
}

function getAllUsersIncludingHidden() {
  return dbAll(
    `SELECT id,name,email,phone,avatar,role,is_blocked,is_approved,online,last_seen,created_at
     FROM users ORDER BY name ASC`,
    []
  );
}

function updateUserOnline(id, online) {
  dbRun(
    `UPDATE users SET online=?, last_seen=datetime('now') WHERE id=?`,
    [online ? 1 : 0, id]
  );
}

function updateUserAvatar(id, avatar) {
  dbRun('UPDATE users SET avatar=? WHERE id=?', [avatar, id]);
}

function blockUser(id, blocked) {
  dbRun('UPDATE users SET is_blocked=? WHERE id=? AND is_hidden=0', [blocked ? 1 : 0, id]);
}

function deleteUser(id) {
  dbRun('DELETE FROM users WHERE id=? AND is_hidden=0', [id]);
}

function getUserByRecovery(hash) {
  return dbGet('SELECT * FROM users WHERE recovery_hash=? AND is_hidden=0', [hash]);
}

function updatePassword(id, hash) {
  dbRun('UPDATE users SET password=? WHERE id=?', [hash, id]);
}

function setUserRole(id, role) {
  dbRun('UPDATE users SET role=? WHERE id=? AND is_hidden=0', [role, id]);
}

function countUsers() {
  const r = dbGet('SELECT COUNT(*) AS c FROM users WHERE is_hidden=0', []);
  return r?.c || 0;
}

function countOnline() {
  const r = dbGet('SELECT COUNT(*) AS c FROM users WHERE online=1 AND is_hidden=0', []);
  return r?.c || 0;
}

function countMessages() {
  const r = dbGet('SELECT COUNT(*) AS c FROM messages', []);
  return r?.c || 0;
}

/* ── Messages ───────────────────────────────────────────────── */
/* ═════════════════════════════════════════════════════════════════════════════
 *  ⚠️  CRÍTICO — GUARDADO DE MENSAJES CON RESPUESTA — NO MODIFICAR  ⚠️
 * ─────────────────────────────────────────────────────────────────────────────────
 *  saveMessage ahora acepta replyTo para guardar el ID del mensaje respondido.
 *
 *  REGLAS QUE DEBEN MANTENERSE SIEMPRE:
 *  1. Aceptar parámetro replyTo (msgId string)
 *  2. Insertar reply_to en la base de datos
 *  3. replyTo puede ser null (mensajes sin respuesta)
 * ═════════════════════════════════════════════════════════════════════════════ */
function saveMessage({ room, senderId, receiverId, type, content, iv, replyTo }) {
  const id = randomUUID();
  dbRun(
    `INSERT INTO messages (id,room,sender_id,receiver_id,type,content,iv,reply_to)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, room, senderId, receiverId || null, type || 'text', content, iv || null, replyTo || null]
  );
  return id;
}

function getMessages(room, limit = 50, offset = 0) {
  /* ⚠️ CRÍTICO — NO MODIFICAR EL ORDEN:
   * Se consulta DESC + LIMIT para traer los N mensajes MÁS RECIENTES, y luego
   * se hace .reverse() para devolverlos en orden CRONOLÓGICO ascendente
   * (más antiguos primero, más nuevos al final). Esto es lo que permite la
   * visualización "en cascada" estilo WhatsApp en el cliente. Si se quita el
   * .reverse() o se cambia a ASC, el orden de los mensajes se rompe. */
  
  /* ═════════════════════════════════════════════════════════════════════════════
   *  ⚠️  CRÍTICO — GENERACIÓN DE REPLY_TO_DATA — NO MODIFICAR  ⚠️
   * ─────────────────────────────────────────────────────────────────────────────────
   *  getMessages genera reply_to_data para mensajes que tienen reply_to.
   *
   *  REGLAS QUE DEBEN MANTENERSE SIEMPRE:
   *  1. Consultar m.reply_to en el SELECT
   *  2. Para cada mensaje con reply_to, obtener el mensaje original con getMessageById
   *  3. Generar reply_to_data con id, content, type, sender_name, sender_id
   *  4. El sender_name se obtiene de la tabla users
   * ═════════════════════════════════════════════════════════════════════════════ */
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

  /* Agregar reply_to_data para mensajes que tienen reply_to */
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

function getMessageById(id) {
  return dbGet('SELECT * FROM messages WHERE id=?', [id]);
}

function deleteMessage(id, userId) {
  dbRun('UPDATE messages SET deleted=1 WHERE id=? AND sender_id=?', [id, userId]);
}

function getRoomId(a, b) { return [a, b].sort().join('_'); }

/* ── Superuser Contacts ───────────────────────────────────────── */
function saveSuperuserContact({ superuserId, userId, message }) {
  const id = randomUUID();
  dbRun(
    `INSERT INTO superuser_contacts (id, superuser_id, user_id, message)
     VALUES (?,?,?,?)`,
    [id, superuserId, userId, message || null]
  );
  return id;
}

function getPendingSuperuserContacts(userId) {
  return dbAll(
    `SELECT sc.*, u.name as superuser_name, u.avatar as superuser_avatar
     FROM superuser_contacts sc
     JOIN users u ON u.id = sc.superuser_id
     WHERE sc.user_id=? AND sc.acknowledged=0
     ORDER BY sc.created_at DESC`,
    [userId]
  );
}

function acknowledgeSuperuserContact(contactId) {
  dbRun(
    `UPDATE superuser_contacts SET acknowledged=1 WHERE id=?`,
    [contactId]
  );
}

function clearSuperuserContactsForUser(userId) {
  dbRun(
    `UPDATE superuser_contacts SET acknowledged=1 WHERE user_id=?`,
    [userId]
  );
}

/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️⚠️⚠️  FUNCIONES DE MODERACIÓN — BLINDADAS — NO MODIFICAR  ⚠️⚠️⚠️      ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  ── approveUser(userId) — NO ALTERAR ──────────────────────────────────── ║
 * ║  UPDATE is_approved=1 + persist() SÍNCRONO inmediatamente.                ║
 * ║  El persist() síncrono es crítico: si el servidor se reinicia antes de    ║
 * ║  que setImmediate corra, el cambio se perdería. NO quitar persist().      ║
 * ║                                                                           ║
 * ║  ── rejectUser(userId) — NO ALTERAR ───────────────────────────────────── ║
 * ║  DELETE FROM users + persist() SÍNCRONO inmediatamente.                   ║
 * ║  El DELETE es INMEDIATO (sin delay). Agregar setTimeout al DELETE          ║
 * ║  causaría que reinicios del servidor dejen usuarios zombi en la BD.        ║
 * ║                                                                           ║
 * ║  ── getPendingUsers() — NO ALTERAR ────────────────────────────────────── ║
 * ║  Filtra: is_approved=0 AND is_hidden=0 AND role='user'.                   ║
 * ║  Cambiar este filtro mostraría usuarias incorrectas en el panel.          ║
 * ║                                                                           ║
 * ║  ── getUserApprovalStatus(userId) — NO ALTERAR ────────────────────────── ║
 * ║  Usado por /api/auth/approval-status (verificación server-authoritative). ║
 * ║  Devuelve { is_approved, role } directamente desde la BD.                 ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
function getPendingUsers() {
  return dbAll(
    `SELECT id, name, email, phone, avatar, online, last_seen, created_at
     FROM users WHERE is_approved=0 AND is_hidden=0 AND role='user'
     ORDER BY created_at DESC`,
    []
  );
}

function approveUser(userId) {
  dbRun(`UPDATE users SET is_approved=1 WHERE id=?`, [userId]);
  persist(); // Persistir inmediatamente — crítico
}

function rejectUser(userId) {
  dbRun(`DELETE FROM users WHERE id=?`, [userId]);
  persist(); // Persistir inmediatamente — evita pérdida si el server se reinicia
}

function isUserApproved(userId) {
  const user = dbGet(`SELECT is_approved FROM users WHERE id=?`, [userId]);
  return user?.is_approved === 1;
}

function getUserApprovalStatus(userId) {
  return dbGet(`SELECT is_approved, role FROM users WHERE id=?`, [userId]);
}

module.exports = {
  createUser, getUserByEmail, getUserByEmailAny, getUserById, getAllUsers, getAllUsersIncludingHidden,
  updateUserOnline, updateUserAvatar, blockUser, deleteUser,
  getUserByRecovery, updatePassword, setUserRole,
  countUsers, countOnline, countMessages,
  saveMessage, getMessages, markRead, deleteMessage, getRoomId, getMessageById,
  saveSuperuserContact, getPendingSuperuserContacts, acknowledgeSuperuserContact, clearSuperuserContactsForUser,
  getPendingUsers, approveUser, rejectUser, isUserApproved, getUserApprovalStatus
};
