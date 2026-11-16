from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
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