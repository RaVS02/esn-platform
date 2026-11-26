/* Edytor schematów połączeń w platformie ESN (v38).
 * Sam edytor: static/wiring/app.js (SchematEditor.mount – kod z repozytorium edytora, haki opisane w jego README 10.1).
 * Ten plik tylko go osadza:
 *   1. Narzędzia → „Edytor schematów” (#tools/schematic[/<id>]): zalogowani zapisują na koncie (/api/wiring),
 *      goście w tej przeglądarce (localStorage, klucz esn-wiring-guest) – katalog części i tak pochodzi z serwera.
 *   2. Karta projektu: ESNWiring.mountProject(slot, projekt) – schemat powiązany z projektem (podgląd dla wszystkich,
 *      edycja dla autora projektu i admina; na telefonie start w podglądzie).
 * Teksty interfejsu edytora ma sam edytor (słownik I18N w app.js); język = język platformy. */
(function (global) {
  "use strict";
  var GUEST_KEY = "esn-wiring-guest", current = null;
  function _t(k, p) { return global.ESNI18n ? global.ESNI18n.t(k, p) : k; }
  function lang() { return global.ESNI18n ? global.ESNI18n.lang() : "pl"; }
  function token() { try { return localStorage.getItem("token"); } catch (e) { return null; } }
  function h(tag, props, kids) {
    var e = document.createElement(tag);
    for (var k in (props || {})) {
      if (k === "class") e.className = props[k];
      else if (k === "text") e.textContent = props[k];
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), props[k]);
      else if (props[k] !== false && props[k] != null) e.setAttribute(k, props[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function toast(m, t) { if (typeof global.toast === "function") global.toast(m, t || "info"); }
  function narrow() { return global.matchMedia && global.matchMedia("(max-width: 820px)").matches; }

  /* ── warstwa API: serwer (z tokenem JWT) ── */
  function serverApi() {
    return { base: "/api/wiring", headers: function () { var t = token(); return t ? { Authorization: "Bearer " + t } : {}; } };
  }
  async function req(method, url, body) {
    var t = token(), r = await fetch("/api/wiring" + url, { method: method, cache: "no-store",
      headers: Object.assign({ "Content-Type": "application/json" }, t ? { Authorization: "Bearer " + t } : {}),
      body: body === undefined ? undefined : JSON.stringify(body) });
    if (!r.ok) { var txt = await r.text(), e = new Error(txt); e.status = r.status; try { e.data = JSON.parse(txt); } catch (x) { /* nie-JSON */ } throw e; }
    return r.json();
  }

  /* ── warstwa API gościa: schematy i części własne w localStorage, katalog z serwera (jak README edytora 11) ── */
  function guestLoad() {
    try { var d = JSON.parse(localStorage.getItem(GUEST_KEY) || "null"); if (d && d.projects && d.parts) return d; } catch (e) { /* uszkodzone */ }
    return { projects: {}, parts: {} };
  }
  function guestSave(d) {
    try { localStorage.setItem(GUEST_KEY, JSON.stringify(d)); }
    catch (e) { var x = new Error("quota"); x.status = 507; x.data = { detail: _t("wr.brakMiejsca") }; throw x; }
  }
  function uid() { return Math.random().toString(16).slice(2, 10); }
  function guestApi() {
    return { call: async function (method, url, body) {
      var u = new URL(url, location.origin), path = u.pathname, d = guestLoad(), m;
      if (method === "GET" && path === "/parts") {
        var src = u.searchParams.get("src") || "all", q = (u.searchParams.get("q") || "").toLowerCase(), page = +u.searchParams.get("page") || 1;
        var res = src === "own" ? { items: [], total: 0, page: page, pages: 1 } : await req("GET", url);   // katalog + części podstawowe z serwera
        if ((src === "all" || src === "own") && page === 1) {
          var own = Object.keys(d.parts).map(function (k) { return d.parts[k]; }).filter(function (p) {
            return !q || ((p.name || "") + " " + (p.desc || "") + " " + (p.category || "")).toLowerCase().indexOf(q) >= 0;
          }).map(function (p) { return { id: p.id, name: p.name, name_en: p.name_en, category: p.category || "Inne", desc: p.desc || "", desc_en: p.desc_en,
            pins: (p.pins || []).length, source: "own", package: "", icon: p.icon, image: p.image }; });
          res.items = own.concat(res.items); res.total += own.length;
        }
        return res;
      }
      if (method === "GET" && path === "/parts/batch") {
        var ids = (u.searchParams.get("ids") || "").split(",").filter(Boolean);
        var cat = ids.filter(function (i) { return /^(cat|std)-/.test(i); });
        var out = cat.length ? await req("GET", "/parts/batch?ids=" + encodeURIComponent(cat.join(","))) : [];
        ids.forEach(function (i) { if (!/^(cat|std)-/.test(i) && d.parts[i]) out.push(d.parts[i]); });
        return out;
      }
      if (method === "GET" && path === "/my-parts") {
        return Object.keys(d.parts).map(function (k) { var p = d.parts[k];
          var used = Object.keys(d.projects).filter(function (s) { return (d.projects[s].nodes || []).some(function (n) { return n.part === k; }); })
            .map(function (s) { return { id: s, title: d.projects[s].title || s }; });
          return { id: k, name: p.name || k, name_en: p.name_en, category: p.category || "Inne", pins: (p.pins || []).length, updated_at: null, used_in: used };
        });
      }
      if ((m = path.match(/^\/parts\/(.+)$/))) {
        var pid = decodeURIComponent(m[1]);
        if (method === "GET") return /^(cat|std)-/.test(pid) ? req("GET", url) : d.parts[pid];
        if (method === "DELETE") { delete d.parts[pid]; guestSave(d); return { ok: true }; }
        if (method === "PUT") { if (/^(cat|std)-/.test(pid)) throw new Error("catalog"); d.parts[pid] = Object.assign({}, body, { id: pid }); guestSave(d); return d.parts[pid]; }
      }
      if (path === "/projects") {
        if (method === "GET") return Object.keys(d.projects).map(function (k) { var p = d.projects[k];
          return { id: p.id, title: p.title || p.id, title_en: p.title_en, parts: (p.nodes || []).length, links: (p.links || []).length, updated_at: (d.ts || {})[k] || null, project: null };
        }).sort(function (a, b) { return String(b.updated_at || "").localeCompare(String(a.updated_at || "")); });
        if (method === "POST") {
          var np = Object.assign({ title: _t("wr.nowySchemat"), wire: "curve", orient: "auto", nodes: [], links: [] }, body || {}, { id: "g" + uid() });
          delete np.rev; delete np.project_id; delete np.can_edit; d.projects[np.id] = np; (d.ts = d.ts || {})[np.id] = new Date().toISOString(); guestSave(d); return np;
        }
      }
      if ((m = path.match(/^\/projects\/(.+)$/))) {
        var sid = decodeURIComponent(m[1]);
        if (method === "GET") { if (!d.projects[sid]) { var e404 = new Error("404"); e404.status = 404; throw e404; } return JSON.parse(JSON.stringify(d.projects[sid])); }
        if (method === "PUT") { var p = Object.assign({}, body, { id: sid }); delete p.rev; d.projects[sid] = p; (d.ts = d.ts || {})[sid] = new Date().toISOString(); guestSave(d); return p; }
        if (method === "DELETE") { delete d.projects[sid]; if (d.ts) delete d.ts[sid]; guestSave(d); return { ok: true }; }
      }
      var e = new Error("unsupported " + method + " " + url); e.status = 400; throw e;
    } };
  }

  function destroyCurrent() {
    if (current) { try { current.destroy(); } catch (e) { /* już zniszczony */ } current = null; }
  }
  function mountEditor(host, opts) {
    destroyCurrent();
    host.classList.add("wiring-host");
    current = global.SchematEditor.mount(host, Object.assign({
      lang: lang(), hideLang: true, theme: "auto",
      links: { component: function (id) { return "/#components/" + encodeURIComponent(id); } }
    }, opts));
    return current;
  }
  /* przy wychodzeniu z widoku: niezapisane zmiany → pytanie (zwraca false, gdy użytkownik zostaje) */
  function leave() {
    if (current && current.dirty && !confirm(_t("wr.porzucicZmiany"))) return false;
    destroyCurrent();
    return true;
  }

  /* przeniesienie schematów gościa na konto po zalogowaniu */
  async function migrateGuest(btn, done) {
    var d = guestLoad(), ids = Object.keys(d.projects), n = 0;
    btn.disabled = true;
    try {
      for (var k in d.parts) { if (!/^cat-/.test(k)) await req("PUT", "/parts/" + encodeURIComponent(k), d.parts[k]); }
      for (var i = 0; i < ids.length; i++) {
        var p = Object.assign({}, d.projects[ids[i]]); delete p.id;
        await req("POST", "/projects", p); delete d.projects[ids[i]]; n++; guestSave(d);
      }
      if (!Object.keys(d.projects).length) d.parts = {};
      guestSave(d);
      toast(_t("wr.przeniesiono", { n: n }), "success");
    } catch (e) { toast(_t("wr.bladPrzenoszenia") + " " + (e.data && e.data.detail ? global.ESNI18n.err(String(e.data.detail)) : ""), "error"); }
    btn.disabled = false; done();
  }

  /* ── 1. Narzędzia ── */
  /* lista „Moje schematy” nad edytorem: otwórz, duplikuj, podepnij/odepnij od projektu, usuń */
  function errMsg(e) { var d = e && e.data && e.data.detail; d = typeof d === "string" ? d : (d && d.message) || ""; return d ? global.ESNI18n.err(d) : _t("wr.bladOperacji"); }
  function fmtDate(iso) { try { return iso ? global.ESNI18n.date(new Date(iso), { dateStyle: "medium", timeStyle: "short" }) : ""; } catch (e) { return ""; } }
  function schemaList(box, o) {
    var state = { items: [], linkFor: null, linkable: null, shareFor: null, shares: null, newLink: null };
    async function refresh() {
      try { state.items = await o.call("GET", "/projects"); } catch (e) { state.items = []; }
      draw();
    }
    /* panel „Udostępnij”: linki tylko do podglądu (pełny link widać tylko raz – przy tworzeniu) */
    async function loadShares(id) {
      try { state.shares = await o.call("GET", "/projects/" + encodeURIComponent(id) + "/shares"); } catch (e) { state.shares = []; toast(errMsg(e), "error"); }
      draw();
    }
    function shareUrl(tok) { return location.origin + location.pathname + "#tools/schematic/view/" + encodeURIComponent(tok); }
    function copy(text, btn) {
      var done = function () { toast(_t("wr.skopiowano"), "success"); if (btn) btn.textContent = _t("wr.skopiowano"); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallback(); });
      else fallback();
      function fallback() { var ta = h("textarea", {}); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) { /* ręcznie */ } ta.remove(); }
    }
    function stateName(st) { var k = "wr.stan." + st; return _t(k); }   // klucze wr.stan.active / expired / revoked
    function sharePanel(it) {
      var box = h("div", { "class": "wl-link wl-share" });
      box.appendChild(h("p", { "class": "wiring-note", text: _t("wr.udostepnijOpis") }));
      if (state.newLink) {
        var inp = h("input", { "class": "text-input wl-url", readonly: "readonly", value: state.newLink, "aria-label": _t("wr.nowyLink") });
        inp.value = state.newLink;
        box.appendChild(h("div", { "class": "wl-newlink" }, [h("strong", { text: _t("wr.nowyLink") }), inp,
          h("button", { type: "button", "class": "btn-action primary", text: _t("wr.kopiuj"), onclick: function (e) { copy(state.newLink, e.currentTarget); } }),
          h("small", { "class": "wiring-note", text: _t("wr.linkTylkoRaz") })]));
      }
      var days = h("select", { "class": "sort-select", "aria-label": _t("wr.waznosc") }, [
        h("option", { value: "7", text: _t("wr.dni", { n: 7 }) }), h("option", { value: "30", text: _t("wr.dni", { n: 30 }) }),
        h("option", { value: "365", text: _t("wr.dni", { n: 365 }) }), h("option", { value: "", text: _t("wr.bezTerminu") })]);
      box.appendChild(h("div", { "class": "wl-sharebar" }, [h("span", { text: _t("wr.waznosc") }), days,
        h("button", { type: "button", "class": "btn-action primary", text: _t("wr.utworzLink"), onclick: function () { act(async function () {
          var r = await o.call("POST", "/projects/" + encodeURIComponent(it.id) + "/shares", { days: days.value ? +days.value : null });
          state.newLink = shareUrl(r.token); state.shares = null; await loadShares(it.id);
        }); } })]));
      if (state.shares === null) box.appendChild(h("span", { "class": "wiring-note", text: "…" }));
      else if (!state.shares.length) box.appendChild(h("span", { "class": "wiring-note", text: _t("wr.brakLinkow") }));
      else box.appendChild(h("div", { "class": "wl-shares" }, state.shares.map(function (s) {
        var meta = [_t("wr.utworzono", { d: fmtDate(s.created_at) }), s.expires_at ? _t("wr.wazneDo", { d: fmtDate(s.expires_at) }) : _t("wr.bezTerminu"),
          _t("wr.wyswietlen", { n: s.views })];
        return h("div", { "class": "wl-sh " + s.state }, [
          h("span", { "class": "wl-st", text: stateName(s.state) }), h("small", { text: meta.join(" · ") }),
          s.state === "active" ? h("button", { type: "button", "class": "btn-action wl-del", text: _t("wr.uniewaznij"), onclick: function () {
            if (!confirm(_t("wr.uniewaznicLink"))) return;
            act(async function () { await o.call("DELETE", "/projects/" + encodeURIComponent(it.id) + "/shares/" + s.id); await loadShares(it.id); toast(_t("wr.uniewazniono"), "success"); });
          } }) : null]);
      })));
      return box;
    }
    function cur() { var ed = o.editor(); return ed && ed.project ? ed.project.id : null; }
    async function act(fn) { try { await fn(); } catch (e) { toast(errMsg(e), "error"); } await refresh(); }
    async function openLink(it) {
      state.linkFor = it.id; state.linkable = null; draw();
      try { state.linkable = await o.call("GET", "/linkable-projects"); } catch (e) { state.linkable = []; }
      draw();
    }
    function row(it) {
      var open = it.id === cur();
      var meta = [_t("wr.meta", { parts: it.parts || 0, links: it.links || 0 })];
      if (it.updated_at) meta.push(_t("wr.zmieniono", { d: fmtDate(it.updated_at) }));
      var proj = it.project ? h("span", { "class": "wl-proj" }, [_t("wr.wProjekcie") + " ",
        h("a", { href: "#projects", text: it.project.title, onclick: function (e) { e.preventDefault(); if (typeof global.openProjectFromComponent === "function") global.openProjectFromComponent(it.project.slug); } })]) : null;
      var btns = [
        h("button", { type: "button", "class": "btn-action", text: open ? _t("wr.otwarty") : _t("wr.otworz"), disabled: open ? "disabled" : null,
          onclick: function () { var ed = o.editor(); if (ed) ed.open(it.id).then(draw, draw); } }),
        h("button", { type: "button", "class": "btn-action", text: _t("wr.duplikuj"), onclick: function () { act(async function () {
          var d = await o.call("GET", "/projects/" + encodeURIComponent(it.id));
          ["id", "rev", "can_edit", "project_id"].forEach(function (k) { delete d[k]; });
          d.title = ((d.title || "") + " " + _t("wr.kopia")).trim(); delete d.title_en;
          var n = await o.call("POST", "/projects", d); toast(_t("wr.zduplikowano"), "success");
          var ed = o.editor(); if (ed) await ed.open(n.id);
        }); } })
      ];
      if (o.logged) btns.push(h("button", { type: "button", "class": "btn-action", text: _t("wr.udostepnij"), onclick: function () {
        if (state.shareFor === it.id) { state.shareFor = null; draw(); return; }
        state.shareFor = it.id; state.shares = null; state.newLink = null; draw(); loadShares(it.id);
      } }));
      if (o.logged) btns.push(it.project
        ? h("button", { type: "button", "class": "btn-action", text: _t("wr.odepnij"), onclick: function () {
            if (!confirm(_t("wr.odpiacSchemat", { p: it.project.title }))) return;
            act(async function () { await o.call("PUT", "/projects/" + encodeURIComponent(it.id) + "/link", { project_id: null }); toast(_t("wr.odpieto"), "success"); });
          } })
        : h("button", { type: "button", "class": "btn-action", text: _t("wr.podepnij"), onclick: function () { openLink(it); } }));
      btns.push(h("button", { type: "button", "class": "btn-action wl-del", text: _t("wr.usun"), onclick: function () {
        var msg = _t("wr.usunacSchemat", { t: it.title }) + (it.project ? "\n\n" + _t("wr.usunacPodpiety", { p: it.project.title }) : "");
        if (!confirm(msg)) return;
        act(async function () {
          var wasOpen = it.id === cur();
          await o.call("DELETE", "/projects/" + encodeURIComponent(it.id)); toast(_t("wr.usunieto"), "success");
          if (wasOpen) o.remount();
        });
      } }));
      var r = h("div", { "class": "wl-row" + (open ? " on" : "") }, [
        h("div", { "class": "wl-main" }, [h("strong", { text: it.title || it.id }), h("small", { text: meta.join(" · ") }), proj]),
        h("div", { "class": "wl-btns" }, btns)]);
      if (state.shareFor === it.id) r.appendChild(sharePanel(it));
      if (state.linkFor === it.id) {
        var pick = h("div", { "class": "wl-link" });
        if (state.linkable === null) pick.appendChild(h("span", { "class": "wiring-note", text: "…" }));
        else if (!state.linkable.length) pick.appendChild(h("span", { "class": "wiring-note", text: _t("wr.brakProjektow") }));
        else {
          var sel = h("select", { "class": "sort-select", "aria-label": _t("wr.podepnij") }, [h("option", { value: "", text: _t("wr.wybierzProjekt") })]
            .concat(state.linkable.map(function (p) { return h("option", { value: String(p.id), text: p.title + (p.own ? "" : " ✦") }); })));
          pick.appendChild(sel);
          pick.appendChild(h("button", { type: "button", "class": "btn-action primary", text: _t("wr.podepnij"), onclick: function () {
            if (!sel.value) return;
            state.linkFor = null;
            act(async function () { await o.call("PUT", "/projects/" + encodeURIComponent(it.id) + "/link", { project_id: +sel.value }); toast(_t("wr.podpieto"), "success"); });
          } }));
        }
        pick.appendChild(h("button", { type: "button", "class": "btn-action", text: _t("confirm.anuluj"), onclick: function () { state.linkFor = null; draw(); } }));
        r.appendChild(pick);
      }
      return r;
    }
    function draw() {
      box.textContent = "";
      var det = h("details", { "class": "wl", open: "open" });
      det.appendChild(h("summary", {}, [h("span", { text: (o.logged ? _t("wr.mojeSchematy") : _t("wr.schematyWPrzegladarce")) + " (" + state.items.length + ")" })]));
      if (!state.items.length) det.appendChild(h("p", { "class": "wiring-note wl-empty", text: _t("wr.brakSchematowLista") }));
      var rows = h("div", { "class": "wl-rows" });
      state.items.forEach(function (it) { rows.appendChild(row(it)); });
      det.appendChild(rows);
      box.appendChild(det);
    }
    refresh();
    return { refresh: refresh, draw: draw };
  }

  /* lista „Moje części”: edycja (okno edytora), usuwanie z ostrzeżeniem o użyciu w schematach, nowa część */
  function partList(box, o) {
    var items = [];
    async function refresh() {
      try { items = await o.call("GET", "/my-parts"); } catch (e) { items = []; }
      draw();
    }
    function catName(c) { return _t("wr.kat." + c) !== "wr.kat." + c ? _t("wr.kat." + c) : c; }
    function draw() {
      box.textContent = "";
      var det = h("details", { "class": "wl wl-parts" });
      if (o.isOpen()) det.setAttribute("open", "open");
      det.addEventListener("toggle", function () { o.setOpen(det.open); });
      det.appendChild(h("summary", {}, [h("span", { text: _t("wr.mojeCzesci") + " (" + items.length + ")" })]));
      var bar = h("div", { "class": "wl-bar" }, [
        h("span", { "class": "wiring-note", text: _t("wr.mojeCzesciOpis") }),
        h("button", { type: "button", "class": "btn-action", text: _t("wr.nowaCzesc"), onclick: function () { var ed = o.editor(); if (ed) ed.openPart(null); } })]);
      det.appendChild(bar);
      var rows = h("div", { "class": "wl-rows" });
      if (!items.length) rows.appendChild(h("p", { "class": "wiring-note wl-empty", text: _t("wr.brakCzesci") }));
      items.forEach(function (it) {
        var meta = [catName(it.category), _t("wr.pinow", { n: it.pins })];
        meta.push(it.used_in.length ? _t("wr.uzytaW", { n: it.used_in.length }) : _t("wr.nieuzyta"));
        rows.appendChild(h("div", { "class": "wl-row" }, [
          h("div", { "class": "wl-main" }, [h("strong", { text: it.name }), h("small", { text: meta.join(" · ") }),
            it.used_in.length ? h("span", { "class": "wl-proj", text: it.used_in.slice(0, 4).map(function (s) { return s.title; }).join(", ") + (it.used_in.length > 4 ? "…" : "") }) : null]),
          h("div", { "class": "wl-btns" }, [
            h("button", { type: "button", "class": "btn-action", text: _t("wr.edytuj"), onclick: function () { var ed = o.editor(); if (ed) ed.openPart(it.id); } }),
            h("button", { type: "button", "class": "btn-action wl-del", text: _t("wr.usun"), onclick: async function () {
              var msg = _t("wr.usunacCzesc", { t: it.name }) + (it.used_in.length ? "\n\n" + _t("wr.czescUzywana", { n: it.used_in.length, s: it.used_in.map(function (s) { return s.title; }).join(", ") }) : "");
              if (!confirm(msg)) return;
              try { await o.call("DELETE", "/parts/" + encodeURIComponent(it.id)); toast(_t("wr.usunietoCzesc"), "success"); var ed = o.editor(); if (ed) await ed.reloadLib(); }
              catch (e) { toast(errMsg(e), "error"); }
              refresh();
            } })])]));
      });
      det.appendChild(rows);
      box.appendChild(det);
    }
    refresh();
    return { refresh: refresh };
  }

  /* ── tryb gościa: baner z kopią zapasową (wszystkie schematy i części w jednym pliku), przywracaniem i logowaniem ── */
  var BACKUP_FMT = "esn-wiring-guest";
  function guestStats() {
    var d = guestLoad();
    return { schemas: Object.keys(d.projects).length, parts: Object.keys(d.parts).length, backup: d.backup_at || null };
  }
  function downloadBackup() {
    var d = guestLoad(), now = new Date();
    var data = { format: BACKUP_FMT, version: 1, exported_at: now.toISOString(), projects: d.projects, parts: d.parts };
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
    a.download = "esn-schematy-" + now.toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    d.backup_at = now.toISOString(); guestSave(d);
  }
  function restoreBackup(file, done) {
    var rd = new FileReader();
    rd.onload = function () {
      var b;
      try { b = JSON.parse(rd.result); } catch (e) { b = null; }
      if (!b || b.format !== BACKUP_FMT || typeof b.projects !== "object" || typeof b.parts !== "object") { toast(_t("wr.zlyPlikKopii"), "error"); return; }
      var d = guestLoad(), ps = Object.keys(b.projects), same = ps.filter(function (k) { return d.projects[k]; }).length;
      if (!confirm(_t("wr.przywrocicKopie", { n: ps.length, p: Object.keys(b.parts).length }) + (same ? "\n\n" + _t("wr.przywrocNadpisze", { n: same }) : ""))) return;
      ps.forEach(function (k) { var p = b.projects[k]; if (p && typeof p === "object") { d.projects[k] = Object.assign({}, p, { id: k }); (d.ts = d.ts || {})[k] = new Date().toISOString(); } });
      Object.keys(b.parts).forEach(function (k) { if (!/^(cat|std)-/.test(k) && b.parts[k] && typeof b.parts[k] === "object") d.parts[k] = Object.assign({}, b.parts[k], { id: k }); });
      d.backup_at = b.exported_at || d.backup_at;
      guestSave(d); toast(_t("wr.przywrocono", { n: ps.length }), "success"); done();
    };
    rd.readAsText(file);
  }
  // przycisk logowania portalu (obiekt auth w szablonie nie jest globalny – używamy tego samego przycisku co w górnym pasku)
  function loginTrigger() { return document.querySelector("[onclick*=\"auth.showModal('login')\"]"); }
  function guestBanner(rerender) {
    var st = guestStats(), old = !st.backup || (Date.now() - new Date(st.backup).getTime() > 7 * 864e5);
    var file = h("input", { type: "file", accept: ".json,application/json", hidden: "hidden", onchange: function (e) {
      var f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) restoreBackup(f, rerender); } });
    var info = _t("wr.wPrzegladarce", { s: st.schemas, p: st.parts }) + " · " +
      (st.backup ? _t("wr.ostatniaKopia", { d: fmtDate(st.backup) }) : _t("wr.brakKopii"));
    return h("div", { "class": "wiring-guest warn" + (st.schemas && old ? " stale" : ""), role: "note" }, [
      h("div", { "class": "wg-head" }, [h("span", { "class": "wg-ic", "aria-hidden": "true", text: "⚠" }), h("strong", { text: _t("wr.goscTytul") })]),
      h("p", { text: _t("wr.trybGoscia") }),
      h("p", { "class": "wg-info" + (st.schemas && old ? " bad" : ""), text: info + (st.schemas && old ? " – " + _t("wr.zrobKopie") : "") }),
      h("div", { "class": "wg-btns" }, [
        h("button", { type: "button", "class": "btn-action primary", text: _t("wr.pobierzKopie"), disabled: st.schemas || st.parts ? null : "disabled",
          onclick: function () { downloadBackup(); toast(_t("wr.kopiaPobrana"), "success"); rerender(); } }),
        h("button", { type: "button", "class": "btn-action", text: _t("wr.przywrocZKopii"), onclick: function () { file.click(); } }),
        loginTrigger() ? h("button", { type: "button", "class": "btn-action", text: _t("wr.zalogujSie"), onclick: function () { var t = loginTrigger(); if (t) t.click(); } }) : null,
        file])]);
  }
  // pierwszy zapis gościa w tej sesji → jednorazowe przypomnienie
  function guestSavedOnce() {
    try { if (sessionStorage.getItem("esn-wiring-guest-told")) return; sessionStorage.setItem("esn-wiring-guest-told", "1"); } catch (e) { /* tryb prywatny */ }
    toast(_t("wr.zapisanoLokalnie"), "warn");
  }

  /* podgląd po linku: #tools/schematic/view/<token> – bez logowania, tylko do odczytu, bez list i banera */
  function mountShared(el, tok) {
    var host = h("div"), wrap = h("div", { "class": "wiring-section" }, [host]);
    el.appendChild(h("div", { "class": "wiring-guest wl-viewnote", role: "note" }, [h("strong", { text: _t("wr.podgladTytul") }), h("p", { text: _t("wr.podgladOpis") })]));
    el.appendChild(wrap);
    var api = { call: function (m, u, b) {
      if (m === "GET" && /^\/projects\/[^/]+$/.test(u)) return req("GET", "/shared/" + encodeURIComponent(tok));
      if (m === "GET" && u === "/projects") return Promise.resolve([]);
      if (m === "GET" && /^\/parts/.test(u)) return req(m, u);
      var e = new Error("read-only"); e.status = 403; e.data = { detail: "Brak uprawnień do edycji schematu" }; return Promise.reject(e);
    } };
    var ed = mountEditor(host, { api: api, project: "shared", single: true, readOnly: true });
    ed.ready.catch(function () {
      host.textContent = ""; host.classList.remove("sch");
      host.appendChild(h("div", { "class": "wiring-empty", text: _t("wr.linkNiewazny") }));
    });
    return function () { destroyCurrent(); };
  }

  function mountTool(el, ctx) {
    if (ctx.sub && ctx.sub[0] === "view" && ctx.sub[1]) return mountShared(el, decodeURIComponent(ctx.sub[1]));
    var logged = !!token(), wrap = h("div", { "class": "wiring-section" }), host = h("div");
    el.appendChild(h("p", { "class": "hero-sub tp-lead", text: _t("wr.lead") }));
    var guestCount = Object.keys(guestLoad().projects).length;
    var bannerBox = h("div");
    function drawBanner() { bannerBox.textContent = ""; bannerBox.appendChild(guestBanner(function () { el.textContent = ""; mountTool(el, ctx); })); }
    if (!logged) { drawBanner(); el.appendChild(bannerBox); }
    else {
      var bar = h("div", { "class": "wiring-bar" }, [h("span", { "class": "wiring-note", text: _t("wr.zapisNaKoncie") })]);
      if (guestCount) bar.appendChild(h("button", { type: "button", "class": "btn-action", text: _t("wr.przeniesNaKonto", { n: guestCount }),
        onclick: function (e) { migrateGuest(e.currentTarget, function () { el.textContent = ""; mountTool(el, ctx); }); } }));
      el.appendChild(bar);
    }
    var base = logged ? { call: req } : guestApi(), listBox = h("div"), list = null, ed = null;
    // edytor korzysta z tej samej warstwy danych; każdy zapis / nowy / usunięty schemat odświeża listę
    var edApi = { call: function (m, u, b) { return base.call(m, u, b).then(function (r) {
      if (!logged && m !== "GET") { drawBanner(); if (m === "PUT" || m === "POST") guestSavedOnce(); }
      if (m !== "GET" && /^\/projects/.test(u) && list) { list.refresh(); if (parts) parts.refresh(); } else if (m === "GET" && /^\/projects\//.test(u) && list) setTimeout(list.draw, 0); return r; }); } };
    var partsBox = h("div"), parts = null, partsOpen = false;
    function remount(id) { ed = mountEditor(host, { api: edApi, project: id || undefined, onPartSaved: function () { if (parts) parts.refresh(); } }); }
    if (global.ESNWiringGuide) el.appendChild(global.ESNWiringGuide.render(h, lang()));
    el.appendChild(listBox);
    el.appendChild(partsBox);
    wrap.appendChild(host); el.appendChild(wrap);
    remount((ctx.sub && ctx.sub[0]) || undefined);
    list = schemaList(listBox, { call: base.call, logged: logged, editor: function () { return ed; }, remount: function () { remount(); } });
    parts = partList(partsBox, { call: base.call, editor: function () { return ed; }, isOpen: function () { return partsOpen; }, setOpen: function (v) { partsOpen = v; } });
    return function () { destroyCurrent(); };
  }

  /* ── 2. Karta projektu ── */
  async function mountProject(slot, project, o) {
    o = o || {};
    destroyCurrent();
    if (!slot || !project) return;
    slot.textContent = "";
    var info;
    try { info = await req("GET", "/by-project/" + encodeURIComponent(project.id)); }
    catch (e) { return; }                                  // brak modułu / błąd sieci – karta działa bez schematu
    if (!info.schema && !info.can_create) return;
    var sec = h("div", { "class": "wiring-section" }, [h("h3", { "class": "section-title", text: _t("wr.tytul") })]);
    slot.appendChild(sec);
    if (!info.schema) {
      sec.appendChild(h("div", { "class": "wiring-empty" }, [
        h("span", { text: _t("wr.brakSchematu") }),
        h("button", { type: "button", "class": "btn-action", text: _t("wr.dodaj"), onclick: async function (e) {
          e.currentTarget.disabled = true;
          try { await req("POST", "/projects", { title: project.title || _t("wr.nowySchemat"), project_id: project.id }); mountProject(slot, project, o); }
          catch (err) { e.currentTarget.disabled = false; toast(err.data && err.data.detail ? global.ESNI18n.err(String(err.data.detail)) : _t("wr.bladWczytywania"), "error"); }
        } })]));
      return;
    }
    var host = h("div");
    sec.appendChild(host);
    // zapis schematu dopisuje podzespoły z katalogu do projektu (serwer) – po zapisie odśwież listę podzespołów w karcie
    var api = { call: function (m, u, b) { return req(m, u, b).then(function (r) { if (m === "PUT" && typeof o.onSaved === "function") { try { o.onSaved(r); } catch (e) { /* karta */ } } return r; }); } };
    var ed = mountEditor(host, { api: api, project: info.schema.id, single: true, readOnly: !info.schema.can_edit });
    if (info.schema.can_edit && narrow()) ed.ready.then(function () { ed.setEdit(false); });   // telefon: start w podglądzie (README 10.7)
  }

  global.ESNWiring = { mountProject: mountProject, leave: leave, guestApi: guestApi, _guestKey: GUEST_KEY };

  if (global.ESNTools) global.ESNTools.register({ id: "schematic", icon: "fa-solid fa-diagram-project", title: "tools.edytorSchematow",
    desc: "tools.rysowanieSchematowPolaczenZ", status: "ready", mount: mountTool });
})(window);
