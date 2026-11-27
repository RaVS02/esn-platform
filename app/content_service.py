"""Treści powiązane z projektami i podzespołami: relacje, przykłady kodu i zasoby do pobrania.

1) Relacja projekt ↔ podzespół z katalogu (tabela project_components) – widoczna z obu stron.
2) Przykłady kodu dla wielu środowisk (Arduino, ESP-IDF, PlatformIO, MicroPython…) – tabela code_examples.
3) Zasoby do pobrania (tabela resources):
     • domyślnie LINKI do zewnętrznych źródeł (datasheet, repozytorium, dokumentacja),
     • plik hostujemy wyłącznie, gdy autor wskaże licencję i potwierdzi prawo do jego udostępniania.
   Bezpieczeństwo plików: typ po zawartości (nie po nazwie), whitelista rozszerzeń, ZIP-y są przeglądane
   (odrzucane z plikami wykonywalnymi i ścieżkami wychodzącymi poza archiwum), nazwy nadaje serwer, limity
   wspólne ze zdjęciami (media_service). Pliki z katalogu files/ dostają te same nagłówki ochronne co zdjęcia.
"""
import io
import re
import struct
import zipfile
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

import media_service as ms
import models

# ─────────────────────────────────────────────────────────────────────────────
# Słowniki
# ─────────────────────────────────────────────────────────────────────────────
CODE_LANGS = {
    "arduino": "Arduino", "esp-idf": "ESP-IDF", "platformio": "PlatformIO", "esphome": "ESPHome",
    "micropython": "MicroPython", "circuitpython": "CircuitPython", "python": "Python", "cpp": "C++", "c": "C",
    "rust": "Rust", "bash": "Shell", "yaml": "YAML", "json": "JSON", "ini": "INI", "other": "Inne",
}
LANG_ALIASES = {"c++": "cpp", "cc": "cpp", "ino": "arduino", "py": "python", "sh": "bash", "shell": "bash",
                "idf": "esp-idf", "espidf": "esp-idf", "pio": "platformio", "mpy": "micropython", "yml": "yaml"}

RTYPES = {"datasheet": "Datasheet", "docs": "Dokumentacja", "schematic": "Schemat", "pcb": "PCB / Gerbery",
          "firmware": "Kod / firmware", "model3d": "Model 3D", "guide": "Poradnik", "repo": "Repozytorium", "other": "Inne"}

LICENSES = {
    "own": "Praca własna autora",
    "cc0": "CC0 (domena publiczna)",
    "public-domain": "Domena publiczna",
    "cc-by": "CC BY 4.0",
    "cc-by-sa": "CC BY-SA 4.0",
    "mit": "MIT",
    "apache-2": "Apache-2.0",
    "bsd-3": "BSD-3-Clause",
    "gpl-3": "GPL-3.0",
}

TEXT_EXT = {"txt", "md", "csv", "json", "yaml", "yml", "ino", "py", "c", "h", "cpp", "hpp", "ini", "toml", "kicad_pro"}
SEXP_EXT = {"kicad_sch", "kicad_pcb", "kicad_sym", "kicad_mod"}
BIN_EXT = {"pdf", "zip", "stl", "step", "stp"}
ALLOWED_EXT = TEXT_EXT | SEXP_EXT | BIN_EXT
EXEC_IN_ZIP = {"exe", "dll", "bat", "cmd", "com", "scr", "msi", "jar", "apk", "vbs", "ps1", "app", "dmg", "pif", "lnk", "html", "htm", "svg", "js", "hta"}
MIME = {"pdf": "application/pdf", "zip": "application/zip", "stl": "model/stl", "step": "model/step", "stp": "model/step",
        "json": "application/json", "csv": "text/csv", "md": "text/markdown"}

URL_RE = re.compile(r"^https?://[^\s<>\"'`]{3,490}$", re.I)


class ContentError(ValueError):
    pass


