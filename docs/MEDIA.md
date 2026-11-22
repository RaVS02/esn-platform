# System mediów (zdjęcia projektów, komponentów i platformy)

Jedno miejsce na wszystkie zdjęcia: **tabela `media`** zamiast stałych kolumn. Projekt i komponent mogą mieć wiele
zdjęć z rolami (główne, schemat, galeria, pinout), podpisami i kolejnością. Ten sam mechanizm obsługuje później
artykuły i grafiki całej platformy (`owner_type = platform`).

## Jak tego używać

**W oknie edycji projektu lub komponentu** jest panel „Zdjęcia”:
- przeciągnij pliki lub kliknij pole (można kilka naraz),
- każde zdjęcie ma **rolę** (lista), **podpis**, strzałki ◀ ▶ do zmiany kolejności i 🗑 do usunięcia,
- pierwsze zdjęcie obiektu samo staje się **głównym**; ustawienie innego głównego zmienia poprzednie na „Galeria”;
  po usunięciu głównego awansuje następne zwykłe zdjęcie,
- **nowy** projekt/komponent: zdjęcia czekają w przeglądarce i wgrywają się po pierwszym zapisie,
  **istniejący**: wgrywają się od razu (z paskiem postępu),
- nad polem widać licznik („3 / 20”) i Twoje wykorzystane miejsce.

Role: projekt – `main`, `schematic`, `gallery`; komponent – `main`, `gallery`, `pinout`; platforma – `main`, `gallery`.
Obrazy z rolą `pinout` są pokazywane w sekcji Pinout karty komponentu, a nie w ogólnej galerii (patrz `docs/PINOUT.md`, rozdział 10).

**W karcie projektu/komponentu** zdjęcia są w tej samej mozaice co dotąd (do 4 kafelków, „+N” przy reszcie).
Kliknięcie otwiera podgląd z powiększaniem:

| Akcja | Jak |
|---|---|
| zoom | kółko myszy (płynnie), `+` / `−`, dwuklik, pinch na ekranie dotykowym |
| przesuwanie | przeciąganie po powiększeniu |
| następne / poprzednie | `←` `→`, przyciski, gest przeciągnięcia, miniatury |
| dopasuj / zamknij | `0` / `Esc` lub klik w tło |

## Limity (domyślne, zmienne środowiskowe w pliku `.env` obok `docker-compose.yaml` (`web` czyta go przez `env_file`))

| Co | Domyślnie | Zmienna |
|---|---|---|
| rozmiar jednego pliku | 5 MB | `MEDIA_MAX_FILE_MB` |
| wymiary | 8000 px, 40 Mpx | `MEDIA_MAX_DIMENSION`, `MEDIA_MAX_MEGAPIXELS` |
| zdjęć na projekt / komponent | 20 / 20 | `MEDIA_MAX_PER_PROJECT`, `MEDIA_MAX_PER_COMPONENT` |
| miejsce na konto (zwykły użytkownik) | 150 MB | `MEDIA_USER_QUOTA_MB` |
| miejsce na konto (admin/moderator) | 1500 MB | `MEDIA_STAFF_QUOTA_MB` |
| wgrań na godzinę (użytkownik / staff) | 60 / 300 | `MEDIA_UPLOADS_PER_HOUR`, `MEDIA_STAFF_UPLOADS_PER_HOUR` |
| **globalny limit dysku na zdjęcia** | 5000 MB | `MEDIA_GLOBAL_CAP_MB` |
| avatar | 2 MB | `MEDIA_AVATAR_MAX_MB` |
| plik `.md` projektu | 512 KB | `MEDIA_MARKDOWN_MAX_KB` |

Globalny limit jest ostatnią zaporą: gdy suma wszystkich zdjęć go przekroczy, nikt nic więcej nie wgra (kod 507).
Dodatkowo nginx przyjmuje żądania do 8 MB (`client_max_body_size` w `nginx.conf`).

## Bezpieczeństwo – co jest sprawdzane

- **Typ po zawartości**, nie po nazwie: tylko JPEG, PNG, WebP, GIF. Plik `.html`/`.php` nazwany `.png` zostaje odrzucony.
  **SVG jest świadomie zablokowany** (może zawierać skrypty). Schematy zapisuj jako PNG/WebP.
- Nazwę pliku nadaje serwer (`media/<typ>/<rok-miesiąc>/<uuid>.<rozszerzenie>`), użytkownik nie wpływa na ścieżkę.
- JPEG: usuwany EXIF/XMP, **w tym współrzędne GPS**; zachowywana jest tylko orientacja (zdjęcia z telefonu się nie obracają).
  PNG: usuwane metadane tekstowe i EXIF. Dane doklejone za końcem obrazu są obcinane.
- Kasowanie plików działa tylko w katalogach uploadów (`media/ projects/ catalog/ avatars/`) i po normalizacji ścieżki.
- Pliki z katalogów uploadów dostają nagłówki `X-Content-Type-Options: nosniff` i `Content-Security-Policy: … sandbox`,
  więc nawet stary plik `.html` nie wykona w nich skryptów.

