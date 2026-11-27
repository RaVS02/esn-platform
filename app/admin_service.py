"""Dashboard administracji (v64, etap 1 społeczności) – plan w docs/SPOLECZNOSC.md („Dashboard administracji”).

Tylko rola admin. Dane zagregowane; e-maile wyłącznie na liście użytkowników. Każda akcja trafia do `admin_log`.
"""
import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session

import media_service
import models

DDL = ("last_login_at TIMESTAMP",)
PAGE = 25
ROLES = ("user", "moderator", "admin")


def _now():
    return datetime.utcnow()


def _aware(d):
    return d.replace(tzinfo=None) if d is not None and d.tzinfo else d


def _dir_size(path):
    total, files = 0, 0
    for root, _dirs, names in os.walk(path):
        for n in names:
            try:
                total += os.path.getsize(os.path.join(root, n)); files += 1
            except OSError:
                pass
    return total, files


def log(db, admin, action, target_user=None, target=None, note=None):
    db.add(models.AdminLog(admin_id=admin.id, action=action, target_user_id=target_user.id if target_user else None,
                           target=(target or (target_user.login if target_user else None) or "")[:120], note=(note or "")[:300] or None))


def overview(db: Session) -> dict:
    now = _now(); d7 = now - timedelta(days=7); d30 = now - timedelta(days=30)
    U = models.User
    q = db.query
    roles = dict(q(U.role, func.count(U.id)).group_by(U.role).all())
    # rejestracje dzień po dniu (30 dni) – created_at ma strefę, porównujemy po dacie
    per_day = {str(d): n for d, n in q(func.date(U.created_at), func.count(U.id)).filter(U.created_at >= d30.replace(tzinfo=timezone.utc)).group_by(func.date(U.created_at)).all()}
    days = [(now.date() - timedelta(days=i)) for i in range(29, -1, -1)]
    users = {
        "total": q(func.count(U.id)).scalar() or 0,
        "new7": q(func.count(U.id)).filter(U.created_at >= d7.replace(tzinfo=timezone.utc)).scalar() or 0,
        "new30": q(func.count(U.id)).filter(U.created_at >= d30.replace(tzinfo=timezone.utc)).scalar() or 0,
        "active7": q(func.count(U.id)).filter(U.last_login_at >= d7).scalar() or 0,
        "active30": q(func.count(U.id)).filter(U.last_login_at >= d30).scalar() or 0,
        "banned": q(func.count(U.id)).filter(U.is_banned.is_(True)).scalar() or 0,
        "locked": q(func.count(U.id)).filter(U.lockout_until > now.replace(tzinfo=timezone.utc)).scalar() or 0,
        "public": q(func.count(U.id)).filter(U.profile_public.is_(True)).scalar() or 0,
        "roles": {r: int(roles.get(r, 0)) for r in ROLES},
        "signups": [{"date": str(d), "n": int(per_day.get(str(d), 0))} for d in days],
    }
    KA = models.KnowledgeArticle
    content = {
        "projects": q(func.count(models.Project.id)).scalar() or 0,
        "projects_official": q(func.count(models.Project.id)).filter(models.Project.is_official.is_(True)).scalar() or 0,
        "components": q(func.count(models.OfficialComponent.id)).scalar() or 0,
        "articles": q(func.count(KA.id)).scalar() or 0,
        "articles_published": q(func.count(KA.id)).filter(KA.published.is_(True)).scalar() or 0,
        "articles_review": q(func.count(KA.id)).filter(KA.draft_state == "review").scalar() or 0,
        "schemas": q(func.count(models.WiringSchema.id)).scalar() or 0,
        "media": q(func.count(models.Media.id)).scalar() or 0,
        "resources": q(func.count(models.Resource.id)).scalar() or 0,
    }
    CM = models.ContactMessage
    moderation = {"messages": q(func.count(CM.id)).scalar() or 0, "unread": q(func.count(CM.id)).filter(or_(CM.is_read.is_(False), CM.is_read.is_(None))).scalar() or 0}
    storage = {}
    for sub in ("media", "files", "projects", "catalog", "avatars"):
        b, n = _dir_size(os.path.join(media_service.STATIC_ROOT, sub)); storage[sub] = {"bytes": b, "files": n}
    try:
        storage["db_bytes"] = int(db.execute(text("SELECT pg_database_size(current_database())")).scalar() or 0)
    except Exception:
        db.rollback(); storage["db_bytes"] = None
    today = now.date()
    ai = {"requests_today": int(q(func.coalesce(func.sum(U.ai_requests_today), 0)).filter(U.last_ai_request_date == today).scalar() or 0),
          "users_today": q(func.count(U.id)).filter(U.last_ai_request_date == today, U.ai_requests_today > 0).scalar() or 0,
          "own_keys": q(func.count(U.id)).filter(U.ai_key_enc.isnot(None)).scalar() or 0}
    return {"users": users, "content": content, "moderation": moderation, "storage": storage, "ai": ai, "security": security(db), "generated_at": now.isoformat() + "Z"}


