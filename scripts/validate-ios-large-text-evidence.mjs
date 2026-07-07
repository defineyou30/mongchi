import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifest = JSON.parse(readFileSync(resolve(ROOT, "docs/store-screenshot-manifest.json"), "utf8"));
const qaDeviceChecksPath = resolve(ROOT, "docs/qa-device-checks.md");
const manualChecklistPath = resolve(ROOT, "docs/ios-manual-qa-checklist.md");
const outputDirectory = resolve(ROOT, manifest.outputDirectory ?? "docs/qa-screenshots");
const screenshots = Array.isArray(manifest.screenshots) ? manifest.screenshots : [];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const failures = [];

const escapeRegex = (value) => value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

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
    }
  }

  return {
    blueRatio: sampled > 0 ? bluePixels / sampled : 0,
    darkRatio: sampled > 0 ? darkPixels / sampled : 0,
    greyRatio: sampled > 0 ? greyPixels / sampled : 0,
    lightRatio: sampled > 0 ? lightPixels / sampled : 0
  };
};

const appearsToBeIosOpenUrlPrompt = (decoded) => {
  const modal = sampleRegion(decoded, { left: 0.16, right: 0.84, top: 0.43, bottom: 0.58 });
  const buttonBand = sampleRegion(decoded, { left: 0.2, right: 0.8, top: 0.52, bottom: 0.57 });

  return (modal.lightRatio > 0.45 || modal.greyRatio > 0.25) && modal.darkRatio > 0.01 && buttonBand.blueRatio > 0.01;
};

const appearsToHaveDevClientFloatingToolButton = (decoded) => {
  const topRight = sampleRegion(decoded, { left: 0.86, right: 0.99, top: 0.09, bottom: 0.19 });

  return topRight.greyRatio > 0.08 && topRight.lightRatio < 0.12 && topRight.blueRatio < 0.04;
};

const readPngInfo = (filePath) => {
  if (!existsSync(filePath) || statSync(filePath).size === 0) {
    throw new Error(`${filePath} is missing or empty.`);
  }

  const bytes = readFileSync(filePath);

  if (bytes.length < 33 || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`${filePath} is not a PNG file.`);
  }

  const decoded = PNG.sync.read(bytes);
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
    throw new Error(`${filePath} appears to be a React Native red error screen, not valid large-text evidence.`);
  }

  if (appearsToBeIosOpenUrlPrompt(decoded)) {
    throw new Error(`${filePath} appears to include an iOS "Open in app" confirmation prompt.`);
  }

  if (appearsToHaveDevClientFloatingToolButton(decoded)) {
    throw new Error(`${filePath} appears to include the development-client tools button.`);
  }

  return {
    height: bytes.readUInt32BE(20),
    width: bytes.readUInt32BE(16)
  };
};

const outputFiles = existsSync(outputDirectory) ? readdirSync(outputDirectory) : [];
const devices = new Map();

for (const entry of screenshots) {
  const fileRegex = new RegExp(`^ios-(.+)-${escapeRegex(`large-text-${entry.captureLabel}`)}\\.png$`);

  for (const fileName of outputFiles) {
    const match = fileName.match(fileRegex);

    if (!match) {
      continue;
    }

    const deviceSlug = match[1];
    const entries = devices.get(deviceSlug) ?? new Map();
    entries.set(entry.preset, fileName);
    devices.set(deviceSlug, entries);
  }
}

const fullDevices = [...devices.entries()].filter(([, entries]) => screenshots.every((entry) => entries.has(entry.preset)));

if (fullDevices.length === 0) {
  failures.push("No iOS device has a complete large-text preset screenshot set.");
}

for (const [deviceSlug, entries] of fullDevices) {
  const sourcePaths = [];

  for (const entry of screenshots) {
    const filePath = resolve(outputDirectory, entries.get(entry.preset));
    sourcePaths.push(filePath);

    try {
      const info = readPngInfo(filePath);

      if (info.width < 1000 || info.height < 2000) {
        failures.push(`${filePath} is ${info.width}x${info.height}; expected a full iOS simulator screenshot.`);
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  const contactSheetPath = resolve(outputDirectory, `ios-${deviceSlug}-large-text-store-contact-sheet.png`);

  try {
    const info = readPngInfo(contactSheetPath);

    if (info.width < 600 || info.height < 1200) {
      failures.push(`${contactSheetPath} is ${info.width}x${info.height}; expected a multi-screen contact sheet.`);
    }

    const contactSheetMtime = statSync(contactSheetPath).mtimeMs;
    const latestSourceMtime = Math.max(...sourcePaths.map((filePath) => statSync(filePath).mtimeMs));

    if (contactSheetMtime + 1000 < latestSourceMtime) {
      failures.push(`${contactSheetPath} is older than at least one large-text source screenshot.`);
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

const qaDeviceChecks = existsSync(qaDeviceChecksPath) ? readFileSync(qaDeviceChecksPath, "utf8") : "";
const manualChecklist = existsSync(manualChecklistPath) ? readFileSync(manualChecklistPath, "utf8") : "";

if (!qaDeviceChecks.includes("large-text")) {
  failures.push("docs/qa-device-checks.md must reference the iOS large-text evidence.");
}

if (!manualChecklist.includes("capture:ios-large-text-evidence")) {
  failures.push("docs/ios-manual-qa-checklist.md must document the iOS large-text capture command.");
}

if (failures.length > 0) {
  console.error("iOS large-text evidence validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("iOS large-text evidence validation passed.");
