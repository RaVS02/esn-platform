"""Partia treści z archiwum (v14): kurs „Transmisja danych w praktyce” (pakietowanie, CRC, kontrola przepływu, łączność bezprzewodowa).
Zmiany merytoryczne względem archiwum: docs/WIEDZA-PILOTAZ.md („Partia v14”)."""
from knowledge_batch_v8 import WIDGET_BASE
from knowledge_batch_v10 import quiz_widget
from knowledge_batch_v13 import BTN

TEMPO = '<label>Tempo animacji</label><select id="sp"><option value="3">wolno</option><option value="1.7">normalnie</option><option value="1">szybko</option></select>'

# ── pakietowanie: narzut i opóźnienie ──
W_BATCH = WIDGET_BASE + BTN + """<div><label>Liczba próbek w jednej ramce: <b class="acc" id="nv">20</b></label><input type="range" id="n" min="1" max="100" value="20">
<label>Częstotliwość próbkowania: <b class="acc" id="fv">500</b> Hz</label><input type="range" id="f" min="100" max="2000" step="100" value="500">
<label>Bajtów na próbkę</label><select id="b"><option>1</option><option selected>2</option><option>4</option></select>
<div style="display:flex;height:22px;margin-top:10px;border-radius:6px;overflow:hidden;border:1px solid #30363d"><div id="hd" style="background:#f85149;min-width:3px"></div><div id="dt" style="background:#3fb950;flex:1"></div></div>
<div style="font-size:11px;color:#9fb0c3;margin-top:3px">czerwony: nagłówek + CRC (8 B: sync 2, seq 1, czas 4, CRC 1) · zielony: dane</div>
<div class="out">Rozmiar ramki: <b id="fs" class="acc"></b> B · narzut: <b id="ov"></b>%<br>Opóźnienie z zebrania ramki: <b id="lat"></b> ms<br>Wymagane łącze (10 bitów/bajt): <b id="bd"></b> baud <span id="ok"></span></div></div>
<script>
function $(i){return document.getElementById(i)}
function calc(){var n=+$('n').value,f=+$('f').value,b=+$('b').value,H=8;$('nv').textContent=n;$('fv').textContent=f;
 var fr=H+n*b,ov=H/fr*100,lat=n/f*1000,bd=fr*10*f/n;
 $('fs').textContent=fr;$('ov').textContent=ov.toFixed(0);$('ov').className=ov>50?'bad':ov>20?'warn':'ok';
 $('lat').textContent=lat.toFixed(0);$('lat').className=lat>100?'warn':'ok';$('bd').textContent=Math.round(bd);
 $('hd').style.width=ov+'%';$('ok').textContent=bd<=115200?'(mieści się w 115200)':'(za dużo dla 115200)';$('ok').className=bd<=115200?'ok':'bad'}
['n','f','b'].forEach(function(x){$(x).addEventListener('input',calc)});calc();
</script>"""

