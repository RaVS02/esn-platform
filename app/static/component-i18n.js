/* Tłumaczenia komponentu w formularzu katalogu: jeden rekord, wiele wersji językowych.
 *   var ctl = ESNCompI18n.mount(el, { base: function () { return { name, description, specs:[klucze] }; } });
 *   ctl.setBaseLang(kod)   – język bazowy (zakładki dotyczą pozostałych języków)
 *   ctl.set(translations)  – wczytanie z API ({lang: {name, description, specs:{klucz: etykieta}}})
 *   ctl.get()              – {lang: {...}} do zapisu (puste języki pomijane)
 * Pinout ma własne tłumaczenia w swoim dokumencie (bloki [xx] w polu Pinout). */
(function (global) {
  "use strict";
  function _t(k, p) { return global.ESNI18n.t(k, p); }
  function h(tag, props, kids) {
    var e = document.createElement(tag);
    for (var k in (props || {})) {
      if (k === "class") e.className = props[k];
      else if (k === "text") e.textContent = props[k];
      else if (k === "value") e.value = props[k];
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), props[k]);
      else if (props[k] !== false && props[k] != null) e.setAttribute(k, props[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }

  function mount(el, opts) {
    opts = opts || {};
    var data = {}, base = "pl", active = null, F = {};
    var names = {}; global.ESNI18n.list().forEach(function (l) { names[l.code] = l.name; });
    var tabs = h("div", { "class": "po-langs", role: "tablist" }), form = h("div", { "class": "ci-form" });
    var head = h("div", { "class": "form-label", text: _t("ci.tlumaczenia") });
    var hint = h("p", { "class": "ci-hint", text: _t("ci.opis") });
    el.textContent = ""; el.appendChild(head); el.appendChild(hint); el.appendChild(tabs); el.appendChild(form);

    function others() { return Object.keys(names).filter(function (c) { return c !== base; }); }
    function specsToText(m) { return Object.keys(m || {}).map(function (k) { return k + " = " + m[k]; }).join("\n"); }
    function textToSpecs(t) {
      var o = {}; String(t || "").split(/\r?\n/).forEach(function (l) { var i = l.indexOf("="); if (i > 0 && l.slice(0, i).trim() && l.slice(i + 1).trim()) o[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
      return o;
    }
    function collect() {          /* z pól bieżącej zakładki do data */
      if (!active || !F.name) return;
      data[active] = { name: F.name.value.trim(), description: F.desc.value.trim(), specs: textToSpecs(F.specs.value) };
    }
    function draw() {
      form.textContent = ""; tabs.textContent = "";
      var langs = others();
      if (!langs.length) { el.hidden = true; return; }
      el.hidden = false;
      if (langs.indexOf(active) < 0) active = langs[0];
      langs.forEach(function (c) {
        var d = data[c], filled = d && (d.name || d.description || Object.keys(d.specs || {}).length);
        tabs.appendChild(h("button", { type: "button", "class": "po-lang", "aria-pressed": String(c === active), text: c.toUpperCase() + (filled ? " ✓" : ""),
          onclick: function () { collect(); active = c; draw(); } }));
      });
      var b = (opts.base && opts.base()) || {}, d = data[active] || {};
      F.name = h("input", { "class": "text-input", value: d.name || "", placeholder: b.name || "", "aria-label": _t("ci.nazwa") });
      F.desc = h("textarea", { "class": "text-input", rows: "3", placeholder: b.description || "", "aria-label": _t("ci.opisKomponentu") }); F.desc.value = d.description || "";
      F.specs = h("textarea", { "class": "text-input ci-specs", rows: "3", placeholder: (b.specs || []).map(function (k) { return k + " = "; }).join("\n"), spellcheck: "false", "aria-label": _t("ci.parametry") });
      F.specs.value = specsToText(d.specs);
      [F.name, F.desc, F.specs].forEach(function (x) { x.addEventListener("input", function () { collect(); }); });
      form.appendChild(h("label", { "class": "ci-fld" }, [h("span", { text: _t("ci.nazwa") + " (" + (names[active] || active) + ")" }), F.name]));
      form.appendChild(h("label", { "class": "ci-fld" }, [h("span", { text: _t("ci.opisKomponentu") }), F.desc]));
      form.appendChild(h("label", { "class": "ci-fld" }, [h("span", { text: _t("ci.parametry") }), F.specs, h("small", { text: _t("ci.parametryHint") })]));
    }
    draw();
    return {
      setBaseLang: function (c) { collect(); base = c; draw(); },
      set: function (tr) { data = JSON.parse(JSON.stringify(tr || {})); active = null; draw(); },
      refresh: function () { collect(); draw(); },
      get: function () {
        collect(); var out = {};
        Object.keys(data).forEach(function (c) {
          var d = data[c]; if (c === base || !d) return;
          var o = {}; if (d.name) o.name = d.name; if (d.description) o.description = d.description; if (d.specs && Object.keys(d.specs).length) o.specs = d.specs;
          if (Object.keys(o).length) out[c] = o;
        });
        return out;
      }
    };
  }
  global.ESNCompI18n = { mount: mount };
})(window);
