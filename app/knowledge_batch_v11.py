"""Partia treści z archiwum (v11): kurs „Bufory i przepływ danych”, 2 lekcje (bufor kołowy, ping-pong i DMA).
Importowane jednorazowo jako propozycje „Do przeglądu” (knowledge_service.import_batches).
Zmiany merytoryczne względem archiwum: docs/WIEDZA-PILOTAZ.md (sekcja „Partia v11”)."""
from knowledge_batch_v8 import WIDGET_BASE
from knowledge_batch_v10 import quiz_widget

W_RING = WIDGET_BASE + """<style>button{background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:6px 12px;font:inherit;cursor:pointer;margin:0 6px 6px 0}button:hover{border-color:#56e1fd}select{background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:6px 8px;font:inherit}svg{max-height:200px}</style>
<div><button id="push">Push (zapis)</button><button id="pop">Pop (odczyt)</button><button id="rst">Wyczyść</button>
<label>Gdy bufor jest pełny:</label><select id="mode"><option value="drop">odrzuć nowy element</option><option value="over">nadpisz najstarszy</option></select>
<svg id="s" viewBox="0 0 260 200" width="100%" role="img" aria-label="Bufor kołowy 8 elementów"></svg>
<div class="out">head (zapis) = <b class="acc" id="h">0</b> · tail (odczyt) = <b class="acc" id="t">0</b> · zajęte: <b id="c">0</b> / 8<br><span id="m">Bufor pusty.</span></div></div>
<script>
var N=8,buf=[],head=0,tail=0,count=0,nextVal=1,NS='http://www.w3.org/2000/svg';
function $(i){return document.getElementById(i)}
function el(n,a){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);return e}
function draw(){var s=$('s');s.textContent='';var cx=130,cy=100,r=70;
 for(var i=0;i<N;i++){var a=-Math.PI/2+i*2*Math.PI/N,x=cx+r*Math.cos(a),y=cy+r*Math.sin(a);
  var used=false;for(var k=0;k<count;k++){if((tail+k)%N===i)used=true}
  s.appendChild(el('circle',{cx:x,cy:y,r:20,fill:used?'#0e3a4a':'#0d1117',stroke:used?'#56e1fd':'#30363d','stroke-width':2}));
  var t=el('text',{x:x,y:y+4,fill:used?'#e6edf3':'#6e7681','font-size':'12','text-anchor':'middle'});t.textContent=used?String(buf[i]):String(i);s.appendChild(t);
  var tag='';if(i===head)tag+='H';if(i===tail)tag+='T';
  if(tag){var l=el('text',{x:cx+(r+36)*Math.cos(a),y:cy+(r+36)*Math.sin(a)+4,fill:'#ff8c00','font-size':'12','text-anchor':'middle','font-weight':'bold'});l.textContent=tag;s.appendChild(l);}}
 $('h').textContent=head;$('t').textContent=tail;$('c').textContent=count;}
function msg(t,c){var m=$('m');m.textContent=t;m.className=c||''}
$('push').addEventListener('click',function(){
 if(count===N){if($('mode').value==='drop'){msg('Pełny – nowy element odrzucony.','bad');return}
  buf[head]=nextVal++;head=(head+1)%N;tail=head;msg('Pełny – nadpisano najstarszy element (tail przesunięty).','warn');draw();return}
 buf[head]=nextVal++;head=(head+1)%N;count++;msg('Zapisano. head przesunięty o 1.','ok');draw()});
$('pop').addEventListener('click',function(){
 if(count===0){msg('Pusty – nie ma czego czytać (head == tail i count == 0).','bad');return}
 var v=buf[tail];tail=(tail+1)%N;count--;msg('Odczytano wartość '+v+'. tail przesunięty o 1.','ok');draw()});
$('rst').addEventListener('click',function(){head=tail=count=0;nextVal=1;msg('Bufor pusty.');draw()});
draw();
</script>"""

