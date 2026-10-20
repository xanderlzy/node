import { firebaseConfig as cfg } from "./firebase-config.js";
const B = "https://www.gstatic.com/firebasejs/10.14.1/";
const $ = s => document.querySelector(s);
const ls = { get: k => { try { return localStorage.getItem(k) } catch (e) { return null } }, set: (k, v) => { try { localStorage.setItem(k, v) } catch (e) {} }, del: k => { try { localStorage.removeItem(k) } catch (e) {} } };
const configured = !!cfg.apiKey && !/^YOUR/.test(cfg.apiKey);
const ungate = () => document.documentElement.classList.remove("gate");
const MSG = { "auth/invalid-credential": "wrong email or password.", "auth/wrong-password": "wrong email or password.", "auth/user-not-found": "wrong email or password.", "auth/email-already-in-use": "that email already has an account. try signing in.", "auth/weak-password": "use at least 6 characters.", "auth/invalid-email": "that email does not look right.", "auth/too-many-requests": "too many tries. wait a bit.", "auth/network-request-failed": "no connection. try again.", "auth/popup-blocked": "the popup was blocked. allow popups and retry.", "auth/unauthorized-domain": "add this site to authorized domains in firebase." };
let deleting = false, dz = false, fb = {}, auth, db, user = null, mode = "in", dirty = false, timer, unsub, pend = null, pendT = null, closable = false;

/* ---------- ui ---------- */
const A = document.createElement("div");
A.className = "auth";
A.innerHTML = `<div class="acard"><button class="aclose x2" aria-label="close">×</button><img class="logo" src="icon.svg" alt="node"><h2>welcome to node</h2><p>sign in to sync your boards across every device.</p>
<div class="seg" data-m="in"><i></i><button data-m="in" class="on">sign in</button><button data-m="up">sign up</button></div>
<input class="afield" id="a-email" type="email" placeholder="email" autocomplete="email" autocapitalize="none" autocorrect="off" spellcheck="false">
<input class="afield" id="a-pass" type="password" placeholder="password" autocomplete="current-password">
<label class="agree" id="a-agree"><input type="checkbox" id="a-chk"><span>i agree to the <a href="terms.html" target="_blank" rel="noopener">terms</a> and <a href="privacy.html" target="_blank" rel="noopener">privacy policy</a></span></label>
<div class="aerr" id="a-err"></div>
<button class="primary" id="a-go">sign in</button>
<button class="link" id="a-forgot">forgot password?</button>
<button class="sec" id="a-google">continue with google</button>
<button class="link" id="a-guest">continue as guest</button><p class="legal" id="a-note">by continuing you agree to the <a href="terms.html" target="_blank" rel="noopener">terms</a> and <a href="privacy.html" target="_blank" rel="noopener">privacy policy</a>.</p></div>`;
const SH = document.createElement("div");
SH.className = "sheet";
SH.innerHTML = `<div class="scrim"></div><div class="panel"><div class="ph">settings<button class="x2" aria-label="close">×</button></div><div id="sh-body"></div></div>`;
const V = document.createElement("div");
V.className = "auth";
V.innerHTML = '<div class="acard"><img class="logo" src="icon.svg" alt="node"><h2>check your email</h2><p id="v-msg"></p><button class="primary" id="v-ok">i have verified</button><button class="sec" id="v-resend">resend email</button><div class="aerr" id="v-err"></div><button class="link" id="v-out">use a different email</button></div>';
document.body.append(A, SH, V);

