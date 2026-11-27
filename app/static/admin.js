/* ESN – dashboard administracji (v64). Widok #admin, tylko rola admin (serwer i tak sprawdza każde zapytanie).
 * API: /api/admin/overview, /users (+ ban/unban/unlock/role), /messages, /log. Teksty ESNI18n (adm.*), treści przez textContent.
 */
(function () {
  "use strict";
  var TABS = ["overview", "users", "messages", "security", "log"], cur = "overview", us = { q: "", role: "", status: "", sort: "newest", page: 1 }, timer;
  function t(k, o) { var s = _t("adm." + k); return o ? s.replace(/\{(\w+)\}/g, function (_, x) { return o[x]; }) : s; }
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") e.className = attrs[k]; else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]);
    });
    [].concat(kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c); });
    return e;
  }
  function ico(n) { return h("i", { class: "fa-solid " + n, "aria-hidden": "true" }); }
  function api(path, method, body) {
    return fetch("/api/admin" + path, { method: method || "GET", headers: Object.assign({ Authorization: "Bearer " + ESNAuth.token() }, body ? { "Content-Type": "application/json" } : {}), body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(_E(j.detail) || ("HTTP " + r.status)); return j; }); });
  }
  function num(n) { return n == null ? "—" : ESNI18n.num(n); }
  function bytes(b) { if (b == null) return "—"; var u = ["B", "KB", "MB", "GB"], i = 0; while (b >= 1024 && i < 3) { b /= 1024; i++; } return ESNI18n.num(b, { maximumFractionDigits: i ? 1 : 0 }) + " " + u[i]; }
  function when(iso) { if (!iso) return "—"; try { return ESNI18n.date(new Date(iso), { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return iso; } }
  function day(iso) { if (!iso) return "—"; try { return ESNI18n.date(new Date(iso), { dateStyle: "medium" }); } catch (e) { return iso; } }
  function err(host, e) { host.textContent = ""; host.appendChild(h("p", { class: "adm-err" }, [ico("fa-triangle-exclamation"), " " + e.message])); }
  function toastOk(m) { if (window.toast) toast(m, "success"); }
  function toastErr(e) { if (window.toast) toast(e.message, "error"); }

  /* ── Przegląd ─────────────────────────────────────────────────────────────────────────────── */
  function tile(label, val, sub, icon, go) {
    var el = h(go ? "button" : "div", { class: "adm-tile" + (go ? " go" : ""), type: go ? "button" : null }, [
      h("div", { class: "adm-tile-l" }, [icon ? ico(icon) : null, " " + label]), h("div", { class: "adm-tile-v" }, [val]), sub ? h("div", { class: "adm-tile-s" }, [sub]) : null]);
    if (go) el.addEventListener("click", go);
    if (!go) el.removeAttribute("type");
    return el;
  }
  function chart(series) {
    var W = 600, H = 120, P = 22, max = Math.max(1, Math.max.apply(null, series.map(function (s) { return s.n; }))), bw = (W - P) / series.length;
    var ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + (H + 18)); svg.setAttribute("class", "adm-chart"); svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", t("chartLabel", { n: series.reduce(function (a, s) { return a + s.n; }, 0) }));
    function el(n, a) { var e = document.createElementNS(ns, n); Object.keys(a).forEach(function (k) { e.setAttribute(k, a[k]); }); svg.appendChild(e); return e; }
    el("line", { x1: P, y1: H, x2: W, y2: H, class: "adm-axis" });
    el("text", { x: P - 6, y: 10, class: "adm-chart-t", "text-anchor": "end" }).textContent = max;
    el("text", { x: P - 6, y: H, class: "adm-chart-t", "text-anchor": "end" }).textContent = "0";
    var lastLab = -9;
    series.forEach(function (s, i) {
      var bh = s.n ? Math.max(2, (s.n / max) * (H - 8)) : 0;
      var r = el("rect", { x: P + i * bw + 2, y: H - bh, width: Math.max(1, bw - 4), height: bh, rx: 2, class: "adm-bar" });
      var tt = document.createElementNS(ns, "title"); tt.textContent = day(s.date) + ": " + s.n; r.appendChild(tt);
      if ((i % 7 === 0 && series.length - 1 - i >= 4) || i === series.length - 1) el("text", { x: P + i * bw + bw / 2, y: H + 14, class: "adm-chart-t", "text-anchor": "middle" }).textContent = s.date.slice(5);
    });
    return svg;
  }
  function renderOverview(host) {
    api("/overview").then(function (o) {
      host.textContent = "";
      var u = o.users, c = o.content, st = o.storage;
      host.appendChild(h("h3", { class: "adm-h" }, [t("hUsers")]));
      host.appendChild(h("div", { class: "adm-tiles" }, [
        tile(t("total"), num(u.total), t("publicN", { n: u.public }), "fa-users", function () { show("users"); }),
        tile(t("new7"), num(u.new7), t("new30", { n: u.new30 }), "fa-user-plus"),
        tile(t("active7"), num(u.active7), t("active30", { n: u.active30 }), "fa-bolt"),
        tile(t("banned"), num(u.banned), t("lockedN", { n: u.locked }), "fa-ban", function () { us.status = "banned"; show("users"); }),
        tile(t("roles"), num(u.roles.admin + u.roles.moderator), t("rolesSub", { a: u.roles.admin, m: u.roles.moderator, u: u.roles.user }), "fa-user-shield")
      ]));
      host.appendChild(h("div", { class: "acc-card adm-chart-card" }, [h("div", { class: "adm-sub" }, [t("signups30")]), chart(u.signups)]));
      host.appendChild(h("h3", { class: "adm-h" }, [t("hContent")]));
      host.appendChild(h("div", { class: "adm-tiles" }, [
        tile(t("projects"), num(c.projects), t("official", { n: c.projects_official }), "fa-folder-open"),
        tile(t("components"), num(c.components), null, "fa-microchip"),
        tile(t("articles"), num(c.articles), t("articlesSub", { p: c.articles_published, r: c.articles_review }), "fa-book-open"),
        tile(t("schemas"), num(c.schemas), null, "fa-diagram-project"),
        tile(t("files"), num(c.media + c.resources), t("filesSub", { m: c.media, r: c.resources }), "fa-photo-film")
      ]));
      host.appendChild(h("h3", { class: "adm-h" }, [t("hOps")]));
      var upl = ["media", "files", "projects", "catalog", "avatars"].reduce(function (a, k) { return a + ((st[k] || {}).bytes || 0); }, 0);
      host.appendChild(h("div", { class: "adm-tiles" }, [
        tile(t("messages"), num(o.moderation.unread), t("messagesSub", { n: o.moderation.messages }), "fa-envelope", function () { show("messages"); }),
        tile(t("limits"), num(o.security.limits.length), t("limitsSub"), "fa-shield-halved", function () { show("security"); }),
        tile(t("storage"), bytes(upl), t("dbSize", { s: bytes(st.db_bytes) }), "fa-hard-drive"),
        tile(t("ai"), num(o.ai.requests_today), t("aiSub", { u: o.ai.users_today, k: o.ai.own_keys }), "fa-robot")
      ]));
      host.appendChild(h("p", { class: "adm-fine" }, [t("generated", { d: when(o.generated_at) })]));
    }).catch(function (e) { err(host, e); });
  }

  /* ── Użytkownicy ──────────────────────────────────────────────────────────────────────────── */
  function sel(opts, val, fn, label) {
    var s = h("select", { class: "sort-select", "aria-label": label });
    opts.forEach(function (o) { var op = h("option", { value: o[0] }, [o[1]]); if (o[0] === val) op.selected = true; s.appendChild(op); });
    s.addEventListener("change", function () { fn(s.value); }); return s;
  }
  function act(label, icon, fn, danger) {
    var b = h("button", { type: "button", class: "btn-action adm-act" + (danger ? " danger" : ""), title: label, "aria-label": label }, [ico(icon)]);
    b.addEventListener("click", fn); return b;
  }
  function userActions(u, reload) {
    var box = h("div", { class: "adm-acts" });
    var role = sel([["user", t("rUser")], ["moderator", t("rMod")], ["admin", t("rAdmin")]], u.role, function (v) {
      if (v === "admin" && !confirm(t("confirmAdmin", { l: u.login }))) { role.value = u.role; return; }
      api("/users/" + u.id + "/role", "PUT", { role: v }).then(function () { toastOk(t("roleChanged")); reload(); }).catch(function (e) { role.value = u.role; toastErr(e); });
    }, t("role"));
    box.appendChild(role);
    box.appendChild(act(t("viewProfile"), "fa-id-card", function () { if (window.ESNPeople) ESNPeople.open(u.login); }));
    if (u.locked) box.appendChild(act(t("unlock"), "fa-unlock", function () { api("/users/" + u.id + "/unlock", "POST").then(function () { toastOk(t("unlocked")); reload(); }).catch(toastErr); }));
    if (u.banned) box.appendChild(act(t("unban"), "fa-rotate-left", function () { api("/users/" + u.id + "/unban", "POST").then(function () { toastOk(t("unbanned")); reload(); }).catch(toastErr); }));
    else box.appendChild(act(t("ban"), "fa-ban", function () {
      var days = prompt(t("banDays", { l: u.login }), "7"); if (days === null) return;
      var reason = prompt(t("banReason"), "") || "";
      api("/users/" + u.id + "/ban", "POST", { days: parseInt(days, 10) || null, reason: reason }).then(function () { toastOk(t("bannedOk")); reload(); }).catch(toastErr);
    }, true));
    return box;
  }
  function renderUsers(host) {
    host.textContent = "";
    var q = h("input", { type: "search", class: "search-input adm-q", placeholder: t("searchUsers"), "aria-label": t("searchUsers"), maxlength: "80" }); q.value = us.q;
    q.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(function () { us.q = q.value.trim(); us.page = 1; load(); }, 300); });
    var bar = h("div", { class: "adm-bar-row" }, [
      h("div", { class: "search-wrap" }, [h("span", { class: "search-icon" }, [ico("fa-magnifying-glass")]), q]),
      sel([["", t("allRoles")], ["user", t("rUser")], ["moderator", t("rMod")], ["admin", t("rAdmin")]], us.role, function (v) { us.role = v; us.page = 1; load(); }, t("role")),
      sel([["", t("allStatus")], ["banned", t("sBanned")], ["locked", t("sLocked")], ["public", t("sPublic")]], us.status, function (v) { us.status = v; us.page = 1; load(); }, t("status")),
      sel([["newest", t("oNewest")], ["oldest", t("oOldest")], ["az", "A–Z"], ["za", "Z–A"], ["login", t("oLogin")]], us.sort, function (v) { us.sort = v; load(); }, t("sort"))
    ]);
    var count = h("div", { class: "ppl-count" }), list = h("div", { class: "adm-users" }), pages = h("div", { class: "ppl-pages" });
    host.appendChild(bar); host.appendChild(count); host.appendChild(list); host.appendChild(pages);
    function load() {
      var qs = new URLSearchParams({ q: us.q, role: us.role, status: us.status, sort: us.sort, page: String(us.page) });
      api("/users?" + qs).then(function (r) {
        count.textContent = t("usersCount", { n: r.total }); list.textContent = ""; pages.textContent = "";
        if (!r.items.length) list.appendChild(h("p", { class: "ppl-muted" }, [t("noUsers")]));
        r.items.forEach(function (u) {
          var flags = h("div", { class: "adm-flags" }, [
            u.role !== "user" ? h("span", { class: "ppl-badge " + (u.role === "admin" ? "admin" : "mod") }, [u.role === "admin" ? t("rAdmin") : t("rMod")]) : null,
            u.banned ? h("span", { class: "ppl-badge adm-red", title: u.ban_reason || "" }, [t("sBanned") + (u.banned_until ? " → " + day(u.banned_until) : "")]) : null,
            u.locked ? h("span", { class: "ppl-badge st-progress" }, [t("sLocked")]) : null,
            u.public ? h("span", { class: "ppl-badge" }, [t("sPublic")]) : null
          ]);
          list.appendChild(h("div", { class: "adm-user" }, [
            h("div", { class: "adm-user-main" }, [
              h("div", { class: "adm-user-name" }, [h("strong", {}, [u.username || u.login]), " ", h("span", { class: "ppl-login" }, ["@" + u.login]), flags]),
              h("div", { class: "adm-user-meta" }, [u.email + " · " + t("joined", { d: day(u.created_at) }) + " · " + t("lastLogin", { d: when(u.last_login_at) }) + " · " + t("nProjects", { n: u.projects })])
            ]),
            userActions(u, load)
          ]));
        });
        if (r.pages > 1) {
          var p = h("button", { type: "button", class: "btn-action" }, [ico("fa-chevron-left")]), n = h("button", { type: "button", class: "btn-action" }, [ico("fa-chevron-right")]);
          p.disabled = r.page <= 1; n.disabled = r.page >= r.pages;
          p.addEventListener("click", function () { us.page--; load(); }); n.addEventListener("click", function () { us.page++; load(); });
          pages.appendChild(p); pages.appendChild(h("span", {}, [r.page + " / " + r.pages])); pages.appendChild(n);
        }
      }).catch(function (e) { err(list, e); });
    }
    load();
  }

  /* ── Zgłoszenia ───────────────────────────────────────────────────────────────────────────── */
  function renderMessages(host) {
    var only = host._only || 0;
    api("/messages?unread=" + only).then(function (rows) {
      host.textContent = "";
      var tog = h("label", { class: "ai-set-check" }, [h("input", { type: "checkbox" }), h("span", {}, [t("onlyUnread")])]);
      tog.firstChild.checked = !!only; tog.firstChild.addEventListener("change", function (e) { host._only = e.target.checked ? 1 : 0; renderMessages(host); });
      host.appendChild(tog);
      if (!rows.length) host.appendChild(h("p", { class: "ppl-muted" }, [t("noMessages")]));
      rows.forEach(function (m) {
        var btn = h("button", { type: "button", class: "btn-action" }, [ico(m.is_read ? "fa-envelope" : "fa-check"), " " + (m.is_read ? t("markUnread") : t("markRead"))]);
        btn.addEventListener("click", function () { api("/messages/" + m.id + "/read", "PUT", { read: !m.is_read }).then(function () { renderMessages(host); }).catch(toastErr); });
        var mail = h("a", { href: "mailto:" + encodeURIComponent(m.email || "") + "?subject=" + encodeURIComponent("Re: " + (m.subject || "")), class: "btn-action" }, [ico("fa-reply"), " " + t("reply")]);
        host.appendChild(h("article", { class: "acc-card adm-msg" + (m.is_read ? " read" : "") }, [
          h("div", { class: "adm-msg-h" }, [h("strong", {}, [m.subject || t("noSubject")]), h("span", { class: "ppl-login" }, [when(m.created_at)])]),
          h("div", { class: "adm-user-meta" }, [(m.name || "—") + " · " + (m.email || "—")]),
          h("p", { class: "adm-msg-b" }, [m.message || ""]),
          h("div", { class: "ai-set-actions" }, [btn, mail])
        ]));
      });
    }).catch(function (e) { err(host, e); });
  }

  /* ── Bezpieczeństwo ───────────────────────────────────────────────────────────────────────── */
  function table(head, rows) {
    return h("div", { class: "adm-table-wrap" }, [h("table", { class: "adm-table" }, [h("thead", {}, [h("tr", {}, head.map(function (x) { return h("th", { scope: "col" }, [x]); }))]),
      h("tbody", {}, rows.map(function (r) { return h("tr", {}, r.map(function (c) { return h("td", {}, [c]); })); }))])]);
  }
  function renderSecurity(host) {
    api("/overview").then(function (o) {
      host.textContent = "";
      var s = o.security;
      host.appendChild(h("h3", { class: "adm-h" }, [t("hLimits")]));
      host.appendChild(h("p", { class: "ai-set-note" }, [t("limitsNote")]));
      host.appendChild(s.limits.length ? table([t("cKey"), t("cCount"), t("cSince")], s.limits.map(function (l) { return [l.key, String(l.count), when(l.since)]; })) : h("p", { class: "ppl-muted" }, [t("noLimits")]));
      host.appendChild(h("h3", { class: "adm-h" }, [t("hBlocked")]));
      host.appendChild(s.blocked.length ? table([t("cLogin"), t("cState"), t("cUntil")], s.blocked.map(function (b) {
        return ["@" + b.login, b.banned ? t("sBanned") + (b.ban_reason ? " – " + b.ban_reason : "") : t("sLocked"), when(b.banned ? b.banned_until : b.lockout_until)];
      })) : h("p", { class: "ppl-muted" }, [t("noBlocked")]));
    }).catch(function (e) { err(host, e); });
  }

  /* ── Dziennik ─────────────────────────────────────────────────────────────────────────────── */
  function renderLog(host) {
    api("/log").then(function (rows) {
      host.textContent = "";
      host.appendChild(rows.length ? table([t("cWhen"), t("cAdmin"), t("cAction"), t("cTarget"), t("cNote")], rows.map(function (r) {
        return [when(r.created_at), "@" + r.admin, t("a_" + r.action.replace(/-/g, "_")), r.target || "—", r.note || "—"];
      })) : h("p", { class: "ppl-muted" }, [t("noLog")]));
    }).catch(function (e) { err(host, e); });
  }

  var RENDER = { overview: renderOverview, users: renderUsers, messages: renderMessages, security: renderSecurity, log: renderLog };
  function show(name) {
    cur = TABS.indexOf(name) < 0 ? "overview" : name;
    [].forEach.call(document.querySelectorAll("#view-admin .acc-tab"), function (b) { var on = b.dataset.adm === cur; b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false"); b.tabIndex = on ? 0 : -1; });
    var host = document.getElementById("adm-panel"); host.textContent = ""; host.appendChild(h("p", { class: "ppl-muted" }, [t("loading")]));
    RENDER[cur](host);
  }
  function enter() {
    var nav = document.querySelector("#view-admin .acc-nav");
    if (nav && !nav._ok) {
      nav._ok = true;
      nav.addEventListener("click", function (e) { var b = e.target.closest(".acc-tab"); if (b) show(b.dataset.adm); });
      nav.addEventListener("keydown", function (e) { var d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]; if (d) { e.preventDefault(); show(TABS[(TABS.indexOf(cur) + d + TABS.length) % TABS.length]); document.querySelector('#view-admin .acc-tab[data-adm="' + cur + '"]').focus(); } });
    }
    show(cur);
  }
  window.ESNAdmin = { enter: enter, show: show };
  document.addEventListener("esn-lang", function () { var v = document.getElementById("view-admin"); if (v && v.classList.contains("active")) show(cur); });
})();