W_PINGPONG = WIDGET_BASE + """<div><label>Rozmiar jednego bufora: <b class="acc" id="nv">256</b> próbek</label><input type="range" id="n" min="16" max="2048" step="16" value="256">
<label>Częstotliwość próbkowania: <b class="acc" id="fv">44000</b> Hz</label><input type="range" id="f" min="1000" max="96000" step="1000" value="44000">
<label>Czas przetwarzania jednego bufora przez CPU [ms]</label><input type="number" id="p" min="0" max="500" step="0.5" value="3">
<div class="out">Czas napełnienia bufora (budżet CPU): <b class="ok" id="t"></b> ms<br>Wykorzystanie budżetu: <b id="u"></b>%<div class="bar"><i id="b"></i></div><div id="v" style="margin-top:8px"></div></div></div>
<script>
function $(i){return document.getElementById(i)}
function calc(){var n=+$('n').value,f=+$('f').value,p=parseFloat($('p').value)||0;$('nv').textContent=n;$('fv').textContent=f;
 var t=n/f*1000,u=p/t*100;$('t').textContent=t.toFixed(2);$('u').textContent=u.toFixed(0);
 var b=$('b');b.style.width=Math.min(100,u)+'%';b.style.background=u>100?'#f85149':u>70?'#ff8c00':'#3fb950';
 $('v').textContent=u>100?'CPU nie zdąży: dane z drugiego bufora zaczną nadpisywać niewysłane – dojdzie do utraty próbek.':u>70?'Mały zapas – każde dodatkowe zadanie może spowodować utratę próbek.':'Zapas czasu jest bezpieczny.';
 $('v').className=u>100?'bad':u>70?'warn':'ok';}
['n','f','p'].forEach(function(x){$(x).addEventListener('input',calc)});calc();
</script>"""

W_QUIZ_BUF = quiz_widget([
    {"q": "Który bufor pasuje do kolejkowania znaków odbieranych z UART?", "a": ["LIFO (stos)", "FIFO (bufor kołowy)", "Żaden, wystarczy jedna zmienna", "Ping-pong z dwoma tablicami po 1 MB"], "ok": 1,
     "e": "Znaki muszą być przetwarzane w kolejności nadejścia, a bufor kołowy nie wymaga przesuwania danych ani realokacji."},
    {"q": "W buforze kołowym o rozmiarze N zapis i odczyt dają head == tail. Co to oznacza?", "a": ["Zawsze, że bufor jest pusty", "Zawsze, że bufor jest pełny", "Pusty albo pełny – potrzebny jest dodatkowy licznik lub zasada „jedno wolne miejsce”", "Błąd programu"], "ok": 2,
     "e": "Same wskaźniki nie odróżnią stanu pustego od pełnego. Stosuje się licznik elementów albo rezygnuje z jednego miejsca."},
    {"q": "Po co w ping-pongu CPU przetwarza jeden bufor, gdy sprzęt zapisuje drugi?", "a": ["Aby oszczędzić pamięć", "Aby odczyt i zapis nie dotyczyły tych samych danych jednocześnie", "Aby DMA działało szybciej", "To wymóg ADC"], "ok": 1,
     "e": "Bufory są rozdzielone, więc nie ma wyścigu o dane – pod warunkiem, że CPU zdąży przed zakończeniem napełniania drugiego."},
])

