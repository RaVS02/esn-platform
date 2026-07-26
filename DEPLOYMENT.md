# 🌐 Przewodnik wdrożenia na serwer (domeny i subdomeny)

## Scenariusz 1 – Jedna domena, ścieżki

```
https://esn.rs-projects.ovh/          → Portal (FastAPI)
https://esn.rs-projects.ovh/magazyn/  → Magazyn (Flask)
```

### Co zmienić:

**`.env`**
```
PORTAL_URL=https://esn.rs-projects.ovh
```

**`nginx.conf`** – zmień `server_name`:
```nginx
server {
    listen 80;
    server_name esn.rs-projects.ovh;  # ← ZMIEŃ

    location / {
        proxy_pass http://web:8000;
        ...
    }

    location /magazyn/ {
        rewrite ^/magazyn/(.*) /$1 break;
        proxy_pass http://electrolab_magazyn:5000;
        ...
    }
}
```

**`app/auth.py`** – ciasteczko JWT musi być widoczne na subdomenie:
```python
response.set_cookie(
    key="esn_access_token",
    value=token,
    domain="esn.rs-projects.ovh",  # ← ZMIEŃ (bez https://)
    path="/",
    httponly=True,
    samesite="lax",
    secure=True   # ← ZMIEŃ na True przy HTTPS
)
```

---

## Scenariusz 2 – Subdomena dla magazynu

```
https://esn.rs-projects.ovh          → Portal (FastAPI)
https://magazyn.rs-projects.ovh      → Magazyn (Flask)
```

### Co zmienić:

**`.env`**
```
PORTAL_URL=https://esn.rs-projects.ovh
```

**`nginx.conf`** – dwa osobne bloki `server {}`:
```nginx
server {
    listen 80;
    server_name esn.rs-projects.ovh;

    location / {
        proxy_pass http://web:8000;
        proxy_set_header Host $host;
        proxy_set_header Cookie $http_cookie;
    }
}

server {
    listen 80;
    server_name magazyn.rs-projects.ovh;

    location / {
        proxy_pass http://electrolab_magazyn:5000;
        proxy_set_header Host $host;
        proxy_set_header Cookie $http_cookie;
    }
}
```

**`app/main.py`** – ciasteczko musi działać dla OBU subdomen (użyj domeny nadrzędnej):
```python
response.set_cookie(
    key="esn_access_token",
    value=token,
    domain=".rs-projects.ovh",  # ← ZMIEŃ (z kropką = wszystkie subdomeny)
    path="/",
    httponly=True,
    samesite="lax",
    secure=True   # ← True przy HTTPS
)
```

**`app/esn_magazyn/app.py`** – redirect po wylogowaniu:
```python
PORTAL_URL = os.environ.get('PORTAL_URL', 'https://esn.rs-projects.ovh')
```
(pobierane z `.env`, więc wystarczy zmienić tylko `.env`)

**`templates/index.html` (magazyn)** – funkcja `api()`:
```javascript
// Scenariusz 1 (ścieżka /magazyn/):
const url = '/magazyn' + endpoint;

// Scenariusz 2 (subdomena):  ← ZMIEŃ jeśli używasz subdomeny
const url = endpoint;  // bez prefixu, bo jesteś już na magazyn.domena.pl
```

---

## Podsumowanie – pełna lista miejsc do zmiany

| Plik | Co zmieniać | Kiedy |
|---|---|---|
| `.env` → `PORTAL_URL` | adres portalu do redirecta | zawsze |
| `.env` → `JWT_SECRET_KEY` | losowy klucz na produkcji | zawsze |
| `nginx.conf` → `server_name` | docelowa domena | zawsze |
| `app/main.py` → `set_cookie(domain=...)` | domena ciasteczka JWT | zawsze |
| `app/main.py` → `set_cookie(secure=True)` | włącz przy HTTPS | przy SSL |
| `templates/index.html` → `api()` | prefix URL | tylko przy subdomenie |
| `docker-compose.yaml` → hasła bazy | zmień z `tajnehaslo` | zawsze na prod |

---

## Lokalne testy na Windows (bez Dockera)

```bash
# Terminal 1 – FastAPI (portal)
cd app
pip install -r ../requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 – Flask (magazyn)
cd app/esn_magazyn
pip install -r requirements.txt
set FLASK_ENV=development
set JWT_SECRET_KEY=d6f6bfdce2336e62a1c20facc8fd76575577968c40c22ae69a6b1cc3b3f48575
set GEMINI_API_KEY=twoj_klucz
python app.py
# → http://localhost:5000
```

W trybie `development` (bez ciasteczka JWT) magazyn tworzy lokalną bazę `dev.db`.

---

## Weryfikacja czy AI działa

Otwórz DevTools (F12) → Network → wyślij wiadomość do AI.

Powinieneś zobaczyć request do:
- **Ścieżka:** `POST /magazyn/api/ai/chat`
- **Subdomena:** `POST /api/ai/chat`

Jeśli request idzie do `/api/ai/chat` bez `/magazyn` – to błąd w `index.html` (patrz wyżej).
