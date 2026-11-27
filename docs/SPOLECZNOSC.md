# Społeczność – plan (ustalony 2026-11-27)

Makiety: artefakt „ESN – makiety społeczności” (profil, lista użytkowników, profil na telefonie, komentarze, współtwórcy, ustawienia i prywatność).
Makiety pokazują wygląd i przepływ; nic w nich nie jest zapisywane.

## Decyzje użytkownika

| Temat | Decyzja |
|---|---|
| Odznaki / osiągnięcia | **Później**, razem z XP i poziomami. Na profilu wyróżnione (wybrane) odznaki + pełna kolekcja; poziom konta, tytuł / ramka. Za co XP i odznaki – do ustalenia. |
| „Obserwuj” | **Tak**, z powiadomieniami (nowe projekty, schematy, aktywność obserwowanych). |
| Komentarze | Najpierw **pod projektami**. Pod Wiedzą i komponentami – w kolejnych etapach (ten sam mechanizm). |
| Nawigacja | **Nowa zakładka „Społeczność”**: aktualności platformy, aktywność obserwowanych, wyszukiwarka osób i umiejętności. |
| Forum / dyskusje | **Tak** – pokoje tworzone przez administrację i przez użytkowników. Szczegóły (kto może zakładać, moderacja pokoi) do ustalenia. |
| Edycja projektu | **Zakładki** (Treść, Zdjęcia, Zasoby, Schemat, Współtwórcy…) zamiast jednej długiej listy pól. To samo dla formularza komponentu (admin). |
| Współtwórcy, ustawienia | Bez zastrzeżeń do makiet. Dojdą: język, widoczność osiągnięć itp. |
| Komentarze – dodatki | Wątki (odpowiedzi), oznaczanie osób **@login**, licznik „Przydatne”, **edycja i usuwanie własnego komentarza**, ochrona przed spamem (limit czasowy i inne). |
| Telefon | Układ z makiety na razie wystarczy. |
| Organizacje („klany”) | Luźna sugestia: tagi uczelni / koła naukowego / firmy przy profilu, wyszukiwanie ludzi i projektów po organizacji. Do dopracowania. |
| Wygląd | Etykiety i tagi z mniejszym zaokrągleniem – **zrobione w v59** (4–6 px zamiast „pigułek”). |

Licznik „Komponenty w katalogu” na profilu z makiety jest **usunięty**: komponenty do katalogu dodaje głównie administracja,
zwykły użytkownik dodaje projekty (magazyn zostaje prywatny). W jego miejscu: **„Pomocne odpowiedzi”** (komentarze oznaczone
przez innych jako „Przydatne”) – od etapu komentarzy.

**Wyszukiwarka użytkowników – sortowanie i filtry:** A–Z, Z–A, najaktywniejsi, najwięcej projektów, najnowsi; filtry:
umiejętności, organizacja, rola (np. weryfikator wiedzy), „przyjmuje zaproszenia do projektów”. Sortowanie A–Z / Z–A także
w listach projektów i katalogu, jeśli gdzieś go brakuje. **Wygląd filtrów** docelowo jak w Projektach i Katalogu
(boczny panel „Opcje filtrowania” z grupami chipów i wyszukiwarką nad listą), a nie rzędy chipów z makiety.

**Organizacje – gdzie się je wpisuje (propozycja):** w Ustawieniach → Profil publiczny, pole „Organizacje” z wyszukiwaniem
po liście istniejących organizacji (nie dowolny tekst – żeby nie było „PWr”, „Politechnika Wrocławska” i „pwr” osobno).
Nowej organizacji nie ma na liście → „Zgłoś organizację” (zatwierdza administracja albo opiekun organizacji). Przynależność:
dopisana przez użytkownika = „niezweryfikowana”, potwierdzona przez opiekuna (lub e-mail w domenie uczelni/firmy) = „zweryfikowana”.
Każdą organizację można ukryć na swoim profilu.

## Pomysły – ocena

Wartość: co da użytkownikom; Koszt: S (dni), M (tydzień+), L (kilka tygodni); Ryzyko: głównie nadużycia i prywatność.