LESSON_RING = """:::summary Szybkie podsumowanie
- **Bufor** to „poczekalnia” w RAM między szybkim producentem danych (np. ISR timera, UART) a wolniejszym konsumentem (np. wysyłka przez Wi-Fi).
- **FIFO** zachowuje kolejność; najczęściej realizuje go **bufor kołowy** (ring buffer) – stała tablica i dwa indeksy `head` i `tail`.
- Same indeksy nie odróżniają bufora pustego od pełnego – potrzebny jest licznik albo zasada „jedno miejsce zawsze wolne”.
- Gdy zapisuje ISR, a czyta `loop()`, indeksy muszą być `volatile`, a każdy z nich może zmieniać tylko jedna strona.
:::

## Trzy rodzaje buforów

| Typ | Zasada | Typowe zastosowanie |
|---|---|---|
| **LIFO (stos)** | Ostatnie weszło, pierwsze wychodzi | Stos wywołań funkcji, cofanie operacji, parsowanie wyrażeń |
| **FIFO / bufor kołowy** | Pierwsze weszło, pierwsze wychodzi | Znaki z UART, próbki z czujników, kolejki zdarzeń |
| **Ping-pong** | Dwa bufory zamieniane rolami | Audio, ADC z DMA, wyświetlacze (następna lekcja) |

W akwizycji sygnałów stos prawie się nie pojawia, natomiast FIFO jest wszędzie, bo dane muszą być przetwarzane w kolejności pomiaru.

## Jak działa bufor kołowy

Tablica ma stały rozmiar. **head** wskazuje, gdzie zapisać następny element, **tail** – skąd odczytać najstarszy. Po dojściu do końca tablicy indeks wraca na początek (stąd „kołowy”). Nie przesuwamy żadnych danych i nie alokujemy pamięci w trakcie działania, dzięki czemu operacje trwają stały, krótki czas.

Wypróbuj: zapisuj i odczytuj elementy, a potem wypełnij bufor i zobacz, co dzieje się w obu trybach przepełnienia.

:::widget ring-symulator 440
:::

:::warn Pełny czy pusty?
Gdy `head == tail`, bufor może być pusty **albo** pełny (po zapisaniu N elementów head wraca na tail). Są dwa standardowe rozwiązania: osobny licznik `count` albo rezygnacja z jednego miejsca – wtedy `head == tail` oznacza zawsze pusty, a pełny to `(head + 1) % N == tail`. Kod z wcześniejszej wersji lekcji nie sprawdzał tych warunków i przy przepełnieniu po cichu psuł dane.
:::

## Implementacja z kontrolą przepełnienia

```cpp Bufor kołowy – jedno miejsce wolne
const uint16_t BUF_SIZE = 256;            // potęga dwójki: można użyć maski zamiast %
const uint16_t MASK = BUF_SIZE - 1;

int16_t ringBuf[BUF_SIZE];
volatile uint16_t head = 0;               // zmienia tylko producent (np. ISR)
volatile uint16_t tail = 0;               // zmienia tylko konsument (np. loop)

bool bufPush(int16_t val) {               // wywołuje producent
  uint16_t next = (head + 1) & MASK;
  if (next == tail) return false;         // pełny – element odrzucony
  ringBuf[head] = val;
  head = next;                            // indeks publikujemy dopiero po zapisie danych
  return true;
}

bool bufPop(int16_t &val) {               // wywołuje konsument
  if (tail == head) return false;         // pusty
  val = ringBuf[tail];
  tail = (tail + 1) & MASK;
  return true;
}
```

:::note Dlaczego maska zamiast modulo
Gdy rozmiar jest potęgą dwójki, `(i + 1) & (N - 1)` daje ten sam wynik co `(i + 1) % N`, ale na prostych rdzeniach (np. AVR) jest szybsze, bo nie wymaga dzielenia. Kompilatory często same to optymalizują, jednak przy zmiennym rozmiarze trzeba wrócić do `%`.
:::

:::danger Współdzielenie z ISR
Powyższy kod jest bezpieczny tylko przy **jednym producencie i jednym konsumencie**, z których każdy zmienia wyłącznie „swój” indeks, a indeksy mieszczą się w jednym słowie procesora (na 8-bitowym AVR użyj `uint8_t`, a przy większych rozmiarach odczytuj indeks z blokadą przerwań). Przy kilku producentach lub konsumentach potrzebna jest synchronizacja (blokada przerwań lub mechanizmy RTOS, np. kolejka FreeRTOS).
:::

## Co robić przy przepełnieniu

:::pros ODRZUĆ NOWE
- zachowuje najstarsze dane i ich ciągłość
- prosty, bezpieczny przy ISR
- pasuje do komend i znaków z UART
:::

:::cons NADPISZ NAJSTARSZE
- zmienia tail po stronie producenta (wymaga ostrożności przy ISR)
- gubi stare dane, ale zawsze mamy najświeższe
- pasuje do logów „ostatnie N pomiarów”
:::

:::checklist
- [ ] Rozmiar bufora policzony z najgorszego opóźnienia konsumenta (czas × tempo napływu danych)
- [ ] Obsłużono stan pełny i pusty (wartość zwracana, licznik lub flaga błędu)
- [ ] Indeksy współdzielone z ISR są `volatile`
- [ ] Każdy indeks zmienia tylko jedna strona
:::

## Sprawdź się

:::widget quiz-bufory 330
:::
"""

