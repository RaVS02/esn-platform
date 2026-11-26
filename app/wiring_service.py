"""Edytor schematów połączeń – backend platformy (v38).

To samo API, którego używa edytor (`static/wiring/app.js`, funkcja api()), pod prefiksem /api/wiring:
  GET  /parts?q=&src=all|catalog|own&page=&limit=   lekka lista (bez pinów)
  GET  /parts/batch?ids=a,b                         pełne definicje (max 100)
  GET  /parts/{id}                                  jedna część
  PUT  /parts/{id}                                  część własna (zalogowani; id cat-* odrzucane)
  GET  /projects                                    schematy zalogowanego użytkownika
  GET  /projects/{id}                               schemat (+ rev, can_edit, project_id)
  POST /projects                                    nowy schemat (opcjonalnie project_id = projekt platformy)
  PUT  /projects/{id}                               zapis z blokadą optymistyczną: rev musi się zgadzać, inaczej 409
  DELETE /projects/{id}
  GET  /by-project/{project_id}                     schemat powiązany z projektem platformy (do karty projektu)

Części z katalogu = OfficialComponent z pinoutem (id 'cat-<id>'), w języku z nagłówka X-ESN-Lang (tłumaczenia komponentu
i pinoutu). Adapter (pin_type, component_to_part, INV_CAT) przeniesiony bez zmian z demo edytora (main.py repozytorium edytora).
Walidacja zapisu: clean_wiring – dozwolone pola i limity wg README edytora 10.2 (frontendowi nie ufamy).
"""
import json
import re
import time
import uuid
from collections import defaultdict, deque
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import func, or_, String as SAString
from sqlalchemy.orm import Session, defer

import models

LANGS = ("pl", "en")

# ── limity (README edytora 10.2 / 10.6) ─────────────────────────────────────────────────────────────
LIM = {
    "nodes": 60, "links": 400, "pts": 20, "notes": 100, "note_text": 1000, "label": 80, "link_note": 200, "title": 200,
    "value": 40, "gkeys": 400, "gkey": 120, "coord": 100000, "body": 256 * 1024,
    "schemas_per_user": 100, "parts_per_user": 200, "part_pins": 200, "part_name": 100, "part_desc": 500, "pin_text": 200,
    "saves_per_hour": 300,
}
WIRE_STYLES = ("curve", "ortho", "straight")
NOTE_C = ("info", "warn", "ok")
PART_CATS = ("MCU", "Zasilanie", "Układ", "Moduł", "Czujnik", "Wyświetlacz", "Wykonawczy", "Dioda", "Tranzystor", "Rezystor",
             "Kondensator", "Złącze", "Inne")
PART_ICONS = ("mcu", "ic", "module", "sensor", "display", "power", "conn", "res", "cap", "diode", "trans", "act", "box")
PIN_TYPES = ("power", "gnd", "analog", "digital", "spi", "i2c", "i2s", "uart", "usb", "can", "pwm", "debug", "rf", "clock",
             "control", "nc", "other", "gpio", "pass", "i2c_sda", "i2c_scl", "spi_sck", "spi_mosi", "spi_miso", "spi_cs",
             "uart_tx", "uart_rx")
ID_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,64}$")
CAT_ID_RE = re.compile(r"^cat-(\d{1,9})$")

# ── adapter katalogu (bez zmian względem demo edytora) ──────────────────────────────────────────────
CAT_TYPE = {"power": "power", "ground": "gnd", "analog": "analog", "digital": "digital", "spi": "spi", "i2c": "i2c",
            "i2s": "i2s", "uart": "uart", "usb": "usb", "can": "can", "pwm": "pwm", "debug": "debug", "rf": "rf",
            "clock": "clock", "control": "control", "nc": "nc", "other": "other"}
INV_CAT = {"Mikrokontrolery": "MCU", "Zasilacze": "Zasilanie", "Zasilanie": "Zasilanie", "Czujniki": "Czujnik",
           "Układy scalone": "Układ", "Moduły": "Moduł", "Wyświetlacze": "Wyświetlacz", "Diody": "Dioda",
           "Kondensatory": "Kondensator", "Rezystory": "Rezystor", "Tranzystory": "Tranzystor", "Złącza": "Złącze",
           "Aktuatory": "Wykonawczy", "Silniki": "Wykonawczy"}
