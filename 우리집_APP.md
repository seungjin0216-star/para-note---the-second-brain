# 🏠 우리집 — 집안일 홈 대시보드

> 갤럭시탭(가로) = 거실 대시보드 · 폰 = 빠른 입력 · 사장님 + 여자친구 두 사람
> 시작 26-10-02 · 주소 **https://paranote.netlify.app/home/**

---

## 0. 🔴 건드리기 전

```
🔴 제2의뇌 사이트 안에 얹혀 있습니다 (public/home/ · netlify/functions/home-*)
     제2의뇌를 고칠 때 /home/ 을 지우거나 덮지 말 것
     vite.config.js 의 navigateFallbackDenylist /^\/home/ 을 빼면
     제2의뇌 서비스워커가 /home/ 을 제2의뇌 화면으로 바꿔치기합니다
🔴 Firestore 는 제2의뇌와 같은 프로젝트(exobrain-paranote) · 자리만 다름
     제2의뇌  users/{uid}/…      우리집  homes/main/…      비밀  homeSecrets/vapid
🔴 보안 규칙에 두 사람 이메일이 들어 있습니다 — 저장소(Public)의 firestore.rules 에는 없음
     규칙을 다시 게시할 때 아래 「보안 규칙」 전문을 쓸 것. 저장소 파일을 그대로 올리면 우리집이 막힘
🔴 지우는 코드 없음 (CLAUDE.md ④) — 약·루틴·집안일 빼기 = off:true · 음식 = status 다먹음/버림
🔴 날짜 계산은 public/home/core.js 하나 — 화면과 알림 서버가 같은 파일을 import
     시험: node tools/home_core_test.mjs  (20개 · 한국 자정 경계 · 31일 · 2/29)
```

---

## 1. 왜 이렇게 했나

```
사장님 지시 0단계  「이미 실시간 동기화+로그인 쓰는 앱을 찾아 같은 스택·계정으로」
  → 제2의뇌 = Firebase 구글 로그인 + Firestore 실시간 + Netlify
  → 새 Firebase 프로젝트·새 Netlify 사이트를 만들지 않고 제2의뇌 사이트 /home/ 에 얹음
     이유: 구글 로그인 허용 도메인 · 서비스 계정 · Netlify 환경변수가 이미 다 있음
           사장님이 콘솔에서 할 일이 「규칙 붙여넣기」 하나로 줄어듦
  ⚠️ 서비스 계정에는 규칙 게시 권한이 없습니다 (403 확인) → 규칙만 사장님이 붙여넣기

화면 한 장 (빌드 없음)   제2의뇌는 React/Vite 지만 우리집은 public/ 의 HTML 한 장
  → Vite 가 그대로 dist/home/ 으로 복사. 제2의뇌 빌드와 안 엉킴
Firebase 웹 설정은 코드에 안 적음 (규칙 ⑥) → home-api?a=config 가 Netlify 환경변수 VITE_FIREBASE_* 를 돌려줌
알림 비밀키(VAPID)는 Firestore homeSecrets/vapid — 규칙이 화면에서는 못 읽게 막고 서버(관리자)만 읽음
  → Netlify 환경변수를 새로 안 넣어도 됨
```

### 사장님 말 (판단 근거)

```
「갤럭시 탭에서 주로 확인 … 가로모드로 많이 볼 것」
「약 … 왼쪽 오른쪽은 남녀가 나눠져서 각각 체크」
「안 먹는다? 각자 웹앱 공유니까 알림을 울려서 먹게끔 … 여기서도(탭) 알림이 있어야 해」
「약을 먹어야 할 때, 먹지 않으면 1시간 이후 알림」
「누군가가 운동을 그날 했을 때 (끝나고 체크해서 웹앱에서 알림)」
「일정 한 시간 전에 알림, 일정 있는 날 전체적인 일정을 확인하라는 알림」
「사람별 분담 통계 화면은 만들지 마」  → 누가 했는지는 저장만 (by · lastBy)
```

---

## 2. 화면

```
탭 가로 (가로 ≥900px)   왼쪽 메뉴 · 홈은 스크롤 없이 한 화면 (1280×800 에서 확인)
  홈     시계+오늘·내일 일정 | 약(나/여자친구) · 곧 먹을 것 | 집안일 · 운동
폰                       아래 메뉴 · 「내 것」만 체크 가능 (상대 것은 보기만)
거실 탭 역할 (설정)       체크 버튼이 사람마다 따로 · 밤 0~7시 어두운 시계 · 화면 켜짐(Wake Lock)
  ⚠️ 역할을 안 고르면 「가로 큰 화면 = 거실 탭」 으로 자동
```

