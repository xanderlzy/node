const CACHE = "node-v13";
const ASSETS = ["./", "./index.html", "./auth.js", "./notes.js", "./firebase-config.js", "./manifest.webmanifest", "./privacy.html", "./terms.html", "./legal.css", "./legal.js", "./icon.svg", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  // only handle our own files and the firebase sdk; let firestore/auth traffic pass straight through
  if (u.origin !== location.origin && u.hostname !== "www.gstatic.com") return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)) }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
