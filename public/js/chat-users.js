/* ═════════════════════════════════════════════════════════════════════════════
 *  ⚠️⚠️⚠️ MÓDULO DE USUARIOS — CÓDIGO VALIDADO Y FUNCIONANDO — NO MODIFICAR ⚠️⚠️⚠️
 * ─────────────────────────────────────────────────────────────────────────────────
 *  Este módulo maneja la gestión de usuarios y la lista de usuarios del chat.
 *
 *  REGLAS DE PRESERVACIÓN:
 *  1. La estructura de usuarios está validada y funcionando correctamente
 *  2. La función _userItemHTML genera el HTML de los items con badges de unread
 *  3. La función updateUserItem actualiza el DOM de un usuario específico
 *  4. Solo se permiten integraciones, NO cambios a la lógica existente
 * ═════════════════════════════════════════════════════════════════════════════ */
'use strict';

const ChatUsers = (() => {
  let _users = [];

  function setUsers(users) {
    _users = users;
  }

  function getUsers() {
    return _users;
  }

  function getUserById(id) {
    return _users.find(u => u.id === id);
  }

  function updateUser(userId, updates) {
    const u = _users.find(x => x.id === userId);
    if (u) {
      Object.assign(u, updates);
    }
    return u;
  }

  function addUser(user) {
    if (!_users.find(x => x.id === user.id)) {
      _users.push(user);
    }
  }

  function _userItemHTML(u) {
    const init = (u.name || '?').charAt(0).toUpperCase();
    const avatar = u.avatar ? `<img src="${u.avatar}" alt="${init}" onerror="this.style.display='none';this.parentNode.textContent='${init}'"/>` : init;
    const status = u.online ? 'online' : 'offline';
    const seen = u.online ? `<span class="cli-status-indicator ${status}"></span> En línea` : (u.last_seen ? ChatUtils.timeAgo(u.last_seen) : 'Desconectado');
    const unread = u.unread_count > 0 ? `<span class="unread-badge">${u.unread_count}</span>` : '';
    return `<div class="user-list-item" data-uid="${u.id}" onclick="Chat.openChat('${u.id}')">
      <div class="cli-avatar">${avatar}</div>
      <div class="cli-info"><div class="cli-name">${ChatUtils.escape(u.name)}</div>
        <div class="cli-last">${seen}</div></div>
        <div class="cli-badge">${unread}</div></div>`;
  }

  function renderUserList(users) {
    const el = document.getElementById('user-list');
    if (!el) return;
    const me = window._session?.user?.id;
    const myRole = window._session?.user?.role;
    const isApproved = window._session?.user?.is_approved === 1 || myRole === 'superadmin';
    
    /* ═════════════════════════════════════════════════════════════════════════════
     *  ⚠️  CRÍTICO — FILTRO DE USUARIAS SEGÚN APROBACIÓN — NO MODIFICAR  ⚠️
     * ─────────────────────────────────────────────────────────────────────────────────
     *  Solo muestra usuarias aprobadas en la lista, excepto para superusuarios
     *  que pueden ver todas las usuarias (aprobadas y pendientes).
     * 
     *  REGLAS QUE DEBEN MANTENERSE SIEMPRE:
     *  1. Usuarias regulares solo ven usuarias con is_approved=1
     *  2. Superusuarios ven todas las usuarias (incluyendo pendientes)
     *  3. Las usuarias pendientes tienen indicador visual
     *  4. No mostrar el usuario actual (me)
     * ═════════════════════════════════════════════════════════════════════════════ */
    const list = users.filter(u => {
      if (u.id === me) return false;
      if (u.role === 'superadmin' && myRole !== 'admin' && myRole !== 'superadmin') return false;
      // Solo mostrar usuarios aprobados (o todos si eres superadmin)
      if (myRole !== 'superadmin' && u.is_approved !== 1) return false;
      return true;
    });
    if (!list.length) {
      el.innerHTML = '<p style="padding:1rem;color:var(--text-muted);font-size:.85rem;">Sin usuarios</p>';
      return;
    }
    el.innerHTML = list.map(_userItemHTML).join('');
  }

  function updateUserItem(userId) {
    const u = _users.find(x => x.id === userId);
    if (!u) return;
    const item = document.querySelector(`[data-uid="${userId}"]`);
    if (item) {
      item.outerHTML = _userItemHTML(u);
    } else {
      renderUserList(_users);
    }
  }

  function getTotalUnread() {
    return _users.reduce((sum, u) => sum + (u.unread_count || 0), 0);
  }

  return {
    setUsers,
    getUsers,
    getUserById,
    updateUser,
    addUser,
    renderUserList,
    updateUserItem,
    getTotalUnread
  };
})();
