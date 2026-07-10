import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { PNG } from "pngjs";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const failures = [];

const backgroundAssets = [
  "apps/mobile/assets/generated/backgrounds/pixel-garden-premium-v1.png"
];

const itemAssets = [
  "apps/mobile/assets/generated/items/bone-v3.png",
  "apps/mobile/assets/generated/items/coin-v3.png",
  "apps/mobile/assets/generated/items/cushion-v3.png",
  "apps/mobile/assets/generated/items/doghouse-v3.png",
  "apps/mobile/assets/generated/items/flower-pot-v3.png",
  "apps/mobile/assets/generated/items/food-bowl-v3.png",
  "apps/mobile/assets/generated/items/gem-v3.png",
  "apps/mobile/assets/generated/items/gift-v3.png",
  "apps/mobile/assets/generated/items/lantern-v3.png",
  "apps/mobile/assets/generated/items/toy-ball-v3.png",
  "apps/mobile/assets/generated/items/watering-can-v3.png"
];

const gameItemNames = [
  "food-bowl",
  "treat-plate",
  "bone",
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
  "seasonal-flowers"
];

const gameItemAssets = ["scene", "ui", "hud", "action"].flatMap((variant) =>
  gameItemNames.map((name) => `apps/mobile/assets/game-items/${variant}/${name}.png`)
);

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

const petAssets = ["miso", "luna"].flatMap((pet) =>
  petAssetStates.map((state) => `apps/mobile/assets/generated/pets/${pet}/${state}.png`)
);

