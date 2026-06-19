'use strict';
const express = require('express');
const router = express.Router();
const q = require('../db/queries-groups');
const authMiddleware = require('../middleware/auth.middleware');

/* Obtener grupos del usuario */
router.get('/', authMiddleware.authRequired, (req, res) => {
  try {
    const groups = q.getUserGroups(req.user.id);
    res.json({ ok: true, groups });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, msg: 'Error al obtener grupos' });
  }
});

/* Crear un nuevo grupo */
router.post('/', authMiddleware.authRequired, (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.json({ ok: false, msg: 'El nombre del grupo es requerido' });
    }
    const groupId = q.createGroup(name.trim(), req.user.id);
    res.json({ ok: true, groupId, msg: 'Grupo creado' });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, msg: 'Error al crear grupo' });
  }
});

/* Obtener detalles de un grupo */
router.get('/:id', authMiddleware.authRequired, (req, res) => {
  try {
    const group = q.getGroupById(req.params.id);
    if (!group) {
      return res.json({ ok: false, msg: 'Grupo no encontrado' });
    }
    // Verificar que el usuario es miembro
    if (!q.isGroupMember(req.params.id, req.user.id)) {
      return res.json({ ok: false, msg: 'No eres miembro de este grupo' });
    }
    const members = q.getGroupMembers(req.params.id);
    res.json({ ok: true, group, members });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, msg: 'Error al obtener grupo' });
  }
});

/* Agregar miembro a un grupo */
router.post('/:id/members', authMiddleware.authRequired, (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.json({ ok: false, msg: 'ID de usuario requerido' });
    }
    // Verificar que el usuario actual es miembro
    if (!q.isGroupMember(req.params.id, req.user.id)) {
      return res.json({ ok: false, msg: 'No eres miembro de este grupo' });
    }
    const added = q.addGroupMember(req.params.id, userId);
    if (added) {
      res.json({ ok: true, msg: 'Miembro agregado' });
    } else {
      res.json({ ok: false, msg: 'El usuario ya es miembro del grupo' });
    }
  } catch (e) {
    console.error(e);
    res.json({ ok: false, msg: 'Error al agregar miembro' });
  }
});

/* Eliminar miembro de un grupo */
router.delete('/:id/members/:userId', authMiddleware.authRequired, (req, res) => {
  try {
    // Verificar que el usuario actual es miembro
    if (!q.isGroupMember(req.params.id, req.user.id)) {
      return res.json({ ok: false, msg: 'No eres miembro de este grupo' });
    }
    q.removeGroupMember(req.params.id, req.params.userId);
    res.json({ ok: true, msg: 'Miembro eliminado' });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, msg: 'Error al eliminar miembro' });
  }
});

/* Buscar usuarios para agregar al grupo */
router.get('/:id/search', authMiddleware.authRequired, (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    if (!searchTerm || searchTerm.length < 2) {
      return res.json({ ok: true, users: [] });
    }
    // Verificar que el usuario actual es miembro
    if (!q.isGroupMember(req.params.id, req.user.id)) {
      return res.json({ ok: false, msg: 'No eres miembro de este grupo' });
    }
    const users = q.searchUsersNotInGroup(req.params.id, searchTerm, req.user.id);
    res.json({ ok: true, users });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, msg: 'Error al buscar usuarios' });
  }
});

module.exports = router;
