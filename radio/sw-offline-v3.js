// sw-offline-v4.js — cache-first + controllable background-image prefetch

// Dedicated cache just for background images
const BG_CACHE = 'ge-backgrounds-v1';

let bgDownloading = false;
let bgAbortController = null;

// --- Basic lifecycle (same behavior as before) ---

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

// Cache-first for all same-origin GET requests (keeps music + app working offline)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request))
  );
});

// --- Utility: broadcast status to all open clients ---

async function broadcast(message) {
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage(message);
  }
}

// --- Utility: get list of background files from img/manifest.json ---

async function getBackgroundFiles() {
  try {
    const res = await fetch('/img/manifest.json', { cache: 'no-store' });
    if (!res.ok) return [];
    const list = await res.json();
    if (!Array.isArray(list)) return [];

    // Normalize to "img/filename.ext"
    return list
      .map((name) => {
        if (typeof name !== 'string') return null;
        return name.startsWith('img/') ? name : 'img/' + name;
      })
      .filter(Boolean);
  } catch (err) {
    return [];
  }
}

// --- Background image pre-download logic ---

async function startBackgroundDownload() {
  if (bgDownloading) return; // already running

  bgDownloading = true;
  bgAbortController = typeof AbortController !== 'undefined'
    ? new AbortController()
    : null;
  const signal = bgAbortController ? bgAbortController.signal : undefined;

  const files = await getBackgroundFiles();
  if (!files.length) {
    bgDownloading = false;
    bgAbortController = null;
    await broadcast({ type: 'BG_DONE', done: 0, total: 0 });
    return;
  }

  const cache = await caches.open(BG_CACHE);
  let done = 0;

  for (const path of files) {
    if (!bgDownloading || (signal && signal.aborted)) break;

    try {
      // Ensure leading slash once
      const urlPath = '/' + path.replace(/^\/+/, '');
      const req = new Request(urlPath);

      const resp = signal
        ? await fetch(req, { signal })
        : await fetch(req);

      if (resp && resp.ok) {
        await cache.put(req, resp.clone());
      }
    } catch (err) {
      // Ignore individual errors and continue
    }

    done += 1;
    await broadcast({ type: 'BG_PROGRESS', done, total: files.length });
  }

  bgDownloading = false;
  bgAbortController = null;
  await broadcast({ type: 'BG_DONE', done, total: files.length });
}

function stopBackgroundDownload() {
  bgDownloading = false;
  if (bgAbortController) {
    try { bgAbortController.abort(); } catch (err) {}
  }
}

async function clearBackgroundCache() {
  await caches.delete(BG_CACHE);
  await broadcast({ type: 'BG_CLEARED' });
}

// --- Message API for the page (offline button talks to this) ---

self.addEventListener('message', (event) => {
  const data = event.data || {};
  switch (data.type) {
    case 'START_BG_DOWNLOAD':
      event.waitUntil(startBackgroundDownload());
      break;
    case 'STOP_BG_DOWNLOAD':
      stopBackgroundDownload();
      break;
    case 'CLEAR_BG_CACHE':
      event.waitUntil(clearBackgroundCache());
      break;
    default:
      // ignore unknown messages
      break;
  }
});
