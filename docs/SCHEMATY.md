# Edytor schematów połączeń w platformie (v38)

Edytor powstał jako osobny projekt (repozytorium `SchematPolaczenGUIWebApp`; źródłem prawdy o samym edytorze są jego `README.md` i `HANDOFF.md`).
W platformie działa ten sam kod, z kilkoma hakami oznaczonymi w źródle komentarzem `ESN:`.

## 1. Gdzie jest

| Miejsce | Co robi |
|---|---|
| **Narzędzia → Edytor schematów** (`/#tools/schematic`, `/#tools/schematic/<id>`) | lista **„Moje schematy”** nad edytorem (v40): części/połączenia, data zmiany, projekt; akcje Otwórz, Duplikuj, Podepnij do projektu / Odepnij, Usuń. Zalogowani zapisują na koncie, goście w przeglądarce (lista „Schematy w tej przeglądarce”, bez podpinania) |
| **Karta projektu** (sekcja „Schemat połączeń”) | schemat powiązany z projektem. Widzą go wszyscy. Edytują autor projektu (lub schematu) i admin. Autor bez schematu widzi przycisk „Dodaj schemat połączeń” |

Na telefonie edytor w karcie projektu startuje w podglądzie (przełącznik „Edycja” go włącza), zgodnie z rekomendacją README edytora 10.7.
Odwiedzający i zalogowani nie-autorzy widzą schemat **tylko do odczytu**: bez biblioteki części, zapisu, importu, auto-układu i notatek; eksport zostaje.
**Motyw** (v39, etap 11 edytora): edytor przełącza się razem z platformą (`opts.theme: 'auto'`, zdarzenie `esn-theme`) – reguły `.sch.light` w `wiring/style.css`.
Kolory magistral i kategorii (`--c`) zostają bez zmian (korzysta z nich eksport), na ekranie w jasnym motywie przyciemnia je `--cv` (`color-mix`, ten sam współczynnik co `shadeForLight` w eksporcie).

## 2. Pliki

| Plik | Opis |
|---|---|
| `app/static/wiring/app.js` | edytor (`SchematEditor.mount`). Kopia `static/app.js` z repozytorium edytora + haki `ESN:` (niżej) |
| `app/static/wiring/style.css` | style edytora (zakres `.sch`). Usunięty blok `:root` z tokenami demo i reguła `body{}` |
| `app/static/wiring/platform.css` | dopasowanie do strony: wysokość, `.sch [hidden]`, odstępy po resecie platformy, sekcja w karcie projektu |
| `app/static/wiring-embed.js` | osadzenie: rejestracja w `ESNTools`, tryb gościa (localStorage), sekcja w karcie projektu (`ESNWiring.mountProject`) |
| `app/wiring_service.py` | API `/api/wiring` (to samo co w demo: `/parts`, `/projects`) + walidacja `clean_wiring` / `clean_part` |
| `app/models.py` | tabele `wiring_schemas` i `wiring_parts` (tworzone automatycznie przy starcie, migracja addytywna) |
| `app/tests/test_wiring.py` | testy API, uprawnień, blokady wersji i walidacji |

**Zmiana edytora:** popraw kod w repozytorium edytora, skopiuj `static/app.js` do `app/static/wiring/app.js` (haki `ESN:` są wstecznie zgodne z demo, więc warto je mieć też w repozytorium edytora) i podbij `?v=` w `templates/index.html`.
`style.css` kopiuj bez bloku `:root{…}` i reguły `body{…}`.

## 2a. Części podstawowe (v41)

`app/wiring_builtin.py` – 26 części wspólnych dla wszystkich (id `std-*`, źródło `builtin`): masa, szyny 3,3 V i 5 V, bateria, zasilanie 12 V, przetwornica 12→5 V,
regulator AMS1117, bezpiecznik, rezystor, potencjometr, kondensator, cewka, kwarc, dioda, LED, LED z rezystorem, tranzystory NPN/PNP/MOSFET N, przycisk, przełącznik,
złącza 2- i 4-pin, brzęczyk, serwo, silnik DC (z demo edytora + uzupełnienia; nazwy i opisy PL/EN).
W bibliotece edytora zakładka **Podstawowe** (oraz w „Wszystkie”), plakietka „podstawowa”, bez edycji (jak katalog; PUT `std-*` → 400), nie trafiają do eksportu JSON.
Wartości przy węźle: rezystory/potencjometry i kondensatory – liczba + jednostka (4k7 → 4,7 kΩ, 100n → 100 nF, szereg E12); pozostałe – dowolny tekst (np. 16 MHz, 10 µH, 9 V).
Złożone podzespoły (MCU, moduły, układy) pochodzą z katalogu (pinout + dokumentacja); inne piny → część własna.
Nowa część podstawowa: dopisz do `BUILTIN_PARTS` (nie zmieniaj id istniejących – są zapisane w schematach); test `test_builtin_parts` sprawdza zgodność z walidacją.
Identyfikatory pinów mogą zawierać `+`, `/`, `−` itp. (`PIN_RE`; v41 – wcześniej piny typu `+5V` w częściach własnych były gubione przy zapisie).

