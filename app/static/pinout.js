/* ESN Pinout – interaktywny opis wyprowadzeń i wyglądu podzespołu (v2).
 *
 * Układy rysunku (pinout.layout):
 *   quad   – obudowa czterostronna (QFN/QFP/LQFP)       dual – dwurzędowa (DIP/SOIC/TSSOP)
 *   sip    – jeden rząd (złącze, prosty moduł)          to92 / to220 – tranzystory, stabilizatory (widok z przodu)
 *   sot23  – małe SMD 3–8 pinów                         axial – dioda/rezystor/kondensator, 2 wyprowadzenia
 *   board  – płytka/moduł: uproszczony rysunek z kształtów (shapes) ALBO zdjęcie + numerowane punkty (x,y w %);
 *            zdjęcie jako tło tylko przy image_as_background: true
 *   none   – tylko tabela
 *
 * API:  ESNPinout.render(el, data, {title, image, onBoardClick})
 *       ESNPinout.mountSection(slot, data, {title, image, isAdmin, onEdit})
 *       ESNPinout.parseText(text) / ESNPinout.toText(obj)     (format edycyjny, patrz docs/PINOUT.md)
 * Cały tekst z danych trafia do DOM przez textContent – nigdy przez innerHTML.
 */
(function (global) {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var CATS = {
    power:   [_t('pn.zasilanie'), "#f0883e"],
    ground:  [_t('pn.masa'), "#9aa7b8"],
    analog:  [_t('pn.analogowe'), "#4cc3c9"],
    digital: [_t('pn.cyfroweIO'), "#5aa9ff"],
    spi:     ["SPI", "#8fd16a"],
    i2c:     ["I²C", "#e5879c"],
    i2s:     ["I²S", "#5fd4a8"],
    uart:    ["UART", "#d9a35f"],
    usb:     ["USB", "#a3a6ff"],
    can:     ["CAN", "#ffc4a3"],
    pwm:     [_t('pn.pwmTimery'), "#d8e06a"],
    debug:   [_t('pn.debugJtag'), "#ff9d9d"],
    rf:      [_t('pn.rfAntena'), "#7ee0ff"],
    clock:   [_t('pn.zegar'), "#c792ea"],
    control: [_t('pn.sterujaceStatus'), "#f2cc60"],
    nc:      [_t('pn.brakPolaczeniaPad'), "#7d8898"],
    other:   [_t('pn.inne'), "#b0b8c4"]
  };
  var LAYOUTS = ["quad", "dual", "sip", "to92", "to220", "sot23", "axial", "board", "none"];
  var SHAPE_KINDS = ["pcb", "chip", "conn", "btn", "led", "part"];
  var PAD_RE = /^(DAP|EP|PAD|TAB|EPAD)$/i;
  var uid = 0, svgPins;

  /* ── helpers ─────────────────────────────────────────────────────────── */
  function h(tag, props, kids) {
    var e = document.createElement(tag), k;
    for (k in (props || {})) {
      if (k === "class") e.className = props[k];
      else if (k === "text") e.textContent = props[k];
      else e.setAttribute(k, props[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function s(tag, props, parent) {
    var e = document.createElementNS(NS, tag), k;
    for (k in (props || {})) e.setAttribute(k, props[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function str(v) { return v == null ? "" : String(v).trim(); }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  function pct(v) { var n = num(v); return n === null ? null : Math.max(0, Math.min(100, n)); }
  function safeUrl(u) { return /^https?:\/\//i.test(u) ? u : ""; }
  function safeImg(u) { return /^(\/static\/|https?:\/\/|data:image\/(png|jpe?g|webp|gif|svg\+xml);)/i.test(u) ? u : ""; }
  function cat(c) { return CATS[c] ? c : "other"; }

  /* ── normalizacja danych ─────────────────────────────────────────────── */
  function guessLayout(pkg, n) {
    var p = str(pkg).toUpperCase();
    if (/TO-?92/.test(p)) return "to92";
    if (/TO-?220|TO-?252|DPAK/.test(p)) return "to220";
    if (/SOT-?23|SC-?70|SOT-?323/.test(p)) return "sot23";
    if (/QFN|QFP|LLP|BGA/.test(p) && n % 4 === 0) return "quad";
    if (/DIP|SOIC|SOP|SSOP|TSSOP|MSOP|SO-|PDIP/.test(p) && n % 2 === 0) return "dual";
    if (/DO-?\d|AXIAL|SOD|0805|0603|1206/.test(p) && n === 2) return "axial";
    if (/MODULE|MODUŁ|BOARD|PŁYTKA|DEVKIT/.test(p)) return "board";
    if (/SIP|HEADER|ZŁĄCZE/.test(p)) return "sip";
    return "none";
  }

  /* ── wersje językowe ─────────────────────────────────────────────────────
   * Dokument pinoutu: struktura (piny, układ, współrzędne) jest wspólna, tłumaczone są tylko teksty.
   *   lang: "pl"                       – język tekstów bazowych
   *   translations: { en: { view, notes, pins: {nr: {type, fn, note}}, groups: {nazwa bazowa: {name, note}}, shapes: {etykieta bazowa: etykieta} } }
   * resolve(doc, lang) → { doc (płaski, w danym języku; brakujące pola = oryginał), used, base, langs } */
  function docLangs(src) {
    var base = str(src && src.lang) || "pl", out = [base], tr = (src && src.translations) || {};
    Object.keys(tr).forEach(function (l) { if (l !== base && out.indexOf(l) < 0) out.push(l); });
    return out;
  }
  function resolve(src, lang) {
    var base = str(src && src.lang) || "pl", langs = docLangs(src), ov = src && src.translations && lang && lang !== base ? src.translations[lang] : null;
    if (!src || typeof src !== "object") return { doc: src, used: base, base: base, langs: langs };
    var d = JSON.parse(JSON.stringify(src));
    delete d.translations;
    d.lang = ov ? lang : base;
    if (ov && typeof ov === "object") {
      if (ov.view) d.view = ov.view;
      if (ov.notes) d.notes = ov.notes;
      var pins = ov.pins || {};
      (d.pins || []).forEach(function (p) { var o = pins[str(p.n)]; if (o) ["type", "fn", "note"].forEach(function (k) { if (o[k]) p[k] = o[k]; }); });
      var gs = ov.groups || {};
      (d.groups || []).forEach(function (g) { var o = gs[str(g.name)]; if (o) { if (o.name) g.name = o.name; if (o.note) g.note = o.note; } });
      var ss = ov.shapes || {};
      (d.shapes || []).forEach(function (x) { if (x && ss[str(x.label)]) x.label = ss[str(x.label)]; });
    }
    return { doc: d, used: ov ? lang : base, base: base, langs: langs };
  }

  function normalize(src) {
    var d = { pins: [], sources: [], shapes: [], groups: [], board: { aspect: 1.6, labels: null }, imageAsBackground: false,
              package: "", view: "", notes: "", layout: "none", warning: "" };
    if (!src || typeof src !== "object" || !Array.isArray(src.pins)) return d;
    d.package = str(src.package); d.view = str(src.view); d.notes = str(src.notes);
    d.pins = src.pins.map(function (p) {
      var n = str(p.n), name = str(p.name) || n;
      return { n: n, name: name, cat: cat(p.cat), type: str(p.type), fn: str(p.fn), note: str(p.note),
               pad: p.pad === true || PAD_RE.test(n), x: pct(p.x), y: pct(p.y) };
    }).filter(function (p) { return p.n || p.name; });
    d.sources = (Array.isArray(src.sources) ? src.sources : []).map(function (x) {
      return { label: str(x && x.label), url: safeUrl(str(x && x.url)) };
    }).filter(function (x) { return x.label || x.url; });

    d.imageAsBackground = src.image_as_background === true;   // zdjęcie komponentu jako tło trybu board (domyślnie: nie)
    var b = src.board || {};
    d.board.aspect = Math.max(0.4, Math.min(4, num(b.aspect) || 1.6));
    d.board.labels = b.labels === true || b.labels === false ? b.labels : null;
    d.shapes = (Array.isArray(src.shapes) ? src.shapes : []).map(function (x) {
      if (!x || ["rect", "circle", "text"].indexOf(x.t) < 0) return null;
      var o = { t: x.t, x: num(x.x), y: num(x.y), w: num(x.w), h: num(x.h), r: num(x.r), label: str(x.label),
                kind: SHAPE_KINDS.indexOf(x.kind) >= 0 ? x.kind : "part" };
      if (o.x === null || o.y === null) return null;
      if (o.t === "rect" && (o.w === null || o.h === null)) return null;
      if (o.t === "circle" && o.r === null) return null;
      return o;
    }).filter(Boolean).slice(0, 120);
    d.groups = (Array.isArray(src.groups) ? src.groups : []).map(function (x) {
      return { name: str(x && x.name), note: str(x && x.note),
               pins: (Array.isArray(x && x.pins) ? x.pins : []).map(str).filter(Boolean) };
    }).filter(function (x) { return x.name && x.pins.length; });

    var pos = d.pins.filter(function (p) { return !p.pad; }).length;
    var layout = LAYOUTS.indexOf(src.layout) >= 0 ? src.layout : guessLayout(d.package, pos);
    var bad = function (what) { d.warning = _t('pn.liczbaPinow') + pos + _t('pn.niePasujeDoUkladu') + what + _t('pn.pokazanoTylkoTabele'); layout = "none"; };
    if (layout === "quad" && (pos < 4 || pos % 4)) bad("quad");
    else if (layout === "dual" && (pos < 2 || pos % 2)) bad("dual");
    else if ((layout === "to92" || layout === "to220") && (pos < 2 || pos > 5)) bad(layout);
    else if (layout === "sot23" && (pos < 3 || pos > 8)) bad("sot23");
    else if (layout === "axial" && pos !== 2) bad("axial");
    else if (layout === "sip" && pos < 1) layout = "none";
    d.layout = layout;
    return d;
  }

  /* ── geometria rysunku ───────────────────────────────────────────────── */
  function geometry(layout, n, d) {
    var S = 34, T = 36, W = 20, PAD = 150, g = { kind: layout, pos: [], body: null, w: 0, h: 0, mark: null },
        i, k, off, per, c, bw, bh;
    if (layout === "quad") {
      per = n / 4;
      var body = Math.max(per * S + 22, 150);
      g.w = g.h = body + 2 * PAD; c = g.w / 2;
      g.body = { x: c - body / 2, y: c - body / 2, w: body, h: body };
      for (i = 0; i < n; i++) {
        var side = Math.floor(i / per); k = i % per; off = (k - (per - 1) / 2) * S;
        g.pos.push(side === 0 ? { s: "L", x: g.body.x - T, y: c + off - W / 2, w: T, h: W }
                 : side === 1 ? { s: "B", x: c + off - W / 2, y: g.body.y + body, w: W, h: T }
                 : side === 2 ? { s: "R", x: g.body.x + body, y: c - off - W / 2, w: T, h: W }
                 :              { s: "T", x: c - off - W / 2, y: g.body.y - T, w: W, h: T });
      }
      g.mark = { x: g.body.x + 18, y: g.body.y + 18 };
    } else if (layout === "dual") {
      per = n / 2; bh = Math.max(per * S + 22, 90); bw = 150;
      g.w = bw + 2 * PAD; g.h = bh + 80; c = g.h / 2;
      g.body = { x: PAD, y: 40, w: bw, h: bh };
      for (i = 0; i < n; i++) {
        k = i % per; off = (k - (per - 1) / 2) * S;
        g.pos.push(i < per ? { s: "L", x: PAD - T, y: c + off - W / 2, w: T, h: W }
                           : { s: "R", x: PAD + bw, y: c - off - W / 2, w: T, h: W });
      }
      g.mark = { x: g.body.x + 16, y: g.body.y + 16 };
    } else if (layout === "sip") {
      bh = Math.max(n * S + 22, 70); bw = 90;
      g.w = PAD + T + bw + 30; g.h = bh + 60; c = g.h / 2;
      g.body = { x: PAD + T, y: 30, w: bw, h: bh };
      for (i = 0; i < n; i++) g.pos.push({ s: "L", x: PAD, y: c + (i - (n - 1) / 2) * S - W / 2, w: T, h: W });
      g.mark = { x: g.body.x + 16, y: g.body.y + 16 };
    } else if (layout === "to92" || layout === "to220") {
      var cx = 150, hasTab = layout === "to220";
      bw = hasTab ? 150 : 120; bh = hasTab ? 120 : 130;
      var by = hasTab ? 100 : 40;
      g.w = 300; g.h = by + bh + T + 120;
      g.body = { x: cx - bw / 2, y: by, w: bw, h: bh };
      for (i = 0; i < n; i++) g.pos.push({ s: "B", x: cx + (i - (n - 1) / 2) * S - W / 2, y: by + bh, w: W, h: T });
    } else if (layout === "sot23") {
      var b = n === 3 ? 2 : Math.ceil(n / 2), t = n - b, S2 = 44;
      bw = Math.max(Math.max(b, t) * S2 + 40, 140); bh = 70;
      g.w = Math.max(300, bw + 120); g.h = 2 * (T + 120) + bh; c = g.w / 2;
      g.body = { x: c - bw / 2, y: T + 120, w: bw, h: bh };
      for (i = 0; i < b; i++) g.pos.push({ s: "B", x: c + (i - (b - 1) / 2) * S2 - W / 2, y: g.body.y + bh, w: W, h: T });
      for (i = 0; i < t; i++) g.pos.push({ s: "T", x: c - (i - (t - 1) / 2) * S2 - W / 2, y: g.body.y - T, w: W, h: T });
      g.mark = { x: g.body.x + 16, y: g.body.y + bh - 16 };
    } else if (layout === "axial") {
      var L = 70, A = 16;
      bw = 140; bh = 56; g.w = bw + 2 * L + 60; g.h = 170; c = g.h / 2;
      g.body = { x: 30 + L, y: c - bh / 2, w: bw, h: bh };
      g.pos.push({ s: "L", x: 30, y: c - A / 2, w: L, h: A, above: true });
      g.pos.push({ s: "R", x: g.body.x + bw, y: c - A / 2, w: L, h: A, above: true });
    } else if (layout === "board") {
      g.w = 800; g.h = Math.round(800 / d.board.aspect);
      g.body = { x: 0, y: 0, w: g.w, h: g.h };
    }
    return g;
  }

  /* ── SVG: korpusy ────────────────────────────────────────────────────── */
  function pinGroup(svg, p, idx, onPin) {
    var g = s("g", { "class": "po-pin", tabindex: 0, role: "button",
      "aria-label": _t('pn.pin') + " " + p.n + " " + p.name + ", " + CATS[p.cat][0], "data-i": idx }, svg);
    g.style.setProperty("--c", CATS[p.cat][1]);
    svgPins[idx] = g;
    onPin(g, idx);
    return g;
  }

  function drawBoard(svg, d, g, opts, onPin) {
    var b = g.body, useImg = !!opts.image, t;
    if (useImg) {
      s("image", { href: opts.image, x: 0, y: 0, width: b.w, height: b.h, preserveAspectRatio: "xMidYMid slice" }, svg);
    } else {
      s("rect", { "class": "po-pcb", x: 2, y: 2, width: b.w - 4, height: b.h - 4, rx: 16 }, svg);
      d.shapes.forEach(function (sh) {
        var cls = "po-sh po-sh-" + sh.kind, X = sh.x / 100 * b.w, Y = sh.y / 100 * b.h, lx, ly;
        if (sh.t === "rect") {
          var w = sh.w / 100 * b.w, hh = sh.h / 100 * b.h;
          s("rect", { "class": cls, x: X, y: Y, width: w, height: hh, rx: 6 }, svg);
          lx = X + w / 2; ly = Y + hh / 2 + 4;
        } else if (sh.t === "circle") {
          var r = sh.r / 100 * b.w;
          s("circle", { "class": cls, cx: X, cy: Y, r: r }, svg);
          lx = X; ly = Y + r + 14;
        } else { lx = X; ly = Y; }
        if (sh.label) { t = s("text", { x: lx, y: ly, "text-anchor": "middle", "class": "po-sh-lbl" }, svg); t.textContent = sh.label; }
      });
    }
    var showLabels = d.board.labels === null ? !useImg : d.board.labels;
    d.pins.forEach(function (p, idx) {
      if (p.x === null || p.y === null) return;
      var cx = p.x / 100 * b.w, cy = p.y / 100 * b.h, grp = pinGroup(svg, p, idx, onPin);
      s("circle", { cx: cx, cy: cy, r: 14 }, grp);
      t = s("text", { x: cx, y: cy + 4, "text-anchor": "middle", "class": "po-num" }, grp);
      t.textContent = (p.n || "").slice(0, 3);
      if (showLabels) {
        var right = cx < b.w * 0.82;
        t = s("text", { x: right ? cx + 20 : cx - 20, y: cy + 4, "text-anchor": right ? "start" : "end", "class": "po-bl" }, grp);
        t.textContent = p.name;
      }
    });
  }

  function drawChip(svg, d, g, opts, onPin) {
    var b = g.body, kind = g.kind, cx = b.x + b.w / 2, cy = b.y + b.h / 2, t;
    var padOk = kind === "quad" || kind === "dual" || kind === "sip";
    var pads = [], posIdx = [];
    d.pins.forEach(function (p, i) { if (!p.pad) posIdx.push(i); else if (padOk) pads.push(i); });
    var hasPad = pads.length > 0;

    // korpus
    if (kind === "to92") {
      var r = b.w / 2;
      s("path", { "class": "po-body", d: "M" + b.x + " " + (b.y + b.h) + " L" + b.x + " " + (b.y + r) + " A" + r + " " + r + " 0 0 1 " + (b.x + b.w) + " " + (b.y + r) + " L" + (b.x + b.w) + " " + (b.y + b.h) + " Z" }, svg);
    } else if (kind === "to220") {
      s("rect", { "class": "po-body", x: b.x, y: b.y - 70, width: b.w, height: 70, rx: 6 }, svg);
      s("circle", { "class": "po-notch", cx: cx, cy: b.y - 38, r: 12 }, svg);
      s("rect", { "class": "po-body", x: b.x, y: b.y, width: b.w, height: b.h, rx: 6 }, svg);
    } else if (kind === "axial") {
      s("rect", { "class": "po-body", x: b.x, y: b.y, width: b.w, height: b.h, rx: 22 }, svg);
      s("rect", { "class": "po-band", x: b.x + 16, y: b.y + 1, width: 16, height: b.h - 2 }, svg);
    } else {
      s("rect", { "class": "po-body", x: b.x, y: b.y, width: b.w, height: b.h, rx: 8 }, svg);
    }
    if (kind === "dual") s("path", { "class": "po-notch", d: "M" + (cx - 11) + " " + b.y + " a11 11 0 0 0 22 0" }, svg);
    if (g.mark) s("circle", { "class": "po-mark", cx: g.mark.x, cy: g.mark.y, r: kind === "dual" ? 5 : 6 }, svg);

    // podpisy
    var label = str(opts.title) || d.package || "";
    var sub = [d.package, d.view].filter(Boolean).join(", ");
    var tx = kind === "axial" ? cx + 12 : cx;
    var fs = Math.max(10, Math.min(18, Math.floor((b.w - 24) / (Math.max(label.length, 1) * 0.62))));
    var ty = hasPad ? (kind === "quad" ? cy - 44 : b.y + 40) : (b.h >= 100 ? cy - 6 : cy + 5);
    t = s("text", { x: tx, y: ty, "text-anchor": "middle", "class": "po-title", "font-size": fs }, svg);
    t.textContent = label;
    var maxCh = (b.w - 16) / 6.6;                       // ile znaków mieści się w korpusie
    if (sub.length > maxCh) sub = d.package;
    if (sub && sub !== label && sub.length <= maxCh && b.h >= 100) {
      t = s("text", { x: tx, y: ty + 20, "text-anchor": "middle", "class": "po-lbl" }, svg);
      t.textContent = sub;
    }

    // pad(y)
    pads.forEach(function (idx, j) {
      var pw = (kind === "quad" ? b.w * 0.65 : b.w * 0.66) / pads.length;
      var px0 = cx - (kind === "quad" ? b.w * 0.325 : b.w * 0.33);
      var py = kind === "quad" ? cy - 4 : b.y + 72;
      var ph = kind === "quad" ? b.h * 0.38 : Math.max(40, b.h - 72 - 22);
      if (kind === "sip") { py = cy + 10; ph = Math.max(30, b.h / 2 - 30); px0 = b.x + 12; pw = (b.w - 24) / pads.length; }
      var g1 = pinGroup(svg, d.pins[idx], idx, onPin);
      s("rect", { x: px0 + j * pw + 2, y: py, width: pw - 4, height: ph, rx: 4, "stroke-dasharray": "6 4" }, g1);
      t = s("text", { x: px0 + j * pw + pw / 2, y: py + ph / 2 + 4, "text-anchor": "middle", "class": "po-num" }, g1);
      t.textContent = d.pins[idx].name + " (pad)";
    });

    // piny
    posIdx.forEach(function (idx, i) {
      var p = d.pins[idx], q = g.pos[i];
      if (!q) return;
      var grp = pinGroup(svg, p, idx, onPin), a, lx, ly;
      s("rect", { x: q.x, y: q.y, width: q.w, height: q.h, rx: 3 }, grp);
      t = s("text", { x: q.x + q.w / 2, y: q.y + q.h / 2 + 4, "text-anchor": "middle", "class": "po-num" }, grp);
      t.textContent = p.n;
      if (q.above) a = { x: q.x + q.w / 2, y: q.y - 8, "text-anchor": "middle" };
      else if (q.s === "L") a = { x: q.x - 6, y: q.y + q.h / 2 + 4, "text-anchor": "end" };
      else if (q.s === "R") a = { x: q.x + q.w + 6, y: q.y + q.h / 2 + 4, "text-anchor": "start" };
      else if (q.s === "B") { lx = q.x + q.w / 2; ly = q.y + q.h + 6; a = { x: lx, y: ly, dy: 4, "text-anchor": "start", transform: "rotate(90 " + lx + " " + ly + ")" }; }
      else { lx = q.x + q.w / 2; ly = q.y - 6; a = { x: lx, y: ly, dy: 4, "text-anchor": "start", transform: "rotate(-90 " + lx + " " + ly + ")" }; }
      t = s("text", a, grp);
      t.textContent = p.name;
    });
  }

  /* ── render główny ───────────────────────────────────────────────────── */
  function render(root, data, opts) {
    opts = opts || {};
    var rs = resolve(data, opts.lang), d = normalize(rs.doc), id = ++uid;
    var image = d.layout === "board" && d.imageAsBackground ? safeImg(str(opts.image)) : "";
    root.textContent = "";
    root.classList.add("pinout");
    if (!d.pins.length) return null;

    var state = { sel: null, grp: null, active: {} }, rowsEl = {}, pinEls = {};
    svgPins = pinEls;
    var hasType = d.pins.some(function (p) { return p.type; });

    root.appendChild(h("div", { "class": "po-head" }, [
      h("div", { "class": "po-meta", text: [d.package, d.view].filter(Boolean).concat([d.pins.length + " " + _t('pn.wyprowadzen')]).join(" · ") +
        (opts.lang && rs.used !== opts.lang ? " · " + _t('pn.brakTlumaczeniaWersja', { lang: rs.used.toUpperCase() }) : "") })
    ]));
    if (d.warning) root.appendChild(h("p", { "class": "po-warn", text: d.warning }));
    root.appendChild(h("p", { "class": "po-help",
      text: _t('pn.najedzLubWybierzPin') }));

    var filters = h("div", { "class": "po-filters", role: "group", "aria-label": _t('pn.filtrKategorii') });
    root.appendChild(filters);
    var grid = h("div", { "class": "po-grid" + (d.layout === "none" ? " po-grid-table" : "") });
    root.appendChild(grid);

    var detail = h("div", { "class": "po-detail", "aria-live": "polite", id: "po-detail-" + id });
    function resetDetail() {
      detail.textContent = ""; detail.style.removeProperty("--c");
      detail.appendChild(h("h4", { text: _t('pn.wybierzPin') }));
      detail.appendChild(h("p", { "class": "po-src", text: _t('pn.kliknijPinNaDiagramie') }));
    }
    resetDetail();

    function hl(i, on) {
      if (pinEls[i]) pinEls[i].classList.toggle("hl", on);
      if (rowsEl[i]) rowsEl[i].classList.toggle("hl", on);
    }
    function showDetail(i) {
      var p = d.pins[i];
      detail.style.setProperty("--c", CATS[p.cat][1]); detail.textContent = "";
      detail.appendChild(h("h4", { text: (p.pad ? p.name : _t('pn.pin') + " " + p.n + " · " + p.name) + " – " + CATS[p.cat][0] }));
      if (p.type) detail.appendChild(h("p", { text: _t('pn.typ') + " " + p.type }));
      if (p.fn) detail.appendChild(h("p", { text: p.fn }));
      if (p.note) detail.appendChild(h("p", { "class": "po-src", text: p.note }));
    }
    var groupEls = [], groupIdx = d.groups.map(function (gr) {
      var out = [];
      gr.pins.forEach(function (ref) {
        var r = ref.toLowerCase();
        d.pins.forEach(function (p, i) { if ((p.n.toLowerCase() === r || p.name.toLowerCase() === r) && out.indexOf(i) < 0) out.push(i); });
      });
      return out;
    });
    function clearGroup() {
      if (state.grp === null) return;
      groupIdx[state.grp].forEach(function (i) { if (pinEls[i]) pinEls[i].classList.remove("grp"); rowsEl[i].classList.remove("grp"); });
      groupEls[state.grp].setAttribute("aria-pressed", "false");
      state.grp = null;
    }
    function select(i) {
      clearGroup();
      if (state.sel !== null) {
        if (pinEls[state.sel]) pinEls[state.sel].classList.remove("sel");
        rowsEl[state.sel].classList.remove("sel"); rowsEl[state.sel].setAttribute("aria-selected", "false");
      }
      state.sel = i;
      if (i === null) { resetDetail(); return; }
      if (pinEls[i]) pinEls[i].classList.add("sel");
      rowsEl[i].classList.add("sel"); rowsEl[i].setAttribute("aria-selected", "true");
      showDetail(i);
    }
    function selectGroup(gi) {
      var same = state.grp === gi;
      select(null);
      if (same) return;
      state.grp = gi;
      groupIdx[gi].forEach(function (i) { if (pinEls[i]) pinEls[i].classList.add("grp"); rowsEl[i].classList.add("grp"); });
      groupEls[gi].setAttribute("aria-pressed", "true");
      var gr = d.groups[gi];
      detail.textContent = ""; detail.style.setProperty("--c", "var(--accent)");
      detail.appendChild(h("h4", { text: gr.name }));
      if (gr.note) detail.appendChild(h("p", { text: gr.note }));
      detail.appendChild(h("p", { "class": "po-src", text: _t('pn.piny') + " " + groupIdx[gi].map(function (i) { return d.pins[i].name + " (" + d.pins[i].n + ")"; }).join(", ") }));
    }
    function visible(i) { var any = Object.keys(state.active).length; return !any || !!state.active[d.pins[i].cat]; }
    function order() { return d.pins.map(function (_, i) { return i; }).filter(visible); }
    function move(i, k, inTable) {
      var o = order(), pos = o.indexOf(i);
      if (pos < 0) return;
      pos = k === "home" ? 0 : k === "end" ? o.length - 1 : Math.max(0, Math.min(o.length - 1, pos + k));
      (inTable ? rowsEl[o[pos]] : (pinEls[o[pos]] || rowsEl[o[pos]])).focus();
    }
    function onKey(ev, i, inTable) {
      var map = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1, Home: "home", End: "end" };
      if (ev.key in map) { ev.preventDefault(); move(i, map[ev.key], inTable); }
      else if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); select(state.sel === i ? null : i); }
      else if (ev.key === "Escape") select(null);
    }
    function wire(el, i, inTable) {
      el.addEventListener("mouseenter", function () { hl(i, true); });
      el.addEventListener("mouseleave", function () { hl(i, false); });
      el.addEventListener("focus", function () { hl(i, true); });
      el.addEventListener("blur", function () { hl(i, false); });
      el.addEventListener("click", function (ev) { ev.stopPropagation(); select(state.sel === i ? null : i); });
      el.addEventListener("keydown", function (ev) { onKey(ev, i, inTable); });
    }

    // rysunek
    var left = h("div", { "class": "po-card po-left" }), svg = null;
    if (d.layout !== "none") {
      var posCount = d.pins.filter(function (p) { return !p.pad; }).length;
      var g = geometry(d.layout, posCount, d);
      svg = s("svg", { "class": "po-svg" + (d.layout === "board" ? " po-svg-board" : ""), viewBox: "0 0 " + g.w + " " + g.h, role: "group",
        "aria-label": _t('pn.rysunek') + " " + (opts.title || d.package) + ", " + d.pins.length + " " + _t('pn.wyprowadzen') });
      var onPin = function (el, i) { wire(el, i, false); };
      if (d.layout === "board") {
        drawBoard(svg, d, g, { image: image }, onPin);
        if (typeof opts.onBoardClick === "function") {
          svg.classList.add("po-pick");
          svg.addEventListener("click", function (ev) {
            var r = svg.getBoundingClientRect();
            opts.onBoardClick(+((ev.clientX - r.left) / r.width * 100).toFixed(1), +((ev.clientY - r.top) / r.height * 100).toFixed(1));
          });
        }
      } else drawChip(svg, d, g, opts, onPin);
      left.appendChild(svg);
    }
    left.appendChild(detail);
    grid.appendChild(left);

    // tabela
    var thead = h("tr", {}, [h("th", { text: "Nr" }), h("th", { text: _t('pn.nazwa') }), h("th", { text: _t('pn.kategoria') })]);
    if (hasType) thead.appendChild(h("th", { text: _t('pn.typ2') }));
    thead.appendChild(h("th", { text: _t('pn.funkcjaIUwagi') }));
    var tbody = h("tbody");
    d.pins.forEach(function (p, i) {
      var tr = h("tr", { tabindex: 0, "aria-selected": "false", "data-i": i });
      tr.style.setProperty("--c", CATS[p.cat][1]);
      tr.appendChild(h("td", { "class": "n", text: p.pad ? "pad" : p.n }));
      tr.appendChild(h("td", { "class": "nm", text: p.name }));
      tr.appendChild(h("td", {}, [h("span", { "class": "po-chip", text: CATS[p.cat][0] })]));
      if (hasType) tr.appendChild(h("td", { text: p.type || "—" }));
      var fn = h("td", { text: p.fn });
      if (p.note) fn.appendChild(h("div", { "class": "po-src", text: p.note }));
      tr.appendChild(fn);
      wire(tr, i, true);
      rowsEl[i] = tr; tbody.appendChild(tr);
    });
    grid.appendChild(h("div", { "class": "po-card po-tw" }, [h("table", {}, [h("thead", {}, [thead]), tbody])]));

    // grupy: złącza i magistrale
    if (d.groups.length) {
      var gwrap = h("div", { "class": "po-groups" }, [h("h4", { text: _t('pn.zlaczaIMagistrale') })]);
      var glist = h("div", { "class": "po-glist" });
      d.groups.forEach(function (gr, gi) {
        var btn = h("button", { type: "button", "class": "po-group", "aria-pressed": "false" });
        btn.appendChild(h("strong", { text: gr.name }));
        btn.appendChild(h("span", { text: groupIdx[gi].map(function (i) { return d.pins[i].name; }).join(" · ") }));
        btn.addEventListener("click", function () { selectGroup(gi); });
        groupEls.push(btn); glist.appendChild(btn);
      });
      gwrap.appendChild(glist);
      root.appendChild(gwrap);
    }

    // filtry kategorii
    var present = Object.keys(CATS).filter(function (k) { return d.pins.some(function (p) { return p.cat === k; }); });
    function applyFilters() {
      d.pins.forEach(function (_, i) {
        var v = visible(i);
        if (pinEls[i]) {
          pinEls[i].classList.toggle("dim", !v);
          pinEls[i].setAttribute("tabindex", v ? 0 : -1);
          pinEls[i].setAttribute("aria-hidden", v ? "false" : "true");
        }
        rowsEl[i].hidden = !v;
      });
      if (state.sel !== null && !visible(state.sel)) select(null);
      Array.prototype.forEach.call(filters.children, function (b) {
        var key = b.getAttribute("data-k");
        b.setAttribute("aria-pressed", String(key === "all" ? !Object.keys(state.active).length : !!state.active[key]));
      });
    }
    function addBtn(key, text, color) {
      var b = h("button", { type: "button", "data-k": key, text: text });
      if (color) b.style.setProperty("--c", color);
      b.addEventListener("click", function () {
        if (key === "all") state.active = {};
        else if (state.active[key]) delete state.active[key]; else state.active[key] = true;
        applyFilters();
      });
      filters.appendChild(b);
    }
    addBtn("all", _t('pn.wszystkie') + d.pins.length + ")");
    present.forEach(function (k) { addBtn(k, CATS[k][0] + " (" + d.pins.filter(function (p) { return p.cat === k; }).length + ")", CATS[k][1]); });
    applyFilters();

    // stopka – styl callout z platformy
    if (d.notes) {
      var lim = h("div", { "class": "callout callout-warn po-lim" });
      lim.appendChild(h("strong", { text: _t('pn.ograniczeniaWeryfikacji') }));
      lim.appendChild(document.createTextNode(d.notes));
      root.appendChild(lim);
    }
    if (d.sources.length) {
      var src = h("p", { "class": "po-src po-sources" });
      src.appendChild(h("strong", { text: _t('pn.zrodla') + " " }));
      d.sources.forEach(function (x, i) {
        if (i) src.appendChild(document.createTextNode(" · "));
        if (x.url) src.appendChild(h("a", { href: x.url, target: "_blank", rel: "noopener noreferrer", text: x.label || x.url }));
        else src.appendChild(document.createTextNode(x.label));
      });
      root.appendChild(src);
    }
    return { select: select, selectGroup: selectGroup, svg: svg, state: function () { return { sel: state.sel, grp: state.grp, active: state.active }; }, data: d };
  }

  /* ── sekcja do karty podzespołu ──────────────────────────────────────── */
  function mountSection(slot, pinout, opts) {
    opts = opts || {};
    slot.textContent = "";
    slot.classList.add("po-section");
    slot.appendChild(h("h3", { "class": "section-title", text: _t('pn.pinoutIOpisWyprowadzen') }));
    var body = h("div", { "class": "po-body-wrap" });
    var langs = docLangs(pinout), cur = opts.lang || (global.ESNI18n && global.ESNI18n.lang()) || "pl", ctl = null;
    if (langs.length > 1 && pinout && pinout.pins) {
      var sw = h("div", { "class": "po-langs", role: "group", "aria-label": _t('pn.jezykOpisu') });
      langs.forEach(function (l) {
        var b = h("button", { type: "button", "class": "po-lang", text: l.toUpperCase(), "aria-pressed": String(l === cur) });
        b.addEventListener("click", function () {
          cur = l; Array.prototype.forEach.call(sw.children, function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          ctl = render(body, pinout, { title: opts.title, image: opts.image, lang: cur });
        });
        sw.appendChild(b);
      });
      slot.appendChild(sw);
    }
    slot.appendChild(body);
    ctl = render(body, pinout, { title: opts.title, image: opts.image, lang: cur });
    if (ctl) return ctl;
    body.appendChild(h("p", { "class": "po-empty", text: _t('pn.tenPodzespolNieMa') }));
    if (opts.isAdmin && typeof opts.onEdit === "function") {
      var btn = h("button", { type: "button", "class": "btn-action", text: _t('pn.dodajPinout') });
      btn.addEventListener("click", opts.onEdit);
      body.appendChild(btn);
    }
    return null;
  }

  /* ── format edycyjny ─────────────────────────────────────────────────── */
  var TEMPLATE =
    "package: SOIC-8\nview: widok z góry\nlayout: dual\n" +
    "source: Datasheet producenta | https://\nnotes: \n\n" +
    "# nr | nazwa | kategoria | typ | funkcja | uwagi\n" +
    "# kategorie: " + Object.keys(CATS).join(", ") + "\n" +
    "1 | VCC | power | Zasilanie | Zasilanie dodatnie | 2,7–5,5 V\n" +
    "2 | GND | ground | Masa | Masa |\n";

  function parseXY(v, n) {
    var p = v.split(",").map(function (x) { return num(x); });
    if (p.length < n || p.slice(0, n).some(function (x) { return x === null; })) return null;
    return p;
  }

  function parseText(text) {
    text = str(text);
    if (!text) return null;
    if (text.charAt(0) === "{") return JSON.parse(text);
    var out = { pins: [], sources: [], shapes: [], groups: [] }, ov = null;   /* ov – bieżący blok tłumaczenia [xx] */
    text.split(/\r?\n/).forEach(function (raw, i) {
      var line = raw.trim(), ln = _t('pn.linia') + " " + (i + 1) + ": ";
      if (!line || line.charAt(0) === "#") return;
      var bl = line.match(/^\[([a-z]{2,5})\]$/i);
      if (bl) {
        var lg = bl[1].toLowerCase();
        if (lg === (out.lang || "pl")) throw new Error(ln + _t('pn.blokJezykaBazowego'));
        ov = (out.translations = out.translations || {})[lg] = (out.translations[lg] || { pins: {}, groups: {}, shapes: {} });
        return;
      }
      if (ov) {                                    /* wnętrze bloku tłumaczenia: tylko teksty */
        var mo = line.match(/^(view|notes|group|shape)\s*:\s*(.*)$/i);
        if (mo) {
          var ko = mo[1].toLowerCase(), fo = mo[2].split("|").map(function (x) { return x.trim(); });
          if (ko === "view" || ko === "notes") { if (mo[2].trim()) ov[ko] = mo[2].trim(); }
          else if (ko === "group") { if (fo[0] && (fo[1] || fo[2])) ov.groups[fo[0]] = { name: fo[1] || "", note: fo.slice(2).join(" / ") }; }
          else if (fo[0] && fo[1]) ov.shapes[fo[0]] = fo[1];
          return;
        }
        var co = line.split("|").map(function (x) { return x.trim(); });
        if (co.length < 2) throw new Error(ln + _t('pn.oczekiwanoNrTypFunkcja'));
        var e = { type: co[1] || "", fn: co[2] || "", note: co.slice(3).join(" / ") };
        if (e.type || e.fn || e.note) ov.pins[co[0]] = e;
        return;
      }
      var m = line.match(/^(lang|package|view|layout|source|notes|aspect|labels|image_as_background|shape|group)\s*:\s*(.*)$/i);
      if (m) {
        var k = m[1].toLowerCase(), v = m[2].trim(), f = v.split("|").map(function (x) { return x.trim(); });
        if (!v) return;
        if (k === "source") out.sources.push({ label: f[0], url: f[1] || "" });
        else if (k === "aspect") { var a = num(v); if (a === null) throw new Error(ln + _t('pn.aspectMusiBycLiczba')); (out.board = out.board || {}).aspect = a; }
        else if (k === "labels") (out.board = out.board || {}).labels = /^(tak|yes|true|1)$/i.test(v);
        else if (k === "image_as_background") out.image_as_background = /^(tak|yes|true|1)$/i.test(v);
        else if (k === "shape") {
          var t = f[0].toLowerCase(), c;
          if (t === "rect") { c = parseXY(f[1] || "", 4); if (!c) throw new Error(ln + "shape: rect | x,y,szer,wys | etykieta | rodzaj"); out.shapes.push({ t: t, x: c[0], y: c[1], w: c[2], h: c[3], label: f[2] || "", kind: f[3] || "part" }); }
          else if (t === "circle") { c = parseXY(f[1] || "", 3); if (!c) throw new Error(ln + "shape: circle | x,y,promień | etykieta | rodzaj"); out.shapes.push({ t: t, x: c[0], y: c[1], r: c[2], label: f[2] || "", kind: f[3] || "part" }); }
          else if (t === "text") { c = parseXY(f[1] || "", 2); if (!c) throw new Error(ln + "shape: text | x,y | etykieta"); out.shapes.push({ t: t, x: c[0], y: c[1], label: f[2] || "" }); }
          else throw new Error(ln + _t('pn.nieznanyKsztalt') + f[0] + "” (rect, circle, text)");
        }
        else if (k === "group") out.groups.push({ name: f[0], pins: (f[1] || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean), note: f.slice(2).join(" / ") });
        else if (k === "lang") out.lang = v.toLowerCase();
        else out[k] = v;
        return;
      }
      var cols = line.split("|").map(function (x) { return x.trim(); });
      if (cols.length < 2) throw new Error(ln + "oczekiwano „nr | nazwa | kategoria | typ | funkcja | uwagi”");
      var pin = { n: cols[0], name: cols[1], cat: (cols[2] || "other").toLowerCase(), type: cols[3] || "", fn: cols[4] || "", note: cols.slice(5).join(" / ") };
      var at = cols[0].match(/^(.*?)\s*@\s*([\d.]+)\s*,\s*([\d.]+)$/);
      if (at) { pin.n = at[1]; pin.x = +at[2]; pin.y = +at[3]; }
      out.pins.push(pin);
    });
    if (!out.pins.length) throw new Error(_t('pn.nieZnalezionoZadnegoPinu'));
    return out;
  }

  /* toText(doc)            – wszystkie języki (blok [xx] na język) – pełny round-trip
   * toText(doc, {lang:"en"}) – jeden język, spłaszczony (do dokumentacji / przekazania AI do tłumaczenia) */
  function toText(p, opts) {
    if (!p || !Array.isArray(p.pins)) return "";
    if (opts && opts.lang) p = resolve(p, opts.lang).doc;
    var clean = function (v) { return str(v).replace(/\|/g, "/").replace(/\s*\n\s*/g, " "); };
    var lines = [];
    lines.push("lang: " + clean(p.lang || "pl"));
    ["package", "view", "layout"].forEach(function (k) { if (p[k]) lines.push(k + ": " + clean(p[k])); });
    if (p.board && p.board.aspect) lines.push("aspect: " + p.board.aspect);
    if (p.board && typeof p.board.labels === "boolean") lines.push("labels: " + (p.board.labels ? "tak" : "nie"));
    if (typeof p.image_as_background === "boolean") lines.push("image_as_background: " + (p.image_as_background ? "tak" : "nie"));
    (p.sources || []).forEach(function (x) { lines.push("source: " + clean(x.label) + " | " + str(x.url)); });
    if (p.notes) lines.push("notes: " + clean(p.notes));
    (p.shapes || []).forEach(function (x) {
      var pos = x.t === "rect" ? [x.x, x.y, x.w, x.h] : x.t === "circle" ? [x.x, x.y, x.r] : [x.x, x.y];
      lines.push("shape: " + [x.t, pos.join(","), clean(x.label), x.t === "text" ? "" : (x.kind || "part")].join(" | ").replace(/( \| )+$/, ""));
    });
    (p.groups || []).forEach(function (x) { lines.push("group: " + [clean(x.name), (x.pins || []).join(", "), clean(x.note)].join(" | ").replace(/( \| )+$/, "")); });
    lines.push("", "# nr | nazwa | kategoria | typ | funkcja | uwagi");
    p.pins.forEach(function (x) {
      var n = clean(x.n) + (x.x != null && x.y != null ? " @" + x.x + "," + x.y : "");
      lines.push([n, x.name, x.cat || "other", x.type, x.fn, x.note].map(clean).join(" | "));
    });
    var tr = (!opts || !opts.lang) && p.translations || {};
    Object.keys(tr).forEach(function (lg) {
      var o = tr[lg] || {};
      lines.push("", "[" + lg + "]");
      if (o.view) lines.push("view: " + clean(o.view));
      if (o.notes) lines.push("notes: " + clean(o.notes));
      Object.keys(o.groups || {}).forEach(function (k) { lines.push("group: " + [clean(k), clean(o.groups[k].name), clean(o.groups[k].note)].join(" | ").replace(/( \| )+$/, "")); });
      Object.keys(o.shapes || {}).forEach(function (k) { lines.push("shape: " + clean(k) + " | " + clean(o.shapes[k])); });
      if (Object.keys(o.pins || {}).length) lines.push("# nr | typ | funkcja | uwagi");
      Object.keys(o.pins || {}).forEach(function (k) { var e = o.pins[k]; lines.push([k, e.type, e.fn, e.note].map(clean).join(" | ").replace(/( \| )+$/, "")); });
    });
    return lines.join("\n");
  }

  global.ESNPinout = { render: render, mountSection: mountSection, parseText: parseText, toText: toText,
    resolve: resolve, langs: docLangs, normalize: normalize, CATS: CATS, LAYOUTS: LAYOUTS, TEMPLATE: TEMPLATE };
})(window);
