/* ═════════════════════════════════════════════════════════════════════════════
 *  ⚠️⚠️⚠️ MÓDULO DE RESPUESTA — CÓDIGO VALIDADO Y FUNCIONANDO — NO MODIFICAR ⚠️⚠️⚠️
 * ─────────────────────────────────────────────────────────────────────────────────
 *  Este módulo maneja la funcionalidad de responder mensajes.
 *
 *  REGLAS DE PRESERVACIÓN:
 *  1. Las funciones setReplyTo, clearReplyTo, getReplyTo están validadas
 *  2. El indicador visual de respuesta funciona correctamente
 *  3. Solo se permiten integraciones, NO cambios a la lógica existente
 *  4. Los logs de depuración pueden eliminarse en producción
 * ═════════════════════════════════════════════════════════════════════════════ */
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
