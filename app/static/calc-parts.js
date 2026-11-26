/* ESN – Kalkulatory (v52): łączenie elementów R/C/L szeregowo i równolegle (+ dobór pary do wartości) oraz kod kondensatora.
 * Obliczenia w ESNCalcParts (testy: tests/test_calc.py). */
(function (global) {
  "use strict";
  var C = global.ESNCalc; if (!C) return;
  var M = C.math, fmt = M.fmt, num = M.num, pct = M.pct;
  function _t(k, p) { return global.ESNI18n ? global.ESNI18n.t(k, p) : k; }

  /* ───────── obliczenia ───────── */
  var KIND = { R: { unit: "Ω", prefixes: ["", "k", "M"], def: "k", ser: ["E12", "E24", "E96"] },
               C: { unit: "F", prefixes: ["p", "n", "u"], def: "n", ser: ["E6", "E12", "E24"] },
               L: { unit: "H", prefixes: ["n", "u", "m"], def: "u", ser: ["E6", "E12", "E24"] } };
  /* R i L: szeregowo = suma; C: równolegle = suma. W pozostałych przypadkach suma odwrotności. */
  function isSum(kind, conn) { return (kind === "C") === (conn === "par"); }
  function combine(kind, conn, vals) {
    var v = vals.filter(function (x) { return x > 0 && isFinite(x); });
    if (!v.length) return NaN;
    if (isSum(kind, conn)) return v.reduce(function (a, b) { return a + b; }, 0);
    return 1 / v.reduce(function (a, b) { return a + 1 / b; }, 0);
  }
  /* para wartości z szeregu, która po połączeniu daje target; wynik posortowany wg błędu */
  function pickPair(kind, conn, target, series, count) {
    if (!(target > 0)) return [];
    var sum = isSum(kind, conn), out = {}, list = [];
    var lo = sum ? target * 0.005 : target * 1.0001, hi = sum ? target : target * 300;
    M.seriesRange(series, lo, hi).forEach(function (a) {
      var ideal = sum ? target - a : 1 / (1 / target - 1 / a);
      if (!(ideal > 0) || !isFinite(ideal)) return;
      var b = M.nearest(series, ideal, "near"); if (!b) return;
      var tot = combine(kind, conn, [a, b]), err = (tot - target) / target;
      var x = Math.min(a, b), y = Math.max(a, b), key = x + "|" + y;
      if (!out[key]) { out[key] = 1; list.push({ a: x, b: y, total: tot, err: err }); }
    });
    return list.sort(function (p, q) { return Math.abs(p.err) - Math.abs(q.err) || (q.a / q.b) - (p.a / p.b); }).slice(0, count || 6);
  }
  /* kod kondensatora: „104”, „4n7”, „2u2”, „4R7”, „47”, „0.1”, z literą tolerancji („104K”) → { F, tol } */
  var CTOL = { B: "±0,1 pF", C: "±0,25 pF", D: "±0,5 pF", F: "±1 %", G: "±2 %", J: "±5 %", K: "±10 %", M: "±20 %", Z: "+80 / −20 %" };
  function capDecode(code) {
    var s = String(code || "").trim().replace(/\s+/g, "").replace(",", ".");
    if (!s) return null;
    var tol = null, m = s.match(/^(.*\d)([BCDFGJKMZ])$/i);
    if (m && !/[pnuµ]$/i.test(m[1])) { tol = m[2].toUpperCase(); s = m[1]; }
    var pF;
    if (/^\d{3}$/.test(s)) {
      var e = +s[2], mul = e <= 6 ? Math.pow(10, e) : e === 8 ? 0.01 : e === 9 ? 0.1 : NaN;
      pF = +s.slice(0, 2) * mul;
    } else if (/^\d+[Rr]\d+$/.test(s)) pF = parseFloat(s.replace(/[Rr]/, "."));
    else if (/^\d{1,2}$/.test(s)) pF = +s;
    else if (/^0?\.\d+$/.test(s) || /^\d+\.\d+$/.test(s)) return { F: parseFloat(s) * 1e-6, tol: tol, uf: true };   // dawny zapis: liczba z kropką = µF
    else { var r = M.parse(s.replace(/[fF]$/, "")); if (!r || !r.pref) return null; return { F: r.v, tol: tol }; }
    if (!isFinite(pF) || !(pF > 0)) return null;
    return { F: parseFloat((pF * 1e-12).toPrecision(6)), tol: tol };
  }
  function rkm(F) {                               // 4,7 nF → „4n7”, 100 nF → „100n”, 2,2 µF → „2u2”
    var P = [["p", 1e-12], ["n", 1e-9], ["u", 1e-6], ["m", 1e-3]], p = P[0];
    P.forEach(function (x) { if (F >= x[1] * 0.9995) p = x; });
    var v = parseFloat((F / p[1]).toPrecision(3)), s = String(v);
    return s.indexOf(".") >= 0 ? s.replace(".", p[0]) : s + p[0];
  }
  function capEncode(F) {                         // → { code, exact, value }
    if (!(F > 0) || !isFinite(F)) return null;
    var pF = F * 1e12;
    if (pF < 10) { var v = parseFloat(pF.toPrecision(2)); return { code: String(v).replace(".", "R"), exact: Math.abs(v - pF) / pF < 1e-9, value: v * 1e-12 }; }
    var e = Math.floor(Math.log10(pF)) - 1, mant = Math.round(pF / Math.pow(10, e));
    if (mant >= 100) { mant = Math.round(mant / 10); e += 1; }
    if (e > 6) return null;
    var val = mant * Math.pow(10, e);
    return { code: String(mant) + e, exact: Math.abs(val - pF) / pF < 1e-9, value: parseFloat((val * 1e-12).toPrecision(6)) };
  }
  global.ESNCalcParts = { combine: combine, pickPair: pickPair, capDecode: capDecode, capEncode: capEncode, rkm: rkm, isSum: isSum };

  function h4(api, key) { return api.h("h4", { "class": "calc-h", text: _t(key) }); }

  /* ───────── 5. Łączenie elementów ───────── */
  C.add({ id: "rcombo", icon: "grip-lines", group: "basic", title: "calc.cb.t", desc: "calc.cb.d", mount: function (el, api) {
    var MAXN = 10;
    var mode = api.modes({ key: "mode", items: [["sum", _t("calc.cb.trybLicz")], ["pick", _t("calc.cb.trybDobierz")]] });
    var kind = api.select({ key: "kind", label: _t("calc.cb.element"), def: "R", options: [["R", _t("calc.cb.rez")], ["C", _t("calc.cb.kond")], ["L", _t("calc.cb.cewki")]], onChange: function () { rebuild(); } });
    var conn = api.select({ key: "conn", label: _t("calc.cb.polaczenie"), def: "ser", options: [["ser", _t("calc.cb.szeregowo")], ["par", _t("calc.cb.rownolegle")]] });
    var n = Math.min(MAXN, Math.max(2, +api.kept("n") || 2));
    var vals = api.h("div", { "class": "calc-grid2" }), fields = [], target = null, ser = null;
    var pickBox = api.h("div", { "class": "calc-grid2" });
    var addBtn = api.h("button", { type: "button", "class": "btn-action", icon: "plus", text: " " + _t("calc.cb.dodaj"), onclick: function () { if (n < MAXN) { n++; api.keep("n", n); showN(); api.refresh(); } } });
    var delBtn = api.h("button", { type: "button", "class": "btn-action", icon: "minus", text: " " + _t("calc.cb.usun"), onclick: function () { if (n > 2) { n--; api.keep("n", n); showN(); api.refresh(); } } });
    var btns = api.h("div", { "class": "calc-actions" }, [addBtn, delBtn]);
    var holder = api.h("div", {});
    var sch = api.h("div", { "class": "calc-cb-sch" });
    var res = api.results(), w = api.warn(), table = api.h("div", { "class": "calc-pick" }), copyText = "";
    function defs(k) { return k === "R" ? ["10", "22", "4,7", "1", "1", "1", "1", "1", "1", "1"] : k === "C" ? ["100", "47", "10", "1", "1", "1", "1", "1", "1", "1"] : ["10", "22", "4,7", "1", "1", "1", "1", "1", "1", "1"]; }
    function rebuild() {
      var k = kind.get(), K = KIND[k], d = defs(k);
      vals.textContent = ""; pickBox.textContent = ""; fields = [];
      for (var i = 0; i < MAXN; i++) {
        var f = api.field({ key: k + "v" + (i + 1), label: k + (i + 1), unit: K.unit, prefixes: K.prefixes, defPrefix: K.def, def: d[i] });
        fields.push(f); vals.appendChild(f.el);
      }
      target = api.field({ key: k + "target", label: _t("calc.cb.cel"), unit: K.unit, prefixes: K.prefixes, defPrefix: K.def, def: k === "R" ? "4,4" : k === "C" ? "150" : "30" });
      ser = api.select({ key: k + "ser", label: _t("calc.szereg"), def: K.ser[1], options: K.ser.map(function (s) { return [s, s]; }) });
      pickBox.appendChild(target.el); pickBox.appendChild(ser.el);
      showN(); api.refresh();
    }
    function showN() { fields.forEach(function (f, i) { f.el.hidden = i >= n; }); addBtn.disabled = n >= MAXN; delBtn.disabled = n <= 2; }
    holder.appendChild(vals); holder.appendChild(btns);
    el.appendChild(mode.el);
    el.appendChild(api.card([h4(api, "calc.dane"), api.h("div", { "class": "calc-grid2" }, [kind.el, conn.el]), holder, pickBox, sch]));
    var formulaBox = api.h("div", {});
    el.appendChild(api.card([h4(api, "calc.wynik"), res.el, table, w.el, api.h("div", { "class": "calc-actions" }, [api.copy(function () { return copyText; })]), formulaBox]));
    mode.on(function (m) { holder.hidden = m !== "sum"; pickBox.hidden = m !== "pick"; table.hidden = m !== "pick"; api.refresh(); });
    function drawSch(k, c, count) {             // szkic: elementy w szeregu albo równolegle
      sch.textContent = "";
      var cnt = Math.min(count, 4), W = 300, H = c === "ser" ? 70 : 40 + cnt * 34, kids = [];
      function part(x, y) { return k === "C" ? api.svg("g", {}, [api.svg("line", { x1: x - 3, y1: y - 12, x2: x - 3, y2: y + 12, "class": "calc-s-wire calc-s-plate" }), api.svg("line", { x1: x + 3, y1: y - 12, x2: x + 3, y2: y + 12, "class": "calc-s-wire calc-s-plate" })])
        : k === "L" ? api.svg("path", { d: "M" + (x - 18) + " " + y + " q4.5 -10 9 0 q4.5 -10 9 0 q4.5 -10 9 0 q4.5 -10 9 0", "class": "calc-s-wire calc-s-coil" })
        : api.svg("rect", { x: x - 18, y: y - 7, width: 36, height: 14, rx: 2, "class": "calc-s-part" }); }
      if (c === "ser") {
        var step = (W - 40) / cnt, y = 35;
        kids.push(api.svg("polyline", { points: "10," + y + " " + (W - 10) + "," + y, "class": "calc-s-wire" }));
        for (var i = 0; i < cnt; i++) { var x = 20 + step * (i + 0.5); kids.push(api.svg("rect", { x: x - 22, y: y - 14, width: 44, height: 28, "class": "calc-s-gap" })); kids.push(part(x, y)); }
      } else {
        var x0 = 70, x1 = 230;
        kids.push(api.svg("polyline", { points: "10,20 " + x0 + ",20", "class": "calc-s-wire" }), api.svg("polyline", { points: x1 + ",20 " + (W - 10) + ",20", "class": "calc-s-wire" }));
        kids.push(api.svg("polyline", { points: x0 + ",20 " + x0 + "," + (20 + (cnt - 1) * 34), "class": "calc-s-wire" }), api.svg("polyline", { points: x1 + ",20 " + x1 + "," + (20 + (cnt - 1) * 34), "class": "calc-s-wire" }));
        for (var j = 0; j < cnt; j++) { var yy = 20 + j * 34; kids.push(api.svg("polyline", { points: x0 + "," + yy + " " + x1 + "," + yy, "class": "calc-s-wire" })); kids.push(api.svg("rect", { x: 128, y: yy - 14, width: 44, height: 28, "class": "calc-s-gap" })); kids.push(part(150, yy)); }
      }
      if (count > 4) kids.push(api.svg("text", { x: W / 2, y: H - 4, "text-anchor": "middle", "class": "calc-s-lbl", text: "… ×" + count }));
      sch.appendChild(api.svg("svg", { viewBox: "0 0 " + W + " " + H, "class": "calc-schem", role: "img", "aria-label": _t("calc.cb.t") }, kids));
    }
    function formulas(k, c) {
      formulaBox.textContent = "";
      var sum = isSum(k, c), X = k, lines = sum ? [[X + " = " + X + "1 + " + X + "2 + …", ""]] : [[X + " = 1 / (1/" + X + "1 + 1/" + X + "2 + …)", ""], [X + " = " + X + "1 · " + X + "2 / (" + X + "1 + " + X + "2)", _t("calc.cb.dlaDwoch")]];
      formulaBox.appendChild(api.formula(lines, k === "C" ? _t("calc.cb.noteC") : k === "L" ? _t("calc.cb.noteL") : _t("calc.cb.noteR")));
    }
    api.onChange(function () {
      if (!fields.length) return;
      var k = kind.get(), c = conn.get(), K = KIND[k], ws = [];
      drawSch(k, c, mode.get() === "pick" ? 2 : n); formulas(k, c);
      if (mode.get() === "sum") {
        table.textContent = "";
        var v = fields.slice(0, n).map(function (f) { return f.get(); }), good = v.filter(function (x) { return x > 0; });
        if (good.length < 2) { res.show([]); w.show([["info", _t("calc.cb.wpisz")]]); copyText = ""; return; }
        var tot = combine(k, c, good), near = M.nearest(K.ser[1], tot);
        res.show([[_t("calc.cb.wypadkowa"), fmt(tot, K.unit, 4), _t("calc.cb.zN", { n: good.length }) + " · " + K.ser[1] + ": " + fmt(near, K.unit)]]);
        copyText = (c === "ser" ? _t("calc.cb.szeregowo") : _t("calc.cb.rownolegle")) + ": " + good.map(function (x) { return fmt(x, K.unit); }).join(", ") + " → " + fmt(tot, K.unit, 4);
        if (k === "C" && c === "ser") ws.push(["info", _t("calc.cb.wC")]);
        if (k === "R" && c === "par") ws.push(["info", _t("calc.cb.wRpar")]);
        if (k === "L") ws.push(["info", _t("calc.cb.wL")]);
        w.show(ws); return;
      }
      res.show([]); table.textContent = "";
      var T = target.get();
      if (!(T > 0)) { w.show([["info", _t("calc.cb.wpiszCel")]]); copyText = ""; return; }
      var single = M.nearest(ser.get(), T), list = pickPair(k, c, T, ser.get(), 6);
      if (!list.length) { w.show([["warn", _t("calc.cb.brak")]]); copyText = ""; return; }
      var tb = api.h("table", { "class": "calc-tbl" }), hd = api.h("tr", {});
      [k + "1", k + "2", _t("calc.cb.wypadkowa"), _t("calc.blad")].forEach(function (x) { hd.appendChild(api.h("th", { text: x })); });
      tb.appendChild(api.h("thead", {}, [hd]));
      var bd = api.h("tbody", {});
      list.forEach(function (p, i) { bd.appendChild(api.h("tr", { "class": i === 0 ? "calc-best" : "" }, [api.h("td", { text: fmt(p.a, K.unit) }), api.h("td", { text: fmt(p.b, K.unit) }), api.h("td", { text: fmt(p.total, K.unit, 4) }), api.h("td", { text: pct(p.err) })])); });
      tb.appendChild(bd); table.appendChild(api.h("div", { "class": "calc-tbl-wrap" }, [tb]));
      var b = list[0];
      copyText = k + "1 = " + fmt(b.a, K.unit) + ", " + k + "2 = " + fmt(b.b, K.unit) + " (" + (c === "ser" ? _t("calc.cb.szeregowo") : _t("calc.cb.rownolegle")) + ") → " + fmt(b.total, K.unit, 4) + " (" + pct(b.err) + ")";
      ws.push([Math.abs(b.err) <= 0.01 ? "ok" : "warn", _t("calc.cb.najlepsza", { a: fmt(b.a, K.unit), b: fmt(b.b, K.unit), e: pct(b.err) })]);
      ws.push(["info", _t("calc.cb.pojedyncza", { s: ser.get(), v: fmt(single, K.unit), e: pct((single - T) / T) })]);
      w.show(ws);
    });
    rebuild();
  } });

  /* ───────── 6. Kod kondensatora ───────── */
  C.add({ id: "capcode", icon: "barcode", group: "basic", title: "calc.cc.t", desc: "calc.cc.d", mount: function (el, api) {
    var mode = api.modes({ key: "mode", items: [["read", _t("calc.cc.trybOdczyt")], ["write", _t("calc.cc.trybZapis")]] });
    var saved = api.kept("code");
    var code = api.h("input", { "class": "text-input calc-in", type: "text", autocomplete: "off", spellcheck: "false", id: "calc-capcode-code", value: saved != null ? saved : "104K", "aria-label": _t("calc.cc.kod") });
    code.addEventListener("input", function () { api.keep("code", code.value); api.refresh(); });
    var codeBox = api.h("div", { "class": "calc-field" }, [api.h("label", { "class": "calc-lbl", "for": code.id, text: _t("calc.cc.kod") }), code, api.h("small", { "class": "calc-hint", text: _t("calc.cc.kodHint") })]);
    var val = api.field({ key: "val", label: _t("calc.cc.pojemnosc"), unit: "F", prefixes: ["p", "n", "u"], defPrefix: "n", def: "4,7" });
    var readBox = api.h("div", { "class": "calc-grid2" }, [codeBox]), writeBox = api.h("div", { "class": "calc-grid2" }, [val.el]);
    var res = api.results(), w = api.warn(), copyText = "";
    el.appendChild(mode.el);
    el.appendChild(api.card([h4(api, "calc.dane"), readBox, writeBox]));
    el.appendChild(api.card([h4(api, "calc.wynik"), res.el, w.el, api.h("div", { "class": "calc-actions" }, [api.copy(function () { return copyText; })]),
      api.formula([["104 = 10 × 10⁴ pF = 100 nF", _t("calc.cc.f3")], ["4n7 = 4,7 nF · 2u2 = 2,2 µF · 4R7 = 4,7 pF", _t("calc.cc.fRkm")]], _t("calc.cc.note"))]));
    mode.on(function (m) { readBox.hidden = m !== "read"; writeBox.hidden = m !== "write"; api.refresh(); });
    function rows(F) { return [["pF", num(F * 1e12, 4) + " pF"], ["nF", num(F * 1e9, 4) + " nF"], ["µF", num(F * 1e6, 4) + " µF"]]; }
    api.onChange(function () {
      var ws = [];
      if (mode.get() === "read") {
        var d = capDecode(code.value);
        if (!d) { res.show([]); w.show([["info", _t("calc.cc.wpisz")]]); copyText = ""; return; }
        var r = [[_t("calc.cc.pojemnosc"), fmt(d.F, "F", 4)]].concat(rows(d.F));
        if (d.tol) r.push([_t("calc.rc.tolerancja"), CTOL[d.tol] + " (" + d.tol + ")"]);
        res.show(r);
        if (d.uf) ws.push(["info", _t("calc.cc.uf")]);
        if (!d.tol) ws.push(["info", _t("calc.cc.tolInfo")]);
        copyText = code.value.trim() + " = " + fmt(d.F, "F", 4) + (d.tol ? " " + CTOL[d.tol] : "");
      } else {
        var F = val.get(), e = capEncode(F);
        if (!e) { res.show([]); w.show([["info", _t("calc.cc.wpiszF")]]); copyText = ""; return; }
        res.show([[_t("calc.cc.kod3"), e.code], [_t("calc.cc.kodRkm"), rkm(e.value)], [_t("calc.cc.pojemnosc"), fmt(e.value, "F", 4)]]);
        if (!e.exact) ws.push(["warn", _t("calc.cc.zaokraglono", { v: fmt(e.value, "F", 4) })]);
        copyText = fmt(F, "F", 4) + " = " + e.code + " (" + rkm(e.value) + ")";
      }
      w.show(ws);
    });
  } });
})(window);
