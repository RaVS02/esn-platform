"""Profil publiczny i prywatność (v61, etap 1 społeczności) – plan w docs/SPOLECZNOSC.md.

Pola w `users`: bio, location, skills (JSON, lista tagów), links (JSON, [{label, url}]), profile_public, show_activity,
show_courses, allow_invites, profile_updated_at.

Zasady:
- profil jest widoczny dla innych TYLKO po włączeniu `profile_public` (domyślnie wyłączone);
- e-mail nigdy nie trafia do odpowiedzi publicznych;
- ukryty i nieistniejący profil dają tę samą odpowiedź 404 (bez wyliczania kont);
- właściciel i admin widzą profil zawsze (podgląd), z flagą `preview`.
"""
import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
import security_service

BIO_MAX, LOCATION_MAX, SKILLS_MAX, SKILL_LEN, LINKS_MAX, LABEL_LEN, URL_LEN = 300, 80, 8, 30, 4, 40, 300
URL_RE = re.compile(r"^https?://[^\s\"'<>`]{3,}$", re.I)
SKILL_RE = re.compile(r"^[\w .,+#/()\-–ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+$")
TOGGLES = ("profile_public", "show_activity", "show_courses", "allow_invites")
DDL = ("bio TEXT", "location VARCHAR(80)", "skills JSON", "links JSON",
       "profile_public BOOLEAN NOT NULL DEFAULT FALSE", "show_activity BOOLEAN NOT NULL DEFAULT TRUE",
       "show_courses BOOLEAN NOT NULL DEFAULT FALSE", "allow_invites BOOLEAN NOT NULL DEFAULT TRUE",
       "profile_updated_at TIMESTAMP")
NOT_FOUND = "Profil nie istnieje lub nie jest publiczny"
PAGE = 24
SORTS = ("active", "az", "za", "projects", "newest")


def _plain(s, n):
    s = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", str(s or "")).strip()
    return s[:n]


def clean_skills(v) -> list:
    items = v if isinstance(v, list) else re.split(r"[,;\n]", str(v or ""))
    out, seen = [], set()
    for it in items:
        t = re.sub(r"\s+", " ", _plain(it, SKILL_LEN))
        if not t or not SKILL_RE.match(t) or t.lower() in seen:
            continue
        seen.add(t.lower()); out.append(t)
        if len(out) >= SKILLS_MAX:
            break
    return out


def clean_links(v) -> list:
    out = []
    for it in (v if isinstance(v, list) else []):
        if not isinstance(it, dict):
            continue
        url = _plain(it.get("url"), URL_LEN)
        if not url:
            continue
        if not URL_RE.match(url):
            raise HTTPException(status_code=400, detail="Adres musi zaczynać się od http:// lub https://")
        out.append({"label": _plain(it.get("label"), LABEL_LEN), "url": url})
        if len(out) >= LINKS_MAX:
            break
    return out


def own_settings(u) -> dict:
    return {"login": u.login, "username": u.username, "avatar_path": u.avatar_path, "bio": u.bio or "", "location": u.location or "",
            "skills": u.skills or [], "links": u.links or [], **{k: bool(getattr(u, k)) for k in TOGGLES}}


def public_view(db: Session, u, viewer=None) -> dict:
    preview = not u.profile_public
    projects = db.query(models.Project).filter(models.Project.owner_id == u.id).order_by(models.Project.created_at.desc()).all()
    since = u.created_at.strftime("%Y-%m") if u.created_at else None
    # schematy publiczne = podpięte do projektów (projekty są publiczne); samodzielne schematy z Narzędzi zostają prywatne
    by_id = {p.id: p for p in projects}
    schemas = (db.query(models.WiringSchema).filter(models.WiringSchema.project_id.in_(list(by_id) or [0]))
               .order_by(models.WiringSchema.updated_at.desc()).all())
    def iso(d):
        return d.isoformat() if d else None
    activity = []
    if u.show_activity:
        activity = [{"type": "project", "at": iso(p.created_at), "title": p.title, "slug": p.slug} for p in projects[:20]]
        activity += [{"type": "schema", "at": iso(w.updated_at or w.created_at), "title": by_id[w.project_id].title, "slug": by_id[w.project_id].slug} for w in schemas[:20]]
        activity.sort(key=lambda a: a["at"] or "", reverse=True)
        activity = activity[:20]
    return {
        "login": u.login, "username": u.username, "avatar_path": u.avatar_path,
        "role": _role(u),
        "bio": u.bio or "", "location": u.location or "", "skills": u.skills or [], "links": u.links or [],
        "member_since": since, "allow_invites": bool(u.allow_invites), "show_activity": bool(u.show_activity),
        "stats": {"projects": len(projects), "schemas": len(schemas)},
        "projects": [{"id": p.id, "slug": p.slug, "title": p.title, "short_desc": p.short_desc, "status": p.status, "lang": p.lang,
                      "image_main": p.image_main, "is_official": bool(p.is_official),
                      "created_at": iso(p.created_at)} for p in projects[:24]],
        "schemas": [{"id": w.id, "title": w.title or by_id[w.project_id].title, "project_slug": by_id[w.project_id].slug,
                     "project_title": by_id[w.project_id].title, "parts": len((w.data or {}).get("nodes") or []),
                     "updated_at": iso(w.updated_at or w.created_at)} for w in schemas[:24]],
        "activity": activity,
        "preview": preview,
        "is_me": bool(viewer and viewer.id == u.id),
    }


def _role(u):
    return u.role if u.role in ("admin", "moderator") else "user"


