import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const root = resolve(process.env.MONGCHI_ICON_VALIDATOR_ROOT ?? fileURLToPath(new URL("..", import.meta.url)));
const assetDirectory = resolve(root, "apps/mobile/assets/generated/ui/utility-icons/v1");
const manifestPath = resolve(assetDirectory, "manifest.json");
const failures = [];

if (!existsSync(manifestPath)) {
  throw new Error(`Missing icon manifest: ${manifestPath}`);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const expectedKeys = manifest.keys;
const expectedSet = new Set(expectedKeys);
const actualKeys = readdirSync(assetDirectory)
  .filter((name) => name.endsWith(".png"))
  .map((name) => name.slice(0, -4))
  .sort();

for (const key of expectedKeys) {
  if (!actualKeys.includes(key)) failures.push(`${key}: master is missing`);
}
for (const key of actualKeys) {
  if (!expectedSet.has(key)) failures.push(`${key}: unexpected PNG master`);
}
if (expectedKeys.length !== 48 || expectedSet.size !== 48) {
  failures.push(`manifest must name exactly 48 unique keys, received ${expectedKeys.length}/${expectedSet.size}`);
}

const sourceDirectory = resolve(root, manifest.provenance.sourceEvidenceDirectory);
for (const [sheet, expectedHash] of Object.entries(manifest.provenance.sourceSheets)) {
  const sourcePath = resolve(sourceDirectory, `${sheet}.png`);
  if (!existsSync(sourcePath)) {
    failures.push(`${sheet}: missing provenance source sheet`);
    continue;
  }
  const actualHash = createHash("sha256").update(readFileSync(sourcePath)).digest("hex");
  if (actualHash !== expectedHash) failures.push(`${sheet}: provenance hash does not match source sheet`);
}
for (const key of expectedKeys) {
  const sourceSheet = manifest.assetSourceSheet?.[key];
  if (!sourceSheet || !Object.hasOwn(manifest.provenance.sourceSheets, sourceSheet)) {
    failures.push(`${key}: must map to a recorded provenance source sheet`);
  }
}

const nearWhite = ([r, g, b]) => r >= 190 && g >= 170 && b >= 130;
const cocoa = ([r, g, b]) => r >= 35 && r <= 130 && g >= 10 && g <= 105 && b <= 85 && r >= g;

function alphaBounds(png) {
  let left = png.width;
  let top = png.height;
  let right = -1;
  let bottom = -1;
  let opaque = 0;
  let transparent = 0;
  let cocoaPixels = 0;
  let upperLeftHighlights = 0;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const offset = (y * png.width + x) * 4;
      const rgba = [png.data[offset], png.data[offset + 1], png.data[offset + 2], png.data[offset + 3]];
      const alpha = rgba[3];
      if (alpha === 0) transparent += 1;
      if (alpha >= 128) {
        opaque += 1;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
        if (cocoa(rgba)) cocoaPixels += 1;
        if (x < png.width / 2 && y < png.height / 2 && nearWhite(rgba)) upperLeftHighlights += 1;
      }
    }
  }

  const inset = Math.min(left, top, png.width - 1 - right, png.height - 1 - bottom);
  return { inset, opaque, transparent, cocoaPixels, upperLeftHighlights };
}

const masters = [];
for (const key of expectedKeys) {
  const path = resolve(assetDirectory, `${key}.png`);
  if (!existsSync(path)) continue;
  const bytes = readFileSync(path);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (manifest.assetSha256[key] !== sha256) failures.push(`${key}: manifest hash does not match master`);

  const png = PNG.sync.read(bytes);
  if (png.width !== manifest.master.width || png.height !== manifest.master.height) {
    failures.push(`${key}: expected ${manifest.master.width}x${manifest.master.height}, got ${png.width}x${png.height}`);
    continue;
  }
  const metrics = alphaBounds(png);
  if (metrics.opaque === 0 || metrics.transparent === 0) failures.push(`${key}: must contain both opaque art and transparent field`);
  if (metrics.inset < manifest.master.minimumSafeInsetPixels) {
    failures.push(`${key}: safe inset ${metrics.inset}px is below ${manifest.master.minimumSafeInsetPixels}px`);
  }
  if (metrics.cocoaPixels < 12) failures.push(`${key}: cocoa-outline heuristic failed`);
  if (metrics.upperLeftHighlights < 2) failures.push(`${key}: upper-left gloss heuristic failed`);
  masters.push({ key, hash: sha256, pixelHash: createHash("sha256").update(png.data).digest("hex") });
}

for (let left = 0; left < masters.length; left += 1) {
  for (let right = left + 1; right < masters.length; right += 1) {
    const a = masters[left];
    const b = masters[right];
    if (a.hash === b.hash) failures.push(`${a.key}/${b.key}: duplicate master bytes`);
    if (a.pixelHash === b.pixelHash) failures.push(`${a.key}/${b.key}: duplicate rendered pixels`);
  }
}

const mappedLucideKeys = Object.values(manifest.lucideMigrationMap);
if (Object.keys(manifest.lucideMigrationMap).length !== 43 || mappedLucideKeys.some((key) => !expectedSet.has(key))) {
  failures.push("Lucide migration map must cover 43 audited glyphs using valid icon keys");
}

if (failures.length > 0) {
  console.error(`MongChi utility icon validation failed (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`MongChi utility icon validation passed: ${expectedKeys.length} transparent 192px masters, ${Object.keys(manifest.lucideMigrationMap).length} Lucide mappings.`);
}
