/* ═══════════════════════════════════════════════════════════
   우리집 — 날짜 계산 (화면과 알림 서버가 **같은 이 파일**을 씁니다)
   ⚠️ 두 곳에 따로 적으면 반드시 어긋납니다. 고칠 때는 여기 하나만.
   ⚠️ 날짜는 전부 한국 시간 'YYYY-MM-DD' 문자열. Date 객체로 날짜를 세지 않습니다
      (서버는 UTC 라 자정 근처에서 하루가 밀립니다)
   ═══════════════════════════════════════════════════════════ */

const KST = 9 * 3600e3;
const pad = n => String(n).padStart(2, '0');

/** 지금(또는 d) 의 한국 날짜·시각 */
export function kst(d = new Date()) {
  const k = new Date(d.getTime() + KST);
  return {
    date: `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())}`,
    time: `${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`,
    min: k.getUTCHours() * 60 + k.getUTCMinutes(),
    wd: k.getUTCDay(),
  };
}
/** 'YYYY-MM-DD' → 날 번호 (1970-01-01 = 0) */
export function dnum(s) { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; }
export function dstr(n) { const d = new Date(n * 864e5); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
export function addDays(s, n) { return dstr(dnum(s) + n); }
export function diffDays(a, b) { return dnum(a) - dnum(b); }          // a - b
export function wdOf(s) { return new Date(dnum(s) * 864e5).getUTCDay(); }
export function lastDay(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }   // m: 1~12
export function hm2min(t) { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); }
export const DAY = ['일', '월', '화', '수', '목', '금', '토'];
export function label(s) { const [, m, d] = s.split('-').map(Number); return `${m}/${d}(${DAY[wdOf(s)]})`; }

/* ── 소비기한 ─────────────────────────────────────────────
   남은 날 = 기한 - 오늘 (한국 날짜끼리)
   <0 회색 「N일 지남」 · 0 빨강 「오늘까지」 · 1 빨강 D-1 · 2~3 노랑 · 그 밖 보통 */
export const 반찬기본일 = 5;
export function dday(expires, today) {
  const n = diffDays(expires, today);
  if (n < 0) return { n, cls: 'g', text: `${-n}일 지남` };
  if (n === 0) return { n, cls: 'r', text: '오늘까지' };
  if (n === 1) return { n, cls: 'r', text: 'D-1' };
  if (n <= 3) return { n, cls: 'y', text: `D-${n}` };
  return { n, cls: 'n', text: `D-${n}` };
}

/* ── 일정 반복 ────────────────────────────────────────────
   repeat.type
     none     한 번
     weekly   repeat.days = [0~6] (없으면 시작 요일)
     monthly  시작일의 「날짜」. 31일인데 그 달에 없으면 그 달 마지막 날
     yearly   매년 같은 월·일 (2/29 는 평년엔 2/28)
     everyN   시작일부터 repeat.n 일마다
   until 이 있으면 그날까지 */
export function occursOn(ev, s) {
  if (!ev || !ev.date) return false;
  if (s < ev.date) return false;
  if (ev.until && s > ev.until) return false;
  if ((ev.skip || []).includes(s)) return false;
  const r = ev.repeat || { type: 'none' };
  const [y, m, d] = s.split('-').map(Number);
  const [sy, sm, sd] = ev.date.split('-').map(Number);
  switch (r.type) {
    case 'weekly': { const days = (r.days && r.days.length) ? r.days : [wdOf(ev.date)]; return days.includes(wdOf(s)); }
    case 'monthly': return d === Math.min(sd, lastDay(y, m));
    case 'yearly': return m === sm && d === Math.min(sd, lastDay(y, sm));
    case 'everyN': { const n = Math.max(1, +r.n || 1); return diffDays(s, ev.date) % n === 0; }
    default: return s === ev.date;
  }
}
/** 그날 일정 — 시간 순 (종일 먼저) */
export function eventsOn(events, s) {
  return events.filter(e => !e.off && occursOn(e, s))
    .sort((a, b) => (a.time || '') < (b.time || '') ? -1 : 1);
}

/* ── 운동 루틴 ────────────────────────────────────────────
   sched.type
     daily    매일
     days     sched.days = [0~6]
     everyN   sched.start 부터 sched.n 일마다 (체크를 안 해도 다음 날짜는 그대로) */
