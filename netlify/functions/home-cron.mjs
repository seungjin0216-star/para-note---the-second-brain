/* ═══════════════════════════════════════════════════════════
   우리집 — 5분마다 알림 확인
     💊 약 시각이 되면           → 먹을 사람 + 탭
     ⏰ 1시간이 지나도 안 먹으면   → 먹을 사람 + 상대 + 탭   (사장님: 「안 먹으면 1시간 이후 알림」)
     📅 일정 1시간 전             → 그 일정 사람 + 탭
     📅 아침 8시 · 일정 있는 날    → 둘 다 + 탭  「오늘 일정 확인하세요」
     📚 26-10-29 세무사 박나은 — 쉬는 날 2번째 경고 · 4시간 모자람 · 월요일 아침 주간 리포트
     💊 26-10-29 약 알림 끔 — 사장님 「약복용 없애줘. 진짜 안 쓰게 됨」 (약 기록은 그대로 둠)
   ⚠️ 같은 알림은 하루 한 번 — notified/{날짜} 에 적어 둡니다
   ⚠️ 서버는 UTC 입니다. 날짜·시각은 전부 core.js 의 kst() 로
   ═══════════════════════════════════════════════════════════ */
import { admin, HOME, readCol, members, push, partner, nameOf } from './_home.mjs';
import { kst, medsFor, hm2min, eventsOn, SLOTS, SLOT_LABEL, slotMin, medNow, addDays } from '../../public/home/core.js';
import * as S from '../../public/home/study.js';

const 약알림 = false;   // 💊 26-10-29 끔 — 다시 쓰려면 true

export const config = { schedule: '*/5 * * * *' };

