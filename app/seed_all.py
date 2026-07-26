import os
import random
import json
import models, utils
from database import SessionLocal, engine
from datetime import datetime

# Inicjalizacja tabel
models.Base.metadata.create_all(bind=engine)
db = SessionLocal()

def seed_everything():
    print("🚀 Rozpoczynam pełne przygotowanie bazy danych...")

    # 1. TWORZENIE ADMINISTRATORA
    admin_login = "admin_rafal"
    admin = db.query(models.User).filter(models.User.login == admin_login).first()
    
    if not admin:
        print(f"-> Tworzenie konta administratora: {admin_login}...")
        admin = models.User(
            username="Rafał S.",
            login=admin_login,
            email="sobalarafal2@gmail.com",
            hashed_password=utils.hash_password("admin123"),
            role="admin"
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
    
    # Przygotowanie bazy magazynu dla admina
    db_filename = f"user_{admin.id}.db"
    instance_path = "/app/esn_magazyn/instance"
    full_path = os.path.join(instance_path, db_filename)
    
    if not os.path.exists(full_path):
        os.makedirs(instance_path, exist_ok=True)
        open(full_path, 'w').close()
        print(f"-> Utworzono plik magazynu: {db_filename}")
    
    admin.inventory_db_path = f"/app/esn_magazyn/instance/{db_filename}"
    db.commit()

    # 2. GENEROWANIE PROJEKTÓW (36 sztuk)
    print("-> Generowanie 36 projektów do testów...")
    tags_pool = ["ESP32", "Arduino", "STM32", "IoT", "Robotyka", "Medycyna", "Sensory", "I2C", "Wi-Fi"]
    status_pool = ["stable", "progress", "archive"]

    for i in range(1, 37):
        slug = f"testowy-projekt-v{i}"
        if not db.query(models.Project).filter(models.Project.slug == slug).first():
            new_project = models.Project(
                title=f"Moduł Inżynieryjny v{i}",
                slug=slug,
                short_desc=f"Automatyczny opis projektu numer {i}.",
                tags=",".join(random.sample(tags_pool, 3)),
                components="ESP32, Rezystor 10k",
                technical_notes="Zasilanie 3.3V.",
                status=random.choice(status_pool),
                is_official=random.choice([True, False]),
                owner_id=admin.id
            )
            db.add(new_project)
    db.commit()

    # 3. GENEROWANIE KATALOGU KOMPONENTÓW (50 sztuk - test paginacji)
    print("-> Generowanie 50 komponentów w katalogu...")
    categories = ['Czujniki', 'Diody', 'Mikrokontrolery', 'Moduły', 'Układy scalone']
    apps_pool = ['IoT', 'Automatyka', 'Robotyka', 'Smart Home']
    
    for i in range(1, 51):
        name = f"Komponent Testowy {i:02d}"
        if not db.query(models.OfficialComponent).filter(models.OfficialComponent.name == name).first():
            comp = models.OfficialComponent(
                name=name,
                symbol=f"TEST-{100+i}",
                inventory_category=random.choice(categories),
                applications=random.sample(apps_pool, 2),
                tags=["test", "pagination", random.choice(tags_pool)],
                technical_specs={"Napięcie": "3.3V-5V", "Pobór": f"{i}mA"},
                description=f"To jest opis testowy dla komponentu {i}, stworzony w celu weryfikacji poprawności działania paginacji w katalogu podzespołów.",
                datasheet_url="https://example.com/datasheet.pdf"
            )
            db.add(comp)
    
    db.commit()
    print("✅ Baza danych gotowa! Możesz testować paginację (limit 12).")

if __name__ == "__main__":
    seed_everything()