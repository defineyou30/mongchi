import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(
  process.env.TINY_PET_VALIDATOR_ROOT ?? fileURLToPath(new URL("..", import.meta.url))
);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const appShellAssets = [
  { label: "app icon", path: "apps/mobile/assets/icon.png", width: 1024, height: 1024, colorType: 2 },
  { label: "adaptive icon", path: "apps/mobile/assets/adaptive-icon.png", width: 1024, height: 1024 },
  { label: "splash", path: "apps/mobile/assets/splash.png", width: 1290, height: 2796, colorType: 2 }
];

const petAssetSets = [
  { key: "miso", species: "dog" },
  { key: "luna", species: "cat" }
];

const petAssetStates = [
  "idle",
  "base",
  "happy",
  "sleep",
  "play",
  "hungry",
  "walk_return",
  "treat_reaction",
  "chat_portrait",
  "curious",
  "celebrate",
  "garden_help",
  "seasonal"
];

const petAssets = petAssetSets.flatMap(({ key, species }) =>
  petAssetStates.map((state) => ({
    label: `${key} ${species} pet ${state}`,
    path: `apps/mobile/assets/generated/pets/${key}/${state}.png`,
    width: 256,
    height: 256,
    assetId: `asset_${key}_${state}_001`,
    state,
    species
  }))
);

const backgroundAssets = [
  { label: "premium pixel garden background", path: "apps/mobile/assets/generated/backgrounds/pixel-garden-premium-v1.png", width: 720, height: 720 },
  {
    label: "home garden runtime background",
    path: "apps/mobile/assets/generated/backgrounds/candidates/home-garden-premium-v2-portrait.png",
    width: 720,
    height: 960
  },
  {
    label: "home garden square candidate",
    path: "apps/mobile/assets/generated/backgrounds/candidates/home-garden-premium-v2-square.png",
    width: 720,
    height: 720,
    requireInGameIllustrations: false
  },
  {
    label: "shop market runtime background",
    path: "apps/mobile/assets/generated/backgrounds/candidates/shop-market-premium-v1-portrait.png",
    width: 720,
    height: 960,
    requireInGameIllustrations: false
  },
  {
    label: "shop market square candidate",
    path: "apps/mobile/assets/generated/backgrounds/candidates/shop-market-premium-v1-square.png",
    width: 720,
    height: 720,
    requireInGameIllustrations: false
  },
  {
    label: "chat garden runtime background",
    path: "apps/mobile/assets/generated/backgrounds/candidates/chat-garden-premium-v1-portrait.png",
    width: 720,
    height: 960
  },
  {
    label: "chat garden square candidate",
    path: "apps/mobile/assets/generated/backgrounds/candidates/chat-garden-premium-v1-square.png",
    width: 720,
    height: 720,
    requireInGameIllustrations: false
  },
  {
    label: "hatch reveal runtime background",
    path: "apps/mobile/assets/generated/backgrounds/candidates/hatch-reveal-garden-premium-v1-portrait.png",
    width: 720,
    height: 960
  },
  {
    label: "hatch reveal square candidate",
    path: "apps/mobile/assets/generated/backgrounds/candidates/hatch-reveal-garden-premium-v1-square.png",
    width: 720,
    height: 720,
    requireInGameIllustrations: false
  },
  {
    label: "fairy garden runtime theme",
    path: "apps/mobile/assets/generated/backgrounds/themes/theme-fairy-garden-v1-portrait.png",
    width: 720,
    height: 960
  },
  {
    label: "fairy garden square theme",
    path: "apps/mobile/assets/generated/backgrounds/themes/theme-fairy-garden-v1-square.png",
    width: 720,
    height: 720,
    requireInGameIllustrations: false
  },
  {
    label: "seaside cove runtime theme",
    path: "apps/mobile/assets/generated/backgrounds/themes/theme-seaside-cove-v1-portrait.png",
    width: 720,
    height: 960
  },
  {
    label: "seaside cove square theme",
    path: "apps/mobile/assets/generated/backgrounds/themes/theme-seaside-cove-v1-square.png",
    width: 720,
    height: 720,
    requireInGameIllustrations: false
  },
  {
    label: "autumn woods runtime theme",
    path: "apps/mobile/assets/generated/backgrounds/themes/theme-autumn-woods-v1-portrait.png",
    width: 720,
    height: 960
  },
  {
    label: "autumn woods square theme",
    path: "apps/mobile/assets/generated/backgrounds/themes/theme-autumn-woods-v1-square.png",
    width: 720,
    height: 720,
    requireInGameIllustrations: false
  },
  {
    label: "winter lights runtime theme",
    path: "apps/mobile/assets/generated/backgrounds/themes/theme-winter-lights-v1-portrait.png",
    width: 720,
    height: 960
  },
  {
    label: "winter lights square theme",
    path: "apps/mobile/assets/generated/backgrounds/themes/theme-winter-lights-v1-square.png",
    width: 720,
    height: 720,
    requireInGameIllustrations: false
  }
];

