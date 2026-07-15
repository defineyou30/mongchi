import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifestPath = resolve(ROOT, "docs/store-screenshot-manifest.json");
const listingPath = resolve(ROOT, "docs/release/store-listing-draft.md");
const presetSourcePath = resolve(ROOT, "apps/mobile/src/features/session/storeScreenshotSession.ts");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const screenshotRequirement = (process.env.TINY_PET_REQUIRE_STORE_SCREENSHOTS ?? "").trim().toLowerCase();
const failures = [];

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const manifest = readJson(manifestPath);
const listing = readFileSync(listingPath, "utf8");
const presetSource = readFileSync(presetSourcePath, "utf8");
const outputDirectory = resolve(ROOT, manifest.outputDirectory ?? "");
const visualRecords = [];

const createVisualFingerprint = (decoded) => {
  const gridWidth = 12;
  const gridHeight = 20;
  const values = [];

  for (let gridY = 0; gridY < gridHeight; gridY++) {
    for (let gridX = 0; gridX < gridWidth; gridX++) {
      const xStart = Math.floor((gridX * decoded.width) / gridWidth);
      const xEnd = Math.floor(((gridX + 1) * decoded.width) / gridWidth);
      const yStart = Math.floor((gridY * decoded.height) / gridHeight);
      const yEnd = Math.floor(((gridY + 1) * decoded.height) / gridHeight);
      let red = 0;
      let green = 0;
      let blue = 0;
      let count = 0;

      for (let y = yStart; y < yEnd; y += 4) {
        for (let x = xStart; x < xEnd; x += 4) {
          const index = (decoded.width * y + x) << 2;

          if (decoded.data[index + 3] > 200) {
            red += decoded.data[index];
            green += decoded.data[index + 1];
            blue += decoded.data[index + 2];
            count += 1;
          }
        }
      }

      values.push(Math.round(red / count) || 0, Math.round(green / count) || 0, Math.round(blue / count) || 0);
    }
  }

  return values;
};

const visualDistance = (left, right) =>
  left.reduce((sum, value, index) => sum + Math.abs(value - right[index]), 0) / (left.length * 255);

const sampleRegion = (decoded, region) => {
  const xStart = Math.floor(decoded.width * region.left);
  const xEnd = Math.floor(decoded.width * region.right);
  const yStart = Math.floor(decoded.height * region.top);
  const yEnd = Math.floor(decoded.height * region.bottom);
  let sampled = 0;
  let lightPixels = 0;
  let darkPixels = 0;
  let bluePixels = 0;
  let greyPixels = 0;
  let creamPixels = 0;

  for (let y = yStart; y < yEnd; y += 6) {
    for (let x = xStart; x < xEnd; x += 6) {
      const index = (decoded.width * y + x) << 2;
      const red = decoded.data[index];
      const green = decoded.data[index + 1];
      const blue = decoded.data[index + 2];
      const alpha = decoded.data[index + 3];

      if (alpha <= 200) {
        continue;
      }

      sampled += 1;

      if (red > 225 && green > 225 && blue > 220) {
        lightPixels += 1;
      }

      if (red < 70 && green < 70 && blue < 70) {
        darkPixels += 1;
      }

      if (red < 90 && green > 90 && blue > 170) {
        bluePixels += 1;
      }

      if (
        red >= 90 &&
        red <= 210 &&
        green >= 90 &&
        green <= 210 &&
        blue >= 90 &&
        blue <= 210 &&
        Math.max(red, green, blue) - Math.min(red, green, blue) <= 24
      ) {
        greyPixels += 1;
      }

      if (red > 220 && green > 185 && blue > 135) {
        creamPixels += 1;
      }
    }
  }

  return {
    blueRatio: sampled > 0 ? bluePixels / sampled : 0,
    creamRatio: sampled > 0 ? creamPixels / sampled : 0,
    darkRatio: sampled > 0 ? darkPixels / sampled : 0,
    greyRatio: sampled > 0 ? greyPixels / sampled : 0,
    lightRatio: sampled > 0 ? lightPixels / sampled : 0
  };
};

