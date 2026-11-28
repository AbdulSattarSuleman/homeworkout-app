// Service Worker for Home Workout PWA
// IMPORTANT: when you change any ?v= number in web/index.html, change the SAME
// number in PRECACHE_URLS below AND bump CACHE_NAME, or offline mode will miss files.
// Whenever index.html or referenced assets change, bump the cache version here.
const CACHE_NAME = 'hw-app-v3.20';
const RUNTIME_CACHE = 'hw-runtime-v1';
const RUNTIME_CACHE_LIMIT = 120; // pictures + animations kept for offline use

// Pre-cached App Shell files (relative URLs so it works on GitHub Pages subpaths)
const PRECACHE_URLS = [
  './',
  'index.html',
  'manifest.json',
  'css/homeworkout.css?v=3.18',
  'js/exercises.js?v=3.15',
  'js/store.js?v=3.17',
  'js/plan.js?v=3.15',
  'js/visuals.js?v=3.15',
  'js/telemetry.js?v=3.15',
  'js/homeworkout.js?v=3.19',
  'data/exercises_database.json',
  'assets/img/logo-icon.png',
  'assets/img/logo-icon-192.png',
  'assets/img/badge-bronze.png',
  'assets/img/badge-silver.png',
  'assets/img/badge-gold.png',
  'assets/img/badge-blue.png',
  'assets/img/hero-banner.png',
  'assets/img/workout-1.png',
  'assets/img/workout-2.png',
  'assets/img/workout-3.png',
  'assets/img/workout-4.png',
  'assets/img/workout-5.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.48.1'
];

// Helper to keep runtime cache size bounded
async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const deleteCount = keys.length - maxItems;
      for (let i = 0; i < deleteCount; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch (e) {
    // Ignore cache trimming errors
  }
}

// Install Event: Pre-cache app shell files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

// Activate Event: Delete old hw-app-* caches & claim clients
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key.startsWith('hw-app-') && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Message Event: Allow waiting worker to skip waiting when user confirms update
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch Event: Custom routing rules
self.addEventListener('fetch', event => {
  const req = event.request;

  // 1. Only handle GET requests; let others pass through directly
  if (req.method !== 'GET') {
    return;
  }

  const url = new URL(req.url);

  // 2. Supabase API calls (*.supabase.co): NEVER cache, always go to network
  if (url.hostname.endsWith('supabase.co')) {
    event.respondWith(fetch(req));
    return;
  }

  // 3. Navigation requests: Network-first, fallback to cached index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => {
        return caches.match('index.html').then(cached => cached || caches.match('./'));
      })
    );
    return;
  }

  // 4. Runtime Cache: Exercise GIFs/thumbnails (raw.githubusercontent.com) and Google Fonts
  const isGithubAsset = url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/exercises-dataset/');
  const isGoogleFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  if (isGithubAsset || isGoogleFont) {
    // Stale-while-revalidate with a size limit.
    // <img> and <link> requests to other sites are "no-cors", which gives an opaque
    // response (status 0) that we can't check and that browsers count as very large.
    // These hosts allow CORS, so fetch a normal (CORS) copy instead: it can be checked,
    // cached at its real size, and still shown by the page.
    const corsReq = new Request(req.url, { mode: 'cors', credentials: 'omit' });
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async cache => {
        const cachedResponse = await cache.match(req.url);
        const fetchPromise = fetch(corsReq).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(req.url, networkResponse.clone()).then(() => trimCache(RUNTIME_CACHE, RUNTIME_CACHE_LIMIT));
          }
          return networkResponse;
        }).catch(() => fetch(req).catch(() => Response.error()));

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 5. App Shell & CDN files: Cache-first, fallback to network
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(networkResponse => {
        // Cache successful jsdelivr requests if not precached
        if (networkResponse && networkResponse.status === 200 && url.hostname === 'cdn.jsdelivr.net') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return networkResponse;
      });
    })
  );
});
