const CACHE_NAME = 'padel-calendar-v1';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap'
];

// ── INSTALL: cachear archivos esenciales ──────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpiar caches viejas ───────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: servir desde cache, fallback a red ─
self.addEventListener('fetch', event => {
  // Solo manejar requests GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Cachear solo respuestas válidas y del mismo origen o fuentes conocidas
        if (
          response &&
          response.status === 200 &&
          (event.request.url.startsWith(self.location.origin) ||
           event.request.url.includes('fonts.googleapis.com') ||
           event.request.url.includes('fonts.gstatic.com'))
        ) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Sin conexión y sin cache: devolver index.html como fallback
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ── NOTIFICACIONES PUSH (Web Push API) ────────
self.addEventListener('push', event => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch(e) {
    data = { title: 'Padel Calendar', body: event.data.text() };
  }

  const options = {
    body: data.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || './' },
    actions: [
      { action: 'open', title: 'Ver evento' },
      { action: 'close', title: 'Cerrar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Padel Calendar', options)
  );
});

// ── CLICK EN NOTIFICACIÓN ─────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'close') return;

  const urlToOpen = event.notification.data?.url || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
