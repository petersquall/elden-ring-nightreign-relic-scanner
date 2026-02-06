const CACHE_NAME = 'relic-scanner-v14';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/camera.js',
  './js/preprocessor.js',
  './js/ocr.js',
  './js/matcher.js',
  './js/effects-db.js',
  './js/relics-name-db.js',
  './js/relic-manager.js',
  './js/exporter.js',
  './js/ui.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (url.origin !== location.origin) {
    // CDN resources (Tesseract, Fuse) - network first, cache fallback
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // Local assets - NETWORK FIRST, cache fallback (always get latest version)
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  }
});
