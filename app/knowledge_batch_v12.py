"""Partia treści z archiwum (v12): animacje uzupełniające istniejące kursy + nowy kurs „Wielozadaniowość i niezawodność”.
Importowane jednorazowo jako propozycje „Do przeglądu”. Zmiany merytoryczne: docs/WIEDZA-PILOTAZ.md („Partia v12”)."""
from knowledge_batch_v8 import WIDGET_BASE
from knowledge_batch_v10 import quiz_widget

BTN = ("<style>button{background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:6px 12px;font:inherit;cursor:pointer;margin:0 6px 6px 0}"
       "button:hover{border-color:#56e1fd}button.on{border-color:#56e1fd;color:#56e1fd}svg{display:block;max-height:220px}"
       ".cells{display:flex;flex-wrap:wrap;gap:3px;margin:6px 0}.cells i{width:18px;height:18px;border-radius:4px;background:#161b22;border:1px solid #30363d}"
       ".cells i.f{background:#0e3a4a;border-color:#56e1fd}.cells i.w{background:#1d3b24;border-color:#3fb950}.cells i.p{background:#3a2a0e;border-color:#ff8c00}</style>")

# ── kolejka producent–konsument (FreeRTOS) ──
W_QUEUE = WIDGET_BASE + BTN + """<div><label>Producent (zadanie czujnika): <b class="acc" id="pv">500</b> próbek/s</label><input type="range" id="p" min="50" max="2000" step="50" value="500">
<label>Konsument (zadanie komunikacji): <b class="acc" id="cv">400</b> próbek/s</label><input type="range" id="c" min="50" max="2000" step="50" value="400">
<label>Rozmiar kolejki: <b class="acc" id="qv">32</b></label><input type="range" id="q" min="8" max="64" step="8" value="32">
<button id="go">Start</button><button id="rs">Reset</button>
<div class="cells" id="cells"></div>
<div class="out">W kolejce: <b id="n">0</b> · przesłano: <b class="ok" id="d">0</b> · utracono: <b class="bad" id="l">0</b><div class="bar"><i id="b"></i></div><div id="m" style="margin-top:8px">Naciśnij Start.</div></div></div>
<script>
function $(i){return document.getElementById(i)}
var run=false,timer=null,n=0,done=0,lost=0,ap=0,ac=0;
function size(){return +$('q').value}
function draw(){$('pv').textContent=$('p').value;$('cv').textContent=$('c').value;$('qv').textContent=size();
 var c=$('cells');c.textContent='';for(var i=0;i<size();i++){var e=document.createElement('i');if(i<n)e.className='f';c.appendChild(e)}
 $('n').textContent=n;$('d').textContent=done;$('l').textContent=lost;
 var u=n/size()*100,b=$('b');b.style.width=u+'%';b.style.background=u>=100?'#f85149':u>70?'#ff8c00':'#3fb950';
 var p=+$('p').value,cc=+$('c').value,m=$('m');
 if(lost>0){m.textContent='Kolejka się przepełniła: xQueueSend z timeoutem 0 zwraca błąd i próbka przepada.';m.className='bad'}
 else if(p>cc){m.textContent='Producent jest szybszy od konsumenta, więc kolejka urośnie i w końcu się zapełni.';m.className='warn'}
 else{m.textContent='Konsument nadąża: kolejka zostaje krótka.';m.className='ok'}}
function tick(){ap+=(+$('p').value)*0.05;ac+=(+$('c').value)*0.05;
 while(ap>=1){ap-=1;if(n<size())n++;else lost++}
 while(ac>=1){ac-=1;if(n>0){n--;done++}}
 draw()}
$('go').addEventListener('click',function(){run=!run;$('go').textContent=run?'Pauza':'Start';clearInterval(timer);if(run)timer=setInterval(tick,50)});
$('rs').addEventListener('click',function(){n=done=lost=0;ap=ac=0;draw()});
['p','c','q'].forEach(function(x){$(x).addEventListener('input',draw)});draw();
</script>"""

