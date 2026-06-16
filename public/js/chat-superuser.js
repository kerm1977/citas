/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  CHAT-SUPERUSER — modal de contacto de superusuario — NO MODIFICAR      ║
 * ║  Extiende ChatUI. Se carga DESPUÉS de chat-ui.js.                       ║
 * ║  _pendingSuperuser: estado local de este módulo, NO de ChatUI.          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
'use strict';

(function () {
  let _pendingSuperuser = null;

  async function checkSuperuserContacts() {
    try {
      const res  = await fetch('/api/chat/superuser-contacts', { headers: ChatUtils.authHeaders() });
      const data = await res.json();
      if (!data.ok || !data.contacts || data.contacts.length === 0) return;

      const contact = data.contacts[0];
      _pendingSuperuser = {
        id: contact.superuser_id,
        name: contact.superuser_name,
        avatar: contact.superuser_avatar,
        contactId: contact.id
      };
      document.getElementById('superuser-name').textContent = contact.superuser_name || 'Superusuario';
      document.getElementById('superuser-modal').classList.remove('hidden');
    } catch (e) {
      console.error('[Chat] Error checking superuser contacts:', e);
    }
  }

  function closeSuperuserModal() {
    document.getElementById('superuser-modal').classList.add('hidden');
    if (_pendingSuperuser?.contactId) {
      fetch(`/api/chat/superuser-contacts/${_pendingSuperuser.contactId}/acknowledge`, {
        method: 'POST',
        headers: ChatUtils.authHeaders()
      }).catch(e => console.error('[Chat] Error acknowledging contact:', e));
    }
    _pendingSuperuser = null;
  }

  function openSuperuserChat() {
    if (!_pendingSuperuser) return;
    ChatUI.openChat(_pendingSuperuser.id);
    closeSuperuserModal();
  }

  /* Añadir al módulo ChatUI */
  Object.assign(window.ChatUI, { checkSuperuserContacts, closeSuperuserModal, openSuperuserChat });
})();
