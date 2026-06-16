/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️⚠️⚠️  CHAT-UTILS — BLINDADO — NO MODIFICAR  ⚠️⚠️⚠️                       ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  ── authHeaders() — NO ALTERAR ─────────────────────────────────────── ║
 * ║  Devuelve { Authorization: 'Bearer <token>' }. Usado en TODOS los fetch.  ║
 * ║  Token viene de window._session.token. Sin esto, todos los fetch fallan.  ║
 * ║                                                                           ║
 * ║  ── encKey / roomKey — NO ALTERAR ────────────────────────────────── ║
 * ║  Derivan la clave de encriptación desde el room ID. Cambiar la función   ║
 * ║  hace ilegibles todos los mensajes existentes (BUG PERMANENTE).           ║
 * ║                                                                           ║
 * ║  ── escape(str) — SIEMPRE USAR PARA OUTPUT HTML ──────────────────── ║
 * ║  Escapa entidades HTML para prevenir XSS. NO omitir al insertar texto     ║
 * ║  de usuario en innerHTML.                                                 ║
 * ║                                                                           ║
 * ║  ── updatePageTitle(count) — NO ALTERAR ───────────────────────────── ║
 * ║  Muestra (N) en el título de la página cuando hay mensajes no leídos.    ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
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
