import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// ─── React 시작 전에 URL 파라미터를 먼저 캡처 ───
// iOS 단축어로 앱이 열릴 때 /?url=... 형태로 오는 것을 미리 저장
(function captureShareParams() {
  const params = new URLSearchParams(window.location.search);
  const sharedUrl   = params.get('url');
  const sharedTitle = params.get('title') || params.get('text');
  if (sharedUrl || sharedTitle) {
    window.__pendingShare = {
      url:   sharedUrl   || '',
      title: sharedTitle || '',
    };
    // URL 정리 (주소창에서 파라미터 제거)
    window.history.replaceState({}, '', '/');
  }
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
