/* Przykłady pinoutów (galeria i szablony edytora w Narzędziach). Ten sam format tekstowy, który wklejasz w formularzu komponentu.
   Przykłady SOIC-8, TO-92 i dioda mają blok [en] – pokazują wersje językowe jednego opisu. */
(function (global) {
  "use strict";
var EX = {
qfn: { title: _t("pe.qfn.t"), desc: _t("pe.qfn.d"),
text: `package: QFN-16
view: widok z góry
layout: quad
notes: Przykład poglądowy (nie prawdziwy układ). Pozycje pinów na bokach to konwencja QFN – zweryfikuj z rysunkiem „Top View” w datasheecie.
group: Magistrala SPI | MISO, MOSI, SCK, CS | Tryb 0, do 10 MHz
group: Magistrala I²C | SDA, SCL | Adres ustawiany pinem ADDR

# nr | nazwa | kategoria | typ | funkcja | uwagi
1 | IN1 | analog | Wejście analogowe | Kanał pomiarowy 1 |
2 | IN2 | analog | Wejście analogowe | Kanał pomiarowy 2 |
3 | IN3 | analog | Wejście analogowe | Kanał pomiarowy 3 |
4 | IN4 | analog | Wejście analogowe | Kanał pomiarowy 4 |
5 | SDA | i2c | I/O | Dane I²C | Wymaga rezystora podciągającego
6 | SCL | i2c | Wejście | Zegar I²C |
7 | ADDR | digital | Wejście | Wybór adresu I²C |
8 | INT | control | Wyjście | Przerwanie | Aktywne stanem niskim
9 | VDD | power | Zasilanie | Zasilanie 3,3 V | Kondensator 100 nF blisko pinu
10 | GND | ground | Masa | Masa |
11 | CLK | clock | Wejście | Zewnętrzny zegar |
12 | DRDY | control | Wyjście | Dane gotowe |
13 | MISO | spi | Wyjście | Dane z układu |
14 | MOSI | spi | Wejście | Dane do układu |
15 | SCK | spi | Wejście | Zegar SPI |
16 | CS | spi | Wejście | Wybór układu |
EP | EP | nc | Pad termiczny | Połącz z masą | Zalecane przelotki termiczne` },

soic: { title: _t("pe.soic.t"), desc: _t("pe.soic.d"),
text: `package: SOIC-8
view: widok z góry
layout: dual
notes: Przykład poglądowy – typowy rozkład podwójnego wzmacniacza operacyjnego. Sprawdź datasheet konkretnego modelu.

1 | OUT A | analog | Wyjście | Wyjście wzmacniacza A |
2 | IN− A | analog | Wejście | Wejście odwracające A |
3 | IN+ A | analog | Wejście | Wejście nieodwracające A |
4 | V− | ground | Zasilanie | Zasilanie ujemne / masa |
5 | IN+ B | analog | Wejście | Wejście nieodwracające B |
6 | IN− B | analog | Wejście | Wejście odwracające B |
7 | OUT B | analog | Wyjście | Wyjście wzmacniacza B |
8 | V+ | power | Zasilanie | Zasilanie dodatnie |

[en]
view: top view
notes: Illustrative example – a typical dual operational amplifier pinout. Check the datasheet of the specific part.
# nr | typ | funkcja | uwagi
1 | Output | Amplifier A output |
2 | Input | Amplifier A inverting input |
3 | Input | Amplifier A non-inverting input |
4 | Supply | Negative supply / ground |
5 | Input | Amplifier B non-inverting input |
6 | Input | Amplifier B inverting input |
7 | Output | Amplifier B output |` },

to92: { title: _t("pe.to92.t"), desc: _t("pe.to92.d"),
text: `package: TO-92
view: widok od strony płaskiej
layout: to92
notes: Przykład poglądowy. Kolejność E/B/C różni się między modelami (np. BC547 vs 2N2222) – zawsze sprawdź datasheet.

1 | E | analog | Emiter | Emiter (wyjście prądu) |
2 | B | control | Baza | Sterowanie prądem bazy | Rezystor szeregowy w bazie
3 | C | analog | Kolektor | Kolektor (obciążenie) |

[en]
view: view from the flat side
notes: Illustrative example. The E/B/C order differs between models (e.g. BC547 vs 2N2222) – always check the datasheet.
# nr | typ | funkcja | uwagi
1 | Emitter | Emitter (current output) |
2 | Base | Base current control | Series resistor in the base
3 | Collector | Collector (load) |` },

to220: { title: _t("pe.to220.t"), desc: _t("pe.to220.d"),
text: `package: TO-220
view: widok od przodu (napisem do siebie)
layout: to220
notes: Przykład poglądowy (typowy stabilizator liniowy). Zakładka bywa połączona z jednym z pinów – sprawdź datasheet.

1 | IN | power | Wejście | Napięcie wejściowe |
2 | GND | ground | Masa | Masa | Zakładka zwykle połączona z masą
3 | OUT | power | Wyjście | Napięcie wyjściowe |` },

sot23: { title: _t("pe.sot23.t"), desc: _t("pe.sot23.d"),
text: `package: SOT-23
view: widok z góry
layout: sot23
notes: Przykład poglądowy. Kolejność G/S/D zależy od modelu.

1 | G | control | Bramka | Sterowanie | Napięcie bramki zgodnie z Vgs(th)
2 | S | ground | Źródło | Źródło (zwykle do masy) |
3 | D | analog | Dren | Dren (obciążenie) |` },

diode: { title: _t("pe.diode.t"), desc: _t("pe.diode.d"),
text: `package: DO-35
view: widok z boku
layout: axial
notes: Przykład poglądowy. Pasek oznacza katodę.

1 | K | analog | Katoda | Strona z paskiem | Prąd płynie z A do K
2 | A | analog | Anoda | Strona bez paska |

[en]
view: side view
notes: Illustrative example. The stripe marks the cathode.
# nr | typ | funkcja | uwagi
1 | Cathode | Striped side | Current flows from A to K
2 | Anode | Side without the stripe |` },

sip: { title: _t("pe.sip.t"), desc: _t("pe.sip.d"),
text: `package: Moduł 4-pin
view: widok z góry
layout: sip

1 | VCC | power | Zasilanie | 5 V |
2 | TRIG | digital | Wejście | Impuls startu pomiaru |
3 | ECHO | digital | Wyjście | Impuls zwrotny | Dzielnik napięcia dla układów 3,3 V
4 | GND | ground | Masa | Masa |` },

board: { title: _t("pe.board.t"), desc: _t("pe.board.d"),
text: `package: Płytka rozwojowa (przykład)
view: widok z góry
layout: board
aspect: 1.6
notes: Przykład poglądowy – nazwy i układ wyprowadzeń są wymyślone, nie odpowiadają żadnej konkretnej płytce.
shape: rect | 1,36,9,28 | USB-C | conn
shape: rect | 64,18,28,60 | MODUŁ | chip
shape: rect | 12,2,76,10 | listwa A | conn
shape: rect | 12,88,76,10 | listwa B | conn
shape: rect | 26,66,34,22 | Qwiic | conn
shape: circle | 20,30,2.6 | BOOT | btn
shape: circle | 20,70,2.6 | LED | led
group: Qwiic (JST-SH, 4-pin) | Q1, Q2, Q3, Q4 | Złącze I²C: GND, 3V3, SDA, SCL
group: Magistrala I²C | SDA, SCL | Linia dostępna na listwie i w Qwiic
group: Magistrala I²S | BCLK, LRCLK, DIN | Wyjście audio
group: USB-C | U1, U2, U3 | VBUS, D+, D−

# nr @x,y | nazwa | kategoria | typ | funkcja | uwagi
1 @18,7 | 3V3 | power | Zasilanie | Wyjście 3,3 V |
2 @26,7 | GND | ground | Masa | Masa |
3 @34,7 | SDA | i2c | I/O | Dane I²C | Rezystor podciągający 4,7 kΩ
4 @42,7 | SCL | i2c | Wyjście | Zegar I²C |
5 @50,7 | BCLK | i2s | Wyjście | Zegar bitowy I²S |
6 @58,7 | LRCLK | i2s | Wyjście | Wybór kanału I²S |
7 @66,7 | DIN | i2s | Wejście | Dane I²S |
Q1 @30,72 | GND | ground | Masa | Qwiic – masa |
Q2 @38,72 | 3V3 | power | Zasilanie | Qwiic – 3,3 V |
Q3 @46,72 | SDA | i2c | I/O | Qwiic – dane |
Q4 @54,72 | SCL | i2c | Wyjście | Qwiic – zegar |
U1 @5,43 | VBUS | power | Zasilanie | Zasilanie z USB | 5 V
U2 @5,50 | D+ | usb | I/O | USB D+ |
U3 @5,57 | D− | usb | I/O | USB D− |` }
};
  global.ESNPinoutExamples = { EX: EX, LIST: ["qfn", "soic", "to92", "to220", "sot23", "diode", "sip", "board"] };
})(window);
