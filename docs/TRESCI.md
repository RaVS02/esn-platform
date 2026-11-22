# Relacje projekt ↔ podzespół, przykłady kodu i zasoby do pobrania

Trzy rzeczy w kartach projektów i podzespołów katalogu: **powiązania w obie strony**, **przykłady kodu dla wielu środowisk**
i **zasoby** (linki oraz pliki). Edytuje się je w oknach edycji, a w kartach pojawiają się jako osobne sekcje.

## 1. Relacja projekt ↔ podzespół

- W oknie edycji projektu pole **„Podzespoły z katalogu”**: wpisz kilka liter, wybierz z podpowiedzi, opcjonalnie dopisz
  **rolę w projekcie** (np. „czujnik temperatury”). Pole tekstowe poniżej (**„Inne elementy”**) zostaje na rzeczy spoza katalogu
  (rezystory, przewody).
- **Karta projektu**: sekcja „Użyte podzespoły z katalogu” z kartami; klik otwiera kartę podzespołu.
- **Karta podzespołu**: sekcja „Przykładowe wykorzystanie w projektach” (do 50 najnowszych); klik otwiera projekt.
- Elementy z pola tekstowego, które mają już kartę w katalogu, nie powtarzają się w „Inne elementy”.
- Usunięcie projektu lub podzespołu usuwa powiązania.
- **Migracja:** przy pierwszym starcie stare pola tekstowe `components` są dopasowywane do katalogu **tylko dokładnie**
  (po nazwie lub symbolu, bez rozróżniania wielkości liter; separatory `,` i `;`). Nic nie jest zgadywane. W logu: `[content] migracja relacji i kodu`.

## 2. Przykłady kodu (wiele środowisk)

W oknie edycji projektu i podzespołu panel **„Przykłady kodu”**: wybierz środowisko, kliknij „+ Dodaj przykład”, wpisz nazwę pliku
(np. `src/main.cpp`) i wklej kod. Środowiska: Arduino, ESP-IDF, PlatformIO, ESPHome, MicroPython, CircuitPython, Python, C++, C,
Rust, Shell, YAML, JSON, INI, Inne. W karcie powstają **zakładki** (przy jednym przykładzie bez zakładek) z przyciskiem **Kopiuj**.
Kolejność ustawiasz strzałkami ◀ ▶.

- Limity: 12 przykładów na obiekt, 60 KB na przykład (`CODE_MAX_ITEMS`, `CODE_MAX_KB`).
- Stary pojedynczy fragment kodu projektu został **przeniesiony** do pierwszego przykładu (język `C++` → `cpp` itd.). Stare kolumny
  `code_snippet`/`code_lang` są nadal wypełniane pierwszym przykładem (zgodność wsteczna), ale zapis projektu ich już nie nadpisuje.
- Kod jest wyświetlany wyłącznie jako tekst (nie jest wykonywany ani interpretowany jako HTML).

## 3. Zasoby do pobrania

### Linki (domyślny, zalecany sposób)
Rodzaj (datasheet, dokumentacja, schemat, PCB, kod/firmware, model 3D, poradnik, repozytorium, inne), opis i adres
`http(s)://…`. W karcie widać też domenę docelową; linki otwierają się z `rel="noopener noreferrer nofollow ugc"`.
Dla cudzych materiałów (datasheet producenta, PDF z książki) **wstawiaj link, nie plik**.

### Pliki hostowane na platformie – tylko z licencją i potwierdzeniem praw
Plik można wgrać, gdy jest **Twoją własną pracą** albo ma **wolną licencję**. Formularz wymaga:

1. wyboru licencji: praca własna autora, CC0, domena publiczna, CC BY 4.0, CC BY-SA 4.0, MIT, Apache-2.0, BSD-3-Clause, GPL-3.0,
2. dla licencji innej niż „własna”: **autora lub źródła** (uznanie autorstwa),
3. zaznaczenia oświadczenia, że masz prawo udostępniać ten plik.

Kto wgrywa: w projektach autor i admin; w podzespołach **tylko admin/moderator**. Etykieta licencji i autor są widoczne przy pliku,
a pod listą jest link „Zgłoś problem z plikiem” (formularz kontaktowy). Admin może usunąć dowolny zasób.

