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
- [ ] Link z magazynu do karty komponentu na platformie (pole `catalog_id` w komponencie magazynu) i użycie go w odpowiedziach AI.
- [ ] Asystent w portalu (Wiedza/Katalog) przez tę samą bramkę.
- [ ] Przeniesienie licznika cooldown z pamięci procesu do bazy (gdy będzie więcej niż jeden worker).

## Interfejs i Responsywność (Priorytet: Średni)
*Poprawa wyglądu na urządzeniach mobilnych, naprawa błędów UI i ustandaryzowanie wyglądu.*

### Optymalizacja Mobilna (RWD)
- [ ] Naprawić logowanie/wylogowywanie na telefonach (rozwiązanie problemu z brakiem dostępu do Magazynu).
- [ ] Dodać blok `@media (max-width: 768px)` na końcu pliku stylów.
- [ ] Zmienić układ `projects-layout` na urządzeniach mobilnych: jedna kolumna, Sidebar przeniesiony na górę.
- [ ] Przystosować siatki kafelków do jednej kolumny (`grid-template-columns: 1fr`).
- [ ] Magazyn: Poprawić wyświetlanie tabel i list komponentów na telefonie.
- [ ] Magazyn: Umożliwić poziome przewijanie paska nawigacji.

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