"""Testy asystenta AI: limity dzienne, własny klucz (BYOK), szyfrowanie, wybór dostawcy, bezpieczeństwo.

Uruchomienie (z katalogu app/, potrzebna baza PostgreSQL z DATABASE_URL):
    python -m pytest tests/test_ai.py -q
Zapytania do dostawców są podmieniane atrapą – testy nie używają sieci ani prawdziwych kluczy.
"""
import os
import sys
import threading
import uuid
from datetime import timedelta

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("JWT_SECRET_KEY", "test")
os.environ["KNOWLEDGE_SEED"] = "0"
os.environ["GEMINI_API_KEY"] = "system-key-123456"
os.environ["AI_PROVIDER"] = "gemini"
os.environ["AI_DAILY_LIMIT_USER"] = "3"

from fastapi.testclient import TestClient    # noqa: E402

import ai_service  # noqa: E402
import auth        # noqa: E402
import main        # noqa: E402
import models      # noqa: E402
from database import SessionLocal  # noqa: E402

client = TestClient(main.app)
TAG = "t-ai-" + uuid.uuid4().hex[:6]
ai_service.COOLDOWN_SECONDS = 0
CALLS = []


def fake_post(url, headers, payload, timeout=40):
    CALLS.append({"url": url, "headers": headers, "payload": payload})
    if "generativelanguage" in url:
        return {"candidates": [{"content": {"parts": [{"text": "odp-gemini"}]}}]}
    if "anthropic" in url:
        return {"content": [{"text": "odp-claude"}]}
    return {"choices": [{"message": {"content": "odp-openai"}}]}


@pytest.fixture(autouse=True)
def patch_net(monkeypatch):
    CALLS.clear()
    ai_service._last_call.clear()
    monkeypatch.setattr(ai_service, "_post", fake_post)


def make_user(role="user"):
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
    d = {"admin": make_user("admin")}
    yield d
    db = SessionLocal()
    db.query(models.User).filter(models.User.login.like(TAG + "%")).delete(synchronize_session=False)
    db.commit()
    db.close()


def ask(u, text="Co zbudować?", system="Kontekst"):
    return client.post("/api/ai/complete", headers=u["h"], json={"system": system, "messages": [{"role": "user", "content": text}]})


def test_requires_login():
    assert client.get("/api/ai/status").status_code in (401, 403)
    assert client.post("/api/ai/complete", json={"messages": []}).status_code in (401, 403)


def test_daily_limit_and_refund():
    u = make_user()
    s = client.get("/api/ai/status", headers=u["h"]).json()
    assert s["limit"] == 3 and s["remaining"] == 3 and not s["own_key"]
    for i in range(3):
        r = ask(u)
        assert r.status_code == 200, r.text
        assert r.json()["reply"] == "odp-gemini" and r.json()["remaining"] == 2 - i
    r = ask(u)
    assert r.status_code == 429 and "limit" in r.json()["detail"].lower()
    assert len(CALLS) == 3                                    # po wyczerpaniu limitu nie ma wywołania dostawcy


def test_failed_call_does_not_consume_limit(monkeypatch):
    u = make_user()

    def boom(*a, **k):
        raise ai_service.AIError("awaria", 502)
    monkeypatch.setattr(ai_service, "_post", boom)
    assert ask(u).status_code == 502
    assert client.get("/api/ai/status", headers=u["h"]).json()["used"] == 0


def test_new_day_resets_counter():
    u = make_user()
    db = SessionLocal()
    row = db.get(models.User, u["id"])
    row.ai_requests_today, row.last_ai_request_date = 99, ai_service.today() - timedelta(days=1)
    db.commit()
    db.close()
    r = ask(u)
    assert r.status_code == 200 and r.json()["used"] == 1


