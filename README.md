# ESN Platform & RS Projects Hub 🚀

W pełni skonteneryzowana platforma backendowa i frontendowa służąca do zarządzania bazą projektów inżynierskich, systemów wbudowanych oraz portfolio (zintegrowana z główną domeną www.rs-projects.ovh).

Projekt opiera się na architekturze Single Page Application (SPA) z dynamicznym ładowaniem danych prosto z bazy PostgreSQL i zaawansowanym systemem autoryzacji.

## 🛠️ Stack Technologiczny

* **Backend:** Python 3.11, FastAPI, Uvicorn
* **Baza Danych:** PostgreSQL 15, SQLAlchemy (ORM)
* **Frontend:** HTML5, CSS3, Vanilla JavaScript (Fetch API)
* **Bezpieczeństwo:** JWT (JSON Web Tokens), Bcrypt (Szyfrowanie haseł),Autoryzacja 2FA (E-mail)
* **Infrastruktura:** Docker, Docker Compose
* **Zarządzanie DB:** Adminer

---

## 🔒 System Autoryzacji i Ról (RBAC)

Platforma posiada wbudowany, autorski system zarządzania tożsamością:
* **Rejestracja z weryfikacją:** Wymaga potwierdzenia konta za pomocą 6-cyfrowego kodu wysyłanego asynchronicznie na adres e-mail (integracja z SMTP Gmail).
* **Odzyskiwanie Dostępu:** System resetowania hasła dla niezalogowanych użytkowników wraz z przypomnieniem loginu ID.
* **Bezpieczny Profil (2FA):** Zmiana adresu e-mail, hasła lub usunięcie konta wymaga każdorazowej autoryzacji kodem jednorazowym.
* **Ochrona przed Brute-Force:** System automatycznie blokuje konto na 15 minut po 5 nieudanych próbach logowania.
* **Tokeny JWT:** Po zalogowaniu przeglądarka otrzymuje bezpieczny bilet wstępu (`access_token`) zapisywany w `localStorage`.
* **Rozróżnienie Treści:** Projekty dzielą się na Oficjalne (zweryfikowane, od Administracji) oraz Społecznościowe.
* **Awatary:** Obsługa fizycznego wgrywania zdjęć profilowych na serwer z mechanizmem odświeżania bez wylogowania.
---

## 📁 Architektura Projektu i Struktura Plików

### 1. Infrastruktura (Środowisko)
* `docker-compose.yml` - Definiuje usługi: serwer webowy, bazę PostgreSQL oraz panel Adminer.
* `Dockerfile` - Przepis dla kontenera `web` (FastAPI).
* `requirements.txt` - Lista zależności Pythona.

### 2. Backend (Logika Aplikacji - folder `/app`)
* `main.py` - Serce aplikacji. Definiuje endpointy API, logikę logowania/rejestracji oraz serwuje pliki statyczne.
* `database.py` - Ustawienia połączenia silnika SQLAlchemy z bazą PostgreSQL.
* `models.py` - Struktura bazy. Definiuje relacje dla użytkowników, projektów (w tym flagę `is_official`) oraz kodów weryfikacyjnych.
* `schemas.py` - Walidacja Pydantic. Filtruje i zabezpiecza dane (np. ukrywa zahashowane hasła przed wysłaniem do frontendu).
* `utils.py` - Narzędzia pomocnicze: klasa `MailBot` do wysyłki e-maili oraz funkcje szyfrujące (Bcrypt).
* `auth.py` - Moduł odpowiedzialny za generowanie i dekodowanie cyfrowych biletów JWT.
* `seed_test.py`- generator danych testowych

### 3. Frontend (Interfejs Użytkownika)
* `templates/index.html` - Główny szkielet SPA. Posiada logikę JavaScript dla routera, dynamicznego filtrowania zapytań API (Server-Side Filtering) oraz obsługę globalnego obiektu `auth` (obsługa modali logowania).
* `static/style.css` - Arkusz stylów definiujący nowoczesny, mroczny wygląd (Dark Mode), komponenty UI (Badge, Callout, Timeline) i modale.

