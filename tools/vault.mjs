#!/usr/bin/env node
/* Score vault for sofiaserenata.com/scores — keeps MusicXML and MIDI files in the public repo, encrypted.

   How the lock works
   - One "owner" key pair (ECDH P-256). The public half is in scores/vault/pub.json, so anyone (this script,
     the GitHub automation) can lock new files without knowing a password.
   - Each file is locked with its own throw-away key agreed against that public key, and is gzipped first.
     File layout: [65 bytes ephemeral public key][12 bytes IV][AES-256-GCM ciphertext of gzip(data)]
   - The private half is stored once per login in scores/vault/keys.json, sealed with that login's password
     (PBKDF2-SHA256, 600 000 rounds → AES-256-GCM). Logins are listed by a hash of the name, not the name.
   - The browser (scores/vault.js) opens it with a name + password and keeps the key on the device, unexportable.

   Commands (run from the repo root)
     node tools/vault.mjs init <name> <password>                     new lock (replaces keys.json + pub.json)
     node tools/vault.mjs add-login <name> <password> <newName> <newPassword>
     node tools/vault.mjs remove-login <name>
     node tools/vault.mjs logins                                       how many logins exist
     node tools/vault.mjs lock <vaultName> <file>                      lock one local file as vault/<vaultName>.bin
     node tools/vault.mjs fetch [--all]                                lock files listed in vault/sources.json (from Drive)
     node tools/vault.mjs unlock <name> <password> <vaultName> [out]   test: decrypt one file
     node tools/vault.mjs rekey <name> <password> <newName> <newPassword>   new key pair, re-lock everything (removes all other logins)
*/
import { webcrypto as C } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import { join } from "node:path";

const S = C.subtle;
const DIR = "scores/vault";
const ROUNDS = 600000;
const DRIVE_KEY = "AIzaSyBBSNHHAweVUTKnF_R7UlKpH9bhgyLypIo"; // public, read-only, restricted to the site
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = u => Buffer.from(u).toString("base64");
const ub64 = s => new Uint8Array(Buffer.from(s, "base64"));
const P = f => join(DIR, f);
const readJSON = (f, d) => existsSync(P(f)) ? JSON.parse(readFileSync(P(f), "utf8")) : d;
const writeJSON = (f, o) => writeFileSync(P(f), JSON.stringify(o, null, 1) + "\n");