const sampleVisualComplexity = (decoded, region) => {
  const xStart = Math.floor(decoded.width * region.left);
  const xEnd = Math.floor(decoded.width * region.right);
  const yStart = Math.floor(decoded.height * region.top);
  const yEnd = Math.floor(decoded.height * region.bottom);
  const buckets = new Set();
  let previous = null;
  let totalDelta = 0;
  let transitions = 0;
  let sampled = 0;

  for (let y = yStart; y < yEnd; y += 12) {
    for (let x = xStart; x < xEnd; x += 12) {
      const index = (decoded.width * y + x) << 2;
      const red = decoded.data[index];
      const green = decoded.data[index + 1];
      const blue = decoded.data[index + 2];
      const alpha = decoded.data[index + 3];

      if (alpha <= 200) {
        continue;
      }

      const bucket = `${Math.floor(red / 32)}:${Math.floor(green / 32)}:${Math.floor(blue / 32)}`;
      buckets.add(bucket);
      sampled += 1;

      if (previous) {
        totalDelta +=
          Math.abs(red - previous.red) + Math.abs(green - previous.green) + Math.abs(blue - previous.blue);
        transitions += 1;
      }

      previous = { blue, green, red };
    }
  }

  return {
    averageDelta: transitions > 0 ? totalDelta / transitions : 0,
    bucketCount: buckets.size,
    sampled
  };
};

const appearsToBeIosOpenUrlPrompt = (decoded) => {
  const modal = sampleRegion(decoded, { left: 0.16, right: 0.84, top: 0.43, bottom: 0.58 });
  const buttonBand = sampleRegion(decoded, { left: 0.2, right: 0.8, top: 0.52, bottom: 0.57 });

  return (modal.lightRatio > 0.45 || modal.greyRatio > 0.25) && modal.darkRatio > 0.01 && buttonBand.blueRatio > 0.01;
};

const appearsToHaveDevClientFloatingToolButton = (decoded) => {
  const topRight = sampleRegion(decoded, { left: 0.86, right: 0.99, top: 0.09, bottom: 0.19 });
  const topLeft = sampleRegion(decoded, { left: 0.04, right: 0.17, top: 0.09, bottom: 0.19 });
  const topMiddle = sampleRegion(decoded, { left: 0.67, right: 0.8, top: 0.09, bottom: 0.19 });
  const localGreyLift = topRight.greyRatio - Math.max(topLeft.greyRatio, topMiddle.greyRatio);

  return (
    localGreyLift > 0.12 &&
    topRight.greyRatio > 0.18 &&
    topRight.lightRatio < 0.12 &&
    topRight.blueRatio < 0.04 &&
    topRight.creamRatio < 0.18
  );
};

