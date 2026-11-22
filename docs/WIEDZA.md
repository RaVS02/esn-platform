# Wiedza: niezbędniki, poradniki, artykuły i kursy

Zakładka **Wiedza** zastępuje dawną zakładkę „Teoria & Wykłady”. Dotychczasowy „Niezbędnik Systemów Wbudowanych”
został zachowany jako **archiwum** (`#theory`, przycisk „Archiwum” na stronie Wiedzy) i jest przenoszony do nowego
systemu stopniowo, blok po bloku.

## Typy treści i poziomy

| Typ (`kind`) | Do czego | Przykład |
|---|---|---|
| `essential` – **Niezbędnik** | krótka ściąga, jeden ekran | typy pinów i poziomy logiczne |
| `guide` – **Poradnik** | praktyczny krok po kroku | „jak podłączyć czujnik do ESP32” |
| `article` – **Artykuł** | wyjaśnienie zjawiska lub mechanizmu | przetworniki ADC |
| `lesson` – **Lekcja kursu** | element uporządkowanej serii | „Komunikacja szeregowa”, lekcja 2 |

Każda treść ma **poziom**: `basic` (Podstawy) → `intermediate` (Średni) → `advanced` (Zaawansowany). Lista pokazuje treści
pogrupowane od podstaw do zaawansowanych, a lekcje kursu są uporządkowane polem **Pozycja**. Kursy mają własny poziom,
opis i flagę „opublikowany”. Lekcje nie pokazują się na ogólnej liście (tylko w kursie i w wyszukiwarce).

„Kompendium” to widok zbiorczy (wszystko, po poziomach i tagach), a nie osobny typ.

## Role i przepływ zatwierdzania

| Rola | Uprawnienia |
|---|---|
| `admin` | wszystko: edycja, zatwierdzanie, odrzucanie z komentarzem, publikacja bezpośrednia, wycofanie, usuwanie, kursy |
| `moderator` (**redaktor**) | tworzy i edytuje **własne** treści, wysyła do przeglądu, usuwa własne nieopublikowane. Nie publikuje |
| pozostali | czytają wyłącznie opublikowane treści |

Rolę nadaje admin: `PUT /api/users/{id}/role` z `{"role": "moderator"}` (istniejący endpoint).

```
szkic ──(wyślij do przeglądu)──► do przeglądu ──(zatwierdź)──► opublikowane
                                      │
                                      └─(odrzuć + powód)──► odrzucone ──(popraw i wyślij ponownie)──► do przeglądu
```

- Dla **nieopublikowanej** treści zapis zmienia wprost jej roboczą wersję.
- Dla **opublikowanej** treści zmiany trafiają do osobnego szkicu (`draft`). Czytelnicy widzą starą wersję, dopóki admin
  nie zatwierdzi nowej. Zmiany można porzucić („Porzuć zmiany”).
- Podczas „Do przeglądu” redaktor nie edytuje (zablokowane); admin może wprowadzić drobną poprawkę bez zmiany statusu.
- Każda zmiana statusu trafia do historii (`knowledge_reviews`: kto, co, kiedy, komentarz).
- Wysłanie do przeglądu wymaga niepustej treści i istniejących widgetów, do których treść się odwołuje.

Panel redakcji: `#knowledge/redakcja` (lista własnych treści, „Do zatwierdzenia” i „Kursy” tylko dla admina).

## Składnia treści: markdown z blokami

Treść to zwykły markdown (nagłówki, listy, tabele, `**pogrubienie**`, `kod`, linki, obrazy) plus **bloki** w stylu
dotychczasowego niezbędnika. Blok zaczyna się linią `:::nazwa Opcjonalny tytuł`, a kończy linią `:::`.
Bloki **nie zagnieżdżają się**.

| Blok | Efekt |
|---|---|
| `:::summary [tytuł]` | ramka „Szybkie podsumowanie” (zwykle lista) |
| `:::card Tytuł` | karta z nagłówkiem |
| `:::note` / `:::info` / `:::warn` / `:::danger` (`critical`) / `:::ok` (`tip`) | ramki z lewym paskiem |
| `:::kv` | tabela klucz–wartość, wiersze `Klucz \| Wartość` (można użyć `<span class="badge …">`) |
| `:::stats` | kafelki metryk, wiersze `Etykieta \| wartość \| podpis \| kolor` (kolor: `accent`, `green`, `orange`) |
| `:::pros` / `:::cons` | plusy i minusy; kolejne bloki tworzą parę obok siebie |
| `:::figure Podpis` | rysunek SVG wklejony wprost (patrz niżej) |
| `:::widget nazwa [wysokość]` | interaktywna animacja z JavaScriptem (patrz niżej) |

