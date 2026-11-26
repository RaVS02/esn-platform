/* Poradnik edytora schematów (Narzędzia → Edytor schematów), PL/EN.
 * Struktura sekcji: { t: tytuł, p: [akapity], ul: [punkty], code: "przykład", tbl: [[kol1, kol2], …] }; `kod` w tekście = <code>.
 * ESNWiringGuide.render(h, lang) → element <details> (zwinięty). Treść opisuje edytor z static/wiring/app.js – zmieniając edytor, popraw też tutaj. */
(function (global) {
  "use strict";
  var G = {
    pl: { title: "Poradnik: jak korzystać z edytora i dodać własną część", sections: [
      { t: "1. Pierwszy schemat", ul: [
        "**Nowy schemat** (pasek edytora) – nazwę zmienisz w polu obok listy schematów.",
        "Kliknij część w bibliotece po lewej, żeby dodać ją na płótno. Kafelki przesuwasz myszą (albo palcem).",
        "**Widok szczegółowy** – przeciągnij z pinu na pin, żeby je połączyć. **Widok uproszczony** pokazuje zbiorczo, za co odpowiadają połączenia (zasilanie, I²C, SPI…).",
        "**Zapisz** – zalogowani zapisują na koncie, goście w tej przeglądarce. Niezapisane zmiany sygnalizuje napis obok przycisku.",
        "Zaznaczony przewód lub część usuniesz klawiszem Del; Ctrl+Z / Ctrl+Y – cofnij / ponów."] },
      { t: "2. Skąd biorą się części", tbl: [
        ["Podstawowe", "rezystor, kondensator, dioda, LED, tranzystory, zasilanie, masa, złącza… – wspólne dla wszystkich, bez edycji"],
        ["Katalog", "podzespoły z katalogu platformy, które mają pinout – nazwy i funkcje pinów pochodzą z pinoutu (w języku platformy), ↗ otwiera kartę komponentu"],
        ["Własne", "części, które dodajesz sam – widzisz je tylko Ty (i schematy, w których ich użyjesz); lista „Moje części” niżej pozwala je edytować i usuwać"]],
        p: ["Złożony podzespół, którego nie ma w katalogu, najlepiej dodać do katalogu z pinoutem (Katalog podzespołów → narzędzie Pinout) – wtedy przyda się wszystkim. Część własna to szybka droga do schematu „na już”."] },
      { t: "3. Własna część krok po kroku", ul: [
        "**Nowa część** (pod biblioteką albo w liście „Moje części”).",
        "**Nazwa** i **kategoria** – kategoria wybiera ikonę i kolor kafelka, a dla *Rezystor* i *Kondensator* włącza wartości z jednostkami (4k7, 100n).",
        "**Wyprowadzenia** – jedno w linii, pola oddzielone znakiem `|`: `nazwa | typ | opis | napięcie | strona`. Wymagana jest tylko nazwa; brak typu = `digital`.",
        "**Napięcie** (opcjonalne, dla pinów zasilania) to liczba w woltach, np. `3.3` – edytor ostrzeże, gdy połączysz zasilanie o różnych napięciach (także pośrednio, w jednej sieci).",
        "**Strona** `L` albo `R` ustala, po której stronie kafelka stoi pin (bez niej edytor ustawia piny sam, w stronę partnera połączenia)."],
        code: "VCC  | power   | Zasilanie modułu | 3.3 | L\nGND  | gnd     | Masa             |     | L\nSDA  | i2c_sda | Dane I²C\nSCL  | i2c_scl | Zegar I²C\nINT  | digital | Przerwanie (aktywne niskim)  |  | R",
        p: ["Nazwa pinu jest jednocześnie jego identyfikatorem: przewody są przypięte do nazwy. **Zmiana nazwy pinu w istniejącej części rozłącza jego przewody** – zmieniaj opis, nie nazwę. Powtórzona nazwa dostaje końcówkę `_2`, `_3`.",
            "Ikona i zdjęcie (adres URL) są opcjonalne – bez nich kafelek ma ikonę kategorii."] },
      { t: "4. Typy pinów (pole „typ”)", tbl: [
        ["power, gnd", "zasilanie i masa (sprawdzane: zwarcie z sygnałem, różne napięcia, brak masy)"],
        ["i2c_sda, i2c_scl", "I²C – edytor pilnuje, żeby SDA łączyć z SDA, a SCL z SCL"],
        ["spi_sck, spi_mosi, spi_miso, spi_cs", "SPI – role muszą się zgadzać, brak CS jest zgłaszany"],
        ["uart_tx, uart_rx", "UART – TX trzeba połączyć z RX (skrzyżowanie)"],
        ["digital, gpio, pwm, analog, clock, control", "sygnały ogólne; `gpio` pasuje do każdego sygnału"],
        ["pass", "wyprowadzenie elementu pasywnego (rezystor, kondensator…) – pasuje do wszystkiego"],
        ["i2c, spi, uart, i2s, usb, can, debug, rf, nc, other", "grupy ogólne (kolor magistrali bez sprawdzania ról)"]] },
      { t: "5. Wartości, sprawdzenie, eksport", ul: [
        "**Wartość** przy części (panel po prawej): rezystor i kondensator – liczba z jednostką (`4k7` = 4,7 kΩ, `100n` = 100 nF, lista szeregu E12); inne – dowolny tekst, np. `16 MHz`. Wartość trafia do listy części (BOM).",
        "**Sprawdzenie** (panel po prawej, gdy nic nie jest zaznaczone): ostrzeżenia (prawdopodobne błędy) i podpowiedzi (np. brak rezystora podciągającego I²C). Nie blokują zapisu.",
        "**Eksport**: obraz PNG/SVG, PDF (druk), lista części i lista połączeń (CSV), dane schematu (JSON – do przeniesienia lub kopii).",
        "**Podpięcie do projektu** – w liście „Moje schematy” albo w karcie projektu; schemat pokaże się wtedy w karcie, a użyte części z katalogu trafią do podzespołów projektu."] },
      { t: "6. Przydatne skróty", tbl: [
        ["Shift+klik, Shift+przeciągnięcie tła, Ctrl+A", "zaznaczanie wielu elementów"],
        ["Ctrl+C / Ctrl+X / Ctrl+V, Ctrl+D", "kopiuj / wytnij / wklej (także do innego schematu), duplikuj"],
        ["strzałki (Shift = 50 px)", "przesuwanie zaznaczenia"],
        ["◇ na zaznaczonym przewodzie", "przeciągnij, żeby dodać punkt zaczepienia; dwuklik na punkcie go usuwa"],
        ["Esc", "odznacz"]] },
      { t: "7. Tryb gościa", p: ["Bez logowania schematy i części własne są zapisywane **tylko w tej przeglądarce** – wyczyszczenie danych przeglądarki, tryb prywatny albo inny komputer oznacza ich brak. Zrób eksport JSON albo zaloguj się i użyj „Przenieś schematy z tej przeglądarki na konto”."] }
    ] },
    en: { title: "Guide: using the editor and adding your own part", sections: [
      { t: "1. Your first diagram", ul: [
        "**New diagram** (editor toolbar) – rename it in the field next to the diagram list.",
        "Click a part in the library on the left to add it to the canvas. Move tiles with the mouse (or a finger).",
        "**Detailed view** – drag from pin to pin to connect them. The **simplified view** groups connections by purpose (power, I²C, SPI…).",
        "**Save** – logged-in users save to their account, guests in this browser. Unsaved changes are shown next to the button.",
        "Delete a selected wire or part with Del; Ctrl+Z / Ctrl+Y – undo / redo."] },
      { t: "2. Where parts come from", tbl: [
        ["Basic", "resistor, capacitor, diode, LED, transistors, power, ground, connectors… – shared by everyone, not editable"],
        ["Catalog", "platform catalog components that have a pinout – pin names and functions come from the pinout (in the platform language), ↗ opens the component page"],
        ["Own", "parts you add yourself – only you see them (and the diagrams that use them); the “My parts” list below lets you edit and delete them"]],
        p: ["A complex component that is missing from the catalog is best added to the catalog with a pinout (Component catalog → Pinout tool) – then everyone can use it. An own part is the quick way to a diagram right now."] },
      { t: "3. Your own part, step by step", ul: [
        "**New part** (below the library or in the “My parts” list).",
        "**Name** and **category** – the category sets the tile icon and colour, and for *Resistor* and *Capacitor* it enables values with units (4k7, 100n).",
        "**Pins** – one per line, fields separated by `|`: `name | type | description | voltage | side`. Only the name is required; no type = `digital`.",
        "**Voltage** (optional, for power pins) is a number in volts, e.g. `3.3` – the editor warns when you connect supplies with different voltages (also indirectly, within one net).",
        "**Side** `L` or `R` puts the pin on that side of the tile (without it the editor places pins itself, facing the connected part)."],
        code: "VCC  | power   | Module supply | 3.3 | L\nGND  | gnd     | Ground        |     | L\nSDA  | i2c_sda | I²C data\nSCL  | i2c_scl | I²C clock\nINT  | digital | Interrupt (active low)  |  | R",
        p: ["The pin name is also its identifier: wires are attached to the name. **Renaming a pin of an existing part disconnects its wires** – change the description, not the name. A repeated name gets a `_2`, `_3` suffix.",
            "The icon and photo (URL) are optional – without them the tile shows the category icon."] },
      { t: "4. Pin types (the “type” field)", tbl: [
        ["power, gnd", "power and ground (checked: short to a signal, different voltages, missing ground)"],
        ["i2c_sda, i2c_scl", "I²C – the editor makes sure SDA goes to SDA and SCL to SCL"],
        ["spi_sck, spi_mosi, spi_miso, spi_cs", "SPI – roles must match, a missing CS is reported"],
        ["uart_tx, uart_rx", "UART – TX must go to RX (crossed)"],
        ["digital, gpio, pwm, analog, clock, control", "general signals; `gpio` fits any signal"],
        ["pass", "lead of a passive component (resistor, capacitor…) – fits anything"],
        ["i2c, spi, uart, i2s, usb, can, debug, rf, nc, other", "general groups (bus colour without role checks)"]] },
      { t: "5. Values, checks, export", ul: [
        "**Value** of a part (right panel): resistor and capacitor – a number with a unit (`4k7` = 4.7 kΩ, `100n` = 100 nF, E12 series list); others – free text, e.g. `16 MHz`. The value goes to the parts list (BOM).",
        "**Check** (right panel when nothing is selected): warnings (likely mistakes) and hints (e.g. a missing I²C pull-up resistor). They never block saving.",
        "**Export**: PNG/SVG image, PDF (print), parts list and connection list (CSV), diagram data (JSON – to move or back up).",
        "**Attach to a project** – in the “My diagrams” list or on the project page; the diagram then appears on the project page and the catalog parts it uses are added to the project components."] },
      { t: "6. Handy shortcuts", tbl: [
        ["Shift+click, Shift+drag on background, Ctrl+A", "select several items"],
        ["Ctrl+C / Ctrl+X / Ctrl+V, Ctrl+D", "copy / cut / paste (also into another diagram), duplicate"],
        ["arrows (Shift = 50 px)", "move the selection"],
        ["◇ on a selected wire", "drag to add a waypoint; double-click a waypoint to remove it"],
        ["Esc", "deselect"]] },
      { t: "7. Guest mode", p: ["Without logging in, diagrams and own parts are saved **only in this browser** – clearing browser data, a private window or another computer means they are gone. Export JSON, or log in and use “Move diagrams from this browser to your account”."] }
    ] }
  };

  // tekst z **pogrubieniem**, *kursywą* i `kodem` → węzły DOM (bez innerHTML)
  function rich(h, text) {
    var out = [], re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(document.createTextNode(text.slice(last, m.index)));
      var s = m[0];
      out.push(s[0] === "`" ? h("code", { text: s.slice(1, -1) }) : s[1] === "*" ? h("strong", { text: s.slice(2, -2) }) : h("em", { text: s.slice(1, -1) }));
      last = m.index + s.length;
    }
    if (last < text.length) out.push(document.createTextNode(text.slice(last)));
    return out;
  }
  function render(h, lang) {
    var g = G[lang] || G.pl;
    var det = h("details", { "class": "wl wg" }, [h("summary", {}, [h("span", { text: g.title })])]);
    var body = h("div", { "class": "wg-body" });
    g.sections.forEach(function (s) {
      var sec = h("section", { "class": "wg-sec" }, [h("h4", { text: s.t })]);
      if (s.ul) sec.appendChild(h("ul", {}, s.ul.map(function (x) { return h("li", {}, rich(h, x)); })));
      if (s.tbl) sec.appendChild(h("table", { "class": "wg-tbl" }, [h("tbody", {}, s.tbl.map(function (r) {
        return h("tr", {}, [h("td", {}, [h("code", { text: r[0] })]), h("td", {}, rich(h, r[1]))]); }))]));
      if (s.code) sec.appendChild(h("pre", { "class": "wg-code" }, [h("code", { text: s.code })]));
      (s.p || []).forEach(function (x) { sec.appendChild(h("p", {}, rich(h, x))); });
      body.appendChild(sec);
    });
    det.appendChild(body);
    return det;
  }
  global.ESNWiringGuide = { render: render, _data: G };
})(window);
