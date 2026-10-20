const CACHE_NAME = 'anh-wms-v7';
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

function isAbortError(error) {
  return Boolean(error && (error.name === 'AbortError' || String(error.message || '').toLowerCase().includes('aborted')));
}

function shouldLeaveToBrowser(event, requestUrl) {
  if (event.request.method !== 'GET') return true;

  const path = requestUrl.pathname;
  if (
    path.startsWith('/api/') ||
    path.startsWith('/share/') ||
    path === '/product' ||
    path.startsWith('/product/') ||
    path.startsWith('/_next/')
  ) {
    return true;
  }

  // App Router RSC/프리페치는 중단되면 브라우저가 취소한다.
  // 여기서 504로 바꾸면 콘솔에 Gateway Timeout이 남는다.
  if (
    requestUrl.searchParams.has('_rsc') ||
    event.request.headers.get('RSC') === '1' ||
    event.request.headers.get('Next-Router-Prefetch') ||
    event.request.headers.get('Next-Router-State-Tree')
  ) {
    return true;
  }

  return false;
}

self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  const requestUrl = new URL(event.request.url);

  // API, 공유 페이지, Next 자산, RSC 요청은 캐시하지 않음
  if (shouldLeaveToBrowser(event, requestUrl)) {
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
      } catch (error) {
        if (isAbortError(error)) throw error;
        return new Response('', { status: 504, statusText: 'Gateway Timeout' });
      }
    })()
  );
});
