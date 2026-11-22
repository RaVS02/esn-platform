import re
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
import models, schemas, utils, auth
from database import engine, get_db, SessionLocal
import media_service
import content_service
import knowledge_service
from fastapi.responses import JSONResponse

# Inicjalizacja bazy
models.Base.metadata.create_all(bind=engine)

# create_all nie dodaje kolumn do istniejących tabel – lekka migracja dla pola pinout
from sqlalchemy import text as _sql_text
with engine.begin() as _conn:
    _conn.execute(_sql_text("ALTER TABLE official_components ADD COLUMN IF NOT EXISTS pinout JSON"))

app = FastAPI(title="ESN Platform API")

# Istniejące zdjęcia (kolumny image_*) → tabela media. Idempotentne, nigdy nie blokuje startu aplikacji.
try:
    print("[media] migracja zdjęć:", media_service.migrate_legacy(SessionLocal))
except Exception as _e:
    print("[media] UWAGA: migracja zdjęć nie powiodła się:", _e)
try:
    print("[wiedza] przykładowe treści:", knowledge_service.seed_pilot(SessionLocal))
except Exception as _e:
    print("[wiedza] UWAGA: nie udało się dodać przykładowych treści:", _e)
try:
    print("[content] migracja relacji i kodu:", content_service.migrate(SessionLocal))
except Exception as _e:
    print("[content] UWAGA: migracja relacji/kodu nie powiodła się:", _e)


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

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    try:
        # Rozkodowujemy token za pomocą naszego sekretnego klucza
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        login: str = payload.get("sub")
        if login is None:
            raise HTTPException(status_code=401, detail="Brak loginu w tokenie")
    except Exception:
        raise HTTPException(status_code=401, detail="Nieprawidłowy lub wygasły token JWT")
        
    user = db.query(models.User).filter(models.User.login == login).first()
    if not user:
        raise HTTPException(status_code=401, detail="Użytkownik nie istnieje")
    if user.is_banned:
        raise HTTPException(status_code=403, detail="Konto zostało zbanowane")
        
    return user

# --- AUTORYZACJA I KONTA ---

@app.post("/api/register",tags=["Konta i Uwierzytelnianie (JWT)"])
def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
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
        role="user"
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

    subject = "Weryfikacja konta - ESN Platform"
    body = (
        f"Witaj {new_user.username}!\n\n"
        f"Twój Login: {new_user.login}\n\n"
        f"Twój kod weryfikacyjny to: {code}\n\n"
        f"Jeśli to nie Ty zakładałeś konto, prosimy o zignorowanie tej wiadomości.\n\n"
        f"Pozdrawiamy,\nZespół ESN Platform"
    )
    mailer.send_email(new_user.email, subject, body)
    
    return {"message": "Kod weryfikacyjny został wysłany na maila"}
@app.post("/api/verify",tags=["Konta i Uwierzytelnianie (JWT)"])
def verify_account(data: schemas.UserVerify, db: Session = Depends(get_db)):
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
def login(form_data: schemas.UserCreate, response: Response, db: Session = Depends(get_db)): # <--- Dodano response: Response
    user = db.query(models.User).filter(models.User.login == form_data.login).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")

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
        raise HTTPException(status_code=401, detail=f"Błędne hasło. Pozostało prób: {5 - user.failed_attempts}")

    # Sukces logowania - reset prób
    user.failed_attempts = 0
    user.lockout_until = None
    db.commit()
    # Generujemy bilet wstępu (Token JWT) - TO MUSI BYĆ PRZED CIASTECZKIEM
    token = auth.create_access_token(data={"sub": user.login, "role": user.role, "user_id": user.id})
    
    response.set_cookie(
        key="esn_access_token",
        value=token,
        # domain=".rs-projects.ovh",  <-- ZAKOMENTOWANE LUB USUNIĘTE
        path="/",
        httponly=True,
        samesite="lax",
        secure=False  # <-- ZMIENIONE NA FALSE!
    )
    
    return {"access_token": token, "token_type": "bearer"}

