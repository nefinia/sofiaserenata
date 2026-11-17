// Builds fr/, es/ and de/ from index.html: the same page with its text already in the
// page's own language, so search engines and AI tools read it without running scripts.
// Run after changing index.html:  node tools/build-languages.mjs  (then build-cities.mjs)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://sofiaserenata.com";
const src = readFileSync(join(root, "index.html"), "utf8");

const m = src.match(/const dict=\{[\s\S]*?\n\};/);
if (!m) throw new Error("index.html no longer has the dict");
const dict = new Function("return " + m[0].replace(/^const dict=/, "").replace(/;$/, ""))();

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const escAttr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const must = (re, html, what) => { if (!re.test(html)) throw new Error("index.html no longer has: " + what); };

for (const L of ["fr", "es", "de"]) {
  const t = dict[L];
  const url = `${SITE}/${L}/`;
  let h = src;

  must(/<html lang="en">/, h, "<html lang>");
  h = h.replace(/<html lang="en">/, `<html lang="${L}" data-langpage="${L}" data-canonical="${url}">`);

  h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(t.pageTitle)}</title>`);
  h = h.replace(/(<meta name="description" content=")[^"]*(")/, `$1${escAttr(t.pageDescription)}$2`);
  h = h.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`);
  h = h.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${escAttr(t.pageTitle.split(" | ")[0])}$2`);
  h = h.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${escAttr(t.pageDescription)}$2`);
  h = h.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`);

  h = h.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/, (_, a, json, c) => {
    const d = JSON.parse(json);
    d.description = t.pageDescription;
    d.url = url;
    return a + JSON.stringify(d) + c;
  });

  // visible text in the page's own language
  let n = 0;
  h = h.replace(/(<([a-zA-Z0-9]+)\b[^>]*\sdata-t="(\w+)"[^>]*>)([^<]*)(<\/\2>)/g, (all, open, tag, key, body, close) => {
    const v = t[key];
    if (typeof v !== "string") return all;
    n++;
    return open + esc(v) + close;
  });
  h = h.replace(/(<([a-zA-Z0-9]+)\b[^>]*\sdata-t-html="(\w+)"[^>]*>)([\s\S]*?)(<\/\2>)/g, (all, open, tag, key, body, close) => {
    const v = t[key];
    if (typeof v !== "string") return all;
    n++;
    return open + v + close;
  });
  h = h.replace(/<[a-zA-Z0-9]+\b[^>]*\sdata-p="(\w+)"[^>]*>/g, (tagStr, key) => {
    const v = t[key];
    if (typeof v !== "string") return tagStr;
    n++;
    return tagStr.replace(/placeholder="[^"]*"/, `placeholder="${escAttr(v)}"`);
  });

  // pages live one folder down: relative links and assets go up one level
  h = h.replace(/\b(src|href)="(?!https?:|#|mailto:|\/|data:|\$\{)([^"]+)"/g, '$1="../$2"');
  h = h.replace("`thumbs/${id}.jpg`", "`../thumbs/${id}.jpg`");
  h = h.replace('lg.href="mentions-legales/?lang="', 'lg.href="../mentions-legales/?lang="');

  mkdirSync(join(root, L), { recursive: true });
  writeFileSync(join(root, L, "index.html"), h);
  console.log("wrote", `${L}/index.html`, `(${n} texts in ${L})`);
}
