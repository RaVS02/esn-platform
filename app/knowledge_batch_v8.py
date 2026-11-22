"""Partia treści z archiwum (v8): kurs „Podstawy sprzętu”, 3 lekcje.
Importowane JEDNORAZOWO jako propozycje „Do przeglądu” (nieopublikowane) – patrz knowledge_service.import_batches.
Merytoryczne zmiany względem archiwum: docs/WIEDZA-PILOTAZ.md (sekcja „Partia v8”)."""

WIDGET_BASE = ("<style>body{font:14px/1.5 system-ui,sans-serif;color:#e6edf3;padding:12px}label{display:block;margin:8px 0 2px;color:#9fb0c3;font-size:12px}"
               "input[type=range]{width:100%}input[type=number]{background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:6px 8px;font:inherit;width:110px}"
               ".out{margin-top:10px;padding:10px 12px;background:#0d1117;border:1px solid #30363d;border-radius:8px;font-family:ui-monospace,Menlo,monospace}"
               ".acc{color:#56e1fd}.ok{color:#3fb950}.bad{color:#f85149}.warn{color:#ff8c00}.bar{height:8px;background:#21262d;border-radius:9px;overflow:hidden;margin-top:6px}.bar i{display:block;height:100%}</style>")

W_QUIZ_MCU = WIDGET_BASE + """<div id="q"></div><div class="out" id="r">Wybierz odpowiedź.</div>
<script>
var Q=[
 {q:'Które urządzenie jest mikrokontrolerem?',a:['Intel Core i7','ESP32','Raspberry Pi 5','Karta graficzna'],ok:1,e:'ESP32 łączy rdzeń, pamięć RAM/Flash i peryferia w jednym układzie.'},
 {q:'Co jest najważniejsze w sterowaniu w czasie rzeczywistym?',a:['Maksymalna moc obliczeniowa','Przewidywalny czas reakcji','Duża pamięć masowa','Karta graficzna'],ok:1,e:'Liczy się, że reakcja zawsze zmieści się w wymaganym czasie (determinizm).'},
 {q:'Do projektu czujnika na baterii (miesiące pracy) wybierzesz:',a:['Mikroprocesor z Linuksem','Mikrokontroler z trybem uśpienia','Komputer stacjonarny','Serwer'],ok:1,e:'MCU w trybie głębokiego uśpienia pobiera mikroampery.'}
];
var i=0,score=0,box=document.getElementById('q'),res=document.getElementById('r');
function show(){box.textContent='';if(i>=Q.length){res.textContent='Wynik: '+score+' / '+Q.length;return}
 var p=document.createElement('p');p.textContent=(i+1)+'. '+Q[i].q;box.appendChild(p);
 Q[i].a.forEach(function(t,k){var b=document.createElement('button');b.textContent=t;b.style.cssText='margin:3px 6px 3px 0;background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:6px 12px;cursor:pointer';
  b.addEventListener('click',function(){var good=k===Q[i].ok;if(good)score++;res.textContent='';var s=document.createElement('span');s.className=good?'ok':'bad';s.textContent=good?'Dobrze! ':'Niestety. ';res.appendChild(s);res.appendChild(document.createTextNode(Q[i].e+' '));
   var n=document.createElement('button');n.textContent='Dalej →';n.style.cssText='background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:4px 10px;cursor:pointer';n.addEventListener('click',function(){i++;res.textContent='';show()});res.appendChild(n);
   [].forEach.call(box.querySelectorAll('button'),function(x){x.disabled=true})});box.appendChild(b)});}
show();
</script>"""

W_CLOCK = WIDGET_BASE + """<div><label>Częstotliwość zegara: <b class="acc" id="fv">16</b> MHz</label><input type="range" id="f" min="1" max="240" value="16">
<label>Cykli na instrukcję (średnio): <b class="acc" id="cv">1</b></label><input type="range" id="c" min="1" max="6" value="1">
<label>Liczba instrukcji do wykonania</label><input type="number" id="n" min="1" max="100000000" value="1000">
<div class="out">Czas jednego cyklu: <b class="ok" id="t"></b><br>Instrukcji na sekundę: <b class="ok" id="ips"></b><br>Czas wykonania: <b class="ok" id="tt"></b></div></div>
<script>
function $(i){return document.getElementById(i)}
function fmt(s){if(s<1e-6)return (s*1e9).toFixed(1)+' ns';if(s<1e-3)return (s*1e6).toFixed(2)+' µs';if(s<1)return (s*1e3).toFixed(2)+' ms';return s.toFixed(2)+' s'}
function calc(){var f=+$('f').value,c=+$('c').value,n=Math.max(1,Math.min(1e8,+$('n').value||1));$('fv').textContent=f;$('cv').textContent=c;
 $('t').textContent=fmt(1/(f*1e6));var ips=f*1e6/c;$('ips').textContent=(ips>=1e6?(ips/1e6).toFixed(1)+' mln':Math.round(ips))+' /s';$('tt').textContent=fmt(n*c/(f*1e6));}
['f','c','n'].forEach(function(i){$(i).addEventListener('input',calc)});calc();
</script>"""

