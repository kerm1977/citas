/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  MODERATION-SOCKET — listeners de socket de moderación — NO MODIFICAR   ║
 * ║  Requiere: moderation-state.js, moderation-modals.js, moderation-chat.js║
 * ║  ⚠️ moderation:force_pending y moderation:server_approved son server-   ║
 * ║     authoritative. NO eliminar ni alterar sus listeners.                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
'use strict';

window._ModSocket = (function () {
  const S = window._MS;

  function _syncSession(isApproved) {
    const KEY = '_chatapp_session';
    try {
      ['sessionStorage', 'localStorage'].forEach(store => {
        const raw = window[store].getItem(KEY);
        if (raw) {
          const d = JSON.parse(raw);
          if (d.user) d.user.is_approved = isApproved ? 1 : 0;
          window[store].setItem(KEY, JSON.stringify(d));
        }
      });
      if (window._session?.user) window._session.user.is_approved = isApproved ? 1 : 0;
    } catch {}
  }

  function _setupSocketListeners() {
    if (!S.socket) return;

    S.socket.on('moderation:new_user', (data) => {
      /* Solo mostrar modal si el superusuario está logueado y conectado */
      if (S.currentUser?.role !== 'superadmin') return;
      if (!S.currentUser?.id) return;
      /* Verificar que el usuario tenga sesión activa */
      const session = Auth?.loadSession?.();
      if (!session?.user?.id) return;
      /* NO mostrar modal inmediatamente - esperar a que el usuario nuevo se loguee */
      if (!S.pendingReviewUsers.find(u => u.id === data.id)) {
        S.pendingReviewUsers.push(data);
      }
      /* No llamar showNewUserAlert aquí - se llamará cuando el usuario se loguee */
    });

    S.socket.on('chat:user_list_refresh', () => {
      if (typeof Chat !== 'undefined' && Chat.loadUsers) Chat.loadUsers();
    });

    /* Detectar cuando un usuario se conecta y mostrar modal si está pendiente */
    S.socket.on('user:online', (data) => {
      if (S.currentUser?.role !== 'superadmin') return;
      const session = Auth?.loadSession?.();
      if (!session?.user?.id) return;
      /* Solo mostrar modal si el usuario se acaba de conectar (online: true) */
      if (!data.online) return;
      const pendingUser = S.pendingReviewUsers.find(u => u.id === data.userId);
      if (pendingUser) {
        window._ModModals.showNewUserAlert(pendingUser);
      }
    });

    /* ⚠️ CRÍTICO — filtrar por sender_id para evitar duplicados en ambos lados */
    S.socket.on('moderation:review_message', (data) => {
      if (S.activeReviewChat && S.currentUser?.role === 'superadmin') {
        if (data.sender_id !== S.currentUser.id) window._ModChat._appendReviewMessage(data);
      }
      if (S.currentUser?.role === 'user' && data.sender_id !== S.currentUser.id) {
        window._ModChat._appendModeratorMessage(data);
      }
    });

    S.socket.on('moderation:approved', () => {
      S.isApproved = true;
      _syncSession(true);
      window._ModModals.hideApprovalWaiting();
      window._ModModals.showWelcomeModal();
      window._ModModals._updateUsersListVisibility();
    });

    S.socket.on('moderation:rejected', () => {
      window._ModModals.hideApprovalWaiting();
      window._ModModals.showRejectionModal();
    });

    /* ⚠️ CRÍTICO — server-authoritative — NO ELIMINAR */
    S.socket.on('moderation:force_pending', () => {
      S.isApproved = false;
      _syncSession(false);
      window._ModModals._updateUsersListVisibility();
      window._ModModals.hideApprovalWaiting();
      window._ModModals.showApprovalWaiting();
    });

    S.socket.on('moderation:server_approved', () => {
      S.isApproved = true;
      _syncSession(true);
      window._ModModals.hideApprovalWaiting(); /* ⚠️ Garantía — NO quitar */
      window._ModModals._updateUsersListVisibility();
    });

    S.socket.on('moderation:system_message', (data) => {
      if (S.activeReviewChat) window._ModChat._appendSystemMessage(data.message);
      if (data.message?.includes('moderadora') && !S.isApproved && !S.activeReviewChat) {
        window._ModModals.hideApprovalWaiting();
        window._ModChat._showReviewChatForUser();
      }
    });
  }

  async function _checkUserStatus() {
    if (S.currentUser?.role === 'superadmin') {
      S.isApproved = true;
      try {
        const res  = await fetch('/api/auth/pending-users', { headers: ChatUtils.authHeaders() });
        const data = await res.json();
        if (data.ok && data.users?.length > 0) {
          S.pendingReviewUsers = data.users;
          /* Solo mostrar modal si el superusuario está logueado (tiene sesión activa) */
          const session = Auth?.loadSession?.();
          if (session?.user?.id) {
            window._ModModals.showNewUserAlert(data.users[0]);
          }
        }
      } catch (e) { console.error('[ModSocket] pending-users error:', e); }
      return;
    }
    try {
      const res  = await fetch('/api/auth/approval-status', { headers: ChatUtils.authHeaders() });
      const data = await res.json();
      if (data.ok) {
        const serverApproved = data.is_approved === true || data.is_approved === 1;
        if (S.isApproved !== serverApproved) {
          S.isApproved = serverApproved;
          _syncSession(serverApproved);
        }
      }
    } catch (e) { console.warn('[ModSocket] approval-status error:', e.message); }

    if (!S.isApproved) {
      window._ModModals._updateUsersListVisibility();
      window._ModModals.showApprovalWaiting();
    } else {
      window._ModModals.hideApprovalWaiting();
      window._ModModals._updateUsersListVisibility();
    }
  }

  return { _setupSocketListeners, _checkUserStatus };
})();
