/* ── Admin Panel ─────────────────────────────────────────────── */
'use strict';

const Admin = (() => {
  function _h() { return { 'Content-Type':'application/json', Authorization: 'Bearer ' + (window._session?.token||'') }; }
  function _isAdmin() {
    const r = window._session?.user?.role;
    return r === 'admin' || r === 'superadmin';
  }

  async function loadStats() {
    if (!_isAdmin()) return;
    try {
      const res  = await fetch('/api/admin/stats', { headers: _h() });
      const data = await res.json();
      console.log('[Admin] Stats response:', data);
      if (!data.ok) {
        console.error('[Admin] Failed to load stats:', data.msg);
        return;
      }
      const el = document.getElementById('admin-stats');
      if (!el) {
        console.error('[Admin] admin-stats element not found');
        return;
      }
      const { total, online, messages } = data.stats;
      el.innerHTML = `
        <div class="stat-card"><div class="stat-val">${total}</div><div class="stat-lbl">Usuarios</div></div>
        <div class="stat-card"><div class="stat-val" style="color:var(--success)">${online}</div><div class="stat-lbl">En línea</div></div>
        <div class="stat-card"><div class="stat-val" style="color:var(--secondary)">${messages}</div><div class="stat-lbl">Mensajes</div></div>`;
    } catch (e) {
      console.error('[Admin] Error loading stats:', e);
    }
  }

  async function loadUsers() {
    if (!_isAdmin()) return;
    try {
      const res  = await fetch('/api/admin/users', { headers: _h() });
      const data = await res.json();
      console.log('[Admin] Users response:', data);
      if (!data.ok) {
        console.error('[Admin] Failed to load users:', data.msg);
        return;
      }
      const el = document.getElementById('admin-user-list');
      if (!el) {
        console.error('[Admin] admin-user-list element not found');
        return;
      }
      if (!data.users || !data.users.length) {
        el.innerHTML = '<p style="padding:1rem;color:var(--text-muted);">No hay usuarios</p>';
        return;
      }
      el.innerHTML = data.users.map(_userRowHTML).join('');
    } catch (e) {
      console.error('[Admin] Error loading users:', e);
    }
  }

  function _userRowHTML(u) {
    const init   = (u.name||'?').charAt(0).toUpperCase();
    const avatar = u.avatar ? `<img src="${u.avatar}" alt="${init}"/>` : init;
    const badge  = u.role === 'admin' ? '<span class="badge badge-admin">admin</span>' : '';
    const blocked= u.is_blocked ? '<span class="badge badge-blocked">bloqueado</span>' : '';
    return `<div class="admin-user-row" id="aur-${u.id}">
      <div class="au-avatar">${avatar}</div>
      <div class="au-info">
        <div class="au-name">${_esc(u.name)} ${badge} ${blocked}</div>
        <div class="au-email">${_esc(u.email)}</div>
        <div class="au-phone">${_esc(u.phone||'-')}</div>
      </div>
      <div class="au-actions">
        <button class="btn btn-sm" onclick="Admin.toggleBlock('${u.id}',${!u.is_blocked})">
          ${u.is_blocked
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Desbloquear'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> Bloquear'}
        </button>
        <button class="btn btn-sm btn-danger-soft" onclick="Admin.deleteUser('${u.id}','${_esc(u.name)}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> Eliminar
        </button>
        ${u.role!=='admin'
          ? `<button class="btn btn-sm" onclick="Admin.setRole('${u.id}','admin')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg> Admin</button>`
          : `<button class="btn btn-sm btn-secondary" onclick="Admin.setRole('${u.id}','user')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> User</button>`}
      </div></div>`;
  }

  async function toggleBlock(id, block) {
    const res  = await fetch(`/api/admin/users/${id}/block`, {
      method: 'PATCH', headers: _h(), body: JSON.stringify({ blocked: block })
    });
    const data = await res.json();
    if (data.ok) { Toast.show(block ? 'Usuario bloqueado' : 'Usuario desbloqueado', 'success'); loadUsers(); }
    else Toast.show(data.msg || 'Error', 'error');
  }

  async function deleteUser(id, name) {
    if (!confirm(`¿Eliminar a ${name}? Esta acción no se puede deshacer.`)) return;
    const res  = await fetch(`/api/admin/users/${id}`, { method: 'DELETE', headers: _h() });
    const data = await res.json();
    if (data.ok) { Toast.show('Usuario eliminado', 'success'); loadUsers(); loadStats(); }
    else Toast.show(data.msg || 'Error', 'error');
  }

  async function setRole(id, role) {
    const res  = await fetch(`/api/admin/users/${id}/role`, {
      method: 'PATCH', headers: _h(), body: JSON.stringify({ role })
    });
    const data = await res.json();
    if (data.ok) { Toast.show('Rol actualizado', 'success'); loadUsers(); }
    else Toast.show(data.msg || 'Error', 'error');
  }

  async function init() {
    if (!_isAdmin()) return;
    await Promise.all([loadStats(), loadUsers(), loadMedia()]);
    /* Show admin button in chat sidebar */
    const btn = document.getElementById('btn-admin-panel');
    if (btn) btn.style.display = '';
  }

  async function exportUsers() {
    if (!_isAdmin()) return;
    const res = await fetch('/api/admin/users/export', { headers: _h() });
    const data = await res.json();
    if (!data.ok) return Toast.show('Error al exportar usuarios', 'error');
    const blob = new Blob([JSON.stringify(data.users, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'usuarios_export_' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(url);
    Toast.show('Usuarios exportados', 'success');
  }

  async function loadMedia() {
    if (!_isAdmin()) return;
    try {
      const res = await fetch('/api/admin/media', { headers: _h() });
      const data = await res.json();
      console.log('[Admin] Media response:', data);
      if (!data.ok) {
        console.error('[Admin] Failed to load media:', data.msg);
        return;
      }
      const el = document.getElementById('admin-media-list');
      if (!el) {
        console.error('[Admin] admin-media-list element not found');
        return;
      }
      if (!data.files || !data.files.length) {
        el.innerHTML = '<p style="padding:1rem;color:var(--text-muted);">No hay archivos compartidos</p>';
        return;
      }
      el.innerHTML = data.files.map(f => {
        const ext = f.name.split('.').pop().toUpperCase();
        const typeIcon = ext === 'JPG' || ext === 'JPEG' || ext === 'PNG' || ext === 'GIF' || ext === 'WEBP' ? '🖼️' :
                        ext === 'MP4' || ext === 'WEBM' || ext === 'MOV' ? '🎬' :
                        ext === 'MP3' || ext === 'WAV' || ext === 'OGG' ? '🎵' : '📄';
        return `
      <div class="admin-media-item">
        <div class="media-info">
          <div class="media-name">${typeIcon} Archivo ${ext}</div>
          <div class="media-meta">${(f.size/1024).toFixed(1)} KB • ${new Date(f.created).toLocaleString()}</div>
        </div>
        <div class="media-actions">
          <a href="${f.url}" target="_blank" class="btn btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            Ver
          </a>
        </div>
      </div>
    `;
      }).join('');
    } catch (e) {
      console.error('[Admin] Error loading media:', e);
    }
  }

  function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  return { init, loadStats, loadUsers, toggleBlock, deleteUser, setRole, exportUsers, loadMedia };
})();

window.Admin = Admin;
