# Plant Object Growth Guide

## Product Decision

Use plant presets from the start, but keep plant growth lightweight.

Plants are not a second full farming game. They are cozy garden objects that make the pet home feel alive and give the `Water` action a reason to exist.

Related system docs:

- `docs/design/state-episode-weather-engine.md`
- `docs/design/home-ui-interaction-contract.md`

## MVP Behavior

- Plants are placeable inventory items.
- Each growable plant uses a fixed preset.
- Watering the garden updates plant growth entries only for placed items that have a plant growth preset.
- Garden tools such as watering cans can trigger the `Water` action visually, but they do not become growable plants.
- Growth changes should be visible but gentle:
  - stage label
  - small status tag
  - scale change
  - inventory growth badge and progress bar
  - stage-specific PNG variants
- Plants should never punish the user harshly. A thirsty plant is an invitation, not failure.
- A fully grown plant stays `Blooming`; it does not fall back to `Thirsty` just because time passed.

## Starter Presets

The current starter presets live in `packages/shared/src/domain/plants.ts`.

- Sunny Flower Pot
- Clover Leaf Plant
- Spring Flower Patch

Each preset defines:

- `itemId`
- `placementPreset`
- `waterPointsPerStage`
- `thirstyAfterHours`
- `stages`
- `stageScale`
- `assetPromptTags`

## Growth Contract

The current runtime contract is:

- `seed` or first stage starts thirsty until the player waters it once.
- Each watering adds one point.
- When points reach `waterPointsPerStage`, the plant advances one stage and points reset to zero.
- When the final stage is reached, the plant condition is `Blooming`.
- Watering returns milestone metadata for future UI/rewards:
  - `wateredItemIds`
  - `advancedItemIds`
  - `bloomedItemIds`

This lets later screens show a small celebration, grant tiny bond XP and bonus credits, or unlock a shop prompt without changing the persistence shape.

## Visual Rule

Plants should match the same premium cozy 2D/2.5D garden object style as the Home scene:

- soft painterly leaves and flowers
- warm daylight
- rounded readable silhouette
- grounded contact shadow
- transparent PNG-ready subject
- no hard pixel sprite
- no flat emoji icon

## Stage Art

Stage assets use variants from the same master identity:

- `seed`
- `sprout`
- `leafy`
- `bloom`

Use the same item anchor, canvas size, palette, and shadow for all stages so replacement in fixed Home slots does not jump.
The mobile catalog keeps this contract through `plantStageAssetByCatalogId` and `getGameItemAssetKeyForPlantStage`; Home and Inventory choose the stage visual from that helper while keeping placement layout anchored to the base item preset.
`npm run validate:plant-stage-assets` validates the manifest, the current stage PNG files, and the `gameItemCatalog.ts` mapping from each plant stage to its dedicated asset key. Before release, run `TINY_PET_REQUIRE_FINAL_PLANT_STAGE_ASSETS=true npm run validate:plant-stage-assets` explicitly so every mapped stage PNG must exist, match its fixed canvas, keep transparent background pixels, contain nonblank visible artwork, and remain wired to Home/Inventory through the stage selector.

Recommended scene canvas:

- small plant: 96x96
- medium plant: 128x128
- seasonal patch: 160x160

## Interaction Role

Watering should be treated as a garden-care action:

- improves `gardenHealth`
- updates plant growth
- can trigger `garden_watered` pet reaction
- can show a small `Fresh`, `Growing`, `Thirsty`, or `Blooming` cue near the plant
- Home should keep this as a tiny floating plant cue, not a new bottom panel or separate farming screen.
- can show the current plant stage, condition, and progress in Inventory so users understand why `Water` exists
- can produce weather-aware episode lines, such as rain making the garden feel fresh or hot weather making the plant ask for water

Do not make water mandatory for basic pet happiness. It should deepen the garden loop and create a reason to buy/collect plant decor.

Rainy weather can count as atmosphere and copy context, but it should not automatically replace the user's watering action unless the engine explicitly grants a small one-time weather bonus. This keeps `Water` meaningful while still letting weather feel alive.

## Reward Direction

Bloom rewards should stay soft:

- first bloom: small bond XP and bonus-credit bonus
- repeated bloom watering: tiny mood or garden-health bump
- seasonal/premium bloom: collectible badge, special pet line, or shop preview

Avoid decay, death, or permanent loss. The player should feel invited back, not punished.

Current implemented reward contract:

- normal plant first bloom: `+1 bonusCredit`, `+3 bondXp`
- seasonal patch first bloom: `+2 bonusCredits`, `+5 bondXp`
- reward is emitted only on the stage transition into final bloom
- repeated watering after bloom keeps the plant fresh visually but does not repeat the bloom reward
