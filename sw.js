// Service Worker - 健康管理ダッシュボード PWA
const CACHE_NAME = 'health-dashboard-v1';

// キャッシュ対象ファイル（同じディレクトリ配置を前提）
const PRECACHE_URLS = [
  './health_dashboard.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// インストール時：必須ファイルをプリキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// アクティベート時：古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// フェッチ戦略
// - Anthropic API呼び出しはネットワークのみ（キャッシュしない）
// - その他は Cache First（オフライン対応）
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Anthropic API はキャッシュ対象外
  if (url.hostname === 'api.anthropic.com') {
    event.respondWith(fetch(event.request));
    return;
  }

  // その他：キャッシュを優先し、なければネットワークから取得してキャッシュ
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // レスポンスが正常な場合のみキャッシュに保存
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // オフライン時にHTMLリクエストが来た場合はキャッシュ済みのHTMLを返す
        if (event.request.destination === 'document') {
          return caches.match('./health_dashboard.html');
        }
      });
    })
  );
});
