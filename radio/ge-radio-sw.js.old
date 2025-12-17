// ge-radio-sw-v2.js
// Purpose: keep the RADIO SHELL fresh, and allow offline fallback without trying to cache gigabytes of audio.
// Strategy:
//   - Same-origin navigation + assets: network-first, fall back to cache.
//   - Cache updates automatically.
//   - Cross-origin (raw.githubusercontent.com etc.): passthrough (no caching) to avoid range/CORS pain.

const CACHE_NAME = 'ge-radio-shell-v2';

const SHELL_URLS = [
  './',
  './index.html',
  './ge-radio-sw.js',
  './music/manifest.json',
  './img/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try { await cache.addAll(SHELL_URLS); } catch (_) { /* ignore */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))));
    self.clients.claim();
  })());
});

function sameOrigin(req){
  try { return new URL(req.url).origin === self.location.origin; }
  catch { return false; }
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Do not cache cross-origin (music/images repos)
  if (!sameOrigin(req)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Network-first for same-origin so updates land quickly.
    try {
      const fresh = await fetch(req, { cache: 'no-store' });
      // cache only OK basic responses
      if (fresh && fresh.ok && (fresh.type === 'basic' || fresh.type === 'default')) {
        cache.put(req, fresh.clone()).catch(()=>{});
      }
      return fresh;
    } catch (e) {
      const cached = await cache.match(req);
      if (cached) return cached;

      // If navigation fails, fall back to cached index if available
      if (req.mode === 'navigate') {
        const fallback = await cache.match('./index.html');
        if (fallback) return fallback;
      }
      throw e;
    }
  })());
});

self.addEventListener('message', event => {
  const msg = event.data || {};
  if (msg && msg.type === 'CLEAR_OFFLINE_CACHE') {
    event.waitUntil((async () => {
      await caches.delete(CACHE_NAME);
      const cache = await caches.open(CACHE_NAME);
      try { await cache.addAll(SHELL_URLS); } catch (_) {}
      // notify clients
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      clients.forEach(c => c.postMessage({ type: 'CACHE_CLEARED' }));
    })());
  }
});
