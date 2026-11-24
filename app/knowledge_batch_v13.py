"""Partia treści z archiwum (v13): kursy „Interfejsy i protokoły” oraz „Sygnał i bezpieczeństwo”.
Zmiany merytoryczne względem archiwum: docs/WIEDZA-PILOTAZ.md („Partia v13”)."""
from knowledge_batch_v8 import WIDGET_BASE
from knowledge_batch_v10 import quiz_widget

BTN = ("<style>button{background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:6px 12px;font:inherit;cursor:pointer;margin:0 6px 6px 0}"
       "button:hover{border-color:#56e1fd}select,input[type=text]{background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:6px 8px;font:inherit}svg{display:block}"
       ".reg span{display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border:1px solid #30363d;border-radius:4px;margin:0 2px;font-family:ui-monospace,Menlo,monospace}"
       ".reg span.o{border-color:#ff8c00;color:#ff8c00}.reg span.i{border-color:#56e1fd;color:#56e1fd}</style>")

# ── I2C: animowana ramka ──
W_I2C = WIDGET_BASE + BTN + """<div><label>Adres urządzenia (7 bitów, hex)</label><input type="text" id="a" value="48" size="4" maxlength="2">
<label>Kierunek</label><select id="rw"><option value="0">zapis (master wysyła)</option><option value="1">odczyt (urządzenie odpowiada)</option></select>
<label>Bajt danych (hex)</label><input type="text" id="d" value="A5" size="4" maxlength="2"> <label>Tempo animacji</label><select id="sp"><option value="3">wolno</option><option value="1.7">normalnie</option><option value="1">szybko</option></select> <button id="go">Wyślij ▶</button>
<div style="overflow-x:auto"><svg id="s" viewBox="0 0 580 118" style="min-width:560px" width="100%" role="img" aria-label="Ramka I2C"></svg></div>
<div class="out" id="t">Wybierz adres i naciśnij Wyślij.</div></div>
<script>
function $(i){return document.getElementById(i)}
var NS='http://www.w3.org/2000/svg',W=28,timer=null,cells=[];
function el(n,a){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);return e}
function hex(v,def){var n=parseInt(v,16);return isNaN(n)?def:n}
function build(){var a=hex($('a').value,72)&127,rw=+$('rw').value,d=hex($('d').value,165)&255,c=[];
 c.push({l:'START',v:0,t:'start',m:'START: SDA opada, gdy SCL jest wysoki. Master zajmuje magistralę.'});
 for(var i=6;i>=0;i--)c.push({l:'A'+i,v:(a>>i)&1,t:'m',m:'Bit adresu A'+i+' = '+((a>>i)&1)+' (nadaje master)'});
 c.push({l:rw?'R':'W',v:rw,t:'m',m:'Bit kierunku: '+(rw?'1 = odczyt':'0 = zapis')});
 c.push({l:'ACK',v:0,t:'s',m:'ACK: urządzenie o tym adresie ściąga SDA do 0. Brak ACK (1) = nikt nie odpowiada.'});
 for(var j=7;j>=0;j--)c.push({l:'D'+j,v:(d>>j)&1,t:rw?'s':'m',m:'Bit danych D'+j+' = '+((d>>j)&1)+(rw?' (nadaje urządzenie)':' (nadaje master)')});
 c.push({l:rw?'NACK':'ACK',v:rw?1:0,t:rw?'m':'s',m:rw?'NACK: master kończy odczyt (po ostatnim bajcie wysyła 1).':'ACK: urządzenie potwierdza odebrany bajt.'});
 c.push({l:'STOP',v:1,t:'stop',m:'STOP: SDA narasta, gdy SCL jest wysoki. Magistrala wolna.'});return c}
function seg(list){var d='M'+list[0][0]+' '+list[0][2],py=list[0][2];list.forEach(function(s){d+=' L'+s[0]+' '+py+' L'+s[0]+' '+s[2]+' L'+s[1]+' '+s[2];py=s[2]});return d}
function draw(){cells=build();var s=$('s');s.textContent='';var H1=14,L1=40,H2=60,L2=88,scl=[],sda=[];
 cells.forEach(function(c,i){var x=i*W,m=x+W/2;
  if(c.t==='start'){scl.push([x,x+W,H1]);sda.push([x,m,H2]);sda.push([m,x+W,L2])}
  else if(c.t==='stop'){scl.push([x,m,L1]);scl.push([m,x+W,H1]);sda.push([x,m,L2]);sda.push([m,x+W,H2])}
  else{scl.push([x,m,L1]);scl.push([m,x+W,H1]);sda.push([x,x+W,c.v?H2:L2])}});
 var cp=el('clipPath',{id:'cp'});var r=el('rect',{id:'cr',x:0,y:0,width:0,height:118});cp.appendChild(r);s.appendChild(cp);
 var g=el('g',{'clip-path':'url(#cp)'});
 g.appendChild(el('path',{d:seg(scl),fill:'none',stroke:'#56e1fd','stroke-width':2}));g.appendChild(el('path',{d:seg(sda),fill:'none',stroke:'#3fb950','stroke-width':2}));
 cells.forEach(function(c,i){if(c.t==='s'){g.appendChild(el('rect',{x:i*W,y:50,width:W,height:46,fill:'#ff8c00','fill-opacity':0.15}))}});
 s.appendChild(g);
 [['SCL',H1+4,'#56e1fd'],['SDA',H2+4,'#3fb950']].forEach(function(l){var t=el('text',{x:0,y:l[1]-12,fill:l[2],'font-size':'9'});t.textContent=l[0];s.appendChild(t)});
 cells.forEach(function(c,i){var t=el('text',{x:i*W+W/2,y:112,fill:'#9fb0c3','font-size':'8','text-anchor':'middle'});t.textContent=c.l;s.appendChild(t)})}
$('go').addEventListener('click',function(){clearInterval(timer);draw();var w=0,tot=cells.length*W;
 timer=setInterval(function(){w+=1.4;$('cr').setAttribute('width',w);var i=Math.min(cells.length-1,Math.floor(w/W));$('t').textContent=cells[i].m;if(w>=tot){clearInterval(timer)}},15*(+$('sp').value))});
['a','rw','d'].forEach(function(x){$(x).addEventListener('change',function(){clearInterval(timer);draw();$('cr').setAttribute('width',cells.length*W);$('t').textContent='Pełna ramka. Naciśnij Wyślij, aby ją odtworzyć krok po kroku.'})});
draw();$('cr').setAttribute('width',0);
</script>"""

