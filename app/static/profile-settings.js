/* ESN – Moje konto (v61): zakładki z bocznym menu, „Profil publiczny” (o mnie, linki, prywatność), „Język i wygląd”.
 * Dane profilu: GET/PUT /api/users/me/public-profile; nazwa wyświetlana: PUT /api/users/me/profile; awatar: DELETE /api/users/me/avatar.
 * Teksty z ESNI18n (pp.*, acc.*). Kolory tylko ze zmiennych CSS. Profil domyślnie prywatny.
 */
(function () {
  "use strict";
  var LIMITS = { bio: 300, location: 80, skills: 8, links: 4 }, TAB_KEY = "esn-acc-tab", TABS = ["public", "account", "ai", "look"];
  function t(k, o) { var s = _t("pp." + k); return o ? s.replace(/\{(\w+)\}/g, function (_, x) { return o[x]; }) : s; }

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") e.className = attrs[k]; else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]);
    });
    [].concat(kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function ico(name) { return h("i", { class: "fa-solid " + name, "aria-hidden": "true" }); }
  function tok() { try { return ESNAuth.token(); } catch (e) { return null; } }
  function api(path, method, body) {
    return fetch(path, {
      method: method || "GET", headers: Object.assign({ Authorization: "Bearer " + tok() }, body ? { "Content-Type": "application/json" } : {}),
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(_E(j.detail) || ("HTTP " + r.status)); return j; });
    });
  }
  function note(el, text, kind) { el.textContent = text || ""; el.className = "ai-set-msg" + (kind ? " " + kind : ""); }
  function field(label, input, hint) {
    return h("label", { class: "ai-set-field" }, [h("span", {}, [label]), input, hint ? h("small", { class: "pp-hint" }, [hint]) : null]);
  }
  function input(type, max, ph, val) { var i = h("input", { class: "text-input", type: type, maxlength: String(max), placeholder: ph || "" }); i.value = val || ""; return i; }

  /* ── zakładki ─────────────────────────────────────────────────────────────────────────────── */
  function store(v) { try { if (v) localStorage.setItem(TAB_KEY, v); return localStorage.getItem(TAB_KEY); } catch (e) { return null; } }
  function showTab(name, focus) {
    if (TABS.indexOf(name) < 0) name = "public";
    [].forEach.call(document.querySelectorAll("#view-profile .acc-tab"), function (b) {
      var on = b.dataset.acc === name; b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false"); b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    [].forEach.call(document.querySelectorAll("#view-profile .acc-panel"), function (p) { p.hidden = p.dataset.acc !== name; });
    store(name);
    if (name === "look") renderLook();
  }
  function initTabs() {
    var nav = document.querySelector("#view-profile .acc-nav");
    if (!nav || nav._ok) return; nav._ok = true;
    nav.addEventListener("click", function (e) { var b = e.target.closest(".acc-tab"); if (b) showTab(b.dataset.acc); });
    nav.addEventListener("keydown", function (e) {     // strzałki między zakładkami (wzorzec ARIA tablist)
      var i = TABS.indexOf(store()), d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (d) { e.preventDefault(); showTab(TABS[(i + d + TABS.length) % TABS.length], true); }
    });
    showTab(store() || "public");
  }

  /* ── Język i wygląd ───────────────────────────────────────────────────────────────────────── */
  function optBtn(label, on, fn) {
    var b = h("button", { type: "button", class: "btn-action acc-opt" + (on ? " on" : ""), "aria-pressed": on ? "true" : "false" }, [label]);
    b.addEventListener("click", fn); return b;
  }
  function renderLook() {
    var L = document.getElementById("acc-lang-opts"), T = document.getElementById("acc-theme-opts");
    if (!L || !T) return;
    L.textContent = ""; T.textContent = "";
    (ESNI18n.list() || []).forEach(function (l) { L.appendChild(optBtn(l.name, l.code === ESNI18n.lang(), function () { ESNI18n.set(l.code); renderLook(); })); });
    var mode = window.ESNTheme ? ESNTheme.mode() : "auto";
    [["auto", "fa-circle-half-stroke"], ["light", "fa-sun"], ["dark", "fa-moon"]].forEach(function (m) {
      var b = optBtn(_t("acc.theme_" + m[0]), m[0] === mode, function () { if (window.ESNTheme) ESNTheme.set(m[0]); renderLook(); });
      b.insertBefore(document.createTextNode(" "), b.firstChild); b.insertBefore(ico(m[1]), b.firstChild); T.appendChild(b);
    });
  }

  /* ── awatar: inicjały ─────────────────────────────────────────────────────────────────────── */
  function initials(name) {
    var w = String(name || "").trim().split(/[\s_.\-]+/).filter(Boolean);
    return ((w[0] || "?").charAt(0) + (w.length > 1 ? w[1].charAt(0) : (w[0] || "").charAt(1))).toUpperCase();
  }
  function showInitials(name) {
    var ph = document.getElementById("prof-avatar-placeholder"), img = document.getElementById("prof-avatar-img");
    if (ph && (!img || img.style.display === "none")) { ph.textContent = initials(name); ph.classList.add("acc-initials"); }
    var del = document.getElementById("prof-avatar-del"); if (del) del.hidden = !img || img.style.display === "none";
  }
  window.removeAvatar = function () {
    api("/api/users/me/avatar", "DELETE").then(function () {
      var img = document.getElementById("prof-avatar-img"); if (img) { img.style.display = "none"; img.removeAttribute("src"); }
      var ph = document.getElementById("prof-avatar-placeholder"); if (ph) ph.style.display = "";
      var nImg = document.getElementById("nav-avatar-img"), nPh = document.getElementById("nav-avatar-placeholder");
      if (nImg) nImg.style.display = "none"; if (nPh) nPh.style.display = "flex";
      var mImg = document.getElementById("nav-avatar-img-m"), mIn = document.getElementById("nav-acc-initial");
      if (mImg) mImg.hidden = true; if (mIn) mIn.hidden = false;
      showInitials((document.getElementById("prof-nick") || {}).value);
      if (window.toast) toast(_t("acc.avatarRemoved"), "success");
    }).catch(function (e) { if (window.toast) toast(e.message, "error"); });
  };

  /* ── Profil publiczny ─────────────────────────────────────────────────────────────────────── */
  function linkRow(l) {
    var label = input("text", 40, t("linkLabelPh"), l && l.label), url = input("url", 300, "https://…", l && l.url);
    url.setAttribute("inputmode", "url");
    var row = h("div", { class: "pp-link-row" }, [label, url,
      h("button", { type: "button", class: "btn-action pp-link-del", "aria-label": t("linkDel"), title: t("linkDel"), onclick: function () { row.remove(); } }, [ico("fa-trash")])]);
    row._val = function () { return { label: label.value.trim(), url: url.value.trim() }; };
    return row;
  }

  function toggle(key, s) {
    var cb = h("input", { type: "checkbox", role: "switch", class: "pp-switch" }); cb.checked = !!s[key]; cb.dataset.k = key;
    return h("label", { class: "pp-toggle" }, [cb, h("span", {}, [h("strong", {}, [t("t_" + key)]), h("small", {}, [t("t_" + key + "_d")])])]);
  }

  function render() {
    var host = document.getElementById("profile-public-card"), about = document.getElementById("pp-about");
    initTabs();
    if (!host || !about) return;
    if (!tok()) { host.textContent = ""; about.textContent = ""; return; }
    api("/api/users/me/public-profile").then(function (s) { build(host, about, s); }).catch(function (e) { host.textContent = e.message; });
  }

  function build(host, about, s, flash) {
    host.textContent = ""; about.textContent = "";
    var nick = document.getElementById("prof-nick"); var nickStart = nick ? nick.value : "";
    showInitials(nickStart || s.username || s.login);

    var bio = h("textarea", { class: "text-input pp-bio", rows: "3", maxlength: String(LIMITS.bio), placeholder: t("bioPh") }); bio.value = s.bio || "";
    var cnt = h("small", { class: "pp-count" }); function upd() { cnt.textContent = bio.value.length + " / " + LIMITS.bio; } bio.addEventListener("input", upd); upd();
    var loc = input("text", LIMITS.location, t("locationPh"), s.location);
    var skills = input("text", 400, t("skillsPh"), (s.skills || []).join(", "));
    var chips = h("div", { class: "pp-chips" });
    function drawChips() {
      chips.textContent = "";
      skills.value.split(/[,;]/).map(function (x) { return x.trim(); }).filter(Boolean).slice(0, LIMITS.skills)
        .forEach(function (x) { chips.appendChild(h("span", { class: "pp-chip" }, [x.slice(0, 30)])); });
    }
    skills.addEventListener("input", drawChips); drawChips();

    // GitHub i strona www jako stałe pola (jak w makiecie), pozostałe linki – dodatkowe wiersze
    var rest = (s.links || []).slice(), gh = "", www = "";
    rest = rest.filter(function (l) {
      var lab = (l.label || "").toLowerCase();
      if (!gh && (lab === "github" || /^https?:\/\/(www\.)?github\.com\//i.test(l.url))) { gh = l.url; return false; }
      if (!www && (lab === "www" || lab === "strona www" || lab === "website")) { www = l.url; return false; }
      return true;
    });
    var ghIn = input("url", 300, "https://github.com/…", gh), wwwIn = input("url", 300, "https://…", www);
    var links = h("div", { class: "pp-links" }); rest.forEach(function (l) { links.appendChild(linkRow(l)); });
    var msg = h("p", { class: "ai-set-msg" });
    function allLinks() {
      var out = [];
      if (ghIn.value.trim()) out.push({ label: "GitHub", url: ghIn.value.trim() });
      if (wwwIn.value.trim()) out.push({ label: "WWW", url: wwwIn.value.trim() });
      [].forEach.call(links.children, function (r) { var v = r._val(); if (v.url || v.label) out.push(v); });
      return out;
    }
    var addLink = h("button", { type: "button", class: "btn-action pp-add" }, [ico("fa-plus"), " " + t("linkAdd")]);
    addLink.addEventListener("click", function () {
      if (allLinks().length >= LIMITS.links) { note(msg, t("linksMax", { n: LIMITS.links }), "err"); return; }
      links.appendChild(linkRow()); links.lastChild.querySelector("input").focus();
    });

    about.appendChild(field(t("bio"), bio)); about.appendChild(cnt);
    about.appendChild(h("div", { class: "ai-set-grid" }, [field(t("location"), loc), field(t("skills"), skills, t("skillsHint", { n: LIMITS.skills }))]));
    about.appendChild(chips);
    about.appendChild(h("div", { class: "ai-set-grid pp-gap" }, [field("GitHub", ghIn), field(t("www"), wwwIn)]));
    about.appendChild(links); about.appendChild(addLink);

    // Prywatność
    var state = h("span", { class: "pp-state" });
    function drawState(pub) {
      state.className = "pp-state " + (pub ? "on" : "off"); state.textContent = "";
      state.appendChild(ico(pub ? "fa-eye" : "fa-lock")); state.appendChild(document.createTextNode(" " + (pub ? t("stateOn") : t("stateOff"))));
    }
    drawState(s.profile_public);
    var toggles = h("div", { class: "pp-toggles" }, ["profile_public", "show_activity", "show_courses", "allow_invites"].map(function (k) { return toggle(k, s); }));
    toggles.querySelector('[data-k="profile_public"]').addEventListener("change", function (e) { drawState(e.target.checked); });
    host.appendChild(h("div", { class: "acc-card" }, [
      h("div", { class: "acc-h acc-h-row" }, [h("span", {}, [t("privacyH")]), state]),
      toggles, h("p", { class: "acc-fine" }, [t("privacyNote")])
    ]));

    // Pasek zapisu
    var save = h("button", { type: "button", class: "btn-action primary" }, [ico("fa-floppy-disk"), " " + t("save")]);
    var preview = h("a", { class: "btn-action", href: "#community/" + encodeURIComponent(s.login) }, [ico("fa-arrow-up-right-from-square"), " " + t("preview")]);
    preview.addEventListener("click", function (e) { e.preventDefault(); if (window.ESNPeople) ESNPeople.open(s.login); else note(msg, t("previewSoon")); });
    host.appendChild(h("div", { class: "acc-card acc-savebar" }, [
      h("p", {}, [t("saveBar")]), h("div", { class: "ai-set-actions" }, [preview, save])
    ]));
    host.lastChild.appendChild(msg);

    save.addEventListener("click", function () {
      var ls = allLinks();
      for (var i = 0; i < ls.length; i++) {
        if (!ls[i].url) { note(msg, t("linkNeedUrl"), "err"); return; }
        if (!/^https?:\/\//i.test(ls[i].url)) { note(msg, _E("Adres musi zaczynać się od http:// lub https://"), "err"); return; }
      }
      if (ls.length > LIMITS.links) { note(msg, t("linksMax", { n: LIMITS.links }), "err"); return; }
      var body = { bio: bio.value, location: loc.value, skills: skills.value, links: ls };
      [].forEach.call(toggles.querySelectorAll("input[data-k]"), function (cb) { body[cb.dataset.k] = cb.checked; });
      var nickNow = nick ? nick.value.trim() : "";
      if (nick && !nickNow) { note(msg, t("nickNeeded"), "err"); nick.focus(); return; }
      save.disabled = true; note(msg, t("saving"));
      var p = nick && nickNow !== nickStart ? api("/api/users/me/profile", "PUT", { username: nickNow }) : Promise.resolve();
      p.then(function () { return api("/api/users/me/public-profile", "PUT", body); })
        .then(function (r) {
          build(host, about, r); note(host.querySelector(".acc-savebar .ai-set-msg"), t("saved"), "ok");
        })
        .catch(function (e) { save.disabled = false; note(msg, e.message, "err"); });
    });
  }

  window.ESNProfileSettings = { render: render, tab: showTab };
  document.addEventListener("esn-lang", function () { if (document.getElementById("profile-public-card")) render(); renderLook(); });
  document.addEventListener("esn-theme", function () { renderLook(); });
})();
