# Plan rozwoju platformy

Kolejność jest orientacyjna, każdy etap jest oddawany małymi krokami: funkcja → test → commit → następna.

## Zrobione
- Interaktywny pinout, system mediów, zabezpieczenia uploadów i XSS, pinout ze zdjęcia.
- Relacje projekt ↔ podzespół, przykłady kodu dla wielu środowisk (kolorowanie składni), pliki do pobrania z licencjami.
- Zakładka **Wiedza** (v6): niezbędniki, poradniki, artykuły, kursy; markdown z blokami, rysunki SVG, widgety w sandboxie,
  panel redakcji, przepływ zatwierdzania (redaktor → admin), archiwum dawnego niezbędnika. Zakładka **Narzędzia**
  (szkielet z banerem „W rozwoju”).
- Wiedza v7: obrazy w treściach, biblioteka szablonów widgetów, zakładka „Instrukcja” w panelu redakcji, poprawki merytoryczne
  próbek (z bezpieczną aktualizacją istniejącej bazy), naprawa układu bloku klucz–wartość.

- Wiedza v8: nowe bloki (kroki, oś czasu, postęp, definicje, lista kontrolna, zwijana, zakładki, szara ramka), diagramy
  flow/er/sequence, archiwum tylko dla admina, import partii treści jako propozycji do przeglądu, kurs „Podstawy sprzętu”.

- Wiedza v9: kreator blokowy (tryb prosty/zaawansowany), wyszukiwanie, filtry i sortowanie listy treści, kod jak w projektach,
  wspólny styl kontrolek w widgetach.

- Wiedza v10: edytor opisu projektu dla użytkowników (bezpieczny tryb), druga partia z archiwum (kurs „Czas, przerwania i próbkowanie”).
- Wiedza v11: trzecia partia z archiwum (kurs „Bufory i przepływ danych”), szablony opisu projektu i lekcji („Wstaw szablon…”).
- Wiedza v12: animacje uzupełniające kursy (jitter, stos LIFO, ping-pong), nowy kurs „Wielozadaniowość i niezawodność” (FreeRTOS, watchdog).
- Wiedza v13: kursy „Interfejsy i protokoły” (UART/I2C/SPI/I2S, animacje ramki I2C i SPI, kalkulator pull-upów) i „Sygnał i bezpieczeństwo pomiarów” (izolacja, ochrona wejścia, CMRR, filtry RC).
- Wiedza v14: kurs „Transmisja danych w praktyce” (batching, CRC, kontrola przepływu, Wi-Fi/BLE/MQTT); widgety z wyborem tempa animacji.
- Wiedza v15: kurs „Dane i liczby w pamięci”. Zawartość archiwum została w całości przeniesiona do bazy (po Twoim przeglądzie można usunąć plik, endpoint i widok).
- Motyw jasny/ciemny, etap 1 (v16): paleta jasna, przełącznik (auto/jasny/ciemny), poprawka podglądu edytora Wiedzy. Szczegóły: `docs/MOTYW.md`.
- Motyw: poprawki czytelności w jasnym motywie, jasny motyw kodu, nowa czcionka nagłówków (v18–v21). Serwer zaktualizowany do v21, magazyn przebudowany.
- Asystent AI (v22): jedna bramka w portalu, dzienny limit, własny klucz API (BYOK) i model lokalny z przeglądarki (Ollama/LM Studio). Szczegóły: `docs/AI.md`.
- Motyw, etap 2 (v17): widgety (paleta `--w-*` + postMessage), magazyn, galeria pinoutów (kontrast DAP/pinów), czcionka nagłówków Space Grotesk.

## Następne kroki (uzgodniona kolejność)
1. Edytor schematów: jasny motyw i wspólny zestaw ikon (z magazynem) przy integracji z platformą.
2. (zrobione v22) Limity AI i własny klucz API (BYOK).
3. Poprawki mobilne (RWD), szerokość markdown, czcionki emoji.
4. Tłumaczenie PL/EN (mechanizm `t('klucz')` → główne ekrany → moduły → treści z polem języka).
5. Przebudowa magazynu na serwerze, kalkulatory w Narzędziach, integracja edytora schematów, nowe tematy Wiedzy (ADC, PWM, tranzystory, debugowanie, uśpienie, LED), ścieżki tematyczne.
6. Mermaid lokalnie jako opcja dodatkowa (jeśli własne diagramy nie wystarczą).

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