Kod: fence z językiem i opcjonalnym tytułem, np. ```` ```cpp Wysyłanie ramki ````. Kolorowanie jak w VS Code
(highlight.js), przycisk „Kopiuj”. Obsługiwane: `arduino`, `cpp`, `c`, `python`, `bash`, `yaml`, `json`, `ini`, `rust`,
`js`, `html`, `md`.

W edytorze są przyciski wstawiające szablony bloków oraz **podgląd na żywo**.

### Rysunki (`:::figure`)
Wklejasz kod SVG. Treść przechodzi przez DOMPurify. **Nie działają**: `<style>`, `<script>`, `<use>`, `<image>`, `<a>`,
`<foreignObject>`, animacje SMIL, własne `position`/`z-index`. Działają kształty, tekst, gradienty, markery, filtry
i atrybuty `fill="var(--accent)"` (zmienne kolorów strony). Identyfikatory są automatycznie prefiksowane, więc dwa rysunki
z tym samym `id` nie kolidują. Jeśli potrzebujesz animacji CSS lub interakcji, użyj widgetu.

### Widgety (`:::widget`)
Widget to kompletny fragment HTML + CSS + JS zapisany przy treści (do 8 widgetów, do 60 KB każdy, 200 KB razem).
Edytujesz go w sekcji „Widgety” pod treścią i wstawiasz blokiem `:::widget nazwa 320` (liczba to początkowa wysokość w px;
wysokość dopasowuje się sama do zawartości).

Widget działa w **izolowanej ramce** `<iframe sandbox="allow-scripts" srcdoc=…>` z polityką CSP:
- brak dostępu do strony, `localStorage`, ciasteczek i tokenu (inna, „nieprzezroczysta” domena),
- brak sieci (`connect-src 'none'`, obrazy tylko `data:`), brak formularzy, okien i nawigacji strony,
- zasoby (czcionki, biblioteki) trzeba zawrzeć w kodzie.

Widget ma ciemne tło strony wewnątrz ramki; kolory podaj wprost (np. `#0e1117`, `#56e1fd`). Przykład: widget ADC w artykule
„ADC — przetworniki analogowo-cyfrowe i rozdzielczość”.

### Nowe bloki (v8)
Wszystkie w stylu platformy, działają razem z pozostałymi (bez zagnieżdżania). Przykłady na żywo: zakładka „Instrukcja”.
- `:::neutral Tytuł` (alias `gray`) – szara ramka, neutralna obok note/warn/danger/ok.
- `:::steps` – kroki, wiersz `Tytuł | opis`. `:::timeline` – oś czasu, wiersz `Data | Tytuł | opis`.
- `:::progress` – paski, wiersz `Etykieta | 0–100 | opis | kolor` (green, orange, red, accent).
- `:::def` – definicje `Termin | opis`. `:::checklist` – `- [x] gotowe` / `- [ ] do zrobienia` (tylko do odczytu).
- `:::details Tytuł` – zwijana sekcja. `:::tabs` – zakładki, każda sekcja zaczyna się linią `=== Tytuł` (max 8).
- Diagramy rysowane przez platformę (bez bibliotek zewnętrznych, kolory z motywu):
  `:::flow` (algorytm: `(id) start/koniec`, `[id] krok`, `{id} decyzja`, `a -> b : etykieta`, strzałka wstecz tworzy pętlę),
  `:::er` (baza: `tabela: kolumna PK, kolumna FK`, `a 1--* b : etykieta`),
  `:::sequence` (pierwsza linia uczestnicy po przecinku, potem `A -> B : treść`, `-->` linia przerywana).
  Limity: 40 węzłów/komunikatów, 16 tabel; błąd składni pokazuje komunikat zamiast diagramu.
  Kod: `app/static/knowledge-blocks.js` (bloki powstają przez DOM/SVG API, tekst zawsze przez `textContent`).
- Alternatywy dla diagramów: obraz wgrany w sekcji „Obrazy”, własny `:::figure` (SVG) albo widget. Mermaid nie jest użyty
  (duża biblioteka zewnętrzna); można dodać później jako opcję lokalną.

### Obrazy
W edytorze (po pierwszym zapisie treści) sekcja **Obrazy**: wybierz plik JPEG/PNG/WebP/GIF, opcjonalnie wpisz podpis, kliknij
„Wgraj obraz”, potem „Wstaw” (wstawia `![podpis](/static/media/…)`). Obraz sam w akapicie wyświetla się jako rysunek z podpisem.
Obrazy korzystają z systemu mediów (`owner_type=article`): te same zasady (rozpoznanie typu po zawartości, czyszczenie EXIF,
limity miejsca i wgrań na godzinę), limit `MEDIA_MAX_PER_ARTICLE` (domyślnie 30). Wgrywać może admin i redaktor-autor treści.
Przy usunięciu treści kasowane są też jej obrazy. W treści działają **tylko** obrazy z `/static/media/…`; link do obrazu na cudzym
serwerze jest zastępowany komunikatem (brak śledzenia czytelników).

