/* ESN – lokalny model AI (Ollama, LM Studio, każdy serwer zgodny z API OpenAI) wywoływany BEZPOŚREDNIO z przeglądarki.
 * Serwer platformy nie widzi tych zapytań i nie liczy ich do limitu. Ustawienia są per urządzenie (localStorage "esn-ai-local"),
 * bo model działa na konkretnym komputerze. Portal i magazyn są pod jedną domeną, więc współdzielą ustawienia.
 * API: window.ESNAILocal = { get(), set(cfg), chat(system, messages), test() }.
 * Ten plik ma identyczną kopię w esn_magazyn/static (pilnuje tego test).
 */
(function () {
  "use strict";
  var KEY = "esn-ai-local", DEF_URL = "http://localhost:11434";

  function normUrl(u) { return String(u || "").trim().replace(/\/+$/, "").replace(/\/v1$/, ""); }
  function validUrl(u) { try { var p = new URL(u).protocol; return p === "http:" || p === "https:"; } catch (e) { return false; } }

  function get() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || "null");
      if (o && typeof o === "object") return { enabled: !!o.enabled, url: normUrl(o.url) || DEF_URL, model: String(o.model || "").trim() };
    } catch (e) { /* tryb prywatny / uszkodzony zapis */ }
    return { enabled: false, url: DEF_URL, model: "" };
  }
  function set(cfg) {
    var c = { enabled: !!cfg.enabled, url: normUrl(cfg.url) || DEF_URL, model: String(cfg.model || "").trim() };
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* ignoruj */ }
    return c;
  }

  function networkHint(url) {
    var isLocalHost = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url);
    if (location.protocol === "https:" && /^http:/i.test(url) && !isLocalHost) {
      return _t('al.przegladarkaBlokujePolaczenieZ');
    }
    return _t('al.nieMoznaPolaczycZ') + " " + url + _t('al.sprawdzCzySerwerModelu') + " " +
      _t('al.orazCzyDlaOllamy');
  }

  function request(path, body, ms) {
    var cfg = get();
    if (!validUrl(cfg.url)) return Promise.reject(new Error(_t('al.nieprawidlowyAdresSerweraLokalnego')));
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, ms || 120000) : null;
    return fetch(cfg.url + path, {
      method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined, signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = JSON.parse(t); } catch (e) { /* nie-JSON */ }
        if (!r.ok) {
          var m = j && j.error ? (j.error.message || j.error) : t.slice(0, 200);
          throw new Error(_t('al.serwerLokalnyHttp') + " " + r.status + "): " + m);
        }
        return j;
      });
    }, function (e) {
      if (e && e.name === "AbortError") throw new Error(_t('al.modelLokalnyNieOdpowiedzial'));
      throw new Error(networkHint(cfg.url));
    }).then(function (j) { if (timer) clearTimeout(timer); return j; }, function (e) { if (timer) clearTimeout(timer); throw e; });
  }

  function chat(system, messages, opts) {
    var cfg = get();
    if (!cfg.model) return Promise.reject(new Error(_t('al.podajNazweModeluLokalnego')));
    var msgs = [{ role: "system", content: String(system || "") }].concat(messages.slice(-(opts && opts.keep || 6)));
    return request("/v1/chat/completions", { model: cfg.model, messages: msgs, temperature: 0.7, stream: false }).then(function (j) {
      var t = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (!t) throw new Error(_t('al.modelLokalnyZwrocilPusta'));
      return t;
    });
  }

  function test() {
    return chat("Odpowiadaj jednym słowem.", [{ role: "user", content: "Napisz: OK" }], { keep: 1 });
  }

  window.ESNAILocal = { get: get, set: set, chat: chat, test: test, DEFAULT_URL: DEF_URL };
})();
