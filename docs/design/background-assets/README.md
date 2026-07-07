# Background Asset Candidates

Generated on 2026-06-28 to match the regenerated cozy 2D/pixel-hybrid pet, prop, button, and shop assets.

## Size Contract

- Generation prompts must request a portrait mobile 9:16 composition.
- App exports are fixed after generation:
  - `720x960` for portrait screen backgrounds.
  - `720x720` for square scene slots.
- Source image dimensions may vary because the built-in image generator chooses its own pixel dimensions, but exported app assets must not vary.

## Source Images

- `home-garden-source-v1.png`: main home garden background with open center/lower placement zones for pet and props.
- `shop-market-source-v1.png`: garden market background with top showcase space and lower UI/product-grid space.
- `chat-garden-source-v1.png`: calm conversation garden with lower area kept soft for chat bubbles.
- `hatch-reveal-source-v1.png`: magical reveal clearing with a central glow area for hatching/reveal.
- `fairy-garden-source-v1.png`: dreamy moonlit fairy garden theme.
- `seaside-cove-source-v1.png`: sunny seaside cove theme.
- `autumn-woods-source-v1.png`: warm autumn woodland theme.
- `winter-lights-source-v1.png`: cozy winter snow-and-lantern theme.
- `background-assets-contact-v1.png`: first visual review sheet.
- `background-assets-contact-v2.png`: current visual review sheet including theme candidates.

## Runtime Backgrounds

- `apps/mobile/assets/generated/backgrounds/candidates/home-garden-premium-v2-portrait.png`: wired into the main shell and home screen.
- `apps/mobile/assets/generated/backgrounds/candidates/shop-market-premium-v1-portrait.png`: wired into the shop screen.
- `apps/mobile/assets/generated/backgrounds/candidates/chat-garden-premium-v1-portrait.png`: wired into the chat screen.
- `apps/mobile/assets/generated/backgrounds/candidates/hatch-reveal-garden-premium-v1-portrait.png`: wired into hatching/reveal illustration scenes.

## Theme Candidates

Additional theme candidates are stored under `apps/mobile/assets/generated/backgrounds/themes/`.

- `theme-fairy-garden-v1-portrait.png` / `theme-fairy-garden-v1-square.png`
- `theme-seaside-cove-v1-portrait.png` / `theme-seaside-cove-v1-square.png`
- `theme-autumn-woods-v1-portrait.png` / `theme-autumn-woods-v1-square.png`
- `theme-winter-lights-v1-portrait.png` / `theme-winter-lights-v1-square.png`

These are ready for a future theme selector or seasonal rotation, but not selected by runtime state yet.