W_LDO = WIDGET_BASE + """<div><label>Napięcie wejściowe Vin: <b class="acc" id="vi">5.0</b> V</label><input type="range" id="vin" min="3.5" max="24" step="0.1" value="5">
<label>Napięcie wyjściowe Vout: <b class="acc" id="vo">3.3</b> V</label><input type="range" id="vout" min="1.8" max="5" step="0.1" value="3.3">
<label>Pobierany prąd: <b class="acc" id="ii">200</b> mA</label><input type="range" id="i" min="10" max="1000" step="10" value="200">
<div class="out"><div>LDO: sprawność <b id="eff"></b>, moc strat <b id="loss"></b> W <span id="flag"></span></div><div class="bar"><i id="b1" style="background:#ff8c00"></i></div>
<div style="margin-top:10px">Przetwornica buck (≈90%): moc strat <b class="ok" id="loss2"></b> W</div><div class="bar"><i id="b2" style="background:#3fb950"></i></div></div></div>
<script>
function $(i){return document.getElementById(i)}
function calc(){var vin=+$('vin').value,vo=+$('vout').value,i=+$('i').value/1000;$('vi').textContent=vin.toFixed(1);$('vo').textContent=vo.toFixed(1);$('ii').textContent=Math.round(i*1000);
 if(vo>=vin){$('eff').textContent='—';$('loss').textContent='—';$('flag').textContent='Vout musi być niższe niż Vin (LDO tylko obniża napięcie).';$('flag').className='bad';$('b1').style.width='0';return}
 var eff=vo/vin,loss=(vin-vo)*i,pout=vo*i,loss2=pout/0.9-pout;
 $('eff').textContent=(eff*100).toFixed(0)+'%';$('loss').textContent=loss.toFixed(2);$('loss2').textContent=loss2.toFixed(2);
 $('flag').textContent=loss>1?'– bardzo gorący, wymaga radiatora':loss>0.5?'– wyraźnie się nagrzeje':'';$('flag').className=loss>1?'bad':'warn';
 $('b1').style.width=Math.min(100,loss/2*100)+'%';$('b2').style.width=Math.min(100,loss2/2*100)+'%';}
['vin','vout','i'].forEach(function(x){$(x).addEventListener('input',calc)});calc();
</script>"""