# ── SPI: rejestry przesuwne ──
W_SPI = WIDGET_BASE + BTN + """<div><label>Bajt mastera (MOSI), dziesiętnie 0–255</label><input type="number" id="m" min="0" max="255" value="165">
<label>Bajt urządzenia (MISO), dziesiętnie 0–255</label><input type="number" id="s" min="0" max="255" value="60">
<label>Tempo animacji</label><select id="sp"><option value="3">wolno</option><option value="1.7">normalnie</option><option value="1">szybko</option></select><div style="margin-top:8px"><button id="step">Jeden takt SCK ▶</button><button id="auto">Auto</button><button id="rs">Od nowa</button></div>
<div>Rejestr mastera <div class="reg" id="rm"></div></div><div style="margin-top:6px">Rejestr urządzenia <div class="reg" id="rsl"></div></div>
<div class="out">CS: <b id="cs" class="acc">wysoki (nieaktywny)</b> · takty SCK: <b id="k">0</b> / 8<br><span id="t">Naciśnij „Jeden takt”: oba układy równocześnie wypychają MSB i wsuwają bit z drugiej strony.</span></div></div>
<script>
function $(i){return document.getElementById(i)}
var m=[],s=[],k=0,timer=null;
function bits(v){var a=[];for(var i=7;i>=0;i--)a.push((v>>i)&1);return a}
function val(a){return a.reduce(function(x,b){return x*2+b},0)}
function load(){clearInterval(timer);m=bits(Math.max(0,Math.min(255,+$('m').value||0)));s=bits(Math.max(0,Math.min(255,+$('s').value||0)));k=0;show('Naciśnij „Jeden takt”: oba układy równocześnie wypychają MSB i wsuwają bit z drugiej strony.')}
function row(id,a){var c=$(id);c.textContent='';a.forEach(function(b,i){var e=document.createElement('span');e.textContent=b;if(i===0&&k<8)e.className='o';if(i===7&&k>0)e.className='i';c.appendChild(e)})}
function show(t){row('rm',m);row('rsl',s);$('k').textContent=k;$('cs').textContent=k===0?'wysoki (nieaktywny)':k<8?'niski (transmisja)':'wysoki (koniec)';$('t').textContent=t}
function step(){if(k>=8){return}var mo=m[0],so=s[0];m=m.slice(1).concat([so]);s=s.slice(1).concat([mo]);k++;
 show(k<8?'Takt '+k+': master wysłał '+mo+' (MOSI), urządzenie wysłało '+so+' (MISO).':'Po 8 taktach bajty się wymieniły: master ma '+val(m)+' (0x'+val(m).toString(16).toUpperCase()+'), urządzenie ma '+val(s)+'. SPI zawsze nadaje i odbiera naraz.')}
$('step').addEventListener('click',step);
$('auto').addEventListener('click',function(){load();timer=setInterval(function(){step();if(k>=8)clearInterval(timer)},450*(+$('sp').value))});
$('rs').addEventListener('click',load);['m','s'].forEach(function(x){$(x).addEventListener('change',load)});load();
</script>"""

# ── I2C: pull-upy ──
W_PULLUP = WIDGET_BASE + BTN + """<div><label>Napięcie zasilania magistrali</label><select id="v"><option>3.3</option><option>5</option></select>
<label>Tryb magistrali</label><select id="m"><option value="1000">Standard 100 kHz (czas narastania 1000 ns)</option><option value="300" selected>Fast 400 kHz (300 ns)</option><option value="120">Fast+ 1 MHz (120 ns)</option></select>
<label>Pojemność magistrali: <b class="acc" id="cv">100</b> pF (przewody, wejścia układów)</label><input type="range" id="c" min="10" max="400" value="100">
<div class="out">Rmin = <b id="rmin"></b> kΩ (prąd nie większy niż 3 mA)<br>Rmax = <b id="rmax"></b> kΩ (dla wymaganego czasu narastania)<br><b id="v2"></b></div></div>
<script>
function $(i){return document.getElementById(i)}
var E=[1,1.2,1.5,1.8,2.2,2.7,3.3,3.9,4.7,5.6,6.8,8.2];
function calc(){var V=parseFloat($('v').value),tr=+$('m').value,C=+$('c').value;$('cv').textContent=C;
 var rmin=(V-0.4)/3,rmax=tr/(0.8473*C);$('rmin').textContent=rmin.toFixed(2);$('rmax').textContent=rmax.toFixed(1);
 var o=$('v2');if(rmin>rmax){o.textContent='Brak poprawnej wartości: zmniejsz pojemność magistrali (krótsze przewody, mniej układów) albo wybierz wolniejszy tryb.';o.className='bad';return}
 var best=null,g=Math.sqrt(rmin*rmax);for(var d=0.1;d<=100;d*=10){E.forEach(function(e){var r=e*d;if(r>=rmin&&r<=rmax&&(best===null||Math.abs(Math.log(r/g))<Math.abs(Math.log(best/g))))best=r})}
 o.textContent=best?'Dobra wartość z szeregu E12: '+best.toFixed(best<10?1:0)+' kΩ.':'W przedziale nie ma wartości z szeregu E12: wybierz najbliższą i sprawdź oscyloskopem.';o.className=best?'ok':'warn'}
['v','m','c'].forEach(function(x){$(x).addEventListener('input',calc)});calc();
</script>"""

