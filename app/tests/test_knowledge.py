"""Testy modułu Wiedza (uprawnienia, przepływ zatwierdzania, walidacja, kursy).

Uruchomienie (z katalogu app/, potrzebna działająca baza PostgreSQL z DATABASE_URL):
    pip install pytest httpx
    python -m pytest tests/test_knowledge.py -q
Testy tworzą własnych użytkowników i treści z prefiksem „t-wiedza” i sprzątają po sobie.
"""
import os
import sys
import uuid

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("JWT_SECRET_KEY", "test")
os.environ["KNOWLEDGE_SEED"] = "0"          # testy nie potrzebują przykładowych treści

from fastapi.testclient import TestClient    # noqa: E402

import auth        # noqa: E402
import main        # noqa: E402
import models      # noqa: E402
from database import SessionLocal  # noqa: E402

client = TestClient(main.app)
TAG = "t-wiedza-" + uuid.uuid4().hex[:6]
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
    d = {"admin": make_user("admin"), "mod": make_user("moderator"), "mod2": make_user("moderator"), "user": make_user("user")}
    yield d
    db = SessionLocal()
    db.query(models.KnowledgeArticle).filter(models.KnowledgeArticle.slug.like("%" + TAG.replace("t-wiedza-", "") + "%") |
                                             models.KnowledgeArticle.author_id.in_([u["id"] for u in d.values()])).delete(synchronize_session=False)
    db.query(models.KnowledgeCourse).filter(models.KnowledgeCourse.title.like(TAG + "%")).delete(synchronize_session=False)
    db.query(models.User).filter(models.User.id.in_([u["id"] for u in d.values()])).delete(synchronize_session=False)
    db.commit()
    db.close()


def art(title=None, **kw):
    d = {"kind": "article", "title": title or (TAG + " tytuł"), "summary": "opis", "body": BODY, "level": "basic", "tags": [], "widgets": {}}
    d.update(kw)
    return d


def create(u, **kw):
    r = client.post("/api/knowledge/editor/items", json=art(**kw), headers=u["h"])
    assert r.status_code == 200, r.text
    return r.json()


def public_slugs():
    return {i["slug"] for i in client.get("/api/knowledge/items").json()}


# ── uprawnienia ───────────────────────────────────────────────────────────────
def test_editor_endpoints_require_auth_and_role(users):
    assert client.get("/api/knowledge/editor/items").status_code in (401, 403)
    assert client.get("/api/knowledge/editor/items", headers=users["user"]["h"]).status_code == 403
    assert client.post("/api/knowledge/editor/items", json=art(), headers=users["user"]["h"]).status_code == 403
    assert client.get("/api/knowledge/editor/queue", headers=users["mod"]["h"]).status_code == 403
    assert client.post("/api/knowledge/editor/courses", json={"title": "x"}, headers=users["mod"]["h"]).status_code == 403


def test_public_endpoints_open_and_hide_drafts(users):
    a = create(users["mod"])
    assert a["status"] == "Szkic" and not a["published"]
    assert client.get("/api/knowledge/items/" + a["slug"]).status_code == 404
    assert a["slug"] not in public_slugs()


def test_moderator_sees_and_edits_only_own(users):
    a = create(users["mod"], title=TAG + " własny")
    ids_mod = {r["id"] for r in client.get("/api/knowledge/editor/items", headers=users["mod"]["h"]).json()}
    ids_mod2 = {r["id"] for r in client.get("/api/knowledge/editor/items", headers=users["mod2"]["h"]).json()}
    ids_admin = {r["id"] for r in client.get("/api/knowledge/editor/items", headers=users["admin"]["h"]).json()}
    assert a["id"] in ids_mod and a["id"] not in ids_mod2 and a["id"] in ids_admin
    assert client.get(f"/api/knowledge/editor/items/{a['id']}", headers=users["mod2"]["h"]).status_code == 403
    assert client.put(f"/api/knowledge/editor/items/{a['id']}", json=art(), headers=users["mod2"]["h"]).status_code == 403
    assert client.delete(f"/api/knowledge/editor/items/{a['id']}", headers=users["mod2"]["h"]).status_code == 403


def test_moderator_cannot_publish_or_approve(users):
    a = create(users["mod"])
    h = users["mod"]["h"]
    for act in ("approve", "publish", "unpublish"):
        assert client.post(f"/api/knowledge/editor/items/{a['id']}/{act}", json={}, headers=h).status_code == 403, act
    assert client.post(f"/api/knowledge/editor/items/{a['id']}/reject", json={"note": "x"}, headers=h).status_code == 403


