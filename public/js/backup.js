/* ── Backup & Restore ────────────────────────────────────────── */
'use strict';

const Backup = (() => {
  function _token() { return window._session?.token || ''; }

  async function download() {
    try {
      const res = await fetch('/api/backup/download', {
        headers: { Authorization: 'Bearer ' + _token() }
      });
      if (!res.ok) { Toast.show('Sin permisos o error', 'error'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const ts   = new Date().toISOString().slice(0,10);
      a.href     = url;
      a.download = `chat-backup-${ts}.db`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
      Toast.show('Respaldo descargado', 'success');
    } catch { Toast.show('Error al descargar respaldo', 'error'); }
  }

  async function downloadJSON() {
    try {
      const res  = await fetch('/api/backup/json', {
        headers: { Authorization: 'Bearer ' + _token() }
      });
      const data = await res.json();
      if (!data.ok) { Toast.show(data.msg || 'Error', 'error'); return; }
      const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const ts   = new Date().toISOString().slice(0,10);
      a.href     = url;
      a.download = `chat-backup-${ts}.enc.json`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
      Toast.show('Respaldo JSON descargado', 'success');
    } catch { Toast.show('Error al descargar JSON', 'error'); }
  }

  /* Auto-download recovery key JSON after registration */
  async function downloadRecoveryKey(code, email) {
    try {
      const obj  = await CryptoLayer.makeRecoveryFile(code, email);
      const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `recovery-key-${email.split('@')[0]}.json`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    } catch (e) {
      console.error('Recovery key download failed', e);
    }
  }

  return { download, downloadJSON, downloadRecoveryKey };
})();

window.Backup = Backup;
