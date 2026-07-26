import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Pobieramy adres bazy z pliku docker-compose (lub domyślny)
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://esn_user:lokalne_haslo_zmien_w_env@db:5432/esn_db")

# Tworzymy "silnik" łączący się z bazą
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Sesja bazy danych (do wysyłania zapytań)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Baza dla naszych przyszłych modeli (tabel)
Base = declarative_base()

# Funkcja pomocnicza do pobierania sesji w FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()