const brandAssets = [
  {
    label: "brand welcome screen",
    path: "apps/mobile/assets/generated/brand/welcome-screen-v1.png",
    width: 720,
    height: 960,
    requiredSources: ["apps/mobile/src/shared/ui/GameIllustrations.tsx"]
  },
  {
    label: "brand loading screen",
    path: "apps/mobile/assets/generated/brand/loading-screen-v1.png",
    width: 720,
    height: 960,
    requiredSources: ["apps/mobile/src/shared/ui/GameIllustrations.tsx"]
  },
  {
    label: "legacy brand app logo",
    path: "apps/mobile/assets/generated/brand/app-logo-v1.png",
    width: 512,
    height: 512,
    requiredSources: []
  }
];

const runtimeGeneratedUiAssets = [
  {
    label: "brand loading screen v2",
    path: "apps/mobile/assets/generated/brand/loading-screen-v2.png",
    width: 941,
    height: 1672,
    colorType: 2,
    requiredSources: []
  },
  {
    label: "speech bubble runtime asset",
    path: "apps/mobile/assets/generated/ui/speech-bubble-v1.png",
    width: 1748,
    height: 899,
    requiredSources: ["apps/mobile/src/features/terrarium/TerrariumHomeScreen.tsx", "apps/mobile/src/features/chat/ChatGateScreen.tsx"]
  },
  {
    label: "speech bubble source asset",
    path: "apps/mobile/assets/generated/ui/speech-bubble-source-v1.png",
    width: 1748,
    height: 899,
    colorType: 2,
    requiredSources: []
  }
];

const runtimeOnboardingAssets = [
  {
    label: "welcome onboarding story art",
    path: "apps/mobile/assets/generated/onboarding/onboarding-photo-garden-v1.png",
    width: 1122,
    height: 1402,
    colorType: 2,
    requiredSources: ["apps/mobile/src/shared/ui/OnboardingStoryArt.tsx"]
  },
  {
    label: "photo picker onboarding story art",
    path: "apps/mobile/assets/generated/onboarding/onboarding-photo-picker-v1.png",
    width: 1122,
    height: 1402,
    colorType: 2,
    requiredSources: ["apps/mobile/src/shared/ui/OnboardingStoryArt.tsx"]
  },
  {
    label: "pet setup onboarding story art",
    path: "apps/mobile/assets/generated/onboarding/onboarding-pet-setup-v1.png",
    width: 1122,
    height: 1402,
    colorType: 2,
    requiredSources: ["apps/mobile/src/shared/ui/OnboardingStoryArt.tsx"]
  }
];

const utilityIconManifest = JSON.parse(
  readFileSync(resolve(ROOT, "apps/mobile/assets/generated/ui/utility-icons/v1/manifest.json"), "utf8")
);
const utilityIconAssets = utilityIconManifest.keys.map((key) => ({
  label: `utility icon ${key}`,
  path: `apps/mobile/assets/generated/ui/utility-icons/v1/${key}.png`,
  width: utilityIconManifest.master.width,
  height: utilityIconManifest.master.height
}));

const itemAssetNames = [
  "bone-v3",
  "coin-v3",
  "cushion-v3",
  "doghouse-v3",
  "flower-pot-v3",
  "food-bowl-v3",
  "gem-v3",
  "gift-v3",
  "lantern-v3",
  "toy-ball-v3",
  "watering-can-v3"
];

