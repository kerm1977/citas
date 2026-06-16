/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  MODERATION-STATE — estado compartido del sistema de moderación          ║
 * ║  Se carga PRIMERO antes que cualquier otro moderation-*.js              ║
 * ║  Todos los sub-módulos leen/escriben window._MS directamente.           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
'use strict';

window._MS = {
  socket:              null,
  currentUser:         null,
  isApproved:          false,
  pendingReviewUsers:  [],
  activeReviewChat:    null
};
