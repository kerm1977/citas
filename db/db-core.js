/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️⚠️⚠️  DB-CORE — BLINDADO — NO MODIFICAR  ⚠️⚠️⚠️                          ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  Motor: sql.js (SQLite en WebAssembly). Sin dependencias nativas.         ║
 * ║                                                                           ║
 * ║  ── persist() — CRÍTICO — NO ELIMINAR NI HACER ASÍNCRONO ─────────────── ║
 * ║  Escribe la BD en disco de forma SÍNCRONA (fs.writeFileSync).             ║
 * ║  Se llama explícitamente en approveUser() y rejectUser() para garantizar  ║
 * ║  que los cambios críticos de moderación no se pierdan si el servidor      ║
 * ║  se reinicia entre el dbRun y el setImmediate(persist) normal.            ║
 * ║  NO convertir a asíncrono ni eliminar estas llamadas explícitas.          ║
 * ║                                                                           ║
 * ║  ── dbRun(sql, params) — NO ALTERAR ───────────────────────────────────── ║
 * ║  Ejecuta sentencias INSERT/UPDATE/DELETE. Llama setImmediate(persist)     ║
 * ║  para persistir eventualmente. Para operaciones críticas (approve/reject) ║
 * ║  se llama persist() explícitamente después.                               ║
 * ║                                                                           ║
 * ║  ── DB_PATH — NO CAMBIAR SIN ACTUALIZAR .env ──────────────────────────── ║
 * ║  Por defecto: './data/chat.db'. Configurable via DB_PATH en .env.         ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
'use strict';
/* Pure-JS SQLite via sql.js (WebAssembly) — no native build tools needed */
const fs   = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './data/chat.db';
let _db = null;

/* ── Init (async, call once at startup) ─────────────────────── */
async function initCore() {
  const initSqlJs  = require('sql.js');
  const wasmBinary = fs.readFileSync(
    path.resolve(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm')
  );
  const SQL = await initSqlJs({ wasmBinary });

  const dir = path.dirname(path.resolve(DB_PATH));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    _db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    _db = new SQL.Database();
  }

  /* WAL-like: persist after every write via setImmediate */
  console.log('✅  sql.js Database ready');
  return _db;
}

/* ── Persist to disk ─────────────────────────────────────────── */
function persist() {
  if (!_db) return;
  try {
    const data = _db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error('[DB] persist error:', e.message);
  }
}

/* ── Helpers mimicking better-sqlite3 synchronous API ───────── */
function dbGet(sql, params = []) {
  if (!_db) throw new Error('DB not ready');
  const stmt = _db.prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

function dbAll(sql, params = []) {
  if (!_db) throw new Error('DB not ready');
  const rows = [];
  const stmt = _db.prepare(sql);
  stmt.bind(params);
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function dbRun(sql, params = []) {
  if (!_db) throw new Error('DB not ready');
  _db.run(sql, params);
  setImmediate(persist);
}

function dbExec(sql) {
  if (!_db) throw new Error('DB not ready');
  _db.run(sql);
  setImmediate(persist);
}

module.exports = { initCore, persist, dbGet, dbAll, dbRun, dbExec };
