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
    SELECT u.id, u.name, u.avatar, u.online, gm.joined_at, gm.role
    FROM group_members gm
    INNER JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = ?
    ORDER BY gm.joined_at ASC
  `, [groupId]);
}

/* Agregar miembro a un grupo */
function addGroupMember(groupId, userId, role = 'member') {
  const id = randomUUID();
  try {
    dbRun(
      `INSERT INTO group_members (id, group_id, user_id, role) VALUES (?, ?, ?, ?)`,
      [id, groupId, userId, role]
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

/* Verificar si un usuario es creador de un grupo */
function isGroupCreator(groupId, userId) {
  const group = dbGet(
    `SELECT created_by FROM groups WHERE id = ?`,
    [groupId]
  );
  return group && group.created_by === userId;
}

/* Verificar si un usuario es administrador de un grupo */
function isGroupAdmin(groupId, userId) {
  const member = dbGet(
    `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
    [groupId, userId]
  );
  return member && (member.role === 'admin' || member.role === 'creator');
}

/* Cambiar rol de un miembro */
function updateGroupMemberRole(groupId, userId, role) {
  dbRun(
    `UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?`,
    [role, groupId, userId]
  );
}

/* Crear invitación para un grupo */
function createGroupInvite(groupId, createdBy, expiresInHours = 24) {
  const id = randomUUID();
  const token = randomUUID().replace(/-/g, '').substring(0, 12);
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();
  
  dbRun(
    `INSERT INTO group_invites (id, group_id, token, created_by, expires_at) VALUES (?, ?, ?, ?, ?)`,
    [id, groupId, token, createdBy, expiresAt]
  );
  
  return token;
}

/* Obtener invitación por token */
function getGroupInviteByToken(token) {
  return dbGet(`
    SELECT gi.*, g.name as group_name, u.name as creator_name
    FROM group_invites gi
    INNER JOIN groups g ON gi.group_id = g.id
    LEFT JOIN users u ON gi.created_by = u.id
    WHERE gi.token = ? AND (gi.expires_at IS NULL OR gi.expires_at > datetime('now'))
  `, [token]);
}

/* Aceptar invitación */
function acceptGroupInvite(token, userId) {
  const invite = getGroupInviteByToken(token);
  if (!invite) return { success: false, msg: 'Invitación no encontrada o expirada' };
  
  // Verificar que el creador sea quien acepta (según requerimiento)
  if (invite.created_by !== userId) {
    return { success: false, msg: 'Solo el creador puede aceptar esta invitación' };
  }
  
  // Verificar que no sea miembro ya
  if (isGroupMember(invite.group_id, userId)) {
    return { success: false, msg: 'Ya eres miembro de este grupo' };
  }
  
  // Agregar al grupo
  addGroupMember(invite.group_id, userId);
  
  // Marcar como aceptada
  dbRun(
    `UPDATE group_invites SET accepted_by = ?, accepted_at = datetime('now') WHERE id = ?`,
    [userId, invite.id]
  );
  
  return { success: true, groupId: invite.group_id };
}

/* Obtener invitaciones de un grupo */
function getGroupInvites(groupId) {
  return dbAll(`
    SELECT gi.*, u.name as accepted_by_name
    FROM group_invites gi
    LEFT JOIN users u ON gi.accepted_by = u.id
    WHERE gi.group_id = ?
    ORDER BY gi.created_at DESC
  `, [groupId]);
}

/* Eliminar invitación */
function deleteGroupInvite(inviteId) {
  dbRun(`DELETE FROM group_invites WHERE id = ?`, [inviteId]);
}

module.exports = {
  createGroup,
  getUserGroups,
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  getGroupById,
  searchUsersNotInGroup,
  isGroupMember,
  isGroupCreator,
  isGroupAdmin,
  updateGroupMemberRole,
  createGroupInvite,
  getGroupInviteByToken,
  acceptGroupInvite,
  getGroupInvites,
  deleteGroupInvite
};
