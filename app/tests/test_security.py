"""v60 (etap 0 społeczności): logowanie bez wyliczania kont, limity prób w bazie, sesja w ciasteczku HttpOnly + CSRF, nagłówki."""
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("JWT_SECRET_KEY", "test")
os.environ["KNOWLEDGE_SEED"] = "0"

from fastapi.testclient import TestClient    # noqa: E402

import main             # noqa: E402
import models           # noqa: E402
import utils            # noqa: E402
from database import SessionLocal  # noqa: E402


def ip():
    return {"X-Forwarded-For": "10.%d.%d.%d" % tuple(uuid.uuid4().bytes[:3])}


def make_user():
    db = SessionLocal()
    login = "sec" + uuid.uuid4().hex[:8]
    u = models.User(username=login, login=login, email=login + "@example.test", hashed_password=utils.hash_password("Haslo123!"), role="user")
    db.add(u); db.commit(); uid = u.id; db.close()
    return login, uid


def test_login_does_not_reveal_whether_account_exists():
    login, _ = make_user()
    c = TestClient(main.app)
    h = ip()
    r1 = c.post("/api/login", headers=h, json={"login": "nieistnieje-" + uuid.uuid4().hex[:6], "password": "x", "username": "x", "email": "x@x.pl"})
    r2 = c.post("/api/login", headers=h, json={"login": login, "password": "zle-haslo", "username": "x", "email": "x@x.pl"})
    assert r1.status_code == r2.status_code == 401
    assert r1.json()["detail"] == r2.json()["detail"] == "Błędny login lub hasło"


def test_session_cookie_httponly_and_csrf_header_required():
    login, uid = make_user()
    c = TestClient(main.app)
    r = c.post("/api/login", headers=ip(), json={"login": login, "password": "Haslo123!", "username": "x", "email": "x@x.pl"})
    assert r.status_code == 200, r.text
    sc = r.headers.get("set-cookie", "").lower()
    assert "esn_access_token=" in sc and "httponly" in sc and "samesite=lax" in sc and "max-age=" in sc
    assert "secure" not in sc                                     # testy: http → bez Secure (auto)
    # odczyt przez ciasteczko bez nagłówka – OK; zapis bez nagłówka – 403; z nagłówkiem – OK
    assert c.get("/api/users/me").json()["login"] == login
    nowa = "Nowa " + uuid.uuid4().hex[:6]
    r = c.put("/api/users/me/profile", json={"username": nowa})
    assert r.status_code == 403 and r.json()["detail"] == "Brak nagłówka zabezpieczającego żądanie"
    r = c.put("/api/users/me/profile", headers={"X-ESN-Req": "1"}, json={"username": nowa})
    assert r.status_code == 200, r.text
    # nieprawidłowy Bearer (pseudo-token interfejsu) nie blokuje ciasteczka
    assert c.get("/api/users/me", headers={"Authorization": "Bearer esn.abc.cookie"}).status_code == 200


def test_secure_cookie_behind_cloudflare():
    login, _ = make_user()
    c = TestClient(main.app)
    r = c.post("/api/login", headers={**ip(), "CF-Visitor": '{"scheme":"https"}'}, json={"login": login, "password": "Haslo123!", "username": "x", "email": "x@x.pl"})
    assert r.status_code == 200 and "secure" in r.headers.get("set-cookie", "").lower()
    assert "strict-transport-security" in {k.lower() for k in r.headers}


def test_index_injects_user_without_token():
    login, uid = make_user()
    c = TestClient(main.app)
    c.post("/api/login", headers=ip(), json={"login": login, "password": "Haslo123!", "username": "x", "email": "x@x.pl"})
    html = c.get("/").text
    assert '"sub": "%s"' % login in html and '"user_id": %d' % uid in html
    assert c.cookies.get("esn_access_token") not in html            # sam token nie trafia do strony
    assert c.get("/").headers["cache-control"] == "no-store"
    assert "window.ESN_USER = null" in TestClient(main.app).get("/").text


def test_rate_limit_forgot_password_per_email():
    login, _ = make_user()
    c = TestClient(main.app)
    codes = [c.post("/api/auth/forgot-password", headers=ip(), json={"email": login + "@example.test"}).status_code for _ in range(4)]
    assert codes[:3] == [200, 200, 200] and codes[3] == 429


def test_rate_limit_code_guessing():
    login, uid = make_user()
    c = TestClient(main.app)
    codes = [c.post("/api/auth/reset-password", headers=ip(), json={"email": login + "@example.test", "code": "000000", "new_password": "Nowe123!x"}).status_code for _ in range(7)]
    assert codes[:6] == [400] * 6 and codes[6] == 429


def test_security_headers():
    r = TestClient(main.app).get("/")
    h = {k.lower(): v for k, v in r.headers.items()}
    assert h["x-content-type-options"] == "nosniff" and h["x-frame-options"] == "SAMEORIGIN"
    assert "frame-ancestors 'self'" in h["content-security-policy"] and "content-security-policy-report-only" in h
    assert "geolocation=()" in h["permissions-policy"]
