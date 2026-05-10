const CACHE = 'greyveil-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/']))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Network-first for API — offline fallback returns safe default
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        Response.json({ strategy: 'gather', reason: 'Offline' })
      )
    )
    return
  }

  // Cache-first for Next.js static bundles (hashed filenames never change)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ??
          fetch(event.request).then((res) => {
            caches.open(CACHE).then((c) => c.put(event.request, res.clone()))
            return res
          })
      )
    )
    return
  }

  // Network-first with cache fallback for everything else
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        caches.open(CACHE).then((c) => c.put(event.request, res.clone()))
        return res
      })
      .catch(() => caches.match(event.request))
  )
})
