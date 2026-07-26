import os
import models, utils
from database import SessionLocal, engine

# Tworzymy tabele dla głównej bazy (PostgreSQL), jeśli nie istnieją
models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

def seed_data():
    # 1. TWORZYMY KONTO ADMINISTRATORA
    admin_login = "admin_rafal" # Zmień na swój ulubiony login
    
    # Sprawdzamy czy admin już istnieje
    admin = db.query(models.User).filter(models.User.login == admin_login).first()
    
    if not admin:
        print(f"Tworzenie konta administratora: {admin_login}...")
        admin = models.User(
            username="Rafał S.",
            login=admin_login,
            email="sobalarafal2@gmail.com",
            hashed_password=utils.hash_password("admin123"), # ZMIEŃ HASŁO PO ZALOGOWANIU!
            role="admin"
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        print("Konto administratora gotowe.")
    else:
        print("Konto administratora już istnieje w bazie.")

    # =====================================================================
    # NOWOŚĆ: TWORZYMY FIZYCZNY PLIK BAZY MAGAZYNU (.db) DLA ADMINA
    # =====================================================================
    
    # Znajdujemy główny folder aplikacji (tam gdzie leży seed.py)
    base_dir = os.path.dirname(os.path.abspath(__file__))
    instance_dir = os.path.join(base_dir, "esn_magazyn", "instance")
    db_filename = f"user_{admin.id}.db"
    full_path = os.path.join(instance_dir, db_filename)
    
    # Tworzymy folder 'instance' (jeśli go nie ma) i pusty plik bazy
    os.makedirs(instance_dir, exist_ok=True)
    if not os.path.exists(full_path):
        open(full_path, 'w').close()
        print(f"Utworzono pusty plik bazy magazynu: {db_filename}")
    
    # Zapisujemy ścieżkę do bazy w profilu użytkownika (ścieżka widziana przez Dockera)
    docker_path = f"/app/esn_magazyn/instance/{db_filename}"
    if admin.inventory_db_path != docker_path:
        admin.inventory_db_path = docker_path
        db.commit()
        print("Zaktualizowano ścieżkę do magazynu w profilu administratora.")

    # 2. DODAJEMY OFICJALNE PROJEKTY
    ecg_project = db.query(models.Project).filter(models.Project.slug == "akwizytor-ekg-esp32").first()
    
    if not ecg_project:
        print("Dodawanie oficjalnego projektu EKG...")
        project = models.Project(
            title="Akwizytor Sygnału EKG (500Hz)",
            slug="akwizytor-ekg-esp32",
            short_desc="Projekt medycznego rejestratora...",
            tags="ESP32,FreeRTOS,SPI,Python",
            components="ESP32 WROOM-32,ADS1293 (AFE),Moduł LDO 3.3V,Bateria Li-Po 1000mAh",
            technical_notes="Pinning rdzeni: Akwizycja na Core 1...",
            code_snippet="void setup() {\n  initADS1293();\n  xTaskCreatePinnedToCore(readEcgTask, 'ECG', 4096, NULL, 5, NULL, 1);\n}",
            code_lang="cpp",
            is_official=True,
            owner_id=admin.id
        )
        db.add(project)
        db.commit()
        print("Projekt EKG dodany jako oficjalny.")

if __name__ == "__main__":
    seed_data()
    db.close()