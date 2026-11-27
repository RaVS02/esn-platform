# Kalkulatory (v51–v57)

Narzędzia → Kalkulatory (`#tools/calc`), każdy kalkulator ma własny adres `#tools/calc/<id>` (można linkować z Wiedzy i kart komponentów).

## Pliki
- `app/static/calc.js` – rdzeń `ESNCalc`: rejestracja w `ESNTools` (kafelek „calc”), lista/zapowiedzi, nawigacja chipami, api pól i wyników,
  czyste funkcje `ESNCalc.math` (parse z przedrostkami SI i notacją 4k7/2R2, fmt, szeregi E6–E96, `nearest`, `powerRating`).
- `app/static/calc-basic.js` – paczka 1: `ohm`, `divider`, `led`, `rescode` + funkcje `ESNCalcBasic` (ohm, pickDivider, encode/decode kodu paskowego).
- `app/static/calc-parts.js` (v52) – `rcombo` (łączenie R/C/L szeregowo i równolegle, dobór pary do wartości), `capcode` (kod kondensatora w obie strony); `ESNCalcParts`.
- `app/static/calc-comm.js` (v52) – `baud` (UART/SPI/I²C, dzielnik UBRR i USARTDIV z błędem), `timer` (preskaler, TOP, PWM, ESP32 LEDC), `rc` (filtr RC, τ, ładowanie, dobór C); `ESNCalcComm`.
- `app/static/calc-analog.js` (v53, v57) – `opamp` (odwracający/nieodwracający/wtórnik, nasycenie, pasmo z GBW, dobór Rf/Rg), `diffamp` (różnicowy, CMRR i wpływ tolerancji), `summer` (sumujący 2–4 wejść), `schmitt` (komparator z histerezą, pętla na wykresie, dobór R1/R2 i Vref do progów); `ESNCalcAnalog` (+ `railsOf`).
- `app/static/calc-power.js` (v53) – `battery` (cykl pracy, średni prąd), `ldo` (straty, sprawność, Tj), `trace` (IPC-2221, rezystancja i spadek); `ESNCalcPower`.
- Filtr RC (v53): schemat dolno-/górnoprzepustowy i wykres Bodego (SVG, klasy `calc-g-*`). Strona główna kalkulatorów: objaśnienie szeregów E, tolerancji, kodów i przedrostków.
- `app/static/calc.css` – wygląd (tylko zmienne motywu; fizyczne kolory pasków rezystora w JS).
- `app/tests/test_calc.py` – matematyka uruchamiana w Node.

## Nowy kalkulator
```js
ESNCalc.add({ id: "baud", icon: "gauge-high", group: "comm", title: "calc.baud.t", desc: "calc.baud.d", mount: function (el, api) {
  var f = api.field({ key: "clk", label: _t("calc.baud.clk"), unit: "Hz", prefixes: ["k", "M"], defPrefix: "M", def: "16" });
  var res = api.results(), w = api.warn();
  el.appendChild(api.card([f.el])); el.appendChild(api.card([res.el, w.el, api.formula([["wzór", "opis"]], "notatka")]));
  api.onChange(function () { res.show([["etykieta", M.fmt(f.get(), "Hz")]]); w.show([["warn", "tekst"]]); });
} });
```
- Grupy: `basic`, `analog`, `comm`, `power`. Id z listy zapowiedzi (`PLANNED` w calc.js) znika z zapowiedzi po rejestracji.
- api: `field`, `select`, `modes`, `results`, `warn` (poziomy ok/info/warn/bad), `formula`, `copy`, `card`, `svg`, `keep/kept` (stan w localStorage `esn-calc`).
- Teksty tylko przez `_t('calc.…')` (literalne klucze – pilnuje test_i18n). Plik dołącz w `index.html` po `calc.js`, podbij `?v=`.

## Zasady
Liczenie na bieżąco, przedrostki w polu lub z listy, wartości z szeregu E z błędem w %, zapas mocy 2×, ostrzeżenia praktyczne (GPIO, ADC, obciążenie).

## Pomysły na dalej
Filtry 2. rzędu (Sallen-Key), timer 555, stabilizator na diodzie Zenera, przetwornica buck/boost (cewka, kondensatory).