# ── watchdog ──
W_WDT = WIDGET_BASE + BTN + """<div><label>Timeout watchdoga: <b class="acc" id="tv">3</b> s</label><input type="range" id="t" min="1" max="8" value="3">
<button id="kick">Kopnij psa (reset licznika)</button><button id="hang">Zawieś program</button><button id="auto" class="on">Auto-kopanie w pętli: włączone</button>
<svg id="s" viewBox="0 0 300 40" width="100%" role="img" aria-label="Odliczanie watchdoga"><rect x="0" y="12" width="300" height="16" rx="8" fill="#21262d"/><rect id="f" x="0" y="12" width="300" height="16" rx="8" fill="#3fb950"/></svg>
<div class="out">Pozostało: <b id="r" class="acc"></b> s · restartów: <b class="bad" id="n">0</b><br><span id="m"></span></div></div>
<script>
function $(i){return document.getElementById(i)}
var left=3,hung=false,auto=true,resets=0,sinceKick=0,T=3;
function render(){$('tv').textContent=$('t').value;$('r').textContent=Math.max(0,left).toFixed(1);var u=Math.max(0,left)/T;var f=$('f');f.setAttribute('width',300*u);f.setAttribute('fill',u<0.3?'#f85149':u<0.6?'#ff8c00':'#3fb950');$('n').textContent=resets;
 $('m').textContent=hung?'Program zawieszony (np. nieskończona pętla): nikt nie kopie psa, więc zbliża się restart.':auto?'Pętla działa i regularnie kopie watchdoga.':'Auto-kopanie wyłączone: musisz kopać ręcznie.';$('m').className=hung?'bad':'ok'}
$('t').addEventListener('input',function(){T=+$('t').value;left=Math.min(left,T);render()});
$('kick').addEventListener('click',function(){if(!hung){left=T}render()});
$('hang').addEventListener('click',function(){hung=true;render()});
$('auto').addEventListener('click',function(){auto=!auto;$('auto').className=auto?'on':'';$('auto').textContent='Auto-kopanie w pętli: '+(auto?'włączone':'wyłączone');render()});
setInterval(function(){left-=0.1;sinceKick+=0.1;if(auto&&!hung&&sinceKick>=0.5){left=T;sinceKick=0}
 if(left<=0){resets++;hung=false;left=T;sinceKick=0;$('m').textContent='WATCHDOG: twardy reset, system wstaje od nowa.';$('m').className='bad';$('r').textContent='0.0';$('n').textContent=resets;return}
 render()},100);render();
</script>"""

# ── jitter: polling a przerwanie ──
W_JITTER = WIDGET_BASE + BTN + """<div><label>Okres próbkowania: <b class="acc">2 ms</b> (500 Hz)</label>
<label>Najdłuższa blokada pętli (np. wysyłka, delay): <b class="acc" id="dv">4</b> ms</label><input type="range" id="d" min="0" max="20" step="0.5" value="4">
<button id="go">Symuluj 150 próbek</button>
<svg id="s" viewBox="0 0 320 130" width="100%" role="img" aria-label="Błąd momentu próbkowania"></svg>
<div class="out">Polling: błąd do <b class="bad" id="pm"></b> ms (RMS <span id="pr"></span> ms)<br>Przerwanie: błąd do <b class="ok" id="im"></b> ms (RMS <span id="ir"></span> ms)</div></div>
<script>
function $(i){return document.getElementById(i)}
var NS='http://www.w3.org/2000/svg';
function line(pts,col){var e=document.createElementNS(NS,'polyline');e.setAttribute('points',pts.join(' '));e.setAttribute('fill','none');e.setAttribute('stroke',col);e.setAttribute('stroke-width','1.3');return e}
function sim(){var D=+$('d').value;$('dv').textContent=D;var N=150,P=2,t=0,pe=[],ie=[];
 for(var k=1;k<=N;k++){var nominal=k*P;
  // polling: pętla wykonuje kolejne obiegi o losowym czasie 0..D ms; próbka dopiero w pierwszym obiegu po terminie
  while(t<nominal)t+=0.05+Math.random()*D;
  pe.push(t-nominal);
  // przerwanie: opóźnienie rzędu mikrosekund (0..0.02 ms)
  ie.push(Math.random()*0.02);}
 var mx=Math.max.apply(null,pe)||1,sc=Math.max(1,mx),s=$('s');s.textContent='';
 var a=[],b=[];for(var i=0;i<N;i++){var x=i*320/N;a.push(x.toFixed(1)+','+(120-pe[i]/sc*110).toFixed(1));b.push(x.toFixed(1)+','+(120-ie[i]/sc*110).toFixed(1))}
 var ax=document.createElementNS(NS,'line');ax.setAttribute('x1',0);ax.setAttribute('x2',320);ax.setAttribute('y1',120);ax.setAttribute('y2',120);ax.setAttribute('stroke','#30363d');s.appendChild(ax);
 s.appendChild(line(a,'#f85149'));s.appendChild(line(b,'#3fb950'));
 var tx=document.createElementNS(NS,'text');tx.setAttribute('x',4);tx.setAttribute('y',12);tx.setAttribute('fill','#9fb0c3');tx.setAttribute('font-size','10');tx.textContent='skala: '+sc.toFixed(2)+' ms (czerwony: polling, zielony: przerwanie)';s.appendChild(tx);
 function rms(a){return Math.sqrt(a.reduce(function(s,v){return s+v*v},0)/a.length)}
 $('pm').textContent=mx.toFixed(2);$('pr').textContent=rms(pe).toFixed(2);$('im').textContent=Math.max.apply(null,ie).toFixed(3);$('ir').textContent=rms(ie).toFixed(3)}
$('go').addEventListener('click',sim);$('d').addEventListener('input',sim);sim();
</script>"""

