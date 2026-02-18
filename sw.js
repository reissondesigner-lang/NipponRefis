const CACHE_NAME = 'nipponsync-v2';

const STATIC_ASSETS = [
  '/NipponRefis/',
  '/NipponRefis/index.html',
  '/NipponRefis/style.css',
  '/NipponRefis/app.js',
  '/NipponRefis/icon-512.png'
];

// INSTALL
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// ACTIVATE
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// FETCH
self.addEventListener('fetch', event => {

  // Só GET
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 🚫 NÃO INTERCEPTA FIREBASE
  if (url.origin.includes('firebase')) return;

  // 📌 Para navegação (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 📦 Para arquivos estáticos
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request)
    )
  );
});
