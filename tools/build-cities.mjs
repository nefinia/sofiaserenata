// Builds london/, brussels/ and zurich/ from index.html and assets/js/cities.js.
// Run after changing either file:  node tools/build-cities.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://sofiaserenata.com";
const src = readFileSync(join(root, "index.html"), "utf8");

const window = {};
new Function("window", readFileSync(join(root, "assets/js/cities.js"), "utf8"))(window);
const CITIES = window.CITIES;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const must = (re, html, what) => {
  if (!re.test(html)) throw new Error("index.html no longer has: " + what);
};

for (const [slug, city] of Object.entries(CITIES)) {
  const L = city.lang;
  const t = city[L];
  const url = `${SITE}/${slug}/`;
  let h = src;

  // <html> attributes
  must(/<html lang="en">/, h, "<html lang>");
  h = h.replace(/<html lang="en">/, `<html lang="${L}" data-city="${slug}" data-canonical="${url}">`);

  // head: title, description, canonical, hreflang, Open Graph
  h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(t.pageTitle)}</title>`);
  h = h.replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(t.pageDescription)}$2`);
  h = h.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`);
  h = h.replace(/(<link rel="alternate" hreflang="(?:en|fr|es|de)" href=")[^"]*(")/g, (_, a, b) => a + url + "?lang=" + _.match(/hreflang="(\w+)"/)[1] + b);
  h = h.replace(/(<link rel="alternate" hreflang="x-default" href=")[^"]*(")/, `$1${url}$2`);
  h = h.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(t.pageTitle.split(" | ")[0])}$2`);
  h = h.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(t.pageDescription)}$2`);
  h = h.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`);

  // structured data: same business, this city added to the served areas
  h = h.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/, (_, a, json, c) => {
    const d = JSON.parse(json);
    d["@id"] = `${url}#music`;
    d.url = url;
    d.description = t.pageDescription;
    d.areaServed = [...d.areaServed, { "@type": "City", name: city.name.en }];
    return a + JSON.stringify(d) + c;
  });

  // hero text in the page's own language, so it is in the HTML for search engines
  for (const key of ["heroEyebrow", "tagline", "heroIntro"]) {
    const re = new RegExp(`(data-t="${key}">)[^<]*(<)`);
    must(re, h, `data-t="${key}"`);
    h = h.replace(re, `$1${esc(t[key]).replace(/&quot;/g, '"')}$2`);
  }

  // pages live one folder down: relative links and assets go up one level
  h = h.replace(/\b(src|href)="(?!https?:|#|mailto:|\/|data:|\$\{)([^"]+)"/g, '$1="../$2"');
  h = h.replace("`thumbs/${id}.jpg`", "`../thumbs/${id}.jpg`");
  h = h.replace('lg.href="mentions-legales/?lang="', 'lg.href="../mentions-legales/?lang="');

  mkdirSync(join(root, slug), { recursive: true });
  writeFileSync(join(root, slug, "index.html"), h);
  console.log("wrote", `${slug}/index.html`);
}
