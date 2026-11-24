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

## Partia v8: Podstawy sprzętu (zmiany względem archiwum)
- **MCU a CPU:** „SoC” zastąpiono ostrożniejszym „układ typu system-on-chip”; „miesiącami na baterii” uzależniono od trybów
  uśpienia; dodano tabelę porównawczą, uwagę o nazwach płytek (Pico = MCU, Pi 5 = CPU), diagram wyboru i quiz.
- **Taktowanie:** doprecyzowano, że 1 cykl ≈ 1 instrukcja dotyczy najprostszych instrukcji (mnożenie, dzielenie, pamięć trwają
  dłużej); dopisano czas cyklu (62,5 ns / 4,2 ns), zależność mocy od f i U², tryby 80/160/240 MHz; ceny oznaczone jako
  orientacyjne (klony Uno, płytki ESP32); dodano kalkulator czasu wykonania.
- **Zasilanie – korekty ważne merytorycznie:**
  - VIN/5V zwykle wymaga ok. 4,5–5 V (stabilizator LDO ma spadek ok. 1 V), więc pojedyncza cela Li-Ion do VIN **nie** wystarcza;
    w archiwum sugerowano pakiet Li-Ion. Dodano wyjaśnienie.
  - Piki Wi-Fi „do 600 mA” zastąpiono „kilkaset mA, zasilacz co najmniej 500 mA”.
  - „LDO wymagane w audio i EKG” → „preferowane” (dobra przetwornica z filtrem też działa).
  - „Spalenie komponentów” przy braku wspólnej masy → „błędy, w skrajnych przypadkach uszkodzenia”; dopisano wyjątek (izolacja).
  - Dodano wzory na sprawność i moc strat LDO oraz kalkulator.
  - Do sprawdzenia przez Ciebie: wartości limitów USB i prądów zależą od konkretnej płytki.

## Partia v10: Czas, przerwania i próbkowanie (zmiany względem archiwum)
- **Czas bez blokowania:** „Nigdy delay() w produkcji” złagodzono (delay jest w porządku w setup() i prostych szkicach); usunięto
  błędny fragment „prevTime += now”; „złota zasada RTOS” przemianowano na technikę stałego kroku (odpowiednik vTaskDelayUntil w RTOS);
  dodano wyjaśnienie, czemu odejmowanie na liczbach bez znaku jest odporne na przepełnienie, ostrzeżenie o „nadrabianiu” po
  zatrzymaniu pętli, uwagę o dokładności zegara oraz symulator dryfu.
- **ISR – ważna korekta:** w archiwum `analogRead()` był wywoływany wewnątrz ISR, co przeczyło zasadzie „tylko najszybsze
  instrukcje” (na AVR ok. 100 µs, a na ESP32 funkcje Arduino nie nadają się do ISR). Przykład zmieniono na wzorzec „flaga w ISR,
  odczyt w pętli”. Zdanie „niemal zerowy jitter” zastąpiono „mały i przewidywalny”.
- Dodano: `millis()` nie rośnie wewnątrz ISR (AVR), atomowość odczytu zmiennych 16/32-bitowych na AVR i `noInterrupts()`,
  wersję dla ESP32 (`IRAM_ATTR`, API timera z rdzenia Arduino-ESP32 3.x; w 2.x wywołania są inne – do sprawdzenia przez Ciebie),
  diagram sekwencji i quiz.

## Partia v11: Bufory i przepływ danych (zmiany względem archiwum)
- **Bufor kołowy – korekta:** archiwalny kod `bufPush/bufPop` nie sprawdzał przepełnienia ani pustego bufora i nie odróżniał
  stanów „pusty” i „pełny” (`head == tail`). Nowa wersja zwraca `bool`, rezygnuje z jednego miejsca (pełny: `(head+1)&MASK == tail`),
  ma `volatile` na indeksach i komentarz o zasadzie jednego producenta i jednego konsumenta (ISR + `loop()`), a także
  o publikowaniu indeksu dopiero po zapisie danych. Dodano porównanie: odrzucić nowe czy nadpisać najstarsze.
