import { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * 사용자의 모든 아이템을 Firestore 실시간 구독
 * Firestore 경로: users/{uid}/items/{itemId}
 */
export function useItems(uid) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'users', uid, 'items'),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  /** 새 아이템 추가 */
  const addItem = (data) =>
    addDoc(collection(db, 'users', uid, 'items'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

  /** 아이템 수정 (부분 업데이트) */
  const updateItem = (id, data) =>
    updateDoc(doc(db, 'users', uid, 'items', id), {
      ...data,
      updatedAt: serverTimestamp(),
    });

  /** 아이템 삭제 */
  const deleteItem = (id) =>
    deleteDoc(doc(db, 'users', uid, 'items', id));

  return { items, loading, addItem, updateItem, deleteItem };
}

/**
 * 사용자 태그 세트 관리
 * Firestore 경로: users/{uid}/meta/profile
 */
export function useUserTags(uid) {
  const [tags, setTags] = useState([]);

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, 'users', uid, 'meta', 'profile');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setTags(snap.data().tags || []);
    });
    return unsub;
  }, [uid]);

  const saveTags = (newTags) =>
    updateDoc(doc(db, 'users', uid, 'meta', 'profile'), { tags: newTags });

  return { tags, saveTags };
}
