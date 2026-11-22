"""Wiedza: niezbędniki, poradniki, artykuły i kursy.

Model treści
  • kind: essential (Niezbędnik) | guide (Poradnik) | article (Artykuł) | lesson (Lekcja kursu).
  • Lekcje należą do kursu (knowledge_courses) i są uporządkowane polem `position`.
  • Każda treść ma poziom: basic → intermediate → advanced (lista pokazuje je „od podstaw”).
  • Treść to markdown z blokami (:::summary, :::warn, …) – renderowany po stronie przeglądarki
    (marked + DOMPurify). Animacje/grafiki z JavaScriptem to „widgety” w izolowanym iframe (sandbox).

Role i przepływ zatwierdzania
  • admin     – tworzy, edytuje, zatwierdza/odrzuca, publikuje bezpośrednio, wycofuje, usuwa, zarządza kursami.
  • moderator – (redaktor) tworzy i edytuje WŁASNE treści, wysyła do przeglądu; nie publikuje.
  • reszta    – czyta wyłącznie opublikowane treści.
  • Niepublikowana treść: edycje zapisują się wprost w kolumnach. Opublikowana: edycje trafiają do `draft`,
    a czytelnicy widzą starą wersję, dopóki admin nie zatwierdzi zmian.
  • Stan zmian (draft_state): draft → review → (approve → none) | rejected (z komentarzem).
"""
import re
import unicodedata
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

import models

KINDS = {"essential": "Niezbędnik", "guide": "Poradnik", "article": "Artykuł", "lesson": "Lekcja kursu"}
LEVELS = {"basic": ("Podstawy", 1), "intermediate": ("Średni", 2), "advanced": ("Zaawansowany", 3)}
STAFF = ("admin", "moderator")

LIM = {"title": 150, "summary": 400, "body": 200_000, "tags": 8, "tag_len": 30,
       "widgets": 8, "widget_bytes": 60_000, "widgets_total": 200_000, "note": 500}
WIDGET_NAME = re.compile(r"^[a-z0-9][a-z0-9_-]{0,29}$")
WIDGET_REF = re.compile(r"^:::[ \t]*widget[ \t]+([A-Za-z0-9_-]+)", re.M)
CONTENT_KEYS = ("kind", "course_id", "position", "title", "summary", "body", "level", "tags", "widgets")

_PL = str.maketrans("ąćęłńóśźżĄĆĘŁŃÓŚŹŻ", "acelnoszzACELNOSZZ")


# ─────────────────────────────────────────────────────────────────────────────
# Pomocnicze
# ─────────────────────────────────────────────────────────────────────────────
def slugify(text: str) -> str:
    t = unicodedata.normalize("NFKD", (text or "").translate(_PL)).encode("ascii", "ignore").decode()
    t = re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")
    return (t or "tresc")[:100].strip("-") or "tresc"


def unique_slug(db: Session, model, base: str) -> str:
    slug, n = base, 2
    while db.query(model.id).filter(model.slug == slug).first():
        slug = f"{base}-{n}"
        n += 1
    return slug


def reading_minutes(body: str) -> int:
    return max(1, round(len(re.findall(r"\w+", body or "")) / 180))


def level_info(level: str):
    label, rank = LEVELS.get(level, LEVELS["basic"])
    return label, rank


class ArticleIn(BaseModel):
    kind: str = "article"
    title: str = Field("", max_length=400)
    summary: str = Field("", max_length=2000)
    body: str = Field("", max_length=400_000)
    level: str = "basic"
    tags: List[str] = []
    widgets: Dict[str, str] = {}
    course_id: Optional[int] = None
    position: int = 0


class CourseIn(BaseModel):
    title: str = Field("", max_length=400)
    summary: str = Field("", max_length=2000)
    level: str = "basic"
    position: int = 0
    published: bool = False


class NoteIn(BaseModel):
    note: str = Field("", max_length=1000)


class PublishIn(BaseModel):
    content: Optional[ArticleIn] = None
    note: str = Field("", max_length=1000)


