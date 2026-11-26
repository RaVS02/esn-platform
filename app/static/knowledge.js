/* Wiedza: lista, czytnik, kursy, panel redakcji i renderer „markdownu z blokami".
 *
 * Bezpieczeństwo (zob. docs/BEZPIECZENSTWO.md):
 *   • markdown → marked → DOMPurify; z wyniku usuwamy id, ograniczamy style i linki,
 *   • bloki :::figure (SVG) – DOMPurify bez <style>/<script>/<use>/<image>/<a>, style z allowlisty, id z unikalnym prefiksem,
 *   • bloki :::widget (HTML+JS) – wyłącznie w <iframe sandbox="allow-scripts" srcdoc> z CSP (brak sieci, brak dostępu do strony),
 *   • kod w przykładach nigdy nie przechodzi przez innerHTML poza wynikiem highlight.js (który escapuje).
 * Dane z API trafiają do DOM przez textContent/atrybuty.
 */
(function (global) {
  "use strict";

  /* ── pomocnicze ─────────────────────────────────────────────────────── */
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
  function toast(m, t) { if (typeof global.toast === "function") global.toast(m, t || "info"); else global.alert(m); }
  function askConfirm(msg, title) { return typeof global.customConfirm === "function" ? global.customConfirm(msg, title || _t('kn.potwierdzenie')) : Promise.resolve(global.confirm(msg)); }
  function authH() { var t = localStorage.getItem("token"); return t ? { Authorization: "Bearer " + t } : {}; }
  function jfetch(url, opts) {
    return fetch(url, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (d) {
        if (!res.ok) {
          var m = typeof d.detail === "string" ? _E(d.detail) : Array.isArray(d.detail) ? d.detail.map(function (x) { return x.msg; }).join("; ")
            : res.status === 401 ? _t('kn.sesjaWygaslaZalogujSie') : _t('kn.bladSerwera') + res.status + ")";
          var err = new Error(m); err.status = res.status; throw err;
        }
        return d;
      });
    });
  }
  function jbody(method, data) { return { method: method, headers: Object.assign({ "Content-Type": "application/json" }, authH()), body: JSON.stringify(data || {}) }; }
  function currentRole() {
    try {
      var t = localStorage.getItem("token"); if (!t) return "";
      var p = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      return p.role || "";
    } catch (e) { return ""; }
  }
  function isStaff() { var r = currentRole(); return r === "admin" || r === "moderator"; }
  function isAdmin() { return currentRole() === "admin"; }
  function fmtDate(iso) { try { return new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return ""; } }

  var KIND_LABEL = { essential: _t('kn.niezbednik'), guide: _t('kn.poradnik'), article: _t('kn.artykul'), lesson: _t('kn.lekcjaKursu') };
  var KIND_BADGE = { essential: "badge-orange", guide: "badge-green", article: "badge-accent", lesson: "badge-purple" };
  var LEVEL_LABEL = { basic: _t('kn.podstawy'), intermediate: _t('kn.sredni'), advanced: _t('kn.zaawansowany') };
  var LEVEL_ORDER = ["basic", "intermediate", "advanced"];

  var api = {
    items: function (q) { return jfetch("/api/knowledge/items" + (q ? "?" + q : "")); },
    item: function (slug) { return jfetch("/api/knowledge/items/" + encodeURIComponent(slug)); },
    courses: function () { return jfetch("/api/knowledge/courses"); },
    course: function (slug) { return jfetch("/api/knowledge/courses/" + encodeURIComponent(slug)); },
    eList: function () { return jfetch("/api/knowledge/editor/items", { headers: authH() }); },
    eQueue: function () { return jfetch("/api/knowledge/editor/queue", { headers: authH() }); },
    eGet: function (id) { return jfetch("/api/knowledge/editor/items/" + id, { headers: authH() }); },
    eCreate: function (d) { return jfetch("/api/knowledge/editor/items", jbody("POST", d)); },
    eSave: function (id, d) { return jfetch("/api/knowledge/editor/items/" + id, jbody("PUT", d)); },
    eAct: function (id, act, d) { return jfetch("/api/knowledge/editor/items/" + id + "/" + act, jbody("POST", d)); },
    eDel: function (id) { return jfetch("/api/knowledge/editor/items/" + id, { method: "DELETE", headers: authH() }); },
    eCourses: function () { return jfetch("/api/knowledge/editor/courses", { headers: authH() }); },
    cCreate: function (d) { return jfetch("/api/knowledge/editor/courses", jbody("POST", d)); },
    cSave: function (id, d) { return jfetch("/api/knowledge/editor/courses/" + id, jbody("PUT", d)); },
    cDel: function (id) { return jfetch("/api/knowledge/editor/courses/" + id, { method: "DELETE", headers: authH() }); }
  };

  /* ══ RENDERER: markdown z blokami ═════════════════════════════════════ */
  var SAFE_STYLE_PROPS = /^(font|text|letter-spacing|line-height|color|fill|stroke|opacity|width|height|max-width|min-width|max-height|margin|padding|display|gap|flex|align|justify|border|background-color|white-space|word-break|overflow|vertical-align|cursor|stop-color|stop-opacity|stroke-width|stroke-dasharray|font-family|font-size|font-weight)/i;
  function cleanStyle(v) {
    return String(v || "").split(";").map(function (d) {
      var i = d.indexOf(":"); if (i < 0) return "";
      var p = d.slice(0, i).trim().toLowerCase(), val = d.slice(i + 1).trim();
      if (!SAFE_STYLE_PROPS.test(p) || /url\s*\(|expression|javascript:|@import|position|!important/i.test(p + val)) return "";
      return p + ":" + val;
    }).filter(Boolean).join(";");
  }
  function scrubStyles(root) {
    [].forEach.call(root.querySelectorAll("[style]"), function (el) {
      var s = cleanStyle(el.getAttribute("style")); if (s) el.setAttribute("style", s); else el.removeAttribute("style");
    });
  }
  function purify(html, cfg) {
    if (!global.DOMPurify) { var d = document.createElement("div"); d.textContent = html; return d.innerHTML; }
    return global.DOMPurify.sanitize(html, cfg || {});
  }
  // w treściach nie ma miejsca na formularze, pola, ramki i style (phishing, nakładki, przejmowanie strony)
  var MD_FORBID = { FORBID_TAGS: ["form", "input", "textarea", "select", "option", "button", "label", "fieldset", "style", "script", "iframe", "frame", "object", "embed", "link", "meta", "base", "dialog", "template", "svg", "math"], FORBID_ATTR: ["srcdoc", "formaction", "action", "autofocus"] };
  function mdHtml(text) {
    if (!global.marked) { var d = document.createElement("div"); d.textContent = text; return d.innerHTML; }
    return purify(global.marked.parse(text, { gfm: true }), MD_FORBID);
  }
  function fixLinks(root) {
    [].forEach.call(root.querySelectorAll("a[href]"), function (a) {
      var href = a.getAttribute("href") || "";
      if (/^(https?:|mailto:)/i.test(href)) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer nofollow ugc"); }
      else if (!/^(#|\/(?!\/))/.test(href)) a.removeAttribute("href");
    });
    [].forEach.call(root.querySelectorAll("[id]"), function (el) { el.removeAttribute("id"); });   // brak kolizji z id aplikacji (DOM clobbering)
    [].forEach.call(root.querySelectorAll("img"), function (im) {
      // tylko obrazy wgrane na serwer (brak śledzenia przez zewnętrzne hosty i obrazów-pułapek)
      if (!/^\/static\/media\/[\w\-./]+$/.test(im.getAttribute("src") || "") || /\.\./.test(im.getAttribute("src"))) { im.replaceWith(h("span", { "class": "kn-badimg", text: _t('kn.obrazDozwoloneTylkoWgrane') })); return; }
      im.setAttribute("loading", "lazy"); im.setAttribute("referrerpolicy", "no-referrer");
      var p = im.parentNode;
      if (p && p.tagName === "P" && p.childNodes.length === 1) {   // obraz sam w akapicie → rysunek z podpisem (alt)
        var fig = h("figure", { "class": "kn-img" }, [im]);
        if (im.alt) fig.appendChild(h("figcaption", { text: im.alt }));
        p.replaceWith(fig);
      }
    });
    [].forEach.call(root.querySelectorAll("table"), function (t) {
      t.classList.add("comp-table");
      var w = h("div", { "class": "kn-table-wrap" }); t.parentNode.insertBefore(w, t); w.appendChild(t);
    });
    scrubStyles(root);
  }
  function mdFragment(text, codes) {
    var box = document.createElement("div");
    var store = [];
    // bloki kodu wycinamy przed markdownem – kod nigdy nie przechodzi przez marked/innerHTML
    var src = String(text || "").replace(/^```([^\n`]*)\n([\s\S]*?)\n?```[ \t]*$/gm, function (_, info, code) {
      store.push({ info: info.trim(), code: code }); return "\n\nESNCODE" + (store.length - 1) + "END\n\n";
    });
    box.innerHTML = mdHtml(src);
    fixLinks(box);
    [].forEach.call(box.querySelectorAll("p"), function (p) {
      var m = /^ESNCODE(\d+)END$/.exec(p.textContent.trim());
      if (m && store[+m[1]]) p.replaceWith(codeBlock(store[+m[1]].info, store[+m[1]].code));
    });
    return box;
  }
  function inlineHtml(text) {
    var box = document.createElement("span");
    box.innerHTML = purify(global.marked ? global.marked.parseInline(String(text || "")) : "", MD_FORBID);
    fixLinks(box);
    return box;
  }

  var HL = { cpp: "cpp", "c++": "cpp", c: "c", arduino: "arduino", ino: "arduino", python: "python", py: "python", bash: "bash", sh: "bash", shell: "bash",
    yaml: "yaml", yml: "yaml", json: "json", ini: "ini", rust: "rust", js: "javascript", javascript: "javascript", html: "xml", xml: "xml", md: "markdown" };
  function codeBlock(info, code) {
    var m = /^(\S*)\s*(.*)$/.exec(info || ""), lang = (m[1] || "").toLowerCase(), title = m[2] || "";
    var codeEl = h("code", {});
    codeEl.textContent = code;
    var hl = global.hljs, l = HL[lang];
    if (hl && l) {
      if (l === "arduino" && !hl.getLanguage("arduino")) l = "cpp";
      try { if (hl.getLanguage(l)) { codeEl.innerHTML = hl.highlight(code, { language: l, ignoreIllegals: true }).value; codeEl.classList.add("hljs"); } } catch (e) { codeEl.textContent = code; }
    }
    var copy = h("button", { type: "button", "class": "esn-copy", text: _t('kn.kopiuj') });
    copy.addEventListener("click", function () {
      var done = function () { copy.textContent = _t('kn.skopiowano'); setTimeout(function () { copy.textContent = _t('kn.kopiuj'); }, 1400); };
      if (navigator.clipboard && global.isSecureContext) navigator.clipboard.writeText(code).then(done, function () { toast(_t('kn.nieUdaloSieSkopiowac'), "error"); });
      else toast(_t('kn.kopiowanieWymagaPolaczeniaHttps'), "error");
    });
    var LABEL = { cpp: "C++", c: "C", arduino: "Arduino", ino: "Arduino", python: "Python", py: "Python", bash: "Bash", sh: "Bash", shell: "Bash", yaml: "YAML", yml: "YAML", json: "JSON", ini: "INI", rust: "Rust", js: "JavaScript", javascript: "JavaScript", html: "HTML", xml: "XML", md: "Markdown" };
    var head = h("div", { "class": "esn-code-head" }, [h("span", { "class": "esn-code-title", text: title || LABEL[lang] || (lang || _t('kn.kod')) }), copy]);
    return h("div", { "class": "kn-codewrap" }, [head, h("div", { "class": "code-block esn-hl kn-code" }, [h("pre", {}, [codeEl])])]);
  }

  /* parser bloków :::nazwa [argument] … ::: (bez zagnieżdżania; fence ``` wewnątrz jest respektowany) */
  function parseBlocks(body) {
    var out = [], buf = [], cur = null, fence = false;
    function flushMd() { var t = buf.join("\n"); if (t.trim()) out.push({ type: "md", text: t }); buf = []; }
    String(body || "").split(/\r?\n/).forEach(function (line) {
      if (/^\s*(```|~~~)/.test(line)) fence = !fence;
      var open = !fence && !cur && /^:::[ \t]*([a-z]+)(?:[ \t]+(.*))?$/.exec(line);
      if (open) { flushMd(); cur = { name: open[1], arg: (open[2] || "").trim(), lines: [] }; return; }
      if (cur && !fence && /^:::[ \t]*$/.test(line)) { out.push({ type: "block", name: cur.name, arg: cur.arg, text: cur.lines.join("\n") }); cur = null; return; }
      (cur ? cur.lines : buf).push(line);
    });
    if (cur) out.push({ type: "block", name: cur.name, arg: cur.arg, text: cur.lines.join("\n") });
    flushMd();
    return out;
  }

  var CALLOUT = { note: "callout-note", info: "callout-info", warn: "callout-warn", warning: "callout-warn", danger: "callout-danger", critical: "callout-danger", ok: "callout-ok", tip: "callout-ok", neutral: "callout-neutral", gray: "callout-neutral" };
  var figSeq = 0, widgetSeq = 0, widgetMap = {};

  // Rysunki SVG (np. z pilotażu) mają kolory starej, ciemnej palety wpisane jako #hex/rgba. Przy renderowaniu podmieniamy je na zmienne motywu,
  // żeby czytały się w jasnym i ciemnym motywie (treść w bazie zostaje bez zmian).
  var FIG_HEX = {
    "#e0eaf5": "var(--text)", "#8a9ab5": "var(--text2)", "#5a6a80": "var(--text3)", "#00d4ff": "var(--accent)", "#56e1fd": "var(--accent)",
    "#00ff88": "var(--green)", "#ff4466": "var(--red)", "#ff8c00": "var(--orange)", "#9d6fff": "var(--purple)",
    "#ffab70": "var(--orange-t)", "#c0a0ff": "var(--purple-t)", "#1a2030": "var(--card2)", "#243040": "var(--border2)", "#3a4a5a": "var(--border2)",
    "#1e2a3a": "var(--border)", "#0e1117": "var(--bg2)", "#080b10": "var(--bg)", "#141920": "var(--card)"
  };
  var FIG_RGB = { "0,212,255": "accent", "86,225,253": "accent", "0,255,136": "green", "255,140,0": "orange", "157,111,255": "purple", "255,68,102": "red" };
  function figureTheme(svg) {
    return String(svg).replace(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,/g, function (m, r, g, b) {
      var n = FIG_RGB[r + "," + g + "," + b]; return n ? "rgba(var(--" + n + "-rgb)," : m;
    }).replace(/#[0-9a-fA-F]{6}\b/g, function (m) { return FIG_HEX[m.toLowerCase()] || m; });
  }

  function figureNode(arg, svg) {
    var n = ++figSeq, prefix = "kf" + n + "-";
    var clean = purify(figureTheme(svg), {
      USE_PROFILES: { svg: true, svgFilters: true, html: true },
      FORBID_TAGS: ["style", "script", "use", "image", "foreignobject", "a", "iframe", "object", "embed", "form", "link", "meta", "base"],
      FORBID_ATTR: ["srcdoc", "formaction"]
    });
    var box = document.createElement("div"); box.innerHTML = clean;
    // id → unikalne prefiksy, wraz z odwołaniami url(#id) / href="#id"
    var ids = {};
    [].forEach.call(box.querySelectorAll("[id]"), function (el) { ids[el.id] = prefix + el.id; el.id = prefix + el.id; });
    if (Object.keys(ids).length) {
      [].forEach.call(box.querySelectorAll("*"), function (el) {
        [].forEach.call(el.attributes, function (at) {
          var v = at.value;
          if (v.indexOf("#") < 0) return;
          var nv = v.replace(/url\(\s*#([^)\s]+)\s*\)/g, function (m, id) { return ids[id] ? "url(#" + ids[id] + ")" : m; });
          if ((at.name === "href" || at.name === "xlink:href") && v[0] === "#" && ids[v.slice(1)]) nv = "#" + ids[v.slice(1)];
          if (nv !== v) el.setAttribute(at.name, nv);
        });
      });
    }
    scrubStyles(box);
    [].forEach.call(box.querySelectorAll("svg"), function (s) { if (!s.getAttribute("role")) s.setAttribute("role", "img"); if (!s.getAttribute("aria-label")) s.setAttribute("aria-label", arg || _t('kn.rysunek')); });
    var wrap = h("div", { "class": "diagram-wrap kn-figure" });
    if (arg) wrap.appendChild(h("div", { "class": "diagram-title", text: arg }));
    while (box.firstChild) wrap.appendChild(box.firstChild);
    return wrap;
  }

  var WIDGET_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'";
  var WIDGET_CSS_RAW = "body{font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#e6edf3}" +
    "label{display:block;color:#9fb0c3;font-size:12px}" +
    "input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:99px;margin:10px 0;outline:none;cursor:pointer;background:linear-gradient(to right,#56e1fd var(--p,50%),#30363d var(--p,50%))}" +
    "input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:18px;height:18px;border-radius:50%;background:#0d1117;border:2px solid #56e1fd;box-shadow:0 0 0 4px rgba(86,225,253,.15);transition:box-shadow .15s}" +
    "input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#0d1117;border:2px solid #56e1fd;box-shadow:0 0 0 4px rgba(86,225,253,.15)}" +
    "input[type=range]::-moz-range-track{background:transparent}" +
    "input[type=range]:hover::-webkit-slider-thumb,input[type=range]:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 7px rgba(86,225,253,.22)}" +
    "input[type=number],input[type=text],select,textarea{background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:8px;padding:7px 10px;font:inherit;outline:none;transition:border-color .15s,box-shadow .15s}" +
    "input[type=number]:focus,input[type=text]:focus,select:focus,textarea:focus{border-color:#56e1fd;box-shadow:0 0 0 3px rgba(86,225,253,.15)}" +
    "select{-webkit-appearance:none;appearance:none;padding-right:30px;cursor:pointer;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%239fb0c3' stroke-width='1.6'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right 10px center}" +
    "button{background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:8px;padding:7px 14px;font:inherit;cursor:pointer;transition:border-color .15s,color .15s,background .15s}" +
    "button:hover:not(:disabled){border-color:#56e1fd;color:#56e1fd}button:active:not(:disabled){background:#1c2530}button:disabled{opacity:.5;cursor:default}button:focus-visible{outline:2px solid #56e1fd;outline-offset:2px}" +
    "input[type=checkbox],input[type=radio]{accent-color:#56e1fd}";
  // Paleta widgetów: [ciemna, jasna]. Treści widgetów (także zapisane w bazie) mają kolory wpisane jako #hex; przy renderowaniu
  // podmieniamy je na zmienne --w-*, więc widgety zmieniają motyw bez zmiany ich kodu.
  var WIDGET_PAL = {
    text: ["#e6edf3", "#14202e"], muted: ["#9fb0c3", "#4a5b72"], border: ["#30363d", "#c3cedb"], card: ["#161b22", "#ffffff"],
    bg: ["#0d1117", "#f4f7fb"], bar: ["#21262d", "#dde4ee"], acc: ["#56e1fd", "#0a7ea4"], ok: ["#3fb950", "#1a8a3a"],
    bad: ["#f85149", "#d1242f"], warn: ["#ff8c00", "#b85c00"], dim: ["#6e7681", "#5d6e85"], accbg: ["#0e3a4a", "#d3edf6"],
    pink: ["#ff7bd5", "#b3329a"], warnbg: ["#3a2a0e", "#fbe9cf"], badbg: ["#3a1d1d", "#fbdcdc"], badbg2: ["#2a1111", "#fdeaea"],
    okbg: ["#1d3b24", "#d6f0dc"], press: ["#1c2530", "#e6ecf4"]
  };
  var WIDGET_HEX = {};
  Object.keys(WIDGET_PAL).forEach(function (k) { WIDGET_HEX[WIDGET_PAL[k][0]] = k; });
  // Kolory starej palety platformy (widgety z pilotażu, np. ADC) – przypisane do odpowiadających im zmiennych
  var WIDGET_ALIAS = { "#e0eaf5": "text", "#8a9ab5": "muted", "#5a6a80": "dim", "#0e1117": "bg", "#080b10": "bg", "#141920": "card",
    "#1e2a3a": "border", "#243040": "border", "#1a2030": "card", "#00d4ff": "acc", "#00ff88": "ok", "#ff4466": "bad", "#ffab70": "warn" };
  Object.keys(WIDGET_ALIAS).forEach(function (k) { if (!WIDGET_HEX[k]) WIDGET_HEX[k] = WIDGET_ALIAS[k]; });
  function widgetVars(i) {
    return Object.keys(WIDGET_PAL).map(function (k) { return "--w-" + k + ":" + WIDGET_PAL[k][i]; }).join(";") + ";--w-acc-rgb:" + (i ? "10,126,164" : "86,225,253");
  }
  function widgetTheme(src) {
    return String(src).replace(/rgba\(\s*(?:86\s*,\s*225\s*,\s*253|0\s*,\s*212\s*,\s*255)\s*,/g, "rgba(var(--w-acc-rgb),").replace(/#[0-9a-fA-F]{6}\b/g, function (m) {
      var n = WIDGET_HEX[m.toLowerCase()]; return n ? "var(--w-" + n + ")" : m;
    });
  }
  var WIDGET_THEME_CSS = ":root{color-scheme:dark;" + widgetVars(0) + "}:root[data-theme=light]{color-scheme:light;" + widgetVars(1) + "}" +
    ":root[data-theme=light] select{background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%234a5b72' stroke-width='1.6'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right 10px center}";
  var WIDGET_CSS = widgetTheme(WIDGET_CSS_RAW);
  function widgetDoc(code, id) {
    var poster = "(function(){var i=" + JSON.stringify(id) + ",last=0;function m(){var b=document.body;if(!b)return 0;var c=getComputedStyle(b);return Math.ceil(b.getBoundingClientRect().height+parseFloat(c.marginTop||0)+parseFloat(c.marginBottom||0));}" +
      "function p(){try{var h=m();if(h&&Math.abs(h-last)>1){last=h;parent.postMessage({esnw:i,h:h},'*')}}catch(e){}}" +
      "function fr(r){var a=parseFloat(r.min)||0,b=isNaN(parseFloat(r.max))?100:parseFloat(r.max),v=(parseFloat(r.value)-a)/((b-a)||1)*100;r.style.setProperty('--p',Math.max(0,Math.min(100,v))+'%')}" +
      "function fa(){[].forEach.call(document.querySelectorAll('input[type=range]'),fr)}addEventListener('input',function(e){if(e.target&&e.target.type==='range')fr(e.target)},true);setInterval(fa,400);" +
      "function init(){fa();p();if(window.ResizeObserver&&document.body){new ResizeObserver(p).observe(document.body)}addEventListener('resize',p);addEventListener('load',p);setTimeout(p,80)}" +
      "addEventListener('message',function(e){var d=e.data;if(d&&(d.esnTheme==='light'||d.esnTheme==='dark'))document.documentElement.setAttribute('data-theme',d.esnTheme)});" +
      "if(document.readyState==='loading')addEventListener('DOMContentLoaded',init);else init();})();";
    var body = widgetTheme(String(code || "").replace(/<!doctype[^>]*>/ig, ""));
    var theme = window.ESNTheme ? window.ESNTheme.effective() : "dark";
    return "<!doctype html><html data-theme=\"" + theme + "\"><head><meta charset=\"utf-8\"><meta http-equiv=\"Content-Security-Policy\" content=\"" + WIDGET_CSP + "\">" +
      "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><style>" + WIDGET_THEME_CSS + WIDGET_CSS + "html,body{margin:0;background:transparent}</style><script>" + poster + "<\/script></head><body>" + body + "</body></html>";
  }
  function widgetNode(name, heightArg, widgets) {
    var code = widgets && widgets[name];
    if (typeof code !== "string") return h("div", { "class": "callout callout-warn" }, [h("h3", { text: _t('kn.brakWidgetu') }), _t('kn.widget') + name + _t('kn.nieIstniejeWTej')]);
    var id = "w" + (++widgetSeq), hgt = Math.max(80, Math.min(1200, parseInt(heightArg, 10) || 320));
    var f = h("iframe", { "class": "kn-widget", sandbox: "allow-scripts", referrerpolicy: "no-referrer", title: _t('kn.interaktywnyWidget') + " " + name, style: "height:" + hgt + "px", loading: "lazy" });
    f.srcdoc = widgetDoc(code, id);
    f.addEventListener("load", function () { try { if (window.ESNTheme && f.contentWindow) f.contentWindow.postMessage({ esnTheme: window.ESNTheme.effective() }, "*"); } catch (err) { /* ignoruj */ } });
    widgetMap[id] = f;
    return h("div", { "class": "kn-widget-wrap" }, [f]);
  }
  document.addEventListener("esn-theme", function (ev) {
    var t = ev.detail && ev.detail.theme; if (t !== "light" && t !== "dark") return;
    Object.keys(widgetMap).forEach(function (k) {
      var f = widgetMap[k];
      try { if (f.isConnected && f.contentWindow) f.contentWindow.postMessage({ esnTheme: t }, "*"); } catch (err) { /* iframe w trakcie ładowania */ }
    });
  });
  window.addEventListener("message", function (e) {
    var d = e.data; if (!d || typeof d.esnw !== "string" || typeof d.h !== "number") return;
    var f = widgetMap[d.esnw]; if (!f || f.contentWindow !== e.source) return;
    f.style.height = Math.max(80, Math.min(1200, d.h)) + "px";
  });

  function renderBody(container, body, widgets, opts) {
    var safe = !!(opts && opts.safe);   // tryb użytkownika (opis projektu): bez SVG i widgetów
    container.textContent = "";
    var group = null;   // grupa plusy/minusy
    parseBlocks(body).forEach(function (b) {
      if (b.type === "md") { group = null; container.appendChild(mdFragment(b.text)); return; }
      var n = b.name, node;
      if (n === "pros" || n === "cons") {
        if (!group) { group = h("div", { "class": "pros-cons" }); container.appendChild(group); }
        var box = h("div", { "class": n }, [h("div", { "class": n + "-title", text: b.arg || (n === "pros" ? _t('kn.plusy') : _t('kn.minusy')) })]);
        box.appendChild(mdFragment(b.text)); group.appendChild(box); return;
      }
      group = null;
      if (n === "summary") { node = h("div", { "class": "short-card" }, [h("h3", { text: b.arg || _t('kn.szybkiePodsumowanie') })]); node.appendChild(mdFragment(b.text)); }
      else if (n === "card") { node = h("div", { "class": "card" }); if (b.arg) node.appendChild(h("div", { "class": "card-title", text: b.arg })); node.appendChild(mdFragment(b.text)); }
      else if (CALLOUT[n]) { node = h("div", { "class": "callout " + CALLOUT[n] }); if (b.arg) node.appendChild(h("h3", { text: b.arg })); node.appendChild(mdFragment(b.text)); }
      else if (n === "kv") {
        node = h("div", { "class": "kv-block" });
        b.text.split("\n").forEach(function (ln) {
          var i = ln.indexOf("|"); if (!ln.trim() || i < 0) return;
          var k = h("span", { "class": "kv-key" }), v = h("span", { "class": "kv-val" });
          k.appendChild(inlineHtml(ln.slice(0, i).trim())); v.appendChild(inlineHtml(ln.slice(i + 1).trim()));
          node.appendChild(h("div", { "class": "kv-row" }, [k, v]));
        });
      } else if (n === "stats") {
        node = h("div", { "class": "stat-grid" });
        b.text.split("\n").forEach(function (ln) {
          if (!ln.trim()) return; var p = ln.split("|").map(function (x) { return x.trim(); });
          var col = { accent: "sv-accent", green: "sv-green", orange: "sv-orange" }[(p[3] || "").toLowerCase()] || "";
          node.appendChild(h("div", { "class": "stat-card" }, [h("div", { "class": "stat-label", text: p[0] || "" }), h("div", { "class": "stat-val " + col, text: p[1] || "" }), h("div", { "class": "stat-sub", text: p[2] || "" })]));
        });
      } else if ((n === "figure" || n === "widget") && safe) node = h("div", { "class": "callout callout-neutral" }, [h("h3", { text: _t('kn.blokNiedostepny') }), _t('kn.rysunkiSvgIWidgety')]);
      else if (n === "figure") node = figureNode(b.arg, b.text);
      else if (n === "widget") { var a = b.arg.split(/\s+/); node = widgetNode(a[0] || "", a[1], widgets); }
      else {
        var ext = global.ESNKnowledgeBlocks && global.ESNKnowledgeBlocks.render(n, b.arg, b.text, { h: h, inline: inlineHtml, md: mdFragment });
        if (ext) node = ext; else { node = h("div", { "class": "callout callout-info" }); node.appendChild(mdFragment(b.text)); }
      }
      container.appendChild(node);
    });
    return container;
  }

  /* ══ WIDOKI ═══════════════════════════════════════════════════════════ */
  var root = null;
  function R() { return root || (root = document.getElementById("knowledge-root")); }
  function go(path) { history.pushState({ view: "knowledge" }, "", "#knowledge" + (path ? "/" + path : "")); route(); window.scrollTo(0, 0); }
  function loading(el) { el.textContent = ""; el.appendChild(h("div", { "class": "kn-empty", text: _t('kn.ladowanie') })); }
  function errBox(el, e) { el.textContent = ""; el.appendChild(h("div", { "class": "callout callout-danger" }, [h("h3", { text: _t('kn.nieUdaloSieWczytac') }), (e && e.message) || _t('kn.blad')])); }

  function badge(text, cls) { return h("span", { "class": "badge " + cls, text: text }); }
  function itemCard(it, opts) {
    var meta = [it.reading_min + " min"].concat((it.tags || []).slice(0, 3).map(function (t) { return "#" + t })).join(" · ");
    var c = h("button", { type: "button", "class": "kn-card", onclick: function () { go(it.slug); } }, [
      h("span", { "class": "kn-card-top" }, [badge(it.kind_label, KIND_BADGE[it.kind] || "badge-gray"), (opts && opts.noLevel) ? null : badge(it.level_label, "badge-gray")]),
      h("strong", { "class": "kn-card-title", text: (opts && opts.no ? opts.no + ". " : "") + it.title }),
      it.summary ? h("span", { "class": "kn-card-sum", text: it.summary }) : null,
      h("span", { "class": "kn-card-meta", text: meta })
    ]);
    return c;
  }
  function courseCard(c) {
    return h("button", { type: "button", "class": "kn-card kn-course", onclick: function () { go("kurs/" + c.slug); } }, [
      h("span", { "class": "kn-card-top" }, [badge(_t('kn.kurs'), "badge-purple"), badge(c.level_label, "badge-gray")]),
      h("strong", { "class": "kn-card-title", text: c.title }),
      c.summary ? h("span", { "class": "kn-card-sum", text: c.summary }) : null,
      h("span", { "class": "kn-card-meta", text: _tn('kn.lessons', c.lessons) + " · ~" + c.reading_min + " " + _t('kn.min') })
    ]);
  }

  var state = { tab: "all", level: "", q: "" };
  function renderHome(el) {
    el.textContent = "";
    var staff = isStaff();
    var actions = h("div", { "class": "kn-actions" }, [
      isAdmin() ? h("button", { type: "button", "class": "btn-action", onclick: function () { app.navigate("theory"); }, text: _t('kn.archiwumAdminNiezbednikV1') }) : null,
      staff ? h("button", { type: "button", "class": "btn-action primary", onclick: function () { go("redakcja"); }, text: _t('kn.panelRedakcji') }) : null
    ]);
    el.appendChild(h("section", { "class": "hero kn-hero" }, [
      h("div", { "class": "hero-tag", text: _t('kn.bazaWiedzy') }),
      h("h1", {}, [_t('kn.wiedza') + " ", h("em", { text: "od podstaw" })]),
      h("p", { "class": "hero-sub", text: _t('kn.niezbednikiPoradnikiArtykulyI') }),
      actions
    ]));
    var wrap = h("div", { "class": "full-wrap kn-wrap" });
    var tabs = h("div", { "class": "esn-tabs", role: "tablist", "aria-label": _t('kn.rodzajTresci') });
    var TABS = [["all", _t('kn.wszystko')], ["essential", _t('kn.niezbedniki')], ["guide", _t('kn.poradniki')], ["article", _t('kn.artykuly')], ["course", _t('kn.kursy')]];
    var results = h("div", { "class": "kn-results" });
    var search = h("input", { type: "search", "class": "text-input kn-search", placeholder: _t('kn.szukajWWiedzy'), "aria-label": _t('kn.szukaj'), value: state.q });
    var levels = h("select", { "class": "sort-select", "aria-label": _t('kn.poziom') }, [h("option", { value: "", text: _t('kn.wszystkiePoziomy') })].concat(LEVEL_ORDER.map(function (l) { return h("option", { value: l, text: LEVEL_LABEL[l] }); })));
    levels.value = state.level;
    var btns = TABS.map(function (t) {
      var b = h("button", { type: "button", role: "tab", text: t[1], onclick: function () { state.tab = t[0]; mark(); load(); } });
      tabs.appendChild(b); return b;
    });
    function mark() { btns.forEach(function (b, i) { b.setAttribute("aria-selected", String(TABS[i][0] === state.tab)); }); }
    var timer = null;
    search.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(function () { state.q = search.value.trim(); load(); }, 250); });
    levels.addEventListener("change", function () { state.level = levels.value; load(); });
    wrap.appendChild(tabs);
    wrap.appendChild(h("div", { "class": "controls-bar kn-controls" }, [h("div", { "class": "search-wrap" }, [search]), levels]));
    wrap.appendChild(results);
    el.appendChild(wrap);
    mark();

    function section(title, nodes, note) {
      var s = h("section", { "class": "kn-group" }, [h("h2", { "class": "kn-group-title", text: title })]);
      if (note) s.appendChild(h("p", { "class": "kn-group-note", text: note }));
      s.appendChild(h("div", { "class": "kn-grid" }, nodes)); return s;
    }
    function load() {
      loading(results);
      var q = "kind=" + (["essential", "guide", "article"].indexOf(state.tab) >= 0 ? state.tab : "") + "&level=" + state.level + "&q=" + encodeURIComponent(state.q);
      var wantCourses = (state.tab === "all" || state.tab === "course") && !state.q;
      var wantItems = state.tab !== "course" || !!state.q;
      Promise.all([wantCourses ? api.courses() : [], wantItems ? api.items(q) : []]).then(function (r) {
        if (!results.isConnected) return;
        results.textContent = "";
        var courses = r[0].filter(function (c) { return !state.level || c.level === state.level; }), items = r[1];
        if (courses.length) results.appendChild(section(_t('kn.kursy'), courses.map(courseCard), _t('kn.uporzadkowaneSerieLekcjiIdz')));
        if (state.q) {
          if (items.length) results.appendChild(section(_t('kn.wynikiWyszukiwania'), items.map(function (i) { return itemCard(i); })));
        } else {
          LEVEL_ORDER.forEach(function (lv) {
            var list = items.filter(function (i) { return i.level === lv; });
            if (list.length) results.appendChild(section(LEVEL_LABEL[lv], list.map(function (i) { return itemCard(i, { noLevel: true }); })));
          });
        }
        if (!results.childNodes.length) results.appendChild(h("div", { "class": "kn-empty", text: state.q ? _t('kn.brakWynikowDlaTego') : _t('kn.brakTresciWTej') }));
        results.appendChild(h("p", { "class": "kn-soon", text: _t('kn.wkrotceSledzeniePostepuW') }));
      }).catch(function (e) { errBox(results, e); });
    }
    load();
  }

  function renderCourse(el, slug) {
    loading(el);
    api.course(slug).then(function (c) {
      if (!el.isConnected) return;
      el.textContent = "";
      var list = h("ol", { "class": "kn-lessons" });
      c.items.forEach(function (it, i) {
        list.appendChild(h("li", {}, [h("button", { type: "button", "class": "kn-lesson", onclick: function () { go(it.slug); } }, [
          h("span", { "class": "kn-lesson-no", text: String(i + 1) }),
          h("span", { "class": "kn-lesson-txt" }, [h("strong", { text: it.title }), it.summary ? h("span", { text: it.summary }) : null]),
          h("span", { "class": "kn-lesson-meta" }, [badge(it.level_label, "badge-gray"), h("span", { text: it.reading_min + " min" })])
        ])]));
      });
      el.appendChild(h("div", { "class": "full-wrap kn-wrap kn-narrow kn-top" }, [
        h("button", { type: "button", "class": "kn-back", text: _t('kn.wiedza2'), onclick: function () { go(""); } }),
        h("div", { "class": "kn-head" }, [h("div", { "class": "kn-card-top" }, [badge(_t('kn.kurs'), "badge-purple"), badge(c.level_label, "badge-gray")]),
          h("h1", { text: c.title }), h("p", { "class": "hero-sub", text: c.summary }),
          h("div", { "class": "kn-meta", text: _tn('kn.lessons', c.lessons) + " · " + _t('kn.readMin', { n: c.reading_min }) })]),
        c.items.length ? h("div", { "class": "kn-actions" }, [h("button", { type: "button", "class": "btn-action primary", onclick: function () { go(c.items[0].slug); }, text: _t('kn.zacznijKurs') }),
          h("button", { type: "button", "class": "btn-action", disabled: "disabled", title: _t('kn.taFunkcjaPojawiSie'), text: _t('kn.sledzeniePostepuWkrotce') })]) : null,
        c.items.length ? list : h("div", { "class": "kn-empty", text: _t('kn.tenKursNieMa') })
      ]));
    }).catch(function (e) { errBox(el, e); });
  }

  function renderArticle(el, slug) {
    loading(el);
    api.item(slug).then(function (a) {
      if (!el.isConnected) return;
      el.textContent = "";
      var body = h("div", { "class": "kn-body" });
      var meta = [fmtDate(a.updated_at || a.published_at), a.reading_min + " min czytania", a.author ? "autor: " + a.author : ""].filter(Boolean).join(" · ");
      var crumbs = h("div", { "class": "kn-crumbs" }, [h("button", { type: "button", "class": "kn-back", text: _t('kn.wiedza2'), onclick: function () { go(""); } })]);
      if (a.course) crumbs.appendChild(h("button", { type: "button", "class": "kn-back", text: _t('kn.kurs2') + " " + a.course.title, onclick: function () { go("kurs/" + a.course.slug); } }));
      var nav = null;
      if (a.course && (a.prev || a.next)) {
        nav = h("div", { "class": "kn-pager" }, [
          a.prev ? h("button", { type: "button", "class": "kn-pg", onclick: function () { go(a.prev.slug); } }, [h("small", { text: _t('kn.poprzedniaLekcja') }), h("strong", { text: a.prev.title })]) : h("span"),
          a.next ? h("button", { type: "button", "class": "kn-pg kn-pg-next", onclick: function () { go(a.next.slug); } }, [h("small", { text: _t('kn.nastepnaLekcja') }), h("strong", { text: a.next.title })]) : h("span")
        ]);
      }
      el.appendChild(h("div", { "class": "full-wrap kn-wrap kn-narrow kn-top" }, [
        crumbs,
        h("div", { "class": "kn-head" }, [
          h("div", { "class": "kn-card-top" }, [badge(a.kind_label, KIND_BADGE[a.kind] || "badge-gray"), badge(a.level_label, "badge-gray"),
            a.lesson_no ? badge(_t('kn.lekcja') + " " + a.lesson_no + " z " + a.lesson_total, "badge-purple") : null].concat((a.tags || []).map(function (t) { return h("span", { "class": "kn-tag", text: "#" + t }); }))),
          h("h1", { text: a.title }), a.summary ? h("p", { "class": "hero-sub", text: a.summary }) : null, h("div", { "class": "kn-meta", text: meta })
        ]),
        body, nav
      ]));
      renderBody(body, a.body, a.widgets);
      document.title = a.title + " – ESN";
    }).catch(function (e) { errBox(el, e); });
  }

  /* ══ PANEL REDAKCJI ═══════════════════════════════════════════════════ */
  var SNIPPETS = [
    [_t('kn.podsumowanie'), ":::summary Szybkie podsumowanie\n- punkt pierwszy\n- punkt drugi\n:::\n"],
    [_t('kn.karta'), ":::card Tytuł karty\nTreść w markdown.\n:::\n"],
    [_t('kn.notatka'), ":::note Notatka\nTreść.\n:::\n"], [_t('kn.uwaga'), ":::warn Uwaga\nTreść.\n:::\n"],
    [_t('kn.krytyczne'), ":::danger Krytyczne\nTreść.\n:::\n"], [_t('kn.rozwiazanie'), ":::ok Rozwiązanie\nTreść.\n:::\n"],
    [_t('kn.kluczwartosc'), ":::kv\nCPU | Xtensa LX6 · 240 MHz\nADC | 12-bit · 18 kanałów\n:::\n"],
    [_t('kn.statystyki'), ":::stats\nBaud rate | 115k | bps UART | green\nBufor | 64 | B | orange\n:::\n"],
    [_t('kn.plusy2'), ":::pros PLUSY\n- zaleta\n:::\n"], [_t('kn.minusy2'), ":::cons MINUSY\n- wada\n:::\n"],
    [_t('kn.rysunekSvg'), ":::figure Podpis rysunku\n<svg viewBox=\"0 0 200 80\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"10\" y=\"10\" width=\"180\" height=\"60\" rx=\"6\" fill=\"none\" stroke=\"#56e1fd\"/></svg>\n:::\n"],
    [_t('kn.szaraRamka'), ":::neutral Informacja\nTreść pomocnicza.\n:::\n"],
    [_t('kn.kroki'), ":::steps Instrukcja\nPodłącz zasilanie | Sprawdź polaryzację przed włączeniem\nWgraj program | Przez USB\n:::\n"],
    [_t('kn.osCzasu'), ":::timeline Historia\n1971 | Pierwszy mikroprocesor | Intel 4004\n1981 | IBM PC | Intel 8088\n:::\n"],
    [_t('kn.postep'), ":::progress\nWykorzystanie RAM | 62 | 320 KB z 512 KB | orange\nFlash | 35 | | green\n:::\n"],
    [_t('kn.definicje'), ":::def\nISR | Procedura obsługi przerwania\nDMA | Bezpośredni dostęp do pamięci\n:::\n"],
    [_t('kn.listaKontrolna'), ":::checklist\n- [x] Sprawdzone napięcie\n- [ ] Przetestowane na płytce\n:::\n"],
    [_t('kn.zwijana'), ":::details Pokaż rozwiązanie\nTreść widoczna po rozwinięciu.\n:::\n"],
    [_t('kn.zakladki'), ":::tabs\n=== Arduino\nTreść pierwszej zakładki.\n=== Python\nTreść drugiej zakładki.\n:::\n"],
    [_t('kn.diagramAlgorytm'), ":::flow Odczyt czujnika\n(s) Start\n[a] Odczytaj ADC\n{c} Wartość poprawna?\n[b] Zapisz do bufora\n(e) Koniec\ns -> a\na -> c\nc -> b : tak\nc -> a : nie\nb -> e\n:::\n"],
    [_t('kn.diagramBaza'), ":::er Użytkownicy i projekty\nusers: id PK, login, email\nprojects: id PK, owner_id FK, title\nusers 1--* projects : posiada\n:::\n"],
    [_t('kn.diagramSekwencja'), ":::sequence Ramka z potwierdzeniem\nMCU, PC\nMCU -> PC : ramka\nPC --> MCU : ACK\n:::\n"],
    [_t('kn.widget2'), ":::widget nazwa-widgetu 320\n:::\n"],
    [_t('kn.kod'), "```cpp Tytuł przykładu\nvoid setup() {}\n```\n"]
  ];

  function statusBadge(it) {
    var cls = it.state === "rejected" ? "badge-red" : it.state === "review" ? "badge-orange" : it.published ? "badge-green" : "badge-gray";
    return badge(it.status, cls);
  }

  /* ── instrukcja redakcji: ten sam renderer co artykuły, więc przykłady są „na żywo” ── */
  function renderGuide(el) {
    el.textContent = "";
    var G = global.ESNKnowledgeGuide, TPL = global.ESNKnowledgeTemplates || [];
    if (!G) { el.appendChild(h("div", { "class": "kn-empty", text: _t('kn.brakPlikuInstrukcjiKnowledge') })); return; }
    var wrap = h("div", { "class": "kn-guide" });
    var toc = h("nav", { "class": "kn-toc", "aria-label": _t('kn.spisTresciInstrukcji') });
    G.sections.forEach(function (sec) {
      var anchor = h("section", { "class": "kn-guide-sec" }, [h("h2", { "class": "kn-guide-h", text: sec.title })]);
      toc.appendChild(h("button", { type: "button", "class": "kn-snip", text: sec.title, onclick: function () { anchor.scrollIntoView({ behavior: "smooth", block: "start" }); } }));
      var body = h("div", { "class": "kn-body" });
      if (sec.md) renderBody(body, sec.md, {});
      if (sec.intro) body.appendChild(renderBody(h("div"), sec.intro, {}));
      (sec.examples || []).forEach(function (ex) {
        ex = { title: ex.title, src: String(ex.src).replace(/§§§/g, "```") };
        body.appendChild(h("div", { "class": "kn-example" }, [h("div", { "class": "kn-pv-label", text: ex.title }), codeBlock(_t('kn.mdKodDoWklejenia'), ex.src),
          h("div", { "class": "kn-pv-label", text: _t('kn.wynik') }), renderBody(h("div", { "class": "kn-ex-out" }), ex.src, {})]));
      });
      if (sec.templates) TPL.forEach(function (t) {
        var w = {}; w[t.id] = t.code;
        body.appendChild(h("div", { "class": "kn-example" }, [h("div", { "class": "kn-pv-label", text: _t('kn.szablon') + t.id + "”: " + t.name + " – " + t.desc }),
          renderBody(h("div", { "class": "kn-ex-out" }), ":::widget " + t.id + " " + (t.height || 300) + "\n:::", w)]));
      });
      if (sec.outro) body.appendChild(renderBody(h("div"), sec.outro, {}));
      anchor.appendChild(body); wrap.appendChild(anchor);
    });
    el.appendChild(toc); el.appendChild(wrap);
  }

  function renderEditorHome(el, sub) {
    el.textContent = "";
    var tab = sub[1] === "kolejka" ? "queue" : sub[1] === "kursy" ? "courses" : sub[1] === "instrukcja" ? "guide" : "items";
    var wrap = h("div", { "class": "full-wrap kn-wrap" });
    el.appendChild(h("section", { "class": "hero kn-hero" }, [h("div", { "class": "hero-tag", text: _t('kn.redakcja') }), h("h1", {}, [_t('kn.panel') + " ", h("em", { text: "redakcji" })]),
      h("p", { "class": "hero-sub", text: isAdmin() ? _t('kn.zatwierdzajTresciRedaktorowPublikuj') : _t('kn.tworzTresciIWysylaj') })]));
    var tabs = h("div", { "class": "esn-tabs", role: "tablist" });
    var T = [["items", _t('kn.tresci'), "redakcja"]];
    if (isAdmin()) { T.push(["queue", _t('kn.doZatwierdzenia'), "redakcja/kolejka"]); T.push(["courses", _t('kn.kursy'), "redakcja/kursy"]); }
    T.push(["guide", _t('kn.instrukcja'), "redakcja/instrukcja"]);
    T.forEach(function (t) { tabs.appendChild(h("button", { type: "button", role: "tab", "aria-selected": String(t[0] === tab), text: t[1], onclick: function () { go(t[2]); } })); });
    var top = h("div", { "class": "kn-actions" }, [h("button", { type: "button", "class": "btn-action", text: _t('kn.wiedza2'), onclick: function () { go(""); } }),
      h("button", { type: "button", "class": "btn-action primary", text: _t('kn.nowaTresc'), onclick: function () { go("redakcja/nowa"); } })]);
    var body = h("div", {});
    wrap.appendChild(top); wrap.appendChild(tabs); wrap.appendChild(body); el.appendChild(wrap);
    loading(body);
    if (tab === "courses") return renderCoursesAdmin(body);
    if (tab === "guide") return renderGuide(body);
    (tab === "queue" ? api.eQueue() : api.eList()).then(function (rows) {
      body.textContent = "";
      if (!rows.length) { body.appendChild(h("div", { "class": "kn-empty", text: tab === "queue" ? _t('kn.nicNieCzekaNa') : _t('kn.nieMaszJeszczeZadnych') })); return; }
      var F = { q: "", kind: "", level: "", status: "", sort: "updated", dir: -1 };
      function uniq(f) { var m = {}; rows.forEach(function (r) { m[r[f]] = 1; }); return Object.keys(m).sort(); }
      function sel(label, field, opts) {
        var s = h("select", { "class": "sort-select", "aria-label": label }, [h("option", { value: "", text: label + ": wszystkie" })].concat(opts.map(function (o) { return h("option", { value: o[0], text: o[1] }); })));
        s.addEventListener("change", function () { F[field] = s.value; draw(); }); return s;
      }
      var q = h("input", { "class": "text-input kn-q", type: "search", placeholder: _t('kn.szukajWTytuleOpisie'), "aria-label": _t('kn.szukajTresci') });
      var qt = null; q.addEventListener("input", function () { clearTimeout(qt); qt = setTimeout(function () { F.q = q.value.trim().toLowerCase(); draw(); }, 200); });
      var sortSel = h("select", { "class": "sort-select", "aria-label": _t('kn.sortowanie') }, [["updated:-1", _t('kn.najnowszeZmiany')], ["updated:1", _t('kn.najstarszeZmiany')], ["title:1", _t('kn.tytulAz')], ["title:-1", _t('kn.tytulZa')], ["level:1", _t('kn.poziomRosnaco')], ["status:1", _t('kn.status')]].map(function (o) { return h("option", { value: o[0], text: o[1] }); }));
      sortSel.addEventListener("change", function () { var p = sortSel.value.split(":"); F.sort = p[0]; F.dir = +p[1]; draw(); });
      var bar = h("div", { "class": "kn-filterbar" }, [q, sel(_t('kn.typ'), "kind", uniq("kind_label").map(function (x) { return [x, x]; })), sel(_t('kn.poziom'), "level", LEVEL_ORDER.map(function (l) { return [l, LEVEL_LABEL[l]]; })),
        sel(_t('kn.status'), "status", uniq("status").map(function (x) { return [x, x]; })), sortSel]);
      var count = h("div", { "class": "kn-meta kn-count" }), holder = h("div", {});
      body.appendChild(bar); body.appendChild(count); body.appendChild(holder);
      function draw() {
        var ql = F.q, list = rows.filter(function (r) {
          if (F.kind && r.kind_label !== F.kind) return false; if (F.level && r.level !== F.level) return false; if (F.status && r.status !== F.status) return false;
          if (ql && ((r.title || "") + " " + (r.summary || "") + " " + (r.tags || []).join(" ") + " " + (r.author || "") + " " + (r.slug || "")).toLowerCase().indexOf(ql) < 0) return false; return true;
        });
        var rank = function (l) { var i = LEVEL_ORDER.indexOf(l); return i < 0 ? 99 : i; };
        list.sort(function (a, b) {
          var x, y; if (F.sort === "title") { x = (a.title || "").toLowerCase(); y = (b.title || "").toLowerCase(); } else if (F.sort === "level") { x = rank(a.level); y = rank(b.level); } else if (F.sort === "status") { x = a.status || ""; y = b.status || ""; } else { x = a.updated_at || ""; y = b.updated_at || ""; }
          return (x < y ? -1 : x > y ? 1 : 0) * F.dir;
        });
        count.textContent = list.length + " z " + rows.length;
        holder.textContent = "";
        if (!list.length) { holder.appendChild(h("div", { "class": "kn-empty", text: _t('kn.brakTresciSpelniajacychKryteria') })); return; }
        holder.appendChild(tableOf(list));
      }
      function tableOf(list) {
      var t = h("table", { "class": "comp-table kn-table" }, [h("thead", {}, [h("tr", {}, [_t('kn.tytul'), _t('kn.typ'), _t('kn.poziom'), _t('kn.status'), _t('kn.autor'), _t('kn.zmiana')].map(function (x) { return h("th", { text: x }); }))])]);
      var tb = h("tbody"); t.appendChild(tb);
      list.forEach(function (it) {
        var tr = h("tr", { "class": "kn-row", tabindex: "0" }, [h("td", {}, [h("strong", { text: it.title }), it.review_note && it.state === "rejected" ? h("div", { "class": "kn-note-bad", text: _t('kn.odrzucone') + " " + it.review_note }) : null]),
          h("td", { text: it.kind_label }), h("td", { text: LEVEL_LABEL[it.level] || it.level }), h("td", {}, [statusBadge(it)]), h("td", { text: it.author || "—" }), h("td", { text: fmtDate(it.updated_at) })]);
        var open = function () { go("redakcja/edytuj/" + it.id); };
        tr.addEventListener("click", open); tr.addEventListener("keydown", function (e) { if (e.key === "Enter") open(); });
        tb.appendChild(tr);
      });
      return h("div", { "class": "kn-table-wrap" }, [t]);
      }
      draw();
    }).catch(function (e) { errBox(body, e); });
  }

  function renderCoursesAdmin(body) {
    function form(c, done) {
      var title = h("input", { "class": "text-input", value: c ? c.title : "", placeholder: _t('kn.tytulKursu'), maxlength: 150, "aria-label": _t('kn.tytulKursu') });
      var sum = h("input", { "class": "text-input", value: c ? c.summary : "", placeholder: _t('kn.krotkiOpis'), maxlength: 400, "aria-label": _t('kn.opisKursu') });
      var lvl = h("select", { "class": "sort-select", "aria-label": _t('kn.poziom') }, LEVEL_ORDER.map(function (l) { return h("option", { value: l, text: LEVEL_LABEL[l] }); })); lvl.value = c ? c.level : "basic";
      var pos = h("input", { type: "number", "class": "text-input kn-num", value: c ? c.position : 0, "aria-label": _t('kn.kolejnosc') });
      var pub = h("input", { type: "checkbox" }); pub.checked = !!(c && c.published);
      var save = h("button", { type: "button", "class": "btn-action primary", text: c ? _t('kn.zapiszKurs') : _t('kn.dodajKurs') });
      save.addEventListener("click", function () {
        var d = { title: title.value, summary: sum.value, level: lvl.value, position: parseInt(pos.value, 10) || 0, published: pub.checked };
        (c ? api.cSave(c.id, d) : api.cCreate(d)).then(function () { toast(_t('kn.zapisanoKurs'), "success"); done(); }).catch(function (e) { toast(e.message, "error"); });
      });
      return h("div", { "class": "kn-cform" }, [title, sum, h("div", { "class": "kn-inline" }, [lvl, h("label", {}, [_t('kn.kolejnosc') + " ", pos]), h("label", { "class": "kn-chk" }, [pub, " opublikowany"]), save])]);
    }
    function draw() {
      body.textContent = ""; body.appendChild(h("h3", { "class": "section-title", text: _t('kn.nowyKurs') })); body.appendChild(form(null, draw));
      body.appendChild(h("h3", { "class": "section-title", text: _t('kn.istniejaceKursy') }));
      var list = h("div", {}); body.appendChild(list); loading(list);
      api.eCourses().then(function (rows) {
        list.textContent = "";
        if (!rows.length) list.appendChild(h("div", { "class": "kn-empty", text: _t('kn.brakKursow') }));
        rows.forEach(function (c) {
          var box = h("div", { "class": "card kn-ccard" });
          var head = h("div", { "class": "kn-inline" }, [h("strong", { text: c.title }), badge(c.published ? _t('kn.opublikowany') : _t('kn.ukryty'), c.published ? "badge-green" : "badge-gray"), h("span", { "class": "kn-meta", text: c.lessons_total + " lekcji" }),
            h("button", { type: "button", "class": "btn-action", text: _t('kn.edytuj'), onclick: function () { box.appendChild(form(c, draw)); this.disabled = true; } }),
            h("button", { type: "button", "class": "btn-action", text: _t('kn.usun'), onclick: function () {
              askConfirm(_t('kn.usunacKurs') + c.title + "”?").then(function (ok) { if (ok) api.cDel(c.id).then(function () { toast(_t('kn.usunietoKurs'), "success"); draw(); }).catch(function (e) { toast(e.message, "error"); }); });
            } })]);
          box.appendChild(head); list.appendChild(box);
        });
      }).catch(function (e) { errBox(list, e); });
    }
    draw();
  }

  function renderEditForm(el, idStr) {
    var isNew = idStr === "nowa", id = isNew ? null : parseInt(idStr, 10);
    loading(el);
    Promise.all([isNew ? null : api.eGet(id), api.eCourses()]).then(function (r) {
      if (!el.isConnected) return;
      var rec = r[0], courses = r[1], c = rec ? rec.content : { kind: "article", title: "", summary: "", body: "", level: "basic", tags: [], widgets: {}, course_id: null, position: 0 };
      var widgets = JSON.parse(JSON.stringify(c.widgets || {}));
      var dirty = false;
      el.textContent = "";
      var wrap = h("div", { "class": "full-wrap kn-wrap kn-top" });
      var msg = h("div", { "class": "kn-status" });
      function setStatus() {
        msg.textContent = "";
        if (!rec) { msg.appendChild(badge(_t('kn.nowaTresc2'), "badge-gray")); return; }
        msg.appendChild(statusBadge(rec));
        if (rec.has_pending) msg.appendChild(h("span", { "class": "kn-meta", text: " " + _t('kn.wersjaPubliczna') + rec.live_title + _t('kn.ponizejEdytujeszOczekujaceZmiany') }));
        if (rec.state === "rejected" && rec.review_note) msg.appendChild(h("div", { "class": "callout callout-danger" }, [h("h3", { text: _t('kn.odrzuconePrzezAdministratora') }), rec.review_note]));
        if (rec.state === "review") msg.appendChild(h("div", { "class": "callout callout-warn" }, [h("h3", { text: _t('kn.czekaNaPrzeglad') }), isAdmin() ? _t('kn.zatwierdzAlboOdrzucZ') : _t('kn.edycjaJestZablokowanaDo')]));
      }
      var kind = h("select", { "class": "sort-select", "aria-label": _t('kn.typ') }, Object.keys(KIND_LABEL).map(function (k) { return h("option", { value: k, text: KIND_LABEL[k] }); })); kind.value = c.kind;
      var level = h("select", { "class": "sort-select", "aria-label": _t('kn.poziom') }, LEVEL_ORDER.map(function (l) { return h("option", { value: l, text: LEVEL_LABEL[l] }); })); level.value = c.level;
      var course = h("select", { "class": "sort-select", "aria-label": _t('kn.kurs') }, [h("option", { value: "", text: _t('kn.wybierzKurs') })].concat(courses.map(function (k) { return h("option", { value: String(k.id), text: k.title }); })));
      course.value = c.course_id ? String(c.course_id) : "";
      var pos = h("input", { type: "number", "class": "text-input kn-num", value: c.position || 0, "aria-label": _t('kn.pozycjaWKursieNa') });
      var title = h("input", { "class": "text-input", value: c.title, maxlength: 150, placeholder: _t('kn.tytul'), "aria-label": _t('kn.tytul') });
      var sum = h("textarea", { "class": "text-input kn-sum", maxlength: 400, rows: 2, placeholder: _t('kn.krotkiOpisWidocznyNa'), "aria-label": _t('kn.opis') }); sum.value = c.summary || "";
      var tags = h("input", { "class": "text-input", value: (c.tags || []).join(", "), placeholder: _t('kn.tagiPoPrzecinkuMax'), "aria-label": _t('kn.tagi') });
      var ta = h("textarea", { "class": "text-input kn-md", spellcheck: "true", "aria-label": _t('kn.trescMarkdownZBlokami') }); ta.value = c.body || "";
      var preview = h("div", { "class": "kn-body kn-preview" });
      var courseRow = h("label", { "class": "kn-fld" }, [h("span", { text: _t('kn.kurs') }), course]);
      function toggle() { courseRow.style.display = kind.value === "lesson" ? "" : "none"; }
      kind.addEventListener("change", function () { toggle(); mark(); }); toggle();
      function mark() { dirty = true; saveInfo.textContent = _t('kn.niezapisaneZmiany'); }
      var saveInfo = h("span", { "class": "kn-meta" });
      [level, course, pos, title, sum, tags].forEach(function (x) { x.addEventListener("input", mark); x.addEventListener("change", mark); });

      var tbar = h("div", { "class": "kn-snips", role: "toolbar", "aria-label": _t('kn.wstawBlok') }, SNIPPETS.map(function (s) {
        return h("button", { type: "button", "class": "kn-snip", text: s[0], onclick: function () {
          var st = ta.selectionStart, en = ta.selectionEnd, pre = ta.value.slice(0, st), need = pre && !/\n\n$/.test(pre) ? (/\n$/.test(pre) ? "\n" : "\n\n") : "";
          ta.value = pre + need + s[1] + ta.value.slice(en); ta.focus(); ta.dispatchEvent(new Event("input"));
        } });
      }));
      var pvTimer = null;
      /* tryb prosty (kreator blokowy) / zaawansowany (markdown) – wybór zapamiętany w przeglądarce */
      var mode = "simple"; try { mode = localStorage.getItem("kn_mode") === "adv" ? "adv" : "simple"; } catch (e) {}
      var wiz = global.ESNKnowledgeWizard ? global.ESNKnowledgeWizard.create({ ta: ta, h: h, parseBlocks: parseBlocks, toast: toast, getWidgets: function () { return widgets; }, templates: (global.ESNKnowledgeDocTemplates || {}).article,
        getImages: function () { return rec ? jfetch("/api/media?owner_type=article&owner_id=" + rec.id) : Promise.resolve([]); },
        onChange: function () { ta.dispatchEvent(new Event("input")); } }) : null;
      if (!wiz) mode = "adv";
      var modeBar = h("div", { "class": "kn-modebar", role: "group", "aria-label": _t('kn.trybEdycji') });
      var mBtns = {};
      function setMode(m) {
        mode = m; try { localStorage.setItem("kn_mode", m); } catch (e) {}
        Object.keys(mBtns).forEach(function (k) { mBtns[k].setAttribute("aria-pressed", String(k === m)); });
        tbar.style.display = m === "adv" ? "" : "none"; ta.style.display = m === "adv" ? "" : "none";
        if (wiz) { wiz.el.style.display = m === "simple" ? "" : "none"; if (m === "simple") wiz.refresh(); }
      }
      if (wiz) [["simple", _t('kn.prostyBloki')], ["adv", _t('kn.zaawansowanyMarkdown')]].forEach(function (m) {
        mBtns[m[0]] = h("button", { type: "button", "class": "kn-mode", text: m[1], onclick: function () { setMode(m[0]); } }); modeBar.appendChild(mBtns[m[0]]);
      });
      function drawPreview() { renderBody(preview, ta.value, widgets); }
      ta.addEventListener("input", function () { mark(); clearTimeout(pvTimer); pvTimer = setTimeout(drawPreview, 350); });

      /* widgety */
      var wbox = h("div", { "class": "kn-widgets" });
      function drawWidgets() {
        wbox.textContent = "";
        Object.keys(widgets).forEach(function (name) {
          var code = h("textarea", { "class": "text-input kn-code-in", spellcheck: "false", rows: 8, "aria-label": _t('kn.kodWidgetu') + " " + name }); code.value = widgets[name];
          code.addEventListener("input", function () { widgets[name] = code.value; mark(); clearTimeout(pvTimer); pvTimer = setTimeout(drawPreview, 600); });
          wbox.appendChild(h("div", { "class": "kn-widget-ed" }, [h("div", { "class": "kn-inline" }, [h("strong", { "class": "kn-wname", text: name }), h("span", { "class": "kn-meta", text: _t('kn.uzycieWidget') + " " + name + " 320" }),
            h("button", { type: "button", "class": "btn-action", text: _t('kn.usunWidget'), onclick: function () { delete widgets[name]; mark(); drawWidgets(); drawPreview(); } })]), code]));
        });
        var TPL = global.ESNKnowledgeTemplates || [];
        var tsel = h("select", { "class": "sort-select", "aria-label": _t('kn.szablonWidgetu') }, TPL.map(function (t) { return h("option", { value: t.id, text: t.name + " – " + t.desc }); }));
        var nameIn = h("input", { "class": "text-input kn-wnew", placeholder: _t('kn.nazwaAz09'), maxlength: 30, "aria-label": _t('kn.nazwaNowegoWidgetu') });
        wbox.appendChild(h("div", { "class": "kn-inline" }, [nameIn, h("button", { type: "button", "class": "btn-action", text: _t('kn.dodajWidget'), onclick: function () {
          var n = nameIn.value.trim().toLowerCase();
          if (!/^[a-z0-9][a-z0-9_-]{0,29}$/.test(n)) return toast(_t('kn.nazwaWidgetuAz09'), "error");
          if (widgets[n] != null) return toast(_t('kn.widgetOTejNazwie'), "error");
          if (Object.keys(widgets).length >= 8) return toast(_t('kn.maksymalnie8Widgetow'), "error");
          var t = TPL.filter(function (x) { return x.id === tsel.value; })[0];
          widgets[n] = t ? t.code : "<!-- Wklej tu HTML + CSS + JS widgetu (bez zewnętrznych zasobów) -->\n<div id=\"app\">Widget</div>";
          mark(); drawWidgets(); drawPreview();
          if (t && !new RegExp(":::widget\\s+" + n + "\\b").test(ta.value)) insertText(":::widget " + n + " " + (t.height || 320) + "\n:::");
        } })]));
        if (TPL.length) wbox.appendChild(h("div", { "class": "kn-inline" }, [h("span", { "class": "kn-meta", text: _t('kn.szablon2') }), tsel]));
      }

      /* obrazy (wgrane na serwer, dołączone do tej treści) */
      var ibox = h("div", { "class": "kn-images" });
      function insertText(t) {
        var st = ta.selectionStart, en = ta.selectionEnd, pre = ta.value.slice(0, st), need = pre && !/\n\n$/.test(pre) ? (/\n$/.test(pre) ? "\n" : "\n\n") : "";
        ta.value = pre + need + t + "\n\n" + ta.value.slice(en); if (mode === "simple" && wiz) wiz.refresh(); else ta.focus(); ta.dispatchEvent(new Event("input"));
      }
      function drawImages() {
        ibox.textContent = "";
        if (!rec) { ibox.appendChild(h("div", { "class": "kn-meta", text: _t('kn.zapiszTrescPrzyciskZapisz') })); return; }
        var list = h("div", { "class": "kn-img-grid" });
        var file = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/gif", "aria-label": _t('kn.wybierzObraz') });
        var cap = h("input", { "class": "text-input", placeholder: _t('kn.podpisTekstAlternatywny'), maxlength: 200, "aria-label": _t('kn.podpisObrazu') });
        var up = h("button", { type: "button", "class": "btn-action", text: _t('kn.wgrajObraz'), onclick: function () {
          if (!file.files[0]) return toast(_t('kn.wybierzPlikObrazu'), "error");
          var fd = new FormData(); fd.append("owner_type", "article"); fd.append("owner_id", String(rec.id)); fd.append("role", "gallery"); fd.append("caption", cap.value); fd.append("file", file.files[0]);
          up.disabled = true;
          jfetch("/api/media", { method: "POST", headers: authH(), body: fd }).then(function () { toast(_t('kn.obrazWgrany'), "success"); drawImages(); }).catch(function (e) { toast(e.message, "error"); }).then(function () { up.disabled = false; });
        } });
        ibox.appendChild(h("div", { "class": "kn-inline" }, [file, cap, up]));
        ibox.appendChild(list);
        jfetch("/api/media?owner_type=article&owner_id=" + rec.id).then(function (items) {
          if (!items.length) list.appendChild(h("div", { "class": "kn-meta", text: _t('kn.brakObrazowJpegPng') }));
          items.forEach(function (m) {
            list.appendChild(h("div", { "class": "kn-img-item" }, [h("img", { src: m.url, alt: m.caption || "", loading: "lazy" }), h("div", { "class": "kn-meta", text: (m.caption || m.name || "obraz") + " · " + m.width + "×" + m.height }),
              h("div", { "class": "kn-inline" }, [
                h("button", { type: "button", "class": "btn-action", text: _t('kn.wstaw'), onclick: function () { insertText("![" + (m.caption || "opis obrazu").replace(/[\[\]\n]/g, " ") + "](" + m.url + ")"); } }),
                h("button", { type: "button", "class": "btn-action", text: _t('kn.usun'), onclick: function () { askConfirm(_t('kn.usunacObrazJesliJest')).then(function (ok) { if (ok) jfetch("/api/media/" + m.id, { method: "DELETE", headers: authH() }).then(drawImages).catch(function (e) { toast(e.message, "error"); }); }); } })])]));
          });
        }).catch(function (e) { list.appendChild(h("div", { "class": "kn-meta", text: e.message })); });
      }

      function payload() {
        return { kind: kind.value, level: level.value, title: title.value, summary: sum.value, body: ta.value, widgets: widgets,
          tags: tags.value.split(",").map(function (x) { return x.trim(); }).filter(Boolean), course_id: kind.value === "lesson" && course.value ? parseInt(course.value, 10) : null, position: parseInt(pos.value, 10) || 0 };
      }
      function after(row, text) {
        dirty = false; saveInfo.textContent = "";
        if (text) toast(text, "success");
        if (isNew && row && row.id) history.replaceState({ view: "knowledge" }, "", "#knowledge/redakcja/edytuj/" + row.id);
        route();
      }
      function fail(e) { toast(e.message, "error"); }
      function save(then) { return (rec ? api.eSave(rec.id, payload()) : api.eCreate(payload())).then(function (row) { rec = rec ? Object.assign(rec, row) : row; if (then) return then(row); after(row, _t('kn.zapisano')); }); }

      var locked = rec && rec.state === "review" && !isAdmin();
      var acts = h("div", { "class": "kn-actions kn-sticky" });
      function btn(text, cls, fn) { var b = h("button", { type: "button", "class": "btn-action " + (cls || ""), text: text }); b.addEventListener("click", function () { b.disabled = true; Promise.resolve(fn()).catch(fail).then(function () { b.disabled = false; }); }); acts.appendChild(b); return b; }
      if (!locked) btn(_t('kn.zapisz'), "", function () { return save(); });
      if (!locked) btn(_t('kn.wyslijDoPrzegladu'), "primary", function () { return save(function (row) { return api.eAct(row.id, "submit").then(function (r2) { rec = Object.assign(rec, r2); after(r2, _t('kn.wyslanoDoPrzegladu')); }); }); });
      if (isAdmin()) btn(_t('kn.zapiszIOpublikuj'), "primary", function () { return (rec ? Promise.resolve(rec) : api.eCreate(payload())).then(function (row) { return api.eAct(row.id, "publish", { content: payload() }).then(function (r2) { after(r2, _t('kn.opublikowano')); }); }); });
      if (isAdmin() && rec && rec.state === "review") {
        btn(_t('kn.zatwierdz'), "primary", function () { return save(function (row) { return api.eAct(row.id, "approve").then(function (r2) { after(r2, _t('kn.zatwierdzonoIOpublikowano')); }); }); });
        var rej = h("input", { "class": "text-input", placeholder: _t('kn.powodOdrzuceniaWidocznyDla'), maxlength: 500, "aria-label": _t('kn.powodOdrzucenia') });
        acts.appendChild(rej);
        btn(_t('kn.odrzuc'), "", function () { return api.eAct(rec.id, "reject", { note: rej.value }).then(function (r2) { after(r2, _t('kn.odrzucono')); }); });
      }
      if (rec && rec.has_pending && !locked) btn(_t('kn.porzucZmiany'), "", function () { return askConfirm(_t('kn.porzucicOczekujaceZmianyWroci')).then(function (ok) { if (ok) return api.eAct(rec.id, "discard").then(function (r2) { after(r2, _t('kn.przywroconoWersjePubliczna')); }); }); });
      if (isAdmin() && rec && rec.published) btn(_t('kn.wycofajPublikacje'), "", function () { return askConfirm(_t('kn.wycofacTrescZPublicznej')).then(function (ok) { if (ok) return api.eAct(rec.id, "unpublish").then(function (r2) { after(r2, _t('kn.wycofano')); }); }); });
      if (rec && (isAdmin() || !rec.published)) btn(_t('kn.usun'), "", function () { return askConfirm(_t('kn.usunacTeTrescBezpowrotnie')).then(function (ok) { if (ok) return api.eDel(rec.id).then(function () { dirty = false; toast(_t('kn.usunieto'), "success"); go("redakcja"); }); }); });
      if (rec && rec.published) acts.appendChild(h("button", { type: "button", "class": "btn-action", text: _t('kn.zobaczPublicznie'), onclick: function () { go(rec.slug); } }));
      acts.appendChild(saveInfo);

      el.appendChild(wrap);
      wrap.appendChild(h("div", { "class": "kn-actions" }, [h("button", { type: "button", "class": "btn-action", text: _t('kn.panelRedakcji2'), onclick: function () {
        if (dirty) askConfirm(_t('kn.maszNiezapisaneZmianyWyjsc')).then(function (ok) { if (ok) go("redakcja"); }); else go("redakcja"); } })]));
      wrap.appendChild(h("h1", { "class": "kn-h1", text: isNew ? _t('kn.nowaTresc2') : _t('kn.edycjaTresci') }));
      wrap.appendChild(msg); setStatus();
      var fieldset = h("fieldset", { "class": "kn-fieldset" });
      if (locked) fieldset.disabled = true;
      fieldset.appendChild(h("div", { "class": "kn-grid3" }, [h("label", { "class": "kn-fld" }, [h("span", { text: _t('kn.typ') }), kind]), h("label", { "class": "kn-fld" }, [h("span", { text: _t('kn.poziom') }), level]), courseRow,
        h("label", { "class": "kn-fld" }, [h("span", { text: _t('kn.pozycja') }), pos])]));
      fieldset.appendChild(h("label", { "class": "kn-fld" }, [h("span", { text: _t('kn.tytul') }), title]));
      fieldset.appendChild(h("label", { "class": "kn-fld" }, [h("span", { text: _t('kn.opis') }), sum]));
      fieldset.appendChild(h("label", { "class": "kn-fld" }, [h("span", { text: _t('kn.tagi') }), tags]));
      fieldset.appendChild(h("div", { "class": "kn-fld" }, [h("span", { text: _t('kn.trescMarkdownZBlokami') }), tbar,
        wiz ? modeBar : null, h("div", { "class": "kn-split" }, [h("div", { "class": "kn-edhost" }, [wiz ? wiz.el : null, ta]), h("div", {}, [h("div", { "class": "kn-pv-label", text: _t('kn.podgladNaZywo') }), preview])])]));
      setMode(mode);
      fieldset.appendChild(h("div", { "class": "kn-fld" }, [h("span", { text: _t('kn.obrazyZdjeciaZrzutyEkranu') }), ibox]));
      fieldset.appendChild(h("div", { "class": "kn-fld" }, [h("span", { text: _t('kn.widgetyInteraktywneAnimacjeDzialaja') }), wbox]));
      wrap.appendChild(fieldset);
      wrap.appendChild(acts);
      if (rec && rec.history && rec.history.length) {
        var hist = h("details", { "class": "kn-hist" }, [h("summary", { text: _t('kn.historiaZmianStatusu') })]);
        var LBL = { create: "utworzono", submit: _t('kn.wyslanoDoPrzegladu2'), approve: "zatwierdzono", reject: "odrzucono", publish: "opublikowano", unpublish: "wycofano", discard: "porzucono zmiany" };
        rec.history.forEach(function (x) { hist.appendChild(h("div", { "class": "kn-hrow", text: fmtDate(x.at) + " · " + (x.user || "?") + " · " + (LBL[x.action] || x.action) + (x.note ? " – " + x.note : "") })); });
        wrap.appendChild(hist);
      }
      drawWidgets(); drawImages(); drawPreview();
    }).catch(function (e) { errBox(el, e); });
  }

  /* ══ EDYTOR DLA UŻYTKOWNIKÓW (opis projektu): ten sam kreator i renderer, ale tylko bezpieczne bloki ══ */
  var SAFE_ALLOW = ["md", "code", "summary", "card", "note", "info", "warn", "danger", "ok", "neutral", "details", "pros", "cons", "kv", "stats", "progress", "def", "steps", "timeline", "checklist", "flow", "er", "sequence", "tabs"];
  function mountEditor(slot, o) {
    o = o || {};
    slot.textContent = "";
    var max = o.max || 100000, dirty = false;
    var ta = h("textarea", { "class": "text-input kn-md", spellcheck: "true", "aria-label": _t('kn.trescOpisuMarkdownZ'), rows: 12 }); ta.value = o.value || "";
    var preview = h("div", { "class": "kn-body kn-preview" }), counter = h("span", { "class": "kn-meta" });
    var wiz = global.ESNKnowledgeWizard ? global.ESNKnowledgeWizard.create({ ta: ta, h: h, parseBlocks: parseBlocks, toast: toast, allow: SAFE_ALLOW, getWidgets: function () { return {}; }, templates: (global.ESNKnowledgeDocTemplates || {}).project,
      getImages: o.getImages, onChange: function () { ta.dispatchEvent(new Event("input")); } }) : null;
    var tbar = h("div", { "class": "kn-snips", role: "toolbar", "aria-label": _t('kn.wstawBlok') }, SNIPPETS.filter(function (s) { return !/^:::(figure|widget)/.test(s[1]); }).map(function (s) {
      return h("button", { type: "button", "class": "kn-snip", text: s[0], onclick: function () {
        var st = ta.selectionStart, en = ta.selectionEnd, pre = ta.value.slice(0, st), need = pre && !/\n\n$/.test(pre) ? (/\n$/.test(pre) ? "\n" : "\n\n") : "";
        ta.value = pre + need + s[1] + ta.value.slice(en); ta.focus(); ta.dispatchEvent(new Event("input")); } });
    }));
    var mode = "simple"; try { if (localStorage.getItem("kn_mode") === "adv") mode = "adv"; } catch (e) {}
    if (!wiz) mode = "adv";
    var bar = h("div", { "class": "kn-modebar", role: "group", "aria-label": _t('kn.trybEdycji') }), mb = {};
    function setMode(m) {
      mode = m; try { localStorage.setItem("kn_mode", m); } catch (e) {}
      Object.keys(mb).forEach(function (k) { mb[k].setAttribute("aria-pressed", String(k === m)); });
      tbar.style.display = ta.style.display = m === "adv" ? "" : "none";
      if (wiz) { wiz.el.style.display = m === "simple" ? "" : "none"; if (m === "simple") wiz.refresh(); }
    }
    if (wiz) [["simple", _t('kn.prostyBloki')], ["adv", _t('kn.zaawansowanyMarkdown')]].forEach(function (m) { mb[m[0]] = h("button", { type: "button", "class": "kn-mode", text: m[1], onclick: function () { setMode(m[0]); } }); bar.appendChild(mb[m[0]]); });
    var t = null;
    function draw() { renderBody(preview, ta.value, {}, { safe: true }); counter.textContent = ta.value.length + " / " + max + " " + _t('kn.znakow'); counter.style.color = ta.value.length > max ? "#f85149" : ""; }
    ta.addEventListener("input", function () { dirty = true; clearTimeout(t); t = setTimeout(draw, 350); if (o.onChange) o.onChange(); });
    slot.appendChild(h("div", { "class": "kn-fld" }, [h("span", { text: _t('kn.opisProjektuArtykulZ') }), wiz ? bar : null, tbar,
      h("div", { "class": "kn-split" }, [h("div", { "class": "kn-edhost" }, [wiz ? wiz.el : null, ta]), h("div", {}, [h("div", { "class": "kn-pv-label", text: _t('kn.podgladNaZywo') }), preview])]), counter]));
    setMode(mode); draw();
    return { getValue: function () { return ta.value; }, setValue: function (v) { ta.value = v || ""; if (mode === "simple" && wiz) wiz.refresh(); draw(); }, isDirty: function () { return dirty; }, tooLong: function () { return ta.value.length > max; } };
  }

  /* ══ ROUTER ═══════════════════════════════════════════════════════════ */
  function route() {
    var el = R(); if (!el) return;
    var parts = (location.hash.replace(/^#/, "").split("/")).slice(1).map(function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } });
    document.title = _t('kn.wiedzaEsn');
    if (!parts[0]) return renderHome(el);
    if (parts[0] === "redakcja") {
      if (!localStorage.getItem("token")) { errBox(el, new Error(_t('kn.zalogujSieAbyWejsc'))); return; }
      if (parts[1] === "nowa") return renderEditForm(el, "nowa");
      if (parts[1] === "edytuj" && /^\d+$/.test(parts[2] || "")) return renderEditForm(el, parts[2]);
      return renderEditorHome(el, parts);
    }
    if (parts[0] === "kurs" && parts[1]) return renderCourse(el, parts[1]);
    return renderArticle(el, parts[0]);
  }

  global.ESNKnowledge = { enter: route, renderBody: renderBody, parseBlocks: parseBlocks, mountEditor: mountEditor };
})(window);
