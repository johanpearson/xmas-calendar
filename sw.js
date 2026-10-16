// Service worker: makes the app work offline after the first visit.
//
// Bump CACHE_VERSION whenever anything in the app shell changes (HTML, CSS, JS, icons,
// manifest). Pure content changes in content/days.json or content/tomte.json need no
// bump: those files are served stale-while-revalidate, so edits reach the phone on the
// next start.
const CACHE_VERSION = 'v16';

const SHELL_CACHE = `advent-shell-${CACHE_VERSION}`;
// Not versioned, so the last known content survives a shell update.
const CONTENT_CACHE = 'advent-content';

// Paths relative to the service worker's scope (the site may live under /<repo>/).
const SHELL_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'css/scenes.css',
  'js/app.js',
  'js/dates.js',
  'js/storage.js',
  'js/dev.js',
  'js/install.js',
  'js/scene.js',
  'js/themes.js',
  'js/icons.js',
  'js/effects.js',
  'js/tomte.js',
  'js/tomte-ui.js',
  'js/audio.js',
  'js/melodies.js',
  'js/voice.js',
  'js/audio-ui.js',
  'js/weather.js',
  'js/scenes.js',
  'js/card.js',
  'js/latency.js',
  'icons/favicon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon-180.png',
];
const CONTENT_FILES = ['content/days.json', 'content/tomte.json'];

const scoped = (path) => new URL(path, self.registration.scope).href;

// cache: 'reload' skips the browser's HTTP cache so a new version never precaches stale files.
async function precache(cacheName, paths) {
  const cache = await caches.open(cacheName);
  await cache.addAll(paths.map((p) => new Request(scoped(p), { cache: 'reload' })));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      await precache(SHELL_CACHE, SHELL_FILES);
      // The first page load fetches the content before this worker controls the page,
      // so cache it here too, otherwise the app would not start offline.
      await precache(CONTENT_CACHE, CONTENT_FILES);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, CONTENT_CACHE]);
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith('advent-') && !keep.has(n)).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

// Cache first: the shell only changes when CACHE_VERSION is bumped.
async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(SHELL_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

const withoutQuery = (url) => url.origin + url.pathname;
const isAppPage = (url) => [scoped('./'), scoped('index.html')].includes(withoutQuery(url));

// Navigations to the app (including ?dev=on) get the cached index.html.
async function navigate(request) {
  const cached = await caches.match(scoped('index.html'));
  return cached ?? fetch(request);
}

// Stale-while-revalidate: answer from the cache at once, refresh it in the background.
async function staleWhileRevalidate(event, key) {
  const cache = await caches.open(CONTENT_CACHE);
  const cached = await cache.match(key);
  const refresh = fetch(key, { cache: 'no-cache' }).then(async (response) => {
    if (response.ok) await cache.put(key, response.clone());
    return response;
  });
  if (cached) {
    event.waitUntil(refresh.catch(() => {})); // offline: keep the cached copy
    return cached;
  }
  return refresh;
}

// Only same-origin GETs inside the app's scope are handled. Everything else, such as the
// weather forecast from api.open-meteo.com, goes straight to the network and is never
// cached here (weather.js keeps its own short-lived cache in localStorage).
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;

  const contentKey = CONTENT_FILES.map(scoped).find((key) => key === withoutQuery(url));
  if (contentKey) {
    event.respondWith(staleWhileRevalidate(event, contentKey));
  } else if (request.mode === 'navigate' && isAppPage(url)) {
    event.respondWith(navigate(request));
  } else {
    event.respondWith(cacheFirst(request));
  }
});