# ── suma kontrolna a CRC ──
W_CRC = WIDGET_BASE + BTN + """<style>.bits span{display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border:1px solid #30363d;border-radius:4px;margin:1px;font-family:ui-monospace,Menlo,monospace;cursor:pointer;user-select:none}
.bits span.f{background:#3a1d1d;border-color:#f85149;color:#f85149}.bits{white-space:nowrap}.hx{display:inline-block;width:34px;color:#9fb0c3;font-family:ui-monospace,Menlo,monospace;font-size:12px}</style>
<div><div style="color:#9fb0c3;font-size:12px;margin-bottom:4px">Kliknij bit, aby go przekłamać (symulacja zakłócenia w transmisji).</div><div class="bits" id="g"></div>
<div style="margin:8px 0"><button id="two">Przekłam 2 bity w tej samej kolumnie</button><button id="rs">Przywróć</button></div>
<div class="out">Oryginał: suma XOR = <b class="acc" id="x0"></b> · CRC-8 = <b class="acc" id="c0"></b><br>Odebrane: suma XOR = <b id="x1"></b> · CRC-8 = <b id="c1"></b><br>
Suma XOR: <b id="vx"></b><br>CRC-8: <b id="vc"></b></div></div>
<script>
function $(i){return document.getElementById(i)}
var ORIG=[0x45,0x53,0x4E,0x2D,0x45,0x4B,0x47,0x31],cur=ORIG.slice();
function xor(a){return a.reduce(function(x,b){return x^b},0)}
function crc8(a){var c=0;a.forEach(function(b){c^=b;for(var i=0;i<8;i++)c=(c&0x80)?((c<<1)^0x07)&255:(c<<1)&255});return c}
function h(v){return ('0'+v.toString(16)).slice(-2).toUpperCase()}
function render(){var g=$('g');g.textContent='';cur.forEach(function(b,r){var row=document.createElement('div');var l=document.createElement('span');l.className='hx';l.style.border='0';l.style.cursor='default';l.textContent=h(b);row.appendChild(l);
  for(var i=7;i>=0;i--){(function(i){var s=document.createElement('span');var bit=(b>>i)&1;s.textContent=bit;if(((ORIG[r]>>i)&1)!==bit)s.className='f';s.addEventListener('click',function(){cur[r]^=(1<<i);render()});row.appendChild(s)})(i)}
  g.appendChild(row)});
 var changed=cur.some(function(b,i){return b!==ORIG[i]});
 $('x0').textContent=h(xor(ORIG));$('c0').textContent=h(crc8(ORIG));$('x1').textContent=h(xor(cur));$('c1').textContent=h(crc8(cur));
 var vx=$('vx'),vc=$('vc');
 if(!changed){vx.textContent='dane bez zmian';vc.textContent='dane bez zmian';vx.className=vc.className='';return}
 var dx=xor(cur)!==xor(ORIG),dc=crc8(cur)!==crc8(ORIG);
 vx.textContent=dx?'błąd wykryty':'BŁĄD NIEWYKRYTY (suma się zgadza)';vx.className=dx?'ok':'bad';
 vc.textContent=dc?'błąd wykryty':'BŁĄD NIEWYKRYTY';vc.className=dc?'ok':'bad'}
$('two').addEventListener('click',function(){cur=ORIG.slice();cur[0]^=0x10;cur[1]^=0x10;render()});
$('rs').addEventListener('click',function(){cur=ORIG.slice();render()});render();
</script>"""

# ── kontrola przepływu ──
W_FLOW = WIDGET_BASE + BTN + """<div><label>Metoda</label><select id="md"><option value="none">brak kontroli</option><option value="xon">XON/XOFF (programowa)</option><option value="rts">RTS/CTS (sprzętowa)</option><option value="ack">ACK po każdym pakiecie</option></select>
<label>Szybkość nadajnika: <b class="acc" id="sv">120</b> pakietów/s</label><input type="range" id="s" min="10" max="200" step="10" value="120">
<label>Szybkość odbiornika: <b class="acc" id="rv">60</b> pakietów/s</label><input type="range" id="r" min="10" max="200" step="10" value="60">
<label>Opóźnienie sygnału / odpowiedzi: <b class="acc" id="dv">150</b> ms</label><input type="range" id="d" min="0" max="400" step="10" value="150">""" + TEMPO + """
<button id="go">Start</button><button id="rs">Reset</button>
<div style="display:flex;gap:3px;flex-wrap:wrap;margin:6px 0" id="cells"></div>
<div class="out">Bufor odbiornika: <b id="b">0</b> / 16 · wysłano: <b id="se">0</b> · odebrano i przetworzono: <b class="ok" id="dl">0</b> · utracono: <b class="bad" id="ls">0</b><br><span id="st">Nadajnik: nadaje</span></div></div>
<script>
function $(i){return document.getElementById(i)}
var CAP=16,buf=0,sent=0,done=0,lost=0,acs=0,acr=0,t=0,paused=false,sig=[],wait=0,timer=null,run=false,flag=false;
function draw(){$('sv').textContent=$('s').value;$('rv').textContent=$('r').value;$('dv').textContent=$('d').value;
 var c=$('cells');c.textContent='';for(var i=0;i<CAP;i++){var e=document.createElement('i');e.style.cssText='width:16px;height:16px;border-radius:3px;border:1px solid '+(i<buf?'#56e1fd':'#30363d')+';background:'+(i<buf?'#0e3a4a':'#161b22');c.appendChild(e)}
 $('b').textContent=buf;$('se').textContent=sent;$('dl').textContent=done;$('ls').textContent=lost;
 var m=$('md').value;$('st').textContent=m==='ack'?(wait>0?'Nadajnik: czeka na potwierdzenie':'Nadajnik: nadaje'):m==='none'?'Nadajnik: nadaje bez względu na bufor':'Nadajnik: '+(paused?'WSTRZYMANY przez odbiornik':'nadaje');}
function tick(){var k=1/(+$('sp').value),dt=0.05*k,m=$('md').value,D=(+$('d').value)/1000;t+=dt;
 acr+=(+$('r').value)*dt;while(acr>=1){acr-=1;if(buf>0){buf--;done++}}
 if(m==='ack'){wait-=dt;if(wait<=0){acs+=(+$('s').value)*dt;if(acs>=1){acs=0;sent++;if(buf<CAP){buf++}else{sent--;}wait=D>0?D:0.02}}}
 else{
  if(m==='xon'||m==='rts'){var dl=m==='rts'?Math.min(D,0.05):D;
   if(!paused&&buf>=12&&!flag){flag=true;sig.push({at:t+dl,v:true})}
   if(paused&&buf<=4&&flag){flag=false;sig.push({at:t+dl,v:false})}
   while(sig.length&&sig[0].at<=t){paused=sig.shift().v}}
  if(!paused){acs+=(+$('s').value)*dt;while(acs>=1){acs-=1;sent++;if(buf<CAP)buf++;else lost++}}}
 draw()}
$('go').addEventListener('click',function(){run=!run;$('go').textContent=run?'Pauza':'Start';clearInterval(timer);if(run)timer=setInterval(tick,50)});
function reset(){buf=sent=done=lost=0;acs=acr=0;t=0;paused=false;sig=[];wait=0;flag=false;draw()}
$('rs').addEventListener('click',reset);$('md').addEventListener('change',reset);['s','r','d'].forEach(function(x){$(x).addEventListener('input',draw)});draw();
</script>"""

