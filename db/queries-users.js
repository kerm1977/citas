'use strict';
/* ╔══════════════════════════════════════════════════════════════╗
 * ║  QUERIES-USERS — funciones de usuarios — NO MODIFICAR       ║
 * ╚══════════════════════════════════════════════════════════════╝ */
const { randomUUID } = require('crypto');
const { dbGet, dbAll, dbRun } = require('./db-core');

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
     FROM users WHERE is_hidden=0 ORDER BY name ASC`, []
  );
}
function getAllUsersIncludingHidden() {
  return dbAll(
    `SELECT id,name,email,phone,avatar,role,is_blocked,is_approved,online,last_seen,created_at
     FROM users ORDER BY name ASC`, []
  );
}
function updateUserOnline(id, online) {
  dbRun(`UPDATE users SET online=?, last_seen=datetime('now') WHERE id=?`, [online ? 1 : 0, id]);
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
function setWarningActive(id, active) {
  dbRun('UPDATE users SET warning_active=? WHERE id=?', [active ? 1 : 0, id]);
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

module.exports = {
  createUser, getUserByEmail, getUserByEmailAny, getUserById,
  getAllUsers, getAllUsersIncludingHidden, updateUserOnline,
  updateUserAvatar, blockUser, deleteUser, getUserByRecovery,
  updatePassword, setUserRole, setWarningActive, countUsers, countOnline, countMessages
};
