// Service worker: makes the app installable and lets it open offline.
// App files: cache first (updated in the background). Weather data: network first, last answer as offline fallback.
// Map tiles are not cached (OpenStreetMap policy discourages bulk caching).
const VERSION = 'weather-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { mode: u.startsWith('http') ? 'cors' : 'same-origin' })).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Weather, place lookups: network first, fall back to the last cached answer
  if (/(^|\.)open-meteo\.com$/.test(url.hostname) || url.hostname === 'nominatim.openstreetmap.org') {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION + '-data').then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req)));
    return;
  }
  if (url.hostname === 'tile.openstreetmap.org') return;   // let the browser handle tiles

  // App shell: cache first, refresh in the background
  e.respondWith(caches.match(req, { ignoreSearch: url.origin === location.origin }).then(hit => {
    const net = fetch(req).then(res => {
      if (res.ok && (url.origin === location.origin || url.hostname === 'unpkg.com')) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
