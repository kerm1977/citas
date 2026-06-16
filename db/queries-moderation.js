'use strict';
/* ╔══════════════════════════════════════════════════════════════════════╗
 * ║  QUERIES-MODERATION — aprobación/rechazo/contactos — NO MODIFICAR  ║
 * ╚══════════════════════════════════════════════════════════════════════╝ */
const { randomUUID } = require('crypto');
const { dbGet, dbAll, dbRun, persist } = require('./db-core');

/* ⚠️ CRÍTICO — persist() síncrono inmediato. NO eliminar. */
function approveUser(userId) {
  dbRun(`UPDATE users SET is_approved=1 WHERE id=?`, [userId]);
  persist();
}

/* ⚠️ CRÍTICO — DELETE inmediato + persist() síncrono. NO agregar delay al DELETE. */
function rejectUser(userId) {
  dbRun(`DELETE FROM users WHERE id=?`, [userId]);
  persist();
}

/* ⚠️ Filtro: is_approved=0 AND is_hidden=0 AND role='user'. NO cambiar. */
function getPendingUsers() {
  return dbAll(
    `SELECT id, name, email, phone, avatar, online, last_seen, created_at
     FROM users WHERE is_approved=0 AND is_hidden=0 AND role='user'
     ORDER BY created_at DESC`, []
  );
}

function isUserApproved(userId) {
  const user = dbGet(`SELECT is_approved FROM users WHERE id=?`, [userId]);
  return user?.is_approved === 1;
}

/* Usado por /api/auth/approval-status — fuente de verdad server-authoritative */
function getUserApprovalStatus(userId) {
  return dbGet(`SELECT is_approved, role FROM users WHERE id=?`, [userId]);
}

function saveSuperuserContact({ superuserId, userId, message }) {
  const id = randomUUID();
  dbRun(
    `INSERT INTO superuser_contacts (id, superuser_id, user_id, message) VALUES (?,?,?,?)`,
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
  dbRun(`UPDATE superuser_contacts SET acknowledged=1 WHERE id=?`, [contactId]);
}

/* Limpiar al aprobar — evita que usuaria aprobada vea notificaciones en bucle */
function clearSuperuserContactsForUser(userId) {
  dbRun(`UPDATE superuser_contacts SET acknowledged=1 WHERE user_id=?`, [userId]);
}

module.exports = {
  approveUser, rejectUser, getPendingUsers, isUserApproved, getUserApprovalStatus,
  saveSuperuserContact, getPendingSuperuserContacts, acknowledgeSuperuserContact,
  clearSuperuserContactsForUser
};