def clean_content(db: Session, data: ArticleIn) -> dict:
    """Waliduje i normalizuje treść (zawsze po stronie serwera, niezależnie od formularza)."""
    if data.kind not in KINDS:
        raise HTTPException(400, "Nieprawidłowy typ treści")
    if data.level not in LEVELS:
        raise HTTPException(400, "Nieprawidłowy poziom")
    title = (data.title or "").strip()
    if not title:
        raise HTTPException(400, "Tytuł jest wymagany")
    if len(title) > LIM["title"]:
        raise HTTPException(400, f"Tytuł może mieć maksymalnie {LIM['title']} znaków")
    summary = (data.summary or "").strip()
    if len(summary) > LIM["summary"]:
        raise HTTPException(400, f"Opis może mieć maksymalnie {LIM['summary']} znaków")
    body = data.body or ""
    if len(body) > LIM["body"]:
        raise HTTPException(400, f"Treść jest za długa (limit {LIM['body'] // 1000} KB)")

    tags, seen = [], set()
    for t in data.tags or []:
        t = re.sub(r"\s+", " ", str(t)).strip().lower()
        if t and t not in seen:
            if len(t) > LIM["tag_len"]:
                raise HTTPException(400, f"Tag może mieć maksymalnie {LIM['tag_len']} znaków")
            seen.add(t)
            tags.append(t)
    if len(tags) > LIM["tags"]:
        raise HTTPException(400, f"Maksymalnie {LIM['tags']} tagów")

    widgets = {}
    if len(data.widgets or {}) > LIM["widgets"]:
        raise HTTPException(400, f"Maksymalnie {LIM['widgets']} widgetów na treść")
    total = 0
    for name, code in (data.widgets or {}).items():
        if not WIDGET_NAME.match(name or ""):
            raise HTTPException(400, f"Nazwa widgetu „{name}” jest nieprawidłowa (a–z, 0–9, _ oraz -, do 30 znaków)")
        code = code or ""
        size = len(code.encode("utf-8"))
        if size > LIM["widget_bytes"]:
            raise HTTPException(400, f"Widget „{name}” jest za duży (limit {LIM['widget_bytes'] // 1000} KB)")
        total += size
        widgets[name] = code
    if total > LIM["widgets_total"]:
        raise HTTPException(400, "Widgety razem są za duże")

    course_id = data.course_id
    if data.kind == "lesson":
        if not course_id or not db.query(models.KnowledgeCourse.id).filter(models.KnowledgeCourse.id == course_id).first():
            raise HTTPException(400, "Lekcja musi należeć do istniejącego kursu")
    else:
        course_id = None
    return {"kind": data.kind, "course_id": course_id, "position": max(-9999, min(9999, int(data.position or 0))),
            "title": title, "summary": summary, "body": body, "level": data.level, "tags": tags, "widgets": widgets}


def live_content(a: models.KnowledgeArticle) -> dict:
    return {"kind": a.kind, "course_id": a.course_id, "position": a.position or 0, "title": a.title, "summary": a.summary or "",
            "body": a.body or "", "level": a.level, "tags": list(a.tags or []), "widgets": dict(a.widgets or {})}


def effective_content(a: models.KnowledgeArticle) -> dict:
    return dict(a.draft) if a.draft else live_content(a)


def apply_live(a: models.KnowledgeArticle, c: dict):
    for k in CONTENT_KEYS:
        setattr(a, k, c[k])
    a.reading_min = reading_minutes(c["body"])


def check_ready(c: dict):
    """Wymagania przed wysłaniem do przeglądu."""
    if len((c.get("body") or "").strip()) < 20:
        raise HTTPException(400, "Treść jest pusta – uzupełnij ją przed wysłaniem do przeglądu")
    missing = sorted({n for n in WIDGET_REF.findall(c.get("body") or "") if n not in (c.get("widgets") or {})})
    if missing:
        raise HTTPException(400, "Treść odwołuje się do nieistniejących widgetów: " + ", ".join(missing))


