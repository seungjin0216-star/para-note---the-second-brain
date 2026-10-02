/* 우리집 — 알림만 받습니다 (화면 저장 안 함 · 늘 최신 화면)
   ⚠️ 범위는 /home/ 만. 제2의뇌(/) 의 서비스워커와 따로입니다 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch (_) { d = { title: '우리집', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || '우리집', {
    body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag, icon: '/home/icon-192.png', badge: '/home/icon-192.png', data: { url: d.url || '/home/' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/home/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    const w = ws.find(c => c.url.includes('/home/')); return w ? w.focus() : self.clients.openWindow(url);
  }));
});
