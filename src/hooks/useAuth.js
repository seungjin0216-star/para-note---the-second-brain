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

// 모바일 감지
const isMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export function useAuth() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 리다이렉트 결과 처리 (모바일에서 로그인 후 돌아왔을 때)
    getRedirectResult(auth).catch(() => {});

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
    try {
      // 데스크탑: 팝업 방식 (빠르고 안정적)
      // 모바일: 리다이렉트 방식 (팝업 차단 우회)
      if (isMobile()) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (err) {
      // 팝업 차단됐으면 리다이렉트로 fallback
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
        await signInWithRedirect(auth, googleProvider);
      } else {
        console.error('Login error:', err);
      }
    }
  };

  const logout = () => signOut(auth);

  return { user, loading, login, logout };
}
