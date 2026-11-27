/* ESN Content – przykłady kodu, zasoby do pobrania i relacje projekt ↔ podzespół (v1).
 *
 * Widoki (karta projektu / podzespołu):
 *   ESNContent.codeView(slot, ownerType, ownerId, {fallback:{lang, code}})
 *   ESNContent.resourcesView(slot, ownerType, ownerId, {legacy:[{label,url,rtype}]})
 *   ESNContent.usedComponentsView(slot, projectId, {onOpen(componentId)})
 *   ESNContent.usedInProjectsView(slot, componentId, {onOpen(slug)})
 * Edytory (okna edycji; zapis po zapisaniu obiektu → ctl.save(id) / ctl.flush(id)):
 *   ESNContent.codeEditor(root, {ownerType, ownerId})
 *   ESNContent.componentPicker(root, {projectId})
 *   ESNContent.resourcesManager(root, {ownerType, ownerId, canFiles})
 * Cały tekst z danych trafia do DOM przez textContent – nigdy przez innerHTML.
 */
(function (global) {
  "use strict";

  function h(tag, props, kids) {
    var e = document.createElement(tag), k;
    for (k in (props || {})) {
      if (k === "icon" || k === "iconEnd") continue;
      else if (k === "class") e.className = props[k];
      else if (k === "text") e.textContent = props[k];
      else if (k === "value") e.value = props[k];
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), props[k]);
      else e.setAttribute(k, props[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    if (props && props.icon) e.insertBefore(faIcon(props.icon), e.firstChild);   // v50: ikona Font Awesome (icon / iconEnd)
    if (props && props.iconEnd) e.appendChild(faIcon(props.iconEnd));
    return e;
  }
  function faIcon(n) { var i = document.createElement("i"); i.className = "fa-solid fa-" + n; i.setAttribute("aria-hidden", "true"); return i; }
  function notify(msg, type) { if (typeof global.toast === "function") global.toast(msg, type || "info"); else global.alert(msg); }
  function confirmDel(msg, title) { return typeof global.customConfirm === "function" ? global.customConfirm(msg, title || _t('ct.potwierdzenie')) : Promise.resolve(global.confirm(msg)); }
  function sizeText(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }
  function imgSrc(p) { return p ? "/static/" + p : ""; }

  /* ── API ─────────────────────────────────────────────────────────────── */
  function authH() { var t = ESNAuth.token(); return t ? { Authorization: "Bearer " + t } : {}; }
  function jfetch(url, opts) {
    return fetch(url, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (d) {
        if (!res.ok) {
          var m = typeof d.detail === "string" ? _E(d.detail) : Array.isArray(d.detail) ? d.detail.map(function (x) { return x.msg; }).join("; ")
            : res.status === 401 ? _t('ct.sesjaWygaslaZalogujSie') : _t('ct.bladSerwera') + res.status + ")";
          throw new Error(m);
        }
        return d;
      });
    });
  }
  function jbody(method, data) { return { method: method, headers: Object.assign({ "Content-Type": "application/json" }, authH()), body: JSON.stringify(data) }; }
  var api = {
    components: function (pid) { return jfetch("/api/projects/" + pid + "/components"); },
    setComponents: function (pid, items) { return jfetch("/api/projects/" + pid + "/components", jbody("PUT", { items: items })); },
    componentProjects: function (cid) { return jfetch("/api/catalog/" + cid + "/projects"); },
    code: function (type, id) { return jfetch("/api/code-examples?owner_type=" + type + "&owner_id=" + id); },
    setCode: function (type, id, items) { return jfetch("/api/code-examples", jbody("PUT", { owner_type: type, owner_id: id, items: items })); },
    resources: function (type, id) { return jfetch("/api/resources?owner_type=" + type + "&owner_id=" + id); },
    policy: function () { return jfetch("/api/resources/policy"); },
    addLink: function (d) { return jfetch("/api/resources/link", jbody("POST", d)); },
    addFile: function (d, file) {
      var fd = new FormData();
      Object.keys(d).forEach(function (k) { fd.append(k, d[k]); });
      fd.append("file", file);
      return jfetch("/api/resources/file", { method: "POST", headers: authH(), body: fd });
    },
    patchRes: function (id, d) { return jfetch("/api/resources/" + id, jbody("PATCH", d)); },
    reorderRes: function (type, id, ids) { return jfetch("/api/resources/reorder", jbody("POST", { owner_type: type, owner_id: id, ids: ids })); },
    delRes: function (id) { return jfetch("/api/resources/" + id, { method: "DELETE", headers: authH() }); }
  };
  var DEFAULT_LANGS = { arduino: "Arduino", "esp-idf": "ESP-IDF", platformio: "PlatformIO", esphome: "ESPHome", micropython: "MicroPython",
    circuitpython: "CircuitPython", python: "Python", cpp: "C++", c: "C", rust: "Rust", bash: "Shell", yaml: "YAML", json: "JSON", ini: "INI", other: _t('ct.inne') };
  var langsCache = null;
  function langs() {
    if (langsCache) return Promise.resolve(langsCache);
    return api.code("project", 0).then(function (d) { langsCache = d.langs || DEFAULT_LANGS; return langsCache; }).catch(function () { return DEFAULT_LANGS; });
  }

  /* „NAZWA (SYMBOL)” – bez powtórzenia, gdy symbol == nazwa */
  function partLabel(name, symbol) {
    name = (name || "").trim(); symbol = (symbol || "").trim();
    return symbol && symbol.toLowerCase() !== name.toLowerCase() ? name + " (" + symbol + ")" : name;
  }

  /* kolorowanie składni (highlight.js, motyw jak VS Code Dark+) */
  var HL_MAP = { arduino: "arduino", "esp-idf": "c", platformio: "cpp", esphome: "yaml", micropython: "python", circuitpython: "python",
    python: "python", cpp: "cpp", c: "c", rust: "rust", bash: "bash", yaml: "yaml", json: "json", ini: "ini" };
  function highlightInto(codeEl, code, lang) {
    codeEl.textContent = code;                       // bezpieczny domyślny wariant (bez kolorów)
    var hl = global.hljs; if (!hl) return;
    var l = HL_MAP[lang] || "";
    if (l === "arduino" && !hl.getLanguage("arduino")) l = "cpp";
    try {
      var r = l && hl.getLanguage(l) ? hl.highlight(code, { language: l, ignoreIllegals: true }) : (lang === "other" || !lang ? hl.highlightAuto(code) : null);
      if (r) { codeEl.innerHTML = r.value; codeEl.classList.add("hljs"); }   // wynik hljs jest już escapowany
    } catch (e) { codeEl.textContent = code; }
  }

  function copyText(text, btn) {
    var done = function () { var t = btn.textContent; btn.textContent = _t('ct.skopiowano'); setTimeout(function () { btn.textContent = t; }, 1400); };
    var fallback = function () {
      var ta = h("textarea", { style: "position:fixed;opacity:0;left:-999px" }); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { notify(_t('ct.nieUdaloSieSkopiowac'), "error"); }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && global.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }

  /* ══ WIDOKI ═══════════════════════════════════════════════════════════ */
  function section(slot, title) {
    slot.textContent = "";
    var box = h("div", { "class": "esn-sec" }, [h("h3", { "class": "section-title", text: title })]);
    slot.appendChild(box);
    return box;
  }

  function codeView(slot, ownerType, ownerId, opts) {
    opts = opts || {};
    return api.code(ownerType, ownerId).then(function (d) {
      if (!slot.isConnected) return;
      var items = d.items || [];
      if (!items.length && opts.fallback && opts.fallback.code) items = [{ lang: opts.fallback.lang || "other", lang_label: opts.fallback.lang || _t('ct.kod'), title: "", code: opts.fallback.code }];
      if (!items.length) { slot.textContent = ""; return; }
      var box = section(slot, items.length > 1 ? _t('ct.przykladyKodu') : _t('ct.przykladKodu'));
      var tabs = h("div", { "class": "esn-tabs", role: "tablist", "aria-label": _t('ct.srodowisko') }), panel = h("div", { "class": "esn-code-panel", role: "tabpanel" });
      var count = {}; items.forEach(function (i) { count[i.lang_label] = (count[i.lang_label] || 0) + 1; });
      var btns = items.map(function (it, n) {
        var label = _L("rt", it.lang_label) + (count[it.lang_label] > 1 ? " · " + (it.title || n + 1) : "");
        var b = h("button", { type: "button", role: "tab", text: label, onclick: function () { show(n); } });
        b.addEventListener("keydown", function (e) {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); var m = (n + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length; show(m); btns[m].focus(); }
        });
        tabs.appendChild(b); return b;
      });
      function show(n) {
        btns.forEach(function (b, i) { b.setAttribute("aria-selected", String(i === n)); b.tabIndex = i === n ? 0 : -1; });
        var it = items[n]; panel.textContent = "";
        var copy = h("button", { type: "button", "class": "esn-copy", text: _t('ct.kopiuj'), onclick: function () { copyText(it.code, copy); } });
        panel.appendChild(h("div", { "class": "esn-code-head" }, [h("span", { "class": "esn-code-title", text: it.title || _L("rt", it.lang_label) }), copy]));
        var codeEl = h("code", {});
        highlightInto(codeEl, it.code, it.lang);
        panel.appendChild(h("div", { "class": "code-block esn-hl" }, [h("pre", {}, [codeEl])]));
      }
      if (items.length > 1) box.appendChild(tabs);
      box.appendChild(panel);
      show(0);
    }).catch(function () { if (slot.isConnected) slot.textContent = ""; });
  }

  function resourcesView(slot, ownerType, ownerId, opts) {
    opts = opts || {};
    return api.resources(ownerType, ownerId).then(function (items) {
      if (!slot.isConnected) return;
      items = (opts.legacy || []).filter(function (x) { return x && x.url; }).map(function (x) {
        return { kind: "link", url: x.url, label: x.label, type_label: ({ datasheet: _t('ct.datasheet'), repo: _t('ct.repozytorium') })[x.rtype] || _t('ct.link'), rtype: x.rtype || "other" };
      }).concat(items);
      if (!items.length) { slot.textContent = ""; return items; }
      var box = section(slot, _t('ct.zasobyIPlikiDo')), list = h("ul", { "class": "esn-res" });
      var hasFile = false;
      items.forEach(function (r) {
        var meta = [_L("rt", r.type_label)];
        var a;
        if (r.kind === "file") {
          hasFile = true; meta.push(sizeText(r.size));
          a = h("a", { "class": "esn-res-btn", href: r.url, download: r.name || "plik", text: _t('ct.pobierz') });
        } else {
          if (host(r.url)) meta.push(host(r.url));
          a = h("a", { "class": "esn-res-btn", href: r.url, target: "_blank", rel: "noopener noreferrer nofollow ugc", text: _t('ct.otworz') + " ", iconEnd: "arrow-up-right-from-square" });
        }
        var main = h("div", { "class": "esn-res-main" }, [h("div", { "class": "esn-res-label", text: r.label }), h("div", { "class": "esn-res-meta", text: meta.join(" · ") })]);
        if (r.kind === "file" && r.license_label) {
          var lic = h("div", { "class": "esn-res-lic" }, [h("span", { "class": "esn-badge", text: _L("lic", r.license_label) })]);
          if (r.license_note) lic.appendChild(h("span", { text: " " + (r.license === "own" ? _t('ct.uwagi') + " " : _t('ct.autorZrodlo') + " ") + r.license_note }));
          main.appendChild(lic);
        }
        list.appendChild(h("li", { "class": "esn-res-item" }, [main, a]));
      });
      box.appendChild(list);
      if (hasFile) {
        var note = h("p", { "class": "esn-res-note" }, [document.createTextNode(_t('ct.plikiDodaliAutorzyNa') + " ")]);
        // `app` to const z głównego skryptu strony (nie jest własnością window), ale jest widoczny globalnie dla skryptów strony
        if (typeof app !== "undefined" && app && typeof app.navigate === "function") {
          note.appendChild(h("button", { type: "button", "class": "esn-linkbtn", text: _t('ct.zglosProblemZPlikiem'), onclick: function () { app.navigate("contact"); } }));
        }
        box.appendChild(note);
      }
      return items;                                // v55: karta bierze z nich przycisk w nagłówku (datasheet / repozytorium)
    }).catch(function () { if (slot.isConnected) slot.textContent = ""; return []; });
  }

  function usedComponentsView(slot, projectId, opts) {
    opts = opts || {};
    return api.components(projectId).then(function (items) {
      if (!slot.isConnected) return [];
      // elementy wpisane tekstem – pomijamy te, które mają już kartę w katalogu
      var known = {};
      items.forEach(function (c) { [c.name, c.symbol].forEach(function (v) { if (v) known[v.trim().toLowerCase()] = 1; }); });
      var seen = {}, others = (opts.others || []).map(function (x) { return String(x).trim(); }).filter(function (x) {
        var k = x.toLowerCase(); if (!x || known[k] || seen[k]) return false; seen[k] = 1; return true;
      });
      if (!items.length && !others.length) { slot.textContent = ""; return []; }
      var box = section(slot, _t('ct.wszystkieWykorzystaneElementy'));
      if (items.length) {
        var grid = h("div", { "class": "esn-cards" });
        items.forEach(function (c) {
          var card = h("button", { type: "button", "class": "esn-card", "aria-label": _t('ct.otworzKartePodzespolu') + " " + c.name, title: _t('ct.przejdzDoKartyW'), onclick: function () { if (opts.onOpen) opts.onOpen(c.component_id); } });
          card.appendChild(c.image_main ? h("img", { src: imgSrc(c.image_main), alt: "", loading: "lazy" }) : faPh("microchip"));
          var txt = h("span", { "class": "esn-card-txt" }, [h("strong", { text: partLabel(c.name, c.symbol) })]);
          if (c.note) txt.appendChild(h("span", { "class": "esn-card-note", text: c.note }));
          txt.appendChild(h("span", { "class": "esn-card-cat", text: [c.category, _t('ct.kartaWKatalogu')].filter(Boolean).join(" · ") + " ", iconEnd: "arrow-right" }));
          card.appendChild(txt); grid.appendChild(card);
        });
        box.appendChild(grid);
      }
      if (others.length) {
        var row = h("div", { "class": "esn-others" });
        others.forEach(function (t) { row.appendChild(h("span", { "class": "esn-other", text: t })); });
        if (items.length) box.appendChild(h("div", { "class": "esn-others-lbl", text: _t('ct.pozostaleElementyBezKarty') }));
        box.appendChild(row);
      }
      return items;
    }).catch(function () { if (slot.isConnected) slot.textContent = ""; return []; });
  }

  var STATUS = { stable: _t('ct.ukonczony'), progress: _t('ct.wTrakcie'), archive: _t('ct.archiwalny') };
  function usedInProjectsView(slot, componentId, opts) {
    return api.componentProjects(componentId).then(function (items) {
      if (!slot.isConnected) return;
      if (!items.length) { slot.textContent = ""; return; }
      var box = section(slot, _t('ct.przykladoweWykorzystanieWProjektach')), grid = h("div", { "class": "esn-cards" });
      items.forEach(function (p) {
        var card = h("button", { type: "button", "class": "esn-card", "aria-label": _t('ct.otworzProjekt') + " " + p.title, onclick: function () { if (opts && opts.onOpen) opts.onOpen(p.slug); } });
        card.appendChild(p.image_main ? h("img", { src: imgSrc(p.image_main), alt: "", loading: "lazy" }) : faPh("diagram-project"));
        var desc = (p.short_desc || "").slice(0, 110) + ((p.short_desc || "").length > 110 ? "…" : "");
        var txt = h("span", { "class": "esn-card-txt" }, [h("strong", { text: p.title })]);
        if (p.note) txt.appendChild(h("span", { "class": "esn-card-note", text: _t('ct.rola') + " " + p.note }));
        if (desc) txt.appendChild(h("span", { "class": "esn-card-cat", text: desc }));
        txt.appendChild(h("span", { "class": "esn-card-cat", text: [p.owner ? "autor: " + p.owner : "", STATUS[p.status] || ""].filter(Boolean).join(" · ") }));
        card.appendChild(txt); grid.appendChild(card);
      });
      box.appendChild(grid);
    }).catch(function () { if (slot.isConnected) slot.textContent = ""; });
  }

  /* ══ EDYTORY ══════════════════════════════════════════════════════════ */
  function faPh(n) { var s = h("span", { "class": "esn-card-ph", "aria-hidden": "true" }), i = document.createElement("i"); i.className = "fa-solid fa-" + n; s.appendChild(i); return s; }
  function ctlBtn(txt, label, fn, dis) {   // txt "fa:<nazwa>" → ikona Font Awesome (v49)
    var fa = /^fa:/.test(txt), b = h("button", { type: "button", "class": "esn-ed-ic", "aria-label": label, title: label, text: fa ? "" : txt, onclick: fn });
    if (fa) { var i = document.createElement("i"); i.className = "fa-solid fa-" + txt.slice(3); i.setAttribute("aria-hidden", "true"); b.appendChild(i); }
    if (dis) b.disabled = true; return b;
  }

  function codeEditor(root, opts) {
    var type = opts.ownerType, ownerId = opts.ownerId || null, items = [], L = DEFAULT_LANGS, dead = false, lastLang = "arduino";
    root.textContent = ""; root.classList.add("esn-ed");
    var head = h("div", { "class": "esn-ed-head" }, [h("strong", { text: _t('ct.przykladyKodu') + " " }), h("span", { "class": "esn-ed-note", text: _t('ct.dlaRoznychSrodowiskW') })]);
    var list = h("div", { "class": "esn-ed-list" });
    var sel = h("select", { "class": "esn-ed-sel", "aria-label": _t('ct.srodowiskoNowegoPrzykladu') });
    var add = h("button", { type: "button", "class": "esn-ed-add", text: _t('ct.dodajPrzyklad'), onclick: function () { items.push({ lang: sel.value, title: "", code: "" }); lastLang = sel.value; render(); var t = list.querySelectorAll("textarea"); if (t.length) t[t.length - 1].focus(); } });
    var bar = h("div", { "class": "esn-ed-bar" }, [sel, add]);
    root.appendChild(head); root.appendChild(list); root.appendChild(bar);

    function fillSel() { sel.textContent = ""; Object.keys(L).forEach(function (k) { var o = h("option", { value: k, text: L[k] }); if (k === lastLang) o.selected = true; sel.appendChild(o); }); }
    function render() {
      list.textContent = "";
      items.forEach(function (it, i) {
        var ls = h("select", { "class": "esn-ed-sel", "aria-label": _t('ct.srodowisko') });
        Object.keys(L).forEach(function (k) { var o = h("option", { value: k, text: L[k] }); if (k === it.lang) o.selected = true; ls.appendChild(o); });
        ls.addEventListener("change", function () { it.lang = ls.value; });
        var title = h("input", { type: "text", "class": "esn-ed-in", placeholder: _t('ct.nazwaPlikuTytulNp'), maxlength: "120", value: it.title || "", "aria-label": _t('ct.tytulPrzykladu') });
        title.addEventListener("input", function () { it.title = title.value; });
        var ta = h("textarea", { "class": "esn-ed-code", rows: "9", spellcheck: "false", placeholder: _t('ct.wklejKod'), "aria-label": _t('ct.kod') }); ta.value = it.code || "";
        var cnt = h("span", { "class": "esn-ed-note" });
        var upd = function () { cnt.textContent = Math.round(ta.value.length / 102.4) / 10 + " KB"; };
        ta.addEventListener("input", function () { it.code = ta.value; upd(); }); upd();
        var row = h("div", { "class": "esn-ed-row" }, [ls, title, ctlBtn("fa:chevron-left", _t('ct.przesunWczesniej'), function () { mv(i, -1); }, i === 0), ctlBtn("fa:chevron-right", _t('ct.przesunPozniej'), function () { mv(i, 1); }, i === items.length - 1),
          ctlBtn("fa:trash", _t('ct.usunPrzyklad'), function () { confirmDel(_t('ct.usunacTenPrzykladKodu'), _t('ct.usuwanie')).then(function (ok) { if (ok) { items.splice(i, 1); render(); } }); })]);
        list.appendChild(h("div", { "class": "esn-ed-card" }, [row, ta, cnt]));
      });
    }
    function mv(i, d) { var j = i + d; if (j < 0 || j >= items.length) return; var t = items[i]; items[i] = items[j]; items[j] = t; render(); }
    langs().then(function (l) { L = l; fillSel(); render(); });
    fillSel();
    if (ownerId) api.code(type, ownerId).then(function (d) { if (dead) return; items = (d.items || []).map(function (x) { return { lang: x.lang, title: x.title, code: x.code }; }); L = d.langs || L; fillSel(); render(); }).catch(function () {});
    return {
      getItems: function () { return items.filter(function (x) { return (x.code || "").trim(); }); },
      save: function (id) { return api.setCode(type, id || ownerId, items.filter(function (x) { return (x.code || "").trim(); })); },
      destroy: function () { dead = true; root.textContent = ""; root.classList.remove("esn-ed"); }
    };
  }

  function componentPicker(root, opts) {
    var pid = opts.projectId || null, selected = [], catalog = [], dead = false;
    root.textContent = ""; root.classList.add("esn-ed");
    var head = h("div", { "class": "esn-ed-head" }, [h("strong", { text: _t('ct.podzespolyZKatalogu') + " " }), h("span", { "class": "esn-ed-note", text: _t('ct.projektPojawiSieW') })]);
    var search = h("input", { type: "search", "class": "esn-ed-in", placeholder: _t('ct.szukajWKataloguNazwa'), "aria-label": _t('ct.szukajPodzespolu') });
    var sug = h("div", { "class": "esn-sug" }), chosen = h("div", { "class": "esn-ed-list" });
    root.appendChild(head); root.appendChild(search); root.appendChild(sug); root.appendChild(chosen);

    function renderSug() {
      sug.textContent = "";
      var q = search.value.trim().toLowerCase(); if (!q) return;
      var have = selected.map(function (s) { return s.component_id; });
      catalog.filter(function (c) { return have.indexOf(c.id) < 0 && [c.name, c.symbol, c.inventory_category].join(" ").toLowerCase().indexOf(q) >= 0; }).slice(0, 8).forEach(function (c) {
        sug.appendChild(h("button", { type: "button", "class": "esn-sug-i", text: partLabel(c.name, c.symbol) + (c.inventory_category ? " · " + c.inventory_category : ""),
          onclick: function () { selected.push({ component_id: c.id, name: c.name, symbol: c.symbol, note: "" }); search.value = ""; renderSug(); render(); } }));
      });
      if (!sug.children.length) sug.appendChild(h("div", { "class": "esn-ed-note", text: _t('ct.brakWynikowMozeszWpisac') }));
    }
    function render() {
      chosen.textContent = "";
      selected.forEach(function (s, i) {
        var note = h("input", { type: "text", "class": "esn-ed-in", placeholder: _t('ct.rolaWProjekcieOpcjonalnie'), maxlength: "200", value: s.note || "", "aria-label": _t('ct.rolaWProjekcie') });
        note.addEventListener("input", function () { s.note = note.value; });
        chosen.appendChild(h("div", { "class": "esn-ed-row" }, [h("span", { "class": "esn-chip", text: partLabel(s.name, s.symbol) }), note,
          ctlBtn("fa:xmark", _t('ct.usunPowiazanieZ') + " " + s.name, function () { selected.splice(i, 1); render(); renderSug(); })]));
      });
    }
    search.addEventListener("input", renderSug);
    fetch("/api/catalog").then(function (r) { return r.json(); }).then(function (d) { catalog = Array.isArray(d) ? d : (d.items || []); if (!dead) renderSug(); }).catch(function () {});
    if (pid) api.components(pid).then(function (rows) { if (dead) return; selected = rows.map(function (r) { return { component_id: r.component_id, name: r.name, symbol: r.symbol, note: r.note }; }); render(); }).catch(function () {});
    return {
      save: function (id) { return api.setComponents(id || pid, selected.map(function (s) { return { component_id: s.component_id, note: s.note || "" }; })); },
      destroy: function () { dead = true; root.textContent = ""; root.classList.remove("esn-ed"); }
    };
  }

  function resourcesManager(root, opts) {
    var type = opts.ownerType, ownerId = opts.ownerId || null, canFiles = !!opts.canFiles, items = [], pending = [], pol = null, dead = false;
    var takeDraft = function () { return null; }, fileDraft = function () { return null; };   // v54: wpisany, a niedodany link/plik (ustawiane w buildForms)
    root.textContent = ""; root.classList.add("esn-ed");
    var head = h("div", { "class": "esn-ed-head" }, [h("strong", { text: _t('ct.zasobyIPlikiDo') + " " }),
      h("span", { "class": "esn-ed-note", text: _t('ct.domyslnieWstawLinkiDo') })]);
    var listHead = h("div", { "class": "esn-res-sub" }), list = h("div", { "class": "esn-ed-list" }), forms = h("div", { "class": "esn-res-forms" });
    var formsHead = h("div", { "class": "esn-res-sub esn-res-sub-new", icon: "plus", text: " " + _t('ct.dodajNowyZasob') });   // v56: oddziela dodane od nowych
    root.appendChild(head); root.appendChild(listHead); root.appendChild(list); root.appendChild(formsHead); root.appendChild(forms);
    var FALLBACK_TYPES = { datasheet: _t('ct.datasheet'), docs: _t('ct.dokumentacja'), schematic: _t('ct.schemat'), pcb: "PCB / Gerbery", firmware: "Kod / firmware", model3d: "Model 3D", guide: _t('ct.poradnik'), repo: _t('ct.repozytorium'), other: _t('ct.inne') };
    function typeSel(cur) {
      var T = (pol && pol.types) || FALLBACK_TYPES;   // formularz powstaje zanim wczyta się polityka z serwera
      var s = h("select", { "class": "esn-ed-sel", "aria-label": _t('ct.rodzajZasobu') });
      Object.keys(T).forEach(function (k) { var o = h("option", { value: k, text: T[k] }); if (k === cur) o.selected = true; s.appendChild(o); });
      return s;
    }
    function fail(e) { notify(e.message || String(e), "error"); }
    function reload() {
      if (!ownerId) { render(); return Promise.resolve(); }
      return api.resources(type, ownerId).then(function (r) { if (!dead) { items = r; render(); } }).catch(fail);
    }
    function row(it, persisted, i, listRef) {
      var label = h("input", { type: "text", "class": "esn-ed-in", maxlength: "200", value: it.label || "", "aria-label": _t('ct.opis') });
      label.addEventListener("change", function () { it.label = label.value; if (persisted && label.value.trim()) api.patchRes(it.id, { label: label.value }).catch(fail); });
      var ts = typeSel(it.rtype); ts.addEventListener("change", function () { it.rtype = ts.value; if (persisted) api.patchRes(it.id, { rtype: ts.value }).catch(fail); });
      var info = it.kind === "file" ? (it.name || (it.file && it.file.name) || _t("ct.plik").toLowerCase()) + " · " + sizeText(it.size || (it.file && it.file.size) || 0) + " · " + _L("lic", it.license_label || (pol && pol.licenses[it.license]) || it.license || "")
        : (it.url || ""); 
      var line1 = h("div", { "class": "esn-ed-row" }, [h("span", { "class": "esn-badge", text: it.kind === "file" ? _t("ct.plik").toUpperCase() : _t("ct.link").toUpperCase() }), ts, label,
        ctlBtn("fa:chevron-left", _t('ct.przesunWczesniej'), function () { move(listRef, i, -1, persisted); }, i === 0), ctlBtn("fa:chevron-right", _t('ct.przesunPozniej'), function () { move(listRef, i, 1, persisted); }, i === listRef.length - 1),
        ctlBtn("fa:trash", _t('ct.usun'), function () { confirmDel(_t('ct.usunacTenZasob'), _t('ct.usuwanie')).then(function (ok) { if (!ok) return; if (persisted) api.delRes(it.id).then(reload).catch(fail); else { listRef.splice(i, 1); render(); } }); })]);
      var c = h("div", { "class": "esn-ed-card" + (it.err ? " is-err" : "") }, [line1, h("div", { "class": "esn-ed-note", text: info })]);
      if (!persisted) c.appendChild(h("div", { "class": "esn-ed-note" + (it.err ? " err" : ""), text: it.err || _t('ct.oczekujeNaZapis') }));
      return c;
    }
    function render() {
      list.textContent = "";
      var n = items.length + pending.length;
      listHead.textContent = n ? _t('ct.dodaneZasoby', { n: n }) : ""; listHead.hidden = !n; formsHead.classList.toggle("has-list", !!n);
      items.forEach(function (it, i) { list.appendChild(row(it, true, i, items)); });
      pending.forEach(function (it, i) { list.appendChild(row(it, false, i, pending)); });
    }
    function move(ref, i, d, persisted) {
      var j = i + d; if (j < 0 || j >= ref.length) return; var t = ref[i]; ref[i] = ref[j]; ref[j] = t;
      if (persisted) api.reorderRes(type, ownerId, ref.map(function (x) { return x.id; })).then(function (r) { items = r; render(); }).catch(function (e) { fail(e); reload(); }); else render();
    }
    function total() { return items.length + pending.length; }
    function overLimit() { if (pol && total() >= pol.max_per_owner) { notify(_t('ct.osiagnietoLimitZasobow') + pol.max_per_owner + ").", "warn"); return true; } return false; }

    function buildForms() {
      forms.textContent = "";
      // — link —
      var lt = typeSel(opts.defaultType || "datasheet"), ll = h("input", { type: "text", "class": "esn-ed-in", placeholder: _t('ct.opisNpDatasheetProducenta'), maxlength: "200", "aria-label": _t('ct.opisLinku') });
      var lu = h("input", { type: "url", "class": "esn-ed-in", placeholder: "https://…", maxlength: "490", "aria-label": _t('ct.adresLinku') });
      /* link z pól formularza; opis opcjonalny – domyślnie nazwa rodzaju (np. „Datasheet”) */
      function draft() {
        var url = lu.value.trim(); if (!url) return null;
        var lbl = ll.value.trim() || (lt.options[lt.selectedIndex] ? lt.options[lt.selectedIndex].text : _t('ct.link'));
        return { kind: "link", rtype: lt.value, label: lbl, url: url };
      }
      takeDraft = function () {                   // przy zapisie formularza: dołącz wpisany link, którego nie dodano przyciskiem
        var rec = draft(); if (!rec) return null;
        if (!/^https?:\/\//i.test(rec.url)) return { error: _t('ct.adresMusiZaczynacSie'), name: rec.url };
        if (pol && total() >= pol.max_per_owner) return { error: _t('ct.osiagnietoLimitZasobow') + pol.max_per_owner + ").", name: rec.label };
        pending.push(rec); ll.value = lu.value = ""; return rec;
      };
      var lb = h("button", { type: "button", "class": "esn-ed-add", text: _t('ct.dodajLink'), onclick: function () {
        if (overLimit()) return;
        var rec = draft();
        if (!rec) return notify(_t('ct.podajAdresLinku'), "warn");
        if (!/^https?:\/\//i.test(rec.url)) return notify(_t('ct.adresMusiZaczynacSie'), "warn");
        if (ownerId) api.addLink(Object.assign({ owner_type: type, owner_id: ownerId }, rec)).then(function () { ll.value = lu.value = ""; return reload(); }).catch(fail);
        else { pending.push(rec); ll.value = lu.value = ""; render(); }
      } });
      forms.appendChild(h("div", { "class": "esn-form" }, [h("div", { "class": "esn-form-t", text: _t('ct.dodajLinkZalecane') }), h("div", { "class": "esn-ed-row" }, [lt, ll, lu, lb])]));
      // — plik —
      if (!canFiles) return;
      var d = h("details", { "class": "esn-form" }); d.appendChild(h("summary", { "class": "esn-form-t", text: _t('ct.wgrajPlikTylkoWlasny') }));
      var ft = typeSel("schematic"), fl = h("input", { type: "text", "class": "esn-ed-in", placeholder: _t('ct.opisOpcjonalnieDomyslnieNazwa'), maxlength: "200", "aria-label": _t('ct.opisPliku') });
      var fi = h("input", { type: "file", "class": "esn-ed-file", accept: ((pol && pol.allowed_ext) || []).map(function (e) { return "." + e; }).join(","), "aria-label": _t('ct.plik') });
      var lic = h("select", { "class": "esn-ed-sel", "aria-label": _t('ct.licencjaPliku') }, [h("option", { value: "", text: _t('ct.licencja') })]);
      Object.keys((pol && pol.licenses) || {}).forEach(function (k) { lic.appendChild(h("option", { value: k, text: _L("lic", pol.licenses[k]) })); });
      var note = h("input", { type: "text", "class": "esn-ed-in", placeholder: _t('ct.autorZrodloWymaganeDla'), maxlength: "300", "aria-label": _t('ct.autorLubZrodlo') });
      var rights = h("input", { type: "checkbox", id: "esn-rights-" + Math.random().toString(36).slice(2) });
      var rl = h("label", { "class": "esn-rights", "for": rights.id }, [rights, h("span", { text: " " + _t('ct.potwierdzamZeJestemAutorem') })]);
      var hint = h("div", { "class": "esn-ed-note", text: pol ? _t('ct.dozwolonePdfZipBez') + " " + pol.max_file_mb + " " + _t('ct.mbNieWgrywajCudzych') : "" });
      var fb = h("button", { type: "button", "class": "esn-ed-add", text: _t('ct.dodajPlik'), onclick: function () {
        if (overLimit()) return;
        var f = fi.files[0];
        if (!f) return notify(_t('ct.wybierzPlik'), "warn");
        if (!lic.value) return notify(_t('ct.wybierzLicencjePliku'), "warn");
        if (!rights.checked) return notify(_t('ct.potwierdzPrawoDoUdostepniania'), "warn");
        if (lic.value !== "own" && note.value.trim().length < 3) return notify(_t('ct.dlaTejLicencjiPodaj'), "warn");
        if (pol && f.size > pol.max_file_mb * 1048576) return notify(_t('ct.plikJestWiekszyNiz') + " " + pol.max_file_mb + " MB.", "warn");
        var rec = { kind: "file", rtype: ft.value, label: fl.value.trim() || f.name, file: f, license: lic.value, license_note: note.value.trim(), size: f.size, name: f.name };
        var reset = function () { fi.value = ""; fl.value = ""; note.value = ""; rights.checked = false; lic.value = ""; };
        if (ownerId) {
          fb.disabled = true;
          api.addFile({ owner_type: type, owner_id: ownerId, rtype: rec.rtype, label: rec.label, license: rec.license, license_note: rec.license_note, rights: "true" }, f)
            .then(function () { reset(); notify(_t('ct.plikWgrany'), "success"); return reload(); }).catch(fail).then(function () { fb.disabled = false; });
        } else { pending.push(rec); reset(); render(); }
      } });
      fileDraft = function () { return fi.files && fi.files[0] ? { name: fi.files[0].name, error: _t('ct.plikNieDodany') } : null; };
      [h("div", { "class": "esn-ed-row" }, [ft, fl]), h("div", { "class": "esn-ed-row" }, [fi]), h("div", { "class": "esn-ed-row" }, [lic, note]), rl, hint, h("div", { "class": "esn-ed-row" }, [fb])].forEach(function (x) { d.appendChild(x); });
      forms.appendChild(d);
    }

    api.policy().then(function (p) { pol = p; buildForms(); render(); }).catch(function () { buildForms(); });
    buildForms();
    if (ownerId) reload(); else render();
    return {
      hasPending: function () { return pending.length > 0; },
      reload: reload,
      // po pierwszym zapisie nowego obiektu: dodaj oczekujące linki i pliki
      flush: function (id) {
        ownerId = id || ownerId; var okCount = 0, failed = [];
        var d = takeDraft(); if (d && d.error) failed.push({ name: d.name, error: d.error });
        var fd = fileDraft(); if (fd) failed.push(fd);
        return pending.slice().reduce(function (p, rec) {
          return p.then(function () {
            var req = rec.kind === "link"
              ? api.addLink({ owner_type: type, owner_id: ownerId, rtype: rec.rtype, label: rec.label, url: rec.url })
              : api.addFile({ owner_type: type, owner_id: ownerId, rtype: rec.rtype, label: rec.label, license: rec.license, license_note: rec.license_note, rights: "true" }, rec.file);
            return req.then(function () { okCount++; pending.splice(pending.indexOf(rec), 1); }).catch(function (e) { rec.err = e.message; failed.push({ name: rec.label, error: e.message }); });
          });
        }, Promise.resolve()).then(function () { return reload(); }).then(function () { return { ok: okCount, failed: failed }; });
      },
      destroy: function () { dead = true; pending = []; items = []; root.textContent = ""; root.classList.remove("esn-ed"); }
    };
  }

  global.ESNContent = { api: api, codeView: codeView, resourcesView: resourcesView, usedComponentsView: usedComponentsView, usedInProjectsView: usedInProjectsView,
    codeEditor: codeEditor, componentPicker: componentPicker, resourcesManager: resourcesManager };
})(window);