def status_label(a: models.KnowledgeArticle) -> str:
    st = a.draft_state or "none"
    if not a.published:
        return {"draft": "Szkic", "review": "Do przeglądu", "rejected": "Odrzucone"}.get(st, "Szkic")
    if st == "none":
        return "Opublikowane"
    return "Opublikowane · zmiany: " + {"draft": "szkic", "review": "do przeglądu", "rejected": "odrzucone"}.get(st, st)


def is_staff(u) -> bool:
    return getattr(u, "role", None) in STAFF


def is_admin(u) -> bool:
    return getattr(u, "role", None) == "admin"


def can_edit(u, a) -> bool:
    return is_admin(u) or (getattr(u, "role", None) == "moderator" and a.author_id == u.id)


# ─────────────────────────────────────────────────────────────────────────────
# Serializacja
# ─────────────────────────────────────────────────────────────────────────────
def item_card(a: models.KnowledgeArticle, course: Optional[models.KnowledgeCourse] = None) -> dict:
    lab, rank = level_info(a.level)
    return {"id": a.id, "slug": a.slug, "kind": a.kind, "kind_label": KINDS.get(a.kind, a.kind), "title": a.title, "summary": a.summary or "",
            "level": a.level, "level_label": lab, "level_rank": rank, "tags": list(a.tags or []), "reading_min": a.reading_min or 1,
            "position": a.position or 0, "course": ({"slug": course.slug, "title": course.title} if course else None),
            "published_at": a.published_at.isoformat() if a.published_at else None,
            "updated_at": a.updated_at.isoformat() if a.updated_at else None}


