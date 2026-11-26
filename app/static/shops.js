/* ESN – „Gdzie kupić” (v48): linki do sklepów przy komponencie z katalogu.
 * Dane: OfficialComponent.shops = [{name, url, region: ""|"pl"|"eu"|"world", note?}] (serwer: clean_shops w main.py, max 12, tylko http/https).
 * Identyczna kopia w esn_magazyn/static/shops.js (pilnuje test) – magazyn pokazuje linki komponentów dodanych z katalogu.
 *   ESNShops.view(list, opts?)  → element sekcji (albo null, gdy brak linków); opts.compact – bez nagłówka sekcji
 *   ESNShops.editor(el, list)   → edytor wierszy w formularzu komponentu; zwraca { get(), set(list) }
 * Teksty przez ESNI18n (klucze shop.*). Linki: target=_blank, rel="noopener noreferrer nofollow"; DOM przez textContent (bez innerHTML). */
(function (global) {
  "use strict";
  var REGIONS = ["", "pl", "eu", "world"], MAX = 12;
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
  function okUrl(u) { return /^https?:\/\/[^\s"'<>`]+$/.test(String(u || "").trim()); }
  function domain(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }
  function regionName(r) { var k = "shop.region." + (r || "any"); return _t(k); }   // klucze shop.region.any / pl / eu / world

  function view(list, opts) {
    opts = opts || {};
    var items = (list || []).filter(function (s) { return s && okUrl(s.url); });
    if (!items.length) return null;
    var box = h("div", { "class": "shop-box" });
    if (!opts.compact) box.appendChild(h("h3", { "class": "section-title", text: _t("shop.tytul") }));
    var ul = h("div", { "class": "shop-list" });
    items.forEach(function (s) {
      var a = h("a", { "class": "shop-link", href: s.url, target: "_blank", rel: "noopener noreferrer nofollow" }, [
        h("i", { "class": "shop-ic fa-solid fa-cart-shopping", "aria-hidden": "true" }),
        h("span", { "class": "shop-main" }, [h("strong", { text: s.name || domain(s.url) }), h("small", { text: domain(s.url) + " ", iconEnd: "arrow-up-right-from-square" })]),
        s.region ? h("span", { "class": "shop-reg", text: regionName(s.region) }) : null]);
      ul.appendChild(h("div", { "class": "shop-item" }, [a, s.note ? h("p", { "class": "shop-note", text: s.note }) : null]));
    });
    box.appendChild(ul);
    box.appendChild(h("p", { "class": "shop-disc", text: _t("shop.zastrzezenie") }));
    return box;
  }

  function editor(el, list) {
    var rows = [];
    el.textContent = "";
    el.classList.add("shop-ed");
    var head = h("div", { "class": "shop-ed-head" }, [h("label", { "class": "form-label", text: _t("shop.tytul") }),
      h("small", { "class": "shop-ed-hint", text: _t("shop.podpowiedz") })]);
    var body = h("div", { "class": "shop-ed-rows" });
    var add = h("button", { type: "button", "class": "btn-action", text: _t("shop.dodaj"), onclick: function () { addRow({}); } });
    el.appendChild(head); el.appendChild(body); el.appendChild(add);
    function addRow(s) {
      if (rows.length >= MAX) return;
      var name = h("input", { "class": "text-input", placeholder: _t("shop.nazwaPh"), maxlength: 60, "aria-label": _t("shop.nazwa") });
      var url = h("input", { "class": "text-input", placeholder: "https://…", maxlength: 500, "aria-label": _t("shop.adres") });
      var reg = h("select", { "class": "text-input", "aria-label": _t("shop.region") }, REGIONS.map(function (r) { return h("option", { value: r, text: regionName(r) }); }));
      var note = h("input", { "class": "text-input", placeholder: _t("shop.uwagaPh"), maxlength: 120, "aria-label": _t("shop.uwaga") });
      name.value = s.name || ""; url.value = s.url || ""; reg.value = REGIONS.indexOf(s.region) >= 0 ? s.region : ""; note.value = s.note || "";
      var check = function () { url.classList.toggle("bad", !!url.value.trim() && !okUrl(url.value)); };
      url.addEventListener("input", check);
      var row = h("div", { "class": "shop-ed-row" }, [name, url, reg, note,
        h("button", { type: "button", "class": "btn-action shop-del", title: _t("shop.usun"), "aria-label": _t("shop.usun"), icon: "xmark", onclick: function () {
          rows = rows.filter(function (r) { return r.row !== row; }); row.remove(); add.disabled = rows.length >= MAX; } })]);
      rows.push({ row: row, name: name, url: url, reg: reg, note: note });
      body.appendChild(row); check(); add.disabled = rows.length >= MAX;
    }
    function set(l) { body.textContent = ""; rows = []; (l || []).forEach(addRow); add.disabled = rows.length >= MAX; }
    function get() {
      return rows.map(function (r) { return { name: r.name.value.trim(), url: r.url.value.trim(), region: r.reg.value, note: r.note.value.trim() }; })
        .filter(function (s) { return s.url; });
    }
    function invalid() { return rows.filter(function (r) { return r.url.value.trim() && !okUrl(r.url.value); }).length; }
    set(list);
    return { get: get, set: set, invalid: invalid };
  }

  global.ESNShops = { view: view, editor: editor, okUrl: okUrl };
})(window);
