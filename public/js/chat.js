/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️⚠️⚠️  MÓDULO PRINCIPAL DE CHAT — BLINDADO — NO MODIFICAR  ⚠️⚠️⚠️      ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  Coordina: chat-socket.js, chat-users.js, chat-messages.js,              ║
 * ║            chat-modal.js, chat-ui.js, chat-reply.js, moderation.js       ║
 * ║                                                                           ║
 * ║  ── _onMessage() — JAMÁS MODIFICAR ────────────────────────────────────── ║
 * ║  Maneja recepción de mensajes, unread badges y auto-apertura de chat.     ║
 * ║  Cambiar esta función rompe las notificaciones y el conteo de no leídos.  ║
 * ║                                                                           ║
 * ║  ── connect() → _onConnect callback — JAMÁS MODIFICAR ─────────────────── ║
 * ║  Verifica is_approved desde window._session ANTES de inicializar chat.    ║
 * ║  Flujo de aprobación:                                                     ║
 * ║    · sessionUser.is_approved === 1  → chat normal + oculta overlays       ║
 * ║    · sessionUser.is_approved !== 1  → ModerationSystem.init(socket)       ║
 * ║    · ModerationSystem no cargado    → _showFallbackApprovalBlock()        ║
 * ║  Eliminar este flujo rompe el sistema de moderación completamente.        ║
 * ║                                                                           ║
 * ║  ── #approval-waiting-overlay — OCULTAR SIEMPRE si aprobado ───────────── ║
 * ║  Tras verificar aprobación, se oculta explícitamente el overlay.          ║
 * ║  NO remover estas líneas aunque parezcan redundantes. Son la garantía.    ║
 * ║                                                                           ║
 * ║  ── _showFallbackApprovalBlock() — NO TOCAR ───────────────────────────── ║
 * ║  Crea un overlay de emergencia si ModerationSystem no cargó.              ║
 * ║  Solo se muestra si window.ModerationSystem es undefined.                 ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
'use strict';