# ── kondycjonowanie: wzmacniacz różnicowy ──
W_DIFF = WIDGET_BASE + BTN + """<div><label>Sygnał użyteczny (np. zespół QRS): <b class="acc" id="sv">1</b> mV</label><input type="range" id="sg" min="0.5" max="2" step="0.1" value="1">
<label>Zakłócenie sieciowe 50 Hz na obu kablach: <b class="acc" id="cv">100</b> mV</label><input type="range" id="cm" min="0" max="500" step="10" value="100">
<label>CMRR wzmacniacza: <b class="acc" id="rv">60</b> dB</label><input type="range" id="cr" min="0" max="120" value="60">
<svg id="p" viewBox="0 0 320 170" width="100%" role="img" aria-label="Przebiegi przed i po wzmacniaczu różnicowym"></svg>
<div class="out">Zakłócenie po wzmacniaczu (w przeliczeniu na wejście): <b id="res" class="warn"></b> mV<br>Stosunek sygnału do zakłócenia: <b id="snr"></b></div></div>
<script>
function $(i){return document.getElementById(i)}
var NS='http://www.w3.org/2000/svg';
function sig(t,a){var y=0;[0.25,1.0].forEach(function(b){y+=a*Math.exp(-Math.pow((t-b)/0.014,2))});return y}
function pl(f,ymax,y0,h,col){var pts=[];for(var i=0;i<=300;i++){var t=i/300*1.5;pts.push((i*320/300).toFixed(1)+','+(y0-f(t)/ymax*h).toFixed(1))}var e=document.createElementNS(NS,'polyline');e.setAttribute('points',pts.join(' '));e.setAttribute('fill','none');e.setAttribute('stroke',col);e.setAttribute('stroke-width','1.3');return e}
function txt(s,y){var t=document.createElementNS(NS,'text');t.setAttribute('x',4);t.setAttribute('y',y);t.setAttribute('fill','#9fb0c3');t.setAttribute('font-size','9');t.textContent=s;return t}
function calc(){var a=+$('sg').value,cm=+$('cm').value,db=+$('cr').value;$('sv').textContent=a;$('cv').textContent=cm;$('rv').textContent=db;
 var res=cm*Math.pow(10,-db/20);$('res').textContent=res<0.001?res.toExponential(1):res.toFixed(3);
 var r=res>0?a/res:Infinity;$('snr').textContent=r>=1e6?'bardzo duży':r.toFixed(1)+' : 1 ('+(20*Math.log10(r)).toFixed(0)+' dB)';$('snr').className=r<1?'bad':r<10?'warn':'ok';
 var s=$('p');s.textContent='';
 s.appendChild(txt('Przed: sygnał + zakłócenie sieciowe na elektrodzie',12));
 var ymax1=Math.max(a,cm*0.6)||1;s.appendChild(pl(function(t){return sig(t,a)+cm*Math.sin(2*Math.PI*50*t)},Math.max(a,cm)||1,50,32,'#f85149'));
 s.appendChild(txt('Po wzmacniaczu różnicowym (przeliczone na wejście)',100));
 var ymax=Math.max(a,res)*1.1||1;s.appendChild(pl(function(t){return sig(t,a)+res*Math.sin(2*Math.PI*50*t)},ymax,150,35,'#3fb950'))}
['sg','cm','cr'].forEach(function(x){$(x).addEventListener('input',calc)});calc();
</script>"""

