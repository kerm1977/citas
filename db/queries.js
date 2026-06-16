/* +---------------------------------------------------------------------------+
 * ¦  DB/QUERIES — ORQUESTADOR — re-exporta sub-módulos — NO MODIFICAR       ¦
 * ¦  · queries-users.js      ? CRUD de usuarios                             ¦
 * ¦  · queries-messages.js   ? mensajes                                     ¦
 * ¦  · queries-moderation.js ? aprobación / rechazo / contactos             ¦
 * +---------------------------------------------------------------------------+ */
'use strict';

const u   = require('./queries-users');
const m   = require('./queries-messages');
const mod = require('./queries-moderation');

module.exports = { ...u, ...m, ...mod };
