/* Filtr języka treści (Wiedza, Baza projektów): checkboxy języków + opcje. Stan w localStorage `esn-lang-filter`.
   ESNLangFilter.get() -> { langs:[kody], merge:bool, badges:bool }
   ESNLangFilter.query() -> "langs=pl,en&merge=1"
   ESNLangFilter.mount(el, { merge:bool, onChange:fn }) – rysuje panel (<details>) */
(function (global) {
  "use strict";
  var KEY = "esn-lang-filter";
  function _t(k, p) { return global.ESNI18n ? global.ESNI18n.t(k, p) : k; }
  function all() { return global.ESNI18n ? global.ESNI18n.list() : [{ code: "pl", name: "Polski" }]; }
  function codes() { return all().map(function (l) { return l.code; }); }
  function mine() { return (global.ESNI18n && global.ESNI18n.lang()) || "pl"; }
  function defaults() { return { langs: codes(), merge: true, badges: false }; }
  function get() {
    var d = defaults(), s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { s = null; }
    if (!s || typeof s !== "object") return d;
    var known = codes(), langs = (Array.isArray(s.langs) ? s.langs : []).filter(function (c) { return known.indexOf(c) >= 0; });
    return { langs: langs.length ? langs : d.langs, merge: s.merge !== false, badges: !!s.badges };
  }
  function set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* brak storage */ } }
  function query() { var s = get(); return "lang=" + mine() + "&langs=" + s.langs.join(",") + "&merge=" + (s.merge ? 1 : 0); }
  function showBadge(lang) { return !!lang; }   /* etykieta języka zawsze widoczna */

  function mount(el, opts) {
    opts = opts || {};
    el.textContent = "";
    var st = get(), names = {};
    all().forEach(function (l) { names[l.code] = l.name; });
    var box = document.createElement("details"); box.className = "lf";
    var sum = document.createElement("summary"); sum.className = "sort-select lf-sum"; box.appendChild(sum);
    var pnl = document.createElement("div"); pnl.className = "lf-panel"; box.appendChild(pnl);
    function row(label, checked, fn, dis) {
      var l = document.createElement("label"); l.className = "lf-row";
      var c = document.createElement("input"); c.type = "checkbox"; c.checked = checked; c.disabled = !!dis;
      c.addEventListener("change", function () { fn(c.checked); });
      var s = document.createElement("span"); s.textContent = label; l.appendChild(c); l.appendChild(s); pnl.appendChild(l); return c;
    }
    function btn(label, fn) {
      var b = document.createElement("button"); b.type = "button"; b.className = "btn-action lf-btn"; b.textContent = label;
      b.addEventListener("click", fn); return b;
    }
    function commit() { set(st); draw(); if (opts.onChange) opts.onChange(get()); }
    function draw() {
      sum.textContent = _t("lf.jezyki") + ": " + st.langs.map(function (c) { return c.toUpperCase(); }).join(", ");
      pnl.textContent = "";
      var presets = document.createElement("div"); presets.className = "lf-presets";
      presets.appendChild(btn(_t("lf.tylkoMoj"), function () { st.langs = [mine()]; st.merge = false; commit(); }));
      presets.appendChild(btn(_t("lf.wszystkie"), function () { st.langs = codes(); commit(); }));
      pnl.appendChild(presets);
      all().forEach(function (l) {
        row(l.name + " (" + l.code.toUpperCase() + ")", st.langs.indexOf(l.code) >= 0, function (on) {
          var next = st.langs.filter(function (c) { return c !== l.code; });
          if (on) next.push(l.code);
          if (!next.length) { draw(); return; }          /* zawsze co najmniej jeden język */
          st.langs = codes().filter(function (c) { return next.indexOf(c) >= 0; }); commit();
        });
      });
      if (opts.merge) row(_t("lf.laczTlumaczenia"), st.merge, function (on) { st.merge = on; commit(); });
    }
    draw();
    document.addEventListener("click", function (e) { if (box.open && e.composedPath().indexOf(box) < 0 && document.contains(box)) box.open = false; });
    el.appendChild(box);
    return { refresh: draw };
  }
  global.ESNLangFilter = { get: get, set: set, query: query, mount: mount, showBadge: showBadge };
})(window);