# ── stos LIFO ──
W_STACK = WIDGET_BASE + BTN + """<div><button id="push">Push</button><button id="pop">Pop</button><button id="rec">Rekurencja (wywołuj funkcję w funkcji)</button><button id="rs">Wyczyść</button>
<svg id="s" viewBox="0 0 300 190" width="100%" role="img" aria-label="Stos LIFO"></svg>
<div class="out" id="m">Stos pusty. Pojemność: 6 elementów.</div></div>
<script>
var CAP=6,st=[],cnt=1,NS='http://www.w3.org/2000/svg',timer=null;
function $(i){return document.getElementById(i)}
function el(n,a){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);return e}
function msg(t,c){$('m').textContent=t;$('m').className='out '+(c||'')}
function draw(){var s=$('s');s.textContent='';s.appendChild(el('path',{d:'M90 10 L90 180 L210 180 L210 10',fill:'none',stroke:'#30363d','stroke-width':3}));
 for(var i=0;i<st.length;i++){var y=180-(i+1)*27;var top=i===st.length-1;s.appendChild(el('rect',{x:96,y:y,width:108,height:24,rx:5,fill:top?'#0e3a4a':'#161b22',stroke:top?'#56e1fd':'#30363d'}));
  var t=el('text',{x:150,y:y+16,fill:top?'#e6edf3':'#9fb0c3','font-size':'12','text-anchor':'middle'});t.textContent=st[i];s.appendChild(t)}
 var l=el('text',{x:222,y:20,fill:'#ff8c00','font-size':'11'});l.textContent='szczyt: '+(st.length?st[st.length-1]:'-');s.appendChild(l);}
function push(v){if(st.length>=CAP){msg('STACK OVERFLOW: brak miejsca. W mikrokontrolerze to zwykle zawieszenie lub restart.','bad');clearInterval(timer);return false}st.push(v);msg('Push '+v+'. Ostatni wszedł, pierwszy wyjdzie.','ok');draw();return true}
$('push').addEventListener('click',function(){push('Dane #'+cnt++)});
$('pop').addEventListener('click',function(){clearInterval(timer);if(!st.length){msg('Stos pusty: nie ma czego zdjąć (underflow).','bad');return}var v=st.pop();msg('Pop: zdjęto '+v+' (zawsze element z wierzchu).','ok');draw()});
$('rs').addEventListener('click',function(){clearInterval(timer);st=[];cnt=1;msg('Stos pusty. Pojemność: 6 elementów.');draw()});
$('rec').addEventListener('click',function(){clearInterval(timer);var d=st.length;timer=setInterval(function(){d++;if(!push('f() wywołanie '+d)){}},450)});
draw();
</script>"""

