import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const failures = [];

const readText = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(readText(relativePath));

const requireIncludes = (relativePath, fragments, label) => {
  const content = readText(relativePath);

  for (const fragment of fragments) {
    if (!content.includes(fragment)) {
      failures.push(`${label}: ${relativePath} must include ${JSON.stringify(fragment)}.`);
    }
  }
};

const requireExcludes = (relativePath, fragments, label) => {
  const content = readText(relativePath);

  for (const fragment of fragments) {
    if (content.includes(fragment)) {
      failures.push(`${label}: ${relativePath} must not include ${JSON.stringify(fragment)}.`);
    }
  }
};

requireIncludes(
  "docs/design/plant-growth-object-guide.md",
  [
    "Use plant presets from the start, but keep plant growth lightweight.",
    "Plants are not a second full farming game.",
    "Each growable plant uses a fixed preset.",
    "Plants should never punish the user harshly. A thirsty plant is an invitation, not failure.",
    "inventory growth badge and progress bar",
    "A fully grown plant stays `Blooming`; it does not fall back to `Thirsty` just because time passed.",
    "can show the current plant stage, condition, and progress in Inventory",
    "Do not make water mandatory for basic pet happiness.",
    "normal plant first bloom: `+1 bonusCredit`, `+3 bondXp`",
    "seasonal patch first bloom: `+2 bonusCredits`, `+5 bondXp`"
  ],
  "Plant object guide"
);

requireIncludes(
  "docs/design/plant-stage-asset-prompts.md",
  [
    "premium cozy 2D/2.5D mobile pet garden",
    "Every stage in one preset must keep the same canvas",
    "flower-pot-seed.png",
    "flower-pot-bloom.png",
    "clover-sprout.png",
    "clover-bloom.png",
    "spring-patch-sprout.png",
    "spring-patch-bloom.png",
    "plantStageAssetByCatalogId",
    "getGameItemAssetKeyForPlantStage"
  ],
  "Plant stage asset prompts"
);

const plantStageManifest = readJson("docs/design/plant-stage-asset-manifest.json");
const expectedStageManifest = new Map([
  ["item_flower_pot_sunny", ["seed", "sprout", "leafy", "bloom"]],
  ["item_leafy_plant_clover", ["sprout", "leafy", "bloom"]],
  ["item_seasonal_flowers_spring", ["sprout", "leafy", "bloom"]]
]);

if (plantStageManifest.status !== "final-assets-required") {
  failures.push("Plant stage manifest must state final-assets-required after local stage PNGs are generated and app-wired.");
}

if (plantStageManifest.implementation?.selector !== "getGameItemAssetKeyForPlantStage") {
  failures.push("Plant stage manifest must point at getGameItemAssetKeyForPlantStage.");
}

if (plantStageManifest.implementation?.mapping !== "plantStageAssetByCatalogId") {
  failures.push("Plant stage manifest must point at plantStageAssetByCatalogId.");
}

for (const [itemId, expectedStages] of expectedStageManifest.entries()) {
  const preset = plantStageManifest.presets?.find((entry) => entry.itemId === itemId);

  if (!preset) {
    failures.push(`Plant stage manifest missing preset ${itemId}.`);
    continue;
  }

  for (const stageKey of expectedStages) {
    const stage = preset.stages?.find((entry) => entry.stageKey === stageKey);

    if (!stage) {
      failures.push(`Plant stage manifest missing ${itemId} ${stageKey} stage.`);
      continue;
    }

    if (!stage.assetPath?.startsWith("apps/mobile/assets/game-items/plant-stages/scene/")) {
      failures.push(`Plant stage manifest ${itemId} ${stageKey} must use the plant-stages scene asset path.`);
    }

    if (!stage.prompt?.includes("transparent background")) {
      failures.push(`Plant stage manifest ${itemId} ${stageKey} prompt must require transparent background.`);
    }
  }
}

requireIncludes(
  "docs/product-direction.md",
  [
    "Plant and garden objects use fixed placement presets plus lightweight growth stages",
    "Water is a cozy garden-care action, not a hard survival requirement"
  ],
  "Product direction plant loop"
);

requireIncludes(
  "packages/shared/src/domain/plants.ts",
  [
    'export type PlantGrowthStageKey = "seed" | "sprout" | "leafy" | "bloom";',
    'export type PlantPlacementPresetKey = "front_pot" | "side_leaf" | "seasonal_patch";',
    'growthRole: "living_decor";',
    "allowsFailureState: false;",
    "waterPointsPerStage",
    "thirstyAfterHours",
    "assetPromptTags",
    "getPlantGrowthVisualState",
    "waterPlantGrowthEntriesWithOutcome",
    "type: \"plant_bloom\""
  ],
  "Shared plant growth domain"
);

