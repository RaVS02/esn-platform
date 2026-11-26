/* ESN – wspólny zestaw ikon kategorii (v44): edytor schematów (static/wiring/app.js → ICONS), magazyn i katalog.
 * Rysunki 24×24, kontur w kolorze tekstu (currentColor) – kolor nadaje kategoria. Identyczna kopia w esn_magazyn/static/esn-icons.js (pilnuje test),
 * a ścieżki muszą być takie same jak ICONS w edytorze (też test). Zapis w bazie magazynu: wartość „sch:<klucz>” w polu ikony kategorii.
 *   ESNIcons.svg(klucz, rozmiar?)  – znacznik <svg> (rozmiar domyślnie 1em, czyli jak tekst obok)
 *   ESNIcons.keys()                – lista kluczy (do wyboru ikony)
 *   ESNIcons.forCategory(nazwa)    – klucz dla nazwy kategorii magazynu/katalogu (np. „Czujniki” → sensor)
 */
(function (global) {
  "use strict";
  var ICONS = {
  "mcu": "<rect x=\"6\" y=\"6\" width=\"12\" height=\"12\" rx=\"1.5\"/><rect x=\"9.5\" y=\"9.5\" width=\"5\" height=\"5\" rx=\".6\"/><path d=\"M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3\"/>",
  "ic": "<rect x=\"7\" y=\"3.5\" width=\"10\" height=\"17\" rx=\"1.5\"/><path d=\"M10.5 3.5a1.5 1.5 0 0 0 3 0M3.5 7.5H7M3.5 12H7M3.5 16.5H7M17 7.5h3.5M17 12h3.5M17 16.5h3.5\"/>",
  "module": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><rect x=\"6.5\" y=\"8.5\" width=\"6\" height=\"6\" rx=\".8\"/><path d=\"M15.5 9h2.5M15.5 12h2.5M15.5 15h2.5\"/>",
  "sensor": "<circle cx=\"8.5\" cy=\"15.5\" r=\"1.8\"/><path d=\"M8.5 9.5a6 6 0 0 1 6 6M8.5 4.5a11 11 0 0 1 11 11\"/>",
  "display": "<rect x=\"3\" y=\"4.5\" width=\"18\" height=\"12\" rx=\"1.5\"/><path d=\"M9 20h6M12 16.5V20\"/>",
  "power": "<path d=\"M13 3 5.5 13.5H11L10 21l8-10.5h-5.5L13 3z\"/>",
  "conn": "<path d=\"M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0V8zM12 16v5\"/>",
  "res": "<path d=\"M2.5 12H6l1.5-5 3 10 3-10 3 10 1.5-5h3.5\"/>",
  "cap": "<path d=\"M10 5v14M14 5v14M3 12h7M14 12h7\"/>",
  "diode": "<path d=\"M7 6.5v11l9-5.5-9-5.5zM17 6.5v11M2.5 12H7M17 12h4.5\"/>",
  "trans": "<path d=\"M9 6v12M3 12h6M9 9.5l8-5.5M9 14.5l8 5.5\"/>",
  "act": "<circle cx=\"12\" cy=\"12\" r=\"3.2\"/><path d=\"M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1\"/>",
  "box": "<path d=\"M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12 4 7.5\"/>"
};
  var CAT = {"Mikrokontrolery": "mcu", "Zasilacze": "power", "Zasilanie": "power", "Czujniki": "sensor", "Układy scalone": "ic", "Moduły": "module",
    "Wyświetlacze": "display", "Diody": "diode", "Kondensatory": "cap", "Rezystory": "res", "Tranzystory": "trans", "Złącza": "conn",
    "Aktuatory": "act", "Silniki": "act", "Inne": "box"};
  function svg(key, size) {
    var s = size ? size + "px" : "1em";
    return '<svg class="esn-ic" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[key] || ICONS.box) + "</svg>";
  }
  global.ESNIcons = { svg: svg, keys: function () { return Object.keys(ICONS); }, has: function (k) { return !!ICONS[k]; },
    forCategory: function (name) { return CAT[name] || null; }, _paths: ICONS };
})(window);
