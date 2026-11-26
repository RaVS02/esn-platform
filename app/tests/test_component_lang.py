"""Komponenty: wersje językowe w jednym rekordzie (base_lang, translations, pinout lang + translations)."""
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
TAG = "tc-lang-" + uuid.uuid4().hex[:6]


@pytest.fixture(scope="module")
def adm():
    db = SessionLocal()
    login = f"{TAG}-adm"
    u = models.User(username=login, login=login, email=login + "@example.test", hashed_password="x", role="admin")
    db.add(u)
    db.commit()
    db.refresh(u)
    uid = u.id
    db.close()
    tok = auth.create_access_token(data={"sub": login, "role": "admin", "user_id": uid})
    yield {"Authorization": "Bearer " + tok}
    db = SessionLocal()
    db.query(models.OfficialComponent).filter(models.OfficialComponent.name.like(TAG + "%")).delete(synchronize_session=False)
    db.query(models.User).filter(models.User.id == uid).delete(synchronize_session=False)
    db.commit()
    db.close()


PINOUT = {"package": "SOIC-8", "view": "widok z góry", "layout": "dual", "notes": "Uwaga",
          "pins": [{"n": "1", "name": "VCC", "cat": "power", "type": "Zasilanie", "fn": "Zasilanie dodatnie", "note": ""},
                   {"n": "2", "name": "GND", "cat": "ground", "type": "Masa", "fn": "Masa", "note": ""}],
          "groups": [{"name": "Zasilanie", "pins": ["1", "2"], "note": "x"}]}


def mk(adm, **kw):
    d = {"name": TAG + " ukl", "description": "Opis po polsku", "inventory_category": "Inne",
         "technical_specs": {"Napięcie": "3.3V"}, "pinout": PINOUT}
    d.update(kw)
    r = client.post("/api/catalog", json=d, headers=adm)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_defaults_and_validation(adm):
    cid = mk(adm)
    raw = client.get(f"/api/catalog/{cid}").json()
    assert raw["base_lang"] == "pl" and raw["translations"] == {} and raw["pinout"]["lang"] == "pl"
    assert client.post("/api/catalog", json={"name": TAG + " x", "base_lang": "xx"}, headers=adm).status_code == 400
    assert client.put(f"/api/catalog/{cid}", json={"translations": {"pl": {"name": "x"}}}, headers=adm).status_code == 400   # bazowy nie może być tłumaczeniem
    assert client.put(f"/api/catalog/{cid}", json={"translations": {"zz": {"name": "x"}}}, headers=adm).status_code == 400
    po = {**PINOUT, "lang": "xx"}
    assert client.put(f"/api/catalog/{cid}", json={"pinout": po}, headers=adm).status_code == 400


def test_translation_resolve_and_search(adm):
    cid = mk(adm, translations={"en": {"name": TAG + " chip", "description": "English description", "specs": {"Napięcie": "Voltage"}}},
             name=TAG + " ukl2")
    raw = client.get(f"/api/catalog/{cid}").json()
    assert raw["translations"]["en"]["description"] == "English description" and raw["name"] == TAG + " ukl2"
    en = client.get(f"/api/catalog/{cid}?lang=en").json()
    assert en["name"] == TAG + " chip" and en["description"] == "English description" and en["lang_used"] == "en"
    assert en["technical_specs"] == {"Voltage": "3.3V"} and en["langs"] == ["pl", "en"]
    pl = client.get(f"/api/catalog/{cid}?lang=pl").json()
    assert pl["name"] == TAG + " ukl2" and pl["lang_used"] == "pl"
    de = client.get(f"/api/catalog/{cid}?lang=de").json()   # brak tłumaczenia -> oryginał
    assert de["lang_used"] == "pl" and de["description"] == "Opis po polsku"
    lst = client.get(f"/api/catalog?limit=1000&lang=en&q=English%20description").json()["items"]
    assert [x["name"] for x in lst if x["id"] == cid] == [TAG + " chip"]
    # częściowe tłumaczenie: brakujące pola z oryginału
    assert client.put(f"/api/catalog/{cid}", json={"translations": {"en": {"description": "Only desc"}}}, headers=adm).status_code == 200
    en = client.get(f"/api/catalog/{cid}?lang=en").json()
    assert en["name"] == TAG + " ukl2" and en["description"] == "Only desc" and "Napięcie" in en["technical_specs"]
    # stary klient (bez translations) nie kasuje tłumaczeń
    assert client.put(f"/api/catalog/{cid}", json={"description": "Nowy opis"}, headers=adm).status_code == 200
    assert client.get(f"/api/catalog/{cid}").json()["translations"]["en"]["description"] == "Only desc"


def test_pinout_translations(adm):
    po = {**PINOUT, "translations": {"en": {"view": "top view", "notes": "Note",
          "pins": {"1": {"type": "Power", "fn": "Positive supply"}, "99": {"fn": "ghost"}},
          "groups": {"Zasilanie": {"name": "Power"}, "Nie ma": {"name": "x"}}}}}
    cid = mk(adm, name=TAG + " po", pinout=po)
    p = client.get(f"/api/catalog/{cid}").json()["pinout"]
    en = p["translations"]["en"]
    assert en["view"] == "top view" and en["pins"] == {"1": {"type": "Power", "fn": "Positive supply"}}
    assert en["groups"] == {"Zasilanie": {"name": "Power"}}      # nieistniejące piny/grupy odrzucone
    bad = {**PINOUT, "translations": {"pl": {"view": "x"}}}
    assert client.put(f"/api/catalog/{cid}", json={"pinout": bad}, headers=adm).status_code == 400
    # język bazowy en: pinout bez lang dziedziczy język komponentu
    cid2 = mk(adm, name=TAG + " en", base_lang="en")
    assert client.get(f"/api/catalog/{cid2}").json()["pinout"]["lang"] == "en"
