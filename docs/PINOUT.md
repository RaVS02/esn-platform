# Pinout i opis wyglądu podzespołów

Każdy komponent w **Globalnym Katalogu Sprzętowym** może mieć interaktywny opis wyprowadzeń: rysunek obudowy lub płytki,
tabelę pinów, filtry kategorii, grupy złączy (Qwiic, I²C, I²S, USB…), uwagi weryfikacyjne i źródła.
Widać go w pełnej karcie komponentu, w sekcji **„Pinout i opis wyprowadzeń”**.

**Najszybszy start:** otwórz `/static/pinout-demo.html` (lub plik `app/static/pinout-demo.html` dwuklikiem).
Jest tam galeria wszystkich układów rysunku i **edytor na żywo** – piszesz po lewej, po prawej od razu widzisz efekt,
a gotowy tekst kopiujesz do pola *Pinout* w edycji komponentu.

---

## 1. Wdrożenie na już działającym serwerze (bez utraty danych)

Zmiana jest addytywna: dodaje jedną nullable kolumnę `pinout` i nic nie usuwa ani nie zmienia w istniejących wpisach.

1. **Kopia zapasowa** (zawsze przed zmianą schematu), na serwerze w katalogu projektu:
   `docker compose exec db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup_$(date +%F).sql`
2. Podmień pliki z paczki (albo `git apply pinout.patch`). Usługa `web` ma wolumen `./app:/app` i startuje z `--reload`,
   więc **nie trzeba przebudowywać obrazu** – zmiana `main.py` sama przeładuje aplikację
   (w razie wątpliwości: `docker compose restart web`).
3. Przy starcie wykona się `ALTER TABLE official_components ADD COLUMN IF NOT EXISTS pinout JSON` –
   bezpieczne przy każdym kolejnym starcie, istniejące dane zostają nietknięte.
4. Odśwież stronę z pominięciem cache (Ctrl+F5). Assety mają `?v=2`, ale przeglądarka mogła zachować stary `index.html`.
5. *(opcjonalnie)* Wczytaj gotowe przykłady z repo: `docker compose exec web python seed_pinouts.py`.
   Skrypt **nie nadpisuje** komponentów, które już mają pinout (flaga `--force` wymusza nadpisanie),
   a w istniejących komponentach uzupełnia tylko puste pola. Komponent o nazwie `ADS1293` zostanie dodany, jeśli go nie ma.

Komponenty, które już masz w bazie, dostają pinout **dopiero gdy go dodasz** – do tego czasu karta pokazuje
„Ten podzespół nie ma jeszcze opisu wyprowadzeń” (admin widzi przycisk „+ Dodaj pinout”).

## 2. Trzy sposoby dodawania pinoutu

| Sposób | Kiedy |
|---|---|
| **Panel admina** – Katalog → Edytuj → pole *Pinout* | pojedyncze komponenty; format tekstowy lub wklejony JSON |
| **Plik `app/pinouts/<nazwa>.json` + `seed_pinouts.py`** | wiele komponentów naraz, wersjonowane w Git, ponowne użycie między środowiskami |
| **API** `PUT /api/catalog/{id}` z polem `pinout` (admin) | automatyzacja, import z innych narzędzi |

Pole puste = brak pinoutu. Dane są walidowane po stronie serwera (`clean_pinout`): ograniczone długości, tylko znane
kategorie i układy, adresy źródeł tylko `http(s)://`. Treść wyświetlana jest przez `textContent`, więc nie da się
wstrzyknąć HTML-a.

## 3. Format tekstowy

```
package: WQFN-28                 # obudowa / nazwa wariantu
view: widok z góry               # opis widoku
layout: quad                     # patrz rozdział 4
source: Datasheet (TI) | https://www.ti.com/lit/ds/symlink/ads1293.pdf
notes: Co NIE zostało zweryfikowane (zobacz rozdział 8)
group: Magistrala SPI | SCLK, SDI, SDO, CSB | uwaga opcjonalna

# nr | nazwa | kategoria | typ | funkcja | uwagi
1 | IN1 | analog | Wejście analogowe | Wejście elektrody 1 | dłuższa uwaga
```

