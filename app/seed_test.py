import random
import models
from database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)
db = SessionLocal()

def seed_test_projects():
    # Szukamy użytkownika, do którego przypiszemy projekty (np. Twoje konto admina)
    user = db.query(models.User).first()
    if not user:
        print("Najpierw musisz utworzyć jakiegoś użytkownika! (odpal seed.py)")
        return

    # Słowniki danych do losowania
    tags_pool = ["ESP32", "Arduino", "STM32", "Raspberry Pi", "FreeRTOS", "C/C++", "Python", "IoT", "Robotyka", "Smart Home", "Medycyna", "Sensory", "MQTT", "I2C/SPI", "Wi-Fi/BLE"]
    status_pool = ["stable", "progress", "archive"]

    print("Rozpoczynam generowanie 36 projektów...")

    for i in range(1, 37):
        # Losujemy od 2 do 4 tagów dla każdego projektu
        num_tags = random.randint(2, 4)
        random_tags = ",".join(random.sample(tags_pool, num_tags))
        
        # Losujemy status i pochodzenie
        random_status = random.choice(status_pool)
        is_official = random.choice([True, False])

        new_project = models.Project(
            title=f"Testowy Moduł Inżynieryjny v{i}",
            slug=f"testowy-modul-inzynieryjny-v{i}",
            short_desc=f"To jest wygenerowany automatycznie projekt testowy numer {i}. Został wylosowany ze statusem {random_status.upper()} i posiada tagi: {random_tags}.",
            tags=random_tags,
            components="ESP32, Rezystor 10k, Kondensator 100nF, Moduł LDO",
            technical_notes="Zasilanie: Zastosowano stabilizator 3.3V. Komunikacja: Dane przesyłane są w formacie binarnym.",
            status=random_status,
            owner_id=user.id,
            is_official=is_official,
            code_lang="cpp",
            code_snippet="// Przykładowy kod\nvoid setup() {\n  Serial.begin(115200);\n}"
        )
        db.add(new_project)

    db.commit()
    print("✅ Pomyślnie wygenerowano i zapisano 36 projektów w bazie!")

if __name__ == "__main__":
    seed_test_projects()