- **Modulo a maska:** wyjaśniono, że `& (N-1)` działa tylko dla rozmiaru będącego potęgą dwójki (kompilator często sam to optymalizuje).
- **Ping-pong – korekta:** „100% gwarancji braku kolizji” zastąpiono dokładniejszym opisem: rozdzielenie odczytu i zapisu
  usuwa konflikt dostępu, ale nie chroni przed spóźnionym CPU (czas przetwarzania < czas napełnienia drugiego bufora, `N/fs`).
  Dodano kalkulator budżetu czasu.
- **DMA:** archiwum pisało „dostępne w ESP32, STM32”. Dodano, że nie ma go w ATmega328P (Arduino Uno), przykład circular DMA
  dla STM32 HAL (połówki bufora), opis idei dla ESP32 (tryb ciągły ADC; nazwy funkcji zależą od wersji – do sprawdzenia przez Ciebie)
  oraz wersję programową dla Uno. Uwaga o cache DMA w STM32F7/H7 (zaawansowane).
- Dodano symulator bufora kołowego (head/tail, tryby przepełnienia), diagram przepływu, kroki, diagram sekwencji i quiz.
- **Do sprawdzenia przez Ciebie:** przykład STM32 jest szkicem (nazwy callbacków HAL, konfiguracja DMA w CubeMX);
  zdanie o ESP32 nie podaje konkretnych funkcji celowo.

## Partia v12: animacje i kurs „Wielozadaniowość i niezawodność” (zmiany względem archiwum)
- **Polling a przerwanie:** statyczny schemat z archiwum („Jitter ≈ 0, absolutna precyzja”) zastąpiono interaktywną symulacją.
  Zdanie o zerowym jitterze złagodzono: opóźnienie przerwania to mikrosekundy (inne ISR, sekcje bez przerwań, cache ESP32).
- **Stos LIFO i ping-pong:** archiwalne rysunki zamieniono na animacje (stos z przepełnieniem i rekurencją, ping-pong z licznikiem
  przeciążeń i utraconych próbek). Dodano uwagę o stosie wywołań i stosach zadań FreeRTOS.
- **FreeRTOS/ESP32:** zasada „rdzeń 0 – sieć, rdzeń 1 – czujniki” opisana jako dobra praktyka, nie wymóg; dodano: stos zadania w bajtach
  (ESP32), obsługę pełnej kolejki, wersje `…FromISR`, układy jednordzeniowe (C3, S2), mutex, odwrócenie priorytetów. Symulator kolejki producent–konsument.
- **Watchdog:** „odcinając zasilanie” poprawiono na „reset układu”. Archiwalne `esp_task_wdt_init(3, true)` działa tylko w Arduino-ESP32 2.x;
  dodano wariant 3.x/IDF 5 (struktura konfiguracji) i AVR (`wdt_enable`). Dodano zasady, gdzie wolno „kopać”, oraz symulator.
- **Do sprawdzenia przez Ciebie:** nazwy funkcji watchdoga w zainstalowanej wersji rdzenia ESP32 (w 3.x użyj `esp_task_wdt_reconfigure`,
  jeśli watchdog jest już uruchomiony przez system) oraz piny/ADC w przykładzie FreeRTOS.
- Część „DMA” z sekcji o niezależności sprzętowej jest już w lekcji „Ping-pong i DMA” (v11), więc nie powielono jej.

## Partia v13: Interfejsy i protokoły, Sygnał i bezpieczeństwo pomiarów (zmiany względem archiwum)
- **Protokoły (UART/I2C/SPI/I2S):** tabela z archiwum zachowana, rozbudowana o schemat doboru, wady i zalety I2C, uwagę o poziomach
  napięć (konwerter dla I2C musi obsługiwać otwarty dren). Osobne lekcje z animacjami: ramka I2C (START, adres, R/W, ACK, dane, STOP),
  kalkulator rezystorów podciągających (Rmin z prądu 3 mA, Rmax z czasu narastania wg specyfikacji I2C) i skaner adresów;
  SPI jako dwa rejestry przesuwne, tryby CPOL/CPHA i przykład odczytu rejestru.
