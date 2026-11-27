"""v64: dashboard administracji – tylko admin, akcje z dziennikiem, bez akcji na własnym koncie."""
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


def make_user(role="user"):
    db = SessionLocal()
    login = "ad" + uuid.uuid4().hex[:8]
    u = models.User(username=login, login=login, email=login + "@example.test", hashed_password=utils.hash_password("Haslo123!"), role=role)
    db.add(u); db.commit(); uid = u.id; db.close()
    return login, uid, {"Authorization": "Bearer " + auth.create_access_token({"sub": login, "role": role, "user_id": uid}), "X-ESN-Req": "1"}


def test_only_admin_can_use_dashboard():
    _, _, user = make_user(); _, _, mod = make_user("moderator")
    c = TestClient(main.app)
    for path in ("/api/admin/overview", "/api/admin/users", "/api/admin/messages", "/api/admin/log"):
        assert c.get(path).status_code in (401, 403)
        assert c.get(path, headers=user).status_code == 403
        assert c.get(path, headers=mod).status_code == 403


def test_overview_shape_and_users_list():
    _, _, adm = make_user("admin")
    c = TestClient(main.app)
    o = c.get("/api/admin/overview", headers=adm)
    assert o.status_code == 200 and o.headers.get("cache-control") == "no-store"
    j = o.json()
    assert j["users"]["total"] >= 1 and len(j["users"]["signups"]) == 30 and set(j["users"]["roles"]) == {"user", "moderator", "admin"}
    assert {"projects", "components", "articles", "schemas"} <= set(j["content"]) and "unread" in j["moderation"]
    login, _, _ = make_user()
    r = c.get("/api/admin/users", params={"q": login}, headers=adm).json()
    assert r["total"] == 1 and r["items"][0]["login"] == login and r["items"][0]["email"].endswith("@example.test")


def test_ban_unban_role_logged_and_not_on_self():
    alog, aid, adm = make_user("admin")
    login, uid, _ = make_user()
    c = TestClient(main.app)
    assert c.post(f"/api/admin/users/{aid}/ban", headers=adm, json={"days": 1}).status_code == 400
    assert c.put(f"/api/admin/users/{aid}/role", headers=adm, json={"role": "user"}).status_code == 400
    r = c.post(f"/api/admin/users/{uid}/ban", headers=adm, json={"days": 3, "reason": "spam"})
    assert r.status_code == 200 and r.json()["banned"] is True
    assert c.post("/api/login", headers={"X-Forwarded-For": "10.9.%d.%d" % tuple(uuid.uuid4().bytes[:2])},
                  json={"login": login, "password": "Haslo123!", "username": "x", "email": "x@x.pl"}).status_code in (401, 403)
    assert c.post(f"/api/admin/users/{uid}/unban", headers=adm).json()["banned"] is False
    assert c.put(f"/api/admin/users/{uid}/role", headers=adm, json={"role": "moderator"}).json()["role"] == "moderator"
    assert c.put(f"/api/admin/users/{uid}/role", headers=adm, json={"role": "boss"}).status_code == 400
    acts = [(x["action"], x["target"]) for x in c.get("/api/admin/log", headers=adm).json() if x["target"] == login]
    assert ("ban", login) in acts and ("unban", login) in acts and ("role", login) in acts


def test_login_sets_last_login_and_messages_read():
    login, uid, _ = make_user()
    _, _, adm = make_user("admin")
    c = TestClient(main.app)
    r = c.post("/api/login", headers={"X-Forwarded-For": "10.8.%d.%d" % tuple(uuid.uuid4().bytes[:2])}, json={"login": login, "password": "Haslo123!", "username": "x", "email": "x@x.pl"})
    assert r.status_code == 200
    db = SessionLocal(); assert db.query(models.User).get(uid).last_login_at is not None
    m = models.ContactMessage(name="T", email="t@example.test", subject="Test " + login, message="x"); db.add(m); db.commit(); mid = m.id; db.close()
    assert any(x["id"] == mid for x in c.get("/api/admin/messages", params={"unread": 1}, headers=adm).json())
    assert c.put(f"/api/admin/messages/{mid}/read", headers=adm, json={"read": True}).json()["is_read"] is True
    assert not any(x["id"] == mid for x in c.get("/api/admin/messages", params={"unread": 1}, headers=adm).json())
