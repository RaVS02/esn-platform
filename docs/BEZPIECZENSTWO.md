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

## Etap 0 społeczności (v60)
Przed publicznymi profilami i treściami użytkowników (plan: `docs/SPOLECZNOSC.md`).

- **Sesja tylko w ciasteczku `HttpOnly`** (`esn_access_token`, `SameSite=Lax`, `max-age` = ważność tokenu). Token nie jest już
  zapisywany w `localStorage` (stary wpis jest usuwany przy wejściu na stronę), więc ewentualna luka XSS nie wykradnie sesji.
  Interfejs dostaje dane zalogowanego od serwera: `window.ESN_USER` = `{sub, role, user_id, exp}` wstrzykiwane w `GET /`
  (odpowiedź `no-store`) i obsługiwane przez `static/auth.js` (`ESNAuth`). `ESNAuth.token()` zwraca **pseudo-token**
  (ten sam kształt co JWT, bez podpisu) tylko po to, żeby istniejący kod mógł odczytać rolę; owinięty `fetch` usuwa go z nagłówka.
- **Bearer nadal działa** (klienci API, testy, magazyn → portal). Nieprawidłowy Bearer nie blokuje ciasteczka.
- **CSRF:** zapis (POST/PUT/PATCH/DELETE) uwierzytelniony ciasteczkiem wymaga nagłówka `X-ESN-Req: 1` – dodaje go owinięty
  `fetch` w `static/i18n.js` (tylko dla własnego serwera), a upload zdjęć (XHR) w `media.js` ręcznie. Obca strona nie ustawi
  takiego nagłówka bez zgody CORS. To samo sprawdza magazyn (`csrf_guard` w `esn_magazyn/app.py`). Nowe zapytania z
  przeglądarki muszą iść przez `fetch` albo dodać nagłówek same.
- **Cookie `Secure`:** `COOKIE_SECURE=auto` (domyślnie) – włączane, gdy żądanie przyszło po HTTPS (`CF-Visitor` od Cloudflare,
  `X-Forwarded-Proto`); `1`/`0` wymusza. Przy HTTPS dodawany jest też `Strict-Transport-Security`.
- **Logowanie bez wyliczania kont:** brak konta i złe hasło dają ten sam komunikat „Błędny login lub hasło” (bez licznika prób).
  Rejestracja nadal mówi, że login/e-mail jest zajęty (inaczej nie da się założyć konta) – chroni ją limit prób.
- **Limity prób w bazie** (`security_service.rate_limit`, tabela `rate_limits`, wspólne dla workerów; przekroczenie → 429 i `Retry-After`):

  | Akcja | Limit |
  |---|---|
  | logowanie | 30 / 10 min na IP (+ blokada konta po 5 złych hasłach, jak dotąd) |
  | rejestracja | 10 / h na IP |
  | weryfikacja konta kodem | 8 / 15 min na e-mail, 30 / 15 min na IP |
  | „Nie pamiętam hasła” | 3 / 15 min na e-mail, 10 / h na IP |
  | reset hasła, kody jednorazowe (zmiana e-maila, usunięcie konta…) | 6 prób / 15 min na konto i cel, 20 / 15 min na IP |
  | wysyłka kodu na e-mail | 5 / 15 min na konto |
  | formularz kontaktowy | 5 / h na IP |

  IP klienta: `CF-Connecting-IP` → `X-Forwarded-For` → `X-Real-IP` (`TRUST_PROXY=1`, domyślnie). Uwaga: kto ma dostęp do portu
  nginx z sieci lokalnej, może podać własny nagłówek – dlatego porty warto zawęzić (niżej).
- **Nagłówki bezpieczeństwa** (portal: `security_service.security_headers`, magazyn: `security_headers`): `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, `Cross-Origin-Opener-Policy`, egzekwowany CSP w bezpiecznym zakresie
  (`frame-ancestors`, `base-uri`, `object-src`, `form-action`) i pełny CSP w trybie **Report-Only** (naruszenia widać w konsoli
  przeglądarki; egzekwowanie po usunięciu `onclick` z szablonu).
- **Zdjęcia:** JPEG tracą EXIF (w tym GPS) przy wgrywaniu – już od wcześniejszych wersji (`media_service`).
- **Do zrobienia ręcznie na serwerze:** porty bazy (`5432`) i portalu (`8000`) tylko na `127.0.0.1` w
  `docker-compose.override.yaml`, jeśli nic z sieci lokalnej z nich nie korzysta.
- Testy: `tests/test_security.py`.
