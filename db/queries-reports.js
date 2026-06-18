'use strict';
/* ╔══════════════════════════════════════════════════════════════╗
 * ║  QUERIES-REPORTS — denuncias — NO MODIFICAR                 ║
 * ╚══════════════════════════════════════════════════════════════╝ */
const { randomUUID } = require('crypto');
const { dbGet, dbAll, dbRun } = require('./db-core');

function createReport({ reporterId, emitterId, receiverId, messageId, room, description, evidenceUrl }) {
  const id = randomUUID();
  dbRun(
    `INSERT INTO reports (id,reporter_id,emitter_id,receiver_id,message_id,room,description,evidence_url)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, reporterId, emitterId || null, receiverId || null,
     messageId || null, room || null, description || null, evidenceUrl || null]
  );
  return id;
}

function getReports() {
  return dbAll(
    `SELECT r.id, r.description, r.evidence_url, r.room, r.message_id, r.created_at,
            r.reporter_id, r.emitter_id, r.receiver_id,
            ur.name  AS reporter_name,
            ue.name  AS emitter_name,
            uc.name  AS receiver_name
     FROM reports r
     LEFT JOIN users ur ON ur.id = r.reporter_id
     LEFT JOIN users ue ON ue.id = r.emitter_id
     LEFT JOIN users uc ON uc.id = r.receiver_id
     ORDER BY r.created_at DESC`,
    []
  );
}

function getReportById(id) {
  return dbGet('SELECT * FROM reports WHERE id=?', [id]);
}

function deleteReport(id) {
  dbRun(`DELETE FROM reports WHERE id=?`, [id]);
}

module.exports = { createReport, getReports, getReportById, deleteReport };
