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
    const base = await S.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
    const bits = new Uint8Array(await S.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: ub64(e.s), iterations: e.r || 600000 }, base, 768));
    const k = await S.importKey("raw", bits.slice(0, 32), { name: "AES-GCM" }, false, ["decrypt"]);
    let jwk;
    try { jwk = JSON.parse(dec.decode(await S.decrypt({ name: "AES-GCM", iv: ub64(e.i) }, k, ub64(e.c)))); }
    catch (err) { throw new Error("password"); }
    const priv = await S.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
    await kvSet("priv", priv); await kvSet("user", name.trim());
    keyP = Promise.resolve(priv);
    /* this login's private sync: token (its hash is the public "v") and data key */
    if (e.v) {
      const tok = btoa(String.fromCharCode(...bits.slice(32, 64))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const dk = await S.importKey("raw", bits.slice(64, 96), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
      await kvSet("sync", { uid: id, tok }); await kvSet("dk", dk); syncP = null;
      sync();
    }
    warm();
    return name.trim();
  }
  async function logout() { await kvDel("priv"); await kvDel("user"); await kvDel("sync"); await kvDel("dk"); keyP = Promise.resolve(null); syncP = null; }

  /* ---------- sync of drawings and transpose settings between this login's devices ---------- */
  const SYNC_URL = window.SCORES_SYNC_URL || "https://scores-sync.sofiaserenata.workers.dev/v1/";
  const SYNCED = k => /^(ink:|tr:|tr-inst$)/.test(k);
  const LS = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} } };
  const jget = (k, d) => { try { return JSON.parse(LS.get(k)) || d; } catch (e) { return d; } };
  let syncP = null, flushT = null, busy = false;
  function syncAuth() { return syncP || (syncP = Promise.all([kvGet("sync"), kvGet("dk")]).then(([a, dk]) => a && dk ? { ...a, dk } : null)); }
  async function docId(k) { const h = new Uint8Array(await S.digest("SHA-256", enc.encode("doc:" + k))); return [...h].map(b => b.toString(16).padStart(2, "0")).join(""); }
  const api = (a, path, opt = {}) => fetch(SYNC_URL + a.uid + "/" + path, { ...opt, cache: "no-store", headers: { ...(opt.headers || {}), Authorization: "Bearer " + a.tok } });
  /* call after changing a synced key on this device */
  function note(k) {
    if (!SYNCED(k)) return;
    LS.set("sync-ts:" + k, String(Date.now()));
    const d = jget("sync-dirty", {}); d[k] = 1; LS.set("sync-dirty", JSON.stringify(d));
    clearTimeout(flushT); flushT = setTimeout(flush, 2500);
  }
  async function flush() {
    const a = await syncAuth(); if (!a || !navigator.onLine) return;
    const d = jget("sync-dirty", {});
    for (const k of Object.keys(d)) {
      const t = +LS.get("sync-ts:" + k) || Date.now(), iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await S.encrypt({ name: "AES-GCM", iv }, a.dk, enc.encode(JSON.stringify({ k, t, v: LS.get(k) }))));
      const body = new Uint8Array(12 + ct.length); body.set(iv); body.set(ct, 12);
      try {
        const r = await api(a, "doc/" + await docId(k), { method: "PUT", body, headers: { "X-T": String(t) } });
        if (r.ok || r.status === 409) { const dd = jget("sync-dirty", {}); if (+LS.get("sync-ts:" + k) === t) delete dd[k]; LS.set("sync-dirty", JSON.stringify(dd)); }
        else if (r.status === 401 || r.status === 403) return;
      } catch (e) { return; }
    }
  }
  function mergeInk(localJson, remoteJson) {  // keep strokes from both sides
    const L = JSON.parse(localJson || "{}"), R = JSON.parse(remoteJson || "{}");
    for (const [key, list] of Object.entries(R)) { const have = new Set((L[key] = L[key] || []).map(x => JSON.stringify(x))); for (const s of list) if (!have.has(JSON.stringify(s))) L[key].push(s); }
    return JSON.stringify(L);
  }
  async function pull() {
    const a = await syncAuth(); if (!a || !navigator.onLine) return [];
    let list; try { const r = await api(a, "list"); if (!r.ok) return []; list = await r.json(); } catch (e) { return []; }
    const seen = jget("sync-seen", {}), dirty = jget("sync-dirty", {}), changed = [];
    for (const it of list) {
      if ((seen[it.id] || 0) >= it.t) continue;
      try {
        const r = await api(a, "doc/" + it.id); if (!r.ok) continue;
        const b = new Uint8Array(await r.arrayBuffer());
        const doc = JSON.parse(dec.decode(await S.decrypt({ name: "AES-GCM", iv: b.slice(0, 12) }, a.dk, b.slice(12))));
        const lt = +LS.get("sync-ts:" + doc.k) || 0;
        if (doc.t > lt) {
          if (dirty[doc.k] && doc.k.startsWith("ink:")) { LS.set(doc.k, mergeInk(LS.get(doc.k), doc.v)); note(doc.k); changed.push(doc.k); }
          else if (!dirty[doc.k]) { LS.set(doc.k, doc.v); LS.set("sync-ts:" + doc.k, String(doc.t)); changed.push(doc.k); }
        }
        seen[it.id] = it.t;
      } catch (e) {}
    }
    LS.set("sync-seen", JSON.stringify(seen));
    if (changed.length) dispatchEvent(new CustomEvent("vault-sync", { detail: changed }));
    return changed;
  }
  async function sync() { if (busy) return []; busy = true; try { const c = await pull(); await flush(); return c; } finally { busy = false; } }
  async function syncOn() { return !!(await syncAuth()); }
  addEventListener("online", () => sync());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sync(); else flush(); });
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

  window.Vault = { login, logout, user, get, text, blobUrl, warm, has, localAdd, localList, localGet, localDel, note, sync, syncOn };
  sync();

  if ("serviceWorker" in navigator) navigator.serviceWorker.register(new URL("../sw.js", BASE).href).catch(() => {});
})();