const itemAssets = itemAssetNames.map((name) => ({
  label: `item ${name}`,
  path: `apps/mobile/assets/generated/items/${name}.png`,
  width: 160,
  height: 160
}));

const gameItemVariantSpecs = [
  { key: "food-bowl", sceneSize: 96 },
  { key: "treat-plate", sceneSize: 96 },
  { key: "bone", sceneSize: 96 },
  { key: "salmon-bites", sceneSize: 96 },
  { key: "chicken-jerky", sceneSize: 96 },
  { key: "pumpkin-cookie", sceneSize: 96 },
  { key: "berry-yogurt", sceneSize: 96 },
  { key: "sweet-potato-chew", sceneSize: 96 },
  { key: "tuna-crunch", sceneSize: 96 },
  { key: "duck-biscuit", sceneSize: 96 },
  { key: "cheese-puff", sceneSize: 96 },
  { key: "apple-biscuit", sceneSize: 96 },
  { key: "honey-paw-wafer", sceneSize: 96 },
  { key: "milk-pup-cup", sceneSize: 96 },
  { key: "dewdrop-water", sceneSize: 96 },
  { key: "apple-sip", sceneSize: 96 },
  { key: "berry-milk", sceneSize: 96 },
  { key: "pumpkin-cream", sceneSize: 96 },
  { key: "blueberry-smoothie", sceneSize: 96 },
  { key: "carrot-cooler", sceneSize: 96 },
  { key: "sweet-potato-shake", sceneSize: 96 },
  { key: "salmon-broth", sceneSize: 96 },
  { key: "tuna-broth", sceneSize: 96 },
  { key: "coconut-splash", sceneSize: 96 },
  { key: "pear-nectar", sceneSize: 96 },
  { key: "toy-ball", sceneSize: 96 },
  { key: "plush-toy", sceneSize: 128 },
  { key: "rope-ring", sceneSize: 96 },
  { key: "star-squeaker", sceneSize: 96 },
  { key: "ribbon-wand", sceneSize: 96 },
  { key: "clover-puzzle", sceneSize: 96 },
  { key: "moon-frisbee", sceneSize: 96 },
  { key: "bell-roller", sceneSize: 96 },
  { key: "feather-teaser", sceneSize: 96 },
  { key: "snuffle-mat", sceneSize: 128 },
  { key: "wobble-treat-ball", sceneSize: 96 },
  { key: "crinkle-leaf", sceneSize: 96 },
  { key: "sunbeam-spinner", sceneSize: 96 },
  { key: "cloud-cushion", sceneSize: 96 },
  { key: "pet-bed", sceneSize: 128 },
  { key: "clover-nap-mat", sceneSize: 128 },
  { key: "moon-pillow", sceneSize: 128 },
  { key: "star-blanket", sceneSize: 128 },
  { key: "cozy-basket", sceneSize: 128 },
  { key: "window-perch", sceneSize: 128 },
  { key: "patchwork-rug", sceneSize: 128 },
  { key: "sleep-tent", sceneSize: 160 },
  { key: "donut-bed", sceneSize: 128 },
  { key: "garden-hammock", sceneSize: 160 },
  { key: "lantern-nest", sceneSize: 160 },
  { key: "tiny-house", sceneSize: 192 },
  { key: "flower-pot", sceneSize: 96 },
  { key: "leafy-plant", sceneSize: 128 },
  { key: "hanging-lantern", sceneSize: 128 },
  { key: "small-lamp", sceneSize: 96 },
  { key: "watering-can", sceneSize: 96 },
  { key: "pond-tile", sceneSize: 160 },
  { key: "stepping-stone", sceneSize: 128 },
  { key: "reward-pouch", sceneSize: 96 },
  { key: "gift-box", sceneSize: 96 },
  { key: "coin", sceneSize: 96 },
  { key: "gem", sceneSize: 96 },
  { key: "seasonal-flowers", sceneSize: 128 },
  { key: "drink-water-bowl", sceneSize: 96 }
];

const gameItemVariants = [
  { variant: "scene", size: null },
  { variant: "ui", size: 128 },
  { variant: "hud", size: 64 },
  { variant: "action", size: 96 }
];

