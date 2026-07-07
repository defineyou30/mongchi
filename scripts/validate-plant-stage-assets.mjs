import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const manifestPath = path.join(rootDir, "docs/design/plant-stage-asset-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const catalogText = fs.readFileSync(path.join(rootDir, "apps/mobile/src/shared/assets/gameItemCatalog.ts"), "utf8");
const requireFinalAssets =
  process.env.TINY_PET_REQUIRE_FINAL_PLANT_STAGE_ASSETS === "true" ||
  manifest.status === "final-assets-required";
const failures = [];

const expectedStagesByItemId = new Map([
  ["item_flower_pot_sunny", ["seed", "sprout", "leafy", "bloom"]],
  ["item_leafy_plant_clover", ["sprout", "leafy", "bloom"]],
  ["item_seasonal_flowers_spring", ["sprout", "leafy", "bloom"]]
]);

const expectedAssetKeyByItemStage = new Map([
  ["item_flower_pot_sunny:seed", "flowerPotSeed"],
  ["item_flower_pot_sunny:sprout", "flowerPotSprout"],
  ["item_flower_pot_sunny:leafy", "flowerPotLeafy"],
  ["item_flower_pot_sunny:bloom", "flowerPotBloom"],
  ["item_leafy_plant_clover:sprout", "cloverSprout"],
  ["item_leafy_plant_clover:leafy", "cloverLeafy"],
  ["item_leafy_plant_clover:bloom", "cloverBloom"],
  ["item_seasonal_flowers_spring:sprout", "springPatchSprout"],
  ["item_seasonal_flowers_spring:leafy", "springPatchLeafy"],
  ["item_seasonal_flowers_spring:bloom", "springPatchBloom"]
]);

const allowedStatuses = new Set(["prompt-ready-placeholder-mapped", "final-assets-required"]);

const parseSceneCanvas = (value) => {
  const match = /^(\d+)x(\d+)$/.exec(value ?? "");

  if (!match) {
    return null;
  }

  return {
    width: Number.parseInt(match[1], 10),
    height: Number.parseInt(match[2], 10)
  };
};

const validatePng = ({ assetPath, expectedSize, label }) => {
  const absolutePath = path.join(rootDir, assetPath);

  if (!fs.existsSync(absolutePath)) {
    failures.push(`${label}: missing final plant stage PNG at ${assetPath}.`);
    return;
  }

  let png;

  try {
    png = PNG.sync.read(fs.readFileSync(absolutePath));
  } catch (error) {
    failures.push(`${label}: ${assetPath} is not a readable PNG (${error.message}).`);
    return;
  }

  if (png.width !== expectedSize.width || png.height !== expectedSize.height) {
    failures.push(
      `${label}: ${assetPath} must be ${expectedSize.width}x${expectedSize.height}, got ${png.width}x${png.height}.`
    );
  }

  let visiblePixels = 0;
  let transparentPixels = 0;

  for (let index = 0; index < png.data.length; index += 4) {
    const alpha = png.data[index + 3];

    if (alpha > 16) {
      visiblePixels += 1;
    } else {
      transparentPixels += 1;
    }
  }

  if (visiblePixels < 32) {
    failures.push(`${label}: ${assetPath} appears blank or almost fully transparent.`);
  }

  if (transparentPixels === 0) {
    failures.push(`${label}: ${assetPath} must preserve transparent background pixels.`);
  }
};

if (!allowedStatuses.has(manifest.status)) {
  failures.push(
    `Plant stage manifest status must be one of ${Array.from(allowedStatuses).join(", ")}, got ${JSON.stringify(
      manifest.status
    )}.`
  );
}

if (manifest.status !== "final-assets-required") {
  failures.push("Plant stage manifest must stay final-assets-required now that stage PNGs are generated and app-wired.");
}

if (manifest.implementation?.selector !== "getGameItemAssetKeyForPlantStage") {
  failures.push("Plant stage manifest must point at getGameItemAssetKeyForPlantStage.");
}

if (manifest.implementation?.mapping !== "plantStageAssetByCatalogId") {
  failures.push("Plant stage manifest must point at plantStageAssetByCatalogId.");
}

for (const [itemId, expectedStages] of expectedStagesByItemId.entries()) {
  const preset = manifest.presets?.find((entry) => entry.itemId === itemId);

  if (!preset) {
    failures.push(`Plant stage manifest missing preset ${itemId}.`);
    continue;
  }

  const sceneCanvas = parseSceneCanvas(preset.sceneCanvas);

  if (!sceneCanvas) {
    failures.push(`${itemId}: sceneCanvas must use WIDTHxHEIGHT format.`);
    continue;
  }

  const seenStages = new Set();

  for (const stageKey of expectedStages) {
    const stage = preset.stages?.find((entry) => entry.stageKey === stageKey);

    if (!stage) {
      failures.push(`Plant stage manifest missing ${itemId} ${stageKey} stage.`);
      continue;
    }

    seenStages.add(stageKey);

    if (!stage.assetPath?.startsWith("apps/mobile/assets/game-items/plant-stages/scene/")) {
      failures.push(`${itemId} ${stageKey}: assetPath must use the plant-stages scene folder.`);
    }

    if (!stage.assetPath?.endsWith(".png")) {
      failures.push(`${itemId} ${stageKey}: assetPath must point to a PNG file.`);
    }

    if (!stage.prompt?.includes("transparent background")) {
      failures.push(`${itemId} ${stageKey}: prompt must require transparent background.`);
    }

    const expectedAssetKey = expectedAssetKeyByItemStage.get(`${itemId}:${stageKey}`);
    const requirePath = `../../../${stage.assetPath.replace(/^apps\/mobile\//, "")}`;

    if (!expectedAssetKey) {
      failures.push(`${itemId} ${stageKey}: missing expected app asset key contract.`);
    } else {
      if (!catalogText.includes(`${expectedAssetKey}: defineSingleImageSources(require("${requirePath}"))`)) {
        failures.push(`${itemId} ${stageKey}: gameItemCatalog must wire ${expectedAssetKey} to ${requirePath}.`);
      }

      if (!catalogText.includes(`${stageKey}: "${expectedAssetKey}"`)) {
        failures.push(`${itemId} ${stageKey}: plantStageAssetByCatalogId must map ${stageKey} to ${expectedAssetKey}.`);
      }
    }

    if (requireFinalAssets) {
      validatePng({
        assetPath: stage.assetPath,
        expectedSize: sceneCanvas,
        label: `${itemId} ${stageKey}`
      });
    }
  }

  for (const stage of preset.stages ?? []) {
    if (!expectedStages.includes(stage.stageKey)) {
      failures.push(`${itemId}: unexpected plant stage ${JSON.stringify(stage.stageKey)}.`);
    }
  }

  if (seenStages.size !== expectedStages.length) {
    failures.push(`${itemId}: expected ${expectedStages.length} stages, saw ${seenStages.size}.`);
  }
}

if (failures.length > 0) {
  console.error(
    requireFinalAssets ? "Final plant stage asset validation failed:" : "Plant stage asset manifest validation failed:"
  );

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log(
  requireFinalAssets
    ? "Final plant stage asset validation passed."
    : "Plant stage asset manifest validation passed with prompt-ready placeholder mapping."
);
