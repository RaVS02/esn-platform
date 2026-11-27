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
    if (type === "buf") return { g: 1, db: 0, noise: 1, zin: Infinity };   // v57: wtórnik napięciowy
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
  /* zakres wyjścia wzmacniacza: pojedyncze 0…V / symetryczne ±V; rail-to-rail ok. 50 mV od szyn, zwykły ok. 1,5 V od góry */
  function railsOf(V, supply, rr) {
    if (!(V > 0)) return null;
    var m = rr === "rr" ? 0.05 : 1.5;
    return supply === "dual" ? { lo: -V + m, hi: V - m } : { lo: rr === "rr" ? 0.05 : 0, hi: V - m };
  }
  global.ESNCalcAnalog = { opamp: opamp, pickGain: pickGain, railsOf: railsOf };

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
    if (type === "buf") {                          // wyjście wprost na wejście odwracające
      kids.push(wire([[140, 70], [120, 70], [120, 25], [240, 25], [240, 90]]), S("circle", { cx: 240, cy: 90, r: 3, "class": "calc-s-dot" }));
      kids.push(wire([[10, 110], [140, 110]])); txt(4, 114, "Vin", "calc-s-acc", "end");
      return S("svg", { viewBox: "-20 0 340 170", "class": "calc-schem calc-schem-wide", role: "img", "aria-label": _t("calc.op.wtornik") }, kids);
    }
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
    var type = api.select({ key: "type", label: _t("calc.op.uklad"), def: "noninv", options: [["noninv", _t("calc.op.nieodwr")], ["inv", _t("calc.op.odwr")], ["buf", _t("calc.op.wtornik")]] });
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
      var t = type.get(), ws = [], Rf, Rg, buf = t === "buf";
      schBox.textContent = ""; schBox.appendChild(drawOpamp(api, t)); table.textContent = ""; fbox.textContent = "";
      mode.el.hidden = buf; calcBox.hidden = buf || mode.get() !== "calc"; pickBox.hidden = buf || mode.get() !== "pick"; table.hidden = buf || mode.get() !== "pick";
      if (buf) {
        fbox.appendChild(api.formula([["Vout = Vin", ""], ["G = 1", ""]], _t("calc.op.noteBuf")));
        var vb = vin.get(), rb = [[_t("calc.op.wzm"), "1 ×", "0 dB"], [_t("calc.op.zin"), _t("calc.op.bardzoDuza")]], wb = [["info", _t("calc.op.bufInfo")]];
        if (isFinite(vb)) {
          rb.push([_t("calc.op.vout"), fmt(vb, "V", 4)]);
          var R0 = railsOf(vcc.get(), sup.get(), rr.get());
          if (R0 && (vb > R0.hi || vb < R0.lo)) wb.push(["bad", _t("calc.op.nasycenie", { v: fmt(vb, "V", 3), lo: fmt(R0.lo, "V", 3), hi: fmt(R0.hi, "V", 3) })]);
        }
        if (gbw.get() > 0) rb.push([_t("calc.op.pasmo"), fmt(gbw.get(), "Hz", 3), "GBW / 1"]);
        res.show(rb); w.show(wb); copyText = _t("calc.op.wtornik") + ": Vout = Vin" + (isFinite(vb) ? " = " + fmt(vb, "V", 4) : "");
        return;
      }
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
  /* ═════════════ v57: wzmacniacz różnicowy, sumujący, komparator z histerezą ═════════════ */
  /* różnicowy: V1 → R1 → (−), R2 sprzężenie; V2 → R3 → (+), R4 do masy */
  function diffAmp(R1, R2, R3, R4, V1, V2) {
    var kp = R4 / (R3 + R4) * (1 + R2 / R1), kn = R2 / R1;
    var ad = (kp + kn) / 2, acm = kp - kn;
    return { vout: V2 * kp - V1 * kn, kp: kp, kn: kn, ad: ad, acm: acm,
      cmrr: Math.abs(acm) < 1e-12 ? Infinity : 20 * Math.log10(Math.abs(ad) / Math.abs(acm)), zin1: R1, zin2: R3 + R4 };
  }
  /* najgorszy CMRR przy tolerancji rezystorów t (np. 0,01): ≈ (1 + Ad) / (4t) */
  function cmrrTol(ad, tol) { return 20 * Math.log10((1 + ad) / (4 * tol)); }
  /* sumujący odwracający: Vout = −Rf · Σ Vi/Ri */
  function summer(Rf, ins) {
    var v = 0; ins.forEach(function (x) { v += x.v / x.r; });
    return { vout: -Rf * v, gains: ins.map(function (x) { return -Rf / x.r; }), noise: 1 + Rf * ins.reduce(function (a, x) { return a + 1 / x.r; }, 0) };
  }
  /* komparator z histerezą (przerzutnik Schmitta)
     nieodwracający: Vin → R1 → (+), R2 z wyjścia do (+), Vref na (−)
     odwracający:    Vin na (−), Vref → R1 → (+), R2 z wyjścia do (+) */
  function schmitt(type, R1, R2, Vref, VOH, VOL) {
    var th, tl;
    if (type === "inv") { th = (Vref * R2 + VOH * R1) / (R1 + R2); tl = (Vref * R2 + VOL * R1) / (R1 + R2); }
    else { th = (Vref * (R1 + R2) - VOL * R1) / R2; tl = (Vref * (R1 + R2) - VOH * R1) / R2; }
    return { th: th, tl: tl, hyst: th - tl, center: (th + tl) / 2 };
  }
  /* dobór: progi VTH > VTL → stosunek R1/R2 i Vref */
  function schmittPick(type, VTH, VTL, VOH, VOL) {
    var H = VTH - VTL, sw = VOH - VOL;
    if (!(H > 0) || !(sw > 0) || H >= sw) return null;
    if (type === "inv") { var a = H / sw; return { ratio: a / (1 - a), vref: (VTL - a * VOL) / (1 - a) }; }
    var k = H / sw; return { ratio: k, vref: (VTH + VOL * k) / (1 + k) };
  }
  function pickRatio(ratio, series, lo, hi, count) {      // R1/R2 = ratio, R2 z [lo, hi]
    var out = [], seen = {};
    M.seriesRange(series, lo, hi).forEach(function (r2) { var r1 = M.nearest(series, r2 * ratio); if (!r1) return; out.push({ r1: r1, r2: r2, err: (r1 / r2 - ratio) / ratio }); });
    return out.sort(function (a, b) { return Math.abs(a.err) - Math.abs(b.err) || Math.abs(Math.log(a.r2 / 1e5)) - Math.abs(Math.log(b.r2 / 1e5)); })
      .filter(function (x) { var k = (x.r1 / x.r2).toPrecision(6); if (seen[k]) return false; seen[k] = 1; return true; }).slice(0, count || 5);
  }
  global.ESNCalcAnalog.diffAmp = diffAmp; global.ESNCalcAnalog.cmrrTol = cmrrTol; global.ESNCalcAnalog.summer = summer;
  global.ESNCalcAnalog.schmitt = schmitt; global.ESNCalcAnalog.schmittPick = schmittPick; global.ESNCalcAnalog.pickRatio = pickRatio;

  /* wspólne pola zasilania i rodzaju wyjścia */
  function supplyFields(api, d) {
    d = d || {};
    var vcc = api.field({ key: "vcc", label: _t("calc.op.zasilanie"), unit: "V", prefixes: [""], def: d.v || "5" });
    var sup = api.select({ key: "sup", label: _t("calc.op.zasTyp"), def: d.sup || "single", options: [["single", _t("calc.op.pojedyncze")], ["dual", _t("calc.op.symetryczne")]] });
    var rr = api.select({ key: "rr", label: _t("calc.op.wyjscie"), def: "rr", options: [["rr", _t("calc.op.railToRail")], ["std", _t("calc.op.zwykly")]] });
    return { els: [vcc.el, sup.el, rr.el], rails: function () { return railsOf(vcc.get(), sup.get(), rr.get()); }, single: function () { return sup.get() === "single"; } };
  }
  function satWarn(ws, v, R) { if (R && isFinite(v) && (v > R.hi || v < R.lo)) ws.push(["bad", _t("calc.op.nasycenie", { v: fmt(v, "V", 3), lo: fmt(R.lo, "V", 3), hi: fmt(R.hi, "V", 3) })]); }

  /* zestaw do szkiców */
  function kit(api) {
    var S = api.svg, kids = [];
    var k = {
      kids: kids,
      wire: function (pts) { kids.push(S("polyline", { points: pts.map(function (p) { return p.join(","); }).join(" "), "class": "calc-s-wire" })); },
      res: function (x, y, w, vert, lbl, lx, ly) { kids.push(vert ? S("rect", { x: x - 7, y: y, width: 14, height: w, rx: 2, "class": "calc-s-part" }) : S("rect", { x: x, y: y - 7, width: w, height: 14, rx: 2, "class": "calc-s-part" }));
        if (lbl) kids.push(S("text", { x: lx, y: ly, "text-anchor": "middle", "class": "calc-s-lbl", text: lbl })); },
      txt: function (x, y, t, cls, anchor) { kids.push(S("text", { x: x, y: y, "text-anchor": anchor || "middle", "class": cls || "calc-s-lbl", text: t })); },
      dot: function (x, y) { kids.push(S("circle", { cx: x, cy: y, r: 3, "class": "calc-s-dot" })); },
      gnd: function (x, y) { [[14, 0], [9, 5], [4, 10]].forEach(function (d) { k.wire([[x - d[0], y + d[1]], [x + d[0], y + d[1]]]); }); },
      amp: function () { kids.push(S("polygon", { points: "140,50 140,130 210,90", "class": "calc-s-part" })); k.txt(150, 74, "−", "calc-s-acc"); k.txt(150, 120, "+", "calc-s-acc");
        k.wire([[210, 90], [270, 90]]); k.txt(276, 94, "Vout", "calc-s-acc", "start"); },
      svg: function (label, h) { return S("svg", { viewBox: "-52 0 372 " + (h || 170), "class": "calc-schem calc-schem-wide", role: "img", "aria-label": label }, kids); }
    };
    return k;
  }

  /* ───────── wzmacniacz różnicowy ───────── */
  C.add({ id: "diffamp", icon: "not-equal", group: "analog", title: "calc.da.t", desc: "calc.da.d", mount: function (el, api) {
    var match = api.select({ key: "match", label: _t("calc.da.rezystory"), def: "1", options: [["1", _t("calc.da.dopasowane")], ["0", _t("calc.da.wszystkie4")]] });
    var R1 = api.field({ key: "r1", label: "R1", unit: "Ω", prefixes: ["", "k", "M"], defPrefix: "k", def: "10" });
    var R2 = api.field({ key: "r2", label: "R2 (" + _t("calc.op.sprzezenie") + ")", unit: "Ω", prefixes: ["", "k", "M"], defPrefix: "k", def: "100" });
    var R3 = api.field({ key: "r3", label: "R3", unit: "Ω", prefixes: ["", "k", "M"], defPrefix: "k", def: "10" });
    var R4 = api.field({ key: "r4", label: "R4", unit: "Ω", prefixes: ["", "k", "M"], defPrefix: "k", def: "100" });
    var V1 = api.field({ key: "v1", label: "V1 (" + _t("calc.da.wejscieMinus") + ")", unit: "V", prefixes: ["m", ""], defPrefix: "", def: "2,5" });
    var V2 = api.field({ key: "v2", label: "V2 (" + _t("calc.da.wejsciePlus") + ")", unit: "V", prefixes: ["m", ""], defPrefix: "", def: "2,52" });
    var tol = api.select({ key: "tol", label: _t("calc.da.tolerancja"), def: "0.01", options: [["0.05", "±5 %"], ["0.01", "±1 %"], ["0.001", "±0,1 %"]] });
    var sp = supplyFields(api), r34 = api.h("div", { "class": "calc-grid2" }, [R3.el, R4.el]), schBox = api.h("div", {});
    var res = api.results(), w = api.warn(), copyText = "";
    el.appendChild(api.card([h4(api, "calc.dane"), api.h("div", { "class": "calc-split" }, [api.h("div", {}, [api.h("div", { "class": "calc-grid2" }, [match.el, tol.el, R1.el, R2.el]), r34,
      api.h("div", { "class": "calc-grid2" }, [V1.el, V2.el].concat(sp.els))]), schBox])]));
    el.appendChild(api.card([h4(api, "calc.wynik"), res.el, w.el, api.h("div", { "class": "calc-actions" }, [api.copy(function () { return copyText; })]),
      api.formula([["Vout = (R2/R1) · (V2 − V1)", _t("calc.da.fDop")], ["Vout = V2 · R4/(R3+R4) · (1 + R2/R1) − V1 · R2/R1", _t("calc.da.fOgol")], ["CMRR = 20·log(|Ad| / |Acm|)", ""]], _t("calc.da.note"))]));
    var k = kit(api); k.amp();
    k.wire([[-10, 70], [40, 70]]); k.res(40, 70, 44, false, "R1", 62, 59); k.wire([[84, 70], [140, 70]]); k.txt(-14, 74, "V1", "calc-s-acc", "end");
    k.wire([[110, 70], [110, 25], [160, 25]]); k.res(160, 25, 40, false, "R2", 180, 14); k.wire([[200, 25], [240, 25], [240, 90]]); k.dot(110, 70); k.dot(240, 90);
    k.wire([[-10, 110], [40, 110]]); k.res(40, 110, 44, false, "R3", 62, 99); k.wire([[84, 110], [140, 110]]); k.txt(-14, 114, "V2", "calc-s-acc", "end");
    k.wire([[110, 110], [110, 120]]); k.res(110, 120, 30, true, "", 0, 0); k.txt(126, 140, "R4", "calc-s-lbl", "start"); k.wire([[110, 150], [110, 156]]); k.gnd(110, 156); k.dot(110, 110);
    schBox.appendChild(k.svg(_t("calc.da.t"), 175));
    api.onChange(function () {
      var m = match.get() === "1"; r34.hidden = m;
      var r1 = R1.get(), r2 = R2.get(), r3 = m ? r1 : R3.get(), r4 = m ? r2 : R4.get(), v1 = V1.get(), v2 = V2.get(), ws = [];
      if (![r1, r2, r3, r4].every(function (x) { return x > 0; })) { res.show([]); w.show([["info", _t("calc.da.wpisz")]]); copyText = ""; return; }
      var d = diffAmp(r1, r2, r3, r4, isFinite(v1) ? v1 : 0, isFinite(v2) ? v2 : 0), t = +tol.get();
      var rows = [[_t("calc.da.ad"), num(d.ad, 4) + " ×", num(20 * Math.log10(Math.abs(d.ad)), 3) + " dB"], [_t("calc.da.acm"), num(d.acm, 3), isFinite(d.cmrr) ? "CMRR " + num(d.cmrr, 3) + " dB" : _t("calc.da.idealny")],
        [_t("calc.da.cmrrTol", { t: num(t * 100, 2) }), num(cmrrTol(d.ad, t), 3) + " dB", _t("calc.da.najgorszy")]];
      if (isFinite(v1) && isFinite(v2)) { rows.unshift([_t("calc.op.vout"), fmt(d.vout, "V", 4), _t("calc.da.roznica", { d: fmt(v2 - v1, "V", 3) })]); satWarn(ws, d.vout, sp.rails()); }
      rows.push([_t("calc.da.zin1"), fmt(d.zin1, "Ω", 3)], [_t("calc.da.zin2"), fmt(d.zin2, "Ω", 3)]);
      if (!m && Math.abs(r4 / r3 - r2 / r1) / (r2 / r1) > 0.001) ws.push(["warn", _t("calc.da.niedopasowane")]);
      if (Math.abs(r1 - r3) / r1 > 0.001 || d.zin1 !== d.zin2) ws.push(["info", _t("calc.da.impedancje")]);
      if (sp.single() && isFinite(d.vout) && d.vout < 0) ws.push(["warn", _t("calc.da.ujemne")]);
      res.show(rows); w.show(ws);
      copyText = _t("calc.da.t") + ": R1 " + fmt(r1, "Ω") + ", R2 " + fmt(r2, "Ω") + ", R3 " + fmt(r3, "Ω") + ", R4 " + fmt(r4, "Ω") + " → Ad = " + num(d.ad, 4) + (isFinite(v1) && isFinite(v2) ? ", Vout = " + fmt(d.vout, "V", 4) : "");
    });
  } });

  /* ───────── wzmacniacz sumujący ───────── */
  C.add({ id: "summer", icon: "plus", group: "analog", title: "calc.sm.t", desc: "calc.sm.d", mount: function (el, api) {
    var n = api.select({ key: "n", label: _t("calc.sm.wejscia"), def: "2", options: [["2", "2"], ["3", "3"], ["4", "4"]] });
    var Rf = api.field({ key: "rf", label: "Rf (" + _t("calc.op.sprzezenie") + ")", unit: "Ω", prefixes: ["", "k", "M"], defPrefix: "k", def: "10" });
    var ins = [1, 2, 3, 4].map(function (i) {
      return { v: api.field({ key: "v" + i, label: "V" + i, unit: "V", prefixes: ["m", ""], defPrefix: "", def: ["1", "0,5", "0,2", "0,1"][i - 1] }),
               r: api.field({ key: "r" + i, label: "R" + i, unit: "Ω", prefixes: ["", "k", "M"], defPrefix: "k", def: "10" }) };
    });
    var sp = supplyFields(api, { v: "12", sup: "dual" }), gbw = api.field({ key: "gbw", label: _t("calc.op.gbw"), unit: "Hz", prefixes: ["k", "M"], defPrefix: "M", def: "1" });
    var inBox = api.h("div", { "class": "calc-grid2" }), schBox = api.h("div", {});
    ins.forEach(function (x) { inBox.appendChild(x.v.el); inBox.appendChild(x.r.el); });
    var res = api.results(), w = api.warn(), copyText = "";
    el.appendChild(api.card([h4(api, "calc.dane"), api.h("div", { "class": "calc-split" }, [api.h("div", {}, [api.h("div", { "class": "calc-grid2" }, [n.el, Rf.el]), inBox,
      api.h("div", { "class": "calc-grid2" }, sp.els.concat([gbw.el]))]), schBox])]));
    el.appendChild(api.card([h4(api, "calc.wynik"), res.el, w.el, api.h("div", { "class": "calc-actions" }, [api.copy(function () { return copyText; })]),
      api.formula([["Vout = −Rf · (V1/R1 + V2/R2 + …)", ""], ["Vout = −(V1 + V2 + …) · Rf/R", _t("calc.sm.fRowne")], ["f(−3 dB) ≈ GBW / (1 + Rf · Σ 1/Ri)", ""]], _t("calc.sm.note"))]));
    function draw(N) {
      schBox.textContent = ""; var k = kit(api); k.amp();
      var top = 70 - (N - 1) * 16;                   // wejścia co 32 px, wyśrodkowane na węźle (−)
      for (var i = 0; i < N; i++) { var y = top + i * 32; k.wire([[-10, y], [30, y]]); k.res(30, y, 40, false, "R" + (i + 1), 50, y - 11); k.wire([[70, y], [100, y], [100, 70]]); k.txt(-14, y + 4, "V" + (i + 1), "calc-s-acc", "end"); }
      k.wire([[100, 70], [140, 70]]); k.dot(100, 70);
      k.wire([[110, 70], [110, 18], [160, 18]]); k.res(160, 18, 40, false, "Rf", 180, 9); k.wire([[200, 18], [240, 18], [240, 90]]); k.dot(240, 90);
      k.wire([[140, 110], [120, 110], [120, 140]]); k.gnd(120, 140);
      schBox.appendChild(k.svg(_t("calc.sm.t"), 165));
    }
    api.onChange(function () {
      var N = +n.get(), rf = Rf.get(), ws = [];
      ins.forEach(function (x, i) { x.v.el.hidden = x.r.el.hidden = i >= N; });
      draw(N);
      var list = ins.slice(0, N).map(function (x) { return { v: x.v.get(), r: x.r.get() }; });
      if (!(rf > 0) || list.some(function (x) { return !(x.r > 0) || !isFinite(x.v); })) { res.show([]); w.show([["info", _t("calc.sm.wpisz")]]); copyText = ""; return; }
      var s = summer(rf, list), rows = [[_t("calc.op.vout"), fmt(s.vout, "V", 4)]];
      list.forEach(function (x, i) { rows.push([_t("calc.sm.wzmWej", { n: i + 1 }), num(s.gains[i], 4) + " ×", _t("calc.sm.wklad", { v: fmt(x.v * s.gains[i], "V", 3) })]); });
      if (gbw.get() > 0) rows.push([_t("calc.op.pasmo"), fmt(gbw.get() / s.noise, "Hz", 3), _t("calc.op.pasmoX", { n: num(s.noise, 3) })]);
      satWarn(ws, s.vout, sp.rails());
      if (sp.single() && s.vout < 0) ws.push(["warn", _t("calc.sm.ujemne")]);
      if (list.every(function (x) { return Math.abs(x.r - rf) / rf < 1e-6; })) ws.push(["info", _t("calc.sm.rowneR")]);
      res.show(rows); w.show(ws);
      copyText = _t("calc.sm.t") + ": " + list.map(function (x, i) { return "V" + (i + 1) + " " + fmt(x.v, "V") + "/R" + (i + 1) + " " + fmt(x.r, "Ω"); }).join(", ") + ", Rf " + fmt(rf, "Ω") + " → Vout = " + fmt(s.vout, "V", 4);
    });
  } });

  /* ───────── komparator z histerezą (przerzutnik Schmitta) ───────── */
  function loopGraph(api, sc, VOH, VOL, inv) {      // pętla histerezy: Vout w funkcji Vin
    var S = api.svg, W = 340, H = 170, L = 44, Rm = 20, T = 14, B = 34, pw = W - L - Rm, ph = H - T - B, kids = [];
    var span = Math.max(sc.hyst, 0.1), x0 = sc.tl - span * 1.2, x1 = sc.th + span * 1.2;
    function X(v) { return L + (v - x0) / (x1 - x0) * pw; }
    function Y(v) { return T + (VOH - v) / (VOH - VOL || 1) * ph; }
    kids.push(S("line", { x1: L, x2: L + pw, y1: T + ph, y2: T + ph, "class": "calc-g-grid" }), S("line", { x1: L, x2: L, y1: T, y2: T + ph, "class": "calc-g-grid" }));
    [[VOH, "VOH"], [VOL, "VOL"]].forEach(function (p) { kids.push(S("text", { x: L - 6, y: Y(p[0]) + 4, "text-anchor": "end", "class": "calc-g-lbl", text: p[1] })); });
    [[sc.tl, "VTL"], [sc.th, "VTH"]].forEach(function (p) { kids.push(S("line", { x1: X(p[0]), x2: X(p[0]), y1: T, y2: T + ph, "class": "calc-g-ref" }), S("text", { x: X(p[0]), y: H - 18, "text-anchor": "middle", "class": "calc-g-acc", text: p[1] }), S("text", { x: X(p[0]), y: H - 5, "text-anchor": "middle", "class": "calc-g-lbl", text: fmt(p[0], "V", 3) })); });
    var lo = Y(VOL), hi = Y(VOH), xl = X(sc.tl), xh = X(sc.th);
    var R = L + pw, path = inv ? "M" + L + "," + hi + " H" + xh + " V" + lo + " M" + R + "," + lo + " H" + xl + " V" + hi      // wysoki → spada przy VTH; niski → rośnie przy VTL
                               : "M" + L + "," + lo + " H" + xh + " V" + hi + " M" + R + "," + hi + " H" + xl + " V" + lo;     // niski → rośnie przy VTH; wysoki → spada przy VTL
    kids.push(S("path", { d: path, "class": "calc-g-line" }));
    function arrow(x, y, up) { kids.push(S("polygon", { points: up ? (x - 5) + "," + (y + 5) + " " + (x + 5) + "," + (y + 5) + " " + x + "," + (y - 4) : (x - 5) + "," + (y - 5) + " " + (x + 5) + "," + (y - 5) + " " + x + "," + (y + 4), "class": "calc-g-dot" })); }
    var mid = (lo + hi) / 2;
    if (inv) { arrow(xh, mid, false); arrow(xl, mid, true); } else { arrow(xh, mid, true); arrow(xl, mid, false); }
    kids.push(S("text", { x: L + pw, y: T + ph + 14, "text-anchor": "end", "class": "calc-g-lbl", text: "Vin →" }));
    return S("svg", { viewBox: "0 0 " + W + " " + H, "class": "calc-graph", role: "img", "aria-label": _t("calc.sh.petla") }, kids);
  }
  C.add({ id: "schmitt", icon: "arrow-right-arrow-left", group: "analog", title: "calc.sh.t", desc: "calc.sh.d", mount: function (el, api) {
    var mode = api.modes({ key: "mode", items: [["calc", _t("calc.sh.trybLicz")], ["pick", _t("calc.sh.trybDobierz")]] });
    var type = api.select({ key: "type", label: _t("calc.op.uklad"), def: "noninv", options: [["noninv", _t("calc.op.nieodwr")], ["inv", _t("calc.op.odwr")]] });
    var R1 = api.field({ key: "r1", label: "R1", unit: "Ω", prefixes: ["", "k", "M"], defPrefix: "k", def: "10" });
    var R2 = api.field({ key: "r2", label: "R2 (" + _t("calc.op.sprzezenie") + ")", unit: "Ω", prefixes: ["", "k", "M"], defPrefix: "k", def: "100" });
    var Vref = api.field({ key: "vref", label: "Vref", unit: "V", prefixes: [""], def: "2,5" });
    var VTH = api.field({ key: "vth", label: _t("calc.sh.progGorny") + " VTH", unit: "V", prefixes: [""], def: "3" });
    var VTL = api.field({ key: "vtl", label: _t("calc.sh.progDolny") + " VTL", unit: "V", prefixes: [""], def: "2" });
    var VOH = api.field({ key: "voh", label: _t("calc.sh.voh"), unit: "V", prefixes: [""], def: "5", hint: _t("calc.sh.vohHint") });
    var VOL = api.field({ key: "vol", label: _t("calc.sh.vol"), unit: "V", prefixes: [""], def: "0" });
    var ser = api.select({ key: "ser", label: _t("calc.szereg"), def: "E24", options: [["E12", "E12"], ["E24", "E24"], ["E96", "E96"]] });
    var calcBox = api.h("div", { "class": "calc-grid2" }, [R1.el, R2.el, Vref.el]), pickBox = api.h("div", { "class": "calc-grid2" }, [VTH.el, VTL.el, ser.el]);
    var schBox = api.h("div", {}), plot = api.h("div", {}), res = api.results(), w = api.warn(), table = api.h("div", { "class": "calc-pick" }), copyText = "";
    el.appendChild(mode.el);
    el.appendChild(api.card([h4(api, "calc.dane"), api.h("div", { "class": "calc-split" }, [api.h("div", {}, [api.h("div", { "class": "calc-grid2" }, [type.el]), calcBox, pickBox,
      api.h("div", { "class": "calc-grid2" }, [VOH.el, VOL.el])]), schBox])]));
    var fbox = api.h("div", {});
    el.appendChild(api.card([h4(api, "calc.wynik"), plot, res.el, table, w.el, api.h("div", { "class": "calc-actions" }, [api.copy(function () { return copyText; })]), fbox]));
    mode.on(function (m) { calcBox.hidden = m !== "calc"; pickBox.hidden = m !== "pick"; table.hidden = m !== "pick"; api.refresh(); });
    function draw(t) {
      schBox.textContent = ""; var k = kit(api); k.amp();
      if (t === "inv") {
        k.wire([[-10, 70], [140, 70]]); k.txt(-14, 74, "Vin", "calc-s-acc", "end");
        k.wire([[-10, 110], [40, 110]]); k.res(40, 110, 44, false, "R1", 62, 99); k.wire([[84, 110], [140, 110]]); k.txt(-14, 114, "Vref", "calc-s-acc", "end");
        k.wire([[110, 110], [110, 150], [160, 150]]); k.res(160, 150, 40, false, "R2", 180, 141); k.wire([[200, 150], [240, 150], [240, 90]]); k.dot(110, 110); k.dot(240, 90);
      } else {
        k.wire([[-10, 110], [40, 110]]); k.res(40, 110, 44, false, "R1", 62, 99); k.wire([[84, 110], [140, 110]]); k.txt(-14, 114, "Vin", "calc-s-acc", "end");
        k.wire([[110, 110], [110, 150], [160, 150]]); k.res(160, 150, 40, false, "R2", 180, 141); k.wire([[200, 150], [240, 150], [240, 90]]); k.dot(110, 110); k.dot(240, 90);
        k.wire([[-10, 70], [140, 70]]); k.txt(-14, 74, "Vref", "calc-s-acc", "end");
      }
      schBox.appendChild(k.svg(_t("calc.sh.t"), 170));
    }
    api.onChange(function () {
      var t = type.get(), voh = VOH.get(), vol = VOL.get(), ws = [], r1, r2, vref;
      draw(t); plot.textContent = ""; table.textContent = ""; fbox.textContent = "";
      fbox.appendChild(api.formula(t === "inv"
        ? [["VTH = (Vref·R2 + VOH·R1) / (R1 + R2)", ""], ["VTL = (Vref·R2 + VOL·R1) / (R1 + R2)", ""], ["H = (VOH − VOL) · R1 / (R1 + R2)", _t("calc.sh.fH")]]
        : [["VTH = (Vref·(R1 + R2) − VOL·R1) / R2", ""], ["VTL = (Vref·(R1 + R2) − VOH·R1) / R2", ""], ["H = (VOH − VOL) · R1 / R2", _t("calc.sh.fH")]], _t("calc.sh.note")));
      if (!isFinite(voh) || !isFinite(vol) || voh <= vol) { res.show([]); w.show([["info", _t("calc.sh.wpiszWy")]]); copyText = ""; return; }
      if (mode.get() === "pick") {
        var th = VTH.get(), tl = VTL.get(), pk = schmittPick(t, th, tl, voh, vol);
        if (!pk) { res.show([]); w.show([["bad", _t("calc.sh.zlyProgi")]]); copyText = ""; return; }
        var list = pickRatio(pk.ratio, ser.get(), 1e3, 1e6, 5);
        if (!list.length) { res.show([]); w.show([["warn", _t("calc.op.brak")]]); copyText = ""; return; }
        var tb = api.h("table", { "class": "calc-tbl" }), hd = api.h("tr", {});
        ["R1", "R2", "VTH", "VTL", ""].forEach(function (x) { hd.appendChild(api.h("th", { text: x })); });
        tb.appendChild(api.h("thead", {}, [hd])); var bd = api.h("tbody", {});
        list.forEach(function (p, i) { var s = schmitt(t, p.r1, p.r2, pk.vref, voh, vol);
          bd.appendChild(api.h("tr", { "class": i === 0 ? "calc-best" : "" }, [api.h("td", { text: fmt(p.r1, "Ω") }), api.h("td", { text: fmt(p.r2, "Ω") }), api.h("td", { text: fmt(s.th, "V", 4) }), api.h("td", { text: fmt(s.tl, "V", 4) }),
            api.h("td", {}, [api.h("button", { type: "button", "class": "btn-action calc-use", text: _t("calc.div.uzyj"), onclick: function () { mode.el.querySelectorAll("button")[0].click(); R1.set(p.r1); R2.set(p.r2); Vref.set(pk.vref); api.refresh(); } })])])); });
        tb.appendChild(bd); table.appendChild(api.h("div", { "class": "calc-tbl-wrap" }, [tb]));
        r1 = list[0].r1; r2 = list[0].r2; vref = pk.vref;
        ws.push(["ok", _t("calc.sh.dobrano", { r1: fmt(r1, "Ω"), r2: fmt(r2, "Ω"), v: fmt(vref, "V", 4) })]);
        ws.push(["info", _t("calc.sh.vrefDzielnik")]);
      } else { r1 = R1.get(); r2 = R2.get(); vref = Vref.get(); }
      if (!(r1 > 0) || !(r2 > 0) || !isFinite(vref)) { res.show([]); w.show([["info", _t("calc.sh.wpisz")]]); copyText = ""; return; }
      var sc = schmitt(t, r1, r2, vref, voh, vol);
      plot.appendChild(loopGraph(api, sc, voh, vol, t === "inv"));
      res.show([[_t("calc.sh.progGorny") + " VTH", fmt(sc.th, "V", 4)], [_t("calc.sh.progDolny") + " VTL", fmt(sc.tl, "V", 4)], [_t("calc.sh.histereza"), fmt(sc.hyst, "V", 4)], [_t("calc.sh.srodek"), fmt(sc.center, "V", 4)]]);
      if (vref < vol || vref > voh) ws.push(["warn", _t("calc.sh.vrefPoza")]);
      if (sc.tl < vol - 0.3 || sc.th > voh + 0.3) ws.push(["warn", _t("calc.sh.progPoza")]);
      if (sc.hyst < 0.02) ws.push(["warn", _t("calc.sh.malaH")]);
      ws.push(["info", t === "inv" ? _t("calc.sh.dzialanieInv") : _t("calc.sh.dzialanieNon")]);
      ws.push(["info", _t("calc.sh.otwartyKolektor")]);
      w.show(ws);
      copyText = _t("calc.sh.t") + " (" + (t === "inv" ? _t("calc.op.odwr") : _t("calc.op.nieodwr")) + "): R1 " + fmt(r1, "Ω") + ", R2 " + fmt(r2, "Ω") + ", Vref " + fmt(vref, "V", 4) + " → VTH " + fmt(sc.th, "V", 4) + ", VTL " + fmt(sc.tl, "V", 4);
    });
  } });

})(window);
