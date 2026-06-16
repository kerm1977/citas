'use strict';
const router = require('express').Router();
const path   = require('path');
const fs     = require('fs');
const { adminRequired } = require('../middleware/auth.middleware');
const { encrypt }       = require('../middleware/encrypt.middleware');
const { dbAll }         = require('../db/db-core');

router.use(adminRequired);

router.get('/download', (req, res) => {
  const dbPath = process.env.DB_PATH || './data/chat.db';
  const abs    = path.resolve(dbPath);
  if (!fs.existsSync(abs))
    return res.json({ ok: false, msg: 'Base de datos no encontrada' });

  const ts   = new Date().toISOString().replace(/[:.]/g, '-');
  const name = `chat-backup-${ts}.db`;
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  fs.createReadStream(abs).pipe(res);
});

router.get('/json', (req, res) => {
  try {
    const users = dbAll('SELECT id,name,email,phone,role,online,last_seen,created_at FROM users WHERE is_hidden=0', []);
    const msgs  = dbAll('SELECT id,room,sender_id,type,created_at FROM messages WHERE deleted=0', []);
    const payload = { ts: new Date().toISOString(), users, messages: msgs };
    const enc = encrypt(JSON.stringify(payload));
    res.json({ ok: true, backup: enc });
  } catch (e) {
    res.json({ ok: false, msg: 'Error al generar respaldo' });
  }
});

router.post('/restore', (req, res) => {
  res.json({ ok: false, msg: 'Restaurar: sube el archivo .db mediante el panel de administración' });
});

module.exports = router;
