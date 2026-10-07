/* Freehand annotations for the score viewers (shared by fit.html and view.html).
   Drawings belong to "frames": a bar in the Fit viewer, a page in the PDF viewer.
   Points are stored relative to their frame (x as a share of its width, y in units of its height),
   so a drawing follows its bar or page when the score is resized, reflowed or rotated.
   Saved on this device only (localStorage). */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const COLORS = [["#1f1a1c", "Black"], ["#c0392b", "Red"], ["#1f5fbf", "Blue"]];
  const HL = "#f2cf1d";

  function create(o) {
    /* o: { container, store, frames():[{key,x,y,w,h,unit}], toLocal(clientX,clientY)->{x,y}, mode:"bar"|"page",
            hint, onEnter(), onExit(), panBy(dy) } — frames are in container coordinates */
    const C = o.container;
    let data = {}; try { data = JSON.parse(localStorage.getItem(o.store) || "{}"); } catch (e) {}
    const save = () => { try { localStorage.setItem(o.store, JSON.stringify(data)); } catch (e) {} if (window.Vault && Vault.note) Vault.note(o.store); };

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "ink-layer");
    svg.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:1";
    C.appendChild(svg);

    let on = false, tool = "pen", color = COLORS[0][0], sel = null /* index into last frames */, frames = [];
    let penSeen = false, cur = null, undo = [];

    /* ---------- drawing ---------- */
    function pathD(pts, f) {
      const P = []; for (let i = 0; i < pts.length; i += 2) P.push([f.x + pts[i] * f.w, f.y + pts[i + 1] * f.h]);
      if (P.length === 1) return `M${P[0][0]} ${P[0][1]} l0.01 0`;
      let d = `M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`;
      for (let i = 1; i < P.length - 1; i++) { const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2; d += ` Q${P[i][0].toFixed(1)} ${P[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`; }
      const L = P[P.length - 1]; return d + ` L${L[0].toFixed(1)} ${L[1].toFixed(1)}`;
    }
    function strokeEl(s, f) {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", pathD(s.p, f)); p.setAttribute("fill", "none"); p.setAttribute("stroke", s.c);
      p.setAttribute("stroke-width", Math.max(1, s.w * f.unit)); p.setAttribute("stroke-linecap", "round"); p.setAttribute("stroke-linejoin", "round");
      if (s.hl) { p.setAttribute("stroke-opacity", ".38"); p.style.mixBlendMode = "multiply"; }
      return p;
    }
    function render() {
      frames = o.frames() || [];
      if (sel !== null && (!frames[sel] || frames[sel].key !== selKey)) sel = frames.findIndex(f => f.key === selKey), sel = sel < 0 ? null : sel;
      svg.replaceChildren();
      if (on && sel !== null && o.mode === "bar") {
        const f = frames[sel], r = document.createElementNS(NS, "rect");
        r.setAttribute("x", f.x - 4); r.setAttribute("y", f.y - f.h * 1.2); r.setAttribute("width", f.w + 8); r.setAttribute("height", f.h * 3.4);
        r.setAttribute("rx", 8); r.setAttribute("fill", "rgba(168,80,92,.10)"); r.setAttribute("stroke", "rgba(168,80,92,.55)"); r.setAttribute("stroke-dasharray", "6 5");
        svg.appendChild(r);
      }
      for (const f of frames) for (const s of (data[f.key] || [])) svg.appendChild(strokeEl(s, f));
      if (cur) svg.appendChild(cur.el);
    }
    let selKey = null;
    const frameAt = (x, y) => {
      let best = -1, bd = 1e9;
      frames.forEach((f, i) => {
        const pad = o.mode === "bar" ? f.h * 2 : 0;
        if (x >= f.x && x <= f.x + f.w && y >= f.y - pad && y <= f.y + f.h + pad) { const d = Math.abs(y - (f.y + f.h / 2)); if (d < bd) { bd = d; best = i; } }
      });
      return best < 0 ? null : best;
    };

    /* ---------- capture layer ---------- */
    const cap = document.createElement("div");
    cap.style.cssText = "position:absolute;inset:0;z-index:6;touch-action:none;display:none;cursor:crosshair";
    (o.captureParent || C.parentNode).appendChild(cap);
    const touches = new Map(); let panY = null, down = null;
    cap.addEventListener("pointerdown", e => {
      if (e.pointerType === "pen") penSeen = true;
      if (e.pointerType === "touch") { touches.set(e.pointerId, e.clientY); if (touches.size === 2) { cancelStroke(); panY = avgY(); return; } }
      if (touches.size > 1) return;
      cap.setPointerCapture(e.pointerId);
      const q = o.toLocal(e.clientX, e.clientY);
      down = { x: q.x, y: q.y, t: Date.now(), id: e.pointerId, draw: !(penSeen && e.pointerType === "touch") };
      if (tool === "eraser") { erase(q); return; }
    });
    cap.addEventListener("pointermove", e => {
      if (e.pointerType === "touch" && touches.has(e.pointerId)) touches.set(e.pointerId, e.clientY);
      if (touches.size >= 2 && panY !== null) { const y = avgY(); o.panBy && o.panBy(panY - y); panY = y; return; }
      if (!down || down.id !== e.pointerId) return;
      const q = o.toLocal(e.clientX, e.clientY);
      if (tool === "eraser") { erase(q); return; }
      if (!down.draw) return;
      if (!cur) {
        if (Math.hypot(q.x - down.x, q.y - down.y) < 4) return;
        let fi = o.mode === "page" ? frameAt(down.x, down.y) : (sel !== null ? sel : frameAt(down.x, down.y));
        if (fi === null) return;
        sel = fi; selKey = frames[fi].key;
        const f = frames[fi];
        cur = { f, s: { c: tool === "hl" ? HL : color, w: tool === "hl" ? (o.mode === "bar" ? 0.55 : 0.018) : (o.mode === "bar" ? 0.07 : 0.0028), hl: tool === "hl" || undefined, p: [] } };
        addPt(down.x, down.y); cur.el = strokeEl(cur.s, f); render();
      }
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs) { const r = o.toLocal(ev.clientX, ev.clientY); addPt(r.x, r.y); }
      cur.el.setAttribute("d", pathD(cur.s.p, cur.f));
    });
    const end = e => {
      if (e.pointerType === "touch") { touches.delete(e.pointerId); if (touches.size < 2) panY = null; }
      if (!down || down.id !== e.pointerId) return;
      const q = o.toLocal(e.clientX, e.clientY), tap = !cur && Math.hypot(q.x - down.x, q.y - down.y) < 8 && Date.now() - down.t < 400;
      if (cur) {
        if (cur.s.p.length >= 2) { (data[cur.f.key] = data[cur.f.key] || []).push(cur.s); undo.push({ k: cur.f.key, s: cur.s, op: "add" }); save(); }
        cur = null; render();
      } else if (tap && tool !== "eraser" && o.mode === "bar") { const fi = frameAt(q.x, q.y); sel = fi; selKey = fi === null ? null : frames[fi].key; render(); }
      down = null;
    };
    cap.addEventListener("pointerup", end); cap.addEventListener("pointercancel", e => { cancelStroke(); end(e); });
    const avgY = () => { let s = 0; touches.forEach(v => s += v); return s / touches.size; };
    function cancelStroke() { cur = null; down = null; render(); }
    function addPt(x, y) { const f = cur.f; cur.s.p.push(+((x - f.x) / f.w).toFixed(4), +((y - f.y) / f.h).toFixed(4)); }
    function erase(q) {
      for (const f of frames) {
        const list = data[f.key]; if (!list) continue;
        for (let i = list.length - 1; i >= 0; i--) {
          const s = list[i], tol = Math.max(10, s.w * f.unit);
          for (let j = 0; j < s.p.length; j += 2) {
            if (Math.hypot(f.x + s.p[j] * f.w - q.x, f.y + s.p[j + 1] * f.h - q.y) < tol) { list.splice(i, 1); undo.push({ k: f.key, s, op: "del", i }); if (!list.length) delete data[f.key]; save(); render(); return; }
          }
        }
      }
    }

    /* ---------- palette ---------- */
    const pal = document.createElement("div");
    pal.className = "ink-pal"; pal.hidden = true;
    pal.innerHTML = `<span class="ink-hint"></span>` +
      COLORS.map(([c, n]) => `<button type="button" data-c="${c}" title="${n} pen" aria-label="${n} pen"><i style="background:${c}"></i></button>`).join("") +
      `<button type="button" data-t="hl" title="Highlighter" aria-label="Highlighter"><i style="background:${HL};border-radius:3px"></i></button>` +
      `<button type="button" data-t="eraser" title="Eraser: touch a drawing to remove it" aria-label="Eraser">⌫</button>` +
      `<button type="button" data-undo title="Undo" aria-label="Undo">↶</button>` +
      `<button type="button" data-done class="ink-done">Done</button>`;
    document.body.appendChild(pal);
    const st = document.createElement("style");
    st.textContent = `.ink-pal{position:fixed;left:50%;bottom:max(14px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:20;display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:16px;background:#1c1c1c;box-shadow:0 8px 28px rgba(0,0,0,.35);max-width:calc(100% - 20px);flex-wrap:wrap;justify-content:center}
      .ink-pal[hidden]{display:none}
      .ink-pal button{min-width:44px;min-height:44px;border-radius:12px;border:1px solid #3a3a3a;background:#2a2a2a;color:#f2efe8;font:16px system-ui,sans-serif;display:grid;place-items:center;padding:0 10px;cursor:pointer}
      .ink-pal button[aria-pressed="true"]{border-color:#c9a46a;box-shadow:inset 0 0 0 2px #c9a46a}
      .ink-pal i{display:block;width:20px;height:20px;border-radius:50%;border:2px solid #fff3}
      .ink-pal .ink-done{background:#c9a46a;color:#1a1a1a;border-color:#c9a46a;font-weight:600}
      .ink-hint{color:#a8a29a;font:13px system-ui,sans-serif;padding:0 6px;max-width:220px}`;
    document.head.appendChild(st);
    function syncPal() {
      pal.querySelectorAll("[data-c]").forEach(b => b.setAttribute("aria-pressed", tool === "pen" && b.dataset.c === color));
      pal.querySelectorAll("[data-t]").forEach(b => b.setAttribute("aria-pressed", tool === b.dataset.t));
      pal.querySelector(".ink-hint").textContent = tool === "eraser" ? "Touch a drawing to remove it" : (o.hint || "");
    }
    pal.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.c) { tool = "pen"; color = b.dataset.c; }
      else if (b.dataset.t) tool = tool === b.dataset.t ? "pen" : b.dataset.t;
      else if (b.hasAttribute("data-undo")) { const u = undo.pop(); if (u) { const l = data[u.k] = data[u.k] || []; if (u.op === "add") { const i = l.lastIndexOf(u.s); if (i >= 0) l.splice(i, 1); } else l.splice(u.i, 0, u.s); if (!l.length) delete data[u.k]; save(); render(); } }
      else if (b.hasAttribute("data-done")) return exit();
      syncPal();
    });

    function enter() { on = true; cap.style.display = "block"; pal.hidden = false; syncPal(); o.onEnter && o.onEnter(); render(); }
    function exit() { on = false; sel = null; selKey = null; cur = null; cap.style.display = "none"; pal.hidden = true; o.onExit && o.onExit(); render(); }
    function reload() { try { data = JSON.parse(localStorage.getItem(o.store) || "{}"); } catch (e) {} undo = []; render(); }
    addEventListener("vault-sync", e => { if (e.detail.includes(o.store) && !cur) reload(); });
    return { layer: svg, render, enter, exit, reload, get active() { return on; }, get count() { return Object.values(data).reduce((n, l) => n + l.length, 0); } };
  }
  window.Ink = { create };
})();
