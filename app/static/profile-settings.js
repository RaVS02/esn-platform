/* ESN – karta „Profil publiczny” w Moim koncie (v61, etap 1 społeczności).
 * Dane: GET/PUT /api/users/me/public-profile. Teksty z ESNI18n (klucze pp.*). Kolory tylko ze zmiennych CSS.
 * Profil domyślnie jest prywatny – inni widzą go dopiero po włączeniu „profile_public”.
 */
(function () {
  "use strict";
  var LIMITS = { bio: 300, location: 80, skills: 8, links: 4 };
  function t(k, o) { var s = _t("pp." + k); return o ? s.replace(/\{(\w+)\}/g, function (_, x) { return o[x]; }) : s; }

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") e.className = attrs[k]; else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]);
    });
    [].concat(kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function tok() { try { return ESNAuth.token(); } catch (e) { return null; } }
  function api(method, body) {
    return fetch("/api/users/me/public-profile", {
      method: method, headers: Object.assign({ Authorization: "Bearer " + tok() }, body ? { "Content-Type": "application/json" } : {}),
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(_E(j.detail) || ("HTTP " + r.status)); return j; });
    });
  }
  function note(el, text, kind) { el.textContent = text || ""; el.className = "ai-set-msg" + (kind ? " " + kind : ""); }
  function field(label, input, hint) {
    return h("label", { class: "ai-set-field" }, [h("span", {}, [label]), input, hint ? h("small", { class: "pp-hint" }, [hint]) : null]);
  }
  function counter(input, max) {
    var c = h("small", { class: "pp-count" });
    function upd() { c.textContent = input.value.length + " / " + max; }
    input.addEventListener("input", upd); upd();
    return c;
  }

  function render() {
    var host = document.getElementById("profile-public-card");
    if (!host) return;
    if (!tok()) { host.textContent = ""; return; }
    api("GET").then(function (s) { build(host, s); }).catch(function (e) { host.textContent = e.message; });
  }

  function linkRow(l) {
    var label = h("input", { class: "text-input", type: "text", maxlength: "40", placeholder: t("linkLabelPh") });
    var url = h("input", { class: "text-input", type: "url", maxlength: "300", placeholder: "https://github.com/…", inputmode: "url" });
    label.value = (l && l.label) || ""; url.value = (l && l.url) || "";
    var row = h("div", { class: "pp-link-row" }, [label, url,
      h("button", { type: "button", class: "btn-action pp-link-del", "aria-label": t("linkDel"), title: t("linkDel"),
        onclick: function () { row.remove(); } }, [h("i", { class: "fa-solid fa-trash", "aria-hidden": "true" })])]);
    row._val = function () { return { label: label.value.trim(), url: url.value.trim() }; };
    return row;
  }

  function toggle(key, s) {
    var cb = h("input", { type: "checkbox" }); cb.checked = !!s[key]; cb.dataset.k = key;
    return h("label", { class: "ai-set-check pp-toggle" }, [cb, h("span", {}, [h("strong", {}, [t("t_" + key)]), h("small", {}, [t("t_" + key + "_d")])])]);
  }

  function build(host, s) {
    host.textContent = "";
    var bio = h("textarea", { class: "text-input pp-bio", rows: "3", maxlength: String(LIMITS.bio), placeholder: t("bioPh") }); bio.value = s.bio || "";
    var loc = h("input", { class: "text-input", type: "text", maxlength: String(LIMITS.location), placeholder: t("locationPh") }); loc.value = s.location || "";
    var skills = h("input", { class: "text-input", type: "text", placeholder: t("skillsPh") }); skills.value = (s.skills || []).join(", ");
    var chips = h("div", { class: "pp-chips" });
    function drawChips() {
      chips.textContent = "";
      skills.value.split(/[,;]/).map(function (x) { return x.trim(); }).filter(Boolean).slice(0, LIMITS.skills)
        .forEach(function (x) { chips.appendChild(h("span", { class: "pp-chip" }, [x.slice(0, 30)])); });
    }
    skills.addEventListener("input", drawChips); drawChips();

    var links = h("div", { class: "pp-links" });
    (s.links || []).forEach(function (l) { links.appendChild(linkRow(l)); });
    var addLink = h("button", { type: "button", class: "btn-action" }, [h("i", { class: "fa-solid fa-plus", "aria-hidden": "true" }), " " + t("linkAdd")]);
    addLink.addEventListener("click", function () {
      if (links.children.length >= LIMITS.links) { note(msg, t("linksMax", { n: LIMITS.links }), "err"); return; }
      links.appendChild(linkRow()); links.lastChild.querySelector("input").focus();
    });

    var state = h("p", { class: "pp-state" });
    function drawState(pub) {
      state.className = "pp-state " + (pub ? "on" : "off");
      state.textContent = "";
      state.appendChild(h("i", { class: "fa-solid " + (pub ? "fa-eye" : "fa-lock"), "aria-hidden": "true" }));
      state.appendChild(document.createTextNode(" " + (pub ? t("stateOn") : t("stateOff"))));
    }
    drawState(s.profile_public);

    var toggles = h("div", { class: "pp-toggles" }, ["profile_public", "show_activity", "show_courses", "allow_invites"].map(function (k) { return toggle(k, s); }));
    toggles.querySelector('[data-k="profile_public"]').addEventListener("change", function (e) { drawState(e.target.checked); });

    var msg = h("p", { class: "ai-set-msg" });
    var save = h("button", { type: "button", class: "btn-action primary" }, [h("i", { class: "fa-solid fa-floppy-disk", "aria-hidden": "true" }), " " + t("save")]);
    var preview = h("a", { class: "btn-action", href: "#u/" + encodeURIComponent(s.login), title: t("previewSoon") },
      [h("i", { class: "fa-solid fa-arrow-up-right-from-square", "aria-hidden": "true" }), " " + t("preview")]);
    preview.addEventListener("click", function (e) {
      if (!window.ESNPublicProfile) { e.preventDefault(); note(msg, t("previewSoon")); }   // strona profilu dojdzie w v62
    });

    save.addEventListener("click", function () {
      var ls = [].map.call(links.children, function (r) { return r._val(); }).filter(function (l) { return l.url || l.label; });
      for (var i = 0; i < ls.length; i++) {
        if (!ls[i].url) { note(msg, t("linkNeedUrl"), "err"); return; }
        if (!/^https?:\/\//i.test(ls[i].url)) { note(msg, _E("Adres musi zaczynać się od http:// lub https://"), "err"); return; }
      }
      var body = { bio: bio.value, location: loc.value, skills: skills.value, links: ls };
      [].forEach.call(toggles.querySelectorAll("input[data-k]"), function (cb) { body[cb.dataset.k] = cb.checked; });
      save.disabled = true; note(msg, t("saving"));
      api("PUT", body).then(function (r) { build(host, r); note(host.querySelector(".ai-set-msg"), t("saved"), "ok"); })
        .catch(function (e) { save.disabled = false; note(msg, e.message, "err"); });
    });

    host.appendChild(h("h3", { class: "ai-set-title" }, [t("title")]));
    host.appendChild(h("p", { class: "ai-set-note" }, [t("intro")]));
    host.appendChild(state);
    host.appendChild(h("section", { class: "ai-set-sec" }, [
      h("h4", {}, [t("aboutH")]),
      field(t("bio"), bio), counter(bio, LIMITS.bio),
      h("div", { class: "ai-set-grid" }, [field(t("location"), loc), field(t("skills"), skills, t("skillsHint", { n: LIMITS.skills }))]),
      chips
    ]));
    host.appendChild(h("section", { class: "ai-set-sec" }, [h("h4", {}, [t("linksH")]), links, h("div", { class: "ai-set-actions" }, [addLink])]));
    host.appendChild(h("section", { class: "ai-set-sec" }, [h("h4", {}, [t("privacyH")]), toggles, h("p", { class: "ai-set-note" }, [t("privacyNote")])]));
    host.appendChild(h("div", { class: "ai-set-actions pp-save" }, [save, preview]));
    host.appendChild(msg);
  }

  window.ESNProfileSettings = { render: render };
  document.addEventListener("esn-lang", function () { if (document.getElementById("profile-public-card")) render(); });
})();
