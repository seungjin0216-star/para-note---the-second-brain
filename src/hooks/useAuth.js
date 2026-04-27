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
  const [user, setUser]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

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
    setLoginLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user' ||
          err.code === 'auth/cancelled-popup-request') {
        // 사용자가 닫은 것 — 에러 없음
      } else if (err.code === 'auth/popup-blocked') {
        setLoginError('팝업이 차단됐어요.\n브라우저 설정에서 팝업을 허용하거나\n주소창 옆 차단 아이콘을 눌러 허용해주세요.');
      } else {
        console.error('Login error:', err.code, err.message);
        setLoginError(`로그인 오류: ${err.code}`);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = () => signOut(auth);

  return { user, loading, login, logout, loginError, loginLoading };
}