const Chat = (() => {
  /* ── Load user list ───────────────────────────────────────── */
  async function loadUsers() {
    const res = await fetch('/api/chat/users', { headers: ChatUtils.authHeaders() });
    const data = await res.json();
    if (!data.ok) return;
    ChatUsers.setUsers(data.users);
    ChatUsers.renderUserList(data.users);
  }

  /* ── Search users ─────────────────────────────────────────── */
  function initSearch() {
    const searchInput = document.getElementById('user-search');
    if (!searchInput) return;
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const users = ChatUsers.getUsers();
      const filtered = users.filter(u => {
        if (u.id === window._session?.user?.id) return false;
        if (u.role === 'superadmin' && window._session?.user?.role !== 'admin' && window._session?.user?.role !== 'superadmin') return false;
        return u.name.toLowerCase().includes(query);
      });
      ChatUsers.renderUserList(filtered);
    });
  }

  /* ── Socket connection ────────────────────────────────────── */
  function connect() {
    ChatSocket.onMessage(_onMessage);
    ChatSocket.onTyping(ChatUI.onTyping);
    ChatSocket.onDelete(ChatUI.onDelete);
    ChatSocket.onRead(ChatUI.onRead);
    ChatSocket.onOnline(ChatUI.onOnline);
    ChatSocket.onConnect(() => {
      ChatUI.updateCurrentUserName();
      ChatUI.checkSuperuserContacts();
      
      /* ═════════════════════════════════════════════════════════════════════════════
       *  ⚠️  CRÍTICO — INICIALIZACIÓN DE SISTEMA DE MODERACIÓN — NO MODIFICAR  ⚠️
       * ─────────────────────────────────────────────────────────────────────────────────
       *  Inicializa el sistema de moderación después de conectar el socket.
       *  Esto permite:
       *  1. Verificar el estado de aprobación del usuario
       *  2. Configurar listeners de socket para eventos de moderación
       *  3. Mostrar modales apropiados según el estado
       * ═════════════════════════════════════════════════════════════════════════════ */
      /* ── Moderación: verificar aprobación al conectar ─────────────────────────
       * Primero verificar directamente desde la sesión (no depende de ModerationSystem)
       * luego inicializar ModerationSystem si está disponible.                        */
      const sessionUser = window._session?.user;
      const userIsApproved = sessionUser?.role === 'superadmin' || 
                             sessionUser?.is_approved === 1 || 
                             sessionUser?.is_approved === true;
      
      console.log('[Chat] User approval status - role:', sessionUser?.role, 'is_approved:', sessionUser?.is_approved, 'calculated:', userIsApproved);
      
      if (sessionUser && !userIsApproved && sessionUser.role !== 'superadmin') {
        // Bloqueo de respaldo: mostrar modal si ModerationSystem no cargó
        console.log('[Chat] User NOT approved - applying moderation block');
        if (window.ModerationSystem) {
          const socket = ChatSocket.getSocket ? ChatSocket.getSocket() : null;
          if (socket) {
            ModerationSystem.init(socket);
          }
        } else {
          // ModerationSystem no cargó - mostrar overlay de respaldo directamente
          console.warn('[Chat] ModerationSystem not loaded - using fallback block');
          _showFallbackApprovalBlock();
        }
      } else {
        // Usuario aprobado - garantizar que nunca vea el modal de espera
        if (window.ModerationSystem) {
          const socket = ChatSocket.getSocket ? ChatSocket.getSocket() : null;
          if (socket) {
            ModerationSystem.init(socket);
          }
        }
        // Eliminar cualquier overlay de bloqueo residual
        document.getElementById('approval-waiting-overlay')?.classList.add('hidden');
        document.getElementById('fallback-approval-overlay')?.remove();
      }
    });
    ChatSocket.connect();
  }

  function disconnect() {
    ChatSocket.disconnect();
  }

  /* ── Close chat ───────────────────────────────────────────── */
  function closeChat() {
    document.getElementById('chat-empty')?.classList.remove('hidden');
    document.getElementById('chat-window')?.classList.add('hidden');
    document.getElementById('chat-sidebar')?.classList.remove('mobile-hidden');
    ChatMessages.setActive(null);
    document.querySelectorAll('.user-list-item').forEach(el => el.classList.remove('active'));
    ChatReply.clearReplyTo();
  }

  /* ── Message handler ──────────────────────────────────────── */
  function _onMessage(msg) {
    const me = window._session?.user?.id;
    const myRole = window._session?.user?.role;
    const sender = ChatUsers.getUserById(msg.sender_id);
    const isSuperuser = msg.sender_role === 'superadmin';
    const room = [me, msg.sender_id !== me ? msg.sender_id : msg.receiver_id].sort().join('_');

    /* Incrementar contador de mensajes no leídos solo para el receptor (usuario actual) */
    const isChatOpen = ChatMessages.getActive() && [me, ChatMessages.getActive().id].sort().join('_') === room;
    const isForMe = msg.receiver_id === me;
    if (isForMe) {
      if (sender) {
        ChatUsers.updateUser(sender.id, { unread_count: (sender.unread_count || 0) + 1 });
        ChatUsers.updateUserItem(sender.id);
      } else {
        /* Si el usuario no está en la lista (ej. superusuario oculto), agregarlo temporalmente */
        const tempUser = {
          id: msg.sender_id,
          name: msg.sender_name,
          avatar: msg.sender_avatar,
          unread_count: 1,
          online: false
        };
        ChatUsers.addUser(tempUser);
        ChatUsers.updateUserItem(tempUser.id);
      }
      ChatUtils.updatePageTitle(ChatUsers.getTotalUnread());
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  ⚠️  LÓGICA CRÍTICA DE RECEPCIÓN DE MENSAJES — NO MODIFICAR  ⚠️
     * ──────────────────────────────────────────────────────────────────────────
     *  Esta lógica está VALIDADA. Evita mensajes DUPLICADOS y mantiene el
     *  scroll en el último mensaje. Reglas que DEBEN mantenerse:
     *
     *  1. Superadmin → usuario regular:
     *       - Si el chat YA está abierto  → SOLO _appendMessage(msg) (1 vez).
     *       - Si el chat NO está abierto  → SOLO openChat() (carga el historial
     *         que YA incluye este mensaje). ❌ NO hacer _appendMessage aquí
     *         además de openChat, o el mensaje se DUPLICA.
     *
     *  2. _appendMessage es ASYNC (descifra). SIEMPRE hacer el scroll DENTRO
     *     del .then()/await, nunca inmediatamente después de llamarlo, o el
     *     enfoque queda ARRIBA del último mensaje (el DOM aún no se actualizó).
     *
     *  3. El scroll usa scrollTop = scrollHeight (NO scrollIntoView).
     * ════════════════════════════════════════════════════════════════════════ */
    if (isSuperuser && myRole === 'user') {
      console.log('[Chat] Superuser message to regular user - auto-opening chat');
      const alreadyOpen = ChatMessages.getActive() && [me, ChatMessages.getActive().id].sort().join('_') === msg.room;
      if (alreadyOpen) {
        ChatMessages.appendMessage(msg).then(() => {
          const c = document.getElementById('chat-messages');
          c.scrollTop = c.scrollHeight;
        });
        ChatSocket.emit('chat:read', { room: msg.room });
      } else {
        ChatUI.openChat(msg.sender_id).then(() => {
          ChatSocket.emit('chat:read', { room: msg.room });
        });
      }
    } else if (ChatMessages.getActive() && [me, ChatMessages.getActive().id].sort().join('_') === room) {
      ChatMessages.appendMessage(msg).then(() => {
        const c = document.getElementById('chat-messages');
        c.scrollTop = c.scrollHeight;
      });
      ChatSocket.emit('chat:read', { room: msg.room });
    } else {
      Toast.show(`💬 ${ChatUtils.escape(msg.sender_name || 'Alguien')}: ${ChatUtils.messagePreview(msg)}`, 'info');
    }
    SoundEffects?.playReceive();
  }

  /* ── Fallback si ModerationSystem no carga ───────────────────────────── */
  function _showFallbackApprovalBlock() {
    if (document.getElementById('fallback-approval-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'fallback-approval-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(10,10,30,0.97);
      z-index: 999999; display: flex; align-items: center; justify-content: center;
      flex-direction: column; text-align: center; color: white; font-family: sans-serif;
    `;
    overlay.innerHTML = `
      <div style="font-size:3rem; margin-bottom:1rem;">⏳</div>
      <h2 style="color:#e94560; margin-bottom:0.5rem;">Cuenta en Revisión</h2>
      <p style="color:#aaa; max-width:350px; line-height:1.6;">
        Tu cuenta está siendo revisada por nuestras moderadoras.<br>
        Por favor espera mientras te contactan para verificación.
      </p>
      <div style="margin-top:1.5rem; color:#e94560; font-size:0.9rem;">🕐 Esperando aprobación...</div>
    `;
    document.body.appendChild(overlay);
  }

  return {
    connect,
    disconnect,
    loadUsers,
    initSearch,
    closeChat,
    setReplyTo: ChatReply.setReplyTo,
    clearReplyTo: ChatReply.clearReplyTo,
    getReplyTo: ChatReply.getReplyTo,
    replyToMessage: ChatModal.replyToMessage,
    replyToMessageFromMenu: ChatModal.replyToMessageFromMenu,
    openChat: ChatUI.openChat,
    openImageModal: ChatModal.openImageModal,
    openImageModalFromRow: ChatModal.openImageModalFromRow,
    closeImageModal: ChatModal.closeImageModal,
    modalDeleteForMe: ChatModal.modalDeleteForMe,
    modalDeleteForAll: ChatModal.modalDeleteForAll,
    downloadImage: ChatModal.downloadImage,
    downloadImageFromUrl: ChatModal.downloadImageFromUrl,
    _deleteForMe: ChatMessages.deleteForMe,
    _deleteMsg: ChatMessages.deleteMessage,
    _toggleMessageMenu: ChatModal.toggleMessageMenu,
    closeSuperuserModal: ChatUI.closeSuperuserModal,
    openSuperuserChat: ChatUI.openSuperuserChat
  };
})();
