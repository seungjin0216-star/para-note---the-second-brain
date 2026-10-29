/* ═══════════════════════════════════════════════════════════
   📚 세무사 박나은 — 공부 계산 (화면과 알림 서버가 **같은 이 파일**을 씁니다 · core.js 와 같은 원칙)
   사장님 (26-10-28~29):
     「공부시간보다 더 중요한 것은 … 얼마나 규칙적으로 나오느냐와 … 공부 진도량」
     「내가 여기까지 했다 > 1회독을 위해 전체 몇 퍼를 했다고 산출」 「회독에도 몇 회독 했는지 기록」
     「주 1회 쉬는 것까지는 괜찮으나 2회 이상 쉬면 안 되게 · 최소 공부 시간은 하루 4시간」
   ⚠️ 공부의 하루는 새벽 5시에 바뀝니다 (밤 12시 넘어 퇴근해도 그날 공부) — 약과 같음
   ⚠️ 시각은 서버가 찍은 ms
   26-10-29 사장님: 「공부 서로서로 같이 하는 용도이며, 응원하는 사람이 있다 … 그래서 응원도 하고」
     → 박나은의 공부 앱 + 장승진은 응원하는 사람 (사진·위치 없음)
   ═══════════════════════════════════════════════════════════ */
import { kst, addDays, diffDays, wdOf } from './core.js';

/* ── 목차 (문서/참고/세무사2차_목차.md · 사장님이 준 캡처 23장) ──
   책 = 순서대로 넘기는 한 줄. 회계학 1부는 재무·원가 두 권
   ⚠️ 세법학2 조특 6 「보칙」은 캡처 끝이 잘려 추정 — 확인 필요 */
const U = (sec, list) => list.split(' · ').map(t => ({ s: sec, t }));
export const BOOKS = [
  { k: 'fa', name: '재무회계', subj: '회계학 1부', c: '#60a5fa', units: U('', '재무보고를 위한 개념체계 · 현금과 수취채권 · 재고자산과 농림어업자산 · 유형자산과 투자부동산 · 차입원가의 자본화 · 무형자산과 기타자산 · 금융부채와 사채 · 충당부채와 종업원급여 · 자본 · 수익인식 · 투자목적 금융자산 · 복합금융상품 · 주식기준보상 · 주당이익 · 리스 · 법인세회계 · 회계변경과 오류수정 · 현금흐름표 · 재무회계의 기타사항 · 환율변동회계와 파생상품회계 · 관계기업과 공동기업투자 · 사업결합과 합병회계 · 연결회계 · 연결의 특수주제') },
  { k: 'ca', name: '원가회계', subj: '회계학 1부', c: '#a78bfa', units: U('', '원가의 분류와 원가의 흐름 · 원가배분·보조부문·개별원가계산 · 종합원가계산 · 연산품과 부산물 · 변동원가계산과 초변동원가계산 · 활동기준원가계산 · 원가추정 · 원가-조업도-이익분석 · 관련원가분석 · 자본예산 · 불확실성하의 의사결정 · 종합예산 · 표준원가계산 · 판매부문과 투자중심점의 성과평가 · 대체가격결정 · 전략적 원가관리와 성과평가') },
  { k: 'tx', name: '세무회계', subj: '회계학 2부', c: '#34d399', units: [
    ...U('법인세', '세무조정과 소득처분 · 익금(1) 주요 익금 · 익금(2) 의제배당 · 손금(1) 주요 손금 · 손금(2) 접대비와 기부금 · 손금(3) 감가상각비 · 손금(4) 지급이자 · 손익의 귀속시기 · 자산의 취득과 평가 · 퇴직급여·퇴직연금충당금 · 대손충당금 · 일시상각충당금과 준비금 · 부당행위계산의 부인 · 과세표준과 세액 · 기업구조개편거래 · 연결납세제도 · 그 밖의 법인세'),
    ...U('소득세', '금융소득 · 사업소득 · 근로·연금·기타소득 · 소득금액계산 특례 · 종합소득 과세표준 · 종합소득세액 · 퇴직소득세 · 양도소득세 · 동업기업 과세제도'),
    ...U('부가가치세', '과세표준과 매출세액 · 매입세액과 납부세액 · 겸영사업자의 세액 계산 · 간이과세'),
    ...U('상속·증여세', '상속세 · 증여세')] },
  { k: 'l1', name: '세법학 1부', subj: '세법학 1부', c: '#fbbf24', units: [
    ...U('국세기본법', '조세법의 기본원칙 · 국세부과와 세법적용의 원칙 · 납세의무 성립·확정·소멸 · 납세의무의 확장 · 국세와 다른 채권의 관계 · 과세 · 국세환급금과 환급가산금 · 조세구제와 납세자 권리 · 보칙'),
    ...U('법인세법', '법인세 총설 · 세무조정과 소득처분 · 익금 · 손금의 범위 · 주요 손금불산입 · 접대비와 기부금 · 감가상각비 · 지급이자 손금불산입 · 손익의 귀속시기 · 자산의 취득과 평가 · 충당금 · 준비금 · 부당행위계산의 부인 · 과세표준과 세액 · 신고 및 납부 · 합병·분할 특례 · 청산소득 · 비영리법인 · 외국법인 · 연결납세제도 · 신탁소득'),
    ...U('소득세법', '소득세법 총설 · 종합소득 · 소득금액계산의 특례 · 종합소득 과세표준과 세액 · 신고·납부 및 결정 · 퇴직소득 · 양도소득세 · 비거주자'),
    ...U('상속·증여세법', '상속세 · 증여세 · 공통 사항')] },
  { k: 'l2', name: '세법학 2부', subj: '세법학 2부', c: '#f472b6', units: [
    ...U('부가가치세법', '총설 · 총칙 · 과세거래 · 영세율과 면세 · 과세표준과 세율 · 거래징수·세금계산서 · 세액공제 · 겸영사업자 · 신고와 납부 · 간이과세'),
    ...U('개별소비세법', '총설 · 과세대상과 세율 · 과세대상의 판정 · 납세의무자 · 과세시기 · 과세표준 · 미납세반출 · 신고·납부 및 결정 · 면세 · 보칙'),
    ...U('지방세법', '지방세기본법 · 취득세 · 등록면허세 · 재산세 · 감면'),
    ...U('조세특례제한법', '총설 · 직접국세 · 간접국세 · 외국인투자·제주·기업도시 · 그 밖의 조세특례 · 보칙')] },
];
export const TOTAL = BOOKS.reduce((n, b) => n + b.units.length, 0);   // 144
export const bookOf = k => BOOKS.find(b => b.k === k);

