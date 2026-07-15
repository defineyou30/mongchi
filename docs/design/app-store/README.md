# Mongchi App Store Screenshots

This folder keeps the approved App Store visual set and the structural reference used to build it.

## Final exports

The release-ready set is `outputs/v4-pixel/final/`. English lives directly in
that folder; the seven localized sets live in locale subfolders. Every locale
contains the same six-slide sequence at 1320 x 2868 px in opaque RGB PNG format.

`outputs/v2/` and `outputs/v3/` are retained only as superseded visual history.

## Reference and working files

- `references/moshi-kids-structure/` preserves the cropped reference strip and its four readable panels.
- Masks, intermediate crops, previews, thumbnails, and superseded compositions are disposable and are not retained in the repository.
- Only approved exports under `outputs/v4-pixel/final/` should be used as App Store upload artifacts.

Localized screenshot sets preserve the same six-slide order and visual composition.

## Pixel storefront set

The current pixel-art storefront compositions are under `outputs/v4-pixel/`.

- `backgrounds/ko-KR/05-shop-base.png` is decorative background art only. Real shop captures are composited by `scripts/store-screenshots/render_v4_pixel.py`; generated or invented shop UI must not appear behind them.
- `scripts/store-screenshots/raw/<locale>/4-chat-original-history.png` preserves each live localized conversation capture. `localize_chat_captures.py` replaces only the four marketing conversation bodies and leaves app chrome unchanged.
- English plus `ko-KR`, `ja-JP`, `zh-TW`, `de-DE`, `fr-FR`, `pt-BR`, and `es-MX` exports are 1320 x 2868 RGB PNGs under `outputs/v4-pixel/final/`.
- Review sheets for every localized set are under `outputs/v4-pixel/contact-sheets/`.
