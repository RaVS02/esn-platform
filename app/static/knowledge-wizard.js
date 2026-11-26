/* Prosty kreator treści (v9): edycja artykułu jako listy bloków z formularzami zamiast ręcznego markdownu.
 * Jedynym źródłem prawdy pozostaje pole tekstowe (markdown z blokami) – kreator je czyta i zapisuje, więc można
 * w każdej chwili przełączyć się na tryb zaawansowany bez utraty treści.
 * API: ESNKnowledgeWizard.create({ ta, h, getWidgets, getImages, parseBlocks, toast, onChange }) → { el, refresh() }
 */
(function (global) {
  var COLORS = [["", _t('wz.domyslny')], ["green", _t('wz.zielony')], ["orange", _t('wz.pomaranczowy')], ["accent", _t('wz.akcent')], ["red", _t('wz.czerwony')]];

  /* definicje bloków: kind = text (tytuł + treść) | rows (tabela pól) | check | code | widget | md */
  var DEFS = {
    md: { label: _t('wz.tekstMarkdown'), kind: "md", init: { text: _t('wz.nowyAkapit') }, group: _t('wz.tresc') },
    code: { label: _t('wz.kod'), kind: "code", init: { lang: "cpp", title: "", text: "void setup() {}\n\nvoid loop() {}" }, group: _t('wz.tresc') },
    summary: { label: _t('wz.podsumowanie'), kind: "text", title: _t('wz.szybkiePodsumowanie'), text: "- punkt pierwszy\n- punkt drugi", hint: _t('wz.listaPunktowZaczynajLinie'), group: _t('wz.ramki') },
    card: { label: _t('wz.karta'), kind: "text", title: _t('wz.tytulKarty'), text: _t('wz.trescKarty'), group: _t('wz.ramki') },
    note: { label: _t('wz.notatka'), kind: "text", title: _t('wz.notatka'), text: _t('wz.tresc2'), group: _t('wz.ramki') },
    info: { label: _t('wz.informacja'), kind: "text", title: _t('wz.informacja'), text: _t('wz.tresc2'), group: _t('wz.ramki') },
    warn: { label: _t('wz.uwaga'), kind: "text", title: _t('wz.uwaga'), text: _t('wz.tresc2'), group: _t('wz.ramki') },
    danger: { label: _t('wz.krytyczne'), kind: "text", title: _t('wz.krytyczne'), text: _t('wz.tresc2'), group: _t('wz.ramki') },
    ok: { label: _t('wz.rozwiazanieWskazowka'), kind: "text", title: _t('wz.rozwiazanie'), text: _t('wz.tresc2'), group: _t('wz.ramki') },
    neutral: { label: _t('wz.szaraRamka'), kind: "text", title: _t('wz.informacjaDodatkowa'), text: _t('wz.trescPomocnicza'), group: _t('wz.ramki') },
    details: { label: _t('wz.zwijanaSekcja'), kind: "text", title: _t('wz.pokazWiecej'), text: _t('wz.trescWidocznaPoRozwinieciu'), group: _t('wz.ramki') },
    pros: { label: _t('wz.plusy'), kind: "text", title: _t('wz.plusy2'), text: "- zaleta", group: _t('wz.ramki') },
    cons: { label: _t('wz.minusy'), kind: "text", title: _t('wz.minusy2'), text: "- wada", group: _t('wz.ramki') },
    kv: { label: _t('wz.parametryKluczWartosc'), kind: "rows", cols: [[_t('wz.klucz')], [_t('wz.wartosc')]], rows: [["CPU", "Xtensa LX6 · 240 MHz"], ["ADC", "12-bit"]], group: _t('wz.dane') },
    stats: { label: _t('wz.statystykiKafelki'), kind: "rows", cols: [[_t('wz.etykieta')], [_t('wz.wartosc')], [_t('wz.jednostka')], [_t('wz.kolor'), COLORS]], rows: [["Baud", "115200", "bps", "green"]], group: _t('wz.dane') },
    progress: { label: _t('wz.paskiPostepu'), kind: "rows", cols: [[_t('wz.etykieta')], ["%"], [_t('wz.opis')], [_t('wz.kolor'), COLORS]], rows: [["RAM", "60", "", "orange"]], group: _t('wz.dane') },
    def: { label: _t('wz.definicje'), kind: "rows", cols: [[_t('wz.termin')], [_t('wz.definicja')]], rows: [["ISR", _t('wz.proceduraObslugiPrzerwania')]], group: _t('wz.dane') },
    steps: { label: _t('wz.kroki'), kind: "rows", cols: [[_t('wz.tytulKroku')], [_t('wz.opis')]], rows: [[_t('wz.pierwszyKrok'), _t('wz.opis')], [_t('wz.drugiKrok'), ""]], title: "", group: _t('wz.dane') },
    timeline: { label: _t('wz.osCzasu'), kind: "rows", cols: [[_t('wz.dataEtykieta')], [_t('wz.tytul')], [_t('wz.opis')]], rows: [["1971", "Intel 4004", _t('wz.pierwszyMikroprocesor')]], title: "", group: _t('wz.dane') },
    checklist: { label: _t('wz.listaKontrolna'), kind: "check", group: _t('wz.dane') },
    flow: { label: _t('wz.diagramAlgorytm'), kind: "text", title: _t('wz.algorytm'), group: _t('wz.diagramy'),
      text: "(s) Start\n[a] Krok\n{c} Warunek?\n(e) Koniec\ns -> a\na -> c\nc -> e : tak\nc -> a : nie",
      hint: _t('wz.idPoczatekKoniecId') },
    er: { label: _t('wz.diagramBazaDanych'), kind: "text", title: _t('wz.relacje'), group: _t('wz.diagramy'),
      text: "users: id PK, login\nprojects: id PK, owner_id FK, title\nusers 1--* projects : posiada",
      hint: "tabela: kolumna PK, kolumna FK; relacja: a 1--* b : etykieta." },
    sequence: { label: _t('wz.diagramKomunikacja'), kind: "text", title: _t('wz.komunikacja'), group: _t('wz.diagramy'),
      text: "MCU, PC\nMCU -> PC : ramka\nPC --> MCU : ACK", hint: _t('wz.pierwszaLiniaUczestnicyPo') },
    tabs: { label: _t('wz.zakladki'), kind: "text", title: "", group: _t('wz.zaawansowane'), text: "=== Pierwsza\nTreść pierwszej zakładki.\n=== Druga\nTreść drugiej zakładki.", hint: _t('wz.kazdaZakladkaZaczynaSie') },
    figure: { label: _t('wz.rysunekSvg'), kind: "text", title: _t('wz.podpisRysunku'), group: _t('wz.zaawansowane'),
      text: "<svg viewBox=\"0 0 200 80\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"10\" y=\"10\" width=\"180\" height=\"60\" rx=\"6\" fill=\"none\" stroke=\"#56e1fd\"/></svg>", hint: _t('wz.kodSvgBezSkryptow') },
    widget: { label: _t('wz.widgetInteraktywny'), kind: "widget", group: _t('wz.zaawansowane') }
  };
  var GROUPS = [_t('wz.tresc'), _t('wz.ramki'), _t('wz.dane'), _t('wz.diagramy'), _t('wz.zaawansowane')];

  function splitCode(md) {
    var out = [], last = 0, re = /^```([^\n`]*)\n([\s\S]*?)\n?```[ \t]*$/gm, m;
    while ((m = re.exec(md))) {
      if (m.index > last) out.push({ name: "md", text: md.slice(last, m.index) });
      var info = (m[1] || "").trim(), sp = info.indexOf(" ");
      out.push({ name: "code", lang: (sp < 0 ? info : info.slice(0, sp)) || "cpp", title: sp < 0 ? "" : info.slice(sp + 1).trim(), text: m[2] });
      last = m.index + m[0].length;
    }
    if (last < md.length) out.push({ name: "md", text: md.slice(last) });
    return out;
  }
  function cells(ln, n) { var p = ln.split("|").map(function (x) { return x.trim(); }); if (p.length > n) p = p.slice(0, n - 1).concat([p.slice(n - 1).join(" | ")]); while (p.length < n) p.push(""); return p; }

  function create(o) {
    var h = o.h, ta = o.ta, blocks = [];
    var allow = o.allow || null;   // ograniczenie listy dostępnych bloków (np. dla użytkowników)
    function allowed(k) { return !allow || allow.indexOf(k) >= 0; }
    var el = h("div", { "class": "kn-wiz" }), list = h("div", { "class": "kn-wiz-list" }), add = h("div", { "class": "kn-wiz-add" });
    el.appendChild(list); el.appendChild(add);

    function parse(text) {
      var out = [];
      o.parseBlocks(text).forEach(function (b) {
        if (b.type === "md") { splitCode(b.text).forEach(function (p) { if (p.name === "code" || p.text.trim()) out.push(p.name === "md" ? { name: "md", text: p.text.replace(/^\n+|\n+$/g, "") } : p); }); return; }
        var d = DEFS[b.name], bl = { name: b.name, arg: b.arg || "", text: b.text };
        if (d && d.kind === "rows") bl.rows = b.text.split("\n").filter(function (x) { return x.trim(); }).map(function (x) { return cells(x, d.cols.length); });
        if (d && d.kind === "check") bl.rows = b.text.split("\n").map(function (x) { return /^[-*]\s*\[( |x|X)\]\s*(.*)$/.exec(x.trim()); }).filter(Boolean).map(function (m) { return [m[1] !== " ", m[2]]; });
        if (d && d.kind === "widget") { var a = bl.arg.split(/\s+/); bl.wname = a[0] || ""; bl.wh = a[1] || "320"; }
        out.push(bl);
      });
      return out;
    }
    function ser(b) {
      var d = DEFS[b.name];
      if (b.name === "md") return b.text;
      if (b.name === "code") return "```" + (b.lang || "") + (b.title ? " " + b.title : "") + "\n" + b.text + "\n```";
      var arg = b.arg, text = b.text;
      if (d && d.kind === "rows") text = b.rows.filter(function (r) { return r.some(function (c) { return String(c).trim(); }); }).map(function (r) { return r.map(function (c) { return String(c).replace(/\n/g, " "); }).join(" | "); }).join("\n");
      if (d && d.kind === "check") text = b.rows.filter(function (r) { return String(r[1]).trim(); }).map(function (r) { return "- [" + (r[0] ? "x" : " ") + "] " + String(r[1]).replace(/\n/g, " "); }).join("\n");
      if (d && d.kind === "widget") { arg = (b.wname || "") + (b.wh ? " " + b.wh : ""); text = ""; }
      return ":::" + b.name + (arg ? " " + arg : "") + "\n" + text + "\n:::";
    }
    function push() { ta.value = blocks.map(ser).join("\n\n") + "\n"; o.onChange(); }

    function field(label, node) { return h("label", { "class": "kn-fld kn-wiz-f" }, [h("span", { text: label }), node]); }
    function txt(value, rows, on, ph) { var t = h("textarea", { "class": "text-input kn-wiz-ta", rows: rows || 4, spellcheck: "true", placeholder: ph || "" }); t.value = value || ""; t.addEventListener("input", function () { on(t.value); }); return t; }
    function inp(value, on, ph, ml) { var i = h("input", { "class": "text-input", value: value || "", placeholder: ph || "", maxlength: ml || 150 }); i.addEventListener("input", function () { on(i.value); }); return i; }

    function body(b) {
      var d = DEFS[b.name], box = h("div", { "class": "kn-wiz-body" });
      if (!d) { box.appendChild(field(_t('wz.tytul'), inp(b.arg, function (v) { b.arg = v; push(); }))); box.appendChild(field(_t('wz.tresc'), txt(b.text, 5, function (v) { b.text = v; push(); }))); return box; }
      if (d.kind === "md") { box.appendChild(txt(b.text, 6, function (v) { b.text = v; push(); }, _t('wz.tekstWMarkdownPogrubienie'))); box.appendChild(h("div", { "class": "kn-meta", text: _t('wz.markdownNaglowekPogrubienieKod') })); return box; }
      if (d.kind === "code") {
        var langs = ["cpp", "c", "arduino", "python", "bash", "yaml", "json", "ini", "rust", "js", "html", "md"];
        var sel = h("select", { "class": "sort-select", "aria-label": _t('wz.jezyk') }, langs.map(function (l) { return h("option", { value: l, text: l }); })); sel.value = langs.indexOf(b.lang) >= 0 ? b.lang : "cpp"; b.lang = sel.value;
        sel.addEventListener("change", function () { b.lang = sel.value; push(); });
        box.appendChild(h("div", { "class": "kn-inline" }, [h("label", { "class": "kn-fld kn-wiz-f" }, [h("span", { text: _t('wz.jezyk') }), sel]), field(_t('wz.tytulOpcjonalnie'), inp(b.title, function (v) { b.title = v; push(); }, _t('wz.npMiganieDioda')))]));
        var c = txt(b.text, 8, function (v) { b.text = v; push(); }); c.classList.add("kn-code-in"); box.appendChild(c); return box;
      }
      if (d.kind === "text") {
        if (d.title !== undefined && b.name !== "tabs") box.appendChild(field(d.title === "" ? _t('wz.tytulOpcjonalnie') : _t('wz.tytul'), inp(b.arg, function (v) { b.arg = v; push(); })));
        var t = txt(b.text, b.name === "figure" || d.group === _t('wz.diagramy') || b.name === "tabs" ? 8 : 5, function (v) { b.text = v; push(); }); if (d.group === _t('wz.diagramy') || b.name === "figure") t.classList.add("kn-code-in"); box.appendChild(t);
        if (d.hint) box.appendChild(h("div", { "class": "kn-meta", text: d.hint }));
        return box;
      }
      if (d.kind === "rows") {
        if (d.title !== undefined) box.appendChild(field(_t('wz.tytulOpcjonalnie'), inp(b.arg, function (v) { b.arg = v; push(); })));
        var grid = h("div", { "class": "kn-wiz-rows" });
        var draw = function () {
          grid.textContent = "";
          grid.appendChild(h("div", { "class": "kn-wiz-row kn-wiz-head", style: "grid-template-columns:repeat(" + d.cols.length + ",1fr) 34px" }, d.cols.map(function (c) { return h("span", { text: c[0] }); }).concat([h("span")])));
          b.rows.forEach(function (r, ri) {
            var cs = d.cols.map(function (c, ci) {
              if (c[1]) { var s = h("select", { "class": "sort-select", "aria-label": c[0] }, c[1].map(function (x) { return h("option", { value: x[0], text: x[1] }); })); s.value = r[ci] || ""; s.addEventListener("change", function () { r[ci] = s.value; push(); }); return s; }
              return inp(r[ci], function (v) { r[ci] = v; push(); }, c[0], 200);
            });
            grid.appendChild(h("div", { "class": "kn-wiz-row", style: "grid-template-columns:repeat(" + d.cols.length + ",1fr) 34px" }, cs.concat([h("button", { type: "button", "class": "kn-mini", title: _t('wz.usunWiersz'), "aria-label": _t('wz.usunWiersz'), text: "×", onclick: function () { b.rows.splice(ri, 1); draw(); push(); } })])));
          });
        };
        box.appendChild(grid); draw();
        box.appendChild(h("button", { type: "button", "class": "btn-action", text: _t('wz.dodajWiersz'), onclick: function () { b.rows.push(d.cols.map(function () { return ""; })); draw(); } }));
        return box;
      }
      if (d.kind === "check") {
        var cg = h("div", { "class": "kn-wiz-rows" });
        var drawC = function () {
          cg.textContent = "";
          b.rows.forEach(function (r, ri) {
            var cb = h("input", { type: "checkbox", "aria-label": "Zrobione" }); cb.checked = !!r[0]; cb.addEventListener("change", function () { r[0] = cb.checked; push(); });
            cg.appendChild(h("div", { "class": "kn-wiz-row kn-wiz-check" }, [cb, inp(r[1], function (v) { r[1] = v; push(); }, _t('wz.punktListy'), 200), h("button", { type: "button", "class": "kn-mini", "aria-label": _t('wz.usunPunkt'), text: "×", onclick: function () { b.rows.splice(ri, 1); drawC(); push(); } })]));
          });
        };
        box.appendChild(cg); drawC();
        box.appendChild(h("button", { type: "button", "class": "btn-action", text: _t('wz.dodajPunkt'), onclick: function () { b.rows.push([false, ""]); drawC(); } }));
        return box;
      }
      if (d.kind === "widget") {
        var names = Object.keys(o.getWidgets());
        var ws = h("select", { "class": "sort-select", "aria-label": _t('wz.widget') }, [h("option", { value: "", text: "— wybierz widget —" })].concat(names.map(function (n) { return h("option", { value: n, text: n }); })));
        if (b.wname && names.indexOf(b.wname) < 0) ws.appendChild(h("option", { value: b.wname, text: b.wname + " (brak)" }));
        ws.value = b.wname || ""; ws.addEventListener("change", function () { b.wname = ws.value; push(); });
        var hh = h("input", { type: "number", "class": "text-input kn-num", min: 80, max: 1200, value: b.wh || 320, "aria-label": _t('wz.wysokosc') }); hh.addEventListener("input", function () { b.wh = hh.value; push(); });
        box.appendChild(h("div", { "class": "kn-inline" }, [field(_t('wz.widget'), ws), field(_t('wz.wysokoscPx'), hh)]));
        box.appendChild(h("div", { "class": "kn-meta", text: names.length ? _t('wz.kodWidgetowEdytujeszW') : _t('wz.najpierwDodajWidgetW') }));
        return box;
      }
      return box;
    }

    function draw() {
      list.textContent = "";
      if (!blocks.length) list.appendChild(h("div", { "class": "kn-empty", text: _t('wz.pustoDodajPierwszyBlok') }));
      blocks.forEach(function (b, i) {
        var d = DEFS[b.name], label = d ? d.label : "Blok „" + b.name + "”";
        function mv(delta) { var j = i + delta; if (j < 0 || j >= blocks.length) return; var t = blocks[i]; blocks[i] = blocks[j]; blocks[j] = t; draw(); push(); }
        var head = h("div", { "class": "kn-wiz-head-bar" }, [h("strong", { text: (i + 1) + ". " + label }), h("span", { "class": "kn-wiz-acts" }, [
          h("button", { type: "button", "class": "kn-mini", title: _t('wz.wGore'), "aria-label": _t('wz.przesunWGore'), text: "↑", disabled: i === 0, onclick: function () { mv(-1); } }),
          h("button", { type: "button", "class": "kn-mini", title: _t('wz.wDol'), "aria-label": _t('wz.przesunWDol'), text: "↓", disabled: i === blocks.length - 1, onclick: function () { mv(1); } }),
          h("button", { type: "button", "class": "kn-mini", title: "Duplikuj", "aria-label": "Duplikuj blok", text: "⧉", onclick: function () { blocks.splice(i + 1, 0, JSON.parse(JSON.stringify(b))); draw(); push(); } }),
          h("button", { type: "button", "class": "kn-mini kn-mini-del", title: _t('wz.usunBlok'), "aria-label": _t('wz.usunBlok'), text: "×", onclick: function () { blocks.splice(i, 1); draw(); push(); } })])]);
        list.appendChild(h("div", { "class": "kn-wiz-card" }, [head, body(b)]));
      });
    }

    function newBlock(name) {
      var d = DEFS[name], b = { name: name, arg: d.title !== undefined ? d.title : "", text: d.text || "" };
      if (name === "md") b.text = d.init.text;
      if (name === "code") { b.lang = d.init.lang; b.title = d.init.title; b.text = d.init.text; }
      if (d.kind === "rows") b.rows = JSON.parse(JSON.stringify(d.rows));
      if (d.kind === "check") b.rows = [[false, "Pierwszy punkt"], [false, "Drugi punkt"]];
      if (d.kind === "widget") { var n = Object.keys(o.getWidgets()); b.wname = n[0] || ""; b.wh = "320"; }
      return b;
    }
    var pick = h("select", { "class": "sort-select", "aria-label": "Typ nowego bloku" }, GROUPS.filter(function (g) { return Object.keys(DEFS).some(function (k) { return DEFS[k].group === g && allowed(k); }); }).map(function (g) {
      return h("optgroup", { label: g }, Object.keys(DEFS).filter(function (k) { return DEFS[k].group === g && allowed(k); }).map(function (k) { return h("option", { value: k, text: DEFS[k].label }); }));
    }));
    add.appendChild(h("span", { "class": "kn-meta", text: _t('wz.dodajBlok') })); add.appendChild(pick);
    add.appendChild(h("button", { type: "button", "class": "btn-action primary", text: _t('wz.dodaj'), onclick: function () { blocks.push(newBlock(pick.value)); draw(); push(); list.lastChild && list.lastChild.scrollIntoView({ block: "nearest" }); } }));
    add.appendChild(h("button", { type: "button", "class": "btn-action", text: _t('wz.obraz'), onclick: function () {
      if (!o.getImages) return;
      o.getImages().then(function (items) {
        if (!items.length) return o.toast(_t('wz.brakWgranychObrazowDodaj'), "error");
        var m = items[items.length - 1]; blocks.push({ name: "md", text: "![" + (m.caption || "opis obrazu").replace(/[\[\]\n]/g, " ") + "](" + m.url + ")" }); draw(); push();
        o.toast(_t('wz.dodanoOstatnioWgranyObraz'), "success");
      }).catch(function (e) { o.toast(e.message, "error"); });
    } }));

    if (o.templates && o.templates.length) {
      var tsel = h("select", { "class": "sort-select", "aria-label": _t('wz.szablonTresci') }, [h("option", { value: "", text: _t('wz.wstawSzablon') })].concat(o.templates.map(function (t, i) { return h("option", { value: String(i), text: t.name + " – " + t.desc }); })));
      tsel.addEventListener("change", function () {
        if (tsel.value === "") return;
        var t = o.templates[+tsel.value]; tsel.value = "";
        var empty = !blocks.length || (blocks.length === 1 && blocks[0].name === "md" && !blocks[0].text.trim());
        var nb = parse(t.body).filter(function (b) { return allowed(b.name); });
        blocks = empty ? nb : blocks.concat(nb); draw(); push();
        o.toast(empty ? _t('wz.wstawionoSzablon') + t.name + _t('wz.zmienTekstyWBlokach') : _t('wz.dopisanoSzablon') + t.name + _t('wz.naKoncuTresci'), "success");
      });
      add.appendChild(tsel);
    }
    return { el: el, refresh: function () { blocks = parse(ta.value); if (!blocks.length) blocks = [{ name: "md", text: "" }]; draw(); } };
  }

  global.ESNKnowledgeWizard = { create: create, defs: DEFS };
})(window);
