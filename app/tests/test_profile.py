"""v61 (etap 1 społeczności): dane profilu publicznego i ustawienia prywatności."""
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("JWT_SECRET_KEY", "test")
os.environ["KNOWLEDGE_SEED"] = "0"

from fastapi.testclient import TestClient    # noqa: E402

import auth             # noqa: E402
import main             # noqa: E402
import models           # noqa: E402
import utils            # noqa: E402
from database import SessionLocal  # noqa: E402

HDR = {"X-ESN-Req": "1"}


def ip():
    return {"X-Forwarded-For": "10.%d.%d.%d" % tuple(uuid.uuid4().bytes[:3])}


def make_user(role="user"):
    db = SessionLocal()
    login = "pp" + uuid.uuid4().hex[:8]
    u = models.User(username=login, login=login, email=login + "@example.test", hashed_password=utils.hash_password("Haslo123!"), role=role)
    db.add(u); db.commit(); uid = u.id; db.close()
    tok = auth.create_access_token({"sub": login, "role": role, "user_id": uid})
    return login, {"Authorization": "Bearer " + tok, **HDR}


def test_defaults_private_and_hidden_from_others():
    login, me = make_user()
    _, other = make_user()
    c = TestClient(main.app)
    s = c.get("/api/users/me/public-profile", headers=me).json()
    assert s["profile_public"] is False and s["allow_invites"] is True and s["show_activity"] is True and s["show_courses"] is False
    # anonim i inny użytkownik: 404 – identyczny jak dla nieistniejącego konta
    r1 = c.get("/api/u/" + login, headers=ip())
    r2 = c.get("/api/u/" + login, headers={**other, **ip()})
    r3 = c.get("/api/u/nieistnieje" + uuid.uuid4().hex[:6], headers=ip())
    assert r1.status_code == r2.status_code == r3.status_code == 404
    assert r1.json() == r3.json() == {"detail": "Profil nie istnieje lub nie jest publiczny"}
    # właściciel widzi podgląd
    r = c.get("/api/u/" + login.upper(), headers={**me, **ip()})
    assert r.status_code == 200 and r.json()["preview"] is True and r.json()["is_me"] is True


def test_admin_preview_of_private_profile():
    login, _ = make_user()
    _, adm = make_user("admin")
    r = TestClient(main.app).get("/api/u/" + login, headers={**adm, **ip()})
    assert r.status_code == 200 and r.json()["preview"] is True and r.json()["is_me"] is False


def test_save_validate_and_public_view_without_email():
    login, me = make_user()
    c = TestClient(main.app)
    body = {"bio": "  Elektronika\x07 medyczna  " + "x" * 400, "location": "Wrocław", "skills": "STM32, kicad, KiCad, <script>, FreeRTOS",
            "links": [{"label": "GitHub", "url": "https://github.com/test"}, {"label": "", "url": ""}], "profile_public": True, "show_courses": 1}
    r = c.put("/api/users/me/public-profile", headers=me, json=body)
    assert r.status_code == 200, r.text
    s = r.json()
    assert len(s["bio"]) == 300 and "\x07" not in s["bio"] and s["bio"].startswith("Elektronika medyczna")
    assert s["skills"] == ["STM32", "kicad", "FreeRTOS"]                      # duplikat bez względu na wielkość liter i znaczniki odrzucone
    assert s["links"] == [{"label": "GitHub", "url": "https://github.com/test"}]
    assert s["profile_public"] is True and s["show_courses"] is True
    # profil publiczny widzi anonim – bez e-maila i bez pól wewnętrznych
    p = c.get("/api/u/" + login, headers=ip())
    assert p.status_code == 200
    j = p.json()
    assert j["preview"] is False and j["is_me"] is False and j["location"] == "Wrocław" and j["stats"]["projects"] == 0
    flat = repr(j)
    assert "@example.test" not in flat and "email" not in j and "hashed_password" not in flat
    # wyłączenie widoczności znowu ukrywa
    c.put("/api/users/me/public-profile", headers=me, json={"profile_public": False})
    assert c.get("/api/u/" + login, headers=ip()).status_code == 404


