/* ESN – Kalkulatory, paczka 3 (v53): czas pracy na baterii, regulator liniowy (straty, temperatura), szerokość ścieżki PCB (IPC-2221).
 * Obliczenia w ESNCalcPower (testy: tests/test_calc.py). */
(function (global) {
  "use strict";
  var C = global.ESNCalc; if (!C) return;
  var M = C.math, fmt = M.fmt, num = M.num, pct = M.pct;
  function _t(k, p) { return global.ESNI18n ? global.ESNI18n.t(k, p) : k; }

  /* ───────── obliczenia ───────── */
  /* średni prąd przy cyklu pracy: aktywność ta co okres T, reszta w uśpieniu */
  function battery(capAh, iAct, tAct, iSleep, period, derate) {
    if (!(capAh > 0) || !(period > 0) || tAct < 0 || tAct > period) return null;
    var avg = (iAct * tAct + iSleep * (period - tAct)) / period;
    if (!(avg > 0)) return null;
    var hours = capAh * (derate || 1) / avg;
    return { avg: avg, hours: hours, shareAct: iAct * tAct / (avg * period) };
  }
  function ldo(vin, vout, iload, iq, drop, rth, ta) {
    var p = (vin - vout) * iload + vin * (iq || 0);
    return { p: p, eff: vout * iload / (vin * (iload + (iq || 0))), tj: ta + p * rth, headroom: vin - vout - drop };
  }
  /* IPC-2221: I = k · ΔT^0,44 · A^0,725 (A w mil², k = 0,048 zewnętrzna, 0,024 wewnętrzna) */
  var OZ_UM = 34.79;                               // 1 oz/ft² ≈ 34,8 µm (1,37 mil)
  function trace(I, dT, oz, layer, lenM, tAmb) {
    var k = layer === "int" ? 0.024 : 0.048;
    var area = Math.pow(I / (k * Math.pow(dT, 0.44)), 1 / 0.725);    // mil²
    var tMil = oz * OZ_UM / 25.4, wMil = area / tMil, wMm = wMil * 0.0254;
    var out = { areaMil2: area, wMil: wMil, wMm: wMm, tUm: oz * OZ_UM };
    if (lenM > 0) {
      var rho = 1.72e-8 * (1 + 0.00393 * ((tAmb == null ? 25 : tAmb) + dT - 20));
      var r = rho * lenM / (wMm * 1e-3 * oz * OZ_UM * 1e-6);
      out.r = r; out.drop = r * I; out.p = r * I * I;
    }
    return out;
  }
  global.ESNCalcPower = { battery: battery, ldo: ldo, trace: trace };

  function h4(api, key) { return api.h("h4", { "class": "calc-h", text: _t(key) }); }
  function duration(hours) {                      // 1234 h → „51,4 dni” itd.
    if (!isFinite(hours)) return "—";
    if (hours < 1) return num(hours * 60, 3) + " min";
    if (hours < 48) return num(hours, 3) + " h";
    if (hours < 24 * 60) return _t("calc.bt.dni", { n: num(hours / 24, 3) });
    if (hours < 24 * 730) return _t("calc.bt.mies", { n: num(hours / 24 / 30.44, 3) });
    return _t("calc.bt.lat", { n: num(hours / 24 / 365.25, 3) });
  }

  /* ───────── 10. Czas pracy na baterii ───────── */
  var CELLS = [["cr2032", 0.22, "CR2032 – 220 mAh"], ["aa2", 2.5, "2× AA – 2500 mAh"], ["aaa2", 1.0, "2× AAA – 1000 mAh"],
    ["18650", 3.0, "Li-ion 18650 – 3000 mAh"], ["lipo1000", 1.0, "LiPo – 1000 mAh"], ["lipo500", 0.5, "LiPo – 500 mAh"]];
  C.add({ id: "battery", icon: "battery-half", group: "power", title: "calc.bt.t", desc: "calc.bt.d", mount: function (el, api) {
    var cell = api.select({ key: "cell", label: _t("calc.bt.ogniwo"), def: "aa2", options: [["", _t("calc.bt.wlasne")]].concat(CELLS.map(function (c) { return [c[0], c[2]]; })),
      onChange: function (v) { var c = CELLS.filter(function (x) { return x[0] === v; })[0]; if (c) cap.set(c[1]); } });
    var cap = api.field({ key: "cap", label: _t("calc.bt.pojemnosc"), unit: "Ah", prefixes: ["m", ""], defPrefix: "m", def: "2500", onInput: function () { cell.set(""); } });
    var ia = api.field({ key: "ia", label: _t("calc.bt.pradAkt"), unit: "A", prefixes: ["u", "m", ""], defPrefix: "m", def: "80", hint: _t("calc.bt.pradAktHint") });
    var ta = api.field({ key: "ta", label: _t("calc.bt.czasAkt"), unit: "s", prefixes: ["m", ""], defPrefix: "", def: "2" });
    var per = api.field({ key: "per", label: _t("calc.bt.okres"), unit: "s", prefixes: [""], def: "600", hint: _t("calc.bt.okresHint") });
    var is = api.field({ key: "is", label: _t("calc.bt.pradSen"), unit: "A", prefixes: ["u", "m"], defPrefix: "u", def: "20", hint: _t("calc.bt.pradSenHint") });
    var der = api.select({ key: "der", label: _t("calc.bt.zapas"), def: "0.8", options: [["1", "100 % – " + _t("calc.bt.idealnie")], ["0.85", "85 %"], ["0.8", "80 % – " + _t("calc.bt.typowo")], ["0.7", "70 % – " + _t("calc.bt.zimno")]] });
    var res = api.results(), w = api.warn(), bar = api.h("div", { "class": "calc-bt-bar" }), copyText = "";
    el.appendChild(api.card([h4(api, "calc.dane"), api.h("div", { "class": "calc-grid2" }, [cell.el, cap.el, ia.el, ta.el, per.el, is.el, der.el])]));
    el.appendChild(api.card([h4(api, "calc.wynik"), res.el, bar, w.el, api.h("div", { "class": "calc-actions" }, [api.copy(function () { return copyText; })]),
      api.formula([["Iśr = (Iakt · takt + Isen · (T − takt)) / T", ""], ["t = C · " + _t("calc.bt.wspZapasu") + " / Iśr", ""]], _t("calc.bt.note"))]));
    api.onChange(function () {
      var r = battery(cap.get(), ia.get(), ta.get(), is.get(), per.get(), +der.get()), ws = [];
      bar.textContent = "";
      if (!r) { res.show([]); w.show([["info", _t("calc.bt.wpisz")]]); copyText = ""; return; }
      res.show([[_t("calc.bt.sredni"), fmt(r.avg, "A", 3)], [_t("calc.bt.czas"), duration(r.hours), num(r.hours, 4) + " h"],
        [_t("calc.bt.cykl"), pct(ta.get() / per.get()).replace("+", ""), _t("calc.bt.udzialy", { a: num(r.shareAct * 100, 3), s: num((1 - r.shareAct) * 100, 3) })]]);
      var a = Math.max(2, r.shareAct * 100);
      bar.appendChild(api.h("span", { "class": "calc-bt-a", style: "width:" + Math.min(98, a) + "%", title: _t("calc.bt.aktywnosc") }));
      bar.appendChild(api.h("span", { "class": "calc-bt-s", style: "width:" + Math.max(2, 100 - Math.min(98, a)) + "%", title: _t("calc.bt.sen") }));
      if (r.shareAct > 0.8) ws.push(["info", _t("calc.bt.dominujeAkt")]);
      if (r.shareAct < 0.2) ws.push(["info", _t("calc.bt.dominujeSen")]);
      if (cell.get() === "cr2032" && ia.get() > 0.015) ws.push(["warn", _t("calc.bt.cr2032")]);
      if (r.hours > 24 * 365 * 5) ws.push(["info", _t("calc.bt.samorozladowanie")]);
      w.show(ws);
      copyText = _t("calc.bt.t") + ": " + fmt(cap.get(), "Ah") + ", Iśr " + fmt(r.avg, "A", 3) + " → " + duration(r.hours);
    });
  } });

  /* ───────── 11. Regulator liniowy ───────── */
  var REGS = [["ams1117", "AMS1117", 1.1, 0.005], ["lm7805", "LM7805 / 78xx", 2.0, 0.005], ["lm317", "LM317", 1.5, 0.005], ["mcp1700", "MCP1700", 0.18, 0.0000016], ["ht7333", "HT7333", 0.09, 0.000004], ["ap2112", "AP2112", 0.25, 0.000055]];
  var PKG = [["sot23", "SOT-23 / SOT-23-5 – 250 °C/W", 250], ["sot89", "SOT-89 – 150 °C/W", 150], ["sot223", "SOT-223 – 90 °C/W", 90], ["dpak", "DPAK (TO-252) – 70 °C/W", 70], ["to220", "TO-220 – 50 °C/W", 50], ["to220h", "TO-220 + ", 15]];
  C.add({ id: "ldo", icon: "temperature-half", group: "power", title: "calc.ld.t", desc: "calc.ld.d", mount: function (el, api) {
    var reg = api.select({ key: "reg", label: _t("calc.ld.uklad"), def: "ams1117", options: [["", _t("calc.ld.wlasny")]].concat(REGS.map(function (r) { return [r[0], r[1]]; })),
      onChange: function (v) { var r = REGS.filter(function (x) { return x[0] === v; })[0]; if (r) { drop.set(r[2]); iq.set(r[3]); } } });
    var vin = api.field({ key: "vin", label: _t("calc.ld.vin"), unit: "V", prefixes: [""], def: "5" });
    var vout = api.field({ key: "vout", label: _t("calc.ld.vout"), unit: "V", prefixes: [""], def: "3,3" });
    var il = api.field({ key: "il", label: _t("calc.ld.prad"), unit: "A", prefixes: ["m", ""], defPrefix: "m", def: "300" });
    var drop = api.field({ key: "drop", label: _t("calc.ld.dropout"), unit: "V", prefixes: [""], def: "1,1", onInput: function () { reg.set(""); } });
    var iq = api.field({ key: "iq", label: _t("calc.ld.iq"), unit: "A", prefixes: ["u", "m"], defPrefix: "m", def: "5", onInput: function () { reg.set(""); } });
    var pkg = api.select({ key: "pkg", label: _t("calc.ld.obudowa"), def: "sot223", options: PKG.map(function (p) { return [p[0], p[0] === "to220h" ? p[1] + _t("calc.ld.radiator") + " – 15 °C/W" : p[1]]; }), hint: _t("calc.ld.obudowaHint") });
    var tamb = api.field({ key: "ta", label: _t("calc.ld.tOtoczenia"), unit: "°C", prefixes: [""], def: "25" });
    var res = api.results(), w = api.warn(), copyText = "";
    el.appendChild(api.card([h4(api, "calc.dane"), api.h("div", { "class": "calc-grid2" }, [reg.el, pkg.el, vin.el, vout.el, il.el, drop.el, iq.el, tamb.el])]));
    el.appendChild(api.card([h4(api, "calc.wynik"), res.el, w.el, api.h("div", { "class": "calc-actions" }, [api.copy(function () { return copyText; })]),
      api.formula([["P = (Vin − Vout) · I + Vin · Iq", ""], ["η = Vout · I / (Vin · (I + Iq))", ""], ["Tj = Ta + P · RθJA", _t("calc.ld.fTj")]], _t("calc.ld.note"))]));
    api.onChange(function () {
      var Vi = vin.get(), Vo = vout.get(), I = il.get(), ws = [];
      if (!(Vi > 0) || !(Vo > 0) || !(I > 0)) { res.show([]); w.show([["info", _t("calc.ld.wpisz")]]); copyText = ""; return; }
      if (Vo >= Vi) { res.show([]); w.show([["bad", _t("calc.ld.vinZaMale")]]); copyText = ""; return; }
      var rth = (PKG.filter(function (p) { return p[0] === pkg.get(); })[0] || PKG[2])[2], Ta = tamb.empty() ? 25 : tamb.get();
      var r = ldo(Vi, Vo, I, iq.empty() ? 0 : iq.get(), drop.empty() ? 0 : drop.get(), rth, Ta);
      res.show([[_t("calc.ld.straty"), fmt(r.p, "W", 3)], [_t("calc.ld.sprawnosc"), num(r.eff * 100, 3) + " %"], [_t("calc.ld.tj"), num(r.tj, 3) + " °C", "RθJA " + rth + " °C/W"],
        [_t("calc.ld.zapas"), fmt(r.headroom, "V", 3)]]);
      if (r.headroom < 0) ws.push(["bad", _t("calc.ld.dropoutZly", { v: fmt(Vo + drop.get(), "V", 3) })]);
      else if (r.headroom < 0.2) ws.push(["warn", _t("calc.ld.dropoutMaly")]);
      ws.push(r.tj > 125 ? ["bad", _t("calc.ld.tjZla", { t: num(r.tj, 3) })] : r.tj > 100 ? ["warn", _t("calc.ld.tjUwaga", { t: num(r.tj, 3) })] : ["ok", _t("calc.ld.tjOk", { t: num(r.tj, 3) })]);
      if (r.eff < 0.5) ws.push(["info", _t("calc.ld.przetwornica")]);
      w.show(ws);
      copyText = _t("calc.ld.t") + ": " + fmt(Vi, "V") + " → " + fmt(Vo, "V") + ", " + fmt(I, "A") + ": P = " + fmt(r.p, "W", 3) + ", η = " + num(r.eff * 100, 3) + " %, Tj ≈ " + num(r.tj, 3) + " °C";
    });
  } });

  /* ───────── 12. Szerokość ścieżki PCB ───────── */
  C.add({ id: "trace", icon: "route", group: "power", title: "calc.tr.t", desc: "calc.tr.d", mount: function (el, api) {
    var I = api.field({ key: "i", label: _t("calc.prad"), unit: "A", prefixes: ["m", ""], defPrefix: "", def: "1" });
    var dT = api.select({ key: "dt", label: _t("calc.tr.dt"), def: "10", options: [["5", "5 °C"], ["10", "10 °C – " + _t("calc.typowo")], ["20", "20 °C"], ["30", "30 °C"], ["45", "45 °C"]] });
    var oz = api.select({ key: "oz", label: _t("calc.tr.miedz"), def: "1", options: [["0.5", "0,5 oz – 18 µm"], ["1", "1 oz – 35 µm (" + _t("calc.typowo") + ")"], ["2", "2 oz – 70 µm"], ["3", "3 oz – 105 µm"]] });
    var layer = api.select({ key: "layer", label: _t("calc.tr.warstwa"), def: "ext", options: [["ext", _t("calc.tr.zewn")], ["int", _t("calc.tr.wewn")]] });
    var len = api.field({ key: "len", label: _t("calc.tr.dlugosc"), unit: "m", prefixes: ["m"], def: "50", hint: _t("calc.tr.dlugoscHint") });
    var res = api.results(), w = api.warn(), copyText = "";
    el.appendChild(api.card([h4(api, "calc.dane"), api.h("div", { "class": "calc-grid2" }, [I.el, dT.el, oz.el, layer.el, len.el])]));
    el.appendChild(api.card([h4(api, "calc.wynik"), res.el, w.el, api.h("div", { "class": "calc-actions" }, [api.copy(function () { return copyText; })]),
      api.formula([["I = k · ΔT^0,44 · A^0,725", _t("calc.tr.fIpc")], ["w = A / t", _t("calc.tr.fW")], ["R = ρ · L / (w · t)", _t("calc.tr.fR")]], _t("calc.tr.note"))]));
    api.onChange(function () {
      var i = I.get(), ws = [];
      if (!(i > 0)) { res.show([]); w.show([["info", _t("calc.tr.wpisz")]]); copyText = ""; return; }
      var r = trace(i, +dT.get(), +oz.get(), layer.get(), len.empty() ? 0 : len.get(), 25);
      res.show([[_t("calc.tr.szer"), num(r.wMm, 3) + " mm", num(r.wMil, 3) + " mil"], [_t("calc.tr.przekroj"), num(r.areaMil2, 3) + " mil²", _t("calc.tr.grubosc", { t: num(r.tUm, 3) })],
        r.r != null ? [_t("calc.tr.rezyst"), fmt(r.r, "Ω", 3)] : null, r.r != null ? [_t("calc.tr.spadek"), fmt(r.drop, "V", 3), _t("calc.tr.strata", { p: fmt(r.p, "W", 3) })] : null]);
      if (r.wMm < 0.15) ws.push(["info", _t("calc.tr.minimum")]);
      if (layer.get() === "int") ws.push(["info", _t("calc.tr.wewnInfo")]);
      if (i > 10) ws.push(["warn", _t("calc.tr.duzyPrad")]);
      if (r.r != null && r.drop > 0.1) ws.push(["warn", _t("calc.tr.spadekDuzy", { v: fmt(r.drop, "V", 3) })]);
      w.show(ws);
      copyText = fmt(i, "A") + ", ΔT " + dT.get() + " °C, " + oz.get() + " oz: " + num(r.wMm, 3) + " mm (" + num(r.wMil, 3) + " mil)";
    });
  } });
})(window);
