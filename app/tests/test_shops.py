"""„Gdzie kupić” (v48): linki do sklepów przy komponencie katalogu – walidacja i zwracanie w API."""
import os
import sys
import uuid

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("JWT_SECRET_KEY", "test")
os.environ["KNOWLEDGE_SEED"] = "0"

from fastapi.testclient import TestClient    # noqa: E402

import auth      # noqa: E402
import main      # noqa: E402
import models    # noqa: E402
from database import SessionLocal  # noqa: E402

client = TestClient(main.app)


@pytest.fixture(scope="module")
def adm():
    db = SessionLocal()
    login = "shop-" + uuid.uuid4().hex[:6]
    u = models.User(username=login, login=login, email=login + "@example.test", hashed_password="x", role="admin")
    db.add(u)
    db.commit()
    uid = u.id
    db.close()
    yield {"Authorization": "Bearer " + auth.create_access_token(data={"sub": login, "role": "admin", "user_id": uid})}
    db = SessionLocal()
    db.query(models.User).filter(models.User.id == uid).delete()
    db.commit()
    db.close()


def test_clean_shops():
    cs = main.clean_shops
    out = cs([{"name": "Botland", "url": "https://botland.com.pl/x", "region": "pl", "note": "n" * 300, "price": 9},
              {"url": "https://www.mouser.com/p/1", "region": "mars"},
              {"url": "https://botland.com.pl/x"},                          # duplikat
              {"name": "pusty"}, "zły"])
    assert out == [{"name": "Botland", "url": "https://botland.com.pl/x", "region": "pl", "note": "n" * 120},
                   {"name": "mouser.com", "url": "https://www.mouser.com/p/1", "region": ""}]
    for bad in ("javascript:alert(1)", "ftp://x", "https://a b", 'https://x"onmouseover=1'):
        with pytest.raises(Exception):
            cs([{"url": bad}])
    assert cs(None) == [] and len(cs([{"url": f"https://s{i}.pl"} for i in range(20)])) == main.SHOP_MAX


def test_shops_saved_and_returned(adm):
    r = client.post("/api/catalog", headers=adm, json={"name": "Sklep test " + uuid.uuid4().hex[:4], "inventory_category": "Moduły",
                                                      "shops": [{"name": "TME", "url": "https://www.tme.eu/pl/details/x/", "region": "eu"}]})
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    try:
        d = client.get(f"/api/catalog/{cid}").json()
        assert d["shops"] == [{"name": "TME", "url": "https://www.tme.eu/pl/details/x/", "region": "eu"}]
        lst = client.get("/api/catalog", params={"q": d["name"]}).json()["items"]
        assert [i["shops_count"] for i in lst if i["id"] == cid] == [1]
        assert client.put(f"/api/catalog/{cid}", headers=adm, json={"shops": [{"url": "javascript:x"}]}).status_code == 400
        assert client.put(f"/api/catalog/{cid}", headers=adm, json={"shops": []}).status_code == 200
        assert client.get(f"/api/catalog/{cid}").json()["shops"] == []
        assert client.put(f"/api/catalog/{cid}", headers=adm, json={"name": d["name"]}).status_code == 200   # brak pola shops = bez zmian
    finally:
        client.delete(f"/api/catalog/{cid}", headers=adm)
