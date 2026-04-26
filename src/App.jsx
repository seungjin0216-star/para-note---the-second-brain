import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import MainApp  from './pages/MainApp';

export default function App() {
  const { user, loading, login } = useAuth();

  // PWA Share Target 처리
  // 유튜브·인스타 공유 시 /?url=...&title=... 형태로 앱이 열림
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedUrl   = params.get('url');
    const sharedTitle = params.get('title') || params.get('text');
    if ((sharedUrl || sharedTitle) && user) {
      // MainApp에서 window.sharedData를 읽어 수신함에 자동 저장
      window.__sharedData = { url: sharedUrl || '', title: sharedTitle || '' };
      window.history.replaceState({}, '', '/');
    }
  }, [user]);

  if (loading) {
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        background: '#f7f7f5',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'linear-gradient(135deg,#7C3AED,#a78bfa)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>🧠</div>
        <div style={{ fontSize: 13, color: '#aaa' }}>제2의뇌 로딩 중...</div>
      </div>
    );
  }

  if (!user) return <LoginPage onLogin={login} />;
  return <MainApp user={user} />;
}
