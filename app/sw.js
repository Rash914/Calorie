// Service worker: precache the app shell + food DB, cache-first for same-origin assets, network-first for HTML.
const VERSION = 'aahar-0c74286f5a';
const SHELL = ['./', './index.html', './css/app.css', './manifest.webmanifest', './data/foods.json',
  './js/main.js', './js/util.js', './js/store.js', './js/foods.js', './js/parser.js', './js/speech.js', './js/calc.js', './js/router.js', './js/theme.js',
  './js/ui/components.js', './js/ui/add.js', './js/ui/home.js', './js/ui/log.js', './js/ui/calendar.js', './js/ui/plan.js', './js/ui/me.js', './js/ui/onboarding.js', './js/ui/scale.js', './js/credit.js',
  './icons/favicon.png', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];

self.addEventListener('message', (e) => { if (e.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('install', (e) => {
  // bypass the HTTP cache so a new SW always precaches fresh files; activation waits for the user's "Update now"
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) => fetch(u, { cache: 'reload' }).then((r) => { if (!r.ok) throw new Error('precache ' + u); return c.put(u, r); })))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    // fonts: cache opportunistically, fall back silently when offline
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
      e.respondWith(caches.open(VERSION + '-fonts').then(async (c) => { const hit = await c.match(req); if (hit) return hit; try { const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; } catch { return new Response('', { status: 503 }); } }));
    }
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { caches.open(VERSION).then((c) => c.put('./index.html', res.clone())); return res; }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone())); return res; })));
});
