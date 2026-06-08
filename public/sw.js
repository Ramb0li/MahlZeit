// MahlZeit Service Worker
// Minimaler SW — reicht für Chrome-Installierbarkeit.
// Kein aggressives Caching, da die App serverseitig gerendert wird und
// Session-Cookies für Auth benötigt.

const CACHE_NAME = 'mahlzeit-v1';

// Statische Assets die gecacht werden dürfen
const STATIC_ASSETS = [
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Alte Caches aufräumen
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first für alle Requests — App ist online-only, kein Offline-Modus
self.addEventListener('fetch', (event) => {
  // Nur GET-Requests cachen, API-Calls immer zum Netzwerk
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  // Icons aus Cache bedienen wenn verfügbar
  if (STATIC_ASSETS.some((a) => event.request.url.endsWith(a))) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});