const gameItemAssets = gameItemVariantSpecs.flatMap(({ key, sceneSize }) =>
  gameItemVariants.map(({ variant, size }) => {
    const pixelSize = size ?? sceneSize;

    return {
      label: `game item ${variant} ${key}`,
      path: `apps/mobile/assets/game-items/${variant}/${key}.png`,
      width: pixelSize,
      height: pixelSize,
      variant,
      key
    };
  })
);

const plantStageAssets = [
  { label: "plant stage flower pot seed", path: "apps/mobile/assets/game-items/plant-stages/scene/flower-pot-seed.png", width: 96, height: 96 },
  { label: "plant stage flower pot sprout", path: "apps/mobile/assets/game-items/plant-stages/scene/flower-pot-sprout.png", width: 96, height: 96 },
  { label: "plant stage flower pot leafy", path: "apps/mobile/assets/game-items/plant-stages/scene/flower-pot-leafy.png", width: 96, height: 96 },
  { label: "plant stage flower pot bloom", path: "apps/mobile/assets/game-items/plant-stages/scene/flower-pot-bloom.png", width: 96, height: 96 },
  { label: "plant stage clover sprout", path: "apps/mobile/assets/game-items/plant-stages/scene/clover-sprout.png", width: 128, height: 128 },
  { label: "plant stage clover leafy", path: "apps/mobile/assets/game-items/plant-stages/scene/clover-leafy.png", width: 128, height: 128 },
  { label: "plant stage clover bloom", path: "apps/mobile/assets/game-items/plant-stages/scene/clover-bloom.png", width: 128, height: 128 },
  { label: "plant stage spring patch sprout", path: "apps/mobile/assets/game-items/plant-stages/scene/spring-patch-sprout.png", width: 160, height: 160 },
  { label: "plant stage spring patch leafy", path: "apps/mobile/assets/game-items/plant-stages/scene/spring-patch-leafy.png", width: 160, height: 160 },
  { label: "plant stage spring patch bloom", path: "apps/mobile/assets/game-items/plant-stages/scene/spring-patch-bloom.png", width: 160, height: 160 }
];

const homeDecorationSlotIds = [
  "petCenterSlot",
  "foodSlot",
  "toySlot",
  "bedSlot",
  "houseSlot",
  "leftPlantSlot",
  "rightPlantSlot",
  "lightSlot",
  "waterSlot",
  "pathSlot",
  "rewardSlot",
  "premiumSlot"
];

const expectedAssets = [
  ...appShellAssets,
  ...petAssets,
  ...backgroundAssets,
  ...brandAssets,
  ...runtimeGeneratedUiAssets,
  ...runtimeOnboardingAssets,
  ...utilityIconAssets,
  ...itemAssets,
  ...gameItemAssets,
  ...plantStageAssets
];
const expectedGeneratedAssetPaths = new Set(
  [...petAssets, ...backgroundAssets, ...brandAssets, ...runtimeGeneratedUiAssets, ...runtimeOnboardingAssets, ...utilityIconAssets, ...itemAssets].map(
    (asset) => asset.path
  )
);

const failures = [];

const readSource = (relativePath) => {
  const absolutePath = resolve(ROOT, relativePath);

  if (!existsSync(absolutePath)) {
    failures.push(`${relativePath} is missing`);
    return "";
  }

  return readFileSync(absolutePath, "utf8");
};

const readPngInfo = ({ label, path, width, height, colorType: expectedColorType = 6 }) => {
  const absolutePath = resolve(ROOT, path);

  if (!existsSync(absolutePath)) {
    failures.push(`${label}: ${path} is missing`);
    return;
  }

  const stats = statSync(absolutePath);

  if (stats.size === 0) {
    failures.push(`${label}: ${path} is empty`);
    return;
  }

  const bytes = readFileSync(absolutePath);

  if (bytes.length < 33 || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    failures.push(`${label}: ${path} is not a valid PNG file`);
    return;
  }

  if (bytes.toString("ascii", 12, 16) !== "IHDR") {
    failures.push(`${label}: ${path} is missing a PNG IHDR header`);
    return;
  }

  const actualWidth = bytes.readUInt32BE(16);
  const actualHeight = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];

  if (actualWidth !== width || actualHeight !== height) {
    failures.push(`${label}: ${path} expected ${width}x${height}, got ${actualWidth}x${actualHeight}`);
  }

  if (bitDepth !== 8 || colorType !== expectedColorType) {
    failures.push(`${label}: ${path} expected 8-bit PNG color type ${expectedColorType}, got bit depth ${bitDepth}, color type ${colorType}`);
  }
};

