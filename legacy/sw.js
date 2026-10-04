/* Service worker — coque de l'application en cache, tuiles servies hors ligne */

const SHELL = 'fanisana-shell-v2';
const TILES = 'fanisana-tiles-v1';

const FILES = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'data.json',
  'manifest.webmanifest',
  'vendor/leaflet.js',
  'vendor/leaflet.css',
  'vendor/images/marker-icon.png',
  'vendor/images/marker-icon-2x.png',
  'vendor/images/marker-shadow.png',
  'vendor/images/layers.png',
  'vendor/images/layers-2x.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL)
      .then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== TILES).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isTile = url =>
  url.hostname.includes('arcgisonline.com') || url.hostname.includes('tile.openstreetmap.org');

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Tuiles : cache d'abord, puis réseau, et on garde ce qui passe.
  if (isTile(url)) {
    e.respondWith(
      caches.open(TILES).then(async cache => {
        const hit = await cache.match(req.url);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req.url, res.clone());
          return res;
        } catch {
          return new Response('', { status:504, statusText:'Tuile absente du cache' });
        }
      })
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // Navigation : la page d'accueil, même hors ligne.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('index.html', { cacheName:SHELL }))
    );
    return;
  }

  // Ressources de l'application : cache d'abord, réseau en secours.
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(SHELL).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => new Response('', { status:504, statusText:'Hors ligne' }));
    })
  );
});