| Pomysł | Wartość | Koszt | Ryzyko | Uwagi |
|---|---|---|---|---|
| Profil publiczny + ustawienia prywatności | wysoka | M | średnie | Podstawa wszystkiego dalej. Domyślnie ostrożnie: profil widoczny dopiero po zgodzie. |
| Lista i wyszukiwarka (osoby, umiejętności) | wysoka | S | niskie | Tylko profile z włączoną widocznością. |
| Współtwórcy projektów i schematów | wysoka | M | średnie | Mamy `rev` i 409 – jednoczesna edycja już bezpieczna. Potrzebne zaproszenia i role. |
| Zakładki w edycji projektu i komponentu | wysoka | S–M | niskie | Czysto interfejs; dobrze zrobić razem ze współtwórcami (nowa zakładka). |
| Komentarze pod projektami | wysoka | M | **wysokie** | Spam i treści – limity, zgłoszenia, moderacja od pierwszego dnia. |
| Powiadomienia (w aplikacji, opcjonalnie e-mail) | wysoka | M | niskie | Wspólne dla zaproszeń, komentarzy, @wzmianek, obserwowanych. Zrobić raz, porządnie. |
| Obserwowanie | średnia | S | niskie | Po powiadomieniach. |
| Zakładka „Społeczność” (aktualności + aktywność) | średnia | M | niskie | Kanał aktywności zbudowany z tych samych zdarzeń co powiadomienia. |
| @wzmianki | średnia | S | średnie | Limit wzmianek na komentarz, wyciszanie. |
| Forum / pokoje dyskusyjne | wysoka | L | **wysokie** | Największy moduł; po komentarzach (ten sam silnik treści i moderacji). |
| Organizacje („klany”) | średnia | M | średnie | Kto zakłada i zatwierdza organizację; weryfikacja, żeby nikt nie podszywał się pod uczelnię czy firmę. |
| Odznaki, XP, poziomy, tytuły, ramki | średnia | M–L | niskie | Po zebraniu zdarzeń (kursy, projekty, komentarze „Przydatne”); reguły ustalimy później. |
| Komentarze pod Wiedzą i komponentami | średnia | S | średnie | Po komentarzach pod projektami – ten sam kod. |

## Dashboard administracji (pomysł 2026-11-27)

W panelu admina, obok zgłoszeń (wiadomości kontaktowe), zakładka „Przegląd” – zamiast zaglądania do Adminera:
- **Użytkownicy:** łącznie, nowi (7 / 30 dni, wykres), aktywni (logowanie w 7 / 30 dni), niezweryfikowani, zbanowani,
  role (admin / moderator / user); lista ostatnich rejestracji z akcjami (podgląd profilu, ban, zmiana roli).
- **Treści:** projekty (opublikowane / szkice), schematy, komponenty katalogu, artykuły Wiedzy do przeglądu, zasoby i pliki.
- **Moderacja:** zgłoszenia do obsłużenia, później zgłoszone komentarze i posty z forum, dziennik moderacji.
- **Bezpieczeństwo:** zablokowane konta i przekroczone limity prób z ostatniej doby (z `rate_limits`), nieudane logowania.
- **Zasoby serwera:** miejsce zajęte przez pliki i zdjęcia, rozmiar bazy, zużycie AI (dziennie, na użytkownika).
- Zasady: tylko rola admin (moderator – sama moderacja), dane zagregowane tam, gdzie wystarczą; e-maile widoczne tylko na
  liście użytkowników dla admina; akcje admina zapisywane w dzienniku.

Ocena: wartość wysoka (codzienna praca administracji), koszt S–M, ryzyko niskie. Dobrze zrobić w etapie 1, bo i tak powstaje
lista użytkowników i ustawienia ról; sekcje moderacji i bezpieczeństwa rosną z kolejnymi etapami.

## Proponowana kolejność etapów

0. **Bezpieczeństwo przed otwarciem społeczności** – **zrobione w v60** (`docs/BEZPIECZENSTWO.md`, „Etap 0 społeczności”); zostaje ręczne zawężenie portów na serwerze i pełny CSP po usunięciu `onclick`.
1. **Profil publiczny + ustawienia profilu i prywatności** (+ lista i wyszukiwarka). Zakładki w edycji projektu. **Dashboard administracji** (pierwsza wersja).
2. **Współtwórcy** projektów i schematów (zaproszenia, role, historia zmian), zakładki w edycji komponentu.
3. **Powiadomienia** (centrum powiadomień, ustawienia e-mail) + **obserwowanie**.
4. **Komentarze pod projektami** (wątki, @wzmianki, „Przydatne”, edycja i usuwanie, zgłoszenia, moderacja, limity).
5. **Zakładka „Społeczność”** – aktualności platformy i aktywność obserwowanych.
6. **Forum / pokoje** – po ustaleniu zasad zakładania i moderacji.
7. Później: organizacje, odznaki / XP / poziomy, komentarze pod Wiedzą i komponentami.