def people_card(u, n_projects, last_project):
    acts = [d for d in (u.profile_updated_at, last_project, u.created_at) if d is not None]
    last = max((d.replace(tzinfo=None) for d in acts), default=None)
    return {"login": u.login, "username": u.username, "avatar_path": u.avatar_path, "role": _role(u), "bio": (u.bio or "")[:160],
            "location": u.location or "", "skills": u.skills or [], "allow_invites": bool(u.allow_invites),
            "projects": int(n_projects or 0), "member_since": u.created_at.strftime("%Y-%m") if u.created_at else None,
            "_last": last, "_created": u.created_at.replace(tzinfo=None) if u.created_at else datetime.min}


def search_people(db: Session, q="", skills=(), role="", invites=False, sort="active", page=1) -> dict:
    """Wyszukiwarka społeczności – tylko profile publiczne i niezablokowane. Filtrowanie w Pythonie (JSON umiejętności,
    niewielka liczba profili publicznych); przy dużej skali – indeks / tabela umiejętności."""
    counts = dict(db.query(models.Project.owner_id, func.count(models.Project.id)).group_by(models.Project.owner_id).all())
    lasts = dict(db.query(models.Project.owner_id, func.max(models.Project.created_at)).group_by(models.Project.owner_id).all())
    users = db.query(models.User).filter(models.User.profile_public.is_(True), models.User.is_banned.isnot(True)).all()
    cards = [people_card(u, counts.get(u.id), lasts.get(u.id)) for u in users]
    facet = {}
    for c in cards:
        for sk in c["skills"]:
            k = sk.lower(); f = facet.setdefault(k, {"name": sk, "count": 0}); f["count"] += 1
    ql = (q or "").strip().lower()[:80]
    want = [x.lower() for x in skills if x][:8]
    def ok(c):
        if ql and not any(ql in (v or "").lower() for v in (c["login"], c["username"], c["bio"], c["location"], " ".join(c["skills"]))):
            return False
        have = {x.lower() for x in c["skills"]}
        if any(w not in have for w in want):
            return False
        if role == "team" and c["role"] == "user":
            return False
        if invites and not c["allow_invites"]:
            return False
        return True
    res = [c for c in cards if ok(c)]
    sort = sort if sort in SORTS else "active"
    name = lambda c: ((c["username"] or c["login"]).lower(), c["login"].lower())
    if sort == "az": res.sort(key=name)
    elif sort == "za": res.sort(key=name, reverse=True)
    elif sort == "projects": res.sort(key=lambda c: (-c["projects"], name(c)))
    elif sort == "newest": res.sort(key=lambda c: c["_created"], reverse=True)
    else: res.sort(key=lambda c: (c["_last"] or datetime.min), reverse=True)
    page = max(1, int(page or 1)); total = len(res)
    items = res[(page - 1) * PAGE: page * PAGE]
    for c in items:
        c.pop("_last", None); c.pop("_created", None)
    return {"items": items, "total": total, "page": page, "pages": max(1, -(-total // PAGE)), "sort": sort,
            "skills": sorted(facet.values(), key=lambda f: (-f["count"], f["name"].lower()))[:16]}


def build_router(get_db, get_current_user, get_optional_user) -> APIRouter:
    def no_store(response: Response):     # odpowiedzi zależą od tego, kto pyta (podgląd właściciela / admina)
        response.headers["Cache-Control"] = "no-store"

    router = APIRouter(tags=["Profil publiczny i prywatność"], dependencies=[Depends(no_store)])

    @router.get("/api/users/me/public-profile")
    def get_mine(user=Depends(get_current_user)):
        return own_settings(user)

    @router.put("/api/users/me/public-profile")
    async def put_mine(request: Request, db: Session = Depends(get_db), user=Depends(get_current_user)):
        security_service.rate_limit(db, f"profile-save:{user.id}", 30, 3600)
        try:
            data = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Nieprawidłowe dane")
        if not isinstance(data, dict):
            raise HTTPException(status_code=400, detail="Nieprawidłowe dane")
        if "bio" in data:
            user.bio = _plain(data.get("bio"), BIO_MAX) or None
        if "location" in data:
            user.location = _plain(data.get("location"), LOCATION_MAX) or None
        if "skills" in data:
            user.skills = clean_skills(data.get("skills"))
        if "links" in data:
            user.links = clean_links(data.get("links"))
        for k in TOGGLES:
            if k in data:
                setattr(user, k, bool(data.get(k)))
        user.profile_updated_at = datetime.utcnow()
        db.commit()
        return own_settings(user)

    @router.get("/api/people")
    def people(request: Request, q: str = "", skills: str = "", role: str = "", invites: int = 0, sort: str = "active", page: int = 1,
               db: Session = Depends(get_db)):
        security_service.rate_limit(db, "people:" + security_service.client_ip(request), 240, 600)
        return search_people(db, q, [x.strip() for x in skills.split(",")], role, bool(invites), sort, page)

    @router.get("/api/u/{login}")
    def get_public(login: str, request: Request, db: Session = Depends(get_db), viewer=Depends(get_optional_user)):
        security_service.rate_limit(db, "profile-view:" + security_service.client_ip(request), 300, 600)
        u = db.query(models.User).filter(func.lower(models.User.login) == (login or "").lower()).first()
        can_preview = bool(viewer and u and (viewer.id == u.id or viewer.role == "admin"))
        if not u or (u.is_banned and not can_preview) or (not u.profile_public and not can_preview):
            raise HTTPException(status_code=404, detail=NOT_FOUND, headers={"Cache-Control": "no-store"})
        return public_view(db, u, viewer)

    return router
