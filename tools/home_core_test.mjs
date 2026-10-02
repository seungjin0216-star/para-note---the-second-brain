import * as c from '../public/home/core.js';
const eq=(a,b,m)=>{ if(JSON.stringify(a)!==JSON.stringify(b)){ console.log('❌',m,a,b); process.exitCode=1;} else console.log('✅',m); };
// KST 경계: UTC 14:59 = KST 23:59 / UTC 15:00 = 다음날 00:00
eq(c.kst(new Date('2026-10-02T14:59:00Z')).date,'2026-10-02','KST 23:59 는 그날');
eq(c.kst(new Date('2026-10-02T15:00:00Z')).date,'2026-10-03','KST 자정 넘으면 다음날');
eq(c.kst(new Date('2026-10-02T15:00:00Z')).wd,6,'10/3 은 토요일');
// 소비기한
eq(c.dday('2026-10-02','2026-10-02').text,'오늘까지','기한 당일');
eq(c.dday('2026-10-01','2026-10-02').text,'1일 지남','하루 지남');
eq(c.dday('2026-10-03','2026-10-02').cls,'r','D-1 빨강');
eq(c.dday('2026-10-05','2026-10-02').cls,'y','D-3 노랑');
eq(c.dday('2026-10-06','2026-10-02').cls,'n','D-4 보통');
eq(c.addDays('2026-12-29',5),'2027-01-03','반찬 5일 해넘김');
// 반복
const m31={date:'2026-01-31',repeat:{type:'monthly'}};
eq(['2026-02-28','2026-03-31','2026-04-30','2026-04-29'].map(s=>c.occursOn(m31,s)),[true,true,true,false],'매월 31일 → 짧은 달 마지막날');
const y29={date:'2024-02-29',repeat:{type:'yearly'}};
eq(['2025-02-28','2028-02-29','2028-02-28'].map(s=>c.occursOn(y29,s)),[true,true,false],'2/29 매년');
const wk={date:'2026-10-02',repeat:{type:'weekly',days:[1,5]}};
eq(['2026-10-02','2026-10-05','2026-10-06','2026-09-28'].map(s=>c.occursOn(wk,s)),[true,true,false,false],'매주 월·금 (시작 전 X)');
const n3={date:'2026-10-02',repeat:{type:'everyN',n:3},until:'2026-10-08'};
eq(['2026-10-05','2026-10-08','2026-10-11','2026-10-06'].map(s=>c.occursOn(n3,s)),[true,true,false,false],'3일마다 + 끝나는 날');
// 집안일
eq(c.choreNext({lastDone:'2026-10-02',every:{type:'days',n:14}}),'2026-10-16','2주마다');
eq(c.choreNext({lastDone:'2026-10-02',every:{type:'weekdays',days:[1,5]}}),'2026-10-05','월·금 — 금요일에 하면 다음 월요일');
eq(c.choreNext({lastDone:'2026-10-05',every:{type:'weekdays',days:[1,5]}}),'2026-10-09','월요일에 하면 금요일');
// 운동 연속
const R=[{id:'a',who:'me',sched:{type:'daily'}},{id:'b',who:'me',sched:{type:'days',days:[0]}}];
const L={'2026-10-01_me_a':1,'2026-09-30_me_a':1,'2026-09-29_me_a':1};
eq(c.streak(R,L,'me','2026-10-02'),3,'오늘 아직 → 어제부터 3일');
L['2026-10-02_me_a']=1; eq(c.streak(R,L,'me','2026-10-02'),4,'오늘 하면 4일');
eq(c.dayDone(R,{'2026-10-04_me_a':1},'me','2026-10-04'),false,'일요일은 b 도 해야 다 함');
// 약 하나씩
const MEDS=[{id:'a',who:'we',slots:['아침','저녁'],name:'오메가3'},{id:'b',who:'me',slots:['아침'],name:'혈압약'},{id:'c',who:'her',slots:['점심'],name:'철분'},{id:'d',who:'we',slots:['아침'],off:true,name:'X'}];
eq(c.medsFor(MEDS,'me','2026-10-02').map(x=>x.key),['2026-10-02_a_아침_me','2026-10-02_b_아침_me','2026-10-02_a_자기 전_me'],'내 약 = 같이 + 나만 · 시간대 순 · 옛 「저녁」은 자기 전으로');
eq(c.medsFor(MEDS,'her','2026-10-02').map(x=>x.time),['07:30','14:00','00:30'],'시간대 시각 7:30 · 14:00 · 00:30');
eq([c.slotOf('07:00'),c.slotOf('13:00'),c.slotOf('22:00'),c.slotOf('00:30')],['아침','점심','자기 전','자기 전'],'시각 → 시간대');
eq(c.medNow(new Date('2026-10-02T15:40:00Z')),{day:'2026-10-02',min:1480},'KST 00:40 은 아직 10/2 약 (24:40)');
eq(c.medNow(new Date('2026-10-02T20:10:00Z')),{day:'2026-10-03',min:310},'KST 05:10 부터 10/3 약');
eq(c.slotMin('자기 전'),1470,'자기 전 = 24:30');
// 매주 · 격주 · 매달
eq(c.choreNext({lastDone:'2026-01-31',every:{type:'monthly'}}),'2026-02-28','매달 — 1/31 다음은 2/28');
eq(c.choreNext({lastDone:'2026-12-15',every:{type:'monthly'}}),'2027-01-15','매달 — 해넘김');
eq([c.everyText({type:'days',n:7}),c.everyText({type:'days',n:14}),c.everyText({type:'monthly'})],['매주','격주','매달'],'주기 글자');
// 한 번만 할 일
eq(c.choreNext({once:true,created:'2026-10-02'}),'2026-10-02','한 번만 — 안 했으면 넣은 날');
eq(c.choreNext({once:true,created:'2026-10-02',lastDone:'2026-10-02'}),'9999-12-31','한 번만 — 하면 끝');
