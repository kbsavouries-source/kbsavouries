const CACHE_NAME = 'kb-savouries-v67';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './css/order.css',
  './Assets/logo.png',
  './Assets/bg.png',
  './Assets/crunch sfx.wav',
  './Assets/payment-qr.jpeg',
  // NOTE: order.html, order.js, and products-data.js have been removed 
  // from pre-caching to guarantee live, up-to-date pricing on every visit.
];

// Install Event — Caches core static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event — Clean up old caches immediately and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  event.waitUntil(self.clients.claim());
});

// Fetch Event — Network-only for pricing/order scripts, Network-first for static assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Bypass service worker cache completely for product data and order logic
  if (url.pathname.endsWith('products-data.js') || url.pathname.endsWith('order.js')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});