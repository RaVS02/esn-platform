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
## Rozwój i Społeczność (Priorytet: Niski / Plany na przyszłość)
*Dodatkowe panele i funkcjonalności budujące społeczność wokół portalu.*

- [ ] Wdrożyć moduł Forum.
- [ ] Wdrożyć moduł Bloga.
- [ ] Stworzyć wyszukiwarkę użytkowników.
- [ ] Zbudować publiczny panel użytkownika (widoczny dla innych) zawierający: Avatar, Bio oraz listę stworzonych projektów.
## Tłumaczenia (i18n)
- [x] (v26) Rdzeń `i18n.js`, słowniki PL/EN, przełącznik, nawigacja, home, AI w profilu, nawigacja magazynu – `docs/I18N.md`.
- [x] (v27) Projekty, Katalog, Narzędzia, Profil, Kontakt, logowanie/rejestracja, stopka, komunikaty.
- [x] (v28) Wiedza (lista, panel redakcji, edytor blokowy, kreator, media, pinout), cały magazyn + `ai-local.js`, etykiety znanych kategorii/zastosowań (`_L`), komunikaty błędów API (`_E`, wzorce `api.*`).
- [x] (v30) Wiedza: wersje językowe (lang + translation_group, filtr zakresu, plakietki, tłumaczenie z edytora). Dalej: projekty, komponenty, pinouty, schematy.
- [x] (v31) Projekty: pole `lang`, filtr języka, plakietki. Dalej: komponenty (`translations`), pinouty, schematy.
- [x] (v32) Filtr języków: checkboxy + łączenie tłumaczeń + plakietki (Wiedza, projekty).
- [x] (v33) Komponenty: jeden rekord z tłumaczeniami (`base_lang`, `translations`), pinout z wersjami językowymi, narzędzie Pinout w Narzędziach (rejestr `ESNTools`). Dalej: pinout w magazynie/schematach z językiem, kalkulatory, edytor schematów.
- [ ] Szablony i przewodnik treści (`knowledge-templates.js`, `knowledge-guide.js`) – wersje EN (razem z treściami wielojęzycznymi).
- [ ] Przejście na zmianę języka bez przeładowania strony.
- [ ] Treści z polem `lang` (artykuły, kursy, projekty, podzespoły).
- [ ] Język w koncie użytkownika.
- [ ] Kolejne języki (ES, DE) po ustabilizowaniu słowników.
