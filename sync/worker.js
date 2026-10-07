/* Sync service for the score library (Cloudflare Worker, KV binding: INK).
   Stores small encrypted documents (drawings, transpose settings) per login.
   - Everything is encrypted in the browser with a key only that login has; this service never sees content.
   - A request is accepted when sha256(token) matches the login's "v" in the public keys.json of the site.
   API (all need  Authorization: Bearer <token>):
     GET  /v1/<uid>/list        → [{ id, t }]
     GET  /v1/<uid>/doc/<id>    → the stored bytes
     PUT  /v1/<uid>/doc/<id>    → store (header X-T: last-change time in ms; older writes are ignored) */
const KEYS_URL = "https://sofiaserenata.com/scores/vault/keys.json";
const ORIGINS = ["https://sofiaserenata.com", "https://www.sofiaserenata.com", "http://localhost:8765"];
const MAX = 512 * 1024;
let keysCache = null, keysAt = 0;

async function keys() {
  if (keysCache && Date.now() - keysAt < 5 * 60 * 1000) return keysCache;
  const r = await fetch(KEYS_URL, { cf: { cacheTtl: 60 } });
  if (!r.ok) throw new Error("keys");
  keysCache = await r.json(); keysAt = Date.now(); return keysCache;
}
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
function b64u(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-T",
      "Access-Control-Max-Age": "86400", "Vary": "Origin"
    };
    const out = (body, status = 200, extra = {}) => new Response(body, { status, headers: { ...cors, ...extra } });
    if (req.method === "OPTIONS") return out(null, 204);

    const m = new URL(req.url).pathname.match(/^\/v1\/([0-9a-f]{32})\/(list|doc\/([0-9a-f]{64}))$/);
    if (!m) return out("Not found", 404);
    const [, uid, , id] = m;

    // who is asking
    const tok = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!tok) return out("Sign in first", 401);
    let ok = false;
    try {
      const k = await keys(), ent = (k.logins || []).find(x => x.n === uid);
      ok = !!(ent && ent.v && ent.v === hex(await crypto.subtle.digest("SHA-256", b64u(tok))));
    } catch (e) { return out("Can't check the login right now", 503); }
    if (!ok) return out("Not allowed", 403);

    if (m[2] === "list") {
      const items = []; let cursor;
      do {
        const l = await env.INK.list({ prefix: `d:${uid}:`, cursor });
        for (const k of l.keys) items.push({ id: k.name.slice(35), t: (k.metadata && k.metadata.t) || 0 });
        cursor = l.list_complete ? null : l.cursor;
      } while (cursor);
      return out(JSON.stringify(items), 200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    }
    const key = `d:${uid}:${id}`;
    if (req.method === "GET") {
      const v = await env.INK.get(key, "arrayBuffer");
      return v ? out(v, 200, { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" }) : out("Not found", 404);
    }
    if (req.method === "PUT") {
      const t = Math.floor(+req.headers.get("X-T") || Date.now());
      const body = await req.arrayBuffer();
      if (body.byteLength > MAX) return out("Too large", 413);
      const cur = await env.INK.getWithMetadata(key, "arrayBuffer");
      if (cur && cur.metadata && cur.metadata.t > t) return out(JSON.stringify({ t: cur.metadata.t }), 409, { "Content-Type": "application/json" });
      await env.INK.put(key, body, { metadata: { t } });
      return out(JSON.stringify({ t }), 200, { "Content-Type": "application/json" });
    }
    return out("Method not allowed", 405);
  }
};