### Luki naprawione przy okazji (istniały w poprzedniej wersji)

1. **Usuwanie dowolnych plików przez zwykłe konto.** `PUT /api/projects/{id}` przyjmował z żądania ścieżki zdjęć, a usuwanie
   składało `static/<ścieżka>` – wpisanie `../plik` pozwalało skasować plik poza `static/`. Teraz ścieżki ustala wyłącznie serwer.
2. **Wgrywanie dowolnych plików** (np. `.html`) jako „zdjęcia” i serwowanie ich z `/static` (stored XSS; token JWT jest w `localStorage`).
   Dotyczyło też avatarów (rozszerzenie brane z nazwy użytkownika).
3. **Nadpisywanie dowolnych pól projektu** parametrem `field` w `/upload` (np. `title`).
4. Brak limitów rozmiaru i liczby plików.

**Pliki do pobrania** (`docs/TRESCI.md`) dzielą z zdjęciami tę samą pulę miejsca na konto, limit wgrań na godzinę i globalny sufit dysku.

## Co się dzieje z istniejącymi zdjęciami

Przy pierwszym starcie po aktualizacji aplikacja **importuje** zdjęcia z kolumn `image_main`, `image_schematic`,
`image_gallery_*` do tabeli `media` (pliki zostają tam, gdzie były, nic nie jest przenoszone ani kasowane). Import jest
idempotentny. W logu zobaczysz linię `[media] migracja zdjęć: {...}`; `skipped_missing` oznacza wpis w bazie wskazujący na plik,
którego nie ma na dysku.

Stare kolumny `image_*` są **nadal utrzymywane** (lustro tabeli `media`), więc karty na listach, Magazyn i zbuforowany stary
frontend działają bez zmian. Stare endpointy `/api/projects/{id}/upload` i `/api/catalog/{id}/upload` zostały jako cienkie
nakładki na nowy system.

## API

| Metoda i ścieżka | Kto | Opis |
|---|---|---|
| `GET /api/media?owner_type=&owner_id=` | wszyscy | lista (główne pierwsze) |
| `GET /api/media/limits?owner_type=&owner_id=` | zalogowany | limity i Twoje wykorzystanie |
| `POST /api/media` (multipart: `owner_type, owner_id, role, caption, file`) | edytor obiektu | wgranie jednego pliku |
| `PATCH /api/media/{id}` (`role`, `caption`) | edytor obiektu | zmiana roli/podpisu |
| `POST /api/media/reorder` (`owner_type, owner_id, ids[]`) | edytor obiektu | kolejność |
| `DELETE /api/media/{id}` | edytor obiektu | usunięcie |

Kto może edytować: projekt – autor lub admin; komponent – admin/moderator; platforma – admin (`owner_id = 0`).
Dokumentacja interaktywna: `/docs`, grupa „Media (zdjęcia)”.

## Wdrożenie na działającym serwerze

1. **Kopia zapasowa:** baza (`pg_dump`, komenda w `docs/PINOUT.md`) oraz katalog `app/static/` (uploady).
2. Podmień pliki z paczki (`git apply` lub rozpakowanie), w tym `nginx.conf`.
3. `docker compose restart nginx web` (nginx wczytuje konfigurację z wolumenu; `web` ma `--reload`, ale restart jest pewniejszy).
4. W logu `web` sprawdź linię `[media] migracja zdjęć`.
5. Ctrl+F5 w przeglądarce (assety `media.js`/`media.css` mają `?v=1`).
6. Opcjonalnie ustaw limity w pliku `.env`, np. `MEDIA_GLOBAL_CAP_MB=2000` (po zmianie: `docker compose up -d web`).

**Wycofanie:** przywróć poprzednie pliki. Kolumny `image_*` są aktualne, więc stara wersja działa; tabela `media` po prostu
przestaje być używana. Zdjęcia wgrane już w nowym systemie leżą w `app/static/media/` i są widoczne w starej wersji dzięki lustru kolumn.

## Znane ograniczenia

- WebP i GIF nie mają czyszczonych metadanych (rzadko zawierają GPS). Pełna obróbka (miniatury, przeskalowanie, konwersja do WebP)
  wymaga biblioteki Pillow – można dodać później kosztem przebudowy obrazu Dockera.
- Brak miniatur: kafelki ładują oryginały (do 5 MB). Przy dużym ruchu warto dodać generowanie miniatur.
- Zmiana kolejności tylko strzałkami (bez przeciągania).
- Wyrenderowany plik `.md` projektu trafia do strony bez sanityzacji HTML – to osobna sprawa, do załatwienia w module artykułów.

## Rozszerzanie o nowy typ obiektu (np. `article`)

W `media_service.py`: dopisz typ do `ROLES` i `CFG["per_owner"]`, obsłuż go w `owner_exists_and_can_edit()` (istnienie + uprawnienia),
a jeśli ma mieć stare kolumny – w `LEGACY_FIELDS` i `sync_legacy()`. Frontend: `ESNMedia.manager(el, {ownerType, ownerId, roles})`
i `ESNMedia.mountGallery(slot, ownerType, ownerId)`.