- Linie zaczynające się od `#` i puste są ignorowane. Separator pól to `|` (w treści zastępowany przez `/`).
- Tylko **nr** i **nazwa** są wymagane w linii pinu. Pozostałe pola mogą być puste.
- Pin o numerze `DAP`, `EP`, `PAD`, `TAB` albo z `"pad": true` (JSON) jest rysowany jako pad pod obudową (quad/dual/sip).
- Można wkleić także pełny JSON (zaczyna się od `{`) – patrz rozdział 9.

**Kategorie** (kolor i filtr): `power` zasilanie · `ground` masa · `analog` · `digital` I/O · `spi` · `i2c` · `i2s` · `uart` ·
`usb` · `can` · `pwm` · `debug` · `rf` · `clock` · `control` (sterujące/status) · `nc` (brak połączenia/pad) · `other`.
Nieznana kategoria jest zamieniana na `other`.

## 4. Układy rysunku (`layout`)

| layout | Do czego | Kolejność pinów w danych |
|---|---|---|
| `quad` | QFN, QFP, LQFP (liczba pinów podzielna przez 4) | lewy bok od góry → dół → prawy bok od dołu → góra (przeciwnie do ruchu wskazówek od lewego górnego rogu) |
| `dual` | DIP, SOIC, TSSOP (parzysta liczba) | lewa strona od góry, potem prawa od dołu; wycięcie u góry |
| `sip` | złącza, proste moduły, czujniki 3–10 pinów | od góry do dołu |
| `to92` | tranzystory i regulatory w TO-92 (2–5 pinów) | od lewej do prawej, **widok od strony płaskiej, nóżkami w dół** |
| `to220` | TO-220 (2–5 pinów) | od lewej do prawej, widok od przodu |
| `sot23` | SOT-23-3/5/6/8 | pierwsza połowa na dole od lewej, reszta u góry od prawej; kropka = pin 1 |
| `axial` | dioda, rezystor, kondensator (dokładnie 2 piny) | 1 = lewa strona, **pasek rysowany jest po stronie pinu 1** → w diodzie ustaw pin 1 = katoda (K) |
| `board` | płytki i moduły z rysunkiem lub zdjęciem | dowolna; położenie z `@x,y` |
| `none` | tylko tabela | – |

Gdy `layout` nie pasuje do liczby pinów (np. `quad` dla 7 pinów) widok pokaże ostrzeżenie i samą tabelę.
Gdy `layout` pominiesz, zostanie zgadnięty z nazwy obudowy (`package`) – lepiej wpisać go jawnie.

> **Uwaga o zgodności z rzeczywistością.** Kolejność pinów musisz przepisać z **rysunku w datasheecie dla konkretnego
> modelu i obudowy** (np. TO-92 ma różne kolejności E/B/C zależnie od typu). Przykłady w demo są poglądowe.

## 5. Płytki i moduły (`layout: board`)

Dla modułów (ESP32, czujniki na PCB, płytki własne) rysujesz **uproszczony wygląd** i zaznaczasz miejsca numerowanymi punktami.
Współrzędne to **procenty** szerokości (x) i wysokości (y) rysunku, lewy górny róg = `0,0`.

```
layout: board
aspect: 1.6                      # proporcje szerokość/wysokość (domyślnie 1.6)
labels: tak                      # podpisy nazw obok punktów (domyślnie: tak bez zdjęcia, nie ze zdjęciem)
shape: rect | 0,36,9,28 | USB-C | conn      # x,y,szer,wys (w %)
shape: circle | 20,30,2.6 | BOOT | btn      # x,y,promień (promień w % szerokości)
shape: text | 50,95 | napis                 # sam podpis
# punkty:  nr @x,y | nazwa | kategoria | typ | funkcja | uwagi
3 @34,7 | SDA | i2c | I/O | Dane I²C |
```

Rodzaje kształtów (`kind`): `pcb`, `chip`, `conn` (złącze), `btn` (przycisk), `led`, `part` (domyślny).
Numer w punkcie jest ucinany do 3 znaków – używaj krótkich numerów/oznaczeń (`1`, `Q3`, `U2`).

