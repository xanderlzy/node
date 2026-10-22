/* node · notes: pages, blocks, sidebar, search, trash */
var NKEY = "node-notes-v1", FKEY = "node-favs-v1", XKEY = "node-exp-v1";
function lj(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v } catch (e) { return d } }
var N = lj(NKEY, []), F = lj(FKEY, []), X = lj(XKEY, {}), view = "home", curPage = null, query = "", PF = null, pendSave = false, saveT, titleT, DRAG = null, POP = null;
if (!Array.isArray(N)) N = []; if (!Array.isArray(F)) F = [];
function E(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") }

/* ---- safe rich text: only a few tags survive, everything else is unwrapped ---- */
var OKT = { B: "b", STRONG: "b", I: "i", EM: "i", U: "u", S: "s", STRIKE: "s", DEL: "s", CODE: "code", A: "a", BR: "br" };
function walkH(n) {
  var o = "";
  n.childNodes.forEach(function (c) {
    if (c.nodeType === 3) { o += esc(c.textContent); return }
    if (c.nodeType !== 1) return;
    var tg = OKT[c.tagName], inner = walkH(c);
    if (tg === "br") o += "<br>";
    else if (tg === "a") { var h = c.getAttribute("href") || "", pm = /^#p:([\w-]+)$/.exec(h); o += pm ? '<a href="#p:' + pm[1] + '" data-p="' + pm[1] + '">' + inner + "</a>" : /^(https?:|mailto:)/i.test(h) ? '<a href="' + esc(h) + '" target="_blank" rel="noopener noreferrer">' + inner + "</a>" : inner }
    else if (tg) o += "<" + tg + ">" + inner + "</" + tg + ">";
    else if (c.tagName === "DIV" || c.tagName === "P") o += (o && !/<br>$/.test(o) ? "<br>" : "") + inner;
    else o += inner;
  });
  return o;
}
function clean(h) { var t = document.createElement("template"); t.innerHTML = h || ""; return walkH(t.content) }
function plain(h) { var t = document.createElement("template"); t.innerHTML = h || ""; return t.content.textContent }
function ctext(t) { return t.innerText !== undefined ? t.innerText : t.textContent }
function tableText(b) { return (b.rows || []).map(function (rw) { return (rw.c || []).map(plain).join(" | ") }).join("\n") }
function blocksText(bs) { return (bs || []).map(function (b) { return b.t === "div" ? "" : b.t === "table" ? tableText(b) : b.t === "code" ? (b.x || "") : plain(b.x) }).join("\n") }

/* ---- model ---- */
function fromBody(it) { return (it.body || "").split("\n").map(function (l, i) { return { id: it.id + "-" + i, t: "p", x: esc(l), n: 0 } }) }
function normItem(it) {
  if (it.type !== "page") it.type = "page";
  if (!Array.isArray(it.blocks) || !it.blocks.length) it.blocks = it.body ? fromBody(it) : [{ id: it.id + "-0", t: "p", x: "", n: 0 }];
  if (it.icon == null) it.icon = ""; if (!it.trashed) it.trashed = 0; if (it.name == null) it.name = "";
  return it;
}
window.normItem = normItem;
N.forEach(normItem);
function mine(it) { return !it.owner || it.owner === window.nodeUid }
function role(it) { if (mine(it)) return "owner"; var a = it.acl || {}; return a[window.nodeEmail] || "viewer" }
function nf(id) { for (var i = 0; i < N.length; i++) if (N[i].id === id) return N[i]; return null }
function live(it, g) { g = g || 0; if (!it || it.trashed) return false; if (!it.parent || g > 40) return true; var p = nf(it.parent); return p ? live(p, g + 1) : true }
function ord(a, b) { var x = a.order == null ? 1e15 : a.order, y = b.order == null ? 1e15 : b.order; if (x !== y) return x < y ? -1 : 1; return (a.name || "~").toLowerCase().localeCompare((b.name || "~").toLowerCase()) }
function kids(id) { return N.filter(function (x) { return (x.parent || null) === id && live(x) }).sort(ord) }
function desc(id) { var o = []; N.forEach(function (x) { if (x.parent === id) { o.push(x.id); o = o.concat(desc(x.id)) } }); return o }
function trail(id) { var a = [], g = 0; while (id && g++ < 40) { var f = nf(id); if (!f) break; a.unshift(f); id = f.parent || null } return a }
function saveN() { try { localStorage.setItem(NKEY, JSON.stringify(N)) } catch (e) {} if (window.nodePush) window.nodePush() }
function saveF() { try { localStorage.setItem(FKEY, JSON.stringify(F)) } catch (e) {} if (window.nodePush) window.nodePush() }
function saveX() { try { localStorage.setItem(XKEY, JSON.stringify(X)) } catch (e) {} }
function touch(p) { p.updated = Date.now(); p.body = blocksText(p.blocks) }
function saveSoon() { pendSave = true; clearTimeout(saveT); saveT = setTimeout(flushSave, 350) }
function flushSave() { clearTimeout(saveT); if (!pendSave) return; pendSave = false; var p = nf(curPage); if (p) { touch(p); saveN(); side() } }
function gb(id) { var p = nf(curPage); if (!p) return null; for (var i = 0; i < p.blocks.length; i++) if (p.blocks[i].id === id) return p.blocks[i]; return null }
function bi(id) { var p = nf(curPage); if (!p) return -1; for (var i = 0; i < p.blocks.length; i++) if (p.blocks[i].id === id) return i; return -1 }
function newB(n, t, x) { return { id: uid(), t: t || "p", x: x || "", n: n || 0 } }

/* ---- small ui helpers ---- */
var DOC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v5h5"/></svg>';
var BIN = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>';
var CHK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
function setIcon(el, it) { if (it.icon) el.textContent = it.icon; else el.innerHTML = DOC }
function toast(msg, act, fn) {
  var t = E("div", "toast", msg);
  if (act) { var b = E("button", null, act); b.onclick = function () { fn(); t.remove() }; t.appendChild(b) }
  document.body.appendChild(t);
  setTimeout(function () { t.classList.add("out"); setTimeout(function () { t.remove() }, 400) }, 4500);
}
function closePop() { if (POP) { POP.remove(); POP = null } document.removeEventListener("click", outside, true) }
function outside(e) { if (POP && !POP.contains(e.target)) closePop() }
function pop(anchor, fill, cls) {
  closePop(); var d = E("div", "popm " + (cls || "")); fill(d); document.body.appendChild(d);
  var r = anchor.getBoundingClientRect();
  d.style.top = Math.max(8, Math.min(r.bottom + 6, innerHeight - d.offsetHeight - 8)) + "px";
  d.style.left = Math.max(8, Math.min(r.left, innerWidth - d.offsetWidth - 8)) + "px";
  POP = d; setTimeout(function () { document.addEventListener("click", outside, true) }, 0);
}
function popBtn(d, label, fn) { var b = E("button", "po", label); b.onclick = function () { closePop(); fn() }; d.appendChild(b); return b }
function drawer(o) { var s = document.getElementById("nside"), c = document.querySelector(".nscrim"); if (s) s.classList.toggle("open", o); if (c) c.classList.toggle("show", o) }

/* ---- navigation ---- */
function openPage(id, focusTitle) {
  flushSave(); closePop(); view = "page"; curPage = id;
  trail(id).slice(0, -1).forEach(function (a) { X[a.id] = true }); saveX();
  drawer(false); rn();
  if (focusTitle) { var t = document.querySelector(".ntitle"); if (t) t.focus() }
}
function goHome() { flushSave(); view = "home"; curPage = null; drawer(false); rn() }
function makePage(name, parent) {
  var sb = kids(parent || null), ov;
  if (sb.length && sb.every(function (x) { return x.order != null })) ov = Math.max.apply(null, sb.map(function (x) { return x.order })) + 1;
  var p = { id: uid(), type: "page", name: name || "", icon: "", blocks: [newB(0)], body: "", parent: parent || null, updated: Date.now(), trashed: 0 };
  if (ov != null) p.order = ov;
  N.push(p); if (parent) { X[parent] = true; saveX() } saveN(); return p;
}
function newPage(parent) { flushSave(); var p = makePage("", parent); openPage(p.id, true) }
function toggleFav(id) { var i = F.indexOf(id); if (i > -1) F.splice(i, 1); else F.push(id); saveF() }
function trashPage(p) {
  flushSave(); p.trashed = Date.now(); var i = F.indexOf(p.id); if (i > -1) { F.splice(i, 1); saveF() }
  saveN(); if (curPage === p.id || desc(p.id).indexOf(curPage) > -1) { curPage = null; view = "home" } rn();
  toast("moved to trash", "undo", function () { p.trashed = 0; saveN(); rn() });
}
function restorePage(p) { p.trashed = 0; if (p.parent) { var q = nf(p.parent); if (!q || !live(q)) p.parent = null } saveN(); rn() }
function purge(ids) { N = N.filter(function (x) { return ids.indexOf(x.id) < 0 }); F = F.filter(function (x) { return ids.indexOf(x) < 0 }); saveN(); saveF() }
function dupPage(p) {
  var c = JSON.parse(JSON.stringify(p));
  c.id = uid(); c.name = (p.name || "untitled") + " (copy)"; c.blocks = c.blocks.map(function (b) { b.id = uid(); return b });
  delete c.order; c.owner = null; c.ownerEmail = ""; c.direct = {}; c.acl = {}; c.memberEmails = []; c.trashed = 0; c.updated = Date.now();
  N.push(c); saveN(); openPage(c.id);
}
var pk = E("div", "sheet");
pk.innerHTML = '<div class="scrim"></div><div class="panel"><div class="ph">move to<button class="x2" aria-label="close">×</button></div><div class="pl" id="pk-list"></div></div>';
document.body.appendChild(pk);
function closePick() { pk.classList.remove("show") }
pk.querySelector(".scrim").onclick = closePick; pk.querySelector(".x2").onclick = closePick;
function openPick(it) {
  var bad = [it.id].concat(desc(it.id)), l = document.getElementById("pk-list"); l.innerHTML = "";
  function row(label, id, d) {
    var b = E("button", "po", label); b.style.paddingLeft = (14 + d * 18) + "px";
    if ((it.parent || null) === id) { b.disabled = true; b.textContent = label + "  (here)" }
    b.onclick = function () { it.parent = id; if (id) { X[id] = true; saveX() } touch(it); saveN(); closePick(); rn() }; l.appendChild(b);
  }
  row("top level", null, 0);
  (function w(p, d) { kids(p).filter(function (x) { return mine(x) && bad.indexOf(x.id) < 0 }).forEach(function (f) { row((f.icon ? f.icon + " " : "") + (f.name || "untitled"), f.id, d); w(f.id, d + 1) }) })(null, 1);
  pk.classList.add("show");
}

/* ---- shell, sidebar ---- */
function rn() {
  var root = document.getElementById("v-notes"); if (!root) return;
  if (!root.firstChild) {
    root.innerHTML = '<div class="nwrap"><div class="nscrim"></div><aside class="nside" id="nside"><input class="nsearch" id="nsearch" placeholder="search  (ctrl k)" autocomplete="off"><button class="nnew" id="nnew">+ new page</button><div id="nlist"></div></aside><section class="nmain" id="nmain"></section></div>';
    root.querySelector(".nscrim").onclick = function () { drawer(false) };
    document.getElementById("nnew").onclick = function () { newPage(null) };
    var s = document.getElementById("nsearch");
    s.oninput = function () { query = s.value.trim().toLowerCase(); side() };
    s.onkeydown = function (e) { if (e.key === "Escape") { s.value = ""; query = ""; side(); s.blur() } };
  }
  side();
  if (view === "page" && nf(curPage)) page(curPage); else if (view === "trash") trashView(); else { view = "home"; curPage = null; home() }
}
function row(it, depth, host, flat) {
  var kd = flat ? [] : kids(it.id), open = !!X[it.id], r = E("div", "nrow" + (curPage === it.id && view === "page" ? " on" : ""));
  r.style.paddingLeft = (6 + depth * 14) + "px";
  var ch = E("button", "chev" + (kd.length ? "" : " ph0") + (open ? " open" : ""), "▸"); ch.setAttribute("aria-label", "expand");
  ch.onclick = function (e) { e.stopPropagation(); X[it.id] = !open; saveX(); side() };
  var ic = E("span", "nico"); setIcon(ic, it);
  r.append(ch, ic, E("span", "nnm", it.name || "untitled"));
  if (mine(it) && !flat) { var ad = E("button", "nadd", "+"); ad.title = "add a sub-page"; ad.setAttribute("aria-label", "add a sub-page"); ad.onclick = function (e) { e.stopPropagation(); newPage(it.id) }; r.appendChild(ad) }
  r.onclick = function () { if (sdSuppress) return; openPage(it.id) };
  if (!flat && mine(it)) { r.dataset.tree = "1"; r.dataset.id = it.id; wireSD(r, it) }
  host.appendChild(r);
  if (open) kd.forEach(function (k) { row(k, depth + 1, host) });
}
function side() {
  var L = document.getElementById("nlist"); if (!L) return; L.innerHTML = "";
  if (query) {
    var res = N.filter(function (x) { return live(x) && ((x.name || "") + " " + (x.body || "")).toLowerCase().indexOf(query) > -1 }).sort(function (a, b) { return (b.updated || 0) - (a.updated || 0) }).slice(0, 30);
    if (!res.length) L.appendChild(E("div", "nhint", "no matches."));
    res.forEach(function (x) {
      var r = E("div", "nrow"), ic = E("span", "nico"), c = E("div", "ncol"); setIcon(ic, x);
      c.appendChild(E("span", "nnm", x.name || "untitled"));
      var b = (x.body || ""), i = b.toLowerCase().indexOf(query);
      if (i > -1) c.appendChild(E("span", "nsn", (i > 20 ? "…" : "") + b.slice(Math.max(0, i - 20), i + 50).replace(/\n/g, " ")));
      r.append(ic, c); r.onclick = function () { openPage(x.id) }; L.appendChild(r);
    });
    return;
  }
  var favs = F.map(nf).filter(function (x) { return x && live(x) });
  if (favs.length) { L.appendChild(E("div", "nsec", "favourites")); favs.forEach(function (x) { row(x, 0, L, true) }) }
  L.appendChild(E("div", "nsec", "pages"));
  var rt = N.filter(function (x) { return mine(x) && !x.parent && live(x) }).sort(ord);
  if (!rt.length) L.appendChild(E("div", "nhint", "no pages yet."));
  rt.forEach(function (x) { row(x, 0, L) });
  var sh = N.filter(function (x) { return !mine(x) && (!x.parent || !nf(x.parent)) && live(x) }).sort(ord);
  if (sh.length) { L.appendChild(E("div", "nsec", "shared with me")); sh.forEach(function (x) { row(x, 0, L) }) }
  var hm = E("div", "nrow" + (view === "home" ? " on" : "")); hm.style.marginTop = "10px"; hm.innerHTML = '<span class="nico">' + DOC + '</span><span class="nnm">home</span>'; hm.onclick = goHome; L.appendChild(hm);
  var tc = N.filter(function (x) { return mine(x) && x.trashed }).length;
  var tr = E("div", "nrow" + (view === "trash" ? " on" : "")); tr.innerHTML = '<span class="nico">' + BIN + '</span><span class="nnm">trash' + (tc ? " · " + tc : "") + "</span>";
  tr.onclick = function () { flushSave(); view = "trash"; curPage = null; drawer(false); rn() }; L.appendChild(tr);
}
function topbar(m) {
  var top = E("div", "ntop"), mb = E("button", "tb s nmenu", "☰"); mb.setAttribute("aria-label", "pages"); mb.onclick = function () { drawer(true) };
  top.appendChild(mb); m.appendChild(top); return top;
}
function ptile(it) {
  var t = E("div", "tile note"), ic = E("div", "ti"); setIcon(ic, it); if (it.icon) ic.style.fontSize = "26px";
  t.append(ic, E("div", "tn", it.name || "untitled"));
  if (!mine(it) && it.ownerEmail) t.appendChild(E("div", "tp", "from " + it.ownerEmail));
  var pv = (it.body || "").trim().slice(0, 140); if (pv) t.appendChild(E("div", "tp", pv));
  var tag = mine(it) ? ((it.memberEmails && it.memberEmails.length) ? " · shared" : "") : (" · " + (role(it) === "editor" ? "can edit" : "view only"));
  t.appendChild(E("div", "ts", new Date(it.updated || Date.now()).toLocaleDateString(undefined, { month: "short", day: "numeric" }).toLowerCase() + tag));
  t.onclick = function () { openPage(it.id) }; return t;
}
function home() {
  var m = document.getElementById("nmain"); m.innerHTML = ""; topbar(m); m.appendChild(E("h1", null, "notes."));
  var all = N.filter(function (x) { return live(x) }).sort(function (a, b) { return (b.updated || 0) - (a.updated || 0) });
  if (!all.length) { m.appendChild(E("div", "empty", "nothing here yet. make your first page.")); var b = E("button", "tb", "+ new page"); b.onclick = function () { newPage(null) }; var w = E("div"); w.style.textAlign = "center"; w.appendChild(b); m.appendChild(w); return }
  m.appendChild(E("div", "nsec", "recent"));
  var g = E("div", "ngrid"); all.slice(0, 12).forEach(function (x) { g.appendChild(ptile(x)) }); m.appendChild(g);
}
function trashView() {
  var m = document.getElementById("nmain"); m.innerHTML = ""; topbar(m); m.appendChild(E("h1", null, "trash."));
  var ts = N.filter(function (x) { return mine(x) && x.trashed }).sort(function (a, b) { return b.trashed - a.trashed });
  if (!ts.length) { m.appendChild(E("div", "empty", "trash is empty.")); return }
  var eb = E("button", "tb s", "empty trash"); eb.style.marginBottom = "14px";
  eb.onclick = function () { if (!confirm("permanently delete everything in the trash?")) return; var ids = []; ts.forEach(function (x) { ids.push(x.id); ids = ids.concat(desc(x.id)) }); purge(ids); rn() };
  m.appendChild(eb);
  ts.forEach(function (x) {
    var r = E("div", "who"), ic = E("span", "nico"); setIcon(ic, x); ic.style.flex = "none";
    var nm = E("span", null, x.name || "untitled"), rs = E("button", "tb s", "restore"), dl = E("button", "tb s", "delete forever");
    rs.onclick = function () { restorePage(x) };
    dl.onclick = function () { if (!confirm("delete this page and its sub-pages forever?")) return; purge([x.id].concat(desc(x.id))); rn() };
    r.append(ic, nm, rs, dl); m.appendChild(r);
  });
}

/* ---- page view ---- */
var EMO = "😀 😎 📚 📝 ✅ 📌 💡 🔥 ⭐ 🎯 📅 🧠 💼 🏠 ✈️ 🍎 🎵 💻 🛒 ❤️ 🌱 🚀 📖 🎓 🧪 📷 🎨 🔧 💰 🕐".split(" ");
function page(id) {
  var p = nf(id), m = document.getElementById("nmain"); m.innerHTML = "";
  var own = mine(p), ro = role(p) === "viewer", tr = !live(p);
  var top = topbar(m), cr = E("div", "crumbs");
  trail(p.id).forEach(function (f, i, a) {
    if (i) cr.appendChild(E("span", "sep", "›"));
    var b = E("button", "crumb" + (i === a.length - 1 ? " on" : ""), (f.icon ? f.icon + " " : "") + (f.name || "untitled")); b.onclick = function () { openPage(f.id) }; cr.appendChild(b);
  });
  top.appendChild(cr);
  var act = E("div", "tbs"), fv = E("button", "tb s", F.indexOf(p.id) > -1 ? "★" : "☆"); fv.title = "favourite"; fv.setAttribute("aria-label", "favourite");
  fv.onclick = function () { toggleFav(p.id); fv.textContent = F.indexOf(p.id) > -1 ? "★" : "☆"; side() }; act.appendChild(fv);
  if (own && !tr) {
    var sh = E("button", "tb s", p.memberEmails && p.memberEmails.length ? "shared" : "share");
    sh.onclick = function () { if (window.nodeShare) window.nodeShare(p); else alert("sign in to share") }; act.appendChild(sh);
  }
  if (!tr) {
    var mo = E("button", "tb s", "⋯"); mo.setAttribute("aria-label", "more");
    mo.onclick = function () {
      pop(mo, function (d) {
        popBtn(d, "add to kanban", function () { addToKanban(p) });
        if (own) { popBtn(d, "duplicate", function () { dupPage(p) }); popBtn(d, "move to…", function () { openPick(p) }); popBtn(d, "move to trash", function () { trashPage(p) }) }
      });
    };
    act.appendChild(mo);
  }
  top.appendChild(act);
  if (tr && own) {
    var bn = E("div", "banner", "this page is in the trash."), rs = E("button", "tb s", "restore"), dl = E("button", "tb s", "delete forever");
    rs.onclick = function () { restorePage(p) }; dl.onclick = function () { if (confirm("delete this page and its sub-pages forever?")) { purge([p.id].concat(desc(p.id))); curPage = null; view = "trash"; rn() } };
    bn.append(rs, dl); m.appendChild(bn);
  }
  if (!own) m.appendChild(E("div", "banner", "shared by " + (p.ownerEmail || "someone") + " · " + (ro ? "view only" : "you can edit")));
  var hd = E("div", "phead"), ic = E("button", "picon"); setIcon(ic, p); ic.setAttribute("aria-label", "page icon");
  if (!ro && !tr) ic.onclick = function () {
    pop(ic, function (d) {
      var g = E("div", "emo"); EMO.forEach(function (e) { var b = E("button", null, e); b.onclick = function () { closePop(); p.icon = e; touch(p); saveN(); rn() }; g.appendChild(b) }); d.appendChild(g);
      if (p.icon) popBtn(d, "remove icon", function () { p.icon = ""; touch(p); saveN(); rn() });
    });
  };
  var ti = E("input", "ntitle"); ti.placeholder = "untitled"; ti.value = p.name || ""; ti.readOnly = ro || tr;
  ti.oninput = function () { p.name = ti.value; p.updated = Date.now(); clearTimeout(titleT); titleT = setTimeout(function () { saveN(); side() }, 350) };
  ti.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); var f = document.querySelector(".blk .bt"); if (f) { f.focus(); caretStart(f) } } };
  hd.append(ic, ti); m.appendChild(hd);
  var host = E("div", "blocks"); host.id = "blocks"; m.appendChild(host);
  host.onclick = function (e) {
    var pa = e.target.closest && e.target.closest("a[data-p]");
    if (pa) { e.preventDefault(); var q = nf(pa.dataset.p); if (q && live(q)) openPage(q.id); return }
    var a = e.target.closest && e.target.closest("a"); if (a && (ro || e.metaKey || e.ctrlKey)) { e.preventDefault(); window.open(a.href, "_blank", "noopener") }
  };
  host.ondragover = function (e) { if (!DRAG) return; e.preventDefault(); clearDT(); var r = e.target.closest(".blk"); if (r) { var b = r.getBoundingClientRect(); r.classList.add(e.clientY < b.top + b.height / 2 ? "dt" : "db") } };
  host.ondrop = function (e) { if (!DRAG) return; e.preventDefault(); var r = e.target.closest(".blk"); if (r && r.dataset.id !== DRAG) { var b = r.getBoundingClientRect(); moveBlock(DRAG, r.dataset.id, e.clientY >= b.top + b.height / 2) } DRAG = null; clearDT() };
  renderBlocks(host, p, ro || tr);
  if (!ro && !tr) {
    var ab = E("div", "addb"); ab.onclick = function () { var l = p.blocks[p.blocks.length - 1]; if (l && l.t === "p" && !l.x) { PF = { id: l.id, pos: "end" } } else { var nb = newB(0); p.blocks.push(nb); PF = { id: nb.id, pos: "start" }; touch(p); saveN() } renderEditor() }; m.appendChild(ab);
  }
  var sp = kids(p.id);
  if (sp.length || (own && !tr)) {
    m.appendChild(E("div", "nsec", "pages inside"));
    sp.forEach(function (x) { var r = E("div", "nrow big"), c = E("span", "nico"); setIcon(c, x); r.append(c, E("span", "nnm", x.name || "untitled")); r.onclick = function () { openPage(x.id) }; m.appendChild(r) });
    if (own && !tr) { var add = E("button", "tb s", "+ add sub-page"); add.style.marginTop = "8px"; add.onclick = function () { newPage(p.id) }; m.appendChild(add) }
  }
  var bl = backlinks(p.id), cl = cardLinks(p.id);
  if (bl.length || cl.length) {
    m.appendChild(E("div", "nsec", "linked from"));
    bl.forEach(function (x) { var r = E("div", "nrow big"), c = E("span", "nico"); setIcon(c, x); r.append(c, E("span", "nnm", x.name || "untitled")); r.onclick = function () { openPage(x.id) }; m.appendChild(r) });
    cl.forEach(function (x) { var r = E("div", "nrow big"); r.append(E("span", "nico", "▦"), E("span", "nnm", x.c.t), E("span", "nsn", x.col)); r.onclick = function () { if (typeof flashCard === "function") { setTool("kanban"); flashCard(x.c.id) } }; m.appendChild(r) });
  }
  applyPF();
}

