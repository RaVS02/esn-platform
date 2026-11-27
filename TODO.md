# Lista zadań ESN Platform - Roadmap

## Moduł Bot AI (Priorytet: Wysoki)
*Szczegóły i konfiguracja: `docs/AI.md`.*

### Limity i własny klucz (zrobione w v22)
- [X] Licznik dzienny w bazie (`ai_requests_today`, `last_ai_request_date`), atomowa rezerwacja, zwrot przy błędzie dostawcy.
- [X] Limit 15/dobę dla roli `user` (`AI_DAILY_LIMIT_USER`), admin bez limitu.
- [X] Własny klucz API (Gemini, OpenAI, Claude, OpenRouter, Groq), szyfrowany; UI w Profilu; własny klucz znosi limit.
- [X] Model lokalny (Ollama / LM Studio) wywoływany z przeglądarki użytkownika.
- [X] Jedna bramka w portalu; magazyn korzysta z niej (usunięto zduplikowane pytanie w historii).

### Do zrobienia
- [ ] Ollama jako dostawca serwerowy w `.env` (`AI_PROVIDER=openai_compat`) – ustawić na serwerze produkcyjnym.
- [ ] Poziomy limitów (np. konto wspierające) w `ai_service.daily_limit()`; ewentualny panel admina z zużyciem.
- [X] Link z magazynu do karty komponentu na platformie (`catalog_item_id`, `/#components/ID`) i klikalne linki w odpowiedziach AI (v24).
- [ ] Narzędzia dla asystenta (wywoływanie funkcji): wyszukiwanie w katalogu komponentów i w Wiedzy; później opcjonalne wyszukiwanie w sieci przez serwer (limit na użytkownika, filtr adresów wewnętrznych; lokalny model nie ma wtedy pełnej prywatności).
- [ ] Asystent w portalu (Wiedza/Katalog) przez tę samą bramkę.
- [ ] Przeniesienie licznika cooldown z pamięci procesu do bazy (gdy będzie więcej niż jeden worker).

## Interfejs i Responsywność (Priorytet: Średni)
*Poprawa wyglądu na urządzeniach mobilnych, naprawa błędów UI i ustandaryzowanie wyglądu.*

### Optymalizacja Mobilna (RWD)
- [x] (v25) Portal i magazyn: dolny pasek zakładek, menu konta, szuflada kategorii, panele na pełny ekran – `docs/MOBILE.md`.
- [ ] Sprawdzić na prawdziwych telefonach (iOS Safari, Android Chrome) i zebrać uwagi.
- [ ] Wartości `art4`/`art5` w audycie (brak widocznego h1/h2) – obejrzeć ręcznie.

### Estetyka i Style
- [ ] Ustandaryzować emotikony (`style.css`): Dodać `font-family` dla emoji (Apple Color Emoji, Segoe UI Emoji).
- [ ] Poprawić obsługę plików .md: Zabezpieczyć szerokość renderowanego pliku, aby nie psuł układu wizualnego projektu.
- [X] Dodać wizualny wskaźnik statusu projektu bezpośrednio na kafelku informacyjnym.
- [X] Dodanie Footera z logo,krótka notatka, linkami do widokow oraz innych stron,formularzy

## Mechanika i Backend (Priorytet: Średni)
*Logika biznesowa, zarządzanie plikami oraz usprawnienia bazy danych.*

### Podstawowa Funkcjonalność
- [X] Dodać sortowanie i wyszukiwanie projektów według autorów.
- [X] Dodać sortowanie projektów według statusu.
- [X] Zabezpieczenie usuwania kont: Automatyczna zmiana autora w projektach na "Użytkownik usunięty".
- [X] Zmienić logikę kafelków notatek w projektach: Uniezależnić tworzenie nowego kafelka od znaku nowej linii (`\n`).
- [X] Naprawa uprawnień admina w bazie projektów (zawsze widoczne przyciski edycji/usuwania + plakietki moderacji).
- [X] Implementacja PseudoPodstron(cofania). 
- [ ] Wdrożyć system wrzucania (uploadu) plików do projektów.