## Bezpieczeństwo i ochrona danych

### Stan obecny (sprawdzone w kodzie)
- Hasła: **bcrypt** z solą (`utils.hash_password`). Blokada konta na 15 min po 5 błędnych próbach.
- JWT HS256, ważny 24 h; sekret z `.env` (ostrzeżenie przy domyślnym). Cookie `HttpOnly`, `SameSite=Lax`.
- Sekrety tylko w `.env`, test pilnuje, żeby nic nie trafiło do kodu. Odpowiedzi zależne od użytkownika z `no-store`.
- Treści Wiedzy i opisy: markdown renderowany przez `textContent`/własny renderer; pliki – lista dozwolonych typów, limity.

### Etap 0 (zrobione w v60, szczegóły w `docs/BEZPIECZENSTWO.md`)
1. **Komunikat logowania bez wyliczania kont:** dziś „Użytkownik nie istnieje” zdradza, czy login istnieje. Jeden komunikat „Błędny login lub hasło”.
2. **Cookie `Secure`** na produkcji (za Cloudflare jest HTTPS) – dziś `secure=False`; sterowane zmienną w `.env`.
3. **Token poza `localStorage`:** dziś JWT jest też w `localStorage`, więc każda luka XSS może go wykraść. Przejście na samo
   `HttpOnly` cookie (+ ochrona CSRF dla zapisów) – ważne, zanim pojawią się komentarze innych osób na stronie.
4. **Nagłówki bezpieczeństwa:** `Content-Security-Policy` (najpierw w trybie raportowania – szablon ma `onclick`),
   `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`.
5. **Limity zapytań** dla logowania, rejestracji, resetu hasła, wyszukiwarki użytkowników i (później) komentarzy – w bazie,
   nie w pamięci (kilka workerów).
6. **Zdjęcia profilowe:** ponowne zakodowanie obrazu (usuwa metadane EXIF, np. lokalizację GPS z telefonu), stały rozmiar, limit wagi.
7. Porty bazy i portalu tylko na `127.0.0.1` (dziś publikowane w sieci lokalnej).

### Etap 1a (zrobione w v61)
- Nowe kolumny `users`: `bio` (≤300), `location` (≤80), `skills` (JSON, ≤8 tagów po ≤30 znaków), `links` (JSON, ≤4, tylko http/https),
  `profile_public` (domyślnie **wyłączone**), `show_activity` (wł.), `show_courses` (wył.), `allow_invites` (wł.), `profile_updated_at`.
  Dodawane automatycznie przy starcie (`ALTER TABLE … ADD COLUMN IF NOT EXISTS`), kod w `app/profile_service.py`.
- API: `GET/PUT /api/users/me/public-profile` (zapis: limit 30/h), `GET /api/u/{login}` (limit 300 / 10 min na IP).
  Profil prywatny, zbanowany i nieistniejący dają **tę samą** odpowiedź 404; właściciel i admin dostają podgląd (`preview: true`).
  E-mail nigdy nie trafia do odpowiedzi; wszystkie odpowiedzi z `Cache-Control: no-store`.
- Interfejs: „Mój profil” ma nagłówek jak dotąd, a pod nim boczne menu z zakładkami (na telefonie – przewijany pasek):
  **Profil publiczny** (zdjęcie / „Użyj inicjałów”, nazwa, login, o mnie, miejscowość, umiejętności, GitHub, www, inne linki,
  przełączniki prywatności, jeden przycisk „Zapisz”), **Dane konta** (e-mail, hasło, usuwanie konta), **Asystent AI**,
  **Język i wygląd**. Kod: `static/profile-settings.js`, teksty `pp.*` i `acc.*`; `DELETE /api/users/me/avatar`.
  „Powiadomienia” dojdą do menu w etapie 3. Przycisk „Podgląd profilu” zadziała w v62 (strona `#u/<login>`).

