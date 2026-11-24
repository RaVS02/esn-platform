"""Partia treści z archiwum (v10): kurs „Czas, przerwania i próbkowanie”, 2 lekcje.
Importowane jednorazowo jako propozycje „Do przeglądu” (knowledge_service.import_batches).
Zmiany merytoryczne względem archiwum: docs/WIEDZA-PILOTAZ.md (sekcja „Partia v10”)."""
import json

from knowledge_batch_v8 import WIDGET_BASE


def quiz_widget(questions):
    return WIDGET_BASE + """<div id="q"></div><div class="out" id="r">Wybierz odpowiedź.</div>
<script>
var Q=""" + json.dumps(questions, ensure_ascii=False) + """;
var i=0,score=0,box=document.getElementById('q'),res=document.getElementById('r');
function show(){box.textContent='';if(i>=Q.length){res.textContent='Wynik: '+score+' / '+Q.length;return}
 var p=document.createElement('p');p.textContent=(i+1)+'. '+Q[i].q;box.appendChild(p);
 Q[i].a.forEach(function(t,k){var b=document.createElement('button');b.textContent=t;b.style.margin='3px 6px 3px 0';
  b.addEventListener('click',function(){var good=k===Q[i].ok;if(good)score++;res.textContent='';var s=document.createElement('span');s.className=good?'ok':'bad';s.textContent=good?'Dobrze! ':'Niestety. ';res.appendChild(s);res.appendChild(document.createTextNode(Q[i].e+' '));
   var n=document.createElement('button');n.textContent='Dalej →';n.addEventListener('click',function(){i++;res.textContent='';show()});res.appendChild(n);
   [].forEach.call(box.querySelectorAll('button'),function(x){x.disabled=true})});box.appendChild(b)});}
show();
</script>"""


W_DRIFT = WIDGET_BASE + """<div><label>Interwał: <b class="acc" id="iv">10</b> ms</label><input type="range" id="i" min="2" max="50" value="10">
<label>Maksymalny czas jednego obiegu pętli: <b class="acc" id="mv">1.5</b> ms</label><input type="range" id="m" min="0.1" max="5" step="0.1" value="1.5">
<div class="out"><div>Oczekiwana liczba wywołań w 10 s: <b id="exp"></b></div>
<div style="margin-top:8px">prevTime = now: <b class="bad" id="a"></b> <span id="ea"></span></div><div class="bar"><i id="ba" style="background:#f85149"></i></div>
<div style="margin-top:8px">prevTime += INTERVAL: <b class="ok" id="b"></b> <span id="eb"></span></div><div class="bar"><i id="bb" style="background:#3fb950"></i></div></div></div>
<script>
function $(i){return document.getElementById(i)}
function sim(method,iv,mx){var seed=12345;function rnd(){seed=(seed*1103515245+12345)%2147483648;return seed/2147483648}
 var T=10000,t=0,prev=0,n=0;while(t<T){t+=mx*(0.2+0.8*rnd());if(t-prev>=iv){prev=method==='A'?t:prev+iv;n++}}return n}
function calc(){var iv=+$('i').value,mx=+$('m').value;$('iv').textContent=iv;$('mv').textContent=mx.toFixed(1);
 var exp=Math.floor(10000/iv),a=sim('A',iv,mx),b=sim('B',iv,mx);
 $('exp').textContent=exp;$('a').textContent=a;$('b').textContent=b;
 $('ea').textContent='(błąd '+((a-exp)/exp*100).toFixed(1)+'%)';$('eb').textContent='(błąd '+((b-exp)/exp*100).toFixed(1)+'%)';
 $('ba').style.width=Math.min(100,a/exp*100)+'%';$('bb').style.width=Math.min(100,b/exp*100)+'%';}
['i','m'].forEach(function(x){$(x).addEventListener('input',calc)});calc();
</script>"""

