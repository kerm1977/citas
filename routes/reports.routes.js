'use strict';
/* ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  REPORTS.ROUTES — /api/reports — NO MODIFICAR                           ║
 * ║  POST /api/reports  → cualquier usuario autenticado puede reportar      ║
 * ║  GET  /api/reports  → solo admin / superadmin                           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝ */
const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const router   = express.Router();
const q        = require('../db/queries');
const { authRequired } = require('../middleware/auth.middleware');

const uploadDir = path.join(__dirname, '../data/uploads/reports');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_r, _f, cb) => cb(null, uploadDir),
  filename:    (_r, f, cb)  => cb(null, Date.now() + path.extname(f.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_r, f, cb) => {
    if (f.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  }
});

/* POST /api/reports — crear denuncia */
router.post('/', authRequired, upload.single('evidence'), (req, res) => {
  try {
    const { emitter_id, receiver_id, message_id, room, description } = req.body;
    const evidenceUrl = req.file ? `/uploads/reports/${req.file.filename}` : null;
    const id = q.createReport({
      reporterId:  req.user.id,
      emitterId:   emitter_id  || null,
      receiverId:  receiver_id || null,
      messageId:   message_id  || null,
      room:        room        || null,
      description: description || null,
      evidenceUrl
    });
    res.json({ ok: true, id });
  } catch (e) {
    console.error('[Reports] Error creating report:', e.message);
    res.status(500).json({ ok: false, msg: 'Error al guardar la denuncia' });
  }
});

/* GET /api/reports — solo admin/superadmin */
router.get('/', authRequired, (req, res) => {
  const role = req.user.role;
  if (role !== 'admin' && role !== 'superadmin') {
    return res.status(403).json({ ok: false, msg: 'Acceso denegado' });
  }
  try {
    const reports = q.getReports();
    res.json({ ok: true, reports });
  } catch (e) {
    console.error('[Reports] Error loading reports:', e.message);
    res.status(500).json({ ok: false, msg: 'Error al cargar denuncias' });
  }
});

/* DELETE /api/reports/:id — eliminar denuncia (solo admin/superadmin) */
router.delete('/:id', authRequired, (req, res) => {
  const role = req.user.role;
  if (role !== 'admin' && role !== 'superadmin') {
    return res.status(403).json({ ok: false, msg: 'Acceso denegado' });
  }
  try {
    q.deleteReport(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('[Reports] Error deleting report:', e.message);
    res.status(500).json({ ok: false, msg: 'Error al eliminar denuncia' });
  }
});

module.exports = router;
