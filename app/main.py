import re
import sys
try:   # v56: komunikaty startowe od razu w `docker compose logs` (bez PYTHONUNBUFFERED stdout w kontenerze jest buforowany)
    sys.stdout.reconfigure(line_buffering=True)
except Exception:
    pass
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
from fastapi import FastAPI, Request, Depends, HTTPException, status, Query,Form
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session,joinedload
from sqlalchemy import String as SAString
from fastapi import Response
from datetime import datetime, timedelta
from typing import List, Optional
import os
from fastapi import UploadFile, File
import shutil
from pydantic import BaseModel
import models, schemas, utils, auth, mail_i18n
from database import engine, get_db, SessionLocal
import media_service
import ai_service
import content_service
import security_service
import profile_service
import admin_service
import knowledge_service
import wiring_service
from fastapi.responses import JSONResponse

# Inicjalizacja bazy
models.Base.metadata.create_all(bind=engine)

# create_all nie dodaje kolumn do istniejących tabel – lekka migracja dla pola pinout
from sqlalchemy import text as _sql_text
with engine.begin() as _conn:
    _conn.execute(_sql_text("ALTER TABLE official_components ADD COLUMN IF NOT EXISTS pinout JSON"))
    # Wiedza: wersje językowe treści i kursów
    for _tbl in ("knowledge_articles", "knowledge_courses"):
        _conn.execute(_sql_text("ALTER TABLE " + _tbl + " ADD COLUMN IF NOT EXISTS lang VARCHAR(5) NOT NULL DEFAULT 'pl'"))
        _conn.execute(_sql_text("ALTER TABLE " + _tbl + " ADD COLUMN IF NOT EXISTS translation_group VARCHAR(36)"))
        _conn.execute(_sql_text("CREATE INDEX IF NOT EXISTS ix_" + _tbl + "_lang ON " + _tbl + " (lang)"))
        _conn.execute(_sql_text("CREATE INDEX IF NOT EXISTS ix_" + _tbl + "_translation_group ON " + _tbl + " (translation_group)"))
    # Komponenty: język bazowy i tłumaczenia (jeden rekord, wiele wersji językowych)
    _conn.execute(_sql_text("ALTER TABLE users ADD COLUMN IF NOT EXISTS lang VARCHAR(5)"))
    _conn.execute(_sql_text("ALTER TABLE official_components ADD COLUMN IF NOT EXISTS base_lang VARCHAR(5) NOT NULL DEFAULT 'pl'"))
    _conn.execute(_sql_text("ALTER TABLE official_components ADD COLUMN IF NOT EXISTS translations JSON"))
    _conn.execute(_sql_text("ALTER TABLE official_components ADD COLUMN IF NOT EXISTS shops JSON"))
    # Projekty: język treści
    _conn.execute(_sql_text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS lang VARCHAR(5) NOT NULL DEFAULT 'pl'"))
    _conn.execute(_sql_text("CREATE INDEX IF NOT EXISTS ix_projects_lang ON projects (lang)"))
    # Asystent AI (limity dzienne + własny klucz)
    for _ddl in ("ai_requests_today INTEGER NOT NULL DEFAULT 0", "last_ai_request_date DATE", "ai_provider VARCHAR(20)",
                 "ai_model VARCHAR(80)", "ai_key_enc TEXT", "ai_key_hint VARCHAR(12)"):
        _conn.execute(_sql_text("ALTER TABLE users ADD COLUMN IF NOT EXISTS " + _ddl))
    # Profil publiczny i prywatność (v61)
    for _ddl in profile_service.DDL + admin_service.DDL:
        _conn.execute(_sql_text("ALTER TABLE users ADD COLUMN IF NOT EXISTS " + _ddl))

app = FastAPI(title="ESN Platform API")

# Istniejące zdjęcia (kolumny image_*) → tabela media. Idempotentne, nigdy nie blokuje startu aplikacji.
try:
    print("[media] migracja zdjęć:", media_service.migrate_legacy(SessionLocal))
except Exception as _e:
    print("[media] UWAGA: migracja zdjęć nie powiodła się:", _e)
try:
    print("[wiedza] przykładowe treści:", knowledge_service.seed_pilot(SessionLocal))
    print("[wiedza] partie z archiwum:", knowledge_service.import_batches(SessionLocal))
except Exception as _e:
    print("[wiedza] UWAGA: nie udało się dodać przykładowych treści:", _e)
try:
    print("[content] migracja relacji i kodu:", content_service.migrate(SessionLocal))
except Exception as _e:
    print("[content] UWAGA: migracja relacji/kodu nie powiodła się:", _e)
try:
    print("[content] datasheet/GitHub → zasoby:", content_service.migrate_legacy_links(SessionLocal))
except Exception as _e:
    print("[content] UWAGA: przeniesienie linków do zasobów nie powiodło się:", _e)



@app.middleware("http")
async def _security_headers(request: Request, call_next):
    """v60: nagłówki bezpieczeństwa (security_service.security_headers)."""
    response = await call_next(request)
    security_service.security_headers(request, response)
    return response

@app.middleware("http")
async def upload_guard(request: Request, call_next):
    """1) odrzuca zbyt duże żądania zanim zostaną wczytane, 2) utwardza pliki wgrane przez użytkowników."""
    if request.method in ("POST", "PUT", "PATCH") and request.url.path.startswith("/api/"):
        cl = request.headers.get("content-length")
        if cl and cl.isdigit() and int(cl) > media_service.CFG["max_request_bytes"]:
            return JSONResponse({"detail": "Żądanie jest za duże."}, status_code=413)
    response = await call_next(request)
    parts = request.url.path.split("/")
    if len(parts) > 2 and parts[1] == "static" and parts[2] in ("media", "files", "projects", "catalog", "avatars"):
        # Nawet gdyby w katalogu uploadów znalazł się stary plik .html/.svg – przeglądarka nie wykona w nim skryptów.
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox"
    return response

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")
mailer = utils.MailBot()

# --- ZABEZPIECZENIA (Bramkarz JWT) ---
security = HTTPBearer()

def create_user_inventory(user_id: int):
    base_path = "/app/esn_magazyn/instance"
    user_db_filename = f"user_{user_id}.db"
    full_path = f"{base_path}/{user_db_filename}"

    if not os.path.exists(full_path):
        os.makedirs(base_path, exist_ok=True)
        open(full_path, 'w').close()

    return full_path

optional_security = HTTPBearer(auto_error=False)

SESSION_COOKIE = "esn_access_token"
SAFE_METHODS = ("GET", "HEAD", "OPTIONS")
CSRF_HEADER = "x-esn-req"          # dodaje go owinięty fetch w static/i18n.js; strona obca nie ustawi go bez zgody CORS


def _session_payload(request: Request, credentials: Optional[HTTPAuthorizationCredentials]):
    """v60: token z nagłówka Bearer (klienci API, testy) albo z ciasteczka HttpOnly (przeglądarka).
    Nieprawidłowy Bearer (np. pseudo-token interfejsu) nie blokuje ciasteczka. Zapis przez ciasteczko wymaga nagłówka X-ESN-Req."""
    if credentials and credentials.credentials:
        try:
            return jwt.decode(credentials.credentials, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        except Exception:
            pass
    tok = request.cookies.get(SESSION_COOKIE)
    if not tok:
        return None
    try:
        payload = jwt.decode(tok, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
    except Exception:
        return None
    if request.method.upper() not in SAFE_METHODS and request.headers.get(CSRF_HEADER) != "1":
        raise HTTPException(status_code=403, detail="Brak nagłówka zabezpieczającego żądanie")
    return payload


def get_optional_user(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security), db: Session = Depends(get_db)):
    """Użytkownik z tokenu albo None (gość) – dla endpointów publicznych, które zalogowanym pokazują więcej."""
    payload = _session_payload(request, credentials)
    if not payload:
        return None
    login = payload.get("sub")
    user = db.query(models.User).filter(models.User.login == login).first() if login else None
    return None if (not user or user.is_banned) else user

def get_current_user(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security), db: Session = Depends(get_db)):
    payload = _session_payload(request, credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Nieprawidłowy lub wygasły token JWT")
    login: str = payload.get("sub")
    if login is None:
        raise HTTPException(status_code=401, detail="Brak loginu w tokenie")

    user = db.query(models.User).filter(models.User.login == login).first()
    if not user:
        raise HTTPException(status_code=401, detail="Użytkownik nie istnieje")
    if user.is_banned:
        raise HTTPException(status_code=403, detail="Konto zostało zbanowane")
        
    return user

# --- AUTORYZACJA I KONTA ---

@app.post("/api/register",tags=["Konta i Uwierzytelnianie (JWT)"])
def register(user_data: schemas.UserCreate, request: Request, db: Session = Depends(get_db)):
    security_service.rate_limit(db, "register:" + security_service.client_ip(request), 10, 3600)
    # 1. Sprawdzamy czy login/email zajęty (jak w HotWheels)
    if db.query(models.User).filter(models.User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email już zarejestrowany")
    if db.query(models.User).filter(models.User.login == user_data.login).first():
        raise HTTPException(status_code=400, detail="Login jest już zajęty")

    # 2. Tworzymy użytkownika (domyślnie rola 'user')
    new_user = models.User(
        username=user_data.username,
        login=user_data.login,
        email=user_data.email,
        hashed_password=utils.hash_password(user_data.password),
        role="user",
        lang=mail_i18n.request_lang(request)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # 3. Generujemy kod i wysyłamy maila (Logika z HotWheels)
    code = mailer.generate_code()
    expires = datetime.utcnow() + timedelta(minutes=15)
    
    db_code = models.VerificationCode(
        user_id=new_user.id, 
        code=code, 
        purpose="register", 
        expires_at=expires
    )
    db.add(db_code)
    db.commit()

    ml = new_user.lang or "pl"
    subject = mail_i18n.render(ml, "register_subject")
    body = mail_i18n.render(ml, "register_body", username=new_user.username, login=new_user.login, code=code)
    mailer.send_email(new_user.email, subject, body)
    
    return {"message": "Kod weryfikacyjny został wysłany na maila"}
@app.post("/api/verify",tags=["Konta i Uwierzytelnianie (JWT)"])
def verify_account(data: schemas.UserVerify, request: Request, db: Session = Depends(get_db)):
    security_service.rate_limit(db, "verify-ip:" + security_service.client_ip(request), 30, 900)
    security_service.rate_limit(db, "verify:" + (data.email or "").lower(), 8, 900)
    # 1. Szukamy użytkownika po emailu
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Nie znaleziono użytkownika")

    # 2. Szukamy jego aktywnego kodu rejestracyjnego
    db_code = db.query(models.VerificationCode).filter(
        models.VerificationCode.user_id == user.id,
        models.VerificationCode.purpose == "register",
        models.VerificationCode.code == data.code
    ).first()

    if not db_code:
        raise HTTPException(status_code=400, detail="Nieprawidłowy kod weryfikacyjny")

    # 3. Sprawdzamy czy kod nie wygasł (15 minut)
    # Ponieważ SQLAlchemy przechowuje czas bez strefy czasowej (naive), musimy to ujednolicić
    now_utc = datetime.utcnow()
    # Mały trik na ujednolicenie timezone'ów w Pythonie
    if db_code.expires_at.replace(tzinfo=None) < now_utc:
        raise HTTPException(status_code=400, detail="Kod wygasł. Zarejestruj się ponownie.")

    # 4. Sukces! Usuwamy zużyty kod z bazy (Dokładnie tak jak w Twoim HotWheels)
    db.delete(db_code)
    
    db_path = create_user_inventory(user.id)
    user.inventory_db_path = db_path
    
    db.commit()

    return {"message": "Konto zostało zweryfikowane! Możesz się zalogować."}

@app.post("/api/login", response_model=schemas.Token,tags=["Konta i Uwierzytelnianie (JWT)"])
def login(form_data: schemas.UserCreate, request: Request, response: Response, db: Session = Depends(get_db)):
    security_service.rate_limit(db, "login-ip:" + security_service.client_ip(request), 30, 600)
    user = db.query(models.User).filter(models.User.login == form_data.login).first()

    if not user:   # v60: ten sam komunikat co przy złym haśle – nie zdradzamy, czy login istnieje
        raise HTTPException(status_code=401, detail="Błędny login lub hasło")

    # 1. Sprawdzanie bana (HotWheels Style)
    if user.is_banned:
        reason = user.ban_reason or "Naruszenie regulaminu"
        raise HTTPException(status_code=403, detail=f"Konto zbanowane. Powód: {reason}")

    # 2. Sprawdzanie blokady czasowej (HotWheels Style)
    if user.lockout_until and user.lockout_until > datetime.utcnow():
        minutes = int((user.lockout_until - datetime.utcnow()).total_seconds() / 60) + 1
        raise HTTPException(status_code=403, detail=f"Konto zablokowane. Spróbuj za {minutes} min.")

    # 3. Weryfikacja hasła
    if not utils.verify_password(form_data.password, user.hashed_password):
        user.failed_attempts += 1
        if user.failed_attempts >= 5:
            user.lockout_until = datetime.utcnow() + timedelta(minutes=15)
            db.commit()
            raise HTTPException(status_code=403, detail="Zbyt wiele prób. Blokada na 15 min.")
        db.commit()
        raise HTTPException(status_code=401, detail="Błędny login lub hasło")

    # Sukces logowania - reset prób
    user.failed_attempts = 0
    user.last_login_at = datetime.utcnow()   # v64: aktywni użytkownicy w dashboardzie
    user.lockout_until = None
    db.commit()
    # Generujemy bilet wstępu (Token JWT) - TO MUSI BYĆ PRZED CIASTECZKIEM
    token = auth.create_access_token(data={"sub": user.login, "role": user.role, "user_id": user.id})
    
    response.set_cookie(          # v60: jedyne miejsce przechowania sesji w przeglądarce (HttpOnly – niedostępne dla skryptów)
        key=SESSION_COOKIE,
        value=token,
        path="/",
        httponly=True,
        samesite="lax",
        secure=security_service.cookie_secure(request),
        max_age=auth.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    
    return {"access_token": token, "token_type": "bearer"}


@app.post("/api/logout", tags=["Konta i Uwierzytelnianie (JWT)"])
def logout(request: Request, response: Response):
    """Wylogowanie: usuwa ciasteczko sesji (portal i magazyn)."""
    response.delete_cookie(key=SESSION_COOKIE, path="/", httponly=True, samesite="lax", secure=security_service.cookie_secure(request))
    return {"ok": True}

# ==========================================
# ZARZĄDZANIE KONTEM (PROFIL I BEZPIECZEŃSTWO)
# ==========================================
@app.get("/api/users/me", response_model=schemas.UserResponse,tags=["Konta i Uwierzytelnianie (JWT)"])
def get_my_profile(current_user: models.User = Depends(get_current_user)):
    return current_user

# ==========================================
# ASYSTENT AI (limity, własny klucz, bramka dla portalu i magazynu)
# ==========================================
def _ai_err(e: "ai_service.AIError"):
    return HTTPException(status_code=e.status if 400 <= e.status < 600 else 502, detail=e.message)


@app.get("/api/ai/status", tags=["Asystent AI"])
def ai_status(current_user: models.User = Depends(get_current_user)):
    """Limit dzienny, wykorzystanie i ustawienia własnego klucza (bez samego klucza)."""
    return {**ai_service.status(current_user),
            "providers": {k: {"name": v["name"], "model": v["model"]} for k, v in ai_service.PROVIDERS.items()},
            "system_name": ai_service.system_config()["name"]}


@app.put("/api/users/me/ai-settings", tags=["Asystent AI"])
def ai_save_settings(data: schemas.AISettingsUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if data.provider not in ai_service.PROVIDERS:
        raise HTTPException(status_code=400, detail="Nieznany dostawca AI.")
    model = (data.model or "").strip()
    if model and not ai_service.MODEL_RE.match(model):
        raise HTTPException(status_code=400, detail="Nazwa modelu może zawierać tylko litery, cyfry oraz . _ : / -")
    key = (data.api_key or "").strip()
    if key:
        if not ai_service.KEY_RE.match(key):
            raise HTTPException(status_code=400, detail="Klucz wygląda niepoprawnie (8–300 znaków, bez spacji).")
        current_user.ai_key_enc = ai_service.encrypt_key(key)
        current_user.ai_key_hint = ai_service.key_hint(key)
    elif not current_user.ai_key_enc:
        raise HTTPException(status_code=400, detail="Podaj klucz API.")
    current_user.ai_provider = data.provider
    current_user.ai_model = model or None
    db.commit()
    return ai_service.status(current_user)


@app.delete("/api/users/me/ai-settings", tags=["Asystent AI"])
def ai_delete_settings(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.ai_key_enc = current_user.ai_provider = current_user.ai_model = current_user.ai_key_hint = None
    db.commit()
    return ai_service.status(current_user)


@app.post("/api/ai/complete", tags=["Asystent AI"])
def ai_complete(data: schemas.AICompleteRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Bramka AI dla modułów platformy (np. magazynu). Klucz: własny użytkownika albo systemowy z dziennym limitem."""
    try:
        return ai_service.complete(db, current_user, data.system, [m.model_dump() for m in data.messages])
    except ai_service.AIError as e:
        raise _ai_err(e)


@app.post("/api/ai/test", tags=["Asystent AI"])
def ai_test(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Próbne zapytanie własnym kluczem (sprawdza klucz i model). Nie zużywa limitu systemowego."""
    if not (current_user.ai_key_enc and current_user.ai_provider in ai_service.PROVIDERS):
        raise HTTPException(status_code=400, detail="Najpierw zapisz własny klucz API.")
    try:
        ai_service.check_cooldown(current_user.id)
        r = ai_service.call_user_provider(current_user.ai_provider, ai_service.decrypt_key(current_user.ai_key_enc),
                                          current_user.ai_model, "Odpowiadaj jednym słowem.", [{"role": "user", "content": "Napisz: OK"}])
    except ai_service.AIError as e:
        raise _ai_err(e)
    return {"ok": True, "reply": r[:80]}


@app.post("/api/users/me/request-code",tags=["Konta i Uwierzytelnianie (JWT)"])
def request_action_code(
    data: schemas.CodeRequest, 
    request: Request,
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    security_service.rate_limit(db, f"code-send:{current_user.id}", 5, 900)   # v60: najwyżej 5 maili z kodem na 15 min
    # Usuwamy stare kody
    db.query(models.VerificationCode).filter(
        models.VerificationCode.user_id == current_user.id,
        models.VerificationCode.purpose == data.purpose
    ).delete()
    
    code = mailer.generate_code()
    expiration = datetime.utcnow() + timedelta(minutes=15)
    db_code = models.VerificationCode(user_id=current_user.id, code=code, purpose=data.purpose, expires_at=expiration)
    db.add(db_code)
    db.commit()
    
    ml = mail_i18n.request_lang(request, current_user.lang)
    if current_user.lang != ml:
        current_user.lang = ml
        db.commit()
    cel = mail_i18n.purpose_label(ml, data.purpose)
    mailer.send_email(current_user.email, mail_i18n.render(ml, "code_subject", purpose=cel), mail_i18n.render(ml, "code_body", code=code))
    return {"message": "Kod wysłany."}

def verify_action_code(db: Session, user_id: int, code: str, purpose: str):
    security_service.rate_limit(db, f"code:{user_id}:{purpose}", 6, 900)   # v60: najwyżej 6 prób na 15 min
    db_code = db.query(models.VerificationCode).filter(
        models.VerificationCode.user_id == user_id, 
        models.VerificationCode.code == code, 
        models.VerificationCode.purpose == purpose
    ).first()
    
    # Naprawa błędu porównania dat:
    if not db_code or db_code.expires_at.replace(tzinfo=None) < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Kod wygasł lub jest niepoprawny.")
        
    db.delete(db_code)
    db.commit() # Ważne: usuwamy kod z bazy po użyciu
    return True

@app.put("/api/users/me/profile",tags=["Konta i Uwierzytelnianie (JWT)"])
def update_profile(data: schemas.ProfileUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.username = data.username
    db.commit()
    return {"message": "Nazwa zaktualizowana"}

@app.post("/api/users/me/avatar",tags=["Konta i Uwierzytelnianie (JWT)"])
async def upload_avatar(file: UploadFile = File(...), current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = await media_service.read_limited(file, media_service.CFG["avatar_max_bytes"])
    try:
        clean, ext, _mime, _w, _h = media_service.validate_image(data, media_service.CFG["avatar_max_bytes"])
    except media_service.ImageError as e:
        raise HTTPException(status_code=400, detail=str(e))
    # Stary avatar usuwamy dopiero po poprawnej walidacji nowego (i tylko z katalogu uploadów)
    media_service.remove_static_file(current_user.avatar_path)
    current_user.avatar_path = media_service.store_bytes("avatars", ext, clean)
    db.commit()
    return {"avatar_path": current_user.avatar_path}

@app.delete("/api/users/me/avatar",tags=["Konta i Uwierzytelnianie (JWT)"])
def delete_avatar(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Usuwa zdjęcie profilowe – interfejs pokazuje wtedy inicjały (v61)."""
    media_service.remove_static_file(current_user.avatar_path)
    current_user.avatar_path = None
    db.commit()
    return {"avatar_path": None}

@app.put("/api/users/me/password",tags=["Konta i Uwierzytelnianie (JWT)"])
def change_password(data: schemas.PasswordChange, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    verify_action_code(db, current_user.id, data.code, "password")
    if not utils.verify_password(data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Stare hasło jest niepoprawne")
    current_user.hashed_password = utils.hash_password(data.new_password)
    db.commit()
    return {"message": "Hasło zmienione"}

@app.put("/api/users/me/email",tags=["Konta i Uwierzytelnianie (JWT)"])
def update_email(data: schemas.EmailUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    verify_action_code(db, current_user.id, data.code, "email")
    exists = db.query(models.User).filter(models.User.email == data.new_email).first()
    if exists: raise HTTPException(status_code=400, detail="E-mail zajęty przez innego użytkownika")
    current_user.email = data.new_email
    db.commit()
    return {"message": "Adres e-mail zaktualizowany"}

@app.delete("/api/users/me",tags=["Konta i Uwierzytelnianie (JWT)"])
def delete_my_account(data: schemas.AccountDelete, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    verify_action_code(db, current_user.id, data.code, "delete")
    
    # Zachowujemy projekty z dysku i bazy, ale odpinamy od nich autora
    projects = db.query(models.Project).filter(models.Project.owner_id == current_user.id).all()
    
    for proj in projects:
        proj.owner_id = None  # Projekt staje się "sierotą"
        
        # Wymuszamy status archiwalny, aby admin mógł go łatwo wyłapać i zweryfikować
        proj.status = "archive"
        
        # Dodajemy czerwoną flagę / notatkę systemową do notatek technicznych
        system_note = "UWAGA SYSTEMU: Autor tego projektu usunął konto."
        if proj.technical_notes:
            proj.technical_notes = f"{system_note} {proj.technical_notes}"
        else:
            proj.technical_notes = system_note
            
    # Gdy projekty są bezpieczne, usuwamy samego użytkownika
    db.delete(current_user)
    db.commit()
    
    return {"message": "Konto usunięte. Twoje projekty zostały zachowane dla społeczności."}

@app.post("/api/auth/forgot-password",tags=["Konta i Uwierzytelnianie (JWT)"])
def forgot_password(data: schemas.ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    security_service.rate_limit(db, "forgot-ip:" + security_service.client_ip(request), 10, 3600)
    security_service.rate_limit(db, "forgot:" + (data.email or "").lower(), 3, 900)
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user:
        # Bezpieczeństwo: Nie zdradzamy hakerom, czy dany email jest w naszej bazie!
        return {"message": "Jeśli mail istnieje w bazie, wysłano kod."}
        
    # Usuwamy stare kody dla tego usera
    db.query(models.VerificationCode).filter(
        models.VerificationCode.user_id == user.id,
        models.VerificationCode.purpose == "reset_password"
    ).delete()
    
    code = mailer.generate_code()
    db_code = models.VerificationCode(
        user_id=user.id, code=code, purpose="reset_password", 
        expires_at=datetime.utcnow() + timedelta(minutes=15)
    )
    db.add(db_code)
    db.commit()
    
    ml = mail_i18n.request_lang(request, user.lang)
    subject = mail_i18n.render(ml, "reset_subject")
    body = mail_i18n.render(ml, "reset_body", username=user.username, login=user.login, code=code)
    
    mailer.send_email(user.email, subject, body)
    return {"message": "Jeśli mail istnieje w bazie, wysłano kod."
    }


@app.post("/api/auth/reset-password",tags=["Konta i Uwierzytelnianie (JWT)"])
def reset_password(data: schemas.PasswordReset, request: Request, db: Session = Depends(get_db)):
    security_service.rate_limit(db, "reset-ip:" + security_service.client_ip(request), 20, 900)
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Nieprawidłowe dane")
        
    # Korzystamy z napisanej wcześniej funkcji (rzuci błąd jeśli kod jest zły)
    verify_action_code(db, user.id, data.code, "reset_password")
    
    user.hashed_password = utils.hash_password(data.new_password)
    db.commit()
    return {"message": "Hasło zostało pomyślnie zresetowane."}
# --- PROJEKTY (Zabezpieczone flagą is_official) ---

# 1. Zaktualizowany get_projects (obsługa source="mine")
@app.get("/api/projects", response_model=List[schemas.Project],tags=["Baza Projektów -- Główna"])
def get_projects(
    db: Session = Depends(get_db),
    search: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    source: Optional[str] = Query("all"),
    user_id: Optional[int] = Query(None),
    sort: str = Query("newest"), # <--- NOWY PARAMETR SORTOWANIA
    lang: Optional[str] = Query(None),   # filtr języka treści (brak = wszystkie); nie dotyczy source=mine
    skip: int = 0,
    limit: int = 20
):
    query = db.query(models.Project).options(joinedload(models.Project.owner))
    
    if tag:
        query = query.filter(models.Project.tags.ilike(f"%{tag}%"))
    if search:
        query = query.filter(models.Project.title.ilike(f"%{search}%") | models.Project.short_desc.ilike(f"%{search}%"))
    
    # Filtrowanie pochodzenia
    if source == "official":
        query = query.filter(models.Project.is_official == True)
    elif source == "community":
        query = query.filter(models.Project.is_official == False)
    elif source == "mine" and user_id:
        query = query.filter(models.Project.owner_id == user_id)
    
    if lang and source != "mine":
        _ls = [x for x in (y.strip().lower() for y in lang.split(",")) if x in ("pl", "en")]
        if _ls:
            query = query.filter(models.Project.lang.in_(_ls))

    # LOGIKA SORTOWANIA (Projekty Oficjalne ZAWSZE na samej górze)
    if sort == "az":
        return query.order_by(models.Project.title.asc()).offset(skip).limit(limit).all()
    elif sort == "oldest":
        return query.order_by(models.Project.created_at.asc()).offset(skip).limit(limit).all()
    else: # "newest" (Domyślnie - od najnowszych)
        return query.order_by(models.Project.created_at.desc()).offset(skip).limit(limit).all()

@app.post("/api/projects", response_model=schemas.Project,tags=["Baza Projektów -- Główna"])
def create_project(
    project: schemas.ProjectCreate, 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    # 1. Generowanie przyjaznego linku (slug) na podstawie tytułu
    base_slug = re.sub(r'[^a-z0-9]+', '-', project.title.lower()).strip('-')
    unique_slug = base_slug
    counter = 1
    while db.query(models.Project).filter(models.Project.slug == unique_slug).first():
        unique_slug = f"{base_slug}-{counter}"
        counter += 1

    # 2. Bezpieczne wypakowanie danych (zapobieganie błędowi 'multiple values')
    project_data = project.dict()
    project_data.pop("is_official", None) # <--- TO NAPRAWIA TWÓJ BŁĄD!
    if (project_data.get("lang") or "pl") not in ("pl", "en"):
        raise HTTPException(status_code=400, detail="Nieobsługiwany język treści")
    project_data["lang"] = project_data.get("lang") or "pl"
    project_data["full_content_md"] = _clean_project_md(project_data.get("full_content_md"))
    for _f in ("image_main", "image_schematic", "image_gallery_1", "image_gallery_2", "markdown_path", "code_snippet", "code_lang"):
        project_data.pop(_f, None)   # ścieżki plików ustala wyłącznie serwer (system mediów) – nigdy klient

    # 3. Zapis do bazy
    new_project = models.Project(
        **project_data,
        slug=unique_slug,
        owner_id=current_user.id,
        is_official=(current_user.role == "admin") # Admin tworzy oficjalne, inni społeczne
    )
    
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    if content_service.adopt_legacy(db, new_project, "project"):   # v55: github_url (starszy klient) → zasoby
        db.commit()
        db.refresh(new_project)
    return new_project

# ENDPOINT: Edycja projektu
@app.put("/api/projects/{project_id}",tags=["Baza Projektów -- Główna"])
def update_project(
    project_id: int,
    project_update: schemas.ProjectCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Pobieramy projekt wraz z danymi właściciela (owner), aby znać jego rolę
    db_project = db.query(models.Project).options(joinedload(models.Project.owner)).filter(models.Project.id == project_id).first()
    
    if not db_project:
        raise HTTPException(status_code=404, detail="Projekt nie istnieje")
    
    # Tylko właściciel lub admin może edytować
    if db_project.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Brak uprawnień do edycji")

    update_data = project_update.dict()
    _fs = getattr(project_update, "model_fields_set", None)
    if _fs is None:
        _fs = getattr(project_update, "__fields_set__", set())
    if "full_content_md" in _fs:
        update_data["full_content_md"] = _clean_project_md(update_data.get("full_content_md"))
    else:
        update_data.pop("full_content_md", None)   # stary klient nie zna tego pola – nie kasujemy opisu
    # Usuwamy is_official z danych wejściowych, aby nie nadpisać go przypadkiem
    update_data.pop("is_official", None) 
    if "lang" in _fs:
        if (update_data.get("lang") or "pl") not in ("pl", "en"):
            raise HTTPException(status_code=400, detail="Nieobsługiwany język treści")
        update_data["lang"] = update_data.get("lang") or "pl"
    else:
        update_data.pop("lang", None)   # stary klient nie zna pola – nie zmieniamy języka
    for _f in ("image_main", "image_schematic", "image_gallery_1", "image_gallery_2", "markdown_path", "code_snippet", "code_lang"):
        update_data.pop(_f, None)   # ścieżki plików ustala wyłącznie serwer (system mediów) – nigdy klient

    if "github_url" not in _fs or not update_data.get("github_url"):
        update_data.pop("github_url", None)   # v55: repozytorium tylko w zasobach; podany adres (starszy klient) trafi do zasobów niżej
    # Aktualizacja pól tekstowych
    for key, value in update_data.items():
        setattr(db_project, key, value)
    content_service.adopt_legacy(db, db_project, "project")
    
    # --- LOGIKA ZABEZPIECZAJĄCA STATUS ---
    # Sprawdzamy rolę faktycznego TWÓRCY projektu (db_project.owner)
    if db_project.owner and db_project.owner.role == "admin":
        db_project.is_official = True
    else:
        db_project.is_official = False
    # --------------------------------------

    db.commit()
    return {"message": "Projekt zaktualizowany"}

@app.delete("/api/projects/{project_id}",tags=["Baza Projektów -- Główna"])
def delete_project(
    project_id: int, 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nie istnieje")
    
    # Tylko autor lub admin może usunąć 
    if project.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Brak uprawnień do usunięcia tego projektu")
    
    # NOWOŚĆ: Bezwzględne kasowanie całego folderu projektu z dysku serwera!
    project_dir = os.path.join("static", "projects", project.slug)
    if os.path.exists(project_dir):
        shutil.rmtree(project_dir, ignore_errors=True)
    
    media_service.delete_owner(db, "project", project.id)
    content_service.delete_owner_content(db, "project", project.id)
    # Po usunięciu plików kasujemy wpis w bazie danych
    db.delete(project)
    db.commit()
    
    return {"message": "Projekt i wszystkie jego pliki zostały trwale usunięte z dysku."}

@app.post("/api/projects/{project_id}/upload",tags=["Baza Projektów -- Główna"])
async def upload_project_image(
    project_id: int,
    field: str = Form("image_main"),
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Endpoint zgodności wstecznej. Zdjęcia: użyj POST /api/media. Tu zostaje m.in. plik .md projektu."""
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nie istnieje")
    if project.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Brak uprawnień")

    if field == "markdown_path":
        data = await media_service.read_limited(file, media_service.CFG["markdown_max_bytes"])
        try:
            data = media_service.validate_markdown(data)
        except media_service.ImageError as e:
            raise HTTPException(status_code=400, detail=str(e))
        media_service.remove_static_file(project.markdown_path)
        project.markdown_path = media_service.store_bytes(f"projects/{project.slug}", "md", data)
        db.commit()
        return {"message": "Plik wgrany pomyślnie", "path": project.markdown_path}

    role, replace = media_service.legacy_slot("project", field)   # 400 dla nieznanego pola
    item = await media_service.ingest(db, current_user, "project", project.id, role, "", file, replace=replace)
    return {"message": "Zdjęcie wgrane pomyślnie", "path": item["path"]}

@app.delete("/api/projects/{project_id}/file/{field}",tags=["Baza Projektów -- Główna"])
async def delete_project_file(
    project_id: int,
    field: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nie istnieje")
    if project.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Brak uprawnień")

    if field == "markdown_path":
        media_service.remove_static_file(project.markdown_path)
        project.markdown_path = None
        db.commit()
    else:
        media_service.legacy_delete(db, "project", project.id, field)
    return {"message": "Plik usunięty pomyślnie"}

# --- FORMULARZ KONTAKTOWY ---

class ContactFormInput(BaseModel):
    name: str
    email: str
    subject: str
    message: str

@app.post("/api/contact",tags=["Formularz Kontaktowy i Zgłoszenia"])
def submit_contact_form(data: ContactFormInput, request: Request, db: Session = Depends(get_db)):
    security_service.rate_limit(db, "contact:" + security_service.client_ip(request), 5, 3600)
    # 1. Zapis wiadomosci w bazie danych (zabezpieczenie przed utrata)
    new_msg = models.ContactMessage(
        name=data.name,
        email=data.email,
        subject=data.subject,
        message=data.message
    )
    db.add(new_msg)
    db.commit()

    # 2. Wysylka powiadomienia e-mail za pomoca istniejacego MailBota
    admin_email = os.getenv("ADMIN_EMAIL", "kontakt@twojadomena.pl") # Wpisz tutaj swoj prywatny adres e-mail
    subject = f"[ESN Kontakt] {data.subject}"
    body = (
        f"Nowa wiadomosc z platformy ESN/RS:\n\n"
        f"Od: {data.name} ({data.email})\n"
        f"Temat: {data.subject}\n\n"
        f"Tresc wiadomosci:\n{data.message}"
    )
    
    try:
        mailer.send_email(admin_email, subject, body)
    except Exception as e:
        print(f"Nie udalo sie wyslac powiadomienia e-mail: {e}")
        # Nie rzucamy bledu 500, poniewaz wiadomosc bezpiecznie zapisala sie w bazie
        
    return {"status": "success", "message": "Wiadomosc zostala zapisana i wyslana."}
# --- WIDOKI HTML ---
@app.get("/", response_class=HTMLResponse,tags=["Głowny"])
async def read_root(request: Request, db: Session = Depends(get_db)):
    """v60: interfejs dostaje dane zalogowanego (login, rola, id, ważność) w window.ESN_USER – sam token zostaje w ciasteczku HttpOnly."""
    esn_user = None
    tok = request.cookies.get(SESSION_COOKIE)
    if tok:
        try:
            p = jwt.decode(tok, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
            u = db.query(models.User).filter(models.User.login == p.get("sub")).first()
            if u and not u.is_banned:
                esn_user = {"sub": u.login, "role": u.role, "user_id": u.id, "exp": p.get("exp")}
        except Exception:
            esn_user = None
    resp = templates.TemplateResponse(request=request, name="index.html", context={"request": request, "esn_user": esn_user})
    resp.headers["Cache-Control"] = "no-store"
    return resp


MAX_PROJECT_MD = 100_000


def _clean_project_md(text):
    """Opis projektu (markdown z blokami). Renderowany po stronie klienta przez DOMPurify; tu tylko limit i znaki sterujące."""
    if text is None:
        return None
    text = str(text).replace("\x00", "")
    if len(text) > MAX_PROJECT_MD:
        raise HTTPException(status_code=413, detail=f"Opis projektu jest za długi (max {MAX_PROJECT_MD // 1000} tys. znaków)")
    return text.strip() or None


def require_admin_or_mod(current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Wymagane uprawnienia admina lub moderatora")
    return current_user

def require_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Wymagane uprawnienia admina")
    return current_user

@app.get("/api/archiwum", response_class=HTMLResponse, tags=["Archiwum"])
def archive_niezbednik(current_user: models.User = Depends(require_admin)):
    """Archiwalny Niezbędnik v1 – fragment HTML dostępny wyłącznie dla zalogowanych adminów (nie jest w publicznej stronie)."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "archive", "niezbednik.html")
    with open(path, encoding="utf-8") as fh:
        return HTMLResponse(fh.read(), headers={"Cache-Control": "no-store"})

# ═══════════════════════════════════════════════════════════════════
#  KATALOG KOMPONENTÓW – OfficialComponent CRUD
#  GET  /api/catalog                – wszyscy (lista z filtrami)
#  GET  /api/catalog/{id}           – szczegóły
#  POST /api/catalog                – admin/moderator
#  PUT  /api/catalog/{id}           – admin/moderator
#  DELETE /api/catalog/{id}         – admin
# ═══════════════════════════════════════════════════════════════════


# ═══════════════════════════════════════════════════════════════════
#  KATALOG KOMPONENTÓW – OfficialComponent CRUD
# ═══════════════════════════════════════════════════════════════════


PINOUT_CATS = {"power", "ground", "analog", "digital", "spi", "i2c", "i2s", "uart", "usb", "can", "pwm",
               "debug", "rf", "clock", "control", "nc", "other"}
PINOUT_LAYOUTS = {"quad", "dual", "sip", "to92", "to220", "sot23", "axial", "board", "none"}
PINOUT_SHAPES = {"rect", "circle", "text"}
PINOUT_SHAPE_KINDS = {"pcb", "chip", "conn", "btn", "led", "part"}

COMP_LANGS = ("pl", "en")   # obsługiwane języki treści komponentów (dopisz kod, gdy dojdzie język interfejsu)

def _clean_pinout_translations(raw, base, pins, groups, shapes, s):
    """Warstwa tłumaczeń pinoutu: struktura (piny, układ, współrzędne) jest wspólna – tłumaczone są tylko teksty.
    {lang: {view, notes, pins:{nr:{type,fn,note}}, groups:{nazwa bazowa:{name,note}}, shapes:{etykieta bazowa:etykieta}}}"""
    if raw in (None, "", {}):
        return {}
    if not isinstance(raw, dict):
        raise HTTPException(status_code=400, detail="Nieobsługiwany język treści")
    nums = {x["n"] for x in pins}
    gnames = {g["name"] for g in groups}
    slabels = {x["label"] for x in shapes if x.get("label")}
    out = {}
    for lang, ov in raw.items():
        if lang not in COMP_LANGS or lang == base:
            raise HTTPException(status_code=400, detail="Nieobsługiwany język treści")
        if not isinstance(ov, dict):
            continue
        o = {}
        if s(ov.get("view"), 40): o["view"] = s(ov.get("view"), 40)
        if s(ov.get("notes"), 3000): o["notes"] = s(ov.get("notes"), 3000)
        ps = {}
        for n, v in (ov.get("pins") or {}).items() if isinstance(ov.get("pins"), dict) else []:
            if str(n) in nums and isinstance(v, dict):
                e = {k: s(v.get(k), lim) for k, lim in (("type", 60), ("fn", 300), ("note", 1200)) if s(v.get(k), lim)}
                if e: ps[str(n)] = e
        if ps: o["pins"] = ps
        gs = {}
        for n, v in (ov.get("groups") or {}).items() if isinstance(ov.get("groups"), dict) else []:
            if str(n) in gnames and isinstance(v, dict):
                e = {k: s(v.get(k), lim) for k, lim in (("name", 80), ("note", 400)) if s(v.get(k), lim)}
                if e: gs[str(n)] = e
        if gs: o["groups"] = gs
        ss = {}
        for n, v in (ov.get("shapes") or {}).items() if isinstance(ov.get("shapes"), dict) else []:
            if str(n) in slabels and s(v, 40):
                ss[str(n)] = s(v, 40)
        if ss: o["shapes"] = ss
        if o:
            out[lang] = o
    return out

SHOP_REGIONS = ("", "pl", "eu", "world")
SHOP_MAX = 12

def clean_shops(raw) -> list:
    """Linki „Gdzie kupić” (v48): tylko adresy http(s) bez spacji i znaków HTML, max 12, przycięte teksty, region z listy.
    Bez cen (szybko się dezaktualizują). Duplikaty adresów odrzucane."""
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise HTTPException(status_code=400, detail="Nieprawidłowa lista sklepów")
    out, seen = [], set()
    for s in raw[:SHOP_MAX]:
        if not isinstance(s, dict):
            continue
        url = str(s.get("url") or "").strip()
        if not url:
            continue
        if not re.match(r"^https?://[^\s\"'<>`]+$", url) or len(url) > 500:
            raise HTTPException(status_code=400, detail="Nieprawidłowy adres sklepu (dozwolone tylko linki http:// lub https://)")
        if url.lower() in seen:
            continue
        seen.add(url.lower())
        name = str(s.get("name") or "").strip()[:60] or re.sub(r"^https?://(www\.)?", "", url).split("/")[0][:60]
        region = s.get("region") if s.get("region") in SHOP_REGIONS else ""
        o = {"name": name, "url": url, "region": region}
        note = str(s.get("note") or "").strip()[:120]
        if note:
            o["note"] = note
        out.append(o)
    return out

def clean_comp_translations(raw, base):
    """Tłumaczenia pól komponentu: {lang: {name, description, specs:{klucz bazowy: etykieta}}}."""
    if raw in (None, "", {}):
        return None
    if not isinstance(raw, dict):
        raise HTTPException(status_code=400, detail="Nieobsługiwany język treści")
    out = {}
    for lang, v in raw.items():
        if lang not in COMP_LANGS or lang == base:
            raise HTTPException(status_code=400, detail="Nieobsługiwany język treści")
        if not isinstance(v, dict):
            continue
        e = {}
        if str(v.get("name") or "").strip(): e["name"] = str(v["name"]).strip()[:200]
        if str(v.get("description") or "").strip(): e["description"] = str(v["description"]).strip()[:5000]
        sp = v.get("specs")
        if isinstance(sp, dict):
            m = {str(k)[:80]: str(x).strip()[:80] for k, x in list(sp.items())[:60] if str(x or "").strip()}
            if m: e["specs"] = m
        if e: out[lang] = e
    return out or None

def _comp_base(v):
    v = v or "pl"
    if v not in COMP_LANGS:
        raise HTTPException(status_code=400, detail="Nieobsługiwany język treści")
    return v

def resolve_comp(d: dict, base: str, tr: Optional[dict], lang: Optional[str]) -> dict:
    """Scala pola komponentu z tłumaczeniem w danym języku (brakujące pola → oryginał).
    Dodaje base_lang, langs (dostępne wersje) i lang_used."""
    langs = [base] + [l for l in (tr or {}) if l != base]
    d["base_lang"] = base
    d["langs"] = langs
    d["lang_used"] = base
    if lang and lang != base and tr and lang in tr:
        t = tr[lang]
        d["lang_used"] = lang
        if t.get("name"): d["name"] = t["name"]
        if t.get("description"): d["description"] = t["description"]
        if t.get("specs") and isinstance(d.get("technical_specs"), dict):
            d["technical_specs"] = {t["specs"].get(k, k): v for k, v in d["technical_specs"].items()}
    return d

def clean_pinout(p, default_lang="pl"):
    """Walidacja i czyszczenie pinoutu (admin wpisuje dane, które trafiają do widoku publicznego)."""
    if p in (None, "", {}):
        return None
    if not isinstance(p, dict) or not isinstance(p.get("pins"), list) or not p["pins"]:
        raise HTTPException(status_code=400, detail="pinout: wymagany obiekt z niepustą listą 'pins'")
    if len(p["pins"]) > 400:
        raise HTTPException(status_code=400, detail="pinout: maksymalnie 400 pinów")

    def s(v, n):
        return "" if v is None else str(v).strip()[:n]

    def f(v, lo=None, hi=None):
        try:
            v = float(v)
        except (TypeError, ValueError):
            return None
        if v != v or v in (float("inf"), float("-inf")):
            return None
        if lo is not None: v = max(lo, v)
        if hi is not None: v = min(hi, v)
        return round(v, 2)

    pins = []
    for x in p["pins"]:
        if not isinstance(x, dict):
            raise HTTPException(status_code=400, detail="pinout: każdy pin musi być obiektem")
        n, name = s(x.get("n"), 10), s(x.get("name"), 40)
        if not n and not name:
            raise HTTPException(status_code=400, detail="pinout: pin bez numeru i nazwy")
        pin = {"n": n, "name": name or n,
               "cat": x.get("cat") if x.get("cat") in PINOUT_CATS else "other",
               "type": s(x.get("type"), 60), "fn": s(x.get("fn"), 300), "note": s(x.get("note"), 1200)}
        if x.get("pad") is True:
            pin["pad"] = True
        px, py = f(x.get("x"), 0, 100), f(x.get("y"), 0, 100)
        if px is not None and py is not None:   # punkt na rysunku płytki (w % szerokości/wysokości)
            pin["x"], pin["y"] = px, py
        pins.append(pin)

    sources = []
    for x in (p.get("sources") or [])[:10]:
        if isinstance(x, dict):
            url = s(x.get("url"), 500)
            sources.append({"label": s(x.get("label"), 200), "url": url if url.lower().startswith(("http://", "https://")) else ""})

    shapes = []
    for x in (p.get("shapes") or [])[:120]:
        if not isinstance(x, dict) or x.get("t") not in PINOUT_SHAPES:
            continue
        sh = {"t": x["t"], "x": f(x.get("x"), -50, 150), "y": f(x.get("y"), -50, 150),
              "label": s(x.get("label"), 40), "kind": x.get("kind") if x.get("kind") in PINOUT_SHAPE_KINDS else "part"}
        if sh["x"] is None or sh["y"] is None:
            continue
        if sh["t"] == "rect":
            sh["w"], sh["h"] = f(x.get("w"), 0, 200), f(x.get("h"), 0, 200)
            if sh["w"] is None or sh["h"] is None:
                continue
        elif sh["t"] == "circle":
            sh["r"] = f(x.get("r"), 0, 100)
            if sh["r"] is None:
                continue
        shapes.append(sh)

    groups = []
    for x in (p.get("groups") or [])[:30]:
        if isinstance(x, dict) and s(x.get("name"), 80) and isinstance(x.get("pins"), list):
            refs = [s(r, 40) for r in x["pins"][:60] if s(r, 40)]
            if refs:
                groups.append({"name": s(x.get("name"), 80), "pins": refs, "note": s(x.get("note"), 400)})

    base = p.get("lang") or default_lang
    if base not in COMP_LANGS:
        raise HTTPException(status_code=400, detail="Nieobsługiwany język treści")
    out = {"package": s(p.get("package"), 40), "view": s(p.get("view"), 40), "pins": pins,
           "sources": sources, "notes": s(p.get("notes"), 3000), "lang": base}
    tr = _clean_pinout_translations(p.get("translations"), base, pins, groups, shapes, s)
    if tr:
        out["translations"] = tr
    if p.get("layout") in PINOUT_LAYOUTS:
        out["layout"] = p["layout"]
    if p.get("default_tab") in ("interactive", "image"):
        out["default_tab"] = p["default_tab"]
    if isinstance(p.get("image_as_background"), bool):
        out["image_as_background"] = p["image_as_background"]
    if shapes: out["shapes"] = shapes
    if groups: out["groups"] = groups
    board = p.get("board")
    if isinstance(board, dict):
        b = {}
        if f(board.get("aspect"), 0.4, 4) is not None: b["aspect"] = f(board.get("aspect"), 0.4, 4)
        if isinstance(board.get("labels"), bool): b["labels"] = board["labels"]
        if b: out["board"] = b
    return out

def pinout_summary(item):
    po = getattr(item, "pinout", None)
    if isinstance(po, dict) and po.get("pins"):
        return {"package": po.get("package", ""), "count": len(po["pins"])}
    return None

@app.get("/api/catalog",tags=["Globalny Katalog Sprzętowy"])
def list_catalog(
    q: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    application: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),          # Paginacja: start
    limit: int = Query(12, ge=1, le=1000), # Paginacja: zwiększony limit # Paginacja: limit
    lang: Optional[str] = Query(None),   # język wyniku (tłumaczenia nazwy/opisu/parametrów, fallback = oryginał)
    db: Session = Depends(get_db)
):
    """Publiczny endpoint – lista komponentów katalogu z filtrami i paginacją."""
    query = db.query(models.OfficialComponent)

    if q:
        query = query.filter(
            models.OfficialComponent.name.ilike(f"%{q}%") |
            models.OfficialComponent.symbol.ilike(f"%{q}%") |
            models.OfficialComponent.description.ilike(f"%{q}%") |
            models.OfficialComponent.translations.cast(SAString).ilike(f"%{q}%")
        )
    if category:
        query = query.filter(models.OfficialComponent.inventory_category == category)
    if application:
        query = query.filter(
            models.OfficialComponent.applications.cast(SAString).ilike(f"%{application}%")
        )

    total_count = query.count()
    items = query.order_by(models.OfficialComponent.name).offset(skip).limit(limit).all()

    ds_links = content_service.first_links(db, "component", [i.id for i in items], "datasheet")
    result = []
    for item in items:
        d = {
            "id": item.id,
            "name": item.name,
            "symbol": item.symbol,
            "inventory_category": item.inventory_category,
            "applications": item.applications or [],
            "tags": getattr(item, 'tags', []),
            "technical_specs": item.technical_specs or {},
            "description": item.description,
            "datasheet_url": ds_links.get(item.id) or item.datasheet_url,   # v55: z zasobów (magazyn, schematy)
            "image_main": getattr(item, 'image_main', None),
            "image_gallery_1": getattr(item, 'image_gallery_1', None),
            "image_gallery_2": getattr(item, 'image_gallery_2', None),
            "image_gallery_3": getattr(item, 'image_gallery_3', None),
            "pinout_summary": pinout_summary(item),  # pełny pinout tylko w GET /api/catalog/{id}
            "shops_count": len(getattr(item, "shops", None) or []),
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        resolve_comp(d, getattr(item, "base_lang", None) or "pl", getattr(item, "translations", None), lang)
        if tag:
            haystack = str(d["applications"]) + str(d["tags"]) + str(list(d["technical_specs"].keys()))
            if tag.lower() not in haystack.lower():
                continue
        result.append(d)

    return {
        "items": result,
        "total": total_count,
        "skip": skip,
        "limit": limit
    }

categories_list=['Czujniki', 'Diody', 'Kondensatory', 'Mikrokontrolery', 
    'Moduły', 'Rezystory', 'Tranzystory', 'Układy scalone', 
    'Wyświetlacze', 'Zasilanie', 'Złącza', 'Inne']

@app.get("/api/catalog/categories",tags=["Globalny Katalog Sprzętowy"])
def list_catalog_categories(db: Session = Depends(get_db)):
    rows = db.query(models.OfficialComponent.inventory_category).distinct().all()
    db_cats = [r[0] for r in rows if r[0]]
    # Stała, predefiniowana lista kategorii:
    defaults = categories_list
    # Łączymy bazę z domyślnymi i usuwamy duplikaty:
    return sorted(list(set(db_cats + defaults)))

aplicattions_list = set(['Medycyna', 'IoT', 'Automatyka', 'Robotyka', 'Smart Home', 'Sensory'])

@app.get("/api/catalog/applications",tags=["Globalny Katalog Sprzętowy"])
def list_catalog_applications(db: Session = Depends(get_db)):
    items = db.query(models.OfficialComponent.applications).all()
    # Stała, predefiniowana lista zastosowań:
    apps = aplicattions_list
    for (a,) in items:
        if isinstance(a, list):
            apps.update(a)
    return sorted(list(apps))

@app.get("/api/catalog/tags",tags=["Globalny Katalog Sprzętowy"])
def list_catalog_tags(db: Session = Depends(get_db)):
    items = db.query(models.OfficialComponent.tags).all()
    # Bazowe "żelazne" tagi, które zawsze chcemy mieć pod ręką
    tags_set = set(['I2C', 'SPI', 'UART', '3.3V', '5V', 'ADC', 'WiFi', 'BLE'])
    
    # Jeśli użytkownik wpisze własny tag, zostanie on tu odnaleziony i dorzucony do puli
    for (t,) in items:
        if isinstance(t, list):
            tags_set.update(t)
            
    return sorted(list(tags_set))

@app.get("/api/catalog/{item_id}",tags=["Globalny Katalog Sprzętowy"])
def get_catalog_item(item_id: int, lang: Optional[str] = Query(None), db: Session = Depends(get_db)):
    item = db.query(models.OfficialComponent).filter(models.OfficialComponent.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Nie znaleziono komponentu")
    base = getattr(item, "base_lang", None) or "pl"
    tr = getattr(item, "translations", None)
    d = {
        "id": item.id,
        "name": item.name,
        "symbol": item.symbol,
        "inventory_category": item.inventory_category,
        "applications": item.applications or [],
        "tags": getattr(item, 'tags', []),
        "technical_specs": item.technical_specs or {},
        "description": item.description,
        "datasheet_url": content_service.first_links(db, "component", [item.id], "datasheet").get(item.id) or item.datasheet_url,   # v55: z zasobów
        "image_main": getattr(item, 'image_main', None),
        "image_gallery_1": getattr(item, 'image_gallery_1', None),
        "image_gallery_2": getattr(item, 'image_gallery_2', None),
        "image_gallery_3": getattr(item, 'image_gallery_3', None),
        "pinout": getattr(item, 'pinout', None),
        "shops": getattr(item, 'shops', None) or [],
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }
    resolve_comp(d, base, tr, lang)
    if not lang:
        d["translations"] = tr or {}     # bez ?lang: surowe dane do edycji (formularz)
    return d

@app.post("/api/catalog", status_code=201,tags=["Globalny Katalog Sprzętowy"])
def create_catalog_item(
    data: dict,
    current_user: models.User = Depends(require_admin_or_mod),
    db: Session = Depends(get_db)
):
    item = models.OfficialComponent(
        name=data.get("name"),
        symbol=data.get("symbol"),
        inventory_category=data.get("inventory_category"),
        applications=data.get("applications", []),
        tags=data.get("tags", []),
        technical_specs=data.get("technical_specs", {}),
        description=data.get("description"),
        datasheet_url=data.get("datasheet_url"),
        pinout=clean_pinout(data.get("pinout"), _comp_base(data.get("base_lang"))),
        base_lang=_comp_base(data.get("base_lang")),
        shops=clean_shops(data.get("shops")),
    )
    item.translations = clean_comp_translations(data.get("translations"), item.base_lang)
    db.add(item)
    db.commit()
    db.refresh(item)
    if content_service.adopt_legacy(db, item, "component") or item.datasheet_url is None:   # starszy klient: datasheet_url → zasoby
        db.commit()
    return {"id": item.id, "name": item.name, "message": "Dodano do katalogu"}

@app.put("/api/catalog/{item_id}",tags=["Globalny Katalog Sprzętowy"])
def update_catalog_item(
    item_id: int,
    data: dict,
    current_user: models.User = Depends(require_admin_or_mod),
    db: Session = Depends(get_db)
):
    item = db.query(models.OfficialComponent).filter(models.OfficialComponent.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Nie znaleziono komponentu")

    for field in ["name", "symbol", "inventory_category", "applications", "tags",
                  "technical_specs", "description", "datasheet_url"]:
        if field in data:
            setattr(item, field, data[field])
    if "base_lang" in data:
        item.base_lang = _comp_base(data["base_lang"])
    if "pinout" in data:
        item.pinout = clean_pinout(data["pinout"], item.base_lang or "pl")
    if "shops" in data:
        item.shops = clean_shops(data["shops"])
    if "translations" in data or "base_lang" in data:
        item.translations = clean_comp_translations(data.get("translations", item.translations), item.base_lang)

    content_service.adopt_legacy(db, item, "component")   # v55: datasheet_url (starszy klient / import) → zasoby
    db.commit()
    db.refresh(item)
    return {"id": item.id, "name": item.name, "message": "Zaktualizowano"}

@app.post("/api/catalog/{item_id}/upload",tags=["Globalny Katalog Sprzętowy"])
async def upload_catalog_image(
    item_id: int,
    field: str = Form("image_main"),
    file: UploadFile = File(...),
    current_user: models.User = Depends(require_admin_or_mod),
    db: Session = Depends(get_db)
):
    """Endpoint zgodności wstecznej – zdjęcia trafiają do systemu mediów (POST /api/media)."""
    item = db.query(models.OfficialComponent).filter(models.OfficialComponent.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Nie znaleziono komponentu")
    role, replace = media_service.legacy_slot("component", field)
    saved = await media_service.ingest(db, current_user, "component", item.id, role, "", file, replace=replace)
    return {"message": "Zdjęcie wgrane pomyślnie", "path": saved["path"]}

@app.delete("/api/catalog/{item_id}",tags=["Globalny Katalog Sprzętowy"])
def delete_catalog_item(
    item_id: int,
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Usuwa komponent z katalogu wraz z jego folderem (tylko admin)."""
    item = db.query(models.OfficialComponent).filter(models.OfficialComponent.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Nie znaleziono komponentu")
    
    media_service.delete_owner(db, "component", item.id)
    content_service.delete_owner_content(db, "component", item.id)
    # KASOWANIE FIZYCZNEGO FOLDERU Z DYSKU (stare uploady sprzed systemu mediów)
    safe_name = re.sub(r'[^a-z0-9]+', '-', item.name.lower()).strip('-')
    catalog_dir = os.path.join("static", "catalog", f"{item.id}_{safe_name}")
    if os.path.exists(catalog_dir):
        import shutil
        shutil.rmtree(catalog_dir, ignore_errors=True)

    db.delete(item)
    db.commit()
    return {"message": "Usunięto z katalogu"}

@app.delete("/api/catalog/{item_id}/file/{field}",tags=["Globalny Katalog Sprzętowy"])
async def delete_catalog_file(
    item_id: int,
    field: str,
    current_user: models.User = Depends(require_admin_or_mod),
    db: Session = Depends(get_db)
):
    """Zgodność wsteczna – usuwa zdjęcie z systemu mediów."""
    item = db.query(models.OfficialComponent).filter(models.OfficialComponent.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Nie znaleziono komponentu")
    media_service.legacy_delete(db, "component", item.id, field)
    return {"message": "Plik usunięty"}

@app.put("/api/users/{user_id}/role",tags=["Zarządzanie Administracyjne"])
def set_user_role(
    user_id: int,
    data: dict,
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Zmienia rolę użytkownika (tylko admin). Role: user / moderator / admin"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")
    new_role = data.get("role")
    if new_role not in ("user", "moderator", "admin"):
        raise HTTPException(status_code=400, detail="Nieprawidłowa rola")
    user.role = new_role
    db.commit()
    return {"user_id": user_id, "role": new_role, "message": "Rola zmieniona"}


# --- SYSTEM MEDIÓW (zdjęcia projektów, komponentów i platformy) ---
app.include_router(media_service.build_router(get_db, get_current_user))
app.include_router(content_service.build_router(get_db, get_current_user))   # relacje, kod, zasoby
app.include_router(knowledge_service.build_router(get_db, get_current_user))
app.include_router(profile_service.build_router(get_db, get_current_user, get_optional_user))   # profil publiczny (v61)
app.include_router(admin_service.build_router(get_db, require_admin))   # dashboard administracji (v64)
app.include_router(wiring_service.build_router(get_db, get_current_user, get_optional_user))   # edytor schematów połączeń (/api/wiring)   # wiedza: niezbędniki, poradniki, artykuły, kursy