# ── animacja ping-pong ──
W_PPANIM = WIDGET_BASE + BTN + """<div><label>Szybkość zapisu (sprzęt/DMA): <b class="acc" id="wv">8</b> próbek/s</label><input type="range" id="w" min="2" max="20" value="8">
<label>Szybkość przetwarzania (CPU): <b class="acc" id="rv">10</b> próbek/s</label><input type="range" id="r" min="2" max="20" value="10">
<button id="go">Start</button><button id="rs">Reset</button>
<div>Bufor A <span id="ra" class="acc"></span><div class="cells" id="ca"></div></div><div>Bufor B <span id="rb" class="acc"></span><div class="cells" id="cb"></div></div>
<div class="out">Zamian: <b class="ok" id="sw">0</b> · przeciążeń (CPU nie zdążył): <b class="bad" id="ov">0</b> · utraconych próbek: <b class="bad" id="ls">0</b><div id="m" style="margin-top:6px"></div></div></div>
<script>
function $(i){return document.getElementById(i)}
var N=8,wr='A',cw=0,cr=0,swaps=0,over=0,lost=0,aw=0,ar=0,run=false,timer=null;
// wr = bufor aktualnie zapisywany (cw zajętych komórek); drugi bufor jest czytany przez CPU (cr komórek do przetworzenia)
function cells(id,n,cls){var c=$(id);c.textContent='';for(var i=0;i<N;i++){var e=document.createElement('i');if(i<n)e.className=cls;c.appendChild(e)}}
function draw(){$('wv').textContent=$('w').value;$('rv').textContent=$('r').value;
 cells('ca',wr==='A'?cw:cr,wr==='A'?'w':'p');cells('cb',wr==='B'?cw:cr,wr==='B'?'w':'p');
 $('ra').textContent=wr==='A'?'(zapis, zielony)':'(odczyt CPU, pomarańczowy)';$('rb').textContent=wr==='B'?'(zapis, zielony)':'(odczyt CPU, pomarańczowy)';
 $('sw').textContent=swaps;$('ov').textContent=over;$('ls').textContent=lost;
 var w=+$('w').value,r=+$('r').value;$('m').textContent=r>=w?'CPU przetwarza szybciej niż sprzęt zapisuje, więc ping-pong działa bez strat.':'CPU jest wolniejszy niż napływ danych: będą przeciążenia i utrata próbek.';$('m').className=r>=w?'ok':'bad'}
function tick(){aw+=(+$('w').value)*0.1;ar+=(+$('r').value)*0.1;
 while(aw>=1){aw-=1;cw++;
  if(cw>=N){if(cr>0){over++;lost+=cr}swaps++;cr=N;cw=0;wr=wr==='A'?'B':'A'}}
 while(ar>=1){ar-=1;if(cr>0)cr--}
 draw()}
$('go').addEventListener('click',function(){run=!run;$('go').textContent=run?'Pauza':'Start';clearInterval(timer);if(run)timer=setInterval(tick,100)});
$('rs').addEventListener('click',function(){wr='A';cw=cr=0;swaps=over=lost=0;aw=ar=0;draw()});
['w','r'].forEach(function(x){$(x).addEventListener('input',draw)});draw();
</script>"""

W_QUIZ_RTOS = quiz_widget([
    {"q": "Do czego w FreeRTOS służy kolejka (queue)?", "a": ["Do przyspieszania procesora", "Do bezpiecznego przekazywania danych między zadaniami lub z ISR", "Do zmiany priorytetu zadania", "Do odliczania czasu"], "ok": 1,
     "e": "Kolejka kopiuje dane i synchronizuje producenta z konsumentem, bez ręcznej obsługi blokad."},
    {"q": "Co robi watchdog, gdy program przestanie go „kopać”?", "a": ["Wysyła powiadomienie e-mail", "Wykonuje restart układu", "Przyspiesza zegar", "Nic, to tylko licznik"], "ok": 1,
     "e": "Po upływie timeoutu watchdog wymusza reset, żeby urządzenie wróciło do pracy bez ingerencji człowieka."},
    {"q": "Gdzie bezpiecznie „kopać” watchdoga?", "a": ["W przerwaniu timera, zawsze co 100 ms", "W miejscu, które wykonuje się tylko, gdy główna praca programu faktycznie działa", "Na początku setup(), raz", "W dowolnym miejscu"], "ok": 1,
     "e": "Jeśli kopiesz z niezależnego przerwania, watchdog nie wykryje zawieszenia pętli głównej."},
])