# ── MQTT ──
W_MQTT = WIDGET_BASE + BTN + """<div><label>Temat publikacji (wydawca: ESP32)</label><input type="text" id="tp" value="sensor/ekg/pacjent1" style="width:100%;box-sizing:border-box">
<label>Filtr subskrybenta 1 (np. aplikacja Python)</label><input type="text" id="f0" value="sensor/ekg/#" style="width:100%;box-sizing:border-box">
<label>Filtr subskrybenta 2 (np. panel WWW)</label><input type="text" id="f1" value="sensor/+/pacjent1" style="width:100%;box-sizing:border-box">
<label>Filtr subskrybenta 3 (np. alarm)</label><input type="text" id="f2" value="dom/+/temp" style="width:100%;box-sizing:border-box">""" + TEMPO + """
<button id="go">Publikuj ▶</button>
<svg id="s" viewBox="0 0 400 190" width="100%" style="max-height:230px" role="img" aria-label="Przepływ wiadomości MQTT"></svg>
<div class="out" id="t">Wpisz temat i filtry, potem kliknij Publikuj.</div></div>
<script>
function $(i){return document.getElementById(i)}
var NS='http://www.w3.org/2000/svg';
function el(n,a){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);return e}
function match(f,t){var a=f.split('/'),b=t.split('/');for(var i=0;i<a.length;i++){if(a[i]==='#')return i===a.length-1;if(i>=b.length)return false;if(a[i]!=='+'&&a[i]!==b[i])return false}return a.length===b.length}
var step=0,hit=[false,false,false];
function node(g,x,y,w,l,on,col){g.appendChild(el('rect',{x:x,y:y,width:w,height:34,rx:7,fill:on?'#0e3a4a':'#161b22',stroke:on?col:'#30363d','stroke-width':on?2:1}));var t=el('text',{x:x+w/2,y:y+21,fill:on?'#e6edf3':'#9fb0c3','font-size':'11','text-anchor':'middle'});t.textContent=l;g.appendChild(t)}
function draw(){var s=$('s');s.textContent='';
 var pub=step>=1,brk=step>=2,sub=step>=3;
 s.appendChild(el('path',{d:'M90 95 L150 95',stroke:pub?'#56e1fd':'#30363d','stroke-width':2}));
 [0,1,2].forEach(function(i){var y=30+i*60;s.appendChild(el('path',{d:'M250 95 L290 '+(y+17),stroke:sub&&hit[i]?'#3fb950':'#30363d','stroke-width':sub&&hit[i]?3:1,'stroke-dasharray':sub&&hit[i]?'0':'4 4'}))});
 node(s,10,78,80,'ESP32',pub,'#56e1fd');node(s,150,70,100,'Broker',brk,'#ff8c00');
 [0,1,2].forEach(function(i){node(s,290,30+i*60,100,'Subskr. '+(i+1),sub&&hit[i],'#3fb950')});
 var l=el('text',{x:10,y:66,fill:'#9fb0c3','font-size':'9'});l.textContent=$('tp').value.slice(0,28);s.appendChild(l)}
function run(){var T=$('tp').value.trim(),F=[$('f0').value.trim(),$('f1').value.trim(),$('f2').value.trim()],f=+$('sp').value;
 hit=F.map(function(x){return match(x,T)});step=0;draw();$('t').textContent='Wydawca wysyła wiadomość na temat „'+T+'”.';
 setTimeout(function(){step=1;draw()},300*f);
 setTimeout(function(){step=2;draw();$('t').textContent='Broker sprawdza, którzy subskrybenci mają pasujący filtr.'},900*f);
 setTimeout(function(){step=3;draw();var n=hit.filter(Boolean).length;$('t').textContent=n?'Wiadomość dostaje '+n+' z 3 subskrybentów: '+hit.map(function(h,i){return h?(i+1):''}).filter(String).join(', ')+'. Pozostali jej nie widzą.':'Żaden filtr nie pasuje do tematu, więc nikt nie dostaje wiadomości.'},1800*f)}
$('go').addEventListener('click',run);draw();
</script>"""

