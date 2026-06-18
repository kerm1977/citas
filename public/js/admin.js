/* ── Admin Panel ─────────────────────────────────────────────── */
'use strict';

const Admin = (() => {
  let _mediaFiles = [];
  let _currentFilter = 'all';
  let _allUsers = [];

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
      _allUsers = data.users || [];
      renderUserList(_allUsers);
    } catch (e) {
      console.error('[Admin] Error loading users:', e);
    }
  }

  function renderUserList(users) {
    const el = document.getElementById('admin-user-list');
    if (!el) {
      console.error('[Admin] admin-user-list element not found');
      return;
    }
    if (!users || !users.length) {
      el.innerHTML = '<p style="padding:1rem;color:var(--text-muted);">No hay usuarios</p>';
      return;
    }
    el.innerHTML = users.map(_userRowHTML).join('');
  }

  function toggleUsersDropdown() {
    const dropdown = document.getElementById('admin-users-dropdown');
    const btn = document.querySelector('.admin-dropdown-btn');
    if (dropdown) {
      dropdown.classList.toggle('hidden');
      btn.classList.toggle('open');
    }
  }

  function toggleReportsDropdown() {
    const dropdown = document.getElementById('admin-reports-dropdown');
    const btn = document.querySelectorAll('.admin-dropdown-btn')[2];
    if (dropdown) {
      dropdown.classList.toggle('hidden');
      btn.classList.toggle('open');
    }
  }

  function searchUsers(query) {
    const searchLower = query.toLowerCase();
    const filtered = _allUsers.filter(u => {
      return (u.name && u.name.toLowerCase().includes(searchLower)) ||
             (u.email && u.email.toLowerCase().includes(searchLower)) ||
             (u.phone && u.phone.toLowerCase().includes(searchLower));
    });
    renderUserList(filtered);
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
    await Promise.all([loadStats(), loadUsers(), loadMedia(), loadReports()]);
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
      _mediaFiles = data.files || [];
      renderMediaList();
    } catch (e) {
      console.error('[Admin] Error loading media:', e);
    }
  }

  function toggleMediaDropdown() {
    const dropdown = document.getElementById('admin-media-dropdown');
    const btn = document.querySelector('.admin-dropdown-btn');
    if (dropdown) {
      dropdown.classList.toggle('hidden');
      btn.classList.toggle('open');
    }
  }

  function filterMedia(filter) {
    _currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderMediaList();
  }

  function renderMediaList() {
    const el = document.getElementById('admin-media-list');
    if (!el) {
      console.error('[Admin] admin-media-list element not found');
      return;
    }
    if (!_mediaFiles.length) {
      el.innerHTML = '<p style="padding:1rem;color:var(--text-muted);">No hay archivos compartidos</p>';
      return;
    }

    const filtered = _mediaFiles.filter(f => {
      if (_currentFilter === 'all') return true;
      const ext = f.name.split('.').pop().toLowerCase();
      if (_currentFilter === 'image') return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
      if (_currentFilter === 'video') return ['mp4', 'webm', 'mov'].includes(ext);
      if (_currentFilter === 'document') return ['pdf', 'doc', 'docx', 'txt', 'zip'].includes(ext);
      return true;
    });

    if (!filtered.length) {
      el.innerHTML = '<p style="padding:1rem;color:var(--text-muted);">No hay archivos de este tipo</p>';
      return;
    }

    el.innerHTML = filtered.map(f => {
      const ext = f.name.split('.').pop().toUpperCase();
      const typeIcon = ext === 'JPG' || ext === 'JPEG' || ext === 'PNG' || ext === 'GIF' || ext === 'WEBP' ? '🖼️' :
                      ext === 'MP4' || ext === 'WEBM' || ext === 'MOV' ? '🎬' :
                      ext === 'MP3' || ext === 'WAV' || ext === 'OGG' ? '🎵' : '📄';
      const dateStr = f.message_created ? new Date(f.message_created).toLocaleString() : new Date(f.created).toLocaleString();
      return `
      <div class="admin-media-item" oncontextmenu="Admin.showMediaContextMenu(event, '${f.url}', '${f.name}')">
        <div class="media-info">
          <div class="media-name">${typeIcon} ${f.name}</div>
          <div class="media-meta">${(f.size/1024).toFixed(1)} KB • ${dateStr}</div>
          <div class="media-meta">Enviado por: ${_esc(f.sender_name || 'Desconocido')}</div>
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
  }

  function showMediaContextMenu(event, url, name) {
    event.preventDefault();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
      <div class="context-menu-item" onclick="Admin.openFileLocation('${url}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
        Abrir ubicación
      </div>
      <div class="context-menu-item" onclick="Admin.copyFileUrl('${url}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        Copiar URL
      </div>
    `;
    menu.style.position = 'fixed';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    document.body.appendChild(menu);

    const closeMenu = () => {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  function openFileLocation(url) {
    window.open(url, '_blank');
  }

  function copyFileUrl(url) {
    navigator.clipboard.writeText(window.location.origin + url).then(() => {
      Toast.show('URL copiada al portapapeles', 'success');
    });
  }

  async function loadReports() {
    if (!_isAdmin()) return;
    const el = document.getElementById('admin-reports-list');
    if (!el) return;
    try {
      const res  = await fetch('/api/reports', { headers: _h() });
      const data = await res.json();
      if (!data.ok) { el.innerHTML = '<p class="admin-empty">Error al cargar denuncias.</p>'; return; }
      if (!data.reports.length) { el.innerHTML = '<p class="admin-empty">No hay denuncias registradas.</p>'; return; }
      el.innerHTML = data.reports.map(r => `
        <div class="report-item">
          <div class="report-item-header">
            <span class="report-badge">🚨 Denuncia</span>
            <span class="report-date">${new Date(r.created_at).toLocaleString('es-MX')}</span>
          </div>
          <div class="report-item-body">
            <div class="report-row"><strong>Emisor:</strong> ${_esc(r.emitter_name  || '—')}</div>
            <div class="report-row"><strong>Receptor:</strong> ${_esc(r.receiver_name || '—')}</div>
            <div class="report-row"><strong>Reportado por:</strong> ${_esc(r.reporter_name || '—')}</div>
            <div class="report-row report-desc"><strong>Descripción:</strong><br>${_esc(r.description || '—')}</div>
            ${r.evidence_url ? `<div class="report-row"><strong>Evidencia:</strong><br>
              <a href="${r.evidence_url}" target="_blank"><img src="${r.evidence_url}" class="report-evidence-thumb"></a></div>` : ''}
            <div class="report-row" style="margin-top:.6rem">
              <button class="btn btn-sm" onclick="Admin.openReportDetail('${r.id}', '${_esc(r.emitter_name || '')}', '${r.emitter_id || ''}', '${_esc(r.reporter_name || '')}', '${r.reporter_id || ''}')">
                🔍 Ver detalle
              </button>
            </div>
          </div>
        </div>`).join('');
    } catch (e) {
      el.innerHTML = '<p class="admin-empty">Error de red.</p>';
    }
  }

  function openReportDetail(reportId, emitterName, emitterId, reporterName, reporterId) {
    const ov = document.createElement('div');
    ov.className = 'report-overlay';
    ov.innerHTML = `
      <div class="report-card glass-card report-detail-card">
        <button class="report-close" onclick="this.closest('.report-overlay').remove()">×</button>
        <h3 class="report-title">🔍 Detalle de denuncia</h3>
        <div class="report-detail-body">
          <div class="report-row"><strong>Denunciado:</strong> ${_esc(emitterName || '—')}</div>
          <div class="report-row"><strong>Reportado por:</strong> ${_esc(reporterName || '—')}</div>
          <div class="report-detail-section">
            <h4 class="report-detail-subtitle">⏱️ Bloquear temporalmente</h4>
            <div class="block-time-buttons">
              <button class="btn btn-sm block-time-btn" onclick="Admin.blockTemp('${emitterId}', 30)">30 min</button>
              <button class="btn btn-sm block-time-btn" onclick="Admin.blockTemp('${emitterId}', 120)">2 horas</button>
              <button class="btn btn-sm block-time-btn" onclick="Admin.blockTemp('${emitterId}', 300)">5 horas</button>
              <button class="btn btn-sm block-time-btn" onclick="Admin.blockTemp('${emitterId}', 1440)">24 horas</button>
            </div>
          </div>
          <div class="report-detail-section">
            <h4 class="report-detail-subtitle">🗑️ Eliminar usuario</h4>
            <button class="btn btn-sm block-btn-danger" onclick="Admin.deleteReportedUser('${emitterId}', '${_esc(emitterName || '')}')">Eliminar usuario denunciado</button>
          </div>
          <div class="report-detail-section">
            <h4 class="report-detail-subtitle">💬 Enviar mensaje</h4>
            <div class="report-msg-actions">
              <button class="btn btn-sm" onclick="Admin.openMsgModal('${reporterId}', '${_esc(reporterName || '')}')">Al denunciante</button>
              <button class="btn btn-sm" onclick="Admin.openMsgModal('${emitterId}', '${_esc(emitterName || '')}')">Al denunciado</button>
            </div>
          </div>
          <div class="report-detail-section">
            <h4 class="report-detail-subtitle">⚠️ Mensaje de advertencia</h4>
            <textarea id="report-warning-message" class="admin-settings-textarea" rows="3" placeholder="Mensaje de advertencia para el perfil del usuario..."></textarea>
            <button id="report-activate-warning" class="btn btn-sm" style="margin-top:.5rem">Activar advertencia</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(ov);
    /* Cargar warning_message actual */
    fetch('/api/admin/settings').then(r => r.json()).then(data => {
      if (data.ok && data.settings.warning_message) {
        ov.querySelector('#report-warning-message').value = data.settings.warning_message;
      }
    }).catch(() => {});
    ov.querySelector('#report-activate-warning').onclick = async () => {
      const msg = ov.querySelector('#report-warning-message').value.trim();
      if (!msg) { Notifications.error('Escribe un mensaje de advertencia'); return; }
      const btn = ov.querySelector('#report-activate-warning');
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        await fetch('/api/admin/settings', {
          method: 'POST',
          headers: _h(),
          body: JSON.stringify({ warning_message: msg })
        });
        await fetch(`/api/admin/users/${emitterId}/warning`, {
          method: 'PATCH',
          headers: _h(),
          body: JSON.stringify({ active: true })
        });
        btn.disabled = false; btn.textContent = 'Activar advertencia';
        Notifications.success('Advertencia activada');
      } catch (e) { btn.disabled = false; btn.textContent = 'Activar advertencia'; Notifications.error('Error de red'); }
    };
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  }

  async function blockTemp(emitterId, minutes) {
    if (!emitterId) return;
    const expiresAt = new Date(Date.now() + minutes * 60000).toISOString();
    try {
      const res  = await fetch('/api/blocks', {
        method: 'POST',
        headers: _h(),
        body: JSON.stringify({ blocked_id: emitterId, expires_at: expiresAt })
      });
      const data = await res.json();
      if (data.ok) {
        Notifications.success(`Usuario bloqueado por ${minutes} minutos`);
        document.querySelector('.report-overlay')?.remove();
      } else {
        Notifications.error('Error: ' + (data.msg || 'No se pudo bloquear'));
      }
    } catch (e) { Notifications.error('Error de red'); }
  }

  async function deleteReportedUser(userId, name) {
    if (!confirm(`¿Eliminar al usuario "${name}"? Esta acción es irreversible.`)) return;
    try {
      const res  = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE', headers: _h() });
      const data = await res.json();
      if (data.ok) {
        Notifications.success('Usuario eliminado');
        document.querySelector('.report-overlay')?.remove();
        loadReports();
      } else {
        Notifications.error('Error: ' + (data.msg || 'No se pudo eliminar'));
      }
    } catch (e) { Notifications.error('Error de red'); }
  }

  function openMsgModal(userId, name) {
    if (!userId) { Notifications.error('ID de usuario no disponible'); return; }
    const ov = document.createElement('div');
    ov.className = 'report-overlay';
    ov.innerHTML = `
      <div class="report-card glass-card">
        <button class="report-close" onclick="this.closest('.report-overlay').remove()">×</button>
        <h3 class="report-title">💬 Mensaje a ${_esc(name || 'usuario')}</h3>
        <div class="report-field">
          <textarea id="admin-msg-content" class="report-textarea" placeholder="Escribe tu mensaje..."></textarea>
        </div>
        <div class="report-field" style="margin-top:.5rem">
          <label style="display:flex;align-items:center;gap:.4rem;font-size:.85rem;cursor:pointer">
            <input type="checkbox" id="admin-activate-warning">
            Activar advertencia en el perfil del usuario
          </label>
        </div>
        <button id="admin-msg-send" class="btn report-submit-btn">Enviar</button>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#admin-msg-send').onclick = async () => {
      const content = ov.querySelector('#admin-msg-content').value.trim();
      if (!content) { Notifications.error('Escribe un mensaje'); return; }
      const activateWarning = ov.querySelector('#admin-activate-warning').checked;
      const btn = ov.querySelector('#admin-msg-send');
      btn.disabled = true; btn.textContent = 'Enviando…';
      try {
        const res  = await fetch('/api/admin/messages', {
          method: 'POST',
          headers: _h(),
          body: JSON.stringify({ receiver_id: userId, content, type: 'text' })
        });
        const data = await res.json();
        if (data.ok && activateWarning) {
          await fetch(`/api/admin/users/${userId}/warning`, {
            method: 'PATCH',
            headers: _h(),
            body: JSON.stringify({ active: true })
          });
        }
        ov.remove();
        if (data.ok) {
          Notifications.success('Mensaje enviado' + (activateWarning ? ' y advertencia activada' : ''));
        } else {
          Notifications.error('Error: ' + (data.msg || 'No se pudo enviar'));
        }
      } catch (e) { ov.remove(); Notifications.error('Error de red'); }
    };
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  }

  function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  async function loadInterfaceSettings() {
    const el = document.getElementById('admin-interface-settings');
    if (!el) return;
    el.innerHTML = `
      <button class="btn btn-sm" onclick="Admin.openRegisterModalEdit()">✏️ Editar modal de registro</button>
    `;
  }

  function openRegisterModalEdit() {
    const ov = document.createElement('div');
    ov.className = 'report-overlay';
    ov.innerHTML = `
      <div class="report-card glass-card">
        <button class="report-close" onclick="this.closest('.report-overlay').remove()">×</button>
        <h3 class="report-title">✏️ Editar modal de registro</h3>
        <div class="report-field">
          <label class="admin-settings-label">Título del modal de registro:</label>
          <input type="text" id="register-modal-title" class="admin-settings-input" placeholder="🌸 Bienvenidas a Zona Segura"/>
        </div>
        <div class="report-field">
          <label class="admin-settings-label">Texto/instrucciones del modal de registro:</label>
          <textarea id="register-modal-text" class="admin-settings-textarea" rows="6" placeholder="Escribe las instrucciones que aparecerán en el modal de registro..."></textarea>
        </div>
        <button id="save-register-modal" class="btn report-submit-btn">Guardar</button>
      </div>`;
    document.body.appendChild(ov);
    /* Cargar register_message y register_title actuales */
    fetch('/api/admin/settings', { headers: _h() }).then(r => r.json()).then(data => {
      console.log('[Admin] Settings response:', data);
      if (data.ok) {
        if (data.settings.register_message) {
          ov.querySelector('#register-modal-text').value = data.settings.register_message;
        }
        if (data.settings.register_title) {
          ov.querySelector('#register-modal-title').value = data.settings.register_title;
        }
      } else {
        console.log('[Admin] No settings found in response');
      }
    }).catch(e => console.error('[Admin] Error loading settings:', e));
    ov.querySelector('#save-register-modal').onclick = async () => {
      const title = ov.querySelector('#register-modal-title').value.trim();
      const msg = ov.querySelector('#register-modal-text').value.trim();
      const btn = ov.querySelector('#save-register-modal');
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        const r = await fetch('/api/admin/settings', {
          method: 'POST',
          headers: _h(),
          body: JSON.stringify({ register_title: title, register_message: msg })
        });
        const d = await r.json();
        ov.remove();
        if (d.ok) Notifications.success('Modal de registro actualizado');
        else Notifications.error('Error: ' + (d.msg || 'No se pudo guardar'));
      } catch (e) { ov.remove(); Notifications.error('Error de red'); }
    };
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  }

  return { init, loadStats, loadUsers, toggleUsersDropdown, searchUsers, toggleBlock, deleteUser, setRole, exportUsers, loadMedia, toggleMediaDropdown, filterMedia, showMediaContextMenu, openFileLocation, copyFileUrl, loadReports, toggleReportsDropdown, openReportDetail, blockTemp, deleteReportedUser, openMsgModal, loadInterfaceSettings, openRegisterModalEdit };
})();

window.Admin = Admin;
