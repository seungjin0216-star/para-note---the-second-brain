"""
제2의뇌 (새 화면 /brain/) — Claude 가 읽고 쓰는 도구   (26-10-14)

사장님: 「저와 이어지는 고리 : 좋아 해보자」
        「핸드폰보다는 맥북으로 이런저런 대화를 많이 하는데 이걸 제2의뇌에 기록하고 결과를 보거나 하는 방법이 없을까?」

    python3 tools/brain.py issues                 앱 판 — 끝나지 않은 문제 (번호 = 짧은 id)
    python3 tools/brain.py issues --all           완료까지
    python3 tools/brain.py issue staff "내용"      문제 적기 (staff · owner · alba · home)
    python3 tools/brain.py doing <id>             작업 중으로
    python3 tools/brain.py check <id> "바꾼 것"    🔎 확인해 주세요 + 🤖 한 줄  ← 고친 뒤 반드시
    python3 tools/brain.py worry "고민 한 줄"       💭 맥북 대화에서 나온 고민 (from mac)
    python3 tools/brain.py solved <id> "어떻게 넘겼나"   고민 풀림
    python3 tools/brain.py log "메모 한 줄"          📝 (옛 · 쓰지 않음)
    python3 tools/brain.py notes                  기록 보기
    python3 tools/brain.py plan pull              🎯 앱에서 체크한 것을 계획 md 에 옮김   ← md 고치기 전에 반드시
    python3 tools/brain.py plan push              🎯 계획 md → 앱 (체크는 둘 중 하나라도 ✓ 면 ✓)
    python3 tools/brain.py sync                   🔄 pull + push + 기록.md 새 줄 → 앱 (맥 자동 동기화가 부름)

🎯 계획 md 는 저장소 밖 ~/제2의뇌_계획/계획.md (저장소가 전부 Public 이라 — 사장님 비전은 공개하지 않음)

⚠️ 「완료」는 Claude 가 하지 않습니다. 사장님이 앱에서 「완료」를 누릅니다 (check 까지만)
⚠️ 지우는 명령은 없습니다 (CLAUDE.md ④) — 앱에서 「빼기」 = off:true
🔴 26-10-15 무엇이 어디로 (사장님 「계획은 사업·진로 … 기록은 사업·진로와 관련 없이 개인적인 고민이나, 공부 내용 등 느끼는 내용」)
   🎯 계획(계획.md)   사업·진로 — 비전 · 계획 · 생각해 볼 것 · 돌아보기(피드백)
   💭 기록(brain_notes) 개인 — 💭 고민 · 📚 공부 · 🌱 느낀 것   (worry · study · feel)
   📱 앱 판           앱 문제 · ✅ 할 일·📅 일정은 스케줄
   ⛔ 앱을 만들며 나눈 대화 · 일하는 방식 결정 · 작업 기록 은 어디에도 넣지 않음 → 작업일지(문서/작업일지/)
   ⛔ 사장님이 「남겨 줘」 하지 않은 개인 이야기를 Claude 가 알아서 기록하지 않음 (worry 명령은 그때만)
"""
import os
import re
import sys
import time

import requests

from todo import Firestore, MAIN_UID

APPS = {"staff": "🏪 매장통합앱(직원)", "owner": "👔 매장통합앱(사장)", "alba": "💵 알바비계산기", "home": "🏠 우리집"}
ST = {"new": "새로", "doing": "작업 중", "check": "확인해 주세요", "done": "완료"}


def val(v):
    if isinstance(v, list):
        return {"arrayValue": {"values": [val(x) for x in v]}}
    if isinstance(v, dict):
        return {"mapValue": {"fields": {k: val(x) for k, x in v.items()}}}
    if isinstance(v, bool):
        return {"booleanValue": v}
    if isinstance(v, (int, float)):
        return {"integerValue": str(int(v))}
    return {"stringValue": str(v)}


def unval(f):
    t, v = list(f.items())[0]
    if t == "arrayValue":
        return [unval(x) for x in v.get("values", [])]
    if t == "mapValue":
        return {k: unval(x) for k, x in v.get("fields", {}).items()}
    if t == "integerValue":
        return int(v)
    return v


PLAN_MD = os.path.expanduser("~/제2의뇌_계획/계획.md")
LOG_MD = os.path.expanduser("~/제2의뇌_계획/기록.md")   # Cowork 가 「# 새 기록」 아래에 한 줄씩 → sync 가 앱으로 옮기고 「# 앱에 들어감」 으로 내림 (지우지 않음)