LESSON_MCU = """:::summary Szybkie podsumowanie
- **Mikrokontroler (MCU)** to jeden układ z procesorem, pamięcią i peryferiami, gotowy do sterowania sprzętem.
- **Mikroprocesor (CPU)** to „sam rdzeń” – potrzebuje zewnętrznej pamięci, pamięci masowej i układów pomocniczych.
- W sterowaniu liczy się **przewidywalny czas reakcji** i niski pobór prądu, a nie maksymalna moc.
:::

## Czym jest mikrokontroler?

Mikrokontroler (np. ATmega328P, ESP32, STM32) to układ typu **system-on-chip**: w jednej obudowie mieści się rdzeń procesora, pamięć RAM, pamięć programu (Flash) oraz peryferia – porty GPIO, UART, I2C, SPI, przetworniki ADC, liczniki. Jest zaprojektowany do wykonywania jednego zadania w pętli i zużywa przy tym niewiele energii.

:::kv
Mikroprocesor (CPU w PC) | Wymaga zewnętrznej pamięci RAM, dysku i układów wejścia/wyjścia. Duża moc obliczeniowa, duży pobór prądu.
Mikrokontroler (MCU) | Wszystko w jednym układzie. Z trybami uśpienia może pracować miesiącami na baterii. Steruje pinami bezpośrednio.
:::

## Porównanie

| Cecha | Mikroprocesor (CPU) | Mikrokontroler (MCU) |
|---|---|---|
| Przykłady | Intel Core, ARM Cortex-A (Raspberry Pi) | ATmega328P, ESP32, STM32, RP2040 |
| Pamięć | Zewnętrzna RAM (gigabajty) | Wbudowana: RAM w KB–MB, Flash na program |
| System | Linux, Windows | Brak systemu lub RTOS |
| Pobór mocy | Od watów do setek watów | Miliwaty; w uśpieniu mikroampery |
| Start | Sekundy | Milisekundy |
| Typowe zastosowanie | Komputery, serwery, komputery jednopłytkowe | Sterowanie, czujniki, urządzenia na baterii |

:::neutral Uwaga o nazwach
Nazwa płytki nie przesądza o typie układu. **Raspberry Pi Pico** to mikrokontroler (RP2040), a **Raspberry Pi 5** to komputer z mikroprocesorem. W tym kursie „Arduino” i „ESP32” oznaczają płytki z mikrokontrolerami.
:::

:::note Kiedy wybrać mikrokontroler?
Tam, gdzie liczy się **sterowanie sprzętem w czasie rzeczywistym**. Mikrokontroler zwykle nie ma systemu operacyjnego wielozadaniowego (co najwyżej RTOS), dlatego kod wykonuje się z przewidywalnym czasem. To kluczowe np. przy próbkowaniu sygnału EKG 500 razy na sekundę: kolejna próbka musi zostać pobrana dokładnie w swoim momencie.
:::

## Jak wybrać?

:::flow Mikrokontroler czy mikroprocesor?
(s) Start
{a} Potrzebny system operacyjny lub ciężkie obliczenia?
[cpu] Mikroprocesor (np. Raspberry Pi)
{b} Liczy się czas reakcji i praca na baterii?
[mcu] Mikrokontroler (np. ESP32)
[mix] Często oba razem
s -> a
a -> cpu : tak
a -> b : nie
b -> mcu : tak
b -> mix : nie
cpu -> mix
:::

:::details Czy mikrokontroler może uruchomić Linuksa?
Zwykle nie. Pełny Linux wymaga jednostki zarządzania pamięcią (MMU) i dużo pamięci RAM, których typowe mikrokontrolery (AVR, ESP32, większość STM32) nie mają. Istnieją układy pośrednie – mikroprocesory z wbudowaną pamięcią – oraz wyspecjalizowane wersje Linuksa dla prostszych rdzeni, ale to zastosowania zaawansowane i wykraczają poza ten kurs.
:::

## Sprawdź się

:::widget quiz-mcu 330
:::
"""

LESSON_CLOCK = """:::summary Szybkie podsumowanie
- Zegar nadaje tempo pracy procesora: 16 MHz to 16 milionów cykli na sekundę.
- Najprostsza instrukcja zajmuje zwykle 1 cykl, ale mnożenie, dzielenie czy dostęp do pamięci mogą trwać dłużej.
- Wyższa częstotliwość oznacza więcej obliczeń, ale też **większy pobór prądu**.
:::

## Czym jest taktowanie?

Zegar mikrokontrolera działa jak metronom. Każde „tyknięcie” (cykl zegara) pozwala wykonać krok pracy procesora. Częstotliwość podana w megahercach (MHz) to miliony cykli na sekundę, a czas jednego cyklu to jej odwrotność:

:::stats
Arduino Uno | 16 MHz | cykl ≈ 62,5 ns | orange
ESP32 | do 240 MHz | cykl ≈ 4,2 ns | green
:::

Najprostsze instrukcje (np. dodanie dwóch liczb w rejestrach) wykonują się w jednym cyklu, więc 16 MHz to około 16 milionów takich instrukcji na sekundę. Operacje złożone – mnożenie, dzielenie, arytmetyka na liczbach zmiennoprzecinkowych bez sprzętowego wsparcia, odczyt z wolnej pamięci – zajmują wiele cykli. Zobacz, jak zmienia się czas wykonania:

:::widget zegar-kalkulator 360
:::

## Dlaczego nie zawsze „im więcej MHz, tym lepiej”?

8-bitowy procesor przy 16 MHz szybko się „dławi” w zadaniach takich jak filtrowanie zaszumionego sygnału EKG czy szyfrowanie w sieciach Wi-Fi: liczby 32-bitowe musi przetwarzać po kawałku. Układy takie jak ESP32 mają rdzenie 32-bitowe, taktowanie do 240 MHz i dwa rdzenie, więc potrafią wykonywać takie obliczenia bezpośrednio na płytce.

:::warn Kompromis: pobór prądu
Moc pobierana przez układ cyfrowy rośnie mniej więcej proporcjonalnie do częstotliwości zegara (i do kwadratu napięcia zasilania). Przy urządzeniach na baterię warto obniżyć taktowanie – ESP32 pozwala na 80, 160 i 240 MHz – albo większość czasu spędzać w trybie uśpienia.
:::

## Porównanie platform

| Cecha | Arduino Uno (ATmega328P) | ESP32 |
|---|---|---|
| Zegar | 16 MHz | do 240 MHz |
| Architektura | 8-bit AVR | 32-bit Xtensa LX6 (dwa rdzenie) |
| Pamięć RAM | 2 KB SRAM | 520 KB SRAM |
| Wi-Fi / Bluetooth | brak | Wi-Fi + Bluetooth LE |
| ADC | 10 bitów, 6 kanałów | 12 bitów, do 18 kanałów |
| DMA | brak | tak (m.in. I2S, SPI, UART) |
| RTOS | wymaga zewnętrznej biblioteki | FreeRTOS w zestawie ESP-IDF |
| Cena płytki (orientacyjnie) | ok. 5–10 USD (klony) | ok. 4–8 USD |

:::neutral O liczbach w tabeli
Dane dotyczą popularnych płytek deweloperskich. W konkretnym układzie (np. ESP32-S3, ESP32-C3) wartości się różnią – zawsze sprawdź notę katalogową swojego modelu. Ceny zmieniają się w czasie i zależą od sprzedawcy.
:::

:::details Skąd się biorą liczby „mln operacji na sekundę”?
Producent często podaje maksymalną liczbę najprostszych instrukcji. Realna wydajność zależy od mieszanki instrukcji, pamięci i peryferiów, dlatego do porównań używa się testów (benchmarków) uruchamianych na konkretnym zadaniu.
:::
"""

