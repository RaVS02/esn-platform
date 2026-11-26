# Zasady bezpieczeństwa przy rozwijaniu platformy

Krótka lista reguł, które łatwo złamać przy dopisywaniu nowych funkcji. Powstała po audycie, w którym znaleziono
m.in. stored XSS (skrypt wpisany w tytule projektu wykonywał się u administratora i mógł ukraść token JWT).

## 1. Dane użytkowników w szablonach (`index.html`)
Wszystko, co pochodzi z bazy lub od użytkownika, **musi** przejść przez pomocnika, zanim trafi do `innerHTML`:

| Gdzie trafia wartość | Użyj |
|---|---|
| tekst lub atrybut HTML (`<h3>${…}</h3>`, `alt="${…}"`) | `esc(wartość)` |
| wnętrze `onclick="f('${…}')"` | `escJs(wartość)` |
| `href` / adres z danych (github, datasheet) | `safeUrl(wartość)` (przepuszcza tylko `http(s)://` i ścieżki względne) |
| markdown od użytkownika | `renderMarkdownSafe(tekst)` (marked + DOMPurify) |
| komunikaty w `toast()` | nic (toast wstawia tekst przez `textContent`) |

Nowy kod, który tworzy elementy przez DOM (`textContent`, `createElement`) jest bezpieczny z założenia
(tak działają `pinout.js`, `media.js` i `content.js`). Nie doklejaj danych do `innerHTML` bez `esc()`.

## 2. Wgrywanie plików
Wszystko przez `media_service.py` (patrz `docs/MEDIA.md`): typ po zawartości, nazwy nadaje serwer, limity,
kasowanie tylko w katalogach uploadów. Nie dopisuj nowych endpointów, które zapisują pliki „po swojemu”
i nie przyjmuj od klienta ścieżek plików.

### Pliki do pobrania (zasoby)
Hostujemy tylko pliki z licencją i oświadczeniem o prawach, w ograniczonej whiteliście typów (patrz `docs/TRESCI.md`).
Zawartość jest sprawdzana po bajtach, a ZIP-y są przeglądane (programy, HTML/JS/SVG, ścieżki `..` i szyfrowanie są odrzucane).
Linki zewnętrzne przechodzą walidację `http(s)://` i dostają `rel="noopener noreferrer nofollow ugc"`.

## 3. Biblioteki zewnętrzne
`marked` i `DOMPurify` leżą lokalnie w `app/static/vendor/` (z licencjami), żeby strona nie ładowała kodu z cudzego CDN
bez przypiętej wersji. Aktualizacja: `npm install marked dompurify`, skopiuj `lib/marked.umd.js` i `dist/purify.min.js`,
zmień numer w `?v=` w `index.html`. Tak samo `highlight.js` (kolorowanie kodu): `npm install @highlightjs/cdn-assets`,
skopiuj `highlight.min.js`, `languages/arduino.min.js` i `styles/vs2015.min.css`. Z zewnątrz nadal ładują się czcionki Google i Font Awesome (cdnjs).

## 4. Treści Wiedzy (markdown z blokami, SVG, widgety)
Treści tworzą wyłącznie admin i redaktorzy, a publikuje admin. Mimo to renderer traktuje je jak niezaufane (redaktor
może się pomylić, a konto może zostać przejęte):
- markdown → `marked` → DOMPurify, z zakazem `<form>`, `<input>`, `<button>`, `<style>`, `<iframe>`, `<svg>` i innych;
  atrybuty `id` są usuwane (brak kolizji z identyfikatorami aplikacji), style ograniczone do allowlisty (bez `position`,
  `z-index`, `url()`), linki tylko `http(s)`, `mailto`, `#` i ścieżki względne,
- `:::figure` (SVG): DOMPurify bez `<style>`, `<script>`, `<use>`, `<image>`, `<a>`, `<foreignObject>`; `id` dostają
  unikalny prefiks,
