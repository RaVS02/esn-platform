/* Sekcja „Narzędzia”: rejestr narzędzi + routing #tools / #tools/<id>.
 *   ESNTools.register({ id, icon, title, desc, status: "ready"|"soon"|"dev", mount(el, ctx) })
 *   ctx = { go(path), back(), h(), toast() }; mount zwraca opcjonalnie funkcję sprzątającą.
 * Kolejne narzędzia (kalkulatory, edytor schematów) dopisują się przez register() – bez zmian w tym pliku. */
(function (global) {
  "use strict";
  var TOOLS = [], cleanup = null;
  function _t(k, p) { return global.ESNI18n ? global.ESNI18n.t(k, p) : k; }
  function h(tag, props, kids) {
    var e = document.createElement(tag);
    for (var k in (props || {})) {
      if (k === "icon" || k === "iconEnd") continue;
      else if (k === "class") e.className = props[k];
      else if (k === "text") e.textContent = props[k];
      else if (k === "value") e.value = props[k];
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), props[k]);
      else if (props[k] !== false && props[k] != null) e.setAttribute(k, props[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    if (props && props.icon) e.insertBefore(faIcon(props.icon), e.firstChild);   // v50: ikona Font Awesome (icon / iconEnd)
    if (props && props.iconEnd) e.appendChild(faIcon(props.iconEnd));
    return e;
  }
  function faIcon(n) { var i = document.createElement("i"); i.className = "fa-solid fa-" + n; i.setAttribute("aria-hidden", "true"); return i; }
  function toast(m, t) { if (typeof global.toast === "function") global.toast(m, t || "info"); }
  function root() { return document.getElementById("tools-root"); }
  function register(t) { TOOLS = TOOLS.filter(function (x) { return x.id !== t.id; }); TOOLS.push(t); }
  function go(path) { history.pushState({ view: "tools" }, "", "#tools" + (path ? "/" + path : "")); enter(); window.scrollTo(0, 0); }

  var STATUS = { ready: null, soon: "tools.wkrotce", dev: "tools.wRozwoju" };
  function home(el) {
    el.textContent = "";
    el.appendChild(h("div", { "class": "tl-banner" }, [h("div", {}, [h("strong", { text: _t("tools.wRozwoju") }), h("span", { text: _t("tools.banner") })])]));
    var grid = h("div", { "class": "tools-grid" });
    TOOLS.slice().sort(function (a, b) { var ra = !a.status || a.status === "ready" ? 0 : 1, rb = !b.status || b.status === "ready" ? 0 : 1; return ra - rb; }).forEach(function (t) {
      var ready = !t.status || t.status === "ready";
      var tag = STATUS[t.status || "ready"];
      var card = h("div", { "class": "module-card" + (ready ? "" : " tl-tile"), role: ready ? "link" : null, tabindex: ready ? "0" : null }, [
        h("div", { "class": "module-icon" }, [h("i", { "class": t.icon || "fa-solid fa-wrench" })]),
        h("h3", { text: _t(t.title) }), h("p", { text: _t(t.desc) }),
        tag ? h("div", { "class": "tag", text: _t(tag) }) : null
      ]);
      if (ready) {
        card.style.cursor = "pointer";
        card.addEventListener("click", function () { go(t.id); });
        card.addEventListener("keydown", function (e) { if (e.key === "Enter") go(t.id); });
      }
      grid.appendChild(card);
    });
    el.appendChild(grid);
    document.title = _t("tools.narzedziaEsn");
  }

  function enter() {
    var el = root(); if (!el) return;
    if (typeof cleanup === "function") { try { cleanup(); } catch (e) { /* ignoruj */ } }
    cleanup = null;
    var parts = location.hash.replace(/^#/, "").split("/").slice(1);
    var t = TOOLS.filter(function (x) { return x.id === parts[0]; })[0];
    if (!t || (t.status && t.status !== "ready")) return home(el);
    el.textContent = "";
    el.appendChild(h("button", { type: "button", "class": "kn-back", icon: "chevron-left", text: " " + _t("tools.narzedzia2"), onclick: function () { go(""); } }));
    /* wspólny nagłówek narzędzia: ikona + nazwa (opis i treść rysuje samo narzędzie) */
    el.appendChild(h("div", { "class": "tl-head" }, [h("span", { "class": "tl-head-ic", "aria-hidden": "true" }, [h("i", { "class": t.icon || "fa-solid fa-wrench" })]),
      h("h2", { "class": "tl-title", text: _t(t.title) })]));
    var body = h("div", { "class": "tools-body" });
    el.appendChild(body);
    document.title = _t(t.title) + " – ESN";
    cleanup = t.mount(body, { go: go, h: h, toast: toast, sub: parts.slice(1) }) || null;
  }

  global.ESNTools = { register: register, enter: enter, go: go };

  /* zapowiedzi kolejnych narzędzi (zastąpi je register() z własnego pliku) */
  register({ id: "schematic", icon: "fa-solid fa-diagram-project", title: "tools.edytorSchematow", desc: "tools.rysowanieSchematowPolaczenZ", status: "dev" });
  /* kalkulatory: calc.js (rejestruje „calc”); baud rate jest jednym z kalkulatorów (v51) */
})(window);
