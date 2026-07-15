# V4 Pixel Screenshot QA

## Result

- Six final PNG files render at `1320 x 2868`.
- The contact sheet was visually inspected at original resolution.
- Headline and subtitle copy remain inside the top safe area on every slide.
- External headline copy is rendered directly into the pixel scene without
  pastel pills, rounded cards, or detached labels.
- The golden retriever source photo is used in the transformation hero.

## Runtime Audit

1. Hypothesis: ImageGen may have altered the supplied in-app UI.
   Evidence: the renderer replaces every generated phone interior with the
   current raw capture. Pixel comparisons for all six front screens and the
   visible rear shop screen report a maximum RGB delta of `0` away from masked
   corners.
2. Hypothesis: generated source aspect ratios may produce invalid App Store
   output dimensions.
   Evidence: all six final files report exactly `1320 x 2868` after rendering.
3. Hypothesis: decorative framing may clip titles, controls, or the pet.
   Evidence: full-resolution inspection of all six outputs and the contact
   sheet found no clipped headline, dynamic island, CTA, input control, pet, or
   shop item grid.

## Verification

```sh
python3 scripts/store-screenshots/render_v4_pixel.py
python3 -m py_compile scripts/store-screenshots/render_v4_pixel.py
```

`uv` and `ruff` are not installed in the current shell, so strict linting was
not available. The renderer completed successfully and Python bytecode
compilation passed.
