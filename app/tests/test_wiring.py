"""Edytor schematów połączeń (/api/wiring): katalog z pinoutami i tłumaczeniem, części własne, schematy z blokadą
optymistyczną (rev → 409), uprawnienia, walidacja serwerowa (clean_wiring), powiązanie z projektem."""
import os
import sys
import uuid

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("JWT_SECRET_KEY", "test")
os.environ["KNOWLEDGE_SEED"] = "0"

from fastapi.testclient import TestClient    # noqa: E402

import auth             # noqa: E402
import main             # noqa: E402
import models           # noqa: E402
import wiring_service   # noqa: E402
from database import SessionLocal  # noqa: E402

client = TestClient(main.app)
TAG = "t-wir-" + uuid.uuid4().hex[:6]


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
def env():
    db = SessionLocal()
    comp = models.OfficialComponent(name=TAG + " HC-SR04", inventory_category="Czujniki", description="Czujnik odległości",
                                    base_lang="pl", translations={"en": {"name": TAG + " ultrasonic", "description": "Distance sensor"}},
                                    pinout={"layout": "sip", "pins": [
                                        {"n": "1", "name": "VCC", "cat": "power", "fn": "Zasilanie 5 V"},
                                        {"n": "2", "name": "TRIG", "cat": "digital", "fn": "Wyzwolenie"},
                                        {"n": "3", "name": "GND", "cat": "ground", "fn": "Masa"},
                                        {"n": "4", "name": "EP", "cat": "ground", "fn": "pad", "pad": True}],
                                        "translations": {"en": {"pins": {"1": {"fn": "5 V supply"}, "2": {"fn": "Trigger"}}}}})
    empty = models.OfficialComponent(name=TAG + " bez pinoutu", inventory_category="Inne")
    db.add_all([comp, empty])
    db.commit()
    a, b, adm = make_user(), make_user(), make_user("admin")
    proj = models.Project(title=TAG + " projekt", slug=TAG + "-p", owner_id=a["id"])
    db.add(proj)
    db.commit()
    d = {"cid": comp.id, "empty": empty.id, "a": a, "b": b, "adm": adm, "proj": proj.id}
    db.close()
    yield d
    db = SessionLocal()
    db.query(models.WiringSchema).filter(models.WiringSchema.owner_id.in_([a["id"], b["id"], adm["id"]])).delete(synchronize_session=False)
    db.query(models.WiringPart).filter(models.WiringPart.owner_id.in_([a["id"], b["id"], adm["id"]])).delete(synchronize_session=False)
    db.query(models.Project).filter(models.Project.id == d["proj"]).delete()
    db.query(models.OfficialComponent).filter(models.OfficialComponent.id.in_([d["cid"], d["empty"]])).delete(synchronize_session=False)
    db.query(models.User).filter(models.User.id.in_([a["id"], b["id"], adm["id"]])).delete(synchronize_session=False)
    db.commit()
    db.close()


def test_catalog_parts_list_and_batch_with_language(env):
    r = client.get("/api/wiring/parts", params={"q": TAG, "src": "catalog"})
    assert r.status_code == 200
    items = r.json()["items"]
    assert [i["id"] for i in items] == [f"cat-{env['cid']}"]          # komponent bez pinoutu pominięty
    assert items[0]["pins"] == 4 and items[0]["category"] == "Czujnik" and "pins" not in [k for k in items[0] if isinstance(items[0][k], list)]
    pl = client.get("/api/wiring/parts/batch", params={"ids": f"cat-{env['cid']}"}).json()[0]
    assert [p["id"] for p in pl["pins"]] == ["1", "2", "3"] and pl["pins"][0]["type"] == "power" and pl["pins"][2]["type"] == "gnd"
    en = client.get("/api/wiring/parts/batch", params={"ids": f"cat-{env['cid']}"}, headers={"X-ESN-Lang": "en"}).json()[0]
    assert en["name"] == TAG + " ultrasonic" and en["pins"][0]["desc"] == "5 V supply" and en["pins"][2]["desc"] == "Masa"
    # wyszukiwanie obejmuje tłumaczenia
    assert client.get("/api/wiring/parts", params={"q": "ultrasonic", "src": "catalog"}).json()["total"] >= 1


