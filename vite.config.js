import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 🧨 26-10-14 사장님 「1번 안됨」 — 폰에 남은 옛 서비스워커가 / 와 /brain/ 을 옛 React 화면으로 바꿔치기
      //    → 스스로 지우는 서비스워커로 바꿉니다. 폰이 한 번 열면 옛 저장분을 지우고 새로 읽음
      //    ⚠️ 우리집(/home/sw.js · 알림)은 따로 등록돼 있어 영향 없음
      selfDestroying: true,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: '제2의뇌',
        short_name: '제2의뇌',
        description: '뇌의 외장메모리 — PARA 기반 지식 관리',
        theme_color: '#7C3AED',
        background_color: '#f7f7f5',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        // 유튜브·인스타 등 외부 앱 공유 수신
        share_target: {
          action: '/share-target',
          method: 'GET',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
          },
        },
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // ⚠️ 26-10-14 우리집·새 제2의뇌는 따로 도는 화면 — 옛 화면 서비스워커가 저장해 두면 폰에 옛 판이 남습니다
        globIgnores: ['home/**', 'brain/**'],
        // 오프라인에서도 앱 열리도록
        navigateFallback: '/index.html',
        // ⚠️ 우리집(/home/)은 따로 도는 앱입니다. 제2의뇌 화면으로 바꿔치기하지 않게 (26-10-02)
        navigateFallbackDenylist: [/^\/home/, /^\/brain/],
      },
    }),
  ],
});