export async function nameId(name) {
  const h = await S.digest("SHA-256", enc.encode("sofiaserenata:" + name.trim().toLowerCase()));
  return Buffer.from(h).toString("hex").slice(0, 32);
}
async function pwKey(pw, salt) {
  const base = await S.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveKey"]);
  return S.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ROUNDS }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function seal(privJwk, name, pw) {
  const salt = C.getRandomValues(new Uint8Array(16)), iv = C.getRandomValues(new Uint8Array(12));
  const c = await S.encrypt({ name: "AES-GCM", iv }, await pwKey(pw, salt), enc.encode(JSON.stringify(privJwk)));
  return { n: await nameId(name), s: b64(salt), i: b64(iv), c: b64(c), r: ROUNDS };
}
async function openPriv(name, pw) {
  const keys = readJSON("keys.json", { logins: [] });
  const id = await nameId(name);
  const ent = keys.logins.find(x => x.n === id);
  if (!ent) throw new Error("No login with that name");
  try {
    const k = await pwKey(pw, ub64(ent.s));
    const jwk = JSON.parse(dec.decode(await S.decrypt({ name: "AES-GCM", iv: ub64(ent.i) }, k, ub64(ent.c))));
    return jwk;
  } catch { throw new Error("Wrong password"); }
}
async function pubKey() {
  const jwk = readJSON("pub.json", null);
  if (!jwk) throw new Error("No vault yet: run init first");
  return S.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, false, []);
}
export async function lockBytes(data, pub) {
  const eph = await S.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  const key = await S.deriveKey({ name: "ECDH", public: pub }, eph.privateKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const iv = C.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await S.encrypt({ name: "AES-GCM", iv }, key, gzipSync(data, { level: 9 })));
  const epk = new Uint8Array(await S.exportKey("raw", eph.publicKey));
  const out = new Uint8Array(65 + 12 + ct.length); out.set(epk, 0); out.set(iv, 65); out.set(ct, 77);
  return out;
}
async function unlockBytes(buf, privJwk) {
  const priv = await S.importKey("jwk", privJwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
  const epk = await S.importKey("raw", buf.slice(0, 65), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const key = await S.deriveKey({ name: "ECDH", public: epk }, priv, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  return gunzipSync(Buffer.from(await S.decrypt({ name: "AES-GCM", iv: buf.slice(65, 77) }, key, buf.slice(77))));
}
function writeIndex() {
  const files = {};
  for (const f of readdirSync(DIR).filter(f => f.endsWith(".bin")).sort()) {
    const b = readFileSync(P(f));
    files[f.slice(0, -4)] = Buffer.from(b.subarray(65, 77)).toString("hex"); // the IV: changes whenever the file is re-locked
  }
  writeJSON("index.json", { files });
}
async function lockFile(name, data, pub) {
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(name)) throw new Error("Bad vault name: " + name);
  writeFileSync(P(name + ".bin"), await lockBytes(data, pub));
}

const [cmd, ...a] = process.argv.slice(2);
mkdirSync(DIR, { recursive: true });
try {
  if (cmd === "init") {
    const [name, pw] = a; if (!pw) throw new Error("usage: init <name> <password>");
    const kp = await S.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
    const pub = await S.exportKey("jwk", kp.publicKey), priv = await S.exportKey("jwk", kp.privateKey);
    writeJSON("pub.json", pub);
    writeJSON("keys.json", { v: 1, logins: [await seal(priv, name, pw)] });
    console.log("New vault lock created with one login.");
  } else if (cmd === "add-login") {
    const [name, pw, nn, np] = a; if (!np) throw new Error("usage: add-login <name> <password> <newName> <newPassword>");
    const priv = await openPriv(name, pw), keys = readJSON("keys.json");
    const id = await nameId(nn); keys.logins = keys.logins.filter(x => x.n !== id);
    keys.logins.push(await seal(priv, nn, np)); writeJSON("keys.json", keys);
    console.log("Login added. Logins now:", keys.logins.length);
  } else if (cmd === "remove-login") {
    const id = await nameId(a[0]), keys = readJSON("keys.json");
    const before = keys.logins.length; keys.logins = keys.logins.filter(x => x.n !== id); writeJSON("keys.json", keys);
    console.log(before === keys.logins.length ? "No such login." : "Login removed. Logins now: " + keys.logins.length);
  } else if (cmd === "logins") {
    console.log(readJSON("keys.json", { logins: [] }).logins.length, "login(s)");
  } else if (cmd === "lock") {
    const [name, file] = a; await lockFile(name, readFileSync(file), await pubKey()); writeIndex();
    console.log("Locked", file, "→", P(name + ".bin"));
  } else if (cmd === "fetch") {
    const all = a.includes("--all"), pub = await pubKey(), src = readJSON("sources.json", { files: {} }).files;
    let n = 0;
    for (const [name, driveId] of Object.entries(src)) {
      if (!all && existsSync(P(name + ".bin"))) continue;
      const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveId)}?alt=media&key=${DRIVE_KEY}`,
        { headers: { Referer: "https://sofiaserenata.com/scores/" } });
      if (!r.ok) throw new Error(`${name}: Drive answered ${r.status} ${await r.text()}`);
      await lockFile(name, new Uint8Array(await r.arrayBuffer()), pub); n++; console.log("Locked", name);
    }
    writeIndex(); console.log(n ? `${n} file(s) locked.` : "Nothing new to lock.");
  } else if (cmd === "unlock") {
    const [name, pw, vn, out] = a;
    const data = await unlockBytes(new Uint8Array(readFileSync(P(vn + ".bin"))), await openPriv(name, pw));
    if (out) writeFileSync(out, data); else console.log(data.length, "bytes OK:", dec.decode(data.subarray(0, 80)).replace(/\s+/g, " "));
  } else if (cmd === "rekey") {
    const [name, pw, nn, np] = a; if (!np) throw new Error("usage: rekey <name> <password> <newName> <newPassword>");
    const old = await openPriv(name, pw), plain = {};
    for (const f of readdirSync(DIR).filter(f => f.endsWith(".bin"))) plain[f] = await unlockBytes(new Uint8Array(readFileSync(P(f))), old);
    const kp = await S.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
    writeJSON("pub.json", await S.exportKey("jwk", kp.publicKey));
    writeJSON("keys.json", { v: 1, logins: [await seal(await S.exportKey("jwk", kp.privateKey), nn, np)] });
    const pub = await pubKey();
    for (const [f, d] of Object.entries(plain)) writeFileSync(P(f), await lockBytes(d, pub));
    writeIndex(); console.log("New lock; re-locked", Object.keys(plain).length, "files. Only the new login remains.");
  } else {
    console.log("Commands: init, add-login, remove-login, logins, lock, fetch [--all], unlock, rekey");
  }
} catch (e) { console.error("Error:", e.message); process.exit(1); }
