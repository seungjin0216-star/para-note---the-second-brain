"""
제2의뇌 할일 도구 — Firestore 를 직접 읽고 쓴다

실행:
    python3 tools/todo.py                    밀린 할일 보기
    python3 tools/todo.py list --all         완료된 것까지 전부
    python3 tools/todo.py done 3             3번 항목 완료 표시
    python3 tools/todo.py undo 3             3번 항목 되돌리기
    python3 tools/todo.py add "프로젝트명" "할일 내용"
    python3 tools/todo.py del 3              3번 항목 아예 삭제 (잘못 넣었을 때만)
    python3 tools/todo.py projects           프로젝트 목록만

⚠️ del 은 되돌릴 수 없습니다
    끝낸 일은 done 을 쓰세요. 기록이 남아야 나중에 되짚어볼 수 있습니다.
    del 은 오타로 넣었거나 시험용으로 넣은 것을 치울 때만 씁니다.

왜 파일이 아니라 직접 붙나
    중간에 파일을 두면 "언제 받아온 것인지" 를 늘 신경 써야 합니다.
    옛날 목록을 보고 이미 끝낸 일을 또 하는 게 제일 나쁩니다.
    그래서 물어볼 때마다 그 순간의 Firestore 를 읽습니다.

⚠️ 완료 표시는 지우는 게 아닙니다
    checks 배열의 d 값을 true 로 바꿀 뿐입니다. 앱에서 다시 누르면 돌아옵니다.

데이터 모양 (2026-08-19 확인)
    users/{uid}/items/{itemId}
      type: 'project'
      title: '앱계발 목표'
      checks: [ { id:'1785815056523', t:'원당 마감정산서', d:false }, ... ]
                                       ↑ 내용            ↑ 완료 여부
"""
import base64
import json
import os
import sys
import time

import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# 대표님 계정. 제2의뇌에 계정이 여럿 있어 하나로 고정한다.
# (다른 계정은 시험용으로 만들어진 것으로 보임 — 2026-08-19 확인)
MAIN_UID = "JcUXVX2DZKYZ2A9Eq5ZeemZqxwf2"


def _service_account():
    """.env 의 FIREBASE_SERVICE_ACCOUNT(base64) 를 읽는다"""
    path = os.path.join(ROOT, ".env")
    if not os.path.exists(path):
        raise SystemExit(f"❌ {path} 가 없습니다. FIREBASE_SERVICE_ACCOUNT 를 넣어주세요.")
    for line in open(path, encoding="utf-8"):
        if line.startswith("FIREBASE_SERVICE_ACCOUNT="):
            return json.loads(base64.b64decode(line.split("=", 1)[1].strip()))
    raise SystemExit("❌ .env 안에 FIREBASE_SERVICE_ACCOUNT 가 없습니다.")


class Firestore:
    def __init__(self):
        sa = _service_account()
        creds = service_account.Credentials.from_service_account_info(
            sa, scopes=["https://www.googleapis.com/auth/datastore"])
        creds.refresh(Request())
        self.h = {"Authorization": f"Bearer {creds.token}"}
        self.base = (f"https://firestore.googleapis.com/v1/projects/"
                     f"{sa['project_id']}/databases/(default)/documents")

    def items(self, uid=MAIN_UID):
        q = {"structuredQuery": {"from": [{"collectionId": "items",
                                           "allDescendants": True}], "limit": 800}}
        r = requests.post(f"{self.base}:runQuery", headers=self.h, json=q, timeout=60)
        r.raise_for_status()
        docs = [x["document"] for x in r.json() if "document" in x]
        return [d for d in docs if d["name"].split("/")[-3] == uid]

    def patch_checks(self, doc_name, checks):
        """checks 배열만 바꿔 쓴다. 다른 필드는 건드리지 않는다."""
        url = f"https://firestore.googleapis.com/v1/{doc_name}"
        body = {"fields": {"checks": {"arrayValue": {"values": [
            {"mapValue": {"fields": {
                "id": {"stringValue": str(c["id"])},
                "t":  {"stringValue": c["t"]},
                "d":  {"booleanValue": bool(c["d"])},
            }}} for c in checks]}}}}
        r = requests.patch(url, headers=self.h, json=body, timeout=30,
                           params=[("updateMask.fieldPaths", "checks")])
        r.raise_for_status()
        return r.json()


def txt(d, k, dv=""):
    return d.get("fields", {}).get(k, {}).get("stringValue", dv)


def checks_of(d):
    out = []
    for c in d.get("fields", {}).get("checks", {}).get("arrayValue", {}).get("values", []):
        f = c.get("mapValue", {}).get("fields", {})
        out.append({
            "id": f.get("id", {}).get("stringValue", ""),
            "t":  f.get("t", {}).get("stringValue", ""),
            "d":  f.get("d", {}).get("booleanValue", False),
        })
    return out


