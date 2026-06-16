/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  AUTH-FORMS — handlers de formularios UI — NO MODIFICAR                 ║
 * ║  Requiere: auth.js cargado primero (window.Auth debe existir).          ║
 * ║  ⚠️ initRegisterForm llama ModerationSystem.initForRegistration() NO init()║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
'use strict';

(function () {
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
      const res = await Auth.login(email, password, document.getElementById('l-remember').checked);
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
    /* ⚠️ CRÍTICO — initForRegistration() NO init() — NO cambiar */
    if (window.ModerationSystem) ModerationSystem.initForRegistration();
    window.addEventListener('termsRejected', () => { Router.go('login'); });

    form.onsubmit = async (e) => {
      e.preventDefault();
      const fields = {
        name:        document.getElementById('r-name').value,
        email:       document.getElementById('r-email').value,
        countryCode: document.getElementById('r-country').value,
        phone:       document.getElementById('r-phone').value,
        password:    document.getElementById('r-pass').value,
        password2:   document.getElementById('r-pass2').value
      };
      if (!Validate.register(fields)) return;
      await _proceedWithRegistration(fields, window._regAvatarDataUrl);
    };
    _initEyeButtons();
  }

  async function _proceedWithRegistration(fields, avatar) {
    const btn = document.getElementById('register-btn');
    btn.disabled = true; btn.textContent = 'Creando cuenta...';
    const res = await Auth.register(fields, avatar);
    btn.disabled = false; btn.textContent = 'Crear cuenta';
    if (res.ok) {
      Toast.show('Cuenta creada. Llave descargada.', 'success');
      if (res.pending_approval && window.ModerationSystem) {
        ModerationSystem.setJustRegistered();
        ModerationSystem.showApprovalWaiting();
        if (window.ChatSocket?.getSocket) {
          const socket = ChatSocket.getSocket();
          if (socket) socket.emit('moderation:new_registration', { id: res.user.id, name: res.user.name, email: res.user.email });
        }
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
          const res = await Auth.recover(obj, pass);
          if (res.ok) { Toast.show('Contraseña actualizada', 'success'); Router.go('login'); }
          else Toast.show(res.msg || 'Llave inválida', 'error');
        } catch { Toast.show('Archivo inválido', 'error'); }
      };
      reader.readAsText(file);
    };
    _initEyeButtons();
  }

  Object.assign(window.Auth, { initLoginForm, initRegisterForm, initRecoverForm });
})();