### Szablony widgetów
Plik `app/static/knowledge-templates.js` zawiera gotowe widgety (pusty, dzielnik napięcia, animacja ramki UART, quiz, zakładki
kodu, wypełnienie PWM). W edytorze wybierasz szablon, wpisujesz nazwę i klikasz „+ Dodaj widget” – blok `:::widget` wstawia się
sam. Nowy szablon dodajesz jako kolejny wpis w tablicy (id, name, desc, height, code).

### Instrukcja w panelu redakcji
Zakładka „Instrukcja” (`#knowledge/redakcja/instrukcja`, dostępna dla redaktorów i admina) zawiera opis przepływu pracy,
działające na żywo przykłady każdego bloku, zasady obrazów, SVG i widgetów (z podglądem wszystkich szablonów), przykładowy
prompt do poproszenia Claude o nowy widget, listę kontrolną i FAQ. Treść jest w `app/static/knowledge-guide.js`.

## Limity

Tytuł 150 znaków, opis 400, treść 200 KB, 8 tagów po 30 znaków. Walidacja jest po stronie serwera.

## API

Publiczne: `GET /api/knowledge/items?kind=&level=&q=`, `/api/knowledge/items/{slug}`, `/api/knowledge/courses`,
`/api/knowledge/courses/{slug}`, `/api/knowledge/meta`.
Redakcyjne (`/api/knowledge/editor/…`, wymagają tokenu admina lub moderatora): `items` (GET/POST), `items/{id}`
(GET/PUT/DELETE), `items/{id}/submit|approve|reject|publish|unpublish|discard`, `queue`, `courses` (GET dla redaktorów,
POST/PUT/DELETE tylko admin).

## Przykładowe treści (pilotaż)

Przy pierwszym uruchomieniu, gdy baza wiedzy jest pusta, dodawane są 3 próbki z dotychczasowego niezbędnika
(niezbędnik, artykuł z widgetem i kurs z 3 lekcjami) – `app/knowledge_pilot.py`. Wyłączenie: `KNOWLEDGE_SEED=0` w `.env`.
Próbki możesz po prostu usunąć w panelu admina. Uwagi merytoryczne: [WIEDZA-PILOTAZ.md](WIEDZA-PILOTAZ.md).

**Aktualizacja próbek na istniejącej bazie (v7):** przy starcie próbki w wersji z v6 są podmieniane na poprawione, ale
**tylko** te, które nie były edytowane (porównanie skrótu treści ze starą wersją, brak autora i brak wersji oczekującej).
Edytowane ręcznie zostają nietknięte (log: „zaktualizowano N, pominięto M”). `KNOWLEDGE_SEED=0` wyłącza także to.

## Archiwum (tylko admin)
Dotychczasowy Niezbędnik v1 nie jest już częścią publicznej strony. Leży w `app/archive/niezbednik.html` i jest pobierany
przez `GET /api/archiwum`, który wymaga zalogowanego **administratora** (moderator, użytkownik i gość dostają 403/401).
Przycisk „Archiwum (admin)” jest na stronie głównej Wiedzy i widoczny tylko dla admina; wejście przez `#theory` bez uprawnień
przekierowuje do Wiedzy. Gdy wszystko zostanie przeniesione, usuń plik, endpoint w `main.py` i widok `view-theory`.

## Partie treści z archiwum
Przenoszone sekcje trafiają do bazy **jako propozycje „Do przeglądu”** (nieopublikowane): admin widzi je w „Do zatwierdzenia”,
czyta, poprawia i zatwierdza albo odrzuca/usuwa. Każda partia importuje się tylko raz (tabela `knowledge_imports`), więc
usunięta propozycja nie wraca. Partie są zdefiniowane w `knowledge_service.BATCHES`; pierwsza: `v8-podstawy-sprzetu`
(kurs „Podstawy sprzętu”: MCU a CPU, częstotliwość taktowania, zasilanie i wspólna masa). `KNOWLEDGE_SEED=0` wyłącza import.

## Migracja treści z archiwum

1. Wybierz sekcję w archiwum i zdecyduj o typie, poziomie i (dla lekcji) kursie.
2. Przepisz ją w panelu redakcji: ramki → bloki, diagramy SVG → `:::figure` (kod można skopiować wprost z `index.html`),
   kod → fence z językiem.
3. Przejrzyj merytorycznie (uwagi w WIEDZA-PILOTAZ.md pokazują typowe miejsca do sprawdzenia), wyślij do przeglądu.

## Testy

`app/tests/test_knowledge.py` (uprawnienia, przepływ zatwierdzania, walidacja, kursy, obrazy w treściach, aktualizacja próbek). Uruchomienie z katalogu `app/`
przy działającej bazie PostgreSQL: `python -m pytest tests/test_knowledge.py -q`.

## Zapowiedziane (jeszcze nieużywane)

Postęp w kursach i punkty doświadczenia, komentarze, ścieżki tematyczne jako osobne kolekcje. Interfejs pokazuje przy
nich etykietę „wkrótce”. Pełny plan: [PLAN.md](PLAN.md).