CAT_RANK = {c: i for i, c in enumerate(["Zasilanie", "MCU", "Moduł", "Układ", "Wyświetlacz", "Czujnik", "Wykonawczy",
                                        "Dioda", "Tranzystor", "Rezystor", "Kondensator", "Złącze", "Inne"])}


def pin_type(cat, name):
    """Kategoria katalogu (spi/i2c/uart…) + nazwa pinu -> rola sygnału używana do walidacji (np. spi_mosi)."""
    n = (name or "").upper().replace(" ", "")
    if cat == "spi":
        if n.startswith(("SCLK", "SCK", "CLK")):
            return "spi_sck"
        if n.startswith(("MOSI", "SDI", "DIN", "COPI")):
            return "spi_mosi"
        if n.startswith(("MISO", "SDO", "DOUT", "CIPO")):
            return "spi_miso"
        if n.startswith(("CSB", "CS", "SS", "NSS", "CSN")):
            return "spi_cs"
    if cat == "i2c":
        if n.startswith("SDA"):
            return "i2c_sda"
        if n.startswith("SCL"):
            return "i2c_scl"
    if cat == "uart":
        if "TX" in n and "RX" not in n:
            return "uart_tx"
        if "RX" in n:
            return "uart_rx"
    return CAT_TYPE.get(cat, "other")


def component_to_part(cid, name, inv_cat, desc, po, datasheet=None, image=None):
    """OfficialComponent (+ pinout) -> część edytora. Id pinu = numer wyprowadzenia (stabilny, nazwy GND się powtarzają)."""
    layout = po.get("layout") or ""
    pins_src = [p for p in po.get("pins", []) if not p.get("pad")]
    n = len(pins_src)

    def side(i, p):
        if layout in ("quad", "dual", "sot23"):          # pierwsza połowa numeracji = lewa strona schematu
            return "L" if i < (n + 1) // 2 else "R"
        if layout == "board":
            try:
                return "L" if float(p.get("x", 0)) < 50 else "R"
            except (TypeError, ValueError):
                return "L"
        return "L"

    pins = []
    for i, p in enumerate(pins_src):
        num = str(p.get("n", i + 1))
        pins.append({"id": num, "num": num, "name": p.get("name") or num, "type": pin_type(p.get("cat"), p.get("name")),
                     "desc": p.get("fn", ""), "note": p.get("note", ""), "side": side(i, p)})
    return {"id": f"cat-{cid}", "source": "catalog", "catalog_id": cid, "name": name,
            "category": INV_CAT.get(inv_cat, "Inne"), "inv_category": inv_cat, "desc": desc or "",
            "package": po.get("package", ""), "datasheet": datasheet, "image": image, "pins": pins}


# ── język treści (tłumaczenia komponentu i pinoutu, v33) ────────────────────────────────────────────
def request_lang(request: Request) -> Optional[str]:
    for raw in (request.query_params.get("lang"), request.headers.get("x-esn-lang")):
        code = str(raw or "").split(",")[0].strip().lower().split("-")[0]
        if code in LANGS:
            return code
    return None


def localized_pinout(po: dict, lang: Optional[str]) -> dict:
    """Pinout z nałożonym tłumaczeniem pinów (fn, note) – struktura (numery, kategorie) wspólna dla wszystkich języków."""
    tr = ((po or {}).get("translations") or {}).get(lang) if lang and lang != (po or {}).get("lang", "pl") else None
    if not tr:
        return po or {}
    pins_tr = tr.get("pins") or {}
    out = dict(po)
    out["pins"] = []
    for p in po.get("pins") or []:
        t = pins_tr.get(str(p.get("n"))) or {}
        q = dict(p)
        if t.get("fn"):
            q["fn"] = t["fn"]
        if t.get("note"):
            q["note"] = t["note"]
        out["pins"].append(q)
    return out


def localized_comp(c, lang: Optional[str]):
    name, desc = c.name, c.description
    base = getattr(c, "base_lang", None) or "pl"
    tr = (getattr(c, "translations", None) or {}).get(lang) if lang and lang != base else None
    if tr:
        name = tr.get("name") or name
        desc = tr.get("description") or desc
    return name, desc