# ─────────────────────────────────────────────────────────────────────────────
# Walidacja plików do pobrania
# ─────────────────────────────────────────────────────────────────────────────
def _check_text(data: bytes):
    if b"\x00" in data:
        raise ContentError("To nie jest plik tekstowy")
    try:
        data.decode("utf-8")
    except UnicodeDecodeError:
        raise ContentError("Plik tekstowy musi być w kodowaniu UTF-8")


def _check_zip(data: bytes):
    if data[:4] != b"PK\x03\x04":
        raise ContentError("To nie jest poprawny plik ZIP")
    try:
        z = zipfile.ZipFile(io.BytesIO(data))
        infos = z.infolist()
    except zipfile.BadZipFile:
        raise ContentError("Uszkodzony plik ZIP")
    if len(infos) > 2000:
        raise ContentError("Archiwum ma zbyt wiele plików (maks. 2000)")
    if sum(i.file_size for i in infos) > 300 * ms.MB:
        raise ContentError("Rozpakowane archiwum byłoby zbyt duże (maks. 300 MB)")
    for i in infos:
        name = i.filename.replace("\\", "/")
        if name.startswith("/") or ".." in name.split("/") or re.match(r"^[A-Za-z]:", name):
            raise ContentError("Archiwum zawiera niebezpieczne ścieżki")
        ext = name.rsplit(".", 1)[-1].lower() if "." in name.rsplit("/", 1)[-1] else ""
        if ext in EXEC_IN_ZIP:
            raise ContentError(f"Archiwum zawiera niedozwolony plik (.{ext}). Nie hostujemy programów ani plików HTML/JS/SVG.")
        if i.flag_bits & 0x1:
            raise ContentError("Archiwa zaszyfrowane hasłem nie są dozwolone")


def _check_stl(data: bytes):
    head = data[:80].lstrip().lower()
    if head.startswith(b"solid") and b"facet" in data[:1000].lower():
        _check_text(data)                                 # STL tekstowy
        return
    if len(data) >= 84:                                   # STL binarny: 80 B nagłówka + liczba trójkątów + 50 B na trójkąt
        n = struct.unpack("<I", data[80:84])[0]
        if len(data) == 84 + 50 * n:
            return
    raise ContentError("To nie jest poprawny plik STL")


def validate_resource_file(filename: str, data: bytes):
    """Zwraca (rozszerzenie, mime) albo rzuca ContentError."""
    if not data:
        raise ContentError("Pusty plik")
    if len(data) > ms.CFG["res_max_file_bytes"]:
        raise ContentError(f"Plik jest za duży (limit {ms.CFG['res_max_file_bytes'] // ms.MB} MB)")
    name = (filename or "").strip().lower()
    ext = name.rsplit(".", 1)[-1] if "." in name else ""
    if ext not in ALLOWED_EXT:
        raise ContentError("Niedozwolony typ pliku. Dozwolone: PDF, ZIP, STL, STEP, pliki KiCad oraz tekstowe/kodu (" +
                           ", ".join(sorted(TEXT_EXT - {"kicad_pro"})) + ").")
    if ext == "pdf":
        if data[:5] != b"%PDF-":
            raise ContentError("To nie jest poprawny plik PDF")
    elif ext == "zip":
        _check_zip(data)
    elif ext == "stl":
        _check_stl(data)
    elif ext in ("step", "stp"):
        if not data[:300].lstrip().startswith(b"ISO-10303-21"):
            raise ContentError("To nie jest poprawny plik STEP")
    elif ext in SEXP_EXT:
        _check_text(data)
        if not data.lstrip().startswith(b"("):
            raise ContentError("To nie jest poprawny plik KiCad")
    else:
        _check_text(data)
    return ext, MIME.get(ext, "application/octet-stream" if ext in BIN_EXT else "text/plain")


def clean_url(u: str) -> str:
    u = (u or "").strip()
    if not URL_RE.match(u):
        raise HTTPException(status_code=400, detail="Adres musi zaczynać się od http:// lub https://")
    return u


