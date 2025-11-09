const CACHE = 'reward-server-v6';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Cache strategy:
// - Navigation requests: network-first, fallback to cached index.html for offline
// - Static assets (same-origin GET, not API): cache-first
// - API GETs: network-first with cache fallback (best-effort)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return; // don't mess with mutations

  // Navigations
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html'))
    );
    return;
  }

  const isSameOrigin = url.origin === self.location.origin;
  const isApi = isSameOrigin && (/^\/(tasks|rewards|balance|ledger|recurring|auth|notify)/.test(url.pathname));

  // Static assets: cache-first
  if (isSameOrigin && !isApi) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const resClone = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, resClone));
        return res;
      }))
    );
    return;
  }

  // API GETs: network-first with cache fallback
  if (isApi) {
    event.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, clone));
        return res;
      }).catch(() => caches.match(req))
    );
  }
});