/* ---- links: page ↔ page (backlinks), page ↔ kanban card ---- */
function backlinks(id) { return N.filter(function (x) { return x.id !== id && live(x) && (x.blocks || []).some(function (b) { return b.t !== "code" && (b.x || "").indexOf('href="#p:' + id + '"') > -1 }) }) }
function cardLinks(id) {
  var o = []; if (typeof S === "undefined") return o;
  [["todo", "to do"], ["doing", "in progress"], ["done", "done"]].forEach(function (k) { (S[k[0]] || []).forEach(function (c) { if (c.page === id) o.push({ c: c, col: k[1] }) }) });
  return o;
}
function addToKanban(p) {
  var c = { id: uid(), t: p.name || "untitled", sub: [], page: p.id }; S.todo.push(c); save(); render(c.id);
  toast("added to to do", "view", function () { setTool("kanban"); flashCard(c.id) });
}
function pickPage(anchor, cb, newLabel, newCb) {
  pop(anchor, function (d) {
    var inp = E("input", "nsearch"); inp.placeholder = "search pages"; d.appendChild(inp);
    var l = E("div"); d.appendChild(l);
    function paint() {
      l.innerHTML = ""; var q = inp.value.trim().toLowerCase();
      if (newLabel && !q) { var nb = E("button", "po", "+ " + newLabel); nb.onclick = function () { closePop(); newCb() }; l.appendChild(nb) }
      N.filter(function (x) { return live(x) && (!q || (x.name || "").toLowerCase().indexOf(q) > -1) }).sort(function (a, b) { return (b.updated || 0) - (a.updated || 0) }).slice(0, 8).forEach(function (x) {
        var b = E("button", "po", (x.icon ? x.icon + " " : "") + (x.name || "untitled")); b.onclick = function () { closePop(); cb(x) }; l.appendChild(b);
      });
      if (!l.children.length) l.appendChild(E("div", "nhint", "no pages found."));
    }
    inp.oninput = paint; paint(); setTimeout(function () { inp.focus() }, 30);
  });
}
/* inline page links: type @ or [[ in a block */
var MM = { el: null, id: null, items: [], i: 0, len: 0 };
function hideMention() { if (MM.el) MM.el.hidden = true; MM.id = null; MM.i = 0 }
function decorate(t) {
  t.querySelectorAll("a[data-p]").forEach(function (a) {
    a.setAttribute("contenteditable", "false"); var q = nf(a.dataset.p);
    a.textContent = q ? ((q.icon ? q.icon + " " : "") + (q.name || "untitled")) : "unavailable page";
  });
}
function rangeAt(el, s, e) {
  var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nd, pos = 0, r = document.createRange(), a = false;
  while ((nd = w.nextNode())) {
    var L = nd.length;
    if (!a && s <= pos + L) { r.setStart(nd, s - pos); a = true }
    if (a && e <= pos + L) { r.setEnd(nd, e - pos); return r }
    pos += L;
  }
  return r;
}
function mentionCheck(t, bid) {
  var s = getSelection(); if (!s.rangeCount || !s.isCollapsed) { hideMention(); return }
  var r = document.createRange(); r.selectNodeContents(t); r.setEnd(s.anchorNode, s.anchorOffset);
  var before = r.toString(), m = /(?:^|\s)@(\S{0,30})$/.exec(before) || /\[\[([^\]]{0,30})$/.exec(before);
  if (!m) { hideMention(); return }
  var q = m[1].toLowerCase();
  var items = N.filter(function (x) { return live(x) && x.id !== curPage && (!q || (x.name || "").toLowerCase().indexOf(q) > -1) }).sort(function (a, b) { return (b.updated || 0) - (a.updated || 0) }).slice(0, 8);
  if (!items.length) { hideMention(); return }
  if (!MM.el) { MM.el = E("div", "smenu"); document.body.appendChild(MM.el) }
  MM.id = bid; MM.items = items; MM.len = m[0].trim().length; MM.i = Math.min(MM.i, items.length - 1); MM.el.innerHTML = "";
  items.forEach(function (x, k) { var b = E("button", "po" + (k === MM.i ? " on" : ""), (x.icon ? x.icon + " " : "") + (x.name || "untitled")); b.onmousedown = function (e) { e.preventDefault(); pickMention(x) }; MM.el.appendChild(b) });
  var bx = t.getBoundingClientRect(); MM.el.hidden = false;
  MM.el.style.left = Math.max(8, Math.min(bx.left, innerWidth - 232)) + "px"; MM.el.style.top = Math.max(8, Math.min(bx.bottom + 6, innerHeight - 270)) + "px";
}
function pickMention(q) {
  var bid = MM.id, t = document.querySelector('.blk[data-id="' + bid + '"] .bt'); if (!t) return;
  var off = caretOffset(t), len = MM.len; hideMention();
  var rg = rangeAt(t, Math.max(0, off - len), off), s = getSelection(); s.removeAllRanges(); s.addRange(rg);
  var title = (q.icon ? q.icon + " " : "") + (q.name || "untitled");
  document.execCommand("insertHTML", false, '<a href="#p:' + q.id + '" data-p="' + q.id + '">' + esc(title) + "</a>&nbsp;");
  decorate(t); var B = gb(bid); if (B) { B.x = clean(t.innerHTML); saveSoon() }
}

/* ---- drag pages in the sidebar: before / after / into ---- */
var SDG = null, sdSuppress = false;
function sdRows() { return [].slice.call(document.querySelectorAll("#nlist .nrow[data-tree]")) }
function wireSD(r, it) {
  r.onpointerdown = function (e) {
    if (SDG || e.button > 0 || e.target.closest("button")) return;
    SDG = { id: it.id, row: r, pid: e.pointerId, type: e.pointerType, sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY, on: false, tid: null, pos: null };
    if (e.pointerType !== "mouse") SDG.timer = setTimeout(function () { if (SDG && !SDG.on) sdStart() }, 260);
    document.addEventListener("pointermove", sdMove); document.addEventListener("pointerup", sdUp); document.addEventListener("pointercancel", sdUp);
  };
}
function sdStart() {
  var d = SDG; d.on = true; if (typeof buzz === "function") buzz(10);
  var rc = d.row.getBoundingClientRect(), g = d.row.cloneNode(true); g.classList.add("sdghost"); g.style.width = rc.width + "px"; d.ghost = g; d.ox = d.cx - rc.left; d.oy = d.cy - rc.top;
  document.body.appendChild(g); d.row.classList.add("dragging"); document.body.classList.add("dragging"); sdPlace(); sdTick();
}
function sdClear() { document.querySelectorAll("#nlist .dt,#nlist .db,#nlist .into").forEach(function (x) { x.classList.remove("dt", "db", "into") }) }
function sdPlace() {
  var d = SDG; d.ghost.style.transform = "translate(" + (d.cx - d.ox) + "px," + (d.cy - d.oy) + "px)";
  sdClear(); d.tid = null; d.pos = null;
  var bad = [d.id].concat(desc(d.id)), rows = sdRows(), last = null;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i]; if (r === d.row) { last = r; continue }
    var rc = r.getBoundingClientRect(); last = r;
    if (d.cy >= rc.top && d.cy <= rc.bottom) {
      if (bad.indexOf(r.dataset.id) > -1) return;
      var f = (d.cy - rc.top) / rc.height; d.tid = r.dataset.id; d.pos = f < .28 ? "before" : f > .72 ? "after" : "into";
      r.classList.add(d.pos === "before" ? "dt" : d.pos === "after" ? "db" : "into"); return;
    }
  }
  var L = document.getElementById("nlist"), lr = L && L.getBoundingClientRect(), lb = last && last.getBoundingClientRect();
  if (lb && lr && d.cy > lb.bottom && d.cy < lr.bottom + 40 && d.cx >= lr.left && d.cx <= lr.right) { d.tid = null; d.pos = "end"; last.classList.add("db") }
}
function sdTick() {
  var d = SDG; if (!d || !d.on) return;
  var s = document.getElementById("nside"), r = s.getBoundingClientRect();
  if (d.cy < r.top + 50) s.scrollTop -= 10; else if (d.cy > r.bottom - 50) s.scrollTop += 10;
  d.raf = requestAnimationFrame(sdTick);
}
function sdMove(e) {
  var d = SDG; if (!d || e.pointerId !== d.pid) return; d.cx = e.clientX; d.cy = e.clientY;
  if (!d.on) { if (Math.hypot(d.cx - d.sx, d.cy - d.sy) > 6) { if (d.type === "mouse") sdStart(); else sdEnd(false) } return }
  sdPlace();
}
function sdUp(e) { var d = SDG; if (!d || e.pointerId !== d.pid) return; sdEnd(e.type === "pointerup") }
function sdEnd(drop) {
  var d = SDG; if (!d) return; SDG = null; clearTimeout(d.timer); cancelAnimationFrame(d.raf);
  document.removeEventListener("pointermove", sdMove); document.removeEventListener("pointerup", sdUp); document.removeEventListener("pointercancel", sdUp);
  if (!d.on) return;
  if (d.ghost) d.ghost.remove(); d.row.classList.remove("dragging"); document.body.classList.remove("dragging"); sdClear();
  sdSuppress = true; setTimeout(function () { sdSuppress = false }, 60);
  if (drop && d.pos) dropPage(d.id, d.tid, d.pos);
}
function dropPage(id, tid, pos) {
  var m = nf(id); if (!m || !mine(m)) return;
  var t = tid ? nf(tid) : null;
  if (t && (t.id === id || desc(id).indexOf(t.id) > -1)) return;
  var np = null;
  if (pos === "into" && t) { np = t.id; X[t.id] = true; saveX() } else if (t) np = t.parent || null;
  var sibs = kids(np).filter(function (x) { return x.id !== id }), idx;
  if (pos === "into" || !t) idx = sibs.length; else { idx = sibs.findIndex(function (x) { return x.id === t.id }); if (pos === "after") idx++ }
  m.parent = np; m.updated = Date.now(); sibs.splice(idx, 0, m);
  sibs.forEach(function (x, i) { if (mine(x) && x.order !== i) x.order = i });
  saveN(); rn();
}
window.addEventListener("touchmove", function (e) { if (SDG && SDG.on) e.preventDefault() }, { passive: false });