# ==========================================
# ZARZĄDZANIE KONTEM (PROFIL I BEZPIECZEŃSTWO)
# ==========================================
@app.get("/api/users/me", response_model=schemas.UserResponse,tags=["Konta i Uwierzytelnianie (JWT)"])
def get_my_profile(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.post("/api/users/me/request-code",tags=["Konta i Uwierzytelnianie (JWT)"])
def request_action_code(
    data: schemas.CodeRequest, 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
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
    
    cel_map = {"email": "zmiany adresu e-mail", "password": "zmiany hasła", "delete": "usunięcia konta"}
    cel = cel_map.get(data.purpose, "akcji w systemie")
    mailer.send_email(current_user.email, f"Kod autoryzacyjny: {cel}", f"Twój kod to: {code}\nWażny przez 15 minut.")
    return {"message": "Kod wysłany."}

def verify_action_code(db: Session, user_id: int, code: str, purpose: str):
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
def forgot_password(data: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
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
    
    subject = "Odzyskiwanie dostępu - ESN Platform"
    body = (
        f"Witaj {user.username}!\n\n"
        f"Przypominamy, że Twój Login ID to: {user.login}\n\n"
        f"Twój kod do zresetowania hasła to: {code}\n"
        f"Kod jest ważny przez 15 minut."
    )
    
    mailer.send_email(user.email, subject, body)
    return {"message": "Jeśli mail istnieje w bazie, wysłano kod."
    }


@app.post("/api/auth/reset-password",tags=["Konta i Uwierzytelnianie (JWT)"])
def reset_password(data: schemas.PasswordReset, db: Session = Depends(get_db)):
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
    # Usuwamy is_official z danych wejściowych, aby nie nadpisać go przypadkiem
    update_data.pop("is_official", None) 
    for _f in ("image_main", "image_schematic", "image_gallery_1", "image_gallery_2", "markdown_path", "code_snippet", "code_lang"):
        update_data.pop(_f, None)   # ścieżki plików ustala wyłącznie serwer (system mediów) – nigdy klient

    # Aktualizacja pól tekstowych
    for key, value in update_data.items():
        setattr(db_project, key, value)
    
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
def submit_contact_form(data: ContactFormInput, db: Session = Depends(get_db)):
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
async def read_root(request: Request):
    return templates.TemplateResponse(request=request, name="index.html", context={"request": request})

# ═══════════════════════════════════════════════════════════════════
#  KATALOG KOMPONENTÓW – OfficialComponent CRUD
#  GET  /api/catalog                – wszyscy (lista z filtrami)
#  GET  /api/catalog/{id}           – szczegóły
#  POST /api/catalog                – admin/moderator
#  PUT  /api/catalog/{id}           – admin/moderator
#  DELETE /api/catalog/{id}         – admin
# ═══════════════════════════════════════════════════════════════════

def require_admin_or_mod(current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Wymagane uprawnienia admina lub moderatora")
    return current_user

def require_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Wymagane uprawnienia admina")
    return current_user


# ═══════════════════════════════════════════════════════════════════
#  KATALOG KOMPONENTÓW – OfficialComponent CRUD
# ═══════════════════════════════════════════════════════════════════


PINOUT_CATS = {"power", "ground", "analog", "digital", "spi", "i2c", "i2s", "uart", "usb", "can", "pwm",
               "debug", "rf", "clock", "control", "nc", "other"}
PINOUT_LAYOUTS = {"quad", "dual", "sip", "to92", "to220", "sot23", "axial", "board", "none"}
PINOUT_SHAPES = {"rect", "circle", "text"}
PINOUT_SHAPE_KINDS = {"pcb", "chip", "conn", "btn", "led", "part"}

def clean_pinout(p):
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

    out = {"package": s(p.get("package"), 40), "view": s(p.get("view"), 40), "pins": pins,
           "sources": sources, "notes": s(p.get("notes"), 3000)}
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
    db: Session = Depends(get_db)
):
    """Publiczny endpoint – lista komponentów katalogu z filtrami i paginacją."""
    query = db.query(models.OfficialComponent)

    if q:
        query = query.filter(
            models.OfficialComponent.name.ilike(f"%{q}%") |
            models.OfficialComponent.symbol.ilike(f"%{q}%") |
            models.OfficialComponent.description.ilike(f"%{q}%")
        )
    if category:
        query = query.filter(models.OfficialComponent.inventory_category == category)
    if application:
        query = query.filter(
            models.OfficialComponent.applications.cast(SAString).ilike(f"%{application}%")
        )

    total_count = query.count()
    items = query.order_by(models.OfficialComponent.name).offset(skip).limit(limit).all()

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
            "datasheet_url": item.datasheet_url,
            "image_main": getattr(item, 'image_main', None),
            "image_gallery_1": getattr(item, 'image_gallery_1', None),
            "image_gallery_2": getattr(item, 'image_gallery_2', None),
            "image_gallery_3": getattr(item, 'image_gallery_3', None),
            "pinout_summary": pinout_summary(item),  # pełny pinout tylko w GET /api/catalog/{id}
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
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
def get_catalog_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(models.OfficialComponent).filter(models.OfficialComponent.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Nie znaleziono komponentu")
    return {
        "id": item.id,
        "name": item.name,
        "symbol": item.symbol,
        "inventory_category": item.inventory_category,
        "applications": item.applications or [],
        "tags": getattr(item, 'tags', []),
        "technical_specs": item.technical_specs or {},
        "description": item.description,
        "datasheet_url": item.datasheet_url,
        "image_main": getattr(item, 'image_main', None),
        "image_gallery_1": getattr(item, 'image_gallery_1', None),
        "image_gallery_2": getattr(item, 'image_gallery_2', None),
        "image_gallery_3": getattr(item, 'image_gallery_3', None),
        "pinout": getattr(item, 'pinout', None),
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }

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
        pinout=clean_pinout(data.get("pinout"))
    )
    db.add(item)
    db.commit()
    db.refresh(item)
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
    if "pinout" in data:
        item.pinout = clean_pinout(data["pinout"])

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
app.include_router(knowledge_service.build_router(get_db, get_current_user))   # wiedza: niezbędniki, poradniki, artykuły, kursy