const err = m => { $("#a-err").textContent = m || "" };
const busy = b => A.querySelectorAll("button").forEach(x => x.disabled = b);
function setMode(m) {
  mode = m; err("");
  A.querySelector(".seg").dataset.m = m;
  A.querySelectorAll(".seg button").forEach(b => b.classList.toggle("on", b.dataset.m === m));
  $("#a-go").textContent = m === "up" ? "create account" : "sign in";
  $("#a-pass").autocomplete = m === "up" ? "new-password" : "current-password";
  $("#a-forgot").style.display = m === "up" ? "none" : "";
  $("#a-agree").style.display = m === "up" ? "" : "none"; $("#a-note").style.display = m === "up" ? "none" : "";
}
function showAuth(c) { closable = c; A.querySelector(".aclose").style.display = c ? "" : "none"; err(""); A.classList.add("show"); setTimeout(() => $("#a-email").focus(), 300) }
function hideAuth() { A.classList.remove("show"); $("#a-pass").value = "" }
function openSheet() { renderSheet(); SH.classList.add("show") }
function closeSheet() { SH.classList.remove("show"); dz = false }
A.querySelectorAll(".seg button").forEach(b => b.onclick = () => setMode(b.dataset.m));
A.querySelector(".aclose").onclick = hideAuth;
SH.querySelector(".scrim").onclick = closeSheet;
SH.querySelector(".x2").onclick = closeSheet;
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeSheet(); if (closable) hideAuth() } });
$("#a-pass").onkeydown = e => { if (e.key === "Enter") go() };
$("#a-go").onclick = go;
$("#a-google").onclick = google;
$("#a-forgot").onclick = forgot;
$("#a-guest").onclick = () => { ls.set("node-mode", "guest"); hideAuth(); ungate(); renderSheet() };
const setBtn = document.querySelector(".set");
if (setBtn) setBtn.onclick = openSheet;
addEventListener("online", renderSheet); addEventListener("offline", renderSheet);

