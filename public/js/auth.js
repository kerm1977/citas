/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️⚠️⚠️  AUTH.JS — BLINDADO — NO MODIFICAR  ⚠️⚠️⚠️                           ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  ── _saveSession(data) — NO ALTERAR ───────────────────────────────────── ║
 * ║  Guarda SIEMPRE en sessionStorage. Guarda en localStorage solo si         ║
 * ║  data._remember === true (checkbox "recuérdame").                         ║
 * ║  Clave fija: '_chatapp_session'. NO cambiar esta clave.                   ║
 * ║                                                                           ║
 * ║  ── initRegisterForm() — NO ALTERAR LLAMADA A initForRegistration ──────── ║
 * ║  Llama ModerationSystem.initForRegistration() (NO init()).                ║
 * ║  init() ejecutaría _checkUserStatus() y mostraría modales incorrectos.    ║
 * ║                                                                           ║
 * ║  ── Flujo de registro → moderación — NO ALTERAR ───────────────────────── ║
 * ║  1. Usuario llena formulario → POST /api/auth/register                   ║
 * ║  2. Servidor emite moderation:new_user a todos los sockets               ║
 * ║  3. Cliente recibe { ok, token, user: { is_approved: 0 } }               ║
 * ║  4. _saveSession() + ModerationSystem.setJustRegistered() +              ║
 * ║     showApprovalWaiting()                                                 ║
 * ║  NO alterar este orden de pasos.                                          ║
 * ║                                                                           ║
 * ║  ── initLoginForm() — NO ALTERAR ──────────────────────────────────────── ║
 * ║  Guarda sesión y redirige a /#chat. Si is_approved=0 → moderación        ║
 * ║  lo bloquea en chat.js onConnect. NO bloquear aquí.                      ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
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

  return { login, register, recover, loadSession, clearSession };
})();

window.Auth = Auth;
/* ── Los handlers de formularios están en auth-forms.js (se carga después) ── */
