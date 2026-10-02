/* ═══════════════════════════════════════════════════════════
   우리집 — 5분마다 알림 확인
     💊 약 시각이 되면           → 먹을 사람 + 탭
     ⏰ 1시간이 지나도 안 먹으면   → 먹을 사람 + 상대 + 탭   (사장님: 「안 먹으면 1시간 이후 알림」)
     📅 일정 1시간 전             → 그 일정 사람 + 탭
     📅 아침 8시 · 일정 있는 날    → 둘 다 + 탭  「오늘 일정 확인하세요」
   ⚠️ 같은 알림은 하루 한 번 — notified/{날짜} 에 적어 둡니다
   ⚠️ 서버는 UTC 입니다. 날짜·시각은 전부 core.js 의 kst() 로
   ═══════════════════════════════════════════════════════════ */
import { admin, HOME, readCol, members, push, partner, nameOf } from './_home.mjs';
import { kst, medsFor, hm2min, eventsOn, SLOTS, SLOT_LABEL, slotMin, medNow } from '../../public/home/core.js';

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
  for (const who of ['me', 'her']) {
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

  await Promise.all(jobs);
  if (Object.keys(mark).length) await notedRef.set(mark, { merge: true });
  return new Response(JSON.stringify({ ok: true, today, time: now.time, sent: Object.keys(mark) }), { headers: { 'content-type': 'application/json' } });
};
