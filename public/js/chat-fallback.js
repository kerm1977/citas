/* ⚠️ CHAT-FALLBACK — overlay de emergencia si ModerationSystem no carga */
'use strict';

window._showFallbackApprovalBlock = function() {
    if (document.getElementById('fallback-approval-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'fallback-approval-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(10,10,30,0.97);
      z-index: 999999; display: flex; align-items: center; justify-content: center;
      flex-direction: column; text-align: center; color: white; font-family: sans-serif;
    `;
    overlay.innerHTML = `
      <div style="font-size:3rem; margin-bottom:1rem;">⏳</div>
      <h2 style="color:#e94560; margin-bottom:0.5rem;">Cuenta en Revisión</h2>
      <p style="color:#aaa; max-width:350px; line-height:1.6;">
        Tu cuenta está siendo revisada por nuestras moderadoras.<br>
        Por favor espera mientras te contactan para verificación.
      </p>
      <div style="margin-top:1.5rem; color:#e94560; font-size:0.9rem;">🕐 Esperando aprobación...</div>
    `;
    document.body.appendChild(overlay);
};
