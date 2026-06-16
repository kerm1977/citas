/* ╔════════════════════════════════════════════════════════════════════╗
 * ║  CHAT-APPEND — appendMessage() — NO MODIFICAR                      ║
 * ║  ⚠️ Descifra texto, construye burbuja HTML, maneja reply_to_data.  ║
 * ║  ⚠️ Re-scroll en multimedia async — NO quitar los listeners.       ║
 * ║  ⚠️ Menú tipo Signal solo para no-imagen. NO agregar a imágenes.   ║
 * ╚════════════════════════════════════════════════════════════════════╝ */
'use strict';

window.ChatAppend = (function() {
  async function appendMessage(msg) {
    /* ═════════════════════════════════════════════════════════════════════════════
     *  ⚠️  CRÍTICO — INDICADOR DE RESPUESTA — NO MODIFICAR  ⚠️
     * ─────────────────────────────────────────────────────────────────────────────────
     *  Función que muestra el indicador de respuesta cuando msg.reply_to_data existe.
     *
     *  REGLAS QUE DEBEN MANTENERSE SIEMPRE:
     *  1. Si msg.reply_to_data existe, mostrar indicador con nombre del emisor y preview
     *  2. Descifrar el contenido del mensaje original si es texto
     *  3. El indicador se inserta antes del contenido del mensaje
     *  4. Los logs de depuración pueden eliminarse en producción
     * ═════════════════════════════════════════════════════════════════════════════ */
    console.log('[ChatMessages] appendMessage called with msg:', msg);
    console.log('[ChatMessages] msg.reply_to_data:', msg.reply_to_data);
    const me = window._session?.user?.id;
    const sent = msg.sender_id === me;
    let content = msg.content;
    if (msg.type === 'text') {
      try {
        content = await CryptoLayer.decrypt(msg.content, ChatUtils.roomKey(msg.room || ''), msg.room || '');
      } catch {
        content = msg.content;
      }
    }
    const time = ChatUtils.timeAgo(msg.created_at);
    const c = document.getElementById('chat-messages');
    if (!c) return;
    const row = document.createElement('div');
    row.className = 'bubble-row ' + (sent ? 'sent' : 'received');
    row.dataset.msgId      = msg.id;
    row.dataset.room       = msg.room || '';
    row.dataset.sent       = sent;
    row.dataset.senderId   = msg.sender_id   || '';
    row.dataset.senderName = msg.sender_name || '';

    /* Indicador de respuesta */
    let replyHtml = '';
    if (msg.reply_to_data) {
      console.log('[ChatMessages] Processing reply_to_data');
      const replyMsg = msg.reply_to_data;
      let replyContent = replyMsg.content;
      if (replyMsg.type === 'text') {
        try {
          replyContent = await CryptoLayer.decrypt(replyMsg.content, ChatUtils.roomKey(msg.room || ''), msg.room || '');
        } catch {
          replyContent = replyMsg.content;
        }
      } else {
        /* Para imágenes/archivos, mostrar solo el nombre del archivo */
        replyContent = replyContent.split('/').pop() || replyContent;
      }
      const replyPreview = replyContent.slice(0, 50) + (replyContent.length > 50 ? '...' : '');
      const replySender = replyMsg.sender_name || 'Alguien';
      replyHtml = `<div class="reply-to-indicator">
        <span class="reply-to-sender">${ChatUtils.escape(replySender)}</span>
        <span class="reply-to-content">${ChatUtils.escape(replyPreview)}</span>
      </div>`;
      console.log('[ChatMessages] replyHtml generated:', replyHtml);
    }

    let body = '';
    if (msg.type === 'image') {
      body = `<div class="image-container"><img src="${content}" loading="lazy" onclick="Chat.openImageModalFromRow(this)"/><button class="download-btn" onclick="Chat.downloadImageFromUrl('${content}')">📥</button></div>`;
    } else if (msg.type === 'video') {
      body = `<video src="${content}" controls></video>`;
    } else if (msg.type === 'audio') {
      body = `<audio src="${content}" controls></audio>`;
    } else if (msg.type === 'file') {
      body = `<a class="file-link" href="${content}" target="_blank">📎 Descargar archivo</a>`;
    } else {
      body = ChatUtils.escape(content);
    }
    const senderLabel = sent ? 'Tú' : ChatUtils.escape(msg.sender_name || '');
    row.innerHTML = `<div class="bubble ${sent ? 'sent' : 'received'}"><div class="msg-sender">${senderLabel}</div>${replyHtml}${body}<div class="msg-time">${time}</div></div>`;

    /* ═════════════════════════════════════════════════════════════════════════════
     *  ⚠️  CRÍTICO — MENÚ DE ELIMINACIÓN TIPO SIGNAL — NO MODIFICAR  ⚠️
     * ─────────────────────────────────────────────────────────────────────────────────
     *  Los mensajes de texto, video, audio y archivos tienen un botón de menú (⋮) discreto
     *  que abre un dropdown con opciones de eliminación. Estilo Signal: NO botones
     *  siempre visibles.
     *
     *  EXCEPCIÓN: Las imágenes NO tienen botón de menú. Al hacer click en una imagen,
     *  se abre el modal (#image-modal) que contiene las opciones de eliminación y descarga.
     *
     *  REGLAS QUE DEBEN MANTENERSE SIEMPRE:
     *  1. Agregar el botón de menú SOLO a mensajes que NO sean imágenes (msg.type !== 'image').
     *  2. El botón usa el símbolo '⋮' (tres puntos verticales), NO otros íconos.
     *  3. El dropdown se posiciona al LADO del mensaje (right: 100%, marginRight: 8px),
     *     NO abajo. Si se cambia a abajo, se rompe el estilo Signal.
     *  4. El dropdown usa _toggleMessageMenu() que maneja el cierre al click fuera.
     *  5. Pasar los parámetros 'sent', 'msgType' y 'msgContent' a _toggleMessageMenu.
     * ═════════════════════════════════════════════════════════════════════════════ */
    if (msg.type !== 'image') {
      const menuBtn = document.createElement('button');
      menuBtn.className = 'msg-menu-btn';
      menuBtn.innerHTML = '⋮';
      menuBtn.onclick = (e) => {
        e.stopPropagation();
        ChatModal.toggleMessageMenu(msg.id, msg.room, menuBtn, sent, msg.type, content);
      };
      row.querySelector('.bubble').appendChild(menuBtn);
    }

    /* ═════════════════════════════════════════════════════════════════════════════
     *  ⚠️  CRÍTICO — RE-SCROLL AL CARGAR MULTIMEDIA — NO MODIFICAR  ⚠️
     * ─────────────────────────────────────────────────────────────────────────────────
     *  Las imágenes/videos/audios cargan de forma ASÍNCRONA y su altura NO existe
     *  en el momento del primer scroll. Esto deja el último mensaje "desfasado" hacia
     *  abajo (fuera de vista, detrás de la barra de escritura).
     *
     *  REGLAS QUE DEBEN MANTENERSE SIEMPRE:
     *
     *  1. La intención "estaba al final" (wasNearBottom) se captura ANTES de
     *     insertar el row en el DOM. NO mover esta línea después de c.appendChild(row).
     *
     *  2. El umbral de "cerca del final" es 150px. NO cambiar a un valor menor
     *     (puede dejar imágenes cortadas) o mucho mayor (puede interrumpir al usuario
     *     cuando está leyendo historial).
     *
     *  3. El listener de rescroll usa wasNearBottom (capturado), NO recalcula
     *     nearBottom dentro del listener. Si recalculas dentro del listener, la
     *     imagen ya cargó → altura creció → el cálculo dirá "el usuario subió" →
     *     NO scrolleará → la imagen quedará desfasada/desenfocada (BUG CONFIRMADO).
     *
     *  4. Imágenes usan 'load' y 'error'. Videos/audios usan 'loadedmetadata' y
     *     'loadeddata'. NO cambiar estos eventos o no se detectará la carga.
     *
     *  ❌ NO eliminar este bloque: sin él, las imágenes siempre quedan desfasadas.
     * ═════════════════════════════════════════════════════════════════════════════ */
    const wasNearBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 150;

    c.appendChild(row);

    const media = row.querySelector('img, video, audio');
    if (media) {
      const rescroll = () => {
        if (wasNearBottom) c.scrollTop = c.scrollHeight;
      };
      if (msg.type === 'image') {
        media.addEventListener('load', rescroll);
        media.addEventListener('error', rescroll);
      } else {
        media.addEventListener('loadedmetadata', rescroll);
        media.addEventListener('loadeddata', rescroll);
      }
    }
  }
return { appendMessage };
})();
