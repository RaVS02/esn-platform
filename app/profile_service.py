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
    return {
        "login": u.login, "username": u.username, "avatar_path": u.avatar_path,
        "role": u.role if u.role in ("admin", "moderator") else "user",
        "bio": u.bio or "", "location": u.location or "", "skills": u.skills or [], "links": u.links or [],
        "member_since": since, "allow_invites": bool(u.allow_invites), "show_activity": bool(u.show_activity),
        "stats": {"projects": len(projects)},
        "projects": [{"id": p.id, "slug": p.slug, "title": p.title, "short_desc": p.short_desc, "status": p.status, "lang": p.lang,
                      "image_main": p.image_main, "is_official": bool(p.is_official),
                      "created_at": p.created_at.isoformat() if p.created_at else None} for p in projects[:24]],
        "preview": preview,
        "is_me": bool(viewer and viewer.id == u.id),
    }


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

    @router.get("/api/u/{login}")
    def get_public(login: str, request: Request, db: Session = Depends(get_db), viewer=Depends(get_optional_user)):
        security_service.rate_limit(db, "profile-view:" + security_service.client_ip(request), 300, 600)
        u = db.query(models.User).filter(func.lower(models.User.login) == (login or "").lower()).first()
        can_preview = bool(viewer and u and (viewer.id == u.id or viewer.role == "admin"))
        if not u or (u.is_banned and not can_preview) or (not u.profile_public and not can_preview):
            raise HTTPException(status_code=404, detail=NOT_FOUND, headers={"Cache-Control": "no-store"})
        return public_view(db, u, viewer)

    return router