**Zdjęcie zamiast kształtów:** wgraj zdjęcie jako *Obrazek główny* komponentu, ustaw `layout: board` i dopisz
`image_as_background: tak`. Zdjęcie staje się wtedy tłem, a punkty `@x,y` leżą na nim (kształty `shape:` są pomijane).
Ustaw `aspect` zgodnie z proporcjami zdjęcia. **Domyślnie (`nie` lub brak linii) zdjęcie główne NIE jest używane** –
rysowane są kształty. Dzięki temu obrazek główny karty może być czymkolwiek, a pinout i tak wygląda tak, jak go opisałeś.
W edytorze demo zdjęcie wczytasz przyciskiem „Zdjęcie płytki…” (to samo ustawia `image_as_background: tak`).

**Jak znaleźć współrzędne:** w edytorze (`pinout-demo.html` → *Edytor na żywo*) włącz „klik na rysunku = nowy punkt” i klikaj
na płytce – każdy klik dopisuje linię `N @x,y | PINN | other` do tekstu. Zmień nazwę i kategorię i gotowe.

## 6. Złącza i magistrale (Qwiic, I²C, I²S, USB…)

Nie ma osobnego „typu złącza” – używasz **kategorii pinów** i **grup**:

```
group: Qwiic / STEMMA QT (JST-SH, 4-pin) | Q1, Q2, Q3, Q4 | GND, 3V3, SDA, SCL
group: Magistrala I²S | BCLK, LRCLK, DIN | Wyjście audio
group: USB-C | U1, U2, U3 | VBUS, D+, D−
```

Odwołania w grupie to **numer albo nazwa pinu** (bez rozróżniania wielkości liter). Nazwa pasuje do wszystkich pinów o tej nazwie –
`SDA, SCL` podświetli więc magistralę zarówno na listwie, jak i na złączu Qwiic. Gdy chcesz jeden konkretny pin, użyj numeru.
Grupy pojawiają się pod tabelą jako klikalne kafelki; kliknięcie podświetla piny na rysunku i w tabeli.

Gdy podzespół ma fizycznie kilka złączy (np. płytka z listwami + Qwiic + USB-C), nadaj pinom złącza własne numery (`Q1…Q4`, `U1…U3`)
i zrób dla nich osobną grupę.

## 7. Praca z dużą liczbą komponentów

- Zacznij od **przykładu z demo** najbliższego Twojemu podzespołowi, zmień dane i wklej do panelu.
- Dla powtarzalnych rodzin (np. wiele wariantów jednego modułu) trzymaj JSON-y w `app/pinouts/` i wczytuj `seed_pinouts.py`.
- Struktura pliku JSON do seeda: `{ "name", "symbol", "inventory_category", "applications", "tags", "technical_specs", "description", "datasheet_url", "pinout": {…} }`
  (wzór: `app/pinouts/ads1293.json`).

## 8. Weryfikacja i źródła – dobre praktyki

- **`source:`** – link do oficjalnego datasheetu / strony producenta (można kilka linii).
- **`notes:`** – wyświetlane jako żółty blok **„Ograniczenia weryfikacji”**. Wpisz tam wprost, czego nie sprawdziłeś:
  np. „położenie pinów na bokach to konwencja QFN, nie odczyt z rysunku Top View” albo „nie zweryfikowano wartości bezwzględnych”.
- Pola `note` pojedynczych pinów służą do uwag technicznych (napięcia, wymagania zewnętrznych elementów), nie do przypuszczeń.
- Przed zamówieniem PCB porównaj pinout z rysunkiem obudowy w datasheecie – widok na platformie jest pomocą, nie dokumentem źródłowym.

## 9. Format JSON

