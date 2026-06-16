/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️⚠️⚠️  CHAT.ROUTES — BLINDADO — NO MODIFICAR  ⚠️⚠️⚠️                       ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  ── GET /users — NO ALTERAR LÓGICA DE ROLES ───────────────────────────── ║
 * ║  superadmin/admin → getAllUsersIncludingHidden() (ven ocultos)             ║
 * ║  user → getAllUsers() (filtrado por is_hidden=0, incluye is_approved)     ║
 * ║  is_approved DEBE estar en el SELECT para que el filtro del cliente       ║
 * ║  funcione (chat-users.js renderUserList).                                 ║
 * ║                                                                           ║
 * ║  ── POST /upload — NO ALTERAR TIPOS ───────────────────────────────────── ║
 * ║  Detecta: image/* → 'image', video/* → 'video', audio/* → 'audio'.      ║
 * ║  Límite: 50MB. Devuelve { ok, url, type }. El type es usado por el       ║
 * ║  cliente para renderizar el media correcto en appendMessage y review chat. ║
 * ║                                                                           ║
 * ║  ── DELETE /message/:id — NO ALTERAR ORDEN DE PASOS ───────────────────── ║
 * ║  1. Verificar que el emisor es el solicitante (403 si no).               ║
 * ║  2. Eliminar archivo físico de ./data/uploads/ si existe.                ║
 * ║  3. Eliminar registro de la BD.                                           ║
 * ║  Cambiar el orden deja archivos huérfanos o permite eliminar ajenos.     ║
 * ║                                                                           ║
 * ║  ── GET /superuser-contacts — NO ELIMINAR ─────────────────────────────── ║
 * ║  Usado por checkSuperuserContacts() en chat-ui.js para mostrar el modal   ║
 * ║  de "Superusuario te contactó" a usuarias PENDIENTES de aprobación.       ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
'use strict';
const router = require('express').Router();
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const { authRequired }  = require('../middleware/auth.middleware');
const { decryptBody }   = require('../middleware/encrypt.middleware');
const q = require('../db/queries');

const storage = multer.diskStorage({
  destination: (_r, _f, cb) => cb(null, './data/uploads/'),
  filename:    (_r, f, cb)  => cb(null, Date.now() + path.extname(f.originalname))
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

module.exports = (io) => {
  router.get('/users', authRequired, (req, res) => {
    const role = req.user.role;
    /* Include hidden users for admins and superadmins */
    let users;
    if (role === 'admin' || role === 'superadmin') {
      users = q.getAllUsersIncludingHidden();
    } else {
      users = q.getAllUsers();
    }
    res.json({ ok: true, users });
  });

  /* ⚠️ CRÍTICO — NO ELIMINAR: usado por el cliente (openChat) para obtener los
   * datos de un SUPERUSUARIO oculto y poder abrir el chat con él. Sin este
   * endpoint, "Abrir chat" con un superusuario desde el modal deja de funcionar. */
  router.get('/user/:id', authRequired, (req, res) => {
    const user = q.getUserById(req.params.id);
    if (!user) return res.json({ ok: false, msg: 'Usuario no encontrado' });
    res.json({ ok: true, user });
  });

  router.get('/messages/:room', authRequired, (req, res) => {
    const limit  = parseInt(req.query.limit)  || 50;
    const offset = parseInt(req.query.offset) || 0;
    const msgs   = q.getMessages(req.params.room, limit, offset);
    q.markRead(req.params.room, req.user.id);
    res.json({ ok: true, messages: msgs });
  });

  router.post('/message', authRequired, decryptBody, (req, res) => {
    const { room, receiverId, type, content, iv } = req.body;
    if (!room || !content)
      return res.json({ ok: false, msg: 'Datos incompletos' });
    const id = q.saveMessage({
      room, senderId: req.user.id, receiverId, type, content, iv
    });
    res.json({ ok: true, id });
  });

  router.post('/upload', authRequired, upload.single('file'), (req, res) => {
    if (!req.file) return res.json({ ok: false, msg: 'Sin archivo' });
    const mime = req.file.mimetype;
    let type = 'file';
    if (mime.startsWith('image/'))  type = 'image';
    if (mime.startsWith('video/'))  type = 'video';
    if (mime.startsWith('audio/'))  type = 'audio';
    res.json({ ok: true, url: '/uploads/' + req.file.filename, type });
  });

  router.delete('/message/:id', authRequired, (req, res) => {
    /* ═════════════════════════════════════════════════════════════════════════════
     *  ⚠️  CRÍTICO — ELIMINACIÓN COMPLETA DE MENSAJES — NO MODIFICAR  ⚠️
     * ─────────────────────────────────────────────────────────────────────────────────
     *  Al eliminar un mensaje "para todos", se debe eliminar también el archivo físico
     *  del servidor para no dejar rastro alguno.
     *
     *  REGLAS QUE DEBEN MANTENERSE SIEMPRE:
     *  1. Obtener el mensaje primero para verificar que el usuario es el emisor.
     *  2. Si el mensaje tiene un archivo (image, video, audio, file), eliminar el archivo físico.
     *  3. El archivo está en ./data/uploads/ y el content contiene la URL relativa.
     *  4. Usar fs.unlink para eliminar el archivo (ignorar errores si el archivo no existe).
     *  5. Luego eliminar el registro de la base de datos.
     * ═════════════════════════════════════════════════════════════════════════════ */
    const msg = q.getMessageById(req.params.id);
    if (!msg || msg.sender_id !== req.user.id) {
      return res.status(403).json({ ok: false, error: 'No autorizado' });
    }

    /* Eliminar archivo físico si existe */
    if (msg.type !== 'text' && msg.content) {
      const filePath = path.join(__dirname, '..', 'data', 'uploads', path.basename(msg.content));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    q.deleteMessage(req.params.id, req.user.id);
    res.json({ ok: true });
  });

  router.post('/read', authRequired, (req, res) => {
    const { room } = req.body;
    if (room) q.markRead(room, req.user.id);
    res.json({ ok: true });
  });

  router.get('/superuser-contacts', authRequired, (req, res) => {
    const contacts = q.getPendingSuperuserContacts(req.user.id);
    res.json({ ok: true, contacts });
  });

  router.post('/superuser-contacts/:id/acknowledge', authRequired, (req, res) => {
    q.acknowledgeSuperuserContact(req.params.id);
    res.json({ ok: true });
  });

  return router;
};
