'use strict';
/* ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  REPORT-MODAL — formulario de denuncia — window.ReportModal             ║
 * ║  open(msgId) → abre modal con emisor/receptor pre-llenados              ║
 * ║  close()     → elimina el overlay                                       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝ */
window.ReportModal = (() => {
  let _overlay = null;

  function _authHeaders() {
    return { Authorization: 'Bearer ' + (window._session?.token || '') };
  }

  function close() {
    _overlay?.remove();
    _overlay = null;
  }

  async function _submit(form, emitterId, emitterName, receiverId, msgId, room) {
    const description = form.querySelector('#rpt-description').value.trim();
    if (!description) {
      alert('Por favor describe la denuncia.');
      return;
    }
    const fd = new FormData();
    fd.append('emitter_id',  emitterId  || '');
    fd.append('receiver_id', receiverId || '');
    fd.append('message_id',  msgId      || '');
    fd.append('room',        room       || '');
    fd.append('description', description);
    const fileInput = form.querySelector('#rpt-evidence');
    if (fileInput.files[0]) fd.append('evidence', fileInput.files[0]);

    const btn = form.querySelector('#rpt-submit');
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    try {
      const res  = await fetch('/api/reports', { method: 'POST', headers: _authHeaders(), body: fd });
      if (!res.ok && res.headers.get('content-type')?.includes('text/html')) {
        throw new Error(`HTTP ${res.status} — reinicia el servidor`);
      }
      const data = await res.json();
      if (data.ok) {
        close();
        _showBlockModal(emitterId, emitterName);
      } else {
        alert('Error: ' + (data.msg || 'No se pudo enviar la denuncia'));
        btn.disabled = false;
        btn.textContent = 'Enviar denuncia';
      }
    } catch (e) {
      alert('Error de red al enviar la denuncia');
      btn.disabled = false;
      btn.textContent = 'Enviar denuncia';
    }
  }

  function open(msgId) {
    /* Obtener info del mensaje desde el DOM */
    const row    = document.querySelector(`[data-msg-id="${msgId}"]`);
    const isSent = row?.classList.contains('sent');
    const senderName = row?.dataset.senderName || 'Desconocido';
    const senderId   = row?.dataset.senderId   || '';
    const me         = window._session?.user;
    const active     = typeof ChatMessages !== 'undefined' ? ChatMessages.getActive() : null;

    const emitterName  = isSent ? (me?.name || 'Yo') : senderName;
    const emitterId    = isSent ? (me?.id   || '')   : senderId;
    const receiverName = isSent ? (active?.name || 'Receptor') : (me?.name || 'Yo');
    const receiverId   = isSent ? (active?.id   || '')         : (me?.id   || '');
    const room = row?.dataset.room || '';
    const ts   = new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });

    if (_overlay) close();
    _overlay = document.createElement('div');
    _overlay.className = 'report-overlay';
    _overlay.innerHTML = `
      <div class="report-card glass-card">
        <button class="report-close" onclick="ReportModal.close()">✕</button>
        <h3 class="report-title">🚨 Enviar Denuncia</h3>
        <div class="report-field"><label>Emisor</label>
          <input type="text" value="${ChatUtils.escape(emitterName)}" readonly class="report-input-ro"></div>
        <div class="report-field"><label>Receptor</label>
          <input type="text" value="${ChatUtils.escape(receiverName)}" readonly class="report-input-ro"></div>
        <div class="report-field"><label>Fecha y hora del reporte</label>
          <input type="text" value="${ts}" readonly class="report-input-ro"></div>
        <div class="report-field"><label>Descripción de la denuncia <span class="req">*</span></label>
          <textarea id="rpt-description" class="report-textarea" rows="4"
            placeholder="Describe lo que consideras inapropiado o anómalo…"></textarea></div>
        <div class="report-field"><label>Evidencia (imagen opcional)</label>
          <label class="report-clip-btn">
            📎 Adjuntar imagen
            <input id="rpt-evidence" type="file" accept="image/*" style="display:none"
              onchange="document.getElementById('rpt-filename').textContent=this.files[0]?.name||''">
          </label>
          <span id="rpt-filename" class="report-filename"></span></div>
        <button id="rpt-submit" class="btn report-submit-btn">Enviar denuncia</button>
      </div>`;
    document.body.appendChild(_overlay);
    _overlay.querySelector('#rpt-submit').onclick = () =>
      _submit(_overlay.querySelector('.report-card'), emitterId, emitterName, receiverId, msgId, room);
    _overlay.addEventListener('click', e => { if (e.target === _overlay) close(); });
  }

  function _showBlockModal(emitterId, emitterName) {
    const name = emitterName || 'esta persona';
    const ov = document.createElement('div');
    ov.className = 'report-overlay';
    ov.innerHTML = `
      <div class="report-card glass-card block-confirm-card">
        <div class="block-confirm-icon">✅</div>
        <p class="block-confirm-msg">Su mensaje ha sido enviado a las moderadoras para revisar el caso.</p>
        <h3 class="block-confirm-title">¿Desea bloquear a <span>${ChatUtils.escape(name)}</span>?</h3>
        <p class="block-confirm-sub">Si bloqueas a esta persona ya no aparecerá en tu lista de chats.</p>
        <div class="block-confirm-actions">
          <button id="btn-do-block" class="btn block-btn-danger">🚫 Bloquear</button>
          <button id="btn-keep-chat" class="btn block-btn-safe">💬 Seguir Chateando</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#btn-do-block').onclick  = () => _blockUser(emitterId, ov);
    ov.querySelector('#btn-keep-chat').onclick = () => ov.remove();
  }

  async function _blockUser(emitterId, ov) {
    if (!emitterId) { ov.remove(); return; }
    const h = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (window._session?.token || '') };
    try {
      const res  = await fetch('/api/blocks', { method: 'POST', headers: h, body: JSON.stringify({ blocked_id: emitterId }) });
      const data = await res.json();
      ov.remove();
      if (data.ok) {
        /* Recargar lista para excluir al bloqueado y cerrar el chat */
        if (typeof Chat !== 'undefined') { Chat.closeChat?.(); Chat.loadUsers?.(); }
        const t = document.createElement('div');
        t.className = 'toast toast-success';
        t.textContent = '🚫 Usuario bloqueado';
        document.getElementById('toast-container')?.appendChild(t);
        setTimeout(() => t.remove(), 3000);
      }
    } catch (e) { ov.remove(); }
  }

  return { open, close };
})();