# ── przepływ ──────────────────────────────────────────────────────────────────
def test_full_review_flow(users):
    mod, adm = users["mod"]["h"], users["admin"]["h"]
    a = create(users["mod"], title=TAG + " przepływ")
    i = a["id"]
    # pusta treść nie przejdzie do przeglądu
    client.put(f"/api/knowledge/editor/items/{i}", json=art(title=TAG + " przepływ", body="x"), headers=mod)
    assert client.post(f"/api/knowledge/editor/items/{i}/submit", headers=mod).status_code == 400
    client.put(f"/api/knowledge/editor/items/{i}", json=art(title=TAG + " przepływ"), headers=mod)
    r = client.post(f"/api/knowledge/editor/items/{i}/submit", headers=mod)
    assert r.status_code == 200 and r.json()["state"] == "review"
    # w trakcie przeglądu redaktor nie edytuje
    assert client.put(f"/api/knowledge/editor/items/{i}", json=art(), headers=mod).status_code == 409
    assert a["slug"] not in public_slugs()
    # odrzucenie wymaga powodu
    assert client.post(f"/api/knowledge/editor/items/{i}/reject", json={"note": " "}, headers=adm).status_code == 400
    r = client.post(f"/api/knowledge/editor/items/{i}/reject", json={"note": "Popraw wstęp"}, headers=adm)
    assert r.json()["state"] == "rejected" and r.json()["review_note"] == "Popraw wstęp"
    # redaktor poprawia i ponownie wysyła
    client.put(f"/api/knowledge/editor/items/{i}", json=art(title=TAG + " przepływ", body=BODY + " Poprawione."), headers=mod)
    assert client.post(f"/api/knowledge/editor/items/{i}/submit", headers=mod).json()["state"] == "review"
    assert a["slug"] in {x["slug"] for x in client.get("/api/knowledge/editor/queue", headers=adm).json()}
    r = client.post(f"/api/knowledge/editor/items/{i}/approve", json={}, headers=adm)
    assert r.status_code == 200 and r.json()["published"] and r.json()["state"] == "none"
    pub = client.get("/api/knowledge/items/" + a["slug"]).json()
    assert "Poprawione." in pub["body"] and pub["reading_min"] >= 1
    # edycja opublikowanej treści: czytelnicy nadal widzą starą wersję
    client.put(f"/api/knowledge/editor/items/{i}", json=art(title=TAG + " przepływ", body=BODY + " NOWA WERSJA"), headers=mod)
    assert "NOWA WERSJA" not in client.get("/api/knowledge/items/" + a["slug"]).json()["body"]
    ed = client.get(f"/api/knowledge/editor/items/{i}", headers=mod).json()
    assert ed["has_pending"] and "NOWA WERSJA" in ed["content"]["body"] and ed["status"].startswith("Opublikowane")
    client.post(f"/api/knowledge/editor/items/{i}/submit", headers=mod)
    client.post(f"/api/knowledge/editor/items/{i}/approve", json={}, headers=adm)
    assert "NOWA WERSJA" in client.get("/api/knowledge/items/" + a["slug"]).json()["body"]
    # porzucenie zmian
    client.put(f"/api/knowledge/editor/items/{i}", json=art(title=TAG + " przepływ", body=BODY + " ODRZUCONE"), headers=mod)
    assert client.post(f"/api/knowledge/editor/items/{i}/discard", headers=mod).json()["state"] == "none"
    assert "ODRZUCONE" not in client.get(f"/api/knowledge/editor/items/{i}", headers=mod).json()["content"]["body"]
    # redaktor nie usuwa opublikowanej treści, admin tak
    assert client.delete(f"/api/knowledge/editor/items/{i}", headers=mod).status_code == 403
    # wycofanie
    assert client.post(f"/api/knowledge/editor/items/{i}/unpublish", headers=adm).json()["published"] is False
    assert client.get("/api/knowledge/items/" + a["slug"]).status_code == 404
    hist = client.get(f"/api/knowledge/editor/items/{i}", headers=adm).json()["history"]
    assert {h["action"] for h in hist} >= {"create", "submit", "reject", "approve", "unpublish", "discard"}
    assert client.delete(f"/api/knowledge/editor/items/{i}", headers=adm).status_code == 200


