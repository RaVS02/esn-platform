/* ESN – motyw jasny/ciemny.
 * Tryby: "auto" (ustawienie systemu, domyślnie), "light", "dark". Wybór zapamiętany w localStorage (klucz esn-theme).
 * Skrypt ładowany synchronicznie w <head>, żeby motyw ustawił się przed pierwszym malowaniem (bez błysku).
 * API: window.ESNTheme = { mode(), effective(), set(mode), cycle() }; zdarzenie "esn-theme" na document (detail: {mode, theme}).
 */
(function () {
  "use strict";
  var KEY = "esn-theme", MODES = ["auto", "light", "dark"], root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;

  function readMode() {
    try { var m = localStorage.getItem(KEY); if (MODES.indexOf(m) > 0) return m; } catch (e) { /* tryb prywatny itp. */ }
    return "auto";
  }
  function effective(mode) { return mode === "auto" ? (mq && mq.matches ? "light" : "dark") : mode; }

  // Etykiety z mechanizmu tłumaczeń (klucze theme.*); gdy i18n niedostępne – wersja polska
  var FALLBACK = {
    auto: "Motyw: automatyczny (według systemu). Kliknij, aby wybrać jasny.",
    light: "Motyw: jasny. Kliknij, aby wybrać ciemny.",
    dark: "Motyw: ciemny. Kliknij, aby wrócić do automatycznego."
  };
  function label(mode) { return window.ESNI18n ? window.ESNI18n.t("theme." + mode) : FALLBACK[mode]; }
  // Ikony SVG (bez zależności od Font Awesome – przełącznik działa też na stronach bez niego)
  var SVG_NS = "http://www.w3.org/2000/svg";
  var ICONS = {
    auto: ["M12 3a9 9 0 1 0 0 18V3z", "M12 3a9 9 0 0 1 0 18"],
    light: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"],
    dark: ["M20 14.5A8 8 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"]
  };

  function paintButton(mode) {
    var b = document.getElementById("themeToggle");
    if (!b) return;
    b.textContent = "";
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("width", "16"); svg.setAttribute("height", "16");
    svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round"); svg.setAttribute("aria-hidden", "true");
    ICONS[mode].forEach(function (d, i) {
      var path = document.createElementNS(SVG_NS, "path"); path.setAttribute("d", d);
      if (mode === "auto" && i === 0) path.setAttribute("fill", "currentColor");
      svg.appendChild(path);
    });
    b.appendChild(svg);
    b.title = label(mode);
    b.setAttribute("aria-label", label(mode));
  }

  function apply(announce) {
    var mode = readMode(), theme = effective(mode);
    root.setAttribute("data-theme", theme);
    root.setAttribute("data-theme-mode", mode);
    paintButton(mode);
    if (announce) {
      try { document.dispatchEvent(new CustomEvent("esn-theme", { detail: { mode: mode, theme: theme } })); } catch (e) { /* stare przeglądarki */ }
    }
  }

  function set(mode) {
    if (MODES.indexOf(mode) < 0) mode = "auto";
    try { if (mode === "auto") localStorage.removeItem(KEY); else localStorage.setItem(KEY, mode); } catch (e) { /* ignoruj */ }
    apply(true);
  }
  function cycle() { set(MODES[(MODES.indexOf(readMode()) + 1) % MODES.length]); }

  window.ESNTheme = {
    mode: readMode,
    effective: function () { return effective(readMode()); },
    set: set,
    cycle: cycle
  };

  apply(false);
  if (mq) {
    var onChange = function () { if (readMode() === "auto") apply(true); };
    if (mq.addEventListener) mq.addEventListener("change", onChange); else if (mq.addListener) mq.addListener(onChange);
  }
  document.addEventListener("DOMContentLoaded", function () {
    var b = document.getElementById("themeToggle");
    if (b) b.addEventListener("click", cycle);
    paintButton(readMode());
    document.dispatchEvent(new CustomEvent("esn-theme", { detail: { mode: readMode(), theme: effective(readMode()) } }));
  });
  // zmiana motywu w innej karcie
  window.addEventListener("storage", function (e) { if (e.key === KEY) apply(true); });
})();