def catalog_part(c, lang: Optional[str]) -> dict:
    name, desc = localized_comp(c, lang)
    image = ("/static/" + c.image_main.lstrip("/")) if c.image_main and not c.image_main.startswith(("/", "http")) else c.image_main
    return component_to_part(c.id, name, c.inventory_category, desc, localized_pinout(c.pinout, lang), c.datasheet_url, image)


# ── walidacja ────────────────────────────────────────────────────────────────────────────────────────
def _txt(v, n) -> str:
    return v.strip()[:n] if isinstance(v, str) else ""


def _num(v, lo=-LIM["coord"], hi=LIM["coord"]):
    if isinstance(v, bool) or not isinstance(v, (int, float)) or v != v or v in (float("inf"), float("-inf")):
        return None
    return v if lo <= v <= hi else None


def _pts(arr):
    out = []
    for q in (arr if isinstance(arr, list) else [])[:LIM["pts"]]:
        if isinstance(q, dict):
            x, y = _num(q.get("x")), _num(q.get("y"))
            if x is not None and y is not None:
                out.append({"x": x, "y": y})
    return out


def _lp(v):
    if v in ("mid", "longest"):
        return v
    n = _num(v, 0, 1)
    return n


def clean_part_ref(v) -> Optional[str]:
    s = str(v or "")
    return s if ID_RE.match(s) else None


def clean_wiring(body: dict) -> dict:
    """Schemat od klienta -> tylko dozwolone pola i wartości (README edytora 10.2). Nieznane klucze są odrzucane."""
    if not isinstance(body, dict):
        raise HTTPException(400, detail="Nieprawidłowe dane schematu")
    nodes_in, links_in = body.get("nodes") or [], body.get("links") or []
    if not isinstance(nodes_in, list) or not isinstance(links_in, list):
        raise HTTPException(400, detail="Nieprawidłowe dane schematu")
    if len(nodes_in) > LIM["nodes"]:
        raise HTTPException(400, detail=f"Za dużo części w schemacie (max {LIM['nodes']})")
    if len(links_in) > LIM["links"]:
        raise HTTPException(400, detail=f"Za dużo połączeń w schemacie (max {LIM['links']})")

    out = {"wire": body.get("wire") if body.get("wire") in WIRE_STYLES else "curve"}
    if body.get("orient") in ("def", "auto"):
        out["orient"] = body["orient"]
    if body.get("density") == "compact":
        out["density"] = "compact"
    if body.get("generated_with_ai") is True:
        out["generated_with_ai"] = True

    nodes, ids = [], set()
    for n in nodes_in:
        if not isinstance(n, dict):
            continue
        nid, part = clean_part_ref(n.get("id")), clean_part_ref(n.get("part"))
        x, y = _num(n.get("x")), _num(n.get("y"))
        if not nid or not part or nid in ids or x is None or y is None:
            continue
        o = {"id": nid, "part": part, "label": _txt(n.get("label"), LIM["label"]), "x": x, "y": y}
        if n.get("label_en"):
            o["label_en"] = _txt(n.get("label_en"), LIM["label"])
        if n.get("flip") is True:
            o["flip"] = True
        if n.get("collapsed") is True:
            o["collapsed"] = True
        w, h = _num(n.get("w"), 120, 900), _num(n.get("h"), 40, 1200)
        if w is not None:
            o["w"] = w
        if h is not None:
            o["h"] = h
        val = _txt(n.get("value"), LIM["value"])
        if val:
            o["value"] = val
        ids.add(nid)
        nodes.append(o)
    out["nodes"] = nodes

    links, lids = [], set()
    for ln in links_in:
        if not isinstance(ln, dict) or not isinstance(ln.get("a"), dict) or not isinstance(ln.get("b"), dict):
            continue
        lid = clean_part_ref(ln.get("id"))
        a, b = ln["a"], ln["b"]
        an, bn = str(a.get("n", "")), str(b.get("n", ""))
        ap, bp = clean_part_ref(a.get("p")), clean_part_ref(b.get("p"))
        if not lid or lid in lids or an not in ids or bn not in ids or not ap or not bp:
            continue
        o = {"id": lid, "a": {"n": an, "p": ap}, "b": {"n": bn, "p": bp}, "note": _txt(ln.get("note"), LIM["link_note"])}
        if ln.get("note_en"):
            o["note_en"] = _txt(ln.get("note_en"), LIM["link_note"])
        if ln.get("style") in WIRE_STYLES:
            o["style"] = ln["style"]
        pts = _pts(ln.get("pts"))
        if pts:
            o["pts"] = pts
        lp = _lp(ln.get("lp"))
        if lp is not None:
            o["lp"] = lp
        lids.add(lid)
        links.append(o)
    out["links"] = links

    gl = body.get("glabels")
    if isinstance(gl, dict):
        g = {}
        for k, v in list(gl.items())[:LIM["gkeys"]]:
            lp = _lp(v)
            if isinstance(k, str) and len(k) <= LIM["gkey"] and lp is not None:
                g[k] = lp
        if g:
            out["glabels"] = g
    gp = body.get("gpts")
    if isinstance(gp, dict):
        g = {}
        for k, v in list(gp.items())[:LIM["gkeys"]]:
            pts = _pts(v)
            if isinstance(k, str) and len(k) <= LIM["gkey"] and pts:
                g[k] = pts
        if g:
            out["gpts"] = g
    notes_in = body.get("notes")
    if isinstance(notes_in, list):
        notes, nids = [], set()
        for x in notes_in[:LIM["notes"]]:
            if not isinstance(x, dict):
                continue
            tid = clean_part_ref(x.get("id"))
            nx, ny = _num(x.get("x")), _num(x.get("y"))
            if not tid or tid in nids or nx is None or ny is None:
                continue
            o = {"id": tid, "x": nx, "y": ny, "text": x.get("text")[:LIM["note_text"]] if isinstance(x.get("text"), str) else ""}
            if x.get("c") in NOTE_C:
                o["c"] = x["c"]
            w = _num(x.get("w"), 80, 600)
            if w is not None:
                o["w"] = w
            nids.add(tid)
            notes.append(o)
        if notes:
            out["notes"] = notes
    return out


