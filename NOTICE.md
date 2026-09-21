# Third-party notices

ph-winds is MIT licensed (see `LICENSE`). It contains the following third-party
material.

## Bravura, in the card icons (SIL Open Font License 1.1)

The eleven `music:` card icons in `src/components/cardIcons.tsx` — treble and
bass clef, sharp, flat, natural, repeat sign, fermata, coda, segno, quarter
note and eighth-note pair — are inline SVG paths converted from glyph outlines
in [Bravura](https://github.com/steinbergmedia/bravura), designed by Daniel
Spreadbury for Steinberg Media Technologies and released under the SIL Open
Font License 1.1. Each was converted from the font's 1000-unit em into the
shared 24x24 viewBox (y flipped, curves kept). Two are composites rather than
single glyphs, because SMuFL has no glyph for them: the repeat sign is drawn
from barlines and dots, and the beamed pair is two noteheads plus stems and a
beam. Both are built from Bravura parts.

The source outlines are the Verovio glyph data vendored in this repo at
`fonts/verovio/Bravura.zip`; the full licence text is at `fonts/OFL.txt`.

These are drawings made from the font's outlines, not a font and not a derived
font, so the OFL's Reserved Font Name clause does not apply and nothing in
`cardIcons.tsx` is distributed as Font Software. The notice is here because
attribution costs nothing and the provenance of a glyph shape is worth being
able to trace.

No Bravura font file is bundled with the icons — they are path data in a
TypeScript source file, with no webfont, no sprite and no icon package.

The seven `obj:` icons in the same file (saxophone, clarinet, reed, music
stand, microphone, metronome, tuning fork) are original hand-authored drawings.
They follow Lucide's *conventions* — 24x24, no fill, round caps and joins,
because that is the house style for a stroke icon — but no Lucide path data is
copied and no licence is owed on them.

## Bravura and Petaluma, in the notation renderer (SIL Open Font License 1.1)

`fonts/verovio/Bravura.zip` and `fonts/verovio/Petaluma.zip` are Verovio
custom-font archives (bounding-box XML plus per-glyph SVG paths) for
[Bravura](https://github.com/steinbergmedia/bravura) and
[Petaluma](https://github.com/steinbergmedia/petaluma), both by Steinberg Media
Technologies under the SIL Open Font License 1.1. They are registered with
Verovio at runtime so staff engraving uses these repo-bundled fonts. The full
licence text is at `fonts/OFL.txt`; see `fonts/verovio/README.md` for how the
archives are built and why the upstream embedded woff2 is stripped from them.

## Verovio (LGPL-3.0)

Staff notation is rendered by [Verovio](https://www.verovio.org/), which is
licensed under the LGPL-3.0 and consumed as an unmodified npm dependency.
