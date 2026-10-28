"""MusicXML -> PDF with verovio + Chromium (playwright). A4 pages.
Usage: python3 render.py out.pdf in.musicxml [more.musicxml]   (optional env W=2200 PAGES=3)
Verovio's `scale` option does nothing here: layout is controlled by pageWidth (smaller = bigger notes),
pageHeight = width*1.4142, spacingSystem/spacingStaff (gaps between lines), spacingLinear/NonLinear (bar widths).
Tips learned:
 - tight but clear: justifyVertically False, spacingSystem 2, spacingStaff 4, spacingLinear 0.2, spacingNonLinear 0.45
 - call fit_width(file, pages) to find the smallest pageWidth that still gives N pages (biggest notes)
 - strip <page-layout>, <system-layout>, <print new-system/new-page> from imported MusicXML first, or layout breaks
 - hide repeated instrument labels: delete <part-abbreviation> and <instrument-abbreviation>
"""
import io, os, sys, verovio
from pypdf import PdfWriter, PdfReader
from playwright.sync_api import sync_playwright
def opts(w, ss=2, st=4, lin=0.2, nl=0.45, just=False, margin=0.07):
    m = int(w*margin)
    return {'pageWidth': w, 'pageHeight': int(w*1.4142), 'adjustPageHeight': False, 'footer': 'none', 'breaks': 'auto',
            'pageMarginTop': m, 'pageMarginBottom': m, 'pageMarginLeft': m, 'pageMarginRight': m, 'svgViewBox': True,
            'justifyVertically': just, 'spacingSystem': ss, 'spacingStaff': st, 'spacingLinear': lin, 'spacingNonLinear': nl}
def pages(f, **kw):
    tk = verovio.toolkit(); tk.setOptions(opts(**kw)); tk.loadFile(f); return tk.getPageCount()
def fit_width(f, n, lo=1600, hi=3200, step=20, **kw):
    for w in range(lo, hi, step):
        if pages(f, w=w, **kw) <= n: return w
    return hi
def render(files, out, **kw):
    wr = PdfWriter()
    with sync_playwright() as pw:
        br = pw.chromium.launch(); pg = br.new_page()
        for f in files:
            tk = verovio.toolkit(); tk.setOptions(opts(**kw)); tk.loadFile(f)
            for i in range(1, tk.getPageCount()+1):
                html = '<html><head><style>@page{size:210mm 297mm;margin:0}html,body{margin:0;background:#fff}svg{display:block;width:210mm;height:297mm}</style></head><body>'+tk.renderToSVG(i)+'</body></html>'
                pg.set_content(html); wr.append(PdfReader(io.BytesIO(pg.pdf(width='210mm', height='297mm', print_background=True))))
        br.close()
    wr.write(out)
if __name__ == '__main__':
    out, files = sys.argv[1], sys.argv[2:]
    w = int(os.environ.get('W', 0)) or (fit_width(files[0], int(os.environ['PAGES'])) if os.environ.get('PAGES') else 2200)
    render(files, out, w=w)
