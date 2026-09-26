# Brand fonts

| File | Family | Role | Source |
|---|---|---|---|
| `Piazzolla-SemiBold.ttf` | Piazzolla 600 | Display: screen titles, dish names | Huerta Tipográfica, via Google Fonts |
| `Commissioner-Regular.ttf` | Commissioner 400 | Body text | Kostas Bartsokas, via Google Fonts |
| `Commissioner-Medium.ttf` | Commissioner 500 | Labels, prices | 〃 |
| `Commissioner-SemiBold.ttf` | Commissioner 600 | Buttons, emphasis | 〃 |

Both families are licensed under the SIL Open Font License 1.1 (see the
`*-OFL.txt` files), which permits bundling and subsetting.

Chosen because the product is Greek-first: both families ship complete
monotonic Greek. (The first design pass used Fraunces / Work Sans, which have
no Greek glyphs at all, so every Greek string fell back to a system font.)

The files are subset to Basic Latin, Latin-1, Greek & Coptic, general
punctuation and the euro sign, which cuts download size roughly in half for
the web build. Re-subset from the originals if a new script is ever needed:

    pyftsubset <original.ttf> --layout-features='*' --no-hinting \
      --unicodes="U+0020-007E,U+00A0-00FF,U+0370-03FF,U+2010-2027,U+2030-203A,U+20AC,U+2212"
