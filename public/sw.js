// Ember PWA Service Worker
const CACHE_NAME = 'ember-cache-v1';
const ASSETS = [
  '/',
  '/styles.css',
  '/3d.css',
  '/floorplan.css',
  '/app.js',
  '/map.js',
  '/building3d.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Pass API and live socket requests through network
  if (event.request.url.includes('/api/') || event.request.url.includes('/socket.io/') || event.request.url.includes('/download/')) {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