requireIncludes(
  "packages/shared/src/domain/inventory.ts",
  [
    "getPlantPlacementPresetForItemId",
    "| \"frontPlant\"",
    "| \"sidePlant\"",
    "| \"seasonalPlant\"",
    "frontPlant: { x: 0.18, y: 0.78, rotation: -5 }",
    "sidePlant: { x: 0.82, y: 0.72, rotation: 5 }",
    "seasonalPlant: { x: 0.62, y: 0.58, rotation: 0 }"
  ],
  "Inventory fixed plant lanes"
);

requireIncludes(
  "packages/shared/src/session/prototypeSession.ts",
  [
    "waterPlantGrowthEntriesWithOutcome",
    "waterPrototypeGardenInventory",
    "waterablePlantItemIds",
    "bloomRewards"
  ],
  "Prototype garden watering"
);

requireIncludes(
  "apps/mobile/src/features/terrarium/TerrariumHomeScreen.tsx",
  [
    "plantHomeSlotByPreset",
    "getPlantGrowthVisualState",
    "getGameItemAssetKeyForPlantStage",
    "layoutItem",
    "getHomePlantGrowthCuePresentation",
    "plantGrowthCue",
    "growthScale",
    "water_garden",
    "Water the flower pot",
    "Tap to water the garden.",
    "lastCareReward",
    "getHomeCareActionFeedbackPresentation"
  ],
  "Home plant interaction"
);

requireIncludes(
  "apps/mobile/src/shared/assets/gameItemCatalog.ts",
  [
    "plantStageAssetByCatalogId",
    "getGameItemAssetKeyForPlantStage",
    "item_flower_pot_sunny",
    "item_leafy_plant_clover",
    "item_seasonal_flowers_spring",
    "flowerPotSeed",
    "flowerPotBloom",
    "cloverBloom",
    "springPatchBloom"
  ],
  "Plant stage asset catalog"
);

requireIncludes(
  "apps/mobile/src/features/inventory/InventoryScreen.tsx",
  [
    "getGameItemAssetKeyForPlantStage",
    "getInventoryItemAssetKey",
    "plantGrowth?.stageKey"
  ],
  "Inventory plant stage asset selection"
);

requireIncludes(
  "apps/mobile/src/features/terrarium/terrariumHomePresentation.ts",
  [
    "getHomeCareActionFeedbackPresentation",
    "getHomePlantGrowthCuePresentation",
    "HomePlantGrowthCuePresentation",
    "Water me",
    "Blooming",
    "plant_bloom",
    "Bloom +"
  ],
  "Home plant bloom feedback"
);

requireIncludes(
  "apps/mobile/src/features/inventory/inventoryPresentation.ts",
  [
    "getPlantGrowthVisualState",
    "isPlantGrowthEnabledItemId",
    "plantGrowth",
    "careHint",
    "growingPlantQuantity",
    "thirstyPlantQuantity"
  ],
  "Inventory plant growth presentation"
);

requireIncludes(
  "apps/mobile/src/features/inventory/InventoryScreen.tsx",
  [
    "plant growth",
    "plantGrowthPanel",
    "plantProgressTrack",
    "placementPlantBadge",
    "living decor",
    "thirsty"
  ],
  "Inventory plant growth UI"
);

requireIncludes(
  "packages/shared/src/__tests__/plants.test.ts",
  [
    "keeps plant presets as fixed living-decor anchors without failure states",
    "marks fully grown starter plants as blooming without adding a failure state",
    "reports watered, advanced, and bloomed plant milestones from preset growth",
    "maps bloom milestones to soft bonus-credit and bond rewards",
    "item_watering_can_mint"
  ],
  "Plant growth tests"
);

requireIncludes(
  "apps/mobile/src/features/inventory/inventoryPresentation.test.ts",
  [
    "exposes preset plant growth state for inventory cards and placed slots",
    "marks owned but unplaced growth-enabled plants as preset plant starters",
    "Watering advances this preset plant.",
    "Place this plant to start its preset growth."
  ],
  "Inventory plant growth tests"
);

requireIncludes(
  "apps/mobile/src/features/terrarium/terrariumHomePresentation.test.ts",
  [
    "surfaces placed plant growth as a small home-scene cue",
    "Water me",
    "marks fully grown placed plants as blooming on the home scene"
  ],
  "Home plant growth cue tests"
);

requireIncludes(
  "packages/shared/src/__tests__/inventory.test.ts",
  [
    "keeps living plant presets in separate fixed garden lanes",
    "frontPlant",
    "sidePlant"
  ],
  "Inventory plant lane tests"
);

requireExcludes(
  "docs/design/plant-growth-object-guide.md",
  ["plant death", "dead plant", "mandatory survival"],
  "Plant guide punitive loop"
);

if (failures.length > 0) {
  console.error("Plant growth design validation failed:");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log("Plant growth design validation passed.");
