// Simple app-shell service worker.
// Bump CACHE_VERSION when you change any of the cached files below.
const CACHE_VERSION = 'v1';
const CACHE_NAME = `tracker-${CACHE_VERSION}`;
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './firebase-config.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// Cache-first for same-origin app shell; network-only for everything else
// (Firebase, Chart.js CDN — those cache themselves in memory / IndexedDB).
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(resp => {
        // Cache new same-origin GETs opportunistically
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone)).catch(() => {});
        return resp;
      }).catch(() => cached);
    })
  );
});