# ── filtr RC ──
W_RC = WIDGET_BASE + BTN + """<div><label>Typ filtru</label><select id="ty"><option value="hp">górnoprzepustowy (usuwa wolne dryfy)</option><option value="lp">dolnoprzepustowy (tłumi wysokie częstotliwości)</option></select>
<label>Rezystor R: <b class="acc" id="rv"></b></label><input type="range" id="r" min="-1" max="3" step="0.05" value="2.5">
<label>Kondensator C: <b class="acc" id="cv"></b></label><input type="range" id="c" min="0" max="4" step="0.05" value="3">
<svg id="p" viewBox="0 0 320 150" width="100%" role="img" aria-label="Charakterystyka filtru RC"></svg>
<div class="out">Częstotliwość graniczna fc = 1 / (2π·R·C) = <b class="ok" id="fc"></b> Hz<br>Tłumienie przy 0,5 Hz: <b id="a05"></b> · przy 50 Hz: <b id="a50"></b></div></div>
<script>
function $(i){return document.getElementById(i)}
var NS='http://www.w3.org/2000/svg';
function el(n,a){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);return e}
function fmtC(nf){return nf>=1000?(nf/1000).toFixed(nf>=10000?0:1)+' µF':nf.toFixed(nf<10?1:0)+' nF'}
function mag(f,fc,hp){var x=f/fc;return hp?x/Math.sqrt(1+x*x):1/Math.sqrt(1+x*x)}
function db(v){return 20*Math.log10(v)}
function calc(){var Rk=Math.pow(10,+$('r').value),Cn=Math.pow(10,+$('c').value),hp=$('ty').value==='hp';
 $('rv').textContent=(Rk>=1000?(Rk/1000).toFixed(1)+' MΩ':Rk.toFixed(Rk<10?1:0)+' kΩ');$('cv').textContent=fmtC(Cn);
 var fc=1/(2*Math.PI*Rk*1000*Cn*1e-9);$('fc').textContent=fc<10?fc.toFixed(2):fc.toFixed(0);
 $('a05').textContent=db(mag(0.5,fc,hp)).toFixed(1)+' dB';$('a50').textContent=db(mag(50,fc,hp)).toFixed(1)+' dB';
 var s=$('p');s.textContent='';var x0=26,w=290,y0=10,h=120;function X(f){return x0+(Math.log10(f)+2)/7*w}function Y(d){return y0+(Math.min(0,Math.max(-60,d))/-60)*h}
 [0,-20,-40,-60].forEach(function(d){s.appendChild(el('line',{x1:x0,x2:x0+w,y1:Y(d),y2:Y(d),stroke:'#21262d'}));var t=el('text',{x:2,y:Y(d)+3,fill:'#6e7681','font-size':'8'});t.textContent=d;s.appendChild(t)});
 [0.01,0.1,1,10,100,1000,10000,100000].forEach(function(f){var t=el('text',{x:X(f)-(f>=100000?2:0),y:146,fill:'#6e7681','font-size':'8','text-anchor':f>=100000?'end':'middle'});t.textContent=f>=1000?(f/1000)+'k':f;s.appendChild(t)});
 [[0.5,'0,5 Hz','#ff8c00'],[50,'50 Hz','#f85149']].forEach(function(m){s.appendChild(el('line',{x1:X(m[0]),x2:X(m[0]),y1:y0,y2:y0+h,stroke:m[2],'stroke-dasharray':'3 3'}));var t=el('text',{x:X(m[0])+2,y:y0+9,fill:m[2],'font-size':'8'});t.textContent=m[1];s.appendChild(t)});
 var pts=[];for(var i=0;i<=140;i++){var f=Math.pow(10,-2+i/140*7);pts.push(X(f).toFixed(1)+','+Y(db(mag(f,fc,hp))).toFixed(1))}
 s.appendChild(el('polyline',{points:pts.join(' '),fill:'none',stroke:'#56e1fd','stroke-width':2}));
 s.appendChild(el('line',{x1:X(fc),x2:X(fc),y1:y0,y2:y0+h,stroke:'#3fb950'}))}
['ty','r','c'].forEach(function(x){$(x).addEventListener('input',calc)});calc();
</script>"""

# ── kaskada ochrony (animacja automatyczna) ──
W_DEFIB = WIDGET_BASE + BTN + """<label>Tempo animacji</label><select id="sp"><option value="3">wolno</option><option value="1.7">normalnie</option><option value="1">szybko</option></select><div style="overflow-x:auto"><svg id="s" viewBox="0 0 580 130" style="min-width:520px" width="100%" role="img" aria-label="Kaskada ochrony wejścia przed impulsem defibrylacji"></svg></div>
<div class="out" id="t"></div><div style="color:#9fb0c3;font-size:12px;margin-top:6px">Wartości poglądowe: rzeczywiste zależą od użytych elementów i normy.</div></div>
<script>
function $(i){return document.getElementById(i)}
var NS='http://www.w3.org/2000/svg';
function el(n,a){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);return e}
var ST=[{n:'Elektroda',lv:100,m:'Impuls defibrylatora trafia w kabel pomiarowy: setki do tysięcy woltów przez ułamek sekundy.'},
{n:'Rezystory',lv:70,m:'Rezystory szeregowe dużej mocy ograniczają prąd i przyjmują pierwsze uderzenie.'},
{n:'Odgromnik GDT',lv:30,m:'Gdy napięcie przekroczy próg zadziałania, gaz w rurce jonizuje się i zwiera impuls do masy.'},
{n:'Diody TVS',lv:8,m:'Szybkie diody ścinają resztkę napięcia, zanim dotrze do wzmacniacza.'},
{n:'Wzmacniacz',lv:2,m:'Na wejściu układu pozostaje poziom mieszczący się w dopuszczalnym zakresie.'}];
var cur=0;
function draw(){var s=$('s');s.textContent='';ST.forEach(function(x,i){var bx=10+i*114,on=i===cur,past=i<=cur;
 s.appendChild(el('rect',{x:bx,y:12,width:100,height:44,rx:8,fill:on?'#0e3a4a':'#161b22',stroke:on?'#56e1fd':'#30363d','stroke-width':on?2:1}));
 var t=el('text',{x:bx+50,y:38,fill:on?'#e6edf3':'#9fb0c3','font-size':'11','text-anchor':'middle'});t.textContent=x.n;s.appendChild(t);
 if(i<ST.length-1)s.appendChild(el('path',{d:'M'+(bx+100)+' 34 L'+(bx+114)+' 34',stroke:past&&i<cur?'#56e1fd':'#30363d','stroke-width':2}));
 var bh=past?x.lv*0.6:0;s.appendChild(el('rect',{x:bx+30,y:124-bh,width:40,height:Math.max(bh,1),rx:3,fill:x.lv>40?'#f85149':x.lv>10?'#ff8c00':'#3fb950'}));
 var l=el('text',{x:bx+50,y:120-bh,fill:'#9fb0c3','font-size':'9','text-anchor':'middle'});l.textContent=past?'poziom zagrożenia':'';s.appendChild(l)});
 $('t').textContent=ST[cur].m}
function nxt(){cur=(cur+1)%ST.length;draw();setTimeout(nxt,700*(+$('sp').value))}
draw();setTimeout(nxt,700*(+$('sp').value));
</script>"""