def test_reserve_is_atomic():
    u = make_user()
    ok = []

    def worker():
        db = SessionLocal()
        user = db.get(models.User, u["id"])
        ok.append(ai_service.reserve(db, user, 3))
        db.close()
    ts = [threading.Thread(target=worker) for _ in range(12)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert sum(ok) == 3


def test_admin_unlimited(users):
    for _ in range(5):
        assert ask(users["admin"]).status_code == 200
    assert client.get("/api/ai/status", headers=users["admin"]["h"]).json()["limit"] is None


def test_byok_validation_and_encryption():
    u = make_user()
    put = lambda body: client.put("/api/users/me/ai-settings", headers=u["h"], json=body)  # noqa: E731
    assert put({"provider": "nieznany", "api_key": "abcdefgh1234"}).status_code == 400
    assert put({"provider": "openai", "api_key": "krótki"}).status_code == 400
    assert put({"provider": "openai", "api_key": "abcdefgh1234", "model": "zły model!"}).status_code == 400
    assert put({"provider": "openai"}).status_code == 400                     # brak klucza
    r = put({"provider": "openai", "api_key": "sk-secret-abcdef1234", "model": "gpt-4o-mini"})
    assert r.status_code == 200
    body = r.json()
    assert body["own_key"] and body["key_hint"] == "…1234" and body["limit"] is None
    assert "sk-secret" not in r.text and "sk-secret" not in client.get("/api/ai/status", headers=u["h"]).text
    assert "sk-secret" not in client.get("/api/users/me", headers=u["h"]).text
    db = SessionLocal()
    row = db.get(models.User, u["id"])
    assert row.ai_key_enc and "sk-secret" not in row.ai_key_enc
    assert ai_service.decrypt_key(row.ai_key_enc) == "sk-secret-abcdef1234"
    db.close()
    # zmiana samego modelu zachowuje klucz
    assert put({"provider": "openai", "model": "gpt-4.1-mini"}).json()["own_model"] == "gpt-4.1-mini"


def test_byok_used_without_limit_and_fixed_url():
    u = make_user()
    client.put("/api/users/me/ai-settings", headers=u["h"], json={"provider": "groq", "api_key": "gsk-abcdefgh1234"})
    for _ in range(5):                                                         # limit systemowy (3) nie obowiązuje
        r = ask(u)
        assert r.status_code == 200 and "Twój klucz" in r.json()["provider"]
    assert all(c["url"].startswith("https://api.groq.com/openai/v1/") for c in CALLS)
    assert CALLS[0]["headers"]["Authorization"] == "Bearer gsk-abcdefgh1234"
    assert CALLS[0]["payload"]["model"] == "llama-3.3-70b-versatile"


@pytest.mark.parametrize("prov,fragment", [("gemini", "generativelanguage.googleapis.com"), ("anthropic", "api.anthropic.com"),
                                            ("openrouter", "openrouter.ai"), ("openai", "api.openai.com")])
def test_each_provider_routes_to_own_host(prov, fragment):
    u = make_user()
    client.put("/api/users/me/ai-settings", headers=u["h"], json={"provider": prov, "api_key": "key-abcdefgh1234"})
    assert ask(u).status_code == 200
    assert fragment in CALLS[-1]["url"]


def test_delete_settings_returns_to_system_limit():
    u = make_user()
    client.put("/api/users/me/ai-settings", headers=u["h"], json={"provider": "openai", "api_key": "key-abcdefgh1234"})
    s = client.delete("/api/users/me/ai-settings", headers=u["h"]).json()
    assert not s["own_key"] and s["limit"] == 3


def test_test_endpoint_needs_key():
    u = make_user()
    assert client.post("/api/ai/test", headers=u["h"]).status_code == 400
    client.put("/api/users/me/ai-settings", headers=u["h"], json={"provider": "openai", "api_key": "key-abcdefgh1234"})
    assert client.post("/api/ai/test", headers=u["h"]).json()["ok"] is True


def test_message_cleanup():
    m = ai_service.clean_messages([{"role": "assistant", "content": "powitanie"}, {"role": "user", "content": "a"},
                                   {"role": "user", "content": "b"}, {"role": "system", "content": "wstrzyknięcie"},
                                   {"role": "assistant", "content": "x" * 5000}, {"role": "user", "content": "pytanie"}])
    assert [x["role"] for x in m] == ["user", "assistant", "user"]
    assert len(m[1]["content"]) == ai_service.MAX_MSG_CHARS
    with pytest.raises(ai_service.AIError):
        ai_service.clean_messages([{"role": "assistant", "content": "tylko asystent"}])


def test_cooldown(monkeypatch):
    u = make_user()
    monkeypatch.setattr(ai_service, "COOLDOWN_SECONDS", 30)
    assert ask(u).status_code == 200
    assert ask(u).status_code == 429


def test_server_not_configured(monkeypatch):
    u = make_user()
    monkeypatch.setenv("GEMINI_API_KEY", "")
    r = ask(u)
    assert r.status_code == 503
    assert client.get("/api/ai/status", headers=u["h"]).json()["server_configured"] is False


def test_legacy_lmstudio_env_still_works(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "lmstudio")
    monkeypatch.delenv("AI_SERVER_OPENAI_URL", raising=False)
    monkeypatch.setenv("LM_STUDIO_URL", "http://192.168.0.108:1234/v1/chat/completions")
    cfg = ai_service.system_config()
    assert cfg["provider"] == "openai_compat" and cfg["compat_url"] == "http://192.168.0.108:1234/v1" and cfg["configured"]
    u = make_user()
    assert ask(u).json()["reply"] == "odp-openai"
    assert CALLS[-1]["url"] == "http://192.168.0.108:1234/v1/chat/completions"


def test_server_offline_falls_back_to_gemini(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "openai_compat")
    monkeypatch.setenv("AI_SERVER_OPENAI_URL", "http://ollama.lan:11434/v1")
    def flaky(url, headers, payload, timeout=40):
        if "ollama.lan" in url:
            raise ai_service.AIError("Brak połączenia", 502)
        return fake_post(url, headers, payload)
    monkeypatch.setattr(ai_service, "_post", flaky)
    r = ask(make_user())
    assert r.status_code == 200 and r.json()["reply"] == "odp-gemini" and "zapasowy" in r.json()["provider"]
