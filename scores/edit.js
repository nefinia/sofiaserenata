/* Score corrections for the Fit viewer.
   Edits are a list of small operations ("ops") replayed on the original MusicXML, so the library file is never changed.
   Every <note> gets a stable id from its position in the ORIGINAL file (e<part>-<bar>-<n>); notes created by an edit get new ids.
   Ops:  {t:"p", id, s:"C".."B", o:octave, a:alter, acc:"sharp|flat|natural"|null}   set pitch (turns a rest into a note)
         {t:"d", id, ty:"eighth", dt:0|1}                                          set note value (fills with rests / takes from the next notes)
         {t:"r", id}                                                                  note -> rest (or drop a chord note)
         {t:"tie", id}                                                                toggle a tie to the next note
   Saved in localStorage "ed:<score key>" (synced between a login's devices like drawings). */
(function () {
  const STEPS = "CDEFGAB", SHARPS = "FCGDAEB";
  const QV = { whole: 4, half: 2, quarter: 1, eighth: 0.5, "16th": 0.25, "32nd": 0.125, "64th": 0.0625 };
  const TYPES = ["whole", "half", "quarter", "eighth", "16th", "32nd"];
  const ORDER = ["grace", "chord", "pitch", "unpitched", "rest", "duration", "tie", "cue", "instrument", "voice", "type", "dot", "accidental", "time-modification", "stem", "notehead", "notehead-text", "staff", "beam", "notations", "lyric", "play", "listen"];
  const parse = x => new DOMParser().parseFromString(x, "application/xml");
  const ser = d => new XMLSerializer().serializeToString(d);
  const kids = (el, tag) => [...el.children].filter(c => c.tagName === tag);
  const kid = (el, tag) => [...el.children].find(c => c.tagName === tag) || null;
  const txt = (el, tag) => { const k = el && kid(el, tag); return k ? k.textContent.trim() : null; };
  function put(note, el) { // insert child at its schema position
    const i = ORDER.indexOf(el.tagName); const after = [...note.children].find(c => ORDER.indexOf(c.tagName) > i);
    note.insertBefore(el, after || null); return el; }
  function mk(doc, tag, text, attrs) { const e = doc.createElement(tag); if (text != null) e.textContent = text; for (const k in attrs || {}) e.setAttribute(k, attrs[k]); return e; }
  function rm(el, tag) { kids(el, tag).forEach(c => el.removeChild(c)); }

  /* ---------- ids ---------- */
  function prepare(xml) {
    const d = parse(xml);
    [...d.getElementsByTagName("part")].forEach((p, pi) => kids(p, "measure").forEach((m, mi) => {
      let n = 0; kids(m, "note").forEach(no => no.setAttribute("id", `e${pi}-${mi}-${n++}`)); }));
    return ser(d);
  }

  /* ---------- measure context: divisions, key, time ---------- */
  function ctxOf(m) { // walk the part up to (and including) this measure's attributes
    const part = m.parentNode; let div = 1, fifths = 0, beats = 4, bt = 4;
    for (const mm of kids(part, "measure")) {
      for (const a of kids(mm, "attributes")) {
        const dv = txt(a, "divisions"); if (dv) div = +dv;
        const k = kid(a, "key"); if (k && txt(k, "fifths") != null) fifths = +txt(k, "fifths");
        const t = kid(a, "time"); if (t && txt(t, "beats")) { beats = +txt(t, "beats").split("+")[0]; bt = +txt(t, "beat-type"); }
      }
      if (mm === m) break;
    }
    return { div, fifths, beats, bt };
  }
  const keyAlter = (fifths, step) => fifths > 0 ? (SHARPS.slice(0, fifths).includes(step) ? 1 : 0) : fifths < 0 ? (SHARPS.split("").reverse().join("").slice(0, -fifths).includes(step) ? -1 : 0) : 0;
  function scaleDivisions(part, f) { // multiply every duration in the part (to fit a shorter note value)
    for (const m of kids(part, "measure")) for (const c of m.children) {
      if (c.tagName === "attributes") { const dv = kid(c, "divisions"); if (dv) dv.textContent = String(+dv.textContent * f); }
      if (["note", "backup", "forward"].includes(c.tagName)) { const du = kid(c, "duration"); if (du) du.textContent = String(+du.textContent * f); }
    }
  }

  /* ---------- reading ---------- */
  function noteInfo(note) {
    const p = kid(note, "pitch"), isRest = !!kid(note, "rest");
    return { rest: isRest, s: p ? txt(p, "step") : null, o: p ? +txt(p, "octave") : null, a: p ? +(txt(p, "alter") || 0) : 0,
      ty: txt(note, "type") || "quarter", dt: kids(note, "dot").length, tup: !!kid(note, "time-modification"), grace: !!kid(note, "grace"),
      chord: !!kid(note, "chord"), tie: kids(note, "tie").some(t => t.getAttribute("type") === "start") };
  }
  const voiceOf = n => (txt(n, "voice") || "1") + "/" + (txt(n, "staff") || "1");
  function chordHead(note) { let n = note; while (n && kid(n, "chord")) { n = n.previousElementSibling; while (n && n.tagName !== "note") n = n.previousElementSibling; } return n || note; }
  function chordGroup(head) { const g = [head]; let n = head.nextElementSibling; while (n && n.tagName === "note" && kid(n, "chord")) { g.push(n); n = n.nextElementSibling; } return g; }
  function headsInVoice(m, v) { return kids(m, "note").filter(n => !kid(n, "chord") && !kid(n, "grace") && voiceOf(n) === v); }

  /* ---------- operations ---------- */
  function setPitch(doc, note, op) {
    const ctx = ctxOf(note.parentNode);
    if (kid(note, "rest")) { rm(note, "rest"); put(note, mk(doc, "pitch")); note.removeAttribute("print-object"); }
    let p = kid(note, "pitch"); if (!p) p = put(note, mk(doc, "pitch"));
    p.textContent = ""; p.appendChild(mk(doc, "step", op.s)); if (op.a) p.appendChild(mk(doc, "alter", String(op.a))); p.appendChild(mk(doc, "octave", String(op.o)));
    rm(note, "accidental"); if (op.acc) put(note, mk(doc, "accidental", op.acc));
    void ctx;
  }
  function toRest(doc, note) {
    if (kid(note, "chord")) { note.parentNode.removeChild(note); return; }
    const g = chordGroup(note);
    if (g.length > 1) { rm(g[1], "chord"); note.parentNode.removeChild(note); return; }
    rm(note, "pitch"); put(note, mk(doc, "rest"));
    ["accidental", "tie", "stem", "notehead", "lyric"].forEach(t => rm(note, t));
    const nots = kid(note, "notations"); if (nots) { rm(nots, "tied"); rm(nots, "slur"); if (!nots.children.length) note.removeChild(nots); }
  }
  function restNote(doc, ref, dur, ty, dt) { // a rest in the same voice/staff as ref
    const r = mk(doc, "note"); r.setAttribute("id", "x" + Math.random().toString(36).slice(2, 9));
    put(r, mk(doc, "rest")); put(r, mk(doc, "duration", String(dur)));
    put(r, mk(doc, "voice", txt(ref, "voice") || "1")); put(r, mk(doc, "type", ty)); for (let i = 0; i < dt; i++) put(r, mk(doc, "dot"));
    const st = txt(ref, "staff"); if (st) put(r, mk(doc, "staff", st));
    return r;
  }
  function restsFor(doc, ref, units, div) { // split a gap (in divisions) into plain rests
    const out = []; let left = units;
    for (const ty of TYPES) { const d = QV[ty] * div; while (d >= 1 && Number.isInteger(d) && left >= d) { out.push(restNote(doc, ref, d, ty, 0)); left -= d; } }
    return { rests: out, left };
  }
  function setValue(doc, head, op) {
    const m = head.parentNode, part = m.parentNode;
    if (kid(head, "time-modification")) return "tuplet";
    let ctx = ctxOf(m);
    const want = QV[op.ty] * (op.dt ? 1.5 : 1);
    let f = 1; while (!Number.isInteger(want * ctx.div * f) && f < 64) f *= 2;
    if (f > 1) { scaleDivisions(part, f); ctx = ctxOf(m); }
    const newD = want * ctx.div, oldD = +txt(head, "duration");
    const v = voiceOf(head), seq = headsInVoice(m, v), i = seq.indexOf(head);
    let delta = newD - oldD;
    const setDur = (n, d) => { for (const x of chordGroup(n)) { kid(x, "duration").textContent = String(d); const t = kid(x, "type") || put(x, mk(doc, "type")); t.textContent = op.ty; rm(x, "dot"); if (op.dt) put(x, mk(doc, "dot")); } };
    if (delta < 0) { // shorter: fill with rests after it
      setDur(head, newD);
      const g = chordGroup(head), last = g[g.length - 1];
      const { rests } = restsFor(doc, head, -delta, ctx.div); let at = last.nextSibling;
      for (const r of rests) m.insertBefore(r, at);
      return;
    }
    // longer: take time from the following notes/rests of the same voice in this bar
    let avail = 0; for (let k = i + 1; k < seq.length; k++) avail += +txt(seq[k], "duration");
    if (delta > avail) return "bar";
    let took = 0, k = i + 1, lastRemoved = null;
    while (took < delta && k < seq.length) {
      const n = seq[k++], d = +txt(n, "duration"); took += d; lastRemoved = n;
      for (const x of chordGroup(n)) { if (x === n) continue; x.parentNode.removeChild(x); }
      if (took > delta) { const { rests } = restsFor(doc, head, took - delta, ctx.div); for (const r of rests) m.insertBefore(r, n); }
      n.parentNode.removeChild(n);
    }
    setDur(head, newD); void lastRemoved;
  }
  function nextInVoice(note) { // the following head in the same voice, possibly in the next bar
    const v = voiceOf(note), m = note.parentNode, seq = headsInVoice(m, v), i = seq.indexOf(chordHead(note));
    if (i + 1 < seq.length) return seq[i + 1];
    const ms = kids(m.parentNode, "measure"), j = ms.indexOf(m); return j + 1 < ms.length ? headsInVoice(ms[j + 1], v)[0] || null : null;
  }
  function toggleTie(doc, note) {
    const on = kids(note, "tie").some(t => t.getAttribute("type") === "start");
    const nx = nextInVoice(note);
    const nots = n => kid(n, "notations") || put(n, mk(doc, "notations"));
    const drop = (n, type) => { kids(n, "tie").filter(t => t.getAttribute("type") === type).forEach(t => n.removeChild(t)); const ns = kid(n, "notations"); if (ns) { kids(ns, "tied").filter(t => t.getAttribute("type") === type).forEach(t => ns.removeChild(t)); if (!ns.children.length) n.removeChild(ns); } };
    if (on) { drop(note, "start"); if (nx) drop(nx, "stop"); return; }
    if (!nx || !kid(nx, "pitch") || !kid(note, "pitch")) return "tie";
    const p = kid(note, "pitch"), q = kid(nx, "pitch");
    if (txt(p, "step") !== txt(q, "step") || txt(p, "octave") !== txt(q, "octave")) return "tie";
    put(note, mk(doc, "tie", null, { type: "start" })); nots(note).appendChild(mk(doc, "tied", null, { type: "start" }));
    put(nx, mk(doc, "tie", null, { type: "stop" })); nots(nx).insertBefore(mk(doc, "tied", null, { type: "stop" }), nots(nx).firstChild);
  }

  /* ---------- beams, per bar, grouped by beat (same rule as the library's transcriptions) ---------- */
  const LEVEL = { eighth: 1, "16th": 2, "32nd": 3, "64th": 4 };
  function rebeam(doc, m) {
    const ctx = ctxOf(m); const bl = (ctx.bt >= 8 && ctx.beats % 3 === 0 && ctx.beats > 3) ? 12 / ctx.bt : ctx.bt === 2 ? 1 : 4 / ctx.bt;
    [...m.getElementsByTagName("beam")].forEach(b => b.parentNode.removeChild(b));
    const ev = {}; let pos = 0;
    for (const c of m.children) {
      if (c.tagName === "backup") pos -= +txt(c, "duration") / ctx.div;
      else if (c.tagName === "forward") pos += +txt(c, "duration") / ctx.div;
      else if (c.tagName === "note") {
        if (kid(c, "grace") || kid(c, "chord")) continue;
        const v = voiceOf(c); (ev[v] = ev[v] || []).push({ n: c, pos, lv: kid(c, "rest") ? 0 : (LEVEL[txt(c, "type")] || 0) });
        pos += +txt(c, "duration") / ctx.div;
      }
    }
    const beam = (g) => { if (g.length < 2) return; const mx = Math.max(...g.map(x => x.lv));
      for (let L = 1; L <= mx; L++) g.forEach((x, i) => { if (x.lv < L) return; let val;
        if (L === 1) val = i === 0 ? "begin" : i === g.length - 1 ? "end" : "continue";
        else { const p = i > 0 && g[i - 1].lv >= L, nx = i < g.length - 1 && g[i + 1].lv >= L; val = p && nx ? "continue" : p ? "end" : nx ? "begin" : i === 0 ? "forward hook" : "backward hook"; }
        put(x.n, mk(doc, "beam", val, { number: L })); }); };
    for (const list of Object.values(ev)) { let g = [], gb = null;
      for (const x of list) { const b = Math.floor(x.pos / bl + 1e-6); if (!x.lv || b !== gb) { beam(g); g = []; } if (x.lv) { g.push(x); gb = b; } else gb = null; }
      beam(g); }
  }

  function apply(xml, ops) {
    if (!ops || !ops.length) return { xml, errs: [] };
    const doc = parse(xml), errs = [], touched = new Set();
    const byId = id => doc.querySelector(`note[id="${id}"]`);
    for (const op of ops) {
      const n = byId(op.id); if (!n) { errs.push("missing"); continue; }
      let r;
      if (op.t === "p") setPitch(doc, n, op);
      else if (op.t === "d") { r = setValue(doc, chordHead(n), op); touched.add(n.parentNode); }
      else if (op.t === "r") { const m = n.parentNode; toRest(doc, n); touched.add(m); }
      else if (op.t === "tie") r = toggleTie(doc, n);
      if (r) errs.push(r);
    }
    touched.forEach(m => { if (m.parentNode) rebeam(doc, m); });
    return { xml: ser(doc), errs };
  }
  function info(xml, id) { const d = parse(xml), n = d.querySelector(`note[id="${id}"]`); if (!n) return null; const i = noteInfo(n); i.ctx = ctxOf(n.parentNode); return i; }
  /* reading order for moving the selection with ←/→: part, bar, then document order */
  function order(xml) { const d = parse(xml), out = []; [...d.getElementsByTagName("note")].forEach(n => { if (!kid(n, "grace")) out.push(n.getAttribute("id")); }); return out.filter(Boolean); }

  /* ---------- repeats written out (same rules as the library's "continuous" files) ---------- */
  function minfo(m) {
    const d = { fwd: false, bwd: 0, ending: null, segno: false, coda: false, tocoda: false, ds: false, dc: false, fine: false };
    for (const b of kids(m, "barline")) {
      const r = kid(b, "repeat"); if (r) { if (r.getAttribute("direction") === "forward") d.fwd = true; else d.bwd = +(r.getAttribute("times") || 2); }
      const e = kid(b, "ending"); if (e && e.getAttribute("type") === "start") d.ending = ((e.getAttribute("number") || "").match(/\d+/g) || []).map(Number);
    }
    for (const dr of m.getElementsByTagName("direction")) {
      const words = [...dr.getElementsByTagName("words")].map(w => w.textContent || "").join(" ");
      if (dr.getElementsByTagName("segno").length) d.segno = true;
      if (/to\s*coda/i.test(words)) d.tocoda = true; else if (dr.getElementsByTagName("coda").length) d.coda = true;
      if (/^\s*D\.?\s*S\.?(\s|$|al)/.test(words)) d.ds = true;
      if (/^\s*D\.?\s*C\.?(\s|$|al)/.test(words)) d.dc = true;
      if (/\bFine\b/.test(words)) d.fine = true;
    }
    for (const s of m.getElementsByTagName("sound")) { if (s.getAttribute("dalsegno")) d.ds = true; if (s.getAttribute("dacapo")) d.dc = true; if (s.getAttribute("tocoda")) d.tocoda = true; }
    return d;
  }
  function playOrder(ms) {
    const I = ms.map(minfo), N = ms.length, endnum = new Array(N).fill(null); let cur = null;
    I.forEach((x, i) => { if (x.ending) cur = x.ending; endnum[i] = cur; if (cur && (x.bwd || (i + 1 < N && !I[i + 1].ending && Math.max(...cur) > 1))) cur = null; });
    const segnoI = I.findIndex(x => x.segno), segno = segnoI < 0 ? 0 : segnoI, coda = I.map((x, i) => x.coda ? i : -1).filter(i => i >= 0);
    const repAfter = endnum.some(e => e && Math.max(...e) > 2);
    const out = []; let pos = 0, start = 0, passn = 1, base = 0, cnt = {}, jumped = false, guard = 0;
    while (pos < N && guard++ < 5000) {
      const x = I[pos];
      if (x.fwd && !cnt["s" + pos]) { start = pos; passn = base + 1; cnt["s" + pos] = 1; }
      const allow = !jumped || repAfter;
      if (endnum[pos] && !endnum[pos].includes(passn) && allow) { pos++; continue; }
      out.push(pos);
      if (x.tocoda && jumped && coda.length) { const t = coda.filter(c => c > pos); pos = t.length ? t[0] : pos + 1; continue; }
      if (x.fine && jumped) break;
      if (x.bwd && allow) { const k = "b" + pos, c = cnt[k] || 1; if (c < x.bwd) { cnt[k] = c + 1; passn = base + c + 1; pos = start; cnt["s" + start] = 1; continue; } }
      if ((x.ds || x.dc) && !jumped) { jumped = true; pos = x.ds ? segno : 0;
        if (repAfter) { base = 2; passn = 3; for (const k of Object.keys(cnt)) if (k[0] === "b" || k[0] === "s") delete cnt[k]; } else passn = 99; continue; }
      if (x.bwd) { start = pos + 1; passn = base + 1; }
      pos++;
    }
    return out;
  }
  function unroll(xml) {
    const d = parse(xml);
    for (const part of d.getElementsByTagName("part")) {
      const ms = kids(part, "measure"), o = playOrder(ms), seen = {};
      ms.forEach(m => part.removeChild(m));
      o.forEach((i, k) => {
        const m = ms[i].cloneNode(true); m.setAttribute("number", String(k + 1));
        const rep = seen[i] = (seen[i] || 0) + 1;
        if (rep > 1) [...m.getElementsByTagName("note")].forEach(n => { const id = n.getAttribute("id"); if (id) n.setAttribute("id", id + "~" + rep); });
        for (const b of kids(m, "barline")) { [...b.children].forEach(c => { if (["repeat", "ending", "segno", "coda"].includes(c.tagName)) b.removeChild(c); }); if (!b.children.length) m.removeChild(b); }
        for (const dr of [...m.getElementsByTagName("direction")]) { const w = [...dr.getElementsByTagName("words")].map(x => x.textContent || "").join(" ");
          if (dr.getElementsByTagName("segno").length || dr.getElementsByTagName("coda").length || /^\s*(D\.?\s*[SC]\.?(\s|$|al)|To\s*Coda|Fine\b)/i.test(w)) dr.parentNode.removeChild(dr); }
        for (const s of m.getElementsByTagName("sound")) ["dalsegno", "dacapo", "tocoda", "coda", "segno", "fine"].forEach(a => s.removeAttribute(a));
        part.appendChild(m);
      });
    }
    return ser(d);
  }

  /* pitch arithmetic for the ▲/▼ buttons: one scale step, accidental from the key signature */
  function stepPitch(i, dir) {
    let si = STEPS.indexOf(i.s) + dir, o = i.o;
    if (si > 6) { si = 0; o++; } if (si < 0) { si = 6; o--; }
    const s = STEPS[si]; return { s, o, a: keyAlter(i.ctx.fifths, s), acc: null };
  }
  function withAcc(i, a) { return { s: i.s, o: i.o, a, acc: a === 1 ? "sharp" : a === -1 ? "flat" : "natural" }; }

  window.ScoreEdit = { prepare, apply, info, order, unroll, stepPitch, withAcc, keyAlter };
})();