def test_admin_direct_publish_and_unpublished_delete_by_author(users):
    adm = users["admin"]["h"]
    a = create(users["admin"], title=TAG + " bezposrednio")
    r = client.post(f"/api/knowledge/editor/items/{a['id']}/publish", json={"content": art(title=TAG + " bezposrednio", body=BODY + " zmiana")}, headers=adm)
    assert r.status_code == 200 and r.json()["published"]
    assert "zmiana" in client.get("/api/knowledge/items/" + a["slug"]).json()["body"]
    b = create(users["mod"], title=TAG + " do usuniecia")
    assert client.delete(f"/api/knowledge/editor/items/{b['id']}", headers=users["mod"]["h"]).status_code == 200


def test_admin_can_save_while_in_review_without_losing_state(users):
    a = create(users["mod"], title=TAG + " adminedit")
    client.post(f"/api/knowledge/editor/items/{a['id']}/submit", headers=users["mod"]["h"])
    r = client.put(f"/api/knowledge/editor/items/{a['id']}", json=art(title=TAG + " adminedit", body=BODY + " drobna poprawka admina"), headers=users["admin"]["h"])
    assert r.status_code == 200 and r.json()["state"] == "review"


# ── walidacja ─────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("patch,expect", [
    ({"kind": "foo"}, 400), ({"level": "pro"}, 400), ({"title": "  "}, 400), ({"title": "x" * 151}, 400),
    ({"body": "x" * 200_001}, 400), ({"tags": ["t%d" % i for i in range(9)]}, 400), ({"tags": ["x" * 31]}, 400),
    ({"kind": "lesson"}, 400), ({"kind": "lesson", "course_id": 99999999}, 400),
    ({"widgets": {"Zła Nazwa": "<p>x</p>"}}, 400), ({"widgets": {"../x": "<p>x</p>"}}, 400),
    ({"widgets": {"ok": "x" * 60_001}}, 400), ({"widgets": {"w%d" % i: "<p>x</p>" for i in range(9)}}, 400),
])
def test_validation(users, patch, expect):
    r = client.post("/api/knowledge/editor/items", json=art(**patch), headers=users["mod"]["h"])
    assert r.status_code == expect, r.text


def test_tags_normalized_and_course_forced_none_for_non_lesson(users):
    a = create(users["mod"], tags=[" UART ", "uart", "SPI  Bus"], course_id=123)
    d = client.get(f"/api/knowledge/editor/items/{a['id']}", headers=users["mod"]["h"]).json()
    assert d["content"]["tags"] == ["uart", "spi bus"] and d["content"]["course_id"] is None


def test_submit_rejects_missing_widget_reference(users):
    a = create(users["mod"], body=BODY + "\n\n:::widget brak-widgetu 300\n:::\n")
    assert client.post(f"/api/knowledge/editor/items/{a['id']}/submit", headers=users["mod"]["h"]).status_code == 400
    b = create(users["mod"], body=BODY + "\n\n:::widget jest 300\n:::\n", widgets={"jest": "<p>ok</p>"})
    assert client.post(f"/api/knowledge/editor/items/{b['id']}/submit", headers=users["mod"]["h"]).status_code == 200


def test_slugs_are_unique_and_ascii(users):
    a = create(users["mod"], title="Zażółć gęślą jaźń " + TAG)
    b = create(users["mod"], title="Zażółć gęślą jaźń " + TAG)
    assert a["slug"] != b["slug"] and a["slug"].isascii() and a["slug"].startswith("zazolc-gesla-jazn")