W_QUIZ_PROTO = quiz_widget([
    {"q": "Który interfejs wymaga osobnej linii wyboru (CS) dla każdego urządzenia?", "a": ["UART", "I2C", "SPI", "I2S"], "ok": 2, "e": "SPI wybiera układ linią CS, a I2C adresuje układy po dwóch wspólnych przewodach."},
    {"q": "Dlaczego linie I2C potrzebują rezystorów podciągających (pull-up)?", "a": ["Aby zwiększyć napięcie zasilania", "Bo układy tylko zwierają linię do masy, a poziom wysoki zapewnia rezystor", "Aby chronić przed ESD", "Nie potrzebują"], "ok": 1, "e": "Wyjścia I2C są typu otwarty dren, więc stan wysoki wynika z podciągnięcia."},
    {"q": "Co oznacza ACK w ramce I2C?", "a": ["Koniec transmisji", "Potwierdzenie odebrania bajtu przez odbiorcę (SDA = 0)", "Zmianę kierunku", "Błąd magistrali"], "ok": 1, "e": "Odbiorca ściąga SDA do zera w 9. takcie, a brak ACK oznacza błąd lub brak urządzenia."},
    {"q": "Który interfejs jest przeznaczony do ciągłego strumienia dźwięku?", "a": ["UART", "I2C", "SPI", "I2S"], "ok": 3, "e": "I2S przesyła próbki audio z zegarem bitowym i sygnałem wyboru kanału L/R."},
])

W_QUIZ_BEZP = quiz_widget([
    {"q": "Dlaczego urządzenie podłączone do ciała człowieka nie powinno być zasilane z sieci ani z komputera podłączonego do sieci bez izolacji?", "a": ["Bo zużywa za dużo prądu", "Bo awaria może doprowadzić napięcie sieciowe do pacjenta", "Bo sygnał jest wtedy wolniejszy", "Nie ma takiego ryzyka"], "ok": 1, "e": "Izolacja galwaniczna lub zasilanie bateryjne usuwa tor, którym prąd mógłby przepłynąć przez ciało."},
    {"q": "Co robi wzmacniacz różnicowy z zakłóceniem 50 Hz indukowanym jednakowo na obu elektrodach?", "a": ["Wzmacnia je podwójnie", "Odejmuje je (tłumi składową wspólną)", "Zamienia na prąd stały", "Nic"], "ok": 1, "e": "Wzmacniana jest różnica napięć, a składowa wspólna jest tłumiona według parametru CMRR."},
    {"q": "Gdzie umieszcza się kondensator odsprzęgający 100 nF?", "a": ["Daleko od układu, przy zasilaczu", "Jak najbliżej pinów VCC i GND układu scalonego", "Na wejściu analogowym", "Szeregowo z zasilaniem"], "ok": 1, "e": "Krótka ścieżka zmniejsza indukcyjność, więc kondensator skutecznie tłumi szybkie szpilki na zasilaniu."},
])

LESSON_PROTO = """:::summary Szybkie podsumowanie
- Sposób komunikacji z peryferium wyznacza **szybkość**, **liczbę pinów** i **liczbę urządzeń** na magistrali.
- **UART**: 2 przewody, asynchroniczny, tylko 2 urządzenia. **I2C**: 2 przewody, wiele urządzeń po adresach. **SPI**: 4 przewody, bardzo szybki, osobny CS dla każdego urządzenia. **I2S**: strumień audio.
- Wybór sprowadza się zwykle do pytania: ile urządzeń, jak szybko i ile pinów mogę poświęcić.
:::

## Porównanie interfejsów

| Interfejs | Linie | Typ | Typowa szybkość | Zastosowanie |
|---|---|---|---|---|
| **UART** | TX, RX (+GND) | Asynchroniczny, punkt–punkt | 9600 baud – ok. 1 Mbaud i więcej | Komunikacja z PC, moduły GPS i GSM |
| **I2C** | SDA, SCL (+GND) | Synchroniczny, wiele urządzeń | 100 kHz, 400 kHz (do 1 MHz) | Czujniki (BME280, MPU6050), wyświetlacze OLED |
| **SPI** | MOSI, MISO, SCK, CS | Synchroniczny, pełny dupleks | Do kilkudziesięciu MHz | Karty SD, moduły radiowe, szybkie przetworniki ADC |
| **I2S** | BCLK, LRCLK, DIN/DOUT | Synchroniczny, audio | Zależy od próbkowania i liczby bitów | Mikrofony MEMS, przetworniki DAC audio |

:::note Synchroniczny i asynchroniczny
W interfejsie **synchronicznym** jedna ze stron wysyła osobny sygnał zegarowy (SCL, SCK), więc odbiornik wie, kiedy próbkować bit. W **asynchronicznym** (UART) nie ma zegara: obie strony muszą mieć ustawioną tę samą prędkość (baud rate) z góry.
:::

## Jak wybrać

:::flow Dobór interfejsu
(s) Nowy układ
{a} Potrzebny strumień audio?
[b] I2S
{c} Potrzeba dużej szybkości lub wiele MB danych?
[d] SPI
{e} Wiele czujników, mało pinów?
[f] I2C
[g] UART lub to, co udostępnia układ
s -> a
a -> b : tak
a -> c : nie
c -> d : tak
c -> e : nie
e -> f : tak
e -> g : nie
:::

Ostateczną decyzję zawsze wyznacza to, który interfejs obsługuje dany układ: wiele modułów ma tylko jedną opcję.

:::pros ZALETY I2C
- tylko 2 przewody dla wielu urządzeń
- adresowanie wbudowane w protokół
- potwierdzenie (ACK) każdego bajtu
:::

:::cons WADY I2C
- wolniejszy od SPI
- potrzebuje rezystorów podciągających
- dwa urządzenia o tym samym adresie wymagają multipleksera
:::

:::warn Poziomy napięć
Łącząc układy 5 V i 3,3 V sprawdź poziomy logiczne. Podanie 5 V na pin ESP32 może go uszkodzić, więc użyj konwertera poziomów (level shiftera), a przy I2C – konwertera przystosowanego do magistrali otwarty dren.
:::

## Sprawdź się

:::widget quiz-proto 330
:::
"""

