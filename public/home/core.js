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
  if (ev.type === 'monthly') {   // 매달 — 한 날의 다음 달 같은 날 (31일이 없으면 그 달 마지막 날)
    const [y, m, d] = ch.lastDone.split('-').map(Number), ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
    return `${ny}-${pad(nm)}-${pad(Math.min(d, lastDay(ny, nm)))}`;
  }
  if (ev.type === 'weekdays' && (ev.days || []).length) {
    for (let i = 1; i <= 7; i++) { const s = addDays(ch.lastDone, i); if (ev.days.includes(wdOf(s))) return s; }
  }
  return addDays(ch.lastDone, Math.max(1, +ev.n || 7));
}
export function everyText(ev) {
  if (!ev) return '';
  if (ev.type === 'weekdays') return (ev.days || []).map(d => DAY[d]).join('·');
  if (ev.type === 'monthly') return '매달';
  const n = +ev.n || 7;
  if (n % 30 === 0) return n === 30 ? '한 달마다' : `${n / 30}달마다`;
  if (n === 7) return '매주';
  if (n === 14) return '격주';
  if (n % 7 === 0) return `${n / 7}주마다`;
  return n === 1 ? '매일' : `${n}일마다`;
}

/* ── 약 — 하나씩 (26-10-02 두 번째) ─────────────────────
   사장님: 「약 세트 그냥 없애고 각각 알아서 보게끔」 · 「아침, 점심, 저녁」
   med = { name, who: 'we'|'me'|'her', slots: ['아침','저녁'] }   we = 둘 다 먹는 약 (각자 체크)
   기록 키  날짜_약id_시간대_사람
   ⚠️ 26-10-02 오전의 「세트」(slot · pills[]) 는 화면이 열릴 때 약 하나씩으로 풀어 옮깁니다 */
export const SLOTS = [['아침', '07:30'], ['점심', '14:00'], ['자기 전', '00:30']];
/* ⚠️ 26-10-03 사장님: 「아침(공복) 7:30 · 점심 14:00 · 자기 전 00:30」
   자기 전 00:30 은 달력으로는 다음 날이지만 **그날 약**입니다 (그날 밤에 자기 전에 먹는 것)
   → 약의 하루는 새벽 5시에 바뀝니다. 00:30 = 그날의 24:30 (1470분)
   ⚠️ 옛 「저녁」·「자기전」 약은 「자기 전」으로 봅니다 (안 보이면 조용히 빠지는 병) */
export const SLOT_ALIAS = { 저녁: '자기 전', 자기전: '자기 전' };
export const SLOT_LABEL = { 아침: '아침 (공복)', 점심: '점심', '자기 전': '자기 전' };
export const slotTime = (slot) => (SLOTS.find(x => x[0] === (SLOT_ALIAS[slot] || slot)) || ['', '00:30'])[1];
export const slotMin = (slot) => { const m = hm2min(slotTime(slot)); return m < 5 * 60 ? m + 1440 : m; };
/** 약의 「오늘」 — 새벽 5시 전이면 아직 어제 */
export function medNow(d = new Date()) { const k = kst(d), early = k.min < 5 * 60; return { day: early ? addDays(k.date, -1) : k.date, min: early ? k.min + 1440 : k.min }; }
export function slotOf(t) { const m = hm2min(t); return m >= 5 * 60 && m < 11 * 60 ? '아침' : m >= 11 * 60 && m < 18 * 60 ? '점심' : '자기 전'; }
export function medKey(s, medId, slot, who) { return `${s}_${medId}_${slot}_${who}`; }
/** 그날 그 사람이 먹을 것 [{med, who, slot, time, key}] — 시간대 → 같이 먼저 → 이름 */
export function medsFor(meds, who, s) {
  const out = [];
  meds.filter(m => !m.off && (m.slots || []).length && (m.who === 'we' || m.who === who))
    /* ⚠️ 26-10-03 「약을 넣었는데 시간대 칸에 안 들어감」 — 새벽 1시에 넣으면 start 가 달력 날짜(10/3)인데
          약의 하루는 아직 10/2 라 「아직 시작 안 한 약」 으로 빠졌습니다 (조용한 실패). start 로 거르지 않습니다.
          새로 넣은 약에 지난 시각 알림이 가는 것은 서버가 created 로 막습니다 */
    .forEach(m => [...new Set(m.slots.map(x => SLOT_ALIAS[x] || x))].forEach(sl => { if (SLOTS.some(x => x[0] === sl)) out.push({ med: m, who, slot: sl, time: slotTime(sl), min: slotMin(sl), key: medKey(s, m.id, sl, who) }); }));
  const order = sl => SLOTS.findIndex(x => x[0] === sl);
  return out.sort((a, b) => order(a.slot) - order(b.slot) || (a.med.who === 'we' ? 0 : 1) - (b.med.who === 'we' ? 0 : 1) || (a.med.name < b.med.name ? -1 : 1));
}