| 화면 | 핵심 |
|---|---|
| 💊 약 | 왼쪽 나 · 오른쪽 여자친구 · 시각마다 체크 · 넣기/고치기/빼기 · 폰에서 상대가 안 먹었으면 「🔔 알려주기」 |
| 📅 일정 | 주/월 · 반복(한 번·매주 요일·매월·매년·N일마다) · 「이날만 빼기」(skip) · 「앞으로 전부 빼기」(until) |
| 🧊 냉장고 | 냉장/냉동/실온 · 반찬 기본 5일 · 다 먹음/버림 → 기록에 남음 · 되돌리기 |
| 💪 운동 | 루틴(나·여자친구·둘 다) · 연속 일수 · 이달 달력 |
| 🧹 집안일 | 밀림/오늘/이번 주/나중 · **한 날부터** 다음 날 계산 |

---

## 3. 알림 — 언제 누구에게

| 무엇 | 언제 | 누구 | 어디서 |
|---|---|---|---|
| 💊 약 먹을 시간 | 그 시각 (5분 안) | 먹을 사람 + 탭 | home-cron |
| ⏰ 아직 안 먹음 | 시각 + 1시간 | 먹을 사람 + 상대 + 탭 | home-cron |
| 🔔 먹으라고 | 폰에서 「알려주기」 누를 때 | 상대 | home-api poke |
| 💪 운동 끝 | 그날 할 루틴을 다 체크한 순간 (하루 한 번) | 상대 + 탭 | home-api workout |
| 📅 1시간 뒤 | 시각 있는 일정 60분 전 | 그 사람(같이=둘) + 탭 | home-cron |
| 📅 오늘 일정 | 일정 있는 날 아침 8시 (11시까지 못 보냈으면 그때) | 둘 + 탭 | home-cron |

```
home-cron   5분마다 (Netlify 예약 함수 · 게시된 배포에서만 돔)
같은 알림 두 번 막기   homes/main/notified/{날짜} 에 키를 적음
구독 끊긴 기기(410)   subs/{id} off:true 표시만
⚠️ 오늘 그 시각 뒤에 새로 넣은 약은 오늘 그 시각 알림을 건너뜀 (넣자마자 「1시간 지남」이 오는 걸 막음)
⚠️ 아이폰은 「홈 화면에 추가」 한 뒤 거기서 열어야 알림을 받습니다 (iOS 16.4+)
```

---

## 4. 데이터 — homes/main/…

```
(문서) homes/main      members.me / members.her = {name, email}   첫 로그인 때 「이 계정은 누구?」로 채움
meds/{id}         name who times[] memo created start off
medLogs/{날짜_약id_시각}   date medId time who taken at by
events/{id}       title who(me|her|we) date time repeat{type,days,n} until skip[] off
food/{id}         name place kind added expires qty status(있음|다먹음|버림) outDay outBy
routines/{id}     name who(me|her|we) sched{type,days,n,start} off
workLogs/{날짜_who_루틴id}   date who rid done at by
chores/{id}       name who(me|her|any) every{type:days,n | weekdays,days} start lastDone lastBy prevDone off
choreLogs/{id}    choreId date by at          (기록만 · 화면은 안 읽음)
subs/{endpoint해시}  who(me|her|tab) sub ua off
notified/{날짜}    알림 보낸 키들
homeSecrets/vapid publicKey privateKey subject   ← 서버만
```

### 보안 규칙 — Firebase 콘솔 → Firestore → 규칙 에 **이 전문을** 붙여넣고 게시

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    function isHome() {
      return request.auth != null && request.auth.token.email_verified == true
        && request.auth.token.email.lower() in ['<사장님 지메일>', '<여자친구 지메일>'];
    }
    match /homes/main { allow read, write: if isHome(); }
    match /homes/main/{document=**} { allow read, write: if isHome(); }
    match /{document=**} { allow read, write: if false; }
  }
}
```

⚠️ 이메일은 저장소에 적지 않습니다. 사장님 Mac 의 `~/우리집_파이어베이스_규칙.txt` 에 실제 값이 있습니다.

---

## 5. 🔧 문제 로그

| 증상 | 원인 | 이걸로 가려낸다 | 해결 | 언제 |
|---|---|---|---|---|
| 큰 화면인데 폰 화면이 뜸 | 처음 그릴 때 창이 좁아 「폰」으로 굳음 | 설정의 이 기기 | 고르지 않았으면 매번 화면 크기로 판단 | 26-10-02 |
| 서비스 계정으로 규칙 게시 403 | firebase-adminsdk 계정에 규칙 권한 없음 | firebaserules API 403 | 사장님이 콘솔에서 붙여넣기 | 26-10-02 |

---

## 6. 🚧 남은 것

```
⏳ 사장님   보안 규칙 붙여넣기 (여자친구 지메일 필요) · 탭에서 「알림 받기」 · 두 폰에서 로그인
⏳ 확인 필요  Netlify 함수가 VITE_FIREBASE_* 를 읽는지 → home-api?a=health
⏳ 확인 필요  아이폰 홈 화면 앱에서 구글 로그인 (팝업 → 안 되면 리다이렉트로 넘어가게 해둠)
🚧 2차      생활비 (우리카드 문자 → POST · 원문 저장 · 취소 맞추기 · 중복 막기) — 시안 ③ 참고
```