LESSON_JITTER = """:::summary Szybkie podsumowanie
- **Polling** (sprawdzanie czasu w `loop()`) jest tak dokładny, jak długo trwa jeden obieg pętli. Każda blokada (wysyłka, `delay()`) opóźnia próbkę.
- **Przerwanie timera** zgłasza się sprzętowo, więc opóźnienie to zwykle mikrosekundy, niezależnie od tego, co robi `loop()`.
- Różnica momentu próbkowania od ideału to **jitter**. Przy próbkowaniu sygnału (EKG, audio) jitter wprowadza zniekształcenia.
:::

## Dwa sposoby na „co 2 ms”

:::tabs
=== Polling
```cpp Sprawdzanie czasu w pętli
unsigned long prev = 0;
void loop() {
  if (micros() - prev >= 2000) {
    prev += 2000;
    sampleNow();
  }
  doOtherWork();   // jeśli to trwa 5 ms, próbka spóźni się o kilka ms
}
```
=== Przerwanie
```cpp Timer zgłasza flagę
volatile bool tick = false;
void IRAM_ATTR onTimer() { tick = true; }   // na AVR: bez IRAM_ATTR

void loop() {
  if (tick) { tick = false; sampleNow(); }
}
```
:::

Przykład z przerwaniem nadal próbkuje w pętli, ale **moment** sygnału wyznacza timer. Jeśli chcesz mieć dokładny moment pomiaru, ADC powinien być wyzwalany sprzętowo, a w ISR (lub przez DMA) zapisywać wynik.

## Zobacz, skąd bierze się jitter

Suwak zmienia najdłuższą blokadę pętli. Czerwona linia to błąd momentu próbkowania w pollingu, zielona w przerwaniu.

:::widget jitter-symulator 460
:::

:::flow Przepływ sterowania
(s) Timer: minął okres
{a} Metoda?
[b] Polling: czeka na koniec bieżącego obiegu
[c] Przerwanie: CPU natychmiast skacze do ISR
[d] Próbka z opóźnieniem
[e] Próbka z opóźnieniem rzędu µs
s -> a
a -> b : polling
a -> c : przerwanie
b -> d
c -> e
:::

:::warn „Jitter ≈ 0” to uproszczenie
Opóźnienie przerwania nie jest zerowe: zależy od czasu dokończenia bieżącej instrukcji, od innych przerwań o wyższym lub równym priorytecie oraz od sekcji z wyłączonymi przerwaniami (`noInterrupts()`). Na ESP32 dochodzą jeszcze ograniczenia pamięci cache (stąd `IRAM_ATTR`). Zwykle to mikrosekundy i jest to wartość mała oraz przewidywalna, ale nie zerowa.
:::

:::checklist
- [ ] Moment pomiaru wyznacza timer sprzętowy, nie czas obiegu pętli
- [ ] ISR jest krótki (flaga, zapis do bufora)
- [ ] Przetwarzanie i wysyłka w `loop()` lub w zadaniu RTOS
:::
"""

LESSON_ANIM = """:::summary Szybkie podsumowanie
- **Stos (LIFO)**: ostatni element, który wszedł, wychodzi pierwszy. Tak działa stos wywołań funkcji, więc zbyt głęboka rekurencja kończy się przepełnieniem stosu.
- **Ping-pong**: dwa bufory zamieniają się rolami; sprzęt zapisuje jeden, a CPU czyta drugi.
- Obie struktury da się zrozumieć szybciej, gdy zobaczy się je w ruchu. Poniżej są dwie animacje do wypróbowania.
:::

## Stos (LIFO)

Dodawaj i zdejmuj elementy. Zauważ, że dostępny jest tylko szczyt stosu. Przycisk „Rekurencja” pokazuje, co się dzieje, gdy każda funkcja wywołuje kolejną bez końca.

:::widget stos-lifo 420
:::

:::note Stos wywołań na mikrokontrolerze
Każde wywołanie funkcji odkłada na stosie adres powrotu i zmienne lokalne. Na ATmega328P cały RAM to 2 KB, więc rekurencja albo duże tablice lokalne szybko go wyczerpują. W FreeRTOS każde zadanie ma własny, stały stos (rozmiar podajesz przy tworzeniu zadania), a jego przepełnienie psuje inne dane lub restartuje układ.
:::

## Ping-pong w ruchu

Zielony bufor jest zapisywany przez sprzęt, pomarańczowy czytany przez CPU. Zwiększ szybkość zapisu ponad szybkość przetwarzania i obserwuj licznik przeciążeń.

:::widget ping-pong-animacja 460
:::

:::warn Dlaczego pojawiają się straty
Zamiana buforów następuje, gdy zapisywany bufor się zapełni. Jeśli CPU nie skończył wtedy czytać poprzedniego, dane są tracone. Ping-pong rozdziela dostęp do danych, ale nie zastępuje szybkiego przetwarzania.
:::

## Sprawdź się

:::widget quiz-bufory-anim 330
:::
"""