W_QUIZ_KOM = quiz_widget([
    {"q": "Dlaczego prosta suma XOR jest słabszym zabezpieczeniem niż CRC?", "a": ["Jest wolniejsza", "Nie wykryje dwóch przekłamanych bitów w tej samej kolumnie", "Wymaga więcej pamięci", "Działa tylko dla tekstu"], "ok": 1, "e": "Dwa przekłamania w tej samej pozycji bitowej znoszą się w XOR, a CRC wykrywa taki błąd."},
    {"q": "Co robi sekwencyjny numer ramki (seq) po stronie odbiorcy?", "a": ["Przyspiesza transmisję", "Pozwala wykryć zgubione ramki", "Szyfruje dane", "Naprawia błędy bitowe"], "ok": 1, "e": "Luka w numeracji oznacza utratę ramek, a odbiorca może oznaczyć brakujące próbki."},
    {"q": "Kiedy odbiornik powinien sygnalizować nadajnikowi wstrzymanie (RTS/CTS lub XOFF)?", "a": ["Po całkowitym zapełnieniu bufora", "Zanim bufor się zapełni, z zapasem na bajty w drodze", "Nigdy", "Po każdym bajcie"], "ok": 1, "e": "Nadajnik zareaguje z opóźnieniem, więc próg musi zostawić miejsce na dane, które jeszcze nadejdą."},
    {"q": "Który mechanizm MQTT sprawia, że subskrybent nie musi pytać serwera o nowe dane?", "a": ["Polling", "Publikacja i subskrypcja przez brokera", "Retransmisja TCP", "Broadcast UDP"], "ok": 1, "e": "Broker rozsyła wiadomości do tych, którzy zasubskrybowali pasujący temat."},
])