def security(db: Session) -> dict:
    """Bieżące okna limitów prób (rate_limits) z ostatniej doby, najwięcej prób na górze; zablokowane konta."""
    import time
    since = int(time.time()) - 86400
    rows = db.query(models.RateLimit).filter(models.RateLimit.window_start >= since).order_by(models.RateLimit.count.desc()).limit(12).all()
    now = _now().replace(tzinfo=timezone.utc)
    locked = db.query(models.User).filter(or_(models.User.lockout_until > now, models.User.is_banned.is_(True))).order_by(models.User.id.desc()).limit(20).all()
    return {"limits": [{"key": r.key[:80], "count": r.count, "since": datetime.utcfromtimestamp(r.window_start).isoformat() + "Z"} for r in rows],
            "blocked": [{"id": u.id, "login": u.login, "banned": bool(u.is_banned), "ban_reason": u.ban_reason,
                         "banned_until": u.banned_until.isoformat() if u.banned_until else None,
                         "lockout_until": u.lockout_until.isoformat() if u.lockout_until else None} for u in locked]}


def user_row(u, n_projects):
    return {"id": u.id, "login": u.login, "username": u.username, "email": u.email, "role": u.role or "user",
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "last_login_at": u.last_login_at.isoformat() + "Z" if u.last_login_at else None,
            "banned": bool(u.is_banned), "ban_reason": u.ban_reason, "banned_until": u.banned_until.isoformat() if u.banned_until else None,
            "locked": bool(u.lockout_until and _aware(u.lockout_until) > _now()), "public": bool(u.profile_public), "projects": int(n_projects or 0)}