# ── kursy ─────────────────────────────────────────────────────────────────────
def test_courses_and_lessons(users):
    adm, mod = users["admin"]["h"], users["mod"]["h"]
    r = client.post("/api/knowledge/editor/courses", json={"title": TAG + " kurs", "summary": "s", "level": "basic", "position": 1, "published": False}, headers=adm)
    assert r.status_code == 200
    cid, cslug = r.json()["id"], r.json()["slug"]
    assert client.post("/api/knowledge/editor/courses", json={"title": "", "level": "basic"}, headers=adm).status_code == 400
    assert client.post("/api/knowledge/editor/courses", json={"title": "x", "level": "zly"}, headers=adm).status_code == 400
    assert cslug not in {c["slug"] for c in client.get("/api/knowledge/courses").json()}
    # redaktor widzi listę kursów (do wyboru), ale nie edytuje
    assert cid in {c["id"] for c in client.get("/api/knowledge/editor/courses", headers=mod).json()}
    l1 = create(users["mod"], kind="lesson", course_id=cid, position=2, title=TAG + " L2")
    l2 = create(users["mod"], kind="lesson", course_id=cid, position=1, title=TAG + " L1")
    for l in (l1, l2):
        client.post(f"/api/knowledge/editor/items/{l['id']}/submit", headers=mod)
        client.post(f"/api/knowledge/editor/items/{l['id']}/approve", json={}, headers=adm)
    # kurs ukryty → lekcje niedostępne publicznie
    assert client.get("/api/knowledge/items/" + l1["slug"]).status_code == 404
    assert client.get("/api/knowledge/courses/" + cslug).status_code == 404
    client.put(f"/api/knowledge/editor/courses/{cid}", json={"title": TAG + " kurs", "summary": "s", "level": "basic", "position": 1, "published": True}, headers=adm)
    c = client.get("/api/knowledge/courses/" + cslug).json()
    assert [i["slug"] for i in c["items"]] == [l2["slug"], l1["slug"]] and c["lessons"] == 2
    d = client.get("/api/knowledge/items/" + l2["slug"]).json()
    assert d["prev"] is None and d["next"]["slug"] == l1["slug"] and d["lesson_no"] == 1 and d["lesson_total"] == 2
    # lekcje nie są na ogólnej liście bez wyszukiwania
    assert l1["slug"] not in public_slugs()
    assert l1["slug"] in {i["slug"] for i in client.get("/api/knowledge/items?q=" + TAG).json()}
    # usunięcie kursu z lekcjami zablokowane
    assert client.delete(f"/api/knowledge/editor/courses/{cid}", headers=adm).status_code == 400
    for l in (l1, l2):
        client.delete(f"/api/knowledge/editor/items/{l['id']}", headers=adm)
    assert client.delete(f"/api/knowledge/editor/courses/{cid}", headers=adm).status_code == 200


def test_list_filters_and_sorting(users):
    adm = users["admin"]["h"]
    ids = []
    for lvl, kind in (("advanced", "article"), ("basic", "essential"), ("intermediate", "guide")):
        a = create(users["admin"], title=f"{TAG} sort {lvl}", level=lvl, kind=kind)
        client.post(f"/api/knowledge/editor/items/{a['id']}/publish", json={}, headers=adm)
        ids.append(a["slug"])
    mine = [i for i in client.get("/api/knowledge/items?q=" + TAG + " sort").json()]
    assert [i["level"] for i in mine] == ["basic", "intermediate", "advanced"]
    assert [i["slug"] for i in client.get("/api/knowledge/items?level=basic&q=" + TAG + " sort").json()] == [ids[1]]
    assert [i["slug"] for i in client.get("/api/knowledge/items?kind=guide&q=" + TAG + " sort").json()] == [ids[2]]


def test_search_is_safe_against_wildcards(users):
    r = client.get("/api/knowledge/items?q=%25%27%3B--")
    assert r.status_code == 200 and isinstance(r.json(), list)


# ───────────────────────── v7: obrazy w treściach ─────────────────────────
def _png_bytes():
    import struct
    import zlib
    w = h = 8
    raw = b"".join(b"\x00" + bytes([40, 120, 200]) * w for _ in range(h))

    def ch(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw)) + ch(b"IEND", b"")


def _upload(aid, who):
    return client.post("/api/media", headers=who["h"], data={"owner_type": "article", "owner_id": str(aid), "role": "gallery", "caption": "t"},
                       files={"file": ("a.png", _png_bytes(), "image/png")})


def test_article_images_permissions_and_cleanup(users):
    aid = client.post("/api/knowledge/editor/items", headers=users["mod"]["h"], json=art(TAG + " obrazy")).json()["id"]
    assert _upload(aid, users["user"]).status_code in (401, 403)
    assert _upload(aid, users["mod2"]).status_code == 403            # inny redaktor – nie
    r = _upload(aid, users["mod"])                                   # autor-redaktor – tak
    assert r.status_code == 201, r.text
    assert _upload(aid, users["admin"]).status_code == 201           # admin – tak
    listed = client.get(f"/api/media?owner_type=article&owner_id={aid}").json()
    assert len(listed) == 2 and all(i["url"].startswith("/static/media/") for i in listed)
    paths = [os.path.join(main.media_service.STATIC_ROOT, i["path"]) for i in listed]
    assert all(os.path.exists(p) for p in paths)
    assert client.delete(f"/api/knowledge/editor/items/{aid}", headers=users["mod"]["h"]).status_code in (200, 204)
    assert client.get(f"/api/media?owner_type=article&owner_id={aid}").json() == []
    assert not any(os.path.exists(p) for p in paths)                 # pliki usunięte razem z treścią


