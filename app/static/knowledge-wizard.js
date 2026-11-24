/* Prosty kreator treści (v9): edycja artykułu jako listy bloków z formularzami zamiast ręcznego markdownu.
 * Jedynym źródłem prawdy pozostaje pole tekstowe (markdown z blokami) – kreator je czyta i zapisuje, więc można
 * w każdej chwili przełączyć się na tryb zaawansowany bez utraty treści.
 * API: ESNKnowledgeWizard.create({ ta, h, getWidgets, getImages, parseBlocks, toast, onChange }) → { el, refresh() }
 */
(function (global) {
  var COLORS = [["", "domyślny"], ["green", "zielony"], ["orange", "pomarańczowy"], ["accent", "akcent"], ["red", "czerwony"]];

  /* definicje bloków: kind = text (tytuł + treść) | rows (tabela pól) | check | code | widget | md */
  var DEFS = {
    md: { label: "Tekst (markdown)", kind: "md", init: { text: "Nowy akapit." }, group: "Treść" },
    code: { label: "Kod", kind: "code", init: { lang: "cpp", title: "", text: "void setup() {}\n\nvoid loop() {}" }, group: "Treść" },
    summary: { label: "Podsumowanie", kind: "text", title: "Szybkie podsumowanie", text: "- punkt pierwszy\n- punkt drugi", hint: "Lista punktów: zaczynaj linie od „- ”.", group: "Ramki" },
    card: { label: "Karta", kind: "text", title: "Tytuł karty", text: "Treść karty.", group: "Ramki" },
    note: { label: "Notatka", kind: "text", title: "Notatka", text: "Treść.", group: "Ramki" },
    info: { label: "Informacja", kind: "text", title: "Informacja", text: "Treść.", group: "Ramki" },
    warn: { label: "Uwaga", kind: "text", title: "Uwaga", text: "Treść.", group: "Ramki" },
    danger: { label: "Krytyczne", kind: "text", title: "Krytyczne", text: "Treść.", group: "Ramki" },
    ok: { label: "Rozwiązanie / wskazówka", kind: "text", title: "Rozwiązanie", text: "Treść.", group: "Ramki" },
    neutral: { label: "Szara ramka", kind: "text", title: "Informacja dodatkowa", text: "Treść pomocnicza.", group: "Ramki" },
    details: { label: "Zwijana sekcja", kind: "text", title: "Pokaż więcej", text: "Treść widoczna po rozwinięciu.", group: "Ramki" },
    pros: { label: "Plusy", kind: "text", title: "PLUSY", text: "- zaleta", group: "Ramki" },
    cons: { label: "Minusy", kind: "text", title: "MINUSY", text: "- wada", group: "Ramki" },
    kv: { label: "Parametry (klucz – wartość)", kind: "rows", cols: [["Klucz"], ["Wartość"]], rows: [["CPU", "Xtensa LX6 · 240 MHz"], ["ADC", "12-bit"]], group: "Dane" },
    stats: { label: "Statystyki (kafelki)", kind: "rows", cols: [["Etykieta"], ["Wartość"], ["Jednostka"], ["Kolor", COLORS]], rows: [["Baud", "115200", "bps", "green"]], group: "Dane" },
    progress: { label: "Paski postępu", kind: "rows", cols: [["Etykieta"], ["%"], ["Opis"], ["Kolor", COLORS]], rows: [["RAM", "60", "", "orange"]], group: "Dane" },
    def: { label: "Definicje", kind: "rows", cols: [["Termin"], ["Definicja"]], rows: [["ISR", "Procedura obsługi przerwania"]], group: "Dane" },
    steps: { label: "Kroki", kind: "rows", cols: [["Tytuł kroku"], ["Opis"]], rows: [["Pierwszy krok", "Opis"], ["Drugi krok", ""]], title: "", group: "Dane" },
    timeline: { label: "Oś czasu", kind: "rows", cols: [["Data / etykieta"], ["Tytuł"], ["Opis"]], rows: [["1971", "Intel 4004", "Pierwszy mikroprocesor"]], title: "", group: "Dane" },
    checklist: { label: "Lista kontrolna", kind: "check", group: "Dane" },
    flow: { label: "Diagram: algorytm", kind: "text", title: "Algorytm", group: "Diagramy",
      text: "(s) Start\n[a] Krok\n{c} Warunek?\n(e) Koniec\ns -> a\na -> c\nc -> e : tak\nc -> a : nie",
      hint: "(id) początek/koniec, [id] krok, {id} decyzja, a -> b : etykieta." },
    er: { label: "Diagram: baza danych", kind: "text", title: "Relacje", group: "Diagramy",
      text: "users: id PK, login\nprojects: id PK, owner_id FK, title\nusers 1--* projects : posiada",
      hint: "tabela: kolumna PK, kolumna FK; relacja: a 1--* b : etykieta." },
    sequence: { label: "Diagram: komunikacja", kind: "text", title: "Komunikacja", group: "Diagramy",
      text: "MCU, PC\nMCU -> PC : ramka\nPC --> MCU : ACK", hint: "Pierwsza linia: uczestnicy po przecinku. A -> B : treść, A --> B linia przerywana." },
    tabs: { label: "Zakładki", kind: "text", title: "", group: "Zaawansowane", text: "=== Pierwsza\nTreść pierwszej zakładki.\n=== Druga\nTreść drugiej zakładki.", hint: "Każda zakładka zaczyna się linią „=== Tytuł”." },
    figure: { label: "Rysunek SVG", kind: "text", title: "Podpis rysunku", group: "Zaawansowane",
      text: "<svg viewBox=\"0 0 200 80\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"10\" y=\"10\" width=\"180\" height=\"60\" rx=\"6\" fill=\"none\" stroke=\"#56e1fd\"/></svg>", hint: "Kod SVG (bez skryptów i stylów)." },
    widget: { label: "Widget (interaktywny)", kind: "widget", group: "Zaawansowane" }
  };
  var GROUPS = ["Treść", "Ramki", "Dane", "Diagramy", "Zaawansowane"];

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
      if (!d) { box.appendChild(field("Tytuł", inp(b.arg, function (v) { b.arg = v; push(); }))); box.appendChild(field("Treść", txt(b.text, 5, function (v) { b.text = v; push(); }))); return box; }
      if (d.kind === "md") { box.appendChild(txt(b.text, 6, function (v) { b.text = v; push(); }, "Tekst w markdown: **pogrubienie**, listy, tabele, linki…")); box.appendChild(h("div", { "class": "kn-meta", text: "Markdown: ## nagłówek, **pogrubienie**, `kod`, listy „- ”, tabele, obrazy ![opis](adres)." })); return box; }
      if (d.kind === "code") {
        var langs = ["cpp", "c", "arduino", "python", "bash", "yaml", "json", "ini", "rust", "js", "html", "md"];
        var sel = h("select", { "class": "sort-select", "aria-label": "Język" }, langs.map(function (l) { return h("option", { value: l, text: l }); })); sel.value = langs.indexOf(b.lang) >= 0 ? b.lang : "cpp"; b.lang = sel.value;
        sel.addEventListener("change", function () { b.lang = sel.value; push(); });
        box.appendChild(h("div", { "class": "kn-inline" }, [h("label", { "class": "kn-fld kn-wiz-f" }, [h("span", { text: "Język" }), sel]), field("Tytuł (opcjonalnie)", inp(b.title, function (v) { b.title = v; push(); }, "np. Miganie diodą"))]));
        var c = txt(b.text, 8, function (v) { b.text = v; push(); }); c.classList.add("kn-code-in"); box.appendChild(c); return box;
      }
      if (d.kind === "text") {
        if (d.title !== undefined && b.name !== "tabs") box.appendChild(field(d.title === "" ? "Tytuł (opcjonalnie)" : "Tytuł", inp(b.arg, function (v) { b.arg = v; push(); })));
        var t = txt(b.text, b.name === "figure" || d.group === "Diagramy" || b.name === "tabs" ? 8 : 5, function (v) { b.text = v; push(); }); if (d.group === "Diagramy" || b.name === "figure") t.classList.add("kn-code-in"); box.appendChild(t);
        if (d.hint) box.appendChild(h("div", { "class": "kn-meta", text: d.hint }));
        return box;
      }
      if (d.kind === "rows") {
        if (d.title !== undefined) box.appendChild(field("Tytuł (opcjonalnie)", inp(b.arg, function (v) { b.arg = v; push(); })));
        var grid = h("div", { "class": "kn-wiz-rows" });
        var draw = function () {
          grid.textContent = "";
          grid.appendChild(h("div", { "class": "kn-wiz-row kn-wiz-head", style: "grid-template-columns:repeat(" + d.cols.length + ",1fr) 34px" }, d.cols.map(function (c) { return h("span", { text: c[0] }); }).concat([h("span")])));
          b.rows.forEach(function (r, ri) {
            var cs = d.cols.map(function (c, ci) {
              if (c[1]) { var s = h("select", { "class": "sort-select", "aria-label": c[0] }, c[1].map(function (x) { return h("option", { value: x[0], text: x[1] }); })); s.value = r[ci] || ""; s.addEventListener("change", function () { r[ci] = s.value; push(); }); return s; }
              return inp(r[ci], function (v) { r[ci] = v; push(); }, c[0], 200);
            });
            grid.appendChild(h("div", { "class": "kn-wiz-row", style: "grid-template-columns:repeat(" + d.cols.length + ",1fr) 34px" }, cs.concat([h("button", { type: "button", "class": "kn-mini", title: "Usuń wiersz", "aria-label": "Usuń wiersz", text: "×", onclick: function () { b.rows.splice(ri, 1); draw(); push(); } })])));
          });
        };
        box.appendChild(grid); draw();
        box.appendChild(h("button", { type: "button", "class": "btn-action", text: "+ Dodaj wiersz", onclick: function () { b.rows.push(d.cols.map(function () { return ""; })); draw(); } }));
        return box;
      }
      if (d.kind === "check") {
        var cg = h("div", { "class": "kn-wiz-rows" });
        var drawC = function () {
          cg.textContent = "";
          b.rows.forEach(function (r, ri) {
            var cb = h("input", { type: "checkbox", "aria-label": "Zrobione" }); cb.checked = !!r[0]; cb.addEventListener("change", function () { r[0] = cb.checked; push(); });
            cg.appendChild(h("div", { "class": "kn-wiz-row kn-wiz-check" }, [cb, inp(r[1], function (v) { r[1] = v; push(); }, "Punkt listy", 200), h("button", { type: "button", "class": "kn-mini", "aria-label": "Usuń punkt", text: "×", onclick: function () { b.rows.splice(ri, 1); drawC(); push(); } })]));
          });
        };
        box.appendChild(cg); drawC();
        box.appendChild(h("button", { type: "button", "class": "btn-action", text: "+ Dodaj punkt", onclick: function () { b.rows.push([false, ""]); drawC(); } }));
        return box;
      }
      if (d.kind === "widget") {
        var names = Object.keys(o.getWidgets());
        var ws = h("select", { "class": "sort-select", "aria-label": "Widget" }, [h("option", { value: "", text: "— wybierz widget —" })].concat(names.map(function (n) { return h("option", { value: n, text: n }); })));
        if (b.wname && names.indexOf(b.wname) < 0) ws.appendChild(h("option", { value: b.wname, text: b.wname + " (brak)" }));
        ws.value = b.wname || ""; ws.addEventListener("change", function () { b.wname = ws.value; push(); });
        var hh = h("input", { type: "number", "class": "text-input kn-num", min: 80, max: 1200, value: b.wh || 320, "aria-label": "Wysokość" }); hh.addEventListener("input", function () { b.wh = hh.value; push(); });
        box.appendChild(h("div", { "class": "kn-inline" }, [field("Widget", ws), field("Wysokość (px)", hh)]));
        box.appendChild(h("div", { "class": "kn-meta", text: names.length ? "Kod widgetów edytujesz w sekcji „Widgety” poniżej (tam też dodasz nowy z szablonu)." : "Najpierw dodaj widget w sekcji „Widgety” poniżej, potem wybierz go tutaj." }));
        return box;
      }
      return box;
    }

    function draw() {
      list.textContent = "";
      if (!blocks.length) list.appendChild(h("div", { "class": "kn-empty", text: "Pusto. Dodaj pierwszy blok z listy poniżej." }));
      blocks.forEach(function (b, i) {
        var d = DEFS[b.name], label = d ? d.label : "Blok „" + b.name + "”";
        function mv(delta) { var j = i + delta; if (j < 0 || j >= blocks.length) return; var t = blocks[i]; blocks[i] = blocks[j]; blocks[j] = t; draw(); push(); }
        var head = h("div", { "class": "kn-wiz-head-bar" }, [h("strong", { text: (i + 1) + ". " + label }), h("span", { "class": "kn-wiz-acts" }, [
          h("button", { type: "button", "class": "kn-mini", title: "W górę", "aria-label": "Przesuń w górę", text: "↑", disabled: i === 0, onclick: function () { mv(-1); } }),
          h("button", { type: "button", "class": "kn-mini", title: "W dół", "aria-label": "Przesuń w dół", text: "↓", disabled: i === blocks.length - 1, onclick: function () { mv(1); } }),
          h("button", { type: "button", "class": "kn-mini", title: "Duplikuj", "aria-label": "Duplikuj blok", text: "⧉", onclick: function () { blocks.splice(i + 1, 0, JSON.parse(JSON.stringify(b))); draw(); push(); } }),
          h("button", { type: "button", "class": "kn-mini kn-mini-del", title: "Usuń blok", "aria-label": "Usuń blok", text: "×", onclick: function () { blocks.splice(i, 1); draw(); push(); } })])]);
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
    add.appendChild(h("span", { "class": "kn-meta", text: "Dodaj blok:" })); add.appendChild(pick);
    add.appendChild(h("button", { type: "button", "class": "btn-action primary", text: "+ Dodaj", onclick: function () { blocks.push(newBlock(pick.value)); draw(); push(); list.lastChild && list.lastChild.scrollIntoView({ block: "nearest" }); } }));
    add.appendChild(h("button", { type: "button", "class": "btn-action", text: "+ Obraz", onclick: function () {
      if (!o.getImages) return;
      o.getImages().then(function (items) {
        if (!items.length) return o.toast("Brak wgranych obrazów – dodaj je w sekcji „Obrazy” poniżej (po zapisaniu treści).", "error");
        var m = items[items.length - 1]; blocks.push({ name: "md", text: "![" + (m.caption || "opis obrazu").replace(/[\[\]\n]/g, " ") + "](" + m.url + ")" }); draw(); push();
        o.toast("Dodano ostatnio wgrany obraz. Zmień opis w bloku.", "success");
      }).catch(function (e) { o.toast(e.message, "error"); });
    } }));

    if (o.templates && o.templates.length) {
      var tsel = h("select", { "class": "sort-select", "aria-label": "Szablon treści" }, [h("option", { value: "", text: "Wstaw szablon…" })].concat(o.templates.map(function (t, i) { return h("option", { value: String(i), text: t.name + " – " + t.desc }); })));
      tsel.addEventListener("change", function () {
        if (tsel.value === "") return;
        var t = o.templates[+tsel.value]; tsel.value = "";
        var empty = !blocks.length || (blocks.length === 1 && blocks[0].name === "md" && !blocks[0].text.trim());
        var nb = parse(t.body).filter(function (b) { return allowed(b.name); });
        blocks = empty ? nb : blocks.concat(nb); draw(); push();
        o.toast(empty ? "Wstawiono szablon „" + t.name + "”. Zmień teksty w blokach." : "Dopisano szablon „" + t.name + "” na końcu treści.", "success");
      });
      add.appendChild(tsel);
    }
    return { el: el, refresh: function () { blocks = parse(ta.value); if (!blocks.length) blocks = [{ name: "md", text: "" }]; draw(); } };
  }

  global.ESNKnowledgeWizard = { create: create, defs: DEFS };
})(window);
