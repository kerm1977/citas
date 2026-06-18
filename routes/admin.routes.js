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
        /* Buscar mensaje que contiene este archivo para obtener información del remitente */
        const msg = q.getMessageByContent('/uploads/' + f);
        const senderInfo = msg ? q.getUserById(msg.sender_id) : null;
        return {
          name: f,
          size: stats.size,
          created: stats.birthtime,
          url: '/uploads/' + f,
          sender_id: senderInfo?.id || null,
          sender_name: senderInfo?.name || 'Desconocido',
          message_created: msg?.created_at || null
        };
      });
    }
  } catch (e) {
    console.error('Error reading uploads:', e);
  }
  res.json({ ok: true, files });
});

/* DELETE /api/admin/media — eliminar archivo */
router.delete('/media', (req, res) => {
  const { url } = req.body;
  if (!url) return res.json({ ok: false, msg: 'URL requerida' });
  
  const fs = require('fs');
  const path = require('path');
  const uploadsDir = path.join(__dirname, '../data/uploads');
  const fileName = path.basename(url);
  const filePath = path.join(uploadsDir, fileName);
  
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ ok: true });
    } else {
      res.json({ ok: false, msg: 'Archivo no encontrado' });
    }
  } catch (e) {
    console.error('[Admin] Error deleting file:', e);
    res.json({ ok: false, msg: 'Error al eliminar archivo' });
  }
});

/* PATCH /api/admin/users/:id/warning — activar/desactivar advertencia */
router.patch('/users/:id/warning', (req, res) => {
  const { active } = req.body;
  q.setWarningActive(req.params.id, !!active);
  res.json({ ok: true });
});

/* GET /api/admin/settings — obtener configuración de admin */
router.get('/settings', (_req, res) => {
  const warningMessage = q.getSetting('warning_message') || '';
  const registerMessage = q.getSetting('register_message') || '';
  const registerTitle = q.getSetting('register_title') || '';
  res.json({ ok: true, settings: { warning_message: warningMessage, register_message: registerMessage, register_title: registerTitle } });
});

/* POST /api/admin/settings — guardar configuración de admin */
router.post('/settings', (req, res) => {
  const { warning_message, register_message, register_title } = req.body;
  if (warning_message !== undefined && typeof warning_message !== 'string') return res.json({ ok: false, msg: 'warning_message debe ser texto' });
  if (register_message !== undefined && typeof register_message !== 'string') return res.json({ ok: false, msg: 'register_message debe ser texto' });
  if (register_title !== undefined && typeof register_title !== 'string') return res.json({ ok: false, msg: 'register_title debe ser texto' });
  if (warning_message !== undefined) q.setSetting('warning_message', warning_message);
  if (register_message !== undefined) q.setSetting('register_message', register_message);
  if (register_title !== undefined) q.setSetting('register_title', register_title);
  res.json({ ok: true });
});

/* GET /api/public/register-message — endpoint público para mensaje de registro */
const express = require('express');
const publicRouter = express.Router();
const { getSetting } = require('../db/queries-admin-settings');
publicRouter.get('/register-message', (_req, res) => {
  const msg = getSetting('register_message') || '';
  const title = getSetting('register_title') || '🌸 Bienvenidas a Zona Segura';
  console.log('[Public] Register message requested, returning:', { title, msg });
  res.json({ ok: true, title, message: msg });
});

/* POST /api/admin/messages — enviar mensaje directo desde admin a usuario */
router.post('/messages', (req, res) => {
  const { receiver_id, content, type } = req.body;
  if (!receiver_id || !content) return res.json({ ok: false, msg: 'receiver_id y content requeridos' });
  try {
    /* Generar room temporal para mensaje directo: adminId_userId */
    const room = [req.user.id, receiver_id].sort().join('_');
    const msgId = q.saveMessage({
      senderId: req.user.id,
      receiverId: receiver_id,
      type: type || 'text',
      content,
      room
    });
    res.json({ ok: true, msgId });
  } catch (e) {
    console.error('[Admin] Error sending message:', e);
    res.status(500).json({ ok: false, msg: 'Error al enviar mensaje' });
  }
});

module.exports = { router, publicRouter };
