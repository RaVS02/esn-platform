"""System mediów ESN – zdjęcia dla projektów, komponentów i całej platformy.

Zasady bezpieczeństwa (cel: serwer nie może stać się darmowym hostingiem plików ani wektorem ataku):
  * typ pliku ustalany WYŁĄCZNIE po zawartości (magic bytes), nigdy po nazwie/rozszerzeniu od użytkownika,
  * dozwolone: JPEG, PNG, WebP, GIF (bez SVG – może zawierać skrypty),
  * nazwy plików generuje serwer (uuid), użytkownik nie wpływa na ścieżkę,
  * JPEG: usuwany EXIF/XMP (w tym GPS), zachowana orientacja; PNG: usuwane metadane tekstowe/EXIF,
  * limity: rozmiar pliku, wymiary, liczba plików na obiekt, miejsce na konto, wgrania na godzinę,
    globalny limit miejsca na dysku,
  * usuwanie plików tylko wewnątrz katalogów uploadów (ochrona przed path traversal).

Limity można zmienić zmiennymi środowiskowymi (patrz CFG poniżej i docs/MEDIA.md).
"""
import os
import re
import struct
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

import models

MB = 1024 * 1024
STATIC_ROOT = os.path.abspath("static")
UPLOAD_PREFIXES = ("media/", "projects/", "catalog/", "avatars/")   # tylko tu wolno kasować pliki


def _int(name, default):
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return int(default)


CFG = {
    "max_file_bytes": _int("MEDIA_MAX_FILE_MB", 5) * MB,
    "avatar_max_bytes": _int("MEDIA_AVATAR_MAX_MB", 2) * MB,
    "markdown_max_bytes": _int("MEDIA_MARKDOWN_MAX_KB", 512) * 1024,
    "max_dimension": _int("MEDIA_MAX_DIMENSION", 8000),
    "max_pixels": _int("MEDIA_MAX_MEGAPIXELS", 40) * 1_000_000,
    "user_quota": _int("MEDIA_USER_QUOTA_MB", 150) * MB,
    "staff_quota": _int("MEDIA_STAFF_QUOTA_MB", 1500) * MB,
    "uploads_per_hour": _int("MEDIA_UPLOADS_PER_HOUR", 60),
    "staff_uploads_per_hour": _int("MEDIA_STAFF_UPLOADS_PER_HOUR", 300),
    "global_cap": _int("MEDIA_GLOBAL_CAP_MB", 5000) * MB,
    "per_owner": {
        "project": _int("MEDIA_MAX_PER_PROJECT", 20),
        "component": _int("MEDIA_MAX_PER_COMPONENT", 20),
        "platform": _int("MEDIA_MAX_PLATFORM", 200),
    },
}
CFG["max_request_bytes"] = CFG["max_file_bytes"] + 1 * MB

ROLES = {
    "project": ["main", "schematic", "gallery"],
    "component": ["main", "gallery", "pinout"],
    "platform": ["main", "gallery"],
}
ROLE_LABELS = {"main": "Główne", "gallery": "Galeria", "schematic": "Schemat", "pinout": "Pinout"}

# stare kolumny image_* (kompatybilność: karty, lista, Magazyn, zbuforowany stary frontend)
LEGACY_FIELDS = {
    "project": {"image_main": ("main", True), "image_schematic": ("schematic", True),
                "image_gallery_1": ("gallery", False), "image_gallery_2": ("gallery", False)},
    "component": {"image_main": ("main", True), "image_gallery_1": ("gallery", False),
                  "image_gallery_2": ("gallery", False), "image_gallery_3": ("gallery", False)},
}


def is_staff(user) -> bool:
    return getattr(user, "role", "user") in ("admin", "moderator")


# ─────────────────────────────────────────────────────────────────────────────
# Ścieżki
# ─────────────────────────────────────────────────────────────────────────────
def safe_static_path(rel: Optional[str], uploads_only: bool = True) -> Optional[str]:
    """Zwraca absolutną ścieżkę pliku wewnątrz static/ albo None (traversal, symlink, spoza uploadów)."""
    if not rel or not isinstance(rel, str) or "\x00" in rel:
        return None
    rel_norm = rel.replace("\\", "/").lstrip("/")
    root = os.path.realpath(STATIC_ROOT)
    full = os.path.realpath(os.path.join(root, rel_norm))
    if full == root or not full.startswith(root + os.sep):
        return None
    # prefiks sprawdzamy na ścieżce PO normalizacji (projects/../style.css → style.css musi przepaść)
    resolved = os.path.relpath(full, root).replace(os.sep, "/")
    if uploads_only and not resolved.startswith(UPLOAD_PREFIXES):
        return None
    return full


