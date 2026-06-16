'use strict';
const CACHE   = 'chatapp-v5';
const OFFLINE = '/offline.html';
const STATIC  = [
  '/', '/index.html',
  '/css/base.css', '/css/animations.css', '/css/components.css',
  '/css/auth.css',  '/css/chat.css',       '/css/admin.css',
  '/js/antifreeze.js', '/js/crypto.js',  '/js/validate.js',
  '/js/avatar.js',     '/js/backup.js',  '/js/auth.js',
  '/js/chat.js',       '/js/admin.js',   '/js/router.js',
  '/js/app.js',        '/js/sw-register.js',
  '/vendor/socket.io.min.js', '/vendor/bcrypt.min.js',
  '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  /* API calls — network only, no cache */
  if (request.url.includes('/api/') || request.url.includes('/socket.io/')) return;

  e.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        if (!res || res.status !== 200 || res.type !== 'basic') return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(request, clone));
        return res;
      }).catch(() => caches.match(OFFLINE));
    })
  );
});

/* Background sync stub */
self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-messages') {
    console.log('[SW] Background sync: sync-messages');
  }
});

self.addEventListener('push', (e) => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'ChatApp', {
      body: data.body || 'Nuevo mensaje',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png'
    })
  );
});
