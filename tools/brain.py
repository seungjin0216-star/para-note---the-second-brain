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
    python3 tools/brain.py log "메모 한 줄"          📝
    python3 tools/brain.py notes                  기록 보기

⚠️ 「완료」는 Claude 가 하지 않습니다. 사장님이 앱에서 「완료」를 누릅니다 (check 까지만)
⚠️ 지우는 명령은 없습니다 (CLAUDE.md ④) — 앱에서 「빼기」 = off:true
⚠️ 고민(worry)은 사장님이 대화에서 실제로 말한 것만. 제 추측을 고민으로 적지 않습니다
"""
import sys
import time

import requests

from todo import Firestore, MAIN_UID

APPS = {"staff": "🏪 매장통합앱(직원)", "owner": "👔 매장통합앱(사장)", "alba": "💵 알바비계산기", "home": "🏠 우리집"}
ST = {"new": "새로", "doing": "작업 중", "check": "확인해 주세요", "done": "완료"}


def val(v):
    if isinstance(v, bool):
        return {"booleanValue": v}
    if isinstance(v, (int, float)):
        return {"integerValue": str(int(v))}
    return {"stringValue": str(v)}


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
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