export const MIN_DAY = 4 * 60;          // 「최소 공부 시간은 하루 4시간」
export const REST_OK = 1;               // 「주 1회 쉬는 것까지는 괜찮으나 2회 이상 쉬면 안 되게」

/** 공부의 하루 — 새벽 5시 전이면 아직 어제 */
export function stDay(t = Date.now()) { const k = kst(new Date(t)); return k.min < 5 * 60 ? addDays(k.date, -1) : k.date; }
/** 그 주 월요일 */
export function weekStart(s) { return addDays(s, -((wdOf(s) + 6) % 7)); }
export const hm = ms => { const k = kst(new Date(ms)); return k.time; };
export function dur(min) { min = Math.max(0, Math.round(min)); const h = Math.floor(min / 60), m = min % 60; return h ? (m ? `${h}시간 ${m}분` : `${h}시간`) : `${m}분`; }

/* ── 출퇴근 ──
   study/{날짜} = { date, sessions:[{in, out}] }
   하루에 여러 번 출근·퇴근 가능 (밥 먹고 다시 등). 시간 = 닫힌 것들의 합 */
export const sessions = doc => (doc && doc.sessions) || [];
export const isOpen = doc => { const s = sessions(doc); return !!(s.length && !s[s.length - 1].out); };
/** 공부한 분 — now 를 주면 열린 것도 지금까지 셈 (화면용). 「끝」을 안 누른 지난 날은 0 */
export function dayMin(doc, now) {
  return sessions(doc).reduce((n, s) => n + (s.out ? s.out - s.in : now ? Math.max(0, now - s.in) : 0), 0) / 60e3;
}
/** 서버와 미리보기가 똑같이 쓰는 기록 바꾸기 — {doc} 또는 {err} */
export function applySt(doc, kind, at) {
  doc = JSON.parse(JSON.stringify(doc || {}));
  doc.sessions = doc.sessions || [];
  const last = doc.sessions[doc.sessions.length - 1];
  if (kind === 'in') {
    if (last && !last.out) return { err: '이미 공부 중이에요' };
    doc.sessions.push({ in: at, out: null });
  } else if (kind === 'out') {
    if (!last || last.out) return { err: '시작 기록이 없어요' };
    if (at - last.in > 16 * 3600e3) return { err: '16시간이 넘어 「끝」을 못 눌러요 — 그날은 0시간으로 남습니다' };
    last.out = at;
  } else return { err: '모르는 기록' };
  return { doc };
}

