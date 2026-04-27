import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import MainApp  from './pages/MainApp';

export default function App() {
  const { user, loading, login, loginError } = useAuth();

  // URL 파라미터 캡처는 main.jsx에서 React 시작 전에 처리됨
  // (window.__pendingShare 에 저장 → MainApp에서 소비)

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

  if (!user) return <LoginPage onLogin={login} loginError={loginError} />;
  return <MainApp user={user} />;
}
