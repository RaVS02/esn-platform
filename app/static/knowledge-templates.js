/* Szablony widgetów dla panelu redakcji ESN.
 * Każdy widget to samodzielny HTML + CSS + JS uruchamiany w izolowanej ramce (sandbox, CSP bez sieci).
 * Wybierz szablon w edytorze (sekcja „Widgety”) i dostosuj teksty/liczby – albo poproś Claude o nowy (zobacz „Instrukcja”).
 */
(function (global) {
  var BASE = "<style>body{font:14px/1.5 system-ui,sans-serif;color:#e6edf3;padding:12px}" +
    "label{display:block;margin:8px 0 2px;color:#9fb0c3;font-size:12px}input[type=range]{width:100%}" +
    "input[type=number],select{background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:6px 8px;font:inherit}" +
    "button{background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:6px 12px;font:inherit;cursor:pointer}button:hover{border-color:#56e1fd}" +
    ".out{margin-top:10px;padding:10px 12px;background:#0d1117;border:1px solid #30363d;border-radius:8px;font-family:ui-monospace,Menlo,monospace}" +
    ".acc{color:#56e1fd}.ok{color:#3fb950}.bad{color:#f85149}</style>";

  var T = [];

  T.push({ id: "pusty", name: "Pusty", desc: "szkielet HTML + CSS + JS", height: 240, code:
    BASE + "<div id=\"app\"><p>Tytuł widgetu</p><button id=\"b\">Kliknij</button><div class=\"out\" id=\"o\">…</div></div>\n" +
    "<script>\nvar n = 0;\ndocument.getElementById('b').addEventListener('click', function () {\n  n++; document.getElementById('o').textContent = 'Kliknięto ' + n + ' razy';\n});\n<\/script>" });

  T.push({ id: "dzielnik", name: "Dzielnik napięcia", desc: "Vout z R1, R2, Vin", height: 300, code:
    BASE + "<div><label>Vin [V]</label><input type=\"number\" id=\"vin\" value=\"5\" step=\"0.1\">" +
    "<label>R1 [kΩ]: <span id=\"r1v\" class=\"acc\">10</span></label><input type=\"range\" id=\"r1\" min=\"0.1\" max=\"100\" step=\"0.1\" value=\"10\">" +
    "<label>R2 [kΩ]: <span id=\"r2v\" class=\"acc\">10</span></label><input type=\"range\" id=\"r2\" min=\"0.1\" max=\"100\" step=\"0.1\" value=\"10\">" +
    "<div class=\"out\">Vout = Vin · R2 / (R1 + R2) = <b class=\"ok\" id=\"vo\"></b> V<br>Prąd: <span id=\"i\"></span> mA</div></div>\n" +
    "<script>\nfunction $(i){return document.getElementById(i)}\nfunction calc(){\n  var vin=parseFloat($('vin').value)||0,r1=parseFloat($('r1').value),r2=parseFloat($('r2').value);\n" +
    "  $('r1v').textContent=r1;$('r2v').textContent=r2;\n  $('vo').textContent=(vin*r2/(r1+r2)).toFixed(3);\n  $('i').textContent=(vin/(r1+r2)).toFixed(3);\n}\n" +
    "['vin','r1','r2'].forEach(function(i){$(i).addEventListener('input',calc)});calc();\n<\/script>" });

  T.push({ id: "uart", name: "Animacja ramki UART", desc: "bity 8N1 krok po kroku", height: 280, code:
    BASE + "<div><label>Bajt (0–255)</label><input type=\"number\" id=\"v\" min=\"0\" max=\"255\" value=\"65\"> <button id=\"go\">Wyślij ▶</button>" +
    "<svg id=\"s\" viewBox=\"0 0 400 90\" style=\"max-height:110px\" width=\"100%\" role=\"img\" aria-label=\"Przebieg UART\"></svg><div class=\"out\" id=\"t\">Wybierz bajt i kliknij Wyślij.</div></div>\n" +
    "<script>\nvar NS='http://www.w3.org/2000/svg',svg=document.getElementById('s'),t=document.getElementById('t'),timer=null;\n" +
    "function bits(v){var b=[0];for(var i=0;i<8;i++)b.push((v>>i)&1);b.push(1);return b}\n" +
    "var LBL=['START','D0','D1','D2','D3','D4','D5','D6','D7','STOP'];\n" +
    "function draw(b,upto){svg.textContent='';var w=36,x0=20,y1=20,y0=60,d='M0 '+y1+' L'+x0+' '+y1;var prev=1;\n" +
    "  for(var i=0;i<=upto&&i<b.length;i++){var y=b[i]?y1:y0,x=x0+i*w;if(y!==(prev?y1:y0))d+=' L'+x+' '+y;d+=' L'+(x+w)+' '+y;prev=b[i];}\n" +
    "  var p=document.createElementNS(NS,'path');p.setAttribute('d',d);p.setAttribute('fill','none');p.setAttribute('stroke','#56e1fd');p.setAttribute('stroke-width','2');svg.appendChild(p);\n" +
    "  for(var j=0;j<b.length;j++){var tx=document.createElementNS(NS,'text');tx.setAttribute('x',x0+j*w+w/2);tx.setAttribute('y',84);tx.setAttribute('fill',j<=upto?'#e6edf3':'#6e7681');tx.setAttribute('font-size','8');tx.setAttribute('text-anchor','middle');tx.textContent=LBL[j];svg.appendChild(tx);}}\n" +
    "document.getElementById('go').addEventListener('click',function(){clearInterval(timer);var v=Math.max(0,Math.min(255,parseInt(document.getElementById('v').value,10)||0)),b=bits(v),i=-1;\n" +
    "  timer=setInterval(function(){i++;draw(b,i);t.textContent='Bit '+LBL[Math.min(i,9)]+' = '+b[Math.min(i,9)]+'  (bajt '+v+' = 0x'+v.toString(16).toUpperCase()+' = '+('00000000'+v.toString(2)).slice(-8)+'b, LSB pierwszy)';if(i>=9)clearInterval(timer)},450)});\n" +
    "draw(bits(65),-1);\n<\/script>" });

  T.push({ id: "quiz", name: "Quiz", desc: "pytanie z odpowiedziami i wynikiem", height: 320, code:
    BASE + "<div id=\"q\"></div><div class=\"out\" id=\"r\">Wybierz odpowiedź.</div>\n" +
    "<script>\n// Edytuj tylko tablicę Q: pytanie, odpowiedzi, indeks poprawnej (od 0), wyjaśnienie\nvar Q=[\n" +
    "  {q:'Ile bitów ma rozdzielczość 12-bitowego ADC w liczbie poziomów?',a:['12','256','4096','65536'],ok:2,e:'2^12 = 4096 poziomów (0–4095).'},\n" +
    "  {q:'Który pin ESP32 jest bezpieczny jako wejście ADC1?',a:['GPIO34','GPIO0','GPIO6','GPIO12'],ok:0,e:'GPIO34 to wejście tylko do odczytu, ADC1 – działa przy Wi-Fi.'}\n];\n" +
    "var i=0,score=0,box=document.getElementById('q'),res=document.getElementById('r');\n" +
    "function show(){box.textContent='';if(i>=Q.length){res.textContent='Wynik: '+score+' / '+Q.length;return}\n  var p=document.createElement('p');p.textContent=(i+1)+'. '+Q[i].q;box.appendChild(p);\n" +
    "  Q[i].a.forEach(function(t,k){var b=document.createElement('button');b.textContent=t;b.style.margin='3px 6px 3px 0';b.addEventListener('click',function(){\n" +
    "    var good=k===Q[i].ok;if(good)score++;res.innerHTML='';var s=document.createElement('span');s.className=good?'ok':'bad';s.textContent=good?'Dobrze! ':'Niestety. ';res.appendChild(s);res.appendChild(document.createTextNode(Q[i].e+' '));\n" +
    "    var n=document.createElement('button');n.textContent='Dalej →';n.addEventListener('click',function(){i++;res.textContent='';show()});res.appendChild(n);\n" +
    "    [].forEach.call(box.querySelectorAll('button'),function(x){x.disabled=true})});box.appendChild(b)});}\nshow();\n<\/script>" });

  T.push({ id: "zakladki", name: "Zakładki kodu", desc: "ten sam przykład w kilku językach", height: 300, code:
    BASE + "<style>.tabs button{border-radius:6px 6px 0 0}.tabs button.on{border-color:#56e1fd;color:#56e1fd}pre{margin:0;padding:12px;background:#0d1117;border:1px solid #30363d;border-radius:0 8px 8px 8px;overflow:auto;font:12.5px/1.5 ui-monospace,Menlo,monospace}</style>" +
    "<div class=\"tabs\" id=\"tabs\"></div><pre id=\"code\"></pre>\n" +
    "<script>\nvar S={'Arduino':'void setup() {\\n  pinMode(LED_BUILTIN, OUTPUT);\\n}\\nvoid loop() {\\n  digitalWrite(LED_BUILTIN, HIGH);\\n  delay(500);\\n  digitalWrite(LED_BUILTIN, LOW);\\n  delay(500);\\n}',\n" +
    "'MicroPython':'from machine import Pin\\nimport time\\nled = Pin(2, Pin.OUT)\\nwhile True:\\n    led.value(not led.value())\\n    time.sleep(0.5)'};\n" +
    "var tabs=document.getElementById('tabs'),pre=document.getElementById('code');\nfunction pick(k){pre.textContent=S[k];[].forEach.call(tabs.children,function(b){b.className=b.textContent===k?'on':''})}\n" +
    "Object.keys(S).forEach(function(k){var b=document.createElement('button');b.textContent=k;b.addEventListener('click',function(){pick(k)});tabs.appendChild(b)});pick(Object.keys(S)[0]);\n<\/script>" });

  T.push({ id: "pwm", name: "Wypełnienie PWM", desc: "przebieg i napięcie średnie", height: 280, code:
    BASE + "<div><label>Wypełnienie: <span class=\"acc\" id=\"dv\">50</span>%</label><input type=\"range\" id=\"d\" min=\"0\" max=\"100\" value=\"50\">" +
    "<label>Napięcie logiczne [V]</label><select id=\"vv\"><option>3.3</option><option>5</option></select>" +
    "<svg id=\"s\" viewBox=\"0 0 400 80\" style=\"max-height:110px\" width=\"100%\" role=\"img\" aria-label=\"Przebieg PWM\"></svg><div class=\"out\">Napięcie średnie ≈ <b class=\"ok\" id=\"avg\"></b> V</div></div>\n" +
    "<script>\nfunction $(i){return document.getElementById(i)}\nvar NS='http://www.w3.org/2000/svg';\n" +
    "function draw(){var d=+$('d').value,v=parseFloat($('vv').value);$('dv').textContent=d;$('avg').textContent=(v*d/100).toFixed(2);\n" +
    "  var p=100,x=0,path='M0 70';for(var k=0;k<4;k++){var hi=p*d/100;path+=' L'+x+' 10 L'+(x+hi)+' 10 L'+(x+hi)+' 70 L'+(x+p)+' 70';x+=p;}\n" +
    "  var s=$('s');s.textContent='';var e=document.createElementNS(NS,'path');e.setAttribute('d',path);e.setAttribute('fill','none');e.setAttribute('stroke','#56e1fd');e.setAttribute('stroke-width','2');s.appendChild(e);}\n" +
    "$('d').addEventListener('input',draw);$('vv').addEventListener('change',draw);draw();\n<\/script>" });


  /* ── Szablony treści (markdown z blokami) ──
   * project: opis projektu (tylko bloki bezpieczne dla użytkowników)
   * article: lekcje i artykuły w panelu redakcji (można też używać bloków zaawansowanych)
   * Wstawiane przyciskiem „Wstaw szablon” w kreatorze (do pustej treści – zastępuje, do istniejącej – dopisuje na końcu). */
  function L() { return [].slice.call(arguments).join("\n"); }
  var F = "```";
  var D = { project: [], article: [] };

  D.project.push({ id: "dokumentacja", name: "Dokumentacja projektu", desc: "cel, parametry, lista elementów, status", body: L(
    ":::summary Krótko o projekcie",
    "- Co to jest i do czego służy (jedno zdanie).",
    "- Dla kogo / w jakiej sytuacji się przydaje.",
    "- Stan prac: prototyp / działa / w budowie.",
    ":::", "",
    "## Cel i założenia", "",
    "Opisz, jaki problem rozwiązuje projekt i jakie ma wymagania (zasilanie, rozmiar, koszt, zasięg…).", "",
    ":::kv",
    "Mikrokontroler | np. ESP32-WROOM-32",
    "Zasilanie | np. 5 V z USB",
    "Komunikacja | np. Wi-Fi, UART",
    "Czas pracy | np. 8 h na baterii",
    ":::", "",
    "## Zasada działania", "",
    ":::flow Przepływ danych",
    "(s) Start",
    "[a] Odczyt czujnika",
    "[b] Przetwarzanie",
    "[c] Wysłanie wyniku",
    "s -> a", "a -> b", "b -> c",
    ":::", "",
    "## Użyte elementy", "",
    ":::def",
    "Czujnik | np. DS18B20 – temperatura, magistrala 1-Wire",
    "Moduł | np. ESP32 DevKit – płytka z Wi-Fi",
    ":::", "",
    "## Kod", "",
    F + "cpp Fragment programu",
    "void setup() {", "  // konfiguracja", "}", "", "void loop() {", "  // działanie", "}",
    F, "",
    ":::note Wnioski i dalsze pomysły",
    "Co się udało, co poprawić, co dodać w następnej wersji.",
    ":::") });

  D.project.push({ id: "instrukcja", name: "Instrukcja budowy", desc: "lista kontrolna, kroki, uwagi", body: L(
    ":::summary Co zbudujesz",
    "Jedno-dwa zdania o efekcie końcowym i czasie potrzebnym na wykonanie.",
    ":::", "",
    "## Przed rozpoczęciem", "",
    ":::checklist",
    "- [ ] Element 1 (ilość)",
    "- [ ] Element 2 (ilość)",
    "- [ ] Narzędzia: lutownica, multimetr",
    ":::", "",
    ":::warn Bezpieczeństwo",
    "Wypisz zagrożenia: wysokie napięcie, gorąca lutownica, akumulatory Li-Ion.",
    ":::", "",
    "## Montaż", "",
    ":::steps Kolejne kroki",
    "Przygotuj elementy | Sprawdź, czy masz wszystko z listy",
    "Połącz układ | Wg schematu, najpierw zasilanie, potem sygnały",
    "Wgraj program | Wybierz płytkę i port, kliknij Wgraj",
    "Przetestuj | Sprawdź napięcia i działanie",
    ":::", "",
    "## Połączenia", "",
    ":::kv",
    "Czujnik OUT | GPIO 34",
    "Dioda LED | GPIO 2 przez rezystor 330 Ω",
    ":::", "",
    ":::details Najczęstsze problemy",
    "- Nie działa wgrywanie: sprawdź kabel USB (musi przesyłać dane) i wybrany port.",
    "- Dziwne odczyty: sprawdź wspólną masę.",
    ":::") });

  D.project.push({ id: "dziennik", name: "Dziennik prac", desc: "oś czasu postępów i pomiarów", body: L(
    ":::summary Stan na dziś",
    "Krótko: co już działa i co jest następne.",
    ":::", "",
    ":::progress",
    "Sprzęt | 60 | prototyp na płytce stykowej | green",
    "Oprogramowanie | 40 | działa odczyt, brak wysyłki | orange",
    "Dokumentacja | 20 | szkic | accent",
    ":::", "",
    ":::timeline Dziennik",
    "2026-01-05 | Pomysł | Wybór elementów i założenia",
    "2026-01-12 | Pierwszy prototyp | Odczyt czujnika działa",
    "2026-01-20 | Problem | Zakłócenia na zasilaniu – dodany kondensator",
    ":::", "",
    ":::pros CO DZIAŁA",
    "- odczyt czujnika",
    ":::", "",
    ":::cons DO POPRAWY",
    "- brak obudowy",
    ":::") });

  D.project.push({ id: "krotki", name: "Krótki opis", desc: "podsumowanie + parametry", body: L(
    ":::summary Opis",
    "- Co robi projekt.",
    "- Najważniejsza cecha.",
    ":::", "",
    ":::stats",
    "Elementy | 5 | sztuk | accent",
    "Koszt | 40 | zł | green",
    ":::") });

  D.article.push({ id: "lekcja", name: "Lekcja (wzór)", desc: "podsumowanie, wyjaśnienie, przykład, quiz", body: L(
    ":::summary Szybkie podsumowanie",
    "- Najważniejsza myśl lekcji.",
    "- Drugi kluczowy punkt.",
    "- Czego się nauczysz.",
    ":::", "",
    "## Idea", "",
    "Wyjaśnij zagadnienie prostym językiem, najpierw „po co”, potem „jak”.", "",
    ":::def",
    "Pojęcie | Definicja jednym zdaniem",
    ":::", "",
    "## Jak to działa", "",
    ":::flow Schemat działania",
    "(s) Start", "[a] Krok pierwszy", "{b} Warunek?", "[c] Krok drugi", "(e) Koniec",
    "s -> a", "a -> b", "b -> c : tak", "b -> a : nie", "c -> e",
    ":::", "",
    "## Przykład", "",
    ":::tabs",
    "=== Arduino",
    F + "cpp Przykład",
    "void setup() {}", "void loop() {}",
    F,
    "=== MicroPython",
    F + "python Przykład",
    "print('hello')",
    F,
    ":::", "",
    ":::warn Typowy błąd",
    "Opisz pułapkę, w którą wpada początkujący.",
    ":::", "",
    ":::checklist",
    "- [ ] Co sprawdzić przed zastosowaniem",
    ":::", "",
    ":::neutral Quiz (opcjonalnie)",
    "Dodaj widget z szablonu „Quiz” w sekcji Widgety i wstaw go blokiem widget.",
    ":::") });

  D.article.push({ id: "porownanie", name: "Porównanie rozwiązań", desc: "tabela, plusy i minusy, wybór", body: L(
    ":::summary Który wybrać",
    "- Rozwiązanie A: kiedy.",
    "- Rozwiązanie B: kiedy.",
    ":::", "",
    "| Cecha | A | B |", "|---|---|---|", "| Koszt | niski | średni |", "| Złożoność | mała | duża |", "",
    ":::pros A: ZALETY", "- prostota", ":::", "",
    ":::cons A: WADY", "- ograniczenia", ":::", "",
    ":::note Rekomendacja", "Dla początkujących zaczynaj od A, a do B przejdź, gdy zabraknie możliwości.", ":::") });

  D.article.push({ id: "poradnik", name: "Poradnik krok po kroku", desc: "wymagania, kroki, rozwiązywanie problemów", body: L(
    ":::summary Cel poradnika", "Co będzie działać na końcu.", ":::", "",
    ":::checklist", "- [ ] Potrzebny element", "- [ ] Potrzebne oprogramowanie", ":::", "",
    ":::steps Procedura", "Krok pierwszy | opis", "Krok drugi | opis", "Krok trzeci | opis", ":::", "",
    ":::details Rozwiązywanie problemów", "- Objaw → przyczyna → rozwiązanie", ":::") });

  global.ESNKnowledgeDocTemplates = D;

  global.ESNKnowledgeTemplates = T;
})(window);
