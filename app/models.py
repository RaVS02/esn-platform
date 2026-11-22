from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy import JSON
from datetime import datetime, timedelta
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    login = Column(String(50), unique=True, index=True)
    email = Column(String(100), unique=True, index=True)
    hashed_password = Column(String(255))
    
    # Rola i status z HotWheels
    role = Column(String(20), default="user") # 'admin' lub 'user'
    is_banned = Column(Boolean, default=False)
    banned_until = Column(DateTime(timezone=True), nullable=True)
    ban_reason = Column(String(255), nullable=True)
    
    # Bezpieczeństwo z HotWheels
    failed_attempts = Column(Integer, default=0)
    lockout_until = Column(DateTime(timezone=True), nullable=True)
    
    # Profil
    avatar_path = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    projects = relationship("Project", back_populates="owner")
    codes = relationship("VerificationCode", back_populates="user")

    #sciezka do bazy magazynu dla usera
    inventory_db_path = Column(String, nullable=True)
class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), index=True)
    slug = Column(String(200), unique=True, index=True)
    short_desc = Column(Text)
    full_content_md = Column(Text)
    github_url = Column(String(255), nullable=True)
    tags = Column(String(255))
    
    # Pola dla interfejsu
    image_main = Column(String(255), nullable=True)
    image_schematic = Column(String(255), nullable=True)
    image_gallery_1 = Column(String(255), nullable=True)
    image_gallery_2 = Column(String(255), nullable=True)
    technical_notes = Column(Text, nullable=True)
    code_snippet = Column(Text, nullable=True)
    code_lang = Column(String(20), default="cpp")
    
    # ROZRÓŻNIENIE PROJEKTÓW
    is_official = Column(Boolean, default=False) # True = Twoje, False = Od społeczności
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="projects")
    tags = Column(String(255))
    components = Column(String(500), nullable=True)  # <--- NOWE: Lista podzespołów (po przecinku)
    markdown_path = Column(String(255), nullable=True) # <--- NOWE: Ścieżka do pliku .md
    status = Column(String(20), default="stable")

# NOWA TABELA: Zastępuje zapisywanie kodów z HotWheels
class VerificationCode(Base):
    __tablename__ = "verification_codes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    code = Column(String(10)) # 6-cyfrowy kod
    purpose = Column(String(50)) # np. 'register', 'reset_pass', 'delete_acc'
    expires_at = Column(DateTime(timezone=True))
    
    user = relationship("User", back_populates="codes")

class Component(Base):
    __tablename__ = "components"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), index=True)
    interface = Column(String(50))
    logic_voltage = Column(String(20))
    description = Column(Text)

class OfficialComponent(Base):
    __tablename__ = "official_components"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    symbol = Column(String, nullable=True)
    
    # Przeniesione z magazynu (Rezystory, Czujniki, Mikrokontrolery)
    inventory_category = Column(String) 
    
    # Dawne kategorie (Medyczne, Środowiskowe, IoT)
    applications = Column(JSON, default=[]) 
    tags = Column(JSON, default=[])
    # Parametry techniczne jako słownik (Napięcie, Interfejs, Prąd)
    technical_specs = Column(JSON, default={}) 
    
    description = Column(Text, nullable=True)
    datasheet_url = Column(String, nullable=True)
    
    # <--- NOWE: Pola na zdjęcia (wzorowane na tabeli Project)
    image_main = Column(String(255), nullable=True)
    image_gallery_1 = Column(String(255), nullable=True)
    image_gallery_2 = Column(String(255), nullable=True)
    image_gallery_3 = Column(String(255), nullable=True) 

    # Interaktywny pinout: {package, view, layout, pins:[{n,name,cat,type,fn,note,pad}], sources, notes}
    pinout = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    email = Column(String(100))
    subject = Column(String(200))
    message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_read = Column(Boolean, default=False)

class Media(Base):
    """Plik graficzny przypięty do dowolnego obiektu platformy (projekt, komponent, strona…).

    Źródło prawdy dla zdjęć. Stare kolumny image_* w projektach/komponentach są tylko
    synchronizowanym lustrem (karty, lista, Magazyn), patrz media_service.sync_legacy().
    """
    __tablename__ = "media"

    id = Column(Integer, primary_key=True, index=True)
    owner_type = Column(String(20), nullable=False, index=True)   # project | component | platform
    owner_id = Column(Integer, nullable=False, index=True)        # platform: 0
    role = Column(String(20), nullable=False, default="gallery")  # main | gallery | schematic | pinout
    path = Column(String(255), nullable=False)                    # względem katalogu static/
    original_name = Column(String(255), nullable=True)
    mime = Column(String(50), nullable=True)
    size_bytes = Column(Integer, default=0)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    caption = Column(String(300), nullable=True)
    position = Column(Integer, default=0)
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ProjectComponent(Base):
    """Relacja projekt ↔ podzespół z katalogu (dwustronna: karta projektu i karta podzespołu)."""
    __tablename__ = "project_components"
    __table_args__ = (UniqueConstraint("project_id", "component_id", name="uq_project_component"),)

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    component_id = Column(Integer, ForeignKey("official_components.id", ondelete="CASCADE"), nullable=False, index=True)
    note = Column(String(200), nullable=True)        # np. „czujnik temperatury”
    position = Column(Integer, default=0)


