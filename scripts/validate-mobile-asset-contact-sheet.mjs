import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const contactSheetPath = resolve(ROOT, "docs/qa-screenshots/mobile-generated-assets-contact-sheet.png");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const failures = [];

const petStates = [
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

const itemNames = [
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

const gameItemNames = [
  "food-bowl",
  "treat-plate",
  "bone",
  "salmon-bites",
  "chicken-jerky",
  "pumpkin-cookie",
  "berry-yogurt",
  "sweet-potato-chew",
  "tuna-crunch",
  "duck-biscuit",
  "cheese-puff",
  "apple-biscuit",
  "milk-pup-cup",
  "toy-ball",
  "plush-toy",
  "pet-bed",
  "tiny-house",
  "flower-pot",
  "leafy-plant",
  "hanging-lantern",
  "small-lamp",
  "watering-can",
  "pond-tile",
  "stepping-stone",
  "reward-pouch",
  "gift-box",
  "coin",
  "gem",
  "seasonal-flowers",
  "drink-water-bowl"
];

const plantStageAssetNames = [
  "flower-pot-seed",
  "flower-pot-sprout",
  "flower-pot-leafy",
  "flower-pot-bloom",
  "clover-sprout",
  "clover-leafy",
  "clover-bloom",
  "spring-patch-sprout",
  "spring-patch-leafy",
  "spring-patch-bloom"
];

const runtimeBackgroundAssets = [
  "apps/mobile/assets/generated/backgrounds/candidates/home-garden-premium-v2-portrait.png",
  "apps/mobile/assets/generated/backgrounds/candidates/shop-market-premium-v1-portrait.png",
  "apps/mobile/assets/generated/backgrounds/candidates/chat-garden-premium-v1-portrait.png",
  "apps/mobile/assets/generated/backgrounds/candidates/hatch-reveal-garden-premium-v1-portrait.png"
];

const themeBackgroundAssets = [
  "apps/mobile/assets/generated/backgrounds/themes/theme-fairy-garden-v1-portrait.png",
  "apps/mobile/assets/generated/backgrounds/themes/theme-seaside-cove-v1-portrait.png",
  "apps/mobile/assets/generated/backgrounds/themes/theme-autumn-woods-v1-portrait.png",
  "apps/mobile/assets/generated/backgrounds/themes/theme-winter-lights-v1-portrait.png"
];

const brandAssets = [
  "apps/mobile/assets/generated/brand/welcome-screen-v1.png",
  "apps/mobile/assets/generated/brand/loading-screen-v1.png",
  "apps/mobile/assets/generated/brand/app-logo-v1.png"
];

const sourceAssets = [
  "apps/mobile/assets/icon.png",
  "apps/mobile/assets/adaptive-icon.png",
  "apps/mobile/assets/splash.png",
  "apps/mobile/assets/generated/backgrounds/terrarium-sky-v2.png",
  "apps/mobile/assets/generated/backgrounds/terrarium-dome-v4.png",
  "apps/mobile/assets/generated/backgrounds/pixel-garden-premium-v1.png",
  "apps/mobile/assets/generated/backgrounds/shop-room-square-premium-v1.png",
  ...runtimeBackgroundAssets,
  ...themeBackgroundAssets,
  ...brandAssets,
  ...itemNames.map((name) => `apps/mobile/assets/generated/items/${name}.png`),
  ...["scene", "ui", "hud", "action"].flatMap((variant) =>
    gameItemNames.map((name) => `apps/mobile/assets/game-items/${variant}/${name}.png`)
  ),
  ...plantStageAssetNames.map((name) => `apps/mobile/assets/game-items/plant-stages/scene/${name}.png`),
  ...["miso", "luna"].flatMap((pet) => petStates.map((state) => `apps/mobile/assets/generated/pets/${pet}/${state}.png`))
];

const readPngInfo = (absolutePath) => {
  if (!existsSync(absolutePath) || statSync(absolutePath).size === 0) {
    throw new Error(`${absolutePath} is missing or empty.`);
  }

  const bytes = readFileSync(absolutePath);

  if (bytes.length < 33 || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`${absolutePath} is not a PNG file.`);
  }

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20)
  };
};

for (const asset of sourceAssets) {
  try {
    readPngInfo(resolve(ROOT, asset));
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

try {
  const info = readPngInfo(contactSheetPath);

  if (info.width < 800 || info.height < 600) {
    failures.push(`${contactSheetPath} is ${info.width}x${info.height}; expected a multi-asset contact sheet.`);
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}

if (existsSync(contactSheetPath)) {
  const contactSheetMtime = statSync(contactSheetPath).mtimeMs;
  const latestSourceMtime = Math.max(...sourceAssets.map((asset) => statSync(resolve(ROOT, asset)).mtimeMs));

  if (contactSheetMtime + 1000 < latestSourceMtime) {
    failures.push(`${contactSheetPath} is older than at least one generated mobile asset. Run npm run generate:mobile-asset-contact-sheet.`);
  }
}

if (failures.length > 0) {
  console.error("Mobile asset contact sheet validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Mobile asset contact sheet validation passed.");