W_QUIZ_ISR = quiz_widget([
    {"q": "Co powinno się dziać wewnątrz ISR?", "a": ["Jak najkrótsze operacje, np. ustawienie flagi", "Wysyłanie danych przez Serial.print()", "Wywołanie delay(10)", "Obliczenia zmiennoprzecinkowe"], "ok": 0, "e": "ISR ma być krótki. Ciężką pracę wykonuje pętla główna po sprawdzeniu flagi."},
    {"q": "Po co słowo kluczowe volatile przy zmiennej współdzielonej z ISR?", "a": ["Przyspiesza program", "Zapobiega optymalizacji, która pomija odczyt zmiennej z pamięci", "Zmniejsza zużycie RAM", "Czyni zmienną stałą"], "ok": 1, "e": "Bez volatile kompilator może zachować wartość w rejestrze i pętla nigdy nie zobaczy zmiany."},
    {"q": "Czy w ISR na AVR działa millis()?", "a": ["Tak, normalnie", "Wartość nie zwiększa się w trakcie ISR", "Zwraca zawsze 0", "Powoduje restart"], "ok": 1, "e": "millis() liczy przerwanie Timer0, które nie może się wykonać, gdy trwa inne ISR."},
])

LESSON_MILLIS = """:::summary Szybkie podsumowanie
- `delay()` zatrzymuje cały program – w kodzie, który ma reagować na czujniki i komunikację, unikaj go.
- Zamiast tego porównuj `millis()` z zapamiętanym znacznikiem czasu (wzorzec „Blink Without Delay”).
- Aby uniknąć **dryfu**, przesuwaj znacznik o stały interwał (`prevTime += INTERVAL`) zamiast przepisywać aktualny czas.
- Różnica `now - prevTime` na liczbach bez znaku działa poprawnie także po przepełnieniu licznika.
:::

## Dlaczego delay() blokuje

Funkcja `delay(10)` zatrzymuje procesor na 10 ms. W tym czasie program nie odczyta czujnika, nie obsłuży przycisku ani nie przeczyta danych z portu szeregowego (przerwania sprzętowe nadal działają, ale kod w `loop()` czeka).

:::warn Gdzie delay() jest w porządku
W prostych szkicach, w `setup()` (np. czekanie na start czujnika) i wszędzie tam, gdzie nic innego nie musi się dziać. Problem zaczyna się, gdy urządzenie ma robić kilka rzeczy naraz.
:::

## millis() i micros()

:::kv
Jednostka | millis: 1 ms · micros: 1 µs
Rozdzielczość (Arduino Uno) | millis: 1 ms · micros: 4 µs
Przepełnienie (32 bity) | millis: ok. 49,7 dnia · micros: ok. 71,6 minuty
Zastosowanie | millis: interwały, timeouty · micros: krótkie impulsy, pomiary czasu
:::

## Wzorzec „Blink Without Delay”

Zamiast blokować procesor, zapamiętujemy moment ostatniego wykonania i w każdym obiegu `loop()` sprawdzamy, czy minął wymagany interwał: `if (millis() - prevTime >= INTERVAL) { ... }`. W „wolnym” czasie pętla obsługuje inne zadania.

:::note Dlaczego odejmowanie jest bezpieczne
Gdy `now` i `prevTime` są typu `uint32_t`, wyrażenie `now - prevTime` daje poprawny upływ czasu nawet po przepełnieniu licznika (z 4 294 967 295 z powrotem na 0). Porównanie `now >= prevTime + INTERVAL` takiej własności nie ma – po przepełnieniu zawiedzie.
:::

## Dryf czasu i jak go uniknąć

Jeśli po każdym wykonaniu zapisujesz `prevTime = millis()`, to opóźnienie kodu (obieg pętli kończy się zwykle po przekroczeniu interwału) dodaje się do każdego okresu. Po setkach powtórzeń zbiera się znaczący błąd. Gdy zamiast tego zwiększasz znacznik o stały interwał, `prevTime += INTERVAL`, okresy są wyznaczane z jednego, stałego punktu odniesienia i błąd się nie kumuluje.

Sprawdź to na symulacji (10 sekund pracy, losowy czas obiegu pętli):

:::widget dryf-symulator 380
:::

```cpp Timer bez blokowania, bez dryfu
const uint32_t INTERVAL_MS = 2;        // 500 Hz
uint32_t prevTime = 0;

void loop() {
  uint32_t now = millis();

  if (now - prevTime >= INTERVAL_MS) {
    prevTime += INTERVAL_MS;           // stały krok, nie prevTime = now

    uint16_t sample = analogRead(A0);
    sendBinarySample(sample);
  }

  // Tu można robić inne rzeczy bez blokowania:
  checkButtons();
  handleSerial();
}
```

:::warn Gdy pętla „zaspi”
Jeśli `loop()` zostanie zatrzymana na dłużej niż interwał (np. długa operacja), przy `prevTime += INTERVAL` zadanie wykona się kilka razy z rzędu, aby „nadrobić” zaległości. Gdy to niepożądane, po wykryciu dużego opóźnienia ustaw `prevTime = now`. W systemach z RTOS ten sam cel realizuje `vTaskDelayUntil()`.
:::

:::neutral Dokładność millis()
`millis()` opiera się na zegarze procesora. Płytki z rezonatorem ceramicznym mogą mieć błąd rzędu pół procenta, z kwarcem – znacznie mniejszy. Do pomiarów wymagających dokładności użyj zegara RTC lub sprzętowego timera.
:::

:::checklist
- [ ] Brak `delay()` w kodzie, który ma reagować na zdarzenia
- [ ] Znaczniki czasu mają typ `uint32_t` (`unsigned long`)
- [ ] Interwał sprawdzasz odejmowaniem, nie dodawaniem
- [ ] Cykliczne zadania korzystają z `prevTime += INTERVAL`
:::
"""

