# Przykład: dodanie podzespołu z wersjami językowymi (HC-SR04)

Przykład pokazuje **wszystkie pola** formularza komponentu (Katalog podzespołów → *Dodaj komponent*) oraz sposób tłumaczenia.
Dane są poglądowe – wartości i wyprowadzenia zawsze sprawdź w karcie katalogowej konkretnego modułu.
Gotowy plik pinoutu: `docs/przyklady/hc-sr04.pinout.txt` (do wgrania przyciskiem „Wgraj plik pinoutu”).

## 1. Pola formularza (język bazowy: polski)

| Pole | Co wpisać |
|---|---|
| **Nazwa** | `HC-SR04 – ultradźwiękowy czujnik odległości` |
| **Symbol** | `U1` (oznaczenie na schemacie; dla modułu zwykle `U`/`M`) |
| **Kategoria magazynowa** | `Czujniki` (z listy) |
| **Język opisu (bazowy)** | `Polski` – to język pól poniżej (nazwa, opis, parametry, pinout) |
| **Zastosowanie** | `Robotyka` (jedna wartość z listy; tu: pomiar odległości, omijanie przeszkód) |
| **Tagi** | `ultradzwieki, odleglosc, 5v, gpio, arduino, esp32` (klik w „szybkie tagi” dodaje gotowe: `5V`, itd.) |
| **Specyfikacja techniczna** | każda linia `Klucz: wartość` (patrz niżej) |
| **Opis** | patrz niżej |
| **Link do datasheetu** | adres PDF producenta (tu przykładowo: `https://…/hc-sr04.pdf`) |
| **Pinout** | wgraj plik `hc-sr04.pinout.txt` albo wklej jego treść |
| **Zdjęcia** (panel mediów) | `Główne` = zdjęcie modułu; `Galeria` = dodatkowe; `Pinout` = rysunek z datasheetu (pokaże się obok rysunku jako osobna zakładka) |
| **Kod / zasoby** (opcjonalnie) | przykładowy szkic (np. Arduino, `pulseIn`) i linki do materiałów |

**Specyfikacja techniczna** (wklej w całości):

```
Napięcie zasilania: 5 V DC
Prąd w pracy: 15 mA
Zakres pomiaru: 2–400 cm
Rozdzielczość: 0,3 cm
Kąt pomiaru: 15°
Częstotliwość ultradźwięków: 40 kHz
Sygnał wyzwalający: impuls TTL min. 10 µs
Interfejs: GPIO (TRIG/ECHO)
Wymiary: 45 × 20 × 15 mm
```

**Opis** (przykład):

> Ultradźwiękowy moduł do pomiaru odległości. Mikrokontroler wysyła krótki impuls na TRIG, moduł emituje falę 40 kHz,
> a na ECHO zwraca impuls, którego długość jest proporcjonalna do odległości (odległość [cm] ≈ czas [µs] / 58).
> Pracuje przy 5 V – przy układach 3,3 V zastosuj dzielnik napięcia na linii ECHO.

## 2. Tłumaczenie – jak to działa

Komponent to **jeden rekord**. Pola bazowe są w języku bazowym; tłumaczenia dopisujesz osobno, bez duplikatów.
Magazyn i schematy odwołują się do tego samego ID, więc nie ma „drugiego” HC-SR04.

### a) Nazwa, opis, parametry (panel „Tłumaczenia” w formularzu)
Panel ma zakładkę na każdy pozostały język platformy (tu: `EN`). Wpisz tylko to, co ma się różnić – puste pola zostają w języku bazowym
(pole pokazuje wersję bazową jako podpowiedź).

| Pole (zakładka EN) | Wartość |
|---|---|
| Nazwa | `HC-SR04 – ultrasonic distance sensor` |
| Opis | `Ultrasonic distance measuring module. The microcontroller sends a short pulse to TRIG, the module emits a 40 kHz wave and returns a pulse on ECHO whose length is proportional to the distance (distance [cm] ≈ time [µs] / 58). It runs at 5 V – with 3.3 V devices use a voltage divider on the ECHO line.` |
| Etykiety parametrów | po jednej linii `klucz bazowy = tłumaczenie`: |

```
Napięcie zasilania = Supply voltage
Prąd w pracy = Operating current
Zakres pomiaru = Measuring range
Rozdzielczość = Resolution
Kąt pomiaru = Measuring angle
Częstotliwość ultradźwięków = Ultrasonic frequency
Sygnał wyzwalający = Trigger signal
Interfejs = Interface
Wymiary = Dimensions
```

Wartości (`5 V DC`, `2–400 cm`) zostają bez zmian – tłumaczysz tylko etykiety. Kategorie i zastosowania mają własne, wbudowane tłumaczenia.

### b) Pinout (bloki `[en]` w tym samym polu)
Struktura (obudowa, układ, numery i nazwy pinów, kategorie) jest **wspólna**. Tłumaczysz tylko teksty: `view`, `notes`, `typ`, `funkcja`, `uwagi`,
nazwy i uwagi grup. Plik `hc-sr04.pinout.txt` ma już gotowy blok `[en]`. Nowy język dodasz w Narzędziach → Pinout przyciskiem
„+ Dodaj tłumaczenie” (dopisuje blok z tekstami bazowymi do przetłumaczenia) albo ręcznie.

### c) Tłumaczenie z pomocą zewnętrznego AI
1. Narzędzia → Pinout → wczytaj/wklej opis → **Eksport: jeden język** (np. `PL`) → *Kopiuj tekst*.
2. Wklej do swojego czatu z poleceniem: *„Przetłumacz na angielski wartości kolumn typ, funkcja, uwagi oraz pola view, notes i group. Nie zmieniaj numerów, nazw pinów, kategorii ani formatu.”*
3. Wynik wklej jako blok `[en]` (linie `nr | typ | funkcja | uwagi`) w polu Pinout albo w edytorze narzędzia.
4. Sprawdź podgląd (przełącznik języka nad rysunkiem) i zapisz komponent.

## 3. Jak sprawdzić efekt
- W karcie komponentu przełącz język platformy (PL/EN): zmienia się nazwa, opis, etykiety parametrów, a nad pinoutem pojawia się przełącznik **PL / EN**.
- Gdy dla wybranego języka nie ma tłumaczenia, pokazywany jest oryginał z adnotacją „brak tłumaczenia – wersja PL”.
- Wyszukiwarka katalogu przeszukuje także tłumaczenia (np. `ultrasonic`).
