/* ── Authentication (login / register / recover) ─────────────── */
'use strict';

const Auth = (() => {
  const _SESSION_KEY = '_chatapp_session';

  function _saveSession(data) {
    const payload = JSON.stringify(data);
    try { sessionStorage.setItem(_SESSION_KEY, payload); } catch {}
    if (data._remember) {
      try { localStorage.setItem(_SESSION_KEY, payload); } catch {}
    }
    window._session = data;
  }

  function loadSession() {
    try {
      const s = sessionStorage.getItem(_SESSION_KEY) || localStorage.getItem(_SESSION_KEY);
      if (s) { window._session = JSON.parse(s); return window._session; }
    } catch {}
    return null;
  }

  function clearSession() {
    sessionStorage.removeItem(_SESSION_KEY);
    localStorage.removeItem(_SESSION_KEY);
    window._session = null;
  }

  async function login(email, password, remember) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.ok) _saveSession({ ...data, _remember: !!remember });
    return data;
  }

  async function register(fields, avatarDataUrl) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const fd   = new FormData();
    fd.append('name',         fields.name.trim());
    fd.append('email',        fields.email.trim().toLowerCase());
    fd.append('phone',        fields.countryCode + fields.phone.trim());
    fd.append('password',     fields.password);
    fd.append('recoveryCode', code);

    if (avatarDataUrl) {
      const blob = await _dataUrlToBlob(avatarDataUrl);
      fd.append('avatar', blob, 'avatar.jpg');
    }

    const res  = await fetch('/api/auth/register', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.ok) {
      _saveSession(data);
      await Backup.downloadRecoveryKey(code, fields.email.trim().toLowerCase());
    }
    return data;
  }

  async function recover(recoveryFileObj, newPassword) {
    /* Extract encrypted code string from the recovery JSON */
    const encCode = await CryptoLayer.readRecoveryFile(recoveryFileObj);
    const res     = await fetch('/api/auth/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recoveryCode: encCode, newPassword })
    });
    /* Server hashes and compares recovery_hash */
    return res.json();
  }

  function _dataUrlToBlob(dataUrl) {
    return new Promise(resolve => {
      const [header, base64] = dataUrl.split(',');
      const mime = header.match(/:(.*?);/)[1];
      const binary = atob(base64);
      const arr = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
      resolve(new Blob([arr], { type: mime }));
    });
  }

  /* ── UI Handlers ──────────────────────────────────────────── */
  function initLoginForm() {
    const form = document.getElementById('form-login');
    if (!form) return;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const email    = document.getElementById('l-email').value;
      const password = document.getElementById('l-pass').value;
      if (!Validate.login({ email, password })) return;
      const btn = document.getElementById('login-btn');
      btn.disabled = true; btn.textContent = 'Ingresando...';
      const res = await login(email, password, document.getElementById('l-remember').checked);
      btn.disabled = false; btn.textContent = 'Ingresar';
      if (res.ok) { Router.go('chat'); }
      else Toast.show(res.msg || 'Error al iniciar sesión', 'error');
    };
    _initEyeButtons();
  }

  function initRegisterForm() {
    Validate.populateCountries('r-country');
    const form = document.getElementById('form-register');
    if (!form) return;
    const zone = document.getElementById('reg-avatar-zone');
    if (zone) {
      zone.innerHTML = AvatarEditor.buildHTML('reg-av', null);
      window._avatarSaveCallback = (dataUrl) => {
        AvatarEditor.setDisplay('reg-av', dataUrl);
        AvatarEditor.toggle('reg-av-editor');
        window._regAvatarDataUrl = dataUrl;
      };
    }
    
    /* ═════════════════════════════════════════════════════════════════════════════
     *  ⚠️  CRÍTICO — MODAL DE TÉRMINOS AL ENTRAR AL REGISTRO — NO MODIFICAR  ⚠️
     * ─────────────────────────────────────────────────────────────────────────────────
     *  Al entrar a la página de registro, mostrar inmediatamente el modal de 
     *  términos y condiciones. El formulario permanece visible detrás del modal.
     * ═════════════════════════════════════════════════════════════════════════════ */
    
    /* Mostrar modal de términos inmediatamente al entrar al registro */
    /* El modal es modal (bloquea interacción) pero el formulario queda visible detrás */
    if (window.ModerationSystem) {
      // Solo inicializa el modal de términos, SIN disparar checkUserStatus
      ModerationSystem.initForRegistration();
    }
    
    /* Al rechazar términos, volver al login */
    window.addEventListener('termsRejected', () => {
      Router.go('login');
    });
    
    /* Procesar registro al enviar formulario */
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fields = {
        name: document.getElementById('r-name').value,
        email: document.getElementById('r-email').value,
        countryCode: document.getElementById('r-country').value,
        phone: document.getElementById('r-phone').value,
        password: document.getElementById('r-pass').value,
        password2: document.getElementById('r-pass2').value
      };
      if (!Validate.register(fields)) return;
      
      await _proceedWithRegistration(fields, window._regAvatarDataUrl);
    };
    
    _initEyeButtons();
  }
  
  async function _proceedWithRegistration(fields, avatar) {
    const btn = document.getElementById('register-btn');
    btn.disabled = true; btn.textContent = 'Creando cuenta...';
    const res = await register(fields, avatar);
    btn.disabled = false; btn.textContent = 'Crear cuenta';
    
    if (res.ok) {
      Toast.show('Cuenta creada. Llave descargada.', 'success');
      
      /* ═════════════════════════════════════════════════════════════════════════════
       *  MODERACIÓN: Si el registro requiere aprobación, mostrar modal de espera
       * ═════════════════════════════════════════════════════════════════════════════ */
      if (res.pending_approval && window.ModerationSystem) {
        ModerationSystem.setJustRegistered();
        ModerationSystem.showApprovalWaiting();
        
        // Notificar a superusuarios del nuevo registro vía socket
        if (window.ChatSocket && window.ChatSocket.getSocket) {
          const socket = ChatSocket.getSocket();
          if (socket) {
            socket.emit('moderation:new_registration', {
              id: res.user.id,
              name: res.user.name,
              email: res.user.email
            });
          }
        }
        
        // Redirigir al chat pero con lista bloqueada
        Router.go('chat');
      } else {
        Router.go('chat');
      }
    } else {
      Toast.show(res.msg || 'Error al registrarse', 'error');
    }
  }

  function initRecoverForm() {
    const form = document.getElementById('form-recover');
    if (!form) return;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const file = document.getElementById('rec-file').files?.[0];
      const pass = document.getElementById('rec-pass').value;
      if (!file || !pass) { Toast.show('Completa todos los campos', 'warn'); return; }
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const obj = JSON.parse(ev.target.result);
          const res = await recover(obj, pass);
          if (res.ok) { Toast.show('Contraseña actualizada', 'success'); Router.go('login'); }
          else Toast.show(res.msg || 'Llave inválida', 'error');
        } catch { Toast.show('Archivo inválido', 'error'); }
      };
      reader.readAsText(file);
    };
    _initEyeButtons();
  }

  function _initEyeButtons() {
    document.querySelectorAll('.eye-btn').forEach(btn => {
      btn.onclick = () => {
        const target = document.getElementById(btn.dataset.target);
        if (!target) return;
        target.type = target.type === 'password' ? 'text' : 'password';
        btn.textContent = target.type === 'password' ? '👁' : '🙈';
      };
    });
  }

  return { login, register, recover, loadSession, clearSession,
           initLoginForm, initRegisterForm, initRecoverForm };
})();

window.Auth = Auth;
