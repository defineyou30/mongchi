# Plant Stage Asset Prompts

Use these prompts when replacing or polishing the current final-stage PNG assets.

## Shared Style

Create transparent PNG objects for a premium cozy 2D/2.5D mobile pet garden. Match `docs/design/image1.png` and `docs/design/image2.png`: soft painterly leaves, warm daylight, rounded readable silhouettes, subtle baked contact shadow, tactile collectible prop feeling.

Avoid hard pixel sprites, emoji icons, thick outlines, UI frames, text, labels, watermarks, background scenes, or props that exceed the fixed canvas.

Every stage in one preset must keep the same canvas, base footprint, anchor, palette, and contact shadow so Home placement does not jump when the plant grows.

## Sunny Flower Pot

- `flower-pot-seed.png`: tiny terracotta pot with warm soil and one barely visible green sprout.
- `flower-pot-sprout.png`: same pot with two small rounded leaves.
- `flower-pot-leafy.png`: same pot with fuller rounded green leaves.
- `flower-pot-bloom.png`: same pot fully blooming with one or two soft pink flowers and tiny sparkle accents inside object bounds.

Scene canvas: `96x96`.

## Clover Leaf Plant

- `clover-sprout.png`: small clover sprout with two rounded leaves.
- `clover-leafy.png`: lush clover plant with vertical rounded foliage.
- `clover-bloom.png`: same clover plant with tiny white-pink blossoms and gentle sparkle accents.

Scene canvas: `128x128`.

## Spring Flower Patch

- `spring-patch-sprout.png`: small low spring sprout cluster.
- `spring-patch-leafy.png`: fuller leafy green mound with a few buds.
- `spring-patch-bloom.png`: fully blooming pastel spring flower patch.

Scene canvas: `160x160`.

## Implementation Notes

The current app uses `plantStageAssetByCatalogId` and `getGameItemAssetKeyForPlantStage` as a stage selector. Stage PNGs live under `apps/mobile/assets/game-items/plant-stages/scene/`. If higher quality AI art replaces the local v1 assets, keep the same filenames, canvas sizes, alpha background, base footprint, and Home placement coordinates.

Run `npm run validate:plant-stage-assets` while iterating on prompts. The validator also checks that `gameItemCatalog.ts` wires every manifest stage to a dedicated stage asset key, so Home and Inventory cannot silently fall back to the base plant icon. Before release, run `TINY_PET_REQUIRE_FINAL_PLANT_STAGE_ASSETS=true npm run validate:plant-stage-assets`; strict mode requires every stage PNG to exist at the manifest path, match the preset canvas size, keep transparent background pixels, and avoid blank placeholder output.
