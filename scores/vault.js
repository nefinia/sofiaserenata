/* Score vault (browser side). Opens the encrypted MusicXML / MIDI files in ./vault/ with a name + password,
   keeps the opened key on this device (stored unexportable in IndexedDB, nothing is sent anywhere),
   and keeps scores imported from this device. See tools/vault.mjs for how files are locked. */
(function () {
  "use strict";
  const BASE = new URL("vault/", document.currentScript ? document.currentScript.src : location.href).href;
  const S = crypto.subtle, enc = new TextEncoder(), dec = new TextDecoder();
  const ub64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  let dbp = null;
  function db() {
    return dbp || (dbp = new Promise((ok, no) => {
      const r = indexedDB.open("sofiaserenata-scores", 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore("kv"); d.createObjectStore("files", { keyPath: "id" }); };
      r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
    }));
  }
  async function tx(store, mode, fn) {
    const d = await db();
    return new Promise((ok, no) => {
      const t = d.transaction(store, mode), out = fn(t.objectStore(store));
      t.oncomplete = () => ok(out instanceof IDBRequest ? out.result : undefined);
      t.onerror = () => no(t.error);
    });
  }
  const kvGet = k => tx("kv", "readonly", s => s.get(k));
  const kvSet = (k, v) => tx("kv", "readwrite", s => { s.put(v, k); });
  const kvDel = k => tx("kv", "readwrite", s => { s.delete(k); });

  async function nameId(name) {
    const h = new Uint8Array(await S.digest("SHA-256", enc.encode("sofiaserenata:" + name.trim().toLowerCase())));
    return [...h].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  }
  async function getJSON(f) { const r = await fetch(BASE + f, { cache: "no-cache" }); if (!r.ok) throw new Error("offline"); return r.json(); }

  let keyP = null;
  function key() { return keyP || (keyP = kvGet("priv").then(k => k || null)); }

  async function login(name, pw) {
    const keys = await getJSON("keys.json");
    const id = await nameId(name), e = keys.logins.find(x => x.n === id);
    if (!e) throw new Error("name");
    const base = await S.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveKey"]);
    const k = await S.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: ub64(e.s), iterations: e.r || 600000 }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    let jwk;
    try { jwk = JSON.parse(dec.decode(await S.decrypt({ name: "AES-GCM", iv: ub64(e.i) }, k, ub64(e.c)))); }
    catch (err) { throw new Error("password"); }
    const priv = await S.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
    await kvSet("priv", priv); await kvSet("user", name.trim());
    keyP = Promise.resolve(priv);
    warm();
    return name.trim();
  }
  async function logout() { await kvDel("priv"); await kvDel("user"); keyP = Promise.resolve(null); }
  async function user() { return (await key()) ? (await kvGet("user")) || "" : null; }

  async function gunzip(u8) {
    const st = new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Uint8Array(await new Response(st).arrayBuffer());
  }
  async function get(name) {
    const priv = await key(); if (!priv) throw new Error("locked");
    const r = await fetch(BASE + name + ".bin"); if (!r.ok) throw new Error("missing");
    const b = new Uint8Array(await r.arrayBuffer());
    const epk = await S.importKey("raw", b.slice(0, 65), { name: "ECDH", namedCurve: "P-256" }, false, []);
    const k = await S.deriveKey({ name: "ECDH", public: epk }, priv, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    return gunzip(new Uint8Array(await S.decrypt({ name: "AES-GCM", iv: b.slice(65, 77) }, k, b.slice(77))));
  }
  const text = async name => dec.decode(await get(name));
  const blobUrl = async (name, type) => URL.createObjectURL(new Blob([await get(name)], { type: type || "application/octet-stream" }));

  /* fetch every locked file once so the offline copy (service worker cache) is complete and up to date */
  async function warm() {
    try {
      const idx = await getJSON("index.json");
      await Promise.all(Object.entries(idx.files).map(([n, v]) => fetch(BASE + n + ".bin?v=" + v).catch(() => {})));
      return Object.keys(idx.files);
    } catch (e) { return null; }
  }
  async function has(name) { try { const idx = await (await fetch(BASE + "index.json")).json(); return name in idx.files; } catch (e) { return false; } }

  /* scores imported from this device */
  async function localAdd(file) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const rec = { id, name: file.name, type: /\.midi?$/i.test(file.name) ? "midi" : /\.mxl$/i.test(file.name) ? "mxl" : "xml", size: file.size, added: Date.now(), data: await file.arrayBuffer() };
    await tx("files", "readwrite", s => { s.put(rec); }); return rec;
  }
  const localList = () => tx("files", "readonly", s => s.getAll()).then(a => (a || []).map(({ data, ...r }) => r).sort((x, y) => x.name.localeCompare(y.name)));
  const localGet = id => tx("files", "readonly", s => s.get(id));
  const localDel = id => tx("files", "readwrite", s => { s.delete(id); });

  window.Vault = { login, logout, user, get, text, blobUrl, warm, has, localAdd, localList, localGet, localDel };

  if ("serviceWorker" in navigator) navigator.serviceWorker.register(new URL("../sw.js", BASE).href).catch(() => {});
})();