LESSON_BATCH = """:::summary Szybkie podsumowanie
- Każda ramka ma stały **narzut** (synchronizacja, numer, czas, CRC). Wysyłanie jednej próbki na ramkę marnuje większość łącza.
- **Batching** łączy N próbek w jedną ramkę i obniża narzut do kilkunastu procent, ale **zwiększa opóźnienie** o N/fs.
- Dobór N to kompromis: wydajność łącza kontra opóźnienie i skutki utraty jednej ramki (tracisz N próbek naraz).
:::

## Ile kosztuje nagłówek

Przy ramce z jedną próbką 2-bajtową i nagłówkiem 8 bajtów (sync 2, seq 1, czas 4, CRC 1) narzut wynosi 80 %. Zbierając 20 próbek, ramka ma 48 bajtów, a narzut spada do około 17 %. Zmieniaj parametry i obserwuj kompromis.

:::widget batch-kalkulator 440
:::

:::note Dlaczego liczby są inne niż w pierwotnej wersji
Wcześniejsza wersja liczyła nagłówek bez bajtu CRC (7 B), więc wychodziło 78 % i 15 %. Po doliczeniu CRC jest to 80 % i 17 %. Różnica jest niewielka, ale rachunek musi uwzględniać wszystkie bajty ramki.
:::

## Budowa ramki

:::kv
Bajty 0–1 | sync: 0xAA 0xBB (początek ramki)
Bajt 2 | numer sekwencyjny (seq, 0–255, potem od zera)
Bajty 3–6 | znacznik czasu pierwszej próbki
Bajty 7… | N próbek po 2 bajty
Ostatni bajt | CRC-8 z całej ramki (bez samego CRC)
:::

```cpp Wysyłanie ramek zbiorczych (Arduino / ESP32)
#define BATCH_N 20
int16_t  batchBuf[BATCH_N];
uint8_t  batchIdx = 0;
uint8_t  seqId = 0;
uint32_t batchTs = 0;

uint8_t crc8(const uint8_t* d, size_t n);   // implementacja w lekcji o CRC

void addSample(int16_t s) {
  if (batchIdx == 0) batchTs = millis();    // czas pierwszej próbki w ramce
  batchBuf[batchIdx++] = s;
  if (batchIdx < BATCH_N) return;

  uint8_t frame[7 + BATCH_N * 2 + 1];
  frame[0] = 0xAA; frame[1] = 0xBB; frame[2] = seqId++;
  memcpy(&frame[3], &batchTs, 4);
  memcpy(&frame[7], batchBuf, BATCH_N * 2);
  frame[7 + BATCH_N * 2] = crc8(frame, 7 + BATCH_N * 2);   // CRC obejmuje nagłówek i dane
  Serial.write(frame, sizeof(frame));
  batchIdx = 0;
}
```

:::warn Kolejność bajtów
`memcpy` zapisuje liczby w kolejności procesora (ESP32 i AVR: little-endian). Odbiornik w Pythonie musi użyć tej samej kolejności (np. `struct.unpack('<I', ...)`).
:::

:::checklist
- [ ] Narzut ramki liczony ze wszystkimi bajtami (sync, seq, czas, CRC)
- [ ] Opóźnienie N/fs mieści się w wymaganiach aplikacji
- [ ] Łącze (baud) wystarcza z zapasem
- [ ] Wiadomo, co się stanie po utracie jednej ramki
:::

## Sprawdź się

:::widget quiz-kom 330
:::
"""

LESSON_CRC = """:::summary Szybkie podsumowanie
- Odbiorca musi umieć stwierdzić, czy ramka dotarła nieuszkodzona. Nadawca dokłada do ramki **sumę kontrolną**, a odbiorca liczy ją ponownie i porównuje.
- Prosta **suma XOR** jest szybka, ale ma słabość: dwa przekłamane bity w tej samej kolumnie się znoszą.
- **CRC** (np. CRC-8) traktuje dane jak wielomian i wykrywa znacznie więcej błędów, a liczy się równie szybko.
- **Numer sekwencyjny** (seq) wykrywa zgubione ramki, a CRC wykrywa uszkodzone.
:::

## Wypróbuj: kiedy suma XOR zawodzi

Kliknij pojedynczy bit, a potem sprawdź przycisk „Przekłam 2 bity w tej samej kolumnie”. W pierwszym przypadku obie metody wykrywają błąd, w drugim XOR go nie widzi.

:::widget crc-xor-demo 470
:::

:::warn „CRC-8 (XOR)” to dwie różne rzeczy
W pierwotnym przykładzie funkcja nazywała się `calcCRC8`, ale wykonywała tylko XOR wszystkich bajtów. To suma kontrolna, a nie CRC. Prawdziwe CRC-8 używa wielomianu (tu 0x07), jak poniżej.
:::

:::tabs
=== C++ (Arduino / ESP32)
```cpp CRC-8, wielomian 0x07
uint8_t crc8(const uint8_t* d, size_t n) {
  uint8_t crc = 0;
  while (n--) {
    crc ^= *d++;
    for (uint8_t i = 0; i < 8; i++)
      crc = (crc & 0x80) ? (uint8_t)((crc << 1) ^ 0x07) : (uint8_t)(crc << 1);
  }
  return crc;
}
```
=== Python (odbiornik)
```python CRC-8 i sprawdzenie ramki
def crc8(data: bytes) -> int:
    crc = 0
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = ((crc << 1) ^ 0x07) & 0xFF if crc & 0x80 else (crc << 1) & 0xFF
    return crc

def frame_ok(frame: bytes) -> bool:
    return len(frame) > 1 and crc8(frame[:-1]) == frame[-1]
```
:::

## Wykrywanie zgubionych ramek

CRC sprawdza zawartość ramki, a nie jej obecność. Do wykrywania luk służy numer sekwencyjny, który po 255 wraca do 0 (dlatego różnicę liczymy modulo 256).

```python Wykrywanie luk i uzupełnianie braków
import numpy as np

expected = 0
samples = []

def on_frame(seq, data):            # data: lista próbek z jednej ramki
    global expected
    lost = (seq - expected) % 256
    if lost:
        samples.extend([np.nan] * (lost * len(data)))   # oznaczamy brakujące próbki
    samples.extend(data)
    expected = (seq + 1) % 256

def fill_gaps(x):
    x = np.array(x, dtype=float)
    bad = np.isnan(x)
    x[bad] = np.interp(np.flatnonzero(bad), np.flatnonzero(~bad), x[~bad])
    return x                         # interpolacja liniowa między sąsiednimi próbkami
```

:::note Ograniczenia
Jeśli zginie dokładnie 256 kolejnych ramek, numer sekwencyjny wróci do tej samej wartości i luka pozostanie niewykryta (przy dodatkowym znaczniku czasu nie jest to problem). Interpolacja ma sens tylko dla krótkich luk: długą przerwę lepiej zostawić oznaczoną jako brak danych.
:::

:::steps Co robi odbiorca z każdą ramką
Szukaj sync | Odrzuć bajty, aż trafisz na 0xAA 0xBB
Sprawdź CRC | Uszkodzoną ramkę odrzuć, nie zgaduj
Sprawdź seq | Luka oznacza zgubione ramki, więc oznacz brakujące próbki
Zapisz dane | Dopiero teraz próbki trafiają do analizy
:::

## Sprawdź się

:::widget quiz-kom 330
:::
"""

