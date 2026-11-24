"""Partia treści z archiwum (v15): kurs „Dane i liczby w pamięci” (typy stałego rozmiaru, U2 i rozszerzenie znaku, kolejność bajtów, float).
To ostatnia sekcja archiwum niezawarta wcześniej w bazie. Zmiany merytoryczne: docs/WIEDZA-PILOTAZ.md („Partia v15”)."""
from knowledge_batch_v8 import WIDGET_BASE
from knowledge_batch_v10 import quiz_widget
from knowledge_batch_v13 import BTN

# ── zakres i zawijanie typów ──
W_RANGE = WIDGET_BASE + BTN + """<div><label>Typ</label><select id="ty"><option value="u8">uint8_t</option><option value="i8">int8_t</option><option value="u16">uint16_t</option><option value="i16">int16_t</option><option value="u32">uint32_t</option><option value="i32">int32_t</option></select>
<label>Wartość zapisana w zmiennej</label><input type="text" id="v" value="250" size="14"> 
<div style="margin-top:8px"><button data-d="1">+1</button><button data-d="-1">−1</button><button data-d="10">+10</button><button data-d="-10">−10</button><button data-d="100">+100</button></div>
<div class="out" id="o"></div></div>
<script>
function $(i){return document.getElementById(i)}
var s=250,note='';
function spec(){var t=$('ty').value,n=+t.slice(1),sg=t[0]==='i',M=Math.pow(2,n);return {n:n,sg:sg,M:M,min:sg?-M/2:0,max:sg?M/2-1:M-1}}
function wrap(v,sp){var w=((v%sp.M)+sp.M)%sp.M;if(sp.sg&&w>=sp.M/2)w-=sp.M;return w}
function show(){var sp=spec(),u=((s%sp.M)+sp.M)%sp.M,b=u.toString(2);while(b.length<sp.n)b='0'+b;var g=b.replace(/(.{8})(?=.)/g,'$1 ');
 $('o').innerHTML='';function line(k,v,c){var d=document.createElement('div');d.appendChild(document.createTextNode(k+' '));var e=document.createElement('b');e.textContent=v;if(c)e.className=c;d.appendChild(e);$('o').appendChild(d)}
 line('Rozmiar:',(sp.n/8)+' B ('+sp.n+' bitów)');line('Zakres:',sp.min+' … '+sp.max);line('Zapisano:',String(s),'acc');line('Bity:',g,'ok');
 if(note)line('',note,'bad');
 $('v').value=String(s)}
function set(v){var sp=spec();var w=wrap(v,sp);note=(w!==v)?'Przepełnienie: '+v+' nie mieści się w zakresie, zmienna zawinęła się do '+w+'.':'';s=w;show()}
document.querySelectorAll('button[data-d]').forEach(function(b){b.addEventListener('click',function(){set(s+(+b.getAttribute('data-d')))})});
$('v').addEventListener('change',function(){var n=parseInt($('v').value,10);if(isNaN(n))n=0;set(n)});
$('ty').addEventListener('change',function(){set(s)});show();
</script>"""