## 🔎 Filtrowanie i wyszukiwanie

- Multi-select:
  - mikrokontrolery
  - języki
  - protokoły
  - dziedziny
- Wyszukiwanie tekstowe:
  - tytuły
  - opisy
  - tagi
- Filtrowanie po źródle:
  - oficjalne
  - społeczność
  - moje projekty

## ⚡ Wydajność

- Paginacja po stronie klienta
- Przycisk **"Załaduj więcej"**
---

## 3. Widok Projektu i System Plików

### 📄 Zawartość projektu

- Galerie zdjęć i schematów
- Listy komponentów
- Notatki techniczne
- Dokumentacja w Markdown (`.md`)

### 📁 Zarządzanie plikami

- Automatyczne tworzenie katalogów projektu (na podstawie slug)
- Usuwanie nieaktualnych plików przy aktualizacji
- Usuwanie wszystkich plików przy kasowaniu projektu
- Automatyczne tworzenie katalogów na podstawie "sluga", usuwanie nieaktualnych zdjęć przy edycji i pełne czyszczenie dysku przy usuwaniu projektu.
- Fizyczne usuwanie starych plików graficznych przy aktualizacji zdjęcia profilowego.

  ## Struktura Projektu

```text
ESN-PLATFORM/
├── .vscode/                 # Konfiguracja środowiska (VS Code)
│   └── settings.json
├── app/                     # Główny katalog aplikacji (Backend + Mikroserwisy)
│   │
│   ├── esn_magazyn/         # [SUB-MODUŁ] Prywatny Magazyn Użytkownika (Flask)
│   │   ├── instance/        # Prywatne bazy danych (generowane automatycznie)
│   │   │   └── user_X.db    # Izolowana baza SQLite dla każdego użytkownika
│   │   ├── static/          # Pliki publiczne magazynu
│   │   │   └── magazyn.css  # Odseparowane style CSS tylko dla magazynu
│   │   ├── templates/       # Szablony HTML magazynu
│   │   │   └── index.html   # Widok SPA magazynu (Zarządzanie częściami)
│   │   ├── app.py           # Backend magazynu, logiki AI (LLM) i zarządzanie bazami
│   │   └── requirements.txt # Niezależna lista paczek dla Flaska
│   ├── static/              # Pliki statyczne (serwowane bezpośrednio)
│   │   ├── avatars/         # Fizyczne pliki zdjęć profilowych (.jpg, .png)
│   │   ├── images/          # Ogólne grafiki platformy
│   │   ├── projects/        # Dynamicznie tworzone foldery dla każdego projektu
│   │   └── style.css        # Główny arkusz stylów CSS (UI, RWD, Dark Mode)
│   ├── templates/           # Szablony HTML (Jinja2)
│   │   └── index.html       # Główny widok platformy (Single Page Application)
│   ├── auth.py              # Logika JWT (tworzenie i dekodowanie tokenów)
│   ├── database.py          # Konfiguracja połączenia z PostgreSQL (SQLAlchemy)
│   ├── main.py              # Punkt wejścia API, routery, endpointy i zabezpieczenia
│   ├── models.py            # Definicje tabel w bazie danych (ORM)
│   ├── schemas.py           # Walidacja danych wejścia/wyjścia (Pydantic)
│   ├── seed.py              # Skrypt inicjalizujący podstawowe dane (np. konto admina)
│   ├── seed_test.py         # Skrypt generujący fałszywe dane do testów UI
│   └── utils.py             # Klasa MailBot i szyfrowanie haseł (Bcrypt)
├── .env                     # Zmienne środowiskowe (hasła, sekrety JWT) - NIE WYSYŁAĆ NA GITA!
├── .gitignore               # Lista ignorowanych plików przez Gita
├── docker-compose.yaml      # Orkiestracja kontenerów (web, db, adminer)
├── Dockerfile               # Przepis na obraz kontenera (Python + FastAPI)
├── README.md                # Główna dokumentacja projektu
├── requirements.txt         # Lista zależności Pythona (pip)
├── nginx.conf               # Konfiguracja bramy Nginx (Routing '/' i '/magazyn')
└── schema.md                # Notatki techniczne i schematy architektoniczne
## 📱 Responsywność i UI
```
* **RWD (Mobile Friendly):** Pełne wsparcie dla urządzeń mobilnych dzięki Media Queries (adaptacyjne menu, gridy i modale).
* **Nawigacja:** Poprawiony układ paska z poziomym przewijaniem zakładek na mniejszych ekranach.
* **Komponenty:** Gotowa biblioteka stylów dla statystyk, linii czasu, badgy oraz notatek technicznych.

