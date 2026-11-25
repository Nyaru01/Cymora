// CYMORA — hors ligne et mises à jour. Auteur : CLAUDE.
// Chaque version a son propre cache : la page et ses fichiers viennent toujours de la même version.
// Une nouvelle version s'installe en arrière-plan puis attend : l'app propose de mettre à jour
// (message « skip »), et rien ne change sous les doigts de quelqu'un qui joue.
const VERSION = '1.6.1'; // à garder égal à la version de package.json (vérifié par les tests)
const CACHE = `cymora-${VERSION}`;
const SHELL = ['./', './manifest.json', './favicon.svg', './icons/icon-192.png', './icons/cymora-hero.jpg',
  './shared/i18n.js', './src/app.js', './src/game.js', './src/strings.js', './src/styles.css', './src/audio.js',
  './src/cymatics.js', './src/engine.js', './src/render.js', './src/phrase.js'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })));
    // Les toutes premières versions (cache « cymora-vN », « resonance-vN ») ne savent pas proposer
    // de mise à jour et mélangeaient ancienne et nouvelle page : on les remplace sans attendre.
    if ((await caches.keys()).some((k) => /^(cymora-v\d|resonance-v\d)/.test(k))) self.skipWaiting();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/vid/') || url.pathname === '/sw.js') return; // la vidéo se lit par plages, sans cache
  if (req.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then((c) => c.match('./')).then((hit) => hit ?? fetch(req)));
    return;
  }
  event.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) c.put(req, res.clone());
    return res;
  }));
});