def plan_parse(text):
    """# 비전 / ## 계획 [상태] / 왜: / - [ ] 단계 / # 돌아보기 / - 날짜 · 글"""
    out = {"vision": "", "plans": [], "reviews": [], "ideas": []}
    sec, cur = None, None
    # ⚠️ 26-10-15 여러 줄 <!-- … --> 안의 예시 줄을 진짜로 읽어 앱에 「계획 이름」이 들어간 적 있음 → 주석은 통째로 건너뜀
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line.strip() or line.strip().startswith(">"):
            continue
        if line.startswith("# "):
            sec = line[2:].strip(); cur = None
            continue
        if line.startswith("## ") and sec and "계획" in sec:
            m = re.match(r"##\s+(.*?)\s*(?:\[(.+?)\])?$", line)
            cur = {"title": m.group(1), "status": m.group(2) or "", "why": "", "steps": []}
            out["plans"].append(cur)
            continue
        if sec and "비전" in sec:
            out["vision"] = (out["vision"] + " " + line.strip()).strip()
        elif sec and "계획" in sec and cur is not None:
            m = re.match(r"\s*-\s*\[( |x|X)\]\s*(.+)", line)
            if m:
                cur["steps"].append({"t": m.group(2).strip(), "d": m.group(1).lower() == "x"})
            elif line.strip().startswith("왜:"):
                cur["why"] = line.strip()[2:].strip()
        elif sec and "생각해" in sec:
            m = re.match(r"\s*-\s*(.+)", line)
            if m:
                out["ideas"].append(m.group(1).strip())
        elif sec and "돌아보기" in sec:
            m = re.match(r"\s*-\s*(\d{4}-\d{2}-\d{2})\s*[·:-]?\s*(.+)", line)
            if m:
                out["reviews"].append({"date": m.group(1), "text": m.group(2).strip()})
    return out


def get(fields, k, dv=""):
    f = fields.get(k)
    if not f:
        return dv
    return list(f.values())[0]


class Brain(Firestore):
    def col(self, name):
        return f"{self.base}/users/{MAIN_UID}/{name}"

    def list(self, name):
        out, tok = [], None
        while True:
            r = requests.get(self.col(name), headers=self.h, params={"pageSize": 300, **({"pageToken": tok} if tok else {})}, timeout=30)
            r.raise_for_status()
            j = r.json()
            out += j.get("documents", [])
            tok = j.get("nextPageToken")
            if not tok:
                return out

    def add(self, name, data):
        r = requests.post(self.col(name), headers=self.h, json={"fields": {k: val(v) for k, v in data.items()}}, timeout=30)
        r.raise_for_status()
        return r.json()["name"].split("/")[-1]

    def patch(self, name, doc_id, data):
        url = f"{self.col(name)}/{doc_id}"
        r = requests.patch(url, headers=self.h, json={"fields": {k: val(v) for k, v in data.items()}}, timeout=30,
                           params=[("updateMask.fieldPaths", k) for k in data])
        r.raise_for_status()

    def find(self, name, short):
        hits = [d for d in self.list(name) if d["name"].split("/")[-1].startswith(short)]
        if len(hits) != 1:
            raise SystemExit(f"❌ id 「{short}」 가 {len(hits)}개입니다. 더 길게 적어 주세요")
        return hits[0]["name"].split("/")[-1]