def test_own_parts(env):
    h = env["a"]["h"]
    assert client.put("/api/wiring/parts/moj-1", json={"name": "X"}).status_code in (401, 403)          # gość
    assert client.put(f"/api/wiring/parts/cat-{env['cid']}", json={"name": "X"}, headers=h).status_code == 400
    body = {"name": "Mój dzielnik", "category": "Rezystor", "icon": "res", "image": "javascript:alert(1)", "evil": 1,
            "pins": [{"id": "1", "name": "A", "type": "pass"}, {"id": "2", "name": "B", "type": "zły"}, {"id": "1", "name": "dup"}]}
    r = client.put("/api/wiring/parts/moj-dz", json=body, headers=h)
    assert r.status_code == 200
    p = r.json()
    assert "image" not in p and "evil" not in p and [x["id"] for x in p["pins"]] == ["1", "2"] and p["pins"][1]["type"] == "other"
    own = client.get("/api/wiring/parts", params={"src": "own"}, headers=h).json()["items"]
    assert [i["id"] for i in own] == ["moj-dz"] and own[0]["pins"] == 2
    assert client.get("/api/wiring/parts", params={"src": "own"}).json()["total"] == 0                   # gość nie widzi cudzych
    assert client.get("/api/wiring/parts/batch", params={"ids": "moj-dz"}).json()[0]["name"] == "Mój dzielnik"   # ale schemat z nią się otworzy


def test_schema_crud_rev_conflict_and_permissions(env):
    a, b = env["a"]["h"], env["b"]["h"]
    cid = f"cat-{env['cid']}"
    assert client.post("/api/wiring/projects", json={"title": "x"}).status_code in (401, 403)
    r = client.post("/api/wiring/projects", headers=a, json={"title": "Schemat A", "nodes": [{"id": "n1", "part": cid, "x": 10, "y": 20}]})
    assert r.status_code == 200
    s = r.json()
    sid, rev = s["id"], s["rev"]
    assert s["can_edit"] and s["orient"] == "auto" and s["nodes"][0]["part"] == cid
    assert [x["id"] for x in client.get("/api/wiring/projects", headers=a).json()] == [sid]
    assert client.get("/api/wiring/projects", headers=b).json() == [] and client.get("/api/wiring/projects").json() == []
    # schemat bez projektu jest prywatny
    assert client.get(f"/api/wiring/projects/{sid}").status_code == 404
    assert client.get(f"/api/wiring/projects/{sid}", headers=b).status_code == 404
    assert client.get(f"/api/wiring/projects/{sid}", headers=env["adm"]["h"]).json()["can_edit"] is True
    doc = client.get(f"/api/wiring/projects/{sid}", headers=a).json()
    doc["title"] = "Schemat A2"
    ok = client.put(f"/api/wiring/projects/{sid}", headers=a, json=doc)
    assert ok.status_code == 200 and ok.json()["rev"] == rev + 1 and ok.json()["title"] == "Schemat A2"
    stale = client.put(f"/api/wiring/projects/{sid}", headers=a, json=doc)          # stary rev → 409
    assert stale.status_code == 409 and stale.json()["detail"]["rev"] == rev + 1
    norev = dict(doc); norev.pop("rev")
    assert client.put(f"/api/wiring/projects/{sid}", headers=a, json=norev).status_code == 409
    assert client.put(f"/api/wiring/projects/{sid}", headers=b, json=dict(doc, rev=rev + 1)).status_code == 403
    assert client.delete(f"/api/wiring/projects/{sid}", headers=b).status_code == 403
    assert client.delete(f"/api/wiring/projects/{sid}", headers=a).json() == {"ok": True}


