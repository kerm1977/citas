/* ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CHAT.JS — coordinador principal — NO MODIFICAR                         ║
 * ║  ⚠️ _onMessage: NO duplicar appendMessage. Scroll async. NO modificar.  ║
 * ║  ⚠️ connect: verifica is_approved ANTES de init(socket). NO modificar.  ║
 * ║  ⚠️ _showFallbackApprovalBlock movido a chat-fallback.js                ║
 * ╚══════════════════════════════════════════════════════════════════════════╝ */
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
      loadUsers(); /* Refrescar lista y badges de no leídos al conectar/reconectar */
      ChatUI.updateCurrentUserName();
      ChatUI.checkSuperuserContacts();
      
      /* ⚠️ CRÍTICO: verificar is_approved antes de init(socket). NO modificar. */
      const sessionUser = window._session?.user;
      const userIsApproved = sessionUser?.role === 'superadmin' || 
                             sessionUser?.is_approved === 1 || 
                             sessionUser?.is_approved === true;
      
      
      if (sessionUser && !userIsApproved && sessionUser.role !== 'superadmin') {
        // Bloqueo de respaldo: mostrar modal si ModerationSystem no cargó
        if (window.ModerationSystem) {
          const socket = ChatSocket.getSocket ? ChatSocket.getSocket() : null;
          if (socket) {
            ModerationSystem.init(socket);
          }
        } else {
          // ModerationSystem no cargó - mostrar overlay de respaldo directamente
          console.warn('[Chat] ModerationSystem not loaded - using fallback block');
          window._showFallbackApprovalBlock?.();
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
    /* ⚠️ CRÍTICO _onMessage: NO duplicar appendMessage al abrir chat. Scroll async. */
    if (isSuperuser && myRole === 'user') {
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