expectedAssets.forEach(readPngInfo);

const listGeneratedPngFiles = (directory) => {
  const absoluteDirectory = resolve(ROOT, directory);

  if (!existsSync(absoluteDirectory)) {
    failures.push(`${directory} is missing`);
    return [];
  }

  return readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = `${directory}/${entry.name}`;

    if (entry.isDirectory()) {
      return listGeneratedPngFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith(".png") ? [entryPath] : [];
  });
};

for (const generatedPath of listGeneratedPngFiles("apps/mobile/assets/generated")) {
  if (!expectedGeneratedAssetPaths.has(generatedPath)) {
    failures.push(`${generatedPath} is a stale generated PNG that is not registered by the app asset manifest`);
  }
}

const petRegistrySource = readSource("apps/mobile/src/shared/assets/generatedPetAssets.tsx");
const sharedMockSource = readSource("packages/shared/src/mock/mockData.ts");
const gameIllustrationsSource = readSource("apps/mobile/src/shared/ui/GameIllustrations.tsx");
const gameItemCatalogSource = readSource("apps/mobile/src/shared/assets/gameItemCatalog.ts");
const gameItemCatalogMappingSource = readSource("apps/mobile/src/shared/assets/gameItemCatalogMapping.ts");

for (const asset of petAssets) {
  if (!petRegistrySource.includes(asset.assetId)) {
    failures.push(`generatedPetAssets.tsx does not register ${asset.assetId}`);
  }

  if (!petRegistrySource.includes(asset.path.replace("apps/mobile/assets/", "../../../assets/"))) {
    failures.push(`generatedPetAssets.tsx does not require ${asset.path}`);
  }

  if (!sharedMockSource.includes(`${asset.species}: "${asset.path.split("/").at(-2)}"`)) {
    failures.push(`mockData.ts does not map ${asset.species} to generated pet key ${asset.path.split("/").at(-2)}`);
  }
}

if (!sharedMockSource.includes("asset_${assetKey}_${state}_001")) {
  failures.push("mockData.ts does not build species-aware generated pet asset ids");
}

if (!sharedMockSource.includes("mock://assets/pets/${assetKey}/${state}.png")) {
  failures.push("mockData.ts does not build species-aware generated pet asset URIs");
}

for (const asset of [...backgroundAssets.filter((asset) => asset.requireInGameIllustrations !== false), ...itemAssets]) {
  if (!gameIllustrationsSource.includes(asset.path.replace("apps/mobile/assets/", "../../../assets/"))) {
    failures.push(`GameIllustrations.tsx does not require ${asset.path}`);
  }
}

for (const asset of brandAssets) {
  const expectedRequirePath = asset.path.replace("apps/mobile/assets/", "../../../assets/");

  for (const sourcePath of asset.requiredSources) {
    if (!readSource(sourcePath).includes(expectedRequirePath)) {
      failures.push(`${sourcePath} does not require ${asset.path}`);
    }
  }
}

for (const asset of runtimeGeneratedUiAssets) {
  const expectedRequirePath = asset.path.replace("apps/mobile/assets/", "../../../assets/");

  for (const sourcePath of asset.requiredSources) {
    if (!readSource(sourcePath).includes(expectedRequirePath)) {
      failures.push(`${sourcePath} does not require ${asset.path}`);
    }
  }
}

for (const asset of runtimeOnboardingAssets) {
  const expectedRequirePath = asset.path.replace("apps/mobile/assets/", "../../../assets/");

  for (const sourcePath of asset.requiredSources) {
    if (!readSource(sourcePath).includes(expectedRequirePath)) {
      failures.push(`${sourcePath} does not require ${asset.path}`);
    }
  }
}

