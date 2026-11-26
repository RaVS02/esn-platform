"""Wiadomości e-mail w języku odbiorcy (nagłówek X-ESN-Lang / Accept-Language / users.lang)."""
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("JWT_SECRET_KEY", "test")
os.environ["KNOWLEDGE_SEED"] = "0"

from fastapi.testclient import TestClient    # noqa: E402

import mail_i18n   # noqa: E402
import main        # noqa: E402
import models      # noqa: E402
from database import SessionLocal  # noqa: E402

client = TestClient(main.app)


class Sent(list):
    generate_code = staticmethod(lambda: "123456")

    def send_email(self, to, subject, body):
        self.append((to, subject, body))
        return True


def _register(headers, monkeypatch):
    sent = Sent()
    monkeypatch.setattr(main, "mailer", sent)
    login = "ml" + uuid.uuid4().hex[:8]
    r = client.post("/api/register", headers=headers, json={"username": login, "login": login, "email": login + "@example.test", "password": "Haslo123!"})
    assert r.status_code == 200, r.text
    return login, sent


def test_norm_and_fallback():
    assert mail_i18n.norm("en-GB,en;q=0.9") == "en"
    assert mail_i18n.norm("de-DE,fr") is None
    assert mail_i18n.norm("de-DE, pl;q=0.5") == "pl"
    assert mail_i18n.request_lang(None) == "pl"
    assert mail_i18n.request_lang(None, "en") == "en"
    for lang, tpl in mail_i18n.MAILS.items():   # każdy język ma komplet szablonów i poprawne placeholdery
        assert set(tpl) == set(mail_i18n.MAILS["pl"]) and set(tpl["purposes"]) == set(mail_i18n.MAILS["pl"]["purposes"]), lang
        mail_i18n.render(lang, "register_body", username="u", login="l", code="123456")
        mail_i18n.render(lang, "reset_body", username="u", login="l", code="123456")


def test_register_and_reset_mail_language(monkeypatch):
    login, sent = _register({"X-ESN-Lang": "en"}, monkeypatch)
    assert sent[0][1] == "Account verification - ESN Platform" and "Hello" in sent[0][2]
    db = SessionLocal()
    assert db.query(models.User).filter(models.User.login == login).first().lang == "en"
    db.close()
    # reset bez nagłówka → zapisany język użytkownika; z nagłówkiem → nagłówek
    r = client.post("/api/auth/forgot-password", json={"email": login + "@example.test"})
    assert r.status_code == 200 and sent[-1][1] == "Account recovery - ESN Platform"
    r = client.post("/api/auth/forgot-password", headers={"X-ESN-Lang": "pl"}, json={"email": login + "@example.test"})
    assert sent[-1][1] == "Odzyskiwanie dostępu - ESN Platform"


def test_register_default_polish(monkeypatch):
    _, sent = _register({}, monkeypatch)
    assert sent[0][1] == "Weryfikacja konta - ESN Platform"
