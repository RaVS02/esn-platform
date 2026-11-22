/* Dodatkowe bloki Wiedzy (v8): kroki, oś czasu, postęp, definicje, lista kontrolna, zwijana sekcja, zakładki
 * oraz diagramy rysowane przez platformę: flow (algorytmy), er (relacje w bazie), sequence (komunikacja).
 * Wszystko budowane przez DOM/SVG API z textContent – żadnego HTML od autora poza markdownem (który i tak przechodzi DOMPurify).
 * Użycie: ESNKnowledgeBlocks.render(name, arg, text, H) → węzeł DOM albo null (nieznany blok); H = { h, inline, md }.
 */
(function (global) {
  var NS = "http://www.w3.org/2000/svg";
  function sv(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text != null) e.textContent = text;
    return e;
  }
  function lines(t) { return String(t || "").split("\n").map(function (x) { return x.replace(/\s+$/, ""); }).filter(function (x) { return x.trim(); }); }
  function cut(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function tw(s) { return Math.round(String(s).length * 6.6); }       // przybliżona szerokość tekstu 11px mono
  var MAXN = 40;                                                         // limit elementów diagramu (ochrona przed gigantycznym SVG)

  function wrapDiagram(H, title, svg) {
    var w = H.h("div", { "class": "diagram-wrap kn-figure kn-dg" });
    if (title) w.appendChild(H.h("div", { "class": "diagram-title", text: title }));
    w.appendChild(svg); return w;
  }
  function warn(H, msg) { return H.h("div", { "class": "callout callout-warn" }, [H.h("h3", { text: "Błąd diagramu" }), msg]); }
  function arrowDefs(svg) {
    var d = sv("defs"), m = sv("marker", { id: "kd-ar", viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" });
    m.appendChild(sv("path", { d: "M0 0 L10 5 L0 10 z", "class": "dg-arrow" })); d.appendChild(m); svg.appendChild(d);
  }
  function newSvg(w, h, label) {
    var s = sv("svg", { viewBox: "0 0 " + w + " " + h, width: w, role: "img", "aria-label": label || "Diagram" });
    s.style.maxWidth = "100%"; s.style.height = "auto"; return s;
  }

  /* ── FLOW ─────────────────────────────────────────────────────────────
   * (id) Tekst     – start/koniec (zaokrąglony)
   * [id] Tekst     – krok
   * {id} Tekst     – decyzja (romb)
   * a -> b         – strzałka,  a -> b : tak   – strzałka z etykietą
   */
  function flow(arg, text, H) {
    var nodes = {}, order = [], edges = [];
    var bad = null;
    lines(text).forEach(function (ln) {
      var m = /^([(\[{])([\w-]+)[)\]}]\s+(.+)$/.exec(ln.trim());
      if (m) { if (!nodes[m[2]]) { nodes[m[2]] = { id: m[2], kind: m[1] === "(" ? "t" : m[1] === "{" ? "d" : "p", label: cut(m[3], 60) }; order.push(m[2]); } return; }
      var e = /^([\w-]+)\s*->\s*([\w-]+)(?:\s*:\s*(.+))?$/.exec(ln.trim());
      if (e) { edges.push({ a: e[1], b: e[2], l: cut(e[3] || "", 24) }); return; }
      bad = bad || ("Nie rozumiem linii: „" + cut(ln.trim(), 50) + "”");
    });
    if (bad) return warn(H, bad);
    if (!order.length) return warn(H, "Dodaj węzły, np. (start) Start, [krok] Odczytaj ADC, {ok} Czy poprawne?");
    if (order.length > MAXN) return warn(H, "Za dużo węzłów (max " + MAXN + ").");
    for (var i = 0; i < edges.length; i++) if (!nodes[edges[i].a] || !nodes[edges[i].b]) return warn(H, "Strzałka wskazuje nieznany węzeł: " + edges[i].a + " -> " + edges[i].b);
    // poziomy: BFS od pierwszego węzła; krawędzie do już ułożonych węzłów są „powrotne”
    var level = {}; level[order[0]] = 0; var q = [order[0]], fwd = [], back = [];
    var out = {}; edges.forEach(function (e) { (out[e.a] = out[e.a] || []).push(e); });
    while (q.length) {
      var cur = q.shift();
      (out[cur] || []).forEach(function (e) { if (level[e.b] == null) { level[e.b] = level[cur] + 1; q.push(e.b); } });
    }
    order.forEach(function (id) { if (level[id] == null) level[id] = 0; });
    edges.forEach(function (e) { (level[e.b] > level[e.a] ? fwd : back).push(e); });
    var rows = [];
    order.forEach(function (id) { (rows[level[id]] = rows[level[id]] || []).push(id); });
    var NH = 44, GAPY = 46, GAPX = 36, PADX = 24, PADY = 18;
    order.forEach(function (id) { var n = nodes[id]; n.w = Math.max(n.kind === "d" ? 150 : 110, tw(n.label) + (n.kind === "d" ? 70 : 32)); n.h = n.kind === "d" ? 56 : NH; });
    var rowW = rows.map(function (r) { return r.reduce(function (s, id) { return s + nodes[id].w; }, 0) + GAPX * (r.length - 1); });
    var W = Math.max.apply(null, rowW) + PADX * 2 + (back.length ? 90 : 0);
    var y = PADY;
    rows.forEach(function (r, ri) {
      var rh = Math.max.apply(null, r.map(function (id) { return nodes[id].h; }));
      var x = PADX + (Math.max.apply(null, rowW) - rowW[ri]) / 2;
      r.forEach(function (id) { var n = nodes[id]; n.x = x; n.cx = x + n.w / 2; n.y = y + (rh - n.h) / 2; n.cy = n.y + n.h / 2; x += n.w + GAPX; });
      y += rh + GAPY;
    });
    var Hh = y - GAPY + PADY;
    var svg = newSvg(W, Hh, arg || "Schemat blokowy"); arrowDefs(svg);
    var maxRight = Math.max.apply(null, order.map(function (id) { return nodes[id].x + nodes[id].w; }));
    function label(x, yy, t) { if (!t) return; svg.appendChild(sv("text", { x: x, y: yy, "class": "dg-elabel", "text-anchor": "middle" }, t)); }
    fwd.forEach(function (e) {
      var a = nodes[e.a], b = nodes[e.b], x1 = a.cx, y1 = a.y + a.h, x2 = b.cx, y2 = b.y;
      var my = (y1 + y2) / 2;
      svg.appendChild(sv("path", { d: "M" + x1 + " " + y1 + " C" + x1 + " " + my + " " + x2 + " " + my + " " + x2 + " " + y2, "class": "dg-edge", "marker-end": "url(#kd-ar)" }));
      label((x1 + x2) / 2 + (x1 === x2 ? 14 : 0), my - 4, e.l);
    });
    back.forEach(function (e, i) {
      var a = nodes[e.a], b = nodes[e.b], bx = maxRight + 24 + i * 14;
      svg.appendChild(sv("path", { d: "M" + (a.x + a.w) + " " + a.cy + " L" + bx + " " + a.cy + " L" + bx + " " + b.cy + " L" + (b.x + b.w) + " " + b.cy, "class": "dg-edge", "marker-end": "url(#kd-ar)" }));
      if (e.l) svg.appendChild(sv("text", { x: bx + 6, y: (a.cy + b.cy) / 2 + 4, "class": "dg-elabel" }, e.l));
    });
    order.forEach(function (id) {
      var n = nodes[id], g = sv("g", { "class": "dg-node dg-" + n.kind });
      if (n.kind === "d") g.appendChild(sv("polygon", { points: [n.cx + "," + n.y, (n.x + n.w) + "," + n.cy, n.cx + "," + (n.y + n.h), n.x + "," + n.cy].join(" ") }));
      else g.appendChild(sv("rect", { x: n.x, y: n.y, width: n.w, height: n.h, rx: n.kind === "t" ? n.h / 2 : 6 }));
      g.appendChild(sv("text", { x: n.cx, y: n.cy + 4, "text-anchor": "middle" }, n.label));
      svg.appendChild(g);
    });
    return wrapDiagram(H, arg, svg);
  }

  /* ── ER ───────────────────────────────────────────────────────────────
   * tabela: kolumna PK, kolumna FK, kolumna
   * a 1--* b : etykieta     (znaczniki: 1, 0..1, *, 0..*, 1..*)
   */
  function er(arg, text, H) {
    var ents = {}, order = [], rels = [], bad = null;
    lines(text).forEach(function (ln) {
      var r = /^([\w-]+)\s+(\S+?)--(\S+?)\s+([\w-]+)(?:\s*:\s*(.+))?$/.exec(ln.trim());
      if (r) { rels.push({ a: r[1], ca: r[2], cb: r[3], b: r[4], l: cut(r[5] || "", 26) }); return; }
      var e = /^([\w-]+)\s*:\s*(.+)$/.exec(ln.trim());
      if (e) {
        var cols = e[2].split(",").map(function (c) { var p = c.trim().split(/\s+/); var tag = /^(PK|FK|UQ)$/i.test(p[p.length - 1]) && p.length > 1 ? p.pop().toUpperCase() : ""; return { n: cut(p.join(" "), 24), t: tag }; }).filter(function (c) { return c.n; });
        if (!ents[e[1]]) order.push(e[1]); ents[e[1]] = { id: e[1], cols: cols.slice(0, 14) }; return;
      }
      bad = bad || ("Nie rozumiem linii: „" + cut(ln.trim(), 50) + "”");
    });
    if (bad) return warn(H, bad);
    if (!order.length) return warn(H, "Dodaj tabele, np. users: id PK, login, email");
    if (order.length > 16) return warn(H, "Za dużo tabel (max 16).");
    for (var i = 0; i < rels.length; i++) if (!ents[rels[i].a] || !ents[rels[i].b]) return warn(H, "Relacja wskazuje nieznaną tabelę: " + rels[i].a + " / " + rels[i].b);
    var per = order.length <= 2 ? order.length : order.length <= 6 ? 3 : 4, RH = 20, HH = 28, GX = 90, GY = 56, PAD = 20;
    order.forEach(function (id) { var e = ents[id]; e.w = Math.max(130, tw(id) + 30, Math.max.apply(null, e.cols.map(function (c) { return tw(c.n) + (c.t ? 50 : 24); }).concat([0]))); e.h = HH + Math.max(1, e.cols.length) * RH + 6; });
    var rowsN = Math.ceil(order.length / per), colW = [], rowH = [];
    order.forEach(function (id, i) { var c = i % per, r = Math.floor(i / per); colW[c] = Math.max(colW[c] || 0, ents[id].w); rowH[r] = Math.max(rowH[r] || 0, ents[id].h); });
    var colX = [], x = PAD; colW.forEach(function (w, c) { colX[c] = x; x += w + GX; });
    var rowY = [], yy = PAD + 8; rowH.forEach(function (h2, r) { rowY[r] = yy; yy += h2 + GY; });
    order.forEach(function (id, i) { var e = ents[id], c = i % per, r = Math.floor(i / per); e.x = colX[c] + (colW[c] - e.w) / 2; e.y = rowY[r]; e.cx = e.x + e.w / 2; e.cy = e.y + e.h / 2; });
    var svg = newSvg(x - GX + PAD, yy - GY + PAD, arg || "Diagram relacji");
    function cardLabel(c) { return c.replace(/\*/g, "N"); }
    function anchor(a, b) {   // punkt na brzegu prostokąta a w stronę b
      var dx = b.cx - a.cx, dy = b.cy - a.cy, hw = a.w / 2, hh = a.h / 2;
      if (Math.abs(dx) * hh > Math.abs(dy) * hw) return { x: a.cx + (dx > 0 ? hw : -hw), y: a.cy + dy * (hw / Math.abs(dx)), side: dx > 0 ? "r" : "l" };
      return { x: a.cx + dx * (hh / Math.abs(dy || 1)), y: a.cy + (dy > 0 ? hh : -hh), side: dy > 0 ? "b" : "t" };
    }
    rels.forEach(function (r) {
      var A = ents[r.a], B = ents[r.b];
      if (A === B) { svg.appendChild(sv("path", { d: "M" + (A.x + A.w) + " " + (A.y + 14) + " h26 v34 h-26", "class": "dg-edge dg-fill-none" })); svg.appendChild(sv("text", { x: A.x + A.w + 30, y: A.y + 34, "class": "dg-elabel" }, r.l)); return; }
      var p = anchor(A, B), q = anchor(B, A);
      svg.appendChild(sv("line", { x1: p.x, y1: p.y, x2: q.x, y2: q.y, "class": "dg-edge" }));
      function card(pt, other, t) {
        var ox = pt.side === "r" ? 6 : pt.side === "l" ? -6 : 8, oy = pt.side === "b" ? 15 : pt.side === "t" ? -6 : -6;
        svg.appendChild(sv("text", { x: pt.x + ox, y: pt.y + oy, "class": "dg-card", "text-anchor": pt.side === "l" ? "end" : "start" }, cardLabel(t)));
      }
      card(p, q, r.ca); card(q, p, r.cb);
      if (r.l) svg.appendChild(sv("text", { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 - 5, "class": "dg-elabel", "text-anchor": "middle" }, r.l));
    });
    order.forEach(function (id) {
      var e = ents[id], g = sv("g", { "class": "dg-ent" });
      g.appendChild(sv("rect", { x: e.x, y: e.y, width: e.w, height: e.h, rx: 6 }));
      g.appendChild(sv("rect", { x: e.x, y: e.y, width: e.w, height: HH, rx: 6, "class": "dg-ent-head" }));
      g.appendChild(sv("text", { x: e.cx, y: e.y + 18, "text-anchor": "middle", "class": "dg-ent-title" }, id));
      e.cols.forEach(function (c, i) {
        var ty = e.y + HH + 15 + i * RH;
        g.appendChild(sv("text", { x: e.x + 10, y: ty, "class": c.t === "PK" ? "dg-pk" : "dg-col" }, c.n));
        if (c.t) g.appendChild(sv("text", { x: e.x + e.w - 10, y: ty, "text-anchor": "end", "class": "dg-tag dg-tag-" + c.t.toLowerCase() }, c.t));
      });
      svg.appendChild(g);
    });
    return wrapDiagram(H, arg, svg);
  }

  /* ── SEQUENCE ─────────────────────────────────────────────────────────
   * pierwsza linia: uczestnicy po przecinku;  A -> B : treść   (A --> B : odpowiedź, linia przerywana)
   */
  function sequence(arg, text, H) {
    var L = lines(text); if (L.length < 2) return warn(H, "Pierwsza linia: uczestnicy po przecinku (np. MCU, PC), potem komunikaty: MCU -> PC : dane");
    var parts = L[0].split(",").map(function (s) { return cut(s.trim(), 18); }).filter(Boolean), msgs = [], bad = null;
    if (parts.length < 2 || parts.length > 8) return warn(H, "Uczestników ma być od 2 do 8.");
    L.slice(1).forEach(function (ln) {
      var m = /^(.+?)\s*(-->|->)\s*(.+?)(?:\s*:\s*(.+))?$/.exec(ln.trim());
      if (!m) { bad = bad || ("Nie rozumiem linii: „" + cut(ln.trim(), 50) + "”"); return; }
      var a = parts.indexOf(m[1].trim()), b = parts.indexOf(m[3].trim());
      if (a < 0 || b < 0) { bad = bad || ("Nieznany uczestnik w linii: „" + cut(ln.trim(), 50) + "”"); return; }
      msgs.push({ a: a, b: b, dash: m[2] === "-->", t: cut(m[4] || "", 40) });
    });
    if (bad) return warn(H, bad);
    if (msgs.length > 40) return warn(H, "Za dużo komunikatów (max 40).");
    var colW = Math.max(130, Math.max.apply(null, parts.map(function (p) { return tw(p) + 40; })), Math.max.apply(null, msgs.map(function (m) { return tw(m.t) / Math.max(1, Math.abs(m.a - m.b)) + 24; }).concat([0])));
    var W = parts.length * colW + 20, top = 56, step = 38, Hh = top + msgs.length * step + 26;
    var svg = newSvg(W, Hh, arg || "Diagram sekwencji"); arrowDefs(svg);
    var cx = parts.map(function (_, i) { return 10 + colW * i + colW / 2; });
    parts.forEach(function (p, i) {
      svg.appendChild(sv("line", { x1: cx[i], y1: 40, x2: cx[i], y2: Hh - 10, "class": "dg-life" }));
      var g = sv("g", { "class": "dg-node dg-p" }); var w = Math.max(80, tw(p) + 24);
      g.appendChild(sv("rect", { x: cx[i] - w / 2, y: 8, width: w, height: 32, rx: 6 })); g.appendChild(sv("text", { x: cx[i], y: 28, "text-anchor": "middle" }, p)); svg.appendChild(g);
    });
    msgs.forEach(function (m, i) {
      var y = top + i * step + 14;
      if (m.a === m.b) {
        svg.appendChild(sv("path", { d: "M" + cx[m.a] + " " + (y - 8) + " h28 v16 h-28", "class": "dg-edge", "marker-end": "url(#kd-ar)" }));
        svg.appendChild(sv("text", { x: cx[m.a] + 34, y: y + 3, "class": "dg-elabel" }, m.t)); return;
      }
      var dir = m.b > m.a ? 1 : -1;
      svg.appendChild(sv("line", { x1: cx[m.a], y1: y, x2: cx[m.b] - dir * 2, y2: y, "class": "dg-edge" + (m.dash ? " dg-dash" : ""), "marker-end": "url(#kd-ar)" }));
      svg.appendChild(sv("text", { x: (cx[m.a] + cx[m.b]) / 2, y: y - 6, "class": "dg-elabel", "text-anchor": "middle" }, m.t));
    });
    return wrapDiagram(H, arg, svg);
  }

  /* ── bloki tekstowe ───────────────────────────────────────────────── */
  function cells(ln) { return ln.split("|").map(function (x) { return x.trim(); }); }

  function steps(arg, text, H) {      // Tytuł | opis
    var ol = H.h("ol", { "class": "kn-steps" });
    lines(text).slice(0, 30).forEach(function (ln, i) {
      var c = cells(ln), t = H.h("strong", { "class": "kn-step-t" }), d = H.h("div", { "class": "kn-step-d" });
      t.appendChild(H.inline(c[0])); if (c.length > 1) d.appendChild(H.inline(c.slice(1).join(" | ")));
      ol.appendChild(H.h("li", { "class": "kn-step" }, [H.h("span", { "class": "kn-step-n", text: String(i + 1) }), H.h("div", { "class": "kn-step-b" }, [t, c.length > 1 ? d : null])]));
    });
    return arg ? H.h("div", {}, [H.h("div", { "class": "kn-blk-title", text: arg }), ol]) : ol;
  }
  function timeline(arg, text, H) {   // Etykieta | Tytuł | opis
    var wrap = H.h("div", { "class": "kn-timeline" });
    lines(text).slice(0, 30).forEach(function (ln) {
      var c = cells(ln), t = H.h("strong", {}), d = H.h("div", { "class": "kn-tl-d" });
      t.appendChild(H.inline(c[1] || "")); if (c[2]) d.appendChild(H.inline(c.slice(2).join(" | ")));
      wrap.appendChild(H.h("div", { "class": "kn-tl-item" }, [H.h("span", { "class": "kn-tl-when", text: c[0] || "" }), H.h("span", { "class": "kn-tl-dot" }), H.h("div", { "class": "kn-tl-b" }, [t, c[2] ? d : null])]));
    });
    return arg ? H.h("div", {}, [H.h("div", { "class": "kn-blk-title", text: arg }), wrap]) : wrap;
  }
  function progress(arg, text, H) {   // Etykieta | 0-100 | opis | kolor
    var wrap = H.h("div", { "class": "kn-progress" });
    lines(text).slice(0, 20).forEach(function (ln) {
      var c = cells(ln), v = Math.max(0, Math.min(100, parseFloat(c[1]) || 0)), col = { green: "pg-green", orange: "pg-orange", red: "pg-red", accent: "" }[(c[3] || "").toLowerCase()] || "";
      var bar = H.h("div", { "class": "kn-pg-fill " + col }); bar.style.width = v + "%";
      var track = H.h("div", { "class": "kn-pg-track", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(v), "aria-label": c[0] || "postęp" }, [bar]);
      wrap.appendChild(H.h("div", { "class": "kn-pg-row" }, [H.h("div", { "class": "kn-pg-head" }, [H.h("span", { text: c[0] || "" }), H.h("span", { "class": "kn-pg-val", text: v + "%" })]), track, c[2] ? H.h("div", { "class": "kn-pg-note", text: c[2] }) : null]));
    });
    return wrap;
  }
  function defs(arg, text, H) {       // Termin | definicja
    var dl = H.h("dl", { "class": "kn-defs" });
    lines(text).slice(0, 40).forEach(function (ln) {
      var c = cells(ln), dt = H.h("dt"), dd = H.h("dd"); dt.appendChild(H.inline(c[0])); dd.appendChild(H.inline(c.slice(1).join(" | ")));
      dl.appendChild(dt); dl.appendChild(dd);
    });
    return dl;
  }
  function checklist(arg, text, H) {  // - [x] gotowe / - [ ] do zrobienia
    var ul = H.h("ul", { "class": "kn-checks" });
    lines(text).slice(0, 40).forEach(function (ln) {
      var m = /^[-*]\s*\[( |x|X)\]\s*(.*)$/.exec(ln.trim()); if (!m) return;
      var done = m[1] !== " ", li = H.h("li", { "class": done ? "done" : "" }, [H.h("span", { "class": "kn-ck", "aria-hidden": "true", text: done ? "✓" : "" })]);
      var s = H.h("span", { "class": "kn-ck-t" }); s.appendChild(H.inline(m[2])); li.appendChild(s);
      li.setAttribute("aria-label", (done ? "zrobione: " : "do zrobienia: ") + m[2]); ul.appendChild(li);
    });
    return ul;
  }
  function details(arg, text, H) {    // zwijana sekcja (natywny <details>)
    var d = H.h("details", { "class": "kn-details" }, [H.h("summary", { text: arg || "Pokaż więcej" })]);
    d.appendChild(H.h("div", { "class": "kn-details-b" }, [H.md(text)])); return d;
  }
  function tabs(arg, text, H) {       // sekcje oddzielone liniami „=== Tytuł”
    var secs = [], cur = null, fence = false;
    String(text || "").split("\n").forEach(function (ln) {
      if (/^\s*(```|~~~)/.test(ln)) fence = !fence;
      var m = !fence && /^===\s+(.+)$/.exec(ln);
      if (m) { cur = { t: cut(m[1].trim(), 30), lines: [] }; secs.push(cur); return; }
      if (cur) cur.lines.push(ln);
    });
    secs = secs.slice(0, 8); if (!secs.length) return warn(H, "Zakładki: zacznij każdą sekcję od linii „=== Tytuł”.");
    var bar = H.h("div", { "class": "esn-tabs", role: "tablist" }), panels = [], btns = [];
    secs.forEach(function (s, i) {
      var p = H.h("div", { "class": "kn-tab-panel", role: "tabpanel" }, [H.md(s.lines.join("\n"))]);
      var b = H.h("button", { type: "button", role: "tab", text: s.t }); b.addEventListener("click", function () { sel(i); });
      btns.push(b); panels.push(p); bar.appendChild(b);
    });
    function sel(k) { btns.forEach(function (b, i) { b.setAttribute("aria-selected", String(i === k)); panels[i].style.display = i === k ? "" : "none"; }); }
    sel(0);
    return H.h("div", { "class": "kn-tabs" }, [bar].concat(panels));
  }

  var MAP = { flow: flow, er: er, sequence: sequence, steps: steps, timeline: timeline, progress: progress, def: defs, checklist: checklist, details: details, tabs: tabs };
  global.ESNKnowledgeBlocks = {
    names: Object.keys(MAP),
    render: function (name, arg, text, H) { var f = MAP[name]; return f ? f(arg || "", text || "", H) : null; }
  };
})(window);