# ─────────────────────────────────────────────────────────────────────────────
# Serializacja
# ─────────────────────────────────────────────────────────────────────────────
def res_dict(r) -> dict:
    return {"id": r.id, "owner_type": r.owner_type, "owner_id": r.owner_id, "kind": r.kind, "rtype": r.rtype,
            "type_label": RTYPES.get(r.rtype, "Inne"), "label": r.label,
            "url": r.url if r.kind == "link" else "/static/" + (r.path or ""),
            "name": r.original_name or "", "size": r.size_bytes or 0, "license": r.license,
            "license_label": LICENSES.get(r.license or "", ""), "license_note": r.license_note or "", "position": r.position or 0}


def code_dict(c) -> dict:
    return {"id": c.id, "lang": c.lang, "lang_label": CODE_LANGS.get(c.lang, "Inne"), "title": c.title or "", "code": c.code}


# ─────────────────────────────────────────────────────────────────────────────
# v55: datasheet komponentu i repozytorium projektu tylko w Zasobach
# (dawne kolumny official_components.datasheet_url / projects.github_url są przenoszone do resources i zerowane)
# ─────────────────────────────────────────────────────────────────────────────
LEGACY_FIELDS = {"component": ("datasheet_url", "datasheet"), "project": ("github_url", "repo")}


def _legacy_label(rtype: str, url: str) -> str:
    if rtype == "datasheet":
        return "Datasheet"
    return "GitHub" if "github.com" in url.lower() else RTYPES["repo"]


def adopt_legacy(db: Session, obj, owner_type: str) -> bool:
    """Przenosi link z dawnej kolumny (datasheet_url / github_url) do zasobów jako pierwszą pozycję i zeruje kolumnę.
    Bez commitu. Nieprawidłowy adres jest pomijany (kolumna i tak zerowana – nie da się go edytować w interfejsie)."""
    field, rtype = LEGACY_FIELDS[owner_type]
    url = (getattr(obj, field, None) or "").strip()
    if not url:
        return False
    setattr(obj, field, None)
    if not URL_RE.match(url):
        return False
    q = db.query(models.Resource).filter(models.Resource.owner_type == owner_type, models.Resource.owner_id == obj.id)
    if q.filter(models.Resource.url == url).first():
        return False
    minpos = q.with_entities(func.min(models.Resource.position)).scalar()
    db.add(models.Resource(owner_type=owner_type, owner_id=obj.id, kind="link", rtype=rtype, label=_legacy_label(rtype, url),
                           url=url, position=(minpos if minpos is not None else 1) - 1))
    return True


def migrate_legacy_links(session_factory) -> dict:
    stats = {"datasheets": 0, "repos": 0}
    db = session_factory()
    try:
        for c in db.query(models.OfficialComponent).filter(models.OfficialComponent.datasheet_url.isnot(None)).all():
            stats["datasheets"] += adopt_legacy(db, c, "component")
        for p in db.query(models.Project).filter(models.Project.github_url.isnot(None)).all():
            stats["repos"] += adopt_legacy(db, p, "project")
        db.commit()
    finally:
        db.close()
    return stats


def first_links(db: Session, owner_type: str, ids, rtype: str) -> dict:
    """{owner_id: url} – pierwszy link danego rodzaju (wg kolejności w zasobach)."""
    ids = list(ids)
    if not ids:
        return {}
    out = {}
    for r in db.query(models.Resource).filter(models.Resource.owner_type == owner_type, models.Resource.owner_id.in_(ids),
                                              models.Resource.kind == "link", models.Resource.rtype == rtype) \
            .order_by(models.Resource.position, models.Resource.id).all():
        out.setdefault(r.owner_id, r.url)
    return out


def list_resources(db: Session, owner_type: str, owner_id: int):
    return db.query(models.Resource).filter(models.Resource.owner_type == owner_type, models.Resource.owner_id == owner_id) \
        .order_by(models.Resource.position, models.Resource.id).all()