def remove_static_file(rel: Optional[str]) -> bool:
    full = safe_static_path(rel)
    if full and os.path.isfile(full):
        try:
            os.remove(full)
            return True
        except OSError:
            return False
    return False


def store_bytes(subdir: str, ext: str, data: bytes) -> str:
    """Zapisuje plik pod losową nazwą i zwraca ścieżkę względem static/."""
    rel = f"{subdir}/{datetime.utcnow():%Y-%m}/{uuid.uuid4().hex}.{ext}"
    full = os.path.join(STATIC_ROOT, rel)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    tmp = full + ".tmp"
    with open(tmp, "wb") as fh:
        fh.write(data)
    os.replace(tmp, full)
    return rel


# ─────────────────────────────────────────────────────────────────────────────
# Rozpoznawanie i czyszczenie obrazów (bez zewnętrznych bibliotek)
# ─────────────────────────────────────────────────────────────────────────────
class ImageError(ValueError):
    pass


_SOF = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}


def _exif_orientation(tiff: bytes) -> Optional[int]:
    try:
        end = "<" if tiff[:2] == b"II" else ">" if tiff[:2] == b"MM" else None
        if end is None or struct.unpack(end + "H", tiff[2:4])[0] != 42:
            return None
        off = struct.unpack(end + "I", tiff[4:8])[0]
        n = struct.unpack(end + "H", tiff[off:off + 2])[0]
        for i in range(min(n, 64)):
            e = tiff[off + 2 + i * 12: off + 14 + i * 12]
            if len(e) == 12 and struct.unpack(end + "H", e[:2])[0] == 0x0112:
                v = struct.unpack(end + "H", e[8:10])[0]
                return v if 1 <= v <= 8 else None
    except (struct.error, IndexError):
        return None
    return None


def _exif_segment(orientation: int) -> bytes:
    """Minimalny APP1/EXIF zawierający wyłącznie orientację (przeglądarki obracają zdjęcie wg niej)."""
    tiff = b"MM\x00*\x00\x00\x00\x08" + struct.pack(">H", 1) + struct.pack(">HHIHH", 0x0112, 3, 1, orientation, 0) + b"\x00\x00\x00\x00"
    payload = b"Exif\x00\x00" + tiff
    return b"\xff\xe1" + struct.pack(">H", len(payload) + 2) + payload


def _process_jpeg(data: bytes):
    if data[:2] != b"\xff\xd8":
        raise ImageError("Uszkodzony plik JPEG")
    out = bytearray(b"\xff\xd8")
    n, i, w, h, orient, insert_at = len(data), 2, None, None, None, 2
    while i < n:
        if data[i] != 0xFF:
            raise ImageError("Uszkodzony plik JPEG")
        while i < n and data[i] == 0xFF:
            i += 1
        if i >= n:
            break
        m = data[i]
        i += 1
        if m == 0xD9:
            break
        if m == 0x01 or 0xD0 <= m <= 0xD7:
            out += bytes([0xFF, m])
            continue
        if i + 2 > n:
            raise ImageError("Uszkodzony plik JPEG")
        ln = struct.unpack(">H", data[i:i + 2])[0]
        if ln < 2 or i + ln > n:
            raise ImageError("Uszkodzony plik JPEG")
        seg = data[i + 2:i + ln]
        if m in _SOF:
            if len(seg) < 5:
                raise ImageError("Uszkodzony plik JPEG")
            h, w = struct.unpack(">HH", seg[1:5])
        if m == 0xE1 and seg[:6] == b"Exif\x00\x00":
            orient = _exif_orientation(seg[6:])      # EXIF (w tym GPS) usuwamy, orientację zapamiętujemy
        elif m in (0xE1, 0xED, 0xFE):                # XMP, Photoshop IRB, komentarze
            pass
        else:
            out += bytes([0xFF, m]) + data[i:i + ln]
            if m == 0xE0 and insert_at == 2:
                insert_at = len(out)
        i += ln
        if m == 0xDA:                                # dane obrazu → do ostatniego EOI (obcinamy doklejony ładunek)
            tail = data[i:]
            eoi = tail.rfind(b"\xff\xd9")
            if eoi < 0:
                raise ImageError("Uszkodzony plik JPEG (brak końca danych)")
            out += tail[:eoi + 2]
            break
    if not w or not h:
        raise ImageError("Nie udało się odczytać wymiarów JPEG")
    if orient and orient != 1:
        out[insert_at:insert_at] = _exif_segment(orient)
    return bytes(out), w, h