LESSON_POWER = """:::summary Szybkie podsumowanie
- Płytkę zasilasz z **USB (5 V)**, pinem **VIN/5V** (zwykle ok. 5 V) albo z regulowanego **3,3 V** na pin 3V3 (z pominięciem stabilizatora).
- Pin **3V3 to wyjście** stabilizatora – służy do zasilania małych czujników, nie silników.
- Wszystkie zasilania w układzie muszą mieć **wspólną masę (GND)**.
:::

## Źródła zasilania płytki

Projekt zwykle zaczyna się od kabla USB, ale docelowo urządzenie trafia na baterię lub zasilacz. Trzeba wiedzieć, gdzie podłączyć przewody.

:::card Trzy sposoby zasilania
- **Port USB:** stabilne 5 V z komputera. Standardowy limit prądu portu USB 2.0 to 500 mA (po negocjacji), wiele zasilaczy daje więcej.
- **Pin VIN (lub 5V):** wejście zasilania zewnętrznego. Napięcie przechodzi przez stabilizator LDO na płytce, który obniża je do 3,3 V. W typowych płytkach ESP32 potrzebuje ok. **4,5–5 V**.
- **Pin 3V3:** to **wyjście** stabilizatora. Zasilisz nim małe czujniki. Zewnętrzne, dobrze stabilizowane 3,3 V możesz tu podać tylko wtedy, gdy znasz schemat płytki i nie podłączasz równocześnie USB.
:::

:::danger Nie podawaj na 3V3 napięcia wyższego niż 3,3 V
Układ ESP32 jest zasilany z 3,3 V. Wyższe napięcie na tym pinie może go uszkodzić.
:::

:::details Czy pojedynczą celę Li-Ion (3,0–4,2 V) podłączę do VIN?
Zwykle nie. Stabilizator LDO potrzebuje na wejściu napięcia o ok. 1 V wyższego niż na wyjściu, więc przy rozładowanej cesie płytka przestanie działać (lub będzie niestabilna). Użyj płytki z wbudowaną ładowarką i przetwornicą albo osobnego modułu zasilania. Moduły z ochroną i ładowaniem sprawdzaj w ich dokumentacji.
:::

## Droga zasilania

:::flow Gdzie płyną napięcia
(u) USB 5 V
[l] Stabilizator LDO
[m] Mikrokontroler 3,3 V
[s] Czujniki 3,3 V
[d] Przetwornica DC-DC
[o] Silniki i przekaźniki
u -> l
l -> m
m -> s
u -> d
d -> o
:::

:::warn Nie zasilaj silników z płytki
Stabilizator na płytce ma ograniczoną wydajność (typowo kilkaset mA, a przy większym obciążeniu mocno się grzeje). Układ Wi-Fi w czasie nadawania pobiera krótkie piki rzędu kilkuset mA (zasilacz powinien dawać co najmniej 500 mA). Jeśli do pinu 3V3 podepniesz odbiornik o dużym poborze (przekaźnik, serwo, silnik), napięcie spadnie, zadziała zabezpieczenie brownout i układ będzie się restartował. **Zewnętrzne odbiorniki prądowe zasilaj z osobnego źródła**, np. przetwornicy DC-DC.
:::

## LDO czy przetwornica impulsowa (buck)?

| Typ | Zasada | Plusy | Minusy |
|---|---|---|---|
| **LDO (liniowy)** | Nadmiar napięcia zamienia w ciepło | Czyste napięcie, mało szumów, tani | Niska sprawność przy dużej różnicy Vin–Vout, grzeje się |
| **Buck (impulsowa)** | Szybko przełącza prąd i filtruje cewką i kondensatorem | Sprawność nawet ok. 90–95%, dobra przy bateriach | Szumy przełączania (mogą zakłócać pomiary analogowe i radio) |

Dla LDO sprawność wynosi w przybliżeniu **Vout / Vin**, a moc tracona na ciepło **(Vin − Vout) · I**. Sprawdź, ile ciepła powstaje dla Twoich wartości:

:::widget ldo-straty 330
:::

:::note Pomiary analogowe (np. EKG)
Przy czułych pomiarach analogowych preferuje się zasilanie z LDO lub dobrze filtrowanej przetwornicy, ponieważ szum przełączania może pogarszać wynik. To zalecenie, nie bezwzględny wymóg: dobra przetwornica z filtrem też się sprawdza.
:::

## Złota zasada: wspólna masa

:::danger Połącz wszystkie masy (GND)
Jeśli mikrokontroler zasilasz z USB komputera, a silniki z osobnego zasilacza 12 V, **połącz ich masy (GND) przewodem**. Bez wspólnego punktu odniesienia 0 V sygnały cyfrowe ze sterownika nie mają jednoznacznego poziomu, co prowadzi do błędów, a w skrajnych przypadkach do uszkodzeń. Wyjątkiem są układy z celową izolacją galwaniczną (np. transoptor), o których mówi osobny artykuł.
:::

:::checklist
- [ ] Sprawdzone napięcie źródła przed podłączeniem do płytki
- [ ] Silniki i przekaźniki zasilane osobno (nie z pinu 3V3)
- [ ] Wszystkie masy (GND) połączone
- [ ] Obliczona moc strat na stabilizatorze
- [ ] Zasilacz ma zapas prądu (min. 500 mA dla Wi-Fi)
:::
"""

