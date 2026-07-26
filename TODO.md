# Lista zadań ESN Platform - Roadmap

## Moduł Bot AI (Priorytet: Wysoki)
*Sekcja skupiona na zabezpieczeniu kosztów i rozwoju asystenta.*

### Zabezpieczenie limitów w bazie danych (models.py & app.py)
- [ ] Dodać kolumnę `ai_requests_today` (Integer, default=0) do modelu User.
- [ ] Dodać kolumnę `last_ai_request_date` (Date, default=today) do modelu User.
- [ ] Wdrożyć Rate Limiter: Dodać sprawdzanie daty w endpoint `ai_chat` (jeśli nowa doba -> reset licznika).
- [ ] Blokować zapytania dla roli `user`, gdy licznik osiągnie 10-15 zapytań/doba.
- [ ] Zwiększać licznik po każdej udanej odpowiedzi od API Gemini.

### System BYOK (Bring Your Own Key)
- [ ] Dodać pole `personal_gemini_key` w bazie (zaszyfrowane).
- [ ] Stworzyć UI w Profilu Użytkownika do wklejania własnego klucza API.
- [ ] Zmodyfikować `ai_chat`, aby priorytetowo używał klucza użytkownika (omijając limity systemowe).

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