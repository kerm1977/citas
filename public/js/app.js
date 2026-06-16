/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️⚠️⚠️  APP.JS — BLINDADO — NO MODIFICAR  ⚠️⚠️⚠️                           ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  ── Toast — GLOBAL — NO ALTERAR ─────────────────────────────────────── ║
 * ║  Toast.show(msg, type, duration). Types: 'info', 'error', 'success'.     ║
 * ║  Usa #toast-container del HTML. NO crear otro sistema de notificaciones.  ║
 * ║                                                                           ║
 * ║  ── INTERCEPTOR GLOBAL DE FETCH — JAMÁS ELIMINAR ──────────────────────── ║
 * ║  Reemplaza window.fetch para interceptar respuestas 401.                  ║
 * ║  Si la respuesta es 401 → limpia sesión + redirige a /#login.             ║
 * ║  Eliminar esto permite sesiones expiradas sin logout automático.          ║
 * ║  NO envolver en try/catch externo que suprima errores de red.             ║
 * ║                                                                           ║
 * ║  ── window._session — FUENTE DE VERDAD DEL CLIENTE ────────────────────── ║
 * ║  Se carga de sessionStorage ?? localStorage con clave '_chatapp_session'. ║
 * ║  Contiene: { token, user: { id, name, email, role, is_approved }, ... }   ║
 * ║  El servidor es la FUENTE DE VERDAD REAL (verifica en cada request).      ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
'use strict';

/* ── Toast utility (global) ─────────────────────────────────── */
const Toast = (() => {
  let _container = null;
  function show(msg, type = 'info', duration = 3000) {
    if (!_container) {
      _container = document.getElementById('toast-container');
      if (!_container) return;
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    _container.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 350);
    }, duration);
  }
  return { show };
})();
window.Toast = Toast;

/* ── Wire up nav buttons ─────────────────────────────────────── */
function _wireNav() {
  const btnLogout  = document.getElementById('btn-logout');
  const btnAccount = document.getElementById('btn-account');
  const btnAdmin   = document.getElementById('btn-admin-panel');

  if (btnLogout) btnLogout.onclick = () => {
    Chat.disconnect();
    Auth.clearSession();
    Router.go('login');
    Toast.show('Sesión cerrada', 'info');
  };

  if (btnAccount) btnAccount.onclick = () => Router.go('account');
  if (btnAdmin)   btnAdmin.onclick   = () => Router.go('admin');
}

/* ── WebGPU availability check ───────────────────────────────── */
async function _checkWebGPU() {
  if (!navigator.gpu) { console.info('[WebGPU] Not available'); return false; }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter)  { console.info('[WebGPU] No adapter'); return false; }
    console.info('[WebGPU] Available ✅');
    window._gpuAdapter = adapter;
    return true;
  } catch { return false; }
}

/* ── MobileNetV4 stub ────────────────────────────────────────── */
/* Requires: /js/mobilenet.js + model files in /models/ */
function _initMobileNet() {
  if (typeof MobileNet !== 'undefined') {
    console.info('[MobileNet] Loaded');
  } else {
    console.info('[MobileNet] Not loaded (optional — add /js/mobilenet.js)');
  }
}

/* ── DOM Ready ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  AntiFreeze.init();
  _wireNav();
  Router.init();
  _checkWebGPU();
  _initMobileNet();

  /* Initialize SoundEffects immediately (HTML Audio Elements don't require user interaction) */
  SoundEffects?.init();

  /* Prevent default form submissions at document level */
  document.addEventListener('submit', (e) => {
    const handled = ['form-login','form-register','form-recover','chat-form'];
    if (handled.some(id => e.target.id === id)) e.preventDefault();
  });

  console.log('[ChatApp] ✅ Ready');
});

/* ⚠️ CRÍTICO — NO MODIFICAR — INTERCEPTOR GLOBAL FETCH
 * Captura cualquier respuesta 401 de /api/* y limpia la sesión automáticamente.
 * Redirige al login sin intervención del usuario. NO eliminar este bloque. */
/* ── Interceptor global fetch: auto-logout en 401 ───────────── */
(function () {
  const _origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await _origFetch(...args);
    if (res.status === 401) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
      if (url.includes('/api/')) {
        console.warn('[Auth] 401 — sesión expirada, redirigiendo a login');
        sessionStorage.clear();
        localStorage.clear();
        window._session = null;
        if (window.Router) Router.go('login');
        return new Response(JSON.stringify({ ok: false, msg: 'Sesión expirada' }), {
          status: 401, headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    return res;
  };
})();

/* ── Global error handler ────────────────────────────────────── */
window.onerror = (msg, _src, _line, _col, err) => {
  console.error('[App Error]', msg, err);
  Toast.show('Error inesperado: ' + msg.slice(0, 60), 'error');
};

window.onunhandledrejection = (e) => {
  console.error('[Unhandled Promise]', e.reason);
};
