/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️⚠️⚠️  CHAT-MESSAGES — BLINDADO — NO MODIFICAR  ⚠️⚠️⚠️                 ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  ── sendText(room, receiverId, replyTo) — NO ALTERAR ────────────────── ║
 * ║  Limpia el input ANTES de emitir. Encripta con CryptoLayer.encrypt().     ║
 * ║  NO hacer scroll aquí — el scroll lo hace appendMessage al recibir.      ║
 * ║                                                                           ║
 * ║  ── sendFile(e, room, receiverId) — NO ALTERAR ─────────────────────── ║
 * ║  Sube a /api/chat/upload, usa el type y url de la respuesta.              ║
 * ║  NO encripta archivos (solo texto va encriptado).                         ║
 * ║                                                                           ║
 * ║  ── appendMessage(msg) — NO ALTERAR LÓGICA DE SCROLL ──────────────── ║
 * ║  wasNearBottom se captura ANTES de insertar el row. Sin esto las imágenes  ║
 * ║  quedan desfasadas (BUG CONFIRMADO). El umbral es 150px.                  ║
 * ║  .msg-sender muestra 'Tú' para enviados, nombre real para recibidos.      ║
 * ║                                                                           ║
 * ║  ── MENÚ TIPO SIGNAL — NO ALTERAR ESTRUCTURA ──────────────────────── ║
 * ║  Botón '⋮' solo en mensajes que NO son imagen (msg.type !== 'image').      ║
 * ║  Dropdown se posiciona al LADO (right: 100%). NO cambiar a abajo.        ║
 * ║  Imágenes abren modal con opciones de eliminar/descargar.                 ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
'use strict';

const ChatMessages = (() => {
  let _active = null;

  function setActive(user) {
    _active = user;
  }

  function getActive() {
    return _active;
  }

  /* ═════════════════════════════════════════════════════════════════════════════
  /* ⚠️ sendText: limpiar input ANTES de emitir. Encriptar contenido. NO hacer scroll aquí. */
  async function sendText(room, receiverId, replyTo = null) {
    const inp = document.getElementById('msg-input');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    const enc = await CryptoLayer.encrypt(text, ChatUtils.roomKey(room), room);
    ChatSocket.emit('chat:message', { room, receiverId, type: 'text', content: enc, iv: null, reply_to: replyTo });
    SoundEffects?.playSend();
  }

  /* ═════════════════════════════════════════════════════════════════════════════
  /* ⚠️ sendGroupText: enviar mensaje de grupo sin encriptar (por ahora) */
  async function sendGroupText(groupId, replyTo = null) {
    const inp = document.getElementById('msg-input');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    
    const active = getActive();
    // Prevenir que superusuarios en modo invisible envíen mensajes
    if (active && active.isSuperuser && !active.isMember) {
      Toast.show('No puedes enviar mensajes en modo invisible', 'error');
      return;
    }
    
    console.log('[ChatMessages] Enviando mensaje de grupo:', { groupId, text, replyTo });
    ChatSocket.emit('chat:message', { groupId, type: 'text', content: text, iv: null, reply_to: replyTo });
    SoundEffects?.playSend();
  }

  /* ═════════════════════════════════════════════════════════════════════════════
  /* ⚠️ sendFile: subir a /api/chat/upload, usar type y url del response. NO hacer scroll. */
  async function sendFile(e, room, receiverId) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/chat/upload', { method: 'POST', headers: ChatUtils.authHeaders(), body: fd });
    const data = await res.json();
    if (!data.ok) {
      Toast.show('Error al subir archivo', 'error');
      return;
    }
    ChatSocket.emit('chat:message', { room, receiverId, type: data.type, content: data.url });
    e.target.value = '';
  }

  async function appendMessage(msg) {
    return window.ChatAppend.appendMessage(msg);
  }

  async function deleteMessage(msgId, room) {
    await fetch(`/api/chat/message/${msgId}`, { method: 'DELETE', headers: ChatUtils.authHeaders() });
    ChatSocket.emit('chat:delete', { msgId, room });
  }

  function deleteForMe(msgId) {
    const row = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (row) row.remove();
  }

  return {
    setActive,
    getActive,
    sendText,
    sendGroupText,
    sendFile,
    appendMessage,
    deleteMessage,
    deleteForMe
  };
})();
