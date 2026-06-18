/* +---------------------------------------------------------------------------+
 * ║  MODERATION.JS — COORDINADOR DELGADO — NO MODIFICAR                     ║
 * ║  Sub-módulos (cargar en orden):                                          ║
 * ║    1. moderation-state.js   → window._MS (estado compartido)            ║
 * ║    2. moderation-modals.js  → window._ModModals                         ║
 * ║    3. moderation-chat.js    → window._ModChat                           ║
 * ║    4. moderation-socket.js  → window._ModSocket                         ║
 * ║    5. moderation.js (este)  → window.ModerationSystem (API pública)     ║
 * ║  ⚠️ initForRegistration() es la ÚNICA entrada para registro.             ║
 * ║  ⚠️ init(socket) es la ÚNICA entrada para el flujo de chat.              ║
 * +---------------------------------------------------------------------------+ */

const ModerationSystem = (() => {
  function init(socket) {
    const S = window._MS;
    S.socket      = socket;
    S.currentUser = window._session?.user;
    const av      = S.currentUser?.is_approved;
    S.isApproved  = (av === 1 || av === true || av === '1') || S.currentUser?.role === 'superadmin';

    /* Modal de términos eliminado - solo se usa el modal estilizado de registro */
    /* window._ModModals._initTermsModal(); */
    /* Eliminar cualquier modal de términos existente en el DOM */
    const existingModal = document.getElementById('terms-modal-overlay');
    if (existingModal) existingModal.remove();
    window._ModModals._initApprovalWaitingModal();
    window._ModModals._initWelcomeModal();
    window._ModModals._initRejectionModal();
    window._ModModals._initNewUserAlert();
    window._ModChat._initReviewChat();
    window._ModModals._initUsersListBlock();
    window._ModModals._updateUsersListVisibility();

    window._ModSocket._checkUserStatus().catch(e => console.error('[ModerationSystem] _checkUserStatus:', e));
    if (socket) window._ModSocket._setupSocketListeners();

  }

  return {
    init,
    initForRegistration:  (...a) => window._ModModals.initForRegistration(...a),
    showTermsModal:       (...a) => window._ModModals.showTermsModal(...a),
    showApprovalWaiting:  (...a) => window._ModModals.showApprovalWaiting(...a),
    hideApprovalWaiting:  (...a) => window._ModModals.hideApprovalWaiting(...a),
    showWelcomeModal:     (...a) => window._ModModals.showWelcomeModal(...a),
    showRejectionModal:   (...a) => window._ModModals.showRejectionModal(...a),
    showNewUserAlert:     (...a) => window._ModModals.showNewUserAlert(...a),
    isApproved:           ()    => window._MS.isApproved,
    setJustRegistered:    ()    => sessionStorage.setItem('just_registered', 'true'),
    getPendingUsers:      ()    => window._MS.pendingReviewUsers
  };
})();

window.ModerationSystem = ModerationSystem;