- `:::widget` (HTML + JS): wyłącznie w `<iframe sandbox="allow-scripts" srcdoc>` z CSP w dokumencie
  (`default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'`).
  Bez `allow-same-origin` ramka ma inną domenę: nie czyta `localStorage`, ciasteczek ani tokenu, nie wywoła API w imieniu
  użytkownika, nie nawiguje strony i nie otwiera okien. Wysokość przekazuje przez `postMessage`, a rodzic przyjmuje tylko
  wiadomość od własnej ramki i ogranicza ją do 80–1200 px,
- obrazy w treści: w renderze dozwolone tylko `src` zaczynające się od `/static/media/` (reszta jest zastępowana komunikatem –
  brak zewnętrznych pikseli śledzących); wgrywanie przez system mediów (typ po magic bytes, czyszczenie EXIF, limity), prawo
  wgrywania mają admin oraz redaktor-autor danej treści, pliki znikają razem z treścią,
- nowe bloki i diagramy (v8) budowane są przez DOM/SVG API z `textContent`; tekst pochodzący od autora nigdy nie trafia do
  `innerHTML` poza markdownem (DOMPurify); liczba elementów diagramów jest ograniczona,
- opis projektu pisany przez użytkowników (v10): tylko markdown i bezpieczne bloki, renderowane w trybie `safe` (bez SVG i widgetów),
  przez DOMPurify; obrazy tylko z `/static/media/`; limit 100 tys. znaków sprawdzany na serwerze,
- archiwum (Niezbędnik v1) jest poza publicznym HTML i serwowane tylko adminowi (`/api/archiwum`, zaufany plik serwera),
- bloki kodu nigdy nie przechodzą przez `innerHTML` poza wynikiem `highlight.js` (który escapuje),
- serwer waliduje typ, poziom, długości, liczbę i nazwy widgetów, a role sprawdza przy każdym wywołaniu.
Nie wolno poluzowywać flag `sandbox` ani dodawać `allow-same-origin` do widgetów.

## 5. Co nie jest objęte
- **Magazyn** (`esn_magazyn`, Flask/Jinja) nie był audytowany pod kątem XSS i uploadów.
- Brak nagłówka CSP dla stron HTML (szablon używa atrybutów `onclick`, więc ścisła polityka go złamie). Dopiero po
  przepisaniu obsługi zdarzeń na `addEventListener` można ją włączyć.
- Token JWT jest w `localStorage` (dlatego XSS jest groźny). Bezpieczniejsze jest `HttpOnly` cookie, ale to zmiana
  architektury logowania.
- Porty `5432` i `8000` w `docker-compose.yaml` są publikowane na hoście. Za tunelem Cloudflare z autoryzacją nie są
  widoczne z internetu, ale są dostępne w sieci lokalnej. Można je zawęzić do `127.0.0.1:5432:5432`, jeśli nic
  zewnętrznego z nich nie korzysta.


## Sekrety wyłącznie w `.env` (v35)

- Hasła, klucze API i dane SMTP są czytane ze zmiennych środowiskowych (`.env`, plik w `.gitignore`). W kodzie, dokumentacji i na czacie nie wpisujemy prawdziwych wartości.
- Szablon wszystkich zmiennych: `.env.example` (do skopiowania jako `.env`). Poczta: `MAIL_USERNAME`, `MAIL_PASSWORD` (hasło aplikacji Google), opcjonalnie `MAIL_SERVER`, `MAIL_PORT`, `MAIL_FROM` (zamienniki: `SMTP_*`). Bez nich `MailBot` nie wysyła wiadomości (zapis w logu), a aplikacja działa dalej.
- Brak `JWT_SECRET_KEY` powoduje głośne ostrzeżenie w logu (klucz domyślny pozwala podrobić token) – na serwerze zawsze ustaw losowy klucz.
- Test `tests/test_secrets.py` blokuje wpisanie stałych haseł/kluczy w plikach `*.py`.
- **Po wycieku** (hasło było kiedyś w historii gita): samo usunięcie z kodu nie wystarcza – unieważnij stare hasło u dostawcy (Google → Hasła aplikacji → usuń) i wygeneruj nowe. Przepisywanie historii gita nie jest potrzebne, jeśli stare hasło jest unieważnione.
