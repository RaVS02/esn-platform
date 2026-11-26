"""Części podstawowe edytora schematów (v41) – wspólne dla wszystkich, bez pinoutu w katalogu.

Id z prefiksem `std-` (zapis schematu odwołuje się do nich jak do części z katalogu – nie są kopiowane do schematu).
Źródło: dane startowe demo edytora (SchematPolaczenGUIWebApp, main.py SEED_PARTS) + uzupełnienia. Typ pinu `pass`
pasuje do każdego sygnału (elementy pasywne). Wartości (4k7, 100n…) wpisuje się przy węźle; dla kategorii Rezystor
i Kondensator edytor podpowiada jednostki i szereg E12.
Zmiana listy: dopisz część tutaj (id unikalne, bez zmiany id istniejących – są zapisane w schematach).
"""
BUILTIN_PARTS = [
 {
  "id": "std-gnd",
  "name": "Masa (GND)",
  "name_en": "Ground (GND)",
  "category": "Zasilanie",
  "desc": "Wspólny punkt masy – symbol",
  "desc_en": "Common ground point – symbol",
  "pins": [
   {
    "id": "GND",
    "name": "GND",
    "type": "gnd",
    "desc": "Masa",
    "desc_en": "Ground"
   }
  ],
  "source": "builtin"
 },
 {
  "id": "std-rail3v3",
  "name": "Szyna 3,3 V",
  "name_en": "3.3 V rail",
  "category": "Zasilanie",
  "desc": "Punkt zasilania 3,3 V – symbol",
  "desc_en": "3.3 V supply point – symbol",
  "pins": [
   {
    "id": "+3V3",
    "name": "+3V3",
    "type": "power",
    "desc": "Zasilanie 3,3 V",
    "desc_en": "3.3 V supply",
    "v": "3.3",
    "side": "R"
   }
  ],
  "source": "builtin"
 },
 {
  "id": "std-rail5v",
  "name": "Szyna 5 V",
  "name_en": "5 V rail",
  "category": "Zasilanie",
  "desc": "Punkt zasilania 5 V – symbol",
  "desc_en": "5 V supply point – symbol",
  "pins": [
   {
    "id": "+5V",
    "name": "+5V",
    "type": "power",
    "desc": "Zasilanie 5 V",
    "desc_en": "5 V supply",
    "v": "5",
    "side": "R"
   }
  ],
  "source": "builtin"
 },
 {
  "id": "std-battery",
  "name": "Bateria / akumulator",
  "name_en": "Battery / cell",
  "category": "Zasilanie",
  "desc": "Źródło napięcia stałego – napięcie wpisz w polu „Wartość”",
  "desc_en": "DC voltage source – enter the voltage in the “Value” field",
  "pins": [
   {
    "id": "+",
    "name": "+",
    "type": "power",
    "desc": "Biegun dodatni",
    "desc_en": "Positive terminal",
    "side": "R"
   },
   {
    "id": "-",
    "name": "-",
    "type": "gnd",
    "desc": "Biegun ujemny",
    "desc_en": "Negative terminal",
    "side": "R"
   }
  ],
  "source": "builtin"
 },
 {
  "id": "std-bat12",
  "name": "Zasilanie 12 V",
  "category": "Zasilanie",
  "desc": "Pakiet akumulatorów / zasilacz",
  "pins": [
   {
    "id": "+12V",
    "name": "+12V",
    "type": "power",
    "desc": "Wyjście zasilania głównego",
    "desc_en": "Main power output",
    "v": "12",
    "side": "R"
   },
   {
    "id": "GND",
    "name": "GND",
    "type": "gnd",
    "desc": "Masa",
    "desc_en": "Ground",
    "side": "R"
   }
  ],
  "name_en": "12 V supply",
  "desc_en": "Battery pack / power supply",
  "source": "builtin"
 },
 {
  "id": "std-buck5",
  "name": "Przetwornica 12→5 V",
  "category": "Zasilanie",
  "desc": "Buck DC-DC",
  "pins": [
   {
    "id": "VIN",
    "name": "VIN",
    "type": "power",
    "desc": "Wejście 12 V",
    "desc_en": "12 V input",
    "v": "12",
    "side": "L"
   },
   {
    "id": "GND_IN",
    "name": "GND_IN",
    "type": "gnd",
    "desc": "Masa wejścia",
    "desc_en": "Input ground",
    "side": "L"
   },
   {
    "id": "5V_OUT",
    "name": "5V_OUT",
    "type": "power",
    "desc": "Wyjście 5 V",
    "desc_en": "5 V output",
    "v": "5",
    "side": "R"
   },
   {
    "id": "GND_OUT",
    "name": "GND_OUT",
    "type": "gnd",
    "desc": "Masa wyjścia",
    "desc_en": "Output ground",
    "side": "R"
   }
  ],
  "name_en": "12→5 V converter",
  "source": "builtin"
 },
 {
  "id": "std-ams1117",
  "name": "Regulator 5→3,3 V (AMS1117)",
  "category": "Zasilanie",
  "desc": "Liniowy regulator LDO",
  "pins": [
   {
    "id": "VIN",
    "name": "VIN",
    "type": "power",
    "desc": "Wejście 5 V",
    "desc_en": "5 V input",
    "v": "5",
    "side": "L"
   },
   {
    "id": "GND",
    "name": "GND",
    "type": "gnd",
    "desc": "Masa",
    "desc_en": "Ground",
    "side": "L"
   },
   {
    "id": "VOUT",
    "name": "VOUT",
    "type": "power",
    "desc": "Wyjście 3,3 V",
    "desc_en": "3.3 V output",
    "v": "3.3",
    "side": "R"
   }
  ],
  "name_en": "5→3.3 V regulator (AMS1117)",
  "desc_en": "Linear LDO regulator",
  "source": "builtin"
 },
 {
  "id": "std-fuse",
  "name": "Bezpiecznik",
  "name_en": "Fuse",
  "category": "Zasilanie",
  "desc": "Bezpiecznik topikowy / polimerowy",
  "desc_en": "Fuse (glass / polyfuse)",
  "pins": [
   {
    "id": "1",
    "name": "1",
    "type": "pass",
    "desc": "Wejście",
    "desc_en": "Input",
    "side": "L"
   },
   {
    "id": "2",
    "name": "2",
    "type": "pass",
    "desc": "Wyjście",
    "desc_en": "Output",
    "side": "R"
   }
  ],
  "source": "builtin"
 },
 {
  "id": "std-resistor",
  "name": "Rezystor",
  "category": "Rezystor",
  "desc": "Element pasywny, wyprowadzenia równoważne",
  "pins": [
   {
    "id": "1",
    "name": "1",
    "type": "pass",
    "desc": "Wyprowadzenie 1",
    "desc_en": "Pin 1",
    "side": "L"
   },
   {
    "id": "2",
    "name": "2",
    "type": "pass",
    "desc": "Wyprowadzenie 2",
    "desc_en": "Pin 2",
    "side": "R"
   }
  ],
  "name_en": "Resistor",
  "desc_en": "Passive component, interchangeable leads",
  "source": "builtin"
 },
 {
  "id": "std-pot",
  "name": "Potencjometr",
  "name_en": "Potentiometer",
  "category": "Rezystor",
  "desc": "Rezystor regulowany – wartość w polu „Wartość”",
  "desc_en": "Variable resistor – value in the “Value” field",
  "pins": [
   {
    "id": "1",
    "name": "1",
    "type": "pass",
    "desc": "Koniec 1",
    "desc_en": "End 1",
    "side": "L"
   },
   {
    "id": "W",
    "name": "W",
    "type": "pass",
    "desc": "Suwak",
    "desc_en": "Wiper",
    "side": "R"
   },
   {
    "id": "2",
    "name": "2",
    "type": "pass",
    "desc": "Koniec 2",
    "desc_en": "End 2",
    "side": "L"
   }
  ],
  "source": "builtin"
 },
 {
  "id": "std-capacitor",
  "name": "Kondensator",
  "category": "Kondensator",
  "desc": "Element pasywny, wyprowadzenia równoważne",
  "pins": [
   {
    "id": "1",
    "name": "1",
    "type": "pass",
    "desc": "Wyprowadzenie 1",
    "desc_en": "Pin 1",
    "side": "L"
   },
   {
    "id": "2",
    "name": "2",
    "type": "pass",
    "desc": "Wyprowadzenie 2",
    "desc_en": "Pin 2",
    "side": "R"
   }
  ],
  "name_en": "Capacitor",
  "desc_en": "Passive component, interchangeable leads",
  "source": "builtin"
 },
 {
  "id": "std-inductor",
  "name": "Cewka (dławik)",
  "name_en": "Inductor",
  "category": "Inne",
  "desc": "Element pasywny – indukcyjność w polu „Wartość” (np. 10 µH)",
  "desc_en": "Passive component – inductance in the “Value” field (e.g. 10 µH)",
  "pins": [
   {
    "id": "1",
    "name": "1",
    "type": "pass",
    "desc": "Wyprowadzenie 1",
    "desc_en": "Pin 1",
    "side": "L"
   },
   {
    "id": "2",
    "name": "2",
    "type": "pass",
    "desc": "Wyprowadzenie 2",
    "desc_en": "Pin 2",
    "side": "R"
   }
  ],
  "source": "builtin"
 },
 {
  "id": "std-crystal",
  "name": "Rezonator kwarcowy",
  "name_en": "Crystal",
  "category": "Inne",
  "desc": "Kwarc – częstotliwość wpisz w polu „Wartość” (np. 16 MHz)",
  "desc_en": "Crystal – enter the frequency in the “Value” field (e.g. 16 MHz)",
  "pins": [
   {
    "id": "1",
    "name": "1",
    "type": "pass",
    "desc": "Wyprowadzenie 1",
    "desc_en": "Pin 1",
    "side": "L"
   },
   {
    "id": "2",
    "name": "2",
    "type": "pass",
    "desc": "Wyprowadzenie 2",
    "desc_en": "Pin 2",
    "side": "R"
   }
  ],
  "source": "builtin"
 },
 {
  "id": "std-diode",
  "name": "Dioda",
  "category": "Dioda",
  "desc": "Dioda prostownicza / sygnałowa",
  "pins": [
   {
    "id": "A",
    "name": "A",
    "type": "pass",
    "desc": "Anoda",
    "desc_en": "Anode",
    "side": "L"
   },
   {
    "id": "K",
    "name": "K",
    "type": "pass",
    "desc": "Katoda",
    "desc_en": "Cathode",
    "side": "R"
   }
  ],
  "name_en": "Diode",
  "desc_en": "Rectifier / signal diode",
  "source": "builtin"
 },
 {
  "id": "std-led2",
  "name": "Dioda LED",
  "name_en": "LED",
  "category": "Dioda",
  "desc": "Dioda świecąca – pamiętaj o rezystorze szeregowym",
  "desc_en": "Light-emitting diode – remember the series resistor",
  "pins": [
   {
    "id": "A",
    "name": "A",
    "type": "pass",
    "desc": "Anoda (+)",
    "desc_en": "Anode (+)",
    "side": "L"
   },
   {
    "id": "K",
    "name": "K",
    "type": "pass",
    "desc": "Katoda (−)",
    "desc_en": "Cathode (−)",
    "side": "R"
   }
  ],
  "source": "builtin"
 },
 {
  "id": "std-led",
  "name": "Dioda LED + rezystor",
  "category": "Dioda",
  "desc": "Wskaźnik",
  "pins": [
   {
    "id": "ANODE",
    "name": "ANODE",
    "type": "digital",
    "desc": "Anoda (przez rezystor)",
    "desc_en": "Anode (via resistor)",
    "side": "L"
   },
   {
    "id": "GND",
    "name": "GND",
    "type": "gnd",
    "desc": "Katoda / masa",
    "desc_en": "Cathode / ground",
    "side": "L"
   }
  ],
  "name_en": "LED + resistor",
  "desc_en": "Indicator",
  "source": "builtin"
 },
 {
  "id": "std-npn",
  "name": "Tranzystor NPN",
  "category": "Tranzystor",
  "desc": "Tranzystor bipolarny",
  "pins": [
   {
    "id": "B",
    "name": "B",
    "type": "pass",
    "desc": "Baza",
    "desc_en": "Base",
    "side": "L"
   },
   {
    "id": "C",
    "name": "C",
    "type": "pass",
    "desc": "Kolektor",
    "desc_en": "Collector",
    "side": "R"
   },
   {
    "id": "E",
    "name": "E",
    "type": "pass",
    "desc": "Emiter",
    "desc_en": "Emitter",
    "side": "R"
   }
  ],
  "name_en": "NPN transistor",
  "desc_en": "Bipolar transistor",
  "source": "builtin"
 },
 {
  "id": "std-pnp",
  "name": "Tranzystor PNP",
  "name_en": "PNP transistor",
  "category": "Tranzystor",
  "desc": "Tranzystor bipolarny",
  "desc_en": "Bipolar transistor",
  "pins": [
   {
    "id": "B",
    "name": "B",
    "type": "pass",
    "desc": "Baza",
    "desc_en": "Base",
    "side": "L"
   },
   {
    "id": "E",
    "name": "E",
    "type": "pass",
    "desc": "Emiter",
    "desc_en": "Emitter",
    "side": "R"
   },
   {
    "id": "C",
    "name": "C",
    "type": "pass",
    "desc": "Kolektor",
    "desc_en": "Collector",
    "side": "R"
   }
  ],
  "source": "builtin"
 },
 {
  "id": "std-nmos",
  "name": "Tranzystor MOSFET N",
  "name_en": "N-channel MOSFET",
  "category": "Tranzystor",
  "desc": "Tranzystor polowy z kanałem N",
  "desc_en": "N-channel field-effect transistor",
  "pins": [
   {
    "id": "G",
    "name": "G",
    "type": "pass",
    "desc": "Bramka",
    "desc_en": "Gate",
    "side": "L"
   },
   {
    "id": "D",
    "name": "D",
    "type": "pass",
    "desc": "Dren",
    "desc_en": "Drain",
    "side": "R"
   },
   {
    "id": "S",
    "name": "S",
    "type": "pass",
    "desc": "Źródło",
    "desc_en": "Source",
    "side": "R"
   }
  ],
  "source": "builtin"
 },
 {
  "id": "std-button",
  "name": "Przycisk",
  "category": "Czujnik",
  "desc": "Przycisk chwilowy",
  "pins": [
   {
    "id": "SIG",
    "name": "SIG",
    "type": "digital",
    "desc": "Sygnał (z podciągnięciem)",
    "desc_en": "Signal (with pull-up)",
    "side": "L"
   },
   {
    "id": "GND",
    "name": "GND",
    "type": "gnd",
    "desc": "Masa",
    "desc_en": "Ground",
    "side": "L"
   }
  ],
  "name_en": "Button",
  "desc_en": "Momentary push button",
  "source": "builtin"
 },
 {
  "id": "std-switch",
  "name": "Przełącznik",
  "name_en": "Switch",
  "category": "Złącze",
  "desc": "Przełącznik / zwora (2 wyprowadzenia)",
  "desc_en": "Switch / jumper (2 pins)",
  "pins": [
   {
    "id": "1",
    "name": "1",
    "type": "pass",
    "desc": "Wyprowadzenie 1",
    "desc_en": "Pin 1",
    "side": "L"
   },
   {
    "id": "2",
    "name": "2",
    "type": "pass",
    "desc": "Wyprowadzenie 2",
    "desc_en": "Pin 2",
    "side": "R"
   }
  ],
  "source": "builtin"
 },
 {
  "id": "std-header2",
  "name": "Złącze 2-pin",
  "name_en": "2-pin connector",
  "category": "Złącze",
  "desc": "Złącze śrubowe / goldpin",
  "desc_en": "Screw terminal / pin header",
  "pins": [
   {
    "id": "1",
    "name": "1",
    "type": "pass",
    "desc": "Wyprowadzenie 1",
    "desc_en": "Pin 1",
    "side": "L"
   },
   {
    "id": "2",
    "name": "2",
    "type": "pass",
    "desc": "Wyprowadzenie 2",
    "desc_en": "Pin 2",
    "side": "L"
   }
  ],
  "source": "builtin"
 },
 {
  "id": "std-header4",
  "name": "Złącze 4-pin",
  "category": "Złącze",
  "desc": "Listwa goldpin",
  "pins": [
   {
    "id": "1",
    "name": "1",
    "type": "pass",
    "desc": "Wyprowadzenie 1",
    "desc_en": "Pin 1",
    "side": "L"
   },
   {
    "id": "2",
    "name": "2",
    "type": "pass",
    "desc": "Wyprowadzenie 2",
    "desc_en": "Pin 2",
    "side": "L"
   },
   {
    "id": "3",
    "name": "3",
    "type": "pass",
    "desc": "Wyprowadzenie 3",
    "desc_en": "Pin 3",
    "side": "L"
   },
   {
    "id": "4",
    "name": "4",
    "type": "pass",
    "desc": "Wyprowadzenie 4",
    "desc_en": "Pin 4",
    "side": "L"
   }
  ],
  "name_en": "4-pin connector",
  "desc_en": "Pin header",
  "source": "builtin"
 },
 {
  "id": "std-buzzer",
  "name": "Brzęczyk (buzzer)",
  "name_en": "Buzzer",
  "category": "Wykonawczy",
  "desc": "Brzęczyk piezo lub elektromagnetyczny",
  "desc_en": "Piezo or magnetic buzzer",
  "pins": [
   {
    "id": "+",
    "name": "+",
    "type": "digital",
    "desc": "Sterowanie / zasilanie +",
    "desc_en": "Drive / supply +",
    "side": "L"
   },
   {
    "id": "-",
    "name": "-",
    "type": "gnd",
    "desc": "Masa",
    "desc_en": "Ground",
    "side": "L"
   }
  ],
  "source": "builtin"
 },
 {
  "id": "std-servo",
  "name": "Serwo SG90",
  "category": "Wykonawczy",
  "desc": "Serwomechanizm 5 V, sterowanie PWM",
  "pins": [
   {
    "id": "VCC",
    "name": "VCC",
    "type": "power",
    "desc": "Zasilanie 5 V",
    "desc_en": "5 V supply",
    "v": "5",
    "side": "L"
   },
   {
    "id": "GND",
    "name": "GND",
    "type": "gnd",
    "desc": "Masa",
    "desc_en": "Ground",
    "side": "L"
   },
   {
    "id": "SIG",
    "name": "SIG",
    "type": "pwm",
    "desc": "Sygnał sterujący PWM",
    "desc_en": "PWM control signal",
    "side": "L"
   }
  ],
  "name_en": "SG90 servo",
  "desc_en": "5 V servo, PWM control",
  "source": "builtin"
 },
 {
  "id": "std-dcmotor",
  "name": "Silnik DC",
  "category": "Wykonawczy",
  "desc": "Silnik szczotkowy",
  "pins": [
   {
    "id": "M+",
    "name": "M+",
    "type": "power",
    "desc": "Zacisk +",
    "desc_en": "Terminal +",
    "side": "L"
   },
   {
    "id": "M-",
    "name": "M-",
    "type": "power",
    "desc": "Zacisk −",
    "desc_en": "Terminal −",
    "side": "L"
   }
  ],
  "name_en": "DC motor",
  "desc_en": "Brushed motor",
  "source": "builtin"
 }
]

BY_ID = {p["id"]: p for p in BUILTIN_PARTS}
