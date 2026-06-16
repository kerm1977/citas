/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  MODERATION-CHAT — chat de revisión (moderadora y usuaria) — NO MODIFICAR║
 * ║  Requiere: moderation-state.js + moderation-modals.js                   ║
 * ║  ⚠️ IDs #review-chat-* y #user-review-chat-* son FIJOS. No renombrar.  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
'use strict';

window._ModChat = (function () {
  const S = window._MS;

  function _renderReviewMedia(type, url) {
    if (type === 'image') return `<img src="${url}" style="max-width:200px;border-radius:8px;cursor:pointer" onclick="window.open('${url}','_blank')">`;
    if (type === 'video') return `<video src="${url}" controls style="max-width:220px;border-radius:8px;"></video>`;
    if (type === 'audio') return `<audio src="${url}" controls style="max-width:220px;"></audio>`;
    return `<a href="${url}" target="_blank" style="color:#93c5fd">📎 Archivo adjunto</a>`;
  }

  function _appendSystemMessage(message) {
    const c = document.getElementById('user-review-chat-messages') || document.getElementById('review-chat-messages');
    if (!c) return;
    const div = document.createElement('div');
    div.className = 'system-message';
    div.textContent = message;
    c.appendChild(div);
    c.scrollTop = c.scrollHeight;
  }

  function _appendReviewMessage(msg) {
    const c = document.getElementById('review-chat-messages');
    if (!c) return;
    const b = document.createElement('div');
    b.className = 'bubble-row received';
    const mediaHTML = (msg.type && msg.type !== 'text') ? _renderReviewMedia(msg.type, msg.content)
      : `<div class="msg-text">${ChatUtils.escape(msg.content || '')}</div>`;
    b.innerHTML = `<div class="bubble received"><div class="msg-sender">${ChatUtils.escape(msg.sender_name || 'Usuaria')}</div>${mediaHTML}<div class="msg-time">${new Date().toLocaleTimeString()}</div></div>`;
    c.appendChild(b); c.scrollTop = c.scrollHeight;
  }

  function _appendModeratorMessage(data) {
    const c = document.getElementById('user-review-chat-messages');
    if (!c) return;
    const d = document.createElement('div');
    d.className = 'bubble-row received';
    const mediaHTML = (data.type && data.type !== 'text') ? _renderReviewMedia(data.type, data.content)
      : `<div class="msg-text">${ChatUtils.escape(data.content || '')}</div>`;
    d.innerHTML = `<div class="bubble received"><div class="msg-sender">${ChatUtils.escape(data.sender_name || 'Moderadora')}</div>${mediaHTML}<div class="msg-time">${new Date().toLocaleTimeString()}</div></div>`;
    c.appendChild(d); c.scrollTop = c.scrollHeight;
  }

  function _initReviewChat() {
    if (!document.getElementById('review-chat-overlay')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="review-chat-overlay" class="hidden">
          <div id="review-chat-container">
            <div id="review-chat-header">
              <div><h3>🔍 Revisión de Nueva Usuaria</h3><div class="user-info" id="review-user-info">-</div></div>
              <div class="decision-buttons">
                <button id="btn-reject-user">❌ Rechazar</button>
                <button id="btn-approve-user">✅ Aprobar</button>
              </div>
            </div>
            <div id="review-chat-messages"></div>
            <div id="review-chat-input-area">
              <label class="review-attach-btn" title="Adjuntar">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                <input type="file" id="review-file-input" accept="image/*,video/*,audio/*" hidden>
              </label>
              <input type="text" id="review-chat-input" placeholder="Escribe un mensaje para la usuaria..." />
              <button id="btn-send-review-message">Enviar</button>
            </div>
          </div>
        </div>`);
    }
    const sendBtn   = document.getElementById('btn-send-review-message');
    const input     = document.getElementById('review-chat-input');
    const approveBtn = document.getElementById('btn-approve-user');
    const rejectBtn  = document.getElementById('btn-reject-user');
    const fileInput  = document.getElementById('review-file-input');

    if (sendBtn && !sendBtn._ml)  { sendBtn.addEventListener('click', _sendReviewMessage); sendBtn._ml = true; }
    if (input  && !input._ml)    { input.addEventListener('keypress', e => { if (e.key === 'Enter') _sendReviewMessage(); }); input._ml = true; }
    if (fileInput && !fileInput._ml) { fileInput.addEventListener('change', e => { const f = e.target.files[0]; if (f) _sendReviewFile(f, 'moderator'); e.target.value = ''; }); fileInput._ml = true; }
    if (approveBtn && !approveBtn._ml) { approveBtn.addEventListener('click', () => _decideUser('approve')); approveBtn._ml = true; }
    if (rejectBtn  && !rejectBtn._ml)  { rejectBtn.addEventListener('click',  () => _decideUser('reject'));  rejectBtn._ml = true; }
  }

  function _openReviewChat() {
    const user = S.pendingReviewUsers[0];
    if (!user) return;
    _initReviewChat();
    S.activeReviewChat = user;
    document.getElementById('review-user-info').textContent = `${user.name} (${user.email})`;
    document.getElementById('new-user-alert-overlay').classList.add('hidden');
    document.getElementById('review-chat-overlay').classList.remove('hidden');
    const mc = document.getElementById('review-chat-messages');
    if (mc) mc.innerHTML = '';
    setTimeout(() => document.getElementById('review-chat-input')?.focus(), 100);
    S.socket.emit('chat:join', { room: `review_${user.id}` });
    S.socket.emit('moderation:join_review', { userId: user.id });
  }

  function _sendReviewMessage() {
    const input = document.getElementById('review-chat-input');
    const msg   = input.value.trim();
    if (!msg || !S.activeReviewChat) return;
    S.socket.emit('moderation:review_message', { userId: S.activeReviewChat.id, content: msg, senderId: S.currentUser.id });
    const c = document.getElementById('review-chat-messages');
    const d = document.createElement('div');
    d.className = 'bubble-row sent';
    d.innerHTML = `<div class="bubble sent"><div class="msg-text">${ChatUtils.escape(msg)}</div><div class="msg-time">${new Date().toLocaleTimeString()}</div></div>`;
    c.appendChild(d); c.scrollTop = c.scrollHeight;
    input.value = ''; input.focus();
  }

  function _decideUser(decision) {
    if (!S.activeReviewChat || !S.socket?.connected) return;
    S.socket.emit('moderation:decide', { userId: S.activeReviewChat.id, decision, moderatorId: S.currentUser.id });
    document.getElementById('review-chat-overlay').classList.add('hidden');
    S.pendingReviewUsers.shift();
    S.activeReviewChat = null;
    /* Solo mostrar siguiente alerta si el superusuario está logueado */
    const session = Auth?.loadSession?.();
    if (session?.user?.role === 'superadmin' && S.pendingReviewUsers.length > 0) {
      window._ModModals.showNewUserAlert(S.pendingReviewUsers[0]);
    }
  }

  function _showReviewChatForUser() {
    if (!document.getElementById('user-review-chat-overlay')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="user-review-chat-overlay">
          <div id="user-review-chat-container">
            <div id="user-review-chat-header"><h3>🔍 Chat de Verificación</h3><p>Una moderadora está revisando tu cuenta</p></div>
            <div id="user-review-chat-messages"></div>
            <div id="user-review-chat-input-area">
              <label class="review-attach-btn" title="Adjuntar">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                <input type="file" id="user-review-file-input" accept="image/*,video/*,audio/*" hidden>
              </label>
              <input type="text" id="user-review-chat-input" placeholder="Escribe un mensaje..." />
              <button id="btn-user-send-review">Enviar</button>
            </div>
          </div>
        </div>`);
      document.getElementById('btn-user-send-review').addEventListener('click', _sendUserReviewMessage);
      document.getElementById('user-review-chat-input').addEventListener('keypress', e => { if (e.key === 'Enter') _sendUserReviewMessage(); });
      document.getElementById('user-review-file-input').addEventListener('change', e => { const f = e.target.files[0]; if (f) _sendReviewFile(f, 'user'); e.target.value = ''; });
    }
    document.getElementById('user-review-chat-overlay').classList.remove('hidden');
    S.activeReviewChat = { id: 'moderator', role: 'superadmin' };
    if (S.socket && S.currentUser) S.socket.emit('chat:join', { room: `review_${S.currentUser.id}` });
  }

  function _sendUserReviewMessage() {
    const input = document.getElementById('user-review-chat-input');
    const msg   = input.value.trim();
    if (!msg || !S.socket) return;
    S.socket.emit('moderation:review_message', { userId: S.currentUser.id, content: msg, senderId: S.currentUser.id });
    const c = document.getElementById('user-review-chat-messages');
    const d = document.createElement('div');
    d.className = 'bubble-row sent';
    d.innerHTML = `<div class="bubble sent"><div class="msg-text">${ChatUtils.escape(msg)}</div><div class="msg-time">${new Date().toLocaleTimeString()}</div></div>`;
    c.appendChild(d); c.scrollTop = c.scrollHeight;
    input.value = ''; input.focus();
  }

  async function _sendReviewFile(file, sender) {
    const isMod = sender === 'moderator';
    const userId = isMod ? S.activeReviewChat?.id : S.currentUser?.id;
    if (!userId || !S.socket) return;
    const fd = new FormData(); fd.append('file', file);
    try {
      const res  = await fetch('/api/chat/upload', { method: 'POST', headers: ChatUtils.authHeaders(), body: fd });
      const data = await res.json();
      if (!data.ok) return;
      S.socket.emit('moderation:review_message', { userId, content: data.url, senderId: S.currentUser.id, type: data.type });
      const cId = isMod ? 'review-chat-messages' : 'user-review-chat-messages';
      const c   = document.getElementById(cId);
      const row = document.createElement('div');
      row.className = 'bubble-row sent';
      row.innerHTML = `<div class="bubble sent">${_renderReviewMedia(data.type, data.url)}<div class="msg-time">${new Date().toLocaleTimeString()}</div></div>`;
      c.appendChild(row); c.scrollTop = c.scrollHeight;
    } catch (e) { console.error('[ModChat] upload error:', e); }
  }

  return {
    _initReviewChat, _openReviewChat, _sendReviewMessage, _decideUser,
    _showReviewChatForUser, _sendUserReviewMessage, _sendReviewFile,
    _renderReviewMedia, _appendReviewMessage, _appendModeratorMessage, _appendSystemMessage
  };
})();
