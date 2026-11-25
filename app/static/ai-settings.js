/* ESN – ustawienia asystenta AI w Profilu: limit dzienny, własny klucz (chmura), model lokalny (Ollama/LM Studio).
 * Wszystkie teksty w jednym obiekcie T (przygotowane pod tłumaczenie PL/EN). Kolory wyłącznie ze zmiennych CSS.
 */
(function () {
  "use strict";
  var T = {
    title: "Asystent AI", intro: "Domyślnie korzystasz z klucza platformy z dziennym limitem. Własny klucz API lub model lokalny znoszą limit.",
    usage: "Klucz platformy: wykorzystano {u} z {l} zapytań dzisiaj (limit odnawia się o północy).",
    usageUnl: "Bez dziennego limitu.", usageOwn: "Używasz własnego klucza: {p}{k}. Bez limitu, koszt po stronie Twojego dostawcy.",
    serverOff: "Klucz platformy nie jest skonfigurowany – bez własnego klucza asystent nie odpowie.",
    cloudH: "Własny klucz API (chmura)", provider: "Dostawca", model: "Model (opcjonalnie)", key: "Klucz API",
    keyPh: "Wklej klucz API", keyKeep: "Zapisany ({h}) – zostaw puste, by nie zmieniać",
    cloudNote: "Klucz jest szyfrowany na serwerze i nigdy nie jest wyświetlany ponownie. Zapytania idą przez serwer platformy do wybranego dostawcy.",
    save: "Zapisz", test: "Testuj", remove: "Usuń klucz", saved: "Zapisano ustawienia AI.", removed: "Usunięto własny klucz.",
    confirmRemove: "Usunąć zapisany klucz API? Wrócisz do dziennego limitu platformy.", testing: "Testuję…", testOk: "Połączenie działa. Odpowiedź: ",
    localH: "Model lokalny na tym urządzeniu", localOn: "Używaj modelu lokalnego (Ollama, LM Studio…)",
    localUrl: "Adres serwera", localModel: "Nazwa modelu", localModelPh: "np. llama3.1:8b",
    localNote: "Zapytania idą bezpośrednio z Twojej przeglądarki do Twojego komputera – serwer platformy ich nie widzi i nie liczy do limitu. Ustawienie dotyczy tylko tego urządzenia.",
    localHow: "Jak uruchomić", localHowBody: "1) Uruchom Ollamę z modelem (np. „ollama run llama3.1:8b”).  2) Zezwól stronie na dostęp: ustaw zmienną OLLAMA_ORIGINS=https://esn.rs-projects.ovh (albo * na czas prób) i zrestartuj Ollamę.  3) Wpisz adres (domyślnie http://localhost:11434) i nazwę modelu, kliknij „Testuj połączenie”. W LM Studio włącz serwer lokalny i CORS, adres zwykle http://localhost:1234.",
    localSaved: "Zapisano ustawienia lokalne.", testLocal: "Testuj połączenie", needModel: "Podaj nazwę modelu.", loginNeeded: "Zaloguj się, aby zmienić ustawienia AI."
  };

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") e.className = attrs[k]; else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]);
    });
    [].concat(kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function tok() { try { return localStorage.getItem("token"); } catch (e) { return null; } }
  function api(path, method, body) {
    return fetch(path, { method: method || "GET", headers: Object.assign({ Authorization: "Bearer " + tok() }, body ? { "Content-Type": "application/json" } : {}), body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.detail || ("HTTP " + r.status)); return j; }); });
  }
  function note(el, text, kind) { el.textContent = text || ""; el.className = "ai-set-msg" + (kind ? " " + kind : ""); }
  function fmt(s, o) { return s.replace(/\{(\w+)\}/g, function (_, k) { return o[k]; }); }
  function field(label, input) { return h("label", { class: "ai-set-field" }, [h("span", {}, [label]), input]); }

  function render(flash) {
    var host = document.getElementById("ai-settings-card");
    if (!host) return;
    if (!tok()) { host.textContent = T.loginNeeded; return; }
    api("/api/ai/status").then(function (s) { build(host, s, flash); }).catch(function (e) { host.textContent = e.message; });
  }

  function build(host, s, flash) {
    host.textContent = "";
    var usage = h("p", { class: "ai-set-usage" });
    if (s.own_key) usage.textContent = fmt(T.usageOwn, { p: (s.providers[s.own_provider] || {}).name || s.own_provider, k: s.own_model ? " · " + s.own_model : "" });
    else if (s.limit == null) usage.textContent = T.usageUnl;
    else usage.textContent = fmt(T.usage, { u: s.used, l: s.limit });
    var bar = null;
    if (!s.own_key && s.limit != null) {
      bar = h("div", { class: "ai-set-bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(s.limit), "aria-valuenow": String(s.used) },
        [h("div", { class: "ai-set-bar-fill" })]);
      bar.firstChild.style.width = Math.min(100, s.limit ? (100 * s.used / s.limit) : 100) + "%";
    }

    // ── chmura ──
    var sel = h("select", { class: "text-input" });
    Object.keys(s.providers).forEach(function (k) { var o = h("option", { value: k }, [s.providers[k].name]); if (k === (s.own_provider || "gemini")) o.selected = true; sel.appendChild(o); });
    var model = h("input", { class: "text-input", type: "text", maxlength: "80", autocomplete: "off", spellcheck: "false" });
    model.value = s.own_model || "";
    function defModel() { model.placeholder = (s.providers[sel.value] || {}).model || ""; }
    sel.addEventListener("change", defModel); defModel();
    var key = h("input", { class: "text-input", type: "password", autocomplete: "new-password", maxlength: "300", spellcheck: "false" });
    key.placeholder = s.own_key ? fmt(T.keyKeep, { h: s.key_hint || "…" }) : T.keyPh;
    var msgC = h("div", { class: "ai-set-msg", role: "status" });
    var bSave = h("button", { class: "btn-action primary", type: "button" }, [T.save]);
    var bTest = h("button", { class: "btn-action", type: "button" }, [T.test]);
    var bDel = h("button", { class: "btn-action ai-set-danger", type: "button" }, [T.remove]);
    bSave.addEventListener("click", function () {
      note(msgC, "");
      api("/api/users/me/ai-settings", "PUT", { provider: sel.value, model: model.value, api_key: key.value }).then(function () { render(T.saved); })
        .catch(function (e) { note(msgC, e.message, "err"); });
    });
    bTest.addEventListener("click", function () {
      note(msgC, T.testing);
      api("/api/ai/test", "POST").then(function (r) { note(msgC, T.testOk + r.reply, "ok"); }).catch(function (e) { note(msgC, e.message, "err"); });
    });
    bDel.addEventListener("click", function () {
      if (!confirm(T.confirmRemove)) return;
      api("/api/users/me/ai-settings", "DELETE").then(function () { render(T.removed); }).catch(function (e) { note(msgC, e.message, "err"); });
    });
    if (flash) note(msgC, flash, "ok");
    var cloud = h("section", { class: "ai-set-sec" }, [
      h("h4", {}, [T.cloudH]),
      h("div", { class: "ai-set-grid" }, [field(T.provider, sel), field(T.model, model)]),
      field(T.key, key),
      h("p", { class: "ai-set-note" }, [T.cloudNote]),
      h("div", { class: "ai-set-actions" }, [bSave].concat(s.own_key ? [bTest, bDel] : [])), msgC
    ]);

    // ── lokalny ──
    var L = window.ESNAILocal ? window.ESNAILocal.get() : { enabled: false, url: "http://localhost:11434", model: "" };
    var on = h("input", { type: "checkbox", id: "ai-local-on" }); on.checked = L.enabled;
    var url = h("input", { class: "text-input", type: "text", autocomplete: "off", spellcheck: "false" }); url.value = L.url;
    var lm = h("input", { class: "text-input", type: "text", autocomplete: "off", spellcheck: "false", placeholder: T.localModelPh }); lm.value = L.model;
    var msgL = h("div", { class: "ai-set-msg", role: "status" });
    function saveLocal() { return window.ESNAILocal.set({ enabled: on.checked, url: url.value, model: lm.value }); }
    var bLs = h("button", { class: "btn-action primary", type: "button" }, [T.save]);
    var bLt = h("button", { class: "btn-action", type: "button" }, [T.testLocal]);
    bLs.addEventListener("click", function () {
      if (on.checked && !lm.value.trim()) { note(msgL, T.needModel, "err"); return; }
      var c = saveLocal(); url.value = c.url; note(msgL, T.localSaved, "ok");
    });
    bLt.addEventListener("click", function () {
      if (!lm.value.trim()) { note(msgL, T.needModel, "err"); return; }
      saveLocal(); note(msgL, T.testing);
      window.ESNAILocal.test().then(function (r) { note(msgL, T.testOk + r.slice(0, 80), "ok"); }).catch(function (e) { note(msgL, e.message, "err"); });
    });
    var local = h("section", { class: "ai-set-sec" }, [
      h("h4", {}, [T.localH]),
      h("label", { class: "ai-set-check" }, [on, h("span", {}, [T.localOn])]),
      h("div", { class: "ai-set-grid" }, [field(T.localUrl, url), field(T.localModel, lm)]),
      h("p", { class: "ai-set-note" }, [T.localNote]),
      h("details", { class: "ai-set-how" }, [h("summary", {}, [T.localHow]), h("p", {}, [T.localHowBody])]),
      h("div", { class: "ai-set-actions" }, [bLs, bLt]), msgL
    ]);

    host.appendChild(h("h3", { class: "ai-set-title" }, [T.title]));
    host.appendChild(h("p", { class: "ai-set-note" }, [T.intro]));
    host.appendChild(usage);
    if (bar) host.appendChild(bar);
    if (!s.server_configured && !s.own_key) host.appendChild(h("p", { class: "ai-set-msg err" }, [T.serverOff]));
    host.appendChild(cloud);
    host.appendChild(local);
  }

  window.ESNAISettings = { render: render };
})();