def list_code(db: Session, owner_type: str, owner_id: int):
    return db.query(models.CodeExample).filter(models.CodeExample.owner_type == owner_type, models.CodeExample.owner_id == owner_id) \
        .order_by(models.CodeExample.position, models.CodeExample.id).all()


def norm_lang(v: str) -> str:
    v = (v or "").strip().lower()
    v = LANG_ALIASES.get(v, v)
    return v if v in CODE_LANGS else "other"


def delete_owner_content(db: Session, owner_type: str, owner_id: int):
    """Wywoływane przy usuwaniu projektu/komponentu: kasuje przykłady kodu, zasoby i ich pliki."""
    for r in list_resources(db, owner_type, owner_id):
        if r.kind == "file":
            ms.remove_static_file(r.path)
        db.delete(r)
    for c in list_code(db, owner_type, owner_id):
        db.delete(c)


# ─────────────────────────────────────────────────────────────────────────────
# Migracje (idempotentne, nigdy nie blokują startu)
# ─────────────────────────────────────────────────────────────────────────────
def migrate(session_factory) -> dict:
    stats = {"relations": 0, "code_examples": 0}
    db = session_factory()
    try:
        by_name = {}
        for c in db.query(models.OfficialComponent).all():
            for key in (c.name, getattr(c, "symbol", None)):
                if key and key.strip():
                    by_name.setdefault(key.strip().lower(), c.id)
        linked = {pid for (pid,) in db.query(models.ProjectComponent.project_id).distinct().all()}
        coded = {oid for (oid,) in db.query(models.CodeExample.owner_id).filter(models.CodeExample.owner_type == "project").distinct().all()}
        for p in db.query(models.Project).all():
            if p.id not in linked and p.components:
                seen = []
                for part in re.split(r"[,;]", p.components):                     # dopasowanie tylko dokładne (bez zgadywania)
                    cid = by_name.get(part.strip().lower())
                    if cid and cid not in seen:
                        seen.append(cid)
                for pos, cid in enumerate(seen):
                    db.add(models.ProjectComponent(project_id=p.id, component_id=cid, position=pos))
                    stats["relations"] += 1
            if p.id not in coded and p.code_snippet and p.code_snippet.strip():
                db.add(models.CodeExample(owner_type="project", owner_id=p.id, lang=norm_lang(p.code_lang),
                                          title="", code=p.code_snippet[:ms.CFG["code_max_bytes"]], position=0))
                stats["code_examples"] += 1
        db.commit()
    finally:
        db.close()
    return stats


# ─────────────────────────────────────────────────────────────────────────────
# API
# ─────────────────────────────────────────────────────────────────────────────
class RelItem(BaseModel):
    component_id: int
    note: Optional[str] = None


class RelPut(BaseModel):
    items: List[RelItem]


class CodeItem(BaseModel):
    lang: str = "other"
    title: Optional[str] = ""
    code: str


class CodePut(BaseModel):
    owner_type: str
    owner_id: int
    items: List[CodeItem]


class LinkIn(BaseModel):
    owner_type: str
    owner_id: int
    rtype: str = "other"
    label: str
    url: str


class ResPatch(BaseModel):
    label: Optional[str] = None
    rtype: Optional[str] = None
    url: Optional[str] = None
    license_note: Optional[str] = None


class ResReorder(BaseModel):
    owner_type: str
    owner_id: int
    ids: List[int]


