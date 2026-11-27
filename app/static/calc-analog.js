/* ESN – Kalkulatory (v53): wzmacniacz operacyjny – odwracający i nieodwracający (wzmocnienie, napięcie wyjściowe, nasycenie, pasmo z GBW, dobór rezystorów).
 * Obliczenia w ESNCalcAnalog (testy: tests/test_calc.py). */
(function (global) {
  "use strict";
  var C = global.ESNCalc; if (!C) return;
  var M = C.math, fmt = M.fmt, num = M.num, pct = M.pct;
  function _t(k, p) { return global.ESNI18n ? global.ESNI18n.t(k, p) : k; }

  /* ───────── obliczenia ───────── */
  /* nieodwracający: G = 1 + Rf/Rg; odwracający: G = −Rf/Rin. Wzmocnienie szumowe (do pasma) = 1 + Rf/Rg w obu przypadkach. */
  function opamp(type, rf, rg) {
    var g = type === "inv" ? -rf / rg : 1 + rf / rg, noise = 1 + rf / rg;
    return { g: g, db: 20 * Math.log10(Math.abs(g)), noise: noise, zin: type === "inv" ? rg : Infinity };
  }
  /* para Rf/Rg z szeregu dla wzmocnienia |G|, Rg w [lo, hi] */
  function pickGain(type, G, series, lo, hi, count) {
    var ratio = type === "inv" ? Math.abs(G) : G - 1;
    if (!(ratio > 0)) return [];
    var out = [];
    M.seriesRange(series, lo, hi).forEach(function (rg) {
      var rf = M.nearest(series, rg * ratio); if (!rf) return;
      var g = Math.abs(opamp(type, rf, rg).g), err = (g - Math.abs(G)) / Math.abs(G);
      out.push({ rf: rf, rg: rg, g: g, err: err });
    });
    var seen = {};
    return out.sort(function (a, b) { return Math.abs(a.err) - Math.abs(b.err) || Math.abs(Math.log(a.rg / 1e4)) - Math.abs(Math.log(b.rg / 1e4)); })
      .filter(function (x) { var k = (x.rf / x.rg).toPrecision(6); if (seen[k]) return false; seen[k] = 1; return true; }).slice(0, count || 6);
  }
  global.ESNCalcAnalog = { opamp: opamp, pickGain: pickGain };

  function h4(api, key) { return api.h("h4", { "class": "calc-h", text: _t(key) }); }

  function drawOpamp(api, type) {                  // szkic układu: trójkąt, wejścia −/+, Rf w pętli, Rg/Rin
    var S = api.svg, kids = [];
    function wire(pts) { return S("polyline", { points: pts.map(function (p) { return p.join(","); }).join(" "), "class": "calc-s-wire" }); }
    function res(x, y, w, vert, lbl, lx, ly) { kids.push(vert ? S("rect", { x: x - 7, y: y, width: 14, height: w, rx: 2, "class": "calc-s-part" }) : S("rect", { x: x, y: y - 7, width: w, height: 14, rx: 2, "class": "calc-s-part" }));
      kids.push(S("text", { x: lx, y: ly, "text-anchor": "middle", "class": "calc-s-lbl", text: lbl })); }
    function txt(x, y, t, cls, anchor) { kids.push(S("text", { x: x, y: y, "text-anchor": anchor || "middle", "class": cls || "calc-s-lbl", text: t })); }
    kids.push(S("polygon", { points: "140,50 140,130 210,90", "class": "calc-s-part" }));
    txt(150, 74, "−", "calc-s-acc"); txt(150, 120, "+", "calc-s-acc");
    kids.push(wire([[210, 90], [270, 90]])); txt(276, 94, "Vout", "calc-s-acc", "start");
    kids.push(wire([[140, 70], [120, 70], [120, 25], [160, 25]])); res(160, 25, 40, false, "Rf", 180, 14); kids.push(wire([[200, 25], [240, 25], [240, 90]]));
    kids.push(S("circle", { cx: 240, cy: 90, r: 3, "class": "calc-s-dot" }), S("circle", { cx: 120, cy: 70, r: 3, "class": "calc-s-dot" }));
    if (type === "inv") {
      kids.push(wire([[20, 70], [50, 70]])); res(50, 70, 40, false, "Rin", 70, 59); kids.push(wire([[90, 70], [120, 70]]));
      txt(14, 74, "Vin", "calc-s-acc", "end");
      kids.push(wire([[140, 110], [110, 110], [110, 150]]));
      [[14, 0], [9, 5], [4, 10]].forEach(function (d) { kids.push(wire([[110 - d[0], 150 + d[1]], [110 + d[0], 150 + d[1]]])); });
    } else {
      kids.push(wire([[120, 70], [96, 70]])); res(52, 70, 44, false, "Rg", 74, 59); kids.push(wire([[52, 70], [30, 70], [30, 82]]));   // Rg do masy po lewej
      [[14, 0], [9, 5], [4, 10]].forEach(function (d) { kids.push(wire([[30 - d[0], 82 + d[1]], [30 + d[0], 82 + d[1]]])); });
      kids.push(wire([[10, 110], [140, 110]])); txt(4, 114, "Vin", "calc-s-acc", "end");
    }
    return S("svg", { viewBox: "-20 0 340 170", "class": "calc-schem calc-schem-wide", role: "img", "aria-label": type === "inv" ? _t("calc.op.odwr") : _t("calc.op.nieodwr") }, kids);
  }

  C.add({ id: "opamp", icon: "play", group: "analog", title: "calc.op.t", desc: "calc.op.d", mount: function (el, api) {
    var mode = api.modes({ key: "mode", items: [["calc", _t("calc.op.trybLicz")], ["pick", _t("calc.op.trybDobierz")]] });
    var type = api.select({ key: "type", label: _t("calc.op.uklad"), def: "noninv", options: [["noninv", _t("calc.op.nieodwr")], ["inv", _t("calc.op.odwr")]] });
    var rf = api.field({ key: "rf", label: "Rf (" + _t("calc.op.sprzezenie") + ")", unit: "Ω", prefixes: ["", "k", "M"], defPrefix: "k", def: "47" });
    var rg = api.field({ key: "rg", label: "Rg / Rin", unit: "Ω", prefixes: ["", "k", "M"], defPrefix: "k", def: "10" });
    var G = api.field({ key: "g", label: _t("calc.op.wzmCel"), unit: "×", prefixes: [""], def: "5,7" });
    var ser = api.select({ key: "ser", label: _t("calc.szereg"), def: "E24", options: [["E12", "E12"], ["E24", "E24"], ["E96", "E96"]] });
    var vin = api.field({ key: "vin", label: _t("calc.op.vin"), unit: "V", prefixes: ["m", ""], defPrefix: "m", def: "500" });
    var vcc = api.field({ key: "vcc", label: _t("calc.op.zasilanie"), unit: "V", prefixes: [""], def: "5" });
    var sup = api.select({ key: "sup", label: _t("calc.op.zasTyp"), def: "single", options: [["single", _t("calc.op.pojedyncze")], ["dual", _t("calc.op.symetryczne")]] });
    var rr = api.select({ key: "rr", label: _t("calc.op.wyjscie"), def: "rr", options: [["rr", _t("calc.op.railToRail")], ["std", _t("calc.op.zwykly")]] });
    var gbw = api.field({ key: "gbw", label: _t("calc.op.gbw"), unit: "Hz", prefixes: ["k", "M"], defPrefix: "M", def: "1", hint: _t("calc.op.gbwHint") });
    var schBox = api.h("div", { "class": "calc-op-sch" });
    var calcBox = api.h("div", { "class": "calc-grid2" }, [rf.el, rg.el]), pickBox = api.h("div", { "class": "calc-grid2" }, [G.el, ser.el]);
    var res = api.results(), w = api.warn(), table = api.h("div", { "class": "calc-pick" }), copyText = "";
    el.appendChild(mode.el);
    el.appendChild(api.card([h4(api, "calc.dane"), api.h("div", { "class": "calc-split" }, [api.h("div", {}, [api.h("div", { "class": "calc-grid2" }, [type.el]), calcBox, pickBox,
      api.h("div", { "class": "calc-grid2" }, [vin.el, vcc.el, sup.el, rr.el, gbw.el])]), schBox])]));
    var fbox = api.h("div", {});
    el.appendChild(api.card([h4(api, "calc.wynik"), res.el, table, w.el, api.h("div", { "class": "calc-actions" }, [api.copy(function () { return copyText; })]), fbox]));
    mode.on(function (m) { calcBox.hidden = m !== "calc"; pickBox.hidden = m !== "pick"; table.hidden = m !== "pick"; api.refresh(); });
    function useP(p) { mode.el.querySelectorAll("button")[0].click(); rf.set(p.rf); rg.set(p.rg); api.refresh(); }
    api.onChange(function () {
      var t = type.get(), ws = [], Rf, Rg;
      schBox.textContent = ""; schBox.appendChild(drawOpamp(api, t)); table.textContent = ""; fbox.textContent = "";
      fbox.appendChild(api.formula(t === "inv" ? [["G = −Rf / Rin", ""], ["Vout = −Vin · Rf / Rin", ""], ["Zwe = Rin", _t("calc.op.fZin")], ["f(−3 dB) ≈ GBW / (1 + Rf/Rin)", ""]]
        : [["G = 1 + Rf / Rg", ""], ["Vout = Vin · (1 + Rf / Rg)", ""], ["f(−3 dB) ≈ GBW / G", ""]], _t("calc.op.note")));
      if (mode.get() === "pick") {
        var g = G.get();
        if (!(g > 0) || (t === "noninv" && g <= 1)) { res.show([]); w.show([["info", t === "noninv" ? _t("calc.op.wpiszWzmN") : _t("calc.op.wpiszWzm")]]); copyText = ""; return; }
        var list = pickGain(t, t === "inv" ? -g : g, ser.get(), 1e3, 1e5, 6);
        if (!list.length) { res.show([]); w.show([["warn", _t("calc.op.brak")]]); copyText = ""; return; }
        var tb = api.h("table", { "class": "calc-tbl" }), hd = api.h("tr", {});
        ["Rf", t === "inv" ? "Rin" : "Rg", "|G|", _t("calc.blad"), ""].forEach(function (x) { hd.appendChild(api.h("th", { text: x })); });
        tb.appendChild(api.h("thead", {}, [hd])); var bd = api.h("tbody", {});
        list.forEach(function (p, i) { bd.appendChild(api.h("tr", { "class": i === 0 ? "calc-best" : "" }, [api.h("td", { text: fmt(p.rf, "Ω") }), api.h("td", { text: fmt(p.rg, "Ω") }), api.h("td", { text: num(p.g, 4) }), api.h("td", { text: pct(p.err) }),
          api.h("td", {}, [api.h("button", { type: "button", "class": "btn-action calc-use", text: _t("calc.div.uzyj"), onclick: function () { useP(p); } })])])); });
        tb.appendChild(bd); table.appendChild(api.h("div", { "class": "calc-tbl-wrap" }, [tb]));
        Rf = list[0].rf; Rg = list[0].rg;
        ws.push([Math.abs(list[0].err) <= 0.01 ? "ok" : "warn", _t("calc.op.najlepsza", { rf: fmt(Rf, "Ω"), rg: fmt(Rg, "Ω"), e: pct(list[0].err) })]);
      } else { Rf = rf.get(); Rg = rg.get(); }
      if (!(Rf > 0) || !(Rg > 0)) { res.show([]); w.show([["info", _t("calc.op.wpiszR")]]); copyText = ""; return; }
      var o = opamp(t, Rf, Rg), Vi = vin.get(), V = vcc.get(), rows = [[_t("calc.op.wzm"), num(o.g, 4) + " ×", num(o.db, 3) + " dB"]];
      if (isFinite(Vi)) {
        var vo = Vi * o.g; rows.push([_t("calc.op.vout"), fmt(vo, "V", 4)]);
        if (V > 0) {
          var m = rr.get() === "rr" ? 0.05 : 1.5, hiV = sup.get() === "dual" ? V - m : V - m, loV = sup.get() === "dual" ? -V + m : (rr.get() === "rr" ? 0.05 : 0);
          if (vo > hiV || vo < loV) ws.push(["bad", _t("calc.op.nasycenie", { v: fmt(vo, "V", 3), lo: fmt(loV, "V", 3), hi: fmt(hiV, "V", 3) })]);
          if (sup.get() === "single" && vo < 0) ws.push(["warn", _t("calc.op.ujemne")]);
        }
      }
      var B = gbw.get();
      if (B > 0) rows.push([_t("calc.op.pasmo"), fmt(B / o.noise, "Hz", 3), _t("calc.op.pasmoX", { n: num(o.noise, 3) })]);
      if (t === "inv") rows.push([_t("calc.op.zin"), fmt(o.zin, "Ω", 3)]);
      if (Rf > 1e6 || Rg > 1e6) ws.push(["warn", _t("calc.op.duzeR")]);
      if (Rf < 1e3 && Rg < 1e3) ws.push(["info", _t("calc.op.maleR")]);
      res.show(rows); w.show(ws);
      copyText = (t === "inv" ? _t("calc.op.odwr") : _t("calc.op.nieodwr")) + ": Rf = " + fmt(Rf, "Ω") + ", " + (t === "inv" ? "Rin" : "Rg") + " = " + fmt(Rg, "Ω") + " → G = " + num(o.g, 4);
    });
  } });
})(window);
