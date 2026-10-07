/* Offline support for the score library (scope: /scores/).
   - The app itself (pages, viewers, notation engine) is stored on install and refreshed in the background.
   - Locked score files (vault/*.bin) are stored as they're fetched; Vault.warm() fetches them all after sign-in.
   - PDFs opened from Google Drive and the MIDI instrument sounds are kept once used, so they also work offline later. */
const V = "scores-v2";
const SHELL = ["./", "index.html", "fit.html", "view.html", "vault.js", "ink.js",
  "lib/verovio-toolkit-wasm.js", "lib/pdf.min.js", "lib/pdf.worker.min.js", "lib/tone.js", "lib/magenta-core.js", "lib/midi-player.min.js",
  "vault/keys.json", "vault/index.json", "../assets/js/display.js", "../icon.svg", "../icon-32.png", "../apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const net = (req, c, key) => fetch(req).then(r => { if (r && (r.status === 200 || r.type === "opaque")) c.put(key || req, r.clone()).catch(() => {}); return r; });

self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const u = new URL(req.url);
  // Google Analytics: never cache
  if (/google-analytics|googletagmanager/.test(u.host)) return;
  e.respondWith((async () => {
    const c = await caches.open(V);
    if (u.origin === location.origin) {
      const key = u.origin + u.pathname;               // ignore ?v= / ?x= etc.
      const live = /\/vault\/(keys|index)\.json$/.test(u.pathname) || req.mode === "navigate";
      const hit = await c.match(key);
      if (live) {                                     // network first, offline copy as fallback
        try { return await net(req, c, key); } catch (err) { if (hit) return hit; throw err; }
      }
      const update = net(req, c, key).catch(() => null); // stale-while-revalidate
      if (hit) { e.waitUntil(update); return hit; }
      return (await update) || Response.error();
    }
    if (u.host === "www.googleapis.com" && u.pathname.startsWith("/drive/")) { // PDFs: network first
      try { return await net(req, c); } catch (err) { const h = await c.match(req); if (h) return h; throw err; }
    }
    if (/^(storage\.googleapis\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.host)) { // sounds, fonts: cache first
      return (await c.match(req)) || net(req, c);
    }
    return fetch(req);
  })());
});
