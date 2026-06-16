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

  function unblock(blockedId, name) {
    const ov = document.createElement('div');
    ov.className = 'report-overlay';
    ov.innerHTML = `
      <div class="report-card glass-card block-confirm-card">
        <div class="block-confirm-icon">🔓</div>
        <h3 class="block-confirm-title">Desbloquear a <span>${_esc(name || 'este usuario')}</span></h3>
        <p class="block-confirm-sub">Ingresa tu contraseña para confirmar el desbloqueo.</p>
        <input id="unblock-password" type="password" class="report-input-ro" placeholder="Contraseña" style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);border-radius:.5rem;padding:.5rem .7rem;color:#fff;width:100%;margin-bottom:.8rem;">
        <div class="block-confirm-actions">
          <button id="btn-confirm-unblock" class="btn block-btn-danger">🔓 Desbloquear</button>
          <button id="btn-cancel-unblock" class="btn block-btn-safe">Cancelar</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#btn-cancel-unblock').onclick = () => ov.remove();
    ov.querySelector('#btn-confirm-unblock').onclick = async () => {
      const pwd = ov.querySelector('#unblock-password').value;
      if (!pwd) { alert('Ingresa tu contraseña'); return; }
      const btn = ov.querySelector('#btn-confirm-unblock');
      btn.disabled = true; btn.textContent = 'Verificando…';
      try {
        const res  = await fetch(`/api/blocks/${blockedId}`, { method: 'DELETE', headers: _h(), body: JSON.stringify({ password: pwd }) });
        const data = await res.json();
        ov.remove();
        if (data.ok) {
          document.getElementById(`blocked-item-${blockedId}`)?.remove();
          if (typeof Chat !== 'undefined') Chat.loadUsers?.();
          const t = document.createElement('div');
          t.className = 'toast toast-success';
          t.textContent = `🔓 ${name || 'Usuario'} desbloqueado`;
          document.getElementById('toast-container')?.appendChild(t);
          setTimeout(() => t.remove(), 3000);
          const list = document.querySelector('.blocked-list');
          if (list && !list.children.length) loadBlockedUsers();
        } else {
          alert('Error: ' + (data.msg || 'No se pudo desbloquear'));
        }
      } catch (e) { ov.remove(); alert('Error de red'); }
    };
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  }

  return { loadBlockedUsers, unblock };
})();
