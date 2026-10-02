/* ═══════════════════════════════════════════════════════════
   우리집 — 화면이 부르는 곳
     GET  ?a=config    Firebase 웹 설정 (Netlify 환경변수 VITE_FIREBASE_* 에서. 코드에 안 적음)
     GET  ?a=vapid     알림 공개키
     GET  ?a=health    환경변수가 들어 있나만 (값은 안 보여줌)
     POST {a:'workout', token, who}   운동 다 함 → 상대 + 탭에 알림 (하루 한 번)
     POST {a:'test', token}           내 폰으로 시험 알림
   🔴 POST 는 로그인 토큰을 확인하고, 우리집 두 사람 이메일일 때만 합니다
   ═══════════════════════════════════════════════════════════ */
import { admin, HOME, vapidPublic, whoByToken, push, partner, members, nameOf } from './_home.mjs';
import { kst } from '../../public/home/core.js';

const H = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: H });

export default async (req) => {
  const url = new URL(req.url);
  try {
    if (req.method === 'GET') {
      const a = url.searchParams.get('a');
      if (a === 'config') {
        const e = process.env;
        return J({
          apiKey: e.VITE_FIREBASE_API_KEY, authDomain: e.VITE_FIREBASE_AUTH_DOMAIN, projectId: e.VITE_FIREBASE_PROJECT_ID,
          storageBucket: e.VITE_FIREBASE_STORAGE_BUCKET, messagingSenderId: e.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: e.VITE_FIREBASE_APP_ID,
        });
      }
      if (a === 'vapid') return J({ key: await vapidPublic() });
      if (a === 'health') return J({ firebaseWeb: !!process.env.VITE_FIREBASE_API_KEY, serviceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT, now: kst() });
      return J({ ok: true });
    }
    const body = await req.json();
    const who = await whoByToken(body.token || '');
    if (!who) return J({ ok: false, error: '우리집 계정이 아닙니다' }, 403);
    const { db } = admin();

    if (body.a === 'workout') {
      const today = kst().date, w = body.who === 'me' || body.who === 'her' ? body.who : who, key = `workout_${w}`;
      const ref = db.doc(`${HOME}/notified/${today}`);
      const done = (await ref.get()).data() || {};
      if (done[key]) return J({ ok: true, already: true });
      await ref.set({ [key]: Date.now() }, { merge: true });
      const m = await members(db);
      const r = await push(db, [partner(w), 'tab'], `💪 ${nameOf(m, body.who === 'me' || body.who === 'her' ? body.who : who)} 오늘 운동 끝!`, String(body.text || '오늘 할 운동을 다 했어요').slice(0, 120), `workout-${who}`);
      return J({ ok: true, ...r });
    }
    if (body.a === 'poke') {   // 「먹으라고 알림」 — 상대 폰으로 바로
      const m = await members(db), to = body.to === 'me' || body.to === 'her' ? body.to : partner(who);
      const r = await push(db, [to], `💊 ${nameOf(m, who)}: 약 먹어요!`, String(body.text || '').slice(0, 120) || '아직 안 먹은 약이 있어요', `poke-${to}`);
      return J({ ok: true, ...r });
    }
    if (body.a === 'test') {
      const r = await push(db, [body.to || who], '🔔 우리집 알림 시험', '이게 보이면 알림이 잘 옵니다', 'test');
      return J({ ok: true, ...r });
    }
    return J({ ok: false, error: '모르는 요청' }, 400);
  } catch (e) {
    return J({ ok: false, error: e.message }, 500);
  }
};