LESSON_RTOS = """:::summary Szybkie podsumowanie
- **FreeRTOS** to system czasu rzeczywistego wbudowany w ESP32 (Arduino-ESP32 działa na nim, a `loop()` jest jednym z zadań).
- **Zadanie (task)** to osobny „wątek” z własnym stosem i priorytetem. **Kolejka (queue)** bezpiecznie przekazuje dane między zadaniami.
- ESP32 (dwurdzeniowy) pozwala **przypiąć** zadanie do rdzenia: zwykle sieć (Wi-Fi, BLE) działa na rdzeniu 0, a własne zadania czasowo krytyczne można przypiąć do rdzenia 1.
- **Mutex** chroni zasoby współdzielone przed jednoczesnym użyciem przez kilka zadań.
:::

## Po co dzielić program na zadania

W jednej pętli `loop()` długa operacja (wysyłka HTTP, odczyt karty SD) wstrzymuje wszystko inne, także pomiary. Zadania pozwalają zrobić to równolegle: jedno mierzy w stałym rytmie, drugie wysyła. Między sobą wymieniają dane przez kolejkę.

:::flow Dwa zadania i kolejka
(s) Timer 500 Hz
[a] Zadanie czujnika (rdzeń 1)
[b] Kolejka próbek
[c] Zadanie komunikacji (rdzeń 0)
[d] Wi-Fi / UART
s -> a
a -> b : xQueueSend
b -> c : xQueueReceive
c -> d
:::

## Przykład

```cpp ESP32: czujnik + komunikacja
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"

QueueHandle_t dataQueue;

void SensorTask(void* pv) {                      // rdzeń 1
  TickType_t lastWake = xTaskGetTickCount();
  for (;;) {
    vTaskDelayUntil(&lastWake, pdMS_TO_TICKS(2)); // stały krok 2 ms (500 Hz)
    int16_t s = (int16_t)analogRead(34);
    if (xQueueSend(dataQueue, &s, 0) != pdTRUE) {
      // kolejka pełna: próbka utracona, tu zlicz błąd
    }
  }
}

void CommTask(void* pv) {                        // rdzeń 0
  int16_t sample;
  for (;;) {
    if (xQueueReceive(dataQueue, &sample, portMAX_DELAY) == pdTRUE)
      sendBinarySample(sample);
  }
}

void setup() {
  dataQueue = xQueueCreate(64, sizeof(int16_t));
  // xTaskCreatePinnedToCore(funkcja, nazwa, stos, parametr, priorytet, uchwyt, rdzeń)
  xTaskCreatePinnedToCore(SensorTask, "Sensor", 4096, NULL, 5, NULL, 1);
  xTaskCreatePinnedToCore(CommTask,   "Comm",   8192, NULL, 3, NULL, 0);
}
void loop() { vTaskDelay(portMAX_DELAY); }       // zadania pracują same
```

:::note Uwagi do przykładu
- W ESP32 rozmiar stosu zadania podaje się w **bajtach** (w „czystym” FreeRTOS w słowach).
- Wywołanie z przerwania używa wersji `…FromISR` (np. `xQueueSendFromISR`).
- Układy jednordzeniowe (np. ESP32-C3, ESP32-S2) nie mają rdzenia 1, więc przypięcie do niego nie zadziała.
- Zasada „rdzeń 0 – sieć, rdzeń 1 – czujniki” to dobra praktyka, a nie wymóg. Najpierw sprawdź, czy bez przypinania są problemy.
:::

## Producent i konsument w ruchu

Ustaw szybkość producenta wyższą niż konsumenta i zobacz, jak kolejka się zapełnia. Potem zwiększ rozmiar kolejki: da to tylko zapas czasu, a nie rozwiąże problemu stałej różnicy szybkości.

:::widget kolejka-symulator 470
:::

## Współdzielone zasoby

:::def
Wyścig (race condition) | Wynik zależy od tego, które zadanie wykona się pierwsze, bo oba modyfikują te same dane.
Mutex | Blokada, którą w danej chwili trzyma jedno zadanie. Pozostałe czekają na `xSemaphoreGive`.
Odwrócenie priorytetów | Zadanie o niskim priorytecie trzyma mutex potrzebny wysokiemu. FreeRTOS łagodzi to dziedziczeniem priorytetu w mutexach.
:::

:::danger Nie blokuj w ISR
W przerwaniu nie wolno używać funkcji, które czekają (zwykłe `xQueueSend` z timeoutem, `delay`). Wersje `FromISR` nie blokują.
:::

## Sprawdź się

:::widget quiz-rtos 330
:::
"""

