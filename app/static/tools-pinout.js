/* Narzędzie „Pinout”: galeria przykładów + edytor na żywo z wersjami językowymi, importem i eksportem.
 * To samo narzędzie (moduł ESNPinout) działa w formularzu komponentu – tu jest jego samodzielna wersja. */
(function (global) {
  "use strict";
  function _t(k, p) { return global.ESNI18n.t(k, p); }

  function mount(el, ctx) {
    var h = ctx.h, P = global.ESNPinout, X = global.ESNPinoutExamples, EX = X.EX, LIST = X.LIST;
    var cur = global.ESNI18n.lang(), image = "", previewLang = cur;

    var tabs = h("div", { "class": "esn-tabs", role: "tablist" });
    var gal = h("div", {}), edit = h("div", { hidden: "hidden" });
    var tb = {};
    [["gal", _t("tp.galeria")], ["edit", _t("tp.edytor")]].forEach(function (t) {
      tb[t[0]] = h("button", { type: "button", role: "tab", text: t[1], "aria-selected": String(t[0] === "edit"), onclick: function () { show(t[0]); } });
      tabs.appendChild(tb[t[0]]);
    });
    function show(k) {
      Object.keys(tb).forEach(function (x) { tb[x].setAttribute("aria-selected", String(x === k)); });
      gal.hidden = k !== "gal"; edit.hidden = k !== "edit";
    }
    el.appendChild(h("p", { "class": "hero-sub tp-lead", text: _t("tp.opis") }));
    el.appendChild(tabs); el.appendChild(gal); el.appendChild(edit);

    /* ── galeria ── */
    LIST.forEach(function (k) {
      var ex = EX[k], slot = h("div");
      gal.appendChild(h("section", { "class": "tp-ex" }, [h("div", { "class": "tp-exh" }, [h("h2", { text: ex.title })]), h("p", { "class": "tp-exd", text: ex.desc }), slot]));
      try { P.mountSection(slot, P.parseText(ex.text), { title: k === "diode" ? "1N4148" : k === "to92" ? "BC547" : undefined }); }
      catch (e) { slot.textContent = _t("tp.blad") + " " + e.message; }
    });

    /* ── edytor ── */
    var src = h("textarea", { "class": "tp-src", spellcheck: "false", "aria-label": _t("tp.opisPinoutu") });
    var err = h("div", { "class": "tp-err", role: "alert" }), prev = h("div");
    var preset = h("select", { "class": "sort-select", "aria-label": _t("tp.wczytajPrzyklad") },
      LIST.map(function (k) { return h("option", { value: k, text: EX[k].title }); }).concat([h("option", { value: "_new", text: _t("tp.pustySzablon") })]));
    var docLang = h("select", { "class": "sort-select", "aria-label": _t("tp.jezykOpisu") });
    var addLang = h("select", { "class": "sort-select", "aria-label": _t("tp.dodajTlumaczenie") });
    var viewLang = h("select", { "class": "sort-select", "aria-label": _t("tp.jezykPodgladu") });
    var zoomBtn = h("button", { type: "button", "class": "btn-action", text: _t("tp.powieksz"), title: _t("tp.powieszPodglad") });
    var exportLang = h("select", { "class": "sort-select", "aria-label": _t("tp.jezykEksportu") });
    var fileIn = h("input", { type: "file", accept: ".txt,.json,text/plain,application/json" });
    var imgIn = h("input", { type: "file", accept: "image/*" });
    var noImg = h("button", { type: "button", "class": "btn-action", text: _t("tp.usunZdjecie"), hidden: "hidden" });
    var pick = h("input", { type: "checkbox", checked: "checked" });
    var pickWrap = h("label", { "class": "tp-pick", hidden: "hidden" }, [pick, " " + _t("tp.klikNaRysunku")]);
    var LN = {}; global.ESNI18n.list().forEach(function (l) { LN[l.code] = l.name; });
    var ALL = global.ESNI18n.list().map(function (l) { return l.code; });

    function btn(text, fn, cls) { var b = h("button", { type: "button", "class": "btn-action" + (cls ? " " + cls : ""), text: text }); b.addEventListener("click", function () { fn(b); }); return b; }
    function fileBtn(text, input) { return h("label", { "class": "btn-action tp-file" }, [text, input]); }
    function copy(text, b) {
      var done = function () { var t = b.textContent; b.textContent = _t("tp.skopiowano"); setTimeout(function () { b.textContent = t; }, 1400); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { global.prompt(_t("tp.skopiuj"), text); });
      else global.prompt(_t("tp.skopiuj"), text);
    }
    function download(name, text, type) {
      var a = h("a", { href: URL.createObjectURL(new Blob([text], { type: type })), download: name });
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
    function doc() { try { var d = P.parseText(src.value); err.textContent = ""; return d; } catch (e) { err.textContent = "⚠ " + e.message; return undefined; } }
    function opt(sel, items, val) {
      sel.textContent = ""; items.forEach(function (i) { sel.appendChild(h("option", { value: i[0], text: i[1] })); });
      if (val != null) sel.value = val;
    }

    function draw() {
      var d = doc(); if (d === undefined) return;
      var langs = d ? P.langs(d) : [];
      var base = (d && d.lang) || "pl";
      /* selektory zależne od dokumentu */
      opt(docLang, ALL.map(function (c) { return [c, LN[c] || c.toUpperCase()]; }), base);
      opt(addLang, [["", "+ " + _t("tp.dodajTlumaczenie")]].concat(ALL.filter(function (c) { return langs.indexOf(c) < 0; }).map(function (c) { return [c, LN[c] || c.toUpperCase()]; })), "");
      opt(viewLang, langs.map(function (c) { return [c, c.toUpperCase()]; }), langs.indexOf(previewLang) >= 0 ? previewLang : base);
      previewLang = viewLang.value || base;
      opt(exportLang, [["", _t("tp.wszystkieJezyki")]].concat(langs.map(function (c) { return [c, c.toUpperCase()]; })), exportLang.value);
      var ctl = d && P.render(prev, d, { image: image, lang: previewLang, onBoardClick: pick.checked ? addPoint : undefined });
      if (!ctl) prev.textContent = "";
      pickWrap.hidden = !(d && d.layout === "board");
    }
    function load(k) { src.value = k === "_new" ? P.TEMPLATE : EX[k].text; previewLang = cur; draw(); }
    function addPoint(x, y) {
      var n = src.value.split(/\r?\n/).filter(function (l) { return /^\s*[^#\s][^|:]*@\s*[\d.]+\s*,/.test(l); }).length + 1;
      src.value = src.value.replace(/\s*$/, "") + "\n" + n + " @" + x + "," + y + " | PIN" + n + " | other | | |\n";
      draw(); src.scrollTop = src.scrollHeight;
    }

    /* zmiana języka bazowego = przepisanie linii `lang:` */
    docLang.addEventListener("change", function () {
      var v = docLang.value;
      src.value = /^lang\s*:/m.test(src.value) ? src.value.replace(/^lang\s*:.*$/m, "lang: " + v) : "lang: " + v + "\n" + src.value;
      draw();
    });
    /* nowy blok [xx] wypełniony tekstami bazowymi do przetłumaczenia */
    addLang.addEventListener("change", function () {
      var lg = addLang.value; if (!lg) return;
      var d = doc(); if (!d) { addLang.value = ""; return; }
      var L = ["", "[" + lg + "]"];
      if (d.view) L.push("view: " + d.view);
      if (d.notes) L.push("notes: " + d.notes);
      (d.groups || []).forEach(function (g) { L.push("group: " + [g.name, g.name, g.note || ""].join(" | ").replace(/( \| )+$/, "")); });
      (d.shapes || []).filter(function (x) { return x.label; }).forEach(function (x) { L.push("shape: " + x.label + " | " + x.label); });
      var rows = d.pins.filter(function (p) { return p.type || p.fn || p.note; });
      if (rows.length) L.push("# nr | typ | funkcja | uwagi");
      rows.forEach(function (p) { L.push([p.n, p.type, p.fn, p.note].join(" | ").replace(/( \| )+$/, "")); });
      src.value = src.value.replace(/\s*$/, "") + "\n" + L.join("\n") + "\n";
      previewLang = lg; draw(); src.scrollTop = src.scrollHeight;
    });
    viewLang.addEventListener("change", function () { previewLang = viewLang.value; draw(); });

    fileIn.addEventListener("change", function (e) {
      var f = e.target.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var t = String(r.result), d = null;
        try {
          if (t.trim().charAt(0) === "{") { d = JSON.parse(t); if (d.pins) t = P.toText(d); }   /* JSON → format tekstowy */
          src.value = t; previewLang = cur; draw(); ctx.toast(_t("tp.zaimportowano"), "success");
        } catch (x) { err.textContent = "⚠ " + x.message; }
        fileIn.value = "";
      };
      r.readAsText(f);
    });
    imgIn.addEventListener("change", function (e) {
      var f = e.target.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        image = String(r.result); noImg.hidden = false;
        if (!/^\s*image_as_background\s*:/m.test(src.value)) src.value = src.value.replace(/^(layout:.*)$/m, "$1\nimage_as_background: tak");
        draw();
      };
      r.readAsDataURL(f);
    });
    noImg.addEventListener("click", function () { image = ""; src.value = src.value.replace(/^image_as_background:.*\n?/m, ""); noImg.hidden = true; imgIn.value = ""; draw(); });
    preset.addEventListener("change", function () { load(preset.value); });
    src.addEventListener("input", draw); pick.addEventListener("change", draw);

    function fname(ext, lg) { var d = doc(); return ((d && d.package) || "pinout").replace(/[^\w.-]+/g, "_") + (lg ? "." + lg : "") + "." + ext; }
    function text() { var d = doc(); return d ? P.toText(d, exportLang.value ? { lang: exportLang.value } : undefined) : ""; }
    function json() {
      var d = doc(); if (!d) return "";
      if (exportLang.value) { d = P.resolve(d, exportLang.value).doc; }
      return JSON.stringify(d, null, 2);
    }

    var bar1 = h("div", { "class": "tp-bar" }, [preset, fileBtn(_t("tp.importujPlik"), fileIn), btn(_t("tp.kopiujTekst"), function (b) { copy(text(), b); }), btn(_t("tp.kopiujJson"), function (b) { copy(json(), b); })]);
    var bar2 = h("div", { "class": "tp-bar" }, [h("span", { "class": "tp-lbl", text: _t("tp.eksport") }), exportLang,
      btn(_t("tp.pobierzTxt"), function () { var t = text(); if (t) download(fname("txt", exportLang.value), t, "text/plain"); }),
      btn(_t("tp.pobierzJson"), function () { var t = json(); if (t) download(fname("json", exportLang.value), t, "application/json"); }),
      fileBtn(_t("tp.zdjeciePlytki"), imgIn), noImg, pickWrap]);
    var bar3 = h("div", { "class": "tp-bar" }, [h("span", { "class": "tp-lbl", text: _t("tp.jezykOpisu") }), docLang, addLang, h("span", { "class": "tp-lbl", text: _t("tp.podglad") }), viewLang]);
    bar3.appendChild(zoomBtn);
    /* powiększony podgląd: pełny ekran, ten sam opis i język; Esc lub „Zamknij” wraca do edytora */
    zoomBtn.addEventListener("click", function () {
      var d = doc(); if (!d) return;
      var ov = h("div", { "class": "tp-full", role: "dialog", "aria-modal": "true", "aria-label": _t("tp.podglad") });
      var body = h("div", { "class": "tp-full-body" });
      function close() { document.removeEventListener("keydown", onKey); ov.remove(); document.body.style.overflow = ""; zoomBtn.focus(); }
      function onKey(e) { if (e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); close(); } }
      ov.appendChild(h("div", { "class": "tp-full-bar" }, [h("strong", { text: (d.package || "Pinout") + " · " + previewLang.toUpperCase() }), btn(_t("tp.zamknij"), close, "primary")]));
      ov.appendChild(body);
      document.body.appendChild(ov); document.body.style.overflow = "hidden"; document.addEventListener("keydown", onKey);
      P.render(body, d, { image: image, lang: previewLang });
    });
    edit.appendChild(bar1); edit.appendChild(bar3); edit.appendChild(bar2);
    edit.appendChild(h("div", { "class": "tp-ed" }, [
      h("div", {}, [src, err, h("p", { "class": "tp-hint", text: _t("tp.format") })]), prev]));
    show("edit"); load("board");
    return function () { image = ""; };
  }

  global.ESNTools.register({ id: "pinout", icon: "fa-solid fa-microchip", title: "tp.nazwa", desc: "tp.krotkiOpis", status: "ready", mount: mount });
})(window);
