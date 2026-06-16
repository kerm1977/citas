/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️⚠️⚠️  CHAT-UI — BLINDADO — NO MODIFICAR  ⚠️⚠️⚠️                        ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  ── openChat(userId) — NO ALTERAR ──────────────────────────────────── ║
 * ║  Fallback crítico: si el usuario es SUPERADMIN oculto, lo busca por API   ║
 * ║  /api/chat/user/:id. Sin esto, abrir chat con superadmin falla.           ║
 * ║  Hace scroll automático al final tras cargar mensajes.                    ║
 * ║                                                                           ║
 * ║  ── checkSuperuserContacts() — NO ALTERAR ──────────────────────────── ║
 * ║  Se llama en cada _onConnect. Muestra modal #superuser-modal si hay        ║
 * ║  contactos pendientes de un superadmin hacia la usuaria.                  ║
 * ║  Solo aplica a usuarias PENDIENTES (is_approved=0). Aprobadas no ven esto. ║
 * ║                                                                           ║
 * ║  ── onOnline(data) — BLINDADO — JAMÁS MODIFICAR ──────────────────────── ║
 * ║  ⚠️⚠️⚠️ LÓGICA CRÍTICA VALIDADA — BUG CONFIRMADO Y CORREGIDO ⚠️⚠️⚠️       ║
 * ║  Si el userId NO está en _users y viene online → Chat.loadUsers().       ║
 * ║  SIN esto: usuarios que se conectan DESPUÉS del loadUsers inicial         ║
 * ║  NUNCA aparecen en la lista de los usuarios ya conectados.               ║
 * ║  Escenario roto sin esta lógica:                                          ║
 * ║    · Carmelo conecta → loadUsers → ve solo a Jen                         ║
 * ║    · Maureen conecta → emite user:online → Carmelo recibe, getUserById    ║
 * ║      devuelve null → SIN loadUsers() → Carmelo nunca ve a Maureen        ║
 * ║  NO eliminar el else-if. NO quitar el return. NO mover el loadUsers().   ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
'use strict';

const ChatUI = (() => {
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
      /* ⚠️ SCROLL CRÍTICO — NO MODIFICAR: múltiples intentos porque imágenes cargan async.
       * NO quitar setTimeout ni setInterval. NO activar scroll-behavior:smooth. */
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

  function onRead({ userId }) {}

  function onOnline(data) {
    if (!data) return;
    const { userId, online, last_seen } = data;
    const u = ChatUsers.getUserById(userId);
    if (u) {
      ChatUsers.updateUser(userId, { online, last_seen });
    } else if (online) {
      /* ═══════════════════════════════════════════════════════════════════════
       * ⚠️⚠️⚠️  BLINDADO — JAMÁS ELIMINAR ESTE BLOQUE  ⚠️⚠️⚠️
       * ───────────────────────────────────────────────────────────────────────
       * BUG CONFIRMADO (Jun 2026): sin este else-if, los usuarios que se
       * conectan DESPUÉS del loadUsers() inicial son INVISIBLES para los
       * clientes ya conectados. Cada cliente solo ve a quien estaba en la BD
       * en el momento exacto en que él mismo cargó la lista.
       *
       * REGLA: si llega user:online de alguien NO en _users → loadUsers().
       * NO cambiar. NO eliminar. NO mover. Blindaje permanente.
       * ═══════════════════════════════════════════════════════════════════════ */
      if (typeof Chat !== 'undefined') Chat.loadUsers();
      return;
    }
    const item = document.querySelector(`[data-uid="${userId}"]`);
    if (item && u) {
      item.outerHTML = ChatUsers.renderUserList([u]);
    }
    const active = ChatMessages.getActive();
    if (active?.id === userId) {
      const st = document.getElementById('ch-status');
      if (st) {
        st.textContent = online ? 'En línea' : `Desconectado${last_seen ? ' · ' + ChatUtils.timeAgo(last_seen) : ''}`;
        st.className = 'ch-status ' + (online ? 'online' : 'offline');
      }
    }
    if (online) SoundEffects?.playConnect();
    else SoundEffects?.playDisconnect();
  }

  function updateCurrentUserName() {
    const me = window._session?.user;
    if (me) {
      const el = document.getElementById('current-user-name');
      if (el) el.textContent = me.name;
    }
  }

  return { openChat, onTyping, onDelete, onRead, onOnline, updateCurrentUserName };
})();
window.ChatUI = ChatUI;
