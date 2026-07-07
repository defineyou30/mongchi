import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputPath = resolve(ROOT, "docs/qa-screenshots/mobile-generated-assets-contact-sheet.png");
const thumbnailSize = 104;
const columns = 8;
const gap = 12;
const border = 4;
const frameColor = { red: 255, green: 252, blue: 240, alpha: 255 };
const backgroundColor = { red: 154, green: 218, blue: 246, alpha: 255 };
const checkerLight = { red: 255, green: 248, blue: 232, alpha: 255 };
const checkerDark = { red: 232, green: 226, blue: 212, alpha: 255 };

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

const assets = [
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

const readPng = (relativePath) => {
  const absolutePath = resolve(ROOT, relativePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`${relativePath} is missing.`);
  }

  return PNG.sync.read(readFileSync(absolutePath));
};

const fillRect = (image, x, y, width, height, color) => {
  for (let row = y; row < y + height; row += 1) {
    for (let col = x; col < x + width; col += 1) {
      const index = (image.width * row + col) << 2;
      image.data[index] = color.red;
      image.data[index + 1] = color.green;
      image.data[index + 2] = color.blue;
      image.data[index + 3] = color.alpha;
    }
  }
};

const fillChecker = (image, x, y, width, height) => {
  const square = 12;

  for (let row = y; row < y + height; row += 1) {
    for (let col = x; col < x + width; col += 1) {
      const color = (Math.floor((row - y) / square) + Math.floor((col - x) / square)) % 2 === 0 ? checkerLight : checkerDark;
      const index = (image.width * row + col) << 2;
      image.data[index] = color.red;
      image.data[index + 1] = color.green;
      image.data[index + 2] = color.blue;
      image.data[index + 3] = color.alpha;
    }
  }
};

const resizePngToFit = (source, maxWidth, maxHeight) => {
  const scale = Math.min(maxWidth / source.width, maxHeight / source.height);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const resized = new PNG({ width, height });

  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(source.height - 1, Math.floor((y * source.height) / height));

    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor((x * source.width) / width));
      const sourceIndex = (source.width * sourceY + sourceX) << 2;
      const targetIndex = (width * y + x) << 2;

      resized.data[targetIndex] = source.data[sourceIndex];
      resized.data[targetIndex + 1] = source.data[sourceIndex + 1];
      resized.data[targetIndex + 2] = source.data[sourceIndex + 2];
      resized.data[targetIndex + 3] = source.data[sourceIndex + 3];
    }
  }

  return resized;
};

const blitAlpha = (source, target, offsetX, offsetY) => {
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sourceIndex = (source.width * y + x) << 2;
      const targetIndex = (target.width * (offsetY + y) + offsetX + x) << 2;
      const sourceAlpha = source.data[sourceIndex + 3] / 255;
      const inverseAlpha = 1 - sourceAlpha;

      target.data[targetIndex] = Math.round(source.data[sourceIndex] * sourceAlpha + target.data[targetIndex] * inverseAlpha);
      target.data[targetIndex + 1] = Math.round(source.data[sourceIndex + 1] * sourceAlpha + target.data[targetIndex + 1] * inverseAlpha);
      target.data[targetIndex + 2] = Math.round(source.data[sourceIndex + 2] * sourceAlpha + target.data[targetIndex + 2] * inverseAlpha);
      target.data[targetIndex + 3] = 255;
    }
  }
};

const cellSize = thumbnailSize + border * 2;
const rows = Math.ceil(assets.length / columns);
const sheet = new PNG({
  width: columns * cellSize + (columns + 1) * gap,
  height: rows * cellSize + (rows + 1) * gap
});

fillRect(sheet, 0, 0, sheet.width, sheet.height, backgroundColor);

for (const [index, asset] of assets.entries()) {
  const column = index % columns;
  const row = Math.floor(index / columns);
  const cellX = gap + column * (cellSize + gap);
  const cellY = gap + row * (cellSize + gap);
  const image = resizePngToFit(readPng(asset), thumbnailSize, thumbnailSize);
  const imageX = cellX + border + Math.floor((thumbnailSize - image.width) / 2);
  const imageY = cellY + border + Math.floor((thumbnailSize - image.height) / 2);

  fillRect(sheet, cellX, cellY, cellSize, cellSize, frameColor);
  fillChecker(sheet, cellX + border, cellY + border, thumbnailSize, thumbnailSize);
  blitAlpha(image, sheet, imageX, imageY);
}

writeFileSync(outputPath, PNG.sync.write(sheet));
console.log(`Generated mobile asset contact sheet: ${outputPath}`);
