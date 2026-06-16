/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️⚠️⚠️  CHAT-REPLY — BLINDADO — NO MODIFICAR  ⚠️⚠️⚠️                      ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  ── setReplyTo(msg) — NO ALTERAR ───────────────────────────────────── ║
 * ║  Guarda el mensaje a responder en _replyTo.                               ║
 * ║  Muestra #reply-preview con nombre del remitente y preview del contenido. ║
 * ║  clearReplyTo() limpia _replyTo y oculta #reply-preview.                 ║
 * ║                                                                           ║
 * ║  ── IDs HTML FIJOS — JAMÁS RENOMBRAR ───────────────────────────────── ║
 * ║  #reply-preview → contenedor visible del indicador de respuesta           ║
 * ║  #reply-sender  → nombre del remitente del mensaje original              ║
 * ║  #reply-content → preview del contenido del mensaje original             ║
 * ║  #btn-cancel-reply → botón para cancelar la respuesta                    ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
'use strict';

const ChatReply = (() => {
  let _replyTo = null;

  function setReplyTo(msgId, room) {
    console.log('[ChatReply] setReplyTo called with:', msgId, room);
    _replyTo = { msgId, room };
    const row = document.querySelector(`[data-msg-id="${msgId}"]`);
    console.log('[ChatReply] Found row:', row);
    if (row) {
      const bubble = row.querySelector('.bubble');
      const content = bubble.textContent || bubble.innerText;
      const preview = content.slice(0, 50) + (content.length > 50 ? '...' : '');
      const indicator = document.getElementById('reply-indicator');
      console.log('[ChatReply] Found indicator:', indicator);
      if (indicator) {
        indicator.classList.remove('hidden');
        indicator.querySelector('.reply-text').textContent = `Respondiendo a: ${preview}`;
        console.log('[ChatReply] Indicator updated');
        console.log('[ChatReply] Indicator classes after update:', indicator.className);
        console.log('[ChatReply] Indicator display style:', window.getComputedStyle(indicator).display);
      }
    }
  }

  function clearReplyTo() {
    _replyTo = null;
    const indicator = document.getElementById('reply-indicator');
    if (indicator) {
      indicator.classList.add('hidden');
    }
  }

  function getReplyTo() {
    return _replyTo;
  }

  return {
    setReplyTo,
    clearReplyTo,
    getReplyTo
  };
})();

console.log('[ChatReply] Module loaded');
