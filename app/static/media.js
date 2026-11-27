/* ESN Media – galeria, lightbox z powiększaniem i menedżer zdjęć (v1).
 *
 * API:
 *   ESNMedia.collage(el, items, {onOpen})                 – mozaika (jak dotąd) → klik otwiera lightbox
 *   ESNMedia.mountGallery(slot, ownerType, ownerId, {fallback})   – pobiera listę z API i rysuje kolaż
 *   ESNMedia.openLightbox(items, index)                   – podgląd z zoomem, przeciąganiem, gestami
 *   ESNMedia.manager(el, {ownerType, ownerId, roles})     – panel wgrywania/zarządzania (ownerId=null → tryb
 *                                                           „oczekujące”, wgrywane po zapisie przez ctl.flush(id))
 * items: [{url, caption, role}]  (url: "/static/…" albo ścieżka względem static/)
 * Cały tekst z danych trafia do DOM przez textContent.
 */
(function (global) {
  "use strict";

  var ROLE_LABELS = { main: _t('md.glowne'), gallery: _t('md.galeria'), schematic: _t('md.schemat'), pinout: _t('md.pinout') };
  var ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  var ALLOWED_EXT = /\.(jpe?g|png|webp|gif)$/i;

  function h(tag, props, kids) {
    var e = document.createElement(tag), k;
    for (k in (props || {})) {
      if (k === "icon" || k === "iconEnd") continue;
      else if (k === "class") e.className = props[k];
      else if (k === "text") e.textContent = props[k];
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), props[k]);
      else e.setAttribute(k, props[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    if (props && props.icon) e.insertBefore(faIcon(props.icon), e.firstChild);   // v50: ikona Font Awesome (icon / iconEnd)
    if (props && props.iconEnd) e.appendChild(faIcon(props.iconEnd));
    return e;
  }
  function faIcon(n) { var i = document.createElement("i"); i.className = "fa-solid fa-" + n; i.setAttribute("aria-hidden", "true"); return i; }
  function notify(msg, type) { if (typeof global.toast === "function") global.toast(msg, type || "info"); else global.alert(msg); }
  function srcOf(u) { u = String(u || ""); return /^(\/|https?:|blob:|data:)/i.test(u) ? u : "/static/" + u; }
  function labelOf(it) { return it.caption || ROLE_LABELS[it.role] || ""; }
  function fmtMB(n) { return (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + " MB"; }

  /* ── API ─────────────────────────────────────────────────────────────── */
  function authHeaders() { var t = ESNAuth.token(); return t ? { Authorization: "Bearer " + t } : {}; }
  function json(res) {
    return res.json().catch(function () { return {}; }).then(function (d) {
      if (!res.ok) {
        var msg = typeof d.detail === "string" ? _E(d.detail) : res.status === 401 ? _t('md.sesjaWygaslaZalogujSie') : _t('md.bladSerwera') + res.status + ")";
        throw new Error(msg);
      }
      return d;
    });
  }
  var api = {
    list: function (type, id) { return fetch("/api/media?owner_type=" + type + "&owner_id=" + id).then(json); },
    limits: function (type, id) { return fetch("/api/media/limits?owner_type=" + type + "&owner_id=" + (id || 0), { headers: authHeaders() }).then(json); },
    patch: function (id, data) {
      return fetch("/api/media/" + id, { method: "PATCH", headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()), body: JSON.stringify(data) }).then(json);
    },
    reorder: function (type, id, ids) {
      return fetch("/api/media/reorder", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()), body: JSON.stringify({ owner_type: type, owner_id: id, ids: ids }) }).then(json);
    },
    remove: function (id) { return fetch("/api/media/" + id, { method: "DELETE", headers: authHeaders() }).then(json); },
    upload: function (type, id, file, role, caption, onProgress) {
      return new Promise(function (resolve, reject) {
        var fd = new FormData(), xhr = new XMLHttpRequest();
        fd.append("owner_type", type); fd.append("owner_id", id); fd.append("role", role || "gallery");
        fd.append("caption", caption || ""); fd.append("file", file);
        xhr.open("POST", "/api/media");
        xhr.setRequestHeader("X-ESN-Req", "1");   // v60: sesja w ciasteczku HttpOnly + ochrona CSRF (XHR nie przechodzi przez owinięty fetch)
        xhr.setRequestHeader("X-ESN-Lang", (window.ESNI18n && ESNI18n.lang) ? ESNI18n.lang() : "pl");
        xhr.upload.onprogress = function (e) { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
        xhr.onload = function () {
          var d = {}; try { d = JSON.parse(xhr.responseText); } catch (e) {}
          if (xhr.status >= 200 && xhr.status < 300) resolve(d);
          else reject(new Error(typeof d.detail === "string" ? _E(d.detail) : xhr.status === 413 ? _t('md.plikJestZaDuzy') : xhr.status === 401 ? _t('md.sesjaWygaslaZalogujSie') : _t('md.bladWgrywania') + xhr.status + ")"));
        };
        xhr.onerror = function () { reject(new Error(_t('md.bladPolaczenia'))); };
        xhr.send(fd);
      });
    }
  };

  /* ── Lightbox ────────────────────────────────────────────────────────── */
  var LB = null;
  function openLightbox(items, index) {
    items = (items || []).filter(function (i) { return i && i.url; });
    if (!items.length) return;
    closeLightbox();
    var prevFocus = document.activeElement;
    var st = { i: Math.max(0, Math.min(index || 0, items.length - 1)), s: 1, x: 0, y: 0 }, ptrs = {}, pinch = null, drag = null;
    var img = h("img", { "class": "esn-lb-img", alt: "", draggable: "false" });
    var stage = h("div", { "class": "esn-lb-stage" }, [img]);
    var cap = h("div", { "class": "esn-lb-cap" }), cnt = h("span", { "class": "esn-lb-cnt" });
    var thumbs = h("div", { "class": "esn-lb-thumbs" });
    function btn(ic, label, fn, cls) { return h("button", { type: "button", "class": "esn-lb-btn " + (cls || ""), "aria-label": label, title: label, icon: ic, onclick: fn }); }   // ic = nazwa ikony FA (v50)
    var zoomOut = btn("minus", _t('md.pomniejsz'), function () { zoom(1 / 1.4); });
    var zoomIn = btn("plus", _t('md.powieksz'), function () { zoom(1.4); });
    var fit = btn("expand", _t('md.dopasujDoEkranu0'), function () { reset(); });
    var close = btn("xmark", _t('md.zamknijEsc'), closeLightbox);
    var prev = btn("chevron-left", _t('md.poprzednieZdjecie'), function () { go(-1); }, "esn-lb-nav esn-lb-prev");
    var next = btn("chevron-right", _t('md.nastepneZdjecie'), function () { go(1); }, "esn-lb-nav esn-lb-next");
    var root = h("div", { "class": "esn-lb", role: "dialog", "aria-modal": "true", "aria-label": _t('md.podgladZdjecia') }, [
      h("div", { "class": "esn-lb-top" }, [cnt, h("div", { "class": "esn-lb-tools" }, [zoomOut, zoomIn, fit, close])]),
      prev, next, stage, cap, thumbs
    ]);
    items.forEach(function (it, n) {
      var t = h("button", { type: "button", "class": "esn-lb-th", "aria-label": _t('md.zdjecie') + " " + (n + 1), onclick: function () { show(n); } }, [h("img", { src: srcOf(it.url), alt: "", loading: "lazy" })]);
      thumbs.appendChild(t);
    });
    if (items.length < 2) { prev.hidden = next.hidden = true; thumbs.hidden = true; }

    function limits() {
      var mx = Math.max(0, (img.offsetWidth * st.s - stage.clientWidth) / 2), my = Math.max(0, (img.offsetHeight * st.s - stage.clientHeight) / 2);
      st.x = Math.max(-mx, Math.min(mx, st.x)); st.y = Math.max(-my, Math.min(my, st.y));
    }
    function apply() {
      limits();
      img.style.transform = "translate(" + st.x + "px," + st.y + "px) scale(" + st.s + ")";
      stage.classList.toggle("zoomed", st.s > 1);
      zoomOut.disabled = st.s <= 1; zoomIn.disabled = st.s >= 8;
    }
    function reset() { st.s = 1; st.x = st.y = 0; apply(); }
    function zoomAt(f, cx, cy) {
      var r = stage.getBoundingClientRect(), px = cx - (r.left + r.width / 2), py = cy - (r.top + r.height / 2);
      var s2 = Math.max(1, Math.min(8, st.s * f)); f = s2 / st.s;
      st.x = px - (px - st.x) * f; st.y = py - (py - st.y) * f; st.s = s2;
      if (st.s === 1) { st.x = st.y = 0; }
      apply();
    }
    function zoom(f) { var r = stage.getBoundingClientRect(); zoomAt(f, r.left + r.width / 2, r.top + r.height / 2); }
    function show(n) {
      st.i = (n + items.length) % items.length; st.s = 1; st.x = st.y = 0;
      var it = items[st.i]; img.classList.add("loading"); img.alt = labelOf(it);
      img.onload = function () { img.classList.remove("loading"); apply(); };
      img.src = srcOf(it.url);
      cap.textContent = labelOf(it); cnt.textContent = (st.i + 1) + " / " + items.length;
      Array.prototype.forEach.call(thumbs.children, function (t, k) { t.classList.toggle("on", k === st.i); if (k === st.i && t.scrollIntoView) t.scrollIntoView({ block: "nearest", inline: "center" }); });
      [1, -1].forEach(function (d) { var o = items[(st.i + d + items.length) % items.length]; if (o) (new Image()).src = srcOf(o.url); });
      apply();
    }
    function go(d) { if (items.length > 1) show(st.i + d); }

    stage.addEventListener("wheel", function (e) {
      e.preventDefault();
      // zoom proporcjonalny do ruchu: płynny na gładziku, ~16% na „tąpnięcie” kółka myszy; ctrl = pinch na gładziku
      var k = e.deltaMode === 1 ? 0.05 : e.ctrlKey ? 0.01 : 0.0015;
      zoomAt(Math.exp(-e.deltaY * k), e.clientX, e.clientY);
    }, { passive: false });
    stage.addEventListener("dblclick", function (e) { if (st.s > 1) reset(); else zoomAt(2.5, e.clientX, e.clientY); });
    stage.addEventListener("pointerdown", function (e) {
      stage.setPointerCapture(e.pointerId); ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(ptrs);
      if (ids.length === 2) { var a = ptrs[ids[0]], b = ptrs[ids[1]]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: st.s }; drag = null; }
      else drag = { x: e.clientX, y: e.clientY, tx: st.x, ty: st.y, sx: e.clientX, sy: e.clientY };
    });
    stage.addEventListener("pointermove", function (e) {
      if (!ptrs[e.pointerId]) return;
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(ptrs);
      if (pinch && ids.length === 2) {
        var a = ptrs[ids[0]], b = ptrs[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
        zoomAt((pinch.s * d / pinch.d) / st.s, (a.x + b.x) / 2, (a.y + b.y) / 2);
      } else if (drag && st.s > 1) { st.x = drag.tx + e.clientX - drag.x; st.y = drag.ty + e.clientY - drag.y; apply(); }
    });
    function up(e) {
      var d = drag; delete ptrs[e.pointerId];
      if (Object.keys(ptrs).length < 2) pinch = null;
      if (d && st.s === 1 && e.type === "pointerup") {          // gest przeciągnięcia (swipe) przy braku powiększenia
        var dx = e.clientX - d.sx, dy = e.clientY - d.sy;
        if (Math.abs(dx) > 60 && Math.abs(dy) < 80) go(dx < 0 ? 1 : -1);
        else if (Math.abs(dx) < 6 && Math.abs(dy) < 6 && e.target === stage) closeLightbox();   // klik w tło zamyka
      }
      if (!Object.keys(ptrs).length) drag = null;
    }
    stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);

    function key(e) {
      if (e.key === "Escape") { e.preventDefault(); closeLightbox(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "+" || e.key === "=") zoom(1.4);
      else if (e.key === "-") zoom(1 / 1.4);
      else if (e.key === "0") reset();
      else if (e.key === "Tab") {                                // pułapka fokusu w oknie dialogowym
        var f = Array.prototype.filter.call(root.querySelectorAll("button"), function (b) { return !b.hidden && !b.disabled; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", key);
    document.body.appendChild(root);
    document.body.classList.add("esn-lb-open");
    LB = { root: root, key: key, prevFocus: prevFocus };
    show(st.i);
    close.focus();
  }
  function closeLightbox() {
    if (!LB) return;
    document.removeEventListener("keydown", LB.key);
    if (LB.root.parentNode) LB.root.parentNode.removeChild(LB.root);
    document.body.classList.remove("esn-lb-open");
    if (LB.prevFocus && LB.prevFocus.focus) { try { LB.prevFocus.focus(); } catch (e) {} }
    LB = null;
  }

  /* ── Kolaż (ten sam wygląd co dotychczas) ────────────────────────────── */
  function collage(el, items, opts) {
    opts = opts || {};
    el.textContent = "";
    items = (items || []).filter(function (i) { return i && i.url; });
    if (!items.length) return 0;
    var max = 4, vis = items.slice(0, max), rest = items.length - max;
    var box = h("div", { "class": "project-collage", "data-count": String(vis.length), style: "margin-bottom: 30px;" });
    vis.forEach(function (it, n) {
      var tile = h("div", { "class": "collage-item", role: "button", tabindex: "0", style: "position: relative;", "aria-label": _t('md.powieksz2') + " " + labelOf(it) }, [
        h("img", { src: srcOf(it.url), alt: labelOf(it), loading: n ? "lazy" : "eager" }),
        n === max - 1 && rest > 0 ? h("div", { "class": "collage-overlay-more", text: "+" + rest }) : null,
        h("div", { "class": "collage-caption", text: labelOf(it) })
      ]);
      var open = function () { (opts.onOpen || openLightbox)(items, n); };
      tile.addEventListener("click", open);
      tile.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
      box.appendChild(tile);
    });
    el.appendChild(box);
    return items.length;
  }

  function mountGallery(slot, ownerType, ownerId, opts) {
    opts = opts || {};
    var fb = (opts.fallback || []).filter(function (x) { return x && x.url; });
    slot.textContent = "";
    return api.list(ownerType, ownerId).then(function (items) {
      if (!slot.isConnected) return;
      if (!items.length && fb.length) items = fb;
      collage(slot, items);
    }).catch(function () { if (slot.isConnected) collage(slot, fb); });
  }

  /* ── Menedżer zdjęć (panel edycji) ───────────────────────────────────── */
  function manager(root, opts) {
    var type = opts.ownerType, ownerId = opts.ownerId || null, roles = opts.roles || ["main", "gallery"];
    var items = [], pending = [], limits = null, busy = 0, dead = false, uid = 0;
    var head = h("div", { "class": "esn-mm-head" }), grid = h("div", { "class": "esn-mm-grid" });
    var input = h("input", { type: "file", multiple: "multiple", accept: ALLOWED.join(","), "class": "esn-mm-input", "aria-label": _t('md.wybierzZdjecia') });
    var drop = h("label", { "class": "esn-mm-drop" }, [h("span", { text: _t('md.przeciagnijZdjeciaTutajLub') }), input]);
    root.textContent = "";
    root.classList.add("esn-mm");
    root.appendChild(head); root.appendChild(drop); root.appendChild(grid);

    function maxFiles() { return limits ? limits.max_files : 20; }
    function maxMB() { return limits ? limits.max_file_mb : 5; }
    function total() { return items.length + pending.length; }
    function hasMain() { return items.concat(pending).some(function (x) { return x.role === "main"; }); }
    function sel(cur, onChange) {
      var s = h("select", { "class": "esn-mm-sel", "aria-label": _t('md.rolaZdjecia') });
      roles.forEach(function (r) { var o = h("option", { value: r, text: ROLE_LABELS[r] || r }); if (r === cur) o.selected = true; s.appendChild(o); });
      s.addEventListener("change", function () { onChange(s.value); });
      return s;
    }
    function ctlBtn(txt, label, fn, dis) {   // txt "fa:<nazwa>" → ikona Font Awesome (v49)
      var fa = /^fa:/.test(txt), b = h("button", { type: "button", "class": "esn-mm-ic", "aria-label": label, title: label, text: fa ? "" : txt, onclick: fn });
      if (fa) { var i = document.createElement("i"); i.className = "fa-solid fa-" + txt.slice(3); i.setAttribute("aria-hidden", "true"); b.appendChild(i); }
      if (dis) b.disabled = true; return b;
    }
    function confirmDel(msg) {
      return typeof global.customConfirm === "function" ? global.customConfirm(msg, _t('md.usuwanieZdjecia')) : Promise.resolve(global.confirm(msg));
    }
    function fail(e) { notify(e.message || String(e), "error"); }

    function renderHead() {
      head.textContent = "";
      head.appendChild(h("strong", { text: _t('md.zdjecia') + " " }));
      head.appendChild(h("span", { "class": "esn-mm-cnt", text: total() + " / " + maxFiles() }));
      var info = _t('md.jpegPngWebpGif') + " " + maxMB() + " MB" + (limits ? " " + _t('md.twojeMiejsce') + " " + limits.used_mb + " z " + limits.quota_mb + " MB" : "");
      head.appendChild(h("div", { "class": "esn-mm-note", text: info }));
      if (!ownerId) head.appendChild(h("div", { "class": "esn-mm-note", text: _t('md.zdjeciaZostanaWgranePo') }));
      drop.classList.toggle("full", total() >= maxFiles());
      input.disabled = total() >= maxFiles();
    }

    function card(it, idx, list, persisted) {
      var c = h("div", { "class": "esn-mm-card" + (it.role === "main" ? " is-main" : "") + (it.err ? " is-err" : "") });
      var src = persisted ? srcOf(it.url) : it.preview;
      var thumb = h("button", { type: "button", "class": "esn-mm-thumb", "aria-label": _t('md.powiekszZdjecie'), onclick: function () {
        openLightbox(list.map(function (x) { return { url: persisted ? x.url : x.preview, caption: x.caption, role: x.role }; }), idx);
      } }, [h("img", { src: src, alt: "", loading: "lazy" })]);
      if (it.role === "main") thumb.appendChild(h("span", { "class": "esn-mm-badge", text: _t('md.glowne') }));
      c.appendChild(thumb);
      c.appendChild(sel(it.role, function (r) {
        if (persisted) api.patch(it.id, { role: r }).then(reload).catch(function (e) { fail(e); reload(); });
        else { if (r === "main") pending.forEach(function (p) { if (p !== it && p.role === "main") p.role = "gallery"; }); it.role = r; render(); }
      }));
      var cap = h("input", { type: "text", "class": "esn-mm-cap", placeholder: _t('md.podpisOpcjonalnie'), maxlength: "300", value: it.caption || "", "aria-label": _t('md.podpisZdjecia') });
      cap.addEventListener("change", function () {
        it.caption = cap.value;
        if (persisted) api.patch(it.id, { caption: cap.value }).catch(fail);
      });
      c.appendChild(cap);
      var row = h("div", { "class": "esn-mm-row" });
      row.appendChild(ctlBtn("fa:chevron-left", _t('md.przesunWczesniej'), function () { move(list, idx, -1, persisted); }, idx === 0));
      row.appendChild(ctlBtn("fa:chevron-right", _t('md.przesunPozniej'), function () { move(list, idx, 1, persisted); }, idx === list.length - 1));
      row.appendChild(h("span", { "class": "esn-mm-sp" }));
      row.appendChild(ctlBtn("fa:trash", _t('md.usunZdjecie'), function () { remove(it, persisted); }));
      c.appendChild(row);
      if (!persisted) {
        c.appendChild(h("div", { "class": "esn-mm-state" + (it.err ? " err" : ""), text: it.err ? it.err : it.prog != null ? _t('md.wgrywanie') + " " + Math.round(it.prog * 100) + "%" : _t('md.oczekujeNaZapis') }));
        if (it.prog != null) { var bar = h("div", { "class": "esn-mm-bar" }, [h("i", { style: "width:" + Math.round(it.prog * 100) + "%" })]); c.appendChild(bar); }
      }
      return c;
    }
    function render() {
      renderHead();
      grid.textContent = "";
      items.forEach(function (it, i) { grid.appendChild(card(it, i, items, true)); });
      pending.forEach(function (it, i) { grid.appendChild(card(it, i, pending, false)); });
    }

    function move(list, i, d, persisted) {
      var j = i + d; if (j < 0 || j >= list.length) return;
      var t = list[i]; list[i] = list[j]; list[j] = t;
      if (persisted) api.reorder(type, ownerId, list.map(function (x) { return x.id; })).then(function (r) { items = r; render(); notify_change(); }).catch(function (e) { fail(e); reload(); });
      else render();
    }
    function remove(it, persisted) {
      confirmDel(_t('md.usunacToZdjecie')).then(function (ok) {
        if (!ok) return;
        if (persisted) api.remove(it.id).then(function () { notify(_t('md.zdjecieUsuniete'), "success"); return reload(); }).catch(fail);
        else { URL.revokeObjectURL(it.preview); pending.splice(pending.indexOf(it), 1); render(); }
      });
    }
    function notify_change() { if (opts.onChange) opts.onChange(items); }
    function reload() {
      if (!ownerId) { render(); return Promise.resolve(); }
      return Promise.all([api.list(type, ownerId), api.limits(type, ownerId).catch(function () { return limits; })]).then(function (r) {
        if (dead) return; items = r[0]; limits = r[1] || limits; render(); notify_change();
      }).catch(fail);
    }

    function validate(f) {
      if (ALLOWED.indexOf(f.type) < 0 && !ALLOWED_EXT.test(f.name)) return "„" + f.name + _t('md.dozwoloneFormatyToJpeg');
      if (f.size > maxMB() * 1048576) return "„" + f.name + _t('md.plikJestWiekszyNiz') + " " + maxMB() + " MB (" + fmtMB(f.size) + ").";
      return null;
    }
    function addFiles(list) {
      var files = Array.prototype.slice.call(list || []), errs = [];
      files.forEach(function (f) {
        var e = validate(f);
        if (!e && total() >= maxFiles()) e = _t('md.osiagnietoLimit') + " " + maxFiles() + " " + _t('md.zdjec');
        if (e) { errs.push(e); return; }
        var role = hasMain() ? "gallery" : "main", rec = { file: f, role: role, caption: "", preview: URL.createObjectURL(f), id: ++uid };
        pending.push(rec);
        if (ownerId) enqueue(rec);
      });
      if (errs.length) notify(errs.slice(0, 3).join("\n") + (errs.length > 3 ? "\n…i " + (errs.length - 3) + " innych" : ""), "warn");
      render();
    }
    // tryb „zapisany obiekt”: wgrywamy od razu, po kolei
    var chain = Promise.resolve();
    function enqueue(rec) {
      busy++;
      chain = chain.then(function () { return send(rec); }).then(function () { busy--; });
    }
    function send(rec) {
      return api.upload(type, ownerId, rec.file, rec.role, rec.caption, function (p) { rec.prog = p; render(); }).then(function () {
        URL.revokeObjectURL(rec.preview); pending.splice(pending.indexOf(rec), 1); return reload();
      }).catch(function (e) { rec.prog = null; rec.err = e.message; render(); fail(e); });
    }

    input.addEventListener("change", function () { addFiles(input.files); input.value = ""; });
    ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
    drop.addEventListener("drop", function (e) { addFiles(e.dataTransfer && e.dataTransfer.files); });

    render();
    api.limits(type, ownerId).then(function (l) { limits = l; render(); }).catch(function () {});
    if (ownerId) reload();

    return {
      hasPending: function () { return pending.length > 0; },
      isBusy: function () { return busy > 0; },
      reload: reload,
      // po pierwszym zapisie nowego obiektu: wgraj oczekujące zdjęcia
      flush: function (newId) {
        ownerId = newId || ownerId;
        var queue = pending.slice(), okCount = 0, failed = [];
        return queue.reduce(function (p, rec) {
          return p.then(function () {
            return api.upload(type, ownerId, rec.file, rec.role, rec.caption, function (pr) { rec.prog = pr; render(); })
              .then(function () { okCount++; URL.revokeObjectURL(rec.preview); pending.splice(pending.indexOf(rec), 1); })
              .catch(function (e) { rec.prog = null; rec.err = e.message; failed.push({ name: rec.file.name, error: e.message }); });
          });
        }, chain).then(function () { return reload(); }).then(function () { return { ok: okCount, failed: failed }; });
      },
      destroy: function () {
        dead = true; pending.forEach(function (p) { URL.revokeObjectURL(p.preview); }); pending = []; items = [];
        root.textContent = ""; root.classList.remove("esn-mm");
      }
    };
  }

  global.ESNMedia = { api: api, collage: collage, mountGallery: mountGallery, openLightbox: openLightbox, closeLightbox: closeLightbox,
    manager: manager, ROLE_LABELS: ROLE_LABELS };
})(window);
