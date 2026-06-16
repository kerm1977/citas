/* ── SPA Router ──────────────────────────────────────────────── */
'use strict';

const Router = (() => {
  const SECTIONS = {
    login:    'sec-login',
    register: 'sec-register',
    recover:  'sec-recover',
    chat:     'sec-chat',
    account:  'sec-account',
    admin:    'sec-admin'
  };
  const AUTH_ROUTES    = ['chat', 'account', 'admin'];
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
    if (info) info.innerHTML = `
      <div class="acct-section">
        <div class="acct-info-row">Nombre: <span>${_esc(u.name)}</span></div>
        <div class="acct-info-row">Email: <span>${_esc(u.email)}</span></div>
        <div class="acct-info-row">Teléfono: <span>${_esc(u.phone||'-')}</span></div>
        <div class="acct-info-row">Rol: <span>${_esc(u.role)}</span></div>
      </div>`;
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
      const message = data.ok ? data.message : '';
      const ov = document.createElement('div');
      ov.className = 'report-overlay';
      ov.innerHTML = `
        <div class="report-card glass-card">
          <button class="report-close" onclick="this.closest('.report-overlay').remove()">×</button>
          <h3 class="report-title">🌸 Bienvenidas a Zona Segura</h3>
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

  function init() {
    window.onpopstate = (e) => { if (e.state?.route) go(e.state.route); };
    const session = Auth.loadSession();
    const path    = location.pathname.replace('/', '') || 'login';
    const route   = SECTIONS[path] ? path : (session ? 'chat' : 'login');
    go(route);
  }

  return { go, init, showRegisterModal };
})();

window.Router = Router;
