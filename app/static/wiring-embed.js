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
        var res = src === "own" ? { items: [], total: 0, page: page, pages: 1 } : await req("GET", url.replace(/src=all/, "src=catalog"));
        if (src !== "catalog" && page === 1) {
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
        var cat = ids.filter(function (i) { return /^cat-/.test(i); });
        var out = cat.length ? await req("GET", "/parts/batch?ids=" + encodeURIComponent(cat.join(","))) : [];
        ids.forEach(function (i) { if (!/^cat-/.test(i) && d.parts[i]) out.push(d.parts[i]); });
        return out;
      }
      if ((m = path.match(/^\/parts\/(.+)$/))) {
        var pid = decodeURIComponent(m[1]);
        if (method === "GET") return /^cat-/.test(pid) ? req("GET", url) : d.parts[pid];
        if (method === "PUT") { if (/^cat-/.test(pid)) throw new Error("catalog"); d.parts[pid] = Object.assign({}, body, { id: pid }); guestSave(d); return d.parts[pid]; }
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
    var state = { items: [], linkFor: null, linkable: null };
    async function refresh() {
      try { state.items = await o.call("GET", "/projects"); } catch (e) { state.items = []; }
      draw();
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

  function mountTool(el, ctx) {
    var logged = !!token(), wrap = h("div", { "class": "wiring-section" }), host = h("div");
    el.appendChild(h("p", { "class": "hero-sub tp-lead", text: _t("wr.lead") }));
    var guestCount = Object.keys(guestLoad().projects).length;
    if (!logged) el.appendChild(h("div", { "class": "wiring-guest", text: _t("wr.trybGoscia") }));
    else {
      var bar = h("div", { "class": "wiring-bar" }, [h("span", { "class": "wiring-note", text: _t("wr.zapisNaKoncie") })]);
      if (guestCount) bar.appendChild(h("button", { type: "button", "class": "btn-action", text: _t("wr.przeniesNaKonto", { n: guestCount }),
        onclick: function (e) { migrateGuest(e.currentTarget, function () { el.textContent = ""; mountTool(el, ctx); }); } }));
      el.appendChild(bar);
    }
    var base = logged ? { call: req } : guestApi(), listBox = h("div"), list = null, ed = null;
    // edytor korzysta z tej samej warstwy danych; każdy zapis / nowy / usunięty schemat odświeża listę
    var edApi = { call: function (m, u, b) { return base.call(m, u, b).then(function (r) { if (m !== "GET" && /^\/projects/.test(u) && list) list.refresh(); else if (m === "GET" && /^\/projects\//.test(u) && list) setTimeout(list.draw, 0); return r; }); } };
    function remount(id) { ed = mountEditor(host, { api: edApi, project: id || undefined }); }
    el.appendChild(listBox);
    wrap.appendChild(host); el.appendChild(wrap);
    remount((ctx.sub && ctx.sub[0]) || undefined);
    list = schemaList(listBox, { call: base.call, logged: logged, editor: function () { return ed; }, remount: function () { remount(); } });
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
