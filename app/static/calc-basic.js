/* ESN – Kalkulatory, paczka 1 (v51): prawo Ohma i moc, dzielnik napięcia (z doborem pary z szeregu E), rezystor do LED, kod paskowy rezystora.
 * Rdzeń i api: calc.js. Obliczenia dobierania dzielnika i kodu paskowego są w ESNCalcBasic (testy: tests/test_calc.py). */
(function (global) {
  "use strict";
  var C = global.ESNCalc; if (!C) return;
  var M = C.math, fmt = M.fmt, num = M.num, pct = M.pct;
  function _t(k, p) { return global.ESNI18n ? global.ESNI18n.t(k, p) : k; }
  function ok(v) { return typeof v === "number" && isFinite(v); }

  /* ───────── obliczenia (bez DOM) ───────── */
  /* prawo Ohma: dowolne dwie z U, I, R, P → komplet */
  function ohm(k) {
    var U = k.U, I = k.I, R = k.R, P = k.P;
    if (ok(U) && ok(I)) { R = U / I; P = U * I; }
    else if (ok(U) && ok(R)) { I = U / R; P = U * U / R; }
    else if (ok(U) && ok(P)) { I = P / U; R = U * U / P; }
    else if (ok(I) && ok(R)) { U = I * R; P = I * I * R; }
    else if (ok(I) && ok(P)) { U = P / I; R = P / (I * I); }
    else if (ok(R) && ok(P)) { U = Math.sqrt(P * R); I = Math.sqrt(P / R); }
    else return null;
    return { U: U, I: I, R: R, P: P };
  }
  /* dobór R1 (góra) i R2 (dół) z szeregu, suma w [lo, hi]; wynik posortowany wg błędu */
  function pickDivider(uin, uout, series, lo, hi, count) {
    if (!(uin > 0) || !(uout > 0) || uout >= uin) return [];
    var k = uin / uout - 1, out = {}, mid = Math.sqrt(lo * hi);
    M.seriesRange(series, lo / 1000, hi).forEach(function (r2) {
      var r1 = M.nearest(series, r2 * k, "near"); if (!r1) return;
      var tot = r1 + r2; if (tot < lo || tot > hi) return;
      var u = uin * r2 / tot, err = (u - uout) / uout;
      var key = (r1 / r2).toPrecision(6), c = { r1: r1, r2: r2, u: u, err: err, i: uin / tot, tot: tot };
      var prev = out[key];
      if (!prev || Math.abs(Math.log(tot / mid)) < Math.abs(Math.log(prev.tot / mid))) out[key] = c;   // ten sam stosunek – bliżej środka zakresu
    });
    return Object.keys(out).map(function (x) { return out[x]; })
      .sort(function (a, b) { return Math.abs(a.err) - Math.abs(b.err) || Math.abs(Math.log(a.tot / mid)) - Math.abs(Math.log(b.tot / mid)); })
      .slice(0, count || 6);
  }
  /* kod paskowy */
  var COLORS = ["black", "brown", "red", "orange", "yellow", "green", "blue", "violet", "grey", "white", "gold", "silver"];
  var HEX = { black: "#1b1b1b", brown: "#7b4a1e", red: "#d32f2f", orange: "#f57c00", yellow: "#fbc02d", green: "#2e7d32", blue: "#1565c0", violet: "#7b1fa2", grey: "#9e9e9e", white: "#f5f5f5", gold: "#c9a227", silver: "#b8b8b8" };
  var MULT = { black: 0, brown: 1, red: 2, orange: 3, yellow: 4, green: 5, blue: 6, violet: 7, grey: 8, white: 9, gold: -1, silver: -2 };
  var TOL = { brown: 1, red: 2, green: 0.5, blue: 0.25, violet: 0.1, grey: 0.05, gold: 5, silver: 10 };
  var TC = { black: 250, brown: 100, red: 50, orange: 15, yellow: 25, green: 20, blue: 10, violet: 5, grey: 1 };
  function decode(bands) {                       // { digits:[c,c(,c)], mult:c, tol:c, tc?:c } → Ω
    var d = bands.digits.map(function (c) { return COLORS.indexOf(c); });
    if (d.some(function (x) { return x < 0 || x > 9; }) || !(bands.mult in MULT)) return null;
    return parseFloat((parseInt(d.join(""), 10) * Math.pow(10, MULT[bands.mult])).toPrecision(6));
  }
  function encode(ohms, nDigits) {               // Ω → { digits, mult, value (zaokrąglona), exact }
    if (!(ohms > 0) || !isFinite(ohms)) return null;
    var e = Math.floor(Math.log10(ohms)) - (nDigits - 1);
    var mant = Math.round(ohms / Math.pow(10, e));
    if (mant >= Math.pow(10, nDigits)) { mant = Math.round(mant / 10); e += 1; }
    if (e < -2 || e > 9) return null;
    var digits = String(mant).split("").map(function (x) { return COLORS[+x]; });
    var mult = e === -1 ? "gold" : e === -2 ? "silver" : COLORS[e];
    var value = parseFloat((mant * Math.pow(10, e)).toPrecision(6));
    return { digits: digits, mult: mult, value: value, exact: Math.abs(value - ohms) / ohms < 1e-9 };
  }
  global.ESNCalcBasic = { ohm: ohm, pickDivider: pickDivider, decode: decode, encode: encode, COLORS: COLORS, TOL: TOL, TC: TC };

  /* ───────── wspólne: małe schematy SVG (kolory z CSS: currentColor / klasy) ───────── */
  function resSym(api, x, y, w, vert, label) {
    var g = api.svg("g", {});
    g.appendChild(vert ? api.svg("rect", { x: x - 7, y: y, width: 14, height: w, rx: 2, "class": "calc-s-part" }) : api.svg("rect", { x: x, y: y - 7, width: w, height: 14, rx: 2, "class": "calc-s-part" }));
    if (label) g.appendChild(api.svg("text", { x: vert ? x + 14 : x + w / 2, y: vert ? y + w / 2 + 4 : y - 12, "text-anchor": vert ? "start" : "middle", "class": "calc-s-lbl", text: label }));
    return g;
  }
  function line(api, pts) { return api.svg("polyline", { points: pts.map(function (p) { return p.join(","); }).join(" "), "class": "calc-s-wire" }); }
  function dot(api, x, y) { return api.svg("circle", { cx: x, cy: y, r: 3, "class": "calc-s-dot" }); }
  function txt(api, x, y, t, anchor, cls) { return api.svg("text", { x: x, y: y, "text-anchor": anchor || "start", "class": cls || "calc-s-lbl", text: t }); }
  function gnd(api, x, y) { var g = api.svg("g", {}); [[14, 0], [9, 5], [4, 10]].forEach(function (d) { g.appendChild(line(api, [[x - d[0], y + d[1]], [x + d[0], y + d[1]]])); }); return g; }
  function svgBox(api, w, hgt, kids, label) {
    return api.svg("svg", { viewBox: "0 0 " + w + " " + hgt, "class": "calc-schem", role: "img", "aria-label": label }, kids);
  }

  /* ───────── 1. Prawo Ohma i moc ───────── */
  C.add({ id: "ohm", icon: "bolt", group: "basic", title: "calc.ohm.t", desc: "calc.ohm.d", mount: function (el, api) {
    var KEYS = ["U", "I", "R", "P"], f = {}, order = (api.kept("order") || []).filter(function (k) { return KEYS.indexOf(k) >= 0; });
    function touch(fl) { order = order.filter(function (k) { return k !== fl.key; }); if (!fl.empty()) order.push(fl.key); api.keep("order", order); }
    f.U = api.field({ key: "U", label: _t("calc.napiecie") + " U", unit: "V", prefixes: ["m", ""], defPrefix: "", def: "5", onInput: touch });
    f.I = api.field({ key: "I", label: _t("calc.prad") + " I", unit: "A", prefixes: ["u", "m", ""], defPrefix: "m", def: "20", onInput: touch });
    f.R = api.field({ key: "R", label: _t("calc.rezystancja") + " R", unit: "Ω", prefixes: ["", "k", "M"], defPrefix: "", def: "", onInput: touch });
    f.P = api.field({ key: "P", label: _t("calc.moc") + " P", unit: "W", prefixes: ["m", ""], defPrefix: "m", def: "", onInput: touch });
    if (!order.length) order = KEYS.filter(function (k) { return !f[k].empty(); }).slice(0, 2);
    var res = api.results(), w = api.warn();
    var sch = svgBox(api, 260, 120, [line(api, [[30, 30], [30, 95], [230, 95], [230, 30], [170, 30]]), line(api, [[30, 30], [90, 30]]),
      resSym(api, 90, 30, 80, false, "R"), api.svg("circle", { cx: 30, cy: 62, r: 14, "class": "calc-s-part" }), txt(api, 30, 67, "U", "middle"),
      txt(api, 130, 58, "I →", "middle", "calc-s-acc"), txt(api, 200, 82, "P = U · I", "middle", "calc-s-acc")], _t("calc.ohm.t"));
    el.appendChild(api.card([h2(api, "calc.dane"), api.h("p", { "class": "calc-tip", text: _t("calc.ohm.tip") }),
      api.h("div", { "class": "calc-grid2" }, KEYS.map(function (k) { return f[k].el; })), sch]));
    el.appendChild(api.card([h2(api, "calc.wynik"), res.el, w.el, api.h("div", { "class": "calc-actions" }, [api.copy(function () {
      var r = last; return r ? "U = " + fmt(r.U, "V") + ", I = " + fmt(r.I, "A") + ", R = " + fmt(r.R, "Ω") + ", P = " + fmt(r.P, "W") : ""; })]),
      api.formula([["R = U / I", ""], ["P = U · I = I² · R = U² / R", ""]], _t("calc.ohm.note"))]));
    var last = null;
    api.onChange(function () {
      var known = order.filter(function (k) { return !f[k].empty() && ok(f[k].get()) && f[k].get() > 0; }).slice(-2), inp = {};
      known.forEach(function (k) { inp[k] = f[k].get(); });
      KEYS.forEach(function (k) { f[k].computed(known.indexOf(k) < 0); });
      var r = known.length === 2 ? ohm(inp) : null; last = r;
      if (!r) { res.show([]); w.show([["info", _t("calc.ohm.wpiszDwie")]]); return; }
      KEYS.forEach(function (k) { if (known.indexOf(k) < 0) f[k].set(r[k]); });
      var e24 = M.nearest("E24", r.R), e12 = M.nearest("E12", r.R), pr = M.powerRating(r.P);
      res.show([[ "U", fmt(r.U, "V") ], [ "I", fmt(r.I, "A") ], [ "R", fmt(r.R, "Ω"), "E12: " + fmt(e12, "Ω") + " · E24: " + fmt(e24, "Ω") ], [ "P", fmt(r.P, "W"), pr ? _t("calc.zalecanaMoc", { p: M.powerName(pr) }) : "" ]]);
      var ws = [];
      if (r.P > 0.25) ws.push(["warn", _t("calc.ohm.mocDuza", { p: fmt(r.P, "W") })]);
      if (!pr) ws.push(["bad", _t("calc.ohm.mocBardzoDuza")]);
      w.show(ws);
    });
  } });

  function h2(api, key) { return api.h("h4", { "class": "calc-h", text: _t(key) }); }

  /* ───────── 2. Dzielnik napięcia ───────── */
  C.add({ id: "divider", icon: "code-branch", group: "basic", title: "calc.div.t", desc: "calc.div.d", mount: function (el, api) {
    var mode = api.modes({ key: "mode", items: [["pick", _t("calc.div.trybDobierz")], ["calc", _t("calc.div.trybOblicz")]] });
    var uin = api.field({ key: "uin", label: _t("calc.div.uin"), unit: "V", prefixes: ["m", ""], defPrefix: "", def: "5" });
    var uout = api.field({ key: "uout", label: _t("calc.div.uoutCel"), unit: "V", prefixes: ["m", ""], defPrefix: "", def: "3,3" });
    var ser = api.select({ key: "ser", label: _t("calc.szereg"), options: [["E12", "E12 (10 %)"], ["E24", "E24 (5 %)"], ["E96", "E96 (1 %)"]], def: "E24" });
    var rng = api.select({ key: "rng", label: _t("calc.div.zakres"), def: "10k", hint: _t("calc.div.zakresHint"),
      options: [["1k", "1 kΩ – 10 kΩ"], ["10k", "10 kΩ – 100 kΩ"], ["100k", "100 kΩ – 1 MΩ"]] });
    var r1 = api.field({ key: "r1", label: "R1 (" + _t("calc.div.gora") + ")", unit: "Ω", prefixes: ["", "k", "M"], defPrefix: "k", def: "10" });
    var r2 = api.field({ key: "r2", label: "R2 (" + _t("calc.div.dol") + ")", unit: "Ω", prefixes: ["", "k", "M"], defPrefix: "k", def: "20" });
    var rl = api.field({ key: "rl", label: _t("calc.div.obciazenie"), unit: "Ω", prefixes: ["", "k", "M"], defPrefix: "k", def: "", hint: _t("calc.div.obciazenieHint") });
    var pickBox = api.h("div", { "class": "calc-grid2" }, [uout.el, ser.el, rng.el]);
    var calcBox = api.h("div", { "class": "calc-grid2" }, [r1.el, r2.el, rl.el]);
    var sch = svgBox(api, 220, 200, [line(api, [[60, 20], [60, 40]]), resSym(api, 60, 40, 50, true, "R1"), line(api, [[60, 90], [60, 110]]),
      resSym(api, 60, 110, 50, true, "R2"), line(api, [[60, 160], [60, 175]]), gnd(api, 60, 175), line(api, [[60, 100], [150, 100]]), dot(api, 60, 100),
      txt(api, 60, 14, "Uin", "middle", "calc-s-acc"), txt(api, 158, 104, "Uout", "start", "calc-s-acc")], _t("calc.div.t"));
    var res = api.results(), w = api.warn(), table = api.h("div", { "class": "calc-pick" });
    el.appendChild(mode.el);
    el.appendChild(api.card([h2(api, "calc.dane"), api.h("div", { "class": "calc-split" }, [api.h("div", {}, [api.h("div", { "class": "calc-grid2" }, [uin.el]), pickBox, calcBox]), sch])]));
    el.appendChild(api.card([h2(api, "calc.wynik"), res.el, table, w.el, api.h("div", { "class": "calc-actions" }, [api.copy(function () { return copyText; })]),
      api.formula([["Uout = Uin · R2 / (R1 + R2)", ""], ["R1 = R2 · (Uin / Uout − 1)", _t("calc.div.fDobor")], ["Rźr = R1 ∥ R2 = R1·R2 / (R1 + R2)", _t("calc.div.fRth")]], _t("calc.div.note"))]));
    var copyText = "";
    mode.on(function (m) { pickBox.hidden = m !== "pick"; calcBox.hidden = m !== "calc"; table.hidden = m !== "pick"; api.refresh(); });
    function use(c) { mode.el.querySelectorAll("button")[1].click(); r1.set(c.r1); r2.set(c.r2); api.refresh(); }
    api.onChange(function () {
      var Uin = uin.get(), ws = [];
      if (mode.get() === "pick") {
        res.show([]); table.textContent = "";
        var Uo = uout.get(), lo = { "1k": 1e3, "10k": 1e4, "100k": 1e5 }[rng.get()] || 1e4;
        if (!(Uin > 0) || !(Uo > 0)) { w.show([["info", _t("calc.div.wpisz")]]); copyText = ""; return; }
        if (Uo >= Uin) { w.show([["bad", _t("calc.div.uoutZaDuze")]]); copyText = ""; return; }
        var list = pickDivider(Uin, Uo, ser.get(), lo, lo * 10, 6);
        if (!list.length) { w.show([["warn", _t("calc.div.brak")]]); copyText = ""; return; }
        var tb = api.h("table", { "class": "calc-tbl" }), hd = api.h("tr", {});
        ["R1", "R2", "Uout", _t("calc.blad"), _t("calc.prad"), ""].forEach(function (x) { hd.appendChild(api.h("th", { text: x })); });
        tb.appendChild(api.h("thead", {}, [hd]));
        var bd = api.h("tbody", {});
        list.forEach(function (c, i) {
          bd.appendChild(api.h("tr", { "class": i === 0 ? "calc-best" : "" }, [api.h("td", { text: fmt(c.r1, "Ω") }), api.h("td", { text: fmt(c.r2, "Ω") }),
            api.h("td", { text: fmt(c.u, "V", 4) }), api.h("td", { text: pct(c.err) }), api.h("td", { text: fmt(c.i, "A", 3) }),
            api.h("td", {}, [api.h("button", { type: "button", "class": "btn-action calc-use", text: _t("calc.div.uzyj"), "aria-label": _t("calc.div.uzyj") + " R1 " + fmt(c.r1, "Ω") + ", R2 " + fmt(c.r2, "Ω"), onclick: function () { use(c); } })])]));
        });
        tb.appendChild(bd);
        table.appendChild(api.h("div", { "class": "calc-tbl-wrap" }, [tb]));
        var b = list[0]; copyText = "R1 = " + fmt(b.r1, "Ω") + ", R2 = " + fmt(b.r2, "Ω") + " → Uout = " + fmt(b.u, "V", 4) + " (" + pct(b.err) + ")";
        ws.push([Math.abs(b.err) <= 0.01 ? "ok" : "warn", _t("calc.div.najlepsza", { r1: fmt(b.r1, "Ω"), r2: fmt(b.r2, "Ω"), e: pct(b.err) })]);
        var rth = M.par(b.r1, b.r2); if (rth > 1e4) ws.push(["info", _t("calc.div.adc", { r: fmt(rth, "Ω") })]);
        w.show(ws); return;
      }
      var R1 = r1.get(), R2 = r2.get(), RL = rl.empty() ? NaN : rl.get();
      if (!(Uin > 0) || !(R1 > 0) || !(R2 > 0)) { res.show([]); w.show([["info", _t("calc.div.wpiszR")]]); copyText = ""; return; }
      var u = Uin * R2 / (R1 + R2), I = Uin / (R1 + R2), rows = [["Uout", fmt(u, "V", 4), _t("calc.div.stosunek", { k: num(R2 / (R1 + R2), 4) })], [_t("calc.prad"), fmt(I, "A", 3)],
        ["P(R1)", fmt(I * I * R1, "W", 3)], ["P(R2)", fmt(I * I * R2, "W", 3)], [_t("calc.div.rth"), fmt(M.par(R1, R2), "Ω", 3)]];
      copyText = "Uin = " + fmt(Uin, "V") + ", R1 = " + fmt(R1, "Ω") + ", R2 = " + fmt(R2, "Ω") + " → Uout = " + fmt(u, "V", 4);
      if (RL > 0) {
        var r2l = M.par(R2, RL), ul = Uin * r2l / (R1 + r2l), drop = (ul - u) / u;
        rows.splice(1, 0, [_t("calc.div.uoutObc"), fmt(ul, "V", 4), pct(drop)]);
        copyText += " (" + _t("calc.div.uoutObc") + ": " + fmt(ul, "V", 4) + ")";
        if (Math.abs(drop) > 0.01) ws.push(["warn", _t("calc.div.obcWplyw", { e: pct(drop) })]);
      }
      if (M.par(R1, R2) > 1e4) ws.push(["info", _t("calc.div.adc", { r: fmt(M.par(R1, R2), "Ω") })]);
      if (I > 0.01) ws.push(["warn", _t("calc.div.duzyPrad", { i: fmt(I, "A") })]);
      if (I * I * Math.max(R1, R2) > 0.125) ws.push(["warn", _t("calc.div.moc")]);
      res.show(rows); w.show(ws);
    });
  } });

  /* ───────── 3. Rezystor do LED ───────── */
  var LEDS = [["red", 2.0], ["orange", 2.0], ["yellow", 2.1], ["green", 2.2], ["greenHi", 3.0], ["blue", 3.0], ["white", 3.1], ["ir", 1.3], ["uv", 3.3]];
  function ledName(k) {
    return { red: _t("calc.led.c.red"), orange: _t("calc.led.c.orange"), yellow: _t("calc.led.c.yellow"), green: _t("calc.led.c.green"), greenHi: _t("calc.led.c.greenHi"),
      blue: _t("calc.led.c.blue"), white: _t("calc.led.c.white"), ir: _t("calc.led.c.ir"), uv: _t("calc.led.c.uv") }[k] || k;
  }
  C.add({ id: "led", icon: "lightbulb", group: "basic", title: "calc.led.t", desc: "calc.led.d", mount: function (el, api) {
    var vs = api.field({ key: "vs", label: _t("calc.led.vs"), unit: "V", prefixes: [""], def: "5" });
    var vf = api.field({ key: "vf", label: _t("calc.led.vf"), unit: "V", prefixes: [""], def: "2", onInput: function () { preset.set(""); } });
    var preset = api.select({ key: "preset", label: _t("calc.led.kolor"), def: "red",
      options: [["", _t("calc.led.wlasne")]].concat(LEDS.map(function (l) { return [l[0], ledName(l[0]) + " – " + num(l[1], 2) + " V"]; })),
      onChange: function (v) { var l = LEDS.filter(function (x) { return x[0] === v; })[0]; if (l) { vf.set(l[1]); } } });
    var ifw = api.field({ key: "if", label: _t("calc.led.if"), unit: "A", prefixes: ["m"], def: "10", hint: _t("calc.led.ifHint") });
    var n = api.field({ key: "n", label: _t("calc.led.n"), unit: "", prefixes: [""], def: "1" });
    var ser = api.select({ key: "ser", label: _t("calc.szereg"), options: [["E12", "E12"], ["E24", "E24"]], def: "E12" });
    var sch = svgBox(api, 300, 100, [txt(api, 14, 28, "Vs", "start", "calc-s-acc"), line(api, [[20, 40], [70, 40]]), resSym(api, 70, 40, 60, false, "R"),
      line(api, [[130, 40], [170, 40]]), api.svg("polygon", { points: "170,28 170,52 194,40", "class": "calc-s-part" }), line(api, [[194, 28], [194, 52]]),
      txt(api, 182, 72, "LED", "middle"), line(api, [[194, 40], [260, 40], [260, 60]]), gnd(api, 260, 60), txt(api, 150, 22, "If →", "middle", "calc-s-acc")], _t("calc.led.t"));
    el.appendChild(api.card([h2(api, "calc.dane"), api.h("div", { "class": "calc-grid2" }, [vs.el, preset.el, vf.el, ifw.el, n.el, ser.el]), sch]));
    var res = api.results(), w = api.warn(), copyText = "";
    el.appendChild(api.card([h2(api, "calc.wynik"), res.el, w.el, api.h("div", { "class": "calc-actions" }, [api.copy(function () { return copyText; })]),
      api.formula([["R = (Vs − n · Vf) / If", ""], ["P(R) = If² · R", ""], ["If(rzecz.) = (Vs − n · Vf) / R(szereg)", _t("calc.led.fRzecz")]], _t("calc.led.note"))]));
    api.onChange(function () {
      var Vs = vs.get(), Vf = vf.get(), If = ifw.get(), N = Math.round(n.get()), ws = [];
      if (!(Vs > 0) || !(Vf > 0) || !(If > 0) || !(N >= 1)) { res.show([]); w.show([["info", _t("calc.led.wpisz")]]); copyText = ""; return; }
      var head = Vs - N * Vf;
      if (head <= 0) { res.show([]); w.show([["bad", _t("calc.led.zaMaloV", { n: N, v: fmt(N * Vf, "V") })]]); copyText = ""; return; }
      var R = head / If, Rs = M.nearest(ser.get(), R, "up"), Ireal = head / Rs, P = Ireal * Ireal * Rs, pr = M.powerRating(P);
      res.show([[_t("calc.led.rObl"), fmt(R, "Ω")], [_t("calc.led.rSzereg", { s: ser.get() }), fmt(Rs, "Ω"), _t("calc.led.wGore")], [_t("calc.led.ifRzecz"), fmt(Ireal, "A", 3)],
        [_t("calc.led.pR"), fmt(P, "W", 3), pr ? _t("calc.zalecanaMoc", { p: M.powerName(pr) }) : ""], [_t("calc.led.pLed"), fmt(N * Vf * Ireal, "W", 3)]]);
      copyText = "LED: Vs = " + fmt(Vs, "V") + ", Vf = " + fmt(Vf, "V") + (N > 1 ? " ×" + N : "") + ", If = " + fmt(If, "A") + " → R = " + fmt(Rs, "Ω") + " (" + (pr ? M.powerName(pr) : "?") + ")";
      if (head < 0.5) ws.push(["warn", _t("calc.led.malyZapas")]);
      if (If > 0.02) ws.push(["warn", _t("calc.led.gpio")]);
      if (If > 0.03) ws.push(["bad", _t("calc.led.maxLed")]);
      if (P > 0.25) ws.push(["warn", _t("calc.ohm.mocDuza", { p: fmt(P, "W") })]);
      w.show(ws);
    });
  } });

  /* ───────── 4. Kod paskowy rezystora ───────── */
  function colorName(c) {
    return { black: _t("calc.kol.black"), brown: _t("calc.kol.brown"), red: _t("calc.kol.red"), orange: _t("calc.kol.orange"), yellow: _t("calc.kol.yellow"), green: _t("calc.kol.green"),
      blue: _t("calc.kol.blue"), violet: _t("calc.kol.violet"), grey: _t("calc.kol.grey"), white: _t("calc.kol.white"), gold: _t("calc.kol.gold"), silver: _t("calc.kol.silver") }[c] || c;
  }
  function drawResistor(api, bands, nBands) {
    var W = 320, H = 90, bx = 70, bw = 180, kids = [line(api, [[10, 45], [bx, 45]]), line(api, [[bx + bw, 45], [W - 10, 45]]),
      api.svg("rect", { x: bx, y: 22, width: bw, height: 46, rx: 18, "class": "calc-r-body" + (nBands > 4 ? " calc-r-mf" : "") })];
    var xs = nBands === 4 ? [92, 114, 136, 210] : nBands === 5 ? [88, 106, 124, 142, 212] : [86, 102, 118, 134, 200, 224];
    bands.forEach(function (c, i) { if (c) kids.push(api.svg("rect", { x: xs[i], y: 22, width: 11, height: 46, fill: HEX[c], "class": "calc-r-band" })); });
    return svgBox(api, W, H, kids, bands.map(colorName).join(", "));
  }
  C.add({ id: "rescode", icon: "barcode", group: "basic", title: "calc.rc.t", desc: "calc.rc.d", mount: function (el, api) {
    var mode = api.modes({ key: "mode", items: [["read", _t("calc.rc.trybOdczyt")], ["write", _t("calc.rc.trybZapis")]] });
    var nb = api.select({ key: "nb", label: _t("calc.rc.paski"), options: [["4", "4"], ["5", "5"], ["6", "6"]], def: "4" });
    var digitOpts = COLORS.slice(0, 10).map(function (c, i) { return [c, i + " – " + colorName(c)]; });
    var multOpts = COLORS.map(function (c) { var e = MULT[c]; return [c, "×" + (e < 0 ? num(Math.pow(10, e), 2) : fmt(Math.pow(10, e), "").replace(/\s/g, "")) + " – " + colorName(c)]; });
    var tolOpts = Object.keys(TOL).map(function (c) { return [c, "±" + num(TOL[c], 2) + " % – " + colorName(c)]; });
    var tcOpts = Object.keys(TC).map(function (c) { return [c, TC[c] + " ppm/K – " + colorName(c)]; });
    var d1 = api.select({ key: "d1", label: _t("calc.rc.cyfra", { n: 1 }), options: digitOpts, def: "yellow" });
    var d2 = api.select({ key: "d2", label: _t("calc.rc.cyfra", { n: 2 }), options: digitOpts, def: "violet" });
    var d3 = api.select({ key: "d3", label: _t("calc.rc.cyfra", { n: 3 }), options: digitOpts, def: "black" });
    var mu = api.select({ key: "mu", label: _t("calc.rc.mnoznik"), options: multOpts, def: "red" });
    var to = api.select({ key: "to", label: _t("calc.rc.tolerancja"), options: tolOpts, def: "gold" });
    var tc = api.select({ key: "tc", label: _t("calc.rc.tc"), options: tcOpts, def: "brown" });
    var val = api.field({ key: "val", label: _t("calc.rezystancja"), unit: "Ω", prefixes: ["", "k", "M"], defPrefix: "k", def: "4,7" });
    var readBox = api.h("div", { "class": "calc-grid2" }, [d1.el, d2.el, d3.el, mu.el, to.el, tc.el]);
    var writeBox = api.h("div", { "class": "calc-grid2" }, [val.el]);
    var pic = api.h("div", { "class": "calc-r-pic" }), res = api.results(), w = api.warn(), copyText = "";
    el.appendChild(mode.el);
    el.appendChild(api.card([h2(api, "calc.dane"), api.h("div", { "class": "calc-grid2" }, [nb.el]), readBox, writeBox]));
    el.appendChild(api.card([h2(api, "calc.wynik"), pic, res.el, w.el, api.h("div", { "class": "calc-actions" }, [api.copy(function () { return copyText; })]),
      api.formula([["R = (" + _t("calc.rc.fCyfry") + ") × 10^" + _t("calc.rc.fMnoznik"), ""]], _t("calc.rc.note"))]));
    api.onChange(function () {
      var N = +nb.get(), nd = N === 4 ? 2 : 3, ws = [], bands;
      var wr = mode.get() === "write";
      writeBox.hidden = !wr; [d1, d2, mu].forEach(function (s) { s.el.hidden = wr; }); d3.el.hidden = wr || nd < 3; tc.el.hidden = N < 6;
      if (mode.get() === "read") {
        var digits = [d1.get(), d2.get()].concat(nd === 3 ? [d3.get()] : []);
        var R = decode({ digits: digits, mult: mu.get() });
        bands = digits.concat([mu.get(), to.get()]).concat(N === 6 ? [tc.get()] : []);
        var tol = TOL[to.get()];
        var rows = [[_t("calc.rezystancja"), fmt(R, "Ω", 4)], [_t("calc.rc.tolerancja"), "±" + num(tol, 2) + " %", fmt(R * (1 - tol / 100), "Ω", 4) + " … " + fmt(R * (1 + tol / 100), "Ω", 4)]];
        if (N === 6) rows.push([_t("calc.rc.tc"), TC[tc.get()] + " ppm/K"]);
        var e = M.nearest(nd === 2 ? "E24" : "E96", R);
        if (e && Math.abs(e - R) / R > 1e-6) ws.push(["info", _t("calc.rc.pozaSzeregiem", { s: nd === 2 ? "E24" : "E96", v: fmt(e, "Ω") })]);
        res.show(rows); copyText = bands.map(colorName).join(" – ") + " = " + fmt(R, "Ω", 4) + " ±" + num(tol, 2) + " %";
      } else {
        var v = val.get();
        if (!(v > 0)) { pic.textContent = ""; res.show([]); w.show([["info", _t("calc.rc.wpisz")]]); copyText = ""; return; }
        var enc = encode(v, nd);
        if (!enc) { pic.textContent = ""; res.show([]); w.show([["bad", _t("calc.rc.zakres")]]); copyText = ""; return; }
        bands = enc.digits.concat([enc.mult, to.get()]).concat(N === 6 ? [tc.get()] : []);
        res.show([[_t("calc.rc.paskiWynik"), bands.map(colorName).join(" – ")], [_t("calc.rezystancja"), fmt(enc.value, "Ω", 4)]]);
        if (!enc.exact) ws.push(["warn", _t("calc.rc.zaokraglono", { v: fmt(enc.value, "Ω", 4), n: N })]);
        copyText = fmt(enc.value, "Ω", 4) + " = " + bands.map(colorName).join(" – ");
      }
      pic.textContent = ""; pic.appendChild(drawResistor(api, bands, N));
      ws.push(["info", _t("calc.rc.kierunek")]);
      w.show(ws);
    });
    mode.on(function () { api.refresh(); });   // w trybie zapisu z listy zostają tylko tolerancja i TC
  } });
})(window);
