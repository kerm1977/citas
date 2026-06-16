'use strict';
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { adminRequired } = require('../middleware/auth.middleware');
const q = require('../db/queries');

/* All admin routes require admin/superadmin role */
router.use(adminRequired);

router.get('/users', (_req, res) => {
  res.json({ ok: true, users: q.getAllUsers() });
});

router.patch('/users/:id/block', (req, res) => {
  const { blocked } = req.body;
  q.blockUser(req.params.id, !!blocked);
  res.json({ ok: true });
});

router.delete('/users/:id', (req, res) => {
  q.deleteUser(req.params.id);
  res.json({ ok: true });
});

router.patch('/users/:id/role', (req, res) => {
  const { role } = req.body;
  const allowed  = ['user', 'admin'];
  if (!allowed.includes(role))
    return res.json({ ok: false, msg: 'Rol inválido' });
  q.setUserRole(req.params.id, role);
  res.json({ ok: true });
});

router.patch('/users/:id/reset-password', async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) return res.json({ ok: false, msg: 'Contraseña requerida' });
    const hash = await bcrypt.hash(newPassword, 12);
    q.updatePassword(req.params.id, hash);
    res.json({ ok: true });
  } catch { res.json({ ok: false, msg: 'Error' }); }
});

router.get('/stats', (_req, res) => {
  const total  = q.countUsers();
  const online = q.countOnline();
  const msgs   = q.countMessages();
  res.json({ ok: true, stats: { total, online, messages: msgs } });
});

router.get('/users/export', (_req, res) => {
  const users = q.getAllUsers();
  res.json({ ok: true, users });
});

router.get('/media', (_req, res) => {
  const fs = require('fs');
  const path = require('path');
  const uploadsDir = path.join(__dirname, '../data/uploads');
  let files = [];
  try {
    if (fs.existsSync(uploadsDir)) {
      files = fs.readdirSync(uploadsDir).map(f => {
        const fullPath = path.join(uploadsDir, f);
        const stats = fs.statSync(fullPath);
        return {
          name: f,
          size: stats.size,
          created: stats.birthtime,
          url: '/uploads/' + f
        };
      });
    }
  } catch (e) {
    console.error('Error reading uploads:', e);
  }
  res.json({ ok: true, files });
});

/* POST /api/admin/messages — enviar mensaje directo desde admin a usuario */
router.post('/messages', (req, res) => {
  const { receiver_id, content, type } = req.body;
  if (!receiver_id || !content) return res.json({ ok: false, msg: 'receiver_id y content requeridos' });
  try {
    const msgId = q.saveMessage({
      sender_id: req.user.id,
      receiver_id,
      type: type || 'text',
      content,
      room: null
    });
    res.json({ ok: true, msgId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: 'Error al enviar mensaje' });
  }
});

module.exports = router;