### Zarządzanie Galerią Zdjęć
- [ ] Przebudować galerię w panelu projektów (i katalogu podzespołów).
- [ ] Dodać możliwość wgrywania wielu zdjęć naraz.
- [ ] Stworzyć panel zarządzania zdjęciami: usuwanie, zmiana kolejności.
### Formularz Kontaktowy
- [X] Dodanie formularza kontaktowego do zgłaszania błedów,zapytan oraz propozycji współpracy
## Rozwój i Społeczność – plan w `docs/SPOLECZNOSC.md` (ustalony 2026-11-27, makiety: artefakt „ESN – makiety społeczności”)
- [x] Etap 0 (v60): sesja tylko w ciasteczku HttpOnly + CSRF (`X-ESN-Req`), logowanie bez wyliczania kont, limity prób w bazie, cookie Secure (auto), nagłówki bezpieczeństwa (portal i magazyn), EXIF – zostaje: porty na 127.0.0.1 na serwerze, pełny CSP po usunięciu onclick. Pierwotny zakres: (komunikat logowania bez wyliczania kont, cookie Secure, token tylko w HttpOnly cookie + CSRF, nagłówki/CSP, limity zapytań w bazie, EXIF ze zdjęć, porty na 127.0.0.1).
- [ ] Etap 1: profil publiczny + ustawienia profilu i prywatności, lista i wyszukiwarka użytkowników (sortowanie A–Z, Z–A, aktywność, projekty, najnowsi; filtry: umiejętności, organizacja, rola); zakładki w edycji projektu. Na profilu bez licznika „dodane do katalogu” (katalog prowadzi administracja) – zamiast niego „Pomocne odpowiedzi”.
- [ ] Etap 2: współtwórcy projektów i schematów (zaproszenia, role, historia zmian); zakładki w formularzu komponentu.
- [ ] Etap 3: powiadomienia (w aplikacji, opcjonalnie e-mail) + obserwowanie.
- [ ] Etap 4: komentarze pod projektami (wątki, @wzmianki, „Przydatne”, edycja/usuwanie własnych, zgłoszenia, moderacja, limit czasowy).
- [ ] Etap 5: zakładka „Społeczność” – aktualności platformy, aktywność obserwowanych, wyszukiwarka osób i umiejętności.
- [ ] Etap 6: forum / pokoje dyskusyjne (zakładane przez administrację i użytkowników – zasady do ustalenia).
- [ ] Później: organizacje („klany”: uczelnia, koło naukowe, firma), odznaki / XP / poziomy / tytuły / ramki, komentarze pod Wiedzą i komponentami, blog.
- [x] v59: mniejsze zaokrąglenie etykiet, tagów i chipów (portal i magazyn).
## Tłumaczenia (i18n)
- [x] (v26) Rdzeń `i18n.js`, słowniki PL/EN, przełącznik, nawigacja, home, AI w profilu, nawigacja magazynu – `docs/I18N.md`.
- [x] (v27) Projekty, Katalog, Narzędzia, Profil, Kontakt, logowanie/rejestracja, stopka, komunikaty.
- [x] (v28) Wiedza (lista, panel redakcji, edytor blokowy, kreator, media, pinout), cały magazyn + `ai-local.js`, etykiety znanych kategorii/zastosowań (`_L`), komunikaty błędów API (`_E`, wzorce `api.*`).
- [x] (v30) Wiedza: wersje językowe (lang + translation_group, filtr zakresu, plakietki, tłumaczenie z edytora). Dalej: projekty, komponenty, pinouty, schematy.
- [x] (v31) Projekty: pole `lang`, filtr języka, plakietki. Dalej: komponenty (`translations`), pinouty, schematy.
- [x] (v32) Filtr języków: checkboxy + łączenie tłumaczeń + plakietki (Wiedza, projekty).
- [x] (v33) Komponenty: jeden rekord z tłumaczeniami (`base_lang`, `translations`), pinout z wersjami językowymi, narzędzie Pinout w Narzędziach (rejestr `ESNTools`). Dalej: pinout w magazynie/schematach z językiem, kalkulatory, edytor schematów.
- [x] (v34) Pinout: powiększony podgląd (pełny ekran), układ kafelków Narzędzi, przykład komponentu z tłumaczeniem (`docs/PRZYKLAD-KOMPONENTU.md`).
- [x] (v35) Bezpieczeństwo: dane SMTP z `.env` (MailBot, zmienne `MAIL_*`/`SMTP_*`), `.env.example`, ostrzeżenie o domyślnym JWT_SECRET_KEY, test `test_secrets.py`.
- [ ] Szablony i przewodnik treści (`knowledge-templates.js`, `knowledge-guide.js`) – wersje EN (razem z treściami wielojęzycznymi).
- [ ] Przejście na zmianę języka bez przeładowania strony.
- [ ] Treści z polem `lang` (artykuły, kursy, projekty, podzespoły).
- [ ] Język w koncie użytkownika.
- [ ] Kolejne języki (ES, DE) po ustabilizowaniu słowników.