LESSON_PINGPONG = """:::summary Szybkie podsumowanie
- **Ping-pong (podwójne buforowanie)** to dwa bufory: sprzęt wypełnia jeden, a procesor w tym czasie przetwarza drugi. Po zakończeniu obie strony zamieniają się rolami.
- Odczyt i zapis nie dotyczą tych samych danych, więc nie ma wyścigu o dostęp – **pod warunkiem, że CPU zdąży przed napełnieniem drugiego bufora**.
- **DMA** przenosi dane między peryferium a RAM bez udziału rdzenia; rdzeń dostaje przerwanie dopiero po zakończeniu bloku (lub jego połowy).
- Czas napełnienia bufora to `N / fs` – to budżet czasu CPU na przetworzenie poprzedniego bloku.
:::

## Problem, który rozwiązuje ping-pong

Przy ciągłym próbkowaniu (audio, EKG, I2S) dane napływają bez przerwy. Jeśli CPU czyta ten sam bufor, który sprzęt właśnie zapisuje, odczyta fragmenty „starych” i „nowych” próbek. Dwa bufory rozdzielają te role: sprzęt pisze do **A (ping)**, CPU czyta **B (pong)**, a gdy A się zapełni – zamiana.

:::flow Cykl życia bufora ping-pong
(s) Start
[a] DMA zapisuje do bufora A
[b] CPU przetwarza bufor B
{c} A pełny?
[d] Zamiana ról (swap)
s -> a
a -> b
b -> c
c -> d : tak
c -> b : nie
d -> a
:::

## Kolejność operacji

:::steps Od pomiaru do wysyłki
ADC mierzy | Przetwornik próbkuje sygnał, zwykle wyzwalany sprzętowo przez timer
DMA zapisuje | Kontroler DMA przenosi każdy wynik do kolejnej komórki bufora A
Przerwanie „pełny” | Po zapełnieniu bloku DMA zgłasza przerwanie
CPU przetwarza | Rdzeń przejmuje pełny bufor, a DMA zapisuje już do drugiego
:::

:::sequence Ping-pong w czasie
ADC+DMA, ISR, loop
ADC+DMA -> ADC+DMA : zapis do A
ADC+DMA -> ISR : A pełny
ISR -> ISR : ready = A, zapis przełączony na B
ISR --> loop : powrót
loop -> loop : przetwarzanie A, a DMA pisze do B
:::

:::info Czym jest DMA
**DMA (Direct Memory Access)** to sprzętowy kontroler, który kopiuje dane między peryferium a pamięcią (lub pamięcią a pamięcią) bez angażowania rdzenia. Konfigurujesz źródło, cel i liczbę elementów, a rdzeń dostaje przerwanie po zakończeniu. W tym czasie może obsługiwać sieć, liczyć albo spać, co oszczędza energię. DMA jest dostępne w STM32 i ESP32 oraz w wielu innych układach (nie ma go np. w ATmega328P z Arduino Uno).
:::

## Budżet czasu

Zmieniaj rozmiar bufora, częstotliwość próbkowania i czas przetwarzania. Gdy przetwarzanie trwa dłużej niż napełnianie drugiego bufora, tracisz próbki.

:::widget pingpong-budzet 400
:::

:::stats
Bufor | 256 | próbek | accent
fs | 44100 | Hz | green
Czas napełnienia | 5.8 | ms | orange
:::

## Przykład: ADC + DMA

W praktyce kod zależy od platformy. Poniżej uproszczony schemat obsługi przerwań „połowa” i „całość” (tzw. circular DMA), gdzie jeden bufor jest dzielony na dwie połówki pełniące rolę ping i pong.

:::tabs
=== STM32 (HAL)
```c Circular DMA – dwie połówki bufora
#define N 512
uint16_t adcBuf[N];                      // pierwsza połowa = ping, druga = pong
volatile uint8_t ready = 0;              // 1 = pierwsza połowa gotowa, 2 = druga

// start: HAL_ADC_Start_DMA(&hadc1, (uint32_t*)adcBuf, N);

void HAL_ADC_ConvHalfCpltCallback(ADC_HandleTypeDef *h) { ready = 1; }
void HAL_ADC_ConvCpltCallback(ADC_HandleTypeDef *h)     { ready = 2; }

void loop_task(void) {
  if (ready) {
    uint16_t *part = (ready == 1) ? &adcBuf[0] : &adcBuf[N / 2];
    ready = 0;
    process(part, N / 2);                // musi zakończyć się przed kolejnym callbackiem
  }
}
```
=== ESP32 (idea)
Na ESP32 odpowiednikiem jest tryb ciągły ADC (`adc_continuous` w ESP-IDF; w Arduino-ESP32 3.x funkcje `analogContinuous`). Sterownik sam wypełnia bufory przez DMA i zgłasza zakończenie ramki, a Ty odbierasz gotowy blok w osobnym zadaniu FreeRTOS. Nazwy funkcji zmieniają się między wersjami, więc sprawdź dokumentację zainstalowanej wersji.
=== Arduino Uno
ATmega328P nie ma DMA. Ping-pong można zrealizować programowo: ISR timera wpisuje próbki do aktywnego bufora, a po jego zapełnieniu przełącza wskaźnik i ustawia flagę. To działa, ale rdzeń obsługuje każdą próbkę, więc zysk dotyczy tylko rozdzielenia odczytu i zapisu, nie odciążenia CPU.
:::

:::warn Nie „100% gwarancji”
Ping-pong usuwa konflikt dostępu do tych samych danych, ale **nie** zabezpiecza przed spóźnionym CPU. Jeśli przetwarzanie trwa dłużej niż napełnianie drugiego bufora, dane zostaną nadpisane albo zgubione. Gwarancja dotyczy więc tylko rozdziału odczytu od zapisu, a czas musisz sprawdzić (kalkulator wyżej).
:::

:::details Cache i wyrównanie (zaawansowane)
W układach z pamięcią podręczną (np. STM32F7/H7) bufor DMA trzeba wyrównać do linii cache i przed odczytem unieważnić cache, inaczej CPU zobaczy stare dane. W prostych MCU (Cortex-M0/M3/M4, AVR, ESP32 z domyślną konfiguracją) ten problem zwykle nie występuje.
:::

## Sprawdź się

:::widget quiz-bufory 330
:::
"""