def build_router(get_db, require_admin) -> APIRouter:
    def no_store(response: Response):
        response.headers["Cache-Control"] = "no-store"
    r = APIRouter(prefix="/api/admin", tags=["Dashboard administracji"], dependencies=[Depends(no_store)])

    def target(db, user_id, admin):
        u = db.query(models.User).filter(models.User.id == user_id).first()
        if not u:
            raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")
        if u.id == admin.id:
            raise HTTPException(status_code=400, detail="Nie możesz wykonać tej akcji na własnym koncie")
        return u

    @r.get("/overview")
    def get_overview(db: Session = Depends(get_db), admin=Depends(require_admin)):
        return overview(db)

    @r.get("/users")
    def users(q: str = "", role: str = "", status: str = "", sort: str = "newest", page: int = 1, db: Session = Depends(get_db), admin=Depends(require_admin)):
        U = models.User
        qs = db.query(U)
        if q.strip():
            like = "%" + q.strip()[:80].replace("%", "").replace("_", r"\_") + "%"
            qs = qs.filter(or_(U.login.ilike(like), U.username.ilike(like), U.email.ilike(like)))
        if role in ROLES:
            qs = qs.filter(U.role == role)
        if status == "banned":
            qs = qs.filter(U.is_banned.is_(True))
        elif status == "locked":
            qs = qs.filter(U.lockout_until > _now().replace(tzinfo=timezone.utc))
        elif status == "public":
            qs = qs.filter(U.profile_public.is_(True))
        order = {"newest": U.id.desc(), "oldest": U.id.asc(), "az": func.lower(U.login).asc(), "za": func.lower(U.login).desc(),
                 "login": U.last_login_at.desc().nullslast()}.get(sort, U.id.desc())
        total = qs.count(); page = max(1, page)
        rows = qs.order_by(order).offset((page - 1) * PAGE).limit(PAGE).all()
        counts = dict(db.query(models.Project.owner_id, func.count(models.Project.id)).filter(models.Project.owner_id.in_([u.id for u in rows] or [0])).group_by(models.Project.owner_id).all())
        return {"items": [user_row(u, counts.get(u.id)) for u in rows], "total": total, "page": page, "pages": max(1, -(-total // PAGE))}

    @r.post("/users/{user_id}/ban")
    async def ban(user_id: int, request: Request, db: Session = Depends(get_db), admin=Depends(require_admin)):
        data = await request.json() if (await request.body()) else {}
        u = target(db, user_id, admin)
        days = data.get("days")
        reason = str(data.get("reason") or "").strip()[:255] or None
        u.is_banned = True; u.ban_reason = reason
        u.banned_until = (datetime.now(timezone.utc) + timedelta(days=int(days))) if days else None
        log(db, admin, "ban", u, note=(f"{days} dni" if days else "bezterminowo") + (f" – {reason}" if reason else ""))
        db.commit()
        return user_row(u, 0)

    @r.post("/users/{user_id}/unban")
    def unban(user_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
        u = target(db, user_id, admin)
        u.is_banned = False; u.banned_until = None; u.ban_reason = None
        log(db, admin, "unban", u); db.commit()
        return user_row(u, 0)

    @r.post("/users/{user_id}/unlock")
    def unlock(user_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
        u = db.query(models.User).filter(models.User.id == user_id).first()
        if not u:
            raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")
        u.lockout_until = None; u.failed_attempts = 0
        log(db, admin, "unlock", u); db.commit()
        return user_row(u, 0)

    @r.put("/users/{user_id}/role")
    async def role(user_id: int, request: Request, db: Session = Depends(get_db), admin=Depends(require_admin)):
        data = await request.json()
        new = (data or {}).get("role")
        if new not in ROLES:
            raise HTTPException(status_code=400, detail="Nieprawidłowa rola")
        u = target(db, user_id, admin)
        old = u.role or "user"; u.role = new
        log(db, admin, "role", u, note=f"{old} → {new}"); db.commit()
        return user_row(u, 0)

    @r.get("/messages")
    def messages(unread: int = 0, db: Session = Depends(get_db), admin=Depends(require_admin)):
        CM = models.ContactMessage
        qs = db.query(CM)
        if unread:
            qs = qs.filter(or_(CM.is_read.is_(False), CM.is_read.is_(None)))
        rows = qs.order_by(CM.id.desc()).limit(50).all()
        return [{"id": m.id, "name": m.name, "email": m.email, "subject": m.subject, "message": m.message,
                 "created_at": m.created_at.isoformat() if m.created_at else None, "is_read": bool(m.is_read)} for m in rows]

    @r.put("/messages/{msg_id}/read")
    async def message_read(msg_id: int, request: Request, db: Session = Depends(get_db), admin=Depends(require_admin)):
        data = await request.json() if (await request.body()) else {}
        m = db.query(models.ContactMessage).filter(models.ContactMessage.id == msg_id).first()
        if not m:
            raise HTTPException(status_code=404, detail="Zgłoszenie nie istnieje")
        m.is_read = bool(data.get("read", True))
        log(db, admin, "message-read" if m.is_read else "message-unread", target=f"#{m.id} {m.subject or ''}"); db.commit()
        return {"id": m.id, "is_read": m.is_read}

    @r.get("/log")
    def admin_log(db: Session = Depends(get_db), admin=Depends(require_admin)):
        rows = db.query(models.AdminLog).order_by(models.AdminLog.id.desc()).limit(100).all()
        names = dict(db.query(models.User.id, models.User.login).filter(models.User.id.in_([x.admin_id for x in rows if x.admin_id] or [0])).all())
        return [{"id": x.id, "admin": names.get(x.admin_id, "—"), "action": x.action, "target": x.target, "note": x.note,
                 "created_at": x.created_at.isoformat() + "Z" if x.created_at else None} for x in rows]

    return r
