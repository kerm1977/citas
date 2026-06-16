/* ═════════════════════════════════════════════════════════════════════════════
 *  ⚠️⚠️⚠️ SCRIPT DE RESPALDO AUTOMÁTICO — NO MODIFICAR ⚠️⚠️⚠️
 * ─────────────────────────────────────────────────────────────────────────────────
 *  Este script crea respaldos automáticos de la base de datos con control de versiones.
 *
 *  REGLAS DE PRESERVACIÓN:
 *  1. Este script debe ejecutarse antes de cualquier cambio en la base de datos
 *  2. Los respaldos se guardan en data/backups/ con timestamp
 *  3. Se mantienen los últimos 10 respaldos para evitar ocupar mucho espacio
 *  4. Solo se permiten integraciones, NO cambios a la lógica existente
 * ═════════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const backupDir = path.join(__dirname, 'data', 'backups');
const dbFile = path.join(dataDir, 'chat.db');

/* Crear directorio de respaldos si no existe */
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

/* Generar nombre de archivo con timestamp */
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupFile = path.join(backupDir, `chat-backup-${timestamp}.db`);

/* Copiar base de datos */
if (fs.existsSync(dbFile)) {
  fs.copyFileSync(dbFile, backupFile);
  console.log(`✅ Respaldo creado: ${backupFile}`);
  
  /* Mantener solo los últimos 10 respaldos */
  const backups = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('chat-backup-') && f.endsWith('.db'))
    .map(f => ({
      name: f,
      path: path.join(backupDir, f),
      time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);
  
  if (backups.length > 10) {
    const toDelete = backups.slice(10);
    toDelete.forEach(f => {
      fs.unlinkSync(f.path);
      console.log(`🗑️  Respaldo antiguo eliminado: ${f.name}`);
    });
  }
  
  console.log(`📦 Total de respaldos: ${backups.length}`);
} else {
  console.log('⚠️  No existe base de datos para respaldar');
}
