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

  /* ── Switch between users and groups tabs ─────────────────── */
  async function switchTab(tab) {
    const tabUsers = document.getElementById('tab-users');
    const tabGroups = document.getElementById('tab-groups');
    const userList = document.getElementById('user-list');
    const groupList = document.getElementById('group-list');

    if (tab === 'users') {
      tabUsers.classList.add('active');
      tabGroups.classList.remove('active');
      userList.classList.remove('hidden');
      groupList.classList.add('hidden');
    } else if (tab === 'groups') {
      tabUsers.classList.remove('active');
      tabGroups.classList.add('active');
      userList.classList.add('hidden');
      groupList.classList.remove('hidden');
      await loadGroups();
    }
  }

  /* ── Load groups ──────────────────────────────────────────── */
  async function loadGroups() {
    try {
      const res = await fetch('/api/groups', { headers: ChatUtils.authHeaders() });
      const data = await res.json();
      if (data.ok) {
        renderGroupList(data.groups);
      }
    } catch (e) {
      console.error('Error al cargar grupos:', e);
    }
  }

  /* ── Render group list ───────────────────────────────────── */
  function renderGroupList(groups) {
    const container = document.getElementById('group-list');
    if (!container) return;

    if (groups.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">No tienes grupos aún. ¡Crea uno nuevo!</p>';
      return;
    }

    container.innerHTML = groups.map(g => `
      <div class="user-list-item" onclick="Chat.openGroup('${g.id}', '${g.name}')" style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1rem;cursor:pointer;transition:background .15s;position:relative;">
        <div style="width:40px;height:40px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:700;color:white;flex-shrink:0;">
          ${g.name.charAt(0).toUpperCase()}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:500;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${g.name}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">${g.member_count} miembros</div>
        </div>
      </div>
    `).join('');
  }

  /* ── Open group chat ─────────────────────────────────────── */
  async function openGroup(groupId, groupName) {
    try {
      const res = await fetch(`/api/groups/${groupId}`, { headers: ChatUtils.authHeaders() });
      const data = await res.json();
      if (!data.ok) {
        Toast.show(data.msg || 'Error al cargar grupo', 'error');
        return;
      }

      // Mostrar ventana de chat
      document.getElementById('chat-empty')?.classList.add('hidden');
      document.getElementById('chat-window')?.classList.remove('hidden');
      document.getElementById('chat-sidebar')?.classList.add('mobile-hidden');

      // Configurar header del chat
      const header = document.querySelector('.chat-header');
      if (header) {
        header.innerHTML = `
          <div style="display:flex;align-items:center;gap:0.8rem;">
            <div style="width:40px;height:40px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:700;color:white;">
              ${groupName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-weight:600;color:white;">${groupName}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">${data.members.length} miembros</div>
            </div>
          </div>
          <div style="display:flex;gap:0.5rem;">
            <button class="icon-btn" onclick="Chat.showGroupMembers('${groupId}')" title="Miembros">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
            </button>
            <button class="icon-btn" onclick="Chat.showGroupInvites('${groupId}')" title="Invitaciones">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            </button>
          </div>
        `;
      }

      // Limpiar mensajes anteriores
      const messagesContainer = document.getElementById('chat-messages');
      if (messagesContainer) {
        messagesContainer.querySelectorAll('*').forEach(el => el.remove());
      }

      // Guardar grupo activo
      ChatMessages.setActive({ id: groupId, name: groupName, isGroup: true });

      // Cargar mensajes del grupo
      await loadGroupMessages(groupId);

    } catch (e) {
      console.error('Error al abrir grupo:', e);
      Toast.show('Error de red', 'error');
    }
  }

  /* ── Load group messages ───────────────────────────────── */
  async function loadGroupMessages(groupId) {
    try {
      const res = await fetch(`/api/chat/messages?group_id=${groupId}`, { headers: ChatUtils.authHeaders() });
      const data = await res.json();
      if (data.ok && data.messages) {
        for (const msg of data.messages) {
          await ChatMessages.appendMessage(msg);
        }
        const c = document.getElementById('chat-messages');
        c.scrollTop = c.scrollHeight;
      }
    } catch (e) {
      console.error('Error al cargar mensajes del grupo:', e);
    }
  }

  /* ── Show group members modal ──────────────────────────── */
  async function showGroupMembers(groupId) {
    try {
      const res = await fetch(`/api/groups/${groupId}`, { headers: ChatUtils.authHeaders() });
      const data = await res.json();
      if (!data.ok) return;

      const isCreator = data.group.created_by === window._session?.user?.id;
      const isAdmin = isCreator || data.members.find(m => m.id === window._session?.user?.id && m.role === 'admin');
      
      let membersHtml = data.members.map(m => {
        const roleLabel = m.role === 'admin' ? 'Admin' : m.role === 'creator' ? 'Creador' : 'Miembro';
        const roleColor = m.role === 'admin' ? '#818cf8' : m.role === 'creator' ? '#fbbf24' : 'var(--text-muted)';
        
        return `
        <div style="display:flex;align-items:center;gap:0.8rem;padding:0.8rem;background:rgba(255,255,255,0.05);border-radius:0.6rem;margin-bottom:0.5rem;">
          <div style="width:36px;height:36px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.9rem;font-weight:600;color:white;">
            ${m.name.charAt(0).toUpperCase()}
          </div>
          <div style="flex:1;">
            <div style="font-weight:500;color:white;">${m.name}</div>
            <div style="font-size:0.75rem;color:${roleColor};">${roleLabel}</div>
          </div>
          ${isCreator && m.id !== window._session?.user?.id ? `
            <select onchange="Chat.changeMemberRole('${groupId}', '${m.id}', this.value)" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:white;padding:0.3rem 0.5rem;border-radius:0.4rem;font-size:0.8rem;cursor:pointer;">
              <option value="member" ${m.role === 'member' ? 'selected' : ''}>Miembro</option>
              <option value="admin" ${m.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
            <button onclick="Chat.removeGroupMember('${groupId}', '${m.id}')" style="background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);color:#f87171;padding:0.4rem 0.8rem;border-radius:0.4rem;cursor:pointer;font-size:0.8rem;">
              Eliminar
            </button>
          ` : isAdmin && m.id !== window._session?.user?.id && m.role !== 'admin' ? `
            <button onclick="Chat.removeGroupMember('${groupId}', '${m.id}')" style="background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);color:#f87171;padding:0.4rem 0.8rem;border-radius:0.4rem;cursor:pointer;font-size:0.8rem;">
              Eliminar
            </button>
          ` : ''}
        </div>
      `}).join('');

      const modalHtml = `
        <div id="group-members-modal" class="modal-overlay">
          <div class="modal-content glass-card">
            <div class="modal-header">
              <h3>Miembros del grupo</h3>
              <button class="modal-close" onclick="document.getElementById('group-members-modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
              ${membersHtml}
              ${isAdmin ? `
                <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--glass-border);">
                  <input id="add-member-search" type="search" class="form-control" placeholder="Buscar usuario para agregar..." />
                  <div id="add-member-results" style="margin-top:0.5rem;"></div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);

      if (isAdmin) {
        const searchInput = document.getElementById('add-member-search');
        searchInput.oninput = async (e) => {
          const term = e.target.value.trim();
          if (term.length >= 2) {
            const searchRes = await fetch(`/api/groups/${groupId}/search?q=${encodeURIComponent(term)}`, { headers: ChatUtils.authHeaders() });
            const searchData = await searchRes.json();
            if (searchData.ok) {
              const resultsHtml = searchData.users.map(u => `
                <div onclick="Chat.addGroupMember('${groupId}', '${u.id}', '${u.name}')" style="padding:0.6rem;background:rgba(255,255,255,0.05);border-radius:0.4rem;margin-bottom:0.3rem;cursor:pointer;">
                  ${u.name}
                </div>
              `).join('');
              document.getElementById('add-member-results').innerHTML = resultsHtml;
            }
          } else {
            document.getElementById('add-member-results').innerHTML = '';
          }
        };
      }

    } catch (e) {
      console.error('Error al mostrar miembros:', e);
    }
  }

  /* ── Add member to group ───────────────────────────────── */
  async function addGroupMember(groupId, userId, userName) {
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...ChatUtils.authHeaders() },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (data.ok) {
        Toast.show(`${userName} agregado al grupo`, 'success');
        document.getElementById('group-members-modal')?.remove();
        loadGroupMessages(groupId); // Recargar para actualizar
      } else {
        Toast.show(data.msg || 'Error al agregar miembro', 'error');
      }
    } catch (e) {
      console.error('Error al agregar miembro:', e);
      Toast.show('Error de red', 'error');
    }
  }

  /* ── Remove member from group ───────────────────────────── */
  async function removeGroupMember(groupId, userId) {
    try {
      const res = await fetch(`/api/groups/${groupId}/members/${userId}`, {
        method: 'DELETE',
        headers: ChatUtils.authHeaders()
      });
      const data = await res.json();
      if (data.ok) {
        Toast.show('Miembro eliminado del grupo', 'success');
        document.getElementById('group-members-modal')?.remove();
        loadGroupMessages(groupId); // Recargar para actualizar
      } else {
        Toast.show(data.msg || 'Error al eliminar miembro', 'error');
      }
    } catch (e) {
      console.error('Error al eliminar miembro:', e);
      Toast.show('Error de red', 'error');
    }
  }

  /* ── Change member role ─────────────────────────────────── */
  async function changeMemberRole(groupId, userId, role) {
    try {
      const res = await fetch(`/api/groups/${groupId}/members/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...ChatUtils.authHeaders() },
        body: JSON.stringify({ role })
      });
      const data = await res.json();
      if (data.ok) {
        Toast.show('Rol actualizado', 'success');
        showGroupMembers(groupId); // Recargar modal
      } else {
        Toast.show(data.msg || 'Error al actualizar rol', 'error');
      }
    } catch (e) {
      console.error('Error al actualizar rol:', e);
      Toast.show('Error de red', 'error');
    }
  }

  /* ── Show group invites modal ───────────────────────────── */
  async function showGroupInvites(groupId) {
    try {
      const res = await fetch(`/api/groups/${groupId}/invites`, { headers: ChatUtils.authHeaders() });
      const data = await res.json();
      
      if (!data.ok) {
        Toast.show(data.msg || 'Error al cargar invitaciones', 'error');
        return;
      }

      let invitesHtml = data.invites.map(inv => `
        <div style="display:flex;align-items:center;gap:0.8rem;padding:0.8rem;background:rgba(255,255,255,0.05);border-radius:0.6rem;margin-bottom:0.5rem;">
          <div style="flex:1;">
            <div style="font-family:monospace;font-size:0.85rem;color:white;">${window.location.origin}/invite/${inv.token}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">${inv.accepted_by ? `Aceptada por ${inv.accepted_by_name}` : 'Pendiente'}</div>
          </div>
          <button onclick="Chat.copyInviteLink('${inv.token}')" style="background:rgba(102,126,234,0.2);border:1px solid rgba(102,126,234,0.4);color:#818cf8;padding:0.4rem 0.8rem;border-radius:0.4rem;cursor:pointer;font-size:0.8rem;">
            Copiar
          </button>
          <button onclick="Chat.deleteGroupInvite('${groupId}', '${inv.id}')" style="background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);color:#f87171;padding:0.4rem 0.8rem;border-radius:0.4rem;cursor:pointer;font-size:0.8rem;">
            Eliminar
          </button>
        </div>
      `).join('');

      const modalHtml = `
        <div id="group-invites-modal" class="modal-overlay">
          <div class="modal-content glass-card">
            <div class="modal-header">
              <h3>Invitaciones del grupo</h3>
              <button class="modal-close" onclick="document.getElementById('group-invites-modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
              <button onclick="Chat.createGroupInvite('${groupId}')" class="btn btn-full" style="margin-bottom:1rem;">
                Crear nueva invitación
              </button>
              ${invitesHtml || '<p style="color:var(--text-muted);text-align:center;">No hay invitaciones</p>'}
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);

    } catch (e) {
      console.error('Error al mostrar invitaciones:', e);
    }
  }

  /* ── Create group invite ───────────────────────────────── */
  async function createGroupInvite(groupId) {
    try {
      const res = await fetch(`/api/groups/${groupId}/invites`, {
        method: 'POST',
        headers: ChatUtils.authHeaders()
      });
      const data = await res.json();
      if (data.ok) {
        Toast.show('Invitación creada', 'success');
        showGroupInvites(groupId); // Recargar modal
      } else {
        Toast.show(data.msg || 'Error al crear invitación', 'error');
      }
    } catch (e) {
      console.error('Error al crear invitación:', e);
      Toast.show('Error de red', 'error');
    }
  }

  /* ── Copy invite link ───────────────────────────────────── */
  function copyInviteLink(token) {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link).then(() => {
      Toast.show('Link copiado al portapapeles', 'success');
    });
  }

  /* ── Delete group invite ───────────────────────────────── */
  async function deleteGroupInvite(groupId, inviteId) {
    try {
      const res = await fetch(`/api/groups/${groupId}/invites/${inviteId}`, {
        method: 'DELETE',
        headers: ChatUtils.authHeaders()
      });
      const data = await res.json();
      if (data.ok) {
        Toast.show('Invitación eliminada', 'success');
        showGroupInvites(groupId); // Recargar modal
      } else {
        Toast.show(data.msg || 'Error al eliminar invitación', 'error');
      }
    } catch (e) {
      console.error('Error al eliminar invitación:', e);
      Toast.show('Error de red', 'error');
    }
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
      
      /* Verificar si hay un usuario pendiente de revisión desde admin panel */
      const pendingReviewUser = sessionStorage.getItem('pendingReviewUser');
      if (pendingReviewUser && sessionUser?.role === 'superadmin') {
        try {
          const userData = JSON.parse(pendingReviewUser);
          sessionStorage.removeItem('pendingReviewUser');
          // Agregar a la lista de pendientes y abrir el chat
          if (window._MS && !window._MS.pendingReviewUsers.find(u => u.id === userData.id)) {
            window._MS.pendingReviewUsers.push(userData);
          }
          // Esperar un momento para que ModerationSystem esté completamente inicializado
          setTimeout(() => {
            if (window.ModerationSystem) {
              window.ModerationSystem.showNewUserAlert(userData);
            }
          }, 500);
        } catch (e) {
          console.error('[Chat] Error parsing pendingReviewUser:', e);
          sessionStorage.removeItem('pendingReviewUser');
        }
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
    switchTab,
    openGroup,
    showGroupMembers,
    addGroupMember,
    removeGroupMember,
    changeMemberRole,
    showGroupInvites,
    createGroupInvite,
    copyInviteLink,
    deleteGroupInvite,
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
    openSuperuserChat: ChatUI.openSuperuserChat,
    reportMessage: (msgId) => window.ReportModal?.open(msgId)
  };
})();
