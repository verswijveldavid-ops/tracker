// Pass-through service worker. Kept alive so the PWA stays installable,
// but does NOT cache anything — every request goes to the network.
// On activation, wipes any old caches from previous versions.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// No fetch handler — browser fetches normally from network.