# 🔒 Zrealizowane Główne Moduły

### 1. Katalog Podzespołów (Official Components)
- Centralna, administrowana baza wiedzy o częściach elektronicznych.
- Dynamiczne, wielopoziomowe filtrowanie (AND/OR) po tagach, zastosowaniach i kategoriach.
- Zintegrowane wgrywanie wielu zdjęć, schematów oraz generowanie "wizytówek" podzespołów.

### 2. Indywidualny Magazyn Użytkownika
- Każdy zarejestrowany użytkownik otrzymuje prywatną, izolowaną fizycznie bazę danych SQLite (`user_X.db`).
- Zarządzanie stanami magazynowymi, lokalizacją (np. "Szuflada A1") i alertami o niskim stanie.
- Przypisywanie części do własnych "Mikro-projektów" (Rezerwacja komponentów).
- **Asystent AI:** Bot czytający na żywo stany magazynowe i doradzający w budowie układów.

### 3. Baza Projektów (Oficjalnych i Społecznościowych)
- Rozróżnienie na projekty autorskie (oznaczone taryfą "Oficjalny") i te dodane przez społeczność.
- Rendering dokumentacji z plików Markdown (`.md`).
- Multi-upload galerii zdjęć z obsługą własnego Lightboxa.

---

# 📅 Roadmap TODO

 #### Zawartosc pliku `TODO.md`
---

## 🚀 Uruchomienie Środowiska

Aby uruchomić całą platformę lokalnie:

1. Sklonuj repozytorium na serwer.
2. Skopiuj `.env.example` jako `.env` i uzupełnij go sekretami (JWT, hasła do bazy, dane SMTP, API Key dla Gemini). Zob. `docs/BEZPIECZENSTWO.md`.

3. Zbuduj i podnieś kontenery w tle:
   ```bash
   docker-compose up -d --build
   ```
4. Inicjalizacja bazy danych
    ```bash
    docker-compose exec web python seed.py
    docker-compose exec web python seed_test.py
    #lub gdy chcemy wszystko za jednym razem
    docker-compose exec web python seed_all.py
    ```
## 🔗 Dostępne Usługi
Po poprawnym uruchomieniu, platforma jest dostępna pod następującymi adresami:

* Aplikacja Frontendowa: http://localhost:8000
* Interaktywna Dokumenacja API (Swagger): http://localhost:8000/docs
* Zarządzanie Bazą Danych (Adminer): http://localhost:8080

## Pinout komponentów
Interaktywny opis wyprowadzeń i wyglądu podzespołów w katalogu: [docs/PINOUT.md](docs/PINOUT.md) · narzędzie (galeria i edytor): Narzędzia → Pinout (`/#tools/pinout`)

Schematy połączeń (edytor z osobnego repozytorium, osadzony w platformie): [docs/SCHEMATY.md](docs/SCHEMATY.md) · Narzędzia → Edytor schematów (`/#tools/schematic`) i sekcja „Schemat połączeń” w karcie projektu.

## Zdjęcia (system mediów)
Wiele zdjęć na projekt/komponent, role, powiększanie, limity i zabezpieczenia: [docs/MEDIA.md](docs/MEDIA.md).

## Bezpieczeństwo
Zasady przy dopisywaniu kodu (escapowanie danych, wgrywanie plików, biblioteki): [docs/BEZPIECZENSTWO.md](docs/BEZPIECZENSTWO.md).

## Relacje, kod i pliki do pobrania
Powiązania projekt↔podzespół, przykłady kodu dla wielu środowisk, linki i pliki z licencją: [docs/TRESCI.md](docs/TRESCI.md).
