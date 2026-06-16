'use strict';
const { randomUUID } = require('crypto');
const { dbGet, dbAll, dbRun } = require('./db-core');

function blockUser(blockerId, blockedId, expiresAt) {
  try {
    dbRun(
      `INSERT OR IGNORE INTO blocks (id, blocker_id, blocked_id, expires_at) VALUES (?,?,?,?)`,
      [randomUUID(), blockerId, blockedId, expiresAt || null]
    );
  } catch (e) { /* UNIQUE constraint: ya bloqueado */ }
}

function unblockUser(blockerId, blockedId) {
  dbRun(`DELETE FROM blocks WHERE blocker_id=? AND blocked_id=?`, [blockerId, blockedId]);
}

function getBlockedUsers(blockerId) {
  return dbAll(
    `SELECT b.blocked_id AS id, u.name, u.avatar, b.created_at
     FROM blocks b JOIN users u ON u.id = b.blocked_id
     WHERE b.blocker_id=? ORDER BY b.created_at DESC`,
    [blockerId]
  );
}

function getBlockedIds(blockerId) {
  const rows = dbAll(`SELECT blocked_id FROM blocks WHERE blocker_id=?`, [blockerId]);
  return rows.map(r => r.blocked_id);
}

module.exports = { blockUser, unblockUser, getBlockedUsers, getBlockedIds };
