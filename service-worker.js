// service-worker.js
const CACHE_NAME = 'kratcom-cache-v1';
// Esta lista debe incluir los archivos esenciales para que el "cascarón" de la app funcione sin conexión.
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Evento de instalación: abre una caché y añade los archivos principales de la app.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento fetch: sirve las peticiones desde la caché primero.
// Si la petición no está en la caché, la busca en la red,
// la guarda en caché y luego la devuelve.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - devolver la respuesta desde la caché
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          response => {
            // Comprobar si recibimos una respuesta válida
            if (!response || response.status !== 200) {
              return response;
            }
            
            // Omitimos las respuestas de extensiones de Chrome
            if(event.request.url.indexOf('chrome-extension') === 0) {
              return response;
            }

            // IMPORTANTE: Clonar la respuesta. Una respuesta es un stream
            // y como queremos que tanto el navegador como la caché consuman la respuesta,
            // necesitamos clonarla para tener dos streams.
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                // Solo guardamos en caché peticiones GET válidas
                if(event.request.method === 'GET') {
                    cache.put(event.request, responseToCache);
                }
              });

            return response;
          }
        );
      })
  );
});

// Evento de activación: limpia cachés antiguas.
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});