LESSON_FLOW = """:::summary Szybkie podsumowanie
- **Kontrola przepływu** zapobiega zalaniu wolniejszego odbiornika przez szybszego nadawcę.
- **ACK/NACK**: nadawca czeka na potwierdzenie każdego pakietu. Pewne, ale wolne (zależy od opóźnienia łącza).
- **RTS/CTS**: dedykowane linie sprzętowe, działają bez obciążania procesora. **XON/XOFF**: specjalne bajty (0x11 i 0x13), tylko dla tekstu.
- W strumieniach czasu rzeczywistego często **nie retransmituje się** zgubionych ramek, tylko wykrywa luki (seq) i uzupełnia je.
:::

## Porównanie metod

| Metoda | Mechanizm | Narzut | Implementacja | Zastosowanie |
|---|---|---|---|---|
| ACK/NACK | Potwierdzenie po każdym pakiecie | Wysoki (czas odpowiedzi) | Programowa | Konfiguracja, pliki, dane nieczasowe |
| RTS/CTS | 2 dodatkowe linie sprzętowe wstrzymują nadajnik | Zerowy | Sprzętowa (UART z obsługą) | Szybki UART, moduły z RTS/CTS |
| XON/XOFF | Bajty sterujące 0x11 (XON) i 0x13 (XOFF) | Niewielki | Programowa | Wyłącznie transmisja tekstowa |
| Bez retransmisji + seq | Luki wykrywa odbiorca i uzupełnia | Minimalny | Programowa | Strumienie czasu rzeczywistego (EKG, audio) |

## Zobacz różnicę w działaniu

Porównaj metody przy szybkim nadajniku i wolnym odbiorniku. Zwróć uwagę, że przy dużym opóźnieniu sygnału nawet XON/XOFF może spóźnić się z reakcją i bufor się przepełni.

:::widget kontrola-przeplywu 520
:::

:::info Próg z zapasem
Odbiornik powinien zgłosić „stop” **zanim** bufor się zapełni (tu przy 12 z 16), bo nadajnik zareaguje z opóźnieniem i jeszcze wyśle kilka pakietów. Wznawiać należy z histerezą (tu przy 4 z 16), żeby sygnał nie migał co chwilę.
:::

:::warn XON/XOFF a dane binarne
Bajty 0x11 i 0x13 mogą pojawić się w danych binarnych (np. jako część liczby) i zostaną wzięte za polecenia sterujące. Dlatego XON/XOFF stosuje się tylko do tekstu. Dla danych binarnych wybierz RTS/CTS albo protokół z własnym potwierdzaniem.
:::

## Retransmisja czy uzupełnianie braków

:::sequence Utrata ramki
Nadajnik, Odbiornik
Nadajnik -> Odbiornik : ramka 7
Nadajnik -> Odbiornik : ramka 8 (zginęła)
Nadajnik -> Odbiornik : ramka 9
Odbiornik -> Odbiornik : luka w numerach: brak 8
Odbiornik -> Odbiornik : oznacz brakujące próbki i uzupełnij
:::

:::pros BEZ RETRANSMISJI
- stałe, krótkie opóźnienie
- prosty nadajnik
- dobre dla sygnałów, w których liczy się bieżący obraz
:::

:::cons Z RETRANSMISJĄ
- opóźnienie rośnie i jest zmienne
- potrzeba bufora po stronie odbiorcy
- zgubione dane trafiają z opóźnieniem
:::

:::note Dobór strategii
W pierwotnej wersji napisano, że w sygnałach medycznych „nigdy nie wolno opóźniać sygnału”. To zasada projektowa dla podglądu na żywo, a nie prawo natury: przy zapisie do analizy offline można retransmitować, a opóźnione próbki uporządkować według znacznika czasu. Wybór zależy od wymagań: podgląd w czasie rzeczywistym kontra kompletność danych.
:::

## Sprawdź się

:::widget quiz-kom 330
:::
"""

