const CACHE_NAME = 'anh-wms-v3';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon.svg',
  '/offline'
];

async function getOfflineResponse() {
  const cachedOffline = await caches.match('/offline');
  if (cachedOffline) {
    return cachedOffline;
  }

  return new Response('오프라인 상태입니다.', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

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
      (async () => {
        try {
          return await fetch(event.request);
        } catch {
          const cachedResponse = await caches.match(event.request);
          return cachedResponse || new Response('', { status: 504, statusText: 'Gateway Timeout' });
        }
      })()
    );
    return;
  }

  // For navigation requests (pages), try network first, then cache, then offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.type !== 'error') {
            return networkResponse;
          }
        } catch {
          // fall through to cache/offline
        }

        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        return getOfflineResponse();
      })()
    );
    return;
  }

  // For other requests (assets, images), try cache first, then network
  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        return await fetch(event.request);
      } catch {
        return new Response('', { status: 504, statusText: 'Gateway Timeout' });
      }
    })()
  );
});
