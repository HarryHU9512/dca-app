const CACHE_NAME = 'dca-app-v2';
const SW_VERSION = '2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

// 安装：缓存核心文件
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 请求拦截
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // === 股票行情代理 ===
  // 页面 fetch /api/stock/sh600900,sh600036 → SW 代理请求 qt.gtimg.cn
  if (url.pathname.startsWith('/api/stock/')) {
    const codes = url.pathname.replace('/api/stock/', '');
    const targetUrl = 'https://qt.gtimg.cn/q=' + codes;
    e.respondWith(
      fetch(targetUrl).then((resp) => {
        if (resp.ok) return resp;
        throw new Error('upstream failed');
      }).catch(() => {
        return new Response('{"error":"api_unavailable"}', {
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // === 普通请求：缓存优先 ===
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((resp) => {
        if (resp.ok && e.request.url.startsWith(self.location.origin)) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