LESSON_WIRELESS = """:::summary Szybkie podsumowanie
- **Wi-Fi + TCP/HTTP**: gwarancja dostawy, większy narzut. **Wi-Fi + UDP**: bez retransmisji, mały narzut, ramki mogą zginąć. **MQTT**: lekka publikacja i subskrypcja przez brokera, standard w IoT.
- **Bluetooth Classic (SPP)**: wirtualny port szeregowy, prosty, ale energochłonny. **BLE**: bardzo oszczędny, dane w usługach i charakterystykach (GATT).
- Wybór łączności wyznacza architekturę całej aplikacji (odbiornik, broker, serwer).
:::

## Porównanie

| Technologia | Zalety | Ograniczenia |
|---|---|---|
| Wi-Fi TCP / HTTP | Gwarancja dostawy, łatwa integracja z siecią | Narzut, opóźnienia przy retransmisjach |
| Wi-Fi UDP | Małe opóźnienie, prosty strumień | Utrata pakietów, brak kontroli kolejności |
| Wi-Fi MQTT | Broker rozsyła dane, wiele odbiorców, gotowe poziomy jakości usługi (QoS) | Potrzebny broker, dodatkowy element systemu |
| Bluetooth Classic (SPP) | Wirtualny UART, prosta obsługa | Większy pobór prądu; dostępny tylko w części układów (np. klasyczny ESP32) |
| Bluetooth LE | Miesiące pracy na baterii pastylkowej | Nauka modelu GATT, mała przepustowość |

:::flow Wybór łączności
(s) Potrzeba przesyłu bezprzewodowego
{a} Zasilanie bateryjne i małe porcje danych?
[b] BLE
{c} Wiele odbiorców lub integracja z IoT?
[d] Wi-Fi + MQTT
{e} Strumień czasu rzeczywistego, mały narzut?
[f] Wi-Fi + UDP
[g] Wi-Fi + TCP / HTTP
s -> a
a -> b : tak
a -> c : nie
c -> d : tak
c -> e : nie
e -> f : tak
e -> g : nie
:::

## MQTT w ruchu

Wydawca publikuje wiadomość na **temat** (np. `sensor/ekg/pacjent1`), a broker dostarcza ją tym subskrybentom, których **filtr** pasuje. Znak `+` zastępuje jeden poziom tematu, a `#` wszystkie pozostałe (tylko na końcu). Zmień temat i filtry, aby zobaczyć, kto dostanie wiadomość.

:::widget mqtt-symulator 480
:::

:::def
Temat (topic) | Hierarchiczna nazwa kanału, np. `dom/salon/temp`.
QoS 0 / 1 / 2 | Poziom jakości: co najwyżej raz, co najmniej raz, dokładnie raz. Wyższy poziom daje pewność kosztem narzutu.
Retained | Broker zapamiętuje ostatnią wiadomość i wysyła ją od razu nowym subskrybentom.
:::

```cpp ESP32: publikacja MQTT (biblioteka PubSubClient)
#include <WiFi.h>
#include <PubSubClient.h>

WiFiClient net;
PubSubClient mqtt(net);

void setup() {
  WiFi.begin("SSID", "HASLO");
  while (WiFi.status() != WL_CONNECTED) delay(200);
  mqtt.setServer("192.168.1.10", 1883);        // adres brokera (np. Mosquitto)
}

void loop() {
  if (!mqtt.connected()) mqtt.connect("esp32-ekg");
  mqtt.loop();                                  // obsługa połączenia, wywołuj często
  mqtt.publish("sensor/ekg/pacjent1", "{\\"v\\":512}");
  delay(1000);
}
```

:::warn Uwagi praktyczne
- Domyślny port 1883 jest **nieszyfrowany**. Poza siecią domową używaj TLS (port 8883) i logowania do brokera.
- Stos Wi-Fi i Bluetooth w ESP32 w Arduino działa domyślnie na rdzeniu 0, więc długie blokowanie tego rdzenia może przerwać połączenie. Własne zadania czasowo krytyczne warto przenieść na drugi rdzeń lub do osobnego zadania.
- UDP nie ma własnych retransmisji, ale warstwa Wi-Fi je ma, więc czasem pojawia się chwilowy wzrost opóźnienia (jitter). „Brak opóźnień” to uproszczenie.
:::

## Sprawdź się

:::widget quiz-kom 330
:::
"""