const status = () => !navigator.onLine ? "offline. will sync when you are back." : dirty ? "syncing..." : "synced across your devices";
function renderSheet() {
  if (dz) return;
  const b = $("#sh-body");
  b.innerHTML = '<div class="acct"><div class="av"></div><div><div class="an"></div><div class="as"></div></div></div><button class="primary" id="sh-btn"></button><p class="fine"></p>';
  const av = b.querySelector(".av"), an = b.querySelector(".an"), as = b.querySelector(".as"), btn = $("#sh-btn"), fine = b.querySelector(".fine");
  if (!configured) { av.textContent = "?"; an.textContent = "sync is not set up"; as.textContent = "add your firebase keys to firebase-config.js."; btn.remove() }
  else if (user) {
    const n = user.email || user.displayName || "node";
    av.textContent = n[0].toLowerCase(); an.textContent = n; as.textContent = status();
    btn.textContent = "sign out"; btn.onclick = signOutNow;
    fine.textContent = "signing out clears tasks from this device. they stay safe in your account.";
  } else {
    av.textContent = "g"; an.textContent = "guest"; as.textContent = "your tasks stay on this device only.";
    btn.textContent = "sign in or sign up to sync"; btn.onclick = () => { closeSheet(); showAuth(true) };
  }
  const T = ["auto", "light", "dark"], cur = ls.get("node-theme") || "auto";
  const ap = document.createElement("div"); ap.className = "appear";
  ap.innerHTML = '<div class="as">appearance</div><div class="seg seg3" style="--i:' + T.indexOf(cur) + '"><i></i>' + T.map(t => '<button data-t="' + t + '"' + (t === cur ? ' class="on"' : '') + '>' + t + '</button>').join("") + '</div>';
  ap.querySelectorAll("button").forEach(x => x.onclick = () => {
    window.setTheme && window.setTheme(x.dataset.t);
    ap.querySelector(".seg").style.setProperty("--i", T.indexOf(x.dataset.t));
    ap.querySelectorAll("button").forEach(y => y.classList.toggle("on", y === x));
  });
  b.querySelector(".acct").after(ap);
  const dt = document.createElement("div"); dt.className = "appear";
  dt.innerHTML = '<div class="as">your data</div>';
  const ex = document.createElement("button"); ex.className = "sec"; ex.textContent = "export my data (json)"; ex.onclick = exportData; dt.appendChild(ex);
  const rm = document.createElement("button"); rm.className = "link"; rm.style.marginTop = "4px";
  if (user) { rm.textContent = "delete account"; rm.onclick = deleteFlow }
  else {
    rm.textContent = "delete data on this device"; let armed = false;
    rm.onclick = () => {
      if (!armed) { armed = true; rm.textContent = "tap again to erase everything"; setTimeout(() => { armed = false; rm.textContent = "delete data on this device" }, 4000); return }
      window.nodeWipe && window.nodeWipe(); armed = false; rm.textContent = "deleted";
    };
  }
  dt.appendChild(rm); ap.after(dt);
  const lg = document.createElement("p"); lg.className = "fine";
  lg.innerHTML = '<a href="privacy.html" target="_blank" rel="noopener">privacy policy</a> · <a href="terms.html" target="_blank" rel="noopener">terms of service</a>';
  b.appendChild(lg);
}
function exportData() {
  const d = window.nodeGet ? window.nodeGet() : {};
  const out = { app: "node", exportedAt: new Date().toISOString(), account: user ? { email: user.email || null, uid: user.uid } : null, kanban: { todo: d.todo || [], doing: d.doing || [], done: d.done || [] }, notes: (window.N || []).filter(x => !x.owner || (user && x.owner === user.uid)).map(x => ({ id: x.id, type: x.type, name: x.name, body: x.body || "", blocks: x.blocks || [], icon: x.icon || "", trashed: x.trashed || 0, parent: x.parent || null, updated: x.updated || null, sharedWith: x.direct || {} })), sharedWithMe: (window.N || []).filter(x => x.owner && !(user && x.owner === user.uid)).map(x => ({ id: x.id, type: x.type, name: x.name, from: x.ownerEmail || null })) };
  const l = document.createElement("a");
  l.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
  l.download = "node-export-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(l.href), 4000);
}
function deleteFlow() {
  dz = true;
  const pw = user.providerData.some(p => p.providerId === "password");
  const b = $("#sh-body");
  b.innerHTML = '<div class="dz"><div class="an">delete your account?</div><p class="as">this permanently deletes your account and every task and note in it, on all your devices. it cannot be undone. export your data first if you want a copy.</p>' + (pw ? '<input class="afield" id="dz-p" type="password" placeholder="your password" autocomplete="current-password">' : '<p class="as">you will be asked to confirm with google.</p>') + '<input class="afield" id="dz-t" placeholder="type delete to confirm" autocomplete="off"><div class="aerr" id="dz-err"></div><button class="primary danger" id="dz-go">delete forever</button><button class="link" id="dz-no">cancel</button></div>';
  $("#dz-no").onclick = () => { dz = false; renderSheet() };
  $("#dz-go").onclick = async () => {
    const e = $("#dz-err"), btn = $("#dz-go"); e.textContent = "";
    if ($("#dz-t").value.trim().toLowerCase() !== "delete") return e.textContent = "type delete to confirm.";
    if (!navigator.onLine) return e.textContent = "you need to be online to delete your account.";
    if (pw && !$("#dz-p").value) return e.textContent = "enter your password.";
    btn.disabled = true;
    try {
      if (pw) await fb.reauthenticateWithCredential(user, fb.EmailAuthProvider.credential(user.email, $("#dz-p").value));
      else await fb.reauthenticateWithPopup(user, new fb.GoogleAuthProvider());
      deleting = true; stopSync();
      const mine = await fb.getDocs(fb.query(fb.collection(db, "items"), fb.where("owner", "==", user.uid)));
      let wb = fb.writeBatch(db), n = 0;
      for (const d of mine.docs) { wb.delete(d.ref); if (++n % 400 === 0) { await wb.commit(); wb = fb.writeBatch(db) } }
      await wb.commit();
      await fb.deleteDoc(fb.doc(db, "users", user.uid));
      await fb.deleteUser(auth.currentUser);
      ls.del("node-uid"); ls.del("node-mode"); window.nodeWipe && window.nodeWipe(); closeSheet();
    } catch (x) {
      deleting = false; if (user && !unsub) startSync(user);
      e.textContent = MSG[x.code] || "could not delete your account. try again."; btn.disabled = false;
    }
  };
}

