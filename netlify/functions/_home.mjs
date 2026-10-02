/* ═══════════════════════════════════════════════════════════
   우리집 — 서버 공통 (알림 보내기 · Firestore 읽기)
   데이터 자리   Firestore  homes/main/…   (제2의뇌 users/… 와 따로)
   비밀         homeSecrets/vapid  ← 보안 규칙이 화면에서는 못 읽게 막음. 서버(관리자 계정)만 읽음
   ⚠️ API 키·비밀키를 코드에 적지 않습니다 (저장소 Public · CLAUDE.md 규칙 ⑥)
   ═══════════════════════════════════════════════════════════ */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import webpush from 'web-push';

export function admin() {
  if (!getApps().length) {
    const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT || '', 'base64').toString());
    initializeApp({ credential: cert(sa) });
  }
  return { db: getFirestore(), auth: getAuth() };
}

export const HOME = 'homes/main';

export async function readCol(db, name, where) {
  let q = db.collection(`${HOME}/${name}`);
  if (where) q = q.where(...where);
  const snap = await q.get();
  const out = {};
  snap.forEach(d => { out[d.id] = { id: d.id, ...d.data() }; });
  return out;
}

export async function members(db) {
  const d = await db.doc(HOME).get();
  return (d.exists && d.data().members) || {};
}

/** 로그인한 사람이 우리집 두 사람 중 하나인가 — 이메일로 */
export async function whoByToken(idToken) {
  const { db, auth } = admin();
  const t = await auth.verifyIdToken(idToken);
  const email = String(t.email || '').toLowerCase();
  const m = await members(db);
  const who = Object.keys(m).find(k => String(m[k].email || '').toLowerCase() === email);
  return who || null;
}

let vapidReady = null;
async function vapid(db) {
  if (vapidReady) return vapidReady;
  const d = await db.doc('homeSecrets/vapid').get();
  if (!d.exists) throw new Error('VAPID 키가 없습니다 (homeSecrets/vapid)');
  const v = d.data();
  webpush.setVapidDetails(v.subject || 'mailto:home@example.com', v.publicKey, v.privateKey);
  vapidReady = v;
  return v;
}
export async function vapidPublic() { const { db } = admin(); return (await vapid(db)).publicKey; }

/** 알림 보내기
    to = ['me','her','tab'] 중 몇 개. 'tab' = 거실 탭
    ⚠️ 410/404 (구독 끊김) 은 off:true 로 표시만 (지우지 않음 · 규칙 ④) */
export async function push(db, to, title, body, tag) {
  await vapid(db);
  const subs = await readCol(db, 'subs');
  const targets = Object.values(subs).filter(s => !s.off && to.includes(s.who));
  let sent = 0;
  await Promise.all(targets.map(async s => {
    try {
      await webpush.sendNotification(JSON.parse(s.sub), JSON.stringify({ title, body, tag, url: '/home/' }), { TTL: 3600 });
      sent++;
    } catch (e) {
      if (e.statusCode === 410 || e.statusCode === 404) await db.doc(`${HOME}/subs/${s.id}`).set({ off: true, offAt: Date.now() }, { merge: true });
    }
  }));
  return { sent, targets: targets.length };
}

export const partner = who => (who === 'me' ? 'her' : 'me');
export const nameOf = (m, who) => (m[who] && m[who].name) || (who === 'me' ? '나' : '여자친구');
