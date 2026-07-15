# Mongchi App Store Screenshots

This folder keeps the App Store screenshot pipeline's structural reference. The approved final
exports themselves live under `docs/release/store-assets/v4-pixel/` (release evidence, not design
contract), documented in `docs/release/store-assets/v4-pixel/README.md`.

## Final exports

The release-ready set is `../../release/store-assets/v4-pixel/final/`. English lives directly in
that folder; the seven localized sets live in locale subfolders. Every locale
contains the same six-slide sequence at 1320 x 2868 px in opaque RGB PNG format.

`outputs/v2/` and `outputs/v3/` (superseded visual history) were removed in the docs
reorganization; git history still has them if a past iteration needs to be recovered.

## Reference and working files

- `docs/archive/app-store-references/moshi-kids-structure/` preserves the cropped reference strip
  and its four readable panels (moved to archive since it is historical reference only, not an
  active contract).
- Masks, intermediate crops, previews, thumbnails, and superseded compositions are disposable and are not retained in the repository.
- Only approved exports under `../../release/store-assets/v4-pixel/final/` should be used as App Store upload artifacts.

Localized screenshot sets preserve the same six-slide order and visual composition.

## Pixel storefront set

The current pixel-art storefront compositions are under `../../release/store-assets/v4-pixel/`.

- `backgrounds/ko-KR/05-shop-base.png` is decorative background art only. Real shop captures are composited by `scripts/store-screenshots/render_v4_pixel.py`; generated or invented shop UI must not appear behind them.
- `scripts/store-screenshots/raw/<locale>/4-chat-original-history.png` preserves each live localized conversation capture. `localize_chat_captures.py` replaces only the four marketing conversation bodies and leaves app chrome unchanged.
- English plus `ko-KR`, `ja-JP`, `zh-TW`, `de-DE`, `fr-FR`, `pt-BR`, and `es-MX` exports are 1320 x 2868 RGB PNGs under `../../release/store-assets/v4-pixel/final/`.
- Review sheets for every localized set are under `../../release/store-assets/v4-pixel/contact-sheets/`.

## Note on `render_v4_pixel.py`

`scripts/store-screenshots/render_v4_pixel.py`'s `V4_DIR` constant still points at
`docs/design/app-store/outputs/v4-pixel`, which no longer exists after this move. That script is a
`.py` file, outside this docs-only pass's permitted scope (only `scripts/*.mjs` path constants were
in scope) — updating it to `docs/release/store-assets/v4-pixel` is flagged as separate follow-up
work. Do not re-run the script until that constant is fixed, or it will recreate a stale
`docs/design/app-store/outputs/v4-pixel` directory instead of writing into the tracked location.