/* ---------- auth actions ---------- */
async function go() {
  const e = $("#a-email").value.trim(), p = $("#a-pass").value;
  if (!e || !p) return err("enter your email and password.");
  if (mode === "up" && !$("#a-chk").checked) return err("please agree to the terms and privacy policy.");
  err(""); busy(true);
  try { const c = await (mode === "up" ? fb.createUserWithEmailAndPassword : fb.signInWithEmailAndPassword)(auth, e, p); if (mode === "up") fb.sendEmailVerification(c.user).catch(() => {}) }
  catch (x) { err(MSG[x.code] || "something went wrong. try again.") }
  busy(false);
}
async function google() {
  if (mode === "up" && !$("#a-chk").checked) return err("please agree to the terms and privacy policy.");
  err(""); busy(true);
  try { await fb.signInWithPopup(auth, new fb.GoogleAuthProvider()) }
  catch (x) { if (x.code !== "auth/popup-closed-by-user" && x.code !== "auth/cancelled-popup-request") err(MSG[x.code] || "google sign in failed. try again.") }
  busy(false);
}
async function forgot() {
  const e = $("#a-email").value.trim();
  if (!e) return err("type your email first.");
  try { await fb.sendPasswordResetEmail(auth, e); err("reset link sent. check your inbox.") } catch (x) { err(MSG[x.code] || "could not send the link.") }
}
async function signOutNow() {
  if (dirty) { clearTimeout(timer); await Promise.race([flush(), new Promise(r => setTimeout(r, 3000))]) }
  try { await Promise.race([pushNow(), new Promise(r => setTimeout(r, 3000))]) } catch (e) {}
  const wasSynced = ls.get("node-uid") === (user && user.uid);
  stopSync(); user = null; window.nodeUid = null; window.nodeEmail = null;
  ls.del("node-uid"); ls.del("node-mode");
  if (wasSynced && window.nodeWipe) window.nodeWipe();
  closeSheet();
  try { await fb.signOut(auth) } catch (e) {}
}