export default async () => {
  const { db } = admin();
  const now = kst(), today = now.date;
  const notedRef = db.doc(`${HOME}/notified/${today}`);
  const noted = (await notedRef.get()).data() || {};
  const mark = {};
  const once = async (key, fn) => { if (noted[key] || mark[key]) return; mark[key] = Date.now(); await fn(); };

  const [m, meds, logs, events] = await Promise.all([
    members(db), readCol(db, 'meds'), readCol(db, 'medLogs', ['date', '==', medNow().day]), readCol(db, 'events'),
  ]);
  const jobs = [];

  /* 💊 약 — 사람 × 시간대(아침 7:30 · 점심 14:00 · 자기 전 00:30) 마다 알림 한 통
     ⚠️ 약의 하루는 새벽 5시에 바뀝니다 (00:30 자기 전 = 그날 약). 날짜·분은 medNow() 로 */
  const md = medNow(), mdRef = db.doc(`${HOME}/notified/${md.day}`);
  const mdNoted = md.day === today ? noted : ((await mdRef.get()).data() || {}), mdMark = {};
  for (const who of 약알림 ? ['me', 'her'] : []) {
    const all = medsFor(Object.values(meds), who, md.day);
    for (const [slot, time] of SLOTS) {
      const t = slotMin(slot);
      if (md.min < t) continue;
      const left = all.filter(x => x.slot === slot && !(logs[x.key] && logs[x.key].taken) && !(x.med.created && x.med.created > Date.now() - (md.min - t) * 60e3));
      if (!left.length) continue;
      const names = left.map(x => x.med.name).join(' · '), key = md.min < t + 60 ? `due_${who}_${slot}` : `late_${who}_${slot}`;
      if (mdNoted[key] || mdMark[key]) continue;
      mdMark[key] = Date.now();
      if (key.startsWith('due')) jobs.push(push(db, [who, 'tab'], `💊 ${SLOT_LABEL[slot]} 약 먹을 시간 (${time})`, `${nameOf(m, who)} · ${names}`, `med-${who}-${slot}`));
      else jobs.push(push(db, [who, partner(who), 'tab'], `⏰ ${nameOf(m, who)} ${SLOT_LABEL[slot]} 약을 아직 안 먹었어요`, `${names} — ${time}부터 1시간 지났어요`, `med-${who}-${slot}`));
    }
  }
  if (Object.keys(mdMark).length) jobs.push(mdRef.set(mdMark, { merge: true }));

  /* 📅 일정 */
  const todays = eventsOn(Object.values(events), today);
  for (const e of todays) {
    if (!e.time) continue;
    const t = hm2min(e.time);
    if (now.min >= t - 60 && now.min < t) {
      const to = e.who === 'we' ? ['me', 'her', 'tab'] : [e.who, 'tab'];
      jobs.push(once(`ev1h_${e.id}`, () => push(db, to, `📅 1시간 뒤 일정`, `${e.time} ${e.title}`, `ev-${e.id}`)));
    }
  }
  if (todays.length && now.min >= 8 * 60 && now.min < 11 * 60) {
    const list = todays.map(e => `${e.time || '종일'} ${e.title}`).join(' · ');
    jobs.push(once('morning', () => push(db, ['me', 'her', 'tab'], `📅 오늘 일정 ${todays.length}개 — 확인하세요`, list, 'morning')));
  }

  /* 🧠 제2의뇌 일정 알림 (26-10-14) — 사장님: 「알림도 오게끔 … 아이폰 기본 기능처럼 … 한 시간 전과 00시 둘 다」
     users/{사장님 uid}/brain_events 의 alarms: 숫자 = 몇 분 전 · 'd9' = 하루 전 오전 9시 · 'YYYY-MM-DDTHH:MM' = 직접
     사장님 폰(who 'me')의 우리집 알림 길로 보냄 · 누르면 /brain/ */
  try {
    const { auth } = admin();
    const email = (m.me && m.me.email) || 'seungjin0216@gmail.com';
    const uid = (await auth.getUserByEmail(email)).uid;
    const bs = await db.collection(`users/${uid}/brain_events`).get();
    const bev = bs.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => !e.off);
    const 내일 = new Date(Date.parse(today + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10);
    const 울릴때 = (fireDate, fireMin) => fireDate === today && now.min >= fireMin && now.min < fireMin + 10;
    const 글 = a => typeof a === 'number' ? (a === 0 ? '지금' : a >= 60 ? `${a / 60}시간 뒤` : `${a}분 뒤`) : a === 'd9' ? '내일' : '알림';
    for (const d of [today, 내일]) for (const e of eventsOn(bev, d)) for (const a of (e.alarms || [])) {
      let ok = false;
      // 26-10-28 종일 일정(시간 없음)의 「몇 분 전」은 오전 9시 기준 — 전에는 시간이 없으면 조용히 건너뜀 (사장님 「제2의뇌 알림 기능 안 되는 것 같은데」 · 「건축과 벌금내기」 종일 + 30·10·0·60분)
      if (typeof a === 'number' && d === today) ok = 울릴때(d, (e.time ? hm2min(e.time) : 9 * 60) - a);
      else if (a === 'd9' && d === 내일) ok = 울릴때(today, 9 * 60);
      if (ok) jobs.push(once(`brain_${e.id}_${d}_${a}`, () => push(db, ['me'], `📅 ${typeof a === 'number' && !e.time ? '오늘' : 글(a)} · ${e.title}`, `${d === today ? '오늘' : '내일'} ${e.time || '종일'}`, `brain-${e.id}`, '/brain/')));
    }
    for (const e of bev) for (const a of (e.alarms || [])) if (typeof a === 'string' && a.includes('T')) {
      const [fd, ft] = a.split('T');
      if (울릴때(fd, hm2min(ft))) jobs.push(once(`brain_${e.id}_${a}`, () => push(db, ['me'], `🔔 ${e.title}`, `${e.date.slice(5).replace('-', '/')} ${e.time || '종일'}`, `brain-${e.id}`, '/brain/')));
    }
  } catch (err) { console.log('제2의뇌 알림 못 함: ' + err.message); }

  /* 📚 공부 — 사장님 「주 1회 쉬는 것까지는 괜찮으나 2회 이상 쉬면 안 되게 · 하루 4시간」
     ⚠️ 공부의 하루는 새벽 5시에 바뀜 (S.stDay) · 알림 중복 막기는 그 공부 날짜의 notified 에 */
  try {
    const sd = S.stDay(), sRef = db.doc(`${HOME}/notified/${sd}`), sNoted = sd === today ? noted : ((await sRef.get()).data() || {}), sMark = {};
    const sOnce = async (key, fn) => { if (sNoted[key] || sMark[key] || mark[key]) return; sMark[key] = Date.now(); await fn(); };
    const study = await readCol(db, 'study', ['date', '>=', addDays(sd, -14)]);
    const doc = study[sd], nowMs = Date.now(), nm = nameOf(m, 'her');

    /* 🚨 쉬는 날 — 이번 주에 이미 하루 쉬었는데 오늘 밤 9시까지 출근이 없으면 둘 다에게 */
    const k = kst(), start = S.startDay(study) || Object.keys(study).sort()[0];
    if (start && k.min >= 21 * 60 && sd === today) {
      const r = S.weekReport(study, {}, S.weekStart(sd), sd, nowMs);
      const 쉰 = r.days.filter(d => d.date < sd && d.st === 'rest').length;
      if (!S.sessions(doc).length && 쉰 >= S.REST_OK) jobs.push(sOnce('rest2', () => push(db, ['me', 'her'], `🚨 ${nm} 오늘 쉬면 이번 주 ${쉰 + 1}번째 쉬는 날`, '주 1번까지만 쉬기로 했어요 — 지금이라도 ▶ 공부 시작!', 'study-rest')));
      const min = S.dayMin(doc, nowMs);
      if (S.sessions(doc).length && !S.isOpen(doc) && min < S.MIN_DAY) jobs.push(sOnce('short', () => push(db, ['her'], `⏳ 오늘 ${S.dur(min)} — 4시간까지 ${S.dur(S.MIN_DAY - min)}`, '조금만 더 하면 오늘 목표!', 'study-short')));
    }
    /* 📊 주간 리포트 — 월요일 아침 8시 (지난주 월~일 · 일요일 밤 12시 넘어 퇴근해도 들어가게 다음 날 아침에) */
    if (k.wd === 1 && k.min >= 8 * 60 && k.min < 11 * 60) {
      const ws = addDays(S.weekStart(today), -7);
      const [all, logs] = await Promise.all([readCol(db, 'study'), readCol(db, 'studyLogs')]);
      const r = S.weekReport(all, logs, ws, today, nowMs);
      if (r.study || r.rest) jobs.push(once('weekly', () => push(db, ['me', 'her'], `📊 ${nm} 지난주 공부 (${ws.slice(5).replace('-', '/')}~)`, S.reportLine(r), 'study-week')));
    }
    if (Object.keys(sMark).length) jobs.push(sRef.set(sMark, { merge: true }));
  } catch (err) { console.log('공부 알림 못 함: ' + err.message); }

  await Promise.all(jobs);
  if (Object.keys(mark).length) await notedRef.set(mark, { merge: true });
  return new Response(JSON.stringify({ ok: true, today, time: now.time, sent: Object.keys(mark) }), { headers: { 'content-type': 'application/json' } });
};
