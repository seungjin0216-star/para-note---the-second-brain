import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { DEFAULT_TAGS } from '../constants';

export function useAuth() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 모바일에서 Google 로그인 후 리다이렉트 결과 처리
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          // 첫 로그인이면 프로필 문서 생성 (onAuthStateChanged도 처리하지만 여기서도 보장)
          const userRef = doc(db, 'users', result.user.uid, 'meta', 'profile');
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            await setDoc(userRef, {
              displayName: result.user.displayName,
              email:       result.user.email,
              photoURL:    result.user.photoURL,
              tags:        DEFAULT_TAGS,
              createdAt:   serverTimestamp(),
            });
          }
        }
      })
      .catch((err) => {
        // 리다이렉트 결과 없으면 무시 (정상)
        if (err.code !== 'auth/no-auth-event') {
          console.error('redirect result error', err);
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

  // 팝업 대신 리다이렉트 방식 (모바일 Safari/Chrome 호환)
  const login  = () => signInWithRedirect(auth, googleProvider);
  const logout = () => signOut(auth);

  return { user, loading, login, logout };
}