COURSES = [{"slug": "podstawy-sprzetu", "title": "Podstawy sprzętu: mikrokontrolery, zegar i zasilanie", "level": "basic", "position": 0,
            "summary": "Czym jest mikrokontroler, co oznacza taktowanie i jak poprawnie zasilić układ."}]

ARTICLES = [
    {"slug": "mcu-vs-mikroprocesor", "kind": "lesson", "course": "podstawy-sprzetu", "position": 1, "level": "basic",
     "title": "Mikrokontroler (MCU) a mikroprocesor (CPU)", "summary": "Czym różni się mikrokontroler od mikroprocesora i kiedy wybrać który.",
     "tags": ["mcu", "cpu", "podstawy"], "body": LESSON_MCU, "widgets": {"quiz-mcu": W_QUIZ_MCU}},
    {"slug": "czestotliwosc-taktowania", "kind": "lesson", "course": "podstawy-sprzetu", "position": 2, "level": "basic",
     "title": "Częstotliwość taktowania: zegar mikrokontrolera", "summary": "Co oznacza zegar 16 MHz lub 240 MHz, ile trwa cykl i czemu większa częstotliwość to większy pobór prądu.",
     "tags": ["zegar", "mhz", "esp32", "arduino"], "body": LESSON_CLOCK, "widgets": {"zegar-kalkulator": W_CLOCK}},
    {"slug": "zasilanie-i-wspolna-masa", "kind": "lesson", "course": "podstawy-sprzetu", "position": 3, "level": "basic",
     "title": "Zasilanie, dystrybucja i wspólna masa", "summary": "Jak zasilać płytkę, kiedy używać LDO, a kiedy przetwornicy, i dlaczego masy muszą być połączone.",
     "tags": ["zasilanie", "ldo", "gnd", "buck"], "body": LESSON_POWER, "widgets": {"ldo-straty": W_LDO}},
]
