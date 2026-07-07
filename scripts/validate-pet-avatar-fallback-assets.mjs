import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const failures = [];

const fallbackSets = [
  { key: "miso", species: "dog" },
  { key: "luna", species: "cat" }
];

const requiredStates = [
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

const screenCriticalStates = requiredStates.filter((state) => state !== "base");

const readText = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");

const hashFile = (relativePath) =>
  crypto.createHash("sha256").update(fs.readFileSync(path.join(rootDir, relativePath))).digest("hex");

const readPng = (relativePath) => PNG.sync.read(fs.readFileSync(path.join(rootDir, relativePath)));

const visibleCoverage = (png) => {
  let visiblePixels = 0;
  let semiTransparentPixels = 0;
  let minX = png.width;
  let maxX = -1;
  let minY = png.height;
  let maxY = -1;

  for (let index = 0; index < png.data.length; index += 4) {
    const alpha = png.data[index + 3];

    if (alpha === 0) {
      continue;
    }

    const pixelIndex = index / 4;
    const x = pixelIndex % png.width;
    const y = Math.floor(pixelIndex / png.width);

    visiblePixels += 1;

    if (alpha < 255) {
      semiTransparentPixels += 1;
    }

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  return {
    visibleRatio: visiblePixels / (png.width * png.height),
    semiTransparentPixels,
    centerX: maxX >= 0 ? (minX + maxX) / 2 / png.width : 0,
    centerY: maxY >= 0 ? (minY + maxY) / 2 / png.height : 0
  };
};

const petRegistrySource = readText("apps/mobile/src/shared/assets/generatedPetAssets.tsx");
const sharedMockSource = readText("packages/shared/src/mock/mockData.ts");
const promptGuide = readText("docs/design/pet-asset-generation-prompts.md");

for (const state of requiredStates) {
  if (!promptGuide.includes(`- \`${state}\``)) {
    failures.push(`docs/design/pet-asset-generation-prompts.md must document required state ${state}.`);
  }
}

for (const { key, species } of fallbackSets) {
  const stateHashes = new Map();

  for (const state of requiredStates) {
    const relativePath = `apps/mobile/assets/generated/pets/${key}/${state}.png`;
    const assetId = `asset_${key}_${state}_001`;

    if (!fs.existsSync(path.join(rootDir, relativePath))) {
      failures.push(`${relativePath} is missing.`);
      continue;
    }

    const png = readPng(relativePath);

    if (png.width !== 256 || png.height !== 256) {
      failures.push(`${relativePath} must remain 256x256, got ${png.width}x${png.height}.`);
    }

    const coverage = visibleCoverage(png);

    if (coverage.visibleRatio < 0.18 || coverage.visibleRatio > 0.65) {
      failures.push(`${relativePath} visible coverage is ${coverage.visibleRatio.toFixed(2)}, outside expected pet fallback bounds.`);
    }

    if (coverage.semiTransparentPixels < 24) {
      failures.push(`${relativePath} has too few soft alpha edge pixels; it may have regressed toward a hard cutout.`);
    }

    if (Math.abs(coverage.centerX - 0.5) > 0.18 || Math.abs(coverage.centerY - 0.52) > 0.24) {
      failures.push(`${relativePath} visible pet is off-center.`);
    }

    if (!petRegistrySource.includes(assetId)) {
      failures.push(`generatedPetAssets.tsx must register ${assetId}.`);
    }

    if (!petRegistrySource.includes(`../../../assets/generated/pets/${key}/${state}.png`)) {
      failures.push(`generatedPetAssets.tsx must require ${relativePath}.`);
    }

    stateHashes.set(state, hashFile(relativePath));
  }

  const screenHashes = screenCriticalStates.map((state) => stateHashes.get(state)).filter(Boolean);
  const duplicateScreenHashes = [...new Set(screenHashes.filter((hash, index) => screenHashes.indexOf(hash) !== index))];

  if (duplicateScreenHashes.length > 0) {
    for (const duplicateHash of duplicateScreenHashes) {
      const duplicateStates = screenCriticalStates.filter((state) => stateHashes.get(state) === duplicateHash);
      failures.push(`${key} ${species} screen-critical fallback states must be distinct; duplicate hash in ${duplicateStates.join(", ")}.`);
    }
  }

  const uniqueHashCount = new Set([...stateHashes.values()]).size;

  if (uniqueHashCount < requiredStates.length - 1) {
    failures.push(`${key} ${species} fallback set should have at least ${requiredStates.length - 1} unique PNGs; found ${uniqueHashCount}.`);
  }

  if (!sharedMockSource.includes(`${species}: "${key}"`)) {
    failures.push(`mockData.ts must map ${species} fallback assets to ${key}.`);
  }
}

if (!petRegistrySource.includes("fallbackAssetKeyBySpecies")) {
  failures.push("generatedPetAssets.tsx must keep an explicit species-to-fallback key map.");
}

if (!petRegistrySource.includes("getFallbackGeneratedPetAssetId")) {
  failures.push("generatedPetAssets.tsx must keep getFallbackGeneratedPetAssetId for deterministic fallback routing.");
}

if (failures.length > 0) {
  console.error("Pet avatar fallback asset validation failed:");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log("Pet avatar fallback asset validation passed.");
