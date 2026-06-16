'use strict';
const express  = require('express');
const router   = express.Router();
const q        = require('../db/queries');
const { authRequired } = require('../middleware/auth.middleware');

/* POST /api/blocks — bloquear usuario */
router.post('/', authRequired, (req, res) => {
  const { blocked_id } = req.body;
  if (!blocked_id) return res.json({ ok: false, msg: 'blocked_id requerido' });
  if (blocked_id === req.user.id) return res.json({ ok: false, msg: 'No puedes bloquearte a ti mismo' });
  try {
    q.blockUser(req.user.id, blocked_id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: 'Error al bloquear' });
  }
});

/* DELETE /api/blocks/:blocked_id — desbloquear (requiere contraseña) */
router.delete('/:blocked_id', authRequired, (req, res) => {
  const { password } = req.body;
  if (!password) return res.json({ ok: false, msg: 'Contraseña requerida' });
  const bcrypt = require('bcryptjs');
  const qUsers = require('../db/queries-users');
  const user = qUsers.getUserById(req.user.id);
  if (!user) return res.json({ ok: false, msg: 'Usuario no encontrado' });
  bcrypt.compare(password, user.password, (err, match) => {
    if (err || !match) return res.json({ ok: false, msg: 'Contraseña incorrecta' });
    try {
      q.unblockUser(req.user.id, req.params.blocked_id);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, msg: 'Error al desbloquear' });
    }
  });
});

/* GET /api/blocks — lista de usuarios bloqueados por mí */
router.get('/', authRequired, (req, res) => {
  try {
    const users = q.getBlockedUsers(req.user.id);
    res.json({ ok: true, users });
  } catch (e) {
    res.status(500).json({ ok: false, msg: 'Error al cargar bloqueados' });
  }
});

module.exports = router;