var TYPES = [["p", "text"], ["h1", "heading 1"], ["h2", "heading 2"], ["h3", "heading 3"], ["ul", "bulleted list"], ["ol", "numbered list"], ["todo", "to-do"], ["toggle", "toggle"], ["quote", "quote"], ["callout", "callout"], ["code", "code"], ["table", "table"], ["div", "divider"]];
var PH = { p: "type / for blocks", h1: "heading 1", h2: "heading 2", h3: "heading 3", ul: "list", ol: "list", todo: "to-do", toggle: "toggle", quote: "quote", callout: "callout", code: "code" };
function clearDT() { document.querySelectorAll(".blk.dt,.blk.db").forEach(function (x) { x.classList.remove("dt", "db") }) }
function renderEditor() { var h = document.getElementById("blocks"), p = nf(curPage); if (h && p) { renderBlocks(h, p, h.dataset.ro === "1"); applyPF() } }
function renderBlocks(host, p, ro) {
  host.innerHTML = ""; host.dataset.ro = ro ? "1" : "0";
  var hide = -1, cnt = [0, 0, 0, 0];
  p.blocks.forEach(function (b) {
    b.n = Math.max(0, Math.min(3, b.n || 0));
    if (hide >= 0) { if (b.n > hide) return; hide = -1 }
    if (b.t === "toggle" && !b.o) hide = b.n;
    var k; if (b.t === "ol") { cnt[b.n]++; for (k = b.n + 1; k < 4; k++) cnt[k] = 0 } else { for (k = b.n; k < 4; k++) cnt[k] = 0 }
    host.appendChild(blockRow(b, p, ro, cnt[b.n]));
  });
}
function blockRow(b, p, ro, num) {
  var r = E("div", "blk t-" + b.t + (b.t === "todo" && b.c ? " d" : "")); r.dataset.id = b.id; r.style.paddingLeft = (b.n * 26) + "px";
  if (!ro) {
    var g = E("button", "grip", "⋮⋮"); g.title = "drag to move · click for options"; g.setAttribute("aria-label", "block options"); g.draggable = true;
    g.onclick = function () { blockMenu(g, b.id) };
    g.ondragstart = function (e) { DRAG = b.id; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", b.id); e.dataTransfer.setDragImage(r, 10, 10) } catch (x) {} setTimeout(function () { r.classList.add("dragging") }, 0) };
    g.ondragend = function () { DRAG = null; r.classList.remove("dragging"); clearDT() };
    r.appendChild(g);
  }
  var body = E("div", "bb");
  if (b.t === "div") body.appendChild(E("hr"));
  else if (b.t === "table") body.appendChild(tableEl(b, ro));
  else {
    if (b.t === "ul") body.appendChild(E("span", "mk", ["•", "◦", "▪", "•"][b.n]));
    if (b.t === "ol") body.appendChild(E("span", "mk", num + "."));
    if (b.t === "callout") body.appendChild(E("span", "mk", "ⓘ"));
    if (b.t === "todo") { var ck = E("button", "ck"); ck.innerHTML = CHK; ck.setAttribute("aria-label", "toggle to-do"); ck.disabled = ro; ck.onclick = function () { b.c = !b.c; r.classList.toggle("d", !!b.c); saveSoon() }; body.appendChild(ck) }
    if (b.t === "toggle") { var tg = E("button", "tg" + (b.o ? " open" : ""), "▸"); tg.setAttribute("aria-label", "expand"); tg.onclick = function () { b.o = !b.o; saveSoon(); flushSave(); renderEditor() }; body.appendChild(tg) }
    var t = E("div", "bt"); t.setAttribute("contenteditable", ro ? "false" : "true"); t.dataset.ph = PH[b.t] || "";
    if (b.t === "code") t.textContent = b.x || ""; else { t.innerHTML = clean(b.x); decorate(t) }
    if (!ro) wireText(t, b.id);
    body.appendChild(t);
  }
  r.appendChild(body); return r;
}
function commit() { var p = nf(curPage); if (p) { touch(p); saveN() } renderEditor(); side() }
function caretStart(el) { var r = document.createRange(); r.selectNodeContents(el); r.collapse(true); var s = getSelection(); s.removeAllRanges(); s.addRange(r) }
function caretEnd(el) { var r = document.createRange(); r.selectNodeContents(el); r.collapse(false); var s = getSelection(); s.removeAllRanges(); s.addRange(r) }
function caretAt(el, off) {
  var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n, left = off;
  while ((n = w.nextNode())) { if (left <= n.length) { var r = document.createRange(); r.setStart(n, left); r.collapse(true); var s = getSelection(); s.removeAllRanges(); s.addRange(r); return } left -= n.length }
  caretEnd(el);
}
function caretOffset(el) { var s = getSelection(); if (!s.rangeCount) return 0; var r = document.createRange(); r.selectNodeContents(el); r.setEnd(s.anchorNode, s.anchorOffset); return r.toString().length }
function atStart(el) { var s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return false; var r = document.createRange(); r.selectNodeContents(el); r.setEnd(s.anchorNode, s.anchorOffset); return r.toString().length === 0 }
function applyPF() {
  if (!PF) return; var f = PF; PF = null;
  if (f.cell) { var ce = document.querySelector('.blk[data-id="' + f.id + '"] .tc[data-r="' + f.cell[0] + '"][data-c="' + f.cell[1] + '"]'); if (ce) { ce.focus(); caretEnd(ce) } return }
  var el = document.querySelector('.blk[data-id="' + f.id + '"] .bt, .blk[data-id="' + f.id + '"] .tc'); if (!el) return;
  el.focus(); if (f.pos === "start") caretStart(el); else if (f.pos === "end") caretEnd(el); else caretAt(el, f.pos);
}
function lineEdge(t, up) {
  try {
    var s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return false;
    var rc = s.getRangeAt(0).getClientRects()[0] || t.getBoundingClientRect(), tr = t.getBoundingClientRect(), lh = parseFloat(getComputedStyle(t).lineHeight) || 24;
    return up ? (rc.top - tr.top < lh * .8) : (tr.bottom - rc.bottom < lh * .8);
  } catch (e) { return false }
}
function adj(t, dir) {
  var all = [].slice.call(document.querySelectorAll('#blocks .bt[contenteditable="true"],#blocks .tc[contenteditable="true"]')), i = all.indexOf(t) + dir;
  if (i < 0 || i >= all.length) return false; all[i].focus(); if (dir < 0) caretEnd(all[i]); else caretStart(all[i]); return true;
}
var SHORT = [[/^#\s/, "h1"], [/^##\s/, "h2"], [/^###\s/, "h3"], [/^[-*]\s/, "ul"], [/^1\.\s/, "ol"], [/^\[\s?\]\s/, "todo"], [/^>\s/, "quote"], [/^```/, "code"]];
function shortcut(B, t) {
  var s = t.textContent;
  for (var i = 0; i < SHORT.length; i++) {
    var m = SHORT[i][0].exec(s); if (!m) continue;
    B.t = SHORT[i][1]; B.x = esc(s.slice(m[0].length)); if (B.t === "todo") B.c = false; if (B.t === "code") B.x = s.slice(m[0].length);
    PF = { id: B.id, pos: "start" }; commit(); return true;
  }
  return false;
}
var SM = { el: null, id: null, items: [], i: 0, q: "" };
function hideSlash() { if (SM.el) SM.el.hidden = true; SM.id = null; SM.i = 0 }
function showSlash(id, t, q) {
  var ql = q.toLowerCase(), items = TYPES.filter(function (x) { return !ql || x[1].indexOf(ql) > -1 || x[0].indexOf(ql) === 0 });
  if (!items.length) { hideSlash(); return }
  if (!SM.el) { SM.el = E("div", "smenu"); document.body.appendChild(SM.el) }
  SM.id = id; SM.items = items; SM.q = q; SM.i = Math.min(SM.i, items.length - 1); SM.el.innerHTML = "";
  items.forEach(function (x, k) { var b = E("button", "po" + (k === SM.i ? " on" : ""), x[1]); b.onmousedown = function (e) { e.preventDefault(); pickSlash(x[0]) }; SM.el.appendChild(b) });
  var r = t.getBoundingClientRect(); SM.el.hidden = false;
  SM.el.style.left = Math.max(8, Math.min(r.left, innerWidth - 232)) + "px"; SM.el.style.top = Math.max(8, Math.min(r.bottom + 6, innerHeight - 270)) + "px";
}
function pickSlash(type) {
  var B = gb(SM.id), p = nf(curPage); if (!B) return; hideSlash();
  B.t = type; B.x = ""; if (type === "todo") B.c = false; if (type === "toggle") B.o = true;
  if (type === "table") { makeTable(B, p, ""); PF = { id: B.id, cell: [0, 0] } } else if (type === "div") { var nb = newB(B.n); p.blocks.splice(bi(B.id) + 1, 0, nb); PF = { id: nb.id, pos: "start" } } else PF = { id: B.id, pos: "start" };
  commit();
}
function splitBlock(B, t, p, i) {
  var s = getSelection(), r = s.getRangeAt(0); if (!r.collapsed) { r.deleteContents(); r = s.getRangeAt(0) }
  var tail = document.createRange(); tail.selectNodeContents(t); tail.setStart(r.endContainer, r.endOffset);
  var tmp = document.createElement("div"); tmp.appendChild(tail.extractContents());
  B.x = B.t === "code" ? ctext(t) : clean(t.innerHTML);
  var tx = B.t === "code" ? tmp.textContent : clean(tmp.innerHTML);
  var nt = { h1: "p", h2: "p", h3: "p", quote: "p", callout: "p", toggle: "p" }[B.t] || B.t, nn = B.n || 0;
  if (B.t === "toggle") { B.o = true; nn++ }
  var nb = newB(nn, nt, tx); if (nt === "todo") nb.c = false;
  p.blocks.splice(i + 1, 0, nb); PF = { id: nb.id, pos: "start" }; commit();
}
function backspace(B, t, p, i) {
  if (B.t !== "p") { B.t = "p"; PF = { id: B.id, pos: "start" }; commit(); return }
  if ((B.n || 0) > 0) { B.n--; PF = { id: B.id, pos: "start" }; commit(); return }
  if (i === 0) return;
  var prev = p.blocks[i - 1];
  if (prev.t === "div") { p.blocks.splice(i - 1, 1); PF = { id: B.id, pos: "start" }; commit(); return }
  if (prev.t === "table") { PF = { id: prev.id, cell: [prev.rows.length - 1, prev.rows[0].c.length - 1] }; commit(); return }
  var cx = clean(t.innerHTML), plen = prev.t === "code" ? (prev.x || "").length : plain(prev.x).length;
  prev.x = prev.t === "code" ? (prev.x || "") + plain(cx) : (prev.x || "") + cx;
  p.blocks.splice(i, 1); PF = { id: prev.id, pos: plen }; commit();
}
function wireText(t, bid) {
  t.oninput = function () {
    var B = gb(bid); if (!B) return;
    if (t.innerHTML === "<br>") t.innerHTML = "";
    B.x = B.t === "code" ? ctext(t) : clean(t.innerHTML);
    if (B.t === "p" && shortcut(B, t)) return;
    var m = B.t !== "code" && /^\/(\w*)$/.exec(t.textContent);
    if (m) { hideMention(); showSlash(bid, t, m[1]) } else { hideSlash(); if (B.t !== "code") mentionCheck(t, bid); else hideMention() }
    saveSoon();
  };
  t.onblur = function () { hideSlash(); hideMention(); flushSave() };
  t.onpaste = function (e) {
    e.preventDefault(); var B = gb(bid), p = nf(curPage); if (!B) return;
    var tx = ((e.clipboardData || window.clipboardData).getData("text/plain") || "").replace(/\r/g, ""); if (!tx) return;
    var ls = tx.split("\n"); if (ls.length === 1 || B.t === "code") { document.execCommand("insertText", false, tx); return }
    document.execCommand("insertText", false, ls[0]); B.x = clean(t.innerHTML);
    var add = ls.slice(1).map(function (l) { return newB(B.n, "p", esc(l)) });
    Array.prototype.splice.apply(p.blocks, [bi(bid) + 1, 0].concat(add)); PF = { id: add[add.length - 1].id, pos: "end" }; commit();
  };
  t.onkeydown = function (e) {
    var B = gb(bid), p = nf(curPage), k = e.key; if (!B) return;
    if (MM.id && MM.el && !MM.el.hidden) {
      if (k === "ArrowDown" || k === "ArrowUp") { e.preventDefault(); MM.i = (MM.i + (k === "ArrowDown" ? 1 : MM.items.length - 1)) % MM.items.length; mentionCheck(t, bid); return }
      if (k === "Enter" || k === "Tab") { e.preventDefault(); pickMention(MM.items[MM.i]); return }
      if (k === "Escape") { hideMention(); return }
    }
    if (SM.id && SM.el && !SM.el.hidden) {
      if (k === "ArrowDown" || k === "ArrowUp") { e.preventDefault(); SM.i = (SM.i + (k === "ArrowDown" ? 1 : SM.items.length - 1)) % SM.items.length; showSlash(bid, t, SM.q); return }
      if (k === "Enter" || k === "Tab") { e.preventDefault(); pickSlash(SM.items[SM.i][0]); return }
      if (k === "Escape") { hideSlash(); return }
    }
    var i = bi(bid);
    if (k === "Enter" && !e.isComposing) {
      if (B.t === "code" && !e.shiftKey) return;
      if (B.t === "code" && e.shiftKey) { e.preventDefault(); B.x = ctext(t); var nb0 = newB(B.n); p.blocks.splice(i + 1, 0, nb0); PF = { id: nb0.id, pos: "start" }; commit(); return }
      if (e.shiftKey) return;
      e.preventDefault();
      var txt = t.textContent;
      if (B.t === "p" && txt.trim() === "---") { B.t = "div"; B.x = ""; var nb = newB(B.n); p.blocks.splice(i + 1, 0, nb); PF = { id: nb.id, pos: "start" }; commit(); return }
      if (/^(ul|ol|todo|quote|callout|toggle)$/.test(B.t) && txt === "") { if (B.n > 0) B.n--; else B.t = "p"; PF = { id: B.id, pos: "start" }; commit(); return }
      splitBlock(B, t, p, i); return;
    }
    if (k === "Backspace" && atStart(t)) { e.preventDefault(); backspace(B, t, p, i); return }
    if (k === "Tab") { e.preventDefault(); var pv = p.blocks[i - 1], mx = pv ? (pv.n || 0) + 1 : 0; B.n = Math.max(0, Math.min(3, mx, (B.n || 0) + (e.shiftKey ? -1 : 1))); PF = { id: B.id, pos: caretOffset(t) }; commit(); return }
    if (k === "ArrowUp" && lineEdge(t, true) && adj(t, -1)) { e.preventDefault(); return }
    if (k === "ArrowDown" && lineEdge(t, false) && adj(t, 1)) { e.preventDefault(); return }
  };
}
function moveBlock(id, target, after) {
  var p = nf(curPage), i = bi(id); if (i < 0) return;
  var b = p.blocks.splice(i, 1)[0], j = bi(target); if (j < 0) { p.blocks.splice(i, 0, b); return }
  p.blocks.splice(j + (after ? 1 : 0), 0, b); commit();
}
function blockMenu(anchor, id) {
  var p = nf(curPage);
  pop(anchor, function (d) {
    popBtn(d, "duplicate", function () { var i = bi(id), c = JSON.parse(JSON.stringify(p.blocks[i])); c.id = uid(); p.blocks.splice(i + 1, 0, c); PF = { id: c.id, pos: "end" }; commit() });
    popBtn(d, "move up", function () { var i = bi(id); if (i > 0) { var b = p.blocks.splice(i, 1)[0]; p.blocks.splice(i - 1, 0, b); PF = { id: id, pos: "end" }; commit() } });
    popBtn(d, "move down", function () { var i = bi(id); if (i < p.blocks.length - 1) { var b = p.blocks.splice(i, 1)[0]; p.blocks.splice(i + 1, 0, b); PF = { id: id, pos: "end" }; commit() } });
    popBtn(d, "delete", function () { var i = bi(id); p.blocks.splice(i, 1); if (!p.blocks.length) p.blocks.push(newB(0)); commit() });
    d.appendChild(E("div", "nsec", "turn into"));
    TYPES.forEach(function (x) { popBtn(d, x[1], function () {
      var B = gb(id); if (!B) return;
      if (B.t === "table") { B.x = esc(tableText(B).replace(/\n/g, " ")); delete B.rows; delete B.h }
      if (x[0] === "table") { makeTable(B, p, B.x); PF = { id: id, cell: [0, 0] }; commit(); return }
      B.t = x[0]; if (x[0] === "div") B.x = ""; if (x[0] === "code") B.x = plain(B.x); if (x[0] === "todo") B.c = false; if (x[0] === "toggle") B.o = true; PF = { id: id, pos: "end" }; commit();
    }) });
  });
}

/* ---- tables ---- */
var TC = null;
function newRows(R, C) { var o = []; for (var i = 0; i < R; i++) { var c = []; for (var j = 0; j < C; j++) c.push(""); o.push({ c: c }) } return o }
function makeTable(B, p, txt) {
  B.t = "table"; B.h = true; B.rows = newRows(3, 3); B.rows[0].c[0] = txt || ""; B.x = "";
  if (p.blocks[p.blocks.length - 1] === B) p.blocks.push(newB(B.n));
}
function tableNorm(b) {
  if (!Array.isArray(b.rows) || !b.rows.length) b.rows = newRows(3, 3);
  b.rows = b.rows.slice(0, 100); var C = 1;
  b.rows.forEach(function (rw, i) { if (!rw || !Array.isArray(rw.c)) b.rows[i] = rw = { c: [] }; rw.c = rw.c.slice(0, 12).map(function (x) { return typeof x === "string" ? x : "" }); C = Math.max(C, rw.c.length) });
  b.rows.forEach(function (rw) { while (rw.c.length < C) rw.c.push("") });
}
function focusCell(bid, r, c) { var el = document.querySelector('.blk[data-id="' + bid + '"] .tc[data-r="' + r + '"][data-c="' + c + '"]'); if (el) { el.focus(); caretEnd(el); return true } return false }
function tableOp(bid, op) {
  var B = gb(bid); if (!B) return; tableNorm(B);
  var C = B.rows[0].c.length, r = TC && TC.id === bid ? Math.min(TC.r, B.rows.length - 1) : B.rows.length - 1, c = TC && TC.id === bid ? Math.min(TC.c, C - 1) : C - 1;
  if (op === "addrow") { if (B.rows.length >= 100) return; B.rows.splice(r + 1, 0, { c: newRows(1, C)[0].c }); PF = { id: bid, cell: [r + 1, c] } }
  else if (op === "addcol") { if (C >= 12) return; B.rows.forEach(function (rw) { rw.c.splice(c + 1, 0, "") }); PF = { id: bid, cell: [r, c + 1] } }
  else if (op === "delrow") { if (B.rows.length <= 1) return; B.rows.splice(r, 1); PF = { id: bid, cell: [Math.min(r, B.rows.length - 1), c] } }
  else if (op === "delcol") { if (C <= 1) return; B.rows.forEach(function (rw) { rw.c.splice(c, 1) }); PF = { id: bid, cell: [r, Math.min(c, C - 2)] } }
  else if (op === "head") { B.h = !B.h; PF = { id: bid, cell: [r, c] } }
  commit();
}
function leaveTable(bid, dir) {
  var rows = [].slice.call(document.querySelectorAll("#blocks .blk")), me = document.querySelector('.blk[data-id="' + bid + '"]'), i = rows.indexOf(me) + dir;
  for (; i >= 0 && i < rows.length; i += dir) {
    var t = rows[i].querySelector('.bt[contenteditable="true"]'); if (t) { t.focus(); if (dir < 0) caretEnd(t); else caretStart(t); return }
    var cs = rows[i].querySelectorAll('.tc[contenteditable="true"]'); if (cs.length) { var c = dir < 0 ? cs[cs.length - 1] : cs[0]; c.focus(); caretEnd(c); return }
  }
}
function wireCell(td, bid, r, c) {
  td.onfocus = function () { TC = { id: bid, r: r, c: c } };
  td.onblur = function () { flushSave() };
  td.oninput = function () {
    var B = gb(bid); if (!B || !B.rows[r]) return;
    if (td.innerHTML === "<br>") td.innerHTML = "";
    B.rows[r].c[c] = clean(td.innerHTML); saveSoon();
  };
  td.onpaste = function (e) {
    e.preventDefault(); var B = gb(bid); if (!B) return;
    var tx = ((e.clipboardData || window.clipboardData).getData("text/plain") || "").replace(/\r/g, ""); if (!tx) return;
    if (tx.indexOf("\t") < 0 && tx.indexOf("\n") < 0) { document.execCommand("insertText", false, tx); return }
    var ls = tx.replace(/\n$/, "").split("\n").map(function (l) { return l.split("\t") });
    var C = Math.min(12, Math.max(B.rows[0].c.length, c + Math.max.apply(null, ls.map(function (l) { return l.length }))));
    ls.forEach(function (cells, i) {
      if (r + i >= 100) return; while (B.rows.length <= r + i) B.rows.push({ c: [] });
      cells.forEach(function (v, j) { if (c + j < C) { var rw = B.rows[r + i]; while (rw.c.length <= c + j) rw.c.push(""); rw.c[c + j] = esc(v) } });
    });
    B.rows.forEach(function (rw) { while (rw.c.length < C) rw.c.push("") });
    PF = { id: bid, cell: [r, c] }; commit();
  };
  td.onkeydown = function (e) {
    var B = gb(bid); if (!B) return; var k = e.key, R = B.rows.length, C = B.rows[0].c.length;
    if (k === "Tab") {
      e.preventDefault(); var nr = r, nc = c + (e.shiftKey ? -1 : 1);
      if (nc >= C) { nc = 0; nr++ } if (nc < 0) { nc = C - 1; nr-- }
      if (nr < 0) return;
      if (nr >= R) { if (R >= 100) return; B.rows.push({ c: newRows(1, C)[0].c }); PF = { id: bid, cell: [nr, nc] }; commit(); return }
      focusCell(bid, nr, nc); return;
    }
    if (k === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (r + 1 < R) focusCell(bid, r + 1, c); else if (R < 100) { B.rows.push({ c: newRows(1, C)[0].c }); PF = { id: bid, cell: [r + 1, c] }; commit() }
      return;
    }
    if (k === "ArrowUp" && lineEdge(td, true)) { e.preventDefault(); if (r > 0) focusCell(bid, r - 1, c); else leaveTable(bid, -1); return }
    if (k === "ArrowDown" && lineEdge(td, false)) { e.preventDefault(); if (r < R - 1) focusCell(bid, r + 1, c); else leaveTable(bid, 1); return }
  };
}
function tableEl(b, ro) {
  tableNorm(b);
  var wrap = E("div", "tw"), sc = E("div", "tscroll"), tb = E("table", "ntbl"), tbody = E("tbody");
  b.rows.forEach(function (row, ri) {
    var tr = E("tr");
    row.c.forEach(function (cell, ci) {
      var td = E(b.h && ri === 0 ? "th" : "td", "tc"); td.dataset.r = ri; td.dataset.c = ci;
      td.setAttribute("contenteditable", ro ? "false" : "true"); td.innerHTML = clean(cell); decorate(td);
      if (!ro) wireCell(td, b.id, ri, ci);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  tb.appendChild(tbody); sc.appendChild(tb); wrap.appendChild(sc);
  if (!ro) {
    var bar = E("div", "tbar");
    [["addrow", "+ row"], ["addcol", "+ column"], ["delrow", "– row"], ["delcol", "– column"], ["head", b.h ? "header: on" : "header: off"]].forEach(function (a) {
      var x = E("button", null, a[1]); x.onmousedown = function (e) { e.preventDefault() }; x.onclick = function () { tableOp(b.id, a[0]) }; bar.appendChild(x);
    });
    wrap.appendChild(bar);
  }
  return wrap;
}

/* ---- floating format bar ---- */
var ITB = E("div", "itb"); ITB.hidden = true;
ITB.innerHTML = '<button data-c="bold"><b>b</b></button><button data-c="italic"><i>i</i></button><button data-c="underline"><u>u</u></button><button data-c="strikeThrough"><s>s</s></button><button data-c="code">&lt;/&gt;</button><button data-c="link">link</button>';
document.body.appendChild(ITB);
ITB.onmousedown = function (e) { e.preventDefault() };
ITB.onclick = function (e) {
  var b = e.target.closest("button"); if (!b) return; var c = b.dataset.c, s = getSelection();
  if (c === "code") { var tx = s.toString(); if (tx) document.execCommand("insertHTML", false, "<code>" + esc(tx) + "</code>") }
  else if (c === "link") {
    var rg = s.getRangeAt(0).cloneRange(), u = prompt("link address"); if (!u) return;
    if (!/^(https?:|mailto:)/i.test(u)) u = "https://" + u; s.removeAllRanges(); s.addRange(rg); document.execCommand("createLink", false, u);
  } else document.execCommand(c);
};
document.addEventListener("selectionchange", function () {
  var s = getSelection(); if (!s.rangeCount || s.isCollapsed) { ITB.hidden = true; return }
  var n = s.anchorNode, el = n && (n.nodeType === 3 ? n.parentElement : n), bt = el && el.closest && el.closest('.bt[contenteditable="true"],.tc[contenteditable="true"]');
  if (!bt || bt.closest(".t-code")) { ITB.hidden = true; return }
  var r = s.getRangeAt(0).getBoundingClientRect(); ITB.hidden = false;
  ITB.style.left = Math.max(8, Math.min(innerWidth - 250, r.left + r.width / 2 - 110)) + "px"; ITB.style.top = Math.max(8, r.top - 46) + "px";
});
document.addEventListener("keydown", function (e) {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault(); if (typeof setTool === "function" && TOOL !== "notes") setTool("notes");
    drawer(true); var s = document.getElementById("nsearch"); if (s) s.focus();
  }
  if (e.key === "Escape") { closePick(); closePop() }
});

/* ---- hooks used by auth.js / index.html ---- */
window.nodeNotesApplied = function () {
  N.forEach(normItem); try { localStorage.setItem(NKEY, JSON.stringify(N)) } catch (e) {}
  if (typeof TOOL === "undefined" || TOOL !== "notes") return;
  side();
  var a = document.activeElement;
  if (a && a.closest && a.closest("#v-notes") && (a.isContentEditable || a.tagName === "INPUT" || a.tagName === "TEXTAREA")) return;
  if (curPage && !nf(curPage)) { curPage = null; view = "home" }
  rn();
};
window.notesWipe = function () { N = []; F = []; X = {}; curPage = null; view = "home"; query = ""; try { localStorage.removeItem(NKEY); localStorage.removeItem(FKEY); localStorage.removeItem(XKEY); localStorage.removeItem("node-email") } catch (e) {} rn() };
window.notesFavs = function (f) { F = f; try { localStorage.setItem(FKEY, JSON.stringify(F)) } catch (e) {} side() };