**Dozwolone typy** (rozpoznawane po zawartości, nie po nazwie): PDF, ZIP, STL, STEP, pliki KiCad (`.kicad_sch/pcb/sym/mod/pro`) oraz tekstowe/kodu
(`txt md csv json yaml yml ino py c h cpp hpp ini toml`). Limit 7 MB na plik, 15 zasobów na obiekt (`RES_MAX_FILE_MB`, `RES_MAX_PER_OWNER`). Jeśli podnosisz limity plików (`MEDIA_MAX_FILE_MB`, `RES_MAX_FILE_MB`), podnieś też `client_max_body_size` w `nginx.conf` (musi być większe od największego pliku o ok. 1 MB).
Miejsce zajęte przez pliki **wlicza się do tej samej puli co zdjęcia** (limit na konto, wgrania na godzinę, globalny sufit dysku; patrz `docs/MEDIA.md`).

**Czego nie przyjmujemy:** programów (`.exe`, `.dll`, `.bat`, `.sh`, `.jar`…), `.html`, `.js`, `.svg`, plików bez rozszerzenia z listy.
**ZIP-y są przeglądane**: odrzucane są archiwa zawierające powyższe typy, ścieżki bezwzględne lub `..`, zaszyfrowane, z ponad 2000 plików
albo rozpakowujące się powyżej 300 MB.

Pliki leżą w `app/static/files/<typ>/<rok-miesiąc>/<uuid>.<rozszerzenie>` (nazwa nadana przez serwer; oryginalna nazwa jest używana
tylko jako nazwa pobieranego pliku) i dostają nagłówki `nosniff` oraz `Content-Security-Policy: … sandbox`, tak jak zdjęcia.

> To narzędzie techniczne, a nie porada prawna. Gdy ktoś zgłosi naruszenie praw autorskich, usuń zasób w oknie edycji.

## 4. API

| Metoda i ścieżka | Kto | Opis |
|---|---|---|
| `GET /api/projects/{id}/components` | wszyscy | podzespoły projektu |
| `PUT /api/projects/{id}/components` `{items:[{component_id, note}]}` | autor/admin | zamiana listy |
| `GET /api/catalog/{id}/projects` | wszyscy | projekty używające podzespołu |
| `GET /api/code-examples?owner_type=&owner_id=` | wszyscy | przykłady kodu + słownik języków |
| `PUT /api/code-examples` `{owner_type, owner_id, items:[{lang,title,code}]}` | edytor obiektu | zamiana całej listy |
| `GET /api/resources?owner_type=&owner_id=` | wszyscy | zasoby |
| `GET /api/resources/policy` | wszyscy | rodzaje, licencje, limity, dozwolone rozszerzenia |
| `POST /api/resources/link` | edytor obiektu | dodanie linku |
| `POST /api/resources/file` (multipart) | edytor obiektu | wgranie pliku (licencja i `rights=true` wymagane) |
| `PATCH /api/resources/{id}`, `POST /api/resources/reorder`, `DELETE /api/resources/{id}` | edytor obiektu | edycja, kolejność, usunięcie |

Dokumentacja interaktywna: `/docs`, grupa „Relacje, kod i zasoby”.

## 5. Wdrożenie na działającym serwerze

1. Kopia zapasowa bazy i `app/static/` (patrz `docs/PINOUT.md`, `docs/MEDIA.md`).
2. Podmień pliki, `docker compose restart web`. Powstają trzy nowe tabele (`project_components`, `code_examples`, `resources`);
   istniejące dane nie są zmieniane.
3. W logu `web` sprawdź linię `[content] migracja relacji i kodu: {...}`.
4. Ctrl+F5 (`content.js`/`content.css` mają `?v=1`).
5. Opcjonalnie w `.env`: `RES_MAX_FILE_MB`, `RES_MAX_PER_OWNER`, `CODE_MAX_ITEMS`, `CODE_MAX_KB`.

**Wycofanie:** przywróć poprzednie pliki. Stare kolumny `components`, `code_snippet`, `code_lang`, `datasheet_url`, `github_url`
są nadal aktualne. Nowe tabele zostaną nieużywane.

## 6. Znane ograniczenia

- Kod bez kolorowania składni (zwykły blok monospace z przyciskiem Kopiuj).
- `datasheet_url` (podzespół) i `github_url` (projekt) zostają osobnymi polami i przyciskami w nagłówku karty; nie są kopiowane do zasobów.
- Pliki od użytkowników nie są skanowane antywirusowo (sprawdzane są typ, zawartość i zawartość archiwów ZIP).
- Brak liczników pobrań.