const readPngInfo = (filePath, options = {}) => {
  const rejectIosOpenUrlPrompt = options.rejectIosOpenUrlPrompt ?? true;

  if (!existsSync(filePath) || statSync(filePath).size === 0) {
    throw new Error(`${filePath} is missing or empty.`);
  }

  const bytes = readFileSync(filePath);

  if (bytes.length < 33 || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`${filePath} is not a PNG file.`);
  }

  if (bytes.length < 150000) {
    throw new Error(`${filePath} is too small for a valid rich store screenshot and may be a splash screen or system dialog.`);
  }

  const decoded = PNG.sync.read(bytes);
  const centralComplexity = sampleVisualComplexity(decoded, { left: 0.12, right: 0.88, top: 0.18, bottom: 0.82 });
  let sampled = 0;
  let redErrorPixels = 0;

  for (let y = 0; y < decoded.height; y += 8) {
    for (let x = 0; x < decoded.width; x += 8) {
      const index = (decoded.width * y + x) << 2;
      const red = decoded.data[index];
      const green = decoded.data[index + 1];
      const blue = decoded.data[index + 2];
      const alpha = decoded.data[index + 3];

      if (alpha > 200) {
        sampled += 1;

        if (red > 180 && green < 80 && blue < 80) {
          redErrorPixels += 1;
        }
      }
    }
  }

  if (sampled > 0 && redErrorPixels / sampled > 0.08) {
    throw new Error(`${filePath} appears to be a React Native red error screen, not a valid store screenshot.`);
  }

  if (centralComplexity.sampled > 0 && centralComplexity.bucketCount <= 3 && centralComplexity.averageDelta < 3) {
    throw new Error(`${filePath} appears to be a flat splash screen, not a valid store screenshot.`);
  }

  if (rejectIosOpenUrlPrompt && appearsToBeIosOpenUrlPrompt(decoded)) {
    throw new Error(`${filePath} appears to include an iOS "Open in app" confirmation prompt, not a clean store screenshot.`);
  }

  if (appearsToHaveDevClientFloatingToolButton(decoded)) {
    throw new Error(`${filePath} appears to include the development-client tools button, not a clean store screenshot.`);
  }

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    size: bytes.length,
    fingerprint: createVisualFingerprint(decoded)
  };
};

const slugPattern = (value) =>
  value
    .replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
    .replace(/\\\*/g, ".*");

const presetNamesFromSource = () => {
  const match = presetSource.match(/export const storeScreenshotPresets = \[([\s\S]*?)\] as const;/);

  if (!match) {
    failures.push("Could not read storeScreenshotPresets from source.");
    return [];
  }

  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
};

const routeMapFromSource = () => {
  const match = presetSource.match(/export const storeScreenshotPresetRoutes:[\s\S]*?= \{([\s\S]*?)\};/);
  const routes = new Map();

  if (!match) {
    failures.push("Could not read storeScreenshotPresetRoutes from source.");
    return routes;
  }

  for (const item of match[1].matchAll(/(?:"([^"]+)"|([a-zA-Z0-9_]+)):\s*"([^"]+)"/g)) {
    routes.set(item[1] ?? item[2], item[3]);
  }

  return routes;
};

const requiredString = (value, description) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    failures.push(`${description} must be a non-empty string.`);
    return null;
  }

  return value.trim();
};

if (manifest.version !== 1) {
  failures.push("Store screenshot manifest version must be 1.");
}

if (manifest.sourceFlow !== "Welcome -> Photo upload -> Pet setup -> Hatching -> Pet reveal -> Main terrarium -> AI chat / premium bond -> Shop") {
  failures.push("Store screenshot manifest sourceFlow does not match the native journey.");
}

if (manifest.finalCaptureRequirement !== "Capture in a development-client or production build without Expo Go overlays.") {
  failures.push("Store screenshot manifest must keep the no-Expo-Go final capture requirement.");
}

const requiredPlatforms = Array.isArray(manifest.requiredPlatforms) ? manifest.requiredPlatforms : [];
for (const platform of ["ios", "android"]) {
  if (!requiredPlatforms.includes(platform)) {
    failures.push(`Store screenshot manifest missing required platform ${platform}.`);
  }
}

const strictPlatforms = (() => {
  if (!screenshotRequirement || /^(false|0|no)$/i.test(screenshotRequirement)) {
    return [];
  }

  if (/^(true|1|yes|all)$/i.test(screenshotRequirement)) {
    return requiredPlatforms;
  }

  const platforms = screenshotRequirement
    .split(",")
    .map((platform) => platform.trim())
    .filter(Boolean);
  const unsupported = platforms.filter((platform) => !requiredPlatforms.includes(platform));

  if (unsupported.length > 0) {
    failures.push(
      `TINY_PET_REQUIRE_STORE_SCREENSHOTS contains unsupported platform(s): ${unsupported.join(", ")}. Use ios, android, all, true, or leave it unset.`
    );
  }

  return platforms;
})();
const platformsToInspect = strictPlatforms.length > 0 ? strictPlatforms : requiredPlatforms;