def clean_part(pid: str, body: dict) -> dict:
    """Część własna użytkownika (README edytora 10.2: icon z listy, image tylko ścieżka/http(s), limity)."""
    if not isinstance(body, dict):
        raise HTTPException(400, detail="Nieprawidłowa definicja części")
    name = _txt(body.get("name"), LIM["part_name"])
    if not name:
        raise HTTPException(400, detail="Część musi mieć nazwę")
    pins_in = body.get("pins") or []
    if not isinstance(pins_in, list) or len(pins_in) > LIM["part_pins"]:
        raise HTTPException(400, detail=f"Za dużo wyprowadzeń (max {LIM['part_pins']})")
    o = {"id": pid, "name": name, "category": body.get("category") if body.get("category") in PART_CATS else "Inne",
         "desc": _txt(body.get("desc"), LIM["part_desc"])}
    for k, n in (("name_en", LIM["part_name"]), ("desc_en", LIM["part_desc"])):
        if body.get(k):
            o[k] = _txt(body[k], n)
    if body.get("icon") in PART_ICONS:
        o["icon"] = body["icon"]
    img = _txt(body.get("image"), 300)
    if img and re.match(r"^(https?://|/)[^\s\"'<>]*$", img) and not img.startswith("//"):
        o["image"] = img
    pins, seen = [], set()
    for p in pins_in:
        if not isinstance(p, dict):
            continue
        pin_id = clean_part_ref(p.get("id"))
        if not pin_id or pin_id in seen:
            continue
        q = {"id": pin_id, "name": _txt(p.get("name"), 40) or pin_id,
             "type": p.get("type") if p.get("type") in PIN_TYPES else "other", "desc": _txt(p.get("desc"), LIM["pin_text"])}
        if p.get("desc_en"):
            q["desc_en"] = _txt(p["desc_en"], LIM["pin_text"])
        v = _txt(p.get("v"), 10)
        if v and re.match(r"^[0-9]+([.,][0-9]+)?$", v):
            q["v"] = v.replace(",", ".")
        if p.get("side") in ("L", "R"):
            q["side"] = p["side"]
        seen.add(pin_id)
        pins.append(q)
    o["pins"] = pins
    return o