- [x] v36: wiadomości e-mail w języku odbiorcy; instrukcja i szablony Wiedzy po angielsku; katalog magazynu z `lang`; etykiety języków na kartach katalogu.
- [x] v37: magazyn – dodawanie z katalogu: dopasowanie kategorii niezależne od języka interfejsu, walidacja kategorii (formularz + 400 zamiast 500).
- [x] v38: integracja edytora schematów połączeń (Narzędzia + karta projektu, /api/wiring, rev/409, tryb gościa) – `docs/SCHEMATY.md`.
- [ ] Schematy: `Project.components` ze schematu, walidacja napięć (pola pinoutu 10.3), blokada usuwania komponentu użytego w schemacie (10.4), jasny motyw edytora (etap 11), link tylko do odczytu (etap 8).
- [x] v39: schematy – jasny motyw edytora, nagłówek narzędzi, „schemat” zamiast „projekt”, no-store, podzespoły projektu ze schematu, ostrzeżenie przy usuwaniu komponentu.
- [x] v40: lista „Moje schematy” w Narzędziach (otwórz, duplikuj, podepnij/odepnij, usuń).

## Schematy połączeń – plan (ustalony 2026-11-26, kolejność potwierdzona)
1. [x] (v41) **Części podstawowe wbudowane w edytor** (jak w demo): rezystor, kondensator, dioda, LED, tranzystor NPN/PNP, przycisk, złącze, zasilanie (bateria/zasilacz, regulator), masa, silnik/serwo…
   – wspólna biblioteka dla wszystkich (bez pinoutu w katalogu), z wartościami i jednostkami jak w demo (4k7, 100n, V, A, Hz…).
   Złożone podzespoły (MCU, moduły, układy) – z katalogu (pinout + dokumentacja); dalej można dodać własną część lub własny pinout.
2. [x] (v43) **Usuwanie i zarządzanie częściami własnymi** + poradnik edytora (dziś: tworzenie i edycja ✎, bez usuwania); ostrzeżenie, gdy część jest użyta w schematach.
3. [x] (v44) **Ikony kategorii ze schematów → magazyn** (ikony edytora lepiej oddają kategorie; jeden wspólny zestaw dla schematów, magazynu i katalogu).
4. [x] (v45) **Tryb gościa:** wyraźne przypomnienie, że schematy żyją tylko w przeglądarce (wyczyszczenie danych = utrata) – zachęta do eksportu JSON / zalogowania.
5. [ ] Checklista edytora (docs/SCHEMATY.md 6): ~~link tylko do odczytu (etap 8)~~ – v46, `generated_with_ai`, pola napięć w pinoutach (10.3), wersjonowanie pinoutu (10.4), magazyn/lista zakupowa, PDF z serwera.
6. [ ] **Widok fizyczny (etap 13 edytora, w stylu Tinkercad/Fritzing):** kafelek = rysunek pinoutu z fizycznym rozmieszczeniem pinów (renderer `pinout.js`), przewody od fizycznych pozycji pinów,
   użyte piny podświetlone; ten sam zapis połączeń co widoki uproszczony i szczegółowy. Poziom 1: podświetlanie użytych pinów na rysunku w karcie komponentu. Breadboard – dalszy pomysł.
- [x] v42: menu Eksport/Widok w edytorze schematów mieści się w edytorze, gdy pasek się zawija.

