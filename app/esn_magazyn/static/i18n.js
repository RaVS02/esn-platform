/* ESN – mechanizm tłumaczeń (i18n). Rdzeń niezależny od języków; słowniki w static/i18n/<kod>.js.
 *
 * Dodanie języka = nowy plik static/i18n/<kod>.js (ESNI18n.add) + jeden <script> w szablonie. Nic poza tym.
 * Brak klucza w języku → wersja polska (język bazowy) → sam klucz (ostrzeżenie w konsoli).
 *
 * API (window.ESNI18n, skrót window.t):
 *   t(klucz, {param})        – tekst z podstawieniem {param}
 *   tn(klucz, n, {param})    – liczba mnoga wg reguł języka (Intl.PluralRules): klucz.one / .few / .many / .other
 *   apply(korzeń)            – tłumaczy elementy z atrybutami data-i18n="klucz" oraz data-i18n-attr="title:klucz;placeholder:klucz"
 *   lang(), set(kod), list() – bieżący język, zmiana (zapis w localStorage, klucz esn-lang), lista języków [{code,name}]
 *   mountSwitch(element)     – wstawia przełącznik języka (select)
 *   num(n), date(d, opcje)   – formatowanie liczb i dat wg ustawień regionalnych języka
 *   missing(kod)             – klucze bazowe, których brakuje w danym języku (do testów i kontroli)
 * Zdarzenie "esn-lang" na document (detail: {lang}) po zmianie języka.
 * Kolejność wyboru języka: zapisany wybór → język przeglądarki (navigator.languages) → polski.
 */
