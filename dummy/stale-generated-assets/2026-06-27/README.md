# Stale Generated Asset Archive

Moved from `apps/mobile/assets/generated/backgrounds/pixel-garden-premium-frame-v1.png`.

Reason:
- The file was not registered by the mobile asset manifest.
- `npm run validate:mobile-assets` treats unregistered files under `apps/mobile/assets/generated` as stale generated output.
- Keep it here only as a visual reference. Do not restore it unless the app manifest and consuming UI are updated to use it.

Additional files moved during the 2026-06-27 visual-direction cleanup:

- `backgrounds/shop-garden-v2.png`
- `backgrounds/shop-shelf-v3.png`

Reason:
- These were older generated shop/garden backgrounds from the flat/pixel-heavy visual direction.
- Active mobile screens now use `pixel-garden-premium-v1.png` for full-scene garden pages and `shop-room-square-premium-v1.png` for shelf art.
- `GameIllustrations.tsx`, asset validation, contact-sheet validation, visual-quality validation, and the mobile asset generator were updated so these backgrounds no longer re-enter the active generated asset manifest.

Do not restore these files unless intentionally reintroducing the previous shop/garden background direction and updating the asset manifest plus consuming UI.
