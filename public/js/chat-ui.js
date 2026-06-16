/* ═════════════════════════════════════════════════════════════════════════════
 *  ⚠️⚠️⚠️ MÓDULO DE UI — CÓDIGO VALIDADO Y FUNCIONANDO — NO MODIFICAR ⚠️⚠️⚠️
 * ─────────────────────────────────────────────────────────────────────────────────
 *  Este módulo maneja la interfaz de usuario del chat.
 *
 *  REGLAS DE PRESERVACIÓN:
 *  1. La función openChat está validada con scroll automático
 *  2. El fallback para superusuarios está funcionando correctamente
 *  3. Los eventos onTyping, onDelete, onRead, onOnline están validados
 *  4. Solo se permiten integraciones, NO cambios a la lógica existente
 * ═════════════════════════════════════════════════════════════════════════════ */
'use strict';

const ChatUI = (() => {
  let _pendingSuperuser = null;

  async function openChat(userId) {
    let u = ChatUsers.getUserById(userId);

    /* ══════════════════════════════════════════════════════════════════════
     *  ⚠️  CRÍTICO — NO ELIMINAR ESTE FALLBACK  ⚠️
     * ────────────────────────────────────────────────────────────────────────
     *  Los SUPERUSUARIOS están OCULTOS de la lista de usuarios (_users), por lo
     *  que al abrir el chat con uno (p.ej. desde el modal de contacto) NO estará
     *  en _users. Este fallback consulta /api/chat/user/:id para traer sus datos
     *  y poder abrir el chat. Sin esto, "Abrir chat" con un superusuario falla.
     * ══════════════════════════════════════════════════════════════════════ */
    if (!u) {
      try {
        const res = await fetch(`/api/chat/user/${userId}`, { headers: ChatUtils.authHeaders() });
        const data = await res.json();
        if (data.ok && data.user) {
          u = data.user;
          if (!ChatUsers.getUserById(userId)) {
            ChatUsers.addUser(u);
          }
        }
      } catch (e) {
        console.error('[Chat] Error fetching user:', e);
        return;
      }
    }

    if (!u) return;

    if (u.unread_count > 0) {
      ChatUsers.updateUser(userId, { unread_count: 0 });
      ChatUsers.updateUserItem(userId);
      ChatUtils.updatePageTitle(ChatUsers.getTotalUnread());
    }

    ChatMessages.setActive(u);
    const me = window._session?.user?.id;
    const room = [me, userId].sort().join('_');

    document.getElementById('chat-empty')?.classList.add('hidden');
    document.getElementById('chat-window')?.classList.remove('hidden');

    const init = (u.name || '?').charAt(0).toUpperCase();
    document.getElementById('ch-avatar').innerHTML = u.avatar ? `<img src="${u.avatar}" alt="${init}"/>` : init;
    document.getElementById('ch-name').textContent = u.name;
    const statusEl = document.getElementById('ch-status');
    statusEl.textContent = u.online ? 'En línea' : (u.last_seen ? 'Visto: ' + ChatUtils.timeAgo(u.last_seen) : 'Desconectado');
    statusEl.className = 'ch-status ' + (u.online ? 'online' : 'offline');

    document.querySelectorAll('.user-list-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`[data-uid="${userId}"]`)?.classList.add('active');

    if (window.innerWidth <= 700) {
      document.getElementById('chat-sidebar')?.classList.add('mobile-hidden');
    }

    ChatSocket.emit('chat:join', { room });

    const msgs = await fetch(`/api/chat/messages/${room}?limit=50`, { headers: ChatUtils.authHeaders() });
    const data = await msgs.json();
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';
    if (data.ok) {
      /* ══════════════════════════════════════════════════════════════════
       *  ⚠️  LÓGICA CRÍTICA DE SCROLL AL ABRIR EL CHAT — NO MODIFICAR  ⚠️
       * ────────────────────────────────────────────────────────────────────
       *  Asegura que SIEMPRE se enfoque el ÚLTIMO mensaje (estilo WhatsApp).
       *  Costó varias iteraciones afinar este comportamiento. Mantener:
       *  1. openChat carga el historial COMPLETO (NO volver a hacer append
       *     manual del mensaje en _onMessage, o se DUPLICA).
       *  2. Se usan múltiples intentos de scroll (inmediato + setTimeout +
       *     chequeo periódico) porque el layout/imágenes terminan de
       *     renderizar de forma asíncrona.
       *  3. NO reactivar 'scroll-behavior: smooth' global: rompe el scroll
       *     programático (queda a medio camino).
       * ══════════════════════════════════════════════════════════════════ */
      data.messages.forEach(m => ChatMessages.appendMessage(m));
      container.scrollTop = container.scrollHeight;
      container.scrollTo({ top: container.scrollHeight, behavior: 'instant' });

      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
        container.scrollTo({ top: container.scrollHeight, behavior: 'instant' });
      }, 50);

      let scrollCheckCount = 0;
      const scrollCheckInterval = setInterval(() => {
        scrollCheckCount++;
        if (scrollCheckCount > 20) {
          clearInterval(scrollCheckInterval);
          return;
        }
        const currentScroll = container.scrollTop;
        const maxScroll = container.scrollHeight - container.clientHeight;
        if (Math.abs(currentScroll - maxScroll) > 10) {
          container.scrollTop = container.scrollHeight;
        }
      }, 100);
    }

    if (container._scrollObserver) {
      container._scrollObserver.disconnect();
      container._scrollObserver = null;
    }

    /* ═════════════════════════════════════════════════════════════════════════════
     *  ⚠️  CRÍTICO — ENVÍO DE RESPUESTA — NO MODIFICAR  ⚠️
     * ─────────────────────────────────────────────────────────────────────────────────
     *  El formulario envía el replyToId (solo msgId) al enviar mensaje.
     *
     *  REGLAS QUE DEBEN MANTENERSE SIEMPRE:
     *  1. Obtener replyTo de ChatReply.getReplyTo()
     *  2. Extraer solo replyTo.msgId (no el objeto completo)
     *  3. Pasar replyToId a sendText
     *  4. Limpiar replyTo después de enviar
     * ═════════════════════════════════════════════════════════════════════════════ */
    const form = document.getElementById('chat-form');
    form.onsubmit = (e) => {
      e.preventDefault();
      const replyTo = ChatReply.getReplyTo();
      const replyToId = replyTo ? replyTo.msgId : null;
      ChatMessages.sendText(room, userId, replyToId);
      ChatReply.clearReplyTo();
    };

    const inp = document.getElementById('msg-input');
    const _typing = AntiFreeze.debounce(() => ChatSocket.emit('chat:typing', { room, typing: false }), 2000);
    inp.oninput = () => {
      ChatSocket.emit('chat:typing', { room, typing: true });
      _typing();
    };

    document.getElementById('file-input').onchange = (e) => ChatMessages.sendFile(e, room, userId);
  }

  function onTyping({ userId, name, typing }) {
    const me = window._session?.user?.id;
    if (userId === me) return;
    const el = document.getElementById('typing-indicator');
    if (typing) el?.classList.remove('hidden');
    else el?.classList.add('hidden');
  }

  function onDelete({ msgId }) {
    const row = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (row) row.remove();
  }

  function onRead({ userId }) {
  }

  function onOnline(data) {
    if (!data) return;
    const { userId, online, last_seen } = data;
    const u = ChatUsers.getUserById(userId);
    if (u) {
      ChatUsers.updateUser(userId, { online, last_seen });
    }
    const item = document.querySelector(`[data-uid="${userId}"]`);
    if (item && u) {
      item.outerHTML = ChatUsers.renderUserList([u]);
    }
    const active = ChatMessages.getActive();
    if (active?.id === userId) {
      const st = document.getElementById('ch-status');
      if (st) {
        st.textContent = online ? 'En línea' : (last_seen ? 'Visto: ' + ChatUtils.timeAgo(last_seen) : 'Desconectado');
        st.className = 'ch-status ' + (online ? 'online' : 'offline');
      }
    }
    if (online) {
      SoundEffects?.playConnect();
    } else {
      SoundEffects?.playDisconnect();
    }
  }

  async function checkSuperuserContacts() {
    try {
      const res = await fetch('/api/chat/superuser-contacts', { headers: ChatUtils.authHeaders() });
      const data = await res.json();
      if (!data.ok || !data.contacts || data.contacts.length === 0) return;

      const contact = data.contacts[0];
      console.log('[Chat] Pending superuser contact:', contact);
      _pendingSuperuser = {
        id: contact.superuser_id,
        name: contact.superuser_name,
        avatar: contact.superuser_avatar,
        contactId: contact.id
      };
      document.getElementById('superuser-name').textContent = contact.superuser_name || 'Superusuario';
      document.getElementById('superuser-modal').classList.remove('hidden');
    } catch (e) {
      console.error('[Chat] Error checking superuser contacts:', e);
    }
  }

  function closeSuperuserModal() {
    document.getElementById('superuser-modal').classList.add('hidden');
    if (_pendingSuperuser?.contactId) {
      fetch(`/api/chat/superuser-contacts/${_pendingSuperuser.contactId}/acknowledge`, {
        method: 'POST',
        headers: ChatUtils.authHeaders()
      }).catch(e => console.error('[Chat] Error acknowledging contact:', e));
    }
    _pendingSuperuser = null;
  }

  function openSuperuserChat() {
    if (!_pendingSuperuser) return;
    openChat(_pendingSuperuser.id);
    closeSuperuserModal();
  }

  function updateCurrentUserName() {
    const me = window._session?.user;
    if (me) {
      const el = document.getElementById('current-user-name');
      if (el) el.textContent = me.name;
    }
  }

  return {
    openChat,
    onTyping,
    onDelete,
    onRead,
    onOnline,
    checkSuperuserContacts,
    closeSuperuserModal,
    openSuperuserChat,
    updateCurrentUserName
  };
})();