def seed_pilot(SessionLocal) -> str:
    """Wstawia przykładowe treści (pilotaż), gdy baza wiedzy jest pusta. Wyłączane zmienną KNOWLEDGE_SEED=0."""
    import os
    if os.getenv("KNOWLEDGE_SEED", "1") == "0":
        return "wyłączone"
    db = SessionLocal()
    try:
        if db.query(models.KnowledgeArticle.id).first() or db.query(models.KnowledgeCourse.id).first():
            return "pominięto (baza wiedzy nie jest pusta)"
        from knowledge_pilot import COURSES, ARTICLES
        courses = {}
        for c in COURSES:
            row = models.KnowledgeCourse(slug=c["slug"], title=c["title"], summary=c["summary"], level=c["level"],
                                         position=c.get("position", 0), published=True)
            db.add(row)
            db.flush()
            courses[c["slug"]] = row
        now = datetime.utcnow()
        for i, a in enumerate(ARTICLES):
            course = courses.get(a.get("course"))
            row = models.KnowledgeArticle(
                slug=a["slug"], kind=a["kind"], course_id=course.id if course else None, position=a.get("position", i),
                title=a["title"], summary=a["summary"], body=a["body"], level=a["level"], tags=a.get("tags", []),
                widgets=a.get("widgets", {}), reading_min=reading_minutes(a["body"]), published=True, published_at=now,
                draft=None, draft_state="none", author_id=None)
            db.add(row)
        db.commit()
        return f"dodano {len(COURSES)} kurs(y) i {len(ARTICLES)} treści"
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Router
# ─────────────────────────────────────────────────────────────────────────────
def build_router(get_db, get_current_user) -> APIRouter:
    router = APIRouter(tags=["Wiedza"])
    K, C, R = models.KnowledgeArticle, models.KnowledgeCourse, models.KnowledgeReview

    def require_staff(user=Depends(get_current_user)):
        if not is_staff(user):
            raise HTTPException(403, "Brak uprawnień redaktora")
        return user

    def require_admin(user=Depends(get_current_user)):
        if not is_admin(user):
            raise HTTPException(403, "Wymagane uprawnienia administratora")
        return user

    def log(db, a, user, action, note=None):
        db.add(R(article_id=a.id, user_id=getattr(user, "id", None), action=action, note=(note or None) and note[:LIM["note"]]))

    def get_or_404(db, article_id) -> models.KnowledgeArticle:
        a = db.query(K).filter(K.id == article_id).first()
        if not a:
            raise HTTPException(404, "Nie znaleziono treści")
        return a

    def course_map(db, ids):
        ids = [i for i in set(ids) if i]
        return {c.id: c for c in db.query(C).filter(C.id.in_(ids)).all()} if ids else {}

    def sort_key(card):
        return (card["level_rank"], (card["course"] or {}).get("title", ""), card["position"], card["title"].lower())

    # ── publiczne ────────────────────────────────────────────────────────────
    @router.get("/api/knowledge/meta")
    def meta():
        return {"kinds": KINDS, "levels": {k: v[0] for k, v in LEVELS.items()}, "limits": LIM}

    @router.get("/api/knowledge/items")
    def list_items(kind: str = "", level: str = "", q: str = "", db: Session = Depends(get_db)):
        pub_courses = {c.id: c for c in db.query(C).filter(C.published.is_(True)).all()}
        qry = db.query(K).filter(K.published.is_(True))
        if kind and kind in KINDS:
            qry = qry.filter(K.kind == kind)
        elif not q:
            qry = qry.filter(K.kind != "lesson")
        if level in LEVELS:
            qry = qry.filter(K.level == level)
        q = (q or "").strip()[:80]
        if q:
            like = f"%{q.lower()}%"
            from sqlalchemy import func
            qry = qry.filter(or_(func.lower(K.title).like(like), func.lower(K.summary).like(like), func.lower(K.body).like(like)))
        out = []
        for a in qry.all():
            if a.kind == "lesson" and a.course_id not in pub_courses:
                continue
            out.append(item_card(a, pub_courses.get(a.course_id)))
        if q:   # tagi: dopasowanie po tagu (JSON) robimy w Pythonie
            ql = q.lower()
            have = {c["id"] for c in out}
            for a in db.query(K).filter(K.published.is_(True)).all():
                if a.id not in have and ql in [t.lower() for t in (a.tags or [])] and (a.kind != "lesson" or a.course_id in pub_courses) \
                        and (not kind or a.kind == kind) and (level not in LEVELS or a.level == level):
                    out.append(item_card(a, pub_courses.get(a.course_id)))
        out.sort(key=sort_key)
        return out

    def course_card(c, lessons):
        lab, rank = level_info(c.level)
        return {"id": c.id, "slug": c.slug, "title": c.title, "summary": c.summary or "", "level": c.level, "level_label": lab,
                "level_rank": rank, "lessons": len(lessons), "reading_min": sum((l.reading_min or 1) for l in lessons)}

    def published_lessons(db, course_id):
        return db.query(K).filter(K.course_id == course_id, K.kind == "lesson", K.published.is_(True)).order_by(K.position, K.id).all()

    @router.get("/api/knowledge/courses")
    def list_courses(db: Session = Depends(get_db)):
        out = []
        for c in db.query(C).filter(C.published.is_(True)).order_by(C.position, C.id).all():
            out.append(course_card(c, published_lessons(db, c.id)))
        out.sort(key=lambda x: x["level_rank"])
        return out

    @router.get("/api/knowledge/courses/{slug}")
    def get_course(slug: str, db: Session = Depends(get_db)):
        c = db.query(C).filter(C.slug == slug, C.published.is_(True)).first()
        if not c:
            raise HTTPException(404, "Nie znaleziono kursu")
        lessons = published_lessons(db, c.id)
        d = course_card(c, lessons)
        d["items"] = [item_card(l, c) for l in lessons]
        return d

    @router.get("/api/knowledge/items/{slug}")
    def get_item(slug: str, db: Session = Depends(get_db)):
        a = db.query(K).filter(K.slug == slug, K.published.is_(True)).first()
        if not a:
            raise HTTPException(404, "Nie znaleziono treści")
        course = db.query(C).filter(C.id == a.course_id).first() if a.course_id else None
        if a.kind == "lesson" and (not course or not course.published):
            raise HTTPException(404, "Nie znaleziono treści")
        d = item_card(a, course)
        d.update({"body": a.body or "", "widgets": dict(a.widgets or {}), "prev": None, "next": None})
        if a.author_id:
            u = db.query(models.User).filter(models.User.id == a.author_id).first()
            d["author"] = u.username if u else None
        if course:
            ls = published_lessons(db, course.id)
            ids = [l.id for l in ls]
            if a.id in ids:
                i = ids.index(a.id)
                if i > 0:
                    d["prev"] = {"slug": ls[i - 1].slug, "title": ls[i - 1].title}
                if i < len(ls) - 1:
                    d["next"] = {"slug": ls[i + 1].slug, "title": ls[i + 1].title}
                d["lesson_no"], d["lesson_total"] = i + 1, len(ls)
        return d

    # ── redakcja ─────────────────────────────────────────────────────────────
    def editor_row(a, db, users=None, courses=None):
        c = effective_content(a)
        author = None
        if a.author_id:
            u = (users or {}).get(a.author_id) or db.query(models.User).filter(models.User.id == a.author_id).first()
            author = u.username if u else None
        return {"id": a.id, "slug": a.slug, "kind": c["kind"], "kind_label": KINDS.get(c["kind"], c["kind"]), "title": c["title"],
                "level": c["level"], "published": bool(a.published), "state": a.draft_state or "none", "status": status_label(a),
                "has_pending": bool(a.draft), "author": author, "author_id": a.author_id, "review_note": a.review_note or "",
                "course_id": c["course_id"], "position": c["position"],
                "updated_at": a.updated_at.isoformat() if a.updated_at else None}

    @router.get("/api/knowledge/editor/items")
    def editor_list(db: Session = Depends(get_db), user=Depends(require_staff)):
        qry = db.query(K)
        if not is_admin(user):
            qry = qry.filter(K.author_id == user.id)
        rows = qry.order_by(K.updated_at.desc()).all()
        users = {u.id: u for u in db.query(models.User).filter(models.User.id.in_([r.author_id for r in rows if r.author_id] or [0])).all()}
        return [editor_row(a, db, users) for a in rows]

    @router.get("/api/knowledge/editor/queue")
    def editor_queue(db: Session = Depends(get_db), user=Depends(require_admin)):
        rows = db.query(K).filter(K.draft_state == "review").order_by(K.updated_at).all()
        return [editor_row(a, db) for a in rows]

    @router.get("/api/knowledge/editor/items/{article_id}")
    def editor_get(article_id: int, db: Session = Depends(get_db), user=Depends(require_staff)):
        a = get_or_404(db, article_id)
        if not can_edit(user, a):
            raise HTTPException(403, "Możesz edytować tylko własne treści")
        row = editor_row(a, db)
        row["content"] = effective_content(a)
        row["live_title"] = a.title
        row["history"] = [{"action": h.action, "note": h.note or "", "at": h.created_at.isoformat(),
                           "user": (db.query(models.User.username).filter(models.User.id == h.user_id).scalar() if h.user_id else None)}
                          for h in db.query(R).filter(R.article_id == a.id).order_by(R.id.desc()).limit(15).all()]
        return row

    @router.post("/api/knowledge/editor/items")
    def editor_create(data: ArticleIn, db: Session = Depends(get_db), user=Depends(require_staff)):
        c = clean_content(db, data)
        a = K(slug=unique_slug(db, K, slugify(c["title"])), published=False, draft_state="draft", author_id=user.id)
        apply_live(a, c)
        db.add(a)
        db.flush()
        log(db, a, user, "create")
        db.commit()
        db.refresh(a)
        return editor_row(a, db)

    @router.put("/api/knowledge/editor/items/{article_id}")
    def editor_save(article_id: int, data: ArticleIn, db: Session = Depends(get_db), user=Depends(require_staff)):
        a = get_or_404(db, article_id)
        if not can_edit(user, a):
            raise HTTPException(403, "Możesz edytować tylko własne treści")
        if a.draft_state == "review" and not is_admin(user):
            raise HTTPException(409, "Treść czeka na przegląd – poczekaj na decyzję administratora")
        c = clean_content(db, data)
        if a.published:
            a.draft = c                                   # nowy słownik → SQLAlchemy zauważy zmianę
        else:
            apply_live(a, c)
            a.draft = None
        if not (is_admin(user) and a.draft_state == "review"):
            a.draft_state = "draft"
            a.review_note = None
        a.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(a)
        return editor_row(a, db)

    @router.post("/api/knowledge/editor/items/{article_id}/submit")
    def editor_submit(article_id: int, db: Session = Depends(get_db), user=Depends(require_staff)):
        a = get_or_404(db, article_id)
        if not can_edit(user, a):
            raise HTTPException(403, "Możesz edytować tylko własne treści")
        if a.draft_state == "none" and a.published:
            raise HTTPException(400, "Brak zmian do wysłania")
        check_ready(effective_content(a))
        a.draft_state = "review"
        a.review_note = None
        a.updated_at = datetime.utcnow()
        log(db, a, user, "submit")
        db.commit()
        return editor_row(a, db)

    def approve(db, a, user, note=None, action="approve"):
        c = effective_content(a)
        check_ready(c)
        apply_live(a, c)
        a.draft = None
        a.draft_state = "none"
        a.review_note = None
        a.published = True
        a.published_at = a.published_at or datetime.utcnow()
        a.reviewed_by, a.reviewed_at = user.id, datetime.utcnow()
        a.updated_at = datetime.utcnow()
        log(db, a, user, action, note)

    @router.post("/api/knowledge/editor/items/{article_id}/approve")
    def editor_approve(article_id: int, data: NoteIn = NoteIn(), db: Session = Depends(get_db), user=Depends(require_admin)):
        a = get_or_404(db, article_id)
        if a.draft_state != "review":
            raise HTTPException(400, "Ta treść nie czeka na przegląd")
        approve(db, a, user, data.note)
        db.commit()
        return editor_row(a, db)

    @router.post("/api/knowledge/editor/items/{article_id}/publish")
    def editor_publish(article_id: int, data: PublishIn = PublishIn(), db: Session = Depends(get_db), user=Depends(require_admin)):
        """Admin: zapisuje (opcjonalnie) i publikuje od razu, z pominięciem kolejki."""
        a = get_or_404(db, article_id)
        if data.content is not None:
            c = clean_content(db, data.content)
            if a.published:
                a.draft = c
            else:
                apply_live(a, c)
        approve(db, a, user, data.note, "publish")
        db.commit()
        return editor_row(a, db)

    @router.post("/api/knowledge/editor/items/{article_id}/reject")
    def editor_reject(article_id: int, data: NoteIn, db: Session = Depends(get_db), user=Depends(require_admin)):
        a = get_or_404(db, article_id)
        if a.draft_state != "review":
            raise HTTPException(400, "Ta treść nie czeka na przegląd")
        note = (data.note or "").strip()
        if not note:
            raise HTTPException(400, "Podaj powód odrzucenia – redaktor zobaczy go przy treści")
        a.draft_state = "rejected"
        a.review_note = note[:LIM["note"]]
        a.reviewed_by, a.reviewed_at = user.id, datetime.utcnow()
        log(db, a, user, "reject", note)
        db.commit()
        return editor_row(a, db)

    @router.post("/api/knowledge/editor/items/{article_id}/unpublish")
    def editor_unpublish(article_id: int, db: Session = Depends(get_db), user=Depends(require_admin)):
        a = get_or_404(db, article_id)
        if not a.published:
            raise HTTPException(400, "Treść nie jest opublikowana")
        a.published = False
        if a.draft:                                       # wycofana treść wraca do roboczej, razem z oczekującymi zmianami
            apply_live(a, a.draft)
            a.draft = None
        if a.draft_state in (None, "none"):
            a.draft_state = "draft"
        log(db, a, user, "unpublish")
        db.commit()
        return editor_row(a, db)

    @router.post("/api/knowledge/editor/items/{article_id}/discard")
    def editor_discard(article_id: int, db: Session = Depends(get_db), user=Depends(require_staff)):
        """Porzuca oczekujące zmiany opublikowanej treści (wraca wersja publiczna)."""
        a = get_or_404(db, article_id)
        if not can_edit(user, a):
            raise HTTPException(403, "Możesz edytować tylko własne treści")
        if not a.published or not a.draft:
            raise HTTPException(400, "Brak zmian do porzucenia")
        if a.draft_state == "review" and not is_admin(user):
            raise HTTPException(409, "Treść czeka na przegląd")
        a.draft, a.draft_state, a.review_note = None, "none", None
        log(db, a, user, "discard")
        db.commit()
        return editor_row(a, db)

    @router.delete("/api/knowledge/editor/items/{article_id}")
    def editor_delete(article_id: int, db: Session = Depends(get_db), user=Depends(require_staff)):
        a = get_or_404(db, article_id)
        if not (is_admin(user) or (can_edit(user, a) and not a.published)):
            raise HTTPException(403, "Redaktor może usuwać tylko własne, nieopublikowane treści")
        db.delete(a)
        db.commit()
        return {"message": "Usunięto"}

    # ── kursy ────────────────────────────────────────────────────────────────
    def course_row(c, db):
        n = db.query(K.id).filter(K.course_id == c.id).count()
        lab, _ = level_info(c.level)
        return {"id": c.id, "slug": c.slug, "title": c.title, "summary": c.summary or "", "level": c.level, "level_label": lab,
                "position": c.position or 0, "published": bool(c.published), "lessons_total": n}

    def clean_course(data: CourseIn):
        title = (data.title or "").strip()
        if not title:
            raise HTTPException(400, "Tytuł kursu jest wymagany")
        if len(title) > LIM["title"]:
            raise HTTPException(400, f"Tytuł może mieć maksymalnie {LIM['title']} znaków")
        if data.level not in LEVELS:
            raise HTTPException(400, "Nieprawidłowy poziom")
        if len(data.summary or "") > LIM["summary"]:
            raise HTTPException(400, f"Opis może mieć maksymalnie {LIM['summary']} znaków")
        return title, (data.summary or "").strip()

    @router.get("/api/knowledge/editor/courses")
    def editor_courses(db: Session = Depends(get_db), user=Depends(require_staff)):
        return [course_row(c, db) for c in db.query(C).order_by(C.position, C.id).all()]

    @router.post("/api/knowledge/editor/courses")
    def course_create(data: CourseIn, db: Session = Depends(get_db), user=Depends(require_admin)):
        title, summary = clean_course(data)
        c = C(slug=unique_slug(db, C, slugify(title)), title=title, summary=summary, level=data.level,
              position=max(-9999, min(9999, data.position)), published=bool(data.published))
        db.add(c)
        db.commit()
        db.refresh(c)
        return course_row(c, db)

    @router.put("/api/knowledge/editor/courses/{course_id}")
    def course_update(course_id: int, data: CourseIn, db: Session = Depends(get_db), user=Depends(require_admin)):
        c = db.query(C).filter(C.id == course_id).first()
        if not c:
            raise HTTPException(404, "Nie znaleziono kursu")
        c.title, c.summary = clean_course(data)
        c.level, c.position, c.published = data.level, max(-9999, min(9999, data.position)), bool(data.published)
        db.commit()
        return course_row(c, db)

    @router.delete("/api/knowledge/editor/courses/{course_id}")
    def course_delete(course_id: int, db: Session = Depends(get_db), user=Depends(require_admin)):
        c = db.query(C).filter(C.id == course_id).first()
        if not c:
            raise HTTPException(404, "Nie znaleziono kursu")
        if db.query(K.id).filter(K.course_id == c.id).first():
            raise HTTPException(400, "Kurs ma lekcje – najpierw je usuń lub przenieś")
        db.delete(c)
        db.commit()
        return {"message": "Usunięto kurs"}

    return router