```jsonc
{
  "package": "WQFN-28", "view": "widok z góry",
  "layout": "quad",                       // quad|dual|sip|to92|to220|sot23|axial|board|none
  "pins": [ { "n": "1", "name": "IN1", "cat": "analog", "type": "…", "fn": "…", "note": "…",
              "pad": false,               // opcjonalnie: pad pod obudową
              "x": 34, "y": 7 } ],        // tylko board: położenie w %
  "image_as_background": false,           // tylko board: czy użyć zdjęcia głównego komponentu jako tła
  "board":  { "aspect": 1.6, "labels": true },
  "shapes": [ { "t": "rect", "x": 0, "y": 36, "w": 9, "h": 28, "label": "USB-C", "kind": "conn" } ],
  "groups": [ { "name": "Qwiic", "pins": ["Q1","Q2","Q3","Q4"], "note": "…" } ],
  "sources": [ { "label": "Datasheet", "url": "https://…" } ],
  "notes": "Ograniczenia weryfikacji…"
}
```

Limity: do 400 pinów, 120 kształtów, 30 grup, 10 źródeł na komponent. Pełny pinout jest zwracany tylko przez
`GET /api/catalog/{id}`; lista `GET /api/catalog` zawiera jedynie `pinout_summary` (obudowa i liczba pinów), żeby nie rosła.

## 10. Generowanie opisu przez asystenta AI

Opis można wygenerować w czacie i wkleić do pola *Pinout*. Wklej asystentowi poniższy prompt razem z tabelą pinów z datasheetu
(albo załącznikiem PDF) oraz dwoma fragmentami tego README: rozdziałem **3. Format tekstowy** i **4. Układy rysunku**.

````text
Przygotuj opis wyprowadzeń podzespołu dla platformy ESN w formacie tekstowym opisanym poniżej.

Podzespół: <nazwa, producent, dokładny wariant obudowy>
Źródło: <wklejona tabela pinów z datasheetu / załączony PDF>

Zasady:
- Korzystaj WYŁĄCZNIE z podanego źródła. Czego w nim nie ma, zostaw puste i wypisz w nagłówku `notes:` – nie zgaduj.
- Dobierz `layout` do obudowy (quad, dual, sip, to92, to220, sot23, axial) i zachowaj kolejność pinów
  wymaganą dla tego układu. Dla każdego pinu podaj kategorię z listy: power, ground, analog, digital, spi, i2c, i2s,
  uart, usb, can, pwm, debug, rf, clock, control, nc, other.
- Dodaj `source:` z nazwą dokumentu i adresem URL.
- W `notes:` zaznacz wszystko, czego nie dało się zweryfikować (np. widok obudowy, wartości graniczne).
- Zwróć wyłącznie jeden blok kodu z gotowym tekstem, bez komentarza.

<tu wklej rozdziały 3 i 4 z docs/PINOUT.md>
````

Ważne:
- **Zawsze porównaj wynik z rysunkiem obudowy w datasheecie** – asystent może pomylić kolejność pinów albo widok (z góry / z dołu).
- Dla `layout: board` asystent nie ustali współrzędnych punktów na zdjęciu. Wygeneruj opis pinów, a współrzędne dodaj klikając
  w edytorze (rozdział 5).
- Wynik wklejony do edytora w `pinout-demo.html` od razu pokaże błędy składni, zanim trafi do bazy.

## 11. Co dalej: model 3D z punktami (plan, jeszcze nie zaimplementowane)

Obecny układ `board` to 2D. Widok w stylu esp-labs („Poznaj płytkę”: obracany model z numerowanymi punktami i kartami po bokach)
da się dołożyć jako osobny `layout: "model3d"` na tych samych danych (`pins`, `groups`, kategorie, tabela), z dodatkowymi:
`"model": { "glb": "/static/models/xyz.glb" }` i pozycjami 3D punktów. Potrzebne będą:

1. **Modele `.glb`** – najtrudniejszy element. Dla własnych płytek eksport z KiCad (3D viewer → *Export GLB/STEP*), dla gotowych modułów
   ewentualnie modele producenta; trzeba je zoptymalizować (rozmiar, tekstury).
2. Biblioteka renderująca (np. `<model-viewer>` albo three.js) z **self-hostem** skryptu – platforma nie powinna zależeć od CDN.
3. Edytor punktów 3D (klik w model → pozycja `x y z`) – analogiczny do klikania po płytce 2D.

Dlatego warto już teraz opisywać komponenty w `board`: dane pinów, grupy i kategorie przejdą do 3D bez zmian.
