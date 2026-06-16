/* ═════════════════════════════════════════════════════════════════════════════
 *  ⚠️⚠️⚠️ MÓDULO DE UTILIDADES — CÓDIGO VALIDADO Y FUNCIONANDO — NO MODIFICAR ⚠️⚠️⚠️
 * ─────────────────────────────────────────────────────────────────────────────────
 *  Este módulo contiene funciones utilitarias para el chat.
 *
 *  REGLAS DE PRESERVACIÓN:
 *  1. Las funciones de encriptación (encKey, roomKey) están validadas
 *  2. Las funciones de escape y timeAgo están funcionando correctamente
 *  3. La función updatePageTitle actualiza el título con el contador de unread
 *  4. Solo se permiten integraciones, NO cambios a la lógica existente
 * ═════════════════════════════════════════════════════════════════════════════ */
'use strict';

const ChatUtils = (() => {
  function authHeaders() {
    return { Authorization: 'Bearer ' + (window._session?.token || '') };
  }

  function escape(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function messagePreview(m) {
    return m.type === 'text' ? m.content.slice(0, 40) : '[' + m.type + ']';
  }

  function timeAgo(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'ahora';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' min';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' h';
    if (seconds < 604800) return Math.floor(seconds / 86400) + ' días';
    return date.toLocaleDateString();
  }

  function encKey() {
    return window._session?.token?.slice(-16) || 'default_chat_key_';
  }

  function roomKey(room) {
    const parts = room.split('_');
    if (parts.length === 2) {
      const sorted = parts.sort();
      return sorted[0] + '_' + sorted[1] + '_shared_secret_v2';
    }
    return room + '_shared_secret_v2';
  }

  function updatePageTitle(totalUnread) {
    const baseTitle = 'Chat App';
    document.title = totalUnread > 0 ? `(${totalUnread}) ${baseTitle}` : baseTitle;
  }

  return {
    authHeaders,
    escape,
    messagePreview,
    timeAgo,
    encKey,
    roomKey,
    updatePageTitle
  };
})();
