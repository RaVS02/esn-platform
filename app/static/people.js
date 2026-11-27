/* ESN – Ludzie (v62, etap 1 społeczności): lista i wyszukiwarka profili publicznych + strona profilu.
 * Adresy: #people (lista), #people/<login> (profil). API: GET /api/people, GET /api/u/<login>.
 * Teksty ESNI18n (ppl.*). Treści użytkowników wstawiane wyłącznie przez textContent.
 */
(function () {
  "use strict";
  var baseTitle = document.title, st = { q: "", skills: [], role: "", invites: false, sort: "active", page: 1 }, timer = null, lastFacets = [];
  function t(k, o) { var s = _t("ppl." + k); return o ? s.replace(/\{(\w+)\}/g, function (_, x) { return o[x]; }) : s; }
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") e.className = attrs[k]; else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]);
    });
    [].concat(kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function ico(n) { return h("i", { class: "fa-solid " + n, "aria-hidden": "true" }); }
  function get(url) {
    return fetch(url).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(_E(j.detail) || ("HTTP " + r.status)); e.status = r.status; throw e; } return j; });
    });
  }
  function initials(name) {
    var w = String(name || "").trim().split(/[\s_.\-]+/).filter(Boolean);
    return ((w[0] || "?").charAt(0) + (w.length > 1 ? w[1].charAt(0) : (w[0] || "").charAt(1))).toUpperCase();
  }
  function avatar(u, cls) {
    if (u.avatar_path) return h("img", { class: "ppl-av " + (cls || ""), src: "/static/" + u.avatar_path, alt: "" });
    return h("div", { class: "ppl-av ppl-av-ini " + (cls || ""), "aria-hidden": "true" }, [initials(u.username || u.login)]);
  }
  function roleBadge(role) {
    if (role === "admin") return h("span", { class: "ppl-badge admin" }, [t("roleAdmin")]);
    if (role === "moderator") return h("span", { class: "ppl-badge mod" }, [t("roleMod")]);
    return null;
  }
  function since(ym) { if (!ym) return ""; try { return ESNI18n.date(new Date(ym + "-01"), { month: "long", year: "numeric" }); } catch (e) { return ym; } }
  function go(hash) { history.pushState({ view: "community" }, "", "#" + hash); enter(); window.scrollTo(0, 0); }

  /* ── lista ──────────────────────────────────────────────────────────────────────────────────── */
  function chip(label, on, fn, group) {
    var b = h("button", { type: "button", class: "chip-btn" + (on ? " active" : ""), "data-group": group || "ppl", "aria-pressed": on ? "true" : "false" }, [label]);
    b.addEventListener("click", fn); return b;
  }
  function drawFilters() {
    var box = document.getElementById("ppl-filters"); if (!box) return;
    box.textContent = "";
    box.appendChild(h("div", { class: "filter-group-label" }, [t("sort")]));
    box.appendChild(h("div", { class: "filter-chips" }, [["active", "sortActive"], ["az", "sortAz"], ["za", "sortZa"], ["projects", "sortProjects"], ["newest", "sortNewest"]].map(function (s) {
      return chip(t(s[1]), st.sort === s[0], function () { st.sort = s[0]; st.page = 1; load(); }, "ppl-sort");
    })));
    box.appendChild(h("div", { class: "filter-group-label" }, [t("skills")]));
    var sk = h("div", { class: "filter-chips" });
    if (!lastFacets.length) sk.appendChild(h("span", { class: "ppl-muted" }, [t("noSkills")]));
    lastFacets.forEach(function (f) {
      var on = st.skills.some(function (x) { return x.toLowerCase() === f.name.toLowerCase(); });
      sk.appendChild(chip(f.name + " · " + f.count, on, function () {
        st.skills = on ? st.skills.filter(function (x) { return x.toLowerCase() !== f.name.toLowerCase(); }) : st.skills.concat([f.name]);
        st.page = 1; load();
      }));
    });
    box.appendChild(sk);
    box.appendChild(h("div", { class: "filter-group-label" }, [t("show")]));
    box.appendChild(h("div", { class: "filter-chips" }, [
      chip(t("team"), st.role === "team", function () { st.role = st.role === "team" ? "" : "team"; st.page = 1; load(); }),
      chip(t("invites"), st.invites, function () { st.invites = !st.invites; st.page = 1; load(); })
    ]));
    var any = st.skills.length || st.role || st.invites || st.q;
    var clr = h("button", { type: "button", class: "btn-action ppl-clear" }, [t("clear")]); clr.disabled = !any;
    clr.addEventListener("click", function () { st = { q: "", skills: [], role: "", invites: false, sort: st.sort, page: 1 }; var i = document.getElementById("ppl-q"); if (i) i.value = ""; load(); });
    box.appendChild(clr);
  }
  function card(u) {
    var a = h("a", { class: "ppl-card", href: "#community/" + encodeURIComponent(u.login) });
    a.addEventListener("click", function (e) { e.preventDefault(); go("community/" + encodeURIComponent(u.login)); });
    var name = h("div", { class: "ppl-name" }, [h("strong", {}, [u.username || u.login]), " ", h("span", { class: "ppl-login" }, ["@" + u.login]), roleBadge(u.role)]);
    var bio = h("p", { class: "ppl-bio" + (u.bio ? "" : " empty") }, [u.bio || t("noBio")]);
    var tags = h("div", { class: "ppl-tags" }, (u.skills || []).slice(0, 5).map(function (s) { return h("span", { class: "ppl-tag" }, [s]); }));
    var meta = [t("nProjects", { n: u.projects })];
    if (u.location) meta.push(u.location);
    a.appendChild(avatar(u));
    a.appendChild(h("div", { class: "ppl-body" }, [name, bio, (u.skills || []).length ? tags : null, h("div", { class: "ppl-meta" }, [meta.join(" · ")])]));
    return a;
  }
  function load() {
    var list = document.getElementById("ppl-list"), cnt = document.getElementById("ppl-count");
    if (!list) return;
    var qs = new URLSearchParams({ q: st.q, skills: st.skills.join(","), role: st.role, invites: st.invites ? "1" : "0", sort: st.sort, page: String(st.page) });
    list.setAttribute("aria-busy", "true");
    get("/api/people?" + qs).then(function (r) {
      lastFacets = r.skills || []; drawFilters();
      list.textContent = ""; list.removeAttribute("aria-busy");
      cnt.textContent = st.q ? t("countQ", { n: r.total, q: st.q }) : t("count", { n: r.total });
      if (!r.items.length) list.appendChild(h("div", { class: "ppl-empty" }, [ico("fa-user-slash"), h("p", {}, [t("empty")])]));
      r.items.forEach(function (u) { list.appendChild(card(u)); });
      var pg = document.getElementById("ppl-pages"); pg.textContent = "";
      if (r.pages > 1) {
        var prev = h("button", { type: "button", class: "btn-action" }, [ico("fa-chevron-left"), " " + t("prev")]), next = h("button", { type: "button", class: "btn-action" }, [t("next") + " ", ico("fa-chevron-right")]);
        prev.disabled = r.page <= 1; next.disabled = r.page >= r.pages;
        prev.addEventListener("click", function () { st.page--; load(); window.scrollTo(0, 0); });
        next.addEventListener("click", function () { st.page++; load(); window.scrollTo(0, 0); });
        pg.appendChild(prev); pg.appendChild(h("span", {}, [r.page + " / " + r.pages])); pg.appendChild(next);
      }
    }).catch(function (e) { list.removeAttribute("aria-busy"); list.textContent = e.message; });
  }
  function showList() {
    document.getElementById("ppl-list-view").hidden = false; document.getElementById("ppl-profile-view").hidden = true;
    var q = document.getElementById("ppl-q");
    if (q && !q._ok) {
      q._ok = true;
      q.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(function () { st.q = q.value.trim(); st.page = 1; load(); }, 300); });
    }
    load();
  }

  /* ── profil ─────────────────────────────────────────────────────────────────────────────────── */
  function stat(label, val) { return h("div", { class: "ppl-stat" }, [h("div", { class: "ppl-stat-l" }, [label]), h("div", { class: "ppl-stat-v" }, [String(val)])]); }
  function projCard(p) {
    var a = h("a", { class: "ppl-proj", href: "#projects" });
    a.addEventListener("click", function (e) { e.preventDefault(); if (window.openProjectFromComponent) openProjectFromComponent(p.slug); });
    a.appendChild(p.image_main ? h("img", { src: "/static/" + p.image_main, alt: "", loading: "lazy" }) : h("div", { class: "ppl-proj-ph", "aria-hidden": "true" }, [ico("fa-microchip")]));
    var st_ = { stable: "STABLE", progress: "IN PROGRESS", archive: "ARCHIVE" }[p.status] || (p.status || "").toUpperCase();
    a.appendChild(h("div", { class: "ppl-proj-b" }, [
      h("div", { class: "ppl-proj-tags" }, [st_ ? h("span", { class: "ppl-badge st-" + p.status }, [st_]) : null, p.is_official ? h("span", { class: "ppl-badge admin" }, [t("official")]) : null]),
      h("h3", {}, [p.title || p.slug]), p.short_desc ? h("p", {}, [p.short_desc]) : null
    ]));
    return a;
  }
  function showProfile(login) {
    document.getElementById("ppl-list-view").hidden = true;
    var host = document.getElementById("ppl-profile-view"); host.hidden = false; host.textContent = "";
    var back = h("a", { class: "ppl-back", href: "#community" }, [ico("fa-arrow-left"), " " + t("back")]);
    back.addEventListener("click", function (e) { e.preventDefault(); go("community"); });
    host.appendChild(back);
    var box = h("div", { class: "ppl-prof", "aria-busy": "true" }); host.appendChild(box);
    get("/api/u/" + encodeURIComponent(login)).then(function (u) {
      box.removeAttribute("aria-busy");
      document.title = (u.username || u.login) + " – ESN";
      if (u.preview) box.appendChild(h("div", { class: "ppl-preview" }, [ico("fa-lock"), " " + (u.is_me ? t("previewMe") : t("previewAdmin"))]));
      var actions = h("div", { class: "ppl-actions" });
      if (u.is_me) {
        var ed = h("button", { type: "button", class: "btn-action primary" }, [ico("fa-pen"), " " + t("edit")]);
        ed.addEventListener("click", function () { app.navigate("profile"); if (window.loadProfileData) loadProfileData(); if (window.ESNProfileSettings) ESNProfileSettings.tab("public"); });
        actions.appendChild(ed);
      } else if (u.allow_invites) {
        var inv = h("button", { type: "button", class: "btn-action", disabled: "disabled", title: t("inviteSoon") }, [ico("fa-user-plus"), " " + t("invite")]);
        actions.appendChild(inv);
      }
      var links = h("div", { class: "ppl-links" }, (u.links || []).map(function (l) {
        var isGh = /github\.com/i.test(l.url);
        return h("a", { href: l.url, target: "_blank", rel: "nofollow ugc noopener noreferrer" }, [h("i", { class: (isGh ? "fa-brands fa-github" : "fa-solid fa-link"), "aria-hidden": "true" }), " " + (l.label || l.url.replace(/^https?:\/\//, "")), " ", ico("fa-arrow-up-right-from-square")]);
      }));
      var sub = ["@" + u.login]; if (u.location) sub.push(u.location);
      box.appendChild(h("section", { class: "ppl-head acc-card" }, [
        avatar(u, "big"),
        h("div", { class: "ppl-head-b" }, [
          h("div", { class: "ppl-head-name" }, [h("h1", {}, [u.username || u.login]), roleBadge(u.role)]),
          h("div", { class: "ppl-login" }, [sub.join(" · ")]),
          u.bio ? h("p", { class: "ppl-head-bio" }, [u.bio]) : null,
          (u.skills || []).length ? h("div", { class: "ppl-tags" }, u.skills.map(function (s) { return h("span", { class: "ppl-tag" }, [s]); })) : null,
          (u.links || []).length ? links : null,
          h("div", { class: "ppl-since" }, [t("since", { d: since(u.member_since) })])
        ]),
        actions.children.length ? actions : null
      ]));
      box.appendChild(h("section", { class: "ppl-stats" }, [stat(t("statProjects"), u.stats.projects), stat(t("statSchemas"), u.stats.schemas || 0)]));
      // zakładki jak w makiecie: Projekty · Schematy · Aktywność (gdy włączona); „Współtworzy” dojdzie w etapie 2
      var tabs = [["projects", t("projects"), u.stats.projects], ["schemas", t("schemas"), u.stats.schemas || 0]];
      if (u.show_activity) tabs.push(["activity", t("activity"), null]);
      var bar = h("div", { class: "pe-tabs ppl-tabs", role: "tablist", "aria-label": t("sections") }), panel = h("section", { class: "ppl-tab-panel", role: "tabpanel" });
      function openTab(k) {
        [].forEach.call(bar.children, function (b) { var on = b.dataset.k === k; b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false"); b.tabIndex = on ? 0 : -1; });
        panel.textContent = "";
        if (k === "projects") {
          var g = h("div", { class: "ppl-proj-grid" });
          if (!u.projects.length) g.appendChild(h("p", { class: "ppl-muted" }, [t("noProjects")]));
          u.projects.forEach(function (p) { g.appendChild(projCard(p)); }); panel.appendChild(g);
        } else if (k === "schemas") {
          var gs = h("div", { class: "ppl-sch-grid" });
          if (!(u.schemas || []).length) gs.appendChild(h("p", { class: "ppl-muted" }, [t("noSchemas")]));
          (u.schemas || []).forEach(function (w) {
            var a = h("a", { class: "ppl-sch", href: "#projects" }, [h("div", { class: "ppl-sch-ic", "aria-hidden": "true" }, [ico("fa-diagram-project")]),
              h("div", { class: "ppl-body" }, [h("strong", {}, [w.title]), h("span", { class: "ppl-meta" }, [t("schemaIn", { p: w.project_title }) + " · " + t("nParts", { n: w.parts })]), h("span", { class: "ppl-meta" }, [t("updated", { d: since(w.updated_at && w.updated_at.slice(0, 7)) })])])]);
            a.addEventListener("click", function (e) { e.preventDefault(); if (window.openProjectFromComponent) openProjectFromComponent(w.project_slug); });
            gs.appendChild(a);
          });
          panel.appendChild(gs);
          panel.appendChild(h("p", { class: "ppl-fine" }, [t("schemasNote")]));
        } else {
          var ul = h("ul", { class: "ppl-act" });
          if (!(u.activity || []).length) panel.appendChild(h("p", { class: "ppl-muted" }, [t("noActivity")]));
          (u.activity || []).forEach(function (a) {
            var li = h("li", {}, [ico(a.type === "schema" ? "fa-diagram-project" : "fa-folder-plus"), h("span", {}, [t(a.type === "schema" ? "actSchema" : "actProject") + " "]),
              h("a", { href: "#projects" }, [a.title]), h("time", { datetime: a.at || "" }, [a.at ? ESNI18n.date(new Date(a.at)) : ""])]);
            li.querySelector("a").addEventListener("click", function (e) { e.preventDefault(); if (window.openProjectFromComponent) openProjectFromComponent(a.slug); });
            ul.appendChild(li);
          });
          panel.appendChild(ul);
        }
      }
      tabs.forEach(function (tb) {
        var b = h("button", { type: "button", role: "tab", class: "pe-tab", "data-k": tb[0] }, [tb[1], tb[2] != null ? h("span", { class: "ppl-tab-n" }, [String(tb[2])]) : null]);
        b.addEventListener("click", function () { openTab(tb[0]); }); bar.appendChild(b);
      });
      bar.addEventListener("keydown", function (e) {
        var d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!d) return; e.preventDefault();
        var ks = tabs.map(function (x) { return x[0]; }), i = ks.indexOf(bar.querySelector(".on").dataset.k), k = ks[(i + d + ks.length) % ks.length];
        openTab(k); bar.querySelector('[data-k="' + k + '"]').focus();
      });
      box.appendChild(bar); box.appendChild(panel); openTab("projects");
    }).catch(function (e) {
      box.removeAttribute("aria-busy");
      box.appendChild(h("div", { class: "ppl-empty" }, [ico("fa-user-lock"), h("p", {}, [e.message])]));
    });
  }

  function enter() {
    if (!/^#community\//.test(location.hash) && document.title !== baseTitle && !/#community/.test(location.hash)) document.title = baseTitle;
    if (!document.getElementById("view-community")) return;
    var m = location.hash.match(/^#community\/([^/?#]+)/);
    document.getElementById("view-community").classList.toggle("ppl-on-profile", !!m);
    if (m) showProfile(decodeURIComponent(m[1])); else { document.title = baseTitle; showList(); }
  }
  window.ESNPeople = { enter: enter, open: function (login) { app.navigate("community"); go("community/" + encodeURIComponent(login)); } };
  window.ESNPublicProfile = true;     // przycisk „Podgląd profilu” w Moim koncie
  document.addEventListener("esn-lang", function () { var v = document.getElementById("view-community"); if (v && v.classList.contains("active")) enter(); });
})();