/* ---------- sync ---------- */
const clone = o => JSON.parse(JSON.stringify(o));
const canon = o => JSON.stringify(o, (k, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v).sort().reduce((r, x) => (r[x] = v[x], r), {}) : v);
function merge(remote, local) {
  const out = clone(remote), ids = new Set();
  out.favs = Array.from(new Set([...(out.favs || []), ...(local.favs || [])]));
  ["todo", "doing", "done"].forEach(k => (out[k] = out[k] || []).forEach(c => ids.add(c.id)));
  ["todo", "doing", "done"].forEach(k => (local[k] || []).forEach(c => { if (!ids.has(c.id)) out[k].push(c) }));
  return out;
}
function push(now) {
  if (!user || !db || deleting) return;
  dirty = true; clearTimeout(timer); timer = setTimeout(flush, now ? 0 : 500); renderSheet();
}
async function flush() {
  if (!user || !db || deleting) return;
  const snap = window.nodeGet(), cmp = JSON.stringify(snap);
  if (legacy && !legacyDone) snap.notes = legacy;
  try { await fb.setDoc(fb.doc(db, "users", user.uid), { board: snap, updatedAt: fb.serverTimestamp() }) } catch (e) { console.warn("sync failed", e) }
  if (JSON.stringify(window.nodeGet()) === cmp) dirty = false;
  renderSheet();
}
function applyIdle(d) {
  pend = d; if (pendT) return;
  (function tryit() {
    const a = document.activeElement;
    const busyNow = (window.drag && window.drag.active) || (a && a.closest && ((a.closest(".list") && (a.isContentEditable || a.tagName === "INPUT")) || (a.closest("#v-notes") && (a.isContentEditable || a.tagName === "INPUT" || a.tagName === "TEXTAREA"))));
    if (busyNow) { pendT = setTimeout(tryit, 900); return }
    pendT = null;
    if (pend && !dirty) window.nodeApply(pend);
    pend = null;
  })();
}
function startSync(u) {
  const fresh = ls.get("node-uid") !== u.uid; let first = true;
  unsub = fb.onSnapshot(fb.doc(db, "users", u.uid), snap => {
    if (snap.metadata.hasPendingWrites) return;
    if (snap.metadata.fromCache && !snap.exists()) return;
    const remote = snap.exists() ? snap.data().board : null;
    if (remote && Array.isArray(remote.notes) && remote.notes.length && legacyDone) { legacy = remote.notes; legacyDone = false; legacyAdded = false; addLegacy() }
    if (first) {
      first = false;
      if (fresh) { ls.set("node-uid", u.uid); window.nodeApply(remote ? merge(remote, window.nodeGet()) : window.nodeGet()); push(true); return }
    }
    if (!remote) { push(true); return }
    if (dirty || canon({ todo: remote.todo, doing: remote.doing, done: remote.done, favs: remote.favs || [] }) === canon(window.nodeGet())) return;
    applyIdle(remote);
  }, e => console.warn("sync error", e));
  startNotes(u);
}
function stopSync() { if (unsub) unsub(); unsub = null; clearTimeout(timer); dirty = false; nsubs.forEach(f => f()); nsubs = []; nready = false; legacy = null; legacyDone = true; clearTimeout(nTimer) }
const needsVerify = u => !u.emailVerified && u.providerData.some(p => p.providerId === "password");
function showVerify(u) { hideAuth(); $("#v-msg").textContent = "we sent a link to " + u.email + ". open it, then come back and tap the button below."; $("#v-err").textContent = ""; V.classList.add("show"); ungate() }
const hideVerify = () => V.classList.remove("show");
$("#v-ok").onclick = async () => {
  const e = $("#v-err"); e.textContent = "";
  try { await user.reload(); await user.getIdToken(true); if (user.emailVerified) onUser(user); else e.textContent = "not verified yet. open the link in your email first." }
  catch (x) { e.textContent = MSG[x.code] || "could not check. try again." }
};
$("#v-resend").onclick = async () => {
  const b = $("#v-resend"), e = $("#v-err"); b.disabled = true; e.textContent = "";
  try { await fb.sendEmailVerification(user); e.textContent = "sent. check your inbox and spam folder." } catch (x) { e.textContent = MSG[x.code] || "could not send. try again later." }
  let s = 30; const t = setInterval(() => { b.textContent = s-- > 0 ? "resend in " + (s + 1) + "s" : (clearInterval(t), b.disabled = false, "resend email") }, 1000);
};
$("#v-out").onclick = async () => { try { await fb.signOut(auth) } catch (e) {} };
function onUser(u) {
  user = u; deleting = false; stopSync();
  window.nodeUid = u ? u.uid : null; window.nodeEmail = u && u.email ? u.email.toLowerCase() : null;
  if (u && window.nodeEmail) ls.set("node-email", window.nodeEmail);
  if (u && needsVerify(u)) { showVerify(u); renderSheet(); return }
  hideVerify();
  if (u) { ls.del("node-mode"); hideAuth(); ungate(); startSync(u) }
  else if (ls.get("node-mode") === "guest") { hideAuth(); ungate() }
  else showAuth(false);
  renderSheet();
}


