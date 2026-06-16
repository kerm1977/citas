/* ═════════════════════════════════════════════════════════════════════════════
 *  ⚠️⚠️⚠️ MÓDULO DE MODAL — CÓDIGO VALIDADO Y FUNCIONANDO — NO MODIFICAR ⚠️⚠️⚠️
 * ─────────────────────────────────────────────────────────────────────────────────
 *  Este módulo maneja el modal de imagen y el menú de eliminación tipo Signal.
 *
 *  REGLAS DE PRESERVACIÓN:
 *  1. El modal de imagen está validado con z-index 99999
 *  2. El menú de eliminación tipo Signal está funcionando correctamente
 *  3. El posicionamiento del dropdown está validado (left/right)
 *  4. Solo se permiten integraciones, NO cambios a la lógica existente
 * ═════════════════════════════════════════════════════════════════════════════ */
'use strict';

const ChatModal = (() => {
  function openImageModal(imageUrl, msgId, room, sent) {
    const modal = document.getElementById('image-modal');
    const img = document.getElementById('modal-image');
    img.src = imageUrl;

    modal.dataset.msgId = msgId || '';
    modal.dataset.room = room || '';
    modal.dataset.sent = sent === true ? 'true' : 'false';

    const deleteMeBtn = document.getElementById('modal-delete-me');
    const deleteAllBtn = document.getElementById('modal-delete-all');

    if (sent === true) {
      deleteMeBtn.style.display = 'inline-block';
      deleteAllBtn.style.display = 'inline-block';
    } else {
      deleteMeBtn.style.display = 'inline-block';
      deleteAllBtn.style.display = 'none';
    }

    modal.classList.remove('hidden');
  }

  function openImageModalFromRow(imgElement) {
    const row = imgElement.closest('.bubble-row');
    const imageUrl = imgElement.src;
    const msgId = row.dataset.msgId;
    const room = row.dataset.room;
    const sent = row.dataset.sent === 'true';
    openImageModal(imageUrl, msgId, room, sent);
  }

  function closeImageModal() {
    const modal = document.getElementById('image-modal');
    modal.classList.add('hidden');
    const img = document.getElementById('modal-image');
    img.src = '';
  }

  function modalDeleteForMe() {
    const modal = document.getElementById('image-modal');
    const msgId = modal.dataset.msgId;
    if (msgId) {
      ChatMessages.deleteForMe(msgId);
    }
    closeImageModal();
  }

  function modalDeleteForAll() {
    const modal = document.getElementById('image-modal');
    const msgId = modal.dataset.msgId;
    const room = modal.dataset.room;
    if (msgId && room) {
      ChatMessages.deleteMessage(msgId, room);
    }
    closeImageModal();
  }

  function downloadImage() {
    const img = document.getElementById('modal-image');
    if (!img.src) return;

    const link = document.createElement('a');
    link.href = img.src;
    link.download = 'imagen_' + Date.now() + '.png';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function downloadImageFromUrl(imageUrl) {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = 'imagen_' + Date.now() + '.png';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function toggleMessageMenu(msgId, room, btn, sent, msgType, msgContent) {
    /* ═════════════════════════════════════════════════════════════════════════════
     *  ⚠️  CRÍTICO — DISEÑO DEL MENÚ DE ELIMINACIÓN — NO MODIFICAR  ⚠️
     * ─────────────────────────────────────────────────────────────────────────────────
     *  Función que crea y posiciona el dropdown de opciones de eliminación.
     *
     *  DISEÑO DE LAS OPCIONES (NO ALTERAR):
     *  - Para el EMISOR del mensaje (sent=true): muestra "Eliminar para mí" y "Eliminar para todos"
     *  - Para el RECEPTOR del mensaje (sent=false): muestra solo "Eliminar"
     *  - Si el mensaje es una imagen (msgType === 'image'), también muestra "Descargar imagen"
     *  Este diseño es INTENCIONAL y no debe cambiarse.
     *
     *  ⚠️⚠️⚠️ POSICIONAMIENTO DEL DROPDOWN — JAMÁS MODIFICAR ⚠️⚠️⚠️
     *  ESTA LÓGICA DE POSICIONAMIENTO ES CRÍTICA Y DEBE MANTENERSE ETERNAMENTE:
     *  1. Cerrar cualquier dropdown existente antes de abrir uno nuevo (evita múltiples).
     *  2. POSICIONAMIENTO INTELIGENTE (NO ALTERAR NUNCA):
     *     - Mensajes RECIBIDOS (sent=false, izquierda): dropdown hacia la DERECHA (clase dropdown-right)
     *     - Mensajes ENVIADOS (sent=true, derecha): dropdown hacia la IZQUIERDA (clase dropdown-left)
     *     Esto hace que el dropdown SIEMPRE se despliegue hacia ADENTRO del chat, nunca hacia afuera.
     *  3. NO cambiar a bottom o se rompe el estilo Signal.
     *  4. Agregar listener para cerrar al click fuera del dropdown.
     *  5. Solo se permite agregar nuevas funciones/opciones, JAMÁS cambiar la posición.
     * ═════════════════════════════════════════════════════════════════════════════ */
    const existing = document.querySelector('.msg-dropdown.active');
    if (existing) existing.remove();

    const dropdown = document.createElement('div');
    dropdown.className = 'msg-dropdown active';

    let optionsHtml = '';

    /* Opción de Responder (aplica para todos) */
    optionsHtml += `<button class="dropdown-item" onclick="Chat.replyToMessageFromMenu('${msgId}', '${room}')">↩️ Responder</button>`;
    optionsHtml += `<hr style="width: 100%; border: none; border-top: 1px solid rgba(255,255,255,0.2); margin: 0.3rem 0;">`;

    if (sent) {
      optionsHtml += `
        <button class="dropdown-item" onclick="Chat._deleteForMe('${msgId}')">🗑️ Eliminar para mí</button>
        <button class="dropdown-item delete-for-all" onclick="Chat._deleteMsg('${msgId}', '${room}')">🗑️ Eliminar para todos</button>
      `;
    } else {
      optionsHtml += `
        <button class="dropdown-item" onclick="Chat._deleteForMe('${msgId}')">🗑️ Eliminar</button>
      `;
    }

    if (msgType === 'image' && msgContent) {
      optionsHtml += `<button class="dropdown-item" onclick="Chat.downloadImageFromUrl('${msgContent}')">📥 Descargar imagen</button>`;
    }

    /* Guardar msgId y room en el dropdown para usar en la función de respuesta */
    dropdown.dataset.msgId = msgId;
    dropdown.dataset.room = room;

    dropdown.innerHTML = optionsHtml;

    if (sent) {
      dropdown.classList.add('dropdown-left');
    } else {
      dropdown.classList.add('dropdown-right');
    }

    btn.closest('.bubble').appendChild(dropdown);

    const closeHandler = (e) => {
      if (!dropdown.contains(e.target) && e.target !== btn) {
        dropdown.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
  }

  function replyToMessage() {
    console.log('[ChatModal] replyToMessage called');
    const modal = document.getElementById('image-modal');
    const msgId = modal.dataset.msgId;
    const room = modal.dataset.room;
    console.log('[ChatModal] msgId:', msgId, 'room:', room);
    if (msgId && room) {
      console.log('[ChatModal] Calling ChatReply.setReplyTo');
      ChatReply.setReplyTo(msgId, room);
    }
    closeImageModal();
  }

  function replyToMessageFromMenu(msgId, room) {
    console.log('[ChatModal] replyToMessageFromMenu called with:', msgId, room);
    if (msgId && room) {
      console.log('[ChatModal] Calling ChatReply.setReplyTo');
      ChatReply.setReplyTo(msgId, room);
    }
  }

  return {
    openImageModal,
    openImageModalFromRow,
    closeImageModal,
    modalDeleteForMe,
    modalDeleteForAll,
    downloadImage,
    downloadImageFromUrl,
    toggleMessageMenu,
    replyToMessage,
    replyToMessageFromMenu
  };
})();
