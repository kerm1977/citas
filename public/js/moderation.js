console.log('[ModerationSystem] File loading started...');

/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️⚠️⚠️  MÓDULO DE MODERACIÓN — BLINDADO — NO MODIFICAR  ⚠️⚠️⚠️         ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  ESTE MÓDULO ESTÁ COMPLETAMENTE VALIDADO Y EN PRODUCCIÓN.                 ║
 * ║  CUALQUIER CAMBIO SIN ENTENDER EL FLUJO COMPLETO ROMPERÁ EL SISTEMA.      ║
 * ║                                                                           ║
 * ║  ── FLUJO COMPLETO (NO ALTERAR EL ORDEN) ─────────────────────────────── ║
 * ║  1. Usuario nuevo → initForRegistration() → términos → formulario          ║
 * ║  2. Registro exitoso → ModerationSystem.setJustRegistered()               ║
 * ║     + showApprovalWaiting() + notificación socket a superadmins           ║
 * ║  3. Superadmin recibe alerta → revisa → chat de verificación              ║
 * ║  4. Superadmin decide → moderation:decide → approve/reject                ║
 * ║  5. Approve: BD actualiza is_approved=1 + persist() síncrono              ║
 * ║             + sesión local actualizada + showWelcomeModal()               ║
 * ║  6. Reject: BD DELETE inmediato + persist() síncrono                      ║
 * ║            + socket del usuario desconectado a los 1500ms                 ║
 * ║                                                                           ║
 * ║  ── IDs HTML FIJOS — JAMÁS RENOMBRAR ─────────────────────────────────── ║
 * ║  #terms-modal-overlay          → Modal de términos (registro)             ║
 * ║  #approval-waiting-overlay     → Modal espera aprobación (usuaria)        ║
 * ║  #welcome-modal-overlay        → Modal bienvenida (tras aprobación)       ║
 * ║  #rejection-modal-overlay      → Modal rechazo                            ║
 * ║  #new-user-alert-overlay       → Alerta nueva usuaria (superadmin)        ║
 * ║  #review-chat-overlay          → Chat de revisión (moderadora)            ║
 * ║  #review-chat-messages         → Mensajes del chat moderadora             ║
 * ║  #review-chat-input-area       → Input área moderadora                    ║
 * ║  #review-file-input            → Input de archivo moderadora              ║
 * ║  #user-review-chat-overlay     → Chat de revisión (usuaria)               ║
 * ║  #user-review-chat-messages    → Mensajes del chat usuaria                ║
 * ║  #user-review-chat-input-area  → Input área usuaria                       ║
 * ║  #user-review-file-input       → Input de archivo usuaria                 ║
 * ║  #users-list-block-overlay     → Overlay que bloquea lista de usuarias    ║
 * ║                                                                           ║
 * ║  ── CLASES CSS FIJAS — JAMÁS RENOMBRAR ────────────────────────────────── ║
 * ║  .bubble-row.sent / .bubble-row.received  → Burbujas del review chat      ║
 * ║  .bubble.sent / .bubble.received          → Interior de la burbuja        ║
 * ║  .msg-sender / .msg-text / .msg-time      → Partes de la burbuja          ║
 * ║  .system-message                          → Mensajes del sistema          ║
 * ║  .review-attach-btn                       → Botón de adjuntar archivo     ║
 * ║                                                                           ║
 * ║  ── EVENTOS SOCKET FIJOS — JAMÁS RENOMBRAR ────────────────────────────── ║
 * ║  moderation:new_user           → Superadmin: alerta nueva usuaria         ║
 * ║  moderation:review_message     → Mensaje en el chat de revisión           ║
 * ║  moderation:approved           → Usuaria fue aprobada                     ║
 * ║  moderation:rejected           → Usuaria fue rechazada                    ║
 * ║  moderation:force_pending      → Servidor: forzar estado pendiente        ║
 * ║  moderation:server_approved    → Servidor: confirmar aprobación           ║
 * ║  moderation:system_message     → Mensaje del sistema en review chat       ║
 * ║  moderation:join_review        → Moderadora entra al room de revisión     ║
 * ║  moderation:decide             → Decisión de aprobación/rechazo           ║
 * ║                                                                           ║
 * ║  ── REGLAS DE DEDUPLICACIÓN — NO ALTERAR ──────────────────────────────── ║
 * ║  moderation:review_message listener: filtra data.sender_id !== _currentUser.id ║
 * ║  en AMBOS lados (moderadora Y usuaria). Cambiar esto DUPLICA mensajes.    ║
 * ║                                                                           ║
 * ║  ── REGLA CRÍTICA DE ESTRUCTURA ───────────────────────────────────────── ║
 * ║  - SIN 'use strict' envolvente al módulo                                  ║
 * ║  - SIN try/catch global que envuelva TODO el módulo                       ║
 * ║  - SIN funciones duplicadas (verificar antes de agregar nuevas)           ║
 * ║  - initForRegistration() es la ÚNICA entrada para la página de registro   ║
 * ║  - init(socket) es la ÚNICA entrada para el flujo de chat                 ║
 * ║                                                                           ║
 * ║  ── APROBACIÓN SERVER-AUTHORITATIVE ───────────────────────────────────── ║
 * ║  _checkUserStatus() verifica con /api/auth/approval-status (BD real).     ║
 * ║  El localStorage NO es fuente de verdad. El servidor manda.               ║
 * ║  Si usuario aprobado: hideApprovalWaiting() SIEMPRE se llama.             ║
 * ║  Si usuario pendiente: showApprovalWaiting() SIEMPRE se llama.            ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