# ── 24 bity ze znakiem: krok po kroku ──
W_SIGNEXT = WIDGET_BASE + BTN + """<style>.c32 span{display:inline-block;width:11px;height:20px;line-height:20px;text-align:center;font-size:9px;border:1px solid #30363d;border-radius:2px;margin:0;font-family:ui-monospace,Menlo,monospace;color:#6e7681}
.c32 span.a{border-color:#56e1fd;color:#56e1fd}.c32 span.b{border-color:#3fb950;color:#3fb950}.c32 span.c{border-color:#ff8c00;color:#ff8c00}.c32 span.x{border-color:#f85149;color:#f85149;background:#2a1111}
.c32 i{display:inline-block;width:6px}.row{overflow-x:auto;white-space:nowrap;padding-bottom:4px}</style>
<div><label>Trzy bajty z układu ADC (MSB pierwszy), hex</label>
<input type="text" id="b0" value="FF" size="3" maxlength="2"> <input type="text" id="b1" value="FE" size="3" maxlength="2"> <input type="text" id="b2" value="0C" size="3" maxlength="2">
<div style="margin:6px 0"><button id="p1">Przykład: dodatnia</button><button id="p2">Przykład: ujemna</button></div>
<div class="row"><div class="c32" id="reg"></div></div>
<div style="color:#9fb0c3;font-size:11px;margin:4px 0">bity 31…24 | 23…16 (bajt 0) | 15…8 (bajt 1) | 7…0 (bajt 2)</div>
<div style="margin:8px 0"><button id="nx">Dalej →</button><button id="rs">Od nowa</button></div>
<div class="out"><span id="t"></span><br>Odczyt jako int32_t: <b id="v" class="acc"></b></div></div>
<script>
function $(i){return document.getElementById(i)}
var step=0;
function by(i){var n=parseInt($('b'+i).value,16);return isNaN(n)?0:n&255}
var MSG=['Zmienna raw = 0: żadnych danych jeszcze nie ma.',
 'Krok 1: (uint32_t)buf[0] << 16. Najstarszy bajt ląduje na bitach 23…16. Rzutowanie na 32 bity PRZED przesunięciem jest konieczne, bo na AVR int ma 16 bitów.',
 'Krok 2: raw |= (uint32_t)buf[1] << 8. Środkowy bajt trafia na bity 15…8.',
 'Krok 3: raw |= buf[2]. Najmłodszy bajt na bitach 7…0. Mamy liczbę 24-bitową, ale bity 31…24 wciąż są zerami.',
 ''];
function compute(){var b=[by(0),by(1),by(2)],raw=0,src=[];for(var i=0;i<32;i++)src.push(null);
 var bits=[];for(var i=0;i<32;i++)bits.push(0);
 function put(byte,lo,cls){for(var k=0;k<8;k++){bits[lo+k]=(byte>>k)&1;src[lo+k]=cls}}
 if(step>=1)put(b[0],16,'a');if(step>=2)put(b[1],8,'b');if(step>=3)put(b[2],0,'c');
 var neg=step>=3&&bits[23]===1;
 if(step>=4&&neg){for(var k=24;k<32;k++){bits[k]=1;src[k]='x'}}
 var v=0;for(var i=31;i>=0;i--)v=v*2+bits[i];var sv=v>=2147483648?v-4294967296:v;
 return {bits:bits,src:src,sv:sv,neg:neg}}
function draw(){var c=compute(),r=$('reg');r.textContent='';
 for(var i=31;i>=0;i--){var s=document.createElement('span');s.textContent=c.bits[i];if(c.src[i])s.className=c.src[i];r.appendChild(s);if(i%8===0&&i>0){r.appendChild(document.createElement('i'))}}
 $('v').textContent=c.sv;
 var t=MSG[Math.min(step,3)];
 if(step>=4)t=c.neg?'Krok 4: bit 23 = 1, więc liczba jest ujemna (kod U2). Bity 31…24 wypełniamy jedynkami (raw |= 0xFF000000). Dopiero teraz int32_t ma poprawną wartość ujemną.':'Krok 4: bit 23 = 0, więc liczba jest dodatnia i nic nie trzeba wypełniać (górny bajt zostaje 0).';
 $('t').textContent=t;$('nx').disabled=step>=4}
$('nx').addEventListener('click',function(){if(step<4){step++;draw()}});
$('rs').addEventListener('click',function(){step=0;draw()});
['b0','b1','b2'].forEach(function(x){$(x).addEventListener('change',function(){step=0;draw()})});
function pre(a,b,c){$('b0').value=a;$('b1').value=b;$('b2').value=c;step=0;draw()}
$('p1').addEventListener('click',function(){pre('00','12','34')});$('p2').addEventListener('click',function(){pre('FF','FE','0C')});draw();
</script>"""

