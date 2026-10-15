// Offline-Cache: Network-first für HTML, Cache-first für gehashte Assets.
const CACHE = 'greyveil-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === 'navigate';
  e.respondWith(
    (isPage
      ? fetch(req).then((res) => put(req, res)).catch(() => caches.match(req).then((r) => r || caches.match('/')))
      : caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res)))),
  );
});

function put(req, res) {
  if (res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}
