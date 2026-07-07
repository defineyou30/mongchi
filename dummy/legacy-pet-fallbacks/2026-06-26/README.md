# Legacy Pet Fallbacks

Moved on 2026-06-26 during the pet fallback redesign pass.

These files were removed from the active mobile asset tree because the app was still resolving local prototype and store screenshot pets to the old bundled `miso` and `luna` fallback sprites. That made the previous sample character keep appearing even after the UI, item, and background redesigns.

Contents:

- `generated-pets/miso/*`: old dog fallback state PNGs.
- `generated-pets/luna/*`: old cat fallback state PNGs.
- `art-sources/*`: old source PNGs that `scripts/generate-mobile-assets.mjs` used to copy into every generated pet state.

Active replacements now live in:

- `apps/mobile/assets/generated/pets/miso/*`
- `apps/mobile/assets/generated/pets/luna/*`
- `apps/mobile/assets/art-sources/pets/miso-premium-source.png`
- `apps/mobile/assets/art-sources/pets/luna-premium-source.png`
- `apps/mobile/assets/art-sources/pets/*-chromakey-v2.png`

Do not restore these legacy files unless intentionally reverting the fallback pet style.
