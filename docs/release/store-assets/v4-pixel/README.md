# Mongchi App Store Screenshots V4 Pixel

This set uses the current golden retriever simulator captures and the supplied
high-resolution source photo. ImageGen creates the external pixel-art scene;
`render_v4_pixel.py` restores the exact in-app capture inside each phone frame
and renders localized marketing copy with the app's real pixel font.

## Visual Rules

- Keep every in-app UI screenshot unchanged. The sole approved exception is
  replacing persisted chat-message bodies in a locale-specific marketing copy;
  app chrome, bubble geometry, controls, and layout must remain pixel-identical.
- Use Pixelify-style headline and subtitle lettering directly in the scene.
- Do not place headline copy inside pastel pills, rounded cards, or floating
  labels.
- Keep all external art in sharp, cohesive pixel-art and pixel-gloss materials.
- Use the source golden retriever consistently across the set.
- Final canvas: `1320 x 2868`.

## Sequence

1. `YOUR PET, LIVING IN YOUR PHONE`
2. `CARE IN LITTLE MOMENTS`
3. `MEET EVERY SIDE OF THEM`
4. `TELL THEM ABOUT YOUR DAY`
5. `EVERY DAY BECOMES A MEMORY`
6. `A COZY WORLD OF THEIR OWN`

## Build

```sh
python3 scripts/store-screenshots/localize_chat_captures.py
python3 scripts/store-screenshots/render_v4_pixel.py
```

ImageGen bases live in `backgrounds/`. Exact final screenshots live in `final/`.
The real source photo is `scripts/store-screenshots/raw/source-golden-retriever.jpg`.

## Localized Sets

The complete localized set covers `ko-KR`, `ja-JP`, `zh-TW`, `de-DE`, `fr-FR`,
`pt-BR`, and `es-MX`; English remains in the root `final/` directory. Each
locale contains six final screenshots and one contact sheet.

- Simulator captures: `scripts/store-screenshots/raw/<locale>/`
- Shared textless ImageGen bases: `backgrounds/ko-KR/`
- Final App Store images: `final/<locale>/`
- Contact sheets: `contact-sheets/<locale>.png`
- Locale copy and font mapping: `scripts/store-screenshots/store_screenshot_copy.py`

`4-chat-original-history.png` preserves the real localized app chrome and live
conversation layout. `localize_chat_captures.py` creates `4-chat.png` by
replacing only the four persisted message bodies with reviewed locale copy.
Every shop composition uses only the real `5-shop-1.png` and `5-shop-2.png`
captures over a decorative UI-free background.