(function () {
  "use strict";
  var KEY = "esn-lang", BASE = "pl", dicts = {}, meta = {}, cur = null, warned = {};

  function add(code, dict, info) {
    dicts[code] = Object.assign(dicts[code] || {}, dict);
    if (info) meta[code] = info;
    cur = null; // wybór liczony ponownie, gdy doładował się kolejny słownik
  }
  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function pick() {
    var s = stored();
    if (s && dicts[s]) return s;
    var nav = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || BASE]);
    for (var i = 0; i < nav.length; i++) {
      var c = String(nav[i] || "").toLowerCase().split("-")[0];
      if (dicts[c]) return c;
    }
    return BASE;
  }
  function lang() { if (!cur) cur = pick(); return cur; }
  function locale() { var m = meta[lang()]; return (m && m.locale) || lang(); }

  function t(key, params) {
    var l = lang(), d = dicts[l] || {}, s = d[key];
    if (s == null) s = (dicts[BASE] || {})[key];
    if (s == null) { if (!warned[key]) { warned[key] = 1; try { console.warn("[i18n] brak klucza:", key); } catch (e) { /* brak konsoli */ } } return key; }
    return params ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return params[k] != null ? params[k] : m; }) : s;
  }
  function tn(key, n, params) {
    var rule = "other";
    try { rule = new Intl.PluralRules(locale()).select(n); } catch (e) { /* stare przeglądarki */ }
    var p = Object.assign({ n: n }, params || {}), l = lang();
    var k = [key + "." + rule, key + ".other"].filter(function (x) { return (dicts[l] && dicts[l][x] != null) || (dicts[BASE] && dicts[BASE][x] != null); })[0];
    return t(k || key + ".other", p);
  }

  function apply(root) {
    root = root || document;
    var i, el, n = root.querySelectorAll ? root.querySelectorAll("[data-i18n], [data-i18n-attr]") : [];
    for (i = 0; i < n.length; i++) {
      el = n[i];
      var k = el.getAttribute("data-i18n");
      if (k) el.textContent = t(k);
      var a = el.getAttribute("data-i18n-attr");
      if (a) a.split(";").forEach(function (pair) {
        var j = pair.indexOf(":");
        if (j > 0) el.setAttribute(pair.slice(0, j).trim(), t(pair.slice(j + 1).trim()));
      });
    }
  }

  function list() {
    return Object.keys(dicts).map(function (c) { return { code: c, name: (meta[c] && meta[c].name) || c.toUpperCase() }; })
      .sort(function (a, b) { return a.code === BASE ? -1 : b.code === BASE ? 1 : a.name.localeCompare(b.name); });
  }

  function set(code, quiet) {
    if (!dicts[code]) code = BASE;
    try { localStorage.setItem(KEY, code); } catch (e) { /* tryb prywatny */ }
    cur = code;
    document.documentElement.setAttribute("lang", code);
    apply(document);
    if (!quiet) { try { document.dispatchEvent(new CustomEvent("esn-lang", { detail: { lang: code } })); } catch (e) { /* stare przeglądarki */ } }
  }

  // Przełącznik: przycisk z kodem języka + własne menu (spójny wygląd w motywach, pełne nazwy języków, obsługa klawiatury)
  function mountSwitch(host) {
    if (!host) return;
    host.textContent = "";
    var langs = list();
    if (langs.length < 2) return; // jeden język – przełącznik niepotrzebny
    function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
    var btn = el("button", "lang-btn", lang().toUpperCase() + " \u25BE"), menu = el("div", "lang-menu"), items = [];
    btn.type = "button"; btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("data-i18n-attr", "aria-label:lang.label;title:lang.label");
    btn.setAttribute("aria-label", t("lang.label")); btn.title = t("lang.label");
    menu.setAttribute("role", "listbox"); menu.hidden = true;
    function close(focusBtn) { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); if (focusBtn) btn.focus(); }
    function open() { menu.hidden = false; btn.setAttribute("aria-expanded", "true"); var cur = items.filter(function (i) { return i.dataset.code === lang(); })[0] || items[0]; cur.focus(); }
    langs.forEach(function (l) {
      var it = el("button", "lang-opt" + (l.code === lang() ? " on" : ""), l.name);
      it.type = "button"; it.dataset.code = l.code; it.setAttribute("role", "option"); it.setAttribute("aria-selected", String(l.code === lang()));
      it.insertBefore(el("b", "lang-code", l.code.toUpperCase()), it.firstChild);
      it.addEventListener("click", function () { close(false); if (l.code !== lang()) set(l.code); });
      items.push(it); menu.appendChild(it);
    });
    btn.addEventListener("click", function () { if (menu.hidden) open(); else close(false); });
    menu.addEventListener("keydown", function (e) {
      var i = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === "Escape") { e.preventDefault(); close(true); }
      else if (e.key === "Tab") close(false);
    });
    document.addEventListener("click", function (e) { if (!host.contains(e.target)) close(false); });
    host.appendChild(btn); host.appendChild(menu);
  }

  function missing(code) {
    var base = dicts[BASE] || {}, d = dicts[code] || {};
    return Object.keys(base).filter(function (k) { return d[k] == null; });
  }

  window.ESNI18n = {
    add: add, t: t, tn: tn, apply: apply, lang: lang, set: set, list: list, mountSwitch: mountSwitch, missing: missing,
    num: function (n, o) { return new Intl.NumberFormat(locale(), o).format(n); },
    date: function (d, o) { return new Intl.DateTimeFormat(locale(), o || { dateStyle: "medium" }).format(d instanceof Date ? d : new Date(d)); }
  };
  window.t = t;

  document.addEventListener("DOMContentLoaded", function () {
    document.documentElement.setAttribute("lang", lang());
    apply(document);
    var hosts = document.querySelectorAll("[data-lang-switch]");
    for (var i = 0; i < hosts.length; i++) mountSwitch(hosts[i]);
  });
  // zmiana języka w innej karcie (portal ↔ magazyn dzielą localStorage)
  window.addEventListener("storage", function (e) {
    if (e.key === KEY && e.newValue && dicts[e.newValue]) set(e.newValue);
  });
})();