# ── kolejność bajtów ──
W_ENDIAN = WIDGET_BASE + BTN + """<div><label>Liczba 32-bitowa (hex, do 8 cyfr)</label><input type="text" id="h" value="12345678" size="10" maxlength="8">
<div style="margin-top:8px"><div style="color:#9fb0c3;font-size:12px">Little-endian (AVR, ESP32, ARM Cortex-M, PC): najmłodszy bajt pod najniższym adresem</div><div id="le" style="display:flex;gap:4px;margin:4px 0 10px"></div>
<div style="color:#9fb0c3;font-size:12px">Big-endian (porządek sieciowy, wiele układów SPI/I2C wysyła MSB pierwszy): najstarszy bajt pierwszy</div><div id="be" style="display:flex;gap:4px;margin:4px 0"></div></div>
<div class="out" id="t"></div></div>
<script>
function $(i){return document.getElementById(i)}
function cell(c,addr,v,col){var d=document.createElement('div');d.style.cssText='flex:1;text-align:center;padding:6px 2px;border-radius:6px;border:1px solid '+col+';background:#0d1117';var a=document.createElement('div');a.style.cssText='font-size:10px;color:#6e7681';a.textContent='adres +'+addr;var b=document.createElement('div');b.style.cssText='font-family:ui-monospace,Menlo,monospace;font-size:15px;color:'+col;b.textContent=v;d.appendChild(a);d.appendChild(b);c.appendChild(d)}
function draw(){var s=$('h').value.replace(/[^0-9a-fA-F]/g,'');while(s.length<8)s='0'+s;s=s.slice(-8).toUpperCase();
 var by=[s.slice(0,2),s.slice(2,4),s.slice(4,6),s.slice(6,8)],cols=['#56e1fd','#3fb950','#ff8c00','#ff7bd5'];
 $('le').textContent='';$('be').textContent='';
 for(var i=0;i<4;i++){cell($('le'),i,by[3-i],cols[3-i]);cell($('be'),i,by[i],cols[i])}
 $('t').textContent='Liczba 0x'+s+' w pamięci little-endian: '+by.slice().reverse().join(' ')+'; w big-endian: '+by.join(' ')+'. Dane wysłane przez memcpy/Serial.write(&x, 4) bez przekształcenia trafią na łącze w porządku procesora.'}
$('h').addEventListener('input',draw);draw();
</script>"""

# ── dokładność float ──
W_FLOAT = WIDGET_BASE + BTN + """<div><label>Liczba całkowita (np. czas w ms)</label><input type="text" id="n" value="16777217" size="14">
<div style="margin-top:8px"><button data-v="16777217">16 777 217</button><button data-v="100000001">100 000 001</button><button data-v="86400001">86 400 001 (doba + 1 ms)</button><button data-v="1000">1000</button></div>
<div class="out" id="o"></div></div>
<script>
function $(i){return document.getElementById(i)}
function show(){var n=parseInt($('n').value,10);if(isNaN(n))n=0;var f=Math.fround(n),e=n===0?0:Math.floor(Math.log2(Math.abs(n))),ulp=n===0?0:Math.pow(2,e-23);
 var o=$('o');o.textContent='';function line(k,v,c){var d=document.createElement('div');d.appendChild(document.createTextNode(k+' '));var b=document.createElement('b');b.textContent=v;if(c)b.className=c;d.appendChild(b);o.appendChild(d)}
 line('Liczba:',String(n));line('Po zapisie w float (32 bity):',String(f),f===n?'ok':'bad');
 line('Najmniejszy krok float przy tej wielkości:',String(ulp));
 line('Wynik:',f===n?'liczba zapisana dokładnie':'błąd '+(f-n)+': float nie potrafi zapisać tej liczby','');
 if(f!==n)line('','Dlatego znaczniki czasu i liczniki trzymamy w uint32_t, a nie w float.','warn')}
$('n').addEventListener('input',show);document.querySelectorAll('button[data-v]').forEach(function(b){b.addEventListener('click',function(){$('n').value=b.getAttribute('data-v');show()})});show();
</script>"""

