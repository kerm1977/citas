'use strict';
const { dbGet, dbAll, dbRun } = require('./db-core');

function getSetting(key) {
  const row = dbGet('SELECT value FROM admin_settings WHERE key=?', [key]);
  return row ? row.value : null;
}

function setSetting(key, value) {
  dbRun(`INSERT INTO admin_settings (key, value) VALUES (?,?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [key, value]);
}

module.exports = { getSetting, setSetting };
