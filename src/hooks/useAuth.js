import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { DEFAULT_TAGS } from '../constants';

const isMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export function useAuth() {
  const [user, setUser]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    // 리다이렉트 완료 후 결과 수신 (모바일 로그인 후 페이지 복귀 시)
    // authDomain = paranote.netlify.app + netlify proxy 덕분에 ITP 우회됨
    getRedirectResult(auth).catch((err) => {
      if (err?.code && err.code !== 'auth/no-current-user') {
        console.error('Redirect result error:', err.code, err.message);
      }
    });

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userRef = doc(db, 'users', u.uid, 'meta', 'profile');
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(userRef, {
            displayName: u.displayName,
            email:       u.email,
            photoURL:    u.photoURL,
            tags:        DEFAULT_TAGS,
            createdAt:   serverTimestamp(),
          });
        }
      }
      setUser(u);
      setLoading(false);
    });

    return unsub;
  }, []);

  const login = async () => {
    setLoginError('');
    try {
      if (isMobile()) {
        // 모바일(iOS/Android): 리다이렉트 방식
        // netlify.toml 프록시로 /__/auth/* 가 paranote.netlify.app 에서 처리됨
        // → 크로스 도메인 없음 → ITP 우회 성공
        await signInWithRedirect(auth, googleProvider);
      } else {
        // 데스크탑: 팝업 방식 (빠름)
        await signInWithPopup(auth, googleProvider);
      }
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') return;
      if (err.code === 'auth/popup-blocked') {
        // 팝업 차단 시 리다이렉트로 전환
        await signInWithRedirect(auth, googleProvider);
      } else {
        console.error('Login error:', err);
        setLoginError('로그인 중 오류가 발생했어요. 다시 시도해주세요.');
      }
    }
  };

  const logout = () => signOut(auth);

  return { user, loading, login, logout, loginError };
}