## 3. Haki dodane w `app.js` (komentarz `ESN:`)

| Hak | Po co |
|---|---|
| `opts.api.call(method, url, body)` | własna warstwa danych zamiast `fetch` – tryb gościa w localStorage (README edytora 11) |
| błąd `api()` ma `status` i `data` | obsługa 409 i komunikatów serwera (`errText`, tłumaczone przez `ESNI18n.err`) |
| `S.meta = {rev, can_edit, project_id}` | dane serwera trzymane poza projektem (cofanie i eksport JSON ich nie zawierają) |
| zapis z `rev`, obsługa **409** (`saveConflict`) | blokada optymistyczna: „wczytaj nowszą” (OK) albo „zapisz jako kopię” (Anuluj) – README edytora 10.2 |
| `opts.single` | jeden schemat (karta projektu): bez listy schematów, „Nowy projekt” i „Usuń projekt” |
| `opts.hideLang` | język ustawia platforma (`opts.lang = ESNI18n.lang()`), przełącznik PL/EN edytora ukryty |
| `opts.readOnly` | dodatkowo ukrywa Zapisz, Auto-układ, Notatka, Import, bibliotekę części; nazwa schematu nieedytowalna. Eksport zostaje |
| `opts.theme` (`light` / `dark` / `auto`) | jasny motyw (klasa `.light` na korzeniu); `auto` = atrybut `data-theme` strony, zmiana na żywo |
| `cache: 'no-store'` w `api()` | odpowiedzi zależą od użytkownika (`can_edit`) – nie mogą wrócić z pamięci przeglądarki |
| słownik `I18N`: „projekt” → „schemat” (EN: project → diagram) | żeby nie mylić z projektami platformy |
| nowe teksty `saveErr`, `conflict.ask`, `conflict.copy` | w słowniku `I18N` edytora (PL i EN) |

## 4. API (`/api/wiring`)

| Metoda | Ścieżka | Dostęp | Opis |
|---|---|---|---|
| GET | `/parts?q=&src=all\|catalog\|own&page=&limit=` | publiczne | lekka lista: katalog (komponenty z pinoutem; pinout nie jest wczytywany, liczba pinów z SQL) + części własne zalogowanego |
| GET | `/parts/batch?ids=` , `/parts/{id}` | publiczne | pełne definicje; katalog w języku z nagłówka `X-ESN-Lang` (tłumaczenie nazwy/opisu i `fn`/`note` pinów) |
| PUT | `/parts/{id}` | zalogowani | część własna (limit 200 na osobę, 200 pinów; `cat-*` odrzucane) |
| GET | `/projects` | zalogowani (gość: `[]`) | schematy użytkownika (+ `parts`, `links`, `updated_at`, `project {id,title,slug}`) |
| GET | `/projects/{id}` | autor/admin; schemat w projekcie – publiczny | dokument + `rev`, `can_edit`, `project_id` |
| POST | `/projects` | zalogowani | nowy schemat; `project_id` = projekt platformy (tylko jego autor/admin, jeden schemat na projekt) |
| PUT | `/projects/{id}` | autor schematu/projektu, admin | zapis tylko przy zgodnym `rev`, inaczej **409** `{detail:{message, rev}}` |
| DELETE | `/projects/{id}` | jw. | usunięcie |
| GET | `/linkable-projects` | zalogowani | projekty bez schematu, do których można podpiąć (własne; admin – wszystkie) |
| PUT | `/projects/{id}/link` | edytujący schemat + autor projektu/admin | `{project_id}` podpina (dopisuje podzespoły), `{project_id: null}` odpina (schemat wraca do prywatnych) |
| GET | `/usage/component/{id}` | admin | ile schematów używa komponentu – ostrzeżenie przy usuwaniu z katalogu |
| GET | `/by-project/{project_id}` | publiczne | `{schema: {id, title, rev, can_edit, parts, links} \| null, can_create}` – do karty projektu |

