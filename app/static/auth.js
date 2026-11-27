/* ESN – stan logowania w przeglądarce (v60).
 * Sesja jest WYŁĄCZNIE w ciasteczku HttpOnly (esn_access_token) – skrypty strony nie mają do niego dostępu, więc ewentualny
 * błąd XSS nie wykradnie sesji. Serwer wstrzykuje dane zalogowanego do window.ESN_USER ({sub, role, user_id, exp}).
 *   ESNAuth.loggedIn(), .user, .role()
 *   ESNAuth.token() – PSEUDO-token (nie jest JWT serwera): ten sam kształt "x.<payload>.x", żeby dotychczasowy kod mógł
 *                     odczytać rolę i id; owinięty fetch (i18n.js) usuwa go z nagłówka Authorization przed wysłaniem.
 *   ESNAuth.setFromJwt(jwt) – po zalogowaniu (odczyt samych danych z odpowiedzi; tokenu nigdzie nie zapisujemy)
 *   ESNAuth.clear() – po wylogowaniu */
(function (global) {
  "use strict";
  var user = global.ESN_USER || null;
  try { global.localStorage.removeItem("token"); } catch (e) { /* tryb prywatny */ }   // dawny token z wersji < v60 – usuwamy
  function b64(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function valid() { return !!user && (!user.exp || user.exp * 1000 > Date.now()); }
  global.ESNAuth = {
    get user() { return valid() ? user : null; },
    loggedIn: valid,
    role: function () { return valid() ? user.role : null; },
    token: function () { return valid() ? "esn." + b64(user) + ".cookie" : null; },
    setFromJwt: function (jwt) {
      try {
        var p = JSON.parse(decodeURIComponent(escape(atob(String(jwt).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))));
        user = { sub: p.sub, role: p.role, user_id: p.user_id, exp: p.exp };
      } catch (e) { user = null; }
    },
    clear: function () { user = null; }
  };
})(window);
