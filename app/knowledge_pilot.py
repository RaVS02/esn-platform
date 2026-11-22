"""Przykładowe treści (pilotaż) wygenerowane z dotychczasowego „Niezbędnika Systemów Wbudowanych".
Dodawane tylko do PUSTEJ bazy wiedzy (patrz knowledge_service.seed_pilot, wyłączenie: KNOWLEDGE_SEED=0).
Treść jest wiernym przeniesieniem; uwagi merytoryczne do decyzji autora: docs/WIEDZA-PILOTAZ.md."""

COURSES = [{'slug': 'komunikacja-szeregowa', 'title': 'Komunikacja szeregowa i transmisja danych', 'level': 'basic', 'position': 1, 'summary': 'Od wyboru formatu danych, przez budowę ramki, po obliczenia przepustowości łącza UART.'}]

ARTICLES = [
 {
  'slug': 'typy-pinow-i-poziomy-logiczne',
  'kind': 'essential',
  'level': 'basic',
  'title': 'Typy pinów i poziomy logiczne',
  'summary': 'Ściąga: rodzaje pinów mikrokontrolera (GPIO, ADC, PWM, magistrale) i dlaczego 5 V potrafi zniszczyć układ 3,3 V.',
  'tags': ['pinout', 'gpio', 'logika', 'esp32'],
  'body': r''':::summary Szybkie podsumowanie
- **GPIO:** Piny ogólnego przeznaczenia (wejścia/wyjścia cyfrowe).
- **ADC / DAC:** Piny analogowe (czytanie / generowanie płynnych napięć).
- **Logika 3.3V vs 5V:** ESP32 działa na 3.3V. Podanie 5V na pin GPIO natychmiast go spali!
:::

:::card Zrozumienie pinoutu (mapy płytki)
Mikrokontrolery komunikują się ze światem przez fizyczne wyprowadzenia. Na schematach (pinoutach) są one kodowane kolorami. Jeden fizyczny pin często pełni kilka funkcji, które wybieramy w kodzie oprogramowania (tzw. multipleksowanie).
:::

:::kv
<span class="badge badge-accent">Digital (GPIO)</span> | Odbiera lub wysyła stany logiczne (0 lub 1 / LOW lub HIGH).
<span class="badge badge-green">Analog (ADC)</span> | Czyta płynne napięcie (np. z potencjometru). ESP32 ma ADC 12-bitowe.
<span class="badge badge-orange">PWM</span> | Udaje sygnał analogowy poprzez bardzo szybkie miganie pinem cyfrowym (sterowanie jasnością LED, silnikami).
<span class="badge badge-purple">Komunikacja</span> | Sprzętowe piny dla UART (TX/RX), I2C (SDA/SCL) oraz SPI (MOSI/MISO/SCK).
:::

:::danger Krytyczne: poziomy logiczne (3.3V vs 5V)
Starsze systemy (jak Arduino UNO) operują na logice <span class="text-red">5V</span>. Nowoczesne układy (ESP32, STM32, Raspberry Pi) operują na <span class="text-red">3.3V</span>. Jeśli podłączysz czujnik 5V bezpośrednio do pinu RX w ESP32, napięcie „przebije" zabezpieczenia i <span class="text-red">spali cały mikrokontroler</span>. Zawsze używaj <span class="text-red">dwukierunkowych konwerterów poziomów logicznych</span> (Level Shifter)!
:::''',
  'position': 1,
 },
 {
  'slug': 'adc-przetworniki-analogowo-cyfrowe',
  'kind': 'article',
  'level': 'basic',
  'title': 'ADC — przetworniki analogowo-cyfrowe i rozdzielczość',
  'summary': 'Jak mikrokontroler zamienia napięcie na liczbę, co oznacza 10, 12 i 24 bity oraz jak rozdzielczość wpływa na jakość pomiaru.',
  'tags': ['adc', 'rozdzielczość', 'pomiar', 'ekg'],
  'body': r''':::summary Szybkie podsumowanie
- ADC zamienia napięcie → liczbę. Bitowość = ile „schodków" w zakresie 0–Vref.
- 10-bit (Arduino): 1024 wartości. 12-bit (ESP32): 4096. 24-bit (medyczne): 16M.
- Dane 24-bit → pakuj w `uint32_t` (bajt MSB zawsze = 0).
:::

:::card Czym jest przetwornik ADC i rozdzielczość?
Mikrokontrolery to urządzenia w pełni cyfrowe – operują wyłącznie na zerach i jedynkach. Świat fizyczny jest jednak analogowy i płynny. Napięcie na czujniku EKG zmienia się w sposób ciągły. Przetwornik Analogowo-Cyfrowy (ADC) to układ, który działa jak tłumacz: mierzy to płynne napięcie w danej chwili i przypisuje mu konkretną, dyskretną liczbę całkowitą.

Kluczowym parametrem ADC jest jego **rozdzielczość** podawana w bitach. Określa ona, na ile „schodków" przetwornik potrafi podzielić mierzony zakres napięcia (np. od 0 do 3.3V). Im więcej bitów, tym schodki są drobniejsze, a pomiar wierniejszy. Przykładowo, 10-bitowy przetwornik w Arduino dzieli sygnał zaledwie na 1024 schodki, gubiąc drobne detale. Z kolei dedykowane medyczne układy 24-bitowe potrafią rozpoznać mikroskopijne zmiany rzędu mikrowoltów, co jest niezbędne, aby wyłapać subtelne załamki sygnału kardiologicznego.
:::

:::figure Rozdzielczość ADC — porównanie bitowości
<svg viewBox="0 0 700 200" xmlns="http://www.w3.org/2000/svg" width="100%">
              <defs>
                <linearGradient id="grad10" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--red)" stop-opacity="0.8"/>
                  <stop offset="100%" stop-color="var(--red)" stop-opacity="0.1"/>
                </linearGradient>
                <linearGradient id="grad12" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--orange)" stop-opacity="0.8"/>
                  <stop offset="100%" stop-color="var(--orange)" stop-opacity="0.1"/>
                </linearGradient>
                <linearGradient id="grad24" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--green)" stop-opacity="0.8"/>
                  <stop offset="100%" stop-color="var(--green)" stop-opacity="0.1"/>
                </linearGradient>
              </defs>
              <rect x="20" y="30" width="180" height="130" rx="6" fill="var(--card)" stroke="var(--border)"/>
              <text x="110" y="22" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--text2)">Arduino R3</text>
              <rect x="35" y="40" width="30" height="110" rx="2" fill="var(--border)"/>
              <rect x="35" y="100" width="30" height="50" rx="2" fill="url(#grad10)" stroke="none"/>
              <text x="115" y="75" text-anchor="middle" font-family="var(--mono)" font-size="22" fill="var(--red)" font-weight="700">10-bit</text>
              <text x="115" y="100" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--text2)">1 024 kroków</text>
              <text x="115" y="118" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--text2)">~4.9 mV / krok</text>
              <text x="115" y="148" text-anchor="middle" font-family="var(--mono)" font-size="10" fill="var(--text3)">hobbystyczny</text>
              <rect x="260" y="30" width="180" height="130" rx="6" fill="var(--card)" stroke="var(--border)"/>
              <text x="350" y="22" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--text2)">ESP32</text>
              <rect x="275" y="40" width="30" height="110" rx="2" fill="var(--border)"/>
              <rect x="275" y="70" width="30" height="80" rx="2" fill="url(#grad12)" stroke="none"/>
              <text x="355" y="75" text-anchor="middle" font-family="var(--mono)" font-size="22" fill="var(--orange)" font-weight="700">12-bit</text>
              <text x="355" y="100" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--text2)">4 096 kroków</text>
              <text x="355" y="118" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--text2)">~0.8 mV / krok</text>
              <text x="355" y="148" text-anchor="middle" font-family="var(--mono)" font-size="10" fill="var(--text3)">automatyka</text>
              <rect x="500" y="30" width="180" height="130" rx="6" fill="rgba(0,255,136,0.05)" stroke="rgba(0,255,136,0.2)"/>
              <text x="590" y="22" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--green)">ADS1293 / medyczne</text>
              <rect x="515" y="40" width="30" height="110" rx="2" fill="var(--border)"/>
              <rect x="515" y="40" width="30" height="110" rx="2" fill="url(#grad24)" stroke="none"/>
              <text x="595" y="75" text-anchor="middle" font-family="var(--mono)" font-size="22" fill="var(--green)" font-weight="700">24-bit</text>
              <text x="605" y="100" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--text2)">16 777 216 kroków</text>
              <text x="595" y="118" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--text2)">&lt;0.3 µV / krok</text>
              <text x="600" y="148" text-anchor="middle" font-family="var(--mono)" font-size="10" fill="var(--green)">→ pakuj w uint32</text>
              <text x="350" y="185" text-anchor="middle" font-family="var(--mono)" font-size="10" fill="var(--text3)">Rozdzielczość rośnie wykładniczo: każdy bit to ×2 więcej kroków</text>
            </svg>
:::

:::card Sprawdź sam: jak bitowość zmienia pomiar
Przesuń suwak poniżej. Niebieska linia to prawdziwe napięcie, pomarańczowa to wartość, którą „widzi" mikrokontroler po przetworzeniu przez ADC. Przy 2–4 bitach sinusoida zamienia się w schody, przy 12 bitach (ESP32) prawie nie widać różnicy.
:::

:::widget adc-kwantyzacja 430
:::''',
  'widgets': {'adc-kwantyzacja': r'''<!doctype html>
<html lang="pl"><head><meta charset="utf-8">
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:14px 16px;background:#0e1117;color:#e0eaf5;font:13px/1.5 'JetBrains Mono',ui-monospace,monospace}
  .row{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:10px}
  label{color:#8a9ab5}
  b{color:#56e1fd}
  input[type=range]{flex:1;min-width:160px;accent-color:#56e1fd}
  .legend{display:flex;gap:16px;font-size:11px;color:#8a9ab5;margin:4px 0 8px}
  .legend i{display:inline-block;width:14px;height:3px;vertical-align:middle;margin-right:6px;border-radius:2px}
  svg{display:block;width:100%;height:auto;background:#080b10;border:1px solid #1e2a3a;border-radius:8px}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-top:10px}
  .s{background:#141920;border:1px solid #1e2a3a;border-radius:8px;padding:8px 10px}
  .s small{display:block;color:#5a6a80;font-size:10px;letter-spacing:.05em}
  .s strong{font-size:17px;color:#e0eaf5}
  .hint{margin-top:10px;color:#5a6a80;font-size:11px}
</style></head><body>
<div class="row">
  <label>Rozdzielczość: <b id="bv">4</b> bit</label>
  <input type="range" id="bits" min="1" max="12" value="4" aria-label="Rozdzielczość przetwornika w bitach">
</div>
<div class="legend"><span><i style="background:#56e1fd"></i>napięcie wejściowe (analogowe)</span><span><i style="background:#ff8c00"></i>to, co widzi ADC (cyfrowo)</span></div>
<svg id="pl" viewBox="0 0 640 220" role="img" aria-label="Wykres sygnału sinusoidalnego i jego wersji skwantowanej"></svg>
<div class="stats">
  <div class="s"><small>LICZBA POZIOMÓW</small><strong id="lv"></strong></div>
  <div class="s"><small>KROK (LSB) przy 3,3 V</small><strong id="lsb"></strong></div>
  <div class="s"><small>MAKS. BŁĄD POMIARU</small><strong id="er"></strong></div>
  <div class="s"><small>ODCZYT DLA 1,65 V</small><strong id="mid"></strong></div>
</div>
<div class="hint">Wzór: LSB = Vref / 2<sup>N</sup>. Każdy dodatkowy bit zmniejsza krok o połowę.</div>
<script>
(function(){
  var VREF=3.3, W=640, H=220, PAD=14, N=96, NS="http://www.w3.org/2000/svg";
  var bits=document.getElementById("bits"), pl=document.getElementById("pl");
  function fmt(v){ return v>=1 ? v.toFixed(2).replace(".",",")+" V" : v>=0.0001 ? (v*1000).toFixed(v>=0.01?1:2).replace(".",",")+" mV" : (v*1e6).toFixed(v>=0.00001?1:2).replace(".",",")+" µV"; }
  function el(n,a){ var e=document.createElementNS(NS,n); for(var k in a) e.setAttribute(k,a[k]); return e; }
  function y(v){ return H-PAD-(v/VREF)*(H-2*PAD); }
  function x(i){ return PAD+(i/(N-1))*(W-2*PAD); }
  function draw(){
    var b=+bits.value, levels=Math.pow(2,b), lsb=VREF/levels;
    document.getElementById("bv").textContent=b;
    document.getElementById("lv").textContent=levels.toLocaleString("pl-PL");
    document.getElementById("lsb").textContent=fmt(lsb);
    document.getElementById("er").textContent="< "+fmt(lsb);
    var code=Math.min(levels-1,Math.floor((1.65/VREF)*levels));
    document.getElementById("mid").textContent=code.toLocaleString("pl-PL");
    pl.textContent="";
    for(var g=0; g<=4; g++){ var gy=y(VREF*g/4); pl.appendChild(el("line",{x1:PAD,x2:W-PAD,y1:gy,y2:gy,stroke:"#1e2a3a","stroke-width":1})); }
    var sine=[], q=[];
    for(var i=0;i<N;i++){
      var v=VREF/2+(VREF/2-0.02)*Math.sin(i/(N-1)*Math.PI*4);
      var c=Math.min(levels-1,Math.max(0,Math.floor(v/lsb)));
      sine.push(x(i)+","+y(v)); q.push([x(i),y(c*lsb)]);
    }
    var d="M"+q[0][0]+","+q[0][1];
    for(var j=1;j<N;j++){ d+=" H"+q[j][0]+" V"+q[j][1]; }
    pl.appendChild(el("path",{d:d,fill:"none",stroke:"#ff8c00","stroke-width":2}));
    pl.appendChild(el("polyline",{points:sine.join(" "),fill:"none",stroke:"#56e1fd","stroke-width":2,opacity:.9}));
    pl.appendChild(el("text",{x:PAD+2,y:y(VREF)-3,fill:"#5a6a80","font-size":10})).textContent="3,3 V";
    pl.appendChild(el("text",{x:PAD+2,y:y(0)-3,fill:"#5a6a80","font-size":10})).textContent="0 V";
  }
  bits.addEventListener("input",draw); draw();
})();
</script>
</body></html>
'''},
  'position': 1,
 },
 {
  'slug': 'ascii-vs-binarny',
  'kind': 'lesson',
  'course': 'komunikacja-szeregowa',
  'level': 'basic',
  'position': 1,
  'title': 'Komunikacja szeregowa: tekst (ASCII) czy dane binarne',
  'summary': 'Dwa sposoby wysyłania liczb przez UART: czytelny, ale wolny tekst oraz szybki, kompaktowy format binarny.',
  'tags': ['uart', 'serial', 'struct', 'python'],
  'body': r''':::summary Szybkie podsumowanie
- Format tekstowy (ASCII) – czytelny, wolny, „puchnie"; używaj do debugowania.
- Format binarny – szybki, mały; jedyna opcja dla ≥500 Hz. Wymaga `struct` w Pythonie.
- ASCII: liczba 4000 → 4 bajty. Binarnie: 4000 → 2 bajty (int16).
:::

:::card Format tekstowy (ASCII)
Zasada: wartości liczbowe są zamieniane na ciąg znaków (np. `analogRead()` → `"1024\n"`) i wysyłane bajt po bajcie. Każda cyfra to osobny bajt ASCII.

Czytelne bezpośrednio w Serial Monitorze ArduinoIDE. Proste parsowanie po stronie Pythona (`split()`, `int()`). Jednak liczba `4000` zajmuje **4 bajty** zamiast możliwych 2 bajtów w formacie binarnym.
:::

:::pros PLUSY — ASCII
- Debug w locie (Serial Monitor)
- Trivialny parsing: `split()`
- Łatwe prototypowanie
:::

:::cons MINUSY — ASCII
- Bardzo wolny (3–5× więcej bajtów)
- Obciąża CPU konwersją
- Niedopuszczalny przy ≥200 Hz
:::

:::card Format binarny
Wysyłamy surowy stan pamięci RAM – np. 2 bajty int16_t bezpośrednio przez UART. Brak konwersji na tekst, zerowy narzut na procesor, idealne dla szybkiego próbkowania (EKG 500 Hz, akcelerometr).

Po stronie Pythona używamy biblioteki `struct` do dekodowania: `struct.unpack('<h', data)`. W Serial Monitorze widać „krzaczki" – nie jest to problem, bo debugujemy inaczej (np. przez własny dekoder).
:::

:::pros PLUSY — BINARNY
- Maksymalna przepustowość
- Minimalne zużycie CPU
- Jedyna opcja dla ≥500 Hz
:::

:::cons MINUSY — BINARNY
- Wymaga dekodera po stronie PC
- „Krzaczki" w Serial Monitorze
- Trudniejszy initial setup
:::

:::figure Pipeline — ASCII vs Binarny
<svg viewBox="0 0 760 180" xmlns="http://www.w3.org/2000/svg" width="100%" style="max-width:760px">
            <defs>
              <marker id="arrowGrey" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#3a4a5a"/>
              </marker>
              <marker id="arrowBlue" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#00d4ff"/>
              </marker>
              <marker id="arrowGreen" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#00ff88"/>
              </marker>
            </defs>
            <rect x="10" y="20" width="100" height="44" rx="6" fill="#1a2030" stroke="#243040"/>
            <text x="60" y="38" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#8a9ab5">ADC</text>
            <text x="60" y="54" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="#e0eaf5">1024</text>
            <line x1="110" y1="42" x2="148" y2="42" stroke="#3a4a5a" stroke-width="1.5" marker-end="url(#arrowGrey)"/>
            <rect x="150" y="20" width="130" height="44" rx="6" fill="#1a2030" stroke="#243040"/>
            <text x="215" y="37" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#ffab70">itoa() / sprintf()</text>
            <text x="215" y="55" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="#e0eaf5">"1024\n" = 5 B</text>
            <line x1="280" y1="42" x2="318" y2="42" stroke="#3a4a5a" stroke-width="1.5" marker-end="url(#arrowGrey)"/>
            <rect x="320" y="20" width="130" height="44" rx="6" fill="#1a2030" stroke="#243040"/>
            <text x="385" y="37" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#8a9ab5">UART 115200</text>
            <text x="385" y="55" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="#e0eaf5">50 bitów/send</text>
            <line x1="450" y1="42" x2="488" y2="42" stroke="#3a4a5a" stroke-width="1.5" marker-end="url(#arrowGrey)"/>
            <rect x="490" y="20" width="130" height="44" rx="6" fill="#1a2030" stroke="#243040"/>
            <text x="555" y="37" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#8a9ab5">Python</text>
            <text x="555" y="55" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="#e0eaf5">int(line.strip())</text>
            <text x="380" y="12" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#ff4466" font-weight="600">ASCII — wolno, czytelnie</text>
            <rect x="10" y="112" width="100" height="44" rx="6" fill="rgba(0,212,255,0.08)" stroke="rgba(0,212,255,0.3)"/>
            <text x="60" y="130" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#8a9ab5">ADC</text>
            <text x="60" y="146" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="#e0eaf5">1024</text>
            <line x1="110" y1="134" x2="148" y2="134" stroke="#00d4ff" stroke-width="1.5" marker-end="url(#arrowBlue)"/>
            <rect x="150" y="112" width="130" height="44" rx="6" fill="rgba(0,212,255,0.08)" stroke="rgba(0,212,255,0.3)"/>
            <text x="215" y="129" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#00d4ff">cast uint16_t</text>
            <text x="215" y="147" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="#e0eaf5">0x04 0x00 = 2 B</text>
            <line x1="280" y1="134" x2="318" y2="134" stroke="#00d4ff" stroke-width="1.5" marker-end="url(#arrowBlue)"/>
            <rect x="320" y="112" width="130" height="44" rx="6" fill="rgba(0,212,255,0.08)" stroke="rgba(0,212,255,0.3)"/>
            <text x="385" y="129" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#00d4ff">UART 115200</text>
            <text x="385" y="147" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="#e0eaf5">20 bitów/send</text>
            <line x1="450" y1="134" x2="488" y2="134" stroke="#00d4ff" stroke-width="1.5" marker-end="url(#arrowBlue)"/>
            <rect x="490" y="112" width="130" height="44" rx="6" fill="rgba(0,212,255,0.08)" stroke="rgba(0,212,255,0.3)"/>
            <text x="555" y="129" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#00d4ff">Python</text>
            <text x="555" y="147" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="#e0eaf5">struct.unpack('H')</text>
            <text x="380" y="104" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#00ff88" font-weight="600">BINARNY — szybko, wydajnie</text>
          </svg>
:::

```python Dekodowanie binarne — struct
import serial
import struct

ser = serial.Serial('/dev/ttyUSB0', 115200)

while True:
    # Czekaj na sync word: 0xAA 0xBB
    if ser.read(1) == b'\xAA' and ser.read(1) == b'\xBB':
        raw = ser.read(8)          # 8 bajtów danych
        # Format: uint32 timestamp, int16 ecg, int16 accel_x
        ts, ecg, ax = struct.unpack('<IhH', raw)
        print(f"t={ts}ms  ecg={ecg}  ax={ax}")
```

```cpp C++ / Arduino: wysyłanie binarne
// Wysyłanie surowych bajtów struct przez UART
uint16_t adc_val = analogRead(A0);     // 0–1023
uint8_t  header[] = {0xAA, 0xBB};
Serial.write(header, 2);
Serial.write((uint8_t*)&adc_val, sizeof(adc_val));
// Razem: 4 bajty zamiast np. "1024\n" = 5 bajtów ASCII
```

:::info Pro tip
Binarny przesył redukuje liczbę przesyłanych bajtów o ponad 50%, co pozwala na osiągnięcie znacznie wyższych częstotliwości próbkowania przy tym samym Baud Rate.
:::''',
 },
 {
  'slug': 'budowa-ramki-binarnej',
  'kind': 'lesson',
  'course': 'komunikacja-szeregowa',
  'level': 'intermediate',
  'position': 2,
  'title': 'Budowa ramki binarnej (struct)',
  'summary': 'Jak ułożyć dane w pamięci bez „dziur" i zbudować ramkę z nagłówkiem, numerem sekwencji i sumą kontrolną.',
  'tags': ['struct', 'packed', 'ramka', 'crc'],
  'body': r''':::card struct + __attribute__((packed))
Kompilator C domyślnie dodaje „padding" (puste bajty) między polami struktury, aby wyrównać je do granic pamięci. Atrybut `__attribute__((packed))` lub `#pragma pack(1)` nakazuje kompilatorowi układać pola bez żadnych odstępów, co jest krytyczne dla transmisji surowych bajtów.
:::

:::figure Anatomia ramki binarnej — układ bajtów w pamięci
<svg viewBox="0 0 720 120" xmlns="http://www.w3.org/2000/svg" width="100%">
            <rect x="20"  y="30" width="50" height="40" rx="4" fill="rgba(255,140,0,0.15)" stroke="rgba(255,140,0,0.5)"/>
            <text x="45"  y="47" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#ffab70">SYNC</text>
            <text x="45"  y="62" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#ff8c00" font-weight="600">0xAA</text>
            <rect x="72"  y="30" width="50" height="40" rx="4" fill="rgba(255,140,0,0.15)" stroke="rgba(255,140,0,0.5)"/>
            <text x="97"  y="47" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#ffab70">SYNC</text>
            <text x="97"  y="62" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#ff8c00" font-weight="600">0xBB</text>
            <rect x="124" y="30" width="50" height="40" rx="4" fill="rgba(157,111,255,0.12)" stroke="rgba(157,111,255,0.4)"/>
            <text x="149" y="47" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#9d6fff">SEQ ID</text>
            <text x="149" y="62" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#c0a0ff" font-weight="600">uint8</text>
            <rect x="176" y="30" width="100" height="40" rx="4" fill="rgba(0,212,255,0.1)" stroke="rgba(0,212,255,0.3)"/>
            <text x="226" y="47" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#00d4ff">TIMESTAMP</text>
            <text x="226" y="62" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#00d4ff" font-weight="600">uint32 · 4B</text>
            <rect x="278" y="30" width="75" height="40" rx="4" fill="rgba(0,255,136,0.1)" stroke="rgba(0,255,136,0.3)"/>
            <text x="315" y="47" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#00ff88">ECG</text>
            <text x="315" y="62" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#00ff88" font-weight="600">int16 · 2B</text>
            <rect x="355" y="30" width="75" height="40" rx="4" fill="rgba(0,255,136,0.1)" stroke="rgba(0,255,136,0.3)"/>
            <text x="392" y="47" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#00ff88">ACCEL_X</text>
            <text x="392" y="62" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#00ff88" font-weight="600">int16 · 2B</text>
            <rect x="432" y="30" width="75" height="40" rx="4" fill="rgba(0,255,136,0.1)" stroke="rgba(0,255,136,0.3)"/>
            <text x="469" y="47" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#00ff88">ACCEL_Y</text>
            <text x="469" y="62" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#00ff88" font-weight="600">int16 · 2B</text>
            <rect x="509" y="30" width="75" height="40" rx="4" fill="rgba(255,68,102,0.1)" stroke="rgba(255,68,102,0.3)"/>
            <text x="546" y="47" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#ff4466">CRC</text>
            <text x="546" y="62" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#ff4466" font-weight="600">uint8 · 1B</text>
            <text x="45"  y="92" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#5a6a80">B0</text>
            <text x="97"  y="92" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#5a6a80">B1</text>
            <text x="149" y="92" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#5a6a80">B2</text>
            <text x="226" y="92" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#5a6a80">B3–B6</text>
            <text x="315" y="92" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#5a6a80">B7–B8</text>
            <text x="392" y="92" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#5a6a80">B9–B10</text>
            <text x="469" y="92" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#5a6a80">B11–B12</text>
            <text x="546" y="92" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#5a6a80">B13</text>
            <text x="620" y="55" font-family="JetBrains Mono" font-size="10" fill="#00d4ff" font-weight="600">= 14 B</text>
            <text x="620" y="70" font-family="JetBrains Mono" font-size="9" fill="#5a6a80">na ramkę</text>
          </svg>
:::

```cpp C++ / Arduino: definicja i wysyłka struktury packed
#pragma pack(push, 1)   // = __attribute__((packed))
struct DataFrame {
  uint8_t  sync0;   // 0xAA
  uint8_t  sync1;   // 0xBB
  uint8_t  seqId;   // numer sekwencyjny 0–255
  uint32_t ts;      // timestamp millis()
  int16_t  ecg;     // próbka EKG
  int16_t  ax;      // akcelerometr X
  int16_t  ay;      // akcelerometr Y
  uint8_t  crc;     // suma kontrolna
};
#pragma pack(pop) // = Przywraca domyślne wyrównywanie danych w pamięci.

DataFrame frame;
uint8_t   seqCounter = 0;

void sendFrame(int16_t ecg, int16_t ax, int16_t ay) {
  frame.sync0 = 0xAA;
  frame.sync1 = 0xBB;
  frame.seqId = seqCounter++;
  frame.ts    = millis();
  frame.ecg   = ecg;
  frame.ax    = ax;
  frame.ay    = ay;
  frame.crc   = calcCRC((uint8_t*)&frame, sizeof(frame) - 1);
  Serial.write((uint8_t*)&frame, sizeof(frame));
}
```''',
 },
 {
  'slug': 'waskie-gardla-baud-rate',
  'kind': 'lesson',
  'course': 'komunikacja-szeregowa',
  'level': 'intermediate',
  'position': 3,
  'title': 'Wąskie gardła: matematyka baud rate',
  'summary': 'Ile bitów naprawdę zajmuje bajt na łączu UART i jak policzyć, jaki baud rate jest potrzebny do Twojego projektu.',
  'tags': ['baud', 'uart', 'przepustowość'],
  'body': r''':::summary Szybkie podsumowanie
- 1 bajt danych = ~10 bitów na łączu UART (start + 8 bitów + stop).
- 500 Hz × 10 B/ramkę × 10 bit/B = **50 000 b/s** → wymaga min. 115200 baud.
- 9600 baud przy 500 Hz = natychmiastowe przepełnienie bufora i utrata danych.
:::

:::card Obliczanie wymaganego baud rate
Każdy bajt wysyłany przez UART zajmuje na łączu faktycznie **10 bitów**: 1 bit startu + 8 bitów danych + 1 bit stopu. To narzut 25% ponad wartość użytkową.
:::

| Konfiguracja | Ramka | Częstotl. | Wymagane b/s | Baud Rate | Status |
|---|---|---|---|---|---|
| Debug ASCII, 1 czujnik | ~12 B | 10 Hz | 1 200 b/s | 9600 | ✓ OK |
| Binarny, 3 czujniki | 14 B | 100 Hz | 14 000 b/s | 19200 | ✓ OK |
| EKG binarny, 500 Hz | 10 B | 500 Hz | 50 000 b/s | 115200 | ✓ OK |
| EKG ASCII, 500 Hz | ~35 B | 500 Hz | 175 000 b/s | 115200 | ✗ PRZEPEŁNI |
| Multi-modal, 8 kan., 1 kHz | 40 B | 1000 Hz | 400 000 b/s | 460800 / Wi-Fi | ⚠ Wi-Fi/BT |

:::note Wzór matematyczny
Wymagane_baudrate = Częstotliwość [Hz] × Rozmiar_ramki [B] × 10

Zawsze dobieraj baud rate z 30–50% zapasem, bo wbudowany sprzętowy bufor UART ma tylko 64 bajty pojemności.
:::''',
 },
]
