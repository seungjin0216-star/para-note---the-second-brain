import { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

/** Firestore Timestamp → 'YYYY-MM-DD' 문자열 변환 (안전) */
function toDateStr(val) {
  if (!val) return '';
  if (val instanceof Timestamp) return val.toDate().toISOString().slice(0, 10);
  if (val && typeof val === 'object' && val.seconds != null) {
    return new Date(val.seconds * 1000).toISOString().slice(0, 10);
  }
  return String(val);
}

/** 문서 데이터에서 Timestamp 필드를 문자열로 정규화 */
function normalizeItem(id, data) {
  return {
    id,
    ...data,
    createdAt: toDateStr(data.createdAt),
    updatedAt: toDateStr(data.updatedAt),
  };
}

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
      setItems(snap.docs.map((d) => normalizeItem(d.id, d.data())));
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  /** 새 아이템 추가 — createdAt은 호출자가 넘긴 문자열 그대로 사용 */
  const addItem = (data) =>
    addDoc(collection(db, 'users', uid, 'items'), {
      ...data,
      // createdAt은 data 안의 값(today() 문자열)을 그대로 씀
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
