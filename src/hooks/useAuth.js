import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { DEFAULT_TAGS } from '../constants';

export function useAuth() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
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
      // 팝업 방식 — 사용자 버튼 클릭으로 열리므로 iOS/Android/데스크탑 모두 허용됨
      // signInWithRedirect는 iOS Safari ITP 정책으로 세션이 초기화되는 문제 있음
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        // 사용자가 직접 닫은 경우 — 에러 없음
        return;
      }
      if (err.code === 'auth/popup-blocked') {
        setLoginError('팝업이 차단됐어요. 브라우저 주소창 옆 팝업 허용 버튼을 눌러주세요.');
      } else {
        console.error('Login error:', err);
        setLoginError('로그인 중 오류가 발생했어요. 다시 시도해주세요.');
      }
    }
  };

  const logout = () => signOut(auth);

  return { user, loading, login, logout, loginError };
}
