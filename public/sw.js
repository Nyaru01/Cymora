// RÉSONANCE — hors ligne. Auteur : CLAUDE.
// La page vient du réseau quand il est là (pour recevoir les mises à jour), du cache sinon ;
// les autres fichiers viennent du cache et se rafraîchissent en arrière-plan.
const CACHE = 'resonance-v1';
const SHELL = ['./', './index.html', './manifest.json', './favicon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './shared/i18n.js', './src/app.js', './src/game.js', './src/strings.js', './src/styles.css', './src/audio.js',
  './src/cymatics.js', './src/engine.js', './src/render.js', './src/phrase.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put('./', copy));
      return res;
    }).catch(() => caches.match('./')));
    return;
  }
  event.respondWith(caches.match(req).then((hit) => {
    const fresh = fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    });
    return hit ?? fresh;
  }));
});
