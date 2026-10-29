/* ═══════════════════════════════════════════════════════════
   우리집 — 화면이 부르는 곳
     GET  ?a=config    Firebase 웹 설정 (Netlify 환경변수 VITE_FIREBASE_* 에서. 코드에 안 적음)
     GET  ?a=vapid     알림 공개키
     GET  ?a=health    환경변수가 들어 있나만 (값은 안 보여줌)
     POST {a:'workout', token, who}   운동 다 함 → 상대 + 탭에 알림 (하루 한 번)
     POST {a:'test', token}           내 폰으로 시험 알림
     📚 26-10-29 세무사 박나은 (공부)
     POST {a:'stIn'|'stOut', token}   공부 시작·끝 — 박나은(her) · 시각은 서버가 찍음
     POST {a:'cheer', token, text}    📣 응원 — 상대 폰으로 (cheers/{id} 에 남김)
   🔴 POST 는 로그인 토큰을 확인하고, 우리집 두 사람 이메일일 때만 합니다
   ═══════════════════════════════════════════════════════════ */
import { admin, HOME, vapidPublic, whoByToken, push, partner, members, nameOf } from './_home.mjs';
import { kst } from '../../public/home/core.js';
import { stDay, applySt, isOpen, hm, dur, dayMin } from '../../public/home/study.js';

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
    if (body.a === 'added') {  // 🔔 26-10-09 「할일 등록 시 알림」 — 넣은 사람 말고 상대 (탭에서 넣으면 둘 다)
      const m = await members(db), 탭 = body.from === 'tab';
      const to = 탭 ? ['me', 'her'] : [partner(who)];
      const 누가 = 탭 ? '거실 탭' : nameOf(m, who);
      const r = await push(db, to, `${String(body.title || '🔔 새로 넣음').slice(0, 30)} · ${누가}`, String(body.text || '').slice(0, 120), `added-${Date.now()}`);
      return J({ ok: true, ...r });
    }
    if (body.a === 'msg') {    // ✉️ 26-10-06 「장승진만 쓸 수 있는 것으로 … 박나은 폰에 알림」 — 보내는 사람은 me 만, 받는 사람은 her 만
      if (who !== 'me') return J({ ok: false, error: '보낼 수 없는 계정입니다' }, 403);
      const text = String(body.text || '').trim().slice(0, 120);
      if (!text) return J({ ok: false, error: '보낼 말이 없습니다' }, 400);
      const m = await members(db), at = Date.now(), id = `m${at}`;
      // 📜 앱이 열리면 가운데 「어명」으로 띄우려고 남겨 둡니다 (26-10-06 · 화면이 read:true 로 바꿈)
      await db.doc(`${HOME}/msgs/${id}`).set({ from: 'me', to: 'her', text, at, date: kst().date, read: false });
      const r = await push(db, ['her'], `📜 어명이오! — ${nameOf(m, 'me')}`, text, `msg-${at}`);
      return J({ ok: true, ...r });
    }
    /* 📚 공부 시작·끝 (26-10-29) — 사장님: 「공부 서로서로 같이 하는 용도 · 응원하는 사람이 있다」
       시각은 서버가 찍음 · 시작·끝마다 응원하는 사람 폰에 알림 */
    if (['stIn', 'stOut'].includes(body.a)) {
      if (who !== 'her') return J({ ok: false, error: '박나은 폰에서만 찍을 수 있어요' }, 403);
      const kind = body.a === 'stIn' ? 'in' : 'out', at = Date.now();
      let day = stDay(at), ref = db.doc(`${HOME}/study/${day}`), doc = (await ref.get()).data() || { date: day, sessions: [] };
      if (kind === 'out' && !isOpen(doc)) {   // 새벽 5시 넘어 퇴근 — 어제 것을 닫음
        const y = new Date(Date.parse(day + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10), yr = db.doc(`${HOME}/study/${y}`), yd = (await yr.get()).data();
        if (isOpen(yd)) { day = y; ref = yr; doc = yd; }
      }
      const r = applySt(doc, kind, at);
      if (r.err) return J({ ok: false, error: r.err }, 400);
      r.doc.date = day;
      await ref.set(r.doc);
      const m = await members(db), nm = nameOf(m, 'her');
      const 글 = kind === 'in' ? [`📚 ${nm} 공부 시작 ${hm(at)}`, '응원 한마디 보내 주세요 📣'] : [`🌙 ${nm} 공부 끝 ${hm(at)}`, `오늘 ${dur(dayMin(r.doc))} — 수고했다고 말해 주세요`];
      await push(db, ['me'], 글[0], 글[1], `study-${kind}`).catch(() => {});
      return J({ ok: true, at, day });
    }
    if (body.a === 'cheer') {   // 📣 응원 — 둘 다 보낼 수 있음 (받는 사람 = 상대)
      const text = String(body.text || '').trim().slice(0, 80);
      if (!text) return J({ ok: false, error: '응원 글이 없어요' }, 400);
      const m = await members(db), at = Date.now(), to = partner(who);
      await db.doc(`${HOME}/cheers/c${at}`).set({ from: who, to, text, at, date: kst().date });
      const r = await push(db, [to], `📣 ${nameOf(m, who)}의 응원`, text, `cheer-${at}`);
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