- **Izolacja galwaniczna:** dodano wyraźne zastrzeżenie, że to materiał edukacyjny, a nie instrukcja budowy wyrobu medycznego
  (IEC 60601-1, zasilanie bateryjne, izolator USB). Sformułowania „99% energii” i „zbija do 3,3 V” złagodzono (wartości zależą od elementów
  i impulsu). Dodano izolatory cyfrowe obok optoizolatorów oraz animację kaskady ochrony (wartości poglądowe).
- **Kondycjonowanie sygnału:** dodano symulator CMRR (przed i po wzmacniaczu różnicowym), kalkulator filtru RC z charakterystyką,
  uwagę, że 0,5 Hz dotyczy monitorowania (EKG diagnostyczne ok. 0,05 Hz), rolę filtru anty-aliasingowego i listę kontrolną odsprzęgania.
- **Do sprawdzenia przez Ciebie:** domyślne piny I2C ESP32 (21/22 dla klasycznego DevKit), wartości przykładowe filtrów
  oraz poprawność tez medycznych przed publikacją (materiał nie zastępuje norm).
- Sekcja „Typy pinów i poziomy logiczne” (s17) jest już w bazie z pilota, więc nie powielono jej.

## Poprawki widgetów v12–v13 (wprowadzone w v14)
- Animacje automatyczne (ramka I2C, SPI „Auto”, kaskada ochrony, stos „Rekurencja”, kolejka producent–konsument, ping-pong) mają listę
  „Tempo animacji” (wolno / normalnie / szybko), domyślnie wolno. Wcześniej działały zbyt szybko, żeby zdążyć przeczytać opisy.
- Ramka I2C i kaskada ochrony przewijają się poziomo na wąskich ekranach zamiast ściskać napisy. Poprawiono ucinanie napisów
  (etykieta „szczyt” stosu, ostatnia wartość osi w filtrze RC).

## Partia v14: Transmisja danych w praktyce (zmiany względem archiwum)
- **Pakietowanie:** liczby przeliczone z uwzględnieniem bajtu CRC w ramce (80 % i 17 % zamiast 78 % i 15 %); dodano kalkulator narzutu,
  opóźnienia N/fs i wymaganego łącza oraz uwagę o kolejności bajtów (little-endian).
- **CRC:** funkcja `calcCRC8` w archiwum robiła tylko XOR, więc nie była CRC. Lekcja wyjaśnia różnicę, podaje prawdziwe CRC-8 (wielomian 0x07)
  w C++ i Pythonie, a interaktywne demo pokazuje, że XOR nie wykrywa dwóch przekłamań w tej samej kolumnie. CRC liczone jest także
  z nagłówkiem. Detekcja luk (seq modulo 256) opisana wraz z ograniczeniem i uzupełnianiem braków interpolacją.
- **Kontrola przepływu:** symulator (bez kontroli, XON/XOFF, RTS/CTS, ACK) z opóźnieniem sygnału i progiem z histerezą.
  Złagodzono „złotą regułę” o nieopóźnianiu sygnału medycznego: to wybór projektowy dla podglądu na żywo, a przy zapisie offline można
  retransmitować i porządkować według znacznika czasu.
- **Łączność bezprzewodowa:** schemat wyboru, symulator MQTT z filtrami `+` i `#`, poziomy QoS, retained, uwaga o TLS i porcie 1883.
  Poprawiono: UDP nie ma retransmisji, ale Wi-Fi tak (jitter); Bluetooth Classic nie jest dostępny w każdym układzie (np. nie w C3/S3);
  zasada rdzenia 0 dla stosu Wi-Fi jako domyślne zachowanie, a nie reguła bezwzględna.
- **Do sprawdzenia przez Ciebie:** przykład PubSubClient (adres brokera, zależność od biblioteki) oraz zgodność wersji bibliotek.

## Uwagi ogólne
- Cudzysłowy: w nowych treściach używam polskich „…”. W archiwum są proste "…".
- Terminologia: proponuję słowniczek (bufor, ramka, próbka, przerwanie) i trzymanie się jednego tłumaczenia.
