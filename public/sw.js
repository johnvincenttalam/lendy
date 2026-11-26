// Filled in at build time (build/precache.ts): a version per build, and every
// built file, so pages open offline even if they were never visited online.
const BUILD = 'dev' /*__BUILD__*/
const PRECACHE = [] /*__PRECACHE__*/
const CACHE_NAME = `ollie-${BUILD}`

// Page code is fetched as module scripts, which send an Origin header the
// precache requests didn't; a `Vary: Origin` response would then never match.
const MATCH = { ignoreVary: true }

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([...APP_SHELL, ...PRECACHE]))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
      self.clients.claim(),
    ])
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navigation requests: network-first, fall back to cached index.html so
  // deep links (e.g. /calendar) work offline even if never visited online.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then((c) => c.put(request, clone))
          }
          return res
        })
        .catch(() =>
          caches.match(request, MATCH).then((cached) => cached || caches.match('./index.html', MATCH))
        )
    )
    return
  }

  // Static assets: network-first, cache only successful basic responses.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((c) => c.put(request, clone))
        }
        return res
      })
      .catch(() => caches.match(request, MATCH))
  )
})