COURSES = [{"slug": "transmisja-danych-w-praktyce", "title": "Transmisja danych w praktyce", "level": "advanced", "position": 6,
            "summary": "Pakietowanie, CRC, numery sekwencyjne, kontrola przepływu i łączność bezprzewodowa (Wi-Fi, BLE, MQTT)."}]

ARTICLES = [
    {"slug": "pakietowanie-batching-i-narzut", "kind": "lesson", "course": "transmisja-danych-w-praktyce", "position": 1, "level": "intermediate",
     "title": "Pakietowanie: batching, narzut i opóźnienie", "summary": "Jak łączenie próbek w ramki zmniejsza narzut łącza i co kosztuje opóźnieniem.",
     "tags": ["ramka", "batching", "narzut", "uart"], "body": LESSON_BATCH, "widgets": {"batch-kalkulator": W_BATCH, "quiz-kom": W_QUIZ_KOM}},
    {"slug": "crc-i-numer-sekwencyjny", "kind": "lesson", "course": "transmisja-danych-w-praktyce", "position": 2, "level": "intermediate",
     "title": "CRC, suma XOR i numer sekwencyjny", "summary": "Jak wykryć uszkodzoną i zgubioną ramkę: porównanie sumy XOR z CRC-8 i detekcja luk.",
     "tags": ["crc", "xor", "seq", "ramka"], "body": LESSON_CRC, "widgets": {"crc-xor-demo": W_CRC, "quiz-kom": W_QUIZ_KOM}},
    {"slug": "kontrola-przeplywu-ack-rts-xon", "kind": "lesson", "course": "transmisja-danych-w-praktyce", "position": 3, "level": "advanced",
     "title": "Kontrola przepływu: ACK/NACK, RTS/CTS, XON/XOFF", "summary": "Symulator zalania bufora, porównanie metod i decyzja: retransmitować czy uzupełniać braki.",
     "tags": ["flow control", "rts", "cts", "xon", "ack"], "body": LESSON_FLOW, "widgets": {"kontrola-przeplywu": W_FLOW, "quiz-kom": W_QUIZ_KOM}},
    {"slug": "lacznosc-bezprzewodowa-wifi-ble-mqtt", "kind": "lesson", "course": "transmisja-danych-w-praktyce", "position": 4, "level": "intermediate",
     "title": "Łączność bezprzewodowa: Wi-Fi, BLE i MQTT", "summary": "Porównanie technologii, schemat wyboru i symulator publikacji MQTT z filtrami tematów.",
     "tags": ["wifi", "ble", "mqtt", "udp", "bluetooth"], "body": LESSON_WIRELESS, "widgets": {"mqtt-symulator": W_MQTT, "quiz-kom": W_QUIZ_KOM}},
]
