'use strict';
const { randomUUID } = require('crypto');
const { dbGet, dbRun, dbAll } = require('./db-core');

/* Crear un nuevo grupo */
function createGroup(name, createdBy) {
  const id = randomUUID();
  dbRun(
    `INSERT INTO groups (id, name, created_by) VALUES (?, ?, ?)`,
    [id, name, createdBy]
  );
  // Agregar al creador como miembro
  addGroupMember(id, createdBy);
  return id;
}

/* Obtener grupos de un usuario */
function getUserGroups(userId) {
  return dbAll(`
    SELECT g.*, 
           (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
           u.name as creator_name
    FROM groups g
    INNER JOIN group_members gm ON g.id = gm.group_id
    LEFT JOIN users u ON g.created_by = u.id
    WHERE gm.user_id = ?
    ORDER BY g.created_at DESC
  `, [userId]);
}

/* Obtener miembros de un grupo */
function getGroupMembers(groupId) {
  return dbAll(`
    SELECT u.id, u.name, u.avatar, u.online, gm.joined_at
    FROM group_members gm
    INNER JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = ?
    ORDER BY gm.joined_at ASC
  `, [groupId]);
}

/* Agregar miembro a un grupo */
function addGroupMember(groupId, userId) {
  const id = randomUUID();
  try {
    dbRun(
      `INSERT INTO group_members (id, group_id, user_id) VALUES (?, ?, ?)`,
      [id, groupId, userId]
    );
    return true;
  } catch (e) {
    // El usuario ya es miembro
    return false;
  }
}

/* Eliminar miembro de un grupo */
function removeGroupMember(groupId, userId) {
  dbRun(
    `DELETE FROM group_members WHERE group_id = ? AND user_id = ?`,
    [groupId, userId]
  );
}

/* Obtener información de un grupo */
function getGroupById(groupId) {
  return dbGet(`
    SELECT g.*, u.name as creator_name
    FROM groups g
    LEFT JOIN users u ON g.created_by = u.id
    WHERE g.id = ?
  `, [groupId]);
}

/* Buscar usuarios que no están en el grupo */
function searchUsersNotInGroup(groupId, searchTerm, currentUserId) {
  return dbAll(`
    SELECT id, name, avatar, online
    FROM users
    WHERE is_approved = 1
      AND is_blocked = 0
      AND id != ?
      AND id NOT IN (SELECT user_id FROM group_members WHERE group_id = ?)
      AND (name LIKE ? OR email LIKE ?)
    ORDER BY name ASC
    LIMIT 20
  `, [currentUserId, groupId, `%${searchTerm}%`, `%${searchTerm}%`]);
}

/* Verificar si un usuario es miembro de un grupo */
function isGroupMember(groupId, userId) {
  const member = dbGet(
    `SELECT id FROM group_members WHERE group_id = ? AND user_id = ?`,
    [groupId, userId]
  );
  return !!member;
}

module.exports = {
  createGroup,
  getUserGroups,
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  getGroupById,
  searchUsersNotInGroup,
  isGroupMember
};
