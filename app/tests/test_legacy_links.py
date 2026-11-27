"""v55: datasheet komponentu i repozytorium projektu tylko w Zasobach – migracja dawnych kolumn i zgodność API."""
import os
import sys
import uuid

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("JWT_SECRET_KEY", "test")
os.environ["KNOWLEDGE_SEED"] = "0"

from fastapi.testclient import TestClient    # noqa: E402

import auth             # noqa: E402
import content_service  # noqa: E402
import main             # noqa: E402
import models           # noqa: E402
from database import SessionLocal  # noqa: E402

client = TestClient(main.app)
DS = "https://example.com/ds-" + uuid.uuid4().hex[:6] + ".pdf"
GH = "https://github.com/example/repo-" + uuid.uuid4().hex[:6]


@pytest.fixture(scope="module")
def ctx():
    db = SessionLocal()
    login = "leg-" + uuid.uuid4().hex[:6]
    u = models.User(username=login, login=login, email=login + "@example.test", hashed_password="x", role="admin")
    db.add(u); db.commit()
    c = models.OfficialComponent(name="LEG-" + login, datasheet_url=DS)
    p = models.Project(title="Leg " + login, slug="leg-" + login, owner_id=u.id, github_url=GH, short_desc="x", tags="t")
    db.add_all([c, p]); db.commit()
    out = {"uid": u.id, "cid": c.id, "pid": p.id,
           "h": {"Authorization": "Bearer " + auth.create_access_token(data={"sub": login, "role": "admin", "user_id": u.id})}}
    db.close()
    yield out
    db = SessionLocal()
    db.query(models.Resource).filter(models.Resource.owner_type == "component", models.Resource.owner_id == out["cid"]).delete()
    db.query(models.Resource).filter(models.Resource.owner_type == "project", models.Resource.owner_id == out["pid"]).delete()
    db.query(models.Project).filter(models.Project.id == out["pid"]).delete()
    db.query(models.OfficialComponent).filter(models.OfficialComponent.id == out["cid"]).delete()
    db.query(models.User).filter(models.User.id == out["uid"]).delete()
    db.commit(); db.close()


def test_migration_moves_links_to_resources(ctx):
    content_service.migrate_legacy_links(SessionLocal)
    content_service.migrate_legacy_links(SessionLocal)          # idempotentnie – bez duplikatów
    r = client.get(f"/api/resources?owner_type=component&owner_id={ctx['cid']}").json()
    assert [(x["rtype"], x["url"], x["label"]) for x in r] == [("datasheet", DS, "Datasheet")]
    r = client.get(f"/api/resources?owner_type=project&owner_id={ctx['pid']}").json()
    assert [(x["rtype"], x["url"], x["label"]) for x in r] == [("repo", GH, "GitHub")]
    db = SessionLocal()
    assert db.get(models.OfficialComponent, ctx["cid"]).datasheet_url is None
    assert db.get(models.Project, ctx["pid"]).github_url is None
    db.close()


def test_catalog_api_still_returns_datasheet_from_resources(ctx):
    assert client.get(f"/api/catalog/{ctx['cid']}").json()["datasheet_url"] == DS      # magazyn i schematy dalej to dostają


def test_old_client_datasheet_goes_to_resources(ctx):
    url2 = "https://example.com/second.pdf"
    assert client.put(f"/api/catalog/{ctx['cid']}", json={"datasheet_url": url2}, headers=ctx["h"]).status_code == 200
    urls = [x["url"] for x in client.get(f"/api/resources?owner_type=component&owner_id={ctx['cid']}").json()]
    assert urls[0] == url2 and DS in urls                   # nowy link na początku listy
    assert client.get(f"/api/catalog/{ctx['cid']}").json()["datasheet_url"] == url2


def test_project_update_without_github_keeps_resources(ctx):
    r = client.put(f"/api/projects/{ctx['pid']}", json={"title": "Leg upd", "short_desc": "x", "tags": "t"}, headers=ctx["h"])
    assert r.status_code == 200, r.text
    urls = [x["url"] for x in client.get(f"/api/resources?owner_type=project&owner_id={ctx['pid']}").json()]
    assert urls == [GH]
