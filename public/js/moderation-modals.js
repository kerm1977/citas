/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  MODERATION-MODALS — modales de términos, aprobación, bienvenida, rechazo║
 * ║  Requiere: moderation-state.js (window._MS).                            ║
 * ║  ⚠️ IDs de modales son FIJOS — NO renombrar ninguno.                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
'use strict';

window._ModModals = (function () {
  const S = window._MS;

  /* _initTermsModal ELIMINADO - modal de términos no estilizado */
  function _initTermsModal() {
    /* No hacer nada - modal eliminado */
    return;
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
    /* Eliminar cualquier modal de términos existente en el DOM */
    const existingModal = document.getElementById('terms-modal-overlay');
    if (existingModal) existingModal.remove();
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
    /* Verificación triple: rol, sesión activa, y que no sea el propio usuario */
    if (S.currentUser?.role !== 'superadmin') {
      return;
    }
    const session = Auth?.loadSession?.();
    if (!session?.user?.id) {
      return;
    }
    if (session.user.role !== 'superadmin') {
      return;
    }
    _initNewUserAlert();
    const nameEl = document.getElementById('new-user-name');
    const emailEl = document.getElementById('new-user-email');
    const overlayEl = document.getElementById('new-user-alert-overlay');
    
    if (!nameEl || !emailEl || !overlayEl) {
      console.error('[ModModals] Required elements not found', { nameEl, emailEl, overlayEl });
      return;
    }
    
    nameEl.textContent = userData.name;
    emailEl.textContent = userData.email;
    overlayEl.classList.remove('hidden');
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
