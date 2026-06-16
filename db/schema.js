'use strict';
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const { initCore, dbGet, dbRun, dbExec } = require('./db-core');

async function initDB() {
  await initCore();

  dbExec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      phone         TEXT,
      password      TEXT NOT NULL,
      avatar        TEXT,
      role          TEXT DEFAULT 'user',
      is_hidden     INTEGER DEFAULT 0,
      is_blocked    INTEGER DEFAULT 0,
      recovery_hash TEXT,
      online        INTEGER DEFAULT 0,
      last_seen     TEXT,
      created_at    TEXT DEFAULT (datetime('now'))
    )
  `);

  /* ═════════════════════════════════════════════════════════════════════════════
   *  ⚠️  CRÍTICO — AGREGAR COLUMNA IS_APPROVED — NO MODIFICAR  ⚠️
   * ─────────────────────────────────────────────────────────────────────────────────
   *  Agrega la columna is_approved a la tabla users para el sistema de moderación.
   *  is_approved = 1: Usuaria aprobada, puede ver lista de usuarias
   *  is_approved = 0: Usuaria pendiente de aprobación, solo ve chat con moderadoras
   *
   *  REGLAS QUE DEBEN MANTENERSE SIEMPRE:
   *  1. Usar ALTER TABLE en lugar de recrear la tabla (para no perder datos)
   *  2. Default = 0 para que nuevos registros requieran aprobación
   *  3. NO eliminar este bloque de código
   * ═════════════════════════════════════════════════════════════════════════════ */
  try {
    dbExec(`ALTER TABLE users ADD COLUMN is_approved INTEGER DEFAULT 0`);
  } catch (e) {
    /* La columna ya existe, ignorar error */
  }

  dbExec(`
    CREATE TABLE IF NOT EXISTS messages (
      id          TEXT PRIMARY KEY,
      room        TEXT NOT NULL,
      sender_id   TEXT NOT NULL,
      receiver_id TEXT,
      type        TEXT DEFAULT 'text',
      content     TEXT NOT NULL,
      iv          TEXT,
      deleted     INTEGER DEFAULT 0,
      read_at     TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  /* ═════════════════════════════════════════════════════════════════════════════
   *  ⚠️  CRÍTICO — AGREGAR COLUMNA REPLY_TO — NO MODIFICAR  ⚠️
   * ─────────────────────────────────────────────────────────────────────────────────
   *  Agrega la columna reply_to a la tabla messages si no existe.
   *
   *  REGLAS QUE DEBEN MANTENERSE SIEMPRE:
   *  1. Usar ALTER TABLE en lugar de recrear la tabla (para no perder datos)
   *  2. Usar try/catch para ignorar error si la columna ya existe
   *  3. NO eliminar este bloque de código
   * ═════════════════════════════════════════════════════════════════════════════ */
  try {
    dbExec(`ALTER TABLE messages ADD COLUMN reply_to TEXT`);
  } catch (e) {
    /* La columna ya existe, ignorar error */
  }

  dbExec(`CREATE INDEX IF NOT EXISTS idx_msg_room   ON messages(room)`);
  dbExec(`CREATE INDEX IF NOT EXISTS idx_msg_sender ON messages(sender_id)`);

  dbExec(`
    CREATE TABLE IF NOT EXISTS superuser_contacts (
      id          TEXT PRIMARY KEY,
      superuser_id TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      message     TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      acknowledged INTEGER DEFAULT 0
    )
  `);

  dbExec(`CREATE INDEX IF NOT EXISTS idx_su_user ON superuser_contacts(user_id, acknowledged)`);

  dbExec(`
    CREATE TABLE IF NOT EXISTS blocks (
      id         TEXT PRIMARY KEY,
      blocker_id TEXT NOT NULL,
      blocked_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(blocker_id, blocked_id)
    )
  `);

  dbExec(`
    CREATE TABLE IF NOT EXISTS reports (
      id           TEXT PRIMARY KEY,
      reporter_id  TEXT NOT NULL,
      emitter_id   TEXT,
      receiver_id  TEXT,
      message_id   TEXT,
      room         TEXT,
      description  TEXT,
      evidence_url TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    )
  `);

  await _seedSuperusers();
  console.log('✅  Database initialised');
}

async function _seedSuperusers() {
  const superusers = [
    { email: 'irina_salinas_92@protonmail.com', name: 'Irina Salinas', pass: 'CR129x7848n' },
    { email: 'kenth1977@gmail.com',             name: 'Kenth Admin',   pass: 'CR129x7848n' }
  ];
  for (const u of superusers) {
    const exists = dbGet('SELECT id FROM users WHERE email=?', [u.email]);
    if (!exists) {
      const hash = await bcrypt.hash(u.pass, 14);
      const id   = randomUUID();
      dbRun(
        `INSERT INTO users (id,name,email,password,role,is_hidden) VALUES (?,?,?,?,'superadmin',1)`,
        [id, u.name, u.email, hash]
      );
    }
  }
}

module.exports = { initDB };