LESSON_ISR = """:::summary Szybkie podsumowanie
- **ISR** (Interrupt Service Routine) to funkcja wywoływana przez układ sprzętowy (np. timer), niezależnie od pętli `loop()`.
- Dzięki niej próbkowanie następuje w regularnych odstępach, z małym i przewidywalnym opóźnieniem (jitterem).
- ISR musi być **krótki**: ustaw flagę, zapisz wartość, wyjdź. Resztę pracy wykonaj w `loop()`.
- Zmienne współdzielone z ISR muszą być `volatile`, a przy typach większych niż słowo procesora odczyt trzeba zabezpieczyć.
:::

## Czym jest przerwanie

Procesor wykonuje program, a gdy sprzęt zgłosi zdarzenie (koniec odliczania timera, zbocze na pinie, nadejście bajtu), **przerywa bieżącą pracę**, uruchamia ISR i wraca do miejsca, w którym skończył. Przy próbkowaniu z ustaloną częstotliwością (np. EKG 500 Hz) timer sprzętowy wyznacza chwile pobrania próbki znacznie dokładniej niż odmierzanie czasu w pętli.

:::sequence Polling a przerwanie
Timer, ISR, loop
Timer -> ISR : minęło 2 ms
ISR -> ISR : sampleDue = true
ISR --> loop : powrót do pętli
loop -> loop : odczyt i wysłanie próbki
:::

:::danger Zasady ISR
W ISR nie używaj `delay()`, `Serial.print()`, alokacji pamięci ani rozbudowanej matematyki (zwłaszcza zmiennoprzecinkowej). Na AVR w trakcie ISR nie zwiększa się też `millis()`. Im dłużej trwa ISR, tym dłużej blokowane są inne przerwania i tym większy jitter.
:::

## Wzorzec: flaga w ISR, praca w pętli

```cpp Arduino (AVR) – timer sprzętowy Timer1
#include <TimerOne.h>

volatile bool sampleDue = false;      // flaga ustawiana w ISR

void sampleISR() {                    // wywoływana co 2 ms (500 Hz)
  sampleDue = true;
}

void setup() {
  Serial.begin(115200);
  Timer1.initialize(2000);            // 2000 µs = 500 Hz
  Timer1.attachInterrupt(sampleISR);
}

void loop() {
  if (sampleDue) {
    sampleDue = false;                // flaga 1-bajtowa: zapis jest atomowy na AVR
    uint16_t sample = analogRead(A0); // odczyt poza ISR (trwa ok. 100 µs)
    sendBinarySample(sample);
  }
  // inne zadania – procesor wolny między próbkami
}
```

:::note Dlaczego nie czytamy ADC w ISR?
W archiwalnej wersji tej lekcji `analogRead()` był wywoływany wewnątrz ISR. Na AVR pojedynczy odczyt trwa ok. 100 µs, co jest długo jak na ISR, a na ESP32 funkcje Arduino nie są przeznaczone do wywołań z przerwania. Bezpieczniej jest ustawić flagę i odczytać próbkę w pętli. Kosztem jest niewielki jitter momentu odczytu (przy 500 Hz zwykle akceptowalny). Gdy potrzebujesz próbkowania bez jittera, użyj ADC wyzwalanego sprzętowo przez timer i DMA (zob. lekcja o buforowaniu).
:::

:::details Wersja dla ESP32 (Arduino-ESP32 3.x)
```cpp ESP32 – timer sprzętowy
hw_timer_t *timer = nullptr;
volatile bool sampleDue = false;

void IRAM_ATTR onTimer() {            // IRAM_ATTR: kod ISR w pamięci RAM, szybki dostęp
  sampleDue = true;
}

void setup() {
  timer = timerBegin(1000000);        // zegar timera 1 MHz
  timerAttachInterrupt(timer, &onTimer);
  timerAlarm(timer, 2000, true, 0);   // co 2000 µs, automatyczne przeładowanie
}
```
Wywołania dotyczą wersji 3.x rdzenia Arduino-ESP32. W wersji 2.x używa się `timerBegin(0, 80, true)` i `timerAlarmWrite()`, więc sprawdź dokumentację zainstalowanej wersji.
:::

## Wspólne zmienne i atomowość

`volatile` mówi kompilatorowi, że zmienna może się zmienić „bez jego wiedzy”, więc zawsze ma ją odczytać z pamięci. To **nie** czyni dostępu atomowym: na 8-bitowym AVR odczyt zmiennej 16- lub 32-bitowej to kilka instrukcji i ISR może wejść w środek. Wtedy odczyt w `loop()` otocz blokadą przerwań:

```cpp Bezpieczny odczyt 16-bitowej zmiennej (AVR)
noInterrupts();
uint16_t copy = sampleBuf;            // kopia wykonana bez przerwania
interrupts();
```

## Sprawdź się

:::widget quiz-isr 330
:::
"""

COURSES = [{"slug": "czas-i-przerwania", "title": "Czas, przerwania i próbkowanie", "level": "basic", "position": 1,
            "summary": "Jak odmierzać czas bez blokowania programu i jak próbkować sygnały w stałych odstępach."}]

ARTICLES = [
    {"slug": "millis-bez-blokowania-i-dryf", "kind": "lesson", "course": "czas-i-przerwania", "position": 1, "level": "basic",
     "title": "Czas bez blokowania: millis() i dryf", "summary": "Jak zastąpić delay(), odmierzać interwały i uniknąć kumulowania się błędu czasu.",
     "tags": ["millis", "delay", "timer", "dryf"], "body": LESSON_MILLIS, "widgets": {"dryf-symulator": W_DRIFT}},
    {"slug": "przerwania-sprzetowe-isr", "kind": "lesson", "course": "czas-i-przerwania", "position": 2, "level": "intermediate",
     "title": "Przerwania sprzętowe (ISR)", "summary": "Czym jest przerwanie, jak napisać krótki ISR, po co volatile i jak próbkować ze stałą częstotliwością.",
     "tags": ["isr", "przerwania", "timer", "volatile"], "body": LESSON_ISR, "widgets": {"quiz-isr": W_QUIZ_ISR}},
]
