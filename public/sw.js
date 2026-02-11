const CACHE_NAME = 'anh-wms-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon.svg',
  '/offline'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  const requestUrl = new URL(event.request.url);

  // API 요청 및 비GET 요청은 캐시하지 않음 (저장/인증 동작 안정성)
  if (requestUrl.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    return;
  }

  // Next.js 빌드 자산은 네트워크 우선 (배포 직후 구버전 캐시 방지)
  if (requestUrl.pathname.startsWith('/_next/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // For navigation requests (pages), try network first, then cache, then offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request)
            .then((response) => {
              if (response) return response;
              return caches.match('/offline');
            });
        })
    );
    return;
  }

  // For other requests (assets, images), try cache first, then network
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
