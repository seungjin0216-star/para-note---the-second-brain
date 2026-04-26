import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import MainApp  from './pages/MainApp';

export default function App() {
  const { user, loading, login } = useAuth();

  // iOS 단축어 / PWA Share Target 처리
  // 앱이 열릴 때 URL 파라미터를 localStorage에 저장 (로그인 전이어도 OK)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedUrl   = params.get('url');
    const sharedTitle = params.get('title') || params.get('text');
    if (sharedUrl || sharedTitle) {
      localStorage.setItem('__pendingShare', JSON.stringify({
        url: sharedUrl || '',
        title: sharedTitle || '',
      }));
      window.history.replaceState({}, '', '/');
    }
  }, []); // 앱 최초 로드 시 1회만

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
