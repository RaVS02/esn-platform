"""Wersje językowe w Wiedzy: pole lang, grupy tłumaczeń, filtr języka (scope), tłumaczenie lekcji i kursów."""
import os
import sys
import uuid

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("JWT_SECRET_KEY", "test")
os.environ["KNOWLEDGE_SEED"] = "0"

from fastapi.testclient import TestClient    # noqa: E402

import auth        # noqa: E402
import main        # noqa: E402
import models      # noqa: E402
from database import SessionLocal  # noqa: E402

client = TestClient(main.app)
TAG = "t-lang-" + uuid.uuid4().hex[:6]
BODY = "To jest wystarczająco długa treść testowa, aby przejść walidację przed wysłaniem."


def make_user(role):
    db = SessionLocal()
    login = f"{TAG}-{role}-{uuid.uuid4().hex[:4]}"
    u = models.User(username=login, login=login, email=login + "@example.test", hashed_password="x", role=role)
    db.add(u)
    db.commit()
    db.refresh(u)
    uid = u.id
    db.close()
    tok = auth.create_access_token(data={"sub": login, "role": role, "user_id": uid})
    return {"id": uid, "h": {"Authorization": "Bearer " + tok}}


@pytest.fixture(scope="module")
def users():
    d = {"admin": make_user("admin"), "mod": make_user("moderator")}
    yield d
    db = SessionLocal()
    db.query(models.KnowledgeArticle).filter(models.KnowledgeArticle.title.like(TAG + "%")).delete(synchronize_session=False)
    db.query(models.KnowledgeCourse).filter(models.KnowledgeCourse.title.like(TAG + "%")).delete(synchronize_session=False)
    db.query(models.User).filter(models.User.id.in_([u["id"] for u in d.values()])).delete(synchronize_session=False)
    db.commit()
    db.close()


def art(title, **kw):
    d = {"kind": "article", "title": TAG + " " + title, "summary": "opis", "body": BODY, "level": "basic", "tags": [], "widgets": {}}
    d.update(kw)
    return d


def create_published(users, title, **kw):
    r = client.post("/api/knowledge/editor/items", json=art(title, **kw), headers=users["admin"]["h"])
    assert r.status_code == 200, r.text
    row = r.json()
    r = client.post(f"/api/knowledge/editor/items/{row['id']}/publish", json={}, headers=users["admin"]["h"])
    assert r.status_code == 200, r.text
    return r.json()


def translate(users, aid, lang, who="mod"):
    return client.post(f"/api/knowledge/editor/items/{aid}/translate", json={"lang": lang}, headers=users[who]["h"])


def test_default_lang_and_validation(users):
    row = create_published(users, "domyślny")
    assert row["lang"] == "pl"
    assert row["missing_langs"] == ["en"]
    r = client.post("/api/knowledge/editor/items", json=art("zły", lang="xx"), headers=users["admin"]["h"])
    assert r.status_code == 400


def test_translate_creates_linked_draft_and_blocks_duplicates(users):
    src = create_published(users, "oryginał")
    r = translate(users, src["id"], "en")
    assert r.status_code == 200, r.text
    en = r.json()
    assert en["lang"] == "en" and en["state"] == "draft" and not en["published"]
    assert [v["id"] for v in en["versions"]] == [src["id"]]
    assert translate(users, src["id"], "en").status_code == 409          # wersja EN już jest
    assert translate(users, en["id"], "pl").status_code == 409           # PL (oryginał) już jest
    assert translate(users, src["id"], "xx").status_code == 400
    # zmiana języka na zajęty też jest blokowana
    r = client.put(f"/api/knowledge/editor/items/{en['id']}", json=art("oryginał", lang="pl"), headers=users["admin"]["h"])
    assert r.status_code == 409