W_QUIZ_DANE = quiz_widget([
    {"q": "Dlaczego w kodzie wymieniającym dane z innymi urządzeniami używamy uint16_t zamiast int?", "a": ["Bo int jest wolniejszy", "Bo rozmiar int zależy od platformy (16 bitów na AVR, 32 na ESP32)", "Bo int nie obsługuje liczb dodatnich", "To tylko konwencja"], "ok": 1, "e": "Typy z <stdint.h> mają stały rozmiar, więc format danych jest taki sam na każdej platformie."},
    {"q": "Złożono 24-bitową liczbę 0xFFFE0C w zmiennej 32-bitowej. Czego brakuje, aby odczytać ją jako liczbę ujemną?", "a": ["Rzutowania na float", "Rozszerzenia znaku (wypełnienia bitów 31…24 jedynkami)", "Przesunięcia w prawo", "Niczego"], "ok": 1, "e": "Bit 23 jest bitem znaku, więc przy jedynce górny bajt trzeba wypełnić jedynkami."},
    {"q": "Co się stanie po dodaniu 1 do uint8_t o wartości 255?", "a": ["Wartość 256", "Błąd kompilacji", "Zawinięcie do 0", "Zatrzymanie na 255"], "ok": 2, "e": "Typy bez znaku zawijają się modulo 2^n, co dla uint8_t daje 0."},
    {"q": "Dlaczego uint32_t, a nie float, nadaje się na licznik milisekund?", "a": ["float jest zawsze wolniejszy", "float ma 24 bity znaczące i traci dokładność powyżej ok. 16,7 mln", "uint32_t zajmuje mniej pamięci", "float nie obsługuje liczb dodatnich"], "ok": 1, "e": "Powyżej 2^24 float nie reprezentuje już każdej liczby całkowitej."},
])