const utilityIconRegistrySource = readSource("apps/mobile/src/shared/ui/mongchiIconAssets.ts");

for (const asset of utilityIconAssets) {
  const expectedRequirePath = asset.path.replace("apps/mobile/assets/", "../../../assets/");

  if (!utilityIconRegistrySource.includes(expectedRequirePath)) {
    failures.push(`mongchiIconAssets.ts does not require ${asset.path}`);
  }
}

for (const asset of gameItemAssets) {
  if (!gameItemCatalogSource.includes(asset.path.replace("apps/mobile/assets/", "../../../assets/"))) {
    failures.push(`gameItemCatalog.ts does not require ${asset.path}`);
  }
}

const catalogMappingEntries = [...gameItemCatalogMappingSource.matchAll(/^\s*(item_[a-z0-9_]+):\s*"([A-Za-z0-9]+)"\s*,?$/gm)].map(
  ([, id, assetKey]) => ({ id, assetKey })
);
const catalogMappingById = new Map(catalogMappingEntries.map((entry) => [entry.id, entry.assetKey]));
const duplicateCatalogMappingIds = catalogMappingEntries
  .map((entry) => entry.id)
  .filter((id, index, ids) => ids.indexOf(id) !== index);

if (catalogMappingEntries.length === 0) {
  failures.push("gameItemCatalogMapping.ts must expose at least one catalog-to-asset mapping");
}

for (const id of new Set(duplicateCatalogMappingIds)) {
  failures.push(`gameItemCatalogMapping.ts maps catalog item ${id} more than once`);
}

const runtimeCatalogItemIds = [...sharedMockSource.matchAll(/\bid:\s*"(item_[a-z0-9_]+)"/g)].map(([, id]) => id);

for (const id of new Set(runtimeCatalogItemIds)) {
  if (!catalogMappingById.has(id)) {
    failures.push(`gameItemCatalogMapping.ts does not map runtime catalog item ${id}`);
  }
}

for (const { id, assetKey } of catalogMappingEntries) {
  if (!new RegExp(`\\|\\s*"${assetKey}"`).test(gameItemCatalogMappingSource)) {
    failures.push(`gameItemCatalogMapping.ts maps ${id} to undeclared asset key ${assetKey}`);
  }

  if (!new RegExp(`^\\s*${assetKey}:\\s*defineItem\\(`, "m").test(gameItemCatalogSource)) {
    failures.push(`gameItemCatalog.ts does not define mapped asset key ${assetKey} for ${id}`);
  }
}

const runtimeGameItemRequirePaths = new Set(
  [...gameItemCatalogSource.matchAll(/require\("(\.\.\/\.\.\/\.\.\/assets\/game-items\/[^\"]+\.png)"\)/g)].map(
    ([, requirePath]) => requirePath.replace("../../../assets/", "apps/mobile/assets/")
  )
);

for (const runtimePath of runtimeGameItemRequirePaths) {
  const absolutePath = resolve(ROOT, runtimePath);

  if (!existsSync(absolutePath)) {
    failures.push(`gameItemCatalog.ts requires missing runtime asset ${runtimePath}`);
    continue;
  }

  const bytes = readFileSync(absolutePath);

  if (bytes.length < 33 || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    failures.push(`gameItemCatalog.ts runtime asset ${runtimePath} is not a valid PNG file`);
  }
}

for (const slotId of homeDecorationSlotIds) {
  if (!gameItemCatalogSource.includes(`${slotId}: {`)) {
    failures.push(`gameItemCatalog.ts does not define home decoration slot ${slotId}`);
  }
}

for (const requiredFragment of [
  "export interface GameItemDefinition",
  "export const homeDecorationSlots",
  "allowedSlots:",
  "anchorX:",
  "anchorY:",
  "contactShadow:"
]) {
  if (!gameItemCatalogSource.includes(requiredFragment)) {
    failures.push(`gameItemCatalog.ts is missing fixed item manifest fragment: ${requiredFragment}`);
  }
}

if (failures.length > 0) {
  console.error("Mobile asset validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Mobile asset validation passed for ${expectedAssets.length} mobile PNG assets.`);