class CodeExample(Base):
    """Przykład kodu dla projektu lub podzespołu w wybranym środowisku (Arduino, ESP-IDF, MicroPython…)."""
    __tablename__ = "code_examples"

    id = Column(Integer, primary_key=True, index=True)
    owner_type = Column(String(20), nullable=False, index=True)   # project | component | platform
    owner_id = Column(Integer, nullable=False, index=True)
    lang = Column(String(30), nullable=False, default="other")
    title = Column(String(120), nullable=True)                    # np. nazwa pliku: src/main.cpp
    code = Column(Text, nullable=False)
    position = Column(Integer, default=0)


class Resource(Base):
    """Zasób do pobrania: link zewnętrzny albo plik hostowany (tylko z licencją i potwierdzeniem praw)."""
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    owner_type = Column(String(20), nullable=False, index=True)
    owner_id = Column(Integer, nullable=False, index=True)
    kind = Column(String(10), nullable=False)                     # link | file
    rtype = Column(String(20), nullable=False, default="other")   # datasheet | docs | schematic | pcb | firmware | model3d | guide | repo | other
    label = Column(String(200), nullable=False)
    url = Column(String(500), nullable=True)                      # kind = link
    path = Column(String(255), nullable=True)                     # kind = file (względem static/)
    original_name = Column(String(255), nullable=True)
    mime = Column(String(100), nullable=True)
    size_bytes = Column(Integer, default=0)
    license = Column(String(30), nullable=True)
    license_note = Column(String(300), nullable=True)             # autor / źródło / uznanie autorstwa
    position = Column(Integer, default=0)
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────────────────────
# WIEDZA: niezbędniki, poradniki, artykuły i kursy (lekcje = artykuły z kind='lesson')
# ─────────────────────────────────────────────────────────────────────────────
class KnowledgeCourse(Base):
    __tablename__ = "knowledge_courses"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(120), unique=True, index=True, nullable=False)
    title = Column(String(150), nullable=False)
    summary = Column(String(400), default="")
    level = Column(String(15), default="basic")          # basic | intermediate | advanced
    position = Column(Integer, default=0)
    published = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class KnowledgeArticle(Base):
    """Treść wiedzy. Kolumny content (title, body…) to wersja OPUBLIKOWANA (lub robocza, dopóki nie opublikowano).
    Po publikacji edycje trafiają do `draft` i dopiero akceptacja admina podmienia wersję publiczną."""
    __tablename__ = "knowledge_articles"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(140), unique=True, index=True, nullable=False)
    kind = Column(String(15), nullable=False, default="article", index=True)    # essential | guide | article | lesson
    course_id = Column(Integer, ForeignKey("knowledge_courses.id", ondelete="SET NULL"), nullable=True, index=True)
    position = Column(Integer, default=0)
    title = Column(String(150), nullable=False)
    summary = Column(String(400), default="")
    body = Column(Text, default="")
    level = Column(String(15), default="basic")
    tags = Column(JSON, default=list)
    widgets = Column(JSON, default=dict)                  # nazwa → kod HTML widgetu (renderowany w izolowanym iframe)
    reading_min = Column(Integer, default=1)

    published = Column(Boolean, default=False, index=True)
    published_at = Column(DateTime, nullable=True)
    draft = Column(JSON, nullable=True)                   # oczekujące zmiany opublikowanej treści
    draft_state = Column(String(10), default="draft")     # none | draft | review | rejected
    review_note = Column(String(500), nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    author_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class KnowledgeReview(Base):
    """Historia decyzji i zmian statusu (kto, co, kiedy)."""
    __tablename__ = "knowledge_reviews"

    id = Column(Integer, primary_key=True, index=True)
    article_id = Column(Integer, ForeignKey("knowledge_articles.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(20), nullable=False)           # create | submit | approve | reject | publish | unpublish | discard
    note = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class KnowledgeImport(Base):
    """Zapis zastosowanych partii treści (każda partia z archiwum importowana jest tylko raz, nawet po usunięciu treści)."""
    __tablename__ = "knowledge_imports"

    batch_id = Column(String(60), primary_key=True)
    applied_at = Column(DateTime, default=datetime.utcnow)