LESSON_WDT = """:::summary Szybkie podsumowanie
- **Watchdog (WDT)** to licznik sprzętowy odliczający w dół. Program musi go regularnie zerować („kopać psa”).
- Jeśli program się zawiesi i nie zeruje licznika, po upływie timeoutu następuje **reset układu**.
- Kopać należy w miejscu, które wykonuje się tylko wtedy, gdy program faktycznie działa poprawnie.
:::

## Idea

Wyobraź sobie minutnik kuchenny nastawiony na 3 sekundy. Dopóki co chwilę go przekręcasz, nic się nie dzieje. Gdy przestaniesz (zawieszona pętla, deadlock), minutnik zadzwoni, a tu zamiast dzwonka wymusza **restart mikrokontrolera**. Urządzenie bez człowieka wraca do pracy.

:::widget watchdog-symulator 430
:::

## Kod na ESP32

:::tabs
=== Arduino-ESP32 3.x / ESP-IDF 5
```cpp Konfiguracja watchdoga zadań
#include "esp_task_wdt.h"

void setup() {
  esp_task_wdt_config_t cfg = {
    .timeout_ms = 3000,
    .idle_core_mask = 0,          // nie obserwuj zadań bezczynności
    .trigger_panic = true         // przy timeoucie: panic i restart
  };
  esp_task_wdt_reconfigure(&cfg); // (lub esp_task_wdt_init, jeśli WDT nie był jeszcze uruchomiony)
  esp_task_wdt_add(NULL);         // obserwuj bieżące zadanie
}

void loop() {
  doSomeWork();
  esp_task_wdt_reset();           // musi się wykonać częściej niż co 3 s
}
```
=== Starsze Arduino-ESP32 2.x
```cpp Starsze API
#include "esp_task_wdt.h"

void setup() {
  esp_task_wdt_init(3, true);     // 3 s, true = reset przy timeoucie
  esp_task_wdt_add(NULL);
}
void loop() {
  doSomeWork();
  esp_task_wdt_reset();
}
```
=== Arduino Uno (AVR)
```cpp Watchdog w AVR
#include <avr/wdt.h>

void setup() { wdt_enable(WDTO_2S); }   // reset po 2 s bez wdt_reset()
void loop() {
  doSomeWork();
  wdt_reset();
}
```
:::

:::warn Wersje API
Interfejs watchdoga zadań w ESP32 zmienił się między wersjami (2.x: `esp_task_wdt_init(sekundy, reset)`, 3.x/IDF 5: struktura konfiguracyjna). Sprawdź, jaką wersję rdzenia masz zainstalowaną, i zajrzyj do jej dokumentacji, bo kompilacja z niewłaściwym wariantem się nie powiedzie.
:::

:::warn To restart, nie odcięcie zasilania
Watchdog wymusza reset układu. Nie odcina zasilania, więc zawartość niektórych układów zewnętrznych (np. wyjść, rejestrów czujników) może pozostać w poprzednim stanie. Po starcie program powinien ustawić bezpieczny stan wyjść.
:::

## Dobre praktyki

:::pros KOPIEMY
- w pętli głównej po wykonaniu pełnego cyklu pracy
- po potwierdzeniu, że wszystkie zadania zgłosiły się w ostatnim okresie
:::

:::cons NIE KOPIEMY
- w przerwaniu timera (działa nawet przy zawieszonej pętli)
- w osobnym zadaniu, które nic nie sprawdza
- w środku długiej blokującej operacji, żeby „przedłużyć życie”
:::

:::info Przyczyna restartu
Po restarcie warto odczytać i zapisać powód (np. `esp_reset_reason()` w ESP32), żeby wiedzieć, czy to zasilanie, panic czy watchdog.
:::

## Sprawdź się

:::widget quiz-rtos 330
:::
"""

