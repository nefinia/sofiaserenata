# Score pipeline (Sofia's violin + cello duets)

Sofia plays violin-cello duets with Claire. Standing wishes: every score Claude generates is delivered as
**MusicXML + PDF (+ MIDI)** and added to the library at sofiaserenata.com/scores, with the **composer/author printed**
and **bowings/slurs checked against the original**. Violin and cello parts should each fit **one page** when short enough.

## Tools (this folder, Python 3 + music21 + verovio + playwright + pypdf; node for the vault)
- `gen.py` builds parts from text tokens (`NAME:DUR`, chords `[A,B]`, `~` tie, `!` natural; DUR w h q e s, dotted `q.`, triplets `te tq ts`, quintuplet `f`, 32nd `ss`; `clefs={bar: clef}` for clef changes).
- `post.py file.musicxml` strips `<metronome>` marks that print stray glyphs.
- `credits.py file "Title" "Composer" ["Arranger"]` adds title / composer (and "arranged by X" subtitle) credits. Strip `<page-layout>` and `<print new-system/new-page>` from imported files first or credits and layout break.
- `render.py out.pdf in.musicxml` (env `W=2200` or `PAGES=3`) renders A4 PDF. See its docstring for the spacing recipe.
- `example_cello_lead_arrangement.py`: swaps parts at XML level to make "cello leads, violin second voice" duets.

## Typical steps
1. Get the notes: from an attached .mxl (unzip `score.xml`), or transcribe from images (split work across subagents, then check visually).
2. Clean: strip layout/print breaks, run `post.py`, add credits, tempo words (use "𝅘𝅥 = N" U+1D15F, not ♩).
3. Arrange: split or merge parts with music21 or direct XML edits; check ranges, ties, repeats. For cello leading, put the melody in treble/bass clefs per bar, or drop an octave to keep bass clef readable.
4. Render PDF (score, plus one-page parts). Look at the pages before sending. Send MusicXML/MIDI/PDF with SendUserFile.
5. Add to the library (from /home/claude/sofiaserenata, clone of nefinia/sofiaserenata):
   `node tools/vault.mjs lock x-<slug> file.musicxml` and `node tools/vault.mjs lock m-<slug> file.mid`
   then `git add -A && git commit` and `git pull -q --rebase origin main && git push -q origin HEAD:main`.
   Commit trailers: "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" and "Claude-Session: <session url>".
6. PDFs go to the Google Drive "Scores" folder (id 1i63kLhNYG4Cxhj86_JRyYY1AgrJRA5YS). Uploading big PDFs via the connector's base64 create_file is impractical; do it through her browser if asked.
7. The catalog entries (vault/c-catalog, vault/c-pdfs) are encrypted and need her login, so Claude can't edit them. Tell her.

## Layout preferences learned
- Notes large and clear, systems packed close (small gaps between lines), more room inside measures than between systems.
- Instrument name on the first system only (drop abbreviations). No "Vc."/"Vln." labels on later lines.
- Cello-on-top scores use plain bass clef (move melody down an octave if needed).
- Long-note bars can be narrow (spacingLinear 0.2, spacingNonLinear 0.45).
- Fill all pages: use `fit_width(file, N)` for the biggest notes at N pages.

## Timings for set lists
Duration = notated bars (with repeats) x beats / tempo. Use the tempo marking; if none, state the assumed tempo. Round like Claire (whole minutes) only when asked.
