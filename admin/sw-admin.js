const CACHE_NAME = 'nipponsync-admin-v1';

const assets = [
  './',
  './index.html',
  './admin.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(assets))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );

  self.clients.claim();
});

self.addEventListener('fetch', event => {

  // Só trata requisições do admin
  if (!event.request.url.includes('/admin/')) return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request)
          .then(fetchRes => {
            return caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, fetchRes.clone());
                return fetchRes;
              });
          })
          .catch(() => caches.match('./index.html'));
      })
  );
});
