/* ── Service Worker Registration ─────────────────────────────── */
'use strict';

(function () {
  if (!('serviceWorker' in navigator)) {
    console.info('[SW] Not supported');
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[SW] Registered ✅', reg.scope);

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            Toast?.show('Nueva versión disponible. Recarga para actualizar.', 'info', 8000);
          }
        });
      });
    } catch (err) {
      console.error('[SW] Registration failed', err);
    }
  });

  /* Background sync: queue failed messages */
  window._syncQueue = [];
  window._queueMessage = (msg) => {
    window._syncQueue.push(msg);
    navigator.serviceWorker.ready.then(reg => {
      if ('sync' in reg) reg.sync.register('sync-messages');
    });
  };
})();