def summary(p: dict) -> dict:
    """Lekki opis części do listy – BEZ pinów (tylko ich liczba)."""
    return {"id": p["id"], "name": p["name"], "name_en": p.get("name_en"), "category": p.get("category", "Inne"),
            "desc": p.get("desc", ""), "desc_en": p.get("desc_en"), "pins": p.get("pins_count", len(p.get("pins", []))),
            "source": p.get("source", "own"), "package": p.get("package", ""), "icon": p.get("icon"), "image": p.get("image")}


def is_admin(u) -> bool:
    return bool(u) and getattr(u, "role", None) == "admin"


class _Rate:
    """Prosty limit częstości zapisów (na użytkownika, w pamięci procesu)."""
    def __init__(self, per_hour: int):
        self.per_hour, self.hits = per_hour, defaultdict(deque)

    def check(self, key):
        now, q = time.time(), self.hits[key]
        while q and now - q[0] > 3600:
            q.popleft()
        if len(q) >= self.per_hour:
            raise HTTPException(429, detail="Za dużo zapisów – spróbuj za chwilę")
        q.append(now)


def _no_store(response: Response):
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Vary"] = "Authorization"


def build_router(get_db, get_current_user, get_optional_user) -> APIRouter:
    router = APIRouter(prefix="/api/wiring", tags=["Schematy połączeń"],
                       dependencies=[Depends(_no_store)])   # odpowiedzi zależą od użytkownika (can_edit) – bez cache przeglądarki
    S, P, C, PR = models.WiringSchema, models.WiringPart, models.OfficialComponent, models.Project
    rate = _Rate(LIM["saves_per_hour"])

    def can_edit(user, row, db=None) -> bool:
        """Autor schematu lub admin; dla schematu w projekcie także autor projektu."""
        if not user:
            return False
        if is_admin(user) or row.owner_id == user.id:
            return True
        if row.project_id is not None and db is not None:
            pr = db.query(PR).filter(PR.id == row.project_id).first()
            return bool(pr) and pr.owner_id == user.id
        return False

    def can_view(user, row, db=None) -> bool:
        return row.project_id is not None or can_edit(user, row, db)      # schemat w projekcie jest publiczny jak projekt

    def doc(row, user, db=None) -> dict:
        d = dict(row.data or {})
        d.update({"id": row.id, "title": row.title or "", "rev": row.rev, "project_id": row.project_id,
                  "can_edit": can_edit(user, row, db)})
        if row.title_en:
            d["title_en"] = row.title_en
        return d

    def get_row(db, sid) -> models.WiringSchema:
        row = db.query(S).filter(S.id == str(sid)[:16]).first()
        if not row:
            raise HTTPException(404, detail="Nie ma takiego schematu")
        return row

    async def read_body(request: Request) -> dict:
        raw = await request.body()
        if len(raw) > LIM["body"]:
            raise HTTPException(413, detail="Schemat jest za duży")
        try:
            data = json.loads(raw or b"{}")
        except ValueError:
            raise HTTPException(400, detail="Nieprawidłowe dane schematu")
        if not isinstance(data, dict):
            raise HTTPException(400, detail="Nieprawidłowe dane schematu")
        return data

    def sync_components(db, row):
        """Schemat w projekcie → podzespoły z katalogu użyte w schemacie dopisywane do listy podzespołów projektu
        (project_components; README edytora 10.7). Tylko dopisywanie – ręcznie dodanych pozycji nic nie usuwa."""
        if row.project_id is None:
            return 0
        used = []
        for n in (row.data or {}).get("nodes") or []:
            m = CAT_ID_RE.match(str(n.get("part", "")))
            if m and int(m.group(1)) not in used:
                used.append(int(m.group(1)))
        if not used:
            return 0
        PC = models.ProjectComponent
        have = {cid for (cid,) in db.query(PC.component_id).filter(PC.project_id == row.project_id).all()}
        exist = {cid for (cid,) in db.query(C.id).filter(C.id.in_(used)).all()}
        new = [cid for cid in used if cid in exist and cid not in have][:max(0, 40 - len(have))]   # limit jak w content_service
        pos = (db.query(func.max(PC.position)).filter(PC.project_id == row.project_id).scalar() or 0) + 1
        for i, cid in enumerate(new):
            db.add(PC(project_id=row.project_id, component_id=cid, position=pos + i))
        return len(new)

    def check_project(db, user, project_id):
        if project_id is None:
            return None
        try:
            pid = int(project_id)
        except (TypeError, ValueError):
            raise HTTPException(400, detail="Nieprawidłowy projekt")
        pr = db.query(PR).filter(PR.id == pid).first()
        if not pr:
            raise HTTPException(404, detail="Nie ma takiego projektu")
        if not (is_admin(user) or pr.owner_id == user.id):
            raise HTTPException(403, detail="Brak uprawnień do tego projektu")
        if db.query(S).filter(S.project_id == pid).first():
            raise HTTPException(409, detail="Projekt ma już schemat połączeń")
        return pid

    # ── części ──────────────────────────────────────────────────────────────────────────────────────
    def own_parts(db, user):
        if not user:
            return []
        return [dict(r.data or {}, id=r.part_id) for r in db.query(P).filter(P.owner_id == user.id).all()]

    def catalog_summaries(db, lang, q):
        cnt = func.json_array_length(C.pinout["pins"])
        qry = db.query(C, cnt).options(defer(C.pinout)).filter(C.pinout.isnot(None)).filter(cnt > 0)
        if q:
            like = f"%{q}%"
            qry = qry.filter(or_(C.name.ilike(like), C.symbol.ilike(like), C.description.ilike(like),
                                 C.inventory_category.ilike(like), C.tags.cast(SAString).ilike(like),
                                 C.translations.cast(SAString).ilike(like)))
        out = []
        for c, n in qry.all():
            name, desc = localized_comp(c, lang)
            image = ("/static/" + c.image_main.lstrip("/")) if c.image_main and not c.image_main.startswith(("/", "http")) else c.image_main
            out.append({"id": f"cat-{c.id}", "name": name, "category": INV_CAT.get(c.inventory_category, "Inne"), "desc": desc or "",
                        "pins_count": n or 0, "source": "catalog", "package": "", "image": image})
        return out

    @router.get("/parts")
    def list_parts(request: Request, q: str = "", src: str = "all", page: int = 1, limit: int = 30,
                   db: Session = Depends(get_db), user=Depends(get_optional_user)):
        q = (q or "").strip()[:100]
        lang = request_lang(request)
        items = []
        if src in ("all", "catalog"):
            items += catalog_summaries(db, lang, q)
        if src in ("all", "own"):
            ql = q.lower()
            items += [p for p in own_parts(db, user)
                      if not ql or ql in " ".join(str(p.get(k) or "") for k in ("name", "name_en", "desc", "desc_en", "category")).lower()]
        items.sort(key=lambda p: (CAT_RANK.get(p.get("category"), 99), str(p.get("name", "")).lower()))
        limit, page = max(1, min(limit, 100)), max(1, page)
        total = len(items)
        return {"items": [summary(p) for p in items[(page - 1) * limit: page * limit]],
                "total": total, "page": page, "pages": max(1, -(-total // limit))}

    def resolve_parts(db, user, ids, lang, owner_ids=()):
        cat_ids = [int(m.group(1)) for m in (CAT_ID_RE.match(i) for i in ids) if m]
        out = {}
        if cat_ids:
            for c in db.query(C).filter(C.id.in_(cat_ids)).all():
                if c.pinout and c.pinout.get("pins"):
                    p = catalog_part(c, lang)
                    out[p["id"]] = p
        own = [i for i in ids if not CAT_ID_RE.match(i)]
        if own:
            # najpierw części zalogowanego, potem właścicieli wskazanych schematów, na końcu dowolne o tym id
            rows = db.query(P).filter(P.part_id.in_(own)).all()
            pref = [getattr(user, "id", None)] + list(owner_ids)
            rows.sort(key=lambda r: pref.index(r.owner_id) if r.owner_id in pref else len(pref))
            for r in rows:
                out.setdefault(r.part_id, dict(r.data or {}, id=r.part_id))
        return out

    @router.get("/parts/batch")
    def parts_batch(request: Request, ids: str = "", db: Session = Depends(get_db), user=Depends(get_optional_user)):
        wanted = [x for x in ids.split(",") if x and ID_RE.match(x)][:100]
        by = resolve_parts(db, user, wanted, request_lang(request))
        return [by[i] for i in wanted if i in by]

    @router.get("/parts/{pid}")
    def get_part(pid: str, request: Request, db: Session = Depends(get_db), user=Depends(get_optional_user)):
        by = resolve_parts(db, user, [pid], request_lang(request)) if ID_RE.match(pid) else {}
        if pid not in by:
            raise HTTPException(404, detail="Nie ma takiej części")
        return by[pid]

    @router.put("/parts/{pid}")
    async def put_part(pid: str, request: Request, db: Session = Depends(get_db), user=Depends(get_current_user)):
        if pid.startswith("cat-"):
            raise HTTPException(400, detail="Części z katalogu edytuje się w katalogu platformy")
        if not ID_RE.match(pid):
            raise HTTPException(400, detail="Nieprawidłowy identyfikator części")
        rate.check(user.id)
        part = clean_part(pid, await read_body(request))
        row = db.query(P).filter(P.owner_id == user.id, P.part_id == pid).first()
        if not row:
            if db.query(P).filter(P.owner_id == user.id).count() >= LIM["parts_per_user"]:
                raise HTTPException(400, detail=f"Osiągnięto limit części własnych ({LIM['parts_per_user']})")
            row = P(owner_id=user.id, part_id=pid)
            db.add(row)
        row.data = part
        db.commit()
        return part

    # ── schematy ────────────────────────────────────────────────────────────────────────────────────
    @router.get("/projects")
    def list_projects(db: Session = Depends(get_db), user=Depends(get_optional_user)):
        if not user:
            return []
        rows = db.query(S).filter(S.owner_id == user.id).order_by(S.updated_at.desc().nullslast(), S.created_at.desc()).all()
        pids = [r.project_id for r in rows if r.project_id]
        prj = {p.id: p for p in db.query(PR).filter(PR.id.in_(pids)).all()} if pids else {}

        def item(r):
            d, p = r.data or {}, prj.get(r.project_id)
            when = r.updated_at or r.created_at
            return {"id": r.id, "title": r.title or r.id, "title_en": r.title_en, "project_id": r.project_id,
                    "project": {"id": p.id, "title": p.title, "slug": p.slug} if p else None,
                    "parts": len(d.get("nodes") or []), "links": len(d.get("links") or []), "rev": r.rev,
                    "updated_at": when.isoformat() if when else None}
        return [item(r) for r in rows]

    @router.get("/linkable-projects")
    def linkable_projects(db: Session = Depends(get_db), user=Depends(get_current_user)):
        """Projekty, do których użytkownik może podpiąć schemat (własne; admin – wszystkie), bez schematu."""
        taken = {pid for (pid,) in db.query(S.project_id).filter(S.project_id.isnot(None)).all()}
        q = db.query(PR)
        if not is_admin(user):
            q = q.filter(PR.owner_id == user.id)
        rows = q.order_by(PR.created_at.desc()).limit(300).all()
        return [{"id": p.id, "title": p.title, "slug": p.slug, "own": p.owner_id == user.id} for p in rows if p.id not in taken]

    @router.put("/projects/{sid}/link")
    async def link_project(sid: str, request: Request, db: Session = Depends(get_db), user=Depends(get_current_user)):
        """Podpięcie schematu do projektu ({project_id}) albo odpięcie ({project_id: null})."""
        row = get_row(db, sid)
        if not can_edit(user, row, db):
            raise HTTPException(403, detail="Brak uprawnień do edycji schematu")
        body = await read_body(request)
        pid = body.get("project_id")
        row.project_id = None if pid is None else check_project(db, user, pid)
        if row.project_id is not None:
            sync_components(db, row)
        db.commit()
        db.refresh(row)
        return doc(row, user, db)

    @router.get("/projects/{sid}")
    def get_project(sid: str, db: Session = Depends(get_db), user=Depends(get_optional_user)):
        row = get_row(db, sid)
        if not can_view(user, row, db):
            raise HTTPException(404, detail="Nie ma takiego schematu")
        return doc(row, user, db)

    @router.post("/projects")
    async def new_project(request: Request, db: Session = Depends(get_db), user=Depends(get_current_user)):
        body = await read_body(request)
        rate.check(user.id)
        if db.query(S).filter(S.owner_id == user.id).count() >= LIM["schemas_per_user"]:
            raise HTTPException(400, detail=f"Osiągnięto limit schematów ({LIM['schemas_per_user']})")
        project_id = check_project(db, user, body.get("project_id"))
        data = clean_wiring(body)
        if "orient" not in data:
            data["orient"] = "auto"                          # domyślne dla nowych projektów (jak w demo)
        row = S(id=uuid.uuid4().hex[:8], owner_id=user.id, project_id=project_id, rev=1,
                title=_txt(body.get("title"), LIM["title"]) or "Schemat", title_en=_txt(body.get("title_en"), LIM["title"]) or None,
                data=data)
        db.add(row)
        sync_components(db, row)
        db.commit()
        db.refresh(row)
        return doc(row, user, db)

    @router.put("/projects/{sid}")
    async def put_project(sid: str, request: Request, db: Session = Depends(get_db), user=Depends(get_current_user)):
        row = get_row(db, sid)
        if not can_edit(user, row, db):
            raise HTTPException(403, detail="Brak uprawnień do edycji schematu")
        body = await read_body(request)
        if body.get("rev") != row.rev:
            # blokada optymistyczna: ktoś zapisał w międzyczasie – edytor pyta: wczytaj nowszą / zapisz jako kopię
            raise HTTPException(409, detail={"message": "Schemat został zmieniony w międzyczasie", "rev": row.rev})
        rate.check(user.id)
        row.data = clean_wiring(body)
        row.title = _txt(body.get("title"), LIM["title"]) or row.title
        row.title_en = _txt(body.get("title_en"), LIM["title"]) or None
        row.rev = row.rev + 1
        sync_components(db, row)
        db.commit()
        db.refresh(row)
        return doc(row, user, db)

    @router.delete("/projects/{sid}")
    def del_project(sid: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
        row = get_row(db, sid)
        if not can_edit(user, row, db):
            raise HTTPException(403, detail="Brak uprawnień do edycji schematu")
        db.delete(row)
        db.commit()
        return {"ok": True}

    @router.get("/usage/component/{component_id}")
    def component_usage(component_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
        """Ile schematów używa komponentu (ostrzeżenie przed usunięciem z katalogu – README edytora 10.4)."""
        if not is_admin(user):
            raise HTTPException(403, detail="Wymagane uprawnienia administratora")
        needle = f'%"cat-{int(component_id)}"%'
        rows = db.query(S.id, S.title, S.project_id).filter(S.data.cast(SAString).like(needle)).all()
        exact = []
        for sid, title, pid in rows:      # LIKE to wstępne sito – sprawdzenie dokładne na węzłach
            r = db.query(S).filter(S.id == sid).first()
            if any(str(n.get("part")) == f"cat-{int(component_id)}" for n in (r.data or {}).get("nodes") or []):
                exact.append({"id": sid, "title": title, "project_id": pid})
        return {"count": len(exact), "schemas": exact[:20]}

    @router.get("/by-project/{project_id}")
    def by_project(project_id: int, db: Session = Depends(get_db), user=Depends(get_optional_user)):
        pr = db.query(PR).filter(PR.id == project_id).first()
        if not pr:
            raise HTTPException(404, detail="Nie ma takiego projektu")
        row = db.query(S).filter(S.project_id == project_id).first()
        can = bool(user) and (is_admin(user) or pr.owner_id == user.id)
        return {"schema": ({"id": row.id, "title": row.title, "rev": row.rev, "can_edit": can_edit(user, row, db),
                            "parts": len((row.data or {}).get("nodes") or []), "links": len((row.data or {}).get("links") or [])}
                           if row else None),
                "can_create": can and not row}

    return router
