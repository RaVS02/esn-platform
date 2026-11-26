/* ESN – Kalkulatory (v51): rdzeń + rejestracja w Narzędziach (#tools/calc, #tools/calc/<id>).
 *   ESNCalc.add({ id, icon, title, desc, group, mount(el, api) })   – kalkulator (pliki calc-*.js)
 *   ESNCalc.math – czyste funkcje (parse, fmt, eseries, nearest…), testowane w tests/test_calc.py (Node).
 * api (przekazywane do mount): h, field(), select(), results(), warn(), formula(), copy(), schematic().
 * Teksty wyłącznie przez _t('calc.*'); kolory przez zmienne CSS; wartości pól zapamiętane w localStorage („esn-calc”). */
(function (global) {
  "use strict";
  function _t(k, p) { return global.ESNI18n ? global.ESNI18n.t(k, p) : k; }
  function lang() { return global.ESNI18n && global.ESNI18n.lang ? global.ESNI18n.lang() : "pl"; }

  /* ───────────── matematyka (bez DOM) ───────────── */
  var PREF = { p: 1e-12, n: 1e-9, u: 1e-6, "µ": 1e-6, m: 1e-3, "": 1, k: 1e3, K: 1e3, M: 1e6, G: 1e9 };
  var PREF_SHOW = [["p", 1e-12], ["n", 1e-9], ["µ", 1e-6], ["m", 1e-3], ["", 1], ["k", 1e3], ["M", 1e6], ["G", 1e9]];
  var UNIT_TAIL = /\s*(ohm|Ω|v|a|w|hz|f|s)$/i;

  /* „4k7”, „2R2”, „4u7”, „1,5”, „100n”, „10 k”, „3.3V” → { v, pref } (pref = czy w tekście był przedrostek); błąd → null */
  function parse(str) {
    var s = String(str == null ? "" : str).trim().replace(/\s+/g, "").replace(",", ".");
    if (!s) return null;
    var tail = s.match(/^(.*?\d)(ohm|Ω)$/i); if (tail) s = tail[1];
    var rkm = s.match(/^(\d+)([pnuµmkKMGRr])(\d+)$/);
    if (rkm) { var mul = /[Rr]/.test(rkm[2]) ? 1 : PREF[rkm[2]]; return { v: parseFloat(rkm[1] + "." + rkm[3]) * mul, pref: !/[Rr]/.test(rkm[2]) }; }
    s = s.replace(UNIT_TAIL, "");
    var m = s.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([pnuµmkKMG]?)$/i);
    if (!m) return null;
    var p = m[2]; if (/^[PNU]$/.test(p)) p = p.toLowerCase();   // 100N, 4U7 → n, u
    if (p && !(p in PREF)) return null;
    var v = parseFloat(m[1]) * (p ? PREF[p] : 1);
    return isFinite(v) ? { v: v, pref: !!p } : null;
  }

  function num(v, digits) {
    if (!isFinite(v)) return "—";
    var d = digits || 4, a = Math.abs(v);
    var s = a === 0 ? "0" : String(parseFloat(v.toPrecision(d)));
    if (/e/.test(s)) s = v.toExponential(d - 1);
    return lang() === "en" ? s : s.replace(".", ",");
  }
  /* 4700 → „4,7 k” + unit; 0.02 → „20 m” */
  function fmt(v, unit, digits) {
    if (v == null || !isFinite(v)) return "—";
    var a = Math.abs(v), best = PREF_SHOW[4];
    if (a !== 0) for (var i = 0; i < PREF_SHOW.length; i++) { if (a >= PREF_SHOW[i][1] * 0.9995) best = PREF_SHOW[i]; }
    return num(v / best[1], digits) + " " + best[0] + (unit || "");
  }
  function pct(v, digits) { return (v > 0 ? "+" : "") + num(v * 100, digits || 2) + " %"; }

  var ESER = {
    E6: [10, 15, 22, 33, 47, 68],
    E12: [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82],
    E24: [10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91],
    E48: [100, 105, 110, 115, 121, 127, 133, 140, 147, 154, 162, 169, 178, 187, 196, 205, 215, 226, 237, 249, 261, 274, 287, 301, 316, 332, 348, 365, 383, 402, 422, 442, 464, 487, 511, 536, 562, 590, 619, 649, 681, 715, 750, 787, 825, 866, 909, 953],
    E96: [100, 102, 105, 107, 110, 113, 115, 118, 121, 124, 127, 130, 133, 137, 140, 143, 147, 150, 154, 158, 162, 165, 169, 174, 178, 182, 187, 191, 196, 200, 205, 210, 215, 221, 226, 232, 237, 243, 249, 255, 261, 267, 274, 280, 287, 294, 301, 309, 316, 324, 332, 340, 348, 357, 365, 374, 383, 392, 402, 412, 422, 432, 442, 453, 464, 475, 487, 499, 511, 523, 536, 549, 562, 576, 590, 604, 619, 634, 649, 665, 681, 698, 715, 732, 750, 768, 787, 806, 825, 845, 866, 887, 909, 931, 953, 976]
  };
  function clean(x) { return parseFloat(x.toPrecision(6)); }
  /* wszystkie wartości szeregu w przedziale [lo, hi] */
  function seriesRange(name, lo, hi) {
    var base = ESER[name], div = base[0], out = [];
    for (var d = Math.floor(Math.log10(lo)) - 1; d <= Math.ceil(Math.log10(hi)); d++)
      base.forEach(function (b) { var v = clean(b / div * Math.pow(10, d)); if (v >= lo * 0.9999 && v <= hi * 1.0001) out.push(v); });
    return out;
  }
  /* najbliższa wartość szeregu; mode: "near" | "up" (≥ v) | "down" (≤ v) */
  function nearest(name, v, mode) {
    if (!(v > 0) || !isFinite(v)) return null;
    var c = seriesRange(name, v / 20, v * 20), best = null;
    c.forEach(function (x) {
      if (mode === "up" && x < v * 0.9999) return;
      if (mode === "down" && x > v * 1.0001) return;
      if (best === null || Math.abs(Math.log(x / v)) < Math.abs(Math.log(best / v))) best = x;
    });
    return best;
  }
  /* typowe moce rezystorów; zalecana: co najmniej 2× zapas */
  var PWR = [0.0625, 0.1, 0.125, 0.25, 0.5, 1, 2, 3, 5, 10];
  function powerRating(p) { for (var i = 0; i < PWR.length; i++) if (PWR[i] >= 2 * p) return PWR[i]; return null; }
  function powerName(w) { var n = { 0.0625: "1/16 W", 0.125: "1/8 W", 0.25: "1/4 W", 0.5: "1/2 W" }[w]; return n || fmt(w, "W"); }
  function par(a, b) { return a * b / (a + b); }

  var math = { parse: parse, fmt: fmt, num: num, pct: pct, ESER: ESER, seriesRange: seriesRange, nearest: nearest, powerRating: powerRating, powerName: powerName, par: par };

  /* ───────────── DOM ───────────── */
  function h(tag, props, kids) {
    var e = document.createElement(tag);
    for (var k in (props || {})) {
      if (k === "icon" || k === "iconEnd") continue;
      else if (k === "class") e.className = props[k];
      else if (k === "text") e.textContent = props[k];
      else if (k === "value") e.value = props[k];
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), props[k]);
      else if (props[k] !== false && props[k] != null) e.setAttribute(k, props[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    if (props && props.icon) e.insertBefore(fa(props.icon), e.firstChild);
    if (props && props.iconEnd) e.appendChild(fa(props.iconEnd));
    return e;
  }
  function fa(n) { var i = document.createElement("i"); i.className = "fa-solid fa-" + n; i.setAttribute("aria-hidden", "true"); return i; }
  var SVGNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, kids) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in (attrs || {})) { if (k === "text") e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }

  var STORE = "esn-calc";
  function loadAll() { try { return JSON.parse(localStorage.getItem(STORE) || "{}") || {}; } catch (e) { return {}; } }
  function saveOne(id, data) { try { var a = loadAll(); a[id] = data; localStorage.setItem(STORE, JSON.stringify(a)); } catch (e) { /* bez zapisu */ } }

  var CALCS = [];
  /* zapowiedzi (paczki 2–3) – tytuły i opisy jako klucze tłumaczeń */
  var PLANNED = [
    { id: "baud", icon: "gauge-high", title: "calc.p.baud", group: "comm" },
    { id: "timer", icon: "stopwatch", title: "calc.p.timer", group: "comm" },
    { id: "rc", icon: "wave-square", title: "calc.p.rc", group: "comm" },
    { id: "battery", icon: "battery-half", title: "calc.p.battery", group: "power" },
    { id: "ldo", icon: "temperature-half", title: "calc.p.ldo", group: "power" },
    { id: "trace", icon: "route", title: "calc.p.trace", group: "power" },
    { id: "rcombo", icon: "grip-lines", title: "calc.p.rcombo", group: "basic" },
    { id: "capcode", icon: "barcode", title: "calc.p.capcode", group: "basic" }
  ];
  var GROUPS = ["basic", "comm", "power"];
  function groupName(g) { return g === "comm" ? _t("calc.g.comm") : g === "power" ? _t("calc.g.power") : _t("calc.g.basic"); }

  function add(c) { CALCS = CALCS.filter(function (x) { return x.id !== c.id; }); CALCS.push(c); PLANNED = PLANNED.filter(function (x) { return x.id !== c.id; }); }

  /* api jednego kalkulatora */
  function makeApi(c, el, ctx) {
    var saved = loadAll()[c.id] || {}, fields = {}, onChange = [];
    var state = {};
    function persist() { var d = {}; Object.keys(fields).forEach(function (k) { d[k] = fields[k].raw(); }); Object.keys(state).forEach(function (k) { d["_" + k] = state[k]; }); saveOne(c.id, d); }
    function changed() { onChange.forEach(function (f) { try { f(); } catch (e) { if (global.console) console.error(e); } }); persist(); }

    /* pole liczbowe z przedrostkiem: { key, label, unit, prefixes:["","k","M"], def:"10", defPrefix:"k", hint, min } */
    function field(o) {
      var prefs = o.prefixes || [""];
      var sv = saved[o.key];
      var inp = h("input", { "class": "text-input calc-in", type: "text", inputmode: "decimal", autocomplete: "off", spellcheck: "false", id: "calc-" + c.id + "-" + o.key, value: sv ? sv[0] : (o.def == null ? "" : o.def), "aria-label": o.label });
      var sel = prefs.length > 1 ? h("select", { "class": "text-input calc-pref", "aria-label": o.label + " – " + _t("calc.jednostka") },
        prefs.map(function (p) { return h("option", { value: p, text: (p === "u" ? "µ" : p) + o.unit }); })) : null;
      if (sel) sel.value = sv && prefs.indexOf(sv[1]) >= 0 ? sv[1] : (o.defPrefix != null ? o.defPrefix : prefs[0]);
      var unitLbl = sel ? sel : h("span", { "class": "calc-unit", text: (prefs[0] === "u" ? "µ" : prefs[0]) + o.unit });
      function mul() { return PREF[sel ? sel.value : prefs[0]]; }
      var box = h("div", { "class": "calc-field" }, [
        h("label", { "class": "calc-lbl", "for": inp.id, text: o.label }),
        h("div", { "class": "calc-inrow" }, [inp, unitLbl]),
        o.hint ? h("small", { "class": "calc-hint", text: o.hint }) : null]);
      var f = {
        el: box, input: inp, key: o.key,
        get: function () {
          var r = parse(inp.value); if (!r) return NaN;
          return r.pref ? r.v : r.v * mul();
        },
        raw: function () { return [inp.value, sel ? sel.value : prefs[0]]; },
        empty: function () { return !inp.value.trim(); },
        set: function (v) {                         // wpis wartości obliczonej (najlepszy dostępny przedrostek)
          if (!isFinite(v)) { inp.value = ""; return; }
          var p = prefs[0];
          if (sel) { prefs.forEach(function (x) { if (Math.abs(v) >= PREF[x] * 0.9995) p = x; }); sel.value = p; }
          inp.value = num(v / PREF[p], 4);
        },
        bad: function (b) { inp.classList.toggle("bad", !!b); },
        computed: function (b) { box.classList.toggle("calc-computed", !!b); }
      };
      inp.addEventListener("input", function () { f.bad(inp.value.trim() && !parse(inp.value)); if (o.onInput) o.onInput(f); changed(); });
      if (sel) sel.addEventListener("change", function () { if (o.onInput) o.onInput(f); changed(); });
      fields[o.key] = f;
      return f;
    }
    /* lista wyboru: { key, label, options:[[value, text]], def } */
    function select(o) {
      var sv = saved["_" + o.key];
      var s = h("select", { "class": "text-input", id: "calc-" + c.id + "-" + o.key, "aria-label": o.label }, o.options.map(function (x) { return h("option", { value: x[0], text: x[1] }); }));
      s.value = sv != null && o.options.some(function (x) { return String(x[0]) === String(sv); }) ? sv : String(o.def != null ? o.def : o.options[0][0]);
      state[o.key] = s.value;
      s.addEventListener("change", function () { state[o.key] = s.value; if (o.onChange) o.onChange(s.value); changed(); });
      var box = h("div", { "class": "calc-field" }, [h("label", { "class": "calc-lbl", "for": s.id, text: o.label }), s, o.hint ? h("small", { "class": "calc-hint", text: o.hint }) : null]);
      return { el: box, sel: s, get: function () { return s.value; }, set: function (v) { s.value = v; state[o.key] = v; } };
    }
    /* zakładki trybu: { key, items:[[id, label]] } → { el, get(), on(fn) } */
    function modes(o) {
      var sv = saved["_" + o.key], cur = o.items.some(function (x) { return x[0] === sv; }) ? sv : o.items[0][0], fns = [];
      state[o.key] = cur;
      var bar = h("div", { "class": "esn-tabs calc-modes", role: "tablist" }), btns = {};
      o.items.forEach(function (x) {
        btns[x[0]] = h("button", { type: "button", role: "tab", "aria-selected": String(x[0] === cur), text: x[1], onclick: function () {
          cur = x[0]; state[o.key] = cur; Object.keys(btns).forEach(function (k) { btns[k].setAttribute("aria-selected", String(k === cur)); });
          fns.forEach(function (f) { f(cur); }); changed(); } });
        bar.appendChild(btns[x[0]]);
      });
      return { el: bar, get: function () { return cur; }, on: function (f) { fns.push(f); f(cur); } };
    }
    /* panel wyników: rows [[label, value, extra?, cls?]] */
    function results() {
      var box = h("div", { "class": "calc-res", "aria-live": "polite" });
      return {
        el: box,
        show: function (rows) {
          box.textContent = "";
          rows.filter(Boolean).forEach(function (r) {
            if (r.node) { box.appendChild(r.node); return; }
            box.appendChild(h("div", { "class": "calc-row" + (r[3] ? " " + r[3] : "") }, [h("span", { "class": "calc-rl", text: r[0] }), h("strong", { "class": "calc-rv", text: r[1] }), r[2] ? h("small", { "class": "calc-rx", text: r[2] }) : null]));
          });
        }
      };
    }
    /* ostrzeżenia: [[poziom "warn"|"bad"|"ok"|"info", tekst]] */
    function warn() {
      var box = h("div", { "class": "calc-warns" });
      return {
        el: box,
        show: function (list) {
          box.textContent = "";
          (list || []).filter(Boolean).forEach(function (w) {
            var ic = { bad: "circle-xmark", warn: "triangle-exclamation", ok: "circle-check", info: "circle-info" }[w[0]] || "circle-info";
            box.appendChild(h("div", { "class": "calc-w calc-w-" + w[0] }, [fa(ic), h("span", { text: w[1] })]));
          });
        }
      };
    }
    /* „Wzór i wyjaśnienie”: lines = [[wzór, opis]], note = tekst */
    function formula(lines, note) {
      var d = h("details", { "class": "calc-formula" }, [h("summary", { icon: "square-root-variable", text: " " + _t("calc.wzor") })]);
      var ul = h("div", { "class": "calc-f-list" });
      lines.forEach(function (l) { ul.appendChild(h("div", { "class": "calc-f" }, [h("code", { text: l[0] }), l[1] ? h("span", { text: l[1] }) : null])); });
      d.appendChild(ul);
      if (note) d.appendChild(h("p", { "class": "calc-f-note", text: note }));
      return d;
    }
    /* „Kopiuj wynik” – fn() zwraca tekst */
    function copy(fn) {
      return h("button", { type: "button", "class": "btn-action calc-copy", icon: "copy", text: " " + _t("calc.kopiuj"), onclick: function () {
        var t = fn(); if (!t) return;
        var done = function () { ctx.toast(_t("calc.skopiowano"), "success"); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { ctx.toast(t, "info"); });
        else ctx.toast(t, "info");
      } });
    }
    return {
      h: h, svg: svg, fa: fa, math: math, t: _t, lang: lang,
      field: field, select: select, modes: modes, results: results, warn: warn, formula: formula, copy: copy,
      onChange: function (f) { onChange.push(f); }, refresh: changed,
      keep: function (k, v) { state[k] = v; }, kept: function (k) { return saved["_" + k]; },
      card: function (kids) { return h("div", { "class": "calc-card" }, kids); }
    };
  }

  function navChips(cur, ctx) {
    var bar = h("div", { "class": "calc-nav", role: "navigation", "aria-label": _t("calc.lista") });
    CALCS.forEach(function (c) {
      bar.appendChild(h("button", { type: "button", "class": "chip-btn" + (c.id === cur ? " active" : ""), "aria-current": c.id === cur ? "page" : null, icon: c.icon, text: " " + _t(c.title), onclick: function () { ctx.go("calc/" + c.id); } }));
    });
    return bar;
  }

  function home(el, ctx) {
    el.appendChild(h("p", { "class": "hero-sub calc-lead", text: _t("calc.lead") }));
    GROUPS.forEach(function (g) {
      var ready = CALCS.filter(function (c) { return (c.group || "basic") === g; });
      var soon = PLANNED.filter(function (c) { return c.group === g; });
      if (!ready.length && !soon.length) return;
      el.appendChild(h("h3", { "class": "section-title calc-gh", text: groupName(g) }));
      var grid = h("div", { "class": "calc-grid" });
      ready.forEach(function (c) {
        grid.appendChild(h("button", { type: "button", "class": "calc-tile", onclick: function () { ctx.go("calc/" + c.id); } }, [
          h("span", { "class": "calc-tile-ic", "aria-hidden": "true" }, [fa(c.icon)]),
          h("span", { "class": "calc-tile-tx" }, [h("strong", { text: _t(c.title) }), h("small", { text: _t(c.desc) })])]));
      });
      soon.forEach(function (c) {
        grid.appendChild(h("div", { "class": "calc-tile calc-tile-soon", "aria-disabled": "true" }, [
          h("span", { "class": "calc-tile-ic", "aria-hidden": "true" }, [fa(c.icon)]),
          h("span", { "class": "calc-tile-tx" }, [h("strong", { text: _t(c.title) }), h("small", { text: _t("tools.wkrotce") })])]));
      });
      el.appendChild(grid);
    });
  }

  function mount(el, ctx) {
    var id = ctx.sub && ctx.sub[0], c = CALCS.filter(function (x) { return x.id === id; })[0];
    el.classList.add("calc-root");
    if (!c) { home(el, ctx); return null; }
    el.appendChild(navChips(c.id, ctx));
    el.appendChild(h("h3", { "class": "calc-title", icon: c.icon, text: " " + _t(c.title) }));
    el.appendChild(h("p", { "class": "calc-desc", text: _t(c.desc) }));
    var body = h("div", { "class": "calc-body" });
    el.appendChild(body);
    document.title = _t(c.title) + " – " + _t("tools.kalkulatory") + " – ESN";
    var api = makeApi(c, body, ctx);
    var stop = c.mount(body, api);
    api.refresh();
    return typeof stop === "function" ? stop : null;
  }

  global.ESNCalc = { add: add, math: math, list: function () { return CALCS.slice(); } };
  if (global.ESNTools) global.ESNTools.register({ id: "calc", icon: "fa-solid fa-calculator", title: "tools.kalkulatory", desc: "tools.dzielnikNapieciaPrawoOhma", status: "ready", mount: mount });
})(window);