/* ---------- notes sync: every note/folder is its own document in "items" ---------- */
let srv = {}, base = {}, nready = false, nsubs = [], legacy = null, legacyDone = true, legacyAdded = false, nTimer, pendIds = new Set();
const pickF = o => ({ type: o.type, name: o.name || "", body: o.body || "", parent: o.parent || null, owner: o.owner || null, ownerEmail: o.ownerEmail || "", direct: o.direct || {}, acl: o.acl || {}, memberEmails: o.memberEmails || [], updated: o.updated || 0, blocks: JSON.parse(JSON.stringify(o.blocks || [])), icon: o.icon || "", trashed: o.trashed || 0 });
const sig = o => canon(pickF(o));
const pushSoon = now => { clearTimeout(nTimer); nTimer = setTimeout(pushNow, now ? 0 : 600) };
function startNotes(u) {
  srv = {}; base = {}; nready = false; legacyAdded = false;
  const em = (u.email || "").toLowerCase(), need = em ? 2 : 1, seen = [false, false]; let ready = 0;
  const done = () => { if (ready >= need) { nready = true; reconcile() } };
  const mkH = i => snap => {
    snap.docChanges().forEach(ch => { const id = ch.doc.id; if (ch.type === "removed") delete srv[id]; else srv[id] = window.normItem({ ...ch.doc.data(), id }) });
    if (!seen[i]) { if (snap.metadata.fromCache && snap.empty && navigator.onLine) return; seen[i] = true; ready++ }
    done();
  };
  const fail = i => e => { console.warn("notes sync error", e); if (!seen[i]) { seen[i] = true; ready++; done() } };
  const c = fb.collection(db, "items");
  nsubs.push(fb.onSnapshot(fb.query(c, fb.where("owner", "==", u.uid)), mkH(0), fail(0)));
  if (em) nsubs.push(fb.onSnapshot(fb.query(c, fb.where("memberEmails", "array-contains", em)), mkH(1), fail(1)));
}
function addLegacy() {
  if (!legacy || legacyAdded || !nready) return;
  legacyAdded = true;
  const ids = new Set(window.N.map(x => x.id));
  legacy.forEach(x => { if (!ids.has(x.id) && !srv[x.id] && !(x.id in base)) window.N.push(window.normItem({ ...x, owner: null })) });
  pushSoon(true);
}
function reconcile() {
  const have = new Map(window.N.map(x => [x.id, x]));
  Object.values(srv).forEach(d => {
    const cur = have.get(d.id);
    if (!cur) { if (!(d.id in base)) { window.N.push({ ...d }); base[d.id] = sig(d) } }
    else if (!(d.id in base) || sig(cur) === base[d.id]) { Object.assign(cur, d); base[d.id] = sig(d) }
  });
  window.N = window.N.filter(x => !x.owner || srv[x.id] || pendIds.has(x.id));
  Object.keys(base).forEach(id => { if (!srv[id]) delete base[id] });
  addLegacy();
  window.nodeNotesApplied && window.nodeNotesApplied();
  pushSoon(false);
}
async function pushNow() {
  if (!user || !db || !nready || deleting) return;
  const N = window.N, me = user.uid, em = (user.email || "").toLowerCase(), claimed = new Set();
  N.forEach(x => { if (!x.owner) { x.owner = me; x.ownerEmail = em; claimed.add(x.id) } });
  const byId = new Map(N.map(x => [x.id, x]));
  N.filter(x => x.owner === me).forEach(x => {
    const eff = {}; let c = x, g = 0;
    while (c && g++ < 30) { Object.entries(c.direct || {}).forEach(([e, r]) => { if (r === "editor" || !eff[e]) eff[e] = r }); c = c.parent ? byId.get(c.parent) : null }
    x.acl = eff; x.memberEmails = Object.keys(eff);
  });
  let bad = false; const jobs = [], fail = x => e => { bad = true; console.warn("note sync failed", e); if (claimed.has(x.id) && !srv[x.id]) x.owner = null };
  N.forEach(x => {
    const b = srv[x.id], ref = fb.doc(db, "items", x.id);
    if (x.owner === me) {
      if (!b || sig(x) !== sig(b)) { pendIds.add(x.id); jobs.push(fb.setDoc(ref, pickF(x)).catch(fail(x)).finally(() => pendIds.delete(x.id))) }
    } else if (b && window.role(x) === "editor" && canon({ n: x.name, b: x.blocks, i: x.icon }) !== canon({ n: b.name, b: b.blocks, i: b.icon })) {
      jobs.push(fb.updateDoc(ref, { name: x.name || "", body: x.body || "", blocks: JSON.parse(JSON.stringify(x.blocks || [])), icon: x.icon || "", updated: x.updated || Date.now() }).catch(fail(x)));
    }
  });
  Object.keys(srv).forEach(id => { if (srv[id].owner === me && !byId.has(id)) jobs.push(fb.deleteDoc(fb.doc(db, "items", id)).catch(fail({ id }))) });
  await Promise.all(jobs);
  if (legacy && legacyAdded && !legacyDone && !bad) { legacyDone = true; legacy = null; push(true) }
}