Limity (`LIM` w `wiring_service.py`): 60 części, 400 połączeń, 20 punktów zaczepienia, 100 notatek (≤1000 znaków), żądanie ≤ 256 kB, 100 schematów na osobę,
300 zapisów na godzinę. Wszystkie odpowiedzi `/api/wiring` mają `Cache-Control: no-store` (bez tego przeglądarka mogła pokazać innemu użytkownikowi
odpowiedź „możesz edytować” zapamiętaną dla admina – zapis i tak blokował serwer, 403).

**Podzespoły projektu:** zapis schematu powiązanego z projektem dopisuje użyte części z katalogu do listy podzespołów projektu (`project_components`, limit 40).
Tylko dopisuje – nic nie usuwa, więc ręcznie dodane pozycje zostają. Lista w karcie odświeża się po zapisie. Walidacja odrzuca nieznane pola, złe typy i zakresy (lista pól jak w README edytora 10.2). Teksty użytkownika wstawia do DOM `esc()` edytora.

## 5. Decyzje (do zmiany, jeśli chcesz inaczej)

- **Gdzie leży schemat:** w osobnej tabeli `wiring_schemas`, a nie w kolumnie projektu (README edytora proponował `Project.wiring`).
  Powód: schemat może istnieć bez projektu (Narzędzia, szkice, schematy gości przeniesione na konto), a edytor ma własną listę „moich schematów”.
  Schemat podpięty do projektu ma ustawione `project_id` – wtedy pokazuje się w karcie tego projektu (jeden schemat na projekt).
  Dla użytkownika różnicy nie ma; dla nas: jedno API dla obu miejsc i brak „pustych” projektów tworzonych tylko po to, żeby mieć schemat.
  Usunięcie projektu zostawia schemat jako prywatny schemat autora.
- **Uprawnienia:** autor schematu, autor projektu, admin. Moderator nie ma osobnych uprawnień (jak w projektach).
- **Części własne** są per użytkownik. Schemat cudzej osoby z jej częścią własną otworzy się, bo `batch` szuka części najpierw u zalogowanego, potem u innych.
- **Tryb gościa:** schematy i części własne w localStorage (`esn-wiring-guest`). Po zalogowaniu przycisk „Przenieś schematy z tej przeglądarki na konto”.
- W interfejsie edytora „projekt” zmieniono na „schemat” (v39).
- **Usuwanie komponentu z katalogu** (10.4): dozwolone, ale okno potwierdzenia mówi, w ilu schematach jest użyty (węzły pokażą tam „Brak części”).

## 6. Checklista integracji (README edytora 10.x) – stan

| Punkt | Stan |
|---|---|
| 10.0 rzeczy z demo (karta `/komponenty`, `data.json`, `pinouts/*.json`, Google Fonts, `:root`, `/multi`) | usunięte / zastąpione (link ↗ prowadzi do `/#components/<id>`) |
| 10.1 `mount()`, CSS `.sch`, wysokość, `SCH_API`, link do karty, język | zrobione |
| 10.2 zapis, uprawnienia, walidacja serwerowa, **409**, brak definicji części z katalogu od klienta | zrobione |
| 10.3 walidacja napięć (pola `v`, `vmin/vmax`, `dir` w pinoucie) | do zrobienia razem z narzędziem pinoutów |
| 10.4 usunięcie komponentu / zmiana numeracji pinów | ostrzeżenie przy usuwaniu (v39); zmiana numeracji pinów: „Pin nie istnieje” w edytorze (wersjonowanie pinoutu – do decyzji) |
| 10.5 lista części bez kolumny pinout, liczba pinów w SQL, wyszukiwanie, limit 100 | zrobione (cache ETag – później) |
| 10.6 rozmiar żądania, limit zapisów, testy ręczne | zrobione (testy automatyczne + Playwright) |
| 10.7 podzespoły projektu ze schematu | zrobione (v39, tylko dopisywanie) |
| 10.7 moderacja, `generated_with_ai`, powiązanie z magazynem, PDF z serwera; etap 8 (link tylko do odczytu) | do zrobienia (pole `generated_with_ai` jest już przepuszczane przez walidację) |

## 7. Wdrożenie

Tabele powstają przy starcie (`create_all`), więc wystarczy `git pull` i restart portalu (`docker compose restart web`). Magazyn bez zmian.
Kopia bazy przed wdrożeniem (`pg_dump`) jak przy każdej zmianie schematu bazy.
