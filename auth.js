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
document.body.append(A, SH);

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
  const out = { app: "node", exportedAt: new Date().toISOString(), account: user ? { email: user.email || null, uid: user.uid } : null, kanban: { todo: d.todo || [], doing: d.doing || [], done: d.done || [] }, notes: d.notes || [] };
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
  try { await (mode === "up" ? fb.createUserWithEmailAndPassword : fb.signInWithEmailAndPassword)(auth, e, p) }
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
  stopSync(); user = null;
  ls.del("node-uid"); ls.del("node-mode");
  window.nodeWipe && window.nodeWipe();
  closeSheet();
  try { await fb.signOut(auth) } catch (e) {}
}

/* ---------- sync ---------- */
const clone = o => JSON.parse(JSON.stringify(o));
const canon = o => JSON.stringify(o, (k, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v).sort().reduce((r, x) => (r[x] = v[x], r), {}) : v);
function merge(remote, local) {
  const out = clone(remote), ids = new Set();
  ["todo", "doing", "done"].forEach(k => (out[k] = out[k] || []).forEach(c => ids.add(c.id)));
  ["todo", "doing", "done"].forEach(k => (local[k] || []).forEach(c => { if (!ids.has(c.id)) out[k].push(c) }));
  out.notes = out.notes || []; const nid = new Set(out.notes.map(c => c.id));
  (local.notes || []).forEach(c => { if (!nid.has(c.id)) out.notes.push(c) });
  return out;
}
function push(now) {
  if (!user || !db || deleting) return;
  dirty = true; clearTimeout(timer); timer = setTimeout(flush, now ? 0 : 500); renderSheet();
}
async function flush() {
  if (!user || !db || deleting) return;
  const snap = window.nodeGet();
  try { await fb.setDoc(fb.doc(db, "users", user.uid), { board: snap, updatedAt: fb.serverTimestamp() }) } catch (e) { console.warn("sync failed", e) }
  if (JSON.stringify(window.nodeGet()) === JSON.stringify(snap)) dirty = false;
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
    if (first) {
      first = false;
      if (fresh) { ls.set("node-uid", u.uid); window.nodeApply(remote ? merge(remote, window.nodeGet()) : window.nodeGet()); push(true); return }
    }
    if (!remote) { push(true); return }
    if (dirty || canon(remote) === canon(window.nodeGet())) return;
    applyIdle(remote);
  }, e => console.warn("sync error", e));
}
function stopSync() { if (unsub) unsub(); unsub = null; clearTimeout(timer); dirty = false }
function onUser(u) {
  user = u; deleting = false; stopSync();
  if (u) { ls.del("node-mode"); hideAuth(); ungate(); startSync(u) }
  else if (ls.get("node-mode") === "guest") { hideAuth(); ungate() }
  else showAuth(false);
  renderSheet();
}

/* ---------- boot ---------- */
window.nodePush = () => push(false);
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
