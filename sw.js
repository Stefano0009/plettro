// Service worker di Plettro.
// - Con internet: scarica sempre la versione più recente dei file (e la salva).
// - Senza internet: usa l'ultima copia salvata.
// Non serve più cambiare nulla in questo file quando aggiorni l'app.
const CACHE = 'plettro-app';
const FONTS = 'plettro-fonts';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const TIMEOUT = 4000;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function withTimeout(p, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(r => { clearTimeout(t); resolve(r); }, err => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    // Il controllo aggiornamenti dell'app chiede sempre la versione online
    if (url.searchParams.has('v')) return;
    const isPage = req.mode === 'navigate';
    const key = isPage ? './index.html' : req;
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await withTimeout(fetch(isPage ? new Request(req.url, { cache: 'no-cache' }) : new Request(req, { cache: 'no-cache' })), TIMEOUT);
        if (res && res.ok) cache.put(key, res.clone());
        return res;
      } catch (err) {
        const hit = await cache.match(key, { ignoreSearch: true });
        return hit || Response.error();
      }
    })());
    return;
  }

  // Font di Google: salvati alla prima apertura
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONTS).then(c => c.match(req).then(r => r || fetch(req).then(res => { c.put(req, res.clone()); return res; })))
    );
  }
});
