/* Offline app shell. API calls are never cached.
 *
 * Strategy: network-first, falling back to cache. That way a redeploy is
 * picked up immediately when online, and the app still opens offline.
 * (A pure cache-first SW would pin users to the first version they ever
 * loaded, which is exactly the bug this replaced.)
 */
const CACHE = 'seera-v7';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './nutrients.js',
  './foods.js',
  './firebase-config.js',
  './cloud.js',
  './i18n.js',
  './ai.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Anything not same-origin (i.e. the Anthropic API) goes straight to network.
  if (url.origin !== self.location.origin || e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then(hit => hit || caches.match('./index.html'))
      )
  );
});
