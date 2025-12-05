const CACHE_NAME = 'ge-radio-v1';

self.addEventListener('install', event => {
  // No hard precache here; index handles prefetch. Just activate immediately.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Clean old versions if you ever bump the cache name
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k.startsWith('ge-radio') && k !== CACHE_NAME)
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Only mess with same-origin stuff
  if (url.origin !== self.location.origin) return;

  const dest = req.destination;

  // For the main page: cache-first with network fallback
  if (dest === 'document') {
    event.respondWith(
      caches.match(req, {ignoreVary:true, ignoreSearch:true}).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
          return res;
        }).catch(() => cached || Response.error());
      })
    );
    return;
  }

  // For audio, images, scripts, styles: cache-first, then network
  if (['audio','image','style','script','font'].includes(dest) || url.pathname.endsWith('.m4a') || url.pathname.endsWith('.mp3')) {
    event.respondWith(
      caches.match(req, {ignoreVary:true, ignoreSearch:true}).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
          return res;
        });
      })
    );
  }
});