def build_router(get_db, get_current_user) -> APIRouter:
    router = APIRouter(tags=["Relacje, kod i zasoby"])

    # ── relacje ──────────────────────────────────────────────────────────────
    @router.get("/api/projects/{project_id}/components")
    def project_components(project_id: int, db: Session = Depends(get_db)):
        rows = db.query(models.ProjectComponent, models.OfficialComponent).join(
            models.OfficialComponent, models.OfficialComponent.id == models.ProjectComponent.component_id) \
            .filter(models.ProjectComponent.project_id == project_id).order_by(models.ProjectComponent.position, models.ProjectComponent.id).all()
        return [{"component_id": c.id, "name": c.name, "symbol": getattr(c, "symbol", None), "category": getattr(c, "inventory_category", None),
                 "image_main": c.image_main, "note": rel.note or ""} for rel, c in rows]

    @router.put("/api/projects/{project_id}/components")
    def set_project_components(project_id: int, data: RelPut, db: Session = Depends(get_db), user=Depends(get_current_user)):
        ms.owner_exists_and_can_edit(db, user, "project", project_id)
        if len(data.items) > 40:
            raise HTTPException(status_code=400, detail="Maksymalnie 40 podzespołów z katalogu na projekt")
        ids = []
        for it in data.items:
            if it.component_id not in [i.component_id for i in ids]:
                ids.append(it)
        exist = {i for (i,) in db.query(models.OfficialComponent.id).filter(
            models.OfficialComponent.id.in_([i.component_id for i in ids] or [0])).all()}
        if any(i.component_id not in exist for i in ids):
            raise HTTPException(status_code=400, detail="Wskazano podzespół, którego nie ma w katalogu")
        db.query(models.ProjectComponent).filter(models.ProjectComponent.project_id == project_id).delete()
        for pos, it in enumerate(ids):
            db.add(models.ProjectComponent(project_id=project_id, component_id=it.component_id,
                                           note=(it.note or "").strip()[:200] or None, position=pos))
        db.commit()
        return project_components(project_id, db)

    @router.get("/api/catalog/{component_id}/projects")
    def component_projects(component_id: int, db: Session = Depends(get_db)):
        rows = db.query(models.ProjectComponent, models.Project).join(
            models.Project, models.Project.id == models.ProjectComponent.project_id) \
            .filter(models.ProjectComponent.component_id == component_id).order_by(models.Project.id.desc()).limit(50).all()
        out = []
        for rel, p in rows:
            owner = db.query(models.User).filter(models.User.id == p.owner_id).first()
            out.append({"id": p.id, "slug": p.slug, "title": p.title, "short_desc": p.short_desc, "image_main": p.image_main,
                        "status": p.status, "owner": owner.username if owner else None, "note": rel.note or ""})
        return out

    # ── przykłady kodu ───────────────────────────────────────────────────────
    @router.get("/api/code-examples")
    def get_code(owner_type: str, owner_id: int, db: Session = Depends(get_db)):
        if owner_type not in ms.ROLES:
            raise HTTPException(status_code=400, detail="Nieznany typ obiektu")
        return {"langs": CODE_LANGS, "items": [code_dict(c) for c in list_code(db, owner_type, owner_id)]}

    @router.put("/api/code-examples")
    def put_code(data: CodePut, db: Session = Depends(get_db), user=Depends(get_current_user)):
        ms.owner_exists_and_can_edit(db, user, data.owner_type, data.owner_id)
        if len(data.items) > ms.CFG["code_max_items"]:
            raise HTTPException(status_code=400, detail=f"Maksymalnie {ms.CFG['code_max_items']} przykładów kodu")
        total = 0
        clean = []
        for it in data.items:
            code = (it.code or "").replace("\x00", "")
            if not code.strip():
                continue                                                          # puste przykłady pomijamy
            if len(code.encode("utf-8")) > ms.CFG["code_max_bytes"]:
                raise HTTPException(status_code=413, detail=f"Przykład kodu jest za długi (limit {ms.CFG['code_max_bytes'] // 1024} KB)")
            total += len(code)
            clean.append((norm_lang(it.lang), (it.title or "").strip()[:120], code))
        if total > ms.CFG["code_max_bytes"] * 4:
            raise HTTPException(status_code=413, detail="Łączna ilość kodu jest za duża")
        for c in list_code(db, data.owner_type, data.owner_id):
            db.delete(c)
        db.flush()
        for pos, (lang, title, code) in enumerate(clean):
            db.add(models.CodeExample(owner_type=data.owner_type, owner_id=data.owner_id, lang=lang, title=title, code=code, position=pos))
        if data.owner_type == "project":                                           # lustro starych kolumn (zgodność wsteczna)
            p = db.query(models.Project).filter(models.Project.id == data.owner_id).first()
            if p:
                p.code_snippet = clean[0][2] if clean else None
                p.code_lang = (clean[0][0] if clean else "cpp")[:20]
        db.commit()
        return {"langs": CODE_LANGS, "items": [code_dict(c) for c in list_code(db, data.owner_type, data.owner_id)]}

    # ── zasoby do pobrania ───────────────────────────────────────────────────
    @router.get("/api/resources/policy")
    def policy():
        return {"types": RTYPES, "licenses": LICENSES, "max_file_mb": ms.CFG["res_max_file_bytes"] // ms.MB,
                "max_per_owner": ms.CFG["res_max_per_owner"], "allowed_ext": sorted(ALLOWED_EXT)}

    @router.get("/api/resources")
    def get_resources(owner_type: str, owner_id: int, db: Session = Depends(get_db)):
        if owner_type not in ms.ROLES:
            raise HTTPException(status_code=400, detail="Nieznany typ obiektu")
        return [res_dict(r) for r in list_resources(db, owner_type, owner_id)]

    def _check_owner_limit(db, owner_type, owner_id):
        n = db.query(func.count(models.Resource.id)).filter(models.Resource.owner_type == owner_type, models.Resource.owner_id == owner_id).scalar() or 0
        if n >= ms.CFG["res_max_per_owner"]:
            raise HTTPException(status_code=409, detail=f"Osiągnięto limit zasobów dla tego obiektu ({ms.CFG['res_max_per_owner']}).")

    def _next_pos(db, owner_type, owner_id):
        return (db.query(func.coalesce(func.max(models.Resource.position), 0)).filter(
            models.Resource.owner_type == owner_type, models.Resource.owner_id == owner_id).scalar() or 0) + 1

    @router.post("/api/resources/link", status_code=201)
    def add_link(data: LinkIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
        ms.owner_exists_and_can_edit(db, user, data.owner_type, data.owner_id)
        if data.rtype not in RTYPES:
            raise HTTPException(status_code=400, detail="Nieznany rodzaj zasobu")
        label = data.label.strip()[:200]
        if not label:
            raise HTTPException(status_code=400, detail="Podaj opis linku")
        _check_owner_limit(db, data.owner_type, data.owner_id)
        r = models.Resource(owner_type=data.owner_type, owner_id=data.owner_id, kind="link", rtype=data.rtype, label=label,
                            url=clean_url(data.url), position=_next_pos(db, data.owner_type, data.owner_id), uploaded_by=user.id)
        db.add(r); db.commit(); db.refresh(r)
        return res_dict(r)

    @router.post("/api/resources/file", status_code=201)
    async def add_file(owner_type: str = Form(...), owner_id: int = Form(...), rtype: str = Form("other"), label: str = Form(""),
                       license: str = Form(...), license_note: str = Form(""), rights: bool = Form(False),
                       file: UploadFile = File(...), db: Session = Depends(get_db), user=Depends(get_current_user)):
        ms.owner_exists_and_can_edit(db, user, owner_type, owner_id)
        if rtype not in RTYPES:
            raise HTTPException(status_code=400, detail="Nieznany rodzaj zasobu")
        if license not in LICENSES:
            raise HTTPException(status_code=400, detail="Wybierz licencję pliku")
        if not rights:
            raise HTTPException(status_code=400, detail="Potwierdź, że masz prawo udostępniać ten plik")
        note = license_note.strip()[:300]
        if license != "own" and len(note) < 3:
            raise HTTPException(status_code=400, detail="Dla pliku na wolnej licencji podaj autora lub źródło (uznanie autorstwa)")
        _check_owner_limit(db, owner_type, owner_id)
        raw = await ms.read_limited(file, ms.CFG["res_max_file_bytes"])
        try:
            ext, mime = validate_resource_file(file.filename or "", raw)
        except ContentError as e:
            raise HTTPException(status_code=400, detail=str(e))
        # limity miejsca/wgrań są wspólne ze zdjęciami (ms.usage), limit liczby plików – osobny (res_max_per_owner)
        u, lim = ms.usage(db, user, owner_type, owner_id), ms.limits_for(user, owner_type)
        if u["user_bytes"] + len(raw) > lim["quota_mb"] * ms.MB:
            raise HTTPException(status_code=413, detail=f"Przekroczono Twój limit miejsca ({lim['quota_mb']} MB). Usuń niepotrzebne pliki lub zdjęcia.")
        if u["last_hour"] >= lim["uploads_per_hour"]:
            raise HTTPException(status_code=429, detail="Zbyt wiele wgrań w ciągu godziny. Spróbuj ponownie później.")
        if u["total_bytes"] + len(raw) > ms.CFG["global_cap"]:
            raise HTTPException(status_code=507, detail="Serwer osiągnął limit miejsca. Skontaktuj się z administratorem.")
        orig = re.sub(r"[^\w.\- ]+", "_", (file.filename or "plik").rsplit("/", 1)[-1].rsplit("\\", 1)[-1])[:120]
        path = ms.store_bytes(f"files/{owner_type}", ext, raw)
        try:
            r = models.Resource(owner_type=owner_type, owner_id=owner_id, kind="file", rtype=rtype,
                                label=(label.strip() or orig)[:200], path=path, original_name=orig, mime=mime, size_bytes=len(raw),
                                license=license, license_note=note, position=_next_pos(db, owner_type, owner_id), uploaded_by=user.id)
            db.add(r); db.commit(); db.refresh(r)
        except Exception:
            db.rollback(); ms.remove_static_file(path); raise
        return res_dict(r)

    @router.patch("/api/resources/{res_id}")
    def patch_resource(res_id: int, data: ResPatch, db: Session = Depends(get_db), user=Depends(get_current_user)):
        r = db.query(models.Resource).filter(models.Resource.id == res_id).first()
        if not r:
            raise HTTPException(status_code=404, detail="Nie znaleziono zasobu")
        ms.owner_exists_and_can_edit(db, user, r.owner_type, r.owner_id)
        if data.label is not None:
            if not data.label.strip():
                raise HTTPException(status_code=400, detail="Opis nie może być pusty")
            r.label = data.label.strip()[:200]
        if data.rtype is not None:
            if data.rtype not in RTYPES:
                raise HTTPException(status_code=400, detail="Nieznany rodzaj zasobu")
            r.rtype = data.rtype
        if data.url is not None:
            if r.kind != "link":
                raise HTTPException(status_code=400, detail="Adres można zmienić tylko w linku")
            r.url = clean_url(data.url)
        if data.license_note is not None and r.kind == "file":
            r.license_note = data.license_note.strip()[:300]
        db.commit(); db.refresh(r)
        return res_dict(r)

    @router.post("/api/resources/reorder")
    def reorder_resources(data: ResReorder, db: Session = Depends(get_db), user=Depends(get_current_user)):
        ms.owner_exists_and_can_edit(db, user, data.owner_type, data.owner_id)
        rows = {r.id: r for r in list_resources(db, data.owner_type, data.owner_id)}
        order = [i for i in data.ids if i in rows] + [i for i in rows if i not in data.ids]
        for pos, i in enumerate(order, start=1):
            rows[i].position = pos
        db.commit()
        return [res_dict(r) for r in list_resources(db, data.owner_type, data.owner_id)]

    @router.delete("/api/resources/{res_id}")
    def delete_resource(res_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
        r = db.query(models.Resource).filter(models.Resource.id == res_id).first()
        if not r:
            raise HTTPException(status_code=404, detail="Nie znaleziono zasobu")
        ms.owner_exists_and_can_edit(db, user, r.owner_type, r.owner_id)
        if r.kind == "file":
            ms.remove_static_file(r.path)
        db.delete(r); db.commit()
        return {"message": "Usunięto"}

    return router