def test_project_link_is_public_and_editable_by_project_owner(env):
    a, b = env["a"]["h"], env["b"]["h"]
    info = client.get(f"/api/wiring/by-project/{env['proj']}").json()
    assert info == {"schema": None, "can_create": False}
    assert client.get(f"/api/wiring/by-project/{env['proj']}", headers=a).json()["can_create"] is True
    assert client.post("/api/wiring/projects", headers=b, json={"title": "cudzy", "project_id": env["proj"]}).status_code == 403
    s = client.post("/api/wiring/projects", headers=a, json={"title": "Do projektu", "project_id": env["proj"]}).json()
    assert s["project_id"] == env["proj"]
    assert client.post("/api/wiring/projects", headers=a, json={"title": "drugi", "project_id": env["proj"]}).status_code == 409
    pub = client.get(f"/api/wiring/projects/{s['id']}")                   # gość widzi schemat projektu (tylko podgląd)
    assert pub.status_code == 200 and pub.json()["can_edit"] is False
    info = client.get(f"/api/wiring/by-project/{env['proj']}").json()
    assert info["schema"]["id"] == s["id"] and info["schema"]["can_edit"] is False and info["can_create"] is False
    assert client.get(f"/api/wiring/by-project/{env['proj']}", headers=a).json()["schema"]["can_edit"] is True


def test_clean_wiring_limits_and_unknown_keys():
    cw = wiring_service.clean_wiring
    out = cw({"wire": "zły", "orient": "def", "density": "x", "hack": 1,
              "nodes": [{"id": "n1", "part": "cat-1", "x": 0, "y": 0, "label": "<b>R1</b>", "flip": "tak", "w": 50, "h": 300, "value": "4.7 kΩ", "evil": 1},
                        {"id": "n1", "part": "cat-2", "x": 1, "y": 1},                     # duplikat id
                        {"id": "n2", "part": "zła część!", "x": 1, "y": 1},              # zły format id części
                        {"id": "n3", "part": "r-1", "x": float("nan"), "y": 1},          # zła współrzędna
                        {"id": "n4", "part": "r-1", "x": 5, "y": 5, "collapsed": True}],
              "links": [{"id": "l1", "a": {"n": "n1", "p": "1"}, "b": {"n": "n4", "p": "2"}, "style": "ortho", "lp": 2,
                         "pts": [{"x": 1, "y": 2}] * 50, "x": 1},
                        {"id": "l2", "a": {"n": "n1", "p": "1"}, "b": {"n": "nX", "p": "2"}}],
              "glabels": {"n1|n4|spi": 0.4, "zly": "abc"}, "gpts": {"k": [{"x": 1, "y": 1}], "pusty": []},
              "notes": [{"id": "t1", "x": 1, "y": 2, "text": "a" * 5000, "c": "warn", "w": 1000}, {"id": "t2", "x": "a", "y": 1}]})
    assert set(out) == {"wire", "orient", "nodes", "links", "glabels", "gpts", "notes"} and out["wire"] == "curve"
    assert [n["id"] for n in out["nodes"]] == ["n1", "n4"]
    n1 = out["nodes"][0]
    assert n1 == {"id": "n1", "part": "cat-1", "label": "<b>R1</b>", "x": 0, "y": 0, "h": 300, "value": "4.7 kΩ"}   # escapowanie robi frontend (esc())
    assert out["nodes"][1]["collapsed"] is True
    assert len(out["links"]) == 1 and out["links"][0]["style"] == "ortho" and "lp" not in out["links"][0] and len(out["links"][0]["pts"]) == 20
    assert out["glabels"] == {"n1|n4|spi": 0.4} and out["gpts"] == {"k": [{"x": 1, "y": 1}]}
    assert len(out["notes"]) == 1 and len(out["notes"][0]["text"]) == 1000 and "w" not in out["notes"][0]
    with pytest.raises(Exception):
        cw({"nodes": [{"id": f"n{i}", "part": "p", "x": 0, "y": 0} for i in range(61)]})


def test_body_size_limit(env):
    a = env["a"]["h"]
    big = {"title": "duży", "notes": [{"id": f"t{i}", "x": 0, "y": 0, "text": "x" * 1000} for i in range(300)]}
    assert client.post("/api/wiring/projects", headers=a, json=big).status_code == 413