COURSES = [
    {"slug": "czas-i-przerwania", "title": "Czas, przerwania i próbkowanie", "level": "intermediate", "position": 1,
     "summary": "Pomiar czasu bez blokowania, przerwania sprzętowe i dokładne próbkowanie."},
    {"slug": "bufory-i-przeplyw-danych", "title": "Bufory i przepływ danych", "level": "intermediate", "position": 2,
     "summary": "Jak bezpiecznie przekazywać dane między ISR, DMA i programem głównym: bufor kołowy i podwójne buforowanie."},
    {"slug": "wielozadaniowosc-i-niezawodnosc", "title": "Wielozadaniowość i niezawodność", "level": "advanced", "position": 3,
     "summary": "FreeRTOS na ESP32 (zadania, kolejki, dwa rdzenie) oraz watchdog jako zabezpieczenie przed zawieszeniem."},
]

ARTICLES = [
    {"slug": "polling-vs-przerwanie-jitter", "kind": "lesson", "course": "czas-i-przerwania", "position": 3, "level": "intermediate",
     "title": "Polling kontra przerwanie: skąd bierze się jitter", "summary": "Animowane porównanie dokładności próbkowania w pętli i w przerwaniu timera.",
     "tags": ["jitter", "isr", "polling", "próbkowanie"], "body": LESSON_JITTER,
     "widgets": {"jitter-symulator": W_JITTER}},
    {"slug": "stos-lifo-i-ping-pong-animacje", "kind": "lesson", "course": "bufory-i-przeplyw-danych", "position": 3, "level": "basic",
     "title": "Animacje: stos (LIFO) i ping-pong", "summary": "Interaktywny stos z przepełnieniem oraz animacja podwójnego buforowania z licznikiem strat.",
     "tags": ["stos", "lifo", "ping-pong", "bufor"], "body": LESSON_ANIM,
     "widgets": {"stos-lifo": W_STACK, "ping-pong-animacja": W_PPANIM, "quiz-bufory-anim": quiz_widget([
         {"q": "Który element zdejmiesz ze stosu jako pierwszy?", "a": ["Najstarszy", "Ostatnio dodany", "Środkowy", "Dowolny"], "ok": 1, "e": "LIFO: last in, first out."},
         {"q": "Kiedy w ping-pongu tracimy próbki?", "a": ["Gdy bufory są takie same", "Gdy zapisywany bufor zapełni się, a CPU nie skończył czytać drugiego", "Zawsze po zamianie", "Nigdy"], "ok": 1, "e": "Straty wynikają ze zbyt wolnego przetwarzania, a nie z samej techniki."},
         {"q": "Co grozi przy zbyt głębokiej rekurencji na mikrokontrolerze?", "a": ["Nic", "Przepełnienie stosu i błędne działanie lub restart", "Szybsze działanie", "Zmiana częstotliwości zegara"], "ok": 1, "e": "Stos ma ograniczony rozmiar, a rekurencja odkłada kolejne ramki."}])}},
    {"slug": "freertos-zadania-kolejki-rdzenie", "kind": "lesson", "course": "wielozadaniowosc-i-niezawodnosc", "position": 1, "level": "advanced",
     "title": "FreeRTOS: zadania, kolejki i dwa rdzenie ESP32", "summary": "Podział programu na zadania, przekazywanie próbek kolejką, przypinanie do rdzeni i ochrona zasobów współdzielonych.",
     "tags": ["freertos", "esp32", "rtos", "kolejka", "mutex"], "body": LESSON_RTOS,
     "widgets": {"kolejka-symulator": W_QUEUE, "quiz-rtos": W_QUIZ_RTOS}},
    {"slug": "watchdog-ochrona-przed-zawieszeniem", "kind": "lesson", "course": "wielozadaniowosc-i-niezawodnosc", "position": 2, "level": "intermediate",
     "title": "Watchdog: ochrona przed zawieszeniem", "summary": "Jak działa watchdog, jak go konfigurować na ESP32 i AVR oraz gdzie wolno go „kopać”.",
     "tags": ["watchdog", "wdt", "niezawodność", "esp32"], "body": LESSON_WDT,
     "widgets": {"watchdog-symulator": W_WDT, "quiz-rtos": W_QUIZ_RTOS}},
]