LESSON_TYPY = """:::summary Szybkie podsumowanie
- Rozmiar `int` zależy od platformy: **16 bitów** na Arduino Uno R3 (AVR), **32 bity** na ESP32 i Uno R4. Kod, który zakłada rozmiar, psuje format danych po zmianie płytki.
- Używaj typów z `<stdint.h>`: `uint8_t`, `int16_t`, `uint32_t` i podobnych. Mają stały rozmiar na każdej platformie.
- Przepełnienie typu bez znaku **zawija** się modulo 2ⁿ (255 + 1 = 0 dla `uint8_t`), a ze znakiem zachowanie jest w C/C++ niezdefiniowane, więc nie polegaj na nim.
- Do liczników czasu i znaczników czasu używaj **typów całkowitych bez znaku**, a nie `float`.
:::

## Pułapka: ten sam kod, inna płytka

Piszesz `int x = analogRead(A0);` i wysyłasz `x` jako dwa bajty. Na Uno `int` ma 2 bajty i wszystko działa. Ten sam kod na ESP32 ma 4-bajtowy `int`: ramka zmienia długość i odbiornik czyta śmieci. Rozwiązanie jest proste: zawsze podawaj rozmiar wprost.

| Typ | Rozmiar | Zakres | Typowe użycie |
|---|---|---|---|
| `uint8_t` | 1 B | 0 … 255 | Bajt, numer sekwencyjny, flagi |
| `int8_t` | 1 B | −128 … 127 | Mała wartość ze znakiem |
| `uint16_t` | 2 B | 0 … 65 535 | ADC 10/12-bit, czas w ms (krótki) |
| `int16_t` | 2 B | −32 768 … 32 767 | Próbki EKG, akcelerometr |
| `uint32_t` | 4 B | 0 … 4 294 967 295 | Znacznik czasu, dane 24-bit bez znaku |
| `int32_t` | 4 B | −2³¹ … 2³¹−1 | Dane 24-bit ze znakiem po rozszerzeniu |
| `float` | 4 B | ≈ ±3,4·10³⁸, ok. 7 cyfr | Wartości fizyczne po przeliczeniu |

```cpp Typy stałego rozmiaru
#include <stdint.h>

// Źle: rozmiar zależy od płytki
int val = analogRead(A0);

// Dobrze: stały rozmiar na każdej platformie
uint16_t val16 = (uint16_t)analogRead(A0);
uint32_t tstamp = millis();            // millis() zwraca unsigned long (32 bity)
```

:::note Poprawka względem pierwotnej wersji
Pierwotny przykład oznaczał `long tstamp = millis();` jako błąd rozmiaru. Na AVR i ESP32 `long` ma 32 bity, więc rozmiar jest taki sam. Prawdziwy problem to **znak**: `long` jest ze znakiem i przepełni się po ok. 24,8 dniach, a `uint32_t` po ok. 49,7 dniach. Dlatego do czasu zalecamy `uint32_t`.
:::

## Zakres i zawijanie w praktyce

Wybierz typ i dodawaj liczby, aż przekroczysz zakres. Obserwuj, jak zmieniają się bity.

:::widget zakres-typow 460
:::

:::warn `float` w przerwaniach
Na układach bez jednostki zmiennoprzecinkowej (AVR) operacje na `float` są programowe i wolne. Na ESP32 jest sprzętowe FPU, ale używanie go w przerwaniu wymaga zachowania kontekstu FPU i bywa ograniczone. W ISR zapisuj surowe liczby całkowite, a przeliczaj na wartości fizyczne w pętli głównej.
:::

## Float nie jest licznikiem

`float` ma 24 bity znaczące, więc powyżej 16 777 216 (2²⁴) nie zapisze już każdej liczby całkowitej. Sprawdź to na przykładach.

:::widget float-dokladnosc 380
:::

:::checklist
- [ ] Wszystkie pola ramki mają typy z `<stdint.h>`
- [ ] Liczniki i znaczniki czasu są typu bez znaku
- [ ] `float` używany do wartości fizycznych, a nie do liczników
- [ ] `sizeof` kluczowych struktur sprawdzony na obu platformach
:::

## Sprawdź się

:::widget quiz-dane 330
:::
"""

