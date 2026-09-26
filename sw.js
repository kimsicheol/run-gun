// JUNGLE STRIKE DX — 서비스 워커 (앱 설치 + 오프라인 플레이)
// 전략: 같은 오리진 요청은 네트워크 우선(온라인이면 항상 최신 배포), 실패 시 캐시.
//       폰트·CDN(cross-origin)은 캐시 우선. 캐시 이름을 올리면 옛 캐시는 activate에서 정리된다.
const CACHE = 'jsdx-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-512-maskable.png', '/favicon.png', '/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  if (same) {
    // 네트워크 우선 → 실패(오프라인) 시 캐시. 내비게이션은 index.html로 폴백.
    e.respondWith(fetch(req).then(res => {
      if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('/index.html') : undefined))));
  } else if (/fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr/.test(url.host)) {
    // 폰트·CDN: 캐시 우선, 없으면 받아서 저장 (opaque 응답 포함)
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return res;
    })));
  }
});
