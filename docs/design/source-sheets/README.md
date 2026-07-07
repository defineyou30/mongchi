# Category Source Sheets

Generated source sheets for the current Mongchi art direction.
These sheets are split by category to avoid the broken mixed-asset results from large all-in-one generations.

## New Generation Rule

New imagegen source sheets must use only 4 to 6 assets per image.

- Preferred layouts: `2x2`, `2x3`, or `3x2`.
- Maximum: 6 assets per image.
- Do not create new `3x3`, 9-item, complete-set, or mixed-category sheets.
- Generate backgrounds, loading screens, logos, and real-photo pet avatars one image at a time.
- Keep every cell large, centered, evenly padded, and easy to crop.

Some current source sheets are legacy `3x3` extraction inputs. Keep them only until the matching category is regenerated with the new 4-to-6 asset rule.

## Current Files

- asset-source-sheets-contact-v1.png
- button-actions-v1.png
- button-actions-v2.png
- button-extension-hud-utility-v1.png
- button-inventory-v1.png
- button-utility-v2.png
- cat-actions-v1.png
- currency-premium-v1.png
- dog-actions-v1.png
- food-treats-v1.png
- garden-care-tools-v1.png
- garden-decor-v1.png
- garden-decor-v2.png
- hud-meter-icons-v2.png
- shop-helper-v1.png
- status-mood-icons-v1.png
- status-mood-icons-v2.png
- toy-comfort-v1.png
- toy-comfort-v2.png
- treats-premium-a-v2.png
- treats-premium-b-v2.png
- water-path-reward-v2.png

## App Export

Run `node scripts/apply-category-source-sheets.mjs` to slice approved cells into app PNG assets.
The script keeps existing runtime paths stable and backs up previous PNGs under `apps/mobile/assets/_dummy/20260628-category-regen-before`.
