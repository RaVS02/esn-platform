# Plan rozwoju platformy

Kolejność jest orientacyjna, każdy etap jest oddawany małymi krokami: funkcja → test → commit → następna.

## Zrobione
- Interaktywny pinout, system mediów, zabezpieczenia uploadów i XSS, pinout ze zdjęcia.
- Relacje projekt ↔ podzespół, przykłady kodu dla wielu środowisk (kolorowanie składni), pliki do pobrania z licencjami.
- Zakładka **Wiedza** (v6): niezbędniki, poradniki, artykuły, kursy; markdown z blokami, rysunki SVG, widgety w sandboxie,
  panel redakcji, przepływ zatwierdzania (redaktor → admin), archiwum dawnego niezbędnika. Zakładka **Narzędzia**
  (szkielet z banerem „W rozwoju”).

## Etap 2: treści i narzędzia
- Migracja pozostałych sekcji archiwum do Wiedzy wraz z przeglądem merytorycznym i stylistycznym (kursy: pamięć i RTOS,
  komunikacja bezprzewodowa; niezbędniki: pinout, zasilanie, izolacja).
- Dodatkowe kolekcje („ścieżki tematyczne”) z tych samych treści, bez duplikowania.
- **Narzędzia:** prosty kalkulator (dzielnik, Ohm, LED, kody rezystorów, przepustowość UART) w pierwszej kolejności;
  integracja edytora schematów z osobnego repozytorium (najpierw osobna podstrona/iframe, później moduł wbudowany).
  Punkty styku: symbole z katalogu podzespołów, zapis schematu jako zasób projektu (rola `schematic`), eksport SVG/PNG do karty projektu.
- Schematy połączeń („blueprint”) w kartach projektów.
- Wyszukiwanie w treściach po tagach i filtrach, „podobne treści”, powiązania artykułów z podzespołami i projektami.

## Etap 3: społeczność
- Rozbudowa profilu i uporządkowanie ustawień; tablica użytkownika (opis, projekty, aktywność); wyszukiwarka użytkowników.
- Komentarze pod artykułami i projektami.
- Czaty prywatne i otwarte pokoje dyskusji.
- **Moderacja:** zgłaszanie treści i komentarzy, kolejka zgłoszeń, historia decyzji. Zalążek istnieje już w panelu
  redakcji (kolejka „Do zatwierdzenia” i historia statusów) i będzie rozszerzany.
- Postęp w kursach i własny system punktów doświadczenia.

## Etap 4: dalsza przyszłość
- Dwujęzyczność PL/EN całej platformy (treści i interfejs). Treści Wiedzy mają obecnie tylko wersję polską;
  przy tłumaczeniu dojdzie osobna wersja językowa każdej treści.
- Model 3D płytki w karcie podzespołu.
- Dodatkowe typy podzespołów (tranzystory, diody, moduły) i złącza (I²C/Qwiic, I²S) w pinoucie.
