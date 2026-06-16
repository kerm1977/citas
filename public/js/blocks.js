'use strict';
/* ╔══════════════════════════════════════════════════════════════════╗
 * ║  BLOCKS.JS — gestión de usuarios bloqueados — window.BlockManager ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
window.BlockManager = (() => {
  function _h() {
    return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (window._session?.token || '') };
  }
  function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  async function loadBlockedUsers() {
    const el = document.getElementById('blocked-users-section');
    if (!el) return;
    try {
      const res  = await fetch('/api/blocks', { headers: _h() });
      const data = await res.json();
      if (!data.ok) { el.innerHTML = ''; return; }
      if (!data.users.length) {
        el.innerHTML = '<div class="blocked-section"><h3 class="blocked-title">🚫 Personas bloqueadas</h3><p class="blocked-empty">No tienes usuarios bloqueados.</p></div>';
        return;
      }
      el.innerHTML = `
        <div class="blocked-section">
          <h3 class="blocked-title">🚫 Personas bloqueadas</h3>
          <div class="blocked-list">
            ${data.users.map(u => `
              <div class="blocked-item" id="blocked-item-${u.id}">
                <div class="blocked-name">${_esc(u.name)}</div>
                <button class="btn blocked-unblock-btn" onclick="BlockManager.unblock('${u.id}', '${_esc(u.name)}')">
                  🔓 Desbloquear
                </button>
              </div>`).join('')}
          </div>
        </div>`;
    } catch (e) { el.innerHTML = ''; }
  }

  async function unblock(blockedId, name) {
    try {
      const res  = await fetch(`/api/blocks/${blockedId}`, { method: 'DELETE', headers: _h() });
      const data = await res.json();
      if (data.ok) {
        document.getElementById(`blocked-item-${blockedId}`)?.remove();
        /* Recargar lista de usuarios para que vuelva a aparecer */
        if (typeof Chat !== 'undefined') Chat.loadUsers?.();
        const t = document.createElement('div');
        t.className = 'toast toast-success';
        t.textContent = `🔓 ${name || 'Usuario'} desbloqueado`;
        document.getElementById('toast-container')?.appendChild(t);
        setTimeout(() => t.remove(), 3000);
        /* Si la lista queda vacía, recargar sección */
        const list = document.querySelector('.blocked-list');
        if (list && !list.children.length) loadBlockedUsers();
      }
    } catch (e) { /* silencioso */ }
  }

  return { loadBlockedUsers, unblock };
})();