def _process_png(data: bytes):
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ImageError("Uszkodzony plik PNG")
    out, i, n, w, h, seen_end = bytearray(data[:8]), 8, len(data), None, None, False
    drop = {b"eXIf", b"tEXt", b"zTXt", b"iTXt", b"tIME"}
    while i + 12 <= n:
        ln = struct.unpack(">I", data[i:i + 4])[0]
        typ = data[i + 4:i + 8]
        end = i + 12 + ln
        if end > n:
            raise ImageError("Uszkodzony plik PNG")
        if typ == b"IHDR":
            if ln < 8:
                raise ImageError("Uszkodzony plik PNG")
            w, h = struct.unpack(">II", data[i + 8:i + 16])
        if typ not in drop:
            out += data[i:end]
        i = end
        if typ == b"IEND":
            seen_end = True
            break
    if not seen_end or not w or not h:
        raise ImageError("Uszkodzony plik PNG")
    return bytes(out), w, h


def _process_gif(data: bytes):
    if data[:6] not in (b"GIF87a", b"GIF89a") or len(data) < 10:
        raise ImageError("Uszkodzony plik GIF")
    w, h = struct.unpack("<HH", data[6:10])
    return data, w, h


def _process_webp(data: bytes):
    if len(data) < 30 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise ImageError("Uszkodzony plik WebP")
    riff = struct.unpack("<I", data[4:8])[0] + 8
    if riff > len(data):
        raise ImageError("Uszkodzony plik WebP")
    data = data[:riff]                                  # obcinamy doklejone dane
    kind = data[12:16]
    if kind == b"VP8 ":
        if data[23:26] != b"\x9d\x01\x2a":
            raise ImageError("Uszkodzony plik WebP")
        w, h = struct.unpack("<HH", data[26:30])
        w, h = w & 0x3FFF, h & 0x3FFF
    elif kind == b"VP8L":
        if data[20] != 0x2F:
            raise ImageError("Uszkodzony plik WebP")
        b = data[21:25]
        w = 1 + (((b[1] & 0x3F) << 8) | b[0])
        h = 1 + (((b[3] & 0xF) << 10) | (b[2] << 2) | ((b[1] & 0xC0) >> 6))
    elif kind == b"VP8X":
        w = 1 + int.from_bytes(data[24:27], "little")
        h = 1 + int.from_bytes(data[27:30], "little")
    else:
        raise ImageError("Nieobsługiwany wariant WebP")
    return data, w, h


def validate_image(data: bytes, max_bytes: int):
    """Zwraca (czyste_bajty, ext, mime, szer, wys) albo rzuca ImageError. Typ wg zawartości."""
    if not data:
        raise ImageError("Pusty plik")
    if len(data) > max_bytes:
        raise ImageError(f"Plik jest za duży (limit {max_bytes // MB} MB)")
    if data[:3] == b"\xff\xd8\xff":
        clean, w, h = _process_jpeg(data); ext, mime = "jpg", "image/jpeg"
    elif data[:8] == b"\x89PNG\r\n\x1a\n":
        clean, w, h = _process_png(data); ext, mime = "png", "image/png"
    elif data[:6] in (b"GIF87a", b"GIF89a"):
        clean, w, h = _process_gif(data); ext, mime = "gif", "image/gif"
    elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        clean, w, h = _process_webp(data); ext, mime = "webp", "image/webp"
    else:
        raise ImageError("Dozwolone formaty: JPEG, PNG, WebP, GIF")
    if w < 1 or h < 1 or w > CFG["max_dimension"] or h > CFG["max_dimension"] or w * h > CFG["max_pixels"]:
        raise ImageError(f"Zbyt duże wymiary obrazu (maks. {CFG['max_dimension']} px po dłuższym boku)")
    return clean, ext, mime, w, h