def test_no_store_and_logged_non_owner_is_read_only(env):
    """Odpowiedzi zależne od użytkownika nie mogą trafić do cache przeglądarki (inaczej inny użytkownik zobaczy can_edit=True)."""
    r = client.get(f"/api/wiring/by-project/{env['proj']}", headers=env["b"]["h"])
    assert "no-store" in r.headers.get("cache-control", "")
    info = r.json()
    assert info["can_create"] is False and (info["schema"] is None or info["schema"]["can_edit"] is False)


def test_components_synced_to_project_and_usage(env):
    a, adm = env["a"]["h"], env["adm"]["h"]
    cid = env["cid"]
    db = SessionLocal()
    sid = db.query(models.WiringSchema.id).filter(models.WiringSchema.project_id == env["proj"]).scalar()
    db.close()
    if not sid:
        sid = client.post("/api/wiring/projects", headers=a, json={"title": "sync", "project_id": env["proj"]}).json()["id"]
    doc = client.get(f"/api/wiring/projects/{sid}", headers=a).json()
    doc["nodes"] = [{"id": "n1", "part": f"cat-{cid}", "x": 0, "y": 0}, {"id": "n2", "part": "moj-dz", "x": 300, "y": 0},
                    {"id": "n3", "part": "cat-999999999", "x": 600, "y": 0}]
    assert client.put(f"/api/wiring/projects/{sid}", headers=a, json=doc).status_code == 200
    comps = client.get(f"/api/projects/{env['proj']}/components").json()
    assert [c["component_id"] for c in comps] == [cid]                       # tylko istniejące części z katalogu
    doc = client.get(f"/api/wiring/projects/{sid}", headers=a).json()
    assert client.put(f"/api/wiring/projects/{sid}", headers=a, json=doc).status_code == 200
    assert len(client.get(f"/api/projects/{env['proj']}/components").json()) == 1   # bez duplikatów
    assert client.get(f"/api/wiring/usage/component/{cid}", headers=a).status_code == 403
    u = client.get(f"/api/wiring/usage/component/{cid}", headers=adm).json()
    assert u["count"] >= 1 and sid in [s["id"] for s in u["schemas"]]
    db = SessionLocal()
    db.query(models.ProjectComponent).filter(models.ProjectComponent.project_id == env["proj"]).delete()
    db.commit()
    db.close()


def test_list_fields_link_and_unlink(env):
    a, b = env["a"]["h"], env["b"]["h"]
    s = client.post("/api/wiring/projects", headers=a, json={"title": "Do podpięcia",
                    "nodes": [{"id": "n1", "part": f"cat-{env['cid']}", "x": 0, "y": 0}]}).json()
    it = [x for x in client.get("/api/wiring/projects", headers=a).json() if x["id"] == s["id"]][0]
    assert it["parts"] == 1 and it["links"] == 0 and it["updated_at"] and it["project"] is None
    # zwolnij projekt testowy, jeśli ma już schemat z wcześniejszych testów
    for x in client.get("/api/wiring/projects", headers=a).json():
        if x["project_id"] == env["proj"]:
            client.put(f"/api/wiring/projects/{x['id']}/link", headers=a, json={"project_id": None})
    linkable = client.get("/api/wiring/linkable-projects", headers=a).json()
    assert env["proj"] in [p["id"] for p in linkable]
    assert env["proj"] not in [p["id"] for p in client.get("/api/wiring/linkable-projects", headers=b).json()]
    assert client.put(f"/api/wiring/projects/{s['id']}/link", headers=b, json={"project_id": env["proj"]}).status_code == 403
    r = client.put(f"/api/wiring/projects/{s['id']}/link", headers=a, json={"project_id": env["proj"]})
    assert r.status_code == 200 and r.json()["project_id"] == env["proj"]
    it = [x for x in client.get("/api/wiring/projects", headers=a).json() if x["id"] == s["id"]][0]
    assert it["project"]["id"] == env["proj"]
    assert env["proj"] not in [p["id"] for p in client.get("/api/wiring/linkable-projects", headers=a).json()]
    assert [c["component_id"] for c in client.get(f"/api/projects/{env['proj']}/components").json()] == [env["cid"]]   # sync przy podpięciu
    r = client.put(f"/api/wiring/projects/{s['id']}/link", headers=a, json={"project_id": None})
    assert r.json()["project_id"] is None
    assert client.get(f"/api/wiring/projects/{s['id']}").status_code == 404     # odpięty = znowu prywatny
    db = SessionLocal()
    db.query(models.ProjectComponent).filter(models.ProjectComponent.project_id == env["proj"]).delete()
    db.commit()
    db.close()