def test_bad_links_rejected_and_limits():
    _, me = make_user()
    c = TestClient(main.app)
    for bad in ("javascript:alert(1)", "ftp://x.pl", "https://a b.pl"):
        r = c.put("/api/users/me/public-profile", headers=me, json={"links": [{"label": "x", "url": bad}]})
        assert r.status_code == 400 and r.json()["detail"] == "Adres musi zaczynać się od http:// lub https://"
    many = [{"label": str(i), "url": "https://e%d.pl" % i} for i in range(9)]
    s = c.put("/api/users/me/public-profile", headers=me, json={"links": many, "skills": ["s%d" % i for i in range(20)]}).json()
    assert len(s["links"]) == 4 and len(s["skills"]) == 8
    assert c.put("/api/users/me/public-profile", headers=me, json=[1, 2]).status_code == 400


def test_requires_login_and_csrf():
    _, me = make_user()
    c = TestClient(main.app)
    assert c.get("/api/users/me/public-profile").status_code in (401, 403)
    no_csrf = {k: v for k, v in me.items() if k != "X-ESN-Req"}
    assert c.put("/api/users/me/public-profile", headers=no_csrf, json={"bio": "x"}).status_code == 200   # Bearer: CSRF nie dotyczy
    assert c.get("/api/u/x", headers=ip()).headers.get("cache-control") == "no-store"


def test_delete_avatar_sets_initials_mode():
    login, me = make_user()
    db = SessionLocal(); u = db.query(models.User).filter(models.User.login == login).first(); u.avatar_path = "avatars/nie-ma-takiego.png"; db.commit(); db.close()
    c = TestClient(main.app)
    r = c.delete("/api/users/me/avatar", headers=me)
    assert r.status_code == 200 and r.json() == {"avatar_path": None}
    assert c.get("/api/users/me", headers=me).json().get("avatar_path") is None


def test_people_search_only_public_with_filters_and_sort():
    tag = "Sk" + uuid.uuid4().hex[:6]
    la, a = make_user(); lb, b = make_user(); lc, c_ = make_user()
    c = TestClient(main.app)
    c.put("/api/users/me/public-profile", headers=a, json={"profile_public": True, "skills": [tag, "KiCad"], "bio": "zasilanie bateryjne", "allow_invites": False})
    c.put("/api/users/me/public-profile", headers=b, json={"profile_public": True, "skills": [tag.lower()]})
    c.put("/api/users/me/public-profile", headers=c_, json={"profile_public": False, "skills": [tag]})      # prywatny – nie może się pojawić
    r = c.get("/api/people", params={"skills": tag}, headers=ip()).json()
    logins = [x["login"] for x in r["items"]]
    assert set(logins) == {la, lb} and lc not in logins
    assert any(f["name"].lower() == tag.lower() and f["count"] >= 2 for f in r["skills"])
    assert all("email" not in x and "_last" not in x for x in r["items"])
    assert [x["login"] for x in c.get("/api/people", params={"skills": tag, "invites": 1}, headers=ip()).json()["items"]] == [lb]
    assert [x["login"] for x in c.get("/api/people", params={"skills": tag, "q": "BATERYJNE"}, headers=ip()).json()["items"]] == [la]
    az = [x["login"] for x in c.get("/api/people", params={"skills": tag, "sort": "az"}, headers=ip()).json()["items"]]
    za = [x["login"] for x in c.get("/api/people", params={"skills": tag, "sort": "za"}, headers=ip()).json()["items"]]
    assert az == sorted(az) and za == list(reversed(az))
    assert c.get("/api/people", params={"sort": "zle", "page": 0}, headers=ip()).json()["sort"] == "active"