def test_article_media_nonexistent_owner(users):
    assert _upload(99999999, users["admin"]).status_code == 404


# ───────────────────────── v7: aktualizacja próbek ─────────────────────────
def test_upgrade_pilot_only_untouched_rows(monkeypatch):
    import knowledge_pilot
    import knowledge_service as ks
    slug = "t-upg-" + uuid.uuid4().hex[:6]
    fake = {"slug": slug, "kind": "article", "title": "Nowy", "summary": "s", "body": BODY + " nowa wersja", "level": "basic", "tags": ["a"], "widgets": {}}
    old = ("Stary", "s", BODY, {})
    monkeypatch.setattr(knowledge_pilot, "ARTICLES", [fake])
    monkeypatch.setattr(knowledge_pilot, "OLD_HASHES", {slug: [ks.content_hash(*old)]})
    db = SessionLocal()
    try:
        row = models.KnowledgeArticle(slug=slug, kind="article", title=old[0], summary=old[1], body=old[2], level="basic", tags=[], widgets={}, published=True, author_id=None)
        db.add(row)
        db.commit()
        assert "zaktualizowano 1" in ks.upgrade_pilot(db)
        db.refresh(row)
        assert row.title == "Nowy" and row.body.endswith("nowa wersja")
        # ręcznie edytowany wiersz zostaje nietknięty
        row.body = "zmieniona przez człowieka " + BODY
        db.commit()
        monkeypatch.setattr(knowledge_pilot, "OLD_HASHES", {slug: [ks.content_hash(*old)]})
        assert "zaktualizowano 0" in ks.upgrade_pilot(db)
        db.refresh(row)
        assert row.body.startswith("zmieniona przez człowieka")
    finally:
        db.query(models.KnowledgeArticle).filter(models.KnowledgeArticle.slug == slug).delete()
        db.commit()
        db.close()


# ───────────────────────── v8: archiwum tylko dla admina, import partii ─────────────────────────
def test_archive_admin_only(users):
    assert client.get("/api/archiwum").status_code in (401, 403)
    assert client.get("/api/archiwum", headers=users["user"]["h"]).status_code == 403
    assert client.get("/api/archiwum", headers=users["mod"]["h"]).status_code == 403
    r = client.get("/api/archiwum", headers=users["admin"]["h"])
    assert r.status_code == 200 and "Mikrokontroler (MCU)" in r.text
    assert "Mikrokontroler (MCU) vs Mikroprocesor" not in client.get("/").text      # nie ma w publicznym HTML


def test_import_batch_once_as_review(monkeypatch):
    import sys
    import types
    import knowledge_service as ks
    slug, cslug, bid = "t-imp-" + uuid.uuid4().hex[:6], "t-imp-k-" + uuid.uuid4().hex[:6], "t-batch-" + uuid.uuid4().hex[:6]
    mod = types.ModuleType("t_fake_batch")
    mod.COURSES = [{"slug": cslug, "title": TAG + " kurs", "level": "basic", "position": 0, "summary": "s"}]
    mod.ARTICLES = [{"slug": slug, "kind": "lesson", "course": cslug, "position": 1, "level": "basic", "title": TAG + " import", "summary": "s", "body": BODY, "tags": [], "widgets": {}}]
    sys.modules["t_fake_batch"] = mod
    monkeypatch.setattr(ks, "BATCHES", [(bid, "t_fake_batch")])
    monkeypatch.setenv("KNOWLEDGE_SEED", "1")
    db = SessionLocal()
    try:
        assert "dodano 1" in ks.import_batches(SessionLocal)
        row = db.query(models.KnowledgeArticle).filter(models.KnowledgeArticle.slug == slug).first()
        assert row and row.published is False and row.draft_state == "review"
        db.delete(row)                                           # usunięcie nie powoduje ponownego importu
        db.commit()
        assert ks.import_batches(SessionLocal) == "brak nowych partii"
        assert db.query(models.KnowledgeArticle).filter(models.KnowledgeArticle.slug == slug).first() is None
    finally:
        db.query(models.KnowledgeCourse).filter(models.KnowledgeCourse.slug == cslug).delete()
        db.query(models.KnowledgeImport).filter(models.KnowledgeImport.batch_id == bid).delete()
        db.commit()
        db.close()