def test_builtin_parts(env):
    import wiring_builtin
    ids = [p["id"] for p in wiring_builtin.BUILTIN_PARTS]
    assert len(ids) == len(set(ids)) and all(i.startswith("std-") for i in ids)
    for p in wiring_builtin.BUILTIN_PARTS:                       # dane zgodne z walidacją części (clean_part)
        c = wiring_service.clean_part(p["id"], p)
        assert [x["id"] for x in c["pins"]] == [x["id"] for x in p["pins"]] and c["category"] == p["category"], p["id"]
        assert p.get("name_en") and all(x.get("desc_en") for x in p["pins"]), p["id"]
    r = client.get("/api/wiring/parts", params={"src": "basic", "limit": 100}).json()
    assert r["total"] == len(ids) and all(i["source"] == "builtin" for i in r["items"])
    assert client.get("/api/wiring/parts", params={"src": "basic", "q": "kondensator"}).json()["items"][0]["id"] == "std-capacitor"
    assert any(i["id"] == "std-resistor" for i in client.get("/api/wiring/parts", params={"limit": 100}).json()["items"])
    b = client.get("/api/wiring/parts/batch", params={"ids": "std-resistor,std-gnd"}).json()
    assert [p["id"] for p in b] == ["std-resistor", "std-gnd"] and b[0]["pins"][0]["type"] == "pass"
    assert client.put("/api/wiring/parts/std-resistor", headers=env["a"]["h"], json={"name": "x"}).status_code == 400
    out = wiring_service.clean_wiring({"nodes": [{"id": "n1", "part": "std-resistor", "x": 0, "y": 0, "value": "4.7 kΩ"}]})
    assert out["nodes"][0]["part"] == "std-resistor" and out["nodes"][0]["value"] == "4.7 kΩ"


def test_my_parts_list_usage_and_delete(env):
    a, b = env["a"]["h"], env["b"]["h"]
    client.put("/api/wiring/parts/moj-x", headers=a, json={"name": "Mój X", "category": "Moduł", "pins": [{"id": "+5V", "name": "+5V", "type": "power", "v": "5"}, {"id": "GND", "name": "GND", "type": "gnd"}]})
    s = client.post("/api/wiring/projects", headers=a, json={"title": "Z moją częścią", "nodes": [{"id": "n1", "part": "moj-x", "x": 0, "y": 0}]}).json()
    lst = {p["id"]: p for p in client.get("/api/wiring/my-parts", headers=a).json()}
    assert lst["moj-x"]["pins"] == 2 and [u["id"] for u in lst["moj-x"]["used_in"]] == [s["id"]] and lst["moj-x"]["category"] == "Moduł"
    assert client.get("/api/wiring/parts/batch", params={"ids": "moj-x"}).json()[0]["pins"][0]["id"] == "+5V"   # pin z „+” zachowany
    assert "moj-x" not in [p["id"] for p in client.get("/api/wiring/my-parts", headers=b).json()]
    assert client.get("/api/wiring/my-parts").status_code in (401, 403)
    assert client.delete("/api/wiring/parts/moj-x", headers=b).status_code == 404            # cudzej nie usunie
    assert client.delete("/api/wiring/parts/std-resistor", headers=a).status_code == 400
    assert client.delete("/api/wiring/parts/moj-x", headers=a).json() == {"ok": True}
    assert "moj-x" not in [p["id"] for p in client.get("/api/wiring/my-parts", headers=a).json()]
    assert client.get("/api/wiring/projects/" + s["id"], headers=a).json()["nodes"][0]["part"] == "moj-x"   # schemat bez zmian („Brak części”)