LESSON_I2C = """:::summary Szybkie podsumowanie
- Ramka I2C: **START**, 7 bitów adresu, bit kierunku (R/W), **ACK**, bajty danych z ACK po każdym, **STOP**.
- Linie SDA i SCL są typu **otwarty dren**: układy tylko ściągają je do masy, a stan wysoki daje **rezystor podciągający**.
- Zbyt duży rezystor wydłuża narastanie zbocza (błędy przy dużej prędkości), a zbyt mały przekracza dopuszczalny prąd wyjścia (ok. 3 mA).
:::

## Jak wygląda ramka

Zmień adres, kierunek i bajt, a potem odtwórz ramkę krok po kroku. Linia SCL (niebieska) wyznacza takty, a SDA (zielona) niesie bity. Pomarańczowe pola to bity, które nadaje urządzenie podrzędne (np. ACK).

:::widget i2c-ramka 440
:::

:::info Zasada zmiany bitów
Podczas wysokiego SCL linia SDA musi być stabilna: odbiornik w tym momencie czyta bit. SDA wolno zmieniać tylko, gdy SCL jest niski. Wyjątkiem są START i STOP, które są właśnie zmianą SDA przy wysokim SCL.
:::

## Rezystory podciągające

Wybierz napięcie, tryb i szacowaną pojemność magistrali. Kalkulator pokazuje dopuszczalny przedział i dobrą wartość z szeregu E12.

:::widget i2c-pullup 440
:::

:::note Skąd te wzory
Rmin wynika z ograniczenia prądu wyjścia (przy stanie niskim ok. 0,4 V i 3 mA): `Rmin = (Vcc − 0,4 V) / 3 mA`. Rmax wynika z czasu narastania zbocza (30 % do 70 %) wg specyfikacji I2C: `Rmax = tr / (0,8473 · Cb)`. Wiele płytek z czujnikami ma już własne rezystory, więc kilka takich modułów połączonych razem daje mniejszą wypadkową rezystancję.
:::

## Skaner adresów

```cpp Skaner I2C (Arduino / ESP32)
#include <Wire.h>

void setup() {
  Serial.begin(115200);
  Wire.begin();                       // ESP32 DevKit: domyślnie SDA = 21, SCL = 22
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {   // 0 = urządzenie odpowiedziało ACK
      Serial.print("Znaleziono: 0x");
      Serial.println(addr, HEX);
    }
  }
}
void loop() {}
```

:::details Najczęstsze problemy z I2C
- Skaner nic nie znajduje: sprawdź zasilanie, wspólną masę, zamienione SDA i SCL oraz obecność podciągnięć.
- Czasem działa, czasem nie: za długie przewody, zbyt duży rezystor lub zakłócenia. Zwolnij magistralę (`Wire.setClock(100000)`).
- Dwa moduły o tym samym adresie: zmień adres zworką (jeśli jest), użyj multipleksera (np. TCA9548A) lub osobnej magistrali.
- Układ 3,3 V i 5 V na jednej magistrali: użyj konwertera poziomów.
:::

:::checklist
- [ ] Wspólna masa wszystkich układów
- [ ] Jedno miejsce z podciągnięciami o sensownej wypadkowej wartości (typowo 2,2 do 10 kΩ)
- [ ] Krótkie przewody lub zwolniony zegar
- [ ] Unikalne adresy urządzeń
:::

## Sprawdź się

:::widget quiz-proto 330
:::
"""

LESSON_SPI = """:::summary Szybkie podsumowanie
- SPI to dwa **rejestry przesuwne** połączone w pętlę: z każdym taktem SCK master wysyła bit przez **MOSI**, a urządzenie przez **MISO**.
- Transmisja jest **pełnym dupleksem**: nadajesz i odbierasz jednocześnie. Aby coś odczytać, musisz coś wysłać (często bajt zero).
- Każde urządzenie ma własną linię **CS** (aktywną zwykle stanem niskim), a pozostałe układy ignorują magistralę.
:::

## Wymiana bajtów w ruchu

Ustaw bajty i wykonuj takty. Pomarańczowy bit właśnie wychodzi, niebieski właśnie wszedł.

:::widget spi-rejestry 440
:::

:::sequence Odczyt rejestru układu SPI
Master, Urządzenie
Master -> Urządzenie : CS w dół
Master -> Urządzenie : bajt komendy (adres rejestru)
Urządzenie --> Master : bajt bez znaczenia
Master -> Urządzenie : bajt zero (tylko takty)
Urządzenie --> Master : odpowiedź (wartość rejestru)
Master -> Urządzenie : CS w górę
:::

## Tryby SPI

Układy różnią się tym, w którym stanie jest zegar w spoczynku i przy którym zboczu próbkują dane. Zawsze sprawdź w nocie katalogowej, którego trybu wymaga układ.

| Tryb | CPOL (stan SCK w spoczynku) | CPHA (próbkowanie) |
|---|---|---|
| 0 | 0 (niski) | pierwsze zbocze (narastające) |
| 1 | 0 (niski) | drugie zbocze (opadające) |
| 2 | 1 (wysoki) | pierwsze zbocze (opadające) |
| 3 | 1 (wysoki) | drugie zbocze (narastające) |

```cpp Odczyt rejestru po SPI (Arduino)
#include <SPI.h>
const uint8_t CS = 5;
SPISettings cfg(1000000, MSBFIRST, SPI_MODE0);   // 1 MHz, MSB pierwszy, tryb 0

uint8_t readReg(uint8_t reg) {
  SPI.beginTransaction(cfg);
  digitalWrite(CS, LOW);
  SPI.transfer(reg | 0x80);        // wiele układów: bit 7 = odczyt (sprawdź notę)
  uint8_t v = SPI.transfer(0x00);  // dummy: generujemy takty, odbieramy wartość
  digitalWrite(CS, HIGH);
  SPI.endTransaction();
  return v;
}

void setup() { pinMode(CS, OUTPUT); digitalWrite(CS, HIGH); SPI.begin(); }
void loop() {}
```

:::warn Typowe pułapki
- Zły tryb SPI daje odczyty przesunięte o bit lub same jedynki.
- Brak `CS` w stanie wysokim przed startem może wprowadzić układ w błędny stan.
- Kilka urządzeń: tylko jedno ma `CS` niski w danej chwili, a wolna linia MISO nieaktywnych układów ma być w stanie wysokiej impedancji.
- Bit odczytu/zapisu w komendzie zależy od układu (tu `0x80` jest przykładem).
:::

## Sprawdź się

:::widget quiz-proto 330
:::
"""

