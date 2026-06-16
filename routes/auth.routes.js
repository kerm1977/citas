'use strict';
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { signToken }    = require('../middleware/auth.middleware');
const { decryptBody }  = require('../middleware/encrypt.middleware');
const q = require('../db/queries');

const upload = multer({
  dest: './data/uploads/',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_r, f, cb) => cb(null, f.mimetype.startsWith('image/'))
});

module.exports = (io) => {
const router = require('express').Router();

router.post('/register', decryptBody, upload.single('avatar'), async (req, res) => {
  try {
    const { name, email, phone, password, recoveryCode } = req.body;
    if (!name || !email || !phone || !password || !recoveryCode)
      return res.json({ ok: false, msg: 'Todos los campos son requeridos' });

    if (q.getUserByEmail(email))
      return res.json({ ok: false, msg: 'Este correo ya está registrado' });

    const hash     = await bcrypt.hash(password, 12);
    const recHash  = crypto.createHash('sha256').update(recoveryCode).digest('hex');
    let avatar = null;
    if (req.file) {
      avatar = '/uploads/' + req.file.filename;
    }
    /* ═════════════════════════════════════════════════════════════════════════════
     *  ⚠️  CRÍTICO — CREACIÓN DE USUARIA CON MODERACIÓN — NO MODIFICAR  ⚠️
     * ─────────────────────────────────────────────────────────────────────────────────
     *  Al crear una nueva usuaria:
     *  1. is_approved=0 por defecto (requiere aprobación de moderadoras)
     *  2. Superusuarios son aprobados automáticamente (is_approved=1)
     *  3. La columna is_approved se agrega vía ALTER TABLE en schema.js
     * ═════════════════════════════════════════════════════════════════════════════ */
    const id = q.createUser({ name, email, phone, password: hash, avatar, recoveryHash: recHash });
    const token = signToken({ id, email, role: 'user' });

    // Notificar en tiempo real a superadmins conectados
    io.emit('moderation:new_user', { id, name, email, phone, avatar, created_at: new Date().toISOString() });
    console.log(`[Moderation] New user registered: ${name} (${email}) — alert emitted`);

    res.json({ 
      ok: true, 
      token, 
      user: { id, name, email, phone, avatar, role: 'user', is_approved: 0 },
      is_approved: false,
      pending_approval: true
    });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, msg: 'Error interno' });
  }
});

router.post('/login', decryptBody, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.json({ ok: false, msg: 'Credenciales requeridas' });

    /* getUserByEmailAny includes hidden/superadmin users */
    const user = q.getUserByEmailAny(email);

    if (!user)
      return res.json({ ok: false, msg: 'Credenciales incorrectas' });
    if (user.is_blocked)
      return res.json({ ok: false, msg: 'Cuenta bloqueada. Contacta al administrador' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.json({ ok: false, msg: 'Credenciales incorrectas' });

    /* ═════════════════════════════════════════════════════════════════════════════
     *  ⚠️  CRÍTICO — LOGIN CON VERIFICACIÓN DE APROBACIÓN — NO MODIFICAR  ⚠️
     * ─────────────────────────────────────────────────────────────────────────────────
     *  Al iniciar sesión:
     *  1. Superusuarios siempre están aprobados (bypass de moderación)
     *  2. Usuarias regulares requieren is_approved=1 para ver lista de usuarias
     *  3. is_approved se consulta con getUserApprovalStatus
     * ═════════════════════════════════════════════════════════════════════════════ */
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    const approvalStatus = q.getUserApprovalStatus(user.id);
    const isApproved = user.role === 'superadmin' || approvalStatus?.is_approved === 1;
    
    const safe  = { id: user.id, name: user.name, email: user.email,
                    phone: user.phone, avatar: user.avatar, role: user.role,
                    is_approved: isApproved ? 1 : 0 };
    res.json({ ok: true, token, user: safe, is_approved: isApproved });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, msg: 'Error interno' });
  }
});

router.post('/recover', decryptBody, async (req, res) => {
  try {
    const { recoveryCode, newPassword } = req.body;
    if (!recoveryCode || !newPassword)
      return res.json({ ok: false, msg: 'Datos incompletos' });

    const hash = crypto.createHash('sha256').update(recoveryCode).digest('hex');
    const user = q.getUserByRecovery(hash);
    if (!user) return res.json({ ok: false, msg: 'Clave de recuperación inválida' });

    const pwHash = await bcrypt.hash(newPassword, 12);
    q.updatePassword(user.id, pwHash);
    res.json({ ok: true, msg: 'Contraseña actualizada' });
  } catch (e) {
    res.json({ ok: false, msg: 'Error interno' });
  }
});

router.put('/avatar', require('../middleware/auth.middleware').authRequired,
  upload.single('avatar'), (req, res) => {
    if (!req.file) return res.json({ ok: false, msg: 'Sin imagen' });
    const url = '/uploads/' + req.file.filename;
    q.updateUserAvatar(req.user.id, url);
    res.json({ ok: true, avatar: url });
  }
);

/* ═════════════════════════════════════════════════════════════════════════════
 *  ⚠️  CRÍTICO — RUTAS DE MODERACIÓN — NO MODIFICAR  ⚠️
 * ─────────────────────────────────────────────────────────────────────────────────
 *  Endpoints para el sistema de aprobación de nuevas usuarias.
 *  Solo accesibles por superusuarios.
 * ═════════════════════════════════════════════════════════════════════════════ */

/* Obtener usuarias pendientes de aprobación */
router.get('/pending-users', require('../middleware/auth.middleware').authRequired, (req, res) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ ok: false, msg: 'No autorizado' });
  }
  const pending = q.getPendingUsers();
  res.json({ ok: true, users: pending });
});

/* Verificar estado de aprobación del usuario actual */
router.get('/approval-status', require('../middleware/auth.middleware').authRequired, (req, res) => {
  const status = q.getUserApprovalStatus(req.user.id);
  const isApproved = req.user.role === 'superadmin' || status?.is_approved === 1;
  res.json({ ok: true, is_approved: isApproved, role: req.user.role });
});

/* Aprobar usuaria */
router.post('/approve-user/:id', require('../middleware/auth.middleware').authRequired, (req, res) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ ok: false, msg: 'No autorizado' });
  }
  q.approveUser(req.params.id);
  res.json({ ok: true, msg: 'Usuaria aprobada' });
});

/* Rechazar y eliminar usuaria */
router.post('/reject-user/:id', require('../middleware/auth.middleware').authRequired, (req, res) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ ok: false, msg: 'No autorizado' });
  }
  q.rejectUser(req.params.id);
  res.json({ ok: true, msg: 'Usuaria rechazada y eliminada' });
});

/* Eliminar cuenta propia (para usuarias rechazadas) */
router.post('/delete-account', require('../middleware/auth.middleware').authRequired, (req, res) => {
  q.deleteUser(req.user.id);
  res.json({ ok: true, msg: 'Cuenta eliminada' });
});

return router;
}; // fin module.exports = (io) => {