const ModerationSystem = (() => {
  let _currentUser = null;
  let _isApproved = false;
  let _pendingReviewUsers = [];
  let _activeReviewChat = null;
  let _socket = null;

  /* ═════════════════════════════════════════════════════════════════════════════
   *  INICIALIZACIÓN
   * ═════════════════════════════════════════════════════════════════════════════ */
  function init(socket) {
    _socket = socket;
    _currentUser = window._session?.user;
    // Aceptar is_approved como 1, true, o cualquier valor truthy
    const approvedValue = _currentUser?.is_approved;
    _isApproved = (approvedValue === 1 || approvedValue === true || approvedValue === '1') || _currentUser?.role === 'superadmin';
    
    console.log('[ModerationSystem] init - user:', _currentUser?.name, 'is_approved value:', approvedValue, 'type:', typeof approvedValue, 'calculated:', _isApproved);
    
    // Inicializar todos los modales (estos funcionan sin socket)
    _initTermsModal();
    _initApprovalWaitingModal();
    _initWelcomeModal();
    _initRejectionModal();
    _initNewUserAlert();
    _initReviewChat();
    _initUsersListBlock();
    
    // Aplicar visibilidad de lista de usuarios inmediatamente
    _updateUsersListVisibility();
    
    // Ejecutar verificación de estado (async para superadmins que verifican usuarios pendientes)
    _checkUserStatus().catch(err => {
      console.error('[ModerationSystem] Error in _checkUserStatus:', err);
    });
    
    // Solo configurar listeners de socket si hay socket
    if (socket) {
      _setupSocketListeners();
    }
    
    console.log('[ModerationSystem] Initialized for user:', _currentUser?.name, 'Approved:', _isApproved, 'Socket:', !!socket);
  }

  /* ═════════════════════════════════════════════════════════════════════════════
   *  MODAL DE TÉRMINOS (Página de Registro)
   * ═════════════════════════════════════════════════════════════════════════════ */
  function _initTermsModal() {
    if (!document.getElementById('terms-modal-overlay')) {
      const modalHTML = `
        <div id="terms-modal-overlay" class="hidden">
          <div id="terms-modal">
            <h2>🌸 Bienvenidas a Zona Segura</h2>
            <div id="terms-content">
              <p class="highlight">Esta aplicación es únicamente para <strong>Mujeres</strong> sin importar su orientación Sexual. Es una zona segura, donde puedes ser tú misma, libre de mujeres falsas.</p>

              <p>La aplicación no guarda registros, no solicita información personal y mucho menos información financiera.</p>

              <div class="warning">
                <p><strong>🔍 Verificación:</strong></p>
                <ul>
                  <li>Se solicitarán pruebas por mujeres para verificar que son mujeres.</li>
                  <li>No se permiten "micrófonos malos, cámaras malas".</li>
                  <li>Solo ingresan las autorizadas por las mujeres moderadoras.</li>
                </ul>
              </div>

              <p>👨‍💻 <strong>Equipo de Desarrollo:</strong> El único hombre con acceso a ciertas áreas es del grupo de desarrolladores del chat, pero no pueden acceder a datos encriptados. Ni aún nosotras.</p>

              <p>� <strong>Privacidad:</strong> Los temas aquí tratados son personales y evitaremos el almacenamiento de conversaciones privadas. Las imágenes van de persona a persona y no se almacenan en nuestra base de datos. La información está totalmente encriptada para evitar incursiones de terceros.</p>

              <p>⚠️ <strong>Responsabilidad:</strong> Si estás en este chat lo haces por tu propia voluntad. Si ciertos temas te afectan, puede que sea mejor retirarte del mismo.</p>

              <p>🛡️ <strong>Moderación:</strong> Las mujeres en el chat son quienes denuncian las anomalías, hombres y/o material ofensivo.</p>

              <p>💝 <strong>Donaciones:</strong> Solicitamos donaciones a partir de $2 USD o ₡1000, pero no por el momento.</p>
            </div>
            <div id="terms-buttons">
              <button id="btn-reject-terms">No Acepto</button>
              <button id="btn-accept-terms">Acepto ✓</button>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      
      document.getElementById('btn-accept-terms').addEventListener('click', _acceptTerms);
      document.getElementById('btn-reject-terms').addEventListener('click', _rejectTerms);
    }
  }

  /* Solo inicializa y muestra el modal de términos, sin chequear estado de usuario */
  function initForRegistration() {
    _initTermsModal();
    showTermsModal();
  }

  function _acceptTerms() {
    document.getElementById('terms-modal-overlay').classList.add('hidden');
    localStorage.setItem('terms_accepted', 'true');
    
    // Emitir evento para continuar con el registro
    window.dispatchEvent(new CustomEvent('termsAccepted'));
  }

  function _rejectTerms() {
    document.getElementById('terms-modal-overlay').classList.add('hidden');
    localStorage.setItem('terms_rejected', 'true');
    
    // Emitir evento para que auth.js maneje el rechazo
    window.dispatchEvent(new CustomEvent('termsRejected'));
  }

  function showTermsModal() {
    console.log('[ModerationSystem] showTermsModal called');
    const modal = document.getElementById('terms-modal-overlay');
    console.log('[ModerationSystem] Modal element found:', !!modal);
    if (modal) {
      modal.classList.remove('hidden');
      console.log('[ModerationSystem] Modal shown');
    } else {
      console.log('[ModerationSystem] Modal element not found!');
    }
  }

  /* ═════════════════════════════════════════════════════════════════════════════
   *  MODAL DE ESPERANDO APROBACIÓN
   * ═════════════════════════════════════════════════════════════════════════════ */
  function _initApprovalWaitingModal() {
    if (!document.getElementById('approval-waiting-overlay')) {
      const modalHTML = `
        <div id="approval-waiting-overlay" class="hidden">
          <div id="approval-waiting-modal">
            <div class="icon">⏳</div>
            <h2>Cuenta en Revisión</h2>
            <p>Tu cuenta está siendo revisada por nuestras moderadoras. Esto es parte de nuestro proceso de verificación para mantener este espacio seguro para todas.</p>
            <p>Por favor, espera mientras una moderadora te contacta para la verificación.</p>
            <div class="status">🕐 Esperando aprobación...</div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
  }

  function showApprovalWaiting() {
    const modal = document.getElementById('approval-waiting-overlay');
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  function hideApprovalWaiting() {
    const modal = document.getElementById('approval-waiting-overlay');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  /* ═════════════════════════════════════════════════════════════════════════════
   *  MODAL DE BIENVENIDA (Aprobada)
   * ═════════════════════════════════════════════════════════════════════════════ */
  function _initWelcomeModal() {
    if (!document.getElementById('welcome-modal-overlay')) {
      const modalHTML = `
        <div id="welcome-modal-overlay" class="hidden">
          <div id="welcome-modal">
            <div class="icon">🎉</div>
            <h2>¡Has Sido Aceptada!</h2>
            <p>Bienvenida a nuestra comunidad. Tu cuenta ha sido verificada y aprobada por nuestras moderadoras.</p>
            <p>Ahora puedes ver y chatear con todas las participantes activas.</p>
            <button id="btn-welcome-continue">Continuar al Chat</button>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      
      document.getElementById('btn-welcome-continue').addEventListener('click', () => {
        document.getElementById('welcome-modal-overlay').classList.add('hidden');
        window.location.reload();
      });
    }
  }

  function showWelcomeModal() {
    const modal = document.getElementById('welcome-modal-overlay');
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  /* ═════════════════════════════════════════════════════════════════════════════
   *  MODAL DE RECHAZO
   * ═════════════════════════════════════════════════════════════════════════════ */
  function _initRejectionModal() {
    if (!document.getElementById('rejection-modal-overlay')) {
      const modalHTML = `
        <div id="rejection-modal-overlay" class="hidden">
          <div id="rejection-modal">
            <div class="icon">❌</div>
            <h2>Has Sido Rechazada</h2>
            <p>Lamentamos informarte que tu cuenta no ha sido aprobada por nuestras moderadoras.</p>
            <div class="deletion-notice">
              ⚠️ Tu cuenta será eliminada de nuestro sistema.
            </div>
            <p>Gracias por tu interés. Te deseamos lo mejor.</p>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
  }

  function showRejectionModal() {
    const modal = document.getElementById('rejection-modal-overlay');
    if (modal) {
      modal.classList.remove('hidden');
    }
    
    // Eliminar cuenta después de mostrar el mensaje
    setTimeout(() => {
      fetch('/api/auth/delete-account', { method: 'POST' })
        .then(() => {
          window.location.href = '/';
        })
        .catch(() => {
          window.location.href = '/';
        });
    }, 5000);
  }

  /* ═════════════════════════════════════════════════════════════════════════════
   *  ALERTA DE NUEVA USUARIA (Para Superusuarios)
   * ═════════════════════════════════════════════════════════════════════════════ */
  function _initNewUserAlert() {
    if (!document.getElementById('new-user-alert-overlay')) {
      const alertHTML = `
        <div id="new-user-alert-overlay" class="hidden">
          <div id="new-user-alert">
            <div class="alert-header">
              <span class="alert-icon">🔔</span>
              <h3>Nueva Usuaria Registrada</h3>
            </div>
            <div class="user-info">
              <div class="user-name" id="new-user-name">-</div>
              <div class="user-email" id="new-user-email">-</div>
            </div>
            <div class="alert-buttons">
              <button id="btn-dismiss-alert">Más tarde</button>
              <button id="btn-review-user">Revisar</button>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', alertHTML);
      
      document.getElementById('btn-dismiss-alert').addEventListener('click', _dismissNewUserAlert);
      document.getElementById('btn-review-user').addEventListener('click', _openReviewChat);
    }
  }

  function _dismissNewUserAlert() {
    document.getElementById('new-user-alert-overlay').classList.add('hidden');
  }

  function showNewUserAlert(userData) {
    if (_currentUser?.role !== 'superadmin') return;
    
    document.getElementById('new-user-name').textContent = userData.name;
    document.getElementById('new-user-email').textContent = userData.email;
    document.getElementById('new-user-alert-overlay').classList.remove('hidden');
    
    _pendingReviewUsers.push(userData);
  }

  /* ═════════════════════════════════════════════════════════════════════════════
   *  CHAT DE REVISIÓN (Entre Moderador y Nueva Usuaria)
   * ═════════════════════════════════════════════════════════════════════════════ */
  function _initReviewChat() {
    if (!document.getElementById('review-chat-overlay')) {
      const chatHTML = `
        <div id="review-chat-overlay" class="hidden">
          <div id="review-chat-container">
            <div id="review-chat-header">
              <div>
                <h3>🔍 Revisión de Nueva Usuaria</h3>
                <div class="user-info" id="review-user-info">-</div>
              </div>
              <div class="decision-buttons">
                <button id="btn-reject-user">❌ Rechazar</button>
                <button id="btn-approve-user">✅ Aprobar</button>
              </div>
            </div>
            <div id="review-chat-messages"></div>
            <div id="review-chat-input-area">
              <label class="review-attach-btn" title="Adjuntar imagen, video o audio">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                <input type="file" id="review-file-input" accept="image/*,video/*,audio/*" hidden>
              </label>
              <input type="text" id="review-chat-input" placeholder="Escribe un mensaje para la usuaria..." />
              <button id="btn-send-review-message">Enviar</button>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', chatHTML);
    }
    
    // Agregar event listeners (solo una vez)
    const sendBtn = document.getElementById('btn-send-review-message');
    const input = document.getElementById('review-chat-input');
    const approveBtn = document.getElementById('btn-approve-user');
    const rejectBtn = document.getElementById('btn-reject-user');
    
    if (sendBtn && !sendBtn._hasModerationListener) {
      sendBtn.addEventListener('click', _sendReviewMessage);
      sendBtn._hasModerationListener = true;
    }
    if (input && !input._hasModerationListener) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') _sendReviewMessage();
      });
      input._hasModerationListener = true;
    }
    const fileInput = document.getElementById('review-file-input');
    if (fileInput && !fileInput._hasModerationListener) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) _sendReviewFile(file, 'moderator');
        e.target.value = '';
      });
      fileInput._hasModerationListener = true;
    }
    if (approveBtn && !approveBtn._hasModerationListener) {
      approveBtn.addEventListener('click', () => {
        console.log('[ModerationSystem] Approve button clicked');
        _decideUser('approve');
      });
      approveBtn._hasModerationListener = true;
    }
    if (rejectBtn && !rejectBtn._hasModerationListener) {
      rejectBtn.addEventListener('click', () => {
        console.log('[ModerationSystem] Reject button clicked');
        _decideUser('reject');
      });
      rejectBtn._hasModerationListener = true;
    }
  }

  function _openReviewChat() {
    const user = _pendingReviewUsers[0];
    if (!user) return;
    
    // Asegurar que el chat esté inicializado y los event listeners configurados
    _initReviewChat();
    
    _activeReviewChat = user;
    document.getElementById('review-user-info').textContent = `${user.name} (${user.email})`;
    document.getElementById('new-user-alert-overlay').classList.add('hidden');
    document.getElementById('review-chat-overlay').classList.remove('hidden');
    
    // Limpiar mensajes anteriores
    const messagesContainer = document.getElementById('review-chat-messages');
    if (messagesContainer) {
      messagesContainer.innerHTML = '';
    }
    
    // Enfocar el input
    setTimeout(() => {
      document.getElementById('review-chat-input')?.focus();
    }, 100);
    
    // Unirse al room de revisión
    const room = `review_${user.id}`;
    _socket.emit('chat:join', { room });
    _socket.emit('moderation:join_review', { userId: user.id });
    
    console.log('[ModerationSystem] Review chat opened for user:', user.name);
  }

  function _sendReviewMessage() {
    const input = document.getElementById('review-chat-input');
    const message = input.value.trim();
    if (!message || !_activeReviewChat) return;
    
    _socket.emit('moderation:review_message', {
      userId: _activeReviewChat.id,
      content: message,
      senderId: _currentUser.id
    });
    
    // Agregar mensaje propio a la vista (burbuja enviada)
    const container = document.getElementById('review-chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'bubble-row sent';
    msgDiv.innerHTML = `
      <div class="bubble sent">
        <div class="msg-text">${ChatUtils.escape(message)}</div>
        <div class="msg-time">${new Date().toLocaleTimeString()}</div>
      </div>
    `;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
    
    input.value = ''; input.focus();
  }

  function _decideUser(decision) {
    console.log('[ModerationSystem] _decideUser called:', decision, 'activeReviewChat:', !!_activeReviewChat);
    if (!_activeReviewChat) {
      console.error('[ModerationSystem] No active review chat!');
      return;
    }
    
    if (!_socket) {
      console.error('[ModerationSystem] Socket not available!');
      return;
    }
    
    if (!_socket.connected) {
      console.error('[ModerationSystem] Socket not connected!');
      return;
    }
    
    console.log('[ModerationSystem] Emitting moderation:decide for user:', _activeReviewChat.id);
    console.log('[ModerationSystem] Socket connected:', _socket.connected);
    
    _socket.emit('moderation:decide', {
      userId: _activeReviewChat.id,
      decision, // 'approve' o 'reject'
      moderatorId: _currentUser.id
    });
    
    document.getElementById('review-chat-overlay').classList.add('hidden');
    _pendingReviewUsers.shift();
    _activeReviewChat = null;
    
    if (_pendingReviewUsers.length > 0) {
      showNewUserAlert(_pendingReviewUsers[0]);
    }
  }

  /* ═════════════════════════════════════════════════════════════════════════════
   *  BLOQUEO DE LISTA DE USUARIAS (Para no aprobadas)
   * ═════════════════════════════════════════════════════════════════════════════ */
  function _initUsersListBlock() {
    const usersList = document.getElementById('user-list');
    console.log('[ModerationSystem] _initUsersListBlock - usersList found:', !!usersList);
    if (usersList && !document.getElementById('users-list-blocked-overlay')) {
      const blockHTML = `
        <div id="users-list-blocked-overlay" class="hidden" style="
          position: absolute;
          inset: 0;
          background: rgba(26, 26, 46, 0.95);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 2rem;
          z-index: 100;
        ">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🔒</div>
          <h3 style="color: #fff; margin-bottom: 0.5rem;">Lista de Usuarias</h3>
          <p style="color: #888; max-width: 200px;">Esta sección se desbloqueará cuando seas aprobada por nuestras moderadoras.</p>
        </div>
      `;
      usersList.style.position = 'relative';
      usersList.insertAdjacentHTML('beforeend', blockHTML);
      console.log('[ModerationSystem] Block overlay added to users list');
    }
  }

  function _updateUsersListVisibility() {
    const overlay = document.getElementById('users-list-blocked-overlay');
    if (overlay) {
      if (_isApproved) {
        overlay.classList.add('hidden');
      } else {
        overlay.classList.remove('hidden');
      }
    }
  }

  /* ═════════════════════════════════════════════════════════════════════════════
   *  VERIFICACIÓN DE ESTADO DE USUARIA
   * ═════════════════════════════════════════════════════════════════════════════ */
  async function _checkUserStatus() {
    // Si es superadmin, siempre está aprobado y verificar usuarios pendientes
    if (_currentUser?.role === 'superadmin') {
      _isApproved = true;
      
      /* ═════════════════════════════════════════════════════════════════════════════
       *  CRÍTICO: Verificar usuarios pendientes al iniciar sesión como moderador
       * ═════════════════════════════════════════════════════════════════════════════ */
      try {
        const res = await fetch('/api/auth/pending-users', { headers: ChatUtils.authHeaders() });
        const data = await res.json();
        if (data.ok && data.users && data.users.length > 0) {
          console.log('[ModerationSystem] Found', data.users.length, 'pending users');
          // Mostrar alerta del primer usuario pendiente
          showNewUserAlert(data.users[0]);
          // Guardar todos para revisión
          _pendingReviewUsers = data.users;
        }
      } catch (err) {
        console.error('[ModerationSystem] Error checking pending users:', err);
      }
      return;
    }
    
    // ⚠️ Verificar estado REAL desde el servidor (fuente de verdad), no del localStorage
    try {
      const res = await fetch('/api/auth/approval-status', { headers: ChatUtils.authHeaders() });
      const data = await res.json();
      if (data.ok) {
        const serverApproved = data.is_approved === true || data.is_approved === 1;
        if (_isApproved !== serverApproved) {
          console.log('[ModerationSystem] Server corrects approval:', _isApproved, '→', serverApproved);
          _isApproved = serverApproved;
          // Sincronizar sesión local con estado del servidor
          const _KEY = '_chatapp_session';
          try {
            ['sessionStorage', 'localStorage'].forEach(store => {
              const raw = window[store].getItem(_KEY);
              if (raw) {
                const d = JSON.parse(raw);
                if (d.user) d.user.is_approved = serverApproved ? 1 : 0;
                window[store].setItem(_KEY, JSON.stringify(d));
              }
            });
            if (window._session?.user) window._session.user.is_approved = serverApproved ? 1 : 0;
          } catch {}
        }
      }
    } catch (err) {
      console.warn('[ModerationSystem] Could not verify approval status with server:', err.message);
    }

    console.log('[ModerationSystem] _checkUserStatus - _isApproved:', _isApproved, 'role:', _currentUser?.role);
    if (!_isApproved) {
      console.log('[ModerationSystem] User not approved — blocking');
      _updateUsersListVisibility();
      showApprovalWaiting();
    } else {
      console.log('[ModerationSystem] User is approved — ensuring no block modal');
      hideApprovalWaiting(); // ⚠️ Garantía: si está aprobada, ocultar modal siempre
      _updateUsersListVisibility();
    }
  }

  /* ═════════════════════════════════════════════════════════════════════════════
   *  SOCKET LISTENERS
   * ═════════════════════════════════════════════════════════════════════════════ */
  function _setupSocketListeners() {
    if (!_socket) return;
    
    // Notificación de nueva usuaria (solo para superadmins)
    _socket.on('moderation:new_user', (data) => {
      if (_currentUser?.role === 'superadmin') {
        showNewUserAlert(data);
        // Agregar a la lista de pendientes
        if (!_pendingReviewUsers.find(u => u.id === data.id)) {
          _pendingReviewUsers.push(data);
        }
      }
    });

    // Recargar lista de usuarias cuando alguien es aprobada
    _socket.on('chat:user_list_refresh', () => {
      if (typeof Chat !== 'undefined' && Chat.loadUsers) {
        Chat.loadUsers();
      }
    });
    
    // Mensaje en chat de revisión
    _socket.on('moderation:review_message', (data) => {
      // Si somos el moderador y estamos en el chat de revisión
      // No mostrar si el mensaje es nuestro (ya se mostró localmente)
      if (_activeReviewChat && _currentUser?.role === 'superadmin') {
        if (data.sender_id !== _currentUser.id) {
          _appendReviewMessage(data);
        }
      }
      
      // Si somos la usuaria recibiendo mensaje del moderador (no el propio)
      if (_currentUser?.role === 'user' && data.sender_id !== _currentUser.id) {
        _appendModeratorMessage(data);
      }
    });
    
    // Decisión de aprobación/rechazo
    _socket.on('moderation:approved', () => {
      _isApproved = true;

      // Actualizar is_approved en la sesión guardada para que la recarga no bloquee
      const _SESSION_KEY = '_chatapp_session';
      try {
        ['sessionStorage', 'localStorage'].forEach(store => {
          const raw = window[store].getItem(_SESSION_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.user) parsed.user.is_approved = 1;
            window[store].setItem(_SESSION_KEY, JSON.stringify(parsed));
          }
        });
        if (window._session?.user) window._session.user.is_approved = 1;
      } catch {}

      hideApprovalWaiting();
      showWelcomeModal();
      _updateUsersListVisibility();
    });
    
    _socket.on('moderation:rejected', () => {
      hideApprovalWaiting();
      showRejectionModal();
    });

    /* ⚠️ CRÍTICO — Sincronización server-authoritative — NO ELIMINAR
     * El servidor manda el estado real de la BD al conectarse.
     * Esto anula cualquier valor manipulado en el localStorage. */
    _socket.on('moderation:force_pending', () => {
      _isApproved = false;
      const _KEY = '_chatapp_session';
      try {
        ['sessionStorage', 'localStorage'].forEach(store => {
          const raw = window[store].getItem(_KEY);
          if (raw) {
            const d = JSON.parse(raw);
            if (d.user) d.user.is_approved = 0;
            window[store].setItem(_KEY, JSON.stringify(d));
          }
        });
        if (window._session?.user) window._session.user.is_approved = 0;
      } catch {}
      _updateUsersListVisibility();
      hideApprovalWaiting();
      showApprovalWaiting();
    });

    _socket.on('moderation:server_approved', () => {
      _isApproved = true;
      const _KEY = '_chatapp_session';
      try {
        ['sessionStorage', 'localStorage'].forEach(store => {
          const raw = window[store].getItem(_KEY);
          if (raw) {
            const d = JSON.parse(raw);
            if (d.user) d.user.is_approved = 1;
            window[store].setItem(_KEY, JSON.stringify(d));
          }
        });
        if (window._session?.user) window._session.user.is_approved = 1;
      } catch {}
      hideApprovalWaiting(); // ⚠️ Garantía: siempre ocultar modal si el servidor aprueba
      _updateUsersListVisibility();
    });
    
    // Mensaje del sistema en chat de revisión
    _socket.on('moderation:system_message', (data) => {
      if (_activeReviewChat) {
        _appendSystemMessage(data.message);
      }
      
      /* ═════════════════════════════════════════════════════════════════════════════
       *  CRÍTICO: Cuando el moderador se une, ocultar modal de espera para la usuaria
       * ═════════════════════════════════════════════════════════════════════════════ */
      if (data.message && data.message.includes('moderadora')) {
        // Si somos la usuaria en espera, ocultar modal y mostrar chat
        if (!_isApproved && !_activeReviewChat) {
          hideApprovalWaiting();
          _showReviewChatForUser();
        }
      }
    });
  }
  
  /* ═════════════════════════════════════════════════════════════════════════════
   *  MOSTRAR CHAT DE REVISIÓN PARA LA USUARIA NUEVA
   * ═════════════════════════════════════════════════════════════════════════════ */
  function _showReviewChatForUser() {
    // Crear modal de chat de revisión para la usuaria si no existe
    if (!document.getElementById('user-review-chat-overlay')) {
      const chatHTML = `
        <div id="user-review-chat-overlay">
          <div id="user-review-chat-container">
            <div id="user-review-chat-header">
              <h3>🔍 Chat de Verificación</h3>
              <p>Una moderadora está revisando tu cuenta</p>
            </div>
            <div id="user-review-chat-messages"></div>
            <div id="user-review-chat-input-area">
              <label class="review-attach-btn" title="Adjuntar imagen, video o audio">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                <input type="file" id="user-review-file-input" accept="image/*,video/*,audio/*" hidden>
              </label>
              <input type="text" id="user-review-chat-input" placeholder="Escribe un mensaje..." />
              <button id="btn-user-send-review">Enviar</button>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', chatHTML);
      
      document.getElementById('btn-user-send-review').addEventListener('click', _sendUserReviewMessage);
      document.getElementById('user-review-chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') _sendUserReviewMessage();
      });
      document.getElementById('user-review-file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) _sendReviewFile(file, 'user');
        e.target.value = '';
      });
    }
    
    document.getElementById('user-review-chat-overlay').classList.remove('hidden');
    _activeReviewChat = { id: 'moderator', role: 'superadmin' };
    
    // Unirse al room de revisión para recibir mensajes
    if (_socket && _currentUser) {
      const reviewRoom = `review_${_currentUser.id}`;
      _socket.emit('chat:join', { room: reviewRoom });
      console.log('[ModerationSystem] User joined review room:', reviewRoom);
    }
  }
  
  async function _sendReviewFile(file, sender) {
    const isModerator = sender === 'moderator';
    const userId      = isModerator ? _activeReviewChat?.id : _currentUser?.id;
    if (!userId || !_socket) return;

    const fd = new FormData();
    fd.append('file', file);
    try {
      const res  = await fetch('/api/chat/upload', {
        method: 'POST',
        headers: ChatUtils.authHeaders(),
        body: fd
      });
      const data = await res.json();
      if (!data.ok) return;

      _socket.emit('moderation:review_message', {
        userId,
        content: data.url,
        senderId: _currentUser.id,
        type: data.type
      });

      // Burbuja local
      const containerId = isModerator ? 'review-chat-messages' : 'user-review-chat-messages';
      const container = document.getElementById(containerId);
      const row = document.createElement('div');
      row.className = 'bubble-row sent';
      row.innerHTML = `
        <div class="bubble sent">
          ${_renderReviewMedia(data.type, data.url)}
          <div class="msg-time">${new Date().toLocaleTimeString()}</div>
        </div>`;
      container.appendChild(row);
      container.scrollTop = container.scrollHeight;
    } catch (err) {
      console.error('[ModerationSystem] Error uploading file:', err);
    }
  }

  function _renderReviewMedia(type, url) {
    if (type === 'image') return `<img src="${url}" style="max-width:200px;border-radius:8px;cursor:pointer" onclick="window.open('${url}','_blank')">`;
    if (type === 'video') return `<video src="${url}" controls style="max-width:220px;border-radius:8px;"></video>`;
    if (type === 'audio') return `<audio src="${url}" controls style="max-width:220px;"></audio>`;
    return `<a href="${url}" target="_blank" style="color:#93c5fd">📎 Archivo adjunto</a>`;
  }

  function _sendUserReviewMessage() {
    const input = document.getElementById('user-review-chat-input');
    const message = input.value.trim();
    if (!message || !_socket) return;
    
    _socket.emit('moderation:review_message', {
      userId: _currentUser.id,
      content: message,
      senderId: _currentUser.id
    });
    
    // Agregar mensaje propio a la vista (burbuja enviada)
    const container = document.getElementById('user-review-chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'bubble-row sent';
    msgDiv.innerHTML = `
      <div class="bubble sent">
        <div class="msg-text">${ChatUtils.escape(message)}</div>
        <div class="msg-time">${new Date().toLocaleTimeString()}</div>
      </div>
    `;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
    
    input.value = ''; input.focus();
  }
  
  function _appendModeratorMessage(data) {
    const container = document.getElementById('user-review-chat-messages');
    if (!container) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'bubble-row received';
    const mediaHTML = (data.type && data.type !== 'text')
      ? _renderReviewMedia(data.type, data.content)
      : `<div class="msg-text">${ChatUtils.escape(data.content || '')}</div>`;
    msgDiv.innerHTML = `
      <div class="bubble received">
        <div class="msg-sender">${ChatUtils.escape(data.sender_name || 'Moderadora')}</div>
        ${mediaHTML}
        <div class="msg-time">${new Date().toLocaleTimeString()}</div>
      </div>
    `;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
  }

  function _appendReviewMessage(msg) {
    const container = document.getElementById('review-chat-messages');
    if (!container) return;
    const bubble = document.createElement('div');
    bubble.className = 'bubble-row received';
    const mediaHTML = (msg.type && msg.type !== 'text')
      ? _renderReviewMedia(msg.type, msg.content)
      : `<div class="msg-text">${ChatUtils.escape(msg.content || '')}</div>`;
    bubble.innerHTML = `
      <div class="bubble received">
        <div class="msg-sender">${ChatUtils.escape(msg.sender_name || 'Usuaria')}</div>
        ${mediaHTML}
        <div class="msg-time">${new Date().toLocaleTimeString()}</div>
      </div>
    `;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
  }

  function _appendSystemMessage(message) {
    const container = document.getElementById('user-review-chat-messages') ||
                      document.getElementById('review-chat-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'system-message';
    div.textContent = message;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  /* ═════════════════════════════════════════════════════════════════════════════
   *  API PÚBLICA
   * ═════════════════════════════════════════════════════════════════════════════ */
  return { initForRegistration,
    init,
    showTermsModal,
    showApprovalWaiting,
    hideApprovalWaiting,
    showWelcomeModal,
    showRejectionModal,
    showNewUserAlert,
    isApproved: () => _isApproved,
    setJustRegistered: () => sessionStorage.setItem('just_registered', 'true'),
    getPendingUsers: () => _pendingReviewUsers
  };
})();

// Exportar para uso global
window.ModerationSystem = ModerationSystem;

console.log('[ModerationSystem] Module loaded');