LESSON_IZOLACJA = """:::summary Szybkie podsumowanie
- Gdy elektrody dotykają ciała, **żaden** tor prądowy z sieci 230 V nie może dotrzeć do pacjenta, nawet przy awarii.
- Rozwiązania: **zasilanie bateryjne**, **izolowane przetwornice DC-DC** i **izolacja sygnałów** (optoizolator, izolator cyfrowy), aby część pacjenta nie miała wspólnej masy z częścią sieciową.
- Na wejściu pomiarowym stosuje się też **ochronę przed defibrylacją**: rezystory, odgromnik (GDT) i diody TVS.
:::

:::danger Uwaga: projekt edukacyjny
Podłączanie elektronicznych układów do ciała człowieka jest niebezpieczne. Wyroby medyczne podlegają normom (m.in. IEC 60601-1) i badaniom. Ten materiał wyjaśnia zasady działania i **nie jest instrukcją budowy urządzenia medycznego**. Eksperymentuj tylko na zasilaniu bateryjnym, bez podłączania do sieci i do komputera zasilanego z sieci bez izolatora, oraz nigdy nie używaj takiego układu do diagnozy.
:::

## Po co izolacja galwaniczna

Wyobraź sobie monitor EKG zasilany z komputera, a komputer z gniazdka. Jeśli w zasilaczu dojdzie do uszkodzenia izolacji, napięcie sieciowe może znaleźć drogę przez masę układu, kable i elektrody do ciała pacjenta. Ochronne uziemienie komputera nie wystarcza w zastosowaniach medycznych, bo wymagania dotyczą także pojedynczej usterki i bardzo małych prądów upływu.

:::steps Jak odciąć pacjenta od sieci
Zasilanie | Bateria albo izolowana przetwornica DC-DC o odpowiednich parametrach (nie zwykły zasilacz bez izolacji)
Dane | Sygnał przechodzi przez optoizolator lub izolator cyfrowy, więc strony nie mają wspólnej masy
Połączenie z komputerem | USB przez izolator USB lub transmisja bezprzewodowa z urządzenia na baterii
:::

:::info Optoizolator
W optoizolatorze dioda LED zamienia sygnał na światło, a fototranzystor po drugiej stronie bariery zamienia je z powrotem na sygnał elektryczny. Obie strony nie mają wspólnej masy ani połączenia elektrycznego. Nowoczesne **izolatory cyfrowe** (pojemnościowe lub magnetyczne) są szybsze i trwalsze, a optoizolatory nadal są popularne w prostszych układach.
:::

## Ochrona wejścia przed defibrylacją

Podczas reanimacji defibrylator podaje w ciało pacjenta impuls o napięciu sięgającym kilku tysięcy woltów. Jeśli elektrody są wtedy podłączone, impuls może dotrzeć do wejścia pomiarowego. Dlatego stosuje się kaskadę zabezpieczeń:

:::widget defib-kaskada 330
:::

:::def
Rezystory szeregowe | Elementy dużej mocy i wysokiego napięcia, które ograniczają prąd impulsu.
GDT (odgromnik gazowy) | Po przekroczeniu progu napięcia (typowo kilkadziesiąt do kilkuset woltów, zależnie od modelu) gaz jonizuje się i zwiera impuls do masy.
Dioda TVS | Szybka dioda ograniczająca napięcie, która ścina to, co przeszło przez odgromnik.
:::

:::note Zastrzeżenie
Opis w archiwum mówił, że odgromnik odprowadza „99% energii” i że TVS zbija napięcie do 3,3 V. To uproszczenie: faktyczne wartości zależą od wybranych elementów, czasu impulsu i układu. Dobór i weryfikacja wymagają obliczeń i badań zgodnych z normą.
:::

## Sprawdź się

:::widget quiz-bezp 330
:::
"""

