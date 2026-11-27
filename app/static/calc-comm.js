/* ESN – Kalkulatory, paczka 2 (v52): UART / SPI / I²C (czas i przepustowość, błąd baud rate), Timer i PWM (preskaler, TOP), filtr RC.
 * Obliczenia w ESNCalcComm (testy: tests/test_calc.py). */
(function (global) {
  "use strict";
  var C = global.ESNCalc; if (!C) return;
  var M = C.math, fmt = M.fmt, num = M.num, pct = M.pct;
  function _t(k, p) { return global.ESNI18n ? global.ESNI18n.t(k, p) : k; }

  /* ───────── obliczenia ───────── */
  function uartFrame(data, parity, stop) { return 1 + data + (parity === "N" ? 0 : 1) + stop; }
  /* dzielnik baud rate: całkowity (AVR UBRR = f/(os·baud) − 1) i ułamkowy 1/16 (STM32 BRR) */
  function uartDiv(fclk, baud, os) {
    var ideal = fclk / (os * baud), ub = Math.max(0, Math.round(ideal) - 1), real = fclk / (os * (ub + 1));
    var frac = Math.round(fclk / baud * 16 / os) / 16 * os, realF = fclk / frac;   // USARTDIV z częścią ułamkową 4 bity
    return { ubrr: ub, real: real, err: (real - baud) / baud, div: fclk / baud / os, realFrac: realF, errFrac: (realF - baud) / baud };
  }
  var PRESC = { avr: [1, 8, 64, 256, 1024], avr2: [1, 8, 32, 64, 128, 256, 1024] };
  /* timer: dla każdego preskalera TOP = f/(psc·fout) − 1 w zakresie [1, 2^bits − 1]; najlepsza = najmniejszy błąd, potem największy TOP */
  function timer(fclk, fout, bits, family) {
    if (!(fclk > 0) || !(fout > 0)) return [];
    var maxTop = Math.pow(2, bits) - 1, list = [];
    var ps = family === "any" ? null : PRESC[family] || PRESC.avr;
    function tryP(p) {
      var top = Math.round(fclk / (p * fout)) - 1;
      if (top < 1 || top > maxTop) return;
      var real = fclk / (p * (top + 1));
      list.push({ psc: p, top: top, real: real, err: (real - fout) / fout, res: Math.log2(top + 1), tick: p / fclk });
    }
    if (ps) ps.forEach(tryP);
    else {                                         // dowolny preskaler 1…65536 (STM32): najmniejszy, przy którym TOP się mieści
      var p0 = Math.max(1, Math.ceil(fclk / (fout * (maxTop + 1))));
      for (var p = p0; p <= Math.min(65536, p0 + 64); p++) tryP(p);
    }
    return list.sort(function (a, b) { return Math.abs(a.err) - Math.abs(b.err) || b.top - a.top; });
  }
  function ledcBits(fout, src) { var b = Math.floor(Math.log2((src || 80e6) / fout)); return Math.max(0, Math.min(20, b)); }
  function rc(R, Cap) { var tau = R * Cap; return { tau: tau, fc: 1 / (2 * Math.PI * tau) }; }
  function rcAt(R, Cap, f, type) {               // |H|, dB i faza dla filtra 1. rzędu
    var x = 2 * Math.PI * f * R * Cap, mag = type === "hp" ? x / Math.sqrt(1 + x * x) : 1 / Math.sqrt(1 + x * x);
    return { mag: mag, db: 20 * Math.log10(mag), phase: (type === "hp" ? Math.atan(1 / x) : -Math.atan(x)) * 180 / Math.PI };
  }
  global.ESNCalcComm = { uartFrame: uartFrame, uartDiv: uartDiv, timer: timer, ledcBits: ledcBits, rc: rc, rcAt: rcAt };

  function h4(api, key) { return api.h("h4", { "class": "calc-h", text: _t(key) }); }
  function us(t) { return fmt(t, "s", 3); }

  /* schemat filtra RC 1. rzędu: dolnoprzepustowy (R w linii, C do masy) albo górnoprzepustowy (C w linii, R do masy) */
  function rcSchem(api, type) {
    var S = api.svg, k = [];
    function wire(p) { return S("polyline", { points: p.map(function (x) { return x.join(","); }).join(" "), "class": "calc-s-wire" }); }
    function R(x, y, vert) { return vert ? S("rect", { x: x - 7, y: y, width: 14, height: 36, rx: 2, "class": "calc-s-part" }) : S("rect", { x: x, y: y - 7, width: 44, height: 14, rx: 2, "class": "calc-s-part" }); }
    function Cap(x, y, vert) { return vert ? S("g", {}, [S("line", { x1: x - 13, y1: y, x2: x + 13, y2: y, "class": "calc-s-wire calc-s-plate" }), S("line", { x1: x - 13, y1: y + 7, x2: x + 13, y2: y + 7, "class": "calc-s-wire calc-s-plate" })])
      : S("g", {}, [S("line", { x1: x, y1: y - 13, x2: x, y2: y + 13, "class": "calc-s-wire calc-s-plate" }), S("line", { x1: x + 7, y1: y - 13, x2: x + 7, y2: y + 13, "class": "calc-s-wire calc-s-plate" })]); }
    function T(x, y, t, a, c) { return S("text", { x: x, y: y, "text-anchor": a || "middle", "class": c || "calc-s-lbl", text: t }); }
    var y = 40;
    if (type === "hp") { k.push(wire([[20, y], [96, y]]), Cap(96, y, false), wire([[103, y], [250, y]]), T(100, y - 20, "C")); k.push(wire([[170, y], [170, 62]]), R(170, 62, true), wire([[170, 98], [170, 110]]), T(190, 84, "R", "start")); }
    else { k.push(wire([[20, y], [80, y]]), R(80, y, false), wire([[124, y], [250, y]]), T(102, y - 14, "R")); k.push(wire([[170, y], [170, 76]]), Cap(170, 76, true), wire([[170, 83], [170, 110]]), T(190, 84, "C", "start")); }
    [[14, 0], [9, 5], [4, 10]].forEach(function (d) { k.push(wire([[170 - d[0], 110 + d[1]], [170 + d[0], 110 + d[1]]])); });
    k.push(S("circle", { cx: 170, cy: y, r: 3, "class": "calc-s-dot" }), T(14, y + 4, "Vin", "end", "calc-s-acc"), T(256, y + 4, "Vout", "start", "calc-s-acc"));
    return S("svg", { viewBox: "-30 0 330 130", "class": "calc-schem", role: "img", "aria-label": type === "hp" ? _t("calc.rf.gorno") : _t("calc.rf.dolno") }, k);
  }
  /* wykres Bodego (amplituda w dB, oś częstotliwości logarytmiczna, fc/100 … fc·100) */
  function bode(api, fc, type, fsig) {
    var S = api.svg, W = 360, H = 190, L = 44, Rm = 28, Tp = 12, B = 30, pw = W - L - Rm, ph = H - Tp - B, k = [];
    var f0 = fc / 100, f1 = fc * 100, dbMin = -45, dbMax = 5;
    function X(f) { return L + (Math.log10(f) - Math.log10(f0)) / (Math.log10(f1) - Math.log10(f0)) * pw; }
    function Y(db) { return Tp + (dbMax - Math.max(dbMin, Math.min(dbMax, db))) / (dbMax - dbMin) * ph; }
    function mag(f) { var x = f / fc; return 20 * Math.log10(type === "hp" ? x / Math.sqrt(1 + x * x) : 1 / Math.sqrt(1 + x * x)); }
    [0, -10, -20, -30, -40].forEach(function (d) { k.push(S("line", { x1: L, x2: L + pw, y1: Y(d), y2: Y(d), "class": "calc-g-grid" }), S("text", { x: L - 6, y: Y(d) + 4, "text-anchor": "end", "class": "calc-g-lbl", text: d + " dB" })); });
    for (var e = -2; e <= 2; e++) { var f = fc * Math.pow(10, e); k.push(S("line", { x1: X(f), x2: X(f), y1: Tp, y2: Tp + ph, "class": "calc-g-grid" }), S("text", { x: X(f), y: H - 12, "text-anchor": "middle", "class": "calc-g-lbl", text: fmt(f, "Hz", 2) })); }
    var pts = []; for (var i = 0; i <= 120; i++) { var ff = f0 * Math.pow(f1 / f0, i / 120); pts.push(X(ff).toFixed(1) + "," + Y(mag(ff)).toFixed(1)); }
    k.push(S("line", { x1: L, x2: L + pw, y1: Y(-3), y2: Y(-3), "class": "calc-g-ref" }), S("line", { x1: X(fc), x2: X(fc), y1: Tp, y2: Tp + ph, "class": "calc-g-ref" }));
    k.push(S("polyline", { points: pts.join(" "), "class": "calc-g-line" }));
    k.push(S("circle", { cx: X(fc), cy: Y(-3), r: 4, "class": "calc-g-dot" }), S("text", { x: X(fc) + 6, y: Y(-3) - 6, "class": "calc-g-acc", text: "fc, −3 dB" }));
    if (fsig > 0 && fsig >= f0 && fsig <= f1) { k.push(S("line", { x1: X(fsig), x2: X(fsig), y1: Tp, y2: Tp + ph, "class": "calc-g-sig" }), S("circle", { cx: X(fsig), cy: Y(mag(fsig)), r: 4, "class": "calc-g-sigdot" })); }
    k.push(S("text", { x: L + pw / 2, y: H - 1, "text-anchor": "middle", "class": "calc-g-lbl", text: _t("calc.rf.osF") }));
    return S("svg", { viewBox: "0 0 " + W + " " + H, "class": "calc-graph", role: "img", "aria-label": _t("calc.rf.wykres") }, k);
  }

  /* ───────── 7. UART / SPI / I²C ───────── */
  var BAUDS = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 250000, 460800, 500000, 921600, 1000000];
  C.add({ id: "baud", icon: "gauge-high", group: "comm", title: "calc.bd.t", desc: "calc.bd.d", mount: function (el, api) {
    var mode = api.modes({ key: "mode", items: [["uart", "UART"], ["spi", "SPI"], ["i2c", "I²C"]] });
    var baud = api.field({ key: "baud", label: _t("calc.bd.baud"), unit: "bd", prefixes: [""], def: "115200", onInput: function () { preset.set(""); } });
    var preset = api.select({ key: "bpre", label: _t("calc.bd.typowe"), def: "115200", options: [["", "—"]].concat(BAUDS.map(function (b) { return [String(b), String(b)]; })),
      onChange: function (v) { if (v) baud.set(+v); } });
    var data = api.select({ key: "data", label: _t("calc.bd.bityDanych"), def: "8", options: [["5", "5"], ["6", "6"], ["7", "7"], ["8", "8"], ["9", "9"]] });
    var par = api.select({ key: "par", label: _t("calc.bd.parzystosc"), def: "N", options: [["N", _t("calc.bd.brak")], ["E", _t("calc.bd.parzysta")], ["O", _t("calc.bd.nieparzysta")]] });
    var stop = api.select({ key: "stop", label: _t("calc.bd.stop"), def: "1", options: [["1", "1"], ["1.5", "1,5"], ["2", "2"]] });
    var clk = api.field({ key: "clk", label: _t("calc.bd.zegar"), unit: "Hz", prefixes: ["k", "M"], defPrefix: "M", def: "16", hint: _t("calc.bd.zegarHint") });
    var os = api.select({ key: "os", label: _t("calc.bd.nadprobkowanie"), def: "16", options: [["16", "16× (" + _t("calc.bd.normalny") + ")"], ["8", "8× (" + _t("calc.bd.podwojony") + ")"]] });
    var bytes = api.field({ key: "bytes", label: _t("calc.bd.bajty"), unit: "B", prefixes: ["", "k"], defPrefix: "", def: "64" });
    var sclk = api.field({ key: "sclk", label: _t("calc.bd.sclk"), unit: "Hz", prefixes: ["k", "M"], defPrefix: "M", def: "8" });
    var i2c = api.select({ key: "i2c", label: _t("calc.bd.i2cTryb"), def: "400000", options: [["100000", "Standard – 100 kHz"], ["400000", "Fast – 400 kHz"], ["1000000", "Fast-mode Plus – 1 MHz"], ["3400000", "High-speed – 3,4 MHz"]] });
    var uartBox = api.h("div", { "class": "calc-grid2" }, [baud.el, preset.el, data.el, par.el, stop.el, clk.el, os.el]);
    var spiBox = api.h("div", { "class": "calc-grid2" }, [sclk.el]), i2cBox = api.h("div", { "class": "calc-grid2" }, [i2c.el]);
    var res = api.results(), w = api.warn(), copyText = "";
    el.appendChild(mode.el);
    el.appendChild(api.card([h4(api, "calc.dane"), uartBox, spiBox, i2cBox, api.h("div", { "class": "calc-grid2" }, [bytes.el])]));
    var fbox = api.h("div", {});
    el.appendChild(api.card([h4(api, "calc.wynik"), res.el, w.el, api.h("div", { "class": "calc-actions" }, [api.copy(function () { return copyText; })]), fbox]));
    mode.on(function (m) { uartBox.hidden = m !== "uart"; spiBox.hidden = m !== "spi"; i2cBox.hidden = m !== "i2c"; api.refresh(); });
    api.onChange(function () {
      var m = mode.get(), N = Math.max(0, Math.round(bytes.get())), ws = [], rows;
      fbox.textContent = "";
      if (m === "uart") {
        var B = baud.get(), fr = uartFrame(+data.get(), par.get(), +stop.get());
        if (!(B > 0)) { res.show([]); w.show([["info", _t("calc.bd.wpisz")]]); copyText = ""; return; }
        var tb = 1 / B, tf = fr * tb, bps = B / fr;
        rows = [[_t("calc.bd.czasBitu"), us(tb)], [_t("calc.bd.ramka"), _t("calc.bd.bitow", { n: num(fr, 3) }), data.get() + par.get() + stop.get().replace(".", ",")], [_t("calc.bd.czasRamki"), us(tf)],
          [_t("calc.bd.przepustowosc"), num(bps, 4) + " B/s", fmt(bps * 8 * +data.get() / 8, "bit/s", 3) + " " + _t("calc.bd.danych")], N > 0 ? [_t("calc.bd.czasN", { n: N }), us(N * tf)] : null];
        var F = clk.get();
        if (F > 0) {
          var d = uartDiv(F, B, +os.get());
          rows.push([_t("calc.bd.ubrr"), String(d.ubrr), _t("calc.bd.rzecz", { b: num(d.real, 6) }) + " · " + pct(d.err)]);
          rows.push([_t("calc.bd.brr"), num(d.div, 5), _t("calc.bd.rzecz", { b: num(d.realFrac, 6) }) + " · " + pct(d.errFrac)]);
          var e = Math.abs(d.err);
          ws.push([e <= 0.01 ? "ok" : e <= 0.02 ? "warn" : "bad", e <= 0.01 ? _t("calc.bd.bladOk", { e: pct(d.err) }) : e <= 0.02 ? _t("calc.bd.bladUwaga", { e: pct(d.err) }) : _t("calc.bd.bladZly", { e: pct(d.err) })]);
          if (e > 0.02 && Math.abs(d.errFrac) <= 0.01) ws.push(["info", _t("calc.bd.ulamkowy")]);
        }
        copyText = "UART " + B + " " + data.get() + par.get() + stop.get() + ": " + us(tf) + "/" + _t("calc.bd.bajt") + ", " + num(bps, 4) + " B/s";
        fbox.appendChild(api.formula([[_t("calc.bd.fRamka"), ""], ["t(bajt) = " + _t("calc.bd.bity") + " / baud", ""], ["UBRR = f / (16 · baud) − 1", _t("calc.bd.fUbrr")], ["BRR = f / baud", _t("calc.bd.fBrr")]], _t("calc.bd.note")));
      } else if (m === "spi") {
        var S = sclk.get();
        if (!(S > 0)) { res.show([]); w.show([["info", _t("calc.bd.wpiszZegar")]]); copyText = ""; return; }
        rows = [[_t("calc.bd.czasBitu"), us(1 / S)], [_t("calc.bd.czasBajtu"), us(8 / S)], [_t("calc.bd.przepustowosc"), fmt(S / 8, "B/s", 3), _t("calc.bd.teoretyczna")], N > 0 ? [_t("calc.bd.czasN", { n: N }), us(N * 8 / S)] : null];
        ws.push(["info", _t("calc.bd.spiInfo")]);
        copyText = "SPI " + fmt(S, "Hz") + ": " + (N > 0 ? N + " B = " + us(N * 8 / S) : fmt(S / 8, "B/s"));
        fbox.appendChild(api.formula([["t = 8 · N / SCLK", ""]], _t("calc.bd.noteSpi")));
      } else {
        var I = +i2c.get(), bits = 9 * (N + 1) + 2;   // adres + N bajtów, każdy z bitem ACK, plus START/STOP
        rows = [[_t("calc.bd.czasBitu"), us(1 / I)], [_t("calc.bd.czasBajtu"), us(9 / I), _t("calc.bd.zAck")], N > 0 ? [_t("calc.bd.czasN", { n: N }), us(bits / I), _t("calc.bd.zAdresem")] : null,
          [_t("calc.bd.przepustowosc"), fmt(I / 9, "B/s", 3), _t("calc.bd.teoretyczna")]];
        ws.push(["info", _t("calc.bd.i2cInfo")]);
        copyText = "I²C " + fmt(I, "Hz") + ": " + (N > 0 ? N + " B ≈ " + us(bits / I) : fmt(I / 9, "B/s"));
        fbox.appendChild(api.formula([["t ≈ (9 · (N + 1) + 2) / SCL", _t("calc.bd.fI2c")]], _t("calc.bd.noteI2c")));
      }
      res.show(rows); w.show(ws);
    });
  } });

  /* ───────── 8. Timer i PWM ───────── */
  C.add({ id: "timer", icon: "stopwatch", group: "comm", title: "calc.tm.t", desc: "calc.tm.d", mount: function (el, api) {
    var clk = api.field({ key: "clk", label: _t("calc.tm.zegar"), unit: "Hz", prefixes: ["k", "M"], defPrefix: "M", def: "16" });
    var fout = api.field({ key: "fout", label: _t("calc.tm.czest"), unit: "Hz", prefixes: ["", "k", "M"], defPrefix: "k", def: "1" });
    var bits = api.select({ key: "bits", label: _t("calc.tm.bity"), def: "16", options: [["8", "8 bit"], ["16", "16 bit"], ["32", "32 bit"]] });
    var fam = api.select({ key: "fam", label: _t("calc.tm.preskaler"), def: "avr", options: [["avr", "AVR Timer0/1 – 1, 8, 64, 256, 1024"], ["avr2", "AVR Timer2 – 1, 8, 32, 64, 128, 256, 1024"], ["any", _t("calc.tm.dowolny")]] });
    var duty = api.field({ key: "duty", label: _t("calc.tm.wypelnienie"), unit: "%", prefixes: [""], def: "25" });
    var res = api.results(), w = api.warn(), alt = api.h("div", { "class": "calc-pick" }), copyText = "";
    el.appendChild(api.card([h4(api, "calc.dane"), api.h("div", { "class": "calc-grid2" }, [clk.el, fout.el, bits.el, fam.el, duty.el])]));
    el.appendChild(api.card([h4(api, "calc.wynik"), res.el, alt, w.el, api.h("div", { "class": "calc-actions" }, [api.copy(function () { return copyText; })]),
      api.formula([["f = fclk / (PSC · (TOP + 1))", _t("calc.tm.fF")], ["TOP = fclk / (PSC · f) − 1", ""], ["CMP = (TOP + 1) · D − 1", _t("calc.tm.fCmp")], [_t("calc.tm.fRes"), ""]], _t("calc.tm.note"))]));
    api.onChange(function () {
      var F = clk.get(), f = fout.get(), B = +bits.get(), D = duty.get() / 100, ws = [];
      alt.textContent = "";
      if (!(F > 0) || !(f > 0)) { res.show([]); w.show([["info", _t("calc.tm.wpisz")]]); copyText = ""; return; }
      if (f > F / 2) { res.show([]); w.show([["bad", _t("calc.tm.zaDuza")]]); copyText = ""; return; }
      var list = timer(F, f, B, fam.get());
      if (!list.length) { res.show([]); w.show([["bad", _t("calc.tm.brak", { b: B })]]); copyText = ""; return; }
      var b = list[0], cmp = D >= 0 && D <= 1 ? Math.max(0, Math.round((b.top + 1) * D) - 1) : NaN;
      res.show([[_t("calc.tm.psc"), String(b.psc)], ["TOP (OCRnA / ARR)", String(b.top)], [_t("calc.tm.rzecz"), fmt(b.real, "Hz", 6), pct(b.err)],
        [_t("calc.tm.tick"), fmt(b.tick, "s", 3)], [_t("calc.tm.rozdz"), num(b.res, 3) + " bit", _t("calc.tm.krokow", { n: b.top + 1 })], isFinite(cmp) ? [_t("calc.tm.cmp", { d: num(D * 100, 3) }), String(cmp)] : null]);
      copyText = "fclk " + fmt(F, "Hz") + ", f " + fmt(f, "Hz") + ": PSC " + b.psc + ", TOP " + b.top + " → " + fmt(b.real, "Hz", 6) + " (" + pct(b.err) + ")";
      if (list.length > 1) {
        var tb = api.h("table", { "class": "calc-tbl" }), hd = api.h("tr", {});
        ["PSC", "TOP", "f", _t("calc.blad"), _t("calc.tm.rozdz")].forEach(function (x) { hd.appendChild(api.h("th", { text: x })); });
        tb.appendChild(api.h("thead", {}, [hd])); var bd = api.h("tbody", {});
        list.slice(0, 5).forEach(function (x, i) { bd.appendChild(api.h("tr", { "class": i === 0 ? "calc-best" : "" }, [api.h("td", { text: String(x.psc) }), api.h("td", { text: String(x.top) }), api.h("td", { text: fmt(x.real, "Hz", 5) }), api.h("td", { text: pct(x.err) }), api.h("td", { text: num(x.res, 3) + " bit" })])); });
        tb.appendChild(bd); alt.appendChild(api.h("div", { "class": "calc-tbl-wrap" }, [tb]));
      }
      if (Math.abs(b.err) > 0.01) ws.push(["warn", _t("calc.tm.bladDuzy", { e: pct(b.err) })]);
      if (b.res < 8) ws.push(["warn", _t("calc.tm.malaRozdz", { r: num(b.res, 3) })]);
      ws.push(["info", _t("calc.tm.esp32", { b: ledcBits(f) })]);
      w.show(ws);
    });
  } });

  /* ───────── 9. Filtr RC i stała czasowa ───────── */
  C.add({ id: "rc", icon: "wave-square", group: "comm", title: "calc.rf.t", desc: "calc.rf.d", mount: function (el, api) {
    var mode = api.modes({ key: "mode", items: [["calc", _t("calc.rf.trybLicz")], ["pickC", _t("calc.rf.trybC")]] });
    var type = api.select({ key: "type", label: _t("calc.rf.typ"), def: "lp", options: [["lp", _t("calc.rf.dolno")], ["hp", _t("calc.rf.gorno")]] });
    var R = api.field({ key: "R", label: _t("calc.rezystancja") + " R", unit: "Ω", prefixes: ["", "k", "M"], defPrefix: "k", def: "10" });
    var Cf = api.field({ key: "C", label: _t("calc.rf.poj") + " C", unit: "F", prefixes: ["p", "n", "u"], defPrefix: "n", def: "100" });
    var fc = api.field({ key: "fc", label: _t("calc.rf.fcCel"), unit: "Hz", prefixes: ["", "k", "M"], defPrefix: "k", def: "1" });
    var f = api.field({ key: "f", label: _t("calc.rf.fSyg"), unit: "Hz", prefixes: ["", "k", "M"], defPrefix: "k", def: "", hint: _t("calc.rf.fSygHint") });
    var ser = api.select({ key: "ser", label: _t("calc.szereg"), def: "E12", options: [["E6", "E6"], ["E12", "E12"], ["E24", "E24"]] });
    var calcBox = api.h("div", { "class": "calc-grid2" }, [Cf.el, f.el]), pickBox = api.h("div", { "class": "calc-grid2" }, [fc.el, ser.el]);
    var res = api.results(), w = api.warn(), copyText = "", schBox = api.h("div", { "class": "calc-rf-sch" }), plot = api.h("div", { "class": "calc-rf-plot" });
    el.appendChild(mode.el);
    el.appendChild(api.card([h4(api, "calc.dane"), api.h("div", { "class": "calc-split" }, [api.h("div", {}, [api.h("div", { "class": "calc-grid2" }, [type.el, R.el]), calcBox, pickBox]), schBox])]));
    el.appendChild(api.card([h4(api, "calc.wynik"), plot, res.el, w.el, api.h("div", { "class": "calc-actions" }, [api.copy(function () { return copyText; })]),
      api.formula([["τ = R · C", ""], ["fc = 1 / (2π · R · C)", _t("calc.rf.fFc")], ["U(t) = U · (1 − e^(−t/τ))", _t("calc.rf.fLad")], ["C = 1 / (2π · R · fc)", ""]], _t("calc.rf.note"))]));
    mode.on(function (m) { calcBox.hidden = m !== "calc"; pickBox.hidden = m !== "pickC"; api.refresh(); });
    api.onChange(function () {
      var r = R.get(), ws = [], c, rows = [];
      schBox.textContent = ""; schBox.appendChild(rcSchem(api, type.get())); plot.textContent = "";
      if (!(r > 0)) { res.show([]); w.show([["info", _t("calc.rf.wpisz")]]); copyText = ""; return; }
      if (mode.get() === "pickC") {
        var F0 = fc.get(); if (!(F0 > 0)) { res.show([]); w.show([["info", _t("calc.rf.wpisz")]]); copyText = ""; return; }
        var ideal = 1 / (2 * Math.PI * r * F0); c = M.nearest(ser.get(), ideal);
        rows.push([_t("calc.rf.cIdealne"), fmt(ideal, "F", 4)], [_t("calc.rf.cSzereg", { s: ser.get() }), fmt(c, "F", 3)]);
      } else c = Cf.get();
      if (!(c > 0)) { res.show([]); w.show([["info", _t("calc.rf.wpisz")]]); copyText = ""; return; }
      var x = rc(r, c);
      plot.appendChild(bode(api, x.fc, type.get(), mode.get() === "calc" ? f.get() : NaN));
      rows.push(["τ = R·C", fmt(x.tau, "s", 4)], [_t("calc.rf.fc"), fmt(x.fc, "Hz", 4), _t("calc.rf.minus3")],
        [_t("calc.rf.lad", { p: "63,2" }), fmt(x.tau, "s", 3), "1 τ"], [_t("calc.rf.lad", { p: "95" }), fmt(3 * x.tau, "s", 3), "3 τ"], [_t("calc.rf.lad", { p: "99,3" }), fmt(5 * x.tau, "s", 3), "5 τ"]);
      var fs = f.get();
      if (mode.get() === "calc" && fs > 0) {
        var a = rcAt(r, c, fs, type.get());
        rows.push([_t("calc.rf.przy", { f: fmt(fs, "Hz") }), num(a.db, 3) + " dB", _t("calc.rf.wzm", { m: num(a.mag, 3) }) + " · " + _t("calc.rf.faza", { p: num(a.phase, 3) })]);
      }
      if (mode.get() === "pickC") { var e = (x.fc - fc.get()) / fc.get(); ws.push([Math.abs(e) <= 0.05 ? "ok" : "warn", _t("calc.rf.fcRzecz", { f: fmt(x.fc, "Hz", 4), e: pct(e) })]); }
      if (r < 100) ws.push(["warn", _t("calc.rf.maleR")]);
      if (c >= 1e-6 && x.fc > 1e4) ws.push(["info", _t("calc.rf.ceramika")]);
      res.show(rows); w.show(ws);
      copyText = "RC: R = " + fmt(r, "Ω") + ", C = " + fmt(c, "F") + " → τ = " + fmt(x.tau, "s", 4) + ", fc = " + fmt(x.fc, "Hz", 4);
    });
  } });
})(window);