def test_scope_filtering(users):
    both_pl = create_published(users, "para")
    solo_pl = create_published(users, "tylkopl")
    en = translate(users, both_pl["id"], "en").json()
    client.put(f"/api/knowledge/editor/items/{en['id']}", json={**art("pair"), "lang": "en"}, headers=users["admin"]["h"])
    assert client.post(f"/api/knowledge/editor/items/{en['id']}/publish", json={}, headers=users["admin"]["h"]).status_code == 200

    def titles(**p):
        r = client.get("/api/knowledge/items", params={"q": TAG, **p})
        assert r.status_code == 200
        return {i["title"]: i for i in r.json()}

    t_all = titles(scope="all")
    assert TAG + " para" in t_all and TAG + " pair" in t_all and TAG + " tylkopl" in t_all
    t_auto = titles(lang="en", scope="auto")
    assert TAG + " pair" in t_auto and TAG + " para" not in t_auto          # jedna wersja z pary
    assert TAG + " tylkopl" in t_auto and t_auto[TAG + " tylkopl"]["lang"] == "pl"   # brak tłumaczenia → oryginał
    t_only = titles(lang="en", scope="only")
    assert TAG + " pair" in t_only and TAG + " tylkopl" not in t_only
    t_pl = titles(lang="pl", scope="auto")
    assert TAG + " para" in t_pl and TAG + " pair" not in t_pl
    assert [x["lang"] for x in t_pl[TAG + " para"]["translations"]] == ["en"]
    d = client.get("/api/knowledge/items/" + t_auto[TAG + " pair"]["slug"]).json()
    assert d["lang"] == "en" and d["translations"][0]["lang"] == "pl"
    assert solo_pl["lang"] == "pl"


def test_lesson_translation_needs_translated_course(users):
    h = users["admin"]["h"]
    course = client.post("/api/knowledge/editor/courses", json={"title": TAG + " kurs", "summary": "k", "level": "basic", "published": True}, headers=h).json()
    lesson = create_published(users, "lekcja", kind="lesson", course_id=course["id"])
    r = translate(users, lesson["id"], "en", "admin")
    assert r.status_code == 400                                           # kurs nie ma wersji EN
    c_en = client.post(f"/api/knowledge/editor/courses/{course['id']}/translate", json={"lang": "en"}, headers=h)
    assert c_en.status_code == 200 and c_en.json()["lang"] == "en" and c_en.json()["published"] is False
    assert client.post(f"/api/knowledge/editor/courses/{course['id']}/translate", json={"lang": "en"}, headers=h).status_code == 409
    r = translate(users, lesson["id"], "en", "admin")
    assert r.status_code == 200 and r.json()["course_id"] == c_en.json()["id"]
    courses = client.get("/api/knowledge/editor/courses", headers=h).json()
    pl_row = next(c for c in courses if c["id"] == course["id"])
    assert pl_row["missing_langs"] == [] and pl_row["versions"][0]["lang"] == "en"


def test_projects_lang(users):
    """Projekty: lang (domyślnie pl), walidacja, filtr ?lang=, stary klient nie zmienia języka."""
    h = users["mod"]["h"]
    base = {"title": TAG + " proj", "short_desc": "opis", "tags": "t"}
    r = client.post("/api/projects", json=base, headers=h)
    assert r.status_code == 200 and r.json()["lang"] == "pl"
    pid = r.json()["id"]
    r = client.post("/api/projects", json={**base, "title": TAG + " proj en", "lang": "en"}, headers=h)
    assert r.status_code == 200 and r.json()["lang"] == "en"
    eid = r.json()["id"]
    assert client.post("/api/projects", json={**base, "lang": "xx"}, headers=h).status_code == 400
    titles = lambda q: [p["title"] for p in client.get("/api/projects?limit=500&search=" + TAG + q).json()]
    assert len(titles("")) == 2
    assert titles("&lang=en") == [TAG + " proj en"]
    assert titles("&lang=pl") == [TAG + " proj"]
    # stary klient (bez pola lang) nie zmienia języka
    r = client.put(f"/api/projects/{eid}", json={"title": TAG + " proj en", "short_desc": "nowy", "tags": "t"}, headers=h)
    assert r.status_code == 200
    assert titles("&lang=en") == [TAG + " proj en"]
    r = client.put(f"/api/projects/{eid}", json={**base, "title": TAG + " proj en", "lang": "pl"}, headers=h)
    assert r.status_code == 200 and len(titles("&lang=pl")) == 2
    db = SessionLocal()
    db.query(models.Project).filter(models.Project.id.in_([pid, eid])).delete(synchronize_session=False)
    db.commit()
    db.close()