LESSON_KOND = """:::summary Szybkie podsumowanie
- Sygnał z ciała (EKG) ma amplitudę rzędu ułamków do kilku milivoltów, a kable działają jak anteny łapiące zakłócenia (zwłaszcza **50 Hz** z sieci).
- **Wzmacniacz różnicowy** wzmacnia różnicę między elektrodami i tłumi zakłócenia wspólne (miarą jest **CMRR**).
- **Filtr górnoprzepustowy** usuwa dryf linii izoelektrycznej, a **dolnoprzepustowy** (anty-aliasingowy) tłumi wysokie częstotliwości przed ADC.
- **Kondensatory odsprzęgające** (100 nF) przy każdym układzie czyszczą zasilanie z cyfrowych szpilek.
:::

## Wzmacniacz różnicowy i CMRR

Zakłócenie sieciowe indukuje się prawie tak samo na obu przewodach, więc różnica zostaje niemal czysta. Zwiększaj CMRR i obserwuj dolny wykres.

:::widget wzmacniacz-rozn 440
:::

:::note Czym jest CMRR
CMRR (Common-Mode Rejection Ratio) mówi, ile razy składowa wspólna jest słabiej wzmacniana niż różnicowa. 60 dB to 1000 razy, a 100 dB to 100 000 razy. W praktyce wynik zależy też od dopasowania elektrod i kabli, więc rzeczywisty układ osiąga mniej niż nota katalogowa samego wzmacniacza.
:::

## Filtry RC

Pierwszy rząd filtru RC ma częstotliwość graniczną `fc = 1 / (2π·R·C)`. Wypróbuj wartości: dla EKG górnoprzepustowy ok. 0,5 Hz (monitorowanie) to na przykład R = 330 kΩ i C = 1 µF.

:::widget filtr-rc 440
:::

:::warn Dobór częstotliwości
0,5 Hz jest typowe dla monitorowania, a w EKG diagnostycznym stosuje się niższe odcięcie (rzędu 0,05 Hz), żeby nie zniekształcać odcinka ST. W praktyce filtry aktywne wyższych rzędów lub filtracja cyfrowa dają lepsze charakterystyki niż pojedynczy człon RC.
:::

:::note Anti-aliasing
Przed przetwornikiem ADC filtr dolnoprzepustowy ma wyciąć składowe powyżej połowy częstotliwości próbkowania. W przeciwnym razie „zafałdują się” do pasma użytecznego i nie da się ich potem usunąć.
:::

## Odsprzęganie zasilania

:::checklist
- [ ] Kondensator ceramiczny 100 nF możliwie najbliżej pinów VCC i GND każdego układu scalonego
- [ ] Dodatkowy kondensator większej pojemności (np. 10 µF) przy wejściu zasilania płytki
- [ ] Krótkie ścieżki od kondensatora do pinów, bez przelotek między nimi a układem
- [ ] Analogowa i cyfrowa część płytki zasilane i prowadzone ostrożnie (osobne ścieżki mas łączone w jednym punkcie)
:::

## Sprawdź się

:::widget quiz-bezp 330
:::
"""

COURSES = [
    {"slug": "interfejsy-i-protokoly", "title": "Interfejsy i protokoły", "level": "intermediate", "position": 4,
     "summary": "UART, I2C, SPI i I2S: jak mikrokontroler rozmawia z układami, z animacjami ramek i kalkulatorami."},
    {"slug": "sygnal-i-bezpieczenstwo", "title": "Sygnał i bezpieczeństwo pomiarów", "level": "advanced", "position": 5,
     "summary": "Izolacja galwaniczna, ochrona wejścia i kondycjonowanie słabych sygnałów (np. EKG)."},
]

ARTICLES = [
    {"slug": "uart-i2c-spi-i2s-porownanie", "kind": "lesson", "course": "interfejsy-i-protokoly", "position": 1, "level": "basic",
     "title": "UART, I2C, SPI, I2S: który interfejs wybrać", "summary": "Porównanie czterech interfejsów, schemat doboru i zasady poziomów napięć.",
     "tags": ["uart", "i2c", "spi", "i2s", "magistrala"], "body": LESSON_PROTO, "widgets": {"quiz-proto": W_QUIZ_PROTO}},
    {"slug": "i2c-ramka-adresy-pullupy", "kind": "lesson", "course": "interfejsy-i-protokoly", "position": 2, "level": "intermediate",
     "title": "I2C: ramka, adresy i rezystory podciągające", "summary": "Animowana ramka I2C, kalkulator pull-upów i skaner adresów.",
     "tags": ["i2c", "pull-up", "adres", "wire"], "body": LESSON_I2C,
     "widgets": {"i2c-ramka": W_I2C, "i2c-pullup": W_PULLUP, "quiz-proto": W_QUIZ_PROTO}},
    {"slug": "spi-rejestry-przesuwne-tryby", "kind": "lesson", "course": "interfejsy-i-protokoly", "position": 3, "level": "intermediate",
     "title": "SPI: rejestry przesuwne, CS i tryby", "summary": "Wymiana bajtów w ruchu, tryby CPOL/CPHA i przykładowy odczyt rejestru.",
     "tags": ["spi", "cs", "mosi", "miso"], "body": LESSON_SPI,
     "widgets": {"spi-rejestry": W_SPI, "quiz-proto": W_QUIZ_PROTO}},
    {"slug": "izolacja-galwaniczna-i-ochrona-wejscia", "kind": "lesson", "course": "sygnal-i-bezpieczenstwo", "position": 1, "level": "advanced",
     "title": "Izolacja galwaniczna i ochrona wejścia", "summary": "Dlaczego pacjent musi być odcięty od sieci, jak działa izolacja i kaskada ochrony przed defibrylacją.",
     "tags": ["izolacja", "optoizolator", "defibrylacja", "ekg", "bezpieczeństwo"], "body": LESSON_IZOLACJA,
     "widgets": {"defib-kaskada": W_DEFIB, "quiz-bezp": W_QUIZ_BEZP}},
    {"slug": "kondycjonowanie-sygnalu-i-odsprzeganie", "kind": "lesson", "course": "sygnal-i-bezpieczenstwo", "position": 2, "level": "advanced",
     "title": "Kondycjonowanie sygnału i odsprzęganie", "summary": "Wzmacniacz różnicowy i CMRR, filtry RC, anty-aliasing oraz kondensatory odsprzęgające.",
     "tags": ["cmrr", "filtr", "rc", "odsprzęganie", "ekg"], "body": LESSON_KOND,
     "widgets": {"wzmacniacz-rozn": W_DIFF, "filtr-rc": W_RC, "quiz-bezp": W_QUIZ_BEZP}},
]