def collect(fs, show_all=False):
    """(번호, 프로젝트문서, 체크목록, 체크인덱스, 내용) 목록을 만든다"""
    projs = [d for d in fs.items() if txt(d, "type") == "project"]
    projs.sort(key=lambda d: txt(d, "title"))
    flat, n = [], 0
    for d in projs:
        ch = checks_of(d)
        for i, c in enumerate(ch):
            if c["d"] and not show_all:
                continue
            n += 1
            flat.append((n, d, ch, i, c))
    return projs, flat


def cmd_list(show_all=False):
    fs = Firestore()
    projs, flat = collect(fs, show_all)
    if not flat:
        print("✨ 밀린 할일이 없습니다.")
        return

    본 = None
    for n, d, ch, i, c in flat:
        t = txt(d, "title")
        if t != 본:
            남은 = sum(1 for x in ch if not x["d"])
            due = txt(d, "due")
            print(f"\n▶ {t}   [{len(ch)-남은}/{len(ch)}]" + (f"   마감 {due}" if due else ""))
            본 = t
        mark = "☑" if c["d"] else "☐"
        print(f"   {n:>2}. {mark} {c['t']}")

    전체 = sum(len(checks_of(d)) for d in projs)
    완료 = sum(1 for d in projs for x in checks_of(d) if x["d"])
    print(f"\n{'─'*46}")
    print(f"프로젝트 {len(projs)}개 · 전체 {전체}건 · 완료 {완료} · 남은 것 {전체-완료}")


def cmd_mark(no, done):
    fs = Firestore()
    _, flat = collect(fs, show_all=True)
    hit = next((x for x in flat if x[0] == no), None)
    if not hit:
        raise SystemExit(f"❌ {no}번 항목이 없습니다. 먼저 list 로 번호를 확인하세요.")
    n, d, ch, i, c = hit
    if c["d"] == done:
        print(f"이미 {'완료' if done else '미완료'} 상태입니다: {c['t']}")
        return
    ch[i]["d"] = done
    fs.patch_checks(d["name"], ch)
    print(f"{'☑ 완료' if done else '☐ 되돌림'}  [{txt(d,'title')}] {c['t']}")


def cmd_add(project, text):
    fs = Firestore()
    projs = [d for d in fs.items() if txt(d, "type") == "project"]
    d = next((x for x in projs if txt(x, "title") == project), None)
    if d is None:  # 이름 일부만 적어도 찾아준다
        후보 = [x for x in projs if project in txt(x, "title")]
        if len(후보) == 1:
            d = 후보[0]
        elif len(후보) > 1:
            raise SystemExit("❌ 여러 개가 걸립니다: " + ", ".join(txt(x, "title") for x in 후보))
        else:
            raise SystemExit("❌ 그런 프로젝트가 없습니다: " + ", ".join(txt(x, "title") for x in projs))
    ch = checks_of(d)
    ch.append({"id": str(int(time.time() * 1000)), "t": text, "d": False})
    fs.patch_checks(d["name"], ch)
    print(f"➕ [{txt(d,'title')}] {text}")


def cmd_del(no):
    """항목을 아예 빼버린다. 되돌릴 수 없다 — 잘못 넣은 것 치울 때만."""
    fs = Firestore()
    _, flat = collect(fs, show_all=True)
    hit = next((x for x in flat if x[0] == no), None)
    if not hit:
        raise SystemExit(f"❌ {no}번 항목이 없습니다.")
    n, d, ch, i, c = hit
    삭제 = ch.pop(i)
    fs.patch_checks(d["name"], ch)
    print(f"🗑 삭제  [{txt(d,'title')}] {삭제['t']}")


def cmd_projects():
    fs = Firestore()
    for d in sorted([x for x in fs.items() if txt(x, "type") == "project"],
                    key=lambda x: txt(x, "title")):
        ch = checks_of(d)
        남 = sum(1 for c in ch if not c["d"])
        print(f"  {txt(d,'title'):<24} {len(ch)-남}/{len(ch)}" + (f"   마감 {txt(d,'due')}" if txt(d, "due") else ""))


if __name__ == "__main__":
    a = sys.argv[1:]
    try:
        if not a or a[0] == "list":
            cmd_list("--all" in a)
        elif a[0] == "done":
            cmd_mark(int(a[1]), True)
        elif a[0] == "undo":
            cmd_mark(int(a[1]), False)
        elif a[0] == "add":
            cmd_add(a[1], a[2])
        elif a[0] in ("del", "delete", "rm"):
            cmd_del(int(a[1]))
        elif a[0] == "projects":
            cmd_projects()
        else:
            print(__doc__)
    except IndexError:
        print(__doc__)