/* ── 그날 상태 ──
   before  공부 시작 전 (첫 출근 전 날은 쉰 날로 안 셈)
   future  아직 안 온 날 · today 오늘(진행 중)
   rest    출근 없음 = 쉰 날 · short 4시간 안 됨 · ok 4시간 넘김 */
export function dayStatus(doc, s, today, start, now) {
  if (s > today) return 'future';
  if (!start || s < start) return 'before';
  const min = dayMin(doc, s === today ? now : 0);
  if (s === today) return min >= MIN_DAY ? 'ok' : 'today';
  if (!sessions(doc).length) return 'rest';
  return min >= MIN_DAY ? 'ok' : 'short';
}
/** 첫 출근 날 */
export function startDay(study) { const ds = Object.values(study || {}).filter(d => sessions(d).length).map(d => d.date).sort(); return ds[0] || null; }

/* ── 진도 · 회독 ──
   studyLogs/{id} = { book, round, unit, at, date }   unit = 그 회독에서 「여기까지」 한 단원 번호 (1부터)
   마지막 단원까지 가면 그 회독 끝 → 다음 회독 0 부터
   pos = 지금까지 넘긴 단원 수 전부 (회독 합)  예) 24단원 책 2회독째 6단원 = 30 */
export function bookState(logs, k, before = Infinity) {
  const b = bookOf(k), N = b.units.length;
  const xs = Object.values(logs || {}).filter(l => l.book === k && (l.at || 0) < before).sort((a, c) => (a.at || 0) - (c.at || 0));
  const l = xs[xs.length - 1];
  if (!l) return { round: 1, unit: 0, done: 0, N, pos: 0, pct: 0 };
  const r = Math.max(1, +l.round || 1), u = Math.min(N, Math.max(0, +l.unit || 0));
  const st = u === N ? { round: r + 1, unit: 0, done: r } : { round: r, unit: u, done: r - 1 };
  return { ...st, N, pos: st.done * N + st.unit, pct: Math.round(st.unit / N * 100) };
}
/** 전체 회독 — 144단원 기준 (예 1.4회독) */
export function totalRounds(logs, before) { return BOOKS.reduce((n, b) => n + bookState(logs, b.k, before).pos, 0) / TOTAL; }

/* ── 주간 리포트 (월~일) ── 화면과 월요일 아침 알림이 같은 것 */
export function weekReport(study, logs, ws, today, now) {
  const start = startDay(study), days = [];
  for (let i = 0; i < 7; i++) {
    const s = addDays(ws, i), doc = (study || {})[s];
    days.push({ date: s, min: dayMin(doc, s === today ? now : 0), st: dayStatus(doc, s, today, start, now), noOut: sessions(doc).some(x => !x.out) && s < today });
  }
  const we = addDays(ws, 7), t0 = Date.parse(ws + 'T05:00:00+09:00'), t1 = Date.parse(we + 'T05:00:00+09:00');
  const prog = BOOKS.map(b => { const a = bookState(logs, b.k, t0), z = bookState(logs, b.k, t1); return { k: b.k, name: b.name, add: z.pos - a.pos, z }; });
  return {
    ws, we: addDays(ws, 6), days,
    study: days.filter(d => d.min > 0).length,
    rest: days.filter(d => d.st === 'rest').length,
    over4: days.filter(d => d.min >= MIN_DAY).length,
    short: days.filter(d => d.st === 'short').length,
    total: days.reduce((n, d) => n + d.min, 0),
    units: prog.reduce((n, p) => n + p.add, 0), prog,
    rounds: totalRounds(logs, t1),
    noOut: days.filter(d => d.noOut).length,
  };
}
/** 알림 한 줄 */
export function reportLine(r) {
  return `출석 ${r.study}일 · 쉰 날 ${r.rest}일 · 총 ${dur(r.total)} · 4시간↑ ${r.over4}일 · 진도 +${r.units}단원 · 전체 ${r.rounds.toFixed(2)}회독`
    + (r.noOut ? ` · 「끝」 안 누른 날 ${r.noOut}일` : '');
}
export { diffDays };
