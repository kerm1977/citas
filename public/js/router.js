/* ── SPA Router ──────────────────────────────────────────────── */
'use strict';

const Router = (() => {
  const SECTIONS = {
    login:        'sec-login',
    register:     'sec-register',
    recover:      'sec-recover',
    chat:         'sec-chat',
    account:      'sec-account',
    'edit-profile': 'sec-edit-profile',
    admin:        'sec-admin',
    media:        'sec-media'
  };
  const AUTH_ROUTES    = ['chat', 'account', 'edit-profile', 'admin', 'media'];
  const NO_AUTH_ROUTES = ['login', 'register', 'recover'];
  let _current = null;

  function go(route) {
    const session = window._session;
    if (AUTH_ROUTES.includes(route) && !session) { go('login'); return; }
    if (NO_AUTH_ROUTES.includes(route) && session) { go('chat'); return; }

    /* Hide ALL sections first, then show target */
    Object.values(SECTIONS).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    _show(route);
    _current = route;
    history.pushState({ route }, '', '/' + (route === 'login' ? '' : route));
    _onEnter(route);
  }

  function _hide(route) {
    if (!route) return;
    const id = SECTIONS[route];
    const el = id && document.getElementById(id);
    if (el) el.classList.add('hidden');
  }

  function _show(route) {
    const id = SECTIONS[route];
    const el = id && document.getElementById(id);
    if (el) el.classList.remove('hidden');
  }

  function _onEnter(route) {
    if (route === 'login')    Auth.initLoginForm();
    if (route === 'register') Auth.initRegisterForm();
    if (route === 'recover')  Auth.initRecoverForm();
    if (route === 'edit-profile') initEditProfile();
    if (route === 'chat') {
      /* Reset mobile sidebar state when entering chat */
      document.getElementById('chat-sidebar')?.classList.remove('mobile-hidden');
      document.getElementById('chat-empty')?.classList.remove('hidden');
      document.getElementById('chat-window')?.classList.add('hidden');
      document.getElementById('chat-messages')?.querySelectorAll('*').forEach(el => el.remove());

      Chat.connect();
      Chat.loadUsers();
      Chat.initSearch();
      Admin.init();
    }
    if (route === 'admin') {
      Admin.loadStats();
      Admin.loadUsers();
      Admin.loadMedia();
      Admin.loadReports?.();
      Admin.loadInterfaceSettings?.();
    }
    if (route === 'media') {
      MediaGallery.loadMedia();
    }
    if (route === 'account') { _renderAccount(); window.BlockManager?.loadBlockedUsers(); }
  }

  async function _renderAccount() {
    const u    = window._session?.user;
    if (!u) return;
    const zone = document.getElementById('acct-avatar-zone');
    const info = document.getElementById('acct-info');
    if (zone) {
      zone.innerHTML = AvatarEditor.buildHTML('acct-av', null);
      AvatarEditor.setDisplay('acct-av', u.avatar, u.name);
      window._avatarSaveCallback = async (dataUrl) => {
        AvatarEditor.setDisplay('acct-av', dataUrl);
        AvatarEditor.toggle('acct-av-editor');
        const blob = await _dataUrlToBlob(dataUrl);
        const fd   = new FormData(); fd.append('avatar', blob, 'avatar.jpg');
        const res  = await fetch('/api/auth/avatar', {
          method:'PUT',
          headers: { Authorization: 'Bearer ' + window._session?.token },
          body: fd
        });
        const data = await res.json();
        if (data.ok) { window._session.user.avatar = data.avatar; Toast.show('Foto actualizada','success'); }
      };
    }
    if (info) {
      const fields = [];
      
      if (u.name && u.name.trim()) {
        fields.push(`
          <div class="acct-info-row">
            <div class="acct-info-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              Nombre
            </div>
            <div class="acct-info-value">${_esc(u.name)}</div>
          </div>`);
      }
      
      if (u.email && u.email.trim()) {
        fields.push(`
          <div class="acct-info-row">
            <div class="acct-info-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              Email
            </div>
            <div class="acct-info-value">${_esc(u.email)}</div>
          </div>`);
      }
      
      if (u.phone && u.phone.trim() && u.phone.length > 5) {
        fields.push(`
          <div class="acct-info-row">
            <div class="acct-info-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              Teléfono
            </div>
            <div class="acct-info-value">${_esc(u.phone)}</div>
          </div>`);
      }
      
      if (u.role && u.role.trim()) {
        fields.push(`
          <div class="acct-info-row">
            <div class="acct-info-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              Rol
            </div>
            <div class="acct-info-value">${_esc(u.role)}</div>
          </div>`);
      }
      
      info.innerHTML = `<div class="acct-section">${fields.join('')}</div>`;
    }
    /* Mostrar advertencia si warning_active = 1 */
    if (u.warning_active) {
      try {
        const res  = await fetch('/api/admin/settings');
        const data = await res.json();
        if (data.ok && data.settings.warning_message) {
          const warningEl = document.createElement('div');
          warningEl.className = 'acct-warning-box';
          warningEl.innerHTML = `<div class="acct-warning-title">⚠️ Advertencia</div><div class="acct-warning-text">${_esc(data.settings.warning_message)}</div>`;
          document.querySelector('.auth-card')?.appendChild(warningEl);
        }
      } catch (e) { /* silencioso */ }
    }
  }

  function _dataUrlToBlob(d) {
    const [h, b64] = d.split(',');
    const mime = h.match(/:(.*?);/)[1];
    const bin  = atob(b64);
    const arr  = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  /* ═════════════════════════════════════════════════════════════════════════════
   *  ⚠️ BLINDADO — showRegisterModal es la ÚNICA forma de mostrar el mensaje de registro
   *  ────────────────────────────────────────────────────────────────────────────────
   *  El mensaje de registro SOLO debe aparecer en este modal al presionar "Regístrate".
   *  NUNCA debe aparecer incrustado en el formulario de registro (sec-register).
   *  NO agregar _loadRegisterMessage() en _onEnter('register').
   *  NO agregar div#register-modal-message en el HTML del formulario.
   *  ═════════════════════════════════════════════════════════════════════════════ */
  async function showRegisterModal() {
    /* Guard para evitar duplicados - eliminar cualquier modal existente */
    document.querySelectorAll('.report-overlay').forEach(el => {
      if (el.querySelector('.register-info-text')) el.remove();
    });

    try {
      const res = await fetch('/api/public/register-message');
      const data = await res.json();
      console.log('[Router] Register message response:', data);
      const message = data.ok ? data.message : '';
      const title = data.ok ? (data.title || '🌸 Bienvenidas a Zona Segura') : '🌸 Bienvenidas a Zona Segura';
      console.log('[Router] Message to display:', message);
      console.log('[Router] Title to display:', title);
      const ov = document.createElement('div');
      ov.className = 'report-overlay';
      ov.innerHTML = `
        <div class="report-card glass-card">
          <button class="report-close" onclick="this.closest('.report-overlay').remove()">×</button>
          <h3 class="report-title">${_esc(title)}</h3>
          <div class="report-field">
            <div class="register-info-text">${_esc(message)}</div>
          </div>
          <button id="accept-register" class="btn report-submit-btn">Aceptar y continuar</button>
        </div>`;
      document.body.appendChild(ov);
      ov.querySelector('#accept-register').onclick = () => {
        ov.remove();
        go('register');
      };
      ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    } catch (e) {
      go('register');
    }
  }

  function showEditProfile() {
    go('edit-profile');
  }

  function initEditProfile() {
    const u = window._session?.user;
    if (!u) return;

    // Cargar datos en el formulario
    document.getElementById('e-name').value = u.name || '';
    document.getElementById('e-email').value = u.email || '';
    
    // Cargar teléfono si existe
    if (u.phone) {
      const phoneParts = u.phone.split(' ');
      if (phoneParts.length >= 2) {
        document.getElementById('e-country').value = phoneParts[0];
        document.getElementById('e-phone').value = phoneParts[1];
      } else {
        document.getElementById('e-phone').value = u.phone;
      }
    }

    // Inicializar avatar editor
    const zone = document.getElementById('edit-avatar-zone');
    if (zone) {
      zone.innerHTML = AvatarEditor.buildHTML('edit-av', null);
      AvatarEditor.setDisplay('edit-av', u.avatar, u.name);
    }

    // Inicializar selector de países
    PhoneSelector.init('e-country');

    // Manejar envío del formulario
    const form = document.getElementById('form-edit-profile');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await saveProfile();
      };
    }
  }

  async function saveProfile() {
    const name = document.getElementById('e-name').value.trim();
    const email = document.getElementById('e-email').value.trim();
    const country = document.getElementById('e-country').value;
    const phone = document.getElementById('e-phone').value.trim();

    // Validaciones básicas
    if (!name) {
      Toast.show('El nombre es requerido', 'error');
      return;
    }
    if (!email || !Validate.email(email)) {
      Toast.show('Email inválido', 'error');
      return;
    }

    // Construir teléfono completo si se proporcionó
    const fullPhone = phone ? `${country} ${phone}` : '';

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + window._session?.token 
        },
        body: JSON.stringify({ name, email, phone: fullPhone })
      });

      const data = await res.json();
      if (data.ok) {
        // Actualizar sesión
        window._session.user.name = name;
        window._session.user.email = email;
        window._session.user.phone = fullPhone;
        Auth.saveSession(window._session);
        
        Toast.show('Perfil actualizado', 'success');
        go('account');
      } else {
        Toast.show(data.msg || 'Error al actualizar perfil', 'error');
      }
    } catch (e) {
      Toast.show('Error de red', 'error');
    }
  }

  function init() {
    window.onpopstate = (e) => { if (e.state?.route) go(e.state.route); };
    const session = Auth.loadSession();
    const path    = location.pathname.replace('/', '') || 'login';
    const route   = SECTIONS[path] ? path : (session ? 'chat' : 'login');
    go(route);
  }

  return { go, init, showRegisterModal, showEditProfile };
})();

window.Router = Router;
