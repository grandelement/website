/* GE Radio Service Worker — range-safe cache */
const CACHE_NAME = 'ge-radio-v1';

// Helper: detect audio
function isAudio(url){
  return /\.(mp3|m4a|aac|ogg|wav|flac)$/i.test(url.pathname);
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Range requests need special handling (especially for audio)
  const rangeHeader = req.headers.get('range');

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // AUDIO: cache-first with range support; network fallback.
    if (isAudio(url)) {
      const cached = await cache.match(req.url, { ignoreSearch: true, ignoreVary: true });
      if (cached) {
        // If no range header, return full cached response
        if (!rangeHeader) return cached;

        // Range requested: slice cached body and return 206
        try{
          const buf = await cached.arrayBuffer();
          const size = buf.byteLength;
          // Parse "bytes=start-end"
          const m = /bytes=(\d+)-(\d+)?/i.exec(rangeHeader);
          if (!m) return cached;
          const start = parseInt(m[1], 10);
          const end = m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1;
          if (start >= size || start > end) {
            return new Response(null, { status: 416, statusText: 'Range Not Satisfiable' });
          }
          const sliced = buf.slice(start, end + 1);
          const headers = new Headers(cached.headers);
          headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
          headers.set('Accept-Ranges', 'bytes');
          headers.set('Content-Length', String(sliced.byteLength));
          // Some caches lose content-type; ensure it exists
          if (!headers.get('Content-Type')) headers.set('Content-Type', 'audio/mpeg');
          return new Response(sliced, { status: 206, statusText: 'Partial Content', headers });
        }catch(e){
          // Fallback to cached full response
          return cached;
        }
      }

      // Not cached: go to network (do not cache range responses)
      const net = await fetch(req);
      try{
        // Cache only full (200) responses to avoid truncation
        if (net.ok && net.status === 200) {
          cache.put(req.url, net.clone());
        }
      }catch(_){}
      return net;
    }

    // NON-AUDIO: cache-first, network fallback; update cache on success.
    const hit = await cache.match(req, { ignoreSearch: true, ignoreVary: true });
    if (hit) return hit;

    const net = await fetch(req);
    try{
      if (net.ok && net.status === 200) cache.put(req, net.clone());
    }catch(_){}
    return net;
  })());
});