LESSON_U2 = """:::summary Szybkie podsumowanie
- Przetworniki medyczne (np. ADS1293) zwracają próbki **24-bitowe**, wysyłane jako 3 bajty, najstarszy pierwszy.
- Składamy je w 32-bitowej zmiennej: bajt 0 `<< 16`, bajt 1 `<< 8`, bajt 2. Każdy bajt **najpierw rzutujemy na `uint32_t`**, bo na 8- i 16-bitowych procesorach przesunięcie o 16 w typie `int` gubi bity.
- Liczby ujemne w kodzie **U2** wymagają **rozszerzenia znaku**: jeśli bit 23 jest jedynką, bity 31…24 wypełniamy jedynkami.
:::

## Składanie bajtów w liczbę

Układ wysyła trzy bajty. Pierwszy z nich niesie najstarsze bity (MSB), więc ląduje najwyżej. Prześledź to krok po kroku: wpisz własne bajty albo wybierz przykład i naciskaj „Dalej”.

:::widget rozszerzenie-znaku 430
:::

:::note Dlaczego rzutowanie jest krytyczne
Wyrażenie `buf[0] << 16` jest liczone w typie `int`. Na AVR `int` ma 16 bitów, więc przesunięcie o 16 wypycha wszystkie bity i zostaje zero (zachowanie praktycznie wadliwe, a formalnie niezdefiniowane). Rzutowanie `(uint32_t)buf[0] << 16` robi „szufladę” 32-bitową jeszcze przed przesunięciem.
:::

## Kod: jeden kanał

```cpp 24 bity ze znakiem (rozszerzenie znaku)
uint32_t raw = (uint32_t)buf[0] << 16;
raw |= (uint32_t)buf[1] << 8;
raw |= (uint32_t)buf[2];

if (raw & 0x00800000) {          // bit 23 = bit znaku
  raw |= 0xFF000000;             // wypełnij górny bajt jedynkami
}
int32_t value = (int32_t)raw;    // dopiero teraz wartość ze znakiem
```

:::tabs
=== Alternatywa (bez if)
```cpp Rozszerzenie znaku przesunięciem
// przesuń bit znaku na pozycję 31, a potem cofnij przesunięciem arytmetycznym
int32_t value = (int32_t)(raw << 8) >> 8;
```
Przesunięcie w prawo liczby ze znakiem jest w praktyce arytmetyczne w typowych kompilatorach (GCC, Clang) i od C++20 jest zdefiniowane w standardzie. W starszych standardach to zachowanie zależne od implementacji, dlatego wersja z `if` jest przenośniejsza.
=== Wiele kanałów
```cpp Rozpakowanie 3 kanałów po 3 bajty
uint8_t buf[9];                       // dane odczytane po SPI/I2C
int32_t ch[3];
for (int i = 0; i < 3; i++) {
  int o = i * 3;                      // każdy kanał zajmuje 3 bajty
  uint32_t raw = ((uint32_t)buf[o] << 16) | ((uint32_t)buf[o + 1] << 8) | buf[o + 2];
  if (raw & 0x00800000) raw |= 0xFF000000;
  ch[i] = (int32_t)raw;
}
```
:::

:::warn Sprawdź notę układu
Kolejność bajtów (MSB pierwszy czy LSB pierwszy) i to, czy wynik jest w kodzie U2, czy w kodzie przesuniętym (offset binary), zależą od układu. Zawsze potwierdź to w nocie katalogowej, bo błąd da sygnał „odwrócony” lub przesunięty o połowę skali.
:::

:::info Po co górny bajt
Po rozszerzeniu znaku górny bajt `int32_t` jest 0x00 (liczba dodatnia) albo 0xFF (ujemna). To już nie jest „pusty wypełniacz”, a część wartości. Dlatego do wysyłki wystarczą 3 bajty, ale do liczenia potrzebny jest typ 32-bitowy.
:::

## Sprawdź się

:::widget quiz-dane 330
:::
"""

LESSON_ENDIAN = """:::summary Szybkie podsumowanie
- **Endianness** to kolejność bajtów wielobajtowej liczby w pamięci lub na łączu. **Little-endian** (AVR, ESP32, ARM Cortex-M, PC): najmłodszy bajt pierwszy. **Big-endian** (porządek sieciowy, wiele układów): najstarszy pierwszy.
- Wysłanie struktury lub zmiennej wprost z pamięci (`memcpy`, `Serial.write(&x, 4)`) przenosi **kolejność procesora**. Odbiornik musi użyć tej samej (np. `struct.unpack('<I', ...)`).
- Najbezpieczniej składać bajty jawnie przesunięciami, bo wtedy kod nie zależy od procesora.
- Licznik czasu `uint32_t` zawija się po ok. 49,7 dniach, ale **odejmowanie** `now - prev` działa poprawnie także przy zawinięciu.
:::

## Jak liczba leży w pamięci

Wpisz liczbę 32-bitową i zobacz układ bajtów w obu porządkach.

:::widget kolejnosc-bajtow 400
:::

## Jawna serializacja

```cpp Niezależnie od procesora
// wysyłamy uint16_t jako big-endian (MSB pierwszy)
buf[0] = (uint8_t)(v >> 8);
buf[1] = (uint8_t)(v & 0xFF);

// odbiór
uint16_t v2 = ((uint16_t)buf[0] << 8) | buf[1];
```

:::tabs
=== Python: little-endian
```python Odbiór liczb little-endian
import struct
seq, ts, sample = struct.unpack('<BIh', frame[:7])   # uint8, uint32, int16
```
=== Python: big-endian
```python Odbiór liczb big-endian
import struct
(value,) = struct.unpack('>H', frame[:2])             # uint16, MSB pierwszy
```
:::

:::sequence Wysyłka liczby 0x1234 przez UART (little-endian)
ESP32, Odbiornik
ESP32 -> Odbiornik : bajt 0x34 (młodszy)
ESP32 -> Odbiornik : bajt 0x12 (starszy)
Odbiornik -> Odbiornik : składa 0x12 << 8 | 0x34 = 0x1234
:::

## Zawijanie licznika czasu

`millis()` zwraca `uint32_t` i po ok. 49,7 dniach wraca do zera. Porównanie `if (now > deadline)` w takim momencie zawodzi, a odejmowanie nie:

```cpp Bezpieczne porównanie czasu
uint32_t now = millis();
if ((uint32_t)(now - prev) >= INTERVAL) {   // działa także tuż po zawinięciu
  prev += INTERVAL;
  // ...
}
```

Dzieje się tak, bo arytmetyka na typach bez znaku jest modulo 2³², więc różnica dwóch momentów jest poprawna dopóki jest mniejsza niż pełny zakres. Zawijanie możesz sprawdzić w widgecie z lekcji o typach stałego rozmiaru (wybierz `uint32_t` i wpisz liczbę bliską maksimum).

:::pros ZAWSZE
- jawne przesunięcia bitowe przy serializacji
- odejmowanie czasu zamiast porównania bezwzględnego
- typy z `<stdint.h>`
:::

:::cons UNIKAJ
- wysyłania struktur bez sprawdzenia wyrównania i kolejności bajtów
- `delay()`-owego myślenia o czasie jako o „liczbie bez końca”
- zakładania rozmiaru `int` i `long`
:::

## Sprawdź się

:::widget quiz-dane 330
:::
"""