def validate_markdown(data: bytes) -> bytes:
    if not data or len(data) > CFG["markdown_max_bytes"]:
        raise ImageError(f"Plik .md jest pusty lub większy niż {CFG['markdown_max_bytes'] // 1024} KB")
    if b"\x00" in data:
        raise ImageError("To nie jest plik tekstowy")
    try:
        data.decode("utf-8")
    except UnicodeDecodeError:
        raise ImageError("Plik .md musi być w kodowaniu UTF-8")
    return data


async def read_limited(upload: UploadFile, max_bytes: int) -> bytes:
    data = await upload.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Plik jest za duży (limit {max_bytes // MB} MB)")
    return data


# ─────────────────────────────────────────────────────────────────────────────
# Uprawnienia, limity
# ─────────────────────────────────────────────────────────────────────────────
def owner_exists_and_can_edit(db: Session, user, owner_type: str, owner_id: int):
    if owner_type not in ROLES:
        raise HTTPException(status_code=400, detail="Nieznany typ obiektu")
    if owner_type == "project":
        obj = db.query(models.Project).filter(models.Project.id == owner_id).first()
        if not obj:
            raise HTTPException(status_code=404, detail="Projekt nie istnieje")
        if obj.owner_id != user.id and user.role != "admin":
            raise HTTPException(status_code=403, detail="Brak uprawnień")
    elif owner_type == "component":
        obj = db.query(models.OfficialComponent).filter(models.OfficialComponent.id == owner_id).first()
        if not obj:
            raise HTTPException(status_code=404, detail="Komponent nie istnieje")
        if not is_staff(user):
            raise HTTPException(status_code=403, detail="Brak uprawnień")
    else:  # platform
        if user.role != "admin" or owner_id != 0:
            raise HTTPException(status_code=403, detail="Brak uprawnień")


def usage(db: Session, user, owner_type: str, owner_id: int) -> dict:
    owner_count = db.query(func.count(models.Media.id)).filter(
        models.Media.owner_type == owner_type, models.Media.owner_id == owner_id).scalar() or 0
    user_bytes = db.query(func.coalesce(func.sum(models.Media.size_bytes), 0)).filter(
        models.Media.uploaded_by == user.id).scalar() or 0
    last_hour = db.query(func.count(models.Media.id)).filter(
        models.Media.uploaded_by == user.id,
        models.Media.created_at > datetime.utcnow() - timedelta(hours=1)).scalar() or 0
    total = db.query(func.coalesce(func.sum(models.Media.size_bytes), 0)).scalar() or 0
    return {"owner_count": owner_count, "user_bytes": int(user_bytes), "last_hour": last_hour, "total_bytes": int(total)}


def limits_for(user, owner_type: str) -> dict:
    staff = is_staff(user)
    return {
        "max_files": CFG["per_owner"][owner_type],
        "max_file_mb": CFG["max_file_bytes"] // MB,
        "quota_mb": (CFG["staff_quota"] if staff else CFG["user_quota"]) // MB,
        "uploads_per_hour": CFG["staff_uploads_per_hour"] if staff else CFG["uploads_per_hour"],
        "formats": ["JPEG", "PNG", "WebP", "GIF"],
        "roles": ROLES[owner_type],
    }


def check_quotas(db: Session, user, owner_type: str, owner_id: int, new_bytes: int, replacing: int = 0):
    u, lim = usage(db, user, owner_type, owner_id), limits_for(user, owner_type)
    if u["owner_count"] - replacing >= lim["max_files"]:
        raise HTTPException(status_code=409, detail=f"Osiągnięto limit zdjęć dla tego obiektu ({lim['max_files']}).")
    if u["user_bytes"] + new_bytes > lim["quota_mb"] * MB:
        raise HTTPException(status_code=413, detail=f"Przekroczono Twój limit miejsca ({lim['quota_mb']} MB). Usuń niepotrzebne zdjęcia.")
    if u["last_hour"] >= lim["uploads_per_hour"]:
        raise HTTPException(status_code=429, detail="Zbyt wiele wgrań w ciągu godziny. Spróbuj ponownie później.")
    if u["total_bytes"] + new_bytes > CFG["global_cap"]:
        raise HTTPException(status_code=507, detail="Serwer osiągnął limit miejsca na zdjęcia. Skontaktuj się z administratorem.")


# ─────────────────────────────────────────────────────────────────────────────
# Operacje na bazie
# ─────────────────────────────────────────────────────────────────────────────
def item_dict(m) -> dict:
    return {"id": m.id, "owner_type": m.owner_type, "owner_id": m.owner_id, "role": m.role,
            "path": m.path, "url": "/static/" + m.path, "caption": m.caption or "",
            "width": m.width, "height": m.height, "size": m.size_bytes or 0, "mime": m.mime,
            "position": m.position or 0, "name": m.original_name or ""}


def list_media(db: Session, owner_type: str, owner_id: int):
    rows = db.query(models.Media).filter(models.Media.owner_type == owner_type, models.Media.owner_id == owner_id) \
        .order_by(models.Media.position, models.Media.id).all()
    return sorted(rows, key=lambda r: 0 if r.role == "main" else 1)   # główne zawsze pierwsze (sort stabilny)


def sync_legacy(db: Session, owner_type: str, owner_id: int):
    """Utrzymuje stare kolumny image_* zgodne z tabelą media (karty, lista, Magazyn, stary frontend)."""
    if owner_type not in LEGACY_FIELDS:
        return
    obj = (db.query(models.Project).filter(models.Project.id == owner_id).first() if owner_type == "project"
           else db.query(models.OfficialComponent).filter(models.OfficialComponent.id == owner_id).first())
    if not obj:
        return
    rows = list_media(db, owner_type, owner_id)
    by_role = lambda r: [m.path for m in rows if m.role == r]
    main, schem, gal = by_role("main"), by_role("schematic"), by_role("gallery")
    obj.image_main = main[0] if main else None
    if owner_type == "project":
        obj.image_schematic = schem[0] if schem else None
        obj.image_gallery_1 = gal[0] if len(gal) > 0 else None
        obj.image_gallery_2 = gal[1] if len(gal) > 1 else None
    else:
        obj.image_gallery_1 = gal[0] if len(gal) > 0 else None
        obj.image_gallery_2 = gal[1] if len(gal) > 1 else None
        obj.image_gallery_3 = gal[2] if len(gal) > 2 else None


def _renumber(db: Session, owner_type: str, owner_id: int):
    for i, m in enumerate(list_media(db, owner_type, owner_id)):
        m.position = i


def delete_row(db: Session, m, resync: bool = True):
    owner_type, owner_id, was_main = m.owner_type, m.owner_id, m.role == "main"
    remove_static_file(m.path)
    db.delete(m)
    db.flush()
    if was_main:                                       # po usunięciu głównego awansuje pierwsza zwykła fotka
        nxt = next((r for r in list_media(db, owner_type, owner_id) if r.role == "gallery"), None)
        if nxt:
            nxt.role = "main"
    _renumber(db, owner_type, owner_id)
    if resync:
        sync_legacy(db, owner_type, owner_id)


def delete_owner(db: Session, owner_type: str, owner_id: int):
    """Wywoływane przy usuwaniu projektu/komponentu: kasuje pliki i wiersze."""
    for m in db.query(models.Media).filter(models.Media.owner_type == owner_type, models.Media.owner_id == owner_id).all():
        remove_static_file(m.path)
        db.delete(m)


async def ingest(db: Session, user, owner_type: str, owner_id: int, role: str, caption: str,
                 upload: UploadFile, replace: bool = False) -> dict:
    """Waliduje i zapisuje jeden obraz. Jedyna droga, którą pliki trafiają do mediów."""
    if role not in ROLES[owner_type]:
        raise HTTPException(status_code=400, detail=f"Rola „{role}” nie jest dostępna dla tego obiektu")
    raw = await read_limited(upload, CFG["max_file_bytes"])
    try:
        clean, ext, mime, w, h = validate_image(raw, CFG["max_file_bytes"])
    except ImageError as e:
        raise HTTPException(status_code=400, detail=str(e))

    to_replace = []
    if replace and role in ("main", "schematic"):
        to_replace = [m for m in list_media(db, owner_type, owner_id) if m.role == role]
    check_quotas(db, user, owner_type, owner_id, len(clean), replacing=len(to_replace))
    for m in to_replace:
        delete_row(db, m, resync=False)

    existing = list_media(db, owner_type, owner_id)
    has_main = any(m.role == "main" for m in existing)
    if role == "gallery" and not has_main:             # pierwsze zdjęcie obiektu → automatycznie główne
        role = "main"
    elif role == "main":                               # tylko jedno główne
        for m in existing:
            if m.role == "main":
                m.role = "gallery"

    rel = store_bytes(f"media/{owner_type}", ext, clean)
    try:
        orig = re.sub(r"[^\w.\- ]+", "_", os.path.basename(upload.filename or "plik"))[:120]
        row = models.Media(owner_type=owner_type, owner_id=owner_id, role=role, path=rel, original_name=orig,
                           mime=mime, size_bytes=len(clean), width=w, height=h, caption=(caption or "").strip()[:300],
                           position=len(existing) + 1, uploaded_by=user.id)
        db.add(row)
        db.flush()
        _renumber(db, owner_type, owner_id)
        sync_legacy(db, owner_type, owner_id)
        db.commit()
    except Exception:
        db.rollback()
        remove_static_file(rel)
        raise
    db.refresh(row)
    return item_dict(row)


# ── kompatybilność ze starymi endpointami /upload i /file/{field} ────────────
def legacy_slot(owner_type: str, field: str):
    slot = LEGACY_FIELDS.get(owner_type, {}).get(field)
    if not slot:
        raise HTTPException(status_code=400, detail="Nieprawidłowe pole zdjęcia")
    return slot


def legacy_delete(db: Session, owner_type: str, owner_id: int, field: str):
    role, _ = legacy_slot(owner_type, field)
    rows = [m for m in list_media(db, owner_type, owner_id) if m.role == role]
    if role == "gallery":
        idx = int(field.rsplit("_", 1)[1]) - 1
        rows = rows[idx:idx + 1]
    for m in rows:
        delete_row(db, m, resync=False)
    sync_legacy(db, owner_type, owner_id)
    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Migracja istniejących zdjęć (kolumny image_*) do tabeli media – idempotentna
# ─────────────────────────────────────────────────────────────────────────────
def migrate_legacy(session_factory) -> dict:
    stats = {"project": 0, "component": 0, "skipped_missing": 0}
    db = session_factory()
    try:
        def import_owner(owner_type, obj, slots):
            if db.query(func.count(models.Media.id)).filter(
                    models.Media.owner_type == owner_type, models.Media.owner_id == obj.id).scalar():
                return
            pos = 0
            for field, role in slots:
                rel = getattr(obj, field, None)
                full = safe_static_path(rel)
                if not rel:
                    continue
                if not full or not os.path.isfile(full):
                    stats["skipped_missing"] += 1
                    continue
                w = h = None
                mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
                        "webp": "image/webp", "gif": "image/gif"}.get(rel.rsplit(".", 1)[-1].lower())
                try:
                    with open(full, "rb") as fh:
                        head = fh.read(65536)
                    _, _, _, w, h = validate_image(head if len(head) < 65536 else open(full, "rb").read(), 64 * MB)
                except Exception:
                    pass
                pos += 1
                db.add(models.Media(owner_type=owner_type, owner_id=obj.id, role=role, path=rel,
                                    original_name=re.sub(r"^\d+_", "", os.path.basename(rel)), mime=mime,
                                    size_bytes=os.path.getsize(full), width=w, height=h, position=pos,
                                    uploaded_by=getattr(obj, "owner_id", None) if owner_type == "project" else None))
                stats[owner_type] += 1

        for p in db.query(models.Project).all():
            import_owner("project", p, [("image_main", "main"), ("image_schematic", "schematic"),
                                        ("image_gallery_1", "gallery"), ("image_gallery_2", "gallery")])
        for c in db.query(models.OfficialComponent).all():
            import_owner("component", c, [("image_main", "main"), ("image_gallery_1", "gallery"),
                                          ("image_gallery_2", "gallery"), ("image_gallery_3", "gallery")])
        db.commit()
    finally:
        db.close()
    return stats


# ─────────────────────────────────────────────────────────────────────────────
# API
# ─────────────────────────────────────────────────────────────────────────────
class MediaPatch(BaseModel):
    role: Optional[str] = None
    caption: Optional[str] = None


class MediaReorder(BaseModel):
    owner_type: str
    owner_id: int
    ids: List[int]


def build_router(get_db, get_current_user) -> APIRouter:
    router = APIRouter(prefix="/api/media", tags=["Media (zdjęcia)"])

    @router.get("")
    def media_list(owner_type: str, owner_id: int, db: Session = Depends(get_db)):
        if owner_type not in ROLES:
            raise HTTPException(status_code=400, detail="Nieznany typ obiektu")
        return [item_dict(m) for m in list_media(db, owner_type, owner_id)]

    @router.get("/limits")
    def media_limits(owner_type: str, owner_id: int = 0, db: Session = Depends(get_db), user=Depends(get_current_user)):
        if owner_type not in ROLES:
            raise HTTPException(status_code=400, detail="Nieznany typ obiektu")
        lim, u = limits_for(user, owner_type), usage(db, user, owner_type, owner_id)
        return {**lim, "owner_count": u["owner_count"], "used_mb": round(u["user_bytes"] / MB, 1)}

    @router.post("", status_code=201)
    async def media_upload(owner_type: str = Form(...), owner_id: int = Form(...), role: str = Form("gallery"),
                           caption: str = Form(""), file: UploadFile = File(...),
                           db: Session = Depends(get_db), user=Depends(get_current_user)):
        owner_exists_and_can_edit(db, user, owner_type, owner_id)
        return await ingest(db, user, owner_type, owner_id, role, caption, file)

    @router.patch("/{media_id}")
    def media_patch(media_id: int, data: MediaPatch, db: Session = Depends(get_db), user=Depends(get_current_user)):
        m = db.query(models.Media).filter(models.Media.id == media_id).first()
        if not m:
            raise HTTPException(status_code=404, detail="Nie znaleziono zdjęcia")
        owner_exists_and_can_edit(db, user, m.owner_type, m.owner_id)
        if data.caption is not None:
            m.caption = data.caption.strip()[:300]
        if data.role is not None and data.role != m.role:
            if data.role not in ROLES[m.owner_type]:
                raise HTTPException(status_code=400, detail="Rola niedostępna dla tego obiektu")
            if data.role == "main":
                for o in list_media(db, m.owner_type, m.owner_id):
                    if o.role == "main" and o.id != m.id:
                        o.role = "gallery"
            elif m.role == "main":                      # zdjęcie przestaje być głównym → awansuje następne zwykłe
                nxt = next((o for o in list_media(db, m.owner_type, m.owner_id) if o.role == "gallery" and o.id != m.id), None)
                if nxt:
                    nxt.role = "main"
            m.role = data.role
        db.flush()
        _renumber(db, m.owner_type, m.owner_id)
        sync_legacy(db, m.owner_type, m.owner_id)
        db.commit()
        db.refresh(m)
        return item_dict(m)

    @router.post("/reorder")
    def media_reorder(data: MediaReorder, db: Session = Depends(get_db), user=Depends(get_current_user)):
        owner_exists_and_can_edit(db, user, data.owner_type, data.owner_id)
        rows = {m.id: m for m in list_media(db, data.owner_type, data.owner_id)}
        order = [i for i in data.ids if i in rows]
        order += [i for i in rows if i not in order]
        for pos, i in enumerate(order, start=1):
            rows[i].position = pos
        db.flush()
        sync_legacy(db, data.owner_type, data.owner_id)
        db.commit()
        return [item_dict(m) for m in list_media(db, data.owner_type, data.owner_id)]

    @router.delete("/{media_id}")
    def media_delete(media_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
        m = db.query(models.Media).filter(models.Media.id == media_id).first()
        if not m:
            raise HTTPException(status_code=404, detail="Nie znaleziono zdjęcia")
        owner_exists_and_can_edit(db, user, m.owner_type, m.owner_id)
        delete_row(db, m)
        db.commit()
        return {"message": "Usunięto"}

    return router