## Po aktualizacji „użytkownicy i społeczność” (zgłoszone 2026-11-26)
- [ ] **Współtwórcy:** dodawanie innych użytkowników jako współtwórców projektu oraz jako współedytorów schematu (rola przy projekcie/schemacie,
      zaproszenie po loginie, uprawnienia: edycja treści / edycja schematu, bez usuwania i bez zmiany właściciela; widoczne w karcie projektu).
      Uwaga techniczna: schematy mają już blokadę wersji (rev → 409), więc równoległa edycja przez kilka osób jest bezpieczna; wspólna edycja na żywo – osobny, późniejszy pomysł.
- [x] v47: usuwanie projektu z miniaturki i karty (brakowało funkcji deleteProject – przyciski nic nie robiły od początku).
- [x] v48: „Gdzie kupić” – linki do sklepów przy komponentach katalogu (karta, miniaturka, magazyn) – `docs/SKLEPY.md`.
- [x] v49: wersja mobilna (zawijanie tagów na karcie komponentu, siatka projektów, tabela poradnika, wskaźnik kroków) + ikony Font Awesome zamiast emoji w interfejsie portalu i magazynu.
- [x] v50: ikony Font Awesome także zamiast znaków ✕ × ◀ ▶ ‹ › ↗ ← → ▾ (przyciski zamknięcia, przesuwania, linki zewnętrzne, nawigacja Wiedzy, przełącznik języka, rozwijane listy).
- [x] v51: Kalkulatory – szkielet (`calc.js`, `docs/KALKULATORY.md`) + paczka 1: prawo Ohma i moc, dzielnik napięcia (dobór pary z szeregu E), rezystor do LED, kod paskowy rezystora. Dalej paczka 2 (UART/baud, Timer/PWM, RC) i 3 (bateria, LDO, ścieżka PCB, R szeregowo/równolegle, kod kondensatora).
- [x] v52: Kalkulatory – łączenie R/C/L szeregowo i równolegle (z doborem pary), kod kondensatora, UART/SPI/I²C z błędem baud rate, Timer/PWM, filtr RC. Zostaje paczka 3: bateria, LDO, ścieżka PCB.
- [x] v53: Kalkulatory – bateria, regulator liniowy, ścieżka PCB, wzmacniacz operacyjny, schemat i wykres Bodego w filtrze RC, objaśnienie szeregów E. Pomysły: wzmacniacz różnicowy/sumujący/komparator, Sallen-Key, 555, Zener, buck/boost.
- [x] v54: poprawka „Zasoby i pliki do pobrania” – link wpisany w pola zapisuje się razem z formularzem (wcześniej przepadał bez kliknięcia „+ Dodaj link”), opis linku opcjonalny, ostrzeżenie o wybranym, a niedodanym pliku.
- [x] v55: datasheet komponentu i repozytorium projektu tylko w Zasobach – usunięte pola z formularzy, dawne `datasheet_url`/`github_url` przenoszone do `resources` przy starcie (idempotentnie), przycisk w nagłówku karty z pierwszego zasobu danego rodzaju, API katalogu dalej zwraca `datasheet_url` (z zasobów) dla magazynu i schematów. Pinouty bez zmian (własne `sources`).
- [x] v56: Zasoby – długie adresy łamią się w karcie edytora (wcześniej rozpychały okno), nagłówki „Dodane zasoby (n)” i „Dodaj nowy zasób” z przerywaną linią; komunikaty startowe portalu od razu w `docker compose logs` (stdout buforowany liniami).
- [x] v57: Kalkulatory – wtórnik w kalkulatorze wzmacniacza oraz wzmacniacz różnicowy (CMRR, tolerancja), sumujący (2–4 wejść) i komparator z histerezą (pętla histerezy, dobór do progów).
- [x] v58: telefon – sekcja „Opis + Specyfikacja” nie wychodzi poza kartę (siatki `minmax(min(Npx, 100%), 1fr)` w katalogu, Wiedzy, narzędziach, kartach), wiersze specyfikacji na wąskim ekranie: nazwa nad wartością, łamanie długich wartości.
- [ ] Wiedza ↔ kalkulatory: w treściach link „Policz w kalkulatorze” (`#tools/calc/<id>`), docelowo blok `:::calc <id> pole=wartość…` (przycisk lub osadzony kalkulator z wartościami z przykładu).