const readPng = (relativePath) => {
  const absolutePath = path.join(rootDir, relativePath);

  if (!fs.existsSync(absolutePath)) {
    failures.push(`${relativePath} is missing.`);
    return null;
  }

  try {
    return PNG.sync.read(fs.readFileSync(absolutePath));
  } catch (error) {
    failures.push(`${relativePath} could not be decoded as PNG: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
};

const readHash = (relativePath) => {
  const absolutePath = path.join(rootDir, relativePath);

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return crypto.createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex");
};

const getMetrics = (png) => {
  const quantizedColors = new Set();
  let transparentPixels = 0;
  let opaquePixels = 0;
  let semiTransparentPixels = 0;
  let minLuminance = Number.POSITIVE_INFINITY;
  let maxLuminance = Number.NEGATIVE_INFINITY;
  let saturationTotal = 0;
  let nonTransparentMinX = png.width;
  let nonTransparentMaxX = -1;
  let nonTransparentMinY = png.height;
  let nonTransparentMaxY = -1;

  for (let index = 0; index < png.data.length; index += 4) {
    const pixelIndex = index / 4;
    const x = pixelIndex % png.width;
    const y = Math.floor(pixelIndex / png.width);
    const r = png.data[index];
    const g = png.data[index + 1];
    const b = png.data[index + 2];
    const a = png.data[index + 3];

    if (a === 0) {
      transparentPixels += 1;
      continue;
    }

    if (a === 255) {
      opaquePixels += 1;
    } else {
      semiTransparentPixels += 1;
    }

    nonTransparentMinX = Math.min(nonTransparentMinX, x);
    nonTransparentMaxX = Math.max(nonTransparentMaxX, x);
    nonTransparentMinY = Math.min(nonTransparentMinY, y);
    nonTransparentMaxY = Math.max(nonTransparentMaxY, y);

    quantizedColors.add(`${r >> 3},${g >> 3},${b >> 3},${a >> 4}`);

    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    minLuminance = Math.min(minLuminance, luminance);
    maxLuminance = Math.max(maxLuminance, luminance);
    saturationTotal += (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  }

  const totalPixels = png.width * png.height;
  const visiblePixels = totalPixels - transparentPixels;
  const visibleCenterX =
    nonTransparentMaxX >= 0 ? (nonTransparentMinX + nonTransparentMaxX) / 2 / png.width : 0;
  const visibleCenterY =
    nonTransparentMaxY >= 0 ? (nonTransparentMinY + nonTransparentMaxY) / 2 / png.height : 0;

  return {
    avgSaturation: visiblePixels > 0 ? saturationTotal / visiblePixels : 0,
    luminanceRange: visiblePixels > 0 ? maxLuminance - minLuminance : 0,
    opaquePixels,
    quantizedColorCount: quantizedColors.size,
    semiTransparentPixels,
    totalPixels,
    transparentPixels,
    visibleCenterX,
    visibleCenterY,
    visiblePixels
  };
};

for (const asset of backgroundAssets) {
  const png = readPng(asset);

  if (!png) {
    continue;
  }

  const metrics = getMetrics(png);

  if (metrics.transparentPixels > 0) {
    failures.push(`${asset} must be an opaque background PNG.`);
  }

  if (metrics.quantizedColorCount < 30) {
    failures.push(`${asset} has too few color regions (${metrics.quantizedColorCount}); it may have regressed to placeholder art.`);
  }

  if (metrics.luminanceRange < 55) {
    failures.push(`${asset} has insufficient light/dark range (${metrics.luminanceRange.toFixed(1)}).`);
  }

  if (metrics.avgSaturation < 0.16) {
    failures.push(`${asset} has insufficient color saturation (${metrics.avgSaturation.toFixed(2)}).`);
  }
}

for (const asset of [...itemAssets, ...gameItemAssets]) {
  const png = readPng(asset);

  if (!png) {
    continue;
  }

  const metrics = getMetrics(png);
  const transparentRatio = metrics.transparentPixels / metrics.totalPixels;
  const visibleRatio = metrics.visiblePixels / metrics.totalPixels;

  if (transparentRatio < 0.25 || transparentRatio > 0.9) {
    failures.push(`${asset} must remain a cutout icon with transparent background; transparent ratio is ${transparentRatio.toFixed(2)}.`);
  }

  if (visibleRatio < 0.08 || visibleRatio > 0.65) {
    failures.push(`${asset} visible coverage is ${visibleRatio.toFixed(2)}, outside expected icon bounds.`);
  }

  if (metrics.quantizedColorCount < 3) {
    failures.push(`${asset} has too few color regions (${metrics.quantizedColorCount}).`);
  }

  if (gameItemAssets.includes(asset) && metrics.semiTransparentPixels < 12) {
    failures.push(`${asset} has too few soft alpha edge pixels; it may have regressed toward hard-edged pixel art.`);
  }

  if (Math.abs(metrics.visibleCenterX - 0.5) > 0.2 || Math.abs(metrics.visibleCenterY - 0.5) > 0.24) {
    failures.push(`${asset} visible subject is off-center.`);
  }
}

for (const asset of petAssets) {
  const png = readPng(asset);

  if (!png) {
    continue;
  }

  const metrics = getMetrics(png);
  const transparentRatio = metrics.transparentPixels / metrics.totalPixels;
  const visibleRatio = metrics.visiblePixels / metrics.totalPixels;

  if (transparentRatio < 0.35 || transparentRatio > 0.78) {
    failures.push(`${asset} must remain a pet sprite cutout; transparent ratio is ${transparentRatio.toFixed(2)}.`);
  }

  if (visibleRatio < 0.18 || visibleRatio > 0.65) {
    failures.push(`${asset} visible coverage is ${visibleRatio.toFixed(2)}, outside expected sprite bounds.`);
  }

  if (metrics.quantizedColorCount < 10) {
    failures.push(`${asset} has too few color regions (${metrics.quantizedColorCount}); it may have regressed to placeholder art.`);
  }

  if (Math.abs(metrics.visibleCenterX - 0.5) > 0.18 || Math.abs(metrics.visibleCenterY - 0.52) > 0.24) {
    failures.push(`${asset} visible sprite is off-center.`);
  }
}

for (const pet of ["miso", "luna"]) {
  const hashes = petAssetStates
    .map((state) => readHash(`apps/mobile/assets/generated/pets/${pet}/${state}.png`))
    .filter((hash) => hash !== null);
  const uniqueHashes = new Set(hashes);

  if (uniqueHashes.size < Math.min(petAssetStates.length, 8)) {
    failures.push(
      `apps/mobile/assets/generated/pets/${pet} must contain distinct state fallback art; found ${uniqueHashes.size} unique PNGs for ${petAssetStates.length} states.`
    );
  }
}

if (failures.length > 0) {
  console.error("Mobile visual asset quality validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Mobile visual asset quality validation passed.");