export function routineOn(rt, s) {
  if (!rt || rt.off) return false;
  const sc = rt.sched || { type: 'daily' };
  if (sc.start && s < sc.start) return false;
  if (sc.type === 'days') return (sc.days || []).includes(wdOf(s));
  if (sc.type === 'everyN') { const n = Math.max(1, +sc.n || 1); return diffDays(s, sc.start || s) % n === 0; }
  return true;
}
/** 그 사람이 그날 해야 할 루틴 */
export function routinesFor(routines, who, s) {
  return routines.filter(r => routineOn(r, s) && (r.who === who || r.who === 'we'));
}
/** 그날 그 사람이 다 했나 (할 게 없으면 null) */
export function dayDone(routines, logs, who, s) {
  const need = routinesFor(routines, who, s);
  // 루틴 말고 「따로 한 운동」 (키: 날짜_who_x_…) — 할 루틴이 없는 날이면 그것만으로 「한 날」
  const 따로 = Object.keys(logs).some(k => k.startsWith(`${s}_${who}_x_`));
  if (!need.length) return 따로 ? true : null;
  return need.every(r => logs[`${s}_${who}_${r.id}`]);
}
/** 연속 일수 — 할 게 없는 날은 건너뜀. 오늘을 아직 안 했으면 어제부터 셉니다 */
export function streak(routines, logs, who, today) {
  let n = 0, s = today;
  if (dayDone(routines, logs, who, s) === false) s = addDays(s, -1);
  for (let i = 0; i < 400; i++, s = addDays(s, -1)) {
    const v = dayDone(routines, logs, who, s);
    if (v === null) continue;
    if (!v) break;
    n++;
  }
  return n;
}

/* ── 집안일 ───────────────────────────────────────────────
   다음 날 = **마지막으로 한 날** 기준 (사장님 지정)
     every.type 'days'      한 날 + n 일
     every.type 'weekdays'  한 날 **다음의** 그 요일들 중 가장 가까운 날
   한 번도 안 했으면 start (없으면 만든 날) 가 첫 예정일
   ⚠️ 밀렸다가 하면 그날부터 다시 셉니다 */
export function choreNext(ch) {
  const ev = ch.every || { type: 'days', n: 7 };
  if (ch.once) return ch.lastDone ? '9999-12-31' : (ch.start || ch.created || kst().date);   // 한 번만 할 일 — 하면 끝
  if (!ch.lastDone) return ch.start || ch.created || kst().date;
  if (ev.type === 'weekdays' && (ev.days || []).length) {
    for (let i = 1; i <= 7; i++) { const s = addDays(ch.lastDone, i); if (ev.days.includes(wdOf(s))) return s; }
  }
  return addDays(ch.lastDone, Math.max(1, +ev.n || 7));
}
export function everyText(ev) {
  if (!ev) return '';
  if (ev.type === 'weekdays') return (ev.days || []).map(d => DAY[d]).join('·');
  const n = +ev.n || 7;
  if (n % 30 === 0) return n === 30 ? '한 달마다' : `${n / 30}달마다`;
  if (n % 7 === 0) return n === 7 ? '1주마다' : `${n / 7}주마다`;
  return n === 1 ? '매일' : `${n}일마다`;
}

/* ── 약 — 「세트」 (사장님 26-10-02) ───────────────────────
   「아침·점심·저녁 · 공통으로 먹는 세트와 개별 세트 · 꼬박꼬박 다 먹기 위해」
   set = { name, who: 'we'|'me'|'her', slot: '아침'|'점심'|'저녁'|'자기 전', time, pills: [] }
   기록 키  날짜_세트id_사람   (같이 세트는 두 사람이 따로 체크) */
export const SLOTS = [['아침', '08:00'], ['점심', '12:30'], ['저녁', '19:00'], ['자기 전', '22:30']];
export const slotTime = (slot) => (SLOTS.find(x => x[0] === slot) || ['', '08:00'])[1];
export function slotOf(t) { const m = hm2min(t); return m < 11 * 60 ? '아침' : m < 16 * 60 ? '점심' : m < 21 * 60 ? '저녁' : '자기 전'; }
export function medKey(s, setId, who) { return `${s}_${setId}_${who}`; }
/** 그날 그 사람이 먹을 세트 [{set, who, time, slot, key}] — 시간대 순 */
export function setsFor(sets, who, s) {
  return sets.filter(x => !x.off && x.slot && (x.who === 'we' || x.who === who) && (!x.start || x.start <= s))
    .map(x => ({ set: x, who, slot: x.slot, time: x.time || slotTime(x.slot), key: medKey(s, x.id, who) }))
    .sort((a, b) => a.time < b.time ? -1 : a.time > b.time ? 1 : (a.set.who === 'we' ? -1 : 1));
}
