/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  MODERATION-MODALS — modales de términos, aprobación, bienvenida, rechazo║
 * ║  Requiere: moderation-state.js (window._MS).                            ║
 * ║  ⚠️ IDs de modales son FIJOS — NO renombrar ninguno.                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
'use strict';

window._ModModals = (function () {
  const S = window._MS;

  function _initTermsModal() {
    if (document.getElementById('terms-modal-overlay')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="terms-modal-overlay" class="hidden">
        <div id="terms-modal">
          <h2>🌸 Bienvenidas a Zona Segura</h2>
          <div id="terms-content">
            <p class="highlight">Esta aplicación es únicamente para <strong>Mujeres</strong> sin importar su orientación Sexual.</p>
            <p>La aplicación no guarda registros, no solicita información personal y mucho menos información financiera.</p>
            <div class="warning">
              <p><strong>🔍 Verificación:</strong></p>
              <ul>
                <li>Se solicitarán pruebas por mujeres para verificar que son mujeres.</li>
                <li>No se permiten "micrófonos malos, cámaras malas".</li>
                <li>Solo ingresan las autorizadas por las mujeres moderadoras.</li>
              </ul>
            </div>
            <p>👨‍💻 <strong>Desarrollo:</strong> El único hombre con acceso es del grupo de desarrolladores, sin acceso a datos encriptados.</p>
            <p>🔒 <strong>Privacidad:</strong> Información totalmente encriptada. Imágenes van de persona a persona.</p>
            <p>⚠️ <strong>Responsabilidad:</strong> Si estás aquí lo haces por tu propia voluntad.</p>
            <p>🛡️ <strong>Moderación:</strong> Las mujeres en el chat denuncian anomalías y material ofensivo.</p>
            <p>💝 <strong>Donaciones:</strong> Solicitamos donaciones a partir de $2 USD o ₡1000, pero no por el momento.</p>
          </div>
          <div id="terms-buttons">
            <button id="btn-reject-terms">No Acepto</button>
            <button id="btn-accept-terms">Acepto ✓</button>
          </div>
        </div>
      </div>`);
    document.getElementById('btn-accept-terms').addEventListener('click', _acceptTerms);
    document.getElementById('btn-reject-terms').addEventListener('click', _rejectTerms);
  }

  function _acceptTerms() {
    document.getElementById('terms-modal-overlay').classList.add('hidden');
    localStorage.setItem('terms_accepted', 'true');
    window.dispatchEvent(new CustomEvent('termsAccepted'));
  }

  function _rejectTerms() {
    document.getElementById('terms-modal-overlay').classList.add('hidden');
    localStorage.setItem('terms_rejected', 'true');
    window.dispatchEvent(new CustomEvent('termsRejected'));
  }

  function showTermsModal() {
    const modal = document.getElementById('terms-modal-overlay');
    if (modal) modal.classList.remove('hidden');
  }

  function initForRegistration() {
    /* Modal de términos eliminado - solo se usa el modal estilizado de registro */
    /* _initTermsModal(); */
    /* showTermsModal(); */
  }

  function _initApprovalWaitingModal() {
    if (document.getElementById('approval-waiting-overlay')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="approval-waiting-overlay" class="hidden">
        <div id="approval-waiting-modal">
          <div class="icon">⏳</div>
          <h2>Cuenta en Revisión</h2>
          <p>Tu cuenta está siendo revisada por nuestras moderadoras.</p>
          <p>Por favor, espera mientras una moderadora te contacta para la verificación.</p>
          <div class="status">🕐 Esperando aprobación...</div>
        </div>
      </div>`);
  }

  function showApprovalWaiting() {
    document.getElementById('approval-waiting-overlay')?.classList.remove('hidden');
  }
  function hideApprovalWaiting() {
    document.getElementById('approval-waiting-overlay')?.classList.add('hidden');
  }

  function _initWelcomeModal() {
    if (document.getElementById('welcome-modal-overlay')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="welcome-modal-overlay" class="hidden">
        <div id="welcome-modal">
          <div class="icon">🎉</div>
          <h2>¡Has Sido Aceptada!</h2>
          <p>Bienvenida a nuestra comunidad. Tu cuenta ha sido verificada y aprobada.</p>
          <button id="btn-welcome-continue">Continuar al Chat</button>
        </div>
      </div>`);
    document.getElementById('btn-welcome-continue').addEventListener('click', () => {
      document.getElementById('welcome-modal-overlay').classList.add('hidden');
      window.location.reload();
    });
  }
  function showWelcomeModal() {
    document.getElementById('welcome-modal-overlay')?.classList.remove('hidden');
  }

  function _initRejectionModal() {
    if (document.getElementById('rejection-modal-overlay')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="rejection-modal-overlay" class="hidden">
        <div id="rejection-modal">
          <div class="icon">❌</div>
          <h2>Has Sido Rechazada</h2>
          <p>Lamentamos informarte que tu cuenta no ha sido aprobada.</p>
          <div class="deletion-notice">⚠️ Tu cuenta será eliminada de nuestro sistema.</div>
        </div>
      </div>`);
  }
  function showRejectionModal() {
    document.getElementById('rejection-modal-overlay')?.classList.remove('hidden');
    setTimeout(() => {
      fetch('/api/auth/delete-account', { method: 'POST' })
        .finally(() => { window.location.href = '/'; });
    }, 5000);
  }

  function _initNewUserAlert() {
    if (document.getElementById('new-user-alert-overlay')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="new-user-alert-overlay" class="hidden">
        <div id="new-user-alert">
          <div class="alert-header"><span class="alert-icon">🔔</span><h3>Nueva Usuaria Registrada</h3></div>
          <div class="user-info">
            <div class="user-name" id="new-user-name">-</div>
            <div class="user-email" id="new-user-email">-</div>
          </div>
          <div class="alert-buttons">
            <button id="btn-dismiss-alert">Más tarde</button>
            <button id="btn-review-user">Revisar</button>
          </div>
        </div>
      </div>`);
    document.getElementById('btn-dismiss-alert').addEventListener('click', _dismissNewUserAlert);
    document.getElementById('btn-review-user').addEventListener('click', () => window._ModChat._openReviewChat());
  }

  function _dismissNewUserAlert() {
    document.getElementById('new-user-alert-overlay').classList.add('hidden');
  }

  function showNewUserAlert(userData) {
    console.log('[ModModals] showNewUserAlert called', { userData, currentUser: S.currentUser, session: Auth?.loadSession?.() });
    /* Verificación triple: rol, sesión activa, y que no sea el propio usuario */
    if (S.currentUser?.role !== 'superadmin') {
      console.log('[ModModals] Blocked: not superadmin');
      return;
    }
    const session = Auth?.loadSession?.();
    if (!session?.user?.id) {
      console.log('[ModModals] Blocked: no session');
      return;
    }
    if (session.user.role !== 'superadmin') {
      console.log('[ModModals] Blocked: session not superadmin');
      return;
    }
    console.log('[ModModals] Showing alert for:', userData.name);
    document.getElementById('new-user-name').textContent  = userData.name;
    document.getElementById('new-user-email').textContent = userData.email;
    document.getElementById('new-user-alert-overlay').classList.remove('hidden');
    S.pendingReviewUsers.push(userData);
  }

  function _initUsersListBlock() {
    const ul = document.getElementById('user-list');
    if (!ul || document.getElementById('users-list-blocked-overlay')) return;
    ul.style.position = 'relative';
    ul.insertAdjacentHTML('beforeend', `
      <div id="users-list-blocked-overlay" class="hidden" style="
        position:absolute;inset:0;background:rgba(26,26,46,.95);
        display:flex;flex-direction:column;align-items:center;
        justify-content:center;text-align:center;padding:2rem;z-index:100;">
        <div style="font-size:3rem;margin-bottom:1rem;">🔒</div>
        <h3 style="color:#fff;margin-bottom:.5rem;">Lista de Usuarias</h3>
        <p style="color:#888;max-width:200px;">Se desbloqueará cuando seas aprobada.</p>
      </div>`);
  }

  function _updateUsersListVisibility() {
    const overlay = document.getElementById('users-list-blocked-overlay');
    if (!overlay) return;
    if (S.isApproved) overlay.classList.add('hidden');
    else overlay.classList.remove('hidden');
  }

  return {
    _initTermsModal, initForRegistration, showTermsModal,
    showApprovalWaiting, hideApprovalWaiting,
    _initApprovalWaitingModal, _initWelcomeModal, showWelcomeModal,
    _initRejectionModal, showRejectionModal,
    _initNewUserAlert, showNewUserAlert, _dismissNewUserAlert,
    _initUsersListBlock, _updateUsersListVisibility
  };
})();