COURSES = [{"slug": "dane-i-liczby-w-pamieci", "title": "Dane i liczby w pamięci", "level": "intermediate", "position": 7,
            "summary": "Typy o stałym rozmiarze, liczby ze znakiem (U2), kolejność bajtów i dokładność float: jak liczby leżą w pamięci i na łączu."}]

ARTICLES = [
    {"slug": "typy-stalego-rozmiaru-stdint", "kind": "lesson", "course": "dane-i-liczby-w-pamieci", "position": 1, "level": "basic",
     "title": "Typy stałego rozmiaru (stdint.h), zawijanie i float", "summary": "Dlaczego nie ufać rozmiarowi int, jak zawijają się typy i dlaczego float nie nadaje się na licznik.",
     "tags": ["stdint", "uint8_t", "int", "float", "przepełnienie"], "body": LESSON_TYPY,
     "widgets": {"zakres-typow": W_RANGE, "float-dokladnosc": W_FLOAT, "quiz-dane": W_QUIZ_DANE}},
    {"slug": "dane-24-bit-u2-rozszerzenie-znaku", "kind": "lesson", "course": "dane-i-liczby-w-pamieci", "position": 2, "level": "intermediate",
     "title": "Dane 24-bitowe: składanie bajtów, U2 i rozszerzenie znaku", "summary": "Krok po kroku od trzech bajtów z ADC do liczby ze znakiem w int32_t, także dla wielu kanałów.",
     "tags": ["u2", "sign extension", "adc", "24 bit", "ads1293"], "body": LESSON_U2,
     "widgets": {"rozszerzenie-znaku": W_SIGNEXT, "quiz-dane": W_QUIZ_DANE}},
    {"slug": "kolejnosc-bajtow-endianness-zawijanie", "kind": "lesson", "course": "dane-i-liczby-w-pamieci", "position": 3, "level": "intermediate",
     "title": "Kolejność bajtów (endianness) i zawijanie czasu", "summary": "Little i big-endian, jawna serializacja, odbiór w Pythonie oraz bezpieczne porównywanie czasu.",
     "tags": ["endianness", "struct", "millis", "serializacja"], "body": LESSON_ENDIAN,
     "widgets": {"kolejnosc-bajtow": W_ENDIAN, "quiz-dane": W_QUIZ_DANE}},
]