### Etap 1b (zrobione w v62)
- Zakładka **„Ludzie”** w menu (i w dolnym pasku na telefonie): `#people` – lista tylko profili publicznych i niezablokowanych,
  boczny panel filtrów jak w Projektach (sortowanie: najaktywniejsi, A–Z, Z–A, najwięcej projektów, najnowsi; umiejętności z
  licznikami; „Administracja”; „Przyjmują zaproszenia”), wyszukiwarka (nazwa, login, opis, miejscowość, umiejętności), po 24 na stronę.
- Strona profilu `#people/<login>`: nagłówek (zdjęcie/inicjały, nazwa, rola, @login · miejscowość, opis, umiejętności, linki
  z `rel="nofollow ugc noopener"`), liczba projektów, siatka projektów (klik otwiera projekt). Właściciel: „Edytuj profil”;
  „Zaproś do projektu” – nieaktywne do etapu współtwórców. „Najaktywniejsi” = ostatnia zmiana profilu lub nowy projekt.
- API `GET /api/people?q=&skills=&role=team&invites=1&sort=&page=` (limit 240 / 10 min na IP), kod `profile_service.search_people`,
  interfejs `static/people.js` (teksty `ppl.*`). Filtrowanie w Pythonie – przy dużej liczbie profili przenieść do SQL / osobnej tabeli umiejętności.

### Etap 1c (zrobione w v63)
- Formularz projektu w zakładkach: **Treść** (tytuł, tagi, opis, język, status), **Podzespoły**, **Notatki i kod**, **Zdjęcia**,
  **Artykuł** (edytor + plik .md), **Zasoby**. Pasek zakładek i przycisk zapisu przyklejone (sticky) w oknie; na telefonie
  pasek przewija się w poziomie. Pusty tytuł przy zapisie przenosi do „Treść”. Zakładka „Współtwórcy” dojdzie w etapie 2.

### Zasady dla nowych funkcji
- **Minimum danych i jawność:** e-mail nigdy publiczny; miejscowość, linki, organizacje – opcjonalne. Profil w społeczności
  dopiero po zgodzie (przełącznik „Pokazuj mój profil”), osobne przełączniki dla aktywności, postępu w kursach i zaproszeń.
- **Uprawnienia sprawdzane na serwerze** przy każdym zapisie (autor / współautor / moderator / admin) – nigdy tylko w interfejsie.
- **Treści użytkowników** (komentarze, bio, forum): ten sam bezpieczny markdown co dziś (bez surowego HTML), linki
  `rel="nofollow ugc noopener"`, limit długości, limit linków w komentarzu nowego konta.
- **Spam i nadużycia:** limit czasowy między komentarzami (np. 30 s, mniej dla zaufanych), dzienny limit dla nowych kont,
  przycisk „Zgłoś” + kolejka moderacji, ukrywanie przez autora projektu w jego projekcie, blokada użytkownika przez moderatora,
  możliwość zablokowania osoby (nie widzi mnie, nie może mnie oznaczać ani zapraszać).
- **Dziennik moderacji:** kto, co i kiedy ukrył, usunął lub zablokował (audyt, odwołania).
- **RODO:** eksport moich danych (JSON), usunięcie konta (anonimizacja komentarzy jako „usunięty użytkownik” albo usunięcie),
  regulamin i polityka prywatności przed włączeniem społeczności, informacja o plikach cookie.
- **Kopie zapasowe** bazy regularne i szyfrowane, z czasem przechowywania; test odtworzenia.
- Później: **2FA** (TOTP) dla moderatorów i adminów, potem dla chętnych; powiadomienie o logowaniu z nowego urządzenia.

## Otwarte pytania (na kolejne rozmowy)
- Forum: kto może zakładać pokoje (każdy? od poziomu? po akceptacji?), czy pokoje prywatne / organizacji.
- Organizacje: kto je zakłada i zatwierdza, czy z weryfikacją (np. e-mail w domenie uczelni lub firmy).
- XP i odznaki: za jakie działania, ile, czy odznaki ręczne od administracji.
- Wiadomości prywatne między użytkownikami – czy w ogóle (duże ryzyko nadużyć i moderacji).