COURSES = [{"slug": "bufory-i-przeplyw-danych", "title": "Bufory i przepływ danych", "level": "intermediate", "position": 2,
            "summary": "Jak bezpiecznie przekazywać dane między ISR, DMA i programem głównym: bufor kołowy i podwójne buforowanie."}]

ARTICLES = [
    {"slug": "bufor-kolowy-ring-buffer", "kind": "lesson", "course": "bufory-i-przeplyw-danych", "position": 1, "level": "intermediate",
     "title": "Bufory i bufor kołowy (ring buffer)", "summary": "Rodzaje buforów, działanie bufora kołowego, obsługa pełnego i pustego stanu oraz bezpieczne użycie z przerwaniami.",
     "tags": ["bufor", "fifo", "ring buffer", "isr"], "body": LESSON_RING,
     "widgets": {"ring-symulator": W_RING, "quiz-bufory": W_QUIZ_BUF}},
    {"slug": "ping-pong-i-dma", "kind": "lesson", "course": "bufory-i-przeplyw-danych", "position": 2, "level": "advanced",
     "title": "Ping-pong i DMA", "summary": "Podwójne buforowanie, przenoszenie danych przez DMA, budżet czasu CPU i przykłady dla STM32, ESP32 oraz Arduino Uno.",
     "tags": ["dma", "ping-pong", "adc", "bufor"], "body": LESSON_PINGPONG,
     "widgets": {"pingpong-budzet": W_PINGPONG, "quiz-bufory": W_QUIZ_BUF}},
]
