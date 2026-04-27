export default function LoginPage({ onLogin, loginError, loginLoading }) {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg,#faf9ff 0%,#f0edff 100%)',
      padding: '0 32px',
    }}>
      {/* 로고 */}
      <div style={{
        width: 72, height: 72, borderRadius: 22,
        background: 'linear-gradient(135deg,#7C3AED,#a78bfa)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 34, marginBottom: 20,
        boxShadow: '0 8px 32px rgba(124,58,237,.3)',
      }}>🧠</div>

      <div style={{ fontSize: 26, fontWeight: 700, color: '#111', marginBottom: 8 }}>제2의뇌</div>
      <div style={{
        fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 1.7, marginBottom: 48,
      }}>
        머릿속의 모든 것을 여기에 던져두세요.<br />
        정리는 나중에, 수집은 지금 바로.
      </div>

      {/* PARA 단계 미리보기 */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 48, flexWrap: 'wrap', justifyContent: 'center',
      }}>
        {['📥 수집', '🏷 태그', '📚 자료화', '🎯 프로젝트'].map((s, i) => (
          <div key={i} style={{
            fontSize: 12, padding: '5px 12px', borderRadius: 20,
            background: 'rgba(124,58,237,.08)', color: '#7C3AED',
            border: '0.5px solid rgba(124,58,237,.2)',
          }}>{s}</div>
        ))}
      </div>

      {/* Google 로그인 버튼 */}
      <button
        onClick={onLogin}
        disabled={loginLoading}
        style={{
          width: '100%', maxWidth: 320, padding: '15px 20px',
          borderRadius: 14, border: '1px solid rgba(0,0,0,.12)',
          background: loginLoading ? '#f5f5f5' : '#fff',
          cursor: loginLoading ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          fontSize: 15, fontWeight: 600, color: loginLoading ? '#aaa' : '#333',
          boxShadow: '0 2px 12px rgba(0,0,0,.08)',
          transition: 'all .15s',
        }}
      >
        {loginLoading ? (
          <>
            <span style={{
              display: 'inline-block', width: 18, height: 18,
              border: '2px solid #7C3AED', borderTopColor: 'transparent',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            }} />
            로그인 중...
          </>
        ) : (
          <>
            {/* Google SVG 로고 */}
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.1-2.7-.4-4z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5L31.8 34c-2 1.4-4.6 2-7.8 2-5.3 0-9.7-3-11.3-7.3l-6.5 5C9.8 39.7 16.4 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.4l6.6 5.1C41.2 35 44 30 44 24c0-1.3-.1-2.7-.4-4z"/>
            </svg>
            Google로 시작하기
          </>
        )}
      </button>

      {loginError && (
        <div style={{
          marginTop: 16, padding: '12px 16px', borderRadius: 12,
          background: 'rgba(220,38,38,.07)', border: '0.5px solid rgba(220,38,38,.2)',
          color: '#DC2626', fontSize: 13, textAlign: 'center',
          maxWidth: 320, width: '100%', lineHeight: 1.6,
          whiteSpace: 'pre-line',
        }}>
          {loginError}
        </div>
      )}

      {/* iOS 안내 */}
      <div style={{
        marginTop: 20, padding: '10px 14px', borderRadius: 12,
        background: 'rgba(124,58,237,.05)', border: '0.5px solid rgba(124,58,237,.15)',
        maxWidth: 320, width: '100%',
      }}>
        <div style={{ fontSize: 11, color: '#7C3AED', fontWeight: 600, marginBottom: 4 }}>
          📱 iPhone 사용자
        </div>
        <div style={{ fontSize: 11, color: '#888', lineHeight: 1.6 }}>
          Safari에서 로그인하면 팝업창이 열립니다.<br />
          홈 화면 앱에서는 Safari로 먼저 로그인 후 이용해주세요.
        </div>
      </div>

      <div style={{ fontSize: 11, color: '#ccc', marginTop: 16, textAlign: 'center' }}>
        로그인 시 나만의 데이터 공간이 생성됩니다
      </div>
    </div>
  );
}
