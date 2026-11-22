# Pilotaż Wiedzy: uwagi merytoryczne i stylistyczne

Trzy próbki są **wiernym przeniesieniem** dotychczasowego tekstu. Niczego merytorycznie nie zmieniono bez Twojej
akceptacji. Poniżej miejsca, które warto sprawdzić. Pozycje oznaczone ❗ to moim zdaniem rzeczywiste nieścisłości.

## Niezbędnik: Typy pinów i poziomy logiczne
- ❗ „Podanie 5 V na pin GPIO natychmiast go spali” i „spali cały mikrokontroler” brzmią zbyt kategorycznie. ESP32 nie
  toleruje 5 V na GPIO i trzeba tego unikać, ale skutek zależy od prądu (uszkodzenie wejścia, zawieszenia, degradacja).
  Propozycja: „może go uszkodzić”, a o diodach ochronnych w osobnym zdaniu.
- ❗ „STM32 operują na 3.3 V”: zasilanie tak, ale wiele pinów STM32 jest tolerancyjnych na 5 V (oznaczenie FT), zależnie od
  modelu i pinu. Propozycja: „zwykle 3,3 V; sprawdź tolerancję 5 V w nocie”.
- „Zawsze używaj dwukierunkowych konwerterów”: dla linii jednokierunkowej (czujnik 5 V → RX ESP32) wystarcza dzielnik
  rezystorowy. Dwukierunkowy konwerter jest potrzebny np. dla I²C.
- „ESP32 ma ADC 12-bitowe” jest prawdą nominalną. Warto dopisać, że ADC ESP32 jest nieliniowy, a ADC2 bywa niedostępny przy
  włączonym Wi-Fi.

## Artykuł: ADC
- ❗ „Dane 24-bit → pakuj w `uint32_t` (bajt MSB zawsze = 0)” dotyczy wartości bez znaku. Wiele przetworników 24-bit
  (w tym układy do EKG) zwraca wynik ze znakiem (kod uzupełnień do dwóch), więc potrzebne jest rozszerzenie znaku do
  `int32_t`. Zależy od układu, do sprawdzenia w datasheecie ADS1293.
- ❗ Diagram: „~0.8 mV / krok” dla ESP32 i „~4.9 mV / krok” dla Arduino zakładają pełny zakres 3,3 V i 5 V. ADC ESP32 ma
  domyślnie mniejszy zakres zależny od tłumienia (ok. 0–1,1 V bez tłumienia), więc krok zależy od ustawień.
  „<0.3 µV / krok” dla 24-bit zależy od Vref i wzmocnienia, a efektywna rozdzielczość jest ograniczona szumem (ENOB < 24).
- Stylistyka: „schodki” i „kroki” są używane zamiennie; warto ujednolicić (w standardzie: „kwant”, „krok kwantyzacji”).
- Dodano **nowy** element, którego nie było w archiwum: interaktywny widget kwantyzacji (suwak bitów). Do oceny.

## Kurs: Komunikacja szeregowa
**Lekcja 1: ASCII vs binarnie**
- ❗ „ASCII: niedopuszczalny przy ≥200 Hz” i „binarny: jedyna opcja dla ≥500 Hz” są niespójne z Lekcją 3. Jeden kanał w ASCII
  (~5 B) przy 500 Hz to 25 000 b/s, co mieści się w 115200. Granica zależy od liczby kanałów i szybkości łącza.
  Propozycja: uzależnić od przepustowości („gdy ramka ASCII × częstotliwość × 10 przekracza baud rate”).
- ❗ Kod Pythona: format `'<IhH'` kończy się `H` (bez znaku), a komentarz mówi „int16 accel_x”. Powinno być `'<Ihh'`.
  Synchronizacja: jeśli pierwszy bajt to `0xAA`, a drugi nie `0xBB`, drugi bajt jest tracony (może być początkiem następnej
  ramki). Brak sprawdzania CRC (jest dopiero w Lekcji 2).
- ❗ Przykład „`analogRead()` → `1024`”: 10-bitowy ADC zwraca 0–1023.
- ❗ „Binarny przesył redukuje liczbę bajtów o ponad 50%”: dla pojedynczej próbki z 2-bajtowym nagłówkiem to 4 B zamiast 5 B
  (ok. 20%). Zysk rośnie dla większych liczb i ramek zbiorczych.
- Stylistyka: mieszanka „parsing/debug/initial setup” z polskimi terminami; pojedyncze cudzysłowy ASCII zamieniono na „…”.

**Lekcja 2: Budowa ramki**
- ❗ `calcCRC` nie jest zdefiniowana w przykładzie; pole `crc` to 1 bajt (CRC-8 albo XOR), warto to nazwać.
- Dostęp do niewyrównanych pól packed (np. `uint32_t ts`) na ARM Cortex-M0 może powodować błąd sprzętowy. Na AVR i ESP32 działa.
  Warto dopisać ostrzeżenie. `millis()` przepełnia `uint32_t` po ok. 49 dniach.
- Kolejność bajtów: ESP32/AVR są little-endian, co zgadza się z `<` w Pythonie. Warto to powiedzieć wprost.

**Lekcja 3: Matematyka baud rate**
- ❗ „Bufor UART ma tylko 64 bajty”: 64 B to domyślny bufor RX w Arduino AVR. ESP32 ma sprzętowe FIFO 128 B i domyślny bufor
  RX 256 B (`Serial.setRxBufferSize()`). Wartość zależy od platformy.
- „Wymaga min. 115200 baud” przy 50 000 b/s: matematycznie wystarczyłoby 57600 bez zapasu. Zalecenie 115200 jest zasadne dzięki
  zapasowi 30–50% z tej samej lekcji. Można to powiedzieć wprost.
- Rachunki w tabeli (1 200, 14 000, 50 000, 175 000, 400 000 b/s) sprawdzono: są poprawne.

## Poprawione w v7
- „Podanie 5 V natychmiast spali pin” → „może go uszkodzić” (zależy od układu i ilości prądu).
- ADC ESP32: dopisano nieliniowość oraz niedostępność ADC2 przy włączonym Wi-Fi.
- STM32: nie wszystkie układy są 3,3 V-owe, część pinów toleruje 5 V (FT) – sformułowanie złagodzone.
- Dane 24-bit: usunięto „pakuj w uint32_t, MSB = 0” (dla wartości ze znakiem to błąd) → 32-bitowa zmienna, format wg noty.
- Dodano uwagę, że podane kroki ADC dotyczą pełnego zakresu; w ESP32 zależą od tłumienia wejścia, w 24-bit od Vref i wzmocnienia.
- Przykład ASCII: `analogRead()` zwraca max 1023 (UNO), więc `"1023\n"` = 5 B, a binarnie 0xFF 0x03 (little-endian), nie 1024 / 0x04 0x00.
- Twarde progi „≥200 Hz niedopuszczalny”, „≥500 Hz jedyna opcja” zastąpiono sformułowaniem zależnym od przepustowości łącza.
- Odbiornik w Pythonie: poprzednia pętla gubiła ramki przy przesunięciu; nowa szuka znacznika w buforze, a format `struct` jest zgodny
  z rozmiarem ramki.

## Uwagi ogólne
- Cudzysłowy: w nowych treściach używam polskich „…”. W archiwum są proste "…".
- Terminologia: proponuję słowniczek (bufor, ramka, próbka, przerwanie) i trzymanie się jednego tłumaczenia.
