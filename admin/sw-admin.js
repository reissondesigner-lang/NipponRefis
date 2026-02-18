const CACHE_NAME = "admin-cache-v1";

const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./admin.js"
];

// INSTALAÇÃO
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

// ATIVAÇÃO
self.addEventListener("activate", (event) => {
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

// FETCH
self.addEventListener("fetch", (event) => {

  // Só intercepta requisições do próprio admin
  if (!event.request.url.includes("/admin/")) return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request)
          .then(fetchResponse => {

            // Atualiza cache dinamicamente
            return caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, fetchResponse.clone());
                return fetchResponse;
              });

          })
          .catch(() => {
            // Fallback simples offline
            return caches.match("./index.html");
          });
      })
  );
});