const presets = presetNamesFromSource();
const routes = routeMapFromSource();
const screenshots = Array.isArray(manifest.screenshots) ? manifest.screenshots : [];
const screenshotPresetNames = screenshots.map((entry) => entry.preset);

if (JSON.stringify(screenshotPresetNames) !== JSON.stringify(presets)) {
  failures.push("Store screenshot manifest presets must match storeScreenshotPresets order.");
}

const outputFiles = existsSync(outputDirectory) ? readdirSync(outputDirectory) : [];

for (const entry of screenshots) {
  const preset = requiredString(entry.preset, "screenshot preset");
  const route = requiredString(entry.route, `route for ${preset ?? "unknown preset"}`);
  const caption = requiredString(entry.caption, `caption for ${preset ?? "unknown preset"}`);
  const captureLabel = requiredString(entry.captureLabel, `captureLabel for ${preset ?? "unknown preset"}`);

  if (!preset || !route || !caption || !captureLabel) {
    continue;
  }

  if (captureLabel !== `store-${preset}`) {
    failures.push(`${preset} captureLabel must be store-${preset}.`);
  }

  if (routes.get(preset) !== route) {
    failures.push(`${preset} route ${route} does not match source route ${routes.get(preset) ?? "(missing)"}.`);
  }

  if (!listing.includes(`| ${preset} | ${caption} |`)) {
    failures.push(`${preset} caption must match docs/release/store-listing-draft.md.`);
  }

  const fileRegex = new RegExp(`^(ios|android)-(.+)-${slugPattern(captureLabel)}\\.png$`);
  const matchedFiles = outputFiles.filter((fileName) => fileRegex.test(fileName));
  const matchedPlatforms = new Set();

  for (const fileName of matchedFiles) {
    const filePath = resolve(outputDirectory, fileName);
    const match = fileName.match(fileRegex);
    const platform = match?.[1] ?? null;
    const deviceSlug = match?.[2] ?? "unknown-device";

    if (deviceSlug.includes("-large-text")) {
      continue;
    }

    if (platform && !platformsToInspect.includes(platform)) {
      continue;
    }

    try {
      const info = readPngInfo(filePath, { rejectIosOpenUrlPrompt: platform === "ios" });

      if (info.width < 720 || info.height < 1280) {
        failures.push(`${fileName} is ${info.width}x${info.height}; expected at least 720x1280.`);
      }

      if (platform) {
        matchedPlatforms.add(platform);
        visualRecords.push({
          deviceSlug,
          fileName,
          fingerprint: info.fingerprint,
          platform,
          preset
        });
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (strictPlatforms.length > 0) {
    for (const platform of strictPlatforms) {
      if (!matchedPlatforms.has(platform)) {
        failures.push(`${preset} is missing a final ${platform} store screenshot matching ${captureLabel}.`);
      }
    }
  }
}

if (strictPlatforms.length > 0) {
  const strictRecords = visualRecords.filter((record) => strictPlatforms.includes(record.platform));

  for (let leftIndex = 0; leftIndex < strictRecords.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < strictRecords.length; rightIndex++) {
      const left = strictRecords[leftIndex];
      const right = strictRecords[rightIndex];

      if (left.platform !== right.platform || left.deviceSlug !== right.deviceSlug || left.preset === right.preset) {
        continue;
      }

      const distance = visualDistance(left.fingerprint, right.fingerprint);

      if (distance < 0.02) {
        failures.push(
          `${left.fileName} and ${right.fileName} are visually too similar (${distance.toFixed(4)}); store presets may have reused a stale screen.`
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Store screenshot validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  strictPlatforms.length > 0
    ? `Store screenshot validation passed with required ${strictPlatforms.join("/")} screenshots.`
    : "Store screenshot manifest validation passed."
);