/* ---------- sharing sheet ---------- */
const hx = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e };
const SS = hx("div", "sheet");
SS.innerHTML = '<div class="scrim"></div><div class="panel"><div class="ph"><span id="ss-t">share</span><button class="x2" aria-label="close">×</button></div><div id="ss-body"></div></div>';
document.body.appendChild(SS);
const closeShare = () => SS.classList.remove("show");
SS.querySelector(".scrim").onclick = closeShare; SS.querySelector(".x2").onclick = closeShare;
let ssItem = null, ssRole = "viewer";
window.nodeShare = it => { if (!user) { showAuth(true); return } ssItem = it; ssRole = "viewer"; renderShare(); SS.classList.add("show") };
function touchItem() { ssItem.updated = Date.now(); window.saveN && window.saveN() }
function renderShare(invited) {
  const it = ssItem, b = $("#ss-body"), d = it.direct || {};
  $("#ss-t").textContent = "share page";
  b.innerHTML = "";
  b.appendChild(hx("p", "as", "people you invite can open this page and every sub-page inside it, including ones you add later. they need to sign in to node with the invited email address."));
  const list = hx("div"); b.appendChild(list);
  Object.keys(d).sort().forEach(e => {
    const row = hx("div", "who"), sel = hx("select", "rsel"), x = hx("button", "x2", "×");
    ["viewer", "editor"].forEach(r => { const o = hx("option", null, r); o.value = r; if (d[e] === r) o.selected = true; sel.appendChild(o) });
    sel.onchange = () => { d[e] = sel.value; touchItem(); renderShare() };
    x.onclick = () => { delete d[e]; touchItem(); renderShare() };
    row.append(hx("span", null, e), sel, x); list.appendChild(row);
  });
  const inh = (it.memberEmails || []).filter(e => !(e in d));
  if (inh.length) b.appendChild(hx("p", "fine", "also has access through a parent folder: " + inh.join(", ")));
  const add = hx("div", "ssadd");
  add.innerHTML = '<input class="afield" id="ss-e" type="email" placeholder="invite by email" autocomplete="off" autocapitalize="none"><div class="seg" id="ss-r" data-m="' + (ssRole === "editor" ? "up" : "in") + '"><i></i><button data-r="viewer"' + (ssRole === "viewer" ? ' class="on"' : "") + '>viewer</button><button data-r="editor"' + (ssRole === "editor" ? ' class="on"' : "") + '>editor</button></div><div class="aerr" id="ss-err"></div><button class="primary" id="ss-go">invite</button>';
  b.appendChild(add);
  add.querySelectorAll("#ss-r button").forEach(x => x.onclick = () => { ssRole = x.dataset.r; $("#ss-r").dataset.m = ssRole === "editor" ? "up" : "in"; add.querySelectorAll("#ss-r button").forEach(y => y.classList.toggle("on", y === x)) });
  const msg = $("#ss-err");
  if (invited) {
    msg.textContent = "invited. they will see it once they sign in with that email. ";
    const a = hx("a", null, "send them a heads-up"); a.href = "mailto:" + invited + "?subject=" + encodeURIComponent("i shared something with you on node") + "&body=" + encodeURIComponent("open node and sign in with this email address to see \"" + (it.name || "untitled") + "\": " + location.href.split("#")[0].replace(/[^/]*$/, "")); msg.appendChild(a);
  }
  $("#ss-go").onclick = () => {
    const e = $("#ss-e").value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return msg.textContent = "that email does not look right.";
    if (e === window.nodeEmail) return msg.textContent = "that is your own email.";
    if (!navigator.onLine) return msg.textContent = "you need to be online to share.";
    if (Object.keys(d).length >= 20 && !(e in d)) return msg.textContent = "you can invite up to 20 people per item.";
    it.direct = d; d[e] = ssRole; touchItem(); renderShare(e);
  };
}

/* ---------- boot ---------- */
window.nodePush = () => { push(false); pushSoon(false) };
setMode("in");
if (!configured) ungate();
else {
  try {
    const [App, Au, Fs] = await Promise.all([import(B + "firebase-app.js"), import(B + "firebase-auth.js"), import(B + "firebase-firestore.js")]);
    fb = { ...Au, ...Fs };
    const app = App.initializeApp(cfg);
    auth = Au.getAuth(app);
    try { db = Fs.initializeFirestore(app, { localCache: Fs.persistentLocalCache({ tabManager: Fs.persistentMultipleTabManager() }) }) } catch (e) { db = Fs.getFirestore(app) }
    Au.onAuthStateChanged(auth, onUser);
  } catch (e) { console.warn("firebase failed to load", e); ungate() }
}