def main():
    a = sys.argv[1:] or ["issues"]
    b, now = Brain(), int(time.time() * 1000)
    cmd = a[0]
    if cmd == "issues":
        rows = []
        for d in b.list("brain_issues"):
            f = d["fields"]
            if get(f, "off") is True or (get(f, "status") == "done" and "--all" not in a):
                continue
            rows.append((get(f, "app"), get(f, "status", "new"), d["name"].split("/")[-1][:6], get(f, "text"), get(f, "note"), get(f, "back")))
        for app in APPS:
            xs = [r for r in rows if r[0] == app]
            if xs:
                print(f"\n▶ {APPS[app]}")
                for _, s, i, t, n, back in sorted(xs, key=lambda r: list(ST).index(r[1]) if r[1] in ST else 9):
                    print(f"   [{i}] {ST.get(s, s):8} {t}" + (f"   🤖 {n}" if n else "") + (f"   ↩ 사장님: {back}" if back else ""))
        print(f"\n앱 판 {len(rows)}건")
    elif cmd == "issue":
        app, text = a[1], a[2]
        if app not in APPS:
            raise SystemExit(f"❌ 앱은 {', '.join(APPS)} 중 하나")
        print("넣음", b.add("brain_issues", {"app": app, "text": text, "status": "new", "at": now, "from": "claude"})[:6])
    elif cmd == "doing":
        b.patch("brain_issues", b.find("brain_issues", a[1]), {"status": "doing", "upd": now})
        print("작업 중")
    elif cmd == "check":
        b.patch("brain_issues", b.find("brain_issues", a[1]), {"status": "check", "note": a[2], "upd": now})
        print("🔎 확인해 주세요로 바꿈")
    elif cmd == "worry":
        print("💭 남김", b.add("brain_notes", {"kind": "worry", "text": a[1], "at": now, "solved": False, "from": "mac"})[:6])
    elif cmd == "solved":
        b.patch("brain_notes", b.find("brain_notes", a[1]), {"solved": True, "how": a[2], "solvedAt": now})
        print("✅ 넘긴 고민")
    elif cmd == "log":
        print("📝 남김", b.add("brain_notes", {"kind": "log", "text": a[1], "at": now, "from": "mac"})[:6])
    elif cmd == "notes":
        for d in sorted(b.list("brain_notes"), key=lambda d: -int(get(d["fields"], "at", 0) or 0)):
            f = d["fields"]
            if get(f, "off") is True:
                continue
            k = get(f, "kind")
            mark = ("✅" if get(f, "solved") else "💭") if k == "worry" else {"idea": "💡", "log": "📝", "todo": "✅"}.get(k, "·")
            print(f"[{d['name'].split('/')[-1][:6]}] {mark} {get(f, 'text')}" + (f"  → {get(f, 'how')}" if get(f, "how") else "") + ("  🖥" if get(f, "from") == "mac" else ""))
    elif cmd == "sync":
        # 🔄 26-10-15 사장님 「클로드 코워크 방을 살려서 사용할 수는 없어? 얘는 폴더 추가가 되잖아」
        #    Cowork 는 ~/제2의뇌_계획 의 md 만 고침 → 맥(launchd)이 이 명령으로 앱에 올림
        sys.argv = [sys.argv[0], "plan", "pull"]; main()
        sys.argv = [sys.argv[0], "plan", "push"]; main()
        if os.path.exists(LOG_MD):
            lines = open(LOG_MD, encoding="utf-8").read().splitlines()
            new, done, sec, moved, 주석 = [], [], "", [], False
            for ln in lines:
                if "<!--" in ln:
                    주석 = True
                if 주석:
                    new.append(ln)
                    if "-->" in ln:
                        주석 = False
                    continue
                if ln.startswith("# "):
                    sec = ln
                if sec.startswith("# 새 기록") and re.match(r"\s*-\s*", ln):
                    m = re.match(r"\s*-\s*(?:(\d{4}-\d{2}-\d{2})\s*)?(💭|📚|🌱)\s*(.+)", ln)
                    if m:
                        kind = {"💭": "worry", "📚": "study", "🌱": "feel"}[m.group(2)]
                        b.add("brain_notes", {"kind": kind, "text": m.group(3).strip(), "at": now, "solved": False, "from": "cowork"})
                        moved.append(ln)
                        continue
                new.append(ln)
            if moved:
                if not any(l.startswith("# 앱에 들어감") for l in new):
                    new += ["", "# 앱에 들어감"]
                new += [f"{l.strip()}  ← {time.strftime('%m/%d %H:%M')}" for l in moved]
                open(LOG_MD, "w", encoding="utf-8").write("\n".join(new) + "\n")
            print(f"💭 기록 {len(moved)}줄 → 앱")
    elif cmd == "plan":
        url = f"{b.col('brain_plans')}/main"
        r = requests.get(url, headers=b.h, timeout=30)
        app = {k: unval(v) for k, v in r.json().get("fields", {}).items()} if r.status_code == 200 else {}
        app_done = {s["t"] for pl in app.get("plans", []) for s in pl.get("steps", []) if s.get("d")}
        text = open(PLAN_MD, encoding="utf-8").read()
        if a[1] == "pull":
            n = [0]
            def mark(m):
                if m.group(2).strip() in app_done and m.group(1) == " ":
                    n[0] += 1
                    return m.group(0).replace("[ ]", "[x]", 1)
                return m.group(0)
            open(PLAN_MD, "w", encoding="utf-8").write(re.sub(r"-\s*\[( |x|X)\]\s*(.+)", mark, text))
            print(f"앱에서 체크한 {n[0]}개를 md 에 옮김")
        elif a[1] == "push":
            P = plan_parse(text)
            # ⚠️ md 가 비었으면 앱을 덮지 않습니다 (빈 틀로 앱의 계획이 지워지는 것 막기)
            if not P["vision"] and not P["plans"] and not P["ideas"]:
                print("🎯 md 가 비어 있어 앱을 덮지 않음")
                return
            # ⚠️ 덮기 전 앱의 옛 판을 brain_plans/bak_<시각> 으로 한 벌 (지우지 않음 · 되돌릴 자리)
            old_plans = [(p.get("title"), [(x.get("t"), x.get("d")) for x in p.get("steps", [])]) for p in app.get("plans", [])]
            new_plans = [(p["title"], [(x["t"], x["d"] or x["t"] in app_done) for x in p["steps"]]) for p in P["plans"]]
            if app.get("plans") and old_plans != new_plans:
                requests.patch(f"{b.col('brain_plans')}/bak_{time.strftime('%Y%m%d%H%M%S')}", headers=b.h,
                               json={"fields": {k: val(v) for k, v in app.items()}}, timeout=30)
            for pl in P["plans"]:
                for st in pl["steps"]:
                    st["d"] = st["d"] or st["t"] in app_done
            P["updated"] = time.strftime("%Y-%m-%d")
            fields = {k: val(v) for k, v in P.items()}
            r = requests.patch(url, headers=b.h, json={"fields": fields}, timeout=30)
            r.raise_for_status()
            print(f"🎯 앱에 올림 — 계획 {len(P['plans'])}개 · 단계 {sum(len(p['steps']) for p in P['plans'])}개 · 돌아보기 {len(P['reviews'])}")